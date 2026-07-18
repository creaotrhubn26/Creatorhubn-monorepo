/**
 * roleRoomSetupToolExecutor.ts — bekreftelses-håndterer for agentens
 * oppsett-verktøy (doc 14 F1–F6) i chatten.
 *
 * Agenten er propose-only: den foreslår tool_use, brukeren bekrefter i
 * chat-UI-et, og DENNE modulen utfører det faktiske kallet mot de samme
 * endepunktene som knappene i Research-fanen bruker. Returnerer en kort
 * norsk oppsummering som rendres inline i tråden — eller null når
 * verktøyet ikke er et oppsett-verktøy (callerens switch tar over).
 *
 * Policy: aldri hemmeligheter gjennom denne flyten — verktøyene tar kun
 * offentlige måle-IDer og domener. IndexNow (ekstern effekt) bruker vår
 * egen nøkkel KUN for egne domener; klient-domener avvises ærlig til
 * nøkkelfilen deres er deployet.
 */

export interface SetupToolUse {
  name: string;
  input: Record<string, unknown>;
}

/** Egne domener der repo-nøkkelfilen allerede er servert på roten. */
const OWN_INDEXNOW_KEY = "a9ac5c44b95de2e87781907267a60f07";
const OWN_HOSTS = new Set(["theroleroom.com", "www.theroleroom.com", "leadgrid.no", "www.leadgrid.no", "creatorhubn.com", "www.creatorhubn.com"]);

const jsonHeaders = { "Content-Type": "application/json" };

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Utfør et bekreftet oppsett-verktøy. Returnerer oppsummerings-streng,
 * eller null hvis verktøyet ikke håndteres her. Kaster ved feil (chatten
 * viser meldingen inline).
 */
export async function executeSetupAgentTool(
  tool: SetupToolUse,
  projectId: string | null,
): Promise<string | null> {
  const input = tool.input ?? {};

  switch (tool.name) {
    case "audit_site_setup": {
      const url = str(input.url) ?? str(input.website_url);
      if (!url) throw new Error("Auditen mangler URL.");
      const r = await post("/api/integrations/site-audit", { url });
      if (!r.ok) throw new Error(`Audit feilet (${r.data?.error ?? r.status}).`);
      const caps = (r.data?.audit?.capabilities ?? []) as Array<{ label: string; status: string }>;
      const grp = (s: string) => caps.filter((c) => c.status === s).map((c) => c.label);
      const parts = [
        grp("implemented").length ? `På plass: ${grp("implemented").join(", ")}` : null,
        grp("partial").length ? `Delvis: ${grp("partial").join(", ")}` : null,
        grp("missing").length ? `Mangler: ${grp("missing").join(", ")}` : null,
        grp("unknown").length ? `Ikke observerbart: ${grp("unknown").join(", ")}` : null,
      ].filter(Boolean);
      return `Audit av ${url}: ${parts.join(" · ")}. Full detalj i Research-fanen («Finn ut alt om kunden»).`;
    }

    case "generate_event_plan": {
      const goals = strArr(input.goals);
      if (goals.length === 0) throw new Error("Event-planen mangler mål.");
      const r = await post("/api/integrations/analytics-bootstrap", { goals });
      if (!r.ok) throw new Error(`Event-plan feilet (${r.data?.error ?? r.status}).`);
      const plan = (r.data?.eventPlan ?? []) as Array<{ ga4Event: string; keyEvent: boolean; metaEvent: string | null }>;
      const lines = plan.map((e) => `${e.ga4Event}${e.keyEvent ? " (key event)" : ""}${e.metaEvent ? ` → Meta ${e.metaEvent}` : ""}`);
      return `Event-plan (${goals.join(", ")}): ${lines.join(" · ")}. Snippet genereres i Analytics-oppsett-panelet når måle-IDene er klare.`;
    }

    case "generate_analytics_bootstrap": {
      const body: Record<string, unknown> = { goals: strArr(input.goals) };
      const ga4 = str(input.ga4_measurement_id);
      const gtm = str(input.gtm_id);
      const clarity = str(input.clarity_project_id);
      const pixel = str(input.meta_pixel_id);
      if (ga4) body.ga4MeasurementId = ga4;
      if (gtm) body.gtmId = gtm;
      if (clarity) body.clarityProjectId = clarity;
      if (pixel) body.metaPixelId = pixel;
      const r = await post("/api/integrations/analytics-bootstrap", body);
      if (!r.ok) throw new Error(`Snippet-generering feilet (${r.data?.details?.join(" · ") ?? r.data?.error ?? r.status}).`);
      const ids = [ga4, gtm, clarity, pixel].filter(Boolean);
      return r.data?.snippet
        ? `Consent-gatet snippet generert for ${ids.join(", ")} (${(r.data.eventPlan ?? []).length} events i Meta-broen). Hent og kopier den fra Analytics-oppsett-panelet i cockpiten.`
        : `Event-plan generert — legg inn måle-IDer for selve snippeten.`;
    }

    case "guide_platform_setup": {
      const url = str(input.website_url);
      if (!url) throw new Error("Guiden mangler domene.");
      const r = await post("/api/integrations/setup-guides/tailored", { url });
      if (!r.ok) throw new Error(`Guide-skreddersøm feilet (${r.data?.error ?? r.status}).`);
      const wanted = str(input.platform);
      const guides = (r.data?.guides ?? []) as Array<{ key: string; label: string; relevance: string; steps: unknown[] }>;
      const chosen = wanted && wanted !== "alle" ? guides.filter((g) => g.key === wanted) : guides;
      const relLabel: Record<string, string> = { needed: "trengs", fix: "fiks avvik", check_account: "sjekk i kontoen", verify: "ser ut til å være på plass" };
      const lines = chosen.map((g) => `${g.label}: ${relLabel[g.relevance] ?? g.relevance} (${g.steps.length} steg)`);
      return `Skreddersydd oppsett-plan for ${url}: ${lines.join(" · ")}. Full sjekkliste med advarsler ligger i Oppsett-guider-panelet.`;
    }

    case "generate_geo_prerender_plan": {
      const url = str(input.website_url);
      if (!url) throw new Error("GEO-planen mangler domene.");
      const r = await post("/api/integrations/geo-prerender-plan", { url });
      if (!r.ok) throw new Error(`GEO-plan feilet (${r.data?.error ?? r.status}).`);
      const plan = r.data?.plan;
      return `GEO-plan for ${plan?.domain} (plattform: ${plan?.platform}): ${plan?.situation} ${plan?.actions?.length ?? 0} tiltak, ${plan?.pagesToPrerender?.length ?? 0} prioriterte sider. Robots-linjer og serving-oppskrift ligger i Site-audit-panelet («Lag GEO-plan»).`;
    }

    case "submit_indexnow": {
      const host = (str(input.host) ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const urls = strArr(input.urls);
      if (!host || urls.length === 0) throw new Error("IndexNow mangler host eller URL-er.");
      if (!OWN_HOSTS.has(host)) {
        // Ærlig grense: klient-domener krever egen nøkkelfil deployet først.
        throw new Error(`${host} har ikke IndexNow-nøkkelfil deployet ennå — generer og deploy nøkkelfilen (F6-flyten i IndexNow-panelet) før innmelding.`);
      }
      const r = await post("/api/integrations/indexnow/submit", { host, key: OWN_INDEXNOW_KEY, urls });
      if (!r.ok || !r.data?.submitted) throw new Error(r.data?.detail ?? `IndexNow feilet (${r.data?.error ?? r.status}).`);
      return `${r.data.urlCount} URL-er meldt inn til IndexNow for ${host} (HTTP ${r.data.status}).`;
    }

    default:
      return null; // ikke et oppsett-verktøy — callerens switch tar over
  }
}
