/**
 * Request handling shared by POST /api/prototype and POST /api/mood-asset.
 * Each request costs up to about 11 LLM calls, so the route limits input size and request rate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readJsonBody, rateLimit } from './apiGuard';
import { runPrototypePipeline, type StageName } from './pipeline';
import { CodeGenerationError } from './agents';

// The client also sends boardContext (saved components, 15-35 KB each), so the body cap is generous.
// The prompt only uses intentDescription and refinement, and those two have tight caps.
export const MAX_BODY_BYTES = 512 * 1024;
export const MAX_INTENT_CHARS = 4000;
export const MAX_REFINEMENT_CHARS = 2000;
// One request takes 40-120s, so 15 a minute is far above normal use. It still bounds anonymous cost.
export const RATE_LIMIT = 15;
export const RATE_WINDOW_MS = 60_000;

export const PrototypeRequestSchema = z.object({
  context: z
    .object({ intentDescription: z.string().trim().min(1).max(MAX_INTENT_CHARS) })
    .passthrough(),
  refinement: z.string().max(MAX_REFINEMENT_CHARS).optional(),
  messageBusTopics: z.boolean().optional(),
});

export async function handlePrototypeRequest(
  request: NextRequest,
  tag: string,
  options: {
    onStage?: (stage: StageName, data: Record<string, unknown>) => void;
    extra?: Record<string, unknown>;
  } = {}
): Promise<NextResponse> {
  const limited = rateLimit(request, 'prototype', RATE_LIMIT, RATE_WINDOW_MS);
  if (limited) return limited;

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;

  const parsed = PrototypeRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.code === 'too_big');
    return NextResponse.json(
      { error: tooLong ? 'Intent or refinement is too long' : 'Missing context.intentDescription' },
      { status: tooLong ? 413 : 400 }
    );
  }

  const { context, refinement } = parsed.data;
  const refinementText = refinement?.trim() ?? '';
  const fullIntent = refinementText
    ? `${context.intentDescription}\nRefinement: ${refinementText}`
    : context.intentDescription;

  try {
    const result = await runPrototypePipeline(fullIntent, options.onStage);
    return NextResponse.json({ ...result, ...options.extra });
  } catch (error) {
    // Log the detail on the server. Return a generic message to the client.
    console.error(`[${tag}] Error:`, error);
    if (error instanceof CodeGenerationError) {
      return NextResponse.json(
        { error: 'The model could not produce a valid component. Try a simpler request.' },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: 'Prototype generation failed' }, { status: 500 });
  }
}
