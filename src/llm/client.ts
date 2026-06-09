/** LLM client — thin OpenAI-compatible wrapper. Points at any endpoint. */

export interface LLMClientConfig {
  /** LLM API endpoint (e.g. "https://api.openai.com/v1"). Falls back to LLM_ENDPOINT env var. */
  endpoint?: string;
  /** Model name (e.g. "gpt-4o-mini", "deepseek-chat"). Falls back to LLM_MODEL env var. */
  model?: string;
  /** API key. Falls back to LLM_API_KEY env var. */
  apiKey?: string;
  maxRetries?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_schema"; json_schema: Record<string, unknown> } | { type: "json_object" };
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** A thin OpenAI-compatible LLM client. */
export interface LLMClient {
  /** Send a chat completion request. */
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  /** Get the configured model name. Returns empty string if not configured. */
  model(): string;
  /** Get the endpoint URL. Returns empty string if not configured. */
  endpoint(): string;
  /** Check if the client has enough config to make LLM calls. */
  isConfigured(): boolean;
}

/**
 * Create an LLM client that talks to any OpenAI-compatible endpoint.
 * Does NOT throw on missing config — use isConfigured() to check, or let
 * complete() throw with a clear message when actually called.
 *
 * @example
 * ```ts
 * const llm = createLLMClient({ endpoint: "https://api.deepseek.com/v1", model: "deepseek-chat" });
 * const res = await llm.complete({ messages: [{ role: "user", content: "Hello" }] });
 * ```
 */
export function createLLMClient(config: LLMClientConfig): LLMClient {
  const endpoint = config.endpoint || process.env.LLM_ENDPOINT || "";
  const defaultModel = config.model || process.env.LLM_MODEL || "";
  const apiKey = config.apiKey ?? process.env.LLM_API_KEY;
  const retries = config.maxRetries ?? 2;

  return {
    model: () => defaultModel,
    endpoint: () => endpoint,
    isConfigured: () => Boolean(endpoint),

    async complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
      if (!endpoint) {
        throw new Error(
          "LLM endpoint not configured. Set it via:\n" +
          "  - config: createNexus({ llm: { endpoint: \"https://api.deepseek.com/v1\" } })\n" +
          "  - nexus.yaml: llm.endpoint\n" +
          "  - env var: LLM_ENDPOINT"
        );
      }

      const url = `${endpoint}/chat/completions`;
      const model = request.model ?? defaultModel;
      if (!model) {
        throw new Error(
          "LLM model not configured. Set it via:\n" +
          "  - config: createNexus({ llm: { model: \"deepseek-chat\" } })\n" +
          "  - nexus.yaml: llm.model\n" +
          "  - env var: LLM_MODEL"
        );
      }

      const body = {
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        ...(request.max_tokens ? { max_tokens: request.max_tokens } : {}),
        ...(request.response_format ? { response_format: request.response_format } : {}),
      };

      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
          }

          const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            const error = new Error(`LLM API error ${res.status}: ${text}`);

            // Retry on rate limits and server errors
            if ((res.status === 429 || res.status >= 500) && attempt < retries) {
              lastError = error;
              const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }

            throw error;
          }

          return (await res.json()) as ChatCompletionResponse;
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("LLM API error")) {
            throw error; // Don't retry non-network errors
          }
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
        }
      }

      throw lastError ?? new Error("LLM request failed");
    },
  };
}
