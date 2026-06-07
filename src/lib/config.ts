/** Configuration loading from nexus.yaml. */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { parse as parseYaml } from "yaml";

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
    provider: z.string().default("mimo-gateway"),
    model: z.string().default("mimo-v2.5-pro"),
    fallback: z.string().default("deepseek"),
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
    embedding_model: z.string().default("BAAI/bge-m3"),
    reranker: z.string().default("BAAI/bge-reranker-v2-m3"),
    rrf_k: z.number().default(60),
    weights: z.object({
      bm25: z.number().default(0.4),
      vector: z.number().default(0.4),
      graph: z.number().default(0.2),
    }).default({}),
  }).default({}),
});

export type NexusConfig = z.infer<typeof ConfigSchema>;

/** Load configuration from nexus.yaml in the project root. */
export function loadConfig(configPath?: string): NexusConfig {
  const path = configPath ?? resolve(process.cwd(), "nexus.yaml");

  if (!existsSync(path)) {
    console.warn(`Config not found at ${path}, using defaults`);
    return ConfigSchema.parse({});
  }

  const raw = readFileSync(path, "utf-8");
  try {
    const parsed = parseYaml(raw);
    return ConfigSchema.parse(parsed);
  } catch (e) {
    console.warn(`Failed to parse config: ${e}, using defaults`);
    return ConfigSchema.parse({});
  }
}
