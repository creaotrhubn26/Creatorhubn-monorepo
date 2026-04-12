#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendDir = path.join(repoRoot, 'frontend');
const renderServiceId = process.env.ROLE_ROOM_RENDER_SERVICE_ID || 'srv-d76ob60ule4c73dv2p60';
const baseUrl = (process.env.ROLE_ROOM_BASE_URL || 'https://theroleroom.com').replace(/\/$/, '');
const renderApiKeyService = process.env.RENDER_API_KEYCHAIN_SERVICE || 'creatorhub-render-api-key';
const renderApiKeyAccount = process.env.RENDER_API_KEYCHAIN_ACCOUNT || 'usmanqazi';
const pollIntervalMs = Number(process.env.ROLE_ROOM_DEPLOY_POLL_INTERVAL_MS || 15_000);
const renderTimeoutMs = Number(process.env.ROLE_ROOM_RENDER_TIMEOUT_MS || 15 * 60_000);
const autoTriggerAfterMs = Number(process.env.ROLE_ROOM_RENDER_TRIGGER_AFTER_MS || 90_000);
const generatedArtifactPattern =
  /(^|\/)(\.playwright-cli|playwright-report|test-results)(\/|$)|(^|\/)output[^/]*\.(png|jpg|jpeg|webp)$/i;
const allowedDirtyPattern =
  /(^|\/)(\.playwright-cli|playwright-report|test-results)(\/|$)|(^|\/)output[^/]*\.(png|jpg|jpeg|webp|html|pdf)$/i;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const skipBuild = args.has('--skip-build');
const skipPush = args.has('--skip-push');
const skipVercel = args.has('--skip-vercel');
const skipRender = args.has('--skip-render');
const skipSmoke = args.has('--skip-smoke');

const log = (message) => {
  console.log(`[role-room-deploy] ${message}`);
};

const fail = (message) => {
  console.error(`[role-room-deploy] ${message}`);
  process.exit(1);
};

const run = (command, argsList, options = {}) => {
  log(`$ ${command} ${argsList.join(' ')}`);
  if (dryRun && options.skipInDryRun !== false) {
    return '';
  }
  const result = spawnSync(command, argsList, {
    cwd: options.cwd || repoRoot,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.status !== 0) {
    if (options.capture) {
      process.stdout.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
    }
    fail(`${command} feilet med exit code ${result.status}`);
  }
  return options.capture ? result.stdout : '';
};

const capture = (command, argsList, options = {}) => run(command, argsList, { ...options, capture: true });

const commandExists = (command) => {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], {
    stdio: 'ignore',
  });
  return result.status === 0;
};

const getRenderApiKey = () => {
  if (process.env.RENDER_API_KEY) {
    return process.env.RENDER_API_KEY;
  }
  if (process.platform !== 'darwin' || !commandExists('security')) {
    return '';
  }
  try {
    return execFileSync('security', [
      'find-generic-password',
      '-s',
      renderApiKeyService,
      '-a',
      renderApiKeyAccount,
      '-w',
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

const parseJson = (raw, label) => {
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`Kunne ikke parse JSON fra ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const ensureTools = () => {
  ['git', 'npm', 'render', 'vercel'].forEach((tool) => {
    if (!commandExists(tool)) {
      fail(`${tool} mangler i PATH`);
    }
  });
  if (!existsSync(path.join(frontendDir, '.vercel', 'project.json'))) {
    fail('frontend/.vercel/project.json mangler, kan ikke deploye riktig Vercel-prosjekt');
  }
};

const ensureGitState = (branch) => {
  if (branch !== 'main') {
    fail(`Production deploy må kjøres fra main. Nåværende branch er ${branch}`);
  }

  const stagedFiles = capture('git', ['diff', '--cached', '--name-only'], { skipInDryRun: false })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
  if (stagedFiles.length) {
    const stagedArtifacts = stagedFiles.filter((file) => generatedArtifactPattern.test(file));
    if (stagedArtifacts.length) {
      fail(`Genererte artefakter er staged og må ut før deploy:\n${stagedArtifacts.join('\n')}`);
    }
    fail(`Production deploy krever at alle kodeendringer er committet først:\n${stagedFiles.join('\n')}`);
  }

  const dirtyFiles = capture('git', ['diff', '--name-only'], { skipInDryRun: false })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
  const blockingDirtyFiles = dirtyFiles.filter((file) => !allowedDirtyPattern.test(file));
  if (blockingDirtyFiles.length) {
    fail(`Ucommittede kodeendringer blokkerer production deploy:\n${blockingDirtyFiles.join('\n')}`);
  }

  const untrackedFiles = capture('git', ['ls-files', '--others', '--exclude-standard'], { skipInDryRun: false })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
  const deploySurfaceUntrackedFiles = untrackedFiles.filter((file) =>
    file.startsWith('frontend/') || file.startsWith('backend/server/') || file.startsWith('scripts/'));
  if (deploySurfaceUntrackedFiles.length) {
    fail(`Utrackede deploy-filer må committes eller ignoreres før production deploy:\n${deploySurfaceUntrackedFiles.join('\n')}`);
  }
};

const ensurePushed = (sha) => {
  if (!skipPush) {
    run('git', ['push', 'origin', 'main']);
  }
  const remote = capture('git', ['ls-remote', 'origin', 'refs/heads/main'], { skipInDryRun: false }).trim();
  const remoteSha = remote.split(/\s+/)[0] || '';
  if (remoteSha !== sha) {
    fail(`origin/main matcher ikke lokal HEAD. local=${sha} remote=${remoteSha || 'missing'}`);
  }
};

const renderEnv = (apiKey) => ({ RENDER_API_KEY: apiKey });

const listRenderDeploys = (apiKey) => {
  const raw = capture('render', ['deploys', 'list', renderServiceId, '-o', 'json'], {
    env: renderEnv(apiKey),
    skipInDryRun: false,
  });
  return parseJson(raw, 'render deploys list');
};

const waitForRenderDeploy = (sha, apiKey) => {
  if (skipRender) {
    log('Hopper over Render-verifisering');
    return;
  }
  if (!apiKey) {
    fail('RENDER_API_KEY mangler, og nøkkel ble ikke funnet i Keychain');
  }

  let triggeredManualDeploy = false;
  const start = Date.now();
  while (Date.now() - start < renderTimeoutMs) {
    const deploys = listRenderDeploys(apiKey);
    const deploy = deploys.find((candidate) => candidate?.commit?.id === sha);
    if (!deploy && !triggeredManualDeploy && Date.now() - start > autoTriggerAfterMs) {
      log(`Fant ikke auto-deploy for ${sha}; trigger Render deploy eksplisitt`);
      run('render', ['deploys', 'create', renderServiceId, '--commit', sha, '--confirm', '--wait', '-o', 'json'], {
        env: renderEnv(apiKey),
      });
      triggeredManualDeploy = true;
      continue;
    }
    if (!deploy) {
      log('Venter på at Render oppretter deploy for commit');
    } else if (deploy.status === 'live') {
      log(`Render live: ${deploy.id}`);
      return;
    } else if (['build_failed', 'update_failed', 'canceled'].includes(deploy.status)) {
      fail(`Render deploy ${deploy.id} feilet med status ${deploy.status}`);
    } else {
      log(`Render deploy ${deploy.id}: ${deploy.status}`);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pollIntervalMs);
  }
  fail(`Render deploy ble ikke live innen ${Math.round(renderTimeoutMs / 1000)} sekunder`);
};

const deployVercel = (sha, branch) => {
  if (skipVercel) {
    log('Hopper over Vercel production deploy');
    return;
  }
  run('vercel', [
    'deploy',
    '--prod',
    '--force',
    '-y',
    '-b',
    `VITE_BUILD_GIT_SHA=${sha}`,
    '-b',
    `VITE_BUILD_BRANCH=${branch}`,
    '-b',
    'VITE_BUILD_SOURCE=role-room-prod-script',
    '-m',
    `gitSha=${sha}`,
  ], {
    cwd: frontendDir,
  });
};

const runBuilds = (sha, branch) => {
  if (skipBuild) {
    log('Hopper over lokale builds');
    return;
  }
  const buildEnv = {
    VITE_BUILD_GIT_SHA: sha,
    VITE_BUILD_BRANCH: branch,
    VITE_BUILD_SOURCE: 'role-room-prod-script-local-build',
  };
  run('npm', ['--prefix', 'frontend', 'run', 'build'], { env: buildEnv });
  run('npm', ['--prefix', 'backend', 'run', 'build']);
};

const runLiveSmoke = (sha) => {
  if (skipSmoke) {
    log('Hopper over live smoke-test');
    return;
  }
  run('node', ['scripts/role-room-live-smoke.mjs'], {
    env: {
      ROLE_ROOM_BASE_URL: baseUrl,
      ROLE_ROOM_EXPECTED_SHA: sha,
    },
  });
};

ensureTools();
const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { skipInDryRun: false }).trim();
const sha = capture('git', ['rev-parse', 'HEAD'], { skipInDryRun: false }).trim();
ensureGitState(branch);

log(`Starter production deploy for ${branch}@${sha}`);
runBuilds(sha, branch);
ensurePushed(sha);
waitForRenderDeploy(sha, getRenderApiKey());
deployVercel(sha, branch);
runLiveSmoke(sha);
log('Production deploy og verifisering er ferdig');
