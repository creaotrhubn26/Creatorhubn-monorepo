/**
 * Demo-innhold for lydguide-POC-en (SenseAid Explore): området Kvadraturen,
 * Akershus festning og Operaen i Oslo (beslutning 17.09.2026). Lastes inn av
 * scripts/seed-reiseguide-demo.ts og brukes av tester.
 *
 * Manusene (fortelling 60–120 s per kapittel og synstolking 35–45 s, nb og en)
 * ble skrevet 18.09.2026 på grunnlag av research med kilder; kildene ligger i
 * sourceNote per sted, og gjennomlesingsdokumentet ligger i prosjektmappen
 * (reiseguide-manus-v1.md). Alt er fortsatt UTKAST (editorial_status = draft)
 * til en fagperson har godkjent. Punkter som må verifiseres er listet i
 * dokumentet. Ingen lydfiler eller bilder ennå (hero_image_key = null) fordi
 * rettigheter til foto ikke er avklart.
 *
 * Koordinater er hentet fra åpne kart og avrundet til 4 desimaler (± 10 m).
 * De må verifiseres i felt eller mot Kartverket før felttesten, sammen med
 * trigger-radiusene (30–80 m i by, 150–300 m i åpent landskap).
 *
 * Varighet er anslått fra ordtall (ca. 145 ord/min nb, 150 ord/min en) og
 * erstattes av faktisk lydlengde når TTS er kjørt.
 *
 * Quiz (18.09.2026, «etter besøket»): tre spørsmål per sted og språk, alle
 * med svar som står i fortellingen, så quizen aldri spør om noe man ikke har
 * hørt. Samme utkast-status som manusene.
 */

export type DemoLang = "nb" | "en";

export interface DemoScript {
  kind: "narration" | "audio_description";
  chapterNo: number;
  title: string | null;
  text: string;
  estimatedDurationS: number | null;
}

export interface DemoQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
}

export interface DemoPoi {
  id: string;
  slug: string;
  categoryId: string;
  lat: number;
  lng: number;
  triggerRadiusM: number;
  priority: number;
  sortOrder: number;
  freePreview: boolean;
  sourceNote: string;
  translations: Record<
    DemoLang,
    {
      title: string;
      subtitle: string;
      summary: string;
      locationLabel: string;
      heroImageAlt: string | null;
      practicalInfo: { label: string; value: string }[];
    }
  >;
  scripts: Record<DemoLang, DemoScript[]>;
  /** Kort quiz etter besøket (0630): tre spørsmål per språk, fakta fra manuset. */
  quiz: Record<DemoLang, DemoQuizQuestion[]>;
}

export const DEMO_AREA = {
  id: "area_oslo_kvadraturen",
  slug: "oslo-kvadraturen-festningen-operaen",
  name: "Kvadraturen, Akershus festning og Operaen",
  defaultLang: "nb" as const,
  center: { lat: 59.9095, lng: 10.7425 },
  bbox: { south: 59.9035, west: 10.728, north: 59.9145, east: 10.76 },
  priceNok: 59,
};

export const DEMO_CATEGORIES = [
  { id: "museum", sortOrder: 1, labels: { nb: "Museum", en: "Museum" } },
  { id: "historisk", sortOrder: 2, labels: { nb: "Historiske", en: "Historic" } },
  { id: "natur", sortOrder: 3, labels: { nb: "Natur", en: "Nature" } },
  { id: "arkitektur", sortOrder: 4, labels: { nb: "Arkitektur", en: "Architecture" } },
];

export const DEMO_POIS: DemoPoi[] = [
  {
    id: "poi_akershus_festning",
    slug: "akershus-festning",
    categoryId: "historisk",
    lat: 59.9075,
    lng: 10.7364,
    triggerRadiusM: 120,
    priority: 10,
    sortOrder: 1,
    freePreview: true,
    sourceNote:
      "Utkast 18.09.2026, ikke fagvurdert. Kilder: https://snl.no/Akershus_slott_og_festning, https://www.oppdagkvadraturen.no/en/sights/fra-borg-til-festning, https://lokalhistoriewiki.no/wiki/Beleiringen_av_Akershus_1716, https://snl.no/beleiringen_av_Akershus_festning_-_1716, https://lokalhistoriewiki.no/wiki/Slaget_i_Dynekilen, https://www.arkivverket.no/dokumentasjon/domstol-og-fengsel/fengselsarkiver/akershus-slaveri-og-arbeidsanstalt-akershus-landsfengsel-17671950-og-akershus-fengsel-19401945, https://snl.no/Akershus_landsfengsel, https://www.nrk.no/arkiv/artikkel/65-ar-siden-quisling-ble-henrettet-1.7335741, https://digitaltmuseum.no/021017927343/kanoner-pa-akershus-festning, https://www.forsvarshistoriskmuseum.no/akershus-festning, https://www.forsvarshistoriskmuseum.no/akershus-slott",
    translations: {
      nb: {
        title: "Akershus festning",
        subtitle: "Borgen som aldri falt",
        summary:
          "Håkon den femte begynte på borgen rundt år 1300. Den har tålt ni beleiringer uten å bli inntatt, ble Christian den fjerdes renessanseslott, så fengsel, og i dag er området åpent for alle.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: null,
        practicalInfo: [
          { label: "Festningsområdet", value: "Åpent daglig 06–21, gratis" },
          { label: "Akershus slott", value: "Mai–august man–lør 10–16, søn 12–16; september–april lør–søn 12–17" },
          { label: "Museer", value: "Forsvarsmuseet daglig 10–16, Hjemmefrontmuseet 10–16 (10–17 mai–august)" },
          { label: "Trinnfri tilgang", value: "Delvis; brostein og bratte partier innenfor murene" },
          { label: "Toalett", value: "Ved besøkssenteret (daglig 10–17)" },
        ],
      },
      en: {
        title: "Akershus Fortress",
        subtitle: "The castle that never fell",
        summary:
          "King Haakon the Fifth began the castle around 1300. It has withstood nine sieges without being taken, became Christian the Fourth's renaissance palace, then a prison, and today the grounds are open to everyone.",
        locationLabel: "Oslo, Norway",
        heroImageAlt: null,
        practicalInfo: [
          { label: "Fortress grounds", value: "Open daily 06:00–21:00, free" },
          { label: "Akershus Castle", value: "May–Aug Mon–Sat 10–16, Sun 12–16; Sept–Apr Sat–Sun 12–17" },
          { label: "Museums", value: "Armed Forces Museum daily 10–16; Resistance Museum 10–16 (10–17 May–Aug)" },
          { label: "Step-free access", value: "Partial; cobblestones and steep sections inside the walls" },
          { label: "Toilets", value: "At the visitor centre (daily 10–17)" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Borgen som aldri falt",
          text:
            "Du står ved Akershus festning, Norges viktigste borg. Kong Håkon den femte begynte å bygge her rundt år 1300, på en klippe der byen kunne forsvares fra sjøsiden. Allerede i 1308 sto borgen imot et svensk angrep, og siden har den blitt beleiret ni ganger uten å bli inntatt. I 1567, under den nordiske sjuårskrigen, brant slottsherren Christen Munk hele byen ned for at svenskene ikke skulle finne mat og ly. Etter 39 dager ga de opp. Skrekken fra den beleiringen førte til at borgen fikk sine første moderne bastioner, de lave, skrå vollene av jord og stein som du ser rundt deg.\n\nDet slottet som reiser seg innenfor murene i dag, er likevel mest Christian den fjerdes verk. Tidlig på 1600-tallet lot han den mørke middelalderborgen bygge om til et lyst renessanseslott, med de to trappetårnene Blåtårnet og Romerikstårnet. Siste gang noen prøvde seg, var i 1716, da den svenske kongen Karl den tolvte selv ledet beleiringen. Han holdt byen i seks uker, men ga opp etter at Tordenskiold senket forsyningsflåten hans i Dynekilen.",
          estimatedDurationS: 73,
        },
        {
          kind: "narration",
          chapterNo: 2,
          title: "Fengsel, krig og frihet",
          text:
            "Da festningen mistet sin militære betydning, ble den fengsel. Fra 1739 til 1950 satt straffedømte her, først på det som ble kalt Slaveriet, der fangene hugget stein i tunge lenker og sov i fellessaler. Mange av dem ble dyktige steinhuggere, og mye av granitten i byen rundt deg er hugget av fanger herfra.\n\nUnder andre verdenskrig overtok den tyske okkupasjonsmakten festningen og brukte den som fengsel for motstandsfolk. Etter frigjøringen i 1945 ble Vidkun Quisling, lederen for Nasjonal Samling, dømt for landssvik og skutt her natt til 24. oktober. Flere andre landssvikdømte ble også henrettet på festningen.\n\nI dag rommer området Forsvarsmuseet og Hjemmefrontmuseet, som forteller nettopp denne historien. I slottet ligger det kongelige mausoleet der kong Haakon den sjuende og dronning Maud hviler, og staten bruker fortsatt salene til festmiddager. Resten av tiden er festningen din: en park med kanoner, murer og byens beste utsikt over fjorden.",
          estimatedDurationS: 62,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står på en høyde over fjorden, mellom lave voller av gress og grå gråstein. Foran deg reiser slottet seg: lyse, pussede murer med to slanke tårn som har spisse, mørke tak. Til venstre går en brosteinsvei skrått opp mot slottsporten, med en høy mur på hver side. Til høyre, over en lav brystning, ligger fjorden. Der ser du Aker Brygge, det grå Rådhuset med sine to firkantede tårn, og lenger ute havnen. På vollen foran brystningen står to gamle kanoner av mørk bronse, rettet mot vannet. Trærne rundt deg er høye lindetrær som gir skygge over stien.",
          estimatedDurationS: 41,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "The castle that never fell",
          text:
            "You are standing by Akershus Fortress, Norway's most important castle. King Haakon the Fifth began building here around the year 1300, on a cliff where the city could be defended from the sea. As early as 1308 the castle withstood a Swedish attack, and since then it has been besieged nine times without ever being taken. In 1567, during the Nordic Seven Years' War, the castellan Christen Munk burned the whole city down so the Swedes would find neither food nor shelter. After 39 days they gave up. The fright of that siege gave the castle its first modern bastions, the low, sloping ramparts of earth and stone you see around you.\n\nThe palace rising inside the walls today is nevertheless mostly the work of Christian the Fourth. In the early 1600s he had the dark medieval castle rebuilt as a bright renaissance palace, with the two staircase towers, the Blue Tower and the Romerike Tower. The last attempt to take it came in 1716, when the Swedish king Charles the Twelfth led the siege in person. He held the city for six weeks, but gave up after Tordenskiold sank his supply fleet at Dynekilen.",
          estimatedDurationS: 78,
        },
        {
          kind: "narration",
          chapterNo: 2,
          title: "Prison, war and freedom",
          text:
            "When the fortress lost its military importance it became a prison. From 1739 to 1950 convicts were held here, at first in what was called the Slavery, where prisoners cut stone in heavy chains and slept in shared halls. Many of them became skilled stonemasons, and much of the granite in the city around you was cut by prisoners from here.\n\nDuring the Second World War the German occupiers took over the fortress and used it as a prison for members of the resistance. After the liberation in 1945 Vidkun Quisling, the leader of the Nasjonal Samling party, was convicted of treason and shot here in the early hours of 24 October. Several other convicted collaborators were also executed at the fortress.\n\nToday the grounds house the Armed Forces Museum and the Resistance Museum, which tell exactly this story. Inside the castle is the royal mausoleum where King Haakon the Seventh and Queen Maud rest, and the state still uses the halls for banquets. The rest of the time the fortress is yours: a park of cannons, walls and the city's best view of the fjord.",
          estimatedDurationS: 74,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing on a rise above the fjord, between low ramparts of grass and grey stone. Ahead of you rises the castle: pale, rendered walls with two slender towers topped by steep, dark roofs. To your left a cobbled road climbs at an angle towards the castle gate, with a high wall on either side. To your right, beyond a low parapet, lies the fjord. There you see Aker Brygge, the grey City Hall with its two square towers, and further out the harbour. On the rampart in front of the parapet stand two old cannons of dark bronze, aimed at the water. The trees around you are tall lime trees that shade the path.",
          estimatedDurationS: 46,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Hvor mange ganger er Akershus festning blitt beleiret uten å bli inntatt?",
          options: ["Tre ganger", "Ni ganger", "Fjorten ganger"],
          correctIndex: 1,
          explanation: "Ni beleiringer, den siste i 1716 da Karl den tolvte selv ledet svenskene.",
        },
        {
          question: "Hvilken konge bygde middelalderborgen om til et renessanseslott?",
          options: ["Håkon den femte", "Christian den fjerde", "Karl den tolvte"],
          correctIndex: 1,
          explanation: "Christian den fjerde ga borgen lyse murer og tårnene Blåtårnet og Romerikstårnet tidlig på 1600-tallet.",
        },
        {
          question: "Hva ble festningen brukt til fra 1739 til 1950?",
          options: ["Kongelig bolig", "Fengsel", "Universitet"],
          correctIndex: 1,
          explanation: "På «Slaveriet» hugget fangene stein i lenker; mye av granitten i byen er hugget her.",
        },
      ],
      en: [
        {
          question: "How many times has Akershus Fortress been besieged without being taken?",
          options: ["Three times", "Nine times", "Fourteen times"],
          correctIndex: 1,
          explanation: "Nine sieges, the last in 1716 when Charles the Twelfth led the Swedes in person.",
        },
        {
          question: "Which king rebuilt the medieval castle as a renaissance palace?",
          options: ["Haakon the Fifth", "Christian the Fourth", "Charles the Twelfth"],
          correctIndex: 1,
          explanation: "Christian the Fourth gave the castle its bright walls and the Blue Tower and Romerike Tower in the early 1600s.",
        },
        {
          question: "What was the fortress used for from 1739 to 1950?",
          options: ["A royal residence", "A prison", "A university"],
          correctIndex: 1,
          explanation: "At the 'Slavery' prisoners cut stone in chains; much of the city's granite was cut here.",
        },
      ],
    },
  },
  {
    id: "poi_christiania_torv",
    slug: "christiania-torv",
    categoryId: "historisk",
    lat: 59.9107,
    lng: 10.7397,
    triggerRadiusM: 40,
    priority: 6,
    sortOrder: 2,
    freePreview: false,
    sourceNote:
      "Utkast 18.09.2026, ikke fagvurdert. Kilder: https://www.oppdagkvadraturen.no/historien, https://www.oppdagkvadraturen.no/stoppesteder/her-skal-byen-ligge, https://www.oppdagkvadraturen.no/en/sights/christiania-torv-2-2, https://okk.kunstsamlingen.no/objects/2402/hansken, https://snl.no/R%C3%A5dmannsg%C3%A5rden, https://en.wikipedia.org/wiki/Anatomig%C3%A5rden, https://www.kafecelsius.no/om-oss, https://lokalhistoriewiki.no/Christiania_torv",
    translations: {
      nb: {
        title: "Christiania torv",
        subtitle: "Her skal byen ligge",
        summary:
          "Da Oslo brant i 1624, flyttet Christian den fjerde byen hit, i ly av festningen, og ga den sitt eget navn. Torget var den nye byens første, og hansken i bronse minner om kongens ord.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: null,
        practicalInfo: [
          { label: "Adkomst", value: "Åpent torg, tilgjengelig hele døgnet" },
          { label: "Trinnfri tilgang", value: "Ja, men steinsatt dekke" },
          { label: "Servering", value: "Kafé Celsius og Gamle Raadhus ligger ved torget, sjekk egne åpningstider" },
        ],
      },
      en: {
        title: "Christiania Square",
        subtitle: "The city shall lie here",
        summary:
          "When Oslo burned in 1624, Christian the Fourth moved the city here, under the guns of the fortress, and gave it his own name. This was the new city's first square, and the bronze glove recalls the king's words.",
        locationLabel: "Oslo, Norway",
        heroImageAlt: null,
        practicalInfo: [
          { label: "Getting there", value: "Open square, accessible around the clock" },
          { label: "Step-free access", value: "Yes, but stone paving" },
          { label: "Food and drink", value: "Café Celsius and Gamle Raadhus are on the square; check their own opening hours" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Her skal byen ligge",
          text:
            "Natt til 17. august 1624 begynte det å brenne i Oslo, og på tre dager var nesten hele byen borte. Byen lå den gang på den andre siden av Bjørvika, der Gamlebyen ligger i dag. Kong Christian den fjerde kom selv opp fra København, og han bestemte at byen ikke skulle gjenreises der den sto. Den skulle flyttes hit, inn under kanonene på Akershus, og den skulle hete Christiania, etter ham selv. Sagnet sier at han pekte ned mot bakken, akkurat her, og sa: «Her skal byen ligge.» Hansken i bronse som står midt på torget, laget av Wenche Gulbrandsen i 1997, er byens takk for det pekende fingeren. Den samme hansken holder kongen i hånden på statuen sin på Stortorvet.\n\nDen nye byen ble tegnet med linjal. Gatene skulle krysse hverandre i rette vinkler og være brede nok til at ild ikke kunne hoppe fra hus til hus. Derfor heter bydelen Kvadraturen. Kongen innførte også murtvang: innenfor bymuren måtte alle bygge i mur eller stein, og de som ikke hadde råd, fikk nøye seg med bindingsverk fylt med murstein. Torget du står på var den nye byens første, med byens første kirke fra 1639 og rådhuset fra 1641 like ved. Rådmannsgården på hjørnet, med ankerjern som viser årstallet 1626, er trolig den eldste murgården som står igjen fra Christian den fjerdes by. Den ble senere garnisonssykehus, og naboen Anatomigården huset universitetets første disseksjonssal.",
          estimatedDurationS: 98,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står på et lite, steinsatt torg omgitt av lave bygårder i to og tre etasjer. Midt på torget, på en liten opphøyd øy, står en stor hånd i mørk bronse, formet som en hanske, med pekefingeren rettet ned mot bakken. Rundt hånden er det et lavt basseng i granitt. Til den ene siden ligger en bred bygning i rødlig murstein med hvite vinduskarmer; der er det kafé med bord ute. På hjørnet skrått overfor står en lys, pusset bygning med bratt tak av mørke, blanke takstein. Det er Gamle rådhus. Gatene går rett ut fra torget i alle fire retninger.",
          estimatedDurationS: 42,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "The city shall lie here",
          text:
            "On the night of 17 August 1624 a fire broke out in Oslo, and within three days almost the whole city was gone. The city then lay on the other side of Bjørvika, where the Old Town is today. King Christian the Fourth came up from Copenhagen himself, and he decided that the city should not be rebuilt where it stood. It was to be moved here, under the cannons of Akershus, and it was to be called Christiania, after him. Legend has it that he pointed down at the ground, right here, and said: 'Here shall the city lie.' The bronze glove in the middle of the square, made by Wenche Gulbrandsen in 1997, is the city's thanks for that pointing finger. The king holds the same glove in his hand on his statue on Stortorvet.\n\nThe new city was drawn with a ruler. The streets were to cross at right angles and be wide enough that fire could not jump from house to house. That is why the district is called Kvadraturen, the Quadrature. The king also made masonry compulsory: inside the city wall everyone had to build in brick or stone, and those who could not afford it had to make do with timber framing filled with brick. The square you are standing on was the new city's first, with the city's first church from 1639 and the town hall from 1641 close by. The councillor's house on the corner, whose wall anchors show the year 1626, is probably the oldest masonry house left from Christian the Fourth's city. It later became the garrison hospital, and its neighbour, the Anatomy House, held the university's first dissection room.",
          estimatedDurationS: 112,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing on a small, stone-paved square surrounded by low buildings of two and three storeys. In the middle of the square, on a small raised island, stands a large hand in dark bronze, shaped like a glove, its index finger pointing down at the ground. Around the hand is a low granite basin. On one side is a wide building of reddish brick with white window frames; there is a café with tables outside. On the corner diagonally opposite stands a pale, rendered building with a steep roof of dark, glossy tiles. That is the Old Town Hall. The streets run straight out from the square in all four directions.",
          estimatedDurationS: 45,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Hva skjedde i 1624 som gjorde at byen ble flyttet hit?",
          options: ["En stor flom", "En bybrann", "Et svensk angrep"],
          correctIndex: 1,
          explanation: "Brannen natt til 17. august 1624 tok nesten hele byen på tre dager.",
        },
        {
          question: "Hva peker hansken i bronse midt på torget på?",
          options: ["Mot festningen", "Ned mot bakken der byen skulle ligge", "Mot fjorden"],
          correctIndex: 1,
          explanation: "Sagnet sier kongen pekte ned og sa: «Her skal byen ligge.» Hansken er laget av Wenche Gulbrandsen i 1997.",
        },
        {
          question: "Hvorfor heter bydelen Kvadraturen?",
          options: ["Gatene krysser hverandre i rette vinkler", "Bymuren hadde fire porter", "Torget er helt kvadratisk"],
          correctIndex: 0,
          explanation: "Byen ble tegnet med linjal, med brede gater så ild ikke kunne hoppe fra hus til hus.",
        },
      ],
      en: [
        {
          question: "What happened in 1624 that made the city move here?",
          options: ["A great flood", "A city fire", "A Swedish attack"],
          correctIndex: 1,
          explanation: "The fire on the night of 17 August 1624 destroyed almost the whole city in three days.",
        },
        {
          question: "What does the bronze glove in the middle of the square point at?",
          options: ["The fortress", "The ground where the city was to lie", "The fjord"],
          correctIndex: 1,
          explanation: "Legend says the king pointed down and said 'Here shall the city lie.' The glove is by Wenche Gulbrandsen, 1997.",
        },
        {
          question: "Why is the district called Kvadraturen?",
          options: ["The streets cross at right angles", "The city wall had four gates", "The square is perfectly square"],
          correctIndex: 0,
          explanation: "The city was drawn with a ruler, with streets wide enough that fire could not jump between houses.",
        },
      ],
    },
  },
  {
    id: "poi_gamle_radhus",
    slug: "gamle-radhus",
    categoryId: "historisk",
    lat: 59.9103,
    lng: 10.7403,
    triggerRadiusM: 30,
    priority: 3,
    sortOrder: 3,
    freePreview: false,
    sourceNote:
      "Utkast 18.09.2026, ikke fagvurdert. Kilder: https://lokalhistoriewiki.no/Gamle_r%C3%A5dhus_(Oslo), https://www.gamleraadhus.no/historien, https://www.dehistoriske.com/destinations-in-norway/oslo-area/restaurants/gamle-raadhus-restaurant/, https://www.visitoslo.com/eat/gamle-raadhus-restaurant, https://digitaltmuseum.no/0210111926649/teatermuseet-flytter-inn-i-gamle-radhus, https://en.wikipedia.org/wiki/Gamle_r%C3%A5dhus_(Oslo), https://sceneweb.no/nb/venue/31901",
    translations: {
      nb: {
        title: "Gamle rådhus",
        subtitle: "Byens første rådhus",
        summary:
          "Huset fra 1641 var Christianias rådhus i nesten hundre år. Siden har det vært kirke, fengsel, Høyesterett og teatermuseum, og i dag serveres det lutefisk i de gamle cellene.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: null,
        practicalInfo: [
          { label: "Adresse", value: "Nedre Slottsgate 1, hjørnet av Christiania torv" },
          { label: "Restaurant og scene", value: "Gamle Raadhus, sjekk åpningstider på gamleraadhus.no" },
          { label: "Trinnfri tilgang", value: "Ikke bekreftet, spør restauranten" },
        ],
      },
      en: {
        title: "The Old Town Hall",
        subtitle: "The city's first town hall",
        summary:
          "The house from 1641 was Christiania's town hall for almost a hundred years. Since then it has been a church, a prison, the Supreme Court and a theatre museum, and today lutefisk is served in the old cells.",
        locationLabel: "Oslo, Norway",
        heroImageAlt: null,
        practicalInfo: [
          { label: "Address", value: "Nedre Slottsgate 1, on the corner of Christiania torv" },
          { label: "Restaurant and stage", value: "Gamle Raadhus; check opening hours at gamleraadhus.no" },
          { label: "Step-free access", value: "Not confirmed; ask the restaurant" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Byens første rådhus",
          text:
            "Det lyse huset på hjørnet er byens eldste rådhus. Visestattholder Lauritz Hansen lot det bygge i 1641, med penger fra Christian den fjerde selv, bare sytten år etter at byen ble grunnlagt. I to etasjer, med pussede murvegger, høye gavler og et bratt tak av svartglasserte takstein, var det et av de flotteste husene i den nye byen. Her møttes byens råd, her ble dommer avsagt, og i kjelleren satt de dømte og ventet.\n\nRådhus var det til 1733. Så begynte et langt og broket liv. Huset var brannstasjon, kirke en kort periode, privatbolig og fengsel. Fra 1815 til 1846 holdt Norges Høyesterett til her, i det unge landets første tiår med egen grunnlov. Frimurerne hadde losje her, og på 1700-tallet forsvant både trappetårnet og gavlene, før de høye renessansegavlene ble gjenskapt på 1900-tallet slik du ser dem i dag.\n\nI 1856 flyttet restauratøren Matheus Helseth inn i første etasje, og siden har det vært servert mat i huset. Gamle Raadhus er i dag mest kjent for lutefisken sin, laget av håndskåret tørrfisk fra Værøy i Lofoten, og de gamle fengselscellene i kjelleren er blitt vinkjeller og selskapsrom. I andre etasje holdt Teatermuseet til fra 1981 til 2008, og nå brukes salen til konserter og forestillinger. En brann i 1996 gjorde stor skade, men huset ble satt i stand igjen av byen som eier det.",
          estimatedDurationS: 94,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Foran deg, på hjørnet mellom torget og gaten, står en toetasjes bygning med lyse, pussede murvegger. Taket er bratt og dekket av mørke, blanke takstein, og mot torget reiser det seg en høy, trappet gavl med små blindvinduer. Vinduene i etasjene er små og mange, med hvite sprosser. Ved inngangen fra gaten henger et skilt med navnet Gamle Raadhus, og om sommeren står det bord og stoler på fortauet. Til høyre for huset fortsetter Rådhusgata bort fra torget, og til venstre går Nedre Slottsgate opp mot festningen.",
          estimatedDurationS: 36,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "The city's first town hall",
          text:
            "The pale house on the corner is the city's oldest town hall. The deputy governor Lauritz Hansen had it built in 1641, with money from Christian the Fourth himself, only seventeen years after the city was founded. Two storeys high, with rendered brick walls, tall gables and a steep roof of black-glazed tiles, it was one of the finest houses in the new city. Here the city council met, here judgements were passed, and in the cellar the convicted sat and waited.\n\nIt remained the town hall until 1733. Then a long and varied life began. The house was a fire station, briefly a church, a private home and a jail. From 1815 to 1846 Norway's Supreme Court sat here, in the young country's first decades with its own constitution. The Freemasons had a lodge here, and in the 18th century both the staircase tower and the gables disappeared, before the tall renaissance gables were recreated in the 20th century as you see them today.\n\nIn 1856 the restaurateur Matheus Helseth moved into the ground floor, and food has been served in the house ever since. Gamle Raadhus is best known today for its lutefisk, made from hand-cut stockfish from Værøy in Lofoten, and the old prison cells in the cellar have become a wine cellar and a private dining room. The Theatre Museum occupied the first floor from 1981 to 2008, and the hall is now used for concerts and performances. A fire in 1996 did great damage, but the house was restored by the city that owns it.",
          estimatedDurationS: 104,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "In front of you, on the corner between the square and the street, stands a two-storey building with pale, rendered brick walls. The roof is steep and covered in dark, glossy tiles, and towards the square rises a tall stepped gable with small blind windows. The windows on both floors are small and many, with white glazing bars. By the entrance from the street hangs a sign with the name Gamle Raadhus, and in summer there are tables and chairs on the pavement. To the right of the house Rådhusgata continues away from the square, and to the left Nedre Slottsgate climbs towards the fortress.",
          estimatedDurationS: 42,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Hvilket år ble Gamle rådhus bygd?",
          options: ["1624", "1641", "1733"],
          correctIndex: 1,
          explanation: "Visestattholder Lauritz Hansen lot det bygge i 1641, bare sytten år etter at byen ble grunnlagt.",
        },
        {
          question: "Hvilken institusjon holdt til i huset fra 1815 til 1846?",
          options: ["Stortinget", "Høyesterett", "Norges Bank"],
          correctIndex: 1,
          explanation: "Norges Høyesterett satt her i det unge landets første tiår med egen grunnlov.",
        },
        {
          question: "Hva er restauranten Gamle Raadhus mest kjent for?",
          options: ["Lutefisk", "Pinnekjøtt", "Fårikål"],
          correctIndex: 0,
          explanation: "Lutefisken lages av håndskåret tørrfisk fra Værøy i Lofoten, og de gamle cellene er blitt vinkjeller.",
        },
      ],
      en: [
        {
          question: "In which year was the Old Town Hall built?",
          options: ["1624", "1641", "1733"],
          correctIndex: 1,
          explanation: "Deputy governor Lauritz Hansen had it built in 1641, only seventeen years after the city was founded.",
        },
        {
          question: "Which institution sat in the house from 1815 to 1846?",
          options: ["The Parliament", "The Supreme Court", "Norges Bank"],
          correctIndex: 1,
          explanation: "Norway's Supreme Court sat here in the young country's first decades with its own constitution.",
        },
        {
          question: "What is the restaurant Gamle Raadhus best known for?",
          options: ["Lutefisk", "Pinnekjøtt", "Fårikål"],
          correctIndex: 0,
          explanation: "The lutefisk is made from hand-cut stockfish from Værøy in Lofoten, and the old cells are now a wine cellar.",
        },
      ],
    },
  },
  {
    id: "poi_oslo_bors",
    slug: "oslo-bors",
    categoryId: "historisk",
    lat: 59.9108,
    lng: 10.743,
    triggerRadiusM: 40,
    priority: 4,
    sortOrder: 4,
    freePreview: false,
    sourceNote:
      "Utkast 18.09.2026, ikke fagvurdert. Kilder: https://no.wikipedia.org/wiki/B%C3%B8rsen_(Oslo), https://lokalhistoriewiki.no/wiki/Oslo_B%C3%B8rs, https://en.wikipedia.org/wiki/Oslo_Stock_Exchange, https://no.wikipedia.org/wiki/B%C3%B8rshagen, https://www.euronext.com/en/markets/oslo, https://www.nielstorp.no/en/project/oslo-bors-oslo-stock-exchange/",
    translations: {
      nb: {
        title: "Oslo Børs",
        subtitle: "Handelens hus",
        summary:
          "Christian Heinrich Grosch tegnet børsbygningen i streng empirestil i 1826–1828. Børsen selv er eldre: første handelsdag var 15. april 1819, den gang med varer, ikke aksjer.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: null,
        practicalInfo: [
          { label: "Adkomst", value: "Børshagen er åpen park; selve bygningen er kontorer og ikke åpen for publikum" },
          { label: "Trinnfri tilgang", value: "Parken har grusganger uten trinn" },
        ],
      },
      en: {
        title: "Oslo Stock Exchange",
        subtitle: "House of trade",
        summary:
          "Christian Heinrich Grosch designed the exchange building in strict Empire style in 1826–1828. The exchange itself is older: the first trading day was 15 April 1819, in goods rather than shares.",
        locationLabel: "Oslo, Norway",
        heroImageAlt: null,
        practicalInfo: [
          { label: "Getting there", value: "Børshagen is a public park; the building itself is offices and not open to visitors" },
          { label: "Step-free access", value: "The park has gravel paths without steps" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Handelens hus",
          text:
            "Bygningen foran deg er Oslo Børs, tegnet av Christian Heinrich Grosch og reist mellom 1826 og 1828. Grosch var egentlig assistent for slottsarkitekten Linstow, men da Stortinget i 1827 nektet å bevilge penger til Slottet, sto han plutselig ledig, og kjøpmannen Thor Olsen ga ham oppdraget. Resultatet ble et av de første monumentalbyggene i den unge hovedstaden: streng empirestil, doriske søyler og rolige, symmetriske proporsjoner. Det opprinnelige huset var bare én etasje på en høy kjeller, omtrent en tredel av det du ser i dag. Sidefløyene og sørfløyen kom i 1909 og 1910, tegnet av Carl Michalsen i samme stil.\n\nSelve børsen er eldre enn huset. Den ble opprettet ved lov i 1818, og første handelsdag var 15. april 1819. Da var det varer som ble omsatt, ikke aksjer. Verdipapirbørs ble den først i 1881, med 16 obligasjonslån og 23 aksjer på listen, blant dem Norges Bank. I dag heter den Euronext Oslo Børs, og handelen skjer elektronisk, men bygningen er fortsatt børsens hjem.\n\nForan inngangen står Merkur, handelens gud, i bronse på en fontene med fire løvehoder. Han ble gitt av grossereren Conrad Langaard da tilbygget ble innviet i 1911. Parken du står i, Børshagen, er enda eldre enn børsen. Den ble anlagt like etter 1800 og er ett av landets første offentlige parkanlegg.",
          estimatedDurationS: 90,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står i Børshagen, en liten park med grusganger, høye løvtrær og benker. Rett foran deg, bak fontenen med Merkur-figuren, ligger børsbygningen: en lav, bred bygning i to etasjer over en høy sokkel, i en lys, varm gulfarge med hvite detaljer. Midt på fasaden bærer kraftige, glatte søyler en trekantet gavl. Vinduene er høye og står i jevne rekker. På hver side strekker fløyene seg ut og rammer inn parken. Bak deg ligger Tollbugata, og til høyre skimter du husene i Kvadraturen.",
          estimatedDurationS: 34,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "House of trade",
          text:
            "The building in front of you is the Oslo Stock Exchange, designed by Christian Heinrich Grosch and built between 1826 and 1828. Grosch was actually assistant to the palace architect Linstow, but when Parliament refused to fund the Royal Palace in 1827 he suddenly had time on his hands, and the merchant Thor Olsen gave him the commission. The result was one of the first monumental buildings of the young capital: strict Empire style, Doric columns and calm, symmetrical proportions. The original house was only one storey on a high basement, about a third of what you see today. The side wings and the south wing were added in 1909 and 1910 by Carl Michalsen, in the same style.\n\nThe exchange itself is older than the house. It was founded by law in 1818, and the first trading day was 15 April 1819. Back then it was goods that changed hands, not shares. It only became a securities exchange in 1881, with 16 bond series and 23 stocks on the list, among them Norges Bank. Today it is called Euronext Oslo Børs and trading is electronic, but the building is still the exchange's home.\n\nIn front of the entrance stands Mercury, the god of commerce, in bronze on a fountain with four lion heads. He was a gift from the wholesaler Conrad Langaard when the extension was inaugurated in 1911. The park you are standing in, Børshagen, is older than the exchange itself. It was laid out shortly after 1800 and is one of the country's first public parks.",
          estimatedDurationS: 104,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing in Børshagen, a small park with gravel paths, tall deciduous trees and benches. Straight ahead, beyond the fountain with the figure of Mercury, lies the exchange building: a low, wide building of two storeys above a high base, in a pale, warm yellow with white details. In the middle of the facade, sturdy smooth columns carry a triangular pediment. The windows are tall and set in even rows. On either side the wings reach out and frame the park. Behind you is Tollbugata, and to your right you can glimpse the houses of Kvadraturen.",
          estimatedDurationS: 39,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Hvem tegnet børsbygningen?",
          options: ["Christian Heinrich Grosch", "Sverre Fehn", "Ingvar Hjorth"],
          correctIndex: 0,
          explanation: "Grosch fikk oppdraget i 1827 da Stortinget nektet å bevilge penger til Slottet han egentlig jobbet med.",
        },
        {
          question: "Hva ble omsatt på børsen den første handelsdagen i 1819?",
          options: ["Aksjer", "Varer", "Obligasjoner"],
          correctIndex: 1,
          explanation: "Verdipapirbørs ble den først i 1881, med 16 obligasjonslån og 23 aksjer på listen.",
        },
        {
          question: "Hvilken gud står i bronse på fontenen foran inngangen?",
          options: ["Tor", "Merkur", "Neptun"],
          correctIndex: 1,
          explanation: "Merkur, handelens gud, ble gitt av grossereren Conrad Langaard i 1911.",
        },
      ],
      en: [
        {
          question: "Who designed the exchange building?",
          options: ["Christian Heinrich Grosch", "Sverre Fehn", "Ingvar Hjorth"],
          correctIndex: 0,
          explanation: "Grosch got the commission in 1827 when Parliament refused to fund the Royal Palace he was working on.",
        },
        {
          question: "What was traded on the exchange's first trading day in 1819?",
          options: ["Shares", "Goods", "Bonds"],
          correctIndex: 1,
          explanation: "It only became a securities exchange in 1881, with 16 bond series and 23 stocks on the list.",
        },
        {
          question: "Which god stands in bronze on the fountain by the entrance?",
          options: ["Thor", "Mercury", "Neptune"],
          correctIndex: 1,
          explanation: "Mercury, the god of commerce, was a gift from the wholesaler Conrad Langaard in 1911.",
        },
      ],
    },
  },
  {
    id: "poi_bankplassen",
    slug: "bankplassen",
    categoryId: "museum",
    lat: 59.9097,
    lng: 10.7414,
    triggerRadiusM: 40,
    priority: 5,
    sortOrder: 5,
    freePreview: false,
    sourceNote:
      "Utkast 18.09.2026, ikke fagvurdert. Kilder: https://no.wikipedia.org/wiki/Bankplassen_(Oslo), https://riksantikvaren.no/fredninger/bankplassen-4-i-oslo/, https://snl.no/Museet_for_samtidskunst, https://oslobyleksikon.no/side/Museet_for_samtidskunst, https://kimaarkitektur.no/projects/arkitekturmuseet-arkitekt-sverre-fehn/, https://www.nasjonalmuseet.no/en/guide/architecture_folder/architecture/517/, https://www.engebret-cafe.no/historien, https://www.ao.no/henrik-ibsen-bjornstjerne-bjornson-og-edvard-munch-var-alle-gjester-hos-denne-restauranten-i-oslo/s/5-128-889049, https://digitaltmuseum.no/011085442640/bankplassen",
    translations: {
      nb: {
        title: "Bankplassen",
        subtitle: "Tre banker og en kafé",
        summary:
          "Norges Bank har hatt tre hus rundt denne plassen: Grosch-bygget fra 1828, jugendpalasset fra 1906 og dagens hovedsete fra 1986. I hjørnet ligger Engebret Café, byens eldste restaurant.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: null,
        practicalInfo: [
          { label: "Adkomst", value: "Åpen plass, tilgjengelig hele døgnet" },
          { label: "Trinnfri tilgang", value: "Plassen er flat, men brosteinslagt" },
          { label: "Museum", value: "Nasjonalmuseet – Arkitektur, sjekk åpningstider på nasjonalmuseet.no" },
        ],
      },
      en: {
        title: "Bankplassen",
        subtitle: "Three banks and a café",
        summary:
          "Norges Bank has had three buildings around this square: the Grosch building from 1828, the Art Nouveau palace from 1906 and today's headquarters from 1986. On the corner is Engebret Café, the city's oldest restaurant.",
        locationLabel: "Oslo, Norway",
        heroImageAlt: null,
        practicalInfo: [
          { label: "Getting there", value: "Open square, accessible around the clock" },
          { label: "Step-free access", value: "The square is flat but cobbled" },
          { label: "Museum", value: "The National Museum – Architecture; check opening hours at nasjonalmuseet.no" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Tre banker og en kafé",
          text:
            "Plassen heter Bankplassen fordi Norges Bank flyttet inn her. Det første bankbygget står fortsatt: den lave, klassisistiske bygningen fra 1828, tegnet av Christian Heinrich Grosch, samme arkitekt som Børsen et steinkast unna. Da banken vokste ut av huset, utlyste den en arkitektkonkurranse. Ingvar Hjorth vant i 1900, og i 1906 sto det nye hovedsetet ferdig på den andre siden av plassen: et tungt palass i hugget norsk granitt og marmor, rikt dekorert i jugendstil. Hjorth tegnet også store deler av interiøret og møblene, og bygningen regnes som et helhetlig kunstverk. Den er fredet.\n\nI 1986 flyttet Norges Bank inn i sitt tredje hus på plassen, det moderne hovedsetet som fortsatt er i bruk. Siden har de to gamle husene levd videre som museer. Grosch-bygget ble Arkitekturmuseet, og i 2008 fikk det en ny paviljong i glass og rå betong av Sverre Fehn, den eneste norske arkitekten som har vunnet Pritzker-prisen. Hjorths granittpalass huset Museet for samtidskunst fra 1990 til 2017, da samlingen flyttet til det nye Nasjonalmuseet ved Vestbanen.\n\nI hjørnet av plassen ligger Engebret Café, åpnet i 1857 og byens eldste restaurant. Skuespillerne fra Christiania Theater hadde den som stamsted, og Ibsen, Bjørnson, Grieg og Munch var faste gjester. Grieg hadde sine egne kaffekopper her, og Munchs bord er fortsatt det mest ettertraktede.",
          estimatedDurationS: 89,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står på en åpen, brosteinslagt plass omgitt av store steinbygninger. Midt på plassen står en rund fontene med benker rundt. På den ene siden reiser Norges Banks gamle hovedsete fra 1906 seg: tre høye etasjer i lys grå, grovhugget granitt, med tunge buer over inngangen og små tårn oppe på taket. Rett overfor ligger den lave, lyse bygningen fra 1828 med rolige, klassiske former, og inntil den en paviljong av glass og betong. På hjørnet, i en eldre bygård med lys fasade, henger skiltet til Engebret Café. Trærne langs kantene av plassen er unge og smale.",
          estimatedDurationS: 40,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Three banks and a café",
          text:
            "The square is called Bankplassen, Bank Square, because Norges Bank moved in here. The first bank building still stands: the low, neoclassical building from 1828, designed by Christian Heinrich Grosch, the same architect as the Stock Exchange a stone's throw away. When the bank outgrew the house it held an architectural competition. Ingvar Hjorth won in 1900, and in 1906 the new headquarters was completed on the other side of the square: a heavy palace in hewn Norwegian granite and marble, richly decorated in Art Nouveau. Hjorth also designed much of the interior and the furniture, and the building is regarded as a total work of art. It is a listed building.\n\nIn 1986 Norges Bank moved into its third house on the square, the modern headquarters still in use today. Since then the two old houses have lived on as museums. The Grosch building became the Museum of Architecture, and in 2008 it gained a new pavilion in glass and raw concrete by Sverre Fehn, the only Norwegian architect to have won the Pritzker Prize. Hjorth's granite palace housed the Museum of Contemporary Art from 1990 to 2017, when the collection moved to the new National Museum by Vestbanen.\n\nOn the corner of the square is Engebret Café, opened in 1857 and the city's oldest restaurant. The actors of the Christiania Theatre made it their regular haunt, and Ibsen, Bjørnson, Grieg and Munch were regular guests. Grieg had his own coffee cups here, and Munch's table is still the most sought after.",
          estimatedDurationS: 101,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing on an open, cobbled square surrounded by large stone buildings. In the middle of the square is a round fountain with benches around it. On one side rises the former Norges Bank headquarters from 1906: three tall storeys of pale grey, rough-hewn granite, with heavy arches over the entrance and small turrets on the roof. Directly opposite is the low, pale building from 1828 with calm classical forms, and next to it a pavilion of glass and concrete. On the corner, in an older building with a light facade, hangs the sign of Engebret Café. The trees along the edges of the square are young and slender.",
          estimatedDurationS: 44,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Hvor mange hus har Norges Bank hatt rundt Bankplassen?",
          options: ["Ett", "To", "Tre"],
          correctIndex: 2,
          explanation: "Grosch-bygget fra 1828, jugendpalasset fra 1906 og dagens hovedsete fra 1986.",
        },
        {
          question: "Hvem tegnet paviljongen i glass og betong ved Arkitekturmuseet?",
          options: ["Snøhetta", "Sverre Fehn", "Ingvar Hjorth"],
          correctIndex: 1,
          explanation: "Sverre Fehn, den eneste norske arkitekten som har vunnet Pritzker-prisen, tegnet paviljongen fra 2008.",
        },
        {
          question: "Hvilket år åpnet Engebret Café?",
          options: ["1857", "1906", "1986"],
          correctIndex: 0,
          explanation: "Byens eldste restaurant; Ibsen, Bjørnson, Grieg og Munch var faste gjester.",
        },
      ],
      en: [
        {
          question: "How many buildings has Norges Bank had around Bankplassen?",
          options: ["One", "Two", "Three"],
          correctIndex: 2,
          explanation: "The Grosch building from 1828, the Art Nouveau palace from 1906 and today's headquarters from 1986.",
        },
        {
          question: "Who designed the glass and concrete pavilion by the Museum of Architecture?",
          options: ["Snøhetta", "Sverre Fehn", "Ingvar Hjorth"],
          correctIndex: 1,
          explanation: "Sverre Fehn, the only Norwegian architect to win the Pritzker Prize, designed the 2008 pavilion.",
        },
        {
          question: "In which year did Engebret Café open?",
          options: ["1857", "1906", "1986"],
          correctIndex: 0,
          explanation: "The city's oldest restaurant; Ibsen, Bjørnson, Grieg and Munch were regulars.",
        },
      ],
    },
  },
  {
    id: "poi_operaen",
    slug: "operaen",
    categoryId: "arkitektur",
    lat: 59.9074,
    lng: 10.7529,
    triggerRadiusM: 200,
    priority: 8,
    sortOrder: 6,
    freePreview: false,
    sourceNote:
      "Utkast 18.09.2026, ikke fagvurdert. Kilder: https://en.wikipedia.org/wiki/Oslo_Opera_House, https://www.snohetta.com/projects/norwegian-national-opera-and-ballet, https://www.dezeen.com/2008/04/09/opera-house-oslo-by-snohetta-2/, https://www.archdaily.com/20953/oslo-opera-house-wins-mies-van-der-rohe-award-2009, https://koro.no/prosjekter/den-norske-opera-ballett/, https://www.area-arch.it/en/the-other-wall-at-the-opera-house/, https://en.wikipedia.org/wiki/She_Lies, https://www.newsinenglish.no/2010/05/11/new-sculpture-berths-off-opera-house/, https://kallisthos.com/en/oslo-opera-house-carrara-marble/, https://www.operaen.no/en/your-visit-at-oslo-operahouse/practical-information/",
    translations: {
      nb: {
        title: "Operaen",
        subtitle: "Et tak du kan gå på",
        summary:
          "Snøhettas operahus åpnet 12. april 2008. Taket av hvit marmor reiser seg rett opp av fjorden og er åpent for alle, døgnet rundt og uten billett.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: null,
        practicalInfo: [
          { label: "Taket", value: "Åpent hele døgnet, gratis, ingen billett" },
          { label: "Foajé og toaletter", value: "Sjekk dagens åpningstider på operaen.no" },
          { label: "Trinnfri tilgang", value: "Trinnfri inngang, heis og HC-toalett inne; takrampene er skrå, men uten trinn" },
          { label: "Adkomst", value: "5 minutter til fots fra Oslo S" },
        ],
      },
      en: {
        title: "The Opera House",
        subtitle: "A roof you can walk on",
        summary:
          "Snøhetta's opera house opened on 12 April 2008. The white marble roof rises straight out of the fjord and is open to everyone, around the clock and without a ticket.",
        locationLabel: "Oslo, Norway",
        heroImageAlt: null,
        practicalInfo: [
          { label: "The roof", value: "Open around the clock, free, no ticket needed" },
          { label: "Foyer and toilets", value: "Check today's opening hours at operaen.no" },
          { label: "Step-free access", value: "Step-free entrance, lift and accessible toilet inside; the roof ramps are sloped but have no steps" },
          { label: "Getting there", value: "A five-minute walk from Oslo Central Station" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Et fjell av marmor",
          text:
            "Foran deg ligger Operaen, hjemmet til Den Norske Opera & Ballett. Bygningen ble tegnet av det norske arkitektkontoret Snøhetta og åpnet 12. april 2008. Ideen var enkel og dristig: et hus du kan gå på. Taket er en skrå flate av hvit italiensk marmor som reiser seg rett opp av fjorden, som et isflak eller en bre. Marmoren, av typen La Facciata, ble valgt fordi den holder på lyset og fargen også når den er våt. Til sammen dekker den rundt 20 000 kvadratmeter, tak og foajé i ett, slik at byens gulv fortsetter helt opp på huset.\n\nBak marmoren reiser scenetårnet seg, kledd i aluminiumsplater med et mønster laget av tekstilkunstnerne Astrid Løvaas og Kirsten Wagle, inspirert av gamle vevmønstre. Inne i foajeen bølger en vegg av eik rundt hovedsalen, og bak garderobene lyser Olafur Eliassons «Den andre veggen». Prisen endte på om lag 4,4 milliarder kroner. Året etter åpningen fikk bygget EUs arkitekturpris, Mies van der Rohe-prisen, og det er i dag et av Norges mest besøkte byggverk.",
          estimatedDurationS: 71,
        },
        {
          kind: "narration",
          chapterNo: 2,
          title: "Taket og fjorden",
          text:
            "Taket er åpent for alle, hele døgnet, uten billett. Gå opp langs skråningene, så får du utsikt over Bjørvika, fjorden og byen. Ute i vannet, rett foran huset, flyter «She Lies» av Monica Bonvicini: en skulptur i stål og glass, tolv meter høy, som dreier sakte med tidevannet. Den er en tredimensjonal tolkning av Caspar David Friedrichs maleri «Ishavet» fra 1820-årene og ble avduket i mai 2010, med dronning Sonja til stede.\n\nInnenfor rommer hovedsalen 1 364 tilskuere, og to mindre scener tar 400 og 200. På taket har det vært konserter med opptil 15 000 mennesker. Snur du deg mot land, ser du de høye husene i Barcode, det nye Munchmuseet og Deichman-biblioteket, alle reist etter at Operaen viste vei for den nye bydelen.",
          estimatedDurationS: 52,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text:
            "Du står på plassen foran Operaen. Foran deg skråner store flater av hvit marmor opp fra bakken, som en bred rampe uten trinn. Overflaten er glatt og lys, med lange, tynne fuger. Til venstre for rampen, i bakkeplan, er hele fasaden av glass, så du kan se den varme, gyldne eikeveggen som bølger innenfor. Over det hele ruver scenetårnet, en høy, firkantet blokk i lyst, mønstret aluminium. Til høyre glitrer fjorden, og ute i vannet står en kantete form av glass og stål som fanger sola.",
          estimatedDurationS: 36,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "A mountain of marble",
          text:
            "In front of you lies the Opera House, home of the Norwegian National Opera and Ballet. The building was designed by the Norwegian architects Snøhetta and opened on 12 April 2008. The idea was simple and bold: a house you can walk on. The roof is a sloping plane of white Italian marble that rises straight out of the fjord, like an ice floe or a glacier. The marble, a type called La Facciata, was chosen because it keeps its light and colour even when wet. Altogether it covers around 20,000 square metres, roof and foyer in one, so that the city's floor continues right up onto the house.\n\nBehind the marble rises the stage tower, clad in aluminium panels with a pattern by the textile artists Astrid Løvaas and Kirsten Wagle, inspired by old weaving patterns. Inside the foyer a wall of oak curves around the main hall, and behind the cloakrooms glows Olafur Eliasson's 'The Other Wall'. The final cost was about 4.4 billion kroner. The year after it opened the building won the EU's architecture prize, the Mies van der Rohe Award, and today it is one of Norway's most visited buildings.",
          estimatedDurationS: 78,
        },
        {
          kind: "narration",
          chapterNo: 2,
          title: "The roof and the fjord",
          text:
            "The roof is open to everyone, around the clock, with no ticket. Walk up the slopes and you get a view over Bjørvika, the fjord and the city. Out in the water, right in front of the house, floats 'She Lies' by Monica Bonvicini: a sculpture in steel and glass, twelve metres tall, that turns slowly with the tide. It is a three-dimensional interpretation of Caspar David Friedrich's painting 'The Sea of Ice' from the 1820s and was unveiled in May 2010, with Queen Sonja present.\n\nInside, the main hall seats 1,364, and two smaller stages take 400 and 200. The roof has hosted concerts with up to 15,000 people. Turn towards the land and you see the tall buildings of the Barcode, the new Munch Museum and the Deichman library, all built after the Opera House showed the way for the new district.",
          estimatedDurationS: 58,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text:
            "You are standing on the square in front of the Opera House. Ahead of you, large planes of white marble slope up from the ground like a wide ramp without steps. The surface is smooth and pale, with long, thin joints. To the left of the ramp, at ground level, the whole facade is glass, so you can see the warm, golden oak wall curving inside. Above it all looms the stage tower, a tall, square block of pale, patterned aluminium. To your right the fjord glitters, and out in the water stands an angular shape of glass and steel that catches the sun.",
          estimatedDurationS: 42,
        },
      ],
    },
    quiz: {
      nb: [
        {
          question: "Hvilket år åpnet Operaen?",
          options: ["2000", "2008", "2012"],
          correctIndex: 1,
          explanation: "Operaen åpnet 12. april 2008 og fikk Mies van der Rohe-prisen året etter.",
        },
        {
          question: "Hva er taket kledd med?",
          options: ["Hvit italiensk marmor", "Norsk granitt", "Glass"],
          correctIndex: 0,
          explanation: "Marmoren La Facciata holder på lyset og fargen også når den er våt; rundt 20 000 kvadratmeter.",
        },
        {
          question: "Hva heter skulpturen som flyter i vannet foran Operaen?",
          options: ["«Ishavet»", "«She Lies»", "«Den andre veggen»"],
          correctIndex: 1,
          explanation: "«She Lies» av Monica Bonvicini dreier med tidevannet og tolker Caspar David Friedrichs «Ishavet».",
        },
      ],
      en: [
        {
          question: "In which year did the Opera House open?",
          options: ["2000", "2008", "2012"],
          correctIndex: 1,
          explanation: "It opened on 12 April 2008 and won the Mies van der Rohe Award the following year.",
        },
        {
          question: "What is the roof clad in?",
          options: ["White Italian marble", "Norwegian granite", "Glass"],
          correctIndex: 0,
          explanation: "The La Facciata marble keeps its light and colour even when wet; around 20,000 square metres.",
        },
        {
          question: "What is the sculpture floating in the water in front of the Opera House called?",
          options: ["'The Sea of Ice'", "'She Lies'", "'The Other Wall'"],
          correctIndex: 1,
          explanation: "'She Lies' by Monica Bonvicini turns with the tide and interprets Caspar David Friedrich's 'The Sea of Ice'.",
        },
      ],
    },
  },
];
