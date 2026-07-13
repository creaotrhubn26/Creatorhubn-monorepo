/**
 * insight-engine.ts
 *
 * Innsiktsmotoren fase 1 (docs/integration-audit/10): detektorer —
 * rene statistiske funksjoner over normalized_signals/geo-data — som
 * produserer innsikter («hva skjer i markedet?») med evidens, konfidens
 * og deterministisk dedup.
 *
 * Analytisk redelighet (No Fake Insights):
 *  - Min-utvalg-vakter: under minimums-n → INGEN innsikt (heller
 *    stillhet enn falsk alarm; GEO-utvalg er små).
 *  - Konfidens beregnes fra utvalg + magnitude — data, ikke pynt.
 *  - Evidens-plikt: hver innsikt refererer radene den bygger på.
 *
 * Terskler er navngitte konstanter med begrunnelse — domenebeslutninger
 * (Daniels analytiker-rolle) som strammes/løsnes mot reelt støynivå.
 */

import type { Pool } from "pg";

export type InsightSeverity = "info" | "notable" | "important" | "critical";

export interface EvidenceRef {
  ref: string; // signal-id, runId eller annen sporbar referanse
  label: string;
  value: string | number;
}

export interface InsightCandidate {
  detector: string;
  dedupeKey: string;
  severity: InsightSeverity;
  confidence: number;
  title: string;
  explanation: string;
  evidence: EvidenceRef[];
  topic?: string;
  periodStart?: string;
  periodEnd?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Rene stat-hjelpere (enhetstestet)
// ─────────────────────────────────────────────────────────────────────

/** Prosentendring; null når prev=0 (udefinert — håndteres som «ny»). */
export function pctChange(prev: number, curr: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/**
 * Konfidens fra utvalgsstørrelse og relativ endring: små utvalg og små
 * endringer gir lav konfidens. Enkel, gjennomsiktig heuristikk — byttes
 * med ordentlig test når datagrunnlaget vokser.
 */
export function changeConfidence(sampleSize: number, relativeChangePct: number): number {
  const sizeFactor = Math.min(sampleSize / 30, 1); // n=30 → full uttelling
  const magnitudeFactor = Math.min(Math.abs(relativeChangePct) / 100, 1);
  return Math.round(Math.min(0.95, 0.3 + 0.4 * sizeFactor + 0.25 * magnitudeFactor) * 100) / 100;
}

export function severityFromChange(relativeChangePct: number | null, isNew: boolean): InsightSeverity {
  if (isNew) return "notable";
  const abs = Math.abs(relativeChangePct ?? 0);
  if (abs >= 200) return "critical";
  if (abs >= 100) return "important";
  if (abs >= 40) return "notable";
  return "info";
}

// ─────────────────────────────────────────────────────────────────────
// Detektorer
// ─────────────────────────────────────────────────────────────────────

export interface InsightDetector {
  detectorKey: string;
  run(pool: Pool, organizationId: string): Promise<InsightCandidate[]>;
}

/** GEO share-of-voice: min. omtaler i nyeste kjøring for å si ifra. */
const SOV_MIN_MENTIONS = 2; // under dette er endringer støy ved n≈25
const SOV_MIN_DELTA = 2; // absolutt endring i omtaler

const geoSovChangeDetector: InsightDetector = {
  detectorKey: "geo-sov-change",
  async run(pool, organizationId) {
    // To siste målinger per (provider, merke, topic) fra geo-probe-signaler
    const r = await pool.query<{
      provider: string;
      subject_id: string;
      topic: string;
      curr: number;
      prev: number | null;
      curr_id: string;
      curr_collected: string;
    }>(`
      WITH ranked AS (
        SELECT provider, subject_id, topic, metric_value, id, collected_at,
               ROW_NUMBER() OVER (PARTITION BY provider, subject_id, topic
                                  ORDER BY collected_at DESC) AS rn
          FROM normalized_signals
         WHERE organization_id = $1::uuid
           AND provider LIKE 'geo-probe-%'
           AND metric_type = 'ai_mention'
      )
      SELECT a.provider, a.subject_id, a.topic,
             a.metric_value AS curr, b.metric_value AS prev,
             a.id AS curr_id, a.collected_at::text AS curr_collected
        FROM ranked a
        LEFT JOIN ranked b ON b.provider = a.provider
         AND b.subject_id = a.subject_id AND b.topic = a.topic AND b.rn = 2
       WHERE a.rn = 1`,
      [organizationId],
    );

    const out: InsightCandidate[] = [];
    for (const row of r.rows) {
      if (row.prev === null) continue; // trenger to målinger
      const delta = row.curr - row.prev;
      if (Math.abs(delta) < SOV_MIN_DELTA) continue;
      if (Math.max(row.curr, row.prev) < SOV_MIN_MENTIONS) continue;
      const pct = pctChange(row.prev, row.curr);
      const engine = row.provider.replace("geo-probe-", "");
      out.push({
        detector: this.detectorKey,
        dedupeKey: `geo-sov|${row.provider}|${row.subject_id}|${row.topic}|${row.curr_collected.slice(0, 10)}`,
        severity: severityFromChange(pct, false),
        confidence: changeConfidence(row.curr + row.prev, pct ?? 100),
        title: `${row.subject_id}: ${row.prev} → ${row.curr} AI-omtaler (${engine})`,
        explanation: `${row.subject_id} gikk fra ${row.prev} til ${row.curr} omtaler i siste GEO-måling (${engine}, ${row.topic}). Syntetisk måling — se GEO-panelet for kontekst.`,
        evidence: [
          { ref: row.curr_id, label: "siste måling", value: row.curr },
          { ref: `${row.provider}|prev`, label: "forrige måling", value: row.prev },
        ],
        topic: row.topic,
      });
    }
    return out;
  },
};

/** AI-referrals: min. økter før en endring/nyhet er verdt å melde. */
const REFERRAL_MIN_SESSIONS = 5;

const aiReferralChangeDetector: InsightDetector = {
  detectorKey: "ai-referral-change",
  async run(pool, organizationId) {
    const r = await pool.query<{
      topic: string;
      curr: number;
      prev: number | null;
      curr_id: string;
      curr_collected: string;
    }>(`
      WITH ranked AS (
        SELECT topic, metric_value, id, collected_at,
               ROW_NUMBER() OVER (PARTITION BY topic ORDER BY collected_at DESC) AS rn
          FROM normalized_signals
         WHERE organization_id = $1::uuid
           AND metric_type = 'ai_referral_sessions'
      )
      SELECT a.topic, a.metric_value AS curr, b.metric_value AS prev,
             a.id AS curr_id, a.collected_at::text AS curr_collected
        FROM ranked a
        LEFT JOIN ranked b ON b.topic = a.topic AND b.rn = 2
       WHERE a.rn = 1`,
      [organizationId],
    );

    const out: InsightCandidate[] = [];
    for (const row of r.rows) {
      const isNew = row.prev === null || row.prev === 0;
      if (row.curr < REFERRAL_MIN_SESSIONS) continue;
      const pct = isNew ? null : pctChange(row.prev as number, row.curr);
      if (!isNew && Math.abs(pct ?? 0) < 30) continue; // < 30 % = støy
      out.push({
        detector: this.detectorKey,
        dedupeKey: `ai-referral|${row.topic}|${row.curr_collected.slice(0, 10)}`,
        severity: isNew ? "important" : severityFromChange(pct, false),
        confidence: changeConfidence(row.curr, pct ?? 100),
        title: isNew
          ? `Første AI-trafikk fra ${row.topic}: ${row.curr} økter`
          : `AI-trafikk fra ${row.topic}: ${row.prev} → ${row.curr} økter`,
        explanation: isNew
          ? `${row.topic} sender nå besøkende til sidene deres (${row.curr} økter i perioden) — GEO-arbeidet gir målbar trafikk. EKTE GA4-data.`
          : `Referral-trafikken fra ${row.topic} endret seg ${Math.round(pct ?? 0)} %. EKTE GA4-data.`,
        evidence: [{ ref: row.curr_id, label: "GA4 ai_referral_sessions", value: row.curr }],
        topic: row.topic,
      });
    }
    return out;
  },
};

/** GSC-posisjon: fall ≥ 3 plasser på søkeord med reell synlighet. */
const POSITION_DROP_MIN = 3;
const IMPRESSIONS_FLOOR = 50;

const gscPositionDropDetector: InsightDetector = {
  detectorKey: "gsc-position-drop",
  async run(pool, organizationId) {
    const r = await pool.query<{
      topic: string;
      curr: number;
      prev: number | null;
      impressions: number | null;
      curr_id: string;
      curr_collected: string;
    }>(`
      WITH pos AS (
        SELECT topic, metric_value, id, collected_at,
               ROW_NUMBER() OVER (PARTITION BY topic ORDER BY collected_at DESC) AS rn
          FROM normalized_signals
         WHERE organization_id = $1::uuid
           AND provider = 'google-search-console'
           AND metric_type = 'owned_position'
           AND topic NOT LIKE 'sc-domain:%'
      ), imp AS (
        SELECT topic, metric_value,
               ROW_NUMBER() OVER (PARTITION BY topic ORDER BY collected_at DESC) AS rn
          FROM normalized_signals
         WHERE organization_id = $1::uuid
           AND provider = 'google-search-console'
           AND metric_type = 'owned_impressions'
           AND topic NOT LIKE 'sc-domain:%'
      )
      SELECT a.topic, a.metric_value AS curr, b.metric_value AS prev,
             i.metric_value AS impressions,
             a.id AS curr_id, a.collected_at::text AS curr_collected
        FROM pos a
        LEFT JOIN pos b ON b.topic = a.topic AND b.rn = 2
        LEFT JOIN imp i ON i.topic = a.topic AND i.rn = 1
       WHERE a.rn = 1`,
      [organizationId],
    );

    const out: InsightCandidate[] = [];
    for (const row of r.rows) {
      if (row.prev === null) continue;
      const drop = row.curr - row.prev; // høyere posisjonstall = dårligere
      if (drop < POSITION_DROP_MIN) continue;
      if ((row.impressions ?? 0) < IMPRESSIONS_FLOOR) continue;
      out.push({
        detector: this.detectorKey,
        dedupeKey: `gsc-pos|${row.topic}|${row.curr_collected.slice(0, 10)}`,
        severity: drop >= 8 ? "important" : "notable",
        confidence: changeConfidence(row.impressions ?? 0, (drop / Math.max(row.prev, 1)) * 100),
        title: `«${row.topic}» falt fra posisjon ${row.prev.toFixed(1)} til ${row.curr.toFixed(1)} i Google`,
        explanation: `Snittposisjonen for søkeordet falt ${drop.toFixed(1)} plasser (${row.impressions ?? "?"} visninger i perioden). EKTE Search Console-data.`,
        evidence: [
          { ref: row.curr_id, label: "owned_position nå", value: row.curr },
          { ref: `${row.topic}|prev`, label: "forrige", value: row.prev },
        ],
        topic: row.topic,
      });
    }
    return out;
  },
};

/** Discovery: ukjent merke må nevnes ≥ N ganger i siste kjøring. */
const DISCOVERED_MIN_MENTIONS = 3;

/**
 * Generiske produktivitets-/infrastrukturverktøy: at AI nevner dem betyr
 * ikke konkurranse i vår kategori (No Fake Insights). Kategorispesifikke
 * merker (Fiken, Spotlight, Mindbody, DaVinci Resolve) skal IKKE hit —
 * de er reelle kandidater eller kategorisignaler som må vurderes manuelt.
 */
export const GENERIC_TOOL_STOPLIST = new Set([
  "notion", "trello", "asana", "monday.com", "airtable", "slack",
  "discord", "zoom", "microsoft teams", "dropbox", "wetransfer",
  "google drive", "google forms", "google kalender", "google calendar",
  "google docs", "google sheets", "excel", "canva", "vimeo", "youtube",
  "instagram", "facebook", "tiktok", "vipps", "stripe", "paypal",
  "mailchimp", "wordpress", "squarespace", "wix",
]);

const newCompetitorDetector: InsightDetector = {
  detectorKey: "new-discovered-competitor",
  async run(pool, organizationId) {
    const r = await pool.query<{
      set_name: string;
      run_id: string;
      target_brand: string;
      competitor_brands: string[];
      brand: string;
      mentions: number;
    }>(`
      WITH latest_runs AS (
        SELECT DISTINCT ON (ps.id) ps.id AS set_id, ps.name AS set_name,
               ps.target_brand, ps.competitor_brands, r.id AS run_id
          FROM geo_prompt_sets ps
          JOIN geo_probe_runs r ON r.prompt_set_id = ps.id
           AND r.status IN ('completed','partial')
         WHERE ps.organization_id = $1::uuid
         ORDER BY ps.id, r.started_at DESC
      )
      SELECT lr.set_name, lr.run_id::text, lr.target_brand, lr.competitor_brands,
             b AS brand, COUNT(*) AS mentions
        FROM latest_runs lr
        JOIN geo_probe_results pr ON pr.run_id = lr.run_id,
             jsonb_array_elements_text(pr.discovered_brands) b
       GROUP BY lr.set_name, lr.run_id, lr.target_brand, lr.competitor_brands, b
      HAVING COUNT(*) >= ${DISCOVERED_MIN_MENTIONS}`,
      [organizationId],
    );

    const out: InsightCandidate[] = [];
    for (const row of r.rows) {
      const known = new Set(
        [row.target_brand, ...(row.competitor_brands ?? [])].map((x) => x.toLowerCase()),
      );
      const brandLower = row.brand.toLowerCase();
      if (known.has(brandLower) || GENERIC_TOOL_STOPLIST.has(brandLower)) continue;
      out.push({
        detector: this.detectorKey,
        dedupeKey: `new-competitor|${row.set_name}|${row.brand.toLowerCase()}`,
        severity: "notable",
        confidence: changeConfidence(Number(row.mentions) * 5, 100),
        title: `Ny konkurrent-kandidat i «${row.set_name}»: ${row.brand}`,
        explanation: `${row.brand} ble nevnt ${row.mentions} ganger i siste GEO-måling uten å stå i konkurrentlisten. Vurder å legge merket til settet så share-of-voice måles mot det.`,
        evidence: [{ ref: row.run_id, label: "omtaler i siste kjøring", value: Number(row.mentions) }],
        topic: row.set_name,
      });
    }
    return out;
  },
};

/** Salgstriggere: nye trigger_events (14 dager) → innsikter. Faktiske
 *  hendelser med kilde-URL → høy konfidens; anbud er viktigst (frist!). */
const salesTriggerDetector: InsightDetector = {
  detectorKey: "sales-trigger",
  async run(pool, organizationId) {
    const r = await pool.query<{
      source: string;
      event_id: string;
      kind: "tender" | "strategy_media" | "hire" | "ip_filing" | "risk";
      title: string;
      url: string | null;
      published_at: string | null;
      matched_topic: string;
      raw: { deadline?: string | null; valueNok?: number | null; buyerName?: string | null } | null;
    }>(
      `SELECT source, event_id, kind, title, url, published_at, matched_topic, raw
         FROM trigger_events
        WHERE organization_id = $1::uuid
          AND created_at > now() - interval '14 days'
        ORDER BY created_at DESC LIMIT 40`,
      [organizationId],
    );
    return r.rows.map((row): InsightCandidate => ({
      detector: this.detectorKey,
      dedupeKey: `trigger|${row.source}|${row.event_id}`,
      severity: row.kind === "risk" ? "critical" : row.kind === "tender" ? "important" : "notable",
      confidence: 0.9, // faktisk hendelse med kilde — ikke statistisk estimat
      title:
        row.kind === "risk"
          ? `RISIKO: ${row.title.slice(0, 120)}`
          : row.kind === "tender"
          ? `Anbud (${row.matched_topic}): ${row.title.slice(0, 120)}`
          : row.kind === "ip_filing"
          ? `Varemerke-aktivitet: ${row.title.slice(0, 120)}`
          : `Strategisignal — ${row.matched_topic}: ${row.title.slice(0, 120)}`,
      explanation:
        row.kind === "tender"
          ? [
              `Offentlig kunngjøring publisert ${row.published_at ?? "nylig"}`,
              row.raw?.buyerName ? `oppdragsgiver ${row.raw.buyerName}` : null,
              row.raw?.valueNok ? `estimert verdi ${Math.round(row.raw.valueNok / 1000)}k NOK` : null,
              row.raw?.deadline ? `FRIST ${row.raw.deadline}` : null,
              "Vurder om dere kan levere, alene eller som underleverandør.",
            ].filter(Boolean).join(" · ")
          : row.kind === "risk"
          ? `Registerstatus fra Enhetsregisteret (${row.published_at ?? "i dag"}). Sikre utestående krav og vurder leveransestopp — registerfakta, ikke rykter.`
          : row.kind === "ip_filing"
          ? `Fersk sak hos Patentstyret (${row.published_at ?? "nylig"}) — kan varsle lansering, rebrand eller nytt konsept hos ${row.matched_topic}. Godt tidspunkt for kontakt.`
          : `Medieomtale ${row.published_at ?? "siste uke"} som kan signalisere ny strategi/satsing hos ${row.matched_topic}. Les kilden før utspill.`,
      evidence: [
        { ref: row.url ?? `${row.source}|${row.event_id}`, label: `kilde (${row.source})`, value: row.url ?? row.event_id },
      ],
      topic: row.matched_topic,
    }));
  },
};

export const INSIGHT_DETECTORS: InsightDetector[] = [
  geoSovChangeDetector,
  aiReferralChangeDetector,
  gscPositionDropDetector,
  newCompetitorDetector,
  salesTriggerDetector,
];

// ─────────────────────────────────────────────────────────────────────
// Motor: kjør detektorer, lagre m/ dedup
// ─────────────────────────────────────────────────────────────────────

export interface RunInsightsResult {
  organizationId: string;
  detectorsRun: number;
  candidates: number;
  inserted: number;
  errors: string[];
}

export async function runInsightDetectors(
  pool: Pool,
  organizationId: string,
): Promise<RunInsightsResult> {
  const result: RunInsightsResult = {
    organizationId, detectorsRun: 0, candidates: 0, inserted: 0, errors: [],
  };
  for (const detector of INSIGHT_DETECTORS) {
    try {
      const candidates = await detector.run(pool, organizationId);
      result.detectorsRun++;
      result.candidates += candidates.length;
      for (const c of candidates) {
        const r = await pool.query(
          `INSERT INTO insights (
             organization_id, detector, dedupe_key, severity, confidence,
             title, explanation, evidence, topic, period_start, period_end
           ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
           ON CONFLICT (organization_id, dedupe_key) DO NOTHING`,
          [
            organizationId, c.detector, c.dedupeKey, c.severity, c.confidence,
            c.title, c.explanation, JSON.stringify(c.evidence), c.topic ?? null,
            c.periodStart ?? null, c.periodEnd ?? null,
          ],
        );
        result.inserted += r.rowCount ?? 0;
      }
    } catch (err) {
      // Én detektor-feil velter ikke motoren — rapporteres, aldri stille
      result.errors.push(`${detector.detectorKey}: ${String(err).slice(0, 120)}`);
    }
  }
  return result;
}

/** Alle org-er med signaler — kandidater for detektor-kjøring. */
export async function listOrganizationsWithSignals(pool: Pool, limit = 100): Promise<string[]> {
  const r = await pool.query<{ organization_id: string }>(
    `SELECT DISTINCT organization_id::text FROM normalized_signals LIMIT $1`,
    [limit],
  );
  return r.rows.map((row) => row.organization_id);
}
