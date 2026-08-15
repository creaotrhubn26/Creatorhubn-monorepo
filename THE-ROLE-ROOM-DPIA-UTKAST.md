# TheRoleRoom — Vurdering av personvernkonsekvenser (DPIA): utkast

> Følgedokument til `THE-ROLE-ROOM-PERSONVERN-DPA-NOTAT.md` (§3, §8-9).
> Bygget 2026-08-15. **Ikke juridisk rådgivning og ikke en fullført DPIA.**
> Dette er et strukturert utkast basert på Datatilsynets DPIA-metodikk og en
> kodegjennomgang av faktisk databehandling i plattformen — det erstatter
> ikke en jurist/personvernrådgivers kvalitetssikring før produksjon i
> skala (jf. hovednotatets disclaimer). Fyll ut/korriger seksjoner merket
> **[AVKLAR]** før dette regnes som ferdig.

---

## 0. Konklusjon på terskelspørsmålet

Jf. hovednotatet §3: DPIA er påkrevd ved minst 2 av 9 risikokriterier.
TheRoleRoom treffer **minst 3, trolig 4**:

| Kriterium | Treffer? | Begrunnelse |
|---|---|---|
| Sårbare personer, inkl. barn | ✅ Ja | Mindreårige forekommer i casting-prosjekter (statist-/skuespillerroller for barn er vanlig i film/reklame) |
| Innovativ teknologi (AI, biometri) | ✅ Ja | AI-agent-funksjonalitet i produktet (marketing-plan-generering, transkripsjon, bilde/video-behandling) — se §2 |
| Sensitiv informasjon/media i stor skala | ✅ Ja | Casting innebærer bilder og video av identifiserbare personer, lastet opp i store volum |
| Kombinere data fra flere kilder | ✅ Sannsynlig | SSO/SCIM (Fase 1-2), Google Workspace-integrasjon, Meta/Instagram-integrasjon, B2/R2-lagring — flere systemer kobles til samme brukerprofil |
| Scoring/evaluering av personer | ⚠️ **[AVKLAR]** | Kandidatvurdering skjer i produktet (casting-beslutninger), men det er uklart fra kodegjennomgangen om noe *automatisert* scoring/ranking av kandidater finnes, eller om det er rent menneskelig vurdering støttet av verktøy — avgjør om dette kriteriet også treffer |

**Konklusjon: terskelen er klart passert. DPIA skal gjennomføres før skalering.**

---

## 1. Beskrivelse av behandlingen

### 1.1 Formål

TheRoleRoom er en casting-/produksjonsplattform: prosjektstyring, talent-
/skuespiller-casting, manusarbeid, og produksjonskoordinering for film-,
reklame- og medieproduksjoner i Norge.

### 1.2 Behandlingsaktiviteter (identifisert i kodebasen)

| Aktivitet | Personopplysninger | Kilde i kodebasen |
|---|---|---|
| Brukerkontoer (produsenter, skuespillere, crew) | Navn, e-post, telefon, rolle | `users`-tabell, delt plattformbredt |
| Casting-prosjekter og roller | Prosjektdata, rollebeskrivelser | `casting_projects`, `casting_user_roles` |
| Talent-/kandidatprofiler | Bilder, video, CV/vita, kontaktinfo | Casting-media-opplasting (B2/R2) |
| SSO-innlogging (enterprise) | E-post, navn, IdP-identitet (SAML NameID) | `role-room-saml-routes.ts` (Fase 1) |
| SCIM-provisjonering (enterprise) | E-post, navn, org-tilhørighet, rolle | `role-room-scim-routes.ts` (Fase 2) |
| AI-agent-funksjoner | Prosjekt-/kandidatdata sendt til Anthropic Claude | `RoleRoomAgentChatPanel`, marketing-plan-generering |
| Sosiale medier-integrasjon | Instagram/Facebook-tokens, DM-innhold | `role-room-social-meta-routes.ts`, `role-room-ig-messaging.ts` |
| Google Workspace-integrasjon | Drive-filer, kalender, e-post-metadata | Google OAuth-flyt i `role-room-routes.ts` |
| Klientportal | Klientens kontaktinfo, tilbakemeldinger | `role_room_client_intake` |

### 1.3 Mindreårige

**[AVKLAR]** Kodegjennomgangen bekrefter at plattformen støtter casting av
mindreårige som talent (vanlig i bransjen), men ikke eksakt hvordan
foresatt-samtykke innhentes teknisk i dag. Hovednotatets §5 flagger dette
som et gjenstående punkt ("foresatt-samtykke for mindreårige"). Denne DPIA-
en kan ikke fullføres uten et klart svar på: *hvordan verifiseres alder, og
hvordan innhentes/dokumenteres foresatt-samtykke, før et mindreårig talents
bilde/video lastes opp?*

### 1.4 Omfang

- **Registrerte:** produsenter, skuespillere/talent (inkl. mindreårige),
  crew, klienter, enterprise-brukere (SSO/SCIM).
- **Geografisk:** Norge (primærmarked), med ambisjon om europeisk
  skalering (jf. hovednotatets §6/§8).
- **Volum:** **[AVKLAR]** — antall aktive brukere/prosjekter bør fylles inn
  fra produktdata før dette regnes som ferdig; påvirker om terskelen for
  "storskala behandling" (som også kan trigge DPO-plikt, §7) er nådd.

---

## 2. Nødvendighet og proporsjonalitet

| Spørsmål | Vurdering |
|---|---|
| Er behandlingen nødvendig for formålet? | Ja — casting krever nødvendigvis bilder/video av kandidater for at produsenter skal kunne vurdere dem. Dette er kjernen i tjenesten, ikke en tilleggsfunksjon. |
| Er det mindre inngripende alternativer? | Delvis — data minimeres allerede i noen grad (kun nødvendige felter i profiler), men **[AVKLAR]**: er det en definert sletteregel for casting-media etter at et prosjekt er avsluttet, eller ligger det på ubestemt tid? Hovednotatets §5 nevner "sletteregler (særlig casting-media)" som et åpent punkt. |
| Lovlig grunnlag per aktivitet | Se tabell i hovednotatet §5 — avtale (kundeforhold), samtykke (markedsføring/mindreårige), berettiget interesse (drift). AI-agent-bruk bør ha eksplisitt samtykke eller klar berettiget-interesse-vurdering siden data sendes til en tredjeparts-prosessor (Anthropic). |
| Datadeling med tredjeparter | Se prosessorliste i hovednotatet §2 (Neon, Vercel, Stripe, Anthropic, Google, Twilio) — alle krever DPA (åpent punkt, se §9 der). |

---

## 3. Risikovurdering for de registrertes rettigheter og friheter

Vurdert som sannsynlighet × alvorlighet, samme skala-prinsipp som
Datatilsynets veiledning (lav/middels/høy).

| Risiko | Sannsynlighet | Alvorlighet | Samlet | Kommentar |
|---|---|---|---|---|
| Uautorisert tilgang til mindreåriges bilder/video | Middels | **Høy** | **Høy** | Casting-media for mindreårige er særlig sensitivt. Server-side rollehåndheving var *ikke* implementert før dette arbeidet (kun klient-side UI-gating, jf. tidligere funn) — reell tilgangsrisiko inntil håndheving er på plass for alle skrive-/lese-endepunkter, ikke bare de SCIM/SAML berører. |
| Datalekkasje via tredjeparts-prosessor (AI, sosiale medier) | Lav-middels | Høy | Middels-høy | AI-agent sender prosjekt-/kandidatdata til Anthropic; Instagram-integrasjon håndterer DM-innhold og tokens. Begge krever gyldig DPA + minimering av hva som faktisk sendes. |
| Manglende/uklar sletting av casting-media | Middels | Middels | Middels | Ingen bekreftet automatisk sletteregel funnet for casting-spesifikt media (i motsetning til `data-cleanup-job.ts` som dekker andre kategorier, jf. hovednotatets sjekkliste). |
| Feilaktig regional datalagring (data lagres utenfor EU/EØS uten gyldig overføringsgrunnlag) | **Bekreftet delvis** | Middels-høy | Middels-høy | Fase 3-verifisering fant: Neon-region ubekreftet fra kode; Cloudflare R2 bruker det globale (ikke EU-jurisdiction-pinnede) endepunktet; kun Backblaze B2s Role Room-produksjonsbøtte er EU-bekreftet (`eu-central-003`, Amsterdam). Se §6 i hovednotatet — fortsatt et reelt, ikke bare teoretisk, åpent punkt. |
| Sikkerhetshendelse via lekket infrastruktur-credential | **Bekreftet, utbedret i kode** | Høy | Middels (etter fiks) | En reell Neon-database-credential var hardkodet i 10 filer i kildekoden (funnet og fjernet fra kildekoden 2026-08-15 i denne DPIA-runden) — men credentialen står fortsatt i git-historikken og må roteres i Neon-dashboardet. Til det er gjort er restrisikoen reell, ikke bare historisk. |
| Uriktig informasjon til tredjepart (Meta App Review) om databehandlere/regioner | **Bekreftet, utbedret i kode** | Lav-middels | Lav | Et autofyll-skript for Metas Data Handling-skjema inneholdt selvmotsigende/uverifiserte EU-region-påstander for Neon og R2 — korrigert i denne runden til kun det som faktisk er verifiserbart. |

---

## 4. Risikoreduserende tiltak

| Tiltak | Status |
|---|---|
| Rotere den eksponerte Neon-credentialen | **Ikke gjort** — må gjøres i Neon-dashboardet, kan ikke gjøres fra kildekoden |
| Server-side håndheving av casting-rolletillatelser (ikke bare klient-side) | **Ikke gjort** — identifisert som et gap, ikke i scope for denne DPIA-runden |
| Definere og implementere sletteregel for casting-media | **[AVKLAR]** — trenger en eier og en frist |
| Verifisere/korrigere EU-region for Neon og R2 | **Delvis** — status er nå dokumentert ærlig (se hovednotatet §6); selve infrastruktur-endringen (evt. migrere til bekreftet EU-region) er ikke gjort |
| DPA med alle underdatabehandlere | **Ikke gjort** — se hovednotatet §2 og §9 |
| Foresatt-samtykke-flyt for mindreårige, teknisk implementert og dokumentert | **[AVKLAR]** — ikke bekreftet i kodegjennomgangen |
| SSO/SCIM for enterprise-tilgangsstyring | **Gjort** (Fase 1-2, denne omgangen) — reduserer risiko ved at tilgang kan sentralt deprovisjoneres av kundens IT når noen slutter, i stedet for å stole på manuell oppfølging |

---

## 5. Konklusjon og anbefaling

Restrisikoen er **middels-høy** inntil særlig disse tre er lukket:
mindreårige-samtykkeflyten er bekreftet og dokumentert, server-side
rolletilgang håndheves (ikke bare i UI), og casting-media har en definert
sletteregel. Ingen av disse er identifisert som "høy restrisiko etter
tiltak" i en grad som trigger forhåndsdrøfting med Datatilsynet (jf.
hovednotatets §8) — **forutsatt** at tiltakene over faktisk gjennomføres
før skalering til flere enterprise-kunder.

**Anbefalt neste steg:** en jurist/personvernrådgiver kvalitetssikrer dette
utkastet — særlig seksjon 1.3 (mindreårige) og 3 (risikovurdering) — før
det regnes som en fullført DPIA, jf. hovednotatets egen anbefaling (§10.5).
