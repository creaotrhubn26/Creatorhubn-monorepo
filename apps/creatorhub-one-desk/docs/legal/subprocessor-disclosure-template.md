# Underleverandør-tekst for personvernerklæring

Når du aktiverer offsite-backup via Backblaze B2, blir Backblaze din
**underleverandør (data processor)**. GDPR Art 28 + Art 13 krever at
du opplyser dine klienter om dette i din egen personvernerklæring.

Kopier teksten under inn i seksjonen «Underleverandører» / «Tredjeparts-databehandlere» i din personvernerklæring:

---

## Underleverandører

Vi bruker følgende underleverandører for sikker oppbevaring og
behandling av prosjekt-filer:

### Backblaze, Inc. (Backblaze B2 Cloud Storage)

- **Hovedkontor:** 500 Ben Franklin Court, San Mateo, CA 94401, USA
- **Datasenter for europeiske kunder:** Amsterdam, Nederland
  (EU Central-regionen)
- **Formål:** Sikker offsite-lagring av RAW-filer, master-spor,
  deliverables og kunde-arkiver
- **Databehandleravtale (DPA):** Inngås direkte mellom oss og
  Backblaze. Backblaze' standard DPA er tilgjengelig på
  https://www.backblaze.com/company/gdpr.html
- **Overføring til land utenfor EØS:** Ingen — vi bruker EU Central-
  regionen for alle filer. Data forblir innenfor EØS.
- **Kryptering:** Server-side AES-256 (SSE-B2) automatisk for alle
  filer i hvile. TLS 1.2+ for transport.
- **Oppbevaring:** [Definer din retention-policy her — f.eks. 5 år
  etter prosjekt-avslutning, deretter automatisk sletting]
- **Sletting på forespørsel:** Vi reagerer på sletteforespørsel
  innen 30 dager. Slettelogg lagres for samsvarsformål.

### Creatorhub AS (Plattform-tilbyder)

- **Rolle:** Teknisk integrator for backup-flyten. Vi ser ALDRI
  innholdet i filene — disse går direkte fra vår klient-applikasjon
  («Creatorhub One Desk») til Backblaze. Vi lagrer kun krypterte
  API-credentials og metadata (filnavn, hash, størrelse, tidspunkt).
- **Datasenter:** Cloudflare R2 (EU) for plattform-data,
  Render (Oregon, USA) for backend-prosesser.

---

## Klient-rettigheter (informasjons-snippet)

Hvis du ønsker å informere klienter eksplisitt om underleverandørene,
kan du bruke denne kortere varianten i kontrakten / fotograf-avtalen:

> «Til offsite-arkivering av prosjekt-filer benytter vi Backblaze B2
> (EU Central-regionen, Amsterdam). Filene oppbevares kryptert og
> kun jeg som fotograf har tilgang. Du kan be om sletting når som
> helst, og slettingen utføres innen 30 dager med skriftlig
> bekreftelse.»

---

## Sjekkliste før du aktiverer Backblaze

- [ ] Signert Backblaze DPA (link i app-en under «Settings →
      Offsite-backup»)
- [ ] Konfigurert bucket-region til **EU Central** (Amsterdam) —
      ikke US-Vest
- [ ] Definert retention-policy (oppbevaringstid før automatisk sletting)
- [ ] Lagt til Backblaze i din egen personvernerklæring som
      underleverandør
- [ ] Informert eksisterende klienter ved kontraktsfornyelse om at
      offsite-backup er aktivert

---

*Mal sist oppdatert: 2026-06-03. Du er ansvarlig for at teksten
i din egen personvernerklæring er korrekt og oppdatert.*
