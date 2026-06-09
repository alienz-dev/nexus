/**
 * defineSource — helper for creating source definitions.
 *
 * @example
 * ```ts
 * const listings = defineSource({
 *   name: "job-listings",
 *   schema: z.object({ uid: z.string(), title: z.string(), ... }),
 *   fetch: async (ctx, since) => ctx.db.prepare("SELECT * FROM listings WHERE updated_at > ?").all(since ?? "1970-01-01"),
 *   cursor: "updated_at",
 * });
 * ```
 */
import { z } from "zod";
import type { SourceDefinition } from "../sdk/types.js";

export function defineSource<T extends z.ZodType>(
  definition: SourceDefinition<T>,
): SourceDefinition<T> {
  if (!definition.name) {
    throw new Error("Source must have a name");
  }
  if (!definition.schema) {
    throw new Error("Source must have a schema");
  }
  if (typeof definition.fetch !== "function") {
    throw new Error("Source must have a fetch function");
  }
  return definition;
}
