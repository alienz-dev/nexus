# Nexus PKMS — Ubiquitous Language

Domain glossary for the Personal Knowledge Management System.

## Core Concepts

| Term | Definition |
|------|-----------|
| **FeedItem** | A discrete piece of content ingested from any source (article, job listing, email, note) |
| **Entity** | A typed real-world thing extracted from content (skill, company, role, person, concept) |
| **Relation** | A directed, typed edge between two entities (e.g., "requires", "belongs_to", "mentions") |
| **Fact** | A temporally-valid assertion about an entity (e.g., "Company X has 500 employees as of 2026-01") |
| **KnowledgeGraph** | The collection of entities, relations, and facts that form the structured knowledge base |
| **Source** | An external data provider connected via a bridge adapter |
| **Bridge** | An adapter that normalizes data from a specific source into FeedItems |

## Schema Layer (Tana-style)

| Term | Definition |
|------|-----------|
| **Supertag** | A typed schema definition with fields, queries, and AI context (analogous to Tana supertags) |
| **Schema** | The registry of all supertag types in the system |

## Agents

| Term | Definition |
|------|-----------|
| **GapDetector** | Agent that compares current knowledge against job market demands to find skill gaps |
| **Consolidator** | Weekly agent that reads daily logs, extracts patterns, and updates the knowledge graph |
| **PathPlanner** | Agent that generates learning curricula from identified skill gaps |

## Search

| Term | Definition |
|------|-----------|
| **BM25** | Traditional keyword-based retrieval scoring |
| **Vector search** | Semantic similarity search using embeddings (BGE-M3) |
| **RRF (Reciprocal Rank Fusion)** | Method to combine multiple ranking signals with configurable weights |
| **Reranker** | Cross-encoder model (BGE-reranker-v2-m3) that rescores top results for precision |

## Infrastructure

| Term | Definition |
|------|-----------|
| **Differential update** | Content indexing strategy using MD5 hashes to skip unchanged content |
| **LanceDB** | Embedded columnar vector database for local-first semantic search |
| **LightRAG** | Knowledge graph construction from unstructured text using LLM extraction |
| **MCP** | Model Context Protocol — standard for exposing tools to AI agents |
