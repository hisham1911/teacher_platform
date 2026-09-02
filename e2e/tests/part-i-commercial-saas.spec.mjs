import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));
const apiUrl = process.env.API_URL || 'http://localhost:5000';
const password = 'SecurePassword123!';

async function apiGet(request, path, token) {
  const response = await request.get(`${apiUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const text = await response.text();
  if (!response.ok()) {
    throw new Error(`GET ${path} -> ${response.status()}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function apiPost(request, path, body, token) {
  const response = await request.post(`${apiUrl}${path}`, {
    data: body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const text = await response.text();
  if (!response.ok()) {
    throw new Error(`POST ${path} -> ${response.status()}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function loginApi(request) {
  return apiPost(request, '/api/v1/auth/login', {
    email: state.email,
    password,
  });
}

function contract({ packageName, maxStudents, bulkImport }) {
  return {
    contractVersion: 2,
    package: packageName,
    limits: {
      maxQuizzesPerTenant: 100,
      maxQuestionsPerQuiz: 200,
      maxPublishedQuizzesPerTenant: 50,
      maxAttemptsPerMonth: 10000,
      maxStorageBytes: 5368709120,
      maxCertificatesPerMonth: 10000,
      maxStudents,
      maxMembers: packageName === 'Teacher' ? 1 : 5,
      maxClasses: packageName === 'Teacher' ? 10 : 75,
      maxActiveAssignments: packageName === 'Teacher' ? 20 : 250,
      maxLiveParticipants: packageName === 'Teacher' ? 50 : 250,
    },
    entitlements: {
      bulkImport,
      advancedReports: bulkImport,
      certificates: bulkImport,
      customBranding: bulkImport,
      dataExport: bulkImport,
      customDomain: false,
    },
  };
}

async function prepareCommercialPlans(request) {
  const login = await loginApi(request);
  expect(login.user.platformRoles).toContain('PlatformAdmin');

  // Earlier Full Browser parts intentionally create managed students in the same
  // seeded workspace. Build the quota around the real current usage so this test
  // remains isolated from execution order while still proving allow -> block -> upgrade.
  const tenants = await apiGet(request, '/api/v1/platform/tenants', login.accessToken);
  const workspace = tenants.find((tenant) => tenant.id === state.tenantId);
  expect(workspace).toBeDefined();
  const currentStudents = workspace.usage?.students ?? 0;

  const suffix = `${Date.now()}`.slice(-7);
  const teacherPlan = await apiPost(request, '/api/v1/platform/plans', {
    code: `e2e-teacher-${suffix}`,
    name: `E2E Teacher ${suffix}`,
    isActive: true,
    contract: contract({ packageName: 'Teacher', maxStudents: currentStudents + 1, bulkImport: false }),
  }, login.accessToken);
  const proPlan = await apiPost(request, '/api/v1/platform/plans', {
    code: `e2e-pro-${suffix}`,
    name: `E2E Teacher Pro ${suffix}`,
    isActive: true,
    contract: contract({ packageName: 'TeacherPro', maxStudents: currentStudents + 3, bulkImport: true }),
  }, login.accessToken);

  await apiPost(
    request,
    `/api/v1/platform/tenants/${state.tenantId}/subscriptions/activate`,
    { planId: teacherPlan.id, changeReason: 'Commercial E2E low-capacity start' },
    login.accessToken,
  );

  return { teacherPlan, proPlan };
}

async function loginBrowser(page) {
  await page.goto('/auth/login');
  await page.getByLabel('البريد الإلكتروني').fill(state.email);
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول إلى English Spark' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function addStudent(page, name) {
  await page.goto('/dashboard/students/new');
  await expect(page.getByRole('heading', { name: 'إضافة طالب' })).toBeVisible();
  await page.getByLabel('اسم الطالب').fill(name);
  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST'
      && /\/api\/v1\/tenants\/[0-9a-f-]+\/students$/i.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: 'حفظ وإنشاء الكود' }).click();
  return responsePromise;
}

function workspaceCard(page) {
  return page.locator('article').filter({ hasText: state.tenantName }).first();
}

test('commercial SaaS: quota -> upgrade -> retry, entitlement unlock, suspend -> reactivate', async ({ browser, request }) => {
  test.setTimeout(180_000);
  const { proPlan } = await prepareCommercialPlans(request);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await loginBrowser(page);

  const firstResponse = await addStudent(page, 'طالب الحد الأول');
  expect(firstResponse.status(), await firstResponse.text()).toBe(201);
  await expect(page).toHaveURL(/\/dashboard\/students\/[0-9a-f-]+$/i);

  const secondResponse = await addStudent(page, 'طالب بعد الترقية');
  expect(secondResponse.status()).toBe(403);
  const blockedProblem = await secondResponse.json();
  expect(blockedProblem.errorCode).toBe('QuotaExceeded');
  await expect(page.getByRole('alert')).toContainText('وصلت مساحة العمل إلى الحد المسموح');
  await expect(page.getByRole('alert')).toContainText('اطلب ترقية الخطة');

  await page.goto(`/dashboard/activities/${state.quizId}/bulk?mode=SelfPaced`);
  await expect(page.getByRole('heading', { name: 'الاستيراد الجماعي غير متاح في خطتك' })).toBeVisible();
  await expect(page.getByText(/ترقية الخطة/)).toBeVisible();

  await page.goto('/platform');
  await expect(page.getByRole('heading', { name: 'إدارة العملاء والخطط والاستخدام' })).toBeVisible();
  const customer = workspaceCard(page);
  await expect(customer).toBeVisible();
  await customer.getByLabel(`خطة ${state.tenantName}`).selectOption(proPlan.id);
  await customer.getByRole('button', { name: 'تغيير الخطة' }).click();
  await expect(page.getByText('تم تغيير خطة العميل بأمان.')).toBeVisible();

  const retryResponse = await addStudent(page, 'طالب بعد الترقية');
  expect(retryResponse.status(), await retryResponse.text()).toBe(201);
  await expect(page).toHaveURL(/\/dashboard\/students\/[0-9a-f-]+$/i);

  await page.goto(`/dashboard/activities/${state.quizId}/bulk?mode=SelfPaced`);
  await expect(page.getByRole('heading', { name: 'استيراد أسئلة من ملف' })).toBeVisible();
  await expect(page.getByText('1. اختر ملف الأسئلة')).toBeVisible();

  await page.goto('/platform');
  const activeCustomer = workspaceCard(page);
  await activeCustomer.getByRole('button', { name: 'إيقاف Workspace' }).click();
  await expect(page.getByText('تم إيقاف مساحة العمل.')).toBeVisible();

  const blockedStudentsPromise = page.waitForResponse((response) =>
    response.request().method() === 'GET'
      && /\/api\/v1\/tenants\/[0-9a-f-]+\/students(?:\?|$)/i.test(response.url()));
  await page.goto('/dashboard/students');
  const blockedStudents = await blockedStudentsPromise;
  expect(blockedStudents.status()).toBe(423);
  expect((await blockedStudents.json()).errorCode).toBe('WorkspaceSuspended');
  await expect(page.getByRole('alert')).toContainText('تعذر تحميل الطلاب');

  await page.goto('/platform');
  const suspendedCustomer = workspaceCard(page);
  await suspendedCustomer.getByRole('button', { name: 'إعادة تفعيل Workspace' }).click();
  await expect(page.getByText('تمت إعادة تفعيل مساحة العمل.')).toBeVisible();

  const restoredStudentsPromise = page.waitForResponse((response) =>
    response.request().method() === 'GET'
      && /\/api\/v1\/tenants\/[0-9a-f-]+\/students(?:\?|$)/i.test(response.url()));
  await page.goto('/dashboard/students');
  const restoredStudents = await restoredStudentsPromise;
  expect(restoredStudents.status(), await restoredStudents.text()).toBe(200);
  await expect(page.getByText('طالب الحد الأول', { exact: true })).toBeVisible();
  await expect(page.getByText('طالب بعد الترقية', { exact: true })).toBeVisible();

  await context.close();
});
