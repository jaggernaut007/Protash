/**
 * Plaid REST client — no npm package, pure fetch.
 * Docs: https://plaid.com/docs/api/
 */

const PLAID_ENV = process.env.PLAID_ENV ?? 'sandbox';
const BASE_URL =
  PLAID_ENV === 'production'
    ? 'https://production.plaid.com'
    : 'https://sandbox.plaid.com';

const CLIENT_ID = process.env.PLAID_CLIENT_ID!;
const SECRET = process.env.PLAID_SECRET!;

// In-memory access token store (single-user OS).
// Survives warm Cloud Run requests; resets on cold start.
// For cross-restart persistence, store token in GCP Secret Manager.
let cachedAccessToken: string | null = null;

export function setAccessToken(token: string) {
  cachedAccessToken = token;
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

async function plaidPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      secret: SECRET,
      ...body,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Plaid ${path} failed: ${JSON.stringify(err)}`);
  }

  return res.json() as Promise<T>;
}

// ─── API Surface ───────────────────────────────────────────────────────────

export async function createLinkToken(userId: string): Promise<{ link_token: string }> {
  return plaidPost('/link/token/create', {
    user: { client_user_id: userId },
    client_name: 'Sovereign OS',
    products: ['transactions'],
    country_codes: ['GB'],
    language: 'en',
  });
}

export async function exchangePublicToken(
  publicToken: string,
): Promise<{ access_token: string; item_id: string }> {
  return plaidPost('/item/public_token/exchange', { public_token: publicToken });
}

export interface PlaidTransaction {
  transaction_id: string;
  name: string;
  amount: number; // positive = debit, negative = credit
  date: string;
  category: string[] | null;
  iso_currency_code: string | null;
}

export interface TransactionSummary {
  totalSpend: number;
  byCategory: Record<string, number>;
  recent: PlaidTransaction[];
  currencySymbol: string;
}

export async function getTransactionSummary(): Promise<TransactionSummary> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error('No Plaid access token. Connect your bank first.');

  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const data = await plaidPost<{ transactions: PlaidTransaction[] }>(
    '/transactions/get',
    { access_token: accessToken, start_date: startDate, end_date: endDate },
  );

  const debits = data.transactions.filter((t) => t.amount > 0);
  const totalSpend = debits.reduce((sum, t) => sum + t.amount, 0);

  const byCategory: Record<string, number> = {};
  for (const t of debits) {
    const cat = t.category?.[0] ?? 'Other';
    byCategory[cat] = (byCategory[cat] ?? 0) + t.amount;
  }

  const symbol = data.transactions[0]?.iso_currency_code === 'GBP' ? '£' : '$';

  return {
    totalSpend: Math.round(totalSpend * 100) / 100,
    byCategory: Object.fromEntries(
      Object.entries(byCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6),
    ),
    recent: data.transactions.slice(0, 15),
    currencySymbol: symbol,
  };
}
