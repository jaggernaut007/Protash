/**
 * POST /api/prototype
 * 6-stage enterprise prototype generation with per-stage MessageBus events.
 * This is the canonical prototype endpoint; /api/mood-asset delegates to the same pipeline.
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
  MoodAssetContext,
} from '@/lib/agents';
import { MessageBus } from '@/lib/messageBus';

const STAGE_NAMES = [
  'Business Context',
  'Spec',
  'UX Architecture',
  'Development',
  'QA',
  'Review',
] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { context, refinement, messageBusTopics } = body as {
      context: MoodAssetContext;
      refinement?: string;
      messageBusTopics?: boolean;
    };

    if (!context?.intentDescription) {
      return NextResponse.json({ error: 'Missing context.intentDescription' }, { status: 400 });
    }

    const intentDescription = context.intentDescription;
    const refinementText = typeof refinement === 'string' ? refinement.trim() : '';
    const fullIntent = refinementText
      ? `${intentDescription}\nRefinement: ${refinementText}`
      : intentDescription;

    // We publish stage events via a server-side MessageBus instance.
    // Client connects via the prototype:stage:complete topic (Phase 4 UI listens on SSE).
    const mb = new MessageBus();
    const publishStage = (stage: typeof STAGE_NAMES[number], data: Record<string, unknown>) => {
      mb.publishToTopic('prototype:stage:complete', { stage, ...data });
      console.log(`[/api/prototype] ✓ ${stage}`);
    };

    // Stage 1: Business Context
    const businessContext = await businessContextAgent(fullIntent);
    publishStage('Business Context', { businessContext });

    // Stage 2: Spec
    const spec = await specAgent(businessContext);
    publishStage('Spec', { spec });

    // Stage 3: UX Architecture
    const uxPlan = await uxArchitectAgent(businessContext, spec);
    publishStage('UX Architecture', { uxPlan });

    // Stage 4: Code Generation
    let code = await generatePrototypeCode(fullIntent, businessContext, spec, uxPlan);
    publishStage('Development', { codeLength: code.length });

    // Pre-check: Frontend safety
    const safety = await frontendAgent.evaluate(fullIntent, code);
    if (!safety.approved) {
      code = await generatePrototypeCode(fullIntent, businessContext, spec, uxPlan, code, [safety.feedback]);
    }

    // Stages 5+6: Parallel QA + Review
    let approved = false;
    let qaResult;
    let reviewResult;
    const MAX_RETRIES = 3;

    for (let i = 0; i < MAX_RETRIES; i++) {
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
      code = await generatePrototypeCode(fullIntent, businessContext, spec, uxPlan, code, blockers);
    }

    publishStage('QA', { approved: qaResult?.approved });
    publishStage('Review', { approved: reviewResult?.approved });

    return NextResponse.json({
      code,
      approved,
      businessContext,
      spec,
      uxPlan,
      evaluations: {
        qa: qaResult,
        reviewer: reviewResult,
        frontend: safety,
      },
    });
  } catch (error) {
    console.error('[/api/prototype] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
