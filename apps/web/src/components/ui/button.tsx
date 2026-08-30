import type { ReactNode } from 'react';

const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold leading-none transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-55';

const variants = {
  primary: 'bg-violet-700 text-white shadow-sm hover:bg-violet-800 hover:shadow-md',
  secondary: 'border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900',
  danger: 'bg-rose-700 text-white shadow-sm hover:bg-rose-800 focus-visible:ring-rose-200',
} as const;

export function Button({
  variant = 'primary',
  type = 'button',
  disabled,
  onClick,
  className = '',
  children,
}: {
  variant?: keyof typeof variants;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
