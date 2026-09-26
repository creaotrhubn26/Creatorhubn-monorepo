# DPIA — lydopptak i Nexus

**Status: UTKAST. Ikke godkjent. Skrevet av Claude 2026-09-26 som grunnlag
for en vurdering, ikke som en vurdering.**

Dette dokumentet beskriver behandlingen slik den faktisk er implementert, og
peker på hva som gjenstår. Punktene under «Åpne spørsmål» kan ikke besvares
av den som skrev koden — de krever noen med ansvar for behandlingen.

Behandlingsansvarlig: kunde-organisasjonen.
Databehandler: Creatorhub AS.
Gjelder: `docs/leadgrid-gdpr-lydopptak.md` §8.

---

## 1. Behandlingen

Nexus er en tegneflate i Leadgrid-appen for iPad. Selgeren skriver notater
med Apple Pencil under kundemøter. To opptaksmodus:

| | Referat | Lyd og referat |
|---|---|---|
| Krever nøkkel | nei | `leadbookLydopptak` |
| Talegjenkjenning | på enheten, nb-NO | på enheten, nb-NO |
| Rå lyd lagres | **nei** | ja, S3, kryptert i ro |
| Tekst lagres | ja, m/ tidsstempler | ja, m/ tidsstempler |
| Samtykke per samtale | nei | ja, hard gate |
| Slettefrist rå lyd | ikke relevant | 90 dager (org kan velge 1–365) |

Formål: at selgeren skal kunne finne igjen hva som ble sagt der han skrev
noe. Teksten knyttes til blekkets tidsstempler, slik at et strøk kan slås
opp mot ytringen som falt samtidig.

## 2. Nødvendighet og proporsjonalitet

Referat-modus dekker formålet uten å lagre stemme. Den er standard.

Lyd-modus gir én ting referatet ikke gir: muligheten til å HØRE tonefallet.
For salgscoaching er det en reell forskjell — en innvending sagt spøkefullt
og en sagt alvorlig transkriberes likt.

**Vurdering:** formålet nås i det vesentlige uten rå lyd. Lyd-modus er
derfor riktig plassert som opt-in per organisasjon OG per samtale, ikke som
standard. Det bør vurderes om merverdien forsvarer behandlingen i det hele
tatt, eller om coaching kan skje på tekst alene.

## 3. Risiko

| Risiko | Alvorlighet | Tiltak i dag |
|---|---|---|
| Gjenkjennbar stemme lagret | Høy | Opt-in ×2, 90 dagers frist, kryptert i ro |
| Sensitive ytringer fanges utilsiktet (helse, økonomi, tredjepart) | Høy | **Ingen.** Se åpne spørsmål |
| Feiltranskripsjon tillegges kunden | Middels | Teksten er redigerbar; originalen finnes i 90 dager |
| Opptak brukes mot ansatt | Høy | §7 krever skriftlig rutine; ikke teknisk håndhevet |
| Tredjepart i rommet som ikke samtykket | Høy | **Ingen.** Se åpne spørsmål |
| Lyd blir liggende etter trukket samtykke | Middels | Sletting er umiddelbar og logges |

## 4. Tiltak som er implementert

- Samtykke per samtale, hard gate: mikrofonen starter ikke uten bekreftelse
- Egen ordlydsversjon (`nexus-lyd-v1-2026-09-25`) som sier at lyden lagres,
  hvor lenge, og at den kan slettes på forespørsel
- Org-nivå entitlement som krever §7-bekreftelse (fire punkter)
- Slettefrist 90 dager, org kan velge kortere, aldri lenger enn 365
- Etterprøvbar slettelogg som overlever innholdet den beskriver
- Trekk av samtykke sletter lyd OG referat umiddelbart
- Talegjenkjenning uten skyfallback: lyden forlater ikke enheten i
  referat-modus

## 5. Åpne spørsmål — kan ikke besvares av utvikleren

1. **Tredjepart i rommet.** Samtykket innhentes fra «kunden». Sitter det to
   personer der, har bare den ene sagt ja. Skal opptak nektes ved mer enn én
   motpart, eller skal ordlyden dekke alle til stede?

2. **Sensitive kategorier.** En kunde kan nevne sykdom, gjeld eller en
   tredjeperson uoppfordret. Art. 9 har strengere krav. Skal det finnes en
   «slett siste to minutter»-funksjon, og holder det?

3. **DPA-dekning.** Underleverandørene for Nexus-lyd er AWS S3 (ikke
   Backblaze B2, som §2 i hoveddokumentet nevner) og Render. SCC-er må
   verifiseres for den faktiske kjeden, ikke den planlagte.

4. **Er 90 dager riktig?** Tallet er hentet fra hoveddokumentet. Det er ikke
   utledet av et formål. Hvor lenge trenger coaching faktisk opptaket?

5. **Ansattes innsyn.** §7 krever at selgere kan se egne opptak og be om
   sletting. Nexus-opptak er brukerscopet, men det finnes ingen samlet flate
   der en selger ser alle sine.

6. **Er DPIA påkrevd i det hele tatt?** Systematisk opptak av samtaler taler
   for. Omfanget — opt-in, per samtale, kort lagring — taler mot. Spørsmålet
   bør stilles til Datatilsynets liste over behandlinger som krever DPIA.

## 6. Konklusjon

**Ikke trukket.** Dette utkastet dokumenterer behandlingen og risikoen; det
avgjør ikke om den er forsvarlig. Punkt 1 og 2 i §5 er reelle hull uten
tiltak i dag, og bør lukkes eller aksepteres eksplisitt før lyd-modus åpnes
for en kunde.

Referat-modus er ikke omfattet av disse hullene på samme måte: ingen stemme
lagres, og behandlingen ligger nær fase 1, som er i drift.
