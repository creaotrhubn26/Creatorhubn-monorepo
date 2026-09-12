-- 0442_marketing_segment_refresh.sql
--
-- Fase 3 av «målrettet markedsføring»-broen (auto-refresh): lagre HVOR (konto)
-- og HVEM (OAuth-bruker) en audience ble materialisert med, så den ukentlige
-- cronen kan re-uploade medlemmer til den EKSISTERENDE audiencen (ingen nye
-- audiences opprettes).
--
-- account_ref = customerId (Google) | adAccountId act_XXX (Meta) |
--               adAccountUrn urn:li:sponsoredAccount:X (LinkedIn).
--
-- NB: servicen self-healer disse kolonnene lazily (ensureTables) — denne fila
-- er den kanoniske skjemadefinisjonen.

ALTER TABLE marketing_segment_audiences ADD COLUMN IF NOT EXISTS account_ref TEXT;
ALTER TABLE marketing_segment_audiences ADD COLUMN IF NOT EXISTS producer_user_id UUID;
