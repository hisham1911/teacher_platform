import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));
const { joinCode: JOIN_CODE, email, quizId, sessionId } = state;

// تحميل كوكي الضيف المحفوظ من Part A — يحاكي استمرار جلسة المتصفح عبر إعادة تشغيل الـAPI
test.use({ storageState: join(e2eDir, 'storage.json') });

test('survives API restart + finish + result + F5 (Part B)', async ({ page }) => {
  // الكوكي (tp-guest) محفوظ من Part A — بعد إعادة تشغيل الـAPI
  // يعيد التطبيق الربط عبر /me ولا يطلب الاسم مجددًا (لا localStorage)
  await page.goto(`/play/${JOIN_CODE}`);

  // لا حاجة لكتابة الاسم أو الضغط على "انضمام" — إعادة الربط تلقائية
  await expect(page.getByPlaceholder('اكتب اسمك هنا')).not.toBeVisible();

  // نستأنف مباشرة عند السؤال الثاني — لا سؤال أول، لا شاشة استعداد
  await expect(page.getByText('كم عدد أيام الأسبوع؟')).toBeVisible();
  await expect(page.getByText('سؤال 2 من 2')).toBeVisible();

  // أجب عن السؤال الأخير ثم أنهِ
  await page.getByText('سبعة', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await expect(page.getByText(/إجابة صحيحة ✓/)).toBeVisible();
  const certificateResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/certificate'));
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();

  // النتيجة: 10/10، 100%، ناجح
  await expect(page.getByRole('heading', { name: 'أحسنت يا طالب E2E!' })).toBeVisible();
  await expect(page.getByText('10 / 10')).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.getByText('اجتزت الاختبار بنجاح')).toBeVisible();

  // شهادة النجاح تُنشأ عبر Outbox ثم تصبح PDF قابلة للتنزيل من نفس Guest Cookie.
  await certificateResponsePromise;
  const certificateLink = page.getByRole('link', { name: 'عرض الشهادة' });
  await expect(certificateLink).toBeVisible({ timeout: 30_000 });
  const certificateHref = await certificateLink.getAttribute('href');
  if (!certificateHref) throw new Error('Certificate download URL is missing.');
  const certificateFile = await page.request.get(certificateHref);
  expect(certificateFile.ok()).toBe(true);
  expect(certificateFile.headers()['content-type']).toContain('application/pdf');
  expect((await certificateFile.body()).subarray(0, 4).toString()).toBe('%PDF');

  // الاستبانة المنشورة تحتوي ستة أسئلة، ونرسل الأنواع الثلاثة من الواجهة الحقيقية.
  await expect(page.getByRole('heading', { name: 'استبانة تجربة الاختبار' })).toBeVisible();
  await expect(page.getByRole('group')).toHaveCount(6);
  await page.getByRole('group', { name: /ما تقييمك للاختبار/ }).getByText('5', { exact: true }).click();
  await page.getByRole('group', { name: /هل كانت التعليمات واضحة/ }).getByText('نعم', { exact: true }).click();
  await page.getByLabel('ما أكثر شيء أعجبك؟').fill('وضوح الأسئلة');
  await page.getByRole('button', { name: 'إرسال الاستبيان' }).click();
  await expect(page.getByText('شكرًا لمشاركتك')).toBeVisible();

  // رابط ولي الأمر يعرض ملخص النتيجة فقط في صفحة عامة.
  const parentSharePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/parent-share'));
  await page.getByRole('button', { name: 'إنشاء رابط المشاركة' }).click();
  const parentShare = await (await parentSharePromise).json();
  const parentPage = await page.context().newPage();
  await parentPage.goto(parentShare.shareUrl);
  await expect(parentPage.getByRole('heading', { name: 'طالب E2E' })).toBeVisible();
  await expect(parentPage.getByText('100%')).toBeVisible();
  await parentPage.close();

  // F5 على صفحة النتيجة — تُستعاد النتيجة تلقائيًا (لا شاشة انضمام/استعداد)
  await page.reload();
  await expect(page.getByText('10 / 10')).toBeVisible();
  await expect(page.getByText('اجتزت الاختبار بنجاح')).toBeVisible();
  await expect(page.getByPlaceholder('اكتب اسمك هنا')).not.toBeVisible();

  // المعلم يسجل الدخول ويصل إلى الجلسة من فهرس التقارير بدل الاعتماد على رابط داخلي مباشر.
  await page.goto('/auth/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill('SecurePassword123!');
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.goto('/dashboard/reports');
  await expect(page.getByRole('heading', { name: 'النتائج والتقارير' })).toBeVisible();
  await page.getByRole('combobox', { name: 'الاختبار' }).selectOption(quizId);
  await page.locator(`a[href="/dashboard/reports/${sessionId}?quizId=${quizId}"]`).click();
  await expect(page.getByRole('heading', { name: 'تقرير اختبار E2E' })).toBeVisible();
  const studentRow = page.getByRole('row').filter({ hasText: 'طالب E2E' });
  await expect(studentRow).toBeVisible();

  // التقرير يعرض ملخص الجلسة، نتيجة الطالب، والاستبيان الحقيقي المرتبط بالاختبار.
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

  // تفاصيل الطالب تبقى مرتبطة بالتقرير وتعرض الإجابات التي صححها الخادم.
  await studentRow.getByRole('link', { name: 'عرض التفاصيل' }).click();
  await expect(page.getByRole('heading', { name: 'نتيجة طالب E2E' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تفاصيل الإجابات' })).toBeVisible();
  await page.getByRole('link', { name: 'العودة إلى التقرير' }).click();

  // شهادة الطالب الناجح تُفتح كـBlob preview، والرابط العام موصوف بوضوح كرابط شهادة.
  const refreshedStudentRow = page.getByRole('row').filter({ hasText: 'طالب E2E' });
  await refreshedStudentRow.getByRole('link', { name: 'عرض الشهادة' }).click();
  await expect(page.getByRole('heading', { name: 'الشهادات' })).toBeVisible();
  const preview = page.getByTitle('معاينة الشهادة');
  await expect(preview).toBeVisible();
  expect(await preview.getAttribute('src')).toMatch(/^blob:/);
  await expect(page.getByRole('button', { name: 'نسخ رابط الشهادة' })).toBeVisible();
  console.log('[part-b] PASS — survived API restart + auto-restore result across F5');
});

test('failed attempt does not receive a certificate', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto(`/play/${JOIN_CODE}`);
  await page.getByPlaceholder('اكتب اسمك هنا').fill('طالب لم يجتز');
  await page.getByRole('button', { name: 'ابدأ الاختبار' }).click();
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();

  await page.getByText('الإسكندرية', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await page.getByRole('button', { name: /السؤال التالي/ }).click();
  await page.getByText('خمسة', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();

  await expect(page.getByText('0 / 10')).toBeVisible();
  await expect(page.getByText('لم تصل إلى درجة النجاح هذه المرة')).toBeVisible();
  await expect(page.getByRole('link', { name: 'عرض الشهادة' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'الشهادة' })).toHaveCount(0);
  await context.close();
});
