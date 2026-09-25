# Revisjon: datasikkerhet og tillit i notatappen

Lest: `app/src-tauri/src/{lib,overvaking,migrering,rettelser,minne,understand,samtale}.rs`,
`app/src/{App,Editor,Panel,api}.tsx|ts`, `indexer/src/{db,index,gitsrc,sti,identitet,embed}.rs`,
`notat`, `app/README.md`. Basen på maskinen (`notater.db`) inspisert skrivebeskyttet på en kopi:
`avsnitt`, `forstatt`, `rettelser`, `relasjoner` er alle tomme, 5 rader i `chunks` — ingen
migrerte tabeller, altså er ingen ekte brukerdata i spill ennå. Ingenting er skrevet.

Rangert innenfor hver gruppe. Stille forvrengning over synlig tap.

---

## A. Tap eller forvrengning

**1. En tom eller avkortet lesning utsletter identiteten til hele notatet, og med den alle
rettelsene i det.** `understand_note` → `minne::synk` (`lib.rs:414`) sletter *alle* `avsnitt`-rader
for kilden (`minne.rs:152`) før den setter inn på nytt. Er `tekster` tom, slettes alt: avsnitt,
`forstatt`, `relasjoner` — og `rettelser::foreldede` (`lib.rs:497`) merker samtlige rettelser for
notatet foreldet. Tre måter å komme dit: `readNote` treffer fila midt i et eksternt
`fs::write`/`git checkout`; hun markerer alt og sletter, og trykker «Vis forståelse»
(`App.tsx:493` sender `uskrevet.current.content`, altså den tomme bufferen); eller hun retter en
linje etter å ha tømt teksten (`App.tsx:318`). ⌘Z gir teksten tilbake. Rettelsene kommer aldri
tilbake — neste lesning gir avsnittene nye id-er.

**2. Notater endret utenfor appen blir aldri klassifisert på nytt, men svarer likevel.**
Klassifiseringen kjører bare i `understand_note`, som bare kalles når notatet står åpent i appen.
Redigerer hun et notat med `notat`/`$EDITOR` og lukker det, står `forstatt` uendret. «Hva er
uavklart» (`minne.rs:825`) og «Tidligere om dette» svarer fra teksten slik den var sist hun hadde
notatet åpent i appen — samme kortform, samme dato. `reindex` oppdaterer fritekstsøket i samme
slengen, så de to søkene er uenige om innholdet i det samme notatet, og ingenting sier det.

**3. En rettelse lagret på `avsnitt_id = 0` er usynlig, uslettbar, og styrer alle framtidige
lesninger.** Var basen utilgjengelig da notatet ble lest (`lib.rs:386` `base().ok()`), står alle
avsnitt med `id: 0` (`understand.rs:186`) mens panelet ser helt normalt ut. Hun retter en linje,
`rett_avsnitt` lykkes nå, og raden lagres på `avsnitt_id = 0` (`rettelser.rs:98`, primærnøkkel).
`aktive()` joiner mot `avsnitt` og finner den aldri — linja viser systemets ord igjen, som om hun
ikke gjorde noe. `eksempler()` (`minne.rs:667`) joiner *ikke*, så den usynlige raden står som
eksempel i hver eneste klassifiseringsprompt for alltid. Ingen vei til å se eller fjerne den.

**4. Beskjeden om at rettelsene ble foreldet forsvinner hvis hun byttet notat imens.**
`foreldede` (`lib.rs:497`) skriver `foreldet = 1` i basen og returnerer navnene *én gang*. Bytter
hun notat mens lesningen står på, forkaster `App.tsx:169` (`sti === stiNå.current`) hele svaret.
Radene er merket foreldet; «X er lest på nytt» kommer aldri, og kan aldri komme igjen.

**5. Notatet lastes stille inn på nytt uten at panelet leses på nytt.** `App.tsx:384-390`: har hun
ingen ulagrede endringer, byttes dokumentet uten spørsmål — men `les()` kalles ikke, `forståelse`
nullstilles ikke, `peker` heller ikke. Panelet viser kortformer, rettelser og «Tidligere om dette»
for teksten som ikke står der lenger, med `start`/`end` som peker feil sted i den nye teksten.
Statuslinja står fortsatt på forrige lagringstidspunkt.

**6. Et notat omdøpt utenfra tar alle rettelsene sine med i graven, uten et ord.**
`avsnitt.kilde` og `rettelser.sti` er den gamle stien. Under det nye navnet får avsnittene nye
id-er, `aktive(ny_sti)` finner ingenting, og `foreldede(ny_sti, …)` finner heller ingenting — så
hun får ikke engang den ene beskjeden. De gamle radene står med `foreldet = 0` og fortsetter å
mate `eksempler()` og prompten for alltid.

**7. Slettede notater lever videre i svarene.** Ingenting sletter `avsnitt`, `forstatt`,
`rettelser` eller `relasjoner` når fila forsvinner — `notat-endret` fører bare til `reindex`, som
rydder `chunks`. «Hva er uavklart» og «Tidligere om dette» svarer derfor fortsatt fra notatet som
ikke finnes. Først når hun klikker linja får hun «kunne ikke lese …» (`App.tsx:283`).

**8. Datoene i «Tidligere om dette» nullstilles stille når avsnittet mister id-en sin.**
`forstatt.tidspunkt` settes bare første gang (`minne.rs:257-277`), men nøkkelen er `avsnitt_id`.
Ryker identiteten — funn 1, 6, 7, eller en omskrivning under `TERSKEL = 0.36`
(`identitet.rs:37`) — skrives raden på en ny id med dagens dato. «Du bestemte det samme
3. september» blir «… 13. september». Hele funksjonen hviler på den datoen.

**9. Fila skrives ikke atomisk.** `write_note` er `std::fs::write` (`lib.rs:316`): truncate + write,
ingen temp-fil + rename, ingen fsync. Krasj, full disk eller strømbrudd midt i skrivet gir en
avkortet fil der hele notatet sto. Samme i `create_note_in` (`lib.rs:219`). Git har bare det som
ble staget ved forrige lagring, og det er unreferenced.

**10. `lagre()` kaster den ulagrede teksten når skrivet feiler.** `App.tsx:217` setter
`uskrevet.current = null` **før** `await writeNote`. Feiler skrivet (disk full, tillatelse borte,
mappa unmountet), vises en feilbanner — men det finnes ingenting å prøve på nytt med: neste
`lagre()` er en no-op, timeren er ryddet (`App.tsx:214`), og å åpne et annet notat erstatter
teksten i editoren. Feilmeldingen står, arbeidet er borte.

**11. Ingen lagring ved lukking av vindu eller bytte av app.** Debounce er 900 ms
(`App.tsx:248`). Det finnes ingen `beforeunload`, ingen `onCloseRequested`, ingen `blur`-håndterer
noe sted i `app/src` — verifisert med grep. Hun skriver en setning og lukker vinduet på 400 ms:
setningen kjørte aldri gjennom `lagre()`, og fila på disk har ikke sett den.

**12. En ekstern endring innen tre sekunder av appens eget skriv svelges helt.**
`Selvskrift::er_selv` (`overvaking.rs:57`) konsumerer merket for stien uansett hvem som utløste
hendelsen. Skriver `notat`, git eller en annen editor den samme fila innen `SELV_TTL = 3 s`
(`overvaking.rs:26`) etter appens lagring, spises hendelsen av appens eget merke. Appen får aldri
vite det, editoren viser gammel tekst, og neste autolagring skriver over den eksterne endringen.
Feil vinner, uten spor.

**13. Appens eget skriv kan telle som eksternt, og «Last inn på nytt» kaster da hennes tekst.**
Motsatt vei: kommer FSEvents-hendelsen mer enn 3 s etter skrivet (stor reindeksering, treg disk),
er merket luftet ut av `retain` (`overvaking.rs:59`) og appens egen lagring meldes som en endring
utenfra. Skriver hun akkurat da, får hun «Notatet er endret utenfor appen», og knappen kaster det
hun har skrevet for å laste inn hennes egen forrige lagring (`App.tsx:292-305`).

**14. En ekstern endring under en pågående lagring rapporteres aldri.** `uskrevet.current`
nullstilles ved starten av `lagre()` (`App.tsx:217`), så i hele vinduet `writeNote` + `reindex`
tar, ser `notat-endret`-håndtereren (`App.tsx:378`) ingen ulagrede endringer og laster inn stille.
Disken har hennes tekst, editoren viser den andres, og neste tastetrykk skriver den andres tekst
tilbake over hennes.

**15. Innliming av en samtale slår sammen linjer permanent.** `samtale::skriv`
(`samtale.rs:327-336`) skriver hvert innlegg som én linje; et innlegg over flere linjer — en
kodeblokk, en punktliste, et avsnitt — mister linjeskiftene sine. Teksten som havner på disk er
ikke den hun limte inn, og fila er sannheten. `ponytail:`-kommentaren på linje 324 vedgår det.

**16. «Dette er en samtale» ødelegger et notat med uavsluttet toppfelt.** `sett_kilde`
(`samtale.rs:366-371`): er `frontmatter_lines` 0 fordi den avsluttende `---` mangler, settes en
helt ny blokk foran. Resultatet er `---\nkilde: samtale\n---\n\n---\nid: …`, og det gamle
toppfeltet blir brødtekst. `byttSamtale` lagrer det rett til disk (`App.tsx:328-331`).

**17. Notater over 500 KB forsvinner fra søket uten et ord.** `read_if_indexable`
(`gitsrc.rs:71`) returnerer `None` over `MAX_BYTES`, og `run_inner` skriver da en `path_state`-rad
uten en eneste `chunk` (`index.rs:232`) — så neste kjøring hopper over fila som «uendret».
Notatet står i lista og treffer aldri i søk. Et importert transkript er nøyaktig den fila som blir
stor.

**18. Notater som `.gitignore` treffer finnes ikke, og sikkerhetskopieres ikke.** Indekseren
lister med `git ls-files -s` (`gitsrc.rs:50`). Et notat `git add -A` ikke tar med — en
`.gitignore` i notatmappa, en global `core.excludesfile` med `*.md` eller et mappenavn i — er
verken i søket eller i noen commit `notat sync` lager. Ingen feilmelding noe sted.

**19. Appen committer aldri; historikken finnes bare hvis hun kjenner `notat sync`.**
`reindex_in` gjør `git add -A` (`lib.rs:280`) og stopper der. Mellom to manuelle `notat sync` er
hver mellomversjon en unreferenced blob som `git gc` fjerner etter to uker. Grensesnittet nevner
ikke `notat sync` med ett ord. En bruker som bare bruker appen har ingen versjonshistorikk.

**20. `git add -A` fullfører en uløst merge-konflikt.** Står notatrepoet midt i en merge med
konfliktmarkører i en notatfil, markerer `git add -A` konflikten som løst med markørene i teksten.
Neste `notat sync` committer `<<<<<<<` som notatinnhold, appen klassifiserer det, og
`avsnitt`-identiteten regner om.

**21. `notat sync` på detached HEAD committer til ingenting.** `commit_all` (`notat:30-34`)
sjekker ikke HEAD. På en detached HEAD er committen uten gren, og neste `git checkout main` gjør
den uleselig uten reflog — og det er den eneste sikkerhetskopien notatene har.

**22. Store binærfiler blir en del av sikkerhetskopien for alltid.** `git add -A` tar alt i mappa.
En video eller et bildearkiv droppet i notatmappa committes av `notat sync` og blir stående i
historikken. `notes_dir()` (`lib.rs:60-71`) lager ingen `.gitignore` når den kjører `git init`.

**23. Indekseren kjørt mot en annen mappe med notatbasen sletter notatindeksen.** `run_inner`
regner alt i `path_state` som ikke står i `git ls-files` for repoet den fikk, som `gone`, og
purger det (`index.rs:188-203`). `notes-index --db "…/notater.db" index <et annet repo>` er ett
tastetrykk unna og advarer ikke. Gjenoppbyggbart, men uten et ord om at det skjedde.

**24. `db::open` dropper fire tabeller ved hver eneste åpning.** `DØDT` (`db.rs:34-39`) kjører
`drop table if exists anchors; edges; entities; notes` hver gang basen åpnes — også `notater.db`,
som er brukerens lager. Et `notes`-navn tatt i bruk av en annen versjon eller et sidoverktøy
tømmes stille ved neste appstart.

**25. Forståelsen deles på tvers av notater via innholdshash.** `kjente()` (`minne.rs:211`) slår
opp klassifisering på `avsnitt.innhold_hash`, ikke på notatet. Står nøyaktig samme avsnitt i to
notater, arver det ene det andres lesning inkludert `venter`-avhengigheten — mens rettelsen hennes
*ikke* følger med, siden den henger på id. Panelet viser da systemets lesning fra et annet notat
der hun trodde hun hadde rettet den.

**26. Klassifiseringen lagres for tekst som aldri ble lagret.** `rett()` og panelbryteren leser med
`uskrevet.current?.content` (`App.tsx:318`, `493`). `minne::synk` og `minne::lagre` skriver dermed
avsnittsidentitet og forståelse for et utkast hun kan angre. Basen beskriver et notat som aldri
har eksistert på disk.

---

## B. Skjørt

**27. Ingen `busy_timeout` noe sted.** `db::open` (`db.rs:69-84`) setter WAL, men ikke
busy-timeout, så samtidig skriving gir «database is locked» *umiddelbart*. Kjører `notat sync`
mens appen autolagrer, svelges det i appen: `minne::synk` (`lib.rs:414` `.ok()`) og `minne::lagre`
(`lib.rs:449`, `481` `let _ =`) kaster feilen, og forståelsen for den lagringen forsvinner uten et
ord. `rett_avsnitt` feiler synlig i samme situasjon.

**28. Ingen lås på tvers av prosesser for git.** `REINDEX` (`lib.rs:24`) er en `Mutex` i appens
prosess. `notat sync` sitt `git add -A` og appens `git add -A` kolliderer på `index.lock`; appen
sier «Notatet er lagret, men søket er ikke oppdatert ennå», `notat sync` avbryter midt i på
`set -e` (`notat:11`) og lar filene stå staget uten commit.

**29. `collect_notes` følger symlenker rekursivt.** `lib.rs:198-201`: `entry.metadata()` følger
lenken, så en symlenke i notatmappa som peker på en foreldermappe gir uendelig rekursjon.
`list_notes` kalles ved oppstart (`App.tsx:355`) — appen henger eller kræsjer før noe kan åpnes.

**30. Migreringen lager `avsnitt` uten `if not exists`.** `migrering.rs:104`. Havner basen i en
tilstand der det nye `avsnitt` finnes samtidig som `rettelser` eller `forstatt` fortsatt har
`hash`-kolonnen, feiler `kjør` for alltid, `base()` returnerer `Err` (`lib.rs:584`), og alt som
trenger basen er dødt — mens panelet fortsetter å se ut som det virker, med id 0 på hvert avsnitt
(funn 3).

**31. Sikkerhetskopiene fra migreringen slettes aldri og telles til 1000.** `ledig_kopinavn`
(`migrering.rs:67-80`). Hver migrering gir en full `vacuum into`-kopi ved siden av basen, i en
mappe brukeren ikke ser. Riktig prioritering, men ingen rydder, og ingen sier at de er der.

**32. Nedgradering er ikke stengt, bare stille ødelagt.** En eldre appversjon åpner den migrerte
basen; `create table if not exists` gjør ingenting, og hvert oppslag mot `hash`-kolonnen feiler.
Rettelser kan ikke lagres, forståelse ikke leses. Ingenting ødelegges — men ingenting sier
hvorfor, og en ny oppstart av den nye versjonen ser basen som allerede migrert
(`trengs()`, `migrering.rs:60`) og gjør ingenting for å reparere.

**33. `understand_note` holder den globale `memo()`-låsen gjennom alle modellkall.**
`lib.rs:390`, låsen slippes først når kommandoen returnerer. Med `TIMEOUT = 300 s`
(`understand.rs:45`) per pakke, `AVSNITT_PER_PAKKE = 80`, pluss to relasjonskall, låser en
importert samtale på 300 innlegg forståelsen i minutter. `avbryt_lesning` (`lib.rs:552`) virker
først ved neste pakkeslutt.

**34. Ett avsnitt over omtrent 900 KB sprenger `ARG_MAX`.** `kjør` (`understand.rs:643-646`)
sender hele prompten som ett argv-element, og `batches_med` deler aldri opp ett enkelt avsnitt
(`embed.rs:65-72`). Resultatet er «startet ikke: …» → hele lesningen feiler på første pakke
(`understand.rs:528`) → panelet av for hele notatet.

**35. `notes_dir()` kjører `git init` i hvilken som helst mappe `CREATORHUB_NOTATER` peker på.**
`lib.rs:67-69`. En feilsatt variabel — hjemmemappa, Dokumenter — gir et git-repo der, og hver
`reindex` gjør `git add -A` på alt som ligger i den.

**36. Notatmappa uten skrivetillatelse gir ingen degradert modus.** `notes_dir()` er første steg i
`list_notes`, `read_note`, `write_note`, `create_note`, `search_notes` og `reindex`. Feiler den,
feiler alt, også lesing av det som allerede er indeksert.

**37. WAL uten sjekkpunktdisiplin gjør en filkopi av basen upålitelig.** `notater.db` står i WAL
(`db.rs:75`) med `-wal` og `-shm` ved siden av (bekreftet på disk). En sikkerhetskopi som tar bare
`notater.db` — Time Machine, en manuell `cp` — kan mangle de siste transaksjonene, altså de siste
rettelsene, uten at noe sier ifra.

**38. Appen og `notat` bruker to ulike slug-regler.** `slug()` (`lib.rs:171-183`) mot
`tr -cd 'a-zæøå0-9-'` (`notat:68`). En tittel uten latinske bokstaver gir `<dato>-notat.md` i
skallet; kjøres den to ganger samme dag, åpner den andre kjøringen den første fila i stedet for å
lage en ny (`notat:70`), og den nye tittelen forsvinner.

**39. `today()` faller tilbake til `"0000-00-00"`.** `lib.rs:224-231`, hvis `date` ikke svarer
eller svarer noe annet enn ti tegn. Notatene havner da under et navn som sorterer først for alltid
og som `strip_date_prefix` fortsatt vil klippe.

**40. `derive_title` leser hele hver fil ved hver `list_notes`.** `lib.rs:207` i `collect_notes`,
og `list_notes` kalles ved oppstart, etter hver lagring og ved hver ekstern endring
(`App.tsx:235`, `373`). Et arkiv med noen tusen notater, eller ett importert transkript på flere
hundre kB, gjør hver lagring merkbart treg.

**41. En pakke som feiler midt i en lang lesning gir et halvt panel uten å si det.**
`understand.rs:528-530`: feiler pakke nummer to eller senere, brytes løkka og det som er lest
returneres som et fullt svar. `framdrift` settes til `null` (`App.tsx:172`). Hun ser et panel som
mangler halvparten av notatet, og ingenting skiller det fra «resten hadde ingenting å si».

---

## C. Uklart

**42. README lover det motsatte av det appen gjør.** `app/README.md:4-5`: «Ingen nettverk, ingen
API-nøkkel — alt er markdown på disk, git og SQLite.» Klassifiseringen sender avsnittsteksten
gjennom `claude`-CLI-en til Anthropic ved hver lagring (`understand.rs:642`,
`lib.rs:457`). Modulkommentaren i `lib.rs:4-5` sier det samme: «Ingen binær startes, ingen
nettverkskall gjøres». Begge står uendret.

**43. Avsnittsteksten havner i en logg brukeren ikke vet om.** `kjør` kjører `claude -p` med
`.current_dir(std::env::temp_dir())` (`understand.rs:646`); Claude Code skriver hele prompten til
`~/.claude/projects/-private-var-folders-…/*.jsonl`. Sjekket på denne maskinen: 34 filer, omtrent
300 kB hver, med «Avsnittene:»-prompten i seg. De ryddes aldri, og de er ikke nevnt noe sted.

**44. Prompten er et argv-element og står i prosesslista.** `.arg(prompt)`
(`understand.rs:645`). Hele notatteksten kan leses av enhver prosess på maskinen med `ps -ww` så
lenge kallet varer — opptil 300 sekunder.

**45. Det finnes ingen av-bryter for utsendingen.** «Skjul forståelse» (`App.tsx:486-497`) er den
eneste, den er skrevet som en visningsbryter, den står på som standard
(`localStorage.getItem("forstaelse") !== "skjult"`, `App.tsx:113`), og den er global. Det finnes
ingen måte å si «ikke send dette ene notatet» — heller ikke via toppfeltet, der `kilde:` allerede
finnes som mønster.

**46. Det som sendes er mer enn notatet hun ser på.** `eksempler` (`lib.rs:354`) legger seks
rettelser fra hvilke som helst andre notater i prompten (`understand.rs:621-633`), og
`relasjonsprompt` (`minne.rs:448`) sender par der den andre halvparten er et avsnitt fra et annet
notat. Åpner hun ett notat, forlater biter av andre maskinen. Ingenting sier det.

**47. Prompten går til to modeller, ikke én.** `MODEL` (Haiku) klassifiserer,
`STOR_MODEL` = `claude-sonnet-5` leser relasjonsparene om igjen (`understand.rs:715`). Panelet
nevner ikke at det skjer.

**48. Migreringens rapport går til stderr, som ingen ser.** `eprintln!` i `migrering.rs:93`
(hvor sikkerhetskopien ligger), `215` (antall rader flyttet) og `220` (rader som ikke lot seg
koble). En app startet fra Finder har ingen stderr noen leser. Det eneste sporet tilbake etter det
steget modulkommentaren selv kaller «det farligste steget i prosjektet» er usynlig for brukeren.

**49. Rettelsene ligger utenfor alt hun ville tenkt på å ta vare på.** `notater.db` — som holder
det eneste hun har skrevet som ikke ligger i markdown — ligger i
`~/Library/Application Support/creatorhub-notes/`, utenfor notatmappa og utenfor git. Appen tar én
kopi, én gang, ved migreringen (`migrering.rs:92`), og aldri mer. Ingen eksport, ingen periodisk
kopi, ingenting som sier at fila er verdt noe.

**50. Skillet mellom det som kan gjenskapes og det som ikke kan står ingen steder.** Indeks,
avsnitt, forståelse og relasjoner bygges opp igjen ved å lese notatene. `rettelser` kan ikke.
Kildekommentarene sier det tydelig (`rettelser.rs:1-12`, `migrering.rs:3-6`); grensesnittet sier
ingenting, og «Vis detaljer» (`App.tsx:594`) viser bare toppfeltene.

**51. «Forståelsen er ikke tilgjengelig nå» dekker fire helt ulike ting.** `Panel.tsx:287`:
`claude` finnes ikke, ikke innlogget, tidsavbrudd på 300 s, eller prompt for stor — alt ser likt
ut. Hun kan ikke gjøre noe med noen av dem uten å vite hvilken det var.

**52. Varselet om ekstern endring har to utganger og viser ingen av dem.** `App.tsx:610-615`:
«Last inn på nytt» kaster hennes tekst, og å skrive videre kaster den andres
(`App.tsx:224` nullstiller varselet ved neste lagring). Det finnes ingen visning av forskjellen,
og den andre versjonen er ikke committet noe sted — bare staget av `reindex` i
`notat-endret`-håndtereren (`App.tsx:374`) — så den er kun gjenfinnbar med `git fsck --lost-found`.

**53. Statuslinja lyver etter en stille innlasting.** `setStatus` røres ikke i `App.tsx:384-390`.
Det står «Lagret 14:32» mens teksten i editoren kom fra disk et minutt senere, skrevet av noen
andre. `samtaleform` oppdateres heller ikke, så «Samtale med …» kan gjelde forrige versjon.

**54. «Angre» i panelet er per notat og per økt.** `Panel key={path}` (`App.tsx:646`) remonterer
stabelen ved hvert notatbytte, og `angre` er `useState` (`Panel.tsx:251`). En feilklikket «Ikke
relevant» kan ikke angres etter et notatbytte, linja er borte fra panelet
(`plass = 'fjernet'` filtrerer den også ut av `kandidater`, `minne.rs:363`), og det finnes ingen
liste over hva hun har fjernet.

**55. `notat status` sier «sist» om filas mtime, ikke om indekseringen.** `notat:57` bruker
`date -r "$DB"`. Enhver skriving til basen — også en rettelse fra appen — flytter tallet, så det
svarer på et annet spørsmål enn det stiller.
