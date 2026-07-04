// infographicAI — AI-assistert mal-valg + utfylling for Infographic Studio.
// «Beskriv det du vil ha» → Claude velger beste mal blant kandidatene og fyller
// feltene. Gjenbruker claudeProxyService (Post Agent anthropic-proxy).

import { claudeProxyService } from '../../services/claudeProxyService';
import type { InfographicTemplate } from './infographicStudio';

export interface AiPickResult {
  tplId: string;
  values: Record<string, string>;
  reason: string;
}

// ── Lærings-loop (in-context / retrieval, ikke nevralt trening) ──────────────
// Modellen er en LLM; «læring» her = å samle FEEDBACK-eksempler (beskrivelse →
// valgt mal, tommel opp/ned) og mate de aksepterte tilbake i prompten som
// few-shot-hint, PLUSS klient-side re-rangering av kandidater etter historisk
// aksept. Dette er samme mønster som demo-studioets lærte-targets, og er den
// riktige «ML»-en for en LLM-drevet klient (ingen modelltrening).
const LEARN_KEY = 'trrpa.infographicStudio.aiFeedback';
interface AiFeedback { desc: string; tplId: string; liked: boolean; ts: number }

function loadFeedback(): AiFeedback[] {
  try { const raw = localStorage.getItem(LEARN_KEY); return raw ? (JSON.parse(raw) as AiFeedback[]) : []; }
  catch { return []; }
}
function saveFeedback(list: AiFeedback[]): void {
  try { localStorage.setItem(LEARN_KEY, JSON.stringify(list.slice(-300))); } catch { /* */ }
}

/** Registrer at brukeren likte/mislikte en AI-anbefaling for en beskrivelse.
 *  Kalles fra 👍/👎 i UI. `ts` sendes inn (Date.now er utenfor rene moduler ok her). */
export function recordAiFeedback(desc: string, tplId: string, liked: boolean): void {
  const list = loadFeedback();
  list.push({ desc: desc.trim().slice(0, 200), tplId, liked, ts: Date.now() });
  saveFeedback(list);
}

/** Netto aksept-score per mal (likt − mislikt) — for re-rangering. */
function acceptanceScores(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of loadFeedback()) out[f.tplId] = (out[f.tplId] || 0) + (f.liked ? 1 : -1);
  return out;
}

/** Antall lærte eksempler (for UI-indikator). */
export function aiFeedbackCount(): number { return loadFeedback().length; }

/** Enkel token-scoring: hvor godt matcher beskrivelsen malens navn/desc/id.
 *  Brukes til å forhåndsfiltrere 512 maler → ~40 kandidater før Claude-kallet
 *  (holder prompten liten). */
function scoreTemplate(desc: string, t: InfographicTemplate): number {
  const words = desc.toLowerCase().split(/\W+/).filter((w) => w.length >= 3);
  const hay = `${t.name} ${t.desc} ${t.id}`.toLowerCase();
  let s = 0;
  for (const w of words) if (hay.includes(w)) s += 1;
  return s;
}

/** Velg ~N beste kandidat-maler for en beskrivelse (alltid minst N, fyller opp
 *  med et bredt tverrsnitt hvis for få matcher). Maler brukeren har akseptert
 *  før løftes (læring: historisk aksept → høyere rangering). */
export function candidateTemplates(desc: string, templates: InfographicTemplate[], n = 40): InfographicTemplate[] {
  const accept = acceptanceScores();
  const scored = templates.map((t) => ({ t, s: scoreTemplate(desc, t) + Math.max(0, accept[t.id] || 0) * 0.5 }));
  const hits = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.t);
  if (hits.length >= n) return hits.slice(0, n);
  // Fyll opp med et jevnt tverrsnitt av resten så Claude har bredde å velge fra.
  const rest = templates.filter((t) => !hits.includes(t));
  const step = Math.max(1, Math.floor(rest.length / (n - hits.length)));
  const filler: InfographicTemplate[] = [];
  for (let i = 0; i < rest.length && hits.length + filler.length < n; i += step) filler.push(rest[i]);
  return [...hits, ...filler];
}

/** Trekk ut ett JSON-objekt fra en rå AI-respons (tåler ```-fence/omkringtekst). */
function extractJson(raw: string): unknown {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : raw;
  const m = body.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Fant ikke JSON i AI-svaret');
  return JSON.parse(m[0]);
}

/**
 * AI velger beste mal + fyller felter fra en beskrivelse. Forhåndsfiltrerer
 * kandidater klient-side, sender kompakt katalog til Claude, validerer svaret.
 */
export async function aiPickTemplate(params: {
  description: string;
  templates: InfographicTemplate[];
}): Promise<AiPickResult> {
  const { description, templates } = params;
  const cands = candidateTemplates(description, templates);
  // Few-shot-læring: ta med tidligere AKSEPTERTE (beskrivelse → mal)-eksempler
  // så Claude etterligner brukerens smak. Nyeste 6, kun de som fortsatt finnes.
  const liked = loadFeedback().filter((f) => f.liked && templates.some((t) => t.id === f.tplId)).slice(-6);
  const examplesBlock = liked.length
    ? `\nBrukeren har tidligere vært fornøyd med disse valgene (etterlign smaken):\n${liked.map((f) => `- «${f.desc}» → ${f.tplId}`).join('\n')}\n`
    : '';
  const catalog = cands.map((t) => ({
    id: t.id,
    name: t.name,
    desc: t.desc,
    fields: t.fields.map((f) => ({ key: f.key, label: f.label, ...(f.placeholder ? { eks: f.placeholder } : {}) })),
  }));
  const user = `Brukeren vil lage en infographic-overlay til en video. Beskrivelse:
"${description}"

Velg den BESTE malen fra katalogen under, og fyll inn passende, konkrete verdier
for feltene basert på beskrivelsen (finn på realistiske tall/etiketter der det
trengs — kort og selger-vennlig). Bruk KUN felt-nøkler som finnes i den valgte malen.

KATALOG:
${JSON.stringify(catalog)}
${examplesBlock}
Svar med KUN dette JSON-objektet (ingen forklaring rundt):
{"templateId": "<id>", "values": {"<feltnøkkel>": "<verdi>", ...}, "reason": "<kort hvorfor>"}`;

  const raw = await claudeProxyService.send({
    systemPrompt: 'Du er en informasjonsdesigner som matcher en beskrivelse til den beste infographic-malen og fyller den med konkrete, korte verdier. Du svarer ALLTID med kun ett JSON-objekt.',
    messages: [{ role: 'user', content: user }],
    maxTokens: 900,
  });
  const parsed = extractJson(raw) as { templateId?: string; values?: Record<string, string>; reason?: string };
  const tpl = templates.find((t) => t.id === parsed.templateId) || cands[0];
  // Behold kun gyldige felt-nøkler for den valgte malen.
  const validKeys = new Set(tpl.fields.map((f) => f.key));
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.values || {})) if (validKeys.has(k)) values[k] = String(v);
  return { tplId: tpl.id, values, reason: String(parsed.reason || '') };
}
