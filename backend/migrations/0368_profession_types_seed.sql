-- 0368: Seed profession_types med den kanoniske baselinen.
--
-- Kilde til sannhet for id-er/verdier: frontend/shared/profession-types.ts
-- (CANONICAL_PROFESSIONS). GET /api/admin/profession-types merger DB over
-- kode-baselinen, så seeden gjør tabellen komplett for admin-CRUD (toggle/
-- rediger) uten at manglende rader endrer hva API-et serverer.
--
-- Idempotent: ON CONFLICT (name) DO NOTHING — rører aldri admin-redigerte rader.
-- Kanonisk form er underscore ('music_producer'), aldri 'musicproducer'.

INSERT INTO profession_types (name, display_name, description, icon_color, is_active, sort_order)
VALUES
  ('photographer',   'Fotograf',        'Profesjonell fotograf',          '#ff8c00', true, 0),
  ('videographer',   'Videograf',       'Profesjonell videoprodusent',    '#e74c3c', true, 1),
  ('music_producer', 'Musikkprodusent', 'Profesjonell musikkprodusent',   '#9b59b6', true, 2),
  ('pet_groomer',    'Dyrepleier',      'Profesjonell dyrepleier',        '#27ae60', true, 3),
  ('vendor',         'Leverandør',      'Leverandør av varer/tjenester',  '#3498db', true, 4),
  ('enterprise',     'Enterprise Team', 'Team- og bedriftskonto',         '#6c3483', true, 5)
ON CONFLICT (name) DO NOTHING;

-- Rydd opp historiske alias-verdier i users.profession → kanonisk form.
-- (Registreringen kanoniserer fra nå av via normalizeProfession, men gamle
-- rader kan ha 'musicproducer'/'music-producer' fra før.)
UPDATE users SET profession = 'music_producer'
 WHERE lower(profession) IN ('musicproducer', 'music-producer');
