/**
 * Knowledge plugin — optional extension for nexus.
 * Adds entity extraction, knowledge graph, vector search, and entity resolution.
 *
 * @example
 * ```ts
 * import { createNexus } from "nexus";
 * import { withKnowledge } from "nexus/knowledge";
 *
 * const nexus = createNexus({
 *   storage: { main: "./data/nexus.sqlite" },
 *   llm: { endpoint: "https://api.deepseek.com/v1", model: "deepseek-chat" },
 *   extend: withKnowledge({ vectorsPath: "./data/vectors.lance" }),
 * });
 * ```
 */
import type { NexusContext } from "../sdk/types.js";
import { EntityStore } from "./store.js";
import { ContentIndexer } from "./indexer.js";
import { UnifiedSearch } from "./search.js";
import { LanceVectorStore } from "./vectors.js";
import { EntityResolver } from "./resolver.js";
import { KnowledgeGraph } from "./graph.js";
import { initEnrichmentTable } from "../ingest/enrichment-worker.js";

export interface KnowledgePluginOptions {
  /** Path to LanceDB vector store directory. Default: "./data/vectors.lance" */
  vectorsPath?: string;
  /** Entity types to extract. Default: ["skill", "company", "role", "technology", "concept", "person"] */
  entityTypes?: string[];
  /** Extraction strategy. Default: ["rules", "llm"] */
  extractors?: ("rules" | "llm")[];
  /** Confidence threshold for LLM extraction. Default: 0.5 */
  confidenceThreshold?: number;
}

/** Knowledge graph context fields added by this plugin. */
export interface KnowledgeContext {
  readonly entities: EntityStore;
  readonly indexer: ContentIndexer;
  readonly vectors: LanceVectorStore;
  readonly search: UnifiedSearch;
  readonly resolver: EntityResolver;
  readonly graph: KnowledgeGraph;
}

/**
 * Create a knowledge plugin extension function.
 * Returns a function compatible with createContext's `extend` option.
 */
export function withKnowledge(
  options: KnowledgePluginOptions = {},
): (base: NexusContext) => Promise<NexusContext & KnowledgeContext> {
  return async (base: NexusContext) => {
    const vectorsPath = options.vectorsPath ?? "./data/vectors.lance";

    // Initialize enrichment table
    initEnrichmentTable(base.db);

    // Create knowledge components
    const entities = new EntityStore(base.db);
    const indexer = new ContentIndexer(base.db);
    const vectors = new LanceVectorStore(vectorsPath);
    await vectors.init();

    const resolver = new EntityResolver(base.db);
    const search = new UnifiedSearch(base.db, undefined, undefined, vectors);
    const graph = new KnowledgeGraph(entities, base.db);

    base.logger.info("Knowledge plugin initialized");

    return {
      ...base,
      entities,
      indexer,
      vectors,
      search,
      resolver,
      graph,
    };
  };
}
