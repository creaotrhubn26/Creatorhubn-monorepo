-- =====================================================================
-- 0346_prototype_feedback_nullable_legacy_cols.sql
--
-- BUGFIX: prototype_feedback hadde project_id, client_id og den eldre `feedback`
-- som NOT NULL (uten default), men innsendings-endepunktet
-- (POST /api/prototype-testing/feedback) skriver title + description og IKKE
-- disse tre. Resultat: HVER innsending feilet på not-null — tabellen hadde 0
-- rader. Prototype-testere (f.eks. Orbit) kunne dermed ikke gi tilbakemelding
-- via «Gi tilbakemelding»-verktøyet i det hele tatt.
--
-- Disse er reelt valgfrie i dagens skjema (tittel/beskrivelse er kildene;
-- project/client er kun relevant for kontekst-bunden feedback). Gjør dem nullable.
-- =====================================================================

BEGIN;

ALTER TABLE prototype_feedback ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE prototype_feedback ALTER COLUMN client_id  DROP NOT NULL;
ALTER TABLE prototype_feedback ALTER COLUMN feedback   DROP NOT NULL;

COMMIT;
