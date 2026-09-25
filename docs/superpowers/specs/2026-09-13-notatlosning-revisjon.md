# Full revisjon av notatløsningen — 13. september 2026

Seks parallelle revisjoner, hver på sin akse, med krav om at et funn sier hva
som skjer nå, hva som burde skjedd, hvor i koden det sitter, og hva det koster
brukeren.

| Akse | Funn |
|---|---|
| Skriveopplevelsen | 67 |
| Gjenfinning | 61 |
| Data og tillit | 55 |
| Forståelsespanelet | 50 |
| Grenser og ytelse | 50 |
| Tilgjengelighet | 37 |
| **Sum** | **320** |

Bestillingen var minst 500. Det ble 320, og de er ekte. Å dele funn opp i
varianter for å nå et tall ville tatt fra lista det den nettopp fikk: at hvert
punkt kan handles på.

Rapportene i sin helhet ligger i scratchpad, én per akse.

## Det som gjelder før alt annet

Ti funn ødelegger arbeid brukeren ikke kan få tilbake, eller sier noe usant.
De går først, i denne rekkefølgen.

### 1. Angre krysser notatgrenser og skriver ett notat inn i et annet

`Editor.tsx:250` lager `EditorView` én gang med tom `deps`, så historikken
nullstilles aldri, og hvert notatbytte blir en angrbar transaksjon
(`Editor.tsx:290`). ⌘Z i notat B gir B innholdet fra A. `bytter.current` er
`false` i det øyeblikket, så `onChange` fyrer og A-teksten autolagres til
B-fila.

Appen ødelegger notatet ditt, stille, med din egen hurtigtast.

### 2. Første ⌘Z etter oppstart tømmer notatet

Samme mekanisme. Dokumentet ble byttet fra `""`, så én angring gir tomt
dokument, som skrives til disk 900 ms senere.

### 3. «Dette er en samtale» skriver over alt siden notatet ble åpnet

`byttSamtale` (`App.tsx:328`) leser `uskrevet.current?.content ?? doc`, men
`doc` oppdateres aldri av tasting og `lagre` nullstiller `uskrevet`. Skriv,
autolagre, trykk bryteren — alt siden åpning er borte.

Samme foreldede tekst i `rett` og i panelbryteren.

### 4. En tom lesning utsletter notatets identitet og alle rettelsene

`minne::synk` (`lib.rs:414` → `minne.rs:152`) sletter alle `avsnitt`-rader for
kilden før innsetting. Er teksten tom — avkortet fil, eller panelbryteren
trykket med tom buffer (`App.tsx:493`) — slettes alt, og `foreldede`
(`lib.rs:497`) merker samtlige rettelser utdaterte.

⌘Z gir teksten tilbake. Aldri rettelsene. De er det eneste i systemet brukeren
har skrevet som ikke kan gjenskapes fra markdown.

### 5. Notatteksten ligger i klartekst på maskinen, og dokumentasjonen sier noe annet

`understand.rs:642` sender avsnittsteksten til `claude`-CLI-en **som argv**.
Den er dermed lesbar for enhver prosess via `ps` mens kallet pågår, og den
persisteres til `~/.claude/projects/.../*.jsonl` — 34 slike filer lå på
maskinen da revisjonen ble kjørt.

`app/README.md:4` og `lib.rs:4` sier «ingen nettverk». Det er usant på to
måter: teksten forlater appen, og den blir liggende på disk et sted brukeren
ikke vet om.

Eneste av-bryter er «Skjul forståelse», som er skrevet som en visningsbryter og
står på som standard. Brukeren har aldri samtykket, fordi hun aldri ble spurt.

Fiks: send på stdin i stedet for argv, skriv sant i dokumentasjonen, og gi en
ekte av-bryter som også gjelder per notat.

### 6. Mislykket lagring kaster teksten, og skrivet er ikke atomisk

`App.tsx:213` nuller `uskrevet.current` **før** `await writeNote`, og prøver
aldri igjen. Disk full eller tillatelse borte gir en feilbanner og ingenting å
prøve på nytt med.

`lib.rs:312` bruker `std::fs::write` uten temp-fil og rename, så et krasj midt
i skrivet avkorter fila.

Og: ingen `beforeunload`, `onCloseRequested` eller `blur`, så ⌘Q innenfor
debounce-vinduet mister siste setning.

### 7. `claude` som feiler gir «Ingenting er bestemt ennå»

`kjør` (`understand.rs:642`) sjekker aldri exitkoden og kaster stderr. Uten
innlogging gir kallet `Ok("")`, og panelet skriver at ingenting er bestemt om
et notat fullt av beslutninger.

### 8. En rettelse på `avsnitt_id = 0` er usynlig, uslettbar og evig

Var basen nede ved lesning (`lib.rs:386`), er alle id-er 0. Rettelsen lagres på
id 0 (`rettelser.rs:98`), vises aldri i panelet fordi `aktive()` joiner mot
`avsnitt` — men `eksempler()` (`minne.rs:667`) joiner ikke, så den styrer hver
framtidige prompt for alltid.

### 9. Negasjon i søk er invertert

`quote_fts_query` (`search.rs:77`) siterer hver term, så `-kø` blir `OR "kø"` —
verifisert mot sqlite3: det gir *flere* treff. Sitater virker ikke, og det
finnes ingen AND.

Bivirkning av flerords-fiksen fra en tidligere runde. Siteringen spiste
operatorene.

### 10. Datoen i «Tidligere om dette» er klassifiseringsdatoen, ikke tankens

`minne.rs:275`. En importert tråd eller en gammel fil får dagens dato på hver
linje, så «Du forkastet dette 10. september» kan være en usann påstand om
brukerens egen historikk — sagt med samme sikre stemme som en sann.

Nøyaktig feilmodusen markedsresearchen pekte ut som den som dreper produktet.

## Neste bølger

**Bølge 2 — panelet lyver eller tier.** `begrensning|hold` vises ikke i det
hele tatt, så krav brukeren formulerer forsvinner sporløst, selv om `RESULTAT.md`
avgjorde at de skal bygges inn. En kobling kan ikke avvises. Rettelser
oversettes til noe hun aldri sa og læres opp på. Ett avsnitt uten nett slår av
hele panelet.

**Bølge 3 — gjenfinning på norsk.** Ingen bøyningshåndtering: «utstyret»
finner ikke «utstyr». Norsk Ordbank ligger ferdig og testet i
`indexer/src/ordbank.rs`, ubrukt. Søketreff hopper ikke til treffet selv om
linjenummeret bæres helt fram og kastes i `App.tsx:537`. Slettede notater
etterlater spøkelsesrader.

**Bølge 4 — tilgjengelighet.** Skriveflaten er et navnløst tekstfelt, panelet
oppdateres uten `aria-live`, kontrast 3,18:1 der kravet er 4,5:1, ingen
mediaspørring under 1180px.

**Bølge 5 — skrivehåndverket.** Frontmatteren kan slettes usynlig på fire
måter. Klikk under siste linje mister markøren. Tabeller, oppgavelister og
gjennomstreking finnes ikke. Ingen søk i notatet.

**Bølge 6 — ytelse ved skala.** `minne::tidligere` kjører ett FTS-oppslag per
avsnitt uten grense: 5,3 ms × 5000 = 26 sekunder ren SQL per lagring, med den
globale låsen holdt.

## Rundedrift

Appen er bygget i mange runder av ulike agenter, og det synes:

- tre uavhengige avbruddsmekanismer som til sammen skjuler feil
- toppfeltblokka tolket fem forskjellige steder
- 13 s og 78 s dokumentert i samme fil, uten tidsgrense i frontend
- en doc-kommentar om en API-nøkkel som ikke finnes lenger, og som er grunnen
  til at en feilmelding er formet som «mangler oppsett»
- `IDENTITET.md` sier modulen ikke er koblet inn i appen. Den er det.

## Hva som ble målt, ikke gjettet

Revisjonene målte der de kunne, og rangerte lavt der tallene ikke bar en
påstand:

- 0,3 ms per tastetrykk ved 1000 linjer. Aksen «treg editor» er tynn og ble
  rangert deretter.
- `list_notes` 19 ms og `git add -A` 11 ms ved 1000 notater. Ikke flaskehalsen.
- `minne::lagre` 268 ms for 5000 avsnitt. `synk` 11 ms.
- FTS5-siteringen tåler 12 rare søk uten syntaksfeil — den er trygg, bare
  semantisk gal.
- Verken `remove_diacritics 0` eller `1` folder æ eller ø. Bare å→a.
  Kommentaren i `db.rs:48` er faktafeil.
