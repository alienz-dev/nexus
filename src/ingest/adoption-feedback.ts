/**
 * Adoption Feedback — tracks outcomes of adoption recommendations.
 *
 * Stores which recommendations were adopted, skipped, or monitored,
 * and uses this data to improve future recommendations.
 */

import type { EntityStore } from "../knowledge/store.js";
import type { Logger } from "../sdk/types.js";

export interface AdoptionFeedbackEntry {
  id: string;
  project: string;
  signalTitle: string;
  signalSource: string;
  signalScore: number;
  recommendation: "adopt" | "skip" | "monitor";
  confidence: number;
  outcome: "adopted" | "skipped" | "ignored" | "unknown";
  issueRef?: string;
  timestamp: string;
  notes?: string;
}

export class AdoptionFeedback {
  private store: EntityStore;
  private logger: Logger;

  constructor(store: EntityStore, logger: Logger) {
    this.store = store;
    this.logger = logger;
  }

  /**
   * Record an adoption feedback entry.
   */
  record(entry: Omit<AdoptionFeedbackEntry, "id" | "timestamp">): AdoptionFeedbackEntry {
    const id = `feedback:${entry.project}:${entry.signalTitle.slice(0, 50).replace(/[^a-z0-9]/g, "-")}`;
    const timestamp = new Date().toISOString();

    const fullEntry: AdoptionFeedbackEntry = {
      ...entry,
      id,
      timestamp,
    };

    // Store as entity in knowledge graph
    this.store.upsertEntity({
      type: "adoption-feedback",
      name: id,
      properties: {
        project: entry.project,
        signal_title: entry.signalTitle,
        signal_source: entry.signalSource,
        signal_score: entry.signalScore,
        recommendation: entry.recommendation,
        confidence: entry.confidence,
        outcome: entry.outcome,
        issue_ref: entry.issueRef,
        notes: entry.notes,
      },
      sources: [`adoption-feedback:${entry.project}`],
    });

    this.logger.info(
      `[feedback] recorded: ${entry.signalTitle} → ${entry.recommendation} (${entry.outcome})`
    );

    return fullEntry;
  }

  /**
   * Get feedback entries for a project.
   */
  getForProject(project: string): AdoptionFeedbackEntry[] {
    const entities = this.store.findByType("adoption-feedback");
    return entities
      .filter((e) => (e.properties as any).project === project)
      .map((e) => {
        const props = e.properties as any;
        return {
          id: e.name,
          project: props.project,
          signalTitle: props.signal_title,
          signalSource: props.signal_source,
          signalScore: props.signal_score,
          recommendation: props.recommendation,
          confidence: props.confidence,
          outcome: props.outcome,
          issueRef: props.issue_ref,
          timestamp: e.createdAt,
          notes: props.notes,
        };
      });
  }

  /**
   * Get adoption statistics for a project.
   */
  getStats(project: string): {
    total: number;
    adopted: number;
    skipped: number;
    ignored: number;
    accuracy: number;
    averageConfidence: number;
  } {
    const entries = this.getForProject(project);

    const adopted = entries.filter((e) => e.outcome === "adopted").length;
    const skipped = entries.filter((e) => e.outcome === "skipped").length;
    const ignored = entries.filter((e) => e.outcome === "ignored").length;

    // Accuracy: how often the recommendation matched the outcome
    const correct = entries.filter(
      (e) =>
        (e.recommendation === "adopt" && e.outcome === "adopted") ||
        (e.recommendation === "skip" && e.outcome === "skipped")
    ).length;
    const accuracy = entries.length > 0 ? correct / entries.length : 0;

    const averageConfidence =
      entries.length > 0
        ? entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length
        : 0;

    return {
      total: entries.length,
      adopted,
      skipped,
      ignored,
      accuracy,
      averageConfidence,
    };
  }

  /**
   * Get feedback entries that need follow-up.
   */
  getPendingFollowUp(project: string): AdoptionFeedbackEntry[] {
    const entries = this.getForProject(project);
    const now = new Date();

    return entries.filter((e) => {
      if (e.outcome !== "unknown") return false;
      const entryDate = new Date(e.timestamp);
      const daysSince = (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 7; // Follow up after 7 days
    });
  }

  /**
   * Update the outcome of a feedback entry.
   */
  updateOutcome(
    id: string,
    outcome: AdoptionFeedbackEntry["outcome"],
    notes?: string
  ): void {
    const entity = this.store.findByName(id, "adoption-feedback");
    if (!entity) {
      this.logger.warn(`[feedback] entry not found: ${id}`);
      return;
    }

    const props = entity.properties as any;
    this.store.upsertEntity({
      type: "adoption-feedback",
      name: id,
      properties: {
        ...props,
        outcome,
        notes: notes ?? props.notes,
      },
      sources: entity.sources,
    });

    this.logger.info(`[feedback] updated ${id}: outcome=${outcome}`);
  }
}
