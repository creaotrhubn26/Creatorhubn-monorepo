/**
 * leadgrid-meeting-notes-service.ts
 *
 * AI Meeting Notes — etter besøk gjør selger voice memo eller limer inn
 * tekst. Whisper transkriberer, Claude ekstraherer struktur (summary,
 * action items, decisions, next steps, topics, participants), og vi
 * auto-logger en aktivitet på lead-en.
 *
 * Eksternt avhengige API-er:
 *   - OPENAI_API_KEY  → Whisper transcription
 *   - ANTHROPIC_API_KEY → Claude analyse
 */

import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export interface ActionItem {
  title: string;
  due_date: string | null;
  priority: "high" | "medium" | "low";
  assignee: "internal" | "client" | null;
}

export interface AnalyzedMeeting {
  summary: string;
  action_items: ActionItem[];
  decisions: { decision: string; owner: string }[];
  next_steps: { step: string; owner: string; deadline: string | null }[];
  topics: { topic: string; sentiment: "positive" | "neutral" | "negative" }[];
  participants: { name: string; role: string }[];
  confidence: number;
}

/** Transkriber lydfil via Whisper API. */
export async function transcribeAudio(
  audioBuffer: Buffer,
  language = "no",
): Promise<{ transcript: string; language: string } | null> {
  if (!OPENAI_API_KEY) {
    console.warn("[meeting-notes] OPENAI_API_KEY mangler — kan ikke transkribere");
    return null;
  }
  try {
    const form = new FormData();
    // Node 20+ Blob — Whisper aksepterer m4a/mp3/wav etc.
    form.append("file", new Blob([new Uint8Array(audioBuffer)]), "audio.m4a");
    form.append("model", "whisper-1");
    form.append("language", language);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn("[meeting-notes] Whisper feilet:", res.status, errText);
      return null;
    }
    const json = (await res.json()) as { text?: string };
    return { transcript: json.text ?? "", language };
  } catch (err) {
    console.warn("[meeting-notes] Whisper exception:", err);
    return null;
  }
}

/** Kall Claude for å ekstrahere meeting-struktur fra transkripsjon. */
export async function analyzeTranscript(
  transcript: string,
  leadName: string,
): Promise<AnalyzedMeeting | null> {
  if (!ANTHROPIC_API_KEY) {
    console.warn("[meeting-notes] ANTHROPIC_API_KEY mangler");
    return null;
  }
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const prompt = `Du er en ekspert sales coach. Analyser denne møtetranskripsjonen fra et salgsmøte
med lead "${leadName}". Returner KUN gyldig JSON i nøyaktig dette skjemaet:

{
  "summary": "<2-3 setninger på norsk>",
  "action_items": [{"title": "...", "due_date": "YYYY-MM-DD eller null", "priority": "high|medium|low", "assignee": "internal|client|null"}],
  "decisions": [{"decision": "...", "owner": "..."}],
  "next_steps": [{"step": "...", "owner": "...", "deadline": "YYYY-MM-DD eller null"}],
  "topics": [{"topic": "...", "sentiment": "positive|neutral|negative"}],
  "participants": [{"name": "...", "role": "..."}],
  "confidence": 0.0-1.0
}

Transkripsjon:
${transcript}`;
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");
    // Trekk ut første { ... } blokk
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as AnalyzedMeeting;
    return parsed;
  } catch (err) {
    console.warn("[meeting-notes] Claude analyse feilet:", err);
    return null;
  }
}

/** Hovedflyt: prosesser en pending meeting-note (transcript → analyse → log). */
export async function processMeetingNote(
  pool: Pool,
  noteId: string,
): Promise<void> {
  const r = await pool.query<{
    lead_id: string;
    transcript: string | null;
    lead_name: string;
  }>(
    `SELECT mn.lead_id::text, mn.transcript, c.name AS lead_name
       FROM lead_meeting_notes mn
       JOIN crm_customers c ON c.id = mn.lead_id
       WHERE mn.id = $1::uuid`,
    [noteId],
  );
  if (r.rowCount === 0) return;
  const { lead_id: leadId, transcript, lead_name: leadName } = r.rows[0];
  if (!transcript) {
    await pool.query(
      `UPDATE lead_meeting_notes
          SET processing_status='failed',
              error_message='No transcript',
              processed_at=NOW()
        WHERE id=$1::uuid`,
      [noteId],
    );
    return;
  }
  await pool.query(
    `UPDATE lead_meeting_notes SET processing_status='analyzing' WHERE id=$1::uuid`,
    [noteId],
  );
  const analyzed = await analyzeTranscript(transcript, leadName);
  if (!analyzed) {
    await pool.query(
      `UPDATE lead_meeting_notes
          SET processing_status='failed',
              error_message='Claude analyse feilet',
              processed_at=NOW()
        WHERE id=$1::uuid`,
      [noteId],
    );
    return;
  }
  await pool.query(
    `UPDATE lead_meeting_notes
        SET summary=$1,
            action_items=$2::jsonb,
            decisions=$3::jsonb,
            next_steps=$4::jsonb,
            topics=$5::jsonb,
            participants=$6::jsonb,
            confidence=$7,
            processing_status='completed',
            processed_at=NOW(),
            raw_claude_response=$8::jsonb
      WHERE id=$9::uuid`,
    [
      analyzed.summary,
      JSON.stringify(analyzed.action_items),
      JSON.stringify(analyzed.decisions),
      JSON.stringify(analyzed.next_steps),
      JSON.stringify(analyzed.topics),
      JSON.stringify(analyzed.participants),
      analyzed.confidence,
      JSON.stringify(analyzed),
      noteId,
    ],
  );

  // Auto-log aktivitet. crm_lead_activities.activity_type har CHECK-
  // constraint som ikke inkluderer 'meeting_recap' — bruk 'note_added'
  // og legg meeting-konteksten i metadata.
  try {
    await pool.query(
      `INSERT INTO crm_lead_activities
         (customer_id, user_id, activity_type, description, metadata)
       SELECT lead_id, user_id, 'note_added', $2, $3::jsonb
         FROM lead_meeting_notes WHERE id=$1::uuid`,
      [
        noteId,
        analyzed.summary.slice(0, 500),
        JSON.stringify({
          kind: "meeting_recap",
          meeting_note_id: noteId,
          action_item_count: analyzed.action_items.length,
          decision_count: analyzed.decisions.length,
          next_step_count: analyzed.next_steps.length,
        }),
      ],
    );
  } catch (err) {
    console.warn("[meeting-notes] activity-log feilet:", err);
  }

  // Trigger NBA / intelligence re-score hvis tilgjengelig (lazy import
  // siden filen kanskje ikke finnes i alle environment).
  try {
    type EngModule = {
      computeIntelligenceForLead?: (
        p: Pool,
        id: string,
        ctx: { trigger: string },
      ) => Promise<unknown>;
    };
    let eng: EngModule | null = null;
    try {
      eng = (await import("./leadgrid-intelligence-engine.js")) as EngModule;
    } catch {
      eng = null;
    }
    if (eng && typeof eng.computeIntelligenceForLead === "function") {
      await eng.computeIntelligenceForLead(pool, leadId, { trigger: "activity" });
    }
  } catch (err) {
    console.warn("[meeting-notes] Intelligence re-score feilet:", err);
  }
}
