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

import { claudeProxyService } from '../../services/claudeProxyService';
import { makeScene, viewportForDevice, type DemoScene, type ScriptMeta, type DemoType, type DemoDevice } from './demoStudioModel';

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

/** Trekk ut første JSON-objekt fra en Claude-respons (tåler kodeblokk-wrapping). */
function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as T; } catch { return null; }
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
export async function generateSceneScript(params: {
  url: string;
  demoType: DemoType;
  scene: DemoScene;
  meta: ScriptMeta;
}): Promise<GeneratedScript> {
  const { url, demoType, scene, meta } = params;
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

  const raw = await claudeProxyService.send({
    systemPrompt: SYSTEM,
    messages: [{ role: 'user', content: user }],
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
export async function fetchSiteContext(url: string): Promise<string> {
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

export interface FlowSceneDraft {
  title: string;
  device: DemoDevice;
  narration: string;
  visualInstruction: string;
  requiredAction: string;
  overlayText: string;
  duration: number;
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
}): Promise<DemoScene[]> {
  const { url, demoType, devices, meta, targetSeconds = 75, siteContext = '' } = params;
  const user = `Lag en komplett produktdemo-flow.

Produkt-URL: ${url}
Demo-type: ${demoType}
Tilgjengelige enheter: ${devices.join(', ')}
Tone: ${meta.tone} · Publikum: ${meta.audience} · Språk: ${meta.language} · Lengde: ${meta.length}
Ønsket total varighet: ~${targetSeconds} sekunder
${siteContext ? `\nKontekst fra nettsiden:\n${siteContext}\n` : ''}
Foreslå 5-7 scener som forteller en sammenhengende historie (intro → kjernefunksjon → bevis/verdi → CTA → outro).
Velg device per scene fra de tilgjengelige (bruk mobil for mobil-flyt hvis relevant).
Svar med KUN ett JSON-objekt:
{
  "scenes": [
    { "title": "...", "device": "macbook|ipad|iphone", "narration": "hva som sies",
      "visualInstruction": "hva som vises", "requiredAction": "hva som gjøres",
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

  return parsed.scenes.map((d, i) => {
    const device: DemoDevice = (['macbook', 'ipad', 'iphone'] as DemoDevice[]).includes(d.device) ? d.device : (devices[0] ?? 'macbook');
    const base = makeScene(i, device);
    return {
      ...base,
      title: d.title || `Scene ${i + 1}`,
      device,
      viewport: viewportForDevice(device),
      narration: d.narration || '',
      visualInstruction: d.visualInstruction || '',
      requiredAction: d.requiredAction || '',
      overlayText: d.overlayText || '',
      duration: typeof d.duration === 'number' && d.duration > 0 ? d.duration : 10,
      status: 'in_progress',
    };
  });
}
