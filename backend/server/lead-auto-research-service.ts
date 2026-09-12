/**
 * lead-auto-research-service.ts
 *
 * Etter at en kunde sender inn demo-/kontakt-forespørsel m/ consent,
 * trigger denne service-en automatisk research:
 *
 *   1. Brreg-oppslag (org-num, navn, ansatte, omsetning, bransje)
 *   2. Web-scrape (logo, hjemmeside-tekst, sosiale lenker)
 *   3. Claude-sammendrag + temperatur-vurdering + neste-steg
 *
 * Lagrer alt i lead_research_jobs. Marketing-team-fanen leser herfra.
 *
 * Designet til å være fault-tolerant: hvert steg kan feile uten å
 * blokkere de andre. Job markeres "completed" så lenge minst Claude
 * fikk noe å jobbe med.
 */

import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const CLAUDE_MODEL = "claude-opus-4-7";

// ============================================================
// Brreg
// ============================================================
interface BrregEnhet {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform?: { kode: string; beskrivelse: string };
  hjemmeside?: string;
  antallAnsatte?: number;
  forretningsadresse?: { adresse?: string[]; postnummer?: string; poststed?: string };
  naeringskode1?: { kode: string; beskrivelse: string };
  stiftelsesdato?: string;
  registrertIMvaregisteret?: boolean;
  registrertIForetaksregisteret?: boolean;
}

async function lookupBrreg(orgNumberOrName: string): Promise<{
  ok: boolean; data?: BrregEnhet; error?: string;
}> {
  const cleaned = orgNumberOrName.replace(/\s+/g, "");
  const isOrgNum = /^\d{9}$/.test(cleaned);

  try {
    if (isOrgNum) {
      // Direkte oppslag
      const r = await fetch(
        `https://data.brreg.no/enhetsregisteret/api/enheter/${cleaned}`,
      );
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      return { ok: true, data: await r.json() };
    } else {
      // Søk på navn → ta første match
      const r = await fetch(
        `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(orgNumberOrName)}&size=1`,
      );
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const j: any = await r.json();
      const first = j?._embedded?.enheter?.[0];
      if (!first) return { ok: false, error: "Ingen treff i Brreg" };
      return { ok: true, data: first };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "brreg_fetch_failed" };
  }
}

// ============================================================
// Web-scrape (lett: hent <title>, <meta> + favicon/og:image)
// ============================================================
async function scrapeWebsite(url: string): Promise<{
  ok: boolean; data?: {
    title: string | null; description: string | null;
    favicon_url: string | null; og_image: string | null;
    text_excerpt: string | null;
  }; error?: string;
}> {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const r = await fetch(normalized, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 LeadgridResearch/1.0" },
    });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const html = await r.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const faviconMatch = html.match(/<link[^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i);

    // Hent text-only (fjern script/style/tags + komprimer whitespace)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/g, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    const base = new URL(normalized);
    const absoluteUrl = (p: string | undefined): string | null => {
      if (!p) return null;
      try { return new URL(p, base).toString(); } catch { return null; }
    };

    return {
      ok: true,
      data: {
        title: titleMatch?.[1]?.trim() ?? null,
        description: descMatch?.[1]?.trim() ?? null,
        favicon_url: absoluteUrl(faviconMatch?.[1])
          ?? `https://www.google.com/s2/favicons?domain=${base.hostname}&sz=128`,
        og_image: absoluteUrl(ogImageMatch?.[1]),
        text_excerpt: text || null,
      },
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "scrape_failed" };
  }
}

// ============================================================
// Claude-rangering + sammendrag
// ============================================================
interface ClaudeAnalysis {
  temperature: "hot" | "warm" | "cool" | "cold";
  summary: string;
  talking_points: string[];
  next_action: string;
}

async function analyzeWithClaude(input: {
  contact_name: string; agency_name: string; email: string;
  message: string | null; use_case: string | null; team_size: string | null;
  brreg: BrregEnhet | null;
  website_data: any | null;
  source: string;
}): Promise<{ ok: boolean; data?: ClaudeAnalysis; error?: string }> {
  if (!ANTHROPIC_KEY) return { ok: false, error: "ANTHROPIC_API_KEY mangler" };

  const prompt = `Du er Leadgrids interne lead-analyst. En person har sendt inn forespørsel om Leadgrid (lead-tracking + research-plattform for markedsavdelinger og byråer).

Lead-info:
- Kontakt: ${input.contact_name} (${input.email})
- Selskap: ${input.agency_name}
- Brreg-data: ${input.brreg ? JSON.stringify({
    navn: input.brreg.navn,
    ansatte: input.brreg.antallAnsatte,
    bransje: input.brreg.naeringskode1?.beskrivelse,
    stiftet: input.brreg.stiftelsesdato,
    forretningsadresse: input.brreg.forretningsadresse?.poststed,
  }, null, 2) : "Ikke tilgjengelig"}
- Hjemmeside: ${input.website_data ? JSON.stringify({
    tittel: input.website_data.title,
    beskrivelse: input.website_data.description,
    text_excerpt: input.website_data.text_excerpt?.slice(0, 500),
  }, null, 2) : "Ikke tilgjengelig"}
- Lead-source: ${input.source}
- Team-størrelse: ${input.team_size ?? "ukjent"}
- Use-case: ${input.use_case ?? "ikke spesifisert"}
- Beskjed: ${input.message ?? "ingen"}

Returner KUN gyldig JSON i dette formatet:
{
  "temperature": "hot|warm|cool|cold",
  "summary": "2-3 setninger om hvem dette er og hvor relevant for Leadgrid",
  "talking_points": ["punkt 1", "punkt 2", "punkt 3"],
  "next_action": "Konkret anbefalt neste steg for Leadgrid-teamet"
}

Vurder:
- HOT: byrå/markedsavdeling 5+ ansatte, klart behov for Leadgrid, har bestilt demo
- WARM: relevant selskap men uklar urgency, eller mindre team
- COOL: ikke åpenbart fit, men ikke ueksklusivt
- COLD: irrelevant (privatperson, helt feil bransje, åpenbar tidskaster)`;

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const resp = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text).join("\n");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, error: "Ingen JSON i svar" };
    const parsed = JSON.parse(jsonMatch[0]);
    return { ok: true, data: parsed };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "claude_failed" };
  }
}

// ============================================================
// HOVED-ORCHESTRATOR
// ============================================================
export async function runAutoResearch(pool: Pool, leadId: string): Promise<void> {
  // Hent lead-info
  const leadR = await pool.query<{
    id: string; agency_name: string; contact_name: string; email: string;
    message: string | null; use_case: string | null; team_size: string | null;
    org_number: string | null; website: string | null; source: string;
  }>(
    `SELECT id::text, agency_name, contact_name, email, message,
            use_case, team_size, org_number, website, source
       FROM agency_leads WHERE id = $1`,
    [leadId],
  );
  const lead = leadR.rows[0];
  if (!lead) {
    console.error(`[auto-research] lead ${leadId} ikke funnet`);
    return;
  }

  // Opprett/start job
  await pool.query(
    `INSERT INTO lead_research_jobs (lead_id, status, started_at)
     VALUES ($1, 'running', now())
     ON CONFLICT (lead_id) DO UPDATE SET status = 'running',
       started_at = now(), updated_at = now()`,
    [leadId],
  );

  // ---------- Steg 1: Brreg ----------
  let brregData: BrregEnhet | null = null;
  if (lead.org_number || lead.agency_name) {
    const r = await lookupBrreg(lead.org_number ?? lead.agency_name);
    await pool.query(
      `UPDATE lead_research_jobs SET
         brreg_status = $1, brreg_data = $2, brreg_error = $3, updated_at = now()
       WHERE lead_id = $4`,
      [r.ok ? "completed" : "failed",
       r.ok ? JSON.stringify(r.data) : null,
       r.ok ? null : r.error,
       leadId],
    );
    if (r.ok) brregData = r.data ?? null;

    // Hvis vi fikk hjemmesidefra Brreg og lead ikke har, sett den
    if (brregData?.hjemmeside && !lead.website) {
      await pool.query(
        `UPDATE agency_leads SET website = $1 WHERE id = $2`,
        [brregData.hjemmeside, leadId],
      );
      lead.website = brregData.hjemmeside;
    }
    // Hvis vi fikk org-nummer og lead ikke har det
    if (brregData?.organisasjonsnummer && !lead.org_number) {
      await pool.query(
        `UPDATE agency_leads SET org_number = $1 WHERE id = $2`,
        [brregData.organisasjonsnummer, leadId],
      );
    }
  }

  // ---------- Steg 2: Website-scrape ----------
  let websiteData: any = null;
  if (lead.website) {
    const r = await scrapeWebsite(lead.website);
    await pool.query(
      `UPDATE lead_research_jobs SET
         website_scrape_status = $1, website_scrape_data = $2,
         website_scrape_error = $3, updated_at = now()
       WHERE lead_id = $4`,
      [r.ok ? "completed" : "failed",
       r.ok ? JSON.stringify(r.data) : null,
       r.ok ? null : r.error,
       leadId],
    );
    if (r.ok) websiteData = r.data;
  }

  // ---------- Steg 3: Claude-analyse ----------
  const claudeR = await analyzeWithClaude({
    contact_name: lead.contact_name,
    agency_name: lead.agency_name,
    email: lead.email,
    message: lead.message,
    use_case: lead.use_case,
    team_size: lead.team_size,
    brreg: brregData,
    website_data: websiteData,
    source: lead.source,
  });

  await pool.query(
    `UPDATE lead_research_jobs SET
       claude_status = $1, claude_summary = $2, claude_temperature = $3,
       claude_talking_points = $4, claude_next_action = $5,
       claude_error = $6,
       status = 'completed', completed_at = now(), updated_at = now()
     WHERE lead_id = $7`,
    [claudeR.ok ? "completed" : "failed",
     claudeR.data?.summary ?? null,
     claudeR.data?.temperature ?? null,
     claudeR.data?.talking_points ?? null,
     claudeR.data?.next_action ?? null,
     claudeR.ok ? null : claudeR.error,
     leadId],
  );

  // Sett score-tier på lead-en så CRM-fanen kan filtrere
  if (claudeR.data?.temperature) {
    await pool.query(
      `UPDATE agency_leads SET score_tier = $1, scored_at = now(), scored_model = $2
        WHERE id = $3`,
      [claudeR.data.temperature, CLAUDE_MODEL, leadId],
    );
  }
}

/** Trigger uten å vente — fire-and-forget. */
export function triggerAutoResearchAsync(pool: Pool, leadId: string): void {
  runAutoResearch(pool, leadId).catch((e) => {
    console.error(`[auto-research] feilet for ${leadId}:`, e);
    pool.query(
      `UPDATE lead_research_jobs SET status = 'failed',
        error_message = $1, completed_at = now()
       WHERE lead_id = $2`,
      [e?.message ?? String(e), leadId],
    ).catch(() => {});
  });
}
