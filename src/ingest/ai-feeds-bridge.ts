/** Bridge adapter for ai-feeds project — reads from its SQLite database.
 *  Maps papers table to FeedItem with rich metadata from scoring system. */
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

      return (rows as any[]).map((row) => {
        // Build rich content from title + abstract + scoring context
        const parts = [row.title, row.abstract];
        if (row.score_explanation) parts.push(`Score reason: ${row.score_explanation}`);
        const content = parts.filter(Boolean).join("\n\n");

        // Build tags from categories, primary_category, sources, score_interests
        const tags: string[] = [];
        if (row.primary_category) tags.push(row.primary_category);
        if (row.categories) {
          const cats = typeof row.categories === "string" ? row.categories.split(",") : [];
          tags.push(...cats.map((s: string) => s.trim()).filter(Boolean));
        }
        if (row.sources) {
          const srcs = typeof row.sources === "string" ? row.sources.split(",") : [];
          tags.push(...srcs.map((s: string) => s.trim()).filter(Boolean));
        }
        if (row.score_interests) {
          const interests = typeof row.score_interests === "string" ? row.score_interests.split(",") : [];
          tags.push(...interests.map((s: string) => s.trim()).filter(Boolean));
        }

        // Entities from authors
        const entities: string[] = [];
        if (row.authors) {
          const authors = typeof row.authors === "string" ? row.authors.split(",") : [];
          entities.push(...authors.map((s: string) => s.trim()).filter(Boolean));
        }

        return {
          id: row.id ?? row.dedup_key,
          source: "ai-feeds",
          title: row.title ?? "",
          content,
          url: row.url ?? row.pdf_url ?? undefined,
          timestamp: row.published ?? row.first_seen_at ?? new Date().toISOString(),
          score: row.relevance_score ?? undefined,
          tags,
          entities,
        };
      });
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
