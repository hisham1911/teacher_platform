import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link to="/" className="text-base font-bold text-slate-900">
            منصة المعلم
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              الرئيسية
            </NavLink>
            <NavLink to="/dashboard" className={navLinkClass}>
              لوحة التحكم
            </NavLink>
            <NavLink to="/play/demo" className={navLinkClass}>
              تجربة الطالب
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 text-center text-xs text-slate-500">
          منصة المعلم — المرحلة التأسيسية
        </div>
      </footer>
    </div>
  );
}
