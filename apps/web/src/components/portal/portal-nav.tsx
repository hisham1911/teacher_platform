import { useState } from 'react';
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
} from 'lucide-react';
import type { ComponentType } from 'react';

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

export function PortalNav() {
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav
      className="portal-nav sticky top-0 z-40 border-b border-violet-100/70 bg-white/90 backdrop-blur-xl shadow-xs"
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
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-white shadow-sm transition-transform duration-300 group-hover:scale-105"
          >
            <Sparkles className="h-5 w-5" />
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
                    ? 'bg-violet-50 text-violet-900 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? 'text-violet-700' : 'text-slate-400'
                  }`}
                />
                <span>{link.label}</span>
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 lg:hidden"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-slate-800" />
            ) : (
              <Menu className="h-5 w-5 text-slate-700" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Pill Scroll (Fast, elegant single-tap access) */}
      <div className="lg:hidden border-t border-slate-100/80 bg-slate-50/80 px-2 py-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex items-center gap-1.5">
        <Link
          to="/"
          className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
            pathname === '/'
              ? 'bg-violet-700 text-white shadow-xs'
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
                  ? 'bg-violet-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200/70 hover:bg-slate-100'
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Mobile Drawer (Polished bottom sheet style) */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-violet-100 bg-white/98 p-4 shadow-2xl backdrop-blur-2xl animate-page-enter">
          <div className="space-y-3.5">
            {/* Initiative Header Card */}
            <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/90 to-indigo-50/60 p-3.5 text-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100/90 px-3 py-1 text-[11px] font-black text-violet-800">
                <Sparkles className="h-3 w-3 text-violet-600" />
                مبادرة إنتاج معرفي • وزارة التعليم
              </span>
              <p className="mt-1.5 text-xs font-bold text-slate-700">
                مدرسة متوسطة وثانوية الجرادية — المعلمة مريم الصميلي
              </p>
            </div>

            {/* Navigation Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 rounded-2xl p-2.5 text-xs font-bold transition-all border ${
                  pathname === '/'
                    ? 'border-violet-600 bg-violet-50/80 text-violet-900 shadow-xs'
                    : 'border-slate-100 bg-slate-50/60 text-slate-700 hover:bg-violet-50/50 hover:border-violet-200'
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
                  <Home className="h-4 w-4" />
                </div>
                <div className="flex flex-col text-right">
                  <span className="font-black text-slate-900">الرئيسية</span>
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
                        ? 'border-violet-600 bg-violet-50/80 text-violet-900 shadow-xs'
                        : 'border-slate-100 bg-slate-50/60 text-slate-700 hover:bg-violet-50/50 hover:border-violet-200'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${link.color} text-white shadow-xs`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="font-black text-slate-900">{link.label}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{link.labelEn}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Quick footer info */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold">English Spark • مساحة التعلم</span>
              <div className="flex gap-4 font-bold">
                <Link
                  to="/privacy"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-violet-700 transition-colors"
                >
                  الخصوصية
                </Link>
                <Link
                  to="/terms"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-violet-700 transition-colors"
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
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/40" dir="rtl">
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

export function PortalFooter() {
  return (
    <footer
      className="relative z-10 border-t border-violet-100/70 bg-white/95 py-10 backdrop-blur-md"
      dir="rtl"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-4 sm:px-6">
        {/* Initiative Branding Card */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 text-center sm:text-right">
          <Link
            to="/"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-white shadow-md"
          >
            <Sparkles className="h-6 w-6" />
          </Link>
          <div>
            <p className="text-base font-black text-slate-900">
              English Spark — نادي اللغة الإنجليزية
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              مبادرة إنتاج معرفي • وزارة التعليم — مدرسة متوسطة وثانوية الجرادية (إشراف المعلمة مريم الصميلي)
            </p>
          </div>
        </div>

        {/* Structured Links on Mobile & Desktop */}
        <div className="w-full border-y border-slate-100 py-6">
          <div className="mx-auto max-w-3xl flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-bold text-slate-600">
            <Link to="/" className="hover:text-violet-700 transition-colors">
              الرئيسية
            </Link>
            <Link to="/grammar" className="hover:text-violet-700 transition-colors">
              القواعد
            </Link>
            <Link to="/reading" className="hover:text-violet-700 transition-colors">
              القراءة
            </Link>
            <Link to="/listening" className="hover:text-violet-700 transition-colors">
              الاستماع
            </Link>
            <Link to="/writing" className="hover:text-violet-700 transition-colors">
              الكتابة
            </Link>
            <Link to="/speaking" className="hover:text-violet-700 transition-colors">
              المحادثة
            </Link>
            <Link to="/competitions" className="hover:text-violet-700 transition-colors">
              المسابقات
            </Link>
            <Link to="/guestbook" className="hover:text-violet-700 transition-colors">
              سجل الزوار
            </Link>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
              •
            </span>
            <Link
              to="/privacy"
              className="text-slate-500 hover:text-violet-700 transition-colors"
            >
              الخصوصية
            </Link>
            <Link
              to="/terms"
              className="text-slate-500 hover:text-violet-700 transition-colors"
            >
              الشروط
            </Link>
          </div>
        </div>

        {/* Copyright notice */}
        <p className="text-center text-[11px] font-semibold text-slate-400">
          English Spark © 2026 — منصة التعلم التفاعلية • جميع الحقوق محفوظة
        </p>
      </div>
    </footer>
  );
}
