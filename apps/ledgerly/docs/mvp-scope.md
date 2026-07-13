# MVP-omfang

MVP-en er én komplett **vertikal flyt** fra dokument til rapport, implementert som backend
(API + PostgreSQL) uten frontend. Alt under er implementert og testet (71 tester, se
`docs/qa-matrix.md`).

## Flyten (implementert)

1. **Organisasjon** — opprettelse med organisasjonsform, MVA-status og MOD11-validert
   org.nummer; oppretter blir `owner`, standard kontoplan seedes (`src/orgs/service.ts`).
2. **Dokumentinntak** — opplasting/mobil via `POST /api/organizations/:orgId/documents`
   og Gmail-import via **sandbox-adapter** (`src/ingestion/gmail/sandbox.ts`). Ekte
   Gmail-tilkobling er ikke aktiv — se `docs/google-workspace-integration.md`.
3. **Filkontroll og karantene** — MIME-allowlist, sha256, prompt-injection-skanning
   (`src/documents/service.ts`, `src/ingestion/gmail/sanitize.ts`).
4. **Uttrekk** — deterministisk tekstparser (`src/pipeline/extract.ts`), ikke ekte OCR.
5. **Validering** — sumkontroller (netto + MVA = brutto m.m.); feil gir status
   `needs_review` (avvikskø) i stedet for videre flyt (`src/documents/validate.ts`).
6. **Duplikatkontroll** — på innhold (sha256), Gmail-melding/vedlegg-id og
   forretningsnøkkel (leverandør + fakturanr + beløp).
7. **Forslag** — deterministisk motor med konto, MVA-kode, aktiveringsvurdering,
   confidence, forklaring og regelreferanser (`src/pipeline/suggest.ts`).
8. **Godkjenning** — menneskelig godkjenning kreves alltid; bruker kan overstyre konto,
   MVA-kode og næringsandel (`approveAndPost` i `src/pipeline/pipeline.ts`).
9. **Bokføring** — dobbelt bokholderi med balansekrav, idempotensnøkkel, periodelås,
   reversering og valutastøtte (`src/ledger/engine.ts`).
10. **Rapporter** — saldobalanse, resultat, balanse, hovedbok, reskontro
    (`src/ledger/reports.ts`); MVA-rapport per SAF-T-kode (`src/vat/engine.ts`);
    skatteestimat med regelversjoner og forbehold (`src/tax/estimate.ts`).
11. **Revisjonslogg** — append-only `audit_events`, skrevet i samme transaksjon som
    endringen, tilgjengelig via API.

I tillegg: kodebibliotek-API som forklarer kontoer og MVA-koder på vanlig norsk, RBAC
med 10 roller (`src/access/permissions.ts`), tenant-isolasjon i alle endepunkter.

## Eksplisitt IKKE med i MVP

- **Bank** — tabellene `bank_accounts`/`bank_transactions`/`reconciliation_matches`
  finnes i skjemaet, men ingen bankintegrasjon eller avstemmingslogikk er implementert.
- **Utgående faktura** — ingen fakturering, ingen purring.
- **Lønn** — konto 5000 finnes i kontoplanen, men ingen lønnsmodul/a-melding.
- **EHF** — XML-MIME aksepteres ved opplasting, men ingen EHF-parsing eller aksesspunkt.
- **SAF-T-XML-eksport** — kontoplan og MVA-koder følger SAF-T-standarden, men
  eksportfilen genereres ikke.
- **Altinn/Skatteetaten-innsending** — MVA-rapporten er alltid `status: 'draft'`.
- **Frontend-UI** — kun HTTP-API.
- **Produksjonsautentisering** — dev-login med HMAC-token (`src/api/auth.ts`);
  OIDC/BankID og MFA er dokumentert krav, ikke implementert.
- **Objektlagring** — dokumentinnhold lagres ikke; kun hash, metadata og en lokal
  `storage_key`.

Se `docs/known-limitations.md` for full liste og `docs/integration-status.md` for
integrasjonsstatus.
