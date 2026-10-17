import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * إعادة التمرير فوراً إلى أعلى الصفحة (0, 0) قبل رسم الشاشة على جميع المتصفحات والجوالات
 */
export function resetScrollToTopInstant(): void {
  if (typeof window === 'undefined') return;
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  } catch {
    window.scrollTo(0, 0);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const containers = document.querySelectorAll('main, [data-scroll-root]');
    containers.forEach((el) => {
      if (el instanceof HTMLElement) {
        el.scrollTop = 0;
      }
    });
  }
}

/**
 * خطاف (Hook) لإعادة التمرير إلى الأعلى عند تغير المراحل الداخلية أو الأسئلة داخل نفس الصفحة
 */
export function useStageScrollReset(...dependencies: unknown[]): void {
  useLayoutEffect(() => {
    resetScrollToTopInstant();
    const rafId = window.requestAnimationFrame(() => {
      resetScrollToTopInstant();
    });
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}

/**
 * مكون عام يضمن فتح أي مسار جديد في المنصة من البداية تماماً
 */
export function GlobalScrollReset() {
  const { pathname, search } = useLocation();

  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    resetScrollToTopInstant();
    const rafId = window.requestAnimationFrame(() => {
      resetScrollToTopInstant();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [pathname, search]);

  return null;
}
