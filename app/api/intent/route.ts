/**
 * POST /api/intent
 * Intent acknowledgement endpoint.
 * The full business context extraction is now handled inside /api/mood-asset
 * as Stage 1 of the 6-stage pipeline. This route is kept for backward
 * compatibility with IntentConsole but no longer runs a separate LLM call.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const intent = body?.intentDescription || '';

    // Acknowledge intent — full context extraction happens in the prototype pipeline
    return NextResponse.json({
      reasoning: `Enterprise prototype pipeline will generate from: "${intent.substring(0, 80)}"`,
      requiresUI: true,
      uiType: 'dashboard',
      guidance: 'Enterprise prototype mode — domain-driven 6-stage pipeline will handle generation.',
      nextSteps: ['businessContext', 'spec', 'uxPlan', 'codeGen', 'qa', 'review'],
      confidence: 0.95,
    });
  } catch (error) {
    console.error('[/api/intent] Error:', error);
    return NextResponse.json({ error: 'Failed to assess intent' }, { status: 500 });
  }
}
