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
| **OCR** | **Deterministisk tekstparser — ikke ekte OCR** | `DeterministicTextExtractor` (`src/pipeline/extract.ts`) parser tekstbærende innhold med regex. Fungerer på sandbox-fixtures og tekst-PDF-er; leser ikke skannede bilder. Port-grensesnittet `DocumentExtractor` er klart for en ekte motor. |

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

### OCR
En dokumentforståelses-/OCR-motor bak `DocumentExtractor`-porten. Output valideres
uansett av `src/documents/validate.ts`, og forslag må fortsatt validere mot
`postingSuggestionSchema` — ingen arkitekturendring kreves.
