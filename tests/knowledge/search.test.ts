/** Stub tests for unified search. */
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { UnifiedSearch } from "../../src/knowledge/search.js";
import { ContentIndexer } from "../../src/knowledge/indexer.js";
import type { SearchResult } from "../../src/knowledge/types.js";

describe("UnifiedSearch", () => {
  let db: Database.Database;
  let search: UnifiedSearch;
  let indexer: ContentIndexer;

  beforeEach(() => {
    db = new Database(":memory:");
    indexer = new ContentIndexer(db);
    search = new UnifiedSearch(db);

    // Seed some test content
    indexer.index([
      {
        id: "1",
        source: "test",
        title: "TypeScript Best Practices",
        content: "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.",
        timestamp: new Date().toISOString(),
        tags: ["typescript", "javascript"],
        entities: [],
      },
      {
        id: "2",
        source: "test",
        title: "Rust for Systems Programming",
        content: "Rust is a systems programming language focused on safety and performance.",
        timestamp: new Date().toISOString(),
        tags: ["rust", "systems"],
        entities: [],
      },
      {
        id: "3",
        source: "test",
        title: "Python Machine Learning",
        content: "Python is widely used for machine learning and data science.",
        timestamp: new Date().toISOString(),
        tags: ["python", "ml"],
        entities: [],
      },
    ]);
  });

  it("finds results by keyword", () => {
    const results = search.bm25Search("typescript");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.content).toContain("TypeScript");
  });

  it("returns empty for no match", () => {
    const results = search.bm25Search("nonexistent_term_xyz");
    expect(results).toHaveLength(0);
  });

  it("handles multi-word queries", async () => {
    const results = await search.search({ query: "machine learning" });
    expect(results.length).toBeGreaterThan(0);
  });

  it("respects limit parameter", async () => {
    const results = await search.search({ query: "programming", limit: 1 });
    expect(results).toHaveLength(1);
  });
});

describe("RRF merge", () => {
  it("merges results from multiple sources", () => {
    const db = new Database(":memory:");
    const search = new UnifiedSearch(db);

    const setA: SearchResult[] = [
      { item: { id: "x", type: "t", content: "a" }, score: 1, source: "bm25" },
      { item: { id: "y", type: "t", content: "b" }, score: 0.8, source: "bm25" },
    ];
    const setB: SearchResult[] = [
      { item: { id: "y", type: "t", content: "b" }, score: 0.9, source: "vector" },
      { item: { id: "z", type: "t", content: "c" }, score: 0.7, source: "vector" },
    ];

    const merged = search.rrfMerge(setA, setB);
    // y appears in both sets, should rank highest
    expect(merged[0].item.id).toBe("y");
    expect(merged.length).toBe(3);
  });
});
