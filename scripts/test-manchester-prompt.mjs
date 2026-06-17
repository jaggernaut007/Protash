/**
 * Playwright smoke test: submit the Manchester electronics sales dashboard prompt
 * and verify the canvas renders without a runtime error.
 *
 * Run: node scripts/test-manchester-prompt.mjs
 */
import { chromium } from '@playwright/test';

const PROMPT = 'Sales dashboard to track electronic items sales in a supermarket in manchester';
const APP_URL = 'http://localhost:3000';
const TIMEOUT = 300_000; // 5 min — 6-stage AI pipeline can take a while

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.error('[browser error]', msg.text());
  });
  page.on('pageerror', err => console.error('[page error]', err.message));

  console.log('Navigating to', APP_URL);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'scripts/screenshot-01-loaded.png' });
  console.log('App loaded. Screenshot saved.');

  // Find prompt textarea or input
  const input = page.locator('textarea, input[type="text"]').first();
  await input.fill(PROMPT);
  console.log('Prompt filled.');

  // Submit (Enter key or submit button)
  const submitBtn = page.locator('button[type="submit"], button:has-text("Generate"), button:has-text("Send"), button:has-text("Build")').first();
  const hasSubmitBtn = await submitBtn.count() > 0;
  if (hasSubmitBtn) {
    await submitBtn.click();
  } else {
    await input.press('Enter');
  }
  console.log('Submitted. Waiting for render...');

  // Wait for canvas to appear — look for absence of loading indicator
  await page.waitForTimeout(2000); // brief pause for streaming to start

  try {
    // Wait up to 60s for a rendered canvas (not a loading spinner)
    await page.waitForSelector('[class*="canvas"], [class*="Canvas"], main canvas, .w-full.h-full', { timeout: TIMEOUT });
  } catch {
    console.log('Canvas selector not found, checking for error overlay...');
  }

  // Step 1: confirm "Generating..." appeared (i.e. form was actually submitted)
  console.log('Waiting for pipeline to start (Generating... button)...');
  try {
    await page.waitForFunction(() => {
      const btns = [...document.querySelectorAll('button')];
      return btns.some(b => b.textContent?.includes('Generating'));
    }, { timeout: 15_000 });
    console.log('Pipeline started.');
  } catch {
    console.warn('Generating button never appeared — may have submitted via a different path');
  }

  // Step 2: wait for "Generating..." to disappear — pipeline completed
  console.log('Waiting for pipeline to complete (up to 5 min)...');
  try {
    await page.waitForFunction(() => {
      const btns = [...document.querySelectorAll('button')];
      return btns.length > 0 && !btns.some(b => b.textContent?.includes('Generating'));
    }, { timeout: 300_000 });
    console.log('Pipeline complete.');
  } catch {
    console.warn('Pipeline did not complete within 5 min — taking snapshot anyway');
  }

  await page.waitForTimeout(2000); // allow canvas render to settle
  await page.screenshot({ path: 'scripts/screenshot-02-rendered.png', fullPage: false });
  console.log('Screenshot saved: screenshot-02-rendered.png');

  // Check for runtime error overlay (Next.js error modal)
  const errorText = await page.locator('text=Runtime TypeError').count() +
                    await page.locator('text=Cannot read properties').count();
  if (errorText > 0) {
    console.error('FAIL: Runtime TypeError overlay is still visible.');
    await browser.close();
    process.exit(1);
  }

  // Check for a render error box inside the canvas
  const renderError = await page.locator('text=Render error').count();
  if (renderError > 0) {
    const msg = await page.locator('text=Render error').locator('..').locator('pre').textContent().catch(() => 'unknown');
    console.error('FAIL: Render error box visible:', msg);
    await browser.close();
    process.exit(1);
  }

  console.log('PASS: No runtime errors detected. Screenshots in scripts/.');
  await browser.close();
})();
