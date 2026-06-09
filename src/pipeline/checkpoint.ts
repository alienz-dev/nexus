/**
 * Checkpoint store — tracks high water mark + per-item completion for crash recovery.
 * Backed by SQLite.
 */
import type Database from "better-sqlite3";

export interface PipelineCheckpoint {
  pipelineId: string;
  cursor: string;
  completedItems: string[];
  lastRunAt: string;
  totalProcessed: number;
}

/**
 * Initialize the checkpoint table.
 */
export function initCheckpointTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_checkpoints (
      pipeline_id TEXT PRIMARY KEY,
      cursor TEXT DEFAULT '',
      completed_items TEXT DEFAULT '[]',
      last_run_at TEXT,
      total_processed INTEGER DEFAULT 0
    )
  `);
}

/**
 * Load checkpoint for a pipeline. Returns null if no checkpoint exists.
 */
export function loadCheckpoint(
  db: Database.Database,
  pipelineId: string,
): PipelineCheckpoint | null {
  const row = db
    .prepare("SELECT * FROM pipeline_checkpoints WHERE pipeline_id = ?")
    .get(pipelineId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    pipelineId: row.pipeline_id as string,
    cursor: (row.cursor as string) ?? "",
    completedItems: JSON.parse((row.completed_items as string) ?? "[]"),
    lastRunAt: row.last_run_at as string,
    totalProcessed: (row.total_processed as number) ?? 0,
  };
}

/**
 * Save checkpoint for a pipeline.
 */
export function saveCheckpoint(
  db: Database.Database,
  checkpoint: PipelineCheckpoint,
): void {
  db.prepare(
    `INSERT INTO pipeline_checkpoints (pipeline_id, cursor, completed_items, last_run_at, total_processed)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(pipeline_id) DO UPDATE SET
       cursor = excluded.cursor,
       completed_items = excluded.completed_items,
       last_run_at = excluded.last_run_at,
       total_processed = excluded.total_processed`,
  ).run(
    checkpoint.pipelineId,
    checkpoint.cursor,
    JSON.stringify(checkpoint.completedItems),
    checkpoint.lastRunAt,
    checkpoint.totalProcessed,
  );
}

/**
 * Mark an item as completed in the checkpoint.
 * Uses debounced saves (every N items) to avoid excessive DB writes.
 */
export class CheckpointManager {
  private checkpoint: PipelineCheckpoint;
  private saveCount = 0;
  private readonly saveInterval: number;

  constructor(
    private db: Database.Database,
    pipelineId: string,
    saveInterval = 10,
  ) {
    this.saveInterval = saveInterval;
    this.checkpoint = loadCheckpoint(db, pipelineId) ?? {
      pipelineId,
      cursor: "",
      completedItems: [],
      lastRunAt: "",
      totalProcessed: 0,
    };
  }

  /** Get the current cursor value. */
  getCursor(): string {
    return this.checkpoint.cursor;
  }

  /** Get the set of completed item IDs. */
  getCompleted(): Set<string> {
    return new Set(this.checkpoint.completedItems);
  }

  /** Check if an item has already been completed. */
  isCompleted(itemId: string): boolean {
    return this.checkpoint.completedItems.includes(itemId);
  }

  /** Mark an item as completed. Debounces saves. */
  markComplete(itemId: string): void {
    if (!this.checkpoint.completedItems.includes(itemId)) {
      this.checkpoint.completedItems.push(itemId);
      this.checkpoint.totalProcessed++;
    }
    this.saveCount++;
    if (this.saveCount >= this.saveInterval) {
      this.flush();
    }
  }

  /** Update the cursor value. */
  setCursor(cursor: string): void {
    this.checkpoint.cursor = cursor;
  }

  /** Force save to database. */
  flush(): void {
    this.checkpoint.lastRunAt = new Date().toISOString();
    saveCheckpoint(this.db, this.checkpoint);
    this.saveCount = 0;
  }
}
