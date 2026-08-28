// أنواع Phase 4 — الجلسات والمحاولات واللاعب. مطابقة لـDTOs في TeacherPlatform.Application.Sessions.

import type { QuestionType } from './questions';

export type SessionMode = 'SelfPaced' | 'Live' | 'ProgressiveChallenge';

export type SessionStatus = 'Scheduled' | 'Active' | 'Finished' | 'Cancelled';

export type AttemptStatus = 'InProgress' | 'Finished' | 'TimedOut';

export type QuizTimeMode = 'None' | 'TotalTime' | 'PerQuestion';

// ─── Teacher API ────────────────────────────────────────────────────────────

export interface ActivityLaunchRequest {
  requestId: string;
  mode: SessionMode;
  label?: string | null;
  draftBaseVersion: number;
}

export interface CreateSessionRequest {
  mode: SessionMode;
  label?: string | null;
}

export interface SessionListItem {
  id: string;
  quizId: string;
  quizTitle: string;
  joinCode: string;
  mode: SessionMode;
  status: SessionStatus;
  label: string | null;
  participantCount: number;
  attemptCount: number;
  activatedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface SessionParticipant {
  id: string;
  displayName: string;
  joinedAt: string;
  attemptId: string | null;
  attemptStatus: AttemptStatus | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
}

export interface SessionDetail {
  id: string;
  quizId: string;
  quizTitle: string;
  quizVersionId: string;
  quizVersionNumber: number;
  joinCode: string;
  mode: SessionMode;
  status: SessionStatus;
  label: string | null;
  activatedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** xmin — مطلوب لعمليات التفعيل/الإنهاء/الإلغاء (BaseVersion). */
  version: number;
  participants: SessionParticipant[];
}

export interface SessionStateChangeRequest {
  baseVersion: number;
}

// ─── Player API ─────────────────────────────────────────────────────────────

export interface PlayerSession {
  title: string;
  description: string | null;
  instructions: string | null;
  passingPercentage: number;
  timeMode: QuizTimeMode;
  timeLimitSeconds: number | null;
  questionCount: number;
  totalPoints: number;
  mode: SessionMode;
  status: SessionStatus;
  canJoin: boolean;
}

export interface JoinSessionRequest {
  displayName: string;
}

export interface JoinSessionResponse {
  participantId: string;
  displayName: string;
  attemptId: string | null;
  attemptStatus: AttemptStatus | null;
}

export interface StartAttemptResponse {
  attemptId: string;
  startedAt: string;
  deadlineAt: string | null;
  serverNow: string;
  totalQuestions: number;
  currentQuestionIndex: number;
  /** مجموع نقاط الإجابات المسجلة حتى الآن — لاستئناف عرض النقاط بعد التحديث. */
  scoreSoFar: number;
  status: AttemptStatus;
}

export interface PlayerQuestionOption {
  optionId: string;
  optionText: string;
}

export interface PlayerQuestion {
  quizVersionItemId: string;
  index: number;
  totalQuestions: number;
  questionType: QuestionType;
  prompt: string;
  points: number;
  isRequired: boolean;
  mediaAssetId: string | null;
  options: PlayerQuestionOption[];
  alreadyAnswered: boolean;
  deadlineAt: string | null;
  serverNow: string;
}

export interface SubmitAnswerRequest {
  quizVersionItemId: string;
  answerJson: string;
}

export interface SubmitAnswerResponse {
  attemptId: string;
  quizVersionItemId: string;
  isCorrect: boolean | null;
  scoreAwarded: number | null;
  revision: number;
  serverNow: string;
}

export interface FinishAttemptResponse {
  attemptId: string;
  status: AttemptStatus;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  durationMs: number;
  finishedAt: string | null;
}

export interface AttemptResult {
  attemptId: string;
  status: AttemptStatus;
  displayName: string;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  durationMs: number | null;
  answeredCount: number;
  totalQuestions: number;
  startedAt: string;
  finishedAt: string | null;
}

// ─── تسميات عربية ───────────────────────────────────────────────────────────

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  Scheduled: 'مجدولة',
  Active: 'نشطة',
  Finished: 'منتهية',
  Cancelled: 'ملغاة',
};

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  SelfPaced: 'ذاتي الإيقاع',
  Live: 'مباشر',
  ProgressiveChallenge: 'التحدي المتدرج',
};

export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  InProgress: 'قيد التنفيذ',
  Finished: 'منتهية',
  TimedOut: 'انتهت المهلة',
};
