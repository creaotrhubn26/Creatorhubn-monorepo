import { expect, test } from "@playwright/test";

type MockComment = {
  id: string;
  number: number;
  parentId: string | null;
  reviewerSessionId: string;
  authorDisplayName: string;
  body: string;
  anchorKind: "general" | "canvas" | "element";
  anchorRef: string | null;
  anchorOffsetX: number | null;
  anchorOffsetY: number | null;
  anchorX: number | null;
  anchorY: number | null;
  marks: unknown[];
  status: string;
  priority: string;
  createdAt: string;
  attachments: unknown[];
  reactions: Record<string, number>;
};

test("komplett konto-fri Review Room-flyt", async ({ page }) => {
  const comments: MockComment[] = [];
  const decisions: unknown[] = [];
  const review = {
    project: {
      id: "p1",
      name: "MedSide kampanje",
      preview: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nAsAAAAASUVORK5CYII=",
      canvas: { width: 1080, height: 1080 },
      reviewElements: [{
        ref: "device:phone-1", kind: "device", label: "Enhet · mobil",
        x: 0.05, y: 0.05, w: 0.45, h: 0.45,
      }],
    },
    version: { id: "v1", label: "Review 1", reviewStatus: "in_review" },
    versions: [{ id: "v1", label: "Review 1", reviewStatus: "in_review" }],
    share: {
      accessMode: "approve",
      requireIdentity: true,
      allowRecordings: true,
      allowVersionHistory: true,
      commentsPaused: false,
      expiresAt: null,
    },
  };

  await page.addInitScript(() => localStorage.setItem("mr-tour-v2", "1"));
  await page.route("**/api/role-room/mockup-shared/test-token**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path.endsWith("/presence")) {
      await route.fulfill({ json: method === "GET" ? { presence: [] } : { ok: true } });
      return;
    }
    if (path.endsWith("/session") && method === "POST") {
      await route.fulfill({ status: 201, json: { reviewerToken: "reviewer-token", reviewer: { id: "r1", display_name: "Daniel" } } });
      return;
    }
    if (path.endsWith("/comments") && method === "POST") {
      const body = request.postDataJSON() as {
        body: string;
        parentId?: string;
        anchorKind?: "general" | "canvas" | "element";
        anchorRef?: string | null;
        anchorX?: number;
        anchorY?: number;
        anchorOffsetX?: number | null;
        anchorOffsetY?: number | null;
        marks?: unknown[];
      };
      const comment: MockComment = {
        id: "c" + (comments.length + 1),
        number: comments.length + 1,
        parentId: body.parentId || null,
        reviewerSessionId: "r1",
        authorDisplayName: "Daniel",
        body: body.body,
        anchorKind: body.anchorKind || "general",
        anchorRef: body.anchorRef || null,
        anchorX: body.anchorX ?? null,
        anchorY: body.anchorY ?? null,
        anchorOffsetX: body.anchorOffsetX ?? null,
        anchorOffsetY: body.anchorOffsetY ?? null,
        marks: body.marks || [],
        status: "open",
        priority: "normal",
        createdAt: new Date().toISOString(),
        attachments: [],
        reactions: {},
      };
      comments.push(comment);
      await route.fulfill({ status: 201, json: { comment } });
      return;
    }
    const commentMatch = path.match(/\/comments\/(c\d+)$/);
    if (commentMatch && method === "PATCH") {
      const comment = comments.find((item) => item.id === commentMatch[1]);
      Object.assign(comment || {}, request.postDataJSON());
      await route.fulfill({ json: { ok: true } });
      return;
    }
    const reactionMatch = path.match(/\/comments\/(c\d+)\/reactions$/);
    if (reactionMatch && method === "POST") {
      const comment = comments.find((item) => item.id === reactionMatch[1]);
      const emoji = String((request.postDataJSON() as { emoji: string }).emoji);
      if (comment) comment.reactions[emoji] = (comment.reactions[emoji] || 0) + 1;
      await route.fulfill({ json: { ok: true, active: true } });
      return;
    }
    if (path.endsWith("/decision") && method === "POST") {
      const body = request.postDataJSON() as { decision: "approved" | "changes_requested"; note?: string };
      review.version.reviewStatus = body.decision === "approved" ? "approved" : "changes_requested";
      review.versions[0].reviewStatus = review.version.reviewStatus;
      decisions.unshift({
        id: "d1", versionId: "v1", decision: body.decision, note: body.note,
        actorDisplayName: "Daniel", createdAt: new Date().toISOString(),
      });
      await route.fulfill({ json: { ok: true, status: review.version.reviewStatus } });
      return;
    }
    await route.fulfill({ json: { ...review, comments, decisions } });
  });

  await page.goto("/mockup-review/test-token");
  await expect(page.getByRole("heading", { name: "Bli med i gjennomgangen" })).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder("Navn").fill("Daniel");
  await page.getByRole("button", { name: "Åpne Review Room" }).click();
  await expect(page.getByText("MedSide kampanje")).toBeVisible();
  await page.getByRole("button", { name: "● Opptak" }).click();
  const recorder = page.getByRole("dialog", { name: "Skjermopptak" });
  await expect(recorder).toBeVisible();
  await expect(recorder.getByText("Kamera i hjørnet")).toBeVisible();
  await expect(recorder.getByText("Automatisk transkripsjon")).toBeVisible();
  await recorder.getByRole("button", { name: "Lukk" }).click();

  const stage = page.locator(".mockup-review-stage");
  await page.getByRole("button", { name: /^Pin/ }).click();
  await stage.click({ position: { x: 120, y: 120 } });
  await page.getByPlaceholder("Hva skal endres her?").fill("Koble linjen til enheten");
  await page.getByRole("button", { name: "Send", exact: true }).first().click();
  await expect(page.getByText("Koble linjen til enheten")).toBeVisible();
  await expect(page.locator(".review-pin").filter({ hasText: "1" })).toBeVisible();
  await expect.poll(() => comments[0]?.anchorKind).toBe("element");
  expect(comments[0]?.anchorRef).toBe("device:phone-1");
  expect(comments[0]?.anchorOffsetX).not.toBeNull();

  await page.locator(".review-pin").filter({ hasText: "1" }).click();
  await expect(page.locator("#comment-c1")).toHaveClass(/active/);

  await page.getByRole("button", { name: /^Frihånd/ }).click();
  const box = await stage.boundingBox();
  if (!box) throw new Error("review-stage mangler");
  await page.mouse.move(box.x + 180, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 230, { steps: 8 });
  await page.mouse.up();
  await page.getByPlaceholder("Hva skal endres her?").fill("Marker dette området");
  await page.getByRole("button", { name: "Send", exact: true }).first().click();
  await expect(page.locator(".review-marks polyline")).toBeVisible();

  await page.locator("#comment-c1").getByRole("button", { name: /👍/ }).click();
  await expect(page.locator("#comment-c1").getByRole("button", { name: /👍 1/ })).toBeVisible();
  await page.locator("#comment-c1").getByRole("button", { name: "Svar" }).click();
  await page.locator("#comment-c1 .review-reply input").fill("Dette fikser vi");
  await page.locator("#comment-c1 .review-reply").getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Dette fikser vi")).toBeVisible();

  await page.locator("#comment-c1").getByRole("button", { name: "Løs" }).click();
  await page.getByRole("button", { name: "Løst", exact: true }).click();
  await expect(page.locator("#comment-c1")).toHaveClass(/resolved/);

  await page.getByPlaceholder("Valgfri merknad").last().fill("Klar for publisering");
  await page.locator(".review-decision").getByRole("button", { name: "Godkjenn" }).click();
  await expect(page.getByText("Versjonen er godkjent.")).toBeVisible();
  await expect(page.locator(".review-status")).toContainText("Godkjent");
});
