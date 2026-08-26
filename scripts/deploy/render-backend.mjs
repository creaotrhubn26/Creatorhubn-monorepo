#!/usr/bin/env node

import assert from 'node:assert/strict';
import process from 'node:process';

const RENDER_API_BASE = 'https://api.render.com/v1';
const FAILURE_STATUSES = new Set([
  'build_failed',
  'update_failed',
  'pre_deploy_failed',
  'canceled',
  'cancelled',
  'deactivated',
]);
const DEFAULT_POLL_INTERVAL_MS = 15_000;
const DEFAULT_DEPLOY_TIMEOUT_MS = 35 * 60_000;
const DEFAULT_PUBLIC_TIMEOUT_MS = 10 * 60_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(name + ' is required');
  return value;
}

function validateServiceId(value) {
  if (!/^srv-[a-z0-9]{20}$/.test(value)) {
    throw new Error('RENDER_SERVICE_ID is invalid');
  }
  return value;
}

function validateBackendUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('BACKEND_URL must be a valid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('BACKEND_URL must use HTTPS');
  }
  return parsed.origin;
}

function validateCommit(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error('A full 40-character Git commit SHA is required');
  }
  return normalized;
}

function apiErrorDetail(body) {
  if (!body || typeof body !== 'object') return 'request_failed';
  const candidate = body.message || body.error || body.status;
  return typeof candidate === 'string' ? candidate.slice(0, 300) : 'request_failed';
}

export function unwrapDeploy(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.deploy && typeof value.deploy === 'object') return value.deploy;
  return typeof value.id === 'string' ? value : null;
}

export function deployCommitId(deploy) {
  if (!deploy || typeof deploy !== 'object') return '';
  if (typeof deploy.commitId === 'string') return deploy.commitId.toLowerCase();
  if (typeof deploy.commit?.id === 'string') {
    return deploy.commit.id.toLowerCase();
  }
  return '';
}

export function commitsMatch(actual, expected) {
  const left = String(actual || '').trim().toLowerCase();
  const right = String(expected || '').trim().toLowerCase();
  if (left.length < 7 || right.length < 7) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

async function renderRequest(
  fetchImpl,
  apiKey,
  pathname,
  { method = 'GET', body, attempts = 5 } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(RENDER_API_BASE + pathname, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiKey,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
      const raw = await response.text();
      let parsed = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
      }

      if (response.ok) return parsed;
      const retryable = response.status === 429 || response.status >= 500;
      const error = new Error(
        'Render API ' +
          method +
          ' ' +
          pathname +
          ' returned HTTP ' +
          response.status +
          ': ' +
          apiErrorDetail(parsed),
      );
      if (!retryable || attempt === attempts) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }
    const backoffMs = Math.min(2 ** (attempt - 1) * 1_000, 10_000);
    await sleep(backoffMs + Math.floor(Math.random() * 500));
  }
  throw lastError || new Error('Render API request failed');
}

export function isAutoDeployDisabled(service) {
  const disabled =
    service?.autoDeploy === false || service?.autoDeploy === 'no';
  const triggerOff =
    service?.autoDeployTrigger == null ||
    service?.autoDeployTrigger === 'off';
  return disabled && triggerOff;
}

export async function disableAutoDeploy({
  fetchImpl = fetch,
  apiKey,
  serviceId,
}) {
  await renderRequest(fetchImpl, apiKey, '/services/' + serviceId, {
    method: 'PATCH',
    body: { autoDeploy: 'no' },
  });
  const service = await renderRequest(
    fetchImpl,
    apiKey,
    '/services/' + serviceId,
  );
  if (!isAutoDeployDisabled(service)) {
    throw new Error('Render auto-deploy is still enabled after the update');
  }
  console.log('Render auto-deploy is disabled; GitHub owns production deploys.');
}

async function findDeployForCommit(fetchImpl, apiKey, serviceId, commit) {
  const response = await renderRequest(
    fetchImpl,
    apiKey,
    '/services/' + serviceId + '/deploys?limit=20',
  );
  if (!Array.isArray(response)) return null;
  for (const item of response) {
    const deploy = unwrapDeploy(item);
    if (deploy && commitsMatch(deployCommitId(deploy), commit)) return deploy;
  }
  return null;
}

async function getDeploy(fetchImpl, apiKey, serviceId, deployId) {
  return unwrapDeploy(
    await renderRequest(
      fetchImpl,
      apiKey,
      '/services/' + serviceId + '/deploys/' + deployId,
    ),
  );
}

async function waitForDeploy({
  fetchImpl,
  apiKey,
  serviceId,
  commit,
  initialDeploy,
  pollIntervalMs,
  timeoutMs,
}) {
  const deadline = Date.now() + timeoutMs;
  let deploy = initialDeploy;
  let lastStatus = '';

  while (Date.now() < deadline) {
    if (deploy?.id) {
      deploy = await getDeploy(fetchImpl, apiKey, serviceId, deploy.id);
    } else {
      deploy = await findDeployForCommit(
        fetchImpl,
        apiKey,
        serviceId,
        commit,
      );
    }

    const status = String(deploy?.status || 'waiting');
    if (status !== lastStatus) {
      console.log('Render deploy status: ' + status);
      lastStatus = status;
    }
    if (status === 'live') {
      if (!commitsMatch(deployCommitId(deploy), commit)) {
        throw new Error('Render reported live for an unexpected commit');
      }
      return deploy;
    }
    if (FAILURE_STATUSES.has(status)) {
      throw new Error('Render deploy failed with status ' + status);
    }
    await sleep(pollIntervalMs);
  }
  throw new Error('Render deploy did not become live before the timeout');
}

async function fetchPublicJson(fetchImpl, url) {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}

async function verifyPublicDeployment({
  fetchImpl,
  backendUrl,
  commit,
  pollIntervalMs,
  timeoutMs,
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const version = await fetchPublicJson(
        fetchImpl,
        backendUrl + '/api/version?expected=' + commit,
      );
      if (commitsMatch(version?.commit, commit)) break;
    } catch {
      // The previous instance can be reachable briefly during the rollover.
    }
    await sleep(pollIntervalMs);
  }

  const version = await fetchPublicJson(
    fetchImpl,
    backendUrl + '/api/version?expected=' + commit,
  );
  if (!commitsMatch(version?.commit, commit)) {
    throw new Error('Public backend did not report the deployed commit');
  }

  const health = await fetchPublicJson(fetchImpl, backendUrl + '/api/health');
  if (health?.status !== 'ok') {
    throw new Error('Backend health check is not ok');
  }

  const removedRoute = await fetchImpl(
    backendUrl + '/api/admin-room/migrations/run',
    {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (removedRoute.status !== 404) {
    throw new Error(
      'Removed migration endpoint returned HTTP ' + removedRoute.status,
    );
  }
  console.log('Public version, health, and removed-route smoke checks passed.');
}

export async function deployAndVerify({
  fetchImpl = fetch,
  apiKey,
  serviceId,
  backendUrl,
  commit,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  deployTimeoutMs = DEFAULT_DEPLOY_TIMEOUT_MS,
  publicTimeoutMs = DEFAULT_PUBLIC_TIMEOUT_MS,
}) {
  const created = await renderRequest(
    fetchImpl,
    apiKey,
    '/services/' + serviceId + '/deploys',
    {
      method: 'POST',
      body: { commitId: commit, clearCache: 'do_not_clear' },
    },
  );
  console.log('Triggered Render deploy for commit ' + commit + '.');
  await waitForDeploy({
    fetchImpl,
    apiKey,
    serviceId,
    commit,
    initialDeploy: unwrapDeploy(created),
    pollIntervalMs,
    timeoutMs: deployTimeoutMs,
  });
  await verifyPublicDeployment({
    fetchImpl,
    backendUrl,
    commit,
    pollIntervalMs,
    timeoutMs: publicTimeoutMs,
  });
}

function runSelfTest() {
  assert.equal(
    deployCommitId({ commit: { id: 'A'.repeat(40) } }),
    'a'.repeat(40),
  );
  assert.equal(commitsMatch('abcdef123', 'abcdef1234567890'), true);
  assert.equal(commitsMatch('abc', 'abcdef1234567890'), false);
  assert.deepEqual(unwrapDeploy({ deploy: { id: 'dep-test' } }), {
    id: 'dep-test',
  });
  assert.equal(unwrapDeploy({ cursor: 'next' }), null);
  assert.equal(
    isAutoDeployDisabled({ autoDeploy: 'no', autoDeployTrigger: 'off' }),
    true,
  );
  assert.equal(isAutoDeployDisabled({ autoDeploy: false }), true);
  assert.equal(isAutoDeployDisabled({ autoDeploy: 'yes' }), false);
  assert.throws(() => validateCommit('main'), /40-character/);
  assert.throws(() => validateBackendUrl('http://example.test'), /HTTPS/);
  console.log('Render backend deploy self-test passed.');
}

async function main() {
  const command = process.argv[2];
  if (command === '--self-test') {
    runSelfTest();
    return;
  }

  const apiKey = requiredEnv('RENDER_API_KEY');
  const serviceId = validateServiceId(requiredEnv('RENDER_SERVICE_ID'));
  if (command === 'disable-auto-deploy') {
    await disableAutoDeploy({ apiKey, serviceId });
    return;
  }
  if (command === 'deploy-and-verify') {
    const commit = validateCommit(process.argv[3]);
    const backendUrl = validateBackendUrl(requiredEnv('BACKEND_URL'));
    await deployAndVerify({
      apiKey,
      serviceId,
      backendUrl,
      commit,
    });
    return;
  }
  throw new Error(
    'Usage: render-backend.mjs --self-test | disable-auto-deploy | deploy-and-verify <sha>',
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'unknown_error';
  console.error('Render deployment gate failed: ' + message);
  process.exitCode = 1;
});
