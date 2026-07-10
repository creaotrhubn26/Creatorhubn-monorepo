# QA-program — 6 flaggede risiko-funn (krever bevisst beslutning)

Funnet i Wave 4 (Risk QA). IKKE fikset automatisk fordi de kan bryte funksjon eller
krever en policy/arkitektur-beslutning. Anbefalt fiks per punkt under.

## 1. demo-capture `remote.urls`-wildcard → fjern-origin IPC (HIGH)
`src-tauri/capabilities/demo-capture.json` gir `remote.urls: ["http://*","https://*"]` til
scan-/capture-vinduene, som laster vilkårlige bruker-URL-er. En XSS'et/ondsinnet side kan
spoofe core-IPC-events (verste fall: invokere app-kommandoer → RCE).
**Anbefalt:** ikke fjern capability (scan-funksjonen trenger IPC), men ACL-gate: eksponer
KUN de spesifikke demo-capture-kommandoene til disse vinduene (Tauri v2 command-ACL), ikke
`core:default`. Verifiser i `gen/schemas/acl-manifests.json` at app-kommandoer krever ACL.

## 2. + 3. PII til Claude + uredigert skjermopptak (HIGH, GDPR)
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

## 6. `/learned-targets` uauth GET (LOW)
`post-agent-anthropic-routes.ts`: GET er DOKUMENTERT åpen-by-design (delt crowd-sourced
UI-element-kunnskap per host; POST krever auth). **Anbefalt:** hvis en scannet privat/intern
host kan lekke via denne, legg `postAgentAuth` på GET også (beholder cross-user-delingen
blant innloggede). Ellers: la stå som dokumentert.

---
De 52 øvrige QA-funnene er fikset i samme PR (#1288). Se PR-kommentaren for full oversikt.
