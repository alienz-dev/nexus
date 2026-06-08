/**
 * Nexus client for job-hunter — fetches skill demand and trending data for fit scoring.
 *
 * Usage in job-hunter:
 *   import { NexusFitClient } from './nexus-client.js';
 *   const nexus = new NexusFitClient('http://localhost:3777');
 *   const signals = await nexus.getScoringSignals();
 *   // Use signals.trendingSkills to boost jobs matching trending skills
 */

export interface TrendingSkill {
  skill: string;
  mentions: number;
  sources: string[];
}

export interface ScoringSignals {
  gapSkills: Array<{ skill: string; demand: number; gap: number }>;
  trendingSkills: TrendingSkill[];
  activeCompanies: Array<{ company: string; listings: number }>;
  hotTopics: Array<{ topic: string; avgScore: number; count: number }>;
  skillAliases: Record<string, string>;
}

export class NexusFitClient {
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

  /** Calculate a nexus fit boost for a job listing.
   *  Returns 0-10 boost based on how well the job matches trending skills and market demand. */
  async scoreJob(title: string, description: string, company: string): Promise<{
    boost: number;
    reasons: string[];
    matchedSkills: string[];
  }> {
    const signals = await this.getScoringSignals();
    const text = `${title} ${description}`.toLowerCase();
    const reasons: string[] = [];
    const matchedSkills: string[] = [];
    let boost = 0;

    // Boost for trending skills in job description
    for (const trend of signals.trendingSkills) {
      if (text.includes(trend.skill.toLowerCase())) {
        boost += Math.min(trend.mentions * 0.3, 3); // Up to 3 points
        reasons.push(`trending skill: ${trend.skill} (${trend.mentions} mentions in knowledge base)`);
        matchedSkills.push(trend.skill);
      }
    }

    // Boost for gap skills (high demand jobs are more valuable)
    for (const gap of signals.gapSkills) {
      if (text.includes(gap.skill.toLowerCase())) {
        boost += gap.demand * 0.3; // Up to 3 points
        reasons.push(`high-demand skill: ${gap.skill} (demand: ${gap.demand.toFixed(1)})`);
        if (!matchedSkills.includes(gap.skill)) matchedSkills.push(gap.skill);
      }
    }

    // Boost for active companies (companies with multiple listings are more serious)
    const companyMatch = signals.activeCompanies.find(
      (c) => company.toLowerCase().includes(c.company.toLowerCase()) || c.company.toLowerCase().includes(company.toLowerCase())
    );
    if (companyMatch) {
      boost += Math.min(companyMatch.listings * 0.2, 2); // Up to 2 points
      reasons.push(`active company: ${companyMatch.company} (${companyMatch.listings} listings)`);
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

    return { boost, reasons, matchedSkills };
  }

  /** Get trending skills that should be prioritized in job search. */
  async getTrendingSkills(): Promise<TrendingSkill[]> {
    const signals = await this.getScoringSignals();
    return signals.trendingSkills;
  }

  /** Get gap skills (high demand, low proficiency) for learning prioritization. */
  async getGapSkills(): Promise<Array<{ skill: string; demand: number; gap: number }>> {
    const signals = await this.getScoringSignals();
    return signals.gapSkills;
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
