-- Migration 136: admin_room
--
-- Internt admin-arbeidsrom for daniel@creatorhubn.com — pipeline for
-- offentlige støtteordninger (Innovasjon Norge 1 + 2), investor-kontakter
-- og potensielle samarbeidspartnere. Ikke en del av det publiserte
-- The Role Room-produktet.
--
-- Authorization gjøres på applikasjons-nivå (email-check); tabellene har
-- user_id-kolonne som tillater fremtidig multi-tenant-utvidelse uten
-- ny migrasjon.

CREATE TABLE IF NOT EXISTS admin_funding_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  scheme varchar NOT NULL,
  scheme_label varchar NOT NULL,
  project_name varchar NOT NULL,
  applicant_company varchar,
  status varchar NOT NULL DEFAULT 'draft',
  amount_requested numeric,
  currency varchar NOT NULL DEFAULT 'NOK',
  description text,
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_person varchar,
  contact_email varchar,
  submission_date date,
  decision_date date,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_funding_apps_user_idx
  ON admin_funding_apps (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_investor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  company_name varchar NOT NULL,
  contact_name varchar,
  contact_email varchar,
  contact_phone varchar,
  status varchar NOT NULL DEFAULT 'lead',
  ticket_size_min numeric,
  ticket_size_max numeric,
  currency varchar NOT NULL DEFAULT 'NOK',
  focus_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  intro_source varchar,
  next_step text,
  next_step_due date,
  notes text,
  last_contact_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_investor_contacts_user_idx
  ON admin_investor_contacts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_partner_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  company_name varchar NOT NULL,
  contact_name varchar,
  contact_email varchar,
  contact_phone varchar,
  partnership_type varchar NOT NULL DEFAULT 'other',
  status varchar NOT NULL DEFAULT 'potential',
  proposal_summary text,
  next_step text,
  next_step_due date,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_partner_contacts_user_idx
  ON admin_partner_contacts (user_id, created_at DESC);
