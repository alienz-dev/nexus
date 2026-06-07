/** Bridge adapter for job-hunter project — reads job listings from its SQLite database. */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { BridgeAdapter, FeedItem } from "./types.js";

export class JobHunterBridge implements BridgeAdapter {
  readonly name = "job-hunter";
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
        ? `SELECT * FROM listings WHERE scraped_at > ? ORDER BY scraped_at DESC`
        : `SELECT * FROM listings ORDER BY scraped_at DESC LIMIT 500`;
      const rows = since ? db.prepare(query).all(since) : db.prepare(query).all();
      return (rows as any[]).map((row) => ({
        id: row.uid ?? String(row.id),
        source: "job-hunter",
        title: row.title ?? "",
        content: row.description ?? "",
        url: row.url ?? undefined,
        timestamp: row.scraped_at ?? row.posted_date ?? new Date().toISOString(),
        score: row.final_score ?? row.llm_score ?? row.keyword_score ?? undefined,
        tags: [row.company, row.location, row.remote ? "remote" : "onsite", row.source].filter(Boolean),
        entities: [row.company, row.title].filter(Boolean),
      }));
    } finally {
      db.close();
    }
  }

  async count(): Promise<number> {
    const db = new Database(this.dbPath, { readonly: true });
    try {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM listings").get() as any;
      return row.cnt;
    } finally {
      db.close();
    }
  }
}
