# notes-index

Semantisk indeks over CreatorHub-monorepoet. Fase 1 av prosjektminne-appen.
Design: `docs/superpowers/specs/2026-09-09-prosjektminne-notatapp-design.md`

## Bruk

    cargo run --release -- index --dry-run /Users/danielqazi/Creatorhubn-monorepo
    export VOYAGE_API_KEY=...
    cargo run --release -- index /Users/danielqazi/Creatorhubn-monorepo
    cargo run --release -- search "hvor beregnes prisingen for lead map"
    cargo run --release -- eval --file gullsett.toml --k 5

Kjør alltid `--dry-run` først. Den teller filer, linjer, biter, tokener og
kostnad, fordelt per filendelse, uten å ringe Voyage og uten å trenge
API-nøkkel. Det er tallet som avgjør om filtrene bør strammes inn før du
betaler.

Målt mot origin/main: 8 023 indekserbare filer, 3 180 395 linjer og 107 386
biter. Det er 41-50 millioner tokener, altså 7-9 dollar med
voyage-code-3 til $0,18 per million. Kjøringen tar 30-60 minutter og gir en
indeksfil på omtrent 650 MB.

Indekseringen embedder og committer én pakke om gangen og skriver framdrift og
tokenforbruk til stderr. Blir kjøringen avbrutt, kjør den samme kommandoen på
nytt: pakkene som allerede er committet står, og bare de gjenstående filene
embeddes. Senere kjøringer leser kun filer der git-blob-hashen har endret seg.

## Uten Voyage: nøkkelordsøk

Notater trenger ikke semantisk søk — noen dusin notater er lite nok til at
enkelt nøkkelordsøk finner det du lette etter. Denne stien krever ingen
`VOYAGE_API_KEY` og gjør ingen nettverkskall:

    cargo run --release -- index --no-embed /sti/til/notater
    cargo run --release -- search --text "søknad skatt"

`--no-embed` skriver `chunks` og `path_state` som vanlig, men lar
`chunk_vec` stå tom. Fulltekstindeksen (SQLite FTS5, `chunk_fts`) fylles
automatisk av triggere på `chunks` — den koster ingen ekstra avhengighet,
FTS5 er allerede kompilert inn i den bundlede SQLite-en. `search --text`
rangerer med FTS5s `bm25()`.

Når Voyage er tilgjengelig igjen, kjør vanlig `index` (uten `--no-embed`) på
det samme repoet: kjøringen finner biter som allerede har tekst men mangler
vektor, og embedder dem der de står — ingen migrering, ingen ny database, og
teksten blir ikke re-indeksert. De samme radene får bare vektorer i tillegg.

## Norsk Ordbank

Brukes fra og med språkfasen, lastes allerede nå. Last ned Bokmål-utgaven fra
Språkbanken (CC-BY 4.0) og pakk den ut, så:

    cargo run --release -- --db <sti> index .   # oppretter databasen
    # deretter fra kode: ordbank::load(&conn, Path::new("ordbank/nob/fullformsliste.txt"))

Katalogen `ordbank/` er git-ignorert.
