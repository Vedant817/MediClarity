import test from "node:test";
import assert from "node:assert/strict";
import {
  groqModelForTask,
  invokeWithRetry,
  isRateLimitError,
  rateLimitDelayMs,
} from "../src/lib/llm.ts";

const ROUTING_KEYS = ["GROQ_MODEL", "GROQ_EXTRACT_MODEL", "GROQ_ENRICH_MODEL", "GROQ_SUMMARY_MODEL", "GROQ_CHAT_MODEL"];

function withEnv(vars, fn) {
  const saved = {};
  for (const key of ROUTING_KEYS) saved[key] = process.env[key];
  for (const key of ROUTING_KEYS) delete process.env[key];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const key of ROUTING_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(saved)) {
      if (value !== undefined) process.env[key] = value;
    }
  }
}

test("model routing defaults every task to GROQ_MODEL", () => {
  withEnv({ GROQ_MODEL: "openai/gpt-oss-20b" }, () => {
    for (const task of ["extract", "enrich", "summary", "chat", "triage", "translate", "scheduler", "follow-up"]) {
      assert.equal(groqModelForTask(task), "openai/gpt-oss-20b");
    }
  });
});

test("model routing honors per-task overrides for free-tier buckets", () => {
  withEnv(
    {
      GROQ_MODEL: "openai/gpt-oss-20b",
      GROQ_EXTRACT_MODEL: "openai/gpt-oss-20b",
      GROQ_ENRICH_MODEL: "openai/gpt-oss-120b",
      GROQ_SUMMARY_MODEL: "qwen/qwen3.6-27b",
      GROQ_CHAT_MODEL: "groq/compound-mini",
    },
    () => {
      assert.equal(groqModelForTask("extract"), "openai/gpt-oss-20b");
      assert.equal(groqModelForTask("enrich"), "openai/gpt-oss-120b");
      assert.equal(groqModelForTask("summary"), "qwen/qwen3.6-27b");
      assert.equal(groqModelForTask("chat"), "groq/compound-mini");
      assert.equal(groqModelForTask("triage"), "groq/compound-mini");
    },
  );
});

test("detects rate-limit failures across error shapes", () => {
  assert.equal(isRateLimitError({ status: 429 }), true);
  assert.equal(isRateLimitError({ code: "rate_limit_exceeded" }), true);
  assert.equal(isRateLimitError(new Error("429 rate_limit_exceeded")), true);
  assert.equal(isRateLimitError(new Error("Rate limit reached, try again in 13s")), true);
  assert.equal(isRateLimitError(new Error("Model did not return JSON")), false);
  assert.equal(isRateLimitError(null), false);
});

test("honors Groq retry-after hint and backs off otherwise", () => {
  const hinted = rateLimitDelayMs(new Error("Please try again in 13.2825s."), 0);
  assert.ok(hinted >= 13782 && hinted <= 13783);
  assert.equal(rateLimitDelayMs(new Error("429"), 0), 4000);
  assert.equal(rateLimitDelayMs(new Error("429"), 1), 8000);
  assert.equal(rateLimitDelayMs(new Error("429"), 10), 60000);
});

test("invokeWithRetry waits out rate limits then succeeds", async () => {
  const sleeps = [];
  let calls = 0;
  const result = await invokeWithRetry(
    () => {
      calls += 1;
      if (calls < 3) throw new Error("Rate limit reached, try again in 0.01s");
      return Promise.resolve("ok");
    },
    { sleep: (ms) => { sleeps.push(ms); return Promise.resolve(); } },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.equal(sleeps.length, 2);
});

test("invokeWithRetry rethrows non-rate-limit errors immediately", async () => {
  let calls = 0;
  await assert.rejects(
    invokeWithRetry(() => {
      calls += 1;
      return Promise.reject(new Error("Model did not return JSON"));
    }),
    /did not return JSON/,
  );
  assert.equal(calls, 1);
});
