# English Spark — UI Redesign Execution Plan

**Created:** 2026-09-03  
**Purpose:** ملف تنفيذي شامل لـ AI agent آخر لتنفيذ إعادة التصميم البصري الكامل  
**Repository:** `hisham1911/teacher_platform`  
**Current branch:** `main` at `90e6d356cbce5fb3780a0b67a3f9419aee8788ba`

---

## التعليمات للـ Agent المنفذ

> **اقرأ هذا الملف كاملاً قبل أي تعديل.**

### قواعد إلزامية
1. **أنشئ feature branch** قبل أي كود: `git checkout -b feature/ui-visual-polish`
2. **لا تعدل أي ملف backend** (مجلد `backend/`) — التعديلات CSS/TSX فقط في `apps/web/`
3. **لا تعدل routing أو business logic** — التعديلات بصرية فقط
4. **لا تعدل test assertions** إلا لو الـ test بيتحقق من نص UI محدد تغيّر
5. **شغّل الاختبارات بعد كل مرحلة:**
   ```bash
   cd apps/web
   npm run typecheck
   npm run lint  
   npm run test
   ```
6. **لا force push أو history rewrite**
7. **اللغة العربية** في الواجهة يجب أن تبقى طبيعية ومحايدة (ليست مؤنثة)

### بنية المشروع
```
f:\teacher\
├── apps/web/                   ← Frontend (React 19 + Vite + TypeScript + Tailwind CSS 4)
│   ├── index.html              ← Entry HTML (يحمّل Cairo من Google Fonts)
│   ├── src/
│   │   ├── index.css           ← Global styles + design tokens
│   │   ├── studio-ui.css       ← Dashboard-specific styles  
│   │   ├── routes/
│   │   │   ├── public/         ← Homepage, Teachers, Join pages
│   │   │   ├── student/        ← Student Portal pages
│   │   │   ├── auth/           ← Login, Signup pages
│   │   │   ├── play/           ← Player + student-ui.tsx shared shell
│   │   │   └── dashboard/      ← Teacher Studio pages
│   │   └── components/
│   │       ├── layout/root-layout.tsx  ← App shell + sidebar + nav
│   │       └── ui/             ← Shared UI components
│   └── vercel.json
└── backend/                    ← ⛔ لا تلمسه
```

---

## المرحلة 0: إغلاق PR #12

**على GitHub فقط — لا تعديل كود:**
- اذهب إلى `https://github.com/hisham1911/teacher_platform/pull/12`
- أغلق الـ PR مع تعليق:
  ```
  Closing — this branch predates the Phase 2-4 integration on main 
  and would delete Assignments, Classes, Commercial SaaS, and their 
  migrations/tests. The simplification ideas (cleaner hero, fewer 
  decorations, 3-section layout) will be applied manually on current 
  main in the UI visual polish branch.
  ```

---

## المرحلة 1: الأساسيات البصرية

### 1.1 — تفعيل خط Cairo على كل التطبيق

**File:** `apps/web/src/index.css` (line 4)

**Current:**
```css
:root {
  font-family: 'Segoe UI', Tahoma, system-ui, sans-serif;
```

**Change to:**
```css
:root {
  font-family: 'Cairo', system-ui, sans-serif;
```

**Why:** `index.html` يحمّل Cairo من Google Fonts بالفعل (preconnect + stylesheet link موجودين) لكن CSS لا يستخدمه. هذا السطر الواحد يفعّل Cairo على كامل التطبيق.

---

### 1.2 — إزالة تعريف font-family المكرر من studio-ui.css

**File:** `apps/web/src/studio-ui.css` (line 2)

**Current:**
```css
:root {
  font-family: 'Cairo', 'Segoe UI', Tahoma, system-ui, sans-serif;
```

**Change to:**
```css
:root {
  /* font-family inherited from index.css */
```

**Why:** أصبح Cairo مُعرّف في `index.css` فلا حاجة لتكراره.

---

### 1.3 — تنظيف خلفية الصفحات العامة (StudentBackdrop)

**File:** `apps/web/src/routes/play/student-ui.tsx` (lines 30-67)

**Current `StudentBackdrop` function** يرسم SVG كبير فيه:
- 4 دوائر ملونة
- أشكال هندسية (مربع، قلب، +، نجوم)  
- حروف كبيرة (Aa, Bb, 123, ?)
- أشكال زخرفية إضافية

**Replace entire `StudentBackdrop` function with:**
```tsx
function StudentBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_6%,oklch(0.955_0.04_72/0.55),transparent_22rem),radial-gradient(circle_at_94%_14%,oklch(0.95_0.035_292/0.4),transparent_20rem),radial-gradient(circle_at_50%_80%,oklch(0.96_0.025_163/0.35),transparent_26rem)]" />
    </div>
  );
}
```

**Why:** يستبدل الزخارف الكرتونية (Bb, ?, نجوم) بخلفية gradient هادئة تتسق مع بقية التطبيق. هذا يؤثر على `/join` و `/student`.

**Note:** `StudentLearningVisual` (الكتاب SVG البسيط في lines 81-94) يبقى كما هو — بسيط ومعقول.

---

### 1.4 — تبسيط خلفية الـ Homepage

**File:** `apps/web/src/routes/public/home-page.css`

**Current `.spark-home-world`** (lines 5-13) has 6 gradient layers + dot pattern pseudo-element + diagonal lines pseudo-element.

**Replace `.spark-home-world` (lines 5-13) with:**
```css
.spark-home-world {
  background:
    radial-gradient(circle at 12% 8%, oklch(0.955 0.04 72 / 0.4), transparent 24rem),
    radial-gradient(circle at 88% 12%, oklch(0.95 0.04 292 / 0.5), transparent 26rem),
    linear-gradient(180deg, oklch(0.995 0.004 292), oklch(0.978 0.008 174));
}
```

**Remove `.spark-home-world::before`** (lines 15-28) — the dot/grid pattern overlay.

**Remove `.spark-home-world::after`** (lines 30-38) — the diagonal light lines.

**Remove `.spark-home-float` and `.spark-home-float-delayed`** animations (lines 49-73) — used by the floating ⭐⚡ decorations that will be removed.

**Keep** `.spark-home-grid` (lines 40-47) — used by Mini Game dark header.

**Keep** the `@media (prefers-reduced-motion)` rule (lines 82-87) but update it to only reference remaining animations.

---

## المرحلة 2: الصفحة الرئيسية (/)

### 2.1 — إصلاح الـ Hero

**File:** `apps/web/src/routes/public/home-page.tsx`

#### A. Remove gradient text from h1 (line 58-61)

**Current:**
```tsx
<h1 className="mt-5 text-balance text-4xl font-black leading-[1.15] text-slate-950 sm:text-5xl lg:text-6xl">
  جاهز تبدأ؟
  <span className="mt-2 block bg-gradient-to-l from-emerald-600 via-violet-700 to-fuchsia-600 bg-clip-text text-transparent">ادخل النشاط وخليك في اللعبة.</span>
</h1>
```

**Change to:**
```tsx
<h1 className="mt-5 text-balance text-4xl font-black leading-[1.18] text-slate-950 sm:text-5xl">
  جاهز تبدأ؟
  <span className="mt-1 block text-[var(--spark-violet)]">ادخل النشاط وابدأ.</span>
</h1>
```

**Changes:** removed gradient text (absolute ban), reduced max size from `lg:text-6xl` to `sm:text-5xl`, simplified the copy, used solid color.

#### B. Remove kicker badge (lines 55-57)

**Current:**
```tsx
<p className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/90 bg-white/75 px-4 text-sm font-black text-violet-800 shadow-sm backdrop-blur">
  <span aria-hidden="true">🎮</span> مكانك للعب والتقدم
</p>
```

**Remove entirely.** Reason: uppercase tracked eyebrow appearing on every section is an AI pattern.

#### C. Improve Activity Code form button color (line 155)

**Current:** `bg-emerald-700 ... hover:bg-emerald-800` — keep this green, it's the student action color. But improve the card:

In the form wrapper (line 136), simplify the shadow:
```tsx
className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-5"
```
(Remove the backdrop-blur and complex shadow, use clean white card with normal shadow)

#### D. Simplify student code link area (lines 68-71)

**Current:**
```tsx
<div className="mt-4 flex flex-wrap items-center gap-3">
  <Link to="/student" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-violet-200 bg-white/85 px-5 text-sm font-black text-violet-900 shadow-sm hover:bg-violet-50 ...">عندي كود طالب</Link>
  <span className="text-xs font-semibold text-slate-500">كود الطالب يفتح مساحتك وتقدمك، وليس نشاطًا واحدًا فقط.</span>
</div>
```

**Keep as is** — this is clear enough and the separation between Activity Code and Student Code is important.

---

### 2.2 — تحسين الـ Mini Game

**File:** `apps/web/src/routes/public/home-page.tsx`

#### A. Remove floating decorations (lines 193-194)

**Current:**
```tsx
<div aria-hidden="true" className="spark-home-float absolute -right-2 -top-5 z-20 flex h-14 w-14 rotate-6 items-center justify-center rounded-2xl bg-amber-300 text-2xl shadow-lg sm:-right-6">⭐</div>
<div aria-hidden="true" className="spark-home-float-delayed absolute -bottom-4 -left-2 z-20 flex h-12 w-12 -rotate-6 items-center justify-center rounded-2xl bg-emerald-300 text-xl shadow-lg sm:-left-5">⚡</div>
```

**Remove both lines entirely.** These are the floating decorations the user explicitly complained about.

#### B. Mini Game option buttons — add hover transition

In the options button (line 225), the existing styles are adequate. Keep the emerald/amber feedback colors — they provide clear right/wrong signals.

---

### 2.3 — تحسين Student Moments Cards

**File:** `apps/web/src/routes/public/home-page.tsx`

#### A. Remove section kicker (line 79)

**Current:**
```tsx
<p className="text-xs font-black tracking-[0.12em] text-violet-700">داخل English Spark</p>
```

**Remove this line.** The h2 title is sufficient.

#### B. Add hover effect to cards (line 85)

**Current card classes:**
```
rounded-[1.5rem] border border-white/90 bg-white/74 p-5 shadow-[0_16px_45px_rgb(76_29_149/0.07)] backdrop-blur-xl
```

**Change to:**
```
rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-lg
```

Cleaner card style with hover feedback instead of backdrop-blur glassmorphism.

#### C. Improve icon containers (line 86)

**Current:**
```tsx
<span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-2xl">{icon}</span>
```

**Keep emojis for now** — they work as functional icons. The font change to Cairo will already improve how they sit with the text.

---

### 2.4 — الـ CTA Section (Dark banner)

**File:** `apps/web/src/routes/public/home-page.tsx` (lines 94-103)

**Current** is already the best section visually. Small improvements:

Change rounded value (line 94):
```
rounded-[2rem]  →  rounded-2xl
```

Add hover to the button (line 101):
```tsx
className="inline-flex min-h-13 items-center justify-center rounded-xl bg-white px-6 text-sm font-black text-slate-950 shadow-sm transition-shadow hover:shadow-lg hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300"
```

---

## المرحلة 3: الصفحات العامة

### 3.1 — صفحة `/teachers`

**File:** `apps/web/src/routes/public/teachers-page.tsx`

#### A. Remove kicker (line 51)
```tsx
<p className="text-sm font-black text-violet-700">English Spark Studio</p>
```
**Remove.** The h1 speaks for itself.

#### B. Remove numbered markers from dark card (lines 64-67)

**Current:** Steps with '01', '02', '03', '04'

**Change** the step rendering to remove numbers. Replace:
```tsx
<span dir="ltr" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 font-mono text-xs font-black text-violet-200">{number}</span>
```
with a simple dot/dash marker:
```tsx
<span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400/60" />
```

And update the data array to remove number strings.

#### C. Remove second section kicker (line 81)
```tsx
<p className="text-xs font-black tracking-[0.12em] text-violet-700">المشكلة أولًا</p>
```
**Remove.**

#### D. Workflow card emoji icons (line 88)
Keep emojis for now — they're functional, and Cairo font will improve the surrounding text.

---

### 3.2 — صفحة Signup

**File:** `apps/web/src/routes/auth/signup-page.tsx`

**Current:** Plain white card with basic form — much weaker than Login page.

**Upgrade to match Login layout:** Wrap in a two-column grid like login-page.tsx:

```tsx
return (
  <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-[0_28px_80px_rgb(76_29_149/0.12)] lg:grid-cols-[0.9fr_1.1fr]">
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-violet-800 via-indigo-800 to-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-center">
      <span aria-hidden="true" className="absolute -left-20 -top-16 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <span aria-hidden="true" className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" />
      <div className="relative">
        <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black text-amber-200">ENGLISH SPARK</span>
        <h2 className="mt-6 text-4xl font-black leading-tight">ابدأ رحلتك<br />في دقائق.</h2>
        <p className="mt-4 max-w-md text-base leading-8 text-violet-100">أنشئ مساحتك التعليمية، ابنِ أول نشاط، وشاركه مع طلابك مباشرة. كل شيء جاهز من أول خطوة.</p>
      </div>
    </aside>
    <section className="p-5 sm:p-8 lg:p-10">
      {/* existing form content here — keep all form logic unchanged */}
    </section>
  </div>
);
```

Also replace `sky-700` links with `violet-700` for consistency:
- Line 63: `text-sky-700` → `text-violet-700`
- Line 143: `text-sky-700` → `text-violet-700`  
- Line 151: `text-sky-700` → `text-violet-700`

---

### 3.3 — Student Join + Portal pages

**Files:** 
- `apps/web/src/routes/public/student-join-page.tsx`
- `apps/web/src/routes/student/student-portal-login-page.tsx`

After StudentBackdrop cleanup (Step 1.3), these pages will automatically look cleaner. No additional changes needed — the form cards themselves are already well-structured.

---

## المرحلة 4: Dashboard Polish

### 4.1 — Root Layout sidebar brand

**File:** `apps/web/src/components/layout/root-layout.tsx`

#### A. Remove "LEARN • PLAY • EXPLORE" tagline (line 184)

**Current:**
```tsx
<span className="block text-[9px] font-bold tracking-[0.19em] text-violet-600">LEARN • PLAY • EXPLORE</span>
```

**Remove.** "English Spark" alone is sufficient in the sidebar context.

---

## ملخص الملفات المطلوب تعديلها

| # | File | Changes |
|---|------|---------|
| 1 | `apps/web/src/index.css` | Font family → Cairo |
| 2 | `apps/web/src/studio-ui.css` | Remove duplicate font-family |
| 3 | `apps/web/src/routes/public/home-page.css` | Simplify gradients, remove float animations |
| 4 | `apps/web/src/routes/public/home-page.tsx` | Hero, Mini Game decorations, Cards, CTA |
| 5 | `apps/web/src/routes/play/student-ui.tsx` | Replace StudentBackdrop SVG |
| 6 | `apps/web/src/routes/public/teachers-page.tsx` | Remove kickers, numbered markers |
| 7 | `apps/web/src/routes/auth/signup-page.tsx` | Two-column layout + color unification |
| 8 | `apps/web/src/components/layout/root-layout.tsx` | Remove sidebar tagline |

**Total: 8 files, all in `apps/web/src/`**

---

## خطة التحقق

### بعد كل مرحلة:
```bash
cd apps/web
npm run typecheck
npm run lint
npm run test
npm run build
```

### بعد الانتهاء الكامل:
1. تشغيل dev server: `npm run dev`
2. فحص بصري لكل صفحة (desktop + mobile):
   - `/` — Homepage
   - `/teachers` — Teachers page  
   - `/join` — Quick Join
   - `/student` — Student Portal
   - `/auth/login` — Login
   - `/auth/signup` — Signup
3. التأكد من:
   - خط Cairo ظاهر على كل النصوص العربية
   - RTL صحيح
   - لا horizontal overflow
   - Focus states واضحة
   - Reduced motion يشتغل
4. Commit: `feat(web): visual polish — Cairo font, unified palette, cleaner surfaces`

---

## ما لا يجب تعديله

- **Backend** (`backend/` directory) — لا تلمسه أبداً
- **Router** (`apps/web/src/app/router.tsx`) — لا تغير routes
- **API client** (`apps/web/src/data/api-client/`) — لا تعدل endpoints
- **Business logic** in any component — لا تغير state management أو API calls
- **Test assertions** — إلا لو test يتحقق من نص UI تحديداً تغيّر (مثلاً لو test بيدور على "داخل English Spark" اللي حذفناها)
