-- Re-kjør 220's consent-INSERT med korrekt PL/pgSQL-syntaks.
--
-- I migrate 220 (og 219) ble loop-variabelen kalt `talent_id` — samme navn
-- som kolonnen i talent_consent_registry. ON CONFLICT-klausulen fikk
-- ambiguity-error ("could refer to either a PL/pgSQL variable or a table
-- column") og hele DO-blokken rulles tilbake. Resultat: de 9 nye
-- demo-talents fikk ikke consent til de 4 demo-agencies.
--
-- Denne migrasjonen renamer alle loop-variabler (tid, ag, sc) så de ikke
-- kolliderer med kolonnenavn. Idempotent via ON CONFLICT DO UPDATE.

DO $$
DECLARE
  agency_data jsonb := '[
    {"id":"a1111111-1111-1111-1111-1111111111a1","type":"caster_individual","name":"Northern Lights Casting"},
    {"id":"a2222222-2222-2222-2222-2222222222a2","type":"stella_casting","name":"Stella Casting"},
    {"id":"a3333333-3333-3333-3333-3333333333a3","type":"skuespillersenter","name":"Nordic Skuespillersenter"},
    {"id":"a4444444-4444-4444-4444-4444444444a4","type":"workshop_provider","name":"Bergen Film Academy"}
  ]'::jsonb;
  tid_list text[] := ARRAY[
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
  scope_arr text[] := ARRAY['basic_profile','media_portfolio','demographics','audition_invitations','availability'];
  ag jsonb;
  tid text;
  sc text;
BEGIN
  FOR tid IN SELECT unnest(tid_list) LOOP
    FOR ag IN SELECT jsonb_array_elements(agency_data) LOOP
      FOR sc IN SELECT unnest(scope_arr) LOOP
        INSERT INTO talent_consent_registry
          (talent_id, partner_type, partner_ref, partner_display_name, scope,
           status, granted_at, is_demo)
        VALUES (
          tid::uuid,
          ag->>'type',
          ag->>'id',
          ag->>'name',
          sc,
          'granted',
          now() - (random() * interval '60 days'),
          TRUE
        )
        ON CONFLICT (talent_id, partner_type, partner_ref, scope) DO UPDATE SET
          status = 'granted',
          is_demo = TRUE,
          updated_at = now();
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
