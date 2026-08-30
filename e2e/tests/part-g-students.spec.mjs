import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = join(e2eDir, '..');
const apiUrl = process.env.API_URL || 'http://localhost:5000';
const mailDir = process.env.MAIL_DIR || join(repoRoot, 'backend', 'src', 'TeacherPlatform.Api', '.dev-mail');
const password = 'SecurePassword123!';

function latestConfirmationUrl(email) {
  const files = readdirSync(mailDir).filter((file) => file.endsWith('.json')).sort();
  for (let index = files.length - 1; index >= 0; index--) {
    const payload = JSON.parse(readFileSync(join(mailDir, files[index]), 'utf8'));
    if (payload.To === email && payload.Kind === 'Confirmation') return payload.ActionUrl;
  }
  throw new Error(`No confirmation email found for ${email}`);
}

async function post(request, path, body, token) {
  const response = await request.post(`${apiUrl}${path}`, {
    data: body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok()) throw new Error(`POST ${path} -> ${response.status()}: ${await response.text()}`);
  return response.json();
}

async function prepareTeacher(request) {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `spark-students-${nonce}@example.test`;

  await post(request, '/api/v1/auth/register', {
    email,
    password,
    fullName: 'Student Roster Teacher',
  });

  const confirmation = new URL(latestConfirmationUrl(email));
  await post(request, '/api/v1/auth/confirm-email', {
    uid: confirmation.searchParams.get('uid'),
    token: confirmation.searchParams.get('token'),
  });

  const login = await post(request, '/api/v1/auth/login', { email, password });
  await post(request, '/api/v1/tenants', {
    name: `Student Roster ${nonce}`,
    slug: `students-${Date.now().toString(36)}`,
    countryCode: 'EG',
    timezone: 'Africa/Cairo',
    defaultLocale: 'ar',
  }, login.accessToken);

  return { email };
}

async function loginTeacher(page, email) {
  await page.goto('/auth/login');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول إلى English Spark' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('teacher can add an Arabic-named student with optional fields empty', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const identity = await prepareTeacher(request);
  const context = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const page = await context.newPage();

  await loginTeacher(page, identity.email);
  await page.goto('/dashboard/students');
  await expect(page.getByRole('heading', { name: 'الطلاب' })).toBeVisible();
  await page.getByRole('link', { name: /إضافة طالب/ }).first().click();

  await expect(page.getByRole('heading', { name: 'إضافة طالب' })).toBeVisible();
  await page.getByLabel('اسم الطالب').fill('هشام');
  await expect(page.getByLabel(/المستوى أو الصف/)).toHaveValue('');
  await expect(page.getByLabel(/ملاحظات/)).toHaveValue('');

  const createResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && /\/api\/v1\/tenants\/[0-9a-f-]+\/students$/i.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: 'حفظ الطالب' }).click();
  const createResponse = await createResponsePromise;
  const responseBody = await createResponse.text();
  expect(createResponse.status(), responseBody).toBe(201);

  await expect(page).toHaveURL(/\/dashboard\/students\/[0-9a-f-]+$/i);
  await expect(page.getByRole('heading', { name: 'هشام' })).toBeVisible();
  await expect(page.getByText(/تمت إضافة الطالب/)).toBeVisible();
  await expect(page.getByText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)).toBeVisible();

  await page.goto('/dashboard/students');
  await expect(page.getByText('هشام', { exact: true })).toBeVisible();

  await context.close();
});
