# Nexus

Generalized knowledge engine SDK — ingest, process, and serve knowledge with LLM-powered pipelines.

```
  ┌─────────────────────────────────────────────────────────┐
  │  Consumer Project (your code)                           │
  │                                                         │
  │  import { createNexus, defineSource, defineProcessor }  │
  │         from "nexus"                                    │
  │                                                         │
  │  const nexus = createNexus(config)                      │
  │  nexus.source(mySource)                                 │
  │  nexus.pipeline(myPipeline)                             │
  │  await nexus.start()                                    │
  └─────────────────────────────────────────────────────────┘
```

## What It Is

Nexus is a **library** (not a platform) that provides:

- **Pipeline engine** — define sources, processors, and outputs; nexus handles orchestration
- **LLM integration** — OpenAI-compatible client with structured output (Zod validation)
- **Checkpoint/resume** — crash-safe incremental processing with per-item tracking
- **Rate limiting** — concurrency control and API rate limiting for LLM calls
- **Scheduling** — per-pipeline cron scheduling
- **Knowledge graph** (optional) — entity extraction, vector search, graph traversal

## Install

```bash
npm install nexus
```

## Supported LLM Providers

Any OpenAI-compatible endpoint works — no provider is hardcoded. Examples:

| Provider | Endpoint | Model |
|----------|----------|-------|
| LLM Router (auto) | `http://localhost:8642/v1` | `openrouter/free` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Ollama | `http://localhost:11434/v1` | `llama3` |
| LM Studio | `http://localhost:1234/v1` | `local-model` |
| LiteLLM | `http://localhost:4000/v1` | `gpt-4o-mini` |
| vLLM | `http://localhost:8000/v1` | `mistral-7b` |

The `openrouter/free` model uses OpenRouter's auto-routing to pick the best free-tier model for each request.

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

| Variable | Purpose | Default |
|----------|---------|---------|
| `LLM_ENDPOINT` | OpenAI-compatible API endpoint | — (required for LLM features) |
| `LLM_MODEL` | Model name | — (required for LLM features) |
| `LLM_API_KEY` | API key for LLM calls | — (optional for local models) |
| `GITHUB_TOKEN` | GitHub Stars bridge (read:user scope) | — |
| `RAINDROP_TOKEN` | Raindrop.io bridge | — |
| `NEXUS_CONFIG` | Path to nexus.yaml | `./nexus.yaml` |

## Quick Start

```typescript
import { createNexus, defineSource, defineProcessor, definePipeline, z } from "nexus";

// Define what data looks like
const listings = defineSource({
  name: "job-listings",
  schema: z.object({
    uid: z.string(),
    title: z.string(),
    company: z.string(),
    description: z.string(),
  }),
  fetch: async (ctx, since) => {
    return ctx.db.prepare("SELECT * FROM listings WHERE updated_at > ?")
      .all(since ?? "1970-01-01");
  },
  cursor: "updated_at",
});

// Define how to process it
const scorer = defineProcessor({
  name: "listing-scorer",
  input: listings.schema,
  prompt: `Score this job listing 0-100 for relevance.
    Title: {{title}}
    Company: {{company}}
    Description: {{description}}`,
  output: z.object({
    score: z.number().min(0).max(100),
    reasoning: z.string(),
    tags: z.array(z.string()),
  }),
});

// Wire it together
const pipeline = definePipeline({
  name: "job-scoring",
  source: listings,
  steps: [scorer],
  concurrency: 3,
  schedule: "*/30 * * * *",  // every 30 minutes
});

// Run it
const nexus = createNexus({
  llm: {
    endpoint: "https://api.deepseek.com/v1",  // any OpenAI-compatible endpoint
    model: "deepseek-chat",
    apiKey: process.env.DEEPSEEK_API_KEY,
  },
});

nexus.pipeline(pipeline);
await nexus.run("job-scoring");  // manual run
// or
await nexus.start();              // scheduled mode
```

## Core Concepts

### defineSource

A source produces items from an external system.

```typescript
import { defineSource, z } from "nexus";

const mySource = defineSource({
  name: "my-data",
  schema: z.object({ id: z.string(), content: z.string() }),
  fetch: async (ctx, since) => {
    // ctx.db — SQLite connection
    // ctx.llm — LLM client
    // ctx.logger — logger
    // since — cursor from last run (for incremental processing)
    return myDb.query("SELECT * WHERE updated_at > ?", since);
  },
  cursor: "updated_at",  // field to track incremental progress
});
```

### defineProcessor

A processor transforms items using LLM or custom logic.

```typescript
import { defineProcessor, z } from "nexus";

// LLM-powered processor
const analyzer = defineProcessor({
  name: "analyzer",
  input: z.object({ content: z.string() }),
  prompt: "Analyze this content: {{content}}",
  output: z.object({
    summary: z.string(),
    sentiment: z.enum(["positive", "neutral", "negative"]),
  }),
  temperature: 0.3,
});

// Custom logic processor (no LLM)
const counter = defineProcessor({
  name: "word-counter",
  input: z.object({ content: z.string() }),
  prompt: "",  // required but unused when process() is provided
  output: z.object({ wordCount: z.number() }),
  process: async (item) => ({
    wordCount: item.content.split(" ").length,
  }),
});
```

### defineOutput

An output defines how results are written.

```typescript
import { defineOutput } from "nexus";

// Write markdown files
const mdOutput = defineOutput({
  format: "markdown",
  template: `---
title: {{title}}
score: {{score}}
---
## {{title}}
{{summary}}`,
  target: { type: "dir", path: "./output" },
  filename: "{{uid}}.md",
});

// Write JSON
const jsonOutput = defineOutput({
  format: "json",
  template: null,
  target: { type: "dir", path: "./data/output" },
});

// POST to webhook
const webhookOutput = defineOutput({
  format: "json",
  template: null,
  target: { type: "webhook", url: "http://localhost:3000/api/results" },
});
```

### definePipeline

A pipeline wires source → processors → output.

```typescript
import { definePipeline } from "nexus";

const pipeline = definePipeline({
  name: "my-pipeline",
  source: mySource,
  steps: [step1, step2, step3],  // runs in order
  output: myOutput,
  schedule: "0 9 * * *",         // daily at 9am
  concurrency: 5,                 // max parallel LLM calls
  retry: { maxAttempts: 3, baseDelay: 1000 },
});
```

### createNexus

The main entry point.

```typescript
import { createNexus } from "nexus";

const nexus = createNexus({
  storage: { main: "./data/nexus.sqlite" },
  llm: {
    endpoint: "https://api.deepseek.com/v1",  // any OpenAI-compatible endpoint
    model: "deepseek-chat",
    apiKey: process.env.DEEPSEEK_API_KEY,      // or set LLM_API_KEY env var
    maxRetries: 2,
  },
  logLevel: "info",
});

// Register components
nexus.source(mySource);
nexus.process(myProcessor);
nexus.output(myOutput);
nexus.pipeline(myPipeline);

// Listen for events
nexus.on("pipeline:complete", (name, result) => {
  console.log(`${name}: ${result.succeeded} succeeded`);
});

// Run
await nexus.run("my-pipeline");  // manual
await nexus.start();              // scheduled (blocks until stop())
await nexus.stop();               // graceful shutdown
```

## Context Extensions

The context (`ctx`) passed to sources and processors is extensible. Add your own fields:

```typescript
const nexus = createNexus({
  llm: { endpoint: "https://api.openai.com/v1" },
  extend: async (base) => ({
    ...base,
    myDb: await createMyDatabase(),
    mySearch: createMySearchEngine(),
    careerProfile: loadCareerProfile(),
  }),
});

// Now available in fetch() and process():
const source = defineSource({
  name: "my-source",
  schema: z.object({ id: z.string() }),
  fetch: async (ctx) => {
    return ctx.myDb.query("SELECT * FROM items");
  },
});
```

## Knowledge Graph (Optional)

The knowledge graph is an opt-in plugin. It adds entity extraction, vector search, and graph traversal.

```typescript
import { createNexus } from "nexus";
import { withKnowledge } from "nexus/knowledge";

const nexus = createNexus({
  storage: { main: "./data/nexus.sqlite" },
  llm: { endpoint: "https://api.openai.com/v1" },
  extend: withKnowledge({
    vectorsPath: "./data/vectors.lance",
    entityTypes: ["skill", "company", "role", "technology"],
  }),
});

// Knowledge fields are now on ctx:
// ctx.entities — EntityStore (CRUD for entities, relations, facts)
// ctx.vectors — LanceVectorStore (semantic search)
// ctx.search — UnifiedSearch (BM25 + vector + graph RRF)
// ctx.graph — KnowledgeGraph (entity extraction + traversal)
// ctx.resolver — EntityResolver (canonical name dedup)
// ctx.indexer — ContentIndexer (differential content indexing)
```

## LLM Structured Output

Processors automatically validate LLM output against Zod schemas:

1. Schema is sent as `response_format` to the LLM API
2. Response is parsed and validated with Zod
3. On failure: `jsonrepair` tries to fix malformed JSON
4. On failure: validation error is fed back to the LLM for self-correction
5. Max 2 retries by default

```typescript
const proc = defineProcessor({
  name: "extractor",
  input: z.object({ text: z.string() }),
  prompt: "Extract entities from: {{text}}",
  output: z.object({
    entities: z.array(z.object({
      name: z.string(),
      type: z.enum(["person", "company", "technology"]),
      confidence: z.number().min(0).max(1),
    })),
  }),
});
// If the LLM returns invalid JSON, nexus retries with the error context
```

## Pipeline Runner Features

- **Incremental processing** — tracks a cursor per source, only fetches new items
- **Checkpoint/resume** — per-item completion tracking; crash recovery skips completed items
- **Concurrency control** — `p-queue` limits parallel LLM calls
- **Rate limiting** — `bottleneck` handles API rate limits with reservoir semantics
- **Retry with backoff** — exponential backoff on transient failures
- **Partial failure handling** — one failed item doesn't kill the batch

## Architecture

```
  ┌─────────────────────────────────────────────────────────┐
  │  nexus (npm package)                                    │
  │                                                         │
  │  src/sdk/        Public API (createNexus, createContext)│
  │  src/llm/        LLM client, templates, structured out  │
  │  src/pipeline/   Source, Processor, Output, Runner      │
  │  src/knowledge/  (optional) Entity extraction, vectors  │
  │  src/cli/        (optional) CLI commands                │
  │  src/serve/      (optional) REST API, MCP server        │
  └─────────────────────────────────────────────────────────┘

  Dependencies:
    Core:    zod, better-sqlite3, zod-to-json-schema, jsonrepair,
             node-cron, p-queue, bottleneck
    Optional: @lancedb/lancedb, @huggingface/transformers, hono,
             @modelcontextprotocol/sdk
```

## CLI (Legacy)

The CLI wraps the SDK for command-line usage:

```bash
nexus status       # check connected sources
nexus ingest       # pull data from all sources
nexus enrich       # extract entities and facts
nexus search "machine learning"  # search your knowledge
nexus serve        # start REST API server
```

## MCP Server

Expose tools to Claude Code:

```json
{
  "mcpServers": {
    "nexus": {
      "command": "npx",
      "args": ["tsx", "node_modules/nexus/dist/serve/mcp/standalone.js"]
    }
  }
}
```

Or if running from source:
```json
{
  "mcpServers": {
    "nexus": {
      "command": "npx",
      "args": ["tsx", "/path/to/nexus/src/serve/mcp/standalone.ts"]
    }
  }
}
```

Tools: `nexus_search`, `nexus_gaps`, `nexus_entity`, `nexus_digest`, `nexus_audit`, `nexus_memory`.

## License

MIT
