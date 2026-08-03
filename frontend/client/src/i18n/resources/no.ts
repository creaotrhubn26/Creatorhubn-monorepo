// Norsk (bokmål) oversettelser. `no` er kilden til nøkkel-typen — `en` må ha
// nøyaktig samme nøkler (håndhevet i en.ts). Interpolering: {navn} i teksten.
export const no = {
  'lang.switch': 'Bytt språk',

  // Story Writer — faner
  'tabs.editor': 'Editor',
  'tabs.acts': 'Akter',
  'tabs.scenes': 'Scener',
  'tabs.characters': 'Karakterer',
  'tabs.dialogue': 'Dialog',
  'tabs.breakdown': 'Gjennomgang',
  'tabs.revisions': 'Revisjoner',
  'tabs.timeline': 'Tidslinje',
  'tabs.storyboard': 'Storyboard',
  'tabs.production': 'Produksjon',

  // Story Writer — toolbar
  'toolbar.autoReview': 'Auto-gjennomgang',
  'toolbar.autoReviewShort': 'Auto',
  'toolbar.runReview': 'Kjør gjennomgang nå — oppdater scener og roller fra manuset',
  'toolbar.export': 'Eksporter',
  'toolbar.exportShort': 'Eksport',
  'toolbar.saveNow': 'Lagre nå',
  'toolbar.saveNowTooltip': 'Lagre nå (lagres ellers automatisk)',
  'toolbar.setTargetLength': 'Sett mål-lengde',
  'toolbar.targetLength': 'Mål {min} min',
  'toolbar.sendApproval': 'Send til godkjenning',
  'toolbar.sendApprovalShort': 'Godkjenning',
  'toolbar.sendApprovalTooltip': 'Send manuset videre til klient-/godkjenningsflaten',
  'toolbar.manuscript': 'Manuskript',
  'toolbar.manuscriptShort': 'Manus',

  // Manuskript-meny
  'menu.yourManuscripts': 'Dine manuskripter',
  'menu.yourManuscriptsDesc': 'Bytt utkast eller gi nytt navn',
  'menu.newManuscript': 'Nytt manuskript',
  'menu.fromTemplate': 'Fra mal…',
  'menu.importFile': 'Importer fil…',
  'menu.importFileDesc': 'Fra tidligere eksport',

  // Skrivemodus
  'writingMode.enter': 'Skrivemodus',
  'writingMode.exit': 'Avslutt skrivemodus',
  'writingMode.tooltip': 'Skjul alt annet og skriv distraksjonsfritt (Esc for å avslutte)',
  'writingMode.exitTooltip': 'Avslutt skrivemodus (Esc)',
} as const;
