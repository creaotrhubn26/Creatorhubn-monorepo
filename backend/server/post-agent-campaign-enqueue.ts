/**
 * post-agent-campaign-enqueue.ts
 *
 * Post Agent «Kampanje-regissør» → sosial-køen. Appen autentiserer mot
 * /api/post-agent/* (bearer), IKKE mot admin-flaten /api/integrations/* der
 * kø-endepunktene ligger — så vi eksponerer et eget enqueue-endepunkt på
 * post-agent-flaten som resolverer brukerens org og setter postene inn i
 * `social_intel_posts` som `draft` (mennesket godkjenner + publiserer i den
 * eksisterende køen, med opt-in kpi-grid-bilde fra #1541).
 *
 * Køen støtter i praksis LinkedIn + Instagram; kampanjens tiktok/youtube-poster
 * mappes ikke (rapporteres som `skipped`, ikke stille droppet).
 */
import type { Pool } from "pg";

export type QueuePlatform = "linkedin" | "instagram";

// Kampanje-plattform → kø-plattform (null = ikke støttet av køen).
const PLATFORM_MAP: Record<string, QueuePlatform | null> = {
  linkedin: "linkedin",
  feed: "instagram", reels: "instagram", stories: "instagram",
  tiktok: null, youtube: null,
};

export interface ValidEnqueuePost { platform: QueuePlatform; body: string; facts: unknown }

/** Ren validering: `{ posts: [...] }` → gyldige kø-poster + antall hoppet over. */
export function validateEnqueue(raw: unknown): { posts: ValidEnqueuePost[]; skipped: number } {
  const arr = raw && typeof raw === "object" && Array.isArray((raw as { posts?: unknown }).posts)
    ? (raw as { posts: unknown[] }).posts : [];
  const posts: ValidEnqueuePost[] = [];
  let skipped = 0;
  for (const p0 of arr) {
    const p = (p0 && typeof p0 === "object") ? p0 as Record<string, unknown> : {};
    const body = String(p.body ?? "").trim();
    const platform = PLATFORM_MAP[String(p.platform ?? "").toLowerCase()] ?? null;
    if (!body || !platform) { skipped++; continue; }
    posts.push({ platform, body: body.slice(0, 3000), facts: Array.isArray(p.facts) ? p.facts : [] });
  }
  return { posts, skipped };
}

/** Sett kampanje-postene inn i køen som `draft` for organisasjonen. */
export async function enqueueCampaignPosts(
  pool: Pool, organizationId: string, raw: unknown, solution = "theroleroom",
): Promise<{ created: number; skipped: number }> {
  const { posts, skipped } = validateEnqueue(raw);
  let created = 0;
  for (const p of posts) {
    await pool.query(
      `INSERT INTO social_intel_posts (organization_id, solution, platform, body, facts, status)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, 'draft')`,
      [organizationId, solution, p.platform, p.body, JSON.stringify(p.facts)],
    );
    created++;
  }
  return { created, skipped };
}
