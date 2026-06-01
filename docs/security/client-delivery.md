# Klient-leveranse av krypterte filer

Hvordan klienter (brudepar, eventkunder) får dekrypterte filer uten å logge inn på CreatorHub. Bygger på det **eksisterende** `photographer_client_galleries`-systemet og envelope-encryption.

> Dette systemet erstatter ingenting — det er en utvidelse av det som allerede fantes. Klient-flow-en (frontend `client-gallery.tsx`, alle 27 eksisterende API-endepunkter, kommentarer, favoritter, print, Stripe, video-timecodes) fungerer som før. Den eneste forskjellen: krypterte chunked-uploads kan nå brukes som gallery-bilder.

---

## Eksisterende auth-modell (uendret)

```
photographer_client_galleries
├── access_token (43-char random)
├── gallery_settings.requiresPassword? + passwordHash
├── gallery_settings.expiresAt
└── client_gallery_images[] (bilder i galleriet)
```

Klient klikker `creatorhubn.com/client/gallery/<accessToken>` → ser galleri uten å logge inn.

Hvis passordbeskyttet: blir bedt om passord først.
Hvis utløpt: 410 Gone.

---

## Nytt: chunked-upload-bilder

Et `client_gallery_images`-rad kan nå ha `image_metadata.chunkedUploadId` som peker til en chunked-upload. Når den er satt, behandles bildet som encrypted-at-rest hvis `chunked_uploads.metadata.encryptedAtRest === true`.

### `image_metadata`-utvidelse

```json
{
  "chunkedUploadId": "abc-123-uuid",
  "encryptedAtRest": true,
  "attachedBy": "photographer-user-id",
  "attachedAt": "2026-06-01T..."
}
```

Eksisterende felter (`captureAssetId`, `useAutoCleaned`, etc.) påvirkes ikke.

### URL-bygging

`client-gallery-render.ts:listClientGalleryImages` sjekker `imageMetadata.chunkedUploadId`:

- **Hvis satt**: `thumbnailUrl` og `fullSizeUrl` settes til `/api/client/gallery/<accessToken>/files/<imageId>/download` (vårt nye decrypt-proxy-endepunkt)
- **Hvis ikke satt**: eksisterende oppførsel (re-sign R2 fra `captureAssetId`, eller bruk lagret URL)

Klient-siden trenger ikke vite at noe er kryptert — den ser bare en HTTP-URL som returnerer plaintext JPEG.

---

## Nye endepunkter

### `GET /api/client/gallery/:accessToken/files/:imageId/download`

Token-gated decrypt-proxy. Validerer accessToken via samme `gateGalleryAccess`-helper som `/images` (passordbeskyttelse + expiration), slår opp `client_gallery_images.image_metadata.chunkedUploadId`, joiner til `chunked_uploads`, og:

| Backend | Handling |
|---|---|
| `cloudflare_stream` | 409 `video_in_stream` — Stream-videoer kan ikke lastes ned som filer (Cloudflare må kunne lese for transcoding) |
| `r2` + krypter | GetObjectCommand → DecryptStream → response |
| `r2` + ukrypter | GetObjectCommand → response |
| `filesystem` + krypter | createReadStream → DecryptStream → response |
| `filesystem` + ukrypter | createReadStream → response |

Defense-in-depth: sjekker også at `chunked_uploads.user_id === gallery.photographer_id` så ingen kan tukle `image_metadata` for å peke til andres filer.

### `POST /api/client/gallery/:galleryId/attach-uploads`

Owner-only (krever session). Knytter chunked-uploads til et eksisterende galleri som bilder.

```ts
POST /api/client/gallery/<galleryId>/attach-uploads
{
  "fileIds": ["abc-123", "def-456", ...],
  "titles": ["DSC_0001", "DSC_0002", ...]   // valgfritt, default = file_name
}
```

- Verifiserer at galleriet tilhører innlogget bruker
- Verifiserer eierskap på alle `fileIds`
- Inserterer `client_gallery_images`-rader med `image_metadata.chunkedUploadId = fileId, encryptedAtRest = true`
- Returnerer `{ added, skipped, imageIds }`

---

## Komplett flyt: Simmen leverer 800 krypterte bryllupsbilder

```
1. Simmen laster opp 800 JPEG via /api/chunked-upload/* med
   metadata.encryptAtRest = true
   ↓
   chunked_uploads-rader får encryptedAtRest=true, encryptedDek lagret i metadata

2. Simmen oppretter et galleri via eksisterende UI eller API:
   POST /api/photographer/galleries → får { id, accessToken }
   (samme flyt som før)

3. Simmen kaller den nye attach-endepunktet:
   POST /api/client/gallery/<galleryId>/attach-uploads
   { fileIds: [800 fileIds] }
   ↓
   800 client_gallery_images-rader opprettes med chunkedUploadId-metadata

4. Simmen sender Anna lenken: creatorhubn.com/client/gallery/<accessToken>

5. Anna åpner lenken (eksisterende UI, ingen endring):
   ↓
   Frontend kaller GET /api/client/gallery/<accessToken>
   → returnerer gallery-metadata
   ↓
   Frontend kaller GET /api/client/gallery/<accessToken>/images
   → returnerer 800 bilder med thumbnailUrl/fullSizeUrl pekt på vårt
     /files/<imageId>/download-endepunkt

6. Anna ser thumbnail-grid (samme som alltid):
   ↓
   Browser laster hvert thumbnail via /files/<imageId>/download
   → backend dekrypterer og piper plaintext JPEG til browseren
   ↓
   Anna ser bildene helt vanlig

7. Anna kan favoritte, kommentere, kjøpe ekstra (alle eksisterende funksjoner
   uberørt — chunkedUploadId-metadata gjør ingen forskjell der)

8. Anna klikker "Last ned alle" (eksisterende UI om implementert,
   eller per-fil-nedlasting via samme decrypt-endepunkt)
```

Anna ser ALDRI ciphertext. Hun ser ikke at noe er kryptert. Hun trenger ikke logge inn.

---

## Hva som forsvant fra parallell-systemet

Tidligere bygget jeg `gallery_magic_links`-tabell + dedikert routes + frontend-flow. Det var duplikat — det eksisterende `photographer_client_galleries`-systemet gjør det samme + mer. Slettet:

- `backend/migrations/221_gallery_magic_links.sql`
- `backend/server/gallery-magic-link-service.ts`
- `backend/server/gallery-magic-link-routes.ts`
- `docs/security/client-magic-link-delivery.md`

Funksjoner som ble flyttet til eksisterende system:

| Tidligere | Nå |
|---|---|
| Token-validering | `gateGalleryAccess(accessToken, password)` (eksisterende) |
| Expiration | `gallery_settings.expiresAt` (eksisterende) |
| Audit | `gallery_download_audit` (eksisterende) |
| File-bundle | `client_gallery_images` med `chunkedUploadId` (utvidelse) |
| Public file-serving | `GET /api/client/gallery/:token/files/:imageId/download` (NY) |
| Owner: opprett bundle | Eksisterende gallery-opprettelse + ny attach-endepunkt (NY) |

ZIP-nedlasting + per-fil-quota-tracker som mitt parallel-system hadde, kan reimplementeres som utvidelse av eksisterende client-gallery hvis behov.

---

## Forutsetninger

- Migrasjon 216 (`chunked_uploads`) må være kjørt
- `STORAGE_MASTER_KEK_HEX` må være satt i env (allerede satt på Render)
- Eksisterende `photographer_client_galleries`-tabell er allerede der

Ingen ny migrasjon kreves — `client_gallery_images.image_metadata` er allerede JSONB og kan ta `chunkedUploadId`-feltet uten schema-endring.

---

## Test-cases

### Round-trip

```
1. Last opp en JPEG med encryptAtRest=true → få fileId
2. Opprett et nytt galleri eller bruk eksisterende: få accessToken
3. POST /api/client/gallery/<galleryId>/attach-uploads med fileIds=[<fileId>]
4. GET /api/client/gallery/<accessToken>/images
   → verifiser at bildet har fullSizeUrl pekt på .../files/<imageId>/download
5. GET den URL-en
   → verifiser at bytes er identiske med originalen (SHA-256 sammenligning)
```

### Owner-tampering forsøk

```
1. Bruker A laster opp en fil → får fileId
2. Bruker B opprettet et galleri og legger til en uskyldig fil
3. Bruker B prøver å manuelt UPDATE-e client_gallery_images.image_metadata
   til { chunkedUploadId: <A sin fileId> }
4. Klient GET .../files/<imageId>/download
   → 403 owner_mismatch (defense-in-depth: chunked_uploads.user_id matcher
     ikke gallery.photographer_id)
```

### Manglende master-KEK

```
1. Krypter fil + attach til galleri
2. Restart backend uten STORAGE_MASTER_KEK_HEX
3. Klient GET .../files/<imageId>/download
   → 503 encryption_key_missing
```

### Stream-video

```
1. Last opp en .mp4 (uten encryptAtRest — havner i Stream)
2. Manuelt attach til galleri via attach-endpoint
3. Klient GET .../files/<imageId>/download
   → 409 video_in_stream + forklaring
```
