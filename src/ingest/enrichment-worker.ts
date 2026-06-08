/** Enrichment worker — processes pending FeedItems through the entity extraction pipeline.
 *  Runs asynchronously after minimal sync ingestion (two-phase pattern, ADR-006). */
import type Database from "better-sqlite3";
import type { FeedItem } from "./types.js";
import { extractEntities, extractFacts } from "./extractors/orchestrator.js";
import { EntityStore } from "../knowledge/store.js";

export interface EnrichmentResult {
  processed: number;
  entitiesExtracted: number;
  factsExtracted: number;
  errors: number;
}

/** Initialize the enrichment_jobs table if it doesn't exist. */
export function initEnrichmentTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS enrichment_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'done', 'failed')),
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      processed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_enrichment_status ON enrichment_jobs(status);
  `);
}

/** Queue items for enrichment. */
export function queueEnrichment(db: Database.Database, items: FeedItem[]): number {
  const stmt = db.prepare(`
    INSERT INTO enrichment_jobs (item_id, source, content, title, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', datetime('now'))
  `);

  const tx = db.transaction(() => {
    for (const item of items) {
      stmt.run(item.id, item.source, item.content.slice(0, 5000), item.title);
    }
  });
  tx();
  return items.length;
}

/** Process pending enrichment jobs. */
export async function processEnrichment(
  db: Database.Database,
  entityStore: EntityStore,
  limit = 50
): Promise<EnrichmentResult> {
  initEnrichmentTable(db);

  const pending = db.prepare(
    "SELECT * FROM enrichment_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?"
  ).all(limit) as any[];

  let processed = 0;
  let entitiesExtracted = 0;
  let factsExtracted = 0;
  let errors = 0;

  for (const job of pending) {
    try {
      const text = `${job.title} ${job.content}`;
      const entities = await extractEntities(text);
      const facts = extractFacts(text);

      // Store extracted entities, create co-occurrence relations, and store facts
      const storeTx = db.transaction(() => {
        const entityIds: string[] = [];
        for (const entity of entities) {
          const stored = entityStore.upsertEntity({
            type: entity.type,
            name: entity.name,
            properties: { confidence: entity.confidence, source: entity.source },
            sources: [`${job.source}:${job.item_id}`],
          });
          entityIds.push(stored.id);
          entitiesExtracted++;
        }

        // Create co-occurrence relations between all entity pairs in this content
        for (let i = 0; i < entityIds.length; i++) {
          for (let j = i + 1; j < entityIds.length; j++) {
            entityStore.addRelation({
              sourceId: entityIds[i],
              targetId: entityIds[j],
              type: "co_occurs",
              weight: 1.0,
              properties: { context: `${job.source}:${job.item_id}` },
            });
          }
        }

        // Store extracted facts
        for (const fact of facts) {
          // Find the entity this fact belongs to
          const entity = entityStore.findByName(fact.entityName, "skill");
          if (entity) {
            entityStore.addFact({
              entityId: entity.id,
              predicate: fact.predicate,
              value: fact.value,
              validFrom: new Date().toISOString(),
              source: `${job.source}:${job.item_id}`,
              confidence: fact.confidence,
            });
            factsExtracted++;
          }
        }
      });
      storeTx();

      db.prepare("UPDATE enrichment_jobs SET status = 'done', processed_at = datetime('now') WHERE id = ?")
        .run(job.id);
      processed++;
    } catch (e: any) {
      db.prepare("UPDATE enrichment_jobs SET status = 'failed', error = ?, processed_at = datetime('now') WHERE id = ?")
        .run(e.message, job.id);
      errors++;
    }
  }

  return { processed, entitiesExtracted, factsExtracted, errors };
}

/** Get enrichment queue stats. */
export function enrichmentStats(db: Database.Database): { pending: number; done: number; failed: number } {
  try {
    const row = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM enrichment_jobs
    `).get() as any;
    return {
      pending: row?.pending ?? 0,
      done: row?.done ?? 0,
      failed: row?.failed ?? 0,
    };
  } catch {
    return { pending: 0, done: 0, failed: 0 };
  }
}
