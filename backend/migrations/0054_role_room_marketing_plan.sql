-- 0054_role_room_marketing_plan.sql
-- Marketing Plan Engine — strategi-laget som binder sammen producer-
-- bootstrap, feed-planner og (senere) Instagram Insights til en
-- 30-dagers plan klienten faktisk kan måle fremgang på.
--
-- Slice 1 lander kun de to toppnivå-tabellene (plan + pillars). Post-
-- links kommer i Slice 2 (0055), analytics + KPI-aktuals i Slice 3
-- (0056). Dette holder hver migrering fokusert og reverserbar.

CREATE TABLE IF NOT EXISTS role_room_marketing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),

  -- Strategi-laget. Hele Claude-outputten lagres som JSONB slik at vi
  -- kan iterere på feltnavn uten migrasjoner. Forventet shape:
  --   {
  --     channelStrategy: { primary: 'instagram', cadencePerWeek: 5, ... },
  --     toneOfVoice: { voice, dos[], donts[] },
  --     kpiTargets: [{ metric, target, per, rationale }],
  --     positioning: { valueProp, differentiator }
  --   }
  strategy JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Generering-metadata. Modellen kan byttes (Sonnet 4.6 → 4.7 osv.);
  -- å lagre hvilken modell som genererte planen lar oss flagge planer
  -- skrevet med utgåtte modeller når vi senere vil re-generere batch.
  generated_at TIMESTAMPTZ,
  generated_with_model TEXT,

  -- Horisont. 30-dagers default, men photografer kan be om 7 eller 90.
  -- start_date er NULL til planen faktisk aktiveres; da settes den til
  -- planleggings-dagen og posts tidsangis relativt til denne.
  start_date DATE,
  horizon_days INT NOT NULL DEFAULT 30,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_marketing_plans_project_idx
  ON role_room_marketing_plans (project_id, status);

-- Content pillars — 3-5 hovedtemaer som hele planen orbiterer rundt.
-- Hver post i 30-dagers planen skal (i Slice 2) lenkes til én pillar,
-- slik at vi i Slice 3 kan aggregere KPI-er på pillar-nivå og se
-- hvilke temaer som funker best.
CREATE TABLE IF NOT EXISTS role_room_marketing_plan_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES role_room_marketing_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,            -- kort kategori-navn, f.eks. "Behind the scenes"
  description TEXT,              -- fri-tekst utdyping for klient-dashboardet
  rationale TEXT,                -- hvorfor denne pillaren gir mening ut fra bootstrap-dataen
  -- Per-pillar KPI-mål (valgfritt). Formet slik:
  --   { metric: 'engagement_rate', target: 0.05, per: 'post' }
  target_kpi JSONB,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_marketing_plan_pillars_plan_idx
  ON role_room_marketing_plan_pillars (plan_id, sort_order);

COMMENT ON TABLE role_room_marketing_plans IS
  'Top-level marketing plan per prosjekt. Strategy-JSONB er Claude-generert fra producer-bootstrap + feed-planner; aktiveres av fotografen for å starte 30-dagers horisonten.';
COMMENT ON TABLE role_room_marketing_plan_pillars IS
  'Content pillars (3-5) — temaene alle posts i planen grupperes rundt. Brukes i Slice 3 for KPI-aggregering per tema.';
