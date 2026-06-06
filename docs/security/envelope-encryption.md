# Envelope encryption for filer ved hvile

Hvordan CreatorHub krypterer filer ved hvile (at-rest) for sensitive opplastinger, og hvordan systemet er designet for å overleve realistiske brudd-scenarier.

> **Status**: Implementert per 2026-05-31. Opt-in per opplasting via `metadata.encryptAtRest: true`. Default av (bakoverkompatibel).

---

## Threat-model

Hva vi prøver å beskytte mot, og hva vi ikke prøver:

| Trussel | Dekket? | Forklaring |
|---|---|---|
| Backend-RCE der angriper får R2-nøkler + DB-dump | ✅ Ja | Angriper får ciphertext + krypterte DEK-er, men ikke master-KEK. Render-secret-store er adskilt fra filsystem |
| R2-bucket misconfig (offentlig tilgjengelig) | ✅ Ja | Angriper får kun ciphertext fra R2 — ubrukelig uten DEK |
| DB-dump fra dårlig backup-hygiene | ✅ Ja | Encrypted-DEK-er fra DB krever master-KEK for å åpne |
| Full server-takeover (env + DB + R2) | ❌ Nei | Hvis angriper får ALLE tre, kan de dekryptere alt. Mitigering: bruk dedikert KMS (Hashicorp Vault, AWS KMS) for master-KEK |
| Side-channel-angrep på crypto-implementasjonen | ❌ Nei | Bruker Node `crypto`-modulen — generelt trygt mot timing-angrep, men ikke garantert |
| Klient-side credential-tyveri (XSS, malware) | ❌ Nei | Angriper logger inn som brukeren og henter dekryptert innhold via normalt flow |
| Cloudflare-side breach | Delvis | Stream-videoer er ikke envelope-kryptert (Cloudflare må kunne lese for transcoding). R2 har at-rest encryption på Cloudflares side i tillegg til vår |

---

## Arkitektur

### Nøkkel-hierarki

```
master KEK (env STORAGE_MASTER_KEK_HEX, 32 bytes)
   │
   ├── HKDF(salt=sha256(userId), info="creatorhub-file-encryption-v1")
   │   │
   │   └── per-bruker KEK (32 bytes, aldri lagret)
   │       │
   │       ├── AES-256-GCM
   │       │   │
   │       │   └── encrypts/decrypts DEK
   │       │
   │       └── (én KEK per bruker — alle brukerens DEK-er beskyttes av samme)
   │
   └── (én master-KEK per CreatorHub-instans)


per-fil DEK (32 bytes, generert tilfeldig per upload)
   │
   ├── AES-256-GCM (m/ unik IV per upload)
   │   │
   │   └── encrypts/decrypts file bytes
   │
   └── (én DEK per fil — kompromitterer ikke andre filer)
```

### Hvorfor envelope-encryption?

- **DEK-rotering** = re-krypter ett ~80-byte ciphertext, ikke hele den 80GB-store RAW-fila
- **Begrenset blast radius**: kompromittert DEK → kun den ene fila lekker
- **Skalérbart**: KMS-systemer (AWS KMS, GCP KMS, Cloudflare Workers KV) bruker samme mønster
- **Standard**: SSE-C, BYOK, alle moderne object-stores bruker envelope

### Ciphertext-format

```
[iv: 12 bytes][ciphertext: N bytes][auth tag: 16 bytes]
```

- `iv`: tilfeldig per fil (96 bits er anbefalt for AES-GCM)
- `auth tag`: AES-GCM integritetssjekk, beregnes etter siste byte er kryptert
- Vi lagrer eksakt `ciphertextSize = N + 28` i `chunked_uploads.metadata.ciphertextSize` slik at `DecryptStream` vet hvor auth-tag-en starter (den må splittes ut før resten kan dekrypteres)

---

## Implementasjon

### Backend-moduler

| Fil | Ansvar |
|---|---|
| `backend/server/file-encryption.ts` | Crypto-primitiver: `getMasterKek`, `deriveUserKek` (HKDF), `generateDek`, `encryptDek`/`decryptDek`, `EncryptStream`/`DecryptStream` (AES-256-GCM, streaming) |
| `backend/server/upload-storage-router.ts` | Tar `encryptAtRest: true` i input; krypterer til temp-fil før R2/filesystem-write; returnerer `encryptedDek` + `ciphertextSize` i metadata |
| `backend/server/chunked-upload-routes.ts` | Leser `metadata.encryptAtRest` fra init-payload; persisterer encryption-metadata på finish; pipe-dekrypterer ved download (ingen R2-redirect for krypterte filer) |

### Storage-router-flow (encrypt path)

```
init                                  finish
─────────                            ─────────
client → POST /init                  chunked file complete (alle chunks mottatt)
metadata: { encryptAtRest: true }     │
                                      ↓
chunked_uploads.metadata             routeAssembledUpload({ encryptAtRest: true })
saves encryptAtRest=true              │
                                      ↓
                                     generateDek() → 32 bytes random
                                      │
                                      ↓
                                     deriveUserKek(userId) → HKDF(masterKek, userId)
                                      │
                                      ↓
                                     encryptDek(dek, userKek) → base64
                                      │
                                      ↓
                                     EncryptStream pipes plaintext → ciphertext temp-fil
                                      │
                                      ↓
                                     R2 PutObject(ciphertext, ContentLength=ct.size)
                                     metadata: { encrypted-at-rest: aes-256-gcm }
                                      │
                                      ↓
                                     chunked_uploads.metadata.encryptedDek = base64
                                     chunked_uploads.metadata.ciphertextSize = N+28
                                     chunked_uploads.metadata.encryptedAtRest = true
```

### Download-flow

```
GET /api/chunked-upload/files/:fileId
   │
   ↓
DB lookup → row.metadata.encryptedAtRest === true?
   │
   ├─ false → vanlig flow (R2 redirect eller filesystem pipe)
   │
   └─ true →
       │
       ↓
      isEncryptionAvailable()? hvis nei → 503
       │
       ↓
      deriveUserKek(userId)
       │
       ↓
      decryptDek(metadata.encryptedDek, userKek) → DEK
       │
       ↓
      ┌── R2: GetObjectCommand → stream ─┐
      │                                   │
      │                                   ↓
      │                       DecryptStream(dek, ciphertextSize)
      │                                   │
      │                                   ↓
      │                                   res
      │
      └── filesystem: createReadStream(fullPath) → DecryptStream → res
```

Hovedforskjell: for krypterte filer er det **ingen 302 redirect til R2**. Bytes må passere gjennom backend slik at `DecryptStream` kan rive auth-tag og lage plaintext. Bandwidth-kost: ~+1 round-trip-ekvivalent per request, men det er prisen for at angriper med kun R2-nøkler ikke får noe brukbart.

---

## Konfigurering

### Generere master-KEK

```bash
# Generér 32 bytes / 256 bits / 64 hex tegn
openssl rand -hex 32
```

### Sett i Render env

```
STORAGE_MASTER_KEK_HEX=<64-hex-char-string>
```

Ikke commit denne. Ikke logg den. Hvis du må rotere: se "Master-key-rotering" nedenfor.

### Aktiver encryption per upload

Klient/backend sender `encryptAtRest: true` i `metadata` ved chunked-upload init:

```ts
await fetch('/api/chunked-upload/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: 'sensitive.psd',
    fileSize: 100_000_000,
    chunkSize: 5 * 1024 * 1024,
    totalChunks: 20,
    metadata: {
      projectId: 'proj-123',
      encryptAtRest: true,  // ← opt-in
    },
  }),
});
```

Når `encryptAtRest: true` er satt:
- Video-filer blokkeres (Stream tillates ikke — Cloudflare må kunne lese for transcoding)
- Routing tvinger R2 eller filesystem
- Hver byte krypteres med en fersk per-fil DEK

---

## Master-key-rotering

Master-KEK-rotering er kompleks fordi alle eksisterende encryptedDek-er er bundet til den gamle KEK-en. Strategier:

### Option 1: Hard cutover (enklest, ikke recommended for stort dataset)

1. Stopp opplastinger midlertidig
2. Skript: les alle encryptedDek fra DB, dekrypter med gammel KEK, re-krypter med ny KEK, lagre tilbake
3. Bytt env-var → restart

**Trade-off**: krever nedetid, og hvis skriptet feiler halvveis er DB-en i en uklar tilstand.

### Option 2: Versjonert KEK (recommended, ikke implementert ennå)

Utvid `encryptedDek`-format til `<version>:<base64>` og lagre flere KEK-er i env (`STORAGE_MASTER_KEK_HEX_V1`, `STORAGE_MASTER_KEK_HEX_V2`). Ved dekryptering: bruk versjonen som ble lagret. Ved nye uploads: bruk siste versjon. Gradvis bakgrunns-job re-krypterer DEKs til nyeste versjon.

**Trade-off**: mer kompleksitet, men null nedetid.

### Option 3: Migrer til KMS (recommended for prod)

Bytt fra env-var til Cloudflare Workers KV, Hashicorp Vault, eller AWS KMS. Disse støtter atomisk rotasjon på master-key-nivå. Krever større arkitektur-endring.

---

## Recovery-strategier

### Hvis master-KEK lekkes

1. Generér ny master-KEK
2. Følg "Versjonert KEK"-strategien — IKKE bare bytt env-var (eksisterende filer blir uleselige)
3. Rotér også alle stripe-/cloudflare-/render-nøkler i samme runde (defense-in-depth)

### Hvis bruker mister tilgang permanent

Brukerens DEK-er er kryptert med deres KEK (derivert fra `userId`). Så lenge `userId` finnes i DB og master-KEK er den samme, kan en admin teoretisk gjenopprette dekrypterte filer.

I praksis: admin må ha en backdoor-rolle. Den eksisterer ikke i dagens kode — admin må logge inn som brukeren via impersonering for å hente filene.

### Hvis DB-en er korrupt og `encryptedDek` er borte

**Fila er permanent tapt.** Det er hele poenget med envelope-encryption: uten DEK er ciphertext like nytteløs som tilfeldige bytes. Backup-strategi for DB er kritisk.

---

## Test-cases (manuelt for nå)

### Round-trip-test

```
1. Sett STORAGE_MASTER_KEK_HEX=<openssl rand -hex 32>
2. Last opp en 25MB-fil med metadata.encryptAtRest=true
3. Verifiser i R2-dashboard: object-tag "encrypted-at-rest: aes-256-gcm", content-type "application/octet-stream"
4. GET /api/chunked-upload/files/<fileId>
5. Sammenlign SHA-256 av downloaded fil med original — skal være identisk
```

### Tamper-test

```
1. Last opp en encrypted fil
2. Modifiser ciphertext direkte i R2 (endre én byte midt i fila)
3. GET /api/chunked-upload/files/<fileId>
4. Forventet: 500 "decrypt_failed" (GCM auth-tag-mismatch)
```

### Missing-key-test

```
1. Last opp en encrypted fil
2. Restart backend uten STORAGE_MASTER_KEK_HEX
3. GET /api/chunked-upload/files/<fileId>
4. Forventet: 503 "encryption_key_missing"
```

---

## Hva som IKKE er dekket av denne implementasjonen

- **Stream-videoer**: Cloudflare må kunne lese for transcoding/playback. Sensitive videoer bør lastes opp med `encryptAtRest: true` (tvinges til R2) eller holdes utenfor Stream helt
- **Eksisterende ikke-krypterte filer**: forblir uencrypted. Ingen bulk-migrering implementert
- **Klient-side encryption**: bytes er plaintext under transit fra klient til backend. TLS beskytter, men ikke fra man-in-the-middle med kompromittert CA
- **Key-derivation per fil**: vi bruker per-bruker-KEK, ikke per-fil-KEK. Trade-off: enklere kode, men hele brukerens fil-corpus avhenger av samme avledede KEK
- **Hardware Security Module (HSM)**: master-KEK ligger som env-var. For high-compliance: bytt til KMS
- **Audit-trail for crypto-operasjoner**: vi logger fil-access (`file_access_audit`), men ikke spesifikt "denne DEK-en ble derivert/dekryptert". Kan legges til hvis compliance krever det

---

## Sammenheng med øvrige sikkerhetslag

Envelope-encryption er ett av flere lag, ikke en silver bullet:

1. **TLS** (transport) → CloudFlare + Render håndterer
2. **Authentication** (hvem) → session-cookies via `requireUserSession`
3. **Authorization** (hva) → DB-sjekk `WHERE user_id = $1` på alle file-routes
4. **At-rest encryption** (lekkasje-beskyttelse) → DENNE IMPLEMENTASJONEN + Cloudflare R2 sin innebygde
5. **Audit** (hvem-gjorde-hva) → `file_access_audit`-tabellen
6. **Key rotation** (begrense vindu ved lekkasje) → `secret_rotation_tracker`-tabell + admin UI
7. **Log redaction** (forhindre lekkasje via console) → `log-redaction.ts`

Hver lag dekker noen trusler. Sammen gir de en realistisk forsvars-dybde.
