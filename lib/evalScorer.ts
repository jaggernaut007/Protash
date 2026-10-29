/**
 * Offline evaluation scorer for the prototype generation pipeline.
 * Combines deterministic checks with LLM-as-judge dimensional scoring.
 */

import { generateText } from 'ai';
import { z } from 'zod';
import { deepseekModel } from './aiConfig';
import { parseAgentOutput } from './agentContracts';
import type { EvalCase } from '../evals/intents';
import type { BusinessContext, Spec, UXPlan } from './agentContracts';

// ─── Score Result Schema ─────────────────────────────────────────────────────

export const ScoreResultSchema = z.object({
  businessContextAccuracy: z.number().min(0).max(10),
  specQuality: z.number().min(0).max(10),
  visualEnterpriseQuality: z.number().min(0).max(10),
  dataRealism: z.number().min(0).max(10),
  businessOutcomeClarity: z.number().min(0).max(10),
  overallScore: z.number().min(0).max(10),
  passed: z.boolean(),
  justification: z.record(z.string(), z.string()),
});

export type ScoreResult = z.infer<typeof ScoreResultSchema>;

// Dimension weights (must sum to 1.0)
const WEIGHTS = {
  businessContextAccuracy: 0.20,
  specQuality:             0.15,
  visualEnterpriseQuality: 0.25,
  dataRealism:             0.25,
  businessOutcomeClarity:  0.15,
};

const PASS_THRESHOLD = 7.0;

// ─── Deterministic Pre-Checks ────────────────────────────────────────────────

export interface DeterministicCheckResult {
  passed: boolean;
  failures: string[];
}

export function runDeterministicChecks(
  evalCase: EvalCase,
  code: string,
  businessContext?: BusinessContext
): DeterministicCheckResult {
  const failures: string[] = [];

  // 1. Code must export default
  if (!code.includes('export default')) {
    failures.push('Code does not contain "export default"');
  }

  // 2. Must not contain generic placeholder text
  for (const banned of evalCase.mustNotContain) {
    if (code.toLowerCase().includes(banned.toLowerCase())) {
      failures.push(`Code contains banned placeholder: "${banned}"`);
    }
  }

  // 3. Must contain at least one expected chart type
  const hasChart = evalCase.expectedChartTypes.some(chart => code.includes(chart));
  if (!hasChart) {
    failures.push(`No expected chart found. Expected one of: ${evalCase.expectedChartTypes.join(', ')}`);
  }

  // 4. At least one KPI keyword must appear in code
  const hasKpi = evalCase.expectedKpiKeywords.some(
    kw => code.toLowerCase().includes(kw.toLowerCase())
  );
  if (!hasKpi) {
    failures.push(`No KPI keyword found. Expected one of: ${evalCase.expectedKpiKeywords.join(', ')}`);
  }

  // 5. If businessContext provided, check entities appear in it
  if (businessContext) {
    const contextStr = JSON.stringify(businessContext).toLowerCase();
    const missingEntities = evalCase.expectedEntities.filter(
      entity => !contextStr.includes(entity.toLowerCase())
    );
    if (missingEntities.length > evalCase.expectedEntities.length / 2) {
      failures.push(`Most expected entities missing from business context: ${missingEntities.join(', ')}`);
    }
  }

  return { passed: failures.length === 0, failures };
}

// ─── LLM-as-Judge Scorer ────────────────────────────────────────────────────

export async function scorePrototype(
  evalCase: EvalCase,
  code: string,
  businessContext?: BusinessContext,
  spec?: Spec,
  uxPlan?: UXPlan
): Promise<ScoreResult> {
  // Run deterministic checks first
  const deterministicResult = runDeterministicChecks(evalCase, code, businessContext);

  // If deterministic checks have hard failures, penalize heavily
  const deterministicPenalty = deterministicResult.failures.length > 0 ? 3 : 0;

  const { text } = await generateText({
    model: deepseekModel('structured'),
    system: `You are an enterprise prototype quality evaluator. Score the generated prototype on 5 dimensions (0-10 each).
Be strict and honest. A score of 10 means production-ready. A score below 5 means significant issues.
Respond ONLY with valid JSON.`,
    prompt: `Evaluate this enterprise prototype:

ORIGINAL INTENT: "${evalCase.intent}"
EXPECTED DOMAIN: ${evalCase.expectedDomain}
EXPECTED KPIs: ${evalCase.expectedKpiKeywords.join(', ')}

BUSINESS CONTEXT EXTRACTED:
${businessContext ? JSON.stringify(businessContext, null, 2) : 'Not available'}

SPEC:
${spec ? JSON.stringify(spec, null, 2) : 'Not available'}

GENERATED CODE (first 3000 chars):
${code.substring(0, 3000)}

DETERMINISTIC CHECK FAILURES:
${deterministicResult.failures.length > 0 ? deterministicResult.failures.join('\n') : 'None'}

Score each dimension 0-10:
1. businessContextAccuracy: Did the pipeline correctly identify the domain, entities, KPIs, and workflows?
2. specQuality: Is the spec appropriate for the domain? Does the screen make sense?
3. visualEnterpriseQuality: Does the component look like a production enterprise dashboard? Enterprise palette? No glassmorphism?
4. dataRealism: Is the data realistic and domain-specific? No Lorem ipsum, no "User 1"?
5. businessOutcomeClarity: Are the KPIs visible? Does the prototype answer the business hypothesis?

Return JSON:
{
  "businessContextAccuracy": 0-10,
  "specQuality": 0-10,
  "visualEnterpriseQuality": 0-10,
  "dataRealism": 0-10,
  "businessOutcomeClarity": 0-10,
  "justification": {
    "businessContextAccuracy": "one sentence",
    "specQuality": "one sentence",
    "visualEnterpriseQuality": "one sentence",
    "dataRealism": "one sentence",
    "businessOutcomeClarity": "one sentence"
  }
}`,
  });

  try {
    const raw = parseAgentOutput(text, ScoreResultSchema.omit({ overallScore: true, passed: true }));

    // Apply deterministic penalty
    const penalized = {
      businessContextAccuracy: Math.max(0, raw.businessContextAccuracy - deterministicPenalty),
      specQuality: Math.max(0, raw.specQuality - deterministicPenalty),
      visualEnterpriseQuality: Math.max(0, raw.visualEnterpriseQuality - deterministicPenalty),
      dataRealism: Math.max(0, raw.dataRealism - deterministicPenalty * 1.5),
      businessOutcomeClarity: Math.max(0, raw.businessOutcomeClarity - deterministicPenalty),
    };

    const overallScore = Math.round(
      (penalized.businessContextAccuracy * WEIGHTS.businessContextAccuracy +
       penalized.specQuality * WEIGHTS.specQuality +
       penalized.visualEnterpriseQuality * WEIGHTS.visualEnterpriseQuality +
       penalized.dataRealism * WEIGHTS.dataRealism +
       penalized.businessOutcomeClarity * WEIGHTS.businessOutcomeClarity) * 10
    ) / 10;

    const justification: Record<string, string> = {
      ...raw.justification,
      ...(deterministicResult.failures.length > 0
        ? { deterministicFailures: deterministicResult.failures.join('; ') }
        : {}),
    };

    return {
      ...penalized,
      overallScore,
      passed: overallScore >= PASS_THRESHOLD,
      justification,
    };
  } catch (error) {
    // Fallback: return a failed score with error info
    const failScore = deterministicResult.passed ? 5 : 2;
    return {
      businessContextAccuracy: failScore,
      specQuality: failScore,
      visualEnterpriseQuality: failScore,
      dataRealism: failScore,
      businessOutcomeClarity: failScore,
      overallScore: failScore,
      passed: failScore >= PASS_THRESHOLD,
      justification: {
        error: `Scorer failed to parse LLM response: ${String(error)}`,
        deterministicFailures: deterministicResult.failures.join('; '),
      },
    };
  }
}
