/**
 * nextrole-video-presentations.ts
 *
 * Video-presentasjon-trening (Pro). Bruker tar opp en kort video
 * (30-120 sek) som svar på en prompt. AI-pipelinen:
 *
 *   1. Whisper transkriberer audio (Whisper API godtar webm/mp4 direkte)
 *   2. Frontend sender opp til 6 keyframes (base64 PNG) for vision-analyse
 *   3. Claude vurderer:
 *      • Innhold (treff mot prompt, struktur, kompetansekrav)
 *      • Levering (taleflyt, fyllord, energi, struktur)
 *      • Body language (basert på keyframes — øyekontakt, smil, energi)
 *
 * Endepunkter:
 *   POST /api/video-presentations            opprett sesjon (prompt + ev. JD-binding)
 *   POST /api/video-presentations/:id/upload last opp video + keyframes
 *   GET  /api/video-presentations/:id        hent én sesjon
 *   GET  /api/video-presentations            list brukerens sesjoner
 *   DELETE /api/video-presentations/:id
 *
 * Kobling til jobbsøknad: hvis `jobApplicationId` settes, ekstraheres
 * kompetansekrav fra søknadens JD og brukes i scoringen.
 */

import type express from "express";
import type { Pool } from "pg";
import multer from "multer";
import { uploadTrainingMedia, transcribeAudioWithWhisper, isTranscriptionError } from "./nextrole-audio-service";
import { scrubPII } from "./nextrole-pii-filter";

// Lokal Claude-helper med vision-støtte (callClaude i resume-routes
// godtar kun string-content). Identisk modell-valg og auth som der.
type ClaudeContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

interface ClaudeVisionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callClaude(opts: {
  system: string;
  user: string | ClaudeContentBlock[];
  maxTokens?: number;
  model?: string;
}): Promise<ClaudeVisionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY er ikke satt på serveren");
  }
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const content: ClaudeContentBlock[] =
    typeof opts.user === "string"
      ? [{ type: "text", text: opts.user }]
      : opts.user;
  const response = await client.messages.create({
    model: opts.model ?? "claude-sonnet-4-5-20250929",
    max_tokens: opts.maxTokens ?? 2000,
    system: opts.system,
    messages: [{ role: "user", content: content as unknown as never[] }],
  });
  type Block = { type: string; text?: string };
  const text = (response.content as Block[])
    .filter(
      (b): b is { type: "text"; text: string } =>
        b.type === "text" && typeof b.text === "string",
    )
    .map((b) => b.text)
    .join("\n")
    .trim();
  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export interface NextRoleVideoDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string } | null;
}

// Enkel inline rate-limit per bruker (5 video-analyser per time).
// Tyngre operasjon enn tekst, så lavere limit enn vanlige AI-kall.
const VIDEO_RATE_LIMIT_PER_HOUR = 5;
const videoRateLog: Map<string, number[]> = new Map();
function withinVideoRateLimit(userId: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const log = videoRateLog.get(userId) ?? [];
  const recent = log.filter((t) => now - t < windowMs);
  if (recent.length >= VIDEO_RATE_LIMIT_PER_HOUR) {
    const oldest = Math.min(...recent);
    return {
      allowed: false,
      retryAfterSec: Math.ceil((windowMs - (now - oldest)) / 1000),
    };
  }
  recent.push(now);
  videoRateLog.set(userId, recent);
  return { allowed: true };
}

// Multer for video-upload + keyframe-images (JSON-encoded base64).
// Video opp til 80MB (≈ 2 min 1080p) + ekstra slack.
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

// Forhåndsdefinerte prompts. Kan utvides med JD-spesifikke i frontend.
export const VIDEO_PROMPTS = [
  {
    kind: "about_yourself",
    text: "Fortell om deg selv på 60 sekunder. Hvem er du, hva har du gjort, og hva er du på leting etter?",
    durationSec: 60,
  },
  {
    kind: "why_company",
    text: "Hvorfor søker du nettopp denne stillingen og dette selskapet? Vær konkret.",
    durationSec: 60,
  },
  {
    kind: "strength_weakness",
    text: "Beskriv din største faglige styrke og én svakhet du jobber med — vær konkret med eksempler.",
    durationSec: 90,
  },
  {
    kind: "biggest_project",
    text: "Beskriv ditt mest komplekse faglige prosjekt: situasjon, din rolle, resultat. Hold deg til STAR-formatet.",
    durationSec: 90,
  },
];

interface SessionRow {
  id: string;
  user_id: string;
  resume_id: string | null;
  job_application_id: string | null;
  prompt_text: string;
  prompt_kind: string | null;
  target_duration_sec: number | null;
  video_r2_key: string | null;
  video_mime: string | null;
  video_bytes: number | null;
  duration_ms: number | null;
  transcript: string | null;
  competence_scores: Record<string, number> | null;
  delivery_scores: Record<string, number> | null;
  overall_score: number | null;
  feedback_summary: string | null;
  strengths: string[] | null;
  improvement_areas: string[] | null;
  status: string;
  error_detail: string | null;
  created_at: Date;
  completed_at: Date | null;
}

function toApi(row: SessionRow) {
  return {
    id: row.id,
    resumeId: row.resume_id,
    jobApplicationId: row.job_application_id,
    promptText: row.prompt_text,
    promptKind: row.prompt_kind,
    targetDurationSec: row.target_duration_sec,
    durationMs: row.duration_ms,
    transcript: row.transcript,
    competenceScores: row.competence_scores,
    deliveryScores: row.delivery_scores,
    overallScore: row.overall_score,
    feedbackSummary: row.feedback_summary,
    strengths: row.strengths ?? [],
    improvementAreas: row.improvement_areas ?? [],
    status: row.status,
    errorDetail: row.error_detail,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

function tryParseJson<T>(s: string): T | null {
  if (!s) return null;
  // Claude returnerer noen ganger med ```json-blokker eller leading text.
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

export function setupNextRoleVideoPresentationRoutes(
  deps: NextRoleVideoDeps,
): void {
  const { app, pool, getActiveSessionFromRequest } = deps;

  const requireSession = (req: express.Request, res: express.Response) => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    return session;
  };

  // GET prompts — frontend henter forhåndsdefinerte spørsmål
  app.get("/api/video-presentations/prompts", async (_req, res) => {
    res.json({ prompts: VIDEO_PROMPTS });
  });

  // POST opprett sesjon (steg 1 — før opptak)
  app.post("/api/video-presentations", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const promptText = String(body.promptText ?? "").trim();
    if (!promptText) {
      res.status(400).json({ error: "promptText er påkrevd" });
      return;
    }
    try {
      const r = await pool.query<SessionRow>(
        `INSERT INTO nextrole_video_presentations (
           user_id, resume_id, job_application_id, prompt_text,
           prompt_kind, target_duration_sec, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [
          session.userId,
          (body.resumeId as string | null) || null,
          (body.jobApplicationId as string | null) || null,
          promptText,
          (body.promptKind as string | null) || "custom",
          typeof body.targetDurationSec === "number"
            ? body.targetDurationSec
            : null,
        ],
      );
      res.status(201).json({ session: toApi(r.rows[0]) });
    } catch (err) {
      console.error("[video-presentations] create failed", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST upload video + keyframes → full analyse-pipeline
  app.post(
    "/api/video-presentations/:id/upload",
    videoUpload.single("video"),
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      const rl = withinVideoRateLimit(session.userId);
      if (!rl.allowed) {
        res.setHeader("Retry-After", String(rl.retryAfterSec ?? 60));
        res.status(429).json({
          error: "video_rate_limit",
          retryAfterSec: rl.retryAfterSec,
          message: `Maks ${VIDEO_RATE_LIMIT_PER_HOUR} video-analyser per time.`,
        });
        return;
      }
      const id = req.params.id;
      const file = (req as express.Request & {
        file?: { buffer: Buffer; mimetype: string; size: number };
      }).file;
      if (!file?.buffer?.byteLength) {
        res.status(400).json({ error: "video er påkrevd" });
        return;
      }

      // Keyframes sendes som JSON-string-array med base64-PNG i body.keyframes.
      const keyframesRaw = (req.body?.keyframes as string | undefined) ?? "";
      let keyframes: string[] = [];
      try {
        if (keyframesRaw) {
          const parsed = JSON.parse(keyframesRaw);
          if (Array.isArray(parsed)) keyframes = parsed.slice(0, 6) as string[];
        }
      } catch {
        keyframes = [];
      }

      // Hent sesjonen + ev. JD-kontekst
      const sessRow = await pool.query<
        SessionRow & { job_title?: string; company?: string; jd_notes?: string }
      >(
        `SELECT vp.*,
                ja.job_title AS job_title,
                ja.company AS company,
                ja.notes AS jd_notes
           FROM nextrole_video_presentations vp
           LEFT JOIN job_applications ja ON ja.id = vp.job_application_id
          WHERE vp.id = $1 AND vp.user_id = $2`,
        [id, session.userId],
      );
      if (!sessRow.rowCount) {
        res.status(404).json({ error: "sesjon ikke funnet" });
        return;
      }
      const sess = sessRow.rows[0];

      await pool.query(
        `UPDATE nextrole_video_presentations
            SET status = 'processing', updated_at = NOW()
          WHERE id = $1`,
        [id],
      );

      try {
        // STEG 1 — last opp video til R2 (best-effort, vi fortsetter ved feil)
        let videoR2Key: string | null = null;
        try {
          const uploaded = await uploadTrainingMedia({
            buffer: file.buffer,
            mime: file.mimetype,
            kind: "video",
            userId: session.userId,
            sessionId: id,
          });
          if (uploaded.ok) videoR2Key = uploaded.key;
        } catch (err) {
          console.warn("[video-presentations] R2 upload failed", err);
        }

        // STEG 2 — Whisper-transkripsjon (Whisper godtar webm/mp4 direkte)
        const transcription = await transcribeAudioWithWhisper({
          buffer: file.buffer,
          filename: `video-presentation-${id}.${file.mimetype.includes("mp4") ? "mp4" : "webm"}`,
          mime: file.mimetype,
          preferredLanguage: "no",
        });
        if (isTranscriptionError(transcription)) {
          await pool.query(
            `UPDATE nextrole_video_presentations
                SET status = 'failed',
                    error_detail = $2,
                    updated_at = NOW()
              WHERE id = $1`,
            [id, `transkripsjon: ${transcription.error}`],
          );
          res.status(502).json({
            error: "transkripsjon_feilet",
            detail: transcription.error,
          });
          return;
        }

        // STEG 3 — Claude-analyse (tekst + valgfri vision)
        const visionContent: Array<
          | { type: "text"; text: string }
          | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
        > = [
          {
            type: "text",
            text: [
              "Vurder denne video-presentasjonen som AI-coach. Skriv resultatet som JSON.",
              "",
              `PROMPT KANDIDATEN SVARTE PÅ:\n"${scrubPII(sess.prompt_text)}"`,
              sess.job_title ? `\nSØKER STILLING: ${scrubPII(sess.job_title)}` : "",
              sess.company ? `\nSELSKAP: ${scrubPII(sess.company)}` : "",
              sess.jd_notes
                ? `\nSTILLINGSANNONSE (utdrag):\n${scrubPII(sess.jd_notes.slice(0, 1500))}`
                : "",
              `\nKANDIDATENS TRANSKRIBERTE SVAR:\n"${scrubPII(transcription.text)}"`,
              transcription.durationMs
                ? `\nTaletid: ${(transcription.durationMs / 1000).toFixed(1)} sek`
                : "",
              "",
              keyframes.length
                ? `Vedlagt ${keyframes.length} keyframes fra videoen — bruk dem til å vurdere body language, energi, og om kandidaten ser inn i kameraet.`
                : "Ingen video-keyframes vedlagt — vurder kun innhold og taleflyt.",
              "",
              "Returner KUN JSON i dette formatet:",
              `{
  "overall_score": 0-100,
  "feedback_summary": "3-4 setninger med konkret tilbakemelding",
  "delivery_scores": {
    "speech_clarity": 0-10,
    "filler_words_count": int,
    "energy": 0-10,
    "structure": 0-10,
    "eye_contact": 0-10
  },
  "strengths": ["kort styrke 1", "kort styrke 2", ...],
  "improvement_areas": ["konkret forbedring 1", "konkret forbedring 2", ...]
}`,
              "Ingen markdown rundt. Bare JSON.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ];
        // Legg til keyframes som image-blokker
        for (const kf of keyframes) {
          // Tillat både ren base64 og data-URL ("data:image/png;base64,...")
          let mediaType = "image/png";
          let data = kf;
          const m = kf.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
          if (m) {
            mediaType = m[1];
            data = m[2];
          }
          visionContent.push({
            type: "image",
            source: { type: "base64", media_type: mediaType, data },
          });
        }

        const ai = await callClaude({
          system: [
            "Du er en streng, men konstruktiv intervju-coach for norske jobbsøkere.",
            "Du vurderer korte video-presentasjoner med konkret og brukbar feedback.",
            "",
            "Når du scorer delivery_scores:",
            "  • speech_clarity: 0=mumling/uforståelig, 10=krystallklar",
            "  • filler_words_count: faktisk antall 'eh', 'liksom', 'ikke sant' osv",
            "  • energy: 0=monoton, 10=engasjert/dynamisk",
            "  • structure: 0=hopper rundt, 10=tydelig intro→hoved→avslutning",
            "  • eye_contact: 0=ser bort/ned, 10=ser inn i kameraet (basert på keyframes)",
            "",
            "feedback_summary skal være ærlig — ikke gi 70+ til en svak presentasjon.",
            "strengths og improvement_areas skal være konkrete (max 4 av hver).",
          ].join("\n"),
          user: visionContent,
          maxTokens: 2000,
        });

        const parsed = tryParseJson<{
          overall_score?: number;
          feedback_summary?: string;
          delivery_scores?: Record<string, number>;
          strengths?: string[];
          improvement_areas?: string[];
        }>(ai.text);

        if (!parsed) {
          await pool.query(
            `UPDATE nextrole_video_presentations
                SET status = 'failed',
                    error_detail = 'kunne_ikke_parse_ai_respons',
                    updated_at = NOW()
              WHERE id = $1`,
            [id],
          );
          res.status(502).json({ error: "Kunne ikke parse AI-respons" });
          return;
        }

        // STEG 4 — Lagre alt
        const updated = await pool.query<SessionRow>(
          `UPDATE nextrole_video_presentations
              SET video_r2_key = $2,
                  video_mime = $3,
                  video_bytes = $4,
                  duration_ms = $5,
                  transcript = $6,
                  transcript_lang = $7,
                  delivery_scores = $8::jsonb,
                  overall_score = $9,
                  feedback_summary = $10,
                  strengths = $11,
                  improvement_areas = $12,
                  status = 'completed',
                  completed_at = NOW(),
                  updated_at = NOW()
            WHERE id = $1
            RETURNING *`,
          [
            id,
            videoR2Key,
            file.mimetype,
            file.buffer.byteLength,
            transcription.durationMs,
            transcription.text,
            transcription.language,
            parsed.delivery_scores ? JSON.stringify(parsed.delivery_scores) : null,
            typeof parsed.overall_score === "number"
              ? Math.round(parsed.overall_score)
              : null,
            parsed.feedback_summary ?? null,
            parsed.strengths ?? [],
            parsed.improvement_areas ?? [],
          ],
        );

        res.json({ session: toApi(updated.rows[0]) });
      } catch (err) {
        console.error("[video-presentations] processing failed", err);
        await pool.query(
          `UPDATE nextrole_video_presentations
              SET status = 'failed',
                  error_detail = $2,
                  updated_at = NOW()
            WHERE id = $1`,
          [id, String(err instanceof Error ? err.message : err).slice(0, 500)],
        );
        res.status(500).json({
          error: "behandling_feilet",
          detail: String((err as Error)?.message ?? err).slice(0, 200),
        });
      }
    },
  );

  // GET én sesjon
  app.get("/api/video-presentations/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query<SessionRow>(
      `SELECT * FROM nextrole_video_presentations
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, session.userId],
    );
    if (!r.rowCount) {
      res.status(404).json({ error: "ikke_funnet" });
      return;
    }
    res.json({ session: toApi(r.rows[0]) });
  });

  // GET list
  app.get("/api/video-presentations", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query<SessionRow>(
      `SELECT * FROM nextrole_video_presentations
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [session.userId],
    );
    res.json({ sessions: r.rows.map(toApi) });
  });

  // DELETE
  app.delete("/api/video-presentations/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query(
      `DELETE FROM nextrole_video_presentations
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, session.userId],
    );
    if (!r.rowCount) {
      res.status(404).json({ error: "ikke_funnet" });
      return;
    }
    res.json({ deleted: true });
  });
}
