-- Talent Registry demo-seed — Phase 7.7
--
-- Daniel ba om at /talents/registry?demo=1 skal se ut som mockup #2
-- (1247 talents, Featured carousel, 5 saved searches). Vi kan ikke
-- generere 1247 ekte talents — men vi seedet 9 stk med portretter,
-- 5 saved searches, og auto-grant consent fra alle 9 til alle 5 demo-
-- agencies (Stella, NSF, Northern Lights, Bergen Film Academy, Dramatikkens).
--
-- Alle nye rader har is_demo = TRUE og er strikt isolert fra prod.
-- Bilder lastet via randomuser.me (CC0, stabile URLer).
--
-- Profiler matchet til mockup-navnene: Elias Berg, Sara Øien, Marius
-- Holm, Live Solberg, Nils Hauge, Ingrid Vik, Jonas Mørk, Amalie Skog,
-- Henrik Dahl.

-- ── 1. 9 demo-talents ────────────────────────────────────────────────
INSERT INTO talents (
  id, owner_user_id, display_name, email, city, country, bio,
  represented, agency_name, playing_age_min, playing_age_max, gender,
  height_cm, hair_color, eye_color,
  skills, languages, dialects,
  availability_status, willing_to_travel,
  headshot_url, showreel_url,
  profile_status, is_demo, created_at, updated_at
) VALUES
  ('b1111111-1111-1111-1111-111111111111', NULL, 'Elias Berg', 'demo-elias@theroleroom.com',
   'Oslo', 'NO',
   'Klassisk-utdannet skuespiller med fokus på moderne drama. Tre år på Det Norske Teatret.',
   TRUE, 'Stella Casting', 21, 31, 'male',
   183, 'Brown', 'Blue',
   '[{"id":"acting","label":"Acting"},{"id":"voice","label":"Voice"},{"id":"improvisation","label":"Improvisation"}]'::jsonb,
   '[{"code":"nb","label":"Norsk","level":"native"},{"code":"en","label":"English","level":"fluent"}]'::jsonb,
   '["Oslo"]'::jsonb,
   'open', TRUE,
   'https://randomuser.me/api/portraits/men/11.jpg',
   NULL,
   'active', TRUE, now() - interval '60 days', now()),

  ('b2222222-2222-2222-2222-222222222222', NULL, 'Sara Øien', 'demo-sara@theroleroom.com',
   'Bergen', 'NO',
   'Dansere fra Den Norske Operaen, krysser over til film og scene. Klassisk + samtidsdans.',
   TRUE, 'Stella Casting', 20, 28, 'female',
   168, 'Brown', 'Green',
   '[{"id":"acting","label":"Acting"},{"id":"dance","label":"Dance"},{"id":"singing","label":"Singing"}]'::jsonb,
   '[{"code":"nb","label":"Norsk","level":"native"},{"code":"en","label":"English","level":"fluent"}]'::jsonb,
   '["Bergen"]'::jsonb,
   'open', TRUE,
   'https://randomuser.me/api/portraits/women/22.jpg',
   NULL,
   'active', TRUE, now() - interval '45 days', now()),

  ('b3333333-3333-3333-3333-333333333333', NULL, 'Marius Holm', 'demo-marius@theroleroom.com',
   'Trondheim', 'NO',
   'Action-skuespiller med base i kampsport. Stunts og våpentrening sertifisert.',
   TRUE, 'Northern Lights Casting', 28, 38, 'male',
   188, 'Black', 'Brown',
   '[{"id":"acting","label":"Acting"},{"id":"stunts","label":"Stunts"},{"id":"combat","label":"Combat"}]'::jsonb,
   '[{"code":"nb","label":"Norsk","level":"native"},{"code":"en","label":"English","level":"fluent"},{"code":"sv","label":"Svensk","level":"intermediate"}]'::jsonb,
   '["Trondheim","Trøndersk"]'::jsonb,
   'open', TRUE,
   'https://randomuser.me/api/portraits/men/33.jpg',
   NULL,
   'active', TRUE, now() - interval '70 days', now()),

  ('b4444444-4444-4444-4444-444444444444', NULL, 'Live Solberg', 'demo-live@theroleroom.com',
   'Oslo', 'NO',
   'Komiker og skuespiller. Lang erfaring fra stand-up + sketsj. Voice-over for animasjon.',
   TRUE, 'Stella Casting', 25, 33, 'female',
   170, 'Blonde', 'Blue',
   '[{"id":"acting","label":"Acting"},{"id":"comedy","label":"Comedy"},{"id":"voice","label":"Voice"}]'::jsonb,
   '[{"code":"nb","label":"Norsk","level":"native"},{"code":"en","label":"English","level":"fluent"}]'::jsonb,
   '["Oslo"]'::jsonb,
   'open', TRUE,
   'https://randomuser.me/api/portraits/women/44.jpg',
   NULL,
   'active', TRUE, now() - interval '30 days', now()),

  ('b5555555-5555-5555-5555-555555555555', NULL, 'Nils Hauge', 'demo-nils@theroleroom.com',
   'Stavanger', 'NO',
   'Erfaren karakterskuespiller med 30+ år i bransjen. Spesialitet: morfar-roller, byråsjef, kaptein.',
   FALSE, NULL, 40, 65, 'male',
   180, 'Grey', 'Brown',
   '[{"id":"acting","label":"Acting"},{"id":"voice","label":"Voice"},{"id":"narration","label":"Narration"}]'::jsonb,
   '[{"code":"nb","label":"Norsk","level":"native"},{"code":"en","label":"English","level":"fluent"}]'::jsonb,
   '["Stavanger"]'::jsonb,
   'open', TRUE,
   'https://randomuser.me/api/portraits/men/55.jpg',
   NULL,
   'active', TRUE, now() - interval '90 days', now()),

  ('b6666666-6666-6666-6666-666666666666', NULL, 'Ingrid Vik', 'demo-ingrid@theroleroom.com',
   'Stavanger', 'NO',
   'Skuespiller-modell, jobber både film og fashion. Klassisk ballett-bakgrunn.',
   TRUE, 'Northern Lights Casting', 18, 26, 'female',
   173, 'Blonde', 'Blue',
   '[{"id":"acting","label":"Acting"},{"id":"dance","label":"Dance"},{"id":"modeling","label":"Modeling"}]'::jsonb,
   '[{"code":"nb","label":"Norsk","level":"native"},{"code":"en","label":"English","level":"fluent"}]'::jsonb,
   '["Stavanger"]'::jsonb,
   'limited', TRUE,
   'https://randomuser.me/api/portraits/women/66.jpg',
   NULL,
   'active', TRUE, now() - interval '15 days', now()),

  ('b7777777-7777-7777-7777-777777777777', NULL, 'Jonas Mørk', 'demo-jonas@theroleroom.com',
   'Bergen', 'NO',
   'Skuespiller og regissør. Voice-over arbeid i podcaster og reklame.',
   TRUE, 'Stella Casting', 30, 40, 'male',
   178, 'Brown', 'Hazel',
   '[{"id":"acting","label":"Acting"},{"id":"voice","label":"Voice"},{"id":"director","label":"Director"}]'::jsonb,
   '[{"code":"nb","label":"Norsk","level":"native"},{"code":"en","label":"English","level":"fluent"}]'::jsonb,
   '["Bergen"]'::jsonb,
   'open', TRUE,
   'https://randomuser.me/api/portraits/men/77.jpg',
   NULL,
   'active', TRUE, now() - interval '20 days', now()),

  ('b8888888-8888-8888-8888-888888888888', NULL, 'Amalie Skog', 'demo-amalie@theroleroom.com',
   'Trondheim', 'NO',
   'Ung sanger-skuespiller med klassisk musikkutdanning fra NTNU. Aktiv i musikkteater.',
   TRUE, 'Nordic Skuespillersenter', 19, 27, 'female',
   165, 'Black', 'Brown',
   '[{"id":"acting","label":"Acting"},{"id":"singing","label":"Singing"},{"id":"piano","label":"Piano"}]'::jsonb,
   '[{"code":"nb","label":"Norsk","level":"native"},{"code":"en","label":"English","level":"fluent"},{"code":"it","label":"Italiano","level":"basic"}]'::jsonb,
   '["Trondheim","Trøndersk"]'::jsonb,
   'open', TRUE,
   'https://randomuser.me/api/portraits/women/88.jpg',
   NULL,
   'active', TRUE, now() - interval '10 days', now()),

  ('b9999999-9999-9999-9999-999999999999', NULL, 'Henrik Dahl', 'demo-henrik@theroleroom.com',
   'Oslo', 'NO',
   'Voice-over og narrator. Hjelpemester for Sherlock Holmes-podcasten. 25+ år i bransjen.',
   FALSE, NULL, 40, 55, 'male',
   175, 'Grey', 'Blue',
   '[{"id":"acting","label":"Acting"},{"id":"voice","label":"Voice"},{"id":"narration","label":"Narration"}]'::jsonb,
   '[{"code":"nb","label":"Norsk","level":"native"},{"code":"en","label":"English","level":"fluent"},{"code":"de","label":"Deutsch","level":"intermediate"}]'::jsonb,
   '["Oslo"]'::jsonb,
   'open', TRUE,
   'https://randomuser.me/api/portraits/men/99.jpg',
   NULL,
   'active', TRUE, now() - interval '120 days', now())
ON CONFLICT (id) DO UPDATE SET
  is_demo = TRUE,
  updated_at = now();

-- ── 2. Grant consent fra hver demo-talent til hver demo-agency ───────
-- Hver talent gir basic_profile + media_portfolio + demographics +
-- audition_invitations til alle 5 demo-agencies (Stella, NSF, Northern
-- Lights, Bergen Film Academy, Dramatikkens Hus).
--
-- Dette gjør at agency-search returnerer alle 9 talents for hver agency
-- i demo-modus.

DO $$
DECLARE
  agency_data jsonb := '[
    {"id":"a1111111-1111-1111-1111-1111111111a1","type":"caster_individual","name":"Northern Lights Casting"},
    {"id":"a2222222-2222-2222-2222-2222222222a2","type":"stella_casting","name":"Stella Casting"},
    {"id":"a3333333-3333-3333-3333-3333333333a3","type":"skuespillersenter","name":"Nordic Skuespillersenter"},
    {"id":"a4444444-4444-4444-4444-4444444444a4","type":"workshop_provider","name":"Bergen Film Academy"},
    {"id":"a5555555-5555-5555-5555-555555555555a5","type":"production_company","name":"Dramatikkens Hus"}
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

-- Note: agency_id-typo above (extra "5a5" — fixed inline below for Dramatikkens)
-- 5555a5 var feil i listen — bruker faktisk seedet id fra migrasjon 211
-- (a5555555-5555-5555-5555-5555555555a5). Re-kjør med korrekt ID:

DO $$
BEGIN
  -- Korriger Dramatikkens Hus consents (de første kan ha feilet på ON CONFLICT
  -- pga ulik partner_ref-format). Sett dem riktig.
  DELETE FROM talent_consent_registry
   WHERE partner_type = 'production_company'
     AND partner_ref LIKE 'a5555555%'
     AND is_demo = TRUE
     AND partner_ref != 'a5555555-5555-5555-5555-5555555555a5';

  INSERT INTO talent_consent_registry
    (talent_id, partner_type, partner_ref, partner_display_name, scope,
     status, granted_at, is_demo)
  SELECT
    t.id, 'production_company', 'a5555555-5555-5555-5555-5555555555a5', 'Dramatikkens Hus', s,
    'granted', now() - (random() * interval '60 days'), TRUE
  FROM talents t
  CROSS JOIN unnest(ARRAY['basic_profile','media_portfolio','demographics','audition_invitations','availability']) s
  WHERE t.id::text LIKE 'b%-1111-1111-1111-%' OR t.id::text LIKE 'b%-2222-%'
     OR t.id::text LIKE 'b%-3333-%' OR t.id::text LIKE 'b%-4444-%'
     OR t.id::text LIKE 'b%-5555-%' OR t.id::text LIKE 'b%-6666-%'
     OR t.id::text LIKE 'b%-7777-%' OR t.id::text LIKE 'b%-8888-%'
     OR t.id::text LIKE 'b%-9999-%'
  ON CONFLICT (talent_id, partner_type, partner_ref, scope) DO UPDATE SET
    status = 'granted', is_demo = TRUE, updated_at = now();
END $$;

-- ── 3. Seed 5 demo saved-searches ────────────────────────────────────
-- Vi har owner_user_id NOT NULL — bruker placeholder demo-user.
-- Sett shared=TRUE så de er synlige for alle agency-medlemmer i demo.
-- Demo-bruker-id 99999999-9999-... reservert til demo.
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
