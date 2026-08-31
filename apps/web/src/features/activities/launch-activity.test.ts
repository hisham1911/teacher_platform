import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizDraft } from '../../types/quizzes';
import type { SessionDetail } from '../../types/sessions';
import { getOrCreateActivityLaunchRequestId, launchActivity, type ActivityLaunchDependencies } from './launch-activity';

const draft: QuizDraft = {
  id: 'draft-1', quizId: 'quiz-1', versionNumber: 1, title: 'Space Adventure', description: null,
  instructions: null, passingPercentage: 50, timeMode: 'None', timeLimitSeconds: null,
  shuffleQuestions: false, shuffleOptions: false,
  theme: { template: 'default', primaryColor: '#0284c7', secondaryColor: '#0f172a', backgroundColor: '#ffffff' },
  items: [], totalPoints: 0, publicationState: 'NeverPublished', version: 7, updatedAt: '2026-08-27T00:00:00Z',
};

const activeSession: SessionDetail = {
  id: 'session-1', quizId: 'quiz-1', quizTitle: 'Space Adventure', quizVersionId: 'version-1',
  quizVersionNumber: 1, joinCode: 'SPARK123', mode: 'ProgressiveChallenge', status: 'Active',
  label: 'Space Adventure', activatedAt: '2026-08-27T00:01:00Z', finishedAt: null,
  createdAt: '2026-08-27T00:00:00Z', updatedAt: '2026-08-27T00:01:00Z', version: 4, participants: [],
};

function dependencies(session: SessionDetail = activeSession): ActivityLaunchDependencies {
  return { getDraft: vi.fn().mockResolvedValue(draft), launch: vi.fn().mockResolvedValue(session) };
}

describe('launchActivity', () => {
  beforeEach(() => sessionStorage.clear());

  it('sends one server launch request with the reviewed draft version', async () => {
    const deps = dependencies();
    const result = await launchActivity({ tenantId: 'tenant-1', quizId: 'quiz-1', mode: 'ProgressiveChallenge', draft, requestId: '7c75cfd6-0b99-4dd8-b924-5b0db95677c5' }, deps);
    expect(deps.launch).toHaveBeenCalledWith('tenant-1', 'quiz-1', {
      requestId: '7c75cfd6-0b99-4dd8-b924-5b0db95677c5', mode: 'ProgressiveChallenge', label: 'Space Adventure', draftBaseVersion: 7,
    });
    expect(result.session.status).toBe('Active');
    expect(result.activated).toBe(true);
  });

  it('keeps the same request id across retries until success', async () => {
    const first = getOrCreateActivityLaunchRequestId('tenant-1', 'quiz-1', 'SelfPaced');
    expect(getOrCreateActivityLaunchRequestId('tenant-1', 'quiz-1', 'SelfPaced')).toBe(first);
    const deps = dependencies({ ...activeSession, mode: 'SelfPaced' });
    await launchActivity({ tenantId: 'tenant-1', quizId: 'quiz-1', mode: 'SelfPaced', draft }, deps);
    expect(getOrCreateActivityLaunchRequestId('tenant-1', 'quiz-1', 'SelfPaced')).not.toBe(first);
  });

  it('leaves live launches scheduled until the teacher starts them', async () => {
    const deps = dependencies({ ...activeSession, mode: 'Live', status: 'Scheduled', activatedAt: null });
    const result = await launchActivity({ tenantId: 'tenant-1', quizId: 'quiz-1', mode: 'Live', draft, requestId: '34353d74-47d7-4e58-a36a-30223e5e719a' }, deps);
    expect(result.session.status).toBe('Scheduled');
    expect(result.activated).toBe(false);
  });
});
