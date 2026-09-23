# Leadgrid: varm start og plassering på kartet

Status etter 22. september 2026. Skrevet for å slippe å lese fire
pull requests for å vite hva som virker og hva som ikke gjør det.

## Hva som er bygget

**Varm start** (`leadgrid-discovery-warm-start.ts`). Et Discovery-søk gir
gjerne to hundre kandidater. Er prosjektet tomt, viser Discovery-flaten ett
kort: den best scorende kandidaten, tre grunner fra scoringen, og hva første
handling blir. Ett trykk godkjenner den som lead og legger handlingen som
oppgave med frist neste virkedag kl. 09.

«Varmest» er ikke bare høyest score. Innenfor 0,1 av beste score vinner den
vi kan *plassere på kartet* og *ta kontakt med*. Grunnlaget er målt, ikke
antatt: i næringskode 87.104 hadde én av fem virksomheter telefon eller
e-post i Enhetsregisteret, og den største (1 494 ansatte) hadde ingen av
delene.

**Plassering** (`leadgrid-lead-placement.ts`). Kartlaget filtrerer bort
koordinat 0,0, så en lead uten koordinater er usynlig på kartet uten at noe
sier fra. Kartfanen viser nå «N uten plassering» og kan slå opp adressene:

1. Kommunenummer fra Enhetsregisteret når leaden har organisasjonsnummer —
   da kan Storgata 1 i Oslo ikke treffe Storgata 1 i Bergen.
2. Entydig adressetreff: plasser.
3. Flere kandidater: ingenting skrives. Appen spør hvilken som er riktig.

Svaret lagres i `leadgrid_lead_placement_decisions` med nøkkel på normalisert
adresse, slik at neste lead på samme adresse plasseres uten spørsmål.

## Hva som IKKE er verifisert

**Ingenting av dette er kjørt mot en ekte Discovery-kjøring.** Enhetstestene
dekker logikken, kontrakttestene dekker rutene, men hele kjeden — søk →
kort → lead med pin → oppgave — er aldri kjørt gjennom i produksjon. Det
krever innlogging, og den kan bare et menneske gjøre.

**Migrasjon 0661 er ikke kjørt.** Tabellen for plasseringsavgjørelser
opprettes først når main deployes til Render. Før det feiler gjenbruk og
verifisering med manglende relasjon.

## Hva som mangler

| Mangel | Konsekvens | Hvorfor den står |
|---|---|---|
| «Ingen av disse» lagrer ingenting | Samme lead spørres igjen neste gang | Vi vet ikke hva svaret *var*, bare hva det ikke var. Å huske avvisningen krever en egen kolonne og et svar på hva vi skal gjøre med den |
| Læringen brukes bare til gjenbruk per adresse | Vi ser ikke mønstre på tvers: hvilke kilder som gir tvetydige treff, hvilke kommuner som går igjen | Datagrunnlaget må samle seg først. Kolonnen `source` finnes for nettopp dette |
| Varm start vises bare mens prosjektet er tomt | Senere kjøringer har ingen inngang — lista er igjen to hundre valg | Bevisst: et kort som maser er verre enn intet kort. Men et prosjekt med femti leads og en ny kjøring på tre hundre har samme problem |
| Discovery geokoder maks 120 adresser per kjøring | Godkjenner du flere, kan resten mangle koordinater | Taket beskytter mot å hamre Kartverket. Brikka i Kart fanger dem etterpå, men først når noen trykker |
| Web-appen har ingenting av dette | Discovery, varm start og plassering finnes bare på iPad | Discovery-flaten er aldri bygget for web |
| Onboarding fra domene dekker fire domener | creatorhubn.com, theroleroom.com, tidum.no og medside.no har håndbygde planer; alle andre klassifiseres regelbasert fra nettsideteksten | Håndbygde planer er bedre, men skalerer ikke. Regelbasert er fallbacken |
| Kontrastfunn i klassen «nearly passed» er ikke jaget | Enkelte tall og etiketter ligger like under 4,5:1 | Revisjonen melder dem; vi har prioritert «failed» først |

## Tilgjengelighetsrevisjonene

Sju revisjoner dekker Oversikt, Kart, Leads, Møter, Team, Leadbook og
Salgsledelse. De er ustabile i full suite på en bestemt måte: måles flaten
mens den er tonet ned bak systemets UI, feiler **all** tekst kontrast — også
hvit tekst på mørk bakgrunn. Full suite 22. september ga sju slike fall.

Tre årsaker er funnet og rettet så langt:

1. `XCUIApplication()` binder seg til testvertens app-oppføring og peker på
   en avsluttet instans etter flere launch/terminate. Revisjonen kjøres nå
   mot et håndtak hentet på bundle-id.
2. `activate()` spiller av app-switcher-animasjonen. Måles flaten mens den
   animerer, rapporteres hver knapp i halv størrelse. Vi venter til rammen
   står stille i to avlesninger.
3. `state == .runningForeground` er ikke nok: flaten kan være tonet ned
   likevel. Vi kaller `activate()` ubetinget, og forkaster et resultat der
   åtte eller flere funn er kontrast — en revisjon som sier at alt feiler,
   har målt feil skjerm.

Punkt 3 er den nyeste og er ikke bekreftet i full suite ennå.

## Åpne spor utenfor koden

- **leadgrid.no ligger bak main.** Sist promotert 19. september. Promotering
  er en manuell kommando: `gh workflow run promote-brand.yml -f brand=leadgrid.no`
- **The Role Room-prosjektet i Leadgrid er tomt.** Ingen discovery-profiler,
  kontakter, produkter eller deals. Filmforbundet (971480238) og
  Skuespillerforbundet (871096422) er researchet, men ikke lagt inn — det
  krever innlogging.
- **Prisliste mangler.** Tilbudsmodulen kan ikke lage et tilbud uten
  produkter i prosjektet.
