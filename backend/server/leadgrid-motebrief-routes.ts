/**
 * leadgrid-motebrief-routes.ts
 *
 * Møtebrief-motoren (2026-08-04): «aldri uforberedt til møte».
 * Forskningsgrunnlag: 82–84 % av B2B-kjøpere opplever selgere som
 * uforberedte, og oppgir konkret: mangler case (79 %), forstår ikke
 * utfordringene (78 %), kan ikke virksomheten (76 %). Briefen svarer på
 * nøyaktig de tre — automatisk, på null minutter:
 *
 *   1. VIRKSOMHETEN NÅ  — Brreg (ansatte/næring) + Regnskapsregisteret
 *                         (omsetning/resultat, åpne data) + aktive Doffin-
 *                         anbud (oppdragsgiveren lyser ut = kjøpssignal)
 *   2. HISTORIKKEN VÅR  — CRM-lead (status/eier/neste handling) sendt fra
 *                         klienten + evt. notater
 *   3. MØTEPLANEN       — Claude komponerer: mål, 3 spørsmål (Gong: spredt,
 *                         problem-orientert), 1 innsikt å by på (fra org-ens
 *                         EGNE vunnede case i Leadbook Eksempler → dekker
 *                         «mangler case» med kundens eget materiale),
 *                         sannsynlige innvendinger m/ svar
 *
 * Entitlement: `moteBrief` — kostnadsbærende AI-flate, default AV
 * (isExplicitlyEnabled-mønsteret som leadbookAIStrukturering).
 * Cache: in-memory per (org, selskap, dag) — briefen er fersk nok for
 * dagen, og AI-kostnaden tas én gang.
 *
 * Mount: POST /api/leadgrid/moter/brief
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { assertAnyEntitled, MOTE_BRIEF_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";
import { withAIQuota } from "./leadgrid-ai-queue.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DOFFIN_API_KEY = process.env.DOFFIN_API_KEY ?? "";

// ── Ekstern berikelse (alle best-effort, fail-open) ──────────────────

type BrregFakta = {
  navn?: string;
  orgnr?: string;
  ansatte?: number | null;
  naering?: string | null;
  kommune?: string | null;
  stiftet?: string | null;
};

async function hentBrreg(orgnr: string | null, navn: string): Promise<BrregFakta | null> {
  try {
    let enhet: Record<string, unknown> | null = null;
    if (orgnr && /^\d{9}$/.test(orgnr)) {
      const r = await fetch(
        `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`,
        { signal: AbortSignal.timeout(8_000) });
      if (r.ok) enhet = (await r.json()) as Record<string, unknown>;
    } else if (navn.length >= 3) {
      // Navnesøk — ta beste treff (møtene på iPad har ikke alltid orgnr).
      const r = await fetch(
        `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(navn)}&size=1`,
        { signal: AbortSignal.timeout(8_000) });
      if (r.ok) {
        const j = (await r.json()) as {
          _embedded?: { enheter?: Record<string, unknown>[] };
        };
        enhet = j._embedded?.enheter?.[0] ?? null;
      }
    }
    if (!enhet) return null;
    const naering = (enhet.naeringskode1 as { beskrivelse?: string } | undefined)?.beskrivelse;
    const adresse = enhet.forretningsadresse as { poststed?: string } | undefined;
    return {
      navn: String(enhet.navn ?? navn),
      orgnr: String(enhet.organisasjonsnummer ?? orgnr ?? ""),
      ansatte: typeof enhet.antallAnsatte === "number" ? enhet.antallAnsatte : null,
      naering: naering ?? null,
      kommune: adresse?.poststed ?? null,
      stiftet: typeof enhet.stiftelsesdato === "string" ? enhet.stiftelsesdato : null,
    };
  } catch { return null; }
}

type RegnskapFakta = { aar?: number; omsetning?: number | null; resultat?: number | null };

/** Regnskapsregisteret (åpne data): siste årsregnskap — omsetning/resultat. */
async function hentRegnskap(orgnr: string | null): Promise<RegnskapFakta | null> {
  if (!orgnr || !/^\d{9}$/.test(orgnr)) return null;
  try {
    const r = await fetch(
      `https://data.brreg.no/regnskapsregisteret/regnskap/${orgnr}`,
      { signal: AbortSignal.timeout(8_000), headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const liste = (await r.json()) as Record<string, unknown>[];
    const siste = Array.isArray(liste) ? liste[0] : null;
    if (!siste) return null;
    const res = siste.resultatregnskapResultat as {
      driftsresultat?: { driftsinntekter?: { sumDriftsinntekter?: number } };
      aarsresultat?: number;
    } | undefined;
    const periode = siste.regnskapsperiode as { tilDato?: string } | undefined;
    return {
      aar: periode?.tilDato ? Number(periode.tilDato.slice(0, 4)) : undefined,
      omsetning: res?.driftsresultat?.driftsinntekter?.sumDriftsinntekter ?? null,
      resultat: res?.aarsresultat ?? null,
    };
  } catch { return null; }
}

type AnbudSignal = { tittel: string; frist: string | null };

/** Aktive Doffin-kunngjøringer der selskapet er oppdragsgiver — kjøpssignal. */
async function hentAktiveAnbud(orgnr: string | null): Promise<AnbudSignal[]> {
  if (!DOFFIN_API_KEY || !orgnr || !/^\d{9}$/.test(orgnr)) return [];
  try {
    const params = new URLSearchParams({
      searchString: orgnr, numHitsPerPage: "5", page: "1", status: "ACTIVE",
    });
    const r = await fetch(`https://api.doffin.no/public/v2/search?${params}`, {
      headers: { "Ocp-Apim-Subscription-Key": DOFFIN_API_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { hits?: Record<string, unknown>[] };
    return (j.hits ?? []).slice(0, 3).map((h) => ({
      tittel: String(h.heading ?? h.title ?? "Kunngjøring"),
      frist: typeof h.deadline === "string" ? h.deadline : null,
    })).filter((a) => a.tittel);
  } catch { return []; }
}

type VunnetCase = { tittel: string; bransje: string | null; laerdom: string | null };

/** Org-ens egne VUNNEDE case fra Leadbook Eksempler — «innsikt å by på». */
async function hentVunnedeCase(pool: Pool, orgId: string, bransjeHint: string | null): Promise<VunnetCase[]> {
  try {
    const r = await pool.query<{ title: string; industry: string | null; key_learnings: unknown }>(
      `SELECT title, industry, key_learnings FROM leadbook_examples
        WHERE organization_id = $1 AND outcome = 'won' AND status = 'published'
        ORDER BY (CASE WHEN industry ILIKE '%' || $2 || '%' THEN 0 ELSE 1 END),
                 created_at DESC
        LIMIT 3`,
      [orgId, bransjeHint ?? ""]);
    return r.rows.map((row) => ({
      tittel: row.title,
      bransje: row.industry,
      laerdom: Array.isArray(row.key_learnings)
        ? (row.key_learnings as string[]).slice(0, 2).join("; ")
        : null,
    }));
  } catch { return []; }
}

// ── Møtelogg (fase 3): løftene våre huskes til neste brief ───────────

let loggSchemaReady = false;
async function ensureLoggSchema(pool: Pool): Promise<void> {
  if (loggSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_mote_logg (
      id UUID PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      selskap TEXT NOT NULL,
      orgnr TEXT,
      notat TEXT NOT NULL DEFAULT '',
      lofter JSONB NOT NULL DEFAULT '[]',
      oppgaver JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mote_logg_selskap
      ON leadgrid_mote_logg (organization_id, lower(selskap), created_at DESC)`);
  loggSchemaReady = true;
}

type ForrigeMote = { dato: string; notat: string; lofter: string[] };

async function hentForrigeMote(pool: Pool, orgId: string, selskap: string): Promise<ForrigeMote | null> {
  try {
    await ensureLoggSchema(pool);
    const r = await pool.query<{ created_at: Date; notat: string; lofter: unknown }>(
      `SELECT created_at, notat, lofter FROM leadgrid_mote_logg
        WHERE organization_id = $1 AND lower(selskap) = lower($2)
        ORDER BY created_at DESC LIMIT 1`,
      [orgId, selskap]);
    const row = r.rows[0];
    if (!row) return null;
    return {
      dato: row.created_at.toISOString().slice(0, 10),
      notat: String(row.notat).slice(0, 400),
      lofter: Array.isArray(row.lofter) ? (row.lofter as string[]).slice(0, 5) : [],
    };
  } catch { return null; }
}

// ── Cache (org + selskap + dag) ──────────────────────────────────────

const briefCache = new Map<string, { ts: number; body: unknown }>();
const CACHE_TTL_MS = 6 * 3600 * 1000;

export function registerLeadgridMotebriefRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => Promise<{ userId: string } | null>;
}): void {
  const { app, pool, requireUserSession } = deps;

  app.post("/api/leadgrid/moter/brief", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, MOTE_BRIEF_FEATURE_KEYS, res))) return;
      if (!ANTHROPIC_API_KEY) {
        res.status(503).json({ error: "ai_unavailable" });
        return;
      }
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const selskap = String(b.selskap ?? "").trim().slice(0, 200);
      if (selskap.length < 2) {
        res.status(400).json({ error: "bad_request", message: "selskap er påkrevd." });
        return;
      }
      const orgnr = typeof b.orgnr === "string" && /^\d{9}$/.test(b.orgnr) ? b.orgnr : null;
      const kontakt = String(b.kontakt ?? "").slice(0, 120);
      const kontaktRolle = String(b.kontakt_rolle ?? "").slice(0, 120);
      const motetid = String(b.motetid ?? "").slice(0, 60);
      const notater = String(b.notater ?? "").slice(0, 2000);
      const leadStatus = String(b.lead_status ?? "").slice(0, 60);

      const cacheKey = `${orgId ?? "-"}:${selskap.toLowerCase()}:${new Date().toISOString().slice(0, 10)}`;
      const cached = briefCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        res.json(cached.body);
        return;
      }

      // Berikelse i parallell — alt best-effort.
      const brreg = await hentBrreg(orgnr, selskap);
      const funnetOrgnr = brreg?.orgnr && /^\d{9}$/.test(brreg.orgnr) ? brreg.orgnr : orgnr;
      const [regnskap, anbud, caser, forrigeMote] = await Promise.all([
        hentRegnskap(funnetOrgnr),
        hentAktiveAnbud(funnetOrgnr),
        orgId ? hentVunnedeCase(pool, orgId, brreg?.naering ?? null) : Promise.resolve([]),
        orgId ? hentForrigeMote(pool, orgId, selskap) : Promise.resolve(null),
      ]);

      const fakta = {
        selskap: brreg?.navn ?? selskap,
        orgnr: funnetOrgnr,
        ansatte: brreg?.ansatte ?? null,
        naering: brreg?.naering ?? null,
        kommune: brreg?.kommune ?? null,
        stiftet: brreg?.stiftet ?? null,
        regnskap,
        aktive_anbud: anbud,
        kontakt, kontakt_rolle: kontaktRolle, motetid,
        lead_status: leadStatus,
        notater,
        egne_vunnede_case: caser,
        // Fase 3-sløyfen: løftene fra forrige møte inn i neste brief.
        forrige_mote: forrigeMote,
      };

      const prompt = `Du forbereder en norsk B2B-feltselger til et kundemøte. Lag en MØTEBRIEF på norsk basert på faktaene under. Forskningsbaserte regler:
- Kjøpere vil ha NYE ideer og at du forstår VIRKSOMHETEN deres — ikke pitch.
- Spørsmålene skal være åpne, problem-orienterte og spres naturlig i samtalen (Gong: 11–14 totalt; du foreslår de 3 viktigste).
- «Innsikt å by på» skal helst bygge på et av org-ens egne vunnede case når det finnes — ellers en edruelig bransjeobservasjon fra faktaene.
- Ikke finn på tall eller fakta som ikke står i grunnlaget. Er et felt tomt, ignorer det.
- Aktive anbud fra selskapet er et KJØPSSIGNAL — nevn det i mål/vinkel hvis relevant.
- Finnes forrige_mote: åpne oppsummeringen med hva som skjedde sist, og innarbeid uinnfridde løfter i møtemålet («vi lovte X — lever det»).

Returner KUN gyldig JSON:
{"oppsummering":"<2-3 setninger: hvem er de og hva er situasjonen>",
 "mote_maal":"<konkret mål for DETTE møtet, 1 setning>",
 "sporsmal":["<spørsmål 1>","<spørsmål 2>","<spørsmål 3>"],
 "innsikt":"<1-2 setninger: innsikten/ideen du byr på — referer casen hvis brukt>",
 "innvendinger":[{"innvending":"<sannsynlig innvending>","svar":"<kort svar-vinkel>"}],
 "smalltalk_hint":"<1 setning: lokal/bransje-krok å åpne med, kun fra fakta>"}

Fakta:
${JSON.stringify(fakta)}`;

      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const msg = await withAIQuota("claude", null, () =>
        client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1200,
          messages: [{ role: "user", content: prompt }],
        }));
      const text = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text).join("");
      // Kostnadslogg — best effort (samme tabell/priser som leadbook-AI).
      try {
        const inTok = msg.usage?.input_tokens ?? null;
        const outTok = msg.usage?.output_tokens ?? null;
        const cost = inTok != null && outTok != null ? (inTok * 3 + outTok * 15) / 1_000_000 : null;
        await pool.query(
          `INSERT INTO leadbook_ai_usage
             (id, organization_id, user_id, user_name, feature, model,
              input_chars, input_tokens, output_tokens, cost_usd)
           VALUES ($1,$2,$3,$4,'mote_brief',$5,$6,$7,$8,$9)`,
          [randomUUID(), orgId ?? "", session.userId, "", "claude-sonnet-4-6",
           prompt.length, inTok, outTok, cost]);
      } catch { /* logging velter aldri svaret */ }

      const match = text.match(/\{[\s\S]*\}/);
      if (!match) { res.status(502).json({ error: "ai_svar_uparsbart" }); return; }
      const brief = JSON.parse(match[0]) as Record<string, unknown>;
      const body = {
        brief,
        fakta: {
          selskap: fakta.selskap,
          orgnr: fakta.orgnr,
          ansatte: fakta.ansatte,
          naering: fakta.naering,
          kommune: fakta.kommune,
          omsetning: regnskap?.omsetning ?? null,
          resultat: regnskap?.resultat ?? null,
          regnskap_aar: regnskap?.aar ?? null,
          aktive_anbud: anbud,
          forrige_mote: forrigeMote,
        },
      };
      briefCache.set(cacheKey, { ts: Date.now(), body });
      if (briefCache.size > 500) {
        const eldste = [...briefCache.entries()].sort((a, z) => a[1].ts - z[1].ts)[0];
        if (eldste) briefCache.delete(eldste[0]);
      }
      res.json(body);
    } catch (e) {
      console.error("[motebrief] failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /**
   * Fase 3 — etterarbeidet («hukommelsen og farten»): transkripsjon/notater
   * fra møtet → strukturert notat + løfter + oppgaver + ferdig oppfølgings-
   * epost-UTKAST (aldri auto-send). Glemselskurven: 80 % er glemt på 24t og
   * oppfølging <1t gir 7× — utkastet skal være klart før parkeringsplassen.
   * Loggen persisteres slik at NESTE brief åpner med «hva vi lovte sist».
   */
  app.post("/api/leadgrid/moter/etterarbeid", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      if (!(await assertAnyEntitled(pool, session.userId, MOTE_BRIEF_FEATURE_KEYS, res))) return;
      if (!ANTHROPIC_API_KEY) { res.status(503).json({ error: "ai_unavailable" }); return; }
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const selskap = String(b.selskap ?? "").trim().slice(0, 200);
      const tekst = String(b.tekst ?? "").trim().slice(0, 20_000);
      if (selskap.length < 2 || tekst.length < 20) {
        res.status(400).json({ error: "bad_request", message: "selskap og tekst (møtenotat/transkripsjon) er påkrevd." });
        return;
      }
      const kontakt = String(b.kontakt ?? "").slice(0, 120);
      const moteMaal = String(b.mote_maal ?? "").slice(0, 400);
      const orgnr = typeof b.orgnr === "string" && /^\d{9}$/.test(b.orgnr) ? b.orgnr : null;

      const prompt = `Du er etterarbeids-assistenten til en norsk B2B-feltselger. Under er rå notater/transkripsjon fra et kundemøte hos «${selskap}»${kontakt ? ` (kontakt: ${kontakt})` : ""}${moteMaal ? `. Målet med møtet var: ${moteMaal}` : ""}.

Lag etterarbeidet på norsk. Regler:
- Notatet er STRUKTURERT og kort (situasjon, behov, beslutning/framdrift) — ikke referat av alt.
- «Løfter» = ting VI lovte kunden (leveranser, svar, dokumenter). Kun det som faktisk ble sagt.
- Oppgaver = konkrete neste steg med frist-hint når det ble nevnt («innen torsdag»).
- Oppfølgings-eposten er et UTKAST fra selgeren til kontakten: takk, det vi ble enige om, neste steg m/ dato. Varm, kort, norsk — ingen floskler.
- Ikke finn på noe som ikke står i grunnlaget.

Returner KUN gyldig JSON:
{"notat":"<strukturert møtenotat, 3-6 setninger>",
 "lofter":["<løfte 1>", "..."],
 "oppgaver":[{"tittel":"<oppgave>","frist":"<frist-hint eller tom streng>"}],
 "status_forslag":"<én av: interessert, tilbud_sendes, avvent, tapt, vunnet>",
 "epost":{"emne":"<emnelinje>","brodtekst":"<epost-utkastet>"}}

Rå notater/transkripsjon:
${tekst}`;

      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const msg = await withAIQuota("claude", null, () =>
        client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }));
      const text = msg.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text).join("");
      try {
        const inTok = msg.usage?.input_tokens ?? null;
        const outTok = msg.usage?.output_tokens ?? null;
        const cost = inTok != null && outTok != null ? (inTok * 3 + outTok * 15) / 1_000_000 : null;
        await pool.query(
          `INSERT INTO leadbook_ai_usage
             (id, organization_id, user_id, user_name, feature, model,
              input_chars, input_tokens, output_tokens, cost_usd)
           VALUES ($1,$2,$3,$4,'mote_etterarbeid',$5,$6,$7,$8,$9)`,
          [randomUUID(), orgId ?? "", session.userId, "", "claude-sonnet-4-6",
           prompt.length, inTok, outTok, cost]);
      } catch { /* logging velter aldri svaret */ }

      const match = text.match(/\{[\s\S]*\}/);
      if (!match) { res.status(502).json({ error: "ai_svar_uparsbart" }); return; }
      const resultat = JSON.parse(match[0]) as {
        notat?: string; lofter?: unknown; oppgaver?: unknown;
      };

      // Persistér møteloggen (fase 3-sløyfen) — best effort.
      if (orgId) {
        try {
          await ensureLoggSchema(pool);
          await pool.query(
            `INSERT INTO leadgrid_mote_logg
               (id, organization_id, user_id, selskap, orgnr, notat, lofter, oppgaver)
             VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,
            [randomUUID(), orgId, session.userId, selskap, orgnr,
             String(resultat.notat ?? "").slice(0, 2000),
             JSON.stringify(Array.isArray(resultat.lofter) ? resultat.lofter : []),
             JSON.stringify(Array.isArray(resultat.oppgaver) ? resultat.oppgaver : [])]);
          // Ny logg = neste brief skal IKKE serveres fra dagens cache.
          for (const key of briefCache.keys()) {
            if (key.includes(`:${selskap.toLowerCase()}:`)) briefCache.delete(key);
          }
        } catch (e) {
          console.warn("[motebrief] logg-lagring feilet:", String(e).slice(0, 120));
        }
      }
      res.json({ resultat: JSON.parse(match[0]) });
    } catch (e) {
      console.error("[motebrief] etterarbeid failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
