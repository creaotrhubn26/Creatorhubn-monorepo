import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import { deleteProductionSoundMedia } from "./casting-production-sound-s3.js";

const MEDIA_ID = "8b49da36-ff43-4d8f-98dc-20ce0e39218d";
const OBJECT_ID = "9281527f-d802-4624-9cf2-3005ef7f6433";

function transactionPool(row?: {
  reconciliation_status: "unmatched" | "matched";
  storage_status: string;
  storage_owner_user_id: string | null;
}) {
  const clientQuery = vi.fn(async (text: string) => {
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text)) {
      return { rows: [], rowCount: 0 };
    }
    if (text.includes("FROM casting_production_sound_media media")) {
      return {
        rows: row ? [{ storage_object_id: OBJECT_ID, ...row }] : [],
        rowCount: row ? 1 : 0,
      };
    }
    if (text.startsWith("UPDATE casting_production_sound_media")) {
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected transaction SQL: ${text}`);
  });
  const client = { query: clientQuery, release: vi.fn() };
  const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
  return {
    pool: {
      connect: vi.fn(async () => client),
      query,
    } as unknown as Pool,
    client,
    clientQuery,
    query,
  };
}

describe("Production Sound media deletion", () => {
  it("locks the scoped unmatched row, deletes S3 and soft-deletes metadata", async () => {
    const state = transactionPool({
      reconciliation_status: "unmatched",
      storage_status: "active",
      storage_owner_user_id: "sound-mixer-1",
    });
    const deleteStorageObject = vi.fn(async () => true);

    await expect(
      deleteProductionSoundMedia(
        state.pool,
        {
          mediaId: MEDIA_ID,
          projectId: "project-1",
          productionDayId: "day-1",
        },
        {
          deleteStorageObject,
          storageDeps: { storage: {} as never },
        },
      ),
    ).resolves.toBe(true);

    expect(deleteStorageObject).toHaveBeenCalledWith(
      state.pool,
      OBJECT_ID,
      "sound-mixer-1",
      expect.anything(),
      state.client,
    );
    expect(
      state.clientQuery.mock.calls.some(([sql]) =>
        String(sql).includes("FOR UPDATE OF media"),
      ),
    ).toBe(true);
    expect(
      state.clientQuery.mock.calls.some(([sql]) =>
        String(sql).startsWith("UPDATE casting_production_sound_media"),
      ),
    ).toBe(true);
    expect(state.clientQuery.mock.calls.map(([sql]) => sql)).toContain(
      "COMMIT",
    );
    expect(state.client.release).toHaveBeenCalledOnce();
  });

  it("refuses to delete a reconciled file and rolls back without touching S3", async () => {
    const state = transactionPool({
      reconciliation_status: "matched",
      storage_status: "active",
      storage_owner_user_id: "sound-mixer-1",
    });
    const deleteStorageObject = vi.fn(async () => true);

    await expect(
      deleteProductionSoundMedia(
        state.pool,
        {
          mediaId: MEDIA_ID,
          projectId: "project-1",
          productionDayId: "day-1",
        },
        {
          deleteStorageObject,
          storageDeps: { storage: {} as never },
        },
      ),
    ).rejects.toThrow("media_reconciled");

    expect(deleteStorageObject).not.toHaveBeenCalled();
    expect(state.clientQuery.mock.calls.map(([sql]) => sql)).toContain(
      "ROLLBACK",
    );
  });

  it("does not reveal or delete a media id outside the requested project/day", async () => {
    const state = transactionPool();
    const deleteStorageObject = vi.fn(async () => true);

    await expect(
      deleteProductionSoundMedia(
        state.pool,
        {
          mediaId: MEDIA_ID,
          projectId: "wrong-project",
          productionDayId: "wrong-day",
        },
        {
          deleteStorageObject,
          storageDeps: { storage: {} as never },
        },
      ),
    ).resolves.toBe(false);

    expect(deleteStorageObject).not.toHaveBeenCalled();
    expect(state.clientQuery.mock.calls.map(([sql]) => sql)).toContain(
      "ROLLBACK",
    );
  });

  it("finishes metadata cleanup after a prior S3 deletion already succeeded", async () => {
    const state = transactionPool({
      reconciliation_status: "unmatched",
      storage_status: "deleted",
      storage_owner_user_id: "sound-mixer-1",
    });
    const deleteStorageObject = vi.fn(async () => true);

    await expect(
      deleteProductionSoundMedia(
        state.pool,
        {
          mediaId: MEDIA_ID,
          projectId: "project-1",
          productionDayId: "day-1",
        },
        {
          deleteStorageObject,
          storageDeps: { storage: {} as never },
        },
      ),
    ).resolves.toBe(true);

    expect(deleteStorageObject).not.toHaveBeenCalled();
    expect(
      state.clientQuery.mock.calls.some(([sql]) =>
        String(sql).startsWith("UPDATE casting_production_sound_media"),
      ),
    ).toBe(true);
  });
});
