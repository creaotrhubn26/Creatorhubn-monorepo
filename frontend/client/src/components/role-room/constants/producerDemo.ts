export const CONTENT_PRODUCER_DEMO_PROJECT_ID = 'content-producer-demo-2026';
export const TROLL_DEMO_PROJECT_ID = 'troll-project-2026';
export const ROLE_ROOM_DEMO_PROJECT_IDS = [
  CONTENT_PRODUCER_DEMO_PROJECT_ID,
  TROLL_DEMO_PROJECT_ID,
] as const;

export const PRODUCER_DEMO_PROJECT_NAME = 'Northwind Drilling - Sikker start';
export const PRODUCER_DEMO_PROJECT_DESCRIPTION =
  'Fiktivt bedriftsprosjekt for Northwind Drilling AS: en serie med HMS-, onboarding- og rekrutteringsfilmer for offshore-personell, nye skiftledere og innleide teknikere.';
export const PRODUCER_DEMO_CLIENT_NAME = 'Helene Nygard';
export const PRODUCER_DEMO_CLIENT_EMAIL = 'helene.nygard@northwinddrilling.no';
export const PRODUCER_DEMO_CLIENT_COMPANY = 'Northwind Drilling AS';
export const PRODUCER_DEMO_CLIENT_ORGANIZATION_NUMBER = '912345678';
export const PRODUCER_DEMO_CLIENT_ADDRESS = 'Kaiveien 18, 4033 Stavanger';
export const PRODUCER_DEMO_PRIMARY_LOCATION = 'Northwind Training Center';
export const PRODUCER_DEMO_COLLABORATOR_NAME = 'Mina Haugen';
export const PRODUCER_DEMO_COLLABORATOR_EMAIL = 'mina.haugen@northwindstudio.no';
export const PRODUCER_DEMO_MANUSCRIPT_ID = `content-producer-demo-${CONTENT_PRODUCER_DEMO_PROJECT_ID}`;
export const PRODUCER_DEMO_SCENE_IDS = {
  kickoff: `${PRODUCER_DEMO_MANUSCRIPT_ID}-scene-1`,
  training: `${PRODUCER_DEMO_MANUSCRIPT_ID}-scene-2`,
  post: `${PRODUCER_DEMO_MANUSCRIPT_ID}-scene-3`,
} as const;
export const PRODUCER_DEMO_SHOTLIST_IDS = {
  kickoff: 'cp-shotlist-1',
  training: 'cp-shotlist-2',
  post: 'cp-shotlist-3',
} as const;

const LEGACY_PRODUCER_DEMO_MARKERS = [
  'innholdsprodusent demo',
  'innholdsprodusent demo-prosjekt',
  'demo-prosjekt for innholdsprodusent',
  'innholdsprodusent team',
  'innholdsprodusent-team',
  'innholdsprodusenten',
  'innholdsprodusent lead',
  'fra brief til godkjent leveranse',
  'produktlansering - studio demo',
  'prøv demo-prosjektet for innholdsprodusent-flyt',
  'demo-klient',
];

export function containsLegacyProducerDemoMarker(
  ...values: Array<string | null | undefined>
): boolean {
  const haystack = values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();

  if (!haystack) {
    return false;
  }

  return LEGACY_PRODUCER_DEMO_MARKERS.some((marker) => haystack.includes(marker));
}

export function isRoleRoomDemoProjectId(projectId: string | null | undefined): boolean {
  const normalizedProjectId = String(projectId || '').trim().toLowerCase();
  return ROLE_ROOM_DEMO_PROJECT_IDS.some((demoProjectId) => normalizedProjectId === demoProjectId);
}

export function isRoleRoomDemoSeedAllowed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const hostname = window.location.hostname.trim().toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('roleRoomDemoSeed') === '1' || params.get('demoSeed') === '1') {
    return true;
  }

  // Tillat produkt-eier (daniel@creatorhubn.com) å se demo-prosjektene
  // i prod uten å måtte legge på query-param. Sjekker auth-storage
  // for å unngå å koble inn auth-modul her.
  try {
    const userObjRaw = window.localStorage.getItem('creatorhub_auth_user')
      || window.localStorage.getItem('user')
      || window.localStorage.getItem('creatorhub_user');
    if (userObjRaw) {
      const parsed = JSON.parse(userObjRaw) as { email?: string };
      if (typeof parsed?.email === 'string' && parsed.email.toLowerCase() === 'daniel@creatorhubn.com') {
        return true;
      }
    }
    const directEmail = window.localStorage.getItem('userEmail');
    if (typeof directEmail === 'string' && directEmail.toLowerCase() === 'daniel@creatorhubn.com') {
      return true;
    }
  } catch {
    /* ignore — storage-tilgang kan feile i private-mode */
  }

  return false;
}

export const PRODUCER_DEMO_TIMELINE_SEED = [
  {
    phase: 'preproduction',
    title: 'Storyboard og manus sendt til klient',
    description: 'Kickoff, manus og storyboard er sendt til Helene Nygard for første godkjenningsrunde.',
    ownerUserId: PRODUCER_DEMO_COLLABORATOR_EMAIL,
    dueAt: '2026-04-15T14:00',
    status: 'completed',
    linkedEntityType: 'storyboard',
    linkedEntityId: `storyboard-package:${CONTENT_PRODUCER_DEMO_PROJECT_ID}`,
    metadata: { seedKey: 'timeline-storyboard-client-review' },
  },
  {
    phase: 'production',
    title: 'Produksjonsdag i treningssenter',
    description: 'Dekker onboarding, HMS og rekrutteringsvariant i samme opptak med instruktør og tekniker.',
    ownerUserId: 'jonas.rode@northwindstudio.no',
    dueAt: '2026-04-18T07:30',
    status: 'in_progress',
    linkedEntityType: 'shotlist',
    linkedEntityId: PRODUCER_DEMO_SHOTLIST_IDS.training,
    metadata: { seedKey: 'timeline-production-day' },
  },
  {
    phase: 'postproduction',
    title: 'Klientreview og eksportpakke',
    description: 'Kommentarer fra kunden lukkes, leveranser tekstes og eksporteres i tre formater.',
    ownerUserId: PRODUCER_DEMO_COLLABORATOR_EMAIL,
    dueAt: '2026-04-22T10:00',
    status: 'planned',
    linkedEntityType: 'economy',
    linkedEntityId: `economy-package:${CONTENT_PRODUCER_DEMO_PROJECT_ID}`,
    metadata: { seedKey: 'timeline-export-package' },
  },
] as const;

export const PRODUCER_DEMO_ECONOMY_SEED = [
  {
    phase: 'preproduction',
    category: 'Pre-produksjon',
    itemName: 'Brief, manus og storyboard-pakke',
    description: 'Oppstartsmøter, manusutkast, storyboard og første godkjenningspakke.',
    estimate: 45000,
    approved: 45000,
    actual: 42000,
    status: 'approved',
    clientVisible: true,
    linkedEntityType: 'manuscript',
    linkedEntityId: `manuscript-package:${CONTENT_PRODUCER_DEMO_PROJECT_ID}`,
    metadata: { seedKey: 'economy-manuscript-package' },
  },
  {
    phase: 'production',
    category: 'Produksjon',
    itemName: 'Opptaksdag med sikkerhetsteam',
    description: 'Crew, lys, lyd, transport og sikkerhetsutstyr til opptaksdagen i treningssenteret.',
    estimate: 175000,
    approved: 160000,
    actual: 0,
    status: 'pending_approval',
    clientVisible: true,
    linkedEntityType: 'shotlist',
    linkedEntityId: PRODUCER_DEMO_SHOTLIST_IDS.training,
    metadata: { seedKey: 'economy-shoot-day' },
  },
  {
    phase: 'postproduction',
    category: 'Post-produksjon',
    itemName: 'Klientreview, teksting og eksport',
    description: 'Versjonering, teksting, godkjenningsrunder og eksport til tre leveranseflater.',
    estimate: 38000,
    approved: 0,
    actual: 0,
    status: 'draft',
    clientVisible: true,
    linkedEntityType: 'economy',
    linkedEntityId: `economy-package:${CONTENT_PRODUCER_DEMO_PROJECT_ID}`,
    metadata: { seedKey: 'economy-post-package' },
  },
] as const;

export const PRODUCER_DEMO_REVIEW_SEED = [
  {
    reviewType: 'storyboard',
    title: 'Storyboard klar for klientgodkjenning',
    description: 'Vennligst gjennomgå storyboard og bekreft at sikkerhetsflyt og kundereise er riktig.',
    targetEntityType: 'storyboard',
    targetEntityId: `storyboard-package:${CONTENT_PRODUCER_DEMO_PROJECT_ID}`,
    dueAt: '2026-04-15T14:00',
    metadata: { seedKey: 'review-storyboard' },
    comments: [
      {
        commentText: 'Se spesielt scene 2. Vi trenger bekreftelse på rekkefølgen mellom PPE og kontrollrom.',
        timestampSeconds: 92,
      },
    ],
  },
  {
    reviewType: 'shotlist',
    title: 'Shotlist klar for klientgodkjenning',
    description: 'Shotlisten viser hvilke opptak som dekker HMS, onboarding og rekruttering i samme produksjonsdag.',
    targetEntityType: 'shotlist',
    targetEntityId: PRODUCER_DEMO_SHOTLIST_IDS.training,
    dueAt: '2026-04-16T09:30',
    metadata: { seedKey: 'review-shotlist' },
    comments: [
      {
        commentText: 'Marker gjerne om hero-shoten også brukes i rekrutteringsversjonen.',
        timestampSeconds: 215,
      },
    ],
  },
  {
    reviewType: 'budget_package',
    title: 'Budsjettpakke klar for klientgodkjenning',
    description: 'Budsjettlinjene er oppdatert og klare for gjennomgang før opptaksdag.',
    targetEntityType: 'economy',
    targetEntityId: `economy-package:${CONTENT_PRODUCER_DEMO_PROJECT_ID}`,
    dueAt: '2026-04-17T12:00',
    metadata: { seedKey: 'review-budget' },
    comments: [
      {
        commentText: 'Kostnader er delt per fase og alle klientsynlige linjer er klare for gjennomgang.',
      },
    ],
  },
] as const;
