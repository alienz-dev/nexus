/**
 * Nexus SDK — public API surface.
 * Generic, minimal dependencies. No nexus-specific modules.
 *
 * @example
 * ```ts
 * import { createNexus, defineSource, defineProcessor, definePipeline, z } from "nexus";
 *
 * const nexus = createNexus({ llm: { endpoint: "https://api.deepseek.com/v1", model: "deepseek-chat" } });
 * nexus.source(defineSource({ name: "my-source", schema: z.object({...}), fetch: async () => [...] }));
 * nexus.pipeline(definePipeline({ name: "my-pipeline", source: mySource, steps: [myProcessor] }));
 * await nexus.start();
 * ```
 */

// Core
export { createNexus } from "./nexus.js";
export { createContext } from "./context.js";

// Types
export type {
  NexusConfig,
  NexusContext,
  NexusInstance,
  NexusEvent,
  Logger,
  SourceDefinition,
  ProcessorDefinition,
  OutputDefinition,
  OutputTarget,
  PipelineDefinition,
  PipelineRunResult,
} from "./types.js";

export { NexusConfigSchema } from "./types.js";

// Pipeline helpers
export { defineSource, defineProcessor, defineOutput, definePipeline } from "../pipeline/index.js";

// LLM
export { createLLMClient, callStructured, callLLM, renderTemplate, extractVariables, validateVariables } from "../llm/index.js";
export type { LLMClient, LLMClientConfig, StructuredCallOptions } from "../llm/index.js";

// Zod (re-export for convenience)
export { z } from "zod";
