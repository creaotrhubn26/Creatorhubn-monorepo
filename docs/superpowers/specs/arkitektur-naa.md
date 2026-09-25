# Arkitektur i creatorhub-notes - som den faktisk er (2026-09-12)

Alle stier er relative til apps/creatorhub-notes/ i
/Users/danielqazi/Creatorhubn-monorepo/.claude/worktrees/notes-fase1/.

Merk for alt annet: en annen agent bygger i denne katalogen na.
app/src-tauri/src/minne.rs er untracked (ny fil, ikke lagt til versjonskontroll),
og app/src-tauri/src/lib.rs pluss app/src-tauri/src/understand.rs er endret
men ikke lagret som commit. minne.rs er ferdig skrevet og testet internt, men
er ikke koblet til resten av appen enna - se punkt 5. Det som beskrives under
er derfor et oyeblikksbilde av en app midt i en sammenkobling, ikke en feil i
seg selv.

## 1. Modulene og hva de eier

### indexer/ (crate creatorhub-notes-indexer)
Ansvar: alt som har med filbasert tekst -> sokbar SQLite a gjore. Brukes bade
som bibliotek (av app/src-tauri) og som egen CLI-binaer (notes-index, kalt
via shell-scriptet "notat").

- indexer/src/db.rs - skjema og open(). Offentlige funksjoner appen faktisk
  kaller: db::open(path) -> Connection (db.rs:89), brukt fra
  app/src-tauri/src/lib.rs:264 (reindex) og :307 (sok). get_meta/set_meta
  (db.rs:105-119) brukes ikke av appen i dag (ingen treff i app/src-tauri).
- indexer/src/index.rs - inkrementell indeksering mot git-blob-hash.
  index::run_no_embed(conn, repo) (index.rs:168) er den eneste funksjonen
  appen kaller (app/src-tauri/src/lib.rs:267). index::run (med embedder,
  index.rs:160) og dry_run (index.rs:343) er CLI-only, kalt fra
  indexer/src/main.rs:97 og :57.
- indexer/src/search.rs - search::text (bm25/FTS5, search.rs:91) er den
  eneste appen bruker (app/src-tauri/src/lib.rs:308). search::query og
  search::query_paths (semantisk, vec0, search.rs:27 og :124) er CLI-only -
  ingen treff i app/src-tauri i det hele tatt.
- indexer/src/chunk.rs - deler kildefiler i 40-linjers vinduer med 10 linjers
  overlapp (chunk.rs:4-5, :45), med et regex-drevet gjetteforsok pa
  funksjons-/klassenavn til chunk-header. Brukt bare fra index.rs (kode-side).
  Merk: dette er kode-chunking (linjevinduer + funksjonsnavn), en helt annen
  chunking-modell enn understand.rs::split som deler notater pa tomme linjer
  (avsnitt). De to har ingenting med hverandre a gjore og deler ikke logikk.
- indexer/src/embed.rs - Voyage-embedder, batching pa token-budsjett
  (embed.rs:6-7, :42). CLI-only; appen har aldri en embedder-instans.
- indexer/src/gitsrc.rs - lister git-sporede filer med blob-sha
  (list_files_with_sha, gitsrc.rs:50), filtrerer pa extension-liste
  (EXTENSIONS, gitsrc.rs:5, inkluderer .md). Brukt av index.rs for bade
  kode-repoet og notatmappen (notatmappen er ogsa et git-repo).
- indexer/src/ordbank.rs - laster en norsk fullformsordliste inn i en egen
  tabell ordbank_fullform (ordbank.rs:6-13, egen SCHEMA-konstant, ikke del av
  db.rs::SCHEMA). Ubrukt i praksis: ingen kall til ordbank::load utenfor
  modulens egne tester, ikke wired i main.rs eller appen. Nevnes i en
  kommentar i app/src-tauri/src/minne.rs:621 som en mulig fremtidig losning
  for stemming, men ikke brukt.
- indexer/src/eval.rs - recall-evaluering mot indexer/gullsett.toml.
  CLI-only (main.rs:117), irrelevant for appens kjoretid.
- indexer/src/cli.rs - kun default_db_path() (cli.rs:3-11), brukt av
  notes-index-binaeren nar --db ikke er gitt. Ikke brukt av Tauri-appen -
  se avsnitt om databasesti-avvik under punkt 6.

### app/src-tauri/src/ (Tauri-app, crate creatorhub-notes-app)
Ansvar: skriveflate over notatmappen pa disk + panelet som "forstar" notatet.
Deler notatmappe og database med CLI-verktoyet notat (kommentar lib.rs:1-5),
kaller indekseren som bibliotek - ingen indekserer-binaer startes.

- lib.rs - alle Tauri-kommandoer (se punkt 3), filsti-validering
  (resolve_in, lib.rs:133-158), tittel-utledning (derive_title,
  lib.rs:94-109), reindeksering (reindex_in, lib.rs:261-273).
- understand.rs - LLM-klassifisering av notat-avsnitt via claude-CLI-en.
  Offentlig API brukt av lib.rs: understand::understand() (:316),
  understand::memo() (:177, prosess-global Mutex<Memo>), Understanding
  (:121), Cli (:371). Brukt av rettelser.rs og minne.rs sine tester via
  understand::nokkel/split.
- rettelser.rs - brukerens egne rettelser av en klassifisert linje, lagret i
  tabellen rettelser. Offentlig API brukt av lib.rs: sorg_for_tabell (:62,
  kalt fra lib.rs::base() - lib.rs:376), aktive (:74, kalt lib.rs:366), lagre
  (:87, kalt lib.rs:390), foreldede (:118, kalt lib.rs:365), merge (:140,
  kalt lib.rs:367).
- minne.rs - ny, untracked. "Hukommelsen pa tvers av notater": lagrer
  forstatt-avsnitt persistent (lagre, :126), finner tidligere relaterte
  avsnitt via FTS + LLM-dommer (tidligere, :389), strukturert sporre-sok
  (spor, :645), posisjonsoppslag (posisjon, :704). Ingen av disse kalles fra
  lib.rs i dag - se punkt 5/6.

### app/src/ (frontend, React + CodeMirror)
- App.tsx - all state og orkestrering: liste, sok (debounce 160ms,
  App.tsx:254-263), lagre-med-debounce (900ms, App.tsx:171-180), "les"-ko
  for forstaelse (App.tsx:119-144, en av gangen, koer resten).
- Editor.tsx - CodeMirror-instans, markdown-highlighting, pek-til-avsnitt
  (decoration .cm-vist, Editor.tsx:38-43).
- Panel.tsx - viser Understanding.paragraphs gruppert i fire "plasser"
  (forstatt/uavklart/oppgave/ide, Panel.tsx:7-14, lest()-regel
  Panel.tsx:33-40), retteskjema, angre-stack. Rendrer ikke "earlier" -
  se punkt 5/6.
- api.ts - tynt lag over invoke(). Understanding-typen (api.ts:43) mangler
  earlier-feltet som Rust-siden na har (understand.rs:130).

## 2. Datamodellen, fullstendig

En SQLite-fil deles av CLI og app (i praksis - se avvik i punkt 6): schema
bygges av tre uavhengige execute_batch-kall som alle kjores hver gang
db::open() kalles (db.rs:96-101 for indekser-tabellene, pluss
rettelser::sorg_for_tabell og minne::sorg_for_tabeller fra appsiden - men se
merknad om at sistnevnte faktisk ikke kalles enna).

Fra indexer/src/db.rs (kjores av begge: CLI direkte, app via db::open):

- meta: key PK, value (db.rs:8-11). Skrives av: ingen kaller set_meta.
  Leses av: ingen kaller get_meta.
- notes: id PK, path UNIQUE, mtime, type, title (db.rs:13-19). Skrives av:
  ingen. Leses av: ingen.
- entities: id PK, kind, name, source_ref, repo, unique(kind, source_ref)
  (db.rs:21-28). Skrives av: ingen. Leses av: ingen.
- chunks: id PK, source, path, start_line, end_line, text; indeks
  chunks_path(path) (db.rs:30-38). Skrives av: index.rs::flush
  (index.rs:91-95). Leses av: search.rs::query/text (join),
  index.rs::purge_path/backfill_missing_vectors.
- path_state: path PK, blob_sha (db.rs:40-43). Skrives av: index.rs::flush
  (:104-109), slettet i index.rs::run_inner (:200). Leses av:
  index.rs::read_path_state (:46) - diff mot git for inkrementell
  indeksering.
- anchors: (note_id, entity_id) PK, confidence, confirmed (db.rs:45-51).
  Skrives av: ingen. Leses av: ingen.
- edges: (from_entity, to_entity, kind) PK (db.rs:53-58). Skrives av: ingen.
  Leses av: ingen.
- chunk_fts (FTS5, external-content pa chunks): tokenindeks over text, holdt
  i synk av triggerne chunks_ai_fts/chunks_ad_fts (db.rs:79-85) - ingen
  chunks_au_fts-trigger for UPDATE, men chunks oppdateres aldri via UPDATE i
  koden (bare insert/delete), sa det stemmer i dag. Skrives av: triggerne pa
  insert/delete av chunks. Leses av: search.rs::text (search.rs:98-107).
- chunk_vec (vec0, float[1024], db.rs:97-100): Skrives av: index.rs::flush
  (:96-102), index.rs::backfill_missing_vectors (:124-156). Leses av:
  search.rs::query/query_paths - CLI-only, appen kaller aldri disse.

Bekreftet: entities, anchors, edges og notes er definert i schema men har
null lese/skrive-kode noe sted i repoet (grep for tabellnavnene i alle
.rs-filer gir bare treff i db.rs-definisjonen selv). De er reelt tomme, i
alle databaser, alltid. notes-navnet i koden ellers refererer til
filsystem-notater (Note-struct i lib.rs:23), ikke denne tabellen - ren
navnekollisjon.

chunk_vec (vec0) er bevist funksjonell (indexer/tests/vec_smoke.rs kjorer en
ekte KNN-sporring mot en vec0-tabell), men ubrukt av appen: appen kaller kun
search::text, aldri search::query/query_paths. Tabellen fylles bare hvis
noen kjorer "notat sync --embed" med VOYAGE_API_KEY satt - noe app-brukeren
normalt ikke gjor, siden appens egen reindex_in() (lib.rs:261-273) alltid
kaller index::run_no_embed.

Fra app/src-tauri/src/rettelser.rs:

- rettelser: (sti, hash) PK, tekst, lest_type, lest_handling, lest_kortform,
  plass, kortform, tidspunkt, foreldet (rettelser.rs:47-59). Skrives av:
  rettelser::lagre (:87), foreldede (UPDATE foreldet=1, :130). Leses av:
  aktive (:74), foreldede (:118), og minne.rs (join i kandidater/
  eksempler/spor).

Fra app/src-tauri/src/minne.rs (ny - untracked, ikke koblet inn enna):

- forstatt: (sti, hash) PK, tittel, tekst, type, handling, kortform, venter,
  tidspunkt; indeks forstatt_hash(hash) (minne.rs:33-45). Skrives av:
  minne::lagre (:126-160). Leses av: minne::kjente (:88), kandidater (:223),
  spor (:645).
- forstatt_fts (FTS5, external-content pa forstatt): holdt i synk av
  forstatt_ai/_ad/_au (minne.rs:55-68) - denne har alle tre triggere inkl.
  UPDATE, i motsetning til chunk_fts som mangler UPDATE-triggeren fordi
  chunks faktisk aldri oppdateres, mens forstatt oppdateres via
  minne::lagre sin "on conflict ... do update" (minne.rs:129-134). Skrives
  av: trigger pa insert/delete/update av forstatt. Leses av: kandidater
  (:236), spor sitt filter (:667).
- relasjoner: (hash, annen_hash) PK, forhold, tidspunkt (minne.rs:70-76).
  Skrives av: minne::tidligere (:437-442). Leses av: lagret_forhold (:375),
  spor sin Forkastet-gren (:659-660).

Ingen kaller minne::sorg_for_tabeller utenfor minne.rs sine egne tester -
altsa blir forstatt/forstatt_fts/relasjoner aldri opprettet i den faktiske
appen slik koden star na. Se punkt 5/6.

## 3. Hvor grensene gar

### Tauri-kommandoer (app/src-tauri/src/lib.rs:402-411)

- list_notes: fn list_notes() -> Result<Vec<Note>, String> (lib.rs:276).
  Kalt fra api.ts:12.
- read_note: fn read_note(path: String) -> Result<String, String>
  (lib.rs:285). Kalt fra api.ts:13.
- write_note: fn write_note(path: String, content: String) ->
  Result<(), String> (lib.rs:292). Kalt fra api.ts:14.
- create_note: fn create_note(title: String) -> Result<String, String>
  (lib.rs:299). Kalt fra api.ts:16.
- search_notes: fn search_notes(query: String) -> Result<Vec<SearchHit>,
  String> (lib.rs:305). Kalt fra api.ts:17.
- reindex: fn reindex() -> Result<String, String> (lib.rs:394). Kalt fra
  api.ts:18.
- understand_note: fn understand_note(content: String, path: String) ->
  Result<understand::Understanding, String> (lib.rs:347). Kalt fra
  api.ts:46.
- rett_avsnitt: fn rett_avsnitt(retting: rettelser::Retting) ->
  Result<(), String> (lib.rs:383). Kalt fra api.ts:61.

Frontend vet ellers ingenting om SQLite, git eller claude-CLI-en - alt skjer
bak disse atte kommandoene. Frontend eier: CodeMirror-tilstand,
localStorage-nokkelen "forstaelse" for panelets av/pa (App.tsx:102, :336),
og temavalg via tema.ts.

### claude-CLI-kallet

app/src-tauri/src/understand.rs::kjor (:433-463): spawner
std::process::Command::new(binary()) med
["-p", "--model", MODEL, "--output-format", "text"] pluss selve prompten som
siste argument (:434-436), current_dir(std::env::temp_dir()) (bevisst -
ingen git-repo i arbeidskatalogen, :437), stdin lukket, stdout lest pa en
egen trad med 120s timeout via mpsc-kanal (:444-462). Modellnavnet er
hardkodet med datostempel i kommentaren (understand.rs:25-28,
claude-haiku-4-5-20251001). To ulike prompt-byggere kaller samme kjor:
understand.rs::prompt (klassifisering, :403-428) og
minne.rs::relasjonsprompt (par-domming, :309-317) - via
impl Classifier for Cli (understand.rs:465-469) og impl minne::Dommer for
Cli (understand.rs:473-477). Ingen andre steder i repoet kaller claude.

### Indekser-crate: bibliotek vs. CLI-only

Brukt som bibliotek av appen: db::open, index::run_no_embed, search::text -
det er de tre eneste offentlige funksjonene appen importerer
(app/src-tauri/src/lib.rs:11:
use creatorhub_notes_indexer::{db, index, search};). Alt annet (embed,
chunk, gitsrc, eval, ordbank, cli, index::run, index::dry_run,
search::query, search::query_paths) er enten CLI-only eller helt ubrukt
utenfor indekseren selv.

## 4. Tilstand og livssyklus

Kun i minne, borte ved restart:
- understand::memo() (understand.rs:177-180) - prosess-global
  OnceLock<Mutex<HashMap<u64, Label>>>, nokkelet pa FNV-1a-hash av
  avsnittsteksten (understand.rs:193-200). Tommes helt om den passerer 4000
  rader (understand.rs:336-338, kommentert som en bevisst forenkling -
  "ponytail: tommes helt nar den blir stor"). Dette er i dag den eneste
  hukommelsen understand_note faktisk bruker - DB-persistens via
  minne::kjente/minne::lagre er skrevet men ikke koblet inn (se punkt 5/6),
  sa en omstart av appen i dag koster ett nytt claude-kall per avsnitt i
  hvert apne notat, selv om minne.rs sin egen doc-kommentar (minne.rs:6-8)
  hevder at forstaelsen overlever omstart.
- React-state i App.tsx (notater-liste, sokeresultat, ulagret tekst-buffer
  uskrevet (App.tsx:111), koet lesing koet (App.tsx:120)).
- REINDEX-mutexen (lib.rs:19) - bare en prosess-lokal las, ikke persistent
  tilstand.

Pa disk:
- Notatfilene selv (.md), i ~/CreatorHub-notater eller CREATORHUB_NOTATER
  (lib.rs:44-56), som et git-repo (init'et lazy hvis det mangler).
- SQLite-fila: ~/Library/Application Support/creatorhub-notes/notater.db
  eller CREATORHUB_NOTAT_DB (lib.rs:65-74) - alle tabeller over.
- localStorage["forstaelse"] i nettleser-webview (panelets av/pa-tilstand).
- Temavalg, i tema.ts (samme monster - localStorage).

Ved omstart:
1. Frontend laster, kaller list_notes + reindex (App.tsx:235-246). reindex
   gjor "git add -A" + index::run_no_embed (lib.rs:262-268) - dette er en
   full sti-diff mot path_state (git-blob-sha), ikke bare nye filer siden
   sist app-okt.
2. understand::memo() er tom - hver understand_note pa et gammelt notat
   trigger et nytt claude-kall for hvert avsnitt (se over).
3. rettelser-tabellen leses pa nytt hver gang (lib.rs::base() apner
   connection + kaller sorg_for_tabell idempotent hver kommando,
   lib.rs:374-378) - ingen cache der, bare SQLite selv.

Cacher og nokler:
- understand::memo: nokkel = FNV-1a(avsnittstekst), verdi = klassifisering.
  Invalideres aldri eksplisitt (bare full clear ved 4000-grense) - et
  avsnitt som endres far automatisk en ny nokkel (teksten er nokkelen), sa
  det gamle blir en foreldrelos rad appen aldri rydder fra memo selv (kun
  fra forstatt-tabellen via minne::lagre sin opprydding, minne.rs:149-158 -
  men den koden kjores aldri i dag, se punkt 5).
- path_state: nokkel = filsti, verdi = git blob-sha. Dette er index-cachen:
  en fil med uendret sha hoppes over i index.rs::run_inner (:180-184).
- relasjoner (i minne.rs, ikke koblet inn): nokkel = (avsnitt-hash,
  annet-avsnitt-hash), en gang domt av LLM, aldri pa nytt (minne.rs:410-414,
  :430-445) - dette er meningen med "koster null kall andre gang".

## 5. Gjenbrukbarhet for det som skal bygges

### a) Minne pa tvers av notater
Allerede bygget, ikke koblet inn. minne.rs er noyaktig denne
funksjonaliteten: forstatt-tabellen er notat-uavhengig hukommelse noklet pa
avsnittstekst (minne.rs:88, :126), tidligere() (minne.rs:389) er "minne pa
tvers av notater" i konkret form (FTS-kandidater + LLM-dom om forhold), og
spor() (minne.rs:645) er strukturert sporring over det utledede laget -
akkurat punkt (c) i planen ogsa. Det som mangler er sammenkobling, ikke ny
arkitektur:
- lib.rs::base() ma kalle minne::sorg_for_tabeller i tillegg til
  rettelser::sorg_for_tabell (lib.rs:374-378).
- understand_note (lib.rs:346-371) ma: (1) seede memo fra minne::kjente()
  per kall i stedet for a stole pa prosess-memo alene, (2) kalle
  minne::lagre() etter klassifisering, (3) kalle minne::tidligere() og
  fylle Understanding.earlier (feltet finnes allerede, understand.rs:130,
  men settes aldri til noe annet enn tom vec - Understanding::on(),
  understand.rs:142-144).
- api.ts::Understanding (:43) ma fa et earlier-felt, og Panel.tsx ma
  faktisk rendre "Tidligere om dette" - ingen kode for dette finnes i
  Panel.tsx i det hele tatt i dag.
- Ny kommando trengs for minne::spor i sokefeltet (i dag gar alt gjennom
  search_notes -> search::text, som ikke kjenner spor-monstrene).

Det som vil knake: minne::kandidater (minne.rs:223-269) er skrevet for
korte, hele avsnitt (typisk 1-5 setninger, notat-skala) og ordsoket
(sokeord, minne.rs:179-195) plukker maks 12 unike ord per avsnitt.
Importerte samtaler (Slack-trader) har helt andre avsnittslengder og
tetthet av "vanlige ord" (chat-sprak, emoji, @mentions) - VANLIGE-lista
(minne.rs:167-175) er handskrevet for norsk skriftlig tanke-prosa, ikke for
chat.

### b) Import av samtaler (Slack, e-post, motetranskript) med avsender
Ingenting i dag modellerer "hvem sa hva". Paragraph (understand.rs:97-117)
har ingen avsender-felt, forstatt-tabellen (minne.rs:33-44) har ingen
avsender-kolonne, og hele pipen fra fil -> understand::split -> avsnitt
antar en forfatter per dokument - det er derfor derive_title
(lib.rs:94-109) og tittel-logikken bare bryr seg om overskrift/filnavn, ikke
om hvem som skrev noe. entities-tabellen (db.rs:21-28, tom i dag) er den
naermeste eksisterende plassen a modellere en avsender/person som en
entity (kind='person'), og anchors (db.rs:45-51) kunne kobling
avsnitt->avsender - men begge er spesifisert for kildekode-opprinnelse
(source_ref, repo-kolonner i entities, db.rs:25-26) og har aldri vaert
skrevet til, sa det finnes ingen bevist kontrakt a bygge videre pa - bare et
skjelett.

Det som vil knake konkret: Paragraph.hash (understand.rs:105, FNV-1a av ren
tekst, understand.rs:193-200) er identitets-nokkelen overalt (rettelser,
minne, relasjoner). To personer som skriver akkurat samme setning i en
Slack-trad ("Ja, det funker") ville i dag kollidere til samme hash og bli
behandlet som ett og samme avsnitt - riktig oppforsel for ett notats egne,
uforanderlige tanker, feil oppforsel for en samtale der avsender er del av
identiteten. Hashen ma sannsynligvis bli hash(avsender + tekst) eller noe
lignende, noe som er en endring i en primaernokkel brukt i tre tabeller
(forstatt, rettelser, relasjoner).

### c) Strukturert sporring over det utledede
minne::spor() (minne.rs:645-698) er noyaktig dette allerede: regelbasert
monstergjenkjenning (monster(), :564-595) + SQL mot forstatt/rettelser uten
noe LLM-kall i sokeveien. Det baerer strukturert sporring godt for de fire
monstrene den kjenner (uavklart/venter/bestemt/forkastet). Det som vil
knake ved skalering: spor() bygger en fast SQL-streng per monster
(minne.rs:650-662) - en ny sporringstype (f.eks. "hva sa Kari om
budsjettet") krever en ny hardkodet gren, ikke en generell sporremotor. Med
tusen avsnitt i ett notat (i stedet for ti) er dette fortsatt greit for
spor() (SQL, ikke O(n) i prosessminne), men
understand::understand() sender alle nye/ukjente avsnitt i notatet i ett
claude-kall (understand.rs:331-333) - ingen paginering. Et notat med tusen
ukjente avsnitt (f.eks. et importert motetranskript pa forste indeksering)
gir en kjempeprompt, med 120s timeout (understand.rs:33) som ikke skalerer
med input-storrelse.

## 6. Det som vil gjore vondt

1. Databasesti-avvik mellom CLI og app: indexer/src/cli.rs:10 setter
   standard-DB til .../creatorhub-notes/index.db, mens
   app/src-tauri/src/lib.rs:73 setter .../creatorhub-notes/notater.db. De
   eneste stedene disse faktisk blir samme fil er fordi shell-scriptet
   "notat" (linje 17) eksplisitt overstyrer med
   "--db $HOME/.../notater.db". Kjorer noen notes-index direkte uten --db
   (naturlig ting a gjore nar man utvider CLI-en), skriver de til en helt
   annen, tom database enn appen leser fra - stille, ingen feilmelding.
   Dokumentasjonskommentaren i lib.rs:64 ("Samme fil som notat bruker") er
   bare sann pa grunn av scriptet, ikke pa grunn av koden selv.

2. Paragraph.hash som primaernokkel overalt, uten avsender eller posisjon i
   identiteten (understand.rs:183-185, brukt som PK-komponent i forstatt
   minne.rs:43, rettelser rettelser.rs:58, relasjoner minne.rs:75). All
   videre bygging pa "hvem sa hva" eller "samme setning i to ulike samtaler
   er to ting" krever a endre denne nokkelen tre steder samtidig, og alle
   eksisterende rader i alle tre tabeller mister koblingen sin ved
   migrering (nokkelen ER dataene - det finnes ingen separat surrogate ID a
   migrere fra).

3. Ett LLM-kall for hele bunken av ukjente avsnitt, ingen paginering
   (understand.rs:331-333, kjor() 120s timeout understand.rs:33). Dette er
   en bevisst kostnadsoptimalisering for notater i dagens skala (ti-tjue
   avsnitt), men et importert transkript eller en lang Slack-trad med
   hundrevis av ukjente avsnitt pa forste import vil enten time ut, eller
   sende en enormt lang prompt til en billig Haiku-modell valgt nettopp for
   korte kall (understand.rs:25-32, "tretten sekunder er normalen for en
   handfull avsnitt"). A utvide til batching er en reell kodeendring i
   understand(), ikke en konfig-justering.

4. entities/anchors/edges er spesifisert for kildekode-opprinnelse, ikke
   for personer/samtaler (source_ref, repo-kolonner, db.rs:21-28). Bruker
   man dem som de star for "avsender som entity", arver man kolonnenavn som
   ikke gir mening (repo for en Slack-bruker?), og siden ingenting
   noensinne har skrevet til dem, er det ingen reell erfaring med hvordan
   anchors.confidence/confirmed (db.rs:48-49) faktisk skal fylles i praksis
   - de er ubevist design, ikke et testet monster a bygge pa.

5. Pagaende sammenkobling gjor navaerende tilstand ustabil a lese presist:
   minne.rs (untracked) har Understanding.earlier allerede i typen
   (understand.rs:130) men aldri fylt (understand.rs:142-144), og frontend
   (api.ts:43) mangler feltet helt. Skulle man bygge memory-pa-tvers-av-
   notater na, er risikoen at man dupliserer noe den andre agenten er midt
   i a fullfore - verdt a sjekke inn med dem for noen nye
   tabeller/kommandoer legges til for punkt 5a i planen.

## Fasitkilder for tvil
- Tabellbruk: grep -rn for hvert tabellnavn i indexer/src/*.rs og
  app/src-tauri/src/*.rs, verifisert manuelt at treff utenfor
  skjema-definisjonen finnes eller ikke finnes.
- Untracked/modifisert status: git status --short apps/creatorhub-notes og
  git diff --stat -- apps/creatorhub-notes.
- Semantisk sok ubrukt av app: grep -n "search::" app/src-tauri/src/lib.rs
  gir bare search::text, aldri search::query/query_paths.
