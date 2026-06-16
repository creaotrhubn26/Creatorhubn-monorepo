/**
 * role-room-dm-reply-routes.ts
 *
 * Agent svarforslag på DM. Tar en samtaletråd (innkommende/utgående meldinger)
 * og lar Claude foreslå ETT svar med klassifisering (f.eks. «Varm henvendelse ·
 * booking»), treffsikkerhet (%), tone og selve svarteksten. Ren generering —
 * ingen DB. Sending skjer via eksisterende DM-reply-endepunkt.
 *
 *   POST /api/role-room/dm/reply-suggestion
 *     body: { participantName?, platform?, messages: [{direction, body}] }
 *     → { tag, confidence, reply, tone }
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLike { userId: string; email?: string; name?: string }

export interface RoleRoomDmReplyRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

interface MsgInput { direction: string; body: string }
interface Suggestion { tag: string; confidence: number; reply: string; tone: string }

function heuristic(messages: MsgInput[], name: string | null): Suggestion {
  const text = messages.map((m) => m.body).join(" ").toLowerCase();
  const booking = /book|bryllup|pris|tilbud|pakke|dato|ledig/.test(text);
  const greeting = name ? `Hei ${name}` : "Hei";
  return {
    tag: booking ? "Varm henvendelse · booking" : "Henvendelse",
    confidence: booking ? 88 : 70,
    reply: booking
      ? `${greeting}, så hyggelig at du tar kontakt! Ja, det får vi til. Jeg sender deg gjerne et forslag — har du en dato i tankene?`
      : `${greeting}, takk for meldingen! Fortell gjerne litt mer om hva du ser etter, så hjelper jeg deg videre.`,
    tone: "vennlig & profesjonell",
  };
}

async function generateWithClaude(messages: MsgInput[], name: string | null, platform: string): Promise<Suggestion | null> {
  if (process.env.ROLE_ROOM_AGENT_CLAUDE_ENABLED !== "true" || !process.env.ANTHROPIC_API_KEY) return null;
  let client: any;
  try {
    // @ts-ignore — optional SDK
    const mod: any = await import("@anthropic-ai/sdk");
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch { return null; }

  const thread = messages.map((m) => `${m.direction === "outbound" ? "OSS" : (name || "Kunde")}: ${m.body}`).join("\n");
  const prompt = `Du er The Role Room Agent — svarer på direktemeldinger (${platform}) på vegne av en innholdsprodusent.
Samtale så langt:
${thread}

Foreslå ETT svar på siste melding. Vær varm, konkret og profesjonell (norsk). Hvis det er en booking-/pris-/dato-henvendelse, før samtalen mot neste steg uten å være pågående.

Svar KUN med gyldig JSON, ingen markdown:
{"tag":"kort klassifisering, f.eks. 'Varm henvendelse · booking'","confidence":0-100,"reply":"svarteksten","tone":"f.eks. vennlig & profesjonell"}`;

  try {
    const response = await client.messages.create({
      model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || "claude-sonnet-4-5",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });
    let text = "";
    for (const block of response.content ?? []) {
      if (block.type === "text" && typeof block.text === "string") text += block.text;
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const p = JSON.parse(text.slice(start, end + 1));
    if (typeof p.reply !== "string" || !p.reply.trim()) return null;
    return {
      tag: typeof p.tag === "string" ? p.tag.slice(0, 60) : "Henvendelse",
      confidence: Math.min(100, Math.max(0, Math.round(Number(p.confidence) || 80))),
      reply: p.reply.trim().slice(0, 1200),
      tone: typeof p.tone === "string" ? p.tone.slice(0, 60) : "vennlig & profesjonell",
    };
  } catch (err) {
    console.error("[dm-reply Claude] failed", err);
    return null;
  }
}

export function setupRoleRoomDmReplyRoutes(deps: RoleRoomDmReplyRoutesDeps): void {
  const { app, getActiveSession } = deps;

  app.post("/api/role-room/dm/reply-suggestion", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const body = (req.body || {}) as Record<string, unknown>;
    const name = typeof body.participantName === "string" && body.participantName.trim() ? body.participantName.trim() : null;
    const platform = typeof body.platform === "string" && body.platform.trim() ? body.platform.trim() : "Instagram";
    const messages: MsgInput[] = Array.isArray(body.messages)
      ? body.messages.filter((m: any) => m && typeof m.body === "string" && m.body.trim())
          .slice(-20)
          .map((m: any) => ({ direction: m.direction === "outbound" ? "outbound" : "inbound", body: String(m.body).slice(0, 1000) }))
      : [];
    if (messages.length === 0) return res.status(400).json({ error: "Ingen meldinger" });
    try {
      const suggestion = (await generateWithClaude(messages, name, platform)) ?? heuristic(messages, name);
      return res.json({ suggestion });
    } catch (err) {
      console.error("[dm-reply] failed", err);
      return res.status(500).json({ error: "Klarte ikke å lage svarforslag" });
    }
  });
}
