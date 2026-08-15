# Endringshåndtering — policy (utkast)

> SOC 2 Type II-kjernepolicy. Del av `docs/soc2/00-KICKOFF-PLAN.md` (Fase 4).
> Bygget 2026-08-15 basert på faktiske CI-porter og prosesser funnet i
> kodebasen. **Utkast — trenger en navngitt eier som formelt vedtar den, og
> bør kvalitetssikres av noen med reell SOC 2-revisjonserfaring.**

---

## 1. Formål

Sikre at endringer i produksjonskode og -infrastruktur gjennomgås, testes,
og kan spores tilbake til hvem som gjorde hva og hvorfor, før de når
produksjon.

## 2. Kodeendringer — faktisk prosess i dag

Verifisert direkte mot dette repoets faktiske CI-oppsett (`.github/workflows/`),
ikke en generisk beskrivelse:

- Alle endringer går via pull request mot `main` (bekreftet: `main` er
  beskyttet, direkte push avvises — se historiske commits som nevner dette).
- Automatiserte porter kjører på hver PR: `Backend tsc --noEmit`,
  `Backend vitest`, `Backend production Docker build`, `Frontend tsc --noEmit`,
  `Frontend ESLint`, `Story Arc Hardened E2E`, `Visual Editor Regression`,
  `CreatorHub Sentinel`.
- Automatisert kodegjennomgang (Codex) kommenterer på PR-er og flagger
  funn med alvorlighetsgrad (P1 osv.) — se PR #2017 i dette veikartet for et
  eksempel der 4 P1-funn ble identifisert og rettet før merge.

**Ikke bekreftet fra kodebasen:** om `Backend tsc --noEmit`-porten faktisk er
satt som en **påkrevd** status-sjekk i branch protection, eller kun kjører
informativt. `.github/workflows/backend-typecheck-gate.yml` sin egen
kommentar sier eksplisitt at dette er en bevisst, gradvis utrulling: *"mark
'Backend tsc --noEmit' as a required status check once it's gone green on
one clean PR"* — **[AVKLAR: er den gjort påkrevd ennå?]**

## 3. Krav til en endring før merge

1. Minst automatiserte CI-porter grønne (se §2).
2. Reelle funn fra kodegjennomgang (menneskelig eller automatisert) enten
   rettet eller eksplisitt besvart med begrunnelse for hvorfor ikke.
3. For endringer som berører autentisering/autorisasjon/personopplysninger:
   ekstra oppmerksomhet — jf. de 4 P1-sikkerhetsfunnene rettet i dette
   veikartet (åpen redirect i SAML-innlogging, manglende org-medlemskapssjekk,
   manglende sesjonstilbakekalling ved deprovisjonering, referanse til en
   tabell som aldri ble migrert) — ingen av disse ble fanget av automatiserte
   typecheck-porter alene, kun av en kodegjennomgang som så på faktisk
   sikkerhetslogikk.

## 4. Databasemigrasjoner

Verifisert mot `backend/migrate.sh`: migrasjoner kjøres via `psql -v
ON_ERROR_STOP=1`, og en fil markeres kun som anvendt (`_migrations_applied`)
ved suksess.

**Reell svakhet funnet og demonstrert i dette veikartet:** migrasjon 0452
refererte opprinnelig en tabell (`organization_roles`) som aldri fantes i
noen SQL-migrasjon — kun en Drizzle-deklarasjon som aldri var koblet til
`drizzle.config.ts`. Dette ville stoppet migrasjonen midt i, med
`ON_ERROR_STOP=1`, og latt `role_room_scim_users` (resten av samme fil)
aldri bli opprettet. Funnet av automatisert kodegjennomgang, ikke av
migrasjonsverktøyet selv.

**Anbefalt tillegg til prosessen:** verifiser at enhver ny FK-referanse i en
migrasjon faktisk peker på en tabell som finnes i en tidligere, anvendt
migrasjonsfil — ikke bare i en Drizzle-skjemafil, som denne hendelsen viste
kan drifte fra virkeligheten uoppdaget.

## 5. Avhengighetsendringer (package.json/lockfiler)

**Reell, dokumentert svakhet funnet i dette veikartet:** root- og
backend-lockfilene hadde begge betydelig drift fra de respektive
`package.json`-filene — pakker deklarert men aldri låst (`react-quill` og
hele `@react-three/fiber`/`@react-three/drei`-treet), og pakker låst men
ikke lenger deklarert (`puppeteer-extra`-familien i backend). Dette hadde
vært usett fordi ingen tidligere PR hadde trigget en fullstendig
`npm ci`/frontend-build gjennom CI før Netlify-integrasjonen ble koblet til.

**Anbefalt tillegg:** en periodisk (f.eks. månedlig) `npm ci`-kjøring i CI
mot både root- og backend-lockfilen, uavhengig av om en PR endrer
avhengigheter — for å fange drift før den akkumuleres over måneder, ikke bare
når noen tilfeldigvis trigger et fullt build.

## 6. Rollback

**[AVKLAR — ingen dokumentert rollback-prosedyre funnet i kodebasen.]**
Anbefalt minimum: dokumentert prosess for å rulle tilbake en deploy på
Render, og en tilsvarende for å reversere en anvendt migrasjon (ikke alle
migrasjoner i dette repoet er additive/reverserbare — bør kartlegges).

---

**Eier:** **[AVKLAR.]**
**Neste gjennomgang:** **[AVKLAR.]**
