/** SQLite database setup and migrations. */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** Initialize a SQLite database at the given path. */
export function initDb(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

/** Close a database connection. */
export function closeDb(db: Database.Database): void {
  db.close();
}
