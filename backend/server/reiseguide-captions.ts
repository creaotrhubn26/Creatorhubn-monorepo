/**
 * Bygger tekstingscues for lydguiden fra Soniox' tegnnivå-tidsstempler.
 *
 * Tidsstemplene gjelder modellens forbehandlede tekst (tall kan være skrevet
 * ut, mellomrom normalisert), så vi deler den uttalte teksten i setninger og
 * henter setningsteksten fra manuset når setningstallet stemmer. Da viser
 * appen redaktørens tekst med riktige tider. Stemmer ikke tallet, brukes den
 * uttalte teksten, som fortsatt er riktig tidsatt.
 *
 * Cue-formatet {startS, endS, text} er kontrakten mot
 * ipad/Reiseguide … PlayerViewModel.swift (CaptionTimeline.build) og
 * reiseguide-routes.ts (captions.cues).
 */

import type { CharacterTiming } from "./reiseguide-soniox-tts.js";

export interface CaptionCue {
  startS: number;
  endS: number;
  text: string;
}

const TERMINALS = new Set([".", "!", "?", "…"]);
/** Kortere enn dette leses ikke; cue-slutten strekkes. */
const MIN_CUE_DURATION_S = 0.4;

/** Samme setningsregel som CaptionTimeline.splitSentences i appen, pluss linjeskift. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let current = "";
    for (const ch of paragraph) {
      current += ch;
      if (TERMINALS.has(ch)) {
        const trimmed = current.trim();
        if (trimmed) out.push(trimmed);
        current = "";
      }
    }
    const rest = current.trim();
    if (rest) out.push(rest);
  }
  return out;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

interface SpokenSentence {
  text: string;
  startS: number;
  endS: number;
}

function spokenSentences(timings: CharacterTiming[]): SpokenSentence[] {
  const out: SpokenSentence[] = [];
  let text = "";
  let startS: number | null = null;
  let endS = 0;
  const flush = () => {
    const trimmed = text.trim();
    if (trimmed && startS !== null) out.push({ text: trimmed, startS, endS });
    text = "";
    startS = null;
  };
  for (const t of timings) {
    const isSpace = /\s/.test(t.char);
    if (t.char === "\n") {
      flush();
      continue;
    }
    text += t.char;
    if (!isSpace) {
      if (startS === null) startS = t.startS;
      endS = Math.max(endS, t.endS);
    }
    if (TERMINALS.has(t.char)) flush();
  }
  flush();
  return out;
}

export function buildCaptionCues(scriptText: string, timings: CharacterTiming[]): CaptionCue[] {
  const spoken = spokenSentences(timings);
  if (spoken.length === 0) return [];
  const scripted = splitSentences(scriptText);
  const useScript = scripted.length === spoken.length;

  const cues: CaptionCue[] = [];
  for (let i = 0; i < spoken.length; i += 1) {
    const s = spoken[i]!;
    const text = useScript ? scripted[i]! : s.text;
    const startS = round3(s.startS);
    const endS = round3(Math.max(s.endS, s.startS + MIN_CUE_DURATION_S));
    const previous = cues[cues.length - 1];
    if (previous && previous.endS > startS) previous.endS = startS;
    cues.push({ startS, endS, text });
  }
  return cues.filter((c) => c.endS > c.startS && c.text.length > 0);
}
