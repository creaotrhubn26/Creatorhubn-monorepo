import { expect, test } from "@playwright/test";

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

test("leser, aksepterer og signerer hele prototype-testerpakken", async ({
  page,
}) => {
  let submittedBody: Record<string, unknown> | null = null;

  await page.route(`**/api/prototype-tester-invites/**`, async (route) => {
    if (route.request().method() === "POST") {
      submittedBody = route.request().postDataJSON() as Record<string, unknown>;
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
      body: JSON.stringify({
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
      }),
    });
  });

  await page.goto(`/prototype-tester/accept-invite?token=${token}`);
  await expect(
    page.getByRole("heading", { name: "Les og signer avtalegrunnlaget" }),
  ).toBeVisible();

  for (const agreement of agreements) {
    await expect(
      page.getByTestId(`agreement-content-${agreement.key}`),
    ).toContainText(agreement.content.split("\n")[0]);
    await page.getByTestId(`accept-${agreement.key}`).check();
    await page.getByRole("button", { name: "Neste dokument" }).click();
  }

  await page.getByTestId("confirm-signing-authority").check();
  await page.getByTestId("agreement-signer-name").fill("Test Tester");
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
  });
  await expect(page).toHaveURL(
    /\/login\?redirect=%2Fphotographer-dashboard-material$/,
    {
      timeout: 5_000,
    },
  );
});
