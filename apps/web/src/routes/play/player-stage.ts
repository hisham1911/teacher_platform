import type { PlayerSession, StartAttemptResponse } from '../../types/sessions';

export type PlayerStage =
  | { kind: 'loading' }
  | { kind: 'join'; session: PlayerSession }
  | { kind: 'ready'; session: PlayerSession; displayName: string; attemptId: string | null }
  | { kind: 'live'; session: PlayerSession; displayName: string; attemptId: string | null }
  | { kind: 'playing'; attempt: StartAttemptResponse; session: PlayerSession }
  | { kind: 'challenge-ready'; session: PlayerSession; displayName: string; attemptId: string | null }
  | { kind: 'challenge'; attempt: StartAttemptResponse; session: PlayerSession }
  | { kind: 'result'; attemptId: string; session: PlayerSession | null }
  | { kind: 'unavailable'; message: string };
