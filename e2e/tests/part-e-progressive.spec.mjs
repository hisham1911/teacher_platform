import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));
const screenshotsDir = join(e2eDir, 'visual-results', 'progressive-challenge');

async function loginTeacher(page) {
  await page.goto('/auth/login');
  await page.getByLabel('البريد الإلكتروني').fill(state.email);
  await page.getByLabel('كلمة المرور').fill('SecurePassword123!');
  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/api/v1/auth/login'));
  await page.getByRole('button', { name: 'دخول إلى English Spark' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function assertNoOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

async function capture(page, name, width, height) {
  await page.setViewportSize({ width, height });
  await assertNoOverflow(page);
  await page.screenshot({ path: join(screenshotsDir, `${name}-${width}x${height}.png`), fullPage: true });
}

async function joinAndStart(page, joinCode, displayName) {
  await page.goto(`/play/${joinCode}`);
  await page.getByPlaceholder('اكتب اسمك هنا').fill(displayName);
  await page.getByRole('button', { name: 'ابدأ الاختبار' }).click();
  await expect(page.getByTestId('challenge-ready')).toBeVisible();

  const startResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith(`/player/sessions/${joinCode}/attempts`));
  const questionResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'GET' && response.url().includes(`/player/sessions/${joinCode}/attempts/`) && response.url().endsWith('/current-question'));
  await page.getByRole('button', { name: 'ابدأ التحدي' }).click();
  const [startResponse, questionResponse] = await Promise.all([startResponsePromise, questionResponsePromise]);
  expect(startResponse.ok()).toBe(true);
  expect(questionResponse.ok()).toBe(true);
  return {
    attempt: await startResponse.json(),
    question: await questionResponse.json(),
  };
}

test('progressive challenge teacher, player, resume, outcomes, and report', async ({ browser }) => {
  test.setTimeout(180_000);
  mkdirSync(screenshotsDir, { recursive: true });

  const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const playerContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const teacher = await teacherContext.newPage();
  const player = await playerContext.newPage();

  await loginTeacher(teacher);
  const quizId = state.quizId;

  await teacher.goto(`/dashboard/quizzes/${quizId}/edit`);
  await expect(teacher.getByRole('heading', { name: 'اختبار E2E' })).toBeVisible();
  await expect(teacher.getByText('2 أسئلة', { exact: true })).toBeVisible();
  await teacher.goto(`/dashboard/quizzes/${quizId}/sessions`);
  await teacher.getByLabel('عنوان الجلسة (اختياري)').fill('جلسة التحدي المتدرج E2E');
  await teacher.getByLabel('نمط الجلسة').selectOption('ProgressiveChallenge');
  await expect(teacher.getByText(/رتّب أسئلة الاختبار من الأسهل إلى الأصعب/)).toBeVisible();
  const sessionResponsePromise = teacher.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith(`/quizzes/${quizId}/sessions`));
  await teacher.getByRole('button', { name: 'إنشاء جلسة', exact: true }).click();
  const sessionResponse = await sessionResponsePromise;
  expect(sessionResponse.ok()).toBe(true);
  const session = await sessionResponse.json();
  expect(session.mode).toBe('ProgressiveChallenge');

  await teacher.getByRole('link', { name: /فتح صفحة الجلسة/ }).click();
  await expect(teacher).toHaveURL(new RegExp(`/dashboard/sessions/${session.id}`));
  await expect(teacher.getByRole('heading', { name: 'جلسة التحدي المتدرج E2E' })).toBeVisible();
  const activateResponsePromise = teacher.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith(`/sessions/${session.id}/activate`));
  await teacher.getByRole('button', { name: 'تفعيل الجلسة' }).click();
  expect((await activateResponsePromise).ok()).toBe(true);
  await expect(teacher.getByText(/نشطة/)).toBeVisible();
  await expect(teacher.getByText(`/play/${session.joinCode}`, { exact: false })).toBeVisible();

  await player.goto(`/play/${session.joinCode}`);
  await expect(player.getByPlaceholder('اكتب اسمك هنا')).toBeVisible();
  await capture(player, '01-join', 1440, 900);
  await player.getByPlaceholder('اكتب اسمك هنا').fill('طالبة التحدي');
  await player.getByRole('button', { name: 'ابدأ الاختبار' }).click();
  await expect(player.getByTestId('challenge-ready')).toBeVisible();
  await capture(player, '02-ready', 1280, 720);

  const startResponsePromise = player.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith(`/player/sessions/${session.joinCode}/attempts`));
  const firstQuestionResponsePromise = player.waitForResponse((response) =>
    response.request().method() === 'GET' && response.url().endsWith('/current-question'));
  await player.getByRole('button', { name: 'ابدأ التحدي' }).click();
  const attempt = await (await startResponsePromise).json();
  const firstQuestion = await (await firstQuestionResponsePromise).json();
  await expect(player.getByTestId('challenge-level-indicator')).toHaveText('المستوى 1 / 2');
  await expect(player.getByTestId('challenge-score-indicator')).toContainText('0');
  await expect(player.getByLabel('سلم المستويات')).toBeVisible();
  await capture(player, '03-first-level', 1280, 720);

  await player.keyboard.press('Tab');
  await expect(player.locator('input[type="radio"]').first()).toBeFocused();
  const firstOption = player.getByText('القاهرة', { exact: true });
  const firstOptionBox = await firstOption.locator('..').boundingBox();
  expect(firstOptionBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await firstOption.click();
  await player.getByRole('button', { name: /تأكيد الإجابة/ }).click();
  await expect(player.getByTestId('challenge-feedback-correct')).toBeVisible();
  await expect(player.getByTestId('challenge-score-indicator')).toContainText('5');
  await capture(player, '04-correct-feedback', 1280, 720);
  await player.getByRole('button', { name: 'متابعة الآن' }).click();
  await expect(player.getByTestId('challenge-level-indicator')).toHaveText('المستوى 2 / 2');
  await expect(player.getByText('كم عدد أيام الأسبوع؟', { exact: true })).toBeVisible();

  const resumeResponsePromise = player.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith(`/player/sessions/${session.joinCode}/attempts`));
  await player.reload();
  const resumedAttempt = await (await resumeResponsePromise).json();
  expect(resumedAttempt.attemptId).toBe(attempt.attemptId);
  expect(resumedAttempt.currentQuestionIndex).toBe(1);
  expect(resumedAttempt.scoreSoFar).toBe(5);
  await expect(player.getByTestId('challenge-level-indicator')).toHaveText('المستوى 2 / 2');
  await expect(player.getByTestId('challenge-score-indicator')).toContainText('5');
  await expect(player.getByText('كم عدد أيام الأسبوع؟', { exact: true })).toBeVisible();

  const replayResponse = await playerContext.request.post(
    `${state.api}/api/v1/player/sessions/${session.joinCode}/attempts/${attempt.attemptId}/answers`,
    {
      data: {
        quizVersionItemId: firstQuestion.quizVersionItemId,
        answerJson: JSON.stringify({ optionId: firstQuestion.options.find((option) => option.optionText === 'القاهرة').optionId }),
      },
    },
  );
  expect(replayResponse.ok()).toBe(true);
  expect((await replayResponse.json()).scoreAwarded).toBe(5);
  await expect(player.getByTestId('challenge-score-indicator')).toContainText('5');

  const isolatedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const isolatedPlayer = await isolatedContext.newPage();
  await isolatedPlayer.goto(`/play/${session.joinCode}`);
  await expect(isolatedPlayer.getByPlaceholder('اكتب اسمك هنا')).toBeVisible();
  const isolatedStart = await joinAndStart(isolatedPlayer, session.joinCode, 'طالبة التحدي');
  expect(isolatedStart.attempt.attemptId).not.toBe(attempt.attemptId);
  expect(isolatedStart.attempt.currentQuestionIndex).toBe(0);
  expect(isolatedStart.attempt.scoreSoFar).toBe(0);
  await isolatedContext.close();

  await capture(player, '05-middle-level', 390, 844);
  await player.getByText('خمسة', { exact: true }).click();
  await player.getByRole('button', { name: /تأكيد الإجابة/ }).click();
  await expect(player.getByTestId('challenge-feedback-wrong')).toBeVisible();
  await capture(player, '06-wrong-feedback', 375, 812);
  await expect(player.getByTestId('challenge-result-banner')).toContainText('انتهى التحدي');
  await expect(player.getByTestId('challenge-reached-level')).toContainText('المستوى 2 من 2');
  await expect(player.getByText('5 / 10')).toBeVisible();
  await expect(player.getByRole('heading', { name: 'الشهادة' })).toHaveCount(0);
  await capture(player, '07-loss-result', 375, 812);

  await expect(player.getByRole('heading', { name: 'استبانة تجربة الاختبار' })).toBeVisible();
  await player.getByRole('group', { name: /ما تقييمك للاختبار/ }).getByText('5', { exact: true }).click();
  await player.getByRole('group', { name: /هل كانت التعليمات واضحة/ }).getByText('نعم', { exact: true }).click();
  await player.getByLabel('ما أكثر شيء أعجبك؟').fill('تدرج المستويات');
  await player.getByRole('button', { name: 'إرسال الاستبيان' }).click();
  await expect(player.getByText('شكرًا لمشاركتك')).toBeVisible();
  await capture(player, '08-survey-complete', 375, 812);

  await teacher.goto(`/dashboard/reports/${session.id}?quizId=${quizId}`);
  await expect(teacher.getByRole('heading', { name: 'تقرير اختبار E2E' })).toBeVisible();
  await expect(teacher.getByText('التحدي المتدرج', { exact: true })).toBeVisible();
  const challengeRow = teacher.getByRole('row').filter({ hasText: 'طالبة التحدي' }).filter({ hasText: '5 / 10' });
  await expect(challengeRow).toBeVisible();
  await expect(challengeRow.getByTestId('challenge-report-progress')).toHaveText('المستوى 2 من 2');
  await challengeRow.getByRole('link', { name: 'عرض التفاصيل' }).click();
  await expect(teacher.getByTestId('challenge-attempt-progress')).toHaveText('وصل إلى المستوى 2 من 2');

  const winnerContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const winner = await winnerContext.newPage();
  await joinAndStart(winner, session.joinCode, 'الفائزة بالتحدي');
  await winner.getByText('القاهرة', { exact: true }).click();
  await winner.getByRole('button', { name: /تأكيد الإجابة/ }).click();
  await expect(winner.getByTestId('challenge-feedback-correct')).toBeVisible();
  await winner.getByRole('button', { name: 'متابعة الآن' }).click();
  await winner.getByText('سبعة', { exact: true }).click();
  await winner.getByRole('button', { name: /تأكيد الإجابة/ }).click();
  await expect(winner.getByTestId('challenge-feedback-correct')).toBeVisible();
  const certificateResponsePromise = winner.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/certificate'));
  await winner.getByRole('button', { name: 'متابعة الآن' }).click();
  await expect(winner.getByTestId('challenge-result-banner')).toContainText('أكملت التحدي!');
  await expect(winner.getByText('10 / 10')).toBeVisible();
  const certificateResponse = await certificateResponsePromise;
  expect(certificateResponse.ok()).toBe(true);
  await expect(winner.getByRole('heading', { name: 'الشهادة' })).toBeVisible();
  await capture(winner, '09-win-result', 1440, 900);

  await winnerContext.close();
  await playerContext.close();
  await teacherContext.close();
});
