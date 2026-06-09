#!/usr/bin/env node
/** Nexus MCP Server — standalone process for Claude Code integration.
 *  Exposes nexus tools via Model Context Protocol over stdio. */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "../../lib/config.js";
import { initDb } from "../../lib/db.js";
import { EntityStore } from "../../knowledge/store.js";
import { EntityResolver } from "../../knowledge/resolver.js";
import { UnifiedSearch } from "../../knowledge/search.js";
import { LanceVectorStore } from "../../knowledge/vectors.js";
import { ContentIndexer } from "../../knowledge/indexer.js";
import { GapDetector } from "../../agents/gap-detector.js";
import { KnowledgeAuditor } from "../../agents/auditor.js";
import { AgentMemory } from "../../knowledge/memory.js";

const config = loadConfig();
const db = initDb(config.database.main);
const store = new EntityStore(db);
const resolver = new EntityResolver(db);
const indexer = new ContentIndexer(db);
const search = new UnifiedSearch(db, config.search?.weights, config.search?.rrf_k);
const detector = new GapDetector(store, search, resolver);
const auditor = new KnowledgeAuditor(store, indexer);
const memory = new AgentMemory(db);

const server = new McpServer({
  name: "nexus",
  version: "0.2.0",
});

// Tool: nexus_search
server.tool(
  "nexus_search",
  "Search across all connected knowledge sources (ai-feeds, job-hunter, vault, RSS)",
  { query: z.string().describe("Search query"), limit: z.number().optional().describe("Max results (default 10)") },
  async ({ query, limit }) => {
    const results = await search.search({ query, limit: limit ?? 10 });
    const formatted = results.map((r) => ({
      id: r.item.id,
      source: r.source,
      score: r.score,
      preview: r.item.content.slice(0, 200),
    }));
    return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
  }
);

// Tool: nexus_gaps
server.tool(
  "nexus_gaps",
  "Detect skill gaps by comparing knowledge vs job market demand",
  {},
  async () => {
    const { gaps, result } = await detector.detect();
    const formatted = gaps.slice(0, 20).map((g) => ({
      skill: g.skill,
      current: g.currentLevel,
      demand: g.demandLevel,
      gap: g.gap,
    }));
    return { content: [{ type: "text", text: JSON.stringify({ gaps: formatted, total: gaps.length, durationMs: result.durationMs }, null, 2) }] };
  }
);

// Tool: nexus_entity
server.tool(
  "nexus_entity",
  "Get an entity from the knowledge graph by name or ID",
  { name: z.string().describe("Entity name or ID") },
  async ({ name }) => {
    // Try canonical resolution first
    const canonical = resolver.find(name);
    if (canonical) {
      return { content: [{ type: "text", text: JSON.stringify(canonical, null, 2) }] };
    }
    // Try entity store
    const entities = store.findByType("skill").filter((e) => e.name.toLowerCase() === name.toLowerCase());
    if (entities.length > 0) {
      return { content: [{ type: "text", text: JSON.stringify(entities[0], null, 2) }] };
    }
    return { content: [{ type: "text", text: `Entity "${name}" not found` }] };
  }
);

// Tool: nexus_digest
server.tool(
  "nexus_digest",
  "Get a summary of the knowledge base (stats, trending topics, gaps)",
  {},
  async () => {
    const stats = {
      contentIndexed: indexer.count(),
      skills: store.findByType("skill").length,
      companies: store.findByType("company").length,
      roles: store.findByType("role").length,
      canonical: resolver.count(),
      memories: memory.count(),
    };
    const { gaps } = await detector.detect();
    return { content: [{ type: "text", text: JSON.stringify({ stats, topGaps: gaps.slice(0, 5) }, null, 2) }] };
  }
);

// Tool: nexus_audit
server.tool(
  "nexus_audit",
  "Run knowledge graph audit (orphans, duplicates, stale facts)",
  {},
  async () => {
    const { result } = await auditor.audit();
    const summary = {
      entitiesAudited: result.entitiesAudited,
      totalFindings: result.findings.length,
      duplicates: result.findings.filter((f) => f.type === "duplicate_skill").length,
      orphans: result.findings.filter((f) => f.type === "orphan_entity").length,
      missingDetails: result.findings.filter((f) => f.type === "missing_detail").length,
    };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

// Tool: nexus_memory
server.tool(
  "nexus_memory",
  "Store or retrieve agent memories",
  {
    action: z.enum(["remember", "recall", "list"]).describe("Action to perform"),
    content: z.string().optional().describe("Content to remember or query to recall"),
  },
  async ({ action, content }) => {
    switch (action) {
      case "remember": {
        if (!content) return { content: [{ type: "text", text: "Content required for remember" }] };
        const mem = memory.remember(content, "mcp", 0.7);
        return { content: [{ type: "text", text: `Remembered: ${mem.id}` }] };
      }
      case "recall": {
        if (!content) return { content: [{ type: "text", text: "Query required for recall" }] };
        const results = memory.recall(content);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }
      case "list": {
        const all = memory.list(20);
        return { content: [{ type: "text", text: JSON.stringify(all, null, 2) }] };
      }
    }
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
