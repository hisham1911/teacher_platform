import type { QuestionType } from '../../types/questions';
import type { SessionMode } from '../../types/sessions';

export type ActivityMode = SessionMode;

export interface ActivityModeDefinition {
  mode: ActivityMode;
  title: string;
  description: string;
  badge: string;
  recommendedFor: string;
  allowedQuestionTypes: readonly QuestionType[];
}

const ALL_QUESTION_TYPES: readonly QuestionType[] = [
  'MultipleChoice',
  'TrueFalse',
  'ShortAnswer',
  'Ordering',
  'Listening',
];

const PROGRESSIVE_QUESTION_TYPES: readonly QuestionType[] = [
  'MultipleChoice',
  'TrueFalse',
  'Listening',
];

export const ACTIVITY_MODES: readonly ActivityModeDefinition[] = [
  {
    mode: 'ProgressiveChallenge',
    title: 'التحدي المتدرج',
    description: 'كل إجابة صحيحة تصعد بالطالب مستوى، وأول خطأ ينهي التحدي.',
    badge: 'الأكثر تشويقًا',
    recommendedFor: 'مراجعة المفردات والتدرج من السهل إلى الصعب',
    allowedQuestionTypes: PROGRESSIVE_QUESTION_TYPES,
  },
  {
    mode: 'SelfPaced',
    title: 'اختبار فردي',
    description: 'كل طالب يحل في وقته ويستكمل محاولته بشكل مستقل.',
    badge: 'سهل ومباشر',
    recommendedFor: 'الواجبات والمراجعات والاختبارات الفردية',
    allowedQuestionTypes: ALL_QUESTION_TYPES,
  },
  {
    mode: 'Live',
    title: 'مسابقة مباشرة',
    description: 'المعلم يفتح الأسئلة للجميع أثناء الحصة ويتابع التفاعل لحظيًا.',
    badge: 'للفصل',
    recommendedFor: 'الحصص والمسابقات الجماعية',
    allowedQuestionTypes: ALL_QUESTION_TYPES,
  },
] as const;

export function parseActivityMode(value: string | null | undefined): ActivityMode {
  return value === 'SelfPaced' || value === 'Live' ? value : 'ProgressiveChallenge';
}

export function getActivityModeDefinition(mode: ActivityMode): ActivityModeDefinition {
  return ACTIVITY_MODES.find((definition) => definition.mode === mode) ?? ACTIVITY_MODES[0];
}

export function isQuestionTypeAllowedForActivity(mode: ActivityMode, questionType: QuestionType): boolean {
  return getActivityModeDefinition(mode).allowedQuestionTypes.includes(questionType);
}
