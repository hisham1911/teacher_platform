import { beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_URL = 'http://localhost:5000';
const TENANT = 'tenant-1';
const QUIZ = 'quiz-1';

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', BASE_URL);
  window.localStorage.clear();
  vi.resetModules();
});

/** يلتقط آخر طلب fetch ويعيد استجابة JSON ناجحة. */
function captureFetch(responseBody: unknown = {}, status = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    calls.push({ url, init });
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

describe('quizzesApi request shapes', () => {
  it('list يبني query string للحالة والبحث والترقيم', async () => {
    const calls = captureFetch({ items: [], page: 2, pageSize: 10, totalCount: 0 });
    const { quizzesApi } = await import('../../data/api-client/endpoints');

    await quizzesApi.list(TENANT, { status: 'Published', search: 'رياضيات', page: 2, pageSize: 10 });

    expect(calls).toHaveLength(1);
    const url = calls[0]!.url;
    expect(url).toContain(`/api/v1/tenants/${TENANT}/quizzes?`);
    expect(url).toContain('status=Published');
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=10');
    expect(decodeURIComponent(url)).toContain('search=رياضيات');
    expect(calls[0]!.init?.method).toBe('GET');
  });

  it('list بدون مرشحات لا يضيف query string', async () => {
    const calls = captureFetch({ items: [] });
    const { quizzesApi } = await import('../../data/api-client/endpoints');

    await quizzesApi.list(TENANT, {});

    expect(calls[0]!.url).toBe(`${BASE_URL}/api/v1/tenants/${TENANT}/quizzes`);
  });

  it('create يرسل POST بالجسم الصحيح', async () => {
    const calls = captureFetch({ id: QUIZ });
    const { quizzesApi } = await import('../../data/api-client/endpoints');

    await quizzesApi.create(TENANT, { title: 'اختبار', slug: 'quiz-1', description: 'وصف' });

    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.url).toBe(`${BASE_URL}/api/v1/tenants/${TENANT}/quizzes`);
    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body).toEqual({ title: 'اختبار', slug: 'quiz-1', description: 'وصف' });
  });

  it('updateDraft يرسل PUT إلى مسار المسودة مع baseVersion', async () => {
    const calls = captureFetch({});
    const { quizzesApi } = await import('../../data/api-client/endpoints');

    await quizzesApi.updateDraft(TENANT, QUIZ, {
      title: 'عنوان',
      passingPercentage: 60,
      timeMode: 'TotalTime',
      timeLimitSeconds: 600,
      shuffleQuestions: true,
      shuffleOptions: false,
      theme: { template: 'default', primaryColor: '#0284c7', secondaryColor: '#0f172a', backgroundColor: '#ffffff' },
      baseVersion: 3,
    });

    expect(calls[0]!.init?.method).toBe('PUT');
    expect(calls[0]!.url).toBe(`${BASE_URL}/api/v1/tenants/${TENANT}/quizzes/${QUIZ}/draft`);
    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.baseVersion).toBe(3);
    expect(body.timeMode).toBe('TotalTime');
    expect(body.timeLimitSeconds).toBe(600);
  });

  it('addItem يرسل POST إلى مسار عناصر المسودة', async () => {
    const calls = captureFetch({});
    const { quizzesApi } = await import('../../data/api-client/endpoints');

    await quizzesApi.addItem(TENANT, QUIZ, { questionId: 'q-9', points: 5, isRequired: true });

    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.url).toBe(`${BASE_URL}/api/v1/tenants/${TENANT}/quizzes/${QUIZ}/draft/items`);
    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body).toEqual({ questionId: 'q-9', points: 5, isRequired: true });
  });

  it('reorderItems يرسل PUT إلى مسار إعادة الترتيب بقائمة المعرفات', async () => {
    const calls = captureFetch({});
    const { quizzesApi } = await import('../../data/api-client/endpoints');

    await quizzesApi.reorderItems(TENANT, QUIZ, { orderedItemIds: ['a', 'b', 'c'] });

    expect(calls[0]!.init?.method).toBe('PUT');
    expect(calls[0]!.url).toBe(`${BASE_URL}/api/v1/tenants/${TENANT}/quizzes/${QUIZ}/draft/items/order`);
    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body.orderedItemIds).toEqual(['a', 'b', 'c']);
  });

  it('removeItem يرسل DELETE إلى مسار العنصر', async () => {
    const calls = captureFetch({}, 200);
    const { quizzesApi } = await import('../../data/api-client/endpoints');

    await quizzesApi.removeItem(TENANT, QUIZ, 'item-7');

    expect(calls[0]!.init?.method).toBe('DELETE');
    expect(calls[0]!.url).toBe(`${BASE_URL}/api/v1/tenants/${TENANT}/quizzes/${QUIZ}/draft/items/item-7`);
  });

  it('publish يرسل POST مع baseVersion إلى مسار النشر', async () => {
    const calls = captureFetch({ publishedVersionId: 'v1', versionNumber: 1 });
    const { quizzesApi } = await import('../../data/api-client/endpoints');

    await quizzesApi.publish(TENANT, QUIZ, { baseVersion: 4 });

    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.url).toBe(`${BASE_URL}/api/v1/tenants/${TENANT}/quizzes/${QUIZ}/publish`);
    const body = JSON.parse(calls[0]!.init?.body as string);
    expect(body).toEqual({ baseVersion: 4 });
  });

  it('getVersion يبني مسار النسخة برقمها', async () => {
    const calls = captureFetch({});
    const { quizzesApi } = await import('../../data/api-client/endpoints');

    await quizzesApi.getVersion(TENANT, QUIZ, 2);

    expect(calls[0]!.url).toBe(`${BASE_URL}/api/v1/tenants/${TENANT}/quizzes/${QUIZ}/versions/2`);
    expect(calls[0]!.init?.method).toBe('GET');
  });
});

describe('publicQuizApi (نقطة عامة مجهولة)', () => {
  it('getByCode لا يرسل Authorization ولا X-Tenant-Id', async () => {
    const calls = captureFetch({ title: 'اختبار عام' });
    const { publicQuizApi } = await import('../../data/api-client/endpoints');

    await publicQuizApi.getByCode('abc-123');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${BASE_URL}/api/v1/public/quizzes/abc-123`);
    const headers = (calls[0]!.init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers['X-Tenant-Id']).toBeUndefined();
  });

  it('getByCode يشفّر publicCode في المسار', async () => {
    const calls = captureFetch({});
    const { publicQuizApi } = await import('../../data/api-client/endpoints');

    await publicQuizApi.getByCode('a/b c');

    expect(calls[0]!.url).toBe(`${BASE_URL}/api/v1/public/quizzes/${encodeURIComponent('a/b c')}`);
  });
});

describe('quiz type labels & theme invariants', () => {
  it('كل حالات الاختبار لها تسمية عربية', async () => {
    const { QUIZ_STATUS_LABELS } = await import('../../types/quizzes');
    for (const status of ['Draft', 'Published', 'Archived'] as const) {
      expect(QUIZ_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('كل أوضاع الوقت لها تسمية عربية', async () => {
    const { TIME_MODE_LABELS } = await import('../../types/quizzes');
    for (const mode of ['None', 'TotalTime', 'PerQuestion'] as const) {
      expect(TIME_MODE_LABELS[mode]).toBeTruthy();
    }
  });

  it('كل حالات النسخة لها تسمية عربية', async () => {
    const { QUIZ_VERSION_STATUS_LABELS } = await import('../../types/quizzes');
    for (const status of ['Draft', 'Published', 'Retired'] as const) {
      expect(QUIZ_VERSION_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('قوالب السمة معرّفة ولها تسميات', async () => {
    const { QUIZ_THEME_TEMPLATES, QUIZ_THEME_TEMPLATE_LABELS } = await import('../../types/quizzes');
    expect(QUIZ_THEME_TEMPLATES.length).toBeGreaterThan(0);
    for (const template of QUIZ_THEME_TEMPLATES) {
      expect(QUIZ_THEME_TEMPLATE_LABELS[template]).toBeTruthy();
    }
  });
});
