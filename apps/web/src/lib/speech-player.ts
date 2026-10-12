import { useState, useEffect, useRef, useCallback } from 'react';

// Persistent reference to prevent V8/WebKit garbage-collecting the utterance
let globalActiveUtterance: SpeechSynthesisUtterance | null = null;

function getEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-US' && !v.name.includes('Google') && !v.name.includes('Natural')) ||
    voices.find((v) => v.lang.startsWith('en-US')) ||
    voices.find((v) => v.lang.startsWith('en-GB')) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    null
  );
}

export interface SpeechPlayerOptions {
  rate?: number;
  pitch?: number;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Robust cross-browser speech playback that handles:
 * 1. Garbage collection bug in Chromium/Safari by keeping module-level utterance reference.
 * 2. Unfreezing speechSynthesis when paused in Chromium.
 * 3. Explicitly selecting English voice so Arabic locale OSs don't fail.
 * 4. Resolving cancel/speak race conditions.
 */
export function playEnglishSpeech(
  text: string,
  options: SpeechPlayerOptions = {},
): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onError?.(new Error('SpeechSynthesis not supported'));
    return () => {};
  }

  // Cancel any existing speech
  stopEnglishSpeech();

  // Resume synthesis in case browser paused it
  if (window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.resume();
    } catch {
      // Ignore
    }
  }

  const cleanText = text.trim();
  if (!cleanText) return () => {};

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = options.lang || 'en-US';
  utterance.rate = options.rate ?? 0.88;
  utterance.pitch = options.pitch ?? 1.0;

  const englishVoice = getEnglishVoice();
  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  utterance.onstart = () => {
    options.onStart?.();
  };

  utterance.onend = () => {
    globalActiveUtterance = null;
    options.onEnd?.();
  };

  utterance.onerror = (e) => {
    // If canceled manually, do not treat as fatal error
    globalActiveUtterance = null;
    if (e.error !== 'canceled' && e.error !== 'interrupted') {
      console.warn('SpeechSynthesis error:', e.error);
      options.onError?.(e);
    }
    options.onEnd?.();
  };

  globalActiveUtterance = utterance;

  // Small timeout to allow any pending cancel() to clear in Chrome
  window.setTimeout(() => {
    try {
      if (globalActiveUtterance === utterance) {
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.warn('speechSynthesis.speak error:', err);
      globalActiveUtterance = null;
      options.onError?.(err);
      options.onEnd?.();
    }
  }, 20);

  return () => {
    stopEnglishSpeech();
  };
}

export function stopEnglishSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
    globalActiveUtterance = null;
  }
}

/**
 * React hook for managing English audio speech state in portal views.
 */
export function useSpeechPlayer(text: string | null | undefined, options: Omit<SpeechPlayerOptions, 'onStart' | 'onEnd'> = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  // Stop when text changes or unmounts
  useEffect(() => {
    return () => {
      stopEnglishSpeech();
      setIsPlaying(false);
    };
  }, [text]);

  const toggle = useCallback(() => {
    if (!text || !text.trim()) return;

    if (isPlaying) {
      stopEnglishSpeech();
      setIsPlaying(false);
      return;
    }

    cancelRef.current = playEnglishSpeech(text, {
      ...options,
      onStart: () => setIsPlaying(true),
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
    setIsPlaying(true);
  }, [isPlaying, text, options]);

  return {
    isPlaying,
    toggle,
    stop: () => {
      stopEnglishSpeech();
      setIsPlaying(false);
    },
  };
}
