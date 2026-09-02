import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));

test('legacy quiz creation URL resolves to the consolidated activity builder and keeps advanced settings accessible', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('البريد الإلكتروني').fill(state.email);
  await page.getByLabel('كلمة المرور').fill('SecurePassword123!');
  await page.getByRole('button', { name: 'دخول إلى English Spark' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // The historical URL remains compatible, but Phase 3 intentionally consolidates
  // creation into the activity-first flow instead of restoring the old publish/session wizard.
  await page.goto('/dashboard/quizzes/new');
  await expect(page.getByRole('heading', { name: 'سمِّ النشاط' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'اسم النشاط' })).toBeVisible();
  await expect(page.getByLabel('اسم الاختبار')).toHaveCount(0);

  await page.getByText('تغيير طريقة اللعب').click();
  await page.getByText('اختبار فردي', { exact: true }).click();
  await expect(page.locator('input[name="activity-mode"][value="SelfPaced"]')).toBeChecked();

  const title = `نشاط إعدادات متقدمة ${Date.now()}`;
  await page.getByRole('textbox', { name: 'اسم النشاط' }).fill(title);
  await page.getByRole('button', { name: 'التالي: الأسئلة' }).click();

  await expect(page).toHaveURL(/\/dashboard\/activities\/[0-9a-f-]+\/build\?mode=SelfPaced$/i);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'اختر نوع السؤال' })).toBeVisible();
  await expect(page.getByRole('link', { name: /اختيار من متعدد/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /صح أو خطأ/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /إجابة قصيرة/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /ترتيب/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /استماع/ })).toBeVisible();

  const advanced = page.getByRole('link', { name: 'إعدادات متقدمة' });
  await expect(advanced).toHaveAttribute('href', /\/dashboard\/quizzes\/[0-9a-f-]+\/edit$/i);
  await advanced.click();
  await expect(page).toHaveURL(/\/dashboard\/quizzes\/[0-9a-f-]+\/edit$/i);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByLabel('درجة النجاح (%)')).toBeVisible();
  await expect(page.getByLabel('مدة الاختبار')).toBeVisible();

  await page.getByLabel('درجة النجاح (%)').fill('60');
  await page.getByLabel('مدة الاختبار').selectOption('TotalTime');
  await page.getByLabel('المدة بالدقائق').fill('5');
  await expect(page.getByLabel('درجة النجاح (%)')).toHaveValue('60');
  await expect(page.getByLabel('المدة بالدقائق')).toHaveValue('5');
});
