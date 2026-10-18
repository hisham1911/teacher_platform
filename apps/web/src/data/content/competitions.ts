import type { QuizOption } from './types';

export interface SpeedQuestion {
  id: string;
  prompt: string;
  category: string;
  options: QuizOption[];
}

export interface CompetitionMeta {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  description: string;
  duration: string;
  questionCount: number;
  icon: string;
  gradient: string;
  path: string;
  features: string[];
}

export const portalCompetitions: CompetitionMeta[] = [
  {
    id: 'million',
    slug: 'million',
    titleAr: 'تحدي Spark',
    titleEn: 'Spark Challenge',
    subtitle: 'تحدي المعرفة التصاعدي',
    badge: '15 سؤالاً',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    description: '15 سؤالاً تتدرج في الصعوبة — هل تستطيع الإجابة دون أي خطأ والوصول إلى القمة؟',
    duration: 'مفتوح',
    questionCount: 15,
    icon: '🏆',
    gradient: 'from-amber-500 via-amber-600 to-amber-700',
    path: '/challenge',
    features: ['سلم نقاط تصاعدي', 'مؤثرات صوتية حماسية', 'لا مجال للخطأ'],
  },
  {
    id: 'placement',
    slug: 'placement',
    titleAr: 'اختبار تحديد المستوى والتشخيص',
    titleEn: 'Placement & Diagnostic Test',
    subtitle: '4 مسارات تشخيصية متدرجة',
    badge: '4 مسارات + شهادة رقمية',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    description: 'أربعة مسارات تشخيصية متدرجة: تقييم شامل + ثلاثة مستويات دراسية، مع إصدار شهادة تحديد مستوى رقمية وتوصيات دراسية.',
    duration: '15 دقيقة',
    questionCount: 104,
    icon: '🎯',
    gradient: 'from-indigo-600 via-indigo-700 to-violet-800',
    path: '/competitions/placement',
    features: ['4 مسارات: شامل + 3 مستويات دراسية', 'شهادة تشخيصية رقمية معتمدة', 'شروحات تفصيلية وتوصيات دراسية'],
  },
  {
    id: 'speed',
    slug: 'speed',
    titleAr: 'تحدي السرعة 60 ثانية',
    titleEn: '60-Second Speed Quiz',
    subtitle: 'سرعة البديهة والتركيز',
    badge: 'تحدي حماسي',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
    description: 'لديك دقيقة واحدة فقط! أجب على أكبر قدر ممكن من الأسئلة السريعة واجمع نقاط مضاعفة مع كل إجابة متتالية.',
    duration: '60 ثانية',
    questionCount: 25,
    icon: '⚡',
    gradient: 'from-rose-500 via-pink-600 to-orange-500',
    path: '/competitions/speed',
    features: ['مؤقت 60 ثانية', 'مضاعف الحماس (Streak Combo)', 'تنافس على أعلى رقم قياسي'],
  },
];

export const speedQuestions: SpeedQuestion[] = [
  {
    id: 'sq-1',
    prompt: 'What is the past tense of "Go"?',
    category: 'قواعد وأفعال',
    options: [
      { text: 'Gone', isCorrect: false },
      { text: 'Went', isCorrect: true },
      { text: 'Goed', isCorrect: false },
      { text: 'Going', isCorrect: false },
    ],
  },
  {
    id: 'sq-2',
    prompt: 'Which word means "سعيد"?',
    category: 'مفردات',
    options: [
      { text: 'Sad', isCorrect: false },
      { text: 'Angry', isCorrect: false },
      { text: 'Happy', isCorrect: true },
      { text: 'Tired', isCorrect: false },
    ],
  },
  {
    id: 'sq-3',
    prompt: 'Opposite of "Big":',
    category: 'أضداد',
    options: [
      { text: 'Huge', isCorrect: false },
      { text: 'Tall', isCorrect: false },
      { text: 'Heavy', isCorrect: false },
      { text: 'Small', isCorrect: true },
    ],
  },
  {
    id: 'sq-4',
    prompt: 'He ___ football on weekends.',
    category: 'قواعد',
    options: [
      { text: 'plays', isCorrect: true },
      { text: 'play', isCorrect: false },
      { text: 'playing', isCorrect: false },
      { text: 'is play', isCorrect: false },
    ],
  },
  {
    id: 'sq-5',
    prompt: 'Which one is a fruit?',
    category: 'تصنيفات',
    options: [
      { text: 'Potato', isCorrect: false },
      { text: 'Apple', isCorrect: true },
      { text: 'Carrot', isCorrect: false },
      { text: 'Onion', isCorrect: false },
    ],
  },
  {
    id: 'sq-6',
    prompt: 'Opposite of "Cold":',
    category: 'أضداد',
    options: [
      { text: 'Cool', isCorrect: false },
      { text: 'Wet', isCorrect: false },
      { text: 'Hot', isCorrect: true },
      { text: 'Dry', isCorrect: false },
    ],
  },
  {
    id: 'sq-7',
    prompt: 'What is the plural of "Child"?',
    category: 'جموع شاذة',
    options: [
      { text: 'Childs', isCorrect: false },
      { text: 'Childrens', isCorrect: false },
      { text: 'Childes', isCorrect: false },
      { text: 'Children', isCorrect: true },
    ],
  },
  {
    id: 'sq-8',
    prompt: 'I am interested ___ science.',
    category: 'حروف جر',
    options: [
      { text: 'in', isCorrect: true },
      { text: 'on', isCorrect: false },
      { text: 'at', isCorrect: false },
      { text: 'for', isCorrect: false },
    ],
  },
  {
    id: 'sq-9',
    prompt: 'Past tense of "Buy":',
    category: 'أفعال ماضية',
    options: [
      { text: 'Buyed', isCorrect: false },
      { text: 'Bought', isCorrect: true },
      { text: 'Brought', isCorrect: false },
      { text: 'Buys', isCorrect: false },
    ],
  },
  {
    id: 'sq-10',
    prompt: 'Which word means "سريع"?',
    category: 'مفردات',
    options: [
      { text: 'Slow', isCorrect: false },
      { text: 'Quiet', isCorrect: false },
      { text: 'Fast', isCorrect: true },
      { text: 'Soft', isCorrect: false },
    ],
  },
  {
    id: 'sq-11',
    prompt: 'They ___ not ready yet.',
    category: 'قواعد',
    options: [
      { text: 'is', isCorrect: false },
      { text: 'was', isCorrect: false },
      { text: 'am', isCorrect: false },
      { text: 'are', isCorrect: true },
    ],
  },
  {
    id: 'sq-12',
    prompt: 'Opposite of "Dark":',
    category: 'أضداد',
    options: [
      { text: 'Light', isCorrect: true },
      { text: 'Black', isCorrect: false },
      { text: 'Deep', isCorrect: false },
      { text: 'Night', isCorrect: false },
    ],
  },
  {
    id: 'sq-13',
    prompt: 'Plural of "City":',
    category: 'جموع',
    options: [
      { text: 'Citys', isCorrect: false },
      { text: 'Cities', isCorrect: true },
      { text: 'Citieses', isCorrect: false },
      { text: 'Cites', isCorrect: false },
    ],
  },
  {
    id: 'sq-14',
    prompt: 'She is taller ___ her sister.',
    category: 'مقارنات',
    options: [
      { text: 'then', isCorrect: false },
      { text: 'that', isCorrect: false },
      { text: 'than', isCorrect: true },
      { text: 'from', isCorrect: false },
    ],
  },
  {
    id: 'sq-15',
    prompt: 'Which season is the coldest?',
    category: 'مفردات عامة',
    options: [
      { text: 'Summer', isCorrect: false },
      { text: 'Spring', isCorrect: false },
      { text: 'Autumn', isCorrect: false },
      { text: 'Winter', isCorrect: true },
    ],
  },
  {
    id: 'sq-16',
    prompt: 'Past tense of "Teach":',
    category: 'أفعال ماضية',
    options: [
      { text: 'Taught', isCorrect: true },
      { text: 'Teached', isCorrect: false },
      { text: 'Thought', isCorrect: false },
      { text: 'Tought', isCorrect: false },
    ],
  },
  {
    id: 'sq-17',
    prompt: 'Synonym of "Begin":',
    category: 'مرادفات',
    options: [
      { text: 'End', isCorrect: false },
      { text: 'Start', isCorrect: true },
      { text: 'Stop', isCorrect: false },
      { text: 'Finish', isCorrect: false },
    ],
  },
  {
    id: 'sq-18',
    prompt: 'Look ___ that beautiful bird!',
    category: 'حروف جر',
    options: [
      { text: 'in', isCorrect: false },
      { text: 'on', isCorrect: false },
      { text: 'at', isCorrect: true },
      { text: 'to', isCorrect: false },
    ],
  },
  {
    id: 'sq-19',
    prompt: 'Which animal barks?',
    category: 'حيوانات',
    options: [
      { text: 'Cat', isCorrect: false },
      { text: 'Bird', isCorrect: false },
      { text: 'Horse', isCorrect: false },
      { text: 'Dog', isCorrect: true },
    ],
  },
  {
    id: 'sq-20',
    prompt: 'Opposite of "Always":',
    category: 'أضداد',
    options: [
      { text: 'Never', isCorrect: true },
      { text: 'Often', isCorrect: false },
      { text: 'Sometimes', isCorrect: false },
      { text: 'Usually', isCorrect: false },
    ],
  },
  {
    id: 'sq-21',
    prompt: 'Past tense of "Write":',
    category: 'أفعال ماضية',
    options: [
      { text: 'Written', isCorrect: false },
      { text: 'Wrote', isCorrect: true },
      { text: 'Writed', isCorrect: false },
      { text: 'Writing', isCorrect: false },
    ],
  },
  {
    id: 'sq-22',
    prompt: 'How many days in a week?',
    category: 'معلومات عامة',
    options: [
      { text: 'Six', isCorrect: false },
      { text: 'Five', isCorrect: false },
      { text: 'Seven', isCorrect: true },
      { text: 'Eight', isCorrect: false },
    ],
  },
  {
    id: 'sq-23',
    prompt: 'We meet ___ 5:00 PM.',
    category: 'حروف جر',
    options: [
      { text: 'in', isCorrect: false },
      { text: 'on', isCorrect: false },
      { text: 'by', isCorrect: false },
      { text: 'at', isCorrect: true },
    ],
  },
  {
    id: 'sq-24',
    prompt: 'Opposite of "Easy":',
    category: 'أضداد',
    options: [
      { text: 'Difficult', isCorrect: true },
      { text: 'Simple', isCorrect: false },
      { text: 'Fast', isCorrect: false },
      { text: 'Clear', isCorrect: false },
    ],
  },
  {
    id: 'sq-25',
    prompt: 'Past tense of "See":',
    category: 'أفعال ماضية',
    options: [
      { text: 'Seen', isCorrect: false },
      { text: 'Seed', isCorrect: false },
      { text: 'Seeing', isCorrect: false },
      { text: 'Saw', isCorrect: true },
    ],
  },
];
