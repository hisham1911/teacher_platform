import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));

async function loginTeacher(page) {
  await page.goto('/auth/login');
  await page.getByLabel('البريد الإلكتروني').fill(state.email);
  await page.getByLabel('كلمة المرور').fill('SecurePassword123!');

  const loginResponse = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/api/v1/auth/login'));
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  expect((await loginResponse).ok()).toBe(true);
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('English Spark golden path hides publishing/session complexity from the teacher', async ({ browser }) => {
  test.setTimeout(120_000);

  const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const teacher = await teacherContext.newPage();
  await loginTeacher(teacher);

  await teacher.getByRole('link', { name: 'إنشاء نشاط جديد' }).click();
  await expect(teacher.getByRole('heading', { name: 'ابدأ بالفكرة فقط.' })).toBeVisible();
  await expect(teacher.getByText('اسم للنشاط وطريقة تجربة الطلاب. الباقي سنمشي فيه خطوة بخطوة بدون إعدادات نشر معقدة.')).toBeVisible();

  const progressiveMode = teacher.locator('input[name="activity-mode"][value="ProgressiveChallenge"]');
  await expect(progressiveMode).toBeChecked();
  await expect(teacher.getByText('التحدي المتدرج', { exact: true })).toBeVisible();

  const activityTitle = `تحدي الفضاء E2E ${Date.now()}`;
  await teacher.getByLabel('اسم بسيط وواضح').fill(activityTitle);
  await teacher.getByRole('button', { name: 'التالي: إضافة الأسئلة' }).click();

  await expect(teacher).toHaveURL(/\/dashboard\/activities\/[0-9a-f-]+\/build\?mode=ProgressiveChallenge$/i);
  await expect(teacher.getByRole('heading', { name: activityTitle })).toBeVisible();
  await expect(teacher.getByText('الخطوة 2 · الأسئلة')).toBeVisible();
  await expect(teacher.getByText('ابدأ بالسهل ثم ارفع الصعوبة')).toBeVisible();

  await teacher.getByRole('button', { name: /من بنك الأسئلة/ }).click();
  await expect(teacher.getByRole('heading', { name: 'اختر من البنك' })).toBeVisible();

  const cairoQuestion = teacher.getByRole('listitem').filter({ hasText: 'ما عاصمة مصر؟' }).first();
  const weekQuestion = teacher.getByRole('listitem').filter({ hasText: 'كم عدد أيام الأسبوع؟' }).first();
  await expect(cairoQuestion).toBeVisible();
  await expect(weekQuestion).toBeVisible();
  await cairoQuestion.getByRole('checkbox').check();
  await weekQuestion.getByRole('checkbox').check();
  await expect(teacher.getByText('تم تحديد 2', { exact: true })).toBeVisible();

  await teacher.getByRole('button', { name: 'إضافة 2 للنشاط' }).click();
  await expect(teacher.getByText('2 سؤال جاهز', { exact: true })).toBeVisible();
  const prepareButton = teacher.getByRole('button', { name: 'التالي: تجهيز ومشاركة' });
  await expect(prepareButton).toBeEnabled();

  const launchResponsePromise = teacher.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/sessions/launch'));
  await prepareButton.click();
  const launchResponse = await launchResponsePromise;
  expect(launchResponse.ok()).toBe(true);
  const session = await launchResponse.json();
  expect(session.mode).toBe('ProgressiveChallenge');
  expect(session.status).toBe('Active');

  await expect(teacher).toHaveURL(new RegExp(`/dashboard/activities/.+/ready\\?sessionId=${session.id}&mode=ProgressiveChallenge$`));
  await expect(teacher.getByRole('heading', { name: 'النشاط جاهز 🎉' })).toBeVisible();
  await expect(teacher.getByText('الطلاب يمكنهم الدخول الآن')).toBeVisible();
  await expect(teacher.getByText(session.joinCode, { exact: true })).toBeVisible();
  await expect(teacher.getByRole('button', { name: 'نسخ رابط الطلاب' })).toBeVisible();
  await expect(teacher.getByTestId('activity-qr-code')).toBeVisible();

  const studentPagePromise = teacher.waitForEvent('popup');
  await teacher.getByRole('link', { name: /معاينة كطالب/ }).click();
  const student = await studentPagePromise;
  await student.waitForLoadState('domcontentloaded');
  await expect(student).toHaveURL(new RegExp(`/play/${session.joinCode}$`));
  await expect(student.getByPlaceholder('اكتب اسمك هنا')).toBeVisible();

  await student.getByPlaceholder('اكتب اسمك هنا').fill('طالبة English Spark');
  await student.getByRole('button', { name: 'ابدأ الاختبار' }).click();
  await expect(student.getByTestId('challenge-ready')).toBeVisible();

  const attemptResponse = student.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith(`/player/sessions/${session.joinCode}/attempts`));
  const firstQuestionResponse = student.waitForResponse((response) =>
    response.request().method() === 'GET' && response.url().endsWith('/current-question'));
  await student.getByRole('button', { name: 'ابدأ التحدي' }).click();
  expect((await attemptResponse).ok()).toBe(true);
  expect((await firstQuestionResponse).ok()).toBe(true);

  await expect(student.getByTestId('challenge-level-indicator')).toHaveText('المستوى 1 / 2');
  await expect(student.getByText('ما عاصمة مصر؟', { exact: true })).toBeVisible();

  await student.close();
  await teacherContext.close();
});
