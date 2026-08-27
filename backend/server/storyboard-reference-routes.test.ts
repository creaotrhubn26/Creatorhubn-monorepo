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

describe("storyboard reference create route", () => {
  const storageFileId = "11111111-1111-4111-8111-111111111111";
  const pass = (_req: any, _res: any, next: () => void) => next();

  function createHandler(query: ReturnType<typeof vi.fn>) {
    const router = Router();
    registerStoryboardReferenceRoutes(router, { query } as any, {
      auth: pass,
      canView: pass,
      canManage: pass,
    });
    return routeHandlers(
      router,
      "POST",
      "/projects/:projectId/storyboard-references",
    ).at(-1);
  }

  it("creates a draft reference from an owned file in the same project", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: storageFileId,
            size_bytes: 245_000,
            content_type: "image/jpeg",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "reference-created",
            project_id: "project-other",
            pack_id: "project-production-bible",
            pack_version: "v1",
            entity_type: "location",
            entity_id: "station-hall",
            scene_ids: ["scene-2", "scene-5"],
            name: "Sentralhallen",
            description: "Arkitektur og lysretning",
            reference_image_id: `storage-file:${storageFileId}`,
            approval_status: "draft",
            locked: false,
            metadata: { source: "storyboard_room_upload" },
            created_by: "owner-1",
            approved_by: null,
            approved_at: null,
            created_at: new Date("2026-08-27T00:00:00.000Z"),
            updated_at: new Date("2026-08-27T00:00:00.000Z"),
          },
        ],
      });
    const response = makeResponse();

    await createHandler(query)(
      {
        params: { projectId: "project-other" },
        body: {
          storageFileId,
          name: "Sentralhallen",
          description: "Arkitektur og lysretning",
          entityType: "location",
          entityId: "station-hall",
          sceneIds: ["scene-2", "scene-5", "scene-2"],
        },
        userId: "owner-1",
      },
      response,
    );

    expect(response.statusCode).toBe(201);
    expect(response.body.data.approvalStatus).toBe("draft");
    expect(response.body.data.locked).toBe(false);
    expect(response.body.data.referenceImageId).toBeUndefined();
    expect(response.body.data.imageUrl).toContain("reference-created/image");
    expect(query.mock.calls[0][0]).toContain("user_id = $2");
    expect(query.mock.calls[0][0]).toContain("project_id = $3");
    expect(query.mock.calls[0][1]).toEqual([
      storageFileId,
      "owner-1",
      "project-other",
    ]);
    expect(query.mock.calls[1][0]).toContain("storage_file_id");
    expect(query.mock.calls[1][1][4]).toBe('["scene-2","scene-5"]');
  });

  it("rejects a storage file that is not owned inside the target project", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const response = makeResponse();

    await createHandler(query)(
      {
        params: { projectId: "project-other" },
        body: {
          storageFileId,
          name: "Ugyldig kryssprosjektfil",
          entityType: "prop",
        },
        userId: "owner-1",
      },
      response,
    );

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ error: "storage_file_not_found" });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
