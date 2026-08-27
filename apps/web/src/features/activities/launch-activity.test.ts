import { describe, expect, it, vi } from 'vitest';
import type { QuizDraft } from '../../types/quizzes';
import type { SessionDetail } from '../../types/sessions';
import { launchActivity, type ActivityLaunchDependencies } from './launch-activity';

const draft: QuizDraft = {
  id: 'draft-1',
  quizId: 'quiz-1',
  versionNumber: 1,
  title: 'Space Adventure',
  description: null,
  instructions: null,
  passingPercentage: 50,
  timeMode: 'None',
  timeLimitSeconds: null,
  shuffleQuestions: false,
  shuffleOptions: false,
  theme: { template: 'default', primaryColor: '#0284c7', secondaryColor: '#0f172a', backgroundColor: '#ffffff' },
  items: [],
  totalPoints: 0,
  publicationState: 'NeverPublished',
  version: 7,
  updatedAt: '2026-08-27T00:00:00Z',
};

const scheduledSession: SessionDetail = {
  id: 'session-1',
  quizId: 'quiz-1',
  quizTitle: 'Space Adventure',
  quizVersionId: 'version-1',
  quizVersionNumber: 1,
  joinCode: 'SPARK123',
  mode: 'ProgressiveChallenge',
  status: 'Scheduled',
  label: 'Space Adventure',
  activatedAt: null,
  finishedAt: null,
  createdAt: '2026-08-27T00:00:00Z',
  updatedAt: '2026-08-27T00:00:00Z',
  version: 3,
  participants: [],
};

function dependencies(): ActivityLaunchDependencies {
  return {
    getDraft: vi.fn().mockResolvedValue(draft),
    publish: vi.fn().mockResolvedValue({
      quizId: 'quiz-1',
      publishedVersionId: 'version-1',
      versionNumber: 1,
      publishedAt: '2026-08-27T00:00:00Z',
      checksum: 'abc',
      publicCode: 'PUBLIC',
      shareUrl: '/q/PUBLIC',
    }),
    createSession: vi.fn().mockResolvedValue(scheduledSession),
    activateSession: vi.fn().mockResolvedValue({ ...scheduledSession, status: 'Active', activatedAt: '2026-08-27T00:01:00Z', version: 4 }),
  };
}

describe('launchActivity', () => {
  it('publishes, creates and activates self-running activities', async () => {
    const deps = dependencies();

    const result = await launchActivity({
      tenantId: 'tenant-1',
      quizId: 'quiz-1',
      mode: 'ProgressiveChallenge',
      draft,
    }, deps);

    expect(deps.publish).toHaveBeenCalledWith('tenant-1', 'quiz-1', 7);
    expect(deps.createSession).toHaveBeenCalledWith('tenant-1', 'quiz-1', 'ProgressiveChallenge', 'Space Adventure');
    expect(deps.activateSession).toHaveBeenCalledWith('tenant-1', 'quiz-1', 'session-1', 3);
    expect(result.session.status).toBe('Active');
    expect(result.activated).toBe(true);
  });

  it('does not republish an unchanged published draft', async () => {
    const deps = dependencies();
    const publishedDraft = { ...draft, publicationState: 'PublishedCurrent' as const };

    await launchActivity({ tenantId: 'tenant-1', quizId: 'quiz-1', mode: 'SelfPaced', draft: publishedDraft }, deps);

    expect(deps.publish).not.toHaveBeenCalled();
  });

  it('keeps live activities scheduled for the host screen', async () => {
    const deps = dependencies();

    const result = await launchActivity({ tenantId: 'tenant-1', quizId: 'quiz-1', mode: 'Live', draft }, deps);

    expect(deps.activateSession).not.toHaveBeenCalled();
    expect(result.session.status).toBe('Scheduled');
    expect(result.activated).toBe(false);
  });
});
