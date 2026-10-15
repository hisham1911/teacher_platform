import { useState, useRef } from 'react';
import { Play, Video, RotateCcw, AlertCircle } from 'lucide-react';

interface PortalVideoPlayerProps {
  src?: string;
  videoUrl?: string;
  poster?: string;
  title?: string;
  aspectRatio?: 'video' | 'portrait' | 'auto';
  preload?: 'none' | 'metadata' | 'auto';
  className?: string;
}

import { toEmbedVideoUrl } from './video-utils';

export function PortalVideoPlayer({
  src,
  videoUrl,
  poster,
  title = 'فيديو تعليمي',
  aspectRatio = 'auto',
  preload = 'metadata',
  className = '',
}: PortalVideoPlayerProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const raw = src || videoUrl || '';
  const embedUrl = toEmbedVideoUrl(raw);

  const isLocalOrDirect =
    /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(raw) ||
    raw.includes('/storage/v1/object/public/') ||
    raw.startsWith('/content/') ||
    raw.startsWith('blob:');

  const handleStartPlayback = () => {
    if (videoRef.current) {
      setLoadError(false);
      setHasStarted(true);

      // If video has preload="none" and hasn't loaded metadata, trigger load first
      if (videoRef.current.readyState === 0) {
        videoRef.current.load();
      }

      const playPromise = videoRef.current.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err: unknown) => {
          console.warn('Playback error:', err);
          // Don't flag error immediately on user pause or abort
          const isAbort = err instanceof DOMException && err.name === 'AbortError';
          if (!isAbort) {
            setLoadError(true);
          }
        });
      }
    }
  };

  const handleRetry = () => {
    setLoadError(false);
    if (videoRef.current) {
      videoRef.current.load();
      void videoRef.current.play();
    }
  };

  if (isLocalOrDirect) {
    return (
      <div
        className={`group relative isolate z-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-slate-950 shadow-md transition-shadow hover:shadow-xl ${className}`}
      >
        <video
          ref={videoRef}
          src={raw}
          poster={poster}
          preload={preload}
          playsInline
          controls={hasStarted}
          onPlay={() => {
            setHasStarted(true);
            setLoadError(false);
          }}
          onError={() => setLoadError(true)}
          className={`w-full h-auto max-h-[560px] mx-auto bg-black object-contain ${
            aspectRatio === 'video' ? 'aspect-video' : ''
          }`}
        >
          <source src={raw} type="video/mp4" />
          <track kind="captions" />
          متصفحك لا يدعم تشغيل الفيديو المباشر.
        </video>

        {/* Floating play badge before initial play (non-blocking pointer events) */}
        {!hasStarted && poster && !loadError && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/25 transition-all group-hover:bg-slate-950/35"
          >
            <button
              type="button"
              onClick={handleStartPlayback}
              aria-label={`تشغيل ${title}`}
              className="pointer-events-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-violet-600/90 text-white shadow-2xl shadow-violet-600/50 backdrop-blur-md transition-transform duration-300 hover:scale-110 active:scale-95 focus:outline-hidden"
            >
              <Play className="h-8 w-8 sm:h-10 sm:w-10 fill-white translate-x-0.5" />
            </button>
          </div>
        )}

        {/* Error overlay with retry button */}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center text-white">
            <AlertCircle className="h-10 w-10 text-rose-400 mb-2" />
            <p className="text-xs sm:text-sm font-bold text-slate-200">
              تعذر تشغيل المقطع تلقائياً في متصفحك.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 active:scale-95 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // YouTube / external embed fallback
  return (
    <div
      className={`overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-950 shadow-md aspect-video ${className}`}
    >
      <iframe
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-full w-full border-0"
      />
    </div>
  );
}

export function VideoBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200/60 shadow-2xs">
      <Video className="h-3.5 w-3.5 text-rose-600" />
      <span>فيديو شرح كرتوني</span>
    </div>
  );
}
