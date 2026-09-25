# Arkitektur — notatløsningen, fase 2 og framover

Dato: 2026-09-12
Grunnlag: kartlegging av repoet slik det står, ikke et tenkt grønnfelt.
Bygger på `2026-09-09-prosjektminne-notatapp-design.md`, og retter tre ting i den.

## Hva som faktisk finnes

| Modul | Ansvar | Brukes av appen |
|---|---|---|
| `indexer/` | git-blob-diffet indeksering, FTS5-søk, Voyage-embedding | kun `db::open`, `index::run_no_embed`, `search::text` |
| `app/src-tauri/lib.rs` | Tauri-kommandoer, notatfiler på disk | — |
| `app/src-tauri/understand.rs` | klassifisering via `claude`-CLI | — |
| `app/src-tauri/rettelser.rs` | brukerens rettelser | — |
| `app/src/` | React: liste, editor, panel | — |

Tabeller i bruk: `chunks`, `path_state`, `chunk_fts`, `rettelser`.

**Tabeller definert og aldri brukt: `notes`, `entities`, `anchors`, `edges`.**
Bekreftet ved gjennomgang — ingen kode leser eller skriver dem. `chunk_vec`
er bevist funksjonell i test, men appen kaller aldri `search::query`, så den er
reelt ubrukt.

Det er verdt å si rett ut: den opprinnelige spec-en beskriver en entitets- og
ankergraf som bærende for ankerforslag, brett og kryssnotat-minne. Den grafen
har aldri eksistert som annet enn et skjema. Planene vi har lagt oppå den har
hvilt på noe som ikke var der.

## Tre feil i grunnmuren

Rekkefølgen er ikke tilfeldig — den første blokkerer de to neste.

### 1. Avsnittets identitet er selve teksten

`Paragraph.hash` er FNV-1a av avsnittsteksten, og brukes som primærnøkkel i
`forstatt`, `rettelser` og `relasjoner` samtidig.

Det gir tre problemer:

- **Kollisjon på tvers.** Skriver brukeren «Kartvisning» i to notater, er det
  samme rad. Kryssnotat-minne kan ikke se en forskjell som ikke finnes i
  nøkkelen.
- **Avsender er umulig.** Samtaleimport krever at «Marius mener vi bør bruke
  Stripe» og samme setning fra en annen er ulike ting. I dag er de identiske.
- **Ingen gradvis migrering.** Endres identitetsbegrepet, må tre tabeller endres
  i samme slag. En surrogatnøkkel ville tålt det.

**Fiks:** skill identitet fra innhold.

```
avsnitt
  id             integer primary key      -- identitet
  kilde          text not null            -- notatsti, eller samtale-id
  rekkefolge     integer not null         -- posisjon i kilden
  avsender       text                     -- null for egne notater
  innhold_hash   text not null            -- indeksert, ikke nøkkel
  tekst          text not null
  unique(kilde, rekkefolge)
```

`innhold_hash` beholder sin ekte jobb: å svare på «har jeg klassifisert denne
teksten før», altså cache. Den slutter å være identitet.

`forstatt`, `rettelser` og `relasjoner` peker på `avsnitt.id`.

Kostnaden er én migrering nå. Prisen for å utsette er at den samme migreringen
må gjøres senere, med data i tre tabeller i stedet for én.

### 2. Klassifiseringen skalerer ikke til en samtale

`understand()` sender alle ukjente avsnitt i ett kall, med 120 sekunders
grense. For et notat med ti avsnitt er det riktig. Et møtetranskript med tre
hundre innlegg vil enten time ut eller sende en prompt en rask modell ikke er
valgt for.

**Fiks:** samme mønster som indekseren allerede bruker etter sluttreviewen —
pakker, og skriv resultatet per pakke.

```
klassifiser(avsnitt[]) →
  del i pakker etter anslått tokenbudsjett
  for hver pakke:
     ett kall
     skriv resultatene              ← delresultat overlever en feil senere
  aldri hele kilden i ett kall
```

To ting følger:

- **Synlig først.** Ved import klassifiseres det brukeren ser, før resten. Hun
  skal ikke vente på innlegg 280 for å se innlegg 3.
- **Delvis resultat er gyldig.** Feiler pakke fire, står pakke én til tre. Det
  er samme prinsipp som gjorde indekseringen gjenopptakbar.

### 3. To standard-databasestier

`indexer/src/cli.rs` og `app/src-tauri/lib.rs` har hver sin standardsti. Det går
bra i dag fordi `notat`-skriptet overstyrer eksplisitt. Enhver ny bruk uten
`--db` skriver stille til feil fil.

**Fiks:** én modul eier stioppslag, med et eksplisitt argument for hvilket
lager det gjelder — kodeindeksen og notatlageret er to ulike baser, og det er
riktig. Det som er galt er at de utledes to steder.

## Målbildet

### Kryssnotat-minne

```
nytt avsnitt
   → FTS5 over tidligere kortformer og avsnittstekst      (gratis, lokalt)
   → kandidater?  nei → ferdig
                  ja  → ett kall: motsier | bekrefter | besvarer | urelatert
   → vis kun de tre første, `motsier` øverst
```

Billig først, modell bare når det finnes noe å vurdere. `urelatert` skal være
det vanligste svaret; FTS finner ordoverlapp, ikke mening.

Dette er grafen spec-en beskrev, men bygget av data som faktisk finnes.
`forstatt` er entitetene. `relasjoner` er kantene. **`entities`, `anchors` og
`edges` slettes** — de er et skjema tegnet før vi visste hvordan dataene ville
se ut, og å la dem stå er en felle for neste leser.

### Samtaleimport

Hviler helt på fiks 1 og 2. Med dem er den liten:

- en kilde er en samtale i stedet for en fil
- et avsnitt har en avsender
- `gjengivelse` i taksonomien bærer allerede «refererer hva en annen mener», og
  den er målt

Uten dem er den umulig, uansett hvor mye UI som bygges.

**Bygget 13. september 2026** (`app/src-tauri/src/samtale.rs`), og den ble
liten, som grunnmuren var ment å gjøre den. Ingen ny kilde-type: en importert
samtale er en fil i notatmappa, ett avsnitt per innlegg, skrevet som
`Marius (10:32): det han sa`. Da deler `understand::split` den uten å vite noe
om samtaler, hashen skiller to avsendere som sier det samme, og
`avsnitt.avsender` — kolonnen som sto ubrukt — er det eneste nye som lagres.

Gjenkjenningen er regelbasert og kjører på innliming. Tre former dekkes:
`Navn: tekst`, Slacks eksportform, og møtetranskript med tidsstempel. Tre krav
må holde samtidig — minst tre innlegg, minst to avsendere der én tar ordet
igjen, og at nesten hele teksten er innlegg — pluss en stoppordliste som holder
«Konklusjon:» og e-posthodet «Fra:» utenfor. Kjenner den ikke igjen noe, er
teksten et vanlig notat; det er den viktige feilretningen. Brukeren kan
overstyre begge veier, og valget står som `kilde:` i toppfeltet.

Prompten får vite at kilden er en samtale. Målt to kjøringer hver vei: ingen
forskjell i type. Den står som forsikring mot at oppførselen driver, ikke som
en fiks. Den sier bevisst *ikke* at et innlegg fra en annen er `gjengivelse` —
det ville tømt beslutningsloggen. `gjengivelse` er for innlegg som refererer en
tredjepart; hvem som sa det bærer `avsender`.

### Strukturert spørring

`forstatt` har type, handling, kortform, avhengighet og tid. Det er nok til å
svare på «hva er uavklart», «hva venter på noe», «hva har jeg bestemt om X»
uten at brukeren har bygget en database.

Enkle mønstre over vanlige ord, ikke et spørrespråk. Fritekstsøket vises alltid
umiddelbart og skal aldri bli dårligere av at mønstergjenkjenningen bommer.

## Rekkefølge

1. Avsnittsidentitet — blokkerer alt annet
2. Pakkevis klassifisering — blokkerer import
3. Slett den døde grafen, oppdater spec-en
4. Én stimodul
5. Samtaleimport

1 til 4 er opprydding og bør gjøres i én runde. 5 er ny funksjonalitet.

## Testing

Den etablerte disiplinen står: mål før du tror på det.

- Migreringen: eksisterende rettelser og forståelse overlever, knyttet til
  riktig avsnitt.
- Pakkedelingen: en kilde med 300 avsnitt klassifiseres uten timeout, og en
  feil i midten beholder det som er gjort.
- Relasjonene: falsk koblingsrate, med `urelatert` sterkt representert i
  fasiten.
- Import: samme setning fra to avsendere er to avsnitt, ikke ett.

## Risiko

**Migreringen er det farligste steget.** Den rører tre tabeller med brukerens
rettelser i seg — det eneste i systemet som er skrevet av henne og ikke kan
gjenskapes. Ta sikkerhetskopi av basen før, og la migreringen kunne kjøres på
nytt uten å duplisere.

Alt annet kan gjenbygges fra markdown-filene, som fortsatt er sannheten.

---

# Tillegg etter markedsresearch, 12. september

En undersøkelse av arkitektoniske smertepunkter i Notion, Slack, Word, OneNote,
Milanote, Obsidian, Roam, Confluence, Evernote og Apple Notes landet uavhengig
på samme førsteprioritet som kodegjennomgangen: **avsnittsidentitet**. To
analyser som ikke kjente til hverandre, samme svar.

Men den skjerper problemet på tre måter dokumentet over bommet på.

## 1. Identiteten må overleve redigering, ikke bare bære en avsender

Over er hash-som-nøkkel behandlet som noe som blokkerer *ny* funksjonalitet.
Det er verre enn det: det bryter et løfte vi allerede har gitt.

Brukeren retter en linje i panelet. Så retter hun en skrivefeil i avsnittet.
Rettelsen forsvinner, fordi teksten er identiteten. Vi har dokumentert det som
tilsiktet, men det er det ikke — det er datamodellen som lekker ut i
opplevelsen. Researchen sier det skarpere enn jeg gjorde: *Words datamodell med
Notions ambisjon.*

`(kilde, rekkefolge)` løser det ikke alene. Setter hun inn et avsnitt over,
forskyves alle numre under.

**Identitet tildeles én gang og gjenfinnes ved likhet.** Ved ny lesning av en
kilde matches avsnitt mot eksisterende rader — uendret tekst treffer på hash,
små endringer treffer på likhet og beholder id-en, nye avsnitt får ny id.
Rettelsen overlever at du retter en skrivefeil, som er hele poenget med den.

Dette er det samme problemet AnchoredAI beskriver, og som Daniel selv pekte på
i konseptnotatet: koblinger må håndteres når dokumentet redigeres.

## 2. Presisjon foran dekning — og grunnen er ikke smak

Roam-brukere sluttet å tro på grafen fordi den var stille. Kilde, Every:
«I am not really going back through all of these notes.»

Vår feilmodus er motsatt og verre: systemet tar feil høyt. En stille graf blir
ignorert gradvis. Et system som selvsikkert sier «du forkastet dette i
september» om noe du aldri forkastet, mister tilliten på én visning, og den
kommer ikke tilbake.

Det gjør `urelatert` til den viktigste utgangen i relasjonsmålingen, ikke en
detalj. **Vis færre koblinger, sikrere.** En manglende kobling koster en tapt
mulighet. En falsk kobling koster produktet.

## 3. Svar må vise hva de bygger på

«Hva er uavklart» gir et autoritativt svar over et korpus som er systematisk
ufullstendig — ingen mobil, ingen import fra andre verktøy, bare det som er
skrevet i denne appen. Brukeren kan ikke se hullene.

Det er samme felle som Confluence: svaret ser komplett ut fordi grensesnittet
ikke sier noe annet.

**Strukturerte svar skal bære sitt eget grunnlag.** «3 uavklarte, av 41 avsnitt
i 6 notater» er sant på en måte «3 uavklarte» ikke er.

## Hva vi har løst, og hva vi bare har flyttet

Løst, uten forbehold: formatlåsing (markdown på disk), offline, kravet om å
bygge skjemaet før du kan spørre, og søk begrenset til det nylige.

Flyttet, ikke løst:

- **Eksportproblemet er invertert.** Teksten er portabel; forståelsen ligger i
  SQLite. Går appen bort, står notatene igjen — men uten det systemet forstod.
- **Manuell strukturering er flyttet, ikke fjernet.** Obsidian krever at du
  tagger før. Vi krever at du retter etter. Mindre arbeid, men ikke null.
- **Plugin-råte er byttet mot modellråte.** Obsidian-oppsett ryker når en
  plugin dør. Vårt ryker stille når en modell endrer seg og gamle avsnitt
  begynner å bety noe annet. Det er vanskeligere å oppdage.

Den tredje er den jeg ikke har noe svar på ennå. Den hører hjemme i en senere
runde, men den skal ikke glemmes fordi den er ubehagelig.

## Rekkefølgen står, med én endring

Punkt 1 utvides: identitet skal ikke bare bære avsender, den skal overleve
redigering. Det er samme migrering, men matchingen ved gjenlesing må bygges
samtidig — ellers løser vi halve problemet og tror vi er ferdige.
