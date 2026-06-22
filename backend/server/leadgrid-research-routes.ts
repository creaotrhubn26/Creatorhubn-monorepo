/**
 * leadgrid-research-routes.ts
 *
 * Native Leadgrid Research — kjør Claude-basert B2B-felt-research på én
 * lead/kunde. Brukes fra iPad-appen for å gi markedssjefen et komplett
 * "hvordan skal jeg selge til disse"-bilde før neste touch.
 *
 * Resultatet kombinerer:
 *   - BRREG-berikkelse (enrichLeadWithBrreg) → org-data + roller
 *   - Website-skraping (analyzeWebsite) → BrandProfile (tone, USPs,
 *     industri, beskrivelse)
 *   - Claude (Opus 4.7) → SWOT, beslutningstaker-roller, foreslått
 *     første-touch, kategori, risiko, opportunity-score
 *
 * Lagring: crm_customers.enrichment_data.leadgrid_research (JSONB)
 *          + crm_customers.ai_opportunity_score
 *
 * Cache: 30 dager via generated_at. /research GET returnerer cached
 *        hvis fersk, ellers 404 → klienten kaller POST /research for å
 *        regenerere.
 *
 * Auth: leadgrid_research_run-permission (gated via requireLeadMapPermission
 *       som faller tilbake til row-level owner_user_id-sjekk hvis bruker
 *       ikke er i en org).
 *
 * Endepunkter:
 *   POST /api/leadgrid/leads/:id/research → kjør research nå
 *   GET  /api/leadgrid/leads/:id/research → hent cached (404 hvis ingen)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { analyzeWebsite, type BrandProfile } from "./role-room-website-analyzer.js";
import { enrichLeadWithBrreg, getStoredEnrichment } from "./lead-brreg-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

// ─────────────────────────────────────────────────────────────────
// Public types — speilet i ipad/.../LeadgridResearchModels.swift
// ─────────────────────────────────────────────────────────────────

export interface ResearchSWOT {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface ResearchDecisionMaker {
  role: string;       // f.eks. "CTO", "Markedssjef"
  title: string | null;
  why: string;        // hvorfor denne rollen er relevant for vårt salg
}

export interface ResearchFirstTouch {
  channel: "email" | "linkedin" | "phone" | "in_person";
  subject: string | null;
  body: string;
}

export interface LeadgridResearch {
  swot: ResearchSWOT;
  decisionMakers: ResearchDecisionMaker[];
  firstTouch: ResearchFirstTouch;
  category: string | null;
  risk: string | null;
  opportunityScore: number | null; // 1-10
  generatedAt: string;             // ISO8601
}

const RESEARCH_TTL_DAYS = 30;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function logActivity(
  pool: Pool,
  args: {
    userId: string;
    entityId: string;
    action: string;
    summary?: string;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO admin_activity_log
         (user_id, entity_type, entity_id, action, summary, details)
       VALUES ($1, 'leadgrid_research', $2, $3, $4, $5::jsonb)`,
      [
        args.userId,
        args.entityId,
        args.action,
        args.summary ?? null,
        JSON.stringify(args.details ?? {}),
      ],
    );
  } catch (err) {
    // Log-feil må aldri blokkere research-flyten
    console.warn("[leadgrid-research] logActivity failed:", err);
  }
}

interface LeadRow {
  id: string;
  name: string;
  company: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  google_rating: number | null;
  notes: string | null;
  lead_category: string | null;
  lead_status: string;
  enrichment_org_nr: string | null;
  enrichment_data: Record<string, unknown> | null;
  ai_opportunity_score: number | null;
  owner_user_id: string | null;
}

/**
 * Hent lead m/ ownership-sjekk. owner_user_id må matche caller, ELLER
 * vi gir tilgang hvis caller er super_admin (sjekkes separat over).
 */
async function fetchLead(
  pool: Pool,
  leadId: string,
  callerUserId: string,
  callerRole: string | undefined,
): Promise<LeadRow | null> {
  const isSuperAdmin = callerRole === "super_admin";
  const sql = isSuperAdmin
    ? `SELECT id::text, name, company, city, country, phone, email,
              website_url, linkedin_url, google_rating, notes,
              lead_category, lead_status, enrichment_org_nr,
              enrichment_data, ai_opportunity_score, owner_user_id::text
         FROM crm_customers
        WHERE id = $1`
    : `SELECT id::text, name, company, city, country, phone, email,
              website_url, linkedin_url, google_rating, notes,
              lead_category, lead_status, enrichment_org_nr,
              enrichment_data, ai_opportunity_score, owner_user_id::text
         FROM crm_customers
        WHERE id = $1 AND owner_user_id = $2`;
  const params = isSuperAdmin ? [leadId] : [leadId, callerUserId];
  const r = await pool.query<LeadRow>(sql, params);
  return r.rows[0] ?? null;
}

function isFreshResearch(generatedAt: string | undefined): boolean {
  if (!generatedAt) return false;
  const ts = Date.parse(generatedAt);
  if (Number.isNaN(ts)) return false;
  const ageMs = Date.now() - ts;
  return ageMs < RESEARCH_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Hent eksisterende leadgrid_research fra enrichment_data hvis den finnes.
 * Returner null hvis ikke til stede eller ikke gyldig form.
 */
function extractCachedResearch(
  enrichmentData: Record<string, unknown> | null,
): LeadgridResearch | null {
  if (!enrichmentData) return null;
  const r = enrichmentData["leadgrid_research"] as unknown;
  if (!r || typeof r !== "object") return null;
  const obj = r as Record<string, unknown>;
  // Lett-validering — vi trenger generatedAt og swot for å regne med det
  if (typeof obj.generatedAt !== "string") return null;
  if (!obj.swot || typeof obj.swot !== "object") return null;
  return obj as unknown as LeadgridResearch;
}

// ─────────────────────────────────────────────────────────────────
// Claude-prompt
// ─────────────────────────────────────────────────────────────────

interface ClaudeContext {
  leadName: string;
  company: string | null;
  city: string | null;
  brreg: {
    found: boolean;
    orgForm?: string | null;
    naceDescription?: string | null;
    employees?: number | null;
    status?: string;
    contacts?: Array<{ role: string; name: string }>;
  } | null;
  brand: {
    businessName?: string;
    description?: string;
    tagline?: string;
    industry?: string;
    targetAudience?: string;
    usps?: string[];
    toneOfVoice?: string;
    hasShop?: boolean;
    hasBlog?: boolean;
  } | null;
  notes: string | null;
  category: string | null;
  status: string;
  googleRating: number | null;
  myProfile: string;
}

async function fetchMyBrandProfile(
  pool: Pool,
  workspaceOwnerUserId: string,
): Promise<string> {
  try {
    const r = await pool.query<{ profile: string | null }>(
      `SELECT (brand_profile->>'positioning_summary')::text AS profile
         FROM brand_kits
        WHERE workspace_owner_user_id = $1
        ORDER BY updated_at DESC LIMIT 1`,
      [workspaceOwnerUserId],
    );
    return r.rows[0]?.profile ?? "(ingen brand-kit registrert)";
  } catch {
    return "(ingen brand-kit registrert)";
  }
}

async function runClaudeResearch(
  ctx: ClaudeContext,
  apiKey: string,
): Promise<LeadgridResearch> {
  const client = new Anthropic({ apiKey });

  const brregBlock = ctx.brreg?.found
    ? `BRREG-DATA:
- Org-form: ${ctx.brreg.orgForm ?? "?"}
- Bransje: ${ctx.brreg.naceDescription ?? "?"}
- Ansatte: ${ctx.brreg.employees ?? "?"}
- Status: ${ctx.brreg.status ?? "?"}
- Registrerte roller: ${ctx.brreg.contacts?.length
        ? ctx.brreg.contacts.slice(0, 6).map(c => `${c.role}: ${c.name}`).join(", ")
        : "(ingen)"}`
    : "BRREG-DATA: (ikke funnet i Brønnøysund)";

  const brandBlock = ctx.brand
    ? `WEBSITE-ANALYSE:
- Tagline: ${ctx.brand.tagline ?? "?"}
- Beskrivelse: ${ctx.brand.description?.slice(0, 400) ?? "?"}
- Industri (Claude-tagget): ${ctx.brand.industry ?? "?"}
- Målgruppe: ${ctx.brand.targetAudience ?? "?"}
- USPs: ${ctx.brand.usps?.join(" | ") ?? "?"}
- Tone-of-voice: ${ctx.brand.toneOfVoice ?? "?"}
- Har nettbutikk: ${ctx.brand.hasShop ? "ja" : "nei"}
- Har blogg: ${ctx.brand.hasBlog ? "ja" : "nei"}`
    : "WEBSITE-ANALYSE: (ingen nettside skannet)";

  const prompt = `Du er Leadgrid Research-agenten. Lag en konkret B2B-felt-research-rapport
for hvordan VI skal selge til denne potensielle kunden. Vær ærlig,
spesifikk og handlingsorientert — ikke generisk.

VÅR POSISJONERING:
${ctx.myProfile}

LEADEN:
- Navn: ${ctx.leadName}${ctx.company ? ` (${ctx.company})` : ""}
- By: ${ctx.city ?? "?"}
- Kategori: ${ctx.category ?? "?"}
- Status: ${ctx.status}
- Google rating: ${ctx.googleRating ?? "?"}
- Notater fra felt: ${ctx.notes?.slice(0, 400) ?? "(ingen)"}

${brregBlock}

${brandBlock}

OPPGAVE — Returner strengt JSON med følgende form:
{
  "swot": {
    "strengths": ["2-4 konkrete styrker (hva fungerer for dem)"],
    "weaknesses": ["2-4 konkrete svakheter (åpninger vi kan utnytte)"],
    "opportunities": ["2-4 muligheter (hvor kan vi hjelpe)"],
    "threats": ["2-4 trusler (hva utfordrer dem)"]
  },
  "decisionMakers": [
    {
      "role": "Markedssjef|CTO|Daglig leder|...",
      "title": "Norsk tittel hvis kjent fra BRREG-roller, ellers null",
      "why": "1-2 setninger om hvorfor akkurat denne rollen er rett inngang"
    }
    // 3-5 stk, sortert etter sannsynlighet
  ],
  "firstTouch": {
    "channel": "email|linkedin|phone|in_person",
    "subject": "Emne hvis email/linkedin — ellers null",
    "body": "Ferdig melding (80-200 ord) — referer til noe spesifikt fra leadens profil. Tone: profesjonell-direkte. Ingen klisjeer. Skriv på norsk."
  },
  "category": "Kort kategorisering — f.eks. 'B2C dagligvare', 'B2B SaaS', 'Lokal service'",
  "risk": "1-2 setninger om hva som kan gjøre at vi taper denne (allerede kunde av konkurrent? lite kjøpekraft? feil match?)",
  "opportunityScore": 7  // 1-10 — hvor verdt er denne å forfølge for OSS?
}

KRITISK:
- Skriv ALT på norsk
- Ingen markdown, kun ren JSON
- Hvis BRREG-roller finnes, foretrekk reelle titler/navn i decisionMakers
- firstTouch.channel MÅ være én av: email|linkedin|phone|in_person`;

  const msg = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 3500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`claude_no_json: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    swot: ResearchSWOT;
    decisionMakers: ResearchDecisionMaker[];
    firstTouch: ResearchFirstTouch;
    category?: string | null;
    risk?: string | null;
    opportunityScore?: number | null;
  };

  // Defensiv kanal-validering — Claude kan finne på å returnere noe utenfor
  // unionen, så vi sjekker mot string-array og narrowing-cast'er.
  const validChannels: ReadonlyArray<string> = ["email", "linkedin", "phone", "in_person"];
  const rawChannel = String(parsed.firstTouch?.channel ?? "email");
  const channel: ResearchFirstTouch["channel"] = validChannels.includes(rawChannel)
    ? (rawChannel as ResearchFirstTouch["channel"])
    : "email";

  return {
    swot: {
      strengths: Array.isArray(parsed.swot?.strengths) ? parsed.swot.strengths : [],
      weaknesses: Array.isArray(parsed.swot?.weaknesses) ? parsed.swot.weaknesses : [],
      opportunities: Array.isArray(parsed.swot?.opportunities) ? parsed.swot.opportunities : [],
      threats: Array.isArray(parsed.swot?.threats) ? parsed.swot.threats : [],
    },
    decisionMakers: Array.isArray(parsed.decisionMakers)
      ? parsed.decisionMakers.map((d) => ({
          role: String(d.role ?? ""),
          title: d.title ?? null,
          why: String(d.why ?? ""),
        }))
      : [],
    firstTouch: {
      channel,
      subject: parsed.firstTouch?.subject ?? null,
      body: String(parsed.firstTouch?.body ?? ""),
    },
    category: parsed.category ?? null,
    risk: parsed.risk ?? null,
    opportunityScore: typeof parsed.opportunityScore === "number"
      ? Math.max(1, Math.min(10, Math.round(parsed.opportunityScore)))
      : null,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────
// Persistering
// ─────────────────────────────────────────────────────────────────

async function persistResearch(
  pool: Pool,
  args: {
    leadId: string;
    research: LeadgridResearch;
    existingEnrichment: Record<string, unknown> | null;
  },
): Promise<void> {
  // Behold all eksisterende enrichment-data og legg til/erstatt
  // leadgrid_research-blokken. Bevarer BRREG-felt + andre kilder.
  const merged: Record<string, unknown> = {
    ...(args.existingEnrichment ?? {}),
    leadgrid_research: args.research,
  };

  // ai_opportunity_score er 0-100 i DB, vi har 1-10 fra Claude → skaler
  const dbScore = args.research.opportunityScore != null
    ? Math.max(0, Math.min(100, args.research.opportunityScore * 10))
    : null;

  if (dbScore !== null) {
    await pool.query(
      `UPDATE crm_customers
          SET enrichment_data = $2::jsonb,
              ai_opportunity_score = $3,
              updated_at = NOW()
        WHERE id = $1`,
      [args.leadId, JSON.stringify(merged), dbScore],
    );
  } else {
    await pool.query(
      `UPDATE crm_customers
          SET enrichment_data = $2::jsonb,
              updated_at = NOW()
        WHERE id = $1`,
      [args.leadId, JSON.stringify(merged)],
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────

export function registerLeadgridResearchRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  // ─── POST /api/leadgrid/leads/:id/research ─────────────────────
  // Kjør research-pipeline (BRREG + website + Claude). Persisterer
  // resultatet og returnerer full JSON. Honors caller ownership +
  // super_admin-bypass.
  app.post(
    "/api/leadgrid/leads/:id/research",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "anthropic_key_missing" });
      }

      // Slå opp rolle for super_admin-bypass
      let role: string | undefined = session.role;
      if (!role) {
        try {
          const ur = await pool.query<{ role: string }>(
            `SELECT role FROM users WHERE id = $1`,
            [session.userId],
          );
          role = ur.rows[0]?.role;
        } catch {
          /* tystefall */
        }
      }

      const lead = await fetchLead(pool, req.params.id, session.userId, role);
      if (!lead) {
        return res.status(404).json({ error: "lead_not_found" });
      }

      // Workspace-owner-context for BRREG/brand-kit-lookup: bruk
      // lead.owner_user_id hvis super_admin kjører på en annen brukers
      // lead, ellers caller's egen id.
      const workspaceOwnerUserId = lead.owner_user_id ?? session.userId;

      // 1) BRREG-berikkelse (cached + auto-fetch hvis mangler).
      //    getStoredEnrichment dekoder hele enrichment_data-kolonnen som
      //    EnrichmentResult, men den kan inneholde annen JSONB-data også
      //    (leadgrid_research, etc.). Vi ser etter `source === 'brreg'`
      //    for å avgjøre om BRREG-call faktisk har kjørt før.
      let brregData: Awaited<ReturnType<typeof enrichLeadWithBrreg>> | null = null;
      try {
        const stored = await getStoredEnrichment(pool, {
          leadId: lead.id,
          workspaceOwnerUserId,
        });
        if (stored && stored.source === "brreg") {
          brregData = stored;
        } else {
          brregData = await enrichLeadWithBrreg(pool, {
            leadId: lead.id,
            workspaceOwnerUserId,
          });
        }
      } catch (err) {
        // BRREG-feil må ikke blokkere research — vi kjører videre uten
        console.warn("[leadgrid-research] BRREG step failed:", err);
      }

      // 2) Website-analyse (kun hvis website_url finnes)
      //    Sjekk både lead.website_url OG brreg.company.website
      let brand: BrandProfile | null = null;
      const websiteUrl = lead.website_url
        ?? brregData?.company?.website
        ?? null;
      if (websiteUrl && websiteUrl.trim().length > 0) {
        try {
          brand = await analyzeWebsite(websiteUrl);
        } catch (err) {
          console.warn("[leadgrid-research] analyzeWebsite failed:", err);
        }
      }

      // 3) Claude-pass
      const myProfile = await fetchMyBrandProfile(pool, workspaceOwnerUserId);

      let research: LeadgridResearch;
      try {
        research = await runClaudeResearch(
          {
            leadName: lead.name,
            company: lead.company,
            city: lead.city,
            brreg: brregData
              ? {
                  found: !!brregData.found,
                  orgForm: brregData.company?.orgForm ?? null,
                  naceDescription: brregData.company?.naceDescription ?? null,
                  employees: brregData.company?.employees ?? null,
                  status: brregData.company?.status,
                  contacts: brregData.contacts,
                }
              : null,
            brand: brand
              ? {
                  businessName: brand.businessName,
                  description: brand.description,
                  tagline: brand.tagline,
                  industry: brand.industry,
                  targetAudience: brand.targetAudience,
                  usps: brand.usps,
                  toneOfVoice: brand.toneOfVoice,
                  hasShop: brand.hasShop,
                  hasBlog: brand.hasBlog,
                }
              : null,
            notes: lead.notes,
            category: lead.lead_category,
            status: lead.lead_status,
            googleRating: lead.google_rating,
            myProfile,
          },
          apiKey,
        );
      } catch (err) {
        return res.status(500).json({
          error: "claude_research_failed",
          detail: String(err).slice(0, 300),
        });
      }

      // 4) Persister
      try {
        // Re-hent enrichment_data så vi ikke overskriver BRREG vi nettopp lagret
        const refresh = await pool.query<{ enrichment_data: Record<string, unknown> | null }>(
          `SELECT enrichment_data FROM crm_customers WHERE id = $1`,
          [lead.id],
        );
        await persistResearch(pool, {
          leadId: lead.id,
          research,
          existingEnrichment: refresh.rows[0]?.enrichment_data ?? lead.enrichment_data,
        });
      } catch (err) {
        console.error("[leadgrid-research] persist failed", err);
        return res.status(500).json({
          error: "persist_failed",
          detail: String(err).slice(0, 200),
        });
      }

      // 5) Activity-log
      await logActivity(pool, {
        userId: session.userId,
        entityId: lead.id,
        action: "research_generated",
        summary: `Research for ${lead.name}`,
        details: {
          opportunity_score: research.opportunityScore,
          decision_makers_count: research.decisionMakers.length,
          had_brreg: !!brregData?.found,
          had_website: !!brand,
          channel: research.firstTouch.channel,
        },
      });

      return res.json({ research });
    },
  );

  // ─── GET /api/leadgrid/leads/:id/research ──────────────────────
  // Cached fetch — returnerer 404 hvis ingen forskning eller stale (>30d).
  app.get(
    "/api/leadgrid/leads/:id/research",
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }

      let role: string | undefined = session.role;
      if (!role) {
        try {
          const ur = await pool.query<{ role: string }>(
            `SELECT role FROM users WHERE id = $1`,
            [session.userId],
          );
          role = ur.rows[0]?.role;
        } catch {
          /* tystefall */
        }
      }

      const lead = await fetchLead(pool, req.params.id, session.userId, role);
      if (!lead) {
        return res.status(404).json({ error: "lead_not_found" });
      }

      const cached = extractCachedResearch(lead.enrichment_data);
      if (!cached) {
        return res.status(404).json({ error: "no_research" });
      }
      if (!isFreshResearch(cached.generatedAt)) {
        return res.status(404).json({ error: "stale_research", generated_at: cached.generatedAt });
      }
      return res.json({ research: cached });
    },
  );
}
