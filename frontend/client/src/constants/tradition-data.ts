// Tradition-specific budget templates and contextual hints
// Used by CreatorHub frontend components for tradition-aware planning
// All 17 synced cultural keys matching wedflow ↔ CreatorHub bridge

export interface TraditionBudgetItem {
  category: string;
  label: string;
  estimatedCost: number;
}

export const TRADITION_BUDGET_ITEMS: Record<string, TraditionBudgetItem[]> = {
  norsk: [
    { category: 'attire', label: 'Brudekrone i sølv', estimatedCost: 8000 },
    { category: 'attire', label: 'Bunadstilpasning', estimatedCost: 15000 },
    { category: 'catering', label: 'Kransekake', estimatedCost: 5000 },
    { category: 'music', label: 'Felespiller (Hardingfele)', estimatedCost: 8000 },
  ],
  sikh: [
    { category: 'venue', label: 'Gurdwara-leie', estimatedCost: 10000 },
    { category: 'catering', label: 'Langar-catering', estimatedCost: 20000 },
    { category: 'music', label: 'Dhol-spillere', estimatedCost: 5000 },
    { category: 'attire', label: 'Kalire (armbånd)', estimatedCost: 3000 },
  ],
  indisk: [
    { category: 'venue', label: 'Mandap-dekorasjon', estimatedCost: 20000 },
    { category: 'other', label: 'Mehndi/Henna-artist', estimatedCost: 5000 },
    { category: 'music', label: 'Sangeet-DJ/band', estimatedCost: 8000 },
    { category: 'attire', label: 'Mangalsutra-halskjede', estimatedCost: 6000 },
  ],
  pakistansk: [
    { category: 'other', label: 'Mehndi-fest (henna + dholki)', estimatedCost: 15000 },
    { category: 'other', label: 'Baraat-dekorasjon', estimatedCost: 10000 },
    { category: 'other', label: 'Henna-artist', estimatedCost: 3000 },
    { category: 'attire', label: 'Pakistansk brudedrakt', estimatedCost: 20000 },
  ],
  tyrkisk: [
    { category: 'other', label: 'Kına Gecesi-feiring', estimatedCost: 8000 },
    { category: 'other', label: 'Takı (gullsmykker til seremoni)', estimatedCost: 20000 },
    { category: 'music', label: 'Tradisjonell halay-musikk', estimatedCost: 6000 },
  ],
  arabisk: [
    { category: 'music', label: 'Zaffe-musikere og dansere', estimatedCost: 12000 },
    { category: 'other', label: 'Henna-kveld', estimatedCost: 5000 },
    { category: 'music', label: 'Dabke-band', estimatedCost: 8000 },
  ],
  somalisk: [
    { category: 'attire', label: 'Dirac/Guntiino-antrekk (flere)', estimatedCost: 12000 },
    { category: 'other', label: 'Shaash Saar-seremoni', estimatedCost: 3000 },
    { category: 'music', label: 'Tradisjonell Niiko-musikk', estimatedCost: 6000 },
  ],
  etiopisk: [
    { category: 'other', label: 'Kaffe-seremoni utstyr', estimatedCost: 3000 },
    { category: 'catering', label: 'Tradisjonell Injera-catering', estimatedCost: 15000 },
    { category: 'music', label: 'Eskista-musiker', estimatedCost: 5000 },
  ],
  nigeriansk: [
    { category: 'attire', label: 'Aso-Oke stoff (brudeparet)', estimatedCost: 15000 },
    { category: 'attire', label: 'Aso-Oke stoff (familie)', estimatedCost: 10000 },
    { category: 'other', label: 'Palmvin til seremoni', estimatedCost: 2000 },
  ],
  muslimsk: [
    { category: 'other', label: 'Mehr (brudens gave)', estimatedCost: 20000 },
    { category: 'other', label: 'Mehndi-kveld', estimatedCost: 8000 },
    { category: 'catering', label: 'Halal-catering tillegg', estimatedCost: 5000 },
  ],
  libanesisk: [
    { category: 'music', label: 'Zaffe-innmarsj med trommer', estimatedCost: 10000 },
    { category: 'music', label: 'Dabke-dansere', estimatedCost: 8000 },
    { category: 'catering', label: 'Libanesisk meze-buffet tillegg', estimatedCost: 10000 },
  ],
  filipino: [
    { category: 'other', label: 'Arras (13 mynter)', estimatedCost: 2000 },
    { category: 'other', label: 'Veil & Cord-sett', estimatedCost: 1500 },
    { category: 'other', label: 'Despedida de Soltera fest', estimatedCost: 5000 },
  ],
  kinesisk: [
    { category: 'other', label: 'Te-seremoni sett', estimatedCost: 3000 },
    { category: 'attire', label: 'Qipao (rød brudedrakt)', estimatedCost: 12000 },
    { category: 'other', label: 'Dobbelt Lykke-dekorasjoner', estimatedCost: 4000 },
    { category: 'other', label: 'Røde konvolutter', estimatedCost: 1000 },
  ],
  koreansk: [
    { category: 'attire', label: 'Hanbok (tradisjonelle klær)', estimatedCost: 10000 },
    { category: 'other', label: 'Pyebaek-seremoni utstyr', estimatedCost: 3000 },
    { category: 'other', label: 'Jujube og kastanjer', estimatedCost: 500 },
  ],
  thai: [
    { category: 'other', label: 'Khan Maak-prosesjon gaver', estimatedCost: 8000 },
    { category: 'other', label: 'Sai Sin (hellige tråder)', estimatedCost: 1000 },
    { category: 'other', label: 'Sinsod (brudepris)', estimatedCost: 25000 },
  ],
  iransk: [
    { category: 'other', label: 'Sofreh-e Aghd (bryllupsbord)', estimatedCost: 8000 },
    { category: 'other', label: 'Speil, kandelaber og symboler', estimatedCost: 5000 },
    { category: 'other', label: 'Honning og sukker-ritualer', estimatedCost: 1000 },
  ],
  annet: [],
};

// Contextual tradition hints per vendor/planning category
export interface TraditionHint {
  message: string;
  icon: string;
}

export function getTraditionHints(traditions: string[], category: string): TraditionHint[] {
  const hints: TraditionHint[] = [];

  const HINT_MAP: Record<string, Record<string, TraditionHint>> = {
    norsk: {
      catering: { message: 'Kransekake er norsk tradisjon — vurder å ha den i stedet for eller i tillegg til vanlig bryllupskake', icon: 'Cake' },
      music: { message: 'Hardingfele under innmarsjen er en vakker norsk bryllupstradisjon', icon: 'MusicNote' },
      attire: { message: 'Mange norske bruder velger bunad i stedet for hvit kjole', icon: 'Checkroom' },
      cake: { message: 'Kransekake (mandel-ringkake) er den tradisjonelle norske bryllupskaken', icon: 'Cake' },
      flowers: { message: 'Norske fjellblomster og ville vekster gir et autentisk norsk preg', icon: 'LocalFlorist' },
    },
    sikh: {
      catering: { message: 'Langar (felles vegetarisk måltid) er en viktig del av Sikh-bryllup', icon: 'Restaurant' },
      music: { message: 'Dhol-trommer og Shabad Kirtan er tradisjonelle i Sikh-bryllup', icon: 'MusicNote' },
      venue: { message: 'Anand Karaj-seremonien gjennomføres tradisjonelt i en Gurdwara', icon: 'Church' },
      attire: { message: 'Rød og gull er tradisjonelle farger for Sikh-brud', icon: 'Checkroom' },
    },
    indisk: {
      catering: { message: 'Vegetariske alternativer foretrekkes i mange hinduistiske bryllup', icon: 'Restaurant' },
      attire: { message: 'Rød brudedrakt (lehenga/sari) er tradisjonelt for Hindu-bryllup', icon: 'Checkroom' },
      flowers: { message: 'Jasmin og ringblomst (marigold) er viktige blomster i Hindu-bryllup', icon: 'LocalFlorist' },
      music: { message: 'Sangeet-kvelden er en viktig musikkfeiring før bryllupet', icon: 'MusicNote' },
      venue: { message: 'Mandap (dekorert bryllupshytte) er sentral i Hindu-seremonien', icon: 'Church' },
    },
    pakistansk: {
      catering: { message: 'Husk halal-sertifisert catering for pakistansk bryllup', icon: 'Restaurant' },
      attire: { message: 'Tradisjonelle farger er rød, gull og grønn for pakistansk brud', icon: 'Checkroom' },
      music: { message: 'Dholki-tromme og Bollywood-musikk er populært på Mehndi-kvelden', icon: 'MusicNote' },
    },
    tyrkisk: {
      catering: { message: 'Tyrkisk bryllup serverer ofte storslått buffet med kebab og baklava', icon: 'Restaurant' },
      music: { message: 'Halay-dans i ring er en viktig del av tyrkiske bryllup', icon: 'MusicNote' },
      attire: { message: 'Gullsmykker (Takı) er tradisjonelle bryllupsgaver i tyrkisk kultur', icon: 'Checkroom' },
    },
    arabisk: {
      catering: { message: 'Halal-mat og rikelig meze-bord er standard i arabiske bryllup', icon: 'Restaurant' },
      music: { message: 'Zaffe-innmarsj med trommer og ululating setter stemningen', icon: 'MusicNote' },
      venue: { message: 'Separerte områder for kvinner og menn kan være viktig', icon: 'Church' },
    },
    somalisk: {
      catering: { message: 'Halal-mat og tradisjonelle somaliske retter (bariis, suugo) er viktige', icon: 'Restaurant' },
      attire: { message: 'Bruden bærer flere antrekk (Dirac) gjennom feiringen', icon: 'Checkroom' },
      music: { message: 'Niiko-dans og tradisjonell somalisk musikk er sentrale', icon: 'MusicNote' },
    },
    etiopisk: {
      catering: { message: 'Injera med ulike wot-sauser er tradisjonell etiopisk bryllupsmat', icon: 'Restaurant' },
      music: { message: 'Eskista (skulder-dans) er en viktig del av etiopisk bryllupsfeiring', icon: 'MusicNote' },
    },
    nigeriansk: {
      catering: { message: 'Jollof-ris er en uunngåelig del av nigeriansk bryllupsmat', icon: 'Restaurant' },
      attire: { message: 'Aso-Oke-stoff i matchende farge for familien er tradisjonelt', icon: 'Checkroom' },
    },
    muslimsk: {
      catering: { message: 'Husk halal-sertifisert catering — ingen alkohol tradisjonelt', icon: 'Restaurant' },
      venue: { message: 'Vurder Nikah i moské og separat fest — eller kombinert', icon: 'Church' },
      attire: { message: 'Beskjeden påkledning forventes — vurder hijab-vennlige alternativer', icon: 'Checkroom' },
    },
    libanesisk: {
      catering: { message: 'Storslått meze-bord med hummus, kibbe og tabbouleh er essensielt', icon: 'Restaurant' },
      music: { message: 'Zaffe og Dabke-dans er høydepunkter i libanesiske bryllup', icon: 'MusicNote' },
    },
    filipino: {
      venue: { message: 'Katolsk kirke er tradisjonelt — book tidlig', icon: 'Church' },
      catering: { message: 'Lechon (helstekt gris) er tradisjonell bryllupsmat', icon: 'Restaurant' },
    },
    kinesisk: {
      catering: { message: 'Te-seremoni med foreldre er en viktig del av kinesisk bryllup', icon: 'Restaurant' },
      attire: { message: 'Rød kjole (Qipao) med dragebroderier er tradisjonelt for kinesisk brud', icon: 'Checkroom' },
      flowers: { message: 'Pioner og lotus er symbolske blomster i kinesisk bryllupskultur', icon: 'LocalFlorist' },
    },
    koreansk: {
      attire: { message: 'Hanbok i sterke farger bæres under Pyebaek-seremonien', icon: 'Checkroom' },
      catering: { message: 'Tradisjonelt koreansk bryllupsbord med symbolske frukter', icon: 'Restaurant' },
    },
    thai: {
      venue: { message: 'Buddhistisk tempel for Sai Sin-seremoni er tradisjonelt', icon: 'Church' },
      catering: { message: 'Thai-mat med symbolske retter for lykke og velstand', icon: 'Restaurant' },
    },
    iransk: {
      catering: { message: 'Honning og sukker er symbolske deler av persisk bryllupsseremoni', icon: 'Restaurant' },
      flowers: { message: 'Sofreh-e Aghd inkluderer symbolske blomster og urter', icon: 'LocalFlorist' },
    },
  };

  for (const tradition of traditions) {
    const categoryHints = HINT_MAP[tradition];
    if (categoryHints && categoryHints[category]) {
      hints.push(categoryHints[category]);
    }
  }

  return hints;
}

// Tradition checklist items (client mirror of backend data for preview)
export interface TraditionChecklistItem {
  title: string;
  monthsBefore: number;
  category: string;
}

export const TRADITION_CHECKLIST_ITEMS: Record<string, TraditionChecklistItem[]> = {
  norsk: [
    { title: 'Bestill brudekrone i sølv', monthsBefore: 6, category: 'attire' },
    { title: 'Arranger bunadstilpasning', monthsBefore: 5, category: 'attire' },
    { title: 'Book kransekakebaker', monthsBefore: 4, category: 'vendors' },
    { title: 'Bestill felespiller til vielsen', monthsBefore: 4, category: 'vendors' },
    { title: 'Planlegg brudevalsen', monthsBefore: 2, category: 'planning' },
  ],
  sikh: [
    { title: 'Book Gurdwara for Anand Karaj', monthsBefore: 10, category: 'vendors' },
    { title: 'Arranger Milni-seremoni', monthsBefore: 3, category: 'planning' },
    { title: 'Planlegg Langar (felles måltid)', monthsBefore: 4, category: 'vendors' },
    { title: 'Book Dhol-spillere', monthsBefore: 4, category: 'vendors' },
  ],
  indisk: [
    { title: 'Bestill Mehndi/Henna-artist', monthsBefore: 4, category: 'vendors' },
    { title: 'Arranger Sangeet-kveld', monthsBefore: 3, category: 'planning' },
    { title: 'Bestill Mandap-dekorasjon', monthsBefore: 4, category: 'vendors' },
  ],
  pakistansk: [
    { title: 'Bestill henna-artist (Mehndi)', monthsBefore: 4, category: 'vendors' },
    { title: 'Planlegg Dholki-kveld', monthsBefore: 3, category: 'planning' },
    { title: 'Book imam for Nikkah', monthsBefore: 6, category: 'vendors' },
    { title: 'Planlegg Walima-resepsjon', monthsBefore: 3, category: 'planning' },
  ],
  tyrkisk: [
    { title: 'Planlegg Kına Gecesi', monthsBefore: 2, category: 'planning' },
    { title: 'Forbered Takı Töreni', monthsBefore: 1, category: 'planning' },
  ],
  arabisk: [
    { title: 'Book imam for Nikah', monthsBefore: 6, category: 'vendors' },
    { title: 'Arranger Zaffe-innmarsj', monthsBefore: 3, category: 'vendors' },
  ],
  somalisk: [
    { title: 'Book imam for Nikah', monthsBefore: 6, category: 'vendors' },
    { title: 'Bestill Dirac/Guntiino', monthsBefore: 5, category: 'attire' },
  ],
  etiopisk: [
    { title: 'Planlegg Telosh-seremoni', monthsBefore: 2, category: 'planning' },
    { title: 'Arranger kaffe-seremoni', monthsBefore: 1, category: 'planning' },
  ],
  nigeriansk: [
    { title: 'Bestill Aso-Oke-stoff', monthsBefore: 5, category: 'attire' },
    { title: 'Planlegg Traditional Wedding', monthsBefore: 4, category: 'planning' },
  ],
  muslimsk: [
    { title: 'Book imam for Nikah', monthsBefore: 6, category: 'vendors' },
    { title: 'Bestill halal-catering', monthsBefore: 5, category: 'vendors' },
    { title: 'Planlegg Walima', monthsBefore: 3, category: 'planning' },
  ],
  libanesisk: [
    { title: 'Arranger Zaffe-innmarsj', monthsBefore: 3, category: 'vendors' },
    { title: 'Book Dabke-dansere', monthsBefore: 3, category: 'vendors' },
  ],
  filipino: [
    { title: 'Bestill Arras (13 mynter)', monthsBefore: 2, category: 'attire' },
    { title: 'Planlegg Veil & Cord-seremoni', monthsBefore: 2, category: 'planning' },
  ],
  kinesisk: [
    { title: 'Planlegg te-seremoni', monthsBefore: 2, category: 'planning' },
    { title: 'Bestill Qipao', monthsBefore: 5, category: 'attire' },
  ],
  koreansk: [
    { title: 'Bestill Hanbok til Pyebaek', monthsBefore: 4, category: 'attire' },
    { title: 'Planlegg Pyebaek-seremoni', monthsBefore: 2, category: 'planning' },
  ],
  thai: [
    { title: 'Planlegg Khan Maak-prosesjon', monthsBefore: 2, category: 'logistics' },
    { title: 'Book munk for Sai Sin', monthsBefore: 4, category: 'vendors' },
  ],
  iransk: [
    { title: 'Bestill Sofreh-e Aghd', monthsBefore: 3, category: 'logistics' },
    { title: 'Planlegg Aghd-seremoni', monthsBefore: 2, category: 'planning' },
  ],
  annet: [],
};

// Cultural labels for display in UI
export const CULTURAL_LABELS: Record<string, string> = {
  norsk: 'Norsk',
  sikh: 'Sikh',
  indisk: 'Indisk (Hindu)',
  pakistansk: 'Pakistansk',
  tyrkisk: 'Tyrkisk',
  arabisk: 'Arabisk',
  somalisk: 'Somalisk',
  etiopisk: 'Etiopisk',
  nigeriansk: 'Nigeriansk',
  muslimsk: 'Muslimsk',
  libanesisk: 'Libanesisk',
  filipino: 'Filipino',
  kinesisk: 'Kinesisk',
  koreansk: 'Koreansk',
  thai: 'Thai',
  iransk: 'Iransk/Persisk',
  annet: 'Annet',
};
