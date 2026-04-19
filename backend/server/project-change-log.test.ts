import { describe, expect, it } from "vitest";
import { humanizeChangeLogEntry } from "./project-change-log";

/**
 * The humanizer is used server-side (email digests, notification
 * push bodies) and in principle by UI clients that re-render the
 * same feed. Pinning phrasing here so a rewrite can't silently
 * reshape every existing notification.
 *
 * Coverage priorities:
 *   - Each supported kind yields a natural-language sentence.
 *   - Missing actor label falls back to role-appropriate default
 *     (``Klienten`` for client actions, ``Fotografen`` otherwise).
 *   - Comment preview is quoted + truncated so a 5k-char rant
 *     doesn't overflow a push-body.
 *   - Heart toggles off → "fjernet hjerte" (not a silent re-phrase
 *     of the positive message).
 */
describe("humanizeChangeLogEntry", () => {
  it("names the actor for a heart", () => {
    expect(
      humanizeChangeLogEntry({
        kind: "asset.hearted",
        actorKind: "client",
        actorLabel: "Olav",
        payload: { hearted: true },
      }),
    ).toBe("Olav hjertet et bilde");
  });

  it("distinguishes un-heart from heart", () => {
    expect(
      humanizeChangeLogEntry({
        kind: "asset.hearted",
        actorKind: "client",
        actorLabel: "Olav",
        payload: { hearted: false },
      }),
    ).toBe("Olav fjernet hjerte fra et bilde");
  });

  it("defaults to 'Klienten' when actor label is missing", () => {
    expect(
      humanizeChangeLogEntry({
        kind: "asset.hearted",
        actorKind: "client",
        actorLabel: null,
        payload: { hearted: true },
      }),
    ).toBe("Klienten hjertet et bilde");
  });

  it("defaults to 'Fotografen' for photographer actions", () => {
    expect(
      humanizeChangeLogEntry({
        kind: "quote.signed",
        actorKind: "photographer",
        actorLabel: null,
        payload: {},
      }),
    ).toBe("Fotografen signerte tilbudet");
  });

  it("ignores whitespace-only actor labels", () => {
    expect(
      humanizeChangeLogEntry({
        kind: "contract.signed",
        actorKind: "client",
        actorLabel: "   ",
        payload: {},
      }),
    ).toBe("Klienten signerte kontrakten");
  });

  it("quotes a comment preview", () => {
    expect(
      humanizeChangeLogEntry({
        kind: "asset.commented",
        actorKind: "client",
        actorLabel: "Bea",
        payload: { preview: "Elsker denne!" },
      }),
    ).toBe(`Bea kommenterte: "Elsker denne!"`);
  });

  it("truncates long comment previews with an ellipsis", () => {
    const long = "a".repeat(200);
    const out = humanizeChangeLogEntry({
      kind: "asset.commented",
      actorKind: "client",
      actorLabel: "Bea",
      payload: { preview: long },
    });
    expect(out.length).toBeLessThanOrEqual("Bea kommenterte: \"\"".length + 80);
    expect(out.endsWith("…\"")).toBe(true);
  });

  it("falls back to a generic sentence when the comment preview is empty", () => {
    expect(
      humanizeChangeLogEntry({
        kind: "asset.commented",
        actorKind: "client",
        actorLabel: "Bea",
        payload: { preview: "" },
      }),
    ).toBe("Bea la igjen en kommentar");
  });

  it("handles contract signings", () => {
    expect(
      humanizeChangeLogEntry({
        kind: "contract.signed",
        actorKind: "client",
        actorLabel: "Bea",
        payload: {},
      }),
    ).toBe("Bea signerte kontrakten");
  });

  it("handles quote signings regardless of actor kind", () => {
    expect(
      humanizeChangeLogEntry({
        kind: "quote.signed",
        actorKind: "client",
        actorLabel: "Bea",
        payload: {},
      }),
    ).toBe("Bea signerte tilbudet");
  });

  it("treats missing hearted flag as true (legacy payloads)", () => {
    // Old rows may have no ``hearted`` field because the first
    // version only logged positive events. Default to "hjertet"
    // rather than showing "fjernet hjerte" on historical data.
    expect(
      humanizeChangeLogEntry({
        kind: "asset.hearted",
        actorKind: "client",
        actorLabel: "Olav",
        payload: {},
      }),
    ).toBe("Olav hjertet et bilde");
  });
});
