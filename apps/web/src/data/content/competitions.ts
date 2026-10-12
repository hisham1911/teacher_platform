import type { QuizOption } from './types';

export interface PlacementQuestion {
  id: string;
  stage: 'elementary' | 'intermediate' | 'advanced';
  skill: 'grammar' | 'vocabulary' | 'comprehension';
  prompt: string;
  options: QuizOption[];
  explanation: string;
}

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
    subtitle: '3 مستويات تشخيصية معتمدة',
    badge: '3 مستويات + شهادة رقمية',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    description: 'تقييم تشخيصي متدرج للمرحلة الأساسية، المتوسطة، والثانوية مع إصدار شهادة تحديد مستوى رقمية معتمدة.',
    duration: '15 دقيقة',
    questionCount: 80,
    icon: '🎯',
    gradient: 'from-indigo-600 via-indigo-700 to-violet-800',
    path: '/competitions/placement',
    features: ['3 مستويات دراسية متدرجة', 'شهادة تشخيصية رقمية معتمدة', 'شروحات تفصيلية وتوصيات دراسية'],
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
    questionCount: 30,
    icon: '⚡',
    gradient: 'from-rose-500 via-pink-600 to-orange-500',
    path: '/competitions/speed',
    features: ['مؤقت 60 ثانية', 'مضاعف الحماس (Streak Combo)', 'تنافس على أعلى رقم قياسي'],
  },
];

export const placementQuestions: PlacementQuestion[] = [
  // Elementary (A1-A2)
  {
    id: 'pq-1',
    stage: 'elementary',
    skill: 'grammar',
    prompt: 'She ___ reading books in the library right now.',
    options: [
      { text: 'are', isCorrect: false },
      { text: 'am', isCorrect: false },
      { text: 'is', isCorrect: true },
      { text: 'be', isCorrect: false },
    ],
    explanation: 'نستخدم "is" مع الفاعل المفرد الغائب (She) في زمن المضارع المستمر (Present Continuous).',
  },
  {
    id: 'pq-2',
    stage: 'elementary',
    skill: 'vocabulary',
    prompt: 'The opposite of "cheap" is ___.',
    options: [
      { text: 'fast', isCorrect: false },
      { text: 'heavy', isCorrect: false },
      { text: 'poor', isCorrect: false },
      { text: 'expensive', isCorrect: true },
    ],
    explanation: 'عكس كلمة "cheap" (رخيص) هو "expensive" (غالٍ / باهظ الثمن).',
  },
  {
    id: 'pq-3',
    stage: 'elementary',
    skill: 'grammar',
    prompt: 'Yesterday, we ___ delicious pizza for dinner.',
    options: [
      { text: 'eat', isCorrect: false },
      { text: 'ate', isCorrect: true },
      { text: 'eaten', isCorrect: false },
      { text: 'eating', isCorrect: false },
    ],
    explanation: 'دلت كلمة "Yesterday" على الماضي البسيط، والتصريف الثاني للفعل eat هو ate.',
  },
  {
    id: 'pq-4',
    stage: 'elementary',
    skill: 'vocabulary',
    prompt: 'A person who helps sick animals is called a ___.',
    options: [
      { text: 'pilot', isCorrect: false },
      { text: 'chef', isCorrect: false },
      { text: 'mechanic', isCorrect: false },
      { text: 'vet', isCorrect: true },
    ],
    explanation: '"vet" (طبيب بيطري) هو الشخص المتخصص في علاج الحيوانات.',
  },
  {
    id: 'pq-5',
    stage: 'elementary',
    skill: 'comprehension',
    prompt: '"Ali woke up at 6:00 AM, brushed his teeth, and took the school bus." Where was Ali going?',
    options: [
      { text: 'To the park', isCorrect: false },
      { text: 'To school', isCorrect: true },
      { text: 'To work', isCorrect: false },
      { text: 'To bed', isCorrect: false },
    ],
    explanation: 'ذكر النص أنه ركب حافلة المدرسة (took the school bus)، إذن كان متوجهاً إلى المدرسة.',
  },

  // Intermediate (B1)
  {
    id: 'pq-6',
    stage: 'intermediate',
    skill: 'grammar',
    prompt: 'If it rains tomorrow, we ___ our trip to the beach.',
    options: [
      { text: 'cancel', isCorrect: false },
      { text: 'cancelled', isCorrect: false },
      { text: 'will cancel', isCorrect: true },
      { text: 'would cancel', isCorrect: false },
    ],
    explanation: 'هذه الحالة الشرطية الأولى (First Conditional): If + present simple, will + base verb.',
  },
  {
    id: 'pq-7',
    stage: 'intermediate',
    skill: 'vocabulary',
    prompt: 'My brother is really keen ___ learning new foreign languages.',
    options: [
      { text: 'on', isCorrect: true },
      { text: 'at', isCorrect: false },
      { text: 'with', isCorrect: false },
      { text: 'for', isCorrect: false },
    ],
    explanation: 'حرف الجر المناسب مع الصفة keen هو "on" (keen on = شغوف بـ أو مهتم جداً بـ).',
  },
  {
    id: 'pq-8',
    stage: 'intermediate',
    skill: 'grammar',
    prompt: 'They have lived in Riyadh ___ five years.',
    options: [
      { text: 'since', isCorrect: false },
      { text: 'for', isCorrect: true },
      { text: 'during', isCorrect: false },
      { text: 'from', isCorrect: false },
    ],
    explanation: 'نستخدم "for" للدلالة على المدة الزمنية المحددة (five years) مع المضارع التام.',
  },
  {
    id: 'pq-9',
    stage: 'intermediate',
    skill: 'vocabulary',
    prompt: 'The teacher asked the students to ___ in their assignments before 3:00 PM.',
    options: [
      { text: 'hold', isCorrect: false },
      { text: 'take', isCorrect: false },
      { text: 'hand', isCorrect: true },
      { text: 'put', isCorrect: false },
    ],
    explanation: 'الفعل المركب "hand in" يعني تسليم أو تقديم الواجب (to submit).',
  },
  {
    id: 'pq-10',
    stage: 'intermediate',
    skill: 'comprehension',
    prompt: '"Although the exam was challenging, Sarah managed to achieve an A grade." What does this tell us about Sarah?',
    options: [
      { text: 'She was well-prepared and performed excellently.', isCorrect: true },
      { text: 'She failed the difficult exam.', isCorrect: false },
      { text: 'The exam was easy for everyone.', isCorrect: false },
      { text: 'She did not finish the exam in time.', isCorrect: false },
    ],
    explanation: 'رغم صعوبة الاختبار، استطاعت سارة الحصول على درجة ممتاز (A grade)، مما يدل على اجتهادها واستعدادها الممتاز.',
  },

  // Advanced (B2)
  {
    id: 'pq-11',
    stage: 'advanced',
    skill: 'grammar',
    prompt: 'Had I known about the workshop earlier, I ___ definitely registered.',
    options: [
      { text: 'will have', isCorrect: false },
      { text: 'had', isCorrect: false },
      { text: 'would have', isCorrect: true },
      { text: 'would', isCorrect: false },
    ],
    explanation: 'هذا أسلوب قلب الصيغة (Inversion) في الحالة الشرطية الثالثة (Had I known... I would have...).',
  },
  {
    id: 'pq-12',
    stage: 'advanced',
    skill: 'vocabulary',
    prompt: 'Solar energy is an efficient and ___ alternative to fossil fuels.',
    options: [
      { text: 'temporary', isCorrect: false },
      { text: 'hazardous', isCorrect: false },
      { text: 'tedious', isCorrect: false },
      { text: 'sustainable', isCorrect: true },
    ],
    explanation: '"sustainable" تعني مستدامة وصديقة للبيئة (sustainable alternative).',
  },
  {
    id: 'pq-13',
    stage: 'advanced',
    skill: 'grammar',
    prompt: 'Neither the teacher nor the students ___ informed about the schedule change.',
    options: [
      { text: 'were', isCorrect: true },
      { text: 'was', isCorrect: false },
      { text: 'is', isCorrect: false },
      { text: 'has been', isCorrect: false },
    ],
    explanation: 'في قاعدة "Neither... nor...", يتبع الفعل الفاعل الأقرب إليه، والفاعل الأقرب هو الجمع "the students" لذلك نختار were.',
  },
  {
    id: 'pq-14',
    stage: 'advanced',
    skill: 'vocabulary',
    prompt: 'The manager gave a very ___ presentation that convinced all investors.',
    options: [
      { text: 'reluctant', isCorrect: false },
      { text: 'compelling', isCorrect: true },
      { text: 'hostile', isCorrect: false },
      { text: 'vague', isCorrect: false },
    ],
    explanation: '"compelling" تعني مقنع ومؤثر جداً (compelling presentation).',
  },
  {
    id: 'pq-15',
    stage: 'advanced',
    skill: 'comprehension',
    prompt: '"Despite initial skepticism from critics, the new renewable initiative exceeded its annual energy targets by thirty percent." What was the overall outcome?',
    options: [
      { text: 'The initiative failed as predicted by critics.', isCorrect: false },
      { text: 'The initiative met exactly half of its targets.', isCorrect: false },
      { text: 'The critics were proven right in the end.', isCorrect: false },
      { text: 'The initiative was a notable success that outperformed expectations.', isCorrect: true },
    ],
    explanation: 'تجاوزت المبادرة أهدافها السنوية بنسبة 30% رغم التشكيك المبدئي، ما يعني أنها حققت نجاحاً باهراً فاق التوقعات.',
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
