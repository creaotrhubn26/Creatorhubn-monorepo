/**
 * role-room-lost-leads-routes.ts
 *
 * Agent «Tapte leads» — vinn-tilbake-analyse. Tar tapte leads (stage='tapt')
 * og lar Claude vurdere SANNSYNLIG tapsårsak + et konkret vinn-tilbake-grep
 * per lead, pluss en aggregert lærings-innsikt (din vanligste lekkasje).
 * Tapsårsak lagres ikke i dag, så dette er Agentens analyse — ikke fasit.
 * Ren analyse, ingen DB-skriving.
 *
 *   POST /api/role-room/leads/lost-analysis
 *     body: { leads: [{ id, name?, company?, platform?, valueKr?,
 *                        segmentReason?, daysSinceCreated? }] }
 *     → { analyses: [{ id, lossReason, winBack }], insight }
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike { userId: string; email?: string; name?: string }

export interface RoleRoomLostLeadsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

interface LostLeadInput {
  id: string;
  name?: string | null;
  company?: string | null;
  platform?: string | null;
  valueKr?: number | null;
  segmentReason?: string | null;
  daysSinceCreated?: number | null;
}

interface LostLeadAnalysis { id: string; lossReason: string; winBack: string }

const REASONS = ["Tregt svar", "Pris over budsjett", "Valgte konkurrent", "Mistet interesse", "Feil tidspunkt"];

function heuristic(leads: LostLeadInput[]): { analyses: LostLeadAnalysis[]; insight: string } {
  const analyses = leads.map((l, i) => {
    const reason = (l.daysSinceCreated ?? 0) > 2 ? "Tregt svar" : REASONS[i % REASONS.length];
    const winBack = reason === "Tregt svar"
      ? "Send portefølje + en kort hasterabatt med tydelig frist."
      : reason === "Pris over budsjett"
        ? "Tilby en trinnvis startpakke til lavere inngangspris."
        : reason === "Valgte konkurrent"
          ? "Følg opp om 6 uker med en case fra samme bransje."
          : "Ta kontakt med et nytt, konkret vinkel-forslag.";
    return { id: l.id, lossReason: reason, winBack };
  });
  return { analyses, insight: "Svartid er ofte den vanligste lekkasjen — sett opp auto-oppfølging for nye leads." };
}

async function analyzeWithClaude(leads: LostLeadInput[]): Promise<{ analyses: LostLeadAnalysis[]; insight: string } | null> {
  if (process.env.ROLE_ROOM_AGENT_CLAUDE_ENABLED !== "true" || !process.env.ANTHROPIC_API_KEY) return null;
  let client: any;
  try {
    // @ts-ignore — optional SDK
    const mod: any = await import("@anthropic-ai/sdk");
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch { return null; }

  const prompt = `Du er The Role Room Agent — norsk salgs-analytiker. Disse leadene gikk tapt:
${JSON.stringify(leads, null, 2)}

For HVER lead, vurder den mest sannsynlige tapsårsaken (kort, f.eks. "Tregt svar", "Pris over budsjett", "Valgte konkurrent", "Mistet interesse", "Feil tidspunkt") og foreslå ETT konkret vinn-tilbake-grep (én setning, handlingsrettet, norsk). Bruk segmentReason og daysSinceCreated som hint.
Gi også én aggregert lærings-innsikt om den vanligste lekkasjen på tvers av leadene.

Svar KUN med gyldig JSON, ingen markdown:
{"analyses":[{"id":"...","lossReason":"...","winBack":"..."}],"insight":"..."}`;

  try {
    const response = await client.messages.create({
      model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || "claude-sonnet-4-5",
      max_tokens: 1600,
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
    const raw = Array.isArray(parsed.analyses) ? parsed.analyses : [];
    const byId = new Map<string, LostLeadAnalysis>();
    for (const a of raw) {
      if (a && typeof a.id === "string" && typeof a.winBack === "string") {
        byId.set(a.id, { id: a.id, lossReason: typeof a.lossReason === "string" ? a.lossReason.slice(0, 40) : "Ukjent", winBack: a.winBack.slice(0, 240) });
      }
    }
    // Fyll inn evt. manglende leads med heuristikk.
    const analyses = leads.map((l) => byId.get(l.id) ?? heuristic([l]).analyses[0]);
    const insight = typeof parsed.insight === "string" && parsed.insight.trim() ? parsed.insight.trim().slice(0, 240) : heuristic(leads).insight;
    return { analyses, insight };
  } catch (err) {
    console.error("[lost-leads Claude] failed", err);
    return null;
  }
}

export function setupRoleRoomLostLeadsRoutes(deps: RoleRoomLostLeadsRoutesDeps): void {
  const { app, getActiveSession } = deps;

  app.post("/api/role-room/leads/lost-analysis", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const rawLeads = (req.body || {}).leads;
    if (!Array.isArray(rawLeads) || rawLeads.length === 0) return res.json({ analyses: [], insight: "" });
    const leads: LostLeadInput[] = rawLeads.slice(0, 25).map((l: Record<string, unknown>) => ({
      id: String(l.id ?? ""),
      name: typeof l.name === "string" ? l.name : null,
      company: typeof l.company === "string" ? l.company : null,
      platform: typeof l.platform === "string" ? l.platform : null,
      valueKr: typeof l.valueKr === "number" ? l.valueKr : null,
      segmentReason: typeof l.segmentReason === "string" ? l.segmentReason : null,
      daysSinceCreated: typeof l.daysSinceCreated === "number" ? l.daysSinceCreated : null,
    })).filter((l: LostLeadInput) => l.id);
    try {
      const result = (await analyzeWithClaude(leads)) ?? heuristic(leads);
      return res.json({ ...result, source: result === undefined ? "template" : undefined });
    } catch (err) {
      console.error("[lost-leads analysis] failed", err);
      return res.status(500).json({ error: "Klarte ikke å analysere tapte leads" });
    }
  });
}
