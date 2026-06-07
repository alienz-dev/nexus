/** Bridge adapter for ai-feeds project — reads from its SQLite database. */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { BridgeAdapter, FeedItem } from "./types.js";

export class AiFeedsBridge implements BridgeAdapter {
  readonly name = "ai-feeds";
  private dbPath: string;

  constructor(projectPath: string, dbRelative: string) {
    this.dbPath = resolve(projectPath, dbRelative);
  }

  async isAvailable(): Promise<boolean> {
    return existsSync(this.dbPath);
  }

  async fetch(since?: string): Promise<FeedItem[]> {
    const db = new Database(this.dbPath, { readonly: true });
    try {
      const query = since
        ? `SELECT * FROM papers WHERE first_seen_at > ? ORDER BY first_seen_at DESC`
        : `SELECT * FROM papers ORDER BY first_seen_at DESC LIMIT 500`;
      const rows = since ? db.prepare(query).all(since) : db.prepare(query).all();
      return (rows as any[]).map((row) => ({
        id: row.id ?? row.dedup_key,
        source: "ai-feeds",
        title: row.title ?? "",
        content: row.abstract ?? "",
        url: row.url ?? row.pdf_url ?? undefined,
        timestamp: row.published ?? row.first_seen_at ?? new Date().toISOString(),
        score: row.relevance_score ?? undefined,
        tags: row.categories ? (typeof row.categories === "string" ? row.categories.split(",").map((s: string) => s.trim()) : []) : [],
        entities: row.authors ? (typeof row.authors === "string" ? row.authors.split(",").map((s: string) => s.trim()) : []) : [],
      }));
    } finally {
      db.close();
    }
  }

  async count(): Promise<number> {
    const db = new Database(this.dbPath, { readonly: true });
    try {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM papers").get() as any;
      return row.cnt;
    } finally {
      db.close();
    }
  }
}
