/**
 * mockupAiLocalize.ts — Fase 7b: oversett tekst-slottene til et annet språk.
 *
 * App Store / Play-lokalisering: samme layout, oversatt copy. Via samme RR-proxy
 * (token-gated). Ett kall oversetter alle slottene og returnerer en id→tekst-map;
 * ren tolkning er testbar.
 */

import { claudeProxyService, isAiConnected } from '../../services/claudeProxyService';

export const LOCALIZE_LANGS: { code: string; label: string }[] = [
  { code: 'en', label: 'Engelsk' },
  { code: 'sv', label: 'Svensk' },
  { code: 'da', label: 'Dansk' },
  { code: 'de', label: 'Tysk' },
  { code: 'fr', label: 'Fransk' },
  { code: 'es', label: 'Spansk' },
  { code: 'nl', label: 'Nederlandsk' },
  { code: 'it', label: 'Italiensk' },
];

export function localizeAvailable(): boolean {
  return isAiConnected();
}

/** Tolk en JSON-objekt-map {id: "oversatt"} fra svaret (code-fence-tolerant). */
export function parseLocalized(raw: string): Record<string, string> {
  if (!raw) return {};
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return {};
  try {
    const obj = JSON.parse(raw.slice(start, end + 1));
    if (!obj || typeof obj !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) if (typeof v === 'string') out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/**
 * Oversett gitt id→tekst-map til `langLabel`. Returnerer id→oversatt (mangler
 * en id hvis modellen droppet den — kaller beholder da originalen).
 */
export async function aiLocalizeTexts(texts: { id: string; text: string }[], langLabel: string, onStep?: (s: string) => void): Promise<Record<string, string>> {
  if (!isAiConnected()) throw new Error('AI-proxyen er ikke tilkoblet. Logg inn (RR-token) i Innstillinger.');
  const items = texts.filter((t) => t.text.trim());
  if (items.length === 0) return {};
  onStep?.('Oversetter…');
  const input: Record<string, string> = {};
  items.forEach((t) => { input[t.id] = t.text; });
  const prompt =
    `Oversett verdiene i denne JSON-en til ${langLabel}. Behold NØKLENE uendret. ` +
    `Behold merkevarenavn/produktnavn uoversatt. Naturlig, markedsførings-tone, samme lengde-nivå.\n\n` +
    `${JSON.stringify(input)}\n\n` +
    `Svar med KUN JSON-objektet (samme nøkler, oversatte verdier), ingen forklaring, ingen code-fence.`;
  const raw = await claudeProxyService.send({
    systemPrompt: 'Du er en profesjonell app-lokaliserings-oversetter. Du svarer ALLTID med kun et gyldig JSON-objekt med samme nøkler som input.',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    maxTokens: 900,
  });
  onStep?.('Ferdig');
  return parseLocalized(raw);
}
