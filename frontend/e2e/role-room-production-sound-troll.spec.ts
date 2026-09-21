import { expect, test, type Page } from "@playwright/test";
import { openCastingPlanner, selectFirstProject } from "./helpers/role-room";

const projectId = "e2e-troll-production";

async function installAuthenticatedProductionSoundApi(page: Page) {
  let storedProject: Record<string, any> | null = null;
  const savedVersions: number[] = [];
  const authenticatedRequests: string[] = [];
  let soundMedia: Array<Record<string, any>> = [];
  let mediaReconciliations = 0;
  let mediaDeletions = 0;
  let rejectNextSaveWithConflict = false;

  await page.route("**/api/casting/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/casting/health") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "healthy" }),
      });
      return;
    }
    if (pathname === "/api/casting/projects" && request.method() === "POST") {
      const incoming = request.postDataJSON() as Record<string, any>;
      const previousDays = new Map(
        (
          (storedProject?.productionDays ?? []) as Array<Record<string, any>>
        ).map((day) => [day.id, day]),
      );
      storedProject = {
        ...incoming,
        productionDays: (
          (incoming.productionDays ?? []) as Array<Record<string, any>>
        ).map((day) => {
          const previous = previousDays.get(day.id);
          return previous?.productionSound
            ? {
                ...day,
                productionSound: previous.productionSound,
                soundVersion: previous.soundVersion,
                soundUpdatedBy: previous.soundUpdatedBy,
              }
            : day;
        }),
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }
    if (pathname === "/api/casting/projects" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(storedProject ? [storedProject] : []),
      });
      return;
    }
    if (
      pathname === `/api/casting/projects/${projectId}` &&
      request.method() === "GET"
    ) {
      await route.fulfill({
        status: storedProject ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(storedProject ?? {}),
      });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.route(
    `**/api/role-room/projects/${projectId}/production-days/*/production-sound`,
    async (route) => {
      authenticatedRequests.push(route.request().headers().authorization ?? "");
      const body = route.request().postDataJSON() as {
        expectedVersion: number;
        operations: Record<string, any>;
      };
      const days = (storedProject?.productionDays ?? []) as Array<
        Record<string, any>
      >;
      const dayId = decodeURIComponent(
        new URL(route.request().url()).pathname.split("/").at(-2) ?? "",
      );
      const index = days.findIndex((day) => day.id === dayId);
      const current = days[index];
      expect(current).toBeTruthy();
      if (rejectNextSaveWithConflict) {
        rejectNextSaveWithConflict = false;
        const conflictDay = {
          ...current,
          soundVersion: Number(current.soundVersion ?? 0) + 1,
          productionSound: {
            ...current.productionSound,
            setup: {
              ...current.productionSound.setup,
              acousticRisks: "Server: generator bak set.",
            },
          },
        };
        days[index] = conflictDay;
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: "version_conflict",
            message: "Lydrapporten er endret av en annen bruker.",
            productionDay: conflictDay,
          }),
        });
        return;
      }
      expect(body.expectedVersion).toBe(Number(current.soundVersion ?? 0));
      const nextVersion = body.expectedVersion + 1;
      const updated = {
        ...current,
        soundVersion: nextVersion,
        soundUpdatedBy: "e2e-test-user",
        productionSound: {
          ...body.operations,
          activity: [
            {
              id: `sound-activity-${nextVersion}`,
              type: "workspace_saved",
              message: "Oppdaterte lydrapporten.",
              actorUserId: "e2e-test-user",
              createdAt: "2026-09-21T12:00:00Z",
            },
          ],
        },
      };
      days[index] = updated;
      savedVersions.push(nextVersion);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ productionDay: updated }),
      });
    },
  );
  await page.route(
    `**/api/role-room/projects/${projectId}/production-days/*/production-sound/media**`,
    async (route) => {
      authenticatedRequests.push(route.request().headers().authorization ?? "");
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const base = `/api/role-room/projects/${projectId}/production-days/`;
      const dayId = decodeURIComponent(
        pathname.slice(base.length).split("/")[0] ?? "",
      );
      const mediaBase = `${base}${encodeURIComponent(dayId)}/production-sound/media`;
      if (request.method() === "GET" && pathname === mediaBase) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ media: soundMedia }),
        });
        return;
      }
      if (request.method() === "POST" && pathname === `${mediaBase}/initiate`) {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            upload: {
              objectId: "92e76092-2716-4e26-8b77-b26a331919bb",
              strategy: "single",
              uploadUrl: "https://role-room-e2e-s3.invalid/troll-sound",
              requiredHeaders: {
                "content-type": "audio/wav",
                "x-amz-checksum-sha256": "e2e-checksum",
              },
            },
          }),
        });
        return;
      }
      if (
        request.method() === "POST" &&
        pathname.endsWith("/92e76092-2716-4e26-8b77-b26a331919bb/complete")
      ) {
        const imported = {
          id: "8b49da36-ff43-4d8f-98dc-20ce0e39218d",
          projectId,
          productionDayId: dayId,
          storageObjectId: "92e76092-2716-4e26-8b77-b26a331919bb",
          uploadedBy: "e2e-test-user",
          displayName: "TROLL_1A_001.wav",
          contentType: "audio/wav",
          sizeBytes: 48,
          checksumSha256: "a".repeat(64),
          recorderMetadata: {
            container: "RIFF",
            audioFormat: 1,
            channels: 2,
            sampleRate: 48000,
            byteRate: 288000,
            blockAlign: 6,
            bitDepth: 24,
            dataSizeBytes: 12,
            durationSeconds: 0.001,
            timecodeStart: "01:02:03:04",
            bext: { description: "Troll location sound", version: 2 },
            ixml: {
              project: "Troll",
              scene: "1A",
              take: "1",
              tape: "A001",
              tracks: [{ channelIndex: 1, name: "Mix" }],
            },
            warnings: [],
          },
          reconciliationStatus: "unmatched",
          createdAt: "2026-09-21T12:00:00Z",
        };
        soundMedia = [imported];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ media: imported }),
        });
        return;
      }
      if (
        request.method() === "PATCH" &&
        pathname.endsWith("/8b49da36-ff43-4d8f-98dc-20ce0e39218d/reconcile")
      ) {
        const body = request.postDataJSON() as {
          expectedVersion: number;
          continuityTakeId: string | null;
        };
        const days = (storedProject?.productionDays ?? []) as Array<
          Record<string, any>
        >;
        const dayIndex = days.findIndex((day) => day.id === dayId);
        const current = days[dayIndex];
        expect(body.expectedVersion).toBe(Number(current.soundVersion ?? 0));
        expect(body.continuityTakeId).toBe("troll-take-1");
        const nextVersion = body.expectedVersion + 1;
        const existingReports = (current.productionSound?.takeReports ??
          []) as Array<Record<string, any>>;
        const linkedReport = {
          ...(existingReports.find(
            (report) => report.continuityTakeId === body.continuityTakeId,
          ) ?? {
            id: "sound-report-imported",
            continuityTakeId: body.continuityTakeId,
            trackIds: [],
            quality: "usable",
            issueTags: [],
            needsAdr: false,
          }),
          fileName: "TROLL_1A_001.wav",
          recordingFileIds: ["8b49da36-ff43-4d8f-98dc-20ce0e39218d"],
        };
        const updated = {
          ...current,
          soundVersion: nextVersion,
          soundUpdatedBy: "e2e-test-user",
          productionSound: {
            ...current.productionSound,
            takeReports: [
              ...existingReports.filter(
                (report) => report.continuityTakeId !== body.continuityTakeId,
              ),
              linkedReport,
            ],
          },
        };
        days[dayIndex] = updated;
        const reconciled = {
          ...soundMedia[0],
          reconciliationStatus: "matched",
          continuityTakeId: body.continuityTakeId,
          reconciledBy: "e2e-test-user",
          reconciledAt: "2026-09-21T12:01:00Z",
        };
        soundMedia = [reconciled];
        mediaReconciliations += 1;
        savedVersions.push(nextVersion);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ productionDay: updated, media: reconciled }),
        });
        return;
      }
      if (
        request.method() === "DELETE" &&
        pathname.endsWith("/8b49da36-ff43-4d8f-98dc-20ce0e39218d")
      ) {
        if (soundMedia[0]?.reconciliationStatus === "matched") {
          await route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              error: "media_reconciled",
              message:
                "Fjern koblingen til continuity-taken før recorderfilen slettes.",
            }),
          });
          return;
        }
        soundMedia = [];
        mediaDeletions += 1;
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: "{}",
      });
    },
  );
  await page.route("https://role-room-e2e-s3.invalid/**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { ETag: '"e2e-etag"' },
      body: "",
    });
  });
  await page.route(
    `**/api/role-room/projects/${projectId}/access`,
    async (route) => {
      authenticatedRequests.push(route.request().headers().authorization ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access: {
            projectId,
            role: "production_sound_mixer",
            roles: ["production_sound_mixer"],
            isOwner: false,
            isMember: true,
            permissions: {},
            grants: { canManageProductionSound: true },
          },
        }),
      });
    },
  );
  await page.route(
    `**/api/role-room/projects/${projectId}/roles`,
    async (route) => {
      authenticatedRequests.push(route.request().headers().authorization ?? "");
      const role = {
        id: "troll-sound-role",
        projectId,
        userId: "e2e-test-user",
        role: "production_sound_mixer",
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          route.request().method() === "GET" ? [role] : { role },
        ),
      });
    },
  );
  await page.route(
    `**/api/role-room/projects/${projectId}/production-days`,
    async (route) => {
      authenticatedRequests.push(route.request().headers().authorization ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          productionDays: storedProject?.productionDays ?? [],
        }),
      });
    },
  );
  await page.route(
    `**/api/role-room/projects/${projectId}/my-tabs`,
    async (route) => {
      authenticatedRequests.push(route.request().headers().authorization ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tabAccess: null,
          source: "default",
          role: "production_sound_mixer",
          tabValues: null,
        }),
      });
    },
  );
  await page.route(
    "**/api/role-room/casting-roles/*/selftapes",
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      }),
  );
  await page.route("**/api/presence/heartbeat", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }),
  );

  return {
    authenticatedRequests,
    savedVersions,
    mediaReconciliations: () => mediaReconciliations,
    mediaDeletions: () => mediaDeletions,
    conflictOnNextSave() {
      rejectNextSaveWithConflict = true;
    },
  };
}

test.describe("Autentisert Troll-flyt · Production Sound", () => {
  test("går fra recorder-oppsett via continuity-take til sporbar post-handoff", async ({
    page,
  }) => {
    const runtimeErrors: string[] = [];
    const targetedApiFailures: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(
          message.text(),
        )
      )
        runtimeErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        /\/api\/presence\/heartbeat|\/selftapes(?:[/?#]|$)/i.test(
          response.url(),
        )
      )
        targetedApiFailures.push(`${response.status()} ${response.url()}`);
    });
    const api = await installAuthenticatedProductionSoundApi(page);

    await openCastingPlanner(page, {
      urlFlags: {
        seed: "production-sound-troll",
        session: "production-sound",
        lens: "production-sound",
      },
    });
    await selectFirstProject(page);
    const workspace = page.getByTestId("production-sound-workspace");
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Troll", exact: true }),
    ).toBeVisible();
    await expect(
      workspace.getByText("0/1", { exact: true }).first(),
    ).toBeVisible();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("lens"))
      .toBe("production-sound");

    await page.getByRole("button", { name: "Oppsett" }).click();
    await expect(page.getByLabel("Recorder")).toHaveValue("Sound Devices 833");
    await page
      .getByLabel("Akustiske risikoer")
      .fill("Elv bak kamera og generator ved basecamp.");
    await page.getByTestId("production-sound-save").click();
    await expect(
      page.getByText(/Lydrapporten er synkronisert som versjon 1/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Takes" }).click();
    await expect(page.getByText(/Scene 1.*Take 1/)).toBeVisible();
    await page.getByLabel("Lydfil").fill("A001_001T01.wav");
    await page.getByText("Bakgrunnsstøy", { exact: true }).click();
    await page.getByLabel("Foreslå ADR").check();
    await page.getByTestId("production-sound-save").click();
    await expect(page.getByText(/versjon 2/)).toBeVisible();

    await page.getByRole("button", { name: "Ekstraopptak" }).click();
    await page.getByRole("button", { name: "Room tone" }).click();
    await workspace.getByRole("combobox").last().click();
    await page.getByRole("option", { name: "Tatt opp" }).click();
    await page.getByTestId("production-sound-save").click();
    await expect(page.getByText(/versjon 3/)).toBeVisible();

    const waveHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x28, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d,
      0x74, 0x20, 0x10, 0, 0, 0, 1, 0, 2, 0, 0x80, 0xbb, 0, 0, 0, 0x65, 4, 0, 6,
      0, 24, 0, 0x64, 0x61, 0x74, 0x61, 4, 0, 0, 0, 0, 0, 0, 0,
    ]);
    await workspace
      .locator('input[type="file"][accept*=".wav"]')
      .setInputFiles({
        name: "TROLL_1A_001.wav",
        mimeType: "audio/wav",
        buffer: waveHeader,
      });
    const importedMedia = page.getByTestId(
      "production-sound-media-8b49da36-ff43-4d8f-98dc-20ce0e39218d",
    );
    await expect(importedMedia).toContainText("Eksakt metadataforslag");
    await expect(importedMedia).toContainText("Scene 1A · Take 1 · Roll A001");
    expect(api.mediaReconciliations()).toBe(0);
    await importedMedia
      .getByRole("button", { name: "Koble", exact: true })
      .click();
    await expect(importedMedia).toContainText("Avstemt");
    await expect(importedMedia).toContainText("Koblet til Scene 1");
    expect(api.mediaReconciliations()).toBe(1);
    await importedMedia
      .getByRole("button", { name: "Slett TROLL_1A_001.wav permanent" })
      .click();
    await expect(
      page.getByText(
        "Fjern koblingen til continuity-taken før recorderfilen slettes.",
      ),
    ).toBeVisible();
    expect(api.mediaDeletions()).toBe(0);

    await page.getByRole("button", { name: "Handoff" }).click();
    await page.getByLabel("Mottaker").fill("DIT / klipp");
    await workspace.getByRole("combobox").last().click();
    await page.getByRole("option", { name: "Klar for review" }).click();
    await page.getByTestId("production-sound-save").click();
    await expect(page.getByText(/versjon 5/)).toBeVisible();
    expect(api.savedVersions).toEqual([1, 2, 3, 4, 5]);

    await page.reload();
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Takes" }).click();
    await expect(page.getByLabel("Lydfil")).toHaveValue("TROLL_1A_001.wav");
    await expect(page.getByLabel("Foreslå ADR")).toBeChecked();
    expect(api.authenticatedRequests.length).toBeGreaterThan(0);
    expect(
      api.authenticatedRequests.every(
        (header) => header === "Bearer dev-admin-local-session",
      ),
    ).toBe(true);
    expect(runtimeErrors).toEqual([]);
    expect(targetedApiFailures).toEqual([]);
  });

  test("@mobile har store touchmål og ingen horisontal overflow i begge orienteringer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await installAuthenticatedProductionSoundApi(page);
    await openCastingPlanner(page, {
      urlFlags: {
        seed: "production-sound-troll",
        session: "production-sound",
        lens: "production-sound",
      },
    });
    await selectFirstProject(page);
    const workspace = page.getByTestId("production-sound-workspace");
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    const takesButton = workspace.getByRole("button", {
      name: "Takes",
      exact: true,
    });
    expect(
      (await takesButton.boundingBox())?.height ?? 0,
    ).toBeGreaterThanOrEqual(44);
    await takesButton.tap();
    await expect(page.getByLabel("Lydfil")).toBeVisible();
    const issueButton = workspace.getByRole("button", {
      name: "Bakgrunnsstøy",
      exact: true,
    });
    expect(
      (await issueButton.boundingBox())?.height ?? 0,
    ).toBeGreaterThanOrEqual(44);
    await expect
      .poll(() =>
        workspace.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      )
      .toBe(true);
    await page.setViewportSize({ width: 852, height: 393 });
    await expect(page.getByLabel("Lydkvalitet")).toBeVisible();
    await expect
      .poll(() =>
        workspace.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      )
      .toBe(true);
  });

  test("sletter en uavstemt recorderfil først etter eksplisitt bekreftelse", async ({
    page,
  }) => {
    const api = await installAuthenticatedProductionSoundApi(page);
    await openCastingPlanner(page, {
      urlFlags: {
        seed: "production-sound-troll",
        session: "production-sound",
        lens: "production-sound",
      },
    });
    await selectFirstProject(page);
    const workspace = page.getByTestId("production-sound-workspace");
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Ekstraopptak" }).click();

    const waveHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x28, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0x66,
      0x6d, 0x74, 0x20, 0x10, 0, 0, 0, 1, 0, 2, 0, 0x80, 0xbb, 0, 0, 0, 0x65,
      4, 0, 6, 0, 24, 0, 0x64, 0x61, 0x74, 0x61, 4, 0, 0, 0, 0, 0, 0, 0,
    ]);
    await workspace
      .locator('input[type="file"][accept*=".wav"]')
      .setInputFiles({
        name: "TROLL_1A_001.wav",
        mimeType: "audio/wav",
        buffer: waveHeader,
      });
    const importedMedia = page.getByTestId(
      "production-sound-media-8b49da36-ff43-4d8f-98dc-20ce0e39218d",
    );
    await expect(importedMedia).toBeVisible();
    await importedMedia
      .getByRole("button", { name: "Slett TROLL_1A_001.wav permanent" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Slett recorderfil permanent?" }),
    ).toBeVisible();
    expect(api.mediaDeletions()).toBe(0);
    await page.getByTestId("production-sound-delete-confirm").click();

    await expect(importedMedia).toHaveCount(0);
    await expect(
      page.getByText(
        "TROLL_1A_001.wav er slettet permanent fra privat lagring.",
      ),
    ).toBeVisible();
    expect(api.mediaDeletions()).toBe(1);
  });

  test("beholder lokalt lydutkast ved konflikt til serverversjonen velges", async ({
    page,
  }) => {
    const api = await installAuthenticatedProductionSoundApi(page);
    await openCastingPlanner(page, {
      urlFlags: {
        seed: "production-sound-troll",
        session: "production-sound",
        lens: "production-sound",
      },
    });
    await selectFirstProject(page);
    await expect(page.getByTestId("production-sound-workspace")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Oppsett" }).click();
    await page.getByLabel("Akustiske risikoer").fill("Mitt lokale lydutkast.");
    api.conflictOnNextSave();
    await page.getByTestId("production-sound-save").click();
    await expect(
      page.getByText("Lydrapporten er endret av en annen bruker."),
    ).toBeVisible();
    await expect(page.getByLabel("Akustiske risikoer")).toHaveValue(
      "Mitt lokale lydutkast.",
    );
    await page.getByRole("button", { name: "Last serverversjon" }).click();
    await expect(page.getByLabel("Akustiske risikoer")).toHaveValue(
      "Server: generator bak set.",
    );
  });
});
