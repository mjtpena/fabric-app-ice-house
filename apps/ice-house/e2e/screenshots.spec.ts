/**
 * Captures the 6 high-signal redesign screenshots into docs/redesign/.
 * Run: SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts
 */
import { test } from '@playwright/test';

import { openApp } from '@x10/shared/e2e';

const QA_ADMIN = 'demo-admin';

test.describe('Ice House redesign screenshots', () => {
  test.skip(!process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to capture screenshots.');

  test('desktop-light-stage', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await openApp(page, '/', QA_ADMIN);
    await page.getByTestId('demo-banner').getByRole('button').first().click().catch(() => undefined);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/redesign/desktop-light-stage.png' });
  });

  test('desktop-dark-stage', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await openApp(page, '/', QA_ADMIN);
    await page.getByTestId('demo-banner').getByRole('button').first().click().catch(() => undefined);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/redesign/desktop-dark-stage.png' });
  });

  test('desktop-lens', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await openApp(page, '/', QA_ADMIN);
    await page.getByTestId('demo-banner').getByRole('button').first().click().catch(() => undefined);
    await page.getByRole('radiogroup', { name: 'Lens' }).getByRole('radio', { name: /FEFO/ }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'docs/redesign/desktop-lens.png' });
  });

  test('desktop-tool', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await openApp(page, '/thaw', QA_ADMIN);
    await page.getByTestId('demo-banner').getByRole('button').first().click().catch(() => undefined);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'docs/redesign/desktop-tool.png' });
  });

  test('phone-light-stage', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone');
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await openApp(page, '/', QA_ADMIN);
    await page.getByTestId('demo-banner').getByRole('button').first().click().catch(() => undefined);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/redesign/phone-light-stage.png' });
  });

  test('phone-dark-stage', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone');
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await openApp(page, '/', QA_ADMIN);
    await page.getByTestId('demo-banner').getByRole('button').first().click().catch(() => undefined);
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'docs/redesign/phone-dark-stage.png' });
  });
});
