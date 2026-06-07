/** Unified search across all sources — BM25 + vector with weighted RRF. */
import type Database from "better-sqlite3";
import type { SearchResult } from "./types.js";

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

  constructor(db: Database.Database, weights?: SearchWeights, rrfK?: number) {
    this.db = db;
    this.weights = weights ?? DEFAULT_WEIGHTS;
    this.rrfK = rrfK ?? DEFAULT_RRF_K;
  }

  /** Search using BM25 keyword matching on the content index. */
  bm25Search(query: string, limit = 20): SearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    // Simple BM25-style scoring: count term matches weighted by field
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
      score: 1 / (i + 1), // Simplified rank score
      source: "bm25" as const,
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
        // RRF formula: sum of 1 / (k + rank) for each result set
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

  /** Full unified search: BM25 + vector (placeholder) + graph (placeholder), merged with RRF. */
  search(options: SearchOptions): SearchResult[] {
    const limit = options.limit ?? 20;
    const bm25Results = this.bm25Search(options.query, limit);

    // Placeholder: vector and graph search will be implemented with LanceDB and LightRAG
    const vectorResults: SearchResult[] = [];
    const graphResults: SearchResult[] = [];

    const merged = this.rrfMerge(bm25Results, vectorResults, graphResults);
    return merged.slice(0, limit);
  }
}
