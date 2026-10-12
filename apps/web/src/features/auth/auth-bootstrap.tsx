import { useEffect, type ReactNode } from 'react';
import { bootstrapSession } from '../../data/api-client/endpoints';
import { clearSession, getActiveTenantId } from '../../lib/auth/session';

let bootstrapped = false;
let bootstrapPromise: Promise<unknown> | null = null;

/** يضمن أن bootstrap ينفّذ مرة واحدة في التطبيق حتى مع StrictMode (ويبقى آمناً للاختبارات) */
async function ensureBootstrap(): Promise<void> {
  if (bootstrapped) return;
  if (bootstrapPromise) {
    await bootstrapPromise;
    return;
  }

  // تجنب إرسال طلب refresh لمسارات المنصة العامة لتفادي خطأ 401 في الكونسول
  const isProtectedOrAuthRoute =
    typeof window !== 'undefined' &&
    /^\/(dashboard|platform|auth|onboarding)/.test(window.location.pathname);
  const hasSavedTenant = Boolean(getActiveTenantId());

  if (!isProtectedOrAuthRoute && !hasSavedTenant) {
    clearSession();
    bootstrapped = true;
    return;
  }

  bootstrapPromise = bootstrapSession()
    .catch(() => null)
    .then(() => {
      bootstrapped = true;
      bootstrapPromise = null;
    });
  await bootstrapPromise;
}

/** مزوّد الاستعادة من الجلسة — يحاول Refresh واحدًا ثم /me عند أول Mount */
export function AuthBootstrapGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    void ensureBootstrap();
  }, []);

  // صفحات المصادقة تظهر فورًا حتى قبل انتهاء الـbootstrap
  // حارسو المسارات الداخلية يتولون التوجيه بعد اكتمال الـbootstrap
  return <>{children}</>;
}
