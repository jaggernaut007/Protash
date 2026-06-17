/**
 * Resend email client — zero-dependency, pure fetch.
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
const RESEND_URL = 'https://api.resend.com/emails';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ id: string }> {
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      ...payload,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend send failed: ${JSON.stringify(err)}`);
  }

  return res.json() as Promise<{ id: string }>;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

const CAT_EMOJI: Record<string, string> = {
  food: '🍔', transfer: '🔄', travel: '✈️', shops: '🛍️',
  recreation: '🎮', health: '💊', housing: '🏠', service: '⚙️',
};

function getCatEmoji(cat: string): string {
  const lower = cat.toLowerCase();
  for (const [key, emoji] of Object.entries(CAT_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '💳';
}

export function buildDailyBriefHtml(opts: {
  date: string;
  totalSpend: number;
  baseline: number;
  byCategory: Record<string, number>;
  currencySymbol: string;
  bankConnected: boolean;
}): string {
  const { date, totalSpend, baseline, byCategory, currencySymbol, bankConnected } = opts;
  const remaining = baseline - totalSpend;
  const pct = Math.min(Math.round((totalSpend / baseline) * 100), 100);
  const barColor = pct < 60 ? '#10b981' : pct < 80 ? '#f59e0b' : '#f43f5e';

  const categoryRows = bankConnected
    ? Object.entries(byCategory)
        .map(
          ([cat, amt]) => `
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#cbd5e1;">
              ${getCatEmoji(cat)} ${cat}
            </td>
            <td style="padding:6px 0;font-size:14px;color:#e2e8f0;text-align:right;font-weight:600;">
              ${currencySymbol}${amt.toFixed(0)}
            </td>
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="2" style="color:#64748b;font-size:14px;padding:8px 0;">Bank not connected</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0f18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f18;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#0891b2);border-radius:16px 16px 0 0;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#c4b5fd;">SOVEREIGN OS</p>
                  <h1 style="margin:6px 0 0;font-size:26px;font-weight:900;color:#fff;">⚡ Daily Brief</h1>
                  <p style="margin:4px 0 0;font-size:13px;color:#e0e7ff;opacity:0.8;">${date}</p>
                </td>
                <td align="right">
                  <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:8px 14px;font-size:12px;font-weight:700;color:#fff;">
                    🎯 Mission Control
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Runway Section -->
        <tr>
          <td style="background:#0f172a;border:1px solid #1e293b;border-top:none;padding:28px 32px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;">💰 Financial Runway — 30 Days</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
              <tr>
                <td>
                  <p style="margin:0;font-size:38px;font-weight:900;color:#f1f5f9;line-height:1;">
                    ${bankConnected ? `${currencySymbol}${totalSpend.toFixed(0)}` : '—'}
                  </p>
                  <p style="margin:4px 0 0;font-size:13px;color:#64748b;">of ${currencySymbol}${baseline} baseline</p>
                </td>
                <td align="right" style="vertical-align:top;">
                  <div style="display:inline-block;background:${barColor}22;border:1px solid ${barColor}66;border-radius:8px;padding:6px 12px;">
                    <span style="font-size:13px;font-weight:700;color:${barColor};">${bankConnected ? `${pct}%` : 'N/A'}</span>
                  </div>
                </td>
              </tr>
            </table>

            ${bankConnected ? `
            <!-- Progress bar -->
            <div style="margin:16px 0;height:8px;background:#1e293b;border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${barColor};border-radius:99px;"></div>
            </div>
            <p style="margin:0;font-size:13px;color:${remaining >= 0 ? '#94a3b8' : '#f43f5e'};">
              ${remaining >= 0
                ? `${currencySymbol}${remaining.toFixed(0)} remaining before limit`
                : `⚠️ ${currencySymbol}${Math.abs(remaining).toFixed(0)} over baseline`}
            </p>` : ''}

            <!-- Category table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #1e293b;padding-top:20px;">
              ${categoryRows}
            </table>
          </td>
        </tr>

        <!-- Mission Block -->
        <tr>
          <td style="background:#0f172a;border:1px solid #1e293b;border-top:none;padding:20px 32px;">
            <div style="background:#1e1b4b;border:1px solid #4f46e5;border-radius:12px;padding:16px 20px;">
              <p style="margin:0;font-size:13px;font-weight:700;color:#a5b4fc;">🏆 PRIMARY OBJECTIVE</p>
              <p style="margin:6px 0 0;font-size:15px;font-weight:600;color:#e0e7ff;">
                Secure a £100k+ UK sponsored role before <strong style="color:#c7d2fe;">11 Dec 2026</strong>
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#020617;border-radius:0 0 16px 16px;border:1px solid #1e293b;border-top:none;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#334155;">Sovereign OS Mission Control · Gans360 · Automated Daily Brief</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
