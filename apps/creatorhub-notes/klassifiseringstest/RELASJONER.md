# Relasjonstest, 12. september 2026

Måler den nye modelloppgaven bak «Tidligere om dette»: gitt et avsnitt
brukeren skriver nå og ett hun skrev før, hva er forholdet mellom dem —
`motsier`, `bekrefter`, `besvarer` eller `urelatert`?

`relasjoner.jsonl` holder 24 par. Ti av dem er `urelatert` med ekte
ordoverlapp: «depositum» i en produktbeslutning mot «depositum» på en leiebil,
«kart» i låne-appen mot Kartverkets eiendomsdata, «bestemorvennlig» som krav
mot bestemor som skal ha hjelp med nettbanken. Det er den feilen som ødelegger
funksjonen, så den må være overrepresentert.

Kjør: `python3 relasjoner.py` (Haiku), `--modell claude-sonnet-5`,
`--eskaler` (begge, i den rekkefølgen appen bruker dem).

Prompten leses ut av `app/src-tauri/src/minne.rs` ved hver kjøring, ikke
skrevet av på nytt her. Kjøring 2 av klassifiseringstesten gikk i den fella —
et eksempel i prompten var ordrett et avsnitt i fasiten — og den fella er
lettest å unngå ved at det bare finnes én prompt.

## Måltallet

> **Falsk koblingsrate** — av parene der fasiten er `urelatert`, hvor ofte
> sier modellen noe annet?

En falsk kobling forteller brukeren at hun har tenkt noe hun ikke har tenkt.
Ti av dem etter hverandre, og hun slutter å lese seksjonen — og da er
funksjonen verre enn ingenting. Å gå glipp av en ekte kobling koster ingenting
til sammenligning: da står panelet som det sto.

## Tallene

| | Falsk koblingsrate | Ekte forhold truffet nøyaktig |
|---|---|---|
| Haiku 4.5, kjøring 1 | **0/10 = 0 %** | 14/14 |
| Haiku 4.5, kjøring 2 | **3/10 = 30 %** | 13/14 |
| Haiku 4.5, kjøring 3 | **4/10 = 40 %** | 13/14 |
| Sonnet 5, én kjøring | 1/10 = 10 % | 14/14 |
| Haiku → Sonnet, kjøring 1 | **0/10 = 0 %** | 12/14 |
| Haiku → Sonnet, kjøring 2 | **0/10 = 0 %** | 10/14 |
| Haiku → Sonnet, kjøring 3 | **1/10 = 10 %** | 13/14 |
| Haiku → Sonnet, kjøring 4 | **0/10 = 0 %** | 10/14 |

## Haiku alene holder ikke, og det var ikke ventet

Klassifiseringstesten konkluderte med at Haiku holder. Den konklusjonen
gjelder ikke her, og det er verdt å si tydelig: en billig modell som er god
nok til å lese ett avsnitt er ikke automatisk god nok til å sammenligne to.

Haiku svinger mellom 0 og 40 % falske koblinger på det samme settet, med den
samme prompten. Hadde jeg stanset etter kjøring 1 — som klassifiseringstesten
gjorde, og som den selv skrev opp som en metodefeil — ville jeg rapportert
0 % og bygget videre på et tall som ikke finnes.

Haikus feil går i én retning: den kobler for mye. Den mister nesten aldri et
ekte forhold (14, 13 og 13 av 14). Den kaller «render-noden koker» og
«pipelinen henger mellom render og lagring» for samme sak, og «Notion-eksport
til kunden» for et svar på «bedre enn Notion».

## Arkitekturen som ble valgt

Nøyaktig den `RESULTAT.md` pekte på, brukt på den ene dyre avgjørelsen her:

**Haiku dømmer alt. Bare parene Haiku faktisk koblet leses en gang til av
Sonnet, og Sonnets svar er det som gjelder.** Et par Haiku kalte `urelatert`
er ferdig der. Det er trygt fordi Haikus feil ligger i den andre retningen —
den kobler for mye, ikke for lite.

Over fire kjøringer: 0, 0, 10 og 0 %. Snitt 2,5 % mot Haikus 23 %.

Dette er implementert i `Cli::døm` i `understand.rs`. Feiler annenlesningen,
feiler hele dømmingen: ingenting lagres, og parene prøves igjen senere. Å la
Haikus egne koblinger gå gjennom ville vært å vise brukeren nøyaktig den
støyen annenlesningen finnes for.

## Det som ikke virker

**Etiketten på en ekte kobling er ofte feil.** Måltallet er rent, men det er
ikke hele bildet. Par 1 — «Kartet skal ikke være startsiden likevel. Vis en
enkel liste først» mot «Jeg ser for meg at man først ser et kart med det som
er tilgjengelig i nærheten» — ble kalt `bekrefter` i to kjøringer og
`besvarer` i en tredje. Fasiten er `motsier`.

Det betyr at brukeren i det tilfellet får se **«Du bestemte det samme
3. september»** om et avsnitt der hun snudde. Det er verre enn å ikke vise
linja, fordi det er en påstand om hennes egen historikk som er usann.

Par 9 går samme vei: et avsnitt som avgjør en tvil kalles `bekrefter` i stedet
for `besvarer`. Mindre alvorlig — begge sier «du har tenkt dette før» — men
samme mønster: modellene ser at to avsnitt handler om det samme, og velger den
mest velvillige etiketten.

Jeg har ikke løst dette. Det som ville hjulpet er sannsynligvis å skille de to
avgjørelsene: først «handler disse om den samme saken?», så «er det nye enig
eller uenig med det gamle?». Det er et kall til, og det bør måles før det
bygges, ikke antas.

**Par 8 bommer alle.** «Render-noden hos Marius står og koker» mot «Henger et
sted mellom render og lagring» kalles relatert av både Haiku og Sonnet, i
nesten hver kjøring. Begge handler om render som går galt. At det er
maskinvare i den ene og en pipeline i den andre er en forskjell modellene ikke
ser. Det er den ene falske koblingen som overlever annenlesningen.

**Kostnaden er høyere enn for klassifiseringen.** Haiku koblet 15–18 av 24 par
på dette settet, så 60–75 % gikk videre til Sonnet. For klassifiseringen er
eskalering sjelden; her er den normalen. Det er delvis et artefakt — hvert par
i settet deler ord med vilje — men det er også hva ordsøket faktisk leverer,
så anslaget er ikke langt unna. I praksis betyr det to kall første gang et par
dukker opp, og null hver gang etterpå: forholdet lagres i `relasjoner`-tabellen
og spørres aldri om igjen.

## Hva testen ikke viser

1. **24 par er få**, og ti urelaterte er færre. Ett utfall flytter måltallet
   ti prosentpoeng. Tallene bærer en retning, ikke en desimal.
2. **Halvparten av parene er konstruerte.** `kilde` sier hvilke: `ekte` er to
   ekte avsnitt, `delvis` er ett ekte og ett skrevet for testen, `konstruert`
   er begge. Bare tre par er helt ekte, fordi Daniel har tre notater i mappen
   ennå. Konstruerte par er lettere: kontrasten er tydeligere enn den er i et
   ekte notat.
3. **Samme person skrev parene, fasiten og prompten.** Felles blindsoner er
   mulige, og her er de sannsynligere enn i klassifiseringstesten, fordi jeg
   skrev de urelaterte parene *for å* være vanskelige på en bestemt måte —
   ordoverlapp uten emneoverlapp. Andre måter å være urelatert på er ikke
   representert.
4. **Par 3 er omdiskuterbart.** «admin skal ALLTID få beskjed» mot «får
   fotografen beskjed når de har lastet ned bildene?» er merket `urelatert`.
   Begge handler om varsling, i det samme produktet. Jeg mener fortsatt at de
   ikke gjelder den samme saken, men jeg ville ikke protestert høylytt på det
   motsatte. Begge modellene svarte `urelatert`, så paret bærer ingen vekt.
5. **Sonnet er målt én gang alene.** Kolonnen over står som en retning, ikke
   som et tall å bygge på.
6. **Kjedet er ikke målt under feil.** Hva som skjer når Sonnet-kallet bruker
   for lang tid, er testet i Rust, ikke her.

## Konklusjon

Funksjonen er mulig, men ikke med den billige modellen alene. To lesninger,
der den dyre bare ser det den billige koblet, holder falsk koblingsrate under
det som gjør seksjonen til støy.

Den neste risikoen å måle er ikke denne. Det er om etiketten stemmer når
koblingen er ekte — for det er `motsier` som bærer hele funksjonen, og det er
den etiketten som bommer oftest.
