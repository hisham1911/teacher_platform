import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import NationalJourneyPage from './national-journey-page';
import {
  NATIONAL_JOURNEY_STAGES,
  FINAL_CHAPTER_PROMPTS,
} from '../../data/content/national-journey-data';

describe('NationalJourneyPage — مبادرة في القلب وطن وقيادة', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('validates all 4 journeys have 5 unique questions and exactly one correct option each', () => {
    expect(NATIONAL_JOURNEY_STAGES.length).toBe(4);
    const seenPrompts = new Set<string>();

    for (const stage of NATIONAL_JOURNEY_STAGES) {
      expect(stage.questions.length).toBe(5);
      for (const q of stage.questions) {
        expect(seenPrompts.has(q.prompt)).toBe(false);
        seenPrompts.add(q.prompt);
        const correctOpts = q.options.filter((o) => o.isCorrect);
        expect(correctOpts.length).toBe(1);
      }
    }
    expect(FINAL_CHAPTER_PROMPTS.length).toBe(3);
  });

  it('renders the royal welcome screen and requires student name before starting', () => {
    render(
      <MemoryRouter>
        <NationalJourneyPage />
      </MemoryRouter>,
    );

    expect(
      screen.getAllByRole('heading', { name: /مبادرة في القلب وطن وقيادة/i })[0],
    ).toBeInTheDocument();

    const startBtn = screen.getByRole('button', { name: /ابدئي رحلة المجد الآن/i });
    expect(startBtn).toBeDisabled();

    const nameInput = screen.getByLabelText(/اسم الطالبة الثلاثي/i);
    fireEvent.change(nameInput, { target: { value: 'نورة بنت سعد' } });
    expect(startBtn).not.toBeDisabled();
  });

  it('uses mastery learning (no game over on wrong answer) and unlocks facts on correct answer', () => {
    render(
      <MemoryRouter>
        <NationalJourneyPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/اسم الطالبة الثلاثي/i), {
      target: { value: 'نورة بنت سعد' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ابدئي رحلة المجد الآن/i }));

    expect(
      screen.getByText(/When was the First Saudi State established\?/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /1902/i }));
    expect(screen.getByText(/اقتربتِ يا بطلة/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /1727/i }));
    expect(screen.getByText(/أحسنتِ إجابة صحيحة/i)).toBeInTheDocument();
  });
});
