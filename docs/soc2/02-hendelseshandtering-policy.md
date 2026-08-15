# Hendelseshåndtering — policy (utkast)

> SOC 2 Type II-kjernepolicy. Del av `docs/soc2/00-KICKOFF-PLAN.md` (Fase 4).
> Bygget 2026-08-15. **Utkast — trenger en navngitt eier som formelt vedtar
> den, og bør kvalitetssikres av noen med reell SOC 2-revisjonserfaring.**

---

## 1. Formål

Sikre at sikkerhetshendelser (mistenkt eller bekreftet brudd på
personopplysningssikkerheten, uautorisert tilgang, tjenestenedetid med
sikkerhetsimplikasjoner) oppdages, eskaleres, håndteres og varsles i tide.

## 2. Alvorlighetsgrader

| Grad | Definisjon | Eksempel |
|---|---|---|
| **Kritisk** | Bekreftet eksponering av personopplysninger eller credentials, aktiv utnyttelse | Lekket database-credential brukt av en angriper; SAML-sesjon kapret |
| **Høy** | Sannsynlig sikkerhetsbrudd, ikke bekreftet utnyttelse | Eksponert credential i git-historikk uten bekreftet misbruk (jf. Neon-credential-funnet i Fase 3) |
| **Middels** | Sikkerhetssvakhet uten indikasjon på utnyttelse | Manglende server-side tilgangskontroll oppdaget i kodegjennomgang, ingen tegn til misbruk |
| **Lav** | Avvik fra beste praksis, ingen umiddelbar risiko | Utdatert avhengighet uten kjent utnyttbar sårbarhet |

## 3. Oppdagelse og eskalering

**[AVKLAR — ingen formell on-call-/varslingskanal funnet i kodebasen.]**
Anbefalt minimum: en navngitt sikkerhetskontakt (kan være samme person som
personvern-ansvarlig fra GDPR-notatet, se Fase 3) og en dokumentert
eskaleringsvei fra "noen oppdager noe" til "riktig person er varslet" —
innen **1 time** for Kritisk/Høy.

## 4. Håndteringssteg

1. **Identifiser og begrens** — stopp aktiv utnyttelse (roter credential,
   deaktiver kompromittert sesjon/konto, ta ned berørt tjeneste om
   nødvendig).
2. **Vurder omfang** — hvilke data/systemer er berørt, hvilke kunder/
   registrerte er potensielt påvirket.
3. **Varsle** — se §5 (GDPR) og §6 (kunde-DPA-forpliktelser).
4. **Rett** — lukk sårbarheten som muliggjorde hendelsen.
5. **Dokumenter** — postmortem (se §7), uavhengig av alvorlighetsgrad for
   Kritisk/Høy.

## 5. Lovpålagt varslingsplikt (GDPR)

Kobler direkte til `THE-ROLE-ROOM-DATABEHANDLERAVTALE-MAL.md` §8 (Fase 3):
Databehandler skal varsle Behandlingsansvarlig uten ugrunnet opphold, senest
innen **48 timer**. Datatilsynet skal varsles av behandlingsansvarlig innen
**72 timer** fra kunnskap om bruddet, der det er påkrevd.

## 6. Eksempel fra dette veikartet: hvordan et reelt funn skal håndteres

Under Fase 3 ble en aktiv-utseende Neon-database-credential funnet hardkodet
i 10 filer i kildekoden (se `docs/evidence/2026-08-role-room-eu-region-status.yaml`
og commit `d322973`). Slik denne policyen ville klassifisert og krevd
håndtert det samme funnet:

- **Klassifisering:** Høy (eksponert credential, ingen bekreftet utnyttelse
  observert).
- **Begrensning:** fjernet fra kildekoden i samme commit som funnet.
- **Gjenstående, ikke fullført:** **credentialen er ikke rotert i
  Neon-dashboardet ennå** — fjerning fra filene løser ikke eksponeringen i
  git-historikken. Dette er et åpent, uferdig hendelsessvar etter denne
  policyens egne krav, og bør lukkes før dette telles som en "løst hendelse"
  i revisjonsbeviset.

## 7. Postmortem

For Kritisk/Høy-hendelser: skriftlig oppsummering innen 5 virkedager —
hva skjedde, hvorfor, hva ble gjort, hva forhindrer gjentakelse. Følger
samme prinsipp som `docs/evidence/`-konvensjonen i dette repoet: dokumenter
beslutninger med lang hale, ikke bare fiks stille.

## 8. Test av hendelsesplanen

**[AVKLAR — ingen dokumentert øvelse/tabletop-test funnet.]** SOC 2
Type II-revisorer ser typisk etter minst én dokumentert øvelse i
observasjonsperioden.

---

**Eier:** **[AVKLAR.]**
**Neste gjennomgang:** **[AVKLAR.]**
