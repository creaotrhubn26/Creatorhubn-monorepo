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
 * dokumentet. Lydfiler lages separat (reiseguide:audio); bilder, se «Bilder»
 * under.
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
 *
 * Spørsmål underveis (pakke 3, 23.09.2026, 0662_reiseguide_chapter_prompts.sql):
 * ett «Se opp»-kort (look) og ett gjettespørsmål (guess) per sted og språk i
 * DEMO_CHAPTER_PROMPTS. Alt bygger bare på fortellingen i samme kapittel (ingen
 * nye fakta); feil svaralternativer er åpenbart feil, ikke påstander. look
 * ligger rett etter setningen som nevner det man skal se etter, guess rett før
 * setningen som gir svaret. atFraction er andel av manusteksten (tegn), som er
 * det den anslåtte tekstingen også fordeler tiden etter.
 *
 * Bilder (23.09.2026, 0663_reiseguide_hero_image_credit.sql): heltebildene
 * hentes fra Wikimedia Commons med fri lisens (CC0, public domain, CC BY /
 * CC BY-SA 2.0–4.0) av scripts/reiseguide-commons-images.ts, ut fra
 * DEMO_HERO_IMAGES nederst. Alt-teksten (heroImageAlt) er med vilje kort og
 * nøktern («Foto av …»): ingen har sett bildet som velges, så den skal ikke
 * påstå detaljer. Seeden skriver alt-teksten; bildet og krediteringen skrives
 * bare av Commons-scriptet.
 *
 * Flere områder (24.09.2026): DEMO_AREAS samler Oslo (denne filen), Lørenskog
 * (reiseguide-demo-data-lorenskog.ts) og Nesoddtangen
 * (reiseguide-demo-data-nesoddtangen.ts). DEMO_POIS er alle stedene flatt, og
 * DEMO_CHAPTER_PROMPTS og DEMO_HERO_IMAGES dekker alle områdene. Id-er og
 * slugger er unike på tvers av områdene (slug er UNIQUE i guide_pois).
 *
 * Dansk (da, 25.09.2026): tredje språk ved siden av nb og en, for alle
 * områdene. Oversatt fra de norske manusene uten nye fakta, med omtrent samme
 * antall setninger (så tekstingen deler seg likt). Egennavn står på norsk.
 * Varighet anslått fra ordtall med 145 ord/min, som nb. «Se opp»-kortene
 * begynner med «Se op: ». Samme utkast-status som resten; bør leses av en
 * dansk morsmålsbruker før felttest.
 */

import {
  LORENSKOG_AREA_INFO,
  LORENSKOG_CHAPTER_PROMPTS,
  LORENSKOG_HERO_IMAGES,
  LORENSKOG_POIS,
} from "./reiseguide-demo-data-lorenskog.js";
import {
  NESODDTANGEN_AREA_INFO,
  NESODDTANGEN_CHAPTER_PROMPTS,
  NESODDTANGEN_HERO_IMAGES,
  NESODDTANGEN_POIS,
} from "./reiseguide-demo-data-nesoddtangen.js";

export type DemoLang = "nb" | "en" | "da";

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
  /** Kort quiz etter besøket (0641): tre spørsmål per språk, fakta fra manuset. */
  quiz: Record<DemoLang, DemoQuizQuestion[]>;
}

/** Oslo-området (det første). Stedene ligger i OSLO_POIS; alle områdene er i DEMO_AREAS. */
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
  { id: "museum", sortOrder: 1, labels: { nb: "Museum", en: "Museum", da: "Museum" } },
  { id: "historisk", sortOrder: 2, labels: { nb: "Historiske", en: "Historic", da: "Historiske" } },
  { id: "natur", sortOrder: 3, labels: { nb: "Natur", en: "Nature", da: "Natur" } },
  { id: "arkitektur", sortOrder: 4, labels: { nb: "Arkitektur", en: "Architecture", da: "Arkitektur" } },
];

const OSLO_POIS: DemoPoi[] = [
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
        heroImageAlt: "Foto av Akershus festning",
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
        heroImageAlt: "Photo of Akershus Fortress",
        practicalInfo: [
          { label: "Fortress grounds", value: "Open daily 06:00–21:00, free" },
          { label: "Akershus Castle", value: "May–Aug Mon–Sat 10–16, Sun 12–16; Sept–Apr Sat–Sun 12–17" },
          { label: "Museums", value: "Armed Forces Museum daily 10–16; Resistance Museum 10–16 (10–17 May–Aug)" },
          { label: "Step-free access", value: "Partial; cobblestones and steep sections inside the walls" },
          { label: "Toilets", value: "At the visitor centre (daily 10–17)" },
        ],
      },
      da: {
        title: "Akershus festning",
        subtitle: "Borgen der aldrig faldt",
        summary:
          "Håkon den Femte begyndte på borgen omkring år 1300. Den har modstået ni belejringer uden at blive indtaget, blev Christian den Fjerdes renæssanceslot, siden fængsel, og i dag er området åbent for alle.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: "Foto af Akershus festning",
        practicalInfo: [
          { label: "Fæstningsområdet", value: "Åbent dagligt 06–21, gratis" },
          { label: "Akershus slot", value: "Maj–august man–lør 10–16, søn 12–16; september–april lør–søn 12–17" },
          { label: "Museer", value: "Forsvarsmuseet dagligt 10–16, Hjemmefrontmuseet 10–16 (10–17 maj–august)" },
          { label: "Niveaufri adgang", value: "Delvis; brosten og stejle partier inden for murene" },
          { label: "Toilet", value: "Ved besøgscentret (dagligt 10–17)" },
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
      da: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Borgen der aldrig faldt",
          text:
            "Du står ved Akershus festning, Norges vigtigste borg. Kong Håkon den Femte begyndte at bygge her omkring år 1300, på en klippe, hvor byen kunne forsvares fra søsiden. Allerede i 1308 modstod borgen et svensk angreb, og siden er den blevet belejret ni gange uden at blive indtaget. I 1567, under Den Nordiske Syvårskrig, brændte slotsherren Christen Munk hele byen ned, for at svenskerne ikke skulle finde mad og ly. Efter 39 dage gav de op. Skrækken fra den belejring førte til, at borgen fik sine første moderne bastioner, de lave, skrå volde af jord og sten, som du ser omkring dig.\n\nDet slot, der rejser sig inden for murene i dag, er alligevel mest Christian den Fjerdes værk. Tidligt i 1600-tallet lod han den mørke middelalderborg bygge om til et lyst renæssanceslot med de to trappetårne Blåtårnet og Romerikstårnet. Sidste gang nogen forsøgte, var i 1716, da den svenske konge Karl den Tolvte selv ledede belejringen. Han holdt byen i seks uger, men gav op, efter at Tordenskiold sænkede hans forsyningsflåde i Dynekilen.",
          estimatedDurationS: 72,
        },
        {
          kind: "narration",
          chapterNo: 2,
          title: "Fængsel, krig og frihed",
          text:
            "Da fæstningen mistede sin militære betydning, blev den fængsel. Fra 1739 til 1950 sad straffefanger her, først i det, der blev kaldt Slaveriet, hvor fangerne huggede sten i tunge lænker og sov i fællessale. Mange af dem blev dygtige stenhuggere, og meget af granitten i byen omkring dig er hugget af fanger herfra.\n\nUnder Anden Verdenskrig overtog den tyske besættelsesmagt fæstningen og brugte den som fængsel for modstandsfolk. Efter befrielsen i 1945 blev Vidkun Quisling, lederen af Nasjonal Samling, dømt for landsforræderi og skudt her natten til den 24. oktober. Flere andre, der var dømt for landsforræderi, blev også henrettet på fæstningen.\n\nI dag rummer området Forsvarsmuseet og Hjemmefrontmuseet, som fortæller netop denne historie. I slottet ligger det kongelige mausoleum, hvor kong Haakon den Syvende og dronning Maud hviler, og staten bruger stadig salene til festmiddage. Resten af tiden er fæstningen din: en park med kanoner, mure og byens bedste udsigt over fjorden.",
          estimatedDurationS: 63,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Sådan ser det ud",
          text:
            "Du står på en høj over fjorden, mellem lave volde af græs og grå kampesten. Foran dig rejser slottet sig: lyse, pudsede mure med to slanke tårne, der har spidse, mørke tage. Til venstre går en brostensbelagt vej skråt op mod slotsporten, med en høj mur på hver side. Til højre, over et lavt brystværn, ligger fjorden. Der ser du Aker Brygge, det grå Rådhus med sine to firkantede tårne, og længere ude havnen. På volden foran brystværnet står to gamle kanoner af mørk bronze, rettet mod vandet. Træerne omkring dig er høje lindetræer, der giver skygge over stien.",
          estimatedDurationS: 41,
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
      da: [
        {
          question: "Hvor mange gange er Akershus festning blevet belejret uden at blive indtaget?",
          options: ["Tre gange", "Ni gange", "Fjorten gange"],
          correctIndex: 1,
          explanation: "Ni belejringer, den sidste i 1716, da Karl den Tolvte selv ledede svenskerne.",
        },
        {
          question: "Hvilken konge byggede middelalderborgen om til et renæssanceslot?",
          options: ["Håkon den Femte", "Christian den Fjerde", "Karl den Tolvte"],
          correctIndex: 1,
          explanation: "Christian den Fjerde gav borgen lyse mure og tårnene Blåtårnet og Romerikstårnet tidligt i 1600-tallet.",
        },
        {
          question: "Hvad blev fæstningen brugt til fra 1739 til 1950?",
          options: ["Kongelig bolig", "Fængsel", "Universitet"],
          correctIndex: 1,
          explanation: "I «Slaveriet» huggede fangerne sten i lænker; meget af granitten i byen er hugget her.",
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
        heroImageAlt: "Foto av Christiania torv",
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
        heroImageAlt: "Photo of Christiania Square",
        practicalInfo: [
          { label: "Getting there", value: "Open square, accessible around the clock" },
          { label: "Step-free access", value: "Yes, but stone paving" },
          { label: "Food and drink", value: "Café Celsius and Gamle Raadhus are on the square; check their own opening hours" },
        ],
      },
      da: {
        title: "Christiania torv",
        subtitle: "Her skal byen ligge",
        summary:
          "Da Oslo brændte i 1624, flyttede Christian den Fjerde byen hertil, i ly af fæstningen, og gav den sit eget navn. Torvet var den nye bys første, og handsken i bronze minder om kongens ord.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: "Foto af Christiania torv",
        practicalInfo: [
          { label: "Adgang", value: "Åbent torv, tilgængeligt hele døgnet" },
          { label: "Niveaufri adgang", value: "Ja, men belægningen er af sten" },
          { label: "Mad og drikke", value: "Kafé Celsius og Gamle Raadhus ligger ved torvet, tjek deres egne åbningstider" },
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
      da: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Her skal byen ligge",
          text:
            "Natten til den 17. august 1624 begyndte det at brænde i Oslo, og på tre dage var næsten hele byen væk. Byen lå dengang på den anden side af Bjørvika, hvor Gamlebyen ligger i dag. Kong Christian den Fjerde kom selv op fra København, og han besluttede, at byen ikke skulle genopføres, hvor den stod. Den skulle flyttes hertil, ind under kanonerne på Akershus, og den skulle hedde Christiania, efter ham selv. Sagnet siger, at han pegede ned mod jorden, lige her, og sagde: «Her skal byen ligge.» Handsken i bronze, der står midt på torvet, lavet af Wenche Gulbrandsen i 1997, er byens tak for den pegende finger. Den samme handske holder kongen i hånden på sin statue på Stortorvet.\n\nDen nye by blev tegnet med lineal. Gaderne skulle krydse hinanden i rette vinkler og være brede nok til, at ilden ikke kunne springe fra hus til hus. Derfor hedder bydelen Kvadraturen. Kongen indførte også murtvang: inden for bymuren skulle alle bygge i mursten eller sten, og de, der ikke havde råd, måtte nøjes med bindingsværk fyldt med mursten. Torvet, du står på, var den nye bys første, med byens første kirke fra 1639 og rådhuset fra 1641 lige i nærheden. Rådmannsgården på hjørnet, med murankre, der viser årstallet 1626, er formentlig den ældste murede bygning, der er tilbage fra Christian den Fjerdes by. Den blev senere garnisonshospital, og naboen Anatomigården husede universitetets første dissektionssal.",
          estimatedDurationS: 98,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Sådan ser det ud",
          text:
            "Du står på et lille, brostensbelagt torv omgivet af lave bygninger i to og tre etager. Midt på torvet, på en lille hævet ø, står en stor hånd i mørk bronze, formet som en handske, med pegefingeren rettet ned mod jorden. Rundt om hånden er der et lavt bassin i granit. Til den ene side ligger en bred bygning i rødlige mursten med hvide vinduesrammer; der er en café med borde udenfor. På hjørnet skråt over for står en lys, pudset bygning med stejlt tag af mørke, blanke tagsten. Det er Gamle rådhus. Gaderne går lige ud fra torvet i alle fire retninger.",
          estimatedDurationS: 43,
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
      da: [
        {
          question: "Hvad skete der i 1624, som fik byen til at flytte hertil?",
          options: ["En stor oversvømmelse", "En bybrand", "Et svensk angreb"],
          correctIndex: 1,
          explanation: "Branden natten til den 17. august 1624 tog næsten hele byen på tre dage.",
        },
        {
          question: "Hvad peger bronzehandsken midt på torvet på?",
          options: ["Mod fæstningen", "Ned mod jorden, hvor byen skulle ligge", "Mod fjorden"],
          correctIndex: 1,
          explanation: "Sagnet siger, at kongen pegede ned og sagde: «Her skal byen ligge.» Handsken er lavet af Wenche Gulbrandsen i 1997.",
        },
        {
          question: "Hvorfor hedder bydelen Kvadraturen?",
          options: ["Gaderne krydser hinanden i rette vinkler", "Bymuren havde fire porte", "Torvet er helt kvadratisk"],
          correctIndex: 0,
          explanation: "Byen blev tegnet med lineal, med brede gader, så ilden ikke kunne springe fra hus til hus.",
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
        heroImageAlt: "Foto av Gamle rådhus",
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
        heroImageAlt: "Photo of the Old Town Hall",
        practicalInfo: [
          { label: "Address", value: "Nedre Slottsgate 1, on the corner of Christiania torv" },
          { label: "Restaurant and stage", value: "Gamle Raadhus; check opening hours at gamleraadhus.no" },
          { label: "Step-free access", value: "Not confirmed; ask the restaurant" },
        ],
      },
      da: {
        title: "Gamle rådhus",
        subtitle: "Byens første rådhus",
        summary:
          "Huset fra 1641 var Christianias rådhus i næsten hundrede år. Siden har det været kirke, fængsel, Højesteret og teatermuseum, og i dag serveres der lutefisk i de gamle celler.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: "Foto af Gamle rådhus",
        practicalInfo: [
          { label: "Adresse", value: "Nedre Slottsgate 1, på hjørnet af Christiania torv" },
          { label: "Restaurant og scene", value: "Gamle Raadhus, tjek åbningstider på gamleraadhus.no" },
          { label: "Niveaufri adgang", value: "Ikke bekræftet, spørg restauranten" },
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
      da: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Byens første rådhus",
          text:
            "Det lyse hus på hjørnet er byens ældste rådhus. Vicestatholder Lauritz Hansen lod det bygge i 1641, med penge fra Christian den Fjerde selv, kun sytten år efter at byen blev grundlagt. I to etager, med pudsede murvægge, høje gavle og et stejlt tag af sortglaserede tagsten, var det et af de flotteste huse i den nye by. Her mødtes byens råd, her blev der afsagt domme, og i kælderen sad de dømte og ventede.\n\nRådhus var det indtil 1733. Så begyndte et langt og broget liv. Huset var brandstation, i en kort periode kirke, privatbolig og fængsel. Fra 1815 til 1846 holdt Norges Højesteret til her, i det unge lands første årtier med egen grundlov. Frimurerne havde loge her, og i 1700-tallet forsvandt både trappetårnet og gavlene, før de høje renæssancegavle blev genskabt i 1900-tallet, sådan som du ser dem i dag.\n\nI 1856 flyttede restauratøren Matheus Helseth ind i stueetagen, og siden er der blevet serveret mad i huset. Gamle Raadhus er i dag mest kendt for sin lutefisk, lavet af håndskåret tørfisk fra Værøy i Lofoten, og de gamle fængselsceller i kælderen er blevet til vinkælder og selskabslokale. På første sal holdt Teatermuseet til fra 1981 til 2008, og nu bruges salen til koncerter og forestillinger. En brand i 1996 gjorde stor skade, men huset blev sat i stand igen af byen, som ejer det.",
          estimatedDurationS: 94,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Sådan ser det ud",
          text:
            "Foran dig, på hjørnet mellem torvet og gaden, står en bygning i to etager med lyse, pudsede murvægge. Taget er stejlt og dækket af mørke, blanke tagsten, og mod torvet rejser der sig en høj, trappet gavl med små blændingsvinduer. Vinduerne i etagerne er små og mange, med hvide sprosser. Ved indgangen fra gaden hænger et skilt med navnet Gamle Raadhus, og om sommeren står der borde og stole på fortovet. Til højre for huset fortsætter Rådhusgata væk fra torvet, og til venstre går Nedre Slottsgate op mod fæstningen.",
          estimatedDurationS: 37,
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
      da: [
        {
          question: "Hvilket år blev Gamle rådhus bygget?",
          options: ["1624", "1641", "1733"],
          correctIndex: 1,
          explanation: "Vicestatholder Lauritz Hansen lod det bygge i 1641, kun sytten år efter at byen blev grundlagt.",
        },
        {
          question: "Hvilken institution holdt til i huset fra 1815 til 1846?",
          options: ["Stortinget", "Højesteret", "Norges Bank"],
          correctIndex: 1,
          explanation: "Norges Højesteret holdt til her i det unge lands første årtier med egen grundlov.",
        },
        {
          question: "Hvad er restauranten Gamle Raadhus mest kendt for?",
          options: ["Lutefisk", "Pinnekjøtt", "Fårikål"],
          correctIndex: 0,
          explanation: "Lutefisken laves af håndskåret tørfisk fra Værøy i Lofoten, og de gamle celler er blevet til vinkælder.",
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
        heroImageAlt: "Foto av Oslo Børs",
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
        heroImageAlt: "Photo of the Oslo Stock Exchange",
        practicalInfo: [
          { label: "Getting there", value: "Børshagen is a public park; the building itself is offices and not open to visitors" },
          { label: "Step-free access", value: "The park has gravel paths without steps" },
        ],
      },
      da: {
        title: "Oslo Børs",
        subtitle: "Handelens hus",
        summary:
          "Christian Heinrich Grosch tegnede børsbygningen i streng empirestil i 1826–1828. Selve børsen er ældre: den første handelsdag var den 15. april 1819, dengang med varer, ikke aktier.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: "Foto af Oslo Børs",
        practicalInfo: [
          { label: "Adgang", value: "Børshagen er en åben park; selve bygningen rummer kontorer og er ikke åben for publikum" },
          { label: "Niveaufri adgang", value: "Parken har grusstier uden trin" },
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
      da: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Handelens hus",
          text:
            "Bygningen foran dig er Oslo Børs, tegnet af Christian Heinrich Grosch og opført mellem 1826 og 1828. Grosch var egentlig assistent for slotsarkitekten Linstow, men da Stortinget i 1827 nægtede at bevilge penge til Slottet, stod han pludselig uden opgaver, og købmanden Thor Olsen gav ham opdraget. Resultatet blev et af de første monumentalbyggerier i den unge hovedstad: streng empirestil, doriske søjler og rolige, symmetriske proportioner. Det oprindelige hus var kun én etage på en høj kælder, omtrent en tredjedel af det, du ser i dag. Sidefløjene og sydfløjen kom til i 1909 og 1910, tegnet af Carl Michalsen i samme stil.\n\nSelve børsen er ældre end huset. Den blev oprettet ved lov i 1818, og den første handelsdag var den 15. april 1819. Dengang var det varer, der blev handlet, ikke aktier. Værdipapirbørs blev den først i 1881, med 16 obligationslån og 23 aktier på listen, blandt dem Norges Bank. I dag hedder den Euronext Oslo Børs, og handlen foregår elektronisk, men bygningen er stadig børsens hjem.\n\nForan indgangen står Merkur, handelens gud, i bronze på et springvand med fire løvehoveder. Han blev givet af grosserer Conrad Langaard, da tilbygningen blev indviet i 1911. Parken, du står i, Børshagen, er endnu ældre end børsen. Den blev anlagt lige efter 1800 og er et af landets første offentlige parkanlæg.",
          estimatedDurationS: 91,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Sådan ser det ud",
          text:
            "Du står i Børshagen, en lille park med grusstier, høje løvtræer og bænke. Lige foran dig, bag springvandet med Merkur-figuren, ligger børsbygningen: en lav, bred bygning i to etager over en høj sokkel, i en lys, varm gul farve med hvide detaljer. Midt på facaden bærer kraftige, glatte søjler en trekantet gavl. Vinduerne er høje og står i jævne rækker. På hver side strækker fløjene sig ud og rammer parken ind. Bag dig ligger Tollbugata, og til højre skimter du husene i Kvadraturen.",
          estimatedDurationS: 34,
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
      da: [
        {
          question: "Hvem tegnede børsbygningen?",
          options: ["Christian Heinrich Grosch", "Sverre Fehn", "Ingvar Hjorth"],
          correctIndex: 0,
          explanation: "Grosch fik opdraget i 1827, da Stortinget nægtede at bevilge penge til Slottet, som han egentlig arbejdede på.",
        },
        {
          question: "Hvad blev der handlet på børsen den første handelsdag i 1819?",
          options: ["Aktier", "Varer", "Obligationer"],
          correctIndex: 1,
          explanation: "Værdipapirbørs blev den først i 1881, med 16 obligationslån og 23 aktier på listen.",
        },
        {
          question: "Hvilken gud står i bronze på springvandet foran indgangen?",
          options: ["Thor", "Merkur", "Neptun"],
          correctIndex: 1,
          explanation: "Merkur, handelens gud, blev givet af grosserer Conrad Langaard i 1911.",
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
        heroImageAlt: "Foto av Bankplassen",
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
        heroImageAlt: "Photo of Bankplassen",
        practicalInfo: [
          { label: "Getting there", value: "Open square, accessible around the clock" },
          { label: "Step-free access", value: "The square is flat but cobbled" },
          { label: "Museum", value: "The National Museum – Architecture; check opening hours at nasjonalmuseet.no" },
        ],
      },
      da: {
        title: "Bankplassen",
        subtitle: "Tre banker og en café",
        summary:
          "Norges Bank har haft tre huse omkring denne plads: Grosch-bygningen fra 1828, jugendpaladset fra 1906 og det nuværende hovedsæde fra 1986. På hjørnet ligger Engebret Café, byens ældste restaurant.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: "Foto af Bankplassen",
        practicalInfo: [
          { label: "Adgang", value: "Åben plads, tilgængelig hele døgnet" },
          { label: "Niveaufri adgang", value: "Pladsen er flad, men brostensbelagt" },
          { label: "Museum", value: "Nasjonalmuseet – Arkitektur, tjek åbningstider på nasjonalmuseet.no" },
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
      da: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Tre banker og en café",
          text:
            "Pladsen hedder Bankplassen, fordi Norges Bank flyttede ind her. Den første bankbygning står der stadig: den lave, klassicistiske bygning fra 1828, tegnet af Christian Heinrich Grosch, samme arkitekt som Børsen et stenkast herfra. Da banken voksede ud af huset, udskrev den en arkitektkonkurrence. Ingvar Hjorth vandt i 1900, og i 1906 stod det nye hovedsæde færdigt på den anden side af pladsen: et tungt palads i hugget norsk granit og marmor, rigt dekoreret i jugendstil. Hjorth tegnede også store dele af interiøret og møblerne, og bygningen regnes for et samlet kunstværk. Den er fredet.\n\nI 1986 flyttede Norges Bank ind i sit tredje hus på pladsen, det moderne hovedsæde, som stadig er i brug. Siden har de to gamle huse levet videre som museer. Grosch-bygningen blev Arkitekturmuseet, og i 2008 fik den en ny pavillon i glas og rå beton af Sverre Fehn, den eneste norske arkitekt, der har vundet Pritzker-prisen. Hjorths granitpalads husede Museet for samtidskunst fra 1990 til 2017, da samlingen flyttede til det nye Nasjonalmuseet ved Vestbanen.\n\nPå hjørnet af pladsen ligger Engebret Café, åbnet i 1857 og byens ældste restaurant. Skuespillerne fra Christiania Theater havde den som stamsted, og Ibsen, Bjørnson, Grieg og Munch kom der fast. Grieg havde sine egne kaffekopper her, og Munchs bord er stadig det mest eftertragtede.",
          estimatedDurationS: 89,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Sådan ser det ud",
          text:
            "Du står på en åben, brostensbelagt plads omgivet af store stenbygninger. Midt på pladsen står et rundt springvand med bænke omkring. På den ene side rejser Norges Banks gamle hovedsæde fra 1906 sig: tre høje etager i lysegrå, groft tilhugget granit, med tunge buer over indgangen og små tårne oppe på taget. Lige over for ligger den lave, lyse bygning fra 1828 med rolige, klassiske former, og op ad den en pavillon af glas og beton. På hjørnet, i en ældre ejendom med lys facade, hænger skiltet til Engebret Café. Træerne langs kanten af pladsen er unge og smalle.",
          estimatedDurationS: 41,
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
      da: [
        {
          question: "Hvor mange huse har Norges Bank haft omkring Bankplassen?",
          options: ["Et", "To", "Tre"],
          correctIndex: 2,
          explanation: "Grosch-bygningen fra 1828, jugendpaladset fra 1906 og det nuværende hovedsæde fra 1986.",
        },
        {
          question: "Hvem tegnede pavillonen i glas og beton ved Arkitekturmuseet?",
          options: ["Snøhetta", "Sverre Fehn", "Ingvar Hjorth"],
          correctIndex: 1,
          explanation: "Sverre Fehn, den eneste norske arkitekt, der har vundet Pritzker-prisen, tegnede pavillonen fra 2008.",
        },
        {
          question: "Hvilket år åbnede Engebret Café?",
          options: ["1857", "1906", "1986"],
          correctIndex: 0,
          explanation: "Byens ældste restaurant; Ibsen, Bjørnson, Grieg og Munch kom der fast.",
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
        heroImageAlt: "Foto av Operaen",
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
        heroImageAlt: "Photo of the Oslo Opera House",
        practicalInfo: [
          { label: "The roof", value: "Open around the clock, free, no ticket needed" },
          { label: "Foyer and toilets", value: "Check today's opening hours at operaen.no" },
          { label: "Step-free access", value: "Step-free entrance, lift and accessible toilet inside; the roof ramps are sloped but have no steps" },
          { label: "Getting there", value: "A five-minute walk from Oslo Central Station" },
        ],
      },
      da: {
        title: "Operaen",
        subtitle: "Et tag, du kan gå på",
        summary:
          "Snøhettas operahus åbnede den 12. april 2008. Taget af hvid marmor rejser sig direkte op af fjorden og er åbent for alle, døgnet rundt og uden billet.",
        locationLabel: "Oslo, Norge",
        heroImageAlt: "Foto af Operaen",
        practicalInfo: [
          { label: "Taget", value: "Åbent hele døgnet, gratis, ingen billet" },
          { label: "Foyer og toiletter", value: "Tjek dagens åbningstider på operaen.no" },
          { label: "Niveaufri adgang", value: "Niveaufri indgang, elevator og handicaptoilet indenfor; tagramperne er skrå, men uden trin" },
          { label: "Adgang", value: "5 minutters gang fra Oslo S" },
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
      da: [
        {
          kind: "narration",
          chapterNo: 1,
          title: "Et bjerg af marmor",
          text:
            "Foran dig ligger Operaen, hjemsted for Den Norske Opera & Ballett. Bygningen blev tegnet af den norske tegnestue Snøhetta og åbnede den 12. april 2008. Idéen var enkel og dristig: et hus, du kan gå på. Taget er en skrå flade af hvid italiensk marmor, der rejser sig direkte op af fjorden, som en isflage eller en gletsjer. Marmoren, af typen La Facciata, blev valgt, fordi den bevarer sit lys og sin farve, også når den er våd. Tilsammen dækker den omkring 20 000 kvadratmeter, tag og foyer i ét, så byens gulv fortsætter helt op på huset.\n\nBag marmoren rejser scenetårnet sig, beklædt med aluminiumsplader med et mønster skabt af tekstilkunstnerne Astrid Løvaas og Kirsten Wagle, inspireret af gamle vævemønstre. Inde i foyeren bølger en væg af eg rundt om hovedsalen, og bag garderoberne lyser Olafur Eliassons «Den anden væg». Prisen endte på omkring 4,4 milliarder norske kroner. Året efter åbningen fik bygningen EU's arkitekturpris, Mies van der Rohe-prisen, og den er i dag et af Norges mest besøgte bygningsværker.",
          estimatedDurationS: 71,
        },
        {
          kind: "narration",
          chapterNo: 2,
          title: "Taget og fjorden",
          text:
            "Taget er åbent for alle, hele døgnet, uden billet. Gå op ad skråningerne, så får du udsigt over Bjørvika, fjorden og byen. Ude i vandet, lige foran huset, flyder «She Lies» af Monica Bonvicini: en skulptur i stål og glas, tolv meter høj, som drejer langsomt med tidevandet. Den er en tredimensionel fortolkning af Caspar David Friedrichs maleri «Ishavet» fra 1820'erne og blev afsløret i maj 2010, med dronning Sonja til stede.\n\nIndenfor har hovedsalen plads til 1 364 tilskuere, og to mindre scener rummer 400 og 200. På taget har der været koncerter med op til 15 000 mennesker. Vender du dig mod land, ser du de høje huse i Barcode, det nye Munchmuseum og Deichman-biblioteket, alle opført efter at Operaen viste vejen for den nye bydel.",
          estimatedDurationS: 53,
        },
        {
          kind: "audio_description",
          chapterNo: 1,
          title: "Sådan ser det ud",
          text:
            "Du står på pladsen foran Operaen. Foran dig skråner store flader af hvid marmor op fra jorden, som en bred rampe uden trin. Overfladen er glat og lys, med lange, tynde fuger. Til venstre for rampen, i gadeplan, er hele facaden af glas, så du kan se den varme, gyldne væg af egetræ, der bølger indenfor. Over det hele knejser scenetårnet, en høj, firkantet blok i lyst, mønstret aluminium. Til højre glitrer fjorden, og ude i vandet står en kantet form af glas og stål, som fanger solen.",
          estimatedDurationS: 36,
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
      da: [
        {
          question: "Hvilket år åbnede Operaen?",
          options: ["2000", "2008", "2012"],
          correctIndex: 1,
          explanation: "Operaen åbnede den 12. april 2008 og fik Mies van der Rohe-prisen året efter.",
        },
        {
          question: "Hvad er taget beklædt med?",
          options: ["Hvid italiensk marmor", "Norsk granit", "Glas"],
          correctIndex: 0,
          explanation: "Marmoren La Facciata bevarer sit lys og sin farve, også når den er våd; omkring 20 000 kvadratmeter.",
        },
        {
          question: "Hvad hedder skulpturen, der flyder i vandet foran Operaen?",
          options: ["«Ishavet»", "«She Lies»", "«Den anden væg»"],
          correctIndex: 1,
          explanation: "«She Lies» af Monica Bonvicini drejer med tidevandet og fortolker Caspar David Friedrichs «Ishavet».",
        },
      ],
    },
  },
];

export interface DemoArea {
  id: string;
  slug: string;
  name: string;
  defaultLang: DemoLang;
  center: { lat: number; lng: number };
  bbox: { south: number; west: number; north: number; east: number };
  priceNok: number;
  pois: DemoPoi[];
}

/**
 * Alle demo-områdene, hvert med sine egne steder. Oslo (Kvadraturen) først og
 * uendret; Lørenskog og Nesoddtangen (24.09.2026) ligger i egne filer med
 * samme konvensjoner og samme pris. Seeden skriver area_id per sted herfra.
 */
export const DEMO_AREAS: DemoArea[] = [
  { ...DEMO_AREA, pois: OSLO_POIS },
  { ...LORENSKOG_AREA_INFO, priceNok: DEMO_AREA.priceNok, pois: LORENSKOG_POIS },
  { ...NESODDTANGEN_AREA_INFO, priceNok: DEMO_AREA.priceNok, pois: NESODDTANGEN_POIS },
];

/** Alle steder i alle områder, flatt (Commons-scriptet og testene). */
export const DEMO_POIS: DemoPoi[] = DEMO_AREAS.flatMap((area) => area.pois);

export interface DemoChapterPrompt {
  chapterNo: number;
  kind: "look" | "guess";
  /** Posisjon i kapittelet, 0 ≤ x < 1. */
  atFraction: number;
  text: string;
  /** Kun guess: 2–4 alternativer og fasit. */
  options?: string[];
  answerIndex?: number;
  revealText: string | null;
}

/** Spørsmål underveis per sted (id) og språk; se kommentaren øverst. */
export const DEMO_CHAPTER_PROMPTS: Record<string, Record<DemoLang, DemoChapterPrompt[]>> = {
  poi_akershus_festning: {
    nb: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.26,
        text: "Hva gjorde slottsherren Christen Munk i 1567 for at svenskene ikke skulle finne mat og ly?",
        options: ["Han stengte alle byportene", "Han brant hele byen ned", "Han senket skipene i havna"],
        answerIndex: 1,
        revealText: "Han brant hele byen ned. Etter 39 dager ga svenskene opp.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.81,
        text: "Se opp: De to trappetårnene på slottet heter Blåtårnet og Romerikstårnet. De kom da Christian den fjerde bygde om borgen tidlig på 1600-tallet.",
        revealText: null,
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.29,
        text: "What did the castellan Christen Munk do in 1567 so the Swedes would find neither food nor shelter?",
        options: ["He shut all the city gates", "He burned the whole city down", "He sank the ships in the harbour"],
        answerIndex: 1,
        revealText: "He burned the whole city down. After 39 days the Swedes gave up.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.82,
        text: "Look up: The castle's two staircase towers are the Blue Tower and the Romerike Tower. They came when Christian the Fourth rebuilt the castle in the early 1600s.",
        revealText: null,
      },
    ],
    da: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.27,
        text: "Hvad gjorde slotsherren Christen Munk i 1567, for at svenskerne ikke skulle finde mad og ly?",
        options: ["Han lukkede alle byportene", "Han brændte hele byen ned", "Han sænkede skibene i havnen"],
        answerIndex: 1,
        revealText: "Han brændte hele byen ned. Efter 39 dage gav svenskerne op.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.8,
        text: "Se op: Slottets to trappetårne er Blåtårnet og Romerikstårnet. De kom, da Christian den Fjerde lod borgen bygge om tidligt i 1600-tallet.",
        revealText: null,
      },
    ],
  },
  poi_christiania_torv: {
    nb: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.62,
        text: "Hva måtte alle som bygde innenfor bymuren, bygge i?",
        options: ["Leire og torv", "Mur eller stein", "Bare tre"],
        answerIndex: 1,
        revealText: "Mur eller stein. Kongen innførte murtvang, og de som ikke hadde råd, fikk nøye seg med bindingsverk fylt med murstein.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.93,
        text: "Se opp: Rådmannsgården står på hjørnet. Ankerjernene i muren viser årstallet 1626.",
        revealText: null,
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.6,
        text: "What did everyone building inside the city wall have to build in?",
        options: ["Clay and turf", "Brick or stone", "Wood only"],
        answerIndex: 1,
        revealText: "Brick or stone. The king made masonry compulsory, and those who could not afford it had to make do with timber framing filled with brick.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.92,
        text: "Look up: The councillor's house is on the corner. Its wall anchors show the year 1626.",
        revealText: null,
      },
    ],
    da: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.62,
        text: "Hvad skulle alle, der byggede inden for bymuren, bygge i?",
        options: ["Ler og tørv", "Mursten eller sten", "Kun træ"],
        answerIndex: 1,
        revealText: "Mursten eller sten. Kongen indførte murtvang, og de, der ikke havde råd, måtte nøjes med bindingsværk fyldt med mursten.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.93,
        text: "Se op: Rådmannsgården står på hjørnet. Murankrene viser årstallet 1626.",
        revealText: null,
      },
    ],
  },
  poi_gamle_radhus: {
    nb: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.63,
        text: "Se opp: De høye renessansegavlene du ser i dag, ble gjenskapt på 1900-tallet.",
        revealText: null,
      },
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.71,
        text: "Hva er de gamle fengselscellene i kjelleren blitt til?",
        options: ["Et bibliotek", "Vinkjeller og selskapsrom", "Et bakeri"],
        answerIndex: 1,
        revealText: "Vinkjeller og selskapsrom. Huset er i dag mest kjent for lutefisken sin.",
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.64,
        text: "Look up: The tall renaissance gables you see today were recreated in the 20th century.",
        revealText: null,
      },
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.72,
        text: "What have the old prison cells in the cellar become?",
        options: ["A library", "A wine cellar and a private dining room", "A bakery"],
        answerIndex: 1,
        revealText: "A wine cellar and a private dining room. Today the house is best known for its lutefisk.",
      },
    ],
    da: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.62,
        text: "Se op: De høje renæssancegavle, du ser i dag, blev genskabt i 1900-tallet.",
        revealText: null,
      },
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.71,
        text: "Hvad er de gamle fængselsceller i kælderen blevet til?",
        options: ["Et bibliotek", "Vinkælder og selskabslokale", "Et bageri"],
        answerIndex: 1,
        revealText: "Vinkælder og selskabslokale. Huset er i dag mest kendt for sin lutefisk.",
      },
    ],
  },
  poi_oslo_bors: {
    nb: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.33,
        text: "Hvor stort var det opprinnelige børshuset, sammenlignet med det du ser i dag?",
        options: ["Omtrent en tredel", "Omtrent halvparten", "Like stort"],
        answerIndex: 0,
        revealText: "Omtrent en tredel: bare én etasje på en høy kjeller. Sidefløyene og sørfløyen kom i 1909 og 1910.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.84,
        text: "Se opp: Foran inngangen står Merkur, handelens gud, i bronse på en fontene med fire løvehoder.",
        revealText: null,
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.33,
        text: "How big was the original exchange building, compared with what you see today?",
        options: ["About a third", "About half", "The same size"],
        answerIndex: 0,
        revealText: "About a third: only one storey on a high basement. The side wings and the south wing were added in 1909 and 1910.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.83,
        text: "Look up: In front of the entrance stands Mercury, the god of commerce, in bronze on a fountain with four lion heads.",
        revealText: null,
      },
    ],
    da: [
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.33,
        text: "Hvor stort var det oprindelige børshus sammenlignet med det, du ser i dag?",
        options: ["Omtrent en tredjedel", "Omtrent halvdelen", "Lige så stort"],
        answerIndex: 0,
        revealText: "Omtrent en tredjedel: kun én etage på en høj kælder. Sidefløjene og sydfløjen kom til i 1909 og 1910.",
      },
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.83,
        text: "Se op: Foran indgangen står Merkur, handelens gud, i bronze på et springvand med fire løvehoveder.",
        revealText: null,
      },
    ],
  },
  poi_bankplassen: {
    nb: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.35,
        text: "Se opp: Norges Banks hovedsete fra 1906 er et palass i hugget norsk granitt og marmor, rikt dekorert i jugendstil.",
        revealText: null,
      },
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.93,
        text: "Hvem hadde sine egne kaffekopper på Engebret Café?",
        options: ["Ibsen", "Grieg", "Munch"],
        answerIndex: 1,
        revealText: "Grieg. Og Munchs bord er fortsatt det mest ettertraktede.",
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.36,
        text: "Look up: Norges Bank's headquarters from 1906 is a palace in hewn Norwegian granite and marble, richly decorated in Art Nouveau.",
        revealText: null,
      },
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.94,
        text: "Who had his own coffee cups at Engebret Café?",
        options: ["Ibsen", "Grieg", "Munch"],
        answerIndex: 1,
        revealText: "Grieg. And Munch's table is still the most sought after.",
      },
    ],
    da: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.35,
        text: "Se op: Norges Banks hovedsæde fra 1906 er et palads i hugget norsk granit og marmor, rigt dekoreret i jugendstil.",
        revealText: null,
      },
      {
        chapterNo: 1,
        kind: "guess",
        atFraction: 0.93,
        text: "Hvem havde sine egne kaffekopper på Engebret Café?",
        options: ["Ibsen", "Grieg", "Munch"],
        answerIndex: 1,
        revealText: "Grieg. Og Munchs bord er stadig det mest eftertragtede.",
      },
    ],
  },
  poi_operaen: {
    nb: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.71,
        text: "Se opp: Scenetårnet er kledd i aluminiumsplater med et mønster av tekstilkunstnerne Astrid Løvaas og Kirsten Wagle, inspirert av gamle vevmønstre.",
        revealText: null,
      },
      {
        chapterNo: 2,
        kind: "guess",
        atFraction: 0.17,
        text: "Skulpturen «She Lies» ute i vannet dreier sakte. Hva får den til å dreie?",
        options: ["Vinden", "Tidevannet", "En motor"],
        answerIndex: 1,
        revealText: "Tidevannet. Skulpturen av Monica Bonvicini er i stål og glass og tolv meter høy.",
      },
    ],
    en: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.7,
        text: "Look up: The stage tower is clad in aluminium panels with a pattern by the textile artists Astrid Løvaas and Kirsten Wagle, inspired by old weaving patterns.",
        revealText: null,
      },
      {
        chapterNo: 2,
        kind: "guess",
        atFraction: 0.17,
        text: "The sculpture 'She Lies' out in the water turns slowly. What makes it turn?",
        options: ["The wind", "The tide", "A motor"],
        answerIndex: 1,
        revealText: "The tide. Monica Bonvicini's sculpture is in steel and glass and twelve metres tall.",
      },
    ],
    da: [
      {
        chapterNo: 1,
        kind: "look",
        atFraction: 0.7,
        text: "Se op: Scenetårnet er beklædt med aluminiumsplader med et mønster af tekstilkunstnerne Astrid Løvaas og Kirsten Wagle, inspireret af gamle vævemønstre.",
        revealText: null,
      },
      {
        chapterNo: 2,
        kind: "guess",
        atFraction: 0.17,
        text: "Skulpturen «She Lies» ude i vandet drejer langsomt. Hvad får den til at dreje?",
        options: ["Vinden", "Tidevandet", "En motor"],
        answerIndex: 1,
        revealText: "Tidevandet. Skulpturen af Monica Bonvicini er i stål og glas og tolv meter høj.",
      },
    ],
  },
  ...LORENSKOG_CHAPTER_PROMPTS,
  ...NESODDTANGEN_CHAPTER_PROMPTS,
};

/**
 * Hvor Commons-scriptet leter etter heltebilde per sted (id). Rekkefølge:
 * pinnedFile vinner når den er satt og lisensen er godkjent; ellers kategoriene
 * (presise), og bare hvis de ikke gir noe, søkene i File-navnerommet. Innenfor
 * hvert trinn velges høyest oppløsning, deretter tittel. Søk bruker
 * CirrusSearch-syntaks (intitle:) for å unngå treff på andre bygninger.
 * Kategorinavn uten «Category:»-prefiks.
 */
export interface DemoHeroImageSource {
  /** Filnavn på Commons, f.eks. «File:Akershus festning 2019.jpg»; null = velg automatisk. */
  pinnedFile: string | null;
  categories: string[];
  searchTerms: string[];
  /** Filnavnet må inneholde minst ett av ordene (ellers forkastes kandidaten). */
  titleMustIncludeAny?: string[];
  /** Filnavn med ett av ordene forkastes (nabobygg, samme navn i en annen by). */
  titleMustExclude?: string[];
}

export const DEMO_HERO_IMAGES: Record<string, DemoHeroImageSource> = {
  poi_akershus_festning: {
    pinnedFile: null,
    categories: ["Akershus Fortress", "Akershus Castle"],
    searchTerms: ['intitle:"Akershus festning"', 'intitle:"Akershus Fortress"'],
  },
  poi_christiania_torv: {
    pinnedFile: null,
    categories: ["Christiania torv"],
    searchTerms: ['intitle:"Christiania torv"'],
  },
  poi_gamle_radhus: {
    pinnedFile: null,
    categories: ["Gamle rådhus (Oslo)", "Old Town Hall (Oslo)", "Rådhusgata 1 (Oslo)"],
    searchTerms: ['intitle:"Gamle rådhus" intitle:Oslo', 'intitle:"Old Town Hall" intitle:Oslo', 'intitle:"Rådhusgata 1" intitle:Oslo'],
    // Første dry run (24.09.2026) valgte Gamle rådhus i Bergen fra søket.
    titleMustIncludeAny: ["Oslo", "Christiania"],
    titleMustExclude: ["Bergen", "Trondheim", "Stavanger", "Kristiansand"],
  },
  poi_oslo_bors: {
    pinnedFile: null,
    categories: ["Oslo Børs building", "Oslo Stock Exchange"],
    searchTerms: ['intitle:"Oslo Børs"', 'intitle:"Oslo Stock Exchange"'],
  },
  poi_bankplassen: {
    pinnedFile: null,
    categories: ["Bankplassen"],
    searchTerms: ['intitle:Bankplassen Oslo'],
  },
  poi_operaen: {
    pinnedFile: null,
    categories: ["Oslo Opera House"],
    searchTerms: ['intitle:"Oslo Opera House"', 'intitle:Operahuset intitle:Oslo'],
    // Første dry run (24.09.2026) valgte Deichman Bjørvika fra kategorien.
    titleMustIncludeAny: ["Opera", "Operahuset", "Operaen"],
    titleMustExclude: ["Deichman", "bibliotek", "library", "Munch", "Barcode", "interior", "interiør", "foyer"],
  },
  ...LORENSKOG_HERO_IMAGES,
  ...NESODDTANGEN_HERO_IMAGES,
};
