import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router';
import {
  Menu,
  X,
  BookOpen,
  BookText,
  Headphones,
  PenLine,
  Mic,
  Trophy,
  MessageSquareHeart,
  Home,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { EnglishSparkLogo } from './english-spark-logo';
import { SaudiEmblemIcon } from './saudi-emblem-icon';

export { SaudiEmblemIcon };

interface NavItem {
  path: string;
  label: string;
  labelEn: string;
  id: string;
  Icon: ComponentType<{ className?: string }>;
  color: string;
}

const navLinks: NavItem[] = [
  {
    path: '/national-journey',
    label: 'وطن وقيادة',
    labelEn: 'National Journey',
    id: 'national-journey',
    Icon: SaudiEmblemIcon,
    color: 'from-emerald-600 to-teal-700',
  },
  {
    path: '/grammar',
    label: 'القواعد',
    labelEn: 'Grammar',
    id: 'grammar',
    Icon: BookOpen,
    color: 'from-violet-600 to-indigo-700',
  },
  {
    path: '/reading',
    label: 'القراءة',
    labelEn: 'Reading',
    id: 'reading',
    Icon: BookText,
    color: 'from-sky-500 to-blue-600',
  },
  {
    path: '/listening',
    label: 'الاستماع',
    labelEn: 'Listening',
    id: 'listening',
    Icon: Headphones,
    color: 'from-purple-600 to-pink-600',
  },
  {
    path: '/writing',
    label: 'الكتابة',
    labelEn: 'Writing',
    id: 'writing',
    Icon: PenLine,
    color: 'from-emerald-600 to-teal-700',
  },
  {
    path: '/speaking',
    label: 'المحادثة',
    labelEn: 'Speaking',
    id: 'speaking',
    Icon: Mic,
    color: 'from-amber-500 to-orange-600',
  },
  {
    path: '/competitions',
    label: 'المسابقات',
    labelEn: 'Competitions',
    id: 'competitions',
    Icon: Trophy,
    color: 'from-amber-500 to-yellow-600',
  },
  {
    path: '/guestbook',
    label: 'سجل الزوار',
    labelEn: 'Guestbook',
    id: 'guestbook',
    Icon: MessageSquareHeart,
    color: 'from-rose-500 to-fuchsia-600',
  },
];

export function PortalNav({ variant = 'light' }: { variant?: 'light' | 'dark' } = {}) {
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDark = variant === 'dark';

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 4) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const absScroll = Math.abs(scrollLeft);
    setCanScrollRight(absScroll > 6);
    setCanScrollLeft(absScroll < maxScroll - 6);
  }, []);

  useEffect(() => {
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);
    const t = setTimeout(checkScroll, 120);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(t);
    };
  }, [checkScroll]);

  useEffect(() => {
    checkScroll();
  }, [pathname, checkScroll]);

  const scrollLeftDirection = () => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollBy({ left: -180, behavior: 'smooth' });
  };

  const scrollRightDirection = () => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollBy({ left: 180, behavior: 'smooth' });
  };

  return (
    <nav
      className={`portal-nav sticky top-0 z-50 isolate transform-gpu border-b backdrop-blur-xl transition-colors duration-200 ${
        isDark
          ? 'border-white/10 bg-slate-950/98 text-white shadow-md'
          : 'border-violet-100/80 bg-white/98 text-slate-900 shadow-xs'
      }`}
      dir="rtl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Brand */}
        <Link
          to="/"
          className="group flex shrink-0 items-center rounded-xl py-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 transition-transform duration-200 hover:scale-[1.02]"
        >
          <EnglishSparkLogo
            variant="horizontal"
            isDark={isDark}
            subtitle="نادي اللغة الإنجليزية"
            showSubtitle={false}
          />
        </Link>

        {/* Desktop Section Links */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.Icon;
            const isActive =
              pathname === link.path ||
              pathname.startsWith(link.path + '/') ||
              (link.path === '/competitions' && pathname.startsWith('/challenge'));
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                  isActive
                    ? isDark
                      ? 'bg-white/10 text-amber-300 shadow-xs border border-amber-400/30'
                      : 'bg-violet-50 text-violet-900 shadow-xs'
                    : isDark
                    ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive
                      ? isDark
                        ? 'text-amber-400'
                        : 'text-violet-700'
                      : isDark
                      ? 'text-slate-400'
                      : 'text-slate-400'
                  }`}
                />
                <span>{link.label}</span>
                {isActive && (
                  <span
                    className={`absolute inset-x-2 -bottom-2.5 h-0.5 rounded-full ${
                      isDark ? 'bg-amber-400' : 'bg-violet-600'
                    }`}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Actions & Mobile Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-xs transition focus-visible:outline-none focus-visible:ring-4 lg:hidden ${
              isDark
                ? 'border-white/15 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-amber-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-violet-200'
            }`}
          >
            {mobileMenuOpen ? (
              <X className={`h-5 w-5 ${isDark ? 'text-white' : 'text-slate-800'}`} />
            ) : (
              <Menu className={`h-5 w-5 ${isDark ? 'text-white' : 'text-slate-700'}`} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Pill Scroll with Peek Effect & Smart Scroll Controls */}
      <div className="relative lg:hidden">
        {/* Right Scroll Indicator & Button (appears when scrolled away from right) */}
        {canScrollRight && (
          <div
            className={`absolute right-0 top-0 bottom-0 z-10 flex items-center pr-1 pl-3 pointer-events-none transition-opacity duration-300 ${
              isDark
                ? 'bg-gradient-to-l from-slate-900 via-slate-900/90 to-transparent'
                : 'bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent'
            }`}
          >
            <button
              type="button"
              onClick={scrollRightDirection}
              aria-label="تمرير لليمين"
              className={`pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border shadow-xs transition-all duration-300 animate-pulse hover:animate-none active:scale-95 ${
                isDark
                  ? 'border-white/20 bg-slate-800 text-amber-300 hover:bg-slate-700'
                  : 'border-slate-200 bg-white text-violet-700 hover:bg-slate-50'
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scrollable Pills Container */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className={`border-t px-2 py-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex items-center gap-1.5 transition-colors ${
            isDark ? 'border-white/10 bg-slate-900/98' : 'border-slate-100/80 bg-slate-50/98'
          }`}
        >
          <Link
            to="/"
            className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
              pathname === '/'
                ? isDark
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'bg-violet-700 text-white shadow-xs'
                : isDark
                ? 'bg-white/10 text-slate-200 border border-white/10 hover:bg-white/15'
                : 'bg-white text-slate-700 border border-slate-200/70 hover:bg-slate-100'
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span>الرئيسية</span>
          </Link>
          {navLinks.map((link) => {
            const Icon = link.Icon;
            const isActive =
              pathname === link.path ||
              pathname.startsWith(link.path + '/') ||
              (link.path === '/competitions' && pathname.startsWith('/challenge'));
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? isDark
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-violet-700 text-white shadow-xs'
                    : isDark
                    ? 'bg-white/10 text-slate-200 border border-white/10 hover:bg-white/15'
                    : 'bg-white text-slate-700 border border-slate-200/70 hover:bg-slate-100'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive ? (isDark ? 'text-slate-950' : 'text-white') : isDark ? 'text-slate-400' : 'text-slate-400'
                  }`}
                />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Left Scroll Indicator & Button (appears when there are more items to the left) */}
        {canScrollLeft && (
          <div
            className={`absolute left-0 top-0 bottom-0 z-10 flex items-center pl-1 pr-3 pointer-events-none transition-opacity duration-300 ${
              isDark
                ? 'bg-gradient-to-r from-slate-900 via-slate-900/90 to-transparent'
                : 'bg-gradient-to-r from-white via-white/90 to-transparent'
            }`}
          >
            <button
              type="button"
              onClick={scrollLeftDirection}
              aria-label="المزيد من الأقسام"
              className={`pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border shadow-xs transition-all duration-300 animate-pulse hover:animate-none active:scale-95 ${
                isDark
                  ? 'border-white/20 bg-slate-800 text-amber-300 hover:bg-slate-700'
                  : 'border-slate-200 bg-white text-violet-700 hover:bg-slate-50'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Mobile Drawer (Polished bottom sheet style) */}
      {mobileMenuOpen && (
        <div
          className={`lg:hidden border-t p-4 shadow-2xl backdrop-blur-2xl animate-page-enter transition-colors ${
            isDark ? 'border-white/10 bg-slate-950/98 text-white' : 'border-violet-100 bg-white/98 text-slate-900'
          }`}
        >
          <div className="space-y-3.5">
            {/* Initiative Header Card */}
            <div
              className={`rounded-2xl border p-3.5 text-center ${
                isDark
                  ? 'border-white/10 bg-white/5'
                  : 'border-violet-100 bg-gradient-to-br from-violet-50/90 to-indigo-50/60'
              }`}
            >
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black ${
                  isDark ? 'bg-amber-400/20 text-amber-300' : 'bg-violet-100/90 text-violet-800'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                مبادرة إنتاج معرفي • وزارة التعليم
              </span>
              <p className={`mt-1.5 text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                إدارة تعليم جازان • متوسطة وثانوية الجرادية — معلمات اللغة الإنجليزية
              </p>
            </div>

            {/* Navigation Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 rounded-2xl p-2.5 text-xs font-bold transition-all border ${
                  pathname === '/'
                    ? isDark
                      ? 'border-amber-400/50 bg-amber-400/10 text-amber-300 shadow-xs'
                      : 'border-violet-600 bg-violet-50/80 text-violet-900 shadow-xs'
                    : isDark
                    ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    : 'border-slate-100 bg-slate-50/60 text-slate-700 hover:bg-violet-50/50 hover:border-violet-200'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-xs ${
                    isDark ? 'bg-amber-500' : 'bg-violet-600'
                  }`}
                >
                  <Home className="h-4 w-4" />
                </div>
                <div className="flex flex-col text-right">
                  <span className={`font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>الرئيسية</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Home</span>
                </div>
              </Link>

              {navLinks.map((link) => {
                const Icon = link.Icon;
                const isActive =
                  pathname === link.path ||
                  pathname.startsWith(link.path + '/') ||
                  (link.path === '/competitions' && pathname.startsWith('/challenge'));
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 rounded-2xl p-2.5 text-xs font-bold transition-all border ${
                      isActive
                        ? isDark
                          ? 'border-amber-400/50 bg-amber-400/10 text-amber-300 shadow-xs'
                          : 'border-violet-600 bg-violet-50/80 text-violet-900 shadow-xs'
                        : isDark
                        ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        : 'border-slate-100 bg-slate-50/60 text-slate-700 hover:bg-violet-50/50 hover:border-violet-200'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${link.color} text-white shadow-xs`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col text-right">
                      <span className={`font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{link.label}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{link.labelEn}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Quick footer info */}
            <div
              className={`pt-2 border-t flex items-center justify-between text-[11px] ${
                isDark ? 'border-white/10 text-slate-400' : 'border-slate-100 text-slate-500'
              }`}
            >
              <span className="font-semibold">English Spark • مساحة التعلم</span>
              <div className="flex gap-4 font-bold">
                <Link
                  to="/privacy"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`transition-colors ${isDark ? 'hover:text-amber-400' : 'hover:text-violet-700'}`}
                >
                  الخصوصية
                </Link>
                <Link
                  to="/terms"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`transition-colors ${isDark ? 'hover:text-amber-400' : 'hover:text-violet-700'}`}
                >
                  الشروط
                </Link>
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
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/40" dir="rtl">
      <PortalNav />
      <div
        className={`relative z-10 mx-auto w-full flex-1 px-4 pb-16 pt-6 sm:px-6 ${
          wide ? 'max-w-6xl' : 'max-w-4xl'
        }`}
      >
        {children}
      </div>
      <PortalFooter />
    </div>
  );
}

export function PortalFooter({ variant = 'light' }: { variant?: 'light' | 'dark' } = {}) {
  const isDark = variant === 'dark';

  return (
    <footer
      className={`relative z-10 border-t py-10 backdrop-blur-md transition-colors ${
        isDark
          ? 'border-white/10 bg-slate-950/95 text-white'
          : 'border-violet-100/70 bg-white/95 text-slate-900'
      }`}
      dir="rtl"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-4 sm:px-6">
        {/* Initiative Branding Card */}
        <div className="flex flex-col items-center text-center">
          <Link
            to="/"
            className="inline-flex transition-transform hover:scale-105"
            aria-label="الرئيسية"
          >
            <EnglishSparkLogo
              variant="horizontal"
              isDark={isDark}
              showSubtitle={false}
            />
          </Link>
          <p className={`mt-2 text-xs font-semibold text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            إدارة تعليم جازان • متوسطة وثانوية الجرادية — مديرة المدرسة: أ. آمنة دغريري • إشراف: معلمات اللغة الإنجليزية
          </p>
        </div>

        {/* Structured Links on Mobile & Desktop */}
        <div className={`w-full border-y py-6 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
          <div
            className={`mx-auto max-w-3xl flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-bold ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            <Link to="/" className={isDark ? 'hover:text-amber-400 transition-colors' : 'hover:text-violet-700 transition-colors'}>
              الرئيسية
            </Link>
            <Link to="/grammar" className={isDark ? 'hover:text-amber-400 transition-colors' : 'hover:text-violet-700 transition-colors'}>
              القواعد
            </Link>
            <Link to="/reading" className={isDark ? 'hover:text-amber-400 transition-colors' : 'hover:text-violet-700 transition-colors'}>
              القراءة
            </Link>
            <Link to="/listening" className={isDark ? 'hover:text-amber-400 transition-colors' : 'hover:text-violet-700 transition-colors'}>
              الاستماع
            </Link>
            <Link to="/writing" className={isDark ? 'hover:text-amber-400 transition-colors' : 'hover:text-violet-700 transition-colors'}>
              الكتابة
            </Link>
            <Link to="/speaking" className={isDark ? 'hover:text-amber-400 transition-colors' : 'hover:text-violet-700 transition-colors'}>
              المحادثة
            </Link>
            <Link to="/competitions" className={isDark ? 'hover:text-amber-400 transition-colors' : 'hover:text-violet-700 transition-colors'}>
              المسابقات
            </Link>
            <Link to="/national-journey" className={isDark ? 'hover:text-amber-400 transition-colors' : 'hover:text-violet-700 transition-colors'}>
              🇸🇦 وطن وقيادة
            </Link>
            <Link to="/guestbook" className={isDark ? 'hover:text-amber-400 transition-colors' : 'hover:text-violet-700 transition-colors'}>
              سجل الزوار
            </Link>
            <span className={isDark ? 'text-white/20 hidden sm:inline' : 'text-slate-300 hidden sm:inline'} aria-hidden="true">
              •
            </span>
            <Link
              to="/privacy"
              className={isDark ? 'text-slate-400 hover:text-amber-400 transition-colors' : 'text-slate-500 hover:text-violet-700 transition-colors'}
            >
              الخصوصية
            </Link>
            <Link
              to="/terms"
              className={isDark ? 'text-slate-400 hover:text-amber-400 transition-colors' : 'text-slate-500 hover:text-violet-700 transition-colors'}
            >
              الشروط
            </Link>
          </div>
        </div>

        {/* Copyright notice */}
        <p className={`text-center text-[11px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          English Spark © 2026 — منصة التعلم التفاعلية • جميع الحقوق محفوظة
        </p>
      </div>
    </footer>
  );
}
