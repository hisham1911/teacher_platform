import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import GuestbookPage from './guestbook-page';
import {
  loginTeacher,
  logoutTeacher,
  guestbookClient,
} from '../../data/api-client/guestbook-client';

describe('GuestbookPage (سجل الزوار وكلمات الفخر)', () => {
  beforeEach(() => {
    localStorage.clear();
    logoutTeacher();
    vi.clearAllMocks();
  });

  it('renders guestbook title, submission form and default entries', async () => {
    render(
      <MemoryRouter>
        <GuestbookPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /سجل الزوار والتعليقات/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/اسم الكريم/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/رسالتك أو تعليقك/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('سارة خالد')).toBeInTheDocument();
    });
  });

  it('renders teacher official reply on entries that have teacherReply', async () => {
    render(
      <MemoryRouter>
        <GuestbookPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('سارة خالد')).toBeInTheDocument();
    });

    // Check for official teacher reply badge and content
    expect(screen.getAllByText(/رد معلمات اللغة الإنجليزية/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/الرد المعتمد/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/فخورات جداً بتميزكِ وحرصكِ/i)).toBeInTheDocument();
  });

  it('allows authenticated teacher to submit an official reply from the guestbook page', async () => {
    loginTeacher('maryam', 'maryam2026');

    render(
      <MemoryRouter>
        <GuestbookPage />
      </MemoryRouter>
    );

    // Verify teacher mode indicator
    expect(screen.getByText(/وضع الرد والإشراف مفعّل/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('أم محمد (ولي أمر)')).toBeInTheDocument();
    });

    // Click "رد المعلمة" button
    const replyButtons = screen.getAllByRole('button', { name: /رد المعلمة/i });
    expect(replyButtons.length).toBeGreaterThan(0);
    fireEvent.click(replyButtons[0]!);

    // Check inline reply textarea is opened
    const textarea = screen.getByPlaceholderText(/اكتبي التوجيه أو كلمة الشكر والتقدير هنا/i);
    expect(textarea).toBeInTheDocument();

    // Type and submit reply
    fireEvent.change(textarea, {
      target: { value: 'شكراً جزيلاً لكِ ولبناتكِ المتميزات 🌸' },
    });

    const submitBtn = screen.getByRole('button', { name: /نشر الرد الرسمي/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('شكراً جزيلاً لكِ ولبناتكِ المتميزات 🌸')).toBeInTheDocument();
    });

    // Verify reply was persisted in guestbook client storage
    const all = await guestbookClient.getEntries();
    const target = all.find((e) => e.teacherReply === 'شكراً جزيلاً لكِ ولبناتكِ المتميزات 🌸');
    expect(target).toBeDefined();
  });
});
