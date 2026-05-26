-- Kamera-avdeling-utvidelse for The Role Room.
--
-- Kamera-folk vurderes på verktøy de mestrer (camera body + lens + cloud
-- workflow + DIT-software), ikke generisk CV. Denne migrasjonen legger til
-- fire JSONB-felter på industry_targets så matchmaking kan filtrere på
-- "DP-er som har erfaring med Sony Venice + Cooke S4 + Frame.io".
--
-- Inkluderer også 1 ny outreach-template som henviser til konkret reel-shot.

ALTER TABLE role_room_industry_targets
  ADD COLUMN IF NOT EXISTS camera_systems JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lens_systems JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dit_software JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cloud_workflow JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN role_room_industry_targets.camera_systems IS
  'Kamerasystemer personen har mestret: ["arri_alexa_35","sony_venice","red_v_raptor","red_komodo","sony_fx9"]';
COMMENT ON COLUMN role_room_industry_targets.lens_systems IS
  'Lens-pakker: ["cooke_s4","zeiss_supreme","atlas_orion","sigma_cine","leitz_summilux"]';
COMMENT ON COLUMN role_room_industry_targets.dit_software IS
  'DIT-software: ["silverstack","shotput_pro","pomfort_live_grade","davinci_resolve","frame_io_camera_to_cloud"]';
COMMENT ON COLUMN role_room_industry_targets.cloud_workflow IS
  'Cloud-workflow-erfaring: ["frame_io","strada","wipster","pix","filmlight_daylight"]';

-- GIN-indeks på camera_systems for "find DPs med Sony Venice-erfaring"
CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_camera_systems
  ON role_room_industry_targets USING GIN (camera_systems)
  WHERE camera_systems IS NOT NULL AND camera_systems != '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_lens_systems
  ON role_room_industry_targets USING GIN (lens_systems)
  WHERE lens_systems IS NOT NULL AND lens_systems != '[]'::jsonb;

-- Ny outreach-template: DP med reel + spesifikt shot-sitat
INSERT INTO role_room_outreach_templates (slug, title, segment, channel, language, description, body, variables, is_default)
VALUES
  (
    'dp-with-reel-and-credit',
    'DP — med reel-shot-sitat',
    'other',
    'dm',
    'no',
    'Sterkere variant av dp-warm-message. Krever at Claude refererer til en konkret shot fra reel-en (ikke produksjons-tittel) — DPs vurderer outreach på om mottaker faktisk så arbeidet eller bare leste IMDB. Brukes når reel-URL finnes på target.',
    'Hei {{first_name}},

Så reel-en din etter {{recent_production}}. {{specific_shot_with_lens_or_lighting_observation}} — det er den typen valg som ikke skjer ved et uhell.

Spørsmål: når en line producer bestiller deg i dag, hvor stor del av valget tror du er reel vs. anbefaling? Vi har en hypotese at det er 30/70 — magefølelse vinner. Vi vil flytte den til 60/40 ved å gjøre reel + verktøy-erfaring (camera body, lens-pakke, cloud workflow) søkbart i et koordineringslag.

Det er ikke pitche en plattform. Det er invitere deg til å forme hva en seriøs norsk DP-database bør spore.

Kaffe på Vulkan eller Grünerløkka? Du velger 20 minutter, jeg betaler.

Daniel | The Role Room',
    '["first_name","recent_production","specific_shot_with_lens_or_lighting_observation"]'::jsonb,
    TRUE
  )
ON CONFLICT (user_id, slug) DO NOTHING;
