# Gjenfinning på norsk

Måler den ene antakelsen som avgjør om «jeg finner ikke igjen ting» blir
bedre: at et søk på norsk må tåle bøyning. «utstyret» og «utstyr» er samme
ord, og hvilken av dem hun husker at hun skrev er tilfeldig.

Samme disiplin som klassifiseringstesten ved siden av: **mål før du tror på
det.** Alt under er kjørt, ikke resonnert fram.

## Datasettet

`indexer/tests/fixtures/gjenfinning/` — 23 norske notater skrevet slik appen
skriver dem (toppfelt med `id:` og `type:`, datoprefiks i filnavnet,
overskrift), og 20 søk i `sporringer.toml`.

Hvert søk har tre utfall, og korpuset er hele verden — så «falskt» er noe som
kan telles, ikke noe som skjønnes:

| | Betyr |
|---|---|
| **ekte** | notatet handler om det hun spurte om |
| **sammensetning** | et annet ord som begynner likt: «utstyr» → «utstyrsregister». Svakere, men ikke galt |
| **falskt** | alt annet som kom tilbake |
| **tapt** | et ekte treff som ikke kom med |

Søkene dekker bestemt form begge veier, flertall, genitiv, verb i infinitiv og
preteritum, sammensetning, delvis ord, æ/ø/å, og de tre operatorene fra bølge
1 (`-ord`, `"frase"`, `AND`).

Kjør: `cargo test --lib maaling -- --nocapture`

## Resultatet

20 spørringer over 23 notater:

| | ekte | samm | falsk | tapt |
|---|---|---|---|---|
| bølge 1 (ordet slik det ble skrevet) | 11 | 0 | 0 | 20 |
| bølge 3, ordlista ikke lastet ned | 21 | 2 | 1 | 10 |
| bølge 3, bare bøyning | 29 | 0 | 1 | 2 |
| **bølge 3, bøyning + prefiks** | **31** | **4** | **3** | **0** |

**+20 ekte treff. +3 falske. 0 tapte.** Av 31 mulige ekte treff fant bølge 1
elleve; nå finnes alle.

De tre falske, i sin helhet:

| søk | falskt treff | hvorfor |
|---|---|---|
| `møter` | «Jeg **møtte** Kari på kontoret» | «møte» er både substantiv og verb, og de deler former. Ekte tvetydighet i norsk, ikke en feil i koden |
| `kart` | «**Kartongene** fra flyttingen» | prefikset `kart*`. Kartong er ikke en sammensetning av kart, det begynner bare likt |
| `kartet -kø` | samme kartong | samme prefiks |

To av tre er det samme ordet. Prisen for bøyning er ett falskt treff.

## Sammensetninger: ja, men bakerst

Spørsmålet var om et søk på «utstyr» skal treffe «utstyrsregister». Målt:

| | ekte | samm | falsk | tapt |
|---|---|---|---|---|
| bare bøyning | 29 | 0 | 1 | 2 |
| + prefiksrunde | 31 | 4 | 3 | 0 |

Prefiksrunda kjøper fire sammensetninger **og** to ekte treff ingen bøyning
kan nå — søket `leverand`, altså et halvskrevet ord. Den koster to falske
(kartongen, to ganger).

Verdt det. Men de er svakere treff, og de behandles som det: `search::text`
kjører de eksakte formene først og fyller lista, og bare hvis det er plass
igjen kjøres runde to med grunnforma som prefiks. Sammensetningene legger seg
etter de eksakte treffene, aldri foran.

Prefikset settes på **grunnforma**, ikke på ordet hun skrev: `utstyret*`
finner ingenting nytt, `utstyr*` finner registeret.

Én halvdel av sammensetningene er utenfor rekkevidde: FTS5 kan bare søke på
prefiks. `utstyr` finner `utstyrsregister` (utstyr står først), men aldri
`sikkerhetsutstyr` (utstyr står sist). Det ville krevd en egen indeks over
ordene baklengs.

## Når ordlista ikke er lastet ned

Ordlista ligger ikke i repoet. Uten den:

> Ordlista mangler. Søket finner ordene slik du skrev dem, og ord som begynner
> likt — men «utstyret» finner ikke «utstyr».

Målt er det 21 ekte treff mot 31 — omtrent to tredjedeler. Søket virker, det
er bare bøyningen som er borte. Delvise ord virker fortsatt, fordi
prefiksrunda da settes på ordet slik det ble skrevet.

`ordbank::status` gir beskjeden, i disse ordene. Appen viser den ikke ennå.

Hentes slik:

```
curl -O https://www.nb.no/sbfil/leksikalske_databaser/ordbank/20220201_norsk_ordbank_nob_2005.tar.gz
tar xzf 20220201_norsk_ordbank_nob_2005.tar.gz
notes-index ordbank <mappe>/fullformsliste.txt
```

Norsk Ordbank bokmål 2005, Språkbanken ved Nasjonalbiblioteket, CC BY 4.0.

## Om ordlista

| | |
|---|---|
| ordformer | 1 143 887 |
| distinkte former | 617 139 |
| lemmaer | 154 824 |
| fila fra Språkbanken | 98 MB, ISO-8859-1, CRLF |
| `ordbank.db` etter innlasting | 107 MB |
| innlasting | under fire sekunder |

Hvor mange former et søkeord utvides til, over alle 617 139 formene:

| median | p90 | p99 | maks |
|---|---|---|---|
| 4 | 7 | 11 | 31 |

Ingen utvidelse eksploderer. Verstefallet er «vakt» med 31 former, og det er
tvetydigheten mellom substantivet og verbet. Derfor er det ingen øvre grense i
koden — det er ikke noe å beskytte seg mot.

**Ordlista fikk si egen fil.** 107 MB hører ikke hjemme i `notater.db`, som er
den ene basen som ikke kan bygges opp igjen. Den ligger i `ordbank.db` ved
siden av, og `db::open` kobler den på når den er der. Sletter man den, mister
man bøyningen og ingenting annet.

**Genitiv finnes ikke i fullformslista.** Målt: «leverandøren» gir fire
former, «leverandørens» gir null. S-genitiv kan henges på hvilken som helst
form, så Norsk Ordbank lister den ikke som egen bøyning. Regelen som dekker
det er å prøve ordet uten s når ordet er ukjent — og den kan ikke bomme på
«hus», «plass» eller «tips», for de står i lista og kommer aldri dit.

## To feil som gjorde at ordlista aldri hadde virket

`ordbank.rs` ble bygget i fase 1 og aldri kjørt mot den ekte fila. Den kunne
ikke ha virket:

1. **Fila er ISO-8859-1.** Første linje med en æ i seg fikk
   `BufRead::lines()` til å gi opp med en UTF-8-feil.
2. **Overskriftsrada heter `LOEPENR`,** ikke `LOPENR` som koden lette etter.
   Rada slapp gjennom og drepte innlastingen på `parse()` i neste steg.

Begge rettet. Overskrifta kjennes nå igjen på at andre kolonne ikke er et
tall, ikke på et bestemt navn.

Og en tredje, funnet ved måling: **oppslaget manglet en indeks.** Uten en
indeks på `lemma_id` skanner «hvilke andre former har dette lemmaet» hele
tabellen på 1,1 millioner rader, én gang per søkeord.

| | uten indeks | med |
|---|---|---|
| søk på ett ord, 1000 notater | 58,7 ms | 0,9 ms |
| søk med AND, 1000 notater | 377 ms | 1,8 ms |

## Ytelse

`cargo test --release --lib ytelse -- --ignored --nocapture`

Verste fall med vilje: tolv ord i hele ordforrådet, alle i hvert eneste notat,
så hvert eneste ledd i en utvidet spørring treffer hver eneste bit og bm25 må
score alt. Ekte notater har tusenvis av ord, og de fleste leddene treffer da
ingenting.

| | bølge 1 | bølge 3 |
|---|---|---|
| **1000 notater / 1000 biter** | | |
| ett ord | 0,5 ms | 0,9 ms |
| to ord | 0,7 ms | 1,7 ms |
| AND | 0,7 ms | 1,8 ms |
| negasjon | 0,0 ms | 0,3 ms |
| delvis ord | 0,0 ms | 1,0 ms |
| **1000 notater / 14 000 biter** | | |
| ett ord | 5,3 ms | 8,3 ms |
| to ord | 8,9 ms | 13,6 ms |
| AND | 9,0 ms | 16,7 ms |
| negasjon | 0,4 ms | 1,3 ms |
| delvis ord | 0,0 ms | 7,0 ms |

Under to millisekunder ved tusen notater, under tjue ved fjorten tusen avsnitt
— i verstefallet. Det koster omtrent det dobbelte av bølge 1, og det er to
spørringer i stedet for én.

## Filnavn og toppfelt ute av indeksen

`chunk::split` la et hodefelt `// <sti>` på hver bit og hoppet ikke over
toppfeltet. Målt på det samme korpuset, med den gamle oppdelingen:

| søk | traff |
|---|---|
| `2026` | 23 av 23 notater |
| `type` | 23 av 23 notater |
| `id` | 23 av 23 notater |

Etter: 0. Hodefeltet står nå bare når det bærer et funksjonsnavn — som er hele
grunnen til at det finnes — og toppfeltet hoppes over. Linjenumrene peker
fortsatt inn i fila slik den ligger på disk.

Dette er grunnen til at «bølge 1» i tabellen øverst har 0 falske treff. Uten
denne rettelsen ville de to søkene `2026` og `type` alene fylt hele lista med
falske treff, i alle fire radene.

## Æ, ø og å

Verifisert mot sqlite3 med nøyaktig tokenizeren indeksen bruker:

| innstilling | «Søknaden til leverandøren om måling» blir |
|---|---|
| `remove_diacritics 0` | søknaden, leverandøren, måling |
| `remove_diacritics 1` og `2` | søknaden, leverandøren, **maling** |

Æ og ø foldes aldri, uansett innstilling — de er egne bokstaver i Unicode,
ikke bokstav pluss tegn. Bare å foldes. `0` er riktig valgt, men den eneste
faktiske forskjellen er at «måling» og «maling» holdes fra hverandre.
Kommentaren i `db.rs` som lovet mer er rettet.

Bøyningen endrer ikke dette: `måling` gir bare målingsnotatet, `maling` bare
malingsnotatet.

## Skrivefeil: målt, ikke bygget

Spørsmålet var om «mente du» er verdt det eller bare støy. Målt over 3045
enkelttegns skrivefeil av tolv vanlige norske ord, mot alle 617 139 formene:

| | |
|---|---|
| gjennomsnittlig antall kandidater innen redigeringsavstand 1 | 1,5 |
| andel med nøyaktig én kandidat | 79 % |
| andel uten kandidat | 0 % |

Det er godt nok. Fire av fem skrivefeil har ett entydig svar, og ingen har
null. Ordlista kan bære et «mente du».

**Ikke bygget likevel**, og det er et valg: et forslag må vises for at det
skal bety noe, og flata er appens. Å bygge et forslags-API som ingenting
kaller ville vært nøyaktig feilen ordbanken selv sto i — ferdig i fase 1,
koblet til ingenting. Tallet ligger her, for den bølgen som eier flata.

## Det som ikke ble målt, og hvorfor

**Overskrift som veier tyngre enn brødtekst.** `chunk_fts` har én kolonne, og
`bm25()` kan bare vekte kolonner. Et treff i `# Møtet` er derfor nøyaktig like
mye verdt som det samme ordet nede i teksten — ikke fordi noen valgte det,
men fordi indeksen ikke skiller. Å endre det er en egen kolonne, en ny
trigger, en migrering og en full reindeksering.

**Rangering per notat i stedet for per bit.** `chunk::split` deler i
40-linjers vinduer, og bm25 rangerer hvert vindu som sitt eget dokument. IDF
regnes derfor over vinduer, ikke notater, og et langt notat fortynner sine
egne treff. Lengdenormaliseringen i bm25 gjør nesten ingenting her, siden alle
vinduene er omtrent like lange. Samme sak: krever at indeksen bygges om.

**Ferskhet i rangeringen.** `chunks` har ingen tidskolonne. Å legge den til er
en migrering.
