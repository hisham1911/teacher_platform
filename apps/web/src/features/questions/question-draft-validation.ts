import type { QuestionOptionInput, QuestionType } from '../../types/questions';

/**
 * تحقق واجهة محايد عن React — يعكس قواعد TeacherPlatform.Domain.Questions.QuestionValidator
 * حتى يظهر للمعلم خطأ LD قبل إرسال request غير صالح للخادم.
 * الفيصل النهائي دائمًا في الخادم.
 */

export interface DraftErrors {
  prompt?: string;
  options?: string;
  acceptedAnswers?: string;
  media?: string;
}

export interface QuestionDraft {
  questionType: QuestionType;
  prompt: string;
  options: QuestionOptionInput[];
  acceptedAnswers: string[];
  mediaAssetId: string | null;
}

export function validateQuestionDraft(draft: QuestionDraft, strings: {
  promptRequired: string;
  promptTooLong: string;
  optionsCountInvalid: string;
  oneCorrectRequired: string;
  orderingMinItems: string;
  acceptedAnswerRequired: string;
  listeningRequiresAudio: string;
}): DraftErrors {
  const errors: DraftErrors = {};

  const trimmedPrompt = draft.prompt.trim();
  if (!trimmedPrompt) {
    errors.prompt = strings.promptRequired;
  } else if (trimmedPrompt.length > 2000) {
    errors.prompt = strings.promptTooLong;
  }

  if (draft.questionType === 'ShortAnswer') {
    if (draft.acceptedAnswers.filter((a) => a.trim().length > 0).length === 0) {
      errors.acceptedAnswers = strings.acceptedAnswerRequired;
    }
    return errors;
  }

  if (draft.questionType === 'Ordering') {
    if (draft.options.filter((o) => o.text.trim().length > 0).length < 2) {
      errors.options = strings.orderingMinItems;
    }
    return errors;
  }

  // MultipleChoice / TrueFalse / Listening
  const filled = draft.options.filter((o) => o.text.trim().length > 0);
  if (draft.questionType === 'TrueFalse') {
    if (filled.length !== 2 || filled.filter((o) => o.isCorrect).length !== 1) {
      errors.options = strings.oneCorrectRequired;
    }
  } else {
    if (filled.length < 2 || filled.length > 10) {
      errors.options = strings.optionsCountInvalid;
    } else if (filled.filter((o) => o.isCorrect).length !== 1) {
      errors.options = strings.oneCorrectRequired;
    }

    if (draft.questionType === 'Listening' && !draft.mediaAssetId) {
      errors.media = strings.listeningRequiresAudio;
    }
  }

  return errors;
}
