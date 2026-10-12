import { useState, useEffect, useRef, useCallback } from 'react';

// Persistent reference to prevent V8/WebKit garbage-collecting the utterance
let globalActiveUtterance: SpeechSynthesisUtterance | null = null;

let cachedVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

function getEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  return (
    voices.find((v) => v.lang === 'en-US') ||
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

let activeFallbackAudio: HTMLAudioElement | null = null;

function playFallbackAudio(text: string, options: SpeechPlayerOptions): () => void {
  try {
    const cleanChunk = encodeURIComponent(text.slice(0, 200).trim());
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${cleanChunk}`;
    const audio = new Audio(url);
    activeFallbackAudio = audio;

    audio.onplay = () => {
      options.onStart?.();
    };
    audio.onended = () => {
      activeFallbackAudio = null;
      options.onEnd?.();
    };
    audio.onerror = (e) => {
      activeFallbackAudio = null;
      options.onError?.(e);
      options.onEnd?.();
    };

    audio.play().catch((err) => {
      activeFallbackAudio = null;
      options.onError?.(err);
      options.onEnd?.();
    });

    return () => {
      stopEnglishSpeech();
    };
  } catch (err) {
    options.onError?.(err);
    options.onEnd?.();
    return () => {};
  }
}

/**
 * Robust cross-browser and mobile speech playback that handles:
 * 1. Synchronous invocation in user gesture context (no setTimeout, fixing iOS/Android block).
 * 2. Inclusive Android Google TTS and iOS voice discovery.
 * 3. Graceful streaming audio fallback if mobile browser blocks Web Speech API.
 * 4. Resolving cancel/speak race conditions.
 */
export function playEnglishSpeech(
  text: string,
  options: SpeechPlayerOptions = {},
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  stopEnglishSpeech();

  const cleanText = text.trim();
  if (!cleanText) return () => {};

  if (!('speechSynthesis' in window)) {
    return playFallbackAudio(cleanText, options);
  }

  // Resume synthesis in case browser paused it
  if (window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.resume();
    } catch {
      // Ignore
    }
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = options.lang || 'en-US';
  utterance.rate = options.rate ?? 0.88;
  utterance.pitch = options.pitch ?? 1.0;

  const englishVoice = getEnglishVoice();
  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  let hasStartedSpeaking = false;

  utterance.onstart = () => {
    hasStartedSpeaking = true;
    options.onStart?.();
  };

  utterance.onend = () => {
    globalActiveUtterance = null;
    options.onEnd?.();
  };

  utterance.onerror = (e) => {
    globalActiveUtterance = null;
    if (e.error !== 'canceled' && e.error !== 'interrupted') {
      if (!hasStartedSpeaking) {
        // Fallback to audio stream if speech synthesis fails to start on mobile
        playFallbackAudio(cleanText, options);
        return;
      }
      options.onError?.(e);
    }
    options.onEnd?.();
  };

  globalActiveUtterance = utterance;

  // Execute synchronously within the user touch/click gesture context!
  try {
    if (globalActiveUtterance === utterance) {
      window.speechSynthesis.speak(utterance);
    }
  } catch {
    globalActiveUtterance = null;
    return playFallbackAudio(cleanText, options);
  }

  return () => {
    stopEnglishSpeech();
  };
}

export function stopEnglishSpeech(): void {
  if (activeFallbackAudio) {
    try {
      activeFallbackAudio.pause();
      activeFallbackAudio.currentTime = 0;
    } catch {
      // Ignore
    }
    activeFallbackAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
    if (globalActiveUtterance) {
      globalActiveUtterance = null;
    }
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
