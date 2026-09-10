import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const receiptId = "88888888-8888-4888-8888-888888888888";

test("viser og laster ned etterprøvbar prototype-kvittering fra Mine avtaler", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("creatorhub_auth_token", "e2e-session-token");
    localStorage.setItem("creatorhub_auth_user", JSON.stringify({
      id: "tester-user-id",
      email: "tester@example.com",
      role: "user",
    }));
  });
  await page.route("**/api/my-split-sheets", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ agreements: [] }),
  }));
  await page.route("**/api/prototype-tester-agreements/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      agreements: [{
        id: "invite-id",
        title: "Prototype-testeravtaler",
        signerName: "Test Tester",
        signerEmail: "tester@example.com",
        acceptedAt: "2026-09-09T12:00:00.000Z",
        programEndsAt: "2026-12-02T12:00:00.000Z",
        signatureMethod: "email_otp_typed_name",
        emailVerifiedAt: "2026-09-09T11:59:00.000Z",
        receiptId,
        agreementDigest: "a".repeat(64),
        integrityVerified: true,
        receiptDownloadUrl: `/api/prototype-tester-agreements/${receiptId}/receipt.pdf`,
      }],
    }),
  }));

  let receiptAuthorization = "";
  await page.route(`**/api/prototype-tester-agreements/${receiptId}/receipt.pdf`, (route) => {
    receiptAuthorization = route.request().headers().authorization || "";
    return route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: Buffer.from("%PDF-1.4\nCreatorHub test receipt\n%%EOF"),
      headers: {
        "Content-Disposition": `attachment; filename="creatorhub-signeringskvittering-${receiptId}.pdf"`,
      },
    });
  });

  await page.goto("/mine-avtaler");
  await expect(page.getByRole("heading", { name: "Prototypeprogram" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Integritet verifisert")).toBeVisible();
  await expect(page.getByText(/e-postkode og skrevet navn/)).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByTestId("download-prototype-receipt").click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toBe(
    `creatorhub-signeringskvittering-${receiptId}.pdf`,
  );
  expect(receiptAuthorization).toBe("Bearer e2e-session-token");
});

test("verifiserer QR-referansen offentlig uten å vise personopplysninger", async ({ page }) => {
  const digest = "a".repeat(64);
  await page.route(
    `**/api/prototype-tester-agreements/receipts/${receiptId}/verify?digest=${digest}`,
    (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        valid: true,
        receiptId,
        acceptedAt: "2026-09-09T12:00:00.000Z",
        signatureMethod: "email_otp_typed_name",
        emailVerified: true,
        archiveFormat: "PDF/A-2b",
        documentCount: 4,
        documents: [
          { key: "program_terms", title: "Vilkår for prototype-testerprogrammet", version: "1.0", bindingNature: "binding" },
          { key: "nda", title: "Konfidensialitetsavtale (NDA)", version: "1.1", bindingNature: "binding" },
          { key: "dpa", title: "Databehandleravtale", version: "1.1", bindingNature: "binding" },
          { key: "letter_of_intent", title: "Intensjonsavtale", version: "1.0", bindingNature: "non_binding" },
        ],
      }),
    }),
  );

  await page.goto(`/prototype-tester/verify-receipt?receipt=${receiptId}&digest=${digest}`);
  await expect(page.getByRole("heading", { name: "Kvitteringen er gyldig" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("img", { name: "CreatorHub Norge" })).toHaveAttribute("src", "/creatorhub-wordmark-light.png");
  await expect(page.getByText("PDF/A-2b")).toBeVisible();
  await expect(page.getByText("4 dokumenter")).toBeVisible();
  await expect(page.getByText("Intensjonsavtale")).toBeVisible();
  await expect(page.getByText("Ikke-bindende", { exact: false })).toBeVisible();
  await expect(page.getByText("tester@example.com")).toHaveCount(0);
  await expect(page.getByText("Test Tester")).toHaveCount(0);
});
