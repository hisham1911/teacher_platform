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
    icon: 'G',
    color: 'from-violet-600 to-violet-800',
    path: '/grammar',
    count: grammarTopics.length,
  },
  {
    id: 'reading',
    titleAr: 'القراءة',
    titleEn: 'Reading',
    description: 'اقرأ نصوصاً إنجليزية قصيرة وأجب على أسئلة الفهم التفاعلية',
    icon: 'R',
    color: 'from-violet-500 to-violet-700',
    path: '/reading',
    count: readingPassages.length,
  },
  {
    id: 'listening',
    titleAr: 'الاستماع',
    titleEn: 'Listening',
    description: 'استمع لمقاطع إنجليزية وطوّر مهارة الفهم السمعي',
    icon: 'L',
    color: 'from-violet-500 to-violet-700',
    path: '/listening',
    count: listeningActivities.length,
  },
  {
    id: 'writing',
    titleAr: 'الكتابة',
    titleEn: 'Writing',
    description: 'تدرّب على ترتيب الجمل وتصحيح الأخطاء وكتابة الفقرات مع نموذج إجابة وتصحيح تفاعلي',
    icon: 'W',
    color: 'from-emerald-600 to-teal-800',
    path: '/writing',
    count: writingPrompts.length,
  },
  {
    id: 'speaking',
    titleAr: 'المحادثة',
    titleEn: 'Speaking',
    description: 'تدرب على النطق والمحادثة مع أنشطة تفاعلية خارجية',
    icon: 'S',
    color: 'from-amber-500 to-amber-700',
    path: '/speaking',
  },
  {
    id: 'competitions',
    titleAr: 'المسابقات',
    titleEn: 'Competitions',
    description: 'مسابقة المليون، تحديد المستوى، وتحدي السرعة 60 ثانية — تنافس واختبر معلوماتك',
    icon: '★',
    color: 'from-amber-500 to-amber-700',
    path: '/competitions',
    count: portalCompetitions.length,
  },
  {
    id: 'guestbook',
    titleAr: 'سجل الزوار',
    titleEn: 'Guestbook',
    description: 'شاركنا رأيك ورسالتك عن المنصة',
    icon: '✎',
    color: 'from-slate-500 to-slate-700',
    path: '/guestbook',
  },
];
