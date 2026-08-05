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

// ── Oppgaver fra møtelogging: ekte, avhukbar liste (ikke bare visning) ──

let oppgaveSchemaReady = false;
async function ensureOppgaveSchema(pool: Pool): Promise<void> {
  if (oppgaveSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_oppgaver (
      id UUID PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      selskap TEXT NOT NULL,
      lead_id TEXT,
      tittel TEXT NOT NULL,
      frist TEXT,
      kilde TEXT NOT NULL DEFAULT 'mote_etterarbeid',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      done_at TIMESTAMPTZ
    )`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_leadgrid_oppgaver_bruker
      ON leadgrid_oppgaver (organization_id, user_id, status, created_at DESC)`);
  oppgaveSchemaReady = true;
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

// ── Mål & behov (per org + selskap): selgerens mål styrer briefen, og
//    behovsbanken akkumulerer kundeforståelse på tvers av møter/selgere ──

let maalSchemaReady = false;
async function ensureMaalSchema(pool: Pool): Promise<void> {
  if (maalSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_mote_maal (
      organization_id TEXT NOT NULL,
      selskap_key TEXT NOT NULL,
      selskap TEXT NOT NULL,
      maal TEXT NOT NULL DEFAULT '',
      behov JSONB NOT NULL DEFAULT '[]',
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (organization_id, selskap_key)
    )`);
  maalSchemaReady = true;
}

type MaalBehov = { maal: string; behov: string[] };

async function hentMaalBehov(pool: Pool, orgId: string, selskap: string): Promise<MaalBehov | null> {
  try {
    await ensureMaalSchema(pool);
    const r = await pool.query<{ maal: string; behov: unknown }>(
      `SELECT maal, behov FROM leadgrid_mote_maal
        WHERE organization_id = $1 AND selskap_key = lower($2)`,
      [orgId, selskap]);
    const row = r.rows[0];
    if (!row) return null;
    return {
      maal: String(row.maal ?? ""),
      behov: Array.isArray(row.behov) ? (row.behov as string[]).slice(0, 12) : [],
    };
  } catch { return null; }
}

/** Flett nye behov (fra etterarbeidet) inn i banken — unike, maks 12. */
async function flettInnBehov(pool: Pool, orgId: string, selskap: string,
                             userId: string, nye: string[]): Promise<void> {
  if (nye.length === 0) return;
  try {
    await ensureMaalSchema(pool);
    const eksisterende = (await hentMaalBehov(pool, orgId, selskap))?.behov ?? [];
    const sett = new Set(eksisterende.map((b) => b.toLowerCase()));
    const flettet = [...eksisterende];
    for (const b of nye) {
      const trimmet = b.trim().slice(0, 160);
      if (trimmet && !sett.has(trimmet.toLowerCase()) && flettet.length < 12) {
        flettet.push(trimmet);
        sett.add(trimmet.toLowerCase());
      }
    }
    await pool.query(
      `INSERT INTO leadgrid_mote_maal
         (organization_id, selskap_key, selskap, behov, updated_by, updated_at)
       VALUES ($1, lower($2), $2, $3::jsonb, $4, now())
       ON CONFLICT (organization_id, selskap_key)
       DO UPDATE SET behov = $3::jsonb, updated_by = $4, updated_at = now()`,
      [orgId, selskap, JSON.stringify(flettet), userId]);
  } catch (e) {
    console.warn("[motebrief] behov-fletting feilet:", String(e).slice(0, 120));
  }
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
      const [regnskap, anbud, caser, forrigeMote, maalBehov] = await Promise.all([
        hentRegnskap(funnetOrgnr),
        hentAktiveAnbud(funnetOrgnr),
        orgId ? hentVunnedeCase(pool, orgId, brreg?.naering ?? null) : Promise.resolve([]),
        orgId ? hentForrigeMote(pool, orgId, selskap) : Promise.resolve(null),
        orgId ? hentMaalBehov(pool, orgId, selskap) : Promise.resolve(null),
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
        // Selgerens eget mål + behovsbanken (akkumulert kundeforståelse).
        selgers_maal: maalBehov?.maal ?? null,
        kjente_behov: maalBehov?.behov ?? [],
      };

      const prompt = `Du forbereder en norsk B2B-feltselger til et kundemøte. Lag en MØTEBRIEF på norsk basert på faktaene under. Forskningsbaserte regler:
- Kjøpere vil ha NYE ideer og at du forstår VIRKSOMHETEN deres — ikke pitch.
- Spørsmålene skal være åpne, problem-orienterte og spres naturlig i samtalen (Gong: 11–14 totalt; du foreslår de 3 viktigste).
- «Innsikt å by på» skal helst bygge på et av org-ens egne vunnede case når det finnes — ellers en edruelig bransjeobservasjon fra faktaene.
- Ikke finn på tall eller fakta som ikke står i grunnlaget. Er et felt tomt, ignorer det.
- Aktive anbud fra selskapet er et KJØPSSIGNAL — nevn det i mål/vinkel hvis relevant.
- Finnes forrige_mote: åpne oppsummeringen med hva som skjedde sist, og innarbeid uinnfridde løfter i møtemålet («vi lovte X — lever det»).
- Finnes selgers_maal: mote_maal skal BYGGE PÅ selgerens eget mål (spiss det, ikke erstatt det). Finnes kjente_behov: spørsmålene skal grave videre i dem, ikke spørre om ting vi alt vet.

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
          selgers_maal: maalBehov?.maal ?? null,
          kjente_behov: maalBehov?.behov ?? [],
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
   * Mål & behov (per selskap) — UGATED (ingen AI-kostnad): dette er selve
   * datakilden som styrer brief + måloppnåelse. Behovsbanken akkumulerer
   * kundeforståelse på tvers av møter og selgere.
   */
  app.get("/api/leadgrid/moter/maal", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      const selskap = String(req.query.selskap ?? "").trim().slice(0, 200);
      if (!orgId || selskap.length < 2) { res.json({ maal: "", behov: [] }); return; }
      const mb = await hentMaalBehov(pool, orgId, selskap);
      res.json({ maal: mb?.maal ?? "", behov: mb?.behov ?? [] });
    } catch (e) {
      console.error("[motebrief] maal get failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.put("/api/leadgrid/moter/maal", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(400).json({ error: "no_org" }); return; }
      const b = (req.body ?? {}) as Record<string, unknown>;
      const selskap = String(b.selskap ?? "").trim().slice(0, 200);
      if (selskap.length < 2) {
        res.status(400).json({ error: "bad_request", message: "selskap er påkrevd." });
        return;
      }
      const maal = String(b.maal ?? "").slice(0, 600);
      const behov = (Array.isArray(b.behov) ? b.behov : [])
        .map((x) => String(x).trim().slice(0, 160))
        .filter((x) => x.length > 0)
        .slice(0, 12);
      await ensureMaalSchema(pool);
      await pool.query(
        `INSERT INTO leadgrid_mote_maal
           (organization_id, selskap_key, selskap, maal, behov, updated_by, updated_at)
         VALUES ($1, lower($2), $2, $3, $4::jsonb, $5, now())
         ON CONFLICT (organization_id, selskap_key)
         DO UPDATE SET maal = $3, behov = $4::jsonb, updated_by = $5, updated_at = now()`,
        [orgId, selskap, maal, JSON.stringify(behov), session.userId]);
      // Målet endret → dagens brief-cache for selskapet er utdatert.
      for (const key of briefCache.keys()) {
        if (key.includes(`:${selskap.toLowerCase()}:`)) briefCache.delete(key);
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("[motebrief] maal put failed:", e);
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
      const orgnr = typeof b.orgnr === "string" && /^\d{9}$/.test(b.orgnr) ? b.orgnr : null;
      const leadId = typeof b.lead_id === "string" ? b.lead_id.slice(0, 64) : null;
      // Selgerens mål: innsendt verdi vinner, ellers det lagrede målet
      // fra Mål & behov — måloppnåelse vurderes mot dette.
      const lagretMaal = orgId ? await hentMaalBehov(pool, orgId, selskap) : null;
      const moteMaal = (String(b.mote_maal ?? "").slice(0, 400) || lagretMaal?.maal || "");

      const prompt = `Du er etterarbeids-assistenten til en norsk B2B-feltselger. Under er rå notater/transkripsjon fra et kundemøte hos «${selskap}»${kontakt ? ` (kontakt: ${kontakt})` : ""}${moteMaal ? `. Selgerens mål med møtet var: ${moteMaal}` : ""}.

Lag etterarbeidet på norsk. Regler:
- Notatet er STRUKTURERT og kort (situasjon, behov, beslutning/framdrift) — ikke referat av alt.
- «Løfter» = ting VI lovte kunden (leveranser, svar, dokumenter). Kun det som faktisk ble sagt.
- Oppgaver = konkrete neste steg med frist-hint når det ble nevnt («innen torsdag»).
- Oppfølgings-eposten er et UTKAST fra selgeren til kontakten: takk, det vi ble enige om, neste steg m/ dato. Varm, kort, norsk — ingen floskler.
- maal_vurdering: vurder ÆRLIG om selgerens mål ble nådd (nådd/delvis/ikke nådd + én setning hvorfor). Uten oppgitt mål: tom streng.
- nye_behov: kundens behov/utfordringer som kom fram i møtet (korte formuleringer) — disse lagres i behovsbanken for neste brief.
- Ikke finn på noe som ikke står i grunnlaget.

Returner KUN gyldig JSON:
{"notat":"<strukturert møtenotat, 3-6 setninger>",
 "lofter":["<løfte 1>", "..."],
 "oppgaver":[{"tittel":"<oppgave>","frist":"<frist-hint eller tom streng>"}],
 "status_forslag":"<én av: interessert, tilbud_sendes, avvent, tapt, vunnet>",
 "maal_vurdering":"<nådd/delvis/ikke nådd: én setning — eller tom streng>",
 "nye_behov":["<behov 1>", "..."],
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
        notat?: string; lofter?: unknown; oppgaver?: unknown; nye_behov?: unknown;
      };

      // Behovsbanken: flett nye behov inn (unike, cap) — best effort.
      if (orgId && Array.isArray(resultat.nye_behov)) {
        await flettInnBehov(pool, orgId, selskap, session.userId,
                            (resultat.nye_behov as unknown[]).map(String).slice(0, 6));
      }

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
          // Oppgavene blir EKTE avhukbare rader (Oversikt/Neste handlinger)
          // — ikke bare visning i etterarbeids-arket.
          await ensureOppgaveSchema(pool);
          const oppgaveListe = (Array.isArray(resultat.oppgaver) ? resultat.oppgaver : [])
            .slice(0, 10) as Array<{ tittel?: unknown; frist?: unknown }>;
          for (const o of oppgaveListe) {
            const tittel = String(o?.tittel ?? "").trim().slice(0, 300);
            if (!tittel) continue;
            await pool.query(
              `INSERT INTO leadgrid_oppgaver
                 (id, organization_id, user_id, selskap, lead_id, tittel, frist)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [randomUUID(), orgId, session.userId, selskap, leadId, tittel,
               String(o?.frist ?? "").slice(0, 80) || null]);
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

  /**
   * Leadgrid Canvas fase 3: håndskrevne møtenotater (Vision-OCR på iPad)
   * → Claude strukturerer → oppsummering + oppgaver. Oppgavene lander i
   * leadgrid_oppgaver (kilde canvas) og notatet i møteloggen slik at
   * NESTE møtebrief åpner med skissa. Samme AI-nøkkel som møtebrief.
   */
  app.post("/api/leadgrid/canvas/analyse", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      const b = (req.body ?? {}) as Record<string, unknown>;
      const selskap = String(b.selskap ?? "").trim().slice(0, 200);
      const tekst = String(b.tekst ?? "").trim().slice(0, 10_000);
      const leadId = typeof b.lead_id === "string" ? b.lead_id.slice(0, 64) : null;
      // Apple Intelligence-modus: analysen er alt gjort ON-DEVICE (gratis,
      // privat) — vi bare persisterer. Ingen AI-gate (koster ingenting).
      const ferdig = b.ferdig_resultat && typeof b.ferdig_resultat === "object"
        ? b.ferdig_resultat as { oppsummering?: unknown; oppgaver?: unknown; lofter?: unknown }
        : null;
      if (!ferdig) {
        if (!(await assertAnyEntitled(pool, session.userId, MOTE_BRIEF_FEATURE_KEYS, res))) return;
        if (!ANTHROPIC_API_KEY) { res.status(503).json({ error: "ai_unavailable" }); return; }
        if (tekst.length < 10) {
          res.status(400).json({ error: "bad_request", message: "For lite gjenkjent tekst å analysere." });
          return;
        }
      }

      let resultat: { oppsummering?: string; oppgaver?: unknown; lofter?: unknown };
      if (ferdig) {
        resultat = {
          oppsummering: String(ferdig.oppsummering ?? "").slice(0, 2000),
          oppgaver: Array.isArray(ferdig.oppgaver) ? ferdig.oppgaver : [],
          lofter: Array.isArray(ferdig.lofter) ? ferdig.lofter : [],
        };
      } else {
      const prompt = `Du er notat-assistenten til en norsk B2B-feltselger. Under er TEKST GJENKJENT FRA HÅNDSKRIFT (Vision-OCR) fra et tegnet møtenotat${selskap ? ` om «${selskap}»` : ""}. OCR-en kan ha feil — tolk velvillig, men ikke dikt opp innhold.

Lag på norsk:
- oppsummering: 2-4 setninger som fanger essensen (situasjon, behov, neste steg).
- oppgaver: konkrete gjøremål fra notatet, med frist-hint når nevnt («torsdag», «neste uke»). Kun det som faktisk står der.
- lofter: ting selgeren lovte kunden (kan være tom liste).

Returner KUN gyldig JSON:
{"oppsummering":"<2-4 setninger>",
 "oppgaver":[{"tittel":"<oppgave>","frist":"<frist-hint eller tom streng>"}],
 "lofter":["<løfte>", "..."]}

Gjenkjent tekst:
${tekst}`;

      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      const msg = await withAIQuota("claude", null, () =>
        client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 900,
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
           VALUES ($1,$2,$3,$4,'canvas_analyse',$5,$6,$7,$8,$9)`,
          [randomUUID(), orgId ?? "", session.userId, "", "claude-sonnet-4-6",
           prompt.length, inTok, outTok, cost]);
      } catch { /* logging velter aldri svaret */ }

      const match = text.match(/\{[\s\S]*\}/);
      if (!match) { res.status(502).json({ error: "ai_svar_uparsbart" }); return; }
      resultat = JSON.parse(match[0]) as {
        oppsummering?: string; oppgaver?: unknown; lofter?: unknown;
      };
      }
      const oppgaveListe = (Array.isArray(resultat.oppgaver) ? resultat.oppgaver : [])
        .slice(0, 10) as Array<{ tittel?: unknown; frist?: unknown }>;

      // Oppgavene → leadgrid_oppgaver (Oversikt/Neste handlinger).
      if (orgId) {
        try {
          await ensureOppgaveSchema(pool);
          for (const o of oppgaveListe) {
            const tittel = String(o?.tittel ?? "").trim().slice(0, 300);
            if (!tittel) continue;
            await pool.query(
              `INSERT INTO leadgrid_oppgaver
                 (id, organization_id, user_id, selskap, lead_id, tittel, frist, kilde)
               VALUES ($1,$2,$3,$4,$5,$6,$7,'canvas')`,
              [randomUUID(), orgId, session.userId, selskap || "Canvas-notat",
               leadId, tittel, String(o?.frist ?? "").slice(0, 80) || null]);
          }
        } catch (e) {
          console.warn("[canvas-analyse] oppgave-lagring feilet:", String(e).slice(0, 120));
        }
      }

      // Møtelogg-sløyfa: neste brief for selskapet åpner med notatet.
      if (orgId && selskap) {
        try {
          await ensureLoggSchema(pool);
          await pool.query(
            `INSERT INTO leadgrid_mote_logg
               (id, organization_id, user_id, selskap, orgnr, notat, lofter, oppgaver)
             VALUES ($1,$2,$3,$4,NULL,$5,$6::jsonb,$7::jsonb)`,
            [randomUUID(), orgId, session.userId, selskap,
             `[Canvas-notat] ${String(resultat.oppsummering ?? "").slice(0, 1900)}`,
             JSON.stringify(Array.isArray(resultat.lofter) ? resultat.lofter : []),
             JSON.stringify(oppgaveListe)]);
          for (const key of briefCache.keys()) {
            if (key.includes(`:${selskap.toLowerCase()}:`)) briefCache.delete(key);
          }
        } catch (e) {
          console.warn("[canvas-analyse] logg-lagring feilet:", String(e).slice(0, 120));
        }
      }

      res.json({ resultat });
    } catch (e) {
      console.error("[canvas-analyse] failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /**
   * Oppgavelista (UGATED — kjernefunksjon, ingen AI): åpne oppgaver fra
   * møtelogging, bruker-scopet. Vises i Oversikt/Neste handlinger.
   */
  app.get("/api/leadgrid/oppgaver", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.json({ oppgaver: [] }); return; }
      await ensureOppgaveSchema(pool);
      const status = req.query.status === "done" ? "done" : "open";
      const r = await pool.query(
        `SELECT id, selskap, lead_id, tittel, frist, status, created_at
           FROM leadgrid_oppgaver
          WHERE organization_id = $1 AND user_id = $2 AND status = $3
          ORDER BY created_at DESC LIMIT 100`,
        [orgId, session.userId, status]);
      res.json({
        oppgaver: r.rows.map((row) => ({
          id: row.id,
          selskap: row.selskap,
          lead_id: row.lead_id,
          tittel: row.tittel,
          frist: row.frist,
          status: row.status,
          created_at: row.created_at instanceof Date
            ? row.created_at.toISOString() : String(row.created_at),
        })),
      });
    } catch (e) {
      console.error("[motebrief] oppgave-liste failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Huk av / gjenåpne en oppgave (bruker-scopet). */
  app.patch("/api/leadgrid/oppgaver/:id", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const status = (req.body ?? {}).status === "done" ? "done" : "open";
      await ensureOppgaveSchema(pool);
      const r = await pool.query(
        `UPDATE leadgrid_oppgaver
            SET status = $1, done_at = CASE WHEN $1 = 'done' THEN now() ELSE NULL END
          WHERE id = $2 AND user_id = $3`,
        [status, req.params.id, session.userId]);
      if (r.rowCount === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ ok: true, status });
    } catch (e) {
      console.error("[motebrief] oppgave-patch failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
