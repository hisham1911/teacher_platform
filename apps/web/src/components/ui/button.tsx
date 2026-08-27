import type { ReactNode } from 'react';

const base =
  'inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-black transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)] disabled:cursor-not-allowed disabled:opacity-60';

const variants = {
  primary: 'bg-[var(--teacher-primary)] text-white shadow-sm hover:bg-[var(--teacher-primary-strong)] hover:shadow-md',
  secondary: 'border border-violet-200 bg-white text-violet-800 hover:bg-violet-50',
  danger: 'bg-rose-700 text-white hover:bg-rose-800 focus-visible:outline-rose-700',
} as const;

export function Button({
  variant = 'primary',
  type = 'button',
  disabled,
  onClick,
  children,
}: {
  variant?: keyof typeof variants;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button type={type} className={`${base} ${variants[variant]}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
