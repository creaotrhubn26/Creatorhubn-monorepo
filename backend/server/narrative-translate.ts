/**
 * narrative-translate.ts — statsløs KI-oversettelse av Story Graph-prose.
 *
 * Mønster: resume-routes «ai-translate» (oversett verdier, ikke nøkler, returner
 * rå JSON) via den delte `callClaudeForJson`-hjelperen. Endepunktet lagrer
 * ingenting: klienten fyller oversettelsesfeltene, og designeren lagrer selv.
 * Kodeblokker (arcscript) sendes aldri hit — segmentene er allerede prose
 * (frontend/shared/narrative-format/locale.ts listTranslatableSegments).
 */

import { callClaudeForJson } from './claude-json-helper.js';

export const MAX_TRANSLATE_SEGMENTS = 40;
export const MAX_SEGMENT_CHARS = 4000;
const MODEL = process.env.NARRATIVE_TRANSLATE_MODEL || 'claude-opus-5';

export interface TranslateSegment {
  key: string;
  text: string;
  /** Kort kontekst (f.eks. «Valg fra X til Y») — hjelper tone og lengde. */
  context?: string;
}

export interface TranslateInput {
  segments: TranslateSegment[];
  sourceLocale: string;
  targetLocale: string;
  /** Historiens tittel/sjanger — valgfri stil-kontekst. */
  storyContext?: string;
}

export interface TranslateResult {
  translations: Array<{ key: string; text: string }>;
  model: string;
  missing: string[];
}

const LANGUAGE_NAMES: Record<string, string> = {
  nb: 'norsk bokmål', nn: 'norsk nynorsk', en: 'engelsk', sv: 'svensk', da: 'dansk', de: 'tysk', fr: 'fransk',
  es: 'spansk', fi: 'finsk', pl: 'polsk', ja: 'japansk', it: 'italiensk', nl: 'nederlandsk', pt: 'portugisisk',
};

function languageName(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase().split('-')[0]] ?? code;
}

function buildSystemPrompt(): string {
  return [
    'Du er en profesjonell spilloversetter som oversetter forgrenet narrativ (dialog, fortellerstemme og valg-etiketter).',
    'Du får et JSON-objekt {"segments":[{"key","text","context"}]} og skal returnere KUN et JSON-objekt',
    '{"translations":[{"key","text"}]} med samme nøkler — ingen prosa, ingen markdown-gjerder.',
    'Regler:',
    '  - Oversett bare "text". Behold nøklene uendret. Ikke legg til, slå sammen eller fjern segmenter.',
    '  - Behold tone, register og lengde. Valg-etiketter (context starter med «Valg») skal være korte handlinger.',
    '  - Ikke oversett egennavn på karakterer/steder med mindre de er beskrivende.',
    '  - Behold linjeskift, tall og tegnsetting. Aldri legg til kode, klammer eller variabler.',
    '  - Er et segment allerede på målspråket, returner det uendret.',
  ].join('\n');
}

/** Rens/kutt segmentene før de sendes (nøkkelvalidering, lengde, antall). */
export function normalizeSegments(input: unknown): TranslateSegment[] {
  if (!Array.isArray(input)) return [];
  const out: TranslateSegment[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const key = typeof r.key === 'string' ? r.key.trim().slice(0, 200) : '';
    const text = typeof r.text === 'string' ? r.text.replace(/\r\n?/g, '\n').trim().slice(0, MAX_SEGMENT_CHARS) : '';
    if (!key || !text || seen.has(key)) continue;
    seen.add(key);
    const context = typeof r.context === 'string' ? r.context.trim().slice(0, 200) : undefined;
    out.push(context ? { key, text, context } : { key, text });
    if (out.length >= MAX_TRANSLATE_SEGMENTS) break;
  }
  return out;
}

export async function translateSegments(input: TranslateInput): Promise<TranslateResult> {
  const segments = normalizeSegments(input.segments);
  if (segments.length === 0) return { translations: [], model: MODEL, missing: [] };
  const userMessage = [
    `Kildespråk: ${languageName(input.sourceLocale)} (${input.sourceLocale}). Målspråk: ${languageName(input.targetLocale)} (${input.targetLocale}).`,
    input.storyContext ? `Historie: ${input.storyContext.slice(0, 300)}` : '',
    '',
    JSON.stringify({ segments }),
  ].filter(Boolean).join('\n');

  const result = await callClaudeForJson<{ translations?: Array<{ key?: unknown; text?: unknown }> }>({
    cachedSystem: buildSystemPrompt(),
    userMessage,
    maxTokens: 8192,
    model: MODEL,
  });

  const wanted = new Map(segments.map((s) => [s.key, s]));
  const translations: Array<{ key: string; text: string }> = [];
  for (const t of Array.isArray(result.data?.translations) ? result.data.translations : []) {
    if (typeof t?.key !== 'string' || typeof t?.text !== 'string') continue;
    if (!wanted.has(t.key)) continue;
    const text = t.text.trim().slice(0, MAX_SEGMENT_CHARS);
    if (!text) continue;
    translations.push({ key: t.key, text });
    wanted.delete(t.key);
  }
  return { translations, model: result.model, missing: [...wanted.keys()] };
}
