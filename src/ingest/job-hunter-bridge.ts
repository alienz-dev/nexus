/** Bridge adapter for job-hunter project — reads job listings from its SQLite database.
 *  Maps listings table to FeedItem with salary, scoring, and learning resource data. */
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

      return (rows as any[]).map((row) => {
        // Build rich content from company + title + description + scoring reasoning + salary
        const parts = [];
        if (row.company) parts.push(`Company: ${row.company}`);
        parts.push(row.description);
        if (row.score_reasoning) parts.push(`Score reason: ${row.score_reasoning}`);
        if (row.salary_raw) parts.push(`Salary: ${row.salary_raw}`);
        else if (row.salary_min || row.salary_max) {
          const min = row.salary_min ? `${row.salary_currency ?? "AUD"} ${row.salary_min.toLocaleString()}` : "";
          const max = row.salary_max ? `${row.salary_currency ?? "AUD"} ${row.salary_max.toLocaleString()}` : "";
          parts.push(`Salary: ${min}${min && max ? " - " : ""}${max} ${row.salary_period ?? "annual"}`);
        }
        const content = parts.filter(Boolean).join("\n\n");

        // Build tags from company, location, remote, source, job_type, salary range
        const tags: string[] = [];
        if (row.company) tags.push(row.company);
        if (row.location) tags.push(row.location);
        tags.push(row.remote ? "remote" : "onsite");
        if (row.source) tags.push(row.source);
        if (row.job_type) tags.push(row.job_type);
        if (row.status && row.status !== "new") tags.push(`status:${row.status}`);
        // Salary range bucket
        if (row.salary_min) {
          if (row.salary_min >= 200000) tags.push("salary:200k+");
          else if (row.salary_min >= 150000) tags.push("salary:150k-200k");
          else if (row.salary_min >= 100000) tags.push("salary:100k-150k");
          else tags.push("salary:<100k");
        }

        // Entities from company and title (extract role keywords)
        const entities: string[] = [];
        if (row.company) entities.push(row.company);

        return {
          id: row.uid ?? String(row.id),
          source: "job-hunter",
          title: row.title ?? "",
          content,
          url: row.url ?? undefined,
          timestamp: row.scraped_at ?? row.posted_date ?? new Date().toISOString(),
          score: row.final_score ?? row.llm_score ?? row.keyword_score ?? undefined,
          tags,
          entities,
        };
      });
    } finally {
      db.close();
    }
  }

  /** Fetch learning resources from job-hunter (skills gap data). */
  async fetchLearningResources(): Promise<FeedItem[]> {
    const db = new Database(this.dbPath, { readonly: true });
    try {
      const rows = db.prepare("SELECT * FROM learning_resources").all() as any[];
      return rows.map((row) => ({
        id: `learn:${row.id}`,
        source: "job-hunter:learning",
        title: row.title ?? "",
        content: `Skill: ${row.skill}\nType: ${row.type}\nProvider: ${row.provider}\nDifficulty: ${row.difficulty ?? "unknown"}\nDuration: ${row.duration_hours ?? "?"}h\nFree: ${row.free ? "yes" : "no"}`,
        url: row.url ?? undefined,
        timestamp: row.last_verified ?? new Date().toISOString(),
        tags: [row.skill, row.type, row.provider, row.difficulty].filter(Boolean),
        entities: [row.skill],
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
