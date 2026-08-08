/**
 * mockupAiEnhance.ts — AI-forbedringer på element-nivå (via samme RR-proxy).
 *
 * Copy-tone-varianter: gitt én tekst + rolle, be Claude om noen få omskrivinger
 * i ulike toner (kortere / mer selgende / roligere / mer konkret) som brukeren
 * kan velge mellom. Token-gated (krever innlogget AI); ren tolkning er testbar.
 */

import { claudeProxyService, isAiConnected } from '../../services/claudeProxyService';
import type { MockupTextRole } from './mockupStudioModel';

export function copyVariantsAvailable(): boolean {
  return isAiConnected();
}

/** Trekk ut en JSON-array av strenger fra et (muligens code-fence-innpakket) svar. */
export function parseVariants(raw: string): string[] {
  if (!raw) return [];
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    const arr = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x).trim()).filter((s) => s.length > 0).slice(0, 6);
  } catch {
    return [];
  }
}

const ROLE_HINT: Record<MockupTextRole, string> = {
  eyebrow: 'kort etikett (1-3 ord)',
  title: 'kraftig overskrift (maks ~40 tegn)',
  body: 'verdiløfte (1-2 setninger)',
  tag: 'CTA eller nettadresse (kort)',
};

/**
 * Be Claude om 4 tone-varianter av `text` for gitt rolle. Returnerer en liste
 * (kan være tom hvis AI ikke er tilkoblet eller svaret ikke lot seg tolke).
 */
export async function aiCopyVariants(text: string, role: MockupTextRole, onStep?: (s: string) => void): Promise<string[]> {
  if (!isAiConnected()) throw new Error('AI-proxyen er ikke tilkoblet. Logg inn (RR-token) i Innstillinger.');
  const clean = text.trim();
  if (!clean) return [];
  onStep?.('Skriver varianter…');
  const prompt =
    `Skriv om denne NORSKE ${ROLE_HINT[role]} i 4 ulike toner, samme betydning:\n` +
    `1) kortere/knappere, 2) mer selgende, 3) roligere/nøktern, 4) mer konkret/tallnær.\n\n` +
    `ORIGINAL:\n"${clean.slice(0, 400)}"\n\n` +
    `Svar med KUN en JSON-array av 4 strenger (ingen forklaring, ingen code-fence): ["…","…","…","…"]`;
  const raw = await claudeProxyService.send({
    systemPrompt: 'Du er en norsk tekstforfatter for salgsmateriell. Du skriver knapt og konkret. Svar ALLTID med kun en gyldig JSON-array av strenger.',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    maxTokens: 500,
  });
  onStep?.('Ferdig');
  return parseVariants(raw);
}
