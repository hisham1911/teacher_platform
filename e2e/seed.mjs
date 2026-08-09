// Seed عبر API مباشر: تسجيل → تأكيد → دخول → مستأجر → بنك → سؤالان MC → اختبار → نشر → جلسة → تفعيل.
// يكتب joinCode ومعلومات المحاولة إلى state.json لتستخدمها اختبارات Playwright.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(scriptDir, '..');

const API = process.env.API_URL || 'http://localhost:5000';
const MAIL_DIR =
  process.env.MAIL_DIR ||
  join(repoRoot, 'backend', 'src', 'TeacherPlatform.Api', '.dev-mail');
const E2E_DIR = scriptDir;

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok && res.status !== 400) {
    throw new Error(`POST ${path} -> ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`GET ${path} -> ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function latestConfirmationUrl(email) {
  const files = readdirSync(MAIL_DIR).filter((f) => f.endsWith('.json')).sort();
  for (let i = files.length - 1; i >= 0; i--) {
    const payload = JSON.parse(readFileSync(join(MAIL_DIR, files[i]), 'utf8'));
    if (payload.To === email && payload.Kind === 'Confirmation') {
      return payload.ActionUrl;
    }
  }
  throw new Error(`No confirmation email found for ${email} in ${MAIL_DIR}`);
}

const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
console.log('[seed] registering', email);
await post('/api/v1/auth/register', {
  email,
  password: 'SecurePassword123!',
  fullName: 'E2E Teacher',
});

const confirmUrl = latestConfirmationUrl(email);
const query = new URL(confirmUrl).searchParams;
await post('/api/v1/auth/confirm-email', { uid: query.get('uid'), token: query.get('token') });

const login = await post('/api/v1/auth/login', { email, password: 'SecurePassword123!' });
const token = login.accessToken;
console.log('[seed] logged in');

const tenant = await post('/api/v1/tenants', {
  name: `E2E Space ${Date.now() % 100000}`,
  slug: `e2e-${Date.now().toString(36)}`,
  countryCode: 'EG',
  timezone: 'Africa/Cairo',
  defaultLocale: 'ar',
}, token);
const tenantId = tenant.id;

const bank = await post(`/api/v1/tenants/${tenantId}/question-banks`, { name: 'E2E Bank' }, token);
const bankId = bank.id;

async function createQuestion(prompt, options) {
  const q = await post(`/api/v1/tenants/${tenantId}/questions`, {
    bankId,
    questionType: 'MultipleChoice',
    prompt,
    options,
  }, token);
  return q.id;
}

const q1 = await createQuestion('ما عاصمة مصر؟', [
  { text: 'القاهرة', isCorrect: true },
  { text: 'الإسكندرية', isCorrect: false },
]);
const q2 = await createQuestion('كم عدد أيام الأسبوع؟', [
  { text: 'سبعة', isCorrect: true },
  { text: 'خمسة', isCorrect: false },
]);

const quiz = await post(`/api/v1/tenants/${tenantId}/quizzes`, {
  title: 'اختبار E2E',
  slug: `e2e-quiz-${Date.now().toString(36)}`,
  description: 'وصف',
}, token);
const quizId = quiz.id;

for (const questionId of [q1, q2]) {
  await post(`/api/v1/tenants/${tenantId}/quizzes/${quizId}/draft/items`,
    { questionId, points: 5, isRequired: true }, token);
}

const draft = await get(`/api/v1/tenants/${tenantId}/quizzes/${quizId}/draft`, token);
const publish = await post(`/api/v1/tenants/${tenantId}/quizzes/${quizId}/publish`,
  { baseVersion: draft.version }, token);
if (publish.status && publish.status === 409) {
  throw new Error(`publish conflict: ${JSON.stringify(publish)}`);
}

const session = await post(`/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions`,
  { mode: 'SelfPaced', label: 'حصة E2E' }, token);
const sessionId = session.id;
const joinCode = session.joinCode;

await post(`/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions/${sessionId}/activate`,
  { baseVersion: session.version }, token);

const state = { api: API, joinCode, email };
writeFileSync(join(E2E_DIR, 'state.json'), JSON.stringify(state, null, 2));
console.log('[seed] done. joinCode =', joinCode);