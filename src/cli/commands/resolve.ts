/** nexus resolve — manage the canonical entity registry. */
import chalk from "chalk";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { EntityResolver } from "../../knowledge/resolver.js";

export async function resolveCommand(options?: { seed?: boolean; lookup?: string }): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const resolver = new EntityResolver(db);

  if (options?.seed) {
    resolver.seed();
    console.log(chalk.green(`Seeded canonical entities. Total: ${resolver.count()}`));
    closeDb(db);
    return;
  }

  if (options?.lookup) {
    const result = resolver.find(options.lookup);
    if (result) {
      console.log(chalk.bold(`\nResolved: "${options.lookup}"`));
      console.log(`  Canonical: ${chalk.green(result.canonicalName)}`);
      console.log(`  Type: ${result.type}`);
      console.log(`  Aliases: ${result.aliases.join(", ") || "(none)"}`);
      console.log(`  Sources: ${result.sourceIds.length}`);
    } else {
      console.log(chalk.yellow(`"${options.lookup}" not found in canonical registry.`));
    }
    closeDb(db);
    return;
  }

  // Default: show stats
  console.log(chalk.bold("\nNexus PKMS — Canonical Entity Registry\n"));
  console.log(chalk.gray("─".repeat(50)));
  console.log(`Total canonical entities: ${chalk.green(resolver.count())}`);

  const skills = resolver.listByType("skill");
  const companies = resolver.listByType("company");
  console.log(`  Skills: ${skills.length}`);
  console.log(`  Companies: ${companies.length}`);

  if (skills.length > 0) {
    console.log(chalk.bold("\nSample skills:"));
    for (const s of skills.slice(0, 10)) {
      const aliases = s.aliases.length > 0 ? ` (${s.aliases.join(", ")})` : "";
      console.log(`  ${chalk.green(s.canonicalName)}${chalk.dim(aliases)}`);
    }
  }

  console.log(chalk.gray("\n" + "─".repeat(50)));
  closeDb(db);
}
