export interface Classroom {
  id: string;
  name: string;
  academicYear: string | null;
  isActive: boolean;
  studentCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassroomStudent {
  id: string;
  fullName: string;
  grade: string | null;
  isActive: boolean;
  addedAt: string;
}

export interface ClassroomDetail extends Classroom {
  students: ClassroomStudent[];
}

export interface AssignmentRecipient {
  studentId: string;
  studentName: string;
  sourceClassroomId: string | null;
  sourceClassroomName: string | null;
}

export interface Assignment {
  id: string;
  quizVersionId: string;
  quizId: string;
  activityTitle: string;
  availableAt: string | null;
  dueAt: string | null;
  recipientCount: number;
  startedCount: number;
  completedCount: number;
  version: number;
  createdAt: string;
}

export interface AssignmentDetail extends Assignment {
  recipients: AssignmentRecipient[];
}

export interface AssignmentResult {
  studentId: string;
  studentName: string;
  attemptId: string | null;
  status: string | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
}

export type StudentTaskState = 'Upcoming' | 'New' | 'InProgress' | 'Completed';

export interface StudentTask {
  id: string;
  activityTitle: string;
  state: StudentTaskState;
  availableAt: string | null;
  dueAt: string | null;
  progressPercentage: number;
  score: number | null;
  maxScore: number | null;
  resultPercentage: number | null;
  passed: boolean | null;
  certificateId: string | null;
}

export interface StartStudentTaskResponse {
  assignmentId: string;
  joinCode: string;
  participantId: string;
  attemptId: string | null;
  attemptStatus: string | null;
}

export interface CreateAssignmentPayload {
  quizVersionId: string;
  classroomIds: string[];
  studentIds: string[];
  availableAt?: string | null;
  dueAt?: string | null;
}
