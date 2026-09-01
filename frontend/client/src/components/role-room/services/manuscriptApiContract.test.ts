import { describe, expect, it } from "vitest";

import { buildManuscriptScopedEntityUrl } from "./manuscriptApiContract";

describe("manuscript-scoped entity API contract", () => {
  it("encodes both the entity id and required manuscript scope", () => {
    expect(
      buildManuscriptScopedEntityUrl("scenes", "scene/1", "manuscript one"),
    ).toBe(
      "/api/casting/scenes/scene%2F1?manuscriptId=manuscript%20one",
    );
  });

  it.each(["acts", "dialogue", "scenes"] as const)(
    "fails closed without manuscript scope for %s",
    (entity) => {
      expect(() =>
        buildManuscriptScopedEntityUrl(entity, "entity-1", "  "),
      ).toThrow("manuscriptId is required");
    },
  );
});
