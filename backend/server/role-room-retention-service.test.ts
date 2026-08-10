import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  b2KeyFromMediaUrl,
  partitionMediaUrls,
  resolveRetentionDays,
  runRetentionSweep,
  RETENTION_CATEGORIES,
  type RetentionPolicyRow,
} from "./role-room-retention-service.js";

const platform = (category: string, days: number, enabled = true): RetentionPolicyRow => ({
  scope_type: "platform",
  scope_ref: null,
  category,
  retention_days: days,
  enabled,
});

const project = (
  category: string,
  ref: string,
  days: number,
  enabled = true,
): RetentionPolicyRow => ({
  scope_type: "project",
  scope_ref: ref,
  category,
  retention_days: days,
  enabled,
});

describe("resolveRetentionDays", () => {
  it("bruker plattform-defaulten når prosjektet ikke har egen policy", () => {
    const policies = [platform("expired_consent_media", 30)];
    expect(resolveRetentionDays(policies, "proj-1", "expired_consent_media")).toBe(30);
  });

  it("lar prosjekt-overstyring vinne over plattform-defaulten", () => {
    const policies = [
      platform("expired_consent_media", 30),
      project("expired_consent_media", "proj-1", 90),
    ];
    expect(resolveRetentionDays(policies, "proj-1", "expired_consent_media")).toBe(90);
    // Andre prosjekter påvirkes ikke.
    expect(resolveRetentionDays(policies, "proj-2", "expired_consent_media")).toBe(30);
  });

  it("lar et prosjekt slå AV feiingen uten å røre plattformraden", () => {
    const policies = [
      platform("expired_consent_media", 30),
      project("expired_consent_media", "proj-1", 30, false),
    ];
    expect(resolveRetentionDays(policies, "proj-1", "expired_consent_media")).toBeNull();
    expect(resolveRetentionDays(policies, "proj-2", "expired_consent_media")).toBe(30);
  });

  it("returnerer null når kategorien mangler policy", () => {
    expect(resolveRetentionDays([], "proj-1", "rejected_candidate_media")).toBeNull();
  });

  it("returnerer null når plattformpolicyen er deaktivert", () => {
    expect(
      resolveRetentionDays([platform("rejected_candidate_media", 90, false)], null, "rejected_candidate_media"),
    ).toBeNull();
  });

  it("blander ikke kategorier", () => {
    const policies = [platform("expired_consent_media", 30)];
    expect(resolveRetentionDays(policies, null, "closed_project_candidates")).toBeNull();
  });
});

describe("b2KeyFromMediaUrl", () => {
  const env = {
    B2_PUBLIC_BASE: "https://media.theroleroom.com",
    B2_ROLE_ROOM_BUCKET_NAME: "roleroom-prod",
  } as unknown as NodeJS.ProcessEnv;

  it("henter nøkkelen ut av en offentlig base-URL", () => {
    expect(b2KeyFromMediaUrl("https://media.theroleroom.com/users/u1/photo.jpg", env)).toBe(
      "users/u1/photo.jpg",
    );
  });

  it("tåler etterslepende skråstrek i base-en", () => {
    const withSlash = { ...env, B2_PUBLIC_BASE: "https://media.theroleroom.com/" };
    expect(b2KeyFromMediaUrl("https://media.theroleroom.com/users/u1/a.jpg", withSlash)).toBe(
      "users/u1/a.jpg",
    );
  });

  it("stripper query-parametre (signerte URL-er)", () => {
    expect(
      b2KeyFromMediaUrl("https://media.theroleroom.com/users/u1/a.jpg?X-Amz-Signature=abc", env),
    ).toBe("users/u1/a.jpg");
  });

  it("dekoder prosentkoding i nøkkelen", () => {
    expect(b2KeyFromMediaUrl("https://media.theroleroom.com/users/u1/bilde%201.jpg", env)).toBe(
      "users/u1/bilde 1.jpg",
    );
  });

  it("gjenkjenner S3-endepunkt-formen", () => {
    expect(
      b2KeyFromMediaUrl(
        "https://s3.eu-central-003.backblazeb2.com/roleroom-prod/users/u1/clip.mp4",
        env,
      ),
    ).toBe("users/u1/clip.mp4");
  });

  it("returnerer null for eksterne URL-er vi ikke eier", () => {
    expect(b2KeyFromMediaUrl("https://vimeo.com/12345", env)).toBeNull();
    // Annen bucket på samme endepunkt er ikke vår.
    expect(
      b2KeyFromMediaUrl("https://s3.eu-central-003.backblazeb2.com/annen-bucket/x.jpg", env),
    ).toBeNull();
  });

  it("returnerer null når ingen base er konfigurert", () => {
    expect(b2KeyFromMediaUrl("https://media.theroleroom.com/a.jpg", {} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("håndterer tomme og ugyldige verdier", () => {
    expect(b2KeyFromMediaUrl("", env)).toBeNull();
    expect(b2KeyFromMediaUrl(null as unknown as string, env)).toBeNull();
  });
});

describe("partitionMediaUrls", () => {
  const env = { B2_PUBLIC_BASE: "https://media.theroleroom.com" } as unknown as NodeJS.ProcessEnv;

  it("skiller våre egne nøkler fra eksterne referanser", () => {
    const out = partitionMediaUrls(
      [
        "https://media.theroleroom.com/users/u1/a.jpg",
        "https://vimeo.com/123",
        "https://media.theroleroom.com/users/u1/b.jpg",
      ],
      env,
    );
    expect(out.keys).toEqual(["users/u1/a.jpg", "users/u1/b.jpg"]);
    expect(out.externalCount).toBe(1);
  });

  it("takler objektform {url}", () => {
    const out = partitionMediaUrls([{ url: "https://media.theroleroom.com/users/u1/a.jpg" }], env);
    expect(out.keys).toEqual(["users/u1/a.jpg"]);
  });

  it("returnerer tomt for ikke-lister", () => {
    expect(partitionMediaUrls(null, env)).toEqual({ keys: [], externalCount: 0 });
    expect(partitionMediaUrls("ikke en liste", env)).toEqual({ keys: [], externalCount: 0 });
  });
});

// ── Feiingens sikkerhetsgarantier ───────────────────────────────────────────

/** Pool-stub som svarer på policy-oppslaget og ellers returnerer tomt. */
function stubPool(policies: RetentionPolicyRow[], rows: Record<string, unknown>[] = []) {
  const connect = vi.fn();
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM role_room_retention_policies")) {
      return { rows: policies, rowCount: policies.length };
    }
    return { rows, rowCount: rows.length };
  });
  return { pool: { query, connect } as unknown as Pool, query, connect };
}

describe("runRetentionSweep", () => {
  it("er tørrkjøring som standard — ingen tilkobling åpnes for skriving", async () => {
    const { pool, connect } = stubPool(
      [platform("expired_consent_media", 30)],
      [{ id: "cand-1", project_id: "proj-1", photos: [], videos: [], anchor_at: new Date() }],
    );

    const result = await runRetentionSweep(pool, { env: {} as NodeJS.ProcessEnv });

    expect(result.dryRun).toBe(true);
    // Ingen BEGIN/UPDATE — feiingen skal ikke røre data uten enforce.
    expect(connect).not.toHaveBeenCalled();
  });

  it("respekterer RR_RETENTION_ENFORCE fra miljøet", async () => {
    const { pool } = stubPool([platform("expired_consent_media", 30)]);
    const result = await runRetentionSweep(pool, {
      env: { RR_RETENTION_ENFORCE: "true" } as unknown as NodeJS.ProcessEnv,
    });
    expect(result.dryRun).toBe(false);
  });

  it("hopper over kategorier uten aktiv policy", async () => {
    const { pool } = stubPool([]);
    const result = await runRetentionSweep(pool, { env: {} as NodeJS.ProcessEnv });

    expect(result.categories).toHaveLength(RETENTION_CATEGORIES.length);
    for (const c of result.categories) {
      expect(c.skippedReason).toBe("ingen aktiv policy");
      expect(c.rowsAffected).toBe(0);
    }
  });

  it("feier bare kategoriene den blir bedt om", async () => {
    const { pool } = stubPool([platform("expired_selftape_links", 7)]);
    const result = await runRetentionSweep(pool, {
      categories: ["expired_selftape_links"],
      env: {} as NodeJS.ProcessEnv,
    });
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].category).toBe("expired_selftape_links");
  });

  it("lar én feilende kategori ikke velte hele kjøringen", async () => {
    const connect = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM role_room_retention_policies")) {
        return {
          rows: [platform("expired_consent_media", 30), platform("expired_selftape_links", 7)],
          rowCount: 2,
        };
      }
      if (sql.includes("casting_candidates")) throw new Error("tabellen mangler");
      return { rows: [], rowCount: 0 };
    });
    const pool = { query, connect } as unknown as Pool;

    const result = await runRetentionSweep(pool, { env: {} as NodeJS.ProcessEnv });

    const failed = result.categories.find((c) => c.category === "expired_consent_media");
    const ok = result.categories.find((c) => c.category === "expired_selftape_links");
    expect(failed?.skippedReason).toContain("feilet");
    expect(ok?.skippedReason).toBeUndefined();
  });

  it("gir hver kjøring en egen runId", async () => {
    const { pool } = stubPool([]);
    const a = await runRetentionSweep(pool, { env: {} as NodeJS.ProcessEnv });
    const b = await runRetentionSweep(pool, { env: {} as NodeJS.ProcessEnv });
    expect(a.runId).not.toBe(b.runId);
  });
});
