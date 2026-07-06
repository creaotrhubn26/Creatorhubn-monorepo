-- Migration 0373: cms_page_revisions_schedule_columns
--
-- cms_page_revisions manglet publish_at/unpublish_at, selv om cms_pages
-- har hatt dem siden migrasjon 145/146. Uten disse kolonnene kunne
-- POST /api/admin/cms/pages/:slug/revert/:revisionId ikke gjenopprette
-- schedule-state sammen med innhold — en revert til et utkast kunne
-- ende opp som publisert med en gang.
--
-- Idempotent (IF NOT EXISTS), trygt å kjøre på enhver eksisterende
-- cms_page_revisions-tabell.

ALTER TABLE IF EXISTS cms_page_revisions
  ADD COLUMN IF NOT EXISTS publish_at   timestamptz,
  ADD COLUMN IF NOT EXISTS unpublish_at timestamptz;
