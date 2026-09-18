import { describe, expect, it } from "vitest";
import {
  initializeWorkspaceSplitSheetCache,
  persistWorkspaceSplitSheetCache,
  workspaceSplitSheetCacheKey,
  workspaceSplitSheetLegacyCacheKey,
} from "./workspaceSplitSheetCachePolicy";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("Workspace split sheet cache policy", () => {
  it("purges the unscoped legacy key and fails closed without a user", () => {
    const storage = new MemoryStorage();
    const legacyKey = workspaceSplitSheetLegacyCacheKey("project-1");
    storage.setItem(
      legacyKey,
      JSON.stringify([{ email: "legacy@example.no" }]),
    );

    const result = initializeWorkspaceSplitSheetCache(storage, {
      projectId: "project-1",
    });

    expect(result).toEqual({ key: null, entries: [] });
    expect(storage.getItem(legacyKey)).toBeNull();
    persistWorkspaceSplitSheetCache(storage, null, [{ id: "ignored" }]);
    expect(storage.values.size).toBe(0);
  });

  it("never persists managed participant PII, rates or access codes", () => {
    const storage = new MemoryStorage();
    const key = workspaceSplitSheetCacheKey({
      projectId: "project-1",
      userId: "user-1",
    });
    const managed = {
      id: "managed-1",
      source: "workspace-participant-compensation",
      visibility: "private",
      participants: [
        { name: "Kari", email: "kari@example.no", hourlyRate: 900 },
      ],
      accessCode: "PRIVATE-CODE",
    };
    const ordinary = {
      id: "ordinary-1",
      source: "manual",
      visibility: "private",
      participants: [{ name: "Existing cache behavior" }],
    };

    persistWorkspaceSplitSheetCache(storage, key, [managed, ordinary]);

    const raw = storage.getItem(key!);
    expect(raw).toContain("ordinary-1");
    expect(raw).not.toContain("managed-1");
    expect(raw).not.toContain("Kari");
    expect(raw).not.toContain("kari@example.no");
    expect(raw).not.toContain("900");
    expect(raw).not.toContain("PRIVATE-CODE");
  });

  it("scrubs a managed record already present in the scoped cache", () => {
    const storage = new MemoryStorage();
    const key = workspaceSplitSheetCacheKey({
      projectId: "project-1",
      userId: "user-1",
    })!;
    storage.setItem(
      key,
      JSON.stringify([
        {
          id: "managed",
          source: "workspace-participant-compensation",
          email: "secret@example.no",
        },
        { id: "ordinary" },
      ]),
    );

    const result = initializeWorkspaceSplitSheetCache<{
      id: string;
      source?: string;
    }>(storage, { projectId: "project-1", userId: "user-1" });

    expect(result.entries).toEqual([{ id: "ordinary" }]);
    expect(storage.getItem(key)).toBe('[{"id":"ordinary"}]');
  });
});
