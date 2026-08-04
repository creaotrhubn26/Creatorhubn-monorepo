# CLAUDE.md — agent working agreement

Guidance for automated/agentic contributors (Claude Code and similar) working in this monorepo. These are behavioral rules for the agent, not build config.

## Commits, pushes & deploys — minimize CI/deploy churn

Every push to a branch with an open PR triggers CI **and** a Vercel preview build; every merge to `main` auto-deploys **all** main-tracking Render services. Multiple pushes per branch mean multiple wasted builds. Keep the churn low:

- **Batch commits before pushing.** Commit locally as you work, but **push once per feature — when the work is complete and ready for a PR** — not after every micro-change. Squash/amend WIP commits instead of pushing each one.
- **Verify locally before pushing.** Build / test / typecheck locally first; don't push to trigger CI as a substitute for local verification.
- **Open the PR only when it's ready for review.** Draft/WIP branches should not accumulate preview builds.
- **Treat merge-to-`main` as the deploy event**, not each commit. A merge redeploys every main-tracking service, so batch related changes into one landing.
- **Live-verification deploys** (temporarily repoint a Render service → deploy → test → revert) are legitimate when a human asks to verify something live — but still batch the branch pushes that precede them.

## Vercel preview builds

The Vercel project builds from `frontend/`. `frontend/vercel.json` carries an **Ignored Build Step** (`ignoreCommand`) that **skips the preview when a commit doesn't touch `frontend/`** — so backend-only, iOS (`ipad/`), runner, or docs branches don't build the frontend. `main` always builds.

If you introduce disposable branch prefixes (e.g. `wip/*`, `draft/*`), prefer *not pushing noisy previews at all* over adding branch-name exclusions — the behavioral rules above are the higher-leverage fix. A path filter beats branch-name patterns here because our branches are `feat/*`, `fix/*`, etc., not `wip/*`.
