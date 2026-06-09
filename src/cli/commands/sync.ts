/** nexus sync — sync nexus data to Obsidian vault. */
import chalk from "../../lib/chalk.js";
import { writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { EntityStore } from "../../knowledge/store.js";
import { EntityResolver } from "../../knowledge/resolver.js";
import { ContentIndexer } from "../../knowledge/indexer.js";
import { UnifiedSearch } from "../../knowledge/search.js";
import { GapDetector } from "../../agents/gap-detector.js";
import { KnowledgeAuditor } from "../../agents/auditor.js";

export async function syncCommand(options?: { target?: string }): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const store = new EntityStore(db);
  const resolver = new EntityResolver(db);
  const indexer = new ContentIndexer(db);
  const search = new UnifiedSearch(db, config.search?.weights, config.search?.rrf_k);
  const detector = new GapDetector(store, search, resolver);
  const auditor = new KnowledgeAuditor(store, indexer);

  // Target: vault/nexus/ subdirectory
  const vaultPath = config.sources?.vault?.path ?? "~/vault";
  const targetDir = options?.target ?? resolve(vaultPath, "nexus");

  console.log(chalk.bold(`\nNexus Sync → ${targetDir}\n`));
  console.log(chalk.gray("─".repeat(50)));

  // Create directories
  for (const sub of ["skills", "gaps", "digests", "audits"]) {
    const dir = resolve(targetDir, sub);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  // 1. Sync skill entities as Obsidian notes
  const skills = store.findByType("skill");
  const { gaps } = await detector.detect();
  const gapMap = new Map(gaps.map((g) => [g.skill, g]));
  const seen = new Set<string>();
  let skillsSynced = 0;

  for (const skill of skills) {
    const canonical = resolver.resolve(skill.name, "skill");
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const level = (skill.properties as any)?.level ?? 0;
    const gap = gapMap.get(canonical);
    const tags = ["nexus", "skill"];
    if (gap) tags.push("skill-gap");

    let content = `---\ntype: skill\n`;
    content += `name: "${canonical}"\n`;
    content += `level: ${level}\n`;
    if (gap) content += `gap: ${gap.gap.toFixed(1)}\n`;
    content += `tags:\n${tags.map((t) => `  - ${t}`).join("\n")}\n`;
    content += `last_updated: ${new Date().toISOString()}\n`;
    content += `---\n\n`;
    content += `# ${canonical}\n\n`;
    content += `| Metric | Value |\n|--------|-------|\n`;
    content += `| Level | ${level}/10 |\n`;
    if (gap) content += `| Demand | ${gap.demandLevel.toFixed(1)}/10 |\n| Gap | ${gap.gap.toFixed(1)} |\n`;
    content += `| Sources | ${skill.sources.length} |\n`;

    const fileName = canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".md";
    writeFileSync(resolve(targetDir, "skills", fileName), content, "utf-8");
    skillsSynced++;
  }

  // 2. Sync gap analysis
  if (gaps.length > 0) {
    let content = `---\ntype: gap-analysis\n`;
    content += `date: ${new Date().toISOString().split("T")[0]}\n`;
    content += `tags:\n  - nexus\n  - gaps\n---\n\n`;
    content += `# Skill Gap Analysis\n\n`;
    content += `Generated: ${new Date().toISOString()}\n\n`;
    content += `## Top Gaps\n\n`;
    for (const gap of gaps.slice(0, 20)) {
      content += `- **${gap.skill}**: gap ${gap.gap.toFixed(1)} (current: ${gap.currentLevel.toFixed(1)}, demand: ${gap.demandLevel.toFixed(1)})\n`;
    }
    writeFileSync(resolve(targetDir, "gaps", "skill-gaps.md"), content, "utf-8");
  }

  // 3. Sync digest
  const stats = {
    content: indexer.count(),
    entities: store.findByType("skill").length,
    canonical: resolver.count(),
    gaps: gaps.length,
  };

  let digestContent = `---\ntype: nexus-digest\n`;
  digestContent += `date: ${new Date().toISOString().split("T")[0]}\n`;
  digestContent += `tags:\n  - nexus\n  - digest\n---\n\n`;
  digestContent += `# Nexus Digest\n\n`;
  digestContent += `## Stats\n\n`;
  digestContent += `- Content indexed: ${stats.content}\n`;
  digestContent += `- Skill entities: ${stats.entities}\n`;
  digestContent += `- Canonical entities: ${stats.canonical}\n`;
  digestContent += `- Skill gaps: ${stats.gaps}\n`;

  const digestFile = `digest-${new Date().toISOString().split("T")[0]}.md`;
  writeFileSync(resolve(targetDir, "digests", digestFile), digestContent, "utf-8");

  // 4. Sync audit
  const { result: auditResult } = await auditor.audit();
  let auditContent = `---\ntype: nexus-audit\n`;
  auditContent += `date: ${new Date().toISOString().split("T")[0]}\n`;
  auditContent += `tags:\n  - nexus\n  - audit\n---\n\n`;
  auditContent += `# Knowledge Audit\n\n`;
  auditContent += `- Entities audited: ${auditResult.entitiesAudited}\n`;
  auditContent += `- Findings: ${auditResult.findings.length}\n`;
  auditContent += `- Duplicates: ${auditResult.findings.filter((f) => f.type === "duplicate_skill").length}\n`;
  auditContent += `- Orphans: ${auditResult.findings.filter((f) => f.type === "orphan_entity").length}\n`;

  const auditFile = `audit-${new Date().toISOString().split("T")[0]}.md`;
  writeFileSync(resolve(targetDir, "audits", auditFile), auditContent, "utf-8");

  console.log(`  Skills synced: ${chalk.green(skillsSynced)}`);
  console.log(`  Gap analysis: ${chalk.green(gaps.length > 0 ? "yes" : "no")}`);
  console.log(`  Digest: ${chalk.green(digestFile)}`);
  console.log(`  Audit: ${chalk.green(auditFile)}`);
  console.log(chalk.dim(`\n  Open in Obsidian: ${targetDir}`));

  console.log(chalk.gray("\n" + "─".repeat(50)));
  closeDb(db);
}
