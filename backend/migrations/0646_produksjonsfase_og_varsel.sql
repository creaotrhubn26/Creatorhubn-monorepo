-- «Si fra når en produksjon går fra utvikling til pre-produksjon.»
--
-- Nummerert 0646, ikke 0633, av én grunn: 0640–0645 ble kjørt mot produksjon
-- av en egen manuell workflow FØR denne rakk å kjøre. Kjøreren krever at det
-- som er applied utgjør et sammenhengende prefiks av repo-historikken, og med
-- 0633 liggende i hullet stoppet HELE backend-deployen:
--
--   public._migrations_applied repository history is not a contiguous prefix:
--   missing "0633_produksjonsfase_og_varsel.sql" while later migration(s) are
--   marked applied: "0640_reiseguide_poc.sql" … "0645_game_plan_fase8_features.sql"
--
-- Å flytte denne bak dem lukker hullet uten å skrive noe manuelt i produksjon.
--
-- Det er den overgangen som betyr noe for en skuespiller: i utvikling finnes
-- prosjektet bare på papir, i pre-produksjon begynner casting, opptaksplan og
-- innspilling å bli virkelige. I dag har casting_projects bare status='active'
-- for alt, så overgangen finnes ikke som data og kan derfor ikke varsles.
--
-- Tre ting, og de er bevisst adskilt:
--
--   phase            hvor produksjonen er. Sier ingenting om hvem som får vite.
--   announced_at     om produksjonen SKAL ut. NULL som standard: mange
--                    produksjoner er under NDA lenge etter at de er reelle, og
--                    et system som annonserer alt automatisk blir skrudd av.
--   varsel-tabellen  hvem som har bedt om å bli varslet, og hva som er sendt.
--
-- Kilde er med fra starten fordi den kommer til å bli flere: plattformen nå,
-- og etter hvert NFI-tildelinger og Filmforbundet.

ALTER TABLE casting_projects ADD COLUMN IF NOT EXISTS phase VARCHAR(24);
ALTER TABLE casting_projects ADD COLUMN IF NOT EXISTS phase_changed_at TIMESTAMPTZ;
ALTER TABLE casting_projects ADD COLUMN IF NOT EXISTS announced_at TIMESTAMPTZ;

-- Bare fasene flaten kan produsere. En skrivefeil skal ikke kunne lage en
-- sjette fase ingen skjerm vet hvordan den skal vise.
ALTER TABLE casting_projects DROP CONSTRAINT IF EXISTS casting_projects_phase_check;
ALTER TABLE casting_projects ADD CONSTRAINT casting_projects_phase_check
  CHECK (phase IS NULL OR phase IN ('utvikling', 'pre_produksjon', 'opptak', 'etterarbeid', 'ferdig'));

-- «Hva er annonsert og på vei?» er spørsmålet skuespillerlisten stiller.
CREATE INDEX IF NOT EXISTS casting_projects_annonsert_idx
  ON casting_projects (phase, announced_at DESC)
  WHERE announced_at IS NOT NULL;

-- Hvem vil vite. Opt-in: ingen får varsler de ikke har bedt om.
CREATE TABLE IF NOT EXISTS talent_production_alerts (
  talent_id UUID PRIMARY KEY REFERENCES talents(id) ON DELETE CASCADE,
  aktiv BOOLEAN NOT NULL DEFAULT TRUE,
  -- Tom liste = alle typer. Et filter som stilltiende utelukker produksjoner
  -- er verre enn ingen filter, så standarden er «alt».
  prosjekttyper TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hva som er sendt. Primærnøkkelen er hele duplikat-vernet: samme produksjon
-- varsles én gang per person, uansett hvor mange ganger fasen settes på nytt.
CREATE TABLE IF NOT EXISTS production_alert_sends (
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL,
  kilde VARCHAR(24) NOT NULL DEFAULT 'plattform',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (talent_id, project_id)
);
