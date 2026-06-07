/** Entity resolution — canonical ID registry with fuzzy matching.
 *  Implements ADR-008: prevents "React vs reactjs vs React.js" fragmentation. */
import type Database from "better-sqlite3";

export interface CanonicalEntity {
  id: string;
  canonicalName: string;
  type: string;
  aliases: string[];
  sourceIds: string[];
}

/** Initialize the canonical_entities table. */
export function initResolverTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS canonical_entities (
      id TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      type TEXT NOT NULL,
      aliases TEXT DEFAULT '[]',
      source_ids TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_canonical_type ON canonical_entities(type);
    CREATE INDEX IF NOT EXISTS idx_canonical_name ON canonical_entities(canonical_name);
  `);
}

export class EntityResolver {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    initResolverTable(db);
  }

  /** Find a canonical entity by name (exact or alias match). */
  find(name: string, type?: string): CanonicalEntity | null {
    const lower = name.toLowerCase();

    // Try exact canonical name match
    let row = type
      ? this.db.prepare("SELECT * FROM canonical_entities WHERE LOWER(canonical_name) = ? AND type = ?").get(lower, type) as any
      : this.db.prepare("SELECT * FROM canonical_entities WHERE LOWER(canonical_name) = ?").get(lower) as any;

    if (row) return this.parseRow(row);

    // Try alias match
    const all = type
      ? this.db.prepare("SELECT * FROM canonical_entities WHERE type = ?").all(type) as any[]
      : this.db.prepare("SELECT * FROM canonical_entities").all() as any[];

    for (const r of all) {
      const aliases: string[] = JSON.parse(r.aliases);
      if (aliases.some((a) => a.toLowerCase() === lower)) {
        return this.parseRow(r);
      }
    }

    return null;
  }

  /** Register a new canonical entity or add an alias to an existing one. */
  register(canonicalName: string, type: string, alias?: string, sourceId?: string): CanonicalEntity {
    const existing = this.find(canonicalName, type);

    if (existing) {
      // Add alias and source if new
      const aliases = new Set(existing.aliases);
      if (alias) aliases.add(alias.toLowerCase());
      const sources = new Set(existing.sourceIds);
      if (sourceId) sources.add(sourceId);

      this.db.prepare(`
        UPDATE canonical_entities SET aliases = ?, source_ids = ?, updated_at = datetime('now') WHERE id = ?
      `).run(JSON.stringify([...aliases]), JSON.stringify([...sources]), existing.id);

      return { ...existing, aliases: [...aliases], sourceIds: [...sources] };
    }

    // Create new canonical entity
    const id = `canonical:${type}:${canonicalName.toLowerCase().replace(/\s+/g, "_")}`;
    const aliases = alias ? [alias.toLowerCase()] : [];
    const sources = sourceId ? [sourceId] : [];

    this.db.prepare(`
      INSERT INTO canonical_entities (id, canonical_name, type, aliases, source_ids, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, canonicalName, type, JSON.stringify(aliases), JSON.stringify(sources));

    return { id, canonicalName, type, aliases, sourceIds: sources };
  }

  /** Resolve a name to its canonical form. Returns the canonical name if found, or the original name. */
  resolve(name: string, type?: string): string {
    const found = this.find(name, type);
    return found?.canonicalName ?? name;
  }

  /** Get all canonical entities of a given type. */
  listByType(type: string): CanonicalEntity[] {
    const rows = this.db.prepare("SELECT * FROM canonical_entities WHERE type = ?").all(type) as any[];
    return rows.map(this.parseRow);
  }

  /** Get total count. */
  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM canonical_entities").get() as any;
    return row.cnt;
  }

  /** Seed from known taxonomies (O*NET skills, known companies). */
  seed(): void {
    // Common skill aliases
    const skillAliases: [string, string[]][] = [
      ["javascript", ["js", "ecmascript"]],
      ["typescript", ["ts"]],
      ["python", ["py"]],
      ["golang", ["go"]],
      ["kubernetes", ["k8s"]],
      ["postgresql", ["postgres", "psql"]],
      ["mongodb", ["mongo"]],
      ["react", ["reactjs", "react.js"]],
      ["vue", ["vuejs", "vue.js"]],
      ["angular", ["angularjs"]],
      ["nextjs", ["next.js", "next"]],
      ["nodejs", ["node.js", "node"]],
      ["tensorflow", ["tf"]],
      ["pytorch", ["torch"]],
      ["amazon web services", ["aws"]],
      ["google cloud platform", ["gcp"]],
      ["microsoft azure", ["azure"]],
      ["continuous integration", ["ci"]],
      ["continuous deployment", ["cd"]],
      ["ci/cd", ["cicd"]],
      ["machine learning", ["ml"]],
      ["artificial intelligence", ["ai"]],
      ["natural language processing", ["nlp"]],
      ["computer vision", ["cv"]],
      ["large language model", ["llm", "llms"]],
    ];

    for (const [canonical, aliases] of skillAliases) {
      this.register(canonical, "skill");
      for (const alias of aliases) {
        this.register(canonical, "skill", alias);
      }
    }
  }

  private parseRow(row: any): CanonicalEntity {
    return {
      id: row.id,
      canonicalName: row.canonical_name,
      type: row.type,
      aliases: JSON.parse(row.aliases),
      sourceIds: JSON.parse(row.source_ids),
    };
  }
}
