/**
 * Demo-innhold for SenseAid Explore: området Nesoddtangen (24.09.2026). Samme
 * konvensjoner som Oslo-området; se kommentaren øverst i
 * reiseguide-demo-data.ts, som samler alle områdene i DEMO_AREAS.
 *
 * Research 24.09.2026 bare fra søkeresultater (Wikipedia, SNL, kommunens og
 * stedenes egne sider var blokkert fra utviklingsmiljøet), så alt er UTKAST og
 * hvert sted har en «Må verifiseres»-liste i sourceNote. Synstolkingen er
 * skrevet ut fra kildene uten befaring; farger og detaljer må kontrolleres på
 * stedet.
 *
 * «Nesoddtangen kirke»: kirken for nordre Nesodden er Skoklefall kirke (1936),
 * om lag tre kilometer sør for brygga. Nesodden kirke og Gjøfjell kirke ligger
 * lenger sør på halvøya og er ikke med.
 */
import type { DemoChapterPrompt, DemoHeroImageSource, DemoLang, DemoPoi } from "./reiseguide-demo-data.js";

export const NESODDTANGEN_AREA_INFO = {
  id: "area_nesoddtangen",
  slug: "nesoddtangen",
  name: "Nesoddtangen",
  defaultLang: "nb" as const,
  center: { lat: 59.8565, lng: 10.6725 },
  bbox: { south: 59.838, west: 10.652, north: 59.875, east: 10.693 },
};

export const NESODDTANGEN_POIS: DemoPoi[] = [
  {
    id: "poi_nesoddtangen_brygge",
    slug: "nesoddtangen-brygge",
    categoryId: "historisk",
    lat: 59.8711,
    lng: 10.6567,
    triggerRadiusM: 80,
    priority: 10,
    sortOrder: 1,
    freePreview: true,
    sourceNote:
      "Utkast 24.09.2026, ikke fagvurdert. Kilder (søkeresultater): https://oslobyleksikon.no/side/Nesoddb%C3%A5tene, https://no.wikipedia.org/wiki/Nesodden-Bundefjord_Dampskipsselskap, https://en.wikipedia.org/wiki/Nesodden%E2%80%93Bundefjord_Dampskipsselskap, https://no.wikipedia.org/wiki/Liste_over_brygger_p%C3%A5_Nesodden, https://en.wikipedia.org/wiki/Nesoddtangen, https://en.wikipedia.org/wiki/Nesodden, https://www.kollektivterminaler.no/en/fergeterminaler/nesoddtangen-brygge/, https://www.tu.no/artikler/nye-tider-pa-nesoddtangen/256692, https://bygg.no/article/46738, https://www.mynewsdesk.com/no/ruter/pressreleases/helelektrisk-overfart-paa-norges-stoerste-bilfrie-baatsamband-2996757, https://www.norled.no/en/nyhet/first-electric-nesodd-boat-in-place-in-oslo/, https://www.naturpress.no/2019/06/03/her-seiler-nesoddferga-ms-kongen-til-horten-nar-den-kommer-tilbake-gar-den-pa-et-26-tonns-batteri/. Må verifiseres: koordinat (tettstedskoordinat for Nesoddtangen fra en.wikipedia, 59.8711, 10.6567; flytt til selve kaia), reisetider (23 og 8 min) og passasjertall (over 10 000 per dag) mot dagens rutetabell, årstall for dampskipene, at båtene har lagt til ved Tingvallakaia siden 1986, ombyggingen i 2019–2020 og tallet 34 prosent, og alt i synstolkingen (skrevet uten befaring).",
    translations: {
      nb: {
        title: "Nesoddtangen brygge",
        subtitle: "Båten til byen",
        summary:
          "Oslo ligger fem kilometer unna over fjorden, men 45 kilometer rundt på vei. Siden 1874 har båtene gått herfra, og i dag er Nesoddbåtene landets største bilfrie båtsamband, drevet med batterier.",
        locationLabel: "Nesodden, Norge",
        heroImageAlt: "Foto av Nesoddtangen brygge",
        practicalInfo: [
          { label: "Båt", value: "Til Aker brygge (ca. 23 min) og Lysaker (ca. 8 min), sjekk ruter.no" },
          { label: "Terminal", value: "Venterom, kiosk og toaletter i terminalbygget; bussterminal og sykkelparkering ved kaia" },
          { label: "Trinnfri tilgang", value: "Ikke bekreftet, sjekk ruter.no" },
        ],
      },
      en: {
        title: "Nesoddtangen Quay",
        subtitle: "The boat to the city",
        summary:
          "Oslo lies five kilometres away across the fjord, but 45 kilometres round by road. Boats have sailed from here since 1874, and today the Nesodden boats are Norway's largest car-free ferry route, running on batteries.",
        locationLabel: "Nesodden, Norway",
        heroImageAlt: "Photo of Nesoddtangen Quay",
        practicalInfo: [
          { label: "Boat", value: "To Aker Brygge (about 23 min) and Lysaker (about 8 min); see ruter.no" },
          { label: "Terminal", value: "Waiting room, kiosk and toilets in the terminal building; bus terminal and bicycle parking by the quay" },
          { label: "Step-free access", value: "Not confirmed; see ruter.no" },
        ],
      },
      da: {
        title: "Nesoddtangen brygge",
        subtitle: "Båden til byen",
        summary:
          "Oslo ligger fem kilometer væk over fjorden, men 45 kilometer rundt ad vejen. Siden 1874 er bådene sejlet herfra, og i dag er Nesoddbådene Norges største bilfri bådforbindelse, drevet med batterier.",
        locationLabel: "Nesodden, Norge",
        heroImageAlt: "Foto af Nesoddtangen brygge",
        practicalInfo: [
          { label: "Båd", value: "Til Aker brygge (ca. 23 min) og Lysaker (ca. 8 min), tjek ruter.no" },
          { label: "Terminal", value: "Venteværelse, kiosk og toiletter i terminalbygningen; busterminal og cykelparkering ved kajen" },
          { label: "Niveaufri adgang", value: "Ikke bekræftet, tjek ruter.no" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Båten til byen",
          text:
            "Du står på Nesoddtangen brygge, ytterst på halvøya mellom Oslofjorden og Bunnefjorden. Over vannet ligger Oslo, bare fem kilometer unna med båt, men rundt 45 kilometer unna på vei rundt fjorden. Derfor er båten livsnerven her. Nesoddbåtene er landets største bilfrie båtsamband, og hver dag reiser mer enn 10 000 passasjerer mellom Nesodden og Oslo. Turen til Aker brygge tar rundt 23 minutter, og til Lysaker i Bærum tar den bare åtte.\n\nBåttrafikken begynte i 1874, da A/S Bundefjord Dampskibsselskab ble stiftet, delvis med britiske penger. Den første båten var en hjuldamper, «Bundefjord», kjøpt fra Storbritannia. Senere kom dampskip som «Kronprins Olav» fra 1908 og «Nesodtangen» fra 1929. I 1942 slo Bundefjord-selskapet og Nesodden-selskapet seg sammen til Nesodden–Bundefjord Dampskipsselskap, som drev båtene helt fram til 2009. Til langt ut på 1970-tallet hadde de fleste bryggene rundt Nesodden daglige anløp. Så ble rutene kuttet, og i dag går nesten all trafikk herfra, til Aker brygge og Lysaker. På Aker brygge har båtene lagt til ved Tingvallakaia siden 1986.\n\nI 2019 og 2020 ble de tre båtene «Kongen», «Dronningen» og «Prinsen» bygd om til batteridrift ved et verft i Horten. Motoren ble byttet ut med en batteripakke på 26 tonn, og utslippene av CO2 fra båttrafikken falt med 34 prosent.",
          estimatedDurationS: 86,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står ved kaia helt ytterst på Nesodden. Rett ved vannet ligger terminalbygget, et lavt hus av glass og limtre, med venterom og kiosk innenfor. Bak deg er det en stor bussterminal og et åpent sykkelstativ. Foran deg åpner fjorden seg, bred og blank, og på den andre siden ligger Oslo, med hus og åser i det fjerne. Båtene legger til ved kaia med jevne mellomrom, og i rushtiden strømmer folk av og på. Til den ene siden fortsetter Oslofjorden mot sør, til den andre går Bunnefjorden innover langs halvøya.",
          estimatedDurationS: 37,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "The boat to the city",
          text:
            "You are standing on Nesoddtangen Quay, at the very tip of the peninsula between the Oslofjord and the Bunnefjord. Across the water lies Oslo, only five kilometres away by boat, but around 45 kilometres away by road round the fjord. That is why the boat is the lifeline here. The Nesodden boats are Norway's largest car-free ferry route, and every day more than 10,000 passengers travel between Nesodden and Oslo. The trip to Aker Brygge takes about 23 minutes, and to Lysaker in Bærum only eight.\n\nBoat traffic began in 1874, when A/S Bundefjord Dampskibsselskab was founded, partly with British money. The first boat was a paddle steamer, the 'Bundefjord', bought from Britain. Later came steamers such as the 'Kronprins Olav' from 1908 and the 'Nesodtangen' from 1929. In 1942 the Bundefjord company and the Nesodden company merged into Nesodden–Bundefjord Dampskipsselskap, which ran the boats right up to 2009. Until well into the 1970s most of the jetties around Nesodden had daily calls. Then the routes were cut, and today almost all traffic goes from here, to Aker Brygge and Lysaker. At Aker Brygge the boats have berthed at Tingvallakaia since 1986.\n\nIn 2019 and 2020 the three boats 'Kongen', 'Dronningen' and 'Prinsen', the King, the Queen and the Prince, were converted to battery power at a yard in Horten. The engine was replaced by a 26-tonne battery pack, and CO2 emissions from the boat traffic fell by 34 per cent.",
          estimatedDurationS: 96,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing by the quay at the very tip of Nesodden. Right by the water is the terminal building, a low house of glass and glued laminated timber, with a waiting room and kiosk inside. Behind you is a large bus terminal and an open bicycle rack. Ahead of you the fjord opens out, broad and shining, and on the far side lies Oslo, with houses and hills in the distance. The boats berth at the quay at regular intervals, and at rush hour people stream off and on. To one side the Oslofjord continues south, to the other the Bunnefjord reaches in along the peninsula.",
          estimatedDurationS: 43,
        },
      ],
      da: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Båden til byen",
          text:
            "Du står på Nesoddtangen brygge, yderst på halvøen mellem Oslofjorden og Bunnefjorden. Over vandet ligger Oslo, kun fem kilometer væk med båd, men omkring 45 kilometer væk ad vejen rundt om fjorden. Derfor er båden livsnerven her. Nesoddbådene er Norges største bilfri bådforbindelse, og hver dag rejser mere end 10 000 passagerer mellem Nesodden og Oslo. Turen til Aker brygge tager omkring 23 minutter, og til Lysaker i Bærum tager den kun otte.\n\nBådtrafikken begyndte i 1874, da A/S Bundefjord Dampskibsselskab blev stiftet, delvis med britiske penge. Den første båd var en hjuldamper, «Bundefjord», købt i Storbritannien. Senere kom dampskibe som «Kronprins Olav» fra 1908 og «Nesodtangen» fra 1929. I 1942 slog Bundefjord-selskabet og Nesodden-selskabet sig sammen til Nesodden–Bundefjord Dampskipsselskap, som drev bådene helt frem til 2009. Til langt op i 1970'erne havde de fleste anløbsbroer rundt om Nesodden daglige anløb. Så blev ruterne skåret ned, og i dag går næsten al trafik herfra, til Aker brygge og Lysaker. På Aker brygge har bådene lagt til ved Tingvallakaia siden 1986.\n\nI 2019 og 2020 blev de tre både «Kongen», «Dronningen» og «Prinsen» bygget om til batteridrift på et værft i Horten. Motoren blev skiftet ud med en batteripakke på 26 tons, og udledningen af CO2 fra bådtrafikken faldt med 34 procent.",
          estimatedDurationS: 87,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Sådan ser det ud",
          text:
            "Du står ved kajen helt yderst på Nesodden. Lige ved vandet ligger terminalbygningen, et lavt hus af glas og limtræ, med venteværelse og kiosk indenfor. Bag dig er der en stor busterminal og et åbent cykelstativ. Foran dig åbner fjorden sig, bred og blank, og på den anden side ligger Oslo, med huse og åse i det fjerne. Bådene lægger til ved kajen med jævne mellemrum, og i myldretiden strømmer folk af og på. Til den ene side fortsætter Oslofjorden mod syd, til den anden går Bunnefjorden ind langs halvøen.",
          estimatedDurationS: 37,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Omtrent hvor lang tid tar båten fra Nesoddtangen til Aker brygge?",
          options: ["8 minutter", "23 minutter", "En time"],
          correctIndex: 1,
          explanation: "Rundt 23 minutter til Aker brygge; til Lysaker i Bærum tar det bare åtte.",
        },
        {
          question: "Når begynte båttrafikken til Nesodden?",
          options: ["1874", "1942", "1986"],
          correctIndex: 0,
          explanation: "A/S Bundefjord Dampskibsselskab ble stiftet i 1874, og den første båten var en hjuldamper.",
        },
        {
          question: "Hva ble båtene «Kongen», «Dronningen» og «Prinsen» bygd om til i 2019 og 2020?",
          options: ["Seilbåter", "Batteridrift", "Bilferjer"],
          correctIndex: 1,
          explanation: "En batteripakke på 26 tonn kuttet CO2-utslippene fra båttrafikken med 34 prosent.",
        },
      ],
      en: [
        {
          question: "Roughly how long does the boat take from Nesoddtangen to Aker Brygge?",
          options: ["8 minutes", "23 minutes", "An hour"],
          correctIndex: 1,
          explanation: "About 23 minutes to Aker Brygge; to Lysaker in Bærum it takes only eight.",
        },
        {
          question: "When did boat traffic to Nesodden begin?",
          options: ["1874", "1942", "1986"],
          correctIndex: 0,
          explanation: "A/S Bundefjord Dampskibsselskab was founded in 1874, and the first boat was a paddle steamer.",
        },
        {
          question: "What were the boats 'Kongen', 'Dronningen' and 'Prinsen' converted to in 2019 and 2020?",
          options: ["Sailing boats", "Battery power", "Car ferries"],
          correctIndex: 1,
          explanation: "A 26-tonne battery pack cut CO2 emissions from the boat traffic by 34 per cent.",
        },
      ],
      da: [
        {
          question: "Omtrent hvor lang tid tager båden fra Nesoddtangen til Aker brygge?",
          options: ["8 minutter", "23 minutter", "En time"],
          correctIndex: 1,
          explanation: "Omkring 23 minutter til Aker brygge; til Lysaker i Bærum tager det kun otte.",
        },
        {
          question: "Hvornår begyndte bådtrafikken til Nesodden?",
          options: ["1874", "1942", "1986"],
          correctIndex: 0,
          explanation: "A/S Bundefjord Dampskibsselskab blev stiftet i 1874, og den første båd var en hjuldamper.",
        },
        {
          question: "Hvad blev bådene «Kongen», «Dronningen» og «Prinsen» bygget om til i 2019 og 2020?",
          options: ["Sejlbåde", "Batteridrift", "Bilfærger"],
          correctIndex: 1,
          explanation: "En batteripakke på 26 tons skar udledningen af CO2 fra bådtrafikken ned med 34 procent.",
        },
      ],
    },
  },
  {
    id: "poi_galleri_vanntarnet",
    slug: "galleri-vanntarnet",
    categoryId: "museum",
    lat: 59.8624,
    lng: 10.6631,
    triggerRadiusM: 60,
    priority: 6,
    sortOrder: 2,
    freePreview: false,
    sourceNote:
      "Utkast 24.09.2026, ikke fagvurdert. Kilder (søkeresultater): https://nesoddenkunstforening.no/galleri-vanntarnet-nesodden-kunstforening/, https://listen.no/venue/galleri-vanntarnet, https://opplevnesodden.no/featured_item/galleri-vanntarnet/, https://www.nesodden.kommune.no/aktuelt/nesodden-kunstforening-karet-til-arets-kunstforening-2024.242776.aspx, https://no.wikipedia.org/wiki/Tangen_brygge, https://www.nesoddenkunstnere.no/, https://www.ark.no/boker/Kathrine-Geard-Kunstnerkommunen-9788293512066, https://fordforlag.no/product/kunstnerkommunen-skisser-fra-nesodden/, https://en.wikipedia.org/wiki/Per_Kleiva, https://www.snohetta.com/projects/norwegian-national-opera-and-ballet (Løvaas og Wagle, scenetårnet). Må verifiseres: koordinat (tettstedskoordinat for Nesoddtangen fra latitude.to, 59.8624, 10.6631; tårnet står ved Tårnstien, med bussholdeplassen Tangenåsen rett nedenfor), byggeåret for vanntårnet (kilden sier bare «i etterkrigstiden»), at Astrid Løvaas i Geards bok er samme person som var med på Operaens scenetårn, antall etasjer med kunst (kildene sier tre bygde etasjer og fire etasjer med kunst), åpningstider, og alt i synstolkingen (skrevet uten befaring).",
    translations: {
      nb: {
        title: "Galleri Vanntårnet",
        subtitle: "Kunstnerkommunen",
        summary:
          "Vanntårnet på Tangenåsen ble bygd da Tangenbyen vokste fram etter krigen. I dag er det galleriet til Nesodden kunstforening, i kommunen med flest kunstnere per innbygger i Norge.",
        locationLabel: "Nesodden, Norge",
        heroImageAlt: "Foto av Galleri Vanntårnet",
        practicalInfo: [
          { label: "Adresse", value: "Tårnstien, Nesoddtangen (bussholdeplass Tangenåsen)" },
          { label: "Åpningstider", value: "Bare ved utstillinger, sjekk nesoddenkunstforening.no" },
          { label: "Trinnfri tilgang", value: "Nei, trapper mellom etasjene (ikke bekreftet om det finnes heis)" },
        ],
      },
      en: {
        title: "The Water Tower Gallery",
        subtitle: "The artists' municipality",
        summary:
          "The water tower on Tangenåsen was built when the new housing grew up after the war. Today it is the gallery of the Nesodden art society, in the municipality with the most artists per inhabitant in Norway.",
        locationLabel: "Nesodden, Norway",
        heroImageAlt: "Photo of the Water Tower Gallery",
        practicalInfo: [
          { label: "Address", value: "Tårnstien, Nesoddtangen (bus stop Tangenåsen)" },
          { label: "Opening hours", value: "Only during exhibitions; see nesoddenkunstforening.no" },
          { label: "Step-free access", value: "No, stairs between the floors (not confirmed whether there is a lift)" },
        ],
      },
      da: {
        title: "Galleri Vanntårnet",
        subtitle: "Kunstnerkommunen",
        summary:
          "Vandtårnet på Tangenåsen blev bygget, da Tangenbyen voksede frem efter krigen. I dag er det galleri for Nesodden kunstforening, i den kommune i Norge, der har flest kunstnere per indbygger.",
        locationLabel: "Nesodden, Norge",
        heroImageAlt: "Foto af Galleri Vanntårnet",
        practicalInfo: [
          { label: "Adresse", value: "Tårnstien, Nesoddtangen (stoppested Tangenåsen)" },
          { label: "Åbningstider", value: "Kun ved udstillinger, tjek nesoddenkunstforening.no" },
          { label: "Niveaufri adgang", value: "Nej, trapper mellem etagerne (ikke bekræftet, om der er elevator)" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Tårnet og kunstnerkommunen",
          text:
            "Du står ved det gamle vanntårnet på Tangenåsen, og tårnet forteller to historier om Nesodden. Den første handler om hvordan Nesoddtangen ble et tettsted. Den gamle gården Tangen lå ute på odden ved brygga, nesten to kilometer herfra. Etter krigen ble det bygd hus i liene fra Oksval og opp mot Tangenåsen, og fra 1949 vokste det fram så mange at stedet en tid ble kalt Tangenbyen. Vanntårnet ble bygd for å gi vann til de nye byggetomtene.\n\nDen andre historien handler om kunst. Ifølge Norsk kulturindeks er Nesodden den kommunen i Norge som har flest profesjonelle kunstnere per innbygger. Kunstnere har funnet veien til halvøya gjennom hele forrige århundre. Boka «Kunstnerkommunen» av Kathrine Geard presenterer 68 billedkunstnere fra årene 1945 til 2000, blant dem Per Kleiva, kjent for politisk grafikk i silketrykk, Arne Åse, Kristian Kvakland og tekstilkunstneren Astrid Løvaas.\n\nNesodden kunstforening ble stiftet i 1972. I årene før 1997 bygde medlemmene om vanntårnet på dugnad. De la tregulv, bygde trapper og innredet etasjene med lys og opphengsmuligheter, og benkene måtte spesiallages for å passe de runde veggene. Galleriet åpnet i 1997. I dag har tårnet fire runde etasjer med kunst og en liten vaffelkafé, og her holdes utstillinger, konserter, kurs og filmkvelder. Kommunen eier bygget, og kunstforeningen driver det. I 2024 ble Nesodden kunstforening kåret til årets kunstforening.",
          estimatedDurationS: 91,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står på toppen av Tangenåsen, ved foten av et rundt tårn. Tårnet er høyere enn husene rundt, og veggene buer seg rundt hele bygningen, uten hjørner. Inngangen ligger nede ved bakken, og stien Tårnstien fører bort til døra. Rett nedenfor åsen ligger bussholdeplassen, og rundt deg er det villahus og hager i skrånende terreng. Inne i tårnet ligger fire runde etasjer med kunst over hverandre, forbundet med trapper, og en liten vaffelkafé. Når galleriet er åpent, står det gjerne plakater for utstillingen ved inngangen.",
          estimatedDurationS: 35,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "The tower and the artists' municipality",
          text:
            "You are standing by the old water tower on Tangenåsen, and the tower tells two stories about Nesodden. The first is about how Nesoddtangen became a town. The old farm of Tangen lay out on the point by the quay, almost two kilometres from here. After the war houses were built on the slopes from Oksval up towards Tangenåsen, and from 1949 so many appeared that for a while the place was called Tangenbyen, Tangen Town. The water tower was built to supply water to the new building plots.\n\nThe second story is about art. According to the Norwegian Culture Index, Nesodden is the municipality in Norway with the most professional artists per inhabitant. Artists found their way to the peninsula throughout the last century. The book 'Kunstnerkommunen', the artists' municipality, by Kathrine Geard presents 68 visual artists from the years 1945 to 2000, among them Per Kleiva, known for political screen prints, Arne Åse, Kristian Kvakland and the textile artist Astrid Løvaas.\n\nThe Nesodden art society was founded in 1972. In the years before 1997 its members converted the water tower with volunteer work. They laid wooden floors, built stairs and fitted the floors with lighting and hanging systems, and the benches had to be specially made to fit the round walls. The gallery opened in 1997. Today the tower has four round floors of art and a small waffle café, and it hosts exhibitions, concerts, courses and film nights. The municipality owns the building, and the art society runs it. In 2024 the Nesodden art society was named art society of the year.",
          estimatedDurationS: 106,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing at the top of Tangenåsen, at the foot of a round tower. The tower is taller than the houses around it, and its walls curve all the way round the building, with no corners. The entrance is at ground level, and the path Tårnstien leads to the door. Just below the hill is the bus stop, and around you are detached houses and gardens on sloping ground. Inside the tower four round floors of art sit one above the other, joined by stairs, with a small waffle café. When the gallery is open, there are usually posters for the exhibition by the entrance.",
          estimatedDurationS: 42,
        },
      ],
      da: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Tårnet og kunstnerkommunen",
          text:
            "Du står ved det gamle vandtårn på Tangenåsen, og tårnet fortæller to historier om Nesodden. Den første handler om, hvordan Nesoddtangen blev en by. Den gamle gård Tangen lå ude på odden ved bryggen, næsten to kilometer herfra. Efter krigen blev der bygget huse på skråningerne fra Oksval op mod Tangenåsen, og fra 1949 skød der så mange op, at stedet en tid blev kaldt Tangenbyen. Vandtårnet blev bygget for at give vand til de nye byggegrunde.\n\nDen anden historie handler om kunst. Ifølge Norsk kulturindeks er Nesodden den kommune i Norge, der har flest professionelle kunstnere per indbygger. Kunstnere har fundet vej til halvøen gennem hele det forrige århundrede. Bogen «Kunstnerkommunen» af Kathrine Geard præsenterer 68 billedkunstnere fra årene 1945 til 2000, blandt dem Per Kleiva, kendt for politisk grafik i serigrafi, Arne Åse, Kristian Kvakland og tekstilkunstneren Astrid Løvaas.\n\nNesodden kunstforening blev stiftet i 1972. I årene før 1997 byggede medlemmerne vandtårnet om som frivilligt arbejde. De lagde trægulve, byggede trapper og indrettede etagerne med lys og ophængningsmuligheder, og bænkene måtte specialfremstilles for at passe til de runde vægge. Galleriet åbnede i 1997. I dag har tårnet fire runde etager med kunst og en lille vaffelcafé, og her holdes udstillinger, koncerter, kurser og filmaftener. Kommunen ejer bygningen, og kunstforeningen driver den. I 2024 blev Nesodden kunstforening kåret til årets kunstforening.",
          estimatedDurationS: 92,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Sådan ser det ud",
          text:
            "Du står på toppen af Tangenåsen, ved foden af et rundt tårn. Tårnet er højere end husene omkring det, og væggene buer sig rundt om hele bygningen, uden hjørner. Indgangen ligger nede ved jorden, og stien Tårnstien fører hen til døren. Lige neden for åsen ligger busstoppestedet, og omkring dig er der villaer og haver i skrånende terræn. Inde i tårnet ligger fire runde etager med kunst over hinanden, forbundet af trapper, og en lille vaffelcafé. Når galleriet er åbent, står der som regel plakater for udstillingen ved indgangen.",
          estimatedDurationS: 37,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Hvorfor ble vanntårnet bygd?",
          options: ["Som utsiktstårn", "For å gi vann til de nye byggetomtene", "For å slokke skogbranner"],
          correctIndex: 1,
          explanation: "Fra 1949 vokste Tangenbyen fram i liene fra Oksval opp mot Tangenåsen.",
        },
        {
          question: "Hva har Nesodden flest av per innbygger, ifølge Norsk kulturindeks?",
          options: ["Profesjonelle kunstnere", "Båter", "Fotballbaner"],
          correctIndex: 0,
          explanation: "Ingen norsk kommune har flere profesjonelle kunstnere per innbygger.",
        },
        {
          question: "Når åpnet Galleri Vanntårnet?",
          options: ["1972", "1997", "2024"],
          correctIndex: 1,
          explanation: "Kunstforeningen ble stiftet i 1972, bygde om tårnet på dugnad og åpnet galleriet i 1997.",
        },
      ],
      en: [
        {
          question: "Why was the water tower built?",
          options: ["As a lookout tower", "To supply water to the new building plots", "To fight forest fires"],
          correctIndex: 1,
          explanation: "From 1949 Tangenbyen grew up on the slopes from Oksval towards Tangenåsen.",
        },
        {
          question: "According to the Norwegian Culture Index, what does Nesodden have the most of per inhabitant?",
          options: ["Professional artists", "Boats", "Football pitches"],
          correctIndex: 0,
          explanation: "No Norwegian municipality has more professional artists per inhabitant.",
        },
        {
          question: "When did the Water Tower Gallery open?",
          options: ["1972", "1997", "2024"],
          correctIndex: 1,
          explanation: "The art society was founded in 1972, converted the tower with volunteer work and opened the gallery in 1997.",
        },
      ],
      da: [
        {
          question: "Hvorfor blev vandtårnet bygget?",
          options: ["Som udsigtstårn", "For at give vand til de nye byggegrunde", "For at slukke skovbrande"],
          correctIndex: 1,
          explanation: "Fra 1949 voksede Tangenbyen frem på skråningerne fra Oksval op mod Tangenåsen.",
        },
        {
          question: "Hvad har Nesodden flest af per indbygger ifølge Norsk kulturindeks?",
          options: ["Professionelle kunstnere", "Både", "Fodboldbaner"],
          correctIndex: 0,
          explanation: "Ingen norsk kommune har flere professionelle kunstnere per indbygger.",
        },
        {
          question: "Hvornår åbnede Galleri Vanntårnet?",
          options: ["1972", "1997", "2024"],
          correctIndex: 1,
          explanation: "Kunstforeningen blev stiftet i 1972, byggede tårnet om som frivilligt arbejde og åbnede galleriet i 1997.",
        },
      ],
    },
  },
  {
    id: "poi_skoklefall_kirke",
    slug: "skoklefall-kirke",
    categoryId: "arkitektur",
    lat: 59.8468,
    lng: 10.6714,
    triggerRadiusM: 50,
    priority: 5,
    sortOrder: 3,
    freePreview: false,
    sourceNote:
      "Utkast 24.09.2026, ikke fagvurdert. Kilder (søkeresultater): https://no.wikipedia.org/wiki/Skoklefall_kirke, https://norgeskirker.no/wiki/Skoklefall_kapell, https://www.norske-kirker.net/home/akershus/skoklefall-kirke/, https://religiana.com/skoklefall-kirke, https://www.wikidata.org/wiki/Q8730558, https://www.kirken.no/nb-NO/fellesrad/Nesodden-Kirkelige-Fellesrad/om-oss/kirkene-vare/, https://www.kirken.no/nb-NO/fellesrad/Nesodden-Kirkelige-Fellesrad/nyheter2/ny%20kirke%20p%C3%A5%20nordre%20nesodden/. Valgt som «Nesoddtangen kirke»: det er kirken nærmest Nesoddtangen (ca. 3 km sør for brygga); Nesodden kirke og Gjøfjell kirke ligger lenger sør. Må verifiseres: koordinat (Wikidata 59°50'48.5\"N 10°40'17.0\"E, adresse Kapellveien 3), at veggene er tømmer uten kledning, navnene på byggmestrene, kulturkirke-planene (kan være endret), og alt i synstolkingen (skrevet uten befaring).",
    translations: {
      nb: {
        title: "Skoklefall kirke",
        subtitle: "Kirken fra Hallingdal",
        summary:
          "Trekirken for nordre Nesodden sto ferdig i 1936, tegnet av Carl Michalsen og bygd av tømrere fra Hallingdal med tømmer derfra. Inne har Terje Grøstad laget altertavle, prekestol og døpefont.",
        locationLabel: "Nesodden, Norge",
        heroImageAlt: "Foto av Skoklefall kirke",
        practicalInfo: [
          { label: "Adresse", value: "Kapellveien 3, Nesoddtangen" },
          { label: "Adkomst", value: "Kirken er bare åpen ved gudstjenester og arrangementer" },
          { label: "Trinnfri tilgang", value: "Ikke bekreftet" },
        ],
      },
      en: {
        title: "Skoklefall Church",
        subtitle: "The church from Hallingdal",
        summary:
          "The wooden church for northern Nesodden was completed in 1936, designed by Carl Michalsen and built by carpenters from Hallingdal with timber from there. Inside, Terje Grøstad made the altarpiece, pulpit and font.",
        locationLabel: "Nesodden, Norway",
        heroImageAlt: "Photo of Skoklefall Church",
        practicalInfo: [
          { label: "Address", value: "Kapellveien 3, Nesoddtangen" },
          { label: "Getting in", value: "The church only opens for services and events" },
          { label: "Step-free access", value: "Not confirmed" },
        ],
      },
      da: {
        title: "Skoklefall kirke",
        subtitle: "Kirken fra Hallingdal",
        summary:
          "Trækirken for det nordlige Nesodden stod færdig i 1936, tegnet af Carl Michalsen og bygget af tømrere fra Hallingdal med tømmer derfra. Indenfor har Terje Grøstad lavet altertavle, prædikestol og døbefont.",
        locationLabel: "Nesodden, Norge",
        heroImageAlt: "Foto af Skoklefall kirke",
        practicalInfo: [
          { label: "Adresse", value: "Kapellveien 3, Nesoddtangen" },
          { label: "Adgang", value: "Kirken er kun åben ved gudstjenester og arrangementer" },
          { label: "Niveaufri adgang", value: "Ikke bekræftet" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Kirken fra Hallingdal",
          text:
            "Dette er Skoklefall kirke, kirken for nordre Nesodden, om lag tre kilometer sør for brygga på Nesoddtangen. Tomten ble gitt av Olav Skoklefald, og bonden Johan Jacobsen ga penger til byggingen. Grunnsteinen ble lagt 16. januar 1935 av Johan P. Lunde, som da var biskop i Oslo, og kirken sto ferdig året etter, i 1936. Den har også vært kalt Skoklefall kapell.\n\nArkitekt var Carl Michalsen. Han tegnet en enkel langkirke i tre med plass til rundt 130 mennesker. Byggmestrene og tømrerne kom fra Hallingdal, Arnfinn og Knut Hodnungseth og Knut Blakkestad, og tømmeret de brukte, kom også derfra. Rundt kirken er det ingen kirkegård.\n\nInne er det kunstneren Terje Grøstad som har satt sitt preg på rommet. På 1960-tallet laget og dekorerte han både altertavlen, prekestolen og døpefonten. I dag er Skoklefall en av tre kirker i Nesodden kommune, og menigheten her har planer om en ny kulturkirke på nordre Nesodden.",
          estimatedDurationS: 63,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Foran deg står en liten, enkel kirke av tre. Den er lang og smal, med saltak og lave, rette takskjegg over gavlene. Veggene er av tømmer uten kledning, så du ser stokkene lagt oppå hverandre. Inngangen ligger i den ene gavlen, og langs sidene sitter vinduene i rekke. Det er ingen gravsteiner rundt kirken; i stedet ligger den med plen og trær omkring, nær et veikryss. Kirken er lav, og taket er det som ruver mest. Inne står altertavlen, prekestolen og døpefonten som Terje Grøstad laget og dekorerte på 1960-tallet.",
          estimatedDurationS: 37,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "The church from Hallingdal",
          text:
            "This is Skoklefall Church, the church for northern Nesodden, about three kilometres south of the quay at Nesoddtangen. The site was given by Olav Skoklefald, and the farmer Johan Jacobsen paid for the building. The foundation stone was laid on 16 January 1935 by Johan P. Lunde, then Bishop of Oslo, and the church was completed the following year, in 1936. It has also been called Skoklefall Chapel.\n\nThe architect was Carl Michalsen. He designed a simple long church in wood with room for about 130 people. The master builders and carpenters came from Hallingdal, Arnfinn and Knut Hodnungseth and Knut Blakkestad, and the timber they used came from there too. There is no churchyard around the church.\n\nInside, it is the artist Terje Grøstad who has put his mark on the room. In the 1960s he made and decorated the altarpiece, the pulpit and the font. Today Skoklefall is one of three churches in Nesodden municipality, and the parish here has plans for a new cultural church in northern Nesodden.",
          estimatedDurationS: 68,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "In front of you stands a small, simple wooden church. It is long and narrow, with a pitched roof and low, straight eaves over the gables. The walls are of logs without cladding, so you see the timbers laid one on top of another. The entrance is in one gable end, and along the sides the windows sit in a row. There are no gravestones around the church; instead it stands among lawn and trees, near a road junction. The church is low, and the roof is what dominates. Inside stand the altarpiece, the pulpit and the font that Terje Grøstad made and decorated in the 1960s.",
          estimatedDurationS: 43,
        },
      ],
      da: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Kirken fra Hallingdal",
          text:
            "Dette er Skoklefall kirke, kirken for det nordlige Nesodden, omkring tre kilometer syd for bryggen på Nesoddtangen. Grunden blev skænket af Olav Skoklefald, og bonden Johan Jacobsen gav penge til byggeriet. Grundstenen blev lagt den 16. januar 1935 af Johan P. Lunde, som dengang var biskop i Oslo, og kirken stod færdig året efter, i 1936. Den er også blevet kaldt Skoklefall kapel.\n\nArkitekten var Carl Michalsen. Han tegnede en enkel langkirke i træ med plads til omkring 130 mennesker. Bygmestrene og tømrerne kom fra Hallingdal, Arnfinn og Knut Hodnungseth og Knut Blakkestad, og det tømmer, de brugte, kom også derfra. Rundt om kirken er der ingen kirkegård.\n\nIndenfor er det kunstneren Terje Grøstad, der har sat sit præg på rummet. I 1960'erne lavede og dekorerede han både altertavlen, prædikestolen og døbefonten. I dag er Skoklefall en af tre kirker i Nesodden kommune, og menigheden her har planer om en ny kulturkirke på det nordlige Nesodden.",
          estimatedDurationS: 65,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Sådan ser det ud",
          text:
            "Foran dig står en lille, enkel kirke af træ. Den er lang og smal, med sadeltag og lave, lige tagudhæng over gavlene. Væggene er af tømmer uden beklædning, så du ser stokkene lagt oven på hinanden. Indgangen ligger i den ene gavl, og langs siderne sidder vinduerne på række. Der er ingen gravsten omkring kirken; i stedet ligger den med græsplæne og træer omkring sig, nær et vejkryds. Kirken er lav, og det er taget, der fylder mest. Indenfor står altertavlen, prædikestolen og døbefonten, som Terje Grøstad lavede og dekorerede i 1960'erne.",
          estimatedDurationS: 38,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Hvor kom tømrerne og tømmeret til kirken fra?",
          options: ["Hallingdal", "Gudbrandsdalen", "Sverige"],
          correctIndex: 0,
          explanation: "Byggmestrene Arnfinn og Knut Hodnungseth og Knut Blakkestad kom fra Hallingdal, og det gjorde tømmeret også.",
        },
        {
          question: "Hva finnes ikke rundt Skoklefall kirke?",
          options: ["Vinduer", "En kirkegård", "Et tak"],
          correctIndex: 1,
          explanation: "Kirken fra 1936 har ingen kirkegård rundt seg.",
        },
        {
          question: "Hvem laget altertavlen, prekestolen og døpefonten?",
          options: ["Carl Michalsen", "Terje Grøstad", "Johan P. Lunde"],
          correctIndex: 1,
          explanation: "Terje Grøstad laget og dekorerte alle tre på 1960-tallet.",
        },
      ],
      en: [
        {
          question: "Where did the carpenters and the timber for the church come from?",
          options: ["Hallingdal", "Gudbrandsdalen", "Sweden"],
          correctIndex: 0,
          explanation: "The builders Arnfinn and Knut Hodnungseth and Knut Blakkestad came from Hallingdal, and so did the timber.",
        },
        {
          question: "What is there not around Skoklefall Church?",
          options: ["Windows", "A churchyard", "A roof"],
          correctIndex: 1,
          explanation: "The church from 1936 has no churchyard around it.",
        },
        {
          question: "Who made the altarpiece, the pulpit and the font?",
          options: ["Carl Michalsen", "Terje Grøstad", "Johan P. Lunde"],
          correctIndex: 1,
          explanation: "Terje Grøstad made and decorated all three in the 1960s.",
        },
      ],
      da: [
        {
          question: "Hvor kom tømrerne og tømmeret til kirken fra?",
          options: ["Hallingdal", "Gudbrandsdalen", "Sverige"],
          correctIndex: 0,
          explanation: "Bygmestrene Arnfinn og Knut Hodnungseth og Knut Blakkestad kom fra Hallingdal, og det gjorde tømmeret også.",
        },
        {
          question: "Hvad findes der ikke rundt om Skoklefall kirke?",
          options: ["Vinduer", "En kirkegård", "Et tag"],
          correctIndex: 1,
          explanation: "Kirken fra 1936 har ingen kirkegård omkring sig.",
        },
        {
          question: "Hvem lavede altertavlen, prædikestolen og døbefonten?",
          options: ["Carl Michalsen", "Terje Grøstad", "Johan P. Lunde"],
          correctIndex: 1,
          explanation: "Terje Grøstad lavede og dekorerede alle tre i 1960'erne.",
        },
      ],
    },
  },
  {
    id: "poi_hellviktangen",
    slug: "hellviktangen",
    categoryId: "historisk",
    lat: 59.8412,
    lng: 10.6884,
    triggerRadiusM: 200,
    priority: 7,
    sortOrder: 4,
    freePreview: false,
    sourceNote:
      "Utkast 24.09.2026, ikke fagvurdert. Kilder (søkeresultater): https://www.hellviktangen.no/historien, https://www.hellviktangen.com/, http://www.hellviktangen.com/HistorieHellviktangen/historie.html, https://www.skiforeningen.no/utimarka/omrader/nesoddmarka/steder/hellviktangen/, https://www.skiforeningen.no/utimarka/omrader/nesoddmarka/sykkelruter/nesoddtangen-hellviktangen-kyststien/, http://www.oslofjorden.com/badesteder/akershus/hellviktangen_badeplass_nesodden.html, https://opplevnesodden.no/featured_item/galleri-hellviktangen/, https://en.wikipedia.org/wiki/Hellvik_(Nesodden), https://www.wikidata.org/wiki/Q11974918. Må verifiseres: koordinat (Wikidata-koordinat for Hellvik, 59°50'28\"N 10°41'18\"E; Hellviktangen ligger på nordspissen av Hellvikodden litt nord for Hellvikstrand, flytt til hovedhuset), året jugendvillaen ble bygd (kildene sier «rundt 1900» og «1905»), navneforklaringen (oppgitt som mulig), at siste båtanløp var i 1988, lengden på kyststien fra Nesoddtangen, og alt i synstolkingen (skrevet uten befaring).",
    translations: {
      nb: {
        title: "Hellviktangen",
        subtitle: "Lystgården ved Bunnefjorden",
        summary:
          "Petter Brandt holdt selskaper for Christianias fine folk her på 1700-tallet, og konsul Hennum bygde jugendvillaen rundt 1900. Staten kjøpte stedet i 1978, og i dag er det kunstkafé, galleri og badeplass for alle.",
        locationLabel: "Nesodden, Norge",
        heroImageAlt: "Foto av Hellviktangen",
        practicalInfo: [
          { label: "Adresse", value: "Hellvikalleen 60, Nesodden" },
          { label: "Adkomst", value: "Åpent friluftsområde; buss fra Nesoddtangen, ca. 800 m å gå fra holdeplassen, eller kyststien fra brygga" },
          { label: "Kunstkafé og galleri", value: "Sjekk åpningstider på hellviktangen.no" },
          { label: "Trinnfri tilgang", value: "Ikke bekreftet; parken er delvis i skrånende terreng" },
        ],
      },
      en: {
        title: "Hellviktangen",
        subtitle: "The country house on the Bunnefjord",
        summary:
          "Petter Brandt threw parties for Christiania's high society here in the 1700s, and Consul Hennum built the Art Nouveau villa around 1900. The state bought the place in 1978, and today it is an art café, gallery and beach open to all.",
        locationLabel: "Nesodden, Norway",
        heroImageAlt: "Photo of Hellviktangen",
        practicalInfo: [
          { label: "Address", value: "Hellvikalleen 60, Nesodden" },
          { label: "Getting there", value: "Open recreation area; bus from Nesoddtangen and about 800 m on foot from the stop, or the coastal path from the quay" },
          { label: "Art café and gallery", value: "Check opening hours at hellviktangen.no" },
          { label: "Step-free access", value: "Not confirmed; parts of the park slope" },
        ],
      },
      da: {
        title: "Hellviktangen",
        subtitle: "Lystgården ved Bunnefjorden",
        summary:
          "Petter Brandt holdt selskaber for Christianias fine folk her i 1700-tallet, og konsul Hennum byggede jugendvillaen omkring 1900. Staten købte stedet i 1978, og i dag er det kunstcafé, galleri og badested for alle.",
        locationLabel: "Nesodden, Norge",
        heroImageAlt: "Foto af Hellviktangen",
        practicalInfo: [
          { label: "Adresse", value: "Hellvikalleen 60, Nesodden" },
          { label: "Adgang", value: "Åbent friluftsområde; bus fra Nesoddtangen og ca. 800 m til fods fra stoppestedet, eller kyststien fra bryggen" },
          { label: "Kunstcafé og galleri", value: "Tjek åbningstider på hellviktangen.no" },
          { label: "Niveaufri adgang", value: "Ikke bekræftet; parken ligger delvis på skrånende terræn" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Lystgården ved Bunnefjorden",
          text:
            "Du har kommet til Hellviktangen, på nordspissen av Hellvikodden på østsiden av Nesodden, med utsikt over Bunnefjorden, Oslofjorden og hovedstaden. Navnet Hellvik kommer trolig av en flat steinhelle ved sjøen, som kan ha vært brukt til å laste og losse skip i gammel tid.\n\nMot slutten av 1700-tallet bygde Petter Brandt en lystgård her. Han var borger i Christiania, eide hele gården Skoklefald og holdt store selskaper for byens fine folk. Senere ble Hellviktangen et eget gårdsbruk. Rundt år 1900 overtok konsul A. Hennum, og han anla en eiendom med park, trapper og terrasser. Det var Hennum som bygde huset i jugendstil som står her i dag, med egen brygge nedenfor. Brygga var også anløpssted for båtene, og det siste anløpet var i 1988, da ruten på Bunnefjorden ble lagt ned.\n\nI 1978 kjøpte staten Hellviktangen som friluftsområde, og Nesodden kommune skulle forvalte det. Det kom protester, og mange lokale ildsjeler kjempet for å bevare huset. Til slutt overlot staten huset til kommunen, og kommunen ga ansvaret videre til Stiftelsen Hellviktangen. I dag er området åpent for alle, med park, strand og badeplass, og i hovedhuset drives en kunstkafé og et galleri som særlig viser fram Nesoddens profesjonelle kunstnere. Hit kan du gå langs kyststien fra Nesoddtangen.",
          estimatedDurationS: 86,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står i en park helt nede ved fjorden, på nordspissen av Hellvikodden, med vann på flere sider, store plener og gamle, høye trær. Oppe i parken, like ved sjøen, ligger et stort hus i jugendstil. Trapper og terrasser fører ned fra huset mot vannet. Nede ved sjøen er det en liten sandstrand, glatte svaberg og en brygge som stikker ut i fjorden. Foran deg ligger Bunnefjorden, rolig og bred, og i det fjerne, mot nord, ser du Oslo. Om sommeren bader mange her, og kyststien fra Nesoddtangen går forbi langs vannet.",
          estimatedDurationS: 38,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "The country house on the Bunnefjord",
          text:
            "You have come to Hellviktangen, on the northern tip of the Hellvik point on the east side of Nesodden, with views over the Bunnefjord, the Oslofjord and the capital. The name Hellvik probably comes from a flat rock slab by the shore that may have been used for loading and unloading ships in the old days.\n\nTowards the end of the 1700s Petter Brandt built a country house here. He was a burgher of Christiania, owned the whole Skoklefald farm and threw large parties for the city's high society. Later Hellviktangen became a farm of its own. Around 1900 Consul A. Hennum took over, and he laid out an estate with a park, stairs and terraces. It was Hennum who built the house in Art Nouveau style that stands here today, with its own jetty below. The jetty was also a stop for the boats, and the last call was in 1988, when the route on the Bunnefjord was closed.\n\nIn 1978 the state bought Hellviktangen as a recreation area, and Nesodden municipality was to manage it. There were protests, and many local enthusiasts fought to save the house. In the end the state handed the house over to the municipality, which passed the responsibility on to the Hellviktangen Foundation. Today the area is open to everyone, with a park, a beach and a bathing spot, and the main house holds an art café and a gallery that mainly shows Nesodden's professional artists. You can walk here along the coastal path from Nesoddtangen.",
          estimatedDurationS: 101,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing in a park right down by the fjord, on the northern tip of the Hellvik point, with water on several sides, large lawns and tall old trees. Up in the park, close to the shore, stands a large Art Nouveau house. Stairs and terraces lead down from the house towards the water. Down by the shore there is a small sandy beach, smooth rocks and a jetty reaching out into the fjord. Ahead of you lies the Bunnefjord, calm and wide, and far off to the north you can see Oslo. In summer many people swim here, and the coastal path from Nesoddtangen passes along the water.",
          estimatedDurationS: 44,
        },
      ],
      da: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Lystgården ved Bunnefjorden",
          text:
            "Du er kommet til Hellviktangen, på nordspidsen af Hellvikodden på østsiden af Nesodden, med udsigt over Bunnefjorden, Oslofjorden og hovedstaden. Navnet Hellvik kommer formentlig af en flad stenhelle ved vandet, som kan være blevet brugt til at laste og losse skibe i gamle dage.\n\nMod slutningen af 1700-tallet byggede Petter Brandt en lystgård her. Han var borger i Christiania, ejede hele gården Skoklefald og holdt store selskaber for byens fine folk. Senere blev Hellviktangen et selvstændigt landbrug. Omkring år 1900 overtog konsul A. Hennum stedet, og han anlagde en ejendom med park, trapper og terrasser. Det var Hennum, der byggede huset i jugendstil, som står her i dag, med egen anløbsbro nedenfor. Broen var også anløbssted for bådene, og det sidste anløb var i 1988, da ruten på Bunnefjorden blev nedlagt.\n\nI 1978 købte staten Hellviktangen som friluftsområde, og Nesodden kommune skulle forvalte det. Der kom protester, og mange lokale ildsjæle kæmpede for at bevare huset. Til sidst overlod staten huset til kommunen, og kommunen gav ansvaret videre til Stiftelsen Hellviktangen. I dag er området åbent for alle, med park, strand og badested, og i hovedhuset drives en kunstcafé og et galleri, som især viser Nesoddens professionelle kunstnere frem. Hertil kan du gå ad kyststien fra Nesoddtangen.",
          estimatedDurationS: 86,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Sådan ser det ud",
          text:
            "Du står i en park helt nede ved fjorden, på nordspidsen af Hellvikodden, med vand på flere sider, store græsplæner og gamle, høje træer. Oppe i parken, tæt ved vandet, ligger et stort hus i jugendstil. Trapper og terrasser fører ned fra huset mod vandet. Nede ved vandkanten er der en lille sandstrand, glatte klipper og en anløbsbro, der stikker ud i fjorden. Foran dig ligger Bunnefjorden, rolig og bred, og i det fjerne, mod nord, ser du Oslo. Om sommeren bader mange her, og kyststien fra Nesoddtangen går forbi langs vandet.",
          estimatedDurationS: 38,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Hvem bygde en lystgård på Hellviktangen mot slutten av 1700-tallet?",
          options: ["Petter Brandt", "Konsul A. Hennum", "Christian den fjerde"],
          correctIndex: 0,
          explanation: "Brandt var borger i Christiania, eide hele Skoklefald og holdt store selskaper.",
        },
        {
          question: "Når var det siste båtanløpet ved brygga på Hellviktangen?",
          options: ["1874", "1988", "2019"],
          correctIndex: 1,
          explanation: "Det siste anløpet var i 1988, da ruten på Bunnefjorden ble lagt ned.",
        },
        {
          question: "Hva skjedde med Hellviktangen i 1978?",
          options: ["Huset brant ned", "Staten kjøpte Hellviktangen som friluftsområde", "Det ble bygd hotell"],
          correctIndex: 1,
          explanation: "Etter protester ble huset overlatt til kommunen og Stiftelsen Hellviktangen.",
        },
      ],
      en: [
        {
          question: "Who built a country house at Hellviktangen towards the end of the 1700s?",
          options: ["Petter Brandt", "Consul A. Hennum", "Christian the Fourth"],
          correctIndex: 0,
          explanation: "Brandt was a burgher of Christiania, owned all of Skoklefald and threw large parties.",
        },
        {
          question: "When did a boat last call at the jetty at Hellviktangen?",
          options: ["1874", "1988", "2019"],
          correctIndex: 1,
          explanation: "The last call was in 1988, when the route on the Bunnefjord was closed.",
        },
        {
          question: "What happened to Hellviktangen in 1978?",
          options: ["The house burned down", "The state bought Hellviktangen as a recreation area", "A hotel was built"],
          correctIndex: 1,
          explanation: "After protests the house was handed over to the municipality and the Hellviktangen Foundation.",
        },
      ],
      da: [
        {
          question: "Hvem byggede en lystgård på Hellviktangen mod slutningen af 1700-tallet?",
          options: ["Petter Brandt", "Konsul A. Hennum", "Christian den Fjerde"],
          correctIndex: 0,
          explanation: "Brandt var borger i Christiania, ejede hele Skoklefald og holdt store selskaber.",
        },
        {
          question: "Hvornår lagde en båd sidst til ved broen på Hellviktangen?",
          options: ["1874", "1988", "2019"],
          correctIndex: 1,
          explanation: "Det sidste anløb var i 1988, da ruten på Bunnefjorden blev nedlagt.",
        },
        {
          question: "Hvad skete der med Hellviktangen i 1978?",
          options: ["Huset brændte ned", "Staten købte Hellviktangen som friluftsområde", "Der blev bygget et hotel"],
          correctIndex: 1,
          explanation: "Efter protester blev huset overladt til kommunen og Stiftelsen Hellviktangen.",
        },
      ],
    },
  },
];

export const NESODDTANGEN_CHAPTER_PROMPTS: Record<string, Record<DemoLang, DemoChapterPrompt[]>> = {
  poi_nesoddtangen_brygge: {
    nb: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.14,
        text: "Se opp: Over vannet ligger Oslo, bare fem kilometer unna med båt.",
        revealText: null,
      },
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.41,
        text: "Hva slags båt tror du den aller første båten på ruten var?",
        options: ["En seilskute", "En hjuldamper", "En robåt"],
        answerIndex: 1,
        revealText: "En hjuldamper, «Bundefjord», kjøpt fra Storbritannia.",
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.16,
        text: "Look up: Across the water lies Oslo, only five kilometres away by boat.",
        revealText: null,
      },
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.42,
        text: "What kind of boat do you think the very first boat on the route was?",
        options: ["A sailing ship", "A paddle steamer", "A rowing boat"],
        answerIndex: 1,
        revealText: "A paddle steamer, the 'Bundefjord', bought from Britain.",
      },
    ],
    da: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.15,
        text: "Se op: Over vandet ligger Oslo, kun fem kilometer væk med båd.",
        revealText: null,
      },
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.42,
        text: "Hvilken slags båd tror du, den allerførste båd på ruten var?",
        options: ["En sejlskude", "En hjuldamper", "En robåd"],
        answerIndex: 1,
        revealText: "En hjuldamper, «Bundefjord», købt i Storbritannien.",
      },
    ],
  },
  poi_galleri_vanntarnet: {
    nb: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.34,
        text: "Hva tror du Nesodden har flest av per innbygger av alle kommunene i Norge?",
        options: ["Fotballbaner", "Profesjonelle kunstnere", "Fiskebåter"],
        answerIndex: 1,
        revealText: "Profesjonelle kunstnere, ifølge Norsk kulturindeks.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.8,
        text: "Se opp: Veggene i tårnet er runde, så benkene måtte spesiallages.",
        revealText: null,
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.33,
        text: "What do you think Nesodden has more of per inhabitant than any other municipality in Norway?",
        options: ["Football pitches", "Professional artists", "Fishing boats"],
        answerIndex: 1,
        revealText: "Professional artists, according to the Norwegian Culture Index.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.81,
        text: "Look up: The walls of the tower are round, so the benches had to be specially made.",
        revealText: null,
      },
    ],
    da: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.33,
        text: "Hvad tror du, Nesodden har flest af per indbygger af alle kommuner i Norge?",
        options: ["Fodboldbaner", "Professionelle kunstnere", "Fiskerbåde"],
        answerIndex: 1,
        revealText: "Professionelle kunstnere, ifølge Norsk kulturindeks.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.81,
        text: "Se op: Væggene i tårnet er runde, så bænkene måtte specialfremstilles.",
        revealText: null,
      },
    ],
  },
  poi_skoklefall_kirke: {
    nb: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.5,
        text: "Hvor tror du tømrerne som bygde kirken, kom fra?",
        options: ["Bergen", "Hallingdal", "København"],
        answerIndex: 1,
        revealText: "Fra Hallingdal, og tømmeret de brukte, kom også derfra.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.86,
        text: "Se opp: Altertavlen, prekestolen og døpefonten ble laget og dekorert av Terje Grøstad på 1960-tallet.",
        revealText: null,
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.5,
        text: "Where do you think the carpenters who built the church came from?",
        options: ["Bergen", "Hallingdal", "Copenhagen"],
        answerIndex: 1,
        revealText: "From Hallingdal, and the timber they used came from there too.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.85,
        text: "Look up: The altarpiece, the pulpit and the font were made and decorated by Terje Grøstad in the 1960s.",
        revealText: null,
      },
    ],
    da: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.51,
        text: "Hvor tror du, tømrerne, der byggede kirken, kom fra?",
        options: ["Bergen", "Hallingdal", "København"],
        answerIndex: 1,
        revealText: "Fra Hallingdal, og det tømmer, de brugte, kom også derfra.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.86,
        text: "Se op: Terje Grøstad lavede og dekorerede altertavlen, prædikestolen og døbefonten i 1960'erne.",
        revealText: null,
      },
    ],
  },
  poi_hellviktangen: {
    nb: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.11,
        text: "Hva tror du navnet Hellvik kommer av?",
        options: ["En hval som strandet", "En flat steinhelle ved sjøen", "En konge som bodde her"],
        answerIndex: 1,
        revealText: "Trolig av en flat steinhelle ved sjøen, som kan ha vært brukt til å laste og losse skip.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.45,
        text: "Se opp: Konsul A. Hennum anla park, trapper og terrasser rundt år 1900.",
        revealText: null,
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.11,
        text: "Where do you think the name Hellvik comes from?",
        options: ["A stranded whale", "A flat rock slab by the shore", "A king who lived here"],
        answerIndex: 1,
        revealText: "Probably from a flat rock slab by the shore that may have been used for loading and unloading ships.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.45,
        text: "Look up: Consul A. Hennum laid out a park, stairs and terraces around 1900.",
        revealText: null,
      },
    ],
    da: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.11,
        text: "Hvad tror du, navnet Hellvik kommer af?",
        options: ["En hval, der strandede", "En flad stenhelle ved vandet", "En konge, der boede her"],
        answerIndex: 1,
        revealText: "Formentlig af en flad stenhelle ved vandet, som kan være blevet brugt til at laste og losse skibe.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.47,
        text: "Se op: Konsul A. Hennum anlagde park, trapper og terrasser omkring år 1900.",
        revealText: null,
      },
    ],
  },
};

export const NESODDTANGEN_HERO_IMAGES: Record<string, DemoHeroImageSource> = {
  poi_nesoddtangen_brygge: {
    pinnedFile: null,
    categories: ["Nesoddtangen brygge", "Nesoddtangen ferry terminal", "Nesoddtangen"],
    searchTerms: ["intitle:Nesoddtangen intitle:brygge", "intitle:Nesoddtangen intitle:ferry"],
    titleMustIncludeAny: ["Nesoddtangen", "Tangen brygge"],
    titleMustExclude: ["kirke", "church", "skole", "school", "senter", "interiør", "interior"],
  },
  poi_galleri_vanntarnet: {
    pinnedFile: null,
    categories: ["Galleri Vanntårnet", "Water towers in Nesodden"],
    searchTerms: ["intitle:Vanntårnet intitle:Nesodden", "intitle:Vanntårnet intitle:Nesoddtangen", "intitle:Vanntårnet intitle:Tangenåsen"],
    titleMustIncludeAny: ["Vanntårnet", "Vanntarnet", "water tower"],
    // Vanntårn med samme navn finnes i mange byer.
    titleMustExclude: ["Oslo", "Bergen", "Trondheim", "Stavanger", "Fredrikstad", "Tønsberg", "interiør", "interior"],
  },
  poi_skoklefall_kirke: {
    pinnedFile: null,
    categories: ["Skoklefall kirke", "Skoklefall Church"],
    searchTerms: ['intitle:"Skoklefall kirke"', "intitle:Skoklefall"],
    titleMustIncludeAny: ["Skoklefall"],
    titleMustExclude: ["Nesodden kirke", "Gjøfjell", "Lørenskog", "interiør", "interior", "altertavle"],
  },
  poi_hellviktangen: {
    pinnedFile: null,
    categories: ["Hellviktangen"],
    searchTerms: ["intitle:Hellviktangen"],
    titleMustIncludeAny: ["Hellviktangen"],
    titleMustExclude: ["Hellvik Station", "Hellvik stasjon", "Egersund", "interiør", "interior"],
  },
};
