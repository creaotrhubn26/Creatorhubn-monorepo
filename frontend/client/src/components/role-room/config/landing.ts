export const ROLE_ROOM_LANDING_CONFIG = {
  demoModeEnabled: true,
  intro: {
    enabled: true,
    videoUrl: '/role-room-assets/the_role_room_intro.mp4',
    skipLabel: 'Hopp over',
    backdropVideoUrl: '/role-room-assets/landing_backdrop.mp4',
    whyLabel: 'Hvorfor vi finnes',
    howLabel: 'Slik gjør vi det',
    whatLabel: 'Hva du får',
  },
  login: {
    eyebrowText: 'Din inngang',
    title: 'Ta din plass',
    subtitle: 'Velg hvem du er — og start produksjonen',
    ctaButtonLabel: 'Logg Inn',
  },
} as const;
