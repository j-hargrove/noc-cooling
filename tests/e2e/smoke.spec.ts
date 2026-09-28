import { expect, test } from '@playwright/test';

/**
 * A placeholder so CI's e2e step has something to run before the real
 * baseline suite exists (docs/BUILD_BRIEF.md step 4: Playwright screenshots
 * of /states as approved baselines). Delete this file once that lands.
 */
test('the app shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
});
