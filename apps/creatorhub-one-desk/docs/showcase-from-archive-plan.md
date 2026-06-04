# UniversalShowcase fra B2-arkiv

**Status:** Plan, ikke startet
**Eier:** Daniel Qazi
**Sist oppdatert:** 2026-06-04
**Søsken-dokument:** [b2-backup-plan.md](./b2-backup-plan.md)

## Mål

Bygge en bro fra fotografens B2-arkiv (One Desk-flyten) til
UniversalShowcase slik at fotografen kan levere et utvalg av allerede
backup'ede filer direkte til klient — uten å laste opp på nytt, og
uten å duplisere lagring til R2.

## Designvalg: B2 + Cloudflare CDN (Bandwidth Alliance)

### Hvorfor ikke R2 i tillegg?

Forrige plan var å kopiere filer fra B2 til R2 for showcase-levering.
Avvist fordi:
1. Dobbel lagring → dobbel kostnad
2. Fotograf-eier-prinsippet brytes (vi får ansvar for kopiene)
3. GDPR-erasure må slette to steder

### Hvorfor ikke pure B2 direkte?

Backblaze egress-prising: 3× månedlig lagring gratis, deretter
$10/TB. Realistisk scenario:

- 30 TB arkiv (100 bryllup x 300 GB/stk over 5 år)
- 100 bryllup-galleri/år × 100 visninger × 5 GB = 50 TB egress/år
- 3× gratis-tak: 90 TB/år (3 × 30 TB)
- Innenfor gratis-grensen i dette scenariet — MEN ett enkelt viralt
  bryllups-album (500+ visninger) kan ødelegge

Risikoen: uforutsigbar regning ved viral spredning. Vil unngås.

### Valgt løsning: A — Cloudflare-fronted B2

Backblaze + Cloudflare Bandwidth Alliance (siden 2020) = **$0 egress**
fra B2 til Cloudflare CDN. Implementasjon:

1. Cloudflare Worker eksponert på `creatorhubn.com/api/showcase/cdn/...`
2. Worker validerer gallery-token + item-id mot vår backend
3. Worker henter signed B2-URL via backend
4. Worker fetcher fra B2 (gratis via Bandwidth Alliance) og streamer
   tilbake til klient
5. Cloudflare CDN-cacher responsen → etterfølgende visninger er gratis
   OG raskere enn direkte B2

Fordeler:
- Null månedlig tilleggskost
- CDN-akselerasjon
- Fotograf betaler kun lagring ($6/TB/mnd)
- Skalerer fritt med antall visninger

## Arkitektur

```
┌─────────────────┐
│  Klient (web)   │ ← åpner /gallery/<token>
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Creatorhub frontend (Vercel)            │
│  /gallery/:access_token                  │
│   - henter gallery + items fra backend   │
│   - hver item.image_url =                │
│     creatorhubn.com/api/showcase/cdn/... │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Cloudflare Worker                       │
│  showcase-cdn-worker                     │
│   1. valider token vs backend            │
│   2. hent signed B2-URL fra backend      │
│   3. fetch fra B2 (free Bandwidth        │
│      Alliance)                           │
│   4. stream tilbake + cache 7 dager      │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Backblaze B2 (fotografens bucket)       │
│   - signed download URL, TTL 1 time      │
│   - lagring: $6/TB/mnd                   │
│   - egress til Cloudflare: $0            │
└──────────────────────────────────────────┘
```

## Dataflyt: «Lever fra arkiv»

### Bridge-tabell

Vi reuser `photographer_client_galleries`-modellen fra
`capture-showcase-bridge.ts`, men tagger med `ditProjectId` istedenfor
`captureSessionId`:

```typescript
gallery_settings: {
  ditProjectId: "<legacy.projects.id>",
  source: "dit-archive",
  providerId: "<user_storage_providers.id>",
  bucketId: "<B2 bucket_id>",
  createdVia: "one-desk-deliver",
}
```

For hver fil i `client_gallery_images`:

```typescript
image_url: `/api/showcase/cdn/${access_token}/${item_id}`,
image_metadata: {
  b2Source: {
    providerId: "<provider_id>",
    bucketId: "<bucket_id>",
    fileName: "dit-backup/proj_xyz/DCIM/100CANON/IMG_0042.JPG",
    sha1: "<from dit_backup_jobs>",
  },
  originalSize: 24850000,
  contentType: "image/jpeg",
}
```

### Endepunkter

| Metode | Path | Auth | Formål |
|---|---|---|---|
| GET | `/api/dit/projects/:id/archive-files` | userSession | Lister verifiserte B2-arkiv-filer (kilde for picker) |
| POST | `/api/dit/projects/:id/deliver-to-showcase` | userSession | Velg filer → oppretter gallery + items |
| GET | `/api/showcase/items/:item_id/sign-url` | gallery-token | Backend returnerer fersk signed B2-URL (kalt av Worker) |
| GET | `/api/showcase/cdn/:token/:item_id` | gallery-token | Worker — proxyer/cacher B2-bytes |
| POST | `/api/storage/providers/:id/erase-project` | userSession | (eksisterer) — utvidet til også slette showcase-gallerier |

## Komponenter som må bygges

| Komponent | Type | Estimert tid |
|---|---|---|
| Backend `archive-files`-endpoint | Express route | 30 min (klart i utkast) |
| Backend `deliver-to-showcase` | Express route + bridge | 1,5 t |
| Backend `sign-url`-endpoint (B2 download authorization) | Express route | 30 min |
| Cloudflare Worker `showcase-cdn-worker` | Worker (~80 LOC) | 1,5 t |
| Worker deploy + DNS-routing | wrangler.toml + DNS | 30 min |
| Backend erase-project utvidet med showcase | Express endring | 30 min (klart i utkast) |
| Frontend «Lever til showcase»-knapp + dialog | React | 1,5 t |
| Frontend file-picker med thumbs fra B2 | React + signed-URL-fetch | 1 t |
| **Total** | | **~7-8 t** |

## Bruker-scenario: Fredrik leverer Frida & Magnus' bryllup

### Forutsetninger
- Fredrik har Backblaze-konto satt opp i Creatorhub (Fase 2 onboarding)
- Han eier en EU-bucket `creatorhub-fredrik-archive`
- Bryllupet ble shot helga 15.-16. juni
- Han har 4 CFexpress-kort med totalt 320 RAW-filer + 1500 JPEGer
- Bryllupet er backup'et via One Desk → B2 mandag morgen

### Steg-for-steg

**Mandag 09:00 — Backup ferdig**

Fredrik åpner One Desk. Backup-økten fra mandag morgen viser
`✓ 1820 filer · 142 GB · alle verifisert`. Han klikker «Rapport» og
ser per-kamera-sammendrag (Canon R5, Sony A7IV). Lukker rapporten.

**Mandag 09:30 — Velger ut leveranse**

Fredrik åpner prosjektet «Frida & Magnus 2026» på creatorhubn.com. I
prosjekt-detalj-siden ser han:

> 📦 **Ekstern backup (offsite)**
> Backblaze-konto «Hovedkonto» · bucket `creatorhub-fredrik-archive`
> ✓ 1820 filer i arkiv (142 GB)
>
> [📤 Lever til klient]  [🔍 Vis arkivinnhold]

Han klikker **Lever til klient**.

**Mandag 09:32 — File-picker**

En dialog åpnes. Backend kaller `archive-files`-endpoint og viser
fil-listen gruppert per kamera, med thumbnails (signed B2-URL,
direkte vist via Cloudflare-cache):

```
Canon R5 (1820 filer · 142 GB)
  ☐ Alle JPEG-er (1500)
  ☐ Velg manuelt...
  ☐ Bare 5-stjerners (210)  ← hvis Lightroom-tagging er sync'et
  
Sony A7IV (320 filer · 12 GB)
  ☐ Alle RAW-er (320)
  ☐ Alle JPEG-er (320)
```

Fredrik velger «Alle JPEG-er (1500)». Total leveranse: 1500 filer ·
~38 GB.

Han fyller inn:
- Klient: «Frida og Magnus Henriksen»
- E-post: `frida.henriksen@gmail.com`
- Galleri-navn: «Frida & Magnus — 15. juni 2026»

Klikker **Send**.

**Mandag 09:33 — Backend behandler**

Backend:
1. Verifiserer Fredrik eier prosjektet
2. Oppretter `photographer_client_galleries`-rad med `gallery_settings.
   ditProjectId = proj_frida_magnus_2026`
3. For hver av de 1500 filene: insert `client_gallery_images` med
   `image_metadata.b2Source = { providerId, bucketId, fileName, sha1 }`
4. Returnerer `{ gallery_id, access_token: 'gly_a3b9...', count: 1500 }`

**Mandag 09:34 — Sender til klient**

UI viser:
```
✓ Galleri opprettet
   1500 filer · 38 GB
   Tilgangs-lenke: https://creatorhubn.com/gallery/gly_a3b9z3f8x4q2

[📧 Send e-post til Frida]   [📋 Kopier lenke]   [✏️ Tilpass]
```

Fredrik klikker «Send e-post». E-post går til Frida med signed-link.

**Mandag 14:00 — Frida åpner galleriet**

Frida klikker lenken. Browser loader `/gallery/gly_a3b9...`. Frontend
kaller backend og får tilbake en liste av items. Hver `image_url` ser
slik ut:

```
/api/showcase/cdn/gly_a3b9z3f8x4q2/itm_8x3z9
```

Browser laster første tumbnail. Request går til Cloudflare Worker:

1. Worker leser gallery-token + item-id fra URL
2. Worker spør backend: «Er token gyldig? Hva er signed B2-URL?»
3. Backend slår opp item, dekrypterer Fredriks B2-creds (samme keyring
   som Google-tokenene), kaller `b2_get_download_authorization` med
   TTL 1 time
4. Backend returnerer signed B2-URL til Worker
5. Worker fetcher fra B2 — **gratis via Bandwidth Alliance**
6. Worker returnerer respons med `Cache-Control: public, max-age=2592000`
   (30 dager)
7. Cloudflare CDN cacher

**Mandag 14:00 til 16:30 — Frida ser 1500 bilder**

Hver fil hentes maks én gang fra B2 (deretter cache). Ingen
egress-kost for Fredrik.

**Onsdag 15:00 — Magnus deler lenken**

Magnus videresender e-posten til 50 venner. De 50 + Frida + Magnus =
52 visninger over de neste 3 dagene. Hver fil cachet etter første
visning. **B2-egress: 0 kr** (alt fra Cloudflare-cache).

**Tre måneder senere — klient ber om sletting**

Frida sender mail: «Vi har skilt oss. Slett alle bilder.» Fredrik går
til prosjekt-settings, finner GDPR-panelet, skriver «Frida & Magnus —
15. juni 2026» for å bekrefte, og klikker «Slett permanent». Backend:

1. Itererer `dit_backup_jobs` for prosjektet
2. Kaller `b2_delete_file_version` på hver fil (1820 stk)
3. Sletter `photographer_client_galleries`-raden + alle
   `client_gallery_images` (1500 stk) i samme transaksjon
4. Logger 1820 + 1500 = 3320 audit-rader i `gdpr_deletion_audit`
5. Returnerer `{ deleted: 1820, showcase_galleries_deleted: 1, total: 1820 }`

Cloudflare CDN-cache fortsetter å returnere 200 OK i 30 dager — men
Worker kan ikke fetche nye filer (de finnes ikke i B2 lenger), så
alle cache-misses returnerer 404. Etter 30 dager er cachen tom.

Fredrik svarer Frida samme dag: «Alt er slettet. Bekreftet i vår
audit-logg.»

## Tekniske beslutninger

### Hvorfor TTL 1 time på signed B2-URL?

Cloudflare-cachen er 30 dager. Workeren spør backend for ny signed-URL
ved hver cache-miss. Bruker-tilgangs-token (`gly_...`) er det som
egentlig kontrollerer adgang, så B2-URL-TTL trenger ikke være lang.

### Hvorfor stream-through i Workeren istedenfor 302-redirect?

302-redirect ville sendt klienten direkte til B2. Det ville:
1. Lekke B2-URL-en (kan kopieres + delt)
2. Hoppet over Cloudflare-cachen — egress fra B2 ved hver visning
3. Mistet kontroll over rate-limiting

Stream-through holder B2-URL skjult og lar Cloudflare cache.

### Hvorfor ikke direkte showcase_items-modellen?

`photographer_client_galleries`-modellen har innebygd:
- Access-token-rotering
- Klient-info (navn, e-post)
- Galleri-utløp
- Cleaned-image-tracking (slice 6)

Reuse er billigere enn å bygge parallell modell.

## Risiko og mitigering

| Risiko | Sannsynlighet | Mitigering |
|---|---|---|
| Cloudflare Bandwidth Alliance-avtale endres | Lav (4+ år stabil) | Fall-back til R2-bridge hvis avtale ryker |
| Fotograf revokerer B2-creds → cached items + nye galleri-views feiler | Medium | Worker returnerer brukervennlig feilmelding + e-post til fotograf |
| Stort galleri (>10000 filer) — gallery-list-laster blir treg | Medium | Paginer client_gallery_images, render thumbnails lazy |
| B2 viral album med 100k visninger på 1 dag — DDoS-risiko | Lav | Worker rate-limiter per gallery-token |
| Klient laster ned alt RAW (>100 MB per fil) | Høy | Vi viser kun JPEG i preview; RAW-download krever ekstra klikk + advarsel |

## Open questions

- [ ] Skal vi tilby transcoding (CR3 → JPEG) for klienter som vil ha
      web-viewable filer? Ville kreve sharp eller server-side ImageMagick.
      **Foreslått:** v2. v1 leverer det som er web-viewable (JPEG, PNG,
      HEIC); RAW-er filtreres ut fra picker.
- [ ] Skal galleriet ha en utløpsdato eller bestå inntil sletting?
      **Foreslått:** 60 dager default, kan utvides per galleri.
- [ ] Skal klient kunne laste ned alt som zip?
      **Foreslått:** Ja, men zip genereres just-in-time av Worker
      (stream-zip via `archive`-lib).

## Endringslogg

- 2026-06-04: Initial plan. Cloudflare-fronted B2 valgt over pure-B2
  pga egress-kost ved viral spredning.
