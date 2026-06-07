/** SQLite store for structured entities — skills, companies, roles, applications. */
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Entity, Relation, Fact } from "./types.js";

export class EntityStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.migrate();
  }

  /** Run schema migrations. */
  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        properties TEXT DEFAULT '{}',
        sources TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL REFERENCES entities(id),
        target_id TEXT NOT NULL REFERENCES entities(id),
        type TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        properties TEXT DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS facts (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id),
        predicate TEXT NOT NULL,
        value TEXT NOT NULL,
        valid_from TEXT NOT NULL,
        valid_to TEXT,
        source TEXT NOT NULL,
        confidence REAL DEFAULT 1.0
      );

      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
      CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);
      CREATE INDEX IF NOT EXISTS idx_facts_entity ON facts(entity_id);
    `);
  }

  /** Upsert an entity (insert or update by id). */
  upsertEntity(entity: Omit<Entity, "id" | "createdAt" | "updatedAt"> & { id?: string }): Entity {
    const now = new Date().toISOString();
    const id = entity.id ?? randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO entities (id, type, name, properties, sources, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        name = excluded.name,
        properties = excluded.properties,
        sources = excluded.sources,
        updated_at = excluded.updated_at
    `);
    stmt.run(id, entity.type, entity.name, JSON.stringify(entity.properties), JSON.stringify(entity.sources), now, now);
    return { ...entity, id, createdAt: now, updatedAt: now };
  }

  /** Get entity by ID. */
  getEntity(id: string): Entity | null {
    const row = this.db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      properties: JSON.parse(row.properties),
      sources: JSON.parse(row.sources),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /** Find entities by type. */
  findByType(type: string): Entity[] {
    const rows = this.db.prepare("SELECT * FROM entities WHERE type = ?").all(type) as any[];
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      properties: JSON.parse(row.properties),
      sources: JSON.parse(row.sources),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /** Add a relation between two entities. */
  addRelation(rel: Omit<Relation, "id" | "createdAt">): Relation {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO relations (id, source_id, target_id, type, weight, properties, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, rel.sourceId, rel.targetId, rel.type, rel.weight, JSON.stringify(rel.properties), now);
    return { ...rel, id, createdAt: now };
  }

  /** Add a temporally-valid fact. */
  addFact(fact: Omit<Fact, "id">): Fact {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO facts (id, entity_id, predicate, value, valid_from, valid_to, source, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, fact.entityId, fact.predicate, JSON.stringify(fact.value), fact.validFrom, fact.validTo ?? null, fact.source, fact.confidence);
    return { ...fact, id };
  }

  /** Get all facts for an entity, optionally only currently valid. */
  getFacts(entityId: string, onlyValid = true): Fact[] {
    const now = new Date().toISOString();
    const query = onlyValid
      ? "SELECT * FROM facts WHERE entity_id = ? AND (valid_to IS NULL OR valid_to > ?)"
      : "SELECT * FROM facts WHERE entity_id = ?";
    const rows = onlyValid
      ? (this.db.prepare(query).all(entityId, now) as any[])
      : (this.db.prepare(query).all(entityId) as any[]);

    return rows.map((row) => ({
      id: row.id,
      entityId: row.entity_id,
      predicate: row.predicate,
      value: JSON.parse(row.value),
      validFrom: row.valid_from,
      validTo: row.valid_to ?? undefined,
      source: row.source,
      confidence: row.confidence,
    }));
  }
}
