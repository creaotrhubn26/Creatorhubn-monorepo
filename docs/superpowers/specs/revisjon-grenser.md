# Revisjon: grensetilfeller, feiltilstander og ytelse

Notatappen (`apps/creatorhub-notes/app/`) og indekseren (`apps/creatorhub-notes/indexer/`).
Kun lesing. Målinger er gjort mot syntetiske baser/mapper i scratchpad med samme skjema,
samme spørringer og samme git-oppsett som appen bruker — aldri mot `~/CreatorHub-notater/`
eller den ekte basen.

Målte tall som brukes nedenfor:

| Måling | Resultat |
|---|---|
| `minne::kandidater`-spørringen, 5000 rader i `forstatt`/`forstatt_fts` | **5,3 ms per avsnitt** |
| `minne::synk` — 1 transaksjon, delete + 5000 insert | 11 ms |
| `minne::lagre` — 5000 autocommit-upserts | 268 ms (og 263 ms når *ingenting* er endret) |
| samme, 2000 avsnitt, gjentatt 20 ganger | 106 ms per lagring, basen flater ut på 1,3 MB |
| `git add -A` / `git ls-files -s`, 1000 notater (10,5 MB) | 11 ms / 9 ms |
| `list_notes`: stat + les hele mappa, 1000 notater | 19 ms |
| FTS5-sitering (`quote_fts_query`, `fts_uttrykk`) mot 12 rare søk | ingen syntaksfeil — holder |

---

## Ryker

### 1. «Dette er en samtale» skriver over alt som er skrevet siden notatet ble åpnet
`App.tsx:328` — `byttSamtale` leser `uskrevet.current?.content ?? doc`. `doc` settes bare av
`åpne`/`lastInnPåNytt`; tasting oppdaterer den **aldri** (`skriv`, `App.tsx:242`, rører bare
`uskrevet.current`), og `lagre` nullstiller `uskrevet.current` (`App.tsx:217`). Forløp: skriv i
ti minutter → autolagring → trykk knappen → `settSamtale` får teksten fra da notatet ble åpnet,
`setDoc(ny)` erstatter skriveflata, `lagre()` skriver den til disk. Ti minutter borte fra både
skjerm og fil, uten et varsel.

### 2. Den samme foreldede teksten merker brukerens rettelser som utdaterte
`App.tsx:318` (`rett`) og `App.tsx:493` (panelbryteren) sender samme foreldede `doc` inn i
`understand_note`. `minne::synk` (`minne.rs:152`) sletter `avsnitt`-radene for alt som er skrevet
etter at notatet ble åpnet, og `rettelser::foreldede` (`lib.rs:497` → `rettelser.rs:148`) setter
`foreldet = 1` på rettelsene deres. Brukeren får ««X» er lest på nytt, fordi avsnittet er skrevet
om» for et avsnitt hun ikke har rørt — og rettelsen, det eneste i systemet migreringsdokumentet
sier ikke kan gjenskapes, er borte.

### 3. `minne::tidligere` kjører ett FTS-oppslag per avsnitt, uten grense
`minne.rs:561-575`. Målt 5,3 ms per avsnitt mot ekte skjema: 1000 avsnitt = 5 s, 5000 avsnitt
(importert samtale) = **26 s ren SQL per lagring**, pluss inntil 15 000 `lagret_forhold`-oppslag
(`minne.rs:547`) — alt med `understand::memo()` holdt låst (`lib.rs:401`). Bare *modellkallene* er
begrenset (`MAKS_PAR = 15`, `minne.rs:417`); oppslagene er det ikke. Kjøres på hver
900 ms-pause i skrivingen.

### 4. `kjør` sjekker aldri exitkoden og kaster stderr
`understand.rs:642-668`. `claude` som ikke er innlogget, er rate-limitet eller vil oppgraderes
avslutter med kode ≠ 0 og tom stdout. `kjør` returnerer `Ok("")`, `parse` gir null linjer,
`understand` returnerer `Ok(vec![])` — og panelet skriver **«Ingenting er bestemt ennå.»**
(`Panel.tsx:360`) om et notat fullt av beslutninger. Den ene tilstanden som faktisk sier ifra
(`Understanding::off()`) krever at binæren mangler eller at 300 s-grensa slår inn.

### 5. `memo.clear()` kaster labelene samme kall nettopp hentet fra basen
`understand.rs:515`. `understand_note` fyller memoen fra `minne::kjente` (`lib.rs:420`, riktig), og
`understand` tømmer så hele kartet når `memo.len() > 4000` og det finnes minst ett ukjent avsnitt.
`ukjente` er beregnet først, så ingenting reklassifiseres — men sluttfiltreringen
(`understand.rs:539`) og `nye()` (`understand.rs:462`) slår opp i den tomme memoen. Skriv én ny
setning i en økt der 4000+ avsnitt er lest, og panelet faller fra tusenvis av linjer til én.
Neste lagring henter dem tilbake. Panelet blinker frem og tilbake mens hun skriver.

### 6. En symlenket `.md`-fil rømmer notatmappen, begge veier
`resolve_in` (`lib.rs:143-161`) kanoniserer *forelderen* og setter filnavnet på igjen — fila si
egen symlenke løses aldri. `~/CreatorHub-notater/x.md -> ~/.ssh/config` leses av `read_note`,
indekseres inn i søkebasen av `read_if_indexable` (`gitsrc.rs:68`), og **trunkeres** av
`write_note` (`lib.rs:316`). Doc-kommentaren og testen (`lib.rs:194`) dekker bare en symlenket
*mappe*, som er det eneste kanoniseringen faktisk fanger.

### 7. `fs::write` er ikke atomisk, og `uskrevet.current` er tømt før den kalles
`lib.rs:316` trunkerer og skriver. Full disk, tapt nettverksdisk eller krasj midtveis gir et
avkortet eller tomt notat. Og `lagre` (`App.tsx:217`) setter `uskrevet.current = null` *før*
`await writeNote`, så ved feil ligger teksten bare i CodeMirror uten noen ventende lagring:
bytter hun notat, returnerer `lagre()` med det samme og `åpne` bytter ut bufferet. Den røde
linja er hele sporet.

### 8. Uten `git` er hele appen død
`notes_dir()` kjører `git init` når `.git` mangler (`lib.rs:68`) og returnerer `Err` hvis git ikke
starter — og *alle* kommandoer kaller `notes_dir()`. På en Mac uten kommandolinjeverktøyene er
appen en rød linje: `git ["init", "-q"] startet ikke: No such file or directory`. Ingen
notatliste, ingen skriveflate, ingen søk.

### 9. Notatmappe på en avmontert nettverks-/iCloud-disk byttes stille ut
`notes_dir()` (`lib.rs:59-70`) gjør `create_dir_all` + `git init` hver gang mappa ikke finnes.
Faller volumet ut, lager appen et tomt repo på monteringspunktet, `reindex` ser at
`git ls-files` er tom og purger hver eneste bit fra indeksen (`index.rs:~180`), og brukeren ser
en tom notatliste uten en eneste feilmelding.

### 10. Ingenting rydder `avsnitt`/`forstatt`/`relasjoner` for slettede eller flyttede notater
`synk` sletter bare rader for den kilden den skriver akkurat nå (`minne.rs:152`); indekseren har
`path_state` for dette, appens egne tabeller har ingenting. Slett et notat i Finder, og linjene
svarer fortsatt på «hva er uavklart» (`minne::spør`) og dukker opp under «Tidligere om dette» —
klikk gir «kunne ikke lese …». Døp det om, og du har to sett av hver linje, gammelt og nytt,
begge «sanne».

### 11. Én null-byte i et notat slår av panelet for det notatet, permanent
NUL er gyldig UTF-8 og overlever `read_note` og `split`, men `Command::arg(prompt)`
(`understand.rs:645`) feiler ved spawn med «nul byte found in provided data» → første pakke
feiler → `Understanding::off()` (`lib.rs:467`). Brukeren får «Forståelsen er ikke tilgjengelig nå»
for akkurat dette notatet og ingen andre, uten en grunn.

### 12. Ett avsnitt over ~1 MB kan ikke klassifiseres i det hele tatt
Prompten går som et argv-element (`understand.rs:645`), og `batches_med` legger et element som er
større enn budsjettet alene i sin egen pakke (`embed.rs:54-77`). Lim inn en minifisert JSON-blokk
uten tomlinjer → spawn feiler med E2BIG → panelet av. `TOKENER_PER_PAKKE` (`understand.rs:70`)
beskytter mot en stor *pakke*, ikke mot ett stort avsnitt.

### 13. To skrivere, én git-indeks
`REINDEX` (`lib.rs:24`) er en prosesslokal mutex, og det finnes ingen single-instance-vakt i
`tauri.conf.json`. To appvinduer, eller appen samtidig med `notat sync`, kjører `git add -A` i
samme repo → `Unable to create index.lock` → `reindex_in` feiler → brukeren får «Notatet er
lagret, men søket er ikke oppdatert ennå» (`App.tsx:238`) uten antydning om hvorfor eller om det
går over.

### 14. Migreringen kan kjøre flere ganger samtidig
`base()` kjører `migrering::kjør` på *hver* tilkobling (`lib.rs:581-584`) — inkludert den
`spor_notater` åpner per 160 ms søketastetrykk. Første oppstart etter oppgraderingen ser to
samtidige kommandoer `trengs() == true`, begge tar en `vacuum into`-kopi, og taperen feiler på
`create table avsnitt` → «fikk ikke migrert notatbasen». På en base på flere hundre megabyte
kopierer `vacuum into` dessuten hele fila med grensesnittet frosset og uten en melding.

### 15. Avslutning innen 900 ms etter siste tastetrykk mister det
Autolagringen er en `setTimeout` (`App.tsx:248`), og det finnes verken `onCloseRequested` i
`run()` (`lib.rs:635-660`) eller `beforeunload` i frontend. ⌘Q rett etter en setning kaster
debounce-vinduet.

### 16. Rettelser gjort mens basen er kortvarig utilgjengelig lagres til ingenting
Feiler `base()` i `understand_note`, svelges det (`base().ok()`, `lib.rs:390`), alle avsnitt får
`id: 0` (`lib.rs:~460` via `sett_ider`), og panelet tegnes som vanlig. En rettelse på en slik linje
sendes med `avsnittId: 0`; `rettelser::lagre` (`rettelser.rs:103`) skriver glad en rad med
primærnøkkel 0 som `aktive()` aldri kan returnere, fordi den joiner `avsnitt`. Linja går tilbake
ved neste lesning, og spøkelsesraden mater `minne::eksempler` inn i hver eneste prompt for alltid.

### 17. To ulikt navngitte notater kan bli den samme fila
`slug` (`lib.rs:166-179`) beholder bare `[a-z0-9-æøå]`, så «日本語» og «Проект» blir begge `notat`,
og `create_note_in` returnerer den eksisterende fila urørt når en tittel er oppgitt
(`lib.rs:205-215`). Latent i dag: grensesnittet kaller alltid `createNote("")`, som går i
løpenummer-grenen. Det er en felle for neste kaller, ikke en feil brukeren møter nå.

---

## Vondt

### 18. Klassifiseringen holder en prosessglobal lås gjennom hvert eneste CLI-kall
`lib.rs:401` tar `understand::memo()` og holder den hele lesningen. En samtale på 5000 innlegg er
63 pakker × 13-78 s ≈ 25 minutter. `avbryt_lesning` virker bare mellom pakker
(`understand.rs:534`), så bytter hun notat, står det nye panelet på «Leser notatet.» til den
løpende pakken er ferdig — i verste fall til `TIMEOUT` på 300 s (`understand.rs:45`), uten en
framdriftslinje, fordi `framdrift` bare settes av hendelser som ikke kommer.

### 19. `minne::lagre` skriver én autocommit-transaksjon per avsnitt
`minne.rs:257-278`. Målt: 268 ms for 5000 avsnitt, kalt én gang per pakke pluss én gang til slutt.
Og den skriver hver rad på nytt selv når ingenting er endret — `forstatt_au`-triggeren
(`minne.rs:80-85`) sletter og setter inn FTS-raden hver gang. Målt 106 ms per lagring for 2000
uendrede avsnitt. (Basen vokser ikke uten grense; FTS-en fletter seg flat på ~1,3 MB.)

### 20. Hver kommando åpner basen på nytt og kjører hele DDL-en
`base()` → `db::open` kjører skjemaet, fire `drop table if exists` (`db.rs:34`, `db.rs:77`),
vec0-tabellen og FTS-skjemaet; så `migrering::trengs` (to katalogspørringer), så
`rettelser::sørg_for_tabell` og `minne::sørg_for_tabeller`. Rundt tjue DDL-setninger per invoke —
og `spor_notater` fyrer på en 160 ms søkedebounce.

### 21. Oppryddingen i `synk` fullskanner `relasjoner` per fjernet avsnitt
`minne.rs:197`: `delete from relasjoner where avsnitt_id = ?1 or annen_id = ?1`. `or annen_id` kan
ikke bruke primærnøkkelen `(avsnitt_id, annen_id)`, så hver sletting er en full tabellskanning.
Å skrive om en stor samtale er O(fjernede × relasjoner).

### 22. `match_avsnitt` steg 1 er O(n·m) strengsammenligning
`identitet.rs:66-76`: hvert nytt avsnitt skanner alle kjente med `min_by_key`. 5000 × 5000 = 25
millioner sammenligninger per lagring. Kommentaren måler 300 avsnitt (190 µs); importtilfellet
modulen ble skrevet for er to størrelsesordener større, og `ponytail`-notatet på `identitet.rs:49`
peker på nettopp dette uten at det er gjort noe med.

### 23. `byggMerker` går gjennom hele dokumentet på hvert tastetrykk *og* hver markørflytting
`Editor.tsx:127-149`, utløst på `u.docChanged || u.selectionSet || u.viewportChanged`
(`Editor.tsx:158`). Iterasjonen går `from: toppfeltSlutt(doc)` til `to: doc.length`
(`Editor.tsx:138`) og bygger hele dekorasjonssettet på nytt — ikke bare viewportet. På et notat
på ti tusen linjer er dette det første som merkes i selve skrivingen.

### 24. `minne::kjente` bygger en `IN (…)` med én plassholder per avsnitt
`minne.rs:211-220`. Over SQLITE_MAX_VARIABLE_NUMBER (32766) feiler spørringen, og kalleren svelger
den med `if let Ok(kjente)` (`lib.rs:422`). Etter det er hvert avsnitt ukjent ved hver lagring, og
hele notatet reklassifiseres fra bunnen for alltid, 13-78 s per pakke. Langt under grensa er den
fortsatt en prepared statement på 5000 plassholdere som kompileres på nytt hver lagring.

### 25. `list_notes` leser hvert notat i sin helhet bare for å finne tittelen
`lib.rs:236-258`, `read_to_string` på `lib.rs:254`. Målt 19 ms for 1000 notater / 10,5 MB på varm
SSD — greit lokalt. Men den kjøres ved oppstart, etter hver lagring og på hver ekstern
endringsklase, og på iCloud/nettverksdisk eller med noen få 10 MB-notater blir den det tregeste
leddet. `search_notes` gjør det samme for inntil 80 treff (`lib.rs:340-348`).

### 26. Hele notatet gås gjennom på nytt ved hver lagring, selv når ett avsnitt er endret
Modellkallene er memoisert, men `split`, `synk`, `kjente`, `lagre`, `foreldede`, `aktive` og
`tidligere` går alle over hele notatet hver gang (`lib.rs:374-505`). Det er dette som gjør #3 til
en per-lagring-kostnad og ikke en engangskostnad.

### 27. `samtale::del` går over hele dokumentet tre ganger per lagring
`samtaleform` fra frontend (`App.tsx:228`), `samtale::er_samtale` inne i `understand_note`
(`lib.rs:407`), og `form` som kaller både `er_samtale` og `split` en gang til
(`samtale.rs:401-412`).

### 28. Ingen av per-avsnitt-spørringene bruker `prepare_cached`
`minne.rs:355` (`kandidater`), `minne.rs:547` (`lagret_forhold`), `minne.rs:874` (`spør`). Alle
5000 + 15000 oppslagene i #3 kompilerer SQL-en sin på nytt.

### 29. Samtidig skriving koster fem sekunder før den feiler
rusqlite setter `busy_timeout` til 5000 ms som standard, og ingenting hever eller senker det. Et
søketastetrykk som lander mens en stor `synk`-transaksjon committer blokkerer i inntil fem
sekunder og returnerer så «database is locked» som rød linje.

### 30. `reindex` kjøres på hver eneste eksterne endringsklase
`App.tsx:374`, i tillegg til ved hver lagring (`App.tsx:234`) og ved oppstart (`App.tsx:361`).
`git add -A` + `git ls-files -s` er billig (11 + 9 ms for 1000 notater), men en `git pull` eller
`notat sync` som rører mange filer gir én klase per 400 ms-vindu (`overvaking.rs:31`), og hver av
dem deler opp og skriver om radene til hver endret fil.

### 31. `angre`-stabelen i panelet er ubegrenset
`Panel.tsx:251`. Den vokser hele økta og trimmes aldri, og hver post holder en full `Retting`
inkludert avsnittsteksten. Liten, men den er der ved siden av en memo som allerede tømmes
brutalt på 4000 (#5).

### 32. To runders tall lever side om side i samme fil
`understand.rs:16` sier «Ett kall tar rundt tretten sekunder»; `understand.rs:36-45` dokumenterer
78 sekunder på det samme ene kallet. Konsekvensen er ikke kosmetisk: frontend har **ingen**
tidsgrense i det hele tatt (`App.tsx:166`), ingen «dette tar tid»-tilstand, og
`understand_note` er en synkron Tauri-kommando som kan holde en trådpooltråd i fem minutter.

---

## Stumt

### 33. Alle feil i klassifiseringen sier den samme ene linja
Binæren mangler, ikke innlogget, tidsavbrudd etter 300 s, rate-limitet, svarte rusk, maskinen sov
midt i kallet — brukeren får enten «Forståelsen er ikke tilgjengelig nå» (`Panel.tsx:287`) eller
«Ingenting er bestemt ennå.» (`Panel.tsx:360`). stderr er `Stdio::null()` (`understand.rs:649`),
så selv loggen har ingenting å gå på.

### 34. Etter én vellykket lesning når en feil aldri panelet i det hele tatt
`Understanding::off()` returnerer `lesning: 0` (`understand.rs:232-241`), og frontend forkaster
alt med `svar.lesning < lesningNå.current` (`App.tsx:169`). Så snart én lesning har lyktes, blir
hver senere feil stille kastet, og panelet står med gamle linjer som om de gjaldt nå. Tre
uavhengige avbruddsmekanismer — `leser`/`køet` i frontend, `LESNING` i Rust, og
løpenummerfilteret — møtes her og gjør feilen usynlig.

### 35. En ødelagt base degraderer til «alt er fint, bare tregere og dummere»
`understand_note` svelger `base()` (`lib.rs:390`): ingen id-er, ingenting lagret i `forstatt`,
ingen rettelser, ingen kryssnotatminne — og siden `kjente` aldri laster, sendes hvert avsnitt i
hvert notat til `claude` på nytt ved hver lagring, 13-78 s per kall. Ingenting sier at basen er
ødelagt.

### 36. Et notat over 500 KB er aldri søkbart, og sier det aldri
`read_if_indexable` returnerer `None` over `MAX_BYTES` (`gitsrc.rs:6`, `gitsrc.rs:68`), og
`run_inner` noterer blob-hashen likevel (`index.rs:~250`), så fila hoppes over for alltid. Søker
hun etter et ord hun vet hun skrev, får hun «Fant ingen notater med «…»» pluss et hint om hele ord
(`App.tsx:527-529`) som ikke har noe med saken å gjøre.

### 37. `les` svelger hver feil og lar panelet stå på «Leser notatet.» for alltid
`App.tsx:174-176` fanger alt og kommenterer «Panelet blir stående som det var» — men er
`forståelse` fortsatt `null`, står det «Leser notatet.» (`Panel.tsx:360`). Feiler
`understand_note` selv (notatmappa borte, stien avvist), blir den aldri ferdig.

### 38. Appens egen lagring kan utløse en falsk «Notatet er endret utenfor appen»
Selvskriftmerket utløper etter 3 s (`overvaking.rs:26`). Under last, på nettverksdisk eller etter
dvale kommer FSEvents-hendelsen senere, `er_selv` (`overvaking.rs:57`) svarer nei, og har hun
begynt å skrive igjen får hun varselet om ekstern endring (`App.tsx:380`) for sitt eget skriv.
Uten ulagrede endringer laster den i stedet inn stille og flytter markøren
(`Editor.tsx:311-322`).

### 39. En binærfil med `.md`-navn listes som notat og kan så ikke åpnes
`collect_notes` bruker `read_to_string(...).unwrap_or_default()` (`lib.rs:254`), så fila står i
lista med filnavnet som tittel. Klikk feiler i `read_note` (`lib.rs:301`) med en rå Rust-melding
om ugyldig UTF-8, og fordi `åpne` avbryter før `setPath` (`App.tsx:282`) blir det forrige notatet
stående på skjermen mens lista ser ut som om noe annet er valgt.

### 40. Feil i `reindex` er usynlige ved oppstart og ved eksterne endringer
`reindex().catch(() => undefined)` på `App.tsx:346`, `App.tsx:361` og `App.tsx:374`. Er git eller
indeksen ødelagt, gir søket bare stille ingen treff, for alltid.

### 41. Den første pakken på 78 sekunder har ingen tilbakemelding
`framdrift` settes bare fra `forstår`-hendelsen (`App.tsx:203`), som sendes etter at første pakke
er kommet tilbake (`lib.rs:455`). Mellom å åpne et langt notat og det øyeblikket står det «Leser
notatet.» uten framdrift, uten anslag og uten en måte å avbryte på.

### 42. Første lesning av et nytt notat prioriterer forrige notats synlige område
`åpne` kaller `les` (`App.tsx:268`) før Editorens `[path]`-effekt oppdaterer `synlig.current`
(`Editor.tsx:297`). `synlig` er én delt ref, så det som klassifiseres først i et nytt langt notat
er den delen forrige notat var scrollet til.

### 43. `CREATORHUB_CLAUDE_BIN` og tre hardkodede stier er hele letingen
`understand.rs:591-608`: `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, så håp om PATH. En
`claude` installert via nvm/npm-global eller på `~/.claude/local/claude` finnes ikke, og eneste
symptom er den generiske «ikke tilgjengelig»-linja. Miljøvariabelen er ikke nevnt noe sted i
grensesnittet.

### 44. Søket sier «Søket leter etter hele ord» — og straffer den som tror på det
`App.tsx:528`. `quote_fts_query` (`search.rs:77`) siterer hvert ledd, så en bruker som tar hintet
og skriver `kart*` får et bokstavelig token `"kart*"` og null treff. (Siteringen i seg selv er
solid — tolv rare søk, ingen FTS5-syntaksfeil.)

### 45. De strukturerte svarene utløses av helt vanlige ord
`mønster` (`minne.rs:741-780`) treffer på «avklart», «tvil», «bestemt», «venter» hvor som helst i
søket. Søk etter ordet «beslutning» bytter halve sidefeltet til en «Bestemt»-liste med
overskriften «Fra det du har skrevet før, ikke fra ordene du søkte på» (`App.tsx:508`) — som ikke
har noe med søket å gjøre, og som hun ikke ba om.

### 46. Migreringsrapporten går bare til stderr
`migrering.rs:93`, `migrering.rs:215-227`: hvor sikkerhetskopien ligger, hvor mange rader som ble
flyttet, og hvor mange som **ikke lot seg koble**. En GUI-app startet fra Finder har ingen stderr.
Mister migreringen rader, får brukeren aldri vite at det skjedde, og aldri vite hvor kopien er.

### 47. Feilet lagring lar statuslinja stå og lyve
`skriv` setter «Lagrer …» (`App.tsx:246`), og feiler `writeNote` returnerer `lagre` etter
`setFeil` (`App.tsx:229-232`) uten å røre statusen. Da står «Lagrer …» ved siden av den røde
linja, og ingenting sier noen gang at notatet *ikke* er lagret.

### 48. Toppfeltblokka tolkes fem steder, med fem implementasjoner
`understand::frontmatter_lines` (`understand.rs:315`), `samtale::kilde` (`samtale.rs:341`),
`toppfelt` (`App.tsx:68-91`), `toppfeltSlutt` (`Editor.tsx:88-95`) og `kildeplass`
(`Editor.tsx:171-179`). De er enige i dag, men `kilde: samtale` skrives inn to av dem
(`Editor.tsx:198` ved innliming, `samtale::sett_kilde` ved knappetrykk) uten at brukeren får vite
at fila har fått en linje hun ikke skrev.

### 49. Doc-kommentaren beskriver et system som ikke finnes lenger
`understand.rs:216` om `Understanding::on`: «Falsk når det ikke finnes noen nøkkel i miljøet.» Det
finnes ingen nøkkel — klassifiseringen går gjennom `claude`-kommandolinja. Kommentaren er fra en
tidligere runde, og den er grunnen til at feilmeldingen brukeren ser er formet som «mangler
oppsett» og ikke som «kallet feilet».

### 50. Søketreff bærer `startLine`/`endLine` som ingen bruker
`api.ts:9-10`, satt i `lib.rs:347-351`. Klikk på et treff i et notat på ti tusen linjer åpner det
på toppen, uten markering av hvor treffet var — mens `finn_avsnitt`/`peker`-maskineriet for
nøyaktig dette allerede finnes og brukes av «Tidligere om dette» (`App.tsx:271-277`).
