# Arkitektoniske smertepunkter i notat- og kunnskapsverktøy

Utredning 12.09.2026. Grunnlag: Hacker News-kommentarer (via Algolia-søk), Trustpilot,
fagblogger, leverandørenes egne tekniske blogger, og PKM-forskning.

**Metodisk forbehold, viktig:** Reddit er blokkert for verktøyet mitt (søk mot reddit.com
returnerer 400 – Anthropics crawler har ikke tilgang). Alle sitater under kommer derfor fra
HN, Trustpilot, blogger og forskning, ikke fra r/Notion, r/ObsidianMD osv. Der jeg ikke fant
belegg, står det eksplisitt. Der jeg slutter meg til noe, står det **[slutning]**.

HN-kommentarer lenkes som `news.ycombinator.com/item?id=<objectID>`.

---

## 1. Notion

### Den arkitektoniske smerten
Alt i Notion er en blokk i en serverside-database. Det gir to smerter som følger direkte av
datamodellen: (a) strukturen er noe **brukeren må definere før den kan spørres** – en database
med kolonner må finnes før en view finnes; (b) innholdet har ingen eksistens utenfor Notions
lager, så eksport og offline er derivater, ikke standardtilstand.

> «Notion's Databases export only includes a CSV. So you'll need to recreate the views to be
> able to interact with them dynamically»
> — kepano (grunnlegger-CEO i Obsidian), [HN 44945907](https://news.ycombinator.com/item?id=44945907)

> «due to the file format and everything can be interconnected forms both a walled garden and
> moat at the same time»
> — bayindirh, [HN 45040546](https://news.ycombinator.com/item?id=45040546)

Offline er det beste beviset for at dette er arkitektur og ikke prioritering. Offline ble lovet
«soon» i 2018 ([HN 30975735](https://news.ycombinator.com/item?id=30975735)) og først levert i
**Notion 2.53, 19. august 2025** ([release notes](https://www.notion.com/releases/2025-08-19)) –
altså rundt sju år. Notions egen tekniske blogg sier hvorfor:

> «Notion's unique block architecture meant we had to solve several challenging problems around
> reference tracking, background syncing, and rich-text conflict resolution»
> — [How we made Notion available offline](https://www.notion.com/blog/how-we-made-notion-available-offline)

Og løsningen er fortsatt delvis: sider må eksplisitt markeres, databaser caches bare «up to 50
pages in the current view», og en side som ikke er komplett vises ikke i det hele tatt
(«Opening a page and seeing half the content 'missing' would be a worse user experience than
not being able to open it at all»).

Brukersiden av det samme:
> «The biggest omission in Notion is that it does not have an honest or complete offline-first mode.»
> — j45, [HN 39032680](https://news.ycombinator.com/item?id=39032680)

### Hvorfor den ikke kan fikses
Blokkmodellen *er* produktet. Relasjoner, rollups, filtre og tillatelser er definert på
serverens datamodell, ikke i teksten. En fil-først-Notion ville ikke være Notion. De brukte sju
år og en CRDT-migrasjon på å komme delvis ut av det, og kom bare delvis ut.

### Gjelder oss
Ja, men speilvendt – se seksjon 5. Vi har løst «du må bygge skjemaet først» ved å utlede
strukturen, og vi har løst offline ved konstruksjon. Men vi har arvet *eksportproblemet i ny
form*: teksten er portabel, forståelsen er det ikke.

---

## 2. Slack

### Den arkitektoniske smerten
Slack har ingen typeforskjell mellom en beslutning og en spøk. Alt er en melding i en kanal med
et tidsstempel. Konsekvensen er ikke «dårlig søk» – det er at det **ikke finnes noe å søke
etter**: ingen post bærer merket «dette avgjorde noe».

> «There are many decisions, reasons for those decisions, and business logic lost in Slack
> channels. Slack search isn't nearly good enough to surface them.»
> — aurareturn, [HN 40835922](https://news.ycombinator.com/item?id=40835922)

> «I can't count how many times I know the answer is in Slack somewhere 5 months ago but I
> can't find those messages anymore.»
> — aurareturn, [HN 39916279](https://news.ycombinator.com/item?id=39916279)

Det andre arkitektoniske trekket: **indeksen er tilgangsskopet til deg**. Du kan ikke finne det
du ikke var med på, fordi det ikke finnes i ditt søkerom.

> «I have a paid Slack plan and while I can find specific threads where I remember a lot of the
> details, I've never found anything that I didn't personally participate in.»
> — jrockway, [HN 25753721](https://news.ycombinator.com/item?id=25753721)

> «Slack is almost an anti-knowledge base in its current state.»
> — abridgett, [HN 30840906](https://news.ycombinator.com/item?id=30840906)

> «'It's Searchable' is not a replacement for any information organization at all, just an
> excuse to keep not hiring anyone to maintain documentation.»
> — jcrawfordor, [HN 36948604](https://news.ycombinator.com/item?id=36948604)

Det tredje: 90-dagers oppbevaring er normalisert, og mange organisasjoner setter den frivillig.
Det er formelt en policy, ikke arkitektur – men effekten er at korpuset er *designet til å
forsvinne*:
> «Every place I've worked at with Slack has the standard 90 day retention policy in place
> which makes it impossible.» — pokstad, [HN 33713958](https://news.ycombinator.com/item?id=33713958)

(Atlassians egen community-tråd [«Slack is where context goes to die»](https://community.atlassian.com/forums/Teamwork-Lab-Improving-our-ways/Slack-is-where-context-goes-to-die/td-p/3084304)
formulerer det som «Decisions get lost → Ideas resurface every few weeks → Same questions keep
coming up». Merk: tråden er anekdotisk og oppgir ingen data – jeg fant **ingen** kvantitativ
studie på hvor lenge kunnskap overlever i chat.)

### Hvorfor den ikke kan fikses
Å skille beslutning fra småprat krever at noen klassifiserer – enten mennesket (pin, emoji,
«save»), som ikke skjer under samtalen, eller maskinen, som krever en semantisk modell Slack
ikke har i datamodellen. Søkeforbedringer flytter presisjon, ikke typeinformasjon. Og
tilgangsskopet kan ikke fjernes uten å bryte konfidensialitetsmodellen.

### Gjelder oss
Dette er nøyaktig hullet det planlagte samtaleimportet sikter mot: gjøre en tråd til en
beslutningslogg med hvem som sa hva. Det er den sterkeste strategiske posisjonen i hele
rapporten – *og* den mest risikable, fordi vi da klassifiserer andres prosa uten å kunne spørre
forfatteren. Se seksjon 5.

---

## 3. Microsoft Word / OneNote

### Den arkitektoniske smerten
**Word:** kunnskapen bor i filer som er ugjennomtrengelige som enheter. Et dokument er den
minste adresserbare tingen; et avsnitt har ingen identitet på tvers av versjoner. Derfor finnes
det ingen spørring over dokumentsamlingen, bare søk etter strenger.

> «[Word and Google Docs] have track changes. But they don't let you bounce between branches or
> make pull requests»
> — josephg, [HN 43188953](https://news.ycombinator.com/item?id=43188953)

**OneNote:** fritt lerret lagret som et udokumentert binærformat. Notatene kan skrives hvor som
helst på siden, som betyr at rekkefølge og hierarki ikke er semantisk representert.

> «the lack of a proper structured export is somewhat worrisome» … «big binary undocumented blob»
> — motdiem, [HN 7416172](https://news.ycombinator.com/item?id=7416172)

> «Even OneNote's own export routines don't faithfully preserve the content (e.g. embedded files)»
> — jl6, [HN 17164374](https://news.ycombinator.com/item?id=17164374)

> «It can only export in certain circumstances on certain platforms, and even then only as PDF
> or a proprietary ZIP format»
> — wrs, [HN 32433958](https://news.ycombinator.com/item?id=32433958)

> «it was also impossible to export OneNote locally because the newer apps only work with the cloud»
> — kevin061, [HN 46496694](https://news.ycombinator.com/item?id=46496694)

> «Exporting is only a practical means of migrating sizeable note collections if the export and
> subsequent import into another system can be done with high fidelity»
> — crispinb, [HN 17062109](https://news.ycombinator.com/item?id=17062109)

**Ikke funnet:** jeg fant *ingen* substansielle HN-klager på filversjonsspredning
(«rapport_final_v3_FINAL.docx»). Det er et velkjent fenomen, men jeg har ikke belegg for det i
kildene jeg søkte, og lar det stå som uverifisert.

### Hvorfor den ikke kan fikses
Word-formatet er et sidelayout-format. Semantikk er sekundær til utseende – en overskrift er en
stil, ikke en node. OneNotes lerret er posisjonsbasert av design; å gi innholdet struktur ville
fjerne det som gjør lerretet fritt.

### Gjelder oss
Bare delvis. Vi har løst adresserbarheten på filnivå (markdown), men **ikke på avsnittsnivå** –
og det er samme hull som Word har. Se seksjon 5, punkt 5.3.

---

## 4. Milanote

### Den arkitektoniske smerten
Milanote indekserer på **posisjon**. Et kort finnes fordi du husker hvilket brett det ligger på
og hvor på brettet. Det fungerer helt til samlingen blir større enn hukommelsen, og da finnes
det ingen annen inngang. Da selskapet i 2025 begrenset globalt søk til nylig sett/endret
innhold, kollapset den siste ikke-romlige inngangen:

> «Previously, I could simply type the name of a board and access it instantly, regardless of
> when I last viewed or edited it. … Now, the search is inexplicably limited to recently viewed
> or edited content.»
> — Арсений Астро, 2/5 stjerner, 20. mai 2025, [Trustpilot](https://uk.trustpilot.com/review/milanote.com)

Samme anmelder konkluderer at Milanote ikke lenger er brukbart som sentralt arkiv for et stort
langtidsarbeid.

### Hvorfor den ikke kan fikses
Et romlig lerret har ingen kanonisk lesrekkefølge og ingen tekststruktur å indeksere ut over rå
strenger. Man kan legge til bedre søk (og bør), men det romlige minnet er hele verdiforslaget –
et Milanote med hierarki og spørringer ville være et annet produkt. **[Slutning]**

### Gjelder oss
Indirekte, men som advarsel: «søk bare i det nylige» er en indeksavgrensning, og vi har en
tilsvarende avgrensning uten å ha valgt den – vårt avledede strukturrom dekker bare det som er
klassifisert. Se seksjon 5, punkt 5.2.

---

## 5. Obsidian

### Den arkitektoniske smerten
Obsidians løfte er «det er bare markdown-filer dine». Det er sant helt til du vil spørre dem om
noe. Da må du legge inn metadata for hånd (frontmatter, tagger, Dataview-felt) – altså nøyaktig
Notions «definer skjemaet først», bare uten Notions verktøy – og i samme øyeblikk er filene ikke
lenger nøytral markdown:

> «Neither produces portable Markdown. GitHub renders those files as literal noise. **The
> portability benefit that motivated the move evaporates the moment you add the metadata you
> need.**»
> — iLemming, [HN 49468400](https://news.ycombinator.com/item?id=49468400)

> «if you add a bunch of plugin dependencies (or even one), you are deliberately choosing to
> forego standard Markdown»
> — veidr, [HN 42516028](https://news.ycombinator.com/item?id=42516028)

Den andre arkitektoniske konsekvensen: fordi kjernen bevisst er tynn, ligger all avledet
funksjonalitet i tredjepartsplugins med uavhengig levetid.

> «every time Obsidian updates, there's a chance one of your plugins will stop working»
> — [XDA: Obsidian's reliance on plugins](https://www.xda-developers.com/obsidians-reliance-on-plugins/)

Og den tredje: lokale filer gjør flerenhet og samtidighet til et uløst problem som lekker ut til
brukeren.
> «First-class git support. The git plugin is dangerous and will overwrite changes from other
> devices.» — echelon, [HN 47757569](https://news.ycombinator.com/item?id=47757569)

Til slutt, gjenfinning uten manuell lenking finnes ikke:
> «Some more serendipitous discovery might be nice. I've experimented with various Related
> Notes plugins, most are garbage»
> — elric, [HN 45197033](https://news.ycombinator.com/item?id=45197033)

### Hvorfor den ikke kan fikses
Markdown har ingen semantikk ut over overskriftsnivåer. Enhver struktur må derfor legges *på*
filen, av brukeren eller av en parser, og begge deler bryter «det er bare markdown». Dette er
ikke en feil i Obsidian – det er markdown.

### Gjelder oss
**Direkte og hardt.** iLemmings setning er den mest ubehagelige i hele rapporten for dette
produktet. Vi har valgt å ikke skrive metadata inn i filene – strukturen utledes og lagres i
SQLite. Det bevarer portabiliteten til teksten, men flytter problemet: forståelsen er da ikke i
filen. Se seksjon «Bare flyttet».

---

## 6. Roam Research

### Den arkitektoniske smerten
Roams modell er at hvert punkt er en blokk i en graf, og verdien realiseres ved at du lenker
manuelt mens du skriver. Det er en investering som betales i dag mot avkastning i framtiden – og
de fleste opplevde at avkastningen aldri kom. Dette er *ikke* et polerproblem; det er at grafen
ikke har noen mekanisme for å oppsøke deg.

> «When I write my notes the thought, 'Where am I going to put this?' plagues me every time.»
> … «After some time though, reality started to sink in. **'I am not really going back through
> all of these notes.'**»
> — [The Fall of Roam, Every/Superorganizers](https://every.to/superorganizers/the-fall-of-roam)

Artikkelens poeng er presist: i det øyeblikket brukeren slutter å tro at systemet gir noe
tilbake, blir alle de andre manglene uutholdelige. Ytelse og eksport kommer i tillegg:

> «the thing that scares me the most about Roam is that I wouldn't be able to export data. Also
> like Notion it gets extremely slow very quickly.»
> — 0xferruccio, [HN 26319176](https://news.ycombinator.com/item?id=26319176)

> «I feel a slight delay at times between typing a key and seeing the character on screen.»
> — gatleon, [HN 23119650](https://news.ycombinator.com/item?id=23119650)

### Hvorfor den ikke kan fikses
Grafen er brukerprodusert. Et produkt som krever manuell lenking kan ikke fjerne kravet uten å
slutte å være det produktet, og det kan ikke kompensere for manglende lenker med noe annet,
fordi det ikke har noen annen representasjon av innholdet enn lenkene.

### Gjelder oss
**Dette er vår viktigste smerte.** «I am not really going back through all of these notes» er
den mest kostbare feilmodusen i hele kategorien, og den rammer alle notatprodukter som venter på
at brukeren skal spørre. Se punkt 5.1 og seksjon 6.

---

## 7. Confluence

### Den arkitektoniske smerten
Confluence organiserer etter **eier** (space per team), ikke etter **emne**. Det betyr at samme
emne finnes i fem spaces i fem versjoner, og at hierarkiet reflekterer organisasjonskartet
heller enn kunnskapen.

> «Confluence is directly backwards, its information at the team level, instead of at the topic
> level.» — ecshafer, [HN 30735712](https://news.ycombinator.com/item?id=30735712)

> «Confluence is the worst Wiki I've ever used … its search is broken since the beginning,
> hierarchical view is broken» — Arcanum-XIII, [HN 33200039](https://news.ycombinator.com/item?id=33200039)

> «confluence search is the first thing I would fix … the message wikis present is 'all
> information is unstructured'» — retrocryptid, [HN 32119886](https://news.ycombinator.com/item?id=32119886)

> «Confluence is worse than wikis for searching, especially in a large organization.»
> — lulzury, [HN 30234114](https://news.ycombinator.com/item?id=30234114)

> «it has a bad search and really slow, but no matter how much everyone hates it, the market
> does not provide worthy alternatives» — dmpanch, [HN 28599502](https://news.ycombinator.com/item?id=28599502)

Og den underliggende, som gjelder alle wikier: en side har ingen forfallsdato og ingen
representasjon av at den er erstattet.
> «this kind of documentation rots far too fast to have much net benefit at a high feature pace.»
> — endymi0n, [HN 26414746](https://news.ycombinator.com/item?id=26414746)
> «Documentation needs to be cared for near the code, only then you have a chance it's not outdated»
> — mkesper, [HN 30721144](https://news.ycombinator.com/item?id=30721144)

### Hvorfor den ikke kan fikses
Space-modellen er tillatelsesmodellen. Å reorganisere etter emne krever å skille autorisasjon
fra plassering, som er et skjemabytte i databasen, ikke en funksjon. Og «hvilken side gjelder»
kan ikke utledes av et system som ikke vet hva en side påstår.

### Gjelder oss
Ja – som «beslutningsråte». En beslutning fra mars som ble overkjørt i juli ser fortsatt ut som
en beslutning i sidepanelet vårt. Minnefunksjonen under bygging er delvis svar, men bare for det
som faktisk ble skrevet i appen.

---

## 8. Evernote

### Den arkitektoniske smerten
ENML (Evernotes XML-dialekt) er et proprietært dokumentformat i en proprietær synk-tjeneste.
Notatet er ikke en fil, og innholdet er ikke redigerbart utenfor klienten. Kombinert med at
produktet oppmuntret til ubegrenset innsamling («clip everything»), blir resultatet et arkiv
uten struktur og uten utgang.

> «the proprietary language for the source of the notes is retarded, there's no way of editing
> the raw content» — omegote, [HN 9768208](https://news.ycombinator.com/item?id=9768208)

> «I'm still mad at Evernote for losing my data years ago and tell everyone I talk to not to use it»
> — sheepmullet, [HN 9985507](https://news.ycombinator.com/item?id=9985507)

### Hvorfor den ikke kan fikses
Formatet og synkprotokollen er det som gjør klientene like på tvers av plattformer. Å gjøre
notatene til filer ville fjerne synk-tjenesten som var forretningsmodellen.

### Gjelder oss
Nei – dette er den smerten markdown-på-disk faktisk løser, uten forbehold.

---

## 9. Apple Notes

### Den arkitektoniske smerten
Notatene ligger i en SQLite-database med proprietært kodet innhold, uten offentlig API. Smerten
er **ikke** at eksport er tungvint – det er at ingen annen programvare kan lese eller skrive
korpuset ditt, og at det derfor ikke finnes noe økosystem over det.

> «Apple doesn't expose any APIs for Notes so it cannot be integrated with ChatGPT/Codex/Claude.»
> — Gareth321, [HN 49153992](https://news.ycombinator.com/item?id=49153992)

> «Apple does not provide a clean way to export notes for archival»
> — mark_l_watson, [HN 15475048](https://news.ycombinator.com/item?id=15475048)

> «exporting Apple Notes in bulk loses any hyperlinked URLS. It also doesn't copy hyperlinks
> when copy-pasting out of Notes» — sails, [HN 25301234](https://news.ycombinator.com/item?id=25301234)

> «export options require AppleScript, or paid Mac app (lost some images). no Linux client»
> — pacifika, [HN 28274429](https://news.ycombinator.com/item?id=28274429)

> «the notes are just kept in an sqlite database so it shouldn't be too hard to hack your data
> out manually» — nickloewen, [HN 22046895](https://news.ycombinator.com/item?id=22046895)

### Hvorfor den ikke kan fikses
Fravær av API er produktpolitikk hos Apple, ikke en teknisk begrensning – men den er like stabil
som arkitektur, og har vært konstant i over ti år. **[Slutning]** Realistisk er den like
ufiksbar som noe annet i denne rapporten.

### Gjelder oss
Nei for vår egen datamodell, men den definerer markedsåpningen: Apple Notes er der mange faktisk
fanger tekst, og det er praktisk talt utilgjengelig for import.

---

## 10. PKM som felt – smerten ingen av verktøyene løser

Ikke ett verktøy, men den vanligste observasjonen på tvers, og den underbygger Roam-avsnittet:

> «It turned out that I never reached out to any of these notes … I didn't need to keep this
> knowledge in any form of personal wiki.»
> — pprotas, [HN 38774022](https://news.ycombinator.com/item?id=38774022)

> «Most of the value from note taking I get is by writing notes, not by managing them or looking
> them up later. I'd almost never look up stuff again.»
> — mudrockbestgirl, [HN 33221216](https://news.ycombinator.com/item?id=33221216)

> «I almost never refer back to things I've written in the past»
> — ALittleLight, [HN 30152556](https://news.ycombinator.com/item?id=30152556)

> «all these 'superproductive knowledge base gigachad note-taking apps' are made to waste more
> time on 'productivity' procrastination of setting things up instead of actual 'lets help the
> user' part.»
> — thecupisblue, [HN 38799138](https://news.ycombinator.com/item?id=38799138)

> «People got really wrapped up in the belief that the process was more important that the
> content … fancy procrastination»
> — goostavos, [HN 48777791](https://news.ycombinator.com/item?id=48777791)

**Forskning.** Ofer Bergman og Steve Whittaker, *The Science of Managing Our Digital Stuff*
(MIT Press, 2016) er det mest substansielle jeg fant: hovedfunnet er at folk foretrekker
navigasjon framfor søk i egne samlinger, og at lagret personlig informasjon i liten grad
gjenbesøkes. Samme gruppe har en oppfølger med en tittel som sier alt: Bergman, Whittaker &
Schooler, *«Out of sight and out of mind: Bookmarks are created but not used»*, Journal of
Librarianship and Information Science, 2021
([lenke](https://journals.sagepub.com/doi/10.1177/0961000620949652)).
**Forbehold:** jeg har verifisert tittel, forfattere og publisering, ikke lest artiklene i
fulltekst – ikke siter tall fra dem uten å hente dem selv.

---

# Samlet vurdering

## 4. Hva vi har løst, og hva vi bare har flyttet

### Faktisk løst

| Smerte | Hos hvem | Hvorfor den er borte hos oss |
|---|---|---|
| Data låst i proprietært format | Evernote, OneNote, Apple Notes, Notion | Markdown på disk er sannheten, ikke en eksportmålform. Den eneste smerten i rapporten vi løser uten forbehold. |
| Nettverksavhengighet / offline etter sju år | Notion | Offline og uten API-nøkkel fra dag én. Ikke en funksjon – en konsekvens av at det ikke finnes en server. |
| «Bygg skjemaet før du kan spørre» | Notion, Obsidian+Dataview | Klassifiseringen utledes av teksten. Brukeren skriver, systemet leser. |
| Søk begrenset til det nylige | Milanote | FTS5 over hele korpuset, ikke over en cache av nylig sett innhold. |
| Ingen typeforskjell på beslutning og småprat | Slack | De ni klassifiseringene *er* svaret på dette – hvis samtaleimporten faktisk leveres. Uten import er det bare løst for det brukeren selv skriver. |

### Bare flyttet

1. **Eksportproblemet, invertert.** Notion gir deg CSV og du må bygge visningene på nytt. Vi gir
   deg all teksten, og du mister alt systemet forstod – klassifiseringer, rettelser, koblinger
   ligger i SQLite, ikke i filene. En bruker som slutter hos oss tar med seg notatene og mister
   produktet. Det er nøyaktig kepanos innvending mot Notion, sagt om oss.
   Og vi kan ikke bare skrive det inn i filene, for da får vi iLemmings innvending i stedet:
   *«The portability benefit … evaporates the moment you add the metadata you need.»*
   Dette er en ekte skvis, ikke et valg vi har unngått. Vi har valgt den ene siden av den.

2. **Manuelt struktureringsarbeid, flyttet i tid.** Notion krever at du tagger på forhånd. Vi
   krever at du retter etterpå. Hvis presisjonen er høy nok, er det en enorm forbedring. Hvis
   presisjonen er middels, er det *samme arbeidsmengde med dårligere determinisme* – Notions
   skjema er i det minste forutsigbart. Rettelsesraten er derfor ikke en kvalitetsmetrikk; den
   er produktets eksistensberettigelse.

3. **Plugin-råte erstattet av modellråte.** Obsidian-brukeren frykter at en oppdatering brekker
   en plugin. Vår bruker får noe verre: en endring i klassifiseringsmodell eller prompt kan
   *stille om* hva systemet mener gamle avsnitt betyr. Obsidians brudd er synlig og feiler høyt;
   vårt brudd er usynlig og feiler stille. **[Slutning]** – jeg fant ingen brukerklager på dette
   ennå, fordi produktkategorien knapt finnes.

4. **Dokumentråte erstattet av beslutningsråte.** Confluence vet ikke hvilken side som gjelder.
   Vi vet ikke hvilken beslutning som gjelder, bortsett fra der minnefunksjonen ser en direkte
   motsigelse i tekst vi selv har klassifisert.

## 5. Hva som rammer oss selv – den ærlige delen

**5.1 Gjenfinningstroen. Vi er i samme klasse som Roam.**
Sidepanelet, spørre-søket og hele den utledede strukturen er *pull*: de gir avkastning når
brukeren spør. «I am not really going back through all of these notes» er akkurat like sant om
et sidepanel som om en graf. Det eneste i produktplanen som bryter dette er tverrnotat-minnet –
funksjonen som snakker uten å bli spurt. Alt annet vi bygger konkurrerer om oppmerksomhet med
noe brukeren allerede har sluttet å åpne.

**5.2 Korpuset vårt er systematisk ufullstendig, og svarene våre skjuler det.**
Ingen mobil, intet samarbeid, én maskin, kun det brukeren skriver i appen. Men fangst skjer på
telefon, i Slack, i e-post, i Apple Notes (som vi ikke kan lese). Når brukeren spør «hva er
uavklart», svarer vi med det vi har sett – og svaret ser autoritativt ut. Det er en verre
feilmodus enn Milanotes «søk finner bare det nylige», fordi Milanote-brukeren *merker* at søket
sviktet. Vår bruker merker ingenting. Et sikkert svar på et ufullstendig korpus er det
farligste dette produktet kan produsere.

**5.3 Vi har ikke avsnittsidentitet – og vi har bygget rettelser oppå den vi ikke har.**
Filene er sannheten, og en fil er en strøm av tekst. Hva er en rettelse lagret *mot*? Linjenummer
brytes ved redigering; innholdshash brytes når brukeren fikser en skrivefeil i avsnittet. Dette
er nøyaktig problemet Notion løste med blokk-ID-er og til slutt CRDT-er, og som Word aldri løste.
Vi har valgt Words datamodell og Notions ambisjon. Hvis en rettelse blir foreldreløs, eller
verre, fester seg til feil avsnitt etter en redigering, sier minnefunksjonen «du forkastet dette
10. september» om noe brukeren aldri forkastet. Det skjer én gang før troen er borte.

**5.4 De ni kategoriene er vårt skjema, påtvunget brukeren.**
Vi har fjernet Notions krav om at brukeren definerer strukturen, ved å definere den for dem. Det
er bedre for de fleste, men det er en fast ontologi: beslutning, spørsmål, tvil, gjengivelse,
uenighet, begrensning, observasjon, oppgave, meta. En bruker hvis arbeid ikke dekomponerer slik –
en forsker, en jurist, en terapeut – har ingen vei ut. Dataview lar deg i det minste finne opp et
felt. **[Slutning]**, men den følger direkte av designet.

**5.5 Beslutningsloggen fra Slack havner på én laptop.**
Verdien av «hvem sa hva, og hva ble avgjort» er nesten utelukkende sosial – den skal avgjøre en
uenighet mellom mennesker tre uker senere. Uten deling har vi bygget organisasjonens minne på en
maskin ingen andre har tilgang til. Det er ikke en manglende funksjon; det er at samarbeid er
bevisst utelatt, og at nettopp dette planlagte bruksområdet krever det.

**5.6 Vi klassifiserer andres prosa uten forfatteren i rommet.**
I brukerens egne notater er rettelsen billig: hun vet hva hun mente. I en importert Slack-tråd
vet ikke den som retter hva Kari mente da hun skrev «ok, vi tar det». Feilraten går opp samtidig
som rettelsesevnen går ned. Det er den eneste planlagte funksjonen der korreksjonssløyfen –
produktets hele trygghetsmekanisme – ikke virker.

## 6. Den dyreste smerten, hvis jeg bare fikk løse én

**Tilliten til det utledede laget.** Konkret: *stabil avsnittsidentitet som overlever
redigering*, og deretter presisjon foran dekning i tverrnotat-minnet.

Begrunnelsen er at alle de andre smertene er gradvise, mens denne er binær. Et tregt søk gjør
produktet dårligere. En feil gjenkalling – «du forkastet dette 10. september» om noe brukeren
aldri forkastet – gjør produktet *usant*, og fra usant kommer man ikke tilbake. Hele
kategorilitteraturen i seksjon 10 handler om folk som sluttet å tro at systemet ville gi noe
tilbake; forskjellen er at Roam-brukere sluttet å tro fordi systemet var *stille*, mens våre vil
slutte å tro fordi systemet *tok feil høyt*. Det andre går fortere.

Rekkefølgen jeg ville tatt:
1. Avsnittsidentitet som overlever redigering (hash + fuzzy re-anker, ikke linjenummer), slik at
   rettelser aldri fester seg til feil avsnitt.
2. Terskel på minnet: si ingenting framfor å si noe som er nesten riktig. Mål andelen
   gjenkallinger brukeren avviser; det tallet er produktets helse.
3. Deretter spørre-søket – og la det si hva det *ikke* har sett, slik at 5.2 blir synlig for
   brukeren i stedet for skjult.

Det som *ikke* er mest presserende, tross plassen det får i konkurrentanalyser: eksportformat
(løst), offline (løst), hastighet (fiksbart), mobil (dyrt, og løser ingenting før tilliten står).
