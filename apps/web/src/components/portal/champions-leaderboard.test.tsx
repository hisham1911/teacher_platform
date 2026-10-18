import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChampionsLeaderboard } from './champions-leaderboard';

describe('ChampionsLeaderboard component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders leaderboard title and default tab', async () => {
    render(<ChampionsLeaderboard showTabs={true} category="all" />);

    expect(screen.getByText(/لوحة شرف المتصدرين/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /أبطال تحدي المليون/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /أبطال تحدي السرعة/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/سارة علي حكمي/i)[0]).toBeInTheDocument();
    });
  });

  it('switches between million and speed tabs', async () => {
    render(<ChampionsLeaderboard showTabs={true} category="all" />);

    const speedTab = screen.getByRole('button', { name: /أبطال تحدي السرعة/i });
    fireEvent.click(speedTab);

    await waitFor(() => {
      expect(screen.getAllByText(/أثير حسن عريشي/i)[0]).toBeInTheDocument();
    });
  });

  it('displays podium medal for first place', async () => {
    render(<ChampionsLeaderboard category="million" showTabs={false} />);

    await waitFor(() => {
      expect(screen.getByText('🥇')).toBeInTheDocument();
      expect(screen.getByText(/بطل الصدارة 👑/i)).toBeInTheDocument();
    });
  });
});
