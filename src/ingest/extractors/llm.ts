/** LLM-based entity extraction — uses the configured LLM client for cases rules can't handle. */
import type { LLMClient } from "../../llm/client.js";

export interface ExtractedEntity {
  name: string;
  type: "skill" | "company" | "role" | "technology" | "concept" | "person";
  confidence: number;
  source: "llm";
}

/** System prompt for entity extraction. */
const EXTRACTION_PROMPT = `Extract entities from the following text. Return a JSON array of objects with:
- name: entity name (normalized, lowercase for skills, proper case for companies/people)
- type: one of "skill", "company", "role", "technology", "concept", "person"
- confidence: 0-1

Focus on:
- Technical skills, programming languages, frameworks, tools
- Company names, organizations
- Job roles, titles
- Technical concepts, methodologies
- People mentioned by name

Return ONLY the JSON array, no other text.`;

/** Extract entities using the configured LLM client. Returns empty if no client provided. */
export async function extractEntitiesLLM(text: string, client?: LLMClient): Promise<ExtractedEntity[]> {
  if (!client) return [];

  try {
    const response = await client.complete({
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: text.slice(0, 4000) },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const content = response.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed.map((e: any) => ({
      name: e.name ?? "",
      type: e.type ?? "concept",
      confidence: Math.min(1, Math.max(0, e.confidence ?? 0.7)),
      source: "llm" as const,
    })) : [];
  } catch {
    return [];
  }
}
