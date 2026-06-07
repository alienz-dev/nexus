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

const program = new Command();

program
  .name("nexus")
  .description("Personal Knowledge Management System Hub")
  .version("0.1.0");

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

program.parse();
