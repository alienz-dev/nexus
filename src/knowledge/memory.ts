/** Agent memory layer — Cognee-style remember/recall/forget/improve operations.
 *  Provides structured memory management for long-running agents. */
import type Database from "better-sqlite3";

export interface Memory {
  id: string;
  content: string;
  context: string;
  importance: number; // 0-1
  accessCount: number;
  lastAccessed: string;
  createdAt: string;
  tags: string[];
}

/** Initialize the memories table. */
export function initMemoryTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      context TEXT DEFAULT '',
      importance REAL DEFAULT 0.5,
      access_count INTEGER DEFAULT 0,
      last_accessed TEXT NOT NULL,
      created_at TEXT NOT NULL,
      tags TEXT DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
    CREATE INDEX IF NOT EXISTS idx_memories_last_accessed ON memories(last_accessed DESC);
  `);
}

export class AgentMemory {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    initMemoryTable(db);
  }

  /** Remember — store new information with context. */
  remember(content: string, context: string, importance = 0.5, tags: string[] = []): Memory {
    const id = `mem:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO memories (id, content, context, importance, access_count, last_accessed, created_at, tags)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    `).run(id, content, context, importance, now, now, JSON.stringify(tags));

    return { id, content, context, importance, accessCount: 0, lastAccessed: now, createdAt: now, tags };
  }

  /** Recall — retrieve relevant memories for a query. */
  recall(query: string, limit = 10): Memory[] {
    // Simple keyword matching (would use vector search in production)
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const conditions = terms.map(() => "LOWER(content) LIKE ?").join(" OR ");
    const params = terms.map((t) => `%${t}%`);

    const rows = this.db.prepare(`
      SELECT * FROM memories
      WHERE ${conditions}
      ORDER BY importance DESC, last_accessed DESC
      LIMIT ?
    `).all(...params, limit) as any[];

    // Update access count
    const updateStmt = this.db.prepare("UPDATE memories SET access_count = access_count + 1, last_accessed = datetime('now') WHERE id = ?");
    for (const row of rows) {
      updateStmt.run(row.id);
    }

    return rows.map(this.parseRow);
  }

  /** Forget — remove outdated or irrelevant memories. */
  forget(id: string): boolean {
    const result = this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    return result.changes > 0;
  }

  /** Improve — update memory with new information. */
  improve(id: string, updates: { content?: string; importance?: number; tags?: string[] }): Memory | null {
    const existing = this.db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as any;
    if (!existing) return null;

    const content = updates.content ?? existing.content;
    const importance = updates.importance ?? existing.importance;
    const tags = updates.tags ? JSON.stringify(updates.tags) : existing.tags;

    this.db.prepare(`
      UPDATE memories SET content = ?, importance = ?, tags = ?, last_accessed = datetime('now') WHERE id = ?
    `).run(content, importance, tags, id);

    return this.parseRow({ ...existing, content, importance, tags });
  }

  /** Get all memories, sorted by importance. */
  list(limit = 50): Memory[] {
    const rows = this.db.prepare("SELECT * FROM memories ORDER BY importance DESC LIMIT ?").all(limit) as any[];
    return rows.map(this.parseRow);
  }

  /** Count total memories. */
  count(): number {
    return (this.db.prepare("SELECT COUNT(*) as cnt FROM memories").get() as any).cnt;
  }

  /** Decay — reduce importance of old, rarely-accessed memories. */
  decay(factor = 0.95): number {
    const result = this.db.prepare(`
      UPDATE memories SET importance = importance * ?
      WHERE last_accessed < datetime('now', '-7 days')
    `).run(factor);
    return result.changes;
  }

  private parseRow(row: any): Memory {
    return {
      id: row.id,
      content: row.content,
      context: row.context,
      importance: row.importance,
      accessCount: row.access_count,
      lastAccessed: row.last_accessed,
      createdAt: row.created_at,
      tags: JSON.parse(row.tags),
    };
  }
}
