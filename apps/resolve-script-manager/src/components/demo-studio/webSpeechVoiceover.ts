/**
 * webSpeechVoiceover — Resolve-FRI voiceover via nettleserens Web Speech API
 * (speechSynthesis). Brukes i Edit Mode for å høre/time manus uten DaVinci
 * Resolve. Resolve forblir den valgfrie «pro»-veien for eksportert lydfil
 * (ProRes/ducking); Web Speech er gratis, lokal og fungerer overalt.
 *
 * Merk: speechSynthesis kan IKKE fanges til en fil i nettleseren — dette er
 * forhåndsvisning/teleprompter-opplesing, ikke filgenerering. For nedlastbar
 * voiceover-fil: bruk Resolve-provideren (når tilgjengelig).
 */

export interface WebVoice {
  name: string;
  lang: string;
  /** Heuristisk kjønn fra stemmenavn (best effort — system-avhengig). */
  gender: 'female' | 'male' | 'unknown';
}

export function isWebSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

const FEMALE_HINTS = /(female|kvinne|woman|samantha|victoria|karen|moira|tessa|fiona|nora|sara|anna|amelie|ingrid|siri.*female)/i;
const MALE_HINTS = /(male|mann|man|daniel|alex|fred|thomas|oliver|henrik|magnus|jorge|diego|siri.*male)/i;

function classifyGender(name: string): WebVoice['gender'] {
  if (FEMALE_HINTS.test(name)) return 'female';
  if (MALE_HINTS.test(name)) return 'male';
  return 'unknown';
}

/**
 * Hent tilgjengelige stemmer. speechSynthesis fyller listen asynkront på noen
 * plattformer, så vi venter på `voiceschanged` ved behov.
 */
export function getWebVoices(): Promise<WebVoice[]> {
  if (!isWebSpeechSupported()) return Promise.resolve([]);
  const map = (vs: SpeechSynthesisVoice[]): WebVoice[] =>
    vs.map((v) => ({ name: v.name, lang: v.lang, gender: classifyGender(v.name) }));
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(map(now));
  return new Promise((resolve) => {
    const done = () => resolve(map(window.speechSynthesis.getVoices()));
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    // Fallback hvis eventet aldri fyrer.
    setTimeout(done, 600);
  });
}

export interface SpeakOptions {
  voiceName?: string;
  /** Foretrukket kjønn når voiceName ikke er satt. */
  gender?: 'female' | 'male';
  lang?: string;
  rate?: number;   // 0.5–2
  pitch?: number;  // 0–2
  onEnd?: () => void;
  onError?: () => void;
}

function pickVoice(opts: SpeakOptions): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis.getVoices();
  if (opts.voiceName) { const v = vs.find((x) => x.name === opts.voiceName); if (v) return v; }
  const byLang = opts.lang ? vs.filter((x) => x.lang.toLowerCase().startsWith(opts.lang!.toLowerCase().slice(0, 2))) : vs;
  const pool = byLang.length ? byLang : vs;
  if (opts.gender) { const g = pool.find((x) => classifyGender(x.name) === opts.gender); if (g) return g; }
  return pool[0];
}

/** Les opp én tekst. Avbryter pågående opplesing først. */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!isWebSpeechSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(opts);
  if (v) { u.voice = v; u.lang = v.lang; }
  else if (opts.lang) u.lang = opts.lang;
  u.rate = opts.rate ?? 1;
  u.pitch = opts.pitch ?? 1;
  if (opts.onEnd) u.onend = () => opts.onEnd!();
  if (opts.onError) u.onerror = () => opts.onError!();
  window.speechSynthesis.speak(u);
}

/**
 * Les opp en sekvens av linjer etter hverandre (hele demoen). onLine(i) før hver
 * linje, onDone når ferdig. Returnerer en stop()-funksjon.
 */
export function speakSequence(
  lines: string[],
  opts: SpeakOptions & { onLine?: (index: number) => void; onDone?: () => void } = {},
): () => void {
  let stopped = false;
  let i = 0;
  const next = () => {
    if (stopped) return;
    if (i >= lines.length) { opts.onDone?.(); return; }
    const idx = i++;
    opts.onLine?.(idx);
    speak(lines[idx], { ...opts, onEnd: next, onError: next });
  };
  next();
  return () => { stopped = true; cancelSpeech(); };
}

export function cancelSpeech(): void {
  if (isWebSpeechSupported()) window.speechSynthesis.cancel();
}
