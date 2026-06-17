/**
 * Central AI configuration.
 * Use this to control which model powers code generation.
 */

import type { LanguageModelV2Usage } from '@ai-sdk/provider';
import { createOpenAI } from '@ai-sdk/openai';

// ai-sdk v2 classifies any non-GPT model as a "reasoning model" and sends role:"developer",
// which DeepSeek rejects. This fetch wrapper rewrites it back to "system" before the request goes out.
const deepseekFetch: typeof fetch = async (url, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      if (Array.isArray(body.messages)) {
        body.messages = body.messages.map((m: { role: string }) =>
          m.role === 'developer' ? { ...m, role: 'system' } : m
        );
        return fetch(url as string, { ...init, body: JSON.stringify(body) });
      }
    } catch { /* pass through if parse fails */ }
  }
  return fetch(url as string, init);
};

export const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
  fetch: deepseekFetch,
});

// Orchestrator tier: complex reasoning, planning, and code generation (stages 1-4, code fixes)
// deepseek-chat = DeepSeek-V3 — top-ranked coding model, $0.27/M input tokens
export const ORCHESTRATOR_MODEL = 'deepseek-chat';

// Worker tier: structured evaluation, scoring, safety checks (stages 5-6, pre-check, eval)
export const WORKER_MODEL = 'deepseek-chat';

// Legacy alias — kept so any external references don't break
export const CODING_MODEL = ORCHESTRATOR_MODEL;

export function summarizeUsage(usage?: LanguageModelV2Usage) {
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens: usage?.totalTokens ?? inputTokens + outputTokens,
    reasoningTokens: usage?.reasoningTokens ?? 0,
    cachedInputTokens: usage?.cachedInputTokens ?? 0,
  };
}
