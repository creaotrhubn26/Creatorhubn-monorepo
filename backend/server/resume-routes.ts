/**
 * resume-routes.ts
 *
 * Komplett backend for ResumeBuilder. Realiserer endepunktene som
 * frontend (frontend/client/src/components/resume/*) allerede kaller, og
 * legger til AI-funksjonalitet via Claude:
 *
 *   CRUD:
 *     /api/resumes                       GET, POST
 *     /api/resumes/:id                   GET, PUT, PATCH, DELETE
 *     /api/resumes/:id/experiences       GET, POST
 *     /api/resumes/:id/experiences/:eid  PATCH, DELETE
 *     /api/resumes/:id/education         POST
 *     /api/resumes/:id/education/:eid    PATCH, DELETE
 *     /api/resumes/:id/skills            POST
 *     /api/resumes/:id/skills/:sid       PATCH, DELETE
 *     /api/resumes/:id/certifications    POST
 *     /api/resumes/:id/certifications/:cid PATCH, DELETE
 *     /api/resumes/:id/projects          POST
 *     /api/resumes/:id/projects/:pid     PATCH, DELETE
 *
 *   Job applications:
 *     /api/job-applications              GET, POST
 *     /api/job-applications/:id          PUT, PATCH, DELETE
 *
 *   Templates:
 *     /api/resume-templates              GET (public)
 *
 *   Spesial:
 *     /api/resumes/:id/import-completed-projects   POST  (sync CreatorHub-prosjekter)
 *     /api/resumes/:id/export                      POST  (PDF/DOCX/TXT/JSON)
 *
 *   Claude / AI:
 *     /api/resumes/:id/ai-analyze              POST   ATS + jobbannonse-match
 *     /api/resumes/:id/ai-summary              POST   generer sammendrag
 *     /api/resumes/:id/ai-cover-letter         POST   norsk søknadsbrev
 *     /api/resumes/:id/ai-grammar              POST   grammatikk + tone
 *     /api/resumes/:id/ai-translate            POST   NO↔EN-oversettelse
 *     /api/resumes/:id/ai-interview-prep       POST   intervjuspørsmål
 *     /api/resumes/:id/experiences/:eid/ai-rewrite POST   bullet-rewrite
 *
 * Auth-mønster: identisk med `requireUserSession` definert i index.ts —
 * 401 hvis ingen session, ellers per-rad-eierskap via WHERE user_id = $.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupResumeRoutes } from "./resume-routes";
 *
 *   setupResumeRoutes({ app, pool, getActiveSessionFromRequest });
 */

import type express from "express";
import type { Pool } from "pg";
import multer from "multer";
import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

// Multer-config for profilbilde-opplasting i ResumeBuilder. Lagrer
// midlertidig i RAM (5 MB max) — vi gjør om til base64 data-URL og
// lagrer i personal_info.profilePhoto, samme mønster som branding-logo.
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Kun JPEG, PNG og WebP er tillatt."));
  },
});

// Multer-config for CV-import (PDF + DOCX). 10 MB.
const cvImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Kun PDF og DOCX er tillatt."));
  },
});

// Multer-config for trening-opptak (audio + video). 50 MB tak slik at
// 2-3 minutter med 720p video fra MediaRecorder ligger godt innenfor.
// Aksepterer webm/ogg/mp4/m4a — det MediaRecorder typisk produserer.
const trainingMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const base = (file.mimetype ?? "").split(";")[0].trim().toLowerCase();
    const allowed = [
      "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg",
      "audio/wav", "audio/x-wav",
      "video/webm", "video/mp4",
    ];
    if (allowed.includes(base) || allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Ugyldig MIME: ${file.mimetype}`));
  },
});

// Multer-config for LinkedIn data-eksport (ZIP-fil opp til 50 MB).
const linkedInZipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // LinkedIn eksporter zip-er kan ha varierende MIME-typer
    const allowed = [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
      "multipart/x-zip",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.toLowerCase().endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Kun ZIP-filer fra LinkedIn-eksport er tillatt."));
    }
  },
});

import {
  asString,
  asNumberOrNull,
  asJsonbObject,
  readBoolean,
  readString,
  readOptionalIsoDate,
} from "./_shared";
import { parseLinkedInExport } from "./nextrole-linkedin-import";
import {
  uploadTrainingMedia,
  transcribeAudioWithWhisper,
  isTranscriptionError,
} from "./nextrole-audio-service";
import { scrubPII, extractCityOnly } from "./nextrole-pii-filter";

// ── Types ───────────────────────────────────────────────────────────

export interface ResumeRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string; email?: string } | null;
}

interface SessionLite {
  userId: string;
}

// Camel-case row shapes returnert til frontend. Matcher
// frontend/shared/resume-schema.ts sine TS-typer.
interface ResumeRow {
  id: string;
  userId: string;
  title: string;
  slug: string;
  personalInfo: Record<string, unknown>;
  templateId: string;
  colorScheme: string | null;
  customColors: Record<string, unknown> | null;
  atsScore: number | null;
  atsOptimized: boolean | null;
  keywords: string[] | null;
  targetJobTitle: string | null;
  targetIndustry: string | null;
  aiGenerated: boolean | null;
  aiSuggestions: Record<string, unknown> | null;
  lastAIAnalysis: string | null;
  status: string;
  isPublic: boolean | null;
  publicUrl: string | null;
  language: string | null;
  version: number | null;
  lastExported: string | null;
  exportCount: number | null;
  publicViewCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Auth + ownership helpers ────────────────────────────────────────

function makeAuth(getSession: ResumeRoutesDeps["getActiveSessionFromRequest"]) {
  return function requireSession(
    req: express.Request,
    res: express.Response,
  ): SessionLite | null {
    const session = getSession(req);
    if (!session?.userId) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    return { userId: session.userId };
  };
}

async function ensureResumeOwned(
  pool: Pool,
  resumeId: string,
  userId: string,
): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM resumes WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [resumeId, userId],
  );
  return r.rowCount! > 0;
}

// ── Row-mappers (snake → camel) ─────────────────────────────────────

function mapResume(r: Record<string, unknown>): ResumeRow {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    title: r.title as string,
    slug: r.slug as string,
    personalInfo: (r.personal_info as Record<string, unknown>) ?? {},
    templateId: r.template_id as string,
    colorScheme: (r.color_scheme as string | null) ?? null,
    customColors: (r.custom_colors as Record<string, unknown> | null) ?? null,
    atsScore: (r.ats_score as number | null) ?? null,
    atsOptimized: (r.ats_optimized as boolean | null) ?? null,
    keywords: (r.keywords as string[] | null) ?? null,
    targetJobTitle: (r.target_job_title as string | null) ?? null,
    targetIndustry: (r.target_industry as string | null) ?? null,
    aiGenerated: (r.ai_generated as boolean | null) ?? null,
    aiSuggestions:
      (r.ai_suggestions as Record<string, unknown> | null) ?? null,
    lastAIAnalysis: r.last_ai_analysis
      ? (r.last_ai_analysis as Date).toISOString?.() ??
        String(r.last_ai_analysis)
      : null,
    status: r.status as string,
    isPublic: (r.is_public as boolean | null) ?? null,
    publicUrl: (r.public_url as string | null) ?? null,
    language: (r.language as string | null) ?? null,
    version: (r.version as number | null) ?? null,
    lastExported: r.last_exported
      ? (r.last_exported as Date).toISOString?.() ?? String(r.last_exported)
      : null,
    exportCount: (r.export_count as number | null) ?? null,
    publicViewCount: (r.public_view_count as number | null) ?? 0,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapExperience(r: Record<string, unknown>) {
  return {
    id: r.id,
    resumeId: r.resume_id,
    userId: r.user_id,
    jobTitle: r.job_title,
    company: r.company,
    location: r.location,
    employmentType: r.employment_type,
    startDate: toIso(r.start_date),
    endDate: r.end_date ? toIso(r.end_date) : null,
    isCurrent: r.is_current,
    description: r.description,
    achievements: r.achievements ?? [],
    // Array<{category: string, items: string[]}> — strukturerte sub-roller
    // under én jobb (Produsent / Regissør / Fotograf). null hvis ikke
    // brukt; da rendres achievements i stedet.
    experienceGroups: (r.experience_groups as
      | Array<{ category?: string; items?: string[] }>
      | null) ?? null,
    skills: r.skills ?? [],
    projectId: r.project_id,
    autoGenerated: r.auto_generated,
    displayOrder: r.display_order,
    isVisible: r.is_visible,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapLanguage(r: Record<string, unknown>) {
  return {
    id: r.id,
    resumeId: r.resume_id,
    userId: r.user_id,
    name: r.name,
    proficiencyLevel: r.proficiency_level,
    levelLabel: r.level_label,
    isNative: r.is_native,
    displayOrder: r.display_order,
    isVisible: r.is_visible,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapEducation(r: Record<string, unknown>) {
  return {
    id: r.id,
    resumeId: r.resume_id,
    userId: r.user_id,
    degree: r.degree,
    fieldOfStudy: r.field_of_study,
    institution: r.institution,
    location: r.location,
    startDate: toIso(r.start_date),
    endDate: r.end_date ? toIso(r.end_date) : null,
    isCurrent: r.is_current,
    grade: r.grade,
    description: r.description,
    achievements: r.achievements ?? [],
    displayOrder: r.display_order,
    isVisible: r.is_visible,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapSkill(r: Record<string, unknown>) {
  return {
    id: r.id,
    resumeId: r.resume_id,
    userId: r.user_id,
    name: r.name,
    category: r.category,
    proficiencyLevel: r.proficiency_level,
    yearsOfExperience: r.years_of_experience,
    isEndorsed: r.is_endorsed,
    endorsementCount: r.endorsement_count,
    displayOrder: r.display_order,
    isVisible: r.is_visible,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapCertification(r: Record<string, unknown>) {
  return {
    id: r.id,
    resumeId: r.resume_id,
    userId: r.user_id,
    name: r.name,
    issuer: r.issuer,
    issueDate: toIso(r.issue_date),
    expiryDate: r.expiry_date ? toIso(r.expiry_date) : null,
    credentialId: r.credential_id,
    credentialUrl: r.credential_url,
    description: r.description,
    displayOrder: r.display_order,
    isVisible: r.is_visible,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapProject(r: Record<string, unknown>) {
  return {
    id: r.id,
    resumeId: r.resume_id,
    userId: r.user_id,
    title: r.title,
    description: r.description,
    role: r.role,
    startDate: r.start_date ? toIso(r.start_date) : null,
    endDate: r.end_date ? toIso(r.end_date) : null,
    technologies: r.technologies ?? [],
    achievements: r.achievements ?? [],
    projectUrl: r.project_url,
    images: r.images ?? [],
    projectId: r.project_id,
    autoGenerated: r.auto_generated,
    displayOrder: r.display_order,
    isVisible: r.is_visible,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapJobApplication(r: Record<string, unknown>) {
  return {
    id: r.id,
    userId: r.user_id,
    resumeId: r.resume_id,
    jobTitle: r.job_title,
    company: r.company,
    location: r.location,
    jobUrl: r.job_url,
    source: r.source,
    jobId: r.job_id,
    status: r.status,
    appliedDate: r.applied_date ? toIso(r.applied_date) : null,
    responseDate: r.response_date ? toIso(r.response_date) : null,
    interviewDate: r.interview_date ? toIso(r.interview_date) : null,
    offerDate: r.offer_date ? toIso(r.offer_date) : null,
    coverLetter: r.cover_letter,
    notes: r.notes,
    salary: r.salary,
    followUpDate: r.follow_up_date ? toIso(r.follow_up_date) : null,
    reminderSent: r.reminder_sent,
    priority: r.priority,
    tags: r.tags ?? [],
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapTemplate(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    atsScore: r.ats_score,
    isAtsOptimized: r.is_ats_optimized,
    layout: r.layout,
    sections: r.sections ?? [],
    previewImage: r.preview_image,
    colorSchemes: r.color_schemes ?? [],
    fonts: r.fonts ?? {},
    isPremium: r.is_premium,
    usageCount: r.usage_count,
    rating: r.rating,
    isActive: r.is_active,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function slugify(input: string): string {
  return (input || "cv")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "cv";
}

async function uniqueSlug(
  pool: Pool,
  userId: string,
  base: string,
): Promise<string> {
  let slug = slugify(base);
  let n = 1;
  while (true) {
    const r = await pool.query(
      `SELECT 1 FROM resumes WHERE user_id = $1 AND slug = $2 LIMIT 1`,
      [userId, slug],
    );
    if (r.rowCount === 0) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
    if (n > 999) return `${slug}-${Date.now()}`;
  }
}

// ── Full resume context (for AI + export) ───────────────────────────

interface FullResume {
  resume: ResumeRow;
  experiences: ReturnType<typeof mapExperience>[];
  education: ReturnType<typeof mapEducation>[];
  skills: ReturnType<typeof mapSkill>[];
  certifications: ReturnType<typeof mapCertification>[];
  projects: ReturnType<typeof mapProject>[];
  languages: ReturnType<typeof mapLanguage>[];
}

async function loadFullResume(
  pool: Pool,
  resumeId: string,
  userId: string,
): Promise<FullResume | null> {
  const r = await pool.query(
    `SELECT * FROM resumes WHERE id = $1 AND user_id = $2`,
    [resumeId, userId],
  );
  if (!r.rowCount) return null;
  const [exp, edu, sk, cert, proj, lang] = await Promise.all([
    pool.query(
      `SELECT * FROM resume_experiences WHERE resume_id = $1 ORDER BY display_order, start_date DESC NULLS LAST`,
      [resumeId],
    ),
    pool.query(
      `SELECT * FROM resume_education WHERE resume_id = $1 ORDER BY display_order, start_date DESC NULLS LAST`,
      [resumeId],
    ),
    pool.query(
      `SELECT * FROM resume_skills WHERE resume_id = $1 ORDER BY display_order, name`,
      [resumeId],
    ),
    pool.query(
      `SELECT * FROM resume_certifications WHERE resume_id = $1 ORDER BY display_order, issue_date DESC`,
      [resumeId],
    ),
    pool.query(
      `SELECT * FROM resume_projects WHERE resume_id = $1 ORDER BY display_order, start_date DESC NULLS LAST`,
      [resumeId],
    ),
    pool.query(
      `SELECT * FROM resume_languages WHERE resume_id = $1 ORDER BY display_order, name`,
      [resumeId],
    ),
  ]);
  return {
    resume: mapResume(r.rows[0]),
    experiences: exp.rows.map(mapExperience),
    education: edu.rows.map(mapEducation),
    skills: sk.rows.map(mapSkill),
    certifications: cert.rows.map(mapCertification),
    projects: proj.rows.map(mapProject),
    languages: lang.rows.map(mapLanguage),
  };
}

// ── AI Rate Limiting ────────────────────────────────────────────────
//
// Enkel in-memory bucket per bruker. Brukes på alle AI-endepunkter
// for å hindre at en enkelt bruker spammer Claude-API og påfører
// uventede kostnader.
//
// Begrensninger:
//   • 10 kall per 60 sekunder (sliding window)
//   • 100 kall per dag (UTC midnatts-reset)
//
// In-memory: nullstilles ved server-restart. OK for nå — kan flyttes
// til Postgres/Redis senere ved trafikkøkning. Lagrer ikke selve
// requestene, kun antall (cost-tracking gjøres separat via
// ai_usage_log-tabellen).

interface RateLimitState {
  minuteWindow: number[];   // timestamps i ms innenfor siste 60s
  dailyCount: number;
  dailyReset: number;       // ms timestamp for neste midnatts-reset (UTC)
}
const rateLimitBuckets = new Map<string, RateLimitState>();

const AI_RATE_LIMIT_PER_MINUTE = 10;
const AI_RATE_LIMIT_PER_DAY = 100;

function checkAiRateLimit(userId: string): { allowed: true } | { allowed: false; reason: string; retryAfterSec: number } {
  const now = Date.now();
  const utcMidnight = new Date();
  utcMidnight.setUTCHours(24, 0, 0, 0);

  let state = rateLimitBuckets.get(userId);
  if (!state) {
    state = { minuteWindow: [], dailyCount: 0, dailyReset: utcMidnight.getTime() };
    rateLimitBuckets.set(userId, state);
  }
  // Dagens reset
  if (now >= state.dailyReset) {
    state.dailyCount = 0;
    state.dailyReset = utcMidnight.getTime();
  }
  // Sliding window (60 sek)
  state.minuteWindow = state.minuteWindow.filter((t) => now - t < 60_000);

  if (state.dailyCount >= AI_RATE_LIMIT_PER_DAY) {
    return {
      allowed: false,
      reason: `Daglig grense (${AI_RATE_LIMIT_PER_DAY} AI-kall) nådd. Prøv igjen i morgen.`,
      retryAfterSec: Math.ceil((state.dailyReset - now) / 1000),
    };
  }
  if (state.minuteWindow.length >= AI_RATE_LIMIT_PER_MINUTE) {
    const oldest = state.minuteWindow[0];
    return {
      allowed: false,
      reason: `For mange AI-kall på kort tid. Maks ${AI_RATE_LIMIT_PER_MINUTE} per minutt.`,
      retryAfterSec: Math.ceil((60_000 - (now - oldest)) / 1000),
    };
  }
  // Innenfor begge limit — registrer kallet
  state.minuteWindow.push(now);
  state.dailyCount += 1;
  return { allowed: true };
}

/** Send 429 hvis limit overskridet. Returner true hvis kall kan fortsette. */
function enforceAiRateLimit(
  userId: string,
  res: express.Response,
): boolean {
  const check = checkAiRateLimit(userId);
  if (check.allowed) return true;
  res.setHeader("Retry-After", String(check.retryAfterSec));
  res.status(429).json({ error: check.reason, retryAfterSec: check.retryAfterSec });
  return false;
}


// ── Claude wrapper ──────────────────────────────────────────────────

interface ClaudeResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callClaude(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  model?: string;
}): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY er ikke satt på serveren");
  }
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: opts.model ?? "claude-sonnet-4-5-20250929",
    max_tokens: opts.maxTokens ?? 2000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  type ContentBlock = { type: string; text?: string };
  const text = (response.content as ContentBlock[])
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

function tryParseJson<T = unknown>(text: string): T | null {
  // Claude returnerer iblant JSON pakket i ```json ... ``` fences.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Forsøk å finne første { ... } eller [ ... ]
    const match =
      cleaned.match(/\{[\s\S]*\}/) ?? cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

function summarizeResumeForAI(full: FullResume): string {
  // PII-filter — sender ALDRI rå personal_info-JSONB til AI.
  // Allowlist-felt + scrubbing av fri-tekst + by-bare extraction.
  const r = full.resume;
  const p = (r.personalInfo as Record<string, string | undefined>) ?? {};

  const lines = [
    `Tittel/Rolle: ${scrubPII(p.professionalTitle ?? r.targetJobTitle ?? r.title ?? "")}`,
    p.summary ? `Sammendrag: ${scrubPII(p.summary.slice(0, 400))}` : "",
    p.location ? `By: ${extractCityOnly(p.location)}` : "",
    r.targetIndustry ? `Målbransje: ${r.targetIndustry}` : "",
  ].filter(Boolean);

  if (full.experiences.length) {
    lines.push("\nERFARING:");
    full.experiences.forEach((e) => {
      const startStr = (e.startDate as string)?.slice(0, 7) ?? "?";
      const endStr = e.isCurrent ? "nå" : ((e.endDate as string)?.slice(0, 7) ?? "");
      lines.push(
        `- ${scrubPII(e.jobTitle ?? "")} hos ${scrubPII(e.company ?? "")} (${startStr} → ${endStr})`,
      );
      if (e.description) lines.push(`  ${scrubPII(typeof e.description === "string" ? e.description.slice(0, 300) : e.description)}`);
      const ach = (e.achievements as string[]) ?? [];
      ach.slice(0, 5).forEach((a) => lines.push(`  • ${scrubPII(a)}`));
    });
  }
  if (full.education.length) {
    lines.push("\nUTDANNING:");
    full.education.forEach((e) =>
      lines.push(
        `- ${scrubPII(e.degree ?? "")}${e.fieldOfStudy ? ` i ${scrubPII(e.fieldOfStudy)}` : ""}, ${scrubPII(e.institution ?? "")}`,
      ),
    );
  }
  if (full.skills.length) {
    lines.push("\nFERDIGHETER:");
    lines.push(
      full.skills.map((s) => `${scrubPII(s.name ?? "")} (${s.proficiencyLevel}%)`).join(", "),
    );
  }
  if (full.certifications.length) {
    lines.push("\nSERTIFISERINGER:");
    full.certifications.forEach((c) =>
      lines.push(`- ${scrubPII(c.name ?? "")} — ${scrubPII(c.issuer ?? "")}`),
    );
  }
  if (full.languages.length) {
    lines.push("\nSPRÅK:");
    lines.push(
      full.languages
        .map((l) => `${l.name}${l.levelLabel ? ` (${l.levelLabel})` : ""}`)
        .join(", "),
    );
  }
  if (full.projects.length) {
    lines.push("\nPROSJEKTER:");
    full.projects.forEach((p_) => {
      lines.push(`- ${scrubPII(p_.title ?? "")}${p_.role ? ` (${scrubPII(p_.role)})` : ""}`);
      if (p_.description) lines.push(`  ${scrubPII(typeof p_.description === "string" ? p_.description.slice(0, 200) : p_.description)}`);
    });
  }
  return lines.join("\n");
}

// ── Exporters ───────────────────────────────────────────────────────

// Splitter experiences i to grupper: vanlige stillinger og praksis.
// PDF/DOCX/TXT bruker dette for å rendre "Praksisplasser" som egen
// seksjon — matcher konvensjonen i norske CV-er.
function splitExperiences(full: FullResume) {
  const regular: typeof full.experiences = [];
  const internships: typeof full.experiences = [];
  full.experiences.forEach((e) => {
    if (e.employmentType === "internship") internships.push(e);
    else regular.push(e);
  });
  return { regular, internships };
}

// Returnerer bullet-linjer for én erfaring. Hvis experienceGroups er
// satt brukes den strukturerte gruppe-formen ("Produsent:\n  • ..."),
// ellers faller vi tilbake på flat achievements-array.
function experienceBullets(
  e: ReturnType<typeof mapExperience>,
): Array<{ category?: string; lines: string[] }> {
  const groups = e.experienceGroups as
    | Array<{ category?: string; items?: string[] }>
    | null;
  if (groups && groups.length > 0) {
    return groups
      .filter((g) => Array.isArray(g.items) && g.items.length > 0)
      .map((g) => ({
        category: g.category,
        lines: (g.items ?? []).filter((l) => typeof l === "string" && l.trim()),
      }));
  }
  const ach = (e.achievements as string[]) ?? [];
  return ach.length ? [{ lines: ach }] : [];
}

function buildPlainText(full: FullResume): string {
  const r = full.resume;
  const p = (r.personalInfo as Record<string, string | undefined>) ?? {};
  const out: string[] = [];
  out.push((p.fullName ?? r.title ?? "").toUpperCase());
  if (p.professionalTitle) out.push(p.professionalTitle);
  const contact = [p.email, p.phone, p.location, p.website, p.linkedin]
    .filter(Boolean)
    .join(" | ");
  if (contact) out.push(contact);
  out.push("");
  if (p.summary) {
    out.push("SAMMENDRAG");
    out.push(p.summary);
    out.push("");
  }
  const { regular, internships } = splitExperiences(full);

  const renderExperience = (
    e: ReturnType<typeof mapExperience>,
  ) => {
    const start = (e.startDate as string)?.slice(0, 7) ?? "";
    const end = e.isCurrent ? "nå" : (e.endDate as string)?.slice(0, 7) ?? "";
    out.push(`${e.jobTitle} — ${e.company}  (${start} – ${end})`);
    if (e.location) out.push(e.location as string);
    if (e.description) out.push(e.description as string);
    experienceBullets(e).forEach((group) => {
      if (group.category) out.push(`${group.category}:`);
      group.lines.forEach((l) => out.push(`  • ${l}`));
    });
    out.push("");
  };

  if (regular.length) {
    out.push("ARBEIDSHISTORIKK");
    regular.forEach(renderExperience);
  }
  if (full.education.length) {
    out.push("UTDANNING");
    full.education.forEach((e) => {
      const start = (e.startDate as string)?.slice(0, 7) ?? "";
      const end = e.isCurrent ? "nå" : (e.endDate as string)?.slice(0, 7) ?? "";
      out.push(
        `${e.degree}${e.fieldOfStudy ? ` i ${e.fieldOfStudy}` : ""} — ${e.institution}  (${start} – ${end})`,
      );
      if (e.grade) out.push(`Karakter: ${e.grade}`);
      if (e.description) out.push(e.description as string);
      ((e.achievements as string[]) ?? []).forEach((a) => out.push(`  • ${a}`));
    });
    out.push("");
  }
  if (full.skills.length) {
    out.push("FERDIGHETER");
    out.push(full.skills.map((s) => s.name).join(", "));
    out.push("");
  }
  if (full.languages.length) {
    out.push("SPRÅK");
    full.languages.forEach((l) => {
      out.push(`${l.name}${l.levelLabel ? ` — ${l.levelLabel}` : ""}`);
    });
    out.push("");
  }
  if (full.certifications.length) {
    out.push("SERTIFISERINGER");
    full.certifications.forEach((c) =>
      out.push(`${c.name} — ${c.issuer}  (${(c.issueDate as string)?.slice(0, 7)})`),
    );
    out.push("");
  }
  if (internships.length) {
    out.push("PRAKSISPLASSER");
    internships.forEach(renderExperience);
  }
  if (full.projects.length) {
    out.push("PROSJEKTER");
    full.projects.forEach((pr) => {
      out.push(`${pr.title}${pr.role ? ` — ${pr.role}` : ""}`);
      if (pr.description) out.push(pr.description as string);
    });
    out.push("");
  }
  return out.join("\n");
}

function buildPdf(full: FullResume): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 56 });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const r = full.resume;
      const p = (r.personalInfo as Record<string, string | undefined>) ?? {};

      doc.font("Helvetica-Bold").fontSize(22).text(p.fullName ?? r.title);
      if (p.professionalTitle) {
        doc.moveDown(0.2).font("Helvetica").fontSize(12).fillColor("#555").text(p.professionalTitle);
      }
      const contact = [p.email, p.phone, p.location, p.website, p.linkedin]
        .filter(Boolean)
        .join("  •  ");
      if (contact) {
        doc.moveDown(0.3).fontSize(9).fillColor("#777").text(contact);
      }
      doc.moveDown(0.6).fillColor("#000");

      const section = (title: string) => {
        doc.moveDown(0.6);
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#1565c0").text(title.toUpperCase());
        doc
          .moveTo(doc.x, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor("#1565c0")
          .lineWidth(0.5)
          .stroke();
        doc.moveDown(0.4).font("Helvetica").fontSize(10).fillColor("#000");
      };

      if (p.summary) {
        section("Sammendrag");
        doc.text(p.summary, { align: "left" });
      }

      const { regular, internships } = splitExperiences(full);
      const renderExperiencePdf = (
        e: ReturnType<typeof mapExperience>,
      ) => {
        const start = (e.startDate as string)?.slice(0, 7) ?? "";
        const end = e.isCurrent
          ? "nå"
          : (e.endDate as string)?.slice(0, 7) ?? "";
        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .text(`${e.jobTitle} — ${e.company}`, { continued: true })
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#666")
          .text(`   ${start} – ${end}`);
        doc.fillColor("#000");
        if (e.location)
          doc.font("Helvetica-Oblique").fontSize(9).fillColor("#666").text(e.location as string);
        if (e.description)
          doc.fillColor("#000").font("Helvetica").fontSize(10).text(e.description as string);
        experienceBullets(e).forEach((group) => {
          if (group.category) {
            doc
              .moveDown(0.15)
              .font("Helvetica-Bold")
              .fontSize(10)
              .fillColor("#000")
              .text(`${group.category}:`);
          }
          group.lines.forEach((line) =>
            doc.font("Helvetica").fontSize(10).fillColor("#000").text(`  •  ${line}`),
          );
        });
        doc.moveDown(0.3);
      };

      if (regular.length) {
        section("Arbeidshistorikk");
        regular.forEach(renderExperiencePdf);
      }

      if (full.education.length) {
        section("Utdanning");
        full.education.forEach((e) => {
          const start = (e.startDate as string)?.slice(0, 7) ?? "";
          const end = e.isCurrent
            ? "nå"
            : (e.endDate as string)?.slice(0, 7) ?? "";
          doc
            .font("Helvetica-Bold")
            .fontSize(11)
            .text(
              `${e.degree}${e.fieldOfStudy ? ` i ${e.fieldOfStudy}` : ""} — ${e.institution}`,
              { continued: true },
            )
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#666")
            .text(`   ${start} – ${end}`);
          doc.fillColor("#000");
          if (e.grade) doc.font("Helvetica").fontSize(10).text(`Karakter: ${e.grade}`);
          doc.moveDown(0.2);
        });
      }

      if (full.skills.length) {
        section("Ferdigheter");
        doc.text(full.skills.map((s) => s.name).join(" · "));
      }

      if (full.languages.length) {
        section("Språk");
        full.languages.forEach((l) => {
          doc.font("Helvetica-Bold").fontSize(10).text(l.name as string, {
            continued: !!l.levelLabel,
          });
          if (l.levelLabel) {
            doc
              .font("Helvetica")
              .fontSize(10)
              .fillColor("#666")
              .text(` — ${l.levelLabel}`);
            doc.fillColor("#000");
          }
        });
      }

      if (full.certifications.length) {
        section("Sertifiseringer");
        full.certifications.forEach((c) => {
          doc.font("Helvetica-Bold").fontSize(10).text(c.name as string, {
            continued: true,
          });
          doc
            .font("Helvetica")
            .fontSize(10)
            .text(` — ${c.issuer}  (${(c.issueDate as string)?.slice(0, 7)})`);
        });
      }

      if (internships.length) {
        section("Praksisplasser");
        internships.forEach(renderExperiencePdf);
      }

      if (full.projects.length) {
        section("Prosjekter");
        full.projects.forEach((pr) => {
          doc
            .font("Helvetica-Bold")
            .fontSize(10)
            .text(
              `${pr.title}${pr.role ? ` — ${pr.role}` : ""}`,
            );
          if (pr.description) doc.font("Helvetica").fontSize(10).text(pr.description as string);
          doc.moveDown(0.2);
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function buildDocx(full: FullResume): Promise<Buffer> {
  const r = full.resume;
  const p = (r.personalInfo as Record<string, string | undefined>) ?? {};
  const children: Paragraph[] = [];
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: p.fullName ?? r.title, bold: true, size: 36 })],
    }),
  );
  if (p.professionalTitle)
    children.push(
      new Paragraph({
        children: [new TextRun({ text: p.professionalTitle, italics: true, size: 22 })],
      }),
    );
  const contact = [p.email, p.phone, p.location, p.website, p.linkedin]
    .filter(Boolean)
    .join(" | ");
  if (contact)
    children.push(new Paragraph({ children: [new TextRun({ text: contact, size: 18 })] }));

  const heading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 60 },
      children: [new TextRun({ text, bold: true })],
    });

  if (p.summary) {
    children.push(heading("Sammendrag"));
    children.push(new Paragraph({ children: [new TextRun(p.summary)] }));
  }

  const { regular, internships } = splitExperiences(full);
  const renderExperienceDocx = (
    e: ReturnType<typeof mapExperience>,
  ) => {
    const start = (e.startDate as string)?.slice(0, 7) ?? "";
    const end = e.isCurrent ? "nå" : (e.endDate as string)?.slice(0, 7) ?? "";
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${e.jobTitle} — ${e.company}`, bold: true }),
          new TextRun({ text: `    ${start} – ${end}`, color: "888888" }),
        ],
      }),
    );
    if (e.description)
      children.push(new Paragraph({ children: [new TextRun(e.description as string)] }));
    experienceBullets(e).forEach((group) => {
      if (group.category) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 20 },
            children: [new TextRun({ text: `${group.category}:`, bold: true })],
          }),
        );
      }
      group.lines.forEach((l) =>
        children.push(new Paragraph({ children: [new TextRun(`• ${l}`)] })),
      );
    });
  };

  if (regular.length) {
    children.push(heading("Arbeidshistorikk"));
    regular.forEach(renderExperienceDocx);
  }

  if (full.education.length) {
    children.push(heading("Utdanning"));
    full.education.forEach((e) => {
      const start = (e.startDate as string)?.slice(0, 7) ?? "";
      const end = e.isCurrent ? "nå" : (e.endDate as string)?.slice(0, 7) ?? "";
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${e.degree}${e.fieldOfStudy ? ` i ${e.fieldOfStudy}` : ""} — ${e.institution}`,
              bold: true,
            }),
            new TextRun({ text: `    ${start} – ${end}`, color: "888888" }),
          ],
        }),
      );
    });
  }

  if (full.skills.length) {
    children.push(heading("Ferdigheter"));
    children.push(
      new Paragraph({
        children: [new TextRun(full.skills.map((s) => s.name).join(" · "))],
      }),
    );
  }

  if (full.languages.length) {
    children.push(heading("Språk"));
    full.languages.forEach((l) =>
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: l.name as string, bold: true }),
            ...(l.levelLabel
              ? [new TextRun({ text: ` — ${l.levelLabel}`, color: "666666" })]
              : []),
          ],
        }),
      ),
    );
  }

  if (full.certifications.length) {
    children.push(heading("Sertifiseringer"));
    full.certifications.forEach((c) =>
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: c.name as string, bold: true }),
            new TextRun(` — ${c.issuer}  (${(c.issueDate as string)?.slice(0, 7)})`),
          ],
        }),
      ),
    );
  }

  if (internships.length) {
    children.push(heading("Praksisplasser"));
    internships.forEach(renderExperienceDocx);
  }

  if (full.projects.length) {
    children.push(heading("Prosjekter"));
    full.projects.forEach((pr) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${pr.title}${pr.role ? ` — ${pr.role}` : ""}`,
              bold: true,
            }),
          ],
        }),
      );
      if (pr.description)
        children.push(new Paragraph({ children: [new TextRun(pr.description as string)] }));
    });
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

// ── Mappable mappings for project_type → resume-felter ──────────────

const PROJECT_TYPE_DEFAULTS: Record<
  string,
  { jobTitle: string; skills: string[]; technologies: string[] }
> = {
  wedding: {
    jobTitle: "Bryllupsfotograf",
    skills: ["Bryllupsfotografering", "Portrettfotografering", "Bildebehandling"],
    technologies: ["Lightroom", "Photoshop", "Capture One"],
  },
  portrait: {
    jobTitle: "Portrettfotograf",
    skills: ["Portrettfotografering", "Studiobelysning", "Bildebehandling"],
    technologies: ["Lightroom", "Photoshop"],
  },
  event: {
    jobTitle: "Eventfotograf",
    skills: ["Eventfotografering", "Reportasje", "Hurtig leveranse"],
    technologies: ["Lightroom", "Photoshop"],
  },
  video: {
    jobTitle: "Videograf",
    skills: ["Filming", "Videoredigering", "Fargegradering"],
    technologies: ["Premiere Pro", "DaVinci Resolve", "After Effects"],
  },
  music: {
    jobTitle: "Musikkprodusent",
    skills: ["Musikkproduksjon", "Miksing", "Mastering"],
    technologies: ["Logic Pro", "Pro Tools", "Ableton Live"],
  },
};

function defaultsForProjectType(projectType?: string | null) {
  if (!projectType) return null;
  return PROJECT_TYPE_DEFAULTS[projectType.toLowerCase()] ?? null;
}

// ── Setup ───────────────────────────────────────────────────────────

export function setupResumeRoutes(deps: ResumeRoutesDeps): void {
  const { app, pool, getActiveSessionFromRequest } = deps;
  const requireSession = makeAuth(getActiveSessionFromRequest);

  // ── Templates (public) ────────────────────────────────────────────
  app.get("/api/resume-templates", async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM resume_templates WHERE is_active = TRUE ORDER BY ats_score DESC, name`,
      );
      res.json(r.rows.map(mapTemplate));
    } catch (err) {
      console.error("resume-templates list error", err);
      res.status(500).json({ error: "Kunne ikke hente maler" });
    }
  });

  // ── Resumes CRUD ──────────────────────────────────────────────────
  app.get("/api/resumes", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const r = await pool.query(
        `SELECT * FROM resumes WHERE user_id = $1 ORDER BY updated_at DESC`,
        [session.userId],
      );
      res.json(r.rows.map(mapResume));
    } catch (err) {
      console.error("resumes list error", err);
      res.status(500).json({ error: "Kunne ikke hente CV-er" });
    }
  });

  app.post("/api/resumes", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = asString(body.title, "Ny CV") ?? "Ny CV";
    const slug = await uniqueSlug(pool, session.userId, title);
    const personalInfo =
      body.personalInfo && typeof body.personalInfo === "object"
        ? JSON.stringify(body.personalInfo)
        : "{}";
    try {
      const r = await pool.query(
        `INSERT INTO resumes (
           user_id, title, slug, personal_info, template_id, color_scheme,
           custom_colors, target_job_title, target_industry, status, language
         ) VALUES (
           $1, $2, $3, $4::jsonb, $5, $6,
           $7::jsonb, $8, $9, $10, $11
         ) RETURNING *`,
        [
          session.userId,
          title,
          slug,
          personalInfo,
          asString(body.templateId, "modern-ats"),
          asString(body.colorScheme, "professional-blue"),
          asJsonbObject(body.customColors),
          asString(body.targetJobTitle),
          asString(body.targetIndustry),
          asString(body.status, "draft"),
          asString(body.language, "no"),
        ],
      );
      res.status(201).json(mapResume(r.rows[0]));
    } catch (err) {
      console.error("resumes create error", err);
      res.status(500).json({ error: "Kunne ikke opprette CV" });
    }
  });

  app.get("/api/resumes/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const full = await loadFullResume(pool, req.params.id, session.userId);
      if (!full) {
        res.status(404).json({ error: "CV ikke funnet" });
        return;
      }
      res.json(full);
    } catch (err) {
      console.error("resumes get error", err);
      res.status(500).json({ error: "Kunne ikke hente CV" });
    }
  });

  const updateResume = async (req: express.Request, res: express.Response) => {
    const session = requireSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [req.params.id, session.userId];
    const push = (sqlExpr: string, value: unknown) => {
      params.push(value);
      sets.push(`${sqlExpr} = $${params.length}`);
    };
    if ("title" in body) push("title", asString(body.title));
    if ("personalInfo" in body)
      push(
        "personal_info",
        body.personalInfo && typeof body.personalInfo === "object"
          ? JSON.stringify(body.personalInfo)
          : "{}",
      );
    if ("templateId" in body) push("template_id", asString(body.templateId));
    if ("colorScheme" in body) push("color_scheme", asString(body.colorScheme));
    if ("customColors" in body)
      push("custom_colors", asJsonbObject(body.customColors));
    if ("targetJobTitle" in body)
      push("target_job_title", asString(body.targetJobTitle));
    if ("targetIndustry" in body)
      push("target_industry", asString(body.targetIndustry));
    if ("status" in body) push("status", asString(body.status, "draft"));
    if ("isPublic" in body) push("is_public", readBoolean(body.isPublic));
    if ("keywords" in body && Array.isArray(body.keywords))
      push("keywords", body.keywords);
    if ("language" in body) push("language", asString(body.language, "no"));
    if (sets.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    sets.push("updated_at = NOW()");
    sets.push("version = version + 1");
    try {
      const cast = (s: string) =>
        s.startsWith("personal_info") || s.startsWith("custom_colors")
          ? s.replace(" = $", "::text = $").replace(/= \$(\d+)/, "= $$$1::jsonb")
          : s;
      const setsSql = sets
        .map((s) =>
          s.startsWith("personal_info") || s.startsWith("custom_colors")
            ? s.replace(/= \$(\d+)$/, "= $$$1::jsonb")
            : s,
        )
        .join(", ");
      void cast;
      const r = await pool.query(
        `UPDATE resumes SET ${setsSql} WHERE id = $1 AND user_id = $2 RETURNING *`,
        params,
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "CV ikke funnet" });
        return;
      }
      res.json(mapResume(r.rows[0]));
    } catch (err) {
      console.error("resumes update error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere CV" });
    }
  };
  app.put("/api/resumes/:id", updateResume);
  app.patch("/api/resumes/:id", updateResume);

  app.delete("/api/resumes/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const r = await pool.query(
        `DELETE FROM resumes WHERE id = $1 AND user_id = $2 RETURNING id`,
        [req.params.id, session.userId],
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "CV ikke funnet" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("resumes delete error", err);
      res.status(500).json({ error: "Kunne ikke slette CV" });
    }
  });

  // ── Experiences ───────────────────────────────────────────────────
  app.get("/api/resumes/:id/experiences", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!(await ensureResumeOwned(pool, req.params.id, session.userId))) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const r = await pool.query(
      `SELECT * FROM resume_experiences WHERE resume_id = $1 ORDER BY display_order, start_date DESC NULLS LAST`,
      [req.params.id],
    );
    res.json(r.rows.map(mapExperience));
  });

  app.post("/api/resumes/:id/experiences", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!(await ensureResumeOwned(pool, req.params.id, session.userId))) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!asString(body.jobTitle) || !asString(body.company)) {
      res
        .status(400)
        .json({ error: "jobTitle og company er påkrevd" });
      return;
    }
    try {
      const groups = Array.isArray(body.experienceGroups)
        ? JSON.stringify(body.experienceGroups)
        : null;
      const r = await pool.query(
        `INSERT INTO resume_experiences (
           resume_id, user_id, job_title, company, location, employment_type,
           start_date, end_date, is_current, description, achievements, skills,
           project_id, auto_generated, display_order, is_visible,
           experience_groups
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
           $17::jsonb
         ) RETURNING *`,
        [
          req.params.id,
          session.userId,
          asString(body.jobTitle),
          asString(body.company),
          asString(body.location),
          asString(body.employmentType),
          readOptionalIsoDate(body.startDate) ?? new Date().toISOString(),
          readOptionalIsoDate(body.endDate),
          readBoolean(body.isCurrent) ?? false,
          asString(body.description),
          Array.isArray(body.achievements) ? body.achievements : [],
          Array.isArray(body.skills) ? body.skills : [],
          asString(body.projectId),
          readBoolean(body.autoGenerated) ?? false,
          asNumberOrNull(body.displayOrder) ?? 0,
          readBoolean(body.isVisible) ?? true,
          groups,
        ],
      );
      res.status(201).json(mapExperience(r.rows[0]));
    } catch (err) {
      console.error("experiences create error", err);
      res.status(500).json({ error: "Kunne ikke legge til erfaring" });
    }
  });

  const patchExperience = async (
    req: express.Request,
    res: express.Response,
  ) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!(await ensureResumeOwned(pool, req.params.id, session.userId))) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [req.params.eid, req.params.id];
    const push = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if ("jobTitle" in body) push("job_title", asString(body.jobTitle));
    if ("company" in body) push("company", asString(body.company));
    if ("location" in body) push("location", asString(body.location));
    if ("employmentType" in body)
      push("employment_type", asString(body.employmentType));
    if ("startDate" in body)
      push("start_date", readOptionalIsoDate(body.startDate));
    if ("endDate" in body) push("end_date", readOptionalIsoDate(body.endDate));
    if ("isCurrent" in body) push("is_current", readBoolean(body.isCurrent));
    if ("description" in body) push("description", asString(body.description));
    if ("achievements" in body && Array.isArray(body.achievements))
      push("achievements", body.achievements);
    if ("skills" in body && Array.isArray(body.skills))
      push("skills", body.skills);
    if ("experienceGroups" in body) {
      const groups = Array.isArray(body.experienceGroups)
        ? JSON.stringify(body.experienceGroups)
        : null;
      params.push(groups);
      sets.push(`experience_groups = $${params.length}::jsonb`);
    }
    if ("displayOrder" in body)
      push("display_order", asNumberOrNull(body.displayOrder));
    if ("isVisible" in body) push("is_visible", readBoolean(body.isVisible));
    if (sets.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    sets.push("updated_at = NOW()");
    const r = await pool.query(
      `UPDATE resume_experiences SET ${sets.join(", ")} WHERE id = $1 AND resume_id = $2 RETURNING *`,
      params,
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Erfaring ikke funnet" });
      return;
    }
    res.json(mapExperience(r.rows[0]));
  };
  app.patch("/api/resumes/:id/experiences/:eid", patchExperience);
  app.put("/api/resumes/:id/experiences/:eid", patchExperience);

  app.delete("/api/resumes/:id/experiences/:eid", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query(
      `DELETE FROM resume_experiences
        WHERE id = $1 AND resume_id = $2 AND user_id = $3
        RETURNING id`,
      [req.params.eid, req.params.id, session.userId],
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Erfaring ikke funnet" });
      return;
    }
    res.json({ ok: true });
  });

  // ── Generic sub-resource factory ─────────────────────────────────
  type SubCfg = {
    routePath: string;
    paramName: string;
    table: string;
    requiredFields: string[];
    columns: Array<{
      bodyKey: string;
      column: string;
      kind:
        | "string"
        | "number"
        | "boolean"
        | "date"
        | "stringArray";
    }>;
    mapper: (r: Record<string, unknown>) => unknown;
  };

  const buildSubResource = (cfg: SubCfg) => {
    const fullPath = `/api/resumes/:id/${cfg.routePath}`;
    const itemPath = `${fullPath}/:${cfg.paramName}`;

    const buildValue = (
      col: SubCfg["columns"][number],
      value: unknown,
    ): unknown => {
      switch (col.kind) {
        case "string":
          return asString(value);
        case "number":
          return asNumberOrNull(value);
        case "boolean":
          return readBoolean(value);
        case "date":
          return readOptionalIsoDate(value);
        case "stringArray":
          return Array.isArray(value) ? value : [];
      }
    };

    app.get(fullPath, async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      if (!(await ensureResumeOwned(pool, req.params.id, session.userId))) {
        res.status(404).json({ error: "CV ikke funnet" });
        return;
      }
      const r = await pool.query(
        `SELECT * FROM ${cfg.table} WHERE resume_id = $1 ORDER BY display_order, created_at`,
        [req.params.id],
      );
      res.json(r.rows.map(cfg.mapper));
    });

    app.post(fullPath, async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      if (!(await ensureResumeOwned(pool, req.params.id, session.userId))) {
        res.status(404).json({ error: "CV ikke funnet" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      for (const required of cfg.requiredFields) {
        if (!asString(body[required])) {
          res
            .status(400)
            .json({ error: `${required} er påkrevd` });
          return;
        }
      }
      const cols = ["resume_id", "user_id", ...cfg.columns.map((c) => c.column)];
      const values: unknown[] = [
        req.params.id,
        session.userId,
        ...cfg.columns.map((c) => buildValue(c, body[c.bodyKey])),
      ];
      const placeholders = values.map((_v, i) => `$${i + 1}`).join(", ");
      try {
        const r = await pool.query(
          `INSERT INTO ${cfg.table} (${cols.join(", ")})
           VALUES (${placeholders}) RETURNING *`,
          values,
        );
        res.status(201).json(cfg.mapper(r.rows[0]));
      } catch (err) {
        console.error(`${cfg.table} create error`, err);
        res.status(500).json({ error: "Kunne ikke opprette" });
      }
    });

    const patcher = async (req: express.Request, res: express.Response) => {
      const session = requireSession(req, res);
      if (!session) return;
      if (!(await ensureResumeOwned(pool, req.params.id, session.userId))) {
        res.status(404).json({ error: "CV ikke funnet" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const sets: string[] = [];
      const params: unknown[] = [
        req.params[cfg.paramName],
        req.params.id,
      ];
      for (const c of cfg.columns) {
        if (c.bodyKey in body) {
          params.push(buildValue(c, body[c.bodyKey]));
          sets.push(`${c.column} = $${params.length}`);
        }
      }
      if (sets.length === 0) {
        res.status(400).json({ error: "Ingen felter å oppdatere" });
        return;
      }
      sets.push("updated_at = NOW()");
      const r = await pool.query(
        `UPDATE ${cfg.table} SET ${sets.join(", ")}
          WHERE id = $1 AND resume_id = $2 RETURNING *`,
        params,
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "Ikke funnet" });
        return;
      }
      res.json(cfg.mapper(r.rows[0]));
    };
    app.patch(itemPath, patcher);
    app.put(itemPath, patcher);

    app.delete(itemPath, async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      const r = await pool.query(
        `DELETE FROM ${cfg.table}
          WHERE id = $1 AND resume_id = $2 AND user_id = $3
          RETURNING id`,
        [req.params[cfg.paramName], req.params.id, session.userId],
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "Ikke funnet" });
        return;
      }
      res.json({ ok: true });
    });
  };

  buildSubResource({
    routePath: "education",
    paramName: "eid",
    table: "resume_education",
    requiredFields: ["degree", "institution"],
    columns: [
      { bodyKey: "degree", column: "degree", kind: "string" },
      { bodyKey: "fieldOfStudy", column: "field_of_study", kind: "string" },
      { bodyKey: "institution", column: "institution", kind: "string" },
      { bodyKey: "location", column: "location", kind: "string" },
      { bodyKey: "startDate", column: "start_date", kind: "date" },
      { bodyKey: "endDate", column: "end_date", kind: "date" },
      { bodyKey: "isCurrent", column: "is_current", kind: "boolean" },
      { bodyKey: "grade", column: "grade", kind: "string" },
      { bodyKey: "description", column: "description", kind: "string" },
      { bodyKey: "achievements", column: "achievements", kind: "stringArray" },
      { bodyKey: "displayOrder", column: "display_order", kind: "number" },
      { bodyKey: "isVisible", column: "is_visible", kind: "boolean" },
    ],
    mapper: mapEducation,
  });

  buildSubResource({
    routePath: "skills",
    paramName: "sid",
    table: "resume_skills",
    requiredFields: ["name"],
    columns: [
      { bodyKey: "name", column: "name", kind: "string" },
      { bodyKey: "category", column: "category", kind: "string" },
      {
        bodyKey: "proficiencyLevel",
        column: "proficiency_level",
        kind: "number",
      },
      {
        bodyKey: "yearsOfExperience",
        column: "years_of_experience",
        kind: "number",
      },
      { bodyKey: "displayOrder", column: "display_order", kind: "number" },
      { bodyKey: "isVisible", column: "is_visible", kind: "boolean" },
    ],
    mapper: mapSkill,
  });

  buildSubResource({
    routePath: "certifications",
    paramName: "cid",
    table: "resume_certifications",
    requiredFields: ["name", "issuer"],
    columns: [
      { bodyKey: "name", column: "name", kind: "string" },
      { bodyKey: "issuer", column: "issuer", kind: "string" },
      { bodyKey: "issueDate", column: "issue_date", kind: "date" },
      { bodyKey: "expiryDate", column: "expiry_date", kind: "date" },
      { bodyKey: "credentialId", column: "credential_id", kind: "string" },
      { bodyKey: "credentialUrl", column: "credential_url", kind: "string" },
      { bodyKey: "description", column: "description", kind: "string" },
      { bodyKey: "displayOrder", column: "display_order", kind: "number" },
      { bodyKey: "isVisible", column: "is_visible", kind: "boolean" },
    ],
    mapper: mapCertification,
  });

  buildSubResource({
    routePath: "languages",
    paramName: "lid",
    table: "resume_languages",
    requiredFields: ["name"],
    columns: [
      { bodyKey: "name", column: "name", kind: "string" },
      {
        bodyKey: "proficiencyLevel",
        column: "proficiency_level",
        kind: "number",
      },
      { bodyKey: "levelLabel", column: "level_label", kind: "string" },
      { bodyKey: "isNative", column: "is_native", kind: "boolean" },
      { bodyKey: "displayOrder", column: "display_order", kind: "number" },
      { bodyKey: "isVisible", column: "is_visible", kind: "boolean" },
    ],
    mapper: mapLanguage,
  });

  buildSubResource({
    routePath: "projects",
    paramName: "pid",
    table: "resume_projects",
    requiredFields: ["title"],
    columns: [
      { bodyKey: "title", column: "title", kind: "string" },
      { bodyKey: "description", column: "description", kind: "string" },
      { bodyKey: "role", column: "role", kind: "string" },
      { bodyKey: "startDate", column: "start_date", kind: "date" },
      { bodyKey: "endDate", column: "end_date", kind: "date" },
      { bodyKey: "technologies", column: "technologies", kind: "stringArray" },
      { bodyKey: "achievements", column: "achievements", kind: "stringArray" },
      { bodyKey: "projectUrl", column: "project_url", kind: "string" },
      { bodyKey: "images", column: "images", kind: "stringArray" },
      { bodyKey: "projectId", column: "project_id", kind: "string" },
      { bodyKey: "displayOrder", column: "display_order", kind: "number" },
      { bodyKey: "isVisible", column: "is_visible", kind: "boolean" },
    ],
    mapper: mapProject,
  });

  // ── Job applications ──────────────────────────────────────────────
  app.get("/api/job-applications", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const r = await pool.query(
        `SELECT * FROM job_applications WHERE user_id = $1 ORDER BY updated_at DESC`,
        [session.userId],
      );
      res.json(r.rows.map(mapJobApplication));
    } catch (err) {
      console.error("job-applications list error", err);
      res.status(500).json({ error: "Kunne ikke hente søknader" });
    }
  });

  app.post("/api/job-applications", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!asString(body.jobTitle) || !asString(body.company)) {
      res
        .status(400)
        .json({ error: "jobTitle og company er påkrevd" });
      return;
    }
    try {
      const r = await pool.query(
        `INSERT INTO job_applications (
           user_id, resume_id, job_title, company, location, job_url, source,
           job_id, status, applied_date, response_date, interview_date,
           offer_date, cover_letter, notes, salary, follow_up_date,
           priority, tags
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
           $16, $17, $18, $19
         ) RETURNING *`,
        [
          session.userId,
          asString(body.resumeId),
          asString(body.jobTitle),
          asString(body.company),
          asString(body.location),
          asString(body.jobUrl),
          asString(body.source),
          asString(body.jobId),
          asString(body.status, "saved"),
          readOptionalIsoDate(body.appliedDate),
          readOptionalIsoDate(body.responseDate),
          readOptionalIsoDate(body.interviewDate),
          readOptionalIsoDate(body.offerDate),
          asString(body.coverLetter),
          asString(body.notes),
          asString(body.salary),
          readOptionalIsoDate(body.followUpDate),
          asString(body.priority, "medium"),
          Array.isArray(body.tags) ? body.tags : [],
        ],
      );
      res.status(201).json(mapJobApplication(r.rows[0]));
    } catch (err) {
      console.error("job-applications create error", err);
      res.status(500).json({ error: "Kunne ikke opprette søknad" });
    }
  });

  const updateJobApplication = async (
    req: express.Request,
    res: express.Response,
  ) => {
    const session = requireSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [req.params.id, session.userId];
    const push = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if ("resumeId" in body) push("resume_id", asString(body.resumeId));
    if ("jobTitle" in body) push("job_title", asString(body.jobTitle));
    if ("company" in body) push("company", asString(body.company));
    if ("location" in body) push("location", asString(body.location));
    if ("jobUrl" in body) push("job_url", asString(body.jobUrl));
    if ("source" in body) push("source", asString(body.source));
    if ("status" in body) push("status", asString(body.status, "saved"));
    if ("appliedDate" in body)
      push("applied_date", readOptionalIsoDate(body.appliedDate));
    if ("responseDate" in body)
      push("response_date", readOptionalIsoDate(body.responseDate));
    if ("interviewDate" in body)
      push("interview_date", readOptionalIsoDate(body.interviewDate));
    if ("offerDate" in body)
      push("offer_date", readOptionalIsoDate(body.offerDate));
    if ("coverLetter" in body) push("cover_letter", asString(body.coverLetter));
    if ("notes" in body) push("notes", asString(body.notes));
    if ("salary" in body) push("salary", asString(body.salary));
    if ("followUpDate" in body)
      push("follow_up_date", readOptionalIsoDate(body.followUpDate));
    if ("priority" in body) push("priority", asString(body.priority, "medium"));
    if ("tags" in body && Array.isArray(body.tags)) push("tags", body.tags);
    if (sets.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    sets.push("updated_at = NOW()");
    const r = await pool.query(
      `UPDATE job_applications SET ${sets.join(", ")}
        WHERE id = $1 AND user_id = $2 RETURNING *`,
      params,
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Søknad ikke funnet" });
      return;
    }
    res.json(mapJobApplication(r.rows[0]));
  };
  app.put("/api/job-applications/:id", updateJobApplication);
  app.patch("/api/job-applications/:id", updateJobApplication);

  app.delete("/api/job-applications/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query(
      `DELETE FROM job_applications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, session.userId],
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Søknad ikke funnet" });
      return;
    }
    res.json({ ok: true });
  });

  // ── Import completed CreatorHub projects → resume ─────────────────
  // Trygg: hvis `projects`-tabellen ikke har forventede kolonner i et
  // miljø, fanger vi feilen og returnerer 0 importert i stedet for 500.
  // useAi=true (default): bruk Claude til å skrive prof. beskrivelse +
  // 3 achievements per importert prosjekt (#9 i AI-pakken).
  app.post(
    "/api/resumes/:id/import-completed-projects",
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      const resumeId = req.params.id;
      if (!(await ensureResumeOwned(pool, resumeId, session.userId))) {
        res.status(404).json({ error: "CV ikke funnet" });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const useAi = readBoolean(body.useAi) ?? true;

      // Hent prosjekter — bruk LEFT JOIN-tolerant query
      let projects: Array<Record<string, unknown>> = [];
      try {
        const result = await pool.query(
          `SELECT id, title, name, project_type, client_name, event_date,
                  location, status, created_at, updated_at
             FROM projects
            WHERE user_id = $1
              AND status IN ('completed','done','archived','delivered')
            ORDER BY COALESCE(event_date, created_at::date) DESC NULLS LAST
            LIMIT 50`,
          [session.userId],
        );
        projects = result.rows;
      } catch (err) {
        // Tabellen finnes ikke eller mangler kolonner i dette miljøet —
        // ikke fatal: returner tom import-rapport.
        console.warn(
          "import-completed-projects: projects-query feilet, returnerer 0",
          (err as Error).message,
        );
        res.json({ imported: 0, skipped: 0, total: 0, items: [] });
        return;
      }

      let imported = 0;
      let skipped = 0;
      const items: unknown[] = [];

      for (const p of projects) {
        const projectId = p.id as string;
        // Hopp over hvis vi allerede har importert denne
        const dup = await pool.query(
          `SELECT 1 FROM resume_experiences WHERE resume_id = $1 AND project_id = $2 LIMIT 1`,
          [resumeId, projectId],
        );
        if (dup.rowCount! > 0) {
          skipped += 1;
          continue;
        }
        const defaults = defaultsForProjectType(p.project_type as string);
        const title =
          (p.title as string) ?? (p.name as string) ?? "Prosjekt";

        let description: string | null = null;
        let achievements: string[] = [];
        if (useAi) {
          try {
            const ai = await callClaude({
              system:
                "Du er en CV-spesialist. Skriv på norsk, profesjonell og konkret tone. Returner JSON med to felter: 'description' (1-2 setninger, max 280 tegn) og 'achievements' (3 konkrete bullet-points i past tense). Ingen markdown.",
              user: [
                `Prosjekt: ${title}`,
                p.project_type ? `Type: ${p.project_type}` : "",
                p.client_name ? `Klient: ${p.client_name}` : "",
                p.location ? `Sted: ${p.location}` : "",
                p.event_date ? `Dato: ${p.event_date}` : "",
                "",
                'Eksempel: {"description":"...","achievements":["...","...","..."]}',
              ]
                .filter(Boolean)
                .join("\n"),
              maxTokens: 600,
            });
            const parsed = tryParseJson<{
              description?: string;
              achievements?: string[];
            }>(ai.text);
            if (parsed?.description) description = parsed.description;
            if (Array.isArray(parsed?.achievements))
              achievements = parsed!.achievements!.slice(0, 3);
          } catch (err) {
            // AI-feil skal ikke blokkere import — bruk fallback-beskrivelse
            console.warn(
              "import: Claude-feil, faller tilbake",
              (err as Error).message,
            );
          }
        }
        if (!description)
          description = `${title}${p.client_name ? ` for ${p.client_name}` : ""}.`;
        if (achievements.length === 0 && defaults) {
          achievements = [
            `Leverte ${defaults.jobTitle.toLowerCase()}-tjenester innen avtalt tidsramme.`,
            `Anvendte ${defaults.technologies.slice(0, 2).join(" og ")} for produksjon og leveranse.`,
            `Sikret fornøyd klient og kvalitetsleveranse.`,
          ];
        }

        const exp = await pool.query(
          `INSERT INTO resume_experiences (
             resume_id, user_id, job_title, company, location, employment_type,
             start_date, end_date, is_current, description, achievements, skills,
             project_id, auto_generated
           ) VALUES (
             $1, $2, $3, $4, $5, 'freelance',
             $6, $7, FALSE, $8, $9, $10, $11, TRUE
           ) RETURNING *`,
          [
            resumeId,
            session.userId,
            defaults?.jobTitle ?? "Freelancer",
            (p.client_name as string) ?? "Selvstendig",
            asString(p.location),
            readOptionalIsoDate(p.event_date) ?? toIso(p.created_at),
            readOptionalIsoDate(p.event_date) ?? toIso(p.updated_at),
            description,
            achievements,
            defaults?.skills ?? [],
            projectId,
          ],
        );
        await pool.query(
          `INSERT INTO resume_projects (
             resume_id, user_id, title, description, role,
             start_date, end_date, technologies, achievements,
             project_id, auto_generated
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE
           )`,
          [
            resumeId,
            session.userId,
            title,
            description,
            defaults?.jobTitle ?? null,
            readOptionalIsoDate(p.event_date),
            readOptionalIsoDate(p.event_date),
            defaults?.technologies ?? [],
            achievements,
            projectId,
          ],
        );
        items.push(mapExperience(exp.rows[0]));
        imported += 1;
      }
      res.json({
        imported,
        skipped,
        total: projects.length,
        items,
      });
    },
  );

  // ── Export ────────────────────────────────────────────────────────
  // ── Versjon-historikk ──────────────────────────────────────────────
  // Eksplisitt "Lagre versjon" — tar fullt snapshot av resume +
  // sub-ressurser i én jsonb. Brukes til å "frese tilbake" hvis AI
  // rewriter ødelegger noe, eller når brukeren vil ha en sjekkpunkt
  // før store endringer.

  app.get("/api/resumes/:id/versions", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!(await ensureResumeOwned(pool, req.params.id, session.userId))) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const r = await pool.query(
      `SELECT id, version_number, label, notes, created_at
         FROM resume_versions
        WHERE resume_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [req.params.id],
    );
    res.json(
      r.rows.map((row) => ({
        id: row.id as string,
        versionNumber: row.version_number as number,
        label: row.label as string | null,
        notes: row.notes as string | null,
        createdAt: toIso(row.created_at),
      })),
    );
  });

  app.post("/api/resumes/:id/versions", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const full = await loadFullResume(pool, req.params.id, session.userId);
    if (!full) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const label = asString(body.label, `Versjon ${new Date().toLocaleString("no-NO")}`);
    const notes = asString(body.notes);

    // Nestneste versjonsnummer
    const lastVersion = await pool.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM resume_versions WHERE resume_id = $1`,
      [req.params.id],
    );
    const versionNumber = (lastVersion.rows[0].next as number) || 1;
    const inserted = await pool.query(
      `INSERT INTO resume_versions (resume_id, user_id, version_number, label, notes, snapshot)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, version_number, label, notes, created_at`,
      [req.params.id, session.userId, versionNumber, label, notes, JSON.stringify(full)],
    );
    const row = inserted.rows[0];
    res.status(201).json({
      id: row.id,
      versionNumber: row.version_number,
      label: row.label,
      notes: row.notes,
      createdAt: toIso(row.created_at),
    });
  });

  app.post("/api/resumes/:id/versions/:vid/restore", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!(await ensureResumeOwned(pool, req.params.id, session.userId))) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const vr = await pool.query(
      `SELECT snapshot FROM resume_versions WHERE id = $1 AND resume_id = $2 LIMIT 1`,
      [req.params.vid, req.params.id],
    );
    if (!vr.rowCount) {
      res.status(404).json({ error: "Versjon ikke funnet" });
      return;
    }
    const snap = vr.rows[0].snapshot as {
      resume: ResumeRow;
      experiences: Array<Record<string, unknown>>;
      education: Array<Record<string, unknown>>;
      skills: Array<Record<string, unknown>>;
      certifications: Array<Record<string, unknown>>;
      projects: Array<Record<string, unknown>>;
      languages: Array<Record<string, unknown>>;
    };

    // Strategi: ta snapshot FØR restore (auto-versjon "Før restore"),
    // slett deretter alle sub-ressurser og opprett på nytt fra snapshot.
    const fullNow = await loadFullResume(pool, req.params.id, session.userId);
    if (fullNow) {
      const last = await pool.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM resume_versions WHERE resume_id = $1`,
        [req.params.id],
      );
      await pool.query(
        `INSERT INTO resume_versions (resume_id, user_id, version_number, label, notes, snapshot)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          req.params.id, session.userId, last.rows[0].next,
          `Auto-snapshot før restore`,
          'Tatt automatisk når brukeren restorert en eldre versjon.',
          JSON.stringify(fullNow),
        ],
      );
    }

    // Restore resume-felter
    const r = snap.resume;
    await pool.query(
      `UPDATE resumes SET
         title = $1, personal_info = $2::jsonb, template_id = $3,
         color_scheme = $4, custom_colors = $5::jsonb,
         target_job_title = $6, target_industry = $7,
         status = $8, language = $9, keywords = $10::text[],
         updated_at = NOW()
       WHERE id = $11 AND user_id = $12`,
      [
        r.title, JSON.stringify(r.personalInfo ?? {}), r.templateId,
        r.colorScheme, JSON.stringify(r.customColors ?? {}),
        r.targetJobTitle, r.targetIndustry,
        r.status, r.language, r.keywords ?? [],
        req.params.id, session.userId,
      ],
    );

    // Slett alle sub-ressurser og opprett på nytt
    await Promise.all([
      pool.query(`DELETE FROM resume_experiences WHERE resume_id = $1`, [req.params.id]),
      pool.query(`DELETE FROM resume_education WHERE resume_id = $1`, [req.params.id]),
      pool.query(`DELETE FROM resume_skills WHERE resume_id = $1`, [req.params.id]),
      pool.query(`DELETE FROM resume_certifications WHERE resume_id = $1`, [req.params.id]),
      pool.query(`DELETE FROM resume_projects WHERE resume_id = $1`, [req.params.id]),
      pool.query(`DELETE FROM resume_languages WHERE resume_id = $1`, [req.params.id]),
    ]);
    const inserts: Promise<unknown>[] = [];
    for (const e of snap.experiences ?? []) {
      const ex = e as any;
      inserts.push(pool.query(
        `INSERT INTO resume_experiences (resume_id, user_id, job_title, company, location, employment_type, start_date, end_date, is_current, description, achievements, skills, project_id, auto_generated, display_order, is_visible, experience_groups)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)`,
        [req.params.id, session.userId, ex.jobTitle, ex.company, ex.location, ex.employmentType, ex.startDate, ex.endDate, ex.isCurrent, ex.description, ex.achievements ?? [], ex.skills ?? [], ex.projectId, ex.autoGenerated, ex.displayOrder, ex.isVisible, ex.experienceGroups ? JSON.stringify(ex.experienceGroups) : null],
      ));
    }
    for (const e of snap.education ?? []) {
      const ed = e as any;
      inserts.push(pool.query(
        `INSERT INTO resume_education (resume_id, user_id, degree, field_of_study, institution, location, start_date, end_date, is_current, grade, description, achievements, display_order, is_visible)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [req.params.id, session.userId, ed.degree, ed.fieldOfStudy, ed.institution, ed.location, ed.startDate, ed.endDate, ed.isCurrent, ed.grade, ed.description, ed.achievements ?? [], ed.displayOrder, ed.isVisible],
      ));
    }
    for (const s of snap.skills ?? []) {
      const sk = s as any;
      inserts.push(pool.query(
        `INSERT INTO resume_skills (resume_id, user_id, name, category, proficiency_level, years_of_experience, display_order, is_visible)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.params.id, session.userId, sk.name, sk.category, sk.proficiencyLevel, sk.yearsOfExperience, sk.displayOrder, sk.isVisible],
      ));
    }
    for (const c of snap.certifications ?? []) {
      const ce = c as any;
      inserts.push(pool.query(
        `INSERT INTO resume_certifications (resume_id, user_id, name, issuer, issue_date, expiry_date, credential_id, credential_url, description, display_order, is_visible)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [req.params.id, session.userId, ce.name, ce.issuer, ce.issueDate, ce.expiryDate, ce.credentialId, ce.credentialUrl, ce.description, ce.displayOrder, ce.isVisible],
      ));
    }
    for (const p of snap.projects ?? []) {
      const pr = p as any;
      inserts.push(pool.query(
        `INSERT INTO resume_projects (resume_id, user_id, title, description, role, start_date, end_date, technologies, achievements, project_url, images, project_id, auto_generated, display_order, is_visible)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [req.params.id, session.userId, pr.title, pr.description, pr.role, pr.startDate, pr.endDate, pr.technologies ?? [], pr.achievements ?? [], pr.projectUrl, pr.images ?? [], pr.projectId, pr.autoGenerated, pr.displayOrder, pr.isVisible],
      ));
    }
    for (const l of snap.languages ?? []) {
      const lg = l as any;
      inserts.push(pool.query(
        `INSERT INTO resume_languages (resume_id, user_id, name, proficiency_level, level_label, is_native, display_order, is_visible)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.params.id, session.userId, lg.name, lg.proficiencyLevel, lg.levelLabel, lg.isNative, lg.displayOrder, lg.isVisible],
      ));
    }
    await Promise.all(inserts);
    res.json({ restored: true });
  });

  app.delete("/api/resumes/:id/versions/:vid", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query(
      `DELETE FROM resume_versions
        WHERE id = $1 AND resume_id = $2 AND user_id = $3
        RETURNING id`,
      [req.params.vid, req.params.id, session.userId],
    );
    if (r.rowCount === 0) {
      res.status(404).json({ error: "Versjon ikke funnet" });
      return;
    }
    res.json({ ok: true });
  });

  // ── GitHub-import ──────────────────────────────────────────────────
  // Henter offentlige repos fra GitHub Public API (uten OAuth), filtrerer
  // ut forks, sorterer etter stars, og legger inn de N (default 6) beste
  // som resume_projects-rader på CV-en.
  app.post("/api/resumes/:id/import-github", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username = asString(body.username);
    if (!username) {
      res.status(400).json({ error: "GitHub-brukernavn er påkrevd" });
      return;
    }
    if (!(await ensureResumeOwned(pool, req.params.id, session.userId))) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const max = Math.max(
      1,
      Math.min(20, (asNumberOrNull(body.max) ?? 6) as number),
    );
    try {
      const ghRes = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "CreatorHub-ResumeBuilder",
          },
        },
      );
      if (!ghRes.ok) {
        res.status(ghRes.status === 404 ? 404 : 502).json({
          error:
            ghRes.status === 404
              ? `GitHub-brukeren "${username}" finnes ikke.`
              : `GitHub-API svarte ${ghRes.status}.`,
        });
        return;
      }
      const repos = (await ghRes.json()) as Array<{
        id: number;
        name: string;
        full_name: string;
        description: string | null;
        html_url: string;
        fork: boolean;
        archived: boolean;
        language: string | null;
        stargazers_count: number;
        created_at: string;
        pushed_at: string;
        topics?: string[];
      }>;
      const top = repos
        .filter((r) => !r.fork && !r.archived)
        .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
        .slice(0, max);
      const created: unknown[] = [];
      for (const r of top) {
        // Skip duplikater
        const dup = await pool.query(
          `SELECT 1 FROM resume_projects WHERE resume_id = $1 AND project_url = $2 LIMIT 1`,
          [req.params.id, r.html_url],
        );
        if (dup.rowCount! > 0) continue;
        const technologies = [r.language, ...(r.topics ?? [])]
          .filter(Boolean)
          .slice(0, 8) as string[];
        const result = await pool.query(
          `INSERT INTO resume_projects (
             resume_id, user_id, title, description, role,
             start_date, technologies, project_url, project_id, auto_generated
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
           RETURNING *`,
          [
            req.params.id,
            session.userId,
            r.name,
            r.description ?? `GitHub-repository · ${r.stargazers_count} stjerner`,
            "Utvikler",
            r.created_at,
            technologies,
            r.html_url,
            `github-${r.id}`,
          ],
        );
        created.push(mapProject(result.rows[0]));
      }
      res.status(201).json({
        imported: created.length,
        skipped: top.length - created.length,
        items: created,
      });
    } catch (err) {
      console.error("GitHub-import feilet", err);
      res.status(500).json({
        error: "Kunne ikke importere fra GitHub",
        detail: String((err as Error)?.message ?? err).slice(0, 200),
      });
    }
  });

  // ── Klon CV ────────────────────────────────────────────────────────
  // Kopier resume + alle sub-ressurser til ny resume. Vanlig flyt:
  // "Master-CV" + variant per stilling. Beholder profilbilde,
  // erfaringer, alt — bare ny id og ny tittel.
  app.post("/api/resumes/:id/clone", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!enforceAiRateLimit(session.userId, res)) return;
    const full = await loadFullResume(pool, req.params.id, session.userId);
    if (!full) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const newTitle =
      asString(body.title, `Kopi av ${full.resume.title}`) ??
      `Kopi av ${full.resume.title}`;
    const newSlug = await uniqueSlug(pool, session.userId, newTitle);
    try {
      // 1. Opprett ny resume-rad
      const inserted = await pool.query(
        `INSERT INTO resumes (
           user_id, title, slug, personal_info, template_id, color_scheme,
           custom_colors, ats_score, ats_optimized, keywords, target_job_title,
           target_industry, status, language
         ) VALUES (
           $1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, 'draft', $13
         ) RETURNING *`,
        [
          session.userId,
          newTitle,
          newSlug,
          JSON.stringify(full.resume.personalInfo ?? {}),
          full.resume.templateId,
          full.resume.colorScheme,
          JSON.stringify(full.resume.customColors ?? {}),
          full.resume.atsScore,
          full.resume.atsOptimized,
          full.resume.keywords ?? [],
          full.resume.targetJobTitle,
          full.resume.targetIndustry,
          full.resume.language,
        ],
      );
      const newId = inserted.rows[0].id as string;

      // 2. Kopier alle sub-ressurser i parallell. Vi reset-er id/created/updated
      // (DB-default) og bytter resume_id.
      const inserts: Promise<unknown>[] = [];
      for (const e of full.experiences) {
        inserts.push(
          pool.query(
            `INSERT INTO resume_experiences (
               resume_id, user_id, job_title, company, location, employment_type,
               start_date, end_date, is_current, description, achievements, skills,
               project_id, auto_generated, display_order, is_visible, experience_groups
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb
             )`,
            [
              newId,
              session.userId,
              e.jobTitle,
              e.company,
              e.location,
              e.employmentType,
              e.startDate,
              e.endDate,
              e.isCurrent,
              e.description,
              e.achievements ?? [],
              e.skills ?? [],
              e.projectId,
              e.autoGenerated,
              e.displayOrder,
              e.isVisible,
              e.experienceGroups ? JSON.stringify(e.experienceGroups) : null,
            ],
          ),
        );
      }
      for (const e of full.education) {
        inserts.push(
          pool.query(
            `INSERT INTO resume_education (
               resume_id, user_id, degree, field_of_study, institution, location,
               start_date, end_date, is_current, grade, description, achievements,
               display_order, is_visible
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
              newId, session.userId, e.degree, e.fieldOfStudy, e.institution,
              e.location, e.startDate, e.endDate, e.isCurrent, e.grade,
              e.description, e.achievements ?? [], e.displayOrder, e.isVisible,
            ],
          ),
        );
      }
      for (const s of full.skills) {
        inserts.push(
          pool.query(
            `INSERT INTO resume_skills (resume_id, user_id, name, category, proficiency_level, years_of_experience, display_order, is_visible)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [newId, session.userId, s.name, s.category, s.proficiencyLevel, s.yearsOfExperience, s.displayOrder, s.isVisible],
          ),
        );
      }
      for (const c of full.certifications) {
        inserts.push(
          pool.query(
            `INSERT INTO resume_certifications (resume_id, user_id, name, issuer, issue_date, expiry_date, credential_id, credential_url, description, display_order, is_visible)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [newId, session.userId, c.name, c.issuer, c.issueDate, c.expiryDate, c.credentialId, c.credentialUrl, c.description, c.displayOrder, c.isVisible],
          ),
        );
      }
      for (const p of full.projects) {
        inserts.push(
          pool.query(
            `INSERT INTO resume_projects (resume_id, user_id, title, description, role, start_date, end_date, technologies, achievements, project_url, images, project_id, auto_generated, display_order, is_visible)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [
              newId, session.userId, p.title, p.description, p.role,
              p.startDate, p.endDate, p.technologies ?? [], p.achievements ?? [],
              p.projectUrl, p.images ?? [], p.projectId, p.autoGenerated,
              p.displayOrder, p.isVisible,
            ],
          ),
        );
      }
      for (const l of full.languages) {
        inserts.push(
          pool.query(
            `INSERT INTO resume_languages (resume_id, user_id, name, proficiency_level, level_label, is_native, display_order, is_visible)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [newId, session.userId, l.name, l.proficiencyLevel, l.levelLabel, l.isNative, l.displayOrder, l.isVisible],
          ),
        );
      }
      await Promise.all(inserts);

      res.status(201).json({
        resumeId: newId,
        title: newTitle,
        cloned: {
          experiences: full.experiences.length,
          education: full.education.length,
          skills: full.skills.length,
          certifications: full.certifications.length,
          projects: full.projects.length,
          languages: full.languages.length,
        },
      });
    } catch (err) {
      console.error("CV-klon feilet", err);
      res.status(500).json({ error: "Kunne ikke klone CV" });
    }
  });

  // ── Publiser CV / hent offentlig CV ─────────────────────────────────
  app.post("/api/resumes/:id/publish", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const isPublic = readBoolean(body.isPublic) ?? true;
    const existing = await pool.query(
      `SELECT slug, public_url FROM resumes WHERE id = $1 AND user_id = $2`,
      [req.params.id, session.userId],
    );
    if (!existing.rowCount) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    // Genererer en stabil shareable public_url (samme som slug for å
    // matche /api/public/resumes/:slug). Beholdes hvis allerede satt.
    const slug = existing.rows[0].slug as string;
    const publicUrl = (existing.rows[0].public_url as string | null) ?? slug;
    const r = await pool.query(
      `UPDATE resumes SET
         is_public = $1,
         public_url = $2,
         updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [isPublic, isPublic ? publicUrl : null, req.params.id, session.userId],
    );
    res.json({
      isPublic,
      publicUrl: isPublic ? publicUrl : null,
      resume: mapResume(r.rows[0]),
    });
  });

  // Offentlig CV-rendering — ingen auth-krav. Brukes av delelink.
  // Returnerer full CV-data (utenom interne felter som ai_suggestions).
  // Increment-er public_view_count så eier kan se hvor mange som har
  // åpnet lenken.
  app.get("/api/public/resumes/:slug", async (req, res) => {
    const r = await pool.query(
      `UPDATE resumes
          SET public_view_count = COALESCE(public_view_count, 0) + 1
        WHERE public_url = $1 AND is_public = TRUE
        RETURNING *`,
      [req.params.slug],
    );
    if (!r.rowCount) {
      res.status(404).json({ error: "CV er ikke offentlig eller finnes ikke" });
      return;
    }
    const resumeRow = r.rows[0];
    const resumeId = resumeRow.id as string;
    const [exp, edu, sk, cert, proj, lang] = await Promise.all([
      pool.query(
        `SELECT * FROM resume_experiences WHERE resume_id = $1 ORDER BY display_order, start_date DESC NULLS LAST`,
        [resumeId],
      ),
      pool.query(
        `SELECT * FROM resume_education WHERE resume_id = $1 ORDER BY display_order, start_date DESC NULLS LAST`,
        [resumeId],
      ),
      pool.query(
        `SELECT * FROM resume_skills WHERE resume_id = $1 ORDER BY display_order, name`,
        [resumeId],
      ),
      pool.query(
        `SELECT * FROM resume_certifications WHERE resume_id = $1 ORDER BY display_order, issue_date DESC`,
        [resumeId],
      ),
      pool.query(
        `SELECT * FROM resume_projects WHERE resume_id = $1 ORDER BY display_order, start_date DESC NULLS LAST`,
        [resumeId],
      ),
      pool.query(
        `SELECT * FROM resume_languages WHERE resume_id = $1 ORDER BY display_order, name`,
        [resumeId],
      ),
    ]);
    res.json({
      resume: mapResume(resumeRow),
      experiences: exp.rows.map(mapExperience),
      education: edu.rows.map(mapEducation),
      skills: sk.rows.map(mapSkill),
      certifications: cert.rows.map(mapCertification),
      projects: proj.rows.map(mapProject),
      languages: lang.rows.map(mapLanguage),
    });
  });

  app.post("/api/resumes/:id/export", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const format = (asString((req.body ?? {}).format, "pdf") ?? "pdf").toLowerCase();
    if (!["pdf", "docx", "txt", "json"].includes(format)) {
      res.status(400).json({ error: "Ugyldig format" });
      return;
    }
    const full = await loadFullResume(pool, req.params.id, session.userId);
    if (!full) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const filename = `${full.resume.slug ?? "cv"}`;
    try {
      if (format === "json") {
        await pool.query(
          `INSERT INTO resume_exports (resume_id, user_id, format) VALUES ($1, $2, 'json')`,
          [full.resume.id, session.userId],
        );
        await pool.query(
          `UPDATE resumes SET last_exported = NOW(), export_count = COALESCE(export_count,0) + 1 WHERE id = $1`,
          [full.resume.id],
        );
        res.json(full);
        return;
      }
      if (format === "txt") {
        const txt = buildPlainText(full);
        await pool.query(
          `INSERT INTO resume_exports (resume_id, user_id, format, file_size) VALUES ($1, $2, 'txt', $3)`,
          [full.resume.id, session.userId, Buffer.byteLength(txt)],
        );
        await pool.query(
          `UPDATE resumes SET last_exported = NOW(), export_count = COALESCE(export_count,0) + 1 WHERE id = $1`,
          [full.resume.id],
        );
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.txt"`,
        );
        res.send(txt);
        return;
      }
      if (format === "pdf") {
        const buf = await buildPdf(full);
        await pool.query(
          `INSERT INTO resume_exports (resume_id, user_id, format, file_size) VALUES ($1, $2, 'pdf', $3)`,
          [full.resume.id, session.userId, buf.byteLength],
        );
        await pool.query(
          `UPDATE resumes SET last_exported = NOW(), export_count = COALESCE(export_count,0) + 1 WHERE id = $1`,
          [full.resume.id],
        );
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.pdf"`,
        );
        res.send(buf);
        return;
      }
      // docx
      const buf = await buildDocx(full);
      await pool.query(
        `INSERT INTO resume_exports (resume_id, user_id, format, file_size) VALUES ($1, $2, 'docx', $3)`,
        [full.resume.id, session.userId, buf.byteLength],
      );
      await pool.query(
        `UPDATE resumes SET last_exported = NOW(), export_count = COALESCE(export_count,0) + 1 WHERE id = $1`,
        [full.resume.id],
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.docx"`,
      );
      res.send(buf);
    } catch (err) {
      console.error("resume export error", err);
      res.status(500).json({ error: "Kunne ikke eksportere CV" });
    }
  });

  // ── Profilbilde-opplasting ─────────────────────────────────────────
  // Lagrer fila som base64 data-URL i personal_info.profilePhoto. Samme
  // mønster som /api/branding/upload-logo, men scopet til én CV.
  app.post(
    "/api/resumes/:id/upload-photo",
    photoUpload.single("photo"),
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      if (!req.file) {
        res.status(400).json({ error: "Ingen fil mottatt" });
        return;
      }
      const resumeCheck = await pool.query(
        `SELECT personal_info FROM resumes WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!resumeCheck.rowCount) {
        res.status(404).json({ error: "CV ikke funnet" });
        return;
      }
      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const existing =
        (resumeCheck.rows[0].personal_info as Record<string, unknown>) ?? {};
      const next = { ...existing, profilePhoto: dataUrl };
      await pool.query(
        `UPDATE resumes SET personal_info = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(next), req.params.id],
      );
      res.json({ profilePhoto: dataUrl, size: req.file.size });
    },
  );

  // ── CV-import (PDF/DOCX → Claude → strukturert CV) ────────────────
  // Tar opp en eksisterende CV (PDF eller DOCX), ekstraherer tekst,
  // sender til Claude med JSON-prompt, og lagrer strukturert resume +
  // ── LinkedIn data-eksport-import ─────────────────────────────────
  // POST /api/resumes/:id/import-linkedin-zip — bruker laster opp ZIP-en
  // fra linkedin.com/mypreferences/d/download-my-data. Vi parser CSV-
  // filene i ZIP-en og inserter direkte i CV-ens sub-ressurser. Ingen
  // Claude-kall — alt deterministisk.
  app.post(
    "/api/resumes/:id/import-linkedin-zip",
    linkedInZipUpload.single("file"),
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      if (!req.file) {
        res.status(400).json({ error: "Ingen fil mottatt" });
        return;
      }
      if (!(await ensureResumeOwned(pool, req.params.id, session.userId))) {
        res.status(404).json({ error: "CV ikke funnet" });
        return;
      }
      try {
        const parsed = parseLinkedInExport(req.file.buffer);

        // Oppdater personalInfo (merge med eksisterende felt)
        if (parsed.personalInfo && Object.values(parsed.personalInfo).some(Boolean)) {
          const existingRes = await pool.query(
            `SELECT personal_info FROM resumes WHERE id = $1 AND user_id = $2`,
            [req.params.id, session.userId],
          );
          const existing =
            (existingRes.rows[0]?.personal_info as Record<string, unknown>) ?? {};
          const merged: Record<string, unknown> = {
            ...existing,
            ...(parsed.personalInfo.fullName && { fullName: parsed.personalInfo.fullName }),
            ...(parsed.personalInfo.headline && { professionalTitle: parsed.personalInfo.headline }),
            ...(parsed.personalInfo.summary && { summary: parsed.personalInfo.summary }),
            ...(parsed.personalInfo.location && { location: parsed.personalInfo.location }),
            ...(parsed.personalInfo.linkedin && {
              linkedin: parsed.personalInfo.linkedin.startsWith("http")
                ? parsed.personalInfo.linkedin
                : `https://www.linkedin.com/in/${parsed.personalInfo.linkedin}`,
            }),
          };
          await pool.query(
            `UPDATE resumes SET personal_info = $1::jsonb, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(merged), req.params.id],
          );
        }

        // Insert experiences (skip duplikater basert på company+jobTitle+startDate)
        let expAdded = 0;
        for (const exp of parsed.experiences) {
          const dup = await pool.query(
            `SELECT 1 FROM resume_experiences
              WHERE resume_id = $1 AND job_title = $2 AND company = $3 LIMIT 1`,
            [req.params.id, exp.jobTitle, exp.company],
          );
          if (dup.rowCount! > 0) continue;
          await pool.query(
            `INSERT INTO resume_experiences (
               resume_id, user_id, job_title, company, location,
               start_date, end_date, is_current, description
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              req.params.id, session.userId, exp.jobTitle, exp.company,
              exp.location ?? null,
              exp.startDate ?? new Date().toISOString(),
              exp.endDate, exp.isCurrent, exp.description ?? null,
            ],
          );
          expAdded += 1;
        }

        // Insert education
        let eduAdded = 0;
        for (const edu of parsed.education) {
          const dup = await pool.query(
            `SELECT 1 FROM resume_education
              WHERE resume_id = $1 AND institution = $2 AND COALESCE(degree, '') = $3 LIMIT 1`,
            [req.params.id, edu.institution, edu.degree ?? ""],
          );
          if (dup.rowCount! > 0) continue;
          await pool.query(
            `INSERT INTO resume_education (
               resume_id, user_id, degree, field_of_study, institution,
               start_date, end_date
             ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              req.params.id, session.userId,
              edu.degree ?? "Utdanning",
              edu.fieldOfStudy ?? null,
              edu.institution,
              edu.startDate ?? new Date().toISOString(),
              edu.endDate,
            ],
          );
          eduAdded += 1;
        }

        // Insert skills (dedupe på navn)
        let skillsAdded = 0;
        const existingSkills = await pool.query(
          `SELECT LOWER(name) AS lname FROM resume_skills WHERE resume_id = $1`,
          [req.params.id],
        );
        const skillSet = new Set(existingSkills.rows.map((r) => r.lname as string));
        for (const s of parsed.skills) {
          if (skillSet.has(s.name.toLowerCase())) continue;
          await pool.query(
            `INSERT INTO resume_skills (resume_id, user_id, name, proficiency_level)
             VALUES ($1, $2, $3, 70)`,
            [req.params.id, session.userId, s.name],
          );
          skillSet.add(s.name.toLowerCase());
          skillsAdded += 1;
        }

        // Insert languages
        let langsAdded = 0;
        const existingLangs = await pool.query(
          `SELECT LOWER(name) AS lname FROM resume_languages WHERE resume_id = $1`,
          [req.params.id],
        );
        const langSet = new Set(existingLangs.rows.map((r) => r.lname as string));
        for (const l of parsed.languages) {
          if (langSet.has(l.name.toLowerCase())) continue;
          // Map levelLabel til proficiency-tall
          const profMap: Record<string, number> = {
            Morsmål: 100, Flytende: 90, God: 70, Grunnleggende: 40,
          };
          const prof = (l.levelLabel && profMap[l.levelLabel]) ?? 80;
          await pool.query(
            `INSERT INTO resume_languages (
               resume_id, user_id, name, proficiency_level, level_label, is_native
             ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              req.params.id, session.userId, l.name, prof, l.levelLabel ?? null,
              l.levelLabel === "Morsmål",
            ],
          );
          langSet.add(l.name.toLowerCase());
          langsAdded += 1;
        }

        // Insert certifications
        let certsAdded = 0;
        for (const c of parsed.certifications) {
          const dup = await pool.query(
            `SELECT 1 FROM resume_certifications
              WHERE resume_id = $1 AND name = $2 AND COALESCE(issuer, '') = $3 LIMIT 1`,
            [req.params.id, c.name, c.issuer ?? ""],
          );
          if (dup.rowCount! > 0) continue;
          await pool.query(
            `INSERT INTO resume_certifications (
               resume_id, user_id, name, issuer, issue_date
             ) VALUES ($1, $2, $3, $4, $5)`,
            [
              req.params.id, session.userId, c.name,
              c.issuer ?? "Ukjent",
              c.issueDate ?? new Date().toISOString(),
            ],
          );
          certsAdded += 1;
        }

        res.json({
          imported: {
            personalInfoMerged: !!parsed.personalInfo && Object.values(parsed.personalInfo).some(Boolean),
            experiences: expAdded,
            education: eduAdded,
            skills: skillsAdded,
            languages: langsAdded,
            certifications: certsAdded,
          },
          filesProcessed: parsed.filesProcessed,
          filesSkipped: parsed.filesSkipped,
        });
      } catch (err) {
        console.error("LinkedIn ZIP-import feilet", err);
        res.status(500).json({
          error: "LinkedIn-import feilet",
          detail: String((err as Error)?.message ?? err).slice(0, 200),
        });
      }
    },
  );

  // alle sub-ressurser. Returnerer ny resumeId så frontend kan
  // navigere direkte til editoren.
  app.post(
    "/api/resumes/import",
    cvImportUpload.single("file"),
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      if (!enforceAiRateLimit(session.userId, res)) return;
      if (!req.file) {
        res.status(400).json({ error: "Ingen fil mottatt" });
        return;
      }
      try {
        let text = "";
        if (req.file.mimetype === "application/pdf") {
          // pdf-parse ESM eksporterer funksjonen som modul-default OG som
          // navngitt default-eksport. Cast via unknown for å unngå type-mismatch.
          const pdfParseMod = await import("pdf-parse");
          const pdfParse = ((pdfParseMod as unknown as { default?: typeof pdfParseMod }).default ?? pdfParseMod) as unknown as (buf: Buffer) => Promise<{ text: string }>;
          const parsed = await pdfParse(req.file.buffer);
          text = parsed.text;
        } else {
          const mammoth = await import("mammoth");
          const parsed = await mammoth.extractRawText({
            buffer: req.file.buffer,
          });
          text = parsed.value;
        }
        text = text.trim();
        if (text.length < 50) {
          res.status(400).json({
            error: "Kunne ikke hente tekst fra dokumentet — er det skannet/bildebasert?",
          });
          return;
        }
        // Send til Claude med strukturert JSON-prompt
        const systemPrompt = `Du er en CV-parser for norske CV-er. Trekk ut innholdet fra teksten og returner KUN gyldig JSON med følgende struktur (alle felt valgfrie unntatt der angitt):
{
  "title": "string (kort tittel for CV-en)",
  "personalInfo": {
    "fullName": "string", "email": "string", "phone": "string",
    "location": "string", "linkedin": "string", "website": "string",
    "professionalTitle": "string", "summary": "string"
  },
  "experiences": [{
    "jobTitle": "string", "company": "string", "location": "string",
    "employmentType": "full-time|part-time|contract|freelance|self-employed|internship",
    "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD eller null", "isCurrent": false,
    "description": "string", "achievements": ["string"],
    "experienceGroups": [{"category": "string", "items": ["string"]}]
  }],
  "education": [{
    "degree": "string", "fieldOfStudy": "string", "institution": "string",
    "location": "string", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD",
    "isCurrent": false, "description": "string", "achievements": ["string"]
  }],
  "skills": [{"name": "string", "category": "string", "proficiencyLevel": 0-100}],
  "certifications": [{
    "name": "string", "issuer": "string", "issueDate": "YYYY-MM-DD",
    "expiryDate": "YYYY-MM-DD eller null"
  }],
  "languages": [{
    "name": "string", "levelLabel": "Morsmål|Flytende|God|Grunnleggende",
    "proficiencyLevel": 0-100, "isNative": boolean
  }]
}

Regler:
- Behold ALL detalj i punktene — bryt opp i achievements eller experienceGroups
- Hvis én jobb har flere sub-roller (Produsent: / Regissør: / Fotograf:), bruk experienceGroups med kategori + items
- Konverter alle datoer til YYYY-MM-DD (hvis kun måned+år: bruk dag 01)
- "DAGS DATO" eller "Nå" → isCurrent: true, endDate: null
- Ikke finn opp data — bare det som faktisk står
- Returner KUN JSON, ingen markdown-fences, ingen forklaring`;
        const ai = await callClaude({
          system: systemPrompt,
          user: text.slice(0, 20000),
          maxTokens: 6000,
        });
        const parsed = tryParseJson<Record<string, unknown>>(ai.text);
        if (!parsed) {
          res.status(502).json({ error: "Kunne ikke parse Claude-respons" });
          return;
        }
        // Opprett ny resume + sub-ressurser
        const title = (parsed.title as string) ?? "Importert CV";
        const slug = await uniqueSlug(pool, session.userId, title);
        const personalInfo = (parsed.personalInfo as Record<string, unknown>) ?? {};
        const resumeResult = await pool.query(
          `INSERT INTO resumes (user_id, title, slug, personal_info, template_id, status, language)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7) RETURNING *`,
          [
            session.userId,
            title,
            slug,
            JSON.stringify(personalInfo),
            "modern-ats",
            "draft",
            "no",
          ],
        );
        const newResumeId = resumeResult.rows[0].id;

        // Sub-ressurser parallelt
        const inserts: Promise<unknown>[] = [];
        for (const e of ((parsed.experiences as unknown[]) ?? []).slice(0, 30)) {
          const exp = e as Record<string, unknown>;
          inserts.push(
            pool.query(
              `INSERT INTO resume_experiences (
                 resume_id, user_id, job_title, company, location, employment_type,
                 start_date, end_date, is_current, description, achievements,
                 experience_groups
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
              [
                newResumeId,
                session.userId,
                asString(exp.jobTitle) ?? "Stilling",
                asString(exp.company) ?? "Selskap",
                asString(exp.location),
                asString(exp.employmentType),
                readOptionalIsoDate(exp.startDate) ?? new Date().toISOString(),
                readOptionalIsoDate(exp.endDate),
                readBoolean(exp.isCurrent) ?? false,
                asString(exp.description),
                Array.isArray(exp.achievements) ? exp.achievements : [],
                Array.isArray(exp.experienceGroups)
                  ? JSON.stringify(exp.experienceGroups)
                  : null,
              ],
            ),
          );
        }
        for (const ed of ((parsed.education as unknown[]) ?? []).slice(0, 15)) {
          const e = ed as Record<string, unknown>;
          inserts.push(
            pool.query(
              `INSERT INTO resume_education (
                 resume_id, user_id, degree, field_of_study, institution, location,
                 start_date, end_date, is_current, description, achievements
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                newResumeId,
                session.userId,
                asString(e.degree) ?? "Utdanning",
                asString(e.fieldOfStudy),
                asString(e.institution) ?? "Institusjon",
                asString(e.location),
                readOptionalIsoDate(e.startDate) ?? new Date().toISOString(),
                readOptionalIsoDate(e.endDate),
                readBoolean(e.isCurrent) ?? false,
                asString(e.description),
                Array.isArray(e.achievements) ? e.achievements : [],
              ],
            ),
          );
        }
        for (const sk of ((parsed.skills as unknown[]) ?? []).slice(0, 50)) {
          const s = sk as Record<string, unknown>;
          if (!asString(s.name)) continue;
          inserts.push(
            pool.query(
              `INSERT INTO resume_skills (resume_id, user_id, name, category, proficiency_level)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                newResumeId,
                session.userId,
                asString(s.name),
                asString(s.category),
                Math.max(
                  0,
                  Math.min(100, (asNumberOrNull(s.proficiencyLevel) ?? 70)),
                ),
              ],
            ),
          );
        }
        for (const c of ((parsed.certifications as unknown[]) ?? []).slice(0, 20)) {
          const cert = c as Record<string, unknown>;
          if (!asString(cert.name)) continue;
          inserts.push(
            pool.query(
              `INSERT INTO resume_certifications (
                 resume_id, user_id, name, issuer, issue_date, expiry_date
               ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                newResumeId,
                session.userId,
                asString(cert.name),
                asString(cert.issuer) ?? "Ukjent",
                readOptionalIsoDate(cert.issueDate) ?? new Date().toISOString(),
                readOptionalIsoDate(cert.expiryDate),
              ],
            ),
          );
        }
        for (const lg of ((parsed.languages as unknown[]) ?? []).slice(0, 15)) {
          const l = lg as Record<string, unknown>;
          if (!asString(l.name)) continue;
          inserts.push(
            pool.query(
              `INSERT INTO resume_languages (
                 resume_id, user_id, name, proficiency_level, level_label, is_native
               ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                newResumeId,
                session.userId,
                asString(l.name),
                Math.max(
                  0,
                  Math.min(100, asNumberOrNull(l.proficiencyLevel) ?? 80),
                ),
                asString(l.levelLabel),
                readBoolean(l.isNative) ?? false,
              ],
            ),
          );
        }
        await Promise.all(inserts);

        res.status(201).json({
          resumeId: newResumeId,
          imported: {
            experiences: (parsed.experiences as unknown[])?.length ?? 0,
            education: (parsed.education as unknown[])?.length ?? 0,
            skills: (parsed.skills as unknown[])?.length ?? 0,
            certifications: (parsed.certifications as unknown[])?.length ?? 0,
            languages: (parsed.languages as unknown[])?.length ?? 0,
          },
          tokens: { input: ai.inputTokens, output: ai.outputTokens },
        });
      } catch (err) {
        console.error("CV-import feilet", err);
        res.status(500).json({
          error: "CV-import feilet",
          detail: String((err as Error)?.message ?? err).slice(0, 200),
        });
      }
    },
  );

  // ════════════════════════════════════════════════════════════════════
  // CLAUDE / AI ENDPOINTS
  // ════════════════════════════════════════════════════════════════════

  // #1 — ATS-analyse + jobbannonse-match (#1 + #5 + #7 fra AI-pakken)
  app.post("/api/resumes/:id/ai-analyze", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!enforceAiRateLimit(session.userId, res)) return;
    const full = await loadFullResume(pool, req.params.id, session.userId);
    if (!full) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const jobDescription = asString((req.body ?? {}).jobDescription);
    try {
      const ai = await callClaude({
        system:
          'Du er ATS-ekspert som analyserer CV-er for norske jobbsøkere. Returner KUN gyldig JSON med følgende felter: {"atsScore": 0-100, "matchScore": 0-100 eller null hvis ingen jobbeskrivelse, "matchedKeywords": [...], "missingKeywords": [...], "suggestions": [{"type":"keyword|content|structure|grammar","severity":"low|medium|high","message":"...","suggestion":"..."}], "summary": "1-2 setninger på norsk"}. Ingen markdown-fences. Ingen forspil.',
        user: [
          "CV-INNHOLD:",
          summarizeResumeForAI(full),
          jobDescription
            ? `\nJOBBESKRIVELSE Å MATCHE MOT:\n${jobDescription}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        maxTokens: 2200,
      });
      const parsed = tryParseJson<{
        atsScore?: number;
        matchScore?: number | null;
        matchedKeywords?: string[];
        missingKeywords?: string[];
        suggestions?: unknown[];
        summary?: string;
      }>(ai.text);
      if (!parsed) {
        res
          .status(502)
          .json({ error: "Kunne ikke parse Claude-respons", raw: ai.text.slice(0, 500) });
        return;
      }
      const atsScore =
        typeof parsed.atsScore === "number" ? Math.max(0, Math.min(100, parsed.atsScore)) : null;
      const matchScore =
        typeof parsed.matchScore === "number" ? Math.max(0, Math.min(100, parsed.matchScore)) : null;
      await pool.query(
        `INSERT INTO resume_ai_analyses (
           resume_id, user_id, analysis_type, score, suggestions,
           matched_keywords, missing_keywords, job_description, match_score
         ) VALUES ($1, $2, 'ats_optimization', $3, $4::jsonb, $5, $6, $7, $8)`,
        [
          full.resume.id,
          session.userId,
          atsScore,
          JSON.stringify(parsed.suggestions ?? []),
          parsed.matchedKeywords ?? [],
          parsed.missingKeywords ?? [],
          jobDescription,
          matchScore,
        ],
      );
      await pool.query(
        `UPDATE resumes SET
           ats_score = COALESCE($1, ats_score),
           last_ai_analysis = NOW(),
           ai_suggestions = $2::jsonb,
           keywords = COALESCE($3::text[], keywords)
         WHERE id = $4`,
        [
          atsScore,
          JSON.stringify({
            summary: parsed.summary,
            improvements: parsed.suggestions,
          }),
          parsed.matchedKeywords ?? null,
          full.resume.id,
        ],
      );
      res.json({
        atsScore,
        matchScore,
        matchedKeywords: parsed.matchedKeywords ?? [],
        missingKeywords: parsed.missingKeywords ?? [],
        suggestions: parsed.suggestions ?? [],
        summary: parsed.summary,
        tokens: { input: ai.inputTokens, output: ai.outputTokens },
      });
    } catch (err) {
      console.error("ai-analyze error", err);
      res
        .status(500)
        .json({ error: "AI-analyse feilet", detail: String((err as Error)?.message ?? err).slice(0, 200) });
    }
  });

  // #2 — Generer/rewrite sammendrag
  app.post("/api/resumes/:id/ai-summary", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!enforceAiRateLimit(session.userId, res)) return;
    const full = await loadFullResume(pool, req.params.id, session.userId);
    if (!full) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const tone = asString((req.body ?? {}).tone, "profesjonell") ?? "profesjonell";
    try {
      const ai = await callClaude({
        system: `Du er en CV-spesialist for norske kreatører. Skriv et førstepersons sammendrag på norsk, ${tone} tone, 3-5 setninger, ~400-600 tegn. Inneholder rolle, kjerne-styrker og verdi-bidrag. Ingen klisjéer som "team player" eller "passionate". Ingen markdown. Returner bare teksten.`,
        user: `CV-innhold:\n${summarizeResumeForAI(full)}`,
        maxTokens: 600,
      });
      const summary = ai.text.replace(/^["']|["']$/g, "").trim();
      // Oppdater personalInfo.summary
      const existing =
        (full.resume.personalInfo as Record<string, unknown>) ?? {};
      const next = { ...existing, summary };
      await pool.query(
        `UPDATE resumes SET personal_info = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(next), full.resume.id],
      );
      res.json({
        summary,
        tokens: { input: ai.inputTokens, output: ai.outputTokens },
      });
    } catch (err) {
      console.error("ai-summary error", err);
      res
        .status(500)
        .json({ error: "AI-sammendrag feilet", detail: String((err as Error)?.message ?? err).slice(0, 200) });
    }
  });

  // #3 — Rewrite achievements/bullets på én erfaring
  app.post(
    "/api/resumes/:id/experiences/:eid/ai-rewrite",
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      if (!enforceAiRateLimit(session.userId, res)) return;
      if (!(await ensureResumeOwned(pool, req.params.id, session.userId))) {
        res.status(404).json({ error: "CV ikke funnet" });
        return;
      }
      const expResult = await pool.query(
        `SELECT * FROM resume_experiences WHERE id = $1 AND resume_id = $2`,
        [req.params.eid, req.params.id],
      );
      if (!expResult.rowCount) {
        res.status(404).json({ error: "Erfaring ikke funnet" });
        return;
      }
      const exp = expResult.rows[0];
      try {
        const ai = await callClaude({
          system:
            'Du er en CV-spesialist. Omformuler bullet-points slik at de er konkrete, kvantifiserte og i past tense. Returner JSON: {"description": "1-2 setninger", "achievements": ["...", "...", "..."]} (max 5 achievements). Ingen markdown.',
          user: [
            `Rolle: ${exp.job_title} hos ${exp.company}`,
            exp.description ? `Eksisterende beskrivelse: ${exp.description}` : "",
            Array.isArray(exp.achievements) && exp.achievements.length
              ? `Eksisterende bullets:\n${exp.achievements.map((a: string) => `- ${a}`).join("\n")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          maxTokens: 800,
        });
        const parsed = tryParseJson<{
          description?: string;
          achievements?: string[];
        }>(ai.text);
        if (!parsed) {
          res.status(502).json({ error: "Kunne ikke parse Claude-respons" });
          return;
        }
        const r = await pool.query(
          `UPDATE resume_experiences
              SET description = COALESCE($1, description),
                  achievements = COALESCE($2::text[], achievements),
                  updated_at = NOW()
            WHERE id = $3 AND resume_id = $4
            RETURNING *`,
          [
            parsed.description ?? null,
            Array.isArray(parsed.achievements)
              ? parsed.achievements.slice(0, 5)
              : null,
            req.params.eid,
            req.params.id,
          ],
        );
        res.json({
          experience: mapExperience(r.rows[0]),
          tokens: { input: ai.inputTokens, output: ai.outputTokens },
        });
      } catch (err) {
        console.error("ai-rewrite error", err);
        res
          .status(500)
          .json({ error: "AI-rewrite feilet", detail: String((err as Error)?.message ?? err).slice(0, 200) });
      }
    },
  );

  // #4 — Søknadsbrev (norsk)
  app.post("/api/resumes/:id/ai-cover-letter", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!enforceAiRateLimit(session.userId, res)) return;
    const full = await loadFullResume(pool, req.params.id, session.userId);
    if (!full) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const jobDescription = asString(body.jobDescription);
    if (!jobDescription) {
      res.status(400).json({ error: "jobDescription er påkrevd" });
      return;
    }
    const tone = asString(body.tone, "profesjonell") ?? "profesjonell";
    const jobTitle = asString(body.jobTitle);
    const company = asString(body.company);
    // Tone-mapping: hver tone får eksplisitte retningslinjer.
    const TONE_GUIDES: Record<string, string> = {
      'profesjonell':
        'Selvsikker uten å være arrogant. Konkret og resultat-orientert. Få men sterke setninger. Tiltal "Hei [ansettelsesansvarlig]" eller "Til [Selskap]".',
      'varm':
        'Personlig og oppriktig. Vis genuin entusiasme for selskapet (kun hvis JD-en gir grunnlag). Naturlig setningsflyt, "jeg" og "min" naturlig. Avslutt med engasjerende takkesetning.',
      'formell':
        'Tradisjonell norsk forretningsstil. Tiltal "Til hvem det måtte angå" eller "Til ansettelsesansvarlig". Komplette setninger, ingen sammentrekninger. Avslutt "Vennlig hilsen".',
      'direkte':
        'Kortfattet og handlings-orientert. 200-300 ord, ikke 400. Hver setning bærer en konkret påstand. Ingen oppvarmingssetninger.',
    };
    const toneGuide = TONE_GUIDES[tone] ?? TONE_GUIDES['profesjonell'];

    // Strukturert system-prompt med:
    //   • Klar 4-avsnitt-struktur
    //   • Reasoning-step (Claude tenker først, skriver så)
    //   • Anti-klisjé-liste (eksplisitte termer å unngå)
    //   • Few-shot eksempel av et VELDIG GODT norsk brev
    //   • Tone-spesifikk veiledning
    const systemPrompt = [
      'Du er en erfaren norsk karriereveileder som skriver søknadsbrev. ',
      'Skriv 280-380 ord, 4 avsnitt på norsk (bokmål):',
      '',
      'STRUKTUR (følg eksakt):',
      '  Avsnitt 1 (3-4 setn): Åpning — koble søkerens kjernekompetanse',
      '    DIREKTE til stillingens hovedkrav. Nevn stillingstittel og selskap.',
      '  Avsnitt 2 (4-5 setn): Konkret prestasjon #1. Bruk TALL fra CV-en.',
      '    Vis hvordan denne erfaringen løser et problem JD-en beskriver.',
      '  Avsnitt 3 (4-5 setn): Konkret prestasjon #2 eller tverrgående',
      '    ferdigheter. Koble til selskapets kontekst hvis JD nevner det.',
      '  Avsnitt 4 (2-3 setn): Klar avslutning — uttrykk konkret interesse',
      '    i intervju, ikke generisk "ser fram til å høre fra dere".',
      '',
      `TONE: ${tone}. Retningslinjer: ${toneGuide}`,
      '',
      'ANTI-KLISJÉER — IKKE bruk disse ordene/uttrykkene:',
      '  ❌ "team player", "passionate", "self-motivated", "detail-oriented"',
      '  ❌ "ser frem til å høre fra dere", "ikke nøl med å kontakte meg"',
      '  ❌ "jeg er sikker på", "uten tvil", "perfect fit"',
      '  ❌ Vage adjektiver: "dynamisk", "innovativ", "leverer resultater"',
      '  ❌ Generiske setninger om interesse — vis spesifikk interesse i SELSKAPET',
      '',
      'REGLER for matching:',
      '  • Plukk DE 2 mest relevante prestasjonene fra CV-en som svarer',
      '    på spesifikke krav i JD-en. Ignorer resten.',
      '  • Tall fra CV-en MÅ med ("økte engasjement med 340%", ikke "økte engasjement").',
      '  • Bruk minst 3 nøkkelord/begreper fra JD-en ordrett.',
      '  • Hvis JD beskriver et problem/utfordring, koble en CV-prestasjon',
      '    direkte til løsningen.',
      '',
      'EKSEMPEL på godt åpningsavsnitt (formatet du skal følge):',
      '  "Senior Content Manager-stillingen hos Equinor er en naturlig forlengelse',
      '   av rollen min hos Digital Norge AS, hvor jeg har ledet team på 8 personer',
      '   og produsert kampanjer for B2B SaaS-kunder. Med 10 års erfaring innen',
      '   datadrevet content-strategi og dokumenterte resultater (340% økt',
      '   engasjement, 1.2M ARR levert), passer profilen min godt til kravene',
      '   dere skisserer."',
      '',
      'OUTPUT: KUN selve brevet. Ingen <thinking>, ingen markdown-fences,',
      'ingen overskrifter. Start direkte med tiltale.',
    ].join('\n');

    // Bygg user-prompt med klar matching-instruks
    const userPrompt = [
      jobTitle ? `STILLING: ${jobTitle}` : '',
      company ? `SELSKAP: ${company}` : '',
      '',
      'JOBBESKRIVELSE (full tekst — finn de 3 viktigste kravene):',
      jobDescription,
      '',
      'SØKERS CV (strukturert sammendrag — plukk 2 mest relevante prestasjoner):',
      summarizeResumeForAI(full),
      '',
      'OPPGAVE: Følg strukturen i system-prompten. Match CV-prestasjoner',
      'mot JD-krav. Skriv hele brevet uten preamble.',
    ]
      .filter((line) => line !== '')
      .join('\n');

    try {
      const ai = await callClaude({
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 2000,
      });
      // Rens output: fjern eventuelle markdown-fences eller thinking-tags
      // som Claude kan inkludere på tross av instruksen.
      let cleanBody = ai.text
        .replace(/^```(?:markdown|text)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .trim();
      // Persistér til cover-letter-biblioteket så brukeren kan finne
      // tilbake til brevet senere. Bryter ikke responsen om INSERT feiler.
      let savedId: string | null = null;
      try {
        const saved = await pool.query(
          `INSERT INTO resume_cover_letters (
             user_id, resume_id, job_title, company, body,
             language, tone, generated_by_ai, input_tokens, output_tokens
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9)
           RETURNING id`,
          [
            session.userId, full.resume.id,
            jobTitle, company, cleanBody,
            full.resume.language ?? "no", tone,
            ai.inputTokens, ai.outputTokens,
          ],
        );
        savedId = saved.rows[0]?.id ?? null;
      } catch (saveErr) {
        console.warn("cover-letter persistence failed (ikke fatal):", saveErr);
      }
      res.json({
        coverLetter: cleanBody,
        coverLetterId: savedId,
        tokens: { input: ai.inputTokens, output: ai.outputTokens },
      });
    } catch (err) {
      console.error("ai-cover-letter error", err);
      res
        .status(500)
        .json({ error: "AI-søknadsbrev feilet", detail: String((err as Error)?.message ?? err).slice(0, 200) });
    }
  });

  // ── AI Mock Interview ─────────────────────────────────────────────
  //
  // Pro-feature: chat-basert intervjutrening. Flyt:
  //   POST /api/interview-sessions   start ny sesjon → returnerer
  //                                  session-id + første spørsmål
  //   POST /:id/answer               bruker svarer → AI gir feedback
  //                                  og neste spørsmål
  //   POST /:id/complete             marker som fullført → AI gir
  //                                  samlet sammendrag
  //   GET  /:id                      hent full sesjon (alle messages)
  //   GET  /                         list brukerens sesjoner
  //   DELETE /:id                    slett

  app.post("/api/interview-sessions", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!enforceAiRateLimit(session.userId, res)) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const resumeId = asString(body.resumeId);
    const jobDescription = asString(body.jobDescription);
    if (!resumeId || !jobDescription) {
      res.status(400).json({ error: "resumeId og jobDescription er påkrevd" });
      return;
    }
    const full = await loadFullResume(pool, resumeId, session.userId);
    if (!full) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    let jobTitle = asString(body.jobTitle);
    let company = asString(body.company);
    let jdText = jobDescription;
    const jobApplicationId = asString(body.jobApplicationId);
    const mode = asString(body.mode) || "qa_text";

    // Hvis bruker valgte en jobbsøknad fra Kanban — auto-populer
    // JD/tittel/selskap fra raden. Bruker-angitte verdier overrider.
    if (jobApplicationId) {
      const appRow = await pool.query(
        `SELECT job_title, company, notes, job_url
           FROM job_applications
          WHERE id = $1 AND user_id = $2`,
        [jobApplicationId, session.userId],
      );
      if (appRow.rowCount) {
        const a = appRow.rows[0];
        jobTitle = jobTitle || (a.job_title as string | null) || "";
        company = company || (a.company as string | null) || "";
        // Hvis bruker ikke ga JD eksplisitt, fall tilbake på notes
        // (mange brukere limer hele annonsen inn der).
        if (!jobDescription && a.notes) jdText = a.notes as string;
      }
    }

    const totalQuestions = Math.max(
      4, Math.min(12, (asNumberOrNull(body.totalQuestions) ?? 8) as number),
    );

    // STEG 1 — ekstraher kompetansekrav fra JD. Vises som checklist
    // i frontend og brukes som eksplisitte scoring-kriterier i feedback.
    let competenceRequirements: { key: string; label: string; why: string }[] = [];
    try {
      const reqAi = await callClaude({
        system: [
          "Du er en ekspert på norsk arbeidsmarked. Du leser en stillingsannonse",
          "og ekstraherer de 4-6 viktigste KOMPETANSEKRAVENE arbeidsgiver vil se",
          "kandidaten demonstrere — både tekniske og myke ferdigheter.",
          "",
          "Returner KUN JSON i dette formatet:",
          '{"requirements": [{"key": "kort_snake_case", "label": "Norsk visningstekst (3-6 ord)", "why": "1 setning om hvorfor denne stillingen krever det"}]}',
          "",
          "Eksempler på gode 'key'-verdier: customer_service, sales_understanding,",
          "data_analysis, team_leadership, problem_solving, technical_depth_python.",
          "Hold listen 4-6 elementer. Prioriter konkrete fremfor generelle.",
          "Ingen markdown.",
        ].join("\n"),
        user: [
          jobTitle ? `STILLING: ${jobTitle}` : "",
          company ? `SELSKAP: ${company}` : "",
          `\nANNONSE:\n${jdText}`,
        ]
          .filter(Boolean)
          .join("\n"),
        maxTokens: 600,
      });
      const reqParsed = tryParseJson<{
        requirements?: { key: string; label: string; why: string }[];
      }>(reqAi.text);
      competenceRequirements = Array.isArray(reqParsed?.requirements)
        ? reqParsed.requirements.slice(0, 8)
        : [];
    } catch (err) {
      // Ikke-fatal — vi fortsetter uten kompetanse-checklist.
      console.warn("[interview-session] competence extraction failed", err);
    }

    // STEG 2 — generer første spørsmål basert på CV + JD + kompetansekrav.
    // Case-modus har egen system-prompt — Claude opptrer som intervjuer
    // som presenterer case og skyver bruker mot strukturert tilnærming.
    try {
      const competenceContext = competenceRequirements.length
        ? `\nKOMPETANSEKRAV vi vil at kandidaten demonstrerer:\n${competenceRequirements.map((r) => `  • ${r.label} — ${r.why}`).join("\n")}`
        : "";

      const casePrompt = asString(body.casePrompt);
      const isCaseMode = mode === "case";

      const systemPrompt = isCaseMode
        ? [
            "Du er en kresen case-intervjuer (tenk McKinsey / BCG / produktleder hos store norske selskap).",
            "Du presenterer ÉN konkret case for kandidaten og leder dem gjennom intervjuet.",
            "",
            "Case-intervjuet har 5-6 faser:",
            "  1. CASE-PRESENTASJON — du gir scenariet, fakta, oppgaven",
            "  2. AVKLARING — kandidaten skal stille avklarende spørsmål FØR de svarer",
            "  3. STRUKTUR — kandidaten foreslår rammeverk (Profit Tree, MECE, 4P, Porter, etc)",
            "  4. ANALYSE — kandidaten jobber seg gjennom rammeverket med hypoteser",
            "  5. ANBEFALING — kandidaten konkluderer med konkret anbefaling",
            "  6. UTFORDRING — du presser dem ('hva med X? Hvordan beregner du dette?')",
            "",
            "Du er KRESEN. Du:",
            "  • Gir IKKE bort svaret eller løsningen",
            "  • Lar IKKE kandidaten slippe unna med vage svar — du presser konkret",
            "  • Påpeker rammeverk-feil tidlig ('grenene dine overlapper')",
            "  • Spør 'hvordan beregner du det?' når kandidaten bruker tall",
            "  • Holder tidstrykket realistisk",
            "",
            "Det FØRSTE 'spørsmålet' er CASE-PRESENTASJONEN: 3-5 setninger med scenario, fakta og oppgave.",
            "",
            "Returner KUN JSON i dette formatet:",
            '{"category": "case_presentation", "question": "Den fulle case-presentasjonen", "targets": []}',
            "Ingen markdown.",
          ].join("\n")
        : [
            "Du er en erfaren norsk intervju-coach. Du gjennomfører en intervjutrening.",
            `Du skal stille ${totalQuestions} spørsmål totalt — varier mellom:`,
            "  • behavioral (STAR-format: tidligere situasjon)",
            "  • technical (yrkes-spesifikk kunnskap)",
            "  • competence (overførbare ferdigheter)",
            "  • situational (hypotetisk scenario)",
            "",
            "Hvert spørsmål skal være designet for å avdekke OM kandidaten",
            "har en eller flere av de definerte kompetansekravene.",
            "",
            "Returner KUN JSON med dette formatet for FØRSTE spørsmål:",
            '{"category": "behavioral|technical|competence|situational", "question": "Spørsmålet ditt", "targets": ["kompetanse_key_1"]}',
            "Ingen markdown, ingen forklaring, kun JSON.",
          ].join("\n");

      const userPromptParts = isCaseMode
        ? [
            jobTitle ? `STILLING: ${jobTitle}` : "",
            company ? `SELSKAP: ${company}` : "",
            casePrompt
              ? `\nCASE-PROMPT FRA BRUKER (basis for caset):\n${casePrompt}`
              : `JOBBESKRIVELSE:\n${jdText}`,
            competenceContext,
            `\nKANDIDATENS CV:\n${summarizeResumeForAI(full)}`,
            "",
            casePrompt
              ? "Bruk brukerens case-prompt som utgangspunkt og lag en presentasjon kandidaten kan jobbe med."
              : "Lag en realistisk case som passer stillingen (markedsstørrelse / lønnsomhet / produktstrategi / M&A / estimering — avhengig av bransje).",
            "Hold caset stramt: 3-5 setninger med kontekst, tall, og en åpen oppgave.",
          ]
        : [
            jobTitle ? `STILLING: ${jobTitle}` : "",
            company ? `SELSKAP: ${company}` : "",
            `JOBBESKRIVELSE:\n${jdText}`,
            competenceContext,
            `\nKANDIDATENS CV:\n${summarizeResumeForAI(full)}`,
            "",
            `Generer DET FØRSTE intervjuspørsmålet. Det bør være åpnings-`,
            `vennlig (myk start), gjerne behavioral. Bruk konkrete detaljer`,
            `fra kandidatens CV i spørsmålet.`,
          ];

      const ai = await callClaude({
        system: systemPrompt,
        user: userPromptParts.filter(Boolean).join("\n"),
        maxTokens: isCaseMode ? 1000 : 600,
      });
      const parsed = tryParseJson<{
        category?: string;
        question?: string;
        targets?: string[];
      }>(ai.text);
      if (!parsed?.question) {
        res.status(502).json({ error: "Kunne ikke generere intervjuspørsmål" });
        return;
      }
      // Opprett sesjon
      const sessionInsert = await pool.query(
        `INSERT INTO interview_sessions (
           user_id, resume_id, job_application_id, job_title, company,
           job_description, total_questions, language, mode,
           competence_requirements
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb) RETURNING *`,
        [
          session.userId, resumeId, jobApplicationId || null,
          jobTitle, company, jdText, totalQuestions,
          full.resume.language ?? "no",
          mode,
          competenceRequirements.length
            ? JSON.stringify(competenceRequirements)
            : null,
        ],
      );
      const sessionId = sessionInsert.rows[0].id as string;
      // Lagre første spørsmål
      await pool.query(
        `INSERT INTO interview_messages (
           session_id, role, category, content, question_idx, tokens_input, tokens_output
         ) VALUES ($1, 'question', $2, $3, 0, $4, $5)`,
        [sessionId, parsed.category ?? "behavioral", parsed.question, ai.inputTokens, ai.outputTokens],
      );
      res.status(201).json({
        sessionId,
        questionIdx: 0,
        totalQuestions,
        category: parsed.category ?? "behavioral",
        question: parsed.question,
        competenceRequirements,
        mode,
        jobTitle,
        company,
      });
    } catch (err) {
      console.error("interview-session create error", err);
      res.status(500).json({
        error: "Kunne ikke starte intervju",
        detail: String((err as Error)?.message ?? err).slice(0, 200),
      });
    }
  });

  app.post("/api/interview-sessions/:id/answer", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!enforceAiRateLimit(session.userId, res)) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const answer = asString(body.answer);
    if (!answer) {
      res.status(400).json({ error: "answer er påkrevd" });
      return;
    }
    const sessionResult = await pool.query(
      `SELECT * FROM interview_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, session.userId],
    );
    if (!sessionResult.rowCount) {
      res.status(404).json({ error: "Sesjon ikke funnet" });
      return;
    }
    const sess = sessionResult.rows[0];
    if (sess.status !== "in_progress") {
      res.status(400).json({ error: "Sesjonen er ikke aktiv" });
      return;
    }
    const currentIdx = sess.current_question_idx as number;
    const totalQs = sess.total_questions as number;

    // Lagre brukerens svar
    await pool.query(
      `INSERT INTO interview_messages (session_id, role, content, question_idx)
       VALUES ($1, 'answer', $2, $3)`,
      [sess.id, answer, currentIdx],
    );

    // Hent CV-kontekst + alle tidligere meldinger for å bygge full kontekst
    const fullCv = await loadFullResume(pool, sess.resume_id, session.userId);
    const messagesResult = await pool.query(
      `SELECT role, category, content, question_idx
         FROM interview_messages
        WHERE session_id = $1
        ORDER BY created_at ASC`,
      [sess.id],
    );
    const conversation = messagesResult.rows
      .map((m) => {
        if (m.role === "question") return `[INTERVJUER]: ${m.content}`;
        if (m.role === "answer") return `[KANDIDAT]: ${m.content}`;
        return `[FEEDBACK]: ${m.content}`;
      })
      .join("\n\n");

    const isLastQuestion = currentIdx + 1 >= totalQs;
    const isCaseMode = sess.mode === "case";

    try {
      const ai = await callClaude({
        system: isCaseMode
          ? [
              "Du er en kresen case-intervjuer (McKinsey/BCG-stil). Du leder kandidaten",
              "gjennom et case-intervju i fasene: avklaring → struktur → analyse → anbefaling.",
              "",
              "Vurder kandidatens siste svar med høye krav:",
              "  • Stiller kandidaten avklarende spørsmål FØR de hopper til struktur? (godt)",
              "  • Bruker de et eksplisitt rammeverk (Profit Tree, MECE, 4P, Porter)?",
              "  • Er rammeverket MECE (Mutually Exclusive, Collectively Exhaustive)?",
              "  • Begrunner de hver hypotese, eller gjetter de?",
              "  • Bygger de en logisk struktur ELLER hopper mellom poenger?",
              "  • Konkluderer de tydelig med en anbefaling og resonnement?",
              "",
              "Vær KRESEN. IKKE gi bort løsningen. Press kandidaten:",
              "  • Hvis svaret er vagt: 'hvordan vil du beregne det?'",
              "  • Hvis rammeverket har overlapp: 'grenene dine her overlapper — hva skjer hvis...'",
              "  • Hvis de har en hypotese: 'hva ville fått deg til å forkaste den hypotesen?'",
              "  • Hvis de bruker tall: 'hvor kommer det tallet fra?'",
              "",
              "Returner KUN JSON i dette formatet:",
              isLastQuestion
                ? `{"feedback": "kresen feedback (3-4 setninger) — pek konkret på rammeverk/logikk-feil", "score": 0-10, "isFinal": true}`
                : `{"feedback": "kresen feedback (2-3 setninger)", "score": 0-10, "category": "clarification|structure|analysis|recommendation|challenge", "nextQuestion": "neste oppfølgings-spørsmål eller utfordring", "isFinal": false}`,
              "Ingen markdown.",
            ].join("\n")
          : [
              "Du er en norsk intervju-coach. Gi konstruktiv feedback på kandidatens siste svar,",
              "deretter still neste spørsmål (eller avslutt hvis dette var siste).",
              "",
              "Returner KUN JSON i dette formatet:",
              isLastQuestion
                ? `{"feedback": "kort feedback (2-3 setninger) på siste svar", "score": 0-10, "isFinal": true}`
                : `{"feedback": "kort feedback (2-3 setninger) på siste svar", "score": 0-10, "category": "behavioral|technical|competence|situational", "nextQuestion": "neste spørsmål", "isFinal": false}`,
              "",
              "Feedback skal være:",
              "  • Konkret (peke på faktiske setninger)",
              "  • Bygd på STAR-metoden (Situasjon, Oppgave, Handling, Resultat)",
              "  • Foreslå EN forbedring, ikke en liste",
              "Neste spørsmål skal:",
              "  • Variere kategori fra forrige",
              "  • Bygge på kandidatens svar (utforske dypere)",
              "  • Knytte til JD-en",
              "Ingen markdown.",
            ].join("\n"),
        user: [
          `STILLING: ${sess.job_title ?? ""}`,
          isCaseMode
            ? `CASE/JOBBESKRIVELSE: ${sess.job_description}`
            : `JOBBESKRIVELSE: ${sess.job_description}`,
          fullCv ? `\nCV: ${summarizeResumeForAI(fullCv).slice(0, 1500)}` : "",
          `\nINTERVJU-HISTORIKK:\n${conversation}`,
          "",
          `Tur ${currentIdx + 1} av ${totalQs}. ${isLastQuestion ? "DETTE ER SISTE SVAR." : ""}`,
        ]
          .filter(Boolean)
          .join("\n"),
        maxTokens: 1200,
      });
      const parsed = tryParseJson<{
        feedback?: string;
        score?: number;
        category?: string;
        nextQuestion?: string;
        isFinal?: boolean;
      }>(ai.text);

      if (!parsed) {
        res.status(502).json({ error: "Kunne ikke parse AI-respons" });
        return;
      }

      // Lagre feedback
      await pool.query(
        `INSERT INTO interview_messages (
           session_id, role, content, question_idx,
           feedback_score, tokens_input, tokens_output
         ) VALUES ($1, 'feedback', $2, $3, $4, $5, $6)`,
        [sess.id, parsed.feedback ?? "", currentIdx,
         parsed.score ?? null, ai.inputTokens, ai.outputTokens],
      );

      // Lagre neste spørsmål (hvis ikke siste)
      const nextIdx = currentIdx + 1;
      if (!isLastQuestion && parsed.nextQuestion) {
        await pool.query(
          `INSERT INTO interview_messages (session_id, role, category, content, question_idx)
           VALUES ($1, 'question', $2, $3, $4)`,
          [sess.id, parsed.category ?? "behavioral", parsed.nextQuestion, nextIdx],
        );
      }

      // Oppdater sesjon
      await pool.query(
        `UPDATE interview_sessions SET current_question_idx = $1, updated_at = NOW() WHERE id = $2`,
        [nextIdx, sess.id],
      );

      res.json({
        feedback: parsed.feedback,
        score: parsed.score,
        questionIdx: nextIdx,
        isFinal: isLastQuestion || !parsed.nextQuestion,
        nextQuestion: parsed.nextQuestion,
        nextCategory: parsed.category,
      });
    } catch (err) {
      console.error("interview-session answer error", err);
      res.status(500).json({
        error: "AI-feedback feilet",
        detail: String((err as Error)?.message ?? err).slice(0, 200),
      });
    }
  });

  // POST audio-svar — multipart/form-data med 'audio'-felt.
  // Transkriberer via OpenAI Whisper og kjører deretter samme
  // feedback-logikk som tekst-svaret. Returnerer samme respons +
  // transcript + signed audio URL for playback.
  app.post(
    "/api/interview-sessions/:id/answer-audio",
    trainingMediaUpload.single("audio"),
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      if (!enforceAiRateLimit(session.userId, res)) return;

      const file = (req as express.Request & {
        file?: { buffer: Buffer; mimetype: string; size: number };
      }).file;
      if (!file?.buffer?.byteLength) {
        res.status(400).json({ error: "audio er påkrevd" });
        return;
      }

      const sessionResult = await pool.query(
        `SELECT * FROM interview_sessions WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId],
      );
      if (!sessionResult.rowCount) {
        res.status(404).json({ error: "Sesjon ikke funnet" });
        return;
      }
      const sess = sessionResult.rows[0];
      if (sess.status !== "in_progress") {
        res.status(400).json({ error: "Sesjonen er ikke aktiv" });
        return;
      }
      const currentIdx = sess.current_question_idx as number;
      const totalQs = sess.total_questions as number;

      // 1) Transkriber via Whisper FØRST — hvis det feiler vil vi
      //    ikke laste opp og bruke R2-lagring unødvendig.
      const transcription = await transcribeAudioWithWhisper({
        buffer: file.buffer,
        filename: `answer-${currentIdx}.${file.mimetype.split(";")[0].endsWith("webm") ? "webm" : "audio"}`,
        mime: file.mimetype,
        preferredLanguage: sess.language ?? "no",
      });
      if (isTranscriptionError(transcription)) {
        res.status(502).json({
          error: "transkripsjon_feilet",
          detail: transcription.error,
        });
        return;
      }
      const transcript = transcription.text;
      if (!transcript) {
        res.status(400).json({
          error: "Ingen tale registrert i opptaket. Prøv igjen.",
        });
        return;
      }

      // 2) Last opp lydfilen til R2 i bakgrunnen (best-effort — vi
      //    fortsetter selv om opplastingen feiler så bruker ikke
      //    blokkeres). Returnerer signed URL hvis vellykket.
      let audioR2Key: string | null = null;
      let audioUrl: string | null = null;
      try {
        const uploaded = await uploadTrainingMedia({
          buffer: file.buffer,
          mime: file.mimetype,
          kind: "audio",
          userId: session.userId,
          sessionId: sess.id,
        });
        if (uploaded.ok) {
          audioR2Key = uploaded.key;
          audioUrl = uploaded.url;
        }
      } catch (err) {
        console.warn("[interview-audio] R2 upload failed (non-fatal)", err);
      }

      // 3) Lagre brukerens svar (med transkripsjon + audio-meta)
      await pool.query(
        `INSERT INTO interview_messages (
           session_id, role, content, question_idx,
           audio_url, audio_r2_key, duration_ms, transcript_lang
         ) VALUES ($1, 'answer', $2, $3, $4, $5, $6, $7)`,
        [
          sess.id,
          transcript,
          currentIdx,
          audioUrl,
          audioR2Key,
          transcription.durationMs,
          transcription.language,
        ],
      );

      // 4) Hent CV + samtale-kontekst og kjør samme AI-feedback-logikk
      const fullCv = await loadFullResume(pool, sess.resume_id, session.userId);
      const messagesResult = await pool.query(
        `SELECT role, category, content, question_idx
           FROM interview_messages
          WHERE session_id = $1
          ORDER BY created_at ASC`,
        [sess.id],
      );
      const conversation = messagesResult.rows
        .map((m) => {
          if (m.role === "question") return `[INTERVJUER]: ${m.content}`;
          if (m.role === "answer") return `[KANDIDAT]: ${m.content}`;
          return `[FEEDBACK]: ${m.content}`;
        })
        .join("\n\n");
      const isLastQuestion = currentIdx + 1 >= totalQs;
      const isCaseModeAudio = sess.mode === "case";

      try {
        const ai = await callClaude({
          system: isCaseModeAudio
            ? [
                "Du er en kresen case-intervjuer (McKinsey/BCG-stil). Kandidaten svarte",
                "med tale — vi har transkribert det. Vurder svaret med høye krav:",
                "  • Avklarer kandidaten først eller hopper de til struktur?",
                "  • Bruker de et eksplisitt rammeverk?",
                "  • Begrunner de tall og hypoteser?",
                "  • Holder de logisk struktur eller hopper de?",
                "",
                "Vær KRESEN — IKKE gi bort løsningen. Bemerk også taleflyt.",
                "",
                "Returner KUN JSON:",
                isLastQuestion
                  ? `{"feedback": "kresen feedback", "score": 0-10, "isFinal": true}`
                  : `{"feedback": "kresen feedback", "score": 0-10, "category": "clarification|structure|analysis|recommendation|challenge", "nextQuestion": "neste utfordring", "isFinal": false}`,
              ].join("\n")
            : [
                "Du er en norsk intervju-coach. Kandidaten svarte med tale; vi har transkribert det.",
                "Bemerk eksplisitt om svaret virker øvet, naturlig eller fragmentert.",
                "Gi konstruktiv feedback på siste svar, deretter still neste spørsmål (eller avslutt).",
                "",
                "Returner KUN JSON i dette formatet:",
                isLastQuestion
                  ? `{"feedback": "kort feedback (2-3 setninger) på siste svar", "score": 0-10, "isFinal": true}`
                  : `{"feedback": "kort feedback (2-3 setninger) på siste svar", "score": 0-10, "category": "behavioral|technical|competence|situational", "nextQuestion": "neste spørsmål", "isFinal": false}`,
                "",
                "Feedback skal være:",
                "  • Konkret (peke på faktiske setninger)",
                "  • Bygd på STAR-metoden",
                "  • Vurdere taleflyt (svaret kommer fra audio-transkripsjon — kommenter naturlighet hvis relevant)",
                "  • Foreslå EN forbedring, ikke en liste",
                "Ingen markdown.",
              ].join("\n"),
          user: [
            `STILLING: ${sess.job_title ?? ""}`,
            `JOBBESKRIVELSE: ${sess.job_description}`,
            fullCv ? `\nCV: ${summarizeResumeForAI(fullCv).slice(0, 1500)}` : "",
            `\nINTERVJU-HISTORIKK:\n${conversation}`,
            "",
            `Spørsmål ${currentIdx + 1} av ${totalQs}. ${isLastQuestion ? "DETTE ER SISTE SVAR." : ""}`,
            transcription.durationMs
              ? `\nTaletid: ${(transcription.durationMs / 1000).toFixed(1)} sek`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          maxTokens: 1200,
        });
        const parsed = tryParseJson<{
          feedback?: string;
          score?: number;
          category?: string;
          nextQuestion?: string;
          isFinal?: boolean;
        }>(ai.text);

        if (!parsed) {
          res.status(502).json({ error: "Kunne ikke parse AI-respons" });
          return;
        }

        await pool.query(
          `INSERT INTO interview_messages (
             session_id, role, content, question_idx,
             feedback_score, tokens_input, tokens_output
           ) VALUES ($1, 'feedback', $2, $3, $4, $5, $6)`,
          [sess.id, parsed.feedback ?? "", currentIdx,
           parsed.score ?? null, ai.inputTokens, ai.outputTokens],
        );

        const nextIdx = currentIdx + 1;
        if (!isLastQuestion && parsed.nextQuestion) {
          await pool.query(
            `INSERT INTO interview_messages (session_id, role, category, content, question_idx)
             VALUES ($1, 'question', $2, $3, $4)`,
            [sess.id, parsed.category ?? "behavioral", parsed.nextQuestion, nextIdx],
          );
        }
        await pool.query(
          `UPDATE interview_sessions SET current_question_idx = $1, updated_at = NOW() WHERE id = $2`,
          [nextIdx, sess.id],
        );

        res.json({
          transcript,
          durationMs: transcription.durationMs,
          audioUrl,
          feedback: parsed.feedback,
          score: parsed.score,
          questionIdx: nextIdx,
          isFinal: isLastQuestion || !parsed.nextQuestion,
          nextQuestion: parsed.nextQuestion,
          nextCategory: parsed.category,
        });
      } catch (err) {
        console.error("interview-session answer-audio error", err);
        res.status(500).json({
          error: "AI-feedback feilet",
          detail: String((err as Error)?.message ?? err).slice(0, 200),
        });
      }
    },
  );

  app.post("/api/interview-sessions/:id/complete", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!enforceAiRateLimit(session.userId, res)) return;

    const sessionResult = await pool.query(
      `SELECT * FROM interview_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, session.userId],
    );
    if (!sessionResult.rowCount) {
      res.status(404).json({ error: "Sesjon ikke funnet" });
      return;
    }
    const sess = sessionResult.rows[0];

    // Hent alle Q/A/feedback
    const messages = await pool.query(
      `SELECT role, content, feedback_score, question_idx FROM interview_messages
        WHERE session_id = $1 ORDER BY created_at ASC`,
      [sess.id],
    );

    const conversation = messages.rows
      .map((m) => {
        if (m.role === "question") return `Q${(m.question_idx ?? 0) + 1}: ${m.content}`;
        if (m.role === "answer") return `Svar: ${m.content}`;
        return `Feedback (${m.feedback_score}/10): ${m.content}`;
      })
      .join("\n\n");

    // Generer samlet sammendrag
    try {
      const ai = await callClaude({
        system: [
          "Du er en norsk intervju-coach. Gi samlet vurdering av intervjutreningen.",
          'Returner KUN JSON: {"overallScore": 0-100, "summary": "2-3 setninger", "strengths": ["..","..",".."], "improvements": ["..","..",".."]}',
          "Ingen markdown.",
        ].join("\n"),
        user: `STILLING: ${sess.job_title ?? ""}\n\nINTERVJU:\n${conversation}\n\nGi samlet vurdering, 3 styrker, 3 forbedrings-områder.`,
        maxTokens: 1500,
      });
      const parsed = tryParseJson<{
        overallScore?: number;
        summary?: string;
        strengths?: string[];
        improvements?: string[];
      }>(ai.text);

      const overallScore = typeof parsed?.overallScore === "number"
        ? Math.max(0, Math.min(100, parsed.overallScore))
        : null;

      await pool.query(
        `UPDATE interview_sessions
            SET status = 'completed',
                overall_score = $1,
                overall_feedback = $2,
                strengths = $3,
                improvement_areas = $4,
                completed_at = NOW(),
                updated_at = NOW()
          WHERE id = $5`,
        [
          overallScore,
          parsed?.summary ?? null,
          parsed?.strengths ?? [],
          parsed?.improvements ?? [],
          sess.id,
        ],
      );

      res.json({
        sessionId: sess.id,
        overallScore,
        summary: parsed?.summary,
        strengths: parsed?.strengths ?? [],
        improvements: parsed?.improvements ?? [],
      });
    } catch (err) {
      console.error("interview-session complete error", err);
      res.status(500).json({
        error: "Kunne ikke fullføre vurdering",
        detail: String((err as Error)?.message ?? err).slice(0, 200),
      });
    }
  });

  app.get("/api/interview-sessions/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const sessionResult = await pool.query(
      `SELECT * FROM interview_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, session.userId],
    );
    if (!sessionResult.rowCount) {
      res.status(404).json({ error: "Sesjon ikke funnet" });
      return;
    }
    const sess = sessionResult.rows[0];
    const messages = await pool.query(
      `SELECT id, role, category, content, question_idx, feedback_score, created_at
         FROM interview_messages
        WHERE session_id = $1
        ORDER BY created_at ASC`,
      [sess.id],
    );
    res.json({
      session: {
        id: sess.id,
        resumeId: sess.resume_id,
        jobTitle: sess.job_title,
        company: sess.company,
        status: sess.status,
        currentQuestionIdx: sess.current_question_idx,
        totalQuestions: sess.total_questions,
        overallScore: sess.overall_score,
        overallFeedback: sess.overall_feedback,
        strengths: sess.strengths ?? [],
        improvementAreas: sess.improvement_areas ?? [],
        createdAt: toIso(sess.created_at),
        completedAt: sess.completed_at ? toIso(sess.completed_at) : null,
      },
      messages: messages.rows.map((m) => ({
        id: m.id,
        role: m.role,
        category: m.category,
        content: m.content,
        questionIdx: m.question_idx,
        feedbackScore: m.feedback_score,
        createdAt: toIso(m.created_at),
      })),
    });
  });

  app.get("/api/interview-sessions", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query(
      `SELECT id, job_title, company, status, current_question_idx,
              total_questions, overall_score, created_at, completed_at
         FROM interview_sessions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [session.userId],
    );
    res.json(
      r.rows.map((s) => ({
        id: s.id,
        jobTitle: s.job_title,
        company: s.company,
        status: s.status,
        progress: `${s.current_question_idx}/${s.total_questions}`,
        overallScore: s.overall_score,
        createdAt: toIso(s.created_at),
        completedAt: s.completed_at ? toIso(s.completed_at) : null,
      })),
    );
  });

  app.delete("/api/interview-sessions/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query(
      `DELETE FROM interview_sessions WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, session.userId],
    );
    if (!r.rowCount) {
      res.status(404).json({ error: "Sesjon ikke funnet" });
      return;
    }
    res.json({ ok: true });
  });

  // ── Cover Letter Library ──────────────────────────────────────────
  // List, hent, oppdater og slett lagrede søknadsbrev. Auto-lagring
  // skjer fra ai-cover-letter-endepunktet over.
  app.get("/api/cover-letters", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query(
      `SELECT id, resume_id, job_title, company, body, language, tone,
              is_favorite, notes, created_at
         FROM resume_cover_letters
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [session.userId],
    );
    res.json(
      r.rows.map((row) => ({
        id: row.id,
        resumeId: row.resume_id,
        jobTitle: row.job_title,
        company: row.company,
        body: row.body,
        language: row.language,
        tone: row.tone,
        isFavorite: row.is_favorite,
        notes: row.notes,
        createdAt: toIso(row.created_at),
      })),
    );
  });

  app.patch("/api/cover-letters/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [req.params.id, session.userId];
    if ("body" in body) {
      params.push(asString(body.body));
      sets.push(`body = $${params.length}`);
    }
    if ("isFavorite" in body) {
      params.push(readBoolean(body.isFavorite));
      sets.push(`is_favorite = $${params.length}`);
    }
    if ("notes" in body) {
      params.push(asString(body.notes));
      sets.push(`notes = $${params.length}`);
    }
    if ("jobApplicationId" in body) {
      params.push(asString(body.jobApplicationId));
      sets.push(`job_application_id = $${params.length}`);
    }
    if (!sets.length) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    sets.push("updated_at = NOW()");
    const r = await pool.query(
      `UPDATE resume_cover_letters SET ${sets.join(", ")}
        WHERE id = $1 AND user_id = $2
        RETURNING *`,
      params,
    );
    if (!r.rowCount) {
      res.status(404).json({ error: "Søknadsbrev ikke funnet" });
      return;
    }
    res.json({ ok: true });
  });

  app.delete("/api/cover-letters/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query(
      `DELETE FROM resume_cover_letters WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, session.userId],
    );
    if (!r.rowCount) {
      res.status(404).json({ error: "Søknadsbrev ikke funnet" });
      return;
    }
    res.json({ ok: true });
  });

  // #6 — Grammatikk + tone-sjekk
  app.post("/api/resumes/:id/ai-grammar", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!enforceAiRateLimit(session.userId, res)) return;
    const full = await loadFullResume(pool, req.params.id, session.userId);
    if (!full) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    try {
      const ai = await callClaude({
        system:
          'Du er korrekturleser for norske CV-er. Returner JSON: {"score": 0-100, "issues": [{"location":"summary|experience|education|skills","severity":"low|medium|high","problem":"...","fix":"..."}]}. Sjekk: rettskriving, grammatikk, tone-konsistens, past tense i erfaring, unngåelse av klisjéer. Ingen markdown.',
        user: summarizeResumeForAI(full),
        maxTokens: 1500,
      });
      const parsed = tryParseJson<{ score?: number; issues?: unknown[] }>(
        ai.text,
      );
      if (!parsed) {
        res.status(502).json({ error: "Kunne ikke parse Claude-respons" });
        return;
      }
      const score =
        typeof parsed.score === "number"
          ? Math.max(0, Math.min(100, parsed.score))
          : null;
      await pool.query(
        `INSERT INTO resume_ai_analyses (resume_id, user_id, analysis_type, score, suggestions)
         VALUES ($1, $2, 'grammar_check', $3, $4::jsonb)`,
        [
          full.resume.id,
          session.userId,
          score,
          JSON.stringify(parsed.issues ?? []),
        ],
      );
      res.json({
        score,
        issues: parsed.issues ?? [],
        tokens: { input: ai.inputTokens, output: ai.outputTokens },
      });
    } catch (err) {
      console.error("ai-grammar error", err);
      res
        .status(500)
        .json({ error: "AI-grammatikk feilet", detail: String((err as Error)?.message ?? err).slice(0, 200) });
    }
  });

  // #8 — Oversettelse NO ↔ EN
  app.post("/api/resumes/:id/ai-translate", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!enforceAiRateLimit(session.userId, res)) return;
    const full = await loadFullResume(pool, req.params.id, session.userId);
    if (!full) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const targetLang = (asString((req.body ?? {}).targetLang, "en") ?? "en").toLowerCase();
    if (!["en", "no", "nb", "nn"].includes(targetLang)) {
      res.status(400).json({ error: "targetLang må være 'en' eller 'no'" });
      return;
    }
    const langLabel = targetLang === "en" ? "engelsk" : "norsk (bokmål)";
    try {
      const payload = {
        personalInfo: full.resume.personalInfo,
        title: full.resume.title,
        targetJobTitle: full.resume.targetJobTitle,
        experiences: full.experiences.map((e) => ({
          jobTitle: e.jobTitle,
          company: e.company,
          location: e.location,
          description: e.description,
          achievements: e.achievements,
        })),
        education: full.education.map((e) => ({
          degree: e.degree,
          fieldOfStudy: e.fieldOfStudy,
          institution: e.institution,
          description: e.description,
        })),
        skills: full.skills.map((s) => s.name),
        certifications: full.certifications.map((c) => ({
          name: c.name,
          issuer: c.issuer,
          description: c.description,
        })),
        projects: full.projects.map((p) => ({
          title: p.title,
          description: p.description,
          role: p.role,
          achievements: p.achievements,
        })),
      };
      const ai = await callClaude({
        system: `Du er CV-oversetter. Oversett ALLE tekst-felter til ${langLabel}. Behold strukturen til JSON-objektet, bare oversett verdier (ikke nøkler, ikke datoer, ikke navn på personer/firmaer/utdanningsinstitusjoner — kun beskrivelser, titler og prosa). Returner KUN det oversatte JSON-objektet uten forklaring. Ingen markdown-fences.`,
        user: JSON.stringify(payload),
        maxTokens: 4000,
      });
      const translated = tryParseJson<Record<string, unknown>>(ai.text);
      if (!translated) {
        res.status(502).json({ error: "Kunne ikke parse oversettelse" });
        return;
      }
      res.json({
        targetLang,
        translated,
        tokens: { input: ai.inputTokens, output: ai.outputTokens },
      });
    } catch (err) {
      console.error("ai-translate error", err);
      res
        .status(500)
        .json({ error: "AI-oversettelse feilet", detail: String((err as Error)?.message ?? err).slice(0, 200) });
    }
  });

  // #10 — Intervju-prep
  app.post("/api/resumes/:id/ai-interview-prep", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    if (!enforceAiRateLimit(session.userId, res)) return;
    const full = await loadFullResume(pool, req.params.id, session.userId);
    if (!full) {
      res.status(404).json({ error: "CV ikke funnet" });
      return;
    }
    const jobDescription = asString((req.body ?? {}).jobDescription);
    try {
      const ai = await callClaude({
        system:
          'Du er intervju-coach for norske kreatører. Returner JSON: {"behavioral":[...8 spørsmål...],"technical":[...6 spørsmål...],"competence":[...6 spørsmål...],"tipsBeforeInterview":[...3-5 tips...]}. Norsk språk. Konkret, basert på CV. Ingen markdown.',
        user: [
          `CV:\n${summarizeResumeForAI(full)}`,
          jobDescription ? `\nJobbeskrivelse:\n${jobDescription}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        maxTokens: 2200,
      });
      const parsed = tryParseJson<{
        behavioral?: string[];
        technical?: string[];
        competence?: string[];
        tipsBeforeInterview?: string[];
      }>(ai.text);
      if (!parsed) {
        res.status(502).json({ error: "Kunne ikke parse Claude-respons" });
        return;
      }
      res.json({
        ...parsed,
        tokens: { input: ai.inputTokens, output: ai.outputTokens },
      });
    } catch (err) {
      console.error("ai-interview-prep error", err);
      res
        .status(500)
        .json({ error: "AI-intervjuprep feilet", detail: String((err as Error)?.message ?? err).slice(0, 200) });
    }
  });

  // Avoid TS warnings on imported helpers that aren't used in all branches
  void readString;
}
