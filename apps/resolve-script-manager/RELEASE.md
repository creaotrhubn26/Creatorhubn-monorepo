# Releasing The Role Room Post Agent

Quick reference. For full context see
[`project_post_agent_updater_keys.md`](../../memory/...) (memory).

## What gets shipped

A release publishes three files **per architecture** (aarch64 + x86_64) to
GitHub Releases:

| File | Purpose |
|------|---------|
| `post-agent-darwin-<arch>.app.tar.gz` | The .app bundle for the auto-updater to download |
| `post-agent-darwin-<arch>.app.tar.gz.sig` | Detached minisign signature |
| `post-agent-darwin-<arch>.json` | Updater manifest the running app polls |
| `post-agent-darwin-<arch>.dmg` _(if present)_ | Installer for first-time users |

The running app calls
`https://github.com/<owner>/<repo>/releases/latest/download/post-agent-darwin-aarch64.json`
on demand (when the user clicks **File → Check for updates…**) and any
time the configured `installMode` triggers.

## One-time setup

### 1. GitHub Secrets

The CI workflow at `.github/workflows/release-post-agent.yml` requires:

| Secret | Required | What it's for |
|--------|----------|---------------|
| `TAURI_SIGNING_PRIVATE_KEY` | **YES** | Full contents of `~/.tauri/post-agent` (private key). The CI signs `.app.tar.gz` with it. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Only if key is password-protected | Empty string OK during dev. |
| `APPLE_CERTIFICATE` | Optional, but **strongly recommended** before public release | Base64-encoded Apple Developer ID `.p12`. Without it Gatekeeper warns first-time users. |
| `APPLE_CERTIFICATE_PASSWORD` | If APPLE_CERTIFICATE is set | Password for the .p12 |
| `APPLE_SIGNING_IDENTITY` | If signing | e.g. `Developer ID Application: Creatorhubn AS (TEAMID)` |
| `APPLE_ID` | If notarizing | Apple ID email |
| `APPLE_PASSWORD` | If notarizing | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | If notarizing | 10-char team ID |

To add a secret:

```bash
# Get the private key contents
cat ~/.tauri/post-agent

# Then in repo Settings → Secrets and variables → Actions → New repository secret
# Name: TAURI_SIGNING_PRIVATE_KEY
# Value: (paste contents)
```

### 2. (Recommended) Rotate to password-protected key before public release

The current key was generated passordless for local-dev convenience. Before
shipping to real users:

```bash
# Generate a strong password and store it in 1Password / Vault first.
PW="<paste strong password here>"

# Generate new keypair with password
npx tauri signer generate \
  --password "$PW" \
  --write-keys ~/.tauri/post-agent \
  --force

# Update the pubkey in tauri.conf.json (it's printed by the command above).
# Commit the new pubkey:
git add apps/resolve-script-manager/src-tauri/tauri.conf.json
git commit -m "chore: rotate updater signing key"

# Update the GitHub secret TAURI_SIGNING_PRIVATE_KEY (paste new ~/.tauri/post-agent)
# Update the GitHub secret TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $PW
```

WARNING: Once you ship a version signed with the new key, you cannot publish
updates signed with the old key — the installed app verifies signatures
against the embedded pubkey. Don't rotate after shipping.

## Cutting a release

1. Bump the version in `apps/resolve-script-manager/src-tauri/tauri.conf.json`
   AND `apps/resolve-script-manager/src-tauri/Cargo.toml` (both must match
   or Tauri's manifest validation fails).

   ```bash
   # Both files have "version": "0.1.0" — bump in the same commit.
   ```

2. Commit + tag:

   ```bash
   git commit -m "chore: bump post-agent to v0.1.1"
   git tag post-agent-v0.1.1
   git push origin main --tags
   ```

3. The workflow auto-runs. Watch it: `gh run watch` or in GitHub Actions UI.

4. When the workflow finishes, a Release is created at
   `https://github.com/<owner>/<repo>/releases/tag/post-agent-v0.1.1`.

5. Verify:

   ```bash
   # Updater should detect the new version
   open "/Applications/The Role Room Post Agent.app"
   # File → Check for updates…
   ```

## Local-only signed build (no GitHub release)

If you want to test signing without pushing to CI:

```bash
export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/post-agent"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

cd apps/resolve-script-manager
npm run tauri build

# Output appears in src-tauri/target/release/bundle/
# Look for *.app.tar.gz.sig — the presence proves signing succeeded.
```

## Manual updater test

Pretend an older version exists by editing the version in `tauri.conf.json`
down (e.g. `0.0.9`), build + install, then bump back to `0.1.0`, build,
upload to a test Release. The installed `0.0.9` should detect `0.1.0` via
**File → Check for updates…**.

## Troubleshooting

- **"A public key has been found, but no private key"** — `TAURI_SIGNING_PRIVATE_KEY` not set in the build environment. Either pass via env var or use `TAURI_SIGNING_PRIVATE_KEY_PATH`.
- **"Update server returned 404"** — Release exists but the per-arch `.json` manifest filename doesn't match the URL template in `tauri.conf.json`. Check capitalization + arch slug.
- **"Signature verification failed"** — Pubkey in `tauri.conf.json` doesn't match the key that signed the `.app.tar.gz`. Re-deploy with consistent keys.
- **Updater silently does nothing** — App must be built in release mode (`tauri build`, not `tauri dev`) for the updater to activate.
