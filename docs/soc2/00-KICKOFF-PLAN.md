# SOC 2 Type II — oppstartsplan

> Fase 4 i [Compliance-veikartet](https://claude.ai/code/artifact/b7c090ee-3767-4147-93d3-50d5c8a25851).
> Bygget 2026-08-15. **Ikke juridisk/revisjonsrådgivning.** Dette er en praktisk
> oppstartsplan basert på hvordan SOC 2 Type II-prosesser normalt kjøres — få en
> reell revisor/compliance-rådgiver til å kvalitetssikre rekkefølgen før dere
> kontrakts-forplikter dere til en revisjonsdato.

---

## 0. Hvorfor dette starter nå, ikke etter alt annet

SOC 2 **Type II** krever et **observasjonsvindu på minst 6 måneder** hvor
revisor faktisk verifiserer at kontrollene har virket i praksis over tid —
ikke bare at de finnes på papiret (det er forskjellen fra Type I, som kun
bekrefter at kontrollene er *designet* riktig på ett gitt tidspunkt).

**Konsekvens:** tidsvinduet er flaskehalsen, ikke selve arbeidsmengden.
Å vente med å starte til Fase 1-3 "er helt ferdige" kaster bort måneder av
observasjonstid som uansett må gå uavhengig av annet arbeid. Derfor startes
dette **parallelt** med resten av veikartet, ikke etter.

---

## 1. Plattformvalg: Vanta

Valgt fremfor Drata/Secureframe for enterprise-salgs-troverdighet — Vanta er
det navnet flest enterprise-kjøpere/sikkerhetsteam allerede kjenner igjen i
en due diligence-prosess, som er akkurat situasjonen avtalen som driver hele
dette veikartet står i.

**Hva Vanta faktisk gjør:** kontinuerlig, automatisert bevisinnsamling —
kobler seg til infrastruktur (Render, Neon, GitHub, Google Workspace) og
overvåker kontroller løpende (MFA aktivert, tilgang fjernet ved offboarding,
kryptering på, osv.), i stedet for at noen manuelt samler skjermbilder hver
måned. Det er dette som gjør 6-måneders-vinduet gjennomførbart uten at det
spiser all tid.

**Konkret neste steg:** book en Vanta-demo/salgssamtale — dette er ikke noe
jeg kan gjøre fra kodebasen, det krever en faktisk kontosamtale og
kontraktsforhandling. **[AVKLAR: eier + frist for denne samtalen.]**

---

## 2. Rekkefølge

| # | Oppgave | Avhengighet | Status |
|---|---|---|---|
| 1 | Book Vanta-salgssamtale, signer kontrakt | — | ⏳ Ikke gjort — krever en menneskelig samtale |
| 2 | Koble Vanta til infrastruktur (Render, Neon, GitHub, Google Workspace) | #1 | ⏳ Venter på #1 |
| 3 | Skriv InfoSec-policyene (se §3 under) | Ingen — kan gjøres parallelt med #1-2 | 🟡 Utkast levert i denne omgangen (se `docs/soc2/`) |
| 4 | Gjennomgå Vantas gap-analyse mot faktiske kontroller | #2 | ⏳ Venter |
| 5 | Lukk identifiserte gap (typisk: MFA-håndheving, tilgangsgjennomgang-rutine, formell onboarding/offboarding-sjekkliste) | #4 | ⏳ Venter |
| 6 | **Observasjonsvinduet starter** — Vanta samler bevis kontinuerlig herfra | #5 (eller når kontrollene faktisk er på plass, selv om gap-lukking pågår) | ⏳ Ikke startet |
| 7 | Book og gjennomfør første pentest (se §4) | Kan gjøres når som helst i vinduet, men bør IKKE vente til slutten | ⏳ Ikke gjort |
| 8 | Book revisor for selve Type II-revisjonen | ~5-6 mnd inn i vinduet (revisor trenger ledetid) | ⏳ Ikke gjort |
| 9 | Revisjon gjennomføres, rapport utstedes | 6 mnd etter #6 | ⏳ Ikke gjort |

---

## 3. InfoSec-policyer — hva revisor faktisk krever

De fire kjernepolicyene en SOC 2 Type II-revisjon alltid ber om er utarbeidet
i denne omgangen (se egne filer i `docs/soc2/`):

| Policy | Fil | Dekker |
|---|---|---|
| Tilgangsstyring | `01-tilgangsstyring-policy.md` | RBAC, least privilege, SSO/SCIM (byggd i Fase 1-2), tilgangsgjennomgang, offboarding-SLA |
| Hendelseshåndtering | `02-hendelseshandtering-policy.md` | Alvorlighetsgrader, eskalering, 72-timers varslingsplikt (kobler til GDPR-arbeidet i Fase 3) |
| Leverandørrisiko | `03-leverandorrisiko-policy.md` | Vetting av underleverandører, DPA-krav (kobler til Fase 3s DPA-mal), faktisk leverandørliste |
| Endringshåndtering | `04-endringshandtering-policy.md` | PR-review-krav, CI-porter, migrasjons-/deploy-prosess, rollback |

**Disse er utkast** — samme disiplin som DPIA/DPA-arbeidet i Fase 3: de
beskriver reelle, verifiserbare praksiser funnet i kodebasen (faktiske CI-
porter, faktisk RBAC-implementasjon), men trenger en navngitt eier internt
som formelt vedtar dem, og bør kvalitetssikres av hvem som helst med reell
SOC 2-revisjonserfaring før de vises til en revisor.

**Åpne punkter revisor vil spørre om, som ikke kan besvares fra kode:**
- MFA — er det håndhevet for alle ansatte (Google Workspace, GitHub, Render,
  Neon-konsoller), eller bare tilgjengelig?
- Sikkerhetsopplæring for ansatte — finnes det en dokumentert,
  gjentakende prosess?
- Formell risikovurdering (ikke DPIA — en bredere sikkerhetsrisikovurdering)
  av virksomheten?

---

## 4. Pentest

**Ikke gjort ennå — bør bookes nå, ikke mot slutten av vinduet.** En pentest
sent i observasjonsvinduet gir ikke tid til å lukke funn og vise at de er
rettet, som er nettopp det Type II skal demonstrere.

**Praktisk:**
- Scope: minimum den offentlige API-flaten (`backend/server/index.ts` sine
  ruter) + de nye SAML/SCIM-endepunktene fra Fase 1-2 (fersk kode, ikke
  penetrasjonstestet ennå) + autentiserings-/sesjonssystemet.
- Leverandør: **[AVKLAR]** — Vanta har ofte partnerskap med pentest-firmaer
  som leverer et Vanta-kompatibelt rapportformat, verdt å spørre om i
  salgssamtalen (§1).
- Anbefalt timing: innen de første 2 månedene av observasjonsvinduet, slik
  at eventuelle funn rekker å bli rettet og dokumentert som en del av selve
  revisjonsbeviset.

---

## 5. Hva som IKKE er i scope her

- **ISO 27001** (Fase 5) — starter etter at denne grunnmuren (policyene,
  Vanta-oppsettet) står, siden ~80 % av kontrollene overlapper.
- **Faktisk kontraktsinngåelse med Vanta eller et pentest-firma** — krever
  en menneskelig beslutningstaker og betalingsfullmakt, ikke noe som gjøres
  fra kodebasen.
- **Formell risikovurdering og MFA-håndhevingsaudit** — ligger utenfor hva
  som er verifiserbart fra kildekoden alene.
