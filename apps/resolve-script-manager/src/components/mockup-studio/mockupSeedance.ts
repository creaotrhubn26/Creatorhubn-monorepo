/**
 * mockupSeedance.ts — Seedance i2v-stasjon for Mockup Studio.
 *
 * Tar et bibliotek-/bilde-element (data-URL) → craveable animert klipp (mp4) via
 * `generateBrollClipFal` (server-side fal Seedance, Role Room-proxy — ingen lokal
 * Higgsfield-CLI/kreditter håndteres i frontend). Klippet er merkevare-konsistent
 * fordi start-framen ER det ekte produkt-fotoet.
 *
 * Ekte kjøring krever innlogget AI (RR-token) + kreditter. `aiAvailable()` gater.
 */
import { generateBrollClipFal, estimateBrollCredits, type BrollResolution } from '../../api';

export { aiAvailable } from './mockupAiDraft';

/** Kuraterte craveable prompts (mat-short-form-trender: cheese-pull, damp, POV, sizzle). */
export const SEEDANCE_PROMPTS: { id: string; label: string; prompt: string }[] = [
  { id: 'cheese-pull', label: 'Cheese-pull', prompt: 'extreme macro, a slice lifted from the pizza, long glossy mozzarella cheese pull stretching slowly, steam rising, warm appetizing light, shallow depth of field, slow motion, subtle camera push-in' },
  { id: 'steam', label: 'Damp/ovn', prompt: 'the pizza fresh from the oven, steam rising, crispy caramelized cheese edges glistening, warm golden light, gentle camera push-in, appetizing' },
  { id: 'pov', label: 'POV-løft', prompt: 'first person POV, a hand lifts a pizza slice toward camera, cheese trailing, cozy pizzeria bokeh, golden hour, slow motion' },
  { id: 'sizzle', label: 'Sizzle-macro', prompt: 'macro of chili oil and melted cheese glistening on the pizza, gentle sizzle, red spice sheen, moody warm bokeh, slow motion' },
];

/** Kreditt-estimat for et klipp (via delt fal-pricing). */
export function seedanceCreditEstimate(resolution: BrollResolution, durationSec: number): number {
  return estimateBrollCredits(resolution, durationSec);
}

/** Generér ett craveable klipp fra et bilde (data-URL) → mp4-sti. Kaster ved feil. */
export async function generateCraveClip(args: {
  imageDataUrl: string;
  promptId: string;
  durationSec?: number;
  resolution?: BrollResolution;
  refId: string; // bilde-element-id (brukes som scene-nøkkel serverside)
}): Promise<string> {
  const preset = SEEDANCE_PROMPTS.find((p) => p.id === args.promptId) ?? SEEDANCE_PROMPTS[0];
  const path = await generateBrollClipFal({
    projectId: 'mockup-studio',
    sceneId: args.refId,
    prompt: preset.prompt,
    imageDataUrl: args.imageDataUrl,
    durationSec: args.durationSec ?? 3,
    resolution: (args.resolution ?? '720p') as '480p' | '720p' | '1080p',
  });
  if (typeof path !== 'string' || !path) throw new Error('Seedance ga ingen klipp-sti (ikke innlogget / ingen kreditter?)');
  return path;
}
