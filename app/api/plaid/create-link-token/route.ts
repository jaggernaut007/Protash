import { NextRequest, NextResponse } from 'next/server';
import { createLinkToken } from '@/lib/plaid';
import { requireSecret } from '@/lib/apiGuard';

export async function POST(req: NextRequest) {
  const denied = requireSecret(req, process.env.CRON_SECRET);
  if (denied) return denied;

  try {
    const { link_token } = await createLinkToken('sovereign-os-user');
    return NextResponse.json({ link_token });
  } catch (err) {
    console.error('[Plaid] create-link-token failed:', err);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
