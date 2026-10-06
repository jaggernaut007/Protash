import { NextRequest, NextResponse } from 'next/server';
import { getTransactionSummary, getAccessToken } from '@/lib/plaid';
import { requireSecret } from '@/lib/apiGuard';

export async function GET(req: NextRequest) {
  const denied = requireSecret(req, process.env.CRON_SECRET);
  if (denied) return denied;

  try {
    if (!getAccessToken()) {
      return NextResponse.json({ connected: false }, { status: 200 });
    }

    const summary = await getTransactionSummary();
    return NextResponse.json({ connected: true, ...summary });
  } catch (err) {
    console.error('[Plaid] transactions failed:', err);
    return NextResponse.json({ error: 'Failed to load transactions' }, { status: 500 });
  }
}
