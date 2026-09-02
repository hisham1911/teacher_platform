import { getActiveTenantId, getSessionSnapshot } from '../../lib/auth/session';
import type { Assignment, AssignmentDetail, AssignmentResult, Classroom, ClassroomDetail, CreateAssignmentPayload, StartStudentTaskResponse, StudentTask } from '../../types/phase2';
import { authApi, resolveBaseUrl } from './endpoints';
import { HttpError } from './http-error';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function teacherRequest<T>(tenantId: string, path: string, method: Method = 'GET', body?: unknown, signal?: AbortSignal, retried = false): Promise<T> {
  const session = getSessionSnapshot();
  if (!session.accessToken || getActiveTenantId() !== tenantId) throw new HttpError(401, null);
  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method,
    credentials: 'include',
    signal,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      'X-Tenant-Id': tenantId,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401 && !retried) {
    await authApi.me(signal);
    return teacherRequest<T>(tenantId, path, method, body, signal, true);
  }
  if (!response.ok) throw new HttpError(response.status, await response.json().catch(() => null));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function studentRequest<T>(path: string, method: Method = 'GET', signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${resolveBaseUrl()}${path}`, { method, credentials: 'include', signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new HttpError(response.status, await response.json().catch(() => null));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const classroomsApi = {
  list: (tenantId: string, includeInactive = false, signal?: AbortSignal) => teacherRequest<Classroom[]>(tenantId, `/api/v1/tenants/${tenantId}/classrooms?includeInactive=${includeInactive}`, 'GET', undefined, signal),
  get: (tenantId: string, classroomId: string, signal?: AbortSignal) => teacherRequest<ClassroomDetail>(tenantId, `/api/v1/tenants/${tenantId}/classrooms/${classroomId}`, 'GET', undefined, signal),
  create: (tenantId: string, payload: { name: string; academicYear?: string | null }, signal?: AbortSignal) => teacherRequest<ClassroomDetail>(tenantId, `/api/v1/tenants/${tenantId}/classrooms`, 'POST', payload, signal),
  update: (tenantId: string, classroomId: string, payload: { name: string; academicYear?: string | null; baseVersion: number }, signal?: AbortSignal) => teacherRequest<ClassroomDetail>(tenantId, `/api/v1/tenants/${tenantId}/classrooms/${classroomId}`, 'PUT', payload, signal),
  setActive: (tenantId: string, classroomId: string, isActive: boolean, baseVersion: number, signal?: AbortSignal) => teacherRequest<ClassroomDetail>(tenantId, `/api/v1/tenants/${tenantId}/classrooms/${classroomId}/status`, 'POST', { isActive, baseVersion }, signal),
  addStudent: (tenantId: string, classroomId: string, studentId: string, signal?: AbortSignal) => teacherRequest<ClassroomDetail>(tenantId, `/api/v1/tenants/${tenantId}/classrooms/${classroomId}/students`, 'POST', { studentId }, signal),
  removeStudent: (tenantId: string, classroomId: string, studentId: string, signal?: AbortSignal) => teacherRequest<void>(tenantId, `/api/v1/tenants/${tenantId}/classrooms/${classroomId}/students/${studentId}`, 'DELETE', undefined, signal),
};

export const assignmentsApi = {
  list: (tenantId: string, signal?: AbortSignal) => teacherRequest<Assignment[]>(tenantId, `/api/v1/tenants/${tenantId}/assignments`, 'GET', undefined, signal),
  get: (tenantId: string, assignmentId: string, signal?: AbortSignal) => teacherRequest<AssignmentDetail>(tenantId, `/api/v1/tenants/${tenantId}/assignments/${assignmentId}`, 'GET', undefined, signal),
  create: (tenantId: string, payload: CreateAssignmentPayload, signal?: AbortSignal) => teacherRequest<AssignmentDetail>(tenantId, `/api/v1/tenants/${tenantId}/assignments`, 'POST', payload, signal),
  results: (tenantId: string, assignmentId: string, signal?: AbortSignal) => teacherRequest<AssignmentResult[]>(tenantId, `/api/v1/tenants/${tenantId}/assignments/${assignmentId}/results`, 'GET', undefined, signal),
};

export const studentTasksApi = {
  list: (signal?: AbortSignal) => studentRequest<StudentTask[]>('/api/v1/student-portal/tasks', 'GET', signal),
  start: (assignmentId: string, signal?: AbortSignal) => studentRequest<StartStudentTaskResponse>(`/api/v1/student-portal/tasks/${assignmentId}/start`, 'POST', signal),
};
