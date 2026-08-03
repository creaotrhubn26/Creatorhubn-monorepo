/**
 * mockupAiIllustrate.ts — AI-illustrasjon: produktskjerm → ferdige callouts.
 *
 * Neste nivå av illustrasjons-laget: i stedet for å plassere callouts manuelt,
 * ser Claude (vision, via claudeProxyService — samme RR-proxy som resten) på den
 * FAKTISKE produktskjermen i mockupen, finner de viktigste UI-regionene, skriver
 * en kort funksjonstekst for hver, og markerer den viktigste for zoom-lupe. Alt
 * materialiseres som ekte, redigerbare MockupAnnotation-er.
 *
 * Krever tilkoblet AI-proxy (RR-token). Materialiseringen (annotationsFrom
 * Suggestions) er ren/deterministisk og testbar uten AI.
 */

import { claudeProxyService, isAiConnected, type ClaudeContentBlock } from '../../services/claudeProxyService';
import {
  makeAnnotation,
  type MockupDoc,
  type MockupDeviceSlot,
  type MockupAnnotation,
  type MockupCalloutSide,
} from './mockupStudioModel';
import { aiDraftOnePager } from './mockupAiDraft';

/** Ett callout-forslag fra AI: posisjon (0..1 i skjermbildet) + funksjonstekst. */
export interface CalloutSuggestion {
  fx: number;
  fy: number;
  label: string;
  loupe?: boolean;
}
export interface IllustrateSuggestions {
  callouts: CalloutSuggestion[];
  marker?: { fx: number; fy: number; fw: number; fh: number };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Velg etikett-side ut fra ankerposisjon. Kun ytterkantene → venstre/høyre; det
 *  midtre feltet går topp/bunn — det sprer chip-ene og unngår stabling på kanten. */
function sideFor(fx: number, fy: number): MockupCalloutSide {
  if (fx <= 0.28) return 'left';
  if (fx >= 0.72) return 'right';
  return fy <= 0.5 ? 'top' : 'bottom';
}

/**
 * Ren materialisering: gjør AI-forslag om til ekte annotasjoner festet til en
 * enhets skjerm. Deterministisk (testbar uten AI).
 */
export function annotationsFromSuggestions(sug: IllustrateSuggestions, deviceId: string | undefined): MockupAnnotation[] {
  const out: MockupAnnotation[] = [];
  const callouts = (sug.callouts ?? []).filter((c) => c && c.label && c.label.trim()).slice(0, 5);

  if (sug.marker && Number.isFinite(sug.marker.fx)) {
    out.push({
      ...makeAnnotation('marker', deviceId),
      fx: clamp01(sug.marker.fx), fy: clamp01(sug.marker.fy),
      fw: clamp01(sug.marker.fw || 0.2), fh: clamp01(sug.marker.fh || 0.12),
    });
  }

  let loupeAnchor: CalloutSuggestion | null = null;
  callouts.forEach((c, i) => {
    const fx = clamp01(c.fx), fy = clamp01(c.fy);
    out.push({
      ...makeAnnotation('callout', deviceId, i + 1),
      fx, fy, label: c.label.trim().slice(0, 40), side: sideFor(fx, fy),
    });
    if (c.loupe && !loupeAnchor) loupeAnchor = c;
  });
  // Ingen eksplisitt lupe? Bruk første callout som fokus.
  const lp = loupeAnchor ?? callouts[0];
  if (lp) {
    out.push({
      ...makeAnnotation('loupe', deviceId),
      fx: clamp01(lp.fx), fy: clamp01(lp.fy), zoom: 2.6,
    });
  }
  return out;
}

/** Velg enheten å annotere: største skjerm med et faktisk skjermbilde. */
function pickDevice(doc: MockupDoc): MockupDeviceSlot | undefined {
  const withImg = doc.devices.filter((d) => d.image);
  const pref = ['macbook', 'ipad_landscape', 'ipad', 'iphone', 'watch'];
  return withImg.slice().sort((a, b) => pref.indexOf(a.variant) - pref.indexOf(b.variant))[0] ?? doc.devices[0];
}

function imageBlock(dataUrl: string): ClaudeContentBlock | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return null;
  const media_type: 'image/png' | 'image/jpeg' = m[1] === 'image/png' ? 'image/png' : 'image/jpeg';
  return { type: 'image', source: { type: 'base64', media_type, data: m[2] } };
}

function extractJson<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '');
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(cleaned.slice(s, e + 1)) as T; } catch { return null; }
}

export function aiIllustrateAvailable(): boolean {
  return isAiConnected();
}

/**
 * Be Claude finne callouts for produktskjermen i `doc`. Returnerer ferdige
 * annotasjoner (callouts + lupe + evt. markør) festet til riktig enhet.
 * `context` = valgfritt tekstutdrag fra nettsiden (for bedre funksjonstekst).
 */
export async function aiIllustrate(doc: MockupDoc, context?: string, onStep?: (s: string) => void): Promise<MockupAnnotation[]> {
  if (!isAiConnected()) {
    throw new Error('AI-proxyen er ikke tilkoblet. Logg inn (RR-token) i Innstillinger.');
  }
  const dev = pickDevice(doc);
  if (!dev || !dev.image) {
    throw new Error('Legg inn en produktskjerm i en enhet først (last opp eller «Fra nettside»).');
  }

  onStep?.('Analyserer produktskjermen…');
  const prompt =
    `Du ser et SKJERMBILDE av et produkts brukergrensesnitt. Finn de 3–4 VIKTIGSTE ` +
    `UI-regionene å fremheve i en markedsførings-illustrasjon (f.eks. hovednavigasjon, ` +
    `en nøkkelknapp, et viktig tall/kolonne). For hver: posisjon som fx,fy (0..1, der 0,0 ` +
    `er øverst venstre av bildet) og en KORT norsk funksjonstekst (maks 24 tegn) skrevet ` +
    `ut fra hva produktet gjør. Merk den ENE viktigste med "loupe": true.` +
    (context && context.trim() ? `\n\nKONTEKST om produktet (for bedre tekst):\n${context.slice(0, 1500)}` : '') +
    `\n\nSvar med KUN ett JSON-objekt (ingen forklaring, ingen code-fence):\n` +
    `{ "callouts": [ { "fx": 0.0, "fy": 0.0, "label": "<tekst>", "loupe": false } ], ` +
    `"marker": { "fx": 0.0, "fy": 0.0, "fw": 0.2, "fh": 0.12 } }`;

  const content: ClaudeContentBlock[] = [];
  const b = imageBlock(dev.image);
  if (b) content.push(b);
  content.push({ type: 'text', text: prompt });

  const raw = await claudeProxyService.send({
    systemPrompt: 'Du analyserer produkt-UI fra skjermbilder og foreslår presise callouts for en markedsførings-illustrasjon. Vær nøyaktig med posisjoner. Svar ALLTID med kun ett gyldig JSON-objekt.',
    messages: [{ role: 'user', content }],
    maxTokens: 600,
  });
  const parsed = extractJson<IllustrateSuggestions>(raw);
  if (!parsed || !Array.isArray(parsed.callouts) || parsed.callouts.length === 0) {
    throw new Error('AI-svaret kunne ikke tolkes som callouts.');
  }
  onStep?.('Ferdig');
  return annotationsFromSuggestions(parsed, dev.id);
}

/**
 * Full flyt: URL → ferdig, forklart produkt-illustrasjon i ETT steg.
 * Kjeder AI-utkast (henter skjermbilder, skriver hero-overskrift/ingress + setter
 * merkevare-accent + velger mal) → AI-illustrer (callouts + funksjonstekst + lupe
 * på produktskjermen). Illustrasjonen er best-effort: utkastet beholdes uansett.
 */
export async function aiComposeFromUrl(url: string, onStep?: (s: string) => void): Promise<MockupDoc> {
  if (!isAiConnected()) {
    throw new Error('AI-proxyen er ikke tilkoblet. Logg inn (RR-token) i Innstillinger.');
  }
  onStep?.('Lager one-pager fra URL…');
  const doc = await aiDraftOnePager(url, onStep);
  try {
    onStep?.('Illustrerer produktskjermen…');
    doc.annotations = await aiIllustrate(doc, undefined, onStep);
  } catch {
    // Callouts feilet (f.eks. ingen tydelig produktskjerm) — behold hero-utkastet.
  }
  onStep?.('Ferdig');
  return doc;
}
