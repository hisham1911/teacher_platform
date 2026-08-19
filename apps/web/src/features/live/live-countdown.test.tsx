import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveCountdown } from './live-countdown';

describe('LiveCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('يحسب العرض من توقيت الخادم ثم يواصل interpolation بصريًا فقط', () => {
    render(
      <LiveCountdown
        startedAt="2026-08-09T11:59:50Z"
        closesAt="2026-08-09T12:00:20Z"
        serverNow="2026-08-09T12:00:00Z"
      />,
    );

    expect(screen.getByRole('timer')).toHaveAccessibleName('متبقٍ 20 ثانية');
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByRole('timer')).toHaveAccessibleName('متبقٍ 15 ثانية');
  });

  it('لا يعرض عدًا وهميًا عندما لا يرسل الخادم موعد الإغلاق', () => {
    render(<LiveCountdown closesAt={null} serverNow="2026-08-09T12:00:00Z" />);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });
});
