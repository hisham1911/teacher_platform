import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentsPage from './students-page';

const listStudentsMock = vi.hoisted(() => vi.fn());
const writeTextMock = vi.hoisted(() => vi.fn());

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return { ...actual, studentsApi: { ...actual.studentsApi, list: listStudentsMock } };
});

describe('StudentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('teacher-platform:active-tenant-id', 'tenant-1');
    listStudentsMock.mockResolvedValue([{
      id: 'student-1', fullName: 'هشام محمد', studentCode: 'ABCD1234', grade: null, notes: null,
      isActive: true, version: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    }]);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: writeTextMock } });
    writeTextMock.mockResolvedValue(undefined);
  });

  it('يعرض الطالب ويسمح بنسخ كوده مباشرة من القائمة', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><MemoryRouter><StudentsPage /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByRole('heading', { name: 'هشام محمد' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /هشام محمد/ })).toHaveAttribute('href', '/dashboard/students/student-1');

    fireEvent.click(screen.getByRole('button', { name: 'نسخ كود هشام محمد' }));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith('ABCD1234'));
    expect(screen.getByRole('button', { name: 'نسخ كود هشام محمد' })).toHaveTextContent('تم ✓');
  });
});
