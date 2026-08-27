import { quizzesApi, sessionsApi } from '../../data/api-client/endpoints';
import type { QuizDraft, PublishQuizResponse } from '../../types/quizzes';
import type { SessionDetail } from '../../types/sessions';
import type { ActivityMode } from './activity-mode';

export interface ActivityLaunchInput {
  tenantId: string;
  quizId: string;
  mode: ActivityMode;
  label?: string | null;
  draft?: QuizDraft;
}

export interface ActivityLaunchResult {
  session: SessionDetail;
  published: PublishQuizResponse | null;
  activated: boolean;
}

export interface ActivityLaunchDependencies {
  getDraft: (tenantId: string, quizId: string) => Promise<QuizDraft>;
  publish: (tenantId: string, quizId: string, baseVersion: number) => Promise<PublishQuizResponse>;
  createSession: (tenantId: string, quizId: string, mode: ActivityMode, label?: string | null) => Promise<SessionDetail>;
  activateSession: (tenantId: string, quizId: string, sessionId: string, baseVersion: number) => Promise<SessionDetail>;
}

const defaultDependencies: ActivityLaunchDependencies = {
  getDraft: (tenantId, quizId) => quizzesApi.getDraft(tenantId, quizId),
  publish: (tenantId, quizId, baseVersion) => quizzesApi.publish(tenantId, quizId, { baseVersion }),
  createSession: (tenantId, quizId, mode, label) => sessionsApi.create(tenantId, quizId, { mode, label: label ?? null }),
  activateSession: (tenantId, quizId, sessionId, baseVersion) =>
    sessionsApi.activate(tenantId, quizId, sessionId, { baseVersion }),
};

/**
 * Turns the technical Publish -> Session -> Activate pipeline into one teacher action.
 * Live sessions stay Scheduled intentionally because the teacher still needs the host screen
 * before students should begin. Self-paced and progressive activities are activated immediately.
 */
export async function launchActivity(
  input: ActivityLaunchInput,
  dependencies: ActivityLaunchDependencies = defaultDependencies,
): Promise<ActivityLaunchResult> {
  const draft = input.draft ?? await dependencies.getDraft(input.tenantId, input.quizId);
  const published = draft.publicationState === 'PublishedCurrent'
    ? null
    : await dependencies.publish(input.tenantId, input.quizId, draft.version);

  const created = await dependencies.createSession(
    input.tenantId,
    input.quizId,
    input.mode,
    input.label ?? draft.title,
  );

  if (input.mode === 'Live') {
    return { session: created, published, activated: false };
  }

  const activated = await dependencies.activateSession(
    input.tenantId,
    input.quizId,
    created.id,
    created.version,
  );

  return { session: activated, published, activated: true };
}
