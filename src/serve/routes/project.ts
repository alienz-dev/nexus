/**
 * Project context API routes.
 *
 * GET  /api/projects              — list all projects
 * GET  /api/projects/:name        — show project details
 * GET  /api/projects/:name/capabilities — list project capabilities
 * POST /api/projects/:name/evaluate — evaluate adoption for a signal (keyword-based)
 * POST /api/projects/:name/evaluate-llm — evaluate adoption with LLM (requires LLM client)
 */

import { Hono } from "hono";
import type { EntityStore } from "../../knowledge/store.js";
import type { ProjectContextAnalyzer } from "../../ingest/project-context-analyzer.js";
import type { AdoptionEvaluator } from "../../agents/adoption-evaluator.js";

export function createProjectRoutes(
  store: EntityStore,
  analyzer: ProjectContextAnalyzer,
  evaluator?: AdoptionEvaluator
): Hono {
  const app = new Hono();

  // List all projects
  app.get("/", async (c) => {
    const projects = analyzer.getAllProjects();
    return c.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        properties: p.properties,
      })),
      count: projects.length,
    });
  });

  // Show project details
  app.get("/:name", async (c) => {
    const name = c.req.param("name");
    const project = analyzer.getProject(name);

    if (!project) {
      return c.json({ error: `Project not found: ${name}` }, 404);
    }

    const capabilities = analyzer.getCapabilities(name);

    return c.json({
      id: project.id,
      name: project.name,
      properties: project.properties,
      capabilities: capabilities.map((cap) => ({
        id: cap.id,
        name: cap.name,
        properties: cap.properties,
      })),
    });
  });

  // List project capabilities
  app.get("/:name/capabilities", async (c) => {
    const name = c.req.param("name");
    const project = analyzer.getProject(name);

    if (!project) {
      return c.json({ error: `Project not found: ${name}` }, 404);
    }

    const capabilities = analyzer.getCapabilities(name);

    return c.json({
      project: name,
      capabilities: capabilities.map((cap) => ({
        id: cap.id,
        name: cap.name,
        properties: cap.properties,
      })),
      count: capabilities.length,
    });
  });

  // Evaluate adoption for a signal
  app.post("/:name/evaluate", async (c) => {
    const name = c.req.param("name");
    const body = await c.req.json();

    const project = analyzer.getProject(name);
    if (!project) {
      return c.json({ error: `Project not found: ${name}` }, 404);
    }

    const { signal, context } = body;
    if (!signal) {
      return c.json({ error: "signal is required" }, 400);
    }

    // Extract keywords from signal (handle both string and object)
    const signalText = typeof signal === "string" ? signal : signal.title ?? JSON.stringify(signal);
    const keywords = extractKeywords(signalText);

    // Check if project has any of the keywords as capabilities
    const capabilities = analyzer.getCapabilities(name);
    const capabilityNames = capabilities.map((cap) => cap.name.toLowerCase());

    const matches = keywords.filter((keyword) =>
      capabilityNames.some((cap) => cap.includes(keyword) || keyword.includes(cap))
    );

    const alreadyAdopted = matches.length > 0;
    const relevance = alreadyAdopted ? 0.9 : 0.5;

    return c.json({
      project: name,
      signal,
      evaluation: {
        already_adopted: alreadyAdopted,
        already_tracked: false, // Would need issue-cli integration
        relevance,
        recommendation: alreadyAdopted ? "skip" : "adopt",
        confidence: 0.7,
      },
      evidence: {
        keyword_matches: matches,
        capability_count: capabilities.length,
      },
      reasoning: alreadyAdopted
        ? `Project already has capabilities matching: ${matches.join(", ")}`
        : `No matching capabilities found. Signal may be worth adopting.`,
    });
  });

  // LLM-based evaluation (requires evaluator)
  app.post("/:name/evaluate-llm", async (c) => {
    if (!evaluator) {
      return c.json({ error: "LLM evaluation not available" }, 501);
    }

    const name = c.req.param("name");
    const body = await c.req.json();

    const project = analyzer.getProject(name);
    if (!project) {
      return c.json({ error: `Project not found: ${name}` }, 404);
    }

    const { signal, evidence } = body;
    if (!signal || !signal.title) {
      return c.json({ error: "signal.title is required" }, 400);
    }

    try {
      const result = await evaluator.evaluate(name, signal, evidence ?? {
        codeMatches: 0,
        codeFiles: [],
        gitCommits: 0,
        gitRecent: false,
        issueMatches: 0,
        issueRefs: [],
      });

      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 500);
    }
  });

  return app;
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction: lowercase, split on spaces, remove stopwords
  const stopwords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "s", "t",
    "just", "don", "now",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word))
    .slice(0, 10);
}
