/**
 * social-queue.ts — synlighets-sløyfen del 2: godkjennings-køen
 *
 * Stabilitet som design:
 *  - LOVLIGE overganger håndheves i kode: draft → approved|rejected;
 *    approved → published|failed. Alt annet avvises.
 *  - Publisering skjer KUN via den eksisterende dispatcheren
 *    (social-publisher.ts) — vi bygger aldri publisering to ganger.
 *    Uten connectionId → 'manual'-flyt (kopier + marker publisert).
 *  - Hver publisering logges AUTOMATISK i geo_experiments — sløyfen
 *    lukkes: neste GEO-måling viser om posten flyttet synligheten.
 */

import type { Pool } from "pg";
import { composeSocialDrafts } from "./content-composer.js";
import type { SolutionKey } from "./grant-application.js";
import { addExperiment } from "./geo-experiments.js";
import { dispatchPublish } from "../social-publisher.js";
import { verifyLinkedInIdentity } from "../social-publisher-linkedin.js";

export type PostStatus = "draft" | "approved" | "published" | "failed" | "rejected";

/** Lovlige status-overganger — alt annet er en feil, ikke en oppdatering. */
const LEGAL_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ["approved", "rejected"],
  approved: ["published", "failed", "rejected"],
  published: [],
  failed: ["approved"], // retry etter feil krever ny menneskelig godkjenning? Nei — approved→failed→approved er ett trykk
  rejected: [],
};

export function isLegalTransition(from: PostStatus, to: PostStatus): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

const SOLUTION_TOPIC: Record<SolutionKey, string> = {
  theroleroom: "The Role Room",
  creatorhub: "CreatorHub",
  leadgrid: "Leadgrid",
};

export async function composeToQueue(
  pool: Pool,
  organizationId: string,
  solution: SolutionKey,
  angle?: string,
): Promise<{ created: Array<{ id: string; platform: string }> } | { error: string; status: number }> {
  const result = await composeSocialDrafts(pool, organizationId, solution, angle);
  if ("error" in result) return result;

  const created: Array<{ id: string; platform: string }> = [];
  for (const [platform, body] of [
    ["linkedin", result.drafts.linkedin],
    ["instagram", result.drafts.instagram],
  ] as const) {
    const r = await pool.query<{ id: string }>(
      `INSERT INTO social_intel_posts (organization_id, solution, platform, body, facts)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb) RETURNING id::text`,
      [organizationId, solution, platform, body, JSON.stringify(result.drafts.facts)],
    );
    created.push({ id: r.rows[0].id, platform });
  }
  return { created };
}

export interface QueuedPost {
  id: string;
  solution: string;
  platform: string;
  body: string;
  status: PostStatus;
  external_url: string | null;
  error: string | null;
  created_at: string;
}

export async function listQueue(pool: Pool, organizationId: string): Promise<QueuedPost[]> {
  const r = await pool.query<QueuedPost>(
    `SELECT id::text, solution, platform, body, status, external_url, error, created_at::text
       FROM social_intel_posts WHERE organization_id = $1::uuid
      ORDER BY created_at DESC LIMIT 40`,
    [organizationId],
  );
  return r.rows;
}

/**
 * Ett-klikks publisering via den EKSISTERENDE dispatcheren (LinkedIn
 * ugcPosts m.fl.) — aldri publisering bygget to ganger. Kun approved
 * poster; resultatet skrives tilbake som published/failed med ærlig
 * feilmelding (inkl. «koble LinkedIn på nytt» fra publisheren selv).
 */
/** Broen: verifiser identiteten publiseringen vil skje som. */
export async function verifyPublishIdentity(
  pool: Pool,
  userId: string,
): Promise<
  | { ok: true; name: string | null; memberId: string; scopes: string[] }
  | { ok: false; reason: string }
> {
  return verifyLinkedInIdentity(pool, userId);
}

export async function publishViaDispatcher(
  pool: Pool,
  organizationId: string,
  postId: string,
  userId: string,
  /** Broens kvittering: klienten MÅ sende memberId fra fersk verifisering. */
  verifiedMemberId: string,
): Promise<{ ok: true; permalink: string | null } | { error: string; status: number }> {
  // Verifiser PÅ NYTT server-side — klient-påstand er ikke nok
  const identity = await verifyLinkedInIdentity(pool, userId);
  if (!identity.ok) {
    return { error: `verifisering_feilet_${identity.reason}`, status: 401 };
  }
  if (identity.memberId !== verifiedMemberId) {
    return { error: "verifisert_identitet_matcher_ikke", status: 409 };
  }
  const current = await pool.query<{ status: PostStatus; platform: string; body: string }>(
    `SELECT status, platform, body FROM social_intel_posts
      WHERE id = $1::uuid AND organization_id = $2::uuid`,
    [postId, organizationId],
  );
  if (current.rows.length === 0) return { error: "post_ikke_funnet", status: 404 };
  const post = current.rows[0];
  if (post.status !== "approved") return { error: "kun_godkjente_poster_kan_publiseres", status: 409 };
  if (post.platform !== "linkedin") {
    return { error: "dispatcher_publisering_stotter_forelopig_kun_linkedin", status: 400 };
  }

  const result = await dispatchPublish("linkedin", {
    connectionId: userId, // LinkedIn: connectionId = userId (én kobling per bruker)
    userId,
    projectId: "market-intelligence",
    mediaKind: "text",
    caption: post.body,
  });

  if (!result.ok) {
    await transitionPost(pool, organizationId, postId, "failed", {
      error: result.error ?? result.reason ?? "ukjent publiseringsfeil",
    });
    return { error: result.error ?? "publisering_feilet", status: 502 };
  }

  const permalink = result.permalink ?? null;
  await transitionPost(pool, organizationId, postId, "published", {
    externalUrl: permalink ?? undefined,
  });
  return { ok: true, permalink };
}

/**
 * Broen til Marketing Cockpit: godkjent kø-post → marketing_post_drafts
 * (PostDraftsPanel gir redigering, publisering og autopublish-scheduler
 * — produksjonsmaskineriet som allerede finnes). source_insight bærer
 * faktagrunnlaget videre, så cockpiten VET hvor tallene kommer fra.
 */
const SOLUTION_BRAND_KEY: Record<string, string> = {
  theroleroom: "theroleroom",
  creatorhub: "creatorhub",
  leadgrid: "leadgrid",
};

export async function sendToCockpit(
  pool: Pool,
  organizationId: string,
  postId: string,
): Promise<{ ok: true; draftId: string } | { error: string; status: number }> {
  const current = await pool.query<{
    status: PostStatus; platform: string; body: string; solution: string; facts: unknown;
  }>(
    `SELECT status, platform, body, solution, facts FROM social_intel_posts
      WHERE id = $1::uuid AND organization_id = $2::uuid`,
    [postId, organizationId],
  );
  if (current.rows.length === 0) return { error: "post_ikke_funnet", status: 404 };
  const post = current.rows[0];
  if (post.status !== "approved") return { error: "kun_godkjente_poster_kan_sendes", status: 409 };

  const factsArr = Array.isArray(post.facts) ? (post.facts as Array<{ source?: string; label?: string }>) : [];
  const sourceSummary = factsArr
    .slice(0, 4)
    .map((f) => `${f.source ?? "?"}: ${f.label ?? "?"}`)
    .join(" · ");

  const r = await pool.query<{ id: string }>(
    `INSERT INTO marketing_post_drafts
       (brand_key, platform, status, source_insight, caption, generated_with_model)
     VALUES ($1, $2, 'draft', $3, $4, 'market-intelligence-queue')
     RETURNING id::text`,
    [
      SOLUTION_BRAND_KEY[post.solution] ?? post.solution,
      post.platform,
      `Markedsintelligens (tall-validert): ${sourceSummary}`.slice(0, 500),
      post.body,
    ],
  );
  const draftId = r.rows[0].id;
  await pool.query(
    `UPDATE social_intel_posts SET external_id = $3
      WHERE id = $1::uuid AND organization_id = $2::uuid`,
    [postId, organizationId, `cockpit-draft-${draftId}`],
  );
  return { ok: true, draftId };
}

export async function transitionPost(
  pool: Pool,
  organizationId: string,
  postId: string,
  to: PostStatus,
  patch: { body?: string; externalUrl?: string; error?: string } = {},
): Promise<{ ok: true } | { error: string; status: number }> {
  const current = await pool.query<{ status: PostStatus; solution: SolutionKey; body: string }>(
    `SELECT status, solution, body FROM social_intel_posts
      WHERE id = $1::uuid AND organization_id = $2::uuid`,
    [postId, organizationId],
  );
  if (current.rows.length === 0) return { error: "post_ikke_funnet", status: 404 };
  const from = current.rows[0].status;
  if (!isLegalTransition(from, to)) {
    return { error: `ulovlig_overgang_${from}_til_${to}`, status: 409 };
  }

  await pool.query(
    `UPDATE social_intel_posts
        SET status = $3,
            body = COALESCE($4, body),
            external_url = COALESCE($5, external_url),
            error = $6,
            approved_at = CASE WHEN $3 = 'approved' THEN now() ELSE approved_at END,
            published_at = CASE WHEN $3 = 'published' THEN now() ELSE published_at END
      WHERE id = $1::uuid AND organization_id = $2::uuid`,
    [postId, organizationId, to, patch.body ?? null, patch.externalUrl ?? null, patch.error ?? null],
  );

  // Sløyfe-lukkeren: publisert innhold ER et GEO-eksperiment
  if (to === "published") {
    try {
      await addExperiment(pool, organizationId, {
        experimentDate: new Date().toISOString().slice(0, 10),
        description: `Sosial post publisert: ${current.rows[0].body.slice(0, 120)}`,
        topic: SOLUTION_TOPIC[current.rows[0].solution],
        url: patch.externalUrl,
      });
    } catch (err) {
      console.warn("[social-queue] eksperimentlogging feilet (best effort):", String(err).slice(0, 100));
    }
  }
  return { ok: true };
}
