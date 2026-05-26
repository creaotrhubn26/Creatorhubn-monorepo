-- Live-på-sett-utvidelse for The Role Room — innspillingsdag-koordinering
-- per Outreach Plan side 7. Utvider crew-fundamentet fra migrasjon 174 med
-- de rollene som faktisk er på sett under opptak: AD-er, intimacy coordinator,
-- stunt, sikkerhet, HMUA, DIT, location manager osv.
--
-- Ingen nye kolonner trengs — segments er regulert i backend-VALID_SEGMENTS,
-- ikke i DB. Vi pre-seeder bare 2 nye outreach-templates her.

INSERT INTO role_room_outreach_templates (slug, title, segment, channel, language, description, body, variables, is_default)
VALUES
  (
    'first-ad-first-message',
    '1st AD — første DM',
    'other',
    'dm',
    'no',
    '1st AD-er svarer på "vis at du vet hva en dagsplan ser ut" — ikke generisk pitch. Pitchen er at vi bygger verktøyet de bruker når innspillings-dagen kollapser, ikke når alt går etter planen.',
    'Hei {{first_name}},

Så at du kjørte {{recent_production}}. {{specific_observation_call_sheet_or_shoot_day}}

Spørsmål — når en shoot-dag begynner å skli (skuespiller forsinket, scene må flyttes, statist mangler), hvordan koordinerer du i sanntid? Walkie + tekstmelding + manuell oppdatering av call sheet?

Vi bygger The Role Room — koordineringslag for norsk produksjon. Starter på casting og utvider til innspillingsdag-koordinering: sanntids-status på hvem som er på sett, automatisk varsel hvis statister/talent ikke har sjekket inn, og delt call sheet som oppdateres uten å re-printe.

Vil du ha 20 minutter til å fortelle hva som mangler? Jeg lytter, du snakker.

Daniel | The Role Room',
    '["first_name","recent_production","specific_observation_call_sheet_or_shoot_day"]'::jsonb,
    TRUE
  ),
  (
    'intimacy-coord-collab',
    'Intimacy coordinator — samtale om standard',
    'other',
    'dm',
    'no',
    'Sensitiv tone. Intimacy coordinators er en relativt ny rolle i Norge — de er ofte alene i bransjen, og verdsetter samtaler med folk som tar feltet på alvor. Ikke pitch — invitasjon til å forme hvordan plattformen tenker på dette.',
    'Hei {{first_name}},

Vi bygger The Role Room — koordineringsplattform for norsk produksjon — og vi tror intimacy-koordinering må være innebygd, ikke et add-on. Ikke noe som "også" er der.

Du jobbet på {{recent_production}}. {{specific_observation_about_their_practice}}

Jeg har ikke et ferdig produkt å vise deg. Jeg har en hypotese: at intimacy coordinators bør være obligatorisk å nevne i casting-briefen for visse scene-typer, at samtykke per scene må dokumenteres med versjonering, og at skuespillere må kunne trekke samtykke uten konsekvens. Men jeg vet ikke om jeg tar feil på noe vesentlig.

Kan jeg få 30 minutter for å lytte? Du forteller hva som faktisk er praksis i Norge i 2026. Jeg betaler kaffen.

Daniel | The Role Room',
    '["first_name","recent_production","specific_observation_about_their_practice"]'::jsonb,
    TRUE
  )
ON CONFLICT (user_id, slug) DO NOTHING;
