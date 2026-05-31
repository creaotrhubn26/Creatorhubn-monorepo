# Workflow gap-analyse — Fredrik (profesjonell fotograf)

Detaljert kartlegging av friction-punkter når en ikke-teknisk profesjonell fotograf skal bruke CreatorHub-plattformen til å levere bryllups-, event- og portrett-shoots (kontrakter, klient-gallerier, fil-leveranser, fakturering, BTS, redigering).

**Persona Fredrik**:
- Profesjonell fotograf, ikke utvikler
- Bruker Mac, kan Lightroom + Photoshop på vanlig nivå
- Mål: levere 10-30 prosjekter i året (bryllup, portrett, kommersielt) — kontrakt, shoot, gallery, betaling
- Lavt teknisk vokabular: "endpoint", "orchestration", "integration test", "session ID" = uforståelig
- Forventer at ting fungerer som i Pixieset, Dropbox, Lightroom, Stripe Checkout

Gaps er klassifisert i tre nivåer:

- ❌ **BLOCKER** — Fredrik kan IKKE få jobben gjort uten håndholding
- ⚠️ **FRICTION** — Fredrik kommer i gang men sliter, undrer "hvorfor er det sånn?"
- 🎯 **NICE** — vil vesentlig forbedre opplevelsen

Estimater for arbeidsomfang: **S** (≤1t), **M** (1-4t), **L** (4t+).

Filreferanser bruker monorepo-root.

---

## ❌ BLOCKERS (5)

### B1. "Integration Test"-tab synlig i produksjons-UI for fotograf
**Hva Fredrik møter**: I tab-baren ved siden av "Innstillinger" og "Administrasjon" står det **"Integration Test"** med en skiftnøkkel-ikon. Han klikker på den og får opp utvikler-UI med dependency-checks og system-status.
**Hvorfor det er rart**: Hva skal en fotograf med "integration test"? Han tror han har gjort noe galt og ringer support.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:347` — `{ id: 'integration-test', label: 'Integration Test', icon: <Build /> }`
**Fix (S)**: Skjul tabben bak en `featureFlag.devTools`-sjekk eller `import.meta.env.DEV`. Skal aldri rendres i produksjons-build for fotograf-profesjonen.

### B2. Onboarding-wizard lagrer "stille" om backend feiler
**Hva Fredrik møter**: Han fyller inn navn, bedrift, profesjon, brand-farge → klikker "Ferdig" → wizard lukkes og han havner på dashboardet. Men business-info-endepunktet feilet, så ingen ting ble lagret. Neste gang han logger inn må han gjøre hele wizarden på nytt — eller verre, dashboardet viser tomme felter og han tror han har mistet alt.
**Hvorfor det er rart**: En "Ferdig"-knapp som tilsynelatende fungerer, men ikke gjorde noe — det er et brudd med all bruker-intuisjon.
**Fil**: `frontend/client/src/components/onboarding/IndividualOnboardingWizard.tsx:100` — `.catch(() => null); // ikke fail-stopper hvis endpoint ikke finnes`
**Fix (S)**: Fjern `.catch(() => null)`. Vis Snackbar/Alert "Kunne ikke lagre bedriftsinfo — prøv igjen" hvis mutationen feiler. La handleFinish kun lukke wizarden ved success.

### B3. Hardkodet "Du må kjøpe Role Room 495 kr/mnd" på første dag
**Hva Fredrik møter**: Steg 4 i onboarding viser "Anbefalt tier: Innholdsprodusent (The Role Room) — 495 kr/mnd". Han har akkurat registrert seg for å prøve CreatorHub, ikke for å betale 495 i måneden. Hvis han ikke skjønner at dette bare er en anbefaling, klikker han Avbryt og forsvinner.
**Hvorfor det er rart**: Førstegangs-bruker bør møte verdi før pris. Anbefalingen er heller ikke profesjons-spesifikk — fotograf, videograf og musikkprodusent får alle den samme rene 495 kr-anbefalingen.
**Fil**: `frontend/client/src/components/onboarding/IndividualOnboardingWizard.tsx:41-55` — `TIER_RECOMMENDATIONS` returnerer identisk pakke for tre av fire profesjoner.
**Fix**:
- **Kort sikt (S)**: Endre steg 4-tittel til "Anbefaling for senere" + "Hopp over for nå (gratis under prøveperioden)"-knapp som er primær handling.
- **Lang sikt (M)**: Tier-anbefaling vises FØRST etter at Fredrik har opprettet sitt første prosjekt og ser hva han faktisk får for pengene.

### B4. Orchestration-feil rapporteres som "completed" til brukeren
**Hva Fredrik møter**: Han klikker "Ny klient"-orkestrering (BREG-validering → Google Drive-mappe → Kontrakt → Showcase → Velkomstchat). API-et er nede. Etter 2 sekunder sier UI-et "✅ Fullført — step1, step2, step3". Han tror alt er gjort, men ingenting har skjedd på serveren. Når kunden ringer dagen etter og lurer på kontrakten, må Fredrik forklare at "systemet sa det ble sendt".
**Hvorfor det er rart**: En "Fullført"-status som lyver er verre enn en feilmelding.
**Fil**: `frontend/client/src/components/universal/FotografOrchestrator.tsx:590-594` (fallback returnerer `{ success: true, local: true }` ved API-feil) + `:608-621` (setter `status: 'completed'` med fake `['step1', 'step2', 'step3']`-actions).
**Fix (S)**:
- Fjern det lokale completion-simulatoren. Hvis API-et feiler, sett `status: 'error'` med tydelig melding "Kunne ikke kontakte serveren — handlingene er IKKE utført".
- Beskytt mot at "step1/step2/step3"-strenger noensinne vises i en UI som Fredrik ser.

### B5. Filopplastings-feil havner kun i konsoll hvis kalleren glemte `onUploadError`
**Hva Fredrik møter**: Han drar 200 bryllupsbilder inn i opplastings-vinduet. 40 av dem feiler (timeout, server 500, format-validering). Progressbaren går til 100%, ingen toast, ingen rød markering. Han tror alle 200 er oppe. Galleriet til kunden er ufullstendig.
**Hvorfor det er rart**: En komponent som silently dropper feil pga manglende callback er en fellende felle. Dropbox/Pixieset viser alltid hvilke filer som feilet.
**Fil**: `frontend/client/src/components/universal/UniversalFileUpload.tsx:708-720` — `if (onUploadError) onUploadError(...)` — feilen vises kun hvis prop ble sendt inn.
**Fix (S)**: Inni komponenten, vis en default `Snackbar`/`Alert` ved feil hvis ingen `onUploadError` ble passert. Eller bedre: alltid vis en oppsummering "187 / 200 lastet opp, 13 feilet — vis liste" med klikkbar liste over feilede filer.

---

## ⚠️ FRICTION (12)

### F1. 16 tabs i fotograf-dashbordet — Fredrik gjetter feil hver gang
**Hva Fredrik møter**: Tab-baren har: Oversikt, Prosjekter, Academy, Evendi, Showcase Admin, Filsystem, AI Forbedring, Worklog, Kunder, Utstyr, Filer, Support, Innstillinger, Administrasjon, The Role Room, Integration Test. Han skal finne sine bryllupsbilder — "Filsystem" eller "Filer"? Han skal sende kontrakt — "Administrasjon" eller "Kunder"?
**Hvorfor det er rart**: Pixieset har 4 tabs. Lightroom har 5 paneler. 16 tabs er IDE-territorium, ikke fotograf.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:331-348` — `photographer.tabs`-array.
**Fix (M)**: Grupper i 5-6 toppnivå-tabs: **Prosjekter** (inkluderer Evendi-bryllup), **Filer** (Filsystem + Filer + AI Forbedring + Utstyr-bilder), **Kunder** (Kunder + Kontrakter + Fakturering), **Showcase**, **Innstillinger** (Innstillinger + Administrasjon + Academy + Support). Subnavigering inni hver gruppe.

### F2. "Filsystem" vs "Filer" — to tabs med praktisk talt samme navn
**Hva Fredrik møter**: Han har akkurat lært "Filer" finnes. Så ser han "Filsystem". Hva er forskjellen? Han prøver begge og finner ikke det han leter etter i den han trodde var riktig.
**Hvorfor det er rart**: To tabs som lyder identisk uten visuell forskjell tvinger trial-and-error.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:337` (`'file-upload'` = "Filsystem") og `:342` (`'files'` = "Filer").
**Fix (S)**: Slå sammen til én tab "Filer" med subnavigering "Last opp / Gjennomgå / Arkiv", eller døp om til **"Last opp filer"** og **"Bibliotek"**.

### F3. "Worklog"-jargong er utvikler-språk
**Hva Fredrik møter**: Han ser tab "Worklog". Et JIRA-ord. Han tror det er for support-tickets eller tidregistrering for team-medlemmer, og åpner den aldri.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:339`.
**Fix (S)**: Døp om til **"Timer"** eller **"Tidsføring"**.

### F4. "Evendi" — third-party-navn uten forklaring
**Hva Fredrik møter**: Tab heter "Evendi" med eget app-ikon. Han googler "Evendi" og blir forvirret. Dette er bryllups-timeline-funksjonaliteten, men navnet røper det ikke.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:335` — `wedding-timeline`-tab merket "Evendi" pga sub-brand.
**Fix (S)**: Bruk dobbel-label: **"Bryllup (Evendi)"** eller la sub-brand-en kun dukke opp i header inni tabben.

### F5. Brand-farge skifter mellom onboarding (#ffba6c) og dashboard (#ff8c00)
**Hva Fredrik møter**: I onboarding-wizarden så fotograf-profesjonen oransje-gulaktig ut (`#ffba6c`). Når han kommer til dashboardet er aksent-fargen plutselig sterkere oransje (`#ff8c00`). Han lurer på om han endret noe ved et uhell.
**Fil**:
- `frontend/client/src/components/onboarding/IndividualOnboardingWizard.tsx:34` — `color: '#ffba6c'`
- `frontend/client/src/components/universal/UniversalDashboard.tsx:328` — `color: '#ff8c00'`
**Fix (S)**: Konsolider til én sannhetskilde for profesjons-farger (én konstant importert begge steder).

### F6. "Showcase Admin" lyder som CMS-administrator
**Hva Fredrik møter**: Han er en fotograf, ikke en admin. "Showcase Admin" får ham til å tenke at noen annen skal styre showcasen, ikke han selv.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:336`.
**Fix (S)**: Døp om til **"Mitt showcase"** eller **"Portefølje"**.

### F7. "Kunder"-tab uten kontekst om hva som skjer der
**Hva Fredrik møter**: Han klikker "Kunder" — forventer kunderegister á la "ny kunde, send kontrakt, fakturer". Får i stedet en generisk liste uten åpenbar handling.
**Hvorfor det er rart**: Fotograf-flowen er KUNDE → KONTRAKT → SHOOT → GALLERY → FAKTURA. Tabben bør være start-punktet for hele dette løpet.
**Fil**: `frontend/client/src/components/universal/UniversalDashboard.tsx:340` (label) + `frontend/client/src/pages/photographer-clients-list.tsx` (innhold lazy-imported i UniversalDashboard:7).
**Fix (M)**: Erstatt "Kunder"-tab med **"Oppdrag"**-CRM som viser per-kunde: aktiv kontrakt, neste deadline, leveransestatus, ubetalt faktura. Det er den faktiske "hva må jeg gjøre"-listen for en fotograf.

### F8. Google Drive-sync feiler stille — kun konsoll-warning
**Hva Fredrik møter**: Han laster opp 200 bilder som skal speiles til klientens Drive-mappe. Sync feiler (token utløpt eller quota). UI-et viser et lite gult ikon som han ikke ser. Bildene kommer aldri inn til kunden.
**Fil**: `frontend/client/src/components/universal/UniversalFileUpload.tsx:356-358` — feilen logges til `console.error` og `setGoogleDriveSyncStatus('error')`, men ingen toast/dialog.
**Fix (S)**: Vis en `<Alert severity="error">` med "Google Drive-sync feilet — sjekk tilkoblingen" + "Prøv igjen"-knapp. Det skal være umulig å overse.

### F9. Ingen sjekk av forutsetninger før Photo Enhancement startes
**Hva Fredrik møter**: Han klikker "AI-bildeforbedring" — orkestreringen starter. Men han har ikke en eneste fil opplastet ennå. Eller utløpt Google Drive-token. Eller ingen tilgjengelig kreditt. Orkestreringen begynner uansett og feiler 30 sekunder senere.
**Fil**: `frontend/client/src/components/universal/FotografOrchestrator.tsx:127-346` (orkestrerings-definisjoner) — ingen pre-flight-check før mutationen kalles på `:578`.
**Fix (M)**: Hver `Orchestration`-definisjon får en `preflight: () => { ok: boolean, missing: string[] }`-funksjon. Knappen blir disabled + tooltip "Last opp bilder først" hvis forutsetninger mangler.

### F10. "Kalibrer skjerm" finnes som handling, men trigges aldri
**Hva Fredrik møter**: Han leverer bryllupsbilder som kunden klager ser oransje ut på iPad-en sin. Fredrik vet ikke at hans egen skjerm ikke er kalibrert. Plattformen har en `calibrateMonitor`-action, men den eksisterer bare som et menyvalg gjemt langt nede.
**Fil**: `frontend/client/src/components/universal/FotografOrchestrator.tsx:420` — `calibrateMonitor` er definert men aldri eksponert i onboarding eller helse-sjekk.
**Fix (S)**: Onboarding steg 5 ("Ferdig") får en valgfri "Kalibrer skjerm før første shoot"-knapp. Helse-widget i Oversikt har en grønn/rød indikator "Skjerm kalibrert: nei (24 dager siden)".

### F11. Stripe Connect / direkte fakturering til kunde mangler
**Hva Fredrik møter**: Han vil sende faktura til kunde og få betaling rett inn på sin egen konto. `createInvoice` og `sendInvoice` finnes som handlinger, men det er ingen flow for å koble Fredriks Stripe-konto. Han mistenker at platformen tar betaling, ikke han.
**Fil**: `frontend/client/src/components/universal/FotografOrchestrator.tsx:411-438` (invoice-handlinger definert) — ingen Stripe Connect-onboarding funnet for fotograf.
**Fix (L)**: Innstillinger-tab → "Betaling" → "Koble Stripe-konto" (Stripe Connect Express). Connect Account ID lagres på user-profilen. `createInvoice` bruker den til å sende Stripe-faktura direkte til kunde.

### F12. Ingen "resumable" / chunked upload — RAW-er må starte på nytt
**Hva Fredrik møter**: Han laster opp 80 GB RAW fra en bryllups-shoot på hotell-wifi. Etter 45 minutter dropper nettet. Når han prøver igjen, må han starte alle filene på nytt.
**Fil**: `frontend/client/src/components/universal/UniversalFileUpload.tsx:626-678` — `FormData` med `maxRetries`-retry, men ingen tus.io / S3 multipart / chunked resume.
**Fix (L)**: Implementer tus.io eller bruk direkte-til-S3 multipart-upload med resumable session per fil. Vis "Fortsetter fra 67%"-status ved gjenopptakelse.

---

## 🎯 NICE (8)

### N1. Mappe-drag fra Finder
**Hva**: Fredrik har en mappe `2026-05-bryllup-anna-ole/` med 800 RAW. Han vil dra hele mappa inn.
**Fil**: `UniversalFileUpload.tsx:520-530` — drag-drop fungerer per fil, men `<input webkitdirectory>` mangler.
**Fix (M)**: Aktiver `webkitdirectory` på fil-input + lytt etter `DataTransferItem.webkitGetAsEntry()` ved drop for å pakke ut mapper rekursivt.

### N2. Lightroom-katalog-sync
**Hva**: Etter shoot er Fredriks Lightroom katalog allerede importert og delvis redigert. Han vil at den synces tilbake til CreatorHub uten manuell eksport.
**Fix (L)**: Lightroom Classic SDK eller Smart Preview-eksport som watch-folder.

### N3. Klient-galleri med "favoritt"-tilbakemelding
**Hva**: Brud + brudgom logger inn og markerer favoritter for trykk/album. Fredrik mottar lista og lager albumet basert på den.
**Fil**: Allerede stubbet i `wedding/GalleryDeliveryPanel.tsx` mot `/api/wedding/{weddingId}/gallery/favorites`, men ikke koblet til standalone-klient-gallerier.
**Fix (M)**: Generaliser fra wedding-spesifikk til alle prosjekt-typer (portrett, kommersielt). Egen "Klient-link"-flow.

### N4. Vannmerke-preset per prosjekt
**Hva**: "Forhåndsvisning til kunde" vannmerkes automatisk. "Endelig leveranse" gjør det ikke. Fredrik velger preset én gang per prosjekt.
**Fil**: `FotografOrchestrator.tsx:427` har `watermarkImages`-action, men ingen preset-konfig.
**Fix (M)**: Prosjekt-innstilling "Vannmerke-preset: Preview / Endelig / Av". Eksport-handlingen ser på prosjektets preset.

### N5. Aspect-ratio-presets ved eksport (Instagram, print, web)
**Hva**: Eksport-dialog har dropdown "Instagram square 1080×1080", "Print A3", "Web 1600px bred" som auto-justerer dimensjoner.
**Fix (M)**: Sharp/imagemagick-pipeline på backend. UI-dropdown i eksport-flow.

### N6. Skjerm-kalibrering som halvårlig påminnelse
**Hva**: Etter 90 dager: "Det er 90 dager siden siste skjerm-kalibrering. Vil du kalibrere nå?"
**Fix (S)**: Cron-job + notification. Bruker `lastCalibrationAt` på user-profilen.

### N7. "Hva betyr denne knappen?"-tooltip på alle handlinger i Orchestrator
**Hva**: Hver handling i FotografOrchestrator har allerede `description`-felt — men det vises ikke som tooltip på hover.
**Fil**: `FotografOrchestrator.tsx:392-453` — beskrivelser er populerte.
**Fix (S)**: Wrap handling-knappene i `<Tooltip title={action.description}>`.

### N8. "Spør Claude om hjelp"-knapp på hver feilmelding
**Hva**: Når noe feiler, en knapp "Spør Claude om hva som skjedde" som sender feilmelding + kontekst til Claude som forklarer på vanlig norsk. (Samme idé som Irlin-doken N8 — gjelder bredt.)
**Fix (M)**: Wrap alle feilmeldinger i en `<ErrorPanel>` med "Få forklaring"-knapp som bruker claude_chat.

---

## Prioritering for Fredrik's første uke

Hvis du må velge: gjør disse fem først, så er Fredrik produktiv uten daglig håndholding:

1. **B1** Skjul "Integration Test"-tab i prod-build (S, 5 min)
2. **B2** Onboarding-wizard må vise feil i stedet for å svelge dem (S, 30 min)
3. **B5** UniversalFileUpload viser opplastings-feil av seg selv uten kaller-callback (S, 1t)
4. **B4** Orchestration-fallback må rapportere `error`, ikke `completed` (S, 1t)
5. **F8** Google Drive-sync feiler synlig med toast (S, 30 min)

Total: ~3-4 timer arbeid. Etter dette tør jeg slippe Fredrik løs uten å sitte på linja.

---

## Hvis du må overlevere Fredrik i dag uten disse fixene

Sørg minst for:
- Daniel går gjennom onboarding-wizarden sammen med ham på skjerm-deling og bekrefter at business-info ble lagret (sjekk `/api/branding/business-info` returnerer noe etterpå)
- Daniel sier eksplisitt: **"Ikke klikk på 'Integration Test'-tabben"**
- Daniel forklarer skillet mellom "Filsystem" og "Filer", "Showcase Admin" og "Evendi"
- Daniel viser at orchestration-status kan lyve hvis API er nede — ved nedetid, sjekk via `/api/orchestration/status` direkte
- Daniel kobler Google Drive sammen med ham og sjekker at sync-status er grønn FØR første opplasting

Resten kan komme senere etter første tilbakemelding fra ham.

---

## Stabilitetsobservasjon (informativ, ikke gap)

`UniversalDashboard.tsx` har **27 `.bak.*`-varianter** ved siden av seg i `frontend/client/src/components/universal/`. Det er et signal om at filen har vært gjenstand for mange manuelle rollback-runder under utvikling. Ingen av backup-filene er importert eller brukt — men antallet antyder at man bør **fryse atferd via integrasjons-tester** før neste større refaktorering av denne komponenten (8 857 linjer).
