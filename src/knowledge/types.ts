/** Knowledge graph types — entities, relations, and temporally-valid facts. */
import { z } from "zod";

/** An entity extracted from content (skill, company, person, concept, etc.). */
export const EntitySchema = z.object({
  id: z.string(),
  type: z.string().describe("Entity type (skill, company, role, person, concept)"),
  name: z.string(),
  properties: z.record(z.unknown()).default({}),
  sources: z.array(z.string()).default([]).describe("Source IDs that mention this entity"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Entity = z.infer<typeof EntitySchema>;

/** A directed, typed relation between two entities. */
export const RelationSchema = z.object({
  id: z.string(),
  sourceId: z.string().describe("Source entity ID"),
  targetId: z.string().describe("Target entity ID"),
  type: z.string().describe("Relation type (requires, belongs_to, mentions, etc.)"),
  weight: z.number().default(1.0),
  properties: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});

export type Relation = z.infer<typeof RelationSchema>;

/** A temporally-valid fact about an entity. */
export const FactSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  predicate: z.string().describe("What is being asserted (e.g., 'has_skill_level', 'employee_count')"),
  value: z.unknown(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().optional().describe("null means still valid"),
  source: z.string().describe("Source ID that asserted this fact"),
  confidence: z.number().min(0).max(1).default(1.0),
});

export type Fact = z.infer<typeof FactSchema>;

/** The complete knowledge graph. */
export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
  facts: Fact[];
}

/** Search result with relevance scoring. */
export interface SearchResult {
  item: { id: string; type: string; content: string };
  score: number;
  source: "bm25" | "vector" | "graph";
}
