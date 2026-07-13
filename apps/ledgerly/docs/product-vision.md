# Produktvisjon

## Hva vi bygger

En norsk regnskapsplattform for små virksomheter (ENK, AS m.fl.) som kombinerer:

- **Fikens enkelhet** — regnskap forklart på vanlig norsk, uten å kreve regnskapskompetanse.
- **Tripletex' modulbredde** — én plattform der bilag, MVA, skatt, rapporter (og senere bank,
  faktura og lønn) henger sammen i samme datamodell.
- **PowerOffice' flyt** — dokumenter kommer inn automatisk (e-post, opplasting, mobil),
  behandles i en sammenhengende pipeline og ender som bokførte bilag med komplett kontrollspor.
- **En AI-assistent** — som foreslår og forklarer, men aldri bestemmer. Se `src/pipeline/suggest.ts`:
  alle forslag har `requiresHumanReview: true`, og juridisk/matematisk sannhet ligger i
  deterministisk kode og det versjonerte regelregisteret (`src/rules/`), aldri i en modellprompt.

## Hovedløftet

**«Vi finner det som mangler.»** Systemet skal aktivt oppdage det brukeren ellers ville oversett:
manglende bilag, duplikater, feil MVA-behandling (f.eks. utenlandsk SaaS uten omvendt
avgiftsplikt), kjøp over aktiveringsgrensen, og avvik mellom netto, MVA og brutto
(`src/documents/validate.ts`). Avvik stopper flyten og havner i en kontrollkø — de bokføres ikke stille.

## Produktnavn er konfigurasjon

Produktnavnet er bevisst **ikke** hardkodet i domenemodellen. Det leses fra miljøvariabelen
`PRODUCT_NAME` med default `'Ledgerly Norge'` (`src/config.ts`). Navnet er ren presentasjon og
kan endres uten kodeendring i domenet.

## Prioritering

Ved konflikt vinner alltid det høyere prinsippet:

1. **Korrekthet** — tall er eksakte (bigint-ører, `src/shared/money.ts`), satser kommer fra
   kildebelagte regler, posteringer balanserer alltid.
2. **Sporbarhet** — append-only-journal, revisjonslogg i samme transaksjon som endringen
   (`src/audit/audit.ts`), toveis spor dokument ↔ forslag ↔ postering.
3. **Sikkerhet** — RBAC per organisasjon, tenant-isolasjon, karantene for mistenkelig innhold.
4. **Personvern** — minste tilgang (Gmail: kun valgte etiketter), ubetrodd innhold behandles som data.
5. **Forklarbarhet** — hvert forslag har evidence, assumptions, alternativer og kildereferanser.
6. **Brukervennlighet** — vanlig norsk før kontonumre (`friendlyName`/`plainExplanation` i `src/coa/`).
7. **Automatisering** — pipelinen automatiserer alt frem til godkjenning, aldri selve godkjenningen.
8. **Hastighet** — ytelse optimaliseres ikke på bekostning av punktene over.
9. **Visuell eleganse** — sist. (Frontend-UI er per i dag ikke bygget; se `docs/mvp-scope.md`.)

## Avgrensning

Dette dokumentet beskriver retning. Hva som faktisk finnes i koden i dag står i
`docs/mvp-scope.md`, og det som mangler står ærlig i `docs/known-limitations.md` og
`docs/integration-status.md`.
