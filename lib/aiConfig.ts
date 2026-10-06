/**
 * Central AI configuration.
 * Use this to control which model powers each pipeline stage and how it runs.
 *
 * Model: DeepSeek V4.1 Flash (released 2026-09-10; 1M context, 384K max output).
 * The API ID `deepseek-flash` always points to the latest Flash release. It has no version pin.
 * The old IDs `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` are temporary aliases.
 * Sources: https://api-docs.deepseek.com/updates/ and https://api-docs.deepseek.com/quick_start/pricing
 *
 * Token budget notes (from the DeepSeek API docs):
 * - `max_tokens` defaults to 8K when thinking is off. A long generated component hits this cap
 *   and is cut off mid-file. Every request sets `max_tokens` explicitly, per profile.
 * - Thinking is on by default. Reasoning tokens use the same output budget, so the code-generation
 *   profiles reserve room for the reasoning plus the full component.
 * - Thinking ignores temperature, top_p and the penalty parameters.
 */

import type { LanguageModelV2Usage } from '@ai-sdk/provider';
import { createOpenAI } from '@ai-sdk/openai';

export const DEEPSEEK_MODEL = 'deepseek-flash';

export type ModelProfile = 'structured' | 'evaluator' | 'codegen' | 'revision';

export interface ProfileSettings {
  thinking: 'enabled' | 'disabled';
  reasoningEffort?: 'low' | 'high' | 'max';
  /** Output budget in tokens. It covers reasoning tokens and the final answer. */
  maxTokens: number;
}

export const MODEL_PROFILES: Record<ModelProfile, ProfileSettings> = {
  // Short JSON documents (stages 1-3). Thinking adds latency and no value here.
  structured: { thinking: 'disabled', maxTokens: 4096 },
  // Approve / reject verdicts (QA, reviewer, frontend safety). A verdict is about 250 tokens.
  evaluator: { thinking: 'disabled', maxTokens: 2048 },
  // First code generation (stage 4). Reasoning plans the component. Code is 6K-12K tokens.
  codegen: { thinking: 'enabled', reasoningEffort: 'high', maxTokens: 32768 },
  // Fixing a known list of blockers. Low effort keeps the request inside the Cloud Run timeout.
  revision: { thinking: 'enabled', reasoningEffort: 'low', maxTokens: 24576 },
};

/** Rewrite one request body for DeepSeek. Exported for tests. */
export function applyProfile(
  body: Record<string, unknown>,
  settings: ProfileSettings
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...body };

  // ai-sdk v2 classifies any non-GPT model as a "reasoning model" and sends role:"developer",
  // which DeepSeek rejects. Rewrite it back to "system".
  if (Array.isArray(next.messages)) {
    next.messages = next.messages.map((m: { role: string }) =>
      m.role === 'developer' ? { ...m, role: 'system' } : m
    );
  }

  // The same classification sends max_completion_tokens, which DeepSeek ignores.
  delete next.max_completion_tokens;
  next.max_tokens = settings.maxTokens;

  next.thinking = { type: settings.thinking };
  if (settings.thinking === 'enabled' && settings.reasoningEffort) {
    next.reasoning_effort = settings.reasoningEffort;
  }
  return next;
}

function profileFetch(settings: ProfileSettings): typeof fetch {
  return async (url, init) => {
    if (init?.body && typeof init.body === 'string') {
      try {
        const body = applyProfile(JSON.parse(init.body), settings);
        return fetch(url as string, { ...init, body: JSON.stringify(body) });
      } catch {
        /* pass through if the body is not JSON */
      }
    }
    return fetch(url as string, init);
  };
}

const providers = new Map<ModelProfile, ReturnType<typeof createOpenAI>>();

/** Language model for one pipeline role. */
export function deepseekModel(profile: ModelProfile) {
  let provider = providers.get(profile);
  if (!provider) {
    provider = createOpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1',
      fetch: profileFetch(MODEL_PROFILES[profile]),
    });
    providers.set(profile, provider);
  }
  return provider.chat(DEEPSEEK_MODEL);
}

// Legacy aliases — kept so external references do not break.
export const ORCHESTRATOR_MODEL = DEEPSEEK_MODEL;
export const WORKER_MODEL = DEEPSEEK_MODEL;
export const CODING_MODEL = DEEPSEEK_MODEL;

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
