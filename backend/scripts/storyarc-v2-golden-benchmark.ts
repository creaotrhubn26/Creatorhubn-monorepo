import fs from 'fs';
import path from 'path';

interface GoldenCaseInput {
  caseId?: string;
  analysisId: string;
  targetDuration?: number;
  variant?: 'safe' | 'balanced' | 'bold';
  minOverallScore?: number;
  minBeatCoverage?: number;
}

interface GoldenManifest {
  datasetName?: string;
  cases: GoldenCaseInput[];
}

function getArg(name: string, fallback?: string): string | undefined {
  const key = `--${name}`;
  const idx = process.argv.indexOf(key);
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function toBool(value: string | undefined, fallback = false): boolean {
  if (typeof value !== 'string') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function toAbsolute(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

async function main() {
  const manifestArg = getArg('manifest', 'scripts/storyarc-v2-golden.manifest.example.json');
  if (!manifestArg) {
    throw new Error('Missing --manifest');
  }

  const baseUrl = getArg('base-url', process.env.STORYARC_BASE_URL || 'http://127.0.0.1:3001')!;
  const failOnRegression = toBool(getArg('fail-on-regression', 'true'), true);
  const nightly = toBool(getArg('nightly', 'false'), false);
  const outputArg = getArg('output');

  const manifestPath = toAbsolute(manifestArg);
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw) as GoldenManifest;

  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    throw new Error('Manifest must include at least one case');
  }

  const response = await fetch(`${baseUrl}/api/story-arc/v2/benchmark/golden/run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      datasetName: manifest.datasetName || 'storyarc-v2-golden',
      cases: manifest.cases,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `Benchmark run failed with status ${response.status}`);
  }

  const run = payload.run;
  const defaultOutput = nightly
    ? path.resolve(process.cwd(), 'tmp', 'storyarc-v2-golden-nightly-latest.json')
    : path.resolve(
        process.cwd(),
        'tmp',
        `storyarc-v2-golden-${Date.now()}.json`
      );
  const outputPath = outputArg ? toAbsolute(outputArg) : defaultOutput;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl,
        manifestPath,
        run,
      },
      null,
      2
    )
  );

  console.log(`Story Arc V2 golden benchmark complete`);
  console.log(`Dataset: ${run.datasetName}`);
  console.log(`Total: ${run.totalCases}, Passed: ${run.passedCases}, Failed: ${run.failedCases}`);
  console.log(`Average overall score: ${run.averageOverallScore}`);
  console.log(`Report: ${outputPath}`);

  if (failOnRegression && Number(run.failedCases || 0) > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('storyarc-v2-golden-benchmark error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
