# Revisjon: organisering og gjenfinning i notatappen

Lest: `app/src/App.tsx`, `app/src/Editor.tsx`, `app/src/Panel.tsx`, `app/src/api.ts`,
`app/src/styles.css`, `app/src-tauri/src/lib.rs`, `minne.rs`, `understand.rs`,
`rettelser.rs`, `overvaking.rs`, `migrering.rs`, `indexer/src/{search,index,db,chunk,gitsrc,ordbank,sti}.rs`,
testene i `indexer/tests/`. Databasen `~/Library/Application Support/creatorhub-notes/notater.db`
er inspisert (5 notater, `avsnitt` og `forstatt` er tomme).

FTS5-oppførselen er verifisert empirisk mot sqlite3 med nøyaktig samme
tokenizer (`unicode61 remove_diacritics 0`), ikke gjettet.

---

## Om `remove_diacritics 0` — hva det faktisk gjør

Kommentaren i `indexer/src/db.rs:48-50` sier at standardverdien 1 «folder æøå
bort slik at «søk» og «sok» blir samme token». **Det stemmer ikke.** Målt:

| tokenizer | «Søknaden til leverandøren om måling» blir |
|---|---|
| `remove_diacritics 0` | søknaden, leverandøren, måling |
| `remove_diacritics 1` | søknaden, leverandøren, **maling** |
| `remove_diacritics 2` | søknaden, leverandøren, **maling** |

æ og ø foldes **aldri**, uansett innstilling — de er egne bokstaver i Unicode,
ikke bokstav+diakritisk tegn. Bare **å** foldes (å → a). Case-folding av Ø/Æ/Å
virker i alle tre (søk på `SØKNADEN` finner `søknaden`).

Innstillingen er altså riktig valgt, men av feil grunn, og gevinsten er mye
mindre enn kommentaren lover: den eneste faktiske forskjellen er at «måling» og
«maling» holdes fra hverandre. Kostnaden er at en bruker som skriver «maling»
når hun mente «måling» får null treff — og appen har ingen fallback (funn 2).

Det store norsk-problemet ligger ikke her. Det er at det ikke finnes noen
stemming i det hele tatt (funn 1).

---

## ØDELAGT — hun finner ikke det hun har skrevet, eller får feil svar

**1. Ingen bøyningshåndtering. «utstyret» finner ikke «utstyr», «beslutning»
finner ikke «beslutningene».**
Verifisert: `"utstyret"` treffer bare dokumentet med bestemt form, `"utstyr"`
bare det med ubestemt. `search::text` (`indexer/src/search.rs:91`) sender rå
siterte termer uten prefiks eller stammereduksjon.
Dette er hovedproblemet hennes, uttrykt som én linje kode. På norsk er det
tilfeldig hvilken form av et ord du husker at du skrev.

**2. Null treff gir ingen fallback til prefikssøk.**
`search::text` (`search.rs:91-118`) gjør ett forsøk. Ingen retry med `*`. Den
andre søkestien i systemet — `minne::spør` — gjør nøyaktig dette
(`minne.rs:802-819`: `stamme()` + `"…"*`). Den mer tilgivende varianten finnes
altså i kodebasen og brukes bare i den sjeldne stien.

**3. Negasjon er invertert. `render -kø` gir *flere* treff, ikke færre.**
`quote_fts_query` (`search.rs:77-82`) siterer hver term: `-kø` blir `"-kø"`,
tokenizeren spiser bindestreken, resultatet er `"render" OR "kø"`. Verifisert:
spørringen returnerte også dokumentet som *bare* inneholder «køen». Hun ber om
å utelukke noe og får det inn i stedet.

**4. Sitater virker ikke. Frasesøk er umulig.**
Skriver hun `"render køen"` blir det `"""render" OR "køen"""` — anførselstegnene
dobles og blir data, ikke syntaks (`search.rs:79`). Verifisert: returnerte alle
tre dokumenter. Det er ingen måte å be om «disse ordene, ved siden av hverandre».

**5. Flerordssøk er rent OR — det finnes ingen AND.**
`search.rs:81` setter termene sammen med ` OR `. Kommentaren over
(`search.rs:72-76`) argumenterer godt for hvorfor det ikke er én sitert frase,
men hopper over mellomtingen. «render kø» returnerer alt som nevner «render».
bm25 rangerer riktig, men lista er full av støy og hun har ingen måte å stramme
inn.

**6. Utdraget markerer feil ord når notatet inneholder `**fet skrift**`.**
FTS5 rammer inn treffordene med `**` (`search.rs:102`), og `Utdrag`
(`App.tsx:94-100`) deler på `**` og markerer annethvert stykke. Et notat med
egen fet skrift i utdraget forskyver pariteten: markeringen legger seg på ord
som ikke traff, og treffordet står umarkert. Hele poenget med utdraget er å vise
*hvorfor* notatet traff.

**7. Strukturert spørring feiler stille når mønsteret treffer men svaret er tomt.**
`App.tsx:505`: seksjonen rendres bare når `spurt.treff.length > 0`. Og
`forstatt` fylles bare av `understand_note`, som krever `claude`-kommandolinja
(`understand.rs:13-17`). Er den ikke der — som i basen på denne maskinen nå, 0
rader i `forstatt` — gir *alle* de fire mønstrene tom liste, uten et ord om at
appen kjente igjen spørsmålet og ikke har noe å svare med.

**8. Motstridende tom-tilstand.** `App.tsx:505` rendrer strukturerte treff, og
rett under dem rendrer `App.tsx:526` «Fant ingen notater med «hva er
uavklart».» Hun ser fem svar og beskjeden om at det ikke finnes noen.

**9. Tidsspørsmål gir selvsikkert feil svar.**
«hva ble bestemt forrige uke» → `mønster()` (`minne.rs:741`) kjenner igjen
`Bestemt`, og restordene «forrige» og «uke» står ikke i `BINDEORD`
(`minne.rs:723-729`), så de blir til FTS-prefiksfilter (`minne.rs:768, 813`).
Resultatet er «beslutninger i notater som bokstavelig talt inneholder ordet
uke». Hun får en kort, troverdig liste som er feil.

**10. Slettede og omdøpte notater etterlater spøkelsesrader som ikke kan
åpnes.** `synk` sletter bare `avsnitt` for den kilden den får inn
(`minne.rs:152`), og ingenting rydder når en fil forsvinner eller får nytt navn
— `overvaking` melder slettinger (`overvaking.rs`), men `App.tsx:370-375` gjør
bare `listNotes` + `reindex`. `forstatt`-radene blir liggende for alltid, dukker
opp i «hva er uavklart» og i «Tidligere om dette», og et klikk går til
`readNote` som feiler → rå Rust-feilmelding i `setFeil` (`App.tsx:283`).

**11. Søket dekker ikke kortformene.**
`search_notes` slår bare opp i `chunk_fts` (`lib.rs:329`). `forstatt_fts` —
kortformene appen har destillert ut, altså det korteste og mest presise som
finnes om hvert avsnitt — er kun nåbar gjennom de fire spørsmålsmønstrene. Et
avsnitt oppsummert som «Depositum» finnes ikke ved å søke «depositum» hvis ordet
ikke står i selve teksten.

**12. Notater som treffer `.gitignore` listes, men er usynlige for søk.**
Lista leses fra filsystemet (`lib.rs:236-266`), indeksen fra `git ls-files -s`
(`gitsrc.rs:50`) etter `git add -A` (`lib.rs:280`). To ulike definisjoner av
«et notat». Ingen advarsel. Det samme gjelder motsatt vei: en `.md` i en
skjult mappe indekseres, men filtreres bort av `collect_notes`
(`lib.rs:243-245`) og finnes ikke i lista.

**13. Å åpne et notat setter markøren nederst i fila.**
`Editor.tsx:287`: `anchor = doc.length` for alt annet enn et ferskt notat, med
`scrollIntoView: true`. Åpner hun et langt notat fra et søketreff, lander hun i
bunnen — ikke på treffet, ikke engang på toppen.

**14. Søketreff hopper ikke til treffet, og linjenumrene som ville gjort det
kastes.** `SearchHit` bærer `start_line`/`end_line` hele veien fra
`lib.rs:47-50` gjennom `api.ts:9-10`, og `App.tsx:537` kaller `åpne(t.path)`
uten posisjon. Dataene finnes, ledningen mangler.

**15. Bare ett treff per notat, og ingen vei til de andre.**
`lib.rs:334-337` dedupliserer på sti. Et notat med åtte forekomster viser ett
utdrag, og det finnes ingen «neste treff».

**16. Det finnes ikke søk *i* et notat.**
`Editor.tsx:256` bruker `minimalSetup`, som ikke inkluderer
`@codemirror/search`, og ⌘F er kapret globalt til søkefeltet
(`App.tsx:425-428`). I et notat på tre tusen ord er det ingen måte å finne et
ord. Dette er «jeg finner ikke igjen ting» i miniatyr, på det ene stedet hun
allerede vet at det står.

**17. «Tidligere om dette» går stille i vasken når avsnittet er redigert.**
`finn_avsnitt` slår opp på FNV-hash av nøyaktig avsnittstekst
(`minne.rs:887-892`). Ett endret komma → `null` → `setPeker` kalles aldri
(`App.tsx:272-276`). Hun havner nederst i et fremmed notat uten markering og
uten forklaring på hvorfor.

**18. Datoen i «Du bestemte det samme 3. september» er når appen leste
avsnittet, ikke når hun skrev det.** `minne::lagre` setter `tidspunkt: nå()`
ved innsetting (`minne.rs:257-277`). Importerer hun et gammelt notat i dag, står
det «i dag». Bygges basen opp igjen, blir alt i går. Datoen er den eneste
verifiserbare opplysningen på linja.

**19. Rangeringsklippet: 80 biter inn, 40 notater ut, og hun ser aldri hvor
mange som falt bort.** `search::text(&conn, &query, 80)` (`lib.rs:329`),
deretter deduplisering med `break` på 40 (`lib.rs:352`). Med OR-semantikk kan
de 80 best rangerte bitene komme fra fem notater. Hun ser fem treff og tror det
er alt.

**20. Rangeringen regnes per bit, ikke per notat.**
`chunk::split` (`chunk.rs:45`) deler i 40-linjers vinduer med 10 linjers
overlapp, og bm25 (`search.rs:101`) rangerer hvert vindu som et eget dokument.
Et notat som nevner ordet én gang rangeres omtrent likt med et notat som handler
om det. IDF er også regnet over vinduer, ikke notater, så et langt notat
fortynner sine egne treff.

**21. Ferskhet teller ikke i rangeringen.** `order by k.rank` alene
(`search.rs:106`). Et notat fra 2024 legger seg over gårsdagens hvis bm25 sier
det. For «hva var det jeg skrev om dette forleden» er ferskhet ofte det
sterkeste signalet som finnes.

**22. Filnavn og frontmatter forurenser indeksen.**
Hver bit får et hodefelt `// <sti>` (`chunk.rs:68-71`), og `chunk::split` hopper
ikke over frontmatter slik `understand::split` gjør (`understand.rs:347`).
Følgen: «tittel» returnerer hvert eneste `*-uten-tittel.md`, «2026» returnerer
alt fra i år, «id» og «type» treffer samtlige notater, og når treffet står i
hodefeltet er utdraget hun får se en filsti-kommentar.

---

## FRIKSJON — virker, men koster tid hver gang

**23. Hele notatmappen leses fra disk ved hver lagring.**
`collect_notes` (`lib.rs:236-266`) leser *innholdet* i hver `.md` bare for å
utlede tittelen, og `list_notes` kalles ved oppstart (`App.tsx:355`), etter hver
autolagring (`App.tsx:235`) og ved hver ekstern endring (`App.tsx:373`). Ved to
tusen notater er det to tusen filleser hvert sekund hun tar en pause i
skrivingen. Tittelen finnes allerede i `chunks`-tabellen.

**24. Ingen virtualisering av lista.**
`App.tsx:548-562` rendrer én `<button>` per notat, uten memo, og hele lista
bygges på nytt hver gang `setNotes` kalles — altså ved hver lagring. To tusen
rader × ett sekund.

**25. `git add -A` over hele notatmappen ved hver skrivepause.**
`reindex_in` (`lib.rs:280`) kalles fra `lagre` (`App.tsx:234`) med 900 ms
debounce. Riktig for ferskhet, men det er en full arbeidstre-skanning per pause.

**26. Det valgte notatet rulles ikke inn i synsfeltet.**
Ingen `scrollIntoView` i `App.tsx`. Åpner hun et notat fra et søk og trykker
«Vis alle», er lista tilbake på toppen og det åpne notatet står markert
(`styles.css:311`) et sted hun ikke ser.

**27. Ingen tastaturnavigasjon i lista.**
`App.tsx:419-438` har ⌘N, ⌘F og Escape. Ingen piltaster, ingen Enter i
søkefeltet for å åpne første treff. Hvert eneste søk må avsluttes med musa.

**28. Ingen tilbake-knapp.** `åpne` (`App.tsx:253`) fører ingen historikk. Et
klikk fra «Tidligere om dette» til et annet notat er enveis; veien tilbake er å
finne notatet i lista igjen.

**29. Bare ett notat åpent av gangen.** Én `path`-state (`App.tsx:107`). Ingen
deling av flaten, ingen andre vindu. Å skrive et referat mens man leser et annet
notat er ikke mulig.

**30. Det sist åpne notatet gjenopprettes ikke.** `path` starter `null`
(`App.tsx:107`); `localStorage` brukes bare til tema (`tema.ts`) og
panelbryteren (`App.tsx:113`). Hver oppstart begynner på «Velg et notat».

**31. Ingen markør- eller rulleposisjon per notat.** Åpner hun det samme notatet
igjen, hopper hun til bunnen (`Editor.tsx:287`). Hvor hun var sist finnes ikke
lagret noe sted.

**32. Søketreff viser ingen dato.** `App.tsx:534-542` viser tittel og utdrag. I
den grupperte lista har hver rad et klokkeslett og hver seksjon en dag; i det
øyeblikket hun søker, forsvinner all tidsinformasjon.

**33. Strukturerte treff viser heller ingen dato**, selv om `tidspunkt` ligger i
nyttelasten (`api.ts:131`). `App.tsx:515-519` viser kortform, «venter på» og
tittel.

**34. «{treff.length} treff» er det avkortede tallet.**
`App.tsx:532` viser lengden på den kappede lista (maks 40, funn 19) som om det
var totalen.

**35. Radene har ingen forhåndsvisning.** `App.tsx:557-558`: tittel og
klokkeslett. Alle nye notater heter «Uten tittel» (`lib.rs:198`), så en dag med
fem raske notater er fem identiske rader skilt av et klokkeslett.

**36. Escape tømmer søket uansett hvor markøren står.**
`App.tsx:429-434` lytter på `window` uten å se på `e.target`. Et refleksmessig
Escape midt i skrivingen kaster søket hun nettopp bygde opp.

**37. Mønstergjenkjenningen kaprer vanlige søk.**
`inneholder` bruker `q.contains(o)` — delstreng, ikke ord (`minne.rs:735, 741`).
Et søk på «avhengigheter» slår ut på «avhengig» → `Venter`. «beslutning» →
`Bestemt`. «vraket» → `Forkastet`. «åpne oppgaver» → `Uavklart`. Fritekstsøket
kjører fortsatt, så det ødelegger ingenting, men et strukturert panel spretter
opp over resultatene uten grunn.

**38. Panelet og spørresøket bruker ulike ord for det samme.**
«Hva har jeg forkastet» slår opp `f.type = 'uenighet'` (`minne.rs:838`), som
`Panel.tsx:36` plasserer under «Idéer og alternativer». Ingen av de fire
mønstrene heter det samme som noen av panelets fire plasser.

**39. Det strukturerte svaret viser ikke hva det bygger på.**
`App.tsx:507-508` sier «Fra det du har skrevet før, ikke fra ordene du søkte
på», men ikke hvilket mønster som slo til, og ikke hvilke restord som ble til
filter. Når `stamme()` kapper «banner» til «bann*» (`minne.rs:802`) har hun
ingen måte å se hvorfor svaret er rart.

**40. `stamme()` er en blind endelsekapping med en lengdegrense som slår
ujevnt.** `minne.rs:803`: «kartet» (6 tegn) → «kart», men «arket» (5 tegn) →
«arket». Samme endelse, motsatt resultat, avhengig av ordlengde. Kommentaren
over erkjenner det og peker på ordbanken — som ikke er koblet til (funn 55).

**41. To databaseåpninger og en migreringssjekk per søk.**
`search_notes` åpner basen (`lib.rs:328`), og `spor_notater` åpner den igjen via
`base()` (`lib.rs:560, 581`), som kjører `migrering::kjør` og tre
`create table if not exists`-batcher — også når mønsteret ikke treffer.

**42. Dupliserte React-nøkler når samme setning står to ganger i ett notat.**
`App.tsx:511` bruker `${t.sti}-${t.hash}`, `Panel.tsx:92` bruker `t.hash`.
`avsnitt` tillater to identiske tekster i samme kilde
(`unique(kilde, rekkefolge)`, `minne.rs:48`). `posisjon` returnerer alltid den
første (`minne.rs:887`), så begge linjene fører til samme sted.

**43. Kodefiler i notatmappen indekseres og kastes så bort.**
`gitsrc::EXTENSIONS` (`gitsrc.rs:5`) inkluderer ts/tsx/rs/py/swift/sql.
`search_notes` avviser dem etterpå via `resolve_in`s `.md`-krav
(`lib.rs:139-141`) — etter at de har spist plasser i 80-treffsbudsjettet.

**44. Tittelen kan komme fra en kodeblokk.**
`derive_title` (`lib.rs:104-112`) tar første linje som starter med `#` blant de
40 første, uten å se på om den står inne i en ```-blokk. Limer hun inn et
skallskript øverst, heter notatet «kjør dette». Overskriften renses heller ikke
for markdown: `# **Møte** med *Kari*` står med stjerner i lista.

**45. `notater.db` blander det som kan bygges opp igjen med det som ikke kan.**
Verifisert i den levende fila: `chunks`, `chunk_fts`, `chunk_vec` ligger side om
side med `avsnitt`, `forstatt`, `rettelser`, `relasjoner`. Det motsier
skillet `sti.rs:16-21` dokumenterer («den ene kan slettes og bygges opp igjen
fra git, den andre inneholder brukerens egne rettelser»). Følger noen rådet og
sletter indeksen, ryker rettelsene, avsnitts-id-ene og hver eneste `tidspunkt`.

---

## MANGLER — finnes ikke, og noen vil savne det

**46. Ingen mapper i grensesnittet.**
`collect_notes` går rekursivt (`lib.rs:242`) og `Note.path` bærer undermappen
hele veien til frontend — og ingenting rendrer den. `create_note_in`
(`lib.rs:195`) kan bare skrive i roten. Organiserer hun i Finder, flater appen
det ut, og «Kunder/Acme/møte.md» og «Privat/møte.md» blir to rader som begge
heter «møte».

**47. Ingen etiketter.** `type:`-feltet skrives tomt inn i hvert nye notat
(`lib.rs:215`), vises hvis det er satt (`App.tsx:81-83`), og det finnes ingen
måte å sette det på og ingen måte å filtrere på det. Formatet har en
etikettplass; produktet har ikke etiketter.
(`#emneknagg` i brødteksten blir tokenisert som ordet uten `#`, så det søkes
tilfeldigvis opp — men det er ikke til å skille fra ordet, og det finnes ingen
liste over hvilke som er i bruk.)

**48. Ingen favoritter og ingen festing.** Alt er mtime-sortert
(`lib.rs:296`). De fem notatene hun lever i synker nedover i det øyeblikket hun
rører noe annet.

**49. Ingen sletting og ingen arkivering.** Det finnes ingen `delete_note`-
kommando i `invoke_handler` (`lib.rs:637-652`). Eneste vei ut er Finder — som
etterlater spøkelsesradene i funn 10.

**50. Ingen omdøping.** Endrer hun overskriften, endres tittelen i lista
(`lib.rs:104`), men filnavnet og `id:`-feltet står som de ble født
(`lib.rs:215`). Et notat som heter «Leverandøravtale» ligger på disk som
`2026-09-10-uten-tittel.md`. Filnavnet er også det eneste som identifiserer
notatet mot `avsnitt.kilde`, `chunks.path` og `rettelser.sti` — så omdøping
utenfra bryter alt (funn 10).

**51. Ingen lenker mellom notater og ingen tilbakelenker.**
Markdown-lenker får farge (`Editor.tsx:53`) og ingen klikkhåndtering. Ingen
`[[wikilenke]]`-oppslag. Den eneste kryssnotat-veien som finnes er «Tidligere om
dette», som er modellgenerert — hun kan ikke selv si at to notater hører sammen.

**52. Ingen måte å si at notater hører sammen.** Ingen prosjekt, ingen serie,
ingen samling. `avsnitt.kilde` er den eneste grupperingen og den er per fil.

**53. Ingen sorteringsvalg.** `list_notes` sorterer på `modified` desc
(`lib.rs:296`), punktum. Ikke opprettelsesdato, ikke tittel, ikke relevans.

**54. Ingen tidsfilter og ingen tidsmønster i spørresøket.**
`Mønster` har fire varianter (`minne.rs:706-712`), ingen av dem temporal, og
søkefeltet har ingen datofasett. Samtidig finnes datoen tre steder: `f.tidspunkt`
i basen, `id:` i frontmatter, og filnavnprefikset. «Fra møtet på tirsdag» og
«forrige uke» er blant de mest naturlige måtene å lete på, og de finnes ikke —
verre, de gir feil svar (funn 9).

**55. Grupperingen ignorerer opprettelsesdatoen.**
`dagsetikett` (`App.tsx:39-46`) bruker filas mtime. Et notat skrevet i mars som
hun retter en skrivefeil i i dag, står under «i dag». Opprettelsesdatoen ligger
i filnavnet og i `id:` og brukes bare til én etikett inne i det åpne notatet
(`App.tsx:82-88`).

**56. Norsk Ordbank er implementert og koblet til ingenting.**
`indexer/src/ordbank.rs` laster fullformslista, har `is_valid_form` og `tags`,
og `indexer/tests/ordbank.rs` tester den. Ingen kode i søkestien kaller den.
Den ene ressursen i repoet som ville løst funn 1 og 2 er ubrukt — og
`stamme()`s egen ponytail-kommentar (`minne.rs:800-801`) peker på den.

**57. Ingen semantisk søk i appen.** `search::query` og `query_paths`
(`search.rs:27, 124`) finnes, `chunk_vec` opprettes (`db.rs:78-81`), og appen
kaller bare `run_no_embed` (`lib.rs:284`) — så tabellen er tom for alltid. «Det
notatet om å ta betalt på forhånd» finner ikke «depositum».

**58. Ingen skrivefeilstoleranse og ingen «mente du».** Tom-tilstanden
(`App.tsx:526-529`) sier at søket leter etter hele ord og lar henne gjette
videre. Ingen trigram, ingen redigeringsavstand, ingen forslag fra ord som
faktisk står i indeksen.

**59. Ingen søkehistorikk, ingen nylige søk, ingen lagrede søk.**

**60. Ingen «hopp til notat» (⌘O / kommandopalett).** Eneste vei til et notat
ved navn er å skrive i fulltekstfeltet og håpe at tittelordene også står i
brødteksten.

**61. Ingen notattelling, og ingen måte å se eller åpne notatmappen.**
Ved to tusen notater vet hun ikke at hun har to tusen notater.

---

## Antall

| Gruppe | Funn |
|---|---|
| Ødelagt | 22 (1–22) |
| Friksjon | 23 (23–45) |
| Mangler | 16 (46–61) |
| **Sum** | **61** |
