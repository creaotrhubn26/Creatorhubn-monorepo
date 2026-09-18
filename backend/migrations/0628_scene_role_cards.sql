-- Rollekort: det den enkelte får vite om sin egen oppgave i en scene.
--
-- Hvorfor dette ikke er «enda en tabell i produksjonsmodulen»:
--
-- Alt vi har fra før er laget for den som ALLEREDE kjenner planen —
-- casting_scenes, casting_shot_lists, storyboard-rammene, produksjonsdagene.
-- En statist på settet får i praksis to ting: en muntlig beskjed i kaoset
-- før opptak, eller en callsheet som sier «08:00 oppmøte, mørke klær».
-- Ingen av delene sier hva hen skal GJØRE.
--
-- Det koster penger: en statist som gjør feil ting koster en ny tagning, og
-- en ny tagning koster hele settet — ikke bare statisten.
--
-- Kortet er derfor bygget rundt fire spørsmål, og bare de fire:
--
--   hvor jeg står      position, mot plantegningen for scenen
--   hva jeg gjør       action, én setning i imperativ
--   når                cue — hva som er signalet mitt
--   hvordan det ser ut frame_image_url, rammen jeg er med i
--
-- 🔑 Én rad per PERSON, ikke per scene. Det er hele poenget: den som åpner
-- lenken skal se sitt eget kort og ingenting annet. Regissøren ser scenen
-- som helhet; statisten ser sitt utsnitt. Samme data, to visninger.

CREATE TABLE IF NOT EXISTS scene_role_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,

  -- Scenen kortet hører til. Nullbar: en statist kan være kalt inn til en
  -- dag før scenene er brutt ned.
  scene_id VARCHAR(255),
  production_day_id VARCHAR(255),

  -- Personen. talent_id settes når hen finnes i registeret; navnet står
  -- uansett, fordi statister ofte ikke har profil.
  person_name VARCHAR(255) NOT NULL,
  -- extra | actor | crew
  person_kind VARCHAR(20) NOT NULL DEFAULT 'extra',
  talent_id UUID REFERENCES talents(id) ON DELETE SET NULL,

  -- Oppgaven. action er påkrevd: et kort uten handling er en callsheet.
  action TEXT NOT NULL,
  cue TEXT,
  -- {"x": 0.42, "y": 0.61} — normalisert, så plantegningen kan byttes
  -- uten at prikkene flytter seg.
  position JSONB,
  wardrobe TEXT,
  frame_image_url TEXT,
  call_time TIMESTAMPTZ,
  sort_order INTEGER,

  -- Den personlige lenken. Den ER legitimasjonen: har du token, ser du
  -- kortet. Derfor er den lang, unik og kan trekkes tilbake uten at kortet
  -- slettes — en statist som faller fra skal miste tilgangen, ikke historikken.
  token VARCHAR(64) NOT NULL,
  revoked_at TIMESTAMPTZ,

  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS scene_role_cards_token_idx ON scene_role_cards (token);
CREATE INDEX IF NOT EXISTS scene_role_cards_project_idx ON scene_role_cards (project_id, scene_id);
CREATE INDEX IF NOT EXISTS scene_role_cards_talent_idx ON scene_role_cards (talent_id)
  WHERE talent_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_scene_role_cards_updated_at ON scene_role_cards;
CREATE TRIGGER update_scene_role_cards_updated_at
  BEFORE UPDATE ON scene_role_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Plantegningen ligger IKKE her. Den hører til scenen, ikke til personen, og
-- casting_scenes.production_breakdown er allerede en JSONB-kolonne for
-- akkurat den slags oppsett:
--
--   production_breakdown -> 'blocking' -> { planUrl, camera: { x, y, rotation } }
--
-- En egen tabell for ett objekt per scene ville vært en tabell å holde i
-- synk uten å gi noe tilbake.
