import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

const require = createRequire(import.meta.url);

const requirements = [
  { packageName: 'zod', test: ([major]) => major === 4, expected: 'major version 4' },
  {
    packageName: 'drizzle-orm',
    test: ([major, minor]) => major === 0 && minor >= 45,
    expected: 'version 0.45 or newer',
  },
  {
    packageName: 'drizzle-zod',
    test: ([major, minor]) => major === 0 && minor >= 8,
    expected: 'version 0.8 or newer',
  },
];

const failures = [];

function packageVersion(packageName) {
  let directory = dirname(require.resolve(packageName));
  const root = parse(directory).root;
  while (directory !== root) {
    try {
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
      if (manifest.name === packageName && typeof manifest.version === 'string') {
        return manifest.version;
      }
    } catch {
      // Fortsett oppover til pakkens rotmanifest er funnet.
    }
    directory = dirname(directory);
  }
  throw new Error(`Fant ikke package.json for ${packageName}`);
}

for (const requirement of requirements) {
  let version = '';
  try {
    version = packageVersion(requirement.packageName);
  } catch {
    failures.push(`${requirement.packageName}: ikke installert`);
    continue;
  }

  const parts = version.split('.').map((part) => Number.parseInt(part, 10));
  if (!requirement.test(parts)) {
    failures.push(
      `${requirement.packageName}: fant ${version}, krever ${requirement.expected}`,
    );
  }
}

if (failures.length > 0) {
  console.error('Typecheck-avhengighetene er ute av synk med package-lock.json:');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    'Kjør `npm ci --workspaces=false` i frontend-mappen (som CI), eller `npm ci` fra repository-roten, og prøv igjen.',
  );
  process.exit(1);
}
