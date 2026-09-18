-- Story Graph (game_studio) Fase 4: lokalisering / Translation Mode.
-- Per-locale overrides lagres i rad-JSONB (samme mønster som CMS-blokkenes i18n):
--   narrative_elements.i18n    = {"en": {"titleHtml": "...", "contentHtml": "..."}}
--   narrative_connections.i18n = {"en": {"labelHtml": "..."}}
--   narrative_settings.i18n    = {"en": {"title": "..."}}
-- Kilden (nb) ligger i de vanlige kolonnene og finnes aldri i i18n. Kodeblokker
-- (arcscript) oversettes aldri — format-laget fletter kildens skript inn ved
-- oppslag (frontend/shared/narrative-format/locale.ts). `locales` = aktiverte
-- locale-koder, første er kildespråket.

ALTER TABLE narrative_elements
  ADD COLUMN IF NOT EXISTS i18n JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE narrative_connections
  ADD COLUMN IF NOT EXISTS i18n JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE narrative_settings
  ADD COLUMN IF NOT EXISTS i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS locales JSONB NOT NULL DEFAULT '["nb"]'::jsonb;
