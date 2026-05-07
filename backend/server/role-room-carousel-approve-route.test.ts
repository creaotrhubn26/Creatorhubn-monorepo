import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Pool, PoolClient } from "pg";
import { createRoleRoomRouter } from "./role-room-routes.js";

// ─────────────────────────────────────────────────────────
// Programmable mock pool — pattern-matches SQL to a response.
// Keeps a transcript so tests can assert which queries ran.
// ─────────────────────────────────────────────────────────

type QueryResponder = (sql: string, params: unknown[]) => { rows: unknown[]; rowCount: number };

interface MockPool {
  pool: Pool;
  setResponder(matcher: RegExp, responder: QueryResponder): void;
  transcript: Array<{ sql: string; params: unknown[] }>;
}

function makeMockPool(): MockPool {
  const responders: Array<{ matcher: RegExp; responder: QueryResponder }> = [];
  const transcript: Array<{ sql: string; params: unknown[] }> = [];

  function runQuery(sql: string, params: unknown[] = []) {
    transcript.push({ sql, params });
    for (const { matcher, responder } of responders) {
      if (matcher.test(sql)) return responder(sql, params);
    }
    return { rows: [], rowCount: 0 };
  }

  const client: Partial<PoolClient> = {
    query: (async (sql: string, params?: unknown[]) =>
      runQuery(sql, params ?? [])) as PoolClient["query"],
    release: () => undefined,
  };

  const pool = {
    query: (async (sql: string, params?: unknown[]) =>
      runQuery(sql, params ?? [])) as Pool["query"],
    connect: (async () => client as PoolClient) as Pool["connect"],
  } as unknown as Pool;

  return {
    pool,
    setResponder(matcher, responder) {
      responders.unshift({ matcher, responder });
    },
    transcript,
  };
}

function makeApp(pool: Pool) {
  const app = express();
  app.use(express.json());
  app.use("/api/role-room", createRoleRoomRouter(pool));
  return app;
}

const POST_ID = "11111111-1111-1111-1111-111111111111";
const DRAFT_ID = "22222222-2222-2222-2222-222222222222";
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const USER_ID = "alice";

const validCaption = {
  instagram: "Caption for IG",
  facebook: "Caption for FB",
  linkedin: "Caption for LI",
  pinterest: "Pin title",
  youtube: "Question for YT?",
};

const dbPostRow = {
  id: POST_ID,
  draft_id: DRAFT_ID,
  day_of_week: 0,
  format: "humor",
  primary_platform: "instagram",
  hook: "Production Life",
  narrative: "Setup → reveal.",
  caption: validCaption,
  scheduled_at: null,
  status: "draft",
};

function dbSlideRow(i: number) {
  return {
    id: `slide-${i + 1}`,
    post_id: POST_ID,
    slide_index: i,
    image_ref: { strategy: "stock", url: `https://x/${i}.jpg` },
    text_blocks: [{ position: "top-left", style: "headline", content: `Slide ${i + 1}` }],
    brand_overlays: { brandName: "Holy Crust", primaryColor: "#8b3a1f", accentColor: "#f4e8d0" },
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe("POST /carousel/posts/:postId/approve-and-publish", () => {
  let mock: MockPool;

  beforeEach(() => {
    mock = makeMockPool();
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await request(makeApp(mock.pool))
      .post(`/api/role-room/carousel/posts/${POST_ID}/approve-and-publish`)
      .set("x-user-id", USER_ID)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_input");
  });

  it("returns 404 when assertPostOwnership finds no row", async () => {
    mock.setResponder(/SELECT 1 FROM carousel_posts/i, () => ({ rows: [], rowCount: 0 }));
    const res = await request(makeApp(mock.pool))
      .post(`/api/role-room/carousel/posts/${POST_ID}/approve-and-publish`)
      .set("x-user-id", USER_ID)
      .send({ projectId: PROJECT_ID });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("post_not_found");
  });

  it("returns 422 when publisher rejects validation (empty caption)", async () => {
    mock.setResponder(/SELECT 1 FROM carousel_posts/i, () => ({
      rows: [{ "?column?": 1 }],
      rowCount: 1,
    }));
    mock.setResponder(/SELECT \* FROM carousel_posts WHERE id/i, () => ({
      rows: [{ ...dbPostRow, caption: { ...validCaption, instagram: "" } }],
      rowCount: 1,
    }));
    mock.setResponder(/SELECT \* FROM carousel_slides/i, () => ({
      rows: [dbSlideRow(0), dbSlideRow(1)],
      rowCount: 2,
    }));

    const res = await request(makeApp(mock.pool))
      .post(`/api/role-room/carousel/posts/${POST_ID}/approve-and-publish`)
      .set("x-user-id", USER_ID)
      .send({ projectId: PROJECT_ID });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("validation_failed");
    expect(res.body.errors).toBeInstanceOf(Array);
    expect(res.body.errors.some((e: string) => /Caption .* empty/.test(e))).toBe(true);
  });

  it("publishes successfully and recounts draft approvals", async () => {
    mock.setResponder(/SELECT 1 FROM carousel_posts/i, () => ({
      rows: [{ "?column?": 1 }],
      rowCount: 1,
    }));
    mock.setResponder(/SELECT \* FROM carousel_posts WHERE id/i, () => ({
      rows: [dbPostRow],
      rowCount: 1,
    }));
    mock.setResponder(/SELECT \* FROM carousel_slides/i, () => ({
      rows: [dbSlideRow(0), dbSlideRow(1), dbSlideRow(2), dbSlideRow(3)],
      rowCount: 4,
    }));
    // No existing feed_plan → publisher takes the INSERT branch
    mock.setResponder(/SELECT id FROM role_room_feed_plans/i, () => ({
      rows: [],
      rowCount: 0,
    }));
    mock.setResponder(/INSERT INTO role_room_feed_plans/i, () => ({
      rows: [{ id: "feed-plan-new" }],
      rowCount: 1,
    }));
    // BEGIN / COMMIT / UPDATE inside transaction
    mock.setResponder(/^BEGIN$/i, () => ({ rows: [], rowCount: 0 }));
    mock.setResponder(/^COMMIT$/i, () => ({ rows: [], rowCount: 0 }));
    mock.setResponder(/UPDATE carousel_posts/i, () => ({ rows: [], rowCount: 1 }));
    mock.setResponder(/UPDATE carousel_drafts/i, () => ({ rows: [], rowCount: 1 }));

    const res = await request(makeApp(mock.pool))
      .post(`/api/role-room/carousel/posts/${POST_ID}/approve-and-publish`)
      .set("x-user-id", USER_ID)
      .send({ projectId: PROJECT_ID });

    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({
      feedPlanId: "feed-plan-new",
      platform: "instagram",
      validationWarnings: expect.any(Array),
    });
    expect(res.body.result.feedPlanPostId).toEqual(expect.any(String));
    expect(res.body.result.insertedAt).toEqual(expect.any(String));

    // Verify the draft approved_post_count UPDATE actually fired
    expect(
      mock.transcript.some((t) => /UPDATE carousel_drafts/i.test(t.sql)),
    ).toBe(true);
  });
});
