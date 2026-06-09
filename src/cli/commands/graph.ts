/** nexus graph — show knowledge graph statistics. */
import chalk from "../../lib/chalk.js";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { EntityStore } from "../../knowledge/store.js";
import { KnowledgeGraph } from "../../knowledge/graph.js";

export async function graphCommand(): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const store = new EntityStore(db);
  const graph = new KnowledgeGraph(store, db);

  const stats = graph.stats();

  console.log(chalk.bold("\nNexus PKMS — Knowledge Graph\n"));
  console.log(chalk.gray("─".repeat(50)));
  console.log(`Entities: ${chalk.green(stats.entities)}`);
  console.log(`Relations: ${chalk.green(stats.relations)}`);
  console.log(`Communities: ${chalk.green(stats.communities)}`);

  if (stats.topEntities.length > 0) {
    console.log(chalk.bold("\nTop Entities (by degree):"));
    for (const e of stats.topEntities) {
      console.log(`  ${chalk.green(e.name)} [${chalk.dim(e.type)}] — ${e.degree} connections`);
    }
  }

  console.log(chalk.gray("\n" + "─".repeat(50)));
  closeDb(db);
}
