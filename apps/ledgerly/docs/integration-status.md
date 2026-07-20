# Integrasjonsstatus

Status rapporteres ærlig av API-et: `GET /api/integrations/status`
(`src/api/server.ts`) — sandbox presenteres aldri som aktiv tilkobling.

| Integrasjon | Status | Hva som finnes i koden |
|---|---|---|
| **Gmail** | **Sandbox — ikke aktiv** | Port-grensesnitt (`src/ingestion/gmail/port.ts`), sandbox-adapter med fixtures (`src/ingestion/gmail/sandbox.ts`), sanitering (`sanitize.ts`), full importflyt med filter, duplikat, karantene og token-tilstander. Ingen produksjonsadapter. |
| **Bank** | **Manuell CSV-import — ingen banktilkobling** | Idempotent transaksjonsimport (`src/bank/import.ts`), deterministisk matching (KID/beløp+dato/beløp+navn) med forklaring og godkjenningsflyt som bokfører betalingen (`src/bank/matching.ts`). Ingen PSD2/open-banking-adapter. |
| **EHF (e-faktura)** | **Ikke implementert** | XML-MIME-typer står i opplastings-allowlisten (`src/documents/service.ts`), men ingen EHF-parsing, ingen aksesspunkt-tilkobling. |
| **SAF-T Financial-eksport** | **Implementert — validert mot offisiell XSD** | `src/saft/export.ts` genererer komplett fil (Header, kontoer m/ periodesaldo, kunder/leverandører, mva-koder, hovedbokstransaksjoner) fra hovedboken; valideres i test mot Skatteetatens XSD v1.10 (`vendor/saft/`). Nedlasting fra Rapporter-skjermen; hver eksport auditlogges. SourceDocuments-noden og Altinn-innsending gjenstår. |
| **Altinn / Skatteetaten (innsending)** | **Ikke implementert** | MVA-rapporten bygges per SAF-T-kode (`src/vat/engine.ts`) men er alltid `status: 'draft'`; rettigheten `vat.submit` finnes. Ingen innsendingsklient. |
| **Brønnøysundregistrene (MVA-registerkontroll)** | **Aktiv — åpne data, ingen nøkkel** | `BrregVatRegisterClient` (`src/integrations/brreg.ts`) slår opp org.nr. i Enhetsregisteret (`data.brreg.no`) og leser `registrertIMvaregisteret`. Endepunkt `POST /vat-register-check` lagrer resultat + tidspunkt på organisasjonen, auditlogger oppslaget og flagger avvik mot lokal MVA-status. Testene bruker injiserbar stub (`StaticVatRegisterStub`). |
| **Lovdata API (lovtekst)** | **Delvis — åpne bulk-data uten nøkkel; per-paragraf-oppslag krever API-nøkkel (ikke konfigurert ⇒ ikke aktivt)** | `LovdataApiClient` (`src/integrations/lovdata.ts`) bak `LovdataPort` med injiserbar stub (`StaticLovdataStub`). **Åpent uten nøkkel:** `ping()` (reachability) og `listPublicDatasets()` (NLOD-katalogen `/v1/publicData/list`, bl.a. `gjeldende-lover.tar.bz2`). **Krever `X-API-Key`:** `fetchLegalText(refID)` via `/renderRefID` — henter ordrett lovtekst bak en `legalReference`. Uten nøkkel kaster `fetchLegalText` `LovdataAuthError` FØR nettverkskall, og `/api/integrations/status` viser `mode: 'public_data_only', active: false`. Broen fra regel til lovtekst er `legalReferenceRefID(rule, register)` (utleder f.eks. `NL/lov/1999-03-26-14/§6-20` fra fradragsregelen). **Verifisert 2026-07-20 mot api.lovdata.no:** vert naable her, `/ping`+`/v1/publicData/list` = 200 uten nøkkel, `/renderRefID`+`/lookup` = 401 uten nøkkel. |
| **OCR** | **Tesseract (nor+eng) — aktiv når installert** | `OcrExtractor` (`src/pipeline/ocr.ts`): Tesseract for bilder, pdftotext for PDF-tekstlag, deterministisk parsing av resultatet. Injection-kontroll kjøres på den tolkede teksten. Krever `tesseract-ocr`, `tesseract-ocr-nor`, `poppler-utils`; faller ellers ærlig tilbake til tekstparser (`/api/integrations/status` viser hvilken modus som kjører). |

## Hva som trengs for å aktivere hver

### Gmail
Google Cloud-prosjekt med Gmail API, OAuth-samtykkeskjerm og klienthemmeligheter,
kun `gmail.readonly`-scope, kryptering av tokens før lagring i
`integration_connections.encrypted_credentials`, og en produksjonsadapter som
implementerer `GmailPort` (inkl. mapping til `GmailAuthError`-tilstandene).
Detaljer: `docs/google-workspace-integration.md`.

### Bank
Avtale med bank-API-leverandør (PSD2/åpen bank-aggregator eller direkteavtale),
samtykkeflyt, idempotent transaksjonsimport mot `bank_transactions`
(unik `(bank_account_id, external_id)` finnes allerede), matchingmotor som fyller
`reconciliation_matches` med forklaring, og godkjenningsflyt (matchene har allerede
status suggested/approved/rejected i skjemaet).

### EHF
Tilknytning til Peppol-aksesspunkt, parser for EHF/UBL-XML til `ExtractedData`
(`src/documents/types.ts`), og ruting inn i eksisterende pipeline
(`processIncomingDocument`) — validering, duplikat og forslag gjenbrukes.

### Altinn/Skatteetaten
Maskinporten-integrasjon og MVA-meldingens innsendings-API, mapping fra
`VatReport`-linjene (kodene er allerede SAF-T/mva-melding-koder), eksplisitt
signeringssteg knyttet til `vat.submit`, og lagring av innsendingskvittering.

### Lovdata API (per-paragraf lovtekst)
En Lovdata-utstedt API-nøkkel (`X-API-Key`), satt som `LEDGERLY_LOVDATA_API_KEY`.
Da blir `LovdataApiClient.hasApiKey` sann, `fetchLegalText(refID)` henter ordrett
lovtekst via `/renderRefID`, og `/api/integrations/status` skifter til
`mode: 'api_key', active: true`. Nøkkel fås ved å opprette en API-konto hos Lovdata
(bruksvilkår + NLOD 2.0 for datagrunnlaget). De åpne bulk-datasettene
(`/v1/publicData/*`) krever derimot ingen nøkkel og virker allerede.

### OCR
En dokumentforståelses-/OCR-motor bak `DocumentExtractor`-porten. Output valideres
uansett av `src/documents/validate.ts`, og forslag må fortsatt validere mot
`postingSuggestionSchema` — ingen arkitekturendring kreves.
