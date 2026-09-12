# Resultat, 10. september 2026

**Premisset holder.** Ingen av modellene bygde på en eneste tvil, gjengivelse
eller uenighet — 16 av 16 harde grensetilfeller.

## Tallene

| | Haiku 4.5 | Sonnet 5 |
|---|---|---|
| Falsk byggerate (fasit som merket) | 3/27 = 11 % | 3/27 = 11 % |
| Falsk byggerate (krav teller som bygg) | **0/23 = 0 %** | **0/23 = 0 %** |
| Bygde på harde grensetilfeller | **0 av 8** | **0 av 8** |
| Traff type på harde grensetilfeller | 7 av 8 | 7 av 8 |
| Handling riktig, totalt | 68 % | 91 % |
| Type riktig, totalt | 80 % | 84 % |

## Fasiten tok feil, ikke modellene

Begge modellene bommet på **nøyaktig de samme tre avsnittene** — 10, 19 og 20,
alle krav fra Daniel: «det må ikke synes at du er i demo modus»,
«bestemorvennlig», «bedre enn Word, Notion, Milanote». Begge kalte dem `bygg`,
fasiten sa `hold`.

De tre var flagget som usikre før kjøringen, nettopp fordi et krav er en
beslutning om *hvordan*. At en billig og en dyr modell er uavhengig enige mot
fasiten, avgjør spørsmålet: **krav skal bygges inn i modellen.** Under den
lesningen er falsk byggerate null for begge.

Et annet fasit-problem kom fram i kjøringen: skillet mellom `hold` og
`marker_åpent` er finere enn produktet trenger. Begge betyr «ikke bygg», og for
«kanskje depositum, men jeg er usikker» er `marker_åpent` faktisk riktigere enn
det som var merket. Måltallet ble rettet: på de harde grensetilfellene teller
kun om modellen bygde.

## Haiku holder — og det er hovedfunnet

Produktet må klassifisere mens brukeren skriver. Krever det den dyreste
modellen, er svaret nei uansett hvor godt det virker.

Haiku gjør elleve feil Sonnet unngår, og **alle går i trygg retning**:

- Ni ganger svarer den `marker_åpent` der fasiten sier `hold`. Den flagger for
  mange ting som åpne spørsmål. Støy, ikke skade.
- To ganger svarer den `hold` der den kunne bygget. Den bygger for lite.

Ingen av Haikus feil er av typen som ødelegger produktet.

### Arkitekturen det peker mot

Kjør Haiku kontinuerlig mens brukeren skriver. Eskalér til Sonnet **kun når
Haiku sier `bygg`** — det er den ene avgjørelsen som koster noe å ta feil, og
den er sjelden. Da får man Sonnets presisjon til Haikus pris på den vanlige
veien.

## Der begge tok feil

Avsnitt 39, «Ifølge Skatteetaten må vi ta vare på bilagene i fem år» — begge
svarte `hold`, fasiten sa `bygg`. En ekstern regel er ikke en mening, og burde
etter min lesning bygges inn. Begge modellene behandlet den som bakgrunn.

Dette er ikke opplagt en modellfeil. Det er et ekte designspørsmål: skal en
sitert lovpålagt regel telle som brukerens beslutning? Det bør avgjøres, ikke
antas.

## Hva testen ikke viser

1. **44 avsnitt er få.** Usikkerheten er stor. Et enkelt utfall kan flytte
   prosentene merkbart.
2. **Korpuset er kommandoer til en assistent, ikke notater til seg selv.**
   Ekte notater er lengre, rotete og mer flertydige. Registeret her er mer
   avgjort enn det produktet vil møte. Neste runde må bruke notater Daniel har
   skrevet til seg selv.
3. **Instruksen gjør mye av jobben.** «Er du i tvil, velg det som gjør minst»
   sto tydelig i oppgaven. Resultatet måler modell *pluss* denne instruksen,
   ikke modellen alene. Det er greit — det er instruksen produktet ville
   sendt — men uten den er tallene sannsynligvis dårligere.
4. **Én kjøring per modell.** Ingen måling av hvor stabile svarene er ved
   gjentakelse.
5. **Samme person skrev fasiten og oppgaveteksten.** Felles blindsoner er
   mulige. De tre kravene ble riktignok flagget som usikre på forhånd, noe som
   demper innvendingen, men fjerner den ikke.

## Konklusjon

Klassifiseringen er ikke det som velter «levende notatflate». Den vanskeligste
grensen — bestemt kontra ikke bestemt — treffer begge modellene, og feilene
faller i trygg retning.

Neste risiko å teste er ikke denne. Det er om det som *bygges* er riktig nok
til å være verdt oppmerksomheten — og det bør testes på beregninger og
avhengigheter, der svaret kan etterprøves, ikke på wireframes, der det bare kan
diskuteres.

---

# Kjøring 2, 10. september 2026 — 48 avsnitt, `oppgave` innført

## Det som ble målt

| | Haiku 4.5 | Sonnet 5 |
|---|---|---|
| Falsk byggerate | 3/31 = 10 % | **0/31 = 0 %** |
| Bygde på en oppgave | **0 av 5** | **0 av 5** |
| Traff `oppgave` som type | 5 av 5 | 5 av 5 |
| Bygde på harde grensetilfeller | 0 av 8 | 0 av 8 |
| Handling riktig | 58 % | 90 % |
| Type riktig | 77 % | 81 % |

Den nye feilklassen `oppgave` åpnet for — at systemet endrer produktet fordi
noen skulle ringe en fotograf — inntraff ikke. Pilformatet ødela ingenting:
alle 96 svarlinjer har nøyaktig fire felt.

## To metodefeil, begge i testen og ikke i modellene

**Prompten forurenset avsnitt 45.** Eksempelet som forklarte pilregelen,
«Starte produksjon ← godkjent prototype», var ordrett innholdet i avsnitt 45.
Haikus perfekte treff der kan være gjenkjenning like mye som resonnement.

Rettet ved å bytte avsnittet, ikke prompten: appens egen prompt bruker samme
eksempel, og den er god der. Testen skal måle appens faktiske prompt, så det er
fasiten som må vike. Avsnitt 45 er nå «Fargekorrigeringen kan ikke starte før
klippet er låst» med avhengigheten «låst klipp». **Avhengighetstallene over
gjelder den gamle, forurensede utgaven** og må måles på nytt.

**Variansen mellom kjøringer er større enn antatt.** Haikus handling-treff falt
fra 68 % til 58 % på materiale som overlappet med forrige kjøring. Alle
avvikene gikk i trygg retning — den ble mer konservativ på reelle beslutninger
— men et tall som svinger ti poeng mellom to kjøringer bærer ikke en beslutning
alene.

Sonnet gikk motsatt vei: fra 11 % til 0 % falsk byggerate, fordi den denne
gangen traff alle tre kravavsnittene (10, 19, 20) riktig.

Forbeholdet sto allerede i kjøring 1 som «én kjøring per modell, ingen måling
av hvor stabile svarene er ved gjentakelse». Nå er det ikke lenger et forbehold,
men et funn.

## Én ny feil verdt å følge med på

Sonnet klassifiserte avsnitt 1, «admin skal ALLTID få beskjed», som `oppgave`
denne gangen. Forrige kjøring traff den `beslutning|bygg`. Det ser ut som den
nye kategorien trekker til seg grensetilfeller den ikke burde eie. Trygg retning
— ingen falsk bygg — men verdt å se etter i neste kjøring.

## Hva som må gjøres før disse tallene kan brukes

1. **Tre kjøringer per modell**, ikke én, og rapporter spredning. Uten det er
   enkelttall ikke etterprøvbare.
2. **Kjør avhengighetsmålingen på nytt** med det rettede avsnitt 45.
3. Se om `oppgave` fortsetter å trekke til seg beslutninger.

Konklusjonen fra kjøring 1 står: ingen modell bygger på noe uavgjort. Det er
fortsatt det som avgjør om produktet er mulig, og det holder.
