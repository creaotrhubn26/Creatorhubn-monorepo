/**
 * Runnable answer-quality eval for the Role Room Agent.
 *
 * Run:
 *   # offline smoke test — uses baked-in stub answers + canned scores, no API key
 *   node --experimental-strip-types backend/scripts/role-room-agent-eval/run-eval.ts --dry-run
 *
 *   # live — generates answers via runClaudeAgent and scores them with the LLM judge
 *   ANTHROPIC_API_KEY=sk-... ROLE_ROOM_AGENT_CLAUDE_ENABLED=true \
 *     node --experimental-strip-types backend/scripts/role-room-agent-eval/run-eval.ts
 *
 * Flags:
 *   --dry-run            Use fixture.stubbedAnswer + canned scores (no network). Proves wiring.
 *   --threshold=<n>      Override the pass threshold on the overall mean (default 3.5).
 *   --only=<id>          Run a single fixture by id.
 *
 * This is a MANUAL / CI-OPTIONAL quality gate — NOT a per-request code path.
 * Exit code is non-zero when the aggregate `overall` mean is below threshold,
 * so it can fail a CI job on a model/prompt regression.
 */

import { EVAL_FIXTURES, type EvalFixture } from './fixtures.ts';
import { judgeAnswer } from './judge.ts';
import {
  aggregateScores,
  formatScorecard,
  DEFAULT_PASS_THRESHOLD,
  type EvalResult,
  type JudgeScores,
} from './scorecard.ts';
import {
  ROLE_ROOM_AGENT_SYSTEM_PROMPT,
  ROLE_ROOM_AGENT_TOOLS,
} from '../../server/role-room-agent-definition.ts';

interface CliOptions {
  dryRun: boolean;
  threshold: number;
  only: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false, threshold: DEFAULT_PASS_THRESHOLD, only: null };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--threshold=')) {
      const n = Number(arg.slice('--threshold='.length));
      if (Number.isFinite(n)) opts.threshold = n;
    } else if (arg.startsWith('--only=')) {
      opts.only = arg.slice('--only='.length);
    }
  }
  return opts;
}

/**
 * Canned scores used in --dry-run so the pipeline is exercisable offline and
 * the scorecard math is provable without any API key. These are NOT a real
 * judgment — they exist only to prove the wiring end-to-end.
 */
const CANNED_DRY_RUN_SCORES: JudgeScores = {
  groundedness: 4,
  noHallucination: 4,
  actionability: 4,
  overall: 4,
  rationale: 'canned dry-run score (no judge invoked)',
};

/** Build the cached system block the live agent would see for a fixture. */
function buildEvalCachedSystem(fixture: EvalFixture): string {
  const c = fixture.context;
  const lines: string[] = [ROLE_ROOM_AGENT_SYSTEM_PROMPT, '', '## Prosjektkontekst'];
  if (c.briefSummary) lines.push('', '### Brief-sammendrag', c.briefSummary);
  if (c.openReviews?.length) {
    lines.push('', '### Aktive reviews');
    for (const r of c.openReviews) lines.push(`- id=${r.id} status=${r.status} — ${r.title}`);
  }
  if (c.timelineHighlights?.length) {
    lines.push('', '### Timeline-høydepunkter');
    for (const t of c.timelineHighlights) {
      const due = t.dueAt ? ` frist=${t.dueAt}` : '';
      lines.push(`- id=${t.id} fase=${t.phase} status=${t.status}${due} — ${t.title}`);
    }
  }
  if (c.candidates?.length) {
    lines.push('', '### Kandidater (pseudonymisert)');
    c.candidates.forEach((cand, i) =>
      lines.push(`- {{candidate_${i + 1}}} rolle=${cand.role ?? 'ukjent'}`),
    );
  }
  if (c.crew?.length) {
    lines.push('', '### Crew (pseudonymisert)');
    c.crew.forEach((cr, i) => lines.push(`- {{crew_${i + 1}}} rolle=${cr.role ?? 'ukjent'}`));
  }
  if (c.economyItems?.length) {
    lines.push('', '### Økonomi');
    for (const e of c.economyItems) {
      const parts = [
        e.estimate != null ? `est=${e.estimate}` : '',
        e.approved != null ? `godkjent=${e.approved}` : '',
        e.actual != null ? `faktisk=${e.actual}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      lines.push(
        `- id=${e.id} fase=${e.phase} status=${e.status} ${parts} ${e.currency ?? ''} — ${e.category} / ${e.itemName}`,
      );
    }
  }
  return lines.join('\n');
}

/** Obtain an answer for a fixture — stubbed in dry-run, live via runClaudeAgent otherwise. */
async function getAnswer(fixture: EvalFixture, opts: CliOptions): Promise<string> {
  if (opts.dryRun) return fixture.stubbedAnswer;

  // Live path — guard behind both the feature flag and an API key so we never
  // attempt a network call we can't make. Import lazily so --dry-run never
  // pulls the agent graph or the optional SDK.
  const { runClaudeAgent, claudeAgentEnabled } = await import('../../server/role-room-agent-claude.ts');
  if (!claudeAgentEnabled() || !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'Live eval requires ROLE_ROOM_AGENT_CLAUDE_ENABLED=true and ANTHROPIC_API_KEY. Use --dry-run for an offline smoke test.',
    );
  }

  const result = await runClaudeAgent({
    cachedSystem: buildEvalCachedSystem(fixture),
    userMessage: fixture.userQuestion,
    tools: ROLE_ROOM_AGENT_TOOLS as Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
    feature: 'role-room-agent/eval',
    maxTokens: 1024,
  });

  // The eval scores the natural-language answer. When the model only emitted a
  // tool_use, summarise it so the judge still has something to grade.
  if (result.text.trim()) return result.text;
  if (result.toolUses.length) {
    return `[verktøyforslag] ${result.toolUses
      .map((t) => `${t.name}(${JSON.stringify(t.input)})`)
      .join('; ')}`;
  }
  return '(tomt svar)';
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const fixtures = opts.only
    ? EVAL_FIXTURES.filter((f) => f.id === opts.only)
    : EVAL_FIXTURES;

  if (!fixtures.length) {
    console.error(`No fixtures matched${opts.only ? ` --only=${opts.only}` : ''}.`);
    process.exit(2);
  }

  console.log(
    `Role Room Agent answer-quality eval — ${fixtures.length} fixture(s), mode=${
      opts.dryRun ? 'dry-run (offline)' : 'live'
    }, threshold=${opts.threshold}\n`,
  );

  const results: EvalResult[] = [];
  for (const fixture of fixtures) {
    process.stdout.write(`• ${fixture.id} … `);
    let scores: JudgeScores | null;
    try {
      const answer = await getAnswer(fixture, opts);
      if (opts.dryRun) {
        // Offline: skip the real judge, use canned scores to prove the wiring.
        scores = CANNED_DRY_RUN_SCORES;
      } else {
        scores = await judgeAnswer({
          question: fixture.userQuestion,
          context: fixture.context,
          answer,
          expectations: fixture.expectations,
        });
      }
    } catch (err) {
      console.log(`error: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ id: fixture.id, scores: null });
      continue;
    }
    console.log(scores ? `overall=${scores.overall}` : 'skipped (no judge)');
    results.push({ id: fixture.id, scores });
  }

  const aggregate = aggregateScores(results, opts.threshold);
  console.log('\n' + formatScorecard(results, aggregate) + '\n');

  if (aggregate.scored === 0) {
    console.error('No fixtures were scored (judge unavailable). Treating as failure.');
    process.exit(3);
  }
  process.exit(aggregate.pass ? 0 : 1);
}

main().catch((err) => {
  console.error('[role-room-agent-eval] fatal', err);
  process.exit(2);
});
