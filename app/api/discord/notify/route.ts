import { NextRequest, NextResponse } from 'next/server';
import { getTransactionSummary, getAccessToken } from '@/lib/plaid';
import { sendEmail, buildDailyBriefHtml } from '@/lib/resend';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL!;
const NOTIFY_TO = process.env.RESEND_TO_EMAIL ?? 'shreyasjag@hotmail.com';
const CRON_SECRET = process.env.CRON_SECRET;
const BASELINE = 1300;

// Category → emoji mapping
const CAT_EMOJI: Record<string, string> = {
  Food: '🍔', Transfer: '🔄', Travel: '✈️', Shops: '🛍️',
  Recreation: '🎮', Health: '💊', Housing: '🏠', Service: '⚙️', Other: '💳',
};

function getCatEmoji(cat: string): string {
  for (const key of Object.keys(CAT_EMOJI)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return CAT_EMOJI[key];
  }
  return '💳';
}

export async function POST(req: NextRequest) {
  // Auth: allow manual dashboard button OR Cloud Scheduler with CRON_SECRET header.
  const callerSecret = req.headers.get('x-cron-secret');
  const isScheduler = !!callerSecret;
  if (isScheduler && CRON_SECRET && callerSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // ─── Gather financial data ────────────────────────────────────────────────
  let finSummary = '_Bank not connected_';
  let totalSpend = 0;
  let byCategory: Record<string, number> = {};
  let currencySymbol = '£';
  const bankConnected = !!getAccessToken();

  if (bankConnected) {
    try {
      const tx = await getTransactionSummary();
      totalSpend = tx.totalSpend;
      byCategory = tx.byCategory;
      currencySymbol = tx.currencySymbol;

      const remaining = BASELINE - totalSpend;
      const pct = Math.round((totalSpend / BASELINE) * 100);
      const status = pct < 70 ? '🟢' : pct < 90 ? '🟡' : '🔴';

      const catLines = Object.entries(tx.byCategory)
        .map(([cat, amt]) => `${getCatEmoji(cat)} **${cat}**: ${tx.currencySymbol}${amt.toFixed(0)}`)
        .join('\n');

      finSummary = `${status} **${tx.currencySymbol}${totalSpend.toFixed(0)}** / ${tx.currencySymbol}${BASELINE} (${pct}%)\n\n${catLines}\n\n📉 Remaining: **${tx.currencySymbol}${remaining.toFixed(0)}**`;
    } catch {
      finSummary = '_Error fetching transactions_';
    }
  }

  const errors: string[] = [];

  // ─── Discord ──────────────────────────────────────────────────────────────
  if (WEBHOOK_URL) {
    const embed = {
      title: '⚡ Sovereign OS — Daily Brief',
      description: `**${now}**`,
      color: 0x7c3aed,
      fields: [
        { name: '💰 Financial Runway (30d)', value: finSummary, inline: false },
        { name: '🎯 Mission', value: '🏆 Land **£100k+ sponsored role** before **11 Dec 2026**', inline: false },
      ],
      footer: { text: 'Sovereign OS Mission Control • Gans360' },
      timestamp: new Date().toISOString(),
    };

    const discordRes = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!discordRes.ok) {
      const body = await discordRes.text();
      errors.push(`Discord: ${body}`);
    }
  }

  // ─── Resend Email ─────────────────────────────────────────────────────────
  try {
    const html = buildDailyBriefHtml({
      date: now,
      totalSpend,
      baseline: BASELINE,
      byCategory,
      currencySymbol,
      bankConnected,
    });

    await sendEmail({
      to: NOTIFY_TO,
      subject: `⚡ Sovereign OS Daily Brief — ${now}`,
      html,
    });
  } catch (e) {
    errors.push(`Email: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({ sent: false, errors }, { status: 500 });
  }

  return NextResponse.json({ sent: true, channels: ['discord', 'email'] });
}
