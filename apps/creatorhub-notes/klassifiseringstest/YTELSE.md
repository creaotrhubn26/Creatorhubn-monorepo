# Ytelse ved skala

Bølge 6 av revisjonen. Alt her er målt, ikke anslått, og målingene er
kjørbare på nytt — de ligger som ignorerte tester ved siden av koden de
måler, ikke i et skript som råtner.

```text
cd apps/creatorhub-notes/app/src-tauri
cargo test --release --lib -- --ignored --nocapture ytelse_
```

Maskin: MacBook (Darwin 25.4, Apple silicon), varm SSD, `--release`.
Syntetiske baser i `tempfile`-mapper med appens eget skjema, aldri mot
`~/CreatorHub-notater/`.

Tallene under er fra `minne::tests::ytelse_tidligere` og
`minne::tests::ytelse_rydd`, samme kjøring før og etter.

---

## `minne::tidligere` — kryssnotat-minnet

Kjøres ved hver 900 ms-pause i skrivingen, som en del av lesningen.

| Avsnitt i notatet | Før | Etter | |
|---|---:|---:|---|
| 1000 | 1 790 ms | 444 ms | 4,0 × |
| 5000 (importert samtale) | **32 709 ms** | **1 268 ms** | **25,8 ×** |

Per avsnitt: 1,79 ms → 0,44 ms (1000), 6,54 ms → 0,25 ms (5000).

Feilen var at det ble gjort ett FTS-oppslag per avsnitt i notatet, uten
grense. Bare *modellkallene* var begrenset (`MAKS_PAR = 15`); oppslagene var
det ikke. En importert tråd på fem tusen innlegg kostet dermed 33 sekunder
ren SQL per lagring.

To ting er gjort:

- **`MAKS_OPPSLAG = 200`.** Høyst to hundre avsnitt får slått opp kandidater
  i én lagring. Hvilke to hundre avgjøres av hva som er på skjermen —
  `synlig`, samme område og samme telling som `understand` allerede
  klassifiserer først. Et vanlig notat er femti–hundre avsnitt og er dekket
  helt; det er den importerte tråden som kappes, og den kappes der hun ikke
  ser.
- **`prepare_cached`** i `kandidater` og i begge oppslagene i
  `lagret_forhold`. De kompilerte SQL-en sin på nytt for hvert eneste
  oppslag.

Taket som står igjen: kostnaden per oppslag vokser fortsatt med størrelsen
på FTS-indeksen (0,25 ms per oppslag mot 5000 rader, 0,44 mot 1000 — det
første tallet er lavere fordi kappingen slår inn tidligere, per oppslag er
det motsatt vei). Med hundre tusen leste avsnitt i basen vil de to hundre
oppslagene igjen bli merkbare. Da er svaret å sende med hvilke avsnitt
`synk` faktisk fant ny tekst i — den vet det, og ingen spør den om det i
dag.

Låsen: `understand::memo()` slippes (`drop(memo)`) *før* `tidligere` kalles,
så dette arbeidet holder ikke lenger hukommelsen låst. Det var rettet i en
tidligere bølge.

## `minne::rydd` — opprydding etter slettede notater

Kjøres ved hver indeksering, altså ved hver lagring og ved hver
endringsklase utenfra. Var umålt.

| Tilfelle | Før | Etter | |
|---|---:|---:|---|
| 1000 notater, ingenting fjernet | 2,8 ms | 1,6 ms | 1,8 × |
| 1000 notater, 200 fjernet (4000 avsnitt) | **4 022 ms** | **116 ms** | **34,7 ×** |

Fire sekunder for å rydde etter at 200 notater ble borte — under en
`git pull` eller en `notat sync` er det en helt vanlig hendelse.

Tre ting:

- **Ingen plassholdere.** Spørringen var `not in (?,?,…)` med én parameter
  per notat. Over `SQLITE_MAX_VARIABLE_NUMBER` (32 766) ville den feilet;
  under den ble en prepared statement på tusen plassholdere kompilert på
  nytt hver gang. Nå er det én skanning av `avsnitt(id, kilde)` og et
  `HashSet` i Rust.
- **Én transaksjon** rundt slettingene, i stedet for tre autocommit-skriv
  per fjernet avsnitt. Dette er brorparten av gevinsten.
- **Indeks på `relasjoner(annen_id)`.** `delete … where avsnitt_id = ?1 or
  annen_id = ?1` kunne ikke bruke primærnøkkelen for det andre leddet, så
  hver sletting var en full tabellskanning — både her og i `synk` når en
  stor samtale skrives om.

## Ordtellingen i skriveflaten

Ny i bølge 5, og den kjører ved hvert tastetrykk. Målt i Node 24 med samme
regex som `Editor.ordtelling`:

| Notat | Per telling |
|---|---:|
| 1000 linjer / 114 KB | 0,21 ms |
| 10 000 linjer / 1,1 MB | 1,97 ms |

App tegner uansett om ved hvert tastetrykk for å sette lagringsmerket, så
dette er kostnaden som faktisk kom til. Under ett bildeoppdateringsvindu i
begge tilfeller.

## Det som ble målt og *ikke* rørt

- `byggMerker` går fortsatt gjennom hele dokumentet, ikke bare viewportet,
  ved hvert tastetrykk og hver markørflytting. Målt i skriverapporten: 0,15
  ms treiterasjon + 0,14 ms bygging ved 1000 linjer / 83 KB. Det er en
  skaleringsdefekt, ikke et opplevd problem. Rettelsen er å bytte
  `to: doc.length` mot `view.visibleRanges` — ta den når noen har et notat
  på ti tusen linjer.
- `minne::lagre` skriver én autocommit-transaksjon per avsnitt: 268 ms for
  5000, 106 ms for 2000 uendrede. Neste kandidat, og en enkel en (samme
  grep som `rydd`), men den ligger ikke i den varme løkka på samme måte.
- `list_notes` leser hvert notat i sin helhet for å finne tittelen: 19 ms
  for 1000 notater / 10,5 MB på varm SSD. Greit lokalt; det er iCloud og
  nettverksdisk som ville gjort den til det tregeste leddet.
