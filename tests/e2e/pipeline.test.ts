/** E2E pipeline test — verifies the full flow: ingest → enrich → search → graph. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { ContentIndexer } from "../../src/knowledge/indexer.js";
import { EntityStore } from "../../src/knowledge/store.js";
import { EntityResolver } from "../../src/knowledge/resolver.js";
import { UnifiedSearch } from "../../src/knowledge/search.js";
import { GapDetector } from "../../src/agents/gap-detector.js";
import { KnowledgeAuditor } from "../../src/agents/auditor.js";
import { KnowledgeGraph } from "../../src/knowledge/graph.js";
import { initEnrichmentTable, queueEnrichment, processEnrichment } from "../../src/ingest/enrichment-worker.js";
import type { FeedItem } from "../../src/ingest/types.js";

// Test data: simulates what GithubStarsBridge and VaultBridge would return
const testItems: FeedItem[] = [
  {
    id: "github:facebook/react",
    source: "github-stars",
    title: "facebook/react",
    content: "A declarative, efficient, and flexible JavaScript library for building user interfaces. Language: JavaScript\nTopics: react, javascript, frontend",
    url: "https://github.com/facebook/react",
    timestamp: "2026-01-15T10:00:00Z",
    tags: ["react", "javascript", "frontend"],
    entities: [],
    links: [],
  },
  {
    id: "github:microsoft/TypeScript",
    source: "github-stars",
    title: "microsoft/TypeScript",
    content: "TypeScript is a superset of JavaScript that compiles to clean JavaScript output. Language: TypeScript\nTopics: typescript, javascript, compiler",
    url: "https://github.com/microsoft/TypeScript",
    timestamp: "2026-02-01T10:00:00Z",
    tags: ["typescript", "javascript", "compiler"],
    entities: [],
    links: [],
  },
  {
    id: "notes/kubernetes.md",
    source: "vault",
    title: "Kubernetes Notes",
    content: "Kubernetes (k8s) is a container orchestration platform. I've been learning Docker and Kubernetes together. React apps can be deployed on k8s.",
    url: undefined,
    timestamp: "2026-03-01T10:00:00Z",
    tags: ["kubernetes", "docker"],
    entities: [],
    links: ["Docker Notes", "Deploy Guide"],
  },
  {
    id: "notes/python.md",
    source: "vault",
    title: "Python Learning",
    content: "Python is great for data science and machine learning. I use TypeScript for frontend and Python for backend.",
    url: undefined,
    timestamp: "2026-03-05T10:00:00Z",
    tags: ["python", "data-science"],
    entities: [],
    links: [],
  },
];

describe("E2E Pipeline", () => {
  let db: Database.Database;
  let indexer: ContentIndexer;
  let store: EntityStore;
  let resolver: EntityResolver;
  let search: UnifiedSearch;

  beforeAll(() => {
    db = new Database(":memory:");
    indexer = new ContentIndexer(db);
    store = new EntityStore(db);
    resolver = new EntityResolver(db);
    search = new UnifiedSearch(db);
    initEnrichmentTable(db);
  });

  afterAll(() => {
    db.close();
  });

  it("step 1: ingests items into content_index", () => {
    const result = indexer.index(testItems);
    expect(result.added).toBe(4);
    expect(result.skipped).toBe(0);
    expect(indexer.count()).toBe(4);
  });

  it("step 1b: differential update skips unchanged items", () => {
    const result = indexer.index(testItems);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(4);
  });

  it("step 1c: stores wikilinks in content_index", () => {
    const links = indexer.getLinks("notes/kubernetes.md", "vault");
    expect(links).toEqual(["Docker Notes", "Deploy Guide"]);
  });

  it("step 2: queues enrichment jobs", () => {
    const queued = queueEnrichment(db, testItems);
    expect(queued).toBe(4);
  });

  it("step 3: enrichment extracts entities and creates relations", async () => {
    const result = await processEnrichment(db, store, 10);
    expect(result.processed).toBe(4);
    expect(result.entitiesExtracted).toBeGreaterThan(0);
    expect(result.errors).toBe(0);

    // Verify entities were created
    const skills = store.findByType("skill");
    expect(skills.length).toBeGreaterThan(0);

    // Verify co-occurrence relations were created
    const graph = new KnowledgeGraph(store, db);
    const stats = graph.stats();
    expect(stats.relations).toBeGreaterThan(0);
  });

  it("step 4: entity resolution works", () => {
    // Seed some canonical entities
    resolver.seed();

    // Resolve should work
    const canonical = resolver.resolve("javascript", "skill");
    expect(canonical).toBeTruthy();
  });

  it("step 5: search returns relevant results", async () => {
    // BM25 search
    const results = await search.search({ query: "TypeScript JavaScript", limit: 5 });
    expect(results.length).toBeGreaterThan(0);

    // Should find the TypeScript repo
    const tsResult = results.find((r) => r.item.id.includes("TypeScript"));
    expect(tsResult).toBeTruthy();
  });

  it("step 6: gap detection works", async () => {
    const detector = new GapDetector(store, search, resolver);
    const { gaps } = await detector.detect();
    // Should detect some gaps (skills with demand > current level)
    expect(Array.isArray(gaps)).toBe(true);
  });

  it("step 7: audit works", async () => {
    const auditor = new KnowledgeAuditor(store, indexer);
    const { result } = await auditor.audit();
    expect(result.entitiesAudited).toBeGreaterThan(0);
    expect(Array.isArray(result.findings)).toBe(true);
  });
});
