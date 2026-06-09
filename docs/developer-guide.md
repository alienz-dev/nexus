# Developer Guide

## Setup

```bash
git clone <repo-url> nexus
cd nexus
npm install
npm test
npm run typecheck
```

Requirements: Node.js 22+, npm.

## Project Structure

```
src/
  sdk/          Public API surface (createNexus, createContext, types)
  llm/          LLM client, structured output, templates
  pipeline/     Source, Processor, Output, Runner, Scheduler, Checkpoint
  knowledge/    Entity store, graph, memory, vectors, search, indexer, resolver
  agents/       Gap detector, consolidator, path planner, auditor
  ingest/       Bridge adapters (vault, RSS, raindrop, github, email)
  serve/        HTTP server (Hono), MCP server, Telegram bot
  cli/          Commander CLI commands
  schemas/      Entity type definitions (skill, company, role, etc.)
  lib/          Shared utilities (db, config, logger, hash, chalk, ora)
tests/          Vitest test files
.nexus/         SDD artifacts (issues, specs, constitution)
docs/           This documentation
```

## Development Workflow

### Running in Development

```bash
# Run CLI in dev mode (tsx with hot reload)
npm run dev -- status
npm run dev -- search "test query"

# Run tests
npm test
npm run test:watch

# Type check
npm run typecheck

# Build
npm run build
```

### SDD (Specification-Driven Development)

This project uses SDD with an FSM lifecycle for issues:

```
open → specced → tests_written → red_verified → implementing → green → reviewing → closed
```

1. **Open** — Issue created with description and acceptance criteria
2. **Specced** — Technical spec written in `.nexus/specs/`
3. **Tests Written** — Test file created (tests are stubs)
4. **Red Verified** — Tests run and FAIL (red phase of TDD)
5. **Implementing** — Code written to make tests pass
6. **Green** — All tests PASS
7. **Reviewing** — Code review
8. **Closed** — Issue complete, merged

Issues live in `.nexus/issues/`, specs in `.nexus/specs/`, and the FSM gates are defined in `.nexus/constitution.yml`.

## Extending Nexus

### Adding a New Bridge Adapter

Bridge adapters normalize external data into `FeedItem` objects.

1. Create `src/ingest/my-bridge.ts`:

```typescript
import type { FeedItem } from "./types.js";

export class MyBridge {
  readonly name = "my-source";

  async isAvailable(): Promise<boolean> {
    // Check if the source is accessible
    return true;
  }

  async fetch(since?: string): Promise<FeedItem[]> {
    // Fetch data from external source
    // Return normalized FeedItem array
    return items.map(item => ({
      id: item.id,
      source: this.name,
      title: item.title,
      content: item.body,
      url: item.link,
      timestamp: item.date,
      tags: item.categories,
      entities: [],
    }));
  }

  async count(): Promise<number> {
    // Return total item count
    return 0;
  }
}
```

2. Register in `src/ingest/index.ts`
3. Add config entry in `nexus.yaml`
4. Write tests in `tests/ingest/my-bridge.test.ts`

### Adding a New CLI Command

1. Create `src/cli/commands/my-command.ts`:

```typescript
import chalk from "../../lib/chalk.js";
import { loadConfig } from "../../lib/config.js";

export async function myCommand(opts: { option: string }): Promise<void> {
  const config = loadConfig();
  console.log(chalk.bold("My Command"));
  // Implementation
}
```

2. Register in `src/cli/index.ts`:

```typescript
import { myCommand } from "./commands/my-command.js";

program
  .command("my-command")
  .description("Description of my command")
  .option("-o, --option <value>", "An option")
  .action((opts) => myCommand({ option: opts.option }));
```

### Adding a New Agent

Agents are classes that operate on the knowledge graph.

1. Create `src/agents/my-agent.ts`:

```typescript
import type { EntityStore } from "../knowledge/store.js";
import type { AgentResult } from "./types.js";

export class MyAgent {
  private store: EntityStore;

  constructor(store: EntityStore) {
    this.store = store;
  }

  async run(): Promise<AgentResult> {
    const start = Date.now();
    // Agent logic here
    return {
      agentName: "my-agent",
      success: true,
      steps: [],
      output: result,
      durationMs: Date.now() - start,
    };
  }
}
```

2. Export from `src/agents/index.ts`
3. Add CLI command in `src/cli/commands/`
4. Write tests

### Adding a New Entity Schema

Entity schemas define the shape of knowledge graph nodes.

1. Create `src/schemas/my-type.ts`:

```typescript
import { z } from "zod";

export const MyTypeSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  level: z.number().min(0).max(10).optional(),
  tags: z.array(z.string()).default([]),
});

export type MyType = z.infer<typeof MyTypeSchema>;
```

2. Register in `src/schemas/index.ts`

### Extending the Context

Add custom fields to the pipeline context:

```typescript
const nexus = createNexus({
  llm: { endpoint: "..." },
  extend: async (base) => ({
    ...base,
    myDb: await createMyDatabase(),
    mySearch: createMySearchEngine(),
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

## Testing

### Test Structure

```
tests/
  lib/           Utility tests (hash, config)
  ingest/        Bridge adapter tests
  knowledge/     Search, vector store tests
  sdk/           Pipeline integration tests
  e2e/           End-to-end pipeline tests
```

### Writing Tests

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "../src/my-module.js";

describe("myFunction", () => {
  it("should do something", () => {
    const result = myFunction("input");
    expect(result).toBe("expected");
  });

  it("should handle errors", () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

### Running Tests

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npx vitest run tests/lib/hash.test.ts  # Run specific file
```

## Configuration Reference

### `nexus.yaml`

```yaml
version: "1"

database:
  main: ./data/nexus.sqlite
  vectors: ./data/vectors.lance

sources:
  vault:
    path: ~/vault
    enabled: true
  job-hunter:
    path: ~/projects/job-hunter
    db: ./data/job-hunter.sqlite
    enabled: true

rss:
  feeds:
    - https://example.com/feed.xml

rsshub:
  enabled: false
  url: http://localhost:1200
  routes:
    /github/trending/daily/typescript

llm:
  endpoint: https://api.deepseek.com/v1
  model: deepseek-chat
  apiKey: sk-...
  maxRetries: 2

search:
  rrf_k: 60
  weights:
    bm25: 0.4
    vector: 0.4
    graph: 0.2

server:
  port: 3777
  host: localhost

telegram:
  enabled: false
  bot_token: ""
  chat_id: ""
```

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `LLM_ENDPOINT` | LLM API endpoint | — |
| `LLM_MODEL` | Model name | — |
| `LLM_API_KEY` | API key | — |
| `GITHUB_TOKEN` | GitHub Stars bridge | — |
| `RAINDROP_TOKEN` | Raindrop.io bridge | — |
| `NEXUS_CONFIG` | Config file path | `./nexus.yaml` |

## Key Patterns

### Differential Updates

The content indexer uses MD5 hashing to skip unchanged content:

```typescript
import { ContentIndexer } from "./knowledge/indexer.js";

const indexer = new ContentIndexer(db);
const changed = indexer.getChanged("vault", items, item => item.id);
// Only `changed` items need processing
indexer.markIndexed("vault", items);
```

### Unified Search with RRF

BM25 + vector + graph results are merged using Reciprocal Rank Fusion:

```typescript
const results = search.search("machine learning", { limit: 10 });
// Each result has: item, score (RRF), source ("bm25" | "vector" | "graph")
```

### Structured LLM Output

Processors automatically validate LLM output:

1. Zod schema → JSON schema (via `zod-to-json-schema`)
2. Sent as `response_format` to LLM
3. Response parsed and validated
4. On failure: `jsonrepair` tries to fix malformed JSON
5. On failure: error fed back to LLM for self-correction (max 2 retries)

### Checkpoint/Resume

The pipeline runner tracks per-item completion state. On crash, it resumes from the last completed item:

```typescript
const runner = new PipelineRunner(pipeline, context);
await runner.run(); // Resumes from checkpoint if interrupted
```
