# B2 som primærlagring

Backblaze B2 er primærlageret for opplastede filer. Cloudflare R2 er
fallback og lesekilde for alt som allerede ligger der.

Ingenting er kopiert eller migrert. Begge lagre leses videre, side om side.

## To uavhengige opplastingsveier

Plattformen har to lagringsstakker som ikke deler kode. Begge er flyttet.

### 1. Generiske opplastinger — `upload-storage-router.ts`

Brukes av `chunked-upload-routes.ts` (chunked) og `uploads-routes.ts`
(single-shot).

Rutingen:

1. `video/*` → Cloudflare Stream, hvis Stream er konfigurert og fila ikke
   skal krypteres i ro (Cloudflare må kunne lese råfila for transcoding).
2. Alt annet → **B2**, ellers R2, ellers filesystem.

Feiler B2-skrivingen, prøves R2 før filesystem. Rekkefølgen snus med
`UPLOAD_STORAGE_PRIMARY=r2`.

**Backend lagres per fil** i `chunked_uploads.metadata.storageBackend`
(`b2` | `r2` | `cloudflare_stream` | `filesystem`). Lesepathene bygger
S3-klienten ut fra den lagrede verdien, ikke ut fra dagens primærvalg —
det er dette som gjør at gamle R2-objekter fortsatt hentes fra R2.

Objektnøkkelen ligger i `metadata.objectKey` / `objectBucket`. De gamle
navnene `r2Key` / `r2Bucket` skrives fortsatt med samme verdi, fordi eldre
rader bruker dem. Lesere gjør `metadata.objectKey ?? metadata.r2Key`.

### 2. Capture-opplastinger — `capture-upload-service.ts`

Multipart-opplasting rett fra iPad/kamera-appen med presignerte
part-URL-er. Her finnes ingen kolonne som sier hvilket lager objektet
ligger i, og nøkkelen er ofte alt vi har — den kommer rett ut av en
SQL-rad og går videre til `signAssetReadUrl(key)` fra ~40 kallsteder.

Derfor rutes capture på **nøkkelprefiks**:

| Lager | Prefiks       | Env-overstyring     |
| ----- | ------------- | ------------------- |
| R2    | `capture/`    | `CAPTURE_R2_PREFIX` |
| B2    | `capture-b2/` | `CAPTURE_B2_PREFIX` |

`captureWriteStore()` velger hvor nye objekter skrives.
`captureStoreForKey(key)` velger hvor en gitt nøkkel leses fra. En
pågående multipart-opplasting mot R2 fullføres mot R2 selv om B2 slås på
midt i, fordi både `signPartUrls`, `completeMultipartUpload` og
`abortMultipartUpload` ruter på nøkkelen.

`CAPTURE_STORAGE_PRIMARY=r2` slår av B2 for denne veien alene.

De andre modulene som bygger egne klienter fra `buildCaptureR2Config()`
(dansevideo, koreografimusikk, referansearkiv, foto-leveranse,
marketing-preview) skriver i sine egne nøkkelrom og er urørt — de blir
liggende på R2 til de eventuelt flyttes hver for seg.

## Én bøtte, ikke én per produksjon

Plattformen bruker **én bøtte per backend**, delt av alle brukere og
produksjoner. Isolasjonen ligger i nøkkelen:

```
uploads/{userId}/{fileId}/{filnavn}
capture-b2/{ownerUserId}/{sessionId}/{assetId}/{kind}/{filnavn}
```

Tilgangskontrollen skjer i backend før vi signerer noe: klienten får
aldri bøttekreds, bare en kortlevd signert URL for én bestemt nøkkel, og
capture-veien sjekker i tillegg at nøkkelen ligger under kallerens eget
`{owner}/{session}/{asset}/`-prefiks.

Det finnes én lagring som *er* per konto: `user_b2_credentials` +
`user-b2-mirror-worker.ts`. Der oppgir brukeren sine egne B2-nøkler og sin
egen bøtte, og vi speiler opplastingene dit i tillegg. Den speilingen
gjelder fortsatt når primærlageret er vår B2 — brukerens bøtte er en annen
konto. Nøkkelen der er `user_id`, ikke produksjon eller team.

Vil man ha bøtte per produksjon, er det en ny modell: bøtte-provisjonering,
nøkkelrotasjon per bøtte og en kolonne som binder produksjon til bøtte.
Ingenting av det finnes i dag.

## Env

Alle kjedene tar første ikke-tomme verdi.

**Generiske opplastinger, B2:**

```
GENERIC_UPLOADS_B2_BUCKET              → B2_ROLE_ROOM_BUCKET_NAME → B2_BUCKET_NAME
GENERIC_UPLOADS_B2_APPLICATION_KEY_ID  → B2_ROLE_ROOM_APPLICATION_KEY_ID → B2_APPLICATION_KEY_ID
GENERIC_UPLOADS_B2_APPLICATION_KEY     → B2_ROLE_ROOM_APPLICATION_KEY → B2_APPLICATION_KEY
GENERIC_UPLOADS_B2_REGION              → B2_REGION       (default eu-central-003)
GENERIC_UPLOADS_B2_ENDPOINT            → B2_ENDPOINT     (default https://s3.{region}.backblazeb2.com)
GENERIC_UPLOADS_B2_PREFIX              (default uploads/)
```

**Capture, B2:** samme mønster med `CAPTURE_B2_*` som første ledd.

Regionen har betydning: `the-role-room-prod` ligger i `eu-central-003`.
Feil region gir ikke en exception, den gir stille skrivefeil — samme
fallgruve som `b2-archive-helper.ts` gikk i tidligere, og derfor er
defaulten her den samme.

## Regnskap

`apply_storage_consumption_delta` kjente bare `filesystem` | `r2` |
`cloudflare_stream`. En `b2`-upload ville økt `total_bytes` riktig, men
falt ut av hele breakdown'en — summen av kolonnene ville sluttet å stemme
med totalen. `0464_storage_ledger_b2_backend.sql` teller `b2` i
`r2_bytes`; kolonnenavnet er historisk og har nå en kommentar som sier
hva den faktisk inneholder. Admin-recompute (`storage-billing-admin-routes.ts`)
summerer tilsvarende `IN ('r2', 'b2')`.

## Signerte URL-er

Ved opplasting lagres en signert URL med 1 times TTL. Den er som regel
utløpt når fila hentes igjen, så `/api/chunked-upload/files/:fileId`
signerer på nytt per forespørsel og redirecter dit; den lagrede URL-en
brukes bare hvis ny signering ikke lar seg gjøre (f.eks. når
`publicUrlBase` gir en permanent public-URL).

## Slå det på

Sett B2-kredsene. Det er alt — koden velger B2 av seg selv når trioen
bøtte + nøkkel-id + nøkkel er på plass, og faller tilbake til R2 hvis en
av dem mangler. Halv konfig teller ikke som oppe; da ville hver upload
gått i en put som feiler med 403.

For å rulle tilbake: `UPLOAD_STORAGE_PRIMARY=r2` og
`CAPTURE_STORAGE_PRIMARY=r2`. Filene som allerede er skrevet til B2 leses
fortsatt fra B2 — per-fil-backenden og nøkkelprefikset står i dataene, ikke
i konfigen.
