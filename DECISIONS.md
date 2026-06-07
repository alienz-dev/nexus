# Nexus PKMS — Architecture Decision Records

## ADR-001: Agent Orchestration — Mastra over LangGraph

**Status:** Accepted
**Date:** 2026-06-07

### Context

We need an agent orchestration framework for gap detection, consolidation, and path planning agents. The main contenders are Mastra and LangGraph.

### Decision

Use **Mastra** for agent orchestration.

### Rationale

- **TypeScript-native:** Mastra is built in TypeScript with full type safety, matching our stack. LangGraph is Python-first with a JS port that lags behind.
- **Local-first:** Mastra runs entirely locally without requiring a cloud service. LangGraph's JS SDK pushes toward LangSmith for observability.
- **Tool integration:** Mastra's tool system maps cleanly to our MCP-based architecture — each tool is a typed function with Zod schemas.
- **Workflow primitives:** Mastra provides workflow steps, branching, and error handling without the graph complexity of LangGraph's state machines.
- **Community momentum:** Mastra has stronger TypeScript ecosystem adoption (2026 Q2).

### Consequences

- We accept Mastra's smaller ecosystem compared to LangGraph/LangChain.
- If we need complex graph-based workflows, we'll implement them as Mastra workflow steps.
- We can revisit if Mastra's agent capabilities don't meet our needs for the consolidator agent.

---

## ADR-002: Vector Store — LanceDB over ChromaDB

**Status:** Accepted
**Date:** 2026-06-07

### Context

We need a vector database for semantic search over ingested content. The main contenders are LanceDB and ChromaDB.

### Decision

Use **LanceDB** for vector storage and search.

### Rationale

- **Embedded, zero-server:** LanceDB runs in-process as a library — no separate server process. ChromaDB requires a running server (even in "embedded" mode it spawns one).
- **Columnar format:** LanceDB uses Apache Lance format, which is optimized for analytical queries and supports both vector and scalar filtering natively.
- **Rust core:** LanceDB's core is Rust, giving better performance and lower memory footprint than ChromaDB's Python core.
- **Local-first philosophy:** Aligns with our personal-tool ethos — all data stays on disk in a single directory.
- **TypeScript SDK:** First-class TypeScript support with good API ergonomics.

### Consequences

- LanceDB's ecosystem is newer than ChromaDB — fewer tutorials and community examples.
- We'll need to handle embedding generation ourselves (BGE-M3 via transformers.js or local inference).
- Migration path: LanceDB data is portable (Lance format is an open spec).

---

## ADR-003: Knowledge Graph — LightRAG over GraphRAG

**Status:** Accepted
**Date:** 2026-06-07

### Context

We need to build a knowledge graph from unstructured text (articles, notes, job listings). The main approaches are Microsoft's GraphRAG and LightRAG.

### Decision

Use **LightRAG** for knowledge graph construction.

### Rationale

- **Simplicity:** LightRAG has a simpler architecture — it extracts entities and relations with LLM calls and stores them in a lightweight graph structure. GraphRAG requires community detection, hierarchical summarization, and complex indexing.
- **Cost:** LightRAG uses fewer LLM calls per document. GraphRAG's indexing pipeline is expensive (multiple passes over the full corpus).
- **Local-first:** LightRAG can run with any LLM backend, including local models. GraphRAG is optimized for OpenAI APIs.
- **Incremental updates:** LightRAG supports adding new documents without rebuilding the entire graph. GraphRAG requires full re-indexing for significant changes.
- **Good enough:** For a personal knowledge base (thousands of documents, not millions), LightRAG's graph quality is sufficient.

### Consequences

- We lose GraphRAG's community detection and hierarchical summarization.
- If we need global queries over the full corpus, we'll implement our own summary layer.
- We'll need to build our own entity resolution (merging duplicate entities from different sources).

---

## ADR-004: Ingestion Trigger — Hybrid (Poll + Manual Override)

**Status:** Accepted
**Date:** 2026-06-07

### Context

Nexus connects to 5+ existing projects (ai-feeds, job-hunter, email-hub, vault, RSS) that each have their own schedules. Nexus needs to detect when source data has changed and ingest it.

### Decision

Use **hybrid polling with manual override**. A daemon polls source DBs on a schedule (15 min for email-hub, daily for ai-feeds). `nexus ingest --source=...` works on-demand for debugging.

### Rationale

- Existing projects already run their own schedules — nexus shouldn't duplicate that timing logic.
- Manual override is essential for debugging and testing.
- `node-cron` is already used by email-hub, proven in the stack.

### Consequences

- Nexus runs a background process (daemon) that must be managed (start/stop/status).
- Polling interval is configurable per source in nexus.yaml.

---

## ADR-005: Source Change Detection — Row Count / Max ID

**Status:** Accepted
**Date:** 2026-06-07

### Context

The daemon needs to know when a source DB has new data without reading the entire DB each time.

### Decision

Each bridge stores the **last-seen row count or max ID** (watermark). On poll, compare. If different, ingest the delta.

### Rationale

- All existing projects use auto-increment IDs or timestamps.
- `SELECT MAX(id)` or `SELECT COUNT(*)` is cheap (O(1) with indexes).
- The bridge adapter already knows the source schema — that's its job.
- More reliable than mtime checks (which miss in-place updates).

### Consequences

- Each bridge must implement a `getWatermark()` method.
- Watermarks stored in nexus's `source_watermarks` table.

---

## ADR-006: Normalization Depth — Two-Phase (Minimal Sync → Async Enrichment)

**Status:** Accepted
**Date:** 2026-06-07

### Context

Bridges read from source DBs and normalize to FeedItems. The question is how much processing happens during ingestion vs. later.

### Decision

**Two-phase ingestion.** Phase 1 (sync, fast): minimal normalization — map source columns to FeedItem fields. Phase 2 (async, background): LLM enrichment — entity extraction, summarization, scoring.

### Rationale

- ai-feeds already has an LLM scorer. job-hunter has keyword + LLM scorers. email-hub has an LLM classifier. Nexus shouldn't re-score what's already scored.
- For new sources (RSS, RSSHub, bookmarks), enrichment is needed.
- Two-phase lets existing projects keep their scoring logic while nexus adds its own enrichment layer.
- Sync ingestion is fast (no LLM calls), enrichment can be batched and rate-limited.

### Consequences

- Need an `enrichment_jobs` SQLite table to track pending enrichments.
- Worker loop polls for pending jobs, processes with DeepSeek V4 Flash.
- FeedItems have `enrichment_status`: pending | done | failed.

---

## ADR-007: Entity Extraction — Hybrid (Rules First, LLM for Unknowns)

**Status:** Accepted
**Date:** 2026-06-07

### Context

The enrichment pipeline needs to extract entities (skills, companies, roles, concepts) from FeedItems.

### Decision

**Hybrid extraction.** Run rule-based extraction first (O*NET taxonomy, known companies, known skills). If unresolvable entities or low confidence, send to LLM (DeepSeek V4 Flash).

### Rationale

- O*NET provides a canonical skills taxonomy — free, structured, authoritative.
- Known companies from job-hunter cover 70% of cases.
- Rules are fast (no API calls), LLM handles the long tail (novel companies, emerging skills).
- LLM call is gated by confidence threshold from rule-based pass.

### Consequences

- Need a `known_entities` table seeded from O*NET + job-hunter data.
- Rule-based extractor is a separate module (`src/ingest/extractors/rules.ts`).
- LLM extractor is a separate module (`src/ingest/extractors/llm.ts`).
- Orchestrator decides which extractor to use based on confidence.

---

## ADR-008: Entity Resolution — Canonical ID Registry

**Status:** Accepted
**Date:** 2026-06-07

### Context

The same real-world thing appears from multiple sources ("React" in ai-feeds, job-hunter, vault). Need to merge duplicates.

### Decision

**Canonical ID registry.** Maintain a `canonical_entities` table with known aliases. When a new entity arrives, check aliases first. If no match, fuzzy match (Levenshtein). If still ambiguous, LLM disambiguation.

### Rationale

- O*NET provides canonical skill names + aliases.
- job-hunter has known company names.
- Prevents "React vs reactjs vs React.js" fragmentation in the knowledge graph.
- Seed from existing data, let enrichment pipeline extend.

### Consequences

- `canonical_entities` table: (id, canonical_name, type, aliases[], source_ids[]).
- Fuzzy match threshold: Levenshtein distance ≤ 2 for short names, ≤ 20% for long names.
- LLM disambiguation only for ambiguous cases (multiple fuzzy matches).

---

## ADR-009: LLM Provider — DeepSeek V4 Flash for Enrichment

**Status:** Accepted
**Date:** 2026-06-07

### Context

The enrichment pipeline needs an LLM for entity extraction and summarization.

### Decision

Use **DeepSeek V4 Flash** for enrichment. Reserve higher-quality models (Claude, GPT-4) for consumer chat.

### Rationale

- email-hub already uses DeepSeek V4 Flash for classification — proven, fast, cheap.
- $0.14/1M input tokens — sustainable for batch enrichment.
- Good enough for entity extraction and summarization.
- llm-router (9 free-tier providers) available as fallback.

### Consequences

- Enrichment pipeline calls DeepSeek API directly (not via llm-router, to avoid latency).
- Consumer chat uses llm-router for quality.

---

## ADR-010: MCP Tool Surface — 7 Tools

**Status:** Accepted
**Date:** 2026-06-07

### Context

Nexus exposes tools to Claude Code via MCP. Need to define the tool surface.

### Decision

Expose **7 MCP tools**: `nexus_search`, `nexus_ingest`, `nexus_gaps`, `nexus_digest`, `nexus_entities`, `nexus_add_note`, `nexus_status`.

### Rationale

- Covers all primary use cases: search, ingest, analyze, capture.
- `nexus_add_note` enables capture-first pattern (Limitless lesson).
- `nexus_entities` enables knowledge graph queries.
- `nexus_status` for debugging and monitoring.

### Consequences

- Each tool has a Zod input schema and typed output.
- MCP server uses `@modelcontextprotocol/sdk`.
- Tools are registered in `src/serve/mcp/server.ts`.

---

## ADR-011: Vault Sync — Write to Dedicated Folder Only

**Status:** Accepted
**Date:** 2026-06-07

### Context

The vault bridge reads from Obsidian. Should nexus also write back?

### Decision

**Write to `vault/nexus/` only.** Never touch existing notes. Outputs include digests, gap analyses, learning paths.

### Rationale

- Follows existing pattern: `episodes/` for AI news, `signals/` for weekly reviews.
- Safe — no risk of corrupting existing vault content.
- User can review nexus outputs in Obsidian before acting on them.

### Consequences

- `vault/nexus/digests/` — weekly digests as markdown.
- `vault/nexus/gaps/` — skill gap analyses.
- `vault/nexus/paths/` — learning path recommendations.
- Vault bridge is read-only; vault writer is a separate module.

---

## ADR-012: Data Retention — 90-Day TTL + Archive

**Status:** Accepted
**Date:** 2026-06-07

### Context

How long to keep raw FeedItems after processing into the knowledge graph?

### Decision

**90-day TTL with archive.** Raw FeedItems kept for 90 days, then archived to compressed JSON. Knowledge graph entities persist forever.

### Rationale

- ai-feeds already has a retention policy pattern.
- 90 days covers "what was I reading last quarter" without unbounded growth.
- Archive means re-processing is possible if enrichment pipeline improves.
- Knowledge graph entities are the durable layer — raw content is ephemeral.

### Consequences

- `nexus archive --before=YYYY-MM-DD` command for manual archival.
- Daemon runs archival on a weekly cron.
- Archive stored in `data/archive/` as gzipped JSON.

---

## ADR-013: Error Handling — Retry with Backoff

**Status:** Accepted
**Date:** 2026-06-07

### Context

When a bridge adapter fails mid-ingestion, what happens?

### Decision

**3 retries with exponential backoff (1s, 2s, 4s), then skip + log to `ingestion_errors` table.**

### Rationale

- RSS feeds are flaky. email-hub already handles IMAP timeouts with retry.
- Skip-and-continue ensures one bad item doesn't kill the whole batch.
- Errors table is inspectable via `nexus status --errors`.

### Consequences

- `ingestion_errors` table: (id, source, item_id, error, timestamp, retries).
- `nexus status --errors` shows recent failures.
- Dead letter queue for items that fail 3 times.

---

## ADR-014: Consumer Priority — MCP → Telegram → Graph Viz

**Status:** Accepted
**Date:** 2026-06-07

### Context

15+ downstream consumers identified. Need to prioritize.

### Decision

**Tier 1:** MCP server, Telegram bot, Knowledge graph visualization.
**Tier 2:** Spaced repetition (Anki), Meeting prep briefs, Resume generator.

### Rationale

- MCP server: immediate value, makes nexus queryable from Claude Code.
- Telegram bot: daily digest + chat, reuse grammy infra from email-hub.
- Graph viz: reveals hidden connections, Cytoscape.js.
- personal-ai-hub already runs Telegram bots — same pattern, same infra.

### Consequences

- MCP server built in Phase 1.
- Telegram bot built in Phase 2.
- Graph viz built in Phase 3.
