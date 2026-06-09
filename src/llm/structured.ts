/**
 * Structured LLM output — Zod-validated extraction with retry/repair.
 *
 * Strategy (layered):
 * 1. Send Zod schema as response_format to LLM API
 * 2. Parse JSON response
 * 3. Validate with Zod .parse()
 * 4. On failure: try jsonrepair (free, no LLM call)
 * 5. On failure: retry with validation error fed back to LLM (Instructor pattern)
 */
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { LLMClient, ChatMessage } from "./client.js";
import { renderTemplate } from "./templates.js";

/** Options for structured LLM calls. */
export interface StructuredCallOptions {
  /** The LLM client to use. */
  client: LLMClient;
  /** System prompt (optional). */
  systemPrompt?: string;
  /** User prompt template with {{variable}} interpolation. */
  prompt: string;
  /** Variables to fill in the prompt template. */
  vars: Record<string, unknown>;
  /** Zod schema to validate the output against. */
  schema: z.ZodType;
  /** Optional: override model. */
  model?: string;
  /** Optional: override temperature. */
  temperature?: number;
  /** Max retries on validation failure (default: 2). */
  maxRetries?: number;
}

/**
 * Call an LLM with structured output validation.
 * Returns a typed, validated result.
 *
 * @example
 * ```ts
 * const result = await callStructured({
 *   client: llm,
 *   prompt: "Analyze {{title}}: {{content}}",
 *   vars: { title: "My Article", content: "..." },
 *   schema: z.object({ summary: z.string(), tags: z.array(z.string()) }),
 * });
 * // result is typed as { summary: string; tags: string[] }
 * ```
 */
export async function callStructured<T extends z.ZodType>(
  options: StructuredCallOptions,
): Promise<z.infer<T>> {
  const {
    client,
    systemPrompt,
    prompt,
    vars,
    schema,
    model,
    temperature,
    maxRetries = 2,
  } = options;

  const renderedPrompt = renderTemplate(prompt, vars);
  const jsonSchema = zodToJsonSchema(schema, { target: "openAi" });

  const messages: ChatMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: renderedPrompt });

  let lastError: Error | undefined;

  // Build a schema description for the prompt (used when json_schema format isn't supported)
  const schemaHint = JSON.stringify(jsonSchema, null, 2);

  const messagesWithSchema: ChatMessage[] = [
    ...messages.slice(0, -1),
    {
      role: "user",
      content: `${messages[messages.length - 1].content}\n\nRespond with valid JSON matching this schema:\n${schemaHint}`,
    },
  ];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Try json_schema first, fall back to json_object on unsupported providers
      let response;
      try {
        response = await client.complete({
          messages,
          model,
          temperature: temperature ?? 0.3,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "structured_output",
              strict: true,
              schema: jsonSchema,
            },
          },
        });
      } catch (formatError) {
        const errMsg = formatError instanceof Error ? formatError.message : String(formatError);
        if (errMsg.includes("unavailable") || errMsg.includes("not supported") || errMsg.includes("unsupported")) {
          // Provider doesn't support json_schema — use json_object + schema in prompt
          response = await client.complete({
            messages: messagesWithSchema,
            model,
            temperature: temperature ?? 0.3,
            response_format: { type: "json_object" },
          });
        } else {
          throw formatError;
        }
      }

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty LLM response");
      }

      // Try to parse and validate
      try {
        const parsed = JSON.parse(content);
        return schema.parse(parsed);
      } catch (parseError) {
        // Try jsonrepair on malformed JSON
        try {
          const { jsonrepair } = await import("jsonrepair");
          const repaired = jsonrepair(content);
          const parsed = JSON.parse(repaired);
          return schema.parse(parsed);
        } catch {
          // jsonrepair failed, feed error back to LLM
          if (attempt < maxRetries) {
            const errorSummary =
              parseError instanceof z.ZodError
                ? parseError.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
                : parseError instanceof Error
                  ? parseError.message
                  : String(parseError);

            messages.push(
              { role: "assistant", content },
              {
                role: "user",
                content: `Your response did not match the expected schema. Please correct it.\n\nErrors: ${errorSummary}\n\nRespond with valid JSON only.`,
              },
            );
            continue;
          }
          throw parseError;
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        continue;
      }
    }
  }

  throw lastError ?? new Error("Structured LLM call failed");
}

/**
 * Call an LLM and return raw text (no structured validation).
 */
export async function callLLM(options: {
  client: LLMClient;
  systemPrompt?: string;
  prompt: string;
  vars: Record<string, unknown>;
  model?: string;
  temperature?: number;
}): Promise<string> {
  const { client, systemPrompt, prompt, vars, model, temperature } = options;
  const renderedPrompt = renderTemplate(prompt, vars);

  const messages: ChatMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: renderedPrompt });

  const response = await client.complete({
    messages,
    model,
    temperature: temperature ?? 0.3,
  });

  return response.choices[0]?.message?.content ?? "";
}
