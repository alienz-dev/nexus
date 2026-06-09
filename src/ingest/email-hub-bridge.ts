/** Bridge adapter for email-hub — reads processed emails from the email-hub SQLite database. */
import Database from "better-sqlite3";
import type { BridgeAdapter, FeedItem } from "./types.js";

interface ProcessedEmail {
  message_id: string;
  sender: string;
  sender_domain: string;
  subject: string;
  category: string;
  urgency: string;
  summary: string;
  action_items: string | null;
  key_dates: string | null;
  key_amounts: string | null;
  suggested_action: string | null;
  rationale: string | null;
  red_flags: string | null;
  security_flags: string | null;
  processed_at: string;
  source_account: string | null;
}

export class EmailHubBridge implements BridgeAdapter {
  readonly name = "email-hub";
  private dbPath: string;
  private db: Database.Database | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  private getDb(): Database.Database {
    if (!this.db) {
      this.db = new Database(this.dbPath, { readonly: true });
    }
    return this.db;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const db = this.getDb();
      const row = db.prepare("SELECT COUNT(*) as cnt FROM processed_emails").get() as any;
      return row?.cnt > 0;
    } catch {
      return false;
    }
  }

  async fetch(since?: string): Promise<FeedItem[]> {
    const db = this.getDb();
    let rows: ProcessedEmail[];

    if (since) {
      rows = db.prepare(
        "SELECT * FROM processed_emails WHERE processed_at > ? ORDER BY processed_at ASC"
      ).all(since) as ProcessedEmail[];
    } else {
      rows = db.prepare(
        "SELECT * FROM processed_emails ORDER BY processed_at ASC"
      ).all() as ProcessedEmail[];
    }

    return rows.map((row) => {
      const contentParts = [
        `Category: ${row.category}`,
        `Urgency: ${row.urgency}`,
        `Summary: ${row.summary}`,
        row.action_items ? `Action Items: ${row.action_items}` : "",
        row.key_dates ? `Key Dates: ${row.key_dates}` : "",
        row.key_amounts ? `Key Amounts: ${row.key_amounts}` : "",
        row.suggested_action ? `Suggested Action: ${row.suggested_action}` : "",
        row.red_flags ? `Red Flags: ${row.red_flags}` : "",
      ].filter(Boolean);

      return {
        id: `email:${row.message_id}`,
        source: "email-hub",
        title: row.subject,
        content: contentParts.join("\n"),
        url: undefined,
        timestamp: row.processed_at,
        tags: [row.category, row.urgency].filter(Boolean),
        entities: [row.sender, row.sender_domain].filter(Boolean),
        links: [],
      };
    });
  }

  async count(): Promise<number> {
    try {
      const db = this.getDb();
      const row = db.prepare("SELECT COUNT(*) as cnt FROM processed_emails").get() as any;
      return row?.cnt ?? 0;
    } catch {
      return 0;
    }
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
}
