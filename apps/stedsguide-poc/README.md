# Stedsguide (POC)

Interaktiv, universelt utformet lydguide for severdigheter. Du er på reise i
et land du ikke kjenner, ser en severdighet – og får en fortelling på øret,
på ditt språk, med teksting på skjermen og synstolking for blinde.

**Status:** POC (proof of concept). Alt kjører i nettleseren på mobil, uten
backend. Kjøp er simulert. Innholdet er redaksjonelt utkast for 7 norske
severdigheter.

## Hva POC-en viser

| Krav fra briefen | Løsning i POC-en |
| --- | --- |
| Kart over hvor du er, nærmeste severdighet, søk i nærheten | Leaflet + OpenStreetMap, `watchPosition`, «Nærmeste severdighet»-ark under kartet, søk på navn/sted i alle språk. Liste-fane = tilgjengelig ekvivalent til kartet, sortert etter avstand. |
| Trykk på severdighet → kort intro, lagre i «mine steder» | Detaljside med intro (på valgt språk), «Lagre i mine steder», egen «Mine steder»-fane. |
| Abonnement **eller** quick buy når du er i nærheten | Geofence på 300 m (`QUICK_BUY_RADIUS_M`): engangskjøp er låst utenfor, åpent innenfor. Abonnement (mnd/år) gir alt. Alt lagres lokalt, ingen betaling. |
| Så mange språk som mulig | UI på 11 språk (nb, en, de, fr, es, it, pl, uk, ja, zh, ar – inkl. RTL). Guide-innhold: nb + en for alle 7, Operahuset også de/fr/es. Manglende språk faller tydelig tilbake til engelsk. Tale via Web Speech API bruker enhetens stemmer (≈ 50 språk på iOS/Android). |
| Synstolking for blinde | Hvert segment har egen synstolkings-tekst som leses **før** fortellingen når «Synstolking» er på. «Beskriv stedet»-knapp leser en «her står du»-beskrivelse når som helst. |
| Teksting for hørselshemmede | Stor teksting av alt guiden sier, ord-markering (der nettleseren gir `boundary`-hendelser), visuell «guiden snakker»-indikator, vibrasjon ved ny del, full transkripsjon. |
| Universell utforming / WCAG | Se sjekklisten under. axe-skann (WCAG 2.1 AA) kjører i e2e-testene på alle skjermer. |
| Attraksjonen i fokus, «føle at du er der» | Spilleren har severdigheten øverst, fortellingen midt på, kontroller nederst i tommelrekkevidde. Mørk, rolig flate. |

## Kjør

```bash
cd apps/stedsguide-poc
npm install
npm run dev          # http://localhost:1430
```

Test på mobil: åpne dev-URL-en på telefonen i samme nett (`vite --host`), og
tillat posisjon. Uten posisjon vises demo-posisjon i Oslo sentrum.
**Innstillinger → Demo-posisjon** lar deg «stå ved» en severdighet uten å reise
dit – det er slik du tester quick buy-geofencen.

```bash
npm run typecheck
npm run test:unit    # vitest: geo, kjøpsregler, i18n-konsistens, innholdsdekning
npm run build
npm run test:e2e     # Playwright (iPhone 13-profil) + axe WCAG 2.1 AA på hver skjerm
# Forhåndsinstallert Chromium (CI/sandbox): PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
```

## Arkitektur

```
src/
  data/attractions.ts   7 severdigheter: posisjon, intro, sceneDescription, segments[{narration, audioDescription}]
  data/types.ts         Attraction / GuideScript / GuideSegment
  i18n/ui.ts            UI-strenger, 11 språk (typesjekket mot nb; test sjekker nøkler + plassholdere)
  i18n/index.ts         språkliste (endonym, BCP 47, retning), detectLanguage, t()
  lib/geo.ts            haversine, sortering, Intl-avstand, søk
  lib/entitlements.ts   quick buy (geofence) + abonnement – ren logikk, enhetstestet
  lib/speech.ts         Web Speech API-wrapper: stemmevalg, boundary → teksting, avbrudd
  lib/storage.ts        localStorage m/ try-catch
  hooks/usePosition.ts  Geolocation m/ demo-overstyring og statuser (locating/ok/denied/unavailable/demo)
  hooks/useNarrator.ts  sekvensering: [synstolking →] fortelling → neste del; fungerer som tekst+Neste uten tale
  state/prefs.tsx       språk, a11y-valg, lagrede steder, kjøp, demo-posisjon, fremdrift → <html lang/dir/data-*>
  components/           TopBar, MapView (Leaflet), NearbySheet, ListScreen, SavedScreen,
                        AttractionDetail (intro + kjøp), GuidePlayer (teksting + kontroller), SettingsDialog
```

Ingen router: `App.tsx` holder `view` (kart/liste/mine steder/detalj/spiller) og
flytter fokus til ny skjerms `<h1>` ved hver navigasjon.

## Universell utforming – sjekkliste

- **Struktur:** skip-lenke, `<main>`, `<nav>`, én `<h1>` per skjerm, fokus flyttes til den ved navigasjon (WCAG 2.4.3).
- **Språk:** `<html lang>` og `dir` følger valgt språk; guide-tekst har egen `lang` når manuset er på et annet språk enn UI-et (3.1.1/3.1.2).
- **Kart:** Leaflet-markører får `role="button"` + `aria-label` («Severdighet: X, 450 m»), er tastaturnavigerbare. Liste-fanen er fullverdig alternativ (1.1.1, 2.1.1).
- **Kontrast og tekst:** tokens med ≥ 4.5:1 i lys/mørk; egen høykontrast-modus (svart/hvit/gul); tekststørrelse normal/stor/ekstra stor via rem (1.4.3, 1.4.4).
- **Berøring/fokus:** alle mål ≥ 44 px; synlig fokusring i alle temaer (2.5.5, 2.4.7).
- **Bevegelse:** `prefers-reduced-motion` + manuelt valg slår av animasjon (2.3.3).
- **Skjermleser i spilleren:** status («Guiden snakker», «Pauset», «Guiden er ferdig») i `role="status"`; teksting er `aria-live="off"` så den ikke dobbeltleses oppå talen; synstolking som eget, merket avsnitt.
- **Ingen informasjon kun via farge:** lagret/kjøpt/valgt vises med tekst eller ikon i tillegg.
- **Innstillinger:** native `<dialog>` (fokusfelle + Esc), brytere som `role="switch"`.
- **Automatisk sjekk:** `e2e/smoke.spec.ts` kjører axe (wcag2a/aa, wcag21a/aa) på kart, liste, detalj, spiller (m/ og u/ synstolking) og høykontrast.

Det som **ikke** er verifisert i POC-en og må gjøres før lansering: manuell
test med VoiceOver (iOS) og TalkBack (Android), test med reelle brukere som er
blinde/svaksynte og døve/hørselshemmede, og teksting-timing med ekte
innspilte stemmer.

## Bevisste POC-forenklinger → veien til produkt

| Område | POC | Produkt |
| --- | --- | --- |
| Stemmer | Enhetens Web Speech-stemmer (gratis, varierende kvalitet, ord-markering kun i Chrome/Edge) | Forhåndsinnspilte eller nevrale stemmer (f.eks. Azure/ElevenLabs) med ordtidsstempler → presis teksting i alle nettlesere, offline-pakker per severdighet |
| Innhold | 7 severdigheter hardkodet i `attractions.ts`, oversettelser av modellen | CMS m/ redaksjonell kvalitetssikring per språk, faktasjekk, versjonering, «synstolking» som eget redaksjonelt felt |
| Kjøp | localStorage, ingen betaling | App Store/Play in-app purchase eller Vipps/Stripe på web; server-side entitlements; kvittering |
| Geofence | 300 m radius rundt punkt | Polygon per severdighet, «du nærmer deg»-varsel, bakgrunnsposisjon i native app |
| Kart | OSM-fliser online | Offline-fliser for turister uten data, indoor-posisjonering for museer |
| Plattform | Web (PWA-klar) | PWA først; native wrapper (Capacitor) for bakgrunnslyd, CarPlay/Watch-styring, bedre vibrasjon |
| Hørsel | Teksting + vibrasjon | Tegnspråkvideo (NTS) for utvalgte severdigheter, induksjonsslynge-kompatibel avspilling |
| Syn | Synstolking i tekst→tale | Taktile kart / haptisk retning mot severdigheten, lydfyr («du er 20 m fra inngangen, klokka 2») |
| Testing | axe + Playwright | Manuell WCAG-revisjon (uu-tilsynet-krav), brukertesting med Blindeforbundet og HLF |

## Innholdsmodell (for CMS-diskusjon)

```ts
interface GuideSegment {
  id: string;
  narration: string;        // det guiden sier
  audioDescription: string; // synstolking: det en seende ser akkurat her
}
interface GuideScript {
  intro: string;            // kort intro før kjøp
  sceneDescription: string; // «her står du» – leses av «Beskriv stedet»
  segments: GuideSegment[];
}
```

Hvert språk er et komplett `GuideScript`; en test sikrer at alle språk for en
severdighet har like mange segmenter og at ingen segmenter mangler synstolking.
