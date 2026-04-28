-- 0074_dance_plan_seed.sql
-- Komplettér eksisterende dance_plan-seed (fra 0070_dance_billing.sql)
-- med team-support-felter:
--
--   • maxTeamSeats på alle dance_studio-planer (kreves for seat-håndhevelse
--     i dance-team-service.getMaxTeamSeats)
--   • addon_eligible-feature på Frilansdanser Pro (forberedelse for
--     add-on-systemet i 0075)
--   • Studio Enterprise legges til hvis den ikke finnes (NULL pris,
--     ubegrenset seats)
--
-- ALL eksisterende admin-konfigurert pris-info beholdes. Vi muterer
-- KUN limits og features med jsonb-merge-operatoren.

-- ── 1. Studio-planer: legg til maxTeamSeats ─────────────────────────
-- Bruker jsonb-konkatenasjon (||) som overstyrer keys hvis de finnes
-- og legger til hvis ikke.

UPDATE dance_plan
   SET limits = limits || '{"maxTeamSeats": 5}'::jsonb,
       updated_at = now()
 WHERE slug = 'studio_start' AND NOT (limits ? 'maxTeamSeats');

UPDATE dance_plan
   SET limits = limits || '{"maxTeamSeats": 10}'::jsonb,
       updated_at = now()
 WHERE slug = 'studio' AND NOT (limits ? 'maxTeamSeats');

UPDATE dance_plan
   SET limits = limits || '{"maxTeamSeats": 20}'::jsonb,
       updated_at = now()
 WHERE slug = 'studio_pro' AND NOT (limits ? 'maxTeamSeats');

-- ── 2. Studio Enterprise — opprett hvis ikke finnes ─────────────────
INSERT INTO dance_plan
  (slug, name, persona, description, monthly_price_kr, yearly_price_kr,
   features, limits, trial_days, is_active, is_featured, display_order)
VALUES
  (
    'studio_enterprise',
    'Studio Enterprise',
    'dance_studio',
    'For akademi og kompani med 20+ aktive medlemmer. Custom prising, dedikert support.',
    NULL, NULL,
    '["unlimited_pieces","video_review","ai_tagging","formation_builder","count_grid","rehearsal_planner","team_invites","ehf_invoice","analytics_pro","grants","white_label","sso","dedicated_support"]'::jsonb,
    '{"maxTeamSeats": null, "storageGb": null, "videoStreamingMonthlyHrs": null}'::jsonb,
    30, TRUE, FALSE, 25
  )
ON CONFLICT (slug) DO NOTHING;

-- ── 3. Frilansdanser Pro: legg til addon_eligible-flagg ─────────────
-- (Forberedelse for add-on-systemet i migration 0075. Frilansere på Pro
-- kan kjøpe ekstra moduler à la carte; Basic/Free kan ikke.)
UPDATE dance_plan
   SET features = (
         SELECT jsonb_agg(DISTINCT v) FROM (
           SELECT jsonb_array_elements_text(features) AS v
           UNION SELECT 'addon_eligible'
         ) merged_features
       ),
       updated_at = now()
 WHERE slug = 'freelance_pro'
   AND NOT (features @> '["addon_eligible"]'::jsonb);
