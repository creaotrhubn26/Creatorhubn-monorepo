# Prosjektminne — Tauri-notatapp med repo-forankret kontekst

Dato: 2026-09-09
Status: Design godkjent, klar for implementeringsplan

## Problem

Notater om CreatorHub mister kontekst. Et notat som «forbedre utstyrs-tab» er
verdiløst tre uker senere fordi konteksten — hvilken kode, hvilken PR, hva som
ble forsøkt sist, hva som ble forkastet og hvorfor — ikke ligger i notatet.

To symptomer, samme rot:

1. Ting gjenfinnes ikke. Søk krever at du husker ordene du brukte.
2. Notater om funksjoner og pipelines er for tynne til å handles på senere.

Word og Notion kan ikke løse dette. Ingen av dem vet hva CreatorHub er, hvilken
kode som finnes, eller hva som ble bestemt i august.

## Løsning

En Tauri-app som indekserer monorepoet og din egen historikk, og som ved
lagring gjenkjenner hva et notat handler om og hekter konteksten på automatisk.

Tre lag:

- **Notater** — markdown på disk, i git. Sannheten.
- **Entiteter** — funksjoner, pipelines, filer, PR-er, beslutninger. Avledet,
  ikke vedlikeholdt for hånd.
- **Ankre** — koblingen mellom notat og entitet. Foreslås av appen, bekreftes
  eller ignoreres av brukeren.

### Flyt ved lagring av notat

1. Notatet skrives til disk umiddelbart. Dette blokkerer aldri på nettverk.
2. Asynkront: Claude klassifiserer notatet (type, emne, om det er en beslutning
   eller en åpen tanke) og trekker ut entitetsnavn.
3. Vektorsøk mot kodeindeks, git-historikk og claude-mem finner kandidat-ankre.
4. Forslag vises i margfeltet. Brukeren bekrefter eller ignorerer. Ignorerte
   forslag beholdes som svake koblinger.

Ved gjenåpning viser notatet relatert kode, tidligere notater om samme emne,
hva som ble bestemt, og hva som ble forkastet.

## Datamodell

Markdown er sannheten. SQLite er en index som alltid kan gjenbygges fra filer
og git. Slettes indeksen, mistes ingenting.

> **Rettet 12. september 2026.** Det som sto her beskrev en entitets- og
> ankergraf — `notes`, `entities`, `anchors`, `edges` — som aldri ble noe annet
> enn et tomt skjema. Ingen kode leste eller skrev dem på noe tidspunkt.
> Tabellene er slettet, og det som står under er det som faktisk finnes.
> Grafen finnes også, men bygget av data vi har: `forstatt` er entitetene,
> `relasjoner` er kantene.

```
note.md    frontmatter: id, created, type, status
           brødtekst: ren markdown, ingen proprietær syntaks

sqlite, indeksen (indexer/src/db.rs):
  meta        key, value                       sist indekserte commit
  chunks      source, path, start_line, end_line, text
  chunk_fts   fulltekst over chunks.text       (fts5, ekstern-innhold)
  chunk_vec   embedding(vec[1024])             ubrukt i appen, brukt av kodeindeksen
  path_state  path, blob_sha                   inkrementell indeksering

sqlite, appen (app/src-tauri/src/{minne,rettelser}.rs):
  avsnitt      id, kilde, rekkefolge, avsender, innhold_hash, tekst
  forstatt     avsnitt_id, tittel, tekst, type, handling, kortform, venter, tidspunkt
  forstatt_fts fulltekst over kortform + tekst  (fts5, ekstern-innhold)
  rettelser    avsnitt_id, sti, tekst, lest_*, plass, kortform, tidspunkt, foreldet
  relasjoner   avsnitt_id, annen_id, forhold, tidspunkt
```

**`avsnitt.id` er identiteten.** Den tildeles én gang og gjenfinnes ved likhet
neste gang kilden leses, så den overlever at brukeren retter en skrivefeil.
`innhold_hash` er cache-nøkkelen — «har jeg klassifisert denne teksten før» —
og ikke identitet. Begrunnelsen står i
`2026-09-12-notatlosning-arkitektur.md`, målingen i
`klassifiseringstest/IDENTITET.md`.

Én `chunks`-tabell for både notater og kode gir ett felles vektorrom. Derfor kan
et notat finne en PR fra august, og en fil finne notatet som handler om den.

En beslutning er ikke egen tabell: den er et avsnitt `forstatt` har lest som
`beslutning`. «Vi forkastet X fordi Y» blir søkbart gjennom `relasjoner`, der
`motsier` er kanten som bærer det.

## Plassering

```
~/CreatorHub-notater/                          markdown, eget git-repo
~/Library/Application Support/creatorhub-notes/index.db
```

Notatene ligger i eget repo, ikke i monorepoet. De skal kunne handle om flere
repos, og de skal ikke skitne til diffen.

## Arkitektur

Fire enheter med hver sin jobb:

| Enhet | Ansvar |
|---|---|
| `indexer` (Rust) | `git ls-files -s` → chunk → Voyage → sqlite. Inkrementelt på blob-hash per fil. Overvåker notatmappen med `notify`. |
| `brain` (Rust) | Ved lagring: Claude-klassifisering, vektorsøk etter kandidat-ankre, skriver forslag til sqlite. |
| `app` (React) | Editor, søk, margfelt med ankerforslag, entitetsside. |
| `mcp` (egen binær) | Leser samme sqlite skrivebeskyttet, eksponerer verktøy til Claude Code. |

MCP-serveren er et separat program, ikke en del av appen. Claude Code må kunne
starte den selv, og den må virke når appen er lukket. Eneste kobling er
sqlite-filen, åpnet skrivebeskyttet.

### Stack

Samme oppsett som `apps/creatorhub-protools-companion`: Tauri 2, React 19 med
MUI, Vite, `notify` for filovervåking, `reqwest` og `tokio` i Rust.

Nye avhengigheter, kun disse: `rusqlite` med `sqlite-vec` for vektorsøk, og
CodeMirror 6 for markdown-redigering.

### Modeller

- Embeddings: Voyage AI. `voyage-code-3` for kode, `voyage-3` for notater.
  Anthropic tilbyr ikke embeddings-API.
- Klassifisering og spec-generering: Claude.

### Skala og kostnad

Målt mot origin/main gjennom filtrene indekseren faktisk bruker: 8 023
indekserbare filer og 3 180 395 linjer kode. Ved 40-linjers biter med 10
linjers overlapp gir det 107 386 vektorer. Kjør `notes-index index --dry-run`
for tallet som gjelder akkurat nå; det koster ingenting.

Engangs-embedding er 41-50 millioner tokener, altså 7-9 dollar med
voyage-code-3 til $0,18 per million. `--dry-run` anslår høyere, fordi
token-estimatet bevisst overdriver — en for stor pakke blir avvist, mens en for
liten bare koster én forespørsel ekstra. Deretter kun endrede filer.

`.tsx` og `.ts` står for 86 % av regninga. Vil du ned i pris, er det der spaken
er.

Indeksfila blir omtrent 650 MB. 107 386 vektorer à 1024 float32 er 440 MB, og
bitteksten kommer i tillegg.

sqlite-vec gjør et fullt lineært skann av de 440 MB per spørring, altså
100-400 ms. Det er raskt nok for en enkeltbruker som skriver et notat, så
ingen HNSW og ingen ekstern vektordatabase er nødvendig.

### Chunking

40-linjers vinduer med 10 linjers overlapp. Hver bit prefikses med filsti og
nærmeste funksjonsnavn funnet ved regex.

Kjent begrensning: en bit kan kutte midt i en funksjon. Med filsti og
funksjonsnavn i teksten treffer semantisk søk likevel riktig område, som er alt
som trengs for å ankre et notat. Tree-sitter er oppgraderingen dersom
gullsettet viser at grensene bommer — ikke før.

### Kilder i indeksen

Fire, alle merket med `entity.kind`:

- Kode fra monorepoet, via `git ls-files`
- Git-historikk: commit-meldinger og PR-tekst via `gh pr list --json`
- claude-mem-observasjonene som allerede finnes
- Notatene selv

### Inkrementell oppdatering

Hver indeksert fil får blob-hashen sin lagret i `path_state`. En kjøring lister
`git ls-files -s`, sammenligner hashene, og reindekserer kun filer som avviker
eller mangler. Filer som er borte fra lista får radene sine slettet.

Ingen lagret HEAD-SHA, ingen diff mot forrige commit. Det var det opprinnelige
designet, og det ble forkastet av to grunner: en lagret SHA som blir uoppnåelig
etter rebase, force-push eller gc låser indeksen permanent, og en SHA sier
ingenting om hvor langt en avbrutt kjøring kom.

Arbeidet gjøres i pakker som hver får plass i én Voyage-forespørsel. Per pakke:
embed først, så én transaksjon som sletter, setter inn og oppdaterer
`path_state`, og committer. Nettverket ligger utenfor transaksjonen. En kjøring
som feiler midtveis beholder hver committet pakke, og neste kjøring finner kun
det som fortsatt mangler — det som allerede er betalt for, betales ikke om
igjen.

## MCP-verktøy

| Verktøy | Ansvar |
|---|---|
| `notes_search(query)` | Semantisk søk i notatene |
| `notes_context(path\|entity)` | Alt ankret til filen eller entiteten: notater, beslutninger, forkastede forsøk |
| `notes_decisions(topic)` | Beslutningslogg med begrunnelser |
| `notes_append(text)` | Lar agenten skrive tilbake, for eksempel «forkastet Y fordi Z» |

`notes_append` er avgjørende. Uten den lekker kontekst ut av systemet hver gang
det kodes med Claude Code.

## Feilhåndtering

Skriving blokkerer aldri på nettverk. Notatet lagres til disk først; all
AI-behandling er asynkron og valgfri.

- Voyage utilgjengelig: legg i kø, vis diskré banner, indeksen blir ferskere
  senere.
- Klassifisering feiler: notatet forblir uklassifisert og kan behandles på nytt.
- Korrupt sqlite: slett filen og gjenbygg fra markdown og git.
- Ankerforslag under confidence-terskel vises ikke.

## Testing

Ett gullsett med 20 håndskrevne spørsmål og forventet treff. Kjøres hver gang
chunking eller embedding-modell endres. Dette er den eneste testen som måler om
produktet virker.

I tillegg Rust-enhetstester på chunker-grenser, på blob-hash-basert
inkrementalitet, og på at en embedder som feiler eller returnerer for få
vektorer lar databasen stå urørt. Ingen E2E-rammeverk i fase 1.

## Faser

1. Indeks og søk, uten UI. Rust-indekser, sqlite-vec, CLI-søk. Gullsettet må
   passere før det bygges noe skall rundt.
2. App: editor, søk, margfelt med ankerforslag.
3. MCP-binær.
4. Språkverifisering og stilprofil.
5. Spec-generering og entitetsside.

## Bevisst utelatt

- Blokk-editor à la Notion. Måneder med arbeid, løser ikke problemet.
- Sanntidssamarbeid, mobilklient, plugin-system.
- Tree-sitter-basert chunking. Legges til når gullsettet krever det.
- Vektordatabase-tjeneste. 107 386 vektorer trenger ikke en.
- Egen grammatikkmotor for norsk.
- Finjustering av egen språkmodell.
- Oxford Dictionaries enterprise-lisens.

## Språk og skrivekvalitet

Notater skrives på norsk og engelsk om hverandre. Språk detekteres per avsnitt med
`whatlang`, ikke per fil.

### Prinsipp

Ingen egen grammatikkmotor bygges. Claude foreslår rettelsen, en autoritativ
ordbok verifiserer den:

```
avsnitt → språkdeteksjon
        → Claude foreslår rettelse med begrunnelse
        → hver foreslått norsk ordform slås opp i Norsk Ordbank lokalt
        → form som ikke finnes i ordbanken: forslaget forkastes stille
        → diff i margfeltet, brukeren godtar eller avviser
```

Verifiseringssteget fjerner den ene farlige feilklassen: at modellen finner på
en norsk bøyning som ikke finnes. Språkrådets skriveregler legges inn som
stilregler i prompten, ikke som kode.

Rettelser brukes aldri automatisk, og kjøres aldri mens brukeren skriver — kun
ved pause eller lagring.

### Kilder

Alle er gratis og åpne. Språkdelen koster ingenting å drifte.

Norsk:

| Kilde | Innhold | Lisens |
|---|---|---|
| Norsk Ordbank | 154 824 lemmaer med ordklasse og bøyningsmønstre, lastes ned og kjøres lokalt | CC-BY 4.0 |
| ordbokene.no API (`v1.ordbokene.no/api`) | Definisjoner og bruk fra Bokmålsordboka og Nynorskordboka | Åpen |
| Språkrådets ordlister via Språkbanken | Supplerende ordlister | Åpen |

Norsk Ordbank er hovedkilden fordi den er lokal: verifisering av hver foreslåtte
ordform tar mikrosekunder, virker offline og har ingen rate-limit.

Engelsk:

| Kilde | Innhold | Merknad |
|---|---|---|
| dictionaryapi.dev | Definisjoner og uttale, ingen API-nøkkel | Primærkilde |
| Kaikki.org | Hele engelske Wiktionary maskinlesbart | Offline-fallback |
| Datamuse | Synonymer og ordrelasjoner fra WordNet og Wiktionary | Krever API-nøkkel fra 1. januar 2027, 100 000 kall per dag. Merkes i klientkoden. |
| WordNet | Semantiske relasjoner, helt lokalt | Valgfritt |

Oxford Dictionaries API er vurdert og forkastet: kommersiell bruk krever
enterprise-lisens fra £5 000 per år per språk, uten nytte utover de frie
kildene. Sandkassekontoen leverer emulerte data, ikke ekte oppslag.

Self-hostet LanguageTool (LGPL) kan legges til senere som et ekstra signal på
engelsk. Norsk regeldekning er svak, så den skal aldri være fasit.

## Læring

Tre mekanismer. Kun den første er ekte modelltrening.

### 1. Ankerrangering

Hvert bekreftet eller avvist ankerforslag er et merket eksempel. En logistisk
regresjon trenes lokalt på trekkene:

- cosine-likhet mellom notat og entitet
- overlapp i filsti
- ferskhet på entiteten
- direkte navnematch
- om notat og entitet har vært ankret sammen tidligere

Modellen er liten nok til å trenes på nytt ved hver bekreftelse. Under omtrent
50 eksempler brukes ren cosine-likhet.

Dette er det ene stedet der trent ML slår en språkmodell, fordi den lærer
brukerens egen oppfatning av hva som hører sammen.

### 2. Stilprofil

Månedlig leser Claude notatsamlingen og skriver en kompakt profil til
`stil.md`: hvordan brukeren strukturerer et forbedringsnotat, hvilke termer som
går igjen, når det byttes til engelsk. Filen er lesbar og redigerbar for
brukeren, og brukes som systemprompt ved forslag og spec-generering.

Finjustering av egen modell er vurdert og forkastet. Noen hundre notater er
langt under det som kreves, og stilprofil kombinert med henting av egne
eksempler gir bedre resultat uten trening.

### 3. Prosjektglossar og maler

Glossaret utledes av notatene: skriver brukeren «utstyrs-tab» skal appen ikke
foreslå «equipment tab». Norske fagtermer kan valideres mot Termportalen.

Maler konfigureres ikke. Appen utleder mønsteret i brukerens egne
forbedringsnotater — symptom, hvor i koden, forslag, risiko — og foreslår de
feltene ved neste notat av samme type.

Ved generering hentes de tre mest relevante tidligere notatene av samme type og
brukes som eksempler i prompten. Stiloverføring gjennom henting, ikke trening.
