-- 0134 — View-count tracking på offentlige CV-er
--
-- Hver gang noen henter /api/public/resumes/:slug increment-er vi
-- public_view_count. Vises i editor-action-baren når CV-en er offentlig
-- så eier kan se hvor mange som har sett delelinken.
--
-- Idempotent.

DO $$ BEGIN
  ALTER TABLE resumes
    ADD COLUMN IF NOT EXISTS public_view_count INT NOT NULL DEFAULT 0;
END $$;

CREATE INDEX IF NOT EXISTS resumes_public_url_idx ON resumes (public_url) WHERE public_url IS NOT NULL;
