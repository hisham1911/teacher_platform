
export interface EnglishSparkLogoProps {
  /**
   * 'horizontal': Compact for navbars and headers (default)
   * 'full': Stacked lockup with airplane above, spark rays, and school pill
   * 'hero': Grand prominent lockup for hero banners or landing pages
   * 'icon': Standalone emblem (origami airplane + spark burst)
   */
  variant?: 'horizontal' | 'full' | 'hero' | 'icon';
  /**
   * Color theme:
   * 'authentic': Sage teal & slate navy directly from the teacher's lesson infographics
   * 'vibrant': High-contrast modern cyan & navy
   * 'auto': Automatically adapts based on isDark prop
   */
  colorTheme?: 'authentic' | 'vibrant' | 'auto';
  isDark?: boolean;
  showSubtitle?: boolean;
  subtitle?: string;
  className?: string;
}

/**
 * Authentic "English Spark" Brand Logo
 * Faithfully designed after the official infographics and materials
 * created for the English Language Club at Al-Jaradiyah Middle & High School.
 */
export function EnglishSparkLogo({
  variant = 'horizontal',
  colorTheme = 'auto',
  isDark = false,
  showSubtitle = true,
  subtitle = 'نادي اللغة الإنجليزية',
  className = '',
}: EnglishSparkLogoProps) {
  // Determine color palette
  const isVibrant = colorTheme === 'vibrant' || (colorTheme === 'auto' && !isDark);
  const englishColor = isDark ? '#ffffff' : '#0f172a';
  const sparkColor = isDark
    ? '#38bdf8'
    : isVibrant
    ? '#0284c7'
    : '#527d77';
  const leftRaysColor = isDark ? '#f8fafc' : '#1e293b';
  const rightRaysColor = sparkColor;
  const trailColor = isDark ? '#60a5fa' : '#93c5fd';

  // Subtitle styling
  const subtitleColor = isDark ? 'text-amber-300' : 'text-slate-500';

  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className || 'h-10 w-10'}`}
        aria-label="English Spark Logo Icon"
        role="img"
      >
        <rect
          width="96"
          height="96"
          rx="24"
          fill={isDark ? '#1e293b' : '#0f172a'}
        />
        {/* Spark Rays */}
        <g stroke="#38bdf8" strokeWidth="3" strokeLinecap="round">
          <line x1="22" y1="34" x2="14" y2="26" />
          <line x1="18" y1="46" x2="8" y2="46" />
          <line x1="74" y1="56" x2="84" y2="50" />
          <line x1="72" y1="68" x2="82" y2="74" />
        </g>
        {/* Origami Paper Airplane centered */}
        <g transform="translate(30, 26) scale(1.18) rotate(6)">
          <polygon points="42,4 4,18 22,30" fill="#38bdf8" />
          <polygon points="42,4 22,30 36,40" fill="#bae6fd" />
          <polygon points="22,30 36,40 26,38" fill="#0284c7" />
          <line
            x1="42"
            y1="4"
            x2="22"
            y2="30"
            stroke="#ffffff"
            strokeWidth="1.2"
            opacity="0.8"
          />
        </g>
      </svg>
    );
  }

  if (variant === 'full' || variant === 'hero') {
    const isHero = variant === 'hero';
    const svgWidth = isHero ? 480 : 420;
    const svgHeight = isHero ? 165 : 145;

    return (
      <div className={`inline-flex flex-col items-center text-center select-none ${className}`}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox="0 0 460 145"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ direction: 'ltr' }}
          className="max-w-full h-auto"
          aria-label="English Spark Official Logo"
          role="img"
        >
          {/* Flight Trail */}
          <path
            d="M 235 48 C 255 46, 272 40, 286 30 C 294 24, 302 21, 310 22"
            stroke={trailColor}
            strokeWidth="2.2"
            strokeDasharray="3.5 4.5"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* Origami Paper Airplane */}
          <g transform="translate(304, 2) rotate(16)">
            {/* Left Wing (Top facet) */}
            <polygon points="42,4 4,18 22,30" fill="#7dd3fc" />
            {/* Right Wing (Upper highlight facet) */}
            <polygon points="42,4 22,30 36,40" fill="#bae6fd" />
            {/* Keel / Underbody fold (Shadow facet) */}
            <polygon points="22,30 36,40 26,38" fill="#0284c7" />
            {/* Spine edge highlight */}
            <line
              x1="42"
              y1="4"
              x2="22"
              y2="30"
              stroke="#ffffff"
              strokeWidth="1.2"
              opacity="0.85"
            />
          </g>

          {/* Spark Rays (Left of 'English') */}
          <g stroke={leftRaysColor} strokeWidth="3.5" strokeLinecap="round">
            {/* Top ray: pointing up (~75°) */}
            <line x1="45" y1="62" x2="49" y2="48" />
            {/* Middle ray: pointing up-left (~135°) */}
            <line x1="40" y1="72" x2="24" y2="60" />
            {/* Bottom ray: pointing left (~185°) */}
            <line x1="38" y1="86" x2="22" y2="90" />
          </g>

          {/* Text Group */}
          <g
            fontFamily="'Poppins', 'Plus Jakarta Sans', system-ui, sans-serif"
            fontSize="44"
            fontWeight="800"
            letterSpacing="-0.5px"
          >
            <text x="62" y="96" fill={englishColor}>
              English
            </text>
            <text x="242" y="96" fill={sparkColor}>
              Spark
            </text>
          </g>

          {/* Spark Rays (Right of 'Spark') */}
          <g stroke={rightRaysColor} strokeWidth="3.2" strokeLinecap="round">
            <line x1="386" y1="72" x2="402" y2="64" />
            <line x1="386" y1="84" x2="402" y2="92" />
          </g>

          {/* Sparkle Star (Bottom right accent) */}
          <path
            d="M 395 102 Q 395 107 400 107 Q 395 107 395 112 Q 395 107 390 107 Q 395 107 395 102 Z"
            fill={sparkColor}
            opacity="0.85"
          />

          {/* Subtitle Badge Pill */}
          {showSubtitle && (
            <g transform="translate(85, 114)">
              <rect
                x="0"
                y="0"
                width="280"
                height="28"
                rx="14"
                fill={isDark ? 'rgba(255, 255, 255, 0.08)' : '#f8fafc'}
                stroke={isDark ? 'rgba(255, 255, 255, 0.16)' : '#e2e8f0'}
                strokeWidth="1.2"
              />
              <text
                x="140"
                y="19"
                fontFamily="'Cairo', sans-serif"
                fontSize="12"
                fontWeight="700"
                fill={isDark ? '#cbd5e1' : '#475569'}
                textAnchor="middle"
                direction="rtl"
              >
                {subtitle || 'مدرسة متوسطة وثانوية الجرادية'}
              </text>
            </g>
          )}
        </svg>
      </div>
    );
  }

  // Default: 'horizontal' (compact for navbars)
  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      dir="rtl"
    >
      <div className="flex flex-col items-start" dir="ltr">
        <svg
          width="215"
          height="46"
          viewBox="0 0 268 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ direction: 'ltr' }}
          className="h-9 sm:h-10 w-auto"
          aria-label="English Spark Logo"
          role="img"
        >
          {/* Flight Trail */}
          <path
            d="M 148 18 C 160 17, 172 14, 180 9"
            stroke={trailColor}
            strokeWidth="1.8"
            strokeDasharray="2.5 3"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Origami Airplane */}
          <g transform="translate(182, 0) rotate(16) scale(0.65)">
            <polygon points="42,4 4,18 22,30" fill="#38bdf8" />
            <polygon points="42,4 22,30 36,40" fill="#bae6fd" />
            <polygon points="22,30 36,40 26,38" fill="#0284c7" />
            <line
              x1="42"
              y1="4"
              x2="22"
              y2="30"
              stroke="#ffffff"
              strokeWidth="1.2"
              opacity="0.8"
            />
          </g>

          {/* Left Rays */}
          <g stroke={leftRaysColor} strokeWidth="2.5" strokeLinecap="round">
            <line x1="24" y1="21" x2="27" y2="13" />
            <line x1="20" y1="28" x2="10" y2="21" />
            <line x1="18" y1="36" x2="8" y2="38" />
          </g>

          {/* Text */}
          <g
            fontFamily="'Poppins', 'Plus Jakarta Sans', system-ui, sans-serif"
            fontSize="28"
            fontWeight="900"
            letterSpacing="-0.3px"
          >
            <text x="34" y="41" fill={englishColor}>
              English
            </text>
            <text x="146" y="41" fill={sparkColor}>
              Spark
            </text>
          </g>

          {/* Right Rays */}
          <g stroke={rightRaysColor} strokeWidth="2.2" strokeLinecap="round">
            <line x1="236" y1="26" x2="246" y2="20" />
            <line x1="236" y1="34" x2="246" y2="39" />
          </g>

          {/* Spark Star */}
          <path
            d="M 242 44 Q 242 47 245 47 Q 242 47 242 50 Q 242 47 239 47 Q 242 47 242 44 Z"
            fill={sparkColor}
          />
        </svg>
      </div>

      {showSubtitle && subtitle && (
        <>
          <div
            className={`hidden sm:block h-6 w-px ${
              isDark ? 'bg-white/15' : 'bg-slate-200'
            }`}
            aria-hidden="true"
          />
          <span
            className={`hidden sm:inline-block text-[11px] font-bold ${subtitleColor}`}
          >
            {subtitle}
          </span>
        </>
      )}
    </div>
  );
}
