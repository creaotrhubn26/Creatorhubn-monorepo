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

## 4. CSP `null` + `assetProtocol scope ["**"]` (MEDIUM)
`tauri.conf.json`: ingen CSP + asset-protocol leser hele filsystemet. Reduserer forsvar i
dybden ved en XSS.
**Anbefalt:** sett en CSP (må crafts nøye pga. srcdoc-iframes + inline `__CFG__`-scripts —
test Infographic/preview grundig etterpå). Snevre assetProtocol-scope til de mappene appen
faktisk trenger.

## 5. `credential_store.py` klartekst-JSON (MEDIUM)
Tredjeparts API-nøkler/lisenser lagres i klartekst-JSON. **Allerede** `chmod 0600`
(kun eier). **Anbefalt (valgfritt):** krypter med OS-keychain (macOS Keychain / Windows
Credential Manager) for forsvar mot disk-/backup-eksfiltrering.

## ✅ 6. `/learned-targets` uauth GET — FIKSET
La `userAuth` på GET (som POST allerede hadde). Cross-user-delingen beholdes blant
innloggede; uautentisert lekkasje av (bl.a. eksistensen av) skannede private hosts lukket.

---
De 52 øvrige QA-funnene er fikset i samme PR (#1288). Se PR-kommentaren for full oversikt.
