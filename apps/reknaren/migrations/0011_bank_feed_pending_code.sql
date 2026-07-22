-- 0011_bank_feed_pending_code.sql
--
-- Etter bank-samtykket sender banken brukeren tilbake til /bank/callback med en
-- kortlevd `code`. Den redirecten er UAUTENTISERT (frisk nettlesernavigasjon uten
-- Bearer-token), så vi kan ikke fullføre koblingen der. I stedet mellomlagrer vi
-- code-en på bankkontoen; deretter fullfører den innloggede brukeren koblingen fra
-- Reknaren (POST …/feed/link) uten å måtte kopiere code-en manuelt. Nullstilles
-- straks koblingen er fullført.

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS feed_pending_code TEXT;
