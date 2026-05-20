/**
 * nextrole-arbeidsplassen.ts
 *
 * Henter stillingsannonser fra arbeidsplassen.no (NAV) via deres åpne
 * stillings-feed-API. Brukes til å auto-fylle jobbsøknader i NextRole
 * Kanban, slik at bruker slipper å lime inn JD manuelt.
 *
 * NAV's API:
 *   • https://pam-stilling-feed-api.nav.no/api/v1/feed/{uuid}
 *   • Ingen auth, ingen rate-limit i praksis
 *   • Returnerer JSON med stilling, arbeidsgiver, lokasjon, beskrivelse,
 *     søknadsfrist, kontaktinfo
 *
 * URL-formater vi parser:
 *   • https://arbeidsplassen.nav.no/stillinger/stilling/{uuid}
 *   • https://www.nav.no/arbeid/jobb/{uuid}
 *   • Direkte UUID (36 tegn)
 *
 * Endepunkt:
 *   GET /api/nextrole/arbeidsplassen/fetch?url=...   eller   ?uuid=...
 */

import type express from "express";

export interface NextRoleArbeidsplassenDeps {
  app: express.Application;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string } | null;
}

// UUID v4-mønster (matcher NAV's stillings-ID-er)
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractUuid(input: string): string | null {
  if (!input) return null;
  const m = input.match(UUID_RE);
  return m ? m[0].toLowerCase() : null;
}

// NAV-respons-format (kun feltene vi bryr oss om)
interface NavStillingResponse {
  uuid?: string;
  title?: string;
  description?: string;
  jobtitle?: string;
  employer?: { name?: string; description?: string };
  location?: { city?: string; municipal?: string; country?: string };
  expires?: string;
  applicationDue?: string;
  source?: string;
  url?: string;
  workingHours?: string;
  contracttype?: string;
  contacts?: Array<{ name?: string; email?: string; phone?: string; title?: string }>;
  categories?: Array<{ name?: string }>;
}

interface FetchResult {
  uuid: string;
  jobTitle: string;
  company: string | null;
  location: string | null;
  description: string | null;
  applicationDeadline: string | null;
  applicationUrl: string;
  source: string;
  contacts: Array<{ name: string; email: string | null; phone: string | null; title: string | null }>;
  categories: string[];
}

async function fetchFromNav(uuid: string): Promise<FetchResult | null> {
  const url = `https://pam-stilling-feed-api.nav.no/api/v1/feed/${uuid}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "NextRole-by-CreatorHub" },
    });
    if (!res.ok) {
      console.warn(`[arbeidsplassen] ${res.status} for ${uuid}`);
      return null;
    }
    const json = (await res.json()) as NavStillingResponse;
    const jobTitle = json.title || json.jobtitle || "";
    if (!jobTitle) return null;

    const loc = json.location;
    const locationStr = loc
      ? [loc.city || loc.municipal, loc.country].filter(Boolean).join(", ")
      : null;

    return {
      uuid,
      jobTitle,
      company: json.employer?.name ?? null,
      location: locationStr || null,
      description: json.description ?? json.employer?.description ?? null,
      applicationDeadline: json.applicationDue ?? json.expires ?? null,
      applicationUrl:
        json.url || `https://arbeidsplassen.nav.no/stillinger/stilling/${uuid}`,
      source: "arbeidsplassen.no",
      contacts: (json.contacts ?? []).map((c) => ({
        name: c.name ?? "",
        email: c.email ?? null,
        phone: c.phone ?? null,
        title: c.title ?? null,
      })),
      categories: (json.categories ?? [])
        .map((c) => c.name ?? "")
        .filter(Boolean),
    };
  } catch (err) {
    console.error("[arbeidsplassen] fetch failed", err);
    return null;
  }
}

export function setupNextRoleArbeidsplassenRoutes(
  deps: NextRoleArbeidsplassenDeps,
): void {
  const { app, getActiveSessionFromRequest } = deps;

  app.get("/api/nextrole/arbeidsplassen/fetch", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      res.status(401).json({ error: "auth_required" });
      return;
    }
    const input = String(req.query.url ?? req.query.uuid ?? "").trim();
    if (!input) {
      res.status(400).json({ error: "url_eller_uuid_paakrevd" });
      return;
    }
    const uuid = extractUuid(input);
    if (!uuid) {
      res.status(400).json({
        error: "ugyldig_url_eller_uuid",
        message: "Lim inn URL fra arbeidsplassen.no eller en stillings-UUID",
      });
      return;
    }

    const data = await fetchFromNav(uuid);
    if (!data) {
      res.status(404).json({
        error: "stilling_ikke_funnet",
        message: "Stillingen finnes ikke lenger, eller URLen er ikke fra arbeidsplassen.no",
      });
      return;
    }

    res.json({ stilling: data });
  });
}
