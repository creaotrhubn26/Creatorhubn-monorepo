# Leadgrid produktmanual

**Kildesnapshot:** 29. august 2026  
**Omfang:** Leadgrid for iPhone, iPad og Mac Catalyst, Apple Watch, visionOS,
widgets/Live Activities, webflater, Admin Room, offentlige portaler og backend.  
**Sannhetskilde:** aktiv navigasjon, registrerte serverruter, datamodeller,
tilgangsvakter og tester i dette repoet.

Dette er inngangen til den levende dokumentasjonen for Leadgrid. Manualen
beskriver både hva brukeren kan gjøre og hva systemet faktisk gjør med dataene.
Den skiller derfor mellom produksjonskoblet funksjonalitet, tilgangsstyrte
moduler, hybride flater, demo/prototyper og serverfunksjoner uten bekreftet
brukerinngang.

## Les dette først

| Behov | Dokument |
|---|---|
| Forstå produktet, plattformene og hovedflytene | [Produkt- og plattformkart](./01-produkt-og-plattformkart.md) |
| Lære hvordan selger og leder bruker appen | [Brukerhåndbok](./02-brukerhandbok.md) |
| Slå opp én bestemt funksjon og dens reelle status | [Komplett funksjonskatalog](./03-funksjonskatalog.md) |
| Drifte organisasjoner, planer, kanaler og partnere | [Admin, drift og kommersielt](./04-admin-drift-og-kommersielt.md) |
| Forstå research, AI, workflows og integrasjoner | [AI, automatisering og integrasjoner](./05-ai-automatisering-og-integrasjoner.md) |
| Finne offentlige sider, webverktøy, portaler og faktisk routing | [Web og portaler](./09-web-og-portaler.md) |
| Finne API-familier, dataflyt, jobber og klienter | [Teknisk referanse](./06-teknisk-referanse.md) |
| Se begrensninger, delvis lagring, eldre kode og testbevis | [Status, gap og testdekning](./07-status-gap-og-testdekning.md) |
| Oppdatere dokumentasjonen uten at den driver fra koden | [Dokumentasjonsstandard](./08-dokumentasjonsstandard.md) |

## Statusspråk

Manualen bruker de samme statusene overalt:

| Status | Betydning |
|---|---|
| **Aktiv** | Nåbar fra dagens produkt og koblet til reell lagring eller reell tjeneste. |
| **Aktiv · betinget** | Aktiv, men skjult eller sperret av rolle, permission, entitlement, plan eller ekstern konfigurasjon. |
| **Hybrid** | Hovedflyten er reell, men én eller flere synlige delfunksjoner er lokale, demo-baserte eller uten full serverstøtte. |
| **Demo/prototype** | Rendrer eller simulerer funksjonen uten å gjøre en varig produksjonshandling. |
| **Backend/API** | Serverfunksjonen er montert, men denne gjennomgangen fant ingen bekreftet aktiv sluttbrukerinngang. |
| **Offentlig flate** | Markeds-, registrerings-, partner-, utvikler- eller klientportal som nås uten den native hovednavigasjonen. |
| **Legacy/ikke nåbar** | Kode finnes, men inngangen er erstattet, foreldreløs eller ikke montert i dagens navigasjon. |
| **Krever verifisering** | Koden indikerer funksjonen, men statisk inspeksjon alene beviser ikke en komplett ende-til-ende-flyt. |

Status er ikke det samme som produktkvalitet. «Aktiv» betyr at dataflyten er
koblet; det betyr ikke at alle feiltilstander, integrasjoner og enheter er
ende-til-ende-testet.

## Produktgrense

Leadgrid er arbeidsflaten for prospektering, feltsalg, CRM, oppfølging,
salgsledelse og salgsopplæring. Den må ikke blandes med:

- Admin Workspace, som er Daniels interne arbeidssted for støtteordninger,
  investorer, oppgaver, frister og produktarbeid.
- The Role Room / Creative Sync Workspace, som brukes mot casting-,
  produksjons- og markedsaktører.
- Generiske Creatorhub CRM-flater som kan gjenbruke de samme kundetabellene,
  men som ikke automatisk er en Leadgrid-inngang.

Backend kan dele identitet, organisasjon og `crm_customers` med andre deler av
plattformen. Dokumentasjonen klassifiserer likevel funksjonen etter hvor den
faktisk eksponeres og hvilket produktansvar den har.

## Dokumentasjonsløfte

En funksjon regnes som dekket når katalogen kan svare på:

1. Hva løser funksjonen?
2. Hvor finner brukeren den?
3. Hvem har tilgang, og hva kan låse den?
4. Hvilke data leses eller lagres?
5. Hvilken server- eller enhetstjeneste utfører handlingen?
6. Fungerer den offline, i demo eller bare med ekstern konfigurasjon?
7. Hvilke begrensninger eller åpne gap finnes?
8. Hvilken kildekode og hvilke tester underbygger beskrivelsen?

Nye funksjoner skal inn i katalogen i samme endring som funksjonen blir
brukernåbar. Se [Dokumentasjonsstandard](./08-dokumentasjonsstandard.md).

## Relatert eksisterende dokumentasjon

- [Kunde-onboarding for varslingskanaler](../customer-onboarding.md)
- [WhatsApp-maler](../whatsapp-templates.md)
- [GDPR-pakke for lydopptak](../../leadgrid-gdpr-lydopptak.md)
- [Historisk iPad-paritetsrapport, 19. juni 2026](../ipad-parity-gap-2026-06-19.md)

Paritetsrapporten er historisk og må ikke brukes som dagens status uten å
sjekke funksjonskatalogen. Flere av hullene som stod der er senere koblet på,
mens enkelte lokale/demo-baserte delhandlinger fortsatt finnes.
