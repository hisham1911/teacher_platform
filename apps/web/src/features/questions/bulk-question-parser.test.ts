import { describe, expect, it } from 'vitest';
import { BULK_QUESTION_SAMPLE, bulkQuestionRowToRequest, parseBulkQuestionRows } from './bulk-question-parser';

describe('bulk question parser', () => {
  it('parses the tab-separated sample into valid questions', () => {
    const rows = parseBulkQuestionRows(BULK_QUESTION_SAMPLE, { mode: 'ProgressiveChallenge', enforceActivityCompatibility: true });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.errors.length === 0)).toBe(true);
    expect(rows[0]?.prompt).toContain('Red Planet');
    expect(rows[0]?.correctIndex).toBe(1);
  });

  it('accepts quoted CSV cells containing commas', () => {
    const csv = 'type,prompt,A,B,C,D,correct,difficulty,language,tags,explanation\nMultipleChoice,"Choose the correct sentence, please",One,Two,Three,Four,C,Medium,en,"grammar,unit-1","A short, useful explanation"';
    const rows = parseBulkQuestionRows(csv, { mode: 'SelfPaced', enforceActivityCompatibility: true });
    expect(rows[0]?.errors).toEqual([]);
    expect(rows[0]?.prompt).toBe('Choose the correct sentence, please');
    expect(rows[0]?.tags).toEqual(['grammar', 'unit-1']);
  });

  it('marks invalid answers before any API call is attempted', () => {
    const csv = 'MultipleChoice,Question,A,B,,,D,Easy,en';
    const rows = parseBulkQuestionRows(csv, { mode: 'SelfPaced', enforceActivityCompatibility: true });
    expect(rows[0]?.errors.join(' ')).toContain('الإجابة الصحيحة');
  });

  it('builds the same create request shape used by the single-question API', () => {
    const row = parseBulkQuestionRows('TrueFalse,The sky is blue,True,False,,,A,Easy,en,science,Explanation', { mode: 'ProgressiveChallenge', enforceActivityCompatibility: true })[0]!;
    const request = bulkQuestionRowToRequest(row, 'bank-1');
    expect(request.bankId).toBe('bank-1');
    expect(request.questionType).toBe('TrueFalse');
    expect(request.options?.filter((option) => option.isCorrect)).toHaveLength(1);
  });
});
