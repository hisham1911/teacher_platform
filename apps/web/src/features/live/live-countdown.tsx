import { useEffect, useMemo, useState, type CSSProperties } from 'react';

interface LiveCountdownProps {
  closesAt: string | null;
  startedAt?: string | null;
  serverNow: string;
}

export function LiveCountdown({ closesAt, startedAt = null, serverNow }: LiveCountdownProps) {
  const clockOffset = useMemo(
    () => new Date(serverNow).getTime() - Date.now(),
    [serverNow],
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!closesAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [closesAt]);

  if (!closesAt) return null;

  const remainingMs = Math.max(0, new Date(closesAt).getTime() - (now + clockOffset));
  const remainingSeconds = Math.ceil(remainingMs / 1_000);
  const totalMs = startedAt ? Math.max(1, new Date(closesAt).getTime() - new Date(startedAt).getTime()) : null;
  const remainingRatio = totalMs ? Math.min(1, remainingMs / totalMs) : 1;
  const urgency = remainingSeconds <= 5 ? 'critical' : remainingSeconds <= 10 ? 'warning' : 'normal';
  const style = { '--live-timer-progress': `${remainingRatio * 360}deg` } as CSSProperties;

  return (
    <div
      role="timer"
      aria-label={`متبقٍ ${remainingSeconds} ثانية`}
      data-urgency={urgency}
      style={style}
      className="live-timer">
      <span className="relative z-10 font-mono text-4xl font-black tabular-nums text-white">{remainingSeconds}</span>
      <span className="relative z-10 mt-1 text-xs font-bold text-slate-300">ثانية</span>
    </div>
  );
}
