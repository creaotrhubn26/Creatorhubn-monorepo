import { expect, test } from "@playwright/test";
import {
  ADMIN_WORKSPACE_API_BASE as BACKEND,
  AUTH_TOKEN,
  AUTH_USER,
} from "./admin-workspace-e2e-support";

test.describe("Admin Workspace CV-bygger", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("importerer prosjektfil, verifiserer fakta og gjør CV-en til dokumentkilde", async ({
    page,
  }) => {
    const headers = { Authorization: `Bearer ${AUTH_TOKEN}` };
    const stamp = Date.now();
    let projectId: string | null = null;
    let targetDocumentId: string | null = null;
    let generatedDocumentId: string | null = null;
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await page.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem("creatorhub_auth_token", token);
        window.localStorage.setItem(
          "creatorhub_auth_user",
          JSON.stringify(user),
        );
        window.localStorage.setItem("userId", user.id);
        window.localStorage.setItem("userEmail", user.email);
      },
      { token: AUTH_TOKEN, user: AUTH_USER },
    );
    await page.route("**/api/auth/user", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true, user: AUTH_USER }),
      }),
    );

    try {
      const projectResponse = await page.request.post(
        `${BACKEND}/workspace/projects`,
        {
          headers,
          data: {
            title: `E2E CV-prosjekt ${stamp}`,
            productKey: "leadgrid",
            category: "funding",
            status: "active",
          },
        },
      );
      expect(projectResponse.status()).toBe(201);
      projectId = ((await projectResponse.json()) as { item: { id: string } })
        .item.id;

      const uploadResponse = await page.request.post(
        `${BACKEND}/workspace/projects/${projectId}/files`,
        {
          headers,
          multipart: {
            file: {
              name: `Daniel-Qazi-CV-${stamp}.txt`,
              mimeType: "text/plain",
              buffer: Buffer.from(
                [
                  "# Profil",
                  "",
                  "Daniel Qazi",
                  "Operativ gründer med bakgrunn fra salg, markedsføring, innholdsproduksjon og IT.",
                  "",
                  "# Erfaring",
                  "",
                  "Leadgrid",
                  "Har utviklet kode og design og arbeider operativt 100 prosent.",
                  "",
                  "Tidligere salgsarbeid",
                  "Resultater og tidsperiode må bekreftes.",
                  "",
                  "# Kompetanse",
                  "",
                  "Salg, markedsføring, innholdsproduksjon og produktutvikling",
                ].join("\n"),
              ),
            },
          },
        },
      );
      expect(uploadResponse.status()).toBe(201);

      const targetResponse = await page.request.post(
        `${BACKEND}/workspace/documents`,
        {
          headers,
          data: {
            title: `E2E søknad ${stamp}`,
            productKey: "leadgrid",
            documentType: "funding_application",
            content: "# Team og gjennomføring\n\n[MÅ FYLLES UT]",
          },
        },
      );
      expect(targetResponse.status()).toBe(201);
      targetDocumentId = (
        (await targetResponse.json()) as { item: { id: string } }
      ).item.id;
      expect(
        (
          await page.request.post(
            `${BACKEND}/workspace/documents/${targetDocumentId}/links`,
            {
              headers,
              data: { entityType: "workspace_project", entityId: projectId },
            },
          )
        ).status(),
      ).toBe(201);

      await page.goto(
        `/admin-workspace?view=projects&product=leadgrid&project=${projectId}`,
      );
      await page.getByTestId("open-cv-builder").click();
      const dialog = page.getByTestId("cv-import-dialog");
      await expect(dialog).toBeVisible({ timeout: 30_000 });
      await dialog.getByTestId("cv-person-name").fill("Daniel Qazi");
      await dialog
        .getByTestId("cv-source-url")
        .fill("https://www.linkedin.com/in/daniel-qazi-67a64760/");

      const importResponse = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/projects/${projectId}/cv-profiles/import`,
            ) && response.request().method() === "POST",
      );
      await dialog.getByTestId("cv-import-source").click();
      expect((await importResponse).status()).toBe(201);
      await expect(dialog.getByTestId("cv-facts-step")).toBeVisible();
      await expect(dialog.getByTestId("cv-facts-step")).toContainText(
        "Leadgrid",
      );
      await expect(dialog.getByTestId("cv-facts-step")).toContainText(
        "Må avklares",
      );

      const firstClaim = dialog.locator('[data-testid^="cv-claim-"]').first();
      const claimResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/claims/") &&
          response.request().method() === "PATCH",
      );
      await firstClaim.getByRole("button", { name: "Bekreft" }).click();
      expect((await claimResponse).status()).toBe(200);

      await dialog.getByRole("button", { name: "Mangler" }).click();
      const requiredAnswers: Record<string, string> = {
        current_role:
          "Gründer og produktutvikler i Leadgrid, operativt 100 prosent.",
        employment_history:
          "Lang erfaring fra salg, markedsføring, innholdsproduksjon og IT.",
        leadgrid_technical_scope:
          "Har selv utviklet kode, produktflyt og design for Leadgrid.",
        availability:
          "Tilgjengelig 100 prosent for markedsavklaringsprosjektet.",
      };
      for (const [key, answer] of Object.entries(requiredAnswers)) {
        const answerResponse = page.waitForResponse(
          (response) =>
            response.url().includes("/questions/") &&
            response.request().method() === "PATCH",
        );
        await dialog.getByTestId(`cv-question-${key}`).fill(answer);
        await dialog.getByTestId(`cv-question-save-${key}`).click();
        expect((await answerResponse).status()).toBe(200);
      }
      await expect(dialog.getByTestId("cv-gaps-step")).toContainText(
        "0 obligatoriske mangler",
      );

      await dialog.getByRole("button", { name: "CV-dokument" }).click();
      const generateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/generate") &&
          response.request().method() === "POST",
      );
      await dialog.getByTestId("cv-generate-document").click();
      const generateResponse = await generateResponsePromise;
      expect(generateResponse.status()).toBe(200);
      const generated = (await generateResponse.json()) as {
        profile: { generated_document_id: string };
      };
      generatedDocumentId = generated.profile.generated_document_id;
      await expect(dialog).toContainText("kan brukes inline som prosjektkilde");

      const documentResponse = await page.request.get(
        `${BACKEND}/workspace/documents/${generatedDocumentId}`,
        { headers },
      );
      expect(documentResponse.status()).toBe(200);
      const generatedDocument = (await documentResponse.json()) as {
        item: { document_type: string; content: string };
        links: Array<{ entity_id: string }>;
      };
      expect(generatedDocument.item.document_type).toBe("cv");
      expect(generatedDocument.item.content).toContain("Daniel Qazi");
      expect(
        generatedDocument.links.some((link) => link.entity_id === projectId),
      ).toBeTruthy();

      const libraryResponse = await page.request.get(
        `${BACKEND}/workspace/documents/${targetDocumentId}/context/library`,
        { headers },
      );
      expect(libraryResponse.status()).toBe(200);
      const library = (await libraryResponse.json()) as {
        items: Array<{
          source_type: string;
          source_id: string;
          title: string;
          connected: boolean;
        }>;
      };
      expect(library.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source_type: "workspace_document",
            source_id: generatedDocumentId,
            title: "CV — Daniel Qazi",
            connected: true,
          }),
        ]),
      );
      expect(runtimeErrors).toEqual([]);
    } finally {
      if (generatedDocumentId) {
        await page.request.delete(
          `${BACKEND}/workspace/documents/${generatedDocumentId}`,
          { headers },
        );
      }
      if (targetDocumentId) {
        await page.request.delete(
          `${BACKEND}/workspace/documents/${targetDocumentId}`,
          { headers },
        );
      }
      if (projectId) {
        await page.request.delete(
          `${BACKEND}/workspace/projects/${projectId}`,
          { headers },
        );
      }
    }
  });
});
