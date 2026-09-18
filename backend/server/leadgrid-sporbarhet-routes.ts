/**
 * leadgrid-sporbarhet-routes.ts
 *
 * Oversikten en markedssjef trenger: hvordan leads spores, hvor kunden kom
 * fra, hva det kostet, og hva de faktisk kjøpte.
 *
 * Kjeden går gjennom fire migrasjoner som til sammen gjør spørsmålet
 * svarbart — ingen av dem holder til alene:
 *   0633  produktlinjer      hva de kjøpte
 *   0635  salg som egen rad  avtaleverdien, og at én bedrift kan ha flere
 *   0637  utm + klikk-ID     hvor henvendelsen kom fra
 *   0638  kostnad + oppsett  hva annonsen kostet, og hva som er installert
 *
 * Én regel styrer hele filen: **aldri regn et tall som ser riktig ut når
 * grunnlaget mangler.** Er ikke kampanjen koblet til en kostnad, er kostnad
 * per lead `null` — ikke 0. Et nulltall her blir lest som «gratis», og da
 * tar noen en beslutning på et tall vi fant på.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { loadAccessibleLeadgridProject } from "./leadgrid-project-access.js";
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";
import { skannSporing, type SporingsType } from "./leadgrid-sporing-skann.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return activeSessions.get(auth.slice(7)) ?? null;
  return null;
}

/** Vindu i dager. Standard 90 — kort nok til å være relevant, langt nok til
 *  at en B2B-avtale rekker å bli vunnet innenfor det. */
function windowDays(req: Request): number {
  const raw = req.query.days;
  const n = typeof raw === "string" ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 1 && n <= 730) return n;
  return 90;
}

const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

export function registerLeadgridSporbarhetRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  // ── GET /api/leadgrid/sporbarhet/oversikt ──────────────────────────────
  app.get(
    "/api/leadgrid/sporbarhet/oversikt",
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const projectId =
        typeof req.query.projectId === "string" ? req.query.projectId : null;
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      const days = windowDays(req);

      try {
        const project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const scope = [project.organizationId, project.id];

        // 1) Hva er satt opp — og har det noensinne båret data hit?
        //
        // GTM og GA4 kan vi ikke måle fra vår side; de ligger i nettleseren
        // hos kunden. Pixlene kan vi derimot si noe ekte om: kom det et lead
        // inn med fbclid, da VIRKET Meta-sporingen hele veien. Det er et
        // bedre svar enn en grønn hake vi ikke har dekning for.
        const oppsett = await pool.query(
          `SELECT t.kind, t.external_id, t.label, t.created_at,
                  CASE t.kind
                    WHEN 'meta_pixel'   THEN (SELECT MAX(c.created_at) FROM crm_customers c
                                               WHERE c.organization_id = $1::uuid AND c.project_id = $2
                                                 AND c.fbclid IS NOT NULL)
                    WHEN 'tiktok_pixel' THEN (SELECT MAX(c.created_at) FROM crm_customers c
                                               WHERE c.organization_id = $1::uuid AND c.project_id = $2
                                                 AND c.ttclid IS NOT NULL)
                    WHEN 'google_ads'   THEN (SELECT MAX(c.created_at) FROM crm_customers c
                                               WHERE c.organization_id = $1::uuid AND c.project_id = $2
                                                 AND c.gclid IS NOT NULL)
                    ELSE NULL
                  END AS siste_bekreftede_signal
             FROM leadgrid_tracking_setup t
            WHERE t.organization_id = $1::uuid AND t.project_id = $2 AND t.active
            ORDER BY t.kind`,
          scope,
        );

        // 2) Kampanje for kampanje: leads, avtaler, vunnet verdi, kostnad.
        //
        // Leads telles på crm_customers, avtaler på leadgrid_deals. En bedrift
        // kan ha flere salg (mig 0635), så avtaler må telles for seg — ikke
        // som «leads med status vunnet».
        const kampanjer = await pool.query(
          `WITH leads AS (
             SELECT COALESCE(NULLIF(TRIM(c.utm_campaign), ''), '(uten kampanje)') AS kampanje,
                    MIN(NULLIF(TRIM(c.utm_source), '')) AS kilde,
                    COUNT(*)::int AS antall_leads,
                    COUNT(*) FILTER (WHERE c.gclid IS NOT NULL
                                        OR c.fbclid IS NOT NULL
                                        OR c.ttclid IS NOT NULL)::int AS med_klikk_id
               FROM crm_customers c
              WHERE c.organization_id = $1::uuid AND c.project_id = $2
                AND c.archived_at IS NULL
                AND c.created_at > NOW() - make_interval(days => $3::int)
              GROUP BY 1
           ),
           avtaler AS (
             SELECT COALESCE(NULLIF(TRIM(c.utm_campaign), ''), '(uten kampanje)') AS kampanje,
                    COUNT(d.id)::int AS antall_avtaler,
                    COUNT(d.id) FILTER (WHERE d.pipeline_stage = 'won')::int AS antall_vunnet,
                    COALESCE(SUM(d.deal_amount) FILTER (WHERE d.pipeline_stage = 'won'), 0) AS vunnet_verdi,
                    COALESCE(SUM(d.deal_amount) FILTER (WHERE d.pipeline_stage NOT IN ('won','lost')), 0) AS aapen_verdi
               FROM crm_customers c
               JOIN leadgrid_deals d
                 ON d.customer_id = c.id AND d.archived_at IS NULL
              WHERE c.organization_id = $1::uuid AND c.project_id = $2
                AND c.archived_at IS NULL
                AND c.created_at > NOW() - make_interval(days => $3::int)
              GROUP BY 1
           ),
           kostnad AS (
             SELECT l.utm_campaign AS kampanje,
                    MIN(l.platform) AS plattform,
                    SUM(s.spend) AS forbruk,
                    MIN(s.currency) AS valuta,
                    BOOL_OR(s.source = 'manual') AS har_manuelle_tall
               FROM leadgrid_campaign_links l
               JOIN leadgrid_campaign_spend s
                 ON s.organization_id = l.organization_id
                AND s.project_id = l.project_id
                AND s.platform = l.platform
                AND s.external_campaign_id = l.external_campaign_id
                AND s.date > (NOW() - make_interval(days => $3::int))::date
              WHERE l.organization_id = $1::uuid AND l.project_id = $2
              GROUP BY 1
           )
           SELECT leads.kampanje, leads.kilde, leads.antall_leads, leads.med_klikk_id,
                  COALESCE(avtaler.antall_avtaler, 0) AS antall_avtaler,
                  COALESCE(avtaler.antall_vunnet, 0) AS antall_vunnet,
                  COALESCE(avtaler.vunnet_verdi, 0) AS vunnet_verdi,
                  COALESCE(avtaler.aapen_verdi, 0) AS aapen_verdi,
                  kostnad.plattform, kostnad.forbruk, kostnad.valuta,
                  kostnad.har_manuelle_tall
             FROM leads
             LEFT JOIN avtaler ON avtaler.kampanje = leads.kampanje
             LEFT JOIN kostnad ON kostnad.kampanje = leads.kampanje
            ORDER BY COALESCE(avtaler.vunnet_verdi, 0) DESC, leads.antall_leads DESC`,
          [...scope, days],
        );

        // 3) Hva de faktisk kjøpte, per kampanje.
        const produkter = await pool.query(
          `SELECT COALESCE(NULLIF(TRIM(c.utm_campaign), ''), '(uten kampanje)') AS kampanje,
                  li.name AS produkt,
                  SUM(li.quantity)::numeric AS antall,
                  SUM(li.net_total)::numeric AS verdi
             FROM crm_customers c
             JOIN leadgrid_deals d ON d.customer_id = c.id AND d.archived_at IS NULL
             JOIN leadgrid_deal_line_items li ON li.deal_id = d.id
            WHERE c.organization_id = $1::uuid AND c.project_id = $2
              AND c.archived_at IS NULL
              AND d.pipeline_stage = 'won'
              AND c.created_at > NOW() - make_interval(days => $3::int)
            GROUP BY 1, 2
            ORDER BY 1, 4 DESC`,
          [...scope, days],
        );
        const produkterPerKampanje = new Map<string, Array<Record<string, unknown>>>();
        for (const row of produkter.rows) {
          const list = produkterPerKampanje.get(row.kampanje) ?? [];
          list.push({ produkt: row.produkt, antall: num(row.antall), verdi: num(row.verdi) });
          produkterPerKampanje.set(row.kampanje, list);
        }

        const rader = kampanjer.rows.map((r) => {
          const leads = Number(r.antall_leads);
          const vunnet = Number(r.antall_vunnet);
          const forbruk = r.forbruk === null ? null : Number(r.forbruk);
          const vunnetVerdi = Number(r.vunnet_verdi);
          return {
            kampanje: r.kampanje,
            kilde: r.kilde,
            plattform: r.plattform,
            antall_leads: leads,
            med_klikk_id: Number(r.med_klikk_id),
            antall_avtaler: Number(r.antall_avtaler),
            antall_vunnet: vunnet,
            vunnet_verdi: vunnetVerdi,
            aapen_verdi: Number(r.aapen_verdi),
            produkter: produkterPerKampanje.get(r.kampanje) ?? [],
            forbruk,
            valuta: r.valuta ?? "NOK",
            kostnad_kilde: forbruk === null ? "ikke_koblet" : r.har_manuelle_tall ? "manuell" : "api",
            // null, ikke 0, når kostnaden mangler. Et nulltall her leses som
            // «gratis», og da tas beslutningen på noe vi ikke vet.
            kostnad_per_lead: forbruk !== null && leads > 0 ? Math.round((forbruk / leads) * 100) / 100 : null,
            kostnad_per_vunnet: forbruk !== null && vunnet > 0 ? Math.round((forbruk / vunnet) * 100) / 100 : null,
            roas: forbruk !== null && forbruk > 0 ? Math.round((vunnetVerdi / forbruk) * 100) / 100 : null,
          };
        });

        // 4) Hullene. Det er disse som gjør oversikten handlingsdyktig —
        // en tabell uten dem lar folk tro at tomme tall betyr null resultat.
        const hull: string[] = [];
        const utenKampanje = rader.find((r) => r.kampanje === "(uten kampanje)");
        if (utenKampanje && utenKampanje.antall_leads > 0) {
          hull.push(
            `${utenKampanje.antall_leads} av leadene siste ${days} dager kom uten utm_campaign. ` +
              `De kan ikke tilskrives noen kampanje.`,
          );
        }
        const ukoblede = rader.filter(
          (r) => r.kampanje !== "(uten kampanje)" && r.forbruk === null,
        );
        if (ukoblede.length) {
          hull.push(
            `${ukoblede.length} kampanje(r) mangler kostnadskobling, så kostnad per lead ikke kan regnes: ` +
              ukoblede.map((r) => r.kampanje).slice(0, 5).join(", "),
          );
        }
        if (oppsett.rowCount === 0) {
          hull.push(
            "Ingen sporing er registrert på prosjektet. Legg inn GTM-container, " +
              "GA4-måle-id og pixlene for å se hva som faktisk er installert.",
          );
        }
        for (const o of oppsett.rows) {
          if (["gtm", "ga4", "linkedin_insight"].includes(o.kind)) continue;
          if (!o.siste_bekreftede_signal) {
            hull.push(
              `${o.kind} (${o.external_id}) er registrert, men ingen lead har kommet inn med ` +
                `klikk-ID derfra. Enten fyrer ikke sporingen, eller så sendes ikke klikk-ID-en med skjemaet.`,
            );
          }
        }
        const totaltLeads = rader.reduce((s, r) => s + r.antall_leads, 0);
        const totaltMedKlikkId = rader.reduce((s, r) => s + r.med_klikk_id, 0);
        if (totaltLeads > 0 && totaltMedKlikkId === 0) {
          hull.push(
            "Ingen leads har klikk-ID. Uten den kan en vunnet avtale aldri rapporteres " +
              "tilbake til annonseplattformen, og plattformen optimaliserer videre mot " +
              "skjema-utfyllinger i stedet for mot omsetning.",
          );
        }

        res.json({
          prosjekt: project.id,
          vindu_dager: days,
          sporing: oppsett.rows.map((o) => ({
            type: o.kind,
            id: o.external_id,
            navn: o.label,
            registrert: o.created_at,
            // GTM og GA4 kjører i nettleseren og kan ikke bekreftes herfra.
            bekreftelse: ["gtm", "ga4", "linkedin_insight"].includes(o.kind)
              ? "kan_ikke_bekreftes_fra_server"
              : o.siste_bekreftede_signal
                ? "bekreftet"
                : "ingen_data",
            siste_bekreftede_signal: o.siste_bekreftede_signal,
          })),
          kampanjer: rader,
          totalt: {
            leads: totaltLeads,
            med_klikk_id: totaltMedKlikkId,
            vunnet_verdi: rader.reduce((s, r) => s + r.vunnet_verdi, 0),
            forbruk: rader.some((r) => r.forbruk !== null)
              ? rader.reduce((s, r) => s + (r.forbruk ?? 0), 0)
              : null,
          },
          hull,
        });
      } catch (err) {
        console.error("[sporbarhet/oversikt]", err);
        res.status(500).json({ error: "oversikt_feilet" });
      }
    },
  );

  // ── GET /api/leadgrid/sporbarhet/lead/:id ──────────────────────────────
  // Hele kjeden for én kunde: hvor de kom fra, hva de kjøpte, hva det ga.
  app.get(
    "/api/leadgrid/sporbarhet/lead/:id",
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      try {
        const lead = await loadAccessibleLeadgridLead(pool, {
          leadId: req.params.id,
          userId: session.userId,
        });
        if (!lead) {
          res.status(404).json({ error: "lead_ikke_funnet" });
          return;
        }

        const kunde = await pool.query(
          `SELECT c.name, c.company, c.email, c.lead_source, c.lifecycle_stage,
                  c.utm_source, c.utm_medium, c.utm_campaign, c.utm_term, c.utm_content,
                  c.gclid, c.fbclid, c.ttclid, c.referrer_url, c.landing_page_url,
                  c.created_at
             FROM crm_customers c
            WHERE c.id = $1::uuid AND c.organization_id = $2::uuid AND c.project_id = $3`,
          [lead.id, lead.organizationId, lead.projectId],
        );
        if (!kunde.rowCount) {
          res.status(404).json({ error: "lead_ikke_funnet" });
          return;
        }
        const k = kunde.rows[0];

        const salg = await pool.query(
          `SELECT d.id::text, d.title, d.pipeline_stage, d.deal_amount, d.currency,
                  d.expected_close_date::text, d.renewal_date::text, d.won_at, d.is_primary,
                  COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object(
                              'produkt', li.name,
                              'antall', li.quantity,
                              'enhetspris', li.unit_price,
                              'netto', li.net_total,
                              'frekvens', li.billing_frequency)
                            ORDER BY li.sort_order, li.name)
                       FROM leadgrid_deal_line_items li WHERE li.deal_id = d.id),
                    '[]'::jsonb) AS produktlinjer
             FROM leadgrid_deals d
            WHERE d.customer_id = $1::uuid AND d.archived_at IS NULL
            ORDER BY d.is_primary DESC, d.created_at`,
          [lead.id],
        );

        // Innsendingen som skapte leadet, hvis den kom fra et skjema.
        const innsending = await pool.query(
          `SELECT s.created_at, s.origin, s.landing_page_url, f.name AS skjema
             FROM leadgrid_form_submissions s
             JOIN leadgrid_form_endpoints f ON f.id = s.form_endpoint_id
            WHERE s.lead_id = $1::uuid AND s.status = 'accepted'
            ORDER BY s.created_at
            LIMIT 1`,
          [lead.id],
        );

        res.json({
          lead_id: lead.id,
          kunde: {
            navn: k.name,
            bedrift: k.company,
            epost: k.email,
            livssyklus: k.lifecycle_stage,
            opprettet: k.created_at,
          },
          opprinnelse: {
            kilde: k.lead_source,
            utm_source: k.utm_source,
            utm_medium: k.utm_medium,
            utm_campaign: k.utm_campaign,
            utm_term: k.utm_term,
            utm_content: k.utm_content,
            // Hvilken plattform klikket kom fra, utledet av klikk-ID-en.
            klikk_plattform: k.gclid ? "google" : k.fbclid ? "meta" : k.ttclid ? "tiktok" : null,
            har_klikk_id: Boolean(k.gclid || k.fbclid || k.ttclid),
            landingsside: k.landing_page_url,
            henvisning: k.referrer_url,
            skjema: innsending.rows[0]?.skjema ?? null,
            sendt_inn: innsending.rows[0]?.created_at ?? null,
          },
          salg: salg.rows.map((d) => ({
            id: d.id,
            tittel: d.title,
            fase: d.pipeline_stage,
            belop: num(d.deal_amount),
            valuta: d.currency,
            forventet_lukket: d.expected_close_date,
            fornyelse: d.renewal_date,
            vunnet_tidspunkt: d.won_at,
            primaer: d.is_primary,
            produktlinjer: d.produktlinjer,
          })),
        });
      } catch (err) {
        console.error("[sporbarhet/lead]", err);
        res.status(500).json({ error: "sporbarhet_feilet" });
      }
    },
  );

  // ── POST /api/leadgrid/sporbarhet/skann ────────────────────────────────
  // Finn ut hva som allerede er satt opp, i stedet for å be kunden skrive
  // inn GTM-ID-en sin fra hukommelsen.
  app.post(
    "/api/leadgrid/sporbarhet/skann",
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const projectId =
        typeof body.projectId === "string"
          ? body.projectId
          : typeof body.project_id === "string"
            ? body.project_id
            : null;
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!projectId || !url) {
        res.status(400).json({ error: "project_id_og_url_kreves" });
        return;
      }
      try {
        const project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }

        let skann;
        try {
          skann = await skannSporing(url);
        } catch (err) {
          // SSRF-guarden og nettverksfeil havner her. Meldingen er kort med
          // vilje: den som skanner skal se at det feilet, ikke få et kart
          // over hva som finnes på innsiden av nettet vårt.
          res.status(400).json({
            error: "kunne_ikke_skanne",
            detalj: String((err as Error)?.message ?? "").slice(0, 120),
          });
          return;
        }

        // Hva har prosjektet fra før? Da kan svaret vise hva som er nytt,
        // i stedet for å be noen sammenligne to lister selv.
        const fra_for = await pool.query<{ kind: string; external_id: string }>(
          `SELECT kind, external_id FROM leadgrid_tracking_setup
            WHERE organization_id = $1::uuid AND project_id = $2 AND active`,
          [project.organizationId, project.id],
        );
        const kjent = new Set(fra_for.rows.map((r) => `${r.kind}:${r.external_id}`));

        res.json({
          url: skann.url,
          funn: skann.funn.map((f) => ({
            ...f,
            registrert_fra_for: kjent.has(`${f.type}:${f.id}`),
          })),
          gtm_containere_lest: skann.gtm_containere_lest,
          advarsler: skann.advarsler,
          // Det som mangler helt. Uten TikTok-pixel og Google Ads-tag kan
          // ikke klikk-ID-ene fanges, og da er tilbakerapportering umulig.
          mangler: (["gtm", "ga4", "meta_pixel", "tiktok_pixel", "google_ads"] as SporingsType[])
            .filter((t) => !skann.funn.some((f) => f.type === t)),
        });
      } catch (err) {
        console.error("[sporbarhet/skann]", err);
        res.status(500).json({ error: "skann_feilet" });
      }
    },
  );

  // ── POST /api/leadgrid/sporbarhet/skann/importer ───────────────────────
  // Ett kall tar valgte funn inn i prosjektet. Idempotent, så en gjentatt
  // import ikke lager duplikater.
  app.post(
    "/api/leadgrid/sporbarhet/skann/importer",
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const projectId =
        typeof body.projectId === "string"
          ? body.projectId
          : typeof body.project_id === "string"
            ? body.project_id
            : null;
      const funn = Array.isArray(body.funn) ? body.funn : null;
      if (!projectId || !funn || funn.length === 0) {
        res.status(400).json({ error: "project_id_og_funn_kreves" });
        return;
      }
      if (funn.length > 50) {
        res.status(400).json({ error: "for_mange_funn" });
        return;
      }
      const LOVLIGE: SporingsType[] = [
        "gtm", "ga4", "meta_pixel", "tiktok_pixel", "google_ads",
        "linkedin_insight", "clarity",
      ];
      const rader: Array<{ type: string; id: string; label: string | null; funnet_som: string | null }> = [];
      for (const raw of funn) {
        const f = (raw ?? {}) as Record<string, unknown>;
        const type = typeof f.type === "string" ? f.type : "";
        const id = typeof f.id === "string" ? f.id.trim() : "";
        if (!(LOVLIGE as string[]).includes(type) || !id || id.length > 120) {
          res.status(400).json({ error: "ugyldig_funn", funn: f });
          return;
        }
        rader.push({
          type,
          id,
          label: typeof f.label === "string" ? f.label.slice(0, 160) : null,
          funnet_som: typeof f.kontekst === "string" ? f.kontekst.slice(0, 120) : null,
        });
      }

      try {
        const project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        let lagt_til = 0;
        for (const r of rader) {
          const res2 = await pool.query(
            `INSERT INTO leadgrid_tracking_setup
               (organization_id, project_id, kind, external_id, label,
                source, funnet_som, created_by_user_id)
             VALUES ($1::uuid, $2, $3, $4, $5, 'skann', $6, $7)
             ON CONFLICT DO NOTHING`,
            [project.organizationId, project.id, r.type, r.id, r.label,
             r.funnet_som, session.userId],
          );
          lagt_til += res2.rowCount ?? 0;
        }
        res.status(201).json({ lagt_til, av: rader.length });
      } catch (err) {
        console.error("[sporbarhet/skann/importer]", err);
        res.status(500).json({ error: "import_feilet" });
      }
    },
  );
}
