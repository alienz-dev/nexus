/**
 * Context factory — creates NexusContext from config.
 * Generic — no dependencies on nexus-specific modules.
 */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createLLMClient } from "../llm/client.js";
import { initCheckpointTable } from "../pipeline/checkpoint.js";
import type { NexusConfig, NexusContext, Logger } from "./types.js";

/** Create a logger at the configured level. */
function createLogger(level: NexusConfig["logLevel"]): Logger {
  const levels = ["debug", "info", "warn", "error"] as const;
  const threshold = levels.indexOf(level ?? "info");

  return {
    debug: threshold <= 0 ? (...args) => console.log("[DEBUG]", ...args) : () => {},
    info: threshold <= 1 ? (...args) => console.log("[INFO]", ...args) : () => {},
    warn: threshold <= 2 ? (...args) => console.warn("[WARN]", ...args) : () => {},
    error: threshold <= 3 ? (...args) => console.error("[ERROR]", ...args) : () => {},
  };
}

/** Options for createContext. */
export interface CreateContextOptions extends NexusConfig {
  /**
   * Optional extension function. Receives the base context and returns
   * an extended context with additional fields.
   *
   * @example
   * ```ts
   * const ctx = await createContext({
   *   storage: { main: "./data/nexus.sqlite" },
   *   extend: async (base) => ({
   *     ...base,
   *     myDb: await createMyDb(),
   *     mySearch: createMySearch(),
   *   }),
   * });
   * ```
   */
  extend?: (base: NexusContext) => Promise<NexusContext>;
}

/**
 * Create a NexusContext from config.
 * Only sets up SQLite + LLM client + logger. Consumers extend via `extend` option.
 *
 * @example
 * ```ts
 * // Minimal — just pipeline engine
 * const ctx = await createContext({ llm: { endpoint: "https://api.deepseek.com/v1" } });
 *
 * // Extended — add your own components
 * const ctx = await createContext({
 *   llm: { endpoint: "https://api.deepseek.com/v1" },
 *   extend: async (base) => ({ ...base, myService: new MyService() }),
 * });
 * ```
 */
export async function createContext(config: CreateContextOptions): Promise<NexusContext> {
  const logger = createLogger(config.logLevel);

  // Ensure storage directory exists
  mkdirSync(dirname(config.storage.main), { recursive: true });

  // Open SQLite
  logger.info(`Opening database: ${config.storage.main}`);
  const db = new Database(config.storage.main);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Initialize checkpoint table
  initCheckpointTable(db);

  // Create LLM client
  const llm = createLLMClient(config.llm);

  // Build base context
  const base: NexusContext = { db, llm, logger, config };

  // Extend if provided
  if (config.extend) {
    const extended = await config.extend(base);
    logger.info("Nexus context initialized (extended)");
    return extended;
  }

  logger.info("Nexus context initialized");
  return base;
}
