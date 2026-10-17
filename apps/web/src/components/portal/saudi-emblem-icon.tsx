export function SaudiEmblemIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Palm Tree */}
      <path d="M18 6V19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M18 8C13.5 4.5 8.5 6.5 6.5 9.5M18 8C22.5 4.5 27.5 6.5 29.5 9.5M18 11.5C13 9.5 9.5 12 8 14.5M18 11.5C23 9.5 26.5 12 28 14.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* Crossed Swords */}
      <path
        d="M7 29C14 25.5 22 21 29 17.5M29 29C22 25.5 14 21 7 17.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="6.5" cy="29.5" r="1.5" fill="currentColor" />
      <circle cx="29.5" cy="29.5" r="1.5" fill="currentColor" />
    </svg>
  );
}
