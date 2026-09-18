/**
 * Demo-innhold for lydguide-POC-en: området Kvadraturen, Akershus festning og
 * Operaen i Oslo (beslutning 17.09.2026). Lastes inn av
 * scripts/seed-reiseguide-demo.ts og brukes av tester.
 *
 * Status: alt er UTKAST (editorial_status = draft). Manusene er korte
 * plassholdere som viser formen; ekte manus (60–120 s), synstolking,
 * oversettelser, TTS og Soniox-teksting er steg 2 i POC-planen. Ingen lydfiler
 * eller bilder ennå (hero_image_key = null) fordi rettigheter til foto ikke er
 * avklart.
 *
 * Koordinater er hentet fra åpne kart og avrundet til 4 desimaler (± 10 m).
 * De må verifiseres i felt eller mot Kartverket før felttesten, sammen med
 * trigger-radiusene (30–80 m i by, 150–300 m i åpent landskap).
 */

export type DemoLang = "nb" | "en";

export interface DemoScript {
  kind: "narration" | "audio_description";
  chapterNo: number;
  title: string | null;
  text: string;
  estimatedDurationS: number | null;
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

const OSLO_NB = "Oslo, Norge";
const OSLO_EN = "Oslo, Norway";
const SOURCE_NOTE =
  "Utkast. Faktasjekk mot Wikipedia/Oslo byleksikon og avklar rettigheter før godkjenning.";

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
    sourceNote: SOURCE_NOTE,
    translations: {
      nb: {
        title: "Akershus festning",
        subtitle: "En borg i endring",
        summary:
          "Middelalderborgen fra rundt år 1300 ble bygget om til renessanseslott på 1600-tallet og har aldri blitt inntatt ved beleiring. I dag er festningsområdet åpent for alle.",
        locationLabel: OSLO_NB,
        heroImageAlt: null,
        practicalInfo: [
          { label: "Åpningstider", value: "Festningsområdet er åpent daglig, sjekk tider for slottet og museene" },
          { label: "Adkomst", value: "Til fots fra Rådhusplassen eller Kongens gate" },
          { label: "Trinnfri tilgang", value: "Delvis; brostein og bratte partier innenfor murene" },
          { label: "Toalett", value: "Ved besøkssenteret" },
        ],
      },
      en: {
        title: "Akershus Fortress",
        subtitle: "A fortress in flux",
        summary:
          "The medieval castle from around 1300 was rebuilt as a renaissance palace in the 17th century and has never been taken by siege. Today the fortress grounds are open to everyone.",
        locationLabel: OSLO_EN,
        heroImageAlt: null,
        practicalInfo: [
          { label: "Opening hours", value: "The grounds are open daily; check hours for the castle and museums" },
          { label: "Getting there", value: "On foot from Rådhusplassen or Kongens gate" },
          { label: "Step-free access", value: "Partial; cobblestones and steep sections inside the walls" },
          { label: "Toilets", value: "At the visitor centre" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "En borg i endring",
          text: "Du står ved Akershus festning. Borgen ble reist rundt år 1300 under kong Håkon den femte for å verne byen fra sjøsiden. På 1600-tallet lot Christian den fjerde bygge den om til et renessanseslott, og siden har festningen skiftet rolle mange ganger: fra kongebolig til fengsel, og i dag til et åpent parkområde midt i hovedstaden.",
          estimatedDurationS: 35,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text: "Foran deg, på en høyde mot fjorden, reiser det seg tykke murer i grå naturstein. Over murene ser du slottets lyse tårn med spisse, mørke tak. Til venstre går en brosteinsvei skrått oppover mot porten. Til høyre, mellom trærne, glitrer fjorden. Trærne langs muren er høye og gir skygge over stien.",
          estimatedDurationS: 30,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "A fortress in flux",
          text: "You are standing by Akershus Fortress. The castle was built around the year 1300 under King Haakon the Fifth to protect the city from the sea. In the 17th century, Christian the Fourth had it rebuilt as a renaissance palace, and since then the fortress has changed roles many times: from royal residence to prison, and today to an open park in the middle of the capital.",
          estimatedDurationS: 35,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text: "In front of you, on a rise above the fjord, thick walls of grey natural stone rise up. Above the walls you see the pale towers of the castle with steep, dark roofs. To your left a cobbled road climbs at an angle towards the gate. To your right, between the trees, the fjord glitters. The trees along the wall are tall and shade the path.",
          estimatedDurationS: 30,
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
    sourceNote: SOURCE_NOTE,
    translations: {
      nb: {
        title: "Christiania torv",
        subtitle: "Her skal byen ligge",
        summary:
          "Torget markerer sentrum i byen Christian den fjerde grunnla i 1624, etter at det gamle Oslo brant. Skulpturen av en hanske som peker mot bakken minner om kongens ord.",
        locationLabel: OSLO_NB,
        heroImageAlt: null,
        practicalInfo: [
          { label: "Adkomst", value: "Åpent torg, tilgjengelig hele døgnet" },
          { label: "Trinnfri tilgang", value: "Ja, men brostein" },
        ],
      },
      en: {
        title: "Christiania Square",
        subtitle: "The city shall lie here",
        summary:
          "The square marks the centre of the city Christian the Fourth founded in 1624 after old Oslo burned. The sculpture of a glove pointing at the ground recalls the king's words.",
        locationLabel: OSLO_EN,
        heroImageAlt: null,
        practicalInfo: [
          { label: "Getting there", value: "Open square, accessible around the clock" },
          { label: "Step-free access", value: "Yes, but cobblestones" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Her skal byen ligge",
          text: "Da Oslo brant i 1624, bestemte Christian den fjerde at byen skulle bygges opp igjen her, i ly av festningen, med rette gater i et rutenett. Det er derfor bydelen heter Kvadraturen. Torget du står på var den nye byens midtpunkt.",
          estimatedDurationS: 25,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text: "Du står på et lite, brosteinsbelagt torg omgitt av lave bygårder i to og tre etasjer. Midt på torget står en høy, mørk skulptur av en hanske som peker ned mot bakken. Gatene går rett ut fra torget i fire retninger.",
          estimatedDurationS: 20,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "The city shall lie here",
          text: "When Oslo burned in 1624, Christian the Fourth decided the city should be rebuilt here, sheltered by the fortress, with straight streets in a grid. That is why the district is called Kvadraturen, the quadrature. The square you are standing on was the centre of the new city.",
          estimatedDurationS: 25,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text: "You are standing on a small cobbled square surrounded by low buildings of two and three storeys. In the middle of the square stands a tall, dark sculpture of a glove pointing down at the ground. Streets lead straight out of the square in four directions.",
          estimatedDurationS: 20,
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
    sourceNote: `${SOURCE_NOTE} Ligger inntil Christiania torv og brukes til å teste overlappende radiuser og prioritet.`,
    translations: {
      nb: {
        title: "Gamle rådhus",
        subtitle: "Byens første rådhus",
        summary: "Bygningen fra 1641 var Christianias første rådhus og er i dag restaurant.",
        locationLabel: OSLO_NB,
        heroImageAlt: null,
        practicalInfo: [{ label: "Adkomst", value: "Sees fra Christiania torv" }],
      },
      en: {
        title: "The Old Town Hall",
        subtitle: "The city's first town hall",
        summary: "The building from 1641 was Christiania's first town hall and is a restaurant today.",
        locationLabel: OSLO_EN,
        heroImageAlt: null,
        practicalInfo: [{ label: "Getting there", value: "Visible from Christiania Square" }],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Byens første rådhus",
          text: "Det lave, gule huset på hjørnet er byens eldste rådhus, bygget i 1641. Her møttes byens styre i over hundre år.",
          estimatedDurationS: 15,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "The city's first town hall",
          text: "The low, yellow house on the corner is the city's oldest town hall, built in 1641. The city council met here for more than a hundred years.",
          estimatedDurationS: 15,
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
    sourceNote: SOURCE_NOTE,
    translations: {
      nb: {
        title: "Oslo Børs",
        subtitle: "Handelens hus",
        summary: "Børsbygningen fra 1828, tegnet av Christian Heinrich Grosch, er blant de eldste offentlige bygningene i byen.",
        locationLabel: OSLO_NB,
        heroImageAlt: null,
        practicalInfo: [{ label: "Adkomst", value: "Sees fra Tollbugata; hagen foran er åpen" }],
      },
      en: {
        title: "Oslo Stock Exchange",
        subtitle: "House of trade",
        summary: "The exchange building from 1828, designed by Christian Heinrich Grosch, is among the oldest public buildings in the city.",
        locationLabel: OSLO_EN,
        heroImageAlt: null,
        practicalInfo: [{ label: "Getting there", value: "Visible from Tollbugata; the garden in front is open" }],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Handelens hus",
          text: "Bygningen foran deg ble tegnet av arkitekten Christian Heinrich Grosch og sto ferdig i 1828, som et av de første store offentlige byggene i den unge hovedstaden.",
          estimatedDurationS: 18,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "House of trade",
          text: "The building in front of you was designed by the architect Christian Heinrich Grosch and completed in 1828, one of the first large public buildings in the young capital.",
          estimatedDurationS: 18,
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
    sourceNote: SOURCE_NOTE,
    translations: {
      nb: {
        title: "Bankplassen",
        subtitle: "Fra seddelpresse til arkitektur",
        summary: "Plassen har navn etter Norges Banks gamle bygning fra 1830, som i dag huser Nasjonalmuseet – Arkitektur.",
        locationLabel: OSLO_NB,
        heroImageAlt: null,
        practicalInfo: [
          { label: "Åpningstider", value: "Museet: sjekk nasjonalmuseet.no" },
          { label: "Trinnfri tilgang", value: "Museet har trinnfri inngang" },
        ],
      },
      en: {
        title: "Bankplassen",
        subtitle: "From banknotes to architecture",
        summary: "The square is named after the old Bank of Norway building from 1830, which today houses the National Museum – Architecture.",
        locationLabel: OSLO_EN,
        heroImageAlt: null,
        practicalInfo: [
          { label: "Opening hours", value: "Museum: see nasjonalmuseet.no" },
          { label: "Step-free access", value: "The museum has a step-free entrance" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Fra seddelpresse til arkitektur",
          text: "Den lyse, klassisistiske bygningen på plassen var Norges Banks hovedsete fra 1830. I dag er den arkitekturmuseum, med en glasspaviljong av Sverre Fehn i bakgården.",
          estimatedDurationS: 18,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "From banknotes to architecture",
          text: "The pale, classicist building on the square was the head office of the Bank of Norway from 1830. Today it is the architecture museum, with a glass pavilion by Sverre Fehn in the courtyard.",
          estimatedDurationS: 18,
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
    sourceNote: `${SOURCE_NOTE} Stor radius i åpent landskap for å teste utløsning på havnepromenaden.`,
    translations: {
      nb: {
        title: "Operaen",
        subtitle: "Et tak du kan gå på",
        summary: "Operahuset i Bjørvika åpnet i 2008, tegnet av Snøhetta. Taket av hvit marmor skråner ned i fjorden og er åpent for alle.",
        locationLabel: OSLO_NB,
        heroImageAlt: null,
        practicalInfo: [
          { label: "Åpningstider", value: "Taket er åpent hele døgnet; foajeen har egne tider" },
          { label: "Trinnfri tilgang", value: "Slake ramper opp på taket; foajeen er trinnfri" },
          { label: "Toalett", value: "I foajeen" },
        ],
      },
      en: {
        title: "The Opera House",
        subtitle: "A roof you can walk on",
        summary: "The opera house in Bjørvika opened in 2008, designed by Snøhetta. Its roof of white marble slopes down into the fjord and is open to everyone.",
        locationLabel: OSLO_EN,
        heroImageAlt: null,
        practicalInfo: [
          { label: "Opening hours", value: "The roof is open around the clock; the foyer has its own hours" },
          { label: "Step-free access", value: "Gentle ramps lead up onto the roof; the foyer is step-free" },
          { label: "Toilets", value: "In the foyer" },
        ],
      },
    },
    scripts: {
      nb: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Et tak du kan gå på",
          text: "Operahuset åpnet i 2008 og er tegnet av arkitektkontoret Snøhetta. Ideen var et hus som reiser seg fra fjorden som et isflak, med et tak alle kan gå på, uansett om de har billett eller ikke.",
          estimatedDurationS: 22,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Slik ser det ut",
          text: "Foran deg skråner en enorm flate av hvit marmor jevnt opp fra vannkanten. Flaten er brutt av en høy vegg i glass, og bak glasset skimter du et lyst treverk i eik. Til høyre ligger fjorden, til venstre nyere bygårder i glass og stål.",
          estimatedDurationS: 22,
        },
      ],
      en: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "A roof you can walk on",
          text: "The opera house opened in 2008 and was designed by the architecture firm Snøhetta. The idea was a building that rises from the fjord like an ice floe, with a roof anyone can walk on, ticket or not.",
          estimatedDurationS: 22,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "What you see",
          text: "In front of you an enormous surface of white marble slopes evenly up from the water's edge. The surface is broken by a tall wall of glass, and behind the glass you glimpse pale oak woodwork. To your right lies the fjord, to your left newer buildings of glass and steel.",
          estimatedDurationS: 22,
        },
      ],
    },
  },
];
