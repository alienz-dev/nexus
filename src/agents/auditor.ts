/** Knowledge audit agent — detects orphans, stale facts, and gaps in the knowledge graph. */
import type { EntityStore } from "../knowledge/store.js";
import type { ContentIndexer } from "../knowledge/indexer.js";
import type { AgentResult } from "./types.js";

export interface AuditFinding {
  type: "orphan_entity" | "stale_fact" | "duplicate_skill" | "missing_detail";
  severity: "low" | "medium" | "high";
  entity?: string;
  description: string;
  suggestion: string;
}

export interface AuditResult {
  findings: AuditFinding[];
  entitiesAudited: number;
  factsAudited: number;
  durationMs: number;
}

export class KnowledgeAuditor {
  private store: EntityStore;
  private indexer: ContentIndexer;

  constructor(store: EntityStore, indexer: ContentIndexer) {
    this.store = store;
    this.indexer = indexer;
  }

  /** Run a full knowledge audit. */
  async audit(): Promise<{ result: AuditResult; agentResult: AgentResult }> {
    const start = Date.now();
    const findings: AuditFinding[] = [];

    // 1. Find orphan entities (no relations, no sources)
    const allEntities = this.store.findByType("skill");
    for (const entity of allEntities) {
      if (entity.sources.length === 0) {
        findings.push({
          type: "orphan_entity",
          severity: "low",
          entity: entity.name,
          description: `Skill "${entity.name}" has no source references`,
          suggestion: "Link to content that mentions this skill, or remove if stale",
        });
      }
    }

    // 2. Find stale facts (past valid_to)
    // (Would need to query facts table with valid_to < now — placeholder)

    // 3. Find duplicate skills (same name, different entities)
    const skillNames = new Map<string, number>();
    for (const entity of allEntities) {
      const count = skillNames.get(entity.name) ?? 0;
      skillNames.set(entity.name, count + 1);
    }
    for (const [name, count] of skillNames) {
      if (count > 1) {
        findings.push({
          type: "duplicate_skill",
          severity: "medium",
          entity: name,
          description: `Skill "${name}" appears ${count} times in the entity store`,
          suggestion: "Merge duplicates using canonical entity resolution (nexus resolve --seed)",
        });
      }
    }

    // 4. Find skills with no level information
    for (const entity of allEntities) {
      const level = (entity.properties as any)?.level;
      if (level === undefined || level === null) {
        findings.push({
          type: "missing_detail",
          severity: "low",
          entity: entity.name,
          description: `Skill "${entity.name}" has no proficiency level`,
          suggestion: "Set level via enrichment or manual update",
        });
      }
    }

    const result: AuditResult = {
      findings,
      entitiesAudited: allEntities.length,
      factsAudited: 0, // Placeholder
      durationMs: Date.now() - start,
    };

    return {
      result,
      agentResult: {
        agentName: "auditor",
        success: true,
        steps: [],
        output: result,
        durationMs: result.durationMs,
      },
    };
  }
}
