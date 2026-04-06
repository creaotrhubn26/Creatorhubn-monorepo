#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const artifactDir = path.resolve(process.cwd(), "output/google-verification");
const profileTemplateDir = path.resolve(artifactDir, "chromium-profile");
const profileRunDir = path.resolve(artifactDir, "chromium-profile-run");
const videoDir = path.join(artifactDir, "videos");
const reportPath = path.join(artifactDir, "creatorhub-demo-report.json");
const browserViewport = { width: 1440, height: 900 };
const log = (message) => console.log(`[demo] ${message}`);

await fs.mkdir(artifactDir, { recursive: true });
await fs.mkdir(videoDir, { recursive: true });
const existingVideoArtifacts = new Set(await fs.readdir(videoDir).catch(() => []));
await fs.rm(profileRunDir, { recursive: true, force: true });
await fs.cp(profileTemplateDir, profileRunDir, { recursive: true });

const context = await chromium.launchPersistentContext(profileRunDir, {
  headless: true,
  viewport: browserViewport,
  recordVideo: {
    dir: videoDir,
    size: browserViewport,
  },
  args: [`--window-size=${browserViewport.width},${browserViewport.height}`],
});
context.setDefaultTimeout(15000);

const page = context.pages()[0] || await context.newPage();
const pageVideo = page.video();
const response401 = [];
const failedRequests = [];

page.on("response", (response) => {
  if (response.status() === 401) {
    response401.push({
      url: response.url(),
      status: response.status(),
    });
  }
});

page.on("requestfailed", (request) => {
  failedRequests.push({
    url: request.url(),
    errorText: request.failure()?.errorText || "unknown",
  });
});

async function clickIfVisible(targetPage, role, name) {
  const locator = targetPage.getByRole(role, { name });
  if (await locator.count()) {
    const first = locator.first();
    if (await first.isVisible().catch(() => false)) {
      await first.click();
      return true;
    }
  }
  return false;
}

async function clickIfVisibleEnabled(targetPage, role, name) {
  const locator = targetPage.getByRole(role, { name });
  if (await locator.count()) {
    const first = locator.first();
    if (
      await first.isVisible().catch(() => false)
      && await first.isEnabled().catch(() => false)
    ) {
      await first.click();
      return true;
    }
  }
  return false;
}

async function clickTextIfVisible(targetPage, text) {
  const locator = targetPage.getByText(text, { exact: false });
  if (await locator.count()) {
    const first = locator.first();
    if (await first.isVisible().catch(() => false)) {
      await first.click();
      return true;
    }
  }
  return false;
}

async function clickGoogleAccountIfVisible(targetPage) {
  const preferredLocators = [
    targetPage.locator('[data-email="daniel@creatorhubn.com"]').locator("xpath=ancestor::button[1]"),
    targetPage.locator('[data-identifier="daniel@creatorhubn.com"]').locator("xpath=ancestor::button[1]"),
    targetPage.getByRole("button", { name: /Daniel Qazi|daniel@creatorhubn\.com/i }).first(),
  ];

  for (const locator of preferredLocators) {
    if (await locator.count()) {
      if (
        await locator.first().isVisible().catch(() => false)
        && await locator.first().isEnabled().catch(() => false)
      ) {
        await locator.first().click();
        return true;
      }
    }
  }

  return false;
}

function isOnCreatorHubDomain(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.hostname === "creatorhubn.com" || url.hostname.endsWith(".creatorhubn.com");
  } catch {
    return false;
  }
}

function isOnGoogleDomain(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.hostname === "accounts.google.com" || url.hostname.endsWith(".google.com");
  } catch {
    return false;
  }
}

async function clearCreatorHubSession(targetPage) {
  log("Clearing CreatorHub session");
  await targetPage.goto("https://creatorhubn.com/login", { waitUntil: "domcontentloaded" });
  await targetPage.evaluate(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best effort only; local session storage clearing below is what we rely on.
    }

    localStorage.clear();
    sessionStorage.clear();

    const cookieNames = document.cookie
      .split(";")
      .map((entry) => entry.trim().split("=")[0])
      .filter(Boolean);

    for (const cookieName of cookieNames) {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
}

async function waitForAuthToken(targetPage) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const token = await targetPage.evaluate(() => (
      window.localStorage.getItem("creatorhub_auth_token")
      || window.localStorage.getItem("token")
      || ""
    )).catch(() => "");

    if (token) {
      return token;
    }

    await sleep(1200);
  }

  return "";
}

async function ensureCreatorHubStoredUser(targetPage) {
  return targetPage.evaluate(async () => {
    const token = window.localStorage.getItem("creatorhub_auth_token")
      || window.localStorage.getItem("token")
      || "";
    const existingUserRaw = window.localStorage.getItem("creatorhub_auth_user");

    if (!token) {
      return { tokenPresent: false, authenticated: false, userId: null, email: null };
    }

    try {
      const existingUser = existingUserRaw ? JSON.parse(existingUserRaw) : null;
      const existingUserId =
        existingUser?.id
        || existingUser?.userId
        || window.localStorage.getItem("userId")
        || "";
      const existingEmail =
        existingUser?.email
        || existingUser?.userEmail
        || window.localStorage.getItem("userEmail")
        || "";

      if (existingUserId && existingEmail) {
        return {
          tokenPresent: true,
          authenticated: true,
          userId: String(existingUserId).trim(),
          email: String(existingEmail).trim().toLowerCase(),
          source: "storage",
        };
      }

      const response = await fetch("/api/auth/user", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      const user = payload?.authenticated && payload?.user && typeof payload.user === "object"
        ? payload.user
        : null;
      const userId =
        user?.id
        || user?.userId
        || "";
      const email =
        user?.email
        || user?.userEmail
        || "";

      if (user && userId && email) {
        window.localStorage.setItem("creatorhub_auth_user", JSON.stringify(user));
        window.localStorage.setItem("userId", String(userId).trim());
        window.localStorage.setItem("userEmail", String(email).trim().toLowerCase());
        window.dispatchEvent(new Event("auth-changed"));
        return {
          tokenPresent: true,
          authenticated: true,
          userId: String(userId).trim(),
          email: String(email).trim().toLowerCase(),
          source: "api",
        };
      }
    } catch {
      // Ignore and fall through.
    }

    return { tokenPresent: true, authenticated: false, userId: null, email: null, source: "missing-user" };
  });
}

async function completeGoogleFlow(targetPage) {
  log(`Completing Google flow from ${targetPage.url()}`);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const url = targetPage.url();
    if (isOnCreatorHubDomain(url)) {
      const token = await waitForAuthToken(targetPage);
      if (token) {
        log(`Returned to CreatorHub with token on attempt ${attempt + 1}`);
        return { success: true, finalUrl: url };
      }
    }

    if (isOnGoogleDomain(url)) {
      const bodyText = await targetPage.textContent("body").catch(() => "");
      const onAccountChooser = /Choose an account|Velg en konto/i.test(bodyText || "");

      if (onAccountChooser) {
        const accountClicked =
          await clickGoogleAccountIfVisible(targetPage) ||
          await clickTextIfVisible(targetPage, "daniel@creatorhubn.com") ||
          await clickTextIfVisible(targetPage, "Daniel Qazi");
        if (accountClicked) {
          log(`Clicked Google account on attempt ${attempt + 1}`);
          await sleep(2500);
          continue;
        }
      }

      const continueClicked =
        await clickIfVisibleEnabled(targetPage, "button", /Continue|Fortsett|Neste|Next|Go on|Proceed/i) ||
        await clickIfVisibleEnabled(targetPage, "link", /Continue|Fortsett|Neste|Next/i);

      if (continueClicked) {
        log(`Clicked Google continue on attempt ${attempt + 1}`);
        await sleep(3000);
        continue;
      }

      const allowClicked =
        await clickIfVisibleEnabled(targetPage, "button", /Allow|Tillat/i) ||
        await clickIfVisibleEnabled(targetPage, "link", /Allow|Tillat/i);

      if (allowClicked) {
        log(`Clicked Google allow on attempt ${attempt + 1}`);
        await sleep(3000);
        continue;
      }
    }

    await sleep(2500);
  }

  return { success: false, finalUrl: targetPage.url() };
}

async function waitForCreatorHubReady(targetPage) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (isOnCreatorHubDomain(targetPage.url())) {
      const content = await targetPage.textContent("body").catch(() => "");
      if (content && /CreatorHub|Google Workspace|Publisering|Dashboard|Showcase/i.test(content)) {
        return true;
      }
    }
    await sleep(1500);
  }
  return false;
}

async function waitForGoogleRedirectStart(targetPage) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const url = targetPage.url();
    if (isOnGoogleDomain(url) || /rrGoogleStatus|rrGoogleTransfer/.test(url)) {
      return url;
    }
    await sleep(1000);
  }
  return targetPage.url();
}

async function startWorkspaceLinkDirectly(targetPage) {
  return targetPage.evaluate(async () => {
    const token =
      window.localStorage.getItem("creatorhub_auth_token")
      || window.localStorage.getItem("token")
      || "";
    const storedUserRaw = window.localStorage.getItem("creatorhub_auth_user");
    let storedUser = null;

    try {
      storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
    } catch {
      storedUser = null;
    }

    let userId =
      storedUser?.id
      || storedUser?.userId
      || window.localStorage.getItem("userId")
      || "";
    let userEmail =
      storedUser?.email
      || storedUser?.userEmail
      || window.localStorage.getItem("userEmail")
      || "";

    if ((!userId || !userEmail) && token) {
      const sessionResponse = await fetch("/api/auth/user", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const sessionPayload = await sessionResponse.json().catch(() => null);
      const sessionUser = sessionPayload?.authenticated && sessionPayload?.user && typeof sessionPayload.user === "object"
        ? sessionPayload.user
        : null;

      if (sessionUser) {
        userId =
          sessionUser.id
          || sessionUser.userId
          || userId;
        userEmail =
          sessionUser.email
          || sessionUser.userEmail
          || userEmail;
        if (userId && userEmail) {
          window.localStorage.setItem("creatorhub_auth_user", JSON.stringify(sessionUser));
          window.localStorage.setItem("userId", String(userId).trim());
          window.localStorage.setItem("userEmail", String(userEmail).trim().toLowerCase());
        }
      }
    }

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (userId) {
      headers["x-user-id"] = userId;
    }
    if (userEmail) {
      headers["x-user-email"] = String(userEmail).trim().toLowerCase();
    }

    const response = await fetch("/api/role-room/google/oauth/start", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({
        mode: "link",
        ...(userId ? { targetConnectionUserId: userId } : {}),
        returnPath: window.location.pathname + window.location.search,
        browserOrigin: window.location.origin,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    return payload?.authorizationUrl || payload?.link || null;
  });
}

async function openPublishingTab(targetPage) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const opened =
      await clickIfVisible(targetPage, "tab", /Publisering/i) ||
      await clickIfVisible(targetPage, "button", /Publisering/i) ||
      await clickTextIfVisible(targetPage, "Publisering");

    if (opened) {
      log(`Opened publishing tab on attempt ${attempt + 1}`);
      await sleep(3000);
      return true;
    }

    await sleep(1500);
  }

  return false;
}

async function fetchJson(targetPage, url) {
  return targetPage.evaluate(async (inputUrl) => {
    const token =
      window.localStorage.getItem("creatorhub_auth_token") ||
      window.localStorage.getItem("token") ||
      "";
    const storedUserRaw = window.localStorage.getItem("creatorhub_auth_user");
    let storedUser = null;
    try {
      storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
    } catch {
      storedUser = null;
    }

    const headers = { Accept: "application/json" };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    let userId =
      storedUser?.id ||
      storedUser?.userId ||
      window.localStorage.getItem("userId") ||
      "";
    let userEmail =
      storedUser?.email ||
      storedUser?.userEmail ||
      window.localStorage.getItem("userEmail") ||
      "";

    if ((!userId || !userEmail) && token) {
      const sessionResponse = await fetch("/api/auth/user", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const sessionPayload = await sessionResponse.json().catch(() => null);
      const sessionUser = sessionPayload?.authenticated && sessionPayload?.user && typeof sessionPayload.user === "object"
        ? sessionPayload.user
        : null;

      if (sessionUser) {
        userId =
          sessionUser.id ||
          sessionUser.userId ||
          userId;
        userEmail =
          sessionUser.email ||
          sessionUser.userEmail ||
          userEmail;
        if (userId && userEmail) {
          window.localStorage.setItem("creatorhub_auth_user", JSON.stringify(sessionUser));
          window.localStorage.setItem("userId", String(userId).trim());
          window.localStorage.setItem("userEmail", String(userEmail).trim().toLowerCase());
        }
      }
    }

    if (userId) {
      headers["x-user-id"] = userId;
    }
    if (userEmail) {
      headers["x-user-email"] = String(userEmail).trim().toLowerCase();
    }

    const response = await fetch(inputUrl, {
      credentials: "include",
      headers,
    });
    const text = await response.text();
    try {
      return { ok: response.ok, status: response.status, body: JSON.parse(text) };
    } catch {
      return { ok: response.ok, status: response.status, body: text };
    }
  }, url);
}

async function waitForDemoPageReady(targetPage) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const headingVisible = await targetPage.getByText("Google Verification Demo", { exact: false }).first().isVisible().catch(() => false);
    if (headingVisible) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

async function runDemoAction(targetPage, actionKey, timeoutMs = 90000) {
  const button = targetPage.getByTestId(`action-${actionKey}`);
  const result = targetPage.getByTestId(`result-${actionKey}`);

  await button.scrollIntoViewIfNeeded().catch(() => undefined);
  await button.click();

  await targetPage.waitForFunction((key) => {
    const element = document.querySelector(`[data-testid="result-${key}"]`);
    const status = element?.getAttribute("data-status");
    return status === "success" || status === "error";
  }, actionKey, { timeout: timeoutMs });

  const status = await result.getAttribute("data-status");
  const text = (await result.textContent().catch(() => ""))?.trim() || "";
  const state = await targetPage.evaluate((key) => {
    return (window.__creatorhubGoogleVerificationDemoState?.actions ?? {})[key] ?? null;
  }, actionKey).catch(() => null);

  return {
    actionKey,
    status,
    text,
    state,
  };
}

const report = {
  startedAt: new Date().toISOString(),
  steps: [],
  checks: {},
  artifacts: {},
};

let capturedError = null;
try {
  await clearCreatorHubSession(page);
  await page.goto("https://creatorhubn.com/login", { waitUntil: "domcontentloaded" });
  log("Opened CreatorHub login page");
  report.steps.push({ step: "open-login", url: page.url() });
  await sleep(2500);

  const continuedWithGoogle =
    await clickIfVisible(page, "button", /Fortsett med Google|Continue with Google/i);
  log(`Clicked CreatorHub Google button: ${continuedWithGoogle}`);
  report.steps.push({ step: "click-google-login", success: continuedWithGoogle, url: page.url() });

  if (continuedWithGoogle) {
    await sleep(2500);
    const loginFlow = await completeGoogleFlow(page);
    report.steps.push({ step: "google-login-flow", ...loginFlow });
  }

  const creatorHubReadyAfterLogin = await waitForCreatorHubReady(page);
  log(`CreatorHub ready after login: ${creatorHubReadyAfterLogin}`);
  report.steps.push({ step: "creatorhub-ready-after-login", success: creatorHubReadyAfterLogin, url: page.url() });
  report.checks.authTokenPresent = Boolean(await waitForAuthToken(page));
  log(`Auth token present after login: ${report.checks.authTokenPresent}`);
  report.checks.authBootstrap = await ensureCreatorHubStoredUser(page);
  log(`Auth bootstrap result: ${JSON.stringify(report.checks.authBootstrap)}`);

  await page.goto("https://creatorhubn.com/photographer-dashboard-material", { waitUntil: "domcontentloaded" });
  log("Opened CreatorHub dashboard");
  await sleep(6000);
  report.steps.push({ step: "open-dashboard", url: page.url() });
  report.checks.dashboardAuthBootstrap = await ensureCreatorHubStoredUser(page);

  const publishingOpenedInitially = await openPublishingTab(page);
  report.steps.push({ step: "open-publishing-tab-initial", success: publishingOpenedInitially, url: page.url() });

  const connectWorkspaceVisible = Boolean(
    await page.getByRole("button", { name: /Koble til|Koble på nytt|Koble Google Workspace|Connect Google Workspace/i }).count().catch(() => 0),
  );
  log(`Workspace connect UI visible in publishing: ${connectWorkspaceVisible}`);
  report.steps.push({ step: "workspace-connect-ui-visible", success: connectWorkspaceVisible, url: page.url() });

  const directAuthorizationUrl = await startWorkspaceLinkDirectly(page);
  if (directAuthorizationUrl) {
    log("Starting Google Workspace OAuth link directly from CreatorHub API");
    report.steps.push({
      step: "google-workspace-link-direct-start",
      success: true,
      authorizationUrl: directAuthorizationUrl,
    });
    await page.goto(directAuthorizationUrl, { waitUntil: "domcontentloaded" });
    const workspaceFlow = await completeGoogleFlow(page);
    report.steps.push({ step: "google-workspace-link-flow", ...workspaceFlow });
  }

  await waitForCreatorHubReady(page);
  await page.goto("https://creatorhubn.com/photographer-dashboard-material", { waitUntil: "domcontentloaded" });
  await sleep(6000);
  report.checks.postWorkspaceAuthBootstrap = await ensureCreatorHubStoredUser(page);

  const publishingOpened = await openPublishingTab(page);
  report.steps.push({ step: "open-publishing-tab", success: publishingOpened, url: page.url() });
  await sleep(3000);

  await page.goto("https://creatorhubn.com/google-verification-demo", { waitUntil: "domcontentloaded" });
  const demoPageReady = await waitForDemoPageReady(page);
  report.steps.push({ step: "open-google-verification-demo", success: demoPageReady, url: page.url() });

  if (!demoPageReady) {
    throw new Error("Google verification demo page did not render.");
  }

  const actionPlan = [
    { key: "refresh-overview", timeoutMs: 45000 },
    { key: "load-drive-files", timeoutMs: 45000 },
    { key: "upload-drive-file", timeoutMs: 60000 },
    { key: "create-docs-contract", timeoutMs: 90000 },
    { key: "create-meet", timeoutMs: 60000 },
    { key: "load-gmail-threads", timeoutMs: 45000 },
    { key: "create-gmail-draft", timeoutMs: 60000 },
    { key: "search-contacts", timeoutMs: 45000 },
    { key: "create-contact", timeoutMs: 60000 },
    { key: "load-task-lists", timeoutMs: 45000 },
    { key: "create-task", timeoutMs: 60000 },
    { key: "load-chat-spaces", timeoutMs: 45000 },
    { key: "create-chat-space", timeoutMs: 90000 },
    { key: "send-chat-message", timeoutMs: 60000 },
    { key: "load-chat-messages", timeoutMs: 45000 },
    { key: "create-youtube-playlist", timeoutMs: 90000 },
    { key: "upload-youtube-video", timeoutMs: 180000 },
    { key: "update-youtube-video", timeoutMs: 90000 },
    { key: "upload-youtube-thumbnail", timeoutMs: 90000 },
  ];

  for (const action of actionPlan) {
    const outcome = await runDemoAction(page, action.key, action.timeoutMs);
    report.steps.push({
      step: `demo-${action.key}`,
      status: outcome.status,
      text: outcome.text,
      state: outcome.state,
    });

    if (outcome.status !== "success") {
      throw new Error(`Demo action failed for ${action.key}: ${outcome.text}`);
    }

    await sleep(1200);
  }

  const bodyText = await page.textContent("body").catch(() => "");
  report.checks.uiHasYouTube = /YouTube/i.test(bodyText || "");
  report.checks.uiHasGoogleWorkspace = /Google Workspace|Google Drive/i.test(bodyText || "");
  report.checks.demoState = await page.evaluate(() => window.__creatorhubGoogleVerificationDemoState ?? null).catch(() => null);
  report.checks.youtubeStatus = await fetchJson(page, "/api/youtube/status");
  report.checks.driveStatus = await fetchJson(page, "/api/file-management/google-drive/status");

  const publicSession = await fetchJson(page, "/api/auth/public-session");
  report.checks.publicSession = publicSession;

  const sessionUserId =
    publicSession?.body && typeof publicSession.body === "object" ? publicSession.body.userId : null;

  if (typeof sessionUserId === "string" && sessionUserId.trim()) {
    report.checks.workspaceStorage = await fetchJson(page, `/api/google-workspace/storage/${encodeURIComponent(sessionUserId)}`);
  }
} catch (error) {
  capturedError = error instanceof Error ? error.message : String(error);
} finally {
  await context.close();

  if (pageVideo) {
    try {
      report.artifacts.browserVideo = await pageVideo.path();
    } catch {
      const currentVideoArtifacts = await fs.readdir(videoDir).catch(() => []);
      const newArtifact = currentVideoArtifacts
        .filter((fileName) => !existingVideoArtifacts.has(fileName))
        .sort()
        .at(-1);
      report.artifacts.browserVideo = newArtifact
        ? path.join(videoDir, newArtifact)
        : null;
    }
  }

  report.finishedAt = new Date().toISOString();
  report.artifacts.response401 = response401;
  report.artifacts.failedRequests = failedRequests;
  if (capturedError) {
    report.error = capturedError;
  }
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
}

console.log(`Demo report written to ${reportPath}`);
