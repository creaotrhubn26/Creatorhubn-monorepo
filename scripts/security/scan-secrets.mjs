#!/usr/bin/env node

import { lstatSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const PLACEHOLDER_VALUES = new Set([
  'example',
  'placeholder',
  'changeme',
  'replace-me',
  'replace_me',
  'dummy',
  'password',
  'postgres',
  'secret',
  'test',
  'testpass',
]);

const PLACEHOLDER_MARKERS = ['<', '${', '{{', '***'];

function isPlaceholder(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized
    || PLACEHOLDER_VALUES.has(normalized)
    || PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

function isLocalOrExampleHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase();
  return host === 'localhost'
    || host === 'host'
    || host === 'z'
    || host === '127.0.0.1'
    || host === '::1'
    || host.endsWith('.localhost')
    || host.endsWith('.example')
    || host.endsWith('.example.com')
    || host.endsWith('.invalid');
}

const RULES = [
  {
    id: 'postgres-url-with-password',
    regex: /\bpostgres(?:ql)?:\/\/([^:\s/'"]+):([^@\s/'"]+)@([^/\s'"]+)/gi,
    shouldReport(match) {
      const [, username, password, authority] = match;
      const hostname = authority.startsWith('[')
        ? authority.slice(1, authority.indexOf(']'))
        : authority.split(':')[0];
      return !isPlaceholder(username)
        && !isPlaceholder(password)
        && !isLocalOrExampleHost(hostname);
    },
  },
  {
    id: 'literal-pgpassword',
    regex: /\bPGPASSWORD\s*=\s*(?:'([^'\r\n]+)'|"([^"\r\n]+)"|([^\s\\]+))/g,
    shouldReport(match) {
      const value = match[1] ?? match[2] ?? match[3] ?? '';
      return !value.startsWith('$') && !isPlaceholder(value);
    },
  },
  {
    id: 'private-key',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    id: 'aws-access-key',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: 'google-api-key',
    regex: /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  },
  {
    id: 'github-token',
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/g,
  },
  {
    id: 'stripe-live-secret',
    regex: /\bsk_live_[A-Za-z0-9]{20,}\b/g,
  },
  {
    id: 'openai-api-key',
    regex: /(?<![A-Za-z0-9])sk-(?:proj-)?[A-Za-z0-9_-]{30,}\b/g,
  },
  {
    id: 'slack-token',
    regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
];

function scanLine(line) {
  const findings = [];
  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    for (const match of line.matchAll(rule.regex)) {
      if (!rule.shouldReport || rule.shouldReport(match)) {
        findings.push(rule.id);
      }
    }
  }
  return [...new Set(findings)];
}

function scanText(text, path, findings, lineOffset = 0) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    for (const rule of scanLine(lines[index])) {
      findings.push({ path, line: lineOffset + index + 1, rule });
    }
  }
}

function git(args) {
  const result = spawnSync('git', args, {
    encoding: args.includes('-z') ? 'buffer' : 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const message = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8')
      : String(result.stderr || '');
    throw new Error(`git ${args.join(' ')} failed: ${message.trim()}`);
  }
  return result.stdout;
}

function trackedFiles() {
  const output = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
  return output.toString('utf8').split('\0').filter(Boolean);
}

function scanWorkingTree() {
  const findings = [];
  for (const path of trackedFiles()) {
    let contents;
    try {
      if (!lstatSync(path).isFile()) continue;
      const buffer = readFileSync(path);
      if (buffer.length > MAX_FILE_BYTES || buffer.includes(0)) continue;
      contents = buffer.toString('utf8');
    } catch {
      continue;
    }
    scanText(contents, path, findings);
  }
  return findings;
}

function scanDiffText(diff) {
  const findings = [];
  let path = '<unknown>';
  let newLine = 0;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      path = line.slice(6);
      continue;
    }
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/);
      newLine = match ? Number(match[1]) : 0;
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      for (const rule of scanLine(line.slice(1))) {
        findings.push({ path, line: newLine, rule });
      }
      newLine += 1;
      continue;
    }
    if (!line.startsWith('-') && !line.startsWith('diff ') && !line.startsWith('index ')) {
      newLine += 1;
    }
  }
  return findings;
}

function scanGitRange(range) {
  const diff = git(['diff', '--no-ext-diff', '--unified=0', '--text', range, '--']);
  return scanDiffText(String(diff));
}

function runSelfTest() {
  const dangerousDatabaseUrl = [
    'postgresql://',
    'service_user',
    ':',
    'high-entropy-password',
    '@',
    'db.internal.test',
    '/app',
  ].join('');
  const githubToken = ['gh', 'p_', 'A'.repeat(36)].join('');
  const literalPgPassword = ['PG', 'PASSWORD=', 'not-a-real-but-literal-value'].join('');
  const privateKeyHeader = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const cases = [
    { value: dangerousDatabaseUrl, expected: 'postgres-url-with-password' },
    { value: 'postgresql://postgres:postgres@localhost:5432/test', expected: null },
    { value: githubToken, expected: 'github-token' },
    { value: literalPgPassword, expected: 'literal-pgpassword' },
    { value: privateKeyHeader, expected: 'private-key' },
    { value: 'PGPASSWORD=$PGPASSWORD', expected: null },
    { value: 'https://example.test/sandisk-professional-drive', expected: null },
    { value: 'DATABASE_URL=${{ secrets.DATABASE_URL }}', expected: null },
  ];

  for (const testCase of cases) {
    const actual = scanLine(testCase.value);
    if (testCase.expected && !actual.includes(testCase.expected)) {
      throw new Error(`Self-test failed: expected ${testCase.expected}`);
    }
    if (!testCase.expected && actual.length > 0) {
      throw new Error(`Self-test failed: unexpected ${actual.join(', ')}`);
    }
  }

  const diffFindings = scanDiffText([
    'diff --git a/example.txt b/example.txt',
    '+++ b/example.txt',
    '@@ -0,0 +1 @@',
    `+${dangerousDatabaseUrl}`,
  ].join('\n'));
  if (!diffFindings.some((finding) => finding.path === 'example.txt'
      && finding.line === 1
      && finding.rule === 'postgres-url-with-password')) {
    throw new Error('Self-test failed: Git diff additions were not scanned');
  }
  console.log('Secret scanner self-test passed.');
}

function report(findings, scope) {
  const unique = new Map();
  for (const finding of findings) {
    unique.set(`${finding.path}:${finding.line}:${finding.rule}`, finding);
  }
  const sorted = [...unique.values()].sort((a, b) =>
    a.path.localeCompare(b.path) || a.line - b.line || a.rule.localeCompare(b.rule));

  if (sorted.length === 0) {
    console.log(`Secret scan passed (${scope}).`);
    return;
  }

  console.error(`Secret scan failed: ${sorted.length} high-confidence finding(s) in ${scope}.`);
  for (const finding of sorted) {
    console.error(`- ${finding.path}:${finding.line} [${finding.rule}] (value redacted)`);
  }
  process.exitCode = 1;
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  runSelfTest();
} else {
  const rangeIndex = args.indexOf('--git-range');
  if (rangeIndex >= 0) {
    const range = args[rangeIndex + 1];
    if (!range) throw new Error('--git-range requires a Git range');
    report(scanGitRange(range), `Git range ${range}`);
  } else {
    report(scanWorkingTree(), 'tracked working tree');
  }
}
