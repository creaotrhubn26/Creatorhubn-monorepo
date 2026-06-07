# TheRoleRoom — BankID: beslutningsnotat

> Følgenotat til produktdokumentasjonen. Bygget 2026-05-27.
> Priser er hentet fra leverandørenes nettsider mai 2026 og **må bekreftes med leverandør**
> før beslutning. Valutakurs brukt: 1 EUR ≈ 11,7 kr.

---

## Sammendrag / anbefaling (TL;DR)

- **Du integrerer ikke «BankID» direkte** — du går via en sertifisert partner/broker som
  håndterer integrasjon, drift, support og fakturering.
- **Anbefalt leverandør: Idura** (tidligere Criipto). Den er nå **eid av Stø — selskapet som
  utsteder BankID** — så du får «BankID fra kilden», med rask integrasjon (timer til en dag),
  enkelt dashboard, gratis testmiljø og transparente priser. Den støtter også **Vipps
  MobilePay** og svensk/dansk eID, som er nyttig for fremtidig europeisk skalering.
- **Anbefalt produkt-rekkefølge:** ta i bruk **Verify** (identitetsverifisering) *og*
  **Signatures** (juridisk bindende signering) **fra start** — signering må med fra dag én
  fordi samtykke fra mindreårige (foresatte) skal være juridisk bindende.
- **Hent flere tilbud:** send tilbudsforespørselen i Seksjon 9 til en shortlist (Idura,
  Signicat, Scrive m.fl.) og sammenlign — ikke lås deg til én leverandør før du har tall.
- **Kostnaden er mindre enn du frykter** *hvis* du bruker BankID på **verifiserings- og
  signeringshendelser** (registrering, kontraktsignering), ikke på hver innlogging.
  Realistisk tidlig: **~1 000 kr/mnd**.
- **Timing er gunstig:** BankID Norge gikk i 2026 over til én utsteder (**Stø AS**), med
  store tekniske endringer rundt 1. mai 2026. Å bruke en **Stø-eid broker (Idura)**
  reduserer overgangsrisikoen.

---

## 1. Hva trenger TheRoleRoom BankID til?

Tre distinkte behov — de krever ulike produkter:

| # | Behov | Hvorfor | BankID-produkt |
|---|---|---|---|
| 1 | **Verifisere at folk er ekte** ved registrering | Tillit i casting; trygghet rundt mindreårige; seriøse produksjonsselskaper | Verifisering / autentisering (Idura **Verify**) |
| 2 | **Juridisk bindende signaturer** på kontrakter og samtykke | Talentkontrakter, samtykke (særlig mindreårige/foresatte) | Signering (Idura **Signatures**) |
| 3 | **Sikker innlogging / step-up** for sensitive handlinger | Beskytte tilgang til produksjonsdata | Autentisering (valgfritt, fase 3) |

> **Du har allerede deler av dette:** BRREG verifiserer *selskaper*, og Google Workspace gir
> enkle e-signaturer. BankID er oppgraderingen for å verifisere *personer* og for *juridisk
> bindende* signering. Behold gjerne Google-signering for lav-risiko, og bruk BankID-signering
> der det virkelig teller (kontrakter, mindreårige).

---

## 2. Hvordan BankID faktisk fungerer

Man kobler seg **ikke** direkte på BankID. Man velger en **partner/broker** som er sertifisert
av Stø (BankID-utsteder). Brokeren håndterer integrasjon (API/OIDC), drift, support og
fakturering. Det betyr lavere teknisk byrde for et lite team, mot en margin på toppen av
BankIDs grunnpris.

---

## 3. Viktig timing: Stø-overgangen i 2026

- BankID Norge har konsolidert til **én utsteder: Stø AS**, med store tekniske endringer som
  trådte i kraft rundt **1. mai 2026**.
- En ny **PAdES-basert signeringstjeneste** lanserte i september 2025 og erstatter det gamle
  SEID SDO-formatet.
- **Konsekvens for deg:** integrer på den *nye* plattformen. En **Stø-eid broker (Idura)** er
  per definisjon på den nye plattformen og bærer overgangen for deg — et reelt argument for å
  velge Idura nettopp nå.

---

## 4. Leverandørvalg

| | **Idura** (tidl. Criipto) | **Signicat** | Direkte hos Stø |
|---|---|---|---|
| Eierskap | **Eid av Stø (BankID-kilden)** | Uavhengig (størst i Norge; kjøpte Idfy) | Utsteder selv |
| Integrasjonstid | **Timer–en dag** | Lengre, enterprise-orientert | Tyngst (krev. egen sertifisering) |
| Profil | Lett, transparent, selvbetjent | Enterprise, bredt funksjonssett | For store volum / direkte avtale |
| eID-dekning | BankID, Vipps MobilePay, svensk/dansk/finsk m.fl. | Tilsvarende bredt | BankID |
| Gratis testmiljø | **Ja (uten kort)** | Ja | — |
| Passer TheRoleRoom nå? | **✅ Ja — start her** | Senere, ved enterprise-behov | Nei (for tidlig) |

**Anbefaling:** start med **Idura**. Vurder Signicat kun hvis du senere får enterprise-behov
(f.eks. dype NRK/TV2-integrasjoner eller avansert compliance).

---

## 5. Produktvalg hos Idura

- **Idura Verify** — eID-innlogging/verifisering. Støtter norsk BankID + Vipps MobilePay +
  nordisk/europeisk eID. API-basert, dokumentasjon på docs.idura.app, gratis test. → **Behov 1
  (og 3).**
- **Idura Signatures** — juridisk bindende, merkevare-tilpasset signering. Samme eID-dekning.
  → **Behov 2.**
- Øvrige (ikke prioritert nå): Caller Authentication, Address Lookups, Age Verification
  (MitID), ID Wallet (beta).

---

## 6. Kostnad — konkret for TheRoleRoom

**Idura Verify — abonnement (per mnd, −10 % ved årlig):**

| Plan | Inkl. innlogginger/mnd | Pris | ≈ NOK |
|---|---|---|---|
| Small | 1 000 | €67 | ~785 kr |
| Medium | 5 000 | €220 | ~2 575 kr |
| Large | 10 000 | €400 | ~4 680 kr |
| Enterprise | 50 000+ | Custom | — |

**Per-transaksjon eID-gebyr (på toppen):**

| eID | Pris | ≈ NOK |
|---|---|---|
| Norsk BankID (biometri) | €0,089 | ~1,04 kr |
| Norsk BankID (high authentication) | €0,126 | ~1,47 kr |
| Vipps MobilePay | Custom (per aktive brukere) | — |

Overforbruk over kvoten: per-innlogging-rate (f.eks. ~€0,48 på Small-planen). Engangs
onboarding-gebyr *kan* påløpe for enkelte eID-er.

**Regneeksempel (tidlig fase):** ~300 BankID-verifiseringer/mnd (nye kunder + talent +
signeringer):

> Small-plan €67 + 300 × €0,089 ≈ **€94/mnd ≈ ~1 100 kr/mnd.**

Mot kostnadsbasen i enhetsøkonomi-notatet (~70 000 kr/mnd faste kostnader) er dette
**marginalt** — *forutsatt* at BankID brukes på **verifiserings-/signeringshendelser**, ikke
på hver eneste innlogging. Det er den ene kostnadsspaken som betyr noe.

> **Datalagring/GDPR:** Idura/Criipto er København-basert (EU/EØS) — i tråd med EU-kravet i
> arkitekturen (Seksjon 4).

---

## 7. Anbefalt utrulling i faser

| Fase | Når | Hva | Est. kost |
|---|---|---|---|
| **0 — Prototyp** | Nå | Opprett gratis testkontoer hos aktuelle leverandører; prototyp Verify + Signatures mot BankID. Ingen produksjon. | 0 kr |
| **1 — Produksjon: Verify + Signatures** | **Ved 10 ekte brukere** (ikke testere) | Verify på registrering (produksjonsselskaper + talent) **og** Signatures for kontrakter/samtykke — signering med fra start pga. mindreårige | ~785–1 100 kr/mnd + signeringsgebyr |
| **2 — Step-up login** | Ved behov for ekstra sikring av sensitive handlinger | BankID som step-up autentisering | Per transaksjon |

---

## 8. Beslutninger du må ta + neste steg

**Bekreftede beslutninger:**
1. **Leverandør:** hent tilbud fra flere (shortlist i Seksjon 9) — Idura er favoritt, men
   velges først etter sammenligning.
2. **Trigger for produksjon (Fase 1):** **10 ekte brukere** (ikke testere).
3. **Signering med fra start:** **ja** — pga. juridisk bindende samtykke fra mindreårige.

**Neste steg (konkret):**
1. Send tilbudsforespørselen i Seksjon 9 til shortlisten.
2. Opprett gratis testkontoer (Idura m.fl.) og prototyp mens du venter på tilbud.
3. Sammenlign tilbudene på: pris per BankID-transaksjon, **signeringsgebyr**, abonnement,
   engangs-/onboarding-gebyr, bindingstid, mva og avtalevilkår (årlig gir ofte rabatt).
4. Velg leverandør og sett produksjon live ved 10 ekte brukere.

---

## 9. Tilbudsforespørsel (RFQ) — klar til å sendes

**Shortlist (alle leverer både autentisering og signering der annet ikke er nevnt):**

| Leverandør | Profil | Nettsted |
|---|---|---|
| **Idura** (tidl. Criipto) | Stø-eid, «fra kilden», rask integrasjon | idura.eu |
| **Signicat** | Størst i Norge, enterprise (eier Idfy) | signicat.com |
| **Scrive** | Signering-sterk, eIDAS, nordisk eID | scrive.com |
| KOIA | «Enkleste» BankID-autentisering, prisgaranti (auth-fokus) | koia.no |
| IN Groupe Trust Services (tidl. Nets) | 20+ år, GDPR/eIDAS 2.0 | — |

> **Anbefalt minimum:** send til **Idura, Signicat og Scrive** (alle dekker både Verify og
> Signatures). Legg til KOIA / IN Groupe hvis du vil ha flere sammenligningspunkter.

**E-post (kopier og tilpass):**

> **Emne:** Tilbudsforespørsel — BankID autentisering + signering (norsk SaaS)
>
> Hei,
>
> Vi er TheRoleRoom (del av CreatorHub) — en norsk SaaS-plattform for film- og
> innholdsproduksjon. Vi planlegger å ta i bruk BankID og ønsker tilbud på to behov:
>
> 1. **Identitetsverifisering / innlogging (eID):** verifisere at brukere er ekte ved
>    registrering. Primært norsk BankID. Ønsker gjerne også Vipps MobilePay og svensk/dansk
>    eID med tanke på fremtidig nordisk/europeisk skalering.
> 2. **Juridisk bindende signering:** signering av kontrakter og **samtykke, inkludert
>    samtykke fra foresatte for mindreårige**. PAdES-basert.
>
> **Forventet volum (tidlig fase, første år):** ~200–500 verifiseringer/mnd og ~100–300
> signeringer/mnd, med skalering mot flere tusen etter hvert.
>
> Vi ber om at tilbudet dekker:
> - Pris per BankID-transaksjon (autentisering — biometri vs. «high»)
> - Pris per signering (PAdES)
> - Abonnement / plattformavgift
> - Engangs- / onboarding-gebyr
> - Eventuell minimumsforpliktelse / bindingstid
> - Månedlig vs. årlig pris (og rabatt ved årlig)
> - Integrasjonsmetode (API/OIDC), estimert tid til go-live, og testmiljø
> - Datalagring (EU/EØS) og eIDAS-status
> - Beste praksis for håndtering av mindreårige-samtykke (foresatte)
> - Alle priser eks. og inkl. mva
>
> Vi sammenligner flere tilbud og tar sikte på produksjon når vi har 10 aktive brukere. Sett
> gjerne opp en kort intro-samtale.
>
> Vennlig hilsen,
> [Navn] — TheRoleRoom / CreatorHub
> [kontaktinfo]

---

## Kilder

- [Idura — Norwegian BankID](https://idura.eu/electronic-identities/norwegian-bankid)
- [Idura — produkter](https://idura.eu/products)
- [Idura Verify — priser](https://idura.eu/pricing/idura-verify)
- [Idura — om oss](https://idura.eu/about)
- [BankID — priser (bedrift)](https://bankid.no/bedrift/priser)
- [BankID — partnere (autentisering)](https://bankid.no/bedrift/bankid-partnere/partnere-autentisering)
- [Signicat — Norwegian BankID / Stø-endringer](https://www.signicat.com/about/norwegian-bankid-sto-changes-and-their-effects-on-signicat-solutions)
- [Signicat kjøper Idfy](https://www.signicat.com/press-releases/signicat-acquires-norwegian-digital-identity-specialist-idfy)
- [Criipto — Norwegian BankID](https://www.criipto.com/norway-bankid)
- [BankID — partnere (oversikt)](https://bankid.no/bedrift/bankid-partnere)
- [BankID — andre tilbydere av BankID-tjenester](https://bankid.no/bedrift/andre-tilbydere-av-bankid-tjenester)
- [Scrive](https://www.scrive.com/)
- [Nkom — Tillitsliste (Trusted List)](https://nkom.no/internett/elektronisk-id-og-tillitstjenester/tillitsliste-trusted-list)
