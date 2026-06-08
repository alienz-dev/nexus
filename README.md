# Nexus

Personal Knowledge Management System Hub — connects your vault, RSS feeds, GitHub stars, and Raindrop bookmarks into a unified knowledge graph with search, entity extraction, and agent orchestration.

```
  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐
  │  vault   │  │   RSS    │  │ GitHub Stars │  │ Raindrop │
  └────┬─────┘  └────┬─────┘  └──────┬───────┘  └────┬─────┘
       │              │               │               │
       └──────┬───────┴───────┬───────┴───────┬───────┘
              │               │               │
       ┌──────▼───────────────▼───────────────▼──────┐
       │            Bridge Adapters                   │
       └──────────────────┬──────────────────────────┘
                          │
       ┌──────────────────▼──────────────────────────┐
       │   Knowledge Layer (SQLite + LanceDB +       │
       │   entity graph + wikilink traversal)        │
       └──────────────────┬──────────────────────────┘
                          │
       ┌──────────────────▼──────────────────────────┐
       │   Agent Layer (gap-detector, auditor,        │
       │   path-planner, fact extraction)             │
       └──────────────────┬──────────────────────────┘
                          │
       ┌──────────────────▼──────────────────────────┐
       │   Consumer API (CLI + Hono REST + MCP)      │
       └─────────────────────────────────────────────┘
```

## Prerequisites

- Node.js 22+

## Install

```bash
npm install -g nexus
```

Or run directly:

```bash
npx nexus
```

## Quick Start

1. Copy the example config:

```bash
cp nexus.yaml.example nexus.yaml
```

2. Edit `nexus.yaml` — set your sources:

```yaml
sources:
  vault:
    path: ~/obsidian-vault
    enabled: true
  github_stars:
    enabled: true  # requires GITHUB_TOKEN env var
  raindrop:
    enabled: true  # requires RAINDROP_TOKEN env var
```

3. Run:

```bash
nexus status       # check connected sources
nexus ingest       # pull data from all sources
nexus enrich       # extract entities and facts
nexus search "machine learning"  # search your knowledge
```

## Sources

| Source | Auth | Data | Config |
|--------|------|------|--------|
| **Vault** (Obsidian) | None (local dir) | Markdown notes, wikilinks, tags, frontmatter | `sources.vault.path` |
| **RSS/RSSHub** | None | Feed items from URLs | `rss.feeds[]`, `rsshub.routes[]` |
| **GitHub Stars** | `GITHUB_TOKEN` env | Starred repos (language, topics, description) | `sources.github_stars.enabled` |
| **Raindrop.io** | `RAINDROP_TOKEN` env | Bookmarks, notes, highlights | `sources.raindrop.enabled` |

### Custom Sources

Implement the `BridgeAdapter` interface:

```typescript
import type { BridgeAdapter, FeedItem } from "nexus";

export class MyBridge implements BridgeAdapter {
  readonly name = "my-source";
  async isAvailable() { return true; }
  async fetch(): Promise<FeedItem[]> { /* ... */ }
  async count() { return 0; }
}
```

## Search

Nexus uses **Reciprocal Rank Fusion (RRF)** to combine three search signals:

| Signal | Weight | What it does |
|--------|--------|-------------|
| **BM25** | 0.4 | Keyword matching on title + content |
| **Vector** | 0.4 | Semantic similarity via MiniLM-L6-v2 embeddings (384-dim) |
| **Graph** | 0.2 | Entity co-occurrence traversal — boosts content linked via knowledge graph |

Additionally, **wikilink boosting** reranks results: notes linked from top matches get a relevance bump (Obsidian vault only).

## Enrichment Pipeline

The two-phase enrichment pipeline runs after ingestion:

1. **Entity extraction** — rules-based (~70% coverage) + optional LLM (DeepSeek) for long-tail
2. **Fact extraction** — proficiency levels, experience years, usage frequency from content patterns
3. **Co-occurrence relations** — entities mentioned in the same content get linked in the knowledge graph

```bash
nexus ingest   # Phase 1: fetch content, index, queue enrichment jobs
nexus enrich   # Phase 2: process jobs → entities + facts + relations
```

## Agents

| Agent | Command | What it does |
|-------|---------|-------------|
| **Gap Detector** | `nexus gaps` | Compares skill entities vs demand signals in indexed content |
| **Auditor** | `nexus audit` | Finds orphans, duplicates, missing details in knowledge graph |
| **Path Planner** | `nexus gaps` (included) | Converts gaps into learning steps with hour estimates |

## CLI Commands

| Command | Description |
|---------|-------------|
| `nexus status` | Show all connected sources and counts |
| `nexus search <query>` | Search across all sources (BM25 + vector + graph RRF) |
| `nexus ask <question>` | Ask a question, get synthesized answers |
| `nexus ingest [--source=...]` | Run ingestion from connected sources |
| `nexus enrich [--limit=N]` | Process pending entity/fact extraction jobs |
| `nexus digest [--period=daily\|weekly]` | Show daily/weekly summary |
| `nexus gaps` | Show skill gaps (knowledge vs market demand) |
| `nexus resolve --seed/--lookup` | Manage the canonical entity registry |
| `nexus audit` | Knowledge graph health check |
| `nexus graph` | Entity-relation statistics |
| `nexus memory -r/-q/-l` | Agent memory (remember/recall/list) |
| `nexus watch [-i N]` | Live feed monitoring with periodic ingestion |
| `nexus export [-f anki\|json\|csv\|markdown]` | Export knowledge to various formats |
| `nexus sync [-t dir]` | Sync nexus data to Obsidian vault |
| `nexus serve` | Start REST API server |

Global options:

- `-c, --config <path>` — Path to `nexus.yaml` config file
- `NEXUS_CONFIG` env var — Alternative config path

## Configuration

All settings live in `nexus.yaml` (see `nexus.yaml.example` for the full template):

| Section | Key fields |
|---------|-----------|
| `sources` | `path` (supports `~`), `enabled` |
| `database` | `main` (SQLite path), `vectors` (LanceDB path) |
| `rss.feeds` | Array of RSS feed URLs |
| `rsshub` | `enabled`, `url`, `routes` for RSSHub integration |
| `llm` | `provider`, `model`, `fallback` |
| `server` | `port`, `host` |
| `telegram` | `enabled`, `bot_token`, `chat_id` |
| `search` | `embedding_model`, `reranker`, `rrf_k`, `weights` (bm25/vector/graph) |

## MCP Server

Nexus exposes tools via Model Context Protocol. Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "nexus": {
      "command": "npx",
      "args": ["tsx", "/path/to/nexus/src/serve/mcp/standalone.ts"],
      "env": {}
    }
  }
}
```

Available tools: `nexus_search`, `nexus_gaps`, `nexus_entity`, `nexus_digest`, `nexus_audit`, `nexus_memory`.

## Data Stores

| Store | Engine | What's in it |
|-------|--------|-------------|
| Content Index | SQLite | All ingested items with MD5 hashes for differential updates |
| Entity Store | SQLite | Entities (skills, companies, roles), relations, temporal facts |
| Entity Resolver | SQLite | Canonical name registry (deduplication) |
| Agent Memory | SQLite | Persistent memories with importance decay |
| Vector Store | LanceDB | 384-dim MiniLM embeddings for semantic search |

All SQLite tables share one file (`data/nexus.sqlite`). Vectors are in `data/vectors.lance/`.

## License

MIT
