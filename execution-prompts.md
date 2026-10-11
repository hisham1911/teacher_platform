# 📋 برومتات تنفيذ English Spark — 5 برومتات جاهزة للنسخ

> [!IMPORTANT]
> نفّذ هذه البرومتات **بالترتيب** (1 → 2 → 3 → 4 → 5). كل برومت يعتمد على الذي قبله.
> انسخ كل برومت كاملاً والصقه في الموديل.

---

## البرومت 1: التأسيس (بنية البيانات + نقل الصور + الراوتات)

````
أنت تعمل على مشروع React 19 + Vite + TypeScript في المسار f:\teacher\apps\web.
المشروع يستخدم Tailwind CSS 4 والخط Cairo. الاتجاه RTL.

المطلوب: إنشاء بنية البيانات الثابتة للمحتوى التعليمي، ونقل صور القواعد، وتسجيل الراوتات الجديدة.

=== الخطوة 1: إنشاء مجلد المحتوى وملفات البيانات ===

أنشئ الملف: apps/web/src/data/content/types.ts
```typescript
/** أنواع المحتوى التعليمي المشتركة */

export interface QuizOption {
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  hint?: string;
  options: QuizOption[];
}

export interface GrammarTopic {
  slug: string;
  titleEn: string;
  titleAr: string;
  description: string;
  imageUrl: string;
  videoUrl?: string; // YouTube embed URL
  questions: QuizQuestion[];
}

export interface ReadingPassage {
  slug: string;
  titleEn: string;
  titleAr: string;
  level: 'easy' | 'medium' | 'hard';
  text: string;
  questions: QuizQuestion[];
}

export interface ListeningActivity {
  slug: string;
  titleEn: string;
  titleAr: string;
  level: 'easy' | 'medium' | 'hard';
  mediaUrl: string; // YouTube embed URL
  questions: QuizQuestion[];
}

export interface SpeakingActivity {
  slug: string;
  titleEn: string;
  titleAr: string;
  description: string;
  externalUrl: string; // رابط خارجي مثل engnovate
}

export interface ChallengeQuestion {
  id: string;
  level: number; // 1-15
  prompt: string;
  options: QuizOption[];
  points: number;
}

export type PortalSection = {
  id: string;
  titleAr: string;
  titleEn: string;
  description: string;
  icon: string;
  color: string;
  path: string;
  count?: number;
};
```

أنشئ الملف: apps/web/src/data/content/grammar.ts
```typescript
import type { GrammarTopic } from './types';

export const grammarTopics: GrammarTopic[] = [
  {
    slug: 'present-simple',
    titleEn: 'Present Simple',
    titleAr: 'المضارع البسيط',
    description: 'يستخدم للتحدث عن عادات وتكرار',
    imageUrl: '/content/grammar/present-simple.jpg',
    videoUrl: '', // سيُضاف لاحقاً بعد رفع الفيديو على YouTube
    questions: [
      {
        id: 'ps-1',
        prompt: 'She ___ to school every day.',
        hint: 'نضيف s مع he/she/it',
        options: [
          { text: 'goes', isCorrect: true },
          { text: 'go', isCorrect: false },
          { text: 'going', isCorrect: false },
          { text: 'gone', isCorrect: false },
        ],
      },
      {
        id: 'ps-2',
        prompt: 'They ___ football on Fridays.',
        hint: 'مع they لا نضيف s',
        options: [
          { text: 'play', isCorrect: true },
          { text: 'plays', isCorrect: false },
          { text: 'playing', isCorrect: false },
          { text: 'played', isCorrect: false },
        ],
      },
      {
        id: 'ps-3',
        prompt: 'He ___ not like spicy food.',
        hint: 'النفي مع he/she/it يستخدم does not',
        options: [
          { text: 'does', isCorrect: true },
          { text: 'do', isCorrect: false },
          { text: 'is', isCorrect: false },
          { text: 'has', isCorrect: false },
        ],
      },
      {
        id: 'ps-4',
        prompt: '___ you live here?',
        hint: 'السؤال مع you يستخدم Do',
        options: [
          { text: 'Do', isCorrect: true },
          { text: 'Does', isCorrect: false },
          { text: 'Is', isCorrect: false },
          { text: 'Are', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'present-progressive',
    titleEn: 'Present Progressive',
    titleAr: 'المضارع المستمر',
    description: 'يستخدم للتحدث عما يحدث الآن',
    imageUrl: '/content/grammar/present-progressive.jpg',
    videoUrl: '',
    questions: [],
  },
  {
    slug: 'present-perfect',
    titleEn: 'Present Perfect',
    titleAr: 'المضارع التام',
    description: 'يستخدم للتحدث عن تجارب وأحداث بدأت في الماضي ولها علاقة بالحاضر',
    imageUrl: '/content/grammar/present-perfect.jpg',
    videoUrl: '',
    questions: [],
  },
  {
    slug: 'past-simple',
    titleEn: 'Past Simple',
    titleAr: 'الماضي البسيط',
    description: 'يستخدم للتحدث عن أحداث انتهت في الماضي',
    imageUrl: '/content/grammar/past-simple.jpg',
    videoUrl: '',
    questions: [],
  },
  {
    slug: 'past-progressive',
    titleEn: 'Past Progressive',
    titleAr: 'الماضي المستمر',
    description: 'يستخدم للتحدث عن حدث كان مستمراً في لحظة معينة في الماضي',
    imageUrl: '/content/grammar/past-progressive.jpg',
    videoUrl: '',
    questions: [],
  },
  {
    slug: 'past-perfect',
    titleEn: 'Past Perfect',
    titleAr: 'الماضي التام',
    description: 'يستخدم للتحدث عن حدث وقع قبل حدث آخر في الماضي',
    imageUrl: '/content/grammar/past-perfect.jpg',
    videoUrl: '',
    questions: [],
  },
  {
    slug: 'simple-future',
    titleEn: 'Simple Future',
    titleAr: 'المستقبل البسيط',
    description: 'يستخدم للتحدث عن خطط وتوقعات مستقبلية',
    imageUrl: '/content/grammar/simple-future.jpg',
    videoUrl: '',
    questions: [],
  },
  {
    slug: 'future-progressive',
    titleEn: 'Future Progressive',
    titleAr: 'المستقبل المستمر',
    description: 'يستخدم للتحدث عن حدث سيكون مستمراً في وقت معين في المستقبل',
    imageUrl: '/content/grammar/future-progressive.jpg',
    videoUrl: '',
    questions: [],
  },
  {
    slug: 'future-perfect',
    titleEn: 'Future Perfect',
    titleAr: 'المستقبل التام',
    description: 'يستخدم للتحدث عن حدث سيكتمل قبل وقت معين في المستقبل',
    imageUrl: '/content/grammar/future-perfect.jpg',
    videoUrl: '',
    questions: [],
  },
];
```

أنشئ الملف: apps/web/src/data/content/reading.ts
```typescript
import type { ReadingPassage } from './types';

export const readingPassages: ReadingPassage[] = [
  {
    slug: 'my-daily-routine',
    titleEn: 'My Daily Routine',
    titleAr: 'روتيني اليومي',
    level: 'easy',
    text: `Every morning, I wake up at 6:30 AM. First, I brush my teeth and wash my face. Then, I have breakfast with my family. I usually eat bread with cheese and drink milk.

At 7:30, I go to school by bus. My school starts at 8:00 AM. I study many subjects like English, Math, and Science. My favorite subject is English because I love learning new words.

After school, I come home at 2:00 PM. I eat lunch and then rest for an hour. In the evening, I do my homework and read a book before I go to sleep at 10:00 PM.`,
    questions: [
      {
        id: 'dr-1',
        prompt: 'What time does the writer wake up?',
        options: [
          { text: '6:30 AM', isCorrect: true },
          { text: '7:30 AM', isCorrect: false },
          { text: '8:00 AM', isCorrect: false },
          { text: '10:00 PM', isCorrect: false },
        ],
      },
      {
        id: 'dr-2',
        prompt: 'How does the writer go to school?',
        options: [
          { text: 'By bus', isCorrect: true },
          { text: 'By car', isCorrect: false },
          { text: 'On foot', isCorrect: false },
          { text: 'By bicycle', isCorrect: false },
        ],
      },
      {
        id: 'dr-3',
        prompt: 'What is the writer\'s favorite subject?',
        options: [
          { text: 'English', isCorrect: true },
          { text: 'Math', isCorrect: false },
          { text: 'Science', isCorrect: false },
          { text: 'Arabic', isCorrect: false },
        ],
      },
      {
        id: 'dr-4',
        prompt: 'What does the writer do before sleeping?',
        options: [
          { text: 'Does homework and reads a book', isCorrect: true },
          { text: 'Watches TV', isCorrect: false },
          { text: 'Plays games', isCorrect: false },
          { text: 'Eats dinner', isCorrect: false },
        ],
      },
    ],
  },
];
```

أنشئ الملف: apps/web/src/data/content/listening.ts
```typescript
import type { ListeningActivity } from './types';

export const listeningActivities: ListeningActivity[] = [
  {
    slug: 'introducing-yourself',
    titleEn: 'Introducing Yourself',
    titleAr: 'تقديم نفسك',
    level: 'easy',
    mediaUrl: '', // سيُضاف لاحقاً — رابط YouTube
    questions: [
      {
        id: 'li-1',
        prompt: 'What is the common first question when meeting someone?',
        options: [
          { text: 'What is your name?', isCorrect: true },
          { text: 'How old are you?', isCorrect: false },
          { text: 'Where do you work?', isCorrect: false },
          { text: 'Do you like coffee?', isCorrect: false },
        ],
      },
      {
        id: 'li-2',
        prompt: 'How do you respond to "Nice to meet you"?',
        options: [
          { text: 'Nice to meet you too', isCorrect: true },
          { text: 'Thank you', isCorrect: false },
          { text: 'I am fine', isCorrect: false },
          { text: 'Goodbye', isCorrect: false },
        ],
      },
      {
        id: 'li-3',
        prompt: '"I am FROM Saudi Arabia" — what does FROM mean here?',
        options: [
          { text: 'من (مكان الأصل)', isCorrect: true },
          { text: 'إلى', isCorrect: false },
          { text: 'في', isCorrect: false },
          { text: 'عند', isCorrect: false },
        ],
      },
    ],
  },
];
```

أنشئ الملف: apps/web/src/data/content/challenge.ts
```typescript
import type { ChallengeQuestion } from './types';

export const challengeQuestions: ChallengeQuestion[] = [
  { id: 'cq-1', level: 1, points: 100, prompt: 'What does "Hello" mean in Arabic?', options: [{ text: 'مرحباً', isCorrect: true }, { text: 'وداعاً', isCorrect: false }, { text: 'شكراً', isCorrect: false }, { text: 'عفواً', isCorrect: false }] },
  { id: 'cq-2', level: 2, points: 200, prompt: 'Which word is a color?', options: [{ text: 'Blue', isCorrect: true }, { text: 'Table', isCorrect: false }, { text: 'Run', isCorrect: false }, { text: 'Happy', isCorrect: false }] },
  { id: 'cq-3', level: 3, points: 300, prompt: '"Book" means ___', options: [{ text: 'كتاب', isCorrect: true }, { text: 'قلم', isCorrect: false }, { text: 'باب', isCorrect: false }, { text: 'كرسي', isCorrect: false }] },
  { id: 'cq-4', level: 4, points: 500, prompt: 'I ___ a student.', options: [{ text: 'am', isCorrect: true }, { text: 'is', isCorrect: false }, { text: 'are', isCorrect: false }, { text: 'be', isCorrect: false }] },
  { id: 'cq-5', level: 5, points: 1000, prompt: 'She ___ to school every day.', options: [{ text: 'goes', isCorrect: true }, { text: 'go', isCorrect: false }, { text: 'going', isCorrect: false }, { text: 'gone', isCorrect: false }] },
  { id: 'cq-6', level: 6, points: 2000, prompt: 'What is the past tense of "eat"?', options: [{ text: 'ate', isCorrect: true }, { text: 'eated', isCorrect: false }, { text: 'eating', isCorrect: false }, { text: 'eaten', isCorrect: false }] },
  { id: 'cq-7', level: 7, points: 4000, prompt: 'Choose the correct sentence:', options: [{ text: 'He doesn\'t like coffee.', isCorrect: true }, { text: 'He don\'t like coffee.', isCorrect: false }, { text: 'He not like coffee.', isCorrect: false }, { text: 'He no like coffee.', isCorrect: false }] },
  { id: 'cq-8', level: 8, points: 8000, prompt: 'I have been studying English ___ two years.', options: [{ text: 'for', isCorrect: true }, { text: 'since', isCorrect: false }, { text: 'from', isCorrect: false }, { text: 'during', isCorrect: false }] },
  { id: 'cq-9', level: 9, points: 16000, prompt: 'If I ___ rich, I would travel the world.', options: [{ text: 'were', isCorrect: true }, { text: 'am', isCorrect: false }, { text: 'was', isCorrect: false }, { text: 'will be', isCorrect: false }] },
  { id: 'cq-10', level: 10, points: 32000, prompt: 'The book ___ by the student yesterday.', options: [{ text: 'was read', isCorrect: true }, { text: 'is read', isCorrect: false }, { text: 'read', isCorrect: false }, { text: 'has read', isCorrect: false }] },
  { id: 'cq-11', level: 11, points: 64000, prompt: 'Which is correct? "I look forward ___"', options: [{ text: 'to hearing from you', isCorrect: true }, { text: 'to hear from you', isCorrect: false }, { text: 'hearing from you', isCorrect: false }, { text: 'for hearing from you', isCorrect: false }] },
  { id: 'cq-12', level: 12, points: 125000, prompt: 'She asked me where I ___', options: [{ text: 'lived', isCorrect: true }, { text: 'live', isCorrect: false }, { text: 'living', isCorrect: false }, { text: 'am live', isCorrect: false }] },
  { id: 'cq-13', level: 13, points: 250000, prompt: 'Not only ___ intelligent, but also hardworking.', options: [{ text: 'is she', isCorrect: true }, { text: 'she is', isCorrect: false }, { text: 'she', isCorrect: false }, { text: 'does she', isCorrect: false }] },
  { id: 'cq-14', level: 14, points: 500000, prompt: 'Had I known earlier, I ___ differently.', options: [{ text: 'would have acted', isCorrect: true }, { text: 'will act', isCorrect: false }, { text: 'would act', isCorrect: false }, { text: 'acted', isCorrect: false }] },
  { id: 'cq-15', level: 15, points: 1000000, prompt: 'The phenomenon ___ scientists for decades.', options: [{ text: 'has baffled', isCorrect: true }, { text: 'have baffled', isCorrect: false }, { text: 'baffling', isCorrect: false }, { text: 'was baffled', isCorrect: false }] },
];
```

أنشئ الملف: apps/web/src/data/content/portal-sections.ts
```typescript
import type { PortalSection } from './types';
import { grammarTopics } from './grammar';
import { readingPassages } from './reading';
import { listeningActivities } from './listening';

export const portalSections: PortalSection[] = [
  { id: 'grammar', titleAr: 'القواعد', titleEn: 'Grammar', description: 'تعلم قواعد اللغة الإنجليزية الأساسية مع أمثلة وتمارين تفاعلية', icon: '📝', color: 'from-violet-500 to-purple-700', path: '/grammar', count: grammarTopics.length },
  { id: 'reading', titleAr: 'القراءة', titleEn: 'Reading', description: 'اقرأ نصوصاً إنجليزية وأجب على أسئلة الفهم', icon: '📖', color: 'from-emerald-500 to-teal-700', path: '/reading', count: readingPassages.length },
  { id: 'listening', titleAr: 'الاستماع', titleEn: 'Listening', description: 'استمع وطوّر مهارة الفهم السمعي', icon: '🎧', color: 'from-sky-500 to-blue-700', path: '/listening', count: listeningActivities.length },
  { id: 'speaking', titleAr: 'المحادثة', titleEn: 'Speaking', description: 'تدرب على النطق والمحادثة اليومية', icon: '🗣️', color: 'from-amber-500 to-orange-700', path: '/speaking' },
  { id: 'challenge', titleAr: 'مسابقة المليون', titleEn: 'Million Challenge', description: '15 سؤال متدرج — هل تستطيع الوصول للمليون؟', icon: '🏆', color: 'from-yellow-500 to-amber-700', path: '/challenge' },
  { id: 'guestbook', titleAr: 'سجل الزوار', titleEn: 'Guestbook', description: 'اترك تعليقك ورأيك في المنصة', icon: '💬', color: 'from-pink-500 to-rose-700', path: '/guestbook' },
];
```

=== الخطوة 2: نقل الصور وتسميتها ===

نفّذ الأوامر التالية في PowerShell من المسار f:\teacher:

```powershell
New-Item -ItemType Directory -Path "apps/web/public/content/grammar" -Force

Copy-Item "assets/WhatsApp Image 2026-10-10 at 12.41.04 AM (1).jpeg" "apps/web/public/content/grammar/present-simple.jpg"
Copy-Item "assets/WhatsApp Image 2026-10-10 at 12.41.03 AM (2).jpeg" "apps/web/public/content/grammar/present-simple-detail.jpg"
Copy-Item "assets/WhatsApp Image 2026-10-10 at 12.41.02 AM.jpeg" "apps/web/public/content/grammar/present-progressive.jpg"
Copy-Item "assets/WhatsApp Image 2026-10-10 at 12.41.03 AM.jpeg" "apps/web/public/content/grammar/present-perfect.jpg"
Copy-Item "assets/WhatsApp Image 2026-10-10 at 12.41.03 AM (4).jpeg" "apps/web/public/content/grammar/past-simple.jpg"
Copy-Item "assets/WhatsApp Image 2026-10-10 at 12.41.02 AM (1).jpeg" "apps/web/public/content/grammar/past-progressive.jpg"
Copy-Item "assets/WhatsApp Image 2026-10-10 at 12.41.03 AM (1).jpeg" "apps/web/public/content/grammar/past-perfect.jpg"
Copy-Item "assets/WhatsApp Image 2026-10-10 at 12.41.03 AM (3).jpeg" "apps/web/public/content/grammar/simple-future.jpg"
Copy-Item "assets/WhatsApp Image 2026-10-10 at 12.41.04 AM.jpeg" "apps/web/public/content/grammar/future-simple.jpg"
Copy-Item "assets/WhatsApp Image 2026-10-10 at 12.41.02 AM (2).jpeg" "apps/web/public/content/grammar/future-progressive.jpg"
Copy-Item "assets/WhatsApp Image 2026-10-10 at 12.41.02 AM (3).jpeg" "apps/web/public/content/grammar/future-perfect.jpg"
```

=== الخطوة 3: تسجيل الراوتات الجديدة ===

عدّل الملف apps/web/src/app/router.tsx:

1. أضف هذه الـ lazy imports بعد السطر `const PlayPage = lazy(...)`:
```typescript
const PortalHomePage = lazy(() => import('../routes/portal/portal-home-page'));
const GrammarIndexPage = lazy(() => import('../routes/portal/grammar-index-page'));
const GrammarTopicPage = lazy(() => import('../routes/portal/grammar-topic-page'));
const ReadingIndexPage = lazy(() => import('../routes/portal/reading-index-page'));
const ReadingPassagePage = lazy(() => import('../routes/portal/reading-passage-page'));
const ListeningIndexPage = lazy(() => import('../routes/portal/listening-index-page'));
const ListeningActivityPage = lazy(() => import('../routes/portal/listening-activity-page'));
const SpeakingIndexPage = lazy(() => import('../routes/portal/speaking-index-page'));
const MillionChallengePage = lazy(() => import('../routes/portal/million-challenge-page'));
const GuestbookPage = lazy(() => import('../routes/portal/guestbook-page'));
```

2. داخل مصفوفة children (بعد `{ path: '/', element: <HomePage /> }`), أضف:
```typescript
      { path: '/portal', element: <PortalHomePage /> },
      { path: '/grammar', element: <GrammarIndexPage /> },
      { path: '/grammar/:topicSlug', element: <GrammarTopicPage /> },
      { path: '/reading', element: <ReadingIndexPage /> },
      { path: '/reading/:passageSlug', element: <ReadingPassagePage /> },
      { path: '/listening', element: <ListeningIndexPage /> },
      { path: '/listening/:activitySlug', element: <ListeningActivityPage /> },
      { path: '/speaking', element: <SpeakingIndexPage /> },
      { path: '/challenge', element: <MillionChallengePage /> },
      { path: '/guestbook', element: <GuestbookPage /> },
```

3. أنشئ المجلد apps/web/src/routes/portal/ وضع فيه ملف مؤقت placeholder لكل صفحة (سيُستبدل في البرومتات التالية):

أنشئ apps/web/src/routes/portal/portal-home-page.tsx:
```typescript
export default function PortalHomePage() {
  return <div className="p-8 text-center text-2xl">Portal Home — سيُبنى في البرومت 2</div>;
}
```

أنشئ نفس الشيء لكل ملف مطلوب (grammar-index-page.tsx, grammar-topic-page.tsx, reading-index-page.tsx, reading-passage-page.tsx, listening-index-page.tsx, listening-activity-page.tsx, speaking-index-page.tsx, million-challenge-page.tsx, guestbook-page.tsx) — كل ملف يحتوي export default function بنفس النمط مع رسالة placeholder مختلفة.

=== التحقق ===

بعد الانتهاء، شغّل من apps/web:
```bash
npm run typecheck
npm run build
```
يجب أن ينجح بدون أخطاء. لا تعدّل أي ملف آخر غير المذكور هنا.
````

---

## البرومت 2: البوابة الرئيسية (Portal Home Page)

````
أنت تعمل على مشروع React 19 + Vite + TypeScript في المسار f:\teacher\apps\web.
المشروع يستخدم Tailwind CSS 4 والخط Cairo. الاتجاه RTL.

المطلوب: بناء الصفحة الرئيسية الجديدة للبوابة التعليمية المفتوحة.

استبدل محتوى الملف apps/web/src/routes/portal/portal-home-page.tsx بالكود التالي بالكامل.

الصفحة تحتوي على:
1. هيدر شفاف مع شعار English Spark + شعار وزارة التعليم
2. قسم بطل (Hero) بعنوان ترحيبي
3. شبكة 6 بطاقات (كل بطاقة = قسم) — القواعد، القراءة، الاستماع، المحادثة، مسابقة المليون، سجل الزوار
4. فوتر بسيط

المكون يستورد: PublicBackdrop من '../../components/layout/root-layout' و portalSections من '../../data/content/portal-sections' و Link من 'react-router'.

```tsx
import { Link } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { portalSections } from '../../data/content/portal-sections';

export default function PortalHomePage() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden" dir="rtl">
      <PublicBackdrop />
      <div className="relative z-10">
        {/* Header */}
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="spark-brand-mark flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-xl text-white">✦</span>
            <div className="leading-none">
              <p className="text-xs font-black tracking-[0.12em] text-slate-950">ENGLISH SPARK</p>
              <p className="mt-1 text-[9px] font-bold text-violet-600">تعلم · العب · اكتشف</p>
            </div>
          </div>
          <Link to="/teachers" className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black text-violet-800 hover:bg-white/70">
            هل أنت معلم؟
          </Link>
        </header>

        {/* Hero */}
        <section className="animate-page-enter mx-auto max-w-4xl px-4 py-12 text-center sm:py-16">
          <p className="text-sm font-bold tracking-widest text-violet-600">إنتاج معرفي — مدرسة متوسطة وثانوية الجرادية</p>
          <h1 className="mt-4 text-balance text-4xl font-black leading-tight text-slate-950 sm:text-5xl md:text-6xl">
            تعلّم الإنجليزية
            <br />
            <span className="bg-gradient-to-l from-violet-700 via-fuchsia-600 to-amber-500 bg-clip-text text-transparent">بطريقة ممتعة ✦</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg font-semibold leading-8 text-slate-600">
            قواعد مبسّطة، قراءة، استماع، محادثة، واختبارات تفاعلية — كل شيء مجاني ومتاح للجميع.
          </p>
        </section>

        {/* Section Cards */}
        <section className="animate-page-enter mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-3" style={{ animationDelay: '150ms' }}>
          {portalSections.map((section) => (
            <Link
              key={section.id}
              to={section.path}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${section.color} text-2xl shadow-md`}>
                {section.icon}
              </div>
              <h3 className="text-lg font-black text-slate-900">{section.titleAr}</h3>
              <p className="mt-0.5 text-xs font-bold tracking-wider text-violet-600">{section.titleEn}</p>
              <p className="mt-2 flex-1 text-sm leading-7 text-slate-600">{section.description}</p>
              {section.count != null && section.count > 0 && (
                <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                  {section.count} {section.id === 'grammar' ? 'قاعدة' : 'نشاط'}
                </span>
              )}
              <span aria-hidden="true" className="absolute left-4 top-6 text-xl text-slate-300 transition-transform duration-300 group-hover:-translate-x-1">←</span>
            </Link>
          ))}
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200/50 bg-white/40 py-8 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold text-slate-500">English Spark — إنتاج معرفي تعليمي</p>
          <p className="mt-1 text-xs text-slate-400">مدرسة متوسطة وثانوية الجرادية — وزارة التعليم</p>
        </footer>
      </div>
    </div>
  );
}
```

ثم عدّل الملف apps/web/src/app/router.tsx:
- غيّر السطر `{ path: '/', element: <HomePage /> }` إلى `{ path: '/', element: <PortalHomePage /> }`
- أضف `{ path: '/home', element: <HomePage /> }` لتبقى الصفحة القديمة متاحة على /home

تحقق: npm run typecheck && npm run build يجب أن ينجحا.
````

---

## البرومت 3: قسم القواعد (Grammar Hub + صفحة القاعدة مع الاختبار)

````
أنت تعمل على مشروع React 19 + Vite + TypeScript في المسار f:\teacher\apps\web.
المشروع يستخدم Tailwind CSS 4 والخط Cairo. الاتجاه RTL.
المكون PublicBackdrop موجود في '../../components/layout/root-layout'.
البيانات في '../../data/content/grammar' تصدّر grammarTopics (مصفوفة GrammarTopic).

المطلوب: بناء صفحتين — فهرس القواعد وصفحة القاعدة الواحدة مع اختبار تفاعلي.

=== الملف 1: apps/web/src/routes/portal/grammar-index-page.tsx ===

صفحة فهرس تعرض جميع القواعد كبطاقات. كل بطاقة تحتوي: صورة القاعدة + العنوان + الوصف + رابط للتفصيل.

```tsx
import { Link } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { grammarTopics } from '../../data/content/grammar';

export default function GrammarIndexPage() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden" dir="rtl">
      <PublicBackdrop />
      <div className="relative z-10">
        <header className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-violet-700 hover:bg-white/70">
            → الرئيسية
          </Link>
        </header>

        <section className="animate-page-enter mx-auto max-w-4xl px-4 pt-4 pb-6 text-center">
          <span className="text-4xl">📝</span>
          <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">القواعد <span className="text-violet-600">Grammar</span></h1>
          <p className="mt-2 text-base font-semibold text-slate-500">اختر القاعدة التي تريد تعلمها</p>
        </section>

        <section className="animate-page-enter mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-3" style={{ animationDelay: '100ms' }}>
          {grammarTopics.map((topic, index) => (
            <Link
              key={topic.slug}
              to={`/grammar/${topic.slug}`}
              className="group overflow-hidden rounded-2xl border border-white/60 bg-white/85 shadow-md backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="aspect-video w-full overflow-hidden bg-gradient-to-br from-violet-100 to-sky-50">
                <img src={topic.imageUrl} alt={topic.titleEn} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
              </div>
              <div className="p-4">
                <span className="text-xs font-bold text-violet-500">#{index + 1}</span>
                <h3 className="mt-1 text-lg font-black text-slate-900">{topic.titleAr}</h3>
                <p className="text-sm font-bold text-slate-500">{topic.titleEn}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{topic.description}</p>
                {topic.questions.length > 0 && (
                  <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    ✓ {topic.questions.length} أسئلة تفاعلية
                  </span>
                )}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
```

=== الملف 2: apps/web/src/routes/portal/grammar-topic-page.tsx ===

صفحة قاعدة واحدة تحتوي: صورة القاعدة + فيديو (إن وُجد) + اختبار تفاعلي فوري.

الاختبار التفاعلي يعمل كالتالي:
- يُعرض سؤال واحد في كل مرة
- الطالب يضغط على خيار → يظهر فوراً أخضر (صح) أو أحمر (خطأ) مع التلميح
- بعد ثانية ينتقل للسؤال التالي
- في النهاية تظهر النتيجة (عدد الصح من الإجمالي)
- زر "أعد المحاولة" + زر "القاعدة التالية"
- كل الحالة في useState — لا باك إند، لا API

```tsx
import { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { grammarTopics } from '../../data/content/grammar';
import type { QuizOption } from '../../data/content/types';

export default function GrammarTopicPage() {
  const { topicSlug } = useParams<{ topicSlug: string }>();
  const topicIndex = grammarTopics.findIndex((t) => t.slug === topicSlug);
  const topic = grammarTopics[topicIndex];

  if (!topic) return <Navigate to="/grammar" replace />;

  const nextTopic = grammarTopics[topicIndex + 1];

  return (
    <div className="relative min-h-dvh overflow-x-hidden" dir="rtl">
      <PublicBackdrop />
      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-16">
        <header className="flex items-center gap-3 py-4">
          <Link to="/grammar" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-violet-700 hover:bg-white/70">→ القواعد</Link>
        </header>

        <section className="animate-page-enter">
          <h1 className="text-3xl font-black text-slate-950">{topic.titleAr}</h1>
          <p className="mt-1 text-lg font-bold text-violet-600">{topic.titleEn}</p>
          <p className="mt-2 text-base text-slate-600">{topic.description}</p>
        </section>

        {/* Grammar Card Image */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/50 bg-white/80 shadow-lg backdrop-blur-sm">
          <img src={topic.imageUrl} alt={topic.titleEn} className="w-full" />
        </div>

        {/* Video (if available) */}
        {topic.videoUrl && (
          <div className="mt-6 overflow-hidden rounded-2xl bg-black shadow-lg">
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={topic.videoUrl}
                title={topic.titleEn}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        )}

        {/* Interactive Quiz */}
        {topic.questions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-black text-slate-900">🧪 اختبر نفسك</h2>
            <p className="mt-1 text-sm text-slate-500">أجب على الأسئلة التالية لتختبر فهمك للقاعدة</p>
            <div className="mt-4">
              <InlineQuiz questions={topic.questions} />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <Link to="/grammar" className="rounded-xl border-2 border-violet-200 bg-violet-50 px-5 py-3 text-sm font-black text-violet-700 hover:bg-violet-100">
            ← كل القواعد
          </Link>
          {nextTopic && (
            <Link to={`/grammar/${nextTopic.slug}`} className="rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-black text-white shadow-md hover:shadow-lg">
              القاعدة التالية: {nextTopic.titleAr} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function InlineQuiz({ questions }: { questions: { id: string; prompt: string; hint?: string; options: QuizOption[] }[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = questions[currentIndex];

  function handleSelect(optionIndex: number) {
    if (selected !== null) return; // تم الاختيار بالفعل
    setSelected(optionIndex);
    if (question.options[optionIndex].isCorrect) {
      setScore((prev) => prev + 1);
    }
    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((prev) => prev + 1);
        setSelected(null);
      } else {
        setFinished(true);
      }
    }, 1200);
  }

  function reset() {
    setCurrentIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  }

  if (finished) {
    const percentage = Math.round((score / questions.length) * 100);
    const passed = percentage >= 75;
    return (
      <div className={`rounded-2xl border p-6 text-center shadow-md ${passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <p className="text-5xl">{passed ? '🎉' : '💪'}</p>
        <p className="mt-3 text-2xl font-black text-slate-900">{score} / {questions.length}</p>
        <p className="mt-1 text-lg font-bold text-slate-600">{percentage}%</p>
        <p className="mt-2 text-sm text-slate-500">{passed ? 'ممتاز! أنت تفهم القاعدة جيداً.' : 'حاول مرة أخرى — يمكنك التحسن!'}</p>
        <button onClick={reset} className="mt-4 rounded-xl bg-violet-600 px-6 py-3 text-sm font-black text-white shadow hover:bg-violet-700">
          أعد المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-md backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400">السؤال {currentIndex + 1} من {questions.length}</span>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">النقاط: {score}</span>
      </div>
      <p className="text-lg font-black text-slate-900" dir="ltr">{question.prompt}</p>
      {question.hint && selected !== null && (
        <p className="mt-2 rounded-lg bg-sky-50 p-2 text-sm font-semibold text-sky-800">💡 {question.hint}</p>
      )}
      <div className="mt-4 flex flex-col gap-2.5">
        {question.options.map((option, optIdx) => {
          let style = 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50';
          if (selected !== null) {
            if (option.isCorrect) style = 'border-emerald-400 bg-emerald-50 text-emerald-900';
            else if (optIdx === selected && !option.isCorrect) style = 'border-rose-400 bg-rose-50 text-rose-900';
            else style = 'border-slate-100 bg-slate-50 text-slate-400';
          }
          return (
            <button
              key={optIdx}
              onClick={() => handleSelect(optIdx)}
              disabled={selected !== null}
              className={`rounded-xl border-2 px-4 py-3 text-right text-sm font-bold transition-all ${style}`}
              dir="ltr"
            >
              {option.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

تحقق: npm run typecheck && npm run build يجب أن ينجحا.
````

---

## البرومت 4: قسم القراءة + الاستماع

````
أنت تعمل على مشروع React 19 + Vite + TypeScript في المسار f:\teacher\apps\web.
Tailwind CSS 4، خط Cairo، اتجاه RTL.
PublicBackdrop في '../../components/layout/root-layout'.
readingPassages في '../../data/content/reading'.
listeningActivities في '../../data/content/listening'.

المطلوب: بناء 4 ملفات — فهرس القراءة + صفحة قطعة + فهرس الاستماع + صفحة نشاط.

=== الملف 1: apps/web/src/routes/portal/reading-index-page.tsx ===

نفس نمط grammar-index-page لكن يعرض readingPassages. كل بطاقة تعرض العنوان + المستوى (easy/medium/hard كشارة ملونة) + عدد الأسئلة. اللون الأساسي emerald بدلاً من violet.

=== الملف 2: apps/web/src/routes/portal/reading-passage-page.tsx ===

يستخدم useParams لأخذ passageSlug. يجد القطعة من readingPassages.
الصفحة تعرض:
1. النص الإنجليزي في بطاقة بيضاء مع خط واضح (text-lg leading-8) واتجاه LTR
2. تحته قسم "أسئلة الفهم" — نفس مكون InlineQuiz من البرومت 3 (انسخه هنا أو اجعله مكون مشترك في apps/web/src/components/portal/inline-quiz.tsx)
3. رابط "→ كل القطع" وزر "القطعة التالية"

=== الملف 3: apps/web/src/routes/portal/listening-index-page.tsx ===

نفس النمط لكن يعرض listeningActivities. اللون sky/blue. كل بطاقة تعرض أيقونة 🎧 + العنوان + المستوى.

=== الملف 4: apps/web/src/routes/portal/listening-activity-page.tsx ===

يستخدم useParams. يعرض:
1. فيديو YouTube مضمّن (إن وُجد mediaUrl) أو رسالة "الفيديو سيُضاف قريباً"
2. أسئلة الفهم بنفس مكون InlineQuiz
3. روابط تنقل

=== ملف إضافي مطلوب: apps/web/src/routes/portal/speaking-index-page.tsx ===

صفحة بسيطة تعرض قائمة روابط خارجية لمواقع تدريب المحادثة:
- engnovate.com/ai-conversations/introducing-yourself
- engnovate.com/ai-conversations/describing-your-daily-routine
- engnovate.com/pronunciation-exercises

كل رابط يفتح في تبويب جديد (target="_blank" rel="noopener noreferrer"). تصميم بسيط ببطاقات.

مهم جداً: استخرج مكون InlineQuiz لملف مشترك apps/web/src/components/portal/inline-quiz.tsx واستورده في grammar-topic-page و reading-passage-page و listening-activity-page.

تحقق: npm run typecheck && npm run build يجب أن ينجحا.
````

---

## البرومت 5: مسابقة المليون + سجل الزوار

````
أنت تعمل على مشروع React 19 + Vite + TypeScript في المسار f:\teacher\apps\web.
Tailwind CSS 4، خط Cairo، اتجاه RTL.
challengeQuestions في '../../data/content/challenge' — مصفوفة 15 سؤالاً متدرجاً.

المطلوب: بناء صفحتين — مسابقة المليون المستقلة + سجل الزوار.

=== الملف 1: apps/web/src/routes/portal/million-challenge-page.tsx ===

لعبة "من سيربح المليون" تعمل بالكامل في المتصفح (لا باك إند).

التصميم:
- خلفية داكنة (نفس .challenge-shell الموجود في index.css)
- شعار English Spark في الأعلى (أبيض)
- أولاً: شاشة ترحيب — الطالب يكتب اسمه ويضغط "ابدأ التحدي"
- ثانياً: شاشة اللعب — سؤال واحد في كل مرة مع:
  - رقم المستوى (1-15) ومبلغ النقاط
  - 4 خيارات بألوان مختلفة (استخدم challenge-option-a/b/c/d CSS classes الموجودة)
  - عند الاختيار: الصحيح يتحول أخضر، الخطأ أحمر
  - إذا صح → ينتقل للسؤال التالي بعد 1.5 ثانية
  - إذا خطأ → ينتهي التحدي ويظهر المستوى الذي وصل إليه
- ثالثاً: شاشة النتيجة — "مبروك يا {الاسم}! وصلت للمستوى {X} وجمعت {النقاط} نقطة"
  - زر "أعد التحدي"
  - زر "→ الرئيسية"

State management: كله useState. لا API ولا localStorage.

```tsx
import { useState } from 'react';
import { Link } from 'react-router';
import { challengeQuestions } from '../../data/content/challenge';

type Stage = 'welcome' | 'playing' | 'result';

export default function MillionChallengePage() {
  const [stage, setStage] = useState<Stage>('welcome');
  const [name, setName] = useState('');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [finalLevel, setFinalLevel] = useState(0);

  const question = challengeQuestions[currentLevel];
  const OPTION_COLORS = [
    'bg-blue-600 hover:bg-blue-500 border-blue-400',
    'bg-orange-600 hover:bg-orange-500 border-orange-400',
    'bg-green-600 hover:bg-green-500 border-green-400',
    'bg-pink-600 hover:bg-pink-500 border-pink-400',
  ];

  function handleStart() {
    if (name.trim().length < 2) return;
    setStage('playing');
    setCurrentLevel(0);
    setSelected(null);
    setTotalPoints(0);
  }

  function handleSelect(optIdx: number) {
    if (selected !== null) return;
    setSelected(optIdx);
    const correct = question.options[optIdx].isCorrect;
    setTimeout(() => {
      if (correct) {
        const newPoints = totalPoints + question.points;
        setTotalPoints(newPoints);
        if (currentLevel + 1 < challengeQuestions.length) {
          setCurrentLevel((prev) => prev + 1);
          setSelected(null);
        } else {
          setFinalLevel(15);
          setStage('result');
        }
      } else {
        setFinalLevel(currentLevel);
        setStage('result');
      }
    }, 1500);
  }

  function handleRestart() {
    setStage('welcome');
    setName('');
    setCurrentLevel(0);
    setSelected(null);
    setTotalPoints(0);
    setFinalLevel(0);
  }

  return (
    <div className="challenge-shell flex min-h-dvh flex-col items-center justify-center px-4 py-8" dir="rtl">
      {/* Brand */}
      <div className="mb-6 flex items-center gap-2.5 text-center">
        <span className="spark-brand-mark flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-lg text-white">✦</span>
        <div className="leading-none">
          <p className="text-xs font-black tracking-[0.12em] text-white">ENGLISH SPARK</p>
          <p className="mt-1 text-[9px] font-bold text-sky-200">تعلم · العب · اكتشف</p>
        </div>
      </div>

      {stage === 'welcome' && (
        <div className="challenge-panel challenge-enter w-full max-w-lg p-6 text-center sm:p-10">
          <p className="text-xs font-black tracking-[0.2em] text-[var(--challenge-accent)]">MILLION CHALLENGE</p>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">مسابقة المليون 🏆</h1>
          <p className="mt-4 text-sm font-semibold leading-7 text-sky-100">15 سؤال متدرج الصعوبة. الإجابة الصحيحة تنقلك للمستوى التالي والخطأ ينهي التحدي. هل أنت مستعد؟</p>
          <div className="mt-6">
            <input
              type="text"
              placeholder="اكتب اسمك هنا"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-center text-lg font-bold text-white placeholder-white/40 outline-none ring-2 ring-white/20 focus:ring-[var(--challenge-accent)]"
              maxLength={30}
            />
          </div>
          <button
            onClick={handleStart}
            disabled={name.trim().length < 2}
            className="mt-5 w-full rounded-2xl bg-[var(--challenge-accent)] px-8 py-4 text-base font-black text-slate-950 transition-transform hover:brightness-110 active:translate-y-px disabled:opacity-50"
          >
            ابدأ التحدي
          </button>
          <Link to="/" className="mt-4 inline-block text-sm font-bold text-sky-300 hover:text-white">→ الرئيسية</Link>
        </div>
      )}

      {stage === 'playing' && question && (
        <div className="challenge-enter w-full max-w-2xl">
          <div className="mb-6 flex items-center justify-between text-sm font-bold text-sky-200">
            <span>المستوى {question.level} / 15</span>
            <span className="rounded-full bg-white/10 px-4 py-1.5 text-[var(--challenge-accent)]">{question.points.toLocaleString()} نقطة</span>
          </div>
          <div className="challenge-panel p-6 sm:p-8">
            <p className="text-center text-xl font-black text-white sm:text-2xl" dir="ltr">{question.prompt}</p>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {question.options.map((opt, idx) => {
              let extraStyle = '';
              if (selected !== null) {
                if (opt.isCorrect) extraStyle = '!bg-emerald-600 !border-emerald-400 ring-2 ring-emerald-300';
                else if (idx === selected && !opt.isCorrect) extraStyle = '!bg-rose-600 !border-rose-400 ring-2 ring-rose-300';
                else extraStyle = 'opacity-40';
              }
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={selected !== null}
                  className={`rounded-xl border-2 px-4 py-4 text-base font-bold text-white transition-all ${OPTION_COLORS[idx]} ${extraStyle}`}
                  dir="ltr"
                >
                  {opt.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stage === 'result' && (
        <div className="challenge-panel challenge-enter w-full max-w-lg p-6 text-center sm:p-10">
          <p className="text-5xl">{finalLevel >= 15 ? '👑' : finalLevel >= 10 ? '🌟' : finalLevel >= 5 ? '💪' : '📚'}</p>
          <h2 className="mt-4 text-2xl font-black text-white">
            {finalLevel >= 15 ? `مبروك يا ${name}! ربحت المليون!` : `أحسنت يا ${name}!`}
          </h2>
          <p className="mt-2 text-lg font-bold text-sky-200">وصلت للمستوى {finalLevel} من 15</p>
          <p className="mt-1 text-2xl font-black text-[var(--challenge-accent)]">{totalPoints.toLocaleString()} نقطة</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={handleRestart} className="rounded-xl bg-[var(--challenge-accent)] px-6 py-3 text-sm font-black text-slate-950 hover:brightness-110">أعد التحدي</button>
            <Link to="/" className="rounded-xl border-2 border-white/20 px-6 py-3 text-sm font-black text-white hover:bg-white/10">→ الرئيسية</Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

=== الملف 2: apps/web/src/routes/portal/guestbook-page.tsx ===

صفحة تعليقات بسيطة. مبدئياً تعمل بـ localStorage فقط (بدون باك إند) حتى نربطها لاحقاً.

```tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';

interface GuestEntry {
  id: string;
  name: string;
  message: string;
  date: string;
}

const STORAGE_KEY = 'english-spark-guestbook';

function loadEntries(): GuestEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveEntries(entries: GuestEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function GuestbookPage() {
  const [entries, setEntries] = useState<GuestEntry[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { setEntries(loadEntries()); }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || message.trim().length < 3) return;
    const entry: GuestEntry = {
      id: Date.now().toString(),
      name: name.trim(),
      message: message.trim(),
      date: new Date().toLocaleDateString('ar-SA'),
    };
    const updated = [entry, ...entries].slice(0, 50);
    setEntries(updated);
    saveEntries(updated);
    setName('');
    setMessage('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden" dir="rtl">
      <PublicBackdrop />
      <div className="relative z-10 mx-auto max-w-2xl px-4 pb-16">
        <header className="flex items-center gap-3 py-4">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-violet-700 hover:bg-white/70">→ الرئيسية</Link>
        </header>

        <section className="animate-page-enter text-center">
          <span className="text-4xl">💬</span>
          <h1 className="mt-3 text-3xl font-black text-slate-950">سجل الزوار</h1>
          <p className="mt-2 text-sm text-slate-500">اترك تعليقك أو رسالتك هنا</p>
        </section>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-white/60 bg-white/85 p-5 shadow-md backdrop-blur-sm">
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="اسمك (طالب، ولي أمر، زائر...)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              minLength={2}
              className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-violet-400"
            />
            <textarea
              placeholder="اكتب تعليقك أو رسالتك هنا..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={300}
              required
              minLength={3}
              rows={3}
              className="resize-none rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-violet-400"
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-black text-white shadow-md hover:shadow-lg"
            >
              أرسل التعليق
            </button>
          </div>
          {submitted && (
            <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700">✅ تم إرسال تعليقك بنجاح!</p>
          )}
        </form>

        {/* Entries */}
        <div className="mt-8 flex flex-col gap-3">
          {entries.length === 0 && <p className="text-center text-sm text-slate-400">لا توجد تعليقات بعد. كن أول من يعلّق!</p>}
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-white/50 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-900">{entry.name}</span>
                <span className="text-xs text-slate-400">{entry.date}</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{entry.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

تحقق النهائي: npm run typecheck && npm run build يجب أن ينجحا.
بعد نجاح البناء، شغّل npm run dev وافتح http://localhost:5173/ وتأكد أن البوابة تظهر بالأقسام الستة وكل قسم يعمل.
````
