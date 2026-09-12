/**
 * adFilmShots — regenerering av ETT enkelt storyboard-shot basert på
 * tilbakemelding. Samme mekanikk som Claude-Vision-QC-løkka i
 * cinematic_adfilm_engine.py: tilbakemeldingen blir en `fix_prompt` som
 * legges på shot-ets bilde-prompt, og KUN dette shot-et regenereres
 * (continuity-ref beholdes, resten av storyboardet røres ikke).
 */

import { invoke } from "@tauri-apps/api/core";

/** Forhåndsdefinerte problem-tagger → konkret fix-frase (matcher motorens direktiver). */
export interface RefineIssue {
  id: string;
  label: string;
  /** Legges på bilde-prompten ved regenerering. */
  fix: string;
}

export const REFINE_ISSUES: RefineIssue[] = [
  {
    id: "screen_to_camera",
    label: "Skjerm vendt mot kamera",
    fix: "Frame this as a genuine over-the-shoulder / POV shot — the user looks down at the device in natural use. Do NOT lift, rotate or angle the tablet toward the camera, and never present the screen to the viewer like a demo.",
  },
  {
    id: "reflection",
    label: "Refleksjon i skjermen",
    fix: "Make the screen a perfectly matte, non-reflective green plate: no reflection of the person or room, no window glare, no specular hotspots.",
  },
  {
    id: "scifi",
    label: "For sci-fi / hologram",
    fix: "Grounded and photorealistic — remove any holograms, floating UI or graphs, neon, HUD or glowing overlays. Real person, real physical device, natural light.",
  },
  {
    id: "composition",
    label: "Feil komposisjon",
    fix: "Recompose for a stronger, cleaner frame where the device is the hero.",
  },
  {
    id: "character",
    label: "Feil karakter / klær",
    fix: "Keep the exact same person, clothing and hair as the reference still.",
  },
  {
    id: "ui_illegible",
    label: "Uleselig / oppfunnet UI",
    fix: "The screen must be a clean, EMPTY green rectangle with no text or UI — the real interface is keyed in afterwards.",
  },
  { id: "too_dark", label: "For mørkt", fix: "Lift the exposure — brighter, clearer natural light on the subject." },
];

/** Bygg samlet fix-tekst fra valgte tagger + fritekst. */
export function composeFix(issueIds: string[], freeText: string): string {
  const parts = issueIds
    .map((id) => REFINE_ISSUES.find((i) => i.id === id)?.fix)
    .filter(Boolean) as string[];
  if (freeText.trim()) parts.push(freeText.trim());
  return parts.join(" ");
}

export interface ShotVariant {
  image_path: string;
  attempt: number;
}

export interface RegenerateShotParams {
  specPath: string;
  shotId: string;
  /** Samlet fix-prompt (fra composeFix). */
  fix: string;
}

/**
 * Regenerer ett shot via backend-broen (wrapper rundt engine `_gen_one_still`
 * med fix-prompt). Returnerer sti til det nye bildet.
 */
export async function regenerateShot(params: RegenerateShotParams): Promise<ShotVariant> {
  return invoke<ShotVariant>("ad_film_regenerate_shot", {
    specPath: params.specPath,
    shotId: params.shotId,
    fix: params.fix,
  });
}
