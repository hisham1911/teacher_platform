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
import type {
  CreatePlanRequest,
  PlatformAuditLog,
  PlatformTenant,
  PlatformUser,
  SaasPlan,
  SaasSubscription,
  TenantUsage,
  TenantTransferSummary,
} from '../../types/saas';

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

export function resolveBaseUrl(): string {
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

async function callPublicBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method: 'GET',
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new HttpError(response.status, errorBody);
  }

  return response.blob();
}

/** طلب متعدد الوسائط — لا نضبط Content-Type يدويًا: المتصفح يضعه مع boundary تلقائيًا */
async function callMultipart<T>(
  path: string,
  file: File,
  signal?: AbortSignal,
  fieldName = 'file',
): Promise<T> {
  const formData = new FormData();
  formData.append(fieldName, file);

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

// ---------- Phase 4: Sessions (Teacher) & Player (Anonymous) ----------
import type {
  AttemptResult,
  CreateSessionRequest,
  FinishAttemptResponse,
  JoinSessionRequest,
  JoinSessionResponse,
  PlayerQuestion,
  PlayerSession,
  SessionDetail,
  SessionListItem,
  SessionStateChangeRequest,
  StartAttemptResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '../../types/sessions';
import type {
  CreateStudentRequest,
  RegenerateStudentCodeRequest,
  Student,
  StudentResult,
  StudentStatusRequest,
  UpdateStudentRequest,
} from '../../types/students';
import type {
  CreateSurveyRequest,
  PlayerSurvey,
  SubmitSurveyRequest,
  SurveyDetail,
  SurveyListItem,
  SurveyResults,
  SurveySubmission,
  UpdateSurveyRequest,
} from '../../types/surveys';
import type {
  LiveControlRequest,
  LiveSessionState,
  LiveTokenResponse,
} from '../../types/live';

export interface StudentListQuery {
  search?: string;
  includeInactive?: boolean;
}

export const studentsApi = {
  list(tenantId: string, query: StudentListQuery = {}, signal?: AbortSignal) {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.includeInactive) params.set('includeInactive', 'true');
    const qs = params.toString();
    return call<Student[]>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/students${qs ? `?${qs}` : ''}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  get(tenantId: string, studentId: string, signal?: AbortSignal) {
    return call<Student>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/students/${studentId}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  create(tenantId: string, payload: CreateStudentRequest, signal?: AbortSignal) {
    return call<Student>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/students`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  update(tenantId: string, studentId: string, payload: UpdateStudentRequest, signal?: AbortSignal) {
    return call<Student>({
      method: 'PUT',
      path: `/api/v1/tenants/${tenantId}/students/${studentId}`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  setStatus(tenantId: string, studentId: string, payload: StudentStatusRequest, signal?: AbortSignal) {
    return call<Student>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/students/${studentId}/status`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  regenerateCode(tenantId: string, studentId: string, payload: RegenerateStudentCodeRequest, signal?: AbortSignal) {
    return call<Student>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/students/${studentId}/regenerate-code`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  listResults(tenantId: string, studentId: string, take = 20, signal?: AbortSignal) {
    const params = new URLSearchParams({ take: String(take) });
    return call<StudentResult[]>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/students/${studentId}/results?${params.toString()}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
};

export const sessionsApi = {
  list(tenantId: string, quizId: string, page?: number, pageSize?: number, signal?: AbortSignal) {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (pageSize) params.set('pageSize', String(pageSize));
    const qs = params.toString();
    return call<PagedResponse<SessionListItem>>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions${qs ? `?${qs}` : ''}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  create(tenantId: string, quizId: string, payload: CreateSessionRequest, signal?: AbortSignal) {
    return call<SessionDetail>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  get(tenantId: string, quizId: string, sessionId: string, signal?: AbortSignal) {
    return call<SessionDetail>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions/${sessionId}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  activate(tenantId: string, quizId: string, sessionId: string, payload: SessionStateChangeRequest, signal?: AbortSignal) {
    return call<SessionDetail>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions/${sessionId}/activate`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  finish(tenantId: string, quizId: string, sessionId: string, payload: SessionStateChangeRequest, signal?: AbortSignal) {
    return call<SessionDetail>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions/${sessionId}/finish`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  cancel(tenantId: string, quizId: string, sessionId: string, payload: SessionStateChangeRequest, signal?: AbortSignal) {
    return call<SessionDetail>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions/${sessionId}/cancel`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
};

// ---------- Phase 7: Platform administration ----------

export const platformApi = {
  listPlans(signal?: AbortSignal) {
    return call<SaasPlan[]>({
      method: 'GET', path: '/api/v1/platform/plans', signal, needsAuth: true,
    });
  },
  createPlan(payload: CreatePlanRequest, signal?: AbortSignal) {
    return call<SaasPlan>({
      method: 'POST', path: '/api/v1/platform/plans', body: payload, signal, needsAuth: true,
    });
  },
  listTenants(signal?: AbortSignal) {
    return call<PlatformTenant[]>({
      method: 'GET', path: '/api/v1/platform/tenants', signal, needsAuth: true,
    });
  },
  listUsers(signal?: AbortSignal) {
    return call<PlatformUser[]>({
      method: 'GET', path: '/api/v1/platform/users', signal, needsAuth: true,
    });
  },
  activateSubscription(tenantId: string, planId: string, signal?: AbortSignal) {
    return call<SaasSubscription>({
      method: 'POST',
      path: `/api/v1/platform/tenants/${tenantId}/subscriptions/activate`,
      body: { planId },
      signal,
      needsAuth: true,
    });
  },
  getUsage(tenantId: string, signal?: AbortSignal) {
    return call<TenantUsage>({
      method: 'GET',
      path: `/api/v1/platform/tenants/${tenantId}/usage`,
      signal,
      needsAuth: true,
    });
  },
  listAudit(signal?: AbortSignal) {
    return call<PlatformAuditLog[]>({
      method: 'GET', path: '/api/v1/platform/audit?take=50', signal, needsAuth: true,
    });
  },
};

export const tenantTransferApi = {
  exportArchive(tenantId: string, signal?: AbortSignal) {
    return callBlob(`/api/v1/tenants/${tenantId}/transfer/export`, signal);
  },
  importArchive(tenantId: string, file: File, dryRun: boolean, signal?: AbortSignal) {
    const params = new URLSearchParams({ dryRun: String(dryRun) });
    return callMultipart<TenantTransferSummary>(
      `/api/v1/tenants/${tenantId}/transfer/import?${params.toString()}`,
      file,
      signal,
      'archive',
    );
  },
};

export const liveApi = {
  getState(tenantId: string, quizId: string, sessionId: string, signal?: AbortSignal) {
    return call<LiveSessionState>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions/${sessionId}/live`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  getTeacherToken(tenantId: string, quizId: string, sessionId: string) {
    return call<LiveTokenResponse>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions/${sessionId}/live/token`,
      needsAuth: true,
      needsTenant: true,
    });
  },
  openNext(tenantId: string, quizId: string, sessionId: string, payload: LiveControlRequest) {
    return call<LiveSessionState>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions/${sessionId}/live/questions/open-next`,
      body: payload,
      needsAuth: true,
      needsTenant: true,
    });
  },
  closeQuestion(tenantId: string, quizId: string, sessionId: string, payload: LiveControlRequest) {
    return call<LiveSessionState>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions/${sessionId}/live/questions/close`,
      body: payload,
      needsAuth: true,
      needsTenant: true,
    });
  },
  finish(tenantId: string, quizId: string, sessionId: string, payload: LiveControlRequest) {
    return call<LiveSessionState>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/quizzes/${quizId}/sessions/${sessionId}/live/finish`,
      body: payload,
      needsAuth: true,
      needsTenant: true,
    });
  },
};

/**
 * Player API — مجهول تمامًا. لا Authorization ولا X-Tenant-Id.
 * الـGuest Token يعيش في HttpOnly Cookie ويُرسل تلقائيًا عبر credentials:'include'.
 */
export const playerApi = {
  getSession(joinCode: string, signal?: AbortSignal) {
    return call<PlayerSession>({
      method: 'GET',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}`,
      signal,
    });
  },
  /** استعادة اللاعب من الكوكي فقط (بدون localStorage) — يعيد participantId+displayName+attemptState. */
  getCurrentPlayer(joinCode: string, signal?: AbortSignal) {
    return call<JoinSessionResponse>({
      method: 'GET',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/me`,
      signal,
    });
  },
  getLiveState(joinCode: string, signal?: AbortSignal) {
    return call<LiveSessionState>({
      method: 'GET',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/live`,
      signal,
    });
  },
  getLiveToken(joinCode: string) {
    return call<LiveTokenResponse>({
      method: 'POST',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/live/token`,
    });
  },
  join(joinCode: string, payload: JoinSessionRequest, signal?: AbortSignal) {
    return call<JoinSessionResponse>({
      method: 'POST',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/join`,
      body: payload,
      signal,
    });
  },
  joinWithStudentCode(joinCode: string, studentCode: string, signal?: AbortSignal) {
    return call<JoinSessionResponse>({
      method: 'POST',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/student-join`,
      body: { studentCode },
      signal,
    });
  },
  startAttempt(joinCode: string, signal?: AbortSignal) {
    return call<StartAttemptResponse>({
      method: 'POST',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/attempts`,
      signal,
    });
  },
  getCurrentQuestion(joinCode: string, attemptId: string, signal?: AbortSignal) {
    return call<PlayerQuestion>({
      method: 'GET',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/attempts/${attemptId}/current-question`,
      signal,
    });
  },
  submitAnswer(joinCode: string, attemptId: string, payload: SubmitAnswerRequest, signal?: AbortSignal) {
    return call<SubmitAnswerResponse>({
      method: 'POST',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/attempts/${attemptId}/answers`,
      body: payload,
      signal,
    });
  },
  finish(joinCode: string, attemptId: string, signal?: AbortSignal) {
    return call<FinishAttemptResponse>({
      method: 'POST',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/attempts/${attemptId}/finish`,
      signal,
    });
  },
  getResult(joinCode: string, attemptId: string, signal?: AbortSignal) {
    return call<AttemptResult>({
      method: 'GET',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/attempts/${attemptId}/result`,
      signal,
    });
  },
  getSurvey(joinCode: string, attemptId: string, signal?: AbortSignal) {
    return call<PlayerSurvey>({
      method: 'GET',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/attempts/${attemptId}/survey`,
      signal,
    });
  },
  submitSurvey(
    joinCode: string,
    attemptId: string,
    payload: SubmitSurveyRequest,
    signal?: AbortSignal,
  ) {
    return call<SurveySubmission>({
      method: 'POST',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/attempts/${attemptId}/survey`,
      body: payload,
      signal,
    });
  },
  issueCertificate(joinCode: string, attemptId: string, signal?: AbortSignal) {
    return call<PlayerCertificate>({
      method: 'POST',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/attempts/${attemptId}/certificate`,
      signal,
    });
  },
  createParentShare(joinCode: string, attemptId: string, signal?: AbortSignal) {
    return call<ParentShare>({
      method: 'POST',
      path: `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/attempts/${attemptId}/parent-share`,
      signal,
    });
  },
  certificateDownloadUrl(joinCode: string, attemptId: string): string {
    return `${resolveBaseUrl()}/api/v1/player/sessions/${encodeURIComponent(joinCode)}/attempts/${attemptId}/certificate/file`;
  },
  /** URL مباشر لوسائط السؤال — الـGuest Cookie يُرسل تلقائيًا من المتصفح (لا Bearer). */
  mediaUrl(joinCode: string, attemptId: string, mediaId: string): string {
    return `${resolveBaseUrl()}/api/v1/player/sessions/${encodeURIComponent(joinCode)}/attempts/${attemptId}/media/${mediaId}`;
  },
};

// ---------- Phase 5: Reports ----------
import type {
  AttemptDetail,
  ReportAttemptListItem,
  SessionReport,
} from '../../types/reports';
import type {
  CertificateListItem,
  CertificateTemplate,
  ParentShare,
  PlayerCertificate,
  PublicResult,
  SaveCertificateTemplateRequest,
} from '../../types/certificates';

export const reportsApi = {
  getSessionReport(tenantId: string, sessionId: string, signal?: AbortSignal) {
    return call<SessionReport>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/sessions/${sessionId}/report`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  listAttempts(
    tenantId: string,
    sessionId: string,
    page = 1,
    pageSize = 20,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return call<PagedResponse<ReportAttemptListItem>>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/sessions/${sessionId}/attempts?${params.toString()}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  getAttempt(tenantId: string, attemptId: string, signal?: AbortSignal) {
    return call<AttemptDetail>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/attempts/${attemptId}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  exportSessionCsv(tenantId: string, sessionId: string, signal?: AbortSignal) {
    return callBlob(`/api/v1/tenants/${tenantId}/sessions/${sessionId}/report/export.csv`, signal);
  },
};

export const surveysApi = {
  list(tenantId: string, quizId?: string, signal?: AbortSignal) {
    const params = quizId ? `?${new URLSearchParams({ quizId }).toString()}` : '';
    return call<SurveyListItem[]>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/surveys${params}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  get(tenantId: string, surveyId: string, signal?: AbortSignal) {
    return call<SurveyDetail>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/surveys/${surveyId}`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  getResults(tenantId: string, surveyId: string, signal?: AbortSignal) {
    return call<SurveyResults>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/surveys/${surveyId}/results`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  create(tenantId: string, payload: CreateSurveyRequest, signal?: AbortSignal) {
    return call<SurveyDetail>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/surveys`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  update(
    tenantId: string,
    surveyId: string,
    payload: UpdateSurveyRequest,
    signal?: AbortSignal,
  ) {
    return call<SurveyDetail>({
      method: 'PUT',
      path: `/api/v1/tenants/${tenantId}/surveys/${surveyId}`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  publish(tenantId: string, surveyId: string, baseVersion: number, signal?: AbortSignal) {
    return call<SurveyDetail>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/surveys/${surveyId}/publish`,
      body: { baseVersion },
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
};

export const certificateTemplatesApi = {
  list(tenantId: string, signal?: AbortSignal) {
    return call<CertificateTemplate[]>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/certificate-templates`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  create(tenantId: string, payload: SaveCertificateTemplateRequest, signal?: AbortSignal) {
    return call<CertificateTemplate>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/certificate-templates`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  update(
    tenantId: string,
    templateId: string,
    payload: SaveCertificateTemplateRequest,
    signal?: AbortSignal,
  ) {
    return call<CertificateTemplate>({
      method: 'PUT',
      path: `/api/v1/tenants/${tenantId}/certificate-templates/${templateId}`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
};

export const certificatesApi = {
  list(tenantId: string, signal?: AbortSignal) {
    return call<CertificateListItem[]>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/certificates`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  retry(tenantId: string, certificateId: string, signal?: AbortSignal) {
    return call<CertificateListItem>({
      method: 'POST',
      path: `/api/v1/tenants/${tenantId}/certificates/${certificateId}/retry`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  download(tenantId: string, certificateId: string, signal?: AbortSignal) {
    return callBlob(`/api/v1/tenants/${tenantId}/certificates/${certificateId}/file`, signal);
  },
};

export const publicResultsApi = {
  get(publicToken: string, signal?: AbortSignal) {
    return call<PublicResult>({
      method: 'GET',
      path: `/api/v1/public/results/${encodeURIComponent(publicToken)}`,
      signal,
    });
  },
  certificateUrl(publicToken: string): string {
    return `${resolveBaseUrl()}/api/v1/player/certificates/${encodeURIComponent(publicToken)}`;
  },
  fetchCertificate(publicToken: string, signal?: AbortSignal) {
    return callPublicBlob(
      `/api/v1/player/certificates/${encodeURIComponent(publicToken)}`,
      signal,
    );
  },
};
