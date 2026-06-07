/** Bridge adapter for email-hub project — reads emails from its SQLite database. */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { BridgeAdapter, FeedItem } from "./types.js";

export class EmailHubBridge implements BridgeAdapter {
  readonly name = "email-hub";
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
        ? `SELECT * FROM processed_emails WHERE processed_at > ? ORDER BY processed_at DESC`
        : `SELECT * FROM processed_emails ORDER BY processed_at DESC LIMIT 500`;
      const rows = since ? db.prepare(query).all(since) : db.prepare(query).all();
      return (rows as any[]).map((row) => ({
        id: row.message_id ?? String(row.uid),
        source: "email-hub",
        title: row.subject ?? "",
        content: row.summary ?? "",
        url: undefined,
        timestamp: row.processed_at ?? new Date().toISOString(),
        score: undefined,
        tags: [row.category, row.urgency, row.source_account].filter(Boolean),
        entities: row.sender ? [row.sender] : [],
      }));
    } finally {
      db.close();
    }
  }

  async count(): Promise<number> {
    const db = new Database(this.dbPath, { readonly: true });
    try {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM processed_emails").get() as any;
      return row.cnt;
    } finally {
      db.close();
    }
  }
}
