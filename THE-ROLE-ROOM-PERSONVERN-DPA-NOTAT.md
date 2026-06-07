# TheRoleRoom — Personvern & databehandleravtaler: handlingsnotat

> Følgenotat til produktdokumentasjonen. Bygget 2026-05-27.
> **Ikke juridisk rådgivning.** Praktisk veiledning basert på Datatilsynets og Digdirs
> offentlige kilder (mai 2026). Få en jurist / personvernrådgiver til å kvalitetssikre før
> du går i produksjon.

---

## Sammendrag — hva må på plass før 10 ekte brukere

Den gode nyheten: det meste her er **tid, ikke penger**. De fleste underleverandørene har
standard databehandleravtaler du bare aksepterer, og Datatilsynet har gratis maler.

**Minimums-compliance før de første 10 ekte brukerne:**

1. **Personvernerklæring** (offentlig)
2. **Behandlingsprotokoll** (art. 30 — oversikt over hva dere behandler)
3. **Lovlig grunnlag** per behandling — særlig **foresatt-samtykke for mindreårige**
4. **DPA-er med underdatabehandlere** (de fleste aksepteres online — se 2)
5. **Kunde-DPA-mal** (dere er kundenes databehandler — se 2)
6. **DPIA påbegynt** (mindreårige + AI/media trigger dette — se 3)
7. **EU/EØS-datalagring verifisert** + tredjelandsoverføring håndtert (se 6)
8. **Rutiner for innsyn/sletting/portabilitet** + sletteregler

> To vanlige misforståelser ryddet: (a) «sikkerhetsnivå 3/4» er erstattet av lavt/betydelig/
> **høyt** og er *din* beslutning, ikke Datatilsynets (se 4); (b) du trenger normalt **ikke**
> forhåndsgodkjenning fra Datatilsynet — bare forhåndsdrøfting *hvis* DPIA viser høy
> restrisiko (se 8).

---

## 1. Din dobbeltrolle: behandlingsansvarlig OG databehandler

Dette er kjernen, og avgjør hvilke avtaler du trenger:

| Når | Din rolle | Eksempel |
|---|---|---|
| Egne brukerkontoer, billing, markedsføring | **Behandlingsansvarlig** | Brukerens e-post, betalingsdata |
| Kunden behandler talent-/produksjonsdata på plattformen | **Databehandler** (for kunden) | Et produksjonsselskap laster opp casting-video |

Konsekvens: du må både (a) inngå DPA-er **nedover** med dine underleverandører, og (b) tilby
en DPA **oppover** til kundene dine. Begge retninger må på plass.

---

## 2. Databehandleravtaler (DPA) — to retninger

**Nedover — DPA med underdatabehandlere (de fleste aksepteres online, ofte gratis):**

| Underleverandør | Funksjon | Rolle ift. deg | Region / merknad |
|---|---|---|---|
| Neon (Postgres) | Database | Underdatabehandler | Velg **EU-region** (f.eks. Frankfurt) |
| Vercel | Hosting | Underdatabehandler | Konfigurer **EU-region** |
| AWS S3 / Cloudflare R2 | Fillagring | Underdatabehandler | Velg **EU-region** |
| Stripe | Betaling | Underdatabehandler | US — standard DPA + SCC/DPF |
| Anthropic (Claude) | AI | Underdatabehandler | US — DPA + SCC/DPF; vurder zero-retention |
| Google Workspace | Drive/Calendar/signatur | Underdatabehandler | EU-datalagring + DPA |
| Twilio | SMS/WhatsApp | Underdatabehandler | US — DPA + SCC |
| Idura/Criipto (når BankID kobles på) | eID | Underdatabehandler | København (EU/EØS) |

> Krav fra regelverket: underdatabehandlere må bindes av **samme** plikter; varsle kunden ved
> bytte/tillegg av underdatabehandler (min. 1 ukes varsel); du er **fullt ansvarlig** for
> underdatabehandlerne dine.

**Oppover — DPA du tilbyr kundene:** lag én **kunde-DPA-mal** (du som databehandler) som
ligger klar ved signering av kundeavtalen. Bruk Datatilsynets uoffisielle mal som grunnlag.

---

## 3. DPIA (personvernkonsekvensvurdering) — du trenger sannsynligvis én

En DPIA er påkrevd hvis behandlingen står på Datatilsynets liste, **eller** hvis minst **2 av
9 risikokriterier** er oppfylt. TheRoleRoom treffer trolig flere:

| Kriterium | Treffer TheRoleRoom? |
|---|---|
| Sårbare personer, **inkl. barn** | ✅ Ja — mindreårige i casting |
| **Innovativ teknologi** (f.eks. ansikt/biometri, AI) | ✅ Sannsynlig — AI-agent + casting-media |
| Sensitiv informasjon / media i stor skala | ✅ Mulig — bilder/video av personer |
| Kombinere data fra flere kilder | ✅ Mulig — integrasjoner |
| Scoring/evaluering av personer | ⚠️ Vurder — kandidatvurdering |

> Med mindreårige + AI/media er terskelen (2 kriterier) klart passert. **Konklusjon: gjennomfør
> en DPIA før dere skalerer.** Bruk Datatilsynets gratis veiledning. Dette er også et sterkt
> tillitssignal mot partnere som NFI/NRK.

---

## 4. «Sikkerhetsnivå 3 vs. 4» — oppklart

Det gamle norske rammeverket med **fire** nivåer (nivå 3 = MinID, nivå 4 = BankID/Buypass/
Commfides) er **erstattet** av et nytt system med **tre** nivåer: **lavt / betydelig / høyt**.

- **BankID = «høyt»** (tilsvarer gamle nivå 4).
- Det er **tjenesteleverandøren (deg)** som bestemmer hvilket nivå som kreves — ikke
  Datatilsynet. Dette er et **Digdir/eIDAS-spørsmål**, ikke en GDPR-godkjenning.

**Anbefaling for TheRoleRoom:**
- **«Høyt» (BankID)** for sensitive/uavviselige handlinger: identitetsverifisering ved
  registrering og **juridisk bindende signering** (kontrakter, mindreårige-samtykke).
- **Vanlig innlogging** (e-post/passord eller lavere nivå) for daglig bruk — for å holde
  BankID-transaksjonskostnaden nede (jf. BankID-notatet).

---

## 5. Øvrige kjerneplikter

- **Personvernerklæring** — hva samles, hvorfor, hvor lenge, rettigheter, kontakt.
- **Behandlingsprotokoll** (art. 30) — intern oversikt over alle behandlinger.
- **Lovlig grunnlag** per behandling: avtale (kundeforhold), berettiget interesse (drift),
  samtykke (markedsføring) — og **foresatt-samtykke for mindreårige**.
- **Registrertes rettigheter:** rutiner for innsyn, retting, sletting, portabilitet, innsigelse.
- **Innebygd personvern (privacy by design):** kryptering, tilgangsstyring, audit-logg — mye
  finnes allerede i koden (samtykke, AI-governance, krypterte tokens, audit).
- **Sletteregler:** definer lagringstid per datakategori (særlig casting-media).

---

## 6. Datalagring / EU-EØS

- **Verifiser** at Neon, Vercel og S3/R2 faktisk er satt til **EU-region** (jf. Seksjon 4 i
  hoveddokumentet — åpent punkt).
- **Tredjelandsoverføring:** Stripe, Anthropic, Twilio er US-baserte. Sørg for gyldig
  overføringsgrunnlag (Standard Contractual Clauses / EU-US Data Privacy Framework) — finnes
  vanligvis i leverandørenes standard-DPA.
- Dette understøtter ambisjonen om europeisk skalering (Seksjon 8).

---

## 7. Personvernombud (DPO) — trenger du det?

DPO er påkrevd ved bl.a. **kjernevirksomhet** som innebærer storskala systematisk overvåking
eller storskala behandling av særlige kategorier. På nåværende (lite) skala er det trolig
**ikke strengt påkrevd**, men:
- **Anbefalt:** utpek en intern personvern-ansvarlig (kan være deg) og dokumenter rollen.
- Revurder DPO når volum/medie-behandling vokser.

---

## 8. Forhåndsdrøfting med Datatilsynet — når

Du trenger **ikke** å be Datatilsynet om tillatelse for å starte. Rekkefølgen er:

1. Gjennomfør **DPIA**.
2. Iverksett **risikoreduserende tiltak**.
3. **Kun hvis** det gjenstår **høy restrisiko** → be om **forhåndsdrøfting** med Datatilsynet.

For TheRoleRoom betyr det: gjør DPIA-en, reduser risiko (samtykke, kryptering, tilgang,
sletteregler) — du havner sannsynligvis under terskelen for forhåndsdrøfting.

---

## 9. Prioritert sjekkliste før 10 ekte brukere

| # | Oppgave | Innsats | Kost |
|---|---|---|---|
| 1 | Aksepter standard-DPA hos Neon, Vercel, Stripe, Anthropic, Google, Twilio | Lav | 0 kr |
| 2 | Verifiser EU-region på Neon/Vercel/S3 + sjekk SCC/DPF for US-leverandører | Lav–middels | 0 kr |
| 3 | Skriv personvernerklæring | Middels | 0 kr (mal) |
| 4 | Sett opp behandlingsprotokoll (art. 30) | Middels | 0 kr (mal) |
| 5 | Lag kunde-DPA-mal (du som databehandler) | Middels | 0 kr (Datatilsynets mal) |
| 6 | Gjennomfør DPIA (mindreårige + AI/media) | Høy | 0 kr (Datatilsynets veiledning) |
| 7 | Definer lovlig grunnlag + foresatt-samtykke for mindreårige | Middels | — |
| 8 | Rutiner for innsyn/sletting/portabilitet + sletteregler | Middels | — |
| 9 | (Valgfritt) Jurist-gjennomgang av DPIA + DPA-mal | — | Engangs honorar |

---

## 10. Anbefalte neste steg

1. **Start DPIA-en nå** — den er den tyngste og mest tidkrevende, og er trigger for alt annet.
2. **Aksepter underleverandør-DPA-ene** (rask gevinst, lukker «DPA ikke på plass»-gapet).
3. **Verifiser EU-regioner** (lukker åpent punkt fra Seksjon 4).
4. **Koble mindreårige-samtykke til BankID-signering** (binder dette notatet til BankID-notatet).
5. **Vurder én jurist-time** for å kvalitetssikre DPIA + DPA-mal før produksjon — lav kostnad,
   høy trygghet foran partnere som NFI/NRK.

---

## Kilder

- [Datatilsynet — Behandlingsansvarlig og databehandler](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/behandlingsansvarlig-og-databehandler/konsekvensene-av-om-det-foreligger-et-databehandleroppdrag-eller-ikke/)
- [Datatilsynet — Hvordan lage en databehandleravtale](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/hvordan-lage-en-databehandleravtale/)
- [Datatilsynet — Mal til databehandleravtale (uoffisiell)](https://www.datatilsynet.no/contentassets/6c496e86ba0e49908e8f1488625931d1/mal-til-databehandleravtale-uoffisiell-norsk.docx)
- [Datatilsynet — Vurdering av personvernkonsekvenser (DPIA)](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdering-av-personvernkonsekvenser/nar-ma-man-gjennomfore-en-vurdering-av-personvernkonsekvenser/)
- [Digdir — Ord og begreper innen eID-området (sikkerhetsnivåer)](https://www.digdir.no/digital-identitet/ord-og-begreper-innen-eid-omradet/3505)
