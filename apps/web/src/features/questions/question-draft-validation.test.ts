import { describe, expect, it } from 'vitest';
import { validateQuestionDraft } from './question-draft-validation';
import type { QuestionOptionInput, QuestionType } from '../../types/questions';

const strings = {
  promptRequired: 'نص السؤال مطلوب.',
  promptTooLong: 'نص السؤال أطول من 2000 حرف.',
  optionsCountInvalid: 'يلزم من 2 إلى 10 اختيارات.',
  oneCorrectRequired: 'يجب تحديد إجابة صحيحة واحدة بالضبط.',
  orderingMinItems: 'ترتيب العناصر يتطلب عنصرين على الأقل.',
  acceptedAnswerRequired: 'أضف إجابة واحدة مقبولة على الأقل.',
  listeningRequiresAudio: 'سؤال الاستماع يتطلب ملفًا صوتيًا.',
};

function draft(overrides: {
  type?: QuestionType;
  prompt?: string;
  options?: QuestionOptionInput[];
  acceptedAnswers?: string[];
  mediaAssetId?: string | null;
}) {
  return {
    questionType: overrides.type ?? 'MultipleChoice',
    prompt: overrides.prompt ?? 'سؤال صحيح؟',
    options: overrides.options ?? [],
    acceptedAnswers: overrides.acceptedAnswers ?? [],
    mediaAssetId: overrides.mediaAssetId ?? null,
  } as const;
}

const oneCorrectTwoOptions: QuestionOptionInput[] = [
  { text: 'A', isCorrect: true },
  { text: 'B', isCorrect: false },
];

describe('question-draft-validation', () => {
  it('MultipleChoice صالح مع إجابة واحدة صحيحة', () => {
    expect(validateQuestionDraft(draft({ options: oneCorrectTwoOptions }), strings)).toEqual({});
  });

  it('MultipleChoice يرفض بدون أي إجابة صحيحة', () => {
    const errors = validateQuestionDraft(
      draft({ options: [{ text: 'A', isCorrect: false }, { text: 'B', isCorrect: false }] }),
      strings,
    );
    expect(errors.options).toBeDefined();
  });

  it('MultipleChoice يرفض إجابتين صحيحتين', () => {
    const errors = validateQuestionDraft(
      draft({ options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: true }] }),
      strings,
    );
    expect(errors.options).toBe(strings.oneCorrectRequired);
  });

  it('MultipleChoice يرفض اختيارًا واحدًا فقط', () => {
    const errors = validateQuestionDraft(
      draft({ options: [{ text: 'واحد', isCorrect: true }] }),
      strings,
    );
    expect(errors.options).toBe(strings.optionsCountInvalid);
  });

  it('TrueFalse يتطلب اختيارين مع واحد صحيح', () => {
    const valid = validateQuestionDraft(
      draft({ type: 'TrueFalse', options: oneCorrectTwoOptions }),
      strings,
    );
    expect(valid).toEqual({});

    const withThree = validateQuestionDraft(
      draft({
        type: 'TrueFalse',
        options: [
          { text: 'صح', isCorrect: true },
          { text: 'خطأ', isCorrect: false },
          { text: 'ثالث', isCorrect: false },
        ],
      }),
      strings,
    );
    expect(withThree.options).toBeDefined();
  });

  it('ShortAnswer يتطلب إجابة مقبولة على الأقل', () => {
    expect(
      validateQuestionDraft(draft({ type: 'ShortAnswer', acceptedAnswers: [] }), strings).acceptedAnswers,
    ).toBe(strings.acceptedAnswerRequired);

    expect(
      validateQuestionDraft(draft({ type: 'ShortAnswer', acceptedAnswers: ['go'] }), strings),
    ).toEqual({});
  });

  it('Ordering يتطلب عنصرين على الأقل', () => {
    expect(
      validateQuestionDraft(
        draft({ type: 'Ordering', options: [{ text: 'أول', isCorrect: false }] }),
        strings,
      ).options,
    ).toBe(strings.orderingMinItems);

    expect(
      validateQuestionDraft(
        draft({
          type: 'Ordering',
          options: [
            { text: 'أول', isCorrect: false },
            { text: 'ثاني', isCorrect: false },
          ],
        }),
        strings,
      ),
    ).toEqual({});
  });

  it('Listening يتطلب وسيط صوتي مرفوع', () => {
    expect(
      validateQuestionDraft(
        draft({ type: 'Listening', options: oneCorrectTwoOptions }),
        strings,
      ).media,
    ).toBe(strings.listeningRequiresAudio);

    expect(
      validateQuestionDraft(
        draft({
          type: 'Listening',
          options: oneCorrectTwoOptions,
          mediaAssetId: '3f6b7d50-1234-4abc-9def-000000000000',
        }),
        strings,
      ).media,
    ).toBeUndefined();
  });

  it('Empty prompt مرفوض لجميع الأنواع', () => {
    for (const type of ['MultipleChoice', 'TrueFalse', 'ShortAnswer', 'Ordering', 'Listening'] as const) {
      expect(
        validateQuestionDraft(
          draft({ type, prompt: '   ', options: oneCorrectTwoOptions, acceptedAnswers: ['x'], mediaAssetId: 'id' }),
          strings,
        ).prompt,
      ).toBe(strings.promptRequired);
    }
  });

  it('نص سؤال يتجاوز 2000 حرف مرفوض', () => {
    const errors = validateQuestionDraft(
      draft({ prompt: 'a'.repeat(2001), options: oneCorrectTwoOptions }),
      strings,
    );
    expect(errors.prompt).toBe(strings.promptTooLong);
  });
});
