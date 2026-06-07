# Nexus PKMS — Goals and Vision

## Vision

A unified personal knowledge hub that connects all existing projects (ai-feeds, job-hunter, email-hub, vault) into a single searchable, graph-structured knowledge base with AI-powered agents for gap detection, consolidation, and learning path planning.

## Phases

### Phase 1: Foundation (v0.1.0)
- Project scaffold and configuration
- Bridge adapters for all connected sources
- SQLite entity store
- Content indexer with differential updates
- CLI skeleton
- Basic BM25 search

### Phase 2: Intelligence (v0.2.0)
- LanceDB vector store with BGE-M3 embeddings
- Unified search (BM25 + vector with RRF)
- Knowledge graph construction (LightRAG)
- MCP server for agent tool access

### Phase 3: Agents (v0.3.0)
- Gap detector agent
- Weekly consolidator agent
- Learning path planner
- Mastra workflow orchestration

### Phase 4: Consumer (v0.4.0)
- Hono REST API (search, gaps, digest, status)
- Telegram daily/weekly digest
- RSSHub integration (1000+ sources)
- Cognee memory layer

## Success Metrics

- **Coverage:** Ingest from all 5 source types (ai-feeds, job-hunter, email-hub, vault, RSS)
- **Freshness:** Content indexed within 1 hour of creation
- **Search quality:** Relevant results in top 5 for 80% of queries
- **Gap detection:** Identify skill gaps with >70% accuracy vs manual assessment
- **Agent utility:** Weekly consolidation produces actionable insights
