import type { AuthUser, Workspace } from '../../types/auth';

/**
 * Session Layer نمط Memory-Only:
 * - Access Token يُحفظ في المُتغيّر الداخلي فقط.
 * - لا localStorage / sessionStorage لأي Tokens — فقط activeTenantId مسموح فيه لأنه غير سرّي.
 * - Refresh Token يعيش في HttpOnly Cookie لا يستطيع JavaScript قراءتها.
 *
 * Single-flight: connectRefresh يضمن أن مجموعة من المتزامنين يشتركون في نفس Promise.
 */

const ACTIVE_TENANT_KEY = 'teacher-platform:active-tenant-id';

export interface SessionSnapshot {
  accessToken: string | null;
  accessTokenExpiresAtMs: number | null;
  user: AuthUser | null;
  activeWorkspace: Workspace | null;
}

interface SessionState {
  accessToken: string | null;
  accessTokenExpiresAtMs: number | null;
  user: AuthUser | null;
  activeWorkspace: Workspace | null;
  /** Promise نشطة للتدوير — أي Concat جديد ينتظرها */
  refreshPromise: Promise<SessionSnapshot> | null;
  listeners: Set<() => void>;
}

const state: SessionState = {
  accessToken: null,
  accessTokenExpiresAtMs: null,
  user: null,
  activeWorkspace: null,
  refreshPromise: null,
  listeners: new Set(),
};

// التخزين المؤقت للـsnapshot — يتغير المرجع فقط عند تغيير القيم فعليًا
// حتى لا يندفع useSyncExternalStore في حلقة لا نهائية.
let cachedSnapshot: SessionSnapshot = toSnapshot(state);

function toSnapshot(s: SessionState): SessionSnapshot {
  return {
    accessToken: s.accessToken,
    accessTokenExpiresAtMs: s.accessTokenExpiresAtMs,
    user: s.user,
    activeWorkspace: s.activeWorkspace,
  };
}

function refreshSnapshotCache(): void {
  cachedSnapshot = toSnapshot(state);
}

function notify(): void {
  refreshSnapshotCache();
  for (const listener of state.listeners) {
    listener();
  }
}

/** يقرأ الحاليّة بصورة متكاملة — لا يوجد رؤية جزئية للمستخدم. مرجع ثابت ما لم تتغير القيم. */
export function getSessionSnapshot(): SessionSnapshot {
  return cachedSnapshot;
}

export function subscribeToSession(listener: () => void): () => void {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

/** يضبط الجلسة بعد Login/Refresh — تكتمل في ذرّة واحدة */
export function establishSession(snapshot: SessionSnapshot): void {
  state.accessToken = snapshot.accessToken;
  state.accessTokenExpiresAtMs = snapshot.accessTokenExpiresAtMs;
  state.user = snapshot.user;
  state.activeWorkspace = snapshot.activeWorkspace;
  if (snapshot.activeWorkspace) {
    persistActiveTenantId(snapshot.activeWorkspace.id);
  }
  notify();
}

/** يمسح كل شيء من الذاكرة — Logout/Fresh-boot Refresh فشل */
export function clearSession(): void {
  state.accessToken = null;
  state.accessTokenExpiresAtMs = null;
  state.user = null;
  state.activeWorkspace = null;
  persistActiveTenantId(null);
  notify();
}

/** يحدّث الـWorkspace المفعّلة فقط — دون تبديل Tokens */
export function setActiveWorkspaceId(workspaceId: string | null): void {
  if (state.user === null) return;
  persistActiveTenantId(workspaceId);
}

/** قراءة آمنة لـactiveTenantId من Local Storage (غير سرّي) */
export function getActiveTenantId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_TENANT_KEY);
  } catch {
    return null;
  }
}

function persistActiveTenantId(value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(ACTIVE_TENANT_KEY);
    } else {
      window.localStorage.setItem(ACTIVE_TENANT_KEY, value);
    }
  } catch {
    // قد تكون Storage unavailable (private mode) — لا نكسر التطبيق
  }
}

/**
 * يبدأ أو ينضمّ لعملية Refresh جارية. ممنوع إنشاء أكثر من Promise في نفس اللحظة.
 * عند فشل Refresh: يمسح الجلسة ويعيد الخطأ ليتحول المستخدم إلى Login.
 */
export async function singleFlightRefresh(
  refreshFn: () => Promise<SessionSnapshot>,
): Promise<SessionSnapshot> {
  if (state.refreshPromise) {
    return state.refreshPromise;
  }

  const refreshPromise = (async () => {
    try {
      const result = await refreshFn();
      establishSession(result);
      return result;
    } catch (error) {
      clearSession();
      throw error;
    } finally {
      state.refreshPromise = null;
    }
  })();

  state.refreshPromise = refreshPromise;
  return refreshPromise;
}
