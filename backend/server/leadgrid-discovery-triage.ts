/**
 * Triage: gjør to hundre avgjørelser om til tre.
 *
 * Målt i produksjon 2026-09-23: 60 kandidater funnet, 0 godkjent eller avvist.
 * Ikke én eneste gang har noen kommet gjennom porten som er hele produktets
 * kjerne. Det er ikke latskap — det er at en liste på to hundre ikke er
 * oversikt, men to hundre avgjørelser.
 *
 * Her grupperes kandidatene etter det som faktisk skiller dem, slik at
 * mennesket tar stilling til grupper i stedet for rader, og kan åpne enhver
 * gruppe for å se radene bak.
 *
 * Asymmetrien er med vilje: å AVVISE mange er trygt — ingenting skjer, og
 * kandidaten kan hentes fram igjen. Å GODKJENNE mange oppretter leads og
 * legger opp til kontakt med ekte bedrifter. Derfor får bare gruppene med
 * entydig grunnlag lov til å godkjennes samlet; resten må ses på.
 */
import type { Pool } from "pg";

import {
  listDiscoveryCandidates,
  type DiscoveryCandidateDto,
} from "./leadgrid-discovery-service.js";
import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";

export type TriageBulkAction = "reject" | "approve" | null;

export interface TriageGroup {
  key: "discard" | "ready" | "review";
  title: string;
  /** Én setning som sier hvorfor disse havnet sammen. */
  why: string;
  count: number;
  /** Hva som skjer hvis brukeren gjør det samme med hele gruppa. */
  bulk_action: TriageBulkAction;
  bulk_consequence: string | null;
  /** Navn nok til at brukeren kjenner igjen gruppa uten å åpne den. */
  sample: Array<{ id: string; name: string; fit_score: number | null }>;
}

export interface TriageResult {
  pending_count: number;
  minimum_fit_score: number;
  groups: TriageGroup[];
}

function score(candidate: DiscoveryCandidateDto): number | null {
  const verdi = candidate.fit_score;
  return typeof verdi === "number" && Number.isFinite(verdi) ? verdi : null;
}

function kontaktbar(candidate: DiscoveryCandidateDto): boolean {
  return Boolean(candidate.phone?.trim() || candidate.email?.trim());
}

/**
 * `fit_score` og `minimum_fit_score` er begge 0–100. Kandidater uten score
 * regnes ikke som svake — vi vet bare ikke, og da skal et menneske se.
 */
export function triageCandidates(
  candidates: DiscoveryCandidateDto[],
  options: { minimumFitScore: number },
): TriageResult {
  const grense = Math.min(100, Math.max(0, options.minimumFitScore));
  const discard: DiscoveryCandidateDto[] = [];
  const ready: DiscoveryCandidateDto[] = [];
  const review: DiscoveryCandidateDto[] = [];

  for (const candidate of candidates) {
    const verdi = score(candidate);
    if (candidate.excluded || (verdi != null && verdi < grense)) {
      discard.push(candidate);
      continue;
    }
    if (verdi != null && kontaktbar(candidate)) {
      ready.push(candidate);
      continue;
    }
    review.push(candidate);
  }

  const grupper: TriageGroup[] = [];
  if (discard.length > 0) {
    const ekskludert = discard.filter((c) => c.excluded).length;
    grupper.push({
      key: "discard",
      title: "Passer ikke profilen",
      why:
        ekskludert > 0
          ? `${ekskludert} traff en ekskluderingsregel, resten scorer under ${grense}.`
          : `Scorer under minstegrensen på ${grense}.`,
      count: discard.length,
      bulk_action: "reject",
      bulk_consequence:
        "Avviser alle. Ingenting sendes, og de kan hentes fram igjen senere.",
      sample: prøve(discard),
    });
  }
  if (ready.length > 0) {
    grupper.push({
      key: "ready",
      title: "Klare til å kontaktes",
      why: `Scorer ${grense} eller bedre, og har telefon eller e-post.`,
      count: ready.length,
      bulk_action: "approve",
      bulk_consequence: `Oppretter ${ready.length} leads med pin på kartet. Ingenting sendes til bedriftene.`,
      sample: prøve(ready),
    });
  }
  if (review.length > 0) {
    const utenScore = review.filter((c) => score(c) == null).length;
    grupper.push({
      key: "review",
      title: "Se på disse selv",
      why:
        utenScore > 0
          ? `${utenScore} mangler score; resten mangler kontaktinfo.`
          : "Mangler telefon og e-post — første handling blir et oppslag.",
      count: review.length,
      // Med vilje uten samlet handling: grunnlaget er ikke likt nok til at
      // ett trykk kan gjelde alle.
      bulk_action: null,
      bulk_consequence: null,
      sample: prøve(review),
    });
  }

  return {
    pending_count: candidates.length,
    minimum_fit_score: grense,
    groups: grupper,
  };
}

function prøve(
  candidates: DiscoveryCandidateDto[],
): TriageGroup["sample"] {
  return [...candidates]
    .sort((a, b) => (score(b) ?? -1) - (score(a) ?? -1))
    .slice(0, 5)
    .map((c) => ({ id: c.id, name: c.name, fit_score: score(c) }));
}


/** Hvor mange ventende kandidater vi grupperer. Nok til hele lista i praksis. */
const TRIAGE_LIMIT = 100;

export async function triageRunCandidates(
  pool: Pool,
  input: { project: LeadgridAccessibleProject; runId: string },
): Promise<TriageResult> {
  const [{ items }, grense] = await Promise.all([
    listDiscoveryCandidates(pool, {
      project: input.project,
      runId: input.runId,
      disposition: "pending",
      sort: "score_desc",
      limit: TRIAGE_LIMIT,
    }),
    minimumFitScoreFor(pool, input),
  ]);
  return triageCandidates(items, { minimumFitScore: grense });
}

/**
 * Grensa kommer fra briefen kjøringen faktisk ble startet med, ikke fra
 * profilen slik den ser ut nå — profilen kan ha blitt endret etterpå, og da
 * ville gruppene ikke stemt med det brukeren så.
 */
async function minimumFitScoreFor(
  pool: Pool,
  input: { project: LeadgridAccessibleProject; runId: string },
): Promise<number> {
  const rad = await pool.query<{ minimum_fit_score: number | null }>(
    `SELECT (brief_snapshot->>'minimum_fit_score')::int AS minimum_fit_score
       FROM leadgrid_discovery_runs
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3`,
    [input.runId, input.project.organizationId, input.project.id],
  );
  const verdi = rad.rows[0]?.minimum_fit_score;
  // Samme standard som discoveryBriefSchema.
  return typeof verdi === "number" && Number.isFinite(verdi) ? verdi : 50;
}
