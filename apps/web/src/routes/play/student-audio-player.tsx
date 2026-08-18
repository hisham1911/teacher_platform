import { useRef, useState } from 'react';

function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function StudentAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setPlaybackFailed(true);
    }
  }

  return (
    <section aria-labelledby="student-audio-title" className="rounded-2xl bg-emerald-50 p-4 sm:p-5">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        data-testid="question-media-audio"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setPlaybackFailed(true)}
        className="sr-only">
        المتصفح لا يدعم تشغيل الصوت.
      </audio>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="student-audio-title" className="text-sm font-black text-emerald-950">استمع جيدًا</h3>
          <p className="mt-1 text-xs text-emerald-800">يمكنك إعادة المقطع قبل تثبيت إجابتك.</p>
        </div>
        <button
          type="button"
          onClick={() => void togglePlayback()}
          aria-label={isPlaying ? 'إيقاف الصوت مؤقتًا' : 'تشغيل الصوت'}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-lg text-white transition-colors duration-200 hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
          <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
        </button>
      </div>
      <div className="mt-4 flex min-w-0 items-center gap-3" dir="ltr">
        <span className="w-9 shrink-0 text-xs font-semibold tabular-nums text-emerald-900">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          disabled={!duration || playbackFailed}
          aria-label="موضع تشغيل الصوت"
          onChange={(event) => {
            const nextTime = Number(event.target.value);
            if (audioRef.current) audioRef.current.currentTime = nextTime;
            setCurrentTime(nextTime);
          }}
          className="min-w-0 flex-1 accent-emerald-700"
        />
        <span className="w-9 shrink-0 text-end text-xs font-semibold tabular-nums text-emerald-900">{formatTime(duration)}</span>
      </div>
      {playbackFailed ? (
        <p role="alert" className="mt-4 rounded-xl bg-white p-3 text-sm leading-6 text-rose-700">
          تعذر تشغيل الصوت. أعد تحميل الصفحة، وإن استمرت المشكلة فأبلغ المعلم.
        </p>
      ) : null}
    </section>
  );
}
