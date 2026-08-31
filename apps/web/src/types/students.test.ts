import { describe, expect, it } from 'vitest';
import { formatStudentCode, normalizeStudentCode } from './students';

describe('student code helpers', () => {
  it('normalizes pasted codes without ambiguous formatting characters', () => {
    expect(normalizeStudentCode(' abcd-23 78 ')).toBe('ABCD2378');
  });

  it('limits input to the persisted code maximum', () => {
    expect(normalizeStudentCode('abcdefghijklmnop')).toHaveLength(12);
  });

  it('formats a code for display without changing its stored value', () => {
    expect(formatStudentCode('abcd2378')).toBe('ABCD-2378');
  });
});
