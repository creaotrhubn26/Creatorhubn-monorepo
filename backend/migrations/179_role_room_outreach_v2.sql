-- Outreach Plan v2 — reflektere ny ramme i koden.
--
-- v1 posisjonerte The Role Room som castingplattform med Statist.no/
-- Skuespillerkatalogen som konkurrenter. v2 korrigerer dette til
-- produksjons-OS med "integrer, ikke angrip"-strategi.
--
-- Hva denne migrasjonen gjør:
-- 1. Markerer 7 v1-default-templates som is_default = FALSE — de finnes
--    fortsatt for historisk referanse, men vises ikke som standardvalg
--    lenger.
-- 2. Setter inn 4 nye v2-default-templates som matcher ny ramme:
--    - producer-os-pilot (Fase 1 — tier-1 produksjonsselskap)
--    - content-producer-os-dm (Fase 2A — frilans-innholdsprodusent)
--    - skuda-noda-partnership (Fase 2B — partnerskap først)
--    - foto-no-affiliate (Fase 3C — affiliate-vekstmotor)
-- 3. Lar produsenter-/utdannings-/NSF-/NFI-/pressetemplater stå inntil
--    de v2-rewrites — disse vil komme i senere migrasjon.

-- Steg 1: deaktiver v1-templates som is_default
UPDATE role_room_outreach_templates
   SET is_default = FALSE,
       updated_at = NOW()
 WHERE user_id IS NULL
   AND slug IN (
     'cd-week-2-dm',
     'producer-week-2-email',
     'union-nsf-intro',
     'nfi-data-share',
     'school-institutional-account',
     'press-rushprint-guest-article',
     'agency-channel-partner'
   );

-- Steg 2: legg til 4 nye v2-default-templates

INSERT INTO role_room_outreach_templates
  (slug, title, segment, channel, language, description, body, variables, is_default)
VALUES
  (
    'producer-os-pilot',
    'Produksjonsselskap — OS-pilot (Fase 1 v2)',
    'producer',
    'email',
    'no',
    'Tier-1 produksjonsselskap, første personlige e-post. Ramme: ikke castingverktøy, men produksjons-OS som fjerner Excel/e-post/WhatsApp-kaos. Tilbyr 6 mnd gratis pilot mot ærlig tilbakemelding. Maks 5 selskaper i pilot — gir status som medskaper, ikke kunde.',
    'Hei {{first_name}},

Så at {{company}} nettopp avsluttet {{recent_production}}. {{specific_observation}}

Et ærlig spørsmål — ikke en pitch: Hvordan holder dere oversikt fra første idé til ferdig produksjon? Excel + e-post + WhatsApp, eller noe annet?

Jeg spør fordi vi bygger The Role Room — et operativsystem for hele produksjonsflyten. Idé, manus, casting, produksjon, distribusjon — alt i ett system. Ikke en castingplattform. Et OS.

Vi er i tidlig fase og leter etter 5 produksjonsselskaper som vil være med å forme produktet. Gratis tilgang i 6 måneder mot ærlig tilbakemelding.

30 minutter, jeg kommer til dere?

Daniel | The Role Room',
    '["first_name","company","recent_production","specific_observation"]'::jsonb,
    TRUE
  ),
  (
    'content-producer-os-dm',
    'Innholdsprodusent — OS-DM (Fase 2A v2)',
    'agency',
    'dm',
    'no',
    'Frilans-innholdsprodusent. Kort DM/mail — innholdsprodusenter er travle og selvforklarende, for mye tekst dreper. Ramme: klient-godkjenningsflyt + ett OS i stedet for Canva+Buffer+Notion+Loom-stack. 30 dagers gratis prøve uten binding.',
    'Hei {{first_name}},

Så på arbeidet ditt for {{client}}. Spørsmål: hvordan administrerer du klient-godkjenningsflyt i dag? Loom + e-post + faktura i et separat verktøy?

Vi bygger The Role Room — et OS som samler klient-samarbeid, innholdsplanlegging, publisering og økonomisk oversikt i ett system. 495 kr/mnd, ingen binding.

Hvis du vil prøve gratis i 30 dager — ping meg. Hvis ikke, ingen problem.

Daniel | The Role Room',
    '["first_name","client"]'::jsonb,
    TRUE
  ),
  (
    'skuda-noda-partnership',
    'Skuda/NoDa — partnerskap (Fase 2B v2)',
    'skuda',
    'email',
    'no',
    'Skuda og NoDa er ønskede partnerorganisasjoner per produktdokumentasjon. v2-strategi: partnerskapsmøte FØR direkte studio-outreach, slik at deres anbefaling følger med. Ramme: ikke konkurrent — komplementært verktøy for medlemmer. Rabattert pris + co-marketing + casting-tips for medlemmer.',
    'Hei {{first_name}},

Vi har bygget en dansestudio-vertikal i The Role Room: time-/klassebooking, koreografi-planlegging, audition-håndtering, medlemshåndtering, formasjonstrening, skadelogg, øvingslogg.

Vi konkurrerer ikke med dere — vi vil at vårt verktøy skal være {{organization}}-medlemmers foretrukne plattform. Konkret tenker vi:

· {{organization}}-medlemmer får rabattert pris (eks. 20 % off)
· Co-marketing til medlemsbasen
· Innebygde dansere-til-oppdrag-tips for {{organization}}-medlemmer som finner casting-oppdrag

30 minutter for å vise dere det vi har bygget, og høre hva som skal til?

Daniel | The Role Room',
    '["first_name","organization"]'::jsonb,
    TRUE
  ),
  (
    'foto-no-affiliate',
    'foto.no — affiliate-partnerskap (Fase 3C v2)',
    'agency',
    'email',
    'no',
    'foto.no har overlappende kundebase (produksjonsselskaper, innholdsprodusenter, fotografer). Affiliate fungerer som både vekst-incentiv og inntektsstrøm. Toveis: rabatt på utleie til våre kunder + 30 dagers gratis Role Room til deres. Integrere utstyrsdata i produksjonsplan.',
    'Hei {{first_name}},

Vi bygger The Role Room — operativsystemet for film- og innholdsproduksjon. Våre kunder er nøyaktig deres kunder: produksjonsselskaper, innholdsprodusenter, fotografer.

Konkret forslag:
· Våre kunder får rabatt på foto.no-utleie (kommisjon til oss)
· Deres kunder får 30 dagers gratis Role Room (kommisjon til dere)
· Vi integrerer foto.no-utstyrsdata i produksjonsplanen — booking, kostnad, returdato

30 min for å vise det?

Daniel | The Role Room',
    '["first_name"]'::jsonb,
    TRUE
  )
ON CONFLICT (user_id, slug) DO NOTHING;
