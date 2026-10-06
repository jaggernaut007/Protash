import { NextRequest, NextResponse } from 'next/server';
import { exchangePublicToken, setAccessToken } from '@/lib/plaid';
import { requireSecret } from '@/lib/apiGuard';

export async function POST(req: NextRequest) {
  const denied = requireSecret(req, process.env.CRON_SECRET);
  if (denied) return denied;

  try {
    const { public_token } = await req.json();
    if (!public_token || typeof public_token !== 'string') {
      return NextResponse.json({ error: 'Missing public_token' }, { status: 400 });
    }

    const { access_token, item_id } = await exchangePublicToken(public_token);
    setAccessToken(access_token);

    console.log(`[Plaid] Bank linked. item_id=${item_id}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Plaid] exchange-token failed:', err);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
