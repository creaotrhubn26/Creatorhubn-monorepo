# SenseAid Explore (lydguide-POC, iPhone)

Appen heter «SenseAid Explore» (besluttet av Daniel 18.09.2026); Xcode-prosjektet og
mappen heter fortsatt `Reiseguide`. Native iPhone-app i SwiftUI (iOS 17+) for POC-en «Interaktiv reiseguide med
tilgjengelighet». Designet er Konsept 2 «Dark Mode / Premium» etter
UI-spesifikasjonen av 18.09.2026. Backend er `/api/guide/*` i Creatorhubn-
backend (`backend/server/reiseguide-routes.ts`, migrasjon 0629 og 0630).

## Bygge

```bash
brew install xcodegen swiftlint
cd ipad/Reiseguide
xcodegen generate
open Reiseguide.xcodeproj
```

Lokal backend: kjør `npm run seed:reiseguide` i `backend/` mot en database med
migrasjon 0629 og 0630, start backend, og sett miljøvariabelen
`REISEGUIDE_API_BASE_URL=http://localhost:5000` i schemet (kun DEBUG). Uten
overstyring brukes produksjons-URL-en fra `project.yml`.

## Struktur

```
Reiseguide/
  App/            ReiseguideApp (inngang, tabs, miniavspiller), AppEnvironment
  Core/           GuideModels (API-kontrakt), GuideAPIClient, AreaStore (cache),
                  AppSettings (UserDefaults), LocationService, Geo, L10n,
                  VisitLog (besøkslogg, kun lokalt), RelatedPlaces, QuizSession, DeepLink
  DesignSystem/   AppColor/AppSpacing/AppTypography + Components (knapper, chips, kort)
  Features/       Explore, Map (+ liste), POIDetail, Player (AVPlayer + simulert tidslinje),
                  Paywall (mock), AfterVisit (quiz, stjerner, tips, deling),
                  MyPlaces (favoritter + logg), Settings
  Assets.xcassets Fargetokens fra spesifikasjonen (bgBase, accent, textPrimary …)
  Localizable.xcstrings  nb (kilde) og en; UI-språket følger språkvelgeren
ReiseguideTests/  Modell-dekoding mot ekte API-fixture, Geo, tekstingstidslinje,
                  besøkslogg, liknende steder, quiz og deep link
```

## Hva som virker nå, og hva som venter

- Forside, kart med filter og listevisning, detaljside med Om/Opplevelse/Praktisk,
  avspiller med teksting og synstolkingskort, mock-paywall, Mine steder og innstillinger
  kjører mot demo-dataene i backend.
- Etter besøket (når fortellingen er ferdig eller ved «Avslutt besøket»): stjernerangering
  (sendes anonymt til `POST /api/guide/pois/{slug}/rating`), kort quiz fra backend,
  tips til liknende steder i nærheten (samme kategori, kortest vei, regnet ut lokalt)
  og «Anbefal til en venn» med delingssiden `/api/guide/share/{slug}`, som åpner appen
  igjen via `senseaidexplore://poi/{slug}`. Besøkene lagres i loggen under Mine steder
  med dato og klokkeslett, kun på telefonen.
- Lydfiler finnes ikke ennå (steg 2: manus, TTS, Soniox). Avspilleren viser
  «Lyden er ikke klar ennå» og kjører en simulert tidslinje med anslått teksting
  fra manuset. Når backend leverer `audio.url` og `captions.cues`, brukes de
  automatisk.
- Bilder finnes ikke ennå (fotorettigheter). Plassholder vises.
- Bakgrunns-geofencing (auto-start når man går inn i radius, PoiEngine) er steg 4.
- Universell utforming: alle kontroller har VoiceOver-etiketter, Dynamic Type
  brukes overalt, treffområder er minst 44 pt, listen er alternativ til kartet,
  «Reduser bevegelse/gjennomsiktighet» og «Øk kontrast» respekteres.

Koden er skrevet uten tilgang til Xcode og kompileres første gang i CI
(`.github/workflows/ipad-capture-ci.yml`, jobben «Reiseguide»).
