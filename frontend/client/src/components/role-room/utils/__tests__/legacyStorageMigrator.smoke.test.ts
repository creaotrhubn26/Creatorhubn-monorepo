// @ts-nocheck
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runLegacyStorageMigration } from "../legacyStorageMigrator";

beforeAll(() => {
  // jsdom-stubben er ikke pålitelig på alle Node-versjoner — installer
  // deterministisk Map-based localStorage før modul-import.
  if (typeof window !== "undefined" && !window.localStorage) {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => store.clear(),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() { return store.size; },
      },
    });
  }
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("Sprint B.2 — runLegacyStorageMigration", () => {
  it("er en no-op når ingen sårbare keys finnes", () => {
    const report = runLegacyStorageMigration();
    expect(report.inspected).toBe(0);
    expect(report.migrated).toBe(0);
  });

  it("wrapper plain JSON-array under role_room_workspace_state-prefix i envelope", () => {
    window.localStorage.setItem(
      "role_room_workspace_state:user-1",
      JSON.stringify({ projectId: "p1", activeTab: 3 }),
    );
    const report = runLegacyStorageMigration();
    expect(report.migrated).toBe(1);

    const stored = JSON.parse(window.localStorage.getItem("role_room_workspace_state:user-1")!);
    expect(stored.__v).toBe(1);
    expect(stored.data.projectId).toBe("p1");
    expect(stored.data.activeTab).toBe(3);
  });

  it("hopper over keys som allerede har envelope", () => {
    window.localStorage.setItem(
      "story-logic-data:p1",
      JSON.stringify({ __v: 1, data: { foo: "bar" } }),
    );
    const report = runLegacyStorageMigration();
    expect(report.skippedAlreadyVersioned).toBe(1);
    expect(report.migrated).toBe(0);
  });

  it("hopper over keys utenfor SAFE_KEY_PATTERNS", () => {
    window.localStorage.setItem("random_unrelated_key", JSON.stringify({ foo: 1 }));
    const report = runLegacyStorageMigration();
    expect(report.inspected).toBe(0);
    expect(report.migrated).toBe(0);
    // Original key er uendret
    expect(JSON.parse(window.localStorage.getItem("random_unrelated_key")!)).toEqual({ foo: 1 });
  });

  it("skipper korrupt JSON (logger ikke krasj)", () => {
    window.localStorage.setItem("story-logic-data:p1", "{not valid");
    const report = runLegacyStorageMigration();
    expect(report.skippedCorrupted).toBe(1);
    expect(report.migrated).toBe(0);
  });

  it("er idempotent — andre kjøring gjør ingenting", () => {
    window.localStorage.setItem(
      "role_room_workspace_state:user-1",
      JSON.stringify({ foo: 1 }),
    );
    const first = runLegacyStorageMigration();
    expect(first.migrated).toBe(1);

    const second = runLegacyStorageMigration();
    expect(second.inspected).toBe(0);
    expect(second.migrated).toBe(0);
  });

  it("setter migrasjons-marker-key etter første run", () => {
    runLegacyStorageMigration();
    expect(window.localStorage.getItem("_legacy-storage-migration-version")).toBe("1");
  });

  it("beholder _legacyCompatRaw så eksisterende lesere kan fortsette uendret", () => {
    window.localStorage.setItem(
      "story-logic-data:p2",
      JSON.stringify({ corePremise: "test" }),
    );
    runLegacyStorageMigration();
    const stored = JSON.parse(window.localStorage.getItem("story-logic-data:p2")!);
    // Både __v/data (nytt) og _legacyCompatRaw (gammelt) finnes
    expect(stored._legacyCompatRaw.corePremise).toBe("test");
    expect(stored.data.corePremise).toBe("test");
  });

  it("matcher prefix-keys for storyboard-library", () => {
    window.localStorage.setItem("storyboard-library:project-42", JSON.stringify({ items: [] }));
    const report = runLegacyStorageMigration();
    expect(report.migrated).toBe(1);
  });
});
