/**
 * wedding-culture-templates.ts
 *
 * Kultur-spesifikke event-templater + shot-list-tips for bryllup.
 * Bruker velger kultur i wedding-timeline-form, og vi auto-genererer
 * standard kjøreplan + shot-list som fotograf kan justere.
 *
 * Templates her er BASIS — fotografen og brudeparet kan legge til/fjerne.
 * Tider er relative til "ceremonyStart" (settes når brudeparet fyller form).
 */

export interface CultureEventTemplate {
  /** Relativ minutt-offset fra ceremonyStart (negativ = før). */
  minutesFromCeremony: number;
  /** Anslått varighet i minutter. */
  durationMinutes: number;
  activityName: string;
  activityType: 'preparation' | 'ceremony' | 'photo_session' | 'reception' | 'transport' | 'religious';
  bufferBefore?: number;
  bufferAfter?: number;
  notes?: string;
  /** Auto-genererte shot-id-er som matcher events her. */
  shotIds: string[];
}

export interface CultureShotTemplate {
  id: string;
  scene: string;
  description: string;
  priority: 'must-have' | 'high' | 'medium';
  shotType?: 'wide' | 'close-up' | 'portrait' | 'detail' | 'candid';
}

export interface CultureTemplate {
  id: string;
  displayName: string;
  description: string;
  events: CultureEventTemplate[];
  shots: CultureShotTemplate[];
}

export const WEDDING_CULTURE_TEMPLATES: Record<string, CultureTemplate> = {
  'norsk-kristen': {
    id: 'norsk-kristen',
    displayName: 'Norsk kristen vielse',
    description: 'Tradisjonell norsk vielse i kirke med påfølgende mottakelse',
    events: [
      {
        minutesFromCeremony: -180, durationMinutes: 60,
        activityName: 'Bruden gjør seg klar',
        activityType: 'preparation',
        notes: 'Hos brudens foreldre eller hotell. Sminke, kjole, smykker.',
        shotIds: ['bride-getting-ready', 'dress-detail', 'ring-detail', 'shoes-detail'],
      },
      {
        minutesFromCeremony: -120, durationMinutes: 45,
        activityName: 'Brudgom gjør seg klar',
        activityType: 'preparation',
        shotIds: ['groom-getting-ready', 'cufflinks-detail', 'tie-tying'],
      },
      {
        minutesFromCeremony: -45, durationMinutes: 30,
        activityName: 'Brudens ankomst til kirken',
        activityType: 'transport',
        shotIds: ['bride-arrival', 'father-bride-walk'],
      },
      {
        minutesFromCeremony: 0, durationMinutes: 45,
        activityName: 'Vielse',
        activityType: 'religious',
        notes: 'Husk å spørre prest om foto-regler.',
        shotIds: ['processional', 'vows-exchange', 'ring-exchange', 'first-kiss', 'recessional'],
      },
      {
        minutesFromCeremony: 60, durationMinutes: 30,
        activityName: 'Gratulasjons-kø + ris',
        activityType: 'ceremony',
        shotIds: ['confetti-rice', 'guests-greeting'],
      },
      {
        minutesFromCeremony: 90, durationMinutes: 60,
        activityName: 'Familie- og gruppebilder',
        activityType: 'photo_session',
        notes: 'Forhåndsplanlegg gruppe-liste med brudepar.',
        shotIds: ['family-groom', 'family-bride', 'bridal-party', 'extended-family'],
      },
      {
        minutesFromCeremony: 150, durationMinutes: 60,
        activityName: 'Romantiske brudepar-bilder',
        activityType: 'photo_session',
        notes: 'Gylden time hvis tid tillater.',
        shotIds: ['couple-portrait', 'couple-walking', 'couple-laughing'],
      },
      {
        minutesFromCeremony: 240, durationMinutes: 30,
        activityName: 'Mottakelse + velkomstdrink',
        activityType: 'reception',
        shotIds: ['venue-details', 'table-setting', 'champagne-toast'],
      },
      {
        minutesFromCeremony: 300, durationMinutes: 180,
        activityName: 'Bryllupsmiddag + taler',
        activityType: 'reception',
        notes: 'Få oversikt over hvem som holder taler.',
        shotIds: ['speeches', 'reactions', 'cake-cutting', 'guest-candids'],
      },
      {
        minutesFromCeremony: 480, durationMinutes: 60,
        activityName: 'Brudevals + dans',
        activityType: 'reception',
        shotIds: ['first-dance', 'parent-dance', 'dancefloor'],
      },
    ],
    shots: [
      { id: 'bride-getting-ready', scene: 'Bruden gjør seg klar', description: 'Sminke, kjole-på, smykker. Naturlig lys.', priority: 'must-have', shotType: 'candid' },
      { id: 'dress-detail', scene: 'Kjole detalj', description: 'Henger fra eks. dør, naturlig lys', priority: 'high', shotType: 'detail' },
      { id: 'ring-detail', scene: 'Ringer', description: 'Begge ringer sammen, gjerne med blomst eller invitasjon', priority: 'must-have', shotType: 'detail' },
      { id: 'shoes-detail', scene: 'Sko', description: 'Brudens sko, gjerne stylet', priority: 'medium', shotType: 'detail' },
      { id: 'groom-getting-ready', scene: 'Brudgom forberedelse', description: 'Knytter slips, knapper kne, etc', priority: 'must-have', shotType: 'candid' },
      { id: 'cufflinks-detail', scene: 'Manchet-knapper', description: 'Close-up av detaljer', priority: 'medium', shotType: 'detail' },
      { id: 'tie-tying', scene: 'Knytter slips', description: 'Faren eller forlover hjelper', priority: 'high', shotType: 'candid' },
      { id: 'bride-arrival', scene: 'Brudens ankomst', description: 'Når bilen ankommer kirken', priority: 'must-have', shotType: 'wide' },
      { id: 'father-bride-walk', scene: 'Far + brud før vielse', description: 'Bare for de selv, før de går inn', priority: 'must-have', shotType: 'portrait' },
      { id: 'processional', scene: 'Prosesjonen', description: 'Bruden går nedover midtgangen', priority: 'must-have', shotType: 'wide' },
      { id: 'vows-exchange', scene: 'Bryllupsløfter', description: 'Begge ansikter, gjerne tatt fra siden', priority: 'must-have', shotType: 'close-up' },
      { id: 'ring-exchange', scene: 'Ring-utveksling', description: 'Close-up av hendene', priority: 'must-have', shotType: 'close-up' },
      { id: 'first-kiss', scene: 'Første kyss', description: 'Det offisielle kysset', priority: 'must-have', shotType: 'close-up' },
      { id: 'recessional', scene: 'Ut av kirken', description: 'Brudepar smiler, går ut', priority: 'must-have', shotType: 'wide' },
      { id: 'confetti-rice', scene: 'Ris/konfetti', description: 'Brudepar går gjennom gjestene', priority: 'must-have', shotType: 'wide' },
      { id: 'guests-greeting', scene: 'Gratulasjons-kø', description: 'Genuine reaksjoner', priority: 'high', shotType: 'candid' },
      { id: 'family-groom', scene: 'Brudgommens familie', description: 'Foreldre, søsken', priority: 'must-have', shotType: 'portrait' },
      { id: 'family-bride', scene: 'Brudens familie', description: 'Foreldre, søsken', priority: 'must-have', shotType: 'portrait' },
      { id: 'bridal-party', scene: 'Brudepar + forlovere/brudepiker', description: 'Hele bryllupsfølget', priority: 'must-have', shotType: 'portrait' },
      { id: 'extended-family', scene: 'Storfamilie', description: 'Besteforeldre, onkler, tanter', priority: 'high', shotType: 'portrait' },
      { id: 'couple-portrait', scene: 'Brudepar-portrett', description: 'Stylet, gjerne flere lokasjoner', priority: 'must-have', shotType: 'portrait' },
      { id: 'couple-walking', scene: 'Brudepar går', description: 'I bevegelse, naturlig', priority: 'high', shotType: 'wide' },
      { id: 'couple-laughing', scene: 'Brudepar ler', description: 'Genuine emotion', priority: 'high', shotType: 'candid' },
      { id: 'venue-details', scene: 'Festlokale-detaljer', description: 'Bordpynt, blomster, lyssetting', priority: 'high', shotType: 'detail' },
      { id: 'table-setting', scene: 'Bord-setting', description: 'Før gjestene setter seg', priority: 'medium', shotType: 'detail' },
      { id: 'champagne-toast', scene: 'Champagne-skål', description: 'Velkomst-drink-momentet', priority: 'high', shotType: 'candid' },
      { id: 'speeches', scene: 'Taler', description: 'Hver taler, gjerne med reaksjons-bilde av brudepar', priority: 'must-have', shotType: 'candid' },
      { id: 'reactions', scene: 'Reaksjoner', description: 'Brudepar reagerer på taler, latter, tårer', priority: 'must-have', shotType: 'close-up' },
      { id: 'cake-cutting', scene: 'Skjæring av kake', description: 'Begge sammen', priority: 'must-have', shotType: 'wide' },
      { id: 'guest-candids', scene: 'Gjeste-candids', description: 'Naturlige situasjoner under middag', priority: 'high', shotType: 'candid' },
      { id: 'first-dance', scene: 'Brudevals', description: 'Hele dansen, både wide og close', priority: 'must-have', shotType: 'wide' },
      { id: 'parent-dance', scene: 'Far-datter/mor-sønn-dans', description: 'Tradisjonelle danser', priority: 'high', shotType: 'wide' },
      { id: 'dancefloor', scene: 'Dansegulv', description: 'Energi, glede, bevegelse', priority: 'high', shotType: 'candid' },
    ],
  },

  'norsk-sekulaer': {
    id: 'norsk-sekulaer',
    displayName: 'Norsk borgerlig/sekulær vielse',
    description: 'Borgerlig vielse, ofte på rådhuset eller utendørs',
    events: [
      { minutesFromCeremony: -120, durationMinutes: 60, activityName: 'Forberedelser', activityType: 'preparation', shotIds: ['bride-getting-ready', 'groom-getting-ready', 'dress-detail', 'ring-detail'] },
      { minutesFromCeremony: 0, durationMinutes: 30, activityName: 'Borgerlig vielse', activityType: 'ceremony', shotIds: ['processional', 'vows-exchange', 'ring-exchange', 'first-kiss'] },
      { minutesFromCeremony: 60, durationMinutes: 90, activityName: 'Familie + brudepar-bilder', activityType: 'photo_session', shotIds: ['family-groom', 'family-bride', 'couple-portrait', 'couple-walking'] },
      { minutesFromCeremony: 240, durationMinutes: 180, activityName: 'Mottakelse + middag', activityType: 'reception', shotIds: ['venue-details', 'champagne-toast', 'speeches', 'cake-cutting'] },
      { minutesFromCeremony: 480, durationMinutes: 60, activityName: 'Brudevals', activityType: 'reception', shotIds: ['first-dance', 'dancefloor'] },
    ],
    shots: [], // Re-bruker shots fra norsk-kristen (samme id-er)
  },

  'muslimsk': {
    id: 'muslimsk',
    displayName: 'Muslimsk bryllup (Nikah)',
    description: 'Nikah-seremoni med imam, ofte fulgt av walima (festmiddag)',
    events: [
      { minutesFromCeremony: -90, durationMinutes: 60, activityName: 'Brudens henna + forberedelse', activityType: 'preparation', notes: 'Henna kan være kvelden før — sjekk med brudepar.', shotIds: ['bride-getting-ready', 'henna-detail', 'dress-detail'] },
      { minutesFromCeremony: 0, durationMinutes: 30, activityName: 'Nikah-seremoni', activityType: 'religious', notes: 'Foto-regler varierer — spør imam og familie først. Kvinner og menn ofte separert.', shotIds: ['nikah-imam', 'signing-ceremony', 'ring-exchange-nikah'] },
      { minutesFromCeremony: 45, durationMinutes: 30, activityName: 'Familiens velsignelse', activityType: 'ceremony', shotIds: ['family-blessing', 'parents-bride', 'parents-groom'] },
      { minutesFromCeremony: 90, durationMinutes: 60, activityName: 'Brudepar-bilder', activityType: 'photo_session', shotIds: ['couple-portrait', 'couple-walking', 'tradisjonelle-detalj'] },
      { minutesFromCeremony: 180, durationMinutes: 240, activityName: 'Walima (festmiddag)', activityType: 'reception', notes: 'Ofte stor familie-tilstedeværelse. Forbered langt program.', shotIds: ['walima-venue', 'family-feast', 'speeches', 'cake-cutting'] },
    ],
    shots: [
      { id: 'henna-detail', scene: 'Henna på brudens hender', description: 'Detaljerte close-ups av mønsteret', priority: 'must-have', shotType: 'detail' },
      { id: 'nikah-imam', scene: 'Imam-seremoni', description: 'Brudgom + imam ved signering', priority: 'must-have', shotType: 'wide' },
      { id: 'signing-ceremony', scene: 'Signering av nikah-kontrakt', description: 'Begge skriver under', priority: 'must-have', shotType: 'close-up' },
      { id: 'ring-exchange-nikah', scene: 'Ring-utveksling', description: 'Hvis tradisjon tilsier det', priority: 'high', shotType: 'close-up' },
      { id: 'family-blessing', scene: 'Familievelsignelse', description: 'Foreldre velsigner brudepar', priority: 'must-have', shotType: 'portrait' },
      { id: 'parents-bride', scene: 'Brudens foreldre', description: 'Med bruden', priority: 'must-have', shotType: 'portrait' },
      { id: 'parents-groom', scene: 'Brudgommens foreldre', description: 'Med brudgom', priority: 'must-have', shotType: 'portrait' },
      { id: 'tradisjonelle-detalj', scene: 'Tradisjonelle detaljer', description: 'Brudens smykker, ofte gull', priority: 'high', shotType: 'detail' },
      { id: 'walima-venue', scene: 'Festsal', description: 'Stylet hall', priority: 'high', shotType: 'wide' },
      { id: 'family-feast', scene: 'Stor familie-middag', description: 'Wide-shots av bordene', priority: 'must-have', shotType: 'wide' },
    ],
  },

  'hindu': {
    id: 'hindu',
    displayName: 'Hindu bryllup',
    description: 'Tradisjonelt hindu-bryllup med flere seremonier over flere dager',
    events: [
      { minutesFromCeremony: -1440, durationMinutes: 180, activityName: 'Mehndi (dagen før)', activityType: 'preparation', notes: 'Henna for bruden + kvinner i familien.', shotIds: ['mehndi-bride', 'mehndi-guests'] },
      { minutesFromCeremony: -60, durationMinutes: 30, activityName: 'Baraat (brudgommens ankomst)', activityType: 'ceremony', shotIds: ['baraat-procession', 'horse-arrival'] },
      { minutesFromCeremony: 0, durationMinutes: 120, activityName: 'Vivaha (vielses-seremoni)', activityType: 'religious', notes: 'Lange seremonier — sju runder rundt ilden (Saptapadi).', shotIds: ['mandap', 'saptapadi', 'jaimala', 'sindoor', 'mangalsutra'] },
      { minutesFromCeremony: 180, durationMinutes: 60, activityName: 'Familiebilder', activityType: 'photo_session', shotIds: ['family-bride', 'family-groom', 'extended-family'] },
      { minutesFromCeremony: 300, durationMinutes: 240, activityName: 'Reception', activityType: 'reception', shotIds: ['couple-stage', 'family-feast', 'first-dance'] },
    ],
    shots: [
      { id: 'mehndi-bride', scene: 'Mehndi-applikasjon på bruden', description: 'Detaljerte hender + smil', priority: 'must-have', shotType: 'detail' },
      { id: 'mehndi-guests', scene: 'Mehndi for gjestene', description: 'Kvinner i familien får henna', priority: 'high', shotType: 'candid' },
      { id: 'baraat-procession', scene: 'Baraat-prosesjonen', description: 'Brudgommen ankommer dansende', priority: 'must-have', shotType: 'wide' },
      { id: 'horse-arrival', scene: 'Brudgom på hest', description: 'Tradisjonell ankomst', priority: 'must-have', shotType: 'wide' },
      { id: 'mandap', scene: 'Mandap-strukturen', description: 'Den hellige strukturen seremonien holdes under', priority: 'must-have', shotType: 'wide' },
      { id: 'saptapadi', scene: 'Saptapadi (sju runder)', description: 'Brudepar går syv runder rundt ilden', priority: 'must-have', shotType: 'wide' },
      { id: 'jaimala', scene: 'Jaimala (krans-utveksling)', description: 'Brudepar gir hverandre kranser', priority: 'must-have', shotType: 'close-up' },
      { id: 'sindoor', scene: 'Sindoor-seremoni', description: 'Brudgom legger sindoor i brudens hår', priority: 'must-have', shotType: 'close-up' },
      { id: 'mangalsutra', scene: 'Mangalsutra-binding', description: 'Brudgom binder den hellige halskjeden', priority: 'must-have', shotType: 'close-up' },
      { id: 'couple-stage', scene: 'Brudepar på scenen', description: 'Reception-scene', priority: 'high', shotType: 'wide' },
    ],
  },

  'joedisk': {
    id: 'joedisk',
    displayName: 'Jødisk bryllup',
    description: 'Tradisjonelt jødisk bryllup med chuppah og glass-knusing',
    events: [
      { minutesFromCeremony: -120, durationMinutes: 60, activityName: 'Forberedelser', activityType: 'preparation', shotIds: ['bride-getting-ready', 'groom-getting-ready', 'ketubah-detail'] },
      { minutesFromCeremony: -30, durationMinutes: 30, activityName: 'Ketubah-signering', activityType: 'religious', notes: 'Signering av ekteskaps-kontrakten.', shotIds: ['ketubah-signing', 'rabbi-blessing'] },
      { minutesFromCeremony: 0, durationMinutes: 45, activityName: 'Chuppah-seremoni', activityType: 'religious', notes: 'Under chuppahen (baldakin). Glass-knusing avslutter.', shotIds: ['chuppah-procession', 'seven-circles', 'ring-exchange', 'breaking-glass'] },
      { minutesFromCeremony: 60, durationMinutes: 30, activityName: 'Yichud (alenetid)', activityType: 'ceremony', notes: '10 min alene for brudeparet. Ikke foto.', shotIds: [] },
      { minutesFromCeremony: 90, durationMinutes: 60, activityName: 'Familiebilder', activityType: 'photo_session', shotIds: ['family-bride', 'family-groom'] },
      { minutesFromCeremony: 180, durationMinutes: 240, activityName: 'Reception med hora', activityType: 'reception', shotIds: ['hora-dance', 'chair-lift', 'speeches'] },
    ],
    shots: [
      { id: 'ketubah-detail', scene: 'Ketubah (ekteskaps-kontrakt)', description: 'Vakker close-up av dokumentet', priority: 'must-have', shotType: 'detail' },
      { id: 'ketubah-signing', scene: 'Ketubah-signering', description: 'Brudepar + vitner signerer', priority: 'must-have', shotType: 'close-up' },
      { id: 'rabbi-blessing', scene: 'Rabbi-velsignelse', description: 'Før de går til chuppahen', priority: 'high', shotType: 'candid' },
      { id: 'chuppah-procession', scene: 'Brudepar under chuppahen', description: 'Hele chuppahen i bildet', priority: 'must-have', shotType: 'wide' },
      { id: 'seven-circles', scene: 'Bruden går rundt brudgommen 7 ganger', description: 'Tradisjon i ortodokse bryllup', priority: 'high', shotType: 'wide' },
      { id: 'breaking-glass', scene: 'Glass-knusing', description: 'Brudgommen knuser glasset — Mazel tov!', priority: 'must-have', shotType: 'close-up' },
      { id: 'hora-dance', scene: 'Hora-dansen', description: 'Sirkeldans med alle gjestene', priority: 'must-have', shotType: 'wide' },
      { id: 'chair-lift', scene: 'Brudepar løftes på stoler', description: 'Tradisjonell del av hora', priority: 'must-have', shotType: 'wide' },
    ],
  },
};

export function getCultureTemplate(culture: string | null | undefined): CultureTemplate | null {
  if (!culture) return null;
  const normalized = culture.toLowerCase().trim().replace(/\s+/g, '-');
  // Aliases
  const aliasMap: Record<string, string> = {
    'kristen': 'norsk-kristen',
    'norsk': 'norsk-kristen',
    'church': 'norsk-kristen',
    'civil': 'norsk-sekulaer',
    'borgerlig': 'norsk-sekulaer',
    'secular': 'norsk-sekulaer',
    'sekulær': 'norsk-sekulaer',
    'islam': 'muslimsk',
    'muslim': 'muslimsk',
    'nikah': 'muslimsk',
    'hindu-wedding': 'hindu',
    'indisk': 'hindu',
    'jewish': 'joedisk',
    'jødisk': 'joedisk',
  };
  const key = aliasMap[normalized] ?? normalized;
  return WEDDING_CULTURE_TEMPLATES[key] ?? null;
}

export function listCultureTemplates(): Array<{ id: string; displayName: string; description: string }> {
  return Object.values(WEDDING_CULTURE_TEMPLATES).map((t) => ({
    id: t.id,
    displayName: t.displayName,
    description: t.description,
  }));
}
