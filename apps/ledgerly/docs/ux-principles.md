# UX-prinsipper

Frontend-UI er **ikke bygget ennå**. Prinsippene her er likevel ikke bare intensjoner —
de er bygget inn i datamodellen og API-et, slik at et fremtidig UI får dem gratis.

## 1. Regnskap på vanlig norsk

Handling og forklaring vises **før** teknisk kontonummer. Hver konto i
`src/coa/accounts.ts` har `friendlyName` («Penger kunder skylder deg» før «1500
Kundefordringer»), `plainExplanation`, `whenToUse`/`whenNotToUse`, `examples` og
`commonMistakes`. MVA-kodene i `src/coa/vat-codes.ts` har tilsvarende
`plainExplanation`. Kodebibliotek-endepunktene
(`GET /api/organizations/:orgId/code-library/accounts/:number` i `src/api/server.ts`)
leverer ferdige informasjonssider med dette innholdet. Reglene i `src/rules/no/rules.ts`
har `plainExplanation` uten fagsjargong ved siden av `technicalExplanation` med
lovhjemmel.

## 2. Forklarbarhet — «Hvorfor foreslår dere dette?»

Hvert forslag skal kunne begrunnes fullt ut.
`GET /api/organizations/:orgId/documents/:documentId` returnerer et
`explanation`-objekt bygget fra det lagrede forslaget:

- `evidence` — hva i dokumentet forslaget bygger på,
- `assumptions` — hva som er antatt (f.eks. 100 % næringsbruk),
- `missingInformation` — hva som mangler,
- `alternatives` — andre gyldige valg og når de gjelder,
- `confidence` — tallfestet sikkerhet,
- `rules` — regelreferansene oppslått i regelregisteret med `plainExplanation` og
  **kilder** (tittel, URL, `lastVerified`).

Feltene er påkrevd i `postingSuggestionSchema` (`src/pipeline/suggest.ts`), så også en
fremtidig AI-motor må levere dem.

## 3. Brukeren beholder kontrollen

`requiresHumanReview` er `z.literal(true)` i forslagsskjemaet — det **kan ikke**
settes til automatisk bokføring, uansett motor. Ingen postering skjer uten et
menneskes godkjenning (`approveAndPost` i `src/pipeline/pipeline.ts`), og brukeren kan
overstyre konto, MVA-kode og næringsandel ved godkjenning. Avvik går til kontrollkø
(`needs_review`), mistenkelig innhold til karantene — aldri stille videre.

## 4. Tre presentasjonsnivåer (designmål)

Samme data, tre visninger — dette er et **designmål for det kommende UI-et**, ikke
implementert funksjonalitet:

1. **Enkel** — vanlig norsk, `friendlyName`, beløp og hva brukeren må gjøre.
2. **Avansert** — kontonumre, MVA-koder, posteringslinjer og regelreferanser synlige.
3. **Regnskapsfører** — full teknisk visning: hovedbok, bilagsnummer, idempotensnøkler,
   revisjonslogg og kildehenvisninger.

Datamodellen støtter alle tre i dag: hvert objekt bærer både folkelig og teknisk
representasjon, og API-et eksponerer begge.

## Konsekvens for UI-bygging

UI-et skal ikke finne på egne forklaringer eller tall: all tekst kommer fra
kodebiblioteket/regelregisteret, alle tall fra hovedboken. Estimater (skattepanelet,
`src/tax/estimate.ts`) skal alltid vises med `uncertaintyNotes`, `notIncluded` og
scenarioer — aldri som fasit.

## Designsystem (web/)

Implementert i `web/src/styles.css` + `web/src/ui.tsx`:

- **Tokens**: farger, radier, skygger og typografi som CSS-variabler; mørk modus følger
  `prefers-color-scheme` automatisk.
- **Vanlig norsk foran koder i praksis**: kodebiblioteket lastes én gang
  (`loadCodeLibrary` i `web/src/api.ts`) og brukes overalt — forslag viser
  «Datautstyr og elektronikk (6551)» og «Fradragsberettiget inngående mva, høy sats
  (kode 1)», saldobalansen viser vennlig navn med kontonummer som sekundærlinje.
- **Progressiv visning**: tekniske detaljer (kontonummer, SAF-T-kode, modellsikkerhet,
  dokument-hash) ligger bak en «Vis tekniske detaljer»-disclosure i forklaringspanelet.
- **Tilstander**: skeleton-lasting, tomtilstander med veiledning («Ingenting venter»,
  «Ingen transaksjoner importert») og feilmeldinger på alle skjermer; toasts bekrefter
  handlinger (bokføring, import, avstemming).
- **Tilgjengelighet**: synlig `:focus-visible`, tastaturnavigerbare tabellrader
  (Enter åpner), `aria-expanded`/`aria-current`/`aria-live`, ekte `<form>`-innsending
  på innlogging, `prefers-reduced-motion` respekteres.
- **Verifisering**: hele flyten kjøres i browser av `scripts/ui-smoke.mjs` (lys modus);
  mørk modus er visuelt verifisert med egne skjermbilder.
