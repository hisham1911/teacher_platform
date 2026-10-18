import type {
  GrammarTopic,
  ReadingPassage,
  ListeningActivity,
  WritingPrompt,
  QuizQuestion,
} from '../content/types';
import { grammarTopics } from '../content/grammar';
import { readingPassages } from '../content/reading';
import { listeningActivities } from '../content/listening';
import { writingPrompts } from '../content/writing';

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

export interface StudentQuizResultRecord {
  id: string;
  studentName: string;
  studentGrade: string;
  category: 'placement' | 'grammar' | 'reading' | 'listening' | 'million' | 'speed' | 'competition';
  activityTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  cefrLevel?: string;
  verificationCode?: string;
  createdAt: string;
}

export interface CustomLessonRecord {
  id: string;
  section: 'grammar' | 'reading' | 'listening';
  slug: string;
  titleAr: string;
  titleEn: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  questions: QuizQuestion[];
  updatedAt: string;
}

const STORAGE_KEY = 'english_spark_guestbook_entries_v1';
const RATE_LIMIT_KEY = 'english_spark_last_comment_time';
const LIKED_ENTRIES_KEY = 'english_spark_liked_entries_v1';
const TEACHER_AUTH_KEY = 'english_spark_teacher_session_v1';
const RESULTS_STORAGE_KEY = 'english_spark_student_results_v1';
const CUSTOM_LESSONS_STORAGE_KEY = 'english_spark_custom_lessons_v1';
const CUSTOM_READING_STORAGE_KEY = 'english_spark_custom_reading_v1';
const CUSTOM_LISTENING_STORAGE_KEY = 'english_spark_custom_listening_v1';
const CUSTOM_WRITING_STORAGE_KEY = 'english_spark_custom_writing_v1';

export const TEACHER_USERNAME = 'maryam';
export const TEACHER_PASSCODE_HASH = 'maryam2026'; // رمز مرور المعلمة
export const TEACHER_OFFICIAL_NAME = 'معلمات اللغة الإنجليزية';
export const SCHOOL_PRINCIPAL_NAME = 'آمنة دغريري';

// تعليقات عامة أولية لسجل الزوار
const DEFAULT_GUESTBOOK_ENTRIES: GuestbookEntry[] = [
  {
    id: 'entry-1',
    name: 'سارة خالد',
    role: 'طالبة — الصف الثاني متوسط',
    message: 'مبادرة رائعة ومفيدة جداً من معلمات اللغة الإنجليزية، بطاقات القواعد والألوان جعلت حفظ الأزمنة وفهمها أسهل بكثير!',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    likes: 18,
  },
  {
    id: 'entry-2',
    name: 'أ. هدى الحربي',
    role: 'معلمة لغة إنجليزية',
    message: 'بارك الله في هذه الجهود المميزة في إنتاج المعرفة. تصميم المنصة وتنوع المسابقات يرفع دافعية الطالبات للتعلم. شكر خاص لمعلمات اللغة الإنجليزية وإدارة المدرسة.',
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    likes: 24,
  },
  {
    id: 'entry-3',
    name: 'أم محمد (ولي أمر)',
    role: 'ولي أمر',
    message: 'أشكر مدرسة متوسطة وثانوية الجرادية ومعلمات اللغة الإنجليزية على هذا العمل التعليمي المتقن. بناتي يستمتعن بحل التمارين يومياً.',
    createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    likes: 19,
  },
  {
    id: 'entry-4',
    name: 'ريناد محمد',
    role: 'طالبة — الصف الثالث متوسط',
    message: 'تحدي Spark وتحدي السرعة من أمتع ما جربت! تنافسنا في الفصل وكان الحماس عالي جداً.',
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    likes: 15,
  },
];

// استفسارات وأسئلة افتراضية مجابة من معلمات اللغة الإنجليزية لكل درس
export const DEFAULT_LESSON_QUESTIONS: Record<string, GuestbookEntry[]> = {
  'present-simple': [
    {
      id: 'q-ps-1',
      name: 'شهد عبدالله',
      role: 'طالبة — الصف الثاني متوسط',
      message: 'أستاذتي، متى نستخدم does ومتى نستخدم do في صياغة السؤال؟',
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
      message: 'شكراً لمعلمات اللغة الإنجليزية على الشرح الكرتوني، بطاقة الدرس واضحة جداً وسهلت علي الواجب!',
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
      message: 'أستاذتي، ما الفرق بين who و which في ضمائر الوصل؟',
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
// إدارة جلسة معلمات المادة (Teacher Authentication)
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
          return rows
            .filter((r) => r.topic_slug !== '__student_result__')
            .map((r) => ({
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
          return rows
            .filter((r) => r.topic_slug !== '__student_result__')
            .map((r) => ({
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
      role: entry.role.trim() || 'زائر كريم',
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

// ============================================================================
// 2. SUPABASE STORAGE MEDIA UPLOADER
// ============================================================================
/**
 * دالة ترفع ملف فيديو (.mp4) أو صورة من جوال المعلمة في الداشبورد
 * مباشرة إلى Supabase Storage وتعيد الرابط المباشر (Public URL)
 */
export async function uploadMediaToSupabase(
  file: File,
  folder: 'videos' | 'images' | 'audio' = 'videos'
): Promise<{ url: string; error?: string }> {
  // التحقق من حجم الملف (الحد الأقصى 50 ميجابايت في الباقة المجانية)
  const maxBytes = 50 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      url: '',
      error: 'حجم الملف أكبر من 50 ميجابايت. يرجى اختيار ملف أصغر أو وضع رابط خارجي.',
    };
  }

  const config = getSupabaseConfig();
  if (!config) {
    return {
      url: '',
      error: 'يرجى التأكد من إضافة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في إعدادات البيئة.',
    };
  }

  // توليد اسم ملف نظيف وفريد لمنع تكرار الأسماء أو مشاكل الحروف العربية
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const safeFileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  try {
    const uploadUrl = `${config.url}/storage/v1/object/videos/${safeFileName}`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': file.type || 'video/mp4',
        'x-upsert': 'true',
      },
      body: file,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[Storage Upload Error]:', errText);
      return { url: '', error: 'تعذر رفع الفيديو إلى السحابة، تأكدي من تفعيل مجلد videos في Supabase.' };
    }

    // إرجاع الرابط العام المباشر الذي سيُحفظ في جدول custom_lessons
    const publicUrl = `${config.url}/storage/v1/object/public/videos/${safeFileName}`;
    return { url: publicUrl };
  } catch (err) {
    console.error('[Storage Upload Exception]:', err);
    return { url: '', error: 'حدث خطأ في الاتصال بالإنترنت أثناء رفع الفيديو.' };
  }
}

// ============================================================================
// 3. STUDENT QUIZ & PLACEMENT RESULTS CLIENT (SUPABASE + LOCAL FALLBACK)
// ============================================================================
const DEFAULT_STUDENT_RESULTS: StudentQuizResultRecord[] = [
  {
    id: 'seed-res-1',
    studentName: 'فاطمة أحمد دغريري',
    studentGrade: 'الأول الثانوي',
    category: 'placement',
    activityTitle: 'التشخيص الشامل (Comprehensive Diagnostic)',
    score: 22,
    totalQuestions: 24,
    percentage: 92,
    cefrLevel: 'B2',
    verificationCode: 'SPARK-PL-89A1',
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-res-2',
    studentName: 'رغد محمد الحكمي',
    studentGrade: 'الثالث المتوسط',
    category: 'grammar',
    activityTitle: 'المضارع البسيط (Present Simple)',
    score: 4,
    totalQuestions: 4,
    percentage: 100,
    cefrLevel: 'A2+',
    verificationCode: 'SPARK-GR-44B2',
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
];

function getLocalResults(): StudentQuizResultRecord[] {
  try {
    const raw = localStorage.getItem(RESULTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(DEFAULT_STUDENT_RESULTS));
      return DEFAULT_STUDENT_RESULTS;
    }
    const parsed = JSON.parse(raw) as StudentQuizResultRecord[];
    return Array.isArray(parsed) ? parsed : DEFAULT_STUDENT_RESULTS;
  } catch {
    return DEFAULT_STUDENT_RESULTS;
  }
}

const RESULT_CATEGORY_VALUES: StudentQuizResultRecord['category'][] = [
  'placement',
  'grammar',
  'reading',
  'listening',
  'million',
  'speed',
  'competition',
];

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function resolveResultCategory(
  parsed: Partial<StudentQuizResultRecord>
): StudentQuizResultRecord['category'] {
  if (parsed.category && RESULT_CATEGORY_VALUES.includes(parsed.category)) {
    return parsed.category;
  }
  const title = parsed.activityTitle ?? '';
  if (title.includes('المليون')) return 'million';
  if (title.includes('السرعة')) return 'speed';
  if (title.includes('سفيرة') || title.includes('وطن')) return 'competition';
  if (title.includes('المستوى') || title.includes('التشخيص')) return 'placement';
  if (title.includes('استماع')) return 'listening';
  if (title.includes('قراءة')) return 'reading';
  return 'grammar';
}

export const studentResultsClient = {
  async getAllResults(): Promise<StudentQuizResultRecord[]> {
    const config = getSupabaseConfig();
    const cloudResults: StudentQuizResultRecord[] = [];

    if (config) {
      try {
        const res = await fetch(
          `${config.url}/rest/v1/guestbook_entries?select=*&topic_slug=eq.__student_result__&order=created_at.desc&limit=300`,
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
          }>;
          for (const r of rows) {
            try {
              const parsed = JSON.parse(r.message) as Partial<StudentQuizResultRecord>;
              cloudResults.push({
                id: String(r.id),
                studentName: parsed.studentName || r.name,
                studentGrade: parsed.studentGrade || r.role || 'المرحلة المتوسطة',
                category: resolveResultCategory(parsed),
                activityTitle: parsed.activityTitle || 'نشاط تفاعلي',
                score: Number(parsed.score ?? 0),
                totalQuestions: Number(parsed.totalQuestions ?? 10),
                percentage: clampPercentage(Number(parsed.percentage ?? 0)),
                cefrLevel: parsed.cefrLevel,
                verificationCode: parsed.verificationCode || `SPARK-${r.id}`,
                createdAt: parsed.createdAt || r.created_at,
              });
            } catch {
              // Ignore invalid JSON messages
            }
          }
        }
      } catch {
        // Fallback to local
      }
    }

    // Merge cloud results with local results, deduplicating by verificationCode or id
    const localList = getLocalResults();
    const map = new Map<string, StudentQuizResultRecord>();

    // 1. Cloud results
    for (const r of cloudResults) {
      const key = r.verificationCode || r.id;
      map.set(key, r);
    }

    // 2. Local results
    for (const r of localList) {
      const key = r.verificationCode || r.id;
      if (!map.has(key)) {
        map.set(key, r);
      }
    }

    const merged = Array.from(map.values())
      .map((r) => ({ ...r, percentage: clampPercentage(r.percentage) }))
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    if (merged.length > 0) {
      try {
        localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
      return merged;
    }

    return DEFAULT_STUDENT_RESULTS;
  },

  async recordResult(input: {
    studentName: string;
    studentGrade?: string;
    category: StudentQuizResultRecord['category'];
    activityTitle: string;
    score: number;
    totalQuestions: number;
    cefrLevel?: string;
    verificationCode?: string;
  }): Promise<StudentQuizResultRecord> {
    const percentage = clampPercentage(
      (input.score / Math.max(1, input.totalQuestions)) * 100
    );
    const verificationCode =
      input.verificationCode ||
      'SPARK-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    const record: StudentQuizResultRecord = {
      id: `res-${Date.now()}`,
      studentName: input.studentName.trim(),
      studentGrade: input.studentGrade || 'عام',
      category: input.category,
      activityTitle: input.activityTitle,
      score: input.score,
      totalQuestions: input.totalQuestions,
      percentage,
      cefrLevel: input.cefrLevel,
      verificationCode,
      createdAt: new Date().toISOString(),
    };

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
            name: record.studentName,
            role: record.studentGrade,
            message: JSON.stringify(record),
            topic_slug: '__student_result__',
            likes: 0,
          }),
        });
        if (res.ok) {
          const inserted = (await res.json()) as Array<{ id: string | number }>;
          if (inserted?.[0]) {
            record.id = String(inserted[0].id);
          }
        }
      } catch {
        // ignore
      }
    }

    try {
      const current = getLocalResults();
      localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify([record, ...current]));
    } catch {
      // ignore
    }
    return record;
  },

  async deleteResult(id: string): Promise<boolean> {
    if (!isTeacherLoggedIn()) return false;
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
    try {
      const current = getLocalResults().filter((r) => r.id !== id);
      localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // ignore
    }
    return true;
  },
};

// ============================================================================
// 4. MULTI-SKILL CONTENT & QUESTIONS CMS (GRAMMAR, READING, LISTENING, WRITING)
// ============================================================================
export function getLocalCustomLessons(): CustomLessonRecord[] {
  try {
    const raw = localStorage.getItem(CUSTOM_LESSONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomLessonRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getMergedGrammarTopics(): GrammarTopic[] {
  const custom = getLocalCustomLessons().filter((c) => c.section === 'grammar');
  const customMap = new Map(custom.map((c) => [c.slug, c]));
  const merged: GrammarTopic[] = grammarTopics.map((builtIn) => {
    const override = customMap.get(builtIn.slug);
    if (override) {
      customMap.delete(builtIn.slug);
      return {
        slug: override.slug,
        titleAr: override.titleAr,
        titleEn: override.titleEn,
        description: override.description,
        imageUrl: override.imageUrl || builtIn.imageUrl,
        videoUrl: override.videoUrl ?? builtIn.videoUrl,
        posterUrl: builtIn.posterUrl,
        questions: override.questions,
      };
    }
    return builtIn;
  });

  for (const extra of customMap.values()) {
    const safeImageUrl =
      extra.imageUrl === '/content/grammar/present-simple.jpg' && extra.slug !== 'present-simple'
        ? ''
        : (extra.imageUrl || '');

    merged.push({
      slug: extra.slug,
      titleAr: extra.titleAr,
      titleEn: extra.titleEn,
      description: extra.description,
      imageUrl: safeImageUrl,
      videoUrl: extra.videoUrl,
      questions: extra.questions,
    });
  }
  return merged;
}

export function getMergedReadingPassages(): ReadingPassage[] {
  try {
    const raw = localStorage.getItem(CUSTOM_READING_STORAGE_KEY);
    const customList: ReadingPassage[] = raw ? JSON.parse(raw) : [];
    const customMap = new Map(customList.map((c) => [c.slug, c]));

    const merged: ReadingPassage[] = readingPassages.map((builtIn) => {
      const override = customMap.get(builtIn.slug);
      if (override) {
        customMap.delete(builtIn.slug);
        return {
          ...builtIn,
          ...override,
        };
      }
      return builtIn;
    });

    for (const extra of customMap.values()) {
      merged.push(extra);
    }
    return merged;
  } catch {
    return readingPassages;
  }
}

export function getMergedListeningActivities(): ListeningActivity[] {
  try {
    const raw = localStorage.getItem(CUSTOM_LISTENING_STORAGE_KEY);
    const customList: ListeningActivity[] = raw ? JSON.parse(raw) : [];
    const customMap = new Map(customList.map((c) => [c.slug, c]));

    const merged: ListeningActivity[] = listeningActivities.map((builtIn) => {
      const override = customMap.get(builtIn.slug);
      if (override) {
        customMap.delete(builtIn.slug);
        return {
          ...builtIn,
          ...override,
        };
      }
      return builtIn;
    });

    for (const extra of customMap.values()) {
      merged.push(extra);
    }
    return merged;
  } catch {
    return listeningActivities;
  }
}

export function getMergedWritingPrompts(): WritingPrompt[] {
  try {
    const raw = localStorage.getItem(CUSTOM_WRITING_STORAGE_KEY);
    const customList: WritingPrompt[] = raw ? JSON.parse(raw) : [];
    const customMap = new Map(customList.map((c) => [c.id || c.slug, c]));

    const merged: WritingPrompt[] = writingPrompts.map((builtIn) => {
      const key = builtIn.id || builtIn.slug;
      const override = customMap.get(key);
      if (override) {
        customMap.delete(key);
        return {
          ...builtIn,
          ...override,
        };
      }
      return builtIn;
    });

    for (const extra of customMap.values()) {
      merged.push(extra);
    }
    return merged;
  } catch {
    return writingPrompts;
  }
}

export const customLessonsClient = {
  async saveLesson(lesson: Omit<CustomLessonRecord, 'updatedAt'>): Promise<CustomLessonRecord> {
    const saved: CustomLessonRecord = {
      ...lesson,
      updatedAt: new Date().toISOString(),
    };
    const config = getSupabaseConfig();
    if (config) {
      try {
        await fetch(`${config.url}/rest/v1/custom_lessons`, {
          method: 'POST',
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            section_id: saved.section,
            slug: saved.slug,
            title_ar: saved.titleAr,
            title_en: saved.titleEn,
            description: saved.description,
            video_url: saved.videoUrl || '',
            image_url: saved.imageUrl || '',
            questions: saved.questions,
          }),
        });
      } catch {
        // fallback
      }
    }

    try {
      const current = getLocalCustomLessons().filter((c) => c.slug !== saved.slug);
      localStorage.setItem(CUSTOM_LESSONS_STORAGE_KEY, JSON.stringify([saved, ...current]));
    } catch {
      // ignore
    }
    return saved;
  },

  async deleteCustomLesson(slug: string): Promise<void> {
    try {
      const current = getLocalCustomLessons().filter((c) => c.slug !== slug);
      localStorage.setItem(CUSTOM_LESSONS_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // ignore
    }
  },

  async saveGrammarTopic(topic: GrammarTopic): Promise<GrammarTopic> {
    await this.saveLesson({
      id: topic.slug,
      section: 'grammar',
      slug: topic.slug,
      titleAr: topic.titleAr,
      titleEn: topic.titleEn,
      description: topic.description,
      imageUrl: topic.imageUrl,
      videoUrl: topic.videoUrl,
      questions: topic.questions,
    });
    return topic;
  },

  async deleteGrammarTopic(slug: string): Promise<void> {
    await this.deleteCustomLesson(slug);
  },

  async saveReadingPassage(passage: ReadingPassage): Promise<ReadingPassage> {
    try {
      const raw = localStorage.getItem(CUSTOM_READING_STORAGE_KEY);
      const customOnly: ReadingPassage[] = raw ? JSON.parse(raw) : [];
      const filtered = customOnly.filter((p) => p.slug !== passage.slug);
      localStorage.setItem(CUSTOM_READING_STORAGE_KEY, JSON.stringify([passage, ...filtered]));
    } catch {
      // ignore
    }
    return passage;
  },

  async deleteReadingPassage(slug: string): Promise<void> {
    try {
      const raw = localStorage.getItem(CUSTOM_READING_STORAGE_KEY);
      const customOnly: ReadingPassage[] = raw ? JSON.parse(raw) : [];
      const filtered = customOnly.filter((p) => p.slug !== slug);
      localStorage.setItem(CUSTOM_READING_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  },

  async saveListeningActivity(activity: ListeningActivity): Promise<ListeningActivity> {
    try {
      const raw = localStorage.getItem(CUSTOM_LISTENING_STORAGE_KEY);
      const customOnly: ListeningActivity[] = raw ? JSON.parse(raw) : [];
      const filtered = customOnly.filter((p) => p.slug !== activity.slug);
      localStorage.setItem(CUSTOM_LISTENING_STORAGE_KEY, JSON.stringify([activity, ...filtered]));
    } catch {
      // ignore
    }
    return activity;
  },

  async deleteListeningActivity(slug: string): Promise<void> {
    try {
      const raw = localStorage.getItem(CUSTOM_LISTENING_STORAGE_KEY);
      const customOnly: ListeningActivity[] = raw ? JSON.parse(raw) : [];
      const filtered = customOnly.filter((p) => p.slug !== slug);
      localStorage.setItem(CUSTOM_LISTENING_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  },

  async saveWritingPrompt(prompt: WritingPrompt): Promise<WritingPrompt> {
    try {
      const raw = localStorage.getItem(CUSTOM_WRITING_STORAGE_KEY);
      const customOnly: WritingPrompt[] = raw ? JSON.parse(raw) : [];
      const key = prompt.id || prompt.slug;
      const filtered = customOnly.filter((p) => (p.id || p.slug) !== key);
      localStorage.setItem(CUSTOM_WRITING_STORAGE_KEY, JSON.stringify([prompt, ...filtered]));
    } catch {
      // ignore
    }
    return prompt;
  },

  async deleteWritingPrompt(idOrSlug: string): Promise<void> {
    try {
      const raw = localStorage.getItem(CUSTOM_WRITING_STORAGE_KEY);
      const customOnly: WritingPrompt[] = raw ? JSON.parse(raw) : [];
      const filtered = customOnly.filter((p) => (p.id || p.slug) !== idOrSlug);
      localStorage.setItem(CUSTOM_WRITING_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  },
};

