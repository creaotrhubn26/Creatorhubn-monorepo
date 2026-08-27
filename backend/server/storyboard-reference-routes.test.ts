import { Router } from "express";
import { describe, expect, it, vi } from "vitest";
import { registerStoryboardReferenceRoutes } from "./storyboard-reference-routes.js";

function routeHandlers(router: Router, method: string, path: string): any[] {
  const layer = (router as any).stack.find(
    (candidate: any) =>
      candidate.route &&
      candidate.route.path === path &&
      candidate.route.methods[method.toLowerCase()],
  );
  return layer?.route?.stack.map((candidate: any) => candidate.handle) ?? [];
}

function makeResponse() {
  const response: any = {
    statusCode: 200,
    body: undefined,
    headersSent: false,
    writableEnded: false,
  };
  response.status = (statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (body: unknown) => {
    response.body = body;
    return response;
  };
  return response;
}

describe("storyboard reference review route", () => {
  it("casts every reused PostgreSQL parameter before approving a reference", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "reference-1",
          project_id: "project-1",
          pack_id: "troll-production-bible",
          pack_version: "v1",
          entity_type: "character",
          entity_id: "nora",
          scene_ids: [],
          name: "Nora",
          description: "Continuity reference",
          reference_image_id: "builtin://troll/v1/nora-character-wardrobe",
          approval_status: "approved",
          locked: true,
          metadata: {},
          created_by: "owner-1",
          approved_by: "owner-1",
          approved_at: new Date("2026-08-27T00:00:00.000Z"),
          created_at: new Date("2026-08-27T00:00:00.000Z"),
          updated_at: new Date("2026-08-27T00:00:00.000Z"),
        },
      ],
    });
    const router = Router();
    const pass = (_req: any, _res: any, next: () => void) => next();
    registerStoryboardReferenceRoutes(router, { query } as any, {
      auth: pass,
      canView: pass,
      canManage: pass,
    });
    const handler = routeHandlers(
      router,
      "PATCH",
      "/projects/:projectId/storyboard-references/:assetId",
    ).at(-1);
    const response = makeResponse();

    await handler(
      {
        params: { projectId: "project-1", assetId: "reference-1" },
        body: { approvalStatus: "approved", locked: true },
        userId: "owner-1",
      },
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.data.approvalStatus).toBe("approved");
    expect(response.body.data.locked).toBe(true);
    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("approval_status = $1::varchar");
    expect(sql).toContain("locked = $2::boolean");
    expect(sql).toContain("THEN $3::varchar");
    expect(sql).toContain("id = $4::varchar");
    expect(sql).toContain("project_id = $5::varchar");
    expect(values).toEqual([
      "approved",
      true,
      "owner-1",
      "reference-1",
      "project-1",
    ]);
  });
});
