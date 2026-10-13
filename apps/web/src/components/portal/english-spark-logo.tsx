export interface EnglishSparkLogoProps {
  /**
   * 'horizontal': Compact for navbars and headers (default)
   * 'full': Stacked lockup with origami airplane above, delicate spark rays, and school pill
   * 'hero': Prominent lockup for hero banners
   * 'icon': Standalone emblem (origami airplane + gentle spark)
   */
  variant?: 'horizontal' | 'full' | 'hero' | 'icon';
  /**
   * Color theme:
   * 'authentic': Soft slate charcoal & sky-blue from teacher's infographics
   * 'vibrant': High-contrast modern cyan & slate
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
 * Crafted faithfully after the official teacher infographics:
 * - Gentle pastel sky-blue origami airplane flying upwards with soft folds and curved flight trail
 * - Warm, friendly, rounded "English Spark" lettering (soft charcoal + sky blue)
 * - Delicate rounded radiating spark rays and four-pointed sparkle star
 * - Responsive, auto-fitting affiliation pill that never clips or overflows
 */
export function EnglishSparkLogo({
  variant = 'horizontal',
  colorTheme = 'auto',
  isDark = false,
  showSubtitle = true,
  subtitle = 'نادي اللغة الإنجليزية',
  className = '',
}: EnglishSparkLogoProps) {
  // Gentle, friendly palette faithful to the teacher's infographics
  const isTeal = colorTheme === 'authentic';
  const englishColor = isDark ? '#f1f5f9' : '#273444';
  const sparkColor = isDark ? '#38bdf8' : isTeal ? '#0284c7' : '#0284c7';
  const raysLeftColor = isDark ? '#94a3b8' : '#475569';
  const raysRightColor = isDark ? '#38bdf8' : '#0ea5e9';
  const trailColor = isDark ? 'rgba(56, 189, 248, 0.45)' : 'rgba(2, 132, 199, 0.35)';

  // Icon Only (Favicon, app emblem, avatar)
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
          fill={isDark ? '#0f172a' : '#0f172a'}
        />
        {/* Soft background glow */}
        <circle cx="58" cy="38" r="28" fill="#0284c7" opacity="0.3" filter="blur(8px)" />

        {/* Delicate Spark Rays */}
        <g stroke="#38bdf8" strokeWidth="2.8" strokeLinecap="round" opacity="0.9">
          <line x1="22" y1="36" x2="14" y2="30" />
          <line x1="20" y1="48" x2="10" y2="48" />
          <line x1="74" y1="58" x2="84" y2="52" />
          <line x1="72" y1="70" x2="82" y2="76" />
        </g>

        {/* Origami Paper Airplane - Soft pastel facets with curved keel */}
        <g transform="translate(30, 24) rotate(8)">
          {/* Main Wing (Pastel Cyan) */}
          <polygon points="42,4 4,18 22,30" fill="#38bdf8" />
          {/* Top Wing / Highlight facet */}
          <polygon points="42,4 22,30 36,40" fill="#bae6fd" />
          {/* Underbody keel / Shadow facet */}
          <polygon points="22,30 36,40 26,38" fill="#0284c7" />
          {/* Spine crease highlight */}
          <line
            x1="42"
            y1="4"
            x2="22"
            y2="30"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.9"
          />
        </g>
      </svg>
    );
  }

  // Full & Hero variants (Centered lockup)
  if (variant === 'full' || variant === 'hero') {
    const isHero = variant === 'hero';
    const svgWidth = isHero ? 440 : 390;
    const svgHeight = isHero ? 118 : 106;

    return (
      <div className={`inline-flex flex-col items-center text-center select-none ${className}`}>
        {/* Core Brand Mark SVG (Wordmark + Airplane + Sparkles) */}
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox="0 0 420 115"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ direction: 'ltr' }}
          className="max-w-full h-auto drop-shadow-2xs"
          aria-label="English Spark Official Logo"
          role="img"
        >
          {/* Graceful curved dashed flight trail */}
          <path
            d="M 220 38 C 242 36, 260 30, 274 20 C 282 14, 288 12, 296 14"
            stroke={trailColor}
            strokeWidth="2"
            strokeDasharray="3 4"
            strokeLinecap="round"
          />

          {/* Gentle Origami Paper Airplane (matching teacher infographics) */}
          <g transform="translate(290, 0) rotate(14) scale(0.95)">
            {/* Main wing */}
            <polygon points="44,4 4,19 23,31" fill="#7dd3fc" />
            {/* Top highlight facet */}
            <polygon points="44,4 23,31 38,41" fill="#bae6fd" />
            {/* Keel shadow facet */}
            <polygon points="23,31 38,41 27,39" fill="#0284c7" />
            {/* Central spine fold highlight */}
            <line
              x1="44"
              y1="4"
              x2="23"
              y2="31"
              stroke="#ffffff"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.95"
            />
          </g>

          {/* Left Spark Rays (delicate, rounded caps) */}
          <g stroke={raysLeftColor} strokeWidth="3" strokeLinecap="round" opacity="0.85">
            <line x1="38" y1="52" x2="43" y2="40" />
            <line x1="32" y1="63" x2="18" y2="52" />
            <line x1="30" y1="76" x2="16" y2="80" />
          </g>

          {/* English Spark Typography - Gentle, rounded, friendly */}
          <g
            fontFamily="'Fredoka', 'Quicksand', 'Comfortaa', 'Plus Jakarta Sans', system-ui, sans-serif"
            fontSize="46"
            fontWeight="800"
            letterSpacing="-0.5px"
          >
            <text x="56" y="86" fill={englishColor}>
              English
            </text>
            <text x="238" y="86" fill={sparkColor}>
              Spark
            </text>
          </g>

          {/* Right Spark Rays */}
          <g stroke={raysRightColor} strokeWidth="2.8" strokeLinecap="round" opacity="0.9">
            <line x1="378" y1="64" x2="394" y2="56" />
            <line x1="378" y1="76" x2="394" y2="83" />
          </g>

          {/* 4-point Sparkle Star Accent */}
          <path
            d="M 388 94 Q 388 99 393 99 Q 388 99 388 104 Q 388 99 383 99 Q 388 99 388 94 Z"
            fill={sparkColor}
            opacity="0.9"
          />
        </svg>

        {/* Responsive, perfectly fitted Affiliation Pill (Clean HTML, never clips) */}
        {showSubtitle && subtitle && (
          <div className="mt-2.5 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-sky-100 bg-white/95 px-4 sm:px-5 py-1.5 shadow-2xs backdrop-blur-xs ring-1 ring-slate-900/5">
            <span
              className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0 animate-pulse"
              aria-hidden="true"
            />
            <span
              className={`text-xs sm:text-sm font-bold tracking-normal text-pretty text-center ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
              dir="rtl"
            >
              {subtitle}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Default: 'horizontal' (compact for navbars and headers)
  return (
    <div
      className={`inline-flex items-center gap-3 select-none ${className}`}
      dir="rtl"
    >
      <div className="flex items-center" dir="ltr">
        <svg
          width="215"
          height="46"
          viewBox="0 0 268 54"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ direction: 'ltr' }}
          className="h-9 sm:h-10 w-auto"
          aria-label="English Spark Logo"
          role="img"
        >
          {/* Dotted Flight Trail */}
          <path
            d="M 148 16 C 160 15, 172 12, 180 7"
            stroke={trailColor}
            strokeWidth="1.8"
            strokeDasharray="2.5 3"
            strokeLinecap="round"
          />

          {/* Soft Origami Airplane */}
          <g transform="translate(182, -2) rotate(14) scale(0.68)">
            <polygon points="44,4 4,19 23,31" fill="#7dd3fc" />
            <polygon points="44,4 23,31 38,41" fill="#bae6fd" />
            <polygon points="23,31 38,41 27,39" fill="#0284c7" />
            <line
              x1="44"
              y1="4"
              x2="23"
              y2="31"
              stroke="#ffffff"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.9"
            />
          </g>

          {/* Left Rays */}
          <g stroke={raysLeftColor} strokeWidth="2.4" strokeLinecap="round" opacity="0.85">
            <line x1="22" y1="21" x2="25" y2="13" />
            <line x1="18" y1="28" x2="8" y2="21" />
            <line x1="17" y1="36" x2="7" y2="38" />
          </g>

          {/* Soft Rounded Text */}
          <g
            fontFamily="'Fredoka', 'Quicksand', 'Comfortaa', 'Plus Jakarta Sans', system-ui, sans-serif"
            fontSize="28"
            fontWeight="800"
            letterSpacing="-0.3px"
          >
            <text x="32" y="39" fill={englishColor}>
              English
            </text>
            <text x="144" y="39" fill={sparkColor}>
              Spark
            </text>
          </g>

          {/* Right Rays */}
          <g stroke={raysRightColor} strokeWidth="2.2" strokeLinecap="round" opacity="0.9">
            <line x1="234" y1="25" x2="244" y2="19" />
            <line x1="234" y1="33" x2="244" y2="38" />
          </g>

          {/* Spark Star */}
          <path
            d="M 240 42 Q 240 45 243 45 Q 240 45 240 48 Q 240 45 237 45 Q 240 45 240 42 Z"
            fill={sparkColor}
          />
        </svg>
      </div>

      {showSubtitle && subtitle && (
        <div className="hidden sm:flex items-center gap-2.5">
          <div
            className={`h-5 w-px ${isDark ? 'bg-white/15' : 'bg-slate-200'}`}
            aria-hidden="true"
          />
          <span
            className={`text-xs font-bold ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
