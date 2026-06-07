/** Unified search across all sources — BM25 + vector with weighted RRF. */
import type Database from "better-sqlite3";
import type { SearchResult } from "./types.js";
import type { LanceVectorStore } from "./vectors.js";
import { embedText } from "../ingest/embeddings.js";

export interface SearchWeights {
  bm25: number;
  vector: number;
  graph: number;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  weights?: SearchWeights;
  rrfK?: number;
}

const DEFAULT_WEIGHTS: SearchWeights = { bm25: 0.4, vector: 0.4, graph: 0.2 };
const DEFAULT_RRF_K = 60;

export class UnifiedSearch {
  private db: Database.Database;
  private weights: SearchWeights;
  private rrfK: number;
  private vectorStore: LanceVectorStore | null;

  constructor(db: Database.Database, weights?: SearchWeights, rrfK?: number, vectorStore?: LanceVectorStore) {
    this.db = db;
    this.weights = weights ?? DEFAULT_WEIGHTS;
    this.rrfK = rrfK ?? DEFAULT_RRF_K;
    this.vectorStore = vectorStore ?? null;
  }

  /** Search using BM25 keyword matching on the content index. */
  bm25Search(query: string, limit = 20): SearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const conditions = terms.map(() => "(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)").join(" OR ");
    const params = terms.flatMap((t) => [`%${t}%`, `%${t}%`]);

    const rows = this.db.prepare(`
      SELECT id, source, title, content, url
      FROM content_index
      WHERE ${conditions}
      LIMIT ?
    `).all(...params, limit) as any[];

    return rows.map((row, i) => ({
      item: { id: `${row.source}:${row.id}`, type: "content", content: `${row.title} ${row.content}` },
      score: 1 / (i + 1),
      source: "bm25" as const,
    }));
  }

  /** Search using vector similarity via LanceDB. */
  async vectorSearch(query: string, limit = 20): Promise<SearchResult[]> {
    if (!this.vectorStore) return [];

    const vector = embedText(query);
    const results = await this.vectorStore.search(vector, limit);

    return results.map((r) => ({
      item: { id: `${r.source}:${r.id}`, type: "content", content: "" },
      score: r.score,
      source: "vector" as const,
    }));
  }

  /** Combine multiple search results using Reciprocal Rank Fusion. */
  rrfMerge(...resultSets: SearchResult[][]): SearchResult[] {
    const scores = new Map<string, { score: number; item: SearchResult["item"]; sources: Set<string> }>();

    for (const results of resultSets) {
      for (let rank = 0; rank < results.length; rank++) {
        const r = results[rank];
        const key = r.item.id;
        const existing = scores.get(key) ?? { score: 0, item: r.item, sources: new Set() };
        existing.score += 1 / (this.rrfK + rank + 1);
        existing.sources.add(r.source);
        scores.set(key, existing);
      }
    }

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map((s) => ({
        item: s.item,
        score: s.score,
        source: Array.from(s.sources).join("+") as any,
      }));
  }

  /** Full unified search: BM25 + vector, merged with RRF. */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const limit = options.limit ?? 20;

    // Run BM25 and vector search in parallel
    const [bm25Results, vectorResults] = await Promise.all([
      Promise.resolve(this.bm25Search(options.query, limit)),
      this.vectorSearch(options.query, limit),
    ]);

    const graphResults: SearchResult[] = []; // Phase 3: LightRAG

    const merged = this.rrfMerge(bm25Results, vectorResults, graphResults);
    return merged.slice(0, limit);
  }
}
