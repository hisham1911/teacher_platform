/* eslint-disable react-refresh/only-export-components */
import type { ComponentType } from 'react';
import {
  BookOpen,
  BookText,
  Headphones,
  PenLine,
  Mic,
  Trophy,
  MessageSquareHeart,
  Sparkles,
  Home,
  GraduationCap,
  Timer,
  Award,
} from 'lucide-react';

export const SECTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  grammar: BookOpen,
  reading: BookText,
  listening: Headphones,
  writing: PenLine,
  speaking: Mic,
  competitions: Trophy,
  guestbook: MessageSquareHeart,
  home: Home,
  million: Award,
  speed: Timer,
  placement: GraduationCap,
};

export const SECTION_THEMES: Record<
  string,
  {
    gradient: string;
    bgSoft: string;
    text: string;
    border: string;
    dot: string;
  }
> = {
  grammar: {
    gradient: 'from-violet-600 to-indigo-700',
    bgSoft: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    dot: 'bg-violet-600',
  },
  reading: {
    gradient: 'from-sky-500 to-blue-600',
    bgSoft: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-600',
  },
  listening: {
    gradient: 'from-purple-600 to-pink-600',
    bgSoft: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-600',
  },
  writing: {
    gradient: 'from-emerald-600 to-teal-700',
    bgSoft: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-600',
  },
  speaking: {
    gradient: 'from-amber-500 to-orange-600',
    bgSoft: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-600',
  },
  competitions: {
    gradient: 'from-amber-500 via-amber-600 to-yellow-600',
    bgSoft: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-600',
  },
  guestbook: {
    gradient: 'from-rose-500 to-fuchsia-600',
    bgSoft: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-600',
  },
};

export function SectionIcon({
  id,
  className = 'w-5 h-5',
}: {
  id: string;
  className?: string;
}) {
  const IconComponent = SECTION_ICONS[id] || Sparkles;
  return <IconComponent className={className} />;
}

const DEFAULT_THEME = {
  gradient: 'from-violet-600 to-indigo-700',
  bgSoft: 'bg-violet-50',
  text: 'text-violet-700',
  border: 'border-violet-200',
  dot: 'bg-violet-600',
};

export function getSectionTheme(id: string) {
  return SECTION_THEMES[id] ?? DEFAULT_THEME;
}

