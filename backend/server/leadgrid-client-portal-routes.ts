/**
 * leadgrid-client-portal-routes.ts
 *
 * Public klient-portal m/ token-basert tilgang for Leadgrid-kunder.
 * (Egen fil — eksisterende client-portal-routes.ts hører til Role
 * Room client_workspace.)
 *
 * Klienten åpner `theroleroom.com/c/{token}` — ingen registrering,
 * ingen passord. Sidens innhold:
 *
 *   - Velkommen + verdi-budskap (hva Leadgrid er + hvordan det skaper verdi)
 *   - Audit-sammendrag (Leadgrid-score + needs-count)
 *   - Behov-liste oversatt til klient-vennlig norsk språk + avhuking
 *     ("Vi ønsker fokus her") → skaper client_focus_requests
 *   - Leveranser (project_deliverables) m/ status-tidslinje
 *
 * Routes (PUBLIC — ingen auth, kun token):
 *   GET    /api/leadgrid-client/:token             Hent dashbord-data
 *   POST   /api/leadgrid-client/:token/accept      Godta TOS
 *   POST   /api/leadgrid-client/:token/seen        Pulserer last_seen_at
 *   POST   /api/leadgrid-client/:token/focus       Klient ber om fokus
 *          { needs: ['needs_meta_pixel','needs_video'], note?: '...' }
 *          → skaper rader i client_focus_requests + notification til
 *          markedssjef/markedskoordinator hos org-eieren.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { notifyClient } from "./client-notification-service.js";

interface Deps {
  app: Express;
  pool: Pool;
}

// ─────────────────────────────────────────────────────────────────
// Klient-vennlig labels for needs + signals
// ─────────────────────────────────────────────────────────────────

interface NeedLabel { title: string; why: string; icon: string }

const NEED_LABELS: Record<string, NeedLabel> = {
  needs_google_analytics: {
    title: "Mangler Google Analytics 4",
    why: "Uten GA4 kan vi ikke måle hvor besøkende kommer fra eller hva som virker.",
    icon: "chart.bar",
  },
  needs_google_tag_manager: {
    title: "Mangler Google Tag Manager",
    why: "GTM gjør at vi kan legge på ny tracking uten å røre koden hver gang.",
    icon: "rectangle.stack",
  },
  needs_meta_pixel: {
    title: "Mangler Meta Pixel",
    why: "Uten dette kan vi ikke retargete besøkende på Facebook eller Instagram.",
    icon: "person.crop.rectangle",
  },
  needs_google_ads_pixel: {
    title: "Mangler Google Ads conversion-pixel",
    why: "Vi kan ikke måle om Google Ads-spend gir kunder uten denne.",
    icon: "target",
  },
  needs_linkedin_insight: {
    title: "Mangler LinkedIn Insight Tag",
    why: "Kritisk for B2B-leads — uten den taper vi LinkedIn-attribusjon.",
    icon: "link",
  },
  needs_tiktok_pixel: {
    title: "Mangler TikTok Pixel",
    why: "Uten den kan vi ikke kjøre TikTok-ads med ROI-måling.",
    icon: "play.rectangle",
  },
  needs_seo_structured_data: {
    title: "Mangler strukturert SEO-data (JSON-LD)",
    why: "Google viser ikke rich snippets — vi går glipp av høyere CTR.",
    icon: "doc.plaintext",
  },
  needs_ssr_landing: {
    title: "SPA-rendering svekker SEO",
    why: "Googlebot ser tom side ved første crawl. Vi bør lage SSR-landinger.",
    icon: "globe",
  },
  needs_better_website: {
    title: "Trenger nettsidefornyelse",
    why: "Lavt Lighthouse-tall + utdaterte ytelses-mønstre.",
    icon: "wand.and.rays",
  },
  needs_video: {
    title: "Mangler video for tillit",
    why: "Spesielt viktig for B2B + helsetech — kjøpere vil se mennesker, ikke bare logoer.",
    icon: "video",
  },
  needs_reels: {
    title: "Trenger Reels-strategi",
    why: "Reels gir gratis rekkevidde — uten plan misser dere algoritmen.",
    icon: "film",
  },
  needs_photos: {
    title: "Trenger bedre produkt-/team-foto",
    why: "Stockfoto svekker tillit. Vi tar profesjonelle bilder.",
    icon: "photo",
  },
  needs_case_studies: {
    title: "Mangler case-studier",
    why: "Beslutningstakere ber ALLTID om kundecase. Vi lager 3 å vise frem.",
    icon: "doc.text",
  },
  needs_customer_testimonials: {
    title: "Mangler kundeomtaler",
    why: "Sosial bevis er kritisk i B2B. Vi setter opp innhentning + viser dem fram.",
    icon: "quote.bubble",
  },
  needs_review_collection: {
    title: "Mangler Google-omtaler",
    why: "Google rangerer høyere når dere har flere/nyere omtaler. Vi automatiserer innhentning.",
    icon: "star.bubble",
  },
  needs_brand_guidelines: {
    title: "Trenger brand-guidelines",
    why: "Visuell konsistens på tvers av flater — vi lager et dokument alle kan bruke.",
    icon: "swatchpalette",
  },
  needs_recruitment_content: {
    title: "Mangler rekrutterings-innhold",
    why: "Kommunikasjon mot kandidater må ha eget spor — vi lager rekrutterings-hub.",
    icon: "person.2",
  },
  needs_launch_campaign: {
    title: "Trenger launch-kampanje",
    why: "Stor nyhet bør pakkes som en kampanje — ikke bare ett innlegg.",
    icon: "megaphone",
  },
  needs_event_coverage: {
    title: "Mangler event-dekning",
    why: "Foredrag/messer er gull verdt — vi sørger for opptak, foto og lange-haler.",
    icon: "calendar",
  },
  needs_partner_visibility: {
    title: "Mangler partner-synlighet",
    why: "Partnere er en gratis distribusjonskanal — vi orkestrerer felles innhold.",
    icon: "person.line.dotted.person",
  },
  needs_linkedin_presence: {
    title: "Trenger sterkere LinkedIn-tilstedeværelse",
    why: "B2B-beslutningstakere lever på LinkedIn. Vi setter opp innholdskalender.",
    icon: "link.badge.plus",
  },
  needs_landing_page: {
    title: "Mangler dedikerte landingssider",
    why: "Per-kampanje-landingssider konverterer 2-3x bedre enn hovedside.",
    icon: "rectangle.fill.on.rectangle.fill",
  },
  needs_seo_local: {
    title: "Trenger lokal-SEO",
    why: "Riktig oppsett av Google Business + lokal-strukturert data.",
    icon: "mappin.circle",
  },
};

function clientFriendlyNeed(needType: string): NeedLabel {
  return NEED_LABELS[needType] ?? {
    title: needType.replace(/^needs_/, "").replace(/_/g, " "),
    why: "Identifisert behov for forbedring i dette området.",
    icon: "questionmark.circle",
  };
}

const SIGNAL_LABELS: Record<string, string> = {
  has_google_search_console_verified: "Allerede registrert i Google Search Console",
  has_sitemap_with_lastmod: "Har sitemap med oppdaterings-datoer",
  has_open_graph_complete: "Komplett Open Graph for sosiale medier",
  has_canonical: "Har riktig satt canonical-URL",
  has_clear_value_prop: "Tydelig verdiproposisjon",
  has_nextjs_ssr: "Bygget med moderne SSR-teknologi",
  has_instagram_presence: "Aktiv på Instagram",
  has_linkedin_company_page: "Har LinkedIn-bedriftsside",
  security_focused_messaging: "Tydelig sikkerhets-fokus i kommunikasjon",
  high_google_rating: "Høy Google-rating",
  strong_visual_product: "Sterkt visuelt produkt",
  clear_value_prop: "Tydelig verdiproposisjon",
  missing_all_analytics: "Ingen webanalyse-data samles inn",
  missing_all_ads_pixels: "Ingen ads-pixler er installert",
  missing_structured_data: "Mangler strukturert SEO-data",
  spa_rendering_seo_risk: "SPA-rendering svekker Google-indeksering",
  low_image_optimization: "Bilder ikke optimalisert",
  low_instagram_activity: "Lav aktivitet på Instagram",
  missing_robots_txt: "Mangler robots.txt",
  missing_sitemap: "Mangler sitemap.xml",
  outdated_branding: "Utdatert brandinguttrykk",
  mobile_unfriendly_site: "Nettside ikke mobilvennlig",
  slow_page_speed: "Lav lastetid",
  no_gmb_photos: "Ingen bilder på Google Business",
  competitor_outranks: "Konkurrent rangerer høyere",
};

function clientFriendlySignal(signalType: string): string {
  return SIGNAL_LABELS[signalType] ?? signalType.replace(/_/g, " ");
}

// ─────────────────────────────────────────────────────────────────
// Token-validering (felles)
// ─────────────────────────────────────────────────────────────────

interface TokenRow {
  id: string;
  organization_id: string;
  project_id: string;
  customer_id: string;
  invited_email: string;
  invited_name: string | null;
  invited_role: string;
  accepted_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  first_opened_at: string | null;
}

async function loadToken(pool: Pool, token: string): Promise<TokenRow | null> {
  const r = await pool.query<TokenRow>(
    `SELECT id::text, organization_id::text, project_id, customer_id,
            invited_email, invited_name, invited_role,
            accepted_at::text, expires_at::text, revoked_at::text,
            first_opened_at::text
       FROM client_portal_tokens WHERE token = $1 LIMIT 1`,
    [token],
  );
  return r.rows[0] ?? null;
}

function tokenExpired(t: TokenRow): boolean {
  if (t.revoked_at) return true;
  return new Date(t.expires_at).getTime() < Date.now();
}

// ─────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────

export function registerClientPortalRoutes({ app, pool }: Deps): void {
  const ROOT = "/api/leadgrid-client";

  // GET /:token — dashboard
  app.get(`${ROOT}/:token`, async (req: Request, res: Response) => {
    try {
      const t = await loadToken(pool, req.params.token);
      if (!t) return res.status(404).json({ error: "Lenken finnes ikke" });
      if (tokenExpired(t)) return res.status(410).json({ error: "Lenken er utløpt" });

      await pool.query(
        `UPDATE client_portal_tokens
            SET first_opened_at = COALESCE(first_opened_at, now()),
                last_seen_at = now(),
                view_count = view_count + 1
          WHERE id = $1`,
        [t.id],
      );

      const orgRes = await pool.query<{ name: string; description: string | null }>(
        `SELECT name, description FROM organizations WHERE id = $1`,
        [t.organization_id],
      );

      const custRes = await pool.query<{
        name: string; website_url: string | null; logo_url: string | null;
        ai_opportunity_score: number | null; lead_category: string | null;
      }>(
        `SELECT name, website_url, logo_url, ai_opportunity_score, lead_category
           FROM crm_customers WHERE id::text = $1 LIMIT 1`,
        [t.customer_id],
      );

      const needsRes = await pool.query<{
        need_type: string; priority: number; status: string; evidence: string | null;
      }>(
        `SELECT need_type, priority, status, evidence
           FROM crm_customer_needs
          WHERE customer_id = $1
            AND status IN ('detected', 'accepted', 'resolved')
          ORDER BY priority DESC, need_type`,
        [t.customer_id],
      );

      const signalsRes = await pool.query<{
        signal_type: string; polarity: string; raw_value: string | null;
      }>(
        `SELECT signal_type, polarity, raw_value
           FROM crm_customer_signals WHERE customer_id = $1
          ORDER BY polarity, signal_type`,
        [t.customer_id],
      );

      const delsRes = await pool.query<{
        id: string; title: string | null; client_summary: string | null;
        status: string; target_date: string | null;
        completed_at: string | null; related_need_type: string | null;
      }>(
        `SELECT id::text, title, client_summary, status,
                target_date::text, completed_at::text, related_need_type
           FROM project_deliverables
          WHERE project_id = $1 AND is_visible_to_client = true
          ORDER BY
            CASE status
              WHEN 'in_progress' THEN 1
              WHEN 'ready_for_review' THEN 2
              WHEN 'planned' THEN 3
              WHEN 'completed' THEN 4
              WHEN 'blocked' THEN 5
              ELSE 6 END,
            target_date NULLS LAST`,
        [t.project_id],
      );

      // Hvilke needs har klienten allerede bedt om fokus på?
      const focusRes = await pool.query<{ need_type: string; status: string }>(
        `SELECT need_type, status FROM client_focus_requests
          WHERE customer_id = $1`,
        [t.customer_id],
      );
      const focusedNeeds = new Map(focusRes.rows.map((r) => [r.need_type, r.status]));

      return res.json({
        token_meta: {
          accepted: t.accepted_at != null,
          first_visit: t.first_opened_at == null,
          invited_name: t.invited_name,
          invited_email: t.invited_email,
        },
        organization: {
          name: orgRes.rows[0]?.name ?? "Creatorhub",
          description: orgRes.rows[0]?.description ?? null,
        },
        customer: {
          name: custRes.rows[0]?.name ?? null,
          website_url: custRes.rows[0]?.website_url ?? null,
          logo_url: custRes.rows[0]?.logo_url ?? null,
          industry: custRes.rows[0]?.lead_category ?? null,
        },
        leadgrid_value: {
          tagline: "Vi gjør kunder synlige og målbare.",
          one_liner:
            "Leadgrid er operativsystemet vi bruker for å skanne din digitale " +
            "tilstedeværelse, finne hva som svikter, og dokumentere fremgang " +
            "i sanntid — slik at du ser hva vi gjør og hvorfor det betyr noe.",
          three_steps: [
            { title: "Vi tråler", body: "Tråler hele websiten + sosiale flater for å se hva som finnes og hva som mangler." },
            { title: "Vi skårer", body: "Hver mangel får en prioritering basert på hva som faktisk flytter omsetning." },
            { title: "Vi leverer", body: "Du følger med på fremgang i denne portalen — fra første crawl til siste pixel-implementering." },
          ],
        },
        audit: {
          composite_score: custRes.rows[0]?.ai_opportunity_score ?? null,
          needs: needsRes.rows.map((n) => {
            const friendly = clientFriendlyNeed(n.need_type);
            return {
              need_type: n.need_type,
              priority: n.priority,
              status: n.status,
              focus_status: focusedNeeds.get(n.need_type) ?? null,
              ...friendly,
            };
          }),
          signals: {
            positive: signalsRes.rows
              .filter((s) => s.polarity === "positive")
              .map((s) => ({
                signal_type: s.signal_type,
                label: clientFriendlySignal(s.signal_type),
                raw_value: s.raw_value,
              })),
            negative: signalsRes.rows
              .filter((s) => s.polarity === "negative")
              .map((s) => ({
                signal_type: s.signal_type,
                label: clientFriendlySignal(s.signal_type),
                raw_value: s.raw_value,
              })),
          },
        },
        deliverables: delsRes.rows,
      });
    } catch (err) {
      return res.status(500).json({
        error: "portal_load_failed", detail: String(err).slice(0, 500),
      });
    }
  });

  // POST /:token/accept
  app.post(`${ROOT}/:token/accept`, async (req: Request, res: Response) => {
    try {
      const r = await pool.query(
        `UPDATE client_portal_tokens
            SET accepted_at = COALESCE(accepted_at, now()), last_seen_at = now()
          WHERE token = $1 AND revoked_at IS NULL AND expires_at > now()
          RETURNING accepted_at::text`,
        [req.params.token],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "not_found_or_expired" });
      return res.json({ accepted: true, accepted_at: r.rows[0].accepted_at });
    } catch (err) {
      return res.status(500).json({ error: "accept_failed", detail: String(err) });
    }
  });

  // POST /:token/seen
  app.post(`${ROOT}/:token/seen`, async (_req: Request, res: Response) => {
    try {
      await pool.query(
        `UPDATE client_portal_tokens
            SET last_seen_at = now(), view_count = view_count + 1
          WHERE token = $1`,
        [(_req.params as { token: string }).token ?? ""],
      );
    } catch { /* noop */ }
    return res.json({ ok: true });
  });

  // POST /:token/focus — klient ber om fokus på spesifikke needs
  app.post(`${ROOT}/:token/focus`, async (req: Request, res: Response) => {
    try {
      const t = await loadToken(pool, req.params.token);
      if (!t) return res.status(404).json({ error: "not_found" });
      if (tokenExpired(t)) return res.status(410).json({ error: "expired" });

      const body = req.body as { needs?: string[]; note?: string };
      const needs = Array.isArray(body.needs)
        ? body.needs.filter((n) => typeof n === "string").slice(0, 30)
        : [];
      if (needs.length === 0) {
        return res.status(400).json({ error: "needs (array) påkrevd" });
      }
      const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;

      const created: string[] = [];
      for (const needType of needs) {
        const r = await pool.query<{ id: string }>(
          `INSERT INTO client_focus_requests
             (organization_id, project_id, customer_id, client_token,
              need_type, client_note)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (customer_id, need_type) DO UPDATE
             SET client_note = COALESCE(EXCLUDED.client_note, client_focus_requests.client_note),
                 requested_at = now(),
                 status = CASE
                   WHEN client_focus_requests.status = 'declined' THEN 'pending'
                   ELSE client_focus_requests.status END
           RETURNING id::text`,
          [t.organization_id, t.project_id, t.customer_id, req.params.token, needType, note],
        );
        if (r.rows[0]) created.push(r.rows[0].id);
      }

      // Notify markedssjef + markedskoordinator + salgssjef i org-en.
      // Best-effort: failover hvis notification_events-schema er annet.
      try {
        const customerName = await pool.query<{ name: string }>(
          `SELECT name FROM crm_customers WHERE id::text = $1`,
          [t.customer_id],
        );
        const msg = `${customerName.rows[0]?.name ?? "Klient"} ber om fokus på ${needs.length} behov`;
        await pool.query(
          `INSERT INTO notification_events
             (user_id, event_type, lead_id, message, created_at)
           SELECT om.user_id, 'client_focus_request', $2::uuid, $3, now()
             FROM organization_members om
            WHERE om.organization_id = $1
              AND om.role IN ('markedssjef', 'markedskoordinator',
                              'salgssjef', 'admin')`,
          [t.organization_id, t.customer_id, msg],
        );
      } catch { /* schema-variansjon — ikke avbryt */ }

      // Send bekreftelse til klienten (e-post + ev. SMS/WhatsApp etter prefs)
      try {
        await notifyClient(pool, {
          customerId: t.customer_id,
          event: "focus_request_received",
          focusArea: needs.slice(0, 3).join(", "),
          portalToken: req.params.token,
        });
      } catch (e) {
        console.error("[client-portal-focus] notifyClient feilet", e);
      }

      return res.status(201).json({
        created_count: created.length,
        focus_request_ids: created,
        message: "Vi har varslet rådgiveren. De tar kontakt snart.",
      });
    } catch (err) {
      return res.status(500).json({ error: "focus_failed", detail: String(err) });
    }
  });
}
