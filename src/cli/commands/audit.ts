/** nexus audit — run knowledge graph audit. */
import chalk from "../../lib/chalk.js";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { EntityStore } from "../../knowledge/store.js";
import { ContentIndexer } from "../../knowledge/indexer.js";
import { KnowledgeAuditor } from "../../agents/auditor.js";

export async function auditCommand(): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const store = new EntityStore(db);
  const indexer = new ContentIndexer(db);
  const auditor = new KnowledgeAuditor(store, indexer);

  console.log(chalk.bold("\nNexus PKMS — Knowledge Audit\n"));

  const { result } = await auditor.audit();

  console.log(chalk.gray("─".repeat(50)));
  console.log(`Entities audited: ${result.entitiesAudited}`);
  console.log(`Findings: ${chalk.yellow(result.findings.length)}`);

  if (result.findings.length === 0) {
    console.log(chalk.green("\nNo issues found — knowledge graph is healthy."));
  } else {
    // Group by type
    const byType = new Map<string, typeof result.findings>();
    for (const f of result.findings) {
      const group = byType.get(f.type) ?? [];
      group.push(f);
      byType.set(f.type, group);
    }

    for (const [type, findings] of byType) {
      const icon = type === "orphan_entity" ? "🔵" : type === "duplicate_skill" ? "🟡" : "⚪";
      console.log(`\n${icon} ${chalk.bold(type)} (${findings.length})`);
      for (const f of findings.slice(0, 5)) {
        console.log(`  ${chalk.dim(f.entity)}: ${f.description}`);
        console.log(`    ${chalk.dim("→")} ${f.suggestion}`);
      }
      if (findings.length > 5) {
        console.log(chalk.dim(`  ... and ${findings.length - 5} more`));
      }
    }
  }

  console.log(chalk.gray("\n" + "─".repeat(50)));
  console.log(`Completed in ${result.durationMs}ms`);
  closeDb(db);
}
