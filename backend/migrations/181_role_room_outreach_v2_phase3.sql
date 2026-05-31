-- Outreach Plan v2 — Fase 3-templates (NSF, NFI, utdanning).
--
-- v2 redefinerer NSF, NFI og utdanningsinstitusjoner som partnere, ikke
-- konkurrenter. Disse 3 templatene reflekterer "integrer, ikke angrip"-
-- strategi og er kalibrert til de ulike institusjonenes oppdrag (NSF =
-- beskytte medlemmer + tariffer; NFI = norsk film blomstrer + tilskudd
-- effektivt; filmskoler = fremtidige produsenter lærer profesjonelle
-- verktøy fra dag én).
--
-- Migrasjon 179 deaktiverte v1-versjonene (union-nsf-intro, nfi-data-
-- share, school-institutional-account). Disse er v2-erstatningene.

INSERT INTO role_room_outreach_templates
  (slug, title, segment, channel, language, description, body, variables, is_default)
VALUES
  (
    'nsf-partner-v2',
    'NSF — partnerskap (Fase 3A v2)',
    'union',
    'email',
    'no',
    'NSF-pitch v2. Sendes IKKE som kald e-post — kun etter varm intro via produsent eller skuespiller på plattformen. v2-ramme: vi konkurrerer ikke med NSF, vi gjør deres oppdrag enklere (beskytte medlemmer, riktige tariffer, trygghet på sett). Konkret forslag baseres på det NSF sa i lytte-møtet, ikke det du planla.',
    'Hei {{first_name}},

Takk for et godt møte forrige uke. Som lovet — her er et konkret samarbeidsforslag basert på det du sa om {{nsf_main_pain_point}}.

Forslag til samarbeid mellom The Role Room og NSF:

1. Integrasjon med Skuespillerkatalogen — Role Room-produksjoner kan søke i Skuespillerkatalogen direkte, slik at NSF-medlemmer alltid er foretrukne.

2. NSF-tariff vises automatisk i hver casting på Role Room. Riktig honorering blir default, ikke noe man må huske å sjekke.

3. Co-branded "Trygg produksjon"-merke på produksjoner som følger NSF-standarder for casting og arbeidsforhold.

4. Halvårlig rapport til NSF basert på Role Room-data — anonymisert, aggregert, om tid-til-cast, lønnsdynamikk, regional fordeling.

5. NSF-medlemmer får tilgang gratis. Vi bygger ikke konkurrerende skuespillerdatabase — vi koordinerer rundt deres.

Hva vi ber om: NSF anbefaler Role Room som verktøy for produksjoner, og hjelper med å sette standardene som integreres i produktet.

30 minutter neste uke for å gå gjennom og justere?

Daniel | The Role Room',
    '["first_name","nsf_main_pain_point"]'::jsonb,
    TRUE
  ),
  (
    'nfi-partner-v2',
    'NFI — partner-/innovasjonspitch (Fase 3A v2)',
    'institution',
    'email',
    'no',
    'NFI-pitch v2. Samme tilnærming som NSF, men annet språk. NFI bryr seg om: norsk film blomstrer, tilskudd brukes effektivt, norsk innhold når publikum. NFI vil ikke offentlig anbefale et kommersielt produkt — men kan inkludere oss i innovasjonsprogrammer. Tilbudet bygger på dette, ikke på offentlig endorsement.',
    'Hei {{first_name}},

Vi bygger The Role Room — et operativsystem for norsk film- og innholdsproduksjon fra idé til distribusjon. Vi er i tidlig fase med produsenter som pilot-bruker det aktivt.

Vi ønsker ikke at NFI offentlig anbefaler et kommersielt produkt — det er ikke deres rolle. Det vi ønsker er å snakke om hvordan The Role Room kan tjene NFIs oppdrag mer direkte:

· Et system der NFI-tilskudd-mottakere kan rapportere fremdrift transparent, slik at saksbehandlere ser status uten å måtte be om det.

· "Klar til å søke finansiering"-modul som gjør at flere idéer modnes til komplette søknader — flere kvalifiserte søkere, ikke flere søknader.

· Anonymisert, aggregert data om norsk produksjon — NFI får innsikt i pipeline-helse uten å eie persondata.

· Distribusjons-/publikum-modul som direkte tjener NFIs oppdrag om at norsk innhold når publikum.

Konkret: vil NFI vurdere oss for innovasjonsprogrammer som {{innovation_program}}? Eller bare 30 minutter for å snakke om hvordan dette kan utvikles?

Daniel | The Role Room',
    '["first_name","innovation_program"]'::jsonb,
    TRUE
  ),
  (
    'education-institutional-pilot-v2',
    'Utdanningsinstitusjon — institusjonell pilot (Fase 3D v2)',
    'education',
    'email',
    'no',
    'Filmskole/BI/NTNU/Westerdals/Nordland kunst- og filmfagskole. v2-ramme: gratis institusjonell tilgang for hele 2027. Studenter blir framtidige produsenter — de tar verktøyet med seg ut. Institusjon får funksjonalitet de ikke har i dag. Vi får bredt opptak uten markedsføringskostnad. Senere monetisert via utdanningslisens. Ask: 15 min til én lærer eller karriereveileder.',
    'Hei {{first_name}},

Vi bygger The Role Room — operativsystemet for norsk film- og innholdsproduksjon. I dag bruker pilot-produksjonsselskaper det aktivt for casting, produksjonsstyring, økonomistyring og distribusjon.

Til {{institution}} har vi et konkret tilbud:

Gratis institusjonell tilgang til The Role Room for hele 2027 — ingen kostnad, ingen forpliktelse. Studentene får lære å jobbe med profesjonelle verktøy fra dag én. Fakultet får verktøy for prosjektoppfølging og portfolio.

Hvorfor vi tilbyr det:
· Studentene blir framtidige produsenter — det er bra for hele norsk bransje
· {{institution}} får funksjonalitet dere ikke har i dag, uten budsjett-implikasjoner
· Vi får bredt opptak; senere kan vi diskutere en utdanningslisens-modell

Det vi ber om: 15 minutter for å demonstrere for én lærer eller karriereveileder hos dere. Foretrekker du Zoom eller besøk?

Daniel | The Role Room',
    '["first_name","institution"]'::jsonb,
    TRUE
  )
ON CONFLICT (user_id, slug) DO NOTHING;
