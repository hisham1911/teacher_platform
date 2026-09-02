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

async function createStudentAndPortalCode(page, fullName) {
  await page.goto('/dashboard/students/new');
  await page.getByLabel('اسم الطالب').fill(fullName);
  await page.getByRole('button', { name: 'حفظ وإنشاء الكود' }).click();
  await expect(page).toHaveURL(/\/dashboard\/students\/[0-9a-f-]+$/i, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();

  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && /\/api\/v1\/tenants\/[0-9a-f-]+\/students\/[0-9a-f-]+\/portal-access$/i.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: 'إنشاء كود دخول' }).click();
  const response = await responsePromise;
  const text = await response.text();
  expect(response.status(), text).toBe(200);
  const { accessCode } = JSON.parse(text);
  expect(accessCode).toMatch(/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/);
  return { accessCode };
}

async function loginStudent(page, accessCode) {
  await page.goto('/student');
  await page.getByLabel('كود دخول الطالب').fill(accessCode);
  await page.getByRole('button', { name: 'دخول' }).click();
  await expect(page).toHaveURL(/\/student\/home$/, { timeout: 15_000 });
}

async function answerFirstQuestionAndLeave(page) {
  await expect(page.getByRole('button', { name: 'ابدأ الآن' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();
  await expect(page.getByText('ما عاصمة مصر؟')).toBeVisible();
  await page.getByText('القاهرة', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await expect(page.getByText(/إجابة صحيحة ✓/)).toBeVisible();
  await page.getByRole('button', { name: /السؤال التالي/ }).click();
  await expect(page.getByText('كم عدد أيام الأسبوع؟')).toBeVisible();
  await expect(page.getByText('سؤال 2 من 2')).toBeVisible();
}

async function finishFromSecondQuestion(page) {
  await expect(page.getByText('كم عدد أيام الأسبوع؟')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('سؤال 2 من 2')).toBeVisible();
  await page.getByText('سبعة', { exact: true }).click();
  await page.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await expect(page.getByText(/إجابة صحيحة ✓/)).toBeVisible();
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();
  await expect(page.getByText('100%').first()).toBeVisible();
}

test('Part I: classroom assignment is visible only to recipients and resumes across devices', async ({ browser }) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString(36);
  const studentAName = `طالب أ ${suffix}`;
  const studentBName = `طالب ب ${suffix}`;
  const outsiderName = `طالب خارج ${suffix}`;
  const classroomName = `فصل Phase 2 ${suffix}`;

  const teacherContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const teacherPage = await teacherContext.newPage();
  await loginTeacher(teacherPage);

  const studentA = await createStudentAndPortalCode(teacherPage, studentAName);
  const studentB = await createStudentAndPortalCode(teacherPage, studentBName);
  const outsider = await createStudentAndPortalCode(teacherPage, outsiderName);

  // Teacher creates a classroom and adds A + B from the existing Student Roster.
  await teacherPage.goto('/dashboard/classes/new');
  await teacherPage.getByLabel('اسم الفصل').fill(classroomName);
  await teacherPage.getByLabel(/السنة الدراسية/).fill('2026 / 2027');
  await teacherPage.getByRole('button', { name: 'إنشاء الفصل' }).click();
  await expect(teacherPage).toHaveURL(/\/dashboard\/classes\/[0-9a-f-]+$/i, { timeout: 15_000 });
  await teacherPage.getByRole('button', { name: new RegExp(studentAName) }).click();
  await expect(teacherPage.getByRole('listitem').filter({ hasText: studentAName })).toBeVisible();
  await teacherPage.getByRole('button', { name: new RegExp(studentBName) }).click();
  await expect(teacherPage.getByRole('listitem').filter({ hasText: studentBName })).toBeVisible();
  await expect(teacherPage.getByText(/طلاب الفصل/)).toContainText('(2)');
  await expect(teacherPage.getByText(outsiderName)).toBeVisible(); // available to add, but deliberately not a member

  // Published seed activity exposes the human Build → Preview → Assign / Share / Live decision.
  await teacherPage.goto(`/dashboard/activities/${state.quizId}/manage`);
  await expect(teacherPage.getByRole('heading', { name: 'ماذا تريد أن تفعل بالنشاط؟' })).toBeVisible();
  await expect(teacherPage.getByRole('link', { name: /إسناد لطلابي/ })).toBeVisible();
  await expect(teacherPage.getByRole('button', { name: /مشاركة رابط/ })).toBeVisible();
  await expect(teacherPage.getByRole('button', { name: /بدء Live/ })).toBeVisible();
  await teacherPage.getByRole('link', { name: /إسناد لطلابي/ }).click();
  await expect(teacherPage).toHaveURL(/\/dashboard\/activities\/[0-9a-f-]+\/assign\?/i);
  await expect(teacherPage.getByRole('heading', { name: 'إسناد النشاط' })).toBeVisible();

  const classCheckbox = teacherPage.getByRole('checkbox', { name: new RegExp(classroomName) });
  await expect(classCheckbox).toBeVisible();
  await classCheckbox.check();
  await teacherPage.getByRole('button', { name: /إسناد النشاط/ }).click();
  await expect(teacherPage).toHaveURL(/\/dashboard\/assignments\/[0-9a-f-]+$/i, { timeout: 15_000 });
  const assignmentUrl = teacherPage.url();
  await expect(teacherPage.getByText('تم إسناد النشاط')).toBeVisible();
  await expect(teacherPage.getByText('اختبار E2E', { exact: true })).toBeVisible();
  await expect(teacherPage.getByText('وصل إلى').locator('..')).toContainText('2');

  // Student A sees a new task, starts it, answers halfway, and exits.
  const deviceAContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const deviceAPage = await deviceAContext.newPage();
  await loginStudent(deviceAPage, studentA.accessCode);
  await expect(deviceAPage.getByRole('heading', { name: 'أنشطتك الحالية' })).toBeVisible();
  await expect(deviceAPage.getByText('اختبار E2E', { exact: true })).toBeVisible();
  await expect(deviceAPage.getByText('جديد', { exact: true })).toBeVisible();
  await deviceAPage.getByRole('button', { name: 'ابدأ' }).click();
  await expect(deviceAPage).toHaveURL(/\/play\//, { timeout: 15_000 });
  await answerFirstQuestionAndLeave(deviceAPage);
  await deviceAContext.close();

  // Fresh browser/device logs in with the same persistent identity and resumes question 2.
  const deviceA2Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const deviceA2Page = await deviceA2Context.newPage();
  await loginStudent(deviceA2Page, studentA.accessCode);
  await expect(deviceA2Page.getByText('اختبار E2E', { exact: true })).toBeVisible();
  await expect(deviceA2Page.getByText('جاري', { exact: true })).toBeVisible();
  await expect(deviceA2Page.getByText(/50% منجز/)).toBeVisible();
  await deviceA2Page.getByRole('button', { name: 'أكمل' }).click();
  await expect(deviceA2Page).toHaveURL(/\/play\//, { timeout: 15_000 });
  await finishFromSecondQuestion(deviceA2Page);

  await deviceA2Page.goto('/student/home');
  await expect(deviceA2Page.getByText('اختبار E2E', { exact: true })).toBeVisible();
  await expect(deviceA2Page.getByText('مكتمل', { exact: true }).first()).toBeVisible();
  await expect(deviceA2Page.getByText('100%').first()).toBeVisible();
  await expect(deviceA2Page.getByRole('button', { name: 'شاهد النتيجة' })).toBeVisible();
  await deviceA2Page.getByRole('button', { name: 'شاهد النتيجة' }).click();
  await expect(deviceA2Page).toHaveURL(/\/play\//, { timeout: 15_000 });
  await expect(deviceA2Page.getByText('100%').first()).toBeVisible();

  // Student B was in the class snapshot and sees the same task as New.
  const deviceBContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const deviceBPage = await deviceBContext.newPage();
  await loginStudent(deviceBPage, studentB.accessCode);
  await expect(deviceBPage.getByText('اختبار E2E', { exact: true })).toBeVisible();
  await expect(deviceBPage.getByText('جديد', { exact: true })).toBeVisible();
  await expect(deviceBPage.getByRole('button', { name: 'ابدأ' })).toBeVisible();

  // Student outside the class cannot infer or see the persistent assignment.
  const outsideContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const outsidePage = await outsideContext.newPage();
  await loginStudent(outsidePage, outsider.accessCode);
  await expect(outsidePage.getByText('اختبار E2E', { exact: true })).toHaveCount(0);
  await expect(outsidePage.getByText('لا يوجد شيء مطلوب منك الآن')).toBeVisible();

  // Teacher sees A's completed result linked to the same assignment while B is still not started.
  await teacherPage.goto(assignmentUrl);
  await expect(teacherPage.getByRole('heading', { name: 'تقدم الطلاب' })).toBeVisible();
  const rowA = teacherPage.getByRole('listitem').filter({ hasText: studentAName });
  const rowB = teacherPage.getByRole('listitem').filter({ hasText: studentBName });
  await expect(rowA).toContainText('مكتمل');
  await expect(rowA).toContainText('100%');
  await expect(rowA.getByRole('link', { name: 'التفاصيل' })).toBeVisible();
  await expect(rowB).toContainText('لم يبدأ');

  // Quick Join remains a separate, guest-first surface; Part H exercises a complete guest run.
  await outsidePage.goto('/join');
  await expect(outsidePage.getByRole('heading', { name: 'انضم لنشاط سريع' })).toBeVisible();
  await expect(outsidePage.getByLabel('رمز النشاط')).toBeVisible();
  await expect(outsidePage.getByRole('link', { name: 'الدخول إلى مساحتي' })).toHaveAttribute('href', '/student');

  await outsideContext.close();
  await deviceBContext.close();
  await deviceA2Context.close();
  await teacherContext.close();
});
