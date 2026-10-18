import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, isOpen, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="عرض البطاقة بالحجم الكامل"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 p-3 backdrop-blur-md sm:p-8"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
        aria-label="إغلاق الصورة"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Image container */}
      <div
        className="relative max-h-full max-w-full animate-page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/15"
        />
        <p className="mt-2 text-center text-xs font-semibold text-slate-300">
          اضغط في أي مكان خارج الصورة أو على زر الإغلاق للرجوع
        </p>
      </div>
    </div>
  );
}
