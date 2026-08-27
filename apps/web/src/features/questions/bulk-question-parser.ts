import { isQuestionTypeAllowedForActivity, type ActivityMode } from '../activities/activity-mode';
import type { CreateQuestionRequest, QuestionDifficulty, QuestionType } from '../../types/questions';

export const BULK_QUESTION_SAMPLE = `type\tprompt\tA\tB\tC\tD\tcorrect\tdifficulty\tlanguage\ttags\texplanation
MultipleChoice\tWhich planet is known as the Red Planet?\tEarth\tMars\tVenus\tJupiter\tB\tEasy\ten\tspace,vocabulary\tMars is known as the Red Planet.
TrueFalse\tThe Sun is a star.\tTrue\tFalse\t\t\tA\tEasy\ten\tspace\tThe Sun is the star at the center of our solar system.`;

export type BulkQuestionRow = {
  row: number;
  type: QuestionType | null;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  difficulty: QuestionDifficulty;
  language: 'ar' | 'en';
  tags: string[];
  explanation: string | null;
  errors: string[];
};

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeType(value: string): QuestionType | null {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (['multiplechoice', 'mcq', 'اختيارمنمتعدد'].includes(normalized)) return 'MultipleChoice';
  if (['truefalse', 'tf', 'صحخطأ', 'صحاوخطأ'].includes(normalized)) return 'TrueFalse';
  return null;
}

function normalizeDifficulty(value: string): QuestionDifficulty {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'easy' || normalized === 'سهل') return 'Easy';
  if (normalized === 'hard' || normalized === 'صعب') return 'Hard';
  return 'Medium';
}

export function parseBulkQuestionRows(raw: string, options: { mode: ActivityMode; enforceActivityCompatibility: boolean }): BulkQuestionRow[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = lines.some((line) => line.includes('\t')) ? '\t' : ',';
  const first = parseDelimitedLine(lines[0]!, delimiter);
  const hasHeader = first[0]?.trim().toLowerCase() === 'type' || first[1]?.trim().toLowerCase() === 'prompt';
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, index) => {
    const cells = parseDelimitedLine(line, delimiter);
    const type = normalizeType(cells[0] ?? '');
    const prompt = (cells[1] ?? '').trim();
    const rowOptions = [cells[2], cells[3], cells[4], cells[5]].map((value) => (value ?? '').trim()).filter(Boolean);
    const correctToken = (cells[6] ?? '').trim().toUpperCase();
    const numericAnswer = Number(correctToken);
    const correctIndex = /^[A-D]$/.test(correctToken)
      ? correctToken.charCodeAt(0) - 65
      : Number.isInteger(numericAnswer) && numericAnswer >= 1
        ? numericAnswer - 1
        : null;
    const difficulty = normalizeDifficulty(cells[7] ?? 'Medium');
    const language = (cells[8] ?? 'en').trim().toLowerCase() === 'ar' ? 'ar' : 'en';
    const tags = (cells[9] ?? '').split(/[،,]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
    const explanation = (cells[10] ?? '').trim() || null;
    const errors: string[] = [];

    if (!type) errors.push('النوع يجب أن يكون MultipleChoice أو TrueFalse.');
    if (options.enforceActivityCompatibility && type && !isQuestionTypeAllowedForActivity(options.mode, type)) errors.push('نوع السؤال غير متوافق مع طريقة اللعب الحالية.');
    if (prompt.length < 1) errors.push('نص السؤال مطلوب.');
    if (prompt.length > 2000) errors.push('نص السؤال أطول من الحد المسموح.');
    if (type === 'TrueFalse' && rowOptions.length !== 2) errors.push('صح/خطأ يحتاج خيارين بالضبط.');
    if (type === 'MultipleChoice' && (rowOptions.length < 2 || rowOptions.length > 10)) errors.push('الاختيار من متعدد يحتاج 2–10 اختيارات.');
    if (correctIndex == null || correctIndex < 0 || correctIndex >= rowOptions.length) errors.push('الإجابة الصحيحة يجب أن تكون A/B/C/D أو رقمًا صحيحًا.');

    return {
      row: index + (hasHeader ? 2 : 1),
      type,
      prompt,
      options: rowOptions,
      correctIndex,
      difficulty,
      language,
      tags,
      explanation,
      errors,
    };
  });
}

export function bulkQuestionRowToRequest(row: BulkQuestionRow, bankId: string): CreateQuestionRequest {
  if (!row.type || row.correctIndex == null || row.errors.length > 0) {
    throw new Error('Cannot convert an invalid bulk question row.');
  }
  return {
    bankId,
    questionType: row.type,
    prompt: row.prompt,
    explanation: row.explanation,
    difficulty: row.difficulty,
    language: row.language,
    tags: row.tags,
    options: row.options.map((text, index) => ({ text, isCorrect: index === row.correctIndex })),
  };
}
