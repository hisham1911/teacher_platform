import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));
const JOIN_CODE = state.joinCode;

test('guest cookie + join + attempt + answer + F5 resume (Part A)', async ({ page }) => {
  await page.goto(`/play/${JOIN_CODE}`);
  await expect(page.getByRole('heading', { name: 'اختبار E2E' })).toBeVisible();
  await page.getByPlaceholder('اكتب اسمك هنا').fill('طالب E2E');
  await page.getByRole('button', { name: 'ابدأ النشاط' }).click();

  await expect(page.getByRole('button', { name: 'ابدأ الآن' })).toBeVisible();
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();

  await expect(page.getByText('ما عاصمة مصر؟')).toBeVisible();
  await page.getByText('القاهرة', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await expect(page.getByText(/إجابة صحيحة ✓/)).toBeVisible();

  await page.getByRole('button', { name: /السؤال التالي/ }).click();
  await expect(page.getByText('كم عدد أيام الأسبوع؟')).toBeVisible();
  await expect(page.getByText('سؤال 2 من 2')).toBeVisible();

  const cookies = await page.context().cookies();
  const guest = cookies.find((c) => c.name === 'tp-guest');
  expect(guest, 'tp-guest cookie must be set in real Chromium').toBeDefined();
  expect(guest.httpOnly).toBe(true);
  expect(guest.path).toBe('/');
  expect(guest.secure).toBe(false);
  expect(guest.sameSite).toBe('Lax');
  const jsCookies = await page.evaluate(() => document.cookie);
  expect(jsCookies).not.toContain('tp-guest');

  await page.reload();
  await expect(page.getByText('كم عدد أيام الأسبوع؟')).toBeVisible();
  await expect(page.getByText('سؤال 2 من 2')).toBeVisible();
  await expect(page.getByPlaceholder('اكتب اسمك هنا')).not.toBeVisible();

  await page.context().storageState({ path: join(e2eDir, 'storage.json') });
  console.log('[part-a] PASS — cookie proven + answer + F5 resume at Q2');
});
