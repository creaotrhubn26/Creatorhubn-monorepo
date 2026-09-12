-- =====================================================================
-- mig 0356 — Pondus per-akse analyse
--
-- Bygger på mig 0355. Legger til én kolonne på `pondus_templates`:
--
--   analysis JSONB DEFAULT '{"authority":0,"clarity":0,"trust":0,"safety":0,"momentum":0}'::jsonb
--
-- Bruk:
--   • Watch-lynkort viser 5 «pondus-akser»:
--       autoritet / klarhet / troverdighet / trygghet / fremdrift
--     Frem til 0356 approksimerte iPhone-siden med overall `score` for
--     alle 5 akser. Nå har vi ekte per-akse-tall (0-100).
--   • iPad Pondus-editor kan justere per-akse-scoring direkte.
--   • Vision Pro spatial pondus-ring renderer 5 sektorer basert på akse-verdier.
--
-- Backfill:
--   For eksisterende rader (typisk seed 1-5 fra 0355) setter vi hver
--   akse-verdi = overall score. Det gir konsistent fallback uten å
--   introdusere data-drift; SuperAdmin kan justere per-akse senere.
--
-- Idempotent:
--   ADD COLUMN IF NOT EXISTS + UPDATE ... WHERE analysis IS NULL OR analysis = '{}'::jsonb
-- =====================================================================

BEGIN;

-- Nøkler bruker engelske kortnavn for å matche framtidig API-navnestandard;
-- iPad-siden kartlegger til norsk UI-tekst (autoritet/klarhet/troverdighet/
-- trygghet/fremdrift).
ALTER TABLE pondus_templates
  ADD COLUMN IF NOT EXISTS analysis JSONB
    NOT NULL
    DEFAULT '{"authority":0,"clarity":0,"trust":0,"safety":0,"momentum":0}'::jsonb;

-- Backfill: der analysis fortsatt er default (alle 0) — eller ble satt i en
-- tidligere iterasjon der DEFAULT ikke traff — mapper vi overall `score` som
-- fallback for hver akse. Det holder Watch/iPad/Vision-UI konsistent selv
-- før noen SuperAdmin har justert per-akse-tall.
UPDATE pondus_templates
   SET analysis = jsonb_build_object(
     'authority', GREATEST(0, LEAST(100, score)),
     'clarity',   GREATEST(0, LEAST(100, score)),
     'trust',     GREATEST(0, LEAST(100, score)),
     'safety',    GREATEST(0, LEAST(100, score)),
     'momentum',  GREATEST(0, LEAST(100, score))
   )
 WHERE analysis IS NULL
    OR analysis = '{}'::jsonb
    OR analysis = '{"authority":0,"clarity":0,"trust":0,"safety":0,"momentum":0}'::jsonb;

-- GIN-indeks for potensielle framtidige jsonb-filter (f.eks. finn maler der
-- autoritet >= 80). Idempotent + billig — kan alltid droppes senere.
CREATE INDEX IF NOT EXISTS idx_pondus_templates_analysis_gin
  ON pondus_templates USING gin (analysis);

COMMIT;
