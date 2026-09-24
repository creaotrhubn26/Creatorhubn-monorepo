-- Prøvetid som måler bruk, ikke kalenderdager. Og hvem brukeren logger inn med.
--
-- KLOKKA STARTER VED FØRSTE DISCOVERY-KJØRING, ikke ved registrering.
-- Registrerer noen seg torsdag og blir dratt inn i noe annet, er helga borte
-- før de har åpnet produktet. Da måler prøvetiden kalender, ikke om produktet
-- ble prøvd. Målt i vår egen base 2026-09-23: fire Discovery-kjøringer totalt,
-- null godkjente kandidater — selv den som bygde produktet kom ikke gjennom
-- kjeden. Sju dager fra registrering ville vært fire reelle dager.
--
-- trial_hard_expires_at er yttergrensen. Uten den ville en konto som aldri
-- kjørte Discovery ligget åpen i årevis.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_hard_expires_at timestamptz;

COMMENT ON COLUMN organizations.trial_started_at IS
  'Satt ved første fullførte Discovery-kjøring, ikke ved registrering.';
COMMENT ON COLUMN organizations.trial_ends_at IS
  'trial_started_at + 7 dager. NULL = klokka har ikke startet.';
COMMENT ON COLUMN organizations.trial_hard_expires_at IS
  'Registrering + 30 dager. Gjelder uansett om Discovery aldri ble kjørt.';

-- Finner organisasjoner som nærmer seg slutten, uten å skanne hele tabellen.
CREATE INDEX IF NOT EXISTS organizations_trial_ends_idx
  ON organizations (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

-- Hvem brukeren logger inn med.
--
-- users har i dag bare `password`. Ni av elleve rader har en verdi, og
-- /reset-passord/<token> er ikke bare «glemt passord» — det er lenken
-- velkomst-e-posten sender nye kunder for å sette sitt FØRSTE passord
-- (org-self-onboard-routes.ts). Med Google og LinkedIn som vei inn forsvinner
-- både den lenken og passordkolonnen som angrepsflate.
--
-- Kolonnen er nullable: eksisterende passordbrukere beholdes til de har logget
-- inn med en leverandør. Å tvinge alle over i én migrasjon ville stengt dem ute.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider text
    CHECK (auth_provider IN ('google', 'linkedin', 'password')),
  ADD COLUMN IF NOT EXISTS auth_provider_subject text,
  ADD COLUMN IF NOT EXISTS auth_provider_linked_at timestamptz;

COMMENT ON COLUMN organizations.trial_ends_at IS
  'trial_started_at + 7 dager. NULL = klokka har ikke startet.';
COMMENT ON COLUMN users.auth_provider_subject IS
  'Leverandørens stabile bruker-id (Google sub, LinkedIn sub). E-post kan endres; denne kan ikke.';

-- Samme leverandør-konto kan ikke knyttes til to brukere.
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_provider_subject_idx
  ON users (auth_provider, auth_provider_subject)
  WHERE auth_provider IS NOT NULL AND auth_provider_subject IS NOT NULL;

-- Eksisterende brukere med passord merkes som det, så koden slipper å gjette.
UPDATE users
   SET auth_provider = 'password'
 WHERE auth_provider IS NULL
   AND password IS NOT NULL
   AND password <> '';
