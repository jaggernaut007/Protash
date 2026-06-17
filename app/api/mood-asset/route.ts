/**
 * POST /api/mood-asset
 * Prototype generation endpoint — implements the 6-stage DDD pipeline.
 * Kept at this path for backward compatibility with IntentConsole.
 * Phase 4 will migrate IntentConsole to /api/prototype with stage events.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  businessContextAgent,
  specAgent,
  uxArchitectAgent,
  generatePrototypeCode,
  frontendAgent,
  qaAgent,
  reviewerAgent,
} from '@/lib/agents';
import { MoodAssetContext } from '@/lib/agents';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { context, refinement } = body as { context: MoodAssetContext; refinement?: string };

    if (!context?.intentDescription) {
      return NextResponse.json({ error: 'Missing context.intentDescription' }, { status: 400 });
    }

    const intentDescription = context.intentDescription;
    const refinementText = typeof refinement === 'string' ? refinement.trim() : '';
    const fullIntent = refinementText
      ? `${intentDescription}\nRefinement: ${refinementText}`
      : intentDescription;

    console.log('[/api/mood-asset] Stage 1: Business Context');
    const businessContext = await businessContextAgent(fullIntent);

    console.log('[/api/mood-asset] Stage 2: Spec');
    const spec = await specAgent(businessContext);

    console.log('[/api/mood-asset] Stage 3: UX Architecture');
    const uxPlan = await uxArchitectAgent(businessContext, spec);

    console.log('[/api/mood-asset] Stage 4: Code Generation');
    let code = await generatePrototypeCode(fullIntent, businessContext, spec, uxPlan);

    // Pre-check: frontend safety (sequential, hard fail gate)
    console.log('[/api/mood-asset] Pre-check: Frontend Safety');
    const safety = await frontendAgent.evaluate(fullIntent, code);
    if (!safety.approved) {
      console.log('[/api/mood-asset] Frontend safety failed, attempting fix...');
      code = await generatePrototypeCode(fullIntent, businessContext, spec, uxPlan, code, [safety.feedback]);
    }

    // Stages 5 + 6: Parallel evaluation
    let approved = false;
    let qaResult: { approved: boolean; feedback: string; suggestions?: string[] } | undefined;
    let reviewResult: { approved: boolean; feedback: string; suggestions?: string[] } | undefined;
    const MAX_RETRIES = 3;

    for (let i = 0; i < MAX_RETRIES; i++) {
      console.log(`[/api/mood-asset] Stages 5+6: Parallel QA+Review (attempt ${i + 1})`);
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

      const blockers = [
        ...(!qa.approved ? (qa.suggestions ?? []).slice(0, 3) : []),
        ...(!review.approved ? (review.suggestions ?? []).slice(0, 3) : []),
      ];

      console.log('[/api/mood-asset] Blockers found, regenerating code...');
      code = await generatePrototypeCode(fullIntent, businessContext, spec, uxPlan, code, blockers);
    }

    console.log(`[/api/mood-asset] Complete. approved=${approved}`);

    return NextResponse.json({
      code,
      approved,
      evaluations: {
        qa: qaResult,
        reviewer: reviewResult,
        frontend: safety,
      },
      businessContext,
      spec,
      uxPlan,
      mood: 'enterprise',
    });
  } catch (error) {
    console.error('[/api/mood-asset] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
