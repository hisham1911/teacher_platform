import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const e2eDir = fileURLToPath(new URL('..', import.meta.url));
const state = JSON.parse(readFileSync(join(e2eDir, 'state.json'), 'utf8'));
const JOIN_CODE = state.joinCode;

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
  await page.getByRole('button', { name: 'إنهاء الاختبار' }).click();

  // النتيجة: 10/10، 100%، ناجح
  await expect(page.getByText(/انتهى الاختبار/)).toBeVisible();
  await expect(page.getByText('10 / 10')).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.getByText(/ناجح ✓/)).toBeVisible();

  // F5 على صفحة النتيجة — تُستعاد النتيجة تلقائيًا (لا شاشة انضمام/استعداد)
  await page.reload();
  await expect(page.getByText('10 / 10')).toBeVisible();
  await expect(page.getByText(/ناجح ✓/)).toBeVisible();
  await expect(page.getByPlaceholder('اكتب اسمك هنا')).not.toBeVisible();
  console.log('[part-b] PASS — survived API restart + auto-restore result across F5');
});