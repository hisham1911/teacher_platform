import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import PlacementTestPage from './placement-test-page';
import {
  LEVEL_1_QUESTIONS,
  LEVEL_2_QUESTIONS,
  LEVEL_3_QUESTIONS,
  COMPREHENSIVE_DIAGNOSTIC_QUESTIONS,
  PLACEMENT_LEVELS_META,
} from '../../data/content/placement-data';

describe('PlacementTestPage & Question Bank', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('validates all 3 question banks have required fields and exactly one correct option', () => {
    // Level 1: 40 questions
    expect(LEVEL_1_QUESTIONS.length).toBe(40);
    for (const q of LEVEL_1_QUESTIONS) {
      expect(q.prompt).toBeTruthy();
      expect(q.explanationAr).toBeTruthy();
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      const correctOpts = q.options.filter((o) => o.isCorrect);
      expect(correctOpts.length).toBe(1);
    }

    // Level 2: 20 questions
    expect(LEVEL_2_QUESTIONS.length).toBe(20);
    for (const q of LEVEL_2_QUESTIONS) {
      expect(q.prompt).toBeTruthy();
      expect(q.explanationAr).toBeTruthy();
      expect(q.options.length).toBe(4);
      const correctOpts = q.options.filter((o) => o.isCorrect);
      expect(correctOpts.length).toBe(1);
    }

    // Level 3: 20 questions
    expect(LEVEL_3_QUESTIONS.length).toBe(20);
    for (const q of LEVEL_3_QUESTIONS) {
      expect(q.prompt).toBeTruthy();
      expect(q.explanationAr).toBeTruthy();
      expect(q.options.length).toBe(4);
      const correctOpts = q.options.filter((o) => o.isCorrect);
      expect(correctOpts.length).toBe(1);
    }

    // Comprehensive: 24 questions
    expect(COMPREHENSIVE_DIAGNOSTIC_QUESTIONS.length).toBe(24);
  });

  it('renders level selection hub with all 4 level cards', () => {
    render(
      <MemoryRouter>
        <PlacementTestPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /اختبار تحديد المستوى والتشخيص اللغوي/i })
    ).toBeInTheDocument();

    for (const lvl of PLACEMENT_LEVELS_META) {
      expect(screen.getByText(lvl.titleAr)).toBeInTheDocument();
    }
  });

  it('disables starting the test until student enters their name', () => {
    render(
      <MemoryRouter>
        <PlacementTestPage />
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/اسم الطالبة الكريم/i);
    const startButtons = screen.getAllByRole('button', { name: /ابدئي تقييم/i });

    expect(startButtons[0]).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: 'نورة الهزازي' } });

    expect(startButtons[0]).not.toBeDisabled();
  });

  it('starts test and proceeds through questions smoothly', () => {
    render(
      <MemoryRouter>
        <PlacementTestPage />
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/اسم الطالبة الكريم/i);
    fireEvent.change(nameInput, { target: { value: 'رغد محمد' } });

    // Choose Level 2 test
    const startL2Btn = screen.getByRole('button', {
      name: /ابدئي تقييم المستوى الثاني — المتوسط/i,
    });
    fireEvent.click(startL2Btn);

    // Verify first question rendered
    expect(screen.getByText(/السؤال 1 من 20/i)).toBeInTheDocument();
    expect(screen.getByText(/My sister _______ English every day./i)).toBeInTheDocument();

    // Select correct option B (studies)
    const optB = screen.getByRole('button', { name: /studies/i });
    fireEvent.click(optB);

    // Click next
    const nextBtn = screen.getByRole('button', { name: /تأكيد والانتقال للسؤال التالي/i });
    fireEvent.click(nextBtn);

    // Should be on question 2
    expect(screen.getByText(/السؤال 2 من 20/i)).toBeInTheDocument();
    expect(screen.getByText(/We _______ to the park yesterday./i)).toBeInTheDocument();
  });
});
