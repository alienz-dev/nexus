# Nexus PKMS — Implementation Plan

**Version:** 0.1.0
**Date:** 2026-06-07
**Status:** Approved

---

## Vision

A personal knowledge management hub that ingests from 80+ sources, builds a knowledge graph, uses AI agents to detect gaps and generate learning paths, and serves data to 15+ consumer apps. The hub connects existing projects (ai-feeds, job-hunter, email-hub, generic-tutor, vault) and adds orchestration, knowledge graph, and self-upgrade layers.

---

## Clarifications

(from grill session 2026-06-07)

- Q: Ingestion trigger model? → A: Hybrid (poll with backoff + manual override). Daemon polls source DBs on schedule, `nexus ingest` works on-demand.
- Q: Source change detection? → A: Row count / max ID tracking per bridge. Cheap (O(1)), reliable, bridge knows source schema.
- Q: Normalization depth? → A: Two-phase. Phase 1: minimal sync (map columns to FeedItems). Phase 2: async enrichment (LLM entity extraction, summarization, scoring).
- Q: Entity extraction strategy? → A: Hybrid. Rules first (O*NET taxonomy, known companies), LLM for unknowns (DeepSeek V4 Flash). Rules handle 70% for free.
- Q: Entity resolution? → A: Canonical ID registry with fuzzy match + LLM fallback. Seed from O*NET + job-hunter data.
- Q: LLM provider for enrichment? → A: DeepSeek V4 Flash (proven in email-hub, $0.14/1M tokens). Reserve Claude for consumer chat.
- Q: MCP tool surface? → A: 7 tools — search, ingest, gaps, digest, entities, add_note, status.
- Q: Vault sync direction? → A: Write to `vault/nexus/` only. Never touch existing notes.
- Q: Consumer app priority? → A: Tier 1 — MCP server, Telegram bot, Knowledge graph viz. Tier 2 — Spaced repetition, Meeting prep, Resume generator.
- Q: Data retention? → A: 90-day TTL + archive to gzipped JSON. Knowledge graph entities persist forever.
- Q: Error handling? → A: 3 retries with exponential backoff (1s/2s/4s), then skip + log to `ingestion_errors` table.

---

## Phase 1: Foundation (Weeks 1-2)

**Goal:** Working CLI that can ingest from all 5 existing sources, store in SQLite, and search.

### Tasks

#### 1.1 Database Setup (`src/lib/db.ts`)
- Create SQLite schema with tables:
  - `feed_items` — raw ingested content
  - `entities` — extracted entities with types
  - `relations` — typed edges between entities
  - `facts` — temporally-valid assertions
  - `canonical_entities` — dedup registry with aliases
  - `source_watermarks` — last-seen row count / max ID per source
  - `enrichment_jobs` — pending/done/failed enrichment queue
  - `ingestion_errors` — dead letter queue
  - `agent_state` — agent persistence
- Migration system (versioned SQL files in `src/lib/migrations/`)
- WAL mode for concurrent reads

#### 1.2 Config Loading (`src/lib/config.ts`)
- Load `nexus.yaml` with Zod validation
- Hot-reload via chokidar file watch
- Environment variable overrides

#### 1.3 Bridge Adapters — Minimal Ingest (`src/ingest/`)
- Implement `getWatermark()` for each bridge
- Implement `fetchDelta(since)` for each bridge
- ai-feeds-bridge: read `papers` table from `~/projects/ai-feeds/db/ai-feeds.sqlite`
- job-hunter-bridge: read `jobs` table from `~/projects/job-hunter/data/job-hunter.sqlite`
- email-hub-bridge: read `emails` table from `~/projects/email-hub/data/state.sqlite`
- vault-bridge: read markdown files from `~/vault/` (episodes/, knowledge/, skills/)
- rss-bridge: fetch RSS/Atom feeds, parse with fast-xml-parser
- Registry: `src/ingest/registry.ts` with `listSources()`, `getSource(name)`, `ingestAll()`

#### 1.4 CLI Commands (`src/cli/`)
- `nexus status` — show connected sources, row counts, last sync time, errors
- `nexus ingest [--source=...]` — run ingestion for one or all sources
- `nexus search <query>` — unified search across all feed_items
- `nexus gaps` — placeholder (returns "not implemented — requires Phase 3")

#### 1.5 Search (`src/knowledge/search.ts`)
- BM25 search over feed_items (SQLite FTS5)
- Stub vector search (returns empty until Phase 2)
- Weighted RRF fusion (BM25 weight: 0.4, vector: 0.4, graph: 0.2)

#### 1.6 Tests
- Unit tests for each bridge adapter (mock source DBs)
- Integration test: ingest from ai-feeds → search → verify results
- Hash utility tests (already passing)

### Acceptance Criteria
- [ ] `nexus status` shows all 5 sources with row counts
- [ ] `nexus ingest --source=ai-feeds` ingests delta from ai-feeds DB
- [ ] `nexus ingest` ingests from all sources
- [ ] `nexus search "machine learning"` returns relevant results
- [ ] `nexus ingest --source=rss` fetches and ingests RSS feeds
- [ ] All tests pass, zero type errors

---

## Phase 2: Knowledge Graph + Vectors (Weeks 3-4)

**Goal:** Entity extraction, vector embeddings, knowledge graph construction.

### Tasks

#### 2.1 Entity Extraction Pipeline (`src/ingest/extractors/`)
- `rules.ts` — rule-based extractor using O*NET taxonomy + known companies
- `llm.ts` — LLM-based extractor using DeepSeek V4 Flash
- `orchestrator.ts` — runs rules first, LLM for low-confidence cases
- Extract: skills, companies, roles, technologies, concepts, people
- Output: typed Entity objects with confidence scores

#### 2.2 Entity Resolution (`src/knowledge/resolver.ts`)
- Canonical ID registry with alias lookup
- Fuzzy match (Levenshtein distance ≤ 2 for short names, ≤ 20% for long)
- LLM disambiguation for ambiguous cases
- Auto-extend registry on new entities

#### 2.3 LanceDB Vector Store (`src/knowledge/vectors.ts`)
- Initialize LanceDB in `data/vectors.lance`
- BGE-M3 embedding generation (via transformers.js or local inference)
- Index feed_items and entities
- Differential update: only re-embed changed content (MD5 hash comparison)
- Vector search with cosine similarity

#### 2.4 Knowledge Graph (`src/knowledge/graph.ts`)
- LightRAG integration for entity-relationship extraction
- Store entities and relations in SQLite
- Temporal facts with `valid_at` / `invalid_at` (Graphiti pattern)
- Leiden community detection for clustering

#### 2.5 Unified Search (update `src/knowledge/search.ts`)
- BM25 (FTS5) + Vector (LanceDB) + Graph (entity relations)
- Weighted RRF: BM25 0.4, vector 0.4, graph 0.2
- Cross-encoder reranking (BGE Reranker v2 M3)
- Top-K results with source attribution

#### 2.6 Enrichment Worker (`src/ingest/enrichment-worker.ts`)
- Poll `enrichment_jobs` table for pending items
- Process with entity extraction pipeline
- Update feed_items with extracted entities
- Mark jobs as done/failed

#### 2.7 Tests
- Entity extraction accuracy tests (known inputs → expected entities)
- Entity resolution tests (aliases → canonical ID)
- Vector search quality tests (known queries → expected results)
- Knowledge graph construction tests

### Acceptance Criteria
- [ ] `nexus ingest` extracts entities from new FeedItems
- [ ] "React" and "React.js" resolve to the same canonical entity
- [ ] `nexus search "frontend frameworks"` returns vector + BM25 results
- [ ] Knowledge graph has entities and relations from ingested content
- [ ] Enrichment worker processes pending jobs in background

---

## Phase 3: Agent Layer (Weeks 5-6)

**Goal:** Mastra-orchestrated agents for gap detection, consolidation, and learning paths.

### Tasks

#### 3.1 Mastra Setup (`src/agents/mastra.ts`)
- Initialize Mastra orchestrator
- Define tools: search, knowledge graph query, entity store, LLM
- Agent memory via SQLite agent_state table

#### 3.2 Gap Detector Agent (`src/agents/gap-detector.ts`)
- Input: user's current skills (from vault + knowledge graph) vs. job market demand (from job-hunter data)
- Process: compare skill sets, identify gaps, rank by market demand
- Output: structured gap analysis with priority scores
- Uses O*NET taxonomy for skill normalization

#### 3.3 Weekly Consolidator Agent (`src/agents/consolidator.ts`)
- Input: daily logs (vault), recent FeedItems, knowledge graph state
- Process: extract recurring patterns, identify trending topics, detect stale knowledge
- Output: consolidation report → `vault/nexus/digests/YYYY-MM-DD.md`
- Runs weekly via cron

#### 3.4 Learning Path Planner (`src/agents/path-planner.ts`)
- Input: skill gaps from gap-detector, available learning resources (from ai-feeds + vault)
- Process: generate curriculum with prerequisites, estimated time, resources
- Output: structured learning path → `vault/nexus/paths/`
- Integrates with generic-tutor for spaced repetition scheduling

#### 3.5 CLI Commands (update `src/cli/`)
- `nexus gaps` — run gap detector, display results
- `nexus consolidate` — run consolidator manually
- `nexus path <skill>` — generate learning path for a skill

#### 3.6 Tests
- Gap detector tests (mock skill sets → expected gaps)
- Consolidator tests (mock daily logs → expected patterns)
- Path planner tests (mock gaps → expected curriculum)

### Acceptance Criteria
- [ ] `nexus gaps` shows skill gaps ranked by market demand
- [ ] `nexus consolidate` generates a weekly digest in vault/nexus/
- [ ] `nexus path "system design"` generates a learning curriculum
- [ ] Agents persist state across runs via SQLite

---

## Phase 4: Consumer API + MCP (Weeks 7-8)

**Goal:** REST API, MCP server, Telegram bot integration.

### Tasks

#### 4.1 Hono REST API (`src/serve/`)
- `GET /api/search?q=...` — unified search
- `GET /api/gaps` — skill gap analysis
- `GET /api/digest?period=daily|weekly` — digest generation
- `GET /api/status` — system health
- `GET /api/entities/:id` — entity detail with relations
- CORS, error handling, request logging

#### 4.2 MCP Server (`src/serve/mcp/server.ts`)
- 7 tools: nexus_search, nexus_ingest, nexus_gaps, nexus_digest, nexus_entities, nexus_add_note, nexus_status
- Zod schemas for all tool inputs
- Register with Claude Code via `.claude/settings.local.json`

#### 4.3 Telegram Bot (`src/serve/telegram.ts`)
- grammy bot (same pattern as email-hub)
- Commands: /search, /gaps, /digest, /status
- Daily digest push at configurable time
- Chat mode: ask questions, get RAG answers

#### 4.4 Vault Writer (`src/knowledge/vault-writer.ts`)
- Write digests to `vault/nexus/digests/`
- Write gap analyses to `vault/nexus/gaps/`
- Write learning paths to `vault/nexus/paths/`
- Frontmatter with metadata (date, source, type)

#### 4.5 Tests
- API endpoint tests (supertest)
- MCP tool tests (mock tool calls)
- Telegram bot tests (mock grammy)

### Acceptance Criteria
- [ ] `nexus serve` starts Hono API on port 3777
- [ ] `GET /api/search?q=react` returns JSON results
- [ ] MCP tools registered and callable from Claude Code
- [ ] Telegram bot responds to /search and /gaps commands
- [ ] Vault/nexus/ contains generated digests and gap analyses

---

## Phase 5: Self-Upgrade (Weeks 9-10)

**Goal:** Differential indexing, knowledge audit, stale content decay.

### Tasks

#### 5.1 Differential Indexing (`src/knowledge/indexer.ts`)
- MD5 hash per content chunk (Khoj pattern)
- Only re-embed changed content
- Full reindex via `nexus reindex --full`
- Index statistics: total chunks, last indexed, hash distribution

#### 5.2 Knowledge Audit Agent (`src/agents/auditor.ts`)
- Detect orphan entities (no relations)
- Detect stale facts (past `invalid_at`)
- Detect broken links (references to deleted content)
- Detect knowledge gaps (entities mentioned but never detailed)
- Output: audit report → `vault/nexus/audits/`

#### 5.3 Stale Content Decay
- Flag FeedItems older than 90 days for archival
- Archive to `data/archive/` as gzipped JSON
- Knowledge graph entities persist (never decay)
- `nexus archive --before=YYYY-MM-DD` for manual archival

#### 5.4 RSSHub Integration (`src/ingest/rsshub-bridge.ts`)
- Configure RSSHub routes in nexus.yaml
- Fetch generated RSS feeds from RSSHub
- Normalize to FeedItems
- 1000+ source routes available

#### 5.5 Cron Jobs
- Ingestion: every 15 min (email-hub), daily (ai-feeds, job-hunter)
- Enrichment: continuous (worker loop)
- Consolidation: weekly (Monday 10:00)
- Audit: monthly (1st of month)
- Archive: weekly (Sunday 02:00)

#### 5.6 Tests
- Differential indexing tests (unchanged content not re-embedded)
- Audit agent tests (known issues detected)
- Archive tests (old items archived, entities preserved)

### Acceptance Criteria
- [ ] `nexus reindex` only re-embeds changed content
- [ ] `nexus audit` detects orphan entities and stale facts
- [ ] `nexus archive --before=2026-03-01` archives old FeedItems
- [ ] RSSHub integration fetches from configured routes
- [ ] Cron jobs run on schedule without manual intervention

---

## Future Phases (Post v0.1)

| Phase | Feature | Priority |
|---|---|---|
| 6 | Spaced repetition export (AnkiConnect + FSRS) | High |
| 7 | Knowledge graph visualization (Cytoscape.js) | High |
| 8 | Meeting prep briefs (calendar + PKM context) | Medium |
| 9 | Resume/cover letter generator (Reactive Resume) | Medium |
| 10 | Podcast generation from notes (Bark TTS) | Low |
| 11 | Voice assistant (Whisper STT + RAG) | Low |
| 12 | PWA mobile app | Low |

---

## Success Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Source coverage | 5 connected sources | `nexus status` shows 5 active |
| Ingestion latency | < 30s for delta | `time nexus ingest` |
| Search relevance | Top-5 contains answer | Manual evaluation on 20 queries |
| Entity extraction accuracy | > 80% precision | Labeled test set of 100 FeedItems |
| Gap detection usefulness | 3+ actionable gaps | User feedback on gap reports |
| MCP tool adoption | Used daily | Claude Code session logs |
