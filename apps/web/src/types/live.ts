import type { QuestionType } from './questions';
import type { SessionStatus } from './sessions';

export type LivePhase = 'Lobby' | 'QuestionOpen' | 'QuestionClosed' | 'Finished';

export interface LiveControlRequest {
  baseRevision: number;
  durationSeconds?: number;
}

export interface LiveTokenResponse {
  accessToken: string;
  expiresAt: string;
}

export interface LiveQuestionOption {
  optionId: string;
  optionText: string;
}

export interface LiveQuestion {
  quizVersionItemId: string;
  index: number;
  totalQuestions: number;
  questionType: QuestionType;
  prompt: string;
  points: number;
  mediaAssetId: string | null;
  options: LiveQuestionOption[];
}

export interface LiveLeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  answeredCount: number;
}

export interface LiveSessionState {
  sessionId: string;
  sessionStatus: SessionStatus;
  phase: LivePhase;
  currentQuestionIndex: number;
  totalQuestions: number;
  questionStartedAt: string | null;
  questionClosesAt: string | null;
  serverNow: string;
  revision: number;
  participantCount: number;
  attemptCount: number;
  answeredCount: number;
  currentQuestion: LiveQuestion | null;
  leaderboard: LiveLeaderboardEntry[];
}

export const LIVE_EVENT_NAMES = [
  'LobbyUpdated',
  'SessionStarted',
  'QuestionOpened',
  'QuestionClosed',
  'LeaderboardUpdated',
  'SessionFinished',
  'LiveStateChanged',
] as const;

