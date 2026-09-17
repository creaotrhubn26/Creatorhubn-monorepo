/**
 * Wrapper rundt Web Speech API (SpeechSynthesis).
 *
 * POC-valg: nettleserens innebygde stemmer. Det gir null kostnad og
 * ~50 språk på iOS/Android uten backend. I produksjon byttes dette til
 * forhåndsinnspilte/nevrale stemmer (samme grensesnitt: `speak(text, lang)`).
 *
 * Teksting bygger på `boundary`-hendelser (ord-nivå) der nettleseren
 * støtter det (Chrome/Edge), og faller tilbake til segment-nivå ellers.
 */

export interface SpeakOptions {
  lang: string;
  rate?: number;
  /** Kalles med tegnindeks når et nytt ord starter (hvis støttet). */
  onBoundary?: (charIndex: number) => void;
  onEnd?: () => void;
  onError?: (reason: string) => void;
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

let voicesCache: SpeechSynthesisVoice[] = [];

function refreshVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length) voicesCache = v;
  return voicesCache;
}

if (isSpeechSupported()) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

/** Beste stemme for språket: eksakt region først, så primærtag, så null. */
export function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = refreshVoices();
  const wanted = lang.toLowerCase();
  const primary = wanted.split('-')[0];
  const exact = voices.find((v) => v.lang.toLowerCase() === wanted);
  if (exact) return exact;
  const samePrimary = voices.filter((v) => v.lang.toLowerCase().split('-')[0] === primary);
  // Foretrekk lokale (ikke nettverks-) stemmer og «default».
  return (
    samePrimary.find((v) => v.default) ??
    samePrimary.find((v) => v.localService) ??
    samePrimary[0] ??
    null
  );
}

export function hasVoiceFor(lang: string): boolean {
  return pickVoice(lang) !== null;
}

let current: SpeechSynthesisUtterance | null = null;

export function cancelSpeech(): void {
  if (!isSpeechSupported()) return;
  current = null;
  window.speechSynthesis.cancel();
}

export function pauseSpeech(): void {
  if (isSpeechSupported()) window.speechSynthesis.pause();
}

export function resumeSpeech(): void {
  if (isSpeechSupported()) window.speechSynthesis.resume();
}

/**
 * Snakker én tekst. Returnerer false hvis tale ikke er tilgjengelig – da
 * skal UI-et vise teksten som ren teksting med manuell «neste».
 */
export function speak(text: string, opts: SpeakOptions): boolean {
  if (!isSpeechSupported()) return false;
  cancelSpeech();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts.lang;
  u.rate = opts.rate ?? 1;
  const voice = pickVoice(opts.lang);
  if (voice) u.voice = voice;
  u.onboundary = (ev) => {
    if (ev.name === 'word' || ev.charIndex !== undefined) opts.onBoundary?.(ev.charIndex);
  };
  u.onend = () => {
    if (current === u) {
      current = null;
      opts.onEnd?.();
    }
  };
  u.onerror = (ev) => {
    if (current === u) {
      current = null;
      // «interrupted»/«canceled» er forventet når brukeren hopper videre.
      if (ev.error !== 'interrupted' && ev.error !== 'canceled') opts.onError?.(ev.error);
    }
  };
  current = u;
  window.speechSynthesis.speak(u);
  return true;
}
