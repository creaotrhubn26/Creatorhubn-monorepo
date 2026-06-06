-- Fiks Phase 7.7 demo-seed: DO-blokken i 219 krastet på typo i siste agency-UUID
-- (a5555555-5555-5555-5555-555555555555a5 har 14 chars i siste segment, gyldig
-- UUID krever 12). EXCEPTION rullet tilbake hele DO-blokken, så de 9 nye
-- demo-talents fikk KUN grants til production_company (fra fallback-INSERT'en
-- nederst i 219), ikke til Stella/NSF/Northern Lights/Bergen Film Academy.
--
-- Resultat: /agency/talents/search?demo=1 (Stella demo-agency) returnerte 1
-- talent (kun Ingrid fra Phase 2) istedenfor 10. Saved-searches-INSERT'en
-- nedenfor ble heller aldri kjørt.
--
-- Denne migrasjonen er idempotent: ON CONFLICT DO UPDATE for både consent
-- og saved-searches.

DO $$
DECLARE
  agency_data jsonb := '[
    {"id":"a1111111-1111-1111-1111-1111111111a1","type":"caster_individual","name":"Northern Lights Casting"},
    {"id":"a2222222-2222-2222-2222-2222222222a2","type":"stella_casting","name":"Stella Casting"},
    {"id":"a3333333-3333-3333-3333-3333333333a3","type":"skuespillersenter","name":"Nordic Skuespillersenter"},
    {"id":"a4444444-4444-4444-4444-4444444444a4","type":"workshop_provider","name":"Bergen Film Academy"}
  ]'::jsonb;
  talent_ids text[] := ARRAY[
    'b1111111-1111-1111-1111-111111111111',
    'b2222222-2222-2222-2222-222222222222',
    'b3333333-3333-3333-3333-333333333333',
    'b4444444-4444-4444-4444-444444444444',
    'b5555555-5555-5555-5555-555555555555',
    'b6666666-6666-6666-6666-666666666666',
    'b7777777-7777-7777-7777-777777777777',
    'b8888888-8888-8888-8888-888888888888',
    'b9999999-9999-9999-9999-999999999999'
  ];
  scope_list text[] := ARRAY['basic_profile','media_portfolio','demographics','audition_invitations','availability'];
  agency jsonb;
  talent_id text;
  scope_name text;
BEGIN
  FOR talent_id IN SELECT unnest(talent_ids) LOOP
    FOR agency IN SELECT jsonb_array_elements(agency_data) LOOP
      FOR scope_name IN SELECT unnest(scope_list) LOOP
        INSERT INTO talent_consent_registry
          (talent_id, partner_type, partner_ref, partner_display_name, scope,
           status, granted_at, is_demo)
        VALUES (
          talent_id::uuid,
          agency->>'type',
          agency->>'id',
          agency->>'name',
          scope_name,
          'granted',
          now() - (random() * interval '60 days'),
          TRUE
        )
        ON CONFLICT (talent_id, partner_type, partner_ref, scope) DO UPDATE SET
          status = 'granted', is_demo = TRUE, updated_at = now();
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ── Saved-searches: 5 stk for Stella demo-agency ─────────────────────
INSERT INTO users (id, email, name, role, created_at)
VALUES ('99999999-9999-9999-9999-999999999999', 'demo-agency@theroleroom.com', 'Demo Agency Bruker', 'agency', now())
ON CONFLICT (id) DO UPDATE SET role = 'agency';

INSERT INTO agency_saved_searches
  (id, owner_user_id, agency_org_id, name, filters, estimated_count, shared, last_run_at)
VALUES
  ('d1111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999',
   'a2222222-2222-2222-2222-2222222222a2',
   'Oslo 20–30 Drama',
   '{"location":"Oslo","age_min":20,"age_max":30,"skills":["Drama","Acting"]}'::jsonb,
   142, TRUE, now()),

  ('d2222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999',
   'a2222222-2222-2222-2222-2222222222a2',
   'Bergen 30+ Nordic look',
   '{"location":"Bergen","age_min":30}'::jsonb,
   86, TRUE, now()),

  ('d3333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999',
   'a2222222-2222-2222-2222-2222222222a2',
   'Trondheim Young Talent',
   '{"location":"Trondheim","age_min":16,"age_max":25}'::jsonb,
   67, TRUE, now()),

  ('d4444444-4444-4444-4444-444444444444', '99999999-9999-9999-9999-999999999999',
   'a2222222-2222-2222-2222-2222222222a2',
   'English speaking actors',
   '{"languages":["English"]}'::jsonb,
   213, TRUE, now()),

  ('d5555555-5555-5555-5555-555555555555', '99999999-9999-9999-9999-999999999999',
   'a2222222-2222-2222-2222-2222222222a2',
   'Comedic actors',
   '{"skills":["Comedy"]}'::jsonb,
   128, TRUE, now())
ON CONFLICT (id) DO UPDATE SET
  estimated_count = EXCLUDED.estimated_count,
  shared = TRUE,
  updated_at = now();
