import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const token = "e2e-agreement-token";
const agreementVersions = {
  program_terms: "1.0",
  nda: "1.1",
  dpa: "1.0",
  letter_of_intent: "1.0",
} as const;

const agreements = [
  {
    key: "program_terms",
    title: "Vilkår for prototype-testerprogrammet",
    shortTitle: "Programvilkår",
    version: agreementVersions.program_terms,
    content: "PROGRAMVILKÅR\nTest én funksjon hver uke.",
    acceptanceLabel: "Jeg har lest og godtar programvilkårene.",
    bindingNature: "binding",
  },
  {
    key: "nda",
    title: "Konfidensialitetsavtale (NDA)",
    shortTitle: "NDA",
    version: agreementVersions.nda,
    content: "KONFIDENSIALITETSAVTALE\nIkke del ikke-offentlig informasjon.",
    acceptanceLabel: "Jeg har lest og godtar konfidensialitetsavtalen.",
    bindingNature: "binding",
  },
  {
    key: "dpa",
    title: "Databehandleravtale",
    shortTitle: "Databehandleravtale",
    version: agreementVersions.dpa,
    content:
      "DATABEHANDLERAVTALE\nCreatorHub behandler data etter dokumenterte instrukser.",
    acceptanceLabel: "Jeg har lest og godtar databehandleravtalen.",
    bindingNature: "binding",
  },
  {
    key: "letter_of_intent",
    title: "Intensjonsavtale",
    shortTitle: "Intensjonsavtale",
    version: agreementVersions.letter_of_intent,
    content:
      "INTENSJONSAVTALE\nDenne avtalen er ikke i seg selv rettslig bindende.",
    acceptanceLabel:
      "Jeg har lest og bekrefter den ikke-bindende intensjonsavtalen.",
    bindingNature: "non_binding",
  },
] as const;

const invitePayload = {
  id: "invite-e2e",
  email: "tester@example.com",
  name: "Test Tester",
  testingAreas: ["workflow"],
  personalMessage: null,
  status: "pending",
  expiresAt: "2099-09-20T12:00:00.000Z",
  programDurationWeeks: 12,
  memberProfession: "photographer",
  memberCompany: "Test AS",
  agreements,
};

test("leser, aksepterer og signerer hele prototype-testerpakken", async ({
  page,
}, testInfo) => {
  let submittedBody: Record<string, unknown> | null = null;

  await page
    .context()
    .route(`**/api/prototype-tester-invites/**`, async (route) => {
      if (route.request().method() === "POST") {
        if (route.request().url().endsWith("/signing-code")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              maskedEmail: "te****@example.com",
              expiresAt: "2099-09-20T12:10:00.000Z",
            }),
          });
          return;
        }
        submittedBody = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, accountCreated: true }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(invitePayload),
      });
    });

  await page.goto(`/prototype-tester/accept-invite?token=${token}`);
  await expect(
    page.getByRole("heading", { name: "Les og signer avtalegrunnlaget" }),
  ).toBeVisible({ timeout: 30_000 });
  const overviewScreenshot = testInfo.outputPath("agreement-overview.png");
  await page.screenshot({ path: overviewScreenshot, fullPage: true });
  await testInfo.attach("agreement-overview", {
    path: overviewScreenshot,
    contentType: "image/png",
  });

  for (const [index, agreement] of agreements.entries()) {
    const agreementCheckbox = page
      .getByTestId(`accept-${agreement.key}`)
      .locator("input");
    await expect(agreementCheckbox).toBeDisabled();
    await page.getByTestId(`read-${agreement.key}`).click();
    await expect(
      page.getByTestId(`agreement-content-${agreement.key}`),
    ).toContainText(agreement.content.split("\n")[0]);
    await expect(
      page.getByRole("heading", { name: agreement.title }),
    ).toBeVisible();
    if (index === 0) {
      const readerScreenshot = testInfo.outputPath("agreement-reader.png");
      await page.locator(".MuiDialog-paper").screenshot({
        path: readerScreenshot,
        animations: "disabled",
      });
      await testInfo.attach("agreement-reader", {
        path: readerScreenshot,
        contentType: "image/png",
      });
    }
    await page.getByTestId(`mark-read-${agreement.key}`).click();
    await expect(agreementCheckbox).toBeEnabled();
    await agreementCheckbox.check();
  }

  await expect(page.getByText("4 av 4 godkjent")).toBeVisible();

  await page.getByTestId("confirm-signing-authority").check();
  await page.getByTestId("agreement-signer-name").fill("Test Tester");
  await expect(page.getByTestId("sign-and-activate")).toBeDisabled();
  await page.getByTestId("send-signing-code").click();
  await page.getByTestId("signing-verification-code").fill("123456");
  const loginNavigation = page.waitForURL(
    /\/login\?redirect=%2Fphotographer-dashboard-material$/,
    { timeout: 8_000 },
  );
  await page.getByTestId("sign-and-activate").click();

  await expect(
    page.getByRole("heading", { name: "Avtalene er registrert" }),
  ).toBeVisible();
  expect(submittedBody).toMatchObject({
    ndaName: "Test Tester",
    acceptedProgramTerms: true,
    acceptedAgreements: {
      program_terms: true,
      nda: true,
      dpa: true,
      letter_of_intent: true,
    },
    agreementVersions,
    confirmedSigningAuthority: true,
    verificationCode: "123456",
  });
  await loginNavigation;
});

test("dokumentleseren er lesbar på mobil @mobile", async ({
  page,
}, testInfo) => {
  await page
    .context()
    .route(`**/api/prototype-tester-invites/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(invitePayload),
      });
    });

  await page.goto(`/prototype-tester/accept-invite?token=${token}`);
  await expect(
    page.getByRole("heading", { name: "Les og signer avtalegrunnlaget" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(/^agreement-summary-/)).toHaveCount(4);

  await page.getByTestId("read-dpa").click();
  await expect(page.getByTestId("agreement-content-dpa")).toContainText(
    "DATABEHANDLERAVTALE",
  );
  await expect(page.getByTestId("mark-read-dpa")).toBeVisible();

  const mobileScreenshot = testInfo.outputPath("agreement-reader-mobile.png");
  await page.locator(".MuiDialog-paper").screenshot({
    path: mobileScreenshot,
    animations: "disabled",
  });
  await testInfo.attach("agreement-reader-mobile", {
    path: mobileScreenshot,
    contentType: "image/png",
  });
});
