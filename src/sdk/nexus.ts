/**
 * Nexus class — the main entry point.
 *
 * @example
 * ```ts
 * const nexus = createNexus({ llm: { endpoint: "https://api.deepseek.com/v1", model: "deepseek-chat" } });
 * nexus.source(mySource);
 * nexus.process(myProcessor);
 * nexus.pipeline(myPipeline);
 * await nexus.start();
 * ```
 */
import type {
  NexusConfig,
  NexusContext,
  NexusInstance,
  NexusEvent,
  SourceDefinition,
  ProcessorDefinition,
  OutputDefinition,
  PipelineDefinition,
  PipelineRunResult,
} from "./types.js";
import { NexusConfigSchema } from "./types.js";
import { createContext } from "./context.js";
import { runPipeline } from "../pipeline/runner.js";
import { PipelineScheduler } from "../pipeline/scheduler.js";

export function createNexus(config?: Partial<NexusConfig>): NexusInstance {
  const resolvedConfig = NexusConfigSchema.parse(config ?? {});

  const sources: SourceDefinition[] = [];
  const processors: ProcessorDefinition[] = [];
  const outputs: OutputDefinition[] = [];
  const pipelines: PipelineDefinition[] = [];
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  let ctx: NexusContext | null = null;
  let scheduler: PipelineScheduler | null = null;
  let running = false;

  function emit(event: NexusEvent, ...args: unknown[]): void {
    const fns = handlers.get(event) ?? [];
    for (const fn of fns) {
      try {
        fn(...args);
      } catch (error) {
        ctx?.logger.error(`Event handler error for "${event}": ${error}`);
      }
    }
  }

  const instance: NexusInstance = {
    source(src) {
      sources.push(src);
      return instance;
    },

    process(proc) {
      processors.push(proc);
      return instance;
    },

    output(out) {
      outputs.push(out);
      return instance;
    },

    pipeline(pipe) {
      pipelines.push(pipe);
      return instance;
    },

    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(fn);
      return instance;
    },

    ctx() {
      if (!ctx) throw new Error("Nexus not started. Call start() first.");
      return ctx;
    },

    async run(pipelineName: string): Promise<PipelineRunResult> {
      if (!ctx) {
        ctx = await createContext(resolvedConfig);
      }

      const pipeline = pipelines.find((p) => p.name === pipelineName);
      if (!pipeline) {
        throw new Error(`Pipeline "${pipelineName}" not found. Registered: ${pipelines.map((p) => p.name).join(", ")}`);
      }

      emit("pipeline:start", pipeline.name);

      try {
        const result = await runPipeline(pipeline, ctx);
        emit("pipeline:complete", pipeline.name, result);
        return result;
      } catch (error) {
        emit("pipeline:error", pipeline.name, error);
        throw error;
      }
    },

    async start(): Promise<void> {
      if (running) return;

      ctx = await createContext(resolvedConfig);
      scheduler = new PipelineScheduler(ctx);

      // Register all pipelines with schedules
      for (const pipeline of pipelines) {
        scheduler.register(pipeline);
      }

      // Start scheduled tasks
      scheduler.start();
      running = true;

      ctx.logger.info(`Nexus started with ${pipelines.length} pipelines (${scheduler.list().length} scheduled)`);
    },

    async stop(): Promise<void> {
      if (!running) return;

      scheduler?.stopAll();
      ctx?.db.close();

      scheduler = null;
      ctx = null;
      running = false;
    },
  };

  return instance;
}
