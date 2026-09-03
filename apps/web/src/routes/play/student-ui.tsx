import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { PublicBackdrop } from '../../components/layout/root-layout';

const shellWidths = {
  narrow: 'max-w-xl',
  wide: 'max-w-4xl',
} as const;

export function StudentShell({
  children,
  width = 'narrow',
  centered = false,
}: {
  children: ReactNode;
  width?: keyof typeof shellWidths;
  centered?: boolean;
}) {
  return (
    <main className="student-shell relative min-h-dvh overflow-x-clip" dir="rtl">
      <PublicBackdrop />
      <div className={`relative z-10 mx-auto flex min-h-dvh w-full ${shellWidths[width]} flex-col px-4 sm:px-6`}>
        <StudentSparkBrand />
        <div className={`animate-page-enter flex flex-1 flex-col pb-5 pt-2 ${centered ? 'justify-center pb-8 sm:pb-10' : 'sm:pt-4'}`}>
          {children}
        </div>
      </div>
    </main>
  );
}

export function StudentSparkBrand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`flex min-h-14 items-center justify-center gap-2.5 py-3 text-center ${inverse ? 'text-white' : 'text-slate-950'}`} aria-label="English Spark">
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-lg font-black text-white shadow-sm">✦</span>
      <div className="leading-none">
        <p className="text-xs font-black tracking-[0.12em]">ENGLISH SPARK</p>
        <p className={`mt-1.5 text-[9px] font-bold ${inverse ? 'text-sky-200' : 'text-violet-600'}`}>تعلم · العب · اكتشف</p>
      </div>
    </div>
  );
}

export function StudentLearningVisual() {
  return (
    <svg aria-hidden="true" viewBox="0 0 160 120" className="h-24 w-36" fill="none">
      <circle cx="80" cy="60" r="54" fill="var(--student-violet-soft)" />
      <path d="M27 43c18-7 36-3 53 9v43c-17-11-35-15-53-8V43Z" fill="white" stroke="var(--student-primary)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M133 43c-18-7-36-3-53 9v43c17-11 35-15 53-8V43Z" fill="white" stroke="var(--student-primary)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M80 52v43" stroke="var(--student-primary)" strokeWidth="3" strokeLinecap="round" />
      <g transform="rotate(-24 119 33)">
        <rect x="102" y="25" width="34" height="11" rx="5.5" fill="var(--student-orange)" />
        <path d="m101 25-10 5.5 10 5.5V25Z" fill="var(--student-ink)" />
      </g>
      <path d="m42 24 3.5 7.5L53 35l-7.5 3.5L42 46l-3.5-7.5L31 35l7.5-3.5L42 24Z" fill="var(--student-violet)" />
    </svg>
  );
}

const studentButtonVariants = {
  primary: 'bg-[var(--student-primary)] text-white shadow-[0_2px_8px_rgb(5_150_105/0.22)] hover:bg-[var(--student-primary-strong)]',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50',
  quiet: 'bg-transparent text-slate-700 hover:bg-slate-100',
} as const;

export function StudentButton({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof studentButtonVariants;
}) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-sm font-bold transition-[background-color,border-color,color,transform] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--student-primary)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 ${studentButtonVariants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function QuestionProgress({ current, total }: { current: number; total: number }) {
  const percentage = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-black text-[var(--student-ink)]">سؤال {current} من {total}</span>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--student-primary-strong)] shadow-[0_1px_4px_rgb(15_23_42/0.07)]">{Math.round(percentage)}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="تقدم الاختبار"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
        className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-[var(--student-primary)] transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function StudentLoading({ message }: { message: string }) {
  return (
    <StudentShell centered>
      <div role="status" className="student-panel student-enter mx-auto w-full max-w-sm p-6 text-center">
        <span className="mx-auto mb-4 block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--student-primary)] motion-reduce:animate-none" />
        <p className="text-sm font-semibold text-[var(--student-muted)]">{message}</p>
      </div>
    </StudentShell>
  );
}

export function StudentError({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <StudentShell centered>
      <section className="student-panel student-enter p-6 text-center sm:p-8">
        <div aria-hidden="true" className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl font-black text-amber-800">!</div>
        <h1 className="text-xl font-black text-[var(--student-ink)]">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-[var(--student-muted)]">{message}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </section>
    </StudentShell>
  );
}
