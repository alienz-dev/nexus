#!/usr/bin/env node
/** Nexus PKMS CLI — Commander-based interface. */
import { Command } from "commander";
import { statusCommand } from "./commands/status.js";
import { searchCommand } from "./commands/search.js";
import { ingestCommand } from "./commands/ingest.js";
import { enrichCommand } from "./commands/enrich.js";
import { gapsCommand } from "./commands/gaps.js";
import { resolveCommand } from "./commands/resolve.js";
import { auditCommand } from "./commands/audit.js";
import { graphCommand } from "./commands/graph.js";
import { memoryCommand } from "./commands/memory.js";
import { askCommand } from "./commands/ask.js";
import { digestCommand } from "./commands/digest.js";
import { watchCommand } from "./commands/watch.js";
import { exportCommand } from "./commands/export.js";
import { syncCommand } from "./commands/sync.js";
import { projectCommand } from "./commands/project.js";
import { feedbackCommand } from "./commands/feedback.js";

const program = new Command();

program
  .name("nexus")
  .description("Personal Knowledge Management System Hub")
  .version("0.2.0")
  .option("-c, --config <path>", "Path to nexus.yaml config file");

program
  .command("status")
  .description("Show all connected sources and counts")
  .action(statusCommand);

program
  .command("search <query>")
  .description("Search across all connected sources")
  .option("-l, --limit <n>", "Max results", "10")
  .action((query, opts) => searchCommand(query, { limit: parseInt(opts.limit, 10) }));

program
  .command("ask <question>")
  .description("Ask a question and get synthesized answers from your knowledge base")
  .action(askCommand);

program
  .command("ingest")
  .description("Run ingestion from connected sources")
  .option("-s, --source <name>", "Specific source to ingest from")
  .action((opts) => ingestCommand({ source: opts.source }));

program
  .command("enrich")
  .description("Process pending entity extraction jobs")
  .option("-l, --limit <n>", "Max jobs to process", "50")
  .action((opts) => enrichCommand({ limit: parseInt(opts.limit, 10) }));

program
  .command("digest")
  .description("Show daily/weekly summary")
  .option("-p, --period <period>", "daily or weekly", "daily")
  .action((opts) => digestCommand({ period: opts.period as "daily" | "weekly" }));

program
  .command("gaps")
  .description("Show skill gaps detected by comparing knowledge vs job market")
  .action(gapsCommand);

program
  .command("resolve")
  .description("Manage the canonical entity registry")
  .option("--seed", "Seed with known skill/company aliases")
  .option("--lookup <name>", "Look up a name in the canonical registry")
  .action((opts) => resolveCommand({ seed: opts.seed, lookup: opts.lookup }));

program
  .command("audit")
  .description("Run knowledge graph audit (orphans, duplicates, stale facts)")
  .action(auditCommand);

program
  .command("graph")
  .description("Show knowledge graph statistics")
  .action(graphCommand);

program
  .command("memory")
  .description("Manage agent memory")
  .option("-r, --remember <text>", "Store a new memory")
  .option("-q, --recall <query>", "Search memories")
  .option("-l, --list", "List all memories")
  .action((opts) => memoryCommand({ remember: opts.remember, recall: opts.recall, list: opts.list }));

program
  .command("watch")
  .description("Live feed monitoring with periodic ingestion")
  .option("-i, --interval <minutes>", "Polling interval in minutes", "5")
  .action((opts) => watchCommand({ interval: parseInt(opts.interval, 10) }));

program
  .command("export")
  .description("Export knowledge to various formats")
  .option("-f, --format <format>", "Export format: anki, markdown, json, csv", "anki")
  .option("-o, --output <dir>", "Output directory")
  .option("-t, --type <type>", "Entity type to export")
  .action((opts) => exportCommand({ format: opts.format as any, output: opts.output, type: opts.type }));

program
  .command("sync")
  .description("Sync nexus data to Obsidian vault")
  .option("-t, --target <dir>", "Target directory (default: vault/nexus/)")
  .action((opts) => syncCommand({ target: opts.target }));

program
  .command("project")
  .description("Manage project context in the knowledge graph")
  .option("-a, --action <action>", "Action: list, show, add, capabilities, ingest", "list")
  .option("-n, --name <name>", "Project name")
  .option("-p, --path <path>", "Project path")
  .option("-d, --description <desc>", "Project description")
  .option("--tech-stack <stack>", "Tech stack (comma-separated)")
  .option("--adopted-patterns <patterns>", "Adopted patterns (comma-separated)")
  .option("--enhancement-areas <areas>", "Enhancement areas (comma-separated)")
  .option("-m, --maturity <level>", "Maturity: prototype, beta, production", "prototype")
  .action((opts) => projectCommand({
    action: opts.action as any,
    name: opts.name,
    path: opts.path,
    description: opts.description,
    techStack: opts.techStack,
    adoptedPatterns: opts.adoptedPatterns,
    enhancementAreas: opts.enhancementAreas,
    maturity: opts.maturity,
  }));

program
  .command("feedback")
  .description("Manage adoption feedback")
  .option("-a, --action <action>", "Action: list, stats, pending, update", "list")
  .option("-p, --project <name>", "Project name")
  .option("-i, --id <id>", "Feedback entry ID")
  .option("-o, --outcome <outcome>", "Outcome: adopted, skipped, ignored, unknown")
  .option("-n, --notes <notes>", "Notes for update")
  .action((opts) => feedbackCommand({
    action: opts.action as any,
    project: opts.project,
    id: opts.id,
    outcome: opts.outcome,
    notes: opts.notes,
  }));

program.parse();
