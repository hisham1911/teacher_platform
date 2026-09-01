import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { StudentLearningVisual, StudentShell } from '../play/student-ui';
import { extractJoinCode, normalizeJoinCode } from './student-join-input';

export default function StudentJoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = extractJoinCode(code);
    if (normalized.length < 4) {
      setError('اكتب رمز النشاط أو الصق رابط النشاط كاملًا.');
      return;
    }
    navigate(`/play/${normalized}`);
  }

  function onCodeChange(value: string) {
    const looksLikeLink = value.includes('/') || value.includes('://');
    setCode(looksLikeLink ? extractJoinCode(value) : normalizeJoinCode(value));
    setError(null);
  }

  return (
    <StudentShell centered width="wide">
      <section className="student-enter mx-auto grid w-full max-w-3xl gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
        <form onSubmit={submit} className="student-panel order-2 p-5 text-center sm:p-7 lg:order-1">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--student-violet-soft)] text-2xl" aria-hidden="true">⚡</div>
          <h1 className="mt-4 text-2xl font-black text-[var(--student-ink)] sm:text-3xl">انضم لنشاط سريع</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--student-muted)]">
            اكتب رمز النشاط الذي أرسله لك المعلم، أو الصق رابط النشاط كاملًا.
          </p>

          <label htmlFor="join-code" className="mt-6 block text-right text-sm font-bold text-[var(--student-ink)]">رمز النشاط</label>
          <input
            id="join-code"
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            autoFocus
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            placeholder="SPARK123"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'join-code-error' : 'join-code-hint'}
            className="mt-2 min-h-16 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-center font-mono text-2xl font-black tracking-[0.16em] text-[var(--student-ink)] shadow-sm transition placeholder:text-slate-300 focus:border-[var(--student-primary)] focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:text-3xl"
          />

          {error ? (
            <p id="join-code-error" role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>
          ) : (
            <p id="join-code-hint" className="mt-3 text-xs leading-6 text-[var(--student-muted)]">رمز النشاط يفتح نشاطًا واحدًا فقط.</p>
          )}

          <button type="submit" disabled={code.length < 4} className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--student-primary)] px-6 text-base font-black text-white shadow-[0_10px_24px_rgb(5_150_105/0.2)] transition hover:bg-[var(--student-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--student-primary)] disabled:cursor-not-allowed disabled:opacity-40">
            فتح النشاط
          </button>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-xs leading-6 text-[var(--student-muted)]">طالب مسجل في English Spark؟</p>
            <Link to="/student" className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-black text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100">الدخول إلى مساحتي</Link>
          </div>
        </form>

        <div className="order-1 flex flex-col items-center text-center lg:order-2">
          <StudentLearningVisual />
          <p className="mt-2 text-sm font-black text-[var(--student-primary-strong)]">عندك رمز نشاط؟</p>
          <p className="mt-1 max-w-[220px] text-xs leading-6 text-[var(--student-muted)]">اكتبه وابدأ فورًا. لا تحتاج إلى حساب للانضمام السريع.</p>
        </div>
      </section>
    </StudentShell>
  );
}
