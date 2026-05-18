/**
 * wedding-assistant-brief-notes.ts
 *
 * Slice 9X.49 — Notater + AI-sammendrag for brief-møtet.
 *
 *   PUT  /api/wedding/:weddingId/assistants/:assistantId/brief-notes
 *        { notes, transcriptUrl? }
 *   POST /api/wedding/:weddingId/assistants/:assistantId/brief-summarize
 *        → genererer summary + action-items via Claude
 *   GET  /api/wedding/:weddingId/assistants/:assistantId/brief-full
 *        — alt om brief: meet-link, notes, transcript, summary, action-items
 */

import type express from "express";
import Anthropic from "@anthropic-ai/sdk";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingAssistantBriefNotesDeps {
  app: express.Application;
  pool: any;
  getPricingUserId: (req: any) => string;
}

const SUMMARY_MODEL = process.env.WEDDING_BRIEF_SUMMARY_MODEL || "claude-haiku-4-5-20251001";

let cachedClient: Anthropic | null | undefined;
function getAnthropic(): Anthropic | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    cachedClient = null;
    return null;
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

async function ensureSchema(pool: any): Promise<void> {
  for (const col of [
    "brief_notes TEXT",
    "brief_transcript_url TEXT",
    "brief_summary TEXT",
    "brief_summary_action_items JSONB DEFAULT '[]'::jsonb",
    "brief_summarized_at TIMESTAMPTZ",
    "brief_summary_model TEXT",
  ]) {
    await pool.query(`ALTER TABLE wedding_assistants ADD COLUMN IF NOT EXISTS ${col}`).catch(() => undefined);
  }
}

interface SummaryResult {
  summary: string;
  actionItems: Array<{ owner: string; task: string; due?: string | null }>;
}

async function callClaudeForBriefSummary(args: {
  coupleName: string | null;
  weddingDate: string | null;
  assistantName: string | null;
  role: string;
  notes: string;
  transcriptHint?: string | null;
}): Promise<SummaryResult | null> {
  const client = getAnthropic();
  if (!client) return null;

  const userMessage = [
    "Du er en assistent som hjelper bryllupsfotografer med å oppsummere brief-møter med assistent-fotografer.",
    "Skriv på norsk.",
    "",
    `Bryllup: ${args.coupleName || "ukjent"} ${args.weddingDate ? new Date(args.weddingDate).toLocaleDateString("nb-NO") : ""}`,
    `Assistentens rolle: ${args.role}`,
    `Assistentens navn: ${args.assistantName || "ukjent"}`,
    "",
    "NOTATER fra møtet:",
    args.notes,
    "",
    args.transcriptHint ? `OBS: Transcript-lenke ble lagt ved (${args.transcriptHint}). Hvis tilgjengelig kontekst nevner content fra transcripten, fold det inn.` : "",
    "",
    "Returner JSON med følgende eksakte format (uten kommentarer, kun JSON):",
    "{",
    '  "summary": "2-4 setninger oppsummering",',
    '  "actionItems": [',
    '    {"owner": "photographer"|"assistant"|"both", "task": "konkret oppgave", "due": "YYYY-MM-DD eller null"}',
    "  ]",
    "}",
  ].join("\n");

  try {
    const response = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 700,
      temperature: 0.2,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = response.content[0];
    if (!block || block.type !== "text") return null;
    const text = block.text.trim();
    // Trekk ut JSON — modeller kan legge til ```json eller forklarende tekst
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: String(parsed.summary || "").slice(0, 1500),
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems
            .filter((i: any) => i && typeof i.task === "string")
            .map((i: any) => ({
              owner: ["photographer", "assistant", "both"].includes(i.owner) ? i.owner : "both",
              task: String(i.task).slice(0, 300),
              due: typeof i.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.due) ? i.due : null,
            }))
            .slice(0, 20)
        : [],
    };
  } catch (err) {
    console.warn("[brief-summary] Claude call feilet:", err);
    return null;
  }
}

export function setupWeddingAssistantBriefNotesRoutes(deps: WeddingAssistantBriefNotesDeps): void {
  const { app, pool, getPricingUserId } = deps;

  // ─── PUT brief-notes ───────────────────────────────────────────
  app.put("/api/wedding/:weddingId/assistants/:assistantId/brief-notes", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 50_000) : null;
      const transcriptUrl = typeof req.body?.transcriptUrl === "string" ? req.body.transcriptUrl.slice(0, 1000) : null;
      const r = await pool.query(
        `UPDATE wedding_assistants
           SET brief_notes = COALESCE($1, brief_notes),
               brief_transcript_url = COALESCE($2, brief_transcript_url),
               updated_at = NOW()
           WHERE id = $3 AND wedding_id = $4 AND primary_photographer_id = $5
         RETURNING id, brief_notes, brief_transcript_url`,
        [notes, transcriptUrl, req.params.assistantId, req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ briefNotes: r.rows[0].brief_notes, transcriptUrl: r.rows[0].brief_transcript_url });
    } catch (err) {
      console.error("PUT /brief-notes:", err);
      res.status(500).json({ error: "Kunne ikke lagre notater" });
    }
  });

  // ─── POST brief-summarize ──────────────────────────────────────
  app.post("/api/wedding/:weddingId/assistants/:assistantId/brief-summarize", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const a = await pool.query(
        `SELECT a.*, w.couple_name, w.wedding_date
           FROM wedding_assistants a
           JOIN wedding_timelines w ON w.id = a.wedding_id
           WHERE a.id = $1 AND a.wedding_id = $2 AND a.primary_photographer_id = $3 LIMIT 1`,
        [req.params.assistantId, req.params.weddingId, uid],
      );
      if (a.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      const row = a.rows[0];
      const notes = String(row.brief_notes || "").trim();
      if (notes.length < 20) {
        return res.status(400).json({ error: "Skriv minst noen notater før du genererer sammendrag" });
      }

      const result = await callClaudeForBriefSummary({
        coupleName: row.couple_name,
        weddingDate: row.wedding_date,
        assistantName: row.assistant_name,
        role: row.role,
        notes,
        transcriptHint: row.brief_transcript_url,
      });
      if (!result) {
        return res.status(503).json({ error: "AI-summary ikke tilgjengelig (Anthropic API-key mangler eller call feilet)" });
      }

      await pool.query(
        `UPDATE wedding_assistants
           SET brief_summary = $1,
               brief_summary_action_items = $2::jsonb,
               brief_summarized_at = NOW(),
               brief_summary_model = $3,
               updated_at = NOW()
           WHERE id = $4`,
        [result.summary, JSON.stringify(result.actionItems), SUMMARY_MODEL, row.id],
      );
      res.json(result);
    } catch (err) {
      console.error("POST /brief-summarize:", err);
      res.status(500).json({ error: "Kunne ikke generere sammendrag" });
    }
  });

  // ─── GET brief-full ────────────────────────────────────────────
  app.get("/api/wedding/:weddingId/assistants/:assistantId/brief-full", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `SELECT id, brief_meeting_event_id, brief_meeting_url, brief_meeting_at,
                brief_meeting_duration_min, brief_notes, brief_transcript_url,
                brief_summary, brief_summary_action_items, brief_summarized_at,
                brief_summary_model
           FROM wedding_assistants
           WHERE id = $1 AND wedding_id = $2 AND primary_photographer_id = $3 LIMIT 1`,
        [req.params.assistantId, req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      const row = r.rows[0];
      res.json({
        brief: {
          meetingEventId: row.brief_meeting_event_id,
          meetingUrl: row.brief_meeting_url,
          meetingAt: row.brief_meeting_at,
          meetingDurationMin: row.brief_meeting_duration_min,
          notes: row.brief_notes,
          transcriptUrl: row.brief_transcript_url,
          summary: row.brief_summary,
          actionItems: row.brief_summary_action_items || [],
          summarizedAt: row.brief_summarized_at,
          summaryModel: row.brief_summary_model,
        },
      });
    } catch (err) {
      console.error("GET /brief-full:", err);
      res.status(500).json({ error: "Kunne ikke hente brief" });
    }
  });
}
