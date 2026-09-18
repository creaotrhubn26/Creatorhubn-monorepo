# Leadgrid TestFlight staging E2E

Denne sjekken dekker den delen som ikke kan bevises av simulator- og API-tester alene:
signert App Store-build, faktisk staging-innlogging, fysisk iPad, BRREG-worker og
et ekte nettverksbrudd med reconnect.

## Forutsetninger

- En dedikert staging-bruker uten interaktiv 2FA.
- Brukeren må ha `leads.create` i en staging-organisasjon.
- Staging må kjøre migrasjonene til og med
  `0492_pondus_integrity.sql`.
- Staging-organisasjonen må ha Leadbook/Pondus-entitlement og minst én
  publisert Pondus-mal med steg.
- Backend-worker må prosessere `background_jobs`.
- En fysisk iPad må være medlem av den interne TestFlight-gruppen.
- Produksjons-URL skal aldri brukes i denne prosedyren.

Eksporter hemmeligheter bare i den lokale terminalsesjonen. De skal ikke skrives til
repoet eller TestFlight-changeloggen:

```bash
export LEADGRID_STAGING_BASE_URL="https://<staging-host>"
export LEADGRID_STAGING_EMAIL="<dedikert-testbruker>"
export LEADGRID_STAGING_PASSWORD="<hemmelig>"
export LEADGRID_STAGING_ORG_ID="<valgfri-org-uuid>"
```

## 1. Infrastruktur og pairing-kode

```bash
ipad/LeadMapApp/scripts/staging-testflight-e2e.sh
```

Bestått betyr at utskriften inneholder `STAGING_E2E_API=PASS` og
`BRREG_WORKER=PASS`. Skriptet oppretter én tydelig merket `[E2E]`-lead i
staging og skriver ut en pairing-kode som utløper etter fem minutter. Token og
passord skrives aldri ut.

Kjør i tillegg den automatiserte staging-flyten på iPad-simulator med:

```bash
LEADGRID_RUN_SIMULATOR_E2E=1 ipad/LeadMapApp/scripts/staging-testflight-e2e.sh
```

Da må også `STAGING_E2E_SIMULATOR=PASS` og `PONDUS_OFFLINE_RECONNECT=PASS`
vises. Testene oppretter en lead mens appen er offline, kjører en Pondus-økt
med utfall, drainer køen ved reconnect og verifiserer nøyaktig én rad per
logisk handling i staging.

## 2. Signert staging-build

```bash
cd ipad/LeadMapApp
fastlane ios staging_beta
```

Lanen nekter produksjons-URL, bygger Release med staging-URL i Info.plist og laster
opp internt til TestFlight. Vent til Apple har prosessert bygget. Installer bygget
på fysisk iPad og kontroller at det gule `STAGING`-merket er synlig.

## 3. Fysisk offline/reconnect

1. Åpne staging-bygget og koble til med den ferske pairing-koden.
2. Åpne Leads og velg **Nytt lead**.
3. Fyll inn et unikt bedriftsnavn og gyldig org.nr. `937 518 684`.
4. Slå av både Wi-Fi og mobildata i Kontrollsenter.
5. Trykk **Legg til på kartet**. Appen skal bekrefte at leaden er lagret offline.
6. Åpne offline-indikatoren. Handlingen skal stå som ventende og beholde payload.
7. Slå på nett igjen. Handlingen skal forsvinne fra køen etter reconnect.
8. Søk opp det unike navnet i Leads. Det skal finnes nøyaktig én gang.
9. Åpne leaden og kontroller at BRREG-data vises etter at workeren har kjørt.
10. Forsøk samme skjema-ID på nytt via retry. Det skal fortsatt finnes én lead.
11. Åpne **Leadbook → Pondus**, velg en publisert mal og slå av nettet.
12. Start samtalen, gå minst ett steg videre og registrer utfallet **Møte**.
13. Slå på nettet. Begge køhandlingene skal forsvinne, og malens brukstall skal
    øke med nøyaktig én — utfallet skal ikke opprette en ekstra økt.
14. Avslutt appen helt. Aktiver samme mal fra Siri eller Apple Watch og
    kontroller at Leadbook åpnes på riktig mal/steg etter kaldstart.

Registrer TestFlight-buildnummer, iPadOS-versjon, lead-ID og tidspunkt sammen med
PASS/FAIL. Ikke registrer token, pairingkode eller passord.

## Godkjenningskriterium

Releasekandidaten er først fysisk E2E-godkjent når både skriptet og alle 14
enhetssteg er bestått på samme staging-release. Simulator-E2E alene teller ikke.
