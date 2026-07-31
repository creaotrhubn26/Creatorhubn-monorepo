# Del B — kartlagt mot koden

Del B-dokumentet prioriterer 100 punkter uten å si hva som allerede
finnes. Denne fila fyller det hullet.

**Metoden:** hvert punkt slått opp mot faktiske tabeller, ruter og filer.
Jeg har to ganger i arbeidet med Del A antatt at noe ikke fantes og tatt
feil — derfor var «ikke verifisert» en egen kategori her, ikke slått
sammen med «finnes ikke».

**Alle 100 punktene (151–250) er nå gjennomgått.** ❓ står tomt, og det
gjorde det ikke i de to første versjonene av denne fila. Historikken står
i «Forbehold» nederst, fordi hvilke antakelser som viste seg gale sier noe
om hvor man skal være forsiktig neste gang.

| Symbol | Betyr |
| --- | --- |
| ✅ | Bygget og i bruk |
| 🟡 | Delvis — fundamentet finnes, flaten eller en del mangler |
| ❌ | Verifisert fraværende |
| ❓ | Ikke verifisert — ingen igjen |

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

**Etter to verifiseringsrunder** — alle 250 punkter er nå gjennomgått, ingen
står som ❓ — er tallet høyere: **ni punkter merket P0 eller P1 er allerede
bygget**: 176, 188, 202, 214, 215, 217, 218, 226 og 232. Se «To talentflater»
for hvorfor den første runden ikke fant halvparten av dem.

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
| 173 | Lagrede søk | ❌ | `agency_saved_searches` finnes — men det er **byråer som lagrer talentsøk**, speilbildet av dette punktet |
| 174 | Følg produksjonsselskaper | ❌ | — |
| 175 | Åpen utlysningsside | 🟡 | **SEO-motoren doken etterlyser finnes allerede:** `theroleroom-sitemap-routes.ts` med statiske og dynamiske URL-er, prioritet, changefreq — og en test som håndhever synk mot `marketingPagesConfig.ts`. Men den dekker markedsføringssider og briefs. **Ingen roller, ingen offentlig rolle-rute** |
| 176 | Søknadsstatus synlig | ✅ | **Rettet.** `buildRoleRoomTalentPortalCandidate()` returnerer `status` til talentet via `GET /talent/portal` |
| 177 | Automatisk avslag | ❌ | — |
| 178 | Karrierestatistikk | ❌ | — |

**Rettelse:** åtte ruter under `/talents/me` var ikke hele bildet. Det
finnes en **andre talentflate** — `/talent/portal`, bygget på
`casting_candidates` i stedet for `talents`. Den eksponerer status,
roller, timeplan, aktivitet og self-tapes. Se «To talentflater» nedenfor.

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
| 184 | Selvbooking og ombooking | ❌ | Treffene er dansestudio og CRM. Ingen talentvendt tidsbooking |
| 185 | Reiseinfo i invitasjon | ❌ | `casting_schedules` har `location` og `notes` — ingen reisefelt |
| 186 | Kalendersynk | 🟡 | `role_room_calendar_feeds`: ICS-abonnement med ugjettbart token, `scope` = shoot_days/deadlines, tilbaketrekking framfor sletting. Utstedt av produsent, ikke av talentet |
| 187 | Sider m/NDA-sperre | ❌ | Ingen dokumentsperre. `role_room_access_vault_grants` er en *legitimasjons*-vault, men gir mønsteret: tildeling per bruker per prosjekt, med `expires_at` og `revoked_at` |
| 188 | Påminnelser 48t/2t | ✅ | **Rettet.** `casting-reminder-runner.ts` er en full cron-sveip: WhatsApp → SMS → e-post som fallback, idempotent via `casting_schedules.reminders_sent`, med preferanser per kanal per frist. Fristene er **24t/1t**, ikke 48t/2t — en konfigurasjonsendring, ikke en byggejobb |
| 189 | Strukturert tilbakemelding | 🟡 | `ai_feedback` finnes; menneskelig strukturert tilbakemelding ikke |
| 190 | Ventelistestatus | ❌ | Eneste treff på «waitlist» er en kommentar om en CTA for en ukonfigurert integrasjon |
| 191 | Egenerklæring stunt | ❌ | — |
| 192 | Audition-historikk | 🟡 | `submission_events` er historikken; ingen talentvendt visning |

**Konsekvens:** self-tape-«leveransen» (179+180+181+182) som doken setter
til M er i praksis ferdig på server. Det som gjenstår er opptaksflaten på
mobil. Det flytter innsatsen fra backend til klient.

## B4. Tilbud, kontrakt og økonomi (193–204)

| # | Punkt | Status | Funn |
| --- | --- | --- | --- |
| 193 | Tilbud i appen | 🟡 | `POST /api/role-room/offers` + `PUT /offers/:id/respond` finnes. Men `respond` gater på `viewerCanAccessProject` — prosjekt-eierskap eller medlemskap. **Et talent er ikke prosjektmedlem og kan ikke svare.** Produsentsiden er bygget, talentsiden ikke — nøyaktig som doken sier |
| 194 | Kontrakt i klartekst | 🟡 | `role_room_buyout_terms` **er** de strukturerte feltene: `territories`, `media_channels`, `exclusivity`, `starts_at/ends_at/unlimited`, `renewal_*`, `fee`, `currency` — med vokabular håndhevet i CHECK-constraints. Forutsetningen doken nevner (pkt 47) er oppfylt. Det som mangler er å gjengi dem på norsk |
| 195 | BankID-signering | 🟡 | `role_room_signature_orders` har `provider` + `provider_order_id` — rammeverket finnes, ingen BankID-leverandør koblet til |
| 196 | Betalingsstatus | ❌ | Ingen betalingsmodell mot talent |
| 197 | Honorar-historikk + årsoppgave | ❌ | Ingen honorartabell. `fee` finnes per buyout, men aggregeres ikke |
| 198 | Fakturagenerator | ❌ | `wedding_invoices`, `org_invoices`, `editing_payments` finnes for andre produkter |
| 199 | Tariff-sjekk | ❌ | Ingen satsdatabase. `role-room-work-time-rules.ts` nevner tariff bare som forbehold: «Tariffavtale kan utvide flere av grensene». **Del A pkt 116 mangler også** |
| 200 | Reiseregning | ❌ | `leadgrid_mileage_claims` og `wedding_mileage_reports` finnes — mønster, ikke løsning |
| 201 | Dobbeltbooking-varsel | ❌ | Kollisjonssjekk finnes for **utstyr** (`role-room-equipment-availability.ts`), ikke for personer. Gjenbrukbart mønster |
| 202 | Agentkobling m/sporbarhet | ✅ | `agency_orgs` **er** byråregisteret doken setter som forutsetning (pkt 38). `agency_talent_proposals` har `requested_scopes`, token, `accept`/`decline`-ruter. Sporbarheten ligger i `talent_consent_registry` + `talent_access_audit` |
| 203 | Delt visning talent/byrå | 🟡 | `requested_scopes` og consent-scopes finnes; `agency_production_partnerships` har pause per motpart. Ingen delt flate |
| 204 | Automatisk kredittliste | ❌ | Samme hull som 157 |

**Rettelse til doken:** 202 er ikke blokkert av pkt 38 — registeret finnes
allerede, med `verified`/`verified_at`, eierskap og arkivering framfor
sletting. Og 194 er billigere enn «M»: feltene er strukturert og
vokabularet håndhevet i basen. Det er en tekstjobb, ikke en datamodelljobb.

## B5. Kommunikasjon og varsler (205–214)

| # | Punkt | Status | Funn |
| --- | --- | --- | --- |
| 205 | Én tråd per oppdrag | 🟡 | `POST /talent/portal/messages` skriver til `role_room_talent_activity` per prosjekt **og** kandidat — altså per oppdrag. Men det er en aktivitetslogg, ikke en tråd: ingen `reply_to`, ingen lest-status, og teamet svarer ikke i samme kanal |
| 206 | Prioriterte push-varsler | 🟡 | Infrastrukturen finnes: `notification_device_tokens` (apns/web_push/fcm) og `push_subscriptions` (VAPID). Men `resolveChannel()` i crew-varslene degraderer `push` → `in_app` med kommentaren «ikke implementert». Ingen prioritet |
| 207 | Lest-kvittering | 🟡 | To kvitteringsmekanismer finnes: `role_room_call_sheet_receipts` (token-bekreftelse per mottaker) og `talent_selftape_submission_events` (hendelseslogg). Ingen av dem er kvittering på meldingsnivå |
| 208 | Meldinger uten privat nummer | ❌ | `maskPhoneNumberId()` maskerer **vår egen** WhatsApp-`phone_number_id` i admin-visningen. Det er ikke nummervern for talent |
| 209 | Automatisk oversettelse | ❌ | — |
| 210 | Stille perioder 22–07 | 🟡 | `notification_preferences.quiet_hours_start/end` finnes og leses av `lead-assignment-notification-service.ts`. **Men tabellen er `organization_id NOT NULL` mot `organizations`, og `notification_events` har fremmednøkler til `crm_customers`/`crm_visits`** — det er LeadGrid-stakken, ikke Role Room. Mekanismen er bevist, datamodellen er en annen |
| 211 | Gruppemeldinger m/svaralternativer | ❌ | — |
| 212 | Varsel ved profilvisning | 🟡 | `talent_access_audit` har alt som trengs: `talent_id`, `partner_type`, `partner_ref`, `accessed_at`. Ingen varsling leser den |
| 213 | Ukentlig sammendrag | ❌ | — |
| 214 | Kontaktpreferanse håndhevet | ✅ | For auditions: `casting_candidates.reminder_prefs` har flagg per kanal **per frist** (`sms24h`, `whatsapp1h`, …), håndhevet i `casting-reminder-runner.ts`, og talentet redigerer dem selv via `PATCH /talent/portal/profile`. Gjelder ikke andre varseltyper |

**Rettelse til doken:** 206 og 210 er merket «krever 136-infrastruktur».
Infrastrukturen finnes — den er bare bygget for et annet produkt. Jobben er
å knytte Role Room til den, ikke å bygge den.

## B6. Samtykke, personvern og trygghet (215–226)

Sterkeste kategorien etter B3.

| # | Punkt | Status | Funn |
| --- | --- | --- | --- |
| 215 | Granulært samtykke | ✅ | `talent_consent_registry`: `partner_type`, `partner_ref`, `scope`, `status`, `granted_at` |
| 216 | Tilbaketrekking | 🟡 | `revoked_at` + `DELETE /me/consents/:id`. **Propagert sletting ikke verifisert** — det er den vanskelige halvdelen |
| 217 | Dataportabilitet | ✅ | `GET /me/export` |
| 218 | Autosletting søknadsmateriale | ✅ | `role-room-retention-service.ts` feier `casting_candidates` og `talent_selftape_submissions` |
| 219 | Verge-konto | 🟡 | **Rettet.** `role_room_signature_signers.signs_on_behalf_of` finnes, og `subject_type` har `'guardian_consent'` i vokabularet — med kommentaren at dette er hovedgrunnen til at signering måtte på plass tidlig. Signaturlaget håndterer verge. **Ingen verge-*konto*** |
| 220 | Arbeidstidsvern barn | 🟡 | AML-flaten fra Del A dekker arbeidstid; barnereglene (kap. 11) ikke koblet til talentsiden |
| 221 | Rapportering | ❌ | Ingen rapporterings- eller varslingsmodell i basen |
| 222 | Caster-verifisering | 🟡 | `agency_orgs.verified` + `verified_at` finnes. Ingen prosess som setter dem |
| 223 | Blokkeringsfunksjon | ❌ | — |
| 224 | Intimitetskoordinator-flagg | ❌ | Se merknaden under |
| 225 | Anonym varslingskanal | ❌ | — |
| 226 | Personvern i klartekst + innsynslogg | ✅ | `GET /api/role-room/talents/me/access-audit` er innsynsloggen; `RoleRoomGdprNotice` dekker klarteksten |

**⚠️ 224 er ikke bare fraværende — den er lovet.** Utsendingsteksten i
`175_role_room_live_on_set.sql` sier ordrett til bransjen at
«intimacy-koordinering må være innebygd, ikke et add-on», og at
koordinator «bør være obligatorisk å nevne i casting-briefen for visse
scene-typer, at samtykke per scene må dokumenteres med versjonering, og at
skuespillere må kunne trekke samtykke uten konsekvens».

Ingen av de tre tingene finnes i koden. Det er en e-post sendt til folk i
en liten bransje, om et tema de er alene om å jobbe med. Avstanden mellom
den teksten og kodebasen er den mest ubehagelige enkeltobservasjonen i hele
kartleggingen — ikke fordi jobben er stor, men fordi løftet allerede er
gitt.

**GDPR-fundamentet som doken setter til fire P0-punkter er i praksis
halvferdig:** 215, 217 og 218 finnes. Det som gjenstår er 216s
propagering — og det er den tekniske krevende delen, akkurat som doken
sier.

## B7. Karriereverktøy (227–238)

| # | Punkt | Status | Funn |
| --- | --- | --- | --- |
| 227 | Karrierestatistikk over tid | ❌ | — |
| 228 | Ferdighetsgap-innsikt | 🟡 | `nextrole_career_mentor_sessions` har `kind = 'skills_gap'` og `recommended_jobs`. CV-basert, i NextRole, ikke koblet til `talents` |
| 229 | Kurskatalog-integrasjon | ❌ | `role_room_education_courses` og `leadgrid_academy_courses` finnes for andre flater — ingen talentvendt katalog |
| 230 | Mentormatch | 🟡 | `community_mentor_sessions` er en komplett flyt: forespørsel → aksept → tidfesting → rating. Ligger i community-produktet, hengt på `users`. Gjenbrukbar |
| 231 | Self-tape-bibliotek | ✅ | `talent_selftape_projects` + `_takes` **er** biblioteket |
| 232 | Teknisk AI-tilbakemelding | ✅ | `talent_selftape_ai_feedback`, `/feedback`, `/feedback/regenerate` |
| 233 | Demoreel-klipphjelp | ❌ | — |
| 234 | Bransjekalender | ❌ | `role_room_calendar_feeds` er ICS-abonnement per prosjekt — et annet problem |
| 235 | Referanse fra caster | ❌ | `resume_experiences.is_endorsed`/`endorsement_count` finnes i NextRole. Ingenting mot casting |
| 236 | Merittbadges | 🟡 | `prototype_tester_badges` har `badge_id`, `badge_name`, `badge_tier` (bronze→diamond), `unlocked_at`. Komplett modell, feil målgruppe |
| 237 | PDF-CV i bransjeformat | 🟡 | `resume_exports` støtter pdf/docx/txt/json/html, med maler og versjonering. **Men malene er ATS-/jobbsøker-orientert** (`modern-ats`, `target_job_title`), og `resumes.user_id` er aldri koblet til `talents` |
| 238 | Karriere-tidslinje | 🟡 | `resume_experiences` er dataene. Ingen tidslinjevisning, ingen kobling til talent |

**Mønsteret i hele B7:** nesten alt finnes én gang, i et annet produkt.
Mentorflyt, badges, CV-eksport, ferdighetsgap — alle bygget, alle hengt på
`users` eller `resumes`, ingen koblet til `talents`. Det gjør B7 til et
integrasjonsproblem, ikke et byggeproblem — men koblingen er ikke gratis:
`talents` og `resumes` deler bare `user_id`, og ingenting joiner dem i dag.

**237 er den billigste av dem.** Eksportmaskineriet finnes; det som mangler
er én mal i bransjeformat og en join.

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
| 241 | Mørk modus | 🟡 | **Omvendt av det doken antar:** `casting-main.tsx` hardkoder `palette: { mode: 'dark' }`. Role Room *er* mørk, permanent. Det finnes ingen lys modus og ingen bryter |
| 242 | WCAG 2.1 AA | 🟡 | To spor finnes: `frontend/e2e/dance-a11y-axe.spec.ts` (én flate) og en Lighthouse-terskel `accessibility ≥ 0.9` som **error**. Men Lighthouse-oppsettet kjører ikke — se 249 |
| 243 | Skjermleser-testet søknadsflyt | ❌ | Ingen søknadsflyt å teste |
| 244 | Enhåndsbruk / store trykkflater | 🟡 | `RoleRoomMobileBriefWizard.tsx` er en mobiloptimalisert flate. Ikke et krav håndhevet noe sted |
| 245 | Nynorsk + engelsk | ❌ | Se merknaden under — verre enn fraværende |
| 246 | Onboarding under 5 min | 🟡 | `RoleRoomOnboardingDialog.tsx` har sju steg og er admin-konfigurerbar (`stepsEnabled`), pluss `FirstTimeTour`. Men det er **medlemsprofil**-onboarding, ikke talentregistrering, og ingenting måler de fem minuttene |
| 247 | Lagre halvferdige søknader | ❌ | `ProfileDraft`/`SelfTapeDraft` i talentportalen er skjematilstand i minnet, ikke lagrede utkast |
| 248 | Hurtigsøknad statistroller | ❌ | — |
| 249 | Ytelse < 2 sek på 4G | 🟡 | Se merknaden under |
| 250 | Universell angrefunksjon | ❌ | Angrefunksjon finnes i bilderedigering og storyboard, ikke på talentflaten |

**⚠️ 245: nynorsk er ikke glemt — den er aktivt slått sammen med bokmål.**
`language-provider.tsx` har `AppLanguage = 'no' | 'en'`, og normaliserer
`nn` → `'no'` eksplisitt, med `document.documentElement.lang = 'nb-NO'`.
Å legge til nynorsk er derfor en typeendring og en normaliserer-endring,
ikke bare en strengfil.

Og engelsk gjelder uansett ikke her: `TalentPortalView.tsx` (2106 linjer)
bruker hverken `useLanguage` eller oversettelser, og hardkoder
`Intl.DateTimeFormat('nb-NO')`. Talentflaten er norsk-bare, uavhengig av
språkvelgeren.

**⚠️ 249: målestokken finnes, men måler feil ting og kjører ikke.**
`frontend/lighthouserc.json` har reelle terskler — FCP 2500 ms, LCP
4000 ms, CLS 0.1 som `error`. Tre problemer:

1. `preset: "desktop"` — punktet handler om **4G på mobil**
2. URL-ene er `/`, `/nextrole`, `/privacy-policy` — tre markedsføringssider, **ingen talentflate**
3. Ingen workflow i `.github/workflows/` kaller den, så den kjører aldri

Det er billigere å rette enn å bygge: bytt preset, legg til talentportalens
URL, koble den til CI. Da får 242 og 249 en vaktpost samtidig.

**239 er reell.** Det finnes ingen mobilapp, og doken har rett i at den
er en paraply. Men `OutboxKit`, `NetworkingKit`, axe-oppsettet og
Lighthouse-konfigurasjonen er byggeklosser som allerede finnes.

---

## To talentflater — funnet under verifiseringen

Den første kartleggingen bommet på B2 og B5 fordi den lette feil sted.
Det finnes **to** talentflater:

| | `/api/role-room/talents/me` | `/api/role-room/talent/portal` |
| --- | --- | --- |
| Bygget på | `talents` (registeret) | `casting_candidates` (per prosjekt) |
| Fil | `role-room-talents-routes.ts` | `role-room-routes.ts` |
| Dekker | profil, samtykke, GDPR, tilgangslogg | oppdrag, roller, timeplan, self-tapes, meldinger, aktivitet |
| Innlogging | brukersesjon | e-post + invitasjonstoken |

De to deler ingen data. Et talent kan ha en registerprofil uten
kandidatrader, og en kandidatrad uten registerprofil.

**Hvorfor jeg bommet:** tre av portalens tabeller —
`role_room_talent_invites`, `role_room_talent_activity`,
`role_room_talent_uploads` — opprettes med `CREATE TABLE IF NOT EXISTS`
**inne i applikasjonskoden** ved oppstart, ikke i en migrasjonsfil. Et søk
gjennom `migrations/` finner dem ikke. Det er verdt å rette uavhengig av
denne kartleggingen: tabeller utenfor migrasjonsløpet blir usynlige for
alle som leser skjemaet, inkludert neste person som skal kartlegge noe.

### To ting som ble funnet — og fikset

**1. Aktivitetsloggen filtrerte ikke på `visibility`.** ✅ Fikset.
`role_room_talent_activity` har kolonnen — den er der nettopp for å skille
intern prat fra delt — men spørringen i talentportalen hentet alle rader
for kandidaten. `role_room_messages` håndhever den samme kolonnen i
backend, med kommentaren at klienten «ALDRI» skal se intern prat.

Alle skrivere sendte `'shared'`, så dette var **latent, ikke en aktiv
lekkasje**. Spørringen filtrerer nå på `visibility = 'shared'`.

**2. Portalen returnerte kandidatraden hel — inkludert `notes` og
`rating`.** ✅ Fikset. Det er castingteamets interne vurdering, og
`buildRoleRoomTalentPortalCandidate()` redigerte ingenting bort.

Dette var ikke latent. Og verre enn det så ut: én av de fire rutene som
bruker serializeren — `GET /talent/invites/:inviteToken` — er
**uautentisert**. Vurderingen gikk ut til alle som hadde invitasjonstokenet.
Begge feltene er nå utelatt; `status` beholdes, siden det er punkt 176.

Begge er dekket av `role-room-talent-portal-redaction.test.ts`, en vakttest
på kildenivå. Den er svakere enn en oppførselstest, og det står i fila
hvorfor: serializeren ligger i en closure og bruker to closure-scopede
hjelpere, så å teste den direkte krever at den trekkes ut av en fil som
allerede bærer 59 kjente typefeil. Vakten fanger den feilen som faktisk
skjedde — et felt lagt tilbake fordi raden ble sendt hel.

### Og: to parallelle self-tape-systemer

| | `talent_selftape_*` | `casting_candidates.videos` |
| --- | --- | --- |
| Rute | `talent-selftapes-routes.ts` (20 ruter) | `POST /talent/portal/self-tapes` |
| Lagring | Cloudflare Stream, målt | kun en URL — vi holder ingen bytes |
| Kvote | telles | telles ikke |

Den andre tar imot en `videoUrl` og legger den i en JSONB-liste. Det
forklarer hvorfor self-tape kan se både ferdig og fraværende ut avhengig
av hvor man ser. For lagringsarbeidet betyr det at én self-tape-vei aldri
treffer regnskapet.

---

## Revidert P0-liste

Doken lister «16 leveranser» som er ~30 punkter. Trekker jeg fra det som
finnes, og skiller det som faktisk blokkerer fra det som bare er viktig:

### Blokkerer lansering

| # | Punkt | Hvorfor |
| --- | --- | --- |
| **216** | Propagert sletting | Halvferdig samtykke er verre enn ingen: dere lover tilbaketrekking uten å gjennomføre den |
| **158+164** | Mål private + synlighet | Verifisert fraværende. To kolonner og et filter |
| **219** | Verge-konto | Nedjustert fra ❌ til 🟡: signaturlaget håndterer verge (`signs_on_behalf_of`). Kontoen mangler fortsatt, og det er fortsatt en **produktbeslutning** — blokkér mindreårige i registreringen, eller bygg den |

### Billigst verdi, gjør neste

| # | Punkt | Hvorfor |
| --- | --- | --- |
| **193** | Tilbud, talentsiden | Produsentruten finnes. Det som mangler er en svarrute et talent faktisk kan kalle — `respond` krever prosjektmedlemskap i dag |
| **194** | Kontrakt i klartekst | Feltene er strukturert og vokabularet håndhevet. En tekstjobb |
| **177** | Automatisk avslag | 176 er ferdig, så paret er halvveis |
| **179–182** | Self-tape-flate | Server er ferdig. Klientjobb |
| **212** | Varsel ved profilvisning | `talent_access_audit` har dataene. Mangler bare en leser |
| **237** | PDF-CV | Eksportmaskineriet finnes. Én mal og én join |
| **249+242** | Ytelse og WCAG | Lighthouse-konfigurasjonen finnes. Bytt preset til mobil, legg til talentportalens URL, koble den til CI. To punkter for én jobb |
| **223** | Blokkering | Doken sier «lav innsats, høy trygghetsverdi». Verifisert fraværende, og jeg er enig i vurderingen |

### Krever beslutning før kode

| # | Punkt | Beslutningen |
| --- | --- | --- |
| **221** | Rapportering | Verifisert fraværende. Bemanner dere den? En lovet saksbehandlingstid ingen holder skaper ansvar |
| **224** | Intimitetskoordinator | Løftet er gitt i utsending. Enten bygg det, eller slutt å si det |
| **222** | Caster-verifisering | Nedjustert til 🟡 — `verified` finnes. Spørsmålet er hvem som setter den, og om den er påkrevd |
| **195** | BankID | Leverandørvalg. Rammeverket er klart |
| **239** | Mobilapp | Hvor mye av B3/B5 kan leveres på web i mellomtiden? |
| **206/210** | Push og stille perioder | Infrastrukturen finnes i LeadGrid-stakken. Koble Role Room til den, eller bygg en egen? |
| — | To talentflater | `talents` og `casting_candidates` er to bilder av samme person. Konsolidere eller leve med begge? |

### Ta ut av P0

| # | Punkt | Hvorfor |
| --- | --- | --- |
| 217 | Dataportabilitet | Ferdig |
| 215 | Granulært samtykke | Ferdig |
| 218 | Autosletting | Ferdig |
| 181 | Komprimering | Ferdig via Stream |
| 182 | Kvittering | Ferdig |
| **176** | Søknadsstatus | **Ferdig** — portalen returnerer `status` |
| **188** | Påminnelser | **Ferdig** — full cron-sveip. Bare fristene skal justeres (24t/1t → 48t/2t) |
| **202** | Agentkobling | Ferdig, inkludert byråregisteret doken setter som forutsetning |
| **214** | Kontaktpreferanse | Ferdig for auditions |

---

## Forbehold

**Alle 250 punkter i Del B er nå gjennomgått.** Ingen står igjen som ❓.

**To telefeil underveis, begge mine.** Først skrev jeg «femten
uverifiserte punkter» — det var et tall på *rader* i tabellene, ikke på
punkter; B4, B5 og B7 hadde tretti. Så skrev jeg «fjorten» om resten —
den var også en radtelling; det var nitten. Samme feil to ganger, og verdt
å nevne fordi den gjør et dokument som skal måle framdrift til noe som
underrapporterer arbeidet.

**Verifiseringen endret femten statuser totalt.**

| Runde | Opp | Ned | Fra ❓ til noe |
| --- | --- | --- | --- |
| B4/B5/B7 (30 punkter) | 176, 188, 202, 214 → ✅ | 173 → ❌ | 205, 219, 222, 186 → 🟡 |
| Resten (19 punkter) | 226 → ✅ | — | 175, 241, 244, 246, 249 → 🟡; ti → ❌ |

Grunnen til at første runde bommet er den samme hver gang: jeg søkte i
`migrations/` og i én rutefil, og halve talentflaten ligger utenfor begge.

**Tre ting jeg vil at leseren ser, som ikke er statuser:**

1. **224 er lovet i utsendingstekst uten kode bak.** Det er den eneste
   observasjonen her som handler om noe annet enn planlegging.
2. **245 er ikke et hull, men en aktiv sammenslåing.** Nynorsk normaliseres
   til bokmål i typen. Det endrer hva jobben er.
3. **249 og 242 deler en ubrukt vaktpost.** Lighthouse-konfigurasjonen
   finnes, måler desktop på markedsføringssider, og kjøres ikke av noen.

Kartleggingen er fortsatt **statisk** — tabeller, ruter og filnavn. At en
rute finnes betyr ikke at flaten bruker den, og at en tabell finnes betyr
ikke at den fylles. Et ✅ her betyr «koden finnes», ikke «funksjonen virker
for en bruker». For 202, 214 og 226 har jeg lest kallkjeden; for de øvrige
✅-ene har jeg lest definisjonen. For B8 har jeg lest frontend-kildene, men
**ingenting i frontend kan bygges eller typesjekkes i dette miljøet** —
`node_modules` er tom og registeret er blokkert. B8-statusene er lesning,
ikke kjøring.
