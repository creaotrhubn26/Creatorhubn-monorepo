import { expect, test } from "@playwright/test";
import {
  ADMIN_WORKSPACE_API_BASE as BACKEND,
  AUTH_TOKEN,
  AUTH_USER,
} from "./admin-workspace-e2e-support";
import {
  cleanupOppstartApplicationFixture,
  createOppstartApplicationFixture,
  installOppstartPlanResponseOverride,
  type OppstartApplicationFixture,
} from "./admin-workspace-e2e-fixtures";

test.describe("Admin Workspace kalender", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("oppretter, redigerer og sletter egen kalenderhendelse", async ({
    page,
  }) => {
    const runtimeErrors: string[] = [];
    const failedCalendarCalls: string[] = [];
    let cleanupEventId: string | null = null;
    let cleanupFundingId: string | null = null;
    let oppstartFixture: OppstartApplicationFixture | null = null;

    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("response", (response) => {
      if (
        response.url().includes("/api/admin-room/workspace/calendar") &&
        response.status() >= 500
      ) {
        failedCalendarCalls.push(`${response.status()} ${response.url()}`);
      }
    });

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
    await page.route("**/api/auth/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true, user: AUTH_USER }),
      });
    });

    try {
      oppstartFixture = await createOppstartApplicationFixture(page.request);
      await installOppstartPlanResponseOverride(page, oppstartFixture);
      await page.goto("/admin-workspace?view=calendar&product=leadgrid", {
        waitUntil: "domcontentloaded",
      });
      await expect(page.getByTestId("workspace-calendar")).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        page.getByRole("heading", { name: "Kalender — Leadgrid" }),
      ).toBeVisible();

      const radar = page.getByTestId("funding-deadline-radar");
      await expect(radar).toBeVisible();
      const seedResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith("/api/admin-room/workspace/funding-opportunities/seed") &&
          response.request().method() === "POST",
      );
      await radar.getByTestId("funding-radar-seed").click();
      expect((await seedResponsePromise).status()).toBe(200);
      await expect(
        radar.getByText("Oppstartstilskudd 1", { exact: true }),
      ).toBeVisible();
      await expect(
        radar.getByText("SkatteFUNN 2026 — garantifrist", { exact: true }),
      ).toBeVisible();
      const oppstartPlaybook = radar.getByTestId(
        "oppstartstilskudd-1-playbook",
      );
      await expect(oppstartPlaybook).toContainText(
        "Målet nå: lag den innsendingsklare søknaden",
      );
      await expect(oppstartPlaybook).toContainText("Maks 150 000 kr");
      await expect(oppstartPlaybook).toContainText("Kun eksterne kostnader");
      await expect(oppstartPlaybook).toContainText("3–4 uker behandling");
      await expect(
        oppstartPlaybook.getByTestId("oppstartstilskudd-open-application"),
      ).toBeVisible();
      await expect(
        oppstartPlaybook.getByTestId("oppstartstilskudd-open-plan"),
      ).toBeVisible();

      await oppstartPlaybook
        .getByTestId("oppstartstilskudd-open-application")
        .click();
      await expect(page).toHaveURL(/view=documents.*document=/u);
      await expect(page.getByTestId("workspace-documents")).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        page.getByTestId("document-title-input").locator("textarea").first(),
      ).toHaveValue("Oppstartstilskudd 1 — Leadgrid markedsavklaring");
      const workbench = page.getByTestId("oppstart-application-workbench");
      await expect(workbench).toBeVisible();
      await expect(
        workbench.getByTestId("oppstart-application-progress"),
      ).toContainText("søknadsdeler klare");
      await expect(
        workbench.getByTestId("oppstart-application-progress"),
      ).toContainText("4 av 9 søknadsdeler klare");
      await expect(
        workbench.getByTestId("oppstart-application-progress"),
      ).toContainText("6 svarfelt gjenstår");
      await expect(workbench).toContainText("Kvalifisering 6/8");
      await expect(workbench).toContainText("3 vedlegg koblet");
      const writingWorkspace = page.getByTestId("document-writing-workspace");
      await expect(writingWorkspace).toBeVisible();
      await expect(
        writingWorkspace.getByTestId("document-editor-toolbar"),
      ).toBeVisible();
      await expect(page.getByTestId("document-inspector")).toContainText(
        "Dokumentkontroll",
      );
      await expect(
        page.getByTestId("document-rich-text-surface").locator(".tiptap"),
      ).toContainText(/1\. Ideen — problem og kundeinnsikt/u);

      await writingWorkspace.getByTestId("editor-mode-preview").click();
      await expect(
        writingWorkspace.getByTestId("document-preview"),
      ).toBeVisible();
      await expect(
        writingWorkspace.getByTestId("document-preview"),
      ).toContainText("Ideen — problem og kundeinnsikt");
      await writingWorkspace.getByTestId("editor-mode-split").click();
      await expect(
        writingWorkspace.getByTestId("document-content-editor"),
      ).toBeVisible();
      await expect(
        writingWorkspace.getByTestId("document-preview"),
      ).toBeVisible();
      await writingWorkspace.getByTestId("editor-mode-write").click();

      await writingWorkspace.getByTestId("document-focus-toggle").click();
      await expect(page.getByTestId("document-list-panel")).toHaveCount(0);
      await expect(page.getByTestId("document-inspector")).toHaveCount(0);
      await expect(
        writingWorkspace.getByTestId("document-outline"),
      ).toContainText("Dokumentstruktur");
      await writingWorkspace.getByTestId("document-focus-toggle").click();
      await expect(page.getByTestId("document-list-panel")).toBeVisible();

      await page.goto("/admin-workspace?view=calendar&product=leadgrid");
      await expect(radar).toBeVisible({ timeout: 30_000 });

      const fundingStamp = Date.now();
      const fundingName = `E2E støtteordning ${fundingStamp}`;
      await radar.getByTestId("funding-radar-create").click();
      const fundingDialog = page.getByRole("dialog", {
        name: "Ny støtteordning",
      });
      await expect(fundingDialog).toBeVisible();
      await fundingDialog.getByLabel("Tilbyder").fill("E2E offentlig aktør");
      await fundingDialog.getByLabel("Ordning").fill(fundingName);
      await fundingDialog
        .getByRole("textbox", { name: "Frist", exact: true })
        .fill("2026-09-15");
      await fundingDialog.getByLabel("Fristnotat").fill("Verifisert E2E-frist");
      await fundingDialog
        .getByLabel("Offisiell kilde")
        .fill("https://example.com/offisiell-stotte");
      const createFundingResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith("/api/admin-room/workspace/funding-opportunities") &&
          response.request().method() === "POST",
      );
      await fundingDialog
        .getByRole("button", { name: "Lagre ordning" })
        .click();
      const createFundingResponse = await createFundingResponsePromise;
      expect(createFundingResponse.status()).toBe(201);
      cleanupFundingId = (await createFundingResponse.json()).item.id;

      const fundingCard = page.getByTestId(
        `funding-radar-item-${cleanupFundingId}`,
      );
      await expect(
        fundingCard.getByText(fundingName, { exact: true }),
      ).toBeVisible();
      await fundingCard.getByRole("button", { name: "Rediger" }).click();
      const editFundingDialog = page.getByRole("dialog", {
        name: "Rediger støtteordning",
      });
      const updatedFundingName = `${fundingName} oppdatert`;
      await editFundingDialog.getByLabel("Ordning").fill(updatedFundingName);
      const updateFundingResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/funding-opportunities/${cleanupFundingId}`,
            ) && response.request().method() === "PATCH",
      );
      await editFundingDialog
        .getByRole("button", { name: "Lagre ordning" })
        .click();
      expect((await updateFundingResponsePromise).status()).toBe(200);
      await expect(
        fundingCard.getByText(updatedFundingName, { exact: true }),
      ).toBeVisible();

      await fundingCard.getByRole("button", { name: "Rediger" }).click();
      page.once("dialog", (browserDialog) => browserDialog.accept());
      const deleteFundingResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/funding-opportunities/${cleanupFundingId}`,
            ) && response.request().method() === "DELETE",
      );
      await page
        .getByRole("dialog", { name: "Rediger støtteordning" })
        .getByRole("button", { name: "Slett" })
        .click();
      expect((await deleteFundingResponsePromise).status()).toBe(200);
      cleanupFundingId = null;
      await expect(fundingCard).not.toBeVisible();

      await page.getByTestId("workspace-calendar-create").click();
      await expect(
        page.getByRole("dialog", { name: "Ny kalenderhendelse" }),
      ).toBeVisible();

      const stamp = Date.now();
      const originalTitle = `E2E markedssamtale ${stamp}`;
      const updatedTitle = `E2E markedssamtale oppdatert ${stamp}`;
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Tittel").fill(originalTitle);
      await dialog
        .getByLabel("Beskrivelse")
        .fill("Planlegg neste kontakt med markedet.");
      await dialog.getByLabel("Dato").fill("2026-08-28");
      await dialog.getByLabel("Starttid").fill("10:00");
      await dialog.getByLabel("Sluttid").fill("11:00");
      await dialog.getByLabel("Sted").fill("Google Meet");
      await dialog.getByLabel("Ansvarlig").fill("Daniel");
      await dialog.getByLabel("Møtelenke").fill("https://meet.example.com/e2e");
      await dialog.getByLabel("Etiketter").fill("marked, oppfølging");

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith("/api/admin-room/workspace/calendar/events") &&
          response.request().method() === "POST",
      );
      await dialog.getByRole("button", { name: "Opprett hendelse" }).click();
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(201);
      const created = await createResponse.json();
      cleanupEventId = created.item.entity_id;

      const detail = page.getByTestId("workspace-calendar-detail");
      await expect(detail.getByText(originalTitle)).toBeVisible();
      await expect(detail.getByText("Google Meet")).toBeVisible();
      await expect(detail.getByText("Daniel")).toBeVisible();

      await detail.getByRole("button", { name: "Rediger hendelsen" }).click();
      await expect(
        page.getByRole("dialog", { name: "Rediger hendelse" }),
      ).toBeVisible();
      const editDialog = page.getByRole("dialog");
      await editDialog.getByLabel("Tittel").fill(updatedTitle);

      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/calendar/events/${cleanupEventId}`,
            ) && response.request().method() === "PATCH",
      );
      await editDialog.getByRole("button", { name: "Lagre hendelse" }).click();
      expect((await updateResponsePromise).status()).toBe(200);
      await expect(detail.getByText(updatedTitle)).toBeVisible();

      page.once("dialog", (browserDialog) => browserDialog.accept());
      const deleteResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/admin-room/workspace/calendar/events/${cleanupEventId}`,
            ) && response.request().method() === "DELETE",
      );
      await detail.getByRole("button", { name: "Slett hendelsen" }).click();
      expect((await deleteResponsePromise).status()).toBe(200);
      cleanupEventId = null;
      await expect(detail).not.toBeVisible();

      expect(failedCalendarCalls).toEqual([]);
      expect(runtimeErrors).toEqual([]);
    } finally {
      if (cleanupFundingId) {
        await page.request.delete(
          `${BACKEND}/workspace/funding-opportunities/${cleanupFundingId}`,
          { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } },
        );
      }
      if (cleanupEventId) {
        await page.request.delete(
          `${BACKEND}/workspace/calendar/events/${cleanupEventId}`,
          { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } },
        );
      }
      await cleanupOppstartApplicationFixture(page.request, oppstartFixture);
    }
  });

  test("holder månedskalenderen innenfor layouten på mindre desktop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem("creatorhub_auth_token", token);
        window.localStorage.setItem(
          "creatorhub_auth_user",
          JSON.stringify(user),
        );
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

    await page.goto("/admin-workspace?view=calendar&product=role-room");
    const calendar = page.getByTestId("workspace-calendar");
    await expect(calendar).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Kalender — The Role Room" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Neste måned" }).click();
    await page.getByRole("button", { name: "Forrige måned" }).click();

    const box = await calendar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1281);
    await expect(page.getByTestId("workspace-calendar-grid")).toBeVisible();
    await expect(page.getByTestId("workspace-calendar-agenda")).toBeVisible();
  });

  test("bevarer nabofanene i Admin Workspace", async ({ page }) => {
    const failedWorkspaceCalls: string[] = [];
    await page.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem("creatorhub_auth_token", token);
        window.localStorage.setItem(
          "creatorhub_auth_user",
          JSON.stringify(user),
        );
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
    page.on("response", (response) => {
      if (
        response.url().includes("/api/admin-room/workspace/") &&
        response.status() >= 500
      ) {
        failedWorkspaceCalls.push(`${response.status()} ${response.url()}`);
      }
    });

    const views = [
      { view: "tasks", marker: "workspace-tasks" },
      { view: "projects", marker: "workspace-projects" },
      { view: "documents", marker: "workspace-documents" },
    ];
    for (const { view, marker } of views) {
      await page.goto(`/admin-workspace?view=${view}&product=leadgrid`);
      await expect(page.getByTestId(marker)).toBeVisible({ timeout: 30_000 });
    }

    await page.goto("/admin-workspace?view=cases&product=leadgrid");
    await expect(page.getByRole("button", { name: "Ny sak" })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto("/admin-workspace?view=calendar&product=leadgrid");
    await expect(page.getByTestId("workspace-calendar")).toBeVisible({
      timeout: 30_000,
    });
    expect(failedWorkspaceCalls).toEqual([]);
  });
  test("viser komplett kundeintervju- og pilotoppsett i Leadgrid", async ({
    page,
  }) => {
    const runtimeErrors: string[] = [];
    const failedWorkspaceCalls: string[] = [];

    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("response", (response) => {
      if (
        response.url().includes("/api/admin-room/workspace/") &&
        response.status() >= 500
      ) {
        failedWorkspaceCalls.push(`${response.status()} ${response.url()}`);
      }
    });
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
    const documentIds: string[] = [];
    const taskIds: string[] = [];
    const eventIds: string[] = [];
    const createDocument = async (title: string, content: string) => {
      const response = await page.request.post(
        `${BACKEND}/workspace/documents`,
        {
          headers,
          data: {
            title,
            productKey: "leadgrid",
            documentType: "other",
            tags: ["e2e", "kundeintervju", "pilot"],
            content,
          },
        },
      );
      expect(response.status()).toBe(201);
      const id = ((await response.json()) as { item: { id: string } }).item.id;
      documentIds.push(id);
      return id;
    };
    const createTask = async (title: string, status: "todo" | "done") => {
      const response = await page.request.post(`${BACKEND}/workspace/tasks`, {
        headers,
        data: {
          title,
          productKey: "leadgrid",
          status,
          priority: "high",
          tags: ["e2e", "pilot"],
        },
      });
      expect(response.status()).toBe(201);
      taskIds.push(
        ((await response.json()) as { item: { id: string } }).item.id,
      );
    };
    const createEvent = async (title: string, day: number, hour: number) => {
      const now = new Date();
      const startsAt = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day, hour),
      );
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1_000);
      const response = await page.request.post(
        `${BACKEND}/workspace/calendar/events`,
        {
          headers,
          data: {
            title,
            productKey: "leadgrid",
            eventType: "deadline",
            status: "confirmed",
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            tags: ["e2e", "pilot"],
          },
        },
      );
      expect(response.status()).toBe(201);
      eventIds.push(
        ((await response.json()) as { item: { entity_id: string } }).item
          .entity_id,
      );
    };

    try {
      const playbookId = await createDocument(
        "Leadgrid — kundeintervju- og pilotplaybook",
        "# Kundeintervju- og pilotplaybook\n\nMålet er minst 12 relevante kundesamtaler før beslutning om pilot.",
      );
      const evidenceLogId = await createDocument(
        "Leadgrid — prospekt-, intervju- og kjøpssignallogg",
        [
          "# Prospekt-, intervju- og kjøpssignallogg",
          "",
          "| Kontrollpunkt | Mål | Status |",
          "|---|---:|---|",
          "| Relevante prospekter vurdert | 20 | Klar for kvalifisering |",
          "",
          "MELBYE AS (941 009 697)",
          "",
          "RENHOLDSBEDRIFTEN AS (995 425 300)",
          "",
          "Ingen henvendelser er sendt.",
        ].join("\n"),
      );
      const pilotPackageId = await createDocument(
        "Leadgrid — pilot- og LOI-pakke",
        "# Pilot- og LOI-pakke\n\n## Intensjonserklæring om Leadgrid-pilot\n\nAvklar pris, omfang og målekriterier.",
      );
      await createTask(
        "Send prisfestet pilot eller LOI til kvalifiserte virksomheter",
        "todo",
      );
      await createTask(
        "Bygg prospektliste med 20 relevante virksomheter",
        "done",
      );
      await createEvent("Tentativ intervjublokk: intervju 1–3", 8, 9);
      await createEvent("Frist: oppdater søknaden med kundebevis", 18, 12);

      await page.goto(
        `/admin-workspace?view=documents&product=leadgrid&document=${playbookId}`,
      );
      await expect(page.getByTestId("workspace-documents")).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        page.getByTestId("document-title-input").locator("textarea").first(),
      ).toHaveValue("Leadgrid — kundeintervju- og pilotplaybook");
      await expect(
        page.getByTestId("document-rich-text-surface").locator(".tiptap"),
      ).toContainText(/minst 12 relevante kundesamtaler/u);

      await page.goto(
        `/admin-workspace?view=documents&product=leadgrid&document=${evidenceLogId}`,
      );
      await expect(
        page.getByTestId("document-title-input").locator("textarea").first(),
      ).toHaveValue("Leadgrid — prospekt-, intervju- og kjøpssignallogg");
      const evidenceLogEditor = page
        .getByTestId("document-rich-text-surface")
        .locator(".tiptap");
      const controlRow = evidenceLogEditor.getByRole("row", {
        name: /Relevante prospekter vurdert/u,
      });
      await expect(controlRow).toContainText("Relevante prospekter vurdert");
      await expect(controlRow).toContainText("20");
      await expect(controlRow).toContainText("Klar for kvalifisering");
      await expect(evidenceLogEditor).toContainText(
        /MELBYE AS \(941 009 697\)/u,
      );
      await expect(evidenceLogEditor).toContainText(
        /RENHOLDSBEDRIFTEN AS \(995 425 300\)/u,
      );
      await expect(evidenceLogEditor).toContainText(
        /Ingen henvendelser er sendt/u,
      );

      await page.goto(
        `/admin-workspace?view=documents&product=leadgrid&document=${pilotPackageId}`,
      );
      await expect(
        page.getByTestId("document-title-input").locator("textarea").first(),
      ).toHaveValue("Leadgrid — pilot- og LOI-pakke");
      await expect(
        page.getByTestId("document-rich-text-surface").locator(".tiptap"),
      ).toContainText(/Intensjonserklæring om Leadgrid-pilot/u);

      await page.goto("/admin-workspace?view=tasks&product=leadgrid");
      const taskList = page.getByTestId("workspace-task-list");
      await expect(taskList).toBeVisible({ timeout: 30_000 });
      await expect(
        taskList
          .getByText(
            "Send prisfestet pilot eller LOI til kvalifiserte virksomheter",
            { exact: true },
          )
          .first(),
      ).toBeVisible();
      await page.getByRole("combobox", { name: "Status Alle åpne" }).click();
      await page.getByRole("option", { name: "Fullført", exact: true }).click();
      await expect(
        taskList
          .getByText("Bygg prospektliste med 20 relevante virksomheter", {
            exact: true,
          })
          .first(),
      ).toBeVisible();

      await page.goto("/admin-workspace?view=calendar&product=leadgrid");
      await expect(page.getByTestId("workspace-calendar")).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole("button", { name: "Neste måned" }).click();
      await expect(
        page.getByText(/Tentativ intervjublokk: intervju 1–3/u).first(),
      ).toBeVisible();
      await expect(
        page.getByText(/Frist: oppdater søknaden med kundebevis/u).first(),
      ).toBeVisible();

      expect(failedWorkspaceCalls).toEqual([]);
      expect(runtimeErrors).toEqual([]);
    } finally {
      for (const id of eventIds) {
        await page.request.delete(
          `${BACKEND}/workspace/calendar/events/${id}`,
          {
            headers,
          },
        );
      }
      for (const id of taskIds) {
        await page.request.delete(`${BACKEND}/workspace/tasks/${id}`, {
          headers,
        });
      }
      for (const id of documentIds) {
        await page.request.delete(`${BACKEND}/workspace/documents/${id}`, {
          headers,
        });
      }
    }
  });
  test("kan kollapse Teamchat og Varsler uavhengig og husker valget", async ({
    page,
  }) => {
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
        if (!window.sessionStorage.getItem("panel-collapse-e2e-ready")) {
          window.localStorage.removeItem("admin-workspace:teamchat-collapsed");
          window.localStorage.removeItem(
            "admin-workspace:notifications-collapsed",
          );
          window.sessionStorage.setItem("panel-collapse-e2e-ready", "true");
        }
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

    await page.goto("/admin-workspace?view=overview&product=leadgrid");

    const teamchatPanel = page.getByTestId("workspace-teamchat-panel");
    const notificationsPanel = page.getByTestId(
      "workspace-notifications-panel",
    );
    await expect(teamchatPanel).toBeVisible({ timeout: 30_000 });
    await expect(notificationsPanel).toBeVisible({ timeout: 30_000 });
    await expect(teamchatPanel).toHaveCSS("width", "320px");
    await expect(notificationsPanel).toHaveCSS("width", "280px");

    await page.getByRole("button", { name: "Skjul Teamchat-panelet" }).click();
    await page.getByRole("button", { name: "Skjul Varsler-panelet" }).click();

    await expect(
      page.getByRole("button", { name: "Vis Teamchat-panelet" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Vis Varsler-panelet" }),
    ).toBeVisible();
    await expect(teamchatPanel).toHaveCSS("width", "52px");
    await expect(notificationsPanel).toHaveCSS("width", "52px");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("admin-workspace:teamchat-collapsed"),
        ),
      )
      .toBe("true");
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem(
            "admin-workspace:notifications-collapsed",
          ),
        ),
      )
      .toBe("true");

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Vis Teamchat-panelet" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: "Vis Varsler-panelet" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Vis Teamchat-panelet" }).click();
    await page.getByRole("button", { name: "Vis Varsler-panelet" }).click();
    await expect(
      page.getByRole("button", { name: "Skjul Teamchat-panelet" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Skjul Varsler-panelet" }),
    ).toBeVisible();
    await expect(teamchatPanel).toHaveCSS("width", "320px");
    await expect(notificationsPanel).toHaveCSS("width", "280px");

    expect(runtimeErrors).toEqual([]);
  });
});
