/**
 * Leadgrid CPV — bedrifter organiseres rundt CPV-koder (Daniel 2026-08-05:
 * «alle bedrifter som legges til i leadgrid får cpv som er egnet»).
 *
 * CPV (Common Procurement Vocabulary) er språket Doffin/anbud snakker.
 * Kundene får egnede koder automatisk fra bransje/kategori-teksten —
 * dermed kan Anbud-flaten matche kunngjøringer mot kundeporteføljen og
 * overvåkninger pre-fylles med kundenes koder.
 *
 * Kolonnen `cpv_koder` (JSON-array som tekst) selvheles på crm_customers.
 * Nye bedrifter fanges av det daglige backfill-cronet (dekker ALLE
 * opprettelses-stier uten å røre dem), og klienten kan hente forslag
 * direkte via GET /cpv-forslag.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

const CRON_TOKEN = process.env.LEADGRID_CRON_TRIGGER_TOKEN ?? "";

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

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    ALTER TABLE crm_customers
      ADD COLUMN IF NOT EXISTS cpv_koder TEXT`);
  schemaReady = true;
}

export function registerLeadgridCpvRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null | Promise<{ userId: string } | null>;
}): void {
  const { app, pool, requireUserSession } = deps;

  // Kolonnen må finnes FØR lead-listene SELECT-er den — selvhel ved boot.
  void ensureSchema(pool).catch((e) =>
    console.warn("[cpv] ensureSchema ved boot feilet:", String(e).slice(0, 120)));

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
   *  Dekker alle opprettelses-stier — nye leads får koder innen et døgn. */
  app.post("/api/leadgrid/cpv/backfill", async (req, res) => {
    const t = req.headers["x-cron-trigger-token"] as string | undefined;
    if (!t || !CRON_TOKEN || t !== CRON_TOKEN) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      await ensureSchema(pool);
      const r = await pool.query<{ id: string; name: string | null; category: string | null }>(
        `SELECT id, name, category FROM crm_customers
          WHERE cpv_koder IS NULL LIMIT 2000`);
      let satt = 0;
      for (const rad of r.rows) {
        const koder = cpvForTekst(`${rad.category ?? ""} ${rad.name ?? ""}`);
        await pool.query(
          `UPDATE crm_customers SET cpv_koder = $1 WHERE id = $2`,
          [JSON.stringify(koder), rad.id]);
        if (koder.length > 0) satt++;
      }
      res.json({ ok: true, behandlet: r.rows.length, medKoder: satt });
    } catch (e) {
      console.error("[cpv] backfill failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
