/** nexus watch — live feed monitoring with periodic ingestion. */
import chalk from "chalk";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { ContentIndexer } from "../../knowledge/indexer.js";
import { LanceVectorStore } from "../../knowledge/vectors.js";
import { embedBatch, getEmbeddingDim } from "../../ingest/embeddings.js";
import * as ingest from "../../ingest/index.js";

export async function watchCommand(options?: { interval?: number }): Promise<void> {
  const config = loadConfig();
  const interval = (options?.interval ?? 5) * 60 * 1000; // Default 5 minutes

  console.log(chalk.bold("\n👁  Nexus Watch — Live Feed Monitoring\n"));
  console.log(chalk.dim(`  Polling every ${options?.interval ?? 5} minutes. Press Ctrl+C to stop.\n`));

  const runCycle = async () => {
    const db = initDb(config.database.main);
    const indexer = new ContentIndexer(db);
    const vectorStore = new LanceVectorStore(config.database.vectors, getEmbeddingDim());
    await vectorStore.init();

    const adapters: ingest.BridgeAdapter[] = [];

    for (const [name, src] of Object.entries(config.sources ?? {})) {
      if (!src.enabled) continue;
      const projectPath = src.path;
      switch (name) {
        case "vault": adapters.push(new ingest.VaultBridge(projectPath)); break;
        case "github_stars": case "github-stars": {
          const gh = new ingest.GithubStarsBridge();
          if (await gh.isAvailable()) adapters.push(gh);
          break;
        }
      }
    }

    if (config.rss?.feeds?.length) {
      adapters.push(new ingest.RssBridge("rss", config.rss.feeds));
    }

    let totalNew = 0;
    for (const adapter of adapters) {
      try {
        const items = await adapter.fetch();
        const result = indexer.index(items);
        if (result.added > 0) {
          const toEmbed = items.slice(0, result.added);
          const vectors = await embedBatch(toEmbed.map((item) => `${item.title} ${item.content}`));
          await vectorStore.upsert(toEmbed.map((item, i) => ({
            id: item.id, source: item.source,
            vector: vectors[i],
            content: item.content.slice(0, 1000), title: item.title,
          })));
          console.log(`  ${chalk.green(adapter.name)}: +${result.added} new items`);
          totalNew += result.added;
        }
      } catch { /* skip failed sources */ }
    }

    if (totalNew > 0) {
      console.log(chalk.green(`\n  ✅ ${totalNew} new items at ${new Date().toLocaleTimeString()}\n`));
    } else {
      console.log(chalk.dim(`  ${new Date().toLocaleTimeString()} — no new items`));
    }

    closeDb(db);
  };

  // Run first cycle immediately
  await runCycle();

  // Schedule subsequent cycles
  setInterval(runCycle, interval);

  // Keep process alive
  await new Promise(() => {});
}
