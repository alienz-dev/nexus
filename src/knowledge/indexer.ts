/** Content indexer with MD5 differential update — Khoj pattern. */
import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import type { FeedItem } from "../ingest/types.js";

/** Stored index entry with content hash for differential updates. */
interface IndexEntry {
  id: string;
  source: string;
  hash: string;
  title: string;
  content: string;
  url: string | null;
  timestamp: string;
  tags: string;
  entities: string;
  indexedAt: string;
}

export class ContentIndexer {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content_index (
        id TEXT NOT NULL,
        source TEXT NOT NULL,
        hash TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        url TEXT,
        timestamp TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        entities TEXT DEFAULT '[]',
        indexed_at TEXT NOT NULL,
        PRIMARY KEY (id, source)
      );

      CREATE INDEX IF NOT EXISTS idx_content_source ON content_index(source);
      CREATE INDEX IF NOT EXISTS idx_content_hash ON content_index(hash);
    `);
  }

  /** Index items, skipping those whose content hash hasn't changed (differential update). */
  index(items: FeedItem[]): { added: number; updated: number; skipped: number } {
    const upsert = this.db.prepare(`
      INSERT INTO content_index (id, source, hash, title, content, url, timestamp, tags, entities, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, source) DO UPDATE SET
        hash = excluded.hash,
        title = excluded.title,
        content = excluded.content,
        url = excluded.url,
        timestamp = excluded.timestamp,
        tags = excluded.tags,
        entities = excluded.entities,
        indexed_at = excluded.indexed_at
    `);

    let added = 0;
    let updated = 0;
    let skipped = 0;

    const existing = new Map<string, string>();
    const rows = this.db.prepare("SELECT id, source, hash FROM content_index").all() as any[];
    for (const row of rows) {
      existing.set(`${row.id}:${row.source}`, row.hash);
    }

    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      for (const item of items) {
        const hash = md5(item.content);
        const key = `${item.id}:${item.source}`;
        const prevHash = existing.get(key);

        if (prevHash === hash) {
          skipped++;
          continue;
        }

        upsert.run(
          item.id, item.source, hash, item.title, item.content,
          item.url ?? null, item.timestamp, JSON.stringify(item.tags),
          JSON.stringify(item.entities), now
        );

        if (prevHash) updated++;
        else added++;
      }
    });

    tx();
    return { added, updated, skipped };
  }

  /** Get all indexed items from a specific source. */
  getBySource(source: string): IndexEntry[] {
    return this.db.prepare("SELECT * FROM content_index WHERE source = ?").all(source) as any[];
  }

  /** Get total indexed count. */
  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM content_index").get() as any;
    return row.cnt;
  }
}

/** Compute MD5 hash of a string. */
export function md5(content: string): string {
  return createHash("md5").update(content).digest("hex");
}
