import { NextResponse } from 'next/server';
import { getTransactionSummary, getAccessToken } from '@/lib/plaid';

export async function GET() {
  try {
    if (!getAccessToken()) {
      return NextResponse.json({ connected: false }, { status: 200 });
    }

    const summary = await getTransactionSummary();
    return NextResponse.json({ connected: true, ...summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
