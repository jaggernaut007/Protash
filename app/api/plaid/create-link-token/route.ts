import { NextResponse } from 'next/server';
import { createLinkToken } from '@/lib/plaid';

export async function POST() {
  try {
    const { link_token } = await createLinkToken('sovereign-os-user');
    return NextResponse.json({ link_token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
