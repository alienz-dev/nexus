/** Knowledge layer — entity store, content indexer, unified search, vector store. */
export type { Entity, Relation, Fact, KnowledgeGraph, SearchResult } from "./types.js";
export { EntitySchema, RelationSchema, FactSchema } from "./types.js";
export { EntityStore } from "./store.js";
export { ContentIndexer, md5 } from "./indexer.js";
export { UnifiedSearch } from "./search.js";
export type { SearchWeights, SearchOptions } from "./search.js";
export { LanceVectorStore } from "./vectors.js";
export type { VectorRecord, VectorSearchResult } from "./vectors.js";
