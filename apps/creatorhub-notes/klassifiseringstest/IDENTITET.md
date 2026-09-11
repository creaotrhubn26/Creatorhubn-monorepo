# Avsnittsidentitet som overlever redigering, 12. september 2026

Koden: `indexer/src/identitet.rs`. Datasettet og sveipet:
`indexer/tests/identitet_datasett.rs`.

I dag er et avsnitts identitet FNV-1a-hashen av teksten. Retter brukeren en
skrivefeil, er det et nytt avsnitt, og rettelsen hun gjorde i panelet
forsvinner. Denne modulen svarer på det ene spørsmålet som må besvares før
identitet kan tildeles én gang: **gitt avsnittene vi kjente til i en kilde, og
avsnittene som står der nå, hvilke er de samme?**

## Algoritmen

Billig først.

1. **Eksakt treff på tekst → `Samme`.** Gratis, og dekker det vanligste
   tilfellet: ett avsnitt redigeres, resten står. Er teksten lik flere steder,
   tas den kjente som står nærmest i rekkefølgen, med lavest id som
   avgjørelse ved likt — derfor er svaret det samme hver kjøring.
2. **Resten: tekstlikhet over en terskel → `Endret`.** Alle gjenværende par
   over terskelen sorteres synkende og tildeles grådig. Under terskelen →
   `Nytt`.

Posisjon teller, men svakt: den legges til som `0,03 / (1 + avstand)` og brukes
bare til å rangere mellom kandidater som allerede er over terskelen. Den kan
aldri løfte et par over terskelen, og kan derfor ikke overstyre tekstlikhet.
Det er det som gjør at et flyttet avsnitt (krav 6) beholder id-en sin.

## Likhetsmålet: Jaccard over tegn-trigram

`|A ∩ B| / |A ∪ B|` over mengden av tegn-trigram, etter at teksten er gjort om
til små bokstaver og blanktegn er normalisert.

**Hvorfor tegn og ikke ord.** En skrivefeil ødelegger hele ordet, men bare tre
trigram. Målt på «Kjøp nytt batteri» → «Kjøp nyt batteri»:

| | trigram | ord |
|---|---|---|
| kort avsnitt, én skrivefeil | **0,81** | 0,50 |
| omskrevet, felles ord («Prisen … tolv tusen kroner») | **0,18** | 0,22 |

Ordbasert Jaccard er dårligere i *begge* retninger samtidig: den ser mindre
likhet der det er samme avsnitt, og mer likhet der det ikke er det. Vinduet
mellom de to feilene blir smalere, altså er terskelen vanskeligere å plassere.
Det avgjorde valget. Målingen står som test
(`ordbasert_jaccard_taper_på_korte_avsnitt`), ikke som påstand.

**Hvorfor Jaccard og ikke overlapp** (`|A ∩ B| / min`): overlapp gir 1,0 når
den ene teksten er en delmengde av den andre, så et kort omskrevet avsnitt
ville arvet id-en til et langt. Jaccards nevner straffer at tekstene er ulike i
størrelse, og det er nettopp den straffen krav 10 trenger.

**Delt avsnitt (krav 8): den største delen arver.** Det følger av regelen
«beste likhet vinner» — ingen egen regel. Begrunnelsen er at den delen som
bærer mest av den opprinnelige teksten er den brukerens rettelse mest
sannsynlig hørte til. Deles et avsnitt i to nøyaktig like store deler, avgjør
sorteringens tiebreak (lavest ny indeks, så lavest kjent indeks). Det er
deterministisk, men vilkårlig, og det er en ærlig svakhet.

**Slått sammen (krav 9)** faller ut av samme regel: den av de to gamle som
bidrar med mest tekst har høyest Jaccard mot resultatet og arver id-en. Den
andre forsvinner.

## Terskelen er målt, ikke gjettet

34 par av før-tekst og etter-tekst, alle ti kravene dekket, sju av parene
skrevet om nok til at fasiten er `Nytt` selv om ord overlapper.

To feiltyper telles:

- **falsk arv** — et fremmed avsnitt arver en id, eller arver *feil* id.
  Brukerens rettelse havner et annet sted enn der hun skrev den. Dette er den
  dyre feilen.
- **tapt id** — et kjent avsnitt blir `Nytt`. Rettelsen forsvinner. Dette er
  dagens oppførsel, altså ikke en forverring.

| terskel | falsk arv | tapt id |
|---|---|---|
| 0,04 | 11 | 0 |
| 0,06 | 8 | 0 |
| 0,08–0,10 | 5 | 0 |
| 0,12–0,14 | 3 | 0 |
| 0,16–0,18 | 1 | 0 |
| **0,20–0,52** | **0** | **0** |
| 0,54 | 0 | 1 |
| 0,56–0,66 | 0 | 2 |
| 0,70 | 0 | 4 |
| 0,80 | 0 | 8 |
| 0,90 | 0 | 12 |

**Hvor det brekker, konkret.**

Siste falske arv forsvinner mellom 0,18 og 0,20, og den siste som står er
«samme tall og prisformulering, annet kjøp»: *«Prisen for pakke to er tolv
tusen kroner eksklusiv moms, med to runder retting»* mot *«Prisen på ny
mikrofon er tolv tusen kroner, og den bør kjøpes brukt hvis mulig»*. To ulike
ting som deler en tallformulering. Det er den feilen som gjør vondt, og den er
grunnen til at terskelen ikke kan settes lavt «for sikkerhets skyld».

Første tapte id kommer ved 0,54: «avsnittet doblet i lengde» — brukeren skriver
en setning til, som er like lang som avsnittet var. Over 0,70 begynner de delte
og sammenslåtte avsnittene å falle, og over 0,86 faller avsnitt med to
skrivefeil i.

**Valgt terskel: 0,36**, midt i det rene vinduet [0,20 – 0,52]. Begge
feiltypene er null i hele vinduet, så den nøyaktige verdien bærer ingen
beslutning alene — poenget med midten er å ha margin mot begge kanter når ekte
tekst er rotere enn datasettet. Marginen er 0,16 ned til falsk arv og 0,18 opp
til tapt id.

## Ytelse

Skal kjøre ved hver lagring, lokalt, uten modellkall.

| | tid |
|---|---|
| 300 avsnitt, ett redigert (lagring) | 190 µs |
| 300 avsnitt, alt skrevet om (import) | 84 ms |
| 50 avsnitt, ett redigert | 14 µs |

Steg 2 er O(n·m). Første utkast bygde trigram-mengdene på nytt for hvert par og
brukte 458 ms på 300 avsnitt. Å bygge dem én gang per avsnitt, og å hoppe over
par der lengdeforholdet alene gjør Jaccard umulig over terskelen, tok det ned
til 84 ms. Eksakt treff i steg 1 gjør at den vanlige veien aldri møter
kvadraten. Blir import av store transkripter tregt, er neste steg å indeksere
trigrammene i stedet for å pare alle mot alle — ikke gjort nå, fordi 84 ms ved
import ikke merkes.

## Hva som ikke virket

- **Ordbasert Jaccard** — forkastet på måling, ikke smak. Tallene står over.
- **Å bygge trigram inne i parløkka** — riktig svar, 5× for treg. Målt og
  rettet før commit, ikke oppdaget senere.
- **Første terskelgjetning var 0,34.** Den var ikke gal, men den var gjettet.
  Sveipet flyttet den til midten av det målte vinduet. Forskjellen er null
  feil begge steder — det er nettopp derfor gjetningen ikke kunne forsvares
  uten sveipet.

## Hva målingen ikke viser

1. **34 par er få, og de er syntetiske.** Samme person skrev algoritmen og
   fasiten. Felles blindsoner er mulige — samme forbehold som `RESULTAT.md`
   tok, og det er ikke svakere her.
2. **Ingen av parene er ekte redigeringshistorikk.** Neste runde bør ta før- og
   etter-versjoner fra Daniels egne notatfiler, der endringene er rotete og
   gjort av en som ikke visste at de skulle måles.
3. **Bare norsk.** Trigram over tegn er språkuavhengig i prinsippet, men
   terskelen er målt på ett språk med én ordlengdefordeling.
4. **Korte avsnitt er svakest.** Under omtrent fem ord blir Jaccard støyete,
   fordi hvert trigram veier for mye. Datasettet har få slike.
5. **Likt store deler ved splitting er en kastet mynt.** Deterministisk, men
   uten begrunnelse i teksten.
6. **Terskelen er ikke målt mot avsendere.** Når samtaleimport kommer, er
   «samme setning fra to personer» to avsnitt, og matchingen må trolig avgrenses
   per avsender før likhet i det hele tatt beregnes. Ikke bygget, ikke målt.

## Status

Modulen er frittstående og ren: ingen database, ingen nettverk, ingen
sideeffekter, ingen modellkall. Den er **ikke** koblet inn i appen — verken
skjema, migrering eller `understand.rs` er rørt. Det er en senere runde.

50 tester grønne i indekseren (34 fra før, 11 nye enhetstester — ett per krav
pluss en skalatest, og 5 som kjører datasettet og sveipet).
