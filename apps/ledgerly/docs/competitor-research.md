# Konkurrentresearch: svakheter i Fiken, Tripletex og PowerOffice Go

*Web-research utført 2026-07-13 (fem parallelle søkeagenter, 19–44 søk per produkt).*

**Metodeforbehold:** Miljøets proxy blokkerte direkte henting av flere kilder
(Trustpilot, prissider, forum) — funn derfra er basert på søkemotor-utdrag, og
sitater er parafraser. De fyldigste «svakhets»-kildene (Smartbyrå, Luca Regnskap,
Pairy m.fl.) er regnskapsbyråer/konkurrenter med egeninteresse. Mønstrene under er
likevel konsistente på tvers av uavhengige kilder. Reddit var praktisk talt ikke
indeksert for disse produktene; ekte brukerdiskusjon skjer i lukkede
Facebook-grupper og hos regnskapsførere. Priser/detaljer bør verifiseres direkte
før de brukes utad. Dette er produktresearch — ikke juridisk kildegrunnlag.

## Fiken — «for enkelt når du vokser»

Trustpilot ~4,8–4,9/5 med ~1 100 anmeldelser: misnøyen er marginal i volum.
Svakhetene er strukturelle funksjonstak, ikke kvalitetsklager:

1. **Vekst-taket** (gjentatt i 5+ kilder): stopper opp ved ~5–10 ansatte, prosjekter
   eller komplekse integrasjoner. Hele artikler er bygget rundt «når Fiken ikke
   lenger holder».
2. **Ingen prosjekt-/avdelingsregnskap** — bare en enkel prosjektmodul uten
   timer/lønnsomhet; ingen dimensjoner/multi-entity.
3. **Svak rapportering**: ingen budsjett/prognoser, likviditetsprognose eller
   styrerapporter.
4. **Svakt API**: én samtidig request, ~50–60 req/min, ingen webhooks, betalt
   tilleggsmodul (~99 kr/mnd).
5. **Kun norsk språk** — reell utestengelse av expat-segmentet.
6. **Byråene misliker det**: 3,50/6 i Regnskap Norges teknologiundersøkelse (mot
   PowerOffice 5,5) — «laget for gründere, ikke regnskapsførere».
7. Regnskapsfaglig kritikk: foreslår automatisk mva-fradrag der fradrag ikke er
   lov (mat, bruktkjøp) — feilkilde for uerfarne (sjekkregnskapet.no).

Pris er Fikens styrke (flat, forutsigbar, ubegrensede bilag) — angrip funksjonstak,
ikke pris. Kilder: smartbyra.no, pairy.no, taskio.no, regnskapsmart.no,
sjekkregnskapet.no, trustpilot.com/review/fiken.no, DN (2020).

## Tripletex — «kraftig, men prisen eser og det oppleves tregt»

Trustpilot ~4,0/5 (109 anm.), polarisert: 56 % femstjerner, **37 % énstjerner**;
svarer bare på 18 % av negative anmeldelser.

1. **Prismodellen er hovedklagen** (mange uavhengige kilder): lav «fra»-pris
   (199–299 kr/mnd), men bank, lønn (per ansatt), årsoppgjør, integrasjoner og
   bilagsgrenser (>500 på Basis) er tillegg → reelt 450–1 500 kr/mnd. Stykkgebyr
   på fakturautsendelse («90 kr bare for fakturaen — gir ikke mening i 2025»).
2. **Kompleksitet/læringskurve** for småbedrifter: «mange funksjoner selvstendig
   næringsdrivende aldri bruker».
3. **Treghet/«uferdig» følelse**: laster tregt; leverandøren har egen standard
   hjelpeartikkel om treghet. Enkeltklager: fakturalinjer bytter plass,
   KID/EHF-avstemming feiler.
4. **Mobilapp-klager**: re-innlogging, tungvint utleggsflyt med duplikater.
5. **Dataportabilitet** (fersk, juli 2026): ReAI har klaget Visma/Tripletex inn
   til Konkurransetilsynet for API-/portabilitetsbegrensninger (cw.no).
6. API-et er bransjens beste, men med kjente friksjoner (10 000-objekters
   spørringstak, upublisert rate-limit) og pakkegated tilgang.

Kilder: trustpilot.com/review/tripletex.no, smartbyra.no, enkelbedrift.no,
hjelp.tripletex.no, capterra.com, cw.no, github.com/Tripletex/tripletex-api2.

## PowerOffice Go — «byråenes system, ikke gründerens»

Paradokset: best i test hos byråene seks år på rad (Regnskap Norge 5,5/6), men
Trustpilot 2,9/5 (kun 8 anmeldelser) og bare 32 % «svært fornøyd» blant
sluttbrukere i Opinions måling (Fikens egen kilde — partisk, men peker samme vei).

1. **Transaksjonsprising** gjør totalkost uforutsigbar: ~9 kr per faktura,
   3 kr eFaktura, 30–35 kr per ekstra bilag på små-pakkene (Nano: 30 bilag/år,
   Mikro: 150). Dokumenterte årlige prisøkninger.
2. **Overkill for selvbetjente småbedrifter** — «forutsetter at man er vant til
   økonomisystemer»; grensesnittet «mer tradisjonelt enn Fiken».
3. **Mobilapp**: utlegg må sendes én og én; konto vises ikke ved godkjenning uten
   undermeny; svakheter fulgte med fra forrige app-generasjon.
4. **API-restriksjoner med strategisk brodd**: 10 req/s per nøkkel, API bak dyreste
   plan, og **eksplisitt forbud i vilkårene mot integrasjoner som automatiserer hele
   bilagsflyten utenfor Go** (developer.poweroffice.net/documentation/workflow_with_restrictions)
   — stenger konkurrerende pre-accounting-verktøy ute. GitHub-issues viser breaking
   changes uten varsel.
5. **Sluttbruker-support**: klager på at support er rigget mot byråpartnere.
6. Lager krever tredjepart (Rackbeat).

Kilder: apps.apple.com (PowerOffice Go), smartbyra.no, regnskapsmart.no,
developer.poweroffice.net, github.com/PowerOffice/go-api/issues,
no.trustpilot.com/review/poweroffice.no, cicero.no, regnskapnorge.no.

## Byttedynamikk (traktene i markedet)

- **Fiken → Tripletex** («vekst-byttet»): utløses av prosjektregnskap, 2–3+
  ansatte (lønn), timeføring, integrasjoner, valuta. 2–4 ukers overgang,
  2 000–5 000 kr i byråhjelp.
- **→ PowerOffice Go** («byrå-byttet»): utløses av at byrået overtar føringen —
  PO eier *kanalen* (500+ partnerbyråer med volumbaserte partnernivåer), ikke
  sluttbrukerpreferansen.
- **Tripletex → Fiken** (nedgradering): pris/overkill.
- **Friksjon**: full bilagshistorikk blir i praksis igjen i gammelt system (kun
  inngående balanse via SAF-T flyttes); bytte anbefales kun ved årsskiftet.
  Dataportabilitet er en levende konfliktlinje (ReAI-saken).

## Muligheter for oss (rangert etter hvor ofte smertepunktet nevnes)

1. **Forutsigbar totalpris uten stykkgebyr** — hovedklagen mot både Tripletex og
   PowerOffice. Flat pris à la Fiken, uten Fikens funksjonstak.
2. **Vokse uten å bytte system** — bygg prosjekt/avdelinger (kostnadsbærere
   finnes allerede i datamodellen), budsjett og bedre rapporter, så
   «vokst ut av Fiken»-øyeblikket ikke tvinger et bytte.
3. **Én opplevelse for eier OG regnskapsfører** — gapet mellom byrå-tilfredshet
   (PO) og eier-tilfredshet (Fiken) er markedets tydeligste strukturelle hull.
   Våre tre presentasjonsnivåer er designet nettopp for dette.
4. **Åpent API + garantert dataportabilitet** — «lett å forlate oss» som
   salgsargument (SAF-T-eksport har vi allerede; ReAI-saken viser at dette er
   politisk aktuelt). Webhooks fra dag én der Fiken ikke har det.
5. **Ekte AI-bilagsflyt med forklaring** — konkurrentenes ML er «lærer
   leverandørmønstre»; ingen viser regelgrunnlag/kilder eller usikkerhet slik
   vår forslagsmotor gjør. Tredjeparter (OpenClaw) selger allerede agent-lag
   oppå Fiken/Tripletex — hullet er anerkjent i markedet.
6. **Mobil utleggsflyt som ikke irriterer** — begge de store har dokumenterte
   app-klager (duplikater, én-og-én-innsending, re-innlogging).
7. **Engelsk språkstøtte** — expat-segmentet er utestengt fra Fiken.
8. **Ytelse** — Tripletex' treghet er en gjentatt klage; rask UI er et
   differensierende kvalitetsmål.

## Trusler å være ærlige om

- Fikens pris/enkelhet i ENK-segmentet er nesten uangripelig — ikke konkurrer der
  på pris alene.
- PowerOffice eier byråkanalen strukturelt; distribusjon via byråer krever
  partnerprogram, ikke bare produkt.
- Visma eier både Tripletex og PowerOffice (og eAccounting) — konsolidert
  motstander med oppkjøpsmakt; regulatorisk oppmerksomhet (ReAI-saken) kan
  imidlertid åpne dører for utfordrere.
