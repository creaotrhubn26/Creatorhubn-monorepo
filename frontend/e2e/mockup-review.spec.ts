import { expect, test } from "@playwright/test";

test("konto-fri Review Room: identitet, pin og kommentar", async ({ page }) => {
  let comments: unknown[] = [];
  const review = {
    project: { id: "p1", name: "MedSide kampanje", preview: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nAsAAAAASUVORK5CYII=", canvas: { width: 1080, height: 1080 } },
    version: { id: "v1", label: "Review 1", reviewStatus: "in_review" },
    versions: [{ id: "v1", label: "Review 1", reviewStatus: "in_review" }],
    share: { accessMode: "approve", requireIdentity: true, allowRecordings: true, allowVersionHistory: true, commentsPaused: false, expiresAt: null },
  };
  await page.route("**/api/role-room/mockup-shared/test-token**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/presence")) { await route.fulfill({ json: { presence: [] } }); return; }
    if (path.endsWith("/session") && request.method() === "POST") { await route.fulfill({ status: 201, json: { reviewerToken: "reviewer-token", reviewer: { id: "r1", display_name: "Daniel" } } }); return; }
    if (path.endsWith("/comments") && request.method() === "POST") {
      const body = request.postDataJSON() as { body: string; anchorX?: number; anchorY?: number };
      const comment = { id: "c1", number: 1, parentId: null, reviewerSessionId: "r1", authorDisplayName: "Daniel", body: body.body, anchorKind: "canvas", anchorX: body.anchorX, anchorY: body.anchorY, status: "open", priority: "normal", createdAt: new Date().toISOString(), attachments: [], reactions: {} };
      comments = [comment]; await route.fulfill({ status: 201, json: { comment } }); return;
    }
    await route.fulfill({ json: { ...review, comments } });
  });
  await page.goto("/mockup-review/test-token");
  await expect(page.getByRole("heading", { name: "Bli med i gjennomgangen" })).toBeVisible();
  await page.getByPlaceholder("Navn").fill("Daniel");
  await page.getByRole("button", { name: "Åpne Review Room" }).click();
  await expect(page.getByText("MedSide kampanje")).toBeVisible();
  await page.locator(".stage").click({ position: { x: 120, y: 120 } });
  await page.getByPlaceholder("Hva skal endres her?").fill("Koble linjen til enheten");
  await page.getByRole("button", { name: "Send", exact: true }).first().click();
  await expect(page.getByText("Koble linjen til enheten")).toBeVisible();
  await expect(page.locator(".pin").filter({ hasText: "1" })).toBeVisible();
});
