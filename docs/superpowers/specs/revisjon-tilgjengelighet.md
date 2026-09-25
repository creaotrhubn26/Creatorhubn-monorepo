# Revisjon: tilgjengelighet, tastatur og tema — creatorhub-notes/app

Lest: `src/App.tsx`, `src/Panel.tsx`, `src/Editor.tsx`, `src/styles.css`, `index.html`
(+ `src/tema.ts`, `src/main.tsx`, `src-tauri/tauri.conf.json` for tema- og vindusakse).
Kontrastene er regnet ut fra CSS-variablene, ikke målt på skjerm. WCAG 2.2 AA er terskelen.

Bestått uten anmerkning: `<html lang="nb">` (`index.html:2`), `prefers-reduced-motion`-vakt
rundt alle overganger (`styles.css:844`), ingen modale dialoger, ingen dra-og-slipp, ingen
dobbeltklikk, ingen hold-inne, ingen handling som først dukker opp ved hover.

---

## A. Stenger ute

**A1. Søkeresultatet finnes ikke for en skjermleser.** `App.tsx:405-417` bytter lista mens
hun skriver; treffantallet står i en `<h2>` (`App.tsx:532`) og nulltreff i en `<p>`
(`App.tsx:526`). Ingen av dem er et live-område, og fokus blir i søkefeltet. En blind bruker
skriver og får aldri vite om det finnes treff. Legg `role="status"` på en linje som sier
«12 treff» / «ingen treff».

**A2. Skriveflaten har ikke navn.** `Editor.tsx:252-274` bygger `EditorView` uten
`EditorView.contentAttributes.of({ "aria-label": "Notatet" })`. CodeMirror gir `.cm-content`
`role="textbox"` uten navn, så VoiceOver sier bare «tekstområde». Fordi `Editor.tsx:296`
(`v.focus()`) kaster fokus hit hver gang et notat åpnes, havner hun i et navnløst felt uten
å få vite hvilket notat som ble åpnet.

**A3. Hele forståelsespanelet fylles ut uten et ord.** `Panel.tsx:321-381` rendres på nytt
hver gang `påLesning` leverer delresultater (`App.tsx:188-208`). Linjer, «Tidligere om
dette», og framdriftslinja `Panel.tsx:352-356` dukker opp og forsvinner uten `aria-live` og
uten at fokus flyttes. Panelet er hele produktideen, og det er usynlig for skjermleser.
Minst framdriften og «Ingenting er bestemt ennå» → «N linjer lest» trenger et `role="status"`.

**A4. Escape river deg ut av rettingen og sletter søket samtidig.** `App.tsx:429-434` lytter
på `window`. Står du i `Retteskjema` og trykker Escape på en radioknapp eller en knapp (alt
unntatt tekstfeltet, som har sin egen håndtering på `Panel.tsx:153`), blir skjemaet stående,
søket tømmes, og `document.querySelector(".cm-content")?.focus()` flytter fokus til editoren.
Tastaturbrukeren mister både skjemaet og stedet sitt. Escape må håndteres der fokus er, ikke
på `window`.

**A5. Ved 200 % zoom kollapser skriveflaten.** `styles.css:252-273` gir tre faste spalter
(320/1fr/336, 250/1fr/300 under 1180px) og `styles.css:126-130` en fast topprad på 68px.
1360 fysiske px ved 200 % = 680 CSS-px: 550px går til liste + panel, og editoren får ~130px
minus `padding: 0 32px` (`Editor.tsx:31`) ≈ 66px tekstbredde. Ingen mediaspørring under
1180px stabler spaltene. WCAG 1.4.10 (reflow ved 320px) er brutt, og appen er i praksis ikke
brukbar for den som må zoome.

**A6. Toppfeltet har ingen vei ut ved stor tekst.** `.tøm`, `.bryter`, `.nytt`
(`styles.css:206`) og `.tema` (`styles.css:224`) har `white-space: nowrap`, `.topp`
(`styles.css:134-142`) har ingen `flex-wrap`, og raden er låst til 68px. Øker man tekst-
størrelsen, presses søkefeltet (`flex: 1; min-width: 0`, `styles.css:160-161`) mot null
bredde og knappene ut av vinduet. Søket blir uleselig, ikke bare trangt.

**A7. Systemets tekststørrelse gjør ingenting.** Hver eneste skriftstørrelse i
`styles.css` er absolutte px (body 15px `:98-104`, `.tittel` 16px, `.kort` 16px,
`Editor.tsx:19` 17.5px). Ingen `rem`. Brukerens innstilling for større tekst i nettleser/OS
blir ignorert; eneste utvei er full sidezoom, som A5 allerede har ødelagt. Bytt til `rem`
med `:root { font-size: 100% }`.

**A8. `--ink-faint` er under kontrastkravet i lyst tema.** `#7c8683` gir **3,18:1** mot
`--ground` `#eaedeb` og **3,65:1** mot `--paper` `#fbfcfb` — kravet er 4,5:1
(`styles.css:13`). Det rammer klokkeslettet i lista `.tid` (`styles.css:327-331`),
plassholderen i søket (`:174`), hjelpelinja under nulltreff `.tomt span` (`:359`),
`.spurtOm` (`:829`), `.panel .framdrift` (`:643`), `.detaljer dt` (`:428`), `kbd` (`:120`)
og `tags.url` / `tags.processingInstruction` inne i notatteksten (`Editor.tsx:54,58`).
Mørkt tema er ok (4,96 / 4,60). Lyst tema trenger ca. `#6a736f` (4,5:1) eller mørkere.

**A9. Å laste inn på nytt sletter det hun har skrevet, uten synlig vei tilbake.**
`App.tsx:292-305` nuller `uskrevet.current` og bytter hele dokumentet. Angre finnes bare via
CodeMirrors historikk (Cmd+Z), som ingenting i grensesnittet nevner. Dette bryter både
«ingenting går tapt uten vei tilbake» og «hurtigtaster er aldri eneste vei». Enten vis
lengden på det som forkastes og en «Angre»-knapp etterpå — panelet har allerede mønsteret
(`Panel.tsx:323-335`) — eller la begge versjonene stå.

## B. Straffer

**B10. Ingen vei forbi lista.** For å komme fra panelet til søkefeltet må man shift-tabbe
gjennom hver eneste notatrad (`App.tsx:552-559`) — 100 notater = 100+ stopp. Ingen
hoppelenke, ingen `tabindex`-håndtering, ingen tastatursnarvei til liste/panel. Skjermlesere
kan bruke landemerker; en seende tastaturbruker kan ikke. Minst: «Hopp til skriveflaten» som
første fokuserbare element.

**B11. Ingen piltaster i lista.** Radene er 100+ separate tabstopp (`App.tsx:552-559`,
`:534-542`, `:510-521`). En `nav`+knapper-struktur uten `roving tabindex` betyr at det å bla
gjennom notatene koster ett Tab per notat. Piltaster opp/ned med ett tabstopp for hele lista
er standardmønsteret.

**B12. Fokusmarkeringen er slått av på begge tekstfeltene.** `styles.css:178-182`
(`.søk input:focus`) og `:677-681` (`.rettefelt input:focus`) setter `outline: none` og
vinner over `:focus-visible` (`:114-118`) på spesifisitet. Igjen står en 1px kantfarge og
`box-shadow: 0 0 0 3px var(--sel)` — `--sel` er 15 % (lyst) / 20 % (mørkt) gjennomsiktig
aksent, altså nesten usynlig. Fokus i søkefeltet bæres da av farge alene.

**B13. Skriveflaten har ingen fokusmarkering.** `Editor.tsx:21`
(`"&.cm-focused": { outline: "none" }`). Eneste tegn på at editoren har fokus er
tekstmarkøren, 2px `var(--accent)` (`Editor.tsx:35`). I et tomt notat, eller for den som
ikke ser en tynn strek, finnes det ingen indikasjon.

**B14. Fokusringen på listerader og panellinjer blir klippet.** `:focus-visible` bruker
`outline-offset: 2px` (`styles.css:116`), men `.rad` er `width: 100%` (`:300`) inne i
`.liste { overflow-y: auto }` (`:278`) og `.linje`/`.tidligere button` er fullbredde inne i
`.panel { overflow-y: auto }` (`:512`). Venstre og høyre kant av ringen ligger utenfor
rullecontaineren og forsvinner. Bruk `outline-offset: -2px` for fullbreddeelementer.

**B15. Fokus faller til `<body>` hver gang noe lukkes.** «Avbryt»/«Lagre» i `Retteskjema`
(`Panel.tsx:177-186`), «Angre» (`Panel.tsx:326-333`), «Lukk» på lest-på-nytt
(`Panel.tsx:346`) og «Lukk» på feilmeldingen (`App.tsx:570`) avmonterer elementet som hadde
fokus. Neste Tab starter fra toppen av dokumentet. Fokus må tilbake til «Endre»-knappen /
det elementet som utløste.

**B16. Hvilket notat som er åpent finnes bare som farge.** `App.tsx:554` gir klassen
`valgt`, som i `styles.css:311-314` er en 3px aksentkant og en 9 %-tone
(`#d7e1de` mot `#eaedeb` ≈ 1,1:1 — ikke synlig). Ingen `aria-current="true"`. Skjermleser
får ingenting, og fargesvake ser bare den tynne kantstripa.

**B17. Lagringsmerket maser mens hun skriver.** `App.tsx:587` har `aria-live="polite"` på
`.status`, og `App.tsx:246` setter «Lagrer …» ved hvert opphold i skrivingen, etterfulgt av
«Lagret 14:32» (`:220`). Skjermleseren avbryter dermed opplesningen hvert par sekunder under
skriving. Dessuten leses `::before`-innholdet `·` (`styles.css:477-481`) med. Sett live-
området til bare å annonsere feiltilstand, eller `aria-live="off"` mens fokus er i editoren.

**B18. Rå feilmeldinger fra Rust vises til brukeren.** `String(e)` på `App.tsx:230, 283,
303, 315, 333, 348, 357, 410`. Én av dem — `:238` — er skrevet på norsk og viser hvordan det
skal se ut. Resten kan bli «invalid utf-8 sequence …» i en `role="alert"`. Se også C-listen.

**B19. Notattittelen finnes ikke som overskrift.** Når et notat er åpent finnes ingen `h1` i
det hele tatt — `.velkomst h1` (`App.tsx:630`) vises bare når ingenting er valgt. Notatets
egen `# Tittel` er markdown inne i CodeMirror, tegnet med `fontSize: "1.5em"`
(`Editor.tsx:48`) og med `#` fjernet fra DOM av `skjulMerker` (`Editor.tsx:127-149`).
Dokumentet starter altså på `h2`, og ingen overskrift inne i notatet kan navigeres til.

**B20. Lista er ikke en liste.** `App.tsx:504-564`: `<nav>` → `<section>` → `<h2>` →
`<button>`-rekke. VoiceOver sier verken «liste» eller «3 av 24». Radene er billige å gjøre om
til `<ul>/<li>` og gir da posisjon og antall gratis.

**B21. Bryteren sier to ting samtidig.** `App.tsx:486-497`: `aria-pressed={panel}` *og* en
etikett som bytter mellom «Skjul forståelse» og «Vis forståelse». Skjermleseren sier «Skjul
forståelse, veksleknapp, aktivert» — dobbelt negativ. Velg én: fast etikett + `aria-pressed`,
eller vekslende etikett uten.

**B22. Avkortede titler kan ikke leses av noen.** `.tittel` (`styles.css:318-325`) og
`.utdrag` (`:333-343`) klipper med `-webkit-line-clamp` uten `title`-attributt og uten noen
måte å utvide på. Ikke hover-avhengig — verre: helt utilgjengelig. Samme regel bryter WCAG
1.4.12 (tekstavstand): øker man linjehøyde eller bokstavavstand, klippes enda mer bort.

**B23. Markeringen av avsnittet forsvinner etter 1,8 sekund.** `Editor.tsx:336-338`. Det er
hele poenget med å klikke en panellinje eller en «Tidligere om dette»-lenke
(`Panel.tsx:107`) — man skal finne igjen stedet. 1,8 s er kort for den som leser sakte, og
tida kan ikke justeres. La markeringen stå til neste klikk eller til hun skriver.

**B24. Varselet dytter teksten nedover mens hun skriver.** `endretUtenfor` (`App.tsx:610-615`)
og feilbanneret (`:567-572`) settes inn i `<main>` over `<Editor>` og flytter hele
skriveflaten. Med markøren midt i en setning hopper linja under fingeren. Legg dem i et
område med reservert plass, eller under editoren.

**B25. Varsel om tapt arbeid er merket «status», ikke «alert».** `App.tsx:611`
`role="status"` (polite) på beskjeden om at notatet ble endret utenfra mens hun har ulagrede
endringer. Det er akkurat den meldingen som ikke skal stå i kø bak noe annet.

**B26. Ingen `forced-colors`- eller `prefers-contrast`-håndtering.** Alle bakgrunner er
`color-mix(... , transparent)` (`styles.css:308, 313, 424, 574, 655, 759, 792`) og alle
skiller er 1px `--rule`. I macOS «Øk kontrast» / Windows høykontrast forsvinner både valgt
rad, hover og seksjonsskillet i panelet (`:538-542`) uten erstatning.

**B27. `-webkit-font-smoothing: antialiased`** (`styles.css:103`) tynner ut all tekst på
macOS og senker faktisk lesbarhet for svaksynte. Den er en smakspreferanse, ikke en
forbedring.

**B28. Kommentaren om 6:1 stemmer ikke.** `styles.css:20-23` lover at alle fire merkefarger
holder «minst 6:1 mot bakgrunnen i begge temaene». Mot panelbakgrunnen — som er `--ground`,
siden `.panel` (`:511-515`) ikke setter egen bakgrunn — er det i lyst tema
forstått 5,40:1, oppgave 5,35:1, uavklart 5,90:1, idé 6,31:1. Over 4,5:1, altså greit, men
kommentaren bør si det den faktisk gjør, ellers blir den brukt som dekning senere.

## C. Brudd på husreglene

**C29. Brødtekst under 15px, fire steder.** `.detaljer` 13px (`styles.css:421`),
`kbd` 14px (`:122`), `.panel .framdrift` 14px (`:645`), `.avsender` 14,5px (`:614`).
`.detaljer` er dessuten monospace på 13px — den minste og tetteste teksten i appen.

**C30. Klikkflate under 44px.** `.feil button` («Lukk») er `height: 36px`
(`styles.css:497`). Alle andre knapper i appen holder 44; denne ene er glemt.

**C31. Sjargong i det brukeren ser — rå feilstrenger.** Åtte `String(e)`
(`App.tsx:230, 283, 303, 315, 333, 348, 357, 410`) sender Rust/Tauri-tekst rett inn i et
`role="alert"`-banner. Bestemoren får «Error: Os { code: 2, kind: NotFound … }».

**C32. Sjargong — rå toppfeltnøkler.** «Vis detaljer» (`App.tsx:593-608`) viser
`<dt>`-ene ordrett fra fila: `id`, `type`, `kilde`, `hash`. Det er filformatets vokabular,
ikke hennes. Enten oversett nøklene, eller kall knappen «Vis feltene slik de står i fila».

**C33. Ikon uten ord.** `<kbd>⌘F</kbd>` (`App.tsx:457`) står alene inne i søkefeltet — det
eneste tegnet i appen uten et ord ved seg. På `Nytt notat ⌘N` (`:499`) er det greit, men der
havner symbolet i knappens tilgjengelige navn, så skjermleseren leser «⌘» høyt. Legg
`aria-hidden="true"` på begge `kbd` og bruk `aria-keyshortcuts="Meta+N"`.

**C34. Hurtigtast som eneste vei — Escape flytter fokus til skriveflaten.**
`App.tsx:433`. Det finnes ingen synlig knapp som gjør det samme. (Tab kommer dit, men ikke
fra vilkårlig sted.) Mindre alvorlig enn C35, men samme regel.

**C35. Noe går tapt uten vei tilbake — Escape tømmer søket.** `App.tsx:429-432` nuller
`query`, `treff` og `spurt` fra hvor som helst i appen, også mens fokus er i editoren. En
lang søkestreng er borte uten angremulighet. Gjør Escape kontekstavhengig (bare når fokus er
i søket), slik «Vis alle» (`:459-471`) allerede er den synlige veien.

**C36. Noe går tapt uten vei tilbake — «Last inn på nytt».** Se A9.

**C37. Kantfarger under kravet til ikke-tekstkontrast.** `--rule` gir **1,35:1** mot
`--paper` og **1,18:1** mot `--ground` i lyst tema (1,26 / 1,37 i mørkt) — WCAG 1.4.11 krever
3:1 for kanten som identifiserer en kontroll. Det gjelder søkefeltet (`styles.css:168`),
`.tøm`/`.bryter`/`.nytt` (`:203`), `.tema select` (`:234`), `.rettefelt input` (`:673`),
`.retteknapper button` (`:727`) og `.angre/.påNytt button` (`:775`). Knappene ser ut som
flater uten kant for den som ser dårlig — «ingenting er skjult» gjelder også kanten rundt
det man skal trykke på.

---

## Tema — egen vurdering

Temaaksen er den friskeste delen. `tema.ts` setter `data-tema` på `<html>` før første
tegning (`main.tsx:8`), CSS-en dekker både `@media (prefers-color-scheme: dark)` med
`:not([data-tema="lyst"])`-vakt (`styles.css:39-58`) og de to eksplisitte valgene
(`:60-85`), `color-scheme` settes for begge (`:79-85`), og editoren arver fordi
`Editor.tsx:13-45` bruker de samme variablene i stedet for egne farger. Panel og editor
følger med. De to reelle svakhetene i temaet er A8 (`--ink-faint` i lyst tema) og C37
(kantene i begge), pluss at valget «Følg systemet» ikke annonseres når systemet faktisk
skifter — det skjer stille, men det er akseptabelt.
