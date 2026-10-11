import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonDiscussion } from './lesson-discussion';

describe('LessonDiscussion component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders header with topic title and initial questions', async () => {
    render(<LessonDiscussion topicSlug="present-simple" topicTitle="المضارع البسيط" />);

    expect(
      screen.getByRole('heading', { name: /اسألي المعلمة مريم حول الدرس/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/المضارع البسيط/)).toBeInTheDocument();

    // Should load the seed question for present-simple
    await waitFor(() => {
      expect(screen.getByText(/شهد عبدالله/i)).toBeInTheDocument();
    });

    // Check teacher reply is visible
    expect(screen.getByText(/إجابة المعلمة مريم/i)).toBeInTheDocument();
  });

  it('allows student to submit a valid question', async () => {
    render(<LessonDiscussion topicSlug="future-perfect" topicTitle="المستقبل التام" />);

    await waitFor(() => {
      expect(screen.queryByText(/جاري تحميل الاستفسارات/i)).not.toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/الاسم الكريم/i);
    const questionInput = screen.getByLabelText(/سؤالكِ أو استفساركِ/i);
    const submitBtn = screen.getByRole('button', { name: /إرسال الاستفسار/i });

    fireEvent.change(nameInput, { target: { value: 'فاطمة محمد' } });
    fireEvent.change(questionInput, {
      target: { value: 'كيف نفرق بين المستقبل التام والمستقبل البسيط؟' },
    });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/فاطمة محمد/i)).toBeInTheDocument();
      expect(
        screen.getByText(/كيف نفرق بين المستقبل التام والمستقبل البسيط؟/i)
      ).toBeInTheDocument();
    });
  });

  it('unlocks teacher mode with passcode maryam2026', async () => {
    render(<LessonDiscussion topicSlug="present-simple" topicTitle="المضارع البسيط" />);

    const teacherBtn = screen.getByRole('button', { name: /دخول المعلمة للإجابة/i });
    fireEvent.click(teacherBtn);

    const passInput = screen.getByLabelText(/رمز المرور/i);
    const unlockBtn = screen.getByRole('button', { name: /تأكيد الدخول/i });

    // Wrong passcode
    fireEvent.change(passInput, { target: { value: '1234' } });
    fireEvent.click(unlockBtn);
    expect(screen.getByText(/رمز المرور غير صحيح/i)).toBeInTheDocument();

    // Correct passcode
    fireEvent.change(passInput, { target: { value: 'maryam2026' } });
    fireEvent.click(unlockBtn);

    await waitFor(() => {
      expect(screen.getByText(/وضع إجابة المعلمة مفعّل/i)).toBeInTheDocument();
    });
  });
});
