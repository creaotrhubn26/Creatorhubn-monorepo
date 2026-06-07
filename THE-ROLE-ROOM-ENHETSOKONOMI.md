# TheRoleRoom — Enhetsøkonomi & break-even-modell

> Følgenotat til produktdokumentasjonen. Bygget 2026-05-27.
> **Alle tall er antakelses-baserte** (produktet er pre-revenue) og ment å justeres etter
> hvert som ekte data kommer inn. Antakelsene er gjort synlige slik at de kan endres.
>
> **Valutakurs:** 1 USD = 10,5 kr. **Mva:** alle priser er eks. mva (25 % mva er
> gjennomstrømming, ikke inntekt).

---

## Sammendrag (headline)

| Mål | Base-scenario |
|---|---|
| **MRR ved målbildet** (500 brukere + 15 selskaper) | **~242 000 kr/mnd** |
| **ARR ved målbildet** | **~2,9 mill. kr/år** |
| **Resultat ved målbildet** (etter drift + din grunnlønn) | **~ +128 000 kr/mnd (~+1,5 mill. kr/år)** |
| **Break-even (blandet miks)** | **~180 betalende kunder** (~35 % av målbildet) |
| **Break-even (kun produksjonsselskaper)** | **~24 selskaper** |

**Hovedbudskap:** Det definerte målbildet ligger **komfortabelt over break-even**.
Break-even nås rundt **en tredjedel** av veien dit. Produksjonsselskaper er den klart
sterkeste motoren per kunde.

---

## 1. Antakelser (alle justerbare)

| # | Antakelse | Base-verdi |
|---|---|---|
| A1 | Seter per produksjonsselskap | 4 |
| A2 | Antall produksjonsselskaper | 15 (i tillegg til de 500) |
| A3 | De 500 brukerne: innholdsprodusent | 250 |
| A4 | De 500: dans frilans | 200 (80 free / 90 Frilanser / 30 Pro) |
| A5 | De 500: dans studio | 50 studioer (60 % Start / 30 % Studio / 10 % Pro) |
| A6 | Din grunnlønn (brutto) | 45 000 kr/mnd (540 000 kr/år) |
| A7 | Lønnspåslag (arb.giveravg. + feriepenger + pensjon) | ×1,30 → 58 500 kr/mnd |
| A8 | Hosting-kost per aktiv bruker | $1,20/mnd (~12,6 kr) |
| A9 | Stripe-gebyr | ~2,5 % av MRR |
| A10 | AI-kost (Claude, dagens features — Agent ikke skipet) | ~8 000 kr/mnd |
| A11 | Gjennomsnittlig kundelevetid (for LTV) | 36 mnd |

> **Merk B2B2C-effekten:** crew, klienter og studio-medlemmer dras inn som *gratis*
> brukere. De gir vekst og anbefaling, men koster hosting uten å betale direkte — det er
> derfor «aktive brukere» (~2 160) er langt høyere enn «betalende kunder» (515).

---

## 2. Inntekt ved målbildet

| Segment | Antall | Pris (blended) | MRR |
|---|---|---|---|
| Produksjonsselskaper | 15 × 4 seter | 795 kr/sete | 47 700 kr |
| Innholdsprodusent | 250 | 495 kr | 123 750 kr |
| Dans frilans | 200 (80 free) | ~112 kr (m/free-dilusjon) | 22 380 kr |
| Dans studio | 50 studioer | ~968 kr/studio | 48 405 kr |
| **Sum MRR** | **515 betalende** | | **~242 235 kr** |
| **ARR** | | | **~2 906 820 kr** |

---

## 3. Kostnadsstruktur

**Variable kostnader (COGS):**

| Post | Beregning | Kr/mnd |
|---|---|---|
| Hosting | ~2 160 aktive × $1,20 × 10,5 | 27 216 |
| AI (Claude) | Dagens bruk (Agent ikke skipet) | 8 000 |
| Stripe-gebyr | 2,5 % × 242 235 | 6 056 |
| CDN / lagring / e-post / SMS-infra | Estimat | 3 000 |
| **Sum variabelt** | | **~44 272** |

**Faste kostnader:**

| Post | Kr/mnd |
|---|---|
| Din grunnlønn (loaded, A6×A7) | 58 500 |
| Plattform (Neon, Vercel, monitoring, domener) | 7 000 |
| Verktøy / SaaS / regnskap / forsikring | 4 000 |
| **Sum fast** | **~69 500** |

---

## 4. Resultat ved målbildet (P&L)

| Linje | Kr/mnd | Kr/år |
|---|---|---|
| Inntekt (MRR) | 242 235 | 2 906 820 |
| − Variable kostnader | −44 272 | −531 264 |
| **= Dekningsbidrag** | **197 963** | **2 375 556** |
| − Faste kostnader | −69 500 | −834 000 |
| **= Resultat** | **+128 463** | **+1 541 556** |

> Dekningsgrad ≈ 82 % (svært høy — typisk for SaaS). Det betyr at hver ekstra krone i
> inntekt over break-even nesten i sin helhet faller til bunnlinjen.

---

## 5. Break-even

**Blandet miks:** gjennomsnittlig dekningsbidrag per betalende kunde ≈ 384 kr/mnd.

> Break-even ≈ 69 500 / 384 ≈ **~180 betalende kunder** (i samme miks som målbildet) —
> altså ca. **35 %** av veien til målbildet.

**Kun produksjonsselskaper** (sterkeste motor): dekningsbidrag ≈ 2 872 kr/mnd per selskap.

> Break-even ≈ 69 500 / 2 872 ≈ **~24 selskaper**.
> De 15 selskapene i målbildet dekker alene ~62 % av de faste kostnadene — resten dekkes
> raskt av brukerbasen.

---

## 6. Tre scenarioer

| | Konservativ | **Base** | Optimistisk |
|---|---|---|---|
| Seter/selskap · antall selskaper | 3 · 12 | 4 · 15 | 5 · 18 |
| Brukerbase nådd | ~70 % (≈350) | 100 % (500) | 110 % + Agent-add-on |
| **MRR** | ~158 000 kr | ~242 000 kr | ~333 000 kr |
| **ARR** | ~1,9 mill. | ~2,9 mill. | ~4,0 mill. |
| Variable kostnader | ~31 500 | ~44 300 | ~67 600 |
| Faste kostnader | ~69 500 | ~69 500 | ~70 000 |
| **Resultat/mnd** | **~ +57 000** | **~ +128 000** | **~ +195 000** |
| **Resultat/år** | **~ +0,7 mill.** | **~ +1,5 mill.** | **~ +2,3 mill.** |

Alle tre scenarioene er **lønnsomme ved målbildet** — forskjellen er hvor mye margin, ikke
om det går rundt.

---

## 7. CAC / LTV / payback (illustrativt)

CAC er ukjent (pre-revenue), men vekststrategien er **referral-drevet** → forventet **lav
CAC**. Illustrative tall:

| Segment | Dekningsbidrag/mnd | Antatt CAC | Payback | LTV (36 mnd) | LTV/CAC |
|---|---|---|---|---|---|
| Produksjonsselskap | ~2 872 kr | ~8 000 kr | ~2,8 mnd | ~103 000 kr | ~13× |
| Innholdsprodusent | ~450 kr | ~1 500 kr | ~3,3 mnd | ~16 200 kr | ~11× |
| Dans (betalende) | ~130 kr | ~800 kr | ~6 mnd | ~4 700 kr | ~6× |

> Tommelfingerregel: LTV/CAC > 3× og payback < 12 mnd regnes som sunt. Alle tre segmentene
> passerer dette med god margin **hvis** CAC holdes lav via referral. Dette er den
> sterkeste enkelt-historien til en investor.

---

## 8. Sensitivitet — hva endrer svaret mest

1. **Din lønn / ansettelser** — den dominerende faste kostnaden. Hver ny ansatt (~60–80k
   kr/mnd loaded) flytter break-even opp med ~20–25 selskaper eller ~150–200 brukere.
2. **Seter per produksjonsselskap** — høyt bidrag per sete; 3 → 5 seter endrer
   selskaps-inntekten med ~50 %.
3. **AI-kost når Agenten skipes** — den største kostnadsrisikoen. Bør håndteres ved å gjøre
   Agenten til en **metered/premium add-on** så COGS følger inntekt (jf. monetiserings-
   kandidat 5.5).
4. **Free→betalende-konvertering i dans** — gratis-tieren fortynner; konverteringsraten må
   følges.
5. **B2B2C-hosting** — gratis innslepte brukere koster hosting; bruk-grenser (finnes
   allerede) holder kostnaden i sjakk.

---

## 9. Anbefalinger

1. **Prioriter produksjonsselskaper** — høyest dekningsbidrag og raskest payback. Bekrefter
   at de er den sterkeste motoren (jf. Seksjon 7).
2. **Gjør AI/Agenten til metered eller premium add-on** — hold COGS på linje med inntekt før
   Agenten skipes bredt.
3. **Bruk per-bruker-lønnsomhets-trackingen** (finnes allerede i koden) til å validere disse
   antakelsene mot de første ekte kundene — bytt ut estimatene med faktiske tall.
4. **Hold CAC lav via referral** — det er LTV/CAC-forholdet som gjør reisingen overbevisende.
5. **Følg free-tier-konvertering i dans** og sett bruk-grenser som demper B2B2C-hostingkost.

---

*Neste steg: når de første betalende kundene er på plass, erstattes antakelsene A8–A11 med
målte verdier, og modellen blir et levende styringsverktøy i stedet for et estimat.*
