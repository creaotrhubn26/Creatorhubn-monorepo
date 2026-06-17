/**
 * lead-map-transcript-routes.ts
 *
 * Smart transkript-analyse for visit-dikteringer. Sender transkriptet
 * + lead-kontekst til Claude, får tilbake:
 *   - resolved_text: hvor 'kunden'/'han'/'hun' er erstattet med lead-navn
 *   - action_items: ting bruker skal gjøre videre
 *   - follow_up_date: dato hvis nevnt (ISO 8601)
 *   - calendar_suggestion: {title, date, notes} hvis møte/deadline-aktig
 *   - sentiment: positiv | nøytral | negativ
 *
 * Bruk: POST /api/admin-room/lead-map/visits/parse-transcript
 *   { lead_id, transcript }
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return activeSessions.get(auth.slice(7)) ?? null;
  }
  return null;
}

let anthropic: Anthropic | null = null;
function getClaude(): Anthropic | null {
  if (anthropic) return anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  anthropic = new Anthropic({ apiKey: key });
  return anthropic;
}

interface TranscriptAnalysis {
  resolved_text: string;
  action_items: string[];
  follow_up_date: string | null;
  calendar_suggestion: { title: string; date: string; notes?: string } | null;
  sentiment: "positiv" | "nøytral" | "negativ";
}

const SYSTEM_PROMPT = `Du analyserer en transkripsjon av en norsk selger som dikterer notater
etter et besøk. Du får selve transkripsjonen og navnet på leadet/kunden.

Returner BARE et JSON-objekt (ingen kommentarer rundt):
{
  "resolved_text": "transkripsjonen, men 'kunden', 'de', 'han', 'hun', 'sjefen' og lignende er erstattet med kundens faktiske navn der det gir mening",
  "action_items": ["..."],
  "follow_up_date": "ISO 8601 dato hvis nevnt (f.eks. '2026-06-22'), ellers null",
  "calendar_suggestion": { "title": "...", "date": "ISO 8601", "notes": "..." } eller null hvis ingen tidsfrist/møte nevnt,
  "sentiment": "positiv" | "nøytral" | "negativ"
}

Regler:
- Bevar selgerens tone i resolved_text — bare bytt ut pronomen
- Datoer: "innen 22.06" eller "22. juni" → "2026-06-22" (nåværende år hvis ikke spesifisert; neste år hvis datoen er i fortid)
- action_items: konkrete TODO-er fra selgerens side
- calendar_suggestion: kun hvis det er en konkret deadline eller møte. Tittelen skal inneholde kundens navn.
- Hvis det ikke er noen action items: returner [] (ikke null)
- Hvis du er usikker på en dato, returner null`;

const MEETING_BRIEF_PROMPT = `Du er en erfaren norsk salgs-coach. Selgeren skal snart møte en
potensiell kunde og trenger en kort, handlings-rettet brief.

Du får informasjon om:
1. SELGERENS organisasjon — hva de selger, bransje, og 'won'-historikk
2. KUNDENS bedrift (lead) — status, besøkshistorikk, BRREG, Proff

ALT du foreslår MÅ være kontekstuelt:
- Kontrakt-anbefalinger må reflektere det selgeren faktisk selger
- Pitch-deck-slidene må vinkles mot kundens behov + selgerens tilbud
- Talking points må kombinere selgerens proposisjon med kundens situasjon
- Bruk 'won'-eksemplene som referanse — fortell hvilke som er sammenlignbare

Returner BARE et JSON-objekt:
{
  "headline": "Én linje sammendrag av hvor leadet står (max 80 tegn)",
  "key_status": "Kort: hva er status nå, hvorfor",
  "company_profile": {
    "founded_year": <år eller null>,
    "age_label": "fersk" | "voksende" | "etablert" | "moden" | "ukjent",
    "financial_health": "sterk" | "stabil" | "svak" | "ukjent",
    "key_facts": ["..."]
  },
  "strategic_value": "Hvorfor dette leadet er viktig for organisasjonen (2-3 setninger)",
  "warnings": ["..."],
  "talking_points": ["..."],
  "questions_to_ask": ["..."],
  "progress_tips": ["..."],
  "contract_recommendations": [
    {
      "type": "abonnement | prosjektoppdrag | retainer | rammeavtale | engangsleveranse",
      "reason": "Hvorfor denne typen passer for denne kunden",
      "fit_score": 0-100
    }
  ],
  "personal_approach": "Konkret råd om hvordan selger skal fremtre (rolig/energisk/data-drevet etc) basert på leadets profil. 1-2 setninger.",
  "pitch_deck_suggestion": {
    "recommended_slides": [
      { "title": "...", "rationale": "Hvorfor denne sliden for denne kunden" }
    ],
    "skip_slides": ["..."],
    "key_proof_points": ["..."]
  }
}

Regler:
- Vær konsis. Selgeren skal lese dette på 60 sekunder.
- Bruk leadets navn der det er naturlig.
- age_label: 'fersk' < 2 år, 'voksende' 2-5 år, 'etablert' 5-15 år, 'moden' > 15 år
- contract_recommendations: 1-3 forslag, sortert etter fit_score
- Hvis du ikke har data: si 'ukjent' i strukturerte felter, eller la lister være tomme
- Ingen generisk salgs-vrøvl — bare det som er relevant for dette spesifikke leadet.`;

export function registerLeadMapTranscriptRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── POST /leads/:id/meeting-brief ──────────────────────────────
  app.post(
    "/api/admin-room/lead-map/leads/:id/meeting-brief",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

      try {
        const leadRes = await pool.query<{
          name: string; address: string | null; city: string | null;
          lead_status: string; lead_category: string | null;
          ai_opportunity_score: number | null;
          claude_recommendation_reason: string | null;
          notes: string | null;
          next_action: string | null;
          assigned_user_id: string | null;
          project_id: string | null;
        }>(
          `SELECT name, address, city, lead_status, lead_category,
                  ai_opportunity_score, claude_recommendation_reason,
                  notes, next_action, assigned_user_id, project_id
             FROM crm_customers WHERE id = $1 LIMIT 1`,
          [req.params.id],
        );
        if (leadRes.rows.length === 0) return res.status(404).json({ error: "lead_ikke_funnet" });
        const lead = leadRes.rows[0];

        // Hent SELGERENS organisasjons-profil for å tilpasse til
        // produktet de selger
        let sellerOrg: {
          name: string; description: string | null; website: string | null;
          industry: string | null; meta: Record<string, unknown> | null;
        } | null = null;
        if (lead.project_id) {
          const sellerRes = await pool.query<{
            name: string; description: string | null; website: string | null;
            industry: string | null; meta: Record<string, unknown>;
          }>(
            `SELECT o.name, o.description, o.website, o.industry, o.meta
               FROM organizations o
               JOIN casting_projects cp ON cp.organization_id = o.id
              WHERE cp.id = $1 LIMIT 1`,
            [lead.project_id],
          );
          sellerOrg = sellerRes.rows[0] ?? null;
        }

        // Hent siste 3 won-leads i samme org for å vise Claude
        // hva vi typisk selger som lander
        let wonExamples: Array<{ name: string; notes: string | null }> = [];
        if (lead.project_id) {
          const wonRes = await pool.query<{ name: string; notes: string | null }>(
            `SELECT c.name, c.notes
               FROM crm_customers c
               JOIN casting_projects cp ON cp.id = c.project_id
               JOIN casting_projects cp2 ON cp2.organization_id = cp.organization_id
              WHERE cp2.id = $1
                AND c.lead_status = 'won'
                AND c.id != $2
              ORDER BY c.updated_at DESC LIMIT 3`,
            [lead.project_id, req.params.id],
          );
          wonExamples = wonRes.rows;
        }

        const visitsRes = await pool.query<{
          visit_datetime: string; visit_type: string;
          previous_status: string | null; new_status: string | null;
          contact_person: string | null;
          conversation_summary: string | null;
          objection_reason: string | null;
          next_action: string | null;
          notes: string | null;
        }>(
          `SELECT visit_datetime::text, visit_type, previous_status, new_status,
                  contact_person, conversation_summary, objection_reason,
                  next_action, notes
             FROM crm_visits
            WHERE customer_id = $1
            ORDER BY visit_datetime DESC LIMIT 5`,
          [req.params.id],
        );

        const claude = getClaude();
        if (!claude) {
          return res.json({
            headline: lead.name,
            key_status: `Status: ${lead.lead_status}. Claude ikke konfigurert.`,
            warnings: [],
            talking_points: [],
            questions_to_ask: [],
            progress_tips: [],
            fallback: "claude_not_configured",
          });
        }

        // Hent BRREG-data + ai/claude enrichment hvis tilgjengelig
        const enrichmentRes = await pool.query<{
          brreg_data: Record<string, unknown> | null;
          proff_data: Record<string, unknown> | null;
        }>(
          `SELECT
              COALESCE(brreg_company_data, '{}'::jsonb) AS brreg_data,
              COALESCE(proff_company_data, '{}'::jsonb) AS proff_data
             FROM crm_customers WHERE id = $1`,
          [req.params.id],
        ).catch(() => ({ rows: [{ brreg_data: null, proff_data: null }] }));
        const brregData = enrichmentRes.rows[0]?.brreg_data ?? null;
        const proffData = enrichmentRes.rows[0]?.proff_data ?? null;

        const visitsCtx = visitsRes.rows.map((v, i) =>
          `Besøk ${i + 1} (${v.visit_datetime?.slice(0, 10)}, ${v.visit_type}):` +
          (v.contact_person ? `\n  Kontakt: ${v.contact_person}` : "") +
          (v.previous_status && v.new_status && v.previous_status !== v.new_status
            ? `\n  Status: ${v.previous_status} → ${v.new_status}` : "") +
          (v.conversation_summary ? `\n  Samtale: ${v.conversation_summary}` : "") +
          (v.objection_reason ? `\n  Innvending: ${v.objection_reason}` : "") +
          (v.next_action ? `\n  Neste handling: ${v.next_action}` : "")
        ).join("\n\n");

        const brregSummary = brregData && Object.keys(brregData).length > 0
          ? `\n\nBRREG-data:\n${JSON.stringify(brregData, null, 2).slice(0, 800)}`
          : "";
        const proffSummary = proffData && Object.keys(proffData).length > 0
          ? `\n\nProff-data (økonomi):\n${JSON.stringify(proffData, null, 2).slice(0, 800)}`
          : "";

        const sellerCtx = sellerOrg
          ? `SELGER (din organisasjon): ${sellerOrg.name}` +
            (sellerOrg.industry ? ` — bransje: ${sellerOrg.industry}` : "") +
            (sellerOrg.description ? `\nHva vi selger: ${sellerOrg.description}` : "") +
            (sellerOrg.website ? `\nNettside: ${sellerOrg.website}` : "")
          : "";
        const wonCtx = wonExamples.length > 0
          ? `\n\nTYPISKE KUNDER VI HAR VUNNET (samme org):\n` +
            wonExamples.map((w) => `- ${w.name}${w.notes ? `: ${w.notes.slice(0, 200)}` : ""}`).join("\n")
          : "";

        const ctx = sellerCtx + wonCtx + `\n\n────────────────\nLead: ${lead.name}` +
          (lead.lead_category ? ` (${lead.lead_category})` : "") +
          `\nAdresse: ${[lead.address, lead.city].filter(Boolean).join(", ") || "—"}` +
          `\nStatus: ${lead.lead_status}` +
          (lead.ai_opportunity_score !== null
            ? `\nAI-score: ${lead.ai_opportunity_score}/100` : "") +
          (lead.claude_recommendation_reason
            ? `\nClaude-anbefaling: ${lead.claude_recommendation_reason}` : "") +
          (lead.notes ? `\nGenerelle notater: ${lead.notes}` : "") +
          (lead.next_action ? `\nForrige neste handling: ${lead.next_action}` : "") +
          brregSummary + proffSummary +
          (visitsCtx ? `\n\n${visitsCtx}` : "\n\nIngen tidligere besøk.");

        const msg = await claude.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 1024,
          system: MEETING_BRIEF_PROMPT,
          messages: [{ role: "user", content: ctx }],
        });
        const text = msg.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("");
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return res.json({
            headline: lead.name,
            key_status: text.slice(0, 200),
            warnings: [],
            talking_points: [],
            questions_to_ask: [],
            progress_tips: [],
            error: "claude_unparseable",
          });
        }
        return res.json(JSON.parse(jsonMatch[0]));
      } catch (err) {
        return res.status(500).json({ error: "brief_failed", detail: String(err) });
      }
    },
  );

  app.post(
    "/api/admin-room/lead-map/visits/parse-transcript",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

      const body = req.body as { lead_id?: string; transcript?: string };
      if (!body.lead_id || !body.transcript) {
        return res.status(400).json({ error: "mangler_felt" });
      }
      const transcript = body.transcript.trim();
      if (transcript.length < 8) {
        return res.status(400).json({ error: "transkript_for_kort" });
      }

      // Hent lead-navn for kontekst + sjekk eierskap
      const r = await pool.query<{ name: string; assigned_user_id: string | null }>(
        `SELECT name, assigned_user_id FROM crm_customers WHERE id = $1 LIMIT 1`,
        [body.lead_id],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "lead_ikke_funnet" });
      const leadName = r.rows[0].name;

      const claude = getClaude();
      if (!claude) {
        // Fallback: bare returner transkriptet uendret
        return res.json({
          resolved_text: transcript,
          action_items: [],
          follow_up_date: null,
          calendar_suggestion: null,
          sentiment: "nøytral",
          fallback: "claude_not_configured",
        });
      }

      try {
        const todayIso = new Date().toISOString().split("T")[0];
        const msg = await claude.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Lead-navn: ${leadName}\nDagens dato: ${todayIso}\n\nTranskripsjon:\n${transcript}`,
            },
          ],
        });

        const text = msg.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("");

        // Trekk ut JSON (Claude kan inkludere markdown-formatering)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return res.json({
            resolved_text: transcript,
            action_items: [],
            follow_up_date: null,
            calendar_suggestion: null,
            sentiment: "nøytral",
            error: "claude_response_unparseable",
          });
        }
        const analysis = JSON.parse(jsonMatch[0]) as TranscriptAnalysis;
        return res.json(analysis);
      } catch (err) {
        return res.status(500).json({ error: "claude_failed", detail: String(err) });
      }
    },
  );
}
