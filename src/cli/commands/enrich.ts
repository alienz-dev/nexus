/** nexus enrich — process pending entity extraction jobs. */
import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { EntityStore } from "../../knowledge/store.js";
import { processEnrichment, enrichmentStats } from "../../ingest/enrichment-worker.js";

export async function enrichCommand(options?: { limit?: number }): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const entityStore = new EntityStore(db);

  const stats = enrichmentStats(db);
  console.log(chalk.bold("\nNexus PKMS Enrichment\n"));
  console.log(chalk.gray("─".repeat(50)));
  console.log(`Pending: ${chalk.yellow(stats.pending)} | Done: ${chalk.green(stats.done)} | Failed: ${chalk.red(stats.failed)}`);

  if (stats.pending === 0) {
    console.log(chalk.dim("\nNo pending enrichment jobs."));
    closeDb(db);
    return;
  }

  const spinner = ora(`Processing ${Math.min(stats.pending, options?.limit ?? 50)} jobs...`).start();
  const result = await processEnrichment(db, entityStore, options?.limit ?? 50);
  spinner.succeed(`Processed: ${result.processed} | Entities: ${result.entitiesExtracted} | Errors: ${result.errors}`);

  const afterStats = enrichmentStats(db);
  console.log(chalk.gray("\n" + "─".repeat(50)));
  console.log(`Remaining: ${chalk.yellow(afterStats.pending)}`);
  closeDb(db);
}
