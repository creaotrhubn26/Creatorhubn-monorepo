-- Outreach-system for The Role Room — Tier-1-CRM utvidelse + template-bibliotek.
--
-- Bygger operativsystemet bak TheRoleRoom-Outreach-Plan.md: 18-måneders
-- 500-relasjoner-plan med 6 målgrupper (CDs → produsenter → unioner →
-- NFI → presse → byråer), 3-touch-regel, Generation 1/2/3-referral-kjeder.
--
-- To deler:
--   1. Utvid role_room_industry_targets med Outreach Plan-felter
--   2. Nytt outreach_templates-bibliotek med 6 templates fra dokumentet,
--      pre-seedet så Daniel slipper å taste dem inn

-- ── Del 1: Utvid industry_targets ──────────────────────────────────

ALTER TABLE role_room_industry_targets
  ADD COLUMN IF NOT EXISTS recent_productions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mutual_connection VARCHAR(200),
  ADD COLUMN IF NOT EXISTS referred_by_id UUID
    REFERENCES role_room_industry_targets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_generation INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS meeting_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS pilot_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS loom_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS thank_you_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ask_readiness INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN role_room_industry_targets.recent_productions IS
  'JSONB-array av siste produksjoner — brukes for personalisering: [{"title":"Sentimental Value","year":2025,"role":"casting director"}]';
COMMENT ON COLUMN role_room_industry_targets.referred_by_id IS
  'Hvis target ble warm-intro''ert: peker på den andre targeten som introduserte. Bygger Generation 1/2/3-graf.';
COMMENT ON COLUMN role_room_industry_targets.referral_generation IS
  '0=cold, 1=direkte intro, 2=intro fra en jeg ble intro''ert til, 3=tredje grad. Per Outreach Plan side 6.';
COMMENT ON COLUMN role_room_industry_targets.ask_readiness IS
  '3-touch-regelen: 0=no touch, 1=engaged offentlig, 2=ga value, 3=klar for ask';

CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_referred_by
  ON role_room_industry_targets (referred_by_id)
  WHERE referred_by_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_room_industry_targets_ask_ready
  ON role_room_industry_targets (user_id, ask_readiness DESC, next_action_due ASC NULLS LAST);

-- ── Del 2: outreach_templates-bibliotek ────────────────────────────

CREATE TABLE IF NOT EXISTS role_room_outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = global default-template (alle brukere ser de). Brukerkonto-spesifikke
  -- templates får user_id satt.
  user_id UUID,
  slug VARCHAR(80) NOT NULL,
  title VARCHAR(200) NOT NULL,
  segment VARCHAR(40) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'dm',
  language VARCHAR(8) NOT NULL DEFAULT 'no',
  description TEXT,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_role_room_outreach_templates_segment
  ON role_room_outreach_templates (segment, language);

-- Pre-seed 6 default-templates direkte fra TheRoleRoom-Outreach-Plan.md.
-- user_id = NULL betyr global default. is_default = TRUE markerer at de
-- skal vises som "Plan-anbefalt" i UI.

INSERT INTO role_room_outreach_templates (slug, title, segment, channel, language, description, body, variables, is_default)
VALUES
  (
    'cd-week-2-dm',
    'CD — første DM (uke 2)',
    'casting_director',
    'dm',
    'no',
    'LinkedIn-DM eller mail til Oslo-casting-director etter uke 1 med public engagement. Mål: 20-min kaffe.',
    'Hei {{first_name}},

Jeg så castingen din på {{recent_production}}. {{specific_observation}}

Vi bygger The Role Room — en castingplattform laget for norsk produksjon. Ikke en kopi av Backstage. Verifiserte profiler, BankID, automatisk Arbeidstilsynet-samtykke for barn, A-melding-eksport.

Jeg vil ikke pitche. Jeg vil høre hvordan du jobber i dag — hva som irriterer deg, hva som faktisk fungerer. 20 minutter, kaffe på {{neighborhood}}, jeg betaler.

{{next_week_or_after}}?

Daniel',
    '["first_name","recent_production","specific_observation","neighborhood","next_week_or_after"]'::jsonb,
    TRUE
  ),
  (
    'producer-week-2-email',
    'Produsent — første mail (uke 2)',
    'producer',
    'email',
    'no',
    'Mail eller LinkedIn til kommersiell-produsent. Mål: tillatelse til å sende 2-min Loom.',
    'Hei {{first_name}},

Så at {{company}} nylig wrappet {{recent_production}}. Kort spørsmål — når dere har kommersiell-casting med barn, hvordan håndterer dere Arbeidstilsynet-forhåndssamtykke i dag? De fleste produsenter jeg snakker med sier det er den enkeltvis mest irriterende delen av produksjonen.

Vi bygger The Role Room — Norway-native casting + production OS. Vi auto-genererer forhåndssamtykke-søknaden, håndterer A-melding for statister, og hver talent er BankID-verifisert.

Ber ikke om møte enda. Bare spør: hvis jeg sender deg en 2-min Loom som viser hvordan det funker for barne-casting spesifikt — vil du se den?

Daniel | The Role Room',
    '["first_name","company","recent_production"]'::jsonb,
    TRUE
  ),
  (
    'union-nsf-intro',
    'NSF — institusjonell åpning (etter warm intro)',
    'union',
    'email',
    'no',
    'Første samtale med NSF-ledelse etter warm intro fra CD/produsent. Mål: posisjonere som komplementær til Skuespillerkatalogen.no.',
    'Hei {{first_name}},

Takk for at vi får snakke. Det jeg vil legge fram er ikke "bruk plattformen vår" — det er noe annet.

Vi vil være plattformen som beskytter norske skuespillere mot AI-utnyttelse, falske casting-svindel og utrygge praksiser rundt barneskuespillere. Vi trenger NSFs veiledning på hvordan vi gjør dette på en måte som respekterer fagforenings-prinsipper.

Hva ville et samarbeid se ut som for dere?

Konkret kan vi tilby: gratis verifiserte institusjonelle kontoer for alle NSF-medlemmer, et felles "Safe Casting"-tillitsmerke på NSF-tilpassede casting calls, og forpliktelse til at vi aldri undergraver NSF-tariffavtaler. Til gjengjeld håper vi NSF kan vurdere å promotere oss i medlemskommunikasjon, og at vi kan samproduusere en Rushprint-artikkel om casting-sikkerhet.

Daniel | The Role Room',
    '["first_name"]'::jsonb,
    TRUE
  ),
  (
    'nfi-data-share',
    'NFI — data-deling, ikke pitch',
    'institution',
    'email',
    'no',
    'Mail til NFI program-staff. Mål: 15 min på produsent-roundtable for å presentere data, ikke pitche.',
    'Hei {{first_name}},

Vi har samlet inn første runde med data om norsk casting: median tid-til-cast, fillrate, fordeling per region. Tenkte dette kan være nyttig for {{nfi_program}}.

Vi har ikke noe å selge til NFI. Men hvis dere har et produsentmøte hvor benchmarking av casting-arbeidsflyt kan være interessant — gjerne 15 minutter, ikke pitch, bare data — vil vi gjerne dele.

Vedlagt finner du PDF av Norwegian Casting Report (utkast).

Daniel | The Role Room',
    '["first_name","nfi_program"]'::jsonb,
    TRUE
  ),
  (
    'school-institutional-account',
    'Filmskole — gratis institusjonell konto',
    'institution',
    'email',
    'no',
    'Mail til dekan/programleder på filmskole. Mål: 15 min for å vise studentkonti til en lærer.',
    'Hei {{first_name}},

Vi tilbyr {{school_name}} gratis institusjonelle kontoer på The Role Room for alle studenter og fakultet ut 2027. Ingen kostnad, ingen forpliktelser.

Hvorfor: Studentene deres er den neste generasjonen norske skuespillere, regissører og produsenter. Vi vil at de skal lære å jobbe profesjonelt og trygt fra dag én — med verifiserte profiler, riktige kontrakter, GDPR-kompatibel håndtering av personopplysninger.

Det eneste vi spør om: 15 minutter for å vise det til en lærer eller karriereveileder.

Daniel | The Role Room',
    '["first_name","school_name"]'::jsonb,
    TRUE
  ),
  (
    'press-rushprint-guest-article',
    'Rushprint — guest-artikkel-pitch',
    'press',
    'email',
    'no',
    'Mail til Rushprint-redaktør. Mål: få trykket en 1.200-ords substantiv guest-artikkel.',
    'Hei {{first_name}},

Jeg har skrevet et utkast om {{topic}} basert på samtaler med {{interviewee_count}} norske castere og produsenter. 1.200 ord, klar til redigering.

Vil dette være relevant for Rushprint? Hvis ikke, ingen problem — jeg vil bare ikke pitche en idé som ikke passer.

(Artikkel vedlagt.)

Daniel | The Role Room',
    '["first_name","topic","interviewee_count"]'::jsonb,
    TRUE
  ),
  (
    'agency-channel-partner',
    'Byrå — kanal-partner-pitch (Q3 2027+)',
    'agency',
    'email',
    'en',
    'Mail til byrå-prinsipal etter at vi har leverage (12k+ verifiserte profiler). Mål: API-partnerskap + revenue share.',
    'Hi {{first_name}},

We''ve been watching {{agency_name}}''s work — {{recent_placement}}. Respect.

A blunt question: We''re going to be the largest verified casting platform in the Nordics by end of 2027. You can fight us, ignore us, or partner with us.

The partnership: API access for your agency to submit your roster to our casting calls, branded "Repped by {{agency_name}}" tags on every profile, revenue share on every booking that originates from a CD on our platform. You keep your agency relationships; we extend your reach.

30 minutes to discuss?

Daniel | The Role Room',
    '["first_name","agency_name","recent_placement"]'::jsonb,
    TRUE
  )
ON CONFLICT (user_id, slug) DO NOTHING;
