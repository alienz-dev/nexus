/** Feedback API — provides scoring signals from the knowledge graph.
 *  External services can consume these to improve their own scoring. */
import { Hono } from "hono";
import type { EntityStore } from "../../knowledge/store.js";
import type { EntityResolver } from "../../knowledge/resolver.js";
import type { UnifiedSearch } from "../../knowledge/search.js";
import type { GapDetector } from "../../agents/gap-detector.js";

export interface ScoringSignals {
  /** Skills with high market demand but low user proficiency (prioritize learning). */
  gapSkills: Array<{ skill: string; demand: number; gap: number }>;
  /** Skills trending in recent content (high mention frequency). */
  trendingSkills: Array<{ skill: string; mentions: number; sources: string[] }>;
  /** Companies with active job listings. */
  activeCompanies: Array<{ company: string; listings: number }>;
  /** Topics with high relevance scores in recent papers. */
  hotTopics: Array<{ topic: string; avgScore: number; count: number }>;
  /** Canonical skill name mapping for deduplication. */
  skillAliases: Record<string, string>;
}

export function createFeedbackRoutes(
  store: EntityStore,
  resolver: EntityResolver,
  search: UnifiedSearch,
  detector: GapDetector
): Hono {
  const app = new Hono();

  /** GET /api/feedback/scoring-signals
   *  Returns all scoring signals from the knowledge graph. */
  app.get("/scoring-signals", async (c) => {
    const signals = await buildScoringSignals(store, resolver, search, detector);
    return c.json(signals);
  });

  /** GET /api/feedback/skill-demand
   *  Returns skill demand scores (0-10) for use in scoring. */
  app.get("/skill-demand", async (c) => {
    const skills = store.findByType("skill");
    const demandMap: Record<string, number> = {};

    for (const skill of skills) {
      const canonical = resolver.resolve(skill.name, "skill");
      const results = search.bm25Search(canonical, 5);
      const demand = Math.min(results.length / 5, 10);
      if (!demandMap[canonical] || demand > demandMap[canonical]) {
        demandMap[canonical] = demand;
      }
    }

    return c.json({ skills: demandMap, count: Object.keys(demandMap).length });
  });

  /** GET /api/feedback/gap-skills
   *  Returns just the gap skills for scoring boost. */
  app.get("/gap-skills", async (c) => {
    const { gaps } = await detector.detect();
    const gapSkills = gaps.map((g) => ({
      skill: g.skill,
      demand: g.demandLevel,
      gap: g.gap,
    }));
    return c.json({ gaps: gapSkills, count: gapSkills.length });
  });

  /** GET /api/feedback/trending
   *  Returns trending topics from recent content. */
  app.get("/trending", async (c) => {
    const trending = await getTrendingTopics(search);
    return c.json({ topics: trending, count: trending.length });
  });

  /** GET /api/feedback/aliases
   *  Returns canonical skill name mapping. */
  app.get("/aliases", (c) => {
    const skills = resolver.listByType("skill");
    const aliases: Record<string, string> = {};
    for (const s of skills) {
      aliases[s.canonicalName] = s.canonicalName;
      for (const alias of s.aliases) {
        aliases[alias] = s.canonicalName;
      }
    }
    return c.json({ aliases, count: Object.keys(aliases).length });
  });

  return app;
}

/** Build complete scoring signals. */
async function buildScoringSignals(
  store: EntityStore,
  resolver: EntityResolver,
  search: UnifiedSearch,
  detector: GapDetector
): Promise<ScoringSignals> {
  // Gap skills
  const { gaps } = await detector.detect();
  const gapSkills = gaps.slice(0, 50).map((g) => ({
    skill: g.skill,
    demand: g.demandLevel,
    gap: g.gap,
  }));

  // Trending topics
  const trendingSkills = await getTrendingTopics(search);

  // Active companies
  const companies = store.findByType("company");
  const activeCompanies = companies
    .map((c) => ({ company: c.name, listings: c.sources.length }))
    .sort((a, b) => b.listings - a.listings)
    .slice(0, 50);

  // Hot topics (skills with highest mention frequency)
  const skills = store.findByType("skill");
  const skillMentions = new Map<string, { count: number; sources: Set<string> }>();
  for (const skill of skills) {
    const canonical = resolver.resolve(skill.name, "skill");
    const existing = skillMentions.get(canonical) ?? { count: 0, sources: new Set() };
    existing.count += skill.sources.length;
    skill.sources.forEach((s) => existing.sources.add(s));
    skillMentions.set(canonical, existing);
  }
  const hotTopics = Array.from(skillMentions.entries())
    .map(([topic, data]) => ({
      topic,
      avgScore: data.count,
      count: data.sources.size,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 50);

  // Skill aliases
  const allSkills = resolver.listByType("skill");
  const skillAliases: Record<string, string> = {};
  for (const s of allSkills) {
    skillAliases[s.canonicalName] = s.canonicalName;
    for (const alias of s.aliases) {
      skillAliases[alias] = s.canonicalName;
    }
  }

  return { gapSkills, trendingSkills, activeCompanies, hotTopics, skillAliases };
}

/** Get trending topics by searching for common tech terms. */
async function getTrendingTopics(search: UnifiedSearch): Promise<Array<{ skill: string; mentions: number; sources: string[] }>> {
  const topics = [
    "AI agents", "LLM", "machine learning", "TypeScript", "Rust", "Python",
    "React", "Node.js", "Docker", "Kubernetes", "GraphQL", "REST API",
    "microservices", "system design", "data engineering", "MLOps",
    "RAG", "vector database", "embeddings", "fine-tuning",
  ];

  const results: Array<{ skill: string; mentions: number; sources: string[] }> = [];

  for (const topic of topics) {
    const hits = search.bm25Search(topic, 10);
    if (hits.length > 0) {
      const sources = [...new Set(hits.map((h) => h.item.id.split(":")[0]))];
      results.push({ skill: topic, mentions: hits.length, sources });
    }
  }

  return results.sort((a, b) => b.mentions - a.mentions);
}
