import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

function normalizeJoinCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export default function StudentJoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeJoinCode(code);
    if (normalized.length < 4) {
      setError('اكتب رمز النشاط كما ظهر لك.');
      return;
    }
    navigate(`/play/${normalized}`);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-5xl items-center py-5 sm:py-8">
      <section className="relative w-full overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-4 py-6 text-white shadow-[0_30px_90px_rgb(49_46_129/0.24)] sm:px-8 sm:py-9 lg:px-10 lg:py-10">
        <span aria-hidden="true" className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-fuchsia-400/15 blur-3xl" />
        <span aria-hidden="true" className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl" />
        <span aria-hidden="true" className="absolute left-[18%] top-16 h-2 w-2 rounded-full bg-amber-300/80 shadow-[0_0_24px_rgb(253_224_71/0.8)]" />
        <span aria-hidden="true" className="absolute right-[12%] top-28 h-1.5 w-1.5 rounded-full bg-white/70" />

        <div className="relative mx-auto max-w-4xl">
          <header className="text-center">
            <span className="inline-flex rounded-full border border-white/12 bg-white/[0.07] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-amber-200">ENGLISH SPARK</span>
            <h1 className="mt-4 text-balance text-3xl font-black leading-tight sm:text-5xl">جاهز للانطلاق؟ رمز واحد، والمغامرة تبدأ.</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-violet-100 sm:text-base">لا حساب ولا كلمة مرور. أدخل رمز النشاط فقط، ثم اكتب اسمك وابدأ.</p>
          </header>

          <div className="mx-auto mt-8 grid max-w-3xl gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-stretch">
            <form onSubmit={submit} className="rounded-[1.75rem] border border-white/15 bg-white p-5 text-slate-950 shadow-[0_24px_70px_rgb(15_23_42/0.28)] sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-violet-700">جاهز؟</p>
                  <h2 className="mt-1 text-2xl font-black">أدخل رمز النشاط</h2>
                </div>
                <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-2xl">⚡</span>
              </div>

              <label htmlFor="join-code" className="sr-only">رمز النشاط</label>
              <input
                id="join-code"
                dir="ltr"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                autoFocus
                value={code}
                onChange={(event) => {
                  setCode(normalizeJoinCode(event.target.value));
                  setError(null);
                }}
                placeholder="SPARK123"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'join-code-error' : 'join-code-hint'}
                className="mt-6 min-h-20 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-center font-mono text-3xl font-black tracking-[0.2em] text-slate-950 shadow-inner transition placeholder:text-slate-300 focus:border-violet-600 focus:bg-white focus:outline-4 focus:outline-violet-100 sm:text-4xl"
              />

              {error ? (
                <p id="join-code-error" role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm font-bold text-rose-700">{error}</p>
              ) : (
                <p id="join-code-hint" className="mt-3 text-center text-xs font-semibold text-slate-500">لو عندك رابط أو QR، افتحه مباشرة ومش هتحتاج تكتب الرمز.</p>
              )}

              <button type="submit" disabled={code.length < 4} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 px-6 text-base font-black text-white shadow-[0_12px_28px_rgb(109_40_217/0.24)] transition hover:-translate-y-0.5 hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transform-none">
                ابدأ الآن <span aria-hidden="true">←</span>
              </button>
            </form>

            <aside className="grid grid-cols-3 gap-2 lg:grid-cols-1" aria-label="خطوات الدخول">
              <MissionStep icon="⌨️" number="01" text="اكتب الرمز" />
              <MissionStep icon="👋" number="02" text="اكتب اسمك" />
              <MissionStep icon="🚀" number="03" text="ابدأ التحدي" />
            </aside>
          </div>

          <div className="mt-7 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 text-center sm:flex-row sm:text-right">
            <p className="text-xs font-semibold text-violet-200">English Spark · Learn • Play • Explore</p>
            <Link to="/auth/login" className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-black text-white/80 hover:bg-white/10 hover:text-white">دخول Studio لصانع المحتوى</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function MissionStep({ icon, number, text }: { icon: string; number: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3 text-center backdrop-blur sm:p-4 lg:text-right">
      <div className="flex items-center justify-between gap-2 lg:flex-row-reverse">
        <span aria-hidden="true" className="text-xl">{icon}</span>
        <span className="font-mono text-[10px] font-black tracking-widest text-amber-200">{number}</span>
      </div>
      <p className="mt-2 text-xs font-black text-violet-50 sm:text-sm">{text}</p>
    </div>
  );
}
