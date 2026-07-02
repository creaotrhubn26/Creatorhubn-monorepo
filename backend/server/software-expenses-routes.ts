/**
 * software-expenses-routes.ts
 *
 * Programvare- og abonnement-kostnader per bruker. To kilder:
 *   1. Manuell registrering (status='bekreftet' med en gang).
 *   2. Auto-uttrekk fra Gmail-kvitteringer: skann innboksen (kun kvittering-
 *      kandidater, read-only), la Claude haiku trekke ut leverandør/produkt/
 *      beløp/syklus/fornyelse, lagre som 'forslag' → brukeren godkjenner.
 *
 * Robusthet er hovedmålet:
 *   - Gmail-kobling mangler / mangler scope  → graceful 200 med status, ikke 500.
 *   - Hver melding parses isolert (try/catch)  → én dårlig e-post velter ikke skann.
 *   - Dedup på (user_id, source_email_id)      → re-skann er idempotent.
 *   - Cost-cap: pre-filtrert Gmail-søk + tak på antall meldinger + haiku-kall.
 *   - Auth via requireUserSession → kun innlogget bruker kan skanne SIN Gmail.
 */
import crypto from "crypto";
import type express from "express";
import type { Pool } from "pg";
import { getFreshMicrosoftAccessToken, listMicrosoftReceiptCandidates } from "./microsoft-graph.js";
import { getGenSettings, emitGenAiMeter } from "./generative-media.js";
import { getUserCredits, creditMove } from "./ai-credits.js";

// KQL-søk for Outlook (Graph $search). Enkle tokens — haiku filtrerer resten.
const MS_RECEIPT_SEARCH = "receipt OR invoice OR kvittering OR faktura OR ordrebekreftelse OR betalingsbekreftelse OR subscription OR renewal";

// Claude Haiku 4.5-priser (USD per token). Brukes til å regne faktisk AI-kost.
const HAIKU_IN_PER_TOKEN = 1.0 / 1_000_000;   // ~$1 / M input
const HAIKU_OUT_PER_TOKEN = 5.0 / 1_000_000;  // ~$5 / M output
const nokPerUsd = () => Number(process.env.ROLE_ROOM_NOK_PER_USD || process.env.USD_NOK_RATE || 11) || 11;

// Belast AI-forbruk mot CreatorHubs Stripe-koblede AI-lommebok (samme system som
// photo-enhance/Nano Banana). credits-modus: trekk retail (kost×påslag) fra saldo.
// metered-modus: emit Stripe meter-event. free_whitelist: inkludert (ingen trekk).
// Returnerer {retailUsd, retailNok} for visning. Feiler aldri hot-path.
async function chargeAiUsage(pool: Pool, userId: string, settings: any, rawCostUsd: number):
  Promise<{ retailUsd: number; retailNok: number }> {
  const markup = settings?.markupMultiplier || 1;
  const retailUsd = rawCostUsd * markup;
  try {
    if (settings?.billingMode === "credits" && retailUsd > 0) {
      await creditMove(pool, userId, "spend", -retailUsd, `receipt-scan:${crypto.randomUUID()}`, "Kvittering-skann (AI)");
    } else if (settings?.billingMode === "metered" && rawCostUsd > 0) {
      await emitGenAiMeter(pool, { userId, valueUsd: rawCostUsd, settings });
    }
  } catch (e) { console.warn("[software-expenses] chargeAiUsage feilet", (e as any)?.message); }
  return { retailUsd, retailNok: Math.round(retailUsd * nokPerUsd() * 100) / 100 };
}

type SessionUser = { userId: string; email: string; name: string; role: string };

export interface SoftwareExpensesRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: express.Request, res: express.Response) => SessionUser | null;
  getGoogleOAuthClient: (pool: Pool, userId: string, preferredOauthApp?: any) => Promise<any>;
}

// Statiske, tilnærmede kurser til NOK. Kvitteringer er som regel i USD/EUR for
// programvare. Vi lagrer BÅDE originalbeløp+valuta og en NOK-omregning (merket
// tilnærmet). Presis FX er ikke poenget — oversikt over størrelsesorden er det.
const FX_TO_NOK: Record<string, number> = {
  NOK: 1, USD: 10.8, EUR: 11.7, GBP: 13.6, SEK: 1.02, DKK: 1.57, CHF: 12.2, CAD: 7.9, AUD: 7.2,
};

const CATEGORIES = [
  "DAW", "Plugin / instrument", "Samplepakke / lydbibliotek", "Redigeringsprogramvare",
  "Foto-software", "Video-software", "Skylagring", "AI-verktøy", "Produktivitet", "Annet",
];

function toNok(amount: number | null, currency: string | null): number | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const cur = (currency || "NOK").toUpperCase();
  const rate = FX_TO_NOK[cur] ?? 1;
  return Math.round(amount * rate);
}

function normCategory(c: unknown): string {
  const s = String(c || "").trim();
  return CATEGORIES.find((x) => x.toLowerCase() === s.toLowerCase()) || "Annet";
}

function normCycle(c: unknown): string {
  const s = String(c || "").trim().toLowerCase();
  if (["monthly", "month", "mnd", "måned", "månedlig"].includes(s)) return "monthly";
  if (["yearly", "year", "annual", "år", "årlig"].includes(s)) return "yearly";
  if (["engang", "one-time", "onetime", "once", "perpetual", "kjøp"].includes(s)) return "engang";
  return "unknown";
}

function safeDate(v: unknown): string | null {
  const s = String(v || "").trim();
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

// ── Gmail helpers ────────────────────────────────────────────────────────────
function header(headers: any[] | undefined, key: string): string | null {
  if (!headers) return null;
  const lower = key.toLowerCase();
  const h = headers.find((x) => String(x?.name || "").toLowerCase() === lower);
  return h?.value ?? null;
}

function decodeB64(data?: string): string {
  if (!data) return "";
  try {
    return Buffer.from(String(data).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch { return ""; }
}

function extractBody(payload: any): string {
  function find(part: any, mime: string): any {
    if (!part) return null;
    if (String(part.mimeType || "").toLowerCase() === mime) return part;
    if (Array.isArray(part.parts)) for (const p of part.parts) { const f = find(p, mime); if (f) return f; }
    return null;
  }
  const plain = find(payload, "text/plain");
  if (plain?.body?.data) return decodeB64(plain.body.data).trim();
  const html = find(payload, "text/html");
  if (html?.body?.data) {
    return decodeB64(html.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  }
  if (payload?.body?.data) return decodeB64(payload.body.data).trim();
  return "";
}

// Gmail-søk: NØKKELORD-forankret på kvittering-ord (matcher hvor som helst i
// meldingen). Tidligere brukte vi en bred from:(google.com OR microsoft.com …)-
// gren UTEN nøkkelordkrav → innboksen flommet av varsler/nyhetsbrev fra de
// domenene og presset de ekte kvitteringene ut av de nyeste treffene. Nå kreves
// et kvittering-ord, så kandidatene faktisk ER kjøp/kvitteringer. haiku filtrerer
// resten. Holder haiku-kost + personvern nede — vi ser aldri på hele innboksen.
const GMAIL_RECEIPT_QUERY = [
  "newer_than:3y",
  "(",
  "receipt OR invoice OR kvittering OR faktura OR ordrebekreftelse",
  "OR \"order confirmation\" OR \"order number\" OR \"your receipt\" OR \"payment received\"",
  "OR \"payment confirmation\" OR \"subscription renewal\" OR \"your subscription\"",
  "OR \"din kvittering\" OR betalingsbekreftelse OR \"takk for kjøpet\" OR \"thanks for your purchase\"",
  ")",
].join(" ");

async function runLimited<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const cur = idx++;
      try { out[cur] = await fn(items[cur], cur); } catch { out[cur] = null as any; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const EXTRACT_PROMPT = (subject: string, from: string, body: string) =>
`Du analyserer en e-post og avgjør om den er en KVITTERING/FAKTURA for et kjøp.
Det kan være PROGRAMVARE/abonnement (Adobe, Splice, Dropbox, App Store) ELLER
FYSISK UTSTYR/hardware (kamera, objektiv, mikrofon, lydkort, PC, drone — fra
f.eks. Elkjøp, Komplett, Thomann, Amazon, B&H, Proshop). Trekk ut felter.

Fra: ${from}
Emne: ${subject}
Tekst (kan være forkortet):
${body}

Svar KUN med gyldig JSON, ingen annen tekst:
{"isReceipt": <true|false>, "itemType": "<hardware|software>",
 "vendor": "<selger/butikk, f.eks. Elkjøp/Adobe>",
 "brand": "<for hardware: PRODUSENT (Sony/Canon/Neumann); for software: samme som vendor>",
 "product": "<produkt/modell/plan>",
 "category": "<for software én av: ${CATEGORIES.join(" | ")}; for hardware f.eks. Kamera|Objektiv|Mikrofon|Lydkort|Monitor|Instrument|PC|Drone|Tilbehør>",
 "amount": <tall uten valutategn, el. null>, "currency": "<ISO f.eks. USD|EUR|NOK>",
 "billingCycle": "<monthly|yearly|engang|unknown>", "isSubscription": <true|false>,
 "serialNumber": "<serienr hvis oppgitt, el. null>",
 "purchaseDate": "<YYYY-MM-DD el. null>", "renewalDate": "<YYYY-MM-DD el. null>",
 "confidence": "<low|medium|high>"}
Regler: itemType=hardware for fysiske produkter (engangskjøp, isSubscription=false),
software for digitale/abonnement. Hvis IKKE en kvittering (nyhetsbrev, support,
varsel, feilmelding, mislykket betaling), sett isReceipt=false. Beløp = faktisk
belastet. Ved usikkerhet null + confidence=low.`;

export function setupSoftwareExpensesRoutes(deps: SoftwareExpensesRoutesDeps): void {
  const { app, pool, requireUserSession, getGoogleOAuthClient } = deps;

  // Belt-and-suspenders: sørg for at tabellen finnes selv om migrasjonen henger.
  let ensured = false;
  async function ensureTable(): Promise<void> {
    if (ensured) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS software_expenses (
        id SERIAL PRIMARY KEY, user_id VARCHAR NOT NULL, vendor VARCHAR, product VARCHAR,
        category VARCHAR, amount_nok NUMERIC(12,2), amount_original NUMERIC(12,2), currency VARCHAR(8),
        billing_cycle VARCHAR(16), is_subscription BOOLEAN DEFAULT false, purchase_date DATE,
        renewal_date DATE, source VARCHAR(16) NOT NULL DEFAULT 'manual', source_email_id VARCHAR,
        confidence VARCHAR(8), status VARCHAR(16) NOT NULL DEFAULT 'bekreftet', note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS software_expenses_user_idx ON software_expenses (user_id)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS software_expenses_user_email_uidx ON software_expenses (user_id, source_email_id) WHERE source_email_id IS NOT NULL`);
    await pool.query(`ALTER TABLE software_expenses ADD COLUMN IF NOT EXISTS item_type varchar(16) DEFAULT 'software'`).catch(() => {});
    await pool.query(`ALTER TABLE software_expenses ADD COLUMN IF NOT EXISTS serial_hint varchar`).catch(() => {});
    await pool.query(`ALTER TABLE software_expenses ADD COLUMN IF NOT EXISTS brand_hint varchar`).catch(() => {});
    ensured = true;
  }

  // Reklamasjonsrett (forbrukerkjøpsloven): 5 år for varige ting (utstyr/elektronikk),
  // 2 år ellers. Returnerer ISO-dato fra kjøpsdato.
  function reklamasjonExpiry(purchaseDate: string | null, years = 5): string | null {
    if (!purchaseDate) return null;
    const d = new Date(purchaseDate);
    if (isNaN(d.getTime())) return null;
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().slice(0, 10);
  }

  function summarize(rows: any[]) {
    const confirmed = rows.filter((r) => r.status === "bekreftet");
    let monthlyNok = 0, yearlyOnceNok = 0;
    for (const r of confirmed) {
      const nok = Number(r.amount_nok) || 0;
      if (!r.is_subscription) { yearlyOnceNok += 0; continue; }
      if (r.billing_cycle === "monthly") monthlyNok += nok;
      else if (r.billing_cycle === "yearly") monthlyNok += nok / 12;
    }
    const byCategory: Record<string, number> = {};
    for (const r of confirmed) {
      const nok = Number(r.amount_nok) || 0;
      const m = r.is_subscription ? (r.billing_cycle === "yearly" ? nok / 12 : r.billing_cycle === "monthly" ? nok : 0) : 0;
      if (m) byCategory[r.category || "Annet"] = (byCategory[r.category || "Annet"] || 0) + m;
    }
    return {
      monthlyNok: Math.round(monthlyNok),
      yearlyNok: Math.round(monthlyNok * 12),
      subscriptionCount: confirmed.filter((r) => r.is_subscription).length,
      byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, Math.round(v)])),
    };
  }

  // ── LIST ──────────────────────────────────────────────────────────────────
  app.get("/api/software/expenses", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      await ensureTable();
      const { rows } = await pool.query(
        `SELECT * FROM software_expenses WHERE user_id = $1 AND status <> 'avvist'
         ORDER BY (status='forslag') DESC, is_subscription DESC, amount_nok DESC NULLS LAST, created_at DESC`,
        [session.userId],
      );
      res.json({
        confirmed: rows.filter((r) => r.status === "bekreftet"),
        suggestions: rows.filter((r) => r.status === "forslag"),
        summary: summarize(rows),
      });
    } catch (e) { console.error("[software-expenses] list", e); res.status(500).json({ error: "list_failed" }); }
  });

  // ── MANUELL registrering ────────────────────────────────────────────────────
  app.post("/api/software/expenses", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      await ensureTable();
      const b = req.body || {};
      const vendor = String(b.vendor || "").trim().slice(0, 200) || null;
      const product = String(b.product || "").trim().slice(0, 200) || null;
      if (!vendor && !product) return res.status(400).json({ error: "missing_name" });
      const currency = String(b.currency || "NOK").toUpperCase().slice(0, 8);
      const amount = b.amount == null || b.amount === "" ? null : Number(b.amount);
      const cycle = normCycle(b.billingCycle);
      const isSub = b.isSubscription != null ? !!b.isSubscription : cycle === "monthly" || cycle === "yearly";
      const { rows } = await pool.query(
        `INSERT INTO software_expenses
           (user_id, vendor, product, category, amount_nok, amount_original, currency,
            billing_cycle, is_subscription, purchase_date, renewal_date, source, status, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'manual','bekreftet',$12) RETURNING *`,
        [session.userId, vendor, product, normCategory(b.category),
         toNok(amount, currency), Number.isFinite(amount) ? amount : null, currency,
         cycle, isSub, safeDate(b.purchaseDate), safeDate(b.renewalDate),
         String(b.note || "").slice(0, 500) || null],
      );
      res.json({ expense: rows[0] });
    } catch (e) { console.error("[software-expenses] create", e); res.status(500).json({ error: "create_failed" }); }
  });

  // ── OPPDATER / godkjenn forslag ─────────────────────────────────────────────
  app.patch("/api/software/expenses/:id", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      await ensureTable();
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
      const b = req.body || {};
      const sets: string[] = []; const vals: any[] = []; let i = 1;
      const put = (col: string, v: any) => { sets.push(`${col} = $${i++}`); vals.push(v); };
      if (b.vendor !== undefined) put("vendor", String(b.vendor).slice(0, 200) || null);
      if (b.product !== undefined) put("product", String(b.product).slice(0, 200) || null);
      if (b.category !== undefined) put("category", normCategory(b.category));
      if (b.currency !== undefined || b.amount !== undefined) {
        const cur = String(b.currency || "NOK").toUpperCase().slice(0, 8);
        const amt = b.amount == null || b.amount === "" ? null : Number(b.amount);
        put("currency", cur); put("amount_original", Number.isFinite(amt as number) ? amt : null); put("amount_nok", toNok(amt as number, cur));
      }
      if (b.billingCycle !== undefined) put("billing_cycle", normCycle(b.billingCycle));
      if (b.isSubscription !== undefined) put("is_subscription", !!b.isSubscription);
      if (b.purchaseDate !== undefined) put("purchase_date", safeDate(b.purchaseDate));
      if (b.renewalDate !== undefined) put("renewal_date", safeDate(b.renewalDate));
      if (b.note !== undefined) put("note", String(b.note).slice(0, 500) || null);
      if (b.status !== undefined && ["forslag", "bekreftet", "avvist"].includes(b.status)) put("status", b.status);
      if (!sets.length) return res.status(400).json({ error: "no_fields" });
      put("updated_at", new Date().toISOString());
      vals.push(id, session.userId);
      const { rows } = await pool.query(
        `UPDATE software_expenses SET ${sets.join(", ")} WHERE id = $${i++} AND user_id = $${i} RETURNING *`, vals,
      );
      if (!rows.length) return res.status(404).json({ error: "not_found" });
      res.json({ expense: rows[0] });
    } catch (e) { console.error("[software-expenses] update", e); res.status(500).json({ error: "update_failed" }); }
  });

  // ── SLETT / avvis ───────────────────────────────────────────────────────────
  app.delete("/api/software/expenses/:id", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      await ensureTable();
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
      // Forslag fra e-post markeres 'avvist' (så re-skann ikke gjenskaper dem),
      // manuelle rader slettes helt.
      const { rows } = await pool.query(
        `UPDATE software_expenses SET status='avvist', updated_at=NOW()
           WHERE id=$1 AND user_id=$2 AND source='email' RETURNING id`, [id, session.userId]);
      if (rows.length) return res.json({ ok: true, rejected: true });
      await pool.query(`DELETE FROM software_expenses WHERE id=$1 AND user_id=$2`, [id, session.userId]);
      res.json({ ok: true, deleted: true });
    } catch (e) { console.error("[software-expenses] delete", e); res.status(500).json({ error: "delete_failed" }); }
  });

  // ── IMPORTER hardware-forslag → utstyrs-inventar (m/ garanti + reklamasjon) ──
  app.post("/api/software/expenses/:id/import-equipment", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      await ensureTable();
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
      const { rows } = await pool.query(`SELECT * FROM software_expenses WHERE id=$1 AND user_id=$2 LIMIT 1`, [id, session.userId]);
      const e = rows[0];
      if (!e) return res.status(404).json({ error: "not_found" });

      const purchaseDate = e.purchase_date ? new Date(e.purchase_date).toISOString().slice(0, 10) : null;
      // Reklamasjonsrett: 5 år for varig utstyr (lovpålagt). Garanti: valgfri, fra body.
      const reklam = reklamasjonExpiry(purchaseDate, 5);
      const warrantyYears = Number(req.body?.warrantyYears) > 0 ? Number(req.body.warrantyYears) : null;
      const warrantyExpiry = warrantyYears && purchaseDate ? reklamasjonExpiry(purchaseDate, warrantyYears) : null;
      // Merke = PRODUSENT (brand_hint), ikke butikk (vendor). Butikk → purchaseVendor.
      const brand = (e.brand_hint || e.vendor || e.product || "Utstyr").slice(0, 120);
      const model = (e.product || e.vendor || "Ukjent").slice(0, 120);
      // Garanti/reklamasjon/kvittering legges under settings.specifications — det er
      // DET inventar-API-et eksponerer som `specifications` (settings selv returneres ikke).
      const settings = {
        specifications: {
          source: "email-receipt", receiptEmailId: e.source_email_id, purchaseVendor: e.vendor,
          reklamasjonExpiry: reklam, warrantyExpiry, purchaseDate, purchasePriceNok: e.amount_nok,
          serialNumber: e.serial_hint || null,
        },
      };
      const eq = await pool.query(
        `INSERT INTO user_equipment
           (user_id, user_type, brand, model, category, purchase_date, purchase_price,
            warranty_expiry, serial_number, condition, settings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'excellent',$10) RETURNING id`,
        [session.userId, req.body?.profession || null, brand, model, e.category || "Utstyr",
         purchaseDate, e.amount_nok, warrantyExpiry, e.serial_hint || null, JSON.stringify(settings)],
      );
      await pool.query(`UPDATE software_expenses SET status='importert', updated_at=NOW() WHERE id=$1 AND user_id=$2`, [id, session.userId]);
      res.json({ ok: true, equipmentId: eq.rows[0]?.id, reklamasjonExpiry: reklam, warrantyExpiry });
    } catch (e) { console.error("[software-expenses] import-equipment", e); res.status(500).json({ error: "import_failed" }); }
  });

  // ── SKANN Gmail for kvitteringer ────────────────────────────────────────────
  app.post("/api/software/scan-receipts", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.json({ status: "ai_unconfigured", created: 0, message: "AI-parsing ikke konfigurert." });
    try {
      await ensureTable();

      // 1. Finn koblede kilder (Gmail og/eller Outlook). Skann alle som er koblet.
      const providers: string[] = [];
      let gmail: any = null;
      try {
        const oauthClient = await getGoogleOAuthClient(pool, session.userId, "creatorhub");
        if (oauthClient) { const { google } = await import("googleapis"); gmail = google.gmail({ version: "v1", auth: oauthClient }); providers.push("google"); }
      } catch { gmail = null; }
      let msToken: string | null = null;
      try { msToken = await getFreshMicrosoftAccessToken(pool, session.userId); if (msToken) providers.push("microsoft"); } catch { msToken = null; }
      if (!providers.length) return res.json({ status: "no_credentials", created: 0, message: "Ingen e-post koblet. Koble til Google eller Outlook for å skanne kvitteringer." });

      // 1b. AI-cost preflight: i credits-modus må lommeboka ha saldo (skann bruker
      // haiku). Blokker med insufficient_credits → panelet ber om Stripe-toppopp.
      const genSettings = await getGenSettings(pool).catch(() => null as any);
      if (genSettings?.billingMode === "credits") {
        const w = await getUserCredits(pool, session.userId).catch(() => ({ balanceUsd: 0 } as any));
        if (!(w.balanceUsd > 0)) {
          return res.json({ status: "insufficient_credits", created: 0, billingMode: "credits", balanceUsd: w.balanceUsd || 0,
            message: "Tom AI-saldo. Fyll på AI-kreditt for å skanne kvitteringer med AI." });
        }
      }

      // 2. Samle kandidater fra hver kilde. Meta bærer provider (+ ferdig tekst for Outlook).
      const candMeta = new Map<string, { provider: string; subject?: string; from?: string; body?: string }>();
      const allIds: string[] = [];
      const sourceErrors: string[] = [];

      if (gmail) {
        try {
          const r = await gmail.users.messages.list({ userId: "me", q: GMAIL_RECEIPT_QUERY, maxResults: 60 });
          for (const m of (r.data.messages || [])) {
            if (m.id && !candMeta.has(m.id)) { candMeta.set(m.id, { provider: "google" }); allIds.push(m.id); }
          }
        } catch (err: any) {
          if (err?.code === 403 || err?.response?.status === 403) sourceErrors.push("gmail_no_scope");
          else sourceErrors.push("gmail_failed");
        }
      }
      if (msToken) {
        try {
          const msgs = await listMicrosoftReceiptCandidates(msToken, MS_RECEIPT_SEARCH, 40);
          for (const m of msgs) {
            if (!candMeta.has(m.id)) { candMeta.set(m.id, { provider: "microsoft", subject: m.subject, from: m.from, body: m.body }); allIds.push(m.id); }
          }
        } catch (err: any) {
          if (err?.status === 401 || err?.status === 403) sourceErrors.push("outlook_no_scope");
          else sourceErrors.push("outlook_failed");
        }
      }
      if (!allIds.length) return res.json({ status: "ok", scanned: 0, created: 0, duplicates: 0, cappedOff: 0, providers, sourceErrors, message: "Fant ingen kvitteringer." });

      // 3. Dedup på tvers av kilder (source_email_id; Outlook-IDer har 'ms:'-prefiks).
      const existing = await pool.query(
        `SELECT source_email_id FROM software_expenses WHERE user_id=$1 AND source_email_id = ANY($2)`,
        [session.userId, allIds]);
      const seen = new Set(existing.rows.map((r) => r.source_email_id));
      const notSeen = allIds.filter((id) => !seen.has(id));
      const fresh = notSeen.slice(0, 30); // cost-cap: maks 30 nye per skann
      const duplicates = seen.size;               // faktiske dubletter (sett før)
      const cappedOff = notSeen.length - fresh.length; // droppet pga taket
      if (!fresh.length) return res.json({ status: "ok", scanned: allIds.length, created: 0, duplicates, cappedOff, providers, sourceErrors, message: "Ingen nye kvitteringer siden sist." });

      // 4. Hent + parse hver kandidat isolert (per kilde).
      const debug = String((req.query as any)?.debug || (req.body as any)?.debug || "") === "1";
      const debugRows: any[] = [];
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });
      let inTok = 0, outTok = 0; // faktisk haiku-forbruk (fra usage) → AI-kost

      const parsed = await runLimited(fresh, 4, async (id) => {
        const meta = candMeta.get(id);
        let subject = "", from = "", body = "";
        if (meta?.provider === "microsoft") {
          subject = meta.subject || ""; from = meta.from || ""; body = (meta.body || "").slice(0, 4000);
        } else {
          try {
            const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
            const h = msg.data.payload?.headers || [];
            subject = header(h, "Subject") || ""; from = header(h, "From") || "";
            body = extractBody(msg.data.payload).slice(0, 4000);
          } catch { return null; }
        }
        if (!subject && !body) return null;
        try {
          const resp: any = await client.messages.create({
            model: "claude-haiku-4-5-20251001", max_tokens: 300,
            messages: [{ role: "user", content: EXTRACT_PROMPT(subject, from, body) }],
          });
          inTok += Number(resp?.usage?.input_tokens || 0); outTok += Number(resp?.usage?.output_tokens || 0);
          const text = (resp?.content || []).map((c: any) => c?.text || "").join("").trim();
          const m = text.match(/\{[\s\S]*\}/);
          const p = m ? JSON.parse(m[0]) : null;
          if (debug) debugRows.push({ subject: subject.slice(0, 90), from: from.slice(0, 60), isReceipt: p?.isReceipt ?? null, vendor: p?.vendor ?? null, amount: p?.amount ?? null });
          if (!p || !p.isReceipt) return null;
          const amount = p.amount == null ? null : Number(p.amount);
          const currency = String(p.currency || "NOK").toUpperCase().slice(0, 8);
          const cycle = normCycle(p.billingCycle);
          const itemType = p.itemType === "hardware" ? "hardware" : "software";
          // Hardware: behold AI-ens kategori (kamera/objektiv/…). Software: normaliser.
          const category = itemType === "hardware"
            ? (String(p.category || "").slice(0, 60) || "Utstyr")
            : normCategory(p.category);
          return {
            source_email_id: id,
            item_type: itemType,
            vendor: String(p.vendor || "").slice(0, 200) || null,
            brand_hint: String(p.brand || "").slice(0, 120) || null,
            product: String(p.product || "").slice(0, 200) || null,
            category,
            serial_hint: String(p.serialNumber || "").slice(0, 120) || null,
            amount_original: Number.isFinite(amount as number) ? amount : null,
            amount_nok: toNok(amount as number, currency), currency,
            billing_cycle: itemType === "hardware" ? "engang" : cycle,
            is_subscription: itemType === "hardware" ? false : (p.isSubscription != null ? !!p.isSubscription : (cycle === "monthly" || cycle === "yearly")),
            purchase_date: safeDate(p.purchaseDate), renewal_date: safeDate(p.renewalDate),
            confidence: ["low", "medium", "high"].includes(p.confidence) ? p.confidence : "low",
          };
        } catch { return null; }
      });

      // 5. Sett inn som forslag (idempotent — ON CONFLICT gjør ingenting).
      let created = 0;
      for (const p of parsed) {
        if (!p || (!p.vendor && !p.product)) continue;
        try {
          const r = await pool.query(
            `INSERT INTO software_expenses
               (user_id, vendor, product, category, amount_nok, amount_original, currency,
                billing_cycle, is_subscription, purchase_date, renewal_date, source,
                source_email_id, confidence, status, item_type, serial_hint, brand_hint)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'email',$12,$13,'forslag',$14,$15,$16)
             ON CONFLICT (user_id, source_email_id) WHERE source_email_id IS NOT NULL DO NOTHING
             RETURNING id`,
            [session.userId, p.vendor, p.product, p.category, p.amount_nok, p.amount_original,
             p.currency, p.billing_cycle, p.is_subscription, p.purchase_date, p.renewal_date,
             p.source_email_id, p.confidence, p.item_type, p.serial_hint, p.brand_hint]);
          if (r.rows.length) created++;
        } catch (e) { console.warn("[software-expenses] insert suggestion failed", (e as any)?.message); }
      }

      // 6. Belast faktisk AI-forbruk mot Stripe-lommeboka (credits/metered).
      const rawCostUsd = inTok * HAIKU_IN_PER_TOKEN + outTok * HAIKU_OUT_PER_TOKEN;
      const charge = await chargeAiUsage(pool, session.userId, genSettings, rawCostUsd);
      let balanceUsd: number | null = null;
      if (genSettings?.billingMode === "credits") {
        const w = await getUserCredits(pool, session.userId).catch(() => null as any);
        balanceUsd = w ? w.balanceUsd : null;
      }

      res.json({
        status: "ok", scanned: allIds.length, candidates: fresh.length, created, duplicates, cappedOff, providers, sourceErrors,
        message: created ? `Fant ${created} nye kvittering${created === 1 ? "" : "er"} til gjennomgang.` : "Ingen nye kvitteringer gjenkjent.",
        ai: {
          billingMode: genSettings?.billingMode || "free_whitelist",
          inputTokens: inTok, outputTokens: outTok,
          costNok: Math.round(charge.retailNok * 100) / 100,
          balanceNok: balanceUsd != null ? Math.round(balanceUsd * nokPerUsd() * 100) / 100 : null,
        },
        ...(debug ? { debug: debugRows } : {}),
      });
    } catch (e) {
      console.error("[software-expenses] scan", e);
      res.status(500).json({ status: "failed", created: 0, error: "scan_failed", message: "Skanning feilet. Prøv igjen." });
    }
  });

  // ── AI-cost-oversikt (bruker-scopet speil av CreatorHubs Stripe-lommebok) ─────
  app.get("/api/software/ai-credits", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    try {
      const settings = await getGenSettings(pool).catch(() => null as any);
      const w = await getUserCredits(pool, session.userId).catch(() => ({ balanceUsd: 0, purchasedUsd: 0, spentUsd: 0 } as any));
      const rate = nokPerUsd();
      res.json({
        billingMode: settings?.billingMode || "free_whitelist",
        balanceNok: Math.round((w.balanceUsd || 0) * rate * 100) / 100,
        spentNok: Math.round((w.spentUsd || 0) * rate * 100) / 100,
        purchasedNok: Math.round((w.purchasedUsd || 0) * rate * 100) / 100,
        nokPerUsd: rate,
      });
    } catch (e) { console.error("[software-expenses] ai-credits", e); res.json({ billingMode: "free_whitelist", balanceNok: 0, spentNok: 0, purchasedNok: 0 }); }
  });
}
