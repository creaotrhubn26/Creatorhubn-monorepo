import { expect, test } from "@playwright/test";
import {
  ADMIN_WORKSPACE_API_BASE as BACKEND,
  AUTH_TOKEN,
  AUTH_USER,
} from "./admin-workspace-e2e-support";

test.describe("Admin Workspace prosjektfiler", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("gjør en prosjektfil til inline kilde i alle koblede dokumenter", async ({
    page,
  }) => {
    let projectId: string | null = null;
    let documentId: string | null = null;
    let projectFileId: string | null = null;
    const stamp = Date.now();
    const projectTitle = `E2E — markedsavklaring ${stamp}`;
    const fileName = `kundeintervju-${stamp}.txt`;
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

    const headers = { Authorization: `Bearer ${AUTH_TOKEN}` };
    try {
      const createProjectResponse = await page.request.post(
        `${BACKEND}/workspace/projects`,
        {
          headers,
          data: {
            title: projectTitle,
            summary: "Markedsavklaring og pilotintervjuer for Leadgrid",
            productKey: "leadgrid",
            category: "market_outreach",
            status: "active",
          },
        },
      );
      expect(createProjectResponse.status()).toBe(201);
      projectId = (
        (await createProjectResponse.json()) as { item: { id: string } }
      ).item.id;

      await page.goto(
        `/admin-workspace?view=projects&product=leadgrid&project=${projectId}`,
      );
      const fileBank = page.getByTestId("project-file-bank");
      await expect(fileBank).toBeVisible({ timeout: 30_000 });

      const uploadResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/projects/${projectId}/files`,
            ) && response.request().method() === "POST",
      );
      await fileBank.getByTestId("project-file-input").setInputFiles({
        name: fileName,
        mimeType: "text/plain",
        buffer: Buffer.from(
          "KUNDEINTERVJU LEADGRID\nPilotkundene trenger raskere kvalifisering og tydelig eierskap til neste handling.",
        ),
      });
      const uploadResponse = await uploadResponsePromise;
      expect(uploadResponse.status()).toBe(201);
      projectFileId = (
        (await uploadResponse.json()) as { item: { id: string } }
      ).item.id;
      const fileRow = fileBank.getByTestId(`project-file-row-${projectFileId}`);
      await expect(fileRow).toContainText(fileName);
      await expect(fileRow).toContainText("Klar som kilde", {
        timeout: 20_000,
      });
      await expect(fileRow).toContainText("v1");

      const replaceResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/projects/${projectId}/files/${projectFileId}/replace`,
            ) && response.request().method() === "POST",
      );
      const chooserPromise = page.waitForEvent("filechooser");
      await fileRow
        .getByRole("button", { name: `Ny versjon av ${fileName}` })
        .click();
      const chooser = await chooserPromise;
      await chooser.setFiles({
        name: fileName,
        mimeType: "text/plain",
        buffer: Buffer.from(
          [
            "KUNDEINTERVJU LEADGRID — VERSJON 2",
            "Fem pilotkunder beskriver manuell leadoppfølging som tidkrevende.",
            "De trenger raskere kvalifisering, tydelig eierskap og en konkret neste handling i samme arbeidsflate.",
          ].join("\n"),
        ),
      });
      expect((await replaceResponsePromise).status()).toBe(200);
      await expect(
        fileBank.getByTestId(`project-file-row-${projectFileId}`),
      ).toContainText("v2", {
        timeout: 20_000,
      });

      const createDocumentResponse = await page.request.post(
        `${BACKEND}/workspace/documents`,
        {
          headers,
          data: {
            title: `E2E — prosjektdokument ${stamp}`,
            productKey: "leadgrid",
            documentType: "funding_application",
            content: "# Markedsbehov og kundeinnsikt\n\n[MÅ FYLLES UT]",
          },
        },
      );
      expect(createDocumentResponse.status()).toBe(201);
      documentId = (
        (await createDocumentResponse.json()) as { item: { id: string } }
      ).item.id;

      const linkResponse = await page.request.post(
        `${BACKEND}/workspace/documents/${documentId}/links`,
        {
          headers,
          data: { entityType: "workspace_project", entityId: projectId },
        },
      );
      expect(linkResponse.status()).toBe(201);

      await page.goto(
        `/admin-workspace?view=documents&product=leadgrid&document=${documentId}`,
      );
      const inlineAssistant = page.getByTestId("smart-context-inline");
      await expect(inlineAssistant).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("smart-context-library-open").click();
      const library = page.getByRole("dialog", { name: "Kontekstbibliotek" });
      const sourceRow = library.locator(`[data-source-id="${projectFileId}"]`);
      await expect(sourceRow).toContainText(fileName, { timeout: 20_000 });
      await expect(sourceRow).toContainText("Prosjektfil");
      await expect(sourceRow).toContainText("Delt i prosjektet");
      await expect(sourceRow).toContainText(projectTitle);
      await expect(
        sourceRow.getByTestId("smart-context-source-toggle"),
      ).toHaveText("Ikke bruk her");

      const disableResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/documents/${documentId}/context/project-files/${projectFileId}`,
            ) && response.request().method() === "PATCH",
      );
      await sourceRow.getByTestId("smart-context-source-toggle").click();
      expect((await disableResponsePromise).status()).toBe(200);
      await expect(
        sourceRow.getByTestId("smart-context-source-toggle"),
      ).toHaveText("Bruk her");

      const enableResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/documents/${documentId}/context/project-files/${projectFileId}`,
            ) && response.request().method() === "PATCH",
      );
      await sourceRow.getByTestId("smart-context-source-toggle").click();
      expect((await enableResponsePromise).status()).toBe(200);
      await expect(
        sourceRow.getByTestId("smart-context-source-toggle"),
      ).toHaveText("Ikke bruk her");
      await library.getByRole("button", { name: "Ferdig" }).click();

      const suggestionResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/documents/${documentId}/context/suggestions`,
            ) && response.request().method() === "POST",
      );
      await page.getByTestId("smart-context-refresh").click();
      expect((await suggestionResponsePromise).status()).toBe(200);
      const suggestion = page.getByTestId("smart-context-suggestion").first();
      await expect(suggestion).toContainText(fileName, { timeout: 20_000 });
      await expect(suggestion).toContainText("pilotkunder");
      await suggestion.getByRole("button", { name: "Vis kilde" }).click();
      const preview = page.getByRole("dialog", { name: fileName });
      await expect(preview).toContainText("manuell leadoppfølging");
      await preview.getByRole("button", { name: "Lukk" }).click();

      await suggestion.getByTestId("smart-context-insert-text").click();
      const editor = page
        .getByTestId("document-writing-workspace")
        .getByTestId("document-rich-text-surface")
        .locator(".tiptap");
      await expect(editor).toContainText("konkret neste handling");

      const downloadResponse = await page.request.get(
        `${BACKEND}/workspace/projects/${projectId}/files/${projectFileId}/download`,
        { headers },
      );
      expect(downloadResponse.status()).toBe(200);
      expect(await downloadResponse.text()).toContain("VERSJON 2");
      expect(runtimeErrors).toEqual([]);
    } finally {
      if (documentId) {
        const response = await page.request.delete(
          `${BACKEND}/workspace/documents/${documentId}`,
          {
            headers,
          },
        );
        expect(response.ok()).toBeTruthy();
      }
      if (projectId) {
        const response = await page.request.delete(
          `${BACKEND}/workspace/projects/${projectId}`,
          {
            headers,
          },
        );
        expect(response.ok()).toBeTruthy();
      }
    }
  });
});
