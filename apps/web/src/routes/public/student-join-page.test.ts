import { describe, expect, it } from 'vitest';
import { extractJoinCode, normalizeJoinCode } from './student-join-input';

describe('student join input', () => {
  it('normalizes a plain activity code', () => {
    expect(normalizeJoinCode(' spark-123 ')).toBe('SPARK123');
  });

  it('extracts the activity code from a full play URL', () => {
    expect(extractJoinCode('https://example.com/play/Spark-123?_vercel_share=test')).toBe('SPARK123');
  });

  it('extracts the activity code from a relative play path', () => {
    expect(extractJoinCode('/play/ABC987')).toBe('ABC987');
  });
});
