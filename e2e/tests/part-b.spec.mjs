import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));
const { joinCode: JOIN_CODE, email, quizId, sessionId } = state;

test.use({ storageState: join(e2eDir, 'storage.json') });

test('survives API restart + finish + result + F5 (Part B)', async ({ page }) => {
  await page.goto(`/play/${JOIN_CODE}`);
  await expect(page.getByPlaceholder('اكتب اسمك هنا')).not.toBeVisible();
  await expect(page.getByText('كم عدد أيام الأسبوع؟')).toBeVisible();
  await expect(page.getByText('سؤال 2 من 2')).toBeVisible();

  await page.getByText('سبعة', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await expect(page.getByText(/إجابة صحيحة ✓/)).toBeVisible();
  const certificateResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/certificate'));
  await page.getByRole('button', { name: 'إنهاء النشاط' }).click();

  await expect(page.getByRole('heading', { name: 'أحسنت يا طالب E2E!' })).toBeVisible();
  await expect(page.getByText('10 / 10')).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.getByText('أكملت النشاط بنجاح')).toBeVisible();

  await certificateResponsePromise;
  const certificateLink = page.getByRole('link', { name: 'عرض الشهادة' });
  await expect(certificateLink).toBeVisible({ timeout: 30_000 });
  const certificateHref = await certificateLink.getAttribute('href');
  if (!certificateHref) throw new Error('Certificate download URL is missing.');
  const certificateFile = await page.request.get(certificateHref);
  expect(certificateFile.ok()).toBe(true);
  expect(certificateFile.headers()['content-type']).toContain('application/pdf');
  expect((await certificateFile.body()).subarray(0, 4).toString()).toBe('%PDF');

  await expect(page.getByRole('heading', { name: 'استبانة تجربة الاختبار' })).toBeVisible();
  await expect(page.getByRole('group')).toHaveCount(6);
  await page.getByRole('group', { name: /ما تقييمك للاختبار/ }).getByText('5', { exact: true }).click();
  await page.getByRole('group', { name: /هل كانت التعليمات واضحة/ }).getByText('نعم', { exact: true }).click();
  await page.getByLabel('ما أكثر شيء أعجبك؟').fill('وضوح الأسئلة');
  await page.getByRole('button', { name: 'إرسال الاستبيان' }).click();
  await expect(page.getByText('شكرًا لمشاركتك')).toBeVisible();

  const parentSharePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/parent-share'));
  await page.getByRole('button', { name: 'إنشاء رابط المشاركة' }).click();
  const parentShare = await (await parentSharePromise).json();
  const parentPage = await page.context().newPage();
  await parentPage.goto(parentShare.shareUrl);
  await expect(parentPage.getByRole('heading', { name: 'طالب E2E' })).toBeVisible();
  await expect(parentPage.getByText('100%')).toBeVisible();
  await parentPage.close();

  await page.reload();
  await expect(page.getByText('10 / 10')).toBeVisible();
  await expect(page.getByText('أكملت النشاط بنجاح')).toBeVisible();
  await expect(page.getByPlaceholder('اكتب اسمك هنا')).not.toBeVisible();

  await page.goto('/auth/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill('SecurePassword123!');
  await page.getByRole('button', { name: 'دخول إلى English Spark' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.goto('/dashboard/reports');
  await expect(page.getByRole('heading', { name: 'النتائج' })).toBeVisible();
  await page.getByRole('combobox', { name: 'النشاط' }).selectOption(quizId);
  await page.locator(`a[href="/dashboard/reports/${sessionId}?quizId=${quizId}"]`).click();
  await expect(page.getByRole('heading', { name: 'تقرير اختبار E2E' })).toBeVisible();
  const studentRow = page.getByRole('row').filter({ hasText: 'طالب E2E' });
  await expect(studentRow).toBeVisible();

  await expect(page.getByRole('heading', { name: 'نتائج الطلاب' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'آراء الطلاب' })).toBeVisible();
  await expect(page.getByText('وضوح الأسئلة')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'تصدير CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('session-results.csv');
  const csvPath = await download.path();
  if (!csvPath) throw new Error('CSV download path is missing.');
  expect(readFileSync(csvPath, 'utf8')).toContain('طالب E2E');

  await studentRow.getByRole('link', { name: 'عرض التفاصيل' }).click();
  await expect(page.getByRole('heading', { name: 'نتيجة طالب E2E' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تفاصيل الإجابات' })).toBeVisible();
  await page.getByRole('link', { name: 'العودة إلى التقرير' }).click();

  const refreshedStudentRow = page.getByRole('row').filter({ hasText: 'طالب E2E' });
  await refreshedStudentRow.getByRole('link', { name: 'عرض الشهادة' }).click();
  await expect(page.getByRole('heading', { name: 'الشهادات' })).toBeVisible();
  const preview = page.getByTitle('معاينة الشهادة');
  await expect(preview).toBeVisible();
  expect(await preview.getAttribute('src')).toMatch(/^blob:/);
  const studentCertificateRow = page.getByRole('row').filter({ hasText: 'طالب E2E' });
  await expect(studentCertificateRow.getByRole('button', { name: 'نسخ رابط الشهادة' })).toBeVisible();
  console.log('[part-b] PASS — survived API restart + auto-restore result across F5');
});

test('failed attempt does not receive a certificate', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto(`/play/${JOIN_CODE}`);
  await page.getByPlaceholder('اكتب اسمك هنا').fill('طالب لم يجتز');
  await page.getByRole('button', { name: 'ابدأ النشاط' }).click();
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();

  await page.getByText('الإسكندرية', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await page.getByRole('button', { name: /السؤال التالي/ }).click();
  await page.getByText('خمسة', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await page.getByRole('button', { name: 'إنهاء النشاط' }).click();

  await expect(page.getByText('0 / 10')).toBeVisible();
  await expect(page.getByText('لم تصل إلى درجة النجاح هذه المرة')).toBeVisible();
  await expect(page.getByRole('link', { name: 'عرض الشهادة' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'الشهادة' })).toHaveCount(0);
  await context.close();
});
