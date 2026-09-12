import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const ADMIN_EMAIL = "daniel@creatorhubn.com";
const AUTH_TOKEN = "prototype-admin-e2e-token";
const INVITE_ID = "77777777-7777-4777-8777-777777777777";

const adminUser = {
  id: "prototype-admin-e2e",
  email: ADMIN_EMAIL,
  name: "Daniel",
  role: "super_admin",
  isAdmin: true,
};

const failedInvite = {
  id: INVITE_ID,
  name: "Eksisterende Tester",
  email: "existing@example.com",
  memberCompany: "EKSEMPEL AS",
  memberOrganizationNumber: "937518684",
  memberProfession: "photographer",
  testingAreas: ["CreatorHub-dashboard"],
  status: "pending",
  inviteRequestId: null,
  inviteUrl: "https://creatorhubn.com/prototype-tester/accept-invite?token=redacted",
  createdAt: "2026-09-10T10:00:00.000Z",
  acceptedAt: null,
  accountProvisioningComplete: false,
  soloProActive: false,
  emailDelivery: { sent: false, reason: "provider_timeout" },
  lifecycle: [
    { key: "created", label: "Invitasjon opprettet", status: "complete", at: "2026-09-10T10:00:00.000Z" },
    { key: "invite_email", label: "Invitasjon sendt", status: "failed", detail: "provider_timeout", retryStep: "invite_email" },
    { key: "opened", label: "E-post åpnet", status: "pending" },
    { key: "clicked", label: "Invitasjonslenke åpnet", status: "pending" },
    { key: "email_verified", label: "E-post bekreftet med kode", status: "pending" },
    { key: "agreements", label: "Fire avtaler akseptert", status: "pending" },
    { key: "account", label: "Konto opprettet", status: "pending" },
    { key: "solo_pro", label: "solo_pro aktiv", status: "pending" },
    { key: "access_email", label: "Tilgangs-e-post sendt", status: "pending" },
    { key: "receipt", label: "PDF-kvittering tilgjengelig", status: "pending" },
    { key: "receipt_email", label: "Kvittering sendt", status: "pending" },
  ],
};

async function installAdminSession(page: Page) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("creatorhub_auth_token", token);
    localStorage.setItem("creatorhub_auth_user", JSON.stringify(user));
    localStorage.setItem("userId", user.id);
    localStorage.setItem("userEmail", user.email);
  }, { token: AUTH_TOKEN, user: adminUser });
  await page.route("**/api/auth/user", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: true, user: adminUser }),
  }));
}

async function installInviteApi(page: Page) {
  let sentBody: Record<string, unknown> | null = null;
  let retriedBody: Record<string, unknown> | null = null;

  await page.route("**/api/prototype-tester-invites", async (route) => {
    if (route.request().method() === "POST") {
      sentBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "99999999-9999-4999-8999-999999999999",
          token: "new-token",
          inviteUrl: "https://creatorhubn.com/prototype-tester/accept-invite?token=new-token",
          emailDelivery: { sent: true, provider: "resend", messageId: "e2e-message" },
          verifiedCompany: {
            organizationNumber: "998989159",
            name: "ESTREMO RECORDING STUDIOS JENS MICHAEL PETERS NIELSEN",
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ invites: [failedInvite] }),
    });
  });
  await page.route("**/api/prototype-tester-invites/brreg/search**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      companies: [{
        organizationNumber: "998989159",
        name: "ESTREMO RECORDING STUDIOS JENS MICHAEL PETERS NIELSEN",
        organizationForm: "Enkeltpersonforetak",
        organizationFormCode: "ENK",
        primaryIndustryCode: "59.200",
        primaryIndustryDescription: "Produksjon og utgivelse av musikk- og lydopptak",
        recommendedProfession: "music_producer",
        professionRecommendation: {
          profession: "music_producer",
          confidence: "high",
          reason: "Næringskode 59.200 gjelder produksjon eller utgivelse av musikk- og lydopptak.",
        },
        suggestedTestingAreas: [
          "CreatorHub-dashboard",
          "Prosjekt og arbeidsflyt",
          "Showcase og klient-godkjenning",
          "Kontrakt og fakturering",
          "Integrasjoner",
        ],
        businessAddress: "Styrilia 16, 2080 EIDSVOLL",
        operationalStatus: "active",
      }],
    }),
  }));
  await page.route("**/api/prototype-tester-invites/brreg/998989159/contact", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      contact: {
        name: "Jens Michael Peters Nielsen",
        role: "Innehaver",
        source: "BRREG_ROLLER",
        requiresConfirmation: true,
      },
    }),
  }));
  await page.route("**/api/prototype-tester-invites/preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        subject: "Du er invitert til CreatorHubs prototypeprogram",
        html: `<!doctype html><html lang="nb"><body><table role="presentation"><tr><td><img src="https://creatorhubn.com/creatorhub-wordmark-light.png" alt="CreatorHub Norge"><h1>Velkommen som prototype-tester</h1></td></tr></table></body></html>`,
        text: "Velkommen som prototype-tester",
        fromLabel: "CreatorHub Norge",
        fromAddress: "hello@creatorhubn.com",
        replyToEmail: "hello@creatorhubn.com",
        recipientEmail: ADMIN_EMAIL,
        expiresAt: "2026-09-24T12:00:00.000Z",
        agreements: ["Programvilkår", "NDA", "Databehandleravtale", "Intensjonsavtale"],
      }),
    });
  });
  await page.route(`**/api/prototype-tester-invites/${INVITE_ID}/retry`, async (route) => {
    retriedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, inviteId: INVITE_ID, step: "invite_email" }),
    });
  });

  return {
    sentBody: () => sentBody,
    retriedBody: () => retriedBody,
  };
}

test("inviterer Estremo via BRREG, kontrollerer e-post og sender én invitasjon", async ({ page }, testInfo) => {
  await installAdminSession(page);
  const api = await installInviteApi(page);

  await page.goto("/admin-room?adminTab=prototype-testers", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Prototype-testere" })).toBeVisible({ timeout: 60_000 });

  const existing = page.getByTestId(`prototype-tester-invite-${INVITE_ID}`);
  await expect(existing.getByText("1 feil")).toBeVisible();
  await existing.getByRole("button", { name: "Detaljer" }).click();
  await existing.getByRole("button", { name: "Prøv steget igjen" }).click();
  await expect.poll(api.retriedBody).toEqual({ step: "invite_email" });

  await page.getByRole("button", { name: "Inviter ny tester" }).click();
  const companySearch = page.getByRole("combobox", { name: "Søk bedrift i Brønnøysundregistrene" });
  await companySearch.focus();
  await companySearch.fill("Estremo Records");
  await page.getByRole("option", { name: /ESTREMO RECORDING STUDIOS/ }).click();
  await page.getByRole("button", { name: "Fortsett med bedrift" }).click();

  await expect(page.getByText(/BRREG foreslår Jens Michael Peters Nielsen/)).toBeVisible();
  await page.getByRole("button", { name: "Bruk navnet" }).click();
  await expect(page.getByLabel("Kontaktpersonens navn")).toHaveValue("Jens Michael Peters Nielsen");
  await expect(page.getByRole("combobox", { name: "Profesjon" })).toContainText("Musikkprodusent");
  await expect(page.getByText(/Høy sikkerhet: Næringskode 59.200/)).toBeVisible();
  await page.getByRole("textbox", { name: "E-post" }).fill(ADMIN_EMAIL);
  await page.getByRole("button", { name: /Bruk 5 forslag for Musikkprodusent/ }).click();
  await page.getByRole("button", { name: "Se e-post og kontroller" }).click();

  await expect(page.getByText("Du er invitert til CreatorHubs prototypeprogram")).toBeVisible();
  await expect(page.getByText("CreatorHub Norge <hello@creatorhubn.com>")).toBeVisible();
  await expect(page.getByText("Programvilkår, NDA, Databehandleravtale, Intensjonsavtale")).toBeVisible();
  const mailFrame = page.frameLocator('iframe[title="Forhåndsvisning av invitasjons-e-post"]');
  await expect(mailFrame.getByRole("img", { name: "CreatorHub Norge" })).toHaveAttribute(
    "src",
    "https://creatorhubn.com/creatorhub-wordmark-light.png",
  );

  const screenshot = testInfo.outputPath("prototype-invite-review.png");
  await page.locator(".MuiDialog-paper").screenshot({ path: screenshot, animations: "disabled" });
  await testInfo.attach("prototype-invite-review", { path: screenshot, contentType: "image/png" });

  await page.getByRole("button", { name: "Send invitasjon" }).click();
  await expect(page.getByText(`Invitasjon opprettet og e-post sendt til ${ADMIN_EMAIL}.`)).toBeVisible();
  await expect.poll(api.sentBody).toMatchObject({
    email: ADMIN_EMAIL,
    name: "Jens Michael Peters Nielsen",
    profession: "music_producer",
    company: "ESTREMO RECORDING STUDIOS JENS MICHAEL PETERS NIELSEN",
    organizationNumber: "998989159",
    testingAreas: [
      "CreatorHub-dashboard",
      "Prosjekt og arbeidsflyt",
      "Showcase og klient-godkjenning",
      "Kontrakt og fakturering",
      "Integrasjoner",
    ],
  });
});

test("prototype-admin er lesbar uten horisontal overflow @mobile", async ({ page }) => {
  await installAdminSession(page);
  await installInviteApi(page);
  await page.goto("/admin-room?adminTab=prototype-testers", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(`prototype-tester-invite-${INVITE_ID}`)).toBeVisible({ timeout: 60_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Inviter ny tester" })).toBeVisible();
});
