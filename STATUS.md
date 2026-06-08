# Nexus PKMS — Status

**Version:** 0.1.0
**Last Updated:** 2026-06-08

## What's Working

### Sources (4 bridges)
- [x] VaultBridge — Obsidian `.md` files with frontmatter + wikilink extraction
- [x] RssBridge — RSS/Atom feeds + RSSHub integration
- [x] GithubStarsBridge — GitHub starred repos via API (`GITHUB_TOKEN`)
- [x] RaindropBridge — Raindrop.io bookmarks + highlights (`RAINDROP_TOKEN`)

### Ingestion Pipeline
- [x] Differential content indexing (MD5 hash comparison)
- [x] Real MiniLM-L6-v2 embeddings (384-dim) via transformers.js
- [x] LanceDB vector store with cosine similarity search
- [x] Two-phase enrichment (ingest queues → enrich processes)

### Enrichment
- [x] Entity extraction: rules-based (~70% coverage) + LLM (DeepSeek) for long-tail
- [x] Fact extraction: proficiency levels, experience years, usage frequency
- [x] Co-occurrence relations between entities in same content
- [x] Canonical entity resolution (deduplication with aliases)

### Search
- [x] BM25 keyword search on content_index
- [x] Vector semantic search via MiniLM embeddings
- [x] Graph search via entity co-occurrence relations
- [x] Reciprocal Rank Fusion (RRF) combining all three signals
- [x] Wikilink boost — notes linked from top results get relevance bump

### Agents
- [x] Gap Detector — skill gaps vs demand signals
- [x] Knowledge Auditor — orphans, duplicates, missing details
- [x] Path Planner — learning paths from gaps

### CLI (16 commands)
- [x] `nexus status` — source counts, vector count, enrichment stats
- [x] `nexus search <query>` — BM25 + vector + graph RRF
- [x] `nexus ask <question>` — Q&A with context from knowledge base
- [x] `nexus ingest [--source=...]` — ingestion from all sources
- [x] `nexus enrich [--limit=N]` — entity + fact extraction pipeline
- [x] `nexus digest [--period=daily|weekly]` — terminal summary
- [x] `nexus gaps` — skill gap analysis
- [x] `nexus resolve --seed/--lookup` — canonical entity registry
- [x] `nexus audit` — knowledge graph health check
- [x] `nexus graph` — entity-relation statistics
- [x] `nexus memory -r/-q/-l` — agent memory
- [x] `nexus watch [-i N]` — live feed monitoring
- [x] `nexus export [-f anki|json|csv|markdown]` — export formats
- [x] `nexus sync [-t dir]` — sync to Obsidian vault
- [x] `nexus serve` — REST API on configured port
- [x] `nexus --config <path>` — global config flag

### Consumer APIs
- [x] REST API (Hono) — search, gaps, feedback, status
- [x] MCP server — 6 tools for Claude Code integration
- [x] Export — Anki TSV, JSON, CSV, Markdown
- [x] Sync — Obsidian-compatible notes with YAML frontmatter

### Infrastructure
- [x] All local-first: SQLite + LanceDB, no external DB
- [x] Config via `nexus.yaml` with Zod validation
- [x] Tilde expansion (`~`) centralized in config module
- [x] `--config` flag + `NEXUS_CONFIG` env var
- [x] GitHub Actions CI (typecheck + tests)
- [x] 41 tests passing (unit + e2e pipeline)

## Architecture

```
  Sources:  Vault  |  RSS  |  GitHub Stars  |  Raindrop
                  ↓
  Bridge Adapters → FeedItem[]
                  ↓
  ┌───────────────┴───────────────┐
  │  ContentIndexer (SQLite)      │  MD5 differential
  │  LanceVectorStore (LanceDB)   │  384-dim MiniLM
  │  Enrichment Queue (SQLite)    │  two-phase
  └───────────────┬───────────────┘
                  ↓
  ┌───────────────┴───────────────┐
  │  Entity Extraction (rules+LLM)│
  │  Fact Extraction (patterns)   │
  │  Co-occurrence Relations      │
  │  Entity Resolution (aliases)  │
  └───────────────┬───────────────┘
                  ↓
  ┌───────────────┴───────────────┐
  │  Search (BM25+Vector+Graph)   │  RRF fusion + wikilink boost
  │  Gap Detector                 │
  │  Auditor                      │
  │  Path Planner                 │
  └───────────────┬───────────────┘
                  ↓
  Output:  CLI  |  REST API  |  MCP  |  Export  |  Sync
```

## Data Stores

| Store | Engine | Tables |
|-------|--------|--------|
| Content Index | SQLite | `content_index`, `enrichment_jobs` |
| Entity Store | SQLite | `entities`, `relations`, `facts` |
| Entity Resolver | SQLite | `canonical_entities` |
| Agent Memory | SQLite | `memories` |
| Vector Store | LanceDB | `feed_item_vectors` (384-dim) |

## Future Enhancements

- [ ] GitHub Stars bridge: OAuth flow (currently token-only)
- [ ] LLM-based fact extraction (DeepSeek for complex predicates)
- [ ] Web dashboard (if needed — CLI + MCP + API may be sufficient)
- [ ] Scheduled cron jobs (daemon mode)
- [ ] Leiden community detection (at 5000+ entities)
