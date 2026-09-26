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
| Sensitive ytringer fanges utilsiktet (helse, økonomi, tredjepart) | Høy | «Glem 2 min» i opptaksbanneret: referatet klippes presist, lyden kastes i sin helhet |
| Feiltranskripsjon tillegges kunden | Middels | Teksten er redigerbar; originalen finnes i 90 dager |
| Opptak brukes mot ansatt | Høy | §7 krever skriftlig rutine; ikke teknisk håndhevet |
| Tredjepart i rommet som ikke samtykket | Høy | Antall til stede registreres; flere enn én krever eksplisitt bekreftelse på at ALLE sa ja |
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

1. ~~**Tredjepart i rommet.**~~ LUKKET 2026-09-26: samtykke-kortet spør hvor
   mange fra kundesiden som er til stede. Er de flere enn én, kreves en
   eksplisitt bekreftelse på at ALLE har hørt opplesningen og sagt ja —
   både i appen og i backenden. Antallet lagres, ikke navnene: identiteten
   trengs ikke for å vurdere grunnlaget.

   Gjenstår å vurdere: skal opptak NEKTES over et visst antall, eller er
   bekreftelsen nok?

2. ~~**Sensitive kategorier.**~~ DELVIS LUKKET 2026-09-26: «Glem 2 min» står
   i opptaksbanneret. Referatet klippes presist på segmentenes tidspunkt.
   Lyden kastes i sin HELHET og opptaket starter på nytt — en AAC-fil kan
   ikke klippes bakfra mens den skrives, og et «hopp over dette»-flagg ville
   latt bytene ligge. Det er å skjule, ikke å slette.

   Gjenstår: prisen er at lyden fra før klippet også går tapt. Er det
   akseptabelt, eller trengs segmentert opptak?

3. ~~**DPA-dekning.**~~ DELVIS LUKKET 2026-09-26: hoveddokumentet er rettet —
   det sa Backblaze B2, men lagringen er AWS S3 (`provider: "aws_s3"` i
   leadgrid-s3-storage-service.ts). SCC-ene må fortsatt verifiseres for den
   faktiske kjeden: AWS S3, Render, Neon. Det er en juridisk oppgave.

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
avgjør ikke om den er forsvarlig.

Punkt 1 og 2 hadde ingen tiltak da utkastet ble skrevet. Begge har nå tiltak
(2026-09-26), men begge etterlater et restspørsmål som krever en avveining,
ikke en commit. Punkt 3 er rettet i dokumentasjonen; SCC-verifiseringen
gjenstår.

Referat-modus er ikke omfattet av disse hullene på samme måte: ingen stemme
lagres, og behandlingen ligger nær fase 1, som er i drift.
