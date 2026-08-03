# Leadgrid iPad — UI-fokus-audit (2026-08-03)

**Bakgrunn (Daniel):** «Grensesnittet har for mange samtidige fokusområder. Kart,
leadliste, filtre, toppikoner og detaljkort konkurrerer om oppmerksomheten.»

**Metode:** Alle 10 hovedskjermer fanget fra EKTE app (main-bygget, demo-modus,
iPad Pro 13" portrett, `QA_TOUR=demo QA_DEMO=1 QA_TAB=0-9`) og scoret mot fast
rubrikk: (1) antall konkurrerende fokusområder, (2) én-primær-regelen, (3)
header-belastning, (4) badge-/banner-støy, (5) verdikt 1–5. Skjermbildene ligger
i `~/Desktop/leadgrid-ui-audit/`. Forbehold: portrett-orientering (sidebar
overlapper som overlay der); landskap bør stikkprøves ved implementering.

## Rangering

| Skjerm | Verdikt | Soner | Kjerneproblem |
|---|---|---|---|
| Anbud | **5/5** | 4 | — (intern gullstandard: søk → liste → én CTA per kort) |
| Kvalitet | **4/5** | 5 | 4 KPI-rammefarger med lik styrke for ulik viktighet |
| Team | **4/5** | 4 | To konkurrerende lilla «+»-knapper (header vs innhold) |
| Salgsledelse | **3/5** | 6 | To skjermer i én (lederverktøy + produktkatalog); mangler global header |
| Leads | **3/5** | 7 | 7 kontroller i handlingsraden (tekst-wrap-bug!); 6 signaler per tabellrad |
| Møter | **2/5** | 7 | Detaljpanelet alene har 10+ knapper; 3 like lilla CTA-er |
| Leadbook | **2/5** | 6 | 3 stablede navigasjonslag før innhold; 12 interaktive elementer over listen |
| Leadgrid Go | **2/5** | 6 | «Meg» og «Team» blandet; ~16 badges/chips samtidig |
| Oversikt | **2/5** | 8 | Hybrid-org stabler dørsalg-KPI + 3 lister + chips + kart; rød/grønn overalt |
| Kart | **2/5** | ~9 | Daniels eksempel: sidebar + filterrad + handlingschips + kart + liste + detaljkort + verktøy + dato/rute + toggle |

## Per skjerm — funn og de 2 viktigste grepene

### Kart (2/5) — verst, og skjermen Daniel pekte på
Soner samtidig: sidebar, søkefelt + 4 filterdropdowns, handlingschips-rad (Varm
lead / Ny lead / Kunde / Møte / Oppfølging), selve kartet m/ glødende pins +
måle-/lag-/tegneverktøy, «Dørsalg/Bedrifter»-toggle PÅ kartet, lead-listepanel
(51 leads), åpent detaljkort m/ egne faner (Informasjon/Aktiviteter/Notater/
Filer) + Navigér/Legg møte/⋯-CTAer, dato-pill + Ruteplanlegger, bunn-ikonrad m/
39-badge.
1. **Én-ting-om-gangen:** åpent detaljkort ⇒ listepanelet kollapser til en smal
   «51 ›»-stripe; lukket kort ⇒ listen tilbake. Kartet er alltid scenen.
2. **Samle handlingschipsene** (5 stk) i én «+»-knapp med meny, og de 4
   filterdropdownene i én «Filtre»-pill med aktiv-teller («Filtre · 2»).

### Møter (2/5)
Detaljpanelet er 4 undersoner (fakta, 2×4 knappe-grid, AI-banner, rute+sjekkliste).
1. Én primær («Start møte») + én sekundær rad; Logg notat/Mål & behov/
   Stakeholders/Aktivitet bak ⋯.
2. «Brief-møter»-kortet kollapses til én linje med chevron — agendaen er
   skjermens jobb.

### Leadbook (2/5)
Header → verktøysrad (Bibliotek 5 / Ytelse / Versjoner 0 / chat / mikrofon /
+ Ny mal) → 6 faner: tre navigasjonslag før innholdet (starter ~35 % ned).
1. Verktøysraden inn i fane-raden eller bak ⋯; kun «+ Ny mal» + mikrofon som
   handlinger. Dropp «Versjoner 0»-badgen (null-badge = støy).
2. Maks 3 chips + «+N» per malkort (mønsteret finnes allerede — bruk det overalt).

### Leadgrid Go (2/5)
To KPI-rader (team + min), ~16 badges/chips, tre konkurrerende CTA-er.
1. Splitt i «Meg»/«Team»-segment — selger og leder trenger ikke begge samtidig.
2. Gjør oransje formål-varsel til primærhandling («Fiks nå») og dropp
   person-badgene som dupliserer det.

### Oversikt (2/5)
Hybrid-org: header (6+ kontroller inkl. prosjekt-pill), statistikk-banner, 5
dørsalg-KPI-fliser, per-produkt, siste dører, per-selger (rød/grønn på alt),
status-chips, kart — 8 soner.
1. Dørsalg-seksjonen kollapsbar: 2 nøkkeltall synlig (vunnet i dag + hit-rate),
   resten bak «Vis detaljer». Rød/grønn KUN på avvik, ikke som fast fargelegging.
2. Håndhev map-first-designet (som allerede er intensjonen i koden): analyse bak
   header-popovers, kartet får høyden.

### Leads (3/5)
1. **Fiks tekst-wrap-bugen**: «Impor ter»/«Ekspo rter»/«Fler e filtr e» brekker i
   portrett — ikon-only med tooltip under en breddeterskel.
2. Importer/Skann kort/Eksporter bak ⋯; én lilla = «+ Nytt lead». Vurder: enten
   score-ring ELLER statuschip som temperatur-bærer per rad, ikke begge.

### Salgsledelse (3/5)
1. Info-banner dismissable; slett bak long-press/⋯ (permanent rød slette-badge
   på hvert kort misbruker alarmfargen).
2. «STANDARD»-badge ×30 under overskriften «Standard-katalog» er redundant —
   dropp; gjenopprett global header (konsistens).

### Team (4/5)
1. Fjern header-«+ Ny» på denne fanen — «+ Tildel område» er primæren.
2. Statistikk-banneret inn i tittelraden så kartet får hele høyden.

### Kvalitet (4/5)
1. KPI-farge kun på den som krever handling («3 Til verifisering»); Verifisert/
   Underkjent er historikk.
2. Kø-default = «Venter»; ferdigbehandlede bak «Vis ferdige».

### Anbud (5/5) — malen
Kort-anatomien (tittel/kjøper/beskrivelse/metadata/ÉN lilla CTA) er standarden
de andre bør arve. Småpuss: «Frist»-chip uten dato får dato eller fjernes;
Kopier/Åpne i Doffin bak ⋯.

## De 5 gjennomgående designreglene (fase 3 — implementeres på tvers)

1. **Header-diett:** graf/oppgaver/historikk/bjelle kollapses til ETT
   aktivitet-ikon med samlet badge (og badgen hviler på 0 — dagens permanente
   røde «39» er et alarm-signal som aldri slukker). Samme header på ALLE faner
   (Salgsledelse/Anbud mangler den i dag — og er paradoksalt nok roligst).
2. **Én lilla per skjerm:** maks én fylt primær-CTA; alt annet outline/ghost
   eller bak ⋯. I dag har Møter/Go/Leadbook/Team 2–3 konkurrerende lilla.
3. **Chip-budsjett:** badge kun når verdi > 0 OG handling kreves; maks 3 chips +
   «+N»-overflow; rødt/oransje reservert ting som faktisk haster.
4. **Statistikk-banneret** (fast 80 px-skatt øverst på 4+ faner) bakes inn i
   tittelraden som tall-par.
5. **Én-ting-om-gangen på kartflater:** åpent detaljkort ⇒ kollapset liste;
   filtre bak én pill med teller; handlingschips bak én «+».

## Prioritert implementeringsrekkefølge (fase 4)

1. **Kart** (Daniels eksempel + lavest score + mest brukt): regel 5 + chips/filtre
2. **Regel 1+4 globalt** (LeadgridTabHeader er delt komponent — én endring, alle faner)
3. **Møter** (detaljpanel-diett) og **Leadbook** (navigasjonslag)
4. **Go** (Meg/Team-splitt) og **Oversikt** (kollapsbar dørsalg-seksjon)
5. Småpuss: Leads-wrap-bug, Salgsledelse-badges, Kvalitet-KPI-farger, Anbud-frist-chip

Hvert grep verifiseres med før/etter-skjermbilde fra samme capture-pipeline
(`QA_TAB`-sveipet er repeterbart).
