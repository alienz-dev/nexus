/** nexus export — export knowledge to various formats. */
import chalk from "chalk";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { EntityStore } from "../../knowledge/store.js";
import { EntityResolver } from "../../knowledge/resolver.js";
import { GapDetector } from "../../agents/gap-detector.js";
import { UnifiedSearch } from "../../knowledge/search.js";

export async function exportCommand(options: {
  format: "anki" | "markdown" | "json" | "csv";
  output?: string;
  type?: string;
}): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const store = new EntityStore(db);
  const resolver = new EntityResolver(db);
  const search = new UnifiedSearch(db, config.search?.weights, config.search?.rrf_k);
  const detector = new GapDetector(store, search, resolver);

  const outputDir = options.output ?? resolve(process.cwd(), "data/export");
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  console.log(chalk.bold(`\nNexus Export — ${options.format}\n`));

  switch (options.format) {
    case "anki":
      await exportAnki(store, resolver, detector, outputDir);
      break;
    case "markdown":
      await exportMarkdown(store, resolver, detector, outputDir);
      break;
    case "json":
      await exportJson(store, resolver, detector, outputDir);
      break;
    case "csv":
      await exportCsv(store, resolver, detector, outputDir);
      break;
  }

  console.log(chalk.gray("─".repeat(50)));
  closeDb(db);
}

/** Export to Anki-compatible tab-separated format.
 *  Import into Anki: File → Import → select the .tsv file */
async function exportAnki(
  store: EntityStore,
  resolver: EntityResolver,
  detector: GapDetector,
  outputDir: string
): Promise<void> {
  const skills = store.findByType("skill");
  const { gaps } = await detector.detect();
  const gapSkills = new Set(gaps.map((g) => g.skill));

  // Deduplicate using canonical names
  const seen = new Set<string>();
  const cards: Array<{ front: string; back: string; tags: string[] }> = [];

  for (const skill of skills) {
    const canonical = resolver.resolve(skill.name, "skill");
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const level = (skill.properties as any)?.level ?? 0;
    const demand = (skill.properties as any)?.demand ?? 0;
    const isGap = gapSkills.has(canonical);

    // Front: skill name
    const front = canonical;

    // Back: details
    const parts = [`Type: skill`];
    if (level) parts.push(`Level: ${level}/10`);
    if (demand) parts.push(`Demand: ${demand}/10`);
    if (isGap) parts.push(`⚠️ SKILL GAP`);
    if (skill.sources.length > 0) parts.push(`Sources: ${skill.sources.slice(0, 3).join(", ")}`);
    const back = parts.join("\n");

    // Tags
    const tags = ["nexus", "skill"];
    if (isGap) tags.push("gap");
    if (level >= 7) tags.push("strong");
    if (level <= 3) tags.push("weak");

    cards.push({ front, back, tags });
  }

  // Also export companies
  const companies = store.findByType("company");
  for (const company of companies) {
    const canonical = resolver.resolve(company.name, "company");
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    cards.push({
      front: canonical,
      back: `Type: company\nSources: ${company.sources.slice(0, 3).join(", ")}`,
      tags: ["nexus", "company"],
    });
  }

  // Write as TSV (front\tback\ttags)
  const lines = cards.map((c) => `${c.front}\t${c.back}\t${c.tags.join(" ")}`);
  const filePath = resolve(outputDir, "nexus-anki.tsv");
  writeFileSync(filePath, lines.join("\n"), "utf-8");
  console.log(`  ${chalk.green(cards.length)} cards exported to ${filePath}`);
  console.log(chalk.dim("  Import: Anki → File → Import → select nexus-anki.tsv"));
}

/** Export to Obsidian-compatible markdown notes. */
async function exportMarkdown(
  store: EntityStore,
  resolver: EntityResolver,
  detector: GapDetector,
  outputDir: string
): Promise<void> {
  const { gaps } = await detector.detect();
  const gapMap = new Map(gaps.map((g) => [g.skill, g]));

  // Export skill entities as individual notes
  const skills = store.findByType("skill");
  const seen = new Set<string>();
  let count = 0;

  for (const skill of skills) {
    const canonical = resolver.resolve(skill.name, "skill");
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const level = (skill.properties as any)?.level ?? 0;
    const gap = gapMap.get(canonical);

    let content = `---\ntype: skill\nname: "${canonical}"\nlevel: ${level}\ntags:\n  - nexus\n  - skill\n---\n\n# ${canonical}\n\n`;
    content += `- **Level:** ${level}/10\n`;
    if (gap) content += `- **Gap:** ${gap.gap.toFixed(1)} (demand: ${gap.demandLevel.toFixed(1)})\n`;
    if (skill.sources.length > 0) content += `- **Sources:** ${skill.sources.slice(0, 5).join(", ")}\n`;

    const fileName = canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".md";
    const filePath = resolve(outputDir, "skills", fileName);
    if (!existsSync(resolve(outputDir, "skills"))) mkdirSync(resolve(outputDir, "skills"), { recursive: true });
    writeFileSync(filePath, content, "utf-8");
    count++;
  }

  // Export gap analysis
  if (gaps.length > 0) {
    let gapContent = `---\ntype: gap-analysis\ndate: ${new Date().toISOString().split("T")[0]}\ntags:\n  - nexus\n  - gaps\n---\n\n# Skill Gap Analysis\n\n`;
    for (const gap of gaps) {
      gapContent += `- **${gap.skill}**: gap ${gap.gap.toFixed(1)} (current: ${gap.currentLevel.toFixed(1)}, demand: ${gap.demandLevel.toFixed(1)})\n`;
    }
    const gapPath = resolve(outputDir, "skill-gaps.md");
    writeFileSync(gapPath, gapContent, "utf-8");
  }

  console.log(`  ${chalk.green(count)} skill notes exported to ${resolve(outputDir, "skills")}`);
  if (gaps.length > 0) console.log(`  Gap analysis: ${resolve(outputDir, "skill-gaps.md")}`);
}

/** Export to JSON. */
async function exportJson(
  store: EntityStore,
  resolver: EntityResolver,
  detector: GapDetector,
  outputDir: string
): Promise<void> {
  const skills = store.findByType("skill");
  const companies = store.findByType("company");
  const roles = store.findByType("role");
  const { gaps } = await detector.detect();

  const data = {
    exportedAt: new Date().toISOString(),
    stats: { skills: skills.length, companies: companies.length, roles: roles.length, gaps: gaps.length },
    skills: skills.map((s) => ({ ...s, name: resolver.resolve(s.name, "skill") })),
    companies: companies.map((c) => ({ ...c, name: resolver.resolve(c.name, "company") })),
    roles,
    gaps,
  };

  const filePath = resolve(outputDir, "nexus-export.json");
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  ${chalk.green(filePath)}`);
}

/** Export to CSV. */
async function exportCsv(
  store: EntityStore,
  resolver: EntityResolver,
  detector: GapDetector,
  outputDir: string
): Promise<void> {
  const skills = store.findByType("skill");
  const { gaps } = await detector.detect();
  const gapMap = new Map(gaps.map((g) => [g.skill, g]));

  const header = "name,type,level,demand,gap,sources";
  const seen = new Set<string>();
  const rows: string[] = [header];

  for (const skill of skills) {
    const canonical = resolver.resolve(skill.name, "skill");
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const level = (skill.properties as any)?.level ?? 0;
    const gap = gapMap.get(canonical);
    const demand = gap?.demandLevel ?? 0;
    const gapVal = gap?.gap ?? 0;
    const sources = skill.sources.join(";");

    rows.push(`"${canonical}",skill,${level},${demand.toFixed(1)},${gapVal.toFixed(1)},"${sources}"`);
  }

  const filePath = resolve(outputDir, "nexus-skills.csv");
  writeFileSync(filePath, rows.join("\n"), "utf-8");
  console.log(`  ${chalk.green(rows.length - 1)} rows exported to ${filePath}`);
}
