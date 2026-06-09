/**
 * E2E tests for NEX-001: Project Foundation
 *
 * Covers:
 * - Config loading (nexus.yaml parsing, defaults, env vars, tilde expansion)
 * - Database initialization (WAL mode, foreign keys, migrations)
 * - CLI (--version, status command)
 * - Chalk wrapper (ESM import fix for chalk v5)
 * - Logger (log levels, output)
 * - Hash utility (integration context)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import Database from "better-sqlite3";

// ─── Config Loading ────────────────────────────────────────────────────────────

describe("Config loading", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "nexus-config-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads nexus.yaml with all fields", async () => {
    const configPath = join(tempDir, "nexus.yaml");
    writeFileSync(configPath, `
version: "1"
database:
  main: ./test.sqlite
  vectors: ./test.lance
sources:
  my_source:
    path: /tmp/test
    enabled: true
rss:
  feeds:
    - https://example.com/feed.xml
llm:
  endpoint: https://api.test.com/v1
  model: test-model
  apiKey: test-key
  maxRetries: 3
server:
  port: 9999
  host: 0.0.0.0
search:
  rrf_k: 30
  weights:
    bm25: 0.5
    vector: 0.3
    graph: 0.2
`);

    const { loadConfig } = await import("../../src/lib/config.js");
    const config = loadConfig(configPath);

    expect(config.version).toBe("1");
    expect(config.database.main).toBe("./test.sqlite");
    expect(config.database.vectors).toBe("./test.lance");
    expect(config.sources.my_source).toBeDefined();
    expect(config.sources.my_source.path).toBe("/tmp/test");
    expect(config.sources.my_source.enabled).toBe(true);
    expect(config.rss.feeds).toEqual(["https://example.com/feed.xml"]);
    expect(config.llm.endpoint).toBe("https://api.test.com/v1");
    expect(config.llm.model).toBe("test-model");
    expect(config.llm.apiKey).toBe("test-key");
    expect(config.llm.maxRetries).toBe(3);
    expect(config.server.port).toBe(9999);
    expect(config.server.host).toBe("0.0.0.0");
    expect(config.search.rrf_k).toBe(30);
    expect(config.search.weights.bm25).toBe(0.5);
  });

  it("falls back to defaults when file does not exist", async () => {
    const { loadConfig } = await import("../../src/lib/config.js");
    const config = loadConfig(join(tempDir, "nonexistent.yaml"));

    expect(config.database.main).toBe("./data/nexus.sqlite");
    expect(config.database.vectors).toBe("./data/vectors.lance");
    expect(config.server.port).toBe(3777);
    expect(config.server.host).toBe("localhost");
    expect(config.llm.maxRetries).toBe(2);
    expect(config.search.rrf_k).toBe(60);
    expect(config.search.weights.bm25).toBe(0.4);
    expect(config.search.weights.vector).toBe(0.4);
    expect(config.search.weights.graph).toBe(0.2);
  });

  it("falls back to defaults on invalid YAML", async () => {
    const configPath = join(tempDir, "bad.yaml");
    writeFileSync(configPath, "{{{{invalid yaml}}}}");

    const { loadConfig } = await import("../../src/lib/config.js");
    const config = loadConfig(configPath);

    // Should get defaults, not throw
    expect(config.database.main).toBe("./data/nexus.sqlite");
    expect(config.server.port).toBe(3777);
  });

  it("expands tildes in source paths", async () => {
    const configPath = join(tempDir, "tilde.yaml");
    writeFileSync(configPath, `
version: "1"
sources:
  vault:
    path: ~/vault
    enabled: true
database:
  main: ~/data/nexus.sqlite
`);

    const { loadConfig } = await import("../../src/lib/config.js");
    const config = loadConfig(configPath);

    expect(config.sources.vault.path).not.toContain("~");
    expect(config.sources.vault.path).toMatch(/^\//);
    expect(config.database.main).not.toContain("~");
    expect(config.database.main).toMatch(/^\//);
  });

  it("applies LLM env var fallbacks", async () => {
    const configPath = join(tempDir, "env.yaml");
    writeFileSync(configPath, `
version: "1"
llm:
  model: yaml-model
`);

    const originalEndpoint = process.env.LLM_ENDPOINT;
    const originalModel = process.env.LLM_MODEL;
    const originalKey = process.env.LLM_API_KEY;

    try {
      process.env.LLM_ENDPOINT = "https://env-endpoint.com/v1";
      process.env.LLM_MODEL = "env-model";
      process.env.LLM_API_KEY = "env-key";

      const { loadConfig } = await import("../../src/lib/config.js");
      const config = loadConfig(configPath);

      // Env vars take precedence for endpoint and model
      expect(config.llm.endpoint).toBe("https://env-endpoint.com/v1");
      expect(config.llm.model).toBe("env-model");
      // apiKey: yaml value takes precedence over env when set in yaml
      // But in this config, apiKey is not set in yaml, so env is used
      expect(config.llm.apiKey).toBe("env-key");
    } finally {
      if (originalEndpoint !== undefined) process.env.LLM_ENDPOINT = originalEndpoint;
      else delete process.env.LLM_ENDPOINT;
      if (originalModel !== undefined) process.env.LLM_MODEL = originalModel;
      else delete process.env.LLM_MODEL;
      if (originalKey !== undefined) process.env.LLM_API_KEY = originalKey;
      else delete process.env.LLM_API_KEY;
    }
  });

  it("defaults source enabled to true", async () => {
    const configPath = join(tempDir, "source-default.yaml");
    writeFileSync(configPath, `
version: "1"
sources:
  test_source:
    path: /tmp/test
`);

    const { loadConfig } = await import("../../src/lib/config.js");
    const config = loadConfig(configPath);

    expect(config.sources.test_source.enabled).toBe(true);
  });

  it("defaults RSS and RSSHub to empty", async () => {
    const configPath = join(tempDir, "empty.yaml");
    writeFileSync(configPath, `version: "1"`);

    const { loadConfig } = await import("../../src/lib/config.js");
    const config = loadConfig(configPath);

    expect(config.rss.feeds).toEqual([]);
    expect(config.rsshub.enabled).toBe(false);
    expect(config.rsshub.routes).toEqual([]);
  });
});

// ─── Database Initialization ───────────────────────────────────────────────────

describe("Database initialization", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "nexus-db-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("initializes with WAL journal mode", async () => {
    const { initDb, closeDb } = await import("../../src/lib/db.js");
    const dbPath = join(tempDir, "test.sqlite");
    const db = initDb(dbPath);

    const mode = db.pragma("journal_mode", { simple: true });
    expect(mode).toBe("wal");

    closeDb(db);
  });

  it("enables foreign keys", async () => {
    const { initDb, closeDb } = await import("../../src/lib/db.js");
    const dbPath = join(tempDir, "test.sqlite");
    const db = initDb(dbPath);

    const fk = db.pragma("foreign_keys", { simple: true });
    expect(fk).toBe(1);

    closeDb(db);
  });

  it("creates data directory if missing", async () => {
    const { initDb, closeDb } = await import("../../src/lib/db.js");
    const nestedPath = join(tempDir, "deep", "nested", "data", "test.sqlite");
    const db = initDb(nestedPath);

    expect(existsSync(nestedPath)).toBe(true);

    closeDb(db);
  });

  it("creates the database file", async () => {
    const { initDb, closeDb } = await import("../../src/lib/db.js");
    const dbPath = join(tempDir, "new.sqlite");
    expect(existsSync(dbPath)).toBe(false);

    const db = initDb(dbPath);
    expect(existsSync(dbPath)).toBe(true);

    closeDb(db);
  });

  it("supports concurrent reads with WAL", async () => {
    const { initDb, closeDb } = await import("../../src/lib/db.js");
    const dbPath = join(tempDir, "concurrent.sqlite");
    const db = initDb(dbPath);

    // Create a table and insert data
    db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
    db.prepare("INSERT INTO test VALUES (1, 'hello')").run();

    // Read in a separate connection (WAL allows concurrent reads)
    const db2 = new Database(dbPath);
    const row = db2.prepare("SELECT * FROM test WHERE id = 1").get() as any;
    expect(row.value).toBe("hello");
    db2.close();

    closeDb(db);
  });
});

// ─── Entity Store Migrations ───────────────────────────────────────────────────

describe("Entity store migrations", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "nexus-entity-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates entities, relations, and facts tables", async () => {
    const { initDb, closeDb } = await import("../../src/lib/db.js");
    const { EntityStore } = await import("../../src/knowledge/store.js");
    const db = initDb(join(tempDir, "test.sqlite"));

    const store = new EntityStore(db);

    // Tables should exist
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as any[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain("entities");
    expect(tableNames).toContain("relations");
    expect(tableNames).toContain("facts");

    closeDb(db);
  });

  it("creates correct indexes", async () => {
    const { initDb, closeDb } = await import("../../src/lib/db.js");
    const { EntityStore } = await import("../../src/knowledge/store.js");
    const db = initDb(join(tempDir, "test.sqlite"));

    const store = new EntityStore(db);

    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
    ).all() as any[];
    const indexNames = indexes.map(i => i.name);

    expect(indexNames).toContain("idx_entities_type");
    expect(indexNames).toContain("idx_entities_name");
    expect(indexNames).toContain("idx_relations_source");
    expect(indexNames).toContain("idx_relations_target");
    expect(indexNames).toContain("idx_facts_entity");

    closeDb(db);
  });

  it("supports full entity lifecycle", async () => {
    const { initDb, closeDb } = await import("../../src/lib/db.js");
    const { EntityStore } = await import("../../src/knowledge/store.js");
    const db = initDb(join(tempDir, "test.sqlite"));
    const store = new EntityStore(db);

    // Create entity
    const entity = store.upsertEntity({
      type: "skill",
      name: "TypeScript",
      properties: { level: 8 },
      sources: ["vault"],
    });
    expect(entity.id).toBeDefined();
    expect(entity.type).toBe("skill");
    expect(entity.name).toBe("TypeScript");

    // Read back
    const fetched = store.getEntity(entity.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("TypeScript");
    expect(fetched!.properties.level).toBe(8);

    // Find by type
    const skills = store.findByType("skill");
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe("TypeScript");

    // Find by name
    const found = store.findByName("typescript", "skill");
    expect(found).not.toBeNull();
    expect(found!.id).toBe(entity.id);

    // Add relation
    const entity2 = store.upsertEntity({
      type: "skill",
      name: "JavaScript",
      properties: {},
      sources: ["vault"],
    });
    const relation = store.addRelation({
      sourceId: entity.id,
      targetId: entity2.id,
      type: "requires",
      weight: 1.0,
      properties: {},
    });
    expect(relation.id).toBeDefined();

    // Find related
    const related = store.findRelated(entity.id);
    expect(related.length).toBe(1);
    expect(related[0].name).toBe("JavaScript");

    // Add fact
    const fact = store.addFact({
      entityId: entity.id,
      predicate: "proficiency",
      value: 8,
      validFrom: "2024-01-01",
      source: "vault",
      confidence: 0.9,
    });
    expect(fact.id).toBeDefined();

    // Get facts
    const facts = store.getFacts(entity.id);
    expect(facts.length).toBe(1);
    expect(facts[0].predicate).toBe("proficiency");
    expect(facts[0].value).toBe(8);

    // Upsert (update)
    store.upsertEntity({
      id: entity.id,
      type: "skill",
      name: "TypeScript",
      properties: { level: 9 },
      sources: ["vault", "github"],
    });
    const updated = store.getEntity(entity.id);
    expect(updated!.properties.level).toBe(9);
    expect(updated!.sources).toEqual(["vault", "github"]);

    closeDb(db);
  });
});

// ─── CLI ───────────────────────────────────────────────────────────────────────

describe("CLI", () => {
  const cliPath = join(process.cwd(), "src/cli/index.ts");
  const tsx = join(process.cwd(), "node_modules/.bin/tsx");

  it("prints version with --version", () => {
    const output = execSync(`${tsx} ${cliPath} --version`, { encoding: "utf-8" }).trim();
    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("prints help with --help", () => {
    const output = execSync(`${tsx} ${cliPath} --help`, { encoding: "utf-8" });
    expect(output).toContain("nexus");
    expect(output).toContain("status");
    expect(output).toContain("search");
    expect(output).toContain("ingest");
  });

  it("status command shows sources and counts", () => {
    const output = execSync(`${tsx} ${cliPath} status`, { encoding: "utf-8" });
    expect(output).toContain("Nexus PKMS Status");
    expect(output).toContain("Content indexed:");
    expect(output).toContain("Sources:");
  });

  it("status command exits cleanly (exit code 0)", () => {
    expect(() => {
      execSync(`${tsx} ${cliPath} status`, { encoding: "utf-8" });
    }).not.toThrow();
  });
});

// ─── Chalk Wrapper ─────────────────────────────────────────────────────────────

describe("Chalk wrapper", () => {
  it("imports successfully and provides all color methods", async () => {
    const chalk = (await import("../../src/lib/chalk.js")).default;

    expect(typeof chalk.gray).toBe("function");
    expect(typeof chalk.blue).toBe("function");
    expect(typeof chalk.yellow).toBe("function");
    expect(typeof chalk.red).toBe("function");
    expect(typeof chalk.green).toBe("function");
    expect(typeof chalk.cyan).toBe("function");
    expect(typeof chalk.magenta).toBe("function");
    expect(typeof chalk.white).toBe("function");
    expect(typeof chalk.dim).toBe("function");
    expect(typeof chalk.bold).toBe("function");
    expect(typeof chalk.underline).toBe("function");
  });

  it("bold is a function (regression: chalk v5 ESM import)", async () => {
    const chalk = (await import("../../src/lib/chalk.js")).default;
    // This was the specific bug: chalk.bold was undefined because
    // require("chalk") returns module namespace, not the default export
    expect(typeof chalk.bold).toBe("function");
  });

  it("color methods return strings", async () => {
    const chalk = (await import("../../src/lib/chalk.js")).default;

    expect(typeof chalk.red("test")).toBe("string");
    expect(typeof chalk.green("test")).toBe("string");
    expect(typeof chalk.bold("test")).toBe("string");
  });

  it("produces output that contains the original text", async () => {
    const chalk = (await import("../../src/lib/chalk.js")).default;

    expect(chalk.red("hello")).toContain("hello");
    expect(chalk.bold("world")).toContain("world");
    expect(chalk.green("nexus")).toContain("nexus");
  });
});

// ─── Logger ────────────────────────────────────────────────────────────────────

describe("Logger", () => {
  let consoleOutput: string[];
  let originalLog: typeof console.log;

  beforeEach(() => {
    consoleOutput = [];
    originalLog = console.log;
    console.log = (...args: any[]) => {
      consoleOutput.push(args.join(" "));
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it("logs at info level by default", async () => {
    const { logger, setLogLevel } = await import("../../src/lib/logger.js");
    setLogLevel("info");

    logger.info("test message");
    expect(consoleOutput.length).toBe(1);
    expect(consoleOutput[0]).toContain("[INFO]");
    expect(consoleOutput[0]).toContain("test message");
  });

  it("suppresses debug messages at info level", async () => {
    const { logger, setLogLevel } = await import("../../src/lib/logger.js");
    setLogLevel("info");

    logger.debug("hidden");
    expect(consoleOutput.length).toBe(0);
  });

  it("shows debug messages at debug level", async () => {
    const { logger, setLogLevel } = await import("../../src/lib/logger.js");
    setLogLevel("debug");

    logger.debug("visible");
    expect(consoleOutput.length).toBe(1);
    expect(consoleOutput[0]).toContain("[DEBUG]");
  });

  it("includes timestamp in ISO format", async () => {
    const { logger, setLogLevel } = await import("../../src/lib/logger.js");
    setLogLevel("debug");

    logger.info("timestamped");
    const timestamp = consoleOutput[0].split(" ")[0];
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("includes data as JSON when provided", async () => {
    const { logger, setLogLevel } = await import("../../src/lib/logger.js");
    setLogLevel("debug");

    logger.info("with data", { key: "value", count: 42 });
    expect(consoleOutput[0]).toContain('"key":"value"');
    expect(consoleOutput[0]).toContain('"count":42');
  });

  it("respects all log levels", async () => {
    const { logger, setLogLevel } = await import("../../src/lib/logger.js");

    setLogLevel("error");
    logger.info("hidden");
    logger.warn("hidden");
    logger.debug("hidden");
    logger.error("shown");
    expect(consoleOutput.length).toBe(1);
    expect(consoleOutput[0]).toContain("[ERROR]");

    consoleOutput.length = 0;
    setLogLevel("warn");
    logger.info("hidden");
    logger.warn("shown");
    logger.error("shown");
    expect(consoleOutput.length).toBe(2);
  });
});

// ─── Hash Utility (Integration Context) ───────────────────────────────────────

describe("Hash utility (integration)", () => {
  it("produces deterministic hashes for content indexing", async () => {
    const { md5 } = await import("../../src/lib/hash.js");

    // Simulate content indexing scenario
    const content1 = "# Hello World\nThis is a test note.";
    const content2 = "# Hello World\nThis is a test note.";
    const content3 = "# Hello World\nThis is a modified note.";

    expect(md5(content1)).toBe(md5(content2));
    expect(md5(content1)).not.toBe(md5(content3));
  });

  it("handles large content", async () => {
    const { md5 } = await import("../../src/lib/hash.js");

    const largeContent = "x".repeat(1_000_000);
    const hash = md5(largeContent);
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("Buffer and string produce same hash", async () => {
    const { md5, md5Buffer } = await import("../../src/lib/hash.js");

    const text = "test content for hashing";
    expect(md5(text)).toBe(md5Buffer(Buffer.from(text)));
  });
});
