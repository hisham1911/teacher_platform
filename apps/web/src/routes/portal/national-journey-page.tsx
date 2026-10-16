import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router';
import {
  Award,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Volume2,
  VolumeX,
  Printer,
  Heart,
  ShieldCheck,
  Compass,
  Landmark,
  Palmtree,
  Building2,
  Feather,
  Star,
  RotateCcw,
  Trash2,
  Send,
  MessageSquareHeart,
  Crown,
  Share2,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { EnglishSparkLogo } from '../../components/portal/english-spark-logo';
import {
  NATIONAL_INITIATIVE_META,
  NATIONAL_JOURNEY_STAGES,
  FINAL_CHAPTER_PROMPTS,
  IMMORTAL_PLEDGE_STATEMENT,
  type NationalJourneyStage,
} from '../../data/content/national-journey-data';
import {
  guestbookClient,
  studentResultsClient,
  getLikedEntries,
  isTeacherLoggedIn,
  TEACHER_OFFICIAL_NAME,
  type GuestbookEntry,
} from '../../data/api-client/guestbook-client';

type FlowPhase =
  | 'welcome'
  | 'journey-quiz'
  | 'stage-celebration'
  | 'final-chapter'
  | 'coronation'
  | 'voices-wall';

const GRADE_OPTIONS = [
  'الصف الرابع الابتدائي',
  'الصف الخامس الابتدائي',
  'الصف السادس الابتدائي',
  'الصف الأول المتوسط',
  'الصف الثاني المتوسط',
  'الصف الثالث المتوسط',
  'المرحلة الثانوية',
];

const LOCAL_VOICES_STORAGE_KEY = 'spark_national_pride_voices_v1';

interface ParsedVoicePayload {
  dream: string;
  promise: string;
  pride: string;
  rawMessage: string;
}

function encodeVoiceMessage(dream: string, promise: string, pride: string): string {
  return [
    `🌟 My Dream for Saudi Arabia: ${dream.trim()}`,
    `🤝 My Promise in Action: ${promise.trim()}`,
    `🇸🇦 A Message of Pride: ${pride.trim()}`,
  ].join('\n');
}

function parseVoiceMessage(message: string): ParsedVoicePayload {
  const lines = message
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  let dream = '';
  let promise = '';
  let pride = '';

  for (const line of lines) {
    if (line.includes('My Dream for Saudi Arabia:')) {
      dream = line.split('My Dream for Saudi Arabia:')[1]?.trim() ?? '';
    } else if (line.includes('My Promise in Action:')) {
      promise = line.split('My Promise in Action:')[1]?.trim() ?? '';
    } else if (line.includes('A Message of Pride:')) {
      pride = line.split('A Message of Pride:')[1]?.trim() ?? '';
    }
  }

  return {
    dream,
    promise,
    pride,
    rawMessage: message,
  };
}

/**
 * Web Audio API sound effects & ceremonial national melody generator
 */
function playNationalSound(type: 'start' | 'correct' | 'retry' | 'badge' | 'coronation') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playNote = (freq: number, startOffset: number, duration: number, gainVal = 0.12) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + duration);
    };

    if (type === 'correct') {
      playNote(523.25, 0, 0.22, 0.12);
      playNote(659.25, 0.12, 0.3, 0.14);
    } else if (type === 'retry') {
      playNote(329.63, 0, 0.2, 0.08);
      playNote(293.66, 0.15, 0.25, 0.08);
    } else if (type === 'badge') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        playNote(f, idx * 0.1, 0.35, 0.14);
      });
    } else if (type === 'start' || type === 'coronation') {
      // Ceremonial Saudi-inspired majestic fanfare
      const melody = [
        { f: 392.0, t: 0, d: 0.35 },
        { f: 440.0, t: 0.22, d: 0.35 },
        { f: 523.25, t: 0.44, d: 0.4 },
        { f: 587.33, t: 0.7, d: 0.45 },
        { f: 659.25, t: 1.0, d: 0.55 },
        { f: 783.99, t: 1.35, d: 0.8 },
      ];
      melody.forEach((n) => {
        playNote(n.f, n.t, n.d, 0.14);
      });
    }
  } catch {
    // Ignore if AudioContext is blocked
  }
}

function StageBadgeIcon({
  icon,
  className = 'h-6 w-6',
}: {
  icon: NationalJourneyStage['badgeIcon'];
  className?: string;
}) {
  if (icon === 'history') return <Landmark className={className} />;
  if (icon === 'cities') return <Building2 className={className} />;
  if (icon === 'nature') return <Palmtree className={className} />;
  return <Compass className={className} />;
}

/**
 * Custom Royal Saudi National Artwork (Vector SVG Banner)
 */
function SaudiNationalBannerArtwork() {
  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-2xl border border-amber-300/50 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 p-4 sm:p-7 shadow-xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-400/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl"
      />

      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row items-center text-center sm:text-right gap-3.5 sm:gap-4">
          <div className="relative flex h-18 w-18 sm:h-22 sm:w-22 shrink-0 items-center justify-center rounded-3xl border-2 border-amber-400/70 bg-gradient-to-b from-emerald-800/90 to-emerald-950 shadow-[0_0_30px_rgba(251,191,36,0.25)]">
            <svg
              viewBox="0 0 120 120"
              className="h-12 w-12 sm:h-15 sm:w-15 drop-shadow-md"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M60 32V68" stroke="#FBBF24" strokeWidth="5" strokeLinecap="round" />
              <path
                d="M60 35C48 25 34 30 28 38M60 35C72 25 86 30 92 38M60 42C46 36 35 43 32 50M60 42C74 36 85 43 88 50M60 30C52 18 42 20 38 25M60 30C68 18 78 20 82 25"
                stroke="#FDE68A"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M26 92C48 82 72 68 92 58M94 92C72 82 48 68 28 58"
                stroke="#F59E0B"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              <circle cx="25" cy="93" r="3.5" fill="#FDE68A" />
              <circle cx="95" cy="93" r="3.5" fill="#FDE68A" />
            </svg>
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-300/40 px-3 py-0.5 text-[11px] font-black text-amber-200">
              <span>🇸🇦 المملكة العربية السعودية</span>
            </span>
            <h2 className="mt-1.5 text-lg sm:text-2xl font-black text-white">
              {NATIONAL_INITIATIVE_META.initiativeTitleAr}
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm font-bold text-emerald-200/95">
              {NATIONAL_INITIATIVE_META.mottoAr}
            </p>
          </div>
        </div>

        <div
          className="flex flex-col items-center sm:items-end text-center sm:text-left border-t sm:border-t-0 border-emerald-800/80 pt-3 sm:pt-0 w-full sm:w-auto"
          dir="ltr"
        >
          <span className="text-[10px] font-black tracking-[0.2em] text-amber-300 uppercase">
            JOURNEY OF GLORY
          </span>
          <span className="mt-0.5 text-xs font-bold text-emerald-100">
            5 Interactive Stations
          </span>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1 text-[11px] font-black text-amber-200 backdrop-blur-xs border border-white/15">
            <Award className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            <span>Homeland Ambassador</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NationalJourneyPage() {
  const [phase, setPhase] = useState<FlowPhase>('welcome');
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState<string>(
    GRADE_OPTIONS[0] ?? 'الصف الأول المتوسط',
  );
  const [verificationCode] = useState(
    () => 'SPARK-KSA-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
  );

  // Audio player state
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stage 1-4 quiz state
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<'A' | 'B' | 'C' | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState(false);
  const [retryNotice, setRetryNotice] = useState(false);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);

  // Stage 5 (The Final Chapter) state
  const [dreamText, setDreamText] = useState('');
  const [promiseText, setPromiseText] = useState('');
  const [prideText, setPrideText] = useState('');
  const [submittingPledge, setSubmittingPledge] = useState(false);
  const [pledgeError, setPledgeError] = useState<string | null>(null);

  // Voices of Saudi Pride Digital Wall state
  const [voices, setVoices] = useState<GuestbookEntry[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const isTeacherAdmin = isTeacherLoggedIn();

  const currentStage = NATIONAL_JOURNEY_STAGES[currentStageIdx] ?? NATIONAL_JOURNEY_STAGES[0]!;
  const currentQuestion =
    currentStage.questions[currentQuestionIdx] ?? currentStage.questions[0]!;

  // Smooth scroll to top on mobile when phase, stage, or question changes
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [phase, currentStageIdx, currentQuestionIdx]);

  // Load Voices of Saudi Pride wall entries
  const loadVoicesWall = async () => {
    setLoadingVoices(true);
    try {
      const allEntries = await guestbookClient.getAllEntriesAcrossPlatform();
      const nationalEntries = allEntries.filter(
        (e) => e.topicSlug === NATIONAL_INITIATIVE_META.slug,
      );

      let localEntries: GuestbookEntry[] = [];
      try {
        const raw = localStorage.getItem(LOCAL_VOICES_STORAGE_KEY);
        if (raw) {
          localEntries = JSON.parse(raw) as GuestbookEntry[];
        }
      } catch {
        // ignore storage errors
      }

      const mergedMap = new Map<string, GuestbookEntry>();
      for (const item of [...nationalEntries, ...localEntries]) {
        mergedMap.set(item.id, item);
      }

      const sorted = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setVoices(sorted);
    } catch {
      try {
        const raw = localStorage.getItem(LOCAL_VOICES_STORAGE_KEY);
        if (raw) setVoices(JSON.parse(raw) as GuestbookEntry[]);
      } catch {
        // ignore
      }
    } finally {
      setLoadingVoices(false);
    }
  };

  useEffect(() => {
    setLikedIds(new Set(getLikedEntries()));
    void loadVoicesWall();
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }
      } catch {
        // ignore media element errors
      }
    };
  }, []);

  function startNationalAudio() {
    if (!audioMuted) {
      playNationalSound('start');
    }
    try {
      if (!audioRef.current) {
        const audio = new Audio(NATIONAL_INITIATIVE_META.audioTrackUrl);
        audio.loop = true;
        audio.volume = 0.25;
        audioRef.current = audio;
      }
      if (!audioMuted && audioRef.current) {
        try {
          const promise = audioRef.current.play();
          if (promise !== undefined && typeof promise.then === 'function') {
            promise
              .then(() => setAudioPlaying(true))
              .catch(() => setAudioPlaying(false));
          } else {
            setAudioPlaying(true);
          }
        } catch {
          setAudioPlaying(false);
        }
      }
    } catch {
      // ignore
    }
  }

  function toggleAudioMute() {
    const nextMuted = !audioMuted;
    setAudioMuted(nextMuted);
    if (!nextMuted) {
      playNationalSound('correct');
    }
    if (audioRef.current) {
      try {
        if (nextMuted) {
          audioRef.current.pause();
          setAudioPlaying(false);
        } else {
          const promise = audioRef.current.play();
          if (promise !== undefined && typeof promise.then === 'function') {
            promise
              .then(() => setAudioPlaying(true))
              .catch(() => setAudioPlaying(false));
          } else {
            setAudioPlaying(true);
          }
        }
      } catch {
        setAudioPlaying(false);
      }
    }
  }

  function handleStartJourney() {
    if (studentName.trim().length < 2) return;
    startNationalAudio();
    setCurrentStageIdx(0);
    setCurrentQuestionIdx(0);
    setSelectedOptionId(null);
    setAnsweredCorrectly(false);
    setRetryNotice(false);
    setEarnedBadges([]);
    setPhase('journey-quiz');
  }

  function handleSelectOption(optId: 'A' | 'B' | 'C', isCorrect: boolean) {
    if (answeredCorrectly) return;
    setSelectedOptionId(optId);

    if (isCorrect) {
      setAnsweredCorrectly(true);
      setRetryNotice(false);
      if (!audioMuted) playNationalSound('correct');
    } else {
      setRetryNotice(true);
      if (!audioMuted) playNationalSound('retry');
    }
  }

  function handleNextQuestion() {
    if (!answeredCorrectly) return;

    if (currentQuestionIdx + 1 < currentStage.questions.length) {
      setCurrentQuestionIdx((prev) => prev + 1);
      setSelectedOptionId(null);
      setAnsweredCorrectly(false);
      setRetryNotice(false);
    } else {
      if (!earnedBadges.includes(currentStage.id)) {
        setEarnedBadges((prev) => [...prev, currentStage.id]);
      }
      if (!audioMuted) playNationalSound('badge');
      setPhase('stage-celebration');
    }
  }

  function handleContinueToNextStage() {
    if (currentStageIdx + 1 < NATIONAL_JOURNEY_STAGES.length) {
      setCurrentStageIdx((prev) => prev + 1);
      setCurrentQuestionIdx(0);
      setSelectedOptionId(null);
      setAnsweredCorrectly(false);
      setRetryNotice(false);
      setPhase('journey-quiz');
    } else {
      setPhase('final-chapter');
    }
  }

  async function handleCompleteFinalChapter(e: React.FormEvent) {
    e.preventDefault();
    setPledgeError(null);

    if (
      dreamText.trim().length < 5 ||
      promiseText.trim().length < 5 ||
      prideText.trim().length < 5
    ) {
      setPledgeError(
        'فضلاً أكملي المحاور الثلاثة (حلمك، وعهدك، ورسالة الفخر) أو اضغطي على إحدى العبارات الملهمة بالأسفل للإدراج التلقائي.',
      );
      return;
    }

    setSubmittingPledge(true);
    try {
      const formattedMessage = encodeVoiceMessage(dreamText, promiseText, prideText);

      let createdEntry: GuestbookEntry;
      try {
        createdEntry = await guestbookClient.addEntry({
          name: studentName.trim(),
          role: `${studentGrade} · سفيرة الوطن 🇸🇦`,
          message: formattedMessage,
          topicSlug: NATIONAL_INITIATIVE_META.slug,
        });
      } catch {
        createdEntry = {
          id: `voice-${Date.now()}`,
          name: studentName.trim(),
          role: `${studentGrade} · سفيرة الوطن 🇸🇦`,
          message: formattedMessage,
          createdAt: new Date().toISOString(),
          likes: 1,
          topicSlug: NATIONAL_INITIATIVE_META.slug,
        };
      }

      try {
        const raw = localStorage.getItem(LOCAL_VOICES_STORAGE_KEY);
        const existing: GuestbookEntry[] = raw ? (JSON.parse(raw) as GuestbookEntry[]) : [];
        const updated = [createdEntry, ...existing];
        localStorage.setItem(LOCAL_VOICES_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }

      setVoices((prev) => [createdEntry, ...prev]);

      void studentResultsClient.recordResult({
        studentName: studentName.trim(),
        studentGrade,
        category: 'competition',
        activityTitle: 'مبادرة في القلب وطن وقيادة (سفيرة الوطن)',
        score: 5,
        totalQuestions: 5,
        verificationCode,
      });

      if (!audioMuted) playNationalSound('coronation');
      setPhase('coronation');
    } finally {
      setSubmittingPledge(false);
    }
  }

  async function handleToggleLikeVoice(id: string, currentLikes: number) {
    const isLiked = likedIds.has(id);
    const optimistic = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    setLikedIds((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(id);
      else next.add(id);
      return next;
    });

    setVoices((prev) =>
      prev.map((item) => (item.id === id ? { ...item, likes: optimistic } : item)),
    );

    try {
      const res = await guestbookClient.toggleLike(id, currentLikes);
      setVoices((prev) =>
        prev.map((item) => (item.id === id ? { ...item, likes: res.newLikes } : item)),
      );
    } catch {
      // keep optimistic state
    }
  }

  async function handleDeleteVoice(id: string) {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذه المشاركة من جدار الوطن؟')) return;
    await guestbookClient.deleteEntry(id, undefined, NATIONAL_INITIATIVE_META.slug);
    try {
      const raw = localStorage.getItem(LOCAL_VOICES_STORAGE_KEY);
      if (raw) {
        const list = (JSON.parse(raw) as GuestbookEntry[]).filter((i) => i.id !== id);
        localStorage.setItem(LOCAL_VOICES_STORAGE_KEY, JSON.stringify(list));
      }
    } catch {
      // ignore
    }
    setVoices((prev) => prev.filter((item) => item.id !== id));
  }

  function handleResetJourney() {
    setPhase('welcome');
    setCurrentStageIdx(0);
    setCurrentQuestionIdx(0);
    setSelectedOptionId(null);
    setAnsweredCorrectly(false);
    setRetryNotice(false);
  }

  const totalProgressPercent = useMemo(() => {
    if (phase === 'welcome' || phase === 'voices-wall') return 0;
    if (phase === 'coronation') return 100;
    if (phase === 'final-chapter') return 85;
    const completedQuestions =
      currentStageIdx * 5 + currentQuestionIdx + (answeredCorrectly ? 1 : 0);
    return Math.min(80, Math.round((completedQuestions / 20) * 80));
  }, [phase, currentStageIdx, currentQuestionIdx, answeredCorrectly]);

  const whatsappShareUrl = useMemo(() => {
    const shareText = [
      `🇸🇦 فخورة بحصولي على شهادة «سفيرة الوطن | Saudi Homeland Ambassador» في مبادرة (${NATIONAL_INITIATIVE_META.initiativeTitleAr}) عبر منصة English Spark!`,
      `الطالبة: ${studentName} (${studentGrade})`,
      `رمز التوثيق: ${verificationCode}`,
      typeof window !== 'undefined' ? window.location.href : '',
    ]
      .filter(Boolean)
      .join('\n');
    return `https://wa.me/?${new URLSearchParams({ text: shareText }).toString()}`;
  }, [studentName, studentGrade, verificationCode]);

  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-x-clip bg-gradient-to-b from-emerald-50/40 via-slate-50 to-amber-50/30 print:bg-white"
      dir="rtl"
    >
      <div className="print:hidden">
        <PublicBackdrop />
        <PortalNav />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-3.5 sm:px-6 pb-20 pt-5 sm:pt-10 print:max-w-none print:p-0">
        {/* Top Bar: Breadcrumb & National Audio Control (Mobile Optimized) */}
        <div className="mb-4 sm:mb-5 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Link className="hover:text-emerald-800 transition py-1" to="/">
              الرئيسية
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="font-black text-emerald-800 truncate max-w-[180px] sm:max-w-none">
              🇸🇦 {NATIONAL_INITIATIVE_META.initiativeTitleAr}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setPhase(phase === 'voices-wall' ? 'welcome' : 'voices-wall')}
              className="flex-1 sm:flex-initial inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-900 shadow-2xs transition hover:bg-emerald-50 active:scale-95"
            >
              <MessageSquareHeart className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>
                {phase === 'voices-wall'
                  ? 'العودة إلى رحلة المجد'
                  : `جدار أصوات الوطن (${voices.length})`}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleAudioMute}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-2xs transition active:scale-95 ${
                !audioMuted
                  ? 'border-amber-300 bg-amber-50 text-amber-950'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
              title={audioMuted ? 'تشغيل الصوت الوطني' : 'كتم الصوت'}
            >
              {audioMuted ? (
                <>
                  <VolumeX className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="hidden sm:inline">الصوت مكتوم</span>
                </>
              ) : (
                <>
                  <Volume2
                    className={`h-4 w-4 shrink-0 text-amber-600 ${
                      audioPlaying ? 'animate-pulse' : ''
                    }`}
                  />
                  <span className="hidden sm:inline">المؤثرات الوطنية</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Journey Passport Progress Bar (Mobile-Friendly Stepper) */}
        {(phase === 'journey-quiz' ||
          phase === 'stage-celebration' ||
          phase === 'final-chapter') && (
          <div className="mb-5 rounded-2xl border border-emerald-200/80 bg-white/95 p-3.5 sm:p-4 shadow-xs backdrop-blur-md print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-900 px-2.5 py-1 text-[11px] font-black text-amber-300">
                  <span>🇸🇦 رحلة المجد</span>
                </span>
                <span className="text-xs font-bold text-slate-700 truncate">
                  السفيرة: <strong className="font-black text-emerald-950">{studentName}</strong>
                </span>
              </div>
              <span className="text-xs font-black text-emerald-800 shrink-0">
                {totalProgressPercent}%
              </span>
            </div>

            {/* Smooth Progress Line */}
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-l from-emerald-600 via-teal-600 to-amber-500 transition-all duration-300"
                style={{ width: `${Math.max(8, totalProgressPercent)}%` }}
              />
            </div>

            {/* 5 Stations Compact Responsive Stepper */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {NATIONAL_JOURNEY_STAGES.map((stg, idx) => {
                const isEarned = earnedBadges.includes(stg.id);
                const isCurrent =
                  (phase === 'journey-quiz' || phase === 'stage-celebration') &&
                  currentStageIdx === idx;
                return (
                  <div
                    key={stg.id}
                    className={`flex flex-col items-center justify-center rounded-xl border py-1.5 px-1 sm:p-2 text-center transition ${
                      isEarned
                        ? 'border-emerald-400 bg-emerald-50/90 text-emerald-900'
                        : isCurrent
                        ? 'border-amber-400 bg-amber-50/90 text-amber-950 ring-2 ring-amber-200'
                        : 'border-slate-200/70 bg-slate-50/60 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {isEarned ? (
                        <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <StageBadgeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" icon={stg.badgeIcon} />
                      )}
                      <span className="text-[10px] font-black sm:hidden">{stg.stageNumber}</span>
                    </div>
                    <span className="mt-1 hidden sm:block text-[11px] font-black truncate max-w-full">
                      {stg.badgeTitleAr}
                    </span>
                  </div>
                );
              })}

              {/* Station 5: The Final Chapter */}
              <div
                className={`flex flex-col items-center justify-center rounded-xl border py-1.5 px-1 sm:p-2 text-center transition ${
                  phase === 'final-chapter'
                    ? 'border-amber-400 bg-amber-50 text-amber-950 ring-2 ring-amber-300'
                    : 'border-slate-200/70 bg-slate-50/60 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 shrink-0" />
                  <span className="text-[10px] font-black sm:hidden">5</span>
                </div>
                <span className="mt-1 hidden sm:block text-[11px] font-black truncate max-w-full">
                  عهد المستقبل
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* PHASE 1: ROYAL WELCOME HUB (Mobile-First Order)                   */}
        {/* ================================================================= */}
        {phase === 'welcome' && (
          <div className="space-y-6 animate-page-enter">
            <div className="overflow-hidden rounded-3xl border border-emerald-200/90 bg-white/95 p-4 sm:p-10 shadow-md backdrop-blur-xl text-center">
              {/* National Artwork Banner */}
              <SaudiNationalBannerArtwork />

              <div className="mt-5 sm:mt-7 inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 px-3.5 py-1 text-xs font-black text-emerald-900">
                <Sparkles className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span dir="ltr">🇸🇦 JOURNEY OF GLORY · رحلة المجد</span>
              </div>

              <h1 className="mt-2.5 text-2xl sm:text-4xl font-black text-slate-950">
                {NATIONAL_INITIATIVE_META.initiativeTitleAr}
              </h1>
              <p
                className="mt-1 text-xs sm:text-sm font-black tracking-wide text-emerald-700"
                dir="ltr"
              >
                {NATIONAL_INITIATIVE_META.mottoEn}
              </p>
              <p className="mx-auto mt-2.5 max-w-2xl text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
                رحلة تفاعلية ممتعة في حب المملكة العربية السعودية؛ نستكشف فيها تاريخنا العريق،
                مدننا المقدسة، طبيعتنا الساحرة، وتراثنا الأصيل باللغة الإنجليزية، ونختتمها بكتابة
                رسالة خالدة للمستقبل والحصول على شهادة{' '}
                <strong className="text-emerald-900">
                  «سفيرة الوطن | Saudi Homeland Ambassador»
                </strong>
                .
              </p>

              {/* Student Identity Box Placed Prominently for Mobile Thumb Reach */}
              <div className="mx-auto mt-6 max-w-xl rounded-2xl border-2 border-emerald-200/90 bg-gradient-to-b from-emerald-50/60 to-white p-4 sm:p-6 text-right shadow-xs">
                <h2 className="text-xs sm:text-sm font-black text-emerald-950 mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>سجّلي اسمكِ لبدء الرحلة وإصدار شهادة سفيرة الوطن:</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="ambassador-name-input"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      اسم الطالبة الثلاثي <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="ambassador-name-input"
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="مثال: سارة بنت محمد العتيبي"
                      className="w-full min-h-12 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-200 transition"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ambassador-grade-select"
                      className="block text-xs font-bold text-slate-700 mb-1"
                    >
                      الصف الدراسي
                    </label>
                    <select
                      id="ambassador-grade-select"
                      value={studentGrade}
                      onChange={(e) => setStudentGrade(e.target.value)}
                      className="w-full min-h-12 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-200 transition"
                    >
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartJourney}
                  disabled={studentName.trim().length < 2}
                  className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 py-3.5 px-6 text-sm sm:text-base font-black text-white shadow-lg shadow-emerald-900/20 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-5 w-5 text-amber-300 shrink-0" />
                  <span>ابدئي رحلة المجد الآن | Start the Journey 🇸🇦</span>
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                </button>
              </div>

              {/* 5 Stations Preview Grid (Compact 2-col on Mobile, 5-col on Desktop) */}
              <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 text-right">
                {NATIONAL_JOURNEY_STAGES.map((stg) => (
                  <div
                    key={stg.id}
                    className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/50 to-white p-3 sm:p-3.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-amber-300 shadow-xs">
                        <StageBadgeIcon className="h-4 w-4" icon={stg.badgeIcon} />
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-900">
                        المرحلة {stg.stageNumber}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xs font-black text-slate-900">{stg.badgeTitleAr}</h3>
                    <p className="text-[10px] sm:text-[11px] font-bold text-emerald-700" dir="ltr">
                      {stg.badgeTitleEn}
                    </p>
                  </div>
                ))}

                <div className="col-span-2 sm:col-span-3 lg:col-span-1 rounded-2xl border-2 border-amber-300/80 bg-gradient-to-b from-amber-50/80 to-white p-3 sm:p-3.5 shadow-xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-xs">
                      <Crown className="h-4 w-4" />
                    </span>
                    <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-black text-amber-950">
                      المحطة الختامية
                    </span>
                  </div>
                  <h3 className="mt-2 text-xs font-black text-slate-900">عهدٌ يرويه المستقبل</h3>
                  <p className="text-[10px] sm:text-[11px] font-bold text-amber-800" dir="ltr">
                    My Promise, My Future
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* PHASE 2: INTERACTIVE STAGES 1–4 (MASTERY LEARNING)                */}
        {/* ================================================================= */}
        {phase === 'journey-quiz' && (
          <div className="rounded-3xl border border-emerald-200/90 bg-white/95 p-4 sm:p-9 shadow-sm backdrop-blur-xl animate-page-enter">
            {/* Stage Header */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3.5">
              <div>
                <span
                  className="text-[11px] sm:text-xs font-black tracking-wider text-emerald-700 uppercase block"
                  dir="ltr"
                >
                  {currentStage.titleEn}
                </span>
                <h2 className="mt-0.5 text-base sm:text-2xl font-black text-slate-950">
                  {currentStage.titleAr}
                </h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {currentStage.subtitleAr}
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900 border border-emerald-200 shrink-0">
                السؤال {currentQuestionIdx + 1} من {currentStage.questions.length}
              </span>
            </div>

            {/* Question Prompt Card */}
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 via-white to-amber-50/30 p-4 sm:p-7 text-center">
              <span
                className="inline-block rounded-full bg-emerald-900/10 px-3 py-0.5 text-[11px] font-black text-emerald-900 mb-2"
                dir="ltr"
              >
                Choose the correct answer
              </span>
              <p
                className="text-base sm:text-2xl font-black leading-relaxed text-slate-950 select-text"
                dir="ltr"
              >
                Q{currentQuestionIdx + 1}. {currentQuestion.prompt}
              </p>
            </div>

            {/* 3 Options (Large Touch Targets on Mobile) */}
            <div className="mt-4 sm:mt-5 grid grid-cols-1 gap-2.5 sm:gap-3" dir="ltr">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedOptionId === opt.id;
                let styleClass =
                  'border-slate-200 bg-white text-slate-900 hover:border-emerald-400 hover:bg-emerald-50/30';

                if (answeredCorrectly && opt.isCorrect) {
                  styleClass =
                    'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-200';
                } else if (isSelected && !opt.isCorrect) {
                  styleClass = 'border-amber-400 bg-amber-50 text-amber-950';
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(opt.id, opt.isCorrect)}
                    disabled={answeredCorrectly}
                    className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3.5 sm:px-5 sm:py-4 text-left transition active:scale-[0.99] min-h-[56px] ${styleClass}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                          answeredCorrectly && opt.isCorrect
                            ? 'bg-emerald-600 text-white'
                            : isSelected && !opt.isCorrect
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {opt.id}
                      </span>
                      <span className="text-sm sm:text-lg font-black">{opt.text}</span>
                    </div>

                    {answeredCorrectly && opt.isCorrect && (
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Gentle Retry Prompt (No Game Over) */}
            {retryNotice && !answeredCorrectly && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 text-center animate-page-enter">
                <p className="text-xs sm:text-sm font-black text-amber-900">
                  اقتربتِ يا بطلة! فكّري مجدداً واختاري الإجابة الصحيحة لاكتشاف المعلومة الوطنية 🇸🇦
                </p>
              </div>
            )}

            {/* Rich Bilingual Fact Card upon Correct Answer */}
            {answeredCorrectly && (
              <div className="mt-4 sm:mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 sm:p-5 animate-page-enter">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-900 mb-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>أحسنتِ إجابة صحيحة! · إضاءة وطنية</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
                  {currentQuestion.factAr}
                </p>
                <p
                  className="mt-1.5 text-xs font-semibold text-emerald-800 leading-relaxed"
                  dir="ltr"
                >
                  {currentQuestion.factEn}
                </p>
              </div>
            )}

            {/* Next Question CTA (Full-Width Button on Mobile) */}
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:pt-5">
              <span className="text-xs font-bold text-slate-500 text-center sm:text-right">
                🏆 {currentStage.missionAr}
              </span>
              <button
                type="button"
                onClick={handleNextQuestion}
                disabled={!answeredCorrectly}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-7 py-3 text-sm font-black text-white shadow-md shadow-emerald-700/20 transition hover:bg-emerald-800 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>
                  {currentQuestionIdx + 1 === currentStage.questions.length
                    ? `استلام وسام ${currentStage.badgeTitleAr}`
                    : 'السؤال التالي'}
                </span>
                <ChevronLeft className="h-4 w-4 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* PHASE 3: STAGE BADGE CELEBRATION                                  */}
        {/* ================================================================= */}
        {phase === 'stage-celebration' && (
          <div className="rounded-3xl border-2 border-amber-300/80 bg-white p-6 sm:p-10 text-center shadow-lg animate-page-enter">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-emerald-700 text-white shadow-xl">
              <StageBadgeIcon className="h-10 w-10" icon={currentStage.badgeIcon} />
            </div>
            <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-black text-amber-900">
              <Award className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>تم استحقاق الوسام بنجاح!</span>
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-950">
              وسام «{currentStage.badgeTitleAr}»
            </h2>
            <p className="mt-1 text-sm font-black text-emerald-700" dir="ltr">
              {currentStage.badgeTitleEn} Badge Unlocked!
            </p>
            <p className="mx-auto mt-3 max-w-lg text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed">
              فخورون بكِ يا <strong className="text-slate-900">{studentName}</strong>! لقد أتممتِ{' '}
              {currentStage.titleAr} بنجاح وأُضيف هذا الوسام إلى جواز رحلتكِ الوطنية.
            </p>

            <div className="mt-7">
              <button
                type="button"
                onClick={handleContinueToNextStage}
                className="w-full sm:w-auto inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 px-8 py-4 text-sm sm:text-base font-black text-white shadow-lg shadow-emerald-700/25 transition hover:brightness-110 active:scale-95"
              >
                <span>
                  {currentStageIdx + 1 < NATIONAL_JOURNEY_STAGES.length
                    ? `الانطلاق إلى المرحلة ${currentStageIdx + 2}`
                    : 'الانتقال إلى المحطة الختامية: عهدٌ يرويه المستقبل 🇸🇦'}
                </span>
                <ArrowLeft className="h-4 w-4 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* PHASE 4: STAGE 5 — THE FINAL CHAPTER (MY PROMISE, MY FUTURE)      */}
        {/* ================================================================= */}
        {phase === 'final-chapter' && (
          <div className="space-y-6 animate-page-enter">
            {/* Inspirational Intro Card */}
            <div className="overflow-hidden rounded-3xl border border-amber-300/80 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-5 sm:p-10 text-white shadow-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 border border-amber-300/40 px-3.5 py-1 text-xs font-black text-amber-300">
                <Crown className="h-3.5 w-3.5 shrink-0" />
                <span dir="ltr">JOURNEY OF GLORY · THE FINAL CHAPTER</span>
              </div>

              <h1 className="mt-3 text-xl sm:text-4xl font-black text-white">
                عهدٌ يرويه المستقبل | <span dir="ltr">The Promise That Lives On</span>
              </h1>
              <p className="mt-1 text-xs sm:text-sm font-bold text-amber-200">
                {NATIONAL_INITIATIVE_META.mottoAr}
              </p>

              <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4 sm:p-5 backdrop-blur-xs space-y-3">
                <h2 className="text-sm sm:text-base font-black text-amber-300">
                  المحطة الأخيرة: لو سألني المستقبل عن وطني… |{' '}
                  <span dir="ltr">If the Future Asked Me About My Homeland…</span>
                </h2>
                <p className="text-xs sm:text-sm font-medium leading-relaxed text-emerald-50" dir="ltr">
                  You have discovered the story of your homeland, explored its treasures, and
                  expressed your pride in its leadership. Now, imagine that ten years from today,
                  someone asks you:{' '}
                  <strong className="text-amber-300">
                    “What did you do to make your homeland proud of you?”
                  </strong>
                </p>
                <p className="text-xs sm:text-sm font-semibold leading-relaxed text-emerald-100 border-t border-white/10 pt-3">
                  اكتشفتِ حكاية وطنك، وتعرّفتِ على كنوزه، وعبّرتِ عن اعتزازك بقيادته. والآن،
                  تخيّلي أن أحدهم سألك بعد عشر سنوات:{' '}
                  <strong className="text-amber-300">ماذا فعلتِ لتجعلي وطنك فخوراً بكِ؟</strong>
                </p>
              </div>
            </div>

            {/* Interactive 3-Part Reflection Form */}
            <form
              onSubmit={handleCompleteFinalChapter}
              className="rounded-3xl border border-emerald-200/90 bg-white/95 p-4 sm:p-9 shadow-sm space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <span className="text-xs font-black text-emerald-700" dir="ltr">
                  FINAL CHALLENGE · MY PROMISE, MY FUTURE
                </span>
                <h2 className="mt-1 text-lg sm:text-2xl font-black text-slate-950">
                  اكتبي رسالتكِ إلى مستقبلكِ (أو اضغطي على العبارات الملهمة بالأسفل)
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  ستُخلّد كلماتكِ في شهادتكِ الرسمية وفي جدار «أصواتٌ تحب الوطن | Voices of Saudi Pride».
                </p>
              </div>

              {FINAL_CHAPTER_PROMPTS.map((item) => {
                const value =
                  item.id === 'dream'
                    ? dreamText
                    : item.id === 'promise'
                    ? promiseText
                    : prideText;
                const setValue =
                  item.id === 'dream'
                    ? setDreamText
                    : item.id === 'promise'
                    ? setPromiseText
                    : setPrideText;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <span
                        className="inline-flex self-start items-center gap-1.5 rounded-lg bg-emerald-900 px-2.5 py-1 text-xs font-black text-amber-300"
                        dir="ltr"
                      >
                        {item.numberLabel} — {item.titleEn}
                      </span>
                      <span className="text-xs font-bold text-emerald-900 leading-relaxed">
                        {item.questionAr}
                      </span>
                    </div>

                    {/* text-base on mobile prevents iOS Safari zoom */}
                    <textarea
                      rows={2}
                      dir="ltr"
                      required
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={item.placeholderEn}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-base sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-200 transition"
                    />

                    {/* Mobile-Friendly Guided Inspiration Cards */}
                    <div className="space-y-2">
                      <span className="block text-[11px] font-bold text-slate-500">
                        ✨ عبارات ملهمة جاهزة (اضغطي على أي عبارة لإدراجها فوراً):
                      </span>
                      <div className="grid grid-cols-1 gap-2">
                        {item.suggestions.map((sug, sIdx) => {
                          const isChosen = value === sug.textEn;
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => setValue(sug.textEn)}
                              className={`w-full rounded-xl border p-3 text-right transition active:scale-[0.99] ${
                                isChosen
                                  ? 'border-emerald-600 bg-emerald-100/90 text-emerald-950 ring-2 ring-emerald-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-black text-emerald-800">
                                  {sug.labelAr}
                                </span>
                                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0">
                                  {isChosen ? 'تم الاختيار ✓' : 'اضغطي للإدراج'}
                                </span>
                              </div>
                              <p
                                className="mt-1 text-xs font-semibold text-slate-600 text-left leading-relaxed"
                                dir="ltr"
                              >
                                {sug.textEn}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {pledgeError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700">
                  {pledgeError}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingPledge}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 py-4 px-6 text-sm sm:text-base font-black text-white shadow-lg shadow-emerald-900/20 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              >
                <Feather className="h-5 w-5 text-amber-300 shrink-0" />
                <span>
                  {submittingPledge
                    ? 'جاري تخليد رسالتكِ وإصدار شهادة سفيرة الوطن...'
                    : 'خلّدي رسالتكِ واستلمي شهادة سفيرة الوطن 🇸🇦'}
                </span>
              </button>
            </form>
          </div>
        )}

        {/* ================================================================= */}
        {/* PHASE 5: CORONATION, IMMORTAL STATEMENT, CERTIFICATE & WALL       */}
        {/* ================================================================= */}
        {phase === 'coronation' && (
          <div className="space-y-8 sm:space-y-10 animate-page-enter">
            {/* Moment of Immortality Card (No Numeric Grades!) */}
            <div className="rounded-3xl border-2 border-amber-300/80 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 p-5 sm:p-10 text-center text-white shadow-xl print:hidden">
              <div className="mx-auto flex h-18 w-18 sm:h-20 sm:w-20 items-center justify-center rounded-3xl bg-amber-400/20 border-2 border-amber-300 text-amber-300 shadow-lg">
                <Crown className="h-9 w-9 sm:h-10 sm:w-10" />
              </div>

              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-4 py-1 text-xs font-black text-amber-200">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>لحظة الخلود · The Voices of Saudi Pride</span>
              </span>

              <h1 className="mt-3 text-xl sm:text-4xl font-black text-white" dir="ltr">
                {IMMORTAL_PLEDGE_STATEMENT.titleEn}
              </h1>
              <h2 className="mt-1 text-base sm:text-2xl font-black text-amber-300">
                {IMMORTAL_PLEDGE_STATEMENT.titleAr}
              </h2>

              <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-white/15 bg-white/10 p-4 sm:p-5 backdrop-blur-xs space-y-3">
                <p className="text-xs sm:text-base font-bold leading-relaxed text-white" dir="ltr">
                  “{IMMORTAL_PLEDGE_STATEMENT.bodyEn}”
                </p>
                <p className="text-xs sm:text-sm font-semibold leading-relaxed text-emerald-100 border-t border-white/10 pt-3">
                  «{IMMORTAL_PLEDGE_STATEMENT.bodyAr}»
                </p>
              </div>

              {/* Mobile-Friendly Action Buttons (Print PDF + WhatsApp Share + Restart) */}
              <div className="mt-6 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 py-3 text-xs sm:text-sm font-black text-slate-950 shadow-lg hover:bg-amber-300 transition"
                >
                  <Printer className="h-4 w-4 shrink-0" />
                  <span>طباعة / حفظ شهادة سفيرة الوطن (PDF)</span>
                </button>
                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 border border-emerald-400/40 px-6 py-3 text-xs sm:text-sm font-black text-white shadow-md hover:bg-emerald-500 transition"
                >
                  <Share2 className="h-4 w-4 shrink-0" />
                  <span>مشاركة الفخر عبر واتساب</span>
                </a>
                <button
                  type="button"
                  onClick={handleResetJourney}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-xs sm:text-sm font-bold text-white hover:bg-white/20 transition"
                >
                  <RotateCcw className="h-4 w-4 shrink-0" />
                  <span>إعادة الرحلة</span>
                </button>
              </div>
            </div>

            {/* ============================================================= */}
            {/* OFFICIAL ROYAL CERTIFICATE: SAUDI HOMELAND AMBASSADOR         */}
            {/* ============================================================= */}
            <div
              id="homeland-ambassador-certificate"
              className="relative overflow-hidden rounded-3xl border-4 sm:border-8 border-double border-emerald-950 bg-gradient-to-b from-[#fdfcf7] via-white to-[#f4faf6] p-4 sm:p-12 shadow-2xl text-center ring-2 ring-amber-400/60 print:border-4 print:p-6 print:shadow-none print:m-0"
            >
              {/* Corner Royal Gold Flourishes */}
              <div className="absolute top-2.5 right-2.5 h-6 w-6 sm:h-8 sm:w-8 rounded-tr-md border-t-2 border-r-2 border-amber-500 pointer-events-none" />
              <div className="absolute top-2.5 left-2.5 h-6 w-6 sm:h-8 sm:w-8 rounded-tl-md border-t-2 border-l-2 border-amber-500 pointer-events-none" />
              <div className="absolute bottom-2.5 right-2.5 h-6 w-6 sm:h-8 sm:w-8 rounded-br-md border-b-2 border-r-2 border-amber-500 pointer-events-none" />
              <div className="absolute bottom-2.5 left-2.5 h-6 w-6 sm:h-8 sm:w-8 rounded-bl-md border-b-2 border-l-2 border-amber-500 pointer-events-none" />

              {/* Top Institutional Header */}
              <div className="relative z-10 flex flex-wrap items-start justify-between border-b border-emerald-200/80 pb-4 mb-5 gap-3 text-right">
                <div>
                  <span className="block text-[10px] sm:text-[11px] font-black tracking-wider text-emerald-950">
                    المملكة العربية السعودية · وزارة التعليم
                  </span>
                  <span className="block text-[10px] font-bold text-slate-600">
                    {NATIONAL_INITIATIVE_META.initiativeTitleAr}
                  </span>
                  <span className="block text-[10px] font-black text-emerald-700">
                    منصة English Spark التعليمية
                  </span>
                </div>

                <div className="mx-auto hidden md:flex flex-col items-center justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-md ring-2 ring-amber-400/70 overflow-hidden bg-emerald-950">
                    <EnglishSparkLogo className="h-14 w-14" isDark={true} variant="icon" />
                  </div>
                </div>

                <div className="text-left" dir="ltr">
                  <span className="inline-block rounded-full bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-black text-emerald-900">
                    Journey of Glory · رحلة المجد
                  </span>
                  <span className="block text-[10px] font-mono font-bold text-slate-500 mt-1">
                    ID: {verificationCode}
                  </span>
                </div>
              </div>

              {/* Certificate Main Title */}
              <div className="relative z-10 mb-5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-300 px-3.5 py-1 text-[11px] sm:text-xs font-black text-amber-950 mb-2">
                  <Crown className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span>SAUDI HOMELAND AMBASSADOR · وسام سفيرة الوطن</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-emerald-950">
                  شهادة {IMMORTAL_PLEDGE_STATEMENT.certificateTitleAr}
                </h2>
                <p
                  className="text-[11px] sm:text-sm font-black tracking-widest text-amber-700 uppercase mt-1"
                  dir="ltr"
                >
                  {IMMORTAL_PLEDGE_STATEMENT.certificateTitleEn} Certificate
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <div className="h-0.5 w-14 sm:w-16 bg-gradient-to-r from-transparent to-amber-500" />
                  <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
                  <div className="h-0.5 w-14 sm:w-16 bg-gradient-to-l from-transparent to-amber-500" />
                </div>
              </div>

              {/* Student Name & Citation */}
              <div className="relative z-10 my-4 sm:my-5 max-w-2xl mx-auto">
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  تمنح منصة English Spark هذه الشهادة الفخرية للطالبة المتميزة:
                </p>
                <h3 className="text-2xl sm:text-5xl font-black text-emerald-950 my-3 break-words">
                  {studentName}
                </h3>
                <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1 text-xs font-bold text-emerald-900">
                  {studentGrade}
                </span>

                <p className="mt-4 text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
                  {IMMORTAL_PLEDGE_STATEMENT.certificateReasonAr}
                </p>
                <p
                  className="mt-1 text-[11px] sm:text-xs font-semibold text-emerald-800 leading-relaxed"
                  dir="ltr"
                >
                  {IMMORTAL_PLEDGE_STATEMENT.certificateReasonEn}
                </p>
              </div>

              {/* 4 Earned National Badges Row */}
              <div className="relative z-10 my-5 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl mx-auto">
                {NATIONAL_JOURNEY_STAGES.map((stg) => (
                  <div
                    key={stg.id}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-center"
                  >
                    <span className="block text-xs font-black text-emerald-950">
                      ✓ {stg.badgeTitleAr}
                    </span>
                    <span className="block text-[10px] font-bold text-emerald-700" dir="ltr">
                      {stg.badgeTitleEn}
                    </span>
                  </div>
                ))}
              </div>

              {/* Student's Personal Immortal Pledge Box */}
              <div
                className="relative z-10 my-5 max-w-3xl mx-auto rounded-2xl border border-amber-300/80 bg-amber-50/40 p-3.5 sm:p-5 text-left space-y-2"
                dir="ltr"
              >
                <div className="text-center mb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                    My Promise, My Future · عهدي لمستقبل وطني
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800 leading-relaxed">
                  <strong className="text-emerald-900">01. My Dream:</strong> {dreamText}
                </p>
                <p className="text-xs font-bold text-slate-800 leading-relaxed">
                  <strong className="text-emerald-900">02. My Promise:</strong> {promiseText}
                </p>
                <p className="text-xs font-bold text-slate-800 leading-relaxed">
                  <strong className="text-emerald-900">03. Message of Pride:</strong> {prideText}
                </p>
              </div>

              {/* Signatures & Gold Seal Footer */}
              <div className="relative z-10 mt-6 pt-5 border-t border-emerald-200/80 grid grid-cols-1 sm:grid-cols-3 items-center gap-4 sm:gap-5">
                <div className="text-center sm:text-right">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">
                    إشراف معلمة اللغة الإنجليزية
                  </span>
                  <span className="block text-xs sm:text-sm font-black text-emerald-950 mt-1">
                    {TEACHER_OFFICIAL_NAME}
                  </span>
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span>مبادرة في القلب وطن وقيادة</span>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 p-1 shadow-lg ring-4 ring-amber-400/30">
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-emerald-950 p-1 text-white border-2 border-dashed border-amber-200 text-center">
                      <Crown className="h-3.5 w-3.5 text-amber-300" />
                      <span className="text-[8px] font-black text-amber-200">سفيرة الوطن</span>
                      <span className="text-[7px] font-bold text-emerald-200">HOMELAND</span>
                      <span className="text-[7px] font-bold text-amber-300">AMBASSADOR</span>
                    </div>
                  </div>
                </div>

                <div className="text-center sm:text-left" dir="ltr">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">
                    Issued Date & Verification
                  </span>
                  <span className="block text-xs font-black text-emerald-950 mt-1">
                    {new Date().toLocaleDateString('ar-SA')}
                  </span>
                  <span className="block text-[10px] font-mono font-bold text-slate-500 mt-1">
                    {verificationCode}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* DIGITAL WALL: VOICES OF SAUDI PRIDE (أصوات تحب الوطن)              */}
        {/* ================================================================= */}
        {(phase === 'voices-wall' || phase === 'coronation') && (
          <section className="mt-8 sm:mt-10 space-y-5 print:hidden animate-page-enter">
            <div className="rounded-3xl border border-emerald-200/90 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 p-5 sm:p-8 text-white shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-black text-amber-300">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span dir="ltr">VOICES OF SAUDI PRIDE</span>
                  </span>
                  <h2 className="mt-2 text-xl sm:text-3xl font-black text-white">
                    جدار «أصواتٌ تحب الوطن | Voices of Saudi Pride» 🇸🇦
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm font-semibold text-emerald-100">
                    كلمات وأحلام وعُهود طالباتنا سفيرات الوطن لمستقبل المملكة العربية السعودية.
                  </p>
                </div>

                {phase === 'voices-wall' && (
                  <button
                    type="button"
                    onClick={() => setPhase('welcome')}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-xs sm:text-sm font-black text-slate-950 shadow-md hover:bg-amber-300 transition shrink-0"
                  >
                    <Send className="h-4 w-4 rotate-180 shrink-0" />
                    <span>شاركي في الرحلة وأضيفي صوتكِ</span>
                  </button>
                )}
              </div>
            </div>

            {loadingVoices ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-xs font-bold text-slate-500">
                جاري تحميل أصوات سفيرات الوطن...
              </div>
            ) : voices.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
                <p className="text-sm font-bold text-slate-600">
                  كوني أول سفيرة وطن تخلّد حلمها ورسالتها على هذا الجدار الوطني!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {voices.map((entry) => {
                  const parsed = parseVoiceMessage(entry.message);
                  const isLiked = likedIds.has(entry.id);
                  return (
                    <article
                      key={entry.id}
                      className="flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-emerald-200/80 bg-white p-4 sm:p-5 shadow-xs transition hover:border-emerald-400 hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-900 text-amber-300 font-black text-sm">
                              {entry.name.slice(0, 1)}
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-slate-950">{entry.name}</h3>
                              <span className="text-[11px] font-bold text-emerald-700">
                                {entry.role}
                              </span>
                            </div>
                          </div>

                          {isTeacherAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteVoice(entry.id)}
                              className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                              title="حذف المشاركة"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {parsed.dream || parsed.promise || parsed.pride ? (
                          <div className="mt-3.5 space-y-2 text-left" dir="ltr">
                            {parsed.dream && (
                              <div className="rounded-xl bg-emerald-50/60 p-2.5 border border-emerald-100">
                                <span className="block text-[10px] font-black text-emerald-800 uppercase">
                                  🌟 My Dream for Saudi Arabia
                                </span>
                                <p className="text-xs font-bold text-slate-800 mt-0.5 leading-relaxed">
                                  {parsed.dream}
                                </p>
                              </div>
                            )}
                            {parsed.promise && (
                              <div className="rounded-xl bg-amber-50/60 p-2.5 border border-amber-100">
                                <span className="block text-[10px] font-black text-amber-900 uppercase">
                                  🤝 My Promise in Action
                                </span>
                                <p className="text-xs font-bold text-slate-800 mt-0.5 leading-relaxed">
                                  {parsed.promise}
                                </p>
                              </div>
                            )}
                            {parsed.pride && (
                              <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200/70">
                                <span className="block text-[10px] font-black text-slate-700 uppercase">
                                  🇸🇦 A Message of Pride
                                </span>
                                <p className="text-xs font-bold text-slate-800 mt-0.5 leading-relaxed">
                                  {parsed.pride}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p
                            className="mt-3 text-xs sm:text-sm font-semibold text-slate-700 whitespace-pre-line"
                            dir="auto"
                          >
                            {entry.message}
                          </p>
                        )}

                        {entry.teacherReply && (
                          <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
                            <span className="block text-[11px] font-black text-emerald-900">
                              ✨ إشادة المعلمة ({TEACHER_OFFICIAL_NAME}):
                            </span>
                            <p className="mt-1 text-xs font-bold text-slate-800">
                              {entry.teacherReply}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800">
                          <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>سفيرة الوطن · Saudi Homeland Ambassador</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleLikeVoice(entry.id, entry.likes)}
                          className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold transition active:scale-95 ${
                            isLiked
                              ? 'border-rose-300 bg-rose-50 text-rose-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-rose-50'
                          }`}
                        >
                          <Heart
                            className={`h-3.5 w-3.5 ${
                              isLiked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'
                            }`}
                          />
                          <span>{entry.likes}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      <div className="print:hidden">
        <PortalFooter />
      </div>
    </div>
  );
}
