import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));

test('teacher hosts a live competition and scoring stays hidden until close', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();

  await host.goto('/auth/login');
  await host.getByLabel('البريد الإلكتروني').fill(state.email);
  await host.getByLabel('كلمة المرور').fill('SecurePassword123!');
  await host.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(host).toHaveURL(/\/dashboard$/);
  await host.goto(`/dashboard/sessions/${state.liveSessionId}/live?quizId=${state.quizId}`);
  await expect(host.getByRole('heading', { name: 'مسابقة E2E مباشرة' })).toBeVisible();
  await expect(host.getByRole('heading', { name: 'بانتظار الطلاب' })).toBeVisible();
  await expect(host.getByText(`/play/${state.liveJoinCode}`, { exact: false })).toBeVisible();

  await player.goto(`/play/${state.liveJoinCode}`);
  await player.getByPlaceholder('اكتب اسمك هنا').fill('طالب مباشر');
  await player.getByRole('button', { name: 'ابدأ الاختبار' }).click();
  await expect(player.getByRole('heading', { name: 'أنت داخل قاعة الانتظار' })).toBeVisible();
  await expect(host.getByText('طالب مباشر', { exact: true })).toBeVisible();

  await host.getByRole('button', { name: 'ابدأ المسابقة' }).click();
  await expect(host.getByRole('heading', { name: 'ما عاصمة مصر؟' })).toBeVisible();
  await expect(player.getByText('ما عاصمة مصر؟')).toBeVisible();
  await player.getByText('القاهرة', { exact: true }).click();
  await player.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await expect(player.getByText('تم تسجيل إجابتك ✓')).toBeVisible();
  await expect(player.getByText(/إجابة صحيحة/)).toHaveCount(0);
  await expect(host.getByText('1 من 1 أجابوا')).toBeVisible();

  await host.getByRole('button', { name: 'إغلاق السؤال' }).click();
  await expect(host.getByRole('heading', { name: 'لوحة الترتيب' })).toBeVisible();
  await expect(host.getByText('طالب مباشر', { exact: true })).toBeVisible();
  await expect(player.getByRole('heading', { name: 'أُغلق السؤال' })).toBeVisible();
  await expect(player.getByRole('listitem').filter({ hasText: 'طالب مباشر' })).toBeVisible();

  await host.getByRole('button', { name: 'السؤال التالي' }).click();
  await expect(host.getByRole('heading', { name: 'كم عدد أيام الأسبوع؟' })).toBeVisible();
  await expect(player.getByText('كم عدد أيام الأسبوع؟')).toBeVisible();
  await player.getByText('خمسة', { exact: true }).click();
  await player.getByRole('button', { name: 'تثبيت الإجابة' }).click();
  await expect(player.getByText('تم تسجيل إجابتك ✓')).toBeVisible();
  await host.getByRole('button', { name: 'إغلاق السؤال' }).click();
  await expect(player.getByRole('heading', { name: 'أُغلق السؤال' })).toBeVisible();

  await host.getByRole('button', { name: 'إنهاء المسابقة وعرض النتائج' }).click();
  await expect(host.getByRole('heading', { name: 'انتهت المسابقة' })).toBeVisible();
  await expect(host.getByRole('link', { name: 'فتح التقرير' })).toBeVisible();
  await expect(player.getByText('5 / 10')).toBeVisible();
  await player.reload();
  await expect(player.getByText('5 / 10')).toBeVisible();
  await expect(player.getByPlaceholder('اكتب اسمك هنا')).toHaveCount(0);

  await host.getByRole('link', { name: 'فتح التقرير' }).click();
  await expect(host).toHaveURL(/\/dashboard\/reports\//);
  await expect(host.getByRole('heading', { name: /تقرير اختبار E2E/ })).toBeVisible();

  await hostContext.close();
  await playerContext.close();
});
