# Databehandleravtale — mal (TheRoleRoom → kunde)

> Følgedokument til `THE-ROLE-ROOM-PERSONVERN-DPA-NOTAT.md` (§2, "Oppover").
> Bygget 2026-08-15. **Ikke juridisk rådgivning.** Basert på strukturen i
> Datatilsynets uoffisielle mal for databehandleravtale, tilpasset
> TheRoleRooms faktiske behandlingsaktiviteter (se `THE-ROLE-ROOM-DPIA-
> UTKAST.md` §1.2). Få en jurist til å kvalitetssikre denne malen — særlig
> ansvarsbegrensning (§9) og underdatabehandler-listen (§5) — før den
> sendes til en reell kunde, jf. hovednotatets egen anbefaling.
>
> Denne malen brukes når **TheRoleRoom (Creatorhub AS) er databehandler**
> for kundens data — dvs. når kunden (et produksjonsselskap) laster opp og
> behandler egne talent-/castingdata på plattformen. Se hovednotatets §1
> for skillet mellom denne rollen og TheRoleRoom som behandlingsansvarlig
> for egne brukerkontoer/billing (der gjelder personvernerklæringen, ikke
> denne avtalen).

---

## Databehandleravtale

mellom

**[KUNDENS NAVN]**, org.nr. **[ORG.NR.]** ("**Behandlingsansvarlig**")

og

**Creatorhub AS**, org.nr. 833038222 ("**Databehandler**")

heretter samlet omtalt som "Partene".

---

### 1. Bakgrunn og formål

Databehandler leverer TheRoleRoom — en plattform for casting- og
produksjonsstyring — til Behandlingsansvarlig i henhold til [hovedavtale/
abonnementsvilkår, dato]. I den forbindelse behandler Databehandler
personopplysninger på vegne av Behandlingsansvarlig. Denne avtalen
regulerer denne behandlingen i samsvar med personopplysningsloven og
EUs personvernforordning (GDPR) artikkel 28.

Ved motstrid mellom denne avtalen og hovedavtalen, gjelder denne avtalen
for spørsmål om behandling av personopplysninger.

---

### 2. Behandlingens art og formål

| | |
|---|---|
| **Formål** | Levere casting-/produksjonsstyringsfunksjonalitet: prosjektstyring, talent-/kandidatvurdering, manus- og produksjonskoordinering |
| **Varighet** | Så lenge hovedavtalen løper, med etterfølgende sletting/tilbakelevering jf. §8 |
| **Art** | Lagring, strukturering, visning, deling (innad i Behandlingsansvarliges organisasjon), og — der Behandlingsansvarlig aktivt tar det i bruk — AI-assistert bearbeiding (f.eks. marketing-plan-generering) |

### 3. Kategorier av registrerte og personopplysninger

**Kategorier av registrerte:**
- Talent/skuespillere/kandidater (inkl. potensielt mindreårige, jf. §4)
- Behandlingsansvarliges egne ansatte/brukere (produsenter, crew)
- Klienter/oppdragsgivere i Behandlingsansvarliges prosjekter

**Kategorier av personopplysninger:**
- Kontaktinformasjon (navn, e-post, telefon)
- Bilder og video av kandidater (casting-media)
- CV/vita, rolleerfaring, tilgjengelighet
- Kontoinformasjon ved SSO/SCIM-tilkobling (IdP-identitet, org-tilhørighet, rolle) — kun for Behandlingsansvarliges egne brukere, ikke talent
- Kommunikasjonsinnhold der Behandlingsansvarlig kobler til sosiale medier-integrasjoner (Instagram/Facebook DM)

**Særlige kategorier / mindreårige:** Behandlingsansvarlig er innforstått
med at plattformen kan brukes til å behandle bilder/video av mindreårige
(casting av barn/unge talent) og har selv ansvar for at gyldig
behandlingsgrunnlag (typisk foresatt-samtykke) er innhentet før slik data
lastes opp. **[AVKLAR: bør presiseres når mindreårige-samtykkeflyten fra
DPIA-utkastets §1.3 er avklart.]**

### 4. Behandlingsansvarliges instruksjoner

Databehandler skal kun behandle personopplysninger etter dokumenterte
instruksjoner fra Behandlingsansvarlig, herunder ved bruk av
plattformens standardfunksjoner slik de er beskrevet i produktdokumentasjonen.
Instruksjoner utover dette (f.eks. særskilt eksport, sletting utenom
standard flyt) skal gis skriftlig.

Databehandler skal umiddelbart varsle Behandlingsansvarlig dersom en
instruksjon etter Databehandlers vurdering er i strid med GDPR eller
annen personvernlovgivning.

### 5. Underdatabehandlere

Behandlingsansvarlig gir generell godkjenning til at Databehandler
bruker følgende underdatabehandlere, forutsatt at disse er bundet av
samme databehandlerforpliktelser som følger av denne avtalen:

| Underdatabehandler | Funksjon | Region/merknad |
|---|---|---|
| Neon, Inc. | Database (PostgreSQL) | **[AVKLAR: region ikke bekreftet — se DPIA-utkastet §3]** |
| Render Services, Inc. | Applikasjonshosting | US, SCC-er |
| Vercel Inc. | Statisk frontend-hosting | US, SCC-er |
| Cloudflare, Inc. | Objektlagring (R2) — opplastede bilder/video | Globalt nettverk, standard SCC-er (ikke jurisdiction-bundet) |
| Backblaze, Inc. | Objektlagring (B2) — arkiv/dokumenter | EU (`eu-central-003`, Amsterdam) for hovedbøtten; enkelte støttebøtter kan falle tilbake til US med mindre annet er konfigurert — se DPIA-utkastet §3 |
| Anthropic PBC | AI-assistert bearbeiding (kun der Behandlingsansvarlig aktivt bruker AI-agent-funksjoner) | US, SCC-er |
| Stripe, Inc. | Betalingsbehandling | US, SCC-er/DPF |
| Google LLC | Innlogging/Workspace-integrasjon (der aktivert) | EU-datalagring for Workspace-tjenester |
| Twilio Inc. | SMS/WhatsApp-varsler (der aktivert) | US, SCC-er |

Databehandler skal varsle Behandlingsansvarlig minst **[X — anbefalt 4]**
uker før en ny underdatabehandler tas i bruk eller en eksisterende byttes
ut, slik at Behandlingsansvarlig kan innsigelse. **[AVKLAR: varslingsfrist
og -kanal må fastsettes.]**

### 6. Sikkerhetstiltak

Databehandler skal implementere egnede tekniske og organisatoriske
tiltak, herunder:

- Kryptering av data under overføring (TLS) og — for identifiserte
  kategorier (f.eks. tilkoblingstokens) — under lagring
- Rollebasert tilgangsstyring (RBAC), inkludert SSO (SAML) og automatisk
  provisjonering/deprovisjonering (SCIM) for Behandlingsansvarliges egne
  brukere, der dette er aktivert
- Logging og sporbarhet for tilgang til sensitiv data
- Regelmessig sikkerhetsgjennomgang av kildekode og infrastruktur

**[AVKLAR: dette punktet bør oppdateres etter hvert som Fase 4/5 i
compliance-veikartet — SOC 2/ISO 27001 — gir formell dokumentasjon å vise
til her, i stedet for en generell beskrivelse.]**

### 7. Bistand til Behandlingsansvarlig

Databehandler skal, så langt det er mulig og rimelig, bistå
Behandlingsansvarlig med å:

- Besvare henvendelser fra registrerte (innsyn, retting, sletting,
  dataportabilitet, begrensning, innsigelse)
- Gjennomføre DPIA-er der det er relevant
- Håndtere brudd på personopplysningssikkerheten, jf. §8

### 8. Sikkerhetsbrudd

Databehandler skal varsle Behandlingsansvarlig **uten ugrunnet opphold**,
og senest innen **48 timer**, etter å ha blitt oppmerksom på et brudd på
personopplysningssikkerheten som berører personopplysninger behandlet
under denne avtalen. Varselet skal, så langt mulig, beskrive bruddets art,
berørte kategorier og omtrentlig antall registrerte, samt tiltak som er
eller vil bli iverksatt.

### 9. Sletting og tilbakelevering

Ved opphør av hovedavtalen skal Databehandler, etter Behandlingsansvarliges
valg, slette eller tilbakelevere alle personopplysninger, og slette
eksisterende kopier, med mindre lagring er pålagt ved lov.

**[AVKLAR: konkret frist for sletting/tilbakelevering etter opphør bør
fastsettes — DPIA-utkastets §4 flagger at en generell sletteregel for
casting-media ikke er bekreftet implementert ennå.]**

### 10. Revisjon

Behandlingsansvarlig har rett til, med rimelig varsel, å gjennomføre eller
få gjennomført revisjoner (herunder inspeksjoner) for å verifisere
Databehandlers etterlevelse av denne avtalen.

### 11. Ansvar

**[AVKLAR — juridisk gjennomgang påkrevd.]** Ansvarsfordeling og eventuelle
ansvarsbegrensninger må fastsettes i samråd med jurist før denne malen
brukes i en reell kundeavtale.

### 12. Lovvalg og verneting

Denne avtalen reguleres av norsk rett. Tvister søkes løst i minnelighet;
subsidiært ved de ordinære domstoler med **[Behandlingsansvarliges/
Databehandlers] verneting** som avtalt verneting. **[AVKLAR.]**

---

**Signatur, Behandlingsansvarlig**

Sted/dato: ______________________

Navn/stilling: ______________________

**Signatur, Databehandler (Creatorhub AS)**

Sted/dato: ______________________

Navn/stilling: ______________________
