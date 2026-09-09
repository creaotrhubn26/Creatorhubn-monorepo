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
biter. Det er 41-50 millioner tokener, altså omtrent 6-8 dollar med
voyage-code-3 til $0,18 per million. Kjøringen tar 30-60 minutter og gir en
indeksfil på omtrent 650 MB.

Indekseringen embedder og committer én pakke om gangen og skriver framdrift og
tokenforbruk til stderr. Blir kjøringen avbrutt, kjør den samme kommandoen på
nytt: pakkene som allerede er committet står, og bare de gjenstående filene
embeddes. Senere kjøringer leser kun filer der git-blob-hashen har endret seg.

## Norsk Ordbank

Brukes fra og med språkfasen, lastes allerede nå. Last ned Bokmål-utgaven fra
Språkbanken (CC-BY 4.0) og pakk den ut, så:

    cargo run --release -- --db <sti> index .   # oppretter databasen
    # deretter fra kode: ordbank::load(&conn, Path::new("ordbank/nob/fullformsliste.txt"))

Katalogen `ordbank/` er git-ignorert.
