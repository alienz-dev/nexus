# API Reference

## SDK (`nexus`)

### `createNexus(config?) → NexusInstance`

Create a nexus instance.

```typescript
import { createNexus } from "nexus";

const nexus = createNexus({
  storage: { main: "./data/nexus.sqlite" },
  llm: {
    endpoint: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKey: process.env.DEEPSEEK_API_KEY,
    maxRetries: 2,
  },
  logLevel: "info",
});
```

#### `NexusConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `storage.main` | `string` | `"./data/nexus.sqlite"` | SQLite database path |
| `llm.endpoint` | `string` | — | OpenAI-compatible API endpoint |
| `llm.model` | `string` | — | Model name |
| `llm.apiKey` | `string` | — | API key (optional for local models) |
| `llm.maxRetries` | `number` | `2` | Max retries on LLM failure |
| `logLevel` | `"debug" \| "info" \| "warn" \| "error"` | `"info"` | Log level |
| `extend` | `async (base) => object` | — | Context extension function |

#### `NexusInstance`

| Method | Description |
|--------|-------------|
| `.source(src)` | Register a source |
| `.process(proc)` | Register a processor |
| `.output(out)` | Register an output |
| `.pipeline(pipe)` | Register a pipeline |
| `.run(name)` | Run a pipeline once |
| `.start()` | Start all scheduled pipelines (blocks) |
| `.stop()` | Graceful shutdown |
| `.on(event, handler)` | Listen for events |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `"pipeline:start"` | `(name: string)` | Pipeline started |
| `"pipeline:complete"` | `(name: string, result: PipelineRunResult)` | Pipeline finished |
| `"pipeline:error"` | `(name: string, error: Error)` | Pipeline failed |
| `"item:complete"` | `(pipeline: string, itemId: string)` | Single item processed |

---

### `createContext(config?) → NexusContext`

Create a standalone context (for use outside `createNexus`).

```typescript
import { createContext } from "nexus";

const ctx = await createContext({
  llm: { endpoint: "http://localhost:11434/v1", model: "llama3" },
});
```

---

## Pipeline Helpers

### `defineSource(def) → SourceDefinition`

Define a data source.

```typescript
import { defineSource, z } from "nexus";

const mySource = defineSource({
  name: "my-data",
  schema: z.object({ id: z.string(), content: z.string() }),
  fetch: async (ctx, since) => {
    // ctx.db — SQLite connection
    // ctx.llm — LLM client
    // ctx.logger — logger
    // since — cursor from last run (null on first run)
    return items;
  },
  cursor: "updated_at",  // field name for incremental tracking
});
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | Unique source name |
| `schema` | `ZodSchema` | yes | Schema for fetched items |
| `fetch` | `(ctx, since?) => Promise<T[]>` | yes | Fetch function |
| `cursor` | `string` | no | Field name for incremental cursor |

---

### `defineProcessor(def) → ProcessorDefinition`

Define a processing step.

```typescript
import { defineProcessor, z } from "nexus";

// LLM-powered
const analyzer = defineProcessor({
  name: "analyzer",
  input: z.object({ content: z.string() }),
  prompt: "Analyze: {{content}}",
  output: z.object({ summary: z.string(), sentiment: z.enum(["positive", "neutral", "negative"]) }),
  temperature: 0.3,
});

// Custom logic (no LLM)
const counter = defineProcessor({
  name: "word-counter",
  input: z.object({ content: z.string() }),
  prompt: "",
  output: z.object({ wordCount: z.number() }),
  process: async (item) => ({ wordCount: item.content.split(" ").length }),
});
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | Unique processor name |
| `input` | `ZodSchema` | yes | Input schema |
| `prompt` | `string` | yes | LLM prompt (with `{{var}}` interpolation). Empty string if `process` is provided. |
| `output` | `ZodSchema` | yes | Output schema (validates LLM response) |
| `temperature` | `number` | no | LLM temperature (default: 0.7) |
| `process` | `(item) => Promise<T>` | no | Custom processing function (skips LLM) |

---

### `defineOutput(def) → OutputDefinition`

Define an output target.

```typescript
import { defineOutput } from "nexus";

const mdOutput = defineOutput({
  format: "markdown",
  template: `---
title: {{title}}
---
{{summary}}`,
  target: { type: "dir", path: "./output" },
  filename: "{{uid}}.md",
});
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `format` | `"markdown" \| "json"` | yes | Output format |
| `template` | `string \| null` | yes | Template (with `{{var}}`). Null for raw JSON. |
| `target` | `{ type: "dir", path } \| { type: "webhook", url }` | yes | Output destination |
| `filename` | `string` | no | Filename template (dir output only) |

---

### `definePipeline(def) → PipelineDefinition`

Wire source → processors → output.

```typescript
import { definePipeline } from "nexus";

const pipeline = definePipeline({
  name: "my-pipeline",
  source: mySource,
  steps: [step1, step2],
  output: myOutput,
  schedule: "0 9 * * *",
  concurrency: 5,
  retry: { maxAttempts: 3, baseDelay: 1000 },
});
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | Unique pipeline name |
| `source` | `SourceDefinition` | yes | Data source |
| `steps` | `ProcessorDefinition[]` | yes | Processing steps (run in order) |
| `output` | `OutputDefinition` | no | Output target |
| `schedule` | `string` | no | Cron expression for scheduling |
| `concurrency` | `number` | no | Max parallel LLM calls (default: 3) |
| `retry` | `{ maxAttempts, baseDelay }` | no | Retry config |

---

## LLM (`nexus/llm`)

### `createLLMClient(config) → LLMClient`

```typescript
import { createLLMClient } from "nexus/llm";

const llm = createLLMClient({
  endpoint: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  apiKey: process.env.DEEPSEEK_API_KEY,
});
```

### `callStructured<T>(llm, opts) → Promise<T>`

Call LLM with structured output (Zod-validated).

```typescript
import { callStructured } from "nexus/llm";
import { z } from "zod";

const result = await callStructured(llm, {
  prompt: "Analyze this text...",
  schema: z.object({ summary: z.string(), sentiment: z.string() }),
  temperature: 0.3,
});
```

### `callLLM(llm, prompt, opts?) → Promise<string>`

Call LLM for free-form text generation.

### `renderTemplate(template, vars) → string`

Render a `{{variable}}` template.

```typescript
import { renderTemplate } from "nexus/llm";

const prompt = renderTemplate("Analyze {{title}} by {{author}}", {
  title: "My Paper",
  author: "Alice",
});
```

### `extractVariables(template) → string[]`

Extract `{{variable}}` names from a template.

### `validateVariables(template, vars) → void`

Throw if required variables are missing.

---

## Knowledge Graph (`nexus/knowledge`)

### `withKnowledge(config) → extend function`

Plugin for `createNexus`. Adds entity extraction, vector search, and graph traversal to context.

```typescript
import { withKnowledge } from "nexus/knowledge";

const nexus = createNexus({
  llm: { endpoint: "..." },
  extend: withKnowledge({
    vectorsPath: "./data/vectors.lance",
    entityTypes: ["skill", "company", "role"],
  }),
});
```

#### Context fields added:

| Field | Type | Description |
|-------|------|-------------|
| `ctx.entities` | `EntityStore` | CRUD for entities, relations, facts |
| `ctx.vectors` | `LanceVectorStore` | Semantic vector search |
| `ctx.search` | `UnifiedSearch` | BM25 + vector + graph RRF search |
| `ctx.graph` | `KnowledgeGraph` | Entity extraction + traversal |
| `ctx.resolver` | `EntityResolver` | Canonical name dedup |
| `ctx.indexer` | `ContentIndexer` | Differential content indexing |

### `EntityStore`

```typescript
store.upsertEntity({ type: "skill", name: "TypeScript", properties: { level: 8 }, sources: ["vault"] });
store.getEntity(id);
store.findByType("skill");
store.findByName("TypeScript", "skill");
store.findRelated(entityId);
store.addRelation({ sourceId, targetId, type: "requires", weight: 1.0, properties: {} });
store.addFact({ entityId, predicate: "proficiency", value: 8, validFrom: "2024-01-01", source: "vault", confidence: 0.9 });
store.getFacts(entityId, true); // only currently valid
```

### `UnifiedSearch`

```typescript
const results = search.search("machine learning", { limit: 10 });
// Returns: { item: { id, type, content }, score: number, source: "bm25" | "vector" | "graph" }[]
```

### `AgentMemory`

```typescript
const memory = new AgentMemory(db);
memory.remember("User prefers dark mode", "settings", 0.8, ["preferences"]);
memory.recall("theme settings");
memory.improve(id, { importance: 1.0 });
memory.forget(id);
memory.decay(0.95); // reduce importance of old memories
```

---

## CLI

All commands accept `--config <path>` to specify a custom config file.

| Command | Description |
|---------|-------------|
| `nexus status` | Show connected sources and counts |
| `nexus search <query>` | Unified search across all sources |
| `nexus ask <question>` | Ask a question, get synthesized answers |
| `nexus ingest [-s source]` | Run ingestion from connected sources |
| `nexus enrich [-l limit]` | Process entity extraction jobs |
| `nexus digest [-p daily\|weekly]` | Show summary |
| `nexus gaps` | Show skill gaps vs job market |
| `nexus resolve [--seed] [--lookup name]` | Manage canonical entity registry |
| `nexus audit` | Knowledge graph health check |
| `nexus graph` | Knowledge graph statistics |
| `nexus memory [-r text] [-q query] [-l]` | Manage agent memories |
| `nexus watch [-i minutes]` | Live feed monitoring |
| `nexus export [-f format] [-o dir] [-t type]` | Export to anki/markdown/json/csv |
| `nexus sync [-t dir]` | Sync to Obsidian vault |
| `nexus serve` | Start HTTP/MCP server |
