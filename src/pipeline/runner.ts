/**
 * PipelineRunner — executes pipelines with incremental processing,
 * checkpoint/resume, rate limiting, and concurrency control.
 */
import type { z } from "zod";
import type {
  PipelineDefinition,
  PipelineRunResult,
  NexusContext,
} from "../sdk/types.js";
import { CheckpointManager } from "./checkpoint.js";
import { callStructured } from "../llm/structured.js";
import { renderTemplate } from "../llm/templates.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Process items with concurrency control using p-queue. */
async function processConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<Array<{ status: "ok"; value: R } | { status: "error"; error: Error; item: T }>> {
  // Dynamic import to avoid hard dependency if not used
  const PQueue = (await import("p-queue")).default;
  const queue = new PQueue({ concurrency });
  const results: Array<
    { status: "ok"; value: R } | { status: "error"; error: Error; item: T }
  > = [];

  const promises = items.map((item) =>
    queue.add(async () => {
      try {
        const value = await fn(item);
        results.push({ status: "ok", value });
      } catch (error) {
        results.push({
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
          item,
        });
      }
    }),
  );

  await Promise.all(promises);
  return results;
}

/**
 * Run a pipeline: fetch → filter checkpointed → process → output → checkpoint.
 */
export async function runPipeline(
  pipeline: PipelineDefinition,
  ctx: NexusContext,
): Promise<PipelineRunResult> {
  const startTime = Date.now();
  const checkpoint = new CheckpointManager(ctx.db, pipeline.name);

  // 1. Fetch items (incremental)
  ctx.logger.info(`[${pipeline.name}] Fetching from source: ${pipeline.source.name}`);
  const since = checkpoint.getCursor() || undefined;
  const allItems = await pipeline.source.fetch(ctx, since);
  ctx.logger.info(`[${pipeline.name}] Fetched ${allItems.length} items`);

  // 2. Filter out already-completed items
  const pending = pipeline.source.cursor
    ? allItems.filter((item) => {
        const itemId = getItemId(item, pipeline.source.cursor);
        return !checkpoint.isCompleted(itemId);
      })
    : allItems;

  ctx.logger.info(`[${pipeline.name}] Processing ${pending.length} items (${allItems.length - pending.length} already done)`);

  if (pending.length === 0) {
    checkpoint.flush();
    return {
      pipeline: pipeline.name,
      total: 0,
      succeeded: 0,
      failed: 0,
      skipped: allItems.length,
      durationMs: Date.now() - startTime,
      failures: [],
    };
  }

  // 3. Process items through pipeline steps
  const concurrency = pipeline.concurrency ?? 3;
  const failures: Array<{ itemId: string; error: string }> = [];
  let succeeded = 0;

  const results = await processConcurrent(
    pending,
    async (item) => {
      const itemId = getItemId(item, pipeline.source.cursor);
      let current: unknown = item;

      // Run each processor step
      for (const step of pipeline.steps) {
        if (step.process) {
          // Custom processing function
          current = await step.process(current as never, ctx);
        } else {
          // LLM processing
          current = await callStructured({
            client: ctx.llm,
            systemPrompt: step.systemPrompt,
            prompt: step.prompt,
            vars: current as Record<string, unknown>,
            schema: step.output,
            model: step.model,
            temperature: step.temperature,
            maxRetries: pipeline.retry?.maxAttempts ?? 2,
          });
        }
      }

      // 4. Write output
      if (pipeline.output) {
        await writeOutput(pipeline.output, item, current, ctx, pipeline.source.cursor);
      }

      // 5. Checkpoint
      checkpoint.markComplete(itemId);
      succeeded++;
    },
    concurrency,
  );

  // Collect failures
  for (const result of results) {
    if (result.status === "error") {
      const itemId = getItemId(result.item, pipeline.source.cursor);
      failures.push({
        itemId,
        error: result.error.message,
      });
    }
  }

  // Update cursor
  if (allItems.length > 0 && pipeline.source.cursor) {
    const lastItem = allItems[allItems.length - 1];
    const cursorValue = getCursorValue(lastItem, pipeline.source.cursor);
    if (cursorValue) {
      checkpoint.setCursor(cursorValue);
    }
  }

  checkpoint.flush();

  const durationMs = Date.now() - startTime;
  ctx.logger.info(
    `[${pipeline.name}] Complete: ${succeeded} succeeded, ${failures.length} failed in ${durationMs}ms`,
  );

  return {
    pipeline: pipeline.name,
    total: pending.length,
    succeeded,
    failed: failures.length,
    skipped: allItems.length - pending.length,
    durationMs,
    failures,
  };
}

/** Extract item ID from cursor field or generate one. */
function getItemId(item: unknown, cursor?: string): string {
  if (!cursor) return JSON.stringify(item);
  const obj = item as Record<string, unknown>;
  const value = obj[cursor] ?? obj["id"] ?? obj["uid"];
  return String(value ?? JSON.stringify(item));
}

/** Extract cursor value from an item. */
function getCursorValue(item: unknown, cursor?: string): string | null {
  if (!cursor) return null;
  const obj = item as Record<string, unknown>;
  const value = obj[cursor];
  return value != null ? String(value) : null;
}

/** Write output to the configured target. */
async function writeOutput(
  output: { format: string; template: string | null; target: { type: string; path?: string; db?: string; table?: string; url?: string }; filename?: string },
  originalItem: unknown,
  processedItem: unknown,
  ctx: NexusContext,
  cursor?: string,
): Promise<void> {
  const vars = {
    ...(originalItem as Record<string, unknown>),
    ...(processedItem as Record<string, unknown>),
  };

  switch (output.target.type) {
    case "dir": {
      const dir = output.target.path!;
      mkdirSync(dir, { recursive: true });

      const filename = output.filename
        ? renderTemplate(output.filename, vars)
        : `${getItemId(originalItem, cursor)}.${output.format === "markdown" ? "md" : output.format}`;

      const content = output.template
        ? renderTemplate(output.template, vars)
        : JSON.stringify(processedItem, null, 2);

      writeFileSync(join(dir, filename), content, "utf-8");
      break;
    }
    case "json": {
      const dir = dirname(output.target.path!);
      mkdirSync(dir, { recursive: true });
      const content = JSON.stringify(processedItem, null, 2);
      writeFileSync(output.target.path!, content, "utf-8");
      break;
    }
    case "sqlite": {
      // Write to consumer's SQLite — not implemented yet, would need their DB connection
      ctx.logger.warn(`[${"output"}] SQLite output target not yet implemented`);
      break;
    }
    case "webhook": {
      try {
        await fetch(output.target.url!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(processedItem),
        });
      } catch (error) {
        ctx.logger.error(`Webhook failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      break;
    }
  }
}
