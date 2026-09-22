/**
 * «Varm start»: én knapp etter et Discovery-søk.
 *
 * Et søk gir gjerne to hundre kandidater. Den som er ny i Leadgrid får da to
 * hundre valg og ingen inngang — og lar dem ligge. Varm start tar bort valget:
 * systemet peker på den best scorende kandidaten, sier hvorfor, og setter opp
 * det som skal til for at neste handling er åpenbar — lead + én oppgave med
 * frist.
 *
 * Forslaget er alltid synlig FØR noe opprettes (previewWarmStart). Først når
 * brukeren bekrefter, skrives noe (commitWarmStart).
 */
import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";
import {
  decideDiscoveryCandidate,
  listDiscoveryCandidates,
  type DiscoveryCandidateDto,
} from "./leadgrid-discovery-service.js";

/** Hvor mange toppkandidater vi vurderer før vi peker. */
const WARM_START_CONSIDERED = 100;

export interface WarmStartFirstStep {
  /** Kanalen første handling går i. Styrer ikonet i appen. */
  channel: "call" | "email" | "research";
  /** Oppgaveteksten. Skal kunne leses alene, uten kortet rundt. */
  title: string;
}

export interface WarmStartSuggestion {
  candidate_id: string;
  name: string;
  city: string | null;
  organization_number: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  fit_score: number | null;
  /** Hvorfor akkurat denne — kommer fra scoringen, ikke fra en tekstmal. */
  reasons: string[];
  first_step: WarmStartFirstStep;
  /** Har koordinater, og havner derfor som pin på kartet. */
  map_ready: boolean;
  /** Har telefon eller e-post — vi kan faktisk ta kontakt. */
  contactable: boolean;
}

export interface WarmStartPreview {
  pending_count: number;
  suggestion: WarmStartSuggestion | null;
}

export interface WarmStartResult {
  lead_id: string | null;
  candidate_id: string;
  task_id: string | null;
  task_created: boolean;
  first_step: WarmStartFirstStep;
  replayed: boolean;
}

/**
 * Første handling velges etter hva vi faktisk vet om bedriften. Å foreslå
 * «ring» uten telefonnummer er verre enn å foreslå ingenting: brukeren må da
 * gjøre oppslaget selv og oppdager det først når hen står i oppgaven.
 */
export function warmStartFirstStep(
  candidate: Pick<
    DiscoveryCandidateDto,
    "name" | "phone" | "email" | "website_url"
  >,
): WarmStartFirstStep {
  const navn = candidate.name.trim() || "bedriften";
  if (candidate.phone?.trim()) {
    return { channel: "call", title: `Ring ${navn} på ${candidate.phone.trim()}` };
  }
  if (candidate.email?.trim()) {
    return {
      channel: "email",
      title: `Send første e-post til ${navn} (${candidate.email.trim()})`,
    };
  }
  const domene = websiteHost(candidate.website_url);
  if (domene) {
    return {
      channel: "research",
      title: `Finn kontaktperson hos ${navn} på ${domene}`,
    };
  }
  return { channel: "research", title: `Finn kontaktinfo for ${navn}` };
}

function websiteHost(url: string | null): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).host || null;
  } catch {
    return null;
  }
}

export function warmStartSuggestionFrom(
  candidate: DiscoveryCandidateDto,
): WarmStartSuggestion {
  return {
    candidate_id: candidate.id,
    name: candidate.name,
    city: candidate.city,
    organization_number: candidate.organization_number,
    phone: candidate.phone,
    email: candidate.email,
    website_url: candidate.website_url,
    fit_score: candidate.fit_score,
    reasons: candidate.reasons.slice(0, 3),
    first_step: warmStartFirstStep(candidate),
    map_ready: candidateIsMapReady(candidate),
    contactable: candidateIsContactable(candidate),
  };
}

/**
 * Rangering innen tåleavstanden: en lead som ikke kan plasseres, dukker aldri
 * opp på kartet (kartlaget filtrerer bort koordinat 0,0), og en uten telefon
 * eller e-post gir ingen vei videre. Begge deler er usynlig for brukeren før
 * hen står fast.
 */
function actionabilityTier(candidate: DiscoveryCandidateDto): number {
  const kart = candidateIsMapReady(candidate);
  const kontakt = candidateIsContactable(candidate);
  if (kart && kontakt) return 0;
  if (kart) return 1;
  if (kontakt) return 2;
  return 3;
}

export function candidateIsMapReady(
  candidate: Pick<DiscoveryCandidateDto, "latitude" | "longitude">,
): boolean {
  const lat = candidate.latitude;
  const lon = candidate.longitude;
  return (
    lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
    // Kartet filtrerer bort 0,0 — en pin i Atlanterhavet er ingen pin.
    && !(lat === 0 && lon === 0)
  );
}

export function candidateIsContactable(
  candidate: Pick<DiscoveryCandidateDto, "phone" | "email">,
): boolean {
  return Boolean(candidate.phone?.trim() || candidate.email?.trim());
}

/**
 * Velger kandidaten varm start peker på.
 *
 * Treffsikkerhet kommer først: bare kandidater innenfor `tolerance` av den
 * beste scoren er med i betraktningen. Blant dem vinner den vi faktisk kan
 * gjøre noe med — plassere på kartet og ta kontakt med. Uten dette foreslår
 * systemet gjerne den største virksomheten i bransjen og etterlater brukeren
 * med «finn kontaktinfo selv» som første handling. Målt i Enhetsregisteret
 * 2026-09-22: i næringskode 87.104 hadde én av fem både telefon og e-post.
 */
export function pickWarmestCandidate(
  candidates: DiscoveryCandidateDto[],
  tolerance = 0.1,
): DiscoveryCandidateDto | null {
  if (candidates.length === 0) return null;
  // En kandidat uten tall for score må telle som null, ikke som NaN: NaN
  // forplanter seg gjennom Math.max og tømmer hele utvalget, slik at
  // forslaget forsvinner fordi ÉN rad manglet score.
  const score = (candidate: DiscoveryCandidateDto): number => {
    const verdi = candidate.fit_score;
    return typeof verdi === "number" && Number.isFinite(verdi) ? verdi : 0;
  };
  const best = Math.max(...candidates.map(score));
  const innenfor = candidates.filter((c) => score(c) >= best - tolerance);
  return [...innenfor].sort((venstre, høyre) => {
    const tier = actionabilityTier(venstre) - actionabilityTier(høyre);
    if (tier !== 0) return tier;
    return score(høyre) - score(venstre);
  })[0] ?? null;
}

async function warmestPending(
  pool: Pool,
  input: { project: LeadgridAccessibleProject; runId: string },
): Promise<DiscoveryCandidateDto | null> {
  // Samme spørring som kandidatlista bruker — varm start skal aldri kunne
  // peke på en annen «beste» enn den brukeren ser øverst i lista.
  const { items } = await listDiscoveryCandidates(pool, {
    project: input.project,
    runId: input.runId,
    disposition: "pending",
    sort: "score_desc",
    limit: WARM_START_CONSIDERED,
  });
  return pickWarmestCandidate(items);
}

export async function previewWarmStart(
  pool: Pool,
  input: { project: LeadgridAccessibleProject; runId: string },
): Promise<WarmStartPreview> {
  const { items } = await listDiscoveryCandidates(pool, {
    project: input.project,
    runId: input.runId,
    disposition: "pending",
    sort: "score_desc",
    limit: WARM_START_CONSIDERED,
  });
  const warmest = pickWarmestCandidate(items);
  return {
    pending_count: items.length,
    suggestion: warmest ? warmStartSuggestionFrom(warmest) : null,
  };
}

export async function commitWarmStart(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    userId: string;
    runId: string;
    /** Skal peke på kandidaten brukeren så i forslaget. */
    candidateId: string;
    now?: Date;
  },
): Promise<WarmStartResult> {
  const candidate = await warmestPending(pool, {
    project: input.project,
    runId: input.runId,
  });
  if (!candidate || candidate.id !== input.candidateId) {
    // Noen andre har godkjent eller forkastet i mellomtiden. Da er forslaget
    // brukeren ser utdatert, og vi godkjenner heller ingenting enn feil rad.
    throw new WarmStartStaleError(candidate?.id ?? null);
  }

  const firstStep = warmStartFirstStep(candidate);
  const decision = await decideDiscoveryCandidate(pool, {
    project: input.project,
    userId: input.userId,
    runId: input.runId,
    candidateId: candidate.id,
    // Deterministisk: to trykk på samme forslag gir én lead, ikke to.
    idempotencyKey: `warm-start:${input.runId}:${candidate.id}`,
    decision: { decision: "approve" },
  });

  let taskId: string | null = null;
  let taskCreated = false;
  if (decision.lead_id) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id::text
         FROM leadgrid_oppgaver
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND lead_id = $3
          AND kilde = 'warm_start'
        LIMIT 1`,
      [input.project.organizationId, input.project.id, decision.lead_id],
    );
    if (existing.rows[0]) {
      taskId = existing.rows[0].id;
    } else {
      taskId = randomUUID();
      taskCreated = true;
      await pool.query(
        `INSERT INTO leadgrid_oppgaver
           (id, organization_id, project_id, user_id, selskap, lead_id,
            tittel, frist, kilde, due_at, task_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'warm_start',$9,$10)`,
        [
          taskId,
          input.project.organizationId,
          input.project.id,
          input.userId,
          candidate.name.slice(0, 200),
          decision.lead_id,
          firstStep.title.slice(0, 300),
          "i morgen",
          nextWorkingMorning(input.now ?? new Date()).toISOString(),
          firstStep.channel,
        ],
      );
    }
  }

  return {
    lead_id: decision.lead_id,
    candidate_id: candidate.id,
    task_id: taskId,
    task_created: taskCreated,
    first_step: firstStep,
    replayed: decision.replayed,
  };
}

export class WarmStartStaleError extends Error {
  constructor(readonly currentCandidateId: string | null) {
    super("warm_start_stale");
    this.name = "WarmStartStaleError";
  }
}

/**
 * Fristen legges neste virkedag kl. 09. En oppgave som forfaller «om en time»
 * blir liggende rød før dagen er omme; en som forfaller på en lørdag blir
 * ikke gjort.
 */
export function nextWorkingMorning(now: Date): Date {
  const neste = new Date(now);
  neste.setHours(9, 0, 0, 0);
  do {
    neste.setDate(neste.getDate() + 1);
  } while (neste.getDay() === 0 || neste.getDay() === 6);
  return neste;
}
