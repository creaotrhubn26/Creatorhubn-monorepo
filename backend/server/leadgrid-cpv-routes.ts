/**
 * Leadgrid CPV — bedrifter organiseres rundt CPV-koder (Daniel 2026-08-05:
 * «alle bedrifter som legges til i leadgrid får cpv som er egnet»).
 *
 * CPV (Common Procurement Vocabulary) er språket Doffin/anbud snakker.
 * Kundene får egnede koder automatisk fra bransje/kategori-teksten —
 * dermed kan Anbud-flaten matche kunngjøringer mot kundeporteføljen og
 * overvåkninger pre-fylles med kundenes koder.
 *
 * Kolonnen `cpv_koder` (JSON-array som tekst) eies av migrasjonene.
 * Nye Leadgrid-bedrifter fanges av det daglige backfill-cronet, og
 * klienten kan hente forslag direkte via GET /cpv-forslag.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { timingSafeEqual } from "node:crypto";

function hasValidCronToken(received: string | undefined): boolean {
  const expected = process.env.LEADGRID_CRON_TRIGGER_TOKEN ?? "";
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length
    && timingSafeEqual(receivedBuffer, expectedBuffer);
}

/** Kuratert nøkkelord → CPV-hovedgruppe (verifisert mot Doffins koder —
 *  samme koder som bransje-velgeren i Anbud-fanen på iPad). */
const CPV_KART: Array<{ ord: string[]; cpv: string }> = [
  { ord: ["elektro", "elektriker", "elektrisk", "installatør"], cpv: "45310000" },
  { ord: ["bygg", "entreprenør", "anlegg", "byggmester", "tømrer", "snekker"], cpv: "45000000" },
  { ord: ["rørlegger", "vvs", "rør", "sanitær"], cpv: "45330000" },
  { ord: ["renhold", "vask", "rengjøring"], cpv: "90910000" },
  { ord: ["sikkerhet", "vakt", "alarm", "vekter"], cpv: "79710000" },
  { ord: ["it", "data", "software", "programvare", "konsulent it"], cpv: "72000000" },
  { ord: ["transport", "spedisjon", "logistikk", "flytte"], cpv: "60100000" },
  { ord: ["kantine", "catering", "servering"], cpv: "55500000" },
  { ord: ["eiendomsdrift", "eiendomsservice", "facility", "vaktmester"], cpv: "50700000" },
  { ord: ["maler", "overflate", "gulvlegger", "tapetser"], cpv: "45440000" },
  { ord: ["rådgivning", "rådgiver", "konsulent", "arkitekt", "ingeniør"], cpv: "71000000" },
  { ord: ["helse", "omsorg", "lege", "tannlege", "fysioterap"], cpv: "85000000" },
  { ord: ["undervisning", "kurs", "opplæring", "skole"], cpv: "80000000" },
  { ord: ["møbler", "interiør", "innredning"], cpv: "39100000" },
  { ord: ["mat", "dagligvare", "næringsmiddel", "bakeri"], cpv: "15000000" },
  { ord: ["ventilasjon", "kjøling", "varmepumpe", "klima"], cpv: "45331000" },
  { ord: ["taktekking", "tak", "blikkenslager"], cpv: "45260000" },
  { ord: ["grave", "maskinentreprenør", "grunnarbeid"], cpv: "45112000" },
  { ord: ["regnskap", "revisjon", "økonomi"], cpv: "79210000" },
  { ord: ["reklame", "marked", "kommunikasjon", "design"], cpv: "79340000" },
  // 2026-08-19: brede engros/detalj-selgere (BROAD_NACE_DIVISIONS i
  // leadgrid-project-lead-discovery-routes.ts) har ingen søkbar Places-
  // kundetype — anbud/CPV er den reelle discovery-veien for dem.
  { ord: ["kontorrekvisita", "kontorprodukter", "kontormateriell", "kontorutstyr"], cpv: "30190000" },
];

/** Egnede CPV-koder for en bedrift ut fra kategori/navn-tekst. */
export function cpvForTekst(tekst: string): string[] {
  const t = tekst.toLowerCase();
  const treff = new Set<string>();
  for (const rad of CPV_KART) {
    if (rad.ord.some((o) => t.includes(o))) treff.add(rad.cpv);
  }
  return [...treff].slice(0, 4);
}

export function registerLeadgridCpvRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null | Promise<{ userId: string } | null>;
}): void {
  const { app, pool, requireUserSession } = deps;

  /** Forslag for én tekst (bransje/kategori/navn) — brukes av klientene. */
  app.get("/api/leadgrid/cpv-forslag", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const tekst = String(req.query.tekst ?? "").slice(0, 300);
      res.json({ cpv_koder: cpvForTekst(tekst) });
    } catch (e) {
      console.error("[cpv] forslag failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Cron (daglig): sett egnede CPV-koder på alle bedrifter som mangler.
   *  Kun kanoniske Leadgrid-rader med en gyldig organisasjon/prosjekt-
   *  kobling behandles. Universal CRM absorberes aldri implisitt. */
  app.post("/api/leadgrid/cpv/backfill", async (req, res) => {
    const t = req.headers["x-cron-trigger-token"] as string | undefined;
    if (!hasValidCronToken(t)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const r = await pool.query<{
        id: string;
        organization_id: string;
        project_id: string;
        name: string | null;
        category: string | null;
      }>(
        `SELECT c.id::text,
                c.organization_id::text,
                c.project_id,
                c.name,
                c.category
           FROM crm_customers c
           JOIN leadgrid_projects project
             ON project.organization_id = c.organization_id
            AND project.id = c.project_id
          WHERE c.archived_at IS NULL
            AND c.cpv_koder IS NULL
            AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
          ORDER BY c.id
          LIMIT 2000`);

      const updates = r.rows.map((row) => ({
        id: row.id,
        organization_id: row.organization_id,
        project_id: row.project_id,
        cpv_koder: JSON.stringify(
          cpvForTekst(`${row.category ?? ""} ${row.name ?? ""}`),
        ),
      }));

      let updatedRows: Array<{ cpv_koder: string }> = [];
      if (updates.length > 0) {
        const updated = await pool.query<{ cpv_koder: string }>(
          `WITH requested AS (
             SELECT input.id::uuid AS id,
                    input.organization_id::uuid AS organization_id,
                    input.project_id,
                    input.cpv_koder
               FROM jsonb_to_recordset($1::jsonb) AS input(
                 id text,
                 organization_id text,
                 project_id text,
                 cpv_koder text
               )
           )
           UPDATE crm_customers customer
              SET cpv_koder = requested.cpv_koder,
                  updated_at = NOW()
             FROM requested
            WHERE customer.id = requested.id
              AND customer.organization_id = requested.organization_id
              AND customer.project_id = requested.project_id
              AND customer.cpv_koder IS NULL
          RETURNING customer.cpv_koder`,
          [JSON.stringify(updates)],
        );
        updatedRows = updated.rows;
      }

      const medKoder = updatedRows.filter((row) => row.cpv_koder !== "[]").length;
      res.json({
        ok: true,
        behandlet: updatedRows.length,
        medKoder,
        scope: "leadgrid_project",
      });
    } catch (e) {
      console.error("[cpv] backfill failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
