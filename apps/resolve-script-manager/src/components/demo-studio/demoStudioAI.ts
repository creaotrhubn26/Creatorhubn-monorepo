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
import type { DemoScene, ScriptMeta, DemoType } from './demoStudioModel';

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
