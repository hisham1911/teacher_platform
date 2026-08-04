import { HttpError } from './http-error';
import type {
  AuthUser,
  MessageResponse,
  SessionResponse,
  TenantDetail,
  TenantSettings,
} from '../../types/auth';
import {
  clearSession,
  establishSession,
  getActiveTenantId,
  getSessionSnapshot,
  singleFlightRefresh,
  type SessionSnapshot,
} from '../../lib/auth/session';

/**
 * نقطة الوصول الوحيدة للـAPI لمصادقة Workspace.
 * Access Token يأتي من session.ts (الذاكرة). Refresh Token يعيش في HttpOnly Cookie —
 * لا يقرأه JavaScript، يُرسل تلقائيًا لأن fetch يستخدم credentials:'include' هنا.
 */

function authHeader(): Record<string, string> {
  const { accessToken } = getSessionSnapshot();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function tenantHeader(): Record<string, string> {
  const tenantId = getActiveTenantId();
  return tenantId ? { 'X-Tenant-Id': tenantId } : {};
}

function resolveBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not set. الاتصال بالـAPI غير ممكن بدونها.');
  }
  return baseUrl.replace(/\/+$/, '');
}

interface CallOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  signal?: AbortSignal;
  /** طلبات المصادقة (login/refresh) لا تحتاج Authorization header ولا Tenant */
  needsAuth?: boolean;
  needsTenant?: boolean;
  /** علامة داخلية لمنع Infinite Loop: لا نعيد الطلب إذا كان هذا هو الطلب المعاد بعد Refresh */
  retriedAfterRefresh?: boolean;
}

/** طلب ملف ثنائي 🡒 Blob — يُستخدم لوسائط المعاينة لأن <img>/<audio> لا ترسل Authorization */
async function callBlob(path: string, signal?: AbortSignal, retriedAfterRefresh = false): Promise<Blob> {
  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method: 'GET',
    credentials: 'include',
    signal,
    headers: {
      ...authHeader(),
      ...tenantHeader(),
    },
  });

  if (response.status === 401 && !retriedAfterRefresh) {
    await performSingleFlightRefresh(signal);
    return callBlob(path, signal, true);
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new HttpError(response.status, errorBody);
  }

  return response.blob();
}

/** طلب متعدد الوسائط — لا نضبط Content-Type يدويًا: المتصفح يضعه مع boundary تلقائيًا */
async function callMultipart<T>(path: string, file: File, signal?: AbortSignal): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: {
      Accept: 'application/json',
      ...authHeader(),
      ...tenantHeader(),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new HttpError(response.status, errorBody);
  }

  return (await response.json()) as T;
}

/** ينفّذ الطلب ويعيد النافذة المنظمة. عند 401 يحاول Refresh مرة واحدة ثم يعيد الطلب مرة واحدة فقط. */
async function call<T>(options: CallOptions): Promise<T> {
  const {
    method,
    path,
    body,
    signal,
    needsAuth = false,
    needsTenant = false,
    retriedAfterRefresh = false,
  } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(needsAuth ? authHeader() : {}),
    ...(needsTenant ? tenantHeader() : {}),
  };

  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method,
    credentials: 'include',
    signal,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && needsAuth && !retriedAfterRefresh) {
    // 401 — جرّب Refresh مرة واحدة ثم أعد الطلب الأصلي مرة واحدة فقط
    try {
      await performSingleFlightRefresh(signal);
    } catch {
      // فشل Refresh → امسح الجلسة وأعد رمي 401
      throw new HttpError(401, null);
    }
    return call<T>({ ...options, retriedAfterRefresh: true });
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new HttpError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function performSingleFlightRefresh(signal?: AbortSignal): Promise<SessionSnapshot> {
  return singleFlightRefresh(async () => {
    const response = await fetch(`${resolveBaseUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new HttpError(response.status, null);
    }

    const data = (await response.json()) as SessionResponse;
    return {
      status: 'authenticated',
      accessToken: data.accessToken,
      accessTokenExpiresAtMs: Date.parse(data.accessTokenExpiresAt),
      user: data.user,
      activeWorkspace: data.activeWorkspace,
    };
  });
}

// ---------- Auth endpoints ----------

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ConfirmEmailPayload {
  uid: string;
  token: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  uid: string;
  token: string;
  newPassword: string;
}

export const authApi = {
  register(payload: RegisterPayload, signal?: AbortSignal) {
    return call<MessageResponse>({ method: 'POST', path: '/api/v1/auth/register', body: payload, signal });
  },
  confirmEmail(payload: ConfirmEmailPayload, signal?: AbortSignal) {
    return call<MessageResponse>({ method: 'POST', path: '/api/v1/auth/confirm-email', body: payload, signal });
  },
  async login(payload: LoginPayload, signal?: AbortSignal) {
    const data = await call<SessionResponse>({
      method: 'POST',
      path: '/api/v1/auth/login',
      body: payload,
      signal,
    });
    establishSession({
      accessToken: data.accessToken,
      accessTokenExpiresAtMs: Date.parse(data.accessTokenExpiresAt),
      user: data.user,
      activeWorkspace: data.activeWorkspace,
    });
    return data;
  },
  async logout(signal?: AbortSignal) {
    try {
      await call<MessageResponse>({ method: 'POST', path: '/api/v1/auth/logout', signal });
    } finally {
      clearSession();
    }
  },
  forgotPassword(payload: ForgotPasswordPayload, signal?: AbortSignal) {
    return call<MessageResponse>({
      method: 'POST',
      path: '/api/v1/auth/forgot-password',
      body: payload,
      signal,
    });
  },
  resetPassword(payload: ResetPasswordPayload, signal?: AbortSignal) {
    return call<MessageResponse>({
      method: 'POST',
      path: '/api/v1/auth/reset-password',
      body: payload,
      signal,
    });
  },
  /** يستدعي /api/v1/auth/me — يعيد access token جديد non-empty عند عدم وجود Refresh Cookie */
  me(signal?: AbortSignal) {
    return call<SessionResponse>({ method: 'GET', path: '/api/v1/auth/me', signal, needsAuth: true });
  },
};

// ---------- Tenants endpoints ----------

export interface CreateWorkspacePayload {
  name: string;
  slug: string;
  countryCode: string;
  timezone: string;
  defaultLocale: string;
}

export interface UpdateWorkspacePayload {
  name: string;
  slug: string;
}

export interface UpdateSettingsPayload {
  publicTeacherName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export const tenantsApi = {
  listMine(signal?: AbortSignal) {
    return call<TenantDetail[]>({ method: 'GET', path: '/api/v1/tenants/mine', signal, needsAuth: true });
  },
  create(payload: CreateWorkspacePayload, signal?: AbortSignal) {
    return call<TenantDetail>({ method: 'POST', path: '/api/v1/tenants', body: payload, signal, needsAuth: true });
  },
  getSettings(tenantId: string, signal?: AbortSignal) {
    return call<TenantSettings>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/settings`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  updateSettings(tenantId: string, payload: UpdateSettingsPayload, signal?: AbortSignal) {
    return call<TenantSettings>({
      method: 'PATCH',
      path: `/api/v1/tenants/${tenantId}/settings`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
};

// ---------- Phase 2: Question Banks / Tags / Questions / Media ----------
import type {
  QuestionBank,
  QuestionDetail,
  QuestionListItem,
  QuestionTag,
  QuestionVersion,
  QuestionVersionSummary,
  PagedResponse,
  CreateQuestionRequest,
  CreateQuestionVersionRequest,
  MediaAsset,
} from '../../types/questions';

export const questionBanksApi = {
  list(tenantId: string, signal?: AbortSignal) {
    return call<QuestionBank[]>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/question-banks`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  create(tenantId: string, payload: { name: string; description?: string }, signal?: AbortSignal) {
    return call<QuestionBank>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/question-banks`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  update(tenantId: string, bankId: string, payload: { name: string; description?: string }, signal?: AbortSignal) {
    return call<void>({
      method: 'PATCH',
      path: `/api/v1/tenants/${tenantId}/question-banks/${bankId}`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
};

export const questionTagsApi = {
  list(tenantId: string, signal?: AbortSignal) {
    return call<QuestionTag[]>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/question-tags`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
};

export interface QuestionListQuery {
  bankId?: string;
  type?: string;
  difficulty?: string;
  tag?: string;
  search?: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}

export const questionsApi = {
  list(tenantId: string, query: QuestionListQuery, signal?: AbortSignal) {
    const params = new URLSearchParams();
    if (query.bankId) params.set('bankId', query.bankId);
    if (query.type) params.set('type', query.type);
    if (query.difficulty) params.set('difficulty', query.difficulty);
    if (query.tag) params.set('tag', query.tag);
    if (query.search) params.set('search', query.search);
    if (query.includeArchived) params.set('includeArchived', 'true');
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));

    const qs = params.toString();
    return call<PagedResponse<QuestionListItem>>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/questions${qs ? `?${qs}` : ''}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  get(tenantId: string, questionId: string, signal?: AbortSignal) {
    return call<QuestionDetail>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/questions/${questionId}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  create(tenantId: string, payload: CreateQuestionRequest, signal?: AbortSignal) {
    return call<QuestionDetail>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/questions`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  createNewVersion(tenantId: string, questionId: string, payload: CreateQuestionVersionRequest, signal?: AbortSignal) {
    return call<QuestionDetail>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/questions/${questionId}/versions`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  listVersions(tenantId: string, questionId: string, signal?: AbortSignal) {
    return call<QuestionVersionSummary[]>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/questions/${questionId}/versions`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  getVersion(tenantId: string, questionId: string, versionNumber: number, signal?: AbortSignal) {
    return call<QuestionVersion>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/questions/${questionId}/versions/${versionNumber}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  archive(tenantId: string, questionId: string, signal?: AbortSignal) {
    return call<void>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/questions/${questionId}/archive`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
};

export const mediaApi = {
  upload(tenantId: string, file: File, signal?: AbortSignal) {
    return callMultipart<MediaAsset>(`/api/v1/tenants/${tenantId}/media`, file, signal);
  },
  get(tenantId: string, mediaId: string, signal?: AbortSignal) {
    return call<MediaAsset>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/media/${mediaId}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  /** محتوى الوسيط كـBlob — لفتحه عبر URL.createObjectURL بعد مصادقة Bearer */
  fetchContentBlob(tenantId: string, mediaId: string, signal?: AbortSignal) {
    return callBlob(`/api/v1/tenants/${tenantId}/media/${mediaId}/content`, signal);
  },
};

/** Boot-after-Reload: يستدعي Refresh مرة واحدة (single-flight) ثم يجلب /auth/me */
export async function bootstrapSession(): Promise<AuthUser | null> {
  try {
    await performSingleFlightRefresh();
  } catch {
    return null;
  }

  try {
    const meData = await authApi.me();
    // لا نفقد accessToken الجديد الذي أعاده الـRefresh
    const current = getSessionSnapshot();
    establishSession({
      accessToken: current.accessToken,
      accessTokenExpiresAtMs: current.accessTokenExpiresAtMs,
      user: meData.user,
      activeWorkspace: meData.activeWorkspace,
    });
    return meData.user;
  } catch {
    return null;
  }
}

// ---------- Phase 3: Quizzes (Builder & Publishing) ----------
import type {
  AddQuizItemRequest,
  CreateQuizRequest,
  PublishQuizRequest,
  PublishQuizResponse,
  PublicQuizPage,
  QuizDetail,
  QuizDraft,
  QuizListItem,
  QuizPublishedVersion,
  QuizShare,
  QuizVersionSummary,
  ReorderItemsRequest,
  UpdateDraftRequest,
  UpdateQuizItemRequest,
  UpdateQuizRequest,
  UseLatestItemVersionRequest,
} from '../../types/quizzes';

export interface QuizListQuery {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const quizzesApi = {
  list(tenantId: string, query: QuizListQuery, signal?: AbortSignal) {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.search) params.set('search', query.search);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));

    const qs = params.toString();
    return call<PagedResponse<QuizListItem>>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/quizzes${qs ? `?${qs}` : ''}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  create(tenantId: string, payload: CreateQuizRequest, signal?: AbortSignal) {
    return call<QuizDetail>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  get(tenantId: string, quizId: string, signal?: AbortSignal) {
    return call<QuizDetail>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  update(tenantId: string, quizId: string, payload: UpdateQuizRequest, signal?: AbortSignal) {
    return call<QuizDetail>({
      method: 'PATCH',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  archive(tenantId: string, quizId: string, signal?: AbortSignal) {
    return call<void>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/archive`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  getDraft(tenantId: string, quizId: string, signal?: AbortSignal) {
    return call<QuizDraft>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/draft`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  updateDraft(tenantId: string, quizId: string, payload: UpdateDraftRequest, signal?: AbortSignal) {
    return call<QuizDraft>({
      method: 'PUT',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/draft`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  addItem(tenantId: string, quizId: string, payload: AddQuizItemRequest, signal?: AbortSignal) {
    return call<QuizDraft>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/draft/items`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  updateItem(tenantId: string, quizId: string, itemId: string, payload: UpdateQuizItemRequest, signal?: AbortSignal) {
    return call<QuizDraft>({
      method: 'PATCH',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/draft/items/${itemId}`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  removeItem(tenantId: string, quizId: string, itemId: string, signal?: AbortSignal) {
    return call<QuizDraft>({
      method: 'DELETE',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/draft/items/${itemId}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  reorderItems(tenantId: string, quizId: string, payload: ReorderItemsRequest, signal?: AbortSignal) {
    return call<QuizDraft>({
      method: 'PUT',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/draft/items/order`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  useLatestItemVersion(tenantId: string, quizId: string, itemId: string, payload: UseLatestItemVersionRequest, signal?: AbortSignal) {
    return call<QuizDraft>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/draft/items/${itemId}/use-latest-version`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  getPreview(tenantId: string, quizId: string, signal?: AbortSignal) {
    return call<QuizDraft>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/preview`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  listVersions(tenantId: string, quizId: string, signal?: AbortSignal) {
    return call<QuizVersionSummary[]>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/versions`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  getVersion(tenantId: string, quizId: string, versionNumber: number, signal?: AbortSignal) {
    return call<QuizPublishedVersion>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/versions/${versionNumber}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  publish(tenantId: string, quizId: string, payload: PublishQuizRequest, signal?: AbortSignal) {
    return call<PublishQuizResponse>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/publish`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  getShare(tenantId: string, quizId: string, signal?: AbortSignal) {
    return call<QuizShare>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/share`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
};

/** نقطة عامة مجهولة — لا تحتاج مصادقة ولا Tenant. */
export const publicQuizApi = {
  getByCode(publicCode: string, signal?: AbortSignal) {
    return call<PublicQuizPage>({
      method: 'GET',
      path: `/api/v1/public/quizzes/${encodeURIComponent(publicCode)}`,
      signal,
    });
  },
};
