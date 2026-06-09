/**
 * defineProcessor — helper for creating processor definitions.
 *
 * @example
 * ```ts
 * const scorer = defineProcessor({
 *   name: "listing-scorer",
 *   input: ListingSchema,
 *   prompt: "Score this job: {{title}} at {{company}}",
 *   output: z.object({ score: z.number(), reasoning: z.string() }),
 * });
 * ```
 */
import { z } from "zod";
import type { ProcessorDefinition } from "../sdk/types.js";

export function defineProcessor<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
>(
  definition: ProcessorDefinition<TInput, TOutput>,
): ProcessorDefinition<TInput, TOutput> {
  if (!definition.name) {
    throw new Error("Processor must have a name");
  }
  if (!definition.input) {
    throw new Error("Processor must have an input schema");
  }
  if (!definition.prompt && !definition.process) {
    throw new Error("Processor must have either a prompt template or a process function");
  }
  if (!definition.output) {
    throw new Error("Processor must have an output schema");
  }
  return definition;
}
