-- "Hva er nytt"-oppføringer per Role Room-modus
--
-- Drives av HelpButton i hver workspace (DanceWorkspace, casting-main,
-- PostAgent, etc.). Admin Room CRUD-panel administrerer disse.
--
-- mode-feltet er fritekst (slug) slik at vi kan legge til nye modi uten
-- migrasjon. Foreslåtte verdier: 'dance', 'casting', 'post_agent',
-- 'live_set', 'ads', 'global'.
--
-- kind: 'feature' | 'improvement' | 'fix' — kun en hint til UI for
-- farge/label. Ingen DB-constraint så vi kan utvide senere.

CREATE TABLE IF NOT EXISTS whats_new_entries (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  mode text NOT NULL,
  kind text NOT NULL DEFAULT 'feature',
  -- Visningsdato (YYYY-MM-DD). Kan være null hvis "rolling".
  entry_date date,
  title text NOT NULL,
  description text,
  published boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whats_new_mode_published
  ON whats_new_entries(mode, published, display_order DESC, entry_date DESC);

COMMENT ON TABLE whats_new_entries IS
  'Per-modus changelog/whats-new-oppføringer for HelpButton-modalen. '
  'Administreres fra Admin Room. mode er en slug (dance/casting/...).';
