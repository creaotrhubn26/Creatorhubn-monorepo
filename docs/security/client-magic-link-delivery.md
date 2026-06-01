# Klient-leveranse via magic-link

Hvordan klienter (brudepar, eventkunder) får dekrypterte filer uten å logge inn på CreatorHub. Token-basert tilgang med innebygd revoke, throttling og audit.

> Bygget i forlengelse av envelope-encryption-systemet ([envelope-encryption.md](envelope-encryption.md)). Lenken jobber sammen med encryptAtRest-flagget for sensitive filer.

---

## Hvorfor magic-link?

Brudepar vil ikke opprette en CreatorHub-konto bare for å hente bryllupsbildene sine. Vi gir dem en signert, tidsbegrenset URL som grants tilgang til **akkurat de filene** fotografen valgte.

Sammenligning med vanlig auth:

| Metode | Klient-flyt | Sikkerhet | Ulempe |
|---|---|---|---|
| Logg inn | Opprett konto → bekreft e-post → logg inn → finn galleri | Sterk | Friction, mange dropper av |
| **Magic-link** | Klikk lenke → se galleri | Token = 256 bits entropy, expires, revokable | Hvis lenken lekker, kan andre se i utløps-vinduet |
| Public link | Klikk lenke → se galleri | Ingen | Hvem som helst kan se hvis lenken indekseres |

Magic-link er sweet-spot: god nok sikkerhet for de fleste bryllups-/event-leveranser, null friksjon for kunden.

---

## Token-format

```
token = base64-url(randomBytes(32))  // 43 tegn etter strip av padding
```

- 256 bits entropi → praktisk umulig å gjette
- url-safe base64 (uten `+`, `/`, `=`) — kan limes inn i e-post uten problemer
- Konstant-tid sammenligning ved validering (`timingSafeEqual`) for å unngå timing-angrep

Eksempel-URL:

```
https://creatorhubn.com/api/gallery/m/PdK8x_3Ymq-fGV4nLp2_zRwHTbN5LqA9Cv6sj1Wm0jE
```

---

## Endepunkter

### Public (ingen login, kun token)

```
GET /api/gallery/m/:token
GET /api/gallery/m/:token/files/:fileId
GET /api/gallery/m/:token/zip
```

### Owner/Admin (krever login)

```
POST /api/gallery/magic-links              — opprett ny
GET  /api/gallery/magic-links              — list mine
GET  /api/gallery/magic-links/:id          — detaljer + audit-trail
POST /api/gallery/magic-links/:id/revoke   — kansellere
```

---

## Opprette en lenke (fotograf-flyt)

```ts
const res = await fetch('/api/gallery/magic-links', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileIds: ['abc-123', 'def-456', ...],   // chunked_uploads.final_file_id-er
    galleryName: 'Anna & Ole — 15. mai 2026',
    recipientLabel: 'Anna & Ole',
    recipientEmail: 'anna.ole@example.com',
    message: 'Her er bildene fra bryllupet! Klikk hver fil for å laste ned, eller bruk "Last ned alle" for ZIP.',
    expiresInDays: 30,
    maxDownloads: 200,        // null = ubegrenset; default null
    maxZipDownloads: 3,       // default 5
  }),
});
const { shareUrl, expiresAt } = await res.json();
// → send shareUrl til Anna & Ole via e-post
```

Backend validerer at alle `fileIds` tilhører innlogget bruker — du kan **ikke** opprette en lenke til andres filer.

---

## Klient-opplevelsen (Anna & Ole)

```
Anna klikker lenken
        │
        ↓
Browser → GET /api/gallery/m/:token (manifest)
        │
        ↓
Response:
{
  galleryName: "Anna & Ole — 15. mai 2026",
  message: "Her er bildene...",
  expiresAt: "2026-06-30T...",
  downloadsRemaining: 200,
  files: [
    {
      fileId: "abc-123",
      fileName: "DSC_0001.jpg",
      mimeType: "image/jpeg",
      size: 8421000,
      isEncrypted: true,
      deliveryMode: "download",
      downloadUrl: "https://creatorhubn.com/api/gallery/m/PdK8.../files/abc-123"
    },
    ... 799 more
  ],
  zipUrl: "https://creatorhubn.com/api/gallery/m/PdK8.../zip"
}
        │
        ↓
Galleri-UI render thumbnails (genereres ved at de henter samme endepunkt
men med thumbnail-flagget, OR vi får dem fra metadata)
        │
        ↓
Anna klikker enten en enkelt fil eller "Last ned alle"
        │
        ├── enkelt fil: GET /files/:fileId
        │       │
        │       ↓
        │   Backend → validate token → fetch from R2/disk →
        │   decrypt (envelope) → pipe to response
        │       │
        │       ↓
        │   Anna får en helt vanlig JPEG. Klikk: "Lagre som" eller åpne i Forhåndsvisning
        │
        └── ZIP: GET /zip
                │
                ↓
            Backend → archiver streams →
              for hver fil: decrypt → append til ZIP →
              klient ser nedlasting bygges opp i sanntid
                │
                ↓
            Anna får én ZIP med 800 dekrypterte JPEG-er
```

**Anna ser ALDRI ciphertext.** Encryption er usynlig på klient-siden.

---

## Sikkerhetslag

### Lag 1: Token-entropi

256 bits er praktisk umulig å gjette. Brute-force ville krevd 2^256 forsøk — flere atomer enn det er i det observerbare universet.

### Lag 2: Konstant-tid sammenligning

Selv SQL-equality er kjapp, men `timingSafeEqual` legger til defense-in-depth mot timing-angrep i fremtidige cache-lag.

### Lag 3: expires_at

Hard cap på TTL. Hvis ingen oppgir `expiresInDays`: default 14 dager. Maks: 365 dager. Selv hvis Anna deler lenken med hele Facebook-vennelista, slutter den å fungere etter utløp.

### Lag 4: max_downloads

Cap på antall enkeltfil-nedlastinger totalt. Lekket lenke som brukes 200 ganger → låses automatisk.

### Lag 5: max_zip_downloads (default 5)

Lavere cap på ZIP-nedlasting fordi den er kostbar (bandwidth + CPU). Forhindrer at en lekkende lenke blir hammered av scrapers.

### Lag 6: revoked_at

Fotografen kan kansellere lenken når som helst (f.eks. hvis kunden klager på at en bryllups-gjest fikk tilgang). Ingen restart kreves — neste request får 410 Gone.

### Lag 7: Per-IP rate-limiting

In-memory bucket: 30 requests per IP per minutt. Default — kan tunes via env. Defense-in-depth mot script-kiddies.

### Lag 8: Eier-validering ved opprettelse

Backend sjekker at **alle** `fileIds` tilhører innlogget bruker. Du kan ikke lage en lenke til andres filer ved å gjette deres `fileId`-er.

### Lag 9: Audit-trail på alle accesses

Hver request — success eller failure — havner i `gallery_magic_link_access` med IP, user-agent, referer, outcome, bytes_served. Forensisk søkbart:

```sql
-- "Hvem hentet hva via Anna & Oles lenke?"
SELECT ip, file_id, outcome, created_at
  FROM gallery_magic_link_access
 WHERE link_id = '...'
 ORDER BY created_at DESC;

-- "Mistenkelig aktivitet siste 24t?"
SELECT ip, COUNT(*), COUNT(DISTINCT file_id)
  FROM gallery_magic_link_access
 WHERE link_id = '...' AND created_at > NOW() - INTERVAL '24 hours'
 GROUP BY ip
 ORDER BY COUNT(*) DESC;
```

---

## Edge-cases

### Video-filer

Stream-backed videoer kan **ikke** lastes ned via magic-link — Cloudflare må kunne lese dem for streaming, og det er en separat playback-modell.

- Manifest-respons setter `deliveryMode: "stream"` på dem
- Single-file-endepunktet returnerer 409 hvis du prøver å GET en Stream-video
- ZIP-endepunktet hopper over Stream-videoer og legger en `VIDEOER_README.txt` med forklaring

**Hvis kunden trenger MP4-fila**: last opp videoen med `encryptAtRest: true` → tvinger til R2 → magic-link kan dekryptere og levere den.

### Filer som ikke lenger finnes

Hvis en fil i bundle har blitt slettet eller corrupted: manifest skipper den stille, single-file-endepunktet returnerer 404, ZIP hopper over og legger feilen i audit.

### Master-KEK utilgjengelig

Hvis Render har glemt eller mistet `STORAGE_MASTER_KEK_HEX`: magic-link til krypterte filer returnerer 503 "encryption_key_missing". Ikke-krypterte filer fungerer fortsatt.

### Klient bak corporate-NAT

Per-IP rate-limit kan ramme klienter bak shared IP (corporate firewall, mobil-4G). Default 30/min er konservativt høyt for normal nettleser-bruk. Kan tunes via env.

### "Klient sender lenken til en venn"

Det er det maks_downloads og audit-trailen er for. Hvis 50 forskjellige IP-er begynner å treffe samme lenke: audit-rapporten fanger det opp, fotografen kan revoke, ny lenke kan opprettes.

---

## Sammenligning: med vs uten magic-link

### Uten magic-link (gammel flyt)

```
Fotograf: "Anna, du må opprette en CreatorHub-konto"
Anna: 😐
Anna går aldri inn → bildene ligger ubrukt i 30 dager
```

### Med magic-link (ny flyt)

```
Fotograf opprettet lenke via Admin UI eller API
        │
        ↓
Fotograf e-poster lenken til Anna
        │
        ↓
Anna klikker, ser galleri, laster ned ZIP
        │
        ↓
Fotograf ser i audit-trail at lenken er brukt
        │
        ↓
30 dager senere: lenken utløper automatisk → ingen ekstra opprydning
```

---

## Hva som IKKE er dekket

- **Email-utsending** av lenken: ikke implementert. Fotograf kopierer URL-en fra opprett-respons og limer inn i sitt eget e-postverktøy. Kan automatiseres senere via Resend/SendGrid.

- **Klient kan slette filer**: lenken er read-only. For "klient-godkjenning" / "favoritter" trengs et annet, mer kompleks flow.

- **Klient kan kommentere på bilder**: ikke implementert. Hvis det er ønskelig, kan vi legge til en `gallery_magic_link_comments`-tabell med samme audit-modell.

- **Watermark/proof-mode** for forhåndsvisning vs endelig leveranse: ikke implementert. Sender alltid full plaintext. For watermarked previews kan vi enten generere lavoppløsnings-thumbnails ved upload, eller proxy-rendere på request.

- **Forrige-/neste-navigasjon** i galleri-UI: backend leverer kun bytes. UI-en på toppen er ikke en del av denne PR-en.

---

## Test-cases (manuelt)

### Round-trip-test

```
1. Last opp 3 JPEG-er med encryptAtRest=true (Postman → /api/chunked-upload/*)
2. POST /api/gallery/magic-links med de 3 fileIds → få shareUrl
3. Åpne shareUrl i en inkognito-vindu (ingen session)
4. Verifiser at manifest viser 3 filer
5. GET én av downloadUrl-ene → verifiser at filinnholdet er identisk med
   originalen (SHA-256 sammenligning)
6. GET zipUrl → unzip → verifiser at alle 3 filer er gyldige JPEG-er
```

### Expiry-test

```
1. Opprett magic-link med expiresInDays=0.001 (ca 1.5 minutter)
2. Vent
3. GET /api/gallery/m/:token → forventet 410 "expired"
4. Sjekk gallery_magic_link_access — én rad med outcome='expired'
```

### Revoke-test

```
1. Opprett magic-link
2. Klikk lenken → fungerer
3. POST /api/gallery/magic-links/:id/revoke
4. Klikk lenken igjen → 410 "revoked"
```

### Quota-test

```
1. Opprett magic-link med maxDownloads=2
2. GET filer 3 ganger
3. Tredje gang → 410 "over_quota"
```

### Eier-sjekk-test

```
1. Logg inn som Bruker A
2. POST /api/gallery/magic-links med fileIds som tilhører Bruker B
3. Forventet: 403 file_not_owned med listen over manglende IDs
```

### Video-test

```
1. Last opp en .mp4 (uten encryptAtRest — havner i Cloudflare Stream)
2. Inkluder fileId i magic-link bundle
3. Manifest viser deliveryMode="stream"
4. GET file-URL → 409 video_in_stream
5. ZIP → README inkluderer "1 video hoppet over"
```

---

## Drift

### Cleanup av eldre rader

`gallery_magic_links` med `expires_at < NOW() - INTERVAL '90 days'` kan slettes for å holde tabellen liten. `gallery_magic_link_access` har CASCADE ON DELETE — audit forsvinner med lenken.

Anbefales: cron-jobb hver natt som sletter rader eldre enn 90 dager etter utløp. Ikke implementert ennå.

### Monitoring

Spørringer som er verdt å sette på en dashboard:

```sql
-- Aktive lenker per fotograf (siste 30 dager)
SELECT owner_user_id, COUNT(*)
  FROM gallery_magic_links
 WHERE created_at > NOW() - INTERVAL '30 days'
   AND revoked_at IS NULL
   AND expires_at > NOW()
 GROUP BY owner_user_id;

-- Mistenkelig aktivitet: lenker med >10 forskjellige IP-er siste uka
SELECT l.id, l.gallery_name, COUNT(DISTINCT a.ip) AS distinct_ips
  FROM gallery_magic_links l
  JOIN gallery_magic_link_access a ON a.link_id = l.id
 WHERE a.created_at > NOW() - INTERVAL '7 days'
 GROUP BY l.id, l.gallery_name
HAVING COUNT(DISTINCT a.ip) > 10
 ORDER BY distinct_ips DESC;
```
