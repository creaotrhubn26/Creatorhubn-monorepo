# CreatorHub — systemkontekst for Higgsfield-generering

Denne filen gjør Higgsfield-skillene **plattform-bevisste**. Alle skills under
`.agents/skills/higgsfield-*` skal lese og følge den før de genererer noe.
Målet: generering som tjener CreatorHub-plattformen — på merkevare, på norsk,
integrert i asset-flyten — ikke løse filer på skrivebordet.

> Kanonisk kilde. Endre denne filen, ikke kopier innholdet inn i hver skill.

---

## 0. Forstå HVA som skal genereres (gjør dette FØRST)

**Grunnregel: lær systemet først.** Skal du vise eller generere innhold *om* en
funksjon i plattformen (f.eks. en produkt-/forklaringsvideo av Story Arc Studio,
en demo av en flyt), MÅ du først lære hvordan den faktisk fungerer — les den ekte
koden (komponent, rute-registrering, og E2E-testene som avslører hele
funksjonsflaten via test-ids) og fang det **ekte** grensesnittet deterministisk
(browser-automasjon/skjermbilde, ikke en generativ modell som forvrenger UI-et).
Aldri gjett eller fabrikker produktets oppførsel eller utseende.

Verdien ligger ikke i å kjøre CLI-en — den ligger i å skjønne hva merkevaren
faktisk trenger. **Aldri hopp rett til `generate`.** En god generering starter
med et godt *brief*, ikke en god prompt (prompten er bare briefet oversatt til
modell-språk). Følg rekkefølgen:

1. **Ram inn oppdraget** (spør hvis uklart — ikke anta):
   - Hvilket **prosjekt/merkevare**?
   - Hva er **målet** — kampanje, produktlansering, ukesinnhold, kjennskap, konvertering?
   - **Hvor skal det brukes** — feed (4:5/1:1), stories/reels (9:16), landing-hero (16:9), annonse?
   - **Én asset eller en serie** (f.eks. en carousel, en ukesplan)?

2. **Hent plattformens egne signaler — ikke gjett.** Plattformen vet allerede mye
   om hva som trengs; bygg på det i stedet for å finne på:
   - **Business DNA** (tone, farger, USP, målgruppe) — grunnlaget for alt (seksjon 2).
   - **Katalog** — hvilke produkter/tjenester kampanjer skal fokusere på.
   - **Segmenter + ROAS** — hvilken målgruppe/vinkel gir best avkastning.
   - **Innholds-/ukesplan** (content-strategist) — hva er allerede planlagt.
   - **GEO-/synlighets-hull** — hvilke temaer mangler dekning.
   Der CLI-konteksten ikke har disse: spør brukeren, eller be om et kort brief
   (mål + produkt + målgruppe + tone).

3. **Foreslå en konkret brief FØR generering — og få bekreftelse:**
   - Asset-liste: for hver → **format**, **formål**, og en **merkevare-grunnet prompt** (tone + farger-hex + USP).
   - Estimert **kreditt-kost** (`generate cost`).
   - Hvilken **modell** og hvorfor.
   Bekreft, generer så. Dette hindrer bortkastede kreditter på feil ting.

## 1. Hva plattformen er

CreatorHub er en norsk markedsførings-/innholdsplattform (monorepo
`creaotrhubn26/Creatorhubn-monorepo`). Relevante flater:
- **The Role Room** — produsent-cockpit (prosjekter, workspace, Photo Room / Video Room).
- **Leadgrid** — lead-/kampanjemotor for norske SMB-kunder.
- **Markedsintelligens** — innsikt, GEO-synlighet, anbud.

Publikum og innhold er **norsk-først**. Generert tekst i bilder, undertekster og
voiceover skal være på norsk med mindre brukeren sier noe annet. Tekniske
CLI-argumenter (`--aspect_ratio 16:9`) forblir engelske.

## 2. Grunn ALT i merkevaren (Business DNA)

Hvert prosjekt har en **brand-kit / Business DNA** (backend: `getBrandKit(projectId)`,
`brand-kit-service.ts`) med feltene:
`businessName`, `tagline`, `toneOfVoice`, `industry`, `targetAudience`,
`colors{primary, secondary, accent}`, `fonts{heading, body}`, `usps[]`, `logoUrl`.

Før generering:
1. Avklar **hvilket prosjekt/kunde** det gjelder.
2. Injiser merkevarens **tone**, **farger (hex)** og **USP-er** i prompten.
3. Ukjent merkevare → spør hvilket prosjekt, eller be om tone + primær/aksent-farge.

Aldri gjett merkevare-attributter. Bruk faktiske verdier fra brand-kitet.

## 3. To uavhengige veier — ikke bland dem

| Vei | Auth | Bruk til |
|---|---|---|
| **CLI** (`higgsfield`) | Daniels konto (OAuth), **begrenset kreditt** | Ad-hoc/eksperimentell generering herfra |
| **Backend `HIGGSFIELD_API_KEY`** | Server-side (KEY_ID:KEY_SECRET) | Appens Animer-funksjon (PhotoRoom → `/api/projects/:projectId/ai/image-to-video`) |

Higgsfield DoP ble koblet inn som video-provider i det provider-agnostiske
`generative-media.ts`-laget (PR #1805), side om side med Seedance 2.0 (fal) og
SwitchX (Beeble). CLI-generering hører til her, i utviklingsflyten; produkt-
flyten for sluttbrukere går via backend-ruten.

## 4. Output → inn i plattformen, ikke løse filer

Generert media skal kunne brukes som plattform-assets:
- **capture_assets** (workspace / Photo Room) — B2-lagret.
- **carousel-slide `image_ref`** (`role-room-carousel-image-resolver.ts`: strategiene
  brand-asset / user-gallery / stock / ai / color-only).
- **video-versjoner** (`project_video_versions`).

Etter generering: last ned resultat-URL-en, gi den et meningsfullt navn knyttet
til prosjektet, og legg den i prosjektets asset-mappe. Ikke bare lim en løs,
utløpende URL i chatten.

## 5. Formater plattformen bruker

- Carousel/feed: **4:5** og **1:1**
- Stories/reels: **9:16**
- Landing-hero / forklarings-video: **16:9**

Velg aspect ratio etter hvor assetet skal brukes.

## 6. GDPR / samtykke (persondata)

Ekte **kundefoto** er persondata og sendes til tredjeparts-AI utenfor EØS.
Plattformen har en samtykke-gate (`project_ai_consent`). Ikke send ekte
kundefoto (Photo Room-kilder, Soul-ID-treningsbilder av virkelige personer) til
generering uten at prosjektets samtykke er registrert. **Konsept-/tekst-til-bilde
er trygt** (ingen persondata).

## 7. Kreditt-varsomhet

Daniels Higgsfield-konto har **begrenset saldo** (ultra plan). Kjør alltid
`higgsfield generate cost …` og **bekreft med brukeren før dyre jobber** (video,
Soul-trening, batch). Ikke spend kreditter uoppfordret.

## 8. CLI-installasjon er herdet

CLI-en styres via **npm**: `npm i -g @higgsfield/cli`. **IKKE** pipe en remote
installer til shell (`curl … install.sh | sh`) — det er remote-code-by-design og
re-hentes live. Hvis `higgsfield` mangler i PATH: be brukeren reinstallere via
npm.

## 9. Modell-linjering

- **Video:** plattformens default er Seedance 2.0; Higgsfield DoP er alternativ (PR #1805). Higgsfield-CLI-en gir også Veo 3.1, Kling 3.0, Wan 2.6 m.fl. — velg etter behov.
- **Bilde:** plattformen bruker Nano Banana 2 (fal) i Photo Room og SDXL (Replicate) for carousel-slides. Bruk Higgsfield-bildemodeller som utfyller disse, ikke som ukoordinert erstatning.
- **Samtykke-fri** konsept-generering (tekst→bilde) er alltid førstevalg når du ikke trenger et ekte kundefoto.
