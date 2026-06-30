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

export interface WsNavItem {
  key: WorkspaceTab | string;
  label: string;
  icon: string; // mui-icon-navn (mappet i shell)
  badge?: number;
  group: 'hoved' | 'rom' | 'klient';
  online?: boolean;
  route?: boolean; // true = egen tab i workspacet
  /**
   * Profesjons-synlighet (deklarativt). Mangler feltet → universell (alle).
   *   'visual' = foto/video-flater (Shotlist, Produksjonskart, Photo/Video Room)
   *   'music'  = musikk-flater (Låter, Sesjoner, Sound Room)
   * Se navForProfession().
   */
  professions?: Array<'visual' | 'music'>;
  /** Kun synlig for mentorer/instruktører (uavhengig av profesjon). */
  mentorOnly?: boolean;
}

// Venstre-nav — eksakt rekkefølge fra Daniels design. Items er tagget med
// profesjon; navForProfession() filtrerer. Musikk- og visuell-varianter er
// interleavet så rekkefølgen blir riktig for begge etter filtrering.
export const WS_NAV: WsNavItem[] = [
  { key: 'oversikt', label: 'Oversikt', icon: 'Dashboard', group: 'hoved', route: true },
  { key: 'prosjektplan', label: 'Prosjektplan', icon: 'AccountTree', group: 'hoved', route: true },
  { key: 'produksjonskart', label: 'Produksjonskart', icon: 'Map', group: 'hoved', route: true, professions: ['visual'] },
  { key: 'sesjoner', label: 'Sesjoner', icon: 'Album', group: 'hoved', route: true, professions: ['music'] },
  { key: 'shotlist', label: 'Shotlist', icon: 'PhotoCameraBack', group: 'hoved', route: true, professions: ['visual'] },
  { key: 'laater', label: 'Låter', icon: 'LibraryMusic', group: 'hoved', route: true, professions: ['music'] },
  { key: 'moodboard', label: 'Moodboard', icon: 'GridView', group: 'hoved', route: true },
  { key: 'media', label: 'Media', icon: 'PermMedia', group: 'hoved', route: true },
  { key: 'leveranser', label: 'Leveranser', icon: 'LocalShipping', group: 'hoved', route: true },
  { key: 'oppgaver', label: 'Oppgaver', icon: 'CheckCircleOutline', group: 'hoved', badge: 12, route: true },
  { key: 'team', label: 'Team', icon: 'Group', group: 'hoved', route: true },
  { key: 'chat', label: 'Chat', icon: 'ChatBubbleOutline', group: 'hoved', route: true },
  // Academy-administrasjon — kun mentorer/instruktører (uavhengig av profesjon)
  { key: 'academy', label: 'Academy', icon: 'School', group: 'hoved', route: true, mentorOnly: true },
  // Smart Rom — profesjons-spesifikke
  { key: 'photo-room', label: 'Photo Room', icon: 'PhotoCamera', group: 'rom', online: true, route: true, professions: ['visual'] },
  { key: 'video-room', label: 'Video Room', icon: 'Videocam', group: 'rom', online: true, route: true, professions: ['visual'] },
  { key: 'sound-room', label: 'Sound Room', icon: 'GraphicEq', group: 'rom', online: true, route: true, professions: ['music'] },
  // Edit Room skjult inntil videre — planlegges senere (redigerer-/leveranse-cockpit).
  // { key: 'edit-room', label: 'Edit Room', icon: 'Movie', group: 'rom', online: true },
  // Kundeportal
  { key: 'foresporsler', label: 'Forespørsler', icon: 'MoveToInbox', group: 'klient', route: true },
  { key: 'kundevisning', label: 'Kundevisning', icon: 'Visibility', group: 'klient' },
  { key: 'avtaler', label: 'Avtaler', icon: 'EventNote', group: 'klient' },
];

// Profesjoner som regnes som musikk (Sound Room / Låter / Sesjoner i stedet for
// Shotlist / Produksjonskart / Photo+Video Room). Alt annet = visuell (foto/video).
const MUSIC_PROFESSIONS = ['music_producer', 'music-producer', 'musician', 'music'];

export function isMusicProfession(profession?: string | null): boolean {
  return MUSIC_PROFESSIONS.includes(String(profession || '').toLowerCase());
}

/**
 * Filtrer WS_NAV til profesjonen: universelle items vises alltid; 'visual'-items
 * for foto/video; 'music'-items for musikkprodusenter. Rekkefølgen i WS_NAV
 * bevares (musikk- og visuell-varianter er interleavet på riktig plass).
 */
export function navForProfession(
  profession?: string | null,
  opts?: { isMentor?: boolean },
): WsNavItem[] {
  const music = isMusicProfession(profession);
  const isMentor = !!opts?.isMentor;
  return WS_NAV.filter((n) => {
    if (n.mentorOnly && !isMentor) return false; // mentor-gated (uavhengig av profesjon)
    if (!n.professions) return true;
    return music ? n.professions.includes('music') : n.professions.includes('visual');
  });
}
