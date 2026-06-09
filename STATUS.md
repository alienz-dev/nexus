# Nexus — Status

**Version:** 0.2.0
**Last Updated:** 2026-06-08

## What's Working

### SDK (v0.2.0 — Generalized Knowledge Engine)

- [x] `createNexus(config)` — main entry point with fluent API
- [x] `createContext(config)` — generic context factory (SQLite + LLM + logger)
- [x] `defineSource(schema, fetch)` — typed data source with incremental cursor
- [x] `defineProcessor(input, prompt, output)` — LLM or custom processing
- [x] `defineOutput(format, template, target)` — markdown/json/webhook output
- [x] `definePipeline(source, steps, output)` — pipeline orchestration
- [x] Pipeline runner — incremental fetch, concurrent processing, checkpoint/resume
- [x] Checkpoint store — SQLite-backed per-item completion tracking with debounced saves
- [x] Scheduler — per-pipeline cron scheduling via node-cron
- [x] LLM client — OpenAI-compatible with retry/backoff
- [x] Template rendering — `{{variable}}` interpolation (zero deps)
- [x] Structured output — Zod-validated LLM responses with jsonrepair + Instructor-pattern retry
- [x] Context extensions — `extend` option for custom context fields
- [x] Knowledge plugin — opt-in via `nexus/knowledge` (withKnowledge)
- [x] 55 tests passing (41 existing + 14 new SDK tests)

### Knowledge Engine (Optional Plugin)

- [x] Entity extraction — rules-based (~70%) + LLM (DeepSeek) for long-tail
- [x] Fact extraction — proficiency, experience years, usage frequency
- [x] Co-occurrence relations — entities in same content get linked
- [x] Entity resolution — canonical name registry with aliases
- [x] Vector store — MiniLM-L6-v2 embeddings (384-dim) via LanceDB
- [x] Unified search — BM25 + vector + graph RRF fusion + wikilink boost

### Sources (4 bridges)

- [x] VaultBridge — Obsidian `.md` files with frontmatter + wikilink extraction
- [x] RssBridge — RSS/Atom feeds + RSSHub integration
- [x] GithubStarsBridge — GitHub starred repos via API
- [x] RaindropBridge — Raindrop.io bookmarks + highlights

### CLI (16 commands)

- [x] `nexus status` — source counts, vector count, enrichment stats
- [x] `nexus search <query>` — BM25 + vector + graph RRF
- [x] `nexus ask <question>` — Q&A with context
- [x] `nexus ingest [--source=...]` — ingestion from all sources
- [x] `nexus enrich [--limit=N]` — entity + fact extraction
- [x] `nexus digest [--period=daily|weekly]` — terminal summary
- [x] `nexus gaps` — skill gap analysis
- [x] `nexus resolve --seed/--lookup` — canonical entity registry
- [x] `nexus audit` — knowledge graph health check
- [x] `nexus graph` — entity-relation statistics
- [x] `nexus memory -r/-q/-l` — agent memory
- [x] `nexus watch [-i N]` — live feed monitoring
- [x] `nexus export [-f anki|json|csv|markdown]` — export formats
- [x] `nexus sync [-t dir]` — sync to Obsidian vault
- [x] `nexus serve` — REST API server
- [x] `nexus --config <path>` — global config flag

### Consumer APIs

- [x] REST API (Hono) — search, gaps, feedback, status
- [x] MCP server — 6 tools for Claude Code integration
- [x] Export — Anki TSV, JSON, CSV, Markdown
- [x] Sync — Obsidian-compatible notes with YAML frontmatter

### Infrastructure

- [x] Local-first: SQLite + LanceDB, no external DB required
- [x] Generic SDK — zero nexus-specific deps in core
- [x] Knowledge plugin — opt-in for entity extraction + vector search
- [x] Config via `nexus.yaml` with Zod validation
- [x] GitHub Actions CI (typecheck + tests)

## Architecture

```
  ┌─────────────────────────────────────────────────────────┐
  │  Consumer Project                                       │
  │  import { createNexus, defineSource, ... } from "nexus" │
  └────────────────────────┬────────────────────────────────┘
                           │
  ┌────────────────────────▼────────────────────────────────┐
  │  SDK Core (src/sdk/)                                    │
  │  createNexus → NexusInstance                            │
  │  createContext → NexusContext { db, llm, logger, ... }  │
  └────────────────────────┬────────────────────────────────┘
                           │
  ┌────────────────────────▼────────────────────────────────┐
  │  Pipeline Engine (src/pipeline/)                        │
  │  defineSource → defineProcessor → defineOutput          │
  │  PipelineRunner (incremental, checkpointed, concurrent) │
  │  PipelineScheduler (per-pipeline cron)                  │
  └────────────────────────┬────────────────────────────────┘
                           │
  ┌────────────────────────▼────────────────────────────────┐
  │  LLM Module (src/llm/)                                  │
  │  LLMClient (OpenAI-compatible)                          │
  │  renderTemplate ({{variable}})                          │
  │  callStructured (Zod validation + jsonrepair + retry)   │
  └─────────────────────────────────────────────────────────┘

  Optional:
  ┌─────────────────────────────────────────────────────────┐
  │  Knowledge Plugin (src/knowledge/) — import from        │
  │  "nexus/knowledge"                                      │
  │  EntityStore, VectorStore, UnifiedSearch, KnowledgeGraph│
  └─────────────────────────────────────────────────────────┘
```

## Data Stores

| Store | Engine | Tables |
|-------|--------|--------|
| Pipeline checkpoints | SQLite | `pipeline_checkpoints` |
| Content index | SQLite | `content_index`, `enrichment_jobs` |
| Entity store | SQLite | `entities`, `relations`, `facts` |
| Entity resolver | SQLite | `canonical_entities` |
| Agent memory | SQLite | `memories` |
| Vector store | LanceDB | `feed_item_vectors` (384-dim) |

## Dependencies

| Tier | Packages | Purpose |
|------|----------|---------|
| Core | `zod`, `better-sqlite3`, `zod-to-json-schema`, `jsonrepair`, `node-cron`, `p-queue`, `bottleneck` | Pipeline engine + LLM |
| Optional | `@lancedb/lancedb`, `@huggingface/transformers` | Knowledge plugin (vectors) |
| Optional | `@mastra/core` | Agent orchestration |
| Optional | `hono`, `@modelcontextprotocol/sdk` | REST API + MCP server |

## Future Enhancements

- [ ] SQLite output target for pipelines
- [ ] Webhook triggers (POST /api/ingest/:pipeline)
- [ ] YAML pipeline definitions (code-first works, YAML for non-devs)
- [ ] Streaming partial LLM output
- [ ] Leiden community detection (at 5000+ entities)
