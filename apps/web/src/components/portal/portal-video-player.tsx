import { useState, useRef } from 'react';
import { Play, Video } from 'lucide-react';

interface PortalVideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  aspectRatio?: 'video' | 'portrait' | 'auto';
  className?: string;
}

export function PortalVideoPlayer({
  src,
  poster,
  title = 'فيديو تعليمي',
  aspectRatio = 'auto',
  className = '',
}: PortalVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isLocalOrDirect =
    src.endsWith('.mp4') ||
    src.endsWith('.webm') ||
    src.startsWith('/content/') ||
    src.startsWith('blob:');

  const handleCustomPlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        void videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  if (isLocalOrDirect) {
    return (
      <div
        className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-slate-950 shadow-md transition-shadow hover:shadow-xl ${className}`}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          preload="none"
          playsInline
          controls
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className={`w-full h-auto max-h-[560px] mx-auto bg-black object-contain ${
            aspectRatio === 'video' ? 'aspect-video' : ''
          }`}
        >
          <track kind="captions" />
          متصفحك لا يدعم تشغيل الفيديو المباشر.
        </video>

        {/* Floating play badge when not yet playing and has poster */}
        {!isPlaying && poster && (
          <button
            type="button"
            onClick={handleCustomPlay}
            aria-label={`تشغيل ${title}`}
            className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px] transition-all group-hover:bg-slate-950/30"
          >
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-violet-600/90 text-white shadow-2xl shadow-violet-600/50 backdrop-blur-md transition-transform duration-300 group-hover:scale-110 active:scale-95">
              <Play className="h-8 w-8 sm:h-10 sm:w-10 fill-white translate-x-0.5" />
            </div>
          </button>
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
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
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
