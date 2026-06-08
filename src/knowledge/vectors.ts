/** LanceDB vector store for semantic search. */
import * as lancedb from "@lancedb/lancedb";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface VectorRecord {
  id: string;
  source: string;
  vector: number[];
  content: string;
  title: string;
}

export interface VectorSearchResult {
  id: string;
  source: string;
  score: number;
}

export class LanceVectorStore {
  private dbPath: string;
  private db: lancedb.Connection | null = null;
  private tableName = "feed_item_vectors";
  private vectorDim: number;

  constructor(dbPath: string, vectorDim = 384) {
    this.dbPath = dbPath;
    this.vectorDim = vectorDim;
  }

  /** Initialize the LanceDB database and ensure the table exists. */
  async init(): Promise<void> {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = await lancedb.connect(this.dbPath);

    // Create table if it doesn't exist
    const tables = await this.db.tableNames();
    if (!tables.includes(this.tableName)) {
      await this.db.createTable(this.tableName, [
        { id: "__placeholder__", source: "__init__", vector: new Array(this.vectorDim).fill(0), content: "", title: "" },
      ]);
      // Delete the placeholder row
      const table = await this.db.openTable(this.tableName);
      await table.delete('id = "__placeholder__"');
    }
  }

  /** Ensure DB is initialized. */
  private async ensureDb(): Promise<lancedb.Connection> {
    if (!this.db) await this.init();
    return this.db!;
  }

  /** Get or open the table. */
  private async getTable(): Promise<lancedb.Table> {
    const db = await this.ensureDb();
    return await db.openTable(this.tableName);
  }

  /** Upsert vectors — insert new or update existing (by id+source). */
  async upsert(items: VectorRecord[]): Promise<{ added: number; updated: number }> {
    if (items.length === 0) return { added: 0, updated: 0 };

    const table = await this.getTable();
    let added = 0;
    let updated = 0;

    // Process in batches of 100
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100);

      // Delete existing records with same id+source, then insert new ones
      for (const item of batch) {
        try {
          await table.delete(`id = "${item.id}" AND source = "${item.source}"`);
          updated++;
        } catch {
          added++;
        }
      }

      await table.add(batch as unknown as Record<string, unknown>[]);
    }

    return { added, updated };
  }

  /** Search by vector similarity (cosine). */
  async search(vector: number[], limit = 20, source?: string): Promise<VectorSearchResult[]> {
    const table = await this.getTable();

    let query = table.query()
      .nearestTo(vector)
      .select(["id", "source"])
      .limit(limit);

    if (source) {
      query = query.where(`source = "${source}"`);
    }

    const results = await query.toArray();

    return results.map((row: any) => ({
      id: row.id as string,
      source: row.source as string,
      // LanceDB returns _distance; convert to similarity score (0-1)
      score: 1 / (1 + (row._distance ?? 0)),
    }));
  }

  /** Count total vectors. */
  async count(): Promise<number> {
    const table = await this.getTable();
    const count = await table.countRows();
    return count;
  }

  /** Delete all vectors from a source. */
  async deleteBySource(source: string): Promise<void> {
    const table = await this.getTable();
    await table.delete(`source = "${source}"`);
  }
}
