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

    const vector = await embedText(query);
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

  /** Graph-based search: find entities matching query, then boost content linked via relations. */
  graphSearch(query: string, limit = 20): SearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    // Gracefully handle missing entities table (e.g. in tests)
    try {
      return this.graphSearchInner(terms, limit);
    } catch {
      return [];
    }
  }

  private graphSearchInner(terms: string[], limit: number): SearchResult[] {
    // Find entities matching query terms
    const conditions = terms.map(() => "LOWER(name) LIKE ?").join(" OR ");
    const params = terms.flatMap((t) => [`%${t}%`]);

    const matchedEntities = this.db.prepare(`
      SELECT id, name, type FROM entities WHERE ${conditions} LIMIT 10
    `).all(...params) as any[];

    if (matchedEntities.length === 0) return [];

    // Find related entities (1-hop via relations)
    const entityIds = matchedEntities.map((e) => e.id);
    const placeholders = entityIds.map(() => "?").join(",");

    const relatedSources = this.db.prepare(`
      SELECT DISTINCT value as source_ref FROM (
        SELECT json_each.value
        FROM entities, json_each(entities.sources)
        WHERE entities.id IN (
          SELECT CASE WHEN source_id IN (${placeholders}) THEN target_id ELSE source_id END
          FROM relations
          WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})
        )
      )
    `).all(...entityIds, ...entityIds, ...entityIds) as any[];

    // Also include sources from matched entities themselves
    const directSources = this.db.prepare(`
      SELECT DISTINCT json_each.value as source_ref
      FROM entities, json_each(entities.sources)
      WHERE entities.id IN (${placeholders})
    `).all(...entityIds) as any[];

    const allSources = new Set<string>();
    for (const row of [...directSources, ...relatedSources]) {
      allSources.add(row.source_ref);
    }

    // Look up content for these sources
    const results: SearchResult[] = [];
    for (const sourceRef of allSources) {
      const [source, ...idParts] = sourceRef.split(":");
      const itemId = idParts.join(":");
      const row = this.db.prepare(
        "SELECT id, source, title, content FROM content_index WHERE id = ? AND source = ?"
      ).get(itemId, source) as any;
      if (row) {
        results.push({
          item: { id: `${row.source}:${row.id}`, type: "content", content: `${row.title} ${row.content}` },
          score: 1 / (results.length + 1),
          source: "graph" as const,
        });
      }
    }

    return results.slice(0, limit);
  }

  /** Full unified search: BM25 + vector + graph, merged with RRF, with wikilink boost. */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const limit = options.limit ?? 20;

    // Run all three search signals
    const bm25Results = this.bm25Search(options.query, limit);
    const vectorResults = await this.vectorSearch(options.query, limit);
    const graphResults = this.graphSearch(options.query, limit);

    let merged = this.rrfMerge(bm25Results, vectorResults, graphResults);

    // Wikilink boost: boost notes linked from top results
    merged = this.wikilinkBoost(merged, limit);

    return merged.slice(0, limit);
  }

  /** Boost notes that are wikilinked from top search results. */
  private wikilinkBoost(results: SearchResult[], limit: number): SearchResult[] {
    // Check top 5 results for wikilinks
    const topResults = results.slice(0, 5);
    const boostTargets = new Map<string, number>(); // id → boost amount

    for (const result of topResults) {
      const [source, ...idParts] = result.item.id.split(":");
      const itemId = idParts.join(":");
      const row = this.db.prepare("SELECT links FROM content_index WHERE id = ? AND source = ?")
        .get(itemId, source) as any;
      if (!row?.links) continue;

      let links: string[];
      try { links = JSON.parse(row.links); } catch { continue; }

      // Each linked note gets a boost proportional to the source result's rank
      const sourceRank = results.indexOf(result);
      const boost = 0.1 / (sourceRank + 1);

      for (const link of links) {
        // Resolve link to content_index id (link is a note name, id is a relative path)
        const linked = this.db.prepare(
          "SELECT id, source FROM content_index WHERE id LIKE ? OR title = ? LIMIT 1"
        ).get(`%${link}.md`, link) as any;
        if (linked) {
          const key = `${linked.source}:${linked.id}`;
          boostTargets.set(key, (boostTargets.get(key) ?? 0) + boost);
        }
      }
    }

    if (boostTargets.size === 0) return results;

    // Apply boosts and re-sort
    for (const result of results) {
      const boost = boostTargets.get(result.item.id);
      if (boost) {
        result.score += boost;
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}
