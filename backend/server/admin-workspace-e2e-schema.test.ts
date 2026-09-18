import { describe, expect, it } from "vitest";
import { ADMIN_WORKSPACE_E2E_MIGRATIONS } from "./admin-workspace-e2e-schema";

describe("Admin Workspace E2E migration whitelist", () => {
  it("contains only the reviewed Admin Room/Workspace chain", () => {
    expect(ADMIN_WORKSPACE_E2E_MIGRATIONS).toEqual([
      "136_admin_room.sql",
      "137_admin_room_v2.sql",
      "138_admin_activity_log.sql",
      "163_role_room_industry_targets.sql",
      "0341_admin_workspace_cases.sql",
      "0450_admin_workspace_projects.sql",
      "0451_admin_workspace_projects_leadgrid_links.sql",
      "0452_admin_workspace_documents.sql",
      "0453_admin_workspace_tasks.sql",
      "0454_admin_workspace_calendar.sql",
      "0455_admin_workspace_funding_opportunities.sql",
      "0456_admin_workspace_document_review.sql",
      "0457_admin_document_context.sql",
      "0458_admin_workspace_project_files.sql",
      "0459_admin_workspace_cv_profiles.sql",
    ]);
    expect(
      ADMIN_WORKSPACE_E2E_MIGRATIONS.every((name) =>
        /^(?:13[6-8]|163|0341|045[0-9])_[a-z0-9_]+\.sql$/u.test(name),
      ),
    ).toBe(true);
  });
});
