# Leadgrid brukerhåndbok

**Målgruppe:** selgere, teamledere, salgssjefer og organisasjonsadministratorer  
**Verifisert mot kode:** 29. august 2026

Denne håndboken følger den native hovedappen. Webflater og portaler er
beskrevet separat i [Web og portaler](./09-web-og-portaler.md). Se alltid
[funksjonskatalogen](./03-funksjonskatalog.md) når du trenger eksakt status,
tilgang eller lagringsmåte for en delhandling.

## 1. Kom i gang

### Logg inn eller par enheten

Den native appen åpner pairing-flyten når ingen gyldig session finnes.
Autentisering og organisasjonsmedlemskap avgjør deretter:

- hvilke leads og teamdata som hentes;
- hvilken organisasjon som er aktiv;
- hvilke faner som vises;
- hvilke permissions og entitlements som gjelder.

Når en request returnerer 401, viser appen «Din økt er utløpt». Bruk «Logg
inn på nytt» for å gå tilbake til pairing. Ikke fortsett å arbeide i en
gammel visning etter at dette arket vises; usendte mutasjoner er ikke
garantert lagret.

Google Sign-In finnes i Leadgrid-systemet for web og native. Tilgjengelig
innloggingsmetode avhenger av miljø og organisasjonsoppsett.

### Velg riktig organisasjon

Bruk organisasjonsvelgeren i headeren når du er medlem av flere
organisasjoner. Et bytte skal laste data, rolle og entitlements på nytt.
Kontroller organisasjonsnavnet før du:

- oppretter eller importerer leads;
- tildeler selgere eller områder;
- lager workflow, tilbud eller rapport;
- endrer plan, varsler eller compliance.

Superadmin kan bruke org-override. Dette er en driftsfunksjon, ikke en vanlig
selgerhandling.

### Forstå demo-modus

Når demo-modus er aktiv, viser appen et banner og kan bruke eksempeldata.
Handlinger som ellers ville skrevet produksjonsdata kan være deaktivert eller
vise «Demo-modus – ikke lagret». Demo skal aldri brukes som bekreftelse på at
en kundearbeidsflyt er gjennomført.

## 2. Anbefalt dagsflyt for selger

1. Åpne **Oversikt** og se dagens momentum, mål, møter og anbefalte handling.
2. Gå til **Kart** eller **Leads** og velg neste prospekt.
3. Kontroller kontakt, score, sist aktivitet og neste oppfølging.
4. Åpne **Møtebrief** eller relevant Pondus-mal før kontakt.
5. Ring, naviger, gjennomfør besøket eller book møte.
6. Registrer utfall, status og neste handling med én gang.
7. Bruk hurtignotat eller møteetterarbeid for oppgaver og datoer.
8. Avslutt dagen med forfalte oppfølginger og eventuelle usynkroniserte
   offlinehandlinger.

For teamleder og salgssjef kommer i tillegg Team, Salgsledelse, Kvalitet,
rapporter og tildeling.

## 3. Oversikt

**Formål:** gi en operativ startside for dagen.

Oversikt samler live data fra appstate og nyere oversikt-/momentumendepunkter,
med egne demoverdier når demo er aktiv. Typiske elementer er:

- salgs-KPI-er og aktivitetsnivå;
- dagens møter og oppfølging;
- momentumscore og neste anbefalte handling;
- mål og progresjon;
- team- eller salgsledelsesinnganger når rollen tillater det;
- varselstatus og appheader.

### Sett eller endre mål

1. Åpne målhandlingen fra Oversikt/momentum.
2. Angi ønsket salgs- eller aktivitetsmål.
3. Lagre.
4. Oppdater Oversikt og kontroller at progresjonen beregnes mot det nye målet.

Målsetting er permission-styrt. En bruker som kan se momentum har ikke
nødvendigvis lov til å endre organisasjonens mål.

### Tolk momentum

Momentum er en sammensatt vurdering av aktivitet og fremdrift, ikke et
regnskapsresultat. Bruk anbefalingen som prioriteringsstøtte. Kontroller lead
og historikk før du gjør irreversible endringer.

## 4. Kart

**Formål:** planlegge og utføre feltarbeid geografisk.

Kartet kan kombinere:

- bedriftsleads og status-/temperaturpins;
- egen posisjon og teammedlemmer;
- konkurrenter, territorier og fokusområder;
- søk, filter og pinforklaring;
- planlagt eller aktiv rute;
- måleverktøy og Pencil-annotasjoner;
- dørsalgsadresser i en separat organisasjonsmodus.

### Finn et lead

1. Søk på navn eller sted, eller bruk filtre.
2. Trykk en pin for sammendrag.
3. Åpne full lead-detalj for kontakt, status, research og handlinger.
4. Bruk «sentrer på meg» hvis lokasjonstillatelsen er gitt.

Uten posisjonstillatelse kan kartet fortsatt vise leads, men avstand,
nærhetsrekkefølge og automatisk navigasjon blir begrenset.

### Opprett lead fra kartposisjon

1. Velg «ny lead» eller handlingen på en kartposisjon.
2. Bekreft koordinat/adresse.
3. Fyll ut minimum bedriftsnavn og tilgjengelige kontaktdata.
4. Legg til bransje, org.nr., verdi, eier og oppfølging ved behov.
5. Lagre og kontroller at appen bytter/fokuserer til den nye pinnen.

Kartopprettelse kan være entitlement-/permission-styrt. Demo oppretter ikke
produksjonsdata.

### Registrer besøk

Start besøket fra leadens kart- eller detaljhandling. På støttede iPhone-
enheter kan pågående besøk vises som Live Activity. Avslutt besøket med:

- resultat/status;
- notat eller transkript;
- neste handling og eventuell dato;
- møte eller tilbud hvis det er riktig neste steg.

Ikke anta at en muntlig eller lokal tekst automatisk har blitt til en
serveroppgave. Kontroller resultatet i lead- og møtehistorikken.

### Navigasjon, rute og mobilitet

Kartflyten kan bruke:

- flerstoppsrute fra Leadgrid;
- Apple Maps for faktisk navigasjon;
- Entur for kollektivtilgjengelighet;
- offentlige parkeringsdata for nærmeste parkeringssted;
- NVDB for fartsgrense og bomstasjoner;
- kjøretøyprofil og Leadgrid Go for kjørelogg.

Disse tjenestene krever nett og korrekt serverkonfigurasjon. Offentlige
datasett kan mangle dekning eller være forsinket.

### Territorier og områder

Teamleder/salgssjef kan opprette eller tildele territorier, kontrollere
overlapp, se dekning og følge brudd. Tettsted-tildeling bruker SSB-data under
kommunenivå og har egen entitlement.

Kontroller alltid organisasjon, mottaker og område før tildeling. Et visuelt
kartområde er ikke alene bevis på at serverens assignment er oppdatert.

### Dørsalg

Dørsalg er en separat modus for husstandsadresser. Den skal ikke blande
adresser inn i bedrifts-CRM-et.

- Adressepunktene hentes via Kartverket og lagres ikke som vanlige leads.
- Organisasjonen kan lagre utfallet «vunnet/avslått» per husstand.
- Adressesøk kan være separat låst.
- Leads-fanen kan være helt skjult i en ren dørsalgsprofil.

## 5. Leads

**Formål:** administrere den operative salgslisten og hvert kundeløp.

I produksjonsmodus mapper tabellen reelle `crm_customers`-leads fra appstate.
Demo bruker et eget datasett.

### Liste, søk og filtre

Du kan bruke:

- fritekstsøk;
- område-, status- og scorefilter;
- flere filtre og lagrede visninger;
- periode og KPI-drilldown;
- sideinndeling og antall rader;
- valg av én eller flere rader der bulkhandlingen støttes.

Filtrering skjer i hovedsak over den lastede klientlisten. Store
organisasjoner bør kontrollere om resultatet representerer hele serverdatasettet
eller bare det som er hentet i gjeldende økt.

### Opprett og importer

Lead kan opprettes manuelt, fra kart eller via import. Import støtter:

- CSV/Excel preview og commit;
- URL Research for én eller mange virksomheter;
- batchstatus, retry, cancel og commit-all;
- visittkortskanning på støttede enheter.

Bruk alltid preview til å kontrollere kolonnemapping, dubletter og
organisasjon før commit. URL Research lager utkast før det blir et reelt lead.

### Lead-detalj

Detaljen er delt i:

- **Detaljer** – bedrift, kontakt, bransje, verdi, eier og salgsstatus.
- **Aktivitet** – registrerte handlinger når de finnes.
- **Notater** – se viktig begrensning under.
- **Filer** – ikke en komplett produksjonsfilflyt i dagens native lead-detalj.
- **Pipeline/tilbud/oppfølging** – tilgjengelig gjennom detaljhandlinger og
  tilknyttede sheets.

#### Viktig om notater og filer

I den native Leads-fanen lagres enkelte lead-notater foreløpig i
`UserDefaults` på den aktuelle enheten. De er ikke team-synkronisert og skal
ikke behandles som organisasjonens autoritative kundehistorikk. Filer i denne
detaljfanen er demo-/presentasjonsdata uten komplett opplasting/nedlasting.

Bruk serverkoblede møte-, aktivitets-, forslag- eller Lead Map-flater for data
som må deles og etterprøves.

### Endre status

Statusendring på backend-leads er serverkoblet. Ved **Vunnet** kan flyten kreve
beløp, gjentakelse og notat. Ved **Tapt** kan årsak være påkrevd. Etter lagring:

1. kontroller at statusen vises i listen;
2. kontroller status-history;
3. kontroller eventuell team-/varselhendelse;
4. kontroller at pipeline og forecast er oppdatert.

### Tildel lead

Tildeling kan gå hierarkisk fra marked/salgssjef til teamleder og videre til
selger. Assignment-status kan vise mottaker og om leaden er sett. Bruk «Mine
tildelte leads» for egen kø.

Tildeling krever både korrekt rolle/permission og en gyldig
organisasjonsbruker-ID; demo-navn har ingen backendeffekt.

### Oppfølging

Sett neste handling og dato så snart en kontakt avsluttes. Forfalte
oppfølginger kan generere varsler og vises i dagens arbeidsliste. Enkelte
visuelle snooze-/hurtighandlinger har ikke full API-støtte; se katalogen før
de brukes som prosesskrav.

### Tilbud

For backend-leads kan Leadgrid opprette og sende et tilbud med branded
PDF-lenke. Den offentlige forslagssiden har token og open-tracking som kan
fyre `proposal.opened` til workflow-systemet.

Kontroller mottaker, pris og versjon før sending. Open-tracking betyr at
lenken ble åpnet, ikke at mottakeren har akseptert innholdet.

## 6. Møter

**Formål:** samle planlegging, forberedelse og etterarbeid.

### Kalender og booking

Møter viser reelle kalenderdata, agenda/dag/uke/måned og støtter flytting av
starttid. Den synlige «Book møte»-flyten i møtefanen og «Planlegg møte» fra
kartet lagrer derimot ikke møtet ennå; arkene validerer/presenterer og lukkes
uten API-write. De må derfor ikke brukes som bekreftelse på at en invitasjon
er sendt. Navigasjonshandlingen fra et eksisterende møte sender brukeren til
Kart.

### Før møtet

Bruk møteforberedelse for:

- kontakt- og bedriftskontekst;
- tidligere aktivitet og pipeline;
- anbefalt Pondus-mal eller pitch;
- AI-møtebrief når entitlementet er eksplisitt aktivert.

Møtebriefen kan kombinere BRREG, regnskap, Doffin-signaler og egne vunnede
case. Det er beslutningsstøtte; verifiser tall og kilder før de brukes som
fakta overfor kunden.

### Etter møtet

Registrer utfall, oppgaver og neste kontakt. Hurtignotat/transkript kan rydde
tekst, foreslå action items, dato og sentiment. På støttede enheter foretrekker
systemet on-device analyse for korte tekster og faller tilbake til backend når
modellen ikke er tilgjengelig eller teksten er for lang.

Et AI-forslag skal bekreftes av brukeren før det blir en forpliktelse.

### Lydopptak

Leadbook-lydopptak er separat fra vanlig diktat/hurtignotat. Funksjonen er
fail-closed og krever eksplisitt entitlement og compliance-bekreftelse.
Samtykke, retention, anonymisering og sletting må følge
[GDPR-pakken](../../leadgrid-gdpr-lydopptak.md).

## 7. Team

**Formål:** fordele marked, følge aktivitet og hjelpe selgerne.

Teamflaten omfatter blant annet:

- medlemmer og teamstruktur;
- lead- og områdefordeling;
- KPI-er og periodevisning;
- pipeline, aktivitet og prestasjon;
- rute-adherence og rapporter;
- team i nærheten og kart;
- egendefinerte KPI-er;
- utstyrsregister.

Flere synlige teamhandlinger er fortsatt presentasjonsfunksjoner: inviter
selger, områdefilter, sett mål, AI-forslag til KPI-formel, CSV/Excel,
periodesammenligning, send rapport, marker alle lest, 30-dagers forecast,
pipelinehelse og dashboardtilpasning kan vise toast uten varig handling. Bruk
bare en funksjon som prosesskrav når katalogen markerer den som serverkoblet.

### Tildel område

1. Velg selger eller team.
2. Velg kommune, tettsted eller støttet geometri.
3. Kontroller eksisterende tildeling/overlapp.
4. Lagre.
5. Be mottaker oppdatere appen og bekreft assignment i teamvisningen.

Tettsted krever `omradeTildeling`. Serveren kontrollerer i tillegg
territoriepermission på relevante ruter.

### Teamkart og «i nærheten»

Noen posisjons-/teamkomponenter har eksplisitt mockfallback eller venter på
en full live-lokasjonsflate. Ikke bruk et kartpunkt som arbeidstidskontroll
eller sikker dokumentasjon uten at datakilden er markert som live.

### Utstyr

Utstyrsregisteret kan registrere organisasjonens telefoner, nettbrett,
datamaskiner, klær og ID-kort, tildele dem til medlemmer og føre
hendelseslogg. «Sist aktiv»-koblingen bruker app-checkin; appen kan ikke lese
enhetens serienummer automatisk. En korrekt manuell tildeling er derfor
forutsetningen for koblingen.

## 8. Salgsledelse

**Tilgang:** normalt `admin` eller `salgssjef`.

Salgsledelse samler:

- provisjonsmodeller;
- konkurranser og konkurransemaler;
- premiekatalog og fulfillment;
- godkjenningskø for deals/rabatter;
- coaching og 1-til-1;
- kjøregodtgjørelse;
- prestasjon, forecast og pipelinehelse;
- manuell faktura i superadmin-scenarioer.

### Provisjon og konkurranse

Definer modell/regler, gyldighetsperiode og målgruppe før aktivering.
Konkurransepremier og fulfillment bør ha en eier og auditspor. Kontrollér at
grunnlaget kommer fra reelle salg, ikke demo-KPI-er.

### Godkjenninger og coaching

Godkjenningskø og coaching har egne persistente backendflater. Registrer
beslutning, kommentar og ansvarlig. Sensitiv coachinginformasjon bør ikke
kopieres inn i generelle lead-notater.

### Kjøregodtgjørelse

Selger sender krav; leder godkjenner og kan eksportere. Kontroller periode,
strekning, bom og dokumentasjon. Leadgrid Go-turen og godkjent krav er to
relaterte, men separate forretningsobjekter.

## 9. Leadbook og Pondus

**Formål:** gi selgeren konkrete metoder, eksempler og trening i arbeidet.

Leadbook har underfanene:

- Oversikt
- Maler
- Pondus
- Akademi
- Eksempler
- Innsikt

### Maler og Pondus

Velg en publisert mal, les stegene og bruk tone-/scoreanalysen før eller under
en salgssituasjon. «Bruk mal» kan registreres slik at organisasjonen får
aggregert innsikt. Superadmin/leder kan administrere maler innenfor sin
tilgang.

Pondus-baseline-quiz lager en dimensjonsprofil for selgeren. Ledere kan bruke
profilene til coaching og anbefaling, ikke som eneste grunnlag for vurdering av
ansatte.

### Akademi

Akademiet inneholder offisielle og organisasjonsspesifikke kurs, progresjon og
videoinnhold via presignerte lenker. Tilgjengelig media avhenger av lagring og
kurskonfigurasjon.

### Eksempler

Organisasjonen kan samle salgssamtale-case manuelt eller fra Kvalitet, gi
ledertilbakemelding, føre dialog og telle visninger. AI-strukturering er en
egen kostnadsbærende entitlement.

Eksempler med kundedata må anonymiseres eller ha riktig grunnlag før bred
deling. Lydopptak har strengere krav enn tekstbaserte case.

### Innsikt

Innsikt viser bruk og mønstre i metodikk/eksempler. Små datamengder og demo
kan gi misvisende score; bruk perioden og datagrunnlaget aktivt.

## 10. Leadgrid Go

**Formål:** elektronisk kjørebok og kjøretøystøtte.

Leadgrid Go kan tilby:

- «Min bil» og oppslag på registreringsnummer;
- automatisk turdeteksjon etter samtykke;
- manuell tur og korrigering;
- klassifisering og turhistorikk;
- teamdashboard;
- eksport til Skatteetaten-format/CSV og PDF;
- grunnlag for kjøregodtgjørelse;
- bom-, fart- og parkeringskontekst.

Trips er personlig `user_id`-scopet på serveren. Auto-registrering bør bare
slås på etter at bruker har forstått lokasjonsbruken. Kontroller turer før
eksport; automatisk deteksjon kan ikke alene vite turens forretningsformål.

## 11. Kvalitet

**Formål:** verifisere vunnede salg gjennom en kontrollert velkomstsamtale.

Typisk flyt:

1. Et vunnet salg går til verifiseringskø.
2. Kvalitetsmedarbeider velger en godkjent samtalemal.
3. Samtalen gjennomføres og resultat registreres.
4. Saken godkjennes, avviksmerkes eller sendes til oppfølging.
5. Et egnet case kan flagges til Leadbook Eksempler.

Tilgang er rolle- og entitlementstyrt, normalt for kvalitet, admin og
salgssjef. Kvalitet er en egen kontrollflate og må ikke forveksles med en
vanlig statusendring på leaden.

## 12. Anbud og Doffin

**Formål:** finne og følge offentlige anskaffelser som kan bli salgsmuligheter.

Anbud kan omfatte:

- søk og filtre i Doffin-data;
- CPV-kategorier;
- overvåkning;
- detaljer om oppdragsgiver og frister;
- kobling/opprettelse av oppdragsgiver som CRM-lead;
- møtebriefsignal og varsling.

Doffin-data er en ekstern kilde. Kontroller alltid konkurransegrunnlag og frist
i den offisielle kunngjøringen før handling. Modulen har eget entitlement.

## 13. Canvas

**Formål:** Pencil-først arbeidsark koblet til leads og teamarbeid.

Canvas-familien omfatter:

- frie håndskrift-/tegneark;
- kategorier og lead-kobling;
- bilder og PDF-annotering;
- levende kort fra CRM, KPI og kart;
- elementbibliotek;
- deling i team;
- tidsreise/versjonshistorikk;
- kundeminne;
- AI-analyse av håndskrift.

Canvas har både en hovedentitlement og granulære nøkler. AI-analyse kan være
låst separat. Kontroller at arket er synkronisert før du bytter organisasjon
eller enhet.

## 14. Verktøy: research, marked, pipeline og rapportering

### Per-lead research

Research kan kombinere bedriftsregister, nettside og AI til en strukturert
analyse. Start fra lead eller Verktøy, følg progresjonen og les kildedata før
resultatet brukes.

### Market Scan

Market Scan finner potensielle bedrifter og kan opprette pins/leads. Sett
marked, bransje og kriterier presist. Gjennomgå resultatet før masseoppfølging;
automatisk oppdagelse kan gi irrelevante eller dupliserte kandidater.

### Intelligence og Next Best Action

Intelligence beregner score, pipeline-signal og anbefalte handlinger. «Alle
anbefalinger» viser køen; pipeline-kanban grupperer salgsarbeidet. En
anbefaling er ikke en automatisk kundehandling med mindre en aktiv workflow
utfører den.

### Analyse og forecast

Analyse kan vise overview, kanaler, kilder, segmenter, territorier, velocity og
konvertering. Forecast kan bruke p10/p50/p90 og AI-refinement. Vis alltid
periode, datadekning og valuta når tall deles.

### Varsler

Varselinnboksen samler Leadgrid-hendelser. Preferanser kan styre eventer og
kanaler. APNs-tap rutes til Leadgrid selv når backend bruker ulike
eventnavn. Push er et varsel, ikke et autoritativt auditspor; kontroller
leadens status.

### Rapporter og eksport

Planlagte rapporter kan opprettes, sendes nå eller leveres etter plan. Native
eksport bruker share sheet. CSV og PDF kan ha ulik detaljgrad og permissions.

## 15. Apple Watch, widget og Live Activity

### Apple Watch

Watch viser:

- leads sortert etter GPS-avstand;
- hurtighandlingene besøkt, ringt, møte booket og ikke interessert;
- diktert hurtignotat som analyseres på iPhone eller backend;
- Pondus-mal, steg og anbefalt tone.

Lead-snapshot og Pondus kommer fra iPhone og lagres lokalt på Watch.
Hurtighandlinger blir sendt/køet mot iPhone, men hovedappen registrerer ikke
en mottaker som skriver dem til backend. De gir derfor haptikk uten å endre
lead-status i produksjon. Hurtignotatet får analyse tilbake, men lagrer ikke
notatet, oppgavene eller oppfølgingsdatoen. Begge er **Hybrid** og må
bekreftes/registreres i hovedappen.

### Widget

Små, mellomstore og store widgets viser kombinasjoner av stille leads,
follow-ups, møter og dagens elementer. Widgeten leser siste App Group-snapshot
og kontrollerer filen med omtrent 15 minutters timeline. Den er derfor et
øyeblikksbilde, ikke en sanntidsrapport.

### Live Activity

Ved et aktivt besøk kan låseskjerm/Dynamic Island vise lead, adresse, status
og forløpt tid. Avslutt besøket i hovedappen; Live Activity lagrer ikke
salgsutfallet alene.

## 16. Feil, kø og trygg gjenoppretting

| Situasjon | Gjør dette |
|---|---|
| «Din økt er utløpt» | Logg inn på nytt; bekreft siste mutasjon. |
| Offline-kø har elementer | Gjenopprett nett, la appen drenere køen, og kontroller leaden. |
| Entitlement locked | Be org-admin kontrollere plan/matrise; ikke omgå via direkte API. |
| Ingen organisasjon/data | Kontroller aktiv org, medlemskap og org-status. |
| Ekstern tjeneste feiler | Behold input, prøv igjen senere og verifiser leverandørkonfigurasjon. |
| Demo-banner vises | Ikke registrer ekte kundearbeid; bytt til autorisert produksjonsøkt. |
| Watch viser gamle leads | Åpne iPhone-appen, oppdater data og vent på Watch-synk. |
| AI-resultat virker feil | Gå tilbake til kildedata; rediger/avvis før lagring eller sending. |

## 17. Hva brukeren ikke skal anta

- At alle ferdige skjermer lagrer alt på serveren.
- At webben har samme komplette app-shell som native.
- At en connector merket «Live» betyr ferdig konfigurert kundesynk.
- At AI-score, sentiment eller forecast er verifiserte fakta.
- At Watch, widget eller push er den autoritative statusen.
- At Vision-opplevelsen bruker organisasjonens produksjonsdata.
- At en klient- eller partnerlenke gir bredere tilgang enn tokenets scope.
