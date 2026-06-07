/** nexus search <query> — search across all connected sources. */
import chalk from "chalk";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { UnifiedSearch } from "../../knowledge/search.js";
import { LanceVectorStore } from "../../knowledge/vectors.js";

export async function searchCommand(query: string, options?: { limit?: number }): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);

  // Initialize vector store if available
  let vectorStore: LanceVectorStore | undefined;
  try {
    vectorStore = new LanceVectorStore(config.database.vectors);
    await vectorStore.init();
  } catch {
    // Vector store not available — search without it
  }

  const search = new UnifiedSearch(db, config.search?.weights, config.search?.rrf_k, vectorStore);
  const results = await search.search({ query, limit: options?.limit ?? 10 });

  console.log(chalk.bold(`\nSearch: "${query}"\n`));
  console.log(chalk.gray("─".repeat(50)));

  if (results.length === 0) {
    console.log(chalk.yellow("No results found."));
  } else {
    for (const r of results) {
      console.log(`  ${chalk.green(r.item.id)} [${chalk.gray(r.source)}] score: ${r.score.toFixed(4)}`);
      const preview = r.item.content.slice(0, 100).replace(/\n/g, " ");
      console.log(`    ${chalk.dim(preview)}...`);
    }
  }

  console.log(chalk.gray("\n" + "─".repeat(50)));
  console.log(`${results.length} result(s)`);
  closeDb(db);
}
