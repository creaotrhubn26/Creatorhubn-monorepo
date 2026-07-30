/**
 * casting-screenplay-persistence.ts
 *
 * Lagrer et parset manus som scene-entiteter (Del A punkt 82).
 *
 * Parseren i casting-screenplay-formats.ts har alltid vært bevisst stateless
 * («de lagrer ikke direkte i manuscripts-service») — den gjør Fountain/FDX om
 * til en ParsedScreenplay og stopper der. Det er den manglende halvdelen som
 * hindrer resten: uten scener i basen kan verken scene↔karakter-koblingen
 * (83), stripboardet (72) eller fremdriftsloggen (73) bygges.
 *
 * **Revisjoner er hovedproblemet, ikke førstegangsimporten.** Et manus kommer
 * i utkast etter utkast, og innspillingslederen har typisk gjort
 * breakdown-arbeid på scenene i mellomtiden. En naiv reimport som sletter og
 * setter inn på nytt ville kastet det arbeidet hver gang. Derfor bæres
 * production_breakdown og act_id over til scener som gjenkjennes.
 */

import type { Pool, PoolClient } from "pg";
import type { ParsedScene, ParsedScreenplay } from "./casting-screenplay-formats.js";
import { newEntityId } from "./_shared-ids.js";

// ── Scene-heading → strukturerte felter ─────────────────────────────────────

/** INT/EXT-prefikser slik de faktisk skrives i manus. */
const INT_EXT_PATTERNS: Array<[RegExp, string]> = [
  [/^(INT\.?\/EXT\.?|I\/E)\b/i, "INT/EXT"],
  [/^INT\b\.?/i, "INT"],
  [/^EXT\b\.?/i, "EXT"],
  [/^EST\b\.?/i, "EST"],
];

/**
 * Tidsangivelser bakerst i en scene-heading. Norsk og engelsk, fordi
 * norske produksjoner blander — manus skrives ofte på norsk, men importeres
 * fra engelskspråklige verktøy.
 */
const TIME_OF_DAY = [
  "DAG", "NATT", "KVELD", "MORGEN", "ETTERMIDDAG", "SKUMRING", "DAGGRY", "SENERE", "KONTINUERLIG",
  "DAY", "NIGHT", "EVENING", "MORNING", "AFTERNOON", "DUSK", "DAWN", "LATER", "CONTINUOUS",
];

export interface SceneFields {
  intExt: string | null;
  setting: string | null;
  timeOfDay: string | null;
  title: string;
}

/**
 * Deler «INT. KJØKKEN – KVELD» i sine bestanddeler.
 *
 * Skilletegnet før tidsangivelsen varierer (bindestrek, tankestrek, komma),
 * og noen manus utelater den helt. Det som ikke lar seg tolke havner i
 * setting framfor å forsvinne — headingen beholdes uansett som title.
 */
export function parseSceneHeading(heading: string): SceneFields {
  const raw = (heading ?? "").trim();
  const title = raw.replace(/\s+/g, " ");

  // Scenenummer forrest ('12 INT. …') må bort FØR INT/EXT-sjekken — ellers
  // matcher ikke prefikset, og både intExt og setting blir feil.
  let rest = raw.replace(/^\d+[.)]?\s+/, "").trim();

  let intExt: string | null = null;
  for (const [re, label] of INT_EXT_PATTERNS) {
    if (re.test(rest)) {
      intExt = label;
      rest = rest.replace(re, "").trim();
      break;
    }
  }

  let timeOfDay: string | null = null;
  // Del på det SISTE skilletegnet — stedsnavn kan selv inneholde bindestrek
  // ('EXT. OSLO S - PERRONG 3 - KVELD' → sted 'OSLO S - PERRONG 3').
  const parts = rest.split(/\s+[–—-]\s+|\s*,\s*/);
  if (parts.length > 1) {
    const candidate = parts[parts.length - 1].trim().toUpperCase().replace(/[.!]$/, "");
    if (TIME_OF_DAY.includes(candidate)) {
      timeOfDay = candidate;
      parts.pop();
      rest = parts.join(" - ");
    }
  }

  const setting = rest.trim() || null;
  return { intExt, setting, timeOfDay, title: title || "(uten heading)" };
}

/** Karakterene som har replikk i scenen, i rekkefølge, uten duplikater. */
export function charactersInScene(scene: ParsedScene): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of scene.dialogue ?? []) {
    const name = (line.character ?? "").trim().toUpperCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

// ── Persistering ────────────────────────────────────────────────────────────

export interface PersistResult {
  created: number;
  updated: number;
  removed: number;
  /** Scener der tidligere breakdown-arbeid ble båret over. */
  breakdownCarried: number;
}

/**
 * Nøkkelen en scene gjenkjennes på mellom manus-versjoner. Scenenummer alene
 * duger ikke — sceneR flyttes og nummereres om mellom utkast. Headingen alene
 * duger heller ikke, siden samme sted gjerne går igjen. Sammen er de gode nok
 * til at breakdown følger scenen gjennom en revisjon.
 */
function sceneKey(sceneNumber: number, title: string): string {
  return `${sceneNumber}::${title.trim().toUpperCase()}`;
}

/**
 * Skriver scenene fra et parset manus. Kjøres i én transaksjon: et halvimportert
 * manus er verre enn ingen import.
 */
export async function persistParsedScreenplay(
  pool: Pool,
  input: {
    projectId: string;
    manuscriptId: string;
    parsed: ParsedScreenplay;
    /** Fjern scener som ikke lenger finnes i manuset. Default true. */
    removeMissing?: boolean;
  },
): Promise<PersistResult> {
  const { projectId, manuscriptId, parsed } = input;
  const removeMissing = input.removeMissing !== false;

  const result: PersistResult = { created: 0, updated: 0, removed: 0, breakdownCarried: 0 };
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    // Eksisterende scener for dette manuset — kilden til breakdown vi vil beholde.
    const existing = await client.query<{
      id: string;
      scene_number: number;
      title: string;
      act_id: string | null;
      production_breakdown: unknown;
    }>(
      `SELECT id, scene_number, title, act_id, production_breakdown
         FROM casting_scenes
        WHERE project_id = $1 AND manuscript_id = $2`,
      [projectId, manuscriptId],
    );

    const byKey = new Map(
      existing.rows.map((r) => [sceneKey(Number(r.scene_number ?? 0), r.title ?? ""), r]),
    );
    const keptIds = new Set<string>();

    let sceneNumber = 0;
    for (const scene of parsed.scenes ?? []) {
      sceneNumber += 1;
      const fields = parseSceneHeading(scene.heading);
      const characters = charactersInScene(scene);
      const description = (scene.action ?? []).join("\n\n").trim() || null;
      const prior = byKey.get(sceneKey(sceneNumber, fields.title));

      if (prior) {
        // Kjent scene: oppdater teksten, behold breakdown og akt-tilhørighet.
        await client.query(
          `UPDATE casting_scenes
              SET title = $1, description = $2, setting = $3, time_of_day = $4,
                  int_ext = $5, characters = $6::jsonb, updated_at = NOW()
            WHERE id = $7`,
          [
            fields.title, description, fields.setting, fields.timeOfDay,
            fields.intExt, JSON.stringify(characters), prior.id,
          ],
        );
        keptIds.add(prior.id);
        result.updated += 1;
        if (prior.production_breakdown && Object.keys(prior.production_breakdown as object).length > 0) {
          result.breakdownCarried += 1;
        }
      } else {
        const id = newEntityId("scene");
        await client.query(
          `INSERT INTO casting_scenes
             (id, project_id, manuscript_id, scene_number, title, description,
              setting, time_of_day, int_ext, characters)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [
            id, projectId, manuscriptId, sceneNumber, fields.title, description,
            fields.setting, fields.timeOfDay, fields.intExt, JSON.stringify(characters),
          ],
        );
        keptIds.add(id);
        result.created += 1;
      }
    }

    if (removeMissing) {
      const stale = existing.rows.filter((r) => !keptIds.has(r.id)).map((r) => r.id);
      if (stale.length > 0) {
        const del = await client.query(
          `DELETE FROM casting_scenes WHERE id = ANY($1)`,
          [stale],
        );
        result.removed = del.rowCount ?? 0;
      }
    }

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
