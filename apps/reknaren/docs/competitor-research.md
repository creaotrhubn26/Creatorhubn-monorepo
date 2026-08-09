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

---

# Sjekk Regnskapet — «tjenesten oppå Fiken» (2026-08-09)

*Web-research utført 2026-08-09 (WebFetch mot sjekkregnskapet.no-undersider +
2 websøk). Rundt halvparten av URL-ene i menyen ga 404 — se metodeforbehold
nederst.*

## Hva de er: en rådgivnings-/coachingtjeneste bygget OPPÅ Fiken — ikke et
konkurrerende regnskapssystem

Sjekk Regnskapet AS (org. 827 866 482, stiftet 2020 av Vetle, Henning,
Kristine Maria og Julie) selger **ingen egen bokføringsmotor**. Kjerneproduktet,
medlemsportalen **«Regnskapshjelpen 2.0»**, er eksplisitt bygget for
«gründere som fører regnskap selv **i Fiken**» — de er en menneske+AI-drevet
service- og tillitspakke lagt oppå et annet selskaps programvare, ikke en
programvareleverandør selv. Dette er den viktigste enkeltinnsikten fra
researchen: de konkurrerer ikke med Fiken (eller Reknaren) på bokføringsmotor
— de konkurrerer med *regnskapsføreren* du ellers ville ansatt.

Forretningsmodellen strekker seg over hele spekteret:

1. **Gratis** — YouTube-kanal (@sjekkregnskapet, startet 2020) + blogg +
   boken *«Skattekutt For Gründere»* (#1 på Norli uke 17). Distribusjon: et
   søk oppgir «hjelper over 6 500 gründere hver uke» via video+tjenester.
   Antallet «300+ gratis videoer» kunne ikke telles direkte (kanalsiden var
   ikke i skrapet innhold, kun spillelister) — behandle som oppgitt kjent
   fakta, ikke egenverifisert.
2. **Regnskapshjelpen 2.0** (medlemskap, 8 400 kr/år eks. mva ≈ 700 kr/mnd,
   **i tillegg til** Fiken-abonnementet): AI Vetle 24/7, 4 regnskapsførere
   for live tekst/video-hjelp, skattemeldingsdager i mars–mai, ukentlige
   Zoom-gruppemøter, minikurs, 1:1-kalender.
3. **Kvalitetskontroll** (1 490 kr/mnd inkl. Regnskapshjelpen, eller 6 000 kr
   engangs for et helt forrige år): menneskelig gjennomgang av skatt, mva,
   kontobruk. Eget sitat: «Vi ser mye feil på merverdiavgift, og mer enn 50 %
   av kundene våre finner vi fradrag for som de har glemt» — dette ER
   produktets kjernebevis og salgsargument.
4. **Regnskapscoach** (1:1 Zoom, 1 490 kr medlem / 1 990 kr ikke-medlem):
   navngitte personer (Kristine Maria tirsdager, Henning torsdager).
5. **SR Regnskap** (søsterselskap, 2022) — tradisjonell fullservice
   regnskapsføring for gründere som *ikke* vil gjøre det selv i det hele
   tatt. Dette dekker enden av spekteret Regnskapshjelpen ikke dekker.

`/priser` og `/vetle`/`/ai-vetle` som egne sider ga 404 — pris- og
Vetle-detaljer måtte hentes fra `/regnskapshjelpen`-siden i stedet.
`/om-oss`, `/tjenester` (rot) og `/mitt-bibliotek` ga også 404; nåværende
sitekart bruker andre slugs (`/kurs-og-tjenester`, `/regnskapscoach`,
`/kvalitetskontroll`).

## AI Vetle vs. Reknarens skatteassistent — rådgivning i chat vs. handling i
systemet

AI Vetle beskrives (kun via `/regnskapshjelpen`, siden en egen Vetle-side
404'et) som en AI-assistent tilgjengelig 24/7 som «kvalitetskontrollerer
regnskapet ditt» og «tipser deg om hvordan du reduserer skatten», og rådgir
«om lønn, utbytte og konsernbidrag». Det er en **chat-rådgiver** — ingen av
sidene vi nådde viser bevis for at Vetle leser dine faktiske Fiken-bilag/
-transaksjoner automatisk eller utfører handlinger (bokfører, retter,
sender). «Kvalitetskontrollerer» kan bety at den *svarer på spørsmål om*
kvalitetskontroll like gjerne som at den *utfører* den — det menneskelige
Kvalitetskontroll-produktet (punkt 3 over) er priset og solgt separat, noe
som tyder på at Vetle ikke fullt ut erstatter den manuelle gjennomgangen.
Dette er en inferens, ikke et bekreftet funn — verifiser om mulig ved å teste
selve verktøyet.

Reknarens `ask.ts`/skatteassistent er strukturelt annerledes: den svarer
**grunnet i virksomhetens egne, faktiske tall** (kontoer, bilag, mva-historikk)
og henger sammen med systemer som faktisk *gjør* noe med svaret — AI
bilaglesing bokfører, feildeteksjon (11 detektorer) flagger avvik kontinuerlig,
mva-melding valideres og sendes inn. Der Sjekk Regnskapet leier ut en person
(og nå en chatbot) til å *fortelle* deg hva som er feil, gjør Reknaren jobben
med å *finne og rette* det, i systemet, uten et separat kjøp. Det er samme
løfte («trygt å føre regnskap uten regnskapsfører»/«uten å trenge en person i
tillegg») levert av automasjon i stedet for et abonnement på menneskelig tid.

## Innholdsstrategi — en distribusjons- og tillitsmoat, ikke bare markedsføring

300+ videoer, en bok, ukentlige Zoom-samlinger og et navngitt team
(Vetle/Henning/Kristine Maria) bygger noe programvareselskaper sjelden har:
**identifiserbar menneskelig tillit** til et publikum som er redd for å gjøre
noe feil overfor Skatteetaten. Det er en reell moat — den tar år å bygge og
kan ikke kjøpes med annonsebudsjett alene.

Det Reknaren *kan* ta uten å kopiere innholdet: hvilke smertepunkter en så
stor og gjentatt videokatalog velger å dekke, er et gratis signal om hva
noviser faktisk sitter fast på. Mønstrene som dukker opp i det vi så
(kurstitler som «Hvordan føre regnskap i Fiken for nybegynnere», temaene
lønn/utbytte/konsernbidrag, mva-fradragsfeil, skattemeldingsfrister) peker
rett mot konkrete produktkrav:

- Onboarding-wizarden bør eksplisitt dekke lønn-vs-utbytte-valget for
  enkeltpersonforetak/AS tidlig, ikke som en avansert innstilling.
- Feildeteksjon bør prioritere nøyaktig de mva-fradragsfeilene som er nevnt i
  research på Fiken-siden (mat, bruktkjøp, private kjøp) — samme feilklasse
  Sjekk Regnskapet bygger en hel forretning på å fange manuelt.
- Skatteassistenten bør ha ferdige, navngitte svar på de evigrønne
  spørsmålene (lønn/utbytte/konsernbidrag, hva kan trekkes fra) i stedet for
  å vente på at brukeren formulerer riktig spørsmål.

## Trussel og mulighet

**De er sterke på:** menneskelig tillit og et navngitt ansikt, aktiv
fradragsjakt som salgsargument («50 % finner vi glemte fradrag»),
krise-/skattemeldings-coaching i sesong, og et gratis innholdsbibliotek som
gir dem billig, vedvarende distribusjon Reknaren ikke har.

**Reknaren vinner på:** alt de selger som en *tilleggstjeneste oppå* et
regnskapssystem (kvalitetskontroll, fradragsjakt, «er dette riktig»-svar),
gjør Reknaren *i* systemet, kontinuerlig og uten et eget kjøp. Sjekk
Regnskapets kunder er også strukturelt fanget av Fikens kjente vekst-tak
(se over) — den dagen de vokser forbi Fiken, mister de samtidig hele
Regnskapshjelpen-oppsettet sitt (Zoom-grupper, AI Vetle, kvalitetskontroll er
alle bygget rundt Fiken-grensesnittet). Reknaren kan posisjonere seg som
stedet den kombinasjonen av bruker *ikke* trenger å forlate når de vokser —
automasjonen og skatteassistenten følger med, i stedet for å måtte kjøpes på
nytt hos et nytt system.

## Feature-ideer utløst av denne teardownen (prioritert)

1. **Automatisk fradragsjakt-rapport** — gjør «50 % av kundene har glemte
   fradrag» til en løpende, synlig funksjon i feildeteksjonen («Reknaren fant
   X kr i mulige oversette fradrag denne måneden»), ikke bare stille
   bakgrunnsvalidering. Dette er direkte kopi av deres sterkeste
   salgsbevis, levert automatisk i stedet for som et 6 000 kr-engangskjøp.
2. **«Forklar enkelt»-tone i skatteassistenten** — varm, sjargongfri,
   novise-trygg forklaringsstil (ikke juridisk-korrekt-men-uforståelig),
   informert av hvor bevisst Sjekk Regnskapet bruker «trygt og enkelt» som
   merkevareløfte. Samme informasjon, mindre skummel levering.
3. **Selvbetjent «trygghetssjekk» før skattemelding** — en ett-klikks
   kvalitetskontroll-rapport (bruker eksisterende feildeteksjon+
   skatteassistent) som eksplisitt speiler «vi kvalitetskontrollerer det for
   deg, perfekt før du sender inn skattemelding»-løftet, uten å måtte
   bestille og vente på en person.
4. **Novise-pensum i onboarding** — korte, kontekstuelle forklaringer på de
   evigrønne spørsmålene YouTube-katalogen deres tydelig svarer på gjentatte
   ganger (lønn vs. utbytte, hva er en konto, mva-feller), vist i
   onboarding-wizarden der brukeren faktisk trenger svaret — ikke en egen
   videokanal å bygge fra bunnen.

## Metodeforbehold

- Om lag halvparten av forsøkte URL-er (`/om-oss`, `/tjenester`, `/vetle`,
  `/ai-vetle`, `/priser`, `/blogg`, `/mitt-bibliotek`, `/skatt` med reelt
  innhold) ga **404** — nettstedet har tydeligvis endret sitekart siden
  disse slugene ble antatt riktige. Funn om AI Vetle er derfor hentet
  indirekte via `/regnskapshjelpen`, ikke en dedikert produktside, og bør
  reverifiseres direkte (test selve chatboten) før det brukes i skarpt
  budskap eller produktbeslutning.
- «300+ gratis YouTube-videoer» og «14 års erfaring»/«300+ småbedrifter
  hjulpet» er oppgitte/kjente tall som ikke ble telle- eller
  kildeverifisert i denne runden — behandle som selskapets egen påstand.
- Ingen Trustpilot- eller uavhengige omdømme-kilder ble funnet for Sjekk
  Regnskapet spesifikt (websøk kom tomt) — vi har ingen uavhengig
  kvalitetsvurdering av tjenesten, bare selskapets egne sider og sitater.
- Konklusjonen om at AI Vetle er "kun rådgivning, ingen handling" er en
  inferens fra fraværet av motstridende bevis på de sidene vi nådde, ikke et
  bekreftet negativt funn — verifiser ved å faktisk prøve verktøyet før det
  brukes som et konkurransefortrinn i markedsføring.
- Dette er produktresearch, ikke juridisk eller regnskapsfaglig
  kildegrunnlag.
