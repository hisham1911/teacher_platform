export type SurveyStatus = 'Draft' | 'Published';
export type SurveyQuestionType = 'Rating' | 'SingleChoice' | 'ShortText';

export interface SurveyOption {
  id: string;
  sortOrder: number;
  optionText: string;
}

export interface SurveyQuestion {
  id: string;
  sortOrder: number;
  questionType: SurveyQuestionType;
  prompt: string;
  isRequired: boolean;
  options: SurveyOption[];
}

export interface SurveyListItem {
  id: string;
  quizId: string;
  quizTitle: string;
  title: string;
  status: SurveyStatus;
  questionCount: number;
  responseCount: number;
  publishedAt: string | null;
  updatedAt: string;
}

export interface SurveyDetail {
  id: string;
  quizId: string;
  quizTitle: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  version: number;
  responseCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  questions: SurveyQuestion[];
}

export interface SurveyRatingDistribution {
  value: number;
  count: number;
  percentage: number;
}

export interface SurveyOptionResult {
  optionId: string;
  optionText: string;
  count: number;
  percentage: number;
}

export interface SurveyQuestionResults {
  id: string;
  sortOrder: number;
  questionType: SurveyQuestionType;
  prompt: string;
  answerCount: number;
  ratingAverage: number | null;
  ratingDistribution: SurveyRatingDistribution[];
  optionResults: SurveyOptionResult[];
  textResponses: string[];
}

export interface SurveyResults {
  surveyId: string;
  title: string;
  responseCount: number;
  questions: SurveyQuestionResults[];
}

export interface SurveyOptionInput {
  optionText: string;
}

export interface SurveyQuestionInput {
  questionType: SurveyQuestionType;
  prompt: string;
  isRequired: boolean;
  options: SurveyOptionInput[];
}

export interface CreateSurveyRequest {
  quizId: string;
  title: string;
  description: string | null;
  questions: SurveyQuestionInput[];
}

export interface UpdateSurveyRequest {
  title: string;
  description: string | null;
  questions: SurveyQuestionInput[];
  baseVersion: number;
}

export interface PlayerSurveyOption {
  optionId: string;
  sortOrder: number;
  optionText: string;
}

export interface PlayerSurveyQuestion {
  questionId: string;
  sortOrder: number;
  questionType: SurveyQuestionType;
  prompt: string;
  isRequired: boolean;
  options: PlayerSurveyOption[];
}

export interface PlayerSurvey {
  surveyId: string;
  title: string;
  description: string | null;
  submitted: boolean;
  questions: PlayerSurveyQuestion[];
}

export interface SurveyAnswerInput {
  questionId: string;
  ratingValue: number | null;
  optionId: string | null;
  text: string | null;
}

export interface SubmitSurveyRequest {
  answers: SurveyAnswerInput[];
}

export interface SurveySubmission {
  responseId: string;
  submittedAt: string;
}
