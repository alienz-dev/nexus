/** SDK core types — generic, no dependencies on nexus-specific modules. */
import { z } from "zod";
import type Database from "better-sqlite3";
import type { LLMClient } from "../llm/client.js";

// ─── NexusConfig ───────────────────────────────────────────

export const NexusConfigSchema = z.object({
  storage: z.object({
    main: z.string().default("./data/nexus.sqlite"),
  }).default({}),
  llm: z.object({
    /** LLM API endpoint. Falls back to LLM_ENDPOINT env var. */
    endpoint: z.string().optional(),
    /** Model name. Falls back to LLM_MODEL env var. */
    model: z.string().optional(),
    /** API key. Falls back to LLM_API_KEY env var. */
    apiKey: z.string().optional(),
    maxRetries: z.number().default(2),
  }).default({}),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type NexusConfig = z.infer<typeof NexusConfigSchema>;

// ─── NexusContext ──────────────────────────────────────────

/**
 * Shared context flowing through the system.
 * Generic — consumers can add their own fields via extend().
 */
export interface NexusContext {
  readonly db: Database.Database;
  readonly llm: LLMClient;
  readonly logger: Logger;
  readonly config: NexusConfig;
  readonly [key: string]: unknown;
}

/** Simple logger interface. */
export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

// ─── Source Definition ─────────────────────────────────────

/** A source produces items from an external system. */
export interface SourceDefinition<T extends z.ZodType = z.ZodType> {
  /** Unique source name. */
  readonly name: string;
  /** Zod schema defining the shape of items from this source. */
  readonly schema: T;
  /** Fetch items. If `since` is provided, only return items newer than that cursor. */
  fetch: (ctx: NexusContext, since?: string) => Promise<z.infer<T>[]>;
  /** Optional: field name to use as cursor for incremental processing. */
  cursor?: string;
  /** Optional: check if source is available. */
  isAvailable?: () => Promise<boolean>;
}

// ─── Processor Definition ──────────────────────────────────

/** A processor transforms items using LLM or custom logic. */
export interface ProcessorDefinition<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> {
  /** Unique processor name. */
  readonly name: string;
  /** Input schema (usually references a source schema). */
  readonly input: TInput;
  /** Prompt template with {{variable}} interpolation. */
  readonly prompt: string;
  /** Output schema — validates LLM response. */
  readonly output: TOutput;
  /** Optional: override LLM model for this processor. */
  model?: string;
  /** Optional: override temperature. */
  temperature?: number;
  /** Optional: system prompt. */
  systemPrompt?: string;
  /** Optional: custom processing function (bypasses LLM). */
  process?: (item: z.infer<TInput>, ctx: NexusContext) => Promise<z.infer<TOutput>>;
}

// ─── Output Definition ─────────────────────────────────────

export type OutputTarget =
  | { type: "dir"; path: string }
  | { type: "sqlite"; db: string; table: string }
  | { type: "webhook"; url: string }
  | { type: "json"; path: string };

/** An output defines how processed results are written. */
export interface OutputDefinition {
  /** Output format. */
  format: "markdown" | "json" | "csv" | "tsv";
  /** Template for rendering output ({{variable}} interpolation). Null for raw JSON. */
  template: string | null;
  /** Where to write the output. */
  target: OutputTarget;
  /** Optional: filename template (e.g., "{{uid}}.md"). */
  filename?: string;
}

// ─── Pipeline Definition ───────────────────────────────────

/** A pipeline wires source → processors → output. */
export interface PipelineDefinition {
  /** Unique pipeline name. */
  readonly name: string;
  /** Source to fetch data from. */
  readonly source: SourceDefinition;
  /** Ordered list of processors to run on each item. */
  readonly steps: ProcessorDefinition[];
  /** Output configuration. */
  readonly output?: OutputDefinition;
  /** Optional: cron schedule (e.g., every 30 minutes). */
  schedule?: string;
  /** Optional: max parallel LLM calls. */
  concurrency?: number;
  /** Optional: retry configuration. */
  retry?: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay?: number;
  };
}

// ─── Nexus Instance ────────────────────────────────────────

/** Pipeline run result. */
export interface PipelineRunResult {
  pipeline: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failures: Array<{ itemId: string; error: string }>;
}

/** Event types emitted by the Nexus instance. */
export type NexusEvent =
  | "pipeline:start"
  | "pipeline:complete"
  | "pipeline:error"
  | "ingest:start"
  | "ingest:complete"
  | "error";

/** The Nexus instance — the main entry point. */
export interface NexusInstance {
  /** Register a source. */
  source(src: SourceDefinition): NexusInstance;
  /** Register a processor. */
  process(proc: ProcessorDefinition): NexusInstance;
  /** Register an output. */
  output(out: OutputDefinition): NexusInstance;
  /** Register a pipeline. */
  pipeline(pipe: PipelineDefinition): NexusInstance;
  /** Listen for events. */
  on(event: NexusEvent, fn: (...args: unknown[]) => void): NexusInstance;
  /** Run a specific pipeline by name. */
  run(pipelineName: string): Promise<PipelineRunResult>;
  /** Start all scheduled pipelines. */
  start(): Promise<void>;
  /** Stop all scheduled pipelines and release resources. */
  stop(): Promise<void>;
  /** Access the shared context (must call start() first). */
  ctx(): NexusContext;
}
