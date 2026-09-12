/**
 * social-queue-infographic.ts — opt-in kpi-grid-grafikk for sosiale poster.
 *
 * Bygger et merkevaret bilde fra postens faktagrunnlag (de SAMME tallene LLM-en
 * skrev fra) → data-URL for LinkedIn image-post. Best-effort: for tynt grunnlag
 * eller render-feil → null → posten går som ren tekst, akkurat som før.
 *
 * Egen modul (ikke i social-queue.ts) så den er testbar uten å dra inn hele
 * content-composer/@anthropic-ai-import-kjeden.
 */
import type { Pool } from "pg";

import { renderInfographicToBuffer } from "../infographic-render.js";

/** Ren mapping: faktagrunnlag → opptil 4 kpi-kort. Filtrerer bort tomme/ugyldige. */
export function factsToCards(facts: unknown): Array<{ value: string; label: string }> {
  const arr = Array.isArray(facts) ? (facts as Array<{ label?: unknown; value?: unknown }>) : [];
  return arr
    .filter((f) => f && f.value != null && typeof f.label === "string" && f.label.trim() !== "")
    .slice(0, 4)
    .map((f) => ({ value: String(f.value), label: String(f.label) }));
}

/** Faktagrunnlag → PNG data-URL (kpi-grid), eller null hvis for tynt / render feiler. */
export async function buildFactsInfographicDataUrl(
  pool: Pool, facts: unknown, accent?: string,
): Promise<string | null> {
  const cards = factsToCards(facts);
  if (cards.length < 2) return null; // for tynt til en meningsfull grafikk
  const buf = await renderInfographicToBuffer(pool, {
    tpl: "kpi-grid",
    accent,
    data: { label: "Nøkkeltall", cards },
    width: 1200, height: 628, // LinkedIn foretrukket ~1200×627
  }).catch(() => null);
  return buf ? `data:image/png;base64,${buf.toString("base64")}` : null;
}
