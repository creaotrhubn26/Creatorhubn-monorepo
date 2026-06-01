-- Fiks demo-saved-searches-INSERT som krastet i både 219 og 220.
--
-- users-tabellen har IKKE en "name"-kolonne — den har first_name + last_name
-- + username + password (alle NOT NULL). 219+220 prøvde å insert "name"
-- → kolonne-mismatch → INSERT krastet → ingen saved-searches.
--
-- Denne migrasjonen bruker korrekt skjema og er idempotent.

INSERT INTO users (id, username, password, email, first_name, last_name, role, language, created_at)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  'demo-agency',
  'demo-disabled-no-login',
  'demo-agency@theroleroom.com',
  'Demo',
  'Agency',
  'agency',
  'no',
  now()
)
ON CONFLICT (id) DO UPDATE SET
  role = 'agency',
  first_name = COALESCE(users.first_name, 'Demo'),
  last_name = COALESCE(users.last_name, 'Agency');

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
