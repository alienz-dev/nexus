/** Configuration loading from nexus.yaml. */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";
import { z } from "zod";

// Optional yaml — falls back to JSON parse if not installed
let parseYaml: ((input: string) => any) | null = null;
try {
  const require = createRequire(import.meta.url);
  parseYaml = require("yaml").parse;
} catch {
  // yaml not available
}

const SourceSchema = z.object({
  path: z.string(),
  db: z.string().optional(),
  enabled: z.boolean().default(true),
});

const ConfigSchema = z.object({
  version: z.string().default("1"),
  database: z.object({
    main: z.string().default("./data/nexus.sqlite"),
    vectors: z.string().default("./data/vectors.lance"),
  }).default({}),
  sources: z.record(SourceSchema).default({}),
  rss: z.object({
    feeds: z.array(z.string()).default([]),
  }).default({}),
  rsshub: z.object({
    enabled: z.boolean().default(false),
    url: z.string().default("http://localhost:1200"),
    routes: z.array(z.string()).default([]),
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
  server: z.object({
    port: z.number().default(3777),
    host: z.string().default("localhost"),
  }).default({}),
  telegram: z.object({
    enabled: z.boolean().default(false),
    bot_token: z.string().default(""),
    chat_id: z.string().default(""),
  }).default({}),
  search: z.object({
    rrf_k: z.number().default(60),
    weights: z.object({
      bm25: z.number().default(0.4),
      vector: z.number().default(0.4),
      graph: z.number().default(0.2),
    }).default({}),
  }).default({}),
});

export type NexusConfig = z.infer<typeof ConfigSchema>;

/** Expand ~ to the user's home directory. */
export function expandTilde(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return p.replace("~", homedir());
  }
  return p;
}

/** Resolve config path: --config flag > NEXUS_CONFIG env > ./nexus.yaml */
function resolveConfigPath(configPath?: string): string {
  if (configPath) return resolve(configPath);
  if (process.env.NEXUS_CONFIG) return resolve(process.env.NEXUS_CONFIG);
  return resolve(process.cwd(), "nexus.yaml");
}

/** Load configuration from nexus.yaml. */
export function loadConfig(configPath?: string): NexusConfig {
  const path = resolveConfigPath(configPath);

  if (!existsSync(path)) {
    console.warn(`Config not found at ${path}, using defaults`);
    return expandConfigPaths(ConfigSchema.parse({}), path);
  }

  const raw = readFileSync(path, "utf-8");
  try {
    if (!parseYaml) {
      throw new Error("yaml package not installed. Run: npm install yaml");
    }
    const parsed = parseYaml(raw);
    const config = ConfigSchema.parse(parsed);
    return expandConfigPaths(config, path);
  } catch (e) {
    console.warn(`Failed to parse config: ${e}, using defaults`);
    return expandConfigPaths(ConfigSchema.parse({}), path);
  }
}

/** Expand tildes in all path fields and apply env var fallbacks. */
function expandConfigPaths(config: NexusConfig, configPath?: string): NexusConfig {
  const sources: Record<string, { path: string; db?: string; enabled: boolean }> = {};
  for (const [name, src] of Object.entries(config.sources)) {
    sources[name] = { ...src, path: expandTilde(src.path) };
  }

  // Resolve relative database paths relative to config file location
  const configDir = configPath ? dirname(configPath) : process.cwd();
  const resolveRelative = (p: string) => {
    if (p.startsWith("./") || p.startsWith("../")) {
      return resolve(configDir, p);
    }
    return expandTilde(p);
  };

  return {
    ...config,
    sources,
    database: {
      main: resolveRelative(config.database.main),
      vectors: resolveRelative(config.database.vectors),
    },
    llm: {
      ...config.llm,
      endpoint: process.env.LLM_ENDPOINT ?? config.llm.endpoint,
      model: process.env.LLM_MODEL ?? config.llm.model,
      apiKey: config.llm.apiKey ?? process.env.LLM_API_KEY,
    },
  };
}
