# notes-index

Semantisk indeks over CreatorHub-monorepoet. Fase 1 av prosjektminne-appen.
Design: `docs/superpowers/specs/2026-09-09-prosjektminne-notatapp-design.md`

## Bruk

    export VOYAGE_API_KEY=...
    cargo run --release -- index /Users/danielqazi/Creatorhubn-monorepo
    cargo run --release -- search "hvor beregnes prisingen for lead map"
    cargo run --release -- eval --file gullsett.toml --k 5

Første indeksering tar noen minutter og koster omtrent én dollar i
Voyage-forbruk. Senere kjøringer er inkrementelle og leser kun filer endret
siden forrige indekserte commit.

## Norsk Ordbank

Brukes fra og med språkfasen, lastes allerede nå. Last ned Bokmål-utgaven fra
Språkbanken (CC-BY 4.0) og pakk den ut, så:

    cargo run --release -- --db <sti> index .   # oppretter databasen
    # deretter fra kode: ordbank::load(&conn, Path::new("ordbank/nob/fullformsliste.txt"))

Katalogen `ordbank/` er git-ignorert.
