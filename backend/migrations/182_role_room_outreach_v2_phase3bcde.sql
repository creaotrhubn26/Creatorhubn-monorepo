-- Outreach Plan v2 — gjenstående Fase 3-templates (NRK/TV2 + Rushprint + Kampanje).
--
-- Siste runde med v2-default-templater. Dekker:
-- - Fase 3B: NRK + TV2 som integrasjonspartnere (API-tilgang, ikke
--   kunder). Inngangen er innovasjons-/teknologi-avdelingene, ikke
--   programredaksjonene. 6-12 mnd å lukke — start tidlig.
-- - Fase 3E: Fagpresse. Rushprint = filmbransjen (spillefilm-vinkel).
--   Kampanje = bedriftsproduksjon/kommersielt innhold/byrå-vinkel.
--   Begge: send ferdigskrevet manus, ikke pitchet idé.

INSERT INTO role_room_outreach_templates
  (slug, title, segment, channel, language, description, body, variables, is_default)
VALUES
  (
    'nrk-tv2-integration-v2',
    'NRK / TV2 — integrasjonspartner (Fase 3B v2)',
    'institution',
    'email',
    'no',
    'NRK + TV2 er ikke kunder — de er distribusjonspartnere vi integrerer mot. v2-ramme: tilby API-tilgang slik at produksjonsselskaper som leverer til dem kan sende leveranseinfo, scheduling, kontrakter via Role Room. Bedre koordinering med eksterne produsenter. Innsyn i pipeline. Inngangen er innovasjons-/teknologi-avdelingene (NRK Innovation, TV2 digital-/tech-team), IKKE programredaksjonene. LinkedIn er bedre enn e-post for å finne navnene.',
    'Hei {{first_name}},

Jeg kontakter deg på {{department}}-siden av {{broadcaster}} fordi vi bygger noe som vil treffe deres pipeline med eksterne produsenter direkte.

The Role Room er et operativsystem for norsk film- og innholdsproduksjon. I dag bruker pilot-produksjonsselskaper det for casting, produksjonsstyring, økonomi og leveranse-koordinering.

Konkret integrasjons-forslag mot {{broadcaster}}:

· API-tilgang slik at produksjonsselskaper som leverer til dere kan sende leveranseinfo, scheduling og kontrakter direkte via Role Room — i stedet for e-post + Excel.

· Bedre koordinering med eksterne produsenter (status-sync, milestone-rapportering, kompetent eskalering).

· Anonymisert innsyn i pipeline av idéer/prosjekter som modnes mot {{broadcaster}}-format — slik at programutvikling kan se hva som er underveis i markedet.

Vi vet at dette ikke er en samtale som lukker raskt. Spørsmålet er om {{department}} har plass for en eksplorativ samtale på 30 minutter, slik at vi kan kalibrere veikartet mot hva som faktisk hjelper dere.

Daniel | The Role Room',
    '["first_name","broadcaster","department"]'::jsonb,
    TRUE
  ),
  (
    'rushprint-guest-article-v2',
    'Rushprint — ferdigskrevet gjesteartikkel (Fase 3E v2)',
    'press',
    'email',
    'no',
    'Rushprint = fagpresse for filmbransjen. v2-tilnærming: pitch IKKE en idé — send ferdigskrevet manus. Bedre vinkel for Rushprint: "støy-eliminering" i norsk produksjon, ikke produkt-PR. Eksempler på vinkler: "Hvorfor norsk produksjon trenger ett system, ikke ti" / "Fra idé til sett: hva som mangler i norsk produksjonsverktøy". Ikke promotering av Role Room — bransje-essay.',
    'Hei {{first_name}},

Jeg har skrevet et essay som passer Rushprints filmbransje-profil. Vinkel: {{essay_angle}}.

Det handler ikke om Role Room. Det handler om hvorfor norsk produksjon i 2026 fortsatt koordinerer i Excel + e-post + WhatsApp + Facebook — og hva det koster bransjen i sløsing av kreativ kapasitet.

Jeg legger ved hele manuset ({{word_count}} ord) som vedlegg. Det er ferdig — Rushprint kan publisere som det er, eller jeg justerer etter deres tilbakemelding.

Bakgrunn: jeg bygger The Role Room — et OS for norsk film- og innholdsproduksjon. Det er det praktiske utgangspunktet for hva jeg skriver om, men essayet selger ingenting. Om Rushprint vil ha en byline-disclaimer er det helt greit.

Vil dere vurdere det? Ingen frist fra min side.

Daniel | The Role Room',
    '["first_name","essay_angle","word_count"]'::jsonb,
    TRUE
  ),
  (
    'kampanje-bra-byraa-v2',
    'Kampanje — bedriftsproduksjon/byrå-vinkel (Fase 3E v2)',
    'press',
    'email',
    'no',
    'Kampanje = fagpresse for markedsføring og byråverden. v2-vinkel: bedriftsproduksjon og kommersielt innhold, IKKE spillefilm (det er Rushprints territorium). Tematisk: produksjonseffektivitet, content marketing, hvordan AI endrer arbeidsflyt for byråer og innholdsprodusenter. Ferdigskrevet manus, ikke pitchet idé.',
    'Hei {{first_name}},

Jeg har et essay som matcher Kampanjes byrå-/markedsføringsprofil. Vinkel: {{essay_angle}}.

Konteksten: norske byråer og innholdsprodusenter jobber i dag på tvers av 6-8 verktøy per klient (Meta + Google + LinkedIn + TikTok + Notion + Slack + e-post + Excel). Essayet handler om hva det koster — kreativ kapasitet, klient-tillit, margin — og hvor AI-laget faktisk forskyver det, ikke bare hva som er hype.

Manuset er ferdig ({{word_count}} ord) og ligger som vedlegg. Kampanje kan publisere som det er eller justere etter feedback.

Min bakgrunn: jeg bygger The Role Room — et OS som blant annet samler ads, content og klient-samarbeid for frilans-innholdsprodusenter. Det er det praktiske utgangspunktet, men essayet selger ikke verktøyet. Byline-disclaimer er greit.

Interessert? Ingen tidsfrist.

Daniel | The Role Room',
    '["first_name","essay_angle","word_count"]'::jsonb,
    TRUE
  )
ON CONFLICT (user_id, slug) DO NOTHING;
