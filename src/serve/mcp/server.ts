/** MCP server — exposes nexus tools via Model Context Protocol. */
import type { UnifiedSearch } from "../../knowledge/search.js";
import type { EntityStore } from "../../knowledge/store.js";
import type { GapDetector } from "../../agents/gap-detector.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

/** Create the set of MCP tools exposed by nexus. */
export function createMcpTools(
  search: UnifiedSearch,
  store: EntityStore,
  detector: GapDetector
): McpTool[] {
  return [
    {
      name: "nexus_search",
      description: "Search across all connected knowledge sources (ai-feeds, job-hunter, vault, RSS)",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          limit: { type: "number", description: "Max results", default: 10 },
        },
        required: ["query"],
      },
      handler: async (params) => {
        const results = search.search({
          query: params.query as string,
          limit: (params.limit as number) ?? 10,
        });
        return { results, count: results.length };
      },
    },
    {
      name: "nexus_get_entity",
      description: "Get an entity from the knowledge graph by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Entity ID" },
        },
        required: ["id"],
      },
      handler: async (params) => {
        const entity = store.getEntity(params.id as string);
        return entity ?? { error: "Entity not found" };
      },
    },
    {
      name: "nexus_detect_gaps",
      description: "Detect skill gaps by comparing knowledge vs job market demand",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const { gaps } = await detector.detect();
        return { gaps, count: gaps.length };
      },
    },
  ];
}
