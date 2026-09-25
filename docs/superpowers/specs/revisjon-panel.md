# Revisjon: forståelsespanelet

Lest: `understand.rs`, `minne.rs`, `rettelser.rs`, `samtale.rs`, `lib.rs`,
`Panel.tsx`, `App.tsx`, `Editor.tsx`, `api.ts`, og de fire målingene i
`klassifiseringstest/`. Kun lest, ingenting endret, appen ikke startet.

Målestokken gjennom hele: **en manglende kobling koster en tapt mulighet, en
falsk kobling koster produktet.** Alt som får panelet til å påstå noe usikkert
med sikker stemme rangeres først.

Alle linjenummer er i `apps/creatorhub-notes/app/` der ikke annet står.

---

## A. Tar feil høyt

### 1. `begrensning|hold` forsvinner helt ut av panelet — og det er nettopp den klassen målingen kranglet mest om

`Panel.tsx:33-40`. `lest()` sjekker `oppgave`, så `bygg`, så
`gjengivelse`/`uenighet`, så `tvil`, så `spørsmål`/`marker_åpent`, og faller
ellers på `return null`. En `begrensning|hold` treffer ingen av grenene og
vises ikke i det hele tatt.

`RESULTAT.md:17-27` avgjorde den saken: de tre kravavsnittene («bestemorvennlig»,
«det må ikke synes at du er i demo modus», «bedre enn Word, Notion, Milanote»)
er `bygg`, og **fasiten**, ikke modellene, tok feil. Den konklusjonen er aldri
skrevet inn i prompten — `understand.rs:95` har fortsatt den nakne linja
«begrensning Sier hvordan, ikke hva» uten et ord om at et krav er en
beslutning om *hvordan*.

Så: Haiku, som er modellen i drift, traff handling 58 % i kjøring 2
(`RESULTAT.md:106`). Halvparten av gangene sier den `hold` på et krav, og da er
kravet borte fra skjermen. Ikke feilplassert — borte, uten spor.
**Hva hun mister:** kravene hun formulerer forsvinner tilfeldig, og hun har
ingen måte å oppdage det på, fordi et avsnitt uten linje ser ut som et avsnitt
uten innhold.

### 2. Delresultatene overskriver rettelsene hennes i minuttene lesningen står på

`lib.rs:451-454` sender `Framdrift` med rå avsnitt; `rettelser::merge` skjer
først på `lib.rs:499-501`, etter siste pakke. `App.tsx:193-202` legger
delresultatene rett inn i `forståelse.paragraphs` med `correction: null`.

En importert tråd på 300 innlegg tar fire kall à 20-45 s (`understand.rs:51-53`).
I hele det vinduet står panelet med modellens lesning oppå linjene hun allerede
har rettet. **Hva hun mister:** rettelsen hennes reverterer synlig og kommer
tilbake flere minutter senere. Hun kan ikke vite at det er midlertidig, og den
naturlige reaksjonen er å rette den igjen.

### 3. Et omskrevet avsnitt beholder gammel kortform i basen

`minne.rs:168-173`. Ved `Match::Endret` oppdaterer `synk` kun `forstatt.tekst`.
`type`, `handling`, `kortform`, `venter` og `tidspunkt` står som de var. Raden
reklassifiseres bare hvis klassifiseringen faktisk lykkes etterpå — og den
lykkes ikke når `claude` er nede, når pakken feilet (`understand.rs:528-529`),
eller når lesningen ble forlatt (`lib.rs:455`).

Den raden er det `kandidater` (`minne.rs:355-364`) og `spør`
(`minne.rs:851-859`) leser. **Hva hun mister:** «Tidligere om dette» og det
strukturerte søket siterer det avsnittet *pleide* å si, med teksten det sier nå
ved siden av. Ingenting merker raden som utdatert.

### 4. Relasjoner overlever at begge sidene skrives om

`minne.rs:196-199` sletter relasjoner bare når en id forsvinner. En `Endret`
id beholder alle dommene sine. Terskelen er 0,36 (`IDENTITET.md:105`), og
vinduet er `[0,20 – 0,52]` — et avsnitt kan endres mye og beholde id-en.

**Hva hun mister:** hun skriver om avsnittet til å si noe annet, og panelet sier
fortsatt «Du forkastet dette 10. september» om en sammenligning som ikke lenger
finnes. Det er den ene setningen `RELASJONER.md:84-86` sier er verre enn å ikke
vise linja i det hele tatt.

### 5. Datoen på «Tidligere om dette» er klassifiseringsdato, ikke tankens dato

`minne.rs:275` setter `tidspunkt = nå()` ved første innsetting. Det er
tidspunktet appen leste avsnittet, ikke da hun skrev det.

Tre måter det bommer på:
- En notatfil skrevet i mars, lest første gang i dag → «13. september».
- En importert Slack-tråd fra i vår → hele tråden får importdagen.
- Klokkeslettet `samtale.rs:32-34` bærer inn i fila parses aldri tilbake til
  noe som brukes; `avsnitt`-tabellen har ingen tidskolonne.

Kommentaren på `minne.rs:250-252` sier at datoen «skal peke på dagen tanken
kom». Det gjør den bare for notater som er skrevet mens appen kjørte.
**Hva hun mister:** hele verdien i linja ligger i datoen. «Du forkastet dette
10. september» med feil dato er en påstand om hennes egen historikk som er
usann, og den ser like sikker ut som en riktig.

### 6. Identitet matcher på tekst alene, uten avsender — og samtaleimport har landet

`minne.rs:119-141` sender alle tekstene til `match_avsnitt` uten å avgrense per
avsender. `IDENTITET.md:153-155` skrev opp nøyaktig dette som uløst: «Når
samtaleimport kommer, er «samme setning fra to personer» to avsnitt, og
matchingen må trolig avgrenses per avsender før likhet i det hele tatt
beregnes. Ikke bygget, ikke målt.» Samtaleimporten er bygget
(`samtale.rs`, `lib.rs:392-397`); avgrensningen er ikke.

Forsterkende: `IDENTITET.md:149-151` sier Jaccard er svakest under fem ord, og
et chat-innlegg *er* under fem ord ofte. Terskelen 0,36 er målt på 34
syntetiske norske notatavsnitt, ikke på chat.
**Hva hun mister:** to «Ja, enig» fra to personer kan bytte identitet ved en
reimport, og rettelsen hun gjorde på Marius' linje havner på Karis.

### 7. Rettelsen hennes blir oversatt til noe hun aldri sa, og lærer opp modellen på det

`minne.rs:646-658`. `som_svar` mapper de fire plassene i panelet tilbake til
ett kanonisk `(type, handling)`-par. Men plassene er mange-til-én:

| systemet leste | plass i panelet | `som_svar` sier hun rettet til |
|---|---|---|
| `gjengivelse\|hold` | idé | `tvil\|hold` |
| `uenighet\|hold` | idé | `tvil\|hold` |
| `begrensning\|bygg` | forstått | `beslutning\|bygg` |
| `observasjon\|marker_åpent` | uavklart | `spørsmål\|marker_åpent` |

Retter hun bare kortformen og lar plassen stå, produserer `eksempler`
(`minne.rs:667-696`) linja «du svarte gjengivelse, hun rettet det til tvil» —
en rettelse hun aldri gjorde. Den står så i prompten
(`understand.rs:621-633`) og styrer alle framtidige klassifiseringer.
**Hva hun mister:** læresløyfa, som er hele poenget med å lagre rettelser, blir
forgiftet av rettelser hun ikke har gjort, og hun kan ikke se de seks
eksemplene som er aktive.

### 8. `gjengivelse|bygg` og `uenighet|bygg` blir «Forstått»

`Panel.tsx:35` sjekker `action === "bygg"` før den ser på typen. Et referert
standpunkt eller et hun tok avstand fra havner under «Hva vi har forstått» med
hake, hvis modellen tilfeldigvis sa `bygg`.

Dette er nøyaktig feilmodusen `SAMTALE`-blokka (`understand.rs:127-161`) ble
skrevet for å styre, og den er ikke målt: både `RESULTAT.md` og `RELASJONER.md`
måler bare avsnitt Daniel skrev selv.
**Hva hun mister:** kundens ønske står som hennes beslutning, med samme hake
som hennes egne.

### 9. En annens beslutning i en tråd er hennes beslutning i loggen

`lib.rs:516-519` setter `avsender` som ren visning; `Panel.tsx:209` skriver det
som et prefiks. Ingenting i datamodellen skiller «hun bestemte» fra «Marius
bestemte». `minne::spør` med `Mønster::Bestemt` (`minne.rs:837`) svarer på «hva
har jeg bestemt» med alle `handling = 'bygg'`, uansett avsender.

`samtale.rs` har heller ikke noe begrep om *henne* — det finnes ingen «meg»
blant deltakerne, så en tråd hun selv er med i behandles som en tråd mellom
fremmede.
**Hva hun mister:** beslutningsloggen, som er det samtaleimporten finnes for,
blander tre personers beslutninger til én liste hun tror er sin.

### 10. Ingenting overstyrer et tidligere innlegg i samme tråd

Hvert innlegg klassifiseres for seg (`understand.rs:487-548`). Sier Marius
«Vi går for Stripe» kl. 10:32 og «Nei, Vipps likevel» kl. 10:41, står begge som
✓ under «Hva vi har forstått». Relasjonsdømmingen kan koble dem
(`kandidater` filtrerer ikke bort samme kilde, se funn 34), men koblingen blir
en linje i «Tidligere om dette» — den fjerner ikke den utdaterte haken.

`RELASJONER.md` måler bare par på tvers av notater; overstyring inne i én tråd
er verken målt eller håndtert.
**Hva hun mister:** en tråd der noen ombestemte seg leverer to motstridende
beslutninger, begge presentert som gjeldende.

### 11. Ett nytt avsnitt uten nett slår av hele panelet

`understand.rs:528`: `Err(e) if lest == 0 => return Err(e)`. `lest` telles kun
innenfor dette kallet, ikke mot det hukommelsen allerede har. `lib.rs:466-468`
gjør Err om til `Understanding::off()`.

Scenario: 299 avsnitt ligger i `forstatt` og seedes inn i memo
(`lib.rs:419-426`). Hun skriver ett nytt avsnitt mens `claude` ikke svarer.
Første og eneste pakke feiler → hele panelet sier «Forståelsen er ikke
tilgjengelig nå», og 299 linjer pluss alle rettelsene hennes forsvinner fra
skjermen.
**Hva hun mister:** alt, på grunn av én setning. Det trygge svaret er å vise
det som er kjent og la det ene avsnittet stå umerket.

### 12. «Lest på nytt» sies om avsnitt hun slettet, og skjuler at rettelsen er kastet

`rettelser.rs:134-154` merker `foreldet = 1` for enhver id som ikke lenger står
i notatet — omskrevet *eller* slettet. `Panel.tsx:341` sier uansett: ««X» er
lest på nytt, fordi avsnittet er skrevet om.»

To feil i én setning: den er usann når hun slettet avsnittet, og «lest på nytt»
underdriver hva som skjedde — rettelsen er permanent foreldet, ikke vurdert på
nytt. Det finnes ingen vei tilbake til den.
**Hva hun mister:** hun tror systemet gjorde jobben på nytt; det den gjorde var
å kaste arbeidet hennes.

### 13. Slettede og omdøpte notater etterlater spøkelser som panelet siterer

Ingen kode sletter `avsnitt`/`forstatt`/`rettelser`/`relasjoner` når en fil
forsvinner eller får nytt navn. `synk` rydder bare innenfor den `kilde` den
kalles med (`minne.rs:152, 191-200`), og den kalles bare når det notatet leses.

Følger:
- «Tidligere om dette» siterer notater som ikke finnes. Klikk går til `åpne` →
  `readNote` feiler → rå feilstreng i `setFeil` (`App.tsx:282-284`).
- Døper hun om en fil, får alle avsnitt nye id-er under den nye `kilde`, mens de
  gamle radene står med `foreldet = 0` for alltid og fortsetter å mate
  `eksempler` (`minne.rs:667`) inn i hver eneste prompt.
- `foreldede` søker på `sti`-kolonnen (`rettelser.rs:136`), så den gamle stien
  leses aldri igjen og hun får aldri beskjed.

**Hva hun mister:** rettelsene på et omdøpt notat er borte uten et ord, og de
fortsetter samtidig å styre klassifiseringen usynlig.

### 14. «Tidligere om dette» sier ikke hva den gjelder

`Panel.tsx:89-96` dedupliserer på `t.hash` — det *gamle* avsnittet. Peker tre
avsnitt i notatet på det samme gamle, vises linja én gang, knyttet til det
avsnittet som tilfeldigvis kom først etter sorteringen i `minne.rs:630`. Feltet
`gjelder` finnes i dataene (`api.ts:57`) og brukes ingen steder i visningen.

**Hva hun mister:** hun får en påstand om historikken sin uten å se hvilken
setning hun nettopp skrev som utløste den. Da kan påstanden ikke etterprøves,
som er hele grunnen til at linja skal være klikkbar.

### 15. `README.md` sier «Ingen nettverk». Panelet sender hvert avsnitt ut av maskinen.

`README.md:5`: «Ett vindu, tre felt … Ingen nettverk, ingen API-nøkkel — alt er
markdown på disk, git og SQLite.» `understand.rs:642-651` starter `claude -p`
med hele prompten, som inneholder teksten hennes ordrett. Doc-kommentaren
`understand.rs:15` — «Ingen API-nøkkel, men heller ingenting som kan sendes
videre til andre» — leses naturlig som at teksten blir liggende.

**Hva hun mister:** grunnlaget for å ta et informert valg om hva hun skriver i
appen. Se også funn 32 (ingen av-bryter per notat).

### 16. Et avsnitt modellen ikke svarte for forsvinner uten spor

`understand.rs:395-400` hopper over linjer med tom kortform, ukjent type eller
nummer utenfor rekkevidde; `understand.rs:543-547` filtrerer bort avsnitt uten
merke. Resultatet er en kortere liste, ikke et hull.

**Hva hun mister:** hun kan ikke skille «appen leste dette og fant ingenting å
si» fra «appen klarte ikke å lese dette». Begge ser ut som avsnitt som ikke
betyr noe. Kombinert med funn 1 er dette to uavhengige måter et avsnitt kan
falle ut av panelet uten å si ifra.

### 17. Et par uten svar lagres som `urelatert` for alltid

`minne.rs:608`: `let f = f.unwrap_or_else(|| URELATERT.to_string());`. En
avkortet svarstreng, en parse-bom eller ett hoppet linjenummer skriver en
permanent rad. `lagret_forhold` (`minne.rs:547-554`) spør aldri igjen.

Å ikke vise en kobling er riktig i øyeblikket — men det er ikke det raden sier.
Den sier «disse to er dømt urelatert», og forskjellen på «dømt» og «ikke lest»
finnes ikke i skjemaet (`minne.rs:89-95`: ingen kolonne for hvilken modell,
hvilken versjon eller om det var et ekte svar).
**Hva hun mister:** en ekte kobling kan bli permanent usynlig på grunn av én
avkortet svarstreng, og ingenting prøver på nytt.

### 18. Pilen deles ut av alle kortformer, ikke bare oppgaver

`understand.rs:412-421` splitter på `←`/`<-` uansett type. `README.md:52-56`
sier «Bare oppgaver kan ha pil, og høyst én», men `parse` håndhever det ikke.
`Panel.tsx:211` viser `dependency` bare når plassen er `oppgave` — så en
`beslutning` hvis kortform inneholder «<-» får alt etter pilen stille kuttet
bort.
**Hva hun mister:** en kortform som blir avkortet midt i, uten synlig grunn.

### 19. Avhengigheten fra en oppgave lagres, men bæres ikke gjennom en rettelse

`minne.rs:834-835`: `Mønster::Venter` krever `f.venter <> ''`. Retter hun en
linje til plass `oppgave` (`rettelser.rs:20`), skrives ingen `venter` — det
feltet finnes ikke i `Retting` (`rettelser.rs:34-46`). Linja blir en oppgave i
panelet, men den kan aldri finnes av «hva venter på noe».
**Hva hun mister:** hennes egen retting gir en dårligere oppgave enn maskinens.

---

## B. Uklart

### 20. Ingenting sier hvor gammel en linje er, eller hvilken modell som leste den

`minne.rs:53-62`: `forstatt` har ingen kolonne for modell, promptversjon eller
taksonomiversjon. `kjente` (`minne.rs:211-243`) slår opp på `innhold_hash`
alene, uten tids- eller versjonsfilter. En linje klassifisert av en eldre modell
under en eldre taksonomi vises i dag identisk med en fersk, og leses aldri på
nytt så lenge teksten står uendret.

`understand.rs:25-28` datostempler `MODEL` «med vilje: resultatet gjelder denne
utgaven av modellen» — men datostempelet er en kommentar, ikke noe som følger
raden. Byttes `MODEL` eller `SYSTEM`, invalideres ingenting.
Dette er punktet arkitekturdokumentet skrev opp som uløst, og det står uløst.
**Hva hun mister:** panelet blander lesninger fra ulike modeller og ulike
regler i én liste, uten at noen av dem kan spores.

### 21. Hun kan ikke se hva hun har rettet

`Panel.tsx:47`: `kortformen` foretrekker rettelsen stille. Den rettede linja
renderes nøyaktig som en maskinlest. Ingen liste over rettelser finnes, verken
i panelet eller i søket, og de seks eksemplene som faktisk styrer prompten
(`minne.rs:664, 667`) er usynlige.
**Hva hun mister:** hun kan ikke revidere sin egen fasit, ikke se om et mønster
hun rettet slår gjennom, og ikke fjerne en rettelse hun angrer på uten å finne
linja igjen i det notatet den sto i.

### 22. Ingen forskjell på det systemet er sikkert på og det den gjetter

Alle linjer får samme rene tegn (`Panel.tsx:9-14, 205-207`). `RESULTAT.md:106-107`:
Haiku treffer handling 58 % og type 77 % i kjøring 2. Omtrent hver fjerde linje
er feilmerket, og ingen av dem ser annerledes ut.
`RESULTAT.md:126-129` sier selv at et tall som svinger ti poeng mellom to
kjøringer «bærer ikke en beslutning alene» — panelet oppfører seg som om det
gjør det.

### 23. `?` betyr to forskjellige ting

«Uavklart» dekker både «dette er et åpent spørsmål du stilte» og «modellen
våget ikke bestemme seg». `RESULTAT.md:42-43`: ni av Haikus elleve ekstra feil
var `marker_åpent` der fasiten sa `hold` — altså er `?` i praksis Haikus
usikkerhetsutgang. Det leses som hennes åpne spørsmål.
**Hva hun mister:** listen over «det jeg ikke har bestemt» blir en blanding av
hennes tvil og maskinens.

### 24. Angre finnes bare i økta, bare ett steg dypt, og bare på skjermen

`Panel.tsx:251` holder stabelen i komponent-state, og `App.tsx:646`
(`key={path}`) river komponenten ved notatbytte. Bare siste element har knapp
(`Panel.tsx:298, 323-334`). Angre-handlingen legges ikke på stabelen selv, så
det finnes ingen «gjør om».
Kommentaren `Panel.tsx:248-249` lover «hele angrehistorikken for økta» — den er
riktig for stabelen, men ikke for det brukeren ser.
**Hva hun mister:** en feilklikket «Ikke relevant» er permanent så snart hun
bytter notat.

### 25. Retteskjemaet er festet til en posisjon som flytter seg

`Panel.tsx:250, 302, 317` bruker `p.start` som nøkkel for «hvilken linje
redigeres», og `Panel.tsx:163` bruker den i radio-gruppens `name`. Lander en
lesning mens hun skriver i feltet (autolagring hvert 900 ms, `App.tsx:248`),
endres posisjonene og skjemaet hopper til en annen linje eller forsvinner med
teksten hun skrev.

### 26. Panelet sier hvor langt lesningen er kommet, men slutter å si det før det dyre begynner

`Panel.tsx:352-356` viser «Leser avsnitt N av M» så lenge `framdrift` ikke er
null. `App.tsx:203` nuller den når `lest === totalt`. Deretter kjører
`minne::tidligere` (`lib.rs:485`) med opptil to modellkall — Haiku på alle par,
så Sonnet på dem Haiku koblet, og `RELASJONER.md:156-158` sier 60-75 % går
videre til Sonnet, altså er det normalen, ikke unntaket.
**Hva hun mister:** panelet ser ferdig ut mens det fortsatt jobber og fortsatt
koster. Hun kan verken vente på det eller avbryte det.

### 27. «Tidligere om dette» er blank gjennom hele lesningen, uten forklaring

`App.tsx:200`: ved en fersk lesning settes `earlier: []`, og seksjonen fylles
først av sluttsvaret (`lib.rs:505`). På et langt notat står den mest
verdifulle delen av panelet tom i minutter, og ser identisk ut med «det finnes
ingen koblinger».

### 28. Notatbytte under relasjonsdømming fryser panelet

`avbryt_lesning` (`lib.rs:553`) øker bare telleren. `minne::tidligere` er
allerede forbi sin `gjelder_fortsatt()`-sjekk (`lib.rs:484`) og holder
memo-mutexen (`lib.rs:401`) gjennom begge kallene — opptil 2 × `TIMEOUT` =
10 minutter (`understand.rs:45`). Neste lesning står i kø bak den.
**Hva hun mister:** hun bytter notat og panelet står stille uten forklaring,
lenge etter at hun gikk videre.

### 29. Linja i «Tidligere om dette» viser ingen begrunnelse

`Panel.tsx:100-118` viser setning, kortform og tittel. Ingenting sier hvilke
ord som matchet, at to modeller leste paret, eller at akkurat denne linja er
`nevnt` fordi de var uenige. `RELASJONER.md:119-125` sier 7-8 % av de viste
linjene er fallbacken — en leser kan ikke se hvilke.

### 30. `nevnt` ser ut som de tre andre

Bare `motsier` får en egen klasse (`Panel.tsx:106`). `nevnt` skiller seg
utelukkende på ordlyden i `SETNINGER` (`Panel.tsx:79-84`). Skillet
`RELASJONER.md:98-111` bygde spesifikt for å slutte å påstå retning bæres av
prosa alene, uten noen visuell forskjell som overlever et raskt blikk.

### 31. Panelet sier ikke at det skjuler noe

`observasjon`, `meta` og alt med `handling = ingenting` som ikke er `oppgave`
returnerer `null` (`Panel.tsx:39`) og vises aldri. Et notat som mest er
observasjoner gir «Ingenting er bestemt ennå» (`Panel.tsx:360`) — som leses som
«vi leste og fant ingenting», ikke «vi leste og gjemte det».
Samme setning brukes dessuten mens senere pakker fortsatt kjører: «Leser
notatet» vises bare når `forståelse` er `null`, ikke når første pakke er inne.

### 32. Ingen kostnad, ingen teller, ingen av-bryter per notat

Bryteren i toppen (`App.tsx:486-497`) er global og bor i `localStorage`.
Det finnes ingen måte å si «ikke send dette notatet ut». Kombinert med funn 15
(README sier ingen nettverk) betyr det at et notat om en klient, en ansatt
eller en helsesak går ut av maskinen ved første autolagring uten at noe har
spurt.
Ingen steder står antall kall, antall tokener eller hva det har kostet.

### 33. `venter på X` er fritekst som aldri sjekkes mot noe

`Panel.tsx:211` skriver ut `p.dependency` rått. En avhengighet som peker på noe
som ikke finnes ser nøyaktig ut som en som gjør det. `Mønster::Venter`
(`minne.rs:834-835`) lister dem, men kobler dem aldri til en oppgave.

### 34. «Tidligere om dette» kan peke på et avsnitt to linjer opp i samme notat

`minne.rs:363` filtrerer bare `f.avsnitt_id <> ?3` — ikke på `kilde`. Kombinert
med funn 5 (datoen er klassifiseringsdato) får hun «Du forkastet dette
13. september» om et avsnitt hun ser på skjermen, med dagens dato.

### 35. Deltakerlista er utledet per avsnitt og faller stille sammen

`App.tsx:582-585` viser `samtale.deltakere`, som `samtale::form`
(`samtale.rs:401-415`) bygger ved å kjøre `avsender()` på hvert avsnitt. Et
avsnitt uten gjenkjent hode gir ingen deltaker og ingen advarsel. Limer hun en
tråd inn i et notat som allerede har innhold (funn 36), er halve fila avsnitt
uten avsender i et notat merket «Samtale med Marius, Kari».

### 36. Innliming av en tråd i et eksisterende notat merker hele fila, og kaster linjeskift

`Editor.tsx:196-205` setter `kilde: samtale` i toppfeltet på hele notatet når
innlimingen kjennes igjen. Alle avsnitt som sto der fra før leses nå med
`SAMTALE`-prompten (`lib.rs:428-432`).
«Ikke en samtale» (`App.tsx:590-592`) snur bare toppfeltet. Den gjenoppretter
ikke den innlimte teksten, som allerede er slått sammen til én linje per
innlegg av `samtale::skriv` (`samtale.rs:327-336`; ponytail-notatet
`samtale.rs:323-326` bekrefter at linjeskift går tapt).
**Hva hun mister:** originalen. Overstyringen går én vei i praksis selv om den
er dokumentert som å gå begge.

### 37. `IDENTITET.md` sier modulen ikke er koblet inn. Den er koblet inn.

`IDENTITET.md:157-161`: «Den er **ikke** koblet inn i appen — verken skjema,
migrering eller `understand.rs` er rørt.» `minne.rs:21, 141` bruker
`match_avsnitt` i `synk`, som kalles fra `lib.rs:412-415` ved hver lesning, og
`migrering.rs` migrerer nettopp til det skjemaet. Dokumentet er autoriteten i
oppdraget, og det er utdatert på et punkt som avgjør hvor mye man skal stole på
forbeholdene rundt det (blant annet funn 6).

---

## C. Mangler

### 38. En kobling kan ikke avvises

Ingenting skriver til `relasjoner` utenom `minne.rs:609`. Det finnes ingen
kommando, ingen knapp, ingen tabellkolonne for brukerens dom. Hver
klassifiseringslinje har «Endre» (`Panel.tsx:217-219`); ingen relasjonslinje har
noe som helst.

`RELASJONER.md:26-29` sier rett ut at ti falske koblinger etter hverandre gjør
at hun slutter å lese seksjonen, og at funksjonen da er verre enn ingenting.
Det eneste hun kan gjøre med en falsk kobling i dag er å se på den.
**Neste steg:** samme mønster som `rettelser` — en rad hun eier, som vinner
over dommen, og som blir et eksempel i `relasjonsprompt` slik rettelser blir det
i `prompt`.

### 39. «Tidligere om dette» er uten tak og uten paginering

`minne.rs:571-631` returnerer hver lagrede ikke-`urelatert` relasjon for hvert
avsnitt; `Panel.tsx:350` renderer alle, over selve panelinnholdet. Med
`PER_AVSNITT = 3` (`minne.rs:421`) og 15 nye dommer per lagring vokser antallet
lagrede koblinger monotont. Ponytail-notatet `minne.rs:343-344` sier eksplisitt
at det ikke finnes noen tidsgrense.
**Hva hun mister:** ved hundre koblinger til det samme notatet skyves «Hva vi
har forstått» ut av synsfeltet av en historikk hun ikke ba om.

### 40. Halen av et langt notat blir aldri dømt

`minne.rs:584-586`: `None if udømte.len() < MAKS_PAR => …`, ellers `None => {}`.
Kandidatene samles i avsnittsrekkefølge, så på en importert tråd er det alltid
de første ~5 avsnittene som fyller de 15 plassene — hver eneste lagring, for
alltid. Avsnitt 200 får aldri en kobling vurdert.
Det skjer stille: ingen kø, ingen markør, ingen «resten dømmes senere» i
praksis, tross det kommentaren `minne.rs:416-417` lover.

### 41. Oppgaver har ingen tilstand

`Panel.tsx:368-372` lister dem og stopper. Ingen ferdig-markering, ingen frist,
ingen ansvarlig, ingen sortering, ingenting skrives tilbake til notatet.
`Mønster::Venter` kan finne dem; ingenting kan lukke dem.
Kombinert med funn 42 nedenfor er «Oppgaver» i dag en liste som bare vokser.

### 42. Avhengigheter er strenger, ikke en graf

`venter` er én tekst per oppgave (`minne.rs:60`). En kjede (A venter på B
venter på C) kan ikke ses, en sirkel kan ikke oppdages, og «hva blokkerer meg
nå» kan ikke besvares. Formatvalget i `README.md:52-56` er riktig for
kortformen; det som mangler er noe som løser opp strengen etterpå.

### 43. Et avsnitt med to beslutninger får én linje

`understand::split` (`understand.rs:346-371`) deler bare på tomme linjer, og
`parse` tillater nøyaktig én linje per avsnitt. «Vi skal ha innlogging, men
kanskje ikke depositum» blir enten en beslutning (tvilen er borte) eller en tvil
(beslutningen er borte). Det finnes ingen splitting og ingen andre linje.

`README.md:92-96` skriver selv at korpuset er «skrevet *til en assistent*, ikke
*i et notat*», at registeret er «mer instruerende og mindre utforskende enn det
produktet faktisk vil møte», og at ekte notater er lengre og rotere. Det er
nettopp i lengre avsnitt flere påstander bor. Dette er aldri målt.
**Neste steg:** mål det først — hvor stor andel av hennes egne notatavsnitt
inneholder mer enn én påstand — før noe bygges.

### 44. Ingen lengdekontroll på kortformen

Prompten ber om «én kort norsk substantivfrase» (`understand.rs:113`); `parse`
godtar hva som helst ikke-tomt (`understand.rs:395`); panelet renderer det
helt. En modell som svarer med en setning gir en linje som er avsnittet om
igjen, og panelets løfte — hennes tanker kortet ned — forsvinner.

### 45. Ingen sammenslåing av nesten like kortformer

Tre avsnitt om det samme gir tre linjer. `nye()` (`understand.rs:462-474`)
dedupliserer bare identisk tekst. Et notat der hun kretser rundt samme sak i
fire avsnitt gir fire nesten like hakelinjer.

### 46. Eksemplene kureres ikke

`minne.rs:667-696`: ingen dedupe, ingen filtrering av rettelser der `lest` og
`rettet` er like (en ren skrivefeilretting i kortformen spiser en av seks
plasser og lærer bort ingenting), ingen aldersgrense, ingen måte å se eller
slette en. `ANTALL_EKSEMPLER = 6` (`minne.rs:664`) dropper den sjuende stille.
Kommentaren sier selv at tallet «skal måles på nytt, ikke gjettes på» — det er
ikke målt.

### 47. `søkeord` tar de tolv første ordene, ikke de tolv mest særegne

`minne.rs:299-315` bryter ut av løkka på tolv treff i leserekkefølge. For et
langt avsnitt er det åpningen som avgjør hva «Tidligere om dette» kan finne i
det hele tatt. `RELASJONER.md:156-162` behandler ordsøket som gulvet for hva
som kan gjenfinnes; dette setter gulvet ved første setning.

### 48. Relasjoner er retningsbestemte og dømmes to ganger

`minne.rs:94`: `primary key (avsnitt_id, annen_id)`. A→B og B→A er to rader,
dømt av to separate kall, som kan lande ulikt. Åpner hun det gamle notatet, kan
det si noe annet om det samme paret enn det nye gjorde.

### 49. En rettelse koster to modellkall

`App.tsx:318` kaller `les()` etter hver retting. Avsnittene er uendret, så
klassifiseringen er gratis (`understand.rs:500-502`) — men `minne::tidligere`
kjøres på nytt, og har `MAKS_PAR` (funn 40) latt noen par stå udømt, koster
hver eneste retting en Haiku- og en Sonnet-tur. På et langt notat betyr det at
å rette en skrivefeil i en kortform tar minutter og penger.

### 50. Ingen måling på det panelet faktisk gjør

`RESULTAT.md:89-92` peker selv på neste risiko: «om det som *bygges* er riktig
nok til å være verdt oppmerksomheten». Ingen måling dekker:
plasseringsfunksjonen `lest()` (som skjuler `begrensning`, funn 1),
kortformkvalitet, avsnitt med flere påstander (funn 43), samtaler der brukeren
selv deltar (funn 9), eller etikett-treff etter at `nevnt`-regelen kom.
Målingene som finnes er gode; de dekker to av åtte avgjørelser panelet tar.

---

## Merknader om hva som er *riktig* her

Verdt å si, fordi det avgrenser funnene over:

- Eskaleringsarkitekturen (`understand.rs:692-719`) implementerer nøyaktig det
  `RELASJONER.md:60-74` målte, inkludert at annenlesningens feil feller hele
  dømmingen.
- `slå_sammen` (`minne.rs:504-521`) og `NEVNT` er det ærligste grepet i
  kodebasen: å slutte å påstå retning når lesningene er uenige.
- Delresultat som overlever en feilet pakke (`understand.rs:521-540`) og
  synlig-først (`understand.rs:507-509`) er begge riktig prioritert.
- `del()` i `samtale.rs:258-316` krever tre uavhengige ting samtidig og feiler
  mot «ikke en samtale». Riktig retning å bomme.
- `TIMEOUT`, `AVSNITT_PER_PAKKE` og identitetsterskelen er alle målt og
  begrunnet i kommentaren, ikke gjettet.
