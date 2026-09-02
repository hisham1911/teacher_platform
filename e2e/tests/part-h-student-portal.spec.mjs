import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));
const apiUrl = process.env.API_URL || 'http://localhost:5000';
const password = 'SecurePassword123!';

async function post(request, path, body, token) {
  const response = await request.post(`${apiUrl}${path}`, {
    data: body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const text = await response.text();
  if (!response.ok()) throw new Error(`POST ${path} -> ${response.status()}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function createPortalSession(request) {
  const login = await post(request, '/api/v1/auth/login', { email: state.email, password });
  const session = await post(
    request,
    `/api/v1/tenants/${state.tenantId}/quizzes/${state.quizId}/sessions`,
    { mode: 'SelfPaced', label: 'بوابة الطالب E2E' },
    login.accessToken,
  );
  await post(
    request,
    `/api/v1/tenants/${state.tenantId}/quizzes/${state.quizId}/sessions/${session.id}/activate`,
    { baseVersion: session.version },
    login.accessToken,
  );
  return session.joinCode;
}

async function loginTeacher(page) {
  await page.goto('/auth/login');
  await page.getByLabel('البريد الإلكتروني').fill(state.email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول إلى English Spark' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

async function answerSeedQuiz(page) {
  await expect(page.getByRole('button', { name: 'ابدأ الآن' })).toBeVisible();
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();

  await expect(page.getByText('ما عاصمة مصر؟')).toBeVisible();
  await page.getByText('القاهرة', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await expect(page.getByText(/إجابة صحيحة ✓/)).toBeVisible();
  await page.getByRole('button', { name: /السؤال التالي/ }).click();

  await expect(page.getByText('كم عدد أيام الأسبوع؟')).toBeVisible();
  await page.getByText('سبعة', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await expect(page.getByText(/إجابة صحيحة ✓/)).toBeVisible();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await expect(page.getByText('100%').first()).toBeVisible();
}

test('persistent student portal login → automatic activity binding → progress home → reusable credential', async ({ browser, request }) => {
  test.setTimeout(120_000);
  const joinCode = await createPortalSession(request);

  const teacherContext = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const teacherPage = await teacherContext.newPage();
  await loginTeacher(teacherPage);

  await teacherPage.goto('/dashboard/students');
  await teacherPage.getByRole('link', { name: /إضافة طالب/ }).first().click();
  await teacherPage.getByLabel('اسم الطالب').fill('طالب البوابة');
  await teacherPage.getByRole('button', { name: 'حفظ وإنشاء الكود' }).click();
  await expect(teacherPage).toHaveURL(/\/dashboard\/students\/[0-9a-f-]+$/i);
  await expect(teacherPage.getByRole('heading', { name: 'طالب البوابة' })).toBeVisible();

  const portalAccessResponsePromise = teacherPage.waitForResponse((response) =>
    response.request().method() === 'POST' && /\/api\/v1\/tenants\/[0-9a-f-]+\/students\/[0-9a-f-]+\/portal-access$/i.test(new URL(response.url()).pathname));
  await teacherPage.getByRole('button', { name: 'إنشاء كود دخول' }).click();
  const portalAccessResponse = await portalAccessResponsePromise;
  const portalAccessText = await portalAccessResponse.text();
  expect(portalAccessResponse.status(), portalAccessText).toBe(200);
  const { accessCode } = JSON.parse(portalAccessText);
  expect(accessCode).toMatch(/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/);
  await expect(teacherPage.getByText('انسخ الكود الآن')).toBeVisible();
  await expect(teacherPage.locator('code').filter({ hasText: accessCode })).toBeVisible();

  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const studentPage = await studentContext.newPage();

  // Quick Join is activity-only and points persistent students to their separate portal.
  await studentPage.goto('/join');
  await expect(studentPage.getByRole('heading', { name: 'انضم لنشاط سريع' })).toBeVisible();
  await expect(studentPage.getByLabel('رمز النشاط')).toBeVisible();
  await expect(studentPage.getByRole('link', { name: 'الدخول إلى مساحتي' })).toHaveAttribute('href', '/student');
  await expect(studentPage.getByLabel('كود دخول الطالب')).toHaveCount(0);

  await studentPage.goto('/student');
  await expect(studentPage.getByRole('heading', { name: 'ادخل إلى مساحتك' })).toBeVisible();
  await studentPage.getByLabel('كود دخول الطالب').fill(accessCode);
  await studentPage.getByRole('button', { name: 'دخول' }).click();
  await expect(studentPage).toHaveURL(/\/student\/home$/, { timeout: 15_000 });
  await expect(studentPage.getByRole('heading', { name: /أهلًا طالب/ })).toBeVisible();
  await expect(studentPage.getByText(state.email)).toHaveCount(0);

  const portalJoinPromise = studentPage.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith(`/player/sessions/${joinCode}/portal-join`));
  await studentPage.goto(`/play/${joinCode}`);
  const portalJoin = await portalJoinPromise;
  expect(portalJoin.status(), await portalJoin.text()).toBe(200);
  await expect(studentPage.getByPlaceholder('اكتب اسمك هنا')).toHaveCount(0);
  await expect(studentPage.getByText('اختبار E2E', { exact: true })).toBeVisible();

  const cookies = await studentContext.cookies();
  const portalCookie = cookies.find((cookie) => cookie.name === 'tp-student');
  const guestCookie = cookies.find((cookie) => cookie.name === 'tp-guest');
  expect(portalCookie).toBeDefined();
  expect(portalCookie.httpOnly).toBe(true);
  expect(guestCookie).toBeDefined();
  expect(guestCookie.httpOnly).toBe(true);

  await answerSeedQuiz(studentPage);
  await studentPage.goto('/student/home');
  await expect(studentPage.getByRole('heading', { name: /أهلًا طالب/ })).toBeVisible();
  const activityRow = studentPage.locator('div').filter({ hasText: 'اختبار E2E' }).filter({ hasText: '100%' }).first();
  await expect(activityRow).toBeVisible();
  await expect(studentPage.getByText('مكتمل ✓')).toBeVisible();

  await studentPage.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(studentPage).toHaveURL(/\/student$/);
  await expect(studentPage.getByRole('heading', { name: 'ادخل إلى مساحتك' })).toBeVisible();

  await studentPage.getByLabel('كود دخول الطالب').fill(accessCode);
  await studentPage.getByRole('button', { name: 'دخول' }).click();
  await expect(studentPage).toHaveURL(/\/student\/home$/, { timeout: 15_000 });
  await expect(studentPage.getByText('اختبار E2E')).toBeVisible();
  await expect(studentPage.getByText('100%').first()).toBeVisible();

  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guestPage = await guestContext.newPage();
  await guestPage.goto(`/play/${joinCode}`);
  await expect(guestPage.getByPlaceholder('اكتب اسمك هنا')).toBeVisible();
  await guestPage.getByPlaceholder('اكتب اسمك هنا').fill('ضيف البوابة');
  await guestPage.getByRole('button', { name: 'ابدأ الاختبار' }).click();
  await expect(guestPage.getByRole('button', { name: 'ابدأ الآن' })).toBeVisible();

  await guestContext.close();
  await studentContext.close();
  await teacherContext.close();
});
