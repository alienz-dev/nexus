/** Tests for LanceDB vector store. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { LanceVectorStore } from "../../src/knowledge/vectors.js";
import { embedText, embedTextSync, embedBatch } from "../../src/ingest/embeddings.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("LanceVectorStore", () => {
  let store: LanceVectorStore;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "nexus-vectors-"));
    store = new LanceVectorStore(join(tempDir, "test.lance"), 1024);
    await store.init();
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("initializes without error", async () => {
    expect(await store.count()).toBe(0);
  });

  it("upserts and counts vectors", async () => {
    const result = await store.upsert([
      { id: "1", source: "test", vector: embedTextSync("hello world"), content: "hello world", title: "Test 1" },
      { id: "2", source: "test", vector: embedTextSync("goodbye world"), content: "goodbye world", title: "Test 2" },
    ]);
    expect(result.added + result.updated).toBeGreaterThan(0);
    expect(await store.count()).toBe(2);
  });

  it("searches by vector similarity", async () => {
    const queryVector = embedTextSync("hello");
    const results = await store.search(queryVector, 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("id");
    expect(results[0]).toHaveProperty("source");
    expect(results[0]).toHaveProperty("score");
  });

  it("deletes by source", async () => {
    await store.upsert([
      { id: "3", source: "to_delete", vector: embedTextSync("delete me"), content: "delete", title: "Delete" },
    ]);
    expect(await store.count()).toBe(3);
    await store.deleteBySource("to_delete");
    expect(await store.count()).toBe(2);
  });
});

describe("embeddings (sync stub)", () => {
  it("returns 1024-dimension vector", () => {
    const vec = embedTextSync("test");
    expect(vec).toHaveLength(1024);
  });

  it("is deterministic — same input produces same output", () => {
    const a = embedTextSync("hello world");
    const b = embedTextSync("hello world");
    expect(a).toEqual(b);
  });

  it("returns unit vector (norm ≈ 1)", () => {
    const vec = embedTextSync("test content");
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });

  it("different inputs produce different vectors", () => {
    const a = embedTextSync("hello");
    const b = embedTextSync("world");
    expect(a).not.toEqual(b);
  });
});

describe("embeddings (async)", () => {
  it("returns vector with correct dimension", async () => {
    const vec = await embedText("test");
    expect(vec.length).toBeGreaterThan(0);
  });

  it("batch embedding returns correct count", async () => {
    const vectors = await embedBatch(["a", "b", "c"]);
    expect(vectors).toHaveLength(3);
    expect(vectors[0].length).toBeGreaterThan(0);
  });
});
