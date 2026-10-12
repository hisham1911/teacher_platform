export interface GuestbookEntry {
  id: string;
  name: string;
  role: string;
  message: string;
  createdAt: string;
  likes: number;
  topicSlug?: string;
  teacherReply?: string;
  repliedAt?: string;
}

export interface TeacherSession {
  authenticated: boolean;
  username: string;
  name: string;
  loggedInAt: string;
}

const STORAGE_KEY = 'english_spark_guestbook_entries_v1';
const RATE_LIMIT_KEY = 'english_spark_last_comment_time';
const LIKED_ENTRIES_KEY = 'english_spark_liked_entries_v1';
const TEACHER_AUTH_KEY = 'english_spark_teacher_session_v1';

export const TEACHER_USERNAME = 'maryam';
export const TEACHER_PASSCODE_HASH = 'maryam2026'; // رمز مرور المعلمة
export const TEACHER_OFFICIAL_NAME = 'مريم الصميلي';

// تعليقات عامة أولية لسجل الزوار
const DEFAULT_GUESTBOOK_ENTRIES: GuestbookEntry[] = [
  {
    id: 'entry-1',
    name: 'سارة خالد',
    role: 'طالبة — الصف الثاني متوسط',
    message: 'مبادرة رائعة ومفيدة جداً من المعلمة مريم الصميلي، بطاقات القواعد والألوان جعلت حفظ الأزمنة وفهمها أسهل بكثير!',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    likes: 18,
  },
  {
    id: 'entry-2',
    name: 'أ. هدى الحربي',
    role: 'معلمة لغة إنجليزية',
    message: 'بارك الله في هذه الجهود المميزة في إنتاج المعرفة. تصميم المنصة وتنوع المسابقات يرفع دافعية الطالبات للتعلم. شكر خاص للمعلمة مريم الصميلي.',
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    likes: 24,
  },
  {
    id: 'entry-3',
    name: 'أم محمد (ولي أمر)',
    role: 'ولي أمر',
    message: 'أشكر مدرسة متوسطة وثانوية الجرادية والمعلمة مريم الصميلي على هذا العمل التعليمي المتقن. بناتي يستمتعن بحل التمارين يومياً.',
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

// استفسارات وأسئلة افتراضية مجابة من المعلمة مريم الصميلي لكل درس
export const DEFAULT_LESSON_QUESTIONS: Record<string, GuestbookEntry[]> = {
  'present-simple': [
    {
      id: 'q-ps-1',
      name: 'شهد عبدالله',
      role: 'طالبة — الصف الثاني متوسط',
      message: 'أستاذة مريم، متى نستخدم does ومتى نستخدم do في صياغة السؤال؟',
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      likes: 8,
      topicSlug: 'present-simple',
      teacherReply: 'أهلاً بكِ يا شهد 🌸! نستخدم Does مع الفاعل المفرد (He, She, It) مثل: Does he play? ونستخدم Do مع الجمع والضمائر (I, You, We, They). ودائماً بعدهما يعود الفعل لأصله بدون s.',
      repliedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000 + 3600 * 1000).toISOString(),
    },
    {
      id: 'q-ps-2',
      name: 'ريم القحطاني',
      role: 'طالبة — الصف الأول متوسط',
      message: 'شكراً أستاذة مريم الصميلي على الشرح الكرتوني، بطاقة الدرس واضحة جداً وسهلت علي الواجب!',
      createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      likes: 5,
      topicSlug: 'present-simple',
    },
  ],
  'present-progressive': [
    {
      id: 'q-pp-1',
      name: 'ليان أحمد',
      role: 'طالبة — الصف الثالث متوسط',
      message: 'أستاذة، هل كل الأفعال تقبل إضافة ing في المضارع المستمر؟',
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      likes: 9,
      topicSlug: 'present-progressive',
      teacherReply: 'سؤال ذكي ومميز يا ليان! هناك أفعال المشاعر والحواس والإدراك (Stative Verbs) مثل: like, love, know, believe عادةً لا تأتي بصيغة المستمر ونستخدم معها المضارع البسيط.',
      repliedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000 + 7200 * 1000).toISOString(),
    },
  ],
  'relative-clauses': [
    {
      id: 'q-rc-1',
      name: 'أثير محمد',
      role: 'طالبة — المرحلة الثانوية',
      message: 'أستاذة مريم، ما الفرق بين who و which في ضمائر الوصل؟',
      createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      likes: 7,
      topicSlug: 'relative-clauses',
      teacherReply: 'أهلاً يا أثير! نستخدم who للأشخاص العاقلين (People) مثل: The teacher who..., ونستخدم which للأشياء والحيوانات وغير العاقل (Things) مثل: The book which...',
      repliedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000 + 4000 * 1000).toISOString(),
    },
  ],
  'simple-future': [
    {
      id: 'q-sf-1',
      name: 'أم جنى (ولي أمر)',
      role: 'ولي أمر',
      message: 'فيديو Will vs Be Going To رائع وممتع جداً، ابنتي فهمت الفرق فوراً من أول مشاهدة.',
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      likes: 12,
      topicSlug: 'simple-future',
      teacherReply: 'أسعدني جداً ذلك أختي الفاضلة! هدفنا تبسيط القواعد وجعلها تجربة ممتعة وبصرية لبناتنا الطالبات. شكراً لدعمكِ 🌷',
      repliedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000 + 5000 * 1000).toISOString(),
    },
  ],
  'future-perfect': [
    {
      id: 'q-fp-1',
      name: 'خلود العتيبي',
      role: 'طالبة — المرحلة الثانوية',
      message: 'أستاذة، متى يكتمل الحدث في المستقبل التام بالضبط؟',
      createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      likes: 4,
      topicSlug: 'future-perfect',
      teacherReply: 'أهلاً يا خلود! المستقبل التام يعبر عن حدث سينتهي تماماً قبل وقت محدد في المستقبل، وغالباً نستخدم معه عبارة (By next week, By 2027, By tomorrow).',
      repliedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000 + 3000 * 1000).toISOString(),
    },
  ],
};

function getStorageKey(topicSlug?: string) {
  return topicSlug ? `${STORAGE_KEY}_topic_${topicSlug}` : STORAGE_KEY;
}

function cleanEnvString(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

export function getSupabaseConfig() {
  const url = cleanEnvString(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '');
  const anonKey = cleanEnvString(import.meta.env.VITE_SUPABASE_ANON_KEY);
  if (url && anonKey) {
    return {
      url,
      anonKey,
    };
  }
  return null;
}

function getLocalEntries(topicSlug?: string): GuestbookEntry[] {
  const key = getStorageKey(topicSlug);
  const defaultList = topicSlug
    ? DEFAULT_LESSON_QUESTIONS[topicSlug] || []
    : DEFAULT_GUESTBOOK_ENTRIES;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      if (defaultList.length > 0) {
        localStorage.setItem(key, JSON.stringify(defaultList));
      }
      return defaultList;
    }
    const parsed = JSON.parse(raw) as GuestbookEntry[];
    return Array.isArray(parsed) ? parsed : defaultList;
  } catch {
    return defaultList;
  }
}

function saveLocalEntries(entries: GuestbookEntry[], topicSlug?: string) {
  try {
    const key = getStorageKey(topicSlug);
    localStorage.setItem(key, JSON.stringify(entries));
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
    return { isValid: false, error: 'الرسالة قصيرة جداً (أقل من 3 أحرف)' };
  }
  if (trimmed.length > 350) {
    return { isValid: false, error: 'الرسالة طويلة جداً (الحد الأقصى 350 حرفاً)' };
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

// -------------------------------------------------------------
// إدارة الإعجابات ومكافحة التكرار اللانهائي (Like Toggling)
// -------------------------------------------------------------
export function getLikedEntries(): string[] {
  try {
    const raw = localStorage.getItem(LIKED_ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isEntryLiked(id: string): boolean {
  const list = getLikedEntries();
  return list.includes(id);
}

export function saveLikedEntries(ids: string[]) {
  try {
    localStorage.setItem(LIKED_ENTRIES_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// إدارة جلسة المعلمة مريم الصميلي (Teacher Authentication)
// -------------------------------------------------------------
export function isTeacherLoggedIn(): boolean {
  try {
    const raw = localStorage.getItem(TEACHER_AUTH_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw) as TeacherSession;
    return Boolean(session?.authenticated);
  } catch {
    return false;
  }
}

export function getTeacherSession(): TeacherSession | null {
  try {
    const raw = localStorage.getItem(TEACHER_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TeacherSession;
  } catch {
    return null;
  }
}

export function loginTeacher(username: string, passcode: string): boolean {
  const normUser = username.trim().toLowerCase();
  const validUsernames = ['maryam', 'maryam_alsomaili', 'مريم', 'معلمة مريم'];
  const isUserValid = validUsernames.includes(normUser);
  const isPassValid = passcode.trim() === TEACHER_PASSCODE_HASH;

  if (isUserValid && isPassValid) {
    const session: TeacherSession = {
      authenticated: true,
      username: normUser,
      name: TEACHER_OFFICIAL_NAME,
      loggedInAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(TEACHER_AUTH_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
    return true;
  }
  return false;
}

export function logoutTeacher() {
  try {
    localStorage.removeItem(TEACHER_AUTH_KEY);
  } catch {
    // ignore
  }
}

export const guestbookClient = {
  async getEntries(topicSlug?: string): Promise<GuestbookEntry[]> {
    const config = getSupabaseConfig();
    if (config) {
      try {
        const queryFilter = topicSlug
          ? `&topic_slug=eq.${encodeURIComponent(topicSlug)}`
          : `&topic_slug=is.null`;

        const res = await fetch(
          `${config.url}/rest/v1/guestbook_entries?select=*${queryFilter}&order=created_at.desc&limit=50`,
          {
            headers: {
              apikey: config.anonKey,
              Authorization: `Bearer ${config.anonKey}`,
            },
          }
        );
        if (res.ok) {
          const rows = (await res.json()) as Array<{
            id: string | number;
            name: string;
            role: string;
            message: string;
            created_at: string;
            likes: number;
            topic_slug?: string;
            teacher_reply?: string;
            replied_at?: string;
          }>;
          return rows.map((r) => ({
            id: String(r.id),
            name: r.name,
            role: r.role,
            message: r.message,
            createdAt: r.created_at,
            likes: Number(r.likes || 0),
            topicSlug: r.topic_slug,
            teacherReply: r.teacher_reply,
            repliedAt: r.replied_at,
          }));
        } else {
          const errText = await res.text().catch(() => '');
          console.warn(`[Guestbook] Supabase getEntries error (${res.status}):`, errText);
        }
      } catch (err) {
        console.warn('[Guestbook] Supabase getEntries fetch failed:', err);
      }
    }
    return getLocalEntries(topicSlug);
  },

  /**
   * جلب كافة استفسارات وتعليقات المنصة للمركز الرئيسي لإدارة المعلمة
   */
  async getAllEntriesAcrossPlatform(): Promise<GuestbookEntry[]> {
    const config = getSupabaseConfig();
    if (config) {
      try {
        const res = await fetch(
          `${config.url}/rest/v1/guestbook_entries?select=*&order=created_at.desc&limit=200`,
          {
            headers: {
              apikey: config.anonKey,
              Authorization: `Bearer ${config.anonKey}`,
            },
          }
        );
        if (res.ok) {
          const rows = (await res.json()) as Array<{
            id: string | number;
            name: string;
            role: string;
            message: string;
            created_at: string;
            likes: number;
            topic_slug?: string;
            teacher_reply?: string;
            replied_at?: string;
          }>;
          return rows.map((r) => ({
            id: String(r.id),
            name: r.name,
            role: r.role,
            message: r.message,
            createdAt: r.created_at,
            likes: Number(r.likes || 0),
            topicSlug: r.topic_slug,
            teacherReply: r.teacher_reply,
            repliedAt: r.replied_at,
          }));
        }
      } catch {
        // Fallback to local aggregation
      }
    }

    // Local Storage Aggregation
    const knownTopics = [
      'present-simple',
      'present-progressive',
      'relative-clauses',
      'simple-future',
      'future-perfect',
      'past-simple',
      'past-progressive',
      'present-perfect',
      'future-progressive',
    ];

    const allMap = new Map<string, GuestbookEntry>();

    // 1. General guestbook
    const general = getLocalEntries();
    for (const e of general) allMap.set(e.id, e);

    // 2. All lesson topics
    for (const slug of knownTopics) {
      const topicList = getLocalEntries(slug);
      for (const e of topicList) allMap.set(e.id, e);
    }

    return Array.from(allMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async addEntry(entry: {
    name: string;
    role: string;
    message: string;
    topicSlug?: string;
  }): Promise<GuestbookEntry> {
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
            topic_slug: entry.topicSlug ?? null,
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
            topic_slug?: string;
            teacher_reply?: string;
            replied_at?: string;
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
              topicSlug: row.topic_slug,
              teacherReply: row.teacher_reply,
              repliedAt: row.replied_at,
            };
          }
        } else {
          const errText = await res.text().catch(() => '');
          console.error(`[Guestbook] Supabase addEntry error (${res.status}):`, errText);
        }
      } catch (err) {
        console.error('[Guestbook] Supabase addEntry fetch failed:', err);
      }
    }

    // Local fallback
    const newLocal: GuestbookEntry = {
      id: `local-${Date.now()}`,
      name: entry.name.trim(),
      role: entry.role.trim() || 'طالبة زائرة',
      message: entry.message.trim(),
      createdAt: new Date().toISOString(),
      likes: 1,
      topicSlug: entry.topicSlug,
    };
    const current = getLocalEntries(entry.topicSlug);
    const updated = [newLocal, ...current];
    saveLocalEntries(updated, entry.topicSlug);
    recordCommentTime();
    return newLocal;
  },

  /**
   * الإعجاب التفاعلي المنضبط (Toggle like: إعجاب واحد فقط لكل مستخدم)
   */
  async toggleLike(
    id: string,
    currentLikes: number,
    topicSlug?: string
  ): Promise<{ newLikes: number; isLiked: boolean }> {
    const liked = getLikedEntries();
    const alreadyLiked = liked.includes(id);

    let updatedLiked: string[];
    let newLikes: number;

    if (alreadyLiked) {
      // إلغاء الإعجاب
      updatedLiked = liked.filter((item) => item !== id);
      newLikes = Math.max(0, currentLikes - 1);
    } else {
      // إضافة إعجاب
      updatedLiked = [...liked, id];
      newLikes = currentLikes + 1;
    }

    saveLikedEntries(updatedLiked);

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

    // Update local storage
    const current = getLocalEntries(topicSlug);
    const updated = current.map((item) =>
      item.id === id ? { ...item, likes: newLikes } : item
    );
    saveLocalEntries(updated, topicSlug);

    return { newLikes, isLiked: !alreadyLiked };
  },

  async likeEntry(id: string, currentLikes: number, topicSlug?: string): Promise<number> {
    const res = await this.toggleLike(id, currentLikes, topicSlug);
    return res.newLikes;
  },

  async addTeacherReply(
    id: string,
    reply: string,
    passcodeOrSession?: string,
    topicSlug?: string
  ): Promise<boolean> {
    const isAuthed =
      isTeacherLoggedIn() || (passcodeOrSession?.trim() === TEACHER_PASSCODE_HASH);

    if (!isAuthed) {
      return false;
    }

    const nowIso = new Date().toISOString();
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
          body: JSON.stringify({
            teacher_reply: reply.trim(),
            replied_at: nowIso,
          }),
        });
      } catch {
        // ignore
      }
    }

    const current = getLocalEntries(topicSlug);
    const updated = current.map((item) =>
      item.id === id ? { ...item, teacherReply: reply.trim(), repliedAt: nowIso } : item
    );
    saveLocalEntries(updated, topicSlug);
    return true;
  },

  async deleteEntry(
    id: string,
    passcodeOrSession?: string,
    topicSlug?: string
  ): Promise<boolean> {
    const isAuthed =
      isTeacherLoggedIn() || (passcodeOrSession?.trim() === TEACHER_PASSCODE_HASH);

    if (!isAuthed) {
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

    const current = getLocalEntries(topicSlug);
    const updated = current.filter((item) => item.id !== id);
    saveLocalEntries(updated, topicSlug);
    return true;
  },
};
