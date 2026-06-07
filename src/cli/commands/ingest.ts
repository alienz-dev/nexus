/** nexus ingest [--source=...] — run ingestion from connected sources. */
import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { ContentIndexer } from "../../knowledge/indexer.js";
import * as ingest from "../../ingest/index.js";

export async function ingestCommand(options?: { source?: string }): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const indexer = new ContentIndexer(db);

  console.log(chalk.bold("\nNexus PKMS Ingestion\n"));

  // Register adapters for configured sources
  const adapters: ingest.BridgeAdapter[] = [];
  const home = process.env.HOME ?? "";

  for (const [name, src] of Object.entries(config.sources ?? {})) {
    if (!src.enabled) continue;
    if (options?.source && name !== options.source) continue;

    const projectPath = src.path.replace("~", home);

    switch (name) {
      case "ai_feeds":
      case "ai-feeds": {
        const dbRel = src.db ?? "db/ai-feeds.sqlite";
        const bridge = new ingest.AiFeedsBridge(projectPath, dbRel);
        adapters.push(bridge);
        ingest.register(bridge);
        break;
      }
      case "job_hunter":
      case "job-hunter": {
        const dbRel = src.db ?? "data/job-hunter.sqlite";
        const bridge = new ingest.JobHunterBridge(projectPath, dbRel);
        adapters.push(bridge);
        ingest.register(bridge);
        break;
      }
      case "email_hub":
      case "email-hub": {
        const dbRel = src.db ?? "data/state.sqlite";
        const bridge = new ingest.EmailHubBridge(projectPath, dbRel);
        adapters.push(bridge);
        ingest.register(bridge);
        break;
      }
      case "vault": {
        const bridge = new ingest.VaultBridge(projectPath);
        adapters.push(bridge);
        ingest.register(bridge);
        break;
      }
      default:
        console.log(chalk.yellow(`  Unknown source: ${name}, skipping`));
    }
  }

  if (config.rss?.feeds?.length && (!options?.source || options.source === "rss")) {
    const rssBridge = new ingest.RssBridge("rss", config.rss.feeds);
    adapters.push(rssBridge);
    ingest.register(rssBridge);
  }

  // Run ingestion
  for (const adapter of adapters) {
    const spinner = ora(`Ingesting from ${adapter.name}...`).start();
    try {
      const items = await adapter.fetch();
      const result = indexer.index(items);
      spinner.succeed(`${adapter.name}: +${result.added} ~${result.updated} =${result.skipped} (${items.length} total)`);
    } catch (e: any) {
      spinner.fail(`${adapter.name}: ${e.message}`);
    }
  }

  console.log(chalk.gray("\n" + "─".repeat(50)));
  console.log(`Total indexed: ${chalk.green(indexer.count())}`);
  closeDb(db);
}
