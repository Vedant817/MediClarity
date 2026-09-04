import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";

export type LLMTask =
  | "extract"
  | "chat"
  | "triage"
  | "translate"
  | "scheduler"
  | "follow-up";

const taskOptions: Record<LLMTask, { temperature: number; maxTokens: number }> = {
  extract: { temperature: 0, maxTokens: 2400 },
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
      model: runtimeSetting("GROQ_MODEL", process.env.GROQ_MODEL, "llama-3.1-8b-instant"),
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
