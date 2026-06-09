/** nexus digest — daily/weekly summary in the terminal. */
import chalk from "../../lib/chalk.js";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { EntityStore } from "../../knowledge/store.js";
import { EntityResolver } from "../../knowledge/resolver.js";
import { ContentIndexer } from "../../knowledge/indexer.js";
import { UnifiedSearch } from "../../knowledge/search.js";
import { GapDetector } from "../../agents/gap-detector.js";
import { KnowledgeAuditor } from "../../agents/auditor.js";
import { AgentMemory } from "../../knowledge/memory.js";

export async function digestCommand(options?: { period?: "daily" | "weekly" }): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const store = new EntityStore(db);
  const resolver = new EntityResolver(db);
  const indexer = new ContentIndexer(db);
  const search = new UnifiedSearch(db, config.search?.weights, config.search?.rrf_k);
  const detector = new GapDetector(store, search, resolver);
  const auditor = new KnowledgeAuditor(store, indexer);
  const memory = new AgentMemory(db);

  const period = options?.period ?? "daily";
  const now = new Date();

  console.log(chalk.bold(`\n📊 Nexus ${period === "daily" ? "Daily" : "Weekly"} Digest`));
  console.log(chalk.dim(`  ${now.toISOString().split("T")[0]}\n`));
  console.log(chalk.gray("─".repeat(50)));

  // Stats
  console.log(chalk.bold("📈 Stats"));
  console.log(`  Content indexed: ${chalk.green(indexer.count())}`);
  console.log(`  Entities: ${chalk.green(store.findByType("skill").length)} skills, ${store.findByType("company").length} companies, ${store.findByType("role").length} roles`);
  console.log(`  Canonical: ${chalk.green(resolver.count())}`);
  console.log(`  Memories: ${chalk.green(memory.count())}`);

  // Trending topics
  console.log(chalk.bold("\n🔥 Trending (search highlights)"));
  const trending = ["AI agents", "machine learning", "LLM", "TypeScript", "Rust"];
  for (const topic of trending) {
    const results = search.bm25Search(topic, 3);
    if (results.length > 0) {
      console.log(`  ${chalk.cyan(topic)}: ${results.length} items`);
    }
  }

  // Skill gaps
  const { gaps } = await detector.detect();
  if (gaps.length > 0) {
    console.log(chalk.bold("\n⚠️  Top Skill Gaps"));
    for (const gap of gaps.slice(0, 5)) {
      console.log(`  ${chalk.yellow(gap.skill)}: gap ${gap.gap.toFixed(1)} (demand: ${gap.demandLevel.toFixed(1)})`);
    }
  } else {
    console.log(chalk.bold("\n✅ No skill gaps detected"));
  }

  // Health
  const { result: auditResult } = await auditor.audit();
  const duplicates = auditResult.findings.filter((f) => f.type === "duplicate_skill").length;
  const orphans = auditResult.findings.filter((f) => f.type === "orphan_entity").length;
  console.log(chalk.bold("\n🏥 Health"));
  console.log(`  Duplicate skills: ${duplicates > 0 ? chalk.yellow(duplicates) : chalk.green(0)}`);
  console.log(`  Orphan entities: ${orphans > 0 ? chalk.yellow(orphans) : chalk.green(0)}`);

  console.log(chalk.gray("\n" + "─".repeat(50)));
  closeDb(db);
}
