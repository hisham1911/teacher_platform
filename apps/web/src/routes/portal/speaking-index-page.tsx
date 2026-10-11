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
    description: 'تدرب على تقديم نفسك بالإنجليزية مع محادثات تفاعلية بالذكاء الاصطناعي تحاكي مواقف حقيقية.',
    url: 'https://engnovate.com/ai-conversations/introducing-yourself',
  },
  {
    titleAr: 'وصف روتينك اليومي',
    titleEn: 'Describing Your Daily Routine',
    description: 'تعلم كيف تتحدث بطلاقة عن يومك وروتينك المعتاد من الاستيقاظ وحتى النوم.',
    url: 'https://engnovate.com/ai-conversations/describing-your-daily-routine',
  },
  {
    titleAr: 'تمارين النطق',
    titleEn: 'Pronunciation Exercises',
    description: 'حسّن مخارج الحروف ونطقك للكلمات الإنجليزية الصعبة من خلال تمارين صوتية دقيقة.',
    url: 'https://engnovate.com/pronunciation-exercises',
  },
];

export default function SpeakingIndexPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <section className="animate-page-enter text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-2xl font-black text-white shadow-md">
            S
          </div>
          <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">
            المحادثة <span className="text-amber-600">Speaking</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-600">
            أدوات خارجية مقترحة للتدريب المباشر على النطق والمحادثة اليومية عبر الذكاء الاصطناعي
          </p>
        </section>

        <section
          className="animate-page-enter mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          style={{ animationDelay: '100ms' }}
        >
          {speakingLinks.map((item) => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-3xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-200 hover:shadow-xl hover:shadow-amber-900/5"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-xl text-amber-600">
                  🎙️
                </span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-xs font-bold text-slate-400 transition-colors group-hover:bg-amber-100 group-hover:text-amber-700">
                  ↗
                </span>
              </div>
              
              <h3 className="text-xl font-black text-slate-900">{item.titleAr}</h3>
              <p className="mt-1 text-xs font-black tracking-widest text-amber-600" dir="ltr">
                {item.titleEn.toUpperCase()}
              </p>
              
              <p className="mt-4 flex-1 text-sm font-semibold leading-7 text-slate-600">
                {item.description}
              </p>
              
              <div className="mt-8 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3.5 text-center text-sm font-black text-white shadow-md shadow-amber-500/20 transition-all duration-300 group-hover:from-amber-600 group-hover:to-orange-600">
                ابدأ التدريب في نافذة جديدة ↗
              </div>
            </a>
          ))}
        </section>
      </div>

      <PortalFooter />
    </div>
  );
}
