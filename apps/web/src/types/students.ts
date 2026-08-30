import type { AttemptStatus, SessionMode } from './sessions';

export interface Student {
  id: string;
  fullName: string;
  studentCode: string;
  grade: string | null;
  notes: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentRequest {
  fullName: string;
  grade?: string | null;
  notes?: string | null;
}

export interface UpdateStudentRequest {
  fullName: string;
  grade?: string | null;
  notes?: string | null;
  baseVersion: number;
}

export interface StudentStatusRequest {
  isActive: boolean;
  baseVersion: number;
}

export interface RegenerateStudentCodeRequest {
  baseVersion: number;
}

export interface StudentResult {
  attemptId: string;
  sessionId: string;
  quizId: string;
  quizTitle: string;
  sessionLabel: string | null;
  mode: SessionMode;
  status: AttemptStatus;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  startedAt: string;
  finishedAt: string | null;
}

export function normalizeStudentCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export function formatStudentCode(value: string): string {
  const normalized = normalizeStudentCode(value);
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}
