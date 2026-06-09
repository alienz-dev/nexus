# Architecture

## Overview

Nexus is a generalized knowledge engine SDK built in TypeScript. It ingests data from multiple sources, processes it through LLM-powered pipelines, and serves results via CLI, REST API, or MCP.

## Design Principles

1. **Library, not platform** — `import { createNexus } from "nexus"` is the entry point. No daemon required.
2. **Zero-hardcoded LLM config** — any OpenAI-compatible endpoint works. Provider is a runtime config, not a compile-time choice.
3. **Incremental by default** — cursor-based sources, checkpoint/resume, differential content indexing (MD5).
4. **Optional everything** — knowledge graph, vector search, CLI, HTTP server, and MCP are all opt-in plugins.

## System Architecture

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

┌─────────────────────────────────────────────────────────┐
│  nexus (npm package)                                    │
│                                                         │
│  src/sdk/        Public API (createNexus, createContext)│
│  src/llm/        LLM client, templates, structured out  │
│  src/pipeline/   Source, Processor, Output, Runner      │
│  src/knowledge/  (optional) Entity extraction, vectors  │
│  src/agents/     (optional) Gap detection, auditing     │
│  src/ingest/     Bridge adapters for external sources   │
│  src/serve/      (optional) REST API, MCP server        │
│  src/cli/        (optional) CLI commands                │
│  src/schemas/    Tana-style supertag definitions        │
│  src/lib/        Shared utilities (db, config, logger)  │
└─────────────────────────────────────────────────────────┘

Dependencies:
  Core:     zod, better-sqlite3, zod-to-json-schema, jsonrepair,
            node-cron, p-queue, bottleneck
  Optional: @lancedb/lancedb, @huggingface/transformers, hono,
            @modelcontextprotocol/sdk, commander, chalk, ora
```

## Data Flow

```
External Sources          Bridge Adapters         Pipeline Engine
┌──────────┐             ┌──────────────┐        ┌──────────────┐
│ Vault    │───vault────▶│              │        │              │
│ RSS      │───rss──────▶│  FeedItem[]  │───▶    │  Source.fetch│
│ Raindrop │───raindrop─▶│  (normalized)│        │      ↓       │
│ GitHub   │───github───▶│              │        │  Processor[] │
│ Email    │───email────▶│              │        │      ↓       │
└──────────┘             └──────────────┘        │  Output      │
                                                 └──────┬───────┘
                                                        │
                    ┌───────────────────────────────────┘
                    ▼
            ┌──────────────┐     ┌──────────────┐
            │ SQLite       │     │ LanceDB      │
            │ (entities,   │     │ (vectors,    │
            │  facts,      │     │  embeddings) │
            │  content_idx)│     └──────────────┘
            └──────┬───────┘
                   │
            ┌──────┴───────┐
            │ Unified      │
            │ Search       │
            │ (BM25+Vector │
            │  +Graph RRF) │
            └──────────────┘
```

## Module Breakdown

### SDK (`src/sdk/`)

Public-facing API. `createNexus()` returns a `NexusInstance` that accepts source, processor, output, and pipeline registrations. Manages lifecycle (run, start, stop) and event emission.

### Pipeline (`src/pipeline/`)

Core execution engine:
- **Source** — fetches items from external systems with cursor-based incremental support
- **Processor** — transforms items via LLM (structured output with Zod validation) or custom logic
- **Output** — writes results to files (markdown, JSON) or webhooks
- **Runner** — orchestrates source → processors → output with concurrency control, retry, and checkpointing
- **Scheduler** — per-pipeline cron scheduling via `node-cron`

### LLM (`src/llm/`)

Provider-agnostic LLM client:
- OpenAI-compatible HTTP client with retry and rate limiting
- Structured output via `response_format` + Zod validation + `jsonrepair` fallback
- Template engine with `{{variable}}` interpolation and validation

### Knowledge (`src/knowledge/`)

Optional knowledge graph plugin:
- **EntityStore** — SQLite-backed CRUD for entities, relations, and temporally-valid facts
- **KnowledgeGraph** — entity extraction from content, 1-hop traversal
- **LanceVectorStore** — vector embeddings via LanceDB for semantic search
- **UnifiedSearch** — BM25 + vector + graph search with Reciprocal Rank Fusion
- **ContentIndexer** — MD5-based differential content indexing
- **EntityResolver** — canonical name deduplication with alias support
- **AgentMemory** — Cognee-style remember/recall/forget/improve for long-running agents

### Agents (`src/agents/`)

Agent orchestration layer:
- **GapDetector** — compares knowledge graph skills vs job market demand
- **Consolidator** — merges duplicate entities and deduplicates facts
- **PathPlanner** — generates learning paths between current skills and target goals
- **KnowledgeAuditor** — finds orphans, duplicates, and stale facts in the graph

### Ingest (`src/ingest/`)

Bridge adapters normalize external data into `FeedItem` objects:
- **VaultBridge** — reads Obsidian vault markdown files
- **RSSBridge** — fetches RSS/Atom feeds
- **RaindropBridge** — imports Raindrop.io bookmarks
- **GitHubStarsBridge** — imports starred repositories
- **EmailHubBridge** — imports email metadata

### Serve (`src/serve/`)

Optional HTTP server (Hono):
- REST endpoints for search, status, gaps, digest, feedback
- MCP (Model Context Protocol) server for Claude Code integration
- Telegram bot for conversational access

### CLI (`src/cli/`)

Commander-based CLI wrapping the SDK:
- `nexus status` — show connected sources and counts
- `nexus search <query>` — unified search
- `nexus ingest` — run ingestion from all sources
- `nexus enrich` — process entity extraction jobs
- `nexus gaps` — show skill gaps
- `nexus audit` — knowledge graph health check
- `nexus memory` — manage agent memories
- `nexus serve` — start HTTP/MCP server

## Storage

### SQLite (better-sqlite3)

Primary structured store. WAL mode for concurrent reads. Tables:
- `entities` — knowledge graph nodes (id, type, name, properties, sources)
- `relations` — knowledge graph edges (source_id, target_id, type, weight)
- `facts` — temporally-valid assertions (entity_id, predicate, value, valid_from, valid_to)
- `content_index` — differential content tracking (source, content_id, hash)
- `memories` — agent memory store (content, context, importance, tags)
- `pipeline_state` — checkpoint/resume state

### LanceDB

Vector store for semantic search. Stores embeddings generated by `@huggingface/transformers`.

## Configuration

`nexus.yaml` (or `--config` flag, or `NEXUS_CONFIG` env var) provides:
- Database paths (main SQLite, vectors LanceDB)
- Source definitions (path, db, enabled)
- RSS feed URLs
- LLM endpoint/model/apiKey (with env var fallbacks)
- Search weights (BM25, vector, graph RRF)
- Server port/host
- Telegram bot config

All fields validated with Zod. Defaults applied for missing fields.

## Testing

- **Framework:** Vitest with threads pool
- **Unit tests:** hash utility, config loading, bridge adapters
- **Integration tests:** search (with seeded data), vector store, knowledge graph
- **E2E tests:** full pipeline run with mock LLM
