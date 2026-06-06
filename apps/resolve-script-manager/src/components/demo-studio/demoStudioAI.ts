/**
 * demoStudioAI — AI-funksjoner for Script Builder (spec §5.2/§10.4/§10.5).
 * Bygger på claudeProxyService (Role Room Claude-proxy). To kjernefunksjoner:
 *
 *   - generateSceneScript: lag narration + visual instruction + required
 *     action for én scene, basert på URL/scene-tittel/device/audience/tone.
 *   - improveScript: omskriv ett felt (shorten/clarify/professional/CTA/…).
 *
 * Begge ber Claude svare i et stramt format vi kan parse robust. Ren modul
 * (ingen React) så den kan gjenbrukes + testes.
 */

import { claudeProxyService, type ClaudeContentBlock } from '../../services/claudeProxyService';
import { demoFetchSiteContext } from '../../api';
import { isCaptureAvailable } from '../../services/demoCaptureService';
import {
  makeScene, viewportForDevice, ACTION_META,
  type DemoScene, type ScriptMeta, type DemoType, type DemoDevice, type DemoActionType,
  type ResponsiveReport, type ResponsiveViewportResult, type ResponsiveStatus, type ResponsiveFix,
  classifyCta, describePosition, getLearnedTarget, getVoicePrefs,
  CHANNEL_PRESETS, FRAMEWORKS, FUNNEL_INTENT, FUNNEL_LABELS,
  type ScannedElement, type DirectorCritique, type CritiqueIssue, type CritiqueSeverity,
  type MarketingBrief, type MarketingChannel, type FunnelStage, type MarketingObjective,
  type ProductEvidence, type ProductBrain, type BrainNode, type BrainNodeKind,
  type VerificationStatus, type CoverageStep, type MarketingFramework,
} from './demoStudioModel';

export type ImproveAction =
  | 'shorten' | 'clarify' | 'professional' | 'human' | 'sales' | 'tutorial' | 'cta' | 'simplify';

export const IMPROVE_LABELS: Record<ImproveAction, string> = {
  shorten: 'Gjør kortere',
  clarify: 'Gjør tydeligere',
  professional: 'Mer profesjonell',
  human: 'Mer menneskelig',
  sales: 'Mer salgsorientert',
  tutorial: 'Mer tutorial-fokusert',
  cta: 'Legg til CTA',
  simplify: 'Forenkle språket',
};

export interface GeneratedScript {
  narration: string;
  visualInstruction: string;
  requiredAction: string;
  overlayText: string;
}

/** Trekk ut første JSON-objekt fra en Claude-respons. Tåler ```json-fences og
 *  omkringliggende prosa via balansert klammeparser (ikke grådig regex). */
function extractJson<T>(text: string): T | null {
  // 1) Strip ```json … ``` / ``` … ```-fences hvis de finnes.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fence ? fence[1] : text).trim();
  // 2) Prøv rett parse først.
  try { return JSON.parse(body) as T; } catch { /* fall through */ }
  // 3) Balansert klammeparser: finn første { … } med matchende dybde.
  const start = body.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) {
      try { return JSON.parse(body.slice(start, i + 1)) as T; } catch { return null; }
    } }
  }
  return null;
}

const SYSTEM = `Du er en erfaren manusforfatter for produktdemoer. Du skriver konsist,
naturlig norsk/engelsk manus som leses opp i en skjermopptak-demo. Du skiller
tydelig mellom HVA som sies (narration), HVA som vises (visual instruction) og
HVA brukeren gjør (required action). Du svarer ALLTID med kun ett JSON-objekt,
ingen forklaring rundt.`;

/**
 * Generer manus for én scene. Returnerer narration/visual/action/overlay.
 * Kaster hvis Claude-proxy feiler (caller viser feil i UI).
 */
/** Gjør en data-URL om til en Anthropic bilde-blokk (for vision). */
function imageBlock(dataUrl: string): ClaudeContentBlock | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return null;
  return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
}

const VALID_ACTIONS = Object.keys(ACTION_META) as DemoActionType[];
function clampRect(h: unknown): { x: number; y: number; w: number; h: number } {
  const r = (h && typeof h === 'object') ? h as Record<string, number> : {};
  const c = (n: unknown, f: number) => (typeof n === 'number' && n >= 0 && n <= 1 ? n : f);
  return { x: c(r.x, 0.4), y: c(r.y, 0.4), w: c(r.w, 0.2), h: c(r.h, 0.08) };
}

export interface FrameAnnotation { caption: string; overlayText: string; keyElements: string[] }

/** Vision auto-annotering: Claude ser scenens skjermbilde og foreslår caption,
 *  overlay-tekst og nøkkel-UI-elementer. */
export async function annotateFrame(params: { url: string; scene: DemoScene; screenshot: string }): Promise<FrameAnnotation> {
  const img = imageBlock(params.screenshot);
  if (!img) throw new Error('Mangler skjermbilde for annotering');
  const txt = `Du SER et skjermbilde av scenen «${params.scene.title}» (${params.scene.device}) fra ${params.url}. ` +
    `Auto-annotér frame-en: beskriv kort hva som vises, foreslå en kort overlay-tekst (maks 6 ord), og list nøkkel-UI-elementer du ser.\n` +
    `Svar med KUN ett JSON-objekt: { "caption": "...", "overlayText": "...", "keyElements": ["...", "..."] }`;
  const raw = await claudeProxyService.send({
    systemPrompt: 'Du auto-annoterer produktdemo-frames fra skjermbilder. Svar ALLTID med kun ett JSON-objekt.',
    messages: [{ role: 'user', content: [img, { type: 'text', text: txt }] }],
    maxTokens: 500,
  });
  const p = extractJson<FrameAnnotation>(raw);
  if (!p) throw new Error('Klarte ikke å tolke annoteringen');
  return { caption: p.caption || '', overlayText: p.overlayText || '', keyElements: Array.isArray(p.keyElements) ? p.keyElements.slice(0, 8) : [] };
}

/** OCR-/vision-hotspot-fallback: når DOM-scan ikke finner elementer, la Claude
 *  finne interaktive elementer (label + omtrentlig hotspot) fra skjermbildet. */
export async function ocrDetectElements(params: { screenshot: string }): Promise<ScannedElement[]> {
  const img = imageBlock(params.screenshot);
  if (!img) return [];
  const txt = `Du SER et skjermbilde. Finn de interaktive elementene (knapper, lenker, felt) du SER — dette er en OCR-/vision-fallback fordi DOM-scan ikke fant noe. ` +
    `For hvert element: label (synlig tekst), actionType (click/type/scroll), og hotspot (x,y,w,h i 0–1 av bildet).\n` +
    `Svar med KUN ett JSON-objekt: { "elements": [ { "label": "...", "actionType": "click", "hotspot": {"x":0.4,"y":0.3,"w":0.2,"h":0.08} } ] }`;
  const raw = await claudeProxyService.send({
    systemPrompt: 'Du er en OCR-/UI-deteksjons-motor. Svar ALLTID med kun ett JSON-objekt.',
    messages: [{ role: 'user', content: [img, { type: 'text', text: txt }] }],
    maxTokens: 900,
  });
  const p = extractJson<{ elements?: Array<{ label?: string; actionType?: string; hotspot?: unknown }> }>(raw);
  if (!p?.elements) return [];
  return p.elements
    .map((e) => ({
      selector: '',
      label: (e.label || '').trim(),
      tag: 'vision',
      actionType: VALID_ACTIONS.includes(e.actionType as DemoActionType) ? (e.actionType as DemoActionType) : 'click',
      belowFold: false,
      hotspot: clampRect(e.hotspot),
      ctaType: classifyCta((e.label || '')) ?? undefined,
    }))
    .filter((e) => e.label);
}

/** Vision-runtime-verifisering: bekreft at handlingen FAKTISK lyktes ved å se på
 *  et skjermbilde tatt etterpå (modal åpnet / state endret), ikke bare selector-match. */
export async function verifyOutcomeVision(params: { screenshot: string; expected: string }): Promise<{ success: boolean; reason: string }> {
  const img = imageBlock(params.screenshot);
  if (!img) return { success: false, reason: 'Mangler skjermbilde' };
  const txt = `Du SER et skjermbilde TATT ETTER en handling. Forventet utfall: «${params.expected}». ` +
    `Skjedde det forventede (f.eks. modal åpnet, riktig side, state endret)?\n` +
    `Svar med KUN ett JSON-objekt: { "success": true|false, "reason": "kort begrunnelse" }`;
  const raw = await claudeProxyService.send({
    systemPrompt: 'Du verifiserer utfall fra skjermbilder. Svar ALLTID med kun ett JSON-objekt.',
    messages: [{ role: 'user', content: [img, { type: 'text', text: txt }] }],
    maxTokens: 200,
  });
  const p = extractJson<{ success?: boolean; reason?: string }>(raw);
  return { success: !!p?.success, reason: p?.reason || '' };
}

/**
 * Vision-pass: la Claude «se» et skjermbilde og lese ut synlig tekst/påstander
 * — inkludert det som ligger i bilder, grafikk og hero-banner som DOM-scan
 * mister. Beriker konteksten til one-pager + Product Brain.
 */
export async function readScreenVision(params: { screenshot: string; url?: string }): Promise<string> {
  const img = imageBlock(params.screenshot);
  if (!img) return '';
  const txt = `Du SER et skjermbilde av en produktside${params.url ? ` (${params.url})` : ''}. ` +
    `Les ut ALL synlig tekst og budskap — inkludert overskrifter, verdiløfter, tall/bevis og tekst INNI bilder/grafikk/skjermbilder. ` +
    `Ta også med åpenbare visuelle elementer (skjermdumper av produktet, logoer). Ikke dikt opp noe som ikke vises. ` +
    `Svar med ren tekst, gruppert kort.`;
  const raw = await claudeProxyService.send({
    systemPrompt: 'Du leser produktsider fra skjermbilder og gjengir synlig tekst/budskap presist.',
    messages: [{ role: 'user', content: [img, { type: 'text', text: txt }] }],
    maxTokens: 900,
  });
  return (raw || '').trim();
}

/** Kvalitets-vurdering av et one-pager-utkast (score + svakheter + spørsmål). */
export interface OnePagerCritique {
  score: number;
  strengths: string[];
  weaknesses: string[];
  /** Spørsmål AI trenger svar på for å løfte utkastet (det siden ikke avslører). */
  questions: string[];
}
export async function critiqueOnePager(params: {
  onePager: string; evidence?: ProductEvidence; url?: string;
}): Promise<OnePagerCritique> {
  const { onePager, evidence, url } = params;
  const user = `Vurder dette one-pager-utkastet for et produkt${url ? ` (${url})` : ''} som grunnlag for en markedsføringsdemo.

UTKAST:
${onePager.slice(0, 3500)}
${evidence ? `\nVerifisert fra siden — funksjoner: ${evidence.features.map((f) => f.name).join(', ') || '—'} · bevis: ${evidence.proof.map((p) => p.claim).join(' · ') || '—'}\n` : ''}
Vurder: klarhet, konkret verdi, bevis-styrke, målgruppe-skarphet, CTA. Vær streng.
Svar med KUN ett JSON-objekt:
{ "score": 0-100, "strengths": ["..."], "weaknesses": ["..."], "questions": ["spørsmål om det siden ikke avslører (pris, kunder, differensiering, ROI)"] }`;
  const raw = await claudeProxyService.send({
    systemPrompt: MARKETING_SYSTEM, messages: [{ role: 'user', content: user }], maxTokens: 900,
  });
  const p = extractJson<Partial<OnePagerCritique>>(raw);
  const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 6) : [];
  const score = typeof p?.score === 'number' ? Math.max(0, Math.min(100, Math.round(p.score))) : 0;
  return { score, strengths: arr(p?.strengths), weaknesses: arr(p?.weaknesses), questions: arr(p?.questions) };
}

/** Skriv om one-pager-utkastet basert på kritikk + brukerens svar på spørsmål. */
export async function improveOnePager(params: {
  onePager: string; critique: OnePagerCritique; answers?: string; evidence?: ProductEvidence;
}): Promise<string> {
  const { onePager, critique, answers = '', evidence } = params;
  const user = `Forbedre dette one-pager-utkastet. Behold sann info, fyll hull, fjern svakheter.

NÅVÆRENDE UTKAST:
${onePager.slice(0, 3500)}

SVAKHETER Å FIKSE:
${critique.weaknesses.map((w) => `- ${w}`).join('\n') || '- (ingen oppgitt)'}
${answers.trim() ? `\nBRUKERENS SVAR (bruk disse til å fylle hull — ikke dikt opp annet):\n${answers.slice(0, 1500)}\n` : ''}${evidence ? `\nVerifiserbart fra siden: ${evidence.features.map((f) => f.name).join(', ')}${evidence.proof.length ? ` · bevis: ${evidence.proof.map((p) => p.claim).join(' · ')}` : ''}\n` : ''}
Behold «[mangler — fyll inn]» kun der vi fortsatt ikke vet. Svar med ren tekst (hele den forbedrede one-pageren).`;
  const raw = await claudeProxyService.send({
    systemPrompt: MARKETING_SYSTEM, messages: [{ role: 'user', content: user }], maxTokens: 1400,
  });
  return (raw || '').trim();
}

export async function generateSceneScript(params: {
  url: string;
  demoType: DemoType;
  scene: DemoScene;
  meta: ScriptMeta;
  /** Skjermbilde (data-URL) av scenen → Claude vision skriver presist det som vises. */
  screenshot?: string;
}): Promise<GeneratedScript> {
  const { url, demoType, scene, meta, screenshot } = params;
  const user = `Produkt-URL: ${url}
Demo-type: ${demoType}
Scene: "${scene.title}" (scene ${scene.index + 1}), enhet: ${scene.device}
Tone: ${meta.tone} · Publikum: ${meta.audience} · Språk: ${meta.language} · Lengde: ${meta.length}

Skriv manus for DENNE scenen. Svar med JSON:
{
  "narration": "hva som sies (1-3 setninger, ${meta.length})",
  "visualInstruction": "hva som vises/fokuseres på på skjermen",
  "requiredAction": "hva seeren/opptakeren skal gjøre (kort imperativ)",
  "overlayText": "kort tekst-overlay (maks 6 ord)"
}`;

  const img = screenshot ? imageBlock(screenshot) : null;
  const content: string | ClaudeContentBlock[] = img
    ? [img, { type: 'text', text: user }]
    : user;
  const raw = await claudeProxyService.send({
    systemPrompt: SYSTEM + (img ? ' Du SER et skjermbilde av denne scenen — beskriv presist det som faktisk vises på skjermen.' : ''),
    messages: [{ role: 'user', content }],
    maxTokens: 700,
  });
  const parsed = extractJson<GeneratedScript>(raw);
  if (!parsed) throw new Error('Klarte ikke å tolke AI-svaret');
  return {
    narration: parsed.narration ?? '',
    visualInstruction: parsed.visualInstruction ?? '',
    requiredAction: parsed.requiredAction ?? '',
    overlayText: parsed.overlayText ?? '',
  };
}

/** Forbedre ett tekstfelt (typisk narration) med en gitt handling. */
export async function improveScript(params: {
  text: string;
  action: ImproveAction;
  meta: ScriptMeta;
}): Promise<string> {
  const { text, action, meta } = params;
  if (!text.trim()) throw new Error('Ingen tekst å forbedre');
  const instruction: Record<ImproveAction, string> = {
    shorten: 'Gjør teksten kortere og strammere, behold kjernebudskapet.',
    clarify: 'Gjør teksten tydeligere og lettere å forstå.',
    professional: 'Gjør tonen mer profesjonell.',
    human: 'Gjør tonen varmere og mer menneskelig.',
    sales: 'Gjør teksten mer salgsorientert og overbevisende.',
    tutorial: 'Gjør teksten mer steg-for-steg / tutorial-fokusert.',
    cta: 'Legg til en tydelig oppfordring til handling (CTA) til slutt.',
    simplify: 'Forenkle språket — unngå sjargong.',
  };
  const raw = await claudeProxyService.send({
    systemPrompt: 'Du er en manus-redaktør. Du svarer KUN med den omskrevne teksten, ingen forklaring, ingen anførselstegn rundt.',
    messages: [{
      role: 'user',
      content: `Språk: ${meta.language}. Tone-mål: ${meta.tone}.\n${instruction[action]}\n\nTekst:\n${text}`,
    }],
    maxTokens: 500,
  });
  return raw.trim().replace(/^["']|["']$/g, '');
}

/**
 * Hent best-effort nettside-kontekst (tittel + synlig tekst) så AI Director
 * forstår HVA produktet faktisk er. Cross-origin/CORS kan blokkere fetch fra
 * en webapp; da returnerer vi tom kontekst og lar Director jobbe ut fra
 * URL + demo-type alene. (Best-effort, aldri fatal.)
 */
/** Vanlige markedssider å berike konteksten med (relativt til origin). */
const COMMON_MARKETING_PATHS = [
  '/pricing', '/priser', '/features', '/funksjoner', '/product', '/produkt',
  '/how-it-works', '/slik-fungerer-det', '/solutions', '/use-cases', '/about',
  '/om-oss', '/customers', '/case-studies', '/kunder',
];

/**
 * Fler-side-skann: hent forsiden + et utvalg vanlige markedssider (/pricing,
 * /features, /about …) og slå sammen til én rik kontekst. Gir mye bedre grunnlag
 * for one-pager + Product Brain enn bare forsiden. Sider som 404-er / er tomme
 * filtreres bort; duplikater (samme tekst) fjernes.
 */
export async function gatherSiteContext(url: string, opts?: { mainText?: string; maxPages?: number }): Promise<{ context: string; pages: string[] }> {
  const maxPages = opts?.maxPages ?? 5;
  let origin = '';
  try { origin = new URL(url).origin; } catch { origin = url.replace(/\/$/, ''); }
  const seen = new Set<string>();
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 160).toLowerCase();

  const sections: Array<{ path: string; text: string }> = [];
  const mainText = (opts?.mainText || '').trim() || await fetchSiteContext(url).catch(() => '');
  if (mainText) { sections.push({ path: 'Forside', text: mainText }); seen.add(norm(mainText)); }

  // Hent kandidat-sidene parallelt (hver med egen feilfangst).
  const candidates = COMMON_MARKETING_PATHS.map((p) => `${origin}${p}`);
  const fetched = await Promise.all(candidates.map(async (cand) => {
    const t = await fetchSiteContext(cand).catch(() => '');
    return { cand, t };
  }));
  for (const { cand, t } of fetched) {
    const text = (t || '').trim();
    if (text.length < 140) continue;            // tom / 404 / redirect-til-forside-stub
    const key = norm(text);
    if (seen.has(key)) continue;                // duplikat (typisk redirect til forside)
    seen.add(key);
    let path = cand; try { path = new URL(cand).pathname; } catch { /* */ }
    sections.push({ path, text: text.slice(0, 1400) });
    if (sections.length >= maxPages) break;
  }

  const context = sections.map((s) => `=== ${s.path} ===\n${s.text}`).join('\n\n');
  return { context, pages: sections.map((s) => s.path) };
}

export async function fetchSiteContext(url: string): Promise<string> {
  // Foretrekk native Tauri-fetch (reqwest, ingen CORS) — så AI-en faktisk
  // leser siden. Fall tilbake til browser-fetch (CORS-begrenset) i web-dev.
  if (isCaptureAvailable()) {
    try {
      const ctx = await demoFetchSiteContext(url);
      if (ctx && ctx.trim()) return ctx;
    } catch { /* fall tilbake til browser-fetch */ }
  }
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return '';
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? '';
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ?? '';
    // Strip tags → første ~1500 tegn synlig tekst.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500);
    return [title && `Tittel: ${title}`, desc && `Beskrivelse: ${desc}`, text && `Innhold: ${text}`]
      .filter(Boolean).join('\n');
  } catch {
    return '';
  }
}

/**
 * AI self-healing: når en scenes mål-element ikke lenger finnes (brutt selector),
 * la Claude velge elementet i dagens katalog som best matcher den opprinnelige
 * intensjonen. Returnerer katalog-indeks, eller null hvis ingen passer.
 */
export async function healTarget(params: {
  targetLabel?: string;
  actionType?: string;
  elements: ScannedElement[];
}): Promise<number | null> {
  const { targetLabel, actionType, elements } = params;
  if (!elements.length) return null;
  const catalog = elements.map((e, i) => `${i}: "${e.label}" [${e.tag}]`).join('\n');
  const user = `Mål-elementet for handlingen «${actionType || 'click'} ${targetLabel || ''}» ble ikke funnet (selector brutt). ` +
    `Velg elementet fra dagens katalog som BEST matcher den opprinnelige intensjonen.\nKatalog:\n${catalog}\n` +
    `Svar med KUN ett JSON-objekt: { "index": <tall, eller -1 hvis ingen passer> }`;
  const raw = await claudeProxyService.send({
    systemPrompt: 'Du reparerer brutte element-referanser i en produktdemo. Svar kun med JSON.',
    messages: [{ role: 'user', content: user }],
    maxTokens: 120,
  });
  const parsed = extractJson<{ index: number }>(raw);
  if (!parsed || typeof parsed.index !== 'number' || parsed.index < 0 || parsed.index >= elements.length) return null;
  return parsed.index;
}

/**
 * Director Critic: AI vurderer HELE demoen mot målet og gir en score (0–100) +
 * konkrete forbedringsforslag (pacing, hook, CTA, klarhet, dramaturgi). Gjør
 * AI-en fra «fyller felt» til «produserer en demo som konverterer».
 */
export async function runDirectorCritic(params: {
  url: string;
  demoType: DemoType;
  goal?: string;
  meta: ScriptMeta;
  scenes: DemoScene[];
}): Promise<DirectorCritique> {
  const { url, demoType, goal, meta, scenes } = params;
  const sceneList = scenes.map((s, i) => `${i}: "${s.title}" (${s.device}, ${s.duration}s) — manus: ${(s.narration || '(tomt)').slice(0, 90)} | handling: ${s.requiredAction || '(ingen)'}`).join('\n');
  const user = `Vurder denne produktdemoen kritisk som en erfaren creative director.

Produkt-URL: ${url}
Demo-type: ${demoType}
${goal ? `Konverteringsmål: ${goal}\n` : ''}Tone: ${meta.tone} · Publikum: ${meta.audience} · Lengde: ${meta.length}
Scener:
${sceneList}

Vurder: hook (de første sekundene), dramaturgi/rekkefølge, pacing/varighet, klarhet i manus, tydelig CTA mot målet, og om noe mangler/er overflødig.
Svar med KUN ett JSON-objekt:
{ "score": <0-100>, "summary": "1-2 setninger helhetsvurdering",
  "issues": [ { "severity": "high|medium|low", "area": "hook|pacing|cta|klarhet|dramaturgi|...", "message": "konkret forbedring", "sceneIndex": <tall eller utelat> } ] }`;
  const raw = await claudeProxyService.send({
    systemPrompt: 'Du er en knallhard, konstruktiv creative director for produktdemoer. Du svarer ALLTID med kun ett JSON-objekt.',
    messages: [{ role: 'user', content: user }],
    maxTokens: 1200,
  });
  const parsed = extractJson<{ score?: number; summary?: string; issues?: Array<Partial<CritiqueIssue>> }>(raw);
  if (!parsed) throw new Error('Klarte ikke å tolke Director Critic-svaret');
  const sev = (s: unknown): CritiqueSeverity => (s === 'high' || s === 'medium' || s === 'low' ? s : 'medium');
  return {
    score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0,
    summary: parsed.summary || '',
    issues: (parsed.issues || []).map((i) => ({
      severity: sev(i.severity),
      area: i.area || 'generelt',
      message: i.message || '',
      sceneIndex: typeof i.sceneIndex === 'number' ? i.sceneIndex : undefined,
    })).filter((i) => i.message),
  };
}

/** Oversett manus-linjer for voiceover (Resolve-stemmer er engelske). Beholder
 *  rekkefølge; faller tilbake til original ved feil. */
export async function translateForVoiceover(texts: string[], targetLang = 'engelsk'): Promise<string[]> {
  const clean = texts.filter((t) => t && t.trim());
  if (!clean.length) return texts;
  const user = `Oversett hver linje til ${targetLang} for naturlig opplesning (voiceover). Behold rekkefølge og antall linjer.\n` +
    `Linjer:\n${clean.map((t, i) => `${i}: ${t}`).join('\n')}\n` +
    `Svar med KUN ett JSON-objekt: { "lines": ["...", "..."] }`;
  const raw = await claudeProxyService.send({
    systemPrompt: 'Du oversetter manus for voiceover. Svar ALLTID med kun ett JSON-objekt.',
    messages: [{ role: 'user', content: user }],
    maxTokens: 1500,
  });
  const p = extractJson<{ lines: string[] }>(raw);
  return p?.lines && p.lines.length === clean.length ? p.lines : clean;
}

/** Conversational Director: tolk en naturlig-språk-kommando til én handling,
 *  eller still ETT oppklarings-spørsmål med valg når info mangler. */
export type CommandAction = 'generate' | 'complete' | 'voiceover' | 'responsive' | 'critic' | 'none';
export interface CommandResult {
  action: CommandAction;
  params: { voiceModel?: string; goal?: string; task?: string };
  clarify: { question: string; options: string[] } | null;
  reply: string;
}

export async function interpretCommand(params: {
  instruction: string;
  demoType: DemoType;
  sceneCount: number;
  hasNarration: boolean;
  answeredWith?: string;
}): Promise<CommandResult> {
  const user = `Bruker-instruks for Product Demo Studio: «${params.instruction}»` +
    (params.answeredWith ? `\nBrukerens svar på forrige oppklaring: «${params.answeredWith}»` : '') +
    `\nKontekst: demo-type=${params.demoType}, ${params.sceneCount} scener, manus ${params.hasNarration ? 'finnes' : 'mangler'}.\n` +
    `Tolk instruksen til ÉN handling. Mangler nødvendig info, still ETT oppklarings-spørsmål med valg i stedet for å gjette.\n` +
    `Actions: generate (generér hele demoen), complete (fyll hull i manus/target), voiceover (lag voiceover i Resolve — STØTTES KUN PÅ ENGELSK; krever VoiceModel «Female 1» eller «Male 1»), responsive (responsive check), critic (vurder demoen), none.\n` +
    `For voiceover UTEN spesifisert kjønn: returner clarify {question:"Vil du ha kvinne- eller mannsstemme? (voiceover støttes kun på engelsk)", options:["Female 1","Male 1"]}.\n` +
    `Svar med KUN ett JSON-objekt: { "action":"...", "params":{"voiceModel":"Female 1","goal":"...","task":"..."}, "clarify":{"question":"...","options":["...","..."]}|null, "reply":"kort bekreftelse på hva som gjøres" }`;
  const raw = await claudeProxyService.send({
    systemPrompt: 'Du er en kommando-tolk for Product Demo Studio. Still oppklaring når info mangler — ikke gjett. Svar ALLTID med kun ett JSON-objekt.',
    messages: [{ role: 'user', content: user }],
    maxTokens: 400,
  });
  const p = extractJson<Partial<CommandResult>>(raw);
  if (!p) return { action: 'none', params: {}, clarify: null, reply: 'Forsto ikke kommandoen.' };
  const valid: CommandAction[] = ['generate', 'complete', 'voiceover', 'responsive', 'critic', 'none'];
  return {
    action: valid.includes(p.action as CommandAction) ? (p.action as CommandAction) : 'none',
    params: p.params ?? {},
    clarify: p.clarify && p.clarify.question ? { question: p.clarify.question, options: Array.isArray(p.clarify.options) ? p.clarify.options.slice(0, 4) : [] } : null,
    reply: p.reply ?? '',
  };
}

/** Patch fra «AI fullfør demoen» — kun felt som skal fylles for én scene. */
export interface ScenePatch {
  index: number;
  narration?: string;
  requiredAction?: string;
  overlayText?: string;
  duration?: number;
  targetLabel?: string;
  actionType?: string;
  targetIndex?: number;
}

/**
 * «AI fullfør demoen»: fyll KUN manglende felt per scene (manus, target,
 * overlay, varighet), uten å endre det brukeren allerede har skrevet.
 * Returnerer patcher; caller anvender dem bare på tomme felt.
 */
export async function completeDemoFlow(params: {
  url: string;
  demoType: DemoType;
  meta: ScriptMeta;
  scenes: DemoScene[];
  elements?: ScannedElement[];
  siteContext?: string;
}): Promise<ScenePatch[]> {
  const { url, demoType, meta, scenes, elements = [], siteContext = '' } = params;
  const sceneSummary = scenes.map((s) => {
    const missing: string[] = [];
    if (!s.narration?.trim()) missing.push('narration');
    if (!s.overlayText?.trim()) missing.push('overlayText');
    if (!s.duration || s.duration <= 0) missing.push('duration');
    if (!s.targetLabel?.trim() && !s.targetSelector?.trim() && !s.hotspot) missing.push('target');
    return `${s.index}: "${s.title}" (${s.device}) — mangler: ${missing.length ? missing.join(', ') : 'ingenting'}`;
  }).join('\n');
  const catalog = elements.length
    ? `\nElement-katalog (for target):\n${elements.map((e, i) => `${i}: "${e.label}" [${e.tag}]`).join('\n')}\n`
    : '';
  const user = `Fullfør en EKSISTERENDE produktdemo ved å fylle KUN manglende felt per scene. Ikke endre felt som allerede har innhold.

Produkt-URL: ${url}
Demo-type: ${demoType}
Tone: ${meta.tone} · Publikum: ${meta.audience} · Språk: ${meta.language} · Lengde: ${meta.length}
${siteContext ? `\nKontekst fra nettsiden:\n${siteContext}\n` : ''}${catalog}
Scener (med hva som mangler):
${sceneSummary}

Gi patch kun for scener som mangler noe. For «target»: velg targetIndex fra katalogen når mulig (ellers targetLabel). Sett actionType når relevant.
Svar med KUN ett JSON-objekt:
{ "patches": [ { "index": 0, "narration": "...", "requiredAction": "...", "overlayText": "...", "duration": 10, "targetIndex": 3, "targetLabel": "...", "actionType": "click" } ] }`;

  const raw = await claudeProxyService.send({
    systemPrompt: SYSTEM + ' Du fyller KUN hull og bevarer eksisterende innhold.',
    messages: [{ role: 'user', content: user }],
    maxTokens: 2000,
  });
  const parsed = extractJson<{ patches: ScenePatch[] }>(raw);
  if (!parsed?.patches?.length) return [];
  return parsed.patches.filter((p) => typeof p.index === 'number');
}

/**
 * Responsive Check (§ sjekk siden i desktop/tablet/mobil). Vurderer hvordan
 * siden trolig oppfører seg per viewport og foreslår KONKRETE, anvendbare
 * fikser (f.eks. «start mobilscene etter 20% scroll»). Best-effort vurdering
 * basert på URL + site-kontekst + scene-flow; presis layout-måling kommer når
 * capture-laget (kontrollert webview) kan måle elementene direkte.
 */
export async function runResponsiveCheck(params: {
  url: string;
  demoType: DemoType;
  scenes: DemoScene[];
  siteContext?: string;
}): Promise<ResponsiveReport> {
  const { url, demoType, scenes, siteContext = '' } = params;
  const sceneList = scenes.map((s, i) => `${i}: "${s.title}" (${s.device})`).join(', ');
  const user = `Vurder hvordan nettsiden trolig fungerer på tre viewports og hvordan demoen bør tilpasses.

Produkt-URL: ${url}
Demo-type: ${demoType}
Scener (indeks: tittel (enhet)): ${sceneList}
${siteContext ? `\nKontekst fra nettsiden:\n${siteContext}\n` : ''}
Gi ÉN vurdering per viewport: desktop (macbook), tablet (ipad), mobile (iphone).
Hvis noe trolig er suboptimalt (f.eks. CTA-knapp lavt på mobil, tekst for tett,
elementer under fold), sett status "warning" og foreslå en konkret fiks.
Hvis alt trolig er greit: status "ok", message "All good", ingen fix.

Tillatte fix.kind:
- "start_scroll": start en scene etter å ha scrollet startScrollPct% ned (0-100). Sett sceneIndex (velg en scene med matchende enhet) + startScrollPct.
- "switch_device": bytt en scenes enhet. Sett sceneIndex + device.
- "set_format": endre eksport-format. Sett format ("16:9"|"9:16"|"1:1"|"4:5").

Svar med KUN ett JSON-objekt:
{
  "results": [
    { "device": "macbook|ipad|iphone", "status": "ok|warning|error",
      "message": "kort status (eng. ok: 'All good')",
      "recommendation": "klartekst-anbefaling (utelat ved ok)",
      "fix": { "kind": "...", "sceneIndex": 0, "startScrollPct": 20, "device": "iphone", "format": "9:16", "summary": "kort oppsummering av fiksen" } }
  ]
}`;

  const raw = await claudeProxyService.send({
    systemPrompt: 'Du er en UX/responsivitets-vurderer for produktdemoer. Du er konkret og konservativ — flagg kun reelle sannsynlige problemer. Du svarer ALLTID med kun ett JSON-objekt.',
    messages: [{ role: 'user', content: user }],
    maxTokens: 900,
  });
  const parsed = extractJson<{ results: Array<Partial<ResponsiveViewportResult> & { fix?: Partial<ResponsiveFix> }> }>(raw);
  if (!parsed?.results?.length) throw new Error('Klarte ikke å tolke Responsive Check-svaret');

  const devices: DemoDevice[] = ['macbook', 'ipad', 'iphone'];
  const norm = (d: unknown): DemoDevice => (devices.includes(d as DemoDevice) ? (d as DemoDevice) : 'macbook');
  const normStatus = (s: unknown): ResponsiveStatus => (s === 'warning' || s === 'error' ? s : 'ok');

  const results: ResponsiveViewportResult[] = parsed.results.map((r) => {
    const status = normStatus(r.status);
    let fix: ResponsiveFix | undefined;
    if (status !== 'ok' && r.fix?.kind && (r.fix.kind === 'start_scroll' || r.fix.kind === 'switch_device' || r.fix.kind === 'set_format')) {
      fix = {
        kind: r.fix.kind,
        sceneIndex: typeof r.fix.sceneIndex === 'number' ? r.fix.sceneIndex : undefined,
        startScrollPct: typeof r.fix.startScrollPct === 'number' ? Math.max(0, Math.min(100, r.fix.startScrollPct)) : undefined,
        device: r.fix.device ? norm(r.fix.device) : undefined,
        format: r.fix.format as ResponsiveFix['format'],
        summary: r.fix.summary || 'Anvend foreslått justering.',
      };
    }
    return {
      device: norm(r.device),
      status,
      message: r.message || (status === 'ok' ? 'All good' : 'Mulig problem'),
      recommendation: status === 'ok' ? undefined : r.recommendation,
      fix,
    };
  });

  return { results, createdAt: new Date().toISOString() };
}

export interface FlowSceneDraft {
  title: string;
  device: DemoDevice;
  narration: string;
  visualInstruction: string;
  requiredAction: string;
  overlayText: string;
  duration: number;
  /** Element handlingen gjelder, f.eks. «Start free trial button». */
  targetLabel?: string;
  /** Handlingstype (click/scroll/type/…). */
  actionType?: string;
  /** Omtrentlig hotspot i viewport-prosent (0–1) — Jan finjusterer i preview. */
  hotspot?: { x: number; y: number; w: number; h: number };
  /** Indeks inn i element-katalogen (DOM-skann) som handlingen gjelder. */
  targetIndex?: number;
}

/**
 * AI Director (§5.1): analyser nettsiden + demo-mål og foreslå en HEL
 * scene-flow med manus per scene. Resultatet mates inn i samme store og blir
 * redigerbart i Script Builder — så Director og Script Builder samarbeider om
 * samme scene-objekter.
 */
export async function generateDemoFlow(params: {
  url: string;
  demoType: DemoType;
  devices: DemoDevice[];
  meta: ScriptMeta;
  targetSeconds?: number;
  siteContext?: string;
  elements?: ScannedElement[];
  goal?: string;
  task?: string;
}): Promise<DemoScene[]> {
  const { url, demoType, devices, meta, targetSeconds = 75, siteContext = '', elements = [], goal = '', task = '' } = params;
  const catalog = elements.length
    ? `\nElement-katalog (ekte interaktive elementer på siden, med FAKTISK posisjon) — velg targetIndex per scene (prioriter CTA-er), og referer den ekte posisjonen i required action:\n${elements.map((e, i) => `${i}: "${e.label}" [${e.tag}${e.ctaType ? `, CTA:${e.ctaType}` : ''}${describePosition(e.hotspot) ? `, ${describePosition(e.hotspot)}` : ''}${e.belowFold ? ', under fold' : ''}]`).join('\n')}\n`
    : '';
  const user = `Lag en komplett produktdemo-flow.

Produkt-URL: ${url}
Demo-type: ${demoType}
Tilgjengelige enheter: ${devices.join(', ')}
Tone: ${meta.tone} · Publikum: ${meta.audience} · Språk: ${meta.language} · Lengde: ${meta.length}
${goal ? `KONVERTERINGSMÅL (optimaliser hele flowen + CTA mot dette): ${goal}\n` : ''}Ønsket total varighet: ~${targetSeconds} sekunder
${siteContext ? `\nKontekst fra nettsiden:\n${siteContext}\n` : ''}${catalog}
${task
  ? `OPPGAVE/PROSESS veiledningen skal vise STEG-FOR-STEG: «${task}». Lag én scene per faktiske steg i denne prosessen, i riktig rekkefølge, bundet til de riktige elementene (f.eks. innlogging: klikk «Logg inn» → fyll e-post → fyll passord → klikk «Send»). Ikke lag en generisk markedsdemo — følg prosessen.\n`
  : 'Foreslå 5-7 scener som forteller en sammenhengende historie (intro → kjernefunksjon → bevis/verdi → CTA → outro).'}
Velg device per scene fra de tilgjengelige (bruk mobil for mobil-flyt hvis relevant).
For hver scene: angi handlingstypen (actionType: click/hover/type/scroll/highlight/open_url/switch_device/zoom/wait).
${elements.length
  ? 'Velg targetIndex fra element-katalogen over for elementet handlingen gjelder (da blir hotspot presis). Hvis ingen passer, utelat targetIndex og gi targetLabel + omtrentlig hotspot i stedet.'
  : 'Angi hvilket konkret element handlingen gjelder (targetLabel) + et OMTRENTLIG hotspot (x,y,w,h i 0–1) der elementet trolig er — brukeren finjusterer selv.'}
Svar med KUN ett JSON-objekt:
{
  "scenes": [
    { "title": "...", "device": "macbook|ipad|iphone", "narration": "hva som sies",
      "visualInstruction": "hva som vises", "requiredAction": "hva som gjøres",
      "targetIndex": 3, "targetLabel": "konkret element", "actionType": "click",
      "hotspot": { "x": 0.4, "y": 0.6, "w": 0.2, "h": 0.08 },
      "overlayText": "kort overlay", "duration": 10 }
  ]
}`;

  const raw = await claudeProxyService.send({
    systemPrompt: SYSTEM + ' Du designer hele demo-flowen — dramaturgi, rekkefølge og device-valg.',
    messages: [{ role: 'user', content: user }],
    maxTokens: 2000,
  });
  const parsed = extractJson<{ scenes: FlowSceneDraft[] }>(raw);
  if (!parsed?.scenes?.length) throw new Error('Klarte ikke å tolke flow fra AI');
  return buildScenesFromDrafts(parsed.scenes, { url, devices, elements });
}

/**
 * Felles scene-bygger: gjør AI-utkast (FlowSceneDraft) om til DemoScene med
 * element-binding, menneske-loop-korreksjoner (A) og bindingConfidence (C).
 * Delt mellom generateDemoFlow og generateMarketingFlow.
 */
export function buildScenesFromDrafts(
  drafts: FlowSceneDraft[],
  ctx: { url: string; devices: DemoDevice[]; elements: ScannedElement[] },
): DemoScene[] {
  const { url, devices, elements } = ctx;
  const clamp01 = (n: unknown, fallback: number) => (typeof n === 'number' && n >= 0 && n <= 1 ? n : fallback);
  const validActions = Object.keys(ACTION_META) as DemoActionType[];

  return drafts.map((d, i) => {
    const device: DemoDevice = (['macbook', 'ipad', 'iphone'] as DemoDevice[]).includes(d.device) ? d.device : (devices[0] ?? 'macbook');
    const base = makeScene(i, device);
    let actionType = validActions.includes(d.actionType as DemoActionType) ? (d.actionType as DemoActionType) : undefined;
    const hs = d.hotspot;
    let hotspot = hs && typeof hs === 'object'
      ? { x: clamp01(hs.x, 0.4), y: clamp01(hs.y, 0.5), w: clamp01(hs.w, 0.2), h: clamp01(hs.h, 0.08) }
      : undefined;
    let targetLabel = d.targetLabel || undefined;
    let targetSelector: string | undefined;
    let targetLocators: typeof elements[number]['locators'] | undefined;
    // Bind til EKTE element fra katalogen når AI valgte en gyldig targetIndex.
    const picked = typeof d.targetIndex === 'number' ? elements[d.targetIndex] : undefined;
    let boundToReal = false;
    // En lært korreksjon kan ha avvist nettopp dette elementet (negativ læring).
    const preLearned = getLearnedTarget(url, picked?.label || targetLabel || '');
    const rejected = picked && preLearned?.rejectSelectors?.includes(picked.selector);
    if (picked && !rejected) {
      targetSelector = picked.selector;
      targetLabel = picked.label || targetLabel;
      hotspot = picked.hotspot;
      targetLocators = picked.locators;
      boundToReal = true;
      if (!actionType && validActions.includes(picked.actionType as DemoActionType)) actionType = picked.actionType as DemoActionType;
    }
    // Menneske-i-loopen: en korreksjon brukeren har lært AI-en for dette
    // elementet på denne siden VINNER over AI-ens (og katalogens) gjetting.
    const learned = getLearnedTarget(url, targetLabel || '');
    if (learned) {
      if (learned.correctLabel) targetLabel = learned.correctLabel;       // label-retting (A)
      if (learned.hotspot) { hotspot = learned.hotspot; boundToReal = true; }
      if (learned.selector) targetSelector = learned.selector;
      if (learned.actionType) actionType = learned.actionType;            // action-type-retting (A)
    }
    // Konfidens for aktiv læring (C): ekte/ lært binding = high; bare label+gjettet
    // hotspot = medium; ingenting håndfast = low (AI bør spørre brukeren).
    const bindingConfidence: 'high' | 'medium' | 'low' =
      boundToReal || learned ? 'high'
      : targetLabel && hotspot ? 'medium'
      : 'low';
    return {
      ...base,
      title: d.title || `Scene ${i + 1}`,
      device,
      viewport: viewportForDevice(device),
      narration: d.narration || '',
      visualInstruction: d.visualInstruction || '',
      requiredAction: d.requiredAction || '',
      targetLabel,
      targetSelector,
      targetLocators,
      ctaType: classifyCta(targetLabel || '') ?? undefined,
      bindingConfidence,
      actionType,
      hotspot,
      overlayText: d.overlayText || '',
      duration: typeof d.duration === 'number' && d.duration > 0 ? d.duration : 10,
      status: 'in_progress',
    };
  });
}

// ════════════════════════════════════════════════════════════════════
//  MARKETING MODE — AI som forstår markedsføreren + innholdsprodusenten
// ════════════════════════════════════════════════════════════════════

const MARKETING_SYSTEM = `Du er en erfaren vekst-/innholdsstrateg som lager
målrettede produktdemoer. Du tenker i persona, funnel-steg og kanal: hver scene
skal flytte ÉN målgruppe ETT steg videre, på kanalens språk. Du bruker
markedsførings-rammeverk (PAS/AIDA/BAB) for dramaturgi, åpner med en hook,
bygger mot bevis, og lander på én tydelig CTA matchet funnel-steget. Du svarer
ALLTID med kun ett JSON-objekt.`;

/** Manus-stemme læres over tid (G): injiser likte/mislikte eksempler i prompten. */
function voicePrefBlock(url: string): string {
  const p = getVoicePrefs(url);
  if (!p.liked.length && !p.disliked.length) return '';
  let s = '\nINNHOLDSPRODUSENTENS STEMME (lært av tidligere tilbakemelding) — etterlikn stil:\n';
  if (p.liked.length) s += `Likte formuleringer:\n${p.liked.slice(0, 6).map((t) => `+ ${t}`).join('\n')}\n`;
  if (p.disliked.length) s += `Unngå denne stilen:\n${p.disliked.slice(0, 6).map((t) => `- ${t}`).join('\n')}\n`;
  return s;
}

/** AI foreslår en marketing-brief fra nettsiden (persona, smerte, verdi, funnel). */
export async function suggestMarketingBrief(params: {
  url: string; siteContext?: string; elements?: ScannedElement[];
}): Promise<Partial<MarketingBrief>> {
  const { url, siteContext = '', elements = [] } = params;
  const elCatalog = elements.slice(0, 20).map((e) => `"${e.label}"${e.ctaType ? ` (CTA:${e.ctaType})` : ''}`).join(', ');
  const user = `Analyser produktet og foreslå en markedsførings-brief.

Produkt-URL: ${url}
${siteContext ? `Kontekst fra siden:\n${siteContext.slice(0, 1800)}\n` : ''}${elCatalog ? `Interaktive elementer: ${elCatalog}\n` : ''}
Foreslå:
- persona: den mest sannsynlige ideelle kunden (ICP), kort
- jobToBeDone: hva personaen prøver å oppnå
- painPoints: 2–4 konkrete smertepunkter
- valueProps: 2–4 verdiløfter produktet leverer
- proof: 0–3 bevis-elementer hvis synlig (tall, logoer, sitater)
- objection: største innvending som må slås
- objective: ett av "awareness" | "lead_gen" | "conversion" | "activation" | "retention" | "expansion" | "advocacy" (mest sannsynlig markedsføringsmål)
- funnelStage: "tofu" | "mofu" | "bofu" (mest relevant for en demo)
- desiredAction: ønsket handling

Svar med KUN ett JSON-objekt med disse feltene.`;
  const raw = await claudeProxyService.send({
    systemPrompt: MARKETING_SYSTEM, messages: [{ role: 'user', content: user }], maxTokens: 900,
  });
  const p = extractJson<Partial<MarketingBrief>>(raw);
  if (!p) return {};
  const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 4) : [];
  const stage: FunnelStage = (['tofu', 'mofu', 'bofu'] as FunnelStage[]).includes(p.funnelStage as FunnelStage) ? p.funnelStage as FunnelStage : 'mofu';
  const objectives: MarketingObjective[] = ['awareness', 'lead_gen', 'conversion', 'activation', 'retention', 'expansion', 'advocacy'];
  const objective = objectives.includes(p.objective as MarketingObjective) ? p.objective as MarketingObjective : undefined;
  return {
    persona: typeof p.persona === 'string' ? p.persona : '',
    jobToBeDone: typeof p.jobToBeDone === 'string' ? p.jobToBeDone : undefined,
    painPoints: arr(p.painPoints),
    valueProps: arr(p.valueProps),
    proof: arr(p.proof),
    objection: typeof p.objection === 'string' ? p.objection : undefined,
    objective,
    funnelStage: stage,
    desiredAction: typeof p.desiredAction === 'string' ? p.desiredAction : undefined,
  };
}

/**
 * Les produktet inn i et typet bevis-inventar (funksjoner/bevis/seksjoner), slik
 * at hver rammeverk-beat kan festes til en KONKRET del av produktet. Grunnlaget
 * for at metodene faktisk anvendes mot produktet — ikke generisk markedsprat.
 */
export async function analyzeProductEvidence(params: {
  url: string; siteContext?: string; elements?: ScannedElement[];
}): Promise<ProductEvidence> {
  const { url, siteContext = '', elements = [] } = params;
  const elCatalog = elements.slice(0, 30).map((e) => `"${e.label}"${e.ctaType ? ` (${e.ctaType})` : ''}`).join(', ');
  const user = `Les produktet og bygg et BEVIS-INVENTAR vi kan demonstrere.

Produkt-URL: ${url}
${siteContext ? `Sidens innhold:\n${siteContext.slice(0, 2400)}\n` : ''}${elCatalog ? `Interaktive elementer: ${elCatalog}\n` : ''}
Hent KUN det som faktisk finnes på siden (ikke dikt opp):
- summary: én setning om hva produktet er
- features: produktets konkrete funksjoner — name, solves (hvilken smerte), elementLabel (matchende element hvis noen)
- proof: bevis som STÅR på siden — claim + type ("metric"|"testimonial"|"logo"|"award"|"guarantee"|"other")
- sections: navngitte seksjoner/skjermer (Priser, Slik fungerer det, …) — label + purpose

Svar med KUN ett JSON-objekt: { "summary": "...", "features": [...], "proof": [...], "sections": [...] }`;
  const raw = await claudeProxyService.send({
    systemPrompt: MARKETING_SYSTEM, messages: [{ role: 'user', content: user }], maxTokens: 1400,
  });
  const p = extractJson<Partial<ProductEvidence>>(raw);
  const proofTypes = ['metric', 'testimonial', 'logo', 'award', 'guarantee', 'other'];
  return {
    summary: typeof p?.summary === 'string' ? p.summary : '',
    features: Array.isArray(p?.features) ? p!.features.filter((f) => f && typeof f.name === 'string').slice(0, 10).map((f) => ({ name: f.name, solves: typeof f.solves === 'string' ? f.solves : '', elementLabel: typeof f.elementLabel === 'string' ? f.elementLabel : undefined })) : [],
    proof: Array.isArray(p?.proof) ? p!.proof.filter((x) => x && typeof x.claim === 'string').slice(0, 8).map((x) => ({ claim: x.claim, type: proofTypes.includes(x.type as string) ? x.type : 'other' })) : [],
    sections: Array.isArray(p?.sections) ? p!.sections.filter((s) => s && typeof s.label === 'string').slice(0, 10).map((s) => ({ label: s.label, purpose: typeof s.purpose === 'string' ? s.purpose : '' })) : [],
  };
}

/** Render bevis-inventaret som et kompakt blokk til prompten. */
function evidenceBlock(ev?: ProductEvidence): string {
  if (!ev || (!ev.features.length && !ev.proof.length && !ev.sections.length)) return '';
  let s = '\nPRODUKT-BEVIS (fest hver beat til ETT konkret punkt herfra — navngi det i visualInstruction):\n';
  if (ev.summary) s += `Produkt: ${ev.summary}\n`;
  if (ev.features.length) s += `Funksjoner:\n${ev.features.map((f) => `  • ${f.name} — løser: ${f.solves}${f.elementLabel ? ` (element: "${f.elementLabel}")` : ''}`).join('\n')}\n`;
  if (ev.proof.length) s += `Bevis: ${ev.proof.map((p) => `${p.claim} [${p.type}]`).join(' · ')}\n`;
  if (ev.sections.length) s += `Seksjoner: ${ev.sections.map((x) => x.label).join(' · ')}\n`;
  return s;
}

/**
 * Ingen one-pager? Skriv et UTKAST fra det vi faktisk skanner live, så brukeren
 * har et grunnlag å redigere + bygge Product Brain fra. Bygger kun på funn fra
 * siden (ikke oppdiktet), og markerer åpenbare hull til brukeren.
 */
export async function draftOnePager(params: {
  url: string; siteContext?: string; elements?: ScannedElement[]; evidence?: ProductEvidence;
  branding?: { brandName?: string; brandColor?: string; logoUrl?: string };
}): Promise<string> {
  const { url, siteContext = '', elements = [], evidence, branding } = params;
  const elCatalog = elements.slice(0, 25).map((e) => `"${e.label}"${e.ctaType ? ` (${e.ctaType})` : ''}`).join(', ');
  const brandLine = branding && (branding.brandName || branding.brandColor || branding.logoUrl)
    ? `MERKEVARE (hentet fra siden — bruk det ekte navnet, ikke gjett): ${branding.brandName ? `navn «${branding.brandName}»` : 'navn ukjent'}${branding.brandColor ? `, merkefarge ${branding.brandColor}` : ''}${branding.logoUrl ? ', logo finnes' : ''}.\n`
    : '';
  const user = `Vi har INGEN one-pager. Skriv et kort utkast basert KUN på det vi fant på siden (ikke dikt opp tall/kunder).

Produkt-URL: ${url}
${brandLine}${evidence ? `Funksjoner: ${evidence.features.map((f) => `${f.name}${f.solves ? ` (løser ${f.solves})` : ''}`).join('; ') || '—'}\nBevis: ${evidence.proof.map((p) => p.claim).join(' · ') || '—'}\nSeksjoner: ${evidence.sections.map((s) => s.label).join(', ') || '—'}\n` : ''}${elCatalog ? `Klikkbare elementer: ${elCatalog}\n` : ''}${siteContext ? `Sidetekst (utdrag):\n${siteContext.slice(0, 2200)}\n` : ''}
Skriv en one-pager med tittel = produktets/merkevarens ekte navn, og overskrifter: Hva det er · For hvem · Problem · Funksjoner · Verdiløfter · Bevis · CTA.
Der noe mangler på siden (f.eks. ingen bevis/tall), skriv «[mangler — fyll inn]» så brukeren ser hullet.
Svar med ren tekst (ikke JSON).`;
  const raw = await claudeProxyService.send({
    systemPrompt: MARKETING_SYSTEM, messages: [{ role: 'user', content: user }], maxTokens: 1200,
  });
  return (raw || '').trim();
}

/**
 * PRODUCT BRAIN: parse en one-pager → kryssverifiser mot live-skann → dekningssti
 * + anbefalt mål/metode. Svarer på «hvordan henger systemet sammen, og stemmer
 * det one-pageren sier med det som faktisk finnes på siden?».
 */
export async function buildProductBrain(params: {
  url: string;
  onePager: string;
  siteContext?: string;
  elements?: ScannedElement[];
  evidence?: ProductEvidence;
  objective?: MarketingObjective;
}): Promise<ProductBrain> {
  const { url, onePager, siteContext = '', elements = [], evidence, objective } = params;
  const elCatalog = elements.slice(0, 30).map((e) => `"${e.label}"${e.ctaType ? ` (${e.ctaType})` : ''}`).join(', ');
  const frameworkList = (Object.keys(FRAMEWORKS) as MarketingFramework[]).map((k) => `${k}=${FRAMEWORKS[k].label.split(' (')[0]} (${FRAMEWORKS[k].bestFor})`).join('; ');
  const user = `Du får en ONE-PAGER om et produkt + det vi faktisk fant LIVE på nettsiden.
Bygg et "product brain": parse one-pageren, og KRYSSVERIFISER hver påstand mot det live-funnet.

ONE-PAGER:
${onePager.slice(0, 4000)}

LIVE PÅ SIDEN (${url}):
${evidence ? `Produkt: ${evidence.summary}\nFunksjoner: ${evidence.features.map((f) => f.name).join(', ') || '—'}\nBevis: ${evidence.proof.map((p) => p.claim).join(' · ') || '—'}\nSeksjoner: ${evidence.sections.map((s) => s.label).join(', ') || '—'}\n` : ''}${elCatalog ? `Klikkbare elementer: ${elCatalog}\n` : ''}${siteContext ? `Sidetekst (utdrag): ${siteContext.slice(0, 1200)}\n` : ''}
Oppgave:
1) Lag noder for produktets funksjoner/verdiløfter/bevis/CTA-er/målgrupper/integrasjoner fra one-pageren.
2) Sett status på hver node: "verified" (finnes live / har element), "unverified" (hevdet i one-pager, IKKE funnet live). Legg også til "extra"-noder for ting som finnes live men IKKE i one-pageren. Angi matchedOn (hva den matchet).
3) coveragePath: ordnet liste over hva man MÅ gjennom for å demonstrere produktet ende-til-ende (kun verifiserbare ting), hvert steg med elementLabel når mulig.
4) gaps: påstander i one-pageren vi ikke kan vise på siden.
5) Anbefal metode (recommendedFramework) + recommendedObjective + reasoning, basert på grafens form (mye bevis → proof-tung metode; svakt bevis men sterk transformasjon → BAB; ny kategori → jtbd). Tilgjengelige metoder: ${frameworkList}.
${objective ? `Brukerens valgte mål er "${objective}" — vurder om det passer, ellers foreslå bedre.\n` : ''}
Svar med KUN ett JSON-objekt:
{ "summary": "...", "nodes": [ { "kind": "feature|value|proof|cta|audience|integration", "text": "...", "status": "verified|unverified|extra", "matchedOn": "..." } ], "coveragePath": [ { "label": "...", "elementLabel": "..." } ], "gaps": ["..."], "recommendedObjective": "conversion", "recommendedFramework": "pastor", "reasoning": "..." }`;
  const raw = await claudeProxyService.send({
    systemPrompt: MARKETING_SYSTEM, messages: [{ role: 'user', content: user }], maxTokens: 2400,
  });
  const p = extractJson<Partial<ProductBrain>>(raw);
  const kinds: BrainNodeKind[] = ['feature', 'value', 'proof', 'cta', 'audience', 'integration'];
  const statuses: VerificationStatus[] = ['verified', 'unverified', 'extra'];
  const frameworks = Object.keys(FRAMEWORKS) as MarketingFramework[];
  const objectives: MarketingObjective[] = ['awareness', 'lead_gen', 'conversion', 'activation', 'retention', 'expansion', 'advocacy'];
  const nodes: BrainNode[] = Array.isArray(p?.nodes)
    ? p!.nodes.filter((n) => n && typeof n.text === 'string' && kinds.includes(n.kind as BrainNodeKind)).slice(0, 40).map((n) => ({
        kind: n.kind as BrainNodeKind,
        text: n.text,
        status: statuses.includes(n.status as VerificationStatus) ? n.status as VerificationStatus : 'unverified',
        matchedOn: typeof n.matchedOn === 'string' ? n.matchedOn : undefined,
      }))
    : [];
  const coveragePath: CoverageStep[] = Array.isArray(p?.coveragePath)
    ? p!.coveragePath.filter((s) => s && typeof s.label === 'string').slice(0, 20).map((s) => ({ label: s.label, elementLabel: typeof s.elementLabel === 'string' ? s.elementLabel : undefined }))
    : [];
  return {
    summary: typeof p?.summary === 'string' ? p.summary : '',
    nodes,
    coveragePath,
    gaps: Array.isArray(p?.gaps) ? p!.gaps.filter((g) => typeof g === 'string').slice(0, 12) : [],
    recommendedObjective: objectives.includes(p?.recommendedObjective as MarketingObjective) ? p!.recommendedObjective as MarketingObjective : undefined,
    recommendedFramework: frameworks.includes(p?.recommendedFramework as MarketingFramework) ? p!.recommendedFramework as MarketingFramework : 'pas',
    reasoning: typeof p?.reasoning === 'string' ? p.reasoning : '',
  };
}

/** Generer en MÅLRETTET marketing-flow: persona × funnel × kanal × rammeverk. */
export async function generateMarketingFlow(params: {
  url: string;
  brief: MarketingBrief;
  devices: DemoDevice[];
  elements?: ScannedElement[];
  siteContext?: string;
  meta?: ScriptMeta;
  evidence?: ProductEvidence;
  /** Verifisert dekningssti fra Product Brain — styrer rekkefølge/dekning. */
  coverageHint?: string[];
}): Promise<DemoScene[]> {
  const { url, brief, devices, elements = [], siteContext = '', evidence, coverageHint = [] } = params;
  const preset = CHANNEL_PRESETS[brief.channel];
  const framework = FRAMEWORKS[brief.framework || preset.framework];
  const funnel = FUNNEL_INTENT[brief.funnelStage];
  const catalog = elements.length
    ? `\nElement-katalog (ekte interaktive elementer, velg targetIndex pr. scene):\n${elements.map((e, i) => `${i}: "${e.label}" [${e.tag}${e.ctaType ? `, CTA:${e.ctaType}` : ''}${describePosition(e.hotspot) ? `, ${describePosition(e.hotspot)}` : ''}]`).join('\n')}\n`
    : '';
  const user = `Lag en målrettet markedsførings-demo.

Produkt-URL: ${url}
MÅLGRUPPE (persona): ${brief.persona || '(ikke spesifisert)'}
${brief.jobToBeDone ? `Jobben de prøver å gjøre: ${brief.jobToBeDone}\n` : ''}Smertepunkter: ${brief.painPoints.join(' · ') || '(ukjent)'}
Verdiløfter: ${brief.valueProps.join(' · ') || '(ukjent)'}
${brief.proof?.length ? `Bevis: ${brief.proof.join(' · ')}\n` : ''}${brief.objection ? `Innvending å slå: ${brief.objection}\n` : ''}
FUNNEL-STEG: ${FUNNEL_LABELS[brief.funnelStage]} → mål: ${funnel.goal}. CTA-energi: ${funnel.ctaHint}.
KANAL: ${preset.label} → ${preset.toneHint}. Total lengde ~${preset.maxSeconds}s, hook i de første ${preset.hookSeconds} sek.${preset.captions ? ' Skriv korte caption-vennlige linjer.' : ''}
RAMMEVERK: ${framework.label}. Følg disse beatene i rekkefølge, én eller flere scener per beat: ${framework.beats.join(' → ')}.
${coverageHint.length ? `\nVERIFISERT DEKNINGSSTI (Product Brain) — sørg for at demoen dekker disse stegene, i denne rekkefølgen, vevd inn i rammeverkets beats:\n${coverageHint.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n` : ''}${brief.desiredAction ? `ØNSKET HANDLING (siste CTA): ${brief.desiredAction}\n` : ''}${siteContext ? `\nKontekst fra siden:\n${siteContext.slice(0, 1500)}\n` : ''}${evidenceBlock(evidence)}${catalog}${voicePrefBlock(url)}
SLIK ANVENDES METODEN PÅ PRODUKTET (viktigst):
- Fest HVER beat til ÉN konkret produktdel fra PRODUKT-BEVIS over. Eksempel for ${framework.label}: ${framework.beats.map((b) => `«${b}»`).join(' → ')} skal hver vise en navngitt funksjon/bevis/seksjon — ikke generisk prat.
- «Bevis»-beats MÅ bruke et faktisk bevis (tall/testimonial/logo) som står på siden.
- «Løsning»/«Etter»/«Benefit»-beats MÅ vise den konkrete funksjonen som løser personaens smerte, og navigere til/markere det riktige elementet (targetIndex).
- I visualInstruction: skriv NØYAKTIG hvilken funksjon/seksjon/bevis som vises i scenen.
Krav:
- Åpne med en hook som treffer personaens smertepunkt (ikke generisk feature-intro).
- Hver scene: narration (det som sies, matchet personaen + kanalens tone), visualInstruction, requiredAction, og når relevant targetIndex/targetLabel + actionType + hotspot.
- Siste scene = tydelig CTA matchet funnel-steget.
- Total varighet ≈ ${preset.maxSeconds}s fordelt på scenene.

Svar med KUN ett JSON-objekt:
{ "scenes": [ { "title": "...", "device": "macbook|ipad|iphone", "narration": "...", "visualInstruction": "...", "requiredAction": "...", "targetIndex": 3, "targetLabel": "...", "actionType": "click", "hotspot": {"x":0.4,"y":0.6,"w":0.2,"h":0.08}, "overlayText": "...", "duration": 8 } ] }`;

  const raw = await claudeProxyService.send({
    systemPrompt: MARKETING_SYSTEM,
    messages: [{ role: 'user', content: user }],
    maxTokens: 2200,
  });
  const parsed = extractJson<{ scenes: FlowSceneDraft[] }>(raw);
  if (!parsed?.scenes?.length) throw new Error('Klarte ikke å tolke marketing-flow fra AI');
  return buildScenesFromDrafts(parsed.scenes, { url, devices, elements });
}

/** En målrettet variant-spesifikasjon (per persona / kanal / vinkel). */
export interface VariantSpec {
  label: string;
  channel?: MarketingChannel;
  persona?: string;
  /** Vinkel/hook-variasjon, f.eks. «ROI-vinkel» eller «tids-sparing». */
  angle?: string;
}
export interface GeneratedVariant {
  label: string;
  channel?: MarketingChannel;
  format?: string;
  scenes: DemoScene[];
}

/**
 * Variant-motor: ta en ferdig flow og lag målrettede kutt — omskriv manus,
 * overlay, hook og CTA (og juster varighet/format) per persona/kanal/vinkel.
 * Element-binding (target/hotspot) beholdes; kun budskapet endres.
 */
export async function generateVariants(params: {
  url: string;
  baseScenes: DemoScene[];
  brief: MarketingBrief;
  variants: VariantSpec[];
}): Promise<GeneratedVariant[]> {
  const { url, baseScenes, brief, variants } = params;
  const baseList = baseScenes.map((s, i) => `${i}: "${s.title}" — ${(s.narration || '').slice(0, 110)}${s.overlayText ? ` | overlay: ${s.overlayText}` : ''}`).join('\n');
  const out: GeneratedVariant[] = [];
  for (const v of variants) {
    const preset = v.channel ? CHANNEL_PRESETS[v.channel] : undefined;
    const user = `Lag en MÅLRETTET variant av denne demoen. Behold rekkefølge og antall scener, men skriv om manus + overlay så de treffer dette målet:

VARIANT: ${v.label}
${v.persona ? `Persona: ${v.persona}\n` : `Persona: ${brief.persona}\n`}${v.angle ? `Vinkel/hook: ${v.angle}\n` : ''}${preset ? `Kanal: ${preset.label} → ${preset.toneHint}. Hold linjene korte (~${preset.maxSeconds}s totalt).\n` : ''}${voicePrefBlock(url)}
Basis-scener:
${baseList}

Svar med KUN ett JSON-objekt: { "scenes": [ { "index": 0, "narration": "...", "overlayText": "...", "duration": 8 } ] } — én post per basis-scene (samme index).`;
    try {
      const raw = await claudeProxyService.send({
        systemPrompt: MARKETING_SYSTEM, messages: [{ role: 'user', content: user }], maxTokens: 1600,
      });
      const parsed = extractJson<{ scenes: Array<{ index: number; narration?: string; overlayText?: string; duration?: number }> }>(raw);
      const patchByIndex = new Map<number, { narration?: string; overlayText?: string; duration?: number }>();
      (parsed?.scenes || []).forEach((p) => { if (typeof p.index === 'number') patchByIndex.set(p.index, p); });
      const scenes: DemoScene[] = baseScenes.map((s, i) => {
        const p = patchByIndex.get(i);
        return {
          ...s,
          id: `${s.id}__${v.label.replace(/\s+/g, '-').toLowerCase()}`,
          narration: p?.narration?.trim() || s.narration,
          overlayText: p?.overlayText?.trim() ?? s.overlayText,
          duration: typeof p?.duration === 'number' && p.duration > 0 ? p.duration : s.duration,
        };
      });
      out.push({ label: v.label, channel: v.channel, format: preset?.format, scenes });
    } catch {
      // hopp over en variant som feiler — de andre leveres fortsatt
    }
  }
  return out;
}
