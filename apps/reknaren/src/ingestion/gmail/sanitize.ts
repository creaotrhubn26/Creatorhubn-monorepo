/**
 * Alt innhold fra e-post og vedlegg er UBETRODD data.
 * Tekst herfra skal aldri kunne endre systemprompter, starte verktøykall,
 * godkjenne transaksjoner eller endre regler. Dette laget:
 *  1. Flagger kjente prompt-injection-mønstre → dokumentet karanteneres.
 *  2. Nøytraliserer tekst før den evt. sendes til en AI-modell
 *     (innpakkes som data, aldri som instruksjon).
 */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|any|previous|prior|the above) (instructions|rules|prompts)/i,
  /disregard (your|all|previous) (instructions|training|rules)/i,
  /you are now\b/i,
  /new system prompt/i,
  /\bsystem\s*:\s*/i,
  /<\s*(system|assistant|tool_call|function_call)\b/i,
  /\[INST\]/i,
  /approve (this|the) (transaction|payment|invoice) automatically/i,
  /(bokfør|godkjenn|utbetal)\s+(automatisk|umiddelbart|uten kontroll)/i,
  /send (all|the) (emails?|data|documents?) to\b/i,
  /overstyr (regler|kontroll|godkjenning)/i,
];

export interface SanitizationResult {
  /** true = mistenkelig innhold funnet; dokumentet skal i karantene og manuell kø. */
  suspicious: boolean;
  matches: string[];
  /** Tekst trygg å vise/bruke som data (kontrolltegn fjernet, lengdebegrenset). */
  sanitizedText: string;
}

export function sanitizeUntrustedText(text: string, maxLength = 20_000): SanitizationResult {
  const matches: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    const m = pattern.exec(text);
    if (m) matches.push(m[0]);
  }
  const sanitizedText = text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '') // kontrolltegn
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '') // retningsoverstyring (RTL-triks)
    .slice(0, maxLength);
  return { suspicious: matches.length > 0, matches, sanitizedText };
}

/**
 * Pakker ubetrodd tekst for bruk som DATA i en AI-forespørsel.
 * Modellen instrueres alltid separat om at innholdet ikke er instruksjoner.
 */
export function wrapAsUntrustedData(text: string): string {
  const { sanitizedText } = sanitizeUntrustedText(text);
  return `<untrusted_document_content>\n${sanitizedText}\n</untrusted_document_content>`;
}
