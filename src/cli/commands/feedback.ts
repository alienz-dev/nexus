/**
 * nexus feedback — manage adoption feedback.
 *
 * Commands:
 *   nexus feedback list <project>        — list feedback entries
 *   nexus feedback stats <project>       — show adoption statistics
 *   nexus feedback pending <project>     — show pending follow-ups
 *   nexus feedback update <id> <outcome> — update feedback outcome
 */

import chalk from "chalk";
import { loadConfig } from "../../lib/config.js";
import { initDb, closeDb } from "../../lib/db.js";
import { EntityStore } from "../../knowledge/store.js";
import { AdoptionFeedback } from "../../ingest/adoption-feedback.js";

export interface FeedbackCommandOptions {
  action: "list" | "stats" | "pending" | "update";
  project?: string;
  id?: string;
  outcome?: string;
  notes?: string;
}

export async function feedbackCommand(options: FeedbackCommandOptions): Promise<void> {
  const config = loadConfig();
  const db = initDb(config.database.main);
  const store = new EntityStore(db);
  const feedback = new AdoptionFeedback(store, {
    debug: () => {},
    info: (msg: string) => console.log(chalk.blue("[INFO]"), msg),
    warn: (msg: string) => console.log(chalk.yellow("[WARN]"), msg),
    error: (msg: string) => console.error(chalk.red("[ERROR]"), msg),
  });

  try {
    switch (options.action) {
      case "list":
        if (!options.project) {
          console.error(chalk.red("Error: --project is required for 'list'"));
          process.exit(1);
        }
        await listFeedback(feedback, options.project);
        break;
      case "stats":
        if (!options.project) {
          console.error(chalk.red("Error: --project is required for 'stats'"));
          process.exit(1);
        }
        await showStats(feedback, options.project);
        break;
      case "pending":
        if (!options.project) {
          console.error(chalk.red("Error: --project is required for 'pending'"));
          process.exit(1);
        }
        await showPending(feedback, options.project);
        break;
      case "update":
        if (!options.id || !options.outcome) {
          console.error(chalk.red("Error: --id and --outcome are required for 'update'"));
          process.exit(1);
        }
        await updateFeedback(feedback, options.id, options.outcome as any, options.notes);
        break;
    }
  } finally {
    closeDb(db);
  }
}

async function listFeedback(feedback: AdoptionFeedback, project: string): Promise<void> {
  const entries = feedback.getForProject(project);

  if (entries.length === 0) {
    console.log(chalk.yellow(`No feedback entries for: ${project}`));
    return;
  }

  console.log(chalk.bold(`Feedback for ${project}:`));
  console.log("");

  for (const entry of entries) {
    const outcomeColor =
      entry.outcome === "adopted"
        ? chalk.green
        : entry.outcome === "skipped"
        ? chalk.yellow
        : entry.outcome === "ignored"
        ? chalk.red
        : chalk.dim;

    console.log(`  ${chalk.bold(entry.signalTitle.slice(0, 60))}`);
    console.log(`    Recommendation: ${entry.recommendation} (${entry.confidence})`);
    console.log(`    Outcome: ${outcomeColor(entry.outcome)}`);
    if (entry.issueRef) console.log(`    Issue: ${entry.issueRef}`);
    console.log(`    Date: ${chalk.dim(entry.timestamp)}`);
    console.log("");
  }
}

async function showStats(feedback: AdoptionFeedback, project: string): Promise<void> {
  const stats = feedback.getStats(project);

  console.log(chalk.bold(`Adoption Statistics for ${project}:`));
  console.log("");
  console.log(`  Total evaluations: ${stats.total}`);
  console.log(`  Adopted: ${chalk.green(stats.adopted)}`);
  console.log(`  Skipped: ${chalk.yellow(stats.skipped)}`);
  console.log(`  Ignored: ${chalk.red(stats.ignored)}`);
  console.log(`  Accuracy: ${chalk.bold((stats.accuracy * 100).toFixed(1))}%`);
  console.log(`  Avg confidence: ${stats.averageConfidence.toFixed(2)}`);
}

async function showPending(feedback: AdoptionFeedback, project: string): Promise<void> {
  const pending = feedback.getPendingFollowUp(project);

  if (pending.length === 0) {
    console.log(chalk.green(`No pending follow-ups for: ${project}`));
    return;
  }

  console.log(chalk.bold(`Pending Follow-ups for ${project}:`));
  console.log("");

  for (const entry of pending) {
    console.log(`  ${chalk.bold(entry.signalTitle.slice(0, 60))}`);
    console.log(`    Recommendation: ${entry.recommendation} (${entry.confidence})`);
    console.log(`    Date: ${chalk.dim(entry.timestamp)}`);
    if (entry.issueRef) console.log(`    Issue: ${entry.issueRef}`);
    console.log("");
  }
}

async function updateFeedback(
  feedback: AdoptionFeedback,
  id: string,
  outcome: "adopted" | "skipped" | "ignored" | "unknown",
  notes?: string
): Promise<void> {
  feedback.updateOutcome(id, outcome, notes);
  console.log(chalk.green(`✓ Updated ${id}: outcome=${outcome}`));
}
