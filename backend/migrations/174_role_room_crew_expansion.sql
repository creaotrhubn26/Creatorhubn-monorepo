-- Crew-utvidelse for The Role Room — fundament for å bygge crew-booking-
-- siden av plattformen per Outreach Plan side 7: "starter med casting men
-- utvider seg til crew-booking og innspillingsdagskoordinering".
--
-- Tre lag:
--   1. Utvid industry_targets med crew-spesifikke felt (union_membership,
--      crew_specialty, reel_url) så Daniel kan tracke crew som Tier-1-mål.
--   2. Legg til crew-spesifikke segments i outreach_templates
--      (CHECK constraint må ikke ramme — vi sjekker i backend, ikke DB)
--   3. Pre-seede 3 nye outreach-templates: DP, regissør og Filmforbund-
--      intro fra Outreach Plan side 7.

-- ── Del 1: Utvid industry_targets med crew-felt ────────────────────

ALTER TABLE role_room_industry_targets
  ADD COLUMN IF NOT EXISTS union_membership VARCHAR(40),
  ADD COLUMN IF NOT EXISTS crew_specialty VARCHAR(80),
  ADD COLUMN IF NOT EXISTS reel_url VARCHAR(500);

COMMENT ON COLUMN role_room_industry_targets.union_membership IS
  'Fagforenings-tilknytning — typisk "filmforbund" (crew), "nsf" (skuespiller), "ingen" eller annen';
COMMENT ON COLUMN role_room_industry_targets.crew_specialty IS
  'Crew-spesialisering for crew-segments: dp, sound, editor, production_designer, costume_designer, gaffer, script_supervisor, composer, vfx, crew_other';
COMMENT ON COLUMN role_room_industry_targets.reel_url IS
  'Lenke til reel/portefølje — kritisk for DP/regissør-outreach, de svarer ikke uten å kunne sjekke arbeidet';

CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_union
  ON role_room_industry_targets (user_id, union_membership)
  WHERE union_membership IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_specialty
  ON role_room_industry_targets (user_id, crew_specialty)
  WHERE crew_specialty IS NOT NULL;

-- ── Del 2: Pre-seede 3 nye outreach-templates for crew ──────────────

INSERT INTO role_room_outreach_templates (slug, title, segment, channel, language, description, body, variables, is_default)
VALUES
  (
    'dp-warm-message',
    'DP / foto — første melding',
    'other',
    'dm',
    'no',
    'Cinematographer/foto-folk svarer sjelden på cold outreach uten å kunne sjekke arbeidet ditt først. Denne meldingen leder med spesifikk anerkjennelse av deres siste reel og inviterer til kaffe rundt en konkret produksjon.',
    'Hei {{first_name}},

Så reel-en din etter {{recent_production}}. {{specific_shot_observation}}

Vi bygger The Role Room — en koordineringsplattform for norsk produksjon som starter på casting og utvider seg til crew-booking. Ikke et lager med portefølje-bilder — verktøy som tar shot-list fra brief til ferdig leveranse uten Excel-juks.

Jeg har ingen rolle å tilby i denne meldingen. Jeg vil høre hva som irriterer deg mest når en line producer bestiller deg i dag — og hva en plattform burde gjøre for at du sa "ja" raskere.

Kaffe i Grünerløkka eller på Vulkan, du velger. 20 minutter.

Daniel | The Role Room',
    '["first_name","recent_production","specific_shot_observation"]'::jsonb,
    TRUE
  ),
  (
    'director-collab-pitch',
    'Regissør — kollaborasjons-pitch',
    'other',
    'dm',
    'no',
    'Regissører bestiller crew (DP, lyd, klipp) men cluster ofte rundt faste samarbeidspartnere. Pitchen er "vi bygger verktøyet du bruker når du må prøve noen nye" — ikke "byttet ditt etablerte team".',
    'Hei {{first_name}},

{{recent_production}} var {{specific_observation}}. Tror jeg så det 3 ganger.

Spørsmål — når du må prøve en ny DP eller klipper du ikke har jobbet med før (samproduksjon, nytt prosjekt, eller eksisterende crew er utilgjengelig), hvordan funker den prosessen i dag? De fleste regissører jeg snakker med sier den biten er kaotisk — Facebook-grupper, anbefalinger via tekstmelding, mye magefølelse.

Vi bygger The Role Room — koordineringslag for norsk produksjon. Starter på casting og utvider til crew-booking. Mål: at "prøv noen nye" tar 20 minutter, ikke 2 uker.

Ikke pitche enda. Kun: hadde det hjulpet om vi hadde en kanal hvor du så verifiserte crew med reel + tilgjengelighet på shoot-datoer? Eller løser jeg feil problem?

Daniel | The Role Room',
    '["first_name","recent_production","specific_observation"]'::jsonb,
    TRUE
  ),
  (
    'filmforbund-intro',
    'Norsk Filmforbund — første mail (etter warm intro)',
    'union',
    'email',
    'no',
    'Norsk Filmforbund (crew-fagforening) er enklere å engasjere enn NSF — de har ikke konkurrerende plattform. Pitchen er crew-modul i samarbeid, ikke konkurranse. Per Outreach Plan side 7.',
    'Hei {{first_name}},

Takk for tiden. Det jeg vil fram til er ikke et standard salgs-pitch — det er en spørring om hvordan vi gjør crew-delen sammen.

Vi bygger The Role Room — en plattform som starter med casting men utvider seg til crew-booking og innspillingsdagskoordinering. Hele Norge i ett system.

For crew-delen er vi avhengig av Norsk Filmforbund. Vi vil ikke konkurrere med dere — vi vil bygge crew-modulen i samarbeid:

- Verifisering basert på medlemskap (Filmforbund-medlemmer blir verifiserte med medlemstegn)
- Tariffer alltid synlige i kontrakt-flowen (ingen undergraving av forhandlede satser)
- A1-erklæring og frilans-skatte-håndtering automatisert
- Crew-rolle-spesifikk arbeidstid-rapportering (HMS-compliance)

Kan jeg få 30 minutter for å vise dere det vi tenker, og høre hva som skal til for at dere kan anbefale det til medlemmene?

Daniel | The Role Room',
    '["first_name"]'::jsonb,
    TRUE
  )
ON CONFLICT (user_id, slug) DO NOTHING;
