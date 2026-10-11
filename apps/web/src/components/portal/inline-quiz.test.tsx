import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InlineQuiz } from './inline-quiz';
import type { QuizQuestion } from '../../data/content/types';

const topicAQuestions: QuizQuestion[] = [
  {
    id: 'a1',
    prompt: 'Topic A Question 1',
    options: [
      { text: 'Correct A1', isCorrect: true },
      { text: 'Wrong A1', isCorrect: false },
    ],
  },
  {
    id: 'a2',
    prompt: 'Topic A Question 2',
    options: [
      { text: 'Correct A2', isCorrect: true },
      { text: 'Wrong A2', isCorrect: false },
    ],
  },
];

const topicBQuestions: QuizQuestion[] = [
  {
    id: 'b1',
    prompt: 'Topic B Question 1',
    options: [
      { text: 'Correct B1', isCorrect: true },
      { text: 'Wrong B1', isCorrect: false },
    ],
  },
  {
    id: 'b2',
    prompt: 'Topic B Question 2',
    options: [
      { text: 'Correct B2', isCorrect: true },
      { text: 'Wrong B2', isCorrect: false },
    ],
  },
];

describe('InlineQuiz component state isolation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets index to 0 and clears selected answers when questions prop changes', () => {
    const { rerender } = render(<InlineQuiz questions={topicAQuestions} />);

    // Check Question 1 of Topic A is shown
    expect(screen.getByText('Topic A Question 1')).toBeInTheDocument();
    expect(screen.getByText('السؤال 1 من 2')).toBeInTheDocument();

    // Answer Question 1
    const optionBtn = screen.getByRole('button', { name: /Correct A1/i });
    fireEvent.click(optionBtn);

    // Advance timer to trigger question change
    act(() => {
      vi.advanceTimersByTime(1400);
    });

    // Now we are on Question 2 of Topic A
    expect(screen.getByText('Topic A Question 2')).toBeInTheDocument();
    expect(screen.getByText('السؤال 2 من 2')).toBeInTheDocument();

    // Now simulate navigating to next grammar topic: questions prop changes to topicBQuestions
    rerender(<InlineQuiz questions={topicBQuestions} />);

    // MUST reset to Question 1 of Topic B and NOT remain at Question 2!
    expect(screen.getByText('Topic B Question 1')).toBeInTheDocument();
    expect(screen.getByText('السؤال 1 من 2')).toBeInTheDocument();
    expect(screen.queryByText('Topic A Question 2')).not.toBeInTheDocument();
    expect(screen.queryByText('السؤال 2 من 2')).not.toBeInTheDocument();
  });
});

