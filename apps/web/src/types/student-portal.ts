export interface StudentPortalAvailability {
  enabled: boolean;
}

export interface StudentPortalProfile {
  studentId: string;
  tenantId: string;
  workspaceName: string;
  fullName: string;
  grade: string | null;
}

export interface StudentPortalSummary {
  completedActivities: number;
  averagePercentage: number | null;
  certificates: number;
}

export interface StudentPortalActivity {
  attemptId: string;
  sessionId: string;
  joinCode: string;
  quizTitle: string;
  mode: string;
  status: string;
  percentage: number | null;
  passed: boolean | null;
  startedAt: string;
  finishedAt: string | null;
  canResume: boolean;
}

export interface StudentPortalHome {
  profile: StudentPortalProfile;
  summary: StudentPortalSummary;
  continueActivity: StudentPortalActivity | null;
  recentActivities: StudentPortalActivity[];
}

export interface StudentPortalAccessStatus {
  hasAccessCode: boolean;
  codeSuffix: string | null;
  createdAt: string | null;
}

export interface StudentPortalAccessCode {
  studentId: string;
  accessCode: string;
  codeSuffix: string;
  createdAt: string;
}

export function normalizeStudentAccessCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
}

export function formatStudentAccessCode(value: string): string {
  const normalized = normalizeStudentAccessCode(value);
  return normalized.match(/.{1,4}/g)?.join('-') ?? normalized;
}
