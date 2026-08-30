import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));

test('teacher builds a quiz and sees a coherent publication lifecycle', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('البريد الإلكتروني').fill(state.email);
  await page.getByLabel('كلمة المرور').fill('SecurePassword123!');
  await page.getByRole('button', { name: 'دخول إلى English Spark' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Part D intentionally protects the legacy/advanced quiz builder. The primary
  // English Spark dashboard now points teachers to the guided activity flow, so
  // reach the advanced builder directly instead of asserting the old dashboard CTA.
  await page.goto('/dashboard/quizzes/new');
  await page.getByLabel('اسم الاختبار').fill('اختبار رحلة المعلم');
  await page.getByRole('button', { name: 'ابدأ إضافة الأسئلة' }).click();

  await expect(page.getByRole('heading', { name: 'اختبار رحلة المعلم' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ابدأ بإضافة أول سؤال' })).toBeVisible();
  await page.getByRole('link', { name: /صح أو خطأ/ }).click();
  await expect(page.getByRole('heading', { name: 'إضافة سؤال إلى الاختبار' })).toBeVisible();
  await expect(page.getByLabel('نوع السؤال')).toHaveValue('TrueFalse');
  await page.getByRole('link', { name: 'العودة إلى منشئ الاختبار' }).click();

  await page.locator('#question-bank-picker > summary').click();
  await expect(page.getByRole('button', { name: 'إضافة للاختبار' })).toHaveCount(2);
  await page.getByRole('button', { name: 'إضافة للاختبار' }).first().click();
  await expect(page.getByRole('button', { name: 'إضافة للاختبار' })).toHaveCount(1);
  await page.getByRole('button', { name: 'إضافة للاختبار' }).click();
  await expect(page.getByRole('button', { name: 'إضافة للاختبار' })).toHaveCount(0);

  await expect(page.getByRole('button', { name: 'نقل السؤال 1 لأعلى' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'نقل السؤال 2 لأسفل' })).toBeDisabled();

  const editPagePromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'تعديل السؤال 1' }).click();
  const editPage = await editPagePromise;
  await expect(editPage).toHaveURL(/\/dashboard\/questions\/.+\/edit$/);
  await editPage.close();

  await page.getByRole('button', { name: 'نقل السؤال 1 لأسفل' }).click();
  await page.getByRole('button', { name: 'إزالة السؤال 2 من الاختبار' }).click();
  await expect(page.getByText('1 أسئلة', { exact: true })).toBeVisible();

  await page.getByLabel('درجة النجاح (%)').fill('60');
  await page.getByLabel('مدة الاختبار').selectOption('TotalTime');
  await page.getByLabel('المدة بالدقائق').fill('5');
  await page.getByRole('link', { name: 'معاينة' }).click();

  await expect(page.getByRole('heading', { name: 'معاينة: اختبار رحلة المعلم' })).toBeVisible();
  await expect(page.getByText(/وقت إجمالي \(300 ثانية\)/)).toBeVisible();
  await page.getByRole('link', { name: 'تعديل' }).click();

  await page.getByRole('link', { name: 'نشر الاختبار' }).click();
  await expect(page.getByRole('heading', { name: 'اختبارك جاهز للنشر' })).toBeVisible();
  await page.getByRole('button', { name: 'نشر الاختبار' }).click();

  await expect(page.getByRole('heading', { name: 'الاختبار منشور ✓' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'إنشاء جلسة للطلاب' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'صفحة تعريف الاختبار' })).toBeVisible();
  await expect(page.getByText('هذه الصفحة تعرض معلومات الاختبار فقط. رابط حل الطلاب يظهر بعد إنشاء جلسة.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'فتح صفحة التعريف' })).toHaveAttribute('href', /\/q\//);
  await expect(page.getByRole('button', { name: 'نسخ رابط صفحة التعريف' })).toBeVisible();
  await expect(page.getByText('QR صفحة التعريف')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'مشاركة الاختبار' })).toHaveCount(0);
  await page.getByRole('link', { name: 'تعديل الاختبار' }).click();

  await expect(page.getByRole('link', { name: 'إنشاء جلسة' })).toBeVisible();
  await page.getByLabel('المدة بالدقائق').fill('7');
  await page.getByRole('link', { name: 'نشر التحديثات' }).click();

  await expect(page.getByRole('heading', { name: 'لديك تعديلات جديدة لم تُنشر بعد' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'النسخة المنشورة الحالية' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'صفحة تعريف الاختبار' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'فتح صفحة التعريف' })).toHaveAttribute('href', /\/q\//);
  await page.getByRole('button', { name: 'نشر التحديثات' }).click();

  await expect(page.getByRole('heading', { name: 'الاختبار منشور ✓' })).toBeVisible();
  await page.getByRole('link', { name: 'إنشاء جلسة للطلاب' }).click();
  await expect(page.getByRole('heading', { name: 'جلسات الاختبار' })).toBeVisible();
  await page.getByLabel('عنوان الجلسة (اختياري)').fill('جلسة رابط الطلاب');
  await page.getByRole('button', { name: 'إنشاء جلسة', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تم إنشاء الجلسة ✓' })).toBeVisible();
  await page.getByRole('link', { name: /فتح صفحة الجلسة/ }).click();
  await expect(page.getByRole('heading', { name: 'دخول الطلاب' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'نسخ رابط الطلاب' })).toBeVisible();
  await expect(page.getByText(/\/play\/[A-Z0-9]+/)).toBeVisible();
  await expect(page.getByText(/\/q\//)).toHaveCount(0);
});
