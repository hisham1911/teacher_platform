export interface GuestbookEntry {
  id: string;
  name: string;
  role: string;
  message: string;
  createdAt: string;
  likes: number;
}

const STORAGE_KEY = 'english_spark_guestbook_entries_v1';
const RATE_LIMIT_KEY = 'english_spark_last_comment_time';
const TEACHER_PASSCODE_HASH = 'maryam2026'; // رمز مرور المعلمة لإدارة التعليقات

// تعليقات أولية ملهمة وموثوقة
const DEFAULT_ENTRIES: GuestbookEntry[] = [
  {
    id: 'entry-1',
    name: 'سارة خالد',
    role: 'طالبة — الصف الثاني متوسط',
    message: 'مبادرة رائعة ومفيدة جداً من المعلمة مريم، بطاقات القواعد والألوان جعلت حفظ الأزمنة وفهمها أسهل بكثير!',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    likes: 18,
  },
  {
    id: 'entry-2',
    name: 'أ. هدى الحربي',
    role: 'معلمة لغة إنجليزية',
    message: 'بارك الله في هذه الجهود المميزة في إنتاج المعرفة. تصميم المنصة وتنوع المسابقات يرفع دافعية الطالبات للتعلم.',
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    likes: 24,
  },
  {
    id: 'entry-3',
    name: 'أم محمد (ولي أمر)',
    role: 'ولي أمر',
    message: 'أشكر مدرسة متوسطة وثانوية الجرادية والمعلمة مريم على هذا العمل التعليمي المتقن. بناتي يستمتعن بحل التمارين يومياً.',
    createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    likes: 19,
  },
  {
    id: 'entry-4',
    name: 'ريناد محمد',
    role: 'طالبة — الصف الثالث متوسط',
    message: 'مسابقة المليون وتحدي السرعة من أمتع ما جربت! تنافسنا في الفصل وكان الحماس عالي جداً.',
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    likes: 15,
  },
];

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey) {
    return {
      url: url.replace(/\/+$/, ''),
      anonKey,
    };
  }
  return null;
}

// قراءة التعليقات المحفوظة محلياً (Fallback)
function getLocalEntries(): GuestbookEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ENTRIES));
      return DEFAULT_ENTRIES;
    }
    const parsed = JSON.parse(raw) as GuestbookEntry[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ENTRIES;
  } catch {
    return DEFAULT_ENTRIES;
  }
}

function saveLocalEntries(entries: GuestbookEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

/**
 * فحص الأمان ومكافحة السبام
 */
export function validateCommentContent(message: string): { isValid: boolean; error?: string } {
  const trimmed = message.trim();
  if (trimmed.length < 3) {
    return { isValid: false, error: 'التعليق قصير جداً (أقل من 3 أحرف)' };
  }
  if (trimmed.length > 350) {
    return { isValid: false, error: 'التعليق طويل جداً (الحد الأقصى 350 حرفاً)' };
  }

  // منع نشر الروابط الإلكترونية في تعليقات المدرسة
  const linkRegex = /(https?:\/\/|www\.|\.com|\.net|\.org|\.xyz)/i;
  if (linkRegex.test(trimmed)) {
    return { isValid: false, error: 'عذراً، يمنع نشر الروابط الإلكترونية في سجل التعليقات' };
  }

  // منع نشر أرقام الهواتف لحماية الخصوصية
  const phoneRegex = /(\+?\d{8,14})/;
  if (phoneRegex.test(trimmed.replace(/\s+/g, ''))) {
    return { isValid: false, error: 'عذراً، يمنع نشر أرقام الهواتف لحماية الخصوصية' };
  }

  return { isValid: true };
}

/**
 * فحص المعدل الزمني (Rate limit: تعليق واحد كل 30 ثانية)
 */
export function checkRateLimit(): { isAllowed: boolean; remainingSeconds: number } {
  try {
    const lastTime = parseInt(localStorage.getItem(RATE_LIMIT_KEY) || '0', 10);
    const now = Date.now();
    const diff = (now - lastTime) / 1000;
    if (diff < 30) {
      return { isAllowed: false, remainingSeconds: Math.ceil(30 - diff) };
    }
  } catch {
    // ignore
  }
  return { isAllowed: true, remainingSeconds: 0 };
}

export function recordCommentTime() {
  try {
    localStorage.setItem(RATE_LIMIT_KEY, Date.now().toString());
  } catch {
    // ignore
  }
}

export const guestbookClient = {
  async getEntries(): Promise<GuestbookEntry[]> {
    const config = getSupabaseConfig();
    if (config) {
      try {
        const res = await fetch(
          `${config.url}/rest/v1/guestbook_entries?select=*&order=created_at.desc&limit=60`,
          {
            headers: {
              apikey: config.anonKey,
              Authorization: `Bearer ${config.anonKey}`,
            },
          }
        );
        if (res.ok) {
          const rows = await res.json() as Array<{
            id: string | number;
            name: string;
            role: string;
            message: string;
            created_at: string;
            likes: number;
          }>;
          return rows.map((r) => ({
            id: String(r.id),
            name: r.name,
            role: r.role,
            message: r.message,
            createdAt: r.created_at,
            likes: Number(r.likes || 0),
          }));
        }
      } catch {
        // Fallback to local storage if network or table issue
      }
    }
    return getLocalEntries();
  },

  async addEntry(entry: { name: string; role: string; message: string }): Promise<GuestbookEntry> {
    const config = getSupabaseConfig();
    if (config) {
      try {
        const res = await fetch(`${config.url}/rest/v1/guestbook_entries`, {
          method: 'POST',
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            name: entry.name.trim(),
            role: entry.role.trim(),
            message: entry.message.trim(),
            likes: 1,
          }),
        });

        if (res.ok) {
          const inserted = (await res.json()) as Array<{
            id: string | number;
            name: string;
            role: string;
            message: string;
            created_at: string;
            likes: number;
          }>;
          if (inserted && inserted[0]) {
            const row = inserted[0];
            recordCommentTime();
            return {
              id: String(row.id),
              name: row.name,
              role: row.role,
              message: row.message,
              createdAt: row.created_at,
              likes: Number(row.likes || 1),
            };
          }
        }
      } catch {
        // fallback
      }
    }

    // Local fallback
    const newLocal: GuestbookEntry = {
      id: `local-${Date.now()}`,
      name: entry.name.trim(),
      role: entry.role.trim() || 'طالب/ـة زائر',
      message: entry.message.trim(),
      createdAt: new Date().toISOString(),
      likes: 1,
    };
    const current = getLocalEntries();
    const updated = [newLocal, ...current];
    saveLocalEntries(updated);
    recordCommentTime();
    return newLocal;
  },

  async likeEntry(id: string, currentLikes: number): Promise<number> {
    const newLikes = currentLikes + 1;
    const config = getSupabaseConfig();
    if (config) {
      try {
        await fetch(`${config.url}/rest/v1/guestbook_entries?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ likes: newLikes }),
        });
      } catch {
        // ignore
      }
    }

    // Also update local storage
    const current = getLocalEntries();
    const updated = current.map((item) =>
      item.id === id ? { ...item, likes: newLikes } : item
    );
    saveLocalEntries(updated);
    return newLikes;
  },

  async deleteEntry(id: string, passcode: string): Promise<boolean> {
    if (passcode.trim() !== TEACHER_PASSCODE_HASH) {
      return false;
    }

    const config = getSupabaseConfig();
    if (config) {
      try {
        await fetch(`${config.url}/rest/v1/guestbook_entries?id=eq.${id}`, {
          method: 'DELETE',
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
          },
        });
      } catch {
        // ignore
      }
    }

    const current = getLocalEntries();
    const updated = current.filter((item) => item.id !== id);
    saveLocalEntries(updated);
    return true;
  },
};
