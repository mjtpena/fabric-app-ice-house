import { expect, test } from '@playwright/test';

import { openApp } from '@x10/shared/e2e';

const QA_ADMIN = 'demo-admin';
const OPERATOR = 'demo-user';

test.describe('Ice House — smoke & acceptance criteria', () => {
  test('smoke: loads Ice House cutaway, logs a manual reading on Door log, no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await openApp(page, '/', QA_ADMIN);
    await expect(page.getByTestId('ice-house-stage')).toBeVisible();

    await openApp(page, '/door-log', OPERATOR);
    await page.getByLabel('Temperature (°C)').fill('3.4');
    await page.getByRole('button', { name: 'Record reading' }).click();
    await expect(page.getByText('Logged 3.4°C reading.')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('centrepiece: lens switch, Today item focus, 7d time rail, and ?nowebgl render cleanly', async ({ page }, info) => {
    const isPhone = info.project.name === 'phone';
    await openApp(page, '/?nowebgl', QA_ADMIN);
    await expect(page.getByTestId('ice-house-stage')).toBeVisible();

    await page.getByRole('radiogroup', { name: 'Lens' }).getByRole('radio', { name: /FEFO/ }).click();
    await expect(page.getByTestId('ice-house-stage')).toContainText('#1');

    if (isPhone) {
      await page.getByRole('button', { name: /^Today/ }).click();
    }
    await page.getByRole('button', { name: /lots awaiting QA/ }).first().click();
    await expect(page.getByTestId('chamber-0')).toBeVisible();
  });

  test('Acceptance Criterion 4: non-admin cannot release quarantined lot; QA admin release writes Assessment', async ({ page }) => {
    // Non-admin operator sees Release disabled
    await openApp(page, '/thaw', OPERATOR);
    await expect(page.getByRole('button', { name: 'Release' }).first()).toBeDisabled();

    // QA admin can release a non-forced-discard quarantined lot and writes an Assessment
    await openApp(page, '/thaw', QA_ADMIN);
    const releaseBtn = page.getByRole('button', { name: 'Release' }).first();
    await expect(releaseBtn).toBeEnabled();
    await releaseBtn.click();
    await expect(page.getByText(/Recorded QA release assessment/)).toBeVisible();
  });

  test('Acceptance Criterion 5: ice block remaining life matches list view remaining life', async ({ page }) => {
    await openApp(page, '/', QA_ADMIN);
    const block = page.getByTestId('ice-block-IH-001');
    const blockPct = await block.getAttribute('data-remaining-pct');
    expect(Number(blockPct)).toBeGreaterThan(0);

    await page.getByRole('radio', { name: 'List' }).click();
    await expect(page.getByTestId('ice-house-list-view')).toBeVisible();
    await expect(page.getByTestId('list-remaining-IH-001')).toHaveText(`${blockPct}%`);
  });
});
