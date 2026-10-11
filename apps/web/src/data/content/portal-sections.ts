import type { PortalSection } from './types';
import { grammarTopics } from './grammar';
import { readingPassages } from './reading';
import { listeningActivities } from './listening';
import { writingPrompts } from './writing';
import { portalCompetitions } from './competitions';

export const portalSections: PortalSection[] = [
  {
    id: 'grammar',
    titleAr: 'القواعد',
    titleEn: 'Grammar',
    description: 'تعلم قواعد اللغة الإنجليزية الأساسية مع بطاقات شرح وتمارين تفاعلية',
    icon: 'book-open',
    color: 'from-violet-600 to-indigo-700',
    path: '/grammar',
    count: grammarTopics.length,
  },
  {
    id: 'reading',
    titleAr: 'القراءة',
    titleEn: 'Reading',
    description: 'اقرأ نصوصاً إنجليزية قصيرة وأجب على أسئلة الفهم التفاعلية',
    icon: 'book-text',
    color: 'from-sky-500 to-blue-600',
    path: '/reading',
    count: readingPassages.length,
  },
  {
    id: 'listening',
    titleAr: 'الاستماع',
    titleEn: 'Listening',
    description: 'استمع لمقاطع إنجليزية وطوّر مهارة الفهم السمعي',
    icon: 'headphones',
    color: 'from-purple-600 to-pink-600',
    path: '/listening',
    count: listeningActivities.length,
  },
  {
    id: 'writing',
    titleAr: 'الكتابة',
    titleEn: 'Writing',
    description: 'تدرّب على ترتيب الجمل وتصحيح الأخطاء وكتابة الفقرات مع نموذج إجابة وتصحيح تفاعلي',
    icon: 'pen-line',
    color: 'from-emerald-600 to-teal-700',
    path: '/writing',
    count: writingPrompts.length,
  },
  {
    id: 'speaking',
    titleAr: 'المحادثة',
    titleEn: 'Speaking',
    description: 'تدرب على النطق والمحادثة مع أنشطة تفاعلية خارجية ومخطط الأصوات',
    icon: 'mic',
    color: 'from-amber-500 to-orange-600',
    path: '/speaking',
  },
  {
    id: 'competitions',
    titleAr: 'المسابقات',
    titleEn: 'Competitions',
    description: 'مسابقة المليون، تحديد المستوى، وتحدي السرعة 60 ثانية — تنافس واختبر معلوماتك',
    icon: 'trophy',
    color: 'from-amber-500 to-yellow-600',
    path: '/competitions',
    count: portalCompetitions.length,
  },
  {
    id: 'guestbook',
    titleAr: 'سجل الزوار',
    titleEn: 'Guestbook',
    description: 'شاركنا رأيك وكلمتك التشجيعية عن المنصة ومبادرة إنتاج معرفي',
    icon: 'message-square-heart',
    color: 'from-rose-500 to-fuchsia-600',
    path: '/guestbook',
  },
];
