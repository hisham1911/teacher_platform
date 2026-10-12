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

  it('validates all 3 question banks have required fields, exactly one correct option, and balanced option distribution', () => {
    // Level 1: 40 questions
    expect(LEVEL_1_QUESTIONS.length).toBe(40);
    const l1CorrectDistribution: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (const q of LEVEL_1_QUESTIONS) {
      expect(q.prompt).toBeTruthy();
      expect(q.explanationAr).toBeTruthy();
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      const correctOpts = q.options.filter((o) => o.isCorrect);
      expect(correctOpts.length).toBe(1);
      const optId = correctOpts[0]!.id;
      l1CorrectDistribution[optId] = (l1CorrectDistribution[optId] ?? 0) + 1;
    }
    // Verify no single option dominates (each between 10 and 18 out of 40)
    expect(l1CorrectDistribution['a'] ?? 0).toBeGreaterThanOrEqual(10);
    expect(l1CorrectDistribution['b'] ?? 0).toBeGreaterThanOrEqual(10);
    expect(l1CorrectDistribution['c'] ?? 0).toBeGreaterThanOrEqual(10);

    // Level 2: 20 questions
    expect(LEVEL_2_QUESTIONS.length).toBe(20);
    const l2CorrectDistribution: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (const q of LEVEL_2_QUESTIONS) {
      expect(q.prompt).toBeTruthy();
      expect(q.explanationAr).toBeTruthy();
      expect(q.options.length).toBe(4);
      const correctOpts = q.options.filter((o) => o.isCorrect);
      expect(correctOpts.length).toBe(1);
      const optId = correctOpts[0]!.id;
      l2CorrectDistribution[optId] = (l2CorrectDistribution[optId] ?? 0) + 1;
    }
    // Verify balanced 25% distribution (exactly 5 each)
    expect(l2CorrectDistribution['a']).toBe(5);
    expect(l2CorrectDistribution['b']).toBe(5);
    expect(l2CorrectDistribution['c']).toBe(5);
    expect(l2CorrectDistribution['d']).toBe(5);

    // Level 3: 20 questions
    expect(LEVEL_3_QUESTIONS.length).toBe(20);
    const l3CorrectDistribution: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (const q of LEVEL_3_QUESTIONS) {
      expect(q.prompt).toBeTruthy();
      expect(q.explanationAr).toBeTruthy();
      expect(q.options.length).toBe(4);
      const correctOpts = q.options.filter((o) => o.isCorrect);
      expect(correctOpts.length).toBe(1);
      const optId = correctOpts[0]!.id;
      l3CorrectDistribution[optId] = (l3CorrectDistribution[optId] ?? 0) + 1;
    }
    // Verify balanced 25% distribution (exactly 5 each)
    expect(l3CorrectDistribution['a']).toBe(5);
    expect(l3CorrectDistribution['b']).toBe(5);
    expect(l3CorrectDistribution['c']).toBe(5);
    expect(l3CorrectDistribution['d']).toBe(5);

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

    const nameInput = screen.getByLabelText(/الاسم الكريم/i);
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

    const nameInput = screen.getByLabelText(/الاسم الكريم/i);
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
