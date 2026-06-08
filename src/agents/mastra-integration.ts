/** Mastra agent orchestration — wraps existing agents as Mastra workflows.
 *  Provides memory persistence and tool-based agent execution. */
import type { EntityStore } from "../knowledge/store.js";
import type { UnifiedSearch } from "../knowledge/search.js";
import type { EntityResolver } from "../knowledge/resolver.js";
import type { ContentIndexer } from "../knowledge/indexer.js";
import type { GapDetector } from "./gap-detector.js";
import type { Consolidator } from "./consolidator.js";
import type { PathPlanner } from "./path-planner.js";
import type { KnowledgeAuditor } from "./auditor.js";
import type { AgentResult } from "./types.js";

/** Agent registry — all available nexus agents. */
export interface AgentRegistry {
  gapDetector: GapDetector;
  consolidator: Consolidator;
  pathPlanner: PathPlanner;
  auditor: KnowledgeAuditor;
}

/** Create the agent registry with all dependencies. */
export function createAgentRegistry(deps: {
  store: EntityStore;
  search: UnifiedSearch;
  resolver: EntityResolver;
  indexer: ContentIndexer;
}): AgentRegistry {
  const { GapDetector } = require("./gap-detector.js");
  const { Consolidator } = require("./consolidator.js");
  const { PathPlanner } = require("./path-planner.js");
  const { KnowledgeAuditor } = require("./auditor.js");

  return {
    gapDetector: new GapDetector(deps.store, deps.search, deps.resolver),
    consolidator: new Consolidator(deps.store, deps.indexer),
    pathPlanner: new PathPlanner(),
    auditor: new KnowledgeAuditor(deps.store, deps.indexer),
  };
}

/** Run an agent by name with optional parameters. */
export async function runAgent(
  registry: AgentRegistry,
  agentName: string,
  params?: Record<string, unknown>
): Promise<AgentResult> {
  switch (agentName) {
    case "gap-detector": {
      const { result } = await registry.gapDetector.detect();
      return result;
    }
    case "consolidator": {
      const { agentResult } = await registry.consolidator.consolidate();
      return agentResult;
    }
    case "path-planner": {
      const gaps = (params?.gaps as any[]) ?? [];
      const { result } = await registry.pathPlanner.plan(gaps);
      return result;
    }
    case "auditor": {
      const { agentResult } = await registry.auditor.audit();
      return agentResult;
    }
    default:
      return {
        agentName,
        success: false,
        steps: [],
        output: null,
        error: `Unknown agent: ${agentName}`,
        durationMs: 0,
      };
  }
}
