# P1-evidens: migrasjon 0605 mot produksjonsdatabasen

Kjørt 14. september 2026. Alle spørringer er read-only katalogspørringer (`pg_class`, `pg_constraint`, `pg_indexes`, `pg_trigger`, `pg_proc`, `information_schema.columns`). Ingen skriving, ingen DDL, ingen migrering ble kjørt.

## Hvilken database er produksjon

To Neon-prosjekter inneholder CreatorHub-skjema:

| Neon-prosjekt | ID | Region | PG | Status |
|---|---|---|---|---|
| Creatorhub EU | `restless-wind-41713954` | aws-eu-central-1 | 18 | **Produksjon** |
| creatorhubn.com | `wispy-bar-06530976` | aws-eu-west-2 | 17 | Legacy, ikke i bruk av dagens backend |

Identifisering: `render.yaml` binder backend til rollene `creatorhub_runtime_login` og `creatorhub_schema_owner`. Kun `restless-wind-41713954` har disse rollene; `wispy-bar-06530976` har bare `neondb_owner`.

Konsekvens: `wispy-bar-06530976` mangler hele migrasjon 0605 (37 av 43 objekter fraværende: alle constraints, indekser, triggere, funksjoner og nye kolonner; kun de eldre tabellene finnes). Det er uproblematisk så lenge ingen tjeneste peker dit, men en feilkonfigurert `DATABASE_URL` mot den basen ville gi stille tap av review-modellen. Ikke gjenbruk den basen uten å kjøre migrasjonene først.

## Migrasjonsregisteret

`_migrations_applied` i produksjon:

| Fil | Applied |
|---|---|
| `0605_project_photo_room_unification.sql` | 2026-09-14 13:30:57Z |
| `0606_troll_demo_verified_location_addresses.sql` | 2026-09-14 14:35:36Z |

Registeret alene er ikke bevis — `migrate.sh` har historisk markert filer som applied selv når SQL feilet. Katalogkontrollen under er beviset; registeret bekrefter bare når kjøringen skjedde.

## Resultat i produksjon

**43 av 43 forventede objekter finnes. 0 mangler. Ingen skjemadrift mot `backend/migrations/0605_project_photo_room_unification.sql`.**

Verifisert:

- Tabeller: `project_media_folders`, `project_photo_review`, `project_photo_comments`, `project_ai_consent`, `generative_ai_jobs`.
- Kolonner: `capture_assets.folder_id`, `client_image_selections.proofing_round`, `project_board_tasks.source_kind`/`source_id`, `project_photo_comments.author_user_id`/`updated_at`/`deleted_at`, `generative_ai_jobs.output_storage_provider`/`output_storage_key`.
- Fremmednøkler: `capture_assets_folder_fk`, `photographer_client_galleries_project_fk`, `project_photo_review_project_fk`, `project_photo_review_asset_fk`, `project_photo_comments_project_fk`, `project_photo_comments_asset_fk`, `project_photo_comments_parent_fk`.
- Check constraints: `project_photo_review_status_check` (`approved|needs_edit|rejected|flagged`), `project_photo_comments_scope_check`, `_author_kind_check`, `_status_check`, `_asset_required_check`, `_length_check` (1–4000), `generative_ai_jobs_output_storage_provider_check` (`creatorhub_s3|legacy_role_room_b2|temporary`).
- Indekser: alle 11, inkludert partial/expression-indeksene `client_gallery_images_capture_asset_idx`, `project_board_tasks_photo_source_unique`, `generative_ai_jobs_project_photo_history_idx` og den bevarte `generative_ai_jobs_legacy_billing_due_idx`.
- Triggere: `project_photo_review_sync_capture` (AFTER INSERT OR UPDATE OF review_status ON project_photo_review) og `capture_asset_sync_project_photo_review` (AFTER UPDATE OF rejected, flagged_for_client ON capture_assets). Begge `tgenabled = 'O'` (aktive).
- Funksjoner: `sync_capture_asset_photo_review_status` og `sync_project_photo_review_from_capture_status`. Kroppene i produksjon inneholder rekursjonsvernet `pg_trigger_depth() > 1`, `ON CONFLICT(asset_id) DO UPDATE` og speiling av `flagged_for_client` — identisk med migrasjonsfilen.

### NOT VALID er forventet, ikke et avvik

Disse står som `NOT VALID` i produksjon:

- `capture_assets_folder_fk`
- `photographer_client_galleries_project_fk`
- `project_photo_review_project_fk`, `project_photo_review_asset_fk`
- `project_photo_comments_project_fk`, `_asset_fk`, `_parent_fk`
- `project_photo_comments_asset_required_check`

Migrasjonsfilen deklarerer dem eksplisitt som `NOT VALID`. Produksjon matcher kilden. Praktisk betydning: nye og endrede rader håndheves normalt, men eksisterende rader ble aldri etterkontrollert. `VALIDATE CONSTRAINT` kan kjøres senere uten skrivelås på tabellen, men er ikke nødvendig før det finnes data.

## Datavolum i produksjon

| Tabell | Rader |
|---|---|
| `capture_sessions` | 0 |
| `capture_assets` | 0 |
| `project_photo_review` | 0 |
| `project_photo_comments` | 0 |
| `photographer_client_galleries` | 0 |
| `client_gallery_images` | 0 |
| `generative_ai_jobs` | 0 |
| `project_media_folders` | 0 |

Dette er et selvstendig funn: **Capture-kjeden har aldri produsert data i produksjon.** Skjemaet er klart, men hele Capture -> CreatorHub S3 -> Photo Room -> klientgalleri-flyten er ubevist mot ekte data. Det bekrefter at P0 fortsatt er blokkeringen, og at det ikke finnes legacy Photo Room-rader i produksjon som en objektmigrering må ta hensyn til.

## Hva som ikke kan bevises herfra

- Trigger-*oppførsel* (godkjenn -> avvis -> godkjenn gir konsistente legacy-flagg) krever skriving. Det er dekket av backendtestene mot testdatabase, ikke mot produksjon, og skal verifiseres i P2-E2E med ekte data.
- Google-innlogging, S3-opplasting, objektkeys og resume krever distribuert build og ekte konto.
- Legacy R2-inventar ligger utenfor databasen og krever kjøring av `backend/scripts/migrate-capture-r2-to-creatorhub-s3.ts` uten `--execute`.

## Reproduksjon

Neon-prosjekt `restless-wind-41713954`, database `neondb`, default branch. Eksempel:

```sql
SELECT conrelid::regclass::text AS tbl, conname, convalidated, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conname LIKE 'project_photo_%';

SELECT t.tgname, pg_get_triggerdef(t.oid), t.tgenabled
  FROM pg_trigger t
 WHERE t.tgname IN ('project_photo_review_sync_capture','capture_asset_sync_project_photo_review');
```

Full eksistenssjekk for alle 43 objekter: se spørringen i `/tmp/claude-501/verify0605.sql` eller gjenskap listen fra migrasjonsfilen.
