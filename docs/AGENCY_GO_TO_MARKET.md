# Byrå-akkvisisjon: operasjonell go-to-market

Hvordan vi går fra «produktet er bygd» til «kunder kommer inn».

---

## 1. Outreach-strategi mot skuespillerbyrå-segmentet

### Eksisterende byggeklosser

| System | Status | Hvor |
|---|---|---|
| `industry_targets`-tabell | ✅ live | migrate 173 |
| 6 e-post-templates (Outreach Plan) | ✅ live | `backend/server/role-room-outreach-*.ts` |
| Claude-personalisering per target | ✅ live | bruker `claude-opus-4-7` |
| Touch-/referral-felter | ✅ live | migrate 173 |
| Resend e-post-sending | ✅ live | `transactional-email-service.ts` |

### Target-listen — 30 norske skuespillerbyråer å starte med

Daniel seedeer manuelt i Admin Room → `industry_targets`:

| Tier 1 (direkte intro først) | Tier 2 (kald outreach) |
|---|---|
| Stella Casting | Caster |
| Skuespillersenter | Talent10 |
| Sirius Casting | Yes Talent |
| Heartbreak | Models 1 Oslo |
| NSF Casting | Bjørg-team |
| ... (~10 til) | ... (~10 til) |

### 6-touch sekvens

| Touch | Dag | Mål | Template-ID |
|---|---|---|---|
| 1 | Dag 1 | **Verdi-pitch** med personalisert intro | `agency_value_pitch` |
| 2 | Dag 3 | **Sosial bevis** (Stella jobber pilot) | `agency_social_proof` |
| 3 | Dag 7 | **Ressurs**: GDPR-sjekkliste pillar-artikkel | `agency_gdpr_resource` |
| 4 | Dag 14 | **Case-studie**: Northern Lights-casting | `agency_case_study` |
| 5 | Dag 21 | **Demo-tilbud**: 30 min med deres data | `agency_demo_offer` |
| 6 | Dag 30 | **Break-up**: «Skal jeg slutte å sende?» | `agency_breakup` |

### Personaliserings-felter Claude bruker

For hvert target henter Claude:
- Byrå-navn + størrelse (fra Brønnøysund)
- Nylige caster-prosjekter (fra deres nettsider)
- Daglig leder + casting-director-navn
- Stylet open-line ("Jeg så at Stella nettopp har caster TROLL — ...")

Konfigurert i `claude-personalization-config.ts` (eksisterer).

---

## 2. Content pillars — 5 + 1

| Pillar | Hovedartikkel | SEO-keyword | GEO-potensial |
|---|---|---|---|
| **GDPR for byråer** | "GDPR-sjekkliste for skuespillerbyråer (2026)" | "GDPR talent administrasjon" | ★★★★★ |
| **Self-tape-praksis** | "Den komplette self-tape-guiden for norske skuespillere" | "self-tape Norge" | ★★★★ |
| **Casting-CRM vs Excel** | "Sluttet du ennå å bruke Excel for casting?" | "casting administrasjon software" | ★★★★★ |
| **AI i casting** | "Bruker Norges byråer Claude og GPT i casting? Vi spurte 12" | "AI casting Norge" | ★★★★ |
| **Bransje-survey** | "Hvor mye tjener norske byråer? 2026-undersøkelsen" | "norsk casting bransje" | ★★★ |
| **+ Caser** | Kunde-cases når vi har | "Stella Casting + The Role Room" | ★★★★ |

### Hver artikkel inneholder

1. Hero-bilde (FAL.ai genererer — `agency_hero` preset)
2. JSON-LD `BlogPosting` + `FAQPage`-schema
3. CTA-blokk midt i artikkelen ("Se hvordan The Role Room løser dette →")
4. 3-5 relaterte artikler i bunnen
5. Nyhetsbrev-tilmelding

### Publiserings-kadens

- 1 ny pillar-artikkel/måned
- 2 mindre support-artikler/uke
- 1 case/sitat per måned (når vi har)

Innhold lagret i `cms_pages`-tabellen (eksisterer). Publik rendering bygges som Task G.

---

## 3. Admin Room — "Byrå-akkvisisjon"-tab

Ny tab i Admin Room som samler alt i én flate. Bygges som Task J.

### Seksjoner

1. **Funnel-stats**: # nye → kontaktet → demo → trial → kunde (henter fra `agency_leads`)
2. **Outreach-pipeline**: target-listen med touch-status per byrå
3. **Lead-feed**: nye `agency_leads`-rader (sortert nyeste først)
4. **Content-kalender**: planlagte og publiserte artikler fra `cms_pages`
5. **Conversion-rate**: % som går mellom hvert trinn

### Workflow

```
1. Daniel åpner Byrå-akkvisisjon-tab
2. Ser 3 nye leads, klikker første
3. Modal viser lead-detaljer + foreslår demo-tid (Calendly-link generert)
4. Daniel sender personalisert e-post med Claude-hjelp (knapp)
5. Sett status: contacted → demo_booked → trial → customer
```

Hver status-overgang trigger automatiske handlinger:
- `contacted` → start outreach-sekvens
- `demo_booked` → Calendly-bekreftelse + reminder 24t før
- `trial` → onboarding-e-post-sekvens (5 dager)
- `customer` → "Velkommen"-pakke + setup-call

---

## 4. Pitch deck

`/pitch` — 12 slides interaktiv presentasjon. Keyboard-navigerbar.

| # | Slide | Innhold |
|---|---|---|
| 1 | Cover | "The Role Room · Operativsystemet for norske skuespillerbyråer" |
| 2 | Problem | 47% e-post-tid · 120 GB spredt · 0 audit |
| 3 | Løsning | 3 moduler: Registry / Self-Tape / Partnership |
| 4 | Marked | TAM €2.4 B · SAM €80 M · SOM €8 M |
| 5 | Produkt | Live nå. 8 funksjons-bullets |
| 6 | Differensiering | Tabell vs Spotlight/Backstage |
| 7 | Forretningsmodell | 4 tiers + ARR-mål 1.8 MNOK år 1 |
| 8 | Go-to-market | 4 faser (awareness → retention) |
| 9 | Status | 365+ PR-er · 10 moduler · 100+ tabeller |
| 10 | Team | Solo founder + Claude Opus 4.7 |
| 11 | Ask | 3 pilot-byråer · intro · 6 mnd sparring |
| 12 | Takk | Kontakt-info |

Daniel deler `theroleroom.com/pitch` som lenke til:
- Pilot-byråer (etter første touch)
- Eventuelle investorer
- Rådgivere
- Mediekontakter

---

## 5. Content-strategi mappet inn i eksisterende content-planner

Vi har **allerede** et komplett content-planner-system. Ingen ny tabell trengs — vi mapper byrå-akkvisisjons-content inn i strukturen som finnes:

### Eksisterende byggeklosser

| System | Hva | Hvor |
|---|---|---|
| `role_room_marketing_plans` | Top-level marketing-plan per business | migrate 0054 |
| `role_room_marketing_plan_pillars` | 3-5 tema-pillars under planen | migrate 0054 |
| `role_room_marketing_plan_posts` | 30-dagers post-plan per pillar | migrate 0054 |
| `content_calendar_events` | Schedulering: blog/video/social/announcement/campaign | migrate 006 |
| `role_room_newsletter_templates` | 3 system-maler for ukesbrev | migrate 170 |
| `ContentCalendarTab.tsx` | Admin Room UI med drag-drop månedlig kalender | `pages/admin-room/` |

### Slik mapper vi byrå-akkvisisjon inn

#### Steg 1: Opprett en marketing-plan for The Role Room (selskaps-plan)

I Admin Room → Content Calendar → "Generér marketing-plan", fyll inn:
- **Business**: The Role Room
- **Industri**: SaaS / casting-software
- **Tone**: Profesjonell, datadrevet, varm
- **Posisjonering**: "Operativsystemet for norske skuespillerbyråer"
- **Mål-audience**: Casting-directors og byrå-eiere

Claude foreslår automatisk 5 pillars.

#### Steg 2: Override med våre 5 pillars

I `role_room_marketing_plan_pillars`, sett (kan gjøres via UI eller direkte i DB):

| Pillar (name) | Description | Rationale | sort_order |
|---|---|---|---|
| GDPR for byråer | Schrems II, audit-trail, talent-eierskap | LLM-er citerer compliance høyest | 1 |
| Self-tape-praksis | Bransje-standard, AI-feedback | Direkte SEO-hit på "self-tape Norge" | 2 |
| Casting-CRM vs Excel | Komparativ tabell, ROI-kalkulator | LLM-er elsker comparison-content | 3 |
| AI i casting | Pro/con, Claude-eksempler | AI er hot tema i bransjen | 4 |
| Bransje-survey | Lønnsomhet, trender, casting-tider | Originalt datapunkt = PR-verdi | 5 |

Hver pillar får 6-8 posts spredt over 30 dager.

#### Steg 3: Schedulere `content_calendar_events`

Per pillar genererer vi events i kalenderen. Eksempel for "GDPR for byråer"-pillaren:

| event_type | title | scheduled_date | marketing_purpose | target_audience |
|---|---|---|---|---|
| `blog` | "GDPR-sjekkliste for skuespillerbyråer (12 punkter)" | Dag 1 | seo | byrå-eier, casting-director |
| `social` | LinkedIn-post om pillar-launch | Dag 1 | brand-awareness | byrå-eier |
| `social` | LinkedIn artikkel (kortere versjon) | Dag 3 | brand-awareness | byrå-eier |
| `announcement` | Newsletter: "GDPR-byrå-tips" til e-post-listen | Dag 5 | lead-generation | newsletter |
| `social` | Twitter-tråd med highlights | Dag 7 | brand-awareness | bredere |
| `campaign` | Outreach Touch 3 bruker artikkelen | Dag 7-21 | lead-generation | targets |
| `video` | YouTube-video: "GDPR for byråer i 4 min" | Dag 14 | seo + brand | byrå-eier |
| `social` | Bransje-Facebook-grupper share | Dag 21 | brand-awareness | bredere |

Tilsvarende for hver av de 5 pillars = **40-50 schedulert content-events over 3 måneder**.

#### Steg 4: Newsletter-maler

Vi bruker eksisterende `role_room_newsletter_templates`:

- **"Standard ukesbrev (6 seksjoner)"** for månedlige byrå-radar
- **"Data drop"** når vi har bransje-tall
- **"Founder POV essay"** for tunge tankeledelse-posts

#### Steg 5: Måling

`ContentCalendarTab.tsx` viser allerede:
- Status per event (planned / in-progress / ready / published / cancelled)
- Progress-percentage
- Assigned-to

Vi kobler `agency_leads.utm_campaign` til pillar-navnet slik at vi kan se hvilken pillar som genererer mest leads.

### Daniel-flyt i Admin Room

```
1. Åpne Admin Room → Content Calendar
2. Velg "The Role Room" som business
3. Se månedlig kalender med alle 50 events fordelt på pillars
4. Drag-drop fra unpublished-panel når innhold er ferdig
5. Hver publisering trigger automatisk:
   - SEO ping (Google Search Console)
   - LinkedIn cross-post (manuelt etter publish)
   - Newsletter-segment (Resend)
6. Lead-attribution per pillar synes i Byrå-akkvisisjons-tab
```

### Kobling til outreach-systemet

Touch 3 + 4 + 5 i outreach-sekvensen lenker direkte til pillar-artikler:

| Touch | Pillar-artikkel som brukes |
|---|---|
| 3 (Dag 7) | "GDPR-sjekkliste for skuespillerbyråer" |
| 4 (Dag 14) | "Northern Lights-casting på 18 timer" (case-studie) |
| 5 (Dag 21) | "Bruker norske byråer AI i casting?" (survey-artikkel) |

Outreach-systemet (eksisterer) henter URL fra `role_room_marketing_plan_posts.published_url` slik at lenkene er live-trafikk-loggable.

---

## 6. Markedsføringskanaler — full mix

Vi orkestrerer 14 kanaler i 3 lag. Hver kanal har sin egen rolle i funnelen.

### Lag 1 — Awareness (TOFU)

| Kanal | Hva | Kostnad/mnd | Time-to-impact | Eier |
|---|---|---|---|---|
| **SEO-content** | 5 pillar-artikler + 8 support-artikler/mnd | 0 (Daniel skriver) | 3-6 mnd | Daniel |
| **GEO-optimization** | JSON-LD + structured data + FAQ-sider | 0 | 1-3 mnd | Allerede bygget |
| **LinkedIn organic** | Daniel poster 3x/uke: bygge-logg, byrå-innsikt, AI-bruk | 0 | 2-4 uker | Daniel |
| **PR / pressemelding** | Ved hver kvartal-milestone (3 pilots, 10 kunder, etc.) | 0-5k (PR-byrå senere) | 2-6 uker | Daniel |
| **Bransje-publikasjoner** | Gjeste-artikler i Rushprint, Filmweb, Klassekampen Kultur | 0 (gratis) | 1-3 mnd | Daniel |
| **Podcast appearances** | Norske media-podcaster (Rushprint Talk, Mediepodden, Tech 'n' Talk) | 0 | 2-4 uker | Daniel |

### Lag 2 — Consideration (MOFU)

| Kanal | Hva | Kostnad/mnd | Time-to-impact | Eier |
|---|---|---|---|---|
| **Personlig outreach** | 6-touch e-post-sekvens (allerede bygd) | 0 (Resend gratis) | 1-2 uker | Auto + Daniel |
| **LinkedIn Sales Navigator** | Søk + connect-requests til casting-directors | ~1k | 1-2 uker | Daniel |
| **Webinarer** | Månedlig "30 min: byrå-økonomi 2026" + demo | 0 (Zoom) | 1 uke | Daniel |
| **Demo-videoer YouTube** | 5 min-videoer per modul, NB tagger | 0 (Playwright) | 3-6 mnd | Daniel |
| **Bransje-events** | Filmfestival Lillehammer, Den norske Filmskolen, Castingforum Oslo | 5-15k per event | 1-3 mnd | Daniel |
| **Newsletter** | Månedlig "Byrå-radar" til e-post-listen | 0 (Resend) | 1-2 mnd | Daniel |

### Lag 3 — Conversion (BOFU)

| Kanal | Hva | Kostnad/mnd | Time-to-impact | Eier |
|---|---|---|---|---|
| **LinkedIn Ads (retargeting)** | Retargete besøkende på /for-byraer | 5-15k | 2-4 uker | Daniel |
| **Google Ads (brand + competitor)** | "Spotlight Norge", "Backstage Norge" | 3-8k | 1-2 uker | Daniel |
| **Affiliate / referral** | 1 gratis måned per kunde-referral | 0 (rabatt) | 3+ mnd | Auto |
| **Demo-call** | 30 min Zoom med ferdig demo-prosjekt på deres data | 0 | umiddelbart | Daniel |
| **Trial-onboarding** | 2 ukers trial + 5-dagers e-post-sekvens | 0 | 2 uker | Auto |

### Total markedsbudsjett

| Fase | Budsjett/mnd | Hovedaktivitet |
|---|---|---|
| **Måned 1-3** (sætte i gang) | ~3k | Personlig outreach + SEO-content + LinkedIn organic |
| **Måned 4-6** (akselerere) | ~10k | + LinkedIn Sales Navigator + Google Ads + 1 event |
| **Måned 7-12** (skalere) | ~25k | + LinkedIn Ads + større events + PR-byrå |

ARR-mål år 1 = 1.8 MNOK → CAC = 25 × 12 = **300k MNOK** = ~17 % av ARR. Solid SaaS-ratio (typisk er 30-40%).

---

## 7. Konkret kanalvalg per pilar-artikkel

Hver pillar-artikkel distribueres i en orkestrert kampanje:

### Eksempel: "GDPR-sjekkliste for skuespillerbyråer"

| Dag | Kanal | Innhold |
|---|---|---|
| 0 | Publisering | Pillar-artikkel publiseres på theroleroom.com/blog |
| 0 | SEO ping | Submit til Google Search Console + Bing Webmaster |
| 0 | LinkedIn | Daniel poster: "Vi bygde en GDPR-sjekkliste. 12 punkter. [link]" |
| 1 | Newsletter | Sendes til e-post-listen (~50 abonnenter til å starte med) |
| 2 | Outreach | Sendes som Touch 3 i e-post-sekvensen |
| 3 | LinkedIn artikkel | Kortere versjon publiseres som LinkedIn Article |
| 5 | Bransje-grupper | Deles i 3 norske casting-grupper på Facebook |
| 7 | Bransje-pub | Pitch til Rushprint som gjeste-artikkel ("Hvor godt er bransjen forberedt?") |
| 14 | Re-share | Daniel re-posts med ny vinkling |
| 30 | Performance-rapport | Vi måler trafikk + leads + LLM-citations |

**Forventet output per pillar**: 200-500 nye besøkende, 5-15 leads, 1-3 LLM-citations innen 30 dager.

---

## 8. Bransje-spesifikke kanaler (Norge)

Norske byråer er små og lytter mest til sine egne. Her er rangerte targets:

### Norske bransje-publikasjoner

1. **Rushprint** (rushprint.no) — den klart største film/TV-publikasjonen. Casting-direktører leser den hver uke.
2. **Filmweb** (filmweb.no) — bredere men når også byrå-eiere.
3. **Klassekampen Kultur** — kritisk perspektiv, lederne leser.
4. **NRKbeta** — for tech-vinklingen.
5. **Skuespillerforbundet** — kan distribuere via deres nyhetsbrev hvis vinklingen er rett.

### Norske podcaster

1. **Rushprint Talk** — direkte bransje-publikum
2. **Mediepodden** — bredere men når også byrå-eiere
3. **Tech 'n' Talk** — for tech-vinklingen
4. **Norway Innovate** — for investor-vinklingen

### Norske events

1. **Filmfestivalen Lillehammer** (mars) — ca. 100 byrå/casting deltar
2. **Den norske Filmskolen** — gjeste-foredrag for kommende casting-directors
3. **Norges Talentforbund** — årsmøte med flertall av byrå-eiere
4. **Castingforum Oslo** (DIY, vi kan arrangere) — vi inviterer 20 byråer til lunsj
5. **Nordisk Filmfond Stockholm** — for å nå svenske byråer i Lag 2

### LinkedIn-grupper og communities

1. **Skuespiller-Norge** (~3 000 medlemmer) — hovedsakelig skuespillere men noen byrå-eiere
2. **Norsk Film og TV-produksjon** (~5 000) — produksjonsteam + byråer
3. **Casting Directors Society Scandinavia** (~400) — direkte målgruppe
4. **Norwegian Producers Guild** — kan henvise byråer til oss

---

## 9. Måling — hva vi tracker

### Vanity-metrics (KPI-er Daniel ser daglig)

- **Trafikk** /for-byraer (Plausible/Google Analytics)
- **Leads** (`agency_leads` rows / dag)
- **Demo-bookings** (status='demo_booked')
- **Trials** (status='trial')
- **Kunder** (status='customer')
- **MRR** (Stripe-data)

### LLM-citation-tracking

Eksisterende `role_room_ai_citation_tracker` (migrate 177) overvåker:
- Hvilke pillar-artikler blir citert av Claude/GPT/Perplexity
- Citation-rate per artikkel per måned
- Konvertering fra LLM-traffic til lead

### Funnel-conversion

| Trinn | Mål-% | Hvis under |
|---|---|---|
| Besøker → Lead | 2-4 % | Forbedre hero/CTAer |
| Lead → Demo | 30-50 % | Forbedre outreach-personalisering |
| Demo → Trial | 50-70 % | Forbedre demo-script |
| Trial → Kunde | 30-50 % | Forbedre onboarding |

Alle målinger eksponeres i Admin Room "Byrå-akkvisisjon"-tab (Task J).

---

## 11. Hva vi mangler å bygge

| Task | Tilstand | Trenger |
|---|---|---|
| G — Blog publik-UI | Pending | Daniel-innhold (3 startartikler) |
| H — Screenshots av demo-modus | Pending | Playwright-kjøring post-deploy (ingen kode) |
| `industry_targets`-seed med 30 byråer | Pending | Daniel-research (1-2 timer) |
| Calendly-integrasjon i Admin Room | Pending | Calendly-API-nøkkel |
| FAL_API_KEY på Render | Pending | Daniel betaling + token |

---

## 12. Konkret neste-skritt

1. **Denne uken**: Seed 30 byrå-targets i Admin Room manuelt
2. **Denne uken**: Skrive første pillar-artikkel ("GDPR-sjekkliste")
3. **Neste uke**: Kjøre første outreach-touch på Tier-1 byråer (Daniel personlig, ikke automatisk)
4. **Innen 2 uker**: 3 pilot-samtaler booket
5. **Innen 1 måned**: Første pilot-byrå live
6. **Innen 3 måneder**: 5 betalende byråer
7. **Innen 6 måneder**: € 30k MRR

---

*Sist oppdatert: 2026-06-06. Vedlikeholdes av Daniel + Claude.*
