import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { classroomsApi } from '../../../data/api-client/phase2-endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';

export default function ClassroomNewPage() {
  const tenantId = getActiveTenantId(); const navigate = useNavigate(); const [name, setName] = useState(''); const [year, setYear] = useState('');
  const mutation = useMutation({ mutationFn: () => classroomsApi.create(tenantId!, { name: name.trim(), academicYear: year.trim() || null }), onSuccess: (item) => navigate(`/dashboard/classes/${item.id}`, { replace: true }) });
  function submit(event: FormEvent) { event.preventDefault(); if (name.trim() && tenantId) mutation.mutate(); }
  return <div className="mx-auto max-w-2xl space-y-5"><Link to="/dashboard/classes" className="inline-flex min-h-11 items-center text-sm font-bold text-violet-700">← الفصول</Link><section className="teacher-surface p-5 sm:p-7"><h1 className="text-2xl font-black text-slate-950">إنشاء فصل</h1><p className="mt-2 text-sm leading-7 text-slate-600">اكتب اسمًا واضحًا للمعلم والطلاب. يمكنك إضافة الطلاب بعد الحفظ.</p><form onSubmit={submit} className="mt-6 space-y-5"><label className="block text-sm font-bold text-slate-700">اسم الفصل<input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus-visible:border-violet-600 focus-visible:ring-4 focus-visible:ring-violet-100" placeholder="مثال: المجموعة المسائية" /></label><label className="block text-sm font-bold text-slate-700">السنة الدراسية <span className="font-normal text-slate-400">اختياري</span><input value={year} onChange={(e) => setYear(e.target.value)} maxLength={30} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus-visible:border-violet-600 focus-visible:ring-4 focus-visible:ring-violet-100" placeholder="مثال: 2026 / 2027" /></label>{mutation.isError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-800">تعذر إنشاء الفصل الآن.</p> : null}<button disabled={!name.trim() || mutation.isPending} className="min-h-12 w-full rounded-xl bg-violet-700 px-5 text-sm font-black text-white hover:bg-violet-800 disabled:opacity-50">{mutation.isPending ? 'جارٍ الحفظ…' : 'إنشاء الفصل'}</button></form></section></div>;
}
