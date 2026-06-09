/** definePipeline — helper for creating pipeline definitions. */
import type { PipelineDefinition } from "../sdk/types.js";

export function definePipeline(definition: PipelineDefinition): PipelineDefinition {
  if (!definition.name) {
    throw new Error("Pipeline must have a name");
  }
  if (!definition.source) {
    throw new Error("Pipeline must have a source");
  }
  if (!definition.steps || definition.steps.length === 0) {
    throw new Error("Pipeline must have at least one step");
  }
  return {
    concurrency: 3,
    retry: { maxAttempts: 3, baseDelay: 1000, maxDelay: 30_000 },
    ...definition,
  };
}
