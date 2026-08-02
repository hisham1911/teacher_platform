import { useEffect, useState } from 'react';
import { mediaApi } from '../../data/api-client/endpoints';

/**
 * يعرض وسيطة صوت/صورة من الـAPI عبر Blob بعد مصادقة Bearer —
 * عناصر <img>/<audio> لا ترسل Authorization headers.
 */
export function MediaContentPreview({
  tenantId,
  mediaId,
  kind,
}: {
  tenantId: string;
  mediaId: string;
  kind: 'Image' | 'Audio';
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;
    setFailed(false);
    setObjectUrl(null);

    mediaApi
      .fetchContentBlob(tenantId, mediaId)
      .then((blob) => {
        if (cancelled) return;
        currentUrl = URL.createObjectURL(blob);
        setObjectUrl(currentUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [tenantId, mediaId]);

  if (failed) {
    return <p className="text-sm text-rose-600">تعذر عرض الوسيط.</p>;
  }

  if (!objectUrl) {
    return <p className="text-xs text-slate-500">جارٍ تحميل المعاينة…</p>;
  }

  if (kind === 'Audio') {
    return (
      <audio controls preload="metadata" src={objectUrl} className="w-full">
        تعذر تشغيل الصوت في هذا المتصفح.
      </audio>
    );
  }

  return (
    <img
      src={objectUrl}
      alt="معاينة الوسائط المرفوعة"
      className="max-h-48 rounded-lg border border-slate-200 object-contain"
    />
  );
}
