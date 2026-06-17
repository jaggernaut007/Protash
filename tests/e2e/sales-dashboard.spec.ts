import { test, expect } from '@playwright/test';

const PROMPT = 'Sales dashboard to track electronic items sales in a supermarket in manchester.';
// Pipeline takes 120–150s in practice; 200s gives a comfortable buffer
const GENERATION_TIMEOUT = 200_000;

test.describe('Sales Dashboard Prompt', () => {
  test.setTimeout(250_000);

  test('generates a sales dashboard prototype end-to-end', async ({ page }) => {
    await page.goto('/');

    // ── 1. Fill in the intent ──
    const textarea = page.locator('textarea').first();
    await textarea.fill(PROMPT);
    await expect(textarea).toHaveValue(PROMPT);

    // ── 2. Submit ──
    const generateBtn = page.getByRole('button', { name: 'Generate Prototype' });
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // ── 3. Button shows "Generating…" ──
    await expect(page.getByRole('button', { name: /Generating/i })).toBeVisible({ timeout: 5000 });

    // ── 4. Pipeline panel appears ──
    await expect(page.getByText('Pipeline')).toBeVisible({ timeout: 5000 });

    // ── 5. Status pill updates with the intent title ──
    await expect(page.locator('.fixed.bottom-6').getByText(/Sales/i)).toBeVisible({ timeout: 10_000 });

    // ── 6. All 6 stage labels appear in the pipeline panel ──
    const stages = ['Business Context', 'Spec', 'UX Architecture', 'Development', 'QA', 'Review'];
    for (const stage of stages) {
      await expect(page.getByText(stage)).toBeVisible({ timeout: 10_000 });
    }

    // ── 7. Wait for generation to complete ──
    // After success: textarea is cleared, so the button stays disabled.
    // Instead watch for "Modify Prototype" which only renders when hasGenerated=true.
    await expect(page.getByText('Modify Prototype')).toBeVisible({ timeout: GENERATION_TIMEOUT });

    // ── 8. Success toast ──
    await expect(page.getByText('Prototype generated!')).toBeVisible({ timeout: 5000 });

    // ── 9. Spec summary visible ──
    await expect(page.getByText('Spec Summary')).toBeVisible({ timeout: 5000 });

    // ── 10. Apply Changes button present ──
    await expect(page.getByRole('button', { name: /Apply Changes/i })).toBeVisible();

    // ── 11. Save button visible (code + intent both set) ──
    await expect(page.getByRole('button', { name: /Save/i })).toBeVisible({ timeout: 5000 });

    // ── 12. Screenshot ──
    await page.screenshot({ path: 'test-results/sales-dashboard-generated.png', fullPage: false });
  });
});
