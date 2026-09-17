import type { Attraction, GuideScript, LanguageCode } from './types';

/**
 * POC-innhold. I produksjon kommer dette fra et CMS med redaksjonell
 * kvalitetssikring per språk. Hvert segment har både fortelling (det
 * guiden sier) og synstolking (det en seende ville sett akkurat der).
 *
 * Fakta er holdt på nivået «allment kjent» og bør verifiseres
 * redaksjonelt før lansering.
 */

const operahuset: Attraction = {
  id: 'oslo-operahuset',
  name: { en: 'Oslo Opera House', nb: 'Operahuset i Oslo', de: 'Osloer Opernhaus', fr: 'Opéra d’Oslo', es: 'Ópera de Oslo', it: 'Teatro dell’Opera di Oslo', pl: 'Opera w Oslo', uk: 'Оперний театр Осло', ja: 'オスロ・オペラハウス', zh: '奥斯陆歌剧院', ar: 'دار أوبرا أوسلو' },
  place: 'Bjørvika, Oslo',
  country: 'Norge',
  position: { lat: 59.9073, lng: 10.7531 },
  durationMin: 6,
  quickBuyNok: 29,
  hue: 200,
  heroAlt: {
    en: 'A low, white marble building sloping into the fjord like a glacier, with people walking on its roof.',
    nb: 'Et lavt, hvitt marmorbygg som skråner ned i fjorden som en isbre, med folk gående på taket.',
  },
  scripts: {
    nb: {
      intro: 'Operahuset åpnet i 2008 og er tegnet av Snøhetta. Du kan gå på taket – bygget er laget for å bli brukt, ikke bare sett.',
      sceneDescription: 'Du står ved vannkanten i Bjørvika. Foran deg stiger et hvitt bygg opp av fjorden som et flak av is. Overflaten er hvit marmor med svake grå årer. Store, skrå flater leder fra bakkenivå helt opp til taket, og mennesker går oppover dem i alle retninger. Til venstre glitrer fjorden, og et stykke ut i vannet står en skulptur av stål og glass som ser ut som et isfjell som velter.',
      segments: [
        {
          id: 'arrival',
          narration: 'Velkommen til Operahuset. Da det åpnet i april 2008, brøt det med nesten alt man forventet av et operahus. Ingen søyler, ingen trapp som skiller publikum fra bygget. I stedet en marmorflate som inviterer deg til å gå rett opp på taket.',
          audioDescription: 'Foran deg ligger en bred, hvit marmorflate som starter i bakkenivå og skråner slakt oppover. Flaten er så bred at flere titalls mennesker kan gå side om side. I kanten mot vannet ender marmoren rett i fjorden.',
        },
        {
          id: 'marble',
          narration: 'Marmoren du går på, er italiensk Carrara-marmor – samme type som Michelangelo hugget i. Rundt 36 000 steinplater ble lagt med små nivåforskjeller og mønstre, slik at flaten ikke blir glatt og ensformig, men får liv når lyset endrer seg.',
          audioDescription: 'Under føttene dine er steinplatene lagt i et mønster der noen plater ligger en centimeter høyere enn andre. Overflaten er ru, ikke polert. I sollys er den nesten blendende hvit; i overskyet vær blir den grå-hvit med tydelige årer.',
        },
        {
          id: 'wave-wall',
          narration: 'Går du inn i foajeen, møter du «Bølgeveggen» – en buet vegg av eik som skiller det åpne fellesrommet fra selve hovedsalen. Tanken var at havnen og byen skal flyte rett inn i huset, og at eiken skulle gi varme mot all den kalde steinen.',
          audioDescription: 'Bak de høye glassveggene ser du en enorm, buet vegg i varm, gyllen eik. Den svinger som en bølge fra gulv til tak, bygget av tusenvis av smale trelameller. Foran den er et lyst gulv av lys stein, og lyset faller inn gjennom glass som strekker seg over femten meter i høyden.',
        },
        {
          id: 'she-lies',
          narration: 'Ute i fjorden flyter skulpturen «She Lies» av Monica Bonvicini. Den er laget av stål og glass, står på en flytende plattform og dreier med vind og tidevann. Formen er inspirert av Caspar David Friedrichs maleri «Ishavet» – et skip knust av isen.',
          audioDescription: 'Et stykke ut i vannet, til venstre for bygget, står en kantete skulptur av speilende glass og stål, omtrent tolv meter høy. Den ser ut som isflak som er presset opp mot hverandre. Overflaten speiler himmelen og fjorden, så den skifter farge med været.',
        },
      ],
    },
    en: {
      intro: 'The Opera House opened in 2008 and was designed by Snøhetta. You can walk on the roof – the building is made to be used, not just looked at.',
      sceneDescription: 'You are standing at the water’s edge in Bjørvika. In front of you a white building rises from the fjord like a sheet of ice. The surface is white marble with faint grey veins. Large sloping planes lead from ground level all the way up to the roof, and people are walking up them in every direction. To your left the fjord glitters, and a short way out in the water stands a sculpture of steel and glass that looks like a toppling iceberg.',
      segments: [
        {
          id: 'arrival',
          narration: 'Welcome to the Oslo Opera House. When it opened in April 2008 it broke with almost everything people expected from an opera house. No columns, no grand staircase separating the public from the building. Instead, a marble surface that invites you to walk straight up onto the roof.',
          audioDescription: 'In front of you lies a broad, white marble plane that starts at ground level and slopes gently upward. It is wide enough for dozens of people to walk side by side. At the edge facing the water, the marble runs straight into the fjord.',
        },
        {
          id: 'marble',
          narration: 'The marble you are walking on is Italian Carrara marble – the same stone Michelangelo carved. Around 36,000 slabs were laid with small differences in level and pattern, so the surface is never slick or monotonous but comes alive as the light changes.',
          audioDescription: 'Beneath your feet the stone slabs are laid in a pattern where some sit a centimetre higher than others. The surface is rough, not polished. In sunlight it is almost blindingly white; under cloud it turns grey-white with clearly visible veins.',
        },
        {
          id: 'wave-wall',
          narration: 'Step into the foyer and you meet the “Wave Wall” – a curved wall of oak separating the open public space from the main auditorium. The idea was that the harbour and the city should flow straight into the house, and that the oak would bring warmth against all the cold stone.',
          audioDescription: 'Behind the tall glass walls you see an enormous curved wall of warm, golden oak. It sweeps like a wave from floor to ceiling, built from thousands of narrow timber slats. In front of it is a floor of pale stone, and light pours in through glass more than fifteen metres high.',
        },
        {
          id: 'she-lies',
          narration: 'Out in the fjord floats the sculpture “She Lies” by Monica Bonvicini. Made of steel and glass, it sits on a floating platform and turns with the wind and tide. The form is inspired by Caspar David Friedrich’s painting “The Sea of Ice” – a ship crushed by the ice.',
          audioDescription: 'A short way out in the water, to the left of the building, stands an angular sculpture of mirrored glass and steel, about twelve metres tall. It looks like sheets of ice forced up against each other. Its surface reflects the sky and the fjord, so it changes colour with the weather.',
        },
      ],
    },
    de: {
      intro: 'Das Opernhaus wurde 2008 eröffnet und von Snøhetta entworfen. Man kann auf dem Dach spazieren – das Gebäude ist zum Benutzen gemacht, nicht nur zum Ansehen.',
      sceneDescription: 'Du stehst am Wasser in Bjørvika. Vor dir erhebt sich ein weißes Gebäude wie eine Eisscholle aus dem Fjord. Die Oberfläche ist weißer Marmor mit feinen grauen Adern. Große, schräge Flächen führen vom Boden bis aufs Dach, und Menschen gehen in alle Richtungen hinauf. Links glitzert der Fjord, und ein Stück draußen im Wasser steht eine Skulptur aus Stahl und Glas, die wie ein kippender Eisberg aussieht.',
      segments: [
        {
          id: 'arrival',
          narration: 'Willkommen im Osloer Opernhaus. Bei der Eröffnung im April 2008 brach es mit fast allem, was man von einem Opernhaus erwartete. Keine Säulen, keine Freitreppe, die das Publikum vom Gebäude trennt. Stattdessen eine Marmorfläche, die dich einlädt, direkt aufs Dach zu gehen.',
          audioDescription: 'Vor dir liegt eine breite, weiße Marmorfläche, die am Boden beginnt und sanft ansteigt. Sie ist so breit, dass Dutzende Menschen nebeneinander gehen können. An der Kante zum Wasser läuft der Marmor direkt in den Fjord.',
        },
        {
          id: 'marble',
          narration: 'Der Marmor unter deinen Füßen ist italienischer Carrara-Marmor – derselbe Stein, den Michelangelo bearbeitete. Rund 36 000 Platten wurden mit kleinen Höhenunterschieden und Mustern verlegt, damit die Fläche nie glatt und eintönig wirkt, sondern mit dem Licht lebendig wird.',
          audioDescription: 'Unter deinen Füßen sind die Steinplatten so verlegt, dass manche einen Zentimeter höher liegen als andere. Die Oberfläche ist rau, nicht poliert. Im Sonnenlicht ist sie fast blendend weiß; bei Wolken wird sie grauweiß mit deutlichen Adern.',
        },
        {
          id: 'wave-wall',
          narration: 'Im Foyer triffst du auf die „Wellenwand“ – eine geschwungene Wand aus Eiche, die den offenen Publikumsraum vom großen Saal trennt. Die Idee: Hafen und Stadt sollen direkt ins Haus fließen, und die Eiche bringt Wärme gegen all den kalten Stein.',
          audioDescription: 'Hinter den hohen Glaswänden siehst du eine riesige, geschwungene Wand aus warmer, goldener Eiche. Sie schwingt wie eine Welle vom Boden bis zur Decke, gebaut aus Tausenden schmaler Holzlamellen. Davor liegt ein Boden aus hellem Stein, und Licht fällt durch mehr als fünfzehn Meter hohes Glas.',
        },
        {
          id: 'she-lies',
          narration: 'Draußen im Fjord schwimmt die Skulptur „She Lies“ von Monica Bonvicini. Sie besteht aus Stahl und Glas, steht auf einer schwimmenden Plattform und dreht sich mit Wind und Gezeiten. Die Form ist von Caspar David Friedrichs Gemälde „Das Eismeer“ inspiriert – ein vom Eis zerdrücktes Schiff.',
          audioDescription: 'Ein Stück draußen im Wasser, links vom Gebäude, steht eine kantige Skulptur aus spiegelndem Glas und Stahl, etwa zwölf Meter hoch. Sie sieht aus wie aufeinandergeschobene Eisschollen. Ihre Oberfläche spiegelt Himmel und Fjord, sodass sie mit dem Wetter die Farbe wechselt.',
        },
      ],
    },
    fr: {
      intro: 'L’Opéra a ouvert en 2008 et a été conçu par Snøhetta. On peut marcher sur son toit : le bâtiment est fait pour être utilisé, pas seulement regardé.',
      sceneDescription: 'Vous êtes au bord de l’eau, à Bjørvika. Devant vous, un bâtiment blanc s’élève du fjord comme une plaque de glace. La surface est en marbre blanc veiné de gris pâle. De grands plans inclinés mènent du sol jusqu’au toit, et des gens les gravissent dans toutes les directions. À gauche, le fjord scintille, et un peu plus loin dans l’eau se dresse une sculpture d’acier et de verre qui ressemble à un iceberg qui bascule.',
      segments: [
        {
          id: 'arrival',
          narration: 'Bienvenue à l’Opéra d’Oslo. À son ouverture en avril 2008, il a rompu avec presque tout ce qu’on attendait d’un opéra. Pas de colonnes, pas de grand escalier séparant le public du bâtiment. À la place, une surface de marbre qui vous invite à monter directement sur le toit.',
          audioDescription: 'Devant vous s’étend un large plan de marbre blanc qui part du sol et monte en pente douce. Il est assez large pour que des dizaines de personnes marchent côte à côte. Au bord, côté eau, le marbre plonge directement dans le fjord.',
        },
        {
          id: 'marble',
          narration: 'Le marbre sous vos pieds est du marbre de Carrare – la pierre même que sculptait Michel-Ange. Environ 36 000 dalles ont été posées avec de légères différences de niveau et de motif, pour que la surface ne soit jamais lisse ni monotone, mais s’anime avec la lumière.',
          audioDescription: 'Sous vos pieds, les dalles sont posées de sorte que certaines dépassent d’un centimètre. La surface est rugueuse, non polie. Au soleil, elle est d’un blanc presque aveuglant ; par temps couvert, elle devient gris-blanc avec des veines bien visibles.',
        },
        {
          id: 'wave-wall',
          narration: 'Dans le foyer, vous rencontrez le « Mur de vagues » : une paroi courbe en chêne qui sépare l’espace public de la grande salle. L’idée était que le port et la ville coulent directement dans la maison, et que le chêne apporte de la chaleur face à toute cette pierre froide.',
          audioDescription: 'Derrière les hautes parois vitrées, vous voyez un immense mur courbe en chêne doré et chaleureux. Il ondule comme une vague du sol au plafond, fait de milliers de fines lattes de bois. Devant, un sol de pierre claire, et la lumière entre par des vitrages de plus de quinze mètres de haut.',
        },
        {
          id: 'she-lies',
          narration: 'Dans le fjord flotte la sculpture « She Lies » de Monica Bonvicini. En acier et en verre, elle repose sur une plateforme flottante et tourne avec le vent et la marée. Sa forme s’inspire du tableau de Caspar David Friedrich « La Mer de glace » – un navire broyé par les glaces.',
          audioDescription: 'Un peu plus loin dans l’eau, à gauche du bâtiment, se dresse une sculpture anguleuse de verre miroir et d’acier, d’environ douze mètres de haut. On dirait des plaques de glace poussées les unes contre les autres. Sa surface reflète le ciel et le fjord, et change de couleur avec le temps.',
        },
      ],
    },
    es: {
      intro: 'La Ópera abrió en 2008 y fue diseñada por Snøhetta. Se puede caminar por su tejado: el edificio está hecho para usarse, no solo para mirarse.',
      sceneDescription: 'Estás a la orilla del agua, en Bjørvika. Frente a ti, un edificio blanco emerge del fiordo como una placa de hielo. La superficie es mármol blanco con finas vetas grises. Grandes planos inclinados suben desde el suelo hasta el tejado, y la gente los recorre en todas direcciones. A la izquierda brilla el fiordo, y un poco más lejos en el agua se alza una escultura de acero y vidrio que parece un iceberg volcándose.',
      segments: [
        {
          id: 'arrival',
          narration: 'Bienvenido a la Ópera de Oslo. Cuando abrió en abril de 2008 rompió con casi todo lo que se esperaba de una ópera. Sin columnas, sin gran escalinata que separe al público del edificio. En su lugar, una superficie de mármol que te invita a subir directamente al tejado.',
          audioDescription: 'Frente a ti se extiende un amplio plano de mármol blanco que empieza a nivel del suelo y sube en suave pendiente. Es tan ancho que decenas de personas pueden caminar juntas. En el borde hacia el agua, el mármol se hunde directamente en el fiordo.',
        },
        {
          id: 'marble',
          narration: 'El mármol que pisas es mármol de Carrara, la misma piedra que talló Miguel Ángel. Unas 36 000 losas se colocaron con pequeñas diferencias de nivel y patrón para que la superficie nunca sea lisa ni monótona, sino que cobre vida cuando cambia la luz.',
          audioDescription: 'Bajo tus pies, las losas están colocadas de modo que algunas sobresalen un centímetro. La superficie es áspera, no pulida. Al sol es de un blanco casi cegador; con nubes se vuelve gris blanquecino con vetas bien visibles.',
        },
        {
          id: 'wave-wall',
          narration: 'Al entrar al vestíbulo encuentras el «Muro de olas»: una pared curva de roble que separa el espacio público de la sala principal. La idea era que el puerto y la ciudad fluyeran directamente hacia el interior, y que el roble diera calidez frente a tanta piedra fría.',
          audioDescription: 'Tras los altos muros de vidrio ves una enorme pared curva de roble dorado y cálido. Ondula como una ola del suelo al techo, construida con miles de finas lamas de madera. Delante hay un suelo de piedra clara, y la luz entra por vidrios de más de quince metros de altura.',
        },
        {
          id: 'she-lies',
          narration: 'En el fiordo flota la escultura «She Lies» de Monica Bonvicini. Hecha de acero y vidrio, descansa sobre una plataforma flotante y gira con el viento y la marea. Su forma se inspira en el cuadro de Caspar David Friedrich «El mar de hielo»: un barco aplastado por el hielo.',
          audioDescription: 'Un poco más lejos en el agua, a la izquierda del edificio, se alza una escultura angulosa de vidrio espejado y acero, de unos doce metros de altura. Parece un conjunto de placas de hielo empujadas unas contra otras. Su superficie refleja el cielo y el fiordo, y cambia de color con el tiempo.',
        },
      ],
    },
  },
};

const akershus: Attraction = {
  id: 'oslo-akershus-festning',
  name: { en: 'Akershus Fortress', nb: 'Akershus festning', de: 'Festung Akershus', fr: 'Forteresse d’Akershus', es: 'Fortaleza de Akershus', it: 'Fortezza di Akershus', pl: 'Twierdza Akershus', uk: 'Фортеця Акерсгус', ja: 'アーケシュフース城', zh: '阿克斯胡斯城堡', ar: 'قلعة آكرشوس' },
  place: 'Oslo',
  country: 'Norge',
  position: { lat: 59.9075, lng: 10.7365 },
  durationMin: 7,
  quickBuyNok: 29,
  hue: 30,
  heroAlt: {
    en: 'A stone fortress with thick walls and towers on a hill above the harbour.',
    nb: 'En steinfestning med tykke murer og tårn på en høyde over havna.',
  },
  scripts: {
    nb: {
      intro: 'Middelalderborg fra rundt 1300, ombygd til renessanseslott på 1600-tallet. Aldri erobret ved beleiring – men okkupert i 1940.',
      sceneDescription: 'Du står på en høyde med havna under deg. Rundt deg reiser det seg tykke murer av grå og brunlig stein, flere meter høye. Bak murene ser du et slott med spisse tårn og kobbergrønne tak. Gresset mellom murene er kortklipt, og gamle kanoner står på rekke og peker ut mot fjorden.',
      segments: [
        {
          id: 'origins',
          narration: 'Akershus ble påbegynt rundt 1290-årene under kong Håkon den femte, da Oslo nettopp var blitt hovedstad. Borgen skulle vokte innseilingen til byen, og den gjorde jobben: Akershus har aldri blitt inntatt ved beleiring.',
          audioDescription: 'Foran deg står den eldste delen av borgen: en massiv, grå steinmur med små, smale vindusåpninger. Steinene er ujevne og mørke av alder, med mose i fugene nederst.',
        },
        {
          id: 'christian-iv',
          narration: 'På begynnelsen av 1600-tallet lot Christian den fjerde borgen bygge om til et renessanseslott, og festningsverkene rundt fikk moderne bastioner mot kanonild. Kongen flyttet også hele byen hit, tett inntil festningen, etter bybrannen i 1624.',
          audioDescription: 'Slottet har lyse, pussede fasader med rader av høye vinduer, i kontrast til de grove middelaldermurene. Takene er grønne av kobber, og to slanke tårn med spir stikker opp over resten.',
        },
        {
          id: 'war',
          narration: 'Den 9. april 1940 overtok tyske styrker festningen uten kamp. Under okkupasjonen ble norske motstandsfolk henrettet her. Etter krigen ble festningen sted for både rettsoppgjør og minnesmerker – og i dag ligger Norges hjemmefrontmuseum innenfor murene.',
          audioDescription: 'Ved en av murene står et enkelt minnesmerke i mørk stein med navn hugget inn. Foran det ligger ofte blomster. Området er stille, med gress og noen få trær.',
        },
        {
          id: 'today',
          narration: 'I dag er Akershus fortsatt militært område, men åpent for alle. Kongelige gravlegges i mausoleet i slottskjelleren, regjeringen holder representasjonsmiddager her, og Oslos befolkning bruker vollene som park med byens beste utsikt over fjorden.',
          audioDescription: 'Fra vollkanten ser du ut over havnebassenget: hvite ferger, det hvite Operahuset til venstre, og bak det de nye høyhusene i Bjørvika. Rett nedenfor deg ligger Rådhuset med sine to røde teglsteinstårn.',
        },
      ],
    },
    en: {
      intro: 'A medieval castle from around 1300, rebuilt as a Renaissance palace in the 1600s. Never taken by siege – but occupied in 1940.',
      sceneDescription: 'You are standing on a rise with the harbour below you. Around you thick walls of grey and brownish stone rise several metres high. Behind the walls you see a palace with pointed towers and copper-green roofs. The grass between the walls is closely mown, and old cannons stand in a row pointing out towards the fjord.',
      segments: [
        {
          id: 'origins',
          narration: 'Work on Akershus began in the 1290s under King Håkon the fifth, just as Oslo had become the capital. The castle was to guard the approach to the city, and it did its job: Akershus has never been taken by siege.',
          audioDescription: 'In front of you stands the oldest part of the castle: a massive grey stone wall with small, narrow window slits. The stones are uneven and darkened with age, with moss in the lowest joints.',
        },
        {
          id: 'christian-iv',
          narration: 'In the early 1600s Christian the fourth had the castle rebuilt as a Renaissance palace, and the surrounding fortifications received modern bastions against cannon fire. After the great fire of 1624 the king also moved the entire city here, close against the fortress.',
          audioDescription: 'The palace has pale, rendered façades with rows of tall windows, in contrast to the rough medieval walls. The roofs are green with copper, and two slender towers with spires rise above the rest.',
        },
        {
          id: 'war',
          narration: 'On the 9th of April 1940 German forces took the fortress without a fight. During the occupation, Norwegian resistance fighters were executed here. After the war the fortress became a place of trials and of memorials – and today Norway’s Resistance Museum lies within its walls.',
          audioDescription: 'By one of the walls stands a simple memorial in dark stone with names carved into it. Flowers often lie in front of it. The area is quiet, with grass and a few trees.',
        },
        {
          id: 'today',
          narration: 'Today Akershus is still a military area, but open to everyone. Royals are laid to rest in the mausoleum beneath the palace, the government hosts state dinners here, and the people of Oslo use the ramparts as a park with the city’s best view of the fjord.',
          audioDescription: 'From the edge of the rampart you look out over the harbour basin: white ferries, the white Opera House to the left, and behind it the new high-rises of Bjørvika. Directly below you is the City Hall with its two red-brick towers.',
        },
      ],
    },
  },
};

const vigeland: Attraction = {
  id: 'oslo-vigelandsparken',
  name: { en: 'Vigeland Sculpture Park', nb: 'Vigelandsparken', de: 'Vigeland-Skulpturenpark', fr: 'Parc de sculptures Vigeland', es: 'Parque de esculturas de Vigeland', it: 'Parco delle sculture di Vigeland', pl: 'Park Vigelanda', uk: 'Парк Вігеланда', ja: 'ヴィーゲラン彫刻公園', zh: '维格兰雕塑公园', ar: 'حديقة فيغلاند للمنحوتات' },
  place: 'Frogner, Oslo',
  country: 'Norge',
  position: { lat: 59.927, lng: 10.7009 },
  durationMin: 8,
  quickBuyNok: 29,
  hue: 120,
  heroAlt: {
    en: 'A long avenue lined with bronze sculptures leading to a tall granite column of intertwined human figures.',
    nb: 'En lang allé kantet av bronseskulpturer som leder mot en høy granittsøyle av sammenflettede menneskekropper.',
  },
  scripts: {
    nb: {
      intro: 'Verdens største skulpturpark laget av én kunstner: over 200 verk av Gustav Vigeland i bronse, granitt og smijern.',
      sceneDescription: 'Du står i en åpen park med brede grusganger og store plener. Foran deg går en lang, rett akse gjennom parken: først en bro kantet med bronsefigurer, så en stor fontene, og bakerst en høy, lys steinsøyle på en trappet høyde. Overalt rundt deg er det menneskefigurer i naturlig størrelse – nakne, i bevegelse, alene eller i grupper.',
      segments: [
        {
          id: 'intro',
          narration: 'Gustav Vigeland brukte over tjue år av livet sitt på denne parken. Oslo kommune ga ham atelier og bolig mot at han testamenterte alt han laget til byen. Resultatet er 212 skulpturer og over 600 figurer – alle om det samme temaet: mennesket, fra fødsel til død.',
          audioDescription: 'Du står ved inngangen til parken. En bred allé av grus fører rett fram, kantet av høye trær. Langt der framme skimter du en steinsøyle mot himmelen.',
        },
        {
          id: 'bridge',
          narration: 'Broen er hundre meter lang og har 58 bronseskulpturer på rekkverkene. Her finner du parkens mest berømte figur: Sinnataggen, en liten gutt som stamper i bakken i raseri. Han er så populær at hånden hans er blank av alle som har tatt på ham.',
          audioDescription: 'Langs begge sider av broen står bronsefigurer i mørk, grønnbrun bronse på lave granittsokler. På venstre side, omtrent midtveis, står en liten gutt på rundt en meter, med knyttede never, hodet bøyd og den ene foten løftet for å stampe. Bronsen på den venstre hånden hans skinner gyllent.',
        },
        {
          id: 'fountain',
          narration: 'Fontenen bæres av seks kjemper som holder en enorm skål. Rundt bassenget står tjue tregrupper der mennesker klatrer, hviler og dør blant greinene – livets sirkel, fra barn til skjelett.',
          audioDescription: 'Midt i et stort, firkantet basseng holder seks nakne menn i bronse en flat skål over hodene. Vann renner over kanten av skålen i en tynn, jevn gardin. Rundt bassenget står skulpturer av trær med menneskefigurer inni greinene.',
        },
        {
          id: 'monolith',
          narration: 'Monolitten er parkens høydepunkt: 14 meter høy, hugget ut av én eneste granittblokk. Tre steinhuggere brukte 14 år på å hugge de 121 menneskefigurene som klatrer over hverandre mot toppen. Hva den betyr, ville Vigeland aldri svare på.',
          audioDescription: 'Foran deg reiser det seg en lys, gråhvit steinsøyle, høy som et fem-etasjes hus, på toppen av en rund høyde med brede trappetrinn. Hele søylen er dekket av sammenflettede menneskekropper i alle aldre, som strekker seg oppover. Rundt foten står 36 grupper av granittfigurer.',
        },
      ],
    },
    en: {
      intro: 'The world’s largest sculpture park made by a single artist: over 200 works by Gustav Vigeland in bronze, granite and wrought iron.',
      sceneDescription: 'You are standing in an open park with wide gravel paths and large lawns. Ahead of you a long, straight axis runs through the park: first a bridge lined with bronze figures, then a large fountain, and at the far end a tall, pale stone column on a stepped mound. All around you are life-size human figures – naked, in motion, alone or in groups.',
      segments: [
        {
          id: 'intro',
          narration: 'Gustav Vigeland spent more than twenty years of his life on this park. The city of Oslo gave him a studio and a home in return for everything he made. The result is 212 sculptures and over 600 figures – all on the same theme: the human being, from birth to death.',
          audioDescription: 'You are at the entrance to the park. A broad gravel avenue leads straight ahead, lined with tall trees. Far ahead you can just make out a stone column against the sky.',
        },
        {
          id: 'bridge',
          narration: 'The bridge is a hundred metres long and carries 58 bronze sculptures on its railings. Here you find the park’s most famous figure: the Angry Boy, a small child stamping his foot in fury. He is so popular that his hand has been polished bright by everyone who has touched it.',
          audioDescription: 'Along both sides of the bridge stand figures in dark, green-brown bronze on low granite plinths. On the left, about halfway across, is a small boy about a metre tall, fists clenched, head bowed, one foot raised to stamp. The bronze of his left hand shines gold.',
        },
        {
          id: 'fountain',
          narration: 'The fountain is carried by six giants holding an enormous bowl. Around the basin stand twenty tree groups in which people climb, rest and die among the branches – the circle of life, from child to skeleton.',
          audioDescription: 'In the middle of a large square basin, six naked bronze men hold a flat bowl above their heads. Water spills over the bowl’s rim in a thin, even curtain. Around the basin stand sculptures of trees with human figures within the branches.',
        },
        {
          id: 'monolith',
          narration: 'The Monolith is the park’s climax: 14 metres tall, carved from a single block of granite. Three stone carvers spent 14 years cutting the 121 human figures that climb over one another towards the top. What it means, Vigeland would never say.',
          audioDescription: 'In front of you rises a pale grey-white stone column as tall as a five-storey house, on top of a round mound with broad steps. The whole column is covered in intertwined human bodies of every age, straining upwards. Around its base stand 36 groups of granite figures.',
        },
      ],
    },
  },
};

const holmenkollen: Attraction = {
  id: 'oslo-holmenkollen',
  name: { en: 'Holmenkollen Ski Jump', nb: 'Holmenkollbakken', de: 'Holmenkollen-Schanze', fr: 'Tremplin de Holmenkollen', es: 'Trampolín de Holmenkollen', it: 'Trampolino di Holmenkollen', pl: 'Skocznia Holmenkollen', uk: 'Трамплін Голменколлен', ja: 'ホルメンコーレン・ジャンプ台', zh: '霍尔门科伦跳台', ar: 'منصة هولمنكولن للقفز' },
  place: 'Holmenkollen, Oslo',
  country: 'Norge',
  position: { lat: 59.9636, lng: 10.6672 },
  durationMin: 5,
  quickBuyNok: 29,
  hue: 210,
  heroAlt: {
    en: 'A sleek steel ski jump curving up over a hillside, with the city and fjord far below.',
    nb: 'Et slankt hoppbakke-anlegg i stål som bøyer seg opp over en åsside, med byen og fjorden langt der nede.',
  },
  scripts: {
    nb: {
      intro: 'Norges nasjonalarena for skihopp siden 1892. Dagens bakke i stål åpnet i 2010 og ser ut som en bølge som fryser i lufta.',
      sceneDescription: 'Du står ved foten av en åsside med utsikt over hele Oslo og fjorden. Over deg svinger en enorm, slank konstruksjon av stål seg opp fra bakken – som en bølge, eller en skiflate frosset i øyeblikket før hoppet. Den er kledd i et fint nett av stål som lyser blått i skumringen. Nedenfor tribunen er det grønt gress om sommeren og snø om vinteren.',
      segments: [
        {
          id: 'history',
          narration: 'Det første rennet ble holdt i 1892, med rundt 12 000 tilskuere og lengste hopp på 21 og en halv meter. Siden da har bakken blitt bygget om 19 ganger. Holmenkollrennet i mars er fortsatt Norges største folkefest, og kongefamilien sitter alltid i kongelosjen.',
          audioDescription: 'Ved siden av deg står en lav bygning i tre og stein: Skimuseet, verdens eldste. Gjennom vinduene ser du gamle treski og ullgensere. Over inngangen henger et skilt med årstallet 1892.',
        },
        {
          id: 'design',
          narration: 'Dagens bakke ble tegnet av det danske arkitektkontoret JDS og åpnet i 2010. Den er laget av tusen tonn stål, og ovarennet stikker 60 meter ut i lufta uten støtte – en av verdens største utkraginger. Om kvelden lyser bakken opp, og på klare dager ser du den fra hele byen.',
          audioDescription: 'Se opp: den lange rampen hopperne kjører ned, henger fritt i lufta over deg, båret bare fra toppen. Overflaten er kledd i et hvitt, perforert stålnett som gjør at konstruksjonen virker lett og nesten gjennomsiktig. På toppen er en flat plattform med rekkverk.',
        },
        {
          id: 'view',
          narration: 'Fra toppen av hoppet, 60 meter over bakken, kan du se hele Oslo, fjorden og øyene – og på gode dager helt til Sverige. Hopperne ser bare én ting: unnarennet og punktet der de skal lande, 120 meter lenger nede.',
          audioDescription: 'Fra der du står, faller terrenget bratt nedover mot byen. Oslo ligger som et teppe av hustak og grønne åser, med fjorden som et sølvgrått bånd bak. På motsatt side av fjorden reiser skogkledde åser seg.',
        },
      ],
    },
    en: {
      intro: 'Norway’s national arena for ski jumping since 1892. Today’s steel jump opened in 2010 and looks like a wave frozen in mid-air.',
      sceneDescription: 'You are standing at the foot of a hillside with a view over all of Oslo and the fjord. Above you an enormous, slender steel structure curves up from the ground – like a wave, or a ski slope frozen in the moment before the jump. It is clad in a fine steel mesh that glows blue at dusk. Below the stands there is green grass in summer and snow in winter.',
      segments: [
        {
          id: 'history',
          narration: 'The first competition was held in 1892, with around 12,000 spectators and a longest jump of 21 and a half metres. Since then the hill has been rebuilt 19 times. The Holmenkollen Ski Festival in March is still Norway’s biggest popular celebration, and the royal family always sits in the royal box.',
          audioDescription: 'Beside you stands a low building of timber and stone: the Ski Museum, the oldest in the world. Through the windows you see old wooden skis and woollen sweaters. Above the entrance hangs a sign with the year 1892.',
        },
        {
          id: 'design',
          narration: 'Today’s jump was designed by the Danish architecture office JDS and opened in 2010. It is made of a thousand tonnes of steel, and the in-run projects 60 metres into the air without support – one of the largest cantilevers in the world. In the evening the jump lights up, and on clear days you can see it from all over the city.',
          audioDescription: 'Look up: the long ramp the jumpers ride down hangs freely in the air above you, supported only from the top. Its surface is clad in a white, perforated steel mesh that makes the structure seem light and almost transparent. At the very top is a flat platform with a railing.',
        },
        {
          id: 'view',
          narration: 'From the top of the jump, 60 metres above the ground, you can see all of Oslo, the fjord and its islands – and on a good day as far as Sweden. The jumpers see only one thing: the landing slope and the point where they will touch down, 120 metres further below.',
          audioDescription: 'From where you stand the ground falls steeply away towards the city. Oslo lies like a carpet of rooftops and green hills, with the fjord a silver-grey ribbon behind. On the far side of the fjord, forested hills rise up.',
        },
      ],
    },
  },
};

const bryggen: Attraction = {
  id: 'bergen-bryggen',
  name: { en: 'Bryggen in Bergen', nb: 'Bryggen i Bergen', de: 'Bryggen in Bergen', fr: 'Bryggen à Bergen', es: 'Bryggen en Bergen', it: 'Bryggen a Bergen', pl: 'Bryggen w Bergen', uk: 'Брюгген у Бергені', ja: 'ベルゲンのブリッゲン', zh: '卑尔根布吕根码头', ar: 'بريغن في بيرغن' },
  place: 'Bergen',
  country: 'Norge',
  position: { lat: 60.3973, lng: 5.3243 },
  durationMin: 7,
  quickBuyNok: 29,
  hue: 20,
  heroAlt: {
    en: 'A row of narrow, colourful wooden warehouses with pointed gables along a harbour.',
    nb: 'En rekke smale, fargerike trebygninger med spisse gavler langs en havn.',
  },
  scripts: {
    nb: {
      intro: 'Hansaens handelskvarter i Bergen, på UNESCOs verdensarvliste siden 1979. Trehusene står på samme tomter som for 900 år siden.',
      sceneDescription: 'Du står på en bred kai med havnebassenget bak deg. Foran deg står en tett rekke av smale trehus, skulder ved skulder, malt i rødt, oker, hvitt og gult. Gavlene er spisse og vender mot deg som en rad av tenner. Husene lener seg litt mot hverandre. Mellom dem åpner det seg smale, mørke passasjer inn i kvartalet.',
      segments: [
        {
          id: 'hansa',
          narration: 'Fra rundt 1350 til 1750-tallet drev det tyske Hansaforbundet et kontor her – ett av fire i Europa. Kjøpmennene byttet korn fra Baltikum mot tørrfisk fra Nord-Norge. De levde etter strenge regler: ingen kvinner, ingen ild i husene, og all handel på tysk.',
          audioDescription: 'Foran deg er husfasadene bygget av liggende og stående trebord, mange skjeve og bulkete av alder. Vinduene er små, med sprosser. Over noen dører henger gamle skilt med tyske navn.',
        },
        {
          id: 'fires',
          narration: 'Bryggen har brent minst sju ganger. Etter storbrannen i 1702 ble alt gjenreist på de gamle grunnmurene, med samme smale tomter og passasjer. Det er derfor gatene her ser ut som i middelalderen, selv om husene er fra 1700-tallet.',
          audioDescription: 'Gå inn i en av passasjene: den er bare et par meter bred, med trehus tett på begge sider som lener seg innover. Gulvet er plankebrygger av tre. Overalt henger det små, gamle vinduer og trapper, og lyset kommer i smale striper ovenfra.',
        },
        {
          id: 'archaeology',
          narration: 'Under brannen i 1955 gikk en tredel av Bryggen tapt – men i asken fant arkeologene tusenvis av runepinner, sko, verktøy og mynter fra 1100-tallet og fram. Bryggens Museum, rett bak deg, står oppå selve utgravningsfeltet.',
          audioDescription: 'Bak husrekken, mot høyre, ser du en moderne murbygning i mørk teglstein med store vinduer: Bryggens Museum. Foran museet er det en åpen plass med benker og et lite fontenebasseng.',
        },
        {
          id: 'today',
          narration: 'I dag huser Bryggen kunstnere, håndverkere, restauranter og et hanseatisk museum. 62 av de opprinnelige bygningene står igjen, og fagfolk restaurerer dem fortsatt med teknikker fra 1700-tallet – uten en eneste spiker der det ikke var spiker før.',
          audioDescription: 'Ser du nærmere på fasadene, finner du små butikkvinduer med strikkede gensere, trearbeid og smykker. Over deg går et telefonledning-tynt nett av snorer med hengende lykter mellom husene. Bak husrekken stiger fjellet Fløyen bratt opp, grønt og skogkledd.',
        },
      ],
    },
    en: {
      intro: 'The Hanseatic trading quarter of Bergen, a UNESCO World Heritage Site since 1979. The wooden houses stand on the same plots as 900 years ago.',
      sceneDescription: 'You are standing on a broad quay with the harbour basin behind you. In front of you is a tight row of narrow wooden houses, shoulder to shoulder, painted red, ochre, white and yellow. The gables are pointed and face you like a row of teeth. The houses lean slightly against one another. Between them, narrow dark passages open into the block.',
      segments: [
        {
          id: 'hansa',
          narration: 'From around 1350 until the 1750s the German Hanseatic League ran a trading office here – one of four in Europe. The merchants exchanged grain from the Baltic for dried cod from northern Norway. They lived under strict rules: no women, no fires in the houses, and all trade in German.',
          audioDescription: 'In front of you the house fronts are built of horizontal and vertical timber boards, many crooked and bulging with age. The windows are small, with glazing bars. Above some doors hang old signs with German names.',
        },
        {
          id: 'fires',
          narration: 'Bryggen has burned at least seven times. After the great fire of 1702 everything was rebuilt on the old foundations, with the same narrow plots and passages. That is why the lanes here look medieval, even though the houses date from the 1700s.',
          audioDescription: 'Step into one of the passages: it is only a couple of metres wide, with wooden houses close on both sides leaning inward. The floor is wooden planking. Small old windows and stairs hang everywhere, and light comes in narrow strips from above.',
        },
        {
          id: 'archaeology',
          narration: 'In the fire of 1955 a third of Bryggen was lost – but in the ashes archaeologists found thousands of rune sticks, shoes, tools and coins from the 1100s onward. Bryggens Museum, just behind you, stands on top of the excavation site itself.',
          audioDescription: 'Behind the row of houses, to the right, you see a modern brick building in dark red with large windows: Bryggens Museum. In front of the museum is an open square with benches and a small fountain basin.',
        },
        {
          id: 'today',
          narration: 'Today Bryggen houses artists, craftspeople, restaurants and a Hanseatic museum. 62 of the original buildings remain, and craftsmen still restore them with 18th-century techniques – without a single nail where there was no nail before.',
          audioDescription: 'Look closer at the façades and you find small shop windows with knitted sweaters, woodwork and jewellery. Above you a thin web of cords with hanging lanterns runs between the houses. Behind the row of houses the mountain Fløyen rises steeply, green and forested.',
        },
      ],
    },
  },
};

const nidaros: Attraction = {
  id: 'trondheim-nidarosdomen',
  name: { en: 'Nidaros Cathedral', nb: 'Nidarosdomen', de: 'Nidarosdom', fr: 'Cathédrale de Nidaros', es: 'Catedral de Nidaros', it: 'Cattedrale di Nidaros', pl: 'Katedra Nidaros', uk: 'Нідароський собор', ja: 'ニーダロス大聖堂', zh: '尼达罗斯大教堂', ar: 'كاتدرائية نيداروس' },
  place: 'Trondheim',
  country: 'Norge',
  position: { lat: 63.4269, lng: 10.3969 },
  durationMin: 8,
  quickBuyNok: 29,
  hue: 260,
  heroAlt: {
    en: 'A Gothic cathedral in dark green-grey soapstone with a richly sculpted west front and a large rose window.',
    nb: 'En gotisk katedral i mørk grågrønn kleberstein med en rikt skulpturert vestfront og et stort rosevindu.',
  },
  scripts: {
    nb: {
      intro: 'Verdens nordligste middelalderkatedral, bygget over Olav den helliges grav. Norges kroningskirke og pilegrimsmål i tusen år.',
      sceneDescription: 'Du står på en åpen, gresskledd plass foran en enorm katedral i mørk, grågrønn stein. Vestveggen foran deg er dekket fra bakken til taket med statuer i rader – helgener, konger og bibelske figurer i nisjer. Midt i veggen er et stort, rundt vindu med glass i røde og blå toner. To firkantede tårn rammer inn fasaden, og et slankt spir stiger opp bak dem.',
      segments: [
        {
          id: 'olav',
          narration: 'I 1030 falt kong Olav Haraldsson i slaget på Stiklestad. Året etter ble han erklært hellig, og over graven hans reiste man først et lite trekapell, så en steinkirke, og fra 1070 denne katedralen. I middelalderen kom pilegrimer hit fra hele Nord-Europa.',
          audioDescription: 'Foran deg er katedralens hovedinngang: en høy, spissbuet portal i mørk stein, omgitt av flere lag med utskårne bueganger. Steinen er så mørk at den nesten virker svart i skyggen, og grønnaktig i sollys.',
        },
        {
          id: 'west-front',
          narration: 'Vestfronten er den mest dekorerte i Norden – men nesten alt du ser, er fra 1900-tallet. Katedralen brant flere ganger og forfalt etter reformasjonen, og gjenreisingen tok fra 1869 til 2001. Skulpturene ble hugget av moderne kunstnere; en av dem, «Askeladden», har billedhuggerens eget ansikt.',
          audioDescription: 'Se opp langs veggen: over inngangen står tre rader med statuer i menneskestørrelse, hver i sin egen nisje med spissbue over. De nederste er konger med kroner og sverd, over dem apostler og helgener. Øverst troner Kristus med armene utstrakt.',
        },
        {
          id: 'rose-window',
          narration: 'Rosevinduet er åtte meter i diameter og ble ferdig i 1930, til 900-årsjubileet for Olavs død. Det fremstiller dommedag. Går du inn, oppdager du at katedralen er så mørk at vinduene virker som brennende smykker i steinen.',
          audioDescription: 'Midt på vestfronten, over statuene, sitter et stort rundt vindu som et hjul med eiker av stein. Glasset skifter mellom dyp rød, mørk blå og gyllen. Nedenfra ser du bare mønsteret; innenfra lyser det som ild.',
        },
        {
          id: 'coronation',
          narration: 'Fra 1814 ble det grunnlovsfestet at norske konger skulle krones her. Siste kroning var Haakon den sjuende i 1906. I dag signes kongene i stedet – Harald og Sonja i 1991 – og kronregaliene oppbevares i erkebispegården ved siden av.',
          audioDescription: 'Til venstre for katedralen ligger en lav, lang bygning i grå stein med små vinduer og en borggård innenfor: Erkebispegården. Mellom bygningene er en åpen, gruslagt plass. Rundt hele området går en lav steinmur, og bak den ligger en gravlund med gamle, skjeve gravsteiner under store trær.',
        },
      ],
    },
    en: {
      intro: 'The world’s northernmost medieval cathedral, built over the grave of Saint Olav. Norway’s coronation church and a pilgrimage destination for a thousand years.',
      sceneDescription: 'You are standing on an open grassy square in front of an enormous cathedral of dark, green-grey stone. The west wall before you is covered from ground to roof with rows of statues – saints, kings and biblical figures in niches. In the centre of the wall is a large round window in shades of red and blue glass. Two square towers frame the façade, and a slender spire rises behind them.',
      segments: [
        {
          id: 'olav',
          narration: 'In 1030 King Olav Haraldsson fell at the Battle of Stiklestad. The following year he was declared a saint, and over his grave rose first a small wooden chapel, then a stone church, and from 1070 this cathedral. In the Middle Ages pilgrims came here from all over northern Europe.',
          audioDescription: 'In front of you is the cathedral’s main entrance: a tall, pointed-arch portal in dark stone, surrounded by several layers of carved arches. The stone is so dark it appears almost black in shadow and greenish in sunlight.',
        },
        {
          id: 'west-front',
          narration: 'The west front is the most richly decorated in the Nordic countries – but almost everything you see dates from the 20th century. The cathedral burned several times and fell into decay after the Reformation, and the rebuilding lasted from 1869 to 2001. The sculptures were carved by modern artists; one of them, “Askeladden”, bears the sculptor’s own face.',
          audioDescription: 'Look up along the wall: above the entrance stand three rows of life-size statues, each in its own niche beneath a pointed arch. The lowest are kings with crowns and swords, above them apostles and saints. At the very top Christ is enthroned with arms outstretched.',
        },
        {
          id: 'rose-window',
          narration: 'The rose window is eight metres across and was completed in 1930, for the 900th anniversary of Olav’s death. It depicts the Last Judgement. Step inside and you discover the cathedral is so dark that the windows look like burning jewels set in the stone.',
          audioDescription: 'In the middle of the west front, above the statues, sits a great round window like a wheel with spokes of stone. The glass shifts between deep red, dark blue and gold. From below you see only the pattern; from inside it glows like fire.',
        },
        {
          id: 'coronation',
          narration: 'From 1814 the constitution decreed that Norwegian kings should be crowned here. The last coronation was Haakon the seventh in 1906. Today monarchs are blessed instead – Harald and Sonja in 1991 – and the crown regalia are kept in the Archbishop’s Palace next door.',
          audioDescription: 'To the left of the cathedral lies a low, long building of grey stone with small windows and a courtyard within: the Archbishop’s Palace. Between the buildings is an open gravelled square. A low stone wall runs around the whole area, and behind it lies a churchyard with old, leaning gravestones under large trees.',
        },
      ],
    },
  },
};

const preikestolen: Attraction = {
  id: 'rogaland-preikestolen',
  name: { en: 'Preikestolen (Pulpit Rock)', nb: 'Preikestolen', de: 'Preikestolen (Predigtstuhl)', fr: 'Preikestolen (Rocher de la Chaire)', es: 'Preikestolen (El Púlpito)', it: 'Preikestolen (Il Pulpito)', pl: 'Preikestolen (Ambona)', uk: 'Прекестулен', ja: 'プレーケストーレン', zh: '布道石', ar: 'صخرة المنبر' },
  place: 'Lysefjorden, Rogaland',
  country: 'Norge',
  position: { lat: 58.9864, lng: 6.1904 },
  durationMin: 5,
  quickBuyNok: 29,
  hue: 160,
  heroAlt: {
    en: 'A flat square rock plateau jutting out over a deep blue fjord, 600 metres below.',
    nb: 'Et flatt, firkantet fjellplatå som stikker ut over en dyp blå fjord, 600 meter nedenfor.',
  },
  scripts: {
    nb: {
      intro: 'Et flatt fjellplatå 604 meter rett over Lysefjorden. Turen opp er 4 kilometer hver vei – belønningen er en av Norges mest berømte utsikter.',
      sceneDescription: 'Du står på et nesten helt flatt platå av grå granitt, omtrent 25 ganger 25 meter, som stikker rett ut fra fjellsiden. Tre av sidene ender i loddrette stup. Langt der nede, 600 meter under deg, ligger Lysefjorden som et smalt, mørkeblått bånd mellom bratte, grå fjellvegger med grønne flekker av skog. Det er ikke noe rekkverk.',
      segments: [
        {
          id: 'geology',
          narration: 'Preikestolen ble formet for rundt ti tusen år siden, da isbreen som fylte Lysefjorden smeltet. Frost sprengte fjellet langs sprekker og etterlot denne firkantede blokken. Geologene følger med på sprekken bak platået – men den har ikke rørt seg på flere tusen år.',
          audioDescription: 'Bak deg, der platået møter fjellsiden, går en tydelig sprekk i steinen, omtrent en håndsbredd bred, på tvers av hele platået. Fjellet er lyst grått med mørkere striper og små dammer av regnvann i fordypningene.',
        },
        {
          id: 'name',
          narration: 'Navnet betyr «prekestolen» – platået ligner på en gammel kirkes talerstol. Fram til begynnelsen av 1900-tallet var stedet ukjent for de fleste; det var Stavanger Turistforening som merket stien i 1900 og gjorde det til et turmål.',
          audioDescription: 'Fra platåets kant kan du se fjorden bøye seg både til venstre og til høyre. Små, hvite båter krysser den langt der nede, mindre enn en fingernegl. På motsatt side reiser det seg et fjell like høyt som det du står på.',
        },
        {
          id: 'today',
          narration: 'I dag går rundt 300 000 mennesker turen hvert år, i en sti som sherpaer fra Nepal har lagt med stein. Turen tar to timer opp og halvannen ned. Hold god avstand til kanten – og ikke gå hit i tåke eller på is.',
          audioDescription: 'Rundt deg sitter og står andre turgåere, mange et par meter fra kanten, noen med bena dinglende utfor. Stien du kom opp, ligger bak deg til høyre og forsvinner ned mellom store steinblokker og krokete bjørketrær.',
        },
      ],
    },
    en: {
      intro: 'A flat rock plateau 604 metres straight above the Lysefjord. The hike up is 4 kilometres each way – the reward is one of Norway’s most famous views.',
      sceneDescription: 'You are standing on an almost perfectly flat plateau of grey granite, about 25 by 25 metres, jutting straight out from the mountainside. Three of its sides end in sheer drops. Far below, 600 metres beneath you, the Lysefjord lies like a narrow, dark-blue ribbon between steep grey rock walls with green patches of forest. There is no railing.',
      segments: [
        {
          id: 'geology',
          narration: 'Preikestolen was formed around ten thousand years ago, when the glacier that filled the Lysefjord melted. Frost split the rock along cracks and left this square block behind. Geologists monitor the crack behind the plateau – but it has not moved in thousands of years.',
          audioDescription: 'Behind you, where the plateau meets the mountainside, a clear crack runs across the rock, about a hand’s width wide, spanning the whole plateau. The rock is pale grey with darker stripes and small pools of rainwater in the hollows.',
        },
        {
          id: 'name',
          narration: 'The name means “the pulpit” – the plateau resembles the pulpit of an old church. Until the early 1900s the place was unknown to most people; it was the Stavanger Trekking Association that marked the trail in 1900 and made it a destination.',
          audioDescription: 'From the plateau’s edge you can see the fjord bending both to the left and to the right. Small white boats cross it far below, smaller than a fingernail. On the far side rises a mountain as high as the one you are standing on.',
        },
        {
          id: 'today',
          narration: 'Today around 300,000 people make the hike each year, on a trail that sherpas from Nepal have paved with stone. It takes two hours up and an hour and a half down. Keep well back from the edge – and do not come here in fog or ice.',
          audioDescription: 'Around you other hikers sit and stand, many a couple of metres from the edge, some with their legs dangling over. The trail you came up lies behind you to the right and disappears down between large boulders and crooked birch trees.',
        },
      ],
    },
  },
};

export const ATTRACTIONS: readonly Attraction[] = [
  operahuset,
  akershus,
  vigeland,
  holmenkollen,
  bryggen,
  nidaros,
  preikestolen,
];

export function attractionById(id: string): Attraction | undefined {
  return ATTRACTIONS.find((a) => a.id === id);
}

export function localizedName(a: Attraction, lang: LanguageCode): string {
  return a.name[lang] ?? a.name.en;
}

export function localizedHeroAlt(a: Attraction, lang: LanguageCode): string {
  return a.heroAlt[lang] ?? a.heroAlt.en;
}

export interface ResolvedScript {
  script: GuideScript;
  /** Språket manuset faktisk er på (kan avvike fra ønsket språk). */
  lang: LanguageCode;
  isFallback: boolean;
}

/** Finn manus på ønsket språk, ellers engelsk. */
export function resolveScript(a: Attraction, lang: LanguageCode): ResolvedScript {
  const script = a.scripts[lang];
  if (script) return { script, lang, isFallback: false };
  return { script: a.scripts.en, lang: 'en', isFallback: true };
}
