/**
 * role-room-lead-nurture-routes.ts
 *
 * Agent «Nurture-sekvens»: Claude-genererte, kontekstuelle 4-stegs e-post-
 * sekvenser per lead (Velkomst → Verdi → Case → Tilbud). Hvert steg lages ut
 * fra lead-navn, segment (varm/lunken/kald) og EKTE beste-tid-innsikt fra
 * feed-strategy. Lagrer som JSONB (mig 286). Sending kobles på senere.
 *
 *   GET   /api/role-room/leads/nurture?leadExternalId=&connectionId=
 *           → siste genererte sekvens for en lead
 *   POST  /api/role-room/leads/nurture/generate
 *           body: { connectionId?, leadExternalId?, leadName, leadEmail?,
 *                   segment?, company?, platform? }
 *   PATCH /api/role-room/leads/nurture/:id  body: { status }
 */

import type express from "express";
import type { Pool } from "pg";
import { loadStrategy } from "./role-room-feed-strategy";

interface SessionLike { userId: string; email?: string; name?: string }

export interface RoleRoomLeadNurtureRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

type NurtureStatus = "draft" | "queued" | "sent";

interface NurtureStep {
  step: number;
  emailKind: string;          // velkomst | verdi | case | tilbud
  label: string;
  subject: string;
  body: string;
  insightHead?: string | null;
  insightSub?: string | null;
  insightStat?: string | null;
  insightUnit?: string | null;
  sendOffsetDays: number;     // 0, 4, 8, 12
}

interface SequenceRow {
  id: string;
  owner_user_id: string;
  connection_id: string | null;
  lead_external_id: string | null;
  lead_name: string | null;
  lead_email: string | null;
  segment: string | null;
  steps: NurtureStep[];
  status: NurtureStatus;
  source: string | null;
  created_at: string;
  updated_at: string;
}

const STEP_DEFS = [
  { emailKind: "velkomst", label: "Velkomst", sendOffsetDays: 0 },
  { emailKind: "verdi", label: "Verdi", sendOffsetDays: 4 },
  { emailKind: "case", label: "Case", sendOffsetDays: 8 },
  { emailKind: "tilbud", label: "Tilbud", sendOffsetDays: 12 },
];

function mapRow(r: Record<string, unknown>): SequenceRow {
  let steps: NurtureStep[] = [];
  const raw = r.steps;
  if (Array.isArray(raw)) steps = raw as NurtureStep[];
  else if (typeof raw === "string") { try { const p = JSON.parse(raw); if (Array.isArray(p)) steps = p; } catch { /* ignore */ } }
  return {
    id: String(r.id),
    owner_user_id: String(r.owner_user_id),
    connection_id: r.connection_id == null ? null : String(r.connection_id),
    lead_external_id: r.lead_external_id == null ? null : String(r.lead_external_id),
    lead_name: r.lead_name == null ? null : String(r.lead_name),
    lead_email: r.lead_email == null ? null : String(r.lead_email),
    segment: r.segment == null ? null : String(r.segment),
    steps,
    status: (["draft", "queued", "sent"].includes(String(r.status)) ? r.status : "draft") as NurtureStatus,
    source: r.source == null ? null : String(r.source),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

/** Henter en ekte beste-tid-innsikt (f.eks. «tir 19–21») fra feed-strategy. */
async function bestTimeInsight(pool: Pool): Promise<string | null> {
  try {
    const strat = await loadStrategy(pool, "instagram");
    const windows = (strat as { summary?: { postingWindows?: Array<{ audience: string; bestWindows: string[] }> } }).summary?.postingWindows;
    if (Array.isArray(windows) && windows[0]?.bestWindows?.[0]) return windows[0].bestWindows[0];
  } catch { /* fallback under */ }
  return null;
}

interface GeneratedStep { subject: string; body: string; insightHead?: string; insightSub?: string; insightStat?: string; insightUnit?: string }

async function generateWithClaude(
  ctx: { leadName: string; segment: string | null; company: string | null; bestTime: string | null; senderName: string },
): Promise<GeneratedStep[] | null> {
  if (process.env.ROLE_ROOM_AGENT_CLAUDE_ENABLED !== "true" || !process.env.ANTHROPIC_API_KEY) return null;
  let client: any;
  try {
    // @ts-ignore — optional SDK
    const mod: any = await import("@anthropic-ai/sdk");
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch { return null; }

  const prompt = `Du er The Role Room Agent — skriver norske nurture-e-poster for ${ctx.senderName} (The Role Room).
Lag en 4-stegs nurture-sekvens for denne leaden:
${JSON.stringify(ctx, null, 2)}

Stegene (i rekkefølge) er: 1) Velkomst, 2) Verdi (gi konkret gratis innsikt), 3) Case (sosialt bevis), 4) Tilbud (lav-terskel CTA).
Tilpass tonen til segmentet (varm = mer direkte mot salg, kald = mer verdi først). Bruk leadens navn. Ikke bruk emoji.
For steg 2 (Verdi): bruk den ekte beste-tid-innsikten "${ctx.bestTime ?? "ukjent"}" og sett insightHead/insightSub/insightStat/insightUnit (f.eks. stat "+118 %", unit "rekkevidde").

Svar KUN med gyldig JSON, ingen markdown:
{"steps":[{"subject":"...","body":"...","insightHead":"...","insightSub":"...","insightStat":"...","insightUnit":"..."}, ... 4 stk]}
(insight-feltene kan være tomme for andre steg enn Verdi.)`;

  try {
    const response = await client.messages.create({
      model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || "claude-sonnet-4-5",
      max_tokens: 2400,
      messages: [{ role: "user", content: prompt }],
    });
    let text = "";
    for (const block of response.content ?? []) {
      if (block.type === "text" && typeof block.text === "string") text += block.text;
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1));
    const raw = Array.isArray(parsed.steps) ? parsed.steps : [];
    const steps: GeneratedStep[] = raw
      .filter((x: unknown): x is Record<string, unknown> => Boolean(x && typeof x === "object" && typeof (x as any).subject === "string"))
      .slice(0, 4)
      .map((x: Record<string, unknown>) => {
        const s = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
        return {
          subject: s(x.subject, 160) || "",
          body: s(x.body, 2000) || "",
          insightHead: s(x.insightHead, 80),
          insightSub: s(x.insightSub, 160),
          insightStat: s(x.insightStat, 24),
          insightUnit: s(x.insightUnit, 40),
        };
      });
    return steps.length === 4 ? steps : (steps.length ? steps : null);
  } catch (err) {
    console.error("[lead-nurture Claude] failed", err);
    return null;
  }
}

/** Mal-fallback når Claude er av. */
function templateSteps(ctx: { leadName: string; bestTime: string | null; senderName: string }): GeneratedStep[] {
  const navn = ctx.leadName || "der";
  const tid = ctx.bestTime || "tir 19–21";
  return [
    { subject: `Hyggelig å møte deg, ${navn}`, body: `Hei ${navn},\n\nTakk for interessen! Jeg er Agenten til ${ctx.senderName} i The Role Room. De neste dagene deler jeg noen konkrete grep du kan bruke uansett om vi ender opp med å samarbeide.` },
    { subject: `3 grep som doblet rekkevidden for kunder som deg`, body: `Hei ${navn},\n\nForrige uke delte jeg hvordan vi jobber. I dag får du noe konkret du kan bruke med en gang.`, insightHead: "Gratis innsikt", insightSub: `Reels publisert ${tid} — bestetidspunktet for din målgruppe`, insightStat: "+118 %", insightUnit: "rekkevidde" },
    { subject: `Slik gikk det for en kunde i samme situasjon`, body: `Hei ${navn},\n\nLa meg vise deg et konkret eksempel på hva som er mulig.` },
    { subject: `Vil du ha hele sjekklisten, ${navn}?`, body: `Hei ${navn},\n\nSvar «JA», så sender jeg over hele 9-punkts sjekklisten — ingen forpliktelser.` },
  ];
}

export function setupRoleRoomLeadNurtureRoutes(deps: RoleRoomLeadNurtureRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  // ── GET — siste sekvens for en lead ──────────────────────────────────
  app.get("/api/role-room/leads/nurture", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const leadExternalId = typeof req.query.leadExternalId === "string" && req.query.leadExternalId.trim() ? req.query.leadExternalId.trim() : null;
      const params: unknown[] = [session.userId];
      let where = "owner_user_id = $1";
      if (leadExternalId) { params.push(leadExternalId); where += ` AND lead_external_id = $${params.length}`; }
      const r = await pool.query(
        `SELECT * FROM role_room_lead_nurture_sequence WHERE ${where} ORDER BY created_at DESC LIMIT 1`,
        params,
      );
      return res.json({ sequence: r.rows[0] ? mapRow(r.rows[0]) : null });
    } catch (err) {
      console.error("[lead-nurture GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente nurture-sekvens" });
    }
  });

  // ── POST /generate — Claude-generering (fallback: mal) ───────────────
  app.post("/api/role-room/leads/nurture/generate", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body || {}) as Record<string, unknown>;
    const leadName = typeof body.leadName === "string" && body.leadName.trim() ? body.leadName.trim() : "";
    if (!leadName) return res.status(400).json({ error: "leadName kreves" });
    const connectionId = typeof body.connectionId === "string" && body.connectionId.trim() ? body.connectionId.trim() : null;
    const leadExternalId = typeof body.leadExternalId === "string" && body.leadExternalId.trim() ? body.leadExternalId.trim() : null;
    const leadEmail = typeof body.leadEmail === "string" && body.leadEmail.trim() ? body.leadEmail.trim() : null;
    const segment = typeof body.segment === "string" && body.segment.trim() ? body.segment.trim() : null;
    const company = typeof body.company === "string" && body.company.trim() ? body.company.trim() : null;
    try {
      const bestTime = await bestTimeInsight(pool);
      const senderName = session.name || "Daniel";
      const claude = await generateWithClaude({ leadName, segment, company, bestTime, senderName });
      const gen = claude ?? templateSteps({ leadName, bestTime, senderName });
      const source = claude ? "claude" : "template";

      const steps: NurtureStep[] = STEP_DEFS.map((def, i) => ({
        step: i + 1,
        emailKind: def.emailKind,
        label: def.label,
        subject: gen[i]?.subject ?? "",
        body: gen[i]?.body ?? "",
        insightHead: gen[i]?.insightHead ?? null,
        insightSub: gen[i]?.insightSub ?? null,
        insightStat: gen[i]?.insightStat ?? null,
        insightUnit: gen[i]?.insightUnit ?? null,
        sendOffsetDays: def.sendOffsetDays,
      }));

      // Rydd vekk eksisterende draft for samme lead (unngå duplikater).
      if (leadExternalId) {
        await pool.query(
          `DELETE FROM role_room_lead_nurture_sequence WHERE owner_user_id = $1 AND lead_external_id = $2 AND status = 'draft'`,
          [session.userId, leadExternalId],
        );
      }

      const r = await pool.query(
        `INSERT INTO role_room_lead_nurture_sequence
           (owner_user_id, connection_id, lead_external_id, lead_name, lead_email, segment, steps, status, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'draft', $8)
         RETURNING *`,
        [session.userId, connectionId, leadExternalId, leadName, leadEmail, segment, JSON.stringify(steps), source],
      );
      return res.json({ sequence: mapRow(r.rows[0]), source });
    } catch (err) {
      console.error("[lead-nurture generate] failed", err);
      return res.status(500).json({ error: "Klarte ikke å generere nurture-sekvens" });
    }
  });

  // ── PATCH — status (draft|queued|sent) ───────────────────────────────
  app.patch("/api/role-room/leads/nurture/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const status = (req.body || {}).status;
    if (status !== "draft" && status !== "queued" && status !== "sent") {
      return res.status(400).json({ error: "Ugyldig status" });
    }
    try {
      const r = await pool.query(
        `UPDATE role_room_lead_nurture_sequence SET status = $3, updated_at = now()
          WHERE id = $1 AND owner_user_id = $2 RETURNING *`,
        [req.params.id, session.userId, status],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      return res.json({ sequence: mapRow(r.rows[0]) });
    } catch (err) {
      console.error("[lead-nurture PATCH] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere" });
    }
  });
}
