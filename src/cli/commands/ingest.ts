/** nexus ingest [--source=...] — run ingestion from connected sources. */
import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { ContentIndexer } from "../../knowledge/indexer.js";
import { EntityStore } from "../../knowledge/store.js";
import { LanceVectorStore } from "../../knowledge/vectors.js";
import { embedBatch } from "../../ingest/embeddings.js";
import { queueEnrichment, initEnrichmentTable } from "../../ingest/enrichment-worker.js";
import * as ingest from "../../ingest/index.js";

export async function ingestCommand(options?: { source?: string }): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const indexer = new ContentIndexer(db);

  // Initialize vector store and entity store
  const vectorStore = new LanceVectorStore(config.database.vectors);
  await vectorStore.init();
  const entityStore = new EntityStore(db);
  initEnrichmentTable(db);

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

  // RSSHub integration
  if (config.rsshub?.enabled && config.rsshub.routes?.length && (!options?.source || options.source === "rsshub")) {
    const rsshubFeeds = config.rsshub.routes.map((route) => `${config.rsshub.url}${route}`);
    const rsshubBridge = new ingest.RssBridge("rsshub", rsshubFeeds);
    adapters.push(rsshubBridge);
    ingest.register(rsshubBridge);
  }

  // Run ingestion with vector indexing
  for (const adapter of adapters) {
    const spinner = ora(`Ingesting from ${adapter.name}...`).start();
    try {
      const items = await adapter.fetch();
      const result = indexer.index(items);

      // Index vectors for new/updated items
      const toEmbed = items.filter((_, i) => i < result.added + result.updated);
      if (toEmbed.length > 0) {
        const vectors = embedBatch(toEmbed.map((item) => `${item.title} ${item.content}`));
        await vectorStore.upsert(toEmbed.map((item, i) => ({
          id: item.id,
          source: item.source,
          vector: vectors[i],
          content: item.content.slice(0, 1000),
          title: item.title,
        })));
      }

      // Queue new items for entity extraction
      const newItems = items.slice(0, result.added + result.updated);
      if (newItems.length > 0) {
        queueEnrichment(db, newItems);
      }

      spinner.succeed(`${adapter.name}: +${result.added} ~${result.updated} =${result.skipped} (${items.length} total, ${toEmbed.length} vectors, ${newItems.length} queued for enrichment)`);
    } catch (e: any) {
      spinner.fail(`${adapter.name}: ${e.message}`);
    }
  }

  console.log(chalk.gray("\n" + "─".repeat(50)));
  console.log(`Content indexed: ${chalk.green(indexer.count())}`);
  console.log(`Vectors indexed: ${chalk.green(await vectorStore.count())}`);
  closeDb(db);
}
