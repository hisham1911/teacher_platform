import type { ReactNode } from 'react';

/** حقل نموذج بسيط: label + input + خطأ مرتبط بـaria-describedby */
export function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  children: (inputProps: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold text-slate-700">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': error ? errorId : undefined,
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  'min-h-13 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 placeholder-slate-400 shadow-sm transition focus:border-violet-500 focus:outline-2 focus:outline-violet-200 disabled:cursor-not-allowed disabled:bg-slate-50';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ''}`} />;
}
