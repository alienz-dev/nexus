/**
 * Knowledge plugin type augmentations.
 * Import this to get typed access to knowledge context fields.
 *
 * @example
 * ```ts
 * import type { KnowledgeContext } from "nexus/knowledge";
 *
 * function myProcessor(item: Item, ctx: NexusContext & KnowledgeContext) {
 *   const results = ctx.search.search({ query: "..." });
 * }
 * ```
 */
export type { KnowledgeContext } from "./plugin.js";
export type { KnowledgePluginOptions } from "./plugin.js";
