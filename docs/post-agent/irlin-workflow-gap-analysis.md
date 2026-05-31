# Workflow gap-analyse — Irlin (profesjonell danser)

Detaljert kartlegging av friction-punkter når en ikke-teknisk profesjonell danser skal bruke Post Agent ↔ Photoshop til å lage promo-materiell (audition-plakater, social media, BTS-stills).

**Persona Irlin**:
- Profesjonell danser, ikke utvikler
- Bruker Mac, kan grunnleggende Photoshop
- Mål: lage 5-10 promo-bilder per forestilling (poster, Instagram, story-cards)
- Lavt teknisk vokabular: "fil-sti", "terminal", "package", "sideload" = uforståelig
- Forventer at ting bare fungerer som i Canva, Instagram, Photoshop

Gaps er klassifisert i tre nivåer:

- ❌ **BLOCKER** — Irlin kan IKKE komme i gang uten dette
- ⚠️ **FRICTION** — Irlin kommer i gang men sliter, undrer "hvorfor er det sånn?"
- 🎯 **NICE** — vil vesentlig forbedre opplevelsen

Estimater for arbeidsomfang: **S** (≤1t), **M** (1-4t), **L** (4t+).

---

## ❌ BLOCKERS (4)

### B1. UXP-plugin må sideloades manuelt via UDT
**Hva Irlin møter**: Helse-sjekken sier "Plugin ikke tilkoblet". Fix-tekst sier "Åpne Adobe UXP Developer Tool…". Hun har aldri hørt om UDT.
**Hvorfor det er rart**: Når hun installerer Slack eller Spotify, fungerer det med en gang. Hvorfor må man være "utvikler" for å bruke et bruker-verktøy?
**Fix**:
- **Kort sikt (M)**: Bundle UXP-pluginen i Tauri-app-resources + Rust-modul som kopierer pluginen til Adobe's auto-load-mappe (`~/Library/Application Support/Adobe/UXP/Plugins/External/`) ved første start. Verifiser hot-load med Photoshop-restart.
- **Lang sikt (L)**: Signer som `.ccx` og distribuer via Adobe Exchange. Krever Adobe Developer-konto + review-prosess.

### B2. Setup-guide ligger i `docs/`, ikke i appen
**Hva Irlin møter**: Daniel sender henne en lenke til `setup-guide-irene.md` på GitHub. Hun må ha GitHub-tilgang. Når hun har spørsmål midt i prosessen, må hun bytte vindu, finne fila, lese, gå tilbake.
**Hvorfor det er rart**: En "Hjelp-knapp" eller "?-ikon" i appen er standard i 2026.
**Fix (S)**: Lag en in-app `HelpDialog` som rendrer markdown-versjonen av setup-guide. Knapp i HeaderBar `?` eller "Hjelp"-menyentry.

### B3. Irlin har ingen Photoshop-template å starte fra
**Hva Irlin møter**: Hun åpner "Photoshop Templates…" → dialog ber om en .psd-fil. Hun har ingen. Hun forstår ikke at hun må LAGE en først.
**Hvorfor det er rart**: En platform som vil hjelpe henne lage promo bør gi henne ferdige startpunkter.
**Fix**:
- **Kort sikt (M)**: Bundle 3-5 ferdige `.psd`-templater i `apps/resolve-script-manager/templates/photoshop/`: dance-poster.psd, instagram-square.psd, story-9x16.psd, audition-flyer.psd, event-banner.psd. Templates-dialog viser "Bundled templates"-seksjon øverst.
- **Lang sikt (L)**: Template-marketplace hvor brukere kan dele templater.

### B4. Krever absolutte fil-stier overalt
**Hva Irlin møter**: Agent svarer "Hvilken fil? Du må gi meg den absolutte stien som starter med `/Users/...`". Hun bare drar bilder fra Finder vanligvis.
**Hvorfor det er rart**: I 2026 forventer brukere drag-and-drop, ikke å skrive paths.
**Fix (M)**: Drop zones i alle dialoger (Templates, Agent, PSD-galleri). Drar du en fil inn, settes path-feltet automatisk. Bruker `webview.dragdrop.dropFile` Tauri-event eller HTML5 drag-drop API.

---

## ⚠️ FRICTION (12)

### F1. First Run Wizard henger tilsynelatende
**Hva Irlin møter**: "Sjekker hva som finnes på Mac-en…" — står i 8-10s mens 8 parallelle Python-prosesser kjører. Wizard sier "lengre enn 10s, restart appen". Irlin restarter, samme problem.
**Hvorfor det er rart**: Den advarer henne om noe som er normalt.
**Fix (S)**:
- Endre wizard-tekst fra "10s, restart" til "kan ta opp til 1 minutt første gang"
- Vis live progress fra `script-event progress`-stream (vi har den allerede)
- Eller: skip wizard helt for ikke-teknisk persona

### F2. "Hopp over (avansert bruker)" skremmer henne
**Hva Irlin møter**: Skip-knappen kalles "avansert bruker". Hun er ikke avansert, så hun klikker den IKKE, og venter forgjeves.
**Hvorfor det er rart**: Navnet impliserer at hun gjør noe galt.
**Fix (S)**: Endre tekst til "Hopp over for nå" eller "Sett opp senere".

### F3. Onboarding-tour antar at hun har Photoshop
**Hva Irlin møter**: Tour viser 7 steg om Photoshop-funksjoner. Hun har glemt å installere Photoshop først.
**Hvorfor det er rart**: Tour-en bør sjekke forutsetninger og skreddersy seg.
**Fix (S)**: Tour sjekker `app.info` / `photoshop_status` ved start. Hvis Photoshop ikke detektert: vis et "Steg 0: Installer Photoshop"-steg først med link til Adobe.

### F4. Hun forstår ikke `{{key}}`-konvensjonen før hun har lest cookbook
**Hva Irlin møter**: Lager en PSD, navngir layer "title", Templates-dialog sier "Ingen `{{key}}`-felter funnet". Hva er greia med krøllparenteser?
**Hvorfor det er rart**: Konvensjonen er en intern detalj som lekkasje til UI.
**Fix**:
- **Kort sikt (S)**: Templates-dialog viser ALLE layer-navn, ikke bare `{{key}}`-matches. Hvis ingen `{{key}}` finnes, vis: "Vi fant ingen `{{key}}`-felter, men her er layers vi ser. Skal vi behandle ALLE text-layers som felter?" Tilbyr en "Auto-rename"-knapp som setter `{{layer-name}}` på alle text+SO layers.
- **Lang sikt (M)**: "Lag template fra scratch"-wizard i appen som lager PSD-en ferdig navngitt.

### F5. Smart-object-replace feiler stille hvis layer ikke er smart object
**Hva Irlin møter**: Hun navngir et raster-layer `{{photo}}` og prøver å rendre. Får "Layer er ikke smart object"-feilmelding midtveis i flow.
**Hvorfor det er rart**: Hvorfor sjekkes ikke dette ved scan-tid?
**Fix (S)**: Template scan-fasen rapporterer layer-typer EKSPLISITT — "Layer `{{photo}}` er raster, men forventet text eller smart object". Konverter automatisk hvis brukeren ber om det (`smartObject.convert`-kommando).

### F6. Ingen preview før render
**Hva Irlin møter**: Hun fyller skjemaet, klikker Render → må vente 5-10s mens Photoshop åpner, fyller, eksporterer. Hvis hun har skrevet feil tittel, er hele waiten bortkastet.
**Hvorfor det er rart**: Canva, Figma osv. har live preview.
**Fix (M)**: Hvis templatet har embedded thumbnail (PSD-resource), vis det i Templates-dialog. For ekte preview: live render-on-debounce med lavoppløsnings-eksport (~256px).

### F7. Token utløper uten varsel
**Hva Irlin møter**: Hun jobber i 30 min, så slutter Agent å fungere — "Token utløpt". Logger inn, må starte samtalen på nytt fordi state ikke beholdes.
**Hvorfor det er rart**: Slack, Notion etc. håndterer dette transparent.
**Fix (M)**: Bearer-token auto-refresh før utløp (Render kan returnere refresh-token). Agent-state lagres i localStorage så den overlever re-auth.

### F8. mailto: feedback krever konfigurert mail-klient
**Hva Irlin møter**: Klikker "Send feedback" → ingenting skjer eller åpner uautorisert app. Hvis hun bruker Gmail i browser, fungerer ikke mailto.
**Hvorfor det er rart**: Hvorfor må jeg ha mail-klient for å rapportere bug i en app?
**Fix (M)**: Skift feedback til POST `/api/post-agent/feedback`-endpoint som lagrer i Linear/database. Vi har allerede backend-infrastruktur.

### F9. Ingen autosave/recovery på Agent-samtaler
**Hva Irlin møter**: Hun chater med Agent i 10 min, lukker dialogen ved et uhell, all kontekst borte.
**Hvorfor det er rart**: ChatGPT etc. lagrer samtaler.
**Fix (S)**: Lagre Agent-message-historikk i localStorage per session. Reload av appen vis: "Du hadde en pågående samtale, vil du fortsette?".

### F10. Ingen "Avbryt" på lange Photoshop-operasjoner
**Hva Irlin møter**: Agent kaller `photoshop_render_template` med stor PSD som tar 30s. Hun innser hun valgte feil template, men har ingen måte å stoppe på.
**Hvorfor det er rart**: Hver tunge operasjon bør være kansellerbar.
**Fix (M)**: Avbryt-knapp som sender `cancel`-melding til UXP-plugin via WS. Plugin avbryter modal-task via `executeContext.reportProgress`.

### F11. Ingen drag-from-Finder-til-Agent
**Hva Irlin møter**: Hun vil bytte logo i 5 PSD-er, må manuelt skrive logo-pathen 5 ganger.
**Hvorfor det er rart**: Drag-and-drop er forventet.
**Fix (M)**: Drop zone i Agent-dialog tekstfelt. Når hun drar en fil inn, settes path som tekst i nåværende prompt.

### F12. PSD-galleri ber om mappe, ikke direkte filer
**Hva Irlin møter**: Hun har en PSD åpen i Photoshop, vil se thumbnail. Galleriet ber om mappe. Hun må navigere til mappa selv.
**Hvorfor det er rart**: Hvorfor kan jeg ikke bare dra PSD-en inn?
**Fix (S)**: PSD-galleri støtter både mappe og enkeltfil. Drag-drop av PSD direkte inn i galleriet.

---

## 🎯 NICE (8)

### N1. Dans-spesifikke templater
**Hva**: Bundle 2-3 templater spesifikke for dans-bransjen: audition-flyer, performance-poster, instruktør-bio-card. Med korrekt aspect ratio for Instagram/poster.
**Fix (M)**: Engasjer en designer (eller bruk Figma+eksport) for å lage 3 polished templater.

### N2. Direkte Role Room-integrasjon for performer-data
**Hva**: Når Irlin lager casting-poster, kan hun klikke "Hent fra Role Room → Velg performer" og auto-fylle navn/bilde/profesjon.
**Fix (M)**: Templates-dialog får "Hent data fra Role Room"-knapp som henter via eksisterende `role_room_my_seats` Tauri-command, åpner dropdown med performer-liste.

### N3. Favoritter / siste brukt templater
**Hva**: Templates-dialog viser øverst "Mine ofte brukte: poster.psd, instagram.psd, ..."
**Fix (S)**: localStorage-basert telling. Sortér templater etter usage-count.

### N4. Aspect ratio-presets ved eksport
**Hva**: Eksport-dialog har dropdown "Instagram square 1080×1080", "Story 1080×1920", "Facebook 1200×630" som auto-justerer dimensjoner.
**Fix (M)**: Photoshop UXP `imageSize`-command + post-export crop.

### N5. Batch på tvers av flere PSD-er
**Hva**: Hun vil bytte logo i ALLE branding-PSD-er i en mappe. Agent støtter ikke det enkelt.
**Fix (M)**: `photoshop_batch_apply`-tool som tar en mappe + en operasjon + applierer på alle .psd-er.

### N6. Direct social media-publisering
**Hva**: Etter render, knapp "Publiser til Instagram" som åpner Instagram med bildet ferdig lastet.
**Fix (L)**: Krever Meta App Review-flyt (allerede pågående per memory). Senere.

### N7. Tour med GIF/video i hvert steg
**Hva**: Tour viser i dag bare emoji + tekst. En kort screen capture per funksjon ville gjøre stor forskjell.
**Fix (M)**: Spille inn 5 korte (~5s) screencaps, embed som autoplay GIFs i tour.

### N8. "Spør Claude om hjelp"-knapp på hver feilmelding
**Hva**: Når noe feiler, en knapp "Spør Claude om hva som skjedde" som sender feilmelding + kontekst til Claude som forklarer på vanlig norsk.
**Fix (M)**: Wrap alle feilmeldinger i en `<ErrorPanel>` med "Få forklaring"-knapp som bruker claude_chat.

---

## Prioritering for Irlin's første uke

Hvis du må velge: gjør disse fem først, så er Irlin produktiv:

1. **B1** Bundle UXP-plugin + auto-install ved første start (M)
2. **B3** Bundle 3 dans-relaterte starter-templater (M)
3. **B2** In-app `HelpDialog` med setup-guide (S)
4. **F4** Templates-dialog viser ALLE layers, ikke bare `{{key}}`-matches (S)
5. **F8** Backend feedback-endpoint istedenfor mailto (M)

Total: ~8-10 timer arbeid. Etter dette kan Irlin trygt overleveres uten Daniel-håndholding.

---

## Hvis du må overlevere Irlin i dag uten disse fixene

Sørg minst for:
- Daniel sideloader UXP-pluginen for henne én gang via skjerm-deling
- Daniel lager 1-2 starter-templater i Photoshop og legger på hennes desktop
- Daniel skriver setup-guiden in i en e-post med skjermbilder, ikke som markdown-link
- Daniel sjekker Helse-sjekk er grønn FØR han slipper henne løs

Resten kan komme senere etter første tilbakemelding fra henne.
