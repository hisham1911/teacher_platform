import { describe, expect, it } from 'vitest';
import {
  getActivityModeDefinition,
  isQuestionTypeAllowedForActivity,
  parseActivityMode,
} from './activity-mode';

describe('activity mode model', () => {
  it('defaults unknown values to ProgressiveChallenge', () => {
    expect(parseActivityMode(null)).toBe('ProgressiveChallenge');
    expect(parseActivityMode('unknown')).toBe('ProgressiveChallenge');
  });

  it('keeps supported session modes unchanged', () => {
    expect(parseActivityMode('SelfPaced')).toBe('SelfPaced');
    expect(parseActivityMode('Live')).toBe('Live');
    expect(parseActivityMode('ProgressiveChallenge')).toBe('ProgressiveChallenge');
  });

  it('restricts progressive activities to objective question types', () => {
    expect(isQuestionTypeAllowedForActivity('ProgressiveChallenge', 'MultipleChoice')).toBe(true);
    expect(isQuestionTypeAllowedForActivity('ProgressiveChallenge', 'Listening')).toBe(true);
    expect(isQuestionTypeAllowedForActivity('ProgressiveChallenge', 'Ordering')).toBe(false);
    expect(isQuestionTypeAllowedForActivity('ProgressiveChallenge', 'ShortAnswer')).toBe(false);
    expect(getActivityModeDefinition('ProgressiveChallenge').allowedQuestionTypes).toHaveLength(3);
  });
});
