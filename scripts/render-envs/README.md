# Render env-vars backup + restore

Bygd etter at jeg bulk-PUT-wipet 220 env-vars 2026-06-24 og måtte SSH-e inn i
live-containeren for å hente dem fra RAM. Ingen flere slike redninger.

## Hvordan det fungerer

**`backup.py`** kjøres daglig kl. 03:00 UTC via GH Action
(`.github/workflows/render-envs-backup.yml`).

1. Henter alle env-vars fra Render API (paginert).
2. Krypterer med **AES-256-GCM** (key = `RENDER_ENV_BACKUP_KEY`).
3. Laster opp til **B2** (`creatorhubn-archive-prod/render-envs/`)
   + lagrer som **GH-artifact** (90 dagers retensjon) som dobbel sikkerhet.
4. Rullerer lokale backups — beholder de 30 nyeste.

**Decoupled-key-design:** `RENDER_ENV_BACKUP_KEY` er **ikke** en env-var
på selve Render-tjenesten. Bare i GH Actions secrets + 1Password. Slik kan
en wipe ikke låse oss ute av restore.

## Engangs-setup (gjort 2026-06-24)

```bash
# 1. Generer en 32-byte krypteringsnøkkel
openssl rand -hex 32
# → eksempel: 7c3f9a2b...64 hex chars total

# 2. Legg til som GH secret (samme verdi i 1Password som backup)
gh secret set RENDER_ENV_BACKUP_KEY -b "<den-genererte-hex-strengen>"

# 3. Verifiser at disse 5 secrets også finnes i repoet:
gh secret list | grep -E "RENDER_API_KEY|B2_APPLICATION_KEY_ID|B2_APPLICATION_KEY|B2_BUCKET_NAME|RENDER_ENV_BACKUP_KEY"

# 4. Test workflow manuelt
gh workflow run render-envs-backup.yml
```

## Lokal kjøring

```bash
export RENDER_API_KEY=$(gh secret list | …)  # eller direkte
export RENDER_SERVICE_ID=srv-d76ob60ule4c73dv2p60
export RENDER_ENV_BACKUP_KEY=<hex>
# Valgfritt for B2-opplasting:
export B2_APPLICATION_KEY_ID=… B2_APPLICATION_KEY=… B2_BUCKET_NAME=creatorhubn-archive-prod

pip install cryptography
python3 scripts/render-envs/backup.py
# → .backups/render-envs/srv-d76ob60ule4c73dv2p60-YYYY-MM-DD_HHMMSS.json.enc
```

## Restore (recovery)

```bash
# Liste lokale backups
ls -lt .backups/render-envs/

# Tørrkjør (decrypt + vis keys, ingen endring)
python3 scripts/render-envs/restore.py .backups/render-envs/srv-...enc --dry-run

# Faktisk restore (per-key PUT, throttlet)
python3 scripts/render-envs/restore.py .backups/render-envs/srv-...enc

# Eller hent siste backup fra en gitt dato fra B2
python3 scripts/render-envs/restore.py --from-b2 2026-06-24
```

Restore-scriptet **bruker per-key PUT** (`PUT /v1/services/{id}/env-vars/{key}`),
**aldri** collection-PUT — det ville reprodusert wipe-katastrofen.

Etter restore:
```bash
# Trigger Render-redeploy så ny prosess plukker opp full env
curl -X POST -H "Authorization: Bearer $RENDER_API_KEY" \
  https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys \
  -d '{"clearCache":"do_not_clear"}'
```

## Hva som er backupet

Alle env-vars som Render API rapporterer for tjenesten — verdiene
inkludert. Klartekst dump er aldri på disk; kun den AES-GCM-krypterte
JSON-en lagres lokalt + i B2 + som GH-artifact.

## Hvis du mister `RENDER_ENV_BACKUP_KEY`

Backups blir uleselige. Derfor:
- 1Password-vault (Creatorhub-secrets)
- GH Actions secret
- Skrevet ned offline i fysisk safe

Ingen ytterligere kopier. Hvis alle tre blir borte er du tilbake på SSH-inn-i-live-container-metoden (se `feedback_render_env_put_collection_replace.md`).
