-- 0069_dance_admin_ops.sql
-- Resterende dans-vertikal-tabeller: performance, music_archive, reel_clip,
-- grant_application, invoice, union_membership.
--
-- Alle ren CRUD over (owner, project) scope. Holdt i én migration siden
-- de er kompakte og ikke har FKs til hverandre.

-- ─── dance_performance — forestilling/show ────────────────────
CREATE TABLE IF NOT EXISTS dance_performance (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  performance_date TIMESTAMPTZ NOT NULL,
  venue TEXT,
  -- 'planned' | 'rehearsing' | 'tickets_open' | 'sold_out' | 'completed' | 'cancelled'
  status TEXT NOT NULL DEFAULT 'planned',
  ticket_url TEXT,
  capacity INTEGER,
  tickets_sold INTEGER NOT NULL DEFAULT 0,
  -- Stripboard: ordnet array av { choreographyId, durationSec?, notes? }
  program JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dance_performance_status_values
    CHECK (status IN ('planned','rehearsing','tickets_open','sold_out','completed','cancelled'))
);
CREATE INDEX IF NOT EXISTS dance_performance_owner_date_idx
  ON dance_performance (owner_user_id, performance_date DESC);
CREATE INDEX IF NOT EXISTS dance_performance_project_idx
  ON dance_performance (owner_user_id, project_id);

-- ─── dance_music_archive — bibliotek av musikk for koreografi ─
CREATE TABLE IF NOT EXISTS dance_music_archive (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  composer TEXT,
  bpm INTEGER,
  musical_key TEXT,
  duration_sec NUMERIC(10,2),
  -- 'pending' | 'cleared' | 'blocked' | 'unknown'
  tono_status TEXT NOT NULL DEFAULT 'unknown',
  tono_reference TEXT,
  -- R2 storage
  storage_key TEXT,
  signed_url TEXT,
  signed_url_expires_at TIMESTAMPTZ,
  mime TEXT,
  -- External link as alternative to R2 upload
  source_url TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dance_music_archive_tono_values
    CHECK (tono_status IN ('pending','cleared','blocked','unknown'))
);
CREATE INDEX IF NOT EXISTS dance_music_archive_owner_idx
  ON dance_music_archive (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dance_music_archive_project_idx
  ON dance_music_archive (owner_user_id, project_id);
CREATE INDEX IF NOT EXISTS dance_music_archive_tono_idx
  ON dance_music_archive (owner_user_id, tono_status);

-- ─── dance_reel_clip — frilanser portefølje ────────────────────
CREATE TABLE IF NOT EXISTS dance_reel_clip (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  -- Vimeo / YouTube / direct R2
  source_url TEXT,
  embed_url TEXT,
  thumbnail_url TEXT,
  storage_key TEXT,
  signed_url TEXT,
  signed_url_expires_at TIMESTAMPTZ,
  duration_sec NUMERIC(10,2),
  -- skill-tags: ["contemporary","lift","turn","pirouette","improv"]
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Ordnet display, høyere = vises først.
  feature_order INTEGER NOT NULL DEFAULT 0,
  -- Public share token — hvis satt kan klippet sees uten login.
  public_share_token TEXT UNIQUE,
  recorded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dance_reel_clip_owner_feat_idx
  ON dance_reel_clip (owner_user_id, feature_order DESC, recorded_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS dance_reel_clip_share_idx
  ON dance_reel_clip (public_share_token) WHERE public_share_token IS NOT NULL;

-- ─── dance_grant_application — søknader til Kulturrådet etc ───
CREATE TABLE IF NOT EXISTS dance_grant_application (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  -- 'kulturradet' | 'fond_lyd_bilde' | 'kommunal' | 'fylke' | 'private' | 'other'
  fund_name TEXT NOT NULL DEFAULT 'kulturradet',
  amount_requested_kr INTEGER,
  amount_awarded_kr INTEGER,
  -- 'draft' | 'submitted' | 'in_review' | 'awarded' | 'rejected' | 'withdrawn'
  status TEXT NOT NULL DEFAULT 'draft',
  deadline TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  application_text TEXT,
  notes TEXT,
  -- Eksterne URLer (offisielle søknadsskjema, vedlegg).
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dance_grant_status_values
    CHECK (status IN ('draft','submitted','in_review','awarded','rejected','withdrawn'))
);
CREATE INDEX IF NOT EXISTS dance_grant_owner_status_idx
  ON dance_grant_application (owner_user_id, status, deadline ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS dance_grant_project_idx
  ON dance_grant_application (owner_user_id, project_id);

-- ─── dance_invoice — faktura (EHF/KID) ────────────────────────
CREATE TABLE IF NOT EXISTS dance_invoice (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,
  invoice_number TEXT,
  customer_name TEXT NOT NULL,
  customer_org_no TEXT,
  customer_email TEXT,
  customer_address TEXT,
  amount_kr INTEGER NOT NULL DEFAULT 0,
  vat_kr INTEGER NOT NULL DEFAULT 0,
  -- 'draft' | 'sent' | 'paid' | 'overdue' | 'void'
  status TEXT NOT NULL DEFAULT 'draft',
  -- 'manual' | 'ehf' | 'kid'
  delivery_method TEXT NOT NULL DEFAULT 'manual',
  kid_number TEXT,
  ehf_status TEXT, -- 'pending'|'sent'|'failed' etc, free-text for now
  issue_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  -- Linjer: [{ description, quantity, unit_price_kr, amount_kr }]
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  -- For Fiken/Tripletex-koblinger (lagrer ekstern ID når vi syncer).
  fiken_invoice_id TEXT,
  tripletex_invoice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dance_invoice_status_values
    CHECK (status IN ('draft','sent','paid','overdue','void')),
  CONSTRAINT dance_invoice_delivery_values
    CHECK (delivery_method IN ('manual','ehf','kid'))
);
CREATE INDEX IF NOT EXISTS dance_invoice_owner_status_idx
  ON dance_invoice (owner_user_id, status, due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS dance_invoice_project_idx
  ON dance_invoice (owner_user_id, project_id);

-- ─── dance_union_membership — Skuda/NoDa/Sko-status ───────────
CREATE TABLE IF NOT EXISTS dance_union_membership (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  -- 'skuda' | 'noda' | 'sko' | 'other'
  organization TEXT NOT NULL DEFAULT 'skuda',
  member_id TEXT,
  -- 'active' | 'pending' | 'inactive' | 'suspended'
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ,
  -- Loggføring av arbeidsdager — settes med tariff-sats per dag.
  -- Format: [{ ymd, hours, classKind, tariffKr, jobTitle?, project? }]
  work_days JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Aktive tariff-satser snapshot.
  tariff_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dance_union_status_values
    CHECK (status IN ('active','pending','inactive','suspended'))
);
CREATE INDEX IF NOT EXISTS dance_union_owner_org_idx
  ON dance_union_membership (owner_user_id, organization);
