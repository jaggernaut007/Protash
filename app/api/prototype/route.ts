/**
 * POST /api/prototype
 * 6-stage enterprise prototype generation with per-stage MessageBus events.
 * This is the canonical prototype endpoint; /api/mood-asset is a compatibility alias.
 */

import { NextRequest } from 'next/server';
import { MessageBus } from '@/lib/messageBus';
import { handlePrototypeRequest } from '@/lib/prototypeRoute';

export async function POST(request: NextRequest) {
  // Stage events go to a server-side MessageBus instance (Phase 4 UI listens on SSE).
  const mb = new MessageBus();
  return handlePrototypeRequest(request, '/api/prototype', {
    onStage: (stage, data) => {
      mb.publishToTopic('prototype:stage:complete', { stage, ...data });
      console.log(`[/api/prototype] ✓ ${stage}`);
    },
  });
}
