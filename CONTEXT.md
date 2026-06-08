# Nexus PKMS — Ubiquitous Language

Domain glossary for the Personal Knowledge Management System.

## Core Concepts

| Term | Definition |
|------|-----------|
| **FeedItem** | A discrete piece of content ingested from any source (note, article, bookmark, repo) |
| **Entity** | A typed real-world thing extracted from content (skill, company, role, person, concept) |
| **Relation** | A directed, typed edge between two entities (e.g., "co_occurs", "requires", "belongs_to") |
| **Fact** | A temporally-valid assertion about an entity (e.g., "TypeScript proficiency: 7", "5 years Python") |
| **KnowledgeGraph** | The collection of entities, relations, and facts that form the structured knowledge base |
| **Source** | An external data provider connected via a bridge adapter |
| **Bridge** | An adapter that normalizes data from a specific source into FeedItems |
| **Wikilink** | An Obsidian-style `[[Note Name]]` reference extracted from vault content |

## Schema Layer (Tana-style)

| Term | Definition |
|------|-----------|
| **Supertag** | A typed schema definition with fields, queries, and AI context (analogous to Tana supertags) |
| **Schema** | The registry of all supertag types in the system |

## Agents

| Term | Definition |
|------|-----------|
| **GapDetector** | Agent that compares current knowledge against market demands to find skill gaps |
| **KnowledgeAuditor** | Agent that detects orphans, duplicates, stale facts, and missing details |
| **Consolidator** | Agent for extracting patterns from daily logs (future) |
| **PathPlanner** | Agent that generates learning curricula from identified skill gaps |

## Search

| Term | Definition |
|------|-----------|
| **BM25** | Traditional keyword-based retrieval scoring (LIKE query on content_index) |
| **Vector search** | Semantic similarity search using MiniLM-L6-v2 embeddings (384-dim) |
| **Graph search** | Entity co-occurrence traversal — follows relations to find related content |
| **RRF (Reciprocal Rank Fusion)** | Method to combine multiple ranking signals with configurable weights |
| **Wikilink boost** | Post-RRF reranking that boosts notes linked from top search results |

## Enrichment

| Term | Definition |
|------|-----------|
| **Entity extraction** | Rules-based (~70%) + optional LLM extraction of typed entities from content |
| **Fact extraction** | Pattern-based extraction of structured predicates (proficiency, experience, frequency) |
| **Co-occurrence relation** | Relation created between entities that appear in the same content item |
| **Differential update** | Content indexing strategy using MD5 hashes to skip unchanged content |
| **Two-phase pattern** | Ingest queues enrichment jobs; enrich processes them asynchronously |

## Infrastructure

| Term | Definition |
|------|-----------|
| **LanceDB** | Embedded columnar vector database for local-first semantic search |
| **SQLite** | Single-file relational database for content index, entities, relations, facts, memory |
| **MCP** | Model Context Protocol — standard for exposing tools to AI agents |

## Sources

| Term | Definition |
|------|-----------|
| **VaultBridge** | Reads Obsidian `.md` files with frontmatter, extracts wikilinks |
| **RssBridge** | Fetches RSS/Atom feeds, handles both RSS and Atom XML formats |
| **GithubStarsBridge** | Fetches starred repositories from GitHub API (language, topics, description) |
| **RaindropBridge** | Fetches bookmarks and highlights from Raindrop.io API |
