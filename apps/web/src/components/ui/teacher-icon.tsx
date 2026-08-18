import type { ReactNode } from 'react';

export type TeacherIconName =
  | 'home'
  | 'create'
  | 'quizzes'
  | 'questions'
  | 'reports'
  | 'certificate'
  | 'settings'
  | 'play'
  | 'preview'
  | 'publish'
  | 'audio'
  | 'short-answer'
  | 'ordering'
  | 'true-false'
  | 'move-up'
  | 'move-down'
  | 'remove'
  | 'workspace'
  | 'logout';

export function TeacherIcon({ name, className = 'h-5 w-5' }: { name: TeacherIconName; className?: string }) {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /><path d="M9.5 20v-6h5v6" /></>,
    create: <><path d="M12 5v14M5 12h14" /><circle cx="12" cy="12" r="9" /></>,
    quizzes: <><path d="M7 3.5h8l3 3V20H7z" /><path d="M15 3.5V7h3M10 11h5M10 15h5" /></>,
    questions: <><path d="M5 6.5 12 3l7 3.5-7 3.5z" /><path d="m5 11 7 3.5 7-3.5M5 15.5l7 3.5 7-3.5" /></>,
    reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    certificate: <><path d="M6 3.5h12V15H6z" /><path d="m9 15-1 6 4-2 4 2-1-6M9 8h6M9 11h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.7-.6-1.4.9-1.9-2.1-2.1-1.9.9-1.4-.6L10.5 3h-3l-.7 2-.4.2-1.9-.9-2.1 2.1.9 1.9-.6 1.4-2 .7v3l2 .7.6 1.4-.9 1.9 2.1 2.1 1.9-.9 1.4.6.7 2h3l.7-2 1.4-.6 1.9.9 2.1-2.1-.9-1.9.6-1.4z" /></>,
    play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4z" /></>,
    preview: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    publish: <><path d="m21 3-7 18-4-7-7-4zM10 14 21 3" /></>,
    audio: <><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" /></>,
    'short-answer': <><path d="M4 6h16M4 11h12M4 16h8" /></>,
    ordering: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 5h1v2M4 11h1v2M4 17h1v2" /></>,
    'true-false': <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    'move-up': <><path d="m7 11 5-5 5 5" /><path d="M12 6v12" /></>,
    'move-down': <><path d="m7 13 5 5 5-5" /><path d="M12 6v12" /></>,
    remove: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" /><path d="M10 11v5M14 11v5" /></>,
    workspace: <><path d="M3 7h18v13H3zM8 7V4h8v3" /><path d="M3 12h18" /></>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" /></>,
  } satisfies Record<TeacherIconName, ReactNode>;

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths[name]}
    </svg>
  );
}
