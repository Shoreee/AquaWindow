import { test, expect } from '@playwright/test';

test('boots the desktop and opens a scenario', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.aw-menubar')).toBeVisible();
  await expect(page.locator('.aw-dock')).toBeVisible();
  await page.getByRole('button', { name: 'Finder' }).click();
  await expect(page.locator('.aw-window').first()).toBeVisible();
});
