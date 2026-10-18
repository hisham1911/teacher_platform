import { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Award,
  Zap,
  Sparkles,
  RefreshCw,
  Medal,
} from 'lucide-react';
import {
  studentResultsClient,
  type StudentQuizResultRecord,
} from '../../data/api-client/guestbook-client';

export interface ChampionsLeaderboardProps {
  category?: 'million' | 'speed' | 'all';
  title?: string;
  subtitle?: string;
  showTabs?: boolean;
  limit?: number;
  variant?: 'light' | 'dark';
  className?: string;
}

export function ChampionsLeaderboard({
  category = 'all',
  title = 'لوحة شرف المتصدرين (Live Champions Leaderboard)',
  subtitle = 'أفضل 10 أبطال في تحديات اللغة الإنجليزية — تُعرض أعلى نتيجة محققة لكل متسابق لمنع التكرار',
  showTabs = true,
  limit = 10,
  variant = 'light',
  className = '',
}: ChampionsLeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'million' | 'speed'>(
    category === 'speed' ? 'speed' : 'million'
  );
  const [results, setResults] = useState<StudentQuizResultRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const isDark = variant === 'dark';

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const targetCategory = showTabs ? activeTab : category === 'all' ? activeTab : category;
      const data = await studentResultsClient.getLeaderboardByCategory(targetCategory);
      setResults(data.slice(0, limit));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, category, showTabs, limit]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const currentTab = showTabs ? activeTab : category === 'all' ? activeTab : category;

  return (
    <div
      className={`rounded-3xl border transition-all duration-300 ${
        isDark
          ? 'border-white/15 bg-slate-900/80 text-white shadow-2xl backdrop-blur-2xl'
          : 'border-slate-200/90 bg-white/90 text-slate-900 shadow-xl backdrop-blur-xl'
      } p-5 sm:p-7 ${className}`}
      dir="rtl"
    >
      {/* Header with Title and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4 mb-5 border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-md ${
              isDark
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-amber-500/20'
                : 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/30'
            }`}
          >
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black">{title}</h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                  isDark
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                Live
              </span>
            </div>
            {subtitle && (
              <p
                className={`mt-0.5 text-xs font-semibold ${
                  isDark ? 'text-sky-200/70' : 'text-slate-500'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={loadLeaderboard}
          disabled={loading}
          className={`self-end sm:self-auto inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
            isDark
              ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
          title="تحديث لوحة الشرف"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>
      </div>

      {/* Tabs if enabled */}
      {showTabs && (
        <div className="flex items-center gap-2 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('million')}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl py-2.5 px-3 text-xs sm:text-sm font-black transition cursor-pointer ${
              activeTab === 'million'
                ? isDark
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                : isDark
                ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Award className="h-4 w-4" />
            <span>أبطال تحدي المليون 🏆</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('speed')}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl py-2.5 px-3 text-xs sm:text-sm font-black transition cursor-pointer ${
              activeTab === 'speed'
                ? isDark
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/20'
                  : 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                : isDark
                ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>أبطال تحدي السرعة ⚡</span>
          </button>
        </div>
      )}

      {/* Leaderboard Entries */}
      {loading ? (
        <div className="py-12 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-amber-500" />
          <p className={`mt-3 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            جاري تحميل لوحة المتصدرين المحدثة...
          </p>
        </div>
      ) : results.length === 0 ? (
        <div
          className={`rounded-2xl border p-8 text-center ${
            isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <Trophy className="mx-auto h-10 w-10 text-amber-400 opacity-60 mb-2" />
          <p className="text-sm font-bold">لا توجد محاولات مسجلة في هذا التحدي بعد</p>
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            كن أول من يخوض التحدي ويتصدر لوحة الشرف! 🌟
          </span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {results.map((champion, idx) => {
            const rank = idx + 1;
            const isTop1 = rank === 1;
            const isTop2 = rank === 2;
            const isTop3 = rank === 3;
            const isPodium = isTop1 || isTop2 || isTop3;

            let rankBadgeClass = '';
            let medalEmoji = '';
            let rowBorderClass = '';

            if (isTop1) {
              medalEmoji = '🥇';
              rankBadgeClass = 'bg-amber-400 text-slate-950 ring-2 ring-amber-300';
              rowBorderClass = isDark
                ? 'border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-slate-900/60 to-transparent'
                : 'border-amber-300 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/40 shadow-xs';
            } else if (isTop2) {
              medalEmoji = '🥈';
              rankBadgeClass = 'bg-slate-300 text-slate-900 ring-2 ring-slate-200';
              rowBorderClass = isDark
                ? 'border-slate-400/30 bg-gradient-to-r from-slate-400/10 via-slate-900/60 to-transparent'
                : 'border-slate-300 bg-gradient-to-r from-slate-50 via-white to-slate-50/50';
            } else if (isTop3) {
              medalEmoji = '🥉';
              rankBadgeClass = 'bg-amber-700 text-amber-50 ring-2 ring-amber-600';
              rowBorderClass = isDark
                ? 'border-amber-600/30 bg-gradient-to-r from-amber-700/10 via-slate-900/60 to-transparent'
                : 'border-amber-200 bg-gradient-to-r from-amber-50/60 via-white to-amber-50/30';
            } else {
              rankBadgeClass = isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-700';
              rowBorderClass = isDark
                ? 'border-white/5 bg-white/5 hover:border-white/15'
                : 'border-slate-200/80 bg-white hover:border-slate-300';
            }

            return (
              <div
                key={champion.id || `${champion.studentName}-${idx}`}
                className={`flex items-center justify-between rounded-2xl border p-3 sm:p-4 transition-all duration-200 ${rowBorderClass}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank Badge / Medal */}
                  <div
                    className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl font-black text-xs sm:text-sm shadow-xs ${rankBadgeClass}`}
                  >
                    {isPodium ? (
                      <span className="text-base sm:text-lg">{medalEmoji}</span>
                    ) : (
                      <span>#{rank}</span>
                    )}
                  </div>

                  {/* Student Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-black truncate">
                        {champion.studentName}
                      </h4>
                      {isTop1 && (
                        <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-500 border border-amber-400/30">
                          بطل الصدارة 👑
                        </span>
                      )}
                      {champion.attemptsCount && champion.attemptsCount > 1 ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isDark
                              ? 'bg-violet-900/50 text-violet-300 border border-violet-700/50'
                              : 'bg-violet-50 text-violet-700 border border-violet-200'
                          }`}
                        >
                          {champion.attemptsCount} محاولات
                        </span>
                      ) : null}
                    </div>
                    <p
                      className={`text-[11px] font-semibold truncate ${
                        isDark ? 'text-sky-200/70' : 'text-slate-500'
                      }`}
                    >
                      {champion.studentGrade || 'المرحلة المتوسطة'}
                    </p>
                  </div>
                </div>

                {/* Score & Achievements */}
                <div className="shrink-0 text-left pr-2" dir="ltr">
                  <div className="flex items-center gap-1.5 justify-end">
                    {currentTab === 'million' ? (
                      <>
                        <span className="text-xs sm:text-sm font-black text-amber-500">
                          {champion.score === 15 ? '1,000,000' : `Lv.${champion.score}`}
                        </span>
                        <Award className="h-4 w-4 text-amber-500 shrink-0" />
                      </>
                    ) : (
                      <>
                        <span className="text-xs sm:text-sm font-black text-rose-500">
                          {champion.score} pts
                        </span>
                        <Zap className="h-4 w-4 text-rose-500 shrink-0" />
                      </>
                    )}
                  </div>
                  <span
                    className={`block text-[10px] font-bold ${
                      isDark ? 'text-slate-400' : 'text-slate-400'
                    }`}
                  >
                    {champion.percentage}% إتقان
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Motivational Bottom Footer */}
      <div
        className={`mt-4 pt-3.5 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-bold ${
          isDark
            ? 'border-white/10 text-slate-400'
            : 'border-slate-100 text-slate-500'
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <Medal className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span>يتم تحديث الترتيب فورياً مع حفظ أفضل رقم قياسي تحققه لكل مسابقة.</span>
        </span>
        <span className="text-amber-500">المنافسة مفتوحة للجميع ✦</span>
      </div>
    </div>
  );
}
