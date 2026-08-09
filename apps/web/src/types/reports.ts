import type { AttemptStatus, SessionStatus } from './sessions';

export type DifficultySignal =
  | 'InsufficientData'
  | 'LowDifficulty'
  | 'ModerateDifficulty'
  | 'HighDifficulty';

export interface SessionReportSummary {
  participantCount: number;
  attemptCount: number;
  completedCount: number;
  inProgressCount: number;
  timedOutCount: number;
  passedCount: number;
  failedCount: number;
  averagePercentage: number | null;
  averageDurationMs: number | null;
}

export interface QuestionAnalytics {
  quizVersionItemId: string;
  questionVersionId: string;
  sortOrder: number;
  prompt: string;
  questionType: string;
  points: number;
  answerCount: number;
  correctCount: number;
  incorrectCount: number;
  successPercentage: number | null;
  averageScorePercentage: number | null;
  difficultySignal: DifficultySignal;
}

export interface SessionReport {
  sessionId: string;
  quizId: string;
  quizTitle: string;
  sessionLabel: string | null;
  sessionStatus: SessionStatus;
  activatedAt: string | null;
  finishedAt: string | null;
  summary: SessionReportSummary;
  questions: QuestionAnalytics[];
}

export interface ReportAttemptListItem {
  attemptId: string;
  participantId: string;
  displayName: string;
  status: AttemptStatus;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface AttemptQuestionResult {
  quizVersionItemId: string;
  questionVersionId: string;
  sortOrder: number;
  prompt: string;
  questionType: string;
  pointsPossible: number;
  answered: boolean;
  answerSummary: string | null;
  isCorrect: boolean | null;
  scoreAwarded: number | null;
  answeredAt: string | null;
}

export interface AttemptDetail {
  attemptId: string;
  sessionId: string;
  quizId: string;
  quizTitle: string;
  sessionLabel: string | null;
  participantId: string;
  displayName: string;
  status: AttemptStatus;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
  questions: AttemptQuestionResult[];
}

export const DIFFICULTY_SIGNAL_LABELS: Record<DifficultySignal, string> = {
  InsufficientData: 'بيانات غير كافية',
  LowDifficulty: 'أداء مرتفع',
  ModerateDifficulty: 'أداء متوسط',
  HighDifficulty: 'يحتاج مراجعة',
};
