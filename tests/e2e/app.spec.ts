import { test, expect } from '@playwright/test';

test.describe('Protash App', () => {
  test('loads the homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Protash|Ashley/i);
    await expect(page.getByText('Protash')).toBeVisible();
  });

  test('shows intent console on load', async ({ page }) => {
    await page.goto('/');
    // Intent console should be present in the left panel
    await expect(page.locator('aside')).toBeVisible();
  });

  test('shows canvas area on load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('section')).toBeVisible();
  });

  test('shows bottom status pill with "No intent yet"', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('No intent yet')).toBeVisible();
  });

  test('Prototypes button is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Prototypes' })).toBeVisible();
  });

  test('New Board button is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'New Board' })).toBeVisible();
  });

  test('New Board button triggers confirmation dialog', async ({ page }) => {
    await page.goto('/');
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('new board');
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: 'New Board' }).click();
  });

  test('Prototypes button opens library panel', async ({ page }) => {
    await page.goto('/');
    // The slide-out panel is fixed on the right; it starts off-screen (translate-x-full)
    const panel = page.locator('div.fixed.inset-y-0.right-0');
    await expect(panel).not.toHaveClass(/translate-x-0/);
    await page.getByRole('button', { name: 'Prototypes' }).click();
    await expect(panel).toHaveClass(/translate-x-0/, { timeout: 3000 });
  });
});
