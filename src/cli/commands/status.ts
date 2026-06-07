/** nexus status — show all connected sources and counts. */
import chalk from "chalk";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { ContentIndexer } from "../../knowledge/indexer.js";
import * as ingest from "../../ingest/index.js";

export async function statusCommand(): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const indexer = new ContentIndexer(db);

  console.log(chalk.bold("\nNexus PKMS Status\n"));
  console.log(chalk.gray("─".repeat(50)));

  // Indexed count
  console.log(`Indexed items: ${chalk.green(indexer.count())}`);

  // Source status
  console.log(chalk.bold("\nSources:"));
  for (const [name, src] of Object.entries(config.sources ?? {})) {
    const enabled = src.enabled ? chalk.green("enabled") : chalk.red("disabled");
    console.log(`  ${name}: ${enabled} (${src.path})`);
  }

  // RSS feeds
  if (config.rss?.feeds?.length) {
    console.log(chalk.bold("\nRSS Feeds:"));
    console.log(`  ${config.rss.feeds.length} feed(s) configured`);
  }

  console.log(chalk.gray("\n" + "─".repeat(50)));
  closeDb(db);
}
