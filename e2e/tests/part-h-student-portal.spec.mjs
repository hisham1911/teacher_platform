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

async function loginStudentPortal(page, accessCode) {
  await page.goto('/student');
  await expect(page.getByRole('heading', { name: 'ادخل إلى مساحتك' })).toBeVisible();
  await page.getByLabel('كود دخول الطالب').fill(accessCode);
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page).toHaveURL(/\/student\/home$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /أهلًا طالب/ })).toBeVisible();
}

async function startSeedQuizThroughFirstQuestion(page) {
  await expect(page.getByRole('button', { name: 'ابدأ الآن' })).toBeVisible();
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();

  await expect(page.getByText('ما عاصمة مصر؟')).toBeVisible();
  await page.getByText('القاهرة', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await expect(page.getByText(/إجابة صحيحة ✓/)).toBeVisible();
  await page.getByRole('button', { name: /السؤال التالي/ }).click();
  await expect(page.getByText('كم عدد أيام الأسبوع؟')).toBeVisible();
  await expect(page.getByText('سؤال 2 من 2')).toBeVisible();
}

async function finishSeedQuizFromSecondQuestion(page) {
  await expect(page.getByText('كم عدد أيام الأسبوع؟')).toBeVisible();
  await expect(page.getByText('سؤال 2 من 2')).toBeVisible();
  await page.getByText('سبعة', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await expect(page.getByText(/إجابة صحيحة ✓/)).toBeVisible();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await expect(page.getByText('100%').first()).toBeVisible();
}

test('persistent student portal supports cross-device resume and reusable credentials', async ({ browser, request }) => {
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
  await expect(teacherPage.getByTestId('student-portal-qr-code')).toBeVisible();
  await expect(teacherPage.getByRole('button', { name: 'طباعة بطاقة الدخول' })).toBeVisible();

  const deviceAContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const deviceAPage = await deviceAContext.newPage();

  // Quick Join remains activity-only and points persistent students to their separate portal.
  await deviceAPage.goto('/join');
  await expect(deviceAPage.getByRole('heading', { name: 'انضم لنشاط سريع' })).toBeVisible();
  await expect(deviceAPage.getByLabel('رمز النشاط')).toBeVisible();
  await expect(deviceAPage.getByRole('link', { name: 'الدخول إلى مساحتي' })).toHaveAttribute('href', '/student');
  await expect(deviceAPage.getByLabel('كود دخول الطالب')).toHaveCount(0);

  await loginStudentPortal(deviceAPage, accessCode);
  await expect(deviceAPage.getByText(state.email)).toHaveCount(0);

  const portalJoinAPromise = deviceAPage.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith(`/player/sessions/${joinCode}/portal-join`));
  await deviceAPage.goto(`/play/${joinCode}`);
  const portalJoinA = await portalJoinAPromise;
  expect(portalJoinA.status(), await portalJoinA.text()).toBe(200);
  await expect(deviceAPage.getByPlaceholder('اكتب اسمك هنا')).toHaveCount(0);
  await expect(deviceAPage.getByText('اختبار E2E', { exact: true })).toBeVisible();

  const deviceACookies = await deviceAContext.cookies();
  const portalCookieA = deviceACookies.find((cookie) => cookie.name === 'tp-student');
  const guestCookieA = deviceACookies.find((cookie) => cookie.name === 'tp-guest');
  expect(portalCookieA).toBeDefined();
  expect(portalCookieA.httpOnly).toBe(true);
  expect(guestCookieA).toBeDefined();
  expect(guestCookieA.httpOnly).toBe(true);

  // Device A starts the managed attempt and stops at question 2.
  await startSeedQuizThroughFirstQuestion(deviceAPage);

  // Device B has no cookies. The same portal credential must resolve the same managed student
  // and resume the in-progress attempt at question 2 rather than creating a new identity.
  const deviceBContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const deviceBPage = await deviceBContext.newPage();
  await loginStudentPortal(deviceBPage, accessCode);

  const portalJoinBPromise = deviceBPage.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith(`/player/sessions/${joinCode}/portal-join`));
  await deviceBPage.goto(`/play/${joinCode}`);
  const portalJoinB = await portalJoinBPromise;
  expect(portalJoinB.status(), await portalJoinB.text()).toBe(200);
  await expect(deviceBPage.getByPlaceholder('اكتب اسمك هنا')).toHaveCount(0);
  await expect(deviceBPage.getByText('كم عدد أيام الأسبوع؟')).toBeVisible();
  await expect(deviceBPage.getByText('سؤال 2 من 2')).toBeVisible();

  const deviceBCookies = await deviceBContext.cookies();
  const portalCookieB = deviceBCookies.find((cookie) => cookie.name === 'tp-student');
  const guestCookieB = deviceBCookies.find((cookie) => cookie.name === 'tp-guest');
  expect(portalCookieB).toBeDefined();
  expect(portalCookieB.httpOnly).toBe(true);
  expect(guestCookieB).toBeDefined();
  expect(guestCookieB.httpOnly).toBe(true);

  await finishSeedQuizFromSecondQuestion(deviceBPage);
  await deviceBPage.goto('/student/home');
  await expect(deviceBPage.getByRole('heading', { name: /أهلًا طالب/ })).toBeVisible();
  const activityRow = deviceBPage.locator('div').filter({ hasText: 'اختبار E2E' }).filter({ hasText: '100%' }).first();
  await expect(activityRow).toBeVisible();
  await expect(deviceBPage.getByText('مكتمل ✓')).toBeVisible();
  await expect(deviceBPage.getByRole('heading', { name: 'آخر محاولاتك' })).toBeVisible();

  await deviceBPage.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(deviceBPage).toHaveURL(/\/student$/);
  await expect(deviceBPage.getByRole('heading', { name: 'ادخل إلى مساحتك' })).toBeVisible();

  await deviceBPage.getByLabel('كود دخول الطالب').fill(accessCode);
  await deviceBPage.getByRole('button', { name: 'دخول' }).click();
  await expect(deviceBPage).toHaveURL(/\/student\/home$/, { timeout: 15_000 });
  await expect(deviceBPage.getByText('اختبار E2E')).toBeVisible();
  await expect(deviceBPage.getByText('100%').first()).toBeVisible();

  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guestPage = await guestContext.newPage();
  await guestPage.goto(`/play/${joinCode}`);
  await expect(guestPage.getByPlaceholder('اكتب اسمك هنا')).toBeVisible();
  await guestPage.getByPlaceholder('اكتب اسمك هنا').fill('ضيف البوابة');
  await guestPage.getByRole('button', { name: 'ابدأ الاختبار' }).click();
  await expect(guestPage.getByRole('button', { name: 'ابدأ الآن' })).toBeVisible();

  await guestContext.close();
  await deviceBContext.close();
  await deviceAContext.close();
  await teacherContext.close();
});
