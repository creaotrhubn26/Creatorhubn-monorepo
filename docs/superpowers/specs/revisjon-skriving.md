# Revisjon: skriveopplevelsen i Notater

Akse: alt som skjer mens noen skriver. Kun lesing — ingen endringer gjort.
Kodebase: `apps/creatorhub-notes/app/` i worktreet `notes-fase1`.

Alle påstander om CodeMirror-oppførsel er verifisert mot koden i
`node_modules/` (versjonene som faktisk er låst i `package.json`), og
markdown-påstandene er verifisert ved å kjøre `@lezer/markdown`-parseren med
appens egen `HighlightStyle`-tag-liste mot et testdokument.

**Antall: 15 ødelagt, 34 friksjon, 18 mangler = 67 funn.**

---

## ØDELAGT — tap av arbeid, feil oppførsel, må gjøres om igjen

### 1. Angre krysser notatgrenser og skriver notat A sitt innhold inn i notat B sin fil
`Editor.tsx:250-299`. `EditorView` opprettes én gang (`useEffect(..., [])`) og
historikken nullstilles aldri. Hvert notatbytte er en helt vanlig transaksjon
(`v.dispatch({changes: {from:0, to:len, insert: doc}})`, Editor.tsx:290-294) og
havner i angrestakken. `bytter.current` (Editor.tsx:289) hindrer bare at
*innlastingen* utløser lagring — den hindrer ikke at innlastingen kan angres.
⌘Z i notat B setter dokumentet tilbake til notat A sin tekst, `bytter.current`
er `false` nå, `updateListener` (Editor.tsx:267) kaller `onChange`, og
`App.skriv` (App.tsx:242-251) lagrer A-teksten til B-fila 900 ms senere.
Notat B er borte.

### 2. Første ⌘Z etter appstart tømmer notatet
Samme mekanisme. Ved første åpning byttes dokumentet fra `""` til notatets
tekst. ⌘Z — en refleks når man tror man skrev feil — gir et tomt dokument som
autolagres over fila. Ett tastetrykk, hele notatet.

### 3. Backspace øverst i teksten sletter frontmatteren usynlig
`skjulToppfelt` (Editor.tsx:107-115) legger `0..slutt` ut både som
`Decoration.replace({block:true})` og som `EditorView.atomicRanges`.
`deleteBy` i `@codemirror/commands:1185` utvider en sletting som treffer et
atomisk område til hele området. Ett trykk på Backspace ved starten av den
synlige teksten fjerner `---/id:/type:/---`. Skjermen ser uendret ut fordi
blokka var usynlig; det eneste synlige er at «Vis detaljer» forsvinner.
Notatets `id` — som `minne`/rettelser henger på — er borte, og autolagringen
skriver det til disk 900 ms senere.

### 4. ⌘A og så skrive sletter frontmatteren
`selectAll` setter `{anchor: 0, head: doc.length}` direkte, uten
`skipAtomicRanges` (den kjøres bare for muse­hendelser,
`@codemirror/view:3832,4087`). Markeringen dekker den usynlige blokka. Hun ser
«alt er markert», skriver, og bokføringen er borte.

### 5. ⌘A ⌘C tar med tre linjer skjult bokføring i utklippstavla
Samme rot. Kopierer man «hele notatet» får man `---\nid: 2026-09-13-…\ntype:
\n---` på toppen, uten å ha sett det.

### 6. ⌘↑ setter markøren et sted som ikke finnes på skjermen
`cursorDocStart` går til posisjon 0, som ligger inne i den erstattede
blokka. Markøren rendres ikke noe sted. Skriver hun nå, havner tegnet foran
`---`, `toppfeltSlutt` (Editor.tsx:88-95) returnerer `null`, og hele
frontmatteren spretter fram som tre linjer råtekst i toppen av notatet.

### 7. Mislykket lagring kaster den ulagrede teksten
`App.tsx:213-232`. `uskrevet.current = null` settes **før** `await
writeNote(...)`. Feiler skrivet (full disk, låst fil, permission) settes `feil`
og funksjonen returnerer — men bufferet er allerede tømt, timeren er ryddet, og
ingenting prøver på nytt. Teksten finnes bare i editorens minne. Neste
tastetrykk oppretter et nytt buffer; skriver hun ikke mer, er den tapt ved
lukking.

### 8. Ingenting tømmer bufferet når vinduet lukkes
Ingen `beforeunload`, ingen `onCloseRequested`, ingen `blur`-lytter
(verifisert med grep over `src/` og `src-tauri/src/`). ⌘Q eller ⌘W innen
900 ms etter siste tastetrykk (`App.tsx:248`) mister det som ble skrevet, uten
varsel. Det er nettopp mønsteret «skriv siste setning, lukk vinduet».

### 9. Lagring er ikke atomisk
`lib.rs:312-317` bruker `std::fs::write`, som trunkerer først og skriver
etterpå. Med autolagring hvert 900 ms er vinduet for en halvskrevet fil åpent
titalls ganger i timen. Krasj eller strømbrudd der gir en avkortet md-fil.
Skriv til `<fil>.tmp` og `rename`.

### 10. Innliming er asynkron og bruker en foreldet posisjon
`Editor.tsx:188-213`. `const { from, to } = view.state.selection.main` fanges
**før** `await importerSamtale(tekst)` (en IPC-runde), og innsettingen skjer
i en egen transaksjon etterpå med de gamle tallene. Skriver hun videre, limer
igjen, eller flytter markøren mens kallet er underveis, settes teksten inn der
markøren *var*. Alt flerlinjes lim går denne veien (Editor.tsx:193).

### 11. Lim av flere linjer kan bli skrevet om til en «samtale» den ikke er
`samtale.rs:45-49` krever 3 innlegg, 2 avsendere og 80 % dekning;
`navn_ok` (samtale.rs:88-110) krever bare stor forbokstav, høyst fire ord og
at ordet ikke står på `STOPPORD`. En limt ordliste, feilkodetabell eller
spesifikasjon med linjer som `Input: …` / `Output: …` / `Feilkode: …` /
`Kubernetes: …` passerer alle tre. Da byttes teksten hennes ut med
innleggsformat, **og** `kilde: samtale` skrives inn i frontmatteren
(Editor.tsx:196-205). Knappen «Ikke en samtale» (App.tsx:590) fjerner bare
feltet — omskrivingen av teksten står igjen.

### 12. Å lime inn et bilde gjør ingenting, uten en lyd
`Editor.tsx:191` leser bare `text/plain`. Er den tom returneres `false`, og
CMs egen paste-handler kaller `doPaste("")`. Ingen fil skrives, ingen melding.

### 13. Å slippe en fil på skriveflaten gjør ingenting
`tauri.conf.json` setter ikke `dragDropEnabled`, og standarden i Tauri v2 er
`true` — OS-slipp fanges av Tauri og HTML-`drop` når aldri CMs
`handlers.drop` (`@codemirror/view:4870`, som faktisk kan lese tekstfiler).
Ingen av sidene tar imot.

### 14. Å klikke under siste linje mister markøren
`.cm-content` er 44rem bred og sentrert (Editor.tsx:29-31); `.cm-scroller` har
`padding: 28px 0 45vh` (Editor.tsx:26). CM binder alle musehendelser på
`contentDOM`, ikke på scrolleren (`@codemirror/view:4340`). Klikk i de nederste
45vh — det vanligste stedet å klikke for å fortsette å skrive — eller i
sidemargen treffer scrolleren: ingen markørplassering, og fokus forlater
contenteditable. Neste tastetrykk går ingen steder. Med panelet skjult i
standardvinduet er det ~168 px død sone på hver side.

### 15. Et notat som *begynner* med `---` som skillelinje kollapser
`toppfeltSlutt` (Editor.tsx:88-95) krever bare at linje 1 er `---` og leter
etter neste `---`. Alt imellom skjules som atomisk blokk. Innholdet er ikke
tapt på disk, men det kan verken ses, redigeres eller markeres i appen.

---

## FRIKSJON — virker, men koster oppmerksomhet hver gang

### 16. All listetekst er aksentgrønn, ikke bare kulepunktet
`@lezer/markdown:1972` tagger **alle etterkommere** av `BulletList`/
`OrderedList` med `tags.list` (`"OrderedList/... BulletList/..."`), og
Editor.tsx:57 gir den taggen `color: var(--accent)`. Verifisert med
parseren: teksten « punkt en » får klassen `list`, ikke bare `-`.
Et notat som er halvt punktliste er halvt grønt. Taggen for selve merket er
`processingInstruction`, som allerede er stylet på Editor.tsx:58.

### 17. Teksten hopper sidelengs når markøren går inn i en overskrift
`byggMerker` (Editor.tsx:127-149) viser markdown-merkene igjen på linja
markøren står i. Verifisert: `#` på en H1 arver `heading1`, altså 1,5 em
(probe gir klassene `h1 pi` på `"#"`). Klikker du midt i en overskrift, rykker
hele linja ~26 px til høyre i samme øyeblikk — tegnet du siktet på er ikke der
lenger.

### 18. Avsnitt kan hoppe opp og ned mens du piler gjennom teksten
Samme mekanisme, vertikalt. Med `EditorView.lineWrapping` kan et avsnitt med
`**` i seg endre antall visuelle linjer når merkene dukker opp/forsvinner, og
alt under flytter seg.

### 19. Halve markdownen skjules, halve står synlig
`merker` (Editor.tsx:98) er bare `HeaderMark` og `EmphasisMark`. Verifisert
mot parseren: `>`, backticks (`CodeMark`), `[…](…)` (`LinkMark`) og hele URL-en
står synlig hele tiden. Resultatet er verken ren lesetekst eller ren kilde — det
er en tredje ting man må lære seg.

### 20. Ingen søk i notatet
`minimalSetup` inneholder ikke `@codemirror/search`
(`codemirror/dist/index.js:85-94`), og ⌘F er kapret globalt til å søke i
*alle* notater (`App.tsx:425-428`). I et notat på tusen linjer finnes det
ingen måte å finne et ord på. Ingen erstatt heller.

### 21. Tab forlater skriveflaten
Verken `indentWithTab` eller noen annen Tab-binding er med
(`@codemirror/commands` eksporterer den, men `defaultKeymap` inneholder den
ikke). Nettleserens standard tar over og flytter fokus til neste element —
altså inn i panelet. Midt i en punktliste er Tab det naturlige for å nøste
inn; her mister du skriveplassen.

### 22. Escape midt i skrivingen tømmer søket
`App.tsx:429-434` lytter på `window`. Escape trykket i editoren nullstiller
`query`, `treff` og `spurt`. Listen til venstre skifter under henne uten at hun
gjorde noe i den.

### 23. Ingen snarvei for fet, kursiv eller lenke
Ingen `keymap` i frontend i det hele tatt (grep over `src/`). ⌘B, ⌘I og ⌘K
gjør ingenting; `**`, `_` og `[…](…)` må skrives for hånd. Å lime en URL over
markert tekst gir ikke `[tekst](url)`.

### 24. Ingen autolukking av parenteser og anførselstegn
`closeBrackets` er i `basicSetup`, ikke i `minimalSetup`.

### 25. Ingen norske anførselstegn, og plattformens egne er slått av
`@codemirror/view:7949` setter `autocorrect: "off"` og `autocapitalize: "off"`
på contentDOM. macOS' egen tekstsubstitusjon (smarte hermetegn, tankestrek) er
dermed avskrudd, og appen har ingen erstatning. «…» må skrives med
tastekombinasjon hver gang.

### 26. Ingen flermarkør, ingen kolonnemarkering
`EditorState.allowMultipleSelections` og `rectangularSelection` er begge bare i
`basicSetup`. Alt-klikk og Alt-dra gjør ingenting.

### 27. Ingen indikator når du drar tekst
`dropCursor` mangler. Dra-og-slipp av markert tekst fungerer (CM håndterer
det selv), men du ser ikke hvor den havner før du slipper.

### 28. Ingen GFM: tabeller, oppgavelister og gjennomstreking finnes ikke
`markdown()` kalles uten `base` (Editor.tsx:258), og standarden er
`commonmarkLanguage`, ikke `markdownLanguage` (`lang-markdown:398`).
Verifisert mot parseren: `| a | b |` blir ett vanlig `Paragraph`,
`- [ ] oppgave` blir et vanlig `ListItem` med teksten `[ ] oppgave`, og
`~~strek~~` tokeniseres ikke i det hele tatt. Avkrysningslister er noe av det
en notatapp brukes mest til. Rettelsen er ett ord: `markdown({ base:
markdownLanguage })`.

### 29. Kodeblokker ser ikke ut som kodeblokker
`CodeMark` (```` ``` ````) har bare `processingInstruction` (verifisert), altså
kun farge — den står i serif brødskrift over kode i mono 0,86 em. Ingen
bakgrunn, ingen ramme, ingen visuell blokk.

### 30. Språknavnet på en kodeblokk står i brødskrift
`CodeInfo` → `tags.labelName`, som ikke finnes i `markdownFarger`
(Editor.tsx:47-59). «js» etter ` ``` ` rendres i serif ved siden av mono.

### 31. Vannrett strek rendres som liten monospace-tekst
`tags.contentSeparator` er slått sammen med `tags.monospace` på Editor.tsx:55.
`---` midt i et notat blir små grå bindestreker i kodeskrift, ikke en strek.

### 32. Overskrifter har ingen luft over eller under
`markdownFarger` (Editor.tsx:48-50) setter bare `fontSize` og `fontWeight`.
En H2 midt i teksten står like tett inntil avsnittene som et avsnitt gjør, og
`lineHeight: "1.3"` på H1 gjør overskriften *tettere* enn brødteksten (1,78).
Strukturen i et langt notat er vanskelig å se på avstand.

### 33. Den bleke fargen er under kontrastkravet i lyst tema
`--ink-faint` `#7c8683` mot `--paper` `#fbfcfb` er **3,65:1** (regnet fra
styles.css:13 og :10). Den fargen bærer alle synlige markdown-merker og alle
URL-er i teksten (Editor.tsx:54, 58) — altså innhold, ikke bare pynt. I mørkt
tema er samme par 4,54:1 og greit. `--ink-soft` er 6,7:1 og fint.

### 34. Ingen kontroll på skriftstørrelse
17,5 px er hardkodet i temaobjektet (Editor.tsx:19), og ⌘+/⌘− finnes ikke.
Linjelengden på 44rem (Editor.tsx:29) gir ~73 tegn ved den størrelsen — i
overkant, men brukbart; problemet er at ingen av delene kan justeres.

### 35. Notatlista omorganiserer seg hver gang hun tar en pause
`lagre` kaller `setNotes(await listNotes())` (App.tsx:235), lista er sortert
på `modified` (lib.rs:297), og daggrupperingen bygges om (App.tsx:49-58). Det
åpne notatet hopper til toppen 900 ms etter hvert avbrudd i skrivingen.
Bevegelse i øyekroken som ikke forteller henne noe.

### 36. Statuslinja blinker rett over teksten
«Lagrer …» → «Lagret 14:32» veksler ved hver pause, i `aria-live="polite"`
(App.tsx:587), i samme linje som notattypen.

### 37. Varselbannere dytter hele skriveflaten nedover
`feil` (App.tsx:567) og `endretUtenfor` (App.tsx:610) settes inn som søsken
over `<Editor>` i en flex-kolonne. Når de dukker opp flytter teksten seg ~45 px
ned midt i en setning. Det samme gjør «Vis detaljer» (App.tsx:599).

### 38. Notatet åpnes alltid nederst
Editor.tsx:286-294 setter `anchor = doc.length` med `scrollIntoView` når
`selectTitle` er `false`. Ingen markør- eller rulleposisjon huskes per notat;
åpner du et langt notat for å lese midtpartiet, må du rulle dit hver gang.

### 39. Notatet lastes stille inn på nytt under markøren
`App.tsx:384-390`: er det ingen ulagrede endringer, byttes hele dokumentet ut
uten å spørre. Editor.tsx:311-322 klipper bare markøren til ny lengde. Endret
noe teksten *ovenfor* markøren (git-synk, `notat`-CLI), står markøren nå et
annet sted i setningen enn der hun forlot den. Kommentaren i koden er ærlig om
det, men konsekvensen er reell.

### 40. Frontmatteren kan ikke redigeres fra appen
Den er skjult og atomisk (Editor.tsx:107-115), og «Vis detaljer»
(App.tsx:599-608) er ren visning. `create_note_in` skriver `type: ` tomt
(lib.rs:215) — det feltet kan aldri fylles ut herfra, og `topp.etikett`
(App.tsx:83) sier derfor alltid «Notat».

### 41. Appens egne tekstbytter legger seg i samme angrestakk som skrivingen
«Dette er en samtale» (App.tsx:325-335) og «Last inn på nytt»
(App.tsx:292-305) går gjennom `[doc]`-effekten (Editor.tsx:311-322) som en
vanlig transaksjon. ⌘Z etterpå angrer *appens* endring, ikke hennes siste
setning — og utløser en lagring (samme mekanisme som funn 1).

### 42. Ingen «lagre nå»
⌘S er ikke bundet noe sted. Vil hun være sikker før hun lukker, finnes det
ingen handling å gjøre.

### 43. Hvert flerlinjes lim koster en IPC-runde før teksten står der
Editor.tsx:207. Kommentaren sier «under et millisekund», og det gjelder
gjenkjenningen — men `invoke` + serialisering av hele den limte teksten kommer
i tillegg, og teksten dukker opp etter en synlig forsinkelse.

### 44. `git add -A` + full reindeksering ved hver skrivepause
`lagre` kaller `reindex()` (App.tsx:234) → `reindex_in` (lib.rs:278-289), som
kjører `git add -A` på hele notatmappen og `index::run_no_embed` over alt,
900 ms etter siste tastetrykk. For én endret fil.

### 45. Selve lesningen (`understand_note`) starter også ved hver pause
App.tsx:225. Panelet til høyre bygges om mens hun tenker på neste setning.
Det er avbrytbart og kan skrus av, men standarden er på.

### 46. Markdown-merkene bygges om for hele dokumentet ved hvert tastetrykk
`byggMerker` (Editor.tsx:136) itererer `from: toppfeltSlutt ?? 0, to:
doc.length` og bygger hele dekorasjonssettet på nytt ved `docChanged`,
`selectionSet` **og** `viewportChanged` (Editor.tsx:158). CMs konvensjon er
`view.visibleRanges`.
**Målt:** 1000 linjer / 83 KB gir 6299 noder, 3850 dekorasjoner, 0,15 ms for
treiterasjonen og 0,14 ms for å bygge settet. Det er altså *ikke* et problem i
dag — det skalerer bare lineært med dokumentlengden i stedet for med
skjermhøyden. Lav prioritet; ta det når noen har et notat på 10 000 linjer.

### 47. Over ~100 KB slutter merkene å skjule seg
`@codemirror/language:613` parser bare `viewport + 100 000` tegn i bakgrunnen.
Utover det finnes ikke syntakstreet `byggMerker` leter i, så `#` og `**` står
rå. Realistisk sjelden i personlige notater, men grensen finnes.

### 48. Aksenten er den eneste fargen i teksten
`tags.link` og `tags.list` bruker begge `var(--accent)` (Editor.tsx:53, 57), og
lenker og listepunkter blir dermed umulige å skille fra hverandre på farge
alene.

### 49. Ingen aktiv-linje-markering, og ingen erstatning for den
Bevisst utelatt fra `minimalSetup`, og det er riktig for prosa — men det gjør
også at det ikke finnes noe visuelt anker når man kommer tilbake til vinduet
etter å ha vært i en annen app.

---

## MANGLER — finnes ikke, og noen vil savne det

### 50. Stavekontroll
`@codemirror/view:7949` setter `spellcheck: "false"` på contentDOM, og appen
overstyrer det ikke. En norsk notatapp for én person som tenker skriftlig, uten
stavekontroll. Rettelsen er én linje:
`EditorView.contentAttributes.of({ spellcheck: "true", lang: "nb" })`.

### 51. Ordtelling
Ingen ord-, tegn- eller lesetidsteller noe sted. For den som skriver for å
tenke er «hvor mye har jeg skrevet i dag» det enkleste målet som finnes.

### 52. Folding
`markdown()` registrerer allerede `headerIndent` som `foldService`
(`lang-markdown:43-55`) — muligheten til å folde en seksjon under en overskrift
ligger der ferdig. Det som mangler er `foldGutter()` og `foldKeymap`. Uten det
er et langt notat en uavbrutt rull.

### 53. Innholdsfortegnelse / hopp til overskrift
Panelet til høyre er forståelse, ikke struktur. Det finnes ingen oversikt over
overskriftene i notatet og ingen måte å hoppe til en av dem.

### 54. Fokusmodus og skrivemaskinrulling
Ingen måte å dempe alt utenom avsnittet man skriver i, og ingen måte å holde
den aktive linja midt på skjermen. `padding-bottom: 45vh` (Editor.tsx:26) er en
halv løsning på det siste.

### 55. Skrivemål
Ingen dagsmål, ingen streak, ingen «i dag har du skrevet».

### 56. Sett inn dato eller klokkeslett
Ingen snarvei. I et notat som brukes som logg er det den hyppigste
innsettingen som finnes.

### 57. Maler for nytt notat
`create_note_in` (lib.rs:195-222) skriver alltid samme skjelett. Ingen
mal for møtereferat, dagbok, beslutning — selv om `type:`-feltet i
frontmatteren tydelig er ment for akkurat det (og aldri kan fylles ut, se
funn 40).

### 58. Hurtiginnsetting / snippets
`autocompletion` er ikke med i `minimalSetup`. Ingen `/`-meny, ingen
tekstutvidelser, ingen emoji-fullføring.

### 59. Del notatet i to ved markøren
Et notat som har vokst til to temaer må deles for hånd: nytt notat, klipp, lim,
slett.

### 60. Lenke til et annet notat for hånd
Appen kobler notater automatisk i panelet («det du har tenkt om det samme
før»), men hun kan ikke selv skrive en lenke til et notat hun vet finnes. Ingen
`[[…]]`, ingen fullføring på notattittel.

### 61. Bilder og vedlegg
Ingen visning av `![…](…)` (verifisert: `Image` parses, men rendres som
råtekst), ingen måte å lagre et limt eller sluppet bilde inn i notatmappen.

### 62. Fotnoter
Verifisert mot parseren: `[^1]` blir en `Link` og farges aksent, og
definisjonen `[^1]: noe` gir «noe» URL-farge. Det ser ut som en lenke, oppfører
seg ikke som noe.

### 63. Tab/Shift-Tab for å nøste punktlister
Enter fortsetter en liste (`markdownKeymap` legges inn med `Prec.high` av
`markdown()`, `lang-markdown:419` — dette *virker*), og Backspace fjerner ett
nivå markup. Men det finnes ingen måte å rykke et punkt inn eller ut på, som er
halve poenget med en punktliste.

### 64. Angrehistorikk overlever ikke omstart
Og appen har ingen versjonshistorikk selv om notatmappen er et git-repo:
`reindex_in` kjører `git add -A` men aldri `commit` (lib.rs:280, med
kommentaren om at `notat sync` gjør det). Ingen «vis tidligere versjon», ingen
gjenoppretting av et notat hun skrev over.

### 65. «Gå tilbake til forrige notat»
Ingen ⌘[ / ⌘], ingen historikk mellom notater. Klikker du feil i lista, må du
finne veien tilbake selv.

### 66. Ingen test dekker skriveflaten
`src/panel.test.ts` er den eneste testfila i frontend. Ingenting verifiserer
angre, notatbytte, innliming, frontmatter-skjuling eller markørbevaring — som
er nøyaktig der de fem alvorligste funnene over ligger.

### 67. Ingen «marker som ferdig»-følelse i selve teksten
Uten GFM-oppgavelister (funn 28) finnes det ingen måte å hake av noe i
notatet, og panelets `oppgave`-merke er lesing, ikke redigering.

---

## Om aksen

Tynn del: **ytelse ved tusen linjer**. Jeg målte det (funn 46) og fant at
det helhetlige gjennomløpet koster 0,3 ms per tastetrykk ved 1000 linjer /
83 KB. Det er en skaleringsdefekt, ikke et opplevd problem, og jeg har rangert
det deretter i stedet for å blåse det opp.

Tykk del: **markørens forhold til den skjulte frontmatteren** (funn 3-6, 15,
40) og **angrehistorikkens forhold til notatbytte** (funn 1, 2, 41). De to
mekanismene står for åtte av de femten ødelagte funnene, og begge har den
samme grunnformen: en tilstand som lever lenger enn dokumentet den gjelder for.
