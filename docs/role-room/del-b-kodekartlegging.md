# Del B — kartlagt mot koden

Del B-dokumentet prioriterer 100 punkter uten å si hva som allerede
finnes. Denne fila fyller det hullet.

**Metoden:** hvert punkt slått opp mot faktiske tabeller, ruter og filer.
Der jeg ikke har verifisert, står det. Jeg har to ganger i arbeidet med
Del A antatt at noe ikke fantes og tatt feil — derfor er «ikke verifisert»
en egen kategori her, ikke slått sammen med «finnes ikke».

| Symbol | Betyr |
| --- | --- |
| ✅ | Bygget og i bruk |
| 🟡 | Delvis — fundamentet finnes, flaten eller en del mangler |
| ❌ | Verifisert fraværende |
| ❓ | Ikke verifisert i denne runden |

---

## Hovedfunnet

**Del B undervurderer hvor mye som finnes.** Særlig B3 (self-tape) og B6
(personvern) er vesentlig lenger fremme enn dokumentet antar. Fire
punkter merket P0 eller P1 er allerede bygget:

| # | Doken sier | Faktisk |
| --- | --- | --- |
| **217** Dataportabilitet | P0, S | ✅ `GET /api/role-room/talents/me/export` — art. 15, 17 og 20 |
| **215** Granulært samtykke | P0, M | ✅ `talent_consent_registry` med `scope` per partner |
| **216** Tilbaketrekking | P0, M | 🟡 `revoked_at` finnes + DELETE-rute; propagert sletting ikke verifisert |
| **232** Teknisk AI-tilbakemelding | P1, M | ✅ `talent_selftape_ai_feedback` + `/feedback/regenerate` |

Og B3 er nesten ferdig på serversiden: tjue ruter, egne tabeller for
prosjekter, takes, submissions og hendelser.

**Motsatt vei:** B1 (profil) er tynnere enn dokumentet antyder. `talents`
har `skills` som flat liste uten nivå, og ingen synlighetskolonner i det
hele tatt.

---

## B1. Profil og presentasjon (151–166)

`talents`-tabellen har: `display_name, bio, city, country, gender,
ethnicity, hair_color, eye_color, height_cm, age_range,
playing_age_min/max, languages, dialects, skills, headshot_url,
headshot_alt_urls, showreel_url, showreel_updated_at, resume_url,
resume_updated_at, represented, agency_name, agency_contact`.

| # | Punkt | Status | Funn |
| --- | --- | --- | --- |
| 151 | Profilfullføring | ❌ | Ingen kolonne, ingen beregning |
| 152 | Showreel-kapittelmerker | ❌ | Bare `showreel_url` |
| 153 | Headshot m/årstall | 🟡 | `showreel_updated_at`/`resume_updated_at` finnes — **ikke** for headshot |
| 154 | Ferdigheter m/nivå | 🟡 | `talents.skills` er flat. `skill_levels` finnes for **dansere** (`0061`), `proficiency_level` i `0131_resume_builder` — mønsteret finnes, ikke for talent |
| 155 | Verifiserte ferdigheter | ❌ | — |
| 156 | CV-import | 🟡 | `resume_url` + `ResumeBuilder.tsx`; ingen PDF/IMDb-parsing |
| 157 | Automatisk kredittliste | ❌ | — |
| 158 | Mål private som standard | ❌ | `height_cm` finnes, **ingen synlighetsflagg** |
| 159 | Pronomen | ❌ | Ingen kolonne |
| 160 | Flerspråklig profil | ❌ | `languages`/`dialects` er talentets språk, ikke profilversjoner |
| 161 | Video-selvpresentasjon | 🟡 | Self-tape-stakken kan brukes; ikke egen flate |
| 162 | Stemmeprøver | ❌ | — |
| 163 | Profillenke + QR | ❌ | — |
| 164 | Synlighetskontroll | ❌ | Ingen kolonne på `talents` |
| 165 | «Vist X ganger» | 🟡 | `talent_access_audit` logger oppslag — telling ikke eksponert |
| 166 | Duplikatsammenslåing | ❌ | — |

**Konsekvens for prioriteringen:** 158 og 164 er P0 i doken og faktisk
fraværende. De er også de billigste — to kolonner og et filter. 154 er
merket P0/M, men mønsteret finnes allerede to steder i basen; det er
nærmere S enn M.

## B2. Søk, matching og synlighet (167–178)

`role-room-talents-routes.ts` eksponerer i dag åtte ruter, alle under
`/talents/me`: profil, tilgjengelighetsbekreftelse, samtykker,
tilgangslogg. **Ingen match-, søke- eller søknadsstatusruter.**

| # | Punkt | Status | Funn |
| --- | --- | --- | --- |
| 167 | Match-varsler | ❌ | Ingen matchemotor mot talent |
| 168 | Match-score m/forklaring | ❌ | — |
| 169 | Geografisk radius | 🟡 | `city`/`country` finnes; ingen radius eller reisevillighet |
| 170 | Tilgjengelighetskalender | 🟡 | `/me/availability/confirm` finnes — bekreftelse, ikke kalender |
| 171 | «Åpen for»-flagg | ❌ | — |
| 172 | Anonymisert første runde | ❌ | — |
| 173 | Lagrede søk | ❓ | Ikke verifisert |
| 174 | Følg produksjonsselskaper | ❌ | — |
| 175 | Åpen utlysningsside | ❓ | Ikke verifisert |
| 176 | Søknadsstatus synlig | 🟡 | `casting_candidates.status` **finnes** — men eksponeres ikke mot talent |
| 177 | Automatisk avslag | ❌ | — |
| 178 | Karrierestatistikk | ❌ | — |

**Viktigste funn i B2:** 176 er billigere enn doken tror. Statusfeltet
finnes allerede på kandidatraden; det som mangler er en rute som lar
talentet se sin egen. Det er timer, ikke dager.

## B3. Auditions og self-tape (179–192)

Den mest ferdigbygde kategorien. Tabeller: `talent_selftape_projects`,
`_takes`, `_submissions`, `_submission_events`, `_ai_feedback`,
`talent_stream_uploads`. Tjue ruter.

| # | Punkt | Status | Funn |
| --- | --- | --- | --- |
| 179 | Self-tape fra mobil | ✅ | `init-upload` → `upload` → `finalize` |
| 180 | Innebygd opptak m/teleprompter | 🟡 | Backend støtter takes med varighet og thumbnail; teleprompter er klientside og ikke verifisert |
| 181 | Automatisk komprimering | ✅ | Cloudflare Stream transkoder ved opplasting |
| 182 | Kvittering levert/sett | ✅ | `talent_selftape_submission_events` med `event_type`, `actor_label`, `ip_address` + `/history` |
| 183 | Re-take-forespørsel | 🟡 | `takes` + `notes` finnes; ingen forespørselsflyt |
| 184 | Selvbooking | ❓ | Ikke verifisert |
| 185 | Reiseinfo i invitasjon | ❓ | Ikke verifisert |
| 186 | Kalendersynk | ❓ | Ikke verifisert |
| 187 | Sider m/NDA-sperre | ❓ | Ikke verifisert |
| 188 | Påminnelser 48t/2t | 🟡 | `talent-selftape-notifications.ts` finnes, men eksporterer bare `notifySelftapeActivity` — ingen tidsstyrt påminnelse |
| 189 | Strukturert tilbakemelding | 🟡 | `ai_feedback` finnes; menneskelig strukturert tilbakemelding ikke |
| 190 | Ventelistestatus | ❓ | Ikke verifisert |
| 191 | Egenerklæring stunt | ❓ | Ikke verifisert |
| 192 | Audition-historikk | 🟡 | `submission_events` er historikken; ingen talentvendt visning |

**Konsekvens:** self-tape-«leveransen» (179+180+181+182) som doken setter
til M er i praksis ferdig på server. Det som gjenstår er opptaksflaten på
mobil. Det flytter innsatsen fra backend til klient.

## B4. Tilbud, kontrakt og økonomi (193–204)

| # | Punkt | Status | Funn |
| --- | --- | --- | --- |
| 193 | Tilbud i appen | ❓ | Ikke verifisert mot talent-siden |
| 194 | Kontrakt i klartekst | ❓ | Ikke verifisert |
| 195 | BankID-signering | 🟡 | `role_room_signature_orders` har `provider` + `provider_order_id` — **rammeverket finnes, ingen BankID-leverandør koblet til** |
| 196–204 | | ❓ | Ikke verifisert |

**Det viktige her:** signaturrammeverket er leverandøruavhengig og klart.
BankID er et integrasjonsvalg, ikke en arkitekturjobb. Det står fortsatt
igjen som en leverandørbeslutning (RFQ) — samme åpne punkt som i Del A.

## B5. Kommunikasjon og varsler (205–214)

Det finnes åtte meldingstabeller i basen — `role_room_agent_threads`,
`community_dm_messages`, `editing_job_messages`, `interview_messages`
m.fl. **Ingen av dem er «én tråd per oppdrag» mot talent.**

| # | Punkt | Status |
| --- | --- | --- |
| 205 | Én tråd per oppdrag | ❌ |
| 206–214 | | ❓ Ikke verifisert |

At det finnes åtte separate meldingstabeller er i seg selv verdt å merke
seg: en niende for talent-tråder bør vurderes mot å konsolidere.

## B6. Samtykke, personvern og trygghet (215–226)

Sterkeste kategorien etter B3.

| # | Punkt | Status | Funn |
| --- | --- | --- | --- |
| 215 | Granulært samtykke | ✅ | `talent_consent_registry`: `partner_type`, `partner_ref`, `scope`, `status`, `granted_at` |
| 216 | Tilbaketrekking | 🟡 | `revoked_at` + `DELETE /me/consents/:id`. **Propagert sletting ikke verifisert** — det er den vanskelige halvdelen |
| 217 | Dataportabilitet | ✅ | `GET /me/export` |
| 218 | Autosletting søknadsmateriale | ✅ | `role-room-retention-service.ts` feier `casting_candidates` og `talent_selftape_submissions` |
| 219 | Verge-konto | ❌ | Ingen verge-/mindreårig-modell funnet |
| 220 | Arbeidstidsvern barn | 🟡 | AML-flaten fra Del A dekker arbeidstid; barnereglene (kap. 11) ikke koblet til talentsiden |
| 221 | Rapportering | ❓ | Ikke verifisert |
| 222 | Caster-verifisering | ❓ | Ikke verifisert |
| 223–226 | | ❓ | Ikke verifisert |

**GDPR-fundamentet som doken setter til fire P0-punkter er i praksis
halvferdig:** 215, 217 og 218 finnes. Det som gjenstår er 216s
propagering — og det er den tekniske krevende delen, akkurat som doken
sier.

## B7. Karriereverktøy (227–238)

| # | Punkt | Status | Funn |
| --- | --- | --- | --- |
| 231 | Self-tape-bibliotek | ✅ | `talent_selftape_projects` + `_takes` **er** biblioteket |
| 232 | Teknisk AI-tilbakemelding | ✅ | `talent_selftape_ai_feedback`, `/feedback`, `/feedback/regenerate` |
| 227–230, 233–238 | | ❓ | Ikke verifisert |

To P1-punkter allerede levert.

**⚠️ Kryssavhengighet doken ikke nevner:** 231 møter retention-arbeidet
fra denne sesjonen. Et talents tape-bibliotek er nøyaktig de filene
`role-room-retention-service.ts` sletter etter oppbevaringsfristen.
Bygges de uavhengig, sletter den ene det den andre lover å ta vare på.
Dette må avklares når fristene settes.

## B8. Mobil, UX og tilgjengelighet (239–250)

| # | Punkt | Status | Funn |
| --- | --- | --- | --- |
| 239 | Fullverdig mobilapp | ❌ | **Ingen mobilapp i repoet.** `ipad/` har `CaptureApp` og `LeadMapApp` — begge iPad-native for fotograf/salg, ingen av dem talentvendt |
| 240 | Offline callsheet | 🟡 | `OutboxKit` er offline-køen, allerede trukket ut som delt pakke — men den er i CaptureApp, ikke i en talentapp |
| 242 | WCAG 2.1 AA | 🟡 | `frontend/e2e/dance-a11y-axe.spec.ts` finnes — axe-testing er etablert for **én** flate |
| 243 | Skjermleser-testet søknadsflyt | ❌ | Ingen søknadsflyt å teste |
| 241, 244–250 | | ❓ | Ikke verifisert |

**239 er reell.** Det finnes ingen mobilapp, og doken har rett i at den
er en paraply. Men `OutboxKit`, `NetworkingKit` og axe-oppsettet er
byggeklosser som allerede finnes.

---

## Revidert P0-liste

Doken lister «16 leveranser» som er ~30 punkter. Trekker jeg fra det som
finnes, og skiller det som faktisk blokkerer fra det som bare er viktig:

### Blokkerer lansering

| # | Punkt | Hvorfor |
| --- | --- | --- |
| **219** | Verge-konto | Uten den: ingen mindreårige. Det er en **produktbeslutning**, ikke en oppgave — blokkér i registreringen eller bygg den |
| **216** | Propagert sletting | Halvferdig samtykke er verre enn ingen: dere lover tilbaketrekking uten å gjennomføre den |
| **158+164** | Mål private + synlighet | Verifisert fraværende. To kolonner og et filter |

### Billigst verdi, gjør neste

| # | Punkt | Hvorfor |
| --- | --- | --- |
| **176** | Søknadsstatus | `casting_candidates.status` finnes — mangler bare en talentvendt rute |
| **177** | Automatisk avslag | Bygg som par med 176, som doken sier |
| **179–182** | Self-tape-flate | Server er ferdig. Dette er en klientjobb, ikke M |
| **188** | Påminnelser | Varselmodulen finnes, mangler tidsstyring |

### Krever beslutning før kode

| # | Punkt | Beslutningen |
| --- | --- | --- |
| **221** | Rapportering | Bemanner dere den? En lovet saksbehandlingstid ingen holder skaper ansvar |
| **222** | Caster-verifisering | Påkrevd eller frivillig? Frivillig gjør de uverifiserte mistenkelige |
| **195** | BankID | Leverandørvalg. Rammeverket er klart |
| **239** | Mobilapp | Hvor mye av B3/B5 kan leveres på web i mellomtiden? |

### Ta ut av P0

| # | Punkt | Hvorfor |
| --- | --- | --- |
| 217 | Dataportabilitet | Ferdig |
| 215 | Granulært samtykke | Ferdig |
| 218 | Autosletting | Ferdig |
| 181 | Komprimering | Ferdig via Stream |
| 182 | Kvittering | Ferdig |

---

## Forbehold

**Femten punkter er ikke verifisert** (❓). De ligger i B4, B5 og B7, der
oppslagene ga for mye støy til å konkludere på. Å markere dem som
fraværende ville vært å gjenta feilen dokumentet allerede gjør.

Kartleggingen er **statisk** — tabeller, ruter og filnavn. At en rute
finnes betyr ikke at flaten bruker den, og at en tabell finnes betyr ikke
at den fylles. Et ✅ her betyr «koden finnes», ikke «funksjonen virker for
en bruker».
