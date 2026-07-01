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
import type express from "express";
import type { Pool } from "pg";

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

// Gmail-søk: kun kvittering-KANDIDATER (kjente leverandører + kvittering-ord).
// Holder både haiku-kost og personvern nede — vi ser aldri på hele innboksen.
const GMAIL_RECEIPT_QUERY = [
  "newer_than:2y",
  "(",
  "subject:(invoice OR receipt OR kvittering OR faktura OR subscription OR abonnement OR renewal OR renew OR payment OR \"order confirmation\" OR ordrebekreftelse)",
  "OR from:(adobe.com OR splice.com OR paddle.com OR fastspring.com OR native-instruments.com OR izotope.com OR waves.com OR u-he.com OR plugin-alliance.com OR ableton.com OR steinberg.net OR apple.com OR dropbox.com OR google.com OR microsoft.com OR paypal.com OR stripe.com OR gumroad.com OR distrokid.com OR backblaze.com)",
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
`Du analyserer en e-post og avgjør om den er en KVITTERING/FAKTURA for programvare,
plugin, abonnement eller digitalt kjøp (f.eks. Adobe, Splice, Native Instruments,
Dropbox, App Store). Trekk ut strukturerte felter.

Fra: ${from}
Emne: ${subject}
Tekst (kan være forkortet):
${body}

Svar KUN med gyldig JSON, ingen annen tekst:
{"isReceipt": <true|false>, "vendor": "<leverandør>", "product": "<produkt/plan>",
 "category": "<en av: ${CATEGORIES.join(" | ")}>",
 "amount": <tall uten valutategn, el. null>, "currency": "<ISO f.eks. USD|EUR|NOK>",
 "billingCycle": "<monthly|yearly|engang|unknown>", "isSubscription": <true|false>,
 "purchaseDate": "<YYYY-MM-DD el. null>", "renewalDate": "<YYYY-MM-DD el. null>",
 "confidence": "<low|medium|high>"}
Regler: Hvis dette IKKE er en kvittering/faktura for et kjøp/abonnement (nyhetsbrev,
support, reklame), sett isReceipt=false. Beløp = det som faktisk ble belastet. Ved
usikkerhet, sett null og confidence=low.`;

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
    ensured = true;
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

  // ── SKANN Gmail for kvitteringer ────────────────────────────────────────────
  app.post("/api/software/scan-receipts", async (req, res) => {
    const session = requireUserSession(req, res); if (!session) return;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.json({ status: "ai_unconfigured", created: 0, message: "AI-parsing ikke konfigurert." });
    try {
      await ensureTable();

      // 1. Auth-klient for brukerens Gmail (creatorhub-kobling foretrukket).
      let oauthClient: any = null;
      try { oauthClient = await getGoogleOAuthClient(pool, session.userId, "creatorhub"); } catch { oauthClient = null; }
      if (!oauthClient) return res.json({ status: "no_credentials", created: 0, message: "Google/Gmail ikke koblet. Koble til Google for å skanne kvitteringer." });

      const { google } = await import("googleapis");
      const gmail = google.gmail({ version: "v1", auth: oauthClient });

      // 2. List kandidater (kun kvittering-treff, cap 60).
      let listData: any;
      try {
        const r = await gmail.users.messages.list({ userId: "me", q: GMAIL_RECEIPT_QUERY, maxResults: 60 });
        listData = r.data;
      } catch (err: any) {
        if (err?.code === 403 || err?.response?.status === 403)
          return res.json({ status: "no_scope", created: 0, message: "Mangler gmail.readonly. Koble til Google på nytt og godkjenn lesetilgang." });
        throw err;
      }
      const ids = (listData.messages || []).map((m: any) => m.id).filter(Boolean) as string[];
      if (!ids.length) return res.json({ status: "ok", scanned: 0, created: 0, duplicates: 0, message: "Fant ingen kvitteringer." });

      // 3. Hvilke er allerede sett? (dedup på Gmail message-id).
      const existing = await pool.query(
        `SELECT source_email_id FROM software_expenses WHERE user_id=$1 AND source_email_id = ANY($2)`,
        [session.userId, ids]);
      const seen = new Set(existing.rows.map((r) => r.source_email_id));
      const fresh = ids.filter((id) => !seen.has(id)).slice(0, 25); // cost-cap: maks 25 nye per skann
      const duplicates = ids.length - fresh.length;
      if (!fresh.length) return res.json({ status: "ok", scanned: ids.length, created: 0, duplicates, message: "Ingen nye kvitteringer siden sist." });

      // 4. Hent + parse hver kandidat isolert.
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });

      const parsed = await runLimited(fresh, 4, async (id) => {
        let subject = "", from = "", body = "";
        try {
          const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
          const h = msg.data.payload?.headers || [];
          subject = header(h, "Subject") || ""; from = header(h, "From") || "";
          body = extractBody(msg.data.payload).slice(0, 4000);
        } catch { return null; }
        if (!subject && !body) return null;
        try {
          const resp: any = await client.messages.create({
            model: "claude-haiku-4-5-20251001", max_tokens: 300,
            messages: [{ role: "user", content: EXTRACT_PROMPT(subject, from, body) }],
          });
          const text = (resp?.content || []).map((c: any) => c?.text || "").join("").trim();
          const m = text.match(/\{[\s\S]*\}/); if (!m) return null;
          const p = JSON.parse(m[0]);
          if (!p.isReceipt) return null;
          const amount = p.amount == null ? null : Number(p.amount);
          const currency = String(p.currency || "NOK").toUpperCase().slice(0, 8);
          const cycle = normCycle(p.billingCycle);
          return {
            source_email_id: id,
            vendor: String(p.vendor || "").slice(0, 200) || null,
            product: String(p.product || "").slice(0, 200) || null,
            category: normCategory(p.category),
            amount_original: Number.isFinite(amount as number) ? amount : null,
            amount_nok: toNok(amount as number, currency), currency,
            billing_cycle: cycle,
            is_subscription: p.isSubscription != null ? !!p.isSubscription : (cycle === "monthly" || cycle === "yearly"),
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
                source_email_id, confidence, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'email',$12,$13,'forslag')
             ON CONFLICT (user_id, source_email_id) WHERE source_email_id IS NOT NULL DO NOTHING
             RETURNING id`,
            [session.userId, p.vendor, p.product, p.category, p.amount_nok, p.amount_original,
             p.currency, p.billing_cycle, p.is_subscription, p.purchase_date, p.renewal_date,
             p.source_email_id, p.confidence]);
          if (r.rows.length) created++;
        } catch (e) { console.warn("[software-expenses] insert suggestion failed", (e as any)?.message); }
      }

      res.json({
        status: "ok", scanned: ids.length, candidates: fresh.length, created, duplicates,
        message: created ? `Fant ${created} nye kvittering${created === 1 ? "" : "er"} til gjennomgang.` : "Ingen nye kvitteringer gjenkjent.",
      });
    } catch (e) {
      console.error("[software-expenses] scan", e);
      res.status(500).json({ status: "failed", created: 0, error: "scan_failed", message: "Skanning feilet. Prøv igjen." });
    }
  });
}
