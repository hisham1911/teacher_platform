import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import TeacherAdminPage from './teacher-admin-page';
import { loginTeacher, logoutTeacher } from '../../data/api-client/guestbook-client';

describe('TeacherAdminPage (بوابة المعلمة مريم الصميلي)', () => {
  beforeEach(() => {
    localStorage.clear();
    logoutTeacher();
    vi.clearAllMocks();
  });

  it('renders login screen when teacher is not authenticated', () => {
    render(
      <MemoryRouter>
        <TeacherAdminPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /لوحة المعلمة مريم الصميلي/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/maryam/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /تسجيل الدخول إلى اللوحة/i })).toBeInTheDocument();
  });

  it('shows error on invalid credentials and unlocks on valid credentials', async () => {
    render(
      <MemoryRouter>
        <TeacherAdminPage />
      </MemoryRouter>
    );

    const userInput = screen.getByPlaceholderText(/maryam/i);
    const passInput = screen.getByPlaceholderText(/••••••••/i);
    const submitBtn = screen.getByRole('button', { name: /تسجيل الدخول إلى اللوحة/i });

    // Invalid password
    fireEvent.change(userInput, { target: { value: 'maryam' } });
    fireEvent.change(passInput, { target: { value: 'wrong123' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/اسم المستخدم أو كلمة المرور غير صحيحة/i)).toBeInTheDocument();

    // Valid password
    fireEvent.change(passInput, { target: { value: 'maryam2026' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/أهلاً بكِ أ\. مريم الصميلي/i)).toBeInTheDocument();
      expect(screen.getByText(/إجمالي الأسئلة/i)).toBeInTheDocument();
    });
  });

  it('renders dashboard directly if already logged in and logs out cleanly', async () => {
    loginTeacher('maryam', 'maryam2026');

    render(
      <MemoryRouter>
        <TeacherAdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/أهلاً بكِ أ\. مريم الصميلي/i)).toBeInTheDocument();
    });

    // Check stats are rendered
    expect(screen.getAllByText(/بانتظار الإجابة/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/سجل الزوار/i)[0]).toBeInTheDocument();

    // Logout
    const logoutBtn = screen.getByRole('button', { name: /تسجيل الخروج/i });
    fireEvent.click(logoutBtn);

    expect(screen.getByRole('heading', { name: /لوحة المعلمة مريم الصميلي/i })).toBeInTheDocument();
  });
});
