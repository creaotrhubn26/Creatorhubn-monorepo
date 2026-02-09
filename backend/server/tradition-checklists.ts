// Tradition-specific checklist items for all 17 synced cultural keys
// Used by POST /api/wedflow/checklist/seed-traditions endpoint

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
    { title: 'Bestill Kalire til bruden', monthsBefore: 3, category: 'attire' },
    { title: 'Planlegg Doli (brudens avreise)', monthsBefore: 1, category: 'logistics' },
  ],
  indisk: [
    { title: 'Bestill Mehndi/Henna-artist', monthsBefore: 4, category: 'vendors' },
    { title: 'Arranger Sangeet-kveld', monthsBefore: 3, category: 'planning' },
    { title: 'Bestill Mandap-dekorasjon', monthsBefore: 4, category: 'vendors' },
    { title: 'Planlegg Saptapadi (syv skritt)', monthsBefore: 2, category: 'planning' },
    { title: 'Bestill Mangalsutra-halskjede', monthsBefore: 3, category: 'attire' },
    { title: 'Arranger Vidai-seremoni', monthsBefore: 1, category: 'planning' },
  ],
  pakistansk: [
    { title: 'Bestill henna-artist (Mehndi)', monthsBefore: 4, category: 'vendors' },
    { title: 'Planlegg Dholki-kveld', monthsBefore: 3, category: 'planning' },
    { title: 'Arranger Baraat-prosesjon', monthsBefore: 2, category: 'logistics' },
    { title: 'Book imam for Nikkah-seremoni', monthsBefore: 6, category: 'vendors' },
    { title: 'Planlegg Walima-resepsjon', monthsBefore: 3, category: 'planning' },
    { title: 'Bestill pakistansk brudedrakt', monthsBefore: 6, category: 'attire' },
  ],
  tyrkisk: [
    { title: 'Planlegg Kına Gecesi (henna-kveld)', monthsBefore: 2, category: 'planning' },
    { title: 'Forbered Takı Töreni (gullseremoni)', monthsBefore: 1, category: 'planning' },
    { title: 'Arranger Gelin Alma (hente bruden)', monthsBefore: 1, category: 'logistics' },
    { title: 'Book lokale for Düğün-feiring', monthsBefore: 8, category: 'vendors' },
  ],
  arabisk: [
    { title: 'Book imam for Nikah', monthsBefore: 6, category: 'vendors' },
    { title: 'Arranger Zaffe-innmarsj med musikere', monthsBefore: 3, category: 'vendors' },
    { title: 'Planlegg henna-kveld', monthsBefore: 2, category: 'planning' },
    { title: 'Bestill arabisk brudedrakt', monthsBefore: 5, category: 'attire' },
  ],
  somalisk: [
    { title: 'Book imam for Nikah-seremoni', monthsBefore: 6, category: 'vendors' },
    { title: 'Bestill Dirac/Guntiino bryllupsantrekk', monthsBefore: 5, category: 'attire' },
    { title: 'Planlegg Shaash Saar (slør-seremoni)', monthsBefore: 2, category: 'planning' },
    { title: 'Arranger Aroos-feiring med Niiko-dans', monthsBefore: 3, category: 'planning' },
  ],
  etiopisk: [
    { title: 'Planlegg Telosh (førbryllupsseremoni)', monthsBefore: 2, category: 'planning' },
    { title: 'Arranger tradisjonell kaffe-seremoni', monthsBefore: 1, category: 'planning' },
    { title: 'Bestill Injera og tradisjonell mat (Melse)', monthsBefore: 3, category: 'vendors' },
    { title: 'Inviter eldre til Tilf-velsignelse', monthsBefore: 1, category: 'planning' },
  ],
  nigeriansk: [
    { title: 'Bestill Aso-Oke-stoff til brudeparet', monthsBefore: 5, category: 'attire' },
    { title: 'Planlegg Traditional Wedding-seremoni', monthsBefore: 4, category: 'planning' },
    { title: 'Bestill palmvin til seremonien', monthsBefore: 2, category: 'vendors' },
    { title: 'Koordiner familiestoff-farge', monthsBefore: 4, category: 'attire' },
  ],
  muslimsk: [
    { title: 'Book imam for Nikah-seremoni', monthsBefore: 6, category: 'vendors' },
    { title: 'Bestill halal-catering', monthsBefore: 5, category: 'vendors' },
    { title: 'Planlegg Walima-resepsjon', monthsBefore: 3, category: 'planning' },
    { title: 'Bestill Mehndi/henna-artist', monthsBefore: 3, category: 'vendors' },
    { title: 'Avtal Mehr (brudens gave)', monthsBefore: 4, category: 'planning' },
  ],
  libanesisk: [
    { title: 'Planlegg henna-fest', monthsBefore: 2, category: 'planning' },
    { title: 'Arranger Zaffe-innmarsj med trommer', monthsBefore: 3, category: 'vendors' },
    { title: 'Book Dabke-dansere', monthsBefore: 3, category: 'vendors' },
    { title: 'Planlegg libanesisk meze-buffet', monthsBefore: 3, category: 'vendors' },
  ],
  filipino: [
    { title: 'Bestill Arras (13 mynter)', monthsBefore: 2, category: 'attire' },
    { title: 'Planlegg Veil & Cord-seremoni', monthsBefore: 2, category: 'planning' },
    { title: 'Arranger Unity Candle', monthsBefore: 1, category: 'planning' },
    { title: 'Planlegg Despedida de Soltera', monthsBefore: 3, category: 'planning' },
  ],
  kinesisk: [
    { title: 'Planlegg te-seremoni med foreldre', monthsBefore: 2, category: 'planning' },
    { title: 'Bestill Qipao/rød brudedrakt', monthsBefore: 5, category: 'attire' },
    { title: 'Forbered røde konvolutter til gjester', monthsBefore: 1, category: 'logistics' },
    { title: 'Planlegg Door Games', monthsBefore: 1, category: 'planning' },
    { title: 'Bestill Dobbelt Lykke-dekorasjoner', monthsBefore: 2, category: 'logistics' },
  ],
  koreansk: [
    { title: 'Bestill Hanbok til Pyebaek-seremoni', monthsBefore: 4, category: 'attire' },
    { title: 'Planlegg Pyebaek med foreldre', monthsBefore: 2, category: 'planning' },
    { title: 'Forbered Jujube og kastanjer', monthsBefore: 1, category: 'logistics' },
    { title: 'Dekker bryllupsbord med symboler', monthsBefore: 1, category: 'logistics' },
  ],
  thai: [
    { title: 'Planlegg Khan Maak-prosesjon', monthsBefore: 2, category: 'logistics' },
    { title: 'Arranger Rod Nam Sang (vann-velsignelse)', monthsBefore: 2, category: 'planning' },
    { title: 'Book buddhistisk munk for Sai Sin', monthsBefore: 4, category: 'vendors' },
    { title: 'Avtal Sinsod med brudens familie', monthsBefore: 4, category: 'planning' },
  ],
  iransk: [
    { title: 'Bestill Sofreh-e Aghd (bryllupsbord)', monthsBefore: 3, category: 'logistics' },
    { title: 'Planlegg Aghd-seremoni', monthsBefore: 2, category: 'planning' },
    { title: 'Bestill speil, kandelaber og symboler', monthsBefore: 3, category: 'logistics' },
    { title: 'Planlegg Knife Dance (kake-dans)', monthsBefore: 1, category: 'planning' },
  ],
  annet: [
    { title: 'Undersøk kulturelle tradisjoner for seremonien', monthsBefore: 8, category: 'planning' },
    { title: 'Finn leverandører med riktig kulturell erfaring', monthsBefore: 6, category: 'vendors' },
  ],
};

// Tradition-specific budget items for all 17 synced cultural keys
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
