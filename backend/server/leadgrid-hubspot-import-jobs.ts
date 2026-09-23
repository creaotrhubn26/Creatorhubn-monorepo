/**
 * HubSpot-migrering som jobb, ikke som request.
 *
 * Evidensfilen er tydelig: burst-grensen er 100–190 kall per 10 sekunder, og
 * et større HubSpot-oppsett kan ikke hentes inne i én HTTP-request. Kunden
 * skal heller ikke sitte og se på en snurrende sirkel uten tall.
 *
 * Derfor: start jobb, følg med, bekreft. Faser i rekkefølge —
 *
 *   sjekker    fem raske kall som avslører manglende scopes MED NAVN
 *   henter     uttaket, med tall per datatype etter hvert som de lander
 *   planlegger oversettelsen til Leadgrid-rader
 *   klar       planen ligger klar; ingenting er skrevet
 *   skriver    bekreftet av kunden
 *   ferdig     tallene som faktisk havnet i basen
 *
 * Service Key-en lever bare mens `henter` pågår. Når planen er klar slettes
 * den fra minnet — resten av jobben trenger den ikke, og en nøkkel vi ikke
 * har kan ikke lekke.
 */
import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import {
  hentHubSpotData,
  planHubSpotMigration,
  sjekkHubSpotTilgang,
  skrivMigrering,
  type ImportResult,
  type MigrationPlan,
} from "./leadgrid-hubspot-import.js";
import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";

export type JobbFase =
  | "sjekker"
  | "henter"
  | "planlegger"
  | "klar"
  | "skriver"
  | "ferdig"
  | "feilet";

export interface JobbStatus {
  id: string;
  fase: JobbFase;
  /** Hva som er hentet så langt, i den rekkefølgen det landet. */
  hentet: Array<{ navn: string; antall: number }>;
  /** Én setning som sier hva som skjer nå. Vises som den er. */
  melding: string;
  plan?: {
    counts: MigrationPlan["counts"];
    issues: MigrationPlan["issues"];
    mergedIntoExisting: MigrationPlan["mergedIntoExisting"];
    eksempler: Array<{ name: string; stage: string; email: string | null }>;
  };
  resultat?: ImportResult;
  feil?: {
    kode: "ugyldig_nokkel" | "mangler_scopes" | "hubspot_utilgjengelig" | "skriving_feilet";
    melding: string;
    manglendeScopes?: Array<{ navn: string; scope: string }>;
  };
  /** Advarsler som ikke stopper migreringen, men som kunden bør vite om. */
  advarsler: string[];
}

interface Jobb extends JobbStatus {
  organizationId: string;
  projectId: string;
  userId: string;
  nøkkel: string | null;
  plandata?: MigrationPlan;
  utløper: number;
}

const JOBB_TTL_MS = 30 * 60_000;
const jobber = new Map<string, Jobb>();

function rydd(nå = Date.now()): void {
  for (const [id, jobb] of jobber) {
    if (jobb.utløper <= nå) {
      jobb.nøkkel = null;
      jobber.delete(id);
    }
  }
}

export function hentJobb(id: string, organizationId: string): JobbStatus | null {
  rydd();
  const jobb = jobber.get(id);
  // En jobb-id på avveie skal ikke vise en annen kundes CRM-tall.
  if (!jobb || jobb.organizationId !== organizationId) return null;
  const { organizationId: _o, projectId: _p, userId: _u, nøkkel: _n, plandata: _d, utløper: _e, ...ut } = jobb;
  return ut;
}

export function startMigrering(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    userId: string;
    serviceKey: string;
  },
): JobbStatus {
  rydd();
  const id = randomUUID();
  const jobb: Jobb = {
    id,
    fase: "sjekker",
    hentet: [],
    melding: "Sjekker at nøkkelen har tilgangene migreringen trenger …",
    advarsler: [],
    organizationId: input.project.organizationId,
    projectId: input.project.id,
    userId: input.userId,
    nøkkel: input.serviceKey,
    utløper: Date.now() + JOBB_TTL_MS,
  };
  jobber.set(id, jobb);
  void kjør(jobb, input.project).catch((error: unknown) => {
    jobb.fase = "feilet";
    jobb.nøkkel = null;
    jobb.feil = {
      kode: "hubspot_utilgjengelig",
      melding: maskert((error as Error).message, input.serviceKey),
    };
  });
  return hentJobb(id, input.project.organizationId)!;
}

async function kjør(jobb: Jobb, project: LeadgridAccessibleProject): Promise<void> {
  const nøkkel = jobb.nøkkel;
  if (!nøkkel) return;

  const tilgang = await sjekkHubSpotTilgang(nøkkel);
  if (tilgang.ugyldigNøkkel) {
    jobb.fase = "feilet";
    jobb.nøkkel = null;
    jobb.feil = {
      kode: "ugyldig_nokkel",
      melding:
        "HubSpot godtok ikke nøkkelen. Sjekk at du kopierte hele Service Key-en, " +
        "og at den ikke er slettet i HubSpot.",
    };
    return;
  }
  if (tilgang.manglerKritisk.length > 0) {
    jobb.fase = "feilet";
    jobb.nøkkel = null;
    jobb.feil = {
      kode: "mangler_scopes",
      melding:
        "Nøkkelen mangler tilgang til " +
        tilgang.manglerKritisk.map((m) => m.navn).join(", ") +
        ". Legg til scopene i HubSpot og prøv igjen.",
      manglendeScopes: tilgang.manglerKritisk,
    };
    return;
  }
  for (const mangler of tilgang.manglerValgfritt) {
    jobb.advarsler.push(
      `Nøkkelen mangler ${mangler.scope}, så ${mangler.navn} blir ikke med. ` +
        "Alt annet migreres som normalt.",
    );
  }

  jobb.fase = "henter";
  jobb.melding = "Henter data fra HubSpot …";
  const { input } = await hentHubSpotData(nøkkel, {
    onFramdrift: (navn, antall) => {
      jobb.hentet.push({ navn, antall });
      jobb.melding = `Hentet ${navn}: ${antall}`;
    },
  });

  // Nøkkelen har gjort sitt. Resten av jobben trenger den ikke.
  jobb.nøkkel = null;

  jobb.fase = "planlegger";
  jobb.melding = "Oversetter til Leadgrid …";
  const plan = planHubSpotMigration(input, { fallbackOwnerUserId: jobb.userId });
  jobb.plandata = plan;
  jobb.plan = {
    counts: plan.counts,
    issues: plan.issues.slice(0, 100),
    mergedIntoExisting: plan.mergedIntoExisting.slice(0, 50),
    eksempler: plan.customers.slice(0, 8).map((k) => ({
      name: k.name,
      stage: k.pipelineStage,
      email: k.email,
    })),
  };
  jobb.fase = "klar";
  jobb.melding = `Klar. ${plan.counts.customers} bedrifter, ${plan.counts.deals} avtaler og ${plan.counts.contacts} kontakter venter på at du sier ja.`;
  void project;
}

export async function bekreftMigrering(
  pool: Pool,
  input: {
    jobbId: string;
    project: LeadgridAccessibleProject;
    userId: string;
  },
): Promise<JobbStatus | null> {
  rydd();
  const jobb = jobber.get(input.jobbId);
  if (!jobb || jobb.organizationId !== input.project.organizationId) return null;
  if (jobb.fase !== "klar" || !jobb.plandata) return hentJobb(jobb.id, jobb.organizationId);

  jobb.fase = "skriver";
  jobb.melding = "Skriver til Leadgrid …";
  try {
    const resultat = await skrivMigrering(pool, {
      project: input.project,
      plan: jobb.plandata,
      userId: input.userId,
    });
    jobb.resultat = resultat;
    jobb.fase = "ferdig";
    jobb.melding =
      `Ferdig. ${resultat.customers} bedrifter, ${resultat.deals} avtaler og ` +
      `${resultat.contacts} kontakter ligger nå i Leadgrid.`;
  } catch (error) {
    jobb.fase = "feilet";
    jobb.feil = {
      kode: "skriving_feilet",
      melding:
        "Ingenting ble skrevet — migreringen rullet tilbake. " +
        "Prøv igjen, eller kontakt oss hvis det gjentar seg.",
    };
    console.warn("[hubspot-jobb] skriving feilet:", (error as Error).message);
  }
  return hentJobb(jobb.id, jobb.organizationId);
}

function maskert(melding: string, nøkkel: string): string {
  return nøkkel ? melding.split(nøkkel).join("***") : melding;
}
