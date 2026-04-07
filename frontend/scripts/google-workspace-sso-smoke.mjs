import fs from 'node:fs/promises';
import path from 'node:path';

const frontendRoot = process.cwd();
const repoRoot = path.resolve(frontendRoot, '..');
const reportDir = path.resolve(frontendRoot, 'output/google-workspace');
const reportPath = path.join(reportDir, 'google-session-smoke-report.json');

const forbiddenPatterns = [
  { id: 'legacy_keep_auth_endpoint', needle: '/api/auth/google/keep' },
  { id: 'legacy_keep_status_endpoint', needle: '/api/google-keep/status' },
  { id: 'legacy_keep_sync_endpoint', needle: '/api/google-keep/sync-worklog' },
  { id: 'legacy_worklog_entries_endpoint', needle: '/api/worklog/entries' },
  { id: 'legacy_worklog_recent_endpoint', needle: '/api/worklog/recent' },
];

const surfaceChecks = [
  {
    name: 'Shared auth helper',
    file: path.resolve(frontendRoot, 'client/src/lib/creatorhubGoogleAuth.ts'),
    requiredSnippets: ['export async function startCreatorHubGoogleSso', "window.dispatchEvent(new Event('auth-changed'))"],
  },
  {
    name: 'Universal dashboard',
    file: path.resolve(frontendRoot, 'client/src/components/universal/UniversalDashboard.tsx'),
    requiredSnippets: ['GoogleWorkspaceSessionBadge', 'creatorhub-google-workspace-linked'],
  },
  {
    name: 'Role Room dashboard',
    file: path.resolve(frontendRoot, 'client/src/components/role-room/RoleRoomDashboardPanel.tsx'),
    requiredSnippets: ['GoogleWorkspaceSessionBadge'],
  },
  {
    name: 'Universal worklog',
    file: path.resolve(frontendRoot, 'client/src/components/worklog/UniversalWorklog.tsx'),
    requiredSnippets: [
      'startCreatorHubGoogleSso',
      '/api/google-workspace/storage',
      'creatorhub-google-workspace-linked',
      'auth-changed',
    ],
  },
  {
    name: 'Quick worklog access',
    file: path.resolve(frontendRoot, 'client/src/components/worklog/QuickWorklogAccess.tsx'),
    requiredSnippets: [
      '/api/projects/${encodeURIComponent(resolvedProjectId)}/worklog',
      'Bruker samme prosjekt-worklog og Google Workspace-økt',
    ],
  },
  {
    name: 'Universal chat',
    file: path.resolve(frontendRoot, 'client/src/components/chat/UniversalChatWidget.tsx'),
    requiredSnippets: ['creatorhub-google-workspace-linked', 'auth-changed'],
  },
  {
    name: 'Workspace storage panel',
    file: path.resolve(frontendRoot, 'client/src/components/universal/GoogleWorkspaceStorageInfo.tsx'),
    requiredSnippets: ['/api/google-workspace/storage'],
  },
  {
    name: 'Story Arc Studio',
    file: path.resolve(frontendRoot, 'client/src/components/StoryArcStudio.tsx'),
    requiredSnippets: ['startCreatorHubGoogleSso'],
  },
  {
    name: 'Backend workspace storage route',
    file: path.resolve(repoRoot, 'backend/server/index.ts'),
    requiredSnippets: ['app.get("/api/google-workspace/storage/:userId"'],
  },
  {
    name: 'Backend project worklog routes',
    file: path.resolve(repoRoot, 'backend/server/index.ts'),
    requiredSnippets: [
      'app.get("/api/projects/:projectId/worklog"',
      'app.post("/api/projects/:projectId/worklog"',
    ],
  },
];

async function walk(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'playwright-report') {
        continue;
      }
      await walk(fullPath, results);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|html)$/.test(entry.name)) {
      continue;
    }
    if (entry.name.includes('.bak')) {
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function findLineNumbers(source, needle) {
  const lines = source.split('\n');
  const matches = [];
  lines.forEach((line, index) => {
    if (line.includes(needle)) {
      matches.push(index + 1);
    }
  });
  return matches;
}

async function main() {
  const auditFiles = await walk(path.resolve(frontendRoot, 'client/src'));
  auditFiles.push(path.resolve(repoRoot, 'backend/server/index.ts'));

  const report = {
    generatedAt: new Date().toISOString(),
    frontendRoot,
    repoRoot,
    summary: {
      surfacesPassed: 0,
      surfacesFailed: 0,
      forbiddenMatches: 0,
    },
    surfaces: [],
    forbiddenMatches: [],
  };

  for (const surface of surfaceChecks) {
    const contents = await fs.readFile(surface.file, 'utf8');
    const missing = surface.requiredSnippets.filter((snippet) => !contents.includes(snippet));
    report.surfaces.push({
      name: surface.name,
      file: surface.file,
      ok: missing.length === 0,
      missing,
    });
  }

  for (const file of auditFiles) {
    const contents = await fs.readFile(file, 'utf8');
    for (const pattern of forbiddenPatterns) {
      const lines = findLineNumbers(contents, pattern.needle);
      if (lines.length > 0) {
        report.forbiddenMatches.push({
          id: pattern.id,
          file,
          needle: pattern.needle,
          lines,
        });
      }
    }
  }

  report.summary.surfacesPassed = report.surfaces.filter((surface) => surface.ok).length;
  report.summary.surfacesFailed = report.surfaces.filter((surface) => !surface.ok).length;
  report.summary.forbiddenMatches = report.forbiddenMatches.length;

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  if (report.summary.surfacesFailed > 0 || report.summary.forbiddenMatches > 0) {
    console.error(`Google Workspace SSO smoke failed. Report: ${reportPath}`);
    console.error(JSON.stringify(report.summary, null, 2));
    process.exit(1);
  }

  console.log(`Google Workspace SSO smoke passed. Report: ${reportPath}`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error) => {
  console.error('Google Workspace SSO smoke crashed:', error);
  process.exit(1);
});
