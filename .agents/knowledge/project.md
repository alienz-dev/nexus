# Nexus PKMS — Project Knowledge

## Architecture Overview

Nexus is a Personal Knowledge Management System hub that connects multiple existing projects and adds knowledge graph, agent orchestration, and consumer API layers.

### Tech Stack

- **Runtime:** Node.js 22+, ESM
- **Language:** TypeScript 5.7+ (strict mode)
- **Database:** SQLite (better-sqlite3) for structured data
- **Vector Store:** LanceDB for semantic search
- **API Server:** Hono (lightweight, edge-ready)
- **CLI:** Commander + chalk + ora
- **Agent Framework:** Mastra
- **Schema Validation:** Zod
- **Testing:** Vitest (threads pool)

### Key Patterns

1. **Bridge Adapters:** Each connected project (ai-feeds, job-hunter, email-hub, vault) has a bridge adapter that normalizes its data into `FeedItem` objects.
2. **Differential Updates:** Content indexer uses MD5 hashing to skip unchanged content (Khoj pattern).
3. **Unified Search:** BM25 + vector search combined with Reciprocal Rank Fusion (RRF).
4. **Tana-style Schemas:** Supertag type definitions with fields, queries, and AI context.
5. **FSM Issue Tracking:** .nexus/constitution.yml defines state machine gates for issue lifecycle.

### Directory Structure

```
src/
  ingest/       # Bridge adapters for external sources
  knowledge/    # Entity store, content indexer, search
  agents/       # Mastra agent definitions
  serve/        # Hono API server + MCP
  schemas/      # Tana-style supertag definitions
  cli/          # Commander CLI
  lib/          # Shared utilities (db, config, logger, hash)
tests/          # Vitest test files
.nexus/         # SDD artifacts (issues, specs, constitution)
.agents/        # Agent knowledge files
```
