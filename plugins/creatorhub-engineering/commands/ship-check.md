---
description: Kjør full leveransesjekk av gjeldende branch/diff — regresjonsklasser, riktige E2E-gates, sikkerhet ved behov, og release-readiness-verdikt (GO/NO-GO).
---

Kjør en full leveransesjekk av gjeldende branch mot `main` i
Creatorhubn-monorepoet, i denne rekkefølgen:

1. **Scope:** `git diff main...HEAD --stat` — kategoriser diffen per flate
   (frontend-flate, backend-ruter, migrasjoner, apps/Tauri, ipad, workers).
2. **Regresjonsklasser:** bruk `regression-check`-skillen på de berørte
   kategoriene. Ved treff: list dem som blokkerende funn.
3. **Gates:** bruk `e2e-verify`-skillen til å velge riktige gates for diffen;
   kjør det som kan kjøres lokalt (typecheck-scripts, vitest, relevante
   hardened-bundles) og rapporter utfall. Ikke kjør suiter som ikke dekker
   diffen.
4. **Sikkerhet:** hvis diffen berører auth/RBAC, org-scoping, migrasjoner,
   webhooks, CORS eller credentials — kjør `security-review`-skillen og ta
   verdiktet med sterkeste modell (si fra om modellvalget).
5. **Release-readiness:** gå gjennom sjekklisten i
   `release-readiness`-skillen (lockfile-sync, migrasjonsvindu, env-vars,
   Docker-deps, Vercel-manuell-deploy-påminnelse ved frontend-endring).

Lever verdiktet FØRST: **GO / NO-GO / GO-med-vilkår**, deretter funnene
sortert etter alvorlighet — hvert funn som hva + hvor (fil:linje) + fiks.
Token-effektivt, null svada; utelat kategorier uten funn med én linje
(«migrasjoner: ingen»).
