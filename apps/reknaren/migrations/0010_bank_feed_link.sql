-- 0010_bank_feed_link.sql
--
-- Kobling mellom en Reknaren-bankkonto og en PSD2-aggregatorkonto (GoCardless
-- Bank Account Data). Samtykkeflyten gir en «requisition» (end-user agreement)
-- som etter bank-innlogging peker på én eller flere konto-ID-er. Vi lagrer
-- requisition-ID-en (for å hente kontoene etterpå) og den valgte konto-ID-en
-- (`feed_connection_id`) som feed/sync bruker for å hente transaksjoner.

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS feed_requisition_id TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS feed_connection_id TEXT;
