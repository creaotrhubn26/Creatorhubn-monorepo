/**
 * Fase 8f — referansebilde: bygger bildeprompten for `POST /api/storyboards/generate-frame`
 * fra scenekortet (Før/Handling/Miljø), lokasjonens profil (epoker, kontinuitet, rekvisitter)
 * og plattformmålets visuelle retning (lys, materialer, kamera, tåke). Ren TS, testbar.
 * Forfatterfasit (authorTruth) brukes ALDRI — den er intern og skal ikke ut i prompt-logger.
 */
export interface ScenePromptInput {
  scene: { code: string; title: string; era?: string | null; beforeState?: string; action?: string; environment?: string; location?: string; audio?: string };
  location?: { name: string; profile?: { eras?: string[]; continuity?: string; props?: string[]; summary?: string } } | null;
  visualDirection?: Record<string, unknown> | null;
  /** «Regel»-tekst fra prosjektet, f.eks. «ingen moderne gjenstander». */
  extraRules?: string[];
}

const ERA_LABEL: Record<string, string> = { pre: 'før 1797 (norsk bygd)', '1797': '1797, norsk bygd', '1802': '1802, norsk bygd', '1817': '1817, norsk bygd' };

const clip = (s: string | undefined | null, max: number): string => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

export const SCENE_PROMPT_MAX = 1400;

export function buildScenePrompt(input: ScenePromptInput): string {
  const { scene } = input;
  const parts: string[] = [];
  parts.push(`Referansebilde (konseptkunst, ikke endelig grafikk) for spillscene ${scene.code} «${clip(scene.title, 80)}».`);
  if (scene.era && ERA_LABEL[scene.era]) parts.push(`Epoke: ${ERA_LABEL[scene.era]}.`);
  const place = input.location?.name || scene.location;
  if (place) parts.push(`Sted: ${clip(place, 80)}.`);
  if (scene.beforeState) parts.push(`Utgangspunkt: ${clip(scene.beforeState, 220)}`);
  if (scene.action) parts.push(`Handling: ${clip(scene.action, 260)}`);
  if (scene.environment) parts.push(`Miljø: ${clip(scene.environment, 160)}`);
  const lp = input.location?.profile;
  if (lp?.continuity) parts.push(`Kontinuitet: ${clip(lp.continuity, 160)}`);
  if (lp?.props?.length) parts.push(`Rekvisitter som skal være synlige: ${lp.props.slice(0, 6).map((p) => clip(p, 40)).join(', ')}.`);
  const vd = input.visualDirection ?? {};
  const pick = (k: string, label: string, max: number) => { const v = vd[k]; if (typeof v === 'string' && v.trim()) parts.push(`${label}: ${clip(v, max)}`); };
  pick('lookAndFeel', 'Uttrykk', 160);
  pick('lighting', 'Lys', 140);
  pick('materials', 'Materialer', 120);
  pick('camera', 'Kamera', 120);
  pick('fog', 'Tåke', 100);
  for (const r of input.extraRules ?? []) parts.push(clip(r, 120));
  parts.push('Ingen tekst, logo eller vannmerke i bildet. Ingen moderne gjenstander.');
  let out = parts.filter(Boolean).join(' ');
  if (out.length > SCENE_PROMPT_MAX) out = `${out.slice(0, SCENE_PROMPT_MAX - 1).trimEnd()}…`;
  return out;
}
