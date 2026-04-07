#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const artifactDir = path.resolve(process.cwd(), 'output/google-workspace');
const profileDir = path.resolve(process.cwd(), 'output/google-verification/chromium-profile');
const reportPath = path.join(artifactDir, 'google-live-matrix-report.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function persistReport(report) {
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
}

function safeUrl(value) {
  try {
    return new URL(value).toString();
  } catch {
    return String(value || '');
  }
}

async function probeUrl(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    return {
      ok: response.ok,
      status: response.status,
      url: safeUrl(response.url || url),
    };
  } catch (error) {
    return {
      ok: false,
      url: safeUrl(url),
      error: String(error),
    };
  }
}

async function readCreatorHubSession(page) {
  return page.evaluate(async () => {
    const token =
      window.localStorage.getItem('creatorhub_auth_token')
      || window.localStorage.getItem('token')
      || '';
    const userRaw = window.localStorage.getItem('creatorhub_auth_user');
    let parsedUser = null;
    try {
      parsedUser = userRaw ? JSON.parse(userRaw) : null;
    } catch {
      parsedUser = null;
    }

    const currentUserId =
      parsedUser?.id
      || parsedUser?.userId
      || window.localStorage.getItem('userId')
      || '';

    const result = {
      tokenPresent: Boolean(token),
      userId: currentUserId ? String(currentUserId).trim() : '',
      localUserEmail:
        parsedUser?.email
        || parsedUser?.userEmail
        || window.localStorage.getItem('userEmail')
        || '',
      publicSession: null,
      authUser: null,
      workspaceStorage: null,
    };

    try {
      const publicSessionResponse = await fetch('/api/auth/public-session', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      result.publicSession = await publicSessionResponse.json().catch(() => null);
    } catch {
      result.publicSession = null;
    }

    try {
      const authUserResponse = await fetch('/api/auth/user', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      result.authUser = await authUserResponse.json().catch(() => null);
    } catch {
      result.authUser = null;
    }

    if (result.userId) {
      try {
        const workspaceResponse = await fetch(`/api/google-workspace/storage/${encodeURIComponent(result.userId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: 'include',
        });
        result.workspaceStorage = await workspaceResponse.json().catch(() => null);
      } catch {
        result.workspaceStorage = null;
      }
    }

    return result;
  });
}

async function collectCreatorHubCheckpoint(page, name) {
  await page.waitForLoadState('domcontentloaded');
  await sleep(1500);
  const session = await readCreatorHubSession(page);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  return {
    name,
    url: safeUrl(page.url()),
    title: await page.title().catch(() => ''),
    tokenPresent: session.tokenPresent,
    userId: session.userId,
    localUserEmail: session.localUserEmail,
    publicSessionAuthenticated: Boolean(session.publicSession?.authenticated),
    publicSessionUser: session.publicSession?.user?.email || session.publicSession?.email || null,
    authUserAuthenticated: Boolean(session.authUser?.authenticated),
    authUserEmail: session.authUser?.user?.email || session.authUser?.email || null,
    workspaceConnected: Boolean(session.workspaceStorage?.googleDriveConnected),
    workspaceEmail: session.workspaceStorage?.driveAccountEmail || null,
    workspaceWarning: session.workspaceStorage?.workspaceWarning || null,
    bodyHasWorkspaceLabel: bodyText.includes('Google Workspace'),
    bodyHasSessionBadge: bodyText.includes('Google-SSO') || bodyText.includes('Workspace og Keep'),
    bodyHasRoleRoomLabel: bodyText.includes('The Role Room') || bodyText.includes('Role Room'),
  };
}

async function collectGenericCheckpoint(page, name, expectedTexts = []) {
  await page.waitForLoadState('domcontentloaded');
  await sleep(1500);
  const bodyText = await page.locator('body').innerText().catch(() => '');
  return {
    name,
    url: safeUrl(page.url()),
    title: await page.title().catch(() => ''),
    expectedTexts,
    matchedTexts: expectedTexts.filter((text) => bodyText.includes(text)),
  };
}

async function main() {
  await fs.mkdir(artifactDir, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    profileDir,
    summary: {
      creatorhubAuthenticated: false,
      creatorhubWorkspaceConnected: false,
      reloadStable: false,
      newTabStable: false,
      storyArcStable: false,
      verificationDemoStable: false,
      roleRoomDomainHealthy: false,
      roleRoomLoaded: false,
      roleRoomWorkspaceVisible: false,
      roleRoomSsoStable: false,
    },
    checkpoints: [],
  };

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: ['--window-size=1440,900'],
  });
  context.setDefaultTimeout(20000);

  try {
    const page = context.pages()[0] || await context.newPage();

    await page.goto('https://creatorhubn.com/dashboard', { waitUntil: 'domcontentloaded' });
    const dashboardInitial = await collectCreatorHubCheckpoint(page, 'creatorhub-dashboard-initial');
    report.checkpoints.push(dashboardInitial);
    await persistReport(report);

    await page.reload({ waitUntil: 'domcontentloaded' });
    const dashboardReload = await collectCreatorHubCheckpoint(page, 'creatorhub-dashboard-reload');
    report.checkpoints.push(dashboardReload);
    await persistReport(report);

    const secondTab = await context.newPage();
    await secondTab.goto('https://creatorhubn.com/dashboard', { waitUntil: 'domcontentloaded' });
    const dashboardNewTab = await collectCreatorHubCheckpoint(secondTab, 'creatorhub-dashboard-new-tab');
    report.checkpoints.push(dashboardNewTab);
    await secondTab.close().catch(() => {});
    await persistReport(report);

    await page.goto('https://creatorhubn.com/story-arc-studio', { waitUntil: 'domcontentloaded' });
    const storyArc = await collectCreatorHubCheckpoint(page, 'creatorhub-story-arc');
    report.checkpoints.push(storyArc);
    await persistReport(report);

    await page.goto('https://creatorhubn.com/google-verification-demo', { waitUntil: 'domcontentloaded' });
    const verificationDemo = await collectCreatorHubCheckpoint(page, 'creatorhub-google-verification-demo');
    report.checkpoints.push(verificationDemo);
    await persistReport(report);

    const roleRoomProbe = await probeUrl('https://theroleroom.com');
    report.checkpoints.push({
      name: 'role-room-domain-probe',
      ...roleRoomProbe,
    });
    report.summary.roleRoomDomainHealthy = roleRoomProbe.ok;
    await persistReport(report);

    let roleRoom = null;
    if (roleRoomProbe.ok) {
      const roleRoomPage = await context.newPage();
      try {
        await roleRoomPage.goto('https://theroleroom.com', { waitUntil: 'domcontentloaded' });
        roleRoom = await collectGenericCheckpoint(roleRoomPage, 'role-room-domain', [
          'The Role Room',
          'Google Workspace',
          'Google-SSO',
        ]);
        report.checkpoints.push(roleRoom);
      } catch (error) {
        report.checkpoints.push({
          name: 'role-room-domain',
          url: 'https://theroleroom.com/',
          error: String(error),
        });
      } finally {
        await roleRoomPage.close().catch(() => {});
      }
      await persistReport(report);
    }

    let roleRoomFallback = null;
    const roleRoomFallbackTargets = [
      'https://creatorhubn.com/theroleroom.html',
      'https://creatorhubn.com/casting.html',
    ];
    for (const fallbackUrl of roleRoomFallbackTargets) {
      const roleRoomFallbackPage = await context.newPage();
      try {
        await roleRoomFallbackPage.goto(fallbackUrl, { waitUntil: 'domcontentloaded' });
        const checkpoint = await collectCreatorHubCheckpoint(roleRoomFallbackPage, `role-room-fallback:${fallbackUrl}`);
        report.checkpoints.push(checkpoint);
        if (checkpoint.bodyHasRoleRoomLabel) {
          roleRoomFallback = checkpoint;
          await roleRoomFallbackPage.close().catch(() => {});
          break;
        }
      } catch (error) {
        report.checkpoints.push({
          name: `role-room-fallback:${fallbackUrl}`,
          url: fallbackUrl,
          error: String(error),
        });
      } finally {
        await roleRoomFallbackPage.close().catch(() => {});
      }
      await persistReport(report);
    }
    await persistReport(report);

    report.summary.creatorhubAuthenticated = [
      dashboardInitial,
      dashboardReload,
      dashboardNewTab,
      storyArc,
      verificationDemo,
    ].every((checkpoint) => checkpoint.publicSessionAuthenticated && checkpoint.authUserAuthenticated && checkpoint.tokenPresent);

    report.summary.creatorhubWorkspaceConnected = [
      dashboardInitial,
      dashboardReload,
      dashboardNewTab,
      storyArc,
      verificationDemo,
    ].every((checkpoint) => checkpoint.workspaceConnected);

    report.summary.reloadStable =
      dashboardInitial.publicSessionAuthenticated
      && dashboardReload.publicSessionAuthenticated
      && dashboardInitial.workspaceConnected === dashboardReload.workspaceConnected
      && dashboardInitial.authUserEmail === dashboardReload.authUserEmail;

    report.summary.newTabStable =
      dashboardInitial.publicSessionAuthenticated
      && dashboardNewTab.publicSessionAuthenticated
      && dashboardInitial.authUserEmail === dashboardNewTab.authUserEmail
      && dashboardNewTab.workspaceConnected;

    report.summary.storyArcStable =
      storyArc.publicSessionAuthenticated
      && storyArc.workspaceConnected
      && storyArc.url.includes('/story-arc-studio');

    report.summary.verificationDemoStable =
      verificationDemo.publicSessionAuthenticated
      && verificationDemo.workspaceConnected
      && verificationDemo.url.includes('/google-verification-demo');

    const effectiveRoleRoomCheckpoint = roleRoom ?? roleRoomFallback;
    report.summary.roleRoomLoaded = Boolean(
      (roleRoom && roleRoom.matchedTexts?.includes('The Role Room'))
      || (roleRoomFallback && roleRoomFallback.bodyHasRoleRoomLabel),
    );
    report.summary.roleRoomWorkspaceVisible = Boolean(
      (roleRoom && (
        effectiveRoleRoomCheckpoint.matchedTexts?.includes('Google Workspace')
        || effectiveRoleRoomCheckpoint.matchedTexts?.includes('Google-SSO')
      ))
      || (roleRoomFallback && (roleRoomFallback.bodyHasWorkspaceLabel || roleRoomFallback.bodyHasSessionBadge)),
    );
    report.summary.roleRoomSsoStable = Boolean(
      roleRoomFallback
      && roleRoomFallback.publicSessionAuthenticated
      && roleRoomFallback.authUserAuthenticated
      && roleRoomFallback.workspaceConnected,
    );

    await persistReport(report);

    const failed =
      !report.summary.creatorhubAuthenticated
      || !report.summary.creatorhubWorkspaceConnected
      || !report.summary.reloadStable
      || !report.summary.newTabStable
      || !report.summary.storyArcStable
      || !report.summary.verificationDemoStable;

    if (failed) {
      console.error(`Google Workspace live matrix failed. Report: ${reportPath}`);
      console.error(JSON.stringify(report.summary, null, 2));
      process.exit(1);
    }

    console.log(`Google Workspace live matrix passed. Report: ${reportPath}`);
    console.log(JSON.stringify(report.summary, null, 2));
  } finally {
    await context.close();
  }
}

main().catch(async (error) => {
  await fs.mkdir(artifactDir, { recursive: true }).catch(() => {});
  await fs.writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), crashed: true, error: String(error) }, null, 2)).catch(() => {});
  console.error('Google Workspace live matrix crashed:', error);
  process.exit(1);
});
