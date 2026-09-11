# Juridisk produksjonskontroll – prototype-testerprogrammet

Dette dokumentet er en obligatorisk faktakontroll og godkjenningslogg før nye
avtaleversjoner publiseres. Det er ikke en juridisk vurdering i seg selv.

## Gjeldende dokumentpakke

| Dokument | Versjon | Rettslig karakter |
| --- | --- | --- |
| Programvilkår | 1.0 | Bindende |
| Konfidensialitetsavtale (NDA) | 1.1 | Bindende |
| Databehandleravtale | 1.1 | Bindende når CreatorHub behandler personopplysninger på kundens vegne |
| Intensjonsavtale | 1.0 | Uttrykkelig ikke-bindende |

Den kanoniske teksten ligger i
`frontend/shared/prototype-tester-agreements.ts`. En materiell tekstendring skal
alltid få ny versjon. Allerede aksepterte snapshots skal aldri overskrives.

## Kontroll før juridisk godkjenning

- Bekreft juridisk navn, organisasjonsnummer, adresse, kontaktpunkt og lovvalg.
- Bekreft at programlengde, innsats, fordeler, oppsigelse og mislighold samsvarer
  med det CreatorHub faktisk tilbyr.
- Bekreft NDA-ens definisjon, unntak, varighet, sletting og håndheving.
- Sammenhold databehandleravtalens behandlingsformål, registrerte,
  opplysningstyper, sletting, sikkerhetstiltak og hendelsesrutiner med faktisk
  produksjonsarkitektur.
- Verifiser navn, rolle, region og overføringsgrunnlag for hver aktiv
  underdatabehandler. Fjern leverandører som ikke brukes, og legg til dem som
  faktisk behandler data.
- Bekreft at varslingsfristen for underdatabehandlere og revisjonsmekanismen kan
  etterleves operasjonelt.
- Bekreft at intensjonsavtalen ikke lover et senere kjøp, samarbeid, betaling,
  ansettelse eller eksklusivitet.
- Vurder signeringsnivået for risikoklassen. Dagens metode er e-postkode,
  skrevet navn, fullmaktserklæring og beviskjede – ikke BankID eller kvalifisert
  elektronisk signatur.
- Kontroller at personvernerklæring, underdatabehandlerliste og brukerflate viser
  samme fakta og versjoner.

## Godkjenningslogg

Fylles ut av ansvarlig jurist eller annen uttrykkelig autorisert godkjenner før
produksjonssetting av en ny dokumentversjon:

- Godkjenner:
- Rolle/virksomhet:
- Dato og klokkeslett:
- Gjennomgåtte versjoner:
- Eventuelle forbehold eller påkrevde endringer:
- Referanse til godkjenningsbevis/saksnummer:

Uten utfylt godkjenningslogg skal dokumentpakken behandles som teknisk
releaseklar, men ikke juridisk godkjent.
