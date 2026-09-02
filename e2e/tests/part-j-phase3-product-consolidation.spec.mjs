import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));
const password = 'SecurePassword123!';

async function loginTeacher(page) {
  await page.goto('/auth/login');
  await page.getByLabel('البريد الإلكتروني').fill(state.email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول إلى English Spark' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport + 1);
}

async function expectMinTouchTarget(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.height).toBeGreaterThanOrEqual(44);
}

test('Part J: student-first public home is interactive and mobile-safe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /جاهز تبدأ؟/ })).toBeVisible();
  await expect(page.getByLabel('رمز النشاط')).toBeVisible();
  await expect(page.getByRole('link', { name: 'عندي كود طالب' })).toHaveAttribute('href', '/student');
  await expect(page.getByRole('link', { name: 'هل أنت معلم؟' })).toHaveAttribute('href', '/teachers');
  const joinButton = page.getByRole('button', { name: 'ابدأ النشاط' });
  await expectMinTouchTarget(joinButton);
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'كتاب' }).click();
  await expect(page.getByText('إجابة صحيحة ✓')).toBeVisible();
  await page.getByRole('button', { name: 'السؤال التالي' }).click();
  await page.getByRole('button', { name: 'am' }).click();
  await page.getByRole('button', { name: 'السؤال التالي' }).click();
  await page.getByRole('button', { name: 'Apple' }).click();
  await page.getByRole('button', { name: 'شوف النتيجة' }).click();
  await expect(page.getByRole('heading', { name: 'خلصت التجربة' })).toBeVisible();
  await expect(page.getByText(/نتيجتك 3 من 3/)).toBeVisible();
});

test('Part J: teachers page is a separate product surface with account CTAs', async ({ page }) => {
  await page.goto('/teachers');
  await expect(page.getByRole('heading', { name: /اصنع النشاط، جرّبه/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'إنشاء حساب' }).first()).toHaveAttribute('href', '/auth/signup');
  await expect(page.getByRole('link', { name: 'تسجيل الدخول' }).first()).toHaveAttribute('href', '/auth/login');
  await expect(page.getByRole('link', { name: 'واجهة الطلاب' }).first()).toHaveAttribute('href', '/');
  await expectNoHorizontalOverflow(page);
});

test('Part J: Build → Preview → Assign / Share / Live stays in one activity hub', async ({ page }) => {
  await loginTeacher(page);
  await page.goto(`/dashboard/activities/${state.quizId}/manage`);
  await expect(page.getByRole('heading', { name: '1. تعديل المحتوى' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2. المعاينة' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'إسناد، مشاركة، أو Live' })).toBeVisible();
  await expect(page.getByRole('button', { name: /إسناد النشاط/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /مشاركة رابط/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /بدء Live/ })).toBeVisible();
  await expect(page.getByText(/Publish|QuizVersion|Create Session|Activate/)).toHaveCount(0);

  await page.getByRole('link', { name: /فتح المعاينة/ }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/activities/${state.quizId}/preview$`));
  await expect(page.getByRole('heading', { name: 'معاينة النشاط' })).toBeVisible();
  await expect(page.getByText('هذه معاينة للمراجعة فقط')).toBeVisible();
  await page.getByRole('link', { name: 'اختيار طريقة الوصول' }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/activities/${state.quizId}/manage#deliver-activity$`));
  await expect(page.locator('#deliver-activity')).toBeVisible();

  await page.getByRole('button', { name: /إسناد النشاط/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/activities\/[0-9a-f-]+\/assign\?/i, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'إسناد النشاط' })).toBeVisible();

  await page.goto(`/dashboard/activities/${state.quizId}/manage`);
  await page.getByRole('button', { name: /مشاركة رابط/ }).click();
  await expect(page.getByRole('button', { name: /تجهيز رابط الطلاب/ })).toBeVisible();
  await page.getByRole('button', { name: /بدء Live/ }).click();
  await expect(page.getByRole('button', { name: /تجهيز Live/ })).toBeVisible();
});

test('Part J: results are assignment-first while quick runs remain available', async ({ page }) => {
  await loginTeacher(page);
  await page.goto('/dashboard/reports');
  await expect(page.getByRole('heading', { name: 'النتائج' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تقدم الطلاب في الأنشطة المرسلة' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تشغيلات النشاط السابقة' })).toBeVisible();
  await expect(page.getByText(/ابدأ بالإسنادات/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('Part J: classes stay discoverable from the student-management flow', async ({ page }) => {
  await loginTeacher(page);
  await page.goto('/dashboard/students');
  const classesLink = page.getByRole('link', { name: 'الفصول' });
  await expect(classesLink).toHaveAttribute('href', '/dashboard/classes');
  await expectMinTouchTarget(classesLink);
  await classesLink.click();
  await expect(page).toHaveURL(/\/dashboard\/classes$/);
  await expectNoHorizontalOverflow(page);
});
