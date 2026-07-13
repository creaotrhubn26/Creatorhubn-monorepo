# Beslutningslogg

Vesentlige arkitekturvalg med begrunnelse og forkastede alternativer.

## a) Selvstendig app under `apps/` — ikke i eksisterende backend-monolitt

**Beslutning:** Ledgerly ligger som egen app i `apps/ledgerly` med egen
`package.json`, egne migrasjoner, egen database og eget API.

**Begrunnelse:** Creatorhub-backenden er 75k+ linjer i et annet domene
(kreatørverktøy). Regnskap krever isolasjon og sporbarhet: append-only-garantier,
egne DB-triggere, streng tenant-modell og et revisjonsspor som ikke kan påvirkes av
endringer i et urelatert system. Egen app gir uavhengig livssyklus, deploy og
testkjøring.

**Forkastet:** Gjenbruk av `frontend/shared/schema.ts` og innbygging i eksisterende
backend. Skjemaet er bygget for et annet domene, og delte tabeller/typer ville koblet
regnskapsdataenes integritet til et stort, raskt bevegelig system.

## b) Bigint-ører — ikke numeric/decimal-bibliotek

**Beslutning:** Alle beløp er `bigint` i valutaens minste enhet (`src/shared/money.ts`),
BIGINT i databasen, strenger over API-et.

**Begrunnelse:** Eksakt heltallsaritmetikk uten avhengigheter; flyttall er umulig å
introdusere ved et uhell i beregningskjeden; satser håndteres som rasjonale brøker med
deterministisk avrunding (`multiplyRational`). Property-tester bekrefter invariantene.

**Forkastet:** `NUMERIC` i databasen + decimal-bibliotek (decimal.js e.l.) — gir
avrundingspolicy spredt i biblioteks-API-er, risiko for implisitt float-konvertering i
JS-laget, og en avhengighet der en 180-linjers modul holder.

## c) Rå SQL-migrasjoner + `pg` — ikke Drizzle/ORM

**Beslutning:** Håndskrevne SQL-migrasjoner (`migrations/0001_foundation.sql`) og
`pg` direkte (`src/db/pool.ts`).

**Begrunnelse:** Enkelhet og full kontroll: CHECK-constraints, partielle unike
indekser, triggere og `FOR UPDATE`-radlåser er førsteklasses i rå SQL, men klønete
eller usynlige i ORM-abstraksjoner. I et regnskapssystem skal databasens regler kunne
leses i én fil.

**Forkastet:** Drizzle (brukt ellers i monorepoet) — ville gitt skjemadeling og
migrasjonsmagi der eksplisitthet er poenget.

## d) Append-only med DB-triggere som forsvar i dybden

**Beslutning:** Applikasjonen gjør aldri UPDATE/DELETE på journal/audit-tabellene, og
databasen håndhever det samme med triggere (`forbid_mutation`,
`journal_entries_guard`).

**Begrunnelse:** Applikasjonsdisiplin alene beskytter ikke mot bugs, administratorfeil
eller direkte SQL. Triggerne gjør uforanderligheten til en databasegaranti, testet i
`test/ledger.pg.test.ts`.

**Forkastet:** Kun applikasjonshåndheving; event sourcing (unødvendig kompleksitet for
behovet — journalen ER hendelsesloggen).

## e) Deterministisk forslagsmotor først, AI-port bak zod-skjema

**Beslutning:** `DeterministicSuggestionEngine` og `DeterministicTextExtractor` er
MVP-implementasjoner bak grensesnittene `SuggestionEngine`/`DocumentExtractor`.
Alle forslag — også fremtidige AI-forslag — må validere mot `postingSuggestionSchema`
(zod) med `requiresHumanReview: true`, og satser hentes alltid fra regelregisteret.

**Begrunnelse:** Testbar, forklarbar grunnflyt uten modellavhengighet; AI kan plugges
inn uten at korrekthetsgarantiene flytter seg — skjemaet og regelregisteret er
kontrakten.

**Forkastet:** LLM i kjernen fra dag én — ville lagt juridisk/matematisk sannhet i en
prompt og gjort pipeline-testene ikke-deterministiske.

## f) HMAC-dev-auth i MVP, med dokumentert produksjonskrav

**Beslutning:** `src/api/auth.ts` bruker HMAC-signerte tokens fra en dev-login
(deaktivert i produksjon; `LEDGERLY_AUTH_SECRET` påkrevd der). RBAC/tenant-modellen er
derimot reell og håndheves på alle endepunkter.

**Begrunnelse:** Autorisasjonsmodellen (den vanskelige delen) kunne bygges og testes
ende-til-ende uten å vente på identitetsleverandør. Produksjonskravet — OIDC/BankID
med MFA og sikre sessions — er dokumentert i `docs/security-threat-model.md` og
`docs/known-limitations.md`.

**Forkastet:** Full OIDC i MVP (forsinket den vertikale flyten); sessions uten
signering (utestbar sikkerhetsmodell).
