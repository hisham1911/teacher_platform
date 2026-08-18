import type { ButtonHTMLAttributes, ReactNode } from 'react';

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
    <main className="student-shell min-h-dvh overflow-x-clip" dir="rtl">
      <div className={`relative z-10 mx-auto flex min-h-dvh w-full ${shellWidths[width]} flex-col px-4 sm:px-6`}>
        <header className="flex min-h-16 items-center justify-between gap-3 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-black text-[var(--student-ink)]">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--student-primary)] text-xs text-white">م</span>
            منصة المعلم
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[var(--student-primary-strong)] shadow-[0_1px_4px_rgb(15_23_42/0.08)]">
            تجربة الطالب
          </span>
        </header>
        <div className={`flex flex-1 flex-col pb-5 ${centered ? 'justify-center py-6 sm:py-10' : ''}`}>
          {children}
        </div>
      </div>
    </main>
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
