# Reknaren iOS — universell native app (iPhone + iPad)

**Mål:** en full native SwiftUI-app som speiler web-appen og holdes i sync, universell for
iPhone og iPad. Kept-in-sync er gratis fordi begge er **tynne klienter over samme REST-API**
(`https://ledgerly-coss.onrender.com`) — all regnskapslogikk bor server-side. «Sync» =
funksjonsparitet + samme data, ikke datareplikering.

## Arkitektur
- **SwiftUI, iOS 17+, Swift 6, strict concurrency** (samme policy som `ipad/`-appene). XcodeGen (`project.yml`).
- **Adaptiv navigasjon:** `NavigationSplitView` (sidebar + detalj) på iPad/stor bredde; kompakt
  `TabView`/stack på iPhone. Sidebaren speiler web-nav-seksjonene (Virksomhet / Salg / Innsikt /
  Avslutning & skatt / Mer).
- **MVVM:** `@Observable` view-modeller per skjerm, `APIClient` (actor) som eneste nettverkslag.
- **Modeller:** `Codable`-structs som matcher JSON fra API-et (bigint-øre kommer som String → egen
  `Money`-type som aldri bruker Double).
- **Auth:** magic-link. E-post → `POST /api/auth/request-magic-link` → bruker åpner lenken
  (Universal Link `…/auth/verify?token=…`) → appen fanger den, kaller `verify-magic-link`, lagrer
  Bearer-token i **Keychain**. Face/Touch-ID (LocalAuthentication) låser appen. `dev-login` for test.
- **MVA/BankID:** ID-porten-innlogging via `ASWebAuthenticationSession` (samme OIDC som web),
  redirect til app via Universal Link.
- **Kvittering-capture (mobil-killer):** kamera + `PHPicker` + **Share Extension** «Del til Reknaren»
  → laster opp til `POST …/documents` (samme OCR-pipeline). Dette er hovedgrunnen til native.
- **Push:** APNs → «N uavstemte», frister. Widget «uavstemt: N» (WidgetKit).

## Sync-modell (hvordan app + web holdes like)
1. **Én API-kontrakt.** Begge klienter kaller de samme endepunktene. Endres API-et, endres begge.
   Vi vedlikeholder en delt **endepunkt-oversikt** (denne mappa: `API.md`) som fasit.
2. **Ingen forretningslogikk i klienten.** Forslag, kontering, MVA, avstemming = server. Appen viser
   og sender. Da kan de aldri divergere på tall.
3. **Paritet-sjekkliste per skjerm** (under). En skjerm er «i sync» når den bruker samme endepunkt
   og viser samme felt som web.

## Skjerm-inventar (fra web-nav) + fase-rekkefølge
Prioritert etter mobil-verdi (capture + avstemming først, tunge desktop-skjermer sist).

**Fase 0 — fundament (dette PR-et):** project.yml, app-entry, `APIClient`, `Session` (Keychain +
Bearer), `Money`, adaptiv `RootView`/sidebar, `LoginView` (magic-link), **Oversikt** mot ekte API.

**Fase 1 — mobil-killer (capture + avstemming):**
- Bilagsinnboks (`documents`) + **kamera/Share-capture** → upload
- Bank og avstemming (`bank`): transaksjoner m/ «hva dette kan være», Finn kvittering,
  «betalte du privat?», Kvitteringer uten betaling — akkurat det vi nettopp bygde
- Oversikt (fra Fase 0)

**Fase 2 — daglig drift:** Salg og faktura, Betal leverandører, Spør virksomheten, Framover, Frister.

**Fase 3 — avslutning & skatt:** Månedsavslutning, MVA (m/ ID-porten), Skatt og reserver,
Anleggsmidler, Årsavslutning.

**Fase 4 — proff/mer:** Rapporter, Hovedbok, Bilagsjournal, Prosjekter, Integrasjoner, Virksomhet,
Skann e-post, Avtaler, Svindelkontroll, Faste utgifter, Lært praksis, Skatteassistent.

## Reuse fra `ipad/`
- `project.yml`-mønster (bundleIdPrefix `com.creatorhubn`, team `9TAUZCPK95`, iOS 17, Swift 6).
- `APIClient`-actor-mønsteret (URLSession-wrapper, async throws).
- Bygg/kjør via **XcodeGen + idb** (se `reference_ipad_xcodegen_idb_setup`).
- ⚠️ SwiftUI type-dybde: unngå dype `some View`-stacker (kjent stack-overflow-felle) — bryt opp i
  under-views (se `feedback_swiftui_type_depth_device_stack_overflow`).

## Verifisering
Hver fase: `xcodegen generate` → bygg for «iPhone 16» + «iPad Pro»-simulator via idb → røyktest
innlogging + skjermens hoved-flyt. Ingen Double i penger. Universal Link + Share Extension testes
på ekte enhet før release.

## Ikke-mål (V1)
- Ingen offline-redigering (tynn klient; krever nett). Lesbar caching kan komme senere.
- Ingen egen regnskapslogikk i appen.
