/** أنواع المحتوى التعليمي المشتركة */

export interface QuizOption {
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  hint?: string;
  options: QuizOption[];
}

export interface GrammarTopic {
  slug: string;
  titleEn: string;
  titleAr: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  posterUrl?: string;
  questions: QuizQuestion[];
}

export interface ReadingPassage {
  slug: string;
  titleEn: string;
  titleAr: string;
  level: 'easy' | 'medium' | 'hard';
  text: string;
  questions: QuizQuestion[];
}

export interface ListeningActivity {
  slug: string;
  titleEn: string;
  titleAr: string;
  level: 'easy' | 'medium' | 'hard';
  mediaUrl: string;
  posterUrl?: string;
  audioScript?: string;
  questions: QuizQuestion[];
}

export interface WritingPrompt {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  category: 'sentence' | 'correction' | 'paragraph';
  instructionAr: string;
  instructionEn: string;
  promptText: string;
  scrambledWords?: string[];
  acceptableAnswers?: string[];
  modelAnswer: string;
  explanationAr: string;
  keywords?: string[];
  level: 'easy' | 'medium' | 'hard';
}

export interface SpeakingActivity {
  slug: string;
  titleEn: string;
  titleAr: string;
  description: string;
  externalUrl: string; // رابط خارجي مثل engnovate
}

export interface ChallengeQuestion {
  id: string;
  level: number; // 1-15
  prompt: string;
  options: QuizOption[];
  points: number;
}

export type PortalSection = {
  id: string;
  titleAr: string;
  titleEn: string;
  description: string;
  icon: string;
  color: string;
  path: string;
  count?: number;
};
