/**
 * workspaceTheme.ts — Team Workspace (dark CreatorHub-tema)
 *
 * Følger det KANONISKE dark CreatorHub-temaet (se admin/adminDarkTheme.ts):
 * oransje aksent (#ff8c00) på mørk navy (#0a0f1a / #0f1729), glassmorphism,
 * hvit tekst. ÉN kilde til sannhet så alle 8 tab-skjermer er identiske og
 * matcher resten av CreatorHub. Workspacet pakkes i `adminDarkTheme` slik at
 * MUI <Card>/<Paper>/<Dialog> arver samme palett automatisk.
 */

export { default as workspaceDarkTheme } from '../admin/adminDarkTheme';

export const ws = {
  // Bakgrunner (matcher adminDarkTheme + skall-kommentaren #0a0f1a)
  bg: '#0a0f1a',           // app/skall-bakgrunn
  bgSidebar: '#0b1120',    // venstre nav (litt dypere)
  panel: 'rgba(15,23,42,0.72)', // kort/paper (glassmorphism, som adminDarkTheme)
  panelSolid: '#0f1729',   // opake flater (dialog/meny/tabell-header)
  panelAlt: '#111c30',     // hover/nested
  panelInput: 'rgba(255,255,255,0.04)',

  // Linjer
  border: 'rgba(255,255,255,0.12)',
  borderSoft: 'rgba(255,255,255,0.07)',

  // Tekst (adminDarkTheme)
  text: 'rgba(255,255,255,0.95)',
  textDim: 'rgba(255,255,255,0.62)',
  textFaint: 'rgba(255,255,255,0.40)',

  // Aksent — CreatorHub oransje
  accent: '#ff8c00',
  accentHover: '#e67e00',
  accentSoft: 'rgba(255,140,0,0.14)',
  accentBorder: 'rgba(255,140,0,0.42)',
  accentContrast: '#150d05',

  // Status
  green: '#34d399',
  greenSoft: 'rgba(52,211,153,0.14)',
  amber: '#fbbf24',
  amberSoft: 'rgba(251,191,36,0.14)',
  red: '#f87171',
  redSoft: 'rgba(248,113,113,0.14)',
  blue: '#60a5fa',
  blueSoft: 'rgba(96,165,250,0.14)',

  // Rolle-farger (donut/kategori — Ressursallokering)
  roleFoto: '#ff8c00',
  roleVideo: '#34d399',
  roleLyd: '#fbbf24',
  roleDrone: '#fb923c',
  roleAnnet: 'rgba(255,255,255,0.45)',

  radius: 16,
  radiusSm: 10,
} as const;

export type WorkspaceTab =
  | 'oversikt'
  | 'prosjektplan'
  | 'produksjonskart'
  | 'shotlist'
  | 'moodboard'
  | 'media'
  | 'leveranser'
  | 'oppgaver'
  | 'team'
  | 'chat';

/**
 * Workspace-kategori — hvilken «flate-familie» en profesjon får i workspacet.
 * Kategorien er ADMIN-STYRT: profession_types.workspace_category i DB (settes
 * i ProfessionTypeManager) vinner via overrides-parametret; PROFESSION_CATEGORY
 * under er kode-fallback for offline/første render. Nav-items tagges med
 * `categories`. Ny profesjon = admin-klikk; ny kategori = utvid typen + tagg items.
 *   'visual'  = foto/video (Shotlist, Produksjonskart, Photo/Video Room)
 *   'music'   = musikk (Låter, Sesjoner, Sound Room)
 *   'service' = booking-/tjenestebaserte (frisør, hundefrisør, yoga …) — faner kommer
 *   'vendor'  = leverandører (Oppdrag, Lager, Ordreplan, Inspirasjon)
 * Typen eies av frontend/shared/profession-types.ts (delt med backend).
 */
export type { WorkspaceCategory } from '@shared/profession-types';
import { type WorkspaceCategory } from '@shared/profession-types';

export interface WsNavItem {
  key: WorkspaceTab | string;
  label: string;
  icon: string; // mui-icon-navn (mappet i shell)
  badge?: number;
  group: 'hoved' | 'rom' | 'klient';
  online?: boolean;
  route?: boolean; // true = egen tab i workspacet
  /**
   * Kategori-synlighet (deklarativt). Mangler feltet → universell (alle).
   * Se navForProfession() / workspaceCategoryFor().
   */
  categories?: WorkspaceCategory[];
  /**
   * Kategori-spesifikk label-overstyring for universelle items — samme fane,
   * riktig språk for flaten (vendor: Utstyr→«Lager», Moodboard→«Inspirasjon»).
   * navForProfession() resolver til `label`.
   */
  labelByCategory?: Partial<Record<WorkspaceCategory, string>>;
  /** Kun synlig for mentorer/instruktører (uavhengig av profesjon). */
  mentorOnly?: boolean;
}

// Venstre-nav — eksakt rekkefølge fra Daniels design. Items er tagget med
// workspace-kategori; navForProfession() filtrerer. Musikk- og visuell-varianter
// er interleavet så rekkefølgen blir riktig for begge etter filtrering.
export const WS_NAV: WsNavItem[] = [
  { key: 'oversikt', label: 'Oversikt', icon: 'Dashboard', group: 'hoved', route: true },
  { key: 'prosjektplan', label: 'Prosjektplan', icon: 'AccountTree', group: 'hoved', route: true, labelByCategory: { vendor: 'Ordreplan' } },
  { key: 'produksjonskart', label: 'Produksjonskart', icon: 'Map', group: 'hoved', route: true, categories: ['visual'] },
  { key: 'sesjoner', label: 'Sesjoner', icon: 'Album', group: 'hoved', route: true, categories: ['music'] },
  { key: 'oppdrag', label: 'Oppdrag', icon: 'WorkOutline', group: 'hoved', route: true, categories: ['vendor'] },
  { key: 'bookinger', label: 'Bookinger', icon: 'EventAvailable', group: 'hoved', route: true, categories: ['service'] },
  { key: 'shotlist', label: 'Shotlist', icon: 'PhotoCameraBack', group: 'hoved', route: true, categories: ['visual'] },
  { key: 'laater', label: 'Låter', icon: 'LibraryMusic', group: 'hoved', route: true, categories: ['music'] },
  { key: 'moodboard', label: 'Moodboard', icon: 'GridView', group: 'hoved', route: true, labelByCategory: { vendor: 'Inspirasjon', service: 'Inspirasjon' } },
  { key: 'media', label: 'Media', icon: 'PermMedia', group: 'hoved', route: true },
  { key: 'utstyr', label: 'Utstyr', icon: 'Inventory2', group: 'hoved', route: true, labelByCategory: { vendor: 'Lager' } },
  { key: 'leveranser', label: 'Leveranser', icon: 'LocalShipping', group: 'hoved', route: true },
  { key: 'oppgaver', label: 'Oppgaver', icon: 'CheckCircleOutline', group: 'hoved', badge: 12, route: true },
  { key: 'team', label: 'Team', icon: 'Group', group: 'hoved', route: true },
  { key: 'chat', label: 'Chat', icon: 'ChatBubbleOutline', group: 'hoved', route: true },
  // Academy-administrasjon — kun mentorer/instruktører (uavhengig av profesjon)
  { key: 'academy', label: 'Academy', icon: 'School', group: 'hoved', route: true, mentorOnly: true },
  // Community — for alle; mentorer får admin/styring inne i hub-en (MentorDashboard)
  { key: 'community', label: 'Community', icon: 'Forum', group: 'hoved', route: true },
  // Smart Rom — profesjons-spesifikke
  { key: 'photo-room', label: 'Photo Room', icon: 'PhotoCamera', group: 'rom', online: true, route: true, categories: ['visual'] },
  { key: 'video-room', label: 'Video Room', icon: 'Videocam', group: 'rom', online: true, route: true, categories: ['visual'] },
  { key: 'sound-room', label: 'Sound Room', icon: 'GraphicEq', group: 'rom', online: true, route: true, categories: ['music'] },
  // Edit Room skjult inntil videre — planlegges senere (redigerer-/leveranse-cockpit).
  // { key: 'edit-room', label: 'Edit Room', icon: 'Movie', group: 'rom', online: true },
  // Kundeportal
  { key: 'foresporsler', label: 'Forespørsler', icon: 'MoveToInbox', group: 'klient', route: true },
  { key: 'kundevisning', label: 'Kundevisning', icon: 'Visibility', group: 'klient' },
  { key: 'avtaler', label: 'Avtaler', icon: 'EventNote', group: 'klient' },
];

/**
 * Normaliser profesjonsverdi til sammenlignings-nøkkel: lowercase uten
 * skilletegn, så én map-entry dekker 'music_producer' / 'music-producer' /
 * 'musicproducer'. Eksportert så useWorkspaceCategory kan bygge overrides-map
 * med samme nøkler.
 */
export const wsProfessionKey = (s?: string | null) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normProf = wsProfessionKey;

// Kode-fallback profesjon → workspace-kategori (offline/første render — den
// admin-styrte kilden er profession_types.workspace_category via overrides).
// Nøkler er normalisert (wsProfessionKey). Ukjente profesjoner → 'visual'.
const PROFESSION_CATEGORY: Record<string, WorkspaceCategory> = {
  photographer: 'visual',
  videographer: 'visual',
  enterprise: 'visual',
  musicproducer: 'music',
  musician: 'music',
  music: 'music',
  // Vendor er ordre-/lager-/leveranse-orientert (jf. UniversalDashboard: Produkter/
  // Bestillinger/Lager) — universelle faner + Oppdrag, ingen foto/video/musikk-rom.
  vendor: 'vendor',
  petgroomer: 'service',
};

export function workspaceCategoryFor(
  profession?: string | null,
  overrides?: Record<string, WorkspaceCategory>,
): WorkspaceCategory {
  const key = normProf(profession);
  return overrides?.[key] ?? PROFESSION_CATEGORY[key] ?? 'visual';
}

export function isMusicProfession(profession?: string | null): boolean {
  return workspaceCategoryFor(profession) === 'music';
}

/**
 * Filtrer WS_NAV til en kategori: universelle items vises alltid; taggede
 * items kun for sin kategori. Rekkefølgen i WS_NAV bevares (variantene er
 * interleavet på riktig plass), og labelByCategory resolves.
 */
export function navForCategory(
  cat: WorkspaceCategory,
  opts?: { isMentor?: boolean },
): WsNavItem[] {
  const isMentor = !!opts?.isMentor;
  return WS_NAV.filter((n) => {
    if (n.mentorOnly && !isMentor) return false; // mentor-gated (uavhengig av profesjon)
    if (!n.categories) return true;
    return n.categories.includes(cat);
  }).map((n) => {
    const label = n.labelByCategory?.[cat];
    return label ? { ...n, label } : n;
  });
}

/**
 * Som navForCategory, men fra profesjonsverdi. `categoryOverrides` er det
 * admin-styrte mapet fra useWorkspaceCategoryMap() (DB vinner over koden).
 */
export function navForProfession(
  profession?: string | null,
  opts?: { isMentor?: boolean; categoryOverrides?: Record<string, WorkspaceCategory> },
): WsNavItem[] {
  return navForCategory(workspaceCategoryFor(profession, opts?.categoryOverrides), opts);
}
