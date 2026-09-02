import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerSession } from '../../types/sessions';

/** Keeps player deadlines aligned to server time without trusting the device clock. */
export function useServerClock() {
  const offsetRef = useRef(0);
  const sync = useCallback((serverNow: string) => {
    offsetRef.current = Date.parse(serverNow) - Date.now();
  }, []);
  const now = useCallback(() => new Date(Date.now() + offsetRef.current), []);
  return { sync, now };
}

export function useCountdown(deadlineAt: string | null | undefined, now: () => Date): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!deadlineAt) {
      setRemaining(null);
      return;
    }
    const deadline = Date.parse(deadlineAt);
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - now().getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineAt, now]);
  return remaining;
}

export function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

export function sessionTimeLabel(session: PlayerSession): string {
  if (session.timeMode === 'None' || !session.timeLimitSeconds) return 'بدون مؤقت';
  const seconds = session.timeMode === 'TotalTime' ? session.timeLimitSeconds : session.timeLimitSeconds * session.questionCount;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `حوالي ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
}
