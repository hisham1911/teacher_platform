import type { ComponentPropsWithRef, ReactNode } from 'react';

type FieldInputProps = {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
};

/**
 * Shared form-field contract for the Studio.
 * Labels stay visible, hints and errors are explicitly associated with the control,
 * and optional metadata is presentation rather than part of the label text.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  optional = false,
  className = '',
  children,
}: {
  id: string;
  label: string;
  hint?: string | null;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: (inputProps: FieldInputProps) => ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-sm font-bold leading-6 text-slate-800">
          {label}
        </label>
        {optional ? <span className="text-xs font-medium text-slate-500">اختياري</span> : null}
      </div>
      {hint ? <p id={hintId} className="text-[13px] leading-6 text-slate-500">{hint}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-2 text-[13px] font-semibold leading-6 text-rose-700">
          <span aria-hidden="true" className="mt-[0.15rem]">●</span>
          <span>{error}</span>
        </p>
      ) : null}
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
      })}
    </div>
  );
}

const inputBase =
  'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base leading-7 text-slate-950 shadow-[0_1px_2px_rgb(15_23_42/0.04)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-violet-600 focus-visible:ring-4 focus-visible:ring-violet-100 aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-rose-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export function TextInput(props: ComponentPropsWithRef<'input'>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function TextArea(props: ComponentPropsWithRef<'textarea'>) {
  return <textarea {...props} className={`${inputBase} resize-y ${props.className ?? ''}`} />;
}

export function SelectInput(props: ComponentPropsWithRef<'select'>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}
