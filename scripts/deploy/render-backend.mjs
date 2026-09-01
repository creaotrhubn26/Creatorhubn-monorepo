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
const ALLOWED_POSTGRES_TLS_MODES = new Set([
  'require',
  'verify-ca',
  'verify-full',
]);

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
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error('A full 40-character Git commit SHA is required');
  }
  return normalized;
}

function apiErrorDetail(body) {
  if (!body || typeof body !== 'object') return 'request_failed';
  const candidate = body.message || body.error || body.status;
  return typeof candidate === 'string'
    ? candidate.slice(0, 300)
    : 'request_failed';
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
  const left = String(actual || '')
    .trim()
    .toLowerCase();
  const right = String(expected || '')
    .trim()
    .toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(left) || !/^[0-9a-f]{40}$/.test(right)) {
    return false;
  }
  return left === right;
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
      if (!retryable) {
        error.renderRetryable = false;
        throw error;
      }
      if (attempt === attempts) throw error;
      lastError = error;
    } catch (error) {
      if (error?.renderRetryable === false) throw error;
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
    service?.autoDeployTrigger == null || service?.autoDeployTrigger === 'off';
  return disabled && triggerOff;
}

export async function assertAutoDeployDisabled({
  fetchImpl = fetch,
  apiKey,
  serviceId,
}) {
  const service = await renderRequest(
    fetchImpl,
    apiKey,
    '/services/' + serviceId,
  );
  if (!isAutoDeployDisabled(service)) {
    throw new Error(
      'Render auto-deploy must already be disabled before a release starts',
    );
  }
  console.log('Verified that Render auto-deploy is disabled.');
}
async function readRenderEnvironmentValue({
  fetchImpl,
  apiKey,
  serviceId,
  key,
}) {
  let response;
  try {
    response = await renderRequest(
      fetchImpl,
      apiKey,
      '/services/' + serviceId + '/env-vars/' + encodeURIComponent(key),
    );
  } catch {
    throw new Error('Render environment variable is unavailable: ' + key);
  }
  const envVar = response?.envVar ?? response;
  if (envVar?.key !== key || typeof envVar.value !== 'string') {
    throw new Error(
      'Render environment variable is missing or invalid: ' + key,
    );
  }
  return envVar.value;
}

function postgresDatabaseTarget(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch {
    return null;
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    return null;
  }
  const connectionParameterValues = (parameterName) =>
    [...parsed.searchParams.entries()]
      .filter(([name]) => name.toLowerCase() === parameterName)
      .map(([, parameterValue]) => String(parameterValue).toLowerCase());
  const sslModes = connectionParameterValues('sslmode');
  if (sslModes.length !== 1 || !ALLOWED_POSTGRES_TLS_MODES.has(sslModes[0]))
    return null;
  const channelBindings = connectionParameterValues('channel_binding');
  if (channelBindings.length !== 1 || channelBindings[0] !== 'require')
    return null;
  const encodedDatabase = parsed.pathname.slice(1);
  if (!encodedDatabase || encodedDatabase.includes('/')) return null;
  if (!parsed.username || !parsed.password) return null;
  let username;
  let password;
  let database;
  try {
    username = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
    database = decodeURIComponent(encodedDatabase);
  } catch {
    return null;
  }
  if (!username || !password || !database) return null;
  const hostname = parsed.hostname.toLowerCase();
  const labels = hostname.split('.');
  const pooled = labels[0]?.endsWith('-pooler') === true;
  if (pooled) {
    labels[0] = labels[0].slice(0, -'-pooler'.length);
  }
  if (
    !hostname.endsWith('.neon.tech') ||
    !/^ep-[a-z0-9-]+$/.test(labels[0] || '')
  )
    return null;
  return {
    hostname: labels.join('.'),
    port: parsed.port || '5432',
    database,
    username,
    pooled,
  };
}

export function databaseTargetsMatch(left, right) {
  const leftTarget = postgresDatabaseTarget(left);
  const rightTarget = postgresDatabaseTarget(right);
  return Boolean(
    leftTarget &&
    rightTarget &&
    leftTarget.hostname === rightTarget.hostname &&
    leftTarget.port === rightTarget.port &&
    leftTarget.database === rightTarget.database,
  );
}

export function isLeastPrivilegeRuntimeDatabaseUrl(value) {
  const target = postgresDatabaseTarget(value);
  return Boolean(
    target && target.username === 'creatorhub_runtime_login' && target.pooled,
  );
}

function isLeastPrivilegeMigrationDatabaseUrl(value) {
  const target = postgresDatabaseTarget(value);
  return Boolean(
    target &&
    target.username === 'creatorhub_migration_login' &&
    !target.pooled,
  );
}

export async function assertRuntimeDatabaseRoles({
  fetchImpl = fetch,
  apiKey,
  serviceId,
  expectedMigrationDatabaseUrl,
  expected = {
    DATABASE_LOGIN_ROLE: 'creatorhub_runtime_login',
    DATABASE_OWNER_ROLE: 'creatorhub_schema_owner',
  },
}) {
  const databaseUrl = await readRenderEnvironmentValue({
    fetchImpl,
    apiKey,
    serviceId,
    key: 'DATABASE_URL',
  });
  const loginRole = await readRenderEnvironmentValue({
    fetchImpl,
    apiKey,
    serviceId,
    key: 'DATABASE_LOGIN_ROLE',
  });
  const ownerRole = await readRenderEnvironmentValue({
    fetchImpl,
    apiKey,
    serviceId,
    key: 'DATABASE_OWNER_ROLE',
  });

  const mismatches = [];
  if (loginRole !== expected.DATABASE_LOGIN_ROLE) {
    mismatches.push('DATABASE_LOGIN_ROLE');
  }
  if (ownerRole !== expected.DATABASE_OWNER_ROLE) {
    mismatches.push('DATABASE_OWNER_ROLE');
  }
  if (
    !isLeastPrivilegeRuntimeDatabaseUrl(databaseUrl) ||
    !isLeastPrivilegeMigrationDatabaseUrl(expectedMigrationDatabaseUrl) ||
    !databaseTargetsMatch(databaseUrl, expectedMigrationDatabaseUrl)
  ) {
    mismatches.push('DATABASE_URL');
  }
  if (mismatches.length > 0) {
    throw new Error(
      'Render runtime database role configuration is missing or invalid: ' +
        mismatches.join(', '),
    );
  }
  console.log('Verified Render runtime database role configuration.');
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
  console.log(
    'Render auto-deploy is disabled; use the canonical GitHub production workflow.',
  );
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
  const deployId =
    typeof initialDeploy?.id === 'string' ? initialDeploy.id.trim() : '';
  if (!deployId) {
    throw new Error('Render deploy trigger did not return a deploy identity');
  }
  let deploy = null;
  let lastStatus = '';

  while (Date.now() < deadline) {
    deploy = await getDeploy(fetchImpl, apiKey, serviceId, deployId);
    if (!deploy || deploy.id !== deployId) {
      throw new Error('Render deploy lookup returned an unexpected identity');
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
  // A long migration separates workflow preflight from this mutation.
  // Re-read Render immediately before triggering the exact deploy.
  await assertAutoDeployDisabled({ fetchImpl, apiKey, serviceId });

  const created = await renderRequest(
    fetchImpl,
    apiKey,
    '/services/' + serviceId + '/deploys',
    {
      method: 'POST',
      body: { commitId: commit, clearCache: 'do_not_clear' },
      attempts: 1,
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
  // Fail the release gate if service configuration drifted during rollout.
  // The exact public commit has already been verified at this point.
  await assertAutoDeployDisabled({ fetchImpl, apiKey, serviceId });
}

async function runSelfTest() {
  assert.equal(
    deployCommitId({ commit: { id: 'A'.repeat(40) } }),
    'a'.repeat(40),
  );
  assert.equal(commitsMatch('a'.repeat(40), 'a'.repeat(40)), true);
  assert.equal(commitsMatch('abcdef123', 'abcdef1234567890'), false);
  assert.equal(commitsMatch('a'.repeat(40), 'a'.repeat(39) + 'b'), false);
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

  const responseFor = (body) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
  let nonRetryableRequestCount = 0;
  let ambiguousDeployPostCount = 0;
  let ambiguousDeployServerErrorCount = 0;
  let staleSameCommitLookupCalled = false;
  await assert.doesNotReject(
    assertAutoDeployDisabled({
      fetchImpl: async () => responseFor({ autoDeploy: 'no' }),
      apiKey: 'test-key',
      serviceId: 'srv-' + 'a'.repeat(20),
    }),
  );
  await assert.rejects(
    assertAutoDeployDisabled({
      fetchImpl: async () => responseFor({ autoDeploy: 'yes' }),
      apiKey: 'test-key',
      serviceId: 'srv-' + 'a'.repeat(20),
    }),
    /must already be disabled/,
  );
  await assert.rejects(
    assertAutoDeployDisabled({
      fetchImpl: async () => {
        nonRetryableRequestCount += 1;
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ message: 'invalid request' }),
        };
      },
      apiKey: 'test-key',
      serviceId: 'srv-' + 'a'.repeat(20),
    }),
    /HTTP 400/,
  );
  assert.equal(nonRetryableRequestCount, 1);
  await assert.rejects(
    deployAndVerify({
      fetchImpl: async (_url, options = {}) => {
        if (options.method !== 'POST') return responseFor({ autoDeploy: 'no' });
        if (options.method === 'POST') {
          ambiguousDeployPostCount += 1;
          throw new Error('ambiguous deploy transport failure');
        }
        throw new Error('unexpected request after ambiguous deploy failure');
      },
      apiKey: 'test-key',
      serviceId: 'srv-' + 'a'.repeat(20),
      backendUrl: 'https://example.test',
      commit: 'a'.repeat(40),
      pollIntervalMs: 0,
      deployTimeoutMs: 100,
      publicTimeoutMs: 100,
    }),
    /ambiguous deploy transport failure/,
  );
  assert.equal(ambiguousDeployPostCount, 1);
  await assert.rejects(
    deployAndVerify({
      fetchImpl: async (_url, options = {}) => {
        if (options.method !== 'POST') return responseFor({ autoDeploy: 'no' });
        if (options.method === 'POST') {
          ambiguousDeployServerErrorCount += 1;
          return {
            ok: false,
            status: 503,
            text: async () => JSON.stringify({ message: 'temporarily down' }),
          };
        }
        throw new Error('unexpected request after ambiguous deploy failure');
      },
      apiKey: 'test-key',
      serviceId: 'srv-' + 'a'.repeat(20),
      backendUrl: 'https://example.test',
      commit: 'a'.repeat(40),
      pollIntervalMs: 0,
      deployTimeoutMs: 100,
      publicTimeoutMs: 100,
    }),
    /HTTP 503/,
  );
  assert.equal(ambiguousDeployServerErrorCount, 1);
  await assert.rejects(
    deployAndVerify({
      fetchImpl: async (url, options = {}) => {
        if (options.method !== 'POST') return responseFor({ autoDeploy: 'no' });
        if (options.method === 'POST') return responseFor({});
        if (String(url).includes('/deploys?limit=')) {
          staleSameCommitLookupCalled = true;
          return responseFor([
            {
              deploy: {
                id: 'dep-old',
                status: 'live',
                commitId: 'a'.repeat(40),
              },
            },
          ]);
        }
        throw new Error('unexpected Render self-test request');
      },
      apiKey: 'test-key',
      serviceId: 'srv-' + 'a'.repeat(20),
      backendUrl: 'https://example.test',
      commit: 'a'.repeat(40),
      pollIntervalMs: 0,
      deployTimeoutMs: 100,
      publicTimeoutMs: 100,
    }),
    /deploy identity/,
  );
  assert.equal(staleSameCommitLookupCalled, false);
  const successfulCommit = 'b'.repeat(40);
  const successfulServiceId = 'srv-' + 'b'.repeat(20);
  let successfulServiceStateReads = 0;
  await assert.doesNotReject(
    deployAndVerify({
      fetchImpl: async (url, options = {}) => {
        const target = String(url);
        if (
          target === RENDER_API_BASE + '/services/' + successfulServiceId &&
          options.method !== 'POST'
        ) {
          successfulServiceStateReads += 1;
          return responseFor({ autoDeploy: 'no' });
        }
        if (target.endsWith('/deploys') && options.method === 'POST') {
          return responseFor({ id: 'dep-new' });
        }
        if (target.endsWith('/deploys/dep-new')) {
          return responseFor({
            id: 'dep-new',
            status: 'live',
            commitId: successfulCommit,
          });
        }
        if (target.startsWith('https://example.test/api/version')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ commit: successfulCommit }),
          };
        }
        if (target === 'https://example.test/api/health') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: 'ok' }),
          };
        }
        if (
          target === 'https://example.test/api/admin-room/migrations/run' &&
          options.method === 'POST'
        ) {
          return { status: 404 };
        }
        throw new Error('unexpected successful Render self-test request');
      },
      apiKey: 'test-key',
      serviceId: successfulServiceId,
      backendUrl: 'https://example.test',
      commit: successfulCommit,
      pollIntervalMs: 0,
      deployTimeoutMs: 100,
      publicTimeoutMs: 100,
    }),
  );
  assert.equal(
    successfulServiceStateReads,
    2,
    'deploy must re-read auto-deploy state immediately before and after rollout',
  );
  const runtimeDatabaseUrl =
    'postgresql://creatorhub_runtime_login:secret@' +
    'ep-example-pooler.eu.neon.tech/neondb?sslmode=require&channel_binding=require';
  const migrationDatabaseUrl =
    'postgresql://creatorhub_migration_login:secret@' +
    'ep-example.eu.neon.tech/neondb?sslmode=require&channel_binding=require';
  const roleEnvironment = new Map([
    ['DATABASE_URL', runtimeDatabaseUrl],
    ['DATABASE_LOGIN_ROLE', 'creatorhub_runtime_login'],
    ['DATABASE_OWNER_ROLE', 'creatorhub_schema_owner'],
  ]);
  const requestedRoleKeys = [];
  const roleFetch = async (url) => {
    const key = decodeURIComponent(String(url).split('/').at(-1) || '');
    requestedRoleKeys.push(key);
    return responseFor({ envVar: { key, value: roleEnvironment.get(key) } });
  };
  await assert.doesNotReject(
    assertRuntimeDatabaseRoles({
      fetchImpl: roleFetch,
      apiKey: 'test-key',
      serviceId: 'srv-' + 'a'.repeat(20),
      expectedMigrationDatabaseUrl: migrationDatabaseUrl,
    }),
  );
  assert.deepEqual(requestedRoleKeys, [
    'DATABASE_URL',
    'DATABASE_LOGIN_ROLE',
    'DATABASE_OWNER_ROLE',
  ]);
  assert.equal(isLeastPrivilegeRuntimeDatabaseUrl(runtimeDatabaseUrl), true);
  assert.equal(
    isLeastPrivilegeRuntimeDatabaseUrl(
      runtimeDatabaseUrl.replace('-pooler.', '.'),
    ),
    false,
  );
  assert.equal(
    isLeastPrivilegeRuntimeDatabaseUrl(
      runtimeDatabaseUrl.replace('creatorhub_runtime_login', 'neondb_owner'),
    ),
    false,
  );

  assert.equal(
    isLeastPrivilegeRuntimeDatabaseUrl(
      runtimeDatabaseUrl.replace('sslmode=require', 'sslmode=disable'),
    ),
    false,
  );
  assert.equal(
    isLeastPrivilegeRuntimeDatabaseUrl(
      runtimeDatabaseUrl.replace(':secret@', '@'),
    ),
    false,
  );
  assert.equal(
    isLeastPrivilegeRuntimeDatabaseUrl(
      runtimeDatabaseUrl.replace('.neon.tech', '.example.com'),
    ),
    false,
  );
  assert.equal(
    isLeastPrivilegeRuntimeDatabaseUrl(
      runtimeDatabaseUrl.replace('&channel_binding=require', ''),
    ),
    false,
  );
  assert.equal(
    databaseTargetsMatch(runtimeDatabaseUrl, migrationDatabaseUrl),
    true,
  );
  assert.equal(
    databaseTargetsMatch(
      runtimeDatabaseUrl,
      migrationDatabaseUrl.replace('/neondb?', '/other_database?'),
    ),
    false,
  );
  for (const invalidMigrationDatabaseUrl of [
    migrationDatabaseUrl.replace('sslmode=require', 'sslmode=disable'),
    migrationDatabaseUrl.replace('&channel_binding=require', ''),
    migrationDatabaseUrl.replace(
      'creatorhub_migration_login',
      'creatorhub_migrator',
    ),
    migrationDatabaseUrl.replace(':secret@', '@'),
    migrationDatabaseUrl.replace('.neon.tech', '.example.com'),
  ]) {
    await assert.rejects(
      assertRuntimeDatabaseRoles({
        fetchImpl: roleFetch,
        apiKey: 'test-key',
        serviceId: 'srv-' + 'a'.repeat(20),
        expectedMigrationDatabaseUrl: invalidMigrationDatabaseUrl,
      }),
      /DATABASE_URL/,
    );
  }
  await assert.rejects(
    assertRuntimeDatabaseRoles({
      fetchImpl: roleFetch,
      apiKey: 'test-key',
      serviceId: 'srv-' + 'a'.repeat(20),
      expectedMigrationDatabaseUrl: migrationDatabaseUrl.replace(
        '/neondb?',
        '/other_database?',
      ),
    }),
    /DATABASE_URL/,
  );
  await assert.rejects(
    assertRuntimeDatabaseRoles({
      fetchImpl: async (url) => {
        const key = decodeURIComponent(String(url).split('/').at(-1) || '');
        if (key === 'DATABASE_OWNER_ROLE') {
          return {
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ message: runtimeDatabaseUrl }),
          };
        }
        return responseFor({
          envVar: { key, value: roleEnvironment.get(key) },
        });
      },
      apiKey: 'test-key',
      serviceId: 'srv-' + 'a'.repeat(20),
    }),
    (error) => {
      assert.match(error.message, /DATABASE_OWNER_ROLE/);
      assert.doesNotMatch(error.message, /creatorhub_runtime_login:secret/);
      return true;
    },
  );
  console.log('Render backend deploy self-test passed.');
}

async function main() {
  const command = process.argv[2];
  if (command === '--self-test') {
    await runSelfTest();
    return;
  }

  const apiKey = requiredEnv('RENDER_API_KEY');
  const serviceId = validateServiceId(requiredEnv('RENDER_SERVICE_ID'));
  if (command === 'disable-auto-deploy') {
    await disableAutoDeploy({ apiKey, serviceId });
    return;
  }
  if (command === 'assert-auto-deploy-off') {
    await assertAutoDeployDisabled({ apiKey, serviceId });
    return;
  }
  if (command === 'assert-runtime-database-roles') {
    const expectedMigrationDatabaseUrl = requiredEnv(
      'PRODUCTION_MIGRATION_DATABASE_URL',
    );
    await assertRuntimeDatabaseRoles({
      apiKey,
      serviceId,
      expectedMigrationDatabaseUrl,
    });
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
    'Usage: render-backend.mjs --self-test | assert-auto-deploy-off | assert-runtime-database-roles | disable-auto-deploy | deploy-and-verify <sha>',
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'unknown_error';
  console.error('Render deployment gate failed: ' + message);
  process.exitCode = 1;
});
