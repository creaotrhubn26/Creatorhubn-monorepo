#!/usr/bin/env node
import { chromium } from '@playwright/test';

const DEFAULT_BASE_URL = 'https://theroleroom.com';
const DEFAULT_PROJECT_ID = 'project-1775940067549';
const DEFAULT_WAIT_MS = 8_000;
const DEFAULT_STATUS_REQUEST_BUDGET = 6;

const baseUrl = (process.env.ROLE_ROOM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
const expectedSha = process.env.ROLE_ROOM_EXPECTED_SHA || '';
const projectId = process.env.ROLE_ROOM_API_PROJECT_ID || DEFAULT_PROJECT_ID;
const consoleWaitMs = Number(process.env.ROLE_ROOM_CONSOLE_WAIT_MS || DEFAULT_WAIT_MS);
const statusRequestBudget = Number(process.env.ROLE_ROOM_STATUS_REQUEST_BUDGET || DEFAULT_STATUS_REQUEST_BUDGET);

const fail = (message, details = {}) => {
  console.error(JSON.stringify({ ok: false, message, ...details }, null, 2));
  process.exit(1);
};

const fetchText = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
};

const fetchJson = async (url, options = {}) => {
  const { response, text } = await fetchText(url, options);
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parseError: true, raw: text.slice(0, 400) };
  }
  return { response, body };
};

const assertOkResponse = async (label, url) => {
  const { response, body } = await fetchJson(url);
  if (!response.ok) {
    fail(`${label} svarte ikke OK`, {
      url,
      status: response.status,
      body,
    });
  }
  return body;
};

const assertShaMatches = (label, actualSha) => {
  if (!expectedSha) {
    return;
  }
  if (!actualSha || !String(actualSha).startsWith(expectedSha)) {
    fail(`${label} matcher ikke forventet commit`, {
      expectedSha,
      actualSha,
    });
  }
};

const health = await assertOkResponse('Backend health', `${baseUrl}/api/health`);
assertShaMatches('Backend commit', health.commit);

const buildInfoResult = await fetchJson(`${baseUrl}/build-info.json`, {
  headers: {
    'cache-control': 'no-cache',
  },
});
const buildInfo = buildInfoResult.response.ok ? buildInfoResult.body : null;
if (expectedSha && !buildInfo) {
  fail('Frontend build-info mangler', {
    expectedSha,
    status: buildInfoResult.response.status,
  });
}
if (buildInfo) {
  assertShaMatches('Frontend build-info gitSha', buildInfo.gitSha);
}

const rootHtml = await fetchText(`${baseUrl}/`, {
  headers: {
    'cache-control': 'no-cache',
  },
});
if (!rootHtml.response.ok) {
  fail('Frontend root svarte ikke OK', {
    status: rootHtml.response.status,
  });
}
const mainAssetMatch = rootHtml.text.match(/\/js\/main-[A-Za-z0-9_-]+\.js/);
if (!mainAssetMatch) {
  fail('Fant ikke main asset i frontend HTML');
}

const [linkedInStatus, googleStatus] = await Promise.all([
  assertOkResponse('LinkedIn status', `${baseUrl}/api/role-room/linkedin/status`),
  assertOkResponse('Google status', `${baseUrl}/api/role-room/google/status?projectId=${encodeURIComponent(projectId)}`),
]);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const matchingConsoleErrors = [];
const failedStatusRequests = [];
const statusRequestCounts = new Map();
const errorPattern =
  /ERR_INSUFFICIENT_RESOURCES|\[MODULE ERROR\]|Cannot access .* before initialization|ProducerMediaPanel.*Failed to load|Failed to load Google access status|Failed to load LinkedIn access status/i;
const statusPattern = /\/api\/role-room\/(google|linkedin)\/status/;

page.on('console', (message) => {
  const text = message.text();
  if (['error', 'warning'].includes(message.type()) && errorPattern.test(text)) {
    matchingConsoleErrors.push(`${message.type()}: ${text}`);
  }
});

page.on('request', (request) => {
  const url = request.url();
  if (statusPattern.test(url)) {
    statusRequestCounts.set(url, (statusRequestCounts.get(url) || 0) + 1);
  }
});

page.on('requestfailed', (request) => {
  const url = request.url();
  if (statusPattern.test(url)) {
    failedStatusRequests.push(`${url} :: ${request.failure()?.errorText || 'request failed'}`);
  }
});

await page.goto(`${baseUrl}/theroleroom`, {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});
await page.waitForTimeout(consoleWaitMs);
await browser.close();

const excessiveStatusRequests = Array.from(statusRequestCounts.entries())
  .filter(([, count]) => count > statusRequestBudget)
  .map(([url, count]) => ({ url, count, budget: statusRequestBudget }));

if (matchingConsoleErrors.length || failedStatusRequests.length || excessiveStatusRequests.length) {
  fail('Live browser smoke feilet', {
    matchingConsoleErrors,
    failedStatusRequests,
    excessiveStatusRequests,
  });
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  expectedSha: expectedSha || null,
  backendCommit: health.commit || null,
  frontendGitSha: buildInfo?.gitSha || null,
  mainAsset: mainAssetMatch[0],
  linkedInState: linkedInStatus.state,
  googleState: googleStatus.state,
  statusRequestCounts: Object.fromEntries(statusRequestCounts),
}, null, 2));
