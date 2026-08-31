import { quizzesApi, sessionsApi } from '../../data/api-client/endpoints';
import type { QuizDraft } from '../../types/quizzes';
import type { ActivityLaunchRequest, SessionDetail } from '../../types/sessions';
import type { ActivityMode } from './activity-mode';

export interface ActivityLaunchInput {
  tenantId: string;
  quizId: string;
  mode: ActivityMode;
  label?: string | null;
  draft?: QuizDraft;
  requestId?: string;
}

export interface ActivityLaunchResult {
  session: SessionDetail;
  activated: boolean;
}

export interface ActivityLaunchDependencies {
  getDraft: (tenantId: string, quizId: string) => Promise<QuizDraft>;
  launch: (tenantId: string, quizId: string, payload: ActivityLaunchRequest) => Promise<SessionDetail>;
}

const defaultDependencies: ActivityLaunchDependencies = {
  getDraft: (tenantId, quizId) => quizzesApi.getDraft(tenantId, quizId),
  launch: (tenantId, quizId, payload) => sessionsApi.launch(tenantId, quizId, payload),
};

function launchStorageKey(tenantId: string, quizId: string, mode: ActivityMode) {
  return `tp-activity-launch:${tenantId}:${quizId}:${mode}`;
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = character === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

export function getOrCreateActivityLaunchRequestId(tenantId: string, quizId: string, mode: ActivityMode): string {
  const key = launchStorageKey(tenantId, quizId, mode);
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = createUuid();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return createUuid();
  }
}

export function clearActivityLaunchRequestId(tenantId: string, quizId: string, mode: ActivityMode) {
  try {
    sessionStorage.removeItem(launchStorageKey(tenantId, quizId, mode));
  } catch {
    // Storage can be blocked; correctness still comes from the server request id.
  }
}

/** One teacher action maps to one retry-safe server use case. */
export async function launchActivity(
  input: ActivityLaunchInput,
  dependencies: ActivityLaunchDependencies = defaultDependencies,
): Promise<ActivityLaunchResult> {
  const draft = input.draft ?? await dependencies.getDraft(input.tenantId, input.quizId);
  const requestId = input.requestId ?? getOrCreateActivityLaunchRequestId(input.tenantId, input.quizId, input.mode);
  const session = await dependencies.launch(input.tenantId, input.quizId, {
    requestId,
    mode: input.mode,
    label: input.label ?? draft.title,
    draftBaseVersion: draft.version,
  });
  clearActivityLaunchRequestId(input.tenantId, input.quizId, input.mode);
  return { session, activated: session.status === 'Active' };
}
