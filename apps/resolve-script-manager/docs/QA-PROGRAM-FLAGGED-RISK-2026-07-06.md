# QA-program — 6 flaggede risiko-funn (krever bevisst beslutning)

Funnet i Wave 4 (Risk QA). Status oppdatert 2026-07-06 (branch `fix/qa-flagged-risk`):
**2 av 6 fikset trygt** (#2 PII-maskering, #6 learned-targets-auth). De 3 resterende
(#1 ACL, #4 CSP, #5 keychain) kan IKKE gjøres trygt uten en Tauri-build + funksjons-
testing — å sette dem blindt risikerer å bryte scan-funksjonen / hele app-en / krever
OS-integrasjon. #3 (video) er en v1-samtykke-begrensning, ikke en maskerbar ting.

## 1. demo-capture `remote.urls`-wildcard → fjern-origin IPC (HIGH)
`src-tauri/capabilities/demo-capture.json` gir `remote.urls: ["http://*","https://*"]` til
scan-/capture-vinduene, som laster vilkårlige bruker-URL-er. En XSS'et/ondsinnet side kan
spoofe core-IPC-events (verste fall: invokere app-kommandoer → RCE).
**Anbefalt:** ikke fjern capability (scan-funksjonen trenger IPC), men ACL-gate: eksponer
KUN de spesifikke demo-capture-kommandoene til disse vinduene (Tauri v2 command-ACL), ikke
`core:default`. Verifiser i `gen/schemas/acl-manifests.json` at app-kommandoer krever ACL.

## ✅ 2. PII til Claude — FIKSET
`demo_pii_inject.js` eksponerer nå `maskText`; `demo_scan_inject.js` masker `pageText`
+ alle element-`label` (e-post/tlf sladdes) FØR de sendes til Claude — symmetrisk med
skjermbilde-maskeringen. (#3 video-opptak under.)

## 3. Uredigert skjermopptak av innloggede sider (HIGH, GDPR — v1-begrensning)
`demo_scan_inject.js`: synlig sidetekst (`pageText`) + element-labels sendes UMASKERT til
Claude selv om skjermbildet maskeres. `demo_pii_inject.js`: skjermopptak av innloggede
sider lagres/eksporteres uten PII-sladding.
**Anbefalt (policy-beslutning):** definer hva som skal maskeres. Enten (a) masker pageText
symmetrisk med skjermbildet (e-post/tlf/navn-regex + input-verdier), eller (b) eksplisitt
samtykke-skjerm før scan/opptak av innloggede sider, med tydelig hva som sendes til AI.

## ✅ 4. CSP satt (MEDIUM) — DELVIS
Satt en CSP i `tauri.conf.json` (før: `null`). Bruker Tauris dokumenterte IPC/asset-verdier
(`connect-src ipc: http://ipc.localhost https:`, `img/media asset: data: blob:`), beholder
`'unsafe-inline'`/`'unsafe-eval'` for script/style (app-en bruker tungt inline `__CFG__` i
srcdoc + inline React-styles — uten dette white-screener preview), og strammer `object-src
'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-src 'self' https: data: blob:`
(https for Demo Studios eksterne live-preview-iframe).
**VERIFISERT i Playwright-WebKit:** hele Infographic Studio + srcdoc-preview + thumbnails
rendrer under CSP-en, 0 violations. **Gjenstår runtime-verifisering på ekte build:** innlogging
(connect-src backend), asset://-medie (video-preview/thumbnails fra disk), Demo Studio-scan.
`assetProtocol scope` beholdt `["**"]` (app-en leser bruker-valgte stier/SD-kort/Resolve-
mapper — innsnevring ville brutt capture/cull/color).
**Merk:** for REELL script-injeksjons-beskyttelse trengs en nonce-refaktor av inline-scriptene
(fjerne `'unsafe-inline'`) — større jobb, ikke gjort her.

## 5. `credential_store.py` klartekst-JSON (MEDIUM)
Tredjeparts API-nøkler/lisenser lagres i klartekst-JSON. **Allerede** `chmod 0600`
(kun eier). **Anbefalt (valgfritt):** krypter med OS-keychain (macOS Keychain / Windows
Credential Manager) for forsvar mot disk-/backup-eksfiltrering.

## ✅ 6. `/learned-targets` uauth GET — FIKSET
La `userAuth` på GET (som POST allerede hadde). Cross-user-delingen beholdes blant
innloggede; uautentisert lekkasje av (bl.a. eksistensen av) skannede private hosts lukket.

---
De 52 øvrige QA-funnene er fikset i samme PR (#1288). Se PR-kommentaren for full oversikt.
