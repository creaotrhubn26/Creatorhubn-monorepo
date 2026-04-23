import { beforeEach, describe, expect, it } from "vitest";
import {
  consumePendingAdministrationDeepLink,
  resolveAdministrationDeepLink,
} from "./administrationHubDeepLink";

/**
 * Deep-link resolver connects the iPad CreatorHub One shell
 * (``?subTab=``) to the numeric tabs + modal state inside
 * AdministrationHub. Two surfaces:
 *   - ``resolveAdministrationDeepLink`` — pure mapping.
 *   - ``consumePendingAdministrationDeepLink`` — reads + clears the
 *     sessionStorage handoff that UniversalDashboard writes.
 *
 * Both are tested in isolation so the mapping + handoff can refactor
 * independently.
 */
describe("resolveAdministrationDeepLink", () => {
  it("returns null for missing or empty input", () => {
    expect(resolveAdministrationDeepLink(null)).toBeNull();
    expect(resolveAdministrationDeepLink(undefined)).toBeNull();
    expect(resolveAdministrationDeepLink("")).toBeNull();
    expect(resolveAdministrationDeepLink("   ")).toBeNull();
  });

  it("maps each known subTab to its numeric tab", () => {
    expect(resolveAdministrationDeepLink("pricing")).toEqual({
      kind: "tab",
      tabIndex: 0,
    });
    expect(resolveAdministrationDeepLink("contracts")).toEqual({
      kind: "tab",
      tabIndex: 1,
    });
    expect(resolveAdministrationDeepLink("communication")).toEqual({
      kind: "tab",
      tabIndex: 2,
    });
    expect(resolveAdministrationDeepLink("evendi")).toEqual({
      kind: "tab",
      tabIndex: 3,
    });
  });

  it("accepts Norwegian aliases (photographers copy-paste URLs in Norwegian)", () => {
    expect(resolveAdministrationDeepLink("prisadministrasjon")).toEqual({
      kind: "tab",
      tabIndex: 0,
    });
    expect(resolveAdministrationDeepLink("kontrakter")).toEqual({
      kind: "tab",
      tabIndex: 1,
    });
    expect(resolveAdministrationDeepLink("kommunikasjon")).toEqual({
      kind: "tab",
      tabIndex: 2,
    });
    expect(resolveAdministrationDeepLink("messages")).toEqual({
      kind: "tab",
      tabIndex: 2,
    });
  });

  it("routes the quote builder to its own kind (not a tab)", () => {
    expect(resolveAdministrationDeepLink("quotes")).toEqual({
      kind: "quote",
      tabIndex: 0,
    });
    expect(resolveAdministrationDeepLink("tilbud")).toEqual({
      kind: "quote",
      tabIndex: 0,
    });
  });

  it("is case-insensitive", () => {
    expect(resolveAdministrationDeepLink("Quotes")).toEqual({
      kind: "quote",
      tabIndex: 0,
    });
    expect(resolveAdministrationDeepLink("KONTRAKTER")).toEqual({
      kind: "tab",
      tabIndex: 1,
    });
  });

  it("returns null for unknown subTab instead of snapping to 0", () => {
    expect(resolveAdministrationDeepLink("unknown")).toBeNull();
    expect(resolveAdministrationDeepLink("tilbudsgenerator-v3")).toBeNull();
  });
});

describe("consumePendingAdministrationDeepLink", () => {
  let store: Map<string, string>;
  const fakeStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
  };

  beforeEach(() => {
    store = new Map();
  });

  it("returns null when sessionStorage is null (disabled)", () => {
    expect(consumePendingAdministrationDeepLink(null)).toBeNull();
  });

  it("returns null when the key is missing", () => {
    expect(consumePendingAdministrationDeepLink(fakeStorage)).toBeNull();
  });

  it("returns null when the payload is malformed JSON", () => {
    store.set("creatorhub:pending-subtab", "{not-json");
    expect(consumePendingAdministrationDeepLink(fakeStorage)).toBeNull();
  });

  it("resolves the subTab and clears the key", () => {
    store.set(
      "creatorhub:pending-subtab",
      JSON.stringify({ tab: "administration", subTab: "communication" }),
    );
    const result = consumePendingAdministrationDeepLink(fakeStorage);
    expect(result).toEqual({ kind: "tab", tabIndex: 2 });
    expect(store.has("creatorhub:pending-subtab")).toBe(false);
  });

  it("handles ``quotes`` specially", () => {
    store.set(
      "creatorhub:pending-subtab",
      JSON.stringify({ tab: "administration", subTab: "quotes" }),
    );
    expect(consumePendingAdministrationDeepLink(fakeStorage)).toEqual({
      kind: "quote",
      tabIndex: 0,
    });
  });

  it("ignores payloads targeting a different main tab", () => {
    store.set(
      "creatorhub:pending-subtab",
      JSON.stringify({ tab: "settings", subTab: "communication" }),
    );
    // Don't consume — the settings hub (or whoever) will pick it up.
    expect(consumePendingAdministrationDeepLink(fakeStorage)).toBeNull();
    expect(store.has("creatorhub:pending-subtab")).toBe(true);
  });

  it("tolerates missing outer tab and still resolves", () => {
    store.set(
      "creatorhub:pending-subtab",
      JSON.stringify({ subTab: "kontrakter" }),
    );
    expect(consumePendingAdministrationDeepLink(fakeStorage)).toEqual({
      kind: "tab",
      tabIndex: 1,
    });
  });

  it("returns null (and clears) for unknown subTabs", () => {
    store.set(
      "creatorhub:pending-subtab",
      JSON.stringify({ tab: "administration", subTab: "something-new" }),
    );
    expect(consumePendingAdministrationDeepLink(fakeStorage)).toBeNull();
    // Key is still cleared so we don't keep re-reading stale intent
    // on every hub remount.
    expect(store.has("creatorhub:pending-subtab")).toBe(false);
  });
});
