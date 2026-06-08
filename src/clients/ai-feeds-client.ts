/**
 * Nexus client for ai-feeds — fetches scoring signals to boost paper relevance.
 *
 * Usage in ai-feeds:
 *   import { NexusScoringClient } from './nexus-client.js';
 *   const nexus = new NexusScoringClient('http://localhost:3777');
 *   const signals = await nexus.getScoringSignals();
 *   // Use signals.gapSkills to boost papers covering high-demand skills
 */

export interface GapSkill {
  skill: string;
  demand: number;
  gap: number;
}

export interface TrendingSkill {
  skill: string;
  mentions: number;
  sources: string[];
}

export interface ScoringSignals {
  gapSkills: GapSkill[];
  trendingSkills: TrendingSkill[];
  activeCompanies: Array<{ company: string; listings: number }>;
  hotTopics: Array<{ topic: string; avgScore: number; count: number }>;
  skillAliases: Record<string, string>;
}

export class NexusScoringClient {
  private baseUrl: string;
  private cache: ScoringSignals | null = null;
  private cacheExpiry = 0;
  private cacheTtlMs: number;

  constructor(baseUrl = "http://localhost:3777", cacheTtlMinutes = 30) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.cacheTtlMs = cacheTtlMinutes * 60 * 1000;
  }

  /** Get scoring signals (cached for 30 min by default). */
  async getScoringSignals(): Promise<ScoringSignals> {
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/feedback/scoring-signals`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.cache = await response.json();
      this.cacheExpiry = Date.now() + this.cacheTtlMs;
      return this.cache!;
    } catch {
      return this.cache ?? this.emptySignals();
    }
  }

  /** Get just the gap skills for quick scoring boost. */
  async getGapSkills(): Promise<GapSkill[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/feedback/gap-skills`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.gaps ?? [];
    } catch {
      return [];
    }
  }

  /** Get skill demand scores (0-10) for all known skills. */
  async getSkillDemand(): Promise<Record<string, number>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/feedback/skill-demand`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.skills ?? {};
    } catch {
      return {};
    }
  }

  /** Get canonical skill name (dedup aliases). */
  async resolveSkill(name: string): Promise<string> {
    const signals = await this.getScoringSignals();
    return signals.skillAliases[name.toLowerCase()] ?? name;
  }

  /** Calculate a nexus boost score for a paper based on its content.
   *  Returns 0-10 boost that can be added to the paper's relevance score. */
  async scorePaper(title: string, abstract: string, categories: string[]): Promise<{
    boost: number;
    reasons: string[];
  }> {
    const signals = await this.getScoringSignals();
    const text = `${title} ${abstract}`.toLowerCase();
    const reasons: string[] = [];
    let boost = 0;

    // Boost for gap skills (high demand, low proficiency)
    for (const gap of signals.gapSkills) {
      if (text.includes(gap.skill.toLowerCase())) {
        boost += gap.gap * 0.5; // Up to 5 points for high-gap skills
        reasons.push(`gap skill: ${gap.skill} (gap: ${gap.gap.toFixed(1)})`);
      }
    }

    // Boost for trending skills
    for (const trend of signals.trendingSkills) {
      if (text.includes(trend.skill.toLowerCase())) {
        boost += Math.min(trend.mentions * 0.2, 2); // Up to 2 points
        reasons.push(`trending: ${trend.skill} (${trend.mentions} mentions)`);
      }
    }

    // Boost for hot topics
    for (const topic of signals.hotTopics) {
      if (text.includes(topic.topic.toLowerCase())) {
        boost += Math.min(topic.avgScore * 0.1, 1); // Up to 1 point
        reasons.push(`hot topic: ${topic.topic}`);
      }
    }

    // Normalize to 0-10
    boost = Math.min(boost, 10);

    return { boost, reasons };
  }

  private emptySignals(): ScoringSignals {
    return {
      gapSkills: [],
      trendingSkills: [],
      activeCompanies: [],
      hotTopics: [],
      skillAliases: {},
    };
  }
}
