import { describe, expect, it, vi } from "vitest";
import { assertPondusEntitled, isPondusTemplateVisible, type PondusAccessContext } from "./pondus-access.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const manager: PondusAccessContext = {
  organizationId,
  organizationRole: "salgssjef",
  permissions: new Set(),
  platformAdmin: false,
};

function poolWithTemplate(row: Record<string, unknown>) {
  return { query: vi.fn(async () => ({ rows: [row] })) } as any;
}

describe("Pondus tenant visibility", () => {
  it("never exposes a global draft to an organization manager", async () => {
    const visible = await isPondusTemplateVisible(
      poolWithTemplate({ org_id: null, is_published: false, archived_at: null }),
      "22222222-2222-4222-8222-222222222222",
      manager,
      { includeDraftForManagers: true },
    );
    expect(visible).toBe(false);
  });

  it("allows a manager to preview only the organization's own draft", async () => {
    const visible = await isPondusTemplateVisible(
      poolWithTemplate({ org_id: organizationId, is_published: false, archived_at: null }),
      "22222222-2222-4222-8222-222222222222",
      manager,
      { includeDraftForManagers: true },
    );
    expect(visible).toBe(true);
  });

  it("blocks an explicitly locked Leadbook entitlement", async () => {
    const pool = { query: vi.fn(async () => ({ rows: [{ state: "locked" }] })) } as any;
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const allowed = await assertPondusEntitled(pool, manager, { status } as any);
    expect(allowed).toBe(false);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: "entitlement_locked" }));
  });
});
