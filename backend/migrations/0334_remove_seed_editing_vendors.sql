-- 0334_remove_seed_editing_vendors.sql
-- Fjern seedet TEST-redigeringsvendors (ikke ekte data). Ekte partnere legges til
-- via godkjenningsflyten (lead → søknad → godkjenning). Engangs-opprydding scoped
-- til de to test-navnene + vendor_type='editing'. Sletter avhengige rader først.
-- Alle vendor-referanser = vendorens user_id (varchar).

DELETE FROM editing_vendor_reviews WHERE vendor_user_id IN (
  SELECT user_id FROM vendor_onboarding_profiles
   WHERE vendor_type = 'editing' AND vendor_name IN ('Nordic Edit Studio', 'FrameFlow Post'));

DELETE FROM editing_vendor_complaints WHERE vendor_user_id IN (
  SELECT user_id FROM vendor_onboarding_profiles
   WHERE vendor_type = 'editing' AND vendor_name IN ('Nordic Edit Studio', 'FrameFlow Post'));

DELETE FROM vendor_showcase_products WHERE vendor_id IN (
  SELECT user_id FROM vendor_onboarding_profiles
   WHERE vendor_type = 'editing' AND vendor_name IN ('Nordic Edit Studio', 'FrameFlow Post'));

DELETE FROM vendor_onboarding_profiles
 WHERE vendor_type = 'editing' AND vendor_name IN ('Nordic Edit Studio', 'FrameFlow Post');
