# Regulatorisk etterlevelse — status per krav

*Vurdering per 2026-07-13, holdt opp mot implementasjonen på denne branchen.
Status: ✅ implementert og testet · 🟡 delvis · ❌ mangler (planlagt/avklaring kreves).
Juridiske konklusjoner her er utviklingsteamets vurdering og skal kvalitetssikres
av statsautorisert regnskapsfører og advokat før produksjonslansering (se nederst).*

## 1. Bokføringsloven og bokføringsforskriften

| Krav | Status | Hvor |
|---|---|---|
| Fullstendig/nøyaktig registrering, debet=kredit | ✅ | `src/ledger/engine.ts` (validering før insert) + DB-constraints; property-testet |
| Toveis kontrollspor bilag ↔ postering ↔ rapport | ✅ | `source_document_id` på bilag, `suggestionId`-kjede, testet i pipeline-testene (scenario 8) |
| Entydig identifikasjon (bilagsnummer) | ✅ | Løpende `entry_number` per organisasjon under radlås |
| Sikring mot urettmessig endring/sletting | ✅ | Append-only-triggere i DB (migrasjon 0001/0002/0004), rettes kun med reversering/kreditnota |
| Systemgenererte posteringer etterprøvbare | ✅ | Posteringslinjer + `posting_suggestions` med engine/beslutter/tidspunkt + revisjonslogg |
| Systemdokumentasjon av funksjon og kontroller | 🟡 | `docs/accounting-engine.md` m.fl. finnes; formell «systembeskrivelse etter bokføringsforskriften § 3-2» er ikke skrevet |
| Sikring mot TAP (backup/restore) | ❌ | Ingen backup-/gjenopprettingsrutine er implementert eller testet — driftskrav før produksjon |

## 2. Oppbevaring og eksport

| Krav | Status | Hvor |
|---|---|---|
| Uforanderlig dokumentarkiv med integritetssjekk | ✅ | ObjectStorage uten delete-metode, sha256 verifiseres ved uthenting |
| Eksport av regnskapsdata | ✅ | SAF-T-eksport + rapporter; hver eksport auditlogges |
| 5 år / 3,5 år oppbevaringsfrister | 🟡 | Designet for det (`docs/data-retention.md`, ingen slettefunksjon finnes) — men ingen automatisert fristhåndtering |
| Tilgang etter avsluttet abonnement / leverandøravvikling | ❌ | Exit-rutine er ikke designet — må inn i avtaleverk og drift |
| Backup/restore-testing | ❌ | Se pkt. 1 |

## 3. SAF-T

✅ Bygget inn i datamodellen fra start (kontoplan NS 4102, SAF-T-koder som mva-koder,
bilagsreferanser, perioder, saldoer) og eksporten **valideres automatisk mot
Skatteetatens offisielle XSD v1.10** i testene (`vendor/saf-t`, `test/saft.pg.test.ts`).
🟡 Gjenstår: SourceDocuments-/AnalysisType-noder (dimensjonene finnes i datamodellen)
og test mot Altinns innsendingsvalidator.

## 4. Fakturakrav (bokføringsforskriften kap. 5)

| Krav | Status |
|---|---|
| Maskinelt, fortløpende fakturanummer (bruker kan ikke velge) | ✅ nummer tildeles ved utstedelse under radlås, uten hull |
| Utstedt faktura kan ikke endres/slettes | ✅ DB-triggere; rettes med kreditnota |
| Kreditnota refererer original | ✅ `credits_invoice_id` |
| MVA spesifisert per sats | ✅ per linje, deterministisk fra regelregisteret |
| Komplett innholdskrav (selgers adresse, leveringstid/-sted, «MVA»-suffiks) | ✅ adressefelt på selger/kjøper (migrasjon 0006), leveringsdato/-sted per faktura, «MVA» bak org.nr. kun ved registrert status, «Foretaksregisteret» for AS; utstedelse blokkeres til selgeropplysningene er komplette, og mva-faktura krever MVA-registrering (mval. § 15-11) |
| Salgsdokument kan gjengis (utskriftsvennlig) | ✅ `GET /invoices/:id/document` — HTML med alle pliktige felter, mva per sats; kladder avvises; hver gjengivelse auditlogges |
| Kontroll mot MVA-registeret | ✅ Brreg-oppslag (åpne data) med lagret resultat, avviksflagg og revisjonsspor (`src/integrations/brreg.ts`) |
| Utsending (PDF/EHF/e-post) | ❌ ikke bygget — dokumentet finnes som HTML, men ingen forsendelseskanal |

## 5. Versjonerte regler

✅ Kjernedesign fra dag én: `src/rules/` med gyldighetsperioder, kilder og versjoner;
en 2025-transaksjon beregnes med 2025-regler uansett når den åpnes (dato-baserte
oppslag, testet). AI er aldri kilde til satser/frister/saldoer.
⚠️ Innholdet er lagt inn per kunnskapsdato 2026-01 og MÅ fagkontrolleres
(særlig 2026-satser) — se `docs/compliance-source-register.md`.

## 6. Fradragsspråk

✅ Produktprinsipp implementert: forslag viser vilkår, forutsetninger, mangler og
alternativer med kilder; skillet kostnadsføring/skattefradrag/MVA-fradrag/aktivering
ligger i kodebiblioteket og skatteestimatet viser komponenter med usikkerhet —
aldri «du sparer X kroner».

## 7. GDPR

| Krav | Status |
|---|---|
| Rollebasert tilgang, tenant-isolasjon, logging av dokumenttilgang | ✅ implementert og testet |
| Datalagring/oppbevaring vs. sletting dokumentert | ✅ `docs/data-retention.md` (art. 17(3)(b)-avveiningen) |
| Databehandleravtale, behandlingsprotokoll, underleverandørliste | ❌ juridiske dokumenter — ikke laget |
| DPIA (personvernkonsekvensvurdering) | ❌ påkrevd før produksjon gitt e-postskanning + KI-klassifisering |
| Kryptering i objektlager, EU/EØS-lagring | ❌ lokal ukryptert disk i MVP (dokumentert); produksjon krever kryptert EU/EØS-lager |

## 8. Gmail-skanning

✅ Designet etter minste tilgang: brukervalgte etiketter (tomt = ingen skanning),
avsender-/datofilter, lesetilgang, kontrollert token-stopp, prompt-injection-vern
(også på OCR-tekst). Status rapporteres ærlig som sandbox.
❌ Ikke adressert: vernet mot at arbeidsgiver kobler til ansattes personlige
jobbinnboks (e-postforskriften) — må inn som produktregel før ekte OAuth aktiveres.

## 9. KI-kontroll

✅ `requiresHumanReview: true` er skjematvunget; ingen kodesti bokfører uten
menneskelig godkjenning med RBAC; forslag lagrer engine, funn, forutsetninger,
alternativer, usikkerhet, regelreferanser, beslutter og tidspunkt.
🟡 Terskelbasert eskalering (beløpsgrenser, avvik fra leverandørhistorikk) er
delvis (aktiveringsgrense, utenlandsflagg); ikke komplett policy.

## 10. Grensen mot regnskapsføringsvirksomhet (regnskapsførerloven)

Programvaren FORESLÅR og brukeren bokfører — vi påtar oss ikke regnskapsoppdrag.
❌ Grensedragningen må vurderes av advokat før lansering, særlig hvis det tilbys
«ferdig kontrollert» tjeneste oppå produktet.

## 11. Bank/PSD2

✅ MVP holder seg utenfor konsesjonsplikt: manuell CSV-import, ingen kontotilgang,
ingen betalingsinitiering (bevisst valg, `docs/decision-log.md`).
Fremtidig banktilkobling skal gå via lisensiert open banking-leverandør.

## 12. Funksjonsavhengige regelverk

- **Kassasystem**: ikke bygget, ikke planlagt i MVP → kassasystemlova ikke utløst.
- **EHF/Peppol**: ikke bygget; krever aksesspunkt når det bygges.
- **Altinn/Skatteetaten-innsending**: ikke bygget; MVA-rapport er alltid kladd.
  Fullmakts-/systembrukermodell (Maskinporten m.m.) må designes før innsending.

## Påkrevde eksterne kontroller før produksjon (blokkerende)

1. **Statsautorisert regnskapsfører**: kontoplan, MVA-koder, regelregisterinnhold,
   posteringsmønstre og testscenarioer.
2. **Advokat**: databehandleravtale, vilkår, DPIA, regnskapsførerlov-grensen,
   e-postinnsynsreglene.
3. **Drift**: backup/restore med gjenopprettingstest, kryptert EU/EØS-lagring,
   exit-/avviklingsrutine for oppbevaringspliktig materiale.
4. **Sikkerhet**: penetrasjonstest og produksjonsautentisering (BankID/OIDC + MFA).
