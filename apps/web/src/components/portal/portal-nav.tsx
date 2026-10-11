import { useState } from 'react';
import { Link, useLocation } from 'react-router';

const navLinks = [
  { path: '/grammar', label: 'القواعد', icon: '📖' },
  { path: '/reading', label: 'القراءة', icon: '👓' },
  { path: '/listening', label: 'الاستماع', icon: '🎧' },
  { path: '/writing', label: 'الكتابة', icon: '✍️' },
  { path: '/speaking', label: 'المحادثة', icon: '🎙️' },
  { path: '/competitions', label: 'المسابقات', icon: '🏆' },
  { path: '/guestbook', label: 'سجل الزوار', icon: '💬' },
] as const;

export function PortalNav() {
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav
      className="portal-nav sticky top-0 z-40 border-b border-violet-100/60 bg-white/85 backdrop-blur-xl shadow-[0_2px_15px_-3px_rgba(124,58,237,0.06)]"
      dir="rtl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Brand */}
        <Link
          to="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
        >
          <span
            aria-hidden="true"
            className="spark-brand-mark flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-base font-black text-white shadow-sm transition-transform duration-300 group-hover:scale-105"
          >
            ✦
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-wide text-slate-950 sm:text-base">
              English Spark
            </span>
            <span className="hidden text-[10px] font-bold text-violet-600 sm:block">
              نادي اللغة الإنجليزية
            </span>
          </div>
        </Link>

        {/* Desktop Section Links */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.path ||
              pathname.startsWith(link.path + '/') ||
              (link.path === '/competitions' && pathname.startsWith('/challenge'));
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`relative rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-violet-50 text-violet-800 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="ml-1 opacity-80">{link.icon}</span>
                {link.label}
                {isActive && (
                  <span className="absolute inset-x-2 -bottom-2.5 h-0.5 rounded-full bg-violet-600" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Actions & Badge */}
        <div className="flex items-center gap-2.5">
          {/* Official badge (Desktop) */}
          <span className="hidden shrink-0 rounded-xl border border-violet-100 bg-violet-50/80 px-3.5 py-1.5 text-xs font-black text-violet-800 md:inline-block">
            إنتاج معرفي
            <span className="mr-1.5 font-bold text-violet-500">| وزارة التعليم</span>
          </span>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 lg:hidden"
          >
            {mobileMenuOpen ? (
              <span className="text-lg leading-none font-black">✕</span>
            ) : (
              <span className="text-xl leading-none">☰</span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Pill Scroll (Always fast-accessible) */}
      <div className="lg:hidden border-t border-slate-100 bg-slate-50/70 px-2 py-1.5 overflow-x-auto scrollbar-none flex items-center gap-1.5">
        {navLinks.map((link) => {
          const isActive =
            pathname === link.path ||
            pathname.startsWith(link.path + '/') ||
            (link.path === '/competitions' && pathname.startsWith('/challenge'));
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                isActive
                  ? 'bg-violet-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-violet-100 bg-white/98 p-4 shadow-xl backdrop-blur-2xl animate-page-enter">
          <div className="space-y-3">
            <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-3 text-center">
              <p className="text-xs font-black text-violet-900">مبادرة إنتاج معرفي • وزارة التعليم</p>
              <p className="mt-0.5 text-[11px] font-semibold text-violet-600">مدرسة متوسطة وثانوية الجرادية</p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                  pathname === '/'
                    ? 'bg-violet-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-violet-50'
                }`}
              >
                <span className="text-base">🏠</span>
                <span>الرئيسية</span>
              </Link>
              {navLinks.map((link) => {
                const isActive =
                  pathname === link.path ||
                  pathname.startsWith(link.path + '/') ||
                  (link.path === '/competitions' && pathname.startsWith('/challenge'));
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-violet-700 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-violet-50'
                    }`}
                  >
                    <span className="text-base">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>English Spark • مساحة التعلم</span>
              <div className="flex gap-3 font-semibold">
                <Link to="/privacy" onClick={() => setMobileMenuOpen(false)} className="hover:text-violet-700">الخصوصية</Link>
                <Link to="/terms" onClick={() => setMobileMenuOpen(false)} className="hover:text-violet-700">الشروط</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

/**
 * Shell wrapper for portal pages. Provides:
 * - PortalNav (clean sticky navigation with mobile drawer)
 * - PortalFooter (unified footer)
 */
export function PortalShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/40" dir="rtl">
      <PortalNav />
      <div className={`relative z-10 mx-auto w-full flex-1 px-4 pb-16 pt-6 sm:px-6 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {children}
      </div>
      <PortalFooter />
    </div>
  );
}

export function PortalFooter() {
  return (
    <footer className="relative z-10 border-t border-violet-100/70 bg-white/90 py-10 backdrop-blur-md" dir="rtl">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
        <div className="flex items-center gap-3 text-center sm:text-right">
          <Link
            to="/"
            className="spark-brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-sm font-black text-white shadow-sm"
          >
            ✦
          </Link>
          <div>
            <p className="text-sm font-black text-slate-900">English Spark — نادي اللغة الإنجليزية</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              مبادرة إنتاج معرفي — وزارة التعليم • مدرسة متوسطة وثانوية الجرادية
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 text-xs font-bold text-slate-600" aria-label="روابط سريعة">
          <Link to="/" className="hover:text-violet-700 transition-colors">الرئيسية</Link>
          <Link to="/grammar" className="hover:text-violet-700 transition-colors">القواعد</Link>
          <Link to="/reading" className="hover:text-violet-700 transition-colors">القراءة</Link>
          <Link to="/listening" className="hover:text-violet-700 transition-colors">الاستماع</Link>
          <Link to="/writing" className="hover:text-violet-700 transition-colors">الكتابة</Link>
          <Link to="/speaking" className="hover:text-violet-700 transition-colors">المحادثة</Link>
          <Link to="/competitions" className="hover:text-violet-700 transition-colors">المسابقات</Link>
          <Link to="/guestbook" className="hover:text-violet-700 transition-colors">سجل الزوار</Link>
          <span className="text-slate-300" aria-hidden="true">•</span>
          <Link to="/privacy" className="text-slate-500 hover:text-violet-700 transition-colors">الخصوصية</Link>
          <Link to="/terms" className="text-slate-500 hover:text-violet-700 transition-colors">الشروط</Link>
        </nav>
      </div>
    </footer>
  );
}
