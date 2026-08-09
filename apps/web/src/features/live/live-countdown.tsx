import { useEffect, useMemo, useState } from 'react';

interface LiveCountdownProps {
  closesAt: string | null;
  serverNow: string;
}

export function LiveCountdown({ closesAt, serverNow }: LiveCountdownProps) {
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

  return (
    <span
      role="timer"
      aria-label={`متبقٍ ${remainingSeconds} ثانية`}
      className={`inline-flex min-w-20 justify-center rounded-full px-3 py-1 font-mono text-2xl font-black tabular-nums ${
        remainingSeconds <= 5 ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-800'
      }`}>
      {remainingSeconds}
    </span>
  );
}

