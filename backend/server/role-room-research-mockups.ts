import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { RoleRoomAgentNormalizedPayload } from "./role-room-agent.js";
import type { RoleRoomAgentProgressPreview } from "./role-room-agent.js";
import type { RoleRoomFeedPostInput } from "./role-room-feed-plan.js";
import {
  buildBrandBasedMockupPlan,
  type RoleRoomMockupSkillRun,
} from "./role-room-agent-mockup-skills.js";
import { ssrfSafeFetch } from "./ssrf-guard.js";

export type ResearchMockupStatus = "building" | "ready" | "failed";
export type ResearchMockupMediaType = "image" | "carousel" | "reel";

export interface ResearchMockupDraft {
  id: string;
  projectId: string;
  researchId: string;
  platform: "instagram" | "tiktok" | "linkedin";
  ordinal: number;
  feedPostId: string;
  mediaType: ResearchMockupMediaType;
  status: ResearchMockupStatus;
  stage: string | null;
  progress: number;
  title: string;
  caption: string;
  previewDataUrl: string | null;
  mockupProjectId: string | null;
  variantId: string | null;
  qualityStatus: "ready" | "limited" | "failed";
  skillRuns: RoleRoomMockupSkillRun[];
}

type DraftRow = {
  id: string;
  workspace_project_id: string;
  research_id: string;
  platform: "instagram" | "tiktok" | "linkedin";
  ordinal: number;
  feed_post_id: string;
  media_type: ResearchMockupMediaType;
  status: ResearchMockupStatus;
  stage: string | null;
  progress: number;
  title: string;
  caption: string;
  preview_data_url: string | null;
  mockup_project_id: string | null;
  variant_id: string | null;
  quality_status: "ready" | "limited" | "failed";
  skill_runs: RoleRoomMockupSkillRun[];
};

const SELECT_DRAFTS = `SELECT id::text, workspace_project_id, research_id::text,
  platform, ordinal, feed_post_id, media_type, status, stage, progress,
  title, caption, preview_data_url, mockup_project_id, variant_id::text,
  quality_status, skill_runs
 FROM role_room_research_mockup_drafts`;

function mapDraft(row: DraftRow): ResearchMockupDraft {
  return {
    id: row.id,
    projectId: row.workspace_project_id,
    researchId: row.research_id,
    platform: row.platform,
    ordinal: Number(row.ordinal),
    feedPostId: row.feed_post_id,
    mediaType: row.media_type,
    status: row.status,
    stage: row.stage,
    progress: Number(row.progress),
    title: row.title,
    caption: row.caption,
    previewDataUrl: row.preview_data_url,
    mockupProjectId: row.mockup_project_id,
    variantId: row.variant_id,
    qualityStatus: row.quality_status || "limited",
    skillRuns: Array.isArray(row.skill_runs) ? row.skill_runs : [],
  };
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const normalized = text(item);
        return normalized ? [normalized] : [];
      })
    : [];
}

function validHex(value: unknown, fallback: string): string {
  const candidate = text(value);
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
}

const MAX_INLINE_LOGO_BYTES = 2 * 1024 * 1024;
const INLINE_LOGO_MIME = /^image\/(?:svg\+xml|png|jpe?g|webp)$/i;

function sanitizeSvgLogo(svg: string): string {
  return svg
    .replace(/<!DOCTYPE\b[^>]*(?:\[[\s\S]*?\]\s*)?>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*(["'])(?!#)[^"']*\1/gi, "");
}

async function readResponseBodyLimited(
  response: Response,
  maxBytes: number,
): Promise<Buffer | undefined> {
  if (!response.body) return undefined;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("brand_logo_too_large").catch(() => undefined);
        return undefined;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    total,
  );
}

function safeLogoBytes(mimeType: string, bytes: Buffer): Buffer | undefined {
  if (!bytes.length || bytes.length > MAX_INLINE_LOGO_BYTES) return undefined;
  if (mimeType === "image/svg+xml") {
    const rawSvg = bytes.toString("utf8");
    if (/<!(?:DOCTYPE|ENTITY)\b/i.test(rawSvg)) return undefined;
    const sanitized = sanitizeSvgLogo(rawSvg);
    return /<svg\b/i.test(sanitized)
      ? Buffer.from(sanitized, "utf8")
      : undefined;
  }
  if (mimeType === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
      ? bytes
      : undefined;
  }
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? bytes
      : undefined;
  }
  if (mimeType === "image/webp") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
      ? bytes
      : undefined;
  }
  return undefined;
}

export async function materializeBrandLogoDataUrl(
  value: unknown,
): Promise<string | undefined> {
  const logoUrl = text(value);
  if (!logoUrl) return undefined;
  const inlineMatch =
    /^data:(image\/(?:svg\+xml|png|jpe?g|webp));base64,([a-z0-9+/=]+)$/i.exec(
      logoUrl,
    );
  if (inlineMatch) {
    const mimeType = inlineMatch[1].toLowerCase();
    const bytes = safeLogoBytes(
      mimeType,
      Buffer.from(inlineMatch[2], "base64"),
    );
    return bytes
      ? `data:${mimeType};base64,${bytes.toString("base64")}`
      : undefined;
  }
  if (!/^https?:\/\//i.test(logoUrl)) return undefined;

  try {
    const response = await ssrfSafeFetch(
      logoUrl,
      {
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "RoleRoomAgent MockupLogo/1.0" },
      },
      4,
    );
    if (!response.ok) return undefined;
    const mimeType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!INLINE_LOGO_MIME.test(mimeType)) return undefined;
    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_INLINE_LOGO_BYTES
    )
      return undefined;
    const downloaded = await readResponseBodyLimited(
      response,
      MAX_INLINE_LOGO_BYTES,
    );
    const safeBytes = downloaded
      ? safeLogoBytes(mimeType, downloaded)
      : undefined;
    if (!safeBytes) return undefined;
    return `data:${mimeType};base64,${safeBytes.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function previewDataUrl(
  title: string,
  subtitle: string,
  bg: string,
  accent: string,
  logoDataUrl?: string,
): string {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char] ?? char,
    );
  const safeTitle = escape(title.slice(0, 72));
  const safeSubtitle = escape(subtitle.slice(0, 110));
  const logo = logoDataUrl?.startsWith("data:image/")
    ? `<image href="${escape(logoDataUrl)}" x="76" y="72" width="190" height="110" preserveAspectRatio="xMinYMid meet"/>`
    : `<rect x="76" y="82" width="166" height="18" rx="9" fill="${accent}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="#080b12"/></linearGradient></defs><rect width="1080" height="1350" rx="54" fill="url(#g)"/><circle cx="920" cy="160" r="240" fill="${accent}" opacity=".24"/>${logo}<text x="76" y="520" fill="#fff" font-family="Arial,sans-serif" font-size="74" font-weight="700"><tspan x="76" dy="0">${safeTitle}</tspan></text><text x="76" y="700" fill="#dbe4ee" font-family="Arial,sans-serif" font-size="34"><tspan x="76" dy="0">${safeSubtitle}</tspan></text><rect x="76" y="1130" width="360" height="92" rx="46" fill="${accent}"/><text x="256" y="1190" text-anchor="middle" fill="#071018" font-family="Arial,sans-serif" font-size="30" font-weight="700">SE UTKAST →</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function initialDrafts(projectName: string) {
  return [
    {
      ordinal: 1,
      mediaType: "image" as const,
      title: `${projectName}: hovedbudskap`,
      caption: "Klargjør budskap, målgruppe og merkevaresignaler.",
    },
    {
      ordinal: 2,
      mediaType: "carousel" as const,
      title: "Forklar verdien steg for steg",
      caption: "Bygger en redigerbar karusell fra dokumenterte funn.",
    },
    {
      ordinal: 3,
      mediaType: "reel" as const,
      title: "Kortformat som skaper tillit",
      caption: "Planlegger en animert reel med tydelig handling.",
    },
  ].map((draft) => ({
    ...draft,
    feedPostId: `role-room-research-post-${draft.ordinal}`,
  }));
}

export async function listResearchMockupDrafts(
  pool: Pool,
  projectId: string,
  researchId: string,
): Promise<ResearchMockupDraft[]> {
  const result = await pool.query<DraftRow>(
    `${SELECT_DRAFTS} WHERE workspace_project_id=$1 AND research_id=$2::uuid ORDER BY ordinal`,
    [projectId, researchId],
  );
  return result.rows.map(mapDraft);
}

export async function initializeResearchMockupDrafts(
  pool: Pool,
  input: {
    projectId: string;
    researchId: string;
    projectName?: string;
    createdByUserId: string;
  },
): Promise<ResearchMockupDraft[]> {
  const projectName = text(input.projectName, "Nytt prosjekt").slice(0, 80);
  for (const draft of initialDrafts(projectName)) {
    await pool.query(
      `INSERT INTO role_room_research_mockup_drafts
        (workspace_project_id,research_id,platform,ordinal,feed_post_id,media_type,
         status,stage,progress,title,caption,preview_data_url,created_by_user_id,updated_at)
       VALUES ($1,$2::uuid,'instagram',$3,$4,$5,'building','starting',4,$6,$7,$8,$9,now())
       ON CONFLICT (workspace_project_id,research_id,platform,ordinal) DO UPDATE SET
         updated_at=role_room_research_mockup_drafts.updated_at`,
      [
        input.projectId,
        input.researchId,
        draft.ordinal,
        draft.feedPostId,
        draft.mediaType,
        draft.title,
        draft.caption,
        previewDataUrl(draft.title, draft.caption, "#172033", "#55d6be"),
        input.createdByUserId,
      ],
    );
  }
  return listResearchMockupDrafts(pool, input.projectId, input.researchId);
}

const STAGE_PROGRESS: Record<string, number> = {
  brreg: 10,
  website: 20,
  googlePlacesBusiness: 28,
  googlePlacesCompetitors: 34,
  webCompetitors: 40,
  googlePlacesLocal: 46,
  competitorAnalysis: 54,
  localPresence: 62,
  merchSuppliers: 69,
  metaPagesEnrichment: 76,
  colorExtraction: 84,
  claudeSynthesis: 90,
  openaiSynthesis: 90,
};

export async function advanceResearchMockupDrafts(
  pool: Pool,
  input: {
    projectId: string;
    researchId: string;
    stage: string;
    completed: boolean;
    preview?: RoleRoomAgentProgressPreview;
  },
): Promise<ResearchMockupDraft[]> {
  const baseline = STAGE_PROGRESS[input.stage] ?? 12;
  const progress = Math.min(94, baseline + (input.completed ? 5 : 0));
  await pool.query(
    `UPDATE role_room_research_mockup_drafts
        SET stage=$3, progress=GREATEST(progress,$4), updated_at=now()
      WHERE workspace_project_id=$1 AND research_id=$2::uuid AND status='building'`,
    [input.projectId, input.researchId, input.stage, progress],
  );
  if (input.completed && input.preview) {
    const ordinal = [
      "brreg",
      "website",
      "googlePlacesBusiness",
      "colorExtraction",
    ].includes(input.stage)
      ? 1
      : [
            "googlePlacesCompetitors",
            "webCompetitors",
            "competitorAnalysis",
            "googlePlacesLocal",
            "localPresence",
          ].includes(input.stage)
        ? 2
        : 3;
    const current = await pool.query<Pick<DraftRow, "title" | "caption">>(
      `SELECT title,caption FROM role_room_research_mockup_drafts
        WHERE workspace_project_id=$1 AND research_id=$2::uuid AND ordinal=$3 LIMIT 1`,
      [input.projectId, input.researchId, ordinal],
    );
    const headline = text(
      input.preview.headline,
      current.rows[0]?.title || "Research-utkast",
    ).slice(0, 200);
    const detail = text(
      input.preview.detail,
      current.rows[0]?.caption || "Datagrunnlaget bygges.",
    );
    const primary = validHex(input.preview.primaryColor, "#172033");
    const accent = validHex(input.preview.accentColor, "#55d6be");
    await pool.query(
      `UPDATE role_room_research_mockup_drafts
          SET title=$4,caption=$5,preview_data_url=$6,updated_at=now()
        WHERE workspace_project_id=$1 AND research_id=$2::uuid AND ordinal=$3 AND status='building'`,
      [
        input.projectId,
        input.researchId,
        ordinal,
        headline,
        detail,
        previewDataUrl(headline, detail, primary, accent),
      ],
    );
  }
  return listResearchMockupDrafts(pool, input.projectId, input.researchId);
}

export async function failResearchMockupDrafts(
  pool: Pool,
  input: { projectId: string; researchId: string },
): Promise<ResearchMockupDraft[]> {
  await pool.query(
    `UPDATE role_room_research_mockup_drafts
        SET status='failed',quality_status='failed',stage='failed',updated_at=now()
      WHERE workspace_project_id=$1 AND research_id=$2::uuid AND status='building'`,
    [input.projectId, input.researchId],
  );
  return listResearchMockupDrafts(pool, input.projectId, input.researchId);
}

function deriveContent(result: RoleRoomAgentNormalizedPayload) {
  const root = result as unknown as Record<string, unknown>;
  const company = record(root.companyProfile);
  const intake = record(root.intakeDraft);
  const planning = record(root.planningDraft);
  const brand = record(planning.brandGuide);
  const colors = Array.isArray(brand.colors) ? brand.colors.map(record) : [];
  const companyName = text(company.companyName, "Merket");
  const offerings = strings(company.offerings);
  const audience = strings(company.targetAudience);
  const keyMessage = text(
    intake.keyMessage,
    text(company.summary, `Oppdag hva ${companyName} kan gjøre for deg.`),
  );
  const primary = validHex(colors[0]?.hex, "#172033");
  const accent = validHex(colors[1]?.hex, "#55d6be");
  const logoUrl = text(brand.logoUrl, text(company.logoUrl));
  const concepts = [
    {
      concept: "product_highlight",
      title: offerings[0] || keyMessage.split(".")[0],
      caption:
        `${keyMessage} ${audience[0] ? `For ${audience[0]}.` : ""}`.trim(),
      cta: "Les mer",
    },
    {
      concept: "educational",
      title: `Slik skaper ${companyName} verdi`,
      caption: `Tre konkrete punkter basert på research om ${companyName}.`,
      cta: "Sveip videre",
    },
    {
      concept: "behind_the_scenes",
      title: `Møt ${companyName}`,
      caption: `Et kortformat som viser kompetanse, mennesker og dokumenterte proof points.`,
      cta: "Se hvordan",
    },
  ];
  return {
    companyName,
    offerings,
    audience,
    keyMessage,
    primary,
    accent,
    logoUrl,
    concepts,
    brand,
  };
}

function mockupDocument(input: {
  id: string;
  name: string;
  projectId: string;
  researchId: string;
  title: string;
  caption: string;
  eyebrow: string;
  callToAction: string;
  primary: string;
  accent: string;
  textColor: string;
  accentTextColor: string;
  mediaType: ResearchMockupMediaType;
  logoUrl: string | null;
  logoPlacement:
    "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  toneOfVoice: string | null;
  visualStyle: string | null;
  qualityStatus: "ready" | "limited" | "failed";
  inputFingerprint: string;
  skillRuns: RoleRoomMockupSkillRun[];
  slide: number;
}) {
  const portrait = input.mediaType === "reel";
  const width = 1080;
  const height = portrait ? 1920 : 1350;
  const now = Date.now();
  const logoPosition = {
    "top-left": { x: 90, y: 70 },
    "top-right": { x: 840, y: 70 },
    "bottom-left": { x: 90, y: height - 190 },
    "bottom-right": { x: 840, y: height - 190 },
    center: { x: 465, y: 70 },
  }[input.logoPlacement];
  const eyebrowY =
    input.logoUrl && ["top-left", "center"].includes(input.logoPlacement)
      ? 260
      : 140;
  const ctaY =
    input.logoUrl && input.logoPlacement.startsWith("bottom-")
      ? Math.round(height * 0.7)
      : Math.round(height * 0.82);
  const textSlot = (
    id: string,
    role: string,
    value: string,
    y: number,
    size: number,
    color: string,
  ) => ({
    id,
    role,
    text: value,
    x: 90,
    y,
    w: 900,
    size,
    weight: role === "title" ? 800 : 500,
    color,
    align: "left",
    lineHeight: role === "title" ? 1.08 : 1.35,
    tracking: role === "eyebrow" ? 3 : 0,
    uppercase: role === "eyebrow",
  });
  return {
    id: input.id,
    name: input.name,
    version: 1,
    template: "role_room_brand_post",
    workspaceProjectId: input.projectId,
    campaignId: input.researchId,
    mockupQualityStatus: input.qualityStatus,
    mockupInputFingerprint: input.inputFingerprint,
    mockupSkillRuns: input.skillRuns,
    brandDecision: {
      primaryColor: input.primary,
      accentColor: input.accent,
      textColor: input.textColor,
      accentTextColor: input.accentTextColor,
      logoPlacement: input.logoPlacement,
      toneOfVoice: input.toneOfVoice,
      visualStyle: input.visualStyle,
    },
    canvas: {
      w: width,
      h: height,
      accent: input.accent,
      accent2: input.primary,
      background: "brand",
      bgStyle: "atmospheric",
      typography: "moderne",
      decor: "orbs",
      bgColor: input.primary,
      ...(input.logoUrl
        ? { logo: { image: input.logoUrl, ...logoPosition, w: 150 } }
        : {}),
    },
    devices: [],
    images: [],
    texts: [
      textSlot(
        `eyebrow-${input.slide}`,
        "eyebrow",
        input.eyebrow,
        eyebrowY,
        28,
        input.accentTextColor,
      ),
      textSlot(
        `title-${input.slide}`,
        "title",
        input.title,
        Math.round(height * 0.28),
        portrait ? 84 : 72,
        input.textColor,
      ),
      textSlot(
        `body-${input.slide}`,
        "body",
        input.caption,
        Math.round(height * 0.57),
        34,
        input.textColor,
      ),
      textSlot(
        `cta-${input.slide}`,
        "tag",
        input.callToAction,
        ctaY,
        30,
        input.accentTextColor,
      ),
    ],
    status: "draft",
    updatedAt: now,
  };
}

async function upsertMockupProject(
  client: PoolClient,
  input: {
    id: string;
    actorId: string;
    workspaceProjectId: string;
    payload: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO demo_studio_mockup_projects
       (id,created_by,name,status,template_id,project_updated_at,payload,updated_at)
     VALUES ($1,$2,$3,'draft',$4,$5,$6::jsonb,now())
     ON CONFLICT (id,created_by) DO UPDATE SET updated_at=demo_studio_mockup_projects.updated_at`,
    [
      input.id,
      input.actorId,
      input.payload.name,
      input.payload.template,
      input.payload.updatedAt,
      JSON.stringify(input.payload),
    ],
  );
  await client.query(
    `INSERT INTO mockup_studio_project_state
       (project_id,created_by,campaign_id,workspace_project_id,revision,updated_at)
     VALUES ($1,$2,$3,$4,1,now())
     ON CONFLICT (project_id,created_by) DO UPDATE SET
       workspace_project_id=COALESCE(mockup_studio_project_state.workspace_project_id,EXCLUDED.workspace_project_id),
       campaign_id=COALESCE(mockup_studio_project_state.campaign_id,EXCLUDED.campaign_id)`,
    [
      input.id,
      input.actorId,
      input.payload.campaignId,
      input.workspaceProjectId,
    ],
  );
}

export async function finalizeResearchMockupDrafts(
  pool: Pool,
  input: {
    projectId: string;
    researchId: string;
    result: RoleRoomAgentNormalizedPayload;
    createdByUserId: string;
  },
): Promise<ResearchMockupDraft[]> {
  const derived = deriveContent(input.result);
  const inlineLogo = await materializeBrandLogoDataUrl(derived.logoUrl);
  const drafts = await listResearchMockupDrafts(
    pool,
    input.projectId,
    input.researchId,
  );
  if (!drafts.length) return [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${input.projectId}::instagram`,
    ]);
    const plan = await client.query<{
      posts: RoleRoomFeedPostInput[];
      brand_snapshot: Record<string, unknown> | null;
    }>(
      `SELECT posts,brand_snapshot FROM role_room_feed_plans WHERE project_id=$1 AND platform='instagram' FOR UPDATE`,
      [input.projectId],
    );
    const existing = Array.isArray(plan.rows[0]?.posts)
      ? plan.rows[0].posts
      : [];
    const byId = new Map(existing.map((post) => [post.id, post]));
    for (const draft of drafts) {
      const content =
        derived.concepts[draft.ordinal - 1] ?? derived.concepts[0];
      const mockupPlan = buildBrandBasedMockupPlan({
        companyName: derived.companyName,
        title: content.title,
        caption: content.caption,
        callToAction: content.cta,
        concept: content.concept,
        mediaType: draft.mediaType,
        slideCount: draft.mediaType === "carousel" ? 3 : 1,
        primaryColor: derived.primary,
        accentColor: derived.accent,
        logoDataUrl: inlineLogo,
        toneOfVoice: text(derived.brand.toneOfVoice) || null,
        visualStyle: text(derived.brand.visualStyle) || null,
        proofPoints: derived.offerings,
        researchId: input.researchId,
      });
      if (mockupPlan.qualityStatus === "failed") {
        throw new Error("mockup_skill_audit_failed");
      }
      const currentPost = byId.get(draft.feedPostId);
      if (
        !currentPost ||
        ["draft", "needs_changes"].includes(
          currentPost.approvalState || "draft",
        )
      ) {
        byId.set(draft.feedPostId, {
          ...currentPost,
          id: draft.feedPostId,
          concept: content.concept,
          title: content.title.slice(0, 200),
          caption: content.caption.slice(0, 2000),
          hashtags: [
            `#${derived.companyName.replace(/[^a-z0-9æøå]/gi, "").toLowerCase()}`,
            "#research",
          ].filter((tag) => tag.length > 1),
          callToAction: content.cta,
          imageStyle: "Merkevaretilpasset research-mockup",
          scheduledFor: currentPost?.scheduledFor ?? null,
          backgroundColor: mockupPlan.primaryColor,
          accentColor: mockupPlan.accentColor,
          textColor: mockupPlan.textColor,
          logoPlacement: mockupPlan.logoPlacement,
          mediaType: draft.mediaType,
          locked: currentPost?.locked ?? false,
          approvalState: currentPost?.approvalState ?? "draft",
        });
      }
      await client.query(
        `UPDATE role_room_feed_mockup_variants SET is_active=false,updated_at=now()
          WHERE workspace_project_id=$1 AND platform='instagram' AND feed_post_id=$2 AND is_active`,
        [input.projectId, draft.feedPostId],
      );
      const variant = await client.query<{ id: string }>(
        `INSERT INTO role_room_feed_mockup_variants
          (workspace_project_id,platform,feed_post_id,variant_key,label,media_type,
           is_active,created_by_user_id,source_research_id,input_fingerprint,
           quality_status,brand_snapshot,skill_runs)
         VALUES ($1,'instagram',$2,$3,$4,$5,true,$6,$7::uuid,$8,$9,$10::jsonb,$11::jsonb)
         ON CONFLICT (workspace_project_id,platform,feed_post_id,variant_key) DO UPDATE SET
           label=EXCLUDED.label, media_type=EXCLUDED.media_type, is_active=true,
           source_research_id=EXCLUDED.source_research_id,
           input_fingerprint=EXCLUDED.input_fingerprint,
           quality_status=EXCLUDED.quality_status,
           brand_snapshot=EXCLUDED.brand_snapshot,
           skill_runs=EXCLUDED.skill_runs,
           updated_at=now()
         RETURNING id::text`,
        [
          input.projectId,
          draft.feedPostId,
          `research-${input.researchId}`,
          `${draft.title} · research`.slice(0, 160),
          draft.mediaType,
          input.createdByUserId,
          input.researchId,
          mockupPlan.inputFingerprint,
          mockupPlan.qualityStatus,
          JSON.stringify({
            companyName: derived.companyName,
            primaryColor: mockupPlan.primaryColor,
            accentColor: mockupPlan.accentColor,
            textColor: mockupPlan.textColor,
            logoUrl: derived.logoUrl || null,
            logoMaterialized: Boolean(mockupPlan.logoDataUrl),
            toneOfVoice: mockupPlan.toneOfVoice,
            visualStyle: mockupPlan.visualStyle,
          }),
          JSON.stringify(mockupPlan.skillRuns),
        ],
      );
      const variantId = variant.rows[0].id;
      const slideCount = mockupPlan.slides.length;
      let firstMockupId = "";
      for (let slide = 1; slide <= slideCount; slide += 1) {
        const compact = input.researchId.replace(/-/g, "").slice(0, 16);
        const mockupId = `rr-${compact}-${draft.ordinal}-${slide}`;
        if (!firstMockupId) firstMockupId = mockupId;
        const slidePlan = mockupPlan.slides[slide - 1];
        const payload = mockupDocument({
          id: mockupId,
          name: `${derived.companyName} · ${draft.title}${slideCount > 1 ? ` · ${slide}/${slideCount}` : ""}`,
          projectId: input.projectId,
          researchId: input.researchId,
          title: slidePlan.title,
          caption: slidePlan.caption,
          eyebrow: slidePlan.eyebrow,
          callToAction: slidePlan.callToAction,
          primary: mockupPlan.primaryColor,
          accent: mockupPlan.accentColor,
          textColor: mockupPlan.textColor,
          accentTextColor: mockupPlan.accentTextColor,
          logoUrl: mockupPlan.logoDataUrl,
          logoPlacement: mockupPlan.logoPlacement,
          toneOfVoice: mockupPlan.toneOfVoice,
          visualStyle: mockupPlan.visualStyle,
          qualityStatus: mockupPlan.qualityStatus,
          inputFingerprint: mockupPlan.inputFingerprint,
          skillRuns: mockupPlan.skillRuns,
          mediaType: draft.mediaType,
          slide,
        });
        await upsertMockupProject(client, {
          id: mockupId,
          actorId: input.createdByUserId,
          workspaceProjectId: input.projectId,
          payload,
        });
        await client.query(
          `INSERT INTO role_room_feed_mockup_links
            (workspace_project_id,platform,feed_post_id,mockup_project_id,mockup_created_by,
             created_by_user_id,variant_id,output_position,sync_status,updated_at)
           VALUES ($1,'instagram',$2,$3,$4,$4,$5::uuid,$6,'not_sent',now())
           ON CONFLICT (variant_id,output_position) DO UPDATE SET updated_at=role_room_feed_mockup_links.updated_at`,
          [
            input.projectId,
            draft.feedPostId,
            mockupId,
            input.createdByUserId,
            variantId,
            slide,
          ],
        );
      }
      await client.query(
        `UPDATE role_room_research_mockup_drafts
            SET title=$4,caption=$5,preview_data_url=$6,mockup_project_id=$7,
                variant_id=$8::uuid,quality_status=$9,skill_runs=$10::jsonb,
                status='ready',stage='finalized',progress=100,updated_at=now()
          WHERE workspace_project_id=$1 AND research_id=$2::uuid AND ordinal=$3`,
        [
          input.projectId,
          input.researchId,
          draft.ordinal,
          content.title.slice(0, 200),
          content.caption,
          previewDataUrl(
            content.title,
            content.caption,
            mockupPlan.primaryColor,
            mockupPlan.accentColor,
            mockupPlan.logoDataUrl || undefined,
          ),
          firstMockupId,
          variantId,
          mockupPlan.qualityStatus,
          JSON.stringify(mockupPlan.skillRuns),
        ],
      );
    }
    await client.query(
      `INSERT INTO role_room_feed_plans (project_id,platform,posts,brand_snapshot,updated_by,updated_at)
       VALUES ($1,'instagram',$2::jsonb,$3::jsonb,$4,now())
       ON CONFLICT (project_id,platform) DO UPDATE SET posts=EXCLUDED.posts,
         brand_snapshot=EXCLUDED.brand_snapshot,updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [
        input.projectId,
        JSON.stringify(Array.from(byId.values())),
        JSON.stringify({
          ...record(plan.rows[0]?.brand_snapshot),
          companyName: derived.companyName,
          logoUrl: derived.logoUrl || null,
          primaryColor: derived.primary,
          secondaryColor: derived.accent,
          accentColor: derived.accent,
          toneOfVoice: text(derived.brand.toneOfVoice) || null,
          visualStyle: text(derived.brand.visualStyle) || null,
        }),
        input.createdByUserId,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return listResearchMockupDrafts(pool, input.projectId, input.researchId);
}

export async function createFeedMockupProject(
  pool: Pool,
  input: {
    projectId: string;
    platform: "instagram" | "tiktok" | "linkedin";
    feedPost: RoleRoomFeedPostInput;
    actorId: string;
    mediaType: ResearchMockupMediaType;
    slideCount?: number;
    label?: string;
    brandSnapshot?: unknown;
  },
) {
  const brandSnapshot = record(input.brandSnapshot);
  const inlineLogo = await materializeBrandLogoDataUrl(
    brandSnapshot.logoDataUrl || brandSnapshot.logoUrl,
  );
  const mockupPlan = buildBrandBasedMockupPlan({
    companyName: text(brandSnapshot.companyName, "Merket"),
    title: input.feedPost.title,
    caption: input.feedPost.caption,
    callToAction: input.feedPost.callToAction,
    concept: input.feedPost.concept,
    mediaType: input.mediaType,
    slideCount: input.slideCount,
    primaryColor:
      input.feedPost.backgroundColor ||
      text(brandSnapshot.primaryColor) ||
      null,
    accentColor:
      input.feedPost.accentColor || text(brandSnapshot.accentColor) || null,
    preferredTextColor: input.feedPost.textColor,
    logoDataUrl: inlineLogo,
    logoPlacement: input.feedPost.logoPlacement,
    toneOfVoice: text(brandSnapshot.toneOfVoice) || null,
    visualStyle: text(brandSnapshot.visualStyle) || null,
    proofPoints: strings(brandSnapshot.proofPoints),
  });
  if (mockupPlan.qualityStatus === "failed") {
    throw new Error("mockup_skill_audit_failed");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `mockup::${input.projectId}::${input.platform}::${input.feedPost.id}`,
    ]);
    const variantKey = crypto
      .createHash("sha256")
      .update(
        `${input.mediaType}:${input.label || "primary"}:${mockupPlan.inputFingerprint}`,
      )
      .digest("hex")
      .slice(0, 20);
    await client.query(
      `UPDATE role_room_feed_mockup_variants SET is_active=false,updated_at=now()
        WHERE workspace_project_id=$1 AND platform=$2 AND feed_post_id=$3 AND is_active`,
      [input.projectId, input.platform, input.feedPost.id],
    );
    const variant = await client.query<{ id: string }>(
      `INSERT INTO role_room_feed_mockup_variants
        (workspace_project_id,platform,feed_post_id,variant_key,label,media_type,
         is_active,created_by_user_id,input_fingerprint,quality_status,brand_snapshot,skill_runs)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10::jsonb,$11::jsonb)
       ON CONFLICT (workspace_project_id,platform,feed_post_id,variant_key) DO UPDATE SET
         is_active=true,input_fingerprint=EXCLUDED.input_fingerprint,
         quality_status=EXCLUDED.quality_status,brand_snapshot=EXCLUDED.brand_snapshot,
         skill_runs=EXCLUDED.skill_runs,updated_at=now()
       RETURNING id::text`,
      [
        input.projectId,
        input.platform,
        input.feedPost.id,
        variantKey,
        text(input.label, `${input.mediaType} variant`),
        input.mediaType,
        input.actorId,
        mockupPlan.inputFingerprint,
        mockupPlan.qualityStatus,
        JSON.stringify({
          companyName: text(brandSnapshot.companyName, "Merket"),
          primaryColor: mockupPlan.primaryColor,
          accentColor: mockupPlan.accentColor,
          textColor: mockupPlan.textColor,
          logoUrl: text(brandSnapshot.logoUrl) || null,
          logoMaterialized: Boolean(mockupPlan.logoDataUrl),
          toneOfVoice: mockupPlan.toneOfVoice,
          visualStyle: mockupPlan.visualStyle,
        }),
        JSON.stringify(mockupPlan.skillRuns),
      ],
    );
    const variantId = variant.rows[0].id;
    const slideCount = mockupPlan.slides.length;
    const links: string[] = [];
    for (let slide = 1; slide <= slideCount; slide += 1) {
      const mockupId = `rr-feed-${variantId.replace(/-/g, "").slice(0, 16)}-${slide}`;
      const slidePlan = mockupPlan.slides[slide - 1];
      const payload = mockupDocument({
        id: mockupId,
        name: `${input.feedPost.title} · ${input.mediaType}${slideCount > 1 ? ` ${slide}/${slideCount}` : ""}`,
        projectId: input.projectId,
        researchId: variantId,
        title: slidePlan.title,
        caption: slidePlan.caption,
        eyebrow: slidePlan.eyebrow,
        callToAction: slidePlan.callToAction,
        primary: mockupPlan.primaryColor,
        accent: mockupPlan.accentColor,
        textColor: mockupPlan.textColor,
        accentTextColor: mockupPlan.accentTextColor,
        logoUrl: mockupPlan.logoDataUrl,
        logoPlacement: mockupPlan.logoPlacement,
        toneOfVoice: mockupPlan.toneOfVoice,
        visualStyle: mockupPlan.visualStyle,
        qualityStatus: mockupPlan.qualityStatus,
        inputFingerprint: mockupPlan.inputFingerprint,
        skillRuns: mockupPlan.skillRuns,
        mediaType: input.mediaType,
        slide,
      });
      await upsertMockupProject(client, {
        id: mockupId,
        actorId: input.actorId,
        workspaceProjectId: input.projectId,
        payload,
      });
      const linked = await client.query<{ id: string }>(
        `INSERT INTO role_room_feed_mockup_links
          (workspace_project_id,platform,feed_post_id,mockup_project_id,mockup_created_by,
           created_by_user_id,variant_id,output_position,sync_status,updated_at)
         VALUES ($1,$2,$3,$4,$5,$5,$6::uuid,$7,'not_sent',now())
         ON CONFLICT (variant_id,output_position) DO UPDATE SET updated_at=role_room_feed_mockup_links.updated_at
         RETURNING id::text`,
        [
          input.projectId,
          input.platform,
          input.feedPost.id,
          mockupId,
          input.actorId,
          variantId,
          slide,
        ],
      );
      links.push(linked.rows[0].id);
    }
    await client.query("COMMIT");
    return {
      variantId,
      mockupProjectId: `rr-feed-${variantId.replace(/-/g, "").slice(0, 16)}-1`,
      linkIds: links,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
