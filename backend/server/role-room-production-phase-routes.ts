/**
 * role-room-production-phase-routes.ts — «produksjoner på vei».
 *
 * Skuespillere spør om én ting: si fra når en produksjon går fra UTVIKLING til
 * PRE-PRODUKSJON. I utvikling finnes prosjektet på papir; i pre-produksjon
 * begynner casting, opptaksplan og innspilling å bli virkelige, og da er det
 * for sent å oppdage det tilfeldig.
 *
 * Tre ting holdes bevisst fra hverandre:
 *
 *   fase          hvor produksjonen er. Sier ingenting om hvem som får vite.
 *   annonsert     om produksjonen SKAL ut. Av som standard — mange produksjoner
 *                 er under NDA lenge etter at de er reelle, og et system som
 *                 annonserer alt automatisk blir skrudd av av produsenten.
 *   varsel        hvem som har bedt om å bli varslet, og hva som er sendt.
 *
 * Varsler sendes bare ved overgangen INN i pre-produksjon, bare for annonserte
 * produksjoner, bare til dem som har bedt om det, og bare én gang per person
 * per produksjon (primærnøkkelen i production_alert_sends er hele vernet).
 *
 * `kilde` ligger i datamodellen fra dag én fordi den kommer til å bli flere:
 * plattformen nå, NFI-tildelinger og Filmforbundet senere. Da skal ikke
 * tabellene måtte bygges om.
 *
 * Skjema: migrasjon 0646.
 */

import type express from "express";
import type { Pool } from "pg";

import { userCanAccessCastingProject } from "./casting-project-ownership.js";
import { composeEmail } from "./email-design-system.js";
import { sendTransactionalEmail } from "./transactional-email-service.js";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface RoleRoomProductionPhaseRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

const FASER = ["utvikling", "pre_produksjon", "opptak", "etterarbeid", "ferdig"] as const;
type Fase = (typeof FASER)[number];

const FASE_NAVN: Record<Fase, string> = {
  utvikling: "Utvikling",
  pre_produksjon: "Pre-produksjon",
  opptak: "Opptak",
  etterarbeid: "Etterarbeid",
  ferdig: "Ferdig",
};

export function setupRoleRoomProductionPhaseRoutes(
  deps: RoleRoomProductionPhaseRoutesDeps,
): void {
  const { app, pool, getActiveSession } = deps;

  /** Talent-raden for den innloggede brukeren, eller null. */
  async function egetTalentId(req: express.Request): Promise<string | null> {
    const session = getActiveSession(req);
    if (!session?.userId) return null;
    const r = await pool.query(
      `SELECT id FROM talents WHERE owner_user_id = $1 LIMIT 1`,
      [session.userId],
    );
    return r.rows[0]?.id ?? null;
  }

  /**
   * Varsle dem som har bedt om det. Kalles etter at fasen er skrevet, og
   * feiler aldri oppover: fasen er satt uansett, og en e-post som ikke gikk
   * skal ikke rulle tilbake produksjonens egen tilstand.
   */
  async function varsleOmPreProduksjon(prosjekt: {
    id: string;
    name: string;
    project_type: string | null;
  }): Promise<{ sendt: number; hoppet: number }> {
    // Tom prosjekttype-liste betyr «alle typer»: et filter som stilltiende
    // utelukker produksjoner er verre enn ingen filter.
    const mottakere = await pool.query(
      `SELECT t.id, t.display_name, t.email
         FROM talent_production_alerts a
         JOIN talents t ON t.id = a.talent_id
        WHERE a.aktiv = TRUE
          AND t.email IS NOT NULL
          AND (cardinality(a.prosjekttyper) = 0
               OR $1::text = ANY(a.prosjekttyper))
          AND NOT EXISTS (
            SELECT 1 FROM production_alert_sends s
             WHERE s.talent_id = t.id AND s.project_id = $2
          )`,
      [prosjekt.project_type ?? "", prosjekt.id],
    );

    let sendt = 0;
    let hoppet = 0;
    for (const mottaker of mottakere.rows) {
      const emne = `${prosjekt.name} er i pre-produksjon`;
      const { html, text } = composeEmail({
        subject: emne,
        category: "general",
        brand: "roleroom",
        preheader: `${prosjekt.name} har gått fra utvikling til pre-produksjon.`,
        headline: `Hei ${mottaker.display_name ?? "der"}`,
        // Det som gjør varselet verdt å få: hva som endret seg, og hva det
        // betyr for den som leser.
        body: `${prosjekt.name} har gått fra utvikling til pre-produksjon. Det er nå casting, opptaksplan og innspilling planlegges.`,
        table: prosjekt.project_type ? [{ label: "Type", value: prosjekt.project_type }] : [],
        cta: { label: "Se produksjoner på vei", href: `${offentligBase()}/talents/produksjoner` },
        footer: { reason: "Du får denne fordi du har bedt om varsel når produksjoner går inn i pre-produksjon." },
      });

      const svar = await sendTransactionalEmail({
        to: String(mottaker.email),
        subject: emne,
        html,
        text,
      });

      if (svar.sent) {
        // Skrives FØR neste mottaker: krasjer prosessen midtveis, skal de som
        // alt har fått e-post ikke få den på nytt ved neste forsøk.
        await pool.query(
          `INSERT INTO production_alert_sends (talent_id, project_id, kilde)
           VALUES ($1, $2, 'plattform')
           ON CONFLICT (talent_id, project_id) DO NOTHING`,
          [mottaker.id, prosjekt.id],
        );
        sendt += 1;
      } else {
        hoppet += 1;
      }
    }
    return { sendt, hoppet };
  }

  function offentligBase(): string {
    return (process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com").replace(/\/+$/, "");
  }

  // ── PUT /projects/:projectId/fase ───────────────────────────────────
  app.put("/api/role-room/projects/:projectId/fase", async (req, res) => {
    const { projectId } = req.params;
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    // 404, ikke 403: et prosjekt du ikke har tilgang til skal ikke kunne
    // bekreftes ved å prøve id-er.
    if (!(await userCanAccessCastingProject(pool, projectId, session.userId))) {
      return res.status(404).json({ error: "Prosjekt ikke funnet" });
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const fase = FASER.includes(body.fase as Fase) ? (body.fase as Fase) : null;
    if (!fase) {
      return res.status(400).json({ error: `Fasen må være en av: ${FASER.join(", ")}` });
    }
    // Annonsering er et eget, bevisst valg. Utelates feltet, står den som den er.
    const annonser = typeof body.annonser === "boolean" ? body.annonser : null;

    try {
      const før = await pool.query(
        `SELECT phase, announced_at FROM casting_projects WHERE id = $1 LIMIT 1`,
        [projectId],
      );
      if (før.rowCount === 0) return res.status(404).json({ error: "Prosjekt ikke funnet" });
      const forrigeFase: string | null = før.rows[0].phase;

      const r = await pool.query(
        `UPDATE casting_projects
            SET phase = $2,
                phase_changed_at = CASE WHEN phase IS DISTINCT FROM $2 THEN NOW() ELSE phase_changed_at END,
                announced_at = CASE
                  WHEN $3::boolean IS NULL THEN announced_at
                  WHEN $3::boolean THEN COALESCE(announced_at, NOW())
                  ELSE NULL
                END,
                updated_at = NOW()
          WHERE id = $1
          RETURNING id, name, project_type, phase, phase_changed_at, announced_at`,
        [projectId, fase, annonser],
      );
      const prosjekt = r.rows[0];

      // Varselet henger på OVERGANGEN, ikke på tilstanden: settes fasen til
      // pre-produksjon på nytt, skal ingen få e-post en gang til.
      let varsel: { sendt: number; hoppet: number } | null = null;
      if (
        fase === "pre_produksjon"
        && forrigeFase !== "pre_produksjon"
        && prosjekt.announced_at
      ) {
        varsel = await varsleOmPreProduksjon(prosjekt).catch((err) => {
          // Fasen er satt. At varslingen feilet skal stå i loggen, ikke i
          // veien for produsenten.
          console.error("[produksjonsfase] varsling feilet", err);
          return null;
        });
      }

      return res.json({ prosjekt, varsel });
    } catch (err) {
      console.error("[produksjonsfase PUT] failed", err);
      return res.status(500).json({ error: "Klarte ikke å lagre fasen" });
    }
  });

  // ── GET /produksjoner/pa-vei ────────────────────────────────────────
  //
  // Det skuespilleren ser: annonserte produksjoner, nyeste overgang først.
  // Krever innlogging — dette er ikke en offentlig bransjeoversikt, det er en
  // tjeneste for dem som har profil.
  app.get("/api/role-room/produksjoner/pa-vei", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    try {
      const r = await pool.query(
        `SELECT id, name, description, project_type, genre, phase, phase_changed_at, announced_at
           FROM casting_projects
          WHERE announced_at IS NOT NULL
            AND phase IN ('pre_produksjon', 'opptak')
          ORDER BY phase_changed_at DESC NULLS LAST, announced_at DESC
          LIMIT 100`,
      );
      return res.json({
        produksjoner: r.rows.map((rad) => ({
          ...rad,
          fase_navn: FASE_NAVN[rad.phase as Fase] ?? rad.phase,
        })),
      });
    } catch (err) {
      console.error("[produksjoner på vei GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente produksjonene" });
    }
  });

  // ── GET/PUT /talents/me/produksjonsvarsel ───────────────────────────
  app.get("/api/role-room/talents/me/produksjonsvarsel", async (req, res) => {
    const talentId = await egetTalentId(req);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const r = await pool.query(
        `SELECT aktiv, prosjekttyper FROM talent_production_alerts WHERE talent_id = $1`,
        [talentId],
      );
      // Ingen rad = ikke bedt om varsel. Det er en annen tilstand enn «skrudd
      // av», men flaten trenger bare å vite at det er av.
      return res.json(r.rows[0] ?? { aktiv: false, prosjekttyper: [] });
    } catch (err) {
      console.error("[produksjonsvarsel GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente varselvalget" });
    }
  });

  app.put("/api/role-room/talents/me/produksjonsvarsel", async (req, res) => {
    const talentId = await egetTalentId(req);
    if (!talentId) return res.status(401).json({ error: "Innlogging kreves" });

    const body = (req.body || {}) as Record<string, unknown>;
    const aktiv = body.aktiv !== false;
    const typer = Array.isArray(body.prosjekttyper)
      ? body.prosjekttyper.filter((t): t is string => typeof t === "string").slice(0, 20)
      : [];

    try {
      const r = await pool.query(
        `INSERT INTO talent_production_alerts (talent_id, aktiv, prosjekttyper)
         VALUES ($1, $2, $3::text[])
         ON CONFLICT (talent_id)
         DO UPDATE SET aktiv = EXCLUDED.aktiv,
                       prosjekttyper = EXCLUDED.prosjekttyper,
                       updated_at = NOW()
         RETURNING aktiv, prosjekttyper`,
        [talentId, aktiv, typer],
      );
      return res.json(r.rows[0]);
    } catch (err) {
      console.error("[produksjonsvarsel PUT] failed", err);
      return res.status(500).json({ error: "Klarte ikke å lagre varselvalget" });
    }
  });
}
