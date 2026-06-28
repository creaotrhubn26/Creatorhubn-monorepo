# Role Room Agent — answer-quality eval harness

A small LLM-as-judge harness that measures the **groundedness**,
**no-hallucination**, and **actionability** of the Role Room Agent's answers
across model / system-prompt changes.

This is a **manual / CI-optional quality gate** — it is **not** on any
per-request code path. Run it when you change the agent's model, system prompt
(`server/role-room-agent-definition.ts`), or context-assembly logic, to catch
regressions (e.g. the agent starting to invent budget numbers).

## What's here

| File | Purpose |
| --- | --- |
| `fixtures.ts` | `EVAL_FIXTURES` — 8 realistic producer scenarios (Norwegian questions, `RoleRoomAgentContext`-shaped state, free-text `expectations`, and a baked-in `stubbedAnswer` for offline runs). |
| `judge.ts` | `judgeAnswer(...)` — LLM-as-judge. Loads the Anthropic SDK **lazily** (`import('@anthropic-ai/sdk').catch(() => null)` + `ANTHROPIC_API_KEY`). Returns `null` when the SDK/key is missing — never throws. |
| `scorecard.ts` | Pure, LLM-free helpers: `parseJudgeJson` (tolerant JSON extraction) and `aggregateScores` (means + pass/fail vs threshold). Unit-tested. |
| `run-eval.ts` | The runnable entrypoint. |
| `scorecard.test.ts` | Vitest unit tests for the pure helpers. |

## Scoring

Each answer is judged 0–5 on:

- **groundedness** — is the answer anchored in the actual project context, citing real field names / ids?
- **noHallucination** — does it avoid inventing facts (budget numbers, names, deadlines, approvals)? Inventing numbers or using real names instead of `{{candidate_n}}` is penalised hard.
- **actionability** — does it give a concrete, useful next step?
- **overall** — holistic, weighted toward `noHallucination`.

The aggregate **passes** when the mean `overall` is at/above the threshold
(default **3.5**).

## Running

### Offline smoke test (no API key) — proves the wiring

```bash
node --experimental-strip-types backend/scripts/role-room-agent-eval/run-eval.ts --dry-run
```

In `--dry-run` the harness uses each fixture's baked-in `stubbedAnswer` and
**canned scores** (the real judge is skipped), so the full pipeline —
fixtures → answer → scorecard → aggregate → exit code — is exercisable with no
network and no `ANTHROPIC_API_KEY`.

### Live eval (real answers + real judge)

```bash
ANTHROPIC_API_KEY=sk-... \
ROLE_ROOM_AGENT_CLAUDE_ENABLED=true \
  npx tsx backend/scripts/role-room-agent-eval/run-eval.ts
```

> Live mode must run under **`tsx`** (the repo's dev runtime), not
> `node --experimental-strip-types`: it pulls in `role-room-agent-claude.ts`,
> whose transitive imports use the project's `.js`-extension ESM convention
> that bare node strip-types can't resolve. `--dry-run` stays on plain node
> strip-types because it only imports the dependency-free definition module.

Live mode generates each answer via `runClaudeAgent` (the same client the
production agent uses) and scores it with `judgeAnswer`. The live path is
guarded behind **both** `ROLE_ROOM_AGENT_CLAUDE_ENABLED=true` and
`ANTHROPIC_API_KEY`; without them it errors and tells you to use `--dry-run`.

### Flags

| Flag | Effect |
| --- | --- |
| `--dry-run` | Offline: stub answers + canned scores, no network. |
| `--threshold=<n>` | Override the pass threshold on the `overall` mean (default `3.5`). |
| `--only=<id>` | Run a single fixture by id. |

### Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Required for live answers and live judging. |
| `ROLE_ROOM_AGENT_CLAUDE_ENABLED` | — | Must be `true` for the live answer path (`runClaudeAgent`). |
| `ROLE_ROOM_AGENT_CLAUDE_MODEL` | `claude-sonnet-4-6` | Model used to generate answers (live). |
| `ROLE_ROOM_AGENT_EVAL_JUDGE_MODEL` | `claude-sonnet-4-6` | Model used by the judge. |

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Aggregate `overall` mean ≥ threshold — **PASS**. |
| `1` | Below threshold — **FAIL** (use this to gate CI). |
| `2` | Bad args / fatal error. |
| `3` | Nothing got scored (judge unavailable in a live run). |

## Unit tests

```bash
npx vitest run scripts/role-room-agent-eval/scorecard.test.ts
```

The unit tests cover only the **pure** helpers (`parseJudgeJson`,
`aggregateScores`, `formatScorecard`) — no LLM calls, so they run anywhere.
