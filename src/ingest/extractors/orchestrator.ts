/** Entity extraction orchestrator — rules first, LLM for unknowns.
 *  Implements the hybrid extraction strategy from ADR-007. */
import { extractEntities as extractRules, ruleConfidence, extractFacts as extractFactsRules } from "./rules.js";
import type { ExtractedFact } from "./rules.js";
import { extractEntitiesLLM } from "./llm.js";
import type { LLMClient } from "../../llm/client.js";

export interface ExtractedEntity {
  name: string;
  type: "skill" | "company" | "role" | "technology" | "concept" | "person";
  confidence: number;
  source: "rules" | "llm";
}

const CONFIDENCE_THRESHOLD = 0.5;

/** Extract entities from text using hybrid strategy:
 *  1. Run rule-based extraction (fast, free)
 *  2. If confidence < threshold, send to LLM for long-tail entities
 *  3. Merge and deduplicate results
 *  @param client Optional LLM client for long-tail extraction. If not provided, only rules are used. */
export async function extractEntities(text: string, client?: LLMClient): Promise<ExtractedEntity[]> {
  // Phase 1: Rule-based extraction
  const ruleEntities = extractRules(text);
  const confidence = ruleConfidence(ruleEntities);

  // Phase 2: LLM extraction if rules weren't confident enough
  let llmEntities: ExtractedEntity[] = [];
  if (confidence < CONFIDENCE_THRESHOLD) {
    llmEntities = await extractEntitiesLLM(text, client);
  }

  // Merge and deduplicate
  return mergeEntities(ruleEntities, llmEntities);
}

/** Extract facts (predicates) from text using rules. */
export function extractFacts(text: string): ExtractedFact[] {
  return extractFactsRules(text);
}

/** Merge rule-based and LLM entities, preferring higher confidence. */
function mergeEntities(
  ruleEntities: ExtractedEntity[],
  llmEntities: ExtractedEntity[]
): ExtractedEntity[] {
  const merged = new Map<string, ExtractedEntity>();

  // Add rule entities first (preferred)
  for (const e of ruleEntities) {
    merged.set(e.name.toLowerCase(), e);
  }

  // Add LLM entities if not already present, or if higher confidence
  for (const e of llmEntities) {
    const key = e.name.toLowerCase();
    const existing = merged.get(key);
    if (!existing || e.confidence > existing.confidence) {
      merged.set(key, e);
    }
  }

  return Array.from(merged.values());
}
