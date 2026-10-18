export function SaudiEmblemIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Palm Tree Trunk (جذع النخلة الأصيل) */}
      <path
        d="M32 14V34M30.2 34H33.8"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* Center & Upper Palm Fronds (سعف النخلة العلوي والأوسط) */}
      <path
        d="M32 15C28 7 19 7 13 13C19 11.5 26 12.5 32 16.5Z"
        fill="currentColor"
      />
      <path
        d="M32 15C36 7 45 7 51 13C45 11.5 38 12.5 32 16.5Z"
        fill="currentColor"
      />
      <path
        d="M32 18.5C25 12 14 14 9 21C16 18 24 18.5 32 21Z"
        fill="currentColor"
      />
      <path
        d="M32 18.5C39 12 50 14 55 21C48 18 40 18.5 32 21Z"
        fill="currentColor"
      />
      <path
        d="M32 22C26 18 18 20.5 14 26.5C20 23.5 26 23.5 32 24.5Z"
        fill="currentColor"
      />
      <path
        d="M32 22C38 18 46 20.5 50 26.5C44 23.5 38 23.5 32 24.5Z"
        fill="currentColor"
      />
      <path
        d="M32 7.5C30 11 30 14 32 16C34 14 34 11 32 7.5Z"
        fill="currentColor"
      />

      {/* Curved Arabian Swords Crossing (السيفان العربيان المنحنيان المتقاطعان) */}
      {/* Blade 1: Bottom-Right Hilt to Top-Left Tip */}
      <path
        d="M49 52C39 46 26 39 11 35"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* Blade 2: Bottom-Left Hilt to Top-Right Tip */}
      <path
        d="M15 52C25 46 38 39 53 35"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* Sword Crossguards & Pommels (مقابض السيفين الأصيلة) */}
      <path
        d="M46 49L51 54M52.5 54.5C53.6 55.6 52 57.2 50.8 56L47.5 52.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M18 49L13 54M11.5 54.5C10.4 55.6 12 57.2 13.2 56L16.5 52.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
