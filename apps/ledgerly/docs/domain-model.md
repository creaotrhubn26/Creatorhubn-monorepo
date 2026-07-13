# Domenemodell

Kilde: `migrations/0001_foundation.sql`. Alle beløp er BIGINT i valutaens minste enhet
(øre). Alle økonomiske tabeller har `organization_id` (tenant-tilhørighet) — spørringer
filtrerer alltid på den.

## Tabeller

### organizations
Virksomheten. `org_number` (unik, NULL før registrering), `org_form`
(ENK/AS/ANS/DA/SA/NUF), `vat_status` (registered/not_registered/pending),
`vat_registered_from`. Revisjonsfelter: `created_by`, `created_at`, `updated_at`,
`version`, `status` (active/suspended/closed).

### users
Global bruker: `email` (unik), `display_name`, `status`. Ingen passord i MVP —
se `src/api/auth.ts`.

### memberships
Kobler bruker til organisasjon med én `role` (10 roller, samme liste som
`src/access/permissions.ts`). Unik per (organization_id, user_id).
`status` active/revoked gir tilbakekallbar tilgang.

### accounting_periods
Én rad per (organisasjon, år, måned). `status` open/locked med `locked_by`,
`locked_at`, `lock_reason`. Bokføring i låst periode avvises (`src/ledger/engine.ts`).

### ledger_accounts
Organisasjonens kontoplan (firesifret NS 4102-basert nummer, unik per organisasjon),
`account_type` (asset/liability/equity/revenue/expense), `active`. Seedes fra
`src/coa/accounts.ts` ved organisasjonsopprettelse.

### vendors / customers
Reskontro-motparter. `vendors` har `default_account_number`/`default_vat_code` som
forslagsmotoren bruker som leverandørhistorikk. Begge har revisjonsfelter og status.

### source_documents
Bilagsdokumenter. `source` (gmail/upload/mobile/forward/integration),
`gmail_message_id`/`gmail_attachment_id` (unik indeks per organisasjon → idempotent
Gmail-import), `sha256` (innholdsintegritet/duplikat), `storage_key` (lokal nøkkel i
MVP — innholdet lagres ikke), `status` (received/scanning/extracted/needs_review/
approved/posted/rejected/duplicate/quarantined), `duplicate_of` (selvreferanse).

### extracted_document_data
Strukturert uttrekk, én rad per (document_id, extraction_version): leverandør,
org.nummer, fakturanr, datoer, KID, valuta, `net_minor`/`vat_minor`/`gross_minor`,
`vat_breakdown` og `line_items` (JSONB), `extraction_engine`, `validation_status`
(pending/valid/discrepancy) og `validation_issues`.

### journal_entries (append-only)
Bokførte bilag: `entry_number` (løpende per organisasjon, unik), `entry_date`,
`period_id` → accounting_periods, `source_document_id` (kontrollspor til bilaget),
`idempotency_key` (unik per organisasjon), `status` posted/reversed, `reversal_of`
(peker på originalen), `posted_by`/`posted_by_role`/`posted_at`.

### journal_lines (append-only)
Posteringslinjer: `account_number`, `vat_code`, `debit_minor`/`credit_minor` med
CHECK-constraints (aldri begge > 0, aldri begge 0, aldri negative). Valutafelter:
`original_currency`, `original_amount_minor`, `exchange_rate` (desimalstreng),
`exchange_rate_source`. Dimensjoner: `vendor_id`, `customer_id`, `project`, `department`.

### bank_accounts / bank_transactions / reconciliation_matches
Skjema for bank og avstemming (idempotent import via `(bank_account_id, external_id)`,
match-typer exact/rule/manual/ai_suggested med `explanation`). **Kun skjema** — ingen
bankintegrasjon er implementert.

### posting_suggestions
System-/AI-forslag per dokument: `suggestion` (JSONB, zod-validert i appen), `engine`,
`status` (proposed/approved/rejected/superseded), `decided_by`/`decided_at`.

### audit_events (append-only)
Revisjonslogg: aktør (bruker + rolle, NULL = system), `action`, `entity_type`/`entity_id`,
`reason`, `previous_value`/`new_value` (JSONB), `occurred_at`. Skrives i samme
transaksjon som endringen (`src/audit/audit.ts`).

### integration_connections
Integrasjonstilkoblinger (gmail/bank): `scopes`, `encrypted_credentials` (kryptert blob;
NULL i sandbox), `filter_config` (brukerens valgte etiketter m.m.), `status`
(active/revoked/expired/disconnected).

### organization_counters
Bilagsnummer-sekvens per organisasjon (radlås gir hullfri nummerering ved samtidighet).

## Uforanderlighet i databasen

Triggere nekter UPDATE/DELETE på `journal_entries` (kun statusovergang
posted→reversed tillates), `journal_lines` og `audit_events`. Se
`docs/accounting-engine.md`.
