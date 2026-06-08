/** Knowledge layer — entity store, content indexer, unified search, vector store, resolver, graph, memory. */
export type { Entity, Relation, Fact, KnowledgeGraph, SearchResult } from "./types.js";
export { EntitySchema, RelationSchema, FactSchema } from "./types.js";
export { EntityStore } from "./store.js";
export { ContentIndexer, md5 } from "./indexer.js";
export { UnifiedSearch } from "./search.js";
export type { SearchWeights, SearchOptions } from "./search.js";
export { LanceVectorStore } from "./vectors.js";
export type { VectorRecord, VectorSearchResult } from "./vectors.js";
export { EntityResolver } from "./resolver.js";
export type { CanonicalEntity } from "./resolver.js";
export { KnowledgeGraph as KnowledgeGraphEngine } from "./graph.js";
export type { GraphStats } from "./graph.js";
export { AgentMemory } from "./memory.js";
export type { Memory } from "./memory.js";
