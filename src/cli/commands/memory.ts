/** nexus memory — manage agent memory (remember/recall/list). */
import chalk from "chalk";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { AgentMemory } from "../../knowledge/memory.js";

export async function memoryCommand(options?: { remember?: string; recall?: string; list?: boolean }): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const memory = new AgentMemory(db);

  if (options?.remember) {
    const mem = memory.remember(options.remember, "cli", 0.7);
    console.log(chalk.green(`Remembered: ${mem.id}`));
    console.log(`  Content: ${mem.content.slice(0, 100)}`);
    closeDb(db);
    return;
  }

  if (options?.recall) {
    const results = memory.recall(options.recall);
    console.log(chalk.bold(`\nRecall: "${options.recall}"\n`));
    console.log(chalk.gray("─".repeat(50)));
    if (results.length === 0) {
      console.log(chalk.yellow("No matching memories."));
    } else {
      for (const mem of results) {
        console.log(`  ${chalk.green(mem.id)} [importance: ${mem.importance.toFixed(2)}]`);
        console.log(`    ${mem.content.slice(0, 100)}`);
      }
    }
    console.log(chalk.gray("\n" + "─".repeat(50)));
    closeDb(db);
    return;
  }

  // Default: list memories
  const memories = memory.list(20);
  console.log(chalk.bold("\nNexus PKMS — Agent Memory\n"));
  console.log(chalk.gray("─".repeat(50)));
  console.log(`Total memories: ${chalk.green(memory.count())}`);

  if (memories.length > 0) {
    console.log(chalk.bold("\nRecent memories:"));
    for (const mem of memories) {
      console.log(`  ${chalk.green(mem.id.slice(0, 20))} [${mem.importance.toFixed(2)}] ${mem.content.slice(0, 80)}`);
    }
  }

  console.log(chalk.gray("\n" + "─".repeat(50)));
  closeDb(db);
}
