import { describe, it, expect, vi } from "vitest";

import { resolveTabAccessLevel } from "./role-room-tab-access.js";

// Regresjon: utdannings-broen kalte tidligere resolveEducationProductionRole med
// ombyttede argumenter (projectId/viewerId) → education-queryen fikk feil binding
// → bro-studenter fikk aldri EDU_TAB_ACCESS-kartet (falt til «ingen restriksjon»).
describe("resolveTabAccessLevel — utdannings-bro", () => {
  it("bro-student får EDU_TAB_ACCESS-nivå; education-queryen får [projectId, viewerId] i riktig posisjon", async () => {
    const projectId = "proj-eduarg-1";
    const viewerId = "user-eduarg-1";
    let eduParams: unknown[] | null = null;

    const pool = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes("FROM casting_projects WHERE id")) return { rowCount: 0, rows: [] }; // ikke leder
        if (sql.includes("role_room_project_tab_overrides")) return { rows: [] };            // ingen overstyring
        if (sql.includes("FROM casting_user_roles")) return { rows: [] };                    // ingen casting-rolle
        if (sql.includes("role_room_education_productions") && sql.includes("JOIN users u")) {
          eduParams = params; // resolveEducationProductionRole binder [projectId, userId]
          // Returnér rolle KUN når bindingen er korrekt (project_id=$1, u.id=$2).
          return (params[0] === projectId && params[1] === viewerId)
            ? { rows: [{ role: "contributor" }] }
            : { rows: [] };
        }
        return { rows: [] };
      }),
    } as unknown as import("pg").Pool;

    // contributor har story-arc = 'manage' i EDU_TAB_ACCESS.
    const level = await resolveTabAccessLevel(pool, projectId, viewerId, "story-arc");
    expect(level).toBe("manage");
    // Direkte vakt mot arg-swap: ville vært [viewerId, projectId] med bugen.
    expect(eduParams).toEqual([projectId, viewerId]);
  });
});
