# Notater

Skrivebordsappen over notatene i `~/CreatorHub-notater`. Ett vindu, tre felt:
lista til venstre, teksten til høyre, søket på toppen. Ingen nettverk, ingen
API-nøkkel — alt er markdown på disk, git og SQLite.

Appen er fase 2 i [designet](../../../docs/superpowers/specs/2026-09-09-prosjektminne-notatapp-design.md):
editor og søk. Ankerforslag, entiteter og kodeindeks hører til senere faser og
finnes ikke her.

## Kjøre

```sh
npm install
npm run tauri dev      # utvikling
npm run tauri build    # bygger .app og .dmg i src-tauri/target/release/bundle
```

`npm run dev` alene starter bare nettsiden; alle data kommer fra Tauri-kommandoene,
så vinduet er tomt uten Rust-siden.

## Tastatur

| Tast | Gjør |
|---|---|
| `⌘N` | Nytt notat, med markert overskrift så du kan skrive tittelen med en gang |
| `⌘F` | Til søkefeltet |
| `Esc` | Tømmer søket og setter markøren tilbake i teksten |

Lagring skjer av seg selv ~1 sekund etter at du slutter å skrive, og før du
bytter notat eller søker.

## Hvordan det henger sammen med `notat`

Samme notatmappe (`$CREATORHUB_NOTATER`, ellers `~/CreatorHub-notater`) og samme
indeks (`$CREATORHUB_NOTAT_DB`, ellers
`~/Library/Application Support/creatorhub-notes/notater.db`) som skallverktøyet
[`../notat`](../notat). Appen kaller `creatorhub_notes_indexer` som bibliotek —
`notes-index`-binæren startes aldri.

**Ferskhet.** Indekseren lister filer med `git ls-files -s` og hopper over filer
med uendret blob-hash. Et notat som aldri er lagt til git finnes derfor ikke i
søk. Appen løser det med `git add -A` før hver indeksering: staging gir fersk
blob-hash uten å lage en commit per tastetrykk. `notat sync` committer når du
vil ha et punktum i historikken.

**Sikkerhet.** `read_note` og `write_note` får stien fra frontend. Den
kanoniseres mot notatmappen, og alt utenfor avvises — også via symlenke.

## Test

```sh
cd src-tauri && cargo test
```

Dekker tittelutledning, at stier utenfor notatmappen avvises, filnavn og
frontmatter for nye notater, og at et ustaget notat blir søkbart etter
indeksering.
