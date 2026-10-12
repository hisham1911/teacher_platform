import { ExternalLink, Mic, Sparkles } from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';

interface SpeakingLink {
  titleAr: string;
  titleEn: string;
  description: string;
  url: string;
}

const speakingLinks: SpeakingLink[] = [
  {
    titleAr: 'تقديم نفسك',
    titleEn: 'Introducing Yourself',
    description: 'تدرب على تقديم نفسك بالإنجليزية مع محادثات تفاعلية تحاكي مواقف حقيقية.',
    url: 'https://engnovate.com/ai-conversations/introducing-yourself',
  },
  {
    titleAr: 'وصف روتينك اليومي',
    titleEn: 'Describing Your Daily Routine',
    description: 'تعلم كيف تتحدث بطلاقة عن يومك وروتينك المعتاد من الصباح حتى المساء.',
    url: 'https://engnovate.com/ai-conversations/describing-your-daily-routine',
  },
  {
    titleAr: 'تمارين مخارج الحروف والنطق',
    titleEn: 'Pronunciation & IPA Chart',
    description: 'حسّن مخارج الحروف ونطق الكلمات الإنجليزية الصعبة مع مخطط الأصوات الصوتي.',
    url: 'https://engnovate.com/pronunciation-exercises',
  },
];

export default function SpeakingIndexPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        {/* Header Hero */}
        <section className="animate-page-enter text-center max-w-2xl mx-auto">
          <div className="mx-auto mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
            <Mic className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-3.5 py-1 text-xs font-black text-amber-800 mb-2">
            <Sparkles className="h-3 w-3 text-amber-600" />
            أنشطة التحدث والنطق التفاعلية
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-950">
            المحادثة والنطق <span className="text-amber-600">Speaking</span>
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed">
            أنشطة تفاعلية لتطوير الطلاقة ومخارج الحروف الإنجليزية بدقة مع أدوات التدريب الصوتي
          </p>
        </section>

        {/* Cards Grid */}
        <section
          className="animate-page-enter mx-auto mt-8 sm:mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          style={{ animationDelay: '100ms' }}
        >
          {speakingLinks.map((item) => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-200/90 bg-gradient-to-br from-white via-white/95 to-amber-50/40 p-5 sm:p-6 shadow-xs backdrop-blur-xl ring-1 ring-slate-900/5 transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-300 hover:ring-2 hover:ring-amber-400/20 hover:shadow-xl hover:shadow-amber-900/10 active:translate-y-0"
            >
              {/* Luminous Specular Top Highlight */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
              />

              {/* Ambient Interior Corner Glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-gradient-to-br from-amber-500/15 via-orange-500/5 to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity"
              />

              {/* Subtle Decorative Background Watermark Icon */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-3 -left-3 text-slate-900/[0.035] group-hover:text-amber-900/5 transition-all duration-500 scale-100 group-hover:scale-110"
              >
                <Mic className="h-24 w-24" />
              </div>

              <div className="relative z-10">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-slate-900/10 transition-transform duration-300 group-hover:scale-105">
                    <Mic className="h-5 w-5" />
                  </div>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 border border-slate-200/60 shadow-2xs transition-colors group-hover:bg-amber-100 group-hover:text-amber-700">
                    <ExternalLink className="h-4 w-4" />
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-black text-slate-950 group-hover:text-amber-950 transition-colors">
                  {item.titleAr}
                </h2>
                <p className="mt-0.5 text-xs font-bold tracking-wider text-amber-700" dir="ltr">
                  {item.titleEn}
                </p>

                <p className="mt-3 text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
                  {item.description}
                </p>
              </div>

              <div className="relative z-10 mt-6 border-t border-slate-200/60 pt-4">
                <span className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-amber-500/20 transition-all group-hover:from-amber-600 group-hover:to-orange-600">
                  <span>بدء التدريب في نافذة جديدة</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </div>
            </a>
          ))}
        </section>
      </div>

      <PortalFooter />
    </div>
  );
}
