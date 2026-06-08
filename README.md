# Nexus

Personal Knowledge Management System Hub — connects your vault and RSS feeds into a unified knowledge graph with search, entity extraction, and agent orchestration.

```
         ┌──────────────┐   ┌──────────────┐
         │    vault     │   │  RSS feeds   │
         └──────┬───────┘   └──────┬───────┘
                │                  │
       ┌────────▼──────────────────▼────────┐
       │          Bridge Adapters           │
       └────────────────┬───────────────────┘
                        │
       ┌────────────────▼───────────────────┐
       │     Knowledge Layer (SQLite +      │
       │     LanceDB + knowledge graph)     │
       └────────────────┬───────────────────┘
                        │
       ┌────────────────▼───────────────────┐
       │      Agent Layer (gap-detector,    │
       │      consolidator, path-planner)   │
       └────────────────┬───────────────────┘
                        │
       ┌────────────────▼───────────────────┐
       │      Consumer API (Hono + MCP)     │
       └────────────────────────────────────┘
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

2. Edit `nexus.yaml` — set your vault path and RSS feeds:

```yaml
sources:
  vault:
    path: ~/obsidian-vault
    enabled: true
```

3. Run:

```bash
nexus status       # check connected sources
nexus ingest       # pull data from all sources
nexus search "machine learning"  # search your knowledge
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `nexus status` | Show all connected sources and counts |
| `nexus search <query>` | Search across all connected sources (BM25 + vector RRF) |
| `nexus ask <question>` | Ask a question, get synthesized answers from your knowledge base |
| `nexus ingest [--source=...]` | Run ingestion from connected sources |
| `nexus enrich [--limit=N]` | Process pending entity extraction jobs |
| `nexus digest [--period=daily\|weekly]` | Show daily/weekly summary |
| `nexus gaps` | Show skill gaps (knowledge vs market demand) |
| `nexus resolve --seed/--lookup` | Manage the canonical entity registry |
| `nexus audit` | Knowledge graph health check (orphans, duplicates, stale) |
| `nexus graph` | Entity-relation statistics |
| `nexus memory -r/-q/-l` | Agent memory (remember/recall/list) |
| `nexus watch [-i N]` | Live feed monitoring with periodic ingestion |
| `nexus export [-f anki\|json\|csv\|markdown]` | Export knowledge to various formats |
| `nexus sync [-t dir]` | Sync nexus data to Obsidian vault |
| `nexus serve` | Start REST API server on configured port |

Global options:

- `-c, --config <path>` — Path to `nexus.yaml` config file
- `NEXUS_CONFIG` env var — Alternative config path

## Configuration

All settings live in `nexus.yaml` (see `nexus.yaml.example` for the full template):

| Section | Key fields |
|---------|-----------|
| `sources` | `path` (supports `~`), `db` (relative db path), `enabled` |
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

## Bridges

| Bridge | Source | Data |
|--------|--------|------|
| VaultBridge | Obsidian vault | Markdown notes (wikilinks, tags, frontmatter) |
| RssBridge | RSS/Atom feeds | Direct feeds + RSSHub routes |

### Custom Bridges

Implement the `BridgeAdapter` interface to add your own sources:

```typescript
import type { BridgeAdapter, FeedItem } from "nexus";

export class MyBridge implements BridgeAdapter {
  readonly name = "my-source";
  async isAvailable() { return true; }
  async fetch(): Promise<FeedItem[]> { /* ... */ }
  async count() { return 0; }
}
```

## License

MIT
