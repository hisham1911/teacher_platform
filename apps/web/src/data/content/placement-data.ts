export interface PlacementOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export type SkillCategory = 'grammar' | 'vocabulary' | 'knowledge' | 'life-skills';

export interface PlacementQuestionItem {
  id: string;
  levelId: 'level-1' | 'level-2' | 'level-3';
  sectionTitle: string;
  skill: SkillCategory;
  prompt: string;
  options: PlacementOption[];
  explanationEn: string;
  explanationAr: string;
}

export interface PlacementLevelInfo {
  id: 'level-1' | 'level-2' | 'level-3' | 'comprehensive';
  levelNumber: number;
  titleAr: string;
  titleEn: string;
  stageAr: string;
  targetAudience: string;
  badge: string;
  badgeColor: string;
  icon: string;
  gradient: string;
  description: string;
  durationMinutes: number;
  questionCount: number;
  topicsCovered: string[];
}

export const PLACEMENT_LEVELS_META: PlacementLevelInfo[] = [
  {
    id: 'comprehensive',
    levelNumber: 0,
    titleAr: 'التشخيص اللغوي الشامل (لكافة المستويات)',
    titleEn: 'Comprehensive All-in-One Diagnostic',
    stageAr: 'متدرج من الأساسي حتى الثانوي',
    targetAudience: 'لجميع الطالبات لتحديد المستوى الأكاديمي بدقة (A1 إلى B2)',
    badge: 'تحديد دقيق للمستوى',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    icon: '🎯',
    gradient: 'from-indigo-600 via-violet-600 to-purple-700',
    description:
      'اختبار متدرج يقيس مهاراتك عبر المستويات الثلاثة لتحديد مستواك الدقيق ومنحك خطة دراسية مخصصة وشهادة تقييم معتمدة.',
    durationMinutes: 15,
    questionCount: 24,
    topicsCovered: [
      'تأسيس المحادثة والقواعد البسيطة',
      'أزمنة اللغة الإنجليزية والمقارنة',
      'المعرفة العامة وثقافة المملكة',
      'القواعد المتقدمة ومهارات الحياة والذكاء الاصطناعي',
    ],
  },
  {
    id: 'level-1',
    levelNumber: 1,
    titleAr: 'المستوى الأول — الأساسي (Level 1)',
    titleEn: 'Basic English & Daily Practice',
    stageAr: 'المرحلة التأسيسية / أول متوسط',
    targetAudience: 'المبتدئات وطالبات الصف الأول متوسط لتثبيت الأساسيات',
    badge: 'المستوى 1 • التأسيسي',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    icon: '🌱',
    gradient: 'from-emerald-500 via-teal-600 to-cyan-700',
    description:
      'أسئلة سهلة ومباشرة في المحادثات اليومية، الألوان، الأرقام، الضمائر، وأفعال (am, is, are) وتصنيف الكلمات.',
    durationMinutes: 15,
    questionCount: 40,
    topicsCovered: [
      'التحيات والأسئلة الشائعة (Name, Age, Country)',
      'الألوان والأرقام والمفردات البصرية',
      'فعل الكينونة Verb to be (am / is / are)',
      'تصنيف الكلمات والردود المهذبة',
    ],
  },
  {
    id: 'level-2',
    levelNumber: 2,
    titleAr: 'المستوى الثاني — المتوسط (Level 2)',
    titleEn: 'Intermediate & Saudi Knowledge',
    stageAr: 'المرحلة المتوسطة (ثاني وثالث متوسط)',
    targetAudience: 'طالبات المرحلة المتوسطة لتعزيز القواعد والمعرفة العامة',
    badge: 'المستوى 2 • المتوسط',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    icon: '⭐',
    gradient: 'from-blue-600 via-indigo-600 to-sky-700',
    description:
      'قواعد الأزمنة، المقارنة، التفضيل، ونصائح الصحة والعلوم، مع أسئلة ثقافة عامة ومعلومات وطنية عن المملكة العربية السعودية.',
    durationMinutes: 15,
    questionCount: 20,
    topicsCovered: [
      'أزمنة الأفعال (Past, Present, Continuous, Perfect)',
      'صيغ المقارنة وإعطاء النصائح (should)',
      'معلومات عامة وعلوم وجغرافيا العالم',
      'ثقافة وجغرافيا المملكة العربية السعودية',
    ],
  },
  {
    id: 'level-3',
    levelNumber: 3,
    titleAr: 'المستوى الثالث — الثانوي ومهارات الحياة (Level 3)',
    titleEn: 'Secondary & Real Life Skills',
    stageAr: 'المرحلة الثانوية وما فوق',
    targetAudience: 'طالبات المرحلة الثانوية والمقبلات على الاختبارات المعيارية',
    badge: 'المستوى 3 • الثانوي المتقدم',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    icon: '🚀',
    gradient: 'from-purple-600 via-fuchsia-600 to-pink-600',
    description:
      'تراكيب متقدمة في القواعد (Conditionals, Passive, Gerunds) بجانب مهارات التفكير الناقد، المواطنة الرقمية، الذكاء الاصطناعي، والاستعداد المهني.',
    durationMinutes: 15,
    questionCount: 20,
    topicsCovered: [
      'الجمل الشرطية والمبني للمجهول والمضارع التام',
      'المواطنة الرقمية وأمن المعلومات والذكاء الاصطناعي',
      'الاستدامة والطاقة المتجددة وإدارة الضغوط',
      'مهارات العمل الجماعي والتطوع والمقابلات الشخصية',
    ],
  },
];

// =================================================================
// أسئلة المستوى الأول: Basic English – Level 1 (40 سؤالاً)
// =================================================================
export const LEVEL_1_QUESTIONS: PlacementQuestionItem[] = [
  // A. Choose the correct answer (1-15)
  {
    id: 'l1-q1',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'vocabulary',
    prompt: 'What is your name?',
    options: [
      { id: 'a', text: 'My name is Sara.', isCorrect: true },
      { id: 'b', text: 'I am 15.', isCorrect: false },
      { id: 'c', text: 'I am fine.', isCorrect: false },
    ],
    explanationEn: 'When asked "What is your name?", the correct response states your name.',
    explanationAr: 'السؤال عن الاسم "What is your name?" يُجاب عنه بذكر الاسم: My name is...',
  },
  {
    id: 'l1-q2',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'vocabulary',
    prompt: 'How old are you?',
    options: [
      { id: 'a', text: 'I am fine.', isCorrect: false },
      { id: 'b', text: 'I am 15 years old.', isCorrect: true },
      { id: 'c', text: 'My name is Noor.', isCorrect: false },
    ],
    explanationEn: '"How old are you?" asks about your age.',
    explanationAr: 'السؤال "How old are you?" يسأل عن العمر، والإجابة الصحيحة: I am 15 years old.',
  },
  {
    id: 'l1-q3',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'vocabulary',
    prompt: 'Where are you from?',
    options: [
      { id: 'a', text: 'I am 16.', isCorrect: false },
      { id: 'b', text: 'I am happy.', isCorrect: false },
      { id: 'c', text: 'I am from Saudi Arabia.', isCorrect: true },
    ],
    explanationEn: '"Where are you from?" asks for your home country or city.',
    explanationAr: 'السؤال "Where are you from?" يسأل عن موطنك أو بلدك: I am from Saudi Arabia.',
  },
  {
    id: 'l1-q4',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'vocabulary',
    prompt: 'How are you?',
    options: [
      { id: 'a', text: 'I am fine, thank you.', isCorrect: true },
      { id: 'b', text: 'I am from Jazan.', isCorrect: false },
      { id: 'c', text: 'I am a student.', isCorrect: false },
    ],
    explanationEn: '"How are you?" is a polite greeting asking how you feel.',
    explanationAr: 'السؤال "How are you?" يسأل عن حالك، والرد المعتاد: I am fine, thank you.',
  },
  {
    id: 'l1-q5',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'vocabulary',
    prompt: 'What is this? 🍎',
    options: [
      { id: 'a', text: 'It is a book.', isCorrect: false },
      { id: 'b', text: 'It is an apple.', isCorrect: true },
      { id: 'c', text: 'It is a pen.', isCorrect: false },
    ],
    explanationEn: 'The picture shows an apple (🍎).',
    explanationAr: 'الصورة تمثل تفاحة (Apple).',
  },
  {
    id: 'l1-q6',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'vocabulary',
    prompt: 'What color is the sun? ☀️',
    options: [
      { id: 'a', text: 'Blue', isCorrect: false },
      { id: 'b', text: 'Yellow', isCorrect: true },
      { id: 'c', text: 'Black', isCorrect: false },
    ],
    explanationEn: 'The sun is typically represented as yellow.',
    explanationAr: 'لون الشمس أصفر (Yellow).',
  },
  {
    id: 'l1-q7',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'grammar',
    prompt: 'I ___ a student.',
    options: [
      { id: 'a', text: 'am', isCorrect: true },
      { id: 'b', text: 'is', isCorrect: false },
      { id: 'c', text: 'are', isCorrect: false },
    ],
    explanationEn: 'The pronoun "I" always takes the verb "am".',
    explanationAr: 'الضمير "I" يأخذ دائماً فعل الكينونة "am".',
  },
  {
    id: 'l1-q8',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'grammar',
    prompt: 'She ___ happy.',
    options: [
      { id: 'a', text: 'am', isCorrect: false },
      { id: 'b', text: 'is', isCorrect: true },
      { id: 'c', text: 'are', isCorrect: false },
    ],
    explanationEn: 'Singular third-person pronouns (He, She, It) take "is".',
    explanationAr: 'ضمائر المفرد الغائب (He, She, It) تأخذ فعل الكينونة "is".',
  },
  {
    id: 'l1-q9',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'grammar',
    prompt: 'They ___ friends.',
    options: [
      { id: 'a', text: 'am', isCorrect: false },
      { id: 'b', text: 'is', isCorrect: false },
      { id: 'c', text: 'are', isCorrect: true },
    ],
    explanationEn: 'Plural pronouns (They, We, You) take "are".',
    explanationAr: 'ضمائر الجمع (They, We, You) تأخذ فعل الكينونة "are".',
  },
  {
    id: 'l1-q10',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'vocabulary',
    prompt: 'What number is this? 5',
    options: [
      { id: 'a', text: 'Three', isCorrect: false },
      { id: 'b', text: 'Five', isCorrect: true },
      { id: 'c', text: 'Four', isCorrect: false },
    ],
    explanationEn: 'The digit 5 is spelled "Five".',
    explanationAr: 'الرقم 5 يُكتب بالإنجليزية Five.',
  },
  {
    id: 'l1-q11',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'grammar',
    prompt: 'This is ___ book.',
    options: [
      { id: 'a', text: 'a', isCorrect: true },
      { id: 'b', text: 'an', isCorrect: false },
      { id: 'c', text: 'are', isCorrect: false },
    ],
    explanationEn: 'We use the indefinite article "a" before consonant sounds ("b" in book).',
    explanationAr: 'نستخدم أداة النكرة "a" قبل الأسماء المفردة التي تبدأ بحرف ساكن مثل book.',
  },
  {
    id: 'l1-q12',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'grammar',
    prompt: 'He ___ a teacher.',
    options: [
      { id: 'a', text: 'am', isCorrect: false },
      { id: 'b', text: 'is', isCorrect: true },
      { id: 'c', text: 'are', isCorrect: false },
    ],
    explanationEn: 'The singular pronoun "He" takes "is".',
    explanationAr: 'الضمير المفرد المذكر "He" يأخذ "is".',
  },
  {
    id: 'l1-q13',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'grammar',
    prompt: 'We ___ students.',
    options: [
      { id: 'a', text: 'am', isCorrect: false },
      { id: 'b', text: 'is', isCorrect: false },
      { id: 'c', text: 'are', isCorrect: true },
    ],
    explanationEn: 'The plural pronoun "We" takes "are".',
    explanationAr: 'ضمير المتكلمين الجمع "We" يأخذ "are".',
  },
  {
    id: 'l1-q14',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'vocabulary',
    prompt: 'What is this? 🖊️',
    options: [
      { id: 'a', text: 'A bag', isCorrect: false },
      { id: 'b', text: 'A chair', isCorrect: false },
      { id: 'c', text: 'A pen', isCorrect: true },
    ],
    explanationEn: 'The emoji represents a pen (🖊️).',
    explanationAr: 'الصورة تمثل قلماً جافاً (A pen).',
  },
  {
    id: 'l1-q15',
    levelId: 'level-1',
    sectionTitle: 'A. Choose the correct answer',
    skill: 'vocabulary',
    prompt: 'What color is grass? 🌿',
    options: [
      { id: 'a', text: 'Pink', isCorrect: false },
      { id: 'b', text: 'Green', isCorrect: true },
      { id: 'c', text: 'Black', isCorrect: false },
    ],
    explanationEn: 'Natural grass is green in color.',
    explanationAr: 'العشب الأخضر لونه أخضر (Green).',
  },

  // B. Everyday Questions & Answers (16-25)
  {
    id: 'l1-q16',
    levelId: 'level-1',
    sectionTitle: 'B. Everyday Questions & Practice',
    skill: 'vocabulary',
    prompt: 'What is your favorite color?',
    options: [
      { id: 'a', text: 'My favorite color is blue.', isCorrect: true },
      { id: 'b', text: 'I am fine.', isCorrect: false },
      { id: 'c', text: 'It is a book.', isCorrect: false },
    ],
    explanationEn: 'The correct reply names a favorite color (e.g., blue).',
    explanationAr: 'الرد على السؤال عن اللون المفضل يذكر اللون: My favorite color is blue.',
  },
  {
    id: 'l1-q17',
    levelId: 'level-1',
    sectionTitle: 'B. Everyday Questions & Practice',
    skill: 'vocabulary',
    prompt: 'What is your favorite food?',
    options: [
      { id: 'a', text: 'I am 14.', isCorrect: false },
      { id: 'b', text: 'I like pizza.', isCorrect: true },
      { id: 'c', text: 'No, I do not.', isCorrect: false },
    ],
    explanationEn: 'Answering about favorite food mentions a meal or dish.',
    explanationAr: 'الرد عن الطعام المفضل يذكر طعاماً مثل: I like pizza.',
  },
  {
    id: 'l1-q18',
    levelId: 'level-1',
    sectionTitle: 'B. Everyday Questions & Practice',
    skill: 'grammar',
    prompt: 'Do you like English?',
    options: [
      { id: 'a', text: 'I am from Riyadh.', isCorrect: false },
      { id: 'b', text: 'She is tall.', isCorrect: false },
      { id: 'c', text: 'Yes, I do.', isCorrect: true },
    ],
    explanationEn: 'A question starting with "Do you...?" is answered with "Yes, I do." or "No, I do not."',
    explanationAr: 'السؤال بـ "Do you...?" يُجاب عنه بـ "Yes, I do" أو "No, I don\'t".',
  },
  {
    id: 'l1-q19',
    levelId: 'level-1',
    sectionTitle: 'B. Everyday Questions & Practice',
    skill: 'vocabulary',
    prompt: 'Do you like coffee?',
    options: [
      { id: 'a', text: 'Yes, I like coffee.', isCorrect: true },
      { id: 'b', text: 'It is yellow.', isCorrect: false },
      { id: 'c', text: 'Tomorrow.', isCorrect: false },
    ],
    explanationEn: 'The reply expresses preference for coffee.',
    explanationAr: 'الإجابة تعبر عن تفضيل القهوة: Yes, I like coffee.',
  },
  {
    id: 'l1-q20',
    levelId: 'level-1',
    sectionTitle: 'B. Everyday Questions & Practice',
    skill: 'vocabulary',
    prompt: 'What is your favorite animal?',
    options: [
      { id: 'a', text: 'I am happy.', isCorrect: false },
      { id: 'b', text: 'My favorite animal is a cat.', isCorrect: true },
      { id: 'c', text: 'Red and green.', isCorrect: false },
    ],
    explanationEn: 'A favorite animal question is answered by naming an animal.',
    explanationAr: 'السؤال عن الحيوان المفضل يُجاب عنه بذكر حيوان مثل: My favorite animal is a cat.',
  },
  {
    id: 'l1-q21',
    levelId: 'level-1',
    sectionTitle: 'B. Everyday Questions & Practice',
    skill: 'vocabulary',
    prompt: 'Where do you live?',
    options: [
      { id: 'a', text: 'I am fine.', isCorrect: false },
      { id: 'b', text: 'On Monday.', isCorrect: false },
      { id: 'c', text: 'I live in Jazan.', isCorrect: true },
    ],
    explanationEn: '"Where do you live?" asks for a location or city.',
    explanationAr: 'السؤال "Where do you live?" يسأل عن مكان السكن: I live in Jazan.',
  },
  {
    id: 'l1-q22',
    levelId: 'level-1',
    sectionTitle: 'B. Everyday Questions & Practice',
    skill: 'grammar',
    prompt: 'Are you a student?',
    options: [
      { id: 'a', text: 'Yes, I am.', isCorrect: true },
      { id: 'b', text: 'Yes, it is.', isCorrect: false },
      { id: 'c', text: 'I am 15.', isCorrect: false },
    ],
    explanationEn: '"Are you...?" questions addressed to oneself are answered with "Yes, I am."',
    explanationAr: 'السؤال "Are you a student?" يُجاب عنه بـ "Yes, I am." أو "No, I am not."',
  },
  {
    id: 'l1-q23',
    levelId: 'level-1',
    sectionTitle: 'B. Everyday Questions & Practice',
    skill: 'vocabulary',
    prompt: 'What day is it today?',
    options: [
      { id: 'a', text: 'It is an apple.', isCorrect: false },
      { id: 'b', text: 'Today is Monday.', isCorrect: true },
      { id: 'c', text: 'I am a teacher.', isCorrect: false },
    ],
    explanationEn: '"What day is it today?" asks for the day of the week.',
    explanationAr: 'السؤال "What day is it today?" يسأل عن يوم الأسبوع: Today is Monday.',
  },
  {
    id: 'l1-q24',
    levelId: 'level-1',
    sectionTitle: 'B. Everyday Questions & Practice',
    skill: 'vocabulary',
    prompt: 'What time is it?',
    options: [
      { id: 'a', text: 'I am fine.', isCorrect: false },
      { id: 'b', text: 'In Saudi Arabia.', isCorrect: false },
      { id: 'c', text: 'It is 5 o’clock.', isCorrect: true },
    ],
    explanationEn: '"What time is it?" asks for the clock time.',
    explanationAr: 'السؤال "What time is it?" يسأل عن الوقت: It is 5 o\'clock.',
  },
  {
    id: 'l1-q25',
    levelId: 'level-1',
    sectionTitle: 'B. Everyday Questions & Practice',
    skill: 'vocabulary',
    prompt: 'Who is your best friend?',
    options: [
      { id: 'a', text: 'My best friend is Nora.', isCorrect: true },
      { id: 'b', text: 'At school.', isCorrect: false },
      { id: 'c', text: 'It is yellow.', isCorrect: false },
    ],
    explanationEn: '"Who is...?" asks for a person\'s identity.',
    explanationAr: 'السؤال بأداة الاستفهام Who يسأل عن شخص: My best friend is Nora.',
  },

  // C. Match greetings (26-30)
  {
    id: 'l1-q26',
    levelId: 'level-1',
    sectionTitle: 'C. Polite Greetings & Responses',
    skill: 'vocabulary',
    prompt: 'Choose the matching response to: "Hello"',
    options: [
      { id: 'a', text: 'Thank you', isCorrect: false },
      { id: 'b', text: 'Hi', isCorrect: true },
      { id: 'c', text: 'Good night', isCorrect: false },
    ],
    explanationEn: '"Hello" is matched with "Hi".',
    explanationAr: 'التحية Hello يقابلها في الرد التحية الودية Hi.',
  },
  {
    id: 'l1-q27',
    levelId: 'level-1',
    sectionTitle: 'C. Polite Greetings & Responses',
    skill: 'vocabulary',
    prompt: 'Choose the matching response to: "Goodbye"',
    options: [
      { id: 'a', text: 'Good morning', isCorrect: false },
      { id: 'b', text: 'Fine', isCorrect: false },
      { id: 'c', text: 'Bye', isCorrect: true },
    ],
    explanationEn: '"Goodbye" is matched with "Bye".',
    explanationAr: 'توديع Goodbye يقابله الرد التوديعي Bye.',
  },
  {
    id: 'l1-q28',
    levelId: 'level-1',
    sectionTitle: 'C. Polite Greetings & Responses',
    skill: 'vocabulary',
    prompt: 'Choose the matching response to: "Thank you"',
    options: [
      { id: 'a', text: 'You’re welcome', isCorrect: true },
      { id: 'b', text: 'Hello', isCorrect: false },
      { id: 'c', text: 'Yes, please', isCorrect: false },
    ],
    explanationEn: 'The polite response to "Thank you" is "You’re welcome".',
    explanationAr: 'الرد المهذب على عبارة الشكر Thank you هو You\'re welcome (عفواً).',
  },
  {
    id: 'l1-q29',
    levelId: 'level-1',
    sectionTitle: 'C. Polite Greetings & Responses',
    skill: 'vocabulary',
    prompt: 'Choose the matching response to: "Good morning"',
    options: [
      { id: 'a', text: 'Good night', isCorrect: false },
      { id: 'b', text: 'Good morning', isCorrect: true },
      { id: 'c', text: 'Goodbye', isCorrect: false },
    ],
    explanationEn: 'The greeting "Good morning" is reciprocated with "Good morning".',
    explanationAr: 'تحية الصباح Good morning يُرد عليها بنفس التحية Good morning.',
  },
  {
    id: 'l1-q30',
    levelId: 'level-1',
    sectionTitle: 'C. Polite Greetings & Responses',
    skill: 'vocabulary',
    prompt: 'Choose the matching response to: "Sorry"',
    options: [
      { id: 'a', text: 'Welcome', isCorrect: false },
      { id: 'b', text: 'Hello', isCorrect: false },
      { id: 'c', text: 'It’s OK', isCorrect: true },
    ],
    explanationEn: 'When someone apologizes with "Sorry", a natural response is "It’s OK".',
    explanationAr: 'عند الاعتذار بـ Sorry الرد المناسب للتسامح هو It\'s OK (لا بأس).',
  },

  // D. Complete sentences with am / is / are (31-35)
  {
    id: 'l1-q31',
    levelId: 'level-1',
    sectionTitle: 'D. Complete with (am / is / are)',
    skill: 'grammar',
    prompt: 'My name ___ Ali.',
    options: [
      { id: 'a', text: 'is', isCorrect: true },
      { id: 'b', text: 'am', isCorrect: false },
      { id: 'c', text: 'are', isCorrect: false },
    ],
    explanationEn: '"My name" is singular (it), so it takes "is".',
    explanationAr: 'الاسم المفرد "My name" يأخذ فعل الكينونة "is".',
  },
  {
    id: 'l1-q32',
    levelId: 'level-1',
    sectionTitle: 'D. Complete with (am / is / are)',
    skill: 'grammar',
    prompt: 'I ___ happy.',
    options: [
      { id: 'a', text: 'is', isCorrect: false },
      { id: 'b', text: 'am', isCorrect: true },
      { id: 'c', text: 'are', isCorrect: false },
    ],
    explanationEn: 'The pronoun "I" always takes "am".',
    explanationAr: 'الضمير "I" يأخذ دائماً "am".',
  },
  {
    id: 'l1-q33',
    levelId: 'level-1',
    sectionTitle: 'D. Complete with (am / is / are)',
    skill: 'grammar',
    prompt: 'She ___ my friend.',
    options: [
      { id: 'a', text: 'am', isCorrect: false },
      { id: 'b', text: 'are', isCorrect: false },
      { id: 'c', text: 'is', isCorrect: true },
    ],
    explanationEn: 'The singular pronoun "She" takes "is".',
    explanationAr: 'الضمير المفرد المؤنث "She" يأخذ "is".',
  },
  {
    id: 'l1-q34',
    levelId: 'level-1',
    sectionTitle: 'D. Complete with (am / is / are)',
    skill: 'grammar',
    prompt: 'We ___ students.',
    options: [
      { id: 'a', text: 'are', isCorrect: true },
      { id: 'b', text: 'is', isCorrect: false },
      { id: 'c', text: 'am', isCorrect: false },
    ],
    explanationEn: '"We" is a plural subject pronoun, so it takes "are".',
    explanationAr: 'ضمير الجمع "We" يأخذ دائماً "are".',
  },
  {
    id: 'l1-q35',
    levelId: 'level-1',
    sectionTitle: 'D. Complete with (am / is / are)',
    skill: 'grammar',
    prompt: 'It ___ a cat.',
    options: [
      { id: 'a', text: 'am', isCorrect: false },
      { id: 'b', text: 'is', isCorrect: true },
      { id: 'c', text: 'are', isCorrect: false },
    ],
    explanationEn: 'The singular neutral pronoun "It" takes "is".',
    explanationAr: 'الضمير المفرد لغير العاقل "It" يأخذ "is".',
  },

  // E. Easy Vocabulary (36-40)
  {
    id: 'l1-q36',
    levelId: 'level-1',
    sectionTitle: 'E. Easy Vocabulary Classification',
    skill: 'vocabulary',
    prompt: 'A cat is an ______.',
    options: [
      { id: 'a', text: 'color', isCorrect: false },
      { id: 'b', text: 'food', isCorrect: false },
      { id: 'c', text: 'animal', isCorrect: true },
    ],
    explanationEn: 'A cat is a biological creature (an animal).',
    explanationAr: 'القط حيوان (animal).',
  },
  {
    id: 'l1-q37',
    levelId: 'level-1',
    sectionTitle: 'E. Easy Vocabulary Classification',
    skill: 'vocabulary',
    prompt: 'Apple is a ______.',
    options: [
      { id: 'a', text: 'food', isCorrect: true },
      { id: 'b', text: 'number', isCorrect: false },
      { id: 'c', text: 'school', isCorrect: false },
    ],
    explanationEn: 'An apple is an edible fruit (food).',
    explanationAr: 'التفاح طعام وغذاء (food).',
  },
  {
    id: 'l1-q38',
    levelId: 'level-1',
    sectionTitle: 'E. Easy Vocabulary Classification',
    skill: 'vocabulary',
    prompt: 'Red is a ______.',
    options: [
      { id: 'a', text: 'animal', isCorrect: false },
      { id: 'b', text: 'color', isCorrect: true },
      { id: 'c', text: 'day', isCorrect: false },
    ],
    explanationEn: 'Red is a visible hue (a color).',
    explanationAr: 'الأحمر لون (color).',
  },
  {
    id: 'l1-q39',
    levelId: 'level-1',
    sectionTitle: 'E. Easy Vocabulary Classification',
    skill: 'vocabulary',
    prompt: 'Monday is a ______.',
    options: [
      { id: 'a', text: 'food', isCorrect: false },
      { id: 'b', text: 'animal', isCorrect: false },
      { id: 'c', text: 'day', isCorrect: true },
    ],
    explanationEn: 'Monday is a day of the week.',
    explanationAr: 'يوم الإثنين هو يوم من أيام الأسبوع (day).',
  },
  {
    id: 'l1-q40',
    levelId: 'level-1',
    sectionTitle: 'E. Easy Vocabulary Classification',
    skill: 'vocabulary',
    prompt: 'Ten is a ______.',
    options: [
      { id: 'a', text: 'number', isCorrect: true },
      { id: 'b', text: 'color', isCorrect: false },
      { id: 'c', text: 'animal', isCorrect: false },
    ],
    explanationEn: 'Ten is a numerical digit (a number).',
    explanationAr: 'الرقم عشرة 10 هو رقم (number).',
  },
];

// =================================================================
// أسئلة المستوى الثاني: English – Intermediate Level 2 (20 سؤالاً)
// =================================================================
export const LEVEL_2_QUESTIONS: PlacementQuestionItem[] = [
  // Grammar (1-6)
  {
    id: 'l2-q1',
    levelId: 'level-2',
    sectionTitle: 'Grammar & Tenses',
    skill: 'grammar',
    prompt: 'My sister _______ English every day.',
    options: [
      { id: 'a', text: 'study', isCorrect: false },
      { id: 'b', text: 'studies', isCorrect: true },
      { id: 'c', text: 'studying', isCorrect: false },
      { id: 'd', text: 'studied', isCorrect: false },
    ],
    explanationEn: 'With singular subjects (My sister) in the Present Simple, the verb takes -s/-es (studies).',
    explanationAr: 'في زمن المضارع البسيط ومع الفاعل المفرد (My sister) نضيف للفعل s أو es فيصبح studies.',
  },
  {
    id: 'l2-q2',
    levelId: 'level-2',
    sectionTitle: 'Grammar & Tenses',
    skill: 'grammar',
    prompt: 'We _______ to the park yesterday.',
    options: [
      { id: 'a', text: 'go', isCorrect: false },
      { id: 'b', text: 'goes', isCorrect: false },
      { id: 'c', text: 'went', isCorrect: true },
      { id: 'd', text: 'going', isCorrect: false },
    ],
    explanationEn: '"Yesterday" signals Past Simple, so we use the irregular past form "went".',
    explanationAr: 'كلمة "yesterday" تدل على الماضي البسيط، والتصريف الثاني للفعل go هو went.',
  },
  {
    id: 'l2-q3',
    levelId: 'level-2',
    sectionTitle: 'Grammar & Tenses',
    skill: 'grammar',
    prompt: 'Ali _______ TV when his mother came home.',
    options: [
      { id: 'a', text: 'watches', isCorrect: false },
      { id: 'b', text: 'watched', isCorrect: false },
      { id: 'c', text: 'is watching', isCorrect: false },
      { id: 'd', text: 'was watching', isCorrect: true },
    ],
    explanationEn: 'An ongoing past action interrupted by another (came) uses Past Continuous (was watching).',
    explanationAr: 'حدث كان مستمراً في الماضي وقاطعه حدث آخر نستخدم معه الماضي المستمر (was watching).',
  },
  {
    id: 'l2-q4',
    levelId: 'level-2',
    sectionTitle: 'Grammar & Tenses',
    skill: 'grammar',
    prompt: 'I have _______ my homework.',
    options: [
      { id: 'a', text: 'finished', isCorrect: true },
      { id: 'b', text: 'finishes', isCorrect: false },
      { id: 'c', text: 'finish', isCorrect: false },
      { id: 'd', text: 'finishing', isCorrect: false },
    ],
    explanationEn: 'After "have/has" in Present Perfect, use the past participle (-ed form for regular verbs).',
    explanationAr: 'بعد have في زمن المضارع التام نستخدم التصريف الثالث (finished).',
  },
  {
    id: 'l2-q5',
    levelId: 'level-2',
    sectionTitle: 'Grammar & Tenses',
    skill: 'grammar',
    prompt: 'Sara is _______ than her sister.',
    options: [
      { id: 'a', text: 'tall', isCorrect: false },
      { id: 'b', text: 'taller', isCorrect: true },
      { id: 'c', text: 'tallest', isCorrect: false },
      { id: 'd', text: 'more tall', isCorrect: false },
    ],
    explanationEn: 'For short adjectives comparing two items, add -er (taller than).',
    explanationAr: 'في المقارنة بين اثنين مع الصفات القصيرة نضيف er للصفة متبوعة بـ than (taller than).',
  },
  {
    id: 'l2-q6',
    levelId: 'level-2',
    sectionTitle: 'Grammar & Tenses',
    skill: 'grammar',
    prompt: 'You _______ drink plenty of water every day.',
    options: [
      { id: 'a', text: 'shouldn’t', isCorrect: false },
      { id: 'b', text: 'can’t', isCorrect: false },
      { id: 'c', text: 'wouldn’t', isCorrect: false },
      { id: 'd', text: 'should', isCorrect: true },
    ],
    explanationEn: 'We use the modal "should" to give good health advice.',
    explanationAr: 'نستخدم الفعل المساعد "should" لإعطاء نصيحة إيجابية ومفيدة للصحة.',
  },

  // 🌍 General Knowledge (7-14)
  {
    id: 'l2-q7',
    levelId: 'level-2',
    sectionTitle: '🌍 General Knowledge',
    skill: 'knowledge',
    prompt: 'What is the capital city of Saudi Arabia?',
    options: [
      { id: 'a', text: 'Jeddah', isCorrect: false },
      { id: 'b', text: 'Riyadh', isCorrect: true },
      { id: 'c', text: 'Abha', isCorrect: false },
      { id: 'd', text: 'Dammam', isCorrect: false },
    ],
    explanationEn: 'Riyadh is the capital of the Kingdom of Saudi Arabia.',
    explanationAr: 'عاصمة المملكة العربية السعودية هي الرياض (Riyadh).',
  },
  {
    id: 'l2-q8',
    levelId: 'level-2',
    sectionTitle: '🌍 General Knowledge',
    skill: 'knowledge',
    prompt: 'How many days are there in a week?',
    options: [
      { id: 'a', text: 'Five', isCorrect: false },
      { id: 'b', text: 'Six', isCorrect: false },
      { id: 'c', text: 'Seven', isCorrect: true },
      { id: 'd', text: 'Eight', isCorrect: false },
    ],
    explanationEn: 'There are seven days in a week.',
    explanationAr: 'عدد أيام الأسبوع سبعة أيام (Seven).',
  },
  {
    id: 'l2-q9',
    levelId: 'level-2',
    sectionTitle: '🌍 General Knowledge',
    skill: 'knowledge',
    prompt: 'Which planet is known as the Red Planet?',
    options: [
      { id: 'a', text: 'Mars', isCorrect: true },
      { id: 'b', text: 'Earth', isCorrect: false },
      { id: 'c', text: 'Venus', isCorrect: false },
      { id: 'd', text: 'Jupiter', isCorrect: false },
    ],
    explanationEn: 'Mars is famously known as the Red Planet due to its iron oxide surface.',
    explanationAr: 'كوكب المريخ يُعرف بالكوكب الأحمر (Mars).',
  },
  {
    id: 'l2-q10',
    levelId: 'level-2',
    sectionTitle: '🌍 General Knowledge',
    skill: 'knowledge',
    prompt: 'How many months are there in a year?',
    options: [
      { id: 'a', text: 'Ten', isCorrect: false },
      { id: 'b', text: 'Eleven', isCorrect: false },
      { id: 'c', text: 'Thirteen', isCorrect: false },
      { id: 'd', text: 'Twelve', isCorrect: true },
    ],
    explanationEn: 'There are twelve months in one calendar year.',
    explanationAr: 'عدد أشهر السنة اثنا عشر شهراً (Twelve).',
  },
  {
    id: 'l2-q11',
    levelId: 'level-2',
    sectionTitle: '🌍 General Knowledge',
    skill: 'knowledge',
    prompt: 'Which animal is known as the king of the jungle?',
    options: [
      { id: 'a', text: 'Elephant', isCorrect: false },
      { id: 'b', text: 'Tiger', isCorrect: false },
      { id: 'c', text: 'Lion', isCorrect: true },
      { id: 'd', text: 'Giraffe', isCorrect: false },
    ],
    explanationEn: 'The lion is culturally referred to as the king of the jungle.',
    explanationAr: 'الأسد يُلقب بملك الغابة (Lion).',
  },
  {
    id: 'l2-q12',
    levelId: 'level-2',
    sectionTitle: '🌍 General Knowledge',
    skill: 'knowledge',
    prompt: 'What do bees make?',
    options: [
      { id: 'a', text: 'Milk', isCorrect: false },
      { id: 'b', text: 'Honey', isCorrect: true },
      { id: 'c', text: 'Bread', isCorrect: false },
      { id: 'd', text: 'Juice', isCorrect: false },
    ],
    explanationEn: 'Bees produce honey.',
    explanationAr: 'النحل ينتج العسل اللذيذ (Honey).',
  },
  {
    id: 'l2-q13',
    levelId: 'level-2',
    sectionTitle: '🌍 General Knowledge',
    skill: 'knowledge',
    prompt: 'Which is the largest ocean in the world?',
    options: [
      { id: 'a', text: 'Atlantic Ocean', isCorrect: false },
      { id: 'b', text: 'Indian Ocean', isCorrect: false },
      { id: 'c', text: 'Pacific Ocean', isCorrect: true },
      { id: 'd', text: 'Arctic Ocean', isCorrect: false },
    ],
    explanationEn: 'The Pacific Ocean is the largest ocean on Earth.',
    explanationAr: 'المحيط الهادئ هو أكبر محيطات العالم مساحة (Pacific Ocean).',
  },
  {
    id: 'l2-q14',
    levelId: 'level-2',
    sectionTitle: '🌍 General Knowledge',
    skill: 'knowledge',
    prompt: 'What do we use to measure temperature?',
    options: [
      { id: 'a', text: 'A ruler', isCorrect: false },
      { id: 'b', text: 'A clock', isCorrect: false },
      { id: 'c', text: 'A compass', isCorrect: false },
      { id: 'd', text: 'A thermometer', isCorrect: true },
    ],
    explanationEn: 'A thermometer is the scientific instrument used to measure temperature.',
    explanationAr: 'مقياس الحرارة (الثيرمومتر - thermometer) يُستخدم لقياس درجة الحرارة.',
  },

  // 🇸🇦 Saudi Arabia & Everyday Knowledge (15-20)
  {
    id: 'l2-q15',
    levelId: 'level-2',
    sectionTitle: '🇸🇦 Saudi Arabia & Everyday Knowledge',
    skill: 'knowledge',
    prompt: 'Which city is famous for the Kaaba?',
    options: [
      { id: 'a', text: 'Makkah', isCorrect: true },
      { id: 'b', text: 'Abha', isCorrect: false },
      { id: 'c', text: 'Tabuk', isCorrect: false },
      { id: 'd', text: 'Jazan', isCorrect: false },
    ],
    explanationEn: 'The Holy Kaaba is located in Makkah Al-Mukarramah.',
    explanationAr: 'الكعبة المشرفة تقع في مكة المكرمة (Makkah).',
  },
  {
    id: 'l2-q16',
    levelId: 'level-2',
    sectionTitle: '🇸🇦 Saudi Arabia & Everyday Knowledge',
    skill: 'knowledge',
    prompt: 'Saudi Arabia is located in which continent?',
    options: [
      { id: 'a', text: 'Africa', isCorrect: false },
      { id: 'b', text: 'Europe', isCorrect: false },
      { id: 'c', text: 'Asia', isCorrect: true },
      { id: 'd', text: 'Australia', isCorrect: false },
    ],
    explanationEn: 'The Kingdom of Saudi Arabia is situated in southwest Asia.',
    explanationAr: 'تقع المملكة العربية السعودية في قارة آسيا (Asia).',
  },
  {
    id: 'l2-q17',
    levelId: 'level-2',
    sectionTitle: '🇸🇦 Saudi Arabia & Everyday Knowledge',
    skill: 'knowledge',
    prompt: 'Which color is found on the Saudi Arabian flag?',
    options: [
      { id: 'a', text: 'Green', isCorrect: true },
      { id: 'b', text: 'Blue', isCorrect: false },
      { id: 'c', text: 'Purple', isCorrect: false },
      { id: 'd', text: 'Orange', isCorrect: false },
    ],
    explanationEn: 'The flag of Saudi Arabia features green with white Arabic script.',
    explanationAr: 'اللون الأخضر (Green) هو اللون الأساسي لراية التوحيد وعلم المملكة.',
  },
  {
    id: 'l2-q18',
    levelId: 'level-2',
    sectionTitle: '🇸🇦 Saudi Arabia & Everyday Knowledge',
    skill: 'knowledge',
    prompt: 'What is the main source of energy from the sun?',
    options: [
      { id: 'a', text: 'Moonlight', isCorrect: false },
      { id: 'b', text: 'Sunlight', isCorrect: true },
      { id: 'c', text: 'Wind', isCorrect: false },
      { id: 'd', text: 'Rain', isCorrect: false },
    ],
    explanationEn: 'Sunlight is the primary form of solar energy emitted by the sun.',
    explanationAr: 'ضوء الشمس (Sunlight) هو المصدر الأساسي للطاقة الشمسية.',
  },
  {
    id: 'l2-q19',
    levelId: 'level-2',
    sectionTitle: '🇸🇦 Saudi Arabia & Everyday Knowledge',
    skill: 'knowledge',
    prompt: 'Which organ helps us breathe?',
    options: [
      { id: 'a', text: 'Heart', isCorrect: false },
      { id: 'b', text: 'Stomach', isCorrect: false },
      { id: 'c', text: 'Brain', isCorrect: false },
      { id: 'd', text: 'Lungs', isCorrect: true },
    ],
    explanationEn: 'The lungs are the organs responsible for respiration (breathing).',
    explanationAr: 'الرئتان (Lungs) هما العضو المسؤول عن التنفس وتبادل الأكسجين.',
  },
  {
    id: 'l2-q20',
    levelId: 'level-2',
    sectionTitle: '🇸🇦 Saudi Arabia & Everyday Knowledge',
    skill: 'knowledge',
    prompt: 'Which of these is a healthy drink?',
    options: [
      { id: 'a', text: 'Water', isCorrect: true },
      { id: 'b', text: 'Cola', isCorrect: false },
      { id: 'c', text: 'Energy drink', isCorrect: false },
      { id: 'd', text: 'Soda', isCorrect: false },
    ],
    explanationEn: 'Water is the healthiest and most essential natural beverage.',
    explanationAr: 'الماء (Water) هو المشروب الصحي والضروري لنشاط الجسم وصحته.',
  },
];

// =================================================================
// أسئلة المستوى الثالث: Secondary Level 3 & Life Skills (20 سؤالاً)
// =================================================================
export const LEVEL_3_QUESTIONS: PlacementQuestionItem[] = [
  // Grammar (1-5)
  {
    id: 'l3-q1',
    levelId: 'level-3',
    sectionTitle: 'Advanced Grammar & Structures',
    skill: 'grammar',
    prompt: 'If you study hard, you _______ good results.',
    options: [
      { id: 'a', text: 'get', isCorrect: false },
      { id: 'b', text: 'will get', isCorrect: true },
      { id: 'c', text: 'got', isCorrect: false },
      { id: 'd', text: 'getting', isCorrect: false },
    ],
    explanationEn: 'First Conditional: If + Present Simple (study), will + base verb (will get).',
    explanationAr: 'قاعدة الشرط الأولى (First Conditional): جملة الشرط مضارع بسيط وجواب الشرط will + المصدر (will get).',
  },
  {
    id: 'l3-q2',
    levelId: 'level-3',
    sectionTitle: 'Advanced Grammar & Structures',
    skill: 'grammar',
    prompt: 'She _______ English since 2023.',
    options: [
      { id: 'a', text: 'studies', isCorrect: false },
      { id: 'b', text: 'studied', isCorrect: false },
      { id: 'c', text: 'has studied', isCorrect: true },
      { id: 'd', text: 'studying', isCorrect: false },
    ],
    explanationEn: '"Since 2023" indicates an action starting in the past and continuing now (Present Perfect: has studied).',
    explanationAr: 'كلمة "since" تدل على حدث بدأ في الماضي ومستمر، ونستخدم معه المضارع التام (has studied).',
  },
  {
    id: 'l3-q3',
    levelId: 'level-3',
    sectionTitle: 'Advanced Grammar & Structures',
    skill: 'grammar',
    prompt: 'The project _______ by the students last week.',
    options: [
      { id: 'a', text: 'completes', isCorrect: false },
      { id: 'b', text: 'completed', isCorrect: false },
      { id: 'c', text: 'completing', isCorrect: false },
      { id: 'd', text: 'was completed', isCorrect: true },
    ],
    explanationEn: 'Past Simple Passive: was/were + past participle (was completed).',
    explanationAr: 'المبني للمجهول في الماضي (Past Passive): نستخدم was + التصريف الثالث (was completed).',
  },
  {
    id: 'l3-q4',
    levelId: 'level-3',
    sectionTitle: 'Advanced Grammar & Structures',
    skill: 'grammar',
    prompt: 'When I called Sara, she _______ dinner.',
    options: [
      { id: 'a', text: 'cooks', isCorrect: false },
      { id: 'b', text: 'cooked', isCorrect: false },
      { id: 'c', text: 'was cooking', isCorrect: true },
      { id: 'd', text: 'has cooked', isCorrect: false },
    ],
    explanationEn: 'Past Continuous expresses an ongoing activity (was cooking) when interrupted by a past call.',
    explanationAr: 'حدث كان مستمراً في الماضي عند حدوث مكالمة، فنستخدم الماضي المستمر (was cooking).',
  },
  {
    id: 'l3-q5',
    levelId: 'level-3',
    sectionTitle: 'Advanced Grammar & Structures',
    skill: 'grammar',
    prompt: 'I enjoy _______ new skills in my free time.',
    options: [
      { id: 'a', text: 'learn', isCorrect: false },
      { id: 'b', text: 'learning', isCorrect: true },
      { id: 'c', text: 'learned', isCorrect: false },
      { id: 'd', text: 'learns', isCorrect: false },
    ],
    explanationEn: 'The verb "enjoy" is followed by a gerund (-ing form: learning).',
    explanationAr: 'الفعل enjoy يأتي بعده اسم الفعل (Gerund) المنتهي بـ ing (enjoy learning).',
  },

  // 🌍 Culture, Education & Real Life (6-20)
  {
    id: 'l3-q6',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'Which habit can help students improve their concentration?',
    options: [
      { id: 'a', text: 'Sleeping very late', isCorrect: false },
      { id: 'b', text: 'Using the phone all night', isCorrect: false },
      { id: 'c', text: 'Skipping breakfast', isCorrect: false },
      { id: 'd', text: 'Taking regular short breaks', isCorrect: true },
    ],
    explanationEn: 'Taking structured, short study breaks refreshes mental focus and memory.',
    explanationAr: 'أخذ فترات راحة قصيرة ومنتظمة يساعد الدماغ على تجديد النشاط وزيادة التركيز.',
  },
  {
    id: 'l3-q7',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'What is the best way to protect your personal information online?',
    options: [
      { id: 'a', text: 'Sharing your password', isCorrect: false },
      { id: 'b', text: 'Using strong passwords', isCorrect: true },
      { id: 'c', text: 'Posting your address publicly', isCorrect: false },
      { id: 'd', text: 'Accepting every friend request', isCorrect: false },
    ],
    explanationEn: 'Using unique and complex passwords protects accounts from unauthorized access.',
    explanationAr: 'استخدام كلمات مرور قوية ومعقدة هو خط الدفاع الأول لحماية بياناتك الرقمية.',
  },
  {
    id: 'l3-q8',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'Which of these is an example of renewable energy?',
    options: [
      { id: 'a', text: 'Coal', isCorrect: false },
      { id: 'b', text: 'Oil', isCorrect: false },
      { id: 'c', text: 'Solar energy', isCorrect: true },
      { id: 'd', text: 'Natural gas', isCorrect: false },
    ],
    explanationEn: 'Solar energy is naturally replenished and does not deplete fossil reserves.',
    explanationAr: 'الطاقة الشمسية (Solar energy) هي طاقة نظيفة ومتجددة تدعم مستقبل الاستدامة.',
  },
  {
    id: 'l3-q9',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'Why is learning English useful in today’s world?',
    options: [
      { id: 'a', text: 'It can help with study, travel, and communication.', isCorrect: true },
      { id: 'b', text: 'It is only useful at school.', isCorrect: false },
      { id: 'c', text: 'It is needed only for teachers.', isCorrect: false },
      { id: 'd', text: 'It replaces all other languages.', isCorrect: false },
    ],
    explanationEn: 'English serves as an international medium for higher education, global travel, and science.',
    explanationAr: 'تعلم الإنجليزية يفتح آفاق الدراسة الأكاديمية والسفر والتواصل العالمي.',
  },
  {
    id: 'l3-q10',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'Which action helps reduce plastic waste?',
    options: [
      { id: 'a', text: 'Using reusable bags', isCorrect: true },
      { id: 'b', text: 'Buying more plastic bottles', isCorrect: false },
      { id: 'c', text: 'Throwing plastic into the sea', isCorrect: false },
      { id: 'd', text: 'Using plastic once and throwing it away', isCorrect: false },
    ],
    explanationEn: 'Using durable, reusable shopping bags significantly reduces single-use plastic pollution.',
    explanationAr: 'استخدام الأكياس القابلة لإعادة الاستخدام يقلل استهلاك البلاستيك ويحمي البيئة البحرية والبرية.',
  },
  {
    id: 'l3-q11',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'What should you do if you receive suspicious information online?',
    options: [
      { id: 'a', text: 'Share it immediately', isCorrect: false },
      { id: 'b', text: 'Send it to everyone', isCorrect: false },
      { id: 'c', text: 'Believe it automatically', isCorrect: false },
      { id: 'd', text: 'Check the source before sharing', isCorrect: true },
    ],
    explanationEn: 'Fact-checking and verifying reliable sources prevents the spread of misinformation.',
    explanationAr: 'المواطنة الرقمية الواعية تتطلب التحقق من موثوقية المصدر الرسمي قبل إعادة النشر.',
  },
  {
    id: 'l3-q12',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'Which skill is especially important when working in a team?',
    options: [
      { id: 'a', text: 'Ignoring others', isCorrect: false },
      { id: 'b', text: 'Communication', isCorrect: true },
      { id: 'c', text: 'Working alone', isCorrect: false },
      { id: 'd', text: 'Avoiding responsibility', isCorrect: false },
    ],
    explanationEn: 'Active and clear communication enables successful teamwork and collaboration.',
    explanationAr: 'مهارة التواصل الفعال (Communication) هي حجر الأساس لنجاح فرق العمل والمشاريع.',
  },
  {
    id: 'l3-q13',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'What is a healthy way to manage stress before an important exam?',
    options: [
      { id: 'a', text: 'Avoid sleeping', isCorrect: false },
      { id: 'b', text: 'Study without breaks', isCorrect: false },
      { id: 'c', text: 'Plan your time and get enough sleep', isCorrect: true },
      { id: 'd', text: 'Stop studying completely', isCorrect: false },
    ],
    explanationEn: 'Good time management combined with sufficient sleep reduces cognitive anxiety and enhances performance.',
    explanationAr: 'تنظيم جدول المذاكرة والنوم الكافي هما أفضل استراتيجية لخفض التوتر وزيادة التحصيل.',
  },
  {
    id: 'l3-q14',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'Which of the following is a good example of responsible citizenship?',
    options: [
      { id: 'a', text: 'Keeping public places clean', isCorrect: true },
      { id: 'b', text: 'Damaging public property', isCorrect: false },
      { id: 'c', text: 'Ignoring community rules', isCorrect: false },
      { id: 'd', text: 'Wasting water', isCorrect: false },
    ],
    explanationEn: 'Protecting and maintaining public spaces reflects civic responsibility and respect for community.',
    explanationAr: 'الحفاظ على نظافة المرافق العامة والحدائق يعكس المواطنة الصالحة والمسؤولية المجتمعية.',
  },
  {
    id: 'l3-q15',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'What is artificial intelligence (AI) mainly used for?',
    options: [
      { id: 'a', text: 'Replacing electricity', isCorrect: false },
      { id: 'b', text: 'Producing only video games', isCorrect: false },
      { id: 'c', text: 'Making food', isCorrect: false },
      { id: 'd', text: 'Helping computers perform tasks that usually require human intelligence', isCorrect: true },
    ],
    explanationEn: 'AI systems simulate human cognitive abilities like problem-solving, pattern recognition, and learning.',
    explanationAr: 'الذكاء الاصطناعي يهدف لمساعدة الحواسيب على محاكاة القدرات الذهنية البشرية كحل المشكلات والتحليل.',
  },
  {
    id: 'l3-q16',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'Which behavior shows good digital citizenship?',
    options: [
      { id: 'a', text: 'Respecting others online', isCorrect: true },
      { id: 'b', text: 'Sharing private photos without permission', isCorrect: false },
      { id: 'c', text: 'Writing hurtful comments', isCorrect: false },
      { id: 'd', text: 'Creating fake accounts to annoy people', isCorrect: false },
    ],
    explanationEn: 'Respecting peers, practicing empathy, and avoiding cyberbullying define good digital citizenship.',
    explanationAr: 'احترام خصوصية ومشاعر الآخرين عبر الإنترنت هو جوهر المواطنة الرقمية الصالحة.',
  },
  {
    id: 'l3-q17',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'Why is physical activity important?',
    options: [
      { id: 'a', text: 'It always makes people tired.', isCorrect: false },
      { id: 'b', text: 'It can support physical and mental health.', isCorrect: true },
      { id: 'c', text: 'It prevents learning.', isCorrect: false },
      { id: 'd', text: 'It is useful only for athletes.', isCorrect: false },
    ],
    explanationEn: 'Regular physical activity strengthens cardiovascular health and boosts mood and brain function.',
    explanationAr: 'النشاط البدني المنتظم يدعم صحة الجسم والحالة النفسية وجودة النوم والتركيز.',
  },
  {
    id: 'l3-q18',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'Which is the best way to prepare for a job interview?',
    options: [
      { id: 'a', text: 'Arrive late', isCorrect: false },
      { id: 'b', text: 'Avoid learning about the job', isCorrect: false },
      { id: 'c', text: 'Use your phone during the interview', isCorrect: false },
      { id: 'd', text: 'Research the organization and prepare answers', isCorrect: true },
    ],
    explanationEn: 'Thorough preparation and researching the company demonstrates professionalism and high motivation.',
    explanationAr: 'البحث عن تاريخ المنظمة والتحضير للأسئلة الشائعة هو مفتاح النجاح في المقابلات الوظيفية.',
  },
  {
    id: 'l3-q19',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'What does “volunteering” mean?',
    options: [
      { id: 'a', text: 'Working only for money', isCorrect: false },
      { id: 'b', text: 'Avoiding community activities', isCorrect: false },
      { id: 'c', text: 'Helping others or the community without expecting payment', isCorrect: true },
      { id: 'd', text: 'Traveling for entertainment', isCorrect: false },
    ],
    explanationEn: 'Volunteering is offering time and skills generously to support society without financial gain.',
    explanationAr: 'العمل التطوعي هو بذل الجهد والوقت لخدمة المجتمع دون انتظار مقابل مالي.',
  },
  {
    id: 'l3-q20',
    levelId: 'level-3',
    sectionTitle: '🌍 Culture, Education & Real Life',
    skill: 'life-skills',
    prompt: 'Which skill can help a young person make better decisions?',
    options: [
      { id: 'a', text: 'Critical thinking', isCorrect: true },
      { id: 'b', text: 'Following every trend', isCorrect: false },
      { id: 'c', text: 'Ignoring information', isCorrect: false },
      { id: 'd', text: 'Making decisions without thinking', isCorrect: false },
    ],
    explanationEn: 'Critical thinking helps analyze evidence logically before forming conclusions or making decisions.',
    explanationAr: 'التفكير الناقد (Critical thinking) يعلمك تحليل الخيارات وتقييم الأدلة لاتخاذ قرارات حكيمة.',
  },
];

// =================================================================
// بنك التشخيص الشامل: 24 سؤالاً موزعة بذكاء (8 من كل مستوى)
// =================================================================
export const COMPREHENSIVE_DIAGNOSTIC_QUESTIONS: PlacementQuestionItem[] = [
  // 8 questions from Level 1 (Fundamentals)
  LEVEL_1_QUESTIONS[3]!,  // How are you?
  LEVEL_1_QUESTIONS[6]!,  // I am a student
  LEVEL_1_QUESTIONS[7]!,  // She is happy
  LEVEL_1_QUESTIONS[8]!,  // They are friends
  LEVEL_1_QUESTIONS[10]!, // This is a book
  LEVEL_1_QUESTIONS[17]!, // Do you like English?
  LEVEL_1_QUESTIONS[27]!, // Thank you -> You're welcome
  LEVEL_1_QUESTIONS[35]!, // Cat is an animal

  // 8 questions from Level 2 (Intermediate)
  LEVEL_2_QUESTIONS[0]!,  // My sister studies English
  LEVEL_2_QUESTIONS[1]!,  // We went to the park yesterday
  LEVEL_2_QUESTIONS[2]!,  // Ali was watching TV
  LEVEL_2_QUESTIONS[4]!,  // Sara is taller than her sister
  LEVEL_2_QUESTIONS[5]!,  // You should drink water
  LEVEL_2_QUESTIONS[6]!,  // Capital of Saudi Arabia (Riyadh)
  LEVEL_2_QUESTIONS[12]!, // Largest ocean (Pacific)
  LEVEL_2_QUESTIONS[14]!, // City famous for Kaaba (Makkah)

  // 8 questions from Level 3 (Secondary & Advanced)
  LEVEL_3_QUESTIONS[0]!,  // If you study hard, will get
  LEVEL_3_QUESTIONS[1]!,  // has studied since 2023
  LEVEL_3_QUESTIONS[2]!,  // was completed by students
  LEVEL_3_QUESTIONS[4]!,  // enjoy learning
  LEVEL_3_QUESTIONS[6]!,  // strong passwords
  LEVEL_3_QUESTIONS[7]!,  // solar energy
  LEVEL_3_QUESTIONS[14]!, // AI definition
  LEVEL_3_QUESTIONS[19]!, // Critical thinking
];

export function getQuestionsForLevel(
  levelId: 'level-1' | 'level-2' | 'level-3' | 'comprehensive'
): PlacementQuestionItem[] {
  switch (levelId) {
    case 'level-1':
      return LEVEL_1_QUESTIONS;
    case 'level-2':
      return LEVEL_2_QUESTIONS;
    case 'level-3':
      return LEVEL_3_QUESTIONS;
    case 'comprehensive':
    default:
      return COMPREHENSIVE_DIAGNOSTIC_QUESTIONS;
  }
}
