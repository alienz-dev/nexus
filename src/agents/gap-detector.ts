/** Gap detector agent — compares knowledge graph vs job market skills demand. */
import type { EntityStore } from "../knowledge/store.js";
import type { UnifiedSearch } from "../knowledge/search.js";
import type { AgentResult } from "./types.js";

export interface SkillGap {
  skill: string;
  currentLevel: number;
  demandLevel: number;
  gap: number;
  sources: string[];
}

export class GapDetector {
  private store: EntityStore;
  private search: UnifiedSearch;

  constructor(store: EntityStore, search: UnifiedSearch) {
    this.store = store;
    this.search = search;
  }

  /** Detect skill gaps by comparing known skills against job market demand. */
  async detect(): Promise<{ gaps: SkillGap[]; result: AgentResult }> {
    const start = Date.now();

    // Get all skill entities from the knowledge graph
    const skills = this.store.findByType("skill");

    // Search for job listings mentioning skills
    const gaps: SkillGap[] = [];
    for (const skill of skills) {
      const jobResults = this.search.bm25Search(skill.name, 10);
      const demandCount = jobResults.filter((r) => r.item.type === "content").length;

      const currentLevel = (skill.properties as any)?.level ?? 0;
      const demandLevel = Math.min(demandCount / 5, 10); // Normalize to 0-10

      if (demandLevel > currentLevel) {
        gaps.push({
          skill: skill.name,
          currentLevel,
          demandLevel,
          gap: demandLevel - currentLevel,
          sources: skill.sources,
        });
      }
    }

    gaps.sort((a, b) => b.gap - a.gap);

    return {
      gaps,
      result: {
        agentName: "gap-detector",
        success: true,
        steps: [],
        output: gaps,
        durationMs: Date.now() - start,
      },
    };
  }
}
