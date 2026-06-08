/** Knowledge graph — entity-relation graph with community detection.
 *  Implements LightRAG-style entity extraction and graph construction. */
import type Database from "better-sqlite3";
import type { Entity, Relation } from "./types.js";
import { EntityStore } from "./store.js";
import { extractEntities } from "../ingest/extractors/orchestrator.js";

export interface GraphStats {
  entities: number;
  relations: number;
  communities: number;
  topEntities: Array<{ name: string; type: string; degree: number }>;
}

export class KnowledgeGraph {
  private store: EntityStore;
  private db: Database.Database;

  constructor(store: EntityStore, db: Database.Database) {
    this.store = store;
    this.db = db;
  }

  /** Build graph from content — extract entities and create relations. */
  async buildFromContent(items: Array<{ id: string; source: string; title: string; content: string }>): Promise<{
    entitiesAdded: number;
    relationsAdded: number;
  }> {
    let entitiesAdded = 0;
    let relationsAdded = 0;

    for (const item of items) {
      const entities = await extractEntities(`${item.title} ${item.content}`);

      // Store entities
      const entityIds: string[] = [];
      for (const e of entities) {
        const stored = this.store.upsertEntity({
          type: e.type,
          name: e.name,
          properties: { confidence: e.confidence, source: e.source },
          sources: [`${item.source}:${item.id}`],
        });
        entityIds.push(stored.id);
        entitiesAdded++;
      }

      // Create co-occurrence relations (entities that appear in the same content)
      for (let i = 0; i < entityIds.length; i++) {
        for (let j = i + 1; j < entityIds.length; j++) {
          this.store.addRelation({
            sourceId: entityIds[i],
            targetId: entityIds[j],
            type: "co_occurs",
            weight: 1.0,
            properties: { context: `${item.source}:${item.id}` },
          });
          relationsAdded++;
        }
      }
    }

    return { entitiesAdded, relationsAdded };
  }

  /** Get graph statistics. */
  stats(): GraphStats {
    const entityCount = (this.db.prepare("SELECT COUNT(*) as cnt FROM entities").get() as any).cnt;
    const relationCount = (this.db.prepare("SELECT COUNT(*) as cnt FROM relations").get() as any).cnt;

    // Top entities by relation count (degree)
    const topEntities = this.db.prepare(`
      SELECT e.name, e.type, COUNT(r.id) as degree
      FROM entities e
      LEFT JOIN relations r ON r.source_id = e.id OR r.target_id = e.id
      GROUP BY e.id
      ORDER BY degree DESC
      LIMIT 10
    `).all() as any[];

    return {
      entities: entityCount,
      relations: relationCount,
      communities: 0, // Placeholder: Leiden community detection
      topEntities: topEntities.map((e) => ({
        name: e.name,
        type: e.type,
        degree: e.degree,
      })),
    };
  }

  /** Find entities related to a given entity. */
  findRelated(entityId: string, depth = 1): Entity[] {
    const visited = new Set<string>();
    const result: Entity[] = [];

    const traverse = (id: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);

      const relations = this.db.prepare(`
        SELECT target_id FROM relations WHERE source_id = ?
        UNION
        SELECT source_id FROM relations WHERE target_id = ?
      `).all(id, id) as any[];

      for (const rel of relations) {
        const targetId = rel.target_id ?? rel.source_id;
        if (!visited.has(targetId)) {
          const entity = this.store.getEntity(targetId);
          if (entity) {
            result.push(entity);
            traverse(targetId, currentDepth + 1);
          }
        }
      }
    };

    traverse(entityId, 0);
    return result;
  }
}
