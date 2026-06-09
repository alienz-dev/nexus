/**
 * defineOutput — helper for creating output definitions.
 *
 * @example
 * ```ts
 * const output = defineOutput({
 *   format: "markdown",
 *   template: "---\ntitle: {{title}}\nscore: {{score}}\n---\n{{summary}}",
 *   target: { type: "dir", path: "./output" },
 * });
 * ```
 */
import type { OutputDefinition } from "../sdk/types.js";

export function defineOutput(definition: OutputDefinition): OutputDefinition {
  if (!definition.format) {
    throw new Error("Output must have a format");
  }
  if (!definition.target) {
    throw new Error("Output must have a target");
  }
  return definition;
}
