-- Migration 137: admin_room v2 — forretningsplan + utvidelser
--
-- Legger til:
--   • admin_business_plan: full strategisk forretningsplan (én per bruker).
--     Følger BI-style TOC: Exec Summary, Intro, Intern/Ekstern analyse,
--     SWOT, Strategisk hjul, SAFe-anbefaling.
--   • admin_funding_apps.deadline date — for frist-varsling
--   • admin_investor_contacts.dd_checklist jsonb — due-diligence
--   • admin_investor_contacts.deck_url + deck_uploaded_at — deck-tracking
--   • admin_partner_contacts.contract_status varchar — kontrakt-status

CREATE TABLE IF NOT EXISTS admin_business_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL UNIQUE,
  -- 1.0 Executive Summary
  exec_summary text,
  -- 2.0 Introduksjon
  intro_overview text,
  intro_vision text,
  intro_sustainability text,
  intro_industry text,
  intro_financials text,
  -- 3.0 Internanalyse
  internal_value_network_primary text,
  internal_value_network_support text,
  internal_drivers_customer text,
  internal_drivers_capacity text,
  internal_drivers_learning text,
  internal_resource_analysis text,
  internal_operational text,
  internal_dynamic text,
  internal_vrio text,
  internal_network_structure text,
  internal_strengths_weaknesses text,
  -- 4.0 Ekstern analyse
  external_pestel text,
  external_pestel_conclusion text,
  external_porter text,
  external_porter_conclusion text,
  external_competitors text,
  external_competitor_summary text,
  external_stakeholders text,
  external_stakeholder_conclusion text,
  -- 5.0 SWOT
  swot_strengths text,
  swot_weaknesses text,
  swot_opportunities text,
  swot_threats text,
  -- 6.0 Strategisk hjul
  strategic_wheel text,
  current_strategy text,
  -- 7.0 Strategisk anbefaling
  strategic_recommendation text,
  safe_suitability text,
  safe_acceptability text,
  safe_feasibility text,
  -- metadata
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Utvid eksisterende admin_room-tabeller (idempotent ALTER ADD COLUMN IF NOT EXISTS)
ALTER TABLE admin_funding_apps ADD COLUMN IF NOT EXISTS deadline date;

ALTER TABLE admin_investor_contacts ADD COLUMN IF NOT EXISTS dd_checklist jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE admin_investor_contacts ADD COLUMN IF NOT EXISTS deck_url varchar;
ALTER TABLE admin_investor_contacts ADD COLUMN IF NOT EXISTS deck_uploaded_at timestamptz;

ALTER TABLE admin_partner_contacts ADD COLUMN IF NOT EXISTS contract_status varchar;
