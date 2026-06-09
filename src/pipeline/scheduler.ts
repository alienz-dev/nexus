/**
 * Pipeline scheduler — per-pipeline cron scheduling via node-cron.
 */
import cron from "node-cron";
import type { PipelineDefinition, NexusContext, PipelineRunResult } from "../sdk/types.js";
import { runPipeline } from "./runner.js";

interface ScheduledTask {
  pipeline: PipelineDefinition;
  task: cron.ScheduledTask;
}

/**
 * Manages scheduled pipeline executions.
 */
export class PipelineScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private running = false;

  constructor(private ctx: NexusContext) {}

  /** Register a pipeline for scheduled execution. */
  register(pipeline: PipelineDefinition): void {
    if (!pipeline.schedule) {
      this.ctx.logger.debug(`[scheduler] Pipeline "${pipeline.name}" has no schedule, skipping`);
      return;
    }

    if (!cron.validate(pipeline.schedule)) {
      this.ctx.logger.error(`[scheduler] Invalid cron expression for "${pipeline.name}": ${pipeline.schedule}`);
      return;
    }

    // Stop existing task if re-registering
    this.stop(pipeline.name);

    const task = cron.schedule(pipeline.schedule, async () => {
      if (!this.running) return;
      this.ctx.logger.info(`[scheduler] Running scheduled pipeline: ${pipeline.name}`);
      try {
        const result = await runPipeline(pipeline, this.ctx);
        this.ctx.logger.info(
          `[scheduler] Pipeline "${pipeline.name}" completed: ${result.succeeded}/${result.total} succeeded`,
        );
      } catch (error) {
        this.ctx.logger.error(
          `[scheduler] Pipeline "${pipeline.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    this.tasks.set(pipeline.name, { pipeline, task });
    this.ctx.logger.info(`[scheduler] Registered pipeline "${pipeline.name}" with schedule: ${pipeline.schedule}`);
  }

  /** Start all registered scheduled tasks. */
  start(): void {
    this.running = true;
    for (const [name, { task }] of this.tasks) {
      task.start();
      this.ctx.logger.info(`[scheduler] Started scheduled pipeline: ${name}`);
    }
  }

  /** Stop a specific scheduled task. */
  stop(pipelineName: string): void {
    const entry = this.tasks.get(pipelineName);
    if (entry) {
      entry.task.stop();
      this.tasks.delete(pipelineName);
      this.ctx.logger.info(`[scheduler] Stopped scheduled pipeline: ${pipelineName}`);
    }
  }

  /** Stop all scheduled tasks. */
  stopAll(): void {
    this.running = false;
    for (const [name, { task }] of this.tasks) {
      task.stop();
      this.ctx.logger.info(`[scheduler] Stopped scheduled pipeline: ${name}`);
    }
    this.tasks.clear();
  }

  /** List registered pipelines. */
  list(): Array<{ name: string; schedule: string }> {
    return Array.from(this.tasks.values()).map(({ pipeline }) => ({
      name: pipeline.name,
      schedule: pipeline.schedule!,
    }));
  }
}
