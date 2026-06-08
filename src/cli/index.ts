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

program.parse();
