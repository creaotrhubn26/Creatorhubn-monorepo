---
name: security-review
description: Security review of changes in the Creatorhubn monorepo — tenant/org isolation, auth/RBAC, webhooks, CORS, secrets, GDPR/personvern. Use before merging backend routes, migrations, integrations (LTI/OAuth/webhooks), or anything touching credentials or user data.
---

# Security-review — Creatorhubn-monorepo

Sikkerhetsgjennomgang tilpasset CreatorHubs faktiske trusselbilde: multi-org
SaaS (Role Room, Leadgrid, education/LMS) med eksterne integrasjonsflater
(Google OAuth, LTI 1.3/Moodle, webhooks, partner-API). Sjekklisten under er
destillert fra reelle hendelser i repoet — behandle hvert punkt som en
kjent-utnyttet klasse, ikke teori.

## 1. Org-/tenant-isolasjon (viktigst)

- Enhver ny spørring/rute skal være org-scopet. Historisk felle:
  `crm_customers` manglet `organization_id` — riktig mønster er
  `owner_user_id IN (SELECT user_id::text FROM organization_members WHERE
  organization_id = $1::uuid)`; denormalisert kolonne (mig 320) er
  optimalisering, subquery er fallback (memory.md § KRITISKE LÆRDOMMER).
- Se etter klassen fra #861/#862: ruter/cron/engine som glemte
  org_id-subqueries. Grep etter nye spørringer mot delte tabeller uten
  org-filter.
- Marketplace/deling på tvers: følg org-scoped-mønsteret fra PR #2005
  («org-scoped marketplace for Leadgrid»), og isolasjonsmønsteret fra #2004
  (Leadgrid-prosjekter skilt fra `casting_projects`).

## 2. AuthZ/RBAC

- Kolonnenavn-feller: permissions bruker `key`, ikke `permission_key`
  (mig 286-mønsteret); feil kolonnenavn har gitt «403 for alle» (#2003).
- Tab-/rolle-RBAC: sjekk argument-rekkefølge i tilgangsfunksjoner
  (swapped-arg-buggen i #1973 ga feil fane-RBAC for bro-studenter).
- Magic-link/partner-flater: knapp-gate + aldri blank shell (#1999) —
  en feilet auth skal degradere til forklart tilstand, ikke whitescreen.

## 3. Integrasjonsflater

- **Webhooks:** HMAC-signering er standarden (Intelligence Engine-mønsteret,
  PR #855) + secret-rotering støttet (mig 322). Nye webhooks uten HMAC = funn.
- **CORS (CH-ARCH-008):** enhver origin en klient faktisk sender fra
  (`tauri://localhost`, signerte desktop-schemes) må stå i `KNOWN_ORIGINS` i
  `backend/server/index.ts`. Diagnose: `curl -H "Origin: …" -D -` og se etter
  ACAO-header.
- **X-Frame-Options:** LMS-embedding krever bevisste unntak (Moodle måtte
  få frame `/lti/register`, #1969) — unntak skal være rute-spesifikke, aldri
  globale.
- **OAuth-scopes:** minimum-scopes-prinsippet (#1950); isolerte credentials
  per Google-flate (YouTube Analytics som egen credential, #1989). Nye
  Google-/OAuth-flater skal ikke gjenbruke en bredere credential.
- **Rate-limiting:** eksterne registrerings-/AI-flater skal ha rate-limit
  (LTI-register #1972; AI-rate-limiter-mønsteret PR #870).

## 4. Secrets og credentials

- Ingen secrets i kode, chat eller PR-tekst. Credentials som HAR vært delt i
  en chat/økt skal roteres (Render API-key- og Neon-hendelsene i memory.md).
- Timing-safe sammenligning for tokens (PR #866-mønsteret).
- Env-var-avhengige sikkerhetsfunksjoner må feile HØYT eller dokumenteres:
  `SENTRY_DSN` fraværende = stille deaktivert; `LEADGRID_STRICT_SCHEMA=1`
  gjør schema-mismatch fatal ved boot.

## 5. Personvern/GDPR

- Personvern-flater for The Role Room er dokumentert i
  `THE-ROLE-ROOM-PERSONVERN-DPA-NOTAT.md` og BankID-vurderingen i
  `THE-ROLE-ROOM-BANKID-BESLUTNINGSNOTAT.md` — endringer i persondata-flyt
  skal sjekkes mot disse, og avvik skal oppdatere notatene i samme PR.
- EXIF/GPS og media: opplastede medier (casting-bilder, self-tapes) er
  persondata; stripping/tilgangsstyring skal verifiseres for nye upload-flater.

## Verdikt-format

Verdikt først (GO / NO-GO / GO-med-vilkår), deretter funn sortert etter
alvorlighet. Hvert funn: hva + hvor (fil:linje) + konkret utnyttelses-/
feilscenario + fiks. Modellvalg: verdikt med produksjonskonsekvens tas av
sterkeste modell — si fra om valget.
