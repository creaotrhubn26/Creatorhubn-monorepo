-- =====================================================================
-- 245_blog_seed_gdpr_pillar.sql
--
-- Seed første pillar-artikkel for The Role Room sin blog:
-- "GDPR-sjekkliste for skuespillerbyråer (12 punkter)".
--
-- cms_pages-schema er hybrid: NOT NULL user_id + title + slug + content JSONB
-- (migrate 141 + ev. tidligere). Vi setter alle påkrevde felter.
-- =====================================================================

BEGIN;

INSERT INTO cms_pages (
  user_id, title, slug, variant, content, published, status, is_published,
  published_at, updated_by, created_by
)
VALUES (
  '53391080-8437-471e-800b-8b0d01e8b465', -- daniel@creatorhubn.com (FK → users.id)
  'GDPR-sjekkliste for skuespillerbyråer: 12 punkter for trygg talent-administrasjon',
  'blog/gdpr-sjekkliste-skuespillerbyraer',
  'blog',
  jsonb_build_object(
    'title', 'GDPR-sjekkliste for skuespillerbyråer: 12 punkter for trygg talent-administrasjon',
    'subtitle', 'Hvordan norske byråer kan håndtere talent-data trygt etter Schrems II',
    'excerpt', 'En konkret 12-punkts sjekkliste for hvordan ditt skuespillerbyrå kan administrere talent-data på en GDPR-trygg måte — fra consent-registry til audit-trail og rett til å bli glemt.',
    'pillar', 'gdpr',
    'author', 'Daniel Qazi',
    'author_role', 'Founder, The Role Room',
    'published_at', '2026-06-07T12:00:00+02:00',
    'reading_minutes', 8,
    'cover_image', 'https://v3b.fal.media/files/b/0a9d5c72/EfKoMOfGThafHwHK_v_S0_b53ad15712ca4aee9662b7c4d51b7c2a.jpg',
    'cover_alt', 'Hender lukker en grå mappe merket TALENT DATA på et skandinavisk birch-skrivebord — redaksjonell GDPR-illustrasjon.',
    'tags', jsonb_build_array('GDPR', 'compliance', 'skuespillerbyrå', 'talent-administrasjon'),
    'body_markdown', $body$
Norske skuespillerbyråer sitter på sensitive data — portretter, helse-info, kontaktopplysninger til umyndige, audition-vurderinger som kan påvirke arbeidsmuligheter. Etter Schrems II er det ikke lenger trygt å lene seg på amerikanske leverandører for talent-administrasjon.

Vi har samlet en 12-punkts sjekkliste basert på arbeid med Stella Casting og Skuespillersenter i 2026. Bruk den som en intern audit — hvis du svarer "nei" på fire eller flere punkter, har du sannsynligvis GDPR-eksponering du bør lukke før neste kunde-pitch.

---

## 1. Hvor ligger talent-dataene fysisk?

Servere i EU/EØS = trygt grunnlag. Servere i USA = du trenger Standard Contractual Clauses og må vurdere konkret risiko per Schrems II. Sjekk leverandørens DPA (Data Processing Agreement) — den skal eksplisitt angi server-lokasjon.

**Test**: Be leverandøren skriftlig bekrefte hvilket datacenter dataene ligger i. "EU/EØS" som svar er ikke nok — krev konkret region (f.eks. AWS eu-north-1 Stockholm, Neon eu-west-2).

## 2. Har du en oppdatert behandlingsprotokoll (ROPA)?

GDPR Artikkel 30 krever at du fører en Record of Processing Activities. For et byrå skal denne dekke:

- Hvilke kategorier talent-data du behandler (kontakt, portfolio, helse, finansielt)
- Formålet med hver behandling (casting, fakturering, markedsføring)
- Hvor lenge dataene oppbevares per kategori
- Hvem som har tilgang (interne ansatte, eksterne leverandører, casting-partnere)
- Rettsgrunnlaget (samtykke, kontrakt, berettiget interesse)

**Test**: Kan du printe en oppdatert ROPA på 10 minutter? Hvis nei, du har en compliance-gap.

## 3. Er samtykke granulær per formål?

Et talent som signerer "jeg gir byrået lov til å bruke mine data" er ugyldig samtykke. Du må ha separate avkrysninger for:

- Casting (deling med produksjonsteam)
- Markedsføring (publisering på sosiale medier)
- Foto-portfolio (kommersiell bruk vs. visning til byrå-kunder)
- Helseopplysninger (kun hvis casting krever det)

Samtykket må kunne trekkes tilbake like enkelt som det ble gitt.

**Test**: Hvis et talent ringer i dag og sier "stryk meg fra alt markedsføring men behold meg for casting", kan du gjøre det på 10 minutter? Hvis nei, samtykke-systemet ditt er ikke granulært nok.

## 4. Er det audit-trail på hver visning?

Når en casting-director åpner talent-portfolioen din, skal det logges. Når en produsent ber om en self-tape, skal det logges. Hvis et talent en gang i fremtiden krever å vite hvem som har sett deres data, må du kunne svare presist.

**Test**: Be en kollega åpne en talent-profil. Kan du etterpå se akkurat når og av hvem? Hvis nei, audit-trail mangler.

## 5. Har du data-eksport på ett klikk?

Artikkel 15 (innsyn) og Artikkel 20 (dataportabilitet) gir talenter rett til å få ut alle data du har om dem i et strukturert maskinlesbart format. Du har 30 dager på å levere.

**Test**: Hvis et talent ber om eksport i dag, kan du levere CSV + JSON innen 5 virkedager? Hvis nei, du har sannsynligvis manuelt arbeid foran deg.

## 6. Har du rett til å bli glemt-flow?

Artikkel 17 gir talenter rett til å kreve at deres data slettes (med visse unntak — f.eks. lovpålagt regnskaps-data). Du må kunne:

- Slette portfolio + headshots + showreel fra alle systemer du har kontroll over
- Be alle aktive casting-partnere du har delt med om å slette sitt eksemplar
- Beholde minimum-data for regnskap (Artikkel 17(3)(b) gir unntak for rettskrav)

**Test**: Når sletter du sist en talent fra alle dine systemer? Hvis det ikke har skjedd på 6 måneder, sjekkflyten har sannsynligvis aldri blitt testet.

## 7. Er umyndige talenter behandlet riktig?

Talenter under 18 år krever foreldre-samtykke. Talenter under 13 år krever skriftlig foreldre-signering (norske særregler i Personopplysningsloven §5).

Vanligste mistak: 16-åring registrerer seg selv via byrå-app, og foreldrene oppdager det først når de ser barnet sitt på en plakat. Det er en klar GDPR-overtredelse selv om barnet "ga samtykke".

**Test**: Har du et felt for fødselsdato + automatisk flagg for under-18 + tvunget foreldre-signering-steg? Hvis nei, bygg det nå.

## 8. Bruker du krypterte e-poster for sensitive forespørsler?

Når en produsent ber om talenter med spesifikke fysiske egenskaper, sender du sannsynligvis det i en e-post. Vanlig e-post er ikke kryptert ende-til-ende — det er sammenliknbart med å sende et postkort.

For helseopplysninger, etniske data eller andre særlige kategorier (GDPR Artikkel 9) bør du bruke kryptert kanal (Signal, ProtonMail, eller TLS-S/MIME).

**Test**: Hvis du må sende et talent-bilde av et barn til en produsent — sender du det i ren Gmail eller via kryptert kanal? Hvis Gmail, vurder oppgradering.

## 9. Er DPA-er signert med alle leverandører?

Hver leverandør som behandler talent-data på dine vegne (CRM, e-post, lagring, casting-platform) skal ha en Data Processing Agreement med deg som angir:

- Hvilke data de behandler
- Hva de kan og ikke kan gjøre
- Hvor de lagrer dataene
- Hva som skjer ved kontraktsbrudd

**Test**: Kan du på 5 minutter liste alle leverandører + vise oppdatert DPA? Hvis nei, du har eksponering ved data-inntrengning hos en av dem.

## 10. Har du brudd-prosedyre (data breach notification)?

Hvis dataene dine kompromitteres (hacking, tapt laptop, feil-utsendt e-post med talent-liste), har du 72 timer på å varsle Datatilsynet og ofte talentene direkte.

Du trenger en konkret prosedyre som dekker:

- Hvem oppdager bruddet og varsler internt
- Hvem beslutter om Datatilsynet skal varsles
- Hvilken mal du bruker for talent-varsling
- Hvor det dokumenteres etter

**Test**: Hvis du oppdager et brudd kl. 14 i dag, har du planen klar til å sende Datatilsynet-varsel innen midnatt fredag? Hvis nei, du står med problemer.

## 11. Har du et tilgangskontroll-system med revoke?

Per-prosjekt-tilgang er nøkkelen. En produsent som castet TROLL i 2025 skal ikke fortsatt ha tilgang til hele talent-katalogen din i 2026.

**Test**: Kan du i dag se hvem som har aktiv tilgang til talent-katalogen, og revoke en konkret bruker på ett klikk? Hvis nei, du har skygge-tilganger som er compliance-risiko.

## 12. Er du forberedt på Schrems III?

Schrems II (2020) skapte usikkerhet rundt EU-US data-overføring. Maximilian Schrems og noyb fortsetter å føre saker. Schrems III er bare et spørsmål om når, ikke om.

Ved å holde all talent-data i EU/EØS-leverandører fra starten, blir du ikke truffet av neste Schrems-dom. Det koster noe (lavere konkurranse blant leverandører), men gir trygghet mot regulatorisk risiko.

**Test**: Hvis Schrems III kom i morgen og forbød all data-overføring til USA, ville din virksomhet fortsatt fungere normalt på fredag? Hvis nei, du har valgt feil leverandører.

---

## Hvordan The Role Room hjelper

Vi har bygget compliance-arkitekturen for norske byråer fra grunnen av:

- **EU-hosting** (Render Frankfurt + Neon eu-west-2)
- **Per-scope consent-registry** med granulær revoke
- **Audit-trail per visning** av portfolio + self-tape
- **Eksport på ett klikk** (CSV + JSON)
- **Rett til å bli glemt-flow** med cascade-sletting
- **Per-prosjekt-partnership-tilgang** med automatisk expiry (90 dager etter prosjekt-slutt)
- **Mindreårige-flagg** med planlagt BankID-integrasjon for foreldre-signering

Vi tar ikke over kundeforholdet ditt — talentene står i ditt byrå, du eier all consent. Vi er infrastrukturen som lar deg fokusere på relasjonsarbeidet uten å bekymre deg for compliance.

[Book en 30-min demo](/for-byraer#book-demo) — vi viser deg en konkret arbeidsdag på vår plattform.

---

*Oppdatert juni 2026 etter konsultasjon med advokat innen personvern. Generelt rådgivende — ikke juridisk rådgivning. Konkrete spørsmål bør drøftes med ditt eget personvernombud.*
$body$
  ),
  true,
  'published',
  true,
  '2026-06-07 10:00:00',
  '53391080-8437-471e-800b-8b0d01e8b465',
  '53391080-8437-471e-800b-8b0d01e8b465'
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  variant = EXCLUDED.variant,
  published = EXCLUDED.published,
  is_published = EXCLUDED.is_published,
  status = EXCLUDED.status,
  updated_at = now();

COMMIT;
