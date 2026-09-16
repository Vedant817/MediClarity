import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";

export type LLMTask =
  | "extract"
  | "enrich"
  | "summary"
  | "visualize"
  | "chat"
  | "triage"
  | "translate"
  | "scheduler"
  | "follow-up";

const taskOptions: Record<LLMTask, { temperature: number; maxTokens: number }> = {
  extract: { temperature: 0, maxTokens: 6000 },
  enrich: { temperature: 0, maxTokens: 3000 },
  summary: { temperature: 0.25, maxTokens: 1500 },
  visualize: { temperature: 0.1, maxTokens: 800 },
  chat: { temperature: 0.25, maxTokens: 1500 },
  triage: { temperature: 0.1, maxTokens: 1200 },
  translate: { temperature: 0.1, maxTokens: 2000 },
  scheduler: { temperature: 0.4, maxTokens: 1600 },
  "follow-up": { temperature: 0.3, maxTokens: 500 },
};

function runtimeSetting(name: string, value: string | undefined, developmentDefault: string): string {
  const configured = value?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return developmentDefault;
  throw new Error(`${name} must be configured in production`);
}

/**
 * Free-tier headroom: Groq enforces TPM/RPD limits per model, so each
 * pipeline stage can use its own bucket. GROQ_MODEL remains the default for
 * every task; set the optional overrides to spread load without paying more.
 */
export function groqModelForTask(task: LLMTask): string {
  const base = runtimeSetting("GROQ_MODEL", process.env.GROQ_MODEL, "openai/gpt-oss-20b");
  if (task === "extract") return process.env.GROQ_EXTRACT_MODEL?.trim() || base;
  if (task === "enrich" || task === "summary" || task === "visualize") {
    const override =
      task === "enrich" || task === "visualize"
        ? process.env.GROQ_ENRICH_MODEL
        : process.env.GROQ_SUMMARY_MODEL;
    return override?.trim() || base;
  }
  return process.env.GROQ_CHAT_MODEL?.trim() || base;
}

export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return typeof error === "string" && /429|rate limit/i.test(error);
  }
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  if (candidate.status === 429 || candidate.code === 429 || candidate.code === "rate_limit_exceeded") return true;
  return /429|rate limit/i.test(String(candidate.message ?? ""));
}

/** Honor Groq's `retry-after` hint ("try again in 43.8s"); otherwise back off. */
export function rateLimitDelayMs(error: unknown, attempt: number): number {
  const text = error instanceof Error ? error.message : String(error ?? "");
  const hinted = text.match(/try again in ([\d.]+)s/i);
  if (hinted) return Math.min(60_000, Math.ceil(Number.parseFloat(hinted[1]) * 1000) + 500);
  return Math.min(60_000, 4_000 * 2 ** attempt);
}

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_MESSAGE = /overload|timeout|temporar|try again|fetch failed|socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN|service unavailable|bad gateway|gateway timeout|internal error/i;

/**
 * Retryable provider failures: rate limits plus overloaded/unreachable
 * servers and dropped connections. Groq free tier returns 503/500/overload
 * under load as often as 429 — retrying only 429 leaves booking turns
 * failing with a generic error. Only used pre-first-chunk, where repeating
 * the same prompt is side-effect free.
 */
export function isTransientLLMError(error: unknown): boolean {
  if (isRateLimitError(error)) return true;
  if (typeof error === "string") return TRANSIENT_MESSAGE.test(error);
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  if (typeof candidate.status === "number" && TRANSIENT_STATUS.has(candidate.status)) return true;
  if (typeof candidate.code === "number" && TRANSIENT_STATUS.has(candidate.code)) return true;
  return TRANSIENT_MESSAGE.test(String(candidate.message ?? ""));
}

/**
 * Invoke an LLM call, transparently retrying transient provider failures.
 * Quality-neutral: same model and prompt, with provider-directed backoff.
 */
export async function invokeWithRetry<T>(
  invoke: () => Promise<T>,
  options?: { retries?: number; sleep?: (ms: number) => Promise<void> },
): Promise<T> {
  const retries = options?.retries ?? 2;
  const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await invoke();
    } catch (error) {
      lastError = error;
      if (!isTransientLLMError(error) || attempt === retries) throw error;
      await sleep(rateLimitDelayMs(error, attempt));
    }
  }
  throw lastError;
}

export function getLLM(task: LLMTask = "chat") {
  const provider = (process.env.AI_PROVIDER || "groq").trim().toLowerCase();
  const options = taskOptions[task];

  if (provider === "groq") {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is required when AI_PROVIDER=groq");
    }

    return new ChatGroq({
      apiKey,
      model: groqModelForTask(task),
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
  }

  if (provider === "ollama") {
    return new ChatOllama({
      baseUrl: runtimeSetting("OLLAMA_BASE_URL", process.env.OLLAMA_BASE_URL, "http://127.0.0.1:11434"),
      model: runtimeSetting("OLLAMA_MODEL", process.env.OLLAMA_MODEL, "qwen2.5:7b"),
      temperature: options.temperature,
      numPredict: options.maxTokens,
      maxRetries: 2,
    });
  }

  throw new Error(`Unsupported AI_PROVIDER "${provider}". Use "groq" or "ollama".`);
}

/** Normalize LangChain provider output without leaking provider-specific shapes. */
export function llmContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(llmContentToText).join("");
  if (!content || typeof content !== "object") return "";

  const part = content as { text?: unknown; content?: unknown };
  if (typeof part.text === "string") return part.text;
  if (part.content !== undefined) return llmContentToText(part.content);
  return "";
}
