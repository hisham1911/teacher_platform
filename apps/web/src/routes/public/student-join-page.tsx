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
    <div className="mx-auto grid min-h-[calc(100dvh-12rem)] max-w-5xl items-center gap-6 py-5 lg:grid-cols-[0.9fr_1.1fr] lg:py-10">
      <section className="order-2 rounded-[2rem] border border-violet-100 bg-white p-5 shadow-[0_24px_70px_rgb(76_29_149/0.08)] sm:p-8 lg:order-1">
        <p className="text-xs font-black tracking-[0.2em] text-violet-700">STUDENT PORTAL</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">جاهز للانطلاق؟ 🚀</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">لا تحتاج بريدًا إلكترونيًا أو كلمة مرور. فقط رمز النشاط، وبعدها اكتب اسمك وابدأ.</p>

        <form onSubmit={submit} className="mt-7">
          <label htmlFor="join-code" className="text-sm font-black text-slate-800">رمز النشاط</label>
          <input
            id="join-code"
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            value={code}
            onChange={(event) => {
              setCode(normalizeJoinCode(event.target.value));
              setError(null);
            }}
            placeholder="SPARK123"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'join-code-error' : 'join-code-hint'}
            className="mt-2 min-h-16 w-full rounded-2xl border border-slate-300 bg-white px-4 text-center font-mono text-2xl font-black tracking-[0.18em] text-slate-950 shadow-sm focus:border-violet-600 focus:outline-2 focus:outline-violet-200"
          />
          {error ? <p id="join-code-error" role="alert" className="mt-2 text-sm font-bold text-rose-700">{error}</p> : <p id="join-code-hint" className="mt-2 text-xs text-slate-500">يمكن أيضًا فتح الرابط أو QR مباشرة بدون كتابة الرمز.</p>}
          <button type="submit" disabled={code.length < 4} className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-l from-violet-700 to-indigo-700 px-6 text-base font-black text-white shadow-[0_12px_30px_rgb(109_40_217/0.2)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">دخول النشاط <span aria-hidden="true" className="mr-2">←</span></button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-5 text-center"><p className="text-xs text-slate-500">صانع المحتوى أو مسؤول المساحة؟</p><Link to="/auth/login" className="mt-1 inline-flex min-h-11 items-center text-sm font-black text-violet-700 hover:text-violet-900">تسجيل الدخول إلى Studio</Link></div>
      </section>

      <section className="order-1 relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-2xl sm:p-9 lg:order-2">
        <div aria-hidden="true" className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-400/15 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-black tracking-[0.2em] text-amber-300">YOUR NEXT MISSION</p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">English Spark</h2>
          <p className="mt-3 max-w-lg text-sm leading-7 text-violet-100">كل نشاط تجربة قصيرة: تحدٍ، استماع، مسابقة أو مراجعة. اجمع النقاط وتقدم محطة بعد محطة.</p>
          <div className="mt-8 flex items-center justify-between gap-2" aria-hidden="true">
            {['🌍', '🌙', '🛰️', '🪐', '🚀', '🏆'].map((icon, index) => <div key={icon} className="flex flex-1 items-center gap-2"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-xl ${index === 0 ? 'border-amber-300 bg-amber-300 text-slate-950 shadow-[0_0_22px_rgb(253_224_71/0.22)]' : 'border-white/10 bg-white/[0.06]'}`}>{icon}</span>{index < 5 ? <span className="h-0.5 flex-1 bg-white/10" /> : null}</div>)}
          </div>
          <div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs font-bold"><div className="rounded-xl bg-white/[0.07] p-3"><p className="text-xl">⚡</p><p className="mt-1 text-violet-100">دخول سريع</p></div><div className="rounded-xl bg-white/[0.07] p-3"><p className="text-xl">⭐</p><p className="mt-1 text-violet-100">نقاط وتقدم</p></div><div className="rounded-xl bg-white/[0.07] p-3"><p className="text-xl">🎓</p><p className="mt-1 text-violet-100">نتيجة وإنجاز</p></div></div>
        </div>
      </section>
    </div>
  );
}
