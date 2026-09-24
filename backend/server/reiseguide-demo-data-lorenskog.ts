/**
 * Demo-innhold for SenseAid Explore: området Lørenskog (24.09.2026). Samme
 * konvensjoner som Oslo-området; se kommentaren øverst i
 * reiseguide-demo-data.ts, som samler alle områdene i DEMO_AREAS.
 *
 * Research 24.09.2026 bare fra søkeresultater (Wikipedia, SNL, kommunens og
 * godsets sider var blokkert fra utviklingsmiljøet), så alt er UTKAST og hvert
 * sted har en «Må verifiseres»-liste i sourceNote. Synstolkingen er skrevet ut
 * fra kildene uten befaring; farger og detaljer må kontrolleres på stedet.
 */
import type { DemoChapterPrompt, DemoHeroImageSource, DemoLang, DemoPoi } from "./reiseguide-demo-data.js";

export const LORENSKOG_AREA_INFO = {
  id: "area_lorenskog",
  slug: "lorenskog",
  name: "Lørenskog",
  defaultLang: "nb" as const,
  center: { lat: 59.9125, lng: 10.9715 },
  bbox: { south: 59.885, west: 10.952, north: 59.94, east: 10.99 },
};

export const LORENSKOG_POIS: DemoPoi[] = [
  {
    id: "poi_lorenskog_kirke",
    slug: "lorenskog-kirke",
    categoryId: "historisk",
    lat: 59.9246,
    lng: 10.9848,
    triggerRadiusM: 50,
    priority: 10,
    sortOrder: 1,
    freePreview: true,
    sourceNote:
      "Utkast 24.09.2026, ikke fagvurdert. Kilder (søkeresultater): https://snl.no/L%C3%B8renskog_kirke, https://kirkesok.no/kirke/172, https://www.kirken.no/nb-NO/fellesrad/l%C3%B8renskog/info/kirkene%20v%C3%A5re/l%C3%B8renskog%20kirke/, https://lorenskog.kirken.no/Artikler/Artikkeldetaljer/ArticleId/515/Litt-historie-om-L-248-rensko, https://lokalhistoriewiki.no/L%C3%B8renskog_kirke, https://norgeskirker.no/wiki/L%C3%B8renskog_kirke, https://www.wikidata.org/wiki/Q7592983. Må verifiseres: koordinat (fra Wikidata 59°55'28.6\"N 10°59'5.3\"E, adresse Hammerveien 1), antall sitteplasser (kildene sier 117 og 140, derfor utelatt), året for apostel-glassmaleriene (1947), klokkenes årstall (1874 og 1919), at vinduene i sør er to rundbuede, og alt i synstolkingen (skrevet uten befaring).",
    translations: {
      nb: {
        title: "Lørenskog kirke",
        subtitle: "Middelalderkirken ved Langvannet",
        summary:
          "Steinkirken ble murt en gang mellom 1150 og 1250 og er bygdas eldste bygning. Tårnet av tre kom i 1864, prekestolen er fra 1658, og alteret har en Kristus-mosaikk av Borgar Hauglid.",
        locationLabel: "Lørenskog, Norge",
        heroImageAlt: "Foto av Lørenskog kirke",
        practicalInfo: [
          { label: "Adresse", value: "Hammerveien 1, Lørenskog" },
          { label: "Adkomst", value: "Kirkegården er åpen; kirken er bare åpen ved gudstjenester og arrangementer" },
          { label: "Trinnfri tilgang", value: "Ikke bekreftet" },
        ],
      },
      en: {
        title: "Lørenskog Church",
        subtitle: "The medieval church by Langvannet",
        summary:
          "The stone church was built some time between 1150 and 1250 and is the oldest building in Lørenskog. The wooden tower came in 1864, the pulpit dates from 1658, and the altar has a mosaic of Christ by Borgar Hauglid.",
        locationLabel: "Lørenskog, Norway",
        heroImageAlt: "Photo of Lørenskog Church",
        practicalInfo: [
          { label: "Address", value: "Hammerveien 1, Lørenskog" },
          { label: "Getting in", value: "The churchyard is open; the church itself only opens for services and events" },
          { label: "Step-free access", value: "Not confirmed" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Kirken fra kalksteinsperioden",
          text:
            "Du står ved Lørenskog kirke, bygdas eldste bygning og det viktigste kulturminnet i kommunen. Ingen vet nøyaktig når den ble reist, men den ble bygd en gang mellom 1150 og 1250, i det som kalles kalksteinsperioden. Veggene er over en meter tykke. Det meste er gråstein bundet sammen med kalkmørtel, mens dørene, vinduene og buen mellom skipet og koret ble murt i tilhogd kalkstein.\n\nPlanen er den vanlige for middelalderkirker på landet: et rektangulært skip der menigheten satt, og et smalere og lavere kor mot øst. Opprinnelig hadde skipet bare ett vindu, mot sør. På 1860-tallet ble det byttet ut med to rundbuede vinduer, og i 1864 fikk kirken tårnet av tre som står foran inngangen i vest. Klokkene der oppe er fra 1874 og 1919.\n\nInne er prekestolen i renessansestil fra 1658 blant det eldste inventaret. Den ble overmalt flere ganger, men Finn Krafft restaurerte den i 1935. Sakristiet på nordsiden av koret kom til under restaureringen på 1950-tallet. Alteret har et Kristus-motiv i glassmosaikk som Borgar Hauglid laget i 1962, og allerede i 1947 hadde han laget åtte glassmalerier av apostlene til to av vinduene. Kirken er automatisk fredet, og i dag deles den av de to menighetene Fjellhamar og Skårer.",
          estimatedDurationS: 84,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står på kirkegården, mellom rader av gravsteiner og smale gangstier. Foran deg ligger en liten, lav steinkirke med tykke murer og et bratt saltak. Den lengste delen er skipet. I den østre enden henger et lavere og smalere kor fast på skipet, som et lite hus inntil et større. Mot vest reiser et tårn av tre seg foran inngangen, med et spisst tak øverst. På sørsiden av skipet sitter to vinduer med runde buer. Inntil koret på nordsiden ligger et lite tilbygg, sakristiet. Kirkegården omgir kirken på alle kanter.",
          estimatedDurationS: 37,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "A church from the limestone period",
          text:
            "You are standing by Lørenskog Church, the oldest building in the district and the most important historic monument in the municipality. No one knows exactly when it was raised, but it was built some time between 1150 and 1250, in what is called the limestone period. The walls are more than a metre thick. Most of it is rubble stone bound with lime mortar, while the doors, the windows and the arch between the nave and the chancel were built of dressed limestone.\n\nThe plan is the usual one for rural medieval churches: a rectangular nave where the congregation sat, and a narrower, lower chancel to the east. Originally the nave had only one window, facing south. In the 1860s it was replaced by two round-arched windows, and in 1864 the church got the tower of wood that stands in front of the entrance to the west. The bells up there date from 1874 and 1919.\n\nInside, the renaissance pulpit from 1658 is among the oldest furnishings. It was painted over several times, but Finn Krafft restored it in 1935. The sacristy on the north side of the chancel was added during the restoration in the 1950s. The altar has a figure of Christ in glass mosaic that Borgar Hauglid made in 1962, and as early as 1947 he had made eight stained-glass pictures of the apostles for two of the windows. The church is automatically protected as a listed building, and today it is shared by the two parishes of Fjellhamar and Skårer.",
          estimatedDurationS: 102,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing in the churchyard, between rows of gravestones and narrow paths. Ahead of you is a small, low stone church with thick walls and a steep pitched roof. The longest part is the nave. At its eastern end a lower, narrower chancel is joined to the nave, like a small house against a larger one. To the west a wooden tower rises in front of the entrance, with a pointed roof on top. On the south side of the nave are two windows with rounded arches. Against the chancel on the north side is a small extension, the sacristy. The churchyard surrounds the church on every side.",
          estimatedDurationS: 44,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Når ble Lørenskog kirke bygd?",
          options: ["Mellom 1150 og 1250", "Rundt 1650", "I 1864"],
          correctIndex: 0,
          explanation: "Den ble murt i kalksteinsperioden; nøyaktig år vet ingen.",
        },
        {
          question: "Hva er tårnet foran inngangen i vest laget av?",
          options: ["Stein", "Tre", "Jern"],
          correctIndex: 1,
          explanation: "Tårnet av tre kom i 1864, og klokkene er fra 1874 og 1919.",
        },
        {
          question: "Hvem laget Kristus-motivet i glassmosaikk på alteret?",
          options: ["Edvard Munch", "Borgar Hauglid", "Gustav Vigeland"],
          correctIndex: 1,
          explanation: "Borgar Hauglid laget mosaikken i 1962 og apostel-glassmaleriene i 1947.",
        },
      ],
      en: [
        {
          question: "When was Lørenskog Church built?",
          options: ["Between 1150 and 1250", "Around 1650", "In 1864"],
          correctIndex: 0,
          explanation: "It was built in the limestone period; no one knows the exact year.",
        },
        {
          question: "What is the tower in front of the west entrance made of?",
          options: ["Stone", "Wood", "Iron"],
          correctIndex: 1,
          explanation: "The wooden tower came in 1864, and the bells date from 1874 and 1919.",
        },
        {
          question: "Who made the figure of Christ in glass mosaic on the altar?",
          options: ["Edvard Munch", "Borgar Hauglid", "Gustav Vigeland"],
          correctIndex: 1,
          explanation: "Borgar Hauglid made the mosaic in 1962 and the apostle windows in 1947.",
        },
      ],
    },
  },
  {
    id: "poi_langvannet_lorenskog",
    slug: "langvannet-lorenskog",
    categoryId: "natur",
    lat: 59.9361,
    lng: 10.9586,
    triggerRadiusM: 250,
    priority: 6,
    sortOrder: 2,
    freePreview: false,
    sourceNote:
      "Utkast 24.09.2026, ikke fagvurdert. Kilder (søkeresultater): https://no.wikipedia.org/wiki/Langvannet_(L%C3%B8renskog), https://lokalhistoriewiki.no/wiki/Langvannet_(L%C3%B8renskog), https://ut.no/turforslag/118118/rundt-langvannet, https://www.lorenskog.kommune.no/tjenester/kultur-idrett-og-fritid/park-idrett-og-fritidsaktiviteter/parker-og-narmiljoanlegg/badeplasser/, https://felles.naturbase.no/api/dokument/hent/3695.PDF, https://lokalhistoriewiki.no/index.php?title=Sagelvavassdraget, https://www.nhm.uio.no/forskning/ressurser/publikasjoner/nhm-rapporter/nhm-rapport-078-2018.pdf, https://en.wikipedia.org/wiki/Mariholtet, https://www.wikidata.org/wiki/Q11220966. Må verifiseres: koordinat (midt i vannet, Wikidata 59°56'10\"N 10°57'31\"E; flytt gjerne til Langgrunna badeplass eller stistart), høyde (kildene sier 153 og 154 moh.), 500-årsjubileet for første sag i vassdraget (2020, dvs. ca. 1520), fiskeartene (fra NHM-rapport om Ellingsrudelva og Losbyelva), badeplassenes fasiliteter, og alt i synstolkingen (skrevet uten befaring).",
    translations: {
      nb: {
        title: "Langvannet",
        subtitle: "Vannet som drev sagene",
        summary:
          "Et smalt vann på 1,3 kilometer midt i Lørenskog, der Ellingsrudelva fra Østmarka renner inn. Sagene i vassdraget ga kommunen vannhjulet i våpenet, og i dag går turstien rundt hele vannet.",
        locationLabel: "Lørenskog, Norge",
        heroImageAlt: "Foto av Langvannet",
        practicalInfo: [
          { label: "Adkomst", value: "Turstien rundt vannet er åpen hele døgnet, gratis" },
          { label: "Badeplasser", value: "Langgrunna (brygge, sandstrand, toalett) og Vangen (sandstrand, grillplass, toalett)" },
          { label: "Trinnfri tilgang", value: "Grussti uten trinn på vestsiden; HC-toalett ved badeplassene om sommeren" },
        ],
      },
      en: {
        title: "Langvannet",
        subtitle: "The lake that drove the sawmills",
        summary:
          "A narrow lake 1.3 kilometres long in the middle of Lørenskog, fed by the Ellingsrud river from the Østmarka forest. The sawmills on the watercourse gave the municipality the water wheel in its coat of arms, and today a path runs all the way round.",
        locationLabel: "Lørenskog, Norway",
        heroImageAlt: "Photo of Langvannet",
        practicalInfo: [
          { label: "Getting there", value: "The path round the lake is open around the clock, free" },
          { label: "Bathing spots", value: "Langgrunna (jetty, sandy beach, toilet) and Vangen (sandy beach, barbecue area, toilet)" },
          { label: "Step-free access", value: "Step-free gravel path on the west side; accessible toilets at the bathing spots in summer" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Vannet, sagene og isen",
          text:
            "Foran deg ligger Langvannet, et smalt vann midt i Lørenskog. Det er rundt 1,3 kilometer langt, men bare fra 30 til 180 meter bredt, og det ligger 154 meter over havet. Ellingsrudelva kommer fra Elvåga i Østmarka, danner grensen mellom Oslo og Lørenskog og renner inn i Langvannet, og ut av vannet renner Sagelva forbi Fjellhamar og videre mot Nitelva, Øyeren og til slutt Glomma.\n\nNavnet Sagelva sier mye om hva vannet har betydd for bygda. I 2020 var det 500 år siden det første sagbruket kom i vassdraget. Tømmerfløting og sagbruk var så viktig for Lørenskog at kommunevåpenet fra 1957 viser et rødt vannhjul på gull bunn. Om vinteren ble det også skåret is på Langvannet, en gammel tradisjon her ved vannet.\n\nI dag er Langvannet først og fremst et sted for tur og bading. Stien rundt vannet er en populær løype for folk som går, jogger og sykler, og grusstien på vestsiden alene er halvannen kilometer lang. Langs stien står fjorten informasjonstavler om historie, kultur, natur og aktiviteter. Om sommeren kan du bade ved Langgrunna, der det er brygge, sandstrand og plen, eller ved Vangen, med sandstrand, stor gressplen og grillplass. I Ellingsrudelva lever det ørret som formerer seg naturlig, og i vassdraget finnes også abbor, gjedde og mort.",
          estimatedDurationS: 87,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står ved Langvannet. Vannet er smalt og langstrakt, så du ser bare en del av det herfra, og den andre bredden er ikke langt unna. Langs bredden går en bred grussti, og mellom stien og vannet vokser trær og busker. Her og der står benker og informasjonstavler ved stien. Ved badeplassene åpner det seg plener og små sandstrender ned mot vannet, og ved Langgrunna stikker en brygge ut i vannet. Lenger borte går en bro for turstien over vannet. Bak trærne skimter du hus og veier.",
          estimatedDurationS: 36,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Water, sawmills and ice",
          text:
            "In front of you lies Langvannet, the Long Lake, a narrow lake in the middle of Lørenskog. It is about 1.3 kilometres long, but only 30 to 180 metres wide, and it lies 154 metres above sea level. The Ellingsrud river comes from the lake Elvåga in the Østmarka forest, forms the border between Oslo and Lørenskog and flows into Langvannet, and out of the lake runs the Sagelva, the Saw River, past Fjellhamar and on towards the Nitelva, the lake Øyeren and finally the Glomma.\n\nThe name Sagelva tells you what the water has meant to the district. In 2020 it was 500 years since the first sawmill came to the watercourse. Timber floating and sawmills mattered so much to Lørenskog that the municipal coat of arms from 1957 shows a red water wheel on a gold field. In winter, ice was also cut on Langvannet, an old tradition here by the lake.\n\nToday Langvannet is above all a place for walks and swimming. The path round the lake is a popular route for walkers, joggers and cyclists, and the gravel path on the west side alone is one and a half kilometres long. Along the path stand fourteen information boards about history, culture, nature and activities. In summer you can swim at Langgrunna, with a jetty, sandy beach and lawn, or at Vangen, with a sandy beach, a large lawn and a barbecue area. Trout breed naturally in the Ellingsrud river, and perch, pike and roach also live in the watercourse.",
          estimatedDurationS: 101,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing by Langvannet. The lake is narrow and long, so you only see part of it from here, and the far shore is not far away. A wide gravel path runs along the shore, and between the path and the water grow trees and bushes. Here and there benches and information boards stand beside the path. At the bathing spots, lawns and small sandy beaches open down to the water, and at Langgrunna a jetty reaches out into the lake. Further off, a footbridge carries the path across the water. Behind the trees you can glimpse houses and roads.",
          estimatedDurationS: 40,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Omtrent hvor langt er Langvannet?",
          options: ["300 meter", "1,3 kilometer", "13 kilometer"],
          correctIndex: 1,
          explanation: "Vannet er rundt 1,3 kilometer langt, men bare 30 til 180 meter bredt.",
        },
        {
          question: "Hva viser Lørenskogs kommunevåpen fra 1957?",
          options: ["Et rødt vannhjul", "En hjort", "Et kirketårn"],
          correctIndex: 0,
          explanation: "Vannhjulet minner om tømmerfløting og sagbruk; den første saga kom i vassdraget for rundt 500 år siden.",
        },
        {
          question: "Hvor mange informasjonstavler står langs stien rundt vannet?",
          options: ["Fire", "Fjorten", "Førti"],
          correctIndex: 1,
          explanation: "Fjorten tavler om historie, kultur, natur og aktiviteter.",
        },
      ],
      en: [
        {
          question: "Roughly how long is Langvannet?",
          options: ["300 metres", "1.3 kilometres", "13 kilometres"],
          correctIndex: 1,
          explanation: "The lake is about 1.3 kilometres long, but only 30 to 180 metres wide.",
        },
        {
          question: "What does Lørenskog's coat of arms from 1957 show?",
          options: ["A red water wheel", "A deer", "A church tower"],
          correctIndex: 0,
          explanation: "The water wheel recalls timber floating and sawmills; the first sawmill came to the watercourse about 500 years ago.",
        },
        {
          question: "How many information boards stand along the path round the lake?",
          options: ["Four", "Fourteen", "Forty"],
          correctIndex: 1,
          explanation: "Fourteen boards about history, culture, nature and activities.",
        },
      ],
    },
  },
  {
    id: "poi_lorenskog_hus",
    slug: "lorenskog-hus",
    categoryId: "arkitektur",
    lat: 59.9276,
    lng: 10.9584,
    triggerRadiusM: 80,
    priority: 5,
    sortOrder: 3,
    freePreview: false,
    sourceNote:
      "Utkast 24.09.2026, ikke fagvurdert. Kilder (søkeresultater): https://www.lorenskoghus.no/om-huset/, https://l2.no/prosjekt/lorenskog-kulturhus, https://lokalhistoriewiki.no/wiki/L%C3%B8renskog_nye_sentrum, https://lokalhistoriewiki.no/Festplassen_(L%C3%B8renskog), https://lokalhistoriewiki.no/index.php?title=L%C3%B8renskog_sentralomr%C3%A5de, https://lorenskog.nkdb.no/steder/20002/L%C3%B8renskog+hus, https://www.lorenskogkino.no/informasjon/om-kinoen, https://sceneweb.no/nb/venue/128720/Festplassen,_L%C3%B8renskog%20hus, https://lokalhistoriewiki.no/Losby_Gods (Lørenskog egen kommune 1908). Må verifiseres: koordinat (anslått fra Metro senter, Solheimveien 85, Wikidata 59°55'39\"N 10°57'30\"E; huset ligger ved Festplassen like ved, adresse Festplassen 1), at det er åtte etasjer over bakken, liste over funksjoner i huset (kan ha endret seg siden 2011), og alt i synstolkingen (skrevet uten befaring).",
    translations: {
      nb: {
        title: "Lørenskog hus",
        subtitle: "Et sentrum blir til",
        summary:
          "Kulturhuset åpnet 30. april 2011 som sluttsteinen i Lørenskogs nye sentrum. L2 Arkitekter lot seg inspirere av Colosseum: en buet bygning med marmor mot veien og glass mot Festplassen.",
        locationLabel: "Lørenskog, Norge",
        heroImageAlt: "Foto av Lørenskog hus",
        practicalInfo: [
          { label: "Adresse", value: "Festplassen 1, Lørenskog" },
          { label: "Åpningstider", value: "Bibliotek, kino og scener har egne tider, sjekk lorenskoghus.no" },
          { label: "Trinnfri tilgang", value: "Ikke bekreftet, sjekk lorenskoghus.no" },
        ],
      },
      en: {
        title: "Lørenskog House",
        subtitle: "A town centre takes shape",
        summary:
          "The culture house opened on 30 April 2011 as the final piece of Lørenskog's new town centre. L2 Architects took inspiration from the Colosseum: a curved building with marble towards the road and glass towards Festplassen.",
        locationLabel: "Lørenskog, Norway",
        heroImageAlt: "Photo of Lørenskog House",
        practicalInfo: [
          { label: "Address", value: "Festplassen 1, Lørenskog" },
          { label: "Opening hours", value: "The library, cinema and stages keep their own hours; see lorenskoghus.no" },
          { label: "Step-free access", value: "Not confirmed; see lorenskoghus.no" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Et sentrum blir til",
          text:
            "Du står ved Festplassen foran Lørenskog hus, kulturhuset som ble sluttsteinen i Lørenskogs nye sentrum. Lørenskog ble egen kommune i 1908, men lenge hadde bygda ikke noe tydelig sentrum. Her ved Solheim lå det gårdsland. Solheim gård ble revet i 1982, da veien ble bygd ut til firefelts riksvei 159, og i 1988 bygde Even Dahl Metrosenteret like ved. Samme år åpnet Triaden på Skårer, og der vokste det fram et alternativt sentrum.\n\nValget falt på området her. Vinnerforslaget for det nye sentrumet samlet de viktigste byggene rundt en plass, og i 2007 fikk plassen navnet Festplassen. Kulturhuset åpnet 30. april 2011. Arkitekt Jon Flatebø i L2 Arkitekter vant konkurransen med forslaget «C-moment», en monumental, buet bygning inspirert av Colosseum i Roma. Mot Solheimveien vender huset en vegg av spansk marmor, mens siden mot Festplassen er av glass.\n\nInnenfor er det 15 000 kvadratmeter fordelt på åtte etasjer. Her er bibliotek, kino i fjerde etasje, den store salen Storstua, kulturskole, ungdomshus, kunstgalleri, frivilligsentral, restauranter og kommunale tjenester. Også plassen utenfor brukes som scene når det er arrangementer.",
          estimatedDurationS: 73,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står på en åpen, flat plass i sentrum. Foran deg reiser Lørenskog hus seg: en stor bygning som krummer seg i en bue rundt plassen, som et utsnitt av en arena. Siden som vender mot deg er nesten bare glass, etasje over etasje, så du kan se folk og lys inne i huset. På baksiden, mot Solheimveien, er fasaden kledd med lys marmor. Rundt plassen står andre nye bygninger med butikker og boliger. Plassen er belagt med stein og har god plass til folk.",
          estimatedDurationS: 35,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "A town centre takes shape",
          text:
            "You are standing on Festplassen in front of Lørenskog House, the culture house that became the final piece of Lørenskog's new town centre. Lørenskog became a municipality of its own in 1908, but for a long time the district had no clear centre. Here at Solheim there was farmland. Solheim farm was demolished in 1982, when the road was widened into the four-lane national road 159, and in 1988 Even Dahl built the Metro shopping centre close by. The same year Triaden opened at Skårer, and an alternative centre grew up there.\n\nThe choice fell on this area. The winning proposal for the new centre gathered the most important buildings around a square, and in 2007 the square was named Festplassen. The culture house opened on 30 April 2011. The architect Jon Flatebø of L2 Architects won the competition with the proposal 'C-moment', a monumental, curved building inspired by the Colosseum in Rome. Towards Solheimveien the house turns a wall of Spanish marble, while the side facing Festplassen is glass.\n\nInside there are 15,000 square metres over eight floors. Here you find the library, a cinema on the fourth floor, the large hall called Storstua, the school of music and arts, a youth centre, an art gallery, a volunteer centre, restaurants and municipal services. The square outside is also used as a stage for events.",
          estimatedDurationS: 90,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing on an open, level square in the town centre. Ahead of you rises Lørenskog House: a large building that curves in an arc around the square, like a section of an arena. The side facing you is almost all glass, floor above floor, so you can see people and lights inside. At the back, towards Solheimveien, the facade is clad in pale marble. Around the square stand other new buildings with shops and flats. The square is paved with stone and has plenty of room for people.",
          estimatedDurationS: 36,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Når åpnet Lørenskog hus?",
          options: ["2001", "2011", "2021"],
          correctIndex: 1,
          explanation: "Kulturhuset åpnet 30. april 2011, og plassen foran fikk navnet Festplassen i 2007.",
        },
        {
          question: "Hvilket byggverk ble arkitekten inspirert av?",
          options: ["Colosseum i Roma", "Operaen i Sydney", "Eiffeltårnet"],
          correctIndex: 0,
          explanation: "Jon Flatebø i L2 Arkitekter vant med forslaget «C-moment», en buet bygning.",
        },
        {
          question: "Hva er veggen mot Solheimveien kledd med?",
          options: ["Norsk skifer", "Spansk marmor", "Rødt tegl"],
          correctIndex: 1,
          explanation: "Mot veien er det marmor, mens siden mot Festplassen er av glass.",
        },
      ],
      en: [
        {
          question: "When did Lørenskog House open?",
          options: ["2001", "2011", "2021"],
          correctIndex: 1,
          explanation: "The culture house opened on 30 April 2011; the square in front was named Festplassen in 2007.",
        },
        {
          question: "Which building inspired the architect?",
          options: ["The Colosseum in Rome", "The Sydney Opera House", "The Eiffel Tower"],
          correctIndex: 0,
          explanation: "Jon Flatebø of L2 Architects won with the proposal 'C-moment', a curved building.",
        },
        {
          question: "What is the wall facing Solheimveien clad in?",
          options: ["Norwegian slate", "Spanish marble", "Red brick"],
          correctIndex: 1,
          explanation: "There is marble towards the road, while the side facing Festplassen is glass.",
        },
      ],
    },
  },
  {
    id: "poi_losby_gods",
    slug: "losby-gods",
    categoryId: "historisk",
    lat: 59.8883,
    lng: 10.982,
    triggerRadiusM: 150,
    priority: 7,
    sortOrder: 4,
    freePreview: false,
    sourceNote:
      "Utkast 24.09.2026, ikke fagvurdert. Kilder (søkeresultater): https://no.wikipedia.org/wiki/Losby_gods, https://snl.no/Losby, https://losby.no/klubben/losbys-historie, https://www.losbygods.no/historien/, https://www.losbygods.no/wp-content/uploads/2015/11/historien-om-losby-gods.pdf, https://www.losbygods.no/english/about/history/, https://www.historichotels.org/hotels-resorts/losby-gods/history, https://www.lorenskog.kommune.no/tjenester/kultur-idrett-og-fritid/kultur/kunst-museum-og-kulturminner/kulturminner/kulturminner-i-lorenskog/godset-pa-losby.121726.aspx, https://www.losbygods.no/om-hotellet/veibeskrivelse/. Må verifiseres: koordinat (fra godsets veibeskrivelse, N 59° 53′ 17.9″ Ø 10° 58′ 55.2″, adresse Losbyveien 270, 1475 Finstadjordet), rekkefølgen på eierne (Cudrio, Lumholtz, Jakob og Lorentz Meyer, Boeck), året for setegården (1647), jernbanen (1861, seks km til Fjellhamar, motorvogner fra 1914), prisene fra Historic Hotels Worldwide (2019 og 2025), og alt i synstolkingen (skrevet uten befaring). Hotellet er privat; sjekk hva som er åpent for besøkende.",
    translations: {
      nb: {
        title: "Losby gods",
        subtitle: "Fra vikinggård til jaktslott",
        summary:
          "Gårdene i Losbydalen overlevde svartedauden, og sagene her har gått siden 1500-tallet. Jakthytta fra rundt 1850 ble Losby Bruks hovedbygning og er i dag et prisbelønt historisk hotell.",
        locationLabel: "Lørenskog, Norge",
        heroImageAlt: "Foto av Losby gods",
        practicalInfo: [
          { label: "Adresse", value: "Losbyveien 270, Finstadjordet" },
          { label: "Adkomst", value: "Hotell og restaurant; sjekk losbygods.no før besøk" },
          { label: "I nærheten", value: "Golfbane og turstier inn i Østmarka" },
          { label: "Trinnfri tilgang", value: "Ikke bekreftet" },
        ],
      },
      en: {
        title: "Losby Manor",
        subtitle: "From Viking farm to hunting lodge",
        summary:
          "The farms in the Losby valley survived the Black Death, and sawmills have worked here since the 1500s. The hunting lodge from around 1850 became the main house of Losby Bruk and is today an award-winning historic hotel.",
        locationLabel: "Lørenskog, Norway",
        heroImageAlt: "Photo of Losby Manor",
        practicalInfo: [
          { label: "Address", value: "Losbyveien 270, Finstadjordet" },
          { label: "Getting in", value: "Hotel and restaurant; check losbygods.no before visiting" },
          { label: "Nearby", value: "Golf course and trails into the Østmarka forest" },
          { label: "Step-free access", value: "Not confirmed" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Fra vikinggård til jaktslott",
          text:
            "Du har kommet til Losby, i Losbydalen i kanten av Østmarka. Stedet har røtter tilbake til slutten av vikingtiden, da Losby trolig ble skilt ut fra gården Mork. Navnet kommer av det norrøne mannsnavnet Loptr. De tre gårdene Losby, Vestmork og Østmork var blant de få som overlevde svartedauden, og navnene lever videre i golfbanene Østmork og Vestmork.\n\nFra 1647 var Losby setegård. Mot slutten av 1700-tallet eide familien Cudrio stedet, fra rundt 1800 kjøpmann Lumholtz, og fra 1830 Jakob Meyer og siden sønnen Lorentz Meyer. Skogen var rikdommen. Sagbruksdriften her går tilbake til 1500-tallet, og i 1855 ble Losby, Østmork og Vestmork slått sammen til én drift, Losby Bruk. Fra 1861 gikk tømmer og plank på en seks kilometer lang jernbane ned til Fjellhamar stasjon, først trukket av hester og fra 1914 med motorvogner.\n\nHovedbygningen ble reist rundt 1850 som jakthytte. Først i 1893, da Lorentz Meyer Boeck og kona Kathrine flyttet inn, fikk godset fastboende eiere, og med dem begynte Losbys storhetstid. Da Lørenskog ble egen kommune i 1908, ble Boeck den første ordføreren. Fra 1997 til 1999 ble huset restaurert og bygd ut til hotell. I 2019 kåret Historic Hotels Worldwide Losby Gods til Europas beste historiske hotell, og i 2025 til verdens beste historiske resort.",
          estimatedDurationS: 86,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står i Losbydalen, der skogen møter åpne jorder og golfbaner. Foran deg ligger hovedbygningen på Losby gods, et stort hus som rommer selskapssaler, jaktsalonger og mange soverom. Rundt huset ligger lavere bygninger og tun, og en vei fører opp til hovedinngangen. Utover i dalen ligger golfbanene Østmork og Vestmork, oppkalt etter de gamle gårdene. Bak og rundt godset reiser skogåsene seg, og der begynner stiene inn i Østmarka. Det er stille her, langt fra trafikken, selv om du bare er noen kilometer fra sentrum av Lørenskog.",
          estimatedDurationS: 36,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "From Viking farm to hunting lodge",
          text:
            "You have come to Losby, in the Losby valley at the edge of the Østmarka forest. The place has roots back to the end of the Viking Age, when Losby was probably split off from the farm of Mork. The name comes from the Old Norse man's name Loptr. The three farms of Losby, Vestmork and Østmork were among the few that survived the Black Death, and their names live on in the Østmork and Vestmork golf courses.\n\nFrom 1647 Losby was a manor. Towards the end of the 1700s the Cudrio family owned it, from around 1800 the merchant Lumholtz, and from 1830 Jakob Meyer and later his son Lorentz Meyer. The forest was the wealth. Sawmilling here goes back to the 1500s, and in 1855 Losby, Østmork and Vestmork were merged into one business, Losby Bruk. From 1861 timber and planks travelled on a six-kilometre railway down to Fjellhamar station, drawn at first by horses and from 1914 by motor wagons.\n\nThe main house was built around 1850 as a hunting lodge. Only in 1893, when Lorentz Meyer Boeck and his wife Kathrine moved in, did the estate get owners who lived here all year, and with them Losby's golden age began. When Lørenskog became a municipality of its own in 1908, Boeck became its first mayor. From 1997 to 1999 the house was restored and extended into a hotel. In 2019 Historic Hotels Worldwide named Losby Gods the best historic hotel in Europe, and in 2025 the world's best historic resort.",
          estimatedDurationS: 102,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing in the Losby valley, where the forest meets open fields and golf courses. Ahead of you is the main house of Losby Manor, a large house that holds banqueting halls, hunting salons and many bedrooms. Around the house are lower buildings and yards, and a drive leads up to the main entrance. Further along the valley lie the Østmork and Vestmork golf courses, named after the old farms. Behind and around the estate the wooded ridges rise, and there the trails into the Østmarka forest begin. It is quiet here, far from the traffic, even though you are only a few kilometres from the centre of Lørenskog.",
          estimatedDurationS: 44,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Hva kommer navnet Losby av?",
          options: ["Det norrøne mannsnavnet Loptr", "Et gammelt ord for elg", "En dansk konge"],
          correctIndex: 0,
          explanation: "Losby ble trolig skilt ut fra Mork mot slutten av vikingtiden.",
        },
        {
          question: "Hvor gikk jernbanen fra Losby fra 1861?",
          options: ["Til Oslo sentrum", "Til Fjellhamar stasjon", "Til Lillestrøm"],
          correctIndex: 1,
          explanation: "Seks kilometer med tømmer og plank, først trukket av hester og fra 1914 med motorvogner.",
        },
        {
          question: "Hva ble hovedbygningen opprinnelig reist som, rundt 1850?",
          options: ["Kirke", "Jakthytte", "Skole"],
          correctIndex: 1,
          explanation: "Jakthytta fikk fastboende eiere i 1893 og ble hotell fra 1997 til 1999.",
        },
      ],
      en: [
        {
          question: "Where does the name Losby come from?",
          options: ["The Old Norse man's name Loptr", "An old word for elk", "A Danish king"],
          correctIndex: 0,
          explanation: "Losby was probably split off from Mork at the end of the Viking Age.",
        },
        {
          question: "Where did the railway from Losby run from 1861?",
          options: ["To central Oslo", "To Fjellhamar station", "To Lillestrøm"],
          correctIndex: 1,
          explanation: "Six kilometres of timber and planks, drawn at first by horses and from 1914 by motor wagons.",
        },
        {
          question: "What was the main house originally built as, around 1850?",
          options: ["A church", "A hunting lodge", "A school"],
          correctIndex: 1,
          explanation: "The hunting lodge got year-round owners in 1893 and became a hotel from 1997 to 1999.",
        },
      ],
    },
  },
];

export const LORENSKOG_CHAPTER_PROMPTS: Record<string, Record<DemoLang, DemoChapterPrompt[]>> = {
  poi_lorenskog_kirke: {
    nb: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.17,
        text: "Hvor tykke tror du murene i kirken er?",
        options: ["Rundt tjue centimeter", "Over en meter", "Rundt fem meter"],
        answerIndex: 1,
        revealText: "Over en meter. Det meste er gråstein bundet sammen med kalkmørtel.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.57,
        text: "Se opp: Tårnet av tre foran inngangen i vest kom til i 1864.",
        revealText: null,
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.18,
        text: "How thick do you think the church walls are?",
        options: ["About twenty centimetres", "More than a metre", "About five metres"],
        answerIndex: 1,
        revealText: "More than a metre. Most of it is rubble stone bound with lime mortar.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.57,
        text: "Look up: The tower of wood in front of the entrance to the west was added in 1864.",
        revealText: null,
      },
    ],
  },
  poi_langvannet_lorenskog: {
    nb: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.4,
        text: "Hva tror du Lørenskogs kommunevåpen viser?",
        options: ["En seilbåt", "Et rødt vannhjul", "En gullfisk"],
        answerIndex: 1,
        revealText: "Et rødt vannhjul på gull bunn, fordi tømmerfløting og sagbruk var så viktig for bygda.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.79,
        text: "Se opp: Langs stien står fjorten informasjonstavler om historie, kultur, natur og aktiviteter.",
        revealText: null,
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.44,
        text: "What do you think Lørenskog's coat of arms shows?",
        options: ["A sailing boat", "A red water wheel", "A goldfish"],
        answerIndex: 1,
        revealText: "A red water wheel on a gold field, because timber floating and sawmills mattered so much to the district.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.82,
        text: "Look up: Along the path stand fourteen information boards about history, culture, nature and activities.",
        revealText: null,
      },
    ],
  },
  poi_lorenskog_hus: {
    nb: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.54,
        text: "Hvilket berømt byggverk tror du den buede formen er inspirert av?",
        options: ["Pyramidene i Giza", "Colosseum i Roma", "Operaen i Sydney"],
        answerIndex: 1,
        revealText: "Colosseum i Roma. Forslaget het «C-moment», og arkitekten var Jon Flatebø i L2 Arkitekter.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.74,
        text: "Se opp: Siden mot Festplassen er av glass, mens veggen mot Solheimveien er av spansk marmor.",
        revealText: null,
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.55,
        text: "Which famous building do you think inspired the curved shape?",
        options: ["The pyramids of Giza", "The Colosseum in Rome", "The Sydney Opera House"],
        answerIndex: 1,
        revealText: "The Colosseum in Rome. The proposal was called 'C-moment', and the architect was Jon Flatebø of L2 Architects.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.75,
        text: "Look up: The side facing Festplassen is glass, while the wall facing Solheimveien is Spanish marble.",
        revealText: null,
      },
    ],
  },
  poi_losby_gods: {
    nb: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.53,
        text: "Hvordan tror du tømmer og plank ble fraktet fra Losby ned til Fjellhamar fra 1861?",
        options: ["I rør", "På jernbane", "Med luftballong"],
        answerIndex: 1,
        revealText: "På en seks kilometer lang jernbane, først trukket av hester og fra 1914 med motorvogner.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.68,
        text: "Se opp: Hovedbygningen ble reist rundt 1850 som jakthytte.",
        revealText: null,
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.53,
        text: "How do you think timber and planks were carried from Losby down to Fjellhamar from 1861?",
        options: ["Through pipes", "On a railway", "By hot-air balloon"],
        answerIndex: 1,
        revealText: "On a six-kilometre railway, drawn at first by horses and from 1914 by motor wagons.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.67,
        text: "Look up: The main house was built around 1850 as a hunting lodge.",
        revealText: null,
      },
    ],
  },
};

export const LORENSKOG_HERO_IMAGES: Record<string, DemoHeroImageSource> = {
  poi_lorenskog_kirke: {
    pinnedFile: null,
    categories: ["Lørenskog kirke", "Lørenskog Church"],
    searchTerms: ['intitle:"Lørenskog kirke"', 'intitle:"Lørenskog Church"', 'intitle:"Lorenskog kirke"'],
    // Tre andre kirker i kommunen har «Lørenskog» i nærheten av navnet.
    titleMustIncludeAny: ["Lørenskog kirke", "Lørenskog Church", "Lorenskog kirke", "Lørenskog_kirke"],
    titleMustExclude: ["Skårer kirke", "Fjellhamar kirke", "Frikirke", "Rasta kirke", "interiør", "interior", "altertavle", "gravstein"],
  },
  poi_langvannet_lorenskog: {
    pinnedFile: null,
    categories: ["Langvannet, Lørenskog"],
    searchTerms: ["intitle:Langvannet intitle:Lørenskog"],
    // Det finnes flere Langvannet (bl.a. i Oslo/Østmarka).
    titleMustIncludeAny: ["Langvannet"],
    titleMustExclude: ["Oslo", "Østmarka", "Bærum", "Ringerike", "Nordmarka", "kart"],
  },
  poi_lorenskog_hus: {
    pinnedFile: null,
    categories: ["Lørenskog hus"],
    searchTerms: ['intitle:"Lørenskog hus"', 'intitle:"Lorenskog hus"'],
    titleMustIncludeAny: ["Lørenskog hus", "Lorenskog hus", "Lørenskog_hus", "Festplassen"],
    titleMustExclude: ["rådhus", "Storsenter", "sykehus", "Ahus", "interiør", "interior"],
  },
  poi_losby_gods: {
    pinnedFile: null,
    categories: ["Losby gods", "Losby"],
    searchTerms: ['intitle:"Losby gods"', "intitle:Losby intitle:Lørenskog"],
    titleMustIncludeAny: ["Losby"],
    titleMustExclude: ["golf", "stasjon", "interiør", "interior"],
  },
};
