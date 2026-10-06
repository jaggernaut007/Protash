/**
 * Shared 6-stage prototype pipeline used by /api/prototype and /api/mood-asset.
 */

import {
  businessContextAgent,
  specAgent,
  uxArchitectAgent,
  generatePrototypeCode,
  frontendAgent,
  qaAgent,
  reviewerAgent,
} from './agents';
import type { AgentResponse } from './messageBus';
import type { BusinessContext, Spec, UXPlan } from './agentContracts';

export const MAX_REVIEW_ROUNDS = 3;

export type StageName =
  | 'Business Context'
  | 'Spec'
  | 'UX Architecture'
  | 'Development'
  | 'QA'
  | 'Review';

export interface PipelineResult {
  code: string;
  approved: boolean;
  businessContext: BusinessContext;
  spec: Spec;
  uxPlan: UXPlan;
  evaluations: {
    qa?: AgentResponse;
    reviewer?: AgentResponse;
    frontend: AgentResponse;
  };
}

export async function runPrototypePipeline(
  fullIntent: string,
  onStage: (stage: StageName, data: Record<string, unknown>) => void = () => {}
): Promise<PipelineResult> {
  const businessContext = await businessContextAgent(fullIntent);
  onStage('Business Context', { businessContext });

  const spec = await specAgent(businessContext);
  onStage('Spec', { spec });

  const uxPlan = await uxArchitectAgent(businessContext, spec);
  onStage('UX Architecture', { uxPlan });

  let code = await generatePrototypeCode(fullIntent, businessContext, spec, uxPlan);
  onStage('Development', { codeLength: code.length });

  // Pre-check: frontend safety (one fix attempt)
  const safety = await frontendAgent.evaluate(fullIntent, code);
  if (!safety.approved) {
    code = await generatePrototypeCode(fullIntent, businessContext, spec, uxPlan, code, [safety.feedback]);
  }

  // Stages 5 + 6: QA and review in parallel. Regenerate only when another round will check the result.
  let approved = false;
  let qaResult: AgentResponse | undefined;
  let reviewResult: AgentResponse | undefined;

  for (let round = 1; round <= MAX_REVIEW_ROUNDS; round++) {
    const [qa, review] = await Promise.all([
      qaAgent.evaluate(fullIntent, code),
      reviewerAgent.evaluate(fullIntent, code),
    ]);
    qaResult = qa;
    reviewResult = review;

    if (qa.approved && review.approved) {
      approved = true;
      break;
    }
    if (round === MAX_REVIEW_ROUNDS) break;

    const blockers = [
      ...(!qa.approved ? (qa.suggestions ?? []).slice(0, 3) : []),
      ...(!review.approved ? (review.suggestions ?? []).slice(0, 3) : []),
    ];
    code = await generatePrototypeCode(fullIntent, businessContext, spec, uxPlan, code, blockers);
  }

  onStage('QA', { approved: qaResult?.approved });
  onStage('Review', { approved: reviewResult?.approved });

  return {
    code,
    approved,
    businessContext,
    spec,
    uxPlan,
    evaluations: { qa: qaResult, reviewer: reviewResult, frontend: safety },
  };
}
