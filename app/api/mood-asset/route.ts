/**
 * POST /api/mood-asset
 * Compatibility alias of POST /api/prototype. It runs the same 6-stage pipeline.
 */

import { NextRequest } from 'next/server';
import { handlePrototypeRequest } from '@/lib/prototypeRoute';

export async function POST(request: NextRequest) {
  return handlePrototypeRequest(request, '/api/mood-asset', {
    onStage: (stage) => console.log(`[/api/mood-asset] ✓ ${stage}`),
    extra: { mood: 'enterprise' },
  });
}
