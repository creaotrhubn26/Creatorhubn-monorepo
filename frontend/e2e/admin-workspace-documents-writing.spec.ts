import { expect, test } from "@playwright/test";
import {
  ADMIN_WORKSPACE_API_BASE as BACKEND,
  AUTH_TOKEN,
  AUTH_USER,
} from "./admin-workspace-e2e-support";
import {
  cleanupOppstartApplicationFixture,
  createOppstartApplicationFixture,
  type OppstartApplicationFixture,
} from "./admin-workspace-e2e-fixtures";

test.describe("Admin Workspace dokumentbehandling", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("støtter seksjonsfokus, lokal skrivekontroll, kilder, portal og versjoner", async ({
    page,
  }) => {
    const runtimeErrors: string[] = [];
    let oppstartFixture: OppstartApplicationFixture | null = null;
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
      oppstartFixture = await createOppstartApplicationFixture(page.request);
      await page.goto(
        `/admin-workspace?view=documents&product=leadgrid&document=${oppstartFixture.documentId}`,
      );

      const workbench = page.getByTestId("oppstart-application-workbench");
      const workspace = page.getByTestId("document-writing-workspace");
      const editor = workspace
        .getByTestId("document-rich-text-surface")
        .locator(".tiptap");
      await expect(workbench).toBeVisible({ timeout: 30_000 });
      await expect(editor).toBeVisible();
      await expect(
        workspace.getByTestId("rich-text-format-toolbar"),
      ).toBeVisible();
      await expect(
        editor.locator(".workspace-open-field").first(),
      ).toBeVisible();
      expect(await editor.innerText()).not.toContain("## 1.");

      await workbench.getByTestId("application-details-toggle").click();
      await workbench.getByTestId("application-section-focus-1").click();
      await expect(
        workspace.getByTestId("document-section-focus-banner"),
      ).toBeVisible();
      await expect(editor).toContainText("1. Ideen — problem og kundeinnsikt");
      expect(await editor.innerText()).not.toContain(
        "2. Dagens alternativer og konkurrenter",
      );
      await workspace
        .getByRole("button", { name: "Vis hele dokumentet" })
        .click();
      await expect(editor).toContainText(
        "2. Dagens alternativer og konkurrenter",
      );
      expect(await editor.locator("table").count()).toBeGreaterThan(0);
      await editor.locator("td").first().click();
      await expect(
        workspace.getByTestId("rich-text-table-toolbar"),
      ).toBeVisible();

      await workspace.getByTestId("document-focus-toggle").click();
      await expect(page.getByTestId("document-list-panel")).toHaveCount(0);

      const writeBounds = await editor.boundingBox();
      expect(writeBounds?.width ?? 0).toBeLessThanOrEqual(840);
      await workspace.getByTestId("editor-mode-preview").click();
      const preview = workspace.getByTestId("document-preview");
      const previewPage = preview.getByTestId("document-preview-page");
      await expect(previewPage).toBeVisible();
      const previewBounds = await previewPage.boundingBox();
      expect(previewBounds?.width ?? 0).toBeLessThanOrEqual(840);
      expect(await preview.locator("table").count()).toBeGreaterThan(0);
      await expect(
        preview
          .getByRole("columnheader", { name: "Kostnad", exact: true })
          .first(),
      ).toBeVisible();
      await workspace.getByTestId("editor-mode-write").click();
      await workspace.getByTestId("document-focus-toggle").click();
      await expect(page.getByTestId("document-list-panel")).toBeVisible();

      await workbench.getByTestId("application-next-open").click();
      await expect
        .poll(() =>
          page.evaluate(() => window.getSelection()?.toString() ?? ""),
        )
        .toBe("[MÅ FYLLES UT]");

      await workbench.getByTestId("application-writing-review-open").click();
      const writingDialog = page.getByRole("dialog", {
        name: /Lokal skrivekontroll/u,
      });
      await expect(writingDialog).toContainText(
        "Teksten behandles lokalt i nettleseren",
      );
      await writingDialog.getByLabel("Kontroll").click();
      await page
        .getByRole("option", { name: /Finn dokumentasjonsgap/u })
        .click();
      await expect(
        writingDialog.getByTestId("writing-review-comparison"),
      ).toBeVisible();
      await writingDialog.getByRole("button", { name: "Avvis" }).click();

      await workbench.getByTestId("application-sources-open").click();
      const sourceDialog = page.getByRole("dialog", { name: /Kildebank/u });
      await expect(sourceDialog).toContainText(
        "leadgrid-oppstartstilskudd-1-report-source.md",
      );
      await sourceDialog.getByRole("button", { name: "Ferdig" }).click();

      await workbench.getByTestId("application-portal-export").click();
      const portalDialog = page.getByRole("dialog", {
        name: "Portaleksport — Oppstartstilskudd 1",
      });
      await expect(portalDialog).toContainText(
        "Dette er en kopieringsflate, ikke en direkte innsending.",
      );
      await expect(
        portalDialog.locator('[data-testid^="portal-field-"]'),
      ).toHaveCount(9);
      await portalDialog.getByRole("button", { name: "Lukk" }).click();

      await page.getByRole("tab", { name: /Versjoner/u }).click();
      await page.getByRole("button", { name: "Sammenlign" }).first().click();
      const versionDialog = page.getByRole("dialog", {
        name: /Sammenlign versjon/u,
      });
      await expect(versionDialog.getByTestId("version-comparison")).toBeVisible(
        {
          timeout: 30_000,
        },
      );
      await expect(versionDialog).toContainText("Valgt versjon");
      await expect(versionDialog).toContainText("Arbeidskopi");
      await versionDialog.getByRole("button", { name: "Lukk" }).click();

      expect(runtimeErrors).toEqual([]);
    } finally {
      await cleanupOppstartApplicationFixture(page.request, oppstartFixture);
    }
  });

  test("lagrer visuell formatering som Markdown og rydder testdokumentet", async ({
    page,
  }) => {
    let documentId: string | null = null;
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
      await page.goto("/admin-workspace?view=documents&product=leadgrid");
      await expect(page.getByTestId("workspace-documents")).toBeVisible({
        timeout: 30_000,
      });
      await page.getByTestId("create-document-button").click();
      await page
        .getByTestId("new-document-title-input")
        .locator("input")
        .fill("E2E — visuell dokumentredigering");

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/admin-room/workspace/documents") &&
          response.request().method() === "POST",
      );
      await page.getByTestId("confirm-create-document").click();
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(201);
      const created = (await createResponse.json()) as {
        item: { id: string };
      };
      documentId = created.item.id;

      await expect(
        page.getByTestId("document-title-input").locator("textarea").first(),
      ).toHaveValue("E2E — visuell dokumentredigering");
      const workspace = page.getByTestId("document-writing-workspace");
      const editor = workspace
        .getByTestId("document-rich-text-surface")
        .locator(".tiptap");
      const toolbar = workspace.getByTestId("rich-text-format-toolbar");
      await expect(editor).toBeVisible();

      const saveResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith("/api/admin-room/workspace/documents/" + documentId) &&
          response.request().method() === "PATCH",
      );
      await editor.click();
      await editor.type("Visuell arbeidsflate");
      await editor.press("Enter");
      await editor.type("Pilotnotat");
      await editor.press("Enter");

      await editor.getByText("Visuell arbeidsflate", { exact: true }).click();
      await toolbar
        .getByRole("button", { name: "Overskrift 1", exact: true })
        .click();
      await expect(editor.locator("h1")).toHaveText("Visuell arbeidsflate");

      const pilotText = editor.getByText("Pilotnotat", { exact: true });
      await pilotText.selectText();
      await expect
        .poll(() =>
          page.evaluate(() => window.getSelection()?.toString() ?? ""),
        )
        .toBe("Pilotnotat");
      await toolbar.getByRole("button", { name: "Fet", exact: true }).click();
      const boldPilotNote = editor
        .locator("strong")
        .filter({ hasText: "Pilotnotat" });
      await expect(boldPilotNote).toHaveText("Pilotnotat");

      await editor.locator("p").last().click();
      await editor.type("/");
      const slashMenu = workspace.getByTestId("rich-text-slash-menu");
      await expect(slashMenu).toBeVisible();
      await slashMenu
        .getByRole("button", { name: "Sitat", exact: true })
        .click();
      await editor.type("Slashmeny");
      await editor.press("Enter");

      const insertionPoint = editor.locator("p").last();
      await insertionPoint.click({ position: { x: 8, y: 8 } });
      await toolbar.getByTestId("rich-text-insert-page-break").click();
      await expect(editor.locator(".workspace-page-break")).toBeVisible();
      await editor.locator("p").last().click();
      await toolbar.getByTestId("rich-text-insert-table").click();
      await expect(editor.locator("h1")).toHaveText("Visuell arbeidsflate");
      await expect(boldPilotNote).toHaveText("Pilotnotat");
      await expect(editor.locator("table")).toBeVisible();
      await workspace.getByTestId("document-search-toggle").click();
      const searchPanel = workspace.getByTestId("document-search-panel");
      await searchPanel.getByLabel("Finn i dokumentet").fill("Pilotnotat");
      await searchPanel.getByLabel("Erstatt med").fill("Pilotmerknad");
      await searchPanel
        .getByRole("button", { name: "Erstatt alle", exact: true })
        .click();
      await expect(editor).toContainText("Pilotmerknad");

      await editor.getByText("Pilotmerknad", { exact: true }).selectText();
      await workspace.getByTestId("rich-text-add-comment").click();
      const review = page.getByTestId("document-review-panel");
      await expect(review).toBeVisible();
      await expect(
        review.getByTestId("document-comment-selection"),
      ).toContainText("Pilotmerknad");
      await review.getByLabel("Ansvarlig").fill("Daniel Qazi");
      await review
        .getByTestId("document-comment-body")
        .getByRole("textbox")
        .fill("Kontroller pilotformuleringen.");
      const commentResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/documents/${documentId}/comments`,
            ) && response.request().method() === "POST",
      );
      await review.getByTestId("document-comment-submit").click();
      expect((await commentResponsePromise).status()).toBe(201);
      await expect(review).toContainText("Kontroller pilotformuleringen.");
      await review.getByRole("button", { name: /Sluttkontroll/u }).click();
      await expect(
        review.getByTestId("document-preflight-summary"),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Innhold", exact: true }).click();
      await workspace.getByTestId("editor-mode-preview").click();
      await expect(
        workspace.getByTestId("document-preview-page-break"),
      ).toBeVisible();
      await workspace.getByTestId("editor-mode-write").click();

      const saveResponse = await saveResponsePromise;
      expect(saveResponse.status()).toBe(200);
      let persistedContent = "";
      await expect
        .poll(
          async () => {
            const detailResponse = await page.request.get(
              `${BACKEND}/workspace/documents/${documentId}`,
              {
                headers: {
                  Authorization: "Bearer " + AUTH_TOKEN,
                },
              },
            );
            if (!detailResponse.ok()) return "";
            const detail = (await detailResponse.json()) as {
              item: { content: string };
            };
            persistedContent = detail.item.content;
            return persistedContent;
          },
          { timeout: 30_000, intervals: [500, 1_000, 2_000] },
        )
        .toContain("Pilotmerknad");
      expect(persistedContent).toContain("# Visuell arbeidsflate");
      expect(persistedContent).toContain("**Pilotmerknad**");
      expect(persistedContent).toContain("[SIDESKIFT]");
      expect(persistedContent).toContain("|");
      const detailResponse = await page.request.get(
        `${BACKEND}/workspace/documents/${documentId}`,
        { headers: { Authorization: "Bearer " + AUTH_TOKEN } },
      );
      expect(detailResponse.ok()).toBeTruthy();
      const detail = (await detailResponse.json()) as {
        item: { updated_at: string; version_no: number };
        comments: Array<{ body: string; assignee: string | null }>;
        versions: Array<{ change_note: string | null }>;
      };
      expect(detail.comments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            body: "Kontroller pilotformuleringen.",
            assignee: "Daniel Qazi",
          }),
        ]),
      );
      expect(
        detail.versions.some((version) =>
          version.change_note?.startsWith("Automatisk lagring"),
        ),
      ).toBeTruthy();
      const docxResponse = await page.request.get(
        `${BACKEND}/workspace/documents/${documentId}/export.docx`,
        { headers: { Authorization: "Bearer " + AUTH_TOKEN } },
      );
      expect(docxResponse.ok()).toBeTruthy();
      expect(docxResponse.headers()["content-type"]).toContain(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      expect((await docxResponse.body()).byteLength).toBeGreaterThan(1_000);
      const conflictResponse = await page.request.patch(
        `${BACKEND}/workspace/documents/${documentId}`,
        {
          headers: { Authorization: "Bearer " + AUTH_TOKEN },
          data: {
            summary: "Denne endringen skal avvises",
            expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
          },
        },
      );
      expect(conflictResponse.status()).toBe(409);
      expect((await conflictResponse.json()).code).toBe("DOCUMENT_CONFLICT");
    } finally {
      if (documentId) {
        const deleteResponse = await page.request.delete(
          `${BACKEND}/workspace/documents/${documentId}`,
          {
            headers: {
              Authorization: "Bearer " + AUTH_TOKEN,
            },
          },
        );
        expect(deleteResponse.ok()).toBeTruthy();
      }
    }
  });

  test("leser en CV og setter inn et kildebasert forslag ved markøren", async ({
    page,
  }) => {
    let documentId: string | null = null;
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
      const createResponse = await page.request.post(
        `${BACKEND}/workspace/documents`,
        {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
          data: {
            title: "E2E — smart dokumentkontekst",
            productKey: "leadgrid",
            documentType: "funding_application",
            content: "# Team og gjennomføringsevne\n\n[MÅ FYLLES UT]",
          },
        },
      );
      expect(createResponse.status()).toBe(201);
      documentId = ((await createResponse.json()) as { item: { id: string } })
        .item.id;

      await page.goto(
        `/admin-workspace?view=documents&product=leadgrid&document=${documentId}`,
      );
      const documentEditor = page
        .getByTestId("document-writing-workspace")
        .getByTestId("document-content-editor");
      const inlineAssistant = documentEditor.getByTestId(
        "smart-context-inline",
      );
      await expect(inlineAssistant).toBeVisible({ timeout: 30_000 });
      await expect(
        documentEditor.getByTestId("document-inline-assistant-anchor"),
      ).toHaveAttribute("data-caret-position", /\d+/u);

      await page.getByRole("tab", { name: /Vedlegg/u }).click();
      const uploadResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/documents/${documentId}/files`,
            ) && response.request().method() === "POST",
      );
      await page.locator('input[type="file"]').setInputFiles({
        name: "Daniel-Qazi-CV.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(
          [
            "DANIEL QAZI — CV",
            "ERFARING OG KOMPETANSE",
            "Daniel Qazi arbeider operativt med Leadgrid på fulltid.",
            "Han har lang erfaring fra salg, markedsføring, innholdsproduksjon, IT og teknisk produktutvikling.",
            "Han har ansvar for kode, design, kundeinnsikt og kommersiell gjennomføring.",
          ].join("\n"),
        ),
      });
      expect((await uploadResponsePromise).status()).toBe(201);
      await expect(
        page.getByTestId("document-file-context-status"),
      ).toContainText("Aktiv kontekstkilde");

      await page.getByRole("tab", { name: "Innhold", exact: true }).click();
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
      const suggestion = inlineAssistant.getByTestId(
        "smart-context-suggestion",
      );
      await expect(suggestion).toContainText("Daniel-Qazi-CV.txt", {
        timeout: 20_000,
      });
      await expect(suggestion).toContainText("markedsføring");
      await suggestion.getByTestId("smart-context-insert-text").click();

      const editor = page
        .getByTestId("document-writing-workspace")
        .getByTestId("document-rich-text-surface")
        .locator(".tiptap");
      await expect(editor).toContainText("teknisk produktutvikling");
      await expect
        .poll(
          async () => {
            const detailResponse = await page.request.get(
              `${BACKEND}/workspace/documents/${documentId}`,
              { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } },
            );
            if (!detailResponse.ok()) return "";
            return (
              (await detailResponse.json()) as { item: { content: string } }
            ).item.content;
          },
          { timeout: 30_000 },
        )
        .toContain("teknisk produktutvikling");
      expect(runtimeErrors).toEqual([]);
    } finally {
      if (documentId) {
        const deleteResponse = await page.request.delete(
          `${BACKEND}/workspace/documents/${documentId}`,
          { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } },
        );
        expect(deleteResponse.ok()).toBeTruthy();
      }
    }
  });

  test("kobler et annet workspace-dokument og forhåndsviser originalkilden", async ({
    page,
  }) => {
    let sourceId: string | null = null;
    let targetId: string | null = null;
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

    const createDocument = async (title: string, content: string) => {
      const response = await page.request.post(
        `${BACKEND}/workspace/documents`,
        {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
          data: {
            title,
            productKey: "leadgrid",
            documentType: "funding_application",
            content,
          },
        },
      );
      expect(response.status()).toBe(201);
      return ((await response.json()) as { item: { id: string } }).item.id;
    };

    try {
      sourceId = await createDocument(
        "E2E — universell workspace-kilde",
        "# Kundeinnsikt\n\nTre pilotkunder beskriver manuell leadoppfølging som tidkrevende og ønsker en samlet arbeidsflate med tydelige neste handlinger.",
      );
      targetId = await createDocument(
        "E2E — mål for universell kilde",
        "# Markedsbehov og kundeinnsikt\n\n[MÅ FYLLES UT]",
      );
      await page.goto(
        `/admin-workspace?view=documents&product=leadgrid&document=${targetId}`,
      );
      await page.getByTestId("smart-context-library-open").click();
      const libraryDialog = page.getByRole("dialog", {
        name: "Kontekstbibliotek",
      });
      const sourceRow = libraryDialog.locator(`[data-source-id="${sourceId}"]`);
      await expect(sourceRow).toContainText(
        "E2E — universell workspace-kilde",
        { timeout: 20_000 },
      );
      const linkResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/documents/${targetId}/context/sources`,
            ) && response.request().method() === "POST",
      );
      await sourceRow.getByTestId("smart-context-source-toggle").click();
      expect((await linkResponsePromise).status()).toBe(201);
      await libraryDialog.getByRole("button", { name: "Ferdig" }).click();

      await page.getByTestId("smart-context-refresh").click();
      const suggestion = page.getByTestId("smart-context-suggestion").first();
      await expect(suggestion).toContainText(
        "E2E — universell workspace-kilde",
        { timeout: 20_000 },
      );
      await expect(suggestion).toContainText("pilotkunder");
      await suggestion.getByRole("button", { name: "Vis kilde" }).click();
      const previewDialog = page.getByRole("dialog", {
        name: "E2E — universell workspace-kilde",
      });
      await expect(previewDialog).toContainText("manuell leadoppfølging");
      await previewDialog.getByRole("button", { name: "Lukk" }).click();
    } finally {
      for (const id of [targetId, sourceId]) {
        if (!id) continue;
        const response = await page.request.delete(
          `${BACKEND}/workspace/documents/${id}`,
          { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } },
        );
        expect(response.ok()).toBeTruthy();
      }
    }
  });
});
