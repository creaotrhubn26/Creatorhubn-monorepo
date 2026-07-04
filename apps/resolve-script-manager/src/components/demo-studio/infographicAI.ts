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
const USAGE_KEY = 'trrpa.infographicStudio.templateUsage';
// `weight`: eksplisitt 👍/👎 = 1, IMPLISITTE atferds-signaler (brukte/byttet
// bort) = 0.5 — svakere, men de kommer helt uten klikk og løser kaldstart.
interface AiFeedback { desc: string; tplId: string; liked: boolean; weight: number; ts: number }

function loadFeedback(): AiFeedback[] {
  try { const raw = localStorage.getItem(LEARN_KEY); return raw ? (JSON.parse(raw) as AiFeedback[]) : []; }
  catch { return []; }
}
function saveFeedback(list: AiFeedback[]): void {
  try { localStorage.setItem(LEARN_KEY, JSON.stringify(list.slice(-400))); } catch { /* */ }
}

/** Registrer aksept/avvisning av en AI-anbefaling. `weight` < 1 for implisitte
 *  signaler. Kalles fra 👍/👎 (eksplisitt) OG fra atferd (brukt/byttet — implisitt). */
export function recordAiFeedback(desc: string, tplId: string, liked: boolean, weight = 1): void {
  if (!tplId) return;
  const list = loadFeedback();
  list.push({ desc: desc.trim().slice(0, 200), tplId, liked, weight, ts: Date.now() });
  saveFeedback(list);
}

// ── Bruks-historikk (warm start): systemet lærer av det du FAKTISK bruker, ikke
//    bare av tomler. Bygges av recordTemplateUsage ved hver render/eksport. ──
function loadUsage(): Record<string, number> {
  try { const raw = localStorage.getItem(USAGE_KEY); return raw ? (JSON.parse(raw) as Record<string, number>) : {}; }
  catch { return {}; }
}
/** Tell at en mal ble brukt (rendret/sendt/eksportert) — en sterk implisitt
 *  smak-indikator som finnes helt uten AI-input eller tomler. */
export function recordTemplateUsage(tplId: string): void {
  if (!tplId) return;
  const u = loadUsage(); u[tplId] = (u[tplId] || 0) + 1;
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch { /* */ }
}

/** Netto aksept-score per mal (vektet likt − mislikt). */
function acceptanceScores(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of loadFeedback()) out[f.tplId] = (out[f.tplId] || 0) + (f.liked ? f.weight : -f.weight);
  return out;
}

/** Antall lærte signaler (eksplisitte + implisitte + brukshistorikk) for UI. */
export function aiFeedbackCount(): number {
  const usage = Object.values(loadUsage()).reduce((a, b) => a + b, 0);
  return loadFeedback().length + usage;
}

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
  const usage = loadUsage();
  // Score = tekst-match + aksept-boost + log-skalert bruks-prior (maler du
  // faktisk bruker løftes, uten at tunge favoritter drukner alt).
  const scored = templates.map((t) => ({
    t,
    s: scoreTemplate(desc, t) + Math.max(0, accept[t.id] || 0) * 0.5 + Math.min(2, Math.log2(1 + (usage[t.id] || 0))),
  }));
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
 * Hent en nettsides logo (ekstern URL) som data-URL så den EMBEDDES i malen
 * (overlever eksport + offline). Best-effort — faller tilbake til den eksterne
 * URL-en (som fungerer online i preview + Playwright-render) ved CORS/feil.
 */
export async function logoToDataUrl(logoUrl: string): Promise<string> {
  if (!logoUrl || logoUrl.startsWith('data:')) return logoUrl;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return logoUrl;
    const blob = await res.blob();
    if (blob.size === 0 || blob.size > 2_000_000) return logoUrl; // urimelig stor → behold URL
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : logoUrl);
      fr.onerror = () => resolve(logoUrl);
      fr.readAsDataURL(blob);
    });
  } catch { return logoUrl; }
}

/**
 * «Fra nettside»: velg beste mal og fyll den med EKTE data hentet fra siden
 * (firmanavn, nøkkeltall, tagline). Logo + merkefarge håndteres av kalleren
 * (fra skannets branding). Bruker sidens tekst som grunnlag for både kandidat-
 * filtrering og utfylling.
 */
export interface SiteEvidence {
  summary?: string;
  features?: Array<{ name: string; solves?: string }>;
  proof?: Array<{ claim: string; type?: string }>;
}

export async function aiInfographicFromSite(params: {
  siteText: string;
  brandName?: string;
  elementLabels?: string[];
  /** Strukturert produkt/tjeneste-forståelse (analyzeProductEvidence) — gir
   *  mye bedre utfylling enn rå sidetekst alene. */
  evidence?: SiteEvidence;
  templates: InfographicTemplate[];
}): Promise<AiPickResult> {
  const { siteText, brandName, elementLabels = [], evidence, templates } = params;
  // Kandidat-scoring: merkenavn + funksjonsnavn + markante ord fra siden.
  const featWords = (evidence?.features || []).map((f) => f.name).join(' ');
  const scoringDesc = `${brandName || ''} ${featWords} ${elementLabels.slice(0, 20).join(' ')} ${siteText.slice(0, 400)}`;
  const cands = candidateTemplates(scoringDesc, templates);
  const catalog = cands.map((t) => ({
    id: t.id, name: t.name, desc: t.desc,
    fields: t.fields.map((f) => ({ key: f.key, label: f.label, ...(f.placeholder ? { eks: f.placeholder } : {}) })),
  }));
  // Strukturert produkt-blokk (fra analyzeProductEvidence) foran rå tekst.
  const evBlock = evidence ? [
    evidence.summary ? `Hva bedriften leverer: ${evidence.summary}` : '',
    evidence.features?.length ? `Tjenester/funksjoner:\n${evidence.features.slice(0, 10).map((f) => `- ${f.name}${f.solves ? ` (løser: ${f.solves})` : ''}`).join('\n')}` : '',
    evidence.proof?.length ? `Bevis/tall som STÅR på siden: ${evidence.proof.slice(0, 8).map((p) => p.claim).join(' · ')}` : '',
  ].filter(Boolean).join('\n') : '';
  const user = `Lag en infographic-overlay til en video BASERT PÅ denne bedriftens produkter/tjenester.
${brandName ? `Merkenavn: ${brandName}\n` : ''}${evBlock ? `${evBlock}\n\n` : ''}Knappe-/lenke-tekster: ${elementLabels.slice(0, 25).join(' · ') || '(ingen)'}
Synlig sidetekst (utdrag):
${siteText.slice(0, 1600)}

Velg den BESTE malen fra katalogen og fyll feltene med EKTE data om det bedriften
LEVERER: tjenester/funksjoner (som etiketter), firmanavn, faktiske tall/bevis fra
siden, tagline/verdiløfte. Ikke dikt opp tall som ikke står på siden — la heller
feltet stå tomt eller bruk en kvalitativ etikett. Bruk KUN felt-nøkler som finnes
i den valgte malen.

KATALOG:
${JSON.stringify(catalog)}

Svar med KUN dette JSON-objektet:
{"templateId": "<id>", "values": {"<feltnøkkel>": "<verdi>", ...}, "reason": "<kort>"}`;

  const raw = await claudeProxyService.send({
    systemPrompt: 'Du lager infographic-overlays fra nettsider. Du velger beste mal og fyller den med EKTE data fra siden (aldri oppdiktede tall). Du svarer ALLTID med kun ett JSON-objekt.',
    messages: [{ role: 'user', content: user }],
    maxTokens: 1000,
  });
  const parsed = extractJson(raw) as { templateId?: string; values?: Record<string, string>; reason?: string };
  const tpl = templates.find((t) => t.id === parsed.templateId) || cands[0];
  const validKeys = new Set(tpl.fields.map((f) => f.key));
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.values || {})) if (validKeys.has(k)) values[k] = String(v);
  return { tplId: tpl.id, values, reason: String(parsed.reason || '') };
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
