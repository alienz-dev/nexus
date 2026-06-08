/** LLM-based entity extraction — uses DeepSeek API for cases rules can't handle. */

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

/** Extract entities using LLM. Returns empty immediately if no API key configured. */
export async function extractEntitiesLLM(text: string): Promise<ExtractedEntity[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.LLM_API_KEY;
  if (!apiKey) return []; // No API key — skip LLM extraction entirely

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: text.slice(0, 4000) },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return [];

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content ?? "";
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
