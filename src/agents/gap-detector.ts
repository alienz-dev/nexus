/** Gap detector agent — compares knowledge graph vs job market skills demand. */
import type { EntityStore } from "../knowledge/store.js";
import type { UnifiedSearch } from "../knowledge/search.js";
import type { EntityResolver } from "../knowledge/resolver.js";
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
  private resolver: EntityResolver | null;

  constructor(store: EntityStore, search: UnifiedSearch, resolver?: EntityResolver) {
    this.store = store;
    this.search = search;
    this.resolver = resolver ?? null;
  }

  /** Detect skill gaps by comparing known skills against job market demand. */
  async detect(): Promise<{ gaps: SkillGap[]; result: AgentResult }> {
    const start = Date.now();

    // Get all skill entities from the knowledge graph
    const skills = this.store.findByType("skill");

    // Deduplicate using canonical resolver
    const seen = new Map<string, typeof skills[0]>();
    for (const skill of skills) {
      const canonical = this.resolver?.resolve(skill.name, "skill") ?? skill.name.toLowerCase();
      const existing = seen.get(canonical);
      if (!existing || skill.sources.length > existing.sources.length) {
        seen.set(canonical, skill);
      }
    }

    // Search for job listings mentioning skills
    const gaps: SkillGap[] = [];
    for (const [canonicalName, skill] of seen) {
      const jobResults = this.search.bm25Search(canonicalName, 10);
      const demandCount = jobResults.filter((r) => r.item.type === "content").length;

      const currentLevel = (skill.properties as any)?.level ?? 0;
      const demandLevel = Math.min(demandCount / 5, 10); // Normalize to 0-10

      if (demandLevel > currentLevel) {
        gaps.push({
          skill: canonicalName,
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
