import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Ensures that navigating between pages in the SPA always resets
 * the scroll position to the very top (0, 0), eliminating the bug
 * where opened pages start scrolled in the middle or bottom.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    } catch {
      try {
        window.scrollTo(0, 0);
      } catch {
        // Ignore in test environments where jsdom does not implement scrollTo
      }
    }
  }, [pathname]);

  return null;
}
