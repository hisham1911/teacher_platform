from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:80]!r}')
    file_path.write_text(text.replace(old, new, 1), encoding='utf-8')


# Student routes must never inherit public/teacher chrome.
replace_once(
    'apps/web/src/components/layout/root-layout.tsx',
    "  const isStudentExperience = location.pathname === '/join' || location.pathname.startsWith('/play/');",
    "  const isStudentExperience = location.pathname === '/join' || location.pathname.startsWith('/play/') || location.pathname.startsWith('/student');",
)

# Player: preserve guest-cookie resume first, then auto-link a logged-in portal student.
replace_once(
    'apps/web/src/routes/play/play-page.tsx',
    "import { playerApi } from '../../data/api-client/endpoints';\n",
    "import { playerApi } from '../../data/api-client/endpoints';\nimport { studentPortalApi } from '../../data/api-client/student-portal-endpoints';\n",
)
replace_once(
    'apps/web/src/routes/play/play-page.tsx',
    "  const [actionError, setActionError] = useState<string | null>(null);\n",
    "  const [actionError, setActionError] = useState<string | null>(null);\n  const [portalHint, setPortalHint] = useState<string | null>(null);\n",
)
replace_once(
    'apps/web/src/routes/play/play-page.tsx',
    "  // استعادة تلقائية بعد إعادة تحميل الصفحة: السيرفر يقرّر الوجهة من الكوكي فقط\n  const restoreMutation = useMutation({\n",
    "  const portalJoinMutation = useMutation({\n    mutationFn: () => studentPortalApi.joinActivity(joinCode!),\n    onSuccess: (playerState) => {\n      setPortalHint(null);\n      setActionError(null);\n      applyPlayerState(joinCode!, playerState, sessionQuery.data!);\n    },\n    onError: (error) => {\n      // لا توجد جلسة بوابة صالحة: نترك الانضمام السريع كما هو بدون رسالة خطأ.\n      if (error instanceof HttpError && error.status === 401) return;\n      // جلسة البوابة صالحة لكن النشاط تابع لمساحة أخرى: لا نسرّب تفاصيل الـTenant ونسمح بالضيف.\n      if (error instanceof HttpError && error.status === 404) {\n        setPortalHint('هذا النشاط خارج مساحتك الحالية. يمكنك الانضمام إليه كضيف بالاسم.');\n        return;\n      }\n      if (error instanceof HttpError && error.status === 409) {\n        setActionError('النشاط لم يعد يقبل منضمّين جددًا.');\n        return;\n      }\n      setActionError('تعذر ربط النشاط بمساحتك الآن. يمكنك المتابعة كضيف.');\n    },\n  });\n\n  // استعادة تلقائية بعد إعادة تحميل الصفحة: Guest Cookie له الأولوية، ثم نحاول Portal Cookie.\n  const restoreMutation = useMutation({\n",
)
replace_once(
    'apps/web/src/routes/play/play-page.tsx',
    "    onError: (error) => {\n      // 401 = لا كوكي صالح ⇒ نترك شاشة الانضمام. بقية الأخطاء غير مؤذية للعرض.\n      if (!(error instanceof HttpError && error.status === 401)) {\n        setActionError('تعذر استعادة جلستك. أدخل اسمك للانضمام من جديد.');\n      }\n    },\n  });\n",
    "    onError: (error) => {\n      if (error instanceof HttpError && error.status === 401) {\n        portalJoinMutation.mutate();\n        return;\n      }\n      setActionError('تعذر استعادة جلستك. أدخل اسمك للانضمام من جديد.');\n    },\n  });\n",
)
replace_once(
    'apps/web/src/routes/play/play-page.tsx',
    "            {session.instructions ? <p className=\"mt-5 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-950\">{session.instructions}</p> : null}\n            {!useStudentCode ? (\n",
    "            {session.instructions ? <p className=\"mt-5 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-950\">{session.instructions}</p> : null}\n            {portalHint ? <p role=\"status\" className=\"mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-900\">{portalHint}</p> : null}\n            {!useStudentCode ? (\n",
)

# Teacher student profile: portal access is primary; legacy StudentCode stays only for compatibility.
replace_once(
    'apps/web/src/routes/dashboard/students/student-detail-page.tsx',
    "import { formatStudentCode, type Student, type StudentResult } from '../../../types/students';\n",
    "import { formatStudentCode, type Student, type StudentResult } from '../../../types/students';\nimport { StudentPortalAccessCard } from './student-portal-access-card';\n",
)
replace_once(
    'apps/web/src/routes/dashboard/students/student-detail-page.tsx',
    "        <p className=\"mt-2 text-base leading-8 text-slate-600\">بيانات الطالب، كود الدخول، وآخر النتائج في ملف واحد.</p>\n",
    "        <p className=\"mt-2 text-base leading-8 text-slate-600\">بيانات الطالب، دخول English Spark، وآخر النتائج في ملف واحد.</p>\n",
)
replace_once(
    'apps/web/src/routes/dashboard/students/student-detail-page.tsx',
    "            <p>انسخ كود الدخول أدناه وشاركه مع الطالب. لا يحتاج إلى إنشاء حساب.</p>\n",
    "            <p>أنشئ كود دخول English Spark من البطاقة أدناه وشاركه مع الطالب مرة واحدة.</p>\n",
)
replace_once(
    'apps/web/src/routes/dashboard/students/student-detail-page.tsx',
    "      <StudentCodeCard student={student} onChanged={refreshStudent} />\n",
    "      <StudentPortalAccessCard studentId={student.id} isActive={student.isActive} />\n\n      <StudentCodeCard student={student} onChanged={refreshStudent} />\n",
)
replace_once(
    'apps/web/src/routes/dashboard/students/student-detail-page.tsx',
    "          <p id=\"student-code-title\" className=\"text-sm font-bold text-slate-900\">كود دخول الطالب</p>\n          <p className=\"mt-1 text-sm leading-7 text-slate-500\">استخدم نفس الكود في كل الأنشطة. لا يحتاج الطالب بريدًا أو كلمة مرور.</p>\n",
    "          <p id=\"student-code-title\" className=\"text-sm font-bold text-slate-900\">كود الربط القديم للأنشطة</p>\n          <p className=\"mt-1 text-sm leading-7 text-slate-500\">يبقى للتوافق مع مسار الانضمام القديم فقط. دخول مساحة الطالب يستخدم كود English Spark المنفصل أعلاه.</p>\n",
)

print('Student portal web patch applied successfully.')
