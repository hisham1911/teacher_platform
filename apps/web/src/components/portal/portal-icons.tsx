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
    surface: string;
    glow: string;
    ring: string;
    shadow: string;
  }
> = {
  grammar: {
    gradient: 'from-violet-600 to-indigo-700',
    bgSoft: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200/80',
    dot: 'bg-violet-600',
    surface: 'bg-gradient-to-br from-white via-white/95 to-violet-50/40',
    glow: 'from-violet-500/15 via-indigo-500/5 to-transparent',
    ring: 'hover:ring-violet-400/25',
    shadow: 'hover:shadow-violet-900/10 hover:border-violet-300',
  },
  reading: {
    gradient: 'from-sky-500 to-blue-600',
    bgSoft: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200/80',
    dot: 'bg-sky-600',
    surface: 'bg-gradient-to-br from-white via-white/95 to-sky-50/40',
    glow: 'from-sky-500/15 via-blue-500/5 to-transparent',
    ring: 'hover:ring-sky-400/25',
    shadow: 'hover:shadow-sky-900/10 hover:border-sky-300',
  },
  listening: {
    gradient: 'from-purple-600 to-pink-600',
    bgSoft: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200/80',
    dot: 'bg-purple-600',
    surface: 'bg-gradient-to-br from-white via-white/95 to-purple-50/40',
    glow: 'from-purple-500/15 via-pink-500/5 to-transparent',
    ring: 'hover:ring-purple-400/25',
    shadow: 'hover:shadow-purple-900/10 hover:border-purple-300',
  },
  writing: {
    gradient: 'from-emerald-600 to-teal-700',
    bgSoft: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-600',
    surface: 'bg-gradient-to-br from-white via-white/95 to-emerald-50/40',
    glow: 'from-emerald-500/15 via-teal-500/5 to-transparent',
    ring: 'hover:ring-emerald-400/25',
    shadow: 'hover:shadow-emerald-900/10 hover:border-emerald-300',
  },
  speaking: {
    gradient: 'from-amber-500 to-orange-600',
    bgSoft: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200/80',
    dot: 'bg-amber-600',
    surface: 'bg-gradient-to-br from-white via-white/95 to-amber-50/40',
    glow: 'from-amber-500/15 via-orange-500/5 to-transparent',
    ring: 'hover:ring-amber-400/25',
    shadow: 'hover:shadow-amber-900/10 hover:border-amber-300',
  },
  competitions: {
    gradient: 'from-amber-500 via-amber-600 to-yellow-600',
    bgSoft: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200/80',
    dot: 'bg-amber-600',
    surface: 'bg-gradient-to-br from-white via-amber-50/20 to-yellow-50/40',
    glow: 'from-amber-500/18 via-yellow-500/8 to-transparent',
    ring: 'hover:ring-amber-400/25',
    shadow: 'hover:shadow-amber-900/12 hover:border-amber-300',
  },
  guestbook: {
    gradient: 'from-rose-500 to-fuchsia-600',
    bgSoft: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200/80',
    dot: 'bg-rose-600',
    surface: 'bg-gradient-to-br from-white via-white/95 to-rose-50/40',
    glow: 'from-rose-500/15 via-pink-500/5 to-transparent',
    ring: 'hover:ring-rose-400/25',
    shadow: 'hover:shadow-rose-900/10 hover:border-rose-300',
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
  border: 'border-violet-200/80',
  dot: 'bg-violet-600',
  surface: 'bg-gradient-to-br from-white via-white/95 to-violet-50/40',
  glow: 'from-violet-500/15 via-indigo-500/5 to-transparent',
  ring: 'hover:ring-violet-400/25',
  shadow: 'hover:shadow-violet-900/10 hover:border-violet-300',
};

export function getSectionTheme(id: string) {
  return SECTION_THEMES[id] ?? DEFAULT_THEME;
}

