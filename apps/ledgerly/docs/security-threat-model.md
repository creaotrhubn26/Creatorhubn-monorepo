# Trusselmodell og sikkerhet

Trusler, implementerte mottiltak (med kodereferanse) og ærlige hull.

## Trusler og mottiltak

| Trussel | Mottiltak i koden |
|---|---|
| **Kompromittert Gmail-konto** (angriper planter «fakturaer» i innboksen) | Kun brukervalgte etiketter skannes (tomme labels = ingenting, `src/ingestion/gmail/port.ts`); alt innhold behandles som ubetrodd; validering + duplikat + karantene; ingenting bokføres uten menneskelig godkjenning. |
| **Stjålet/tilbakekalt OAuth-token** | `GmailAuthError` med tilstand expired/revoked/disconnected → synkronisering stopper kontrollert, status oppdateres, hendelsen revisjonslogges; ingenting slettes (`ingestFromGmail` i `src/pipeline/pipeline.ts`). Scope skal være `gmail.readonly` (lesetilgang kan ikke sende/slette e-post). |
| **Ondsinnet PDF / prompt injection** | `sanitizeUntrustedText` (`src/ingestion/gmail/sanitize.ts`) flagger kjente injeksjonsmønstre (engelsk + norsk) → dokumentet får status `quarantined` og manuell kontroll; kontrolltegn og RTL-overstyring fjernes; `wrapAsUntrustedData` pakker tekst som data før ev. AI-bruk. MIME-typer utenfor allowlist karanteneres (`src/documents/service.ts`). |
| **Falsk faktura** | Valideringsregler (`src/documents/validate.ts`): org.nummer-plausibilitet, sumkontroller, manglende fakturanummer = feil; utenlandsk tjeneste med MVA flagges. Forslag har lav confidence for ukjente leverandører og krever alltid menneskelig godkjenning. Merk: ingen oppslag mot Brønnøysund/leverandørregistre i MVP. |
| **Tenant-lekkasje** | Alle endepunkter krever aktivt medlemskap i organisasjonen (`getMembershipRole`), og alle spørringer filtrerer på `organization_id`. Manglende medlemskap gir **404, ikke 403** — avslører ikke om organisasjonen finnes (`requireOrgPermission` i `src/api/server.ts`). Testet i `test/api.pg.test.ts`. |
| **IDOR** (gjette ID-er på dokumenter/bilag) | Ressursoppslag skjer alltid med `id AND organization_id`; org-ID formatvalideres før spørring; UUID-er er ikke-sekvensielle (`src/shared/ids.ts`). |
| **Dobbel bokføring** | Idempotensnøkkel med unik DB-constraint per organisasjon (`document:<id>` fra pipelinen); duplikatkontroll på sha256, Gmail-melding/vedlegg-id og forretningsnøkkel (leverandør + fakturanr + beløp). |
| **Uautoriserte perioderettelser** | RBAC: `period.lock` og `journal.reverse` krever egne rettigheter (`src/access/permissions.ts`); låst periode avviser posteringer; DB-triggere nekter UPDATE/DELETE på journalen uansett hvem som spør (forsvar i dybden, `migrations/0001_foundation.sql`). |
| **Manipulering av bilag** | sha256 av innholdet lagres ved mottak (integritetskontroll); `source_documents`-status-endringer revisjonslogges; journal og audit-logg er append-only med triggere; revisjonshendelser skrives i samme transaksjon som endringen. |

## Tverrgående mottiltak

- Feil oversettes ved systemgrensen (`src/api/server.ts`): domenefeil får definerte
  HTTP-statuser, ukjente feil gir generisk 500 uten interne detaljer.
- All input valideres med zod før den når domenelogikken.
- Bigint serialiseres som strenger over API-et — ingen presisjonstap i transport.
- Opplasting er størrelsesbegrenset (15 MB) og tomme filer avvises.
- Token-sammenligning bruker `timingSafeEqual` (`src/api/auth.ts`).
- Revisjonsloggen er append-only (DB-triggere) og kan ikke redigeres i etterkant.

## Ærlige hull (ikke produksjonsklart)

- **Dev-login/HMAC-token er IKKE produksjonsauth.** `src/api/auth.ts` er en
  utviklingsmekanisme: `POST /api/auth/dev-login` utsteder token uten passord
  (deaktivert når `NODE_ENV=production`, og `LEDGERLY_AUTH_SECRET` kreves da), tokens
  kan ikke tilbakekalles før 12-timers TTL. Produksjon krever OIDC/BankID med sikre
  sessions. Autorisasjonsmodellen (RBAC per organisasjon) er derimot reell og
  håndheves på alle endepunkter.
- **Ingen MFA.**
- **Ingen kryptering av dokumenter i objektlager** — det finnes ikke noe objektlager
  ennå; dokumentinnhold lagres ikke, kun sha256 + metadata + lokal `storage_key`.
  Kryptering av lagrede dokumenter og av `integration_connections.encrypted_credentials`
  må implementeres før ekte data.
- Ingen rate limiting, ingen anti-virus-skanning av vedlegg, ingen
  Brønnøysund-verifisering av leverandører.

Se `docs/known-limitations.md` og `docs/data-retention.md`.
