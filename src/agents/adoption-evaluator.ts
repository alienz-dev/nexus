/**
 * Adoption Evaluator Agent — evaluates whether a signal is worth adopting for a project.
 *
 * Uses LLM to analyze:
 * 1. Project context (tech stack, patterns, capabilities)
 * 2. Signal details (title, abstract, score, source)
 * 3. Evidence (code search, git history, issue search)
 *
 * Returns structured recommendation: adopt, skip, or monitor.
 */

import type { EntityStore } from "../knowledge/store.js";
import type { LLMClient } from "../llm/client.js";
import type { Logger } from "../sdk/types.js";
import type { ProjectContextAnalyzer } from "../ingest/project-context-analyzer.js";

export interface AdoptionSignal {
  title: string;
  abstract?: string;
  source: string;
  score: number;
  url?: string;
  categories?: string[];
}

export interface AdoptionEvidence {
  codeMatches: number;
  codeFiles: string[];
  gitCommits: number;
  gitRecent: boolean;
  issueMatches: number;
  issueRefs: string[];
}

export interface AdoptionEvaluation {
  alreadyAdopted: boolean;
  alreadyTracked: boolean;
  relevance: number;
  recommendation: "adopt" | "skip" | "monitor";
  confidence: number;
  reasoning: string;
  suggestedAction: string;
}

export interface AdoptionResult {
  project: string;
  signal: AdoptionSignal;
  evaluation: AdoptionEvaluation;
  evidence: AdoptionEvidence;
}

export class AdoptionEvaluator {
  private store: EntityStore;
  private llm: LLMClient;
  private analyzer: ProjectContextAnalyzer;
  private logger: Logger;

  constructor(
    store: EntityStore,
    llm: LLMClient,
    analyzer: ProjectContextAnalyzer,
    logger: Logger
  ) {
    this.store = store;
    this.llm = llm;
    this.analyzer = analyzer;
    this.logger = logger;
  }

  /**
   * Evaluate whether a signal is worth adopting for a project.
   */
  async evaluate(
    projectName: string,
    signal: AdoptionSignal,
    evidence: AdoptionEvidence
  ): Promise<AdoptionResult> {
    const project = this.analyzer.getProject(projectName);
    if (!project) {
      throw new Error(`Project not found: ${projectName}`);
    }

    const props = project.properties as Record<string, unknown>;
    const capabilities = this.analyzer.getCapabilities(projectName);

    // Build prompt
    const prompt = this.buildPrompt(
      projectName,
      props,
      capabilities.map((c) => c.name),
      signal,
      evidence
    );

    // Call LLM
    const response = await this.llm.complete({
      messages: [
        {
          role: "system",
          content: "You are evaluating whether a signal is worth adopting for a project. Respond with JSON only.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    // Parse response
    const evaluation = this.parseResponse(response.choices[0].message.content);

    this.logger.info(
      `[adoption] ${projectName}: ${signal.title} → ${evaluation.recommendation} (${evaluation.confidence})`
    );

    return {
      project: projectName,
      signal,
      evaluation,
      evidence,
    };
  }

  /**
   * Evaluate multiple signals for a project.
   */
  async evaluateBatch(
    projectName: string,
    signals: AdoptionSignal[],
    evidenceMap: Map<string, AdoptionEvidence>
  ): Promise<AdoptionResult[]> {
    const results: AdoptionResult[] = [];

    for (const signal of signals) {
      const evidence = evidenceMap.get(signal.title) ?? {
        codeMatches: 0,
        codeFiles: [],
        gitCommits: 0,
        gitRecent: false,
        issueMatches: 0,
        issueRefs: [],
      };

      try {
        const result = await this.evaluate(projectName, signal, evidence);
        results.push(result);
      } catch (err) {
        this.logger.warn(`[adoption] failed to evaluate ${signal.title}: ${err}`);
      }
    }

    return results;
  }

  private buildPrompt(
    projectName: string,
    projectProps: Record<string, unknown>,
    capabilities: string[],
    signal: AdoptionSignal,
    evidence: AdoptionEvidence
  ): string {
    const techStack = (projectProps.tech_stack as string[]) ?? [];
    const adoptedPatterns = (projectProps.adopted_patterns as string[]) ?? [];
    const enhancementAreas = (projectProps.enhancement_areas as string[]) ?? [];

    return `You are evaluating whether a signal is worth adopting for a project.

Project: ${projectName}
Description: ${projectProps.description as string ?? "none"}
Tech Stack: ${techStack.join(", ") || "none"}
Adopted Patterns: ${adoptedPatterns.join(", ") || "none"}
Enhancement Areas: ${enhancementAreas.join(", ") || "none"}
Capabilities: ${capabilities.join(", ") || "none"}

Signal: ${signal.title}
Source: ${signal.source}
Score: ${signal.score}/10
Abstract: ${signal.abstract ?? "none"}

Evidence:
- Code search: ${evidence.codeMatches} matches in ${evidence.codeFiles.length} files
- Git history: ${evidence.gitCommits} commits, recent: ${evidence.gitRecent}
- Issue search: ${evidence.issueMatches} matches: ${evidence.issueRefs.join(", ") || "none"}

Question: Is this worth adopting? Is it already adopted?

Respond with JSON:
{
  "already_adopted": boolean,
  "already_tracked": boolean,
  "relevance": 0-1,
  "recommendation": "adopt" | "skip" | "monitor",
  "confidence": 0-1,
  "reasoning": "...",
  "suggested_action": "..."
}`;
  }

  private parseResponse(content: string): AdoptionEvaluation {
    try {
      const parsed = JSON.parse(content);
      return {
        alreadyAdopted: parsed.already_adopted ?? false,
        alreadyTracked: parsed.already_tracked ?? false,
        relevance: parsed.relevance ?? 0.5,
        recommendation: parsed.recommendation ?? "monitor",
        confidence: parsed.confidence ?? 0.5,
        reasoning: parsed.reasoning ?? "No reasoning provided",
        suggestedAction: parsed.suggested_action ?? "No action suggested",
      };
    } catch {
      this.logger.warn("[adoption] failed to parse LLM response, using defaults");
      return {
        alreadyAdopted: false,
        alreadyTracked: false,
        relevance: 0.5,
        recommendation: "monitor",
        confidence: 0.3,
        reasoning: "Failed to parse LLM response",
        suggestedAction: "Manual review required",
      };
    }
  }
}
