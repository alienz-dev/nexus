/** nexus gaps — show skill gaps detected by comparing knowledge vs job market. */
import chalk from "../../lib/chalk.js";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { EntityStore } from "../../knowledge/store.js";
import { EntityResolver } from "../../knowledge/resolver.js";
import { UnifiedSearch } from "../../knowledge/search.js";
import { GapDetector } from "../../agents/gap-detector.js";

export async function gapsCommand(): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const store = new EntityStore(db);
  const resolver = new EntityResolver(db);
  const search = new UnifiedSearch(db, config.search?.weights, config.search?.rrf_k);
  const detector = new GapDetector(store, search, resolver);

  console.log(chalk.bold("\nNexus PKMS — Skill Gaps\n"));

  const { gaps, result } = await detector.detect();

  if (gaps.length === 0) {
    console.log(chalk.green("No skill gaps detected — skills match market demand."));
  } else {
    console.log(chalk.gray("─".repeat(50)));
    for (const gap of gaps.slice(0, 20)) {
      const bar = "█".repeat(Math.round(gap.currentLevel)) + "░".repeat(Math.round(gap.gap));
      console.log(`  ${chalk.bold(gap.skill)}`);
      console.log(`    Current: ${gap.currentLevel.toFixed(1)}  Demand: ${gap.demandLevel.toFixed(1)}  Gap: ${chalk.red(gap.gap.toFixed(1))}`);
      console.log(`    [${bar}]`);
    }
    if (gaps.length > 20) {
      console.log(chalk.dim(`  ... and ${gaps.length - 20} more`));
    }
    console.log(chalk.gray("─".repeat(50)));
    console.log(`${gaps.length} gap(s) detected in ${result.durationMs}ms`);
  }

  closeDb(db);
}
