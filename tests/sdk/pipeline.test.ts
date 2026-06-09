/**
 * SDK Pipeline integration test — verifies defineSource, defineProcessor,
 * definePipeline, and runPipeline work together.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { z } from "zod";
import {
  defineSource,
  defineProcessor,
  defineOutput,
  definePipeline,
} from "../../src/pipeline/index.js";
import { initCheckpointTable, loadCheckpoint, CheckpointManager } from "../../src/pipeline/checkpoint.js";
import { renderTemplate, extractVariables, validateVariables } from "../../src/llm/templates.js";

describe("Pipeline SDK", () => {
  describe("defineSource", () => {
    it("creates a valid source definition", () => {
      const source = defineSource({
        name: "test-source",
        schema: z.object({ id: z.string(), title: z.string() }),
        fetch: async () => [{ id: "1", title: "Test" }],
      });

      expect(source.name).toBe("test-source");
      expect(source.schema).toBeDefined();
      expect(typeof source.fetch).toBe("function");
    });

    it("throws on missing name", () => {
      expect(() =>
        defineSource({
          name: "",
          schema: z.object({ id: z.string() }),
          fetch: async () => [],
        }),
      ).toThrow("name");
    });
  });

  describe("defineProcessor", () => {
    it("creates a valid processor definition", () => {
      const proc = defineProcessor({
        name: "test-processor",
        input: z.object({ title: z.string() }),
        prompt: "Analyze {{title}}",
        output: z.object({ score: z.number() }),
      });

      expect(proc.name).toBe("test-processor");
      expect(proc.prompt).toBe("Analyze {{title}}");
    });

    it("throws on missing output schema", () => {
      expect(() =>
        defineProcessor({
          name: "test",
          input: z.object({}),
          prompt: "test",
          output: undefined as never,
        }),
      ).toThrow("output");
    });
  });

  describe("definePipeline", () => {
    it("creates a pipeline with defaults", () => {
      const source = defineSource({
        name: "src",
        schema: z.object({ id: z.string() }),
        fetch: async () => [],
      });

      const proc = defineProcessor({
        name: "proc",
        input: z.object({ id: z.string() }),
        prompt: "Process {{id}}",
        output: z.object({ result: z.string() }),
      });

      const pipeline = definePipeline({
        name: "test-pipeline",
        source,
        steps: [proc],
      });

      expect(pipeline.name).toBe("test-pipeline");
      expect(pipeline.concurrency).toBe(3);
      expect(pipeline.retry?.maxAttempts).toBe(3);
    });
  });

  describe("Template rendering", () => {
    it("renders variables correctly", () => {
      const result = renderTemplate("Hello {{name}}, you have {{count}} items", {
        name: "Alice",
        count: 5,
      });
      expect(result).toBe("Hello Alice, you have 5 items");
    });

    it("stringifies objects", () => {
      const result = renderTemplate("Data: {{obj}}", {
        obj: { key: "value" },
      });
      expect(result).toBe('Data: {"key":"value"}');
    });

    it("throws on missing variables", () => {
      expect(() => renderTemplate("Hello {{name}}", {})).toThrow("Missing template variable: name");
    });

    it("extracts variables", () => {
      const vars = extractVariables("{{a}} and {{b}} and {{a}}");
      expect(vars).toEqual(["a", "b"]);
    });

    it("validates variables", () => {
      const missing = validateVariables("{{a}} and {{b}}", { a: 1 });
      expect(missing).toEqual(["b"]);
    });
  });

  describe("Checkpoint", () => {
    let db: Database.Database;

    beforeEach(() => {
      db = new Database(":memory:");
      initCheckpointTable(db);
    });

    afterEach(() => {
      db.close();
    });

    it("loads null for non-existent checkpoint", () => {
      const cp = loadCheckpoint(db, "non-existent");
      expect(cp).toBeNull();
    });

    it("saves and loads checkpoint", () => {
      const mgr = new CheckpointManager(db, "test-pipeline", 2);

      mgr.setCursor("2024-01-15");
      mgr.markComplete("item-1");
      mgr.markComplete("item-2");
      mgr.flush();

      const loaded = loadCheckpoint(db, "test-pipeline");
      expect(loaded).not.toBeNull();
      expect(loaded!.cursor).toBe("2024-01-15");
      expect(loaded!.completedItems).toContain("item-1");
      expect(loaded!.completedItems).toContain("item-2");
      expect(loaded!.totalProcessed).toBe(2);
    });

    it("isCompleted tracks items", () => {
      const mgr = new CheckpointManager(db, "test", 100);
      expect(mgr.isCompleted("x")).toBe(false);
      mgr.markComplete("x");
      expect(mgr.isCompleted("x")).toBe(true);
    });

    it("debounces saves", () => {
      const mgr = new CheckpointManager(db, "test", 5);

      // Mark 4 items — should not save yet (interval is 5)
      for (let i = 0; i < 4; i++) {
        mgr.markComplete(`item-${i}`);
      }

      // Load from DB — should be null (not saved yet)
      const before = loadCheckpoint(db, "test");
      expect(before).toBeNull();

      // Mark 5th item — should trigger save
      mgr.markComplete("item-4");

      const after = loadCheckpoint(db, "test");
      expect(after).not.toBeNull();
      expect(after!.totalProcessed).toBe(5);
    });
  });
});
