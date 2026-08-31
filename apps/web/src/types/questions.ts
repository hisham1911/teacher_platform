// أنواع Phase 2 — بنك الأسئلة والوسائط. مطابقة لـDTOs في TeacherPlatform.Application.Questions.

export type QuestionType =
  | 'MultipleChoice'
  | 'TrueFalse'
  | 'ShortAnswer'
  | 'Ordering'
  | 'Listening';

export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface QuestionBank {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  createdAt: string;
}

export interface QuestionTag {
  id: string;
  name: string;
  questionCount: number;
}

export interface QuestionOptionInput {
  text: string;
  isCorrect: boolean;
}

export interface QuestionListItem {
  id: string;
  bankId: string;
  status: 'Active' | 'Archived';
  questionType: QuestionType;
  prompt: string;
  difficulty: QuestionDifficulty;
  language: 'ar' | 'en';
  currentVersionNumber: number;
  tags: string[];
  updatedAt: string;
}

export interface QuestionOption {
  id: string;
  sortOrder: number;
  optionText: string;
  isCorrect: boolean;
}

export interface QuestionVersion {
  id: string;
  versionNumber: number;
  questionType: QuestionType;
  prompt: string;
  explanation: string | null;
  difficulty: QuestionDifficulty;
  language: 'ar' | 'en';
  configJson: string;
  mediaAssetId: string | null;
  isValid: boolean;
  validationErrors: string[];
  options: QuestionOption[];
  createdAt: string;
}

export interface QuestionDetail {
  id: string;
  bankId: string;
  status: 'Active' | 'Archived';
  currentVersionNumber: number;
  tags: string[];
  currentVersion: QuestionVersion;
  createdAt: string;
  updatedAt: string;
  /** معرف الصف (xmin) — مطلوب لإرسال BaseVersion عند التعديل. */
  version: number;
}

export interface QuestionVersionSummary {
  id: string;
  versionNumber: number;
  questionType: QuestionType;
  prompt: string;
  isValid: boolean;
  createdAt: string;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CreateQuestionRequest {
  bankId: string;
  questionType: QuestionType;
  prompt: string;
  explanation?: string | null;
  difficulty?: QuestionDifficulty;
  language?: 'ar' | 'en';
  mediaAssetId?: string | null;
  tags?: string[];
  options?: QuestionOptionInput[];
  acceptedAnswers?: string[];
}

export interface BulkQuestionImportRequest {
  questions: CreateQuestionRequest[];
  quizId?: string | null;
}

export interface BulkQuestionImportResponse {
  createdCount: number;
  questionIds: string[];
  quizId: string | null;
}

export interface CreateQuestionVersionRequest {
  prompt: string;
  explanation?: string | null;
  difficulty?: QuestionDifficulty;
  language?: 'ar' | 'en';
  mediaAssetId?: string | null;
  tags?: string[];
  options?: QuestionOptionInput[];
  acceptedAnswers?: string[];
  /** الإلزامي عند التعديل — آخر Version.number رآه العميل. */
  baseVersion: number;
}

export interface MediaAsset {
  id: string;
  kind: 'Image' | 'Audio';
  mimeType: string;
  sizeBytes: number;
  originalFileName: string;
  createdAt: string;
  downloadUrl: string | null;
}

// ---------- Validation helpers (تعكس Domain validator) ----------

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MultipleChoice: 'اختيار من متعدد',
  TrueFalse: 'صح أو خطأ',
  ShortAnswer: 'إجابة قصيرة / إكمال فراغ',
  Ordering: 'ترتيب عناصر',
  Listening: 'سؤال استماع',
};

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  Easy: 'سهل',
  Medium: 'متوسط',
  Hard: 'صعب',
};

/**
 * يتحقق هل accept-extension مطابق للأنواع المدعومة.
 * لا يستخدم كإجراء أمني — للتحسين فقط؛ الفيصل في الخادم (Magic bytes).
 */
export const MEDIA_ACCEPT = {
  image: 'image/jpeg,image/png,image/webp',
  audio: 'audio/mpeg,audio/wav,audio/mp4,audio/x-m4a',
} as const;
