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
        ? `SELECT * FROM emails WHERE received_at > ? ORDER BY received_at DESC`
        : `SELECT * FROM emails ORDER BY received_at DESC LIMIT 500`;
      const rows = since ? db.prepare(query).all(since) : db.prepare(query).all();
      return (rows as any[]).map((row) => ({
        id: String(row.id ?? row.message_id),
        source: "email-hub",
        title: row.subject ?? "",
        content: row.body ?? row.snippet ?? "",
        url: undefined,
        timestamp: row.received_at ?? new Date().toISOString(),
        score: undefined,
        tags: row.labels ? JSON.parse(row.labels) : [],
        entities: row.from ? [row.from] : [],
      }));
    } finally {
      db.close();
    }
  }

  async count(): Promise<number> {
    const db = new Database(this.dbPath, { readonly: true });
    try {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM emails").get() as any;
      return row.cnt;
    } finally {
      db.close();
    }
  }
}
