import { NextRequest, NextResponse } from 'next/server';
import { exchangePublicToken, setAccessToken } from '@/lib/plaid';

export async function POST(req: NextRequest) {
  try {
    const { public_token } = await req.json();
    if (!public_token) {
      return NextResponse.json({ error: 'Missing public_token' }, { status: 400 });
    }

    const { access_token, item_id } = await exchangePublicToken(public_token);
    setAccessToken(access_token);

    console.log(`[Plaid] Bank linked. item_id=${item_id}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
