// أنواع Phase 3 — منشئ الاختبارات والنشر. مطابقة لـDTOs في TeacherPlatform.Application.Quizzes.

import type { QuestionDifficulty, QuestionType } from './questions';

export type QuizStatus = 'Draft' | 'Published' | 'Archived';
export type QuizTimeMode = 'None' | 'TotalTime' | 'PerQuestion';

export interface QuizListItem {
  id: string;
  title: string;
  slug: string;
  status: QuizStatus;
  currentPublishedVersionNumber: number | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuizDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: QuizStatus;
  currentDraftVersionId: string | null;
  currentPublishedVersionId: string | null;
  currentPublishedVersionNumber: number | null;
  publicCode: string;
  subjectId: string | null;
  gradeId: string | null;
  createdAt: string;
  updatedAt: string;
  /** معرف الصف (xmin) — مطلوب لإرسال BaseVersion عند التعديل. */
  version: number;
}

export interface CreateQuizRequest {
  title: string;
  slug: string;
  description?: string | null;
  subjectId?: string | null;
  gradeId?: string | null;
}

export interface UpdateQuizRequest {
  title: string;
  slug: string;
  description?: string | null;
  subjectId?: string | null;
  gradeId?: string | null;
  /** الإلزامي عند التعديل — آخر Version.number رآه العميل. */
  baseVersion: number;
}

/** Theme آمن: قالب من قائمة مسموحة + ألوان فقط — لا CSS/HTML/JS خام. */
export interface QuizTheme {
  template: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
}

export interface UpdateDraftRequest {
  title: string;
  description?: string | null;
  instructions?: string | null;
  passingPercentage: number;
  timeMode: QuizTimeMode;
  timeLimitSeconds?: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  theme: QuizTheme;
  /** الإلزامي عند التعديل — آخر Version.number رآه العميل. */
  baseVersion: number;
}

export interface AddQuizItemRequest {
  questionId: string;
  points?: number;
  isRequired?: boolean;
}

export interface UpdateQuizItemRequest {
  points: number;
  isRequired: boolean;
}

export interface ReorderItemsRequest {
  orderedItemIds: string[];
}

/** GAP-C: طلب تثبيت أحدث نسخة من السؤال على عنصر مسودة — BaseVersion للتزامن المتفائل (409 عند عدم التطابق). */
export interface UseLatestItemVersionRequest {
  baseVersion: number;
}

export interface QuizDraftItemOption {
  sortOrder: number;
  optionText: string;
  isCorrect: boolean;
}

export interface QuizDraftItem {
  id: string;
  questionVersionId: string;
  questionId: string;
  sortOrder: number;
  points: number;
  isRequired: boolean;
  questionType: QuestionType;
  prompt: string;
  explanation: string | null;
  difficulty: QuestionDifficulty;
  language: 'ar' | 'en';
  configJson: string;
  mediaAssetId: string | null;
  options: QuizDraftItemOption[];
  /** رقم نسخة السؤال المثبتة في الاختبار. */
  pinnedVersionNumber: number;
  /** رقم أحدث نسخة من السؤال المصدر — إن كان أكبر من المثبت يظهر تنبيه "توجد نسخة أحدث". */
  latestVersionNumber: number;
  sourceQuestionArchived: boolean;
}

export interface QuizDraft {
  id: string;
  quizId: string;
  versionNumber: number;
  title: string;
  description: string | null;
  instructions: string | null;
  passingPercentage: number;
  timeMode: QuizTimeMode;
  timeLimitSeconds: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  theme: QuizTheme;
  items: QuizDraftItem[];
  totalPoints: number;
  /** معرف الصف (xmin) — مطلوب لإرسال BaseVersion عند التعديل. */
  version: number;
  updatedAt: string;
}

export interface QuizVersionSummary {
  id: string;
  versionNumber: number;
  status: 'Draft' | 'Published' | 'Retired';
  itemCount: number;
  totalPoints: number;
  publishedAt: string | null;
  checksum: string | null;
  createdAt: string;
}

export interface QuizPublishedVersion {
  id: string;
  quizId: string;
  versionNumber: number;
  title: string;
  description: string | null;
  instructions: string | null;
  passingPercentage: number;
  timeMode: QuizTimeMode;
  timeLimitSeconds: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  theme: QuizTheme;
  items: QuizDraftItem[];
  totalPoints: number;
  publishedAt: string | null;
  checksum: string | null;
}

export interface PublishQuizRequest {
  /** الإلزامي — آخر Version.number رآه العميل للمسودة. */
  baseVersion: number;
}

export interface PublishQuizResponse {
  quizId: string;
  publishedVersionId: string;
  versionNumber: number;
  publishedAt: string;
  checksum: string;
  publicCode: string;
  shareUrl: string;
}

export interface QuizShare {
  quizId: string;
  publicCode: string;
  shareUrl: string;
  status: QuizStatus;
  publishedVersionNumber: number | null;
}

/** بيانات الصفحة العامة الآمنة فقط — لا أسئلة ولا إجابات ولا درجات. */
export interface PublicQuizPage {
  title: string;
  description: string | null;
  instructions: string | null;
  passingPercentage: number;
  timeMode: QuizTimeMode;
  timeLimitSeconds: number | null;
  questionCount: number;
  totalPoints: number;
  theme: QuizTheme;
  available: boolean;
}

// ---------- Labels ----------

export const QUIZ_STATUS_LABELS: Record<QuizStatus, string> = {
  Draft: 'مسودة',
  Published: 'منشور',
  Archived: 'مؤرشف',
};

export const TIME_MODE_LABELS: Record<QuizTimeMode, string> = {
  None: 'بدون وقت',
  TotalTime: 'وقت إجمالي',
  PerQuestion: 'وقت لكل سؤال',
};

export const QUIZ_VERSION_STATUS_LABELS: Record<QuizVersionSummary['status'], string> = {
  Draft: 'مسودة',
  Published: 'منشور',
  Retired: 'سابق',
};

/** قوالب السمات المسموحة — يجب أن تطابق قائمة الخادم. */
export const QUIZ_THEME_TEMPLATES = ['default', 'classic', 'playful'] as const;
export type QuizThemeTemplate = (typeof QUIZ_THEME_TEMPLATES)[number];

export const QUIZ_THEME_TEMPLATE_LABELS: Record<QuizThemeTemplate, string> = {
  default: 'افتراضي',
  classic: 'كلاسيكي',
  playful: 'مرح',
};
