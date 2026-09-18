# Dokumentasjonsstandard for Leadgrid

**Gjelder fra:** 29. august 2026  
**Eier:** Leadgrid produkt og engineering

Denne standarden gjør dokumentasjonen til en kontrollert del av produktet, ikke
en rapport som sakte blir utdatert.

## 1. Én oppføring per brukerobserverbar funksjon

En funksjon skal ha en stabil ID i
[funksjonskatalogen](./03-funksjonskatalog.md). Del funksjonen når delene har
ulik tilgang, lagring eller modenhet. Eksempel: «Lead-detalj» er ikke én status
når statusendring lagres på serveren, notater lagres lokalt og filer bare vises
i demo.

Obligatoriske felt:

| Felt | Krav |
|---|---|
| ID og navn | Stabil ID og brukerens navn på handlingen. |
| Formål | Problemet funksjonen løser, i én konkret setning. |
| Inngang | Aktiv meny, fane, deep link, offentlig URL eller API. |
| Plattform | iPhone, iPad, Mac, Watch, Vision, widget, web, portal eller server. |
| Tilgang | Rolle, permission, entitlement, plan og eventuell admin-bypass. |
| Lagring | Server/tabell, enhetslokalt, ekstern leverandør eller ingen varig lagring. |
| Status | Ett begrep fra manualens felles statusspråk. |
| Begrensning | Det brukeren med rimelighet kan tro virker, men som ikke er komplett. |
| Bevis | Primær kildefil og helst API-/testreferanse. |

## 2. Skill fire spørsmål som ofte blandes

For hver funksjon skal dokumentasjonen skille mellom:

- **Nåbarhet:** finnes en aktiv inngang i dagens navigasjon?
- **Visuell ferdighet:** finnes en ferdig skjerm og interaksjonsdesign?
- **Persistens:** blir handlingen faktisk lagret eller sendt?
- **Håndhevelse:** verifiserer serveren identitet, tenant og tilgang, eller er
  sperren bare i klienten?

En ferdig skjerm uten persistens er «Demo/prototype» eller «Hybrid», aldri
«Aktiv» bare fordi knappen kan trykkes.

## 3. Kildehierarki

Ved konflikt gjelder denne rekkefølgen:

1. Montert serverrute og aktiv klientkall.
2. Aktiv navigasjon eller offentlig rute i appen.
3. Tilgangsvakt, tenant-oppslag og databasekontrakt.
4. Test som utøver flyten.
5. Kommentar i kildekoden.
6. Eldre README, skjermbilde eller plan.

Kommentarer og historiske gap-rapporter er spor, ikke alene bevis på dagens
funksjon.

## 4. Endringsregel

En endring som legger til, flytter, låser opp, fjerner eller endrer lagringen
til en Leadgrid-funksjon skal samtidig:

1. oppdatere funksjonskatalogens rad;
2. oppdatere brukerflyten i riktig domene;
3. oppdatere teknisk referanse hvis API, worker, tabell eller ekstern tjeneste
   endres;
4. oppdatere gap-dokumentet hvis en hybrid-, demo- eller legacy-status endres;
5. legge til dato og konkret kildebevis.

## 5. Minimumsverifisering

| Endringstype | Minimum |
|---|---|
| Tekst eller navigasjon | Bygg/typecheck og bekreftet aktiv inngang. |
| Klient + API | Kontrakttest eller en reell request med riktig responsform. |
| Persistens | Opprett, les tilbake, oppdater og tenant-negativ test. |
| Rolle/entitlement | Tillatt rolle, sperret rolle og direkte API-kall uten UI. |
| Offline/synk | Kø, retry, deduplisering og konfliktatferd. |
| Ekstern integrasjon | Manglende nøkkel, leverandørfeil, timeout og gyldig respons. |
| Destruktiv handling | Bekreftelse, eierskap, audit og gjenoppretting der det finnes. |

## 6. Statusendringer

Følgende overganger krever eksplisitt bevis:

- Demo/prototype → Hybrid: minst én reell delhandling er koblet.
- Hybrid → Aktiv: alle synlige primærhandlinger persisterer som beskrevet.
- Backend/API → Aktiv: en bekreftet sluttbrukerinngang er koblet.
- Aktiv → Aktiv · betinget: ny gate er dokumentert både i UI og på server.
- Legacy/ikke nåbar → Aktiv: inngangen er montert og verifisert.

## 7. Periodisk revisjon

Ved hver release bør en automatisk eller manuell kontroll sammenligne:

- `SidebarItem`, `MainTabView` og `PhoneMerTab` mot katalogen;
- `LeadgridFeature.allCases` mot tilgangstabellen i manualen;
- alle registrerte `leadgrid`, `lead-map`, Pondus, Doffin, Canvas og
  salgsledelse-rutemoduler mot den tekniske referansen;
- offentlige `/leadgrid/*`-ruter mot portal- og kommersielt-kapitlet;
- eksplisitte `TODO`, `mock`, `stub`, «kommer» og lokal `UserDefaults`-lagring
  mot gap-listen;
- testfiler og siste testresultat mot dokumentert verifikasjonsnivå.

## 8. Sikkerhet og personvern

Dokumentasjonen skal aldri publisere tokens, interne nøkler, ekte
kundekontaktdata eller følsomme opptak. Juridiske tekster skal merkes som
utkast eller juridisk godkjent. Kodekommentarer er ikke juridisk godkjenning.

Lydopptak er særskilt fail-closed og skal ikke dokumenteres som tilgjengelig
for en organisasjon før compliance-bekreftelsen og entitlementet er
verifisert. Se [GDPR-pakken](../../leadgrid-gdpr-lydopptak.md).

