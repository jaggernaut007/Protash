import { describe, it, expect } from 'vitest';
import {
  applyProfile,
  codegenEffort,
  MODEL_PROFILES,
  DEEPSEEK_MODEL,
  ORCHESTRATOR_MODEL,
  WORKER_MODEL,
} from '@/lib/aiConfig';

describe('model selection', () => {
  it('uses DeepSeek Flash for every tier', () => {
    expect(DEEPSEEK_MODEL).toBe('deepseek-flash');
    expect(ORCHESTRATOR_MODEL).toBe('deepseek-flash');
    expect(WORKER_MODEL).toBe('deepseek-flash');
  });
});

describe('MODEL_PROFILES', () => {
  it('gives code generation more room than the 8K default that cut off a run', () => {
    expect(MODEL_PROFILES.codegen.maxTokens).toBeGreaterThan(8192);
    expect(MODEL_PROFILES.revision.maxTokens).toBeGreaterThan(8192);
  });

  it('reserves room for reasoning on the thinking profiles', () => {
    // A component is 6K-12K tokens. Reasoning needs the rest of the budget.
    expect(MODEL_PROFILES.codegen.maxTokens).toBeGreaterThanOrEqual(24_000);
  });

  it('turns thinking off for short JSON and verdict stages', () => {
    expect(MODEL_PROFILES.structured.thinking).toBe('disabled');
    expect(MODEL_PROFILES.evaluator.thinking).toBe('disabled');
  });

  it('keeps the reasoning effort low, which scored higher and ran faster in the evals', () => {
    expect(MODEL_PROFILES.codegen.reasoningEffort).toBe('low');
    expect(MODEL_PROFILES.revision.reasoningEffort).toBe('low');
  });
});

describe('codegenEffort', () => {
  it('accepts low, high and max', () => {
    expect(codegenEffort('low', 'high')).toBe('high');
    expect(codegenEffort('low', 'max')).toBe('max');
    expect(codegenEffort('high', 'low')).toBe('low');
  });

  it('falls back for an unset or invalid value', () => {
    expect(codegenEffort('low', undefined)).toBe('low');
    expect(codegenEffort('low', 'turbo')).toBe('low');
    expect(codegenEffort('low', '')).toBe('low');
  });
});

describe('applyProfile', () => {
  const base = {
    model: 'deepseek-flash',
    messages: [
      { role: 'developer', content: 'rules' },
      { role: 'user', content: 'hi' },
    ],
    max_completion_tokens: 100,
  };

  it('rewrites the developer role to system', () => {
    const out = applyProfile(base, MODEL_PROFILES.structured) as { messages: { role: string }[] };
    expect(out.messages.map((m) => m.role)).toEqual(['system', 'user']);
  });

  it('sets max_tokens and removes max_completion_tokens', () => {
    const out = applyProfile(base, MODEL_PROFILES.codegen);
    expect(out.max_tokens).toBe(MODEL_PROFILES.codegen.maxTokens);
    expect(out).not.toHaveProperty('max_completion_tokens');
  });

  it('sends thinking and reasoning_effort for a thinking profile', () => {
    const out = applyProfile(base, MODEL_PROFILES.codegen);
    expect(out.thinking).toEqual({ type: 'enabled' });
    expect(out.reasoning_effort).toBe(MODEL_PROFILES.codegen.reasoningEffort);
  });

  it('disables thinking and sends no reasoning_effort for a plain profile', () => {
    const out = applyProfile(base, MODEL_PROFILES.evaluator);
    expect(out.thinking).toEqual({ type: 'disabled' });
    expect(out).not.toHaveProperty('reasoning_effort');
  });

  it('does not change the input body', () => {
    applyProfile(base, MODEL_PROFILES.codegen);
    expect(base.max_completion_tokens).toBe(100);
    expect(base.messages[0].role).toBe('developer');
  });
});
