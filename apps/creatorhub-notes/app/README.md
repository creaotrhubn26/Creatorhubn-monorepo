# Notater

Skrivebordsappen over notatene i `~/CreatorHub-notater`. Ett vindu, tre felt:
lista til venstre, teksten til høyre, søket på toppen. Skriving, lagring, søk
og indeksering er markdown på disk, git og SQLite, og forlater aldri maskinen.

Med ett unntak, og det står beskrevet under: [«Hva vi har
forstått»](#hva-vi-har-forstått-og-hvor-teksten-går) sender notatteksten ut av
appen. Den er av til du slår den på.

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

## «Hva vi har forstått», og hvor teksten går

Panelet til høyre leser notatet og sier hva det har forstått. Det gjør den ved
å kjøre `claude`-kommandolinja med avsnittene fra notatet som prompt.

Det betyr, ordrett:

- **Avsnittene forlater appen.** De sendes til `claude`, som sender dem videre
  til Anthropic. Ingen API-nøkkel er involvert — kallet går på Claude
  Code-innloggingen din — men teksten går ut av maskinen.
- **En kopi blir liggende.** `claude` skriver hver samtale til
  `~/.claude/projects/<mappe>/*.jsonl`. Filene blir liggende til noen sletter
  dem. Appen sletter dem ikke, og vet ikke om dem.
- **Prompten går på stdin.** Den sto tidligere i `argv`, og var dermed lesbar
  for enhver prosess på maskinen med `ps` så lenge kallet varte. Det er den
  ikke lenger.

Derfor:

| Bryter | Hva den gjør |
|---|---|
| «Slå på lesning» / «Slå av lesning» i panelet | Om notatene får leses i det hele tatt. **Av som standard.** Svaret ligger i `lesning.txt` ved siden av basen. |
| `privat: ja` i toppfeltet, eller «Aldri les dette notatet» | Dette ene notatet sendes aldri, uansett hva bryteren over står på. |
| «Skjul forståelse» i toppen | Bare visningen. Skjuler spalten, og sier ingenting om hva som sendes. |

Resten av appen bryr seg ikke: er lesningen av, skriver, lagrer og søker du
akkurat som før.

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
