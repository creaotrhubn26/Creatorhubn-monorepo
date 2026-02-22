/**
 * ttsService — Multilingual Text-to-Speech service
 *
 * Supports 20+ languages via free Edge-TTS (Microsoft neural voices) with
 * OpenAI TTS fallback. Also exposes Whisper STT (speech-to-text).
 *
 * Pass `language` (ISO 639-1, e.g. 'en', 'nb', 'de', 'fr', 'es') to
 * auto-select the best voice for that language.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TTSModel = 'tts-1' | 'tts-1-hd';
export type TTSFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav';

/** ISO 639-1 language codes supported by the TTS service */
export type TTSLanguage =
  | 'en' | 'nb' | 'no' | 'da' | 'sv' | 'fi'
  | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'nl' | 'pl' | 'ru'
  | 'ja' | 'ko' | 'zh' | 'ar' | 'hi' | 'tr';

export interface TTSOptions {
  /** OpenAI voice id (default: 'nova') */
  voice?: TTSVoice;
  /** Language for voice selection (ISO 639-1, e.g. 'en', 'nb', 'de') */
  language?: TTSLanguage | string;
  /** Model quality — 'tts-1' is fast, 'tts-1-hd' is high quality */
  model?: TTSModel;
  /** Playback speed 0.25-4.0 (default: 1.0) */
  speed?: number;
  /** Audio format (default: 'mp3') */
  format?: TTSFormat;
  /** Volume 0-1 (default: 1.0) */
  volume?: number;
  /** Use browser SpeechSynthesis instead of OpenAI */
  useBrowserTTS?: boolean;
  /** Browser voice (only when useBrowserTTS is true) */
  browserVoice?: SpeechSynthesisVoice | null;
  /** Pitch for browser TTS (default: 1.0) */
  pitch?: number;
}

export interface WhisperTranscription {
  text: string;
  language?: string;
  duration?: number;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice presets for screenplay characters
// ─────────────────────────────────────────────────────────────────────────────

export interface CharacterVoicePreset {
  voice: TTSVoice;
  speed: number;
  label: string;
}

/**
 * Map character archetypes to voices for table reads.
 * This provides consistent, distinct voices for different characters.
 */
export const CHARACTER_VOICE_PRESETS: Record<string, CharacterVoicePreset> = {
  narrator: { voice: 'onyx', speed: 0.95, label: 'Narrator' },
  male_lead: { voice: 'echo', speed: 1.0, label: 'Male lead' },
  female_lead: { voice: 'nova', speed: 1.0, label: 'Female lead' },
  male_supporting: { voice: 'fable', speed: 1.0, label: 'Male supporting' },
  female_supporting: { voice: 'shimmer', speed: 1.0, label: 'Female supporting' },
  child: { voice: 'alloy', speed: 1.1, label: 'Child' },
  villain: { voice: 'onyx', speed: 0.9, label: 'Villain' },
  elderly: { voice: 'fable', speed: 0.85, label: 'Elderly' },
  default: { voice: 'nova', speed: 1.0, label: 'Default' },
};

/** All available TTS voices — works with both OpenAI and free Edge-TTS */
export const TTS_VOICES: Array<{ id: TTSVoice; label: string; description: string }> = [
  { id: 'alloy', label: 'Alloy', description: 'Neutral, balanced' },
  { id: 'echo', label: 'Echo', description: 'Deep, clear' },
  { id: 'fable', label: 'Fable', description: 'Warm, storytelling' },
  { id: 'onyx', label: 'Onyx', description: 'Deep, authoritative' },
  { id: 'nova', label: 'Nova', description: 'Bright, engaging' },
  { id: 'shimmer', label: 'Shimmer', description: 'Soft, expressive' },
];

/**
 * Supported TTS languages — each maps to best Edge-TTS neural voices.
 * The `id` is an ISO 639-1 code passed as `language` in TTSOptions.
 */
export const TTS_LANGUAGES: Array<{ id: TTSLanguage; label: string; flag: string }> = [
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'nb', label: 'Norsk (bokmål)', flag: '🇳🇴' },
  { id: 'da', label: 'Dansk', flag: '🇩🇰' },
  { id: 'sv', label: 'Svenska', flag: '🇸🇪' },
  { id: 'fi', label: 'Suomi', flag: '🇫🇮' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'it', label: 'Italiano', flag: '🇮🇹' },
  { id: 'pt', label: 'Português', flag: '🇵🇹' },
  { id: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { id: 'pl', label: 'Polski', flag: '🇵🇱' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
  { id: 'ja', label: '日本語', flag: '🇯🇵' },
  { id: 'ko', label: '한국어', flag: '🇰🇷' },
  { id: 'zh', label: '中文', flag: '🇨🇳' },
  { id: 'ar', label: 'العربية', flag: '🇸🇦' },
  { id: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { id: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

/** Additional free Norwegian voices available via Edge-TTS */
export const FREE_EXTRA_VOICES = [
  { id: 'finn', label: 'Finn', description: 'Norwegian male (free)' },
  { id: 'pernille', label: 'Pernille', description: 'Norwegian female (free)' },
  { id: 'iselin', label: 'Iselin', description: 'Norwegian female - expressive (free)' },
] as const;

export interface TTSProviderStatus {
  freeServicesEnabled: boolean;
  openaiConfigured: boolean;
  edgeTts: { available: boolean; service?: string; voices?: number };
  fasterWhisper: { available: boolean; model?: string };
}

/** Check which TTS/STT providers are available */
export async function getTTSStatus(): Promise<TTSProviderStatus> {
  try {
    const res = await fetch('/api/ai/tts/status');
    if (res.ok) return await res.json();
  } catch { /* ignore */ }
  return {
    freeServicesEnabled: false,
    openaiConfigured: false,
    edgeTts: { available: false },
    fasterWhisper: { available: false },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null;
let isPlaying = false;

// Audio cache — avoid re-requesting identical text+voice combos
const audioCache = new Map<string, string>(); // key → blob URL
const MAX_CACHE_SIZE = 50;

function getCacheKey(text: string, opts: TTSOptions): string {
  return `${opts.voice ?? 'nova'}|${opts.language ?? ''}|${opts.model ?? 'tts-1'}|${opts.speed ?? 1}|${text}`;
}

function addToCache(key: string, blobUrl: string): void {
  if (audioCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    const firstKey = audioCache.keys().next().value;
    if (firstKey) {
      URL.revokeObjectURL(audioCache.get(firstKey)!);
      audioCache.delete(firstKey);
    }
  }
  audioCache.set(key, blobUrl);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core TTS functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Speak text using OpenAI TTS with fallback to browser SpeechSynthesis.
 * Returns a promise that resolves when playback completes.
 */
export async function speak(text: string, options: TTSOptions = {}): Promise<void> {
  if (!text || text.trim().length === 0) return;

  // Stop any currently playing audio
  stopTTS();

  // Use browser TTS if explicitly requested or as fallback
  if (options.useBrowserTTS) {
    return speakWithBrowser(text, options);
  }

  try {
    return await speakWithOpenAI(text, options);
  } catch (err) {
    console.warn('OpenAI TTS failed, falling back to browser SpeechSynthesis:', err);
    return speakWithBrowser(text, options);
  }
}

/**
 * Speak text using OpenAI TTS API via backend proxy.
 */
async function speakWithOpenAI(text: string, options: TTSOptions = {}): Promise<void> {
  const cacheKey = getCacheKey(text, options);

  // Check cache first
  let blobUrl = audioCache.get(cacheKey);

  if (!blobUrl) {
    const response = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        voice: options.voice ?? 'nova',
        language: options.language,
        model: options.model ?? 'tts-1',
        speed: options.speed ?? 1.0,
        format: options.format ?? 'mp3',
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Unknown' }));
      throw new Error(`TTS API error ${response.status}: ${errData.error || 'Unknown'}`);
    }

    const blob = await response.blob();
    blobUrl = URL.createObjectURL(blob);
    addToCache(cacheKey, blobUrl);
  }

  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(blobUrl!);
    audio.volume = options.volume ?? 1.0;
    currentAudio = audio;
    isPlaying = true;

    audio.onended = () => {
      isPlaying = false;
      currentAudio = null;
      resolve();
    };

    audio.onerror = (e) => {
      isPlaying = false;
      currentAudio = null;
      reject(new Error(`Audio playback error: ${e}`));
    };

    audio.play().catch((e) => {
      isPlaying = false;
      currentAudio = null;
      reject(e);
    });
  });
}

/**
 * Speak text using browser SpeechSynthesis API (fallback).
 */
function speakWithBrowser(text: string, options: TTSOptions = {}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Browser SpeechSynthesis not supported'));
      return;
    }

    window.speechSynthesis.cancel(); // Clear queue

    const utterance = new SpeechSynthesisUtterance(text);
    if (options.browserVoice) utterance.voice = options.browserVoice;
    utterance.rate = options.speed ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    utterance.onend = () => {
      isPlaying = false;
      resolve();
    };
    utterance.onerror = (e) => {
      isPlaying = false;
      reject(e);
    };

    isPlaying = true;
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Stop any currently playing TTS audio.
 */
export function stopTTS(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  isPlaying = false;

  // Also stop browser SpeechSynthesis
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Pause currently playing OpenAI TTS audio.
 */
export function pauseTTS(): void {
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.pause();
  }
}

/**
 * Resume paused TTS audio.
 */
export function resumeTTS(): void {
  if (currentAudio && currentAudio.paused) {
    currentAudio.play().catch(console.error);
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.resume();
  }
}

/**
 * Check if TTS is currently playing.
 */
export function isTTSPlaying(): boolean {
  if (currentAudio && !currentAudio.paused && !currentAudio.ended) return true;
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) return true;
  return isPlaying;
}

/**
 * Get the current playback position (seconds) for OpenAI TTS.
 */
export function getTTSCurrentTime(): number {
  return currentAudio?.currentTime ?? 0;
}

/**
 * Get the duration of the currently playing OpenAI TTS (seconds).
 */
export function getTTSDuration(): number {
  return currentAudio?.duration ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Whisper STT – Speech-to-Text Transcription
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transcribe audio using OpenAI Whisper via backend.
 */
export async function whisperTranscribe(
  audioBlob: Blob,
  options: {
    language?: string;       // ISO 639-1 (e.g. 'en', 'nb', 'de')
    filename?: string;
    timestampGranularities?: boolean;
  } = {},
): Promise<WhisperTranscription> {
  const formData = new FormData();
  formData.append('audio', audioBlob, options.filename ?? 'recording.webm');
  if (options.language) formData.append('language', options.language);
  formData.append('response_format', 'verbose_json');
  if (options.timestampGranularities) {
    formData.append('timestamp_granularities', 'true');
  }

  const response = await fetch('/api/ai/whisper-transcribe', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown' }));
    throw new Error(`Whisper transcription failed: ${err.error || response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Character voice assignment helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Auto-assign OpenAI voices to characters based on name hashing.
 * Ensures each character gets a unique, consistent voice.
 */
export function assignCharacterVoices(
  characters: string[],
): Record<string, TTSVoice> {
  const voices: TTSVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const assignments: Record<string, TTSVoice> = {};

  characters.forEach((name, idx) => {
    // Simple hash for consistency
    const hash = name
      .toUpperCase()
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    assignments[name] = voices[(hash + idx) % voices.length];
  });

  return assignments;
}

/**
 * Pre-load (cache) TTS audio for upcoming dialogue lines.
 * Call ahead-of-time so playback starts instantly.
 */
export async function preloadTTS(
  lines: Array<{ text: string; voice?: TTSVoice; language?: string }>,
  model: TTSModel = 'tts-1',
): Promise<void> {
  const tasks = lines.map(async (line) => {
    const opts: TTSOptions = { voice: line.voice ?? 'nova', language: line.language, model };
    const key = getCacheKey(line.text, opts);
    if (audioCache.has(key)) return; // Already cached

    try {
      const response = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: line.text.trim(),
          voice: opts.voice,
          language: opts.language,
          model: opts.model,
          speed: opts.speed ?? 1.0,
          format: 'mp3',
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        addToCache(key, URL.createObjectURL(blob));
      }
    } catch {
      // Silently ignore preload failures
    }
  });

  await Promise.allSettled(tasks);
}

/**
 * Clear the cached TTS audio blobs to free memory.
 */
export function clearTTSCache(): void {
  for (const url of audioCache.values()) {
    URL.revokeObjectURL(url);
  }
  audioCache.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export
// ─────────────────────────────────────────────────────────────────────────────

export const ttsService = {
  speak,
  stopTTS,
  pauseTTS,
  resumeTTS,
  isTTSPlaying,
  getTTSCurrentTime,
  getTTSDuration,
  whisperTranscribe,
  assignCharacterVoices,
  preloadTTS,
  clearTTSCache,
  getTTSStatus,
  CHARACTER_VOICE_PRESETS,
  TTS_VOICES,
  FREE_EXTRA_VOICES,
  TTS_LANGUAGES,
};

export default ttsService;
