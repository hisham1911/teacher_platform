import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));

test('teacher creates, builds, previews, publishes, and hands off to sessions', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('البريد الإلكتروني').fill(state.email);
  await page.getByLabel('كلمة المرور').fill('SecurePassword123!');
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

  await expect(page.getByRole('heading', { name: 'مرحبًا، E2E Teacher' })).toBeVisible();
  await page.getByRole('link', { name: /إنشاء اختبار جديد/ }).click();

  await page.getByLabel('اسم الاختبار').fill('اختبار رحلة المعلم');
  await page.getByRole('button', { name: 'ابدأ إضافة الأسئلة' }).click();
  await expect(page.getByRole('heading', { name: 'اختبار رحلة المعلم' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ابدأ بإضافة أول سؤال' })).toBeVisible();

  await page.getByRole('link', { name: /صح أو خطأ/ }).click();
  await expect(page.getByRole('heading', { name: 'إضافة سؤال إلى الاختبار' })).toBeVisible();
  await expect(page.getByLabel('نوع السؤال')).toHaveValue('TrueFalse');
  await page.getByRole('link', { name: 'العودة إلى منشئ الاختبار' }).click();
  await expect(page.getByRole('heading', { name: 'اختبار رحلة المعلم' })).toBeVisible();

  await page.locator('#question-bank-picker > summary').click();
  await expect(page.getByRole('button', { name: 'إضافة للاختبار' })).toHaveCount(2);
  await page.getByRole('button', { name: 'إضافة للاختبار' }).first().click();
  await expect(page.getByRole('button', { name: 'إضافة للاختبار' })).toHaveCount(1);
  await page.getByRole('button', { name: 'إضافة للاختبار' }).click();
  await expect(page.getByRole('button', { name: 'إضافة للاختبار' })).toHaveCount(0);

  await page.getByRole('button', { name: 'نقل السؤال 2 لأعلى' }).click();
  await page.getByLabel('درجة النجاح (%)').fill('60');
  await page.getByLabel('مدة الاختبار').selectOption('TotalTime');
  await page.getByLabel('المدة بالدقائق').fill('5');
  await page.getByRole('link', { name: 'معاينة' }).click();

  await expect(page.getByRole('heading', { name: 'معاينة: اختبار رحلة المعلم' })).toBeVisible();
  await expect(page.getByText(/وقت إجمالي \(300 ثانية\)/)).toBeVisible();
  await page.getByRole('link', { name: 'تعديل' }).click();

  await expect(page.getByRole('heading', { name: 'اختبار رحلة المعلم' })).toBeVisible();
  await page.getByRole('link', { name: 'نشر الاختبار' }).click();
  await expect(page.getByRole('heading', { name: 'مراجعة ونشر اختبار رحلة المعلم' })).toBeVisible();
  await page.getByRole('button', { name: 'نشر الاختبار' }).click();

  await expect(page.getByRole('heading', { name: 'تم نشر الاختبار' })).toBeVisible();
  await page.getByRole('link', { name: 'إنشاء جلسة للطلاب' }).click();
  await expect(page.getByRole('heading', { name: 'جلسات الاختبار' })).toBeVisible();
});
