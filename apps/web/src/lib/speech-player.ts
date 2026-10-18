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

let activeAudioElement: HTMLAudioElement | null = null;

function playAudioFile(url: string, options: SpeechPlayerOptions): () => void {
  stopEnglishSpeech();

  try {
    const audio = new Audio(url);
    activeAudioElement = audio;

    audio.onplay = () => {
      options.onStart?.();
    };
    audio.onended = () => {
      activeAudioElement = null;
      options.onEnd?.();
    };
    audio.onerror = (e) => {
      activeAudioElement = null;
      options.onError?.(e);
      options.onEnd?.();
    };

    audio.play().catch((err) => {
      activeAudioElement = null;
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
 * Robust cross-browser and mobile audio/speech playback that handles:
 * 1. Direct MP3 audio playback if an audio URL is provided.
 * 2. Synchronous invocation in user gesture context (no setTimeout, fixing iOS/Android block).
 * 3. Inclusive Android Google TTS and iOS voice discovery.
 * 4. Resolving cancel/speak race conditions.
 */
export function playEnglishSpeech(
  textOrUrl: string,
  options: SpeechPlayerOptions = {},
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const cleanSource = textOrUrl.trim();
  if (!cleanSource) return () => {};

  // If source is a direct audio file or URL, play it directly
  if (
    cleanSource.endsWith('.mp3') ||
    cleanSource.startsWith('/content/audio/') ||
    cleanSource.startsWith('blob:') ||
    cleanSource.startsWith('data:audio') ||
    cleanSource.includes('.mp3?')
  ) {
    return playAudioFile(cleanSource, options);
  }

  // Only cancel if speech synthesis is currently active to protect iOS user-gesture flag
  if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }

  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      // Ignore
    }
    activeAudioElement = null;
  }

  if (!('speechSynthesis' in window)) {
    options.onError?.(new Error('Speech synthesis is not supported in this browser'));
    options.onEnd?.();
    return () => {};
  }

  // Resume synthesis in case browser paused it
  if (window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.resume();
    } catch {
      // Ignore
    }
  }

  // Clean conversational transcripts (remove character name prefixes like "Sarah:")
  const textToSpeak = cleanSource.replace(/^[A-Za-z]+:\s*/gm, '').trim();

  const utterance = new SpeechSynthesisUtterance(textToSpeak);
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
    globalActiveUtterance = null;
    if (e.error !== 'canceled' && e.error !== 'interrupted') {
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
  } catch (err) {
    globalActiveUtterance = null;
    options.onError?.(err);
    options.onEnd?.();
    return () => {};
  }

  return () => {
    stopEnglishSpeech();
  };
}

export function stopEnglishSpeech(): void {
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      // Ignore
    }
    activeAudioElement = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
        window.speechSynthesis.cancel();
      }
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
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

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
      ...optionsRef.current,
      onStart: () => setIsPlaying(true),
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
    setIsPlaying(true);
  }, [isPlaying, text]);

  const stop = useCallback(() => {
    stopEnglishSpeech();
    setIsPlaying(false);
  }, []);

  return { isPlaying, toggle, stop };
}
