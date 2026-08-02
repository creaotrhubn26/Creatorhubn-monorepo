/**
 * studioAccessModel — én kilde til sannhet for RBAC i Story Arc Studio.
 *
 * Tre ting bor her:
 *   1. STUDIO_TABS — katalogen over fanene i CastingPlannerPanel, med stabil
 *      tab-nøkkel + numerisk tab-indeks (samme indekser som panelet bruker).
 *   2. PRODUCTION_ROLES — hele filmproduksjons-rolle-taksonomien (avdeling for
 *      avdeling), hver med et *preset*: hvilke faner rollen ser (Se) og styrer
 *      (Administrere) som standard.
 *   3. Oppslags-hjelpere — slå opp preset for en rolle, slå sammen med lederens
 *      overstyringer, og avled synlige / redigerbare faner.
 *
 * Tilgangsmodellen har tre nivåer per fane:
 *   - Skjult      → fanen vises ikke i det hele tatt.
 *   - Se (view)   → fanen er synlig, men skrivebeskyttet.
 *   - Administrere (manage) → full lese/skrive-tilgang.
 *
 * En TabAccessMap lister KUN faner som er synlige; en fane som mangler i mappen
 * er Skjult. Presetene under er kun *standarder* — prosjektlederen kan overstyre
 * hver enkelt celle per rolle eller per person i "Tilganger"-dialogen.
 */

export type TabAccessLevel = 'view' | 'manage';

/** Synlige faner → nivå. Fane som mangler = Skjult. */
export type TabAccessMap = Record<string, TabAccessLevel>;

/** Tre-nivå-tilstand brukt av UI-kontrollen. */
export type TabAccessState = 'hidden' | 'view' | 'manage';

export type StudioTabCluster = 'oversikt' | 'kreativt' | 'produksjon' | 'forretning';

export interface StudioTabDef {
  /** Stabil nøkkel — lagres i overrides og presets. */
  key: string;
  /** Numerisk tab-indeks som CastingPlannerPanel bruker internt. */
  index: number;
  label: string;
  cluster: StudioTabCluster;
}

/**
 * Fane-katalogen. `index` matcher tab-VALUE-konstantene i CastingPlannerPanel
 * (0=oversikt … 16=storyboard, 99=shotlist). Rekkefølgen her er visnings-
 * rekkefølgen i "Tilganger"-matrisen.
 */
export const STUDIO_TABS: readonly StudioTabDef[] = [
  { key: 'oversikt',   index: 0,  label: 'Oversikt',        cluster: 'oversikt' },
  { key: 'story-arc',  index: 1,  label: 'Manus / Story Arc', cluster: 'kreativt' },
  { key: 'storyboard', index: 16, label: 'Storyboard',      cluster: 'kreativt' },
  { key: 'roles',      index: 2,  label: 'Roller',          cluster: 'kreativt' },
  { key: 'candidates', index: 3,  label: 'Kandidater',      cluster: 'kreativt' },
  { key: 'auditions',  index: 4,  label: 'Auditions',       cluster: 'kreativt' },
  { key: 'selection',  index: 5,  label: 'Utvelgelse',      cluster: 'kreativt' },
  { key: 'shotlist',   index: 99, label: 'Shot list',       cluster: 'kreativt' },
  { key: 'locations',  index: 6,  label: 'Lokasjoner',      cluster: 'produksjon' },
  { key: 'callsheet',  index: 7,  label: 'Produksjonsplan', cluster: 'produksjon' },
  { key: 'crew',       index: 8,  label: 'Team & crew',     cluster: 'produksjon' },
  { key: 'equipment',  index: 9,  label: 'Rekvisitter & utstyr', cluster: 'produksjon' },
  { key: 'live-set',   index: 10, label: 'Live Set',        cluster: 'produksjon' },
  { key: 'workspace',  index: 11, label: 'Prosjektrom',     cluster: 'forretning' },
  { key: 'economy',    index: 12, label: 'Økonomi',         cluster: 'forretning' },
  { key: 'timeline',   index: 13, label: 'Tidslinje',       cluster: 'forretning' },
  { key: 'approval',   index: 14, label: 'Godkjenning',     cluster: 'forretning' },
  { key: 'delivery',   index: 15, label: 'Levering',        cluster: 'forretning' },
];

export const STUDIO_TAB_KEYS: readonly string[] = STUDIO_TABS.map((t) => t.key);

/** tab-indeks → tab-nøkkel (for å filtrere panelets numeriske tab-lister). */
export const TAB_INDEX_TO_KEY: Record<number, string> = Object.fromEntries(
  STUDIO_TABS.map((t) => [t.index, t.key]),
);

/** tab-nøkkel → tab-indeks. */
export const TAB_KEY_TO_INDEX: Record<string, number> = Object.fromEntries(
  STUDIO_TABS.map((t) => [t.key, t.index]),
);

export const STUDIO_TAB_LABELS: Record<string, string> = Object.fromEntries(
  STUDIO_TABS.map((t) => [t.key, t.label]),
);

export const STUDIO_TAB_CLUSTER_LABELS: Record<StudioTabCluster, string> = {
  oversikt: 'Oversikt',
  kreativt: 'Kreativt',
  produksjon: 'Produksjon',
  forretning: 'Forretning & leveranse',
};

// ── Roller ────────────────────────────────────────────────────────────

export type ProductionDepartment =
  | 'ledelse'
  | 'kreativ'
  | 'kamera'
  | 'lys_grip'
  | 'lyd'
  | 'design'
  | 'regi_kontinuitet'
  | 'lokasjon'
  | 'post'
  | 'kunde'
  | 'system';

export interface ProductionRoleDef {
  key: string;
  label: string;
  department: ProductionDepartment;
  /** Kort beskrivelse av ansvarsområdet (vises som hjelpetekst). */
  description: string;
  /** Standard tilgang: fane-nøkkel → nivå. Fane som mangler = Skjult. */
  preset: TabAccessMap;
}

export const DEPARTMENT_LABELS: Record<ProductionDepartment, string> = {
  ledelse: 'Produsent & produksjonsledelse',
  kreativ: 'Kreativ ledelse',
  kamera: 'Kameraavdeling',
  lys_grip: 'Lys & grip',
  lyd: 'Lyd',
  design: 'Scenografi, kostyme & utseende',
  regi_kontinuitet: 'Regi- & kontinuitetsstøtte',
  lokasjon: 'Lokasjon & logistikk',
  post: 'Postproduksjon',
  kunde: 'Kunde, marked & innhold',
  system: 'System',
};

// Nivå-snarveier for lesbarhet i preset-tabellen.
const M: TabAccessLevel = 'manage';
const V: TabAccessLevel = 'view';

/**
 * Hele rolle-taksonomien med tab-presets. Hver rolle får `oversikt` som minst
 * `view` slik at dashbordet alltid er synlig. Presetene er avledet direkte fra
 * "Hvem bestemmer hva?"-matrisen: den som *eier* et område får `manage`, de som
 * trenger kontekst får `view`, resten er Skjult.
 */
export const PRODUCTION_ROLES: readonly ProductionRoleDef[] = [
  // ── Produsent & produksjonsledelse ─────────────────────────────────
  {
    key: 'leder', label: 'Leder (deg)', department: 'ledelse',
    description: 'Prosjekteier — full tilgang og delegerer alle andre tilganger.',
    preset: {
      oversikt: M, 'story-arc': M, storyboard: M, roles: M, candidates: M,
      auditions: M, selection: M, shotlist: M, locations: M, callsheet: M,
      crew: M, equipment: M, 'live-set': M, workspace: M, economy: M,
      timeline: M, approval: M, delivery: M,
    },
  },
  {
    key: 'producer', label: 'Produsent', department: 'ledelse',
    description: 'Eier budsjett, avtaler, bemanning og leveranse. Godkjenner.',
    preset: {
      oversikt: M, 'story-arc': M, storyboard: M, roles: M, candidates: M,
      auditions: M, selection: M, shotlist: V, locations: M, callsheet: M,
      crew: M, equipment: M, 'live-set': M, workspace: M, economy: M,
      timeline: M, approval: M, delivery: M,
    },
  },
  {
    key: 'executive_producer', label: 'Executive Producer', department: 'ledelse',
    description: 'Finansiering og strategi. Ser alt, styrer økonomi og godkjenning.',
    preset: {
      oversikt: V, 'story-arc': V, storyboard: V, roles: V, candidates: V,
      auditions: V, selection: V, locations: V, callsheet: V, crew: V,
      equipment: V, 'live-set': V, workspace: V, economy: M, timeline: V,
      approval: M, delivery: V,
    },
  },
  {
    key: 'production_manager', label: 'Produksjonsleder', department: 'ledelse',
    description: 'Praktisk gjennomføring: plan, booking, lokasjon, utstyr, crew, kostnad.',
    preset: {
      oversikt: V, 'story-arc': V, storyboard: V, roles: V, candidates: V,
      selection: V, locations: M, callsheet: M, crew: M, equipment: M,
      'live-set': M, workspace: V, economy: M, timeline: M, approval: V,
      delivery: V,
    },
  },
  {
    key: 'production_coordinator', label: 'Produksjonskoordinator', department: 'ledelse',
    description: 'Dokumenter og admin: crew-lister, kontakter, reise, call sheets.',
    preset: {
      oversikt: V, callsheet: M, crew: M, equipment: M, locations: V,
      workspace: V, economy: V, approval: V, delivery: V,
    },
  },
  {
    key: 'first_ad', label: 'Innspillingsleder / 1st AD', department: 'ledelse',
    description: 'Eier fremdrift på sett og dagens kjøreplan.',
    preset: {
      oversikt: V, 'story-arc': V, storyboard: V, roles: V, 'live-set': M,
      callsheet: M, crew: V, locations: V, equipment: V, shotlist: V,
    },
  },
  {
    key: 'pa', label: 'Production Assistant (PA)', department: 'ledelse',
    description: 'Praktisk støtte på sett og i logistikk.',
    preset: {
      oversikt: V, callsheet: V, crew: V, locations: V, 'live-set': V,
    },
  },

  // ── Kreativ ledelse ────────────────────────────────────────────────
  {
    key: 'director', label: 'Regissør', department: 'kreativ',
    description: 'Eier historie, kreativ retning, skuespiller-regi og valg av tagninger.',
    preset: {
      oversikt: V, 'story-arc': M, storyboard: M, roles: M, candidates: M,
      auditions: M, selection: M, shotlist: M, 'live-set': M, callsheet: V,
      locations: V, workspace: V, timeline: V, approval: M, delivery: V,
    },
  },
  {
    key: 'creative_director', label: 'Creative Director', department: 'kreativ',
    description: 'Overordnet idé, konsept og merkevare. Godkjenner kreativt.',
    preset: {
      oversikt: V, 'story-arc': M, storyboard: M, roles: V, candidates: V,
      selection: V, workspace: M, timeline: V, approval: M, delivery: V,
    },
  },
  {
    key: 'writer', label: 'Manusforfatter', department: 'kreativ',
    description: 'Skriver og eier manus.',
    preset: {
      oversikt: V, 'story-arc': M, storyboard: V, roles: V, workspace: V,
    },
  },
  {
    key: 'script_editor', label: 'Manuskonsulent / Script Editor', department: 'kreativ',
    description: 'Bearbeider manus og historie-struktur.',
    preset: {
      oversikt: V, 'story-arc': M, storyboard: V, roles: V, approval: V,
    },
  },
  {
    key: 'storyboard_artist', label: 'Storyboard Artist', department: 'kreativ',
    description: 'Tegner og eier storyboard.',
    preset: {
      oversikt: V, storyboard: M, 'story-arc': V, shotlist: V, roles: V,
    },
  },

  // ── Kameraavdeling ─────────────────────────────────────────────────
  {
    key: 'dop', label: 'Filmfotograf / DOP', department: 'kamera',
    description: 'Eier det visuelle kamerauttrykket: bildekomposisjon, optikk, bevegelse.',
    preset: {
      oversikt: V, storyboard: M, shotlist: M, equipment: M, 'story-arc': V,
      callsheet: V, locations: V, crew: V, 'live-set': V,
    },
  },
  {
    key: 'camera_operator', label: 'Kameraoperatør', department: 'kamera',
    description: 'Fører kameraet under opptak.',
    preset: {
      oversikt: V, storyboard: V, shotlist: V, 'live-set': V, callsheet: V,
      equipment: V,
    },
  },
  {
    key: 'camera_team', label: 'Kamerateam', department: 'kamera',
    description: 'Kameraavdelingen samlet.',
    preset: {
      oversikt: V, storyboard: V, shotlist: V, 'live-set': V, callsheet: V,
      equipment: V, roles: V,
    },
  },
  {
    key: 'first_ac', label: '1st AC / Fokuspuller', department: 'kamera',
    description: 'Ansvar for fokus og kamerateknikk.',
    preset: {
      oversikt: V, shotlist: V, equipment: V, callsheet: V, 'live-set': V,
    },
  },
  {
    key: 'second_ac', label: '2nd AC', department: 'kamera',
    description: 'Kamera-support, klapper og logg.',
    preset: {
      oversikt: V, shotlist: V, equipment: V, callsheet: V,
    },
  },
  {
    key: 'dit', label: 'DIT', department: 'kamera',
    description: 'Eier filhåndtering, backup og on-set fargekontroll.',
    preset: {
      oversikt: V, workspace: M, delivery: M, callsheet: V, 'live-set': V,
      equipment: V,
    },
  },
  {
    key: 'data_wrangler', label: 'Data Wrangler', department: 'kamera',
    description: 'Kopierer og sikrer opptaksdata på sett.',
    preset: {
      oversikt: V, workspace: M, callsheet: V, 'live-set': V,
    },
  },
  {
    key: 'drone_pilot', label: 'Dronepilot', department: 'kamera',
    description: 'Flygende kameraopptak.',
    preset: {
      oversikt: V, storyboard: V, shotlist: V, callsheet: V, locations: V,
      'live-set': V,
    },
  },

  // ── Lys & grip ─────────────────────────────────────────────────────
  {
    key: 'gaffer', label: 'Gaffer', department: 'lys_grip',
    description: 'Eier den praktiske gjennomføringen av lyset.',
    preset: {
      oversikt: V, equipment: M, storyboard: V, callsheet: V, locations: V,
      'live-set': V,
    },
  },
  {
    key: 'best_boy', label: 'Best Boy', department: 'lys_grip',
    description: 'Nestleder lys/grip, koordinerer utstyr.',
    preset: {
      oversikt: V, equipment: V, callsheet: V, 'live-set': V,
    },
  },
  {
    key: 'lighting_tech', label: 'Lystekniker', department: 'lys_grip',
    description: 'Rigger og betjener lys.',
    preset: {
      oversikt: V, equipment: V, callsheet: V, 'live-set': V,
    },
  },
  {
    key: 'key_grip', label: 'Key Grip', department: 'lys_grip',
    description: 'Eier rigg, dolly og kamera-support-utstyr.',
    preset: {
      oversikt: V, equipment: M, callsheet: V, locations: V, 'live-set': V,
    },
  },
  {
    key: 'grip', label: 'Grip', department: 'lys_grip',
    description: 'Rigg og fysisk kamera-support.',
    preset: {
      oversikt: V, equipment: V, callsheet: V, 'live-set': V,
    },
  },

  // ── Lyd ────────────────────────────────────────────────────────────
  {
    key: 'sound_mixer', label: 'Production Sound Mixer', department: 'lyd',
    description: 'Eier opptakslyden på sett.',
    preset: {
      oversikt: V, equipment: M, 'story-arc': V, callsheet: V, 'live-set': V,
    },
  },
  {
    key: 'boom_operator', label: 'Boom Operator', department: 'lyd',
    description: 'Fører mikrofon under opptak.',
    preset: {
      oversikt: V, callsheet: V, 'live-set': V, equipment: V,
    },
  },
  {
    key: 'utility_sound', label: 'Utility Sound Tech', department: 'lyd',
    description: 'Lyd-support på sett.',
    preset: {
      oversikt: V, callsheet: V, 'live-set': V,
    },
  },

  // ── Scenografi, kostyme & utseende ─────────────────────────────────
  {
    key: 'production_designer', label: 'Production Designer', department: 'design',
    description: 'Eier den visuelle verdenen: sett, farger, materialer.',
    preset: {
      oversikt: V, equipment: M, storyboard: V, 'story-arc': V, locations: M,
      callsheet: V,
    },
  },
  {
    key: 'art_director', label: 'Art Director', department: 'design',
    description: 'Gjennomfører scenografien praktisk.',
    preset: {
      oversikt: V, equipment: M, storyboard: V, locations: V, callsheet: V,
    },
  },
  {
    key: 'set_decorator', label: 'Set Decorator', department: 'design',
    description: 'Møblerer og dekorerer settet.',
    preset: {
      oversikt: V, equipment: M, locations: V, callsheet: V,
    },
  },
  {
    key: 'props_master', label: 'Rekvisitør / Props Master', department: 'design',
    description: 'Eier rekvisitter.',
    preset: {
      oversikt: V, equipment: M, callsheet: V, 'live-set': V,
    },
  },
  {
    key: 'costume_designer', label: 'Kostymedesigner', department: 'design',
    description: 'Designer kostyme og garderobe.',
    preset: {
      oversikt: V, equipment: M, roles: V, callsheet: V,
    },
  },
  {
    key: 'costume_supervisor', label: 'Costume Supervisor', department: 'design',
    description: 'Ansvar for garderobe-kontinuitet og logistikk.',
    preset: {
      oversikt: V, equipment: V, callsheet: V, roles: V,
    },
  },
  {
    key: 'makeup_artist', label: 'Makeup Artist', department: 'design',
    description: 'Sminke.',
    preset: {
      oversikt: V, roles: V, callsheet: V, 'live-set': V,
    },
  },
  {
    key: 'hair_stylist', label: 'Hair Stylist', department: 'design',
    description: 'Hår og frisyre.',
    preset: {
      oversikt: V, roles: V, callsheet: V, 'live-set': V,
    },
  },

  // ── Regi- & kontinuitetsstøtte ─────────────────────────────────────
  {
    key: 'script_supervisor', label: 'Script Supervisor / Kontinuitet', department: 'regi_kontinuitet',
    description: 'Eier kontinuitet mellom tagninger og scener.',
    preset: {
      oversikt: V, shotlist: M, 'story-arc': V, storyboard: V, roles: V,
      callsheet: V, 'live-set': V,
    },
  },
  {
    key: 'casting_director', label: 'Casting Director', department: 'regi_kontinuitet',
    description: 'Eier roller, kandidater, auditions og casting-kjøreplan.',
    preset: {
      oversikt: V, roles: M, candidates: M, auditions: M, selection: M,
      callsheet: M, 'story-arc': V, storyboard: V,
    },
  },
  {
    key: 'acting_coach', label: 'Acting Coach', department: 'regi_kontinuitet',
    description: 'Coacher skuespillere.',
    preset: {
      oversikt: V, roles: V, candidates: V, selection: V, 'story-arc': V,
      'live-set': V,
    },
  },

  // ── Lokasjon & logistikk ───────────────────────────────────────────
  {
    key: 'location_manager', label: 'Location Manager', department: 'lokasjon',
    description: 'Eier lokasjoner, avtaler og tilhørende kjøreplan.',
    preset: {
      oversikt: V, locations: M, callsheet: M, equipment: V, crew: V,
    },
  },
  {
    key: 'location_scout', label: 'Location Scout', department: 'lokasjon',
    description: 'Finner og foreslår lokasjoner.',
    preset: {
      oversikt: V, locations: M, callsheet: V,
    },
  },

  // ── Postproduksjon ─────────────────────────────────────────────────
  {
    key: 'post_producer', label: 'Postprodusent', department: 'post',
    description: 'Eier post-plan, budsjett, versjoner, leveransespesifikasjon.',
    preset: {
      oversikt: V, workspace: M, timeline: M, delivery: M, economy: M,
      approval: M, 'story-arc': V, storyboard: V,
    },
  },
  {
    key: 'editor', label: 'Klipper / Editor', department: 'post',
    description: 'Eier historien i etterarbeidet.',
    preset: {
      oversikt: V, workspace: M, delivery: M, timeline: M, 'story-arc': V,
      storyboard: V, approval: V,
    },
  },
  {
    key: 'assistant_editor', label: 'Assistant Editor', department: 'post',
    description: 'Organiserer materiale og støtter klipp.',
    preset: {
      oversikt: V, workspace: M, delivery: V, timeline: V,
    },
  },
  {
    key: 'colorist', label: 'Colorist', department: 'post',
    description: 'Eier sluttfargene (grading).',
    preset: {
      oversikt: V, delivery: M, workspace: V, timeline: V, storyboard: V,
    },
  },
  {
    key: 'sound_designer', label: 'Sound Designer', department: 'post',
    description: 'Designer lydbildet i post.',
    preset: {
      oversikt: V, delivery: M, workspace: V, timeline: V,
    },
  },
  {
    key: 'dialogue_editor', label: 'Dialogue Editor', department: 'post',
    description: 'Redigerer dialog i post.',
    preset: {
      oversikt: V, workspace: V, delivery: V, timeline: V,
    },
  },
  {
    key: 'foley_artist', label: 'Foley Artist', department: 'post',
    description: 'Lager foley-lyd.',
    preset: {
      oversikt: V, workspace: V, delivery: V,
    },
  },
  {
    key: 'rerecording_mixer', label: 'Re-recording Mixer / Lydmikser', department: 'post',
    description: 'Eier sluttlyden (miks).',
    preset: {
      oversikt: V, delivery: M, workspace: V, timeline: V,
    },
  },
  {
    key: 'composer', label: 'Komponist', department: 'post',
    description: 'Komponerer musikk.',
    preset: {
      oversikt: V, workspace: V, 'story-arc': V, delivery: V,
    },
  },
  {
    key: 'music_supervisor', label: 'Music Supervisor', department: 'post',
    description: 'Kuraterer og klarerer musikk.',
    preset: {
      oversikt: V, workspace: V, delivery: V, approval: V,
    },
  },
  {
    key: 'motion_designer', label: 'Motion Designer', department: 'post',
    description: 'Eier grafikk og animasjon.',
    preset: {
      oversikt: V, delivery: M, workspace: V, storyboard: V, timeline: V,
    },
  },
  {
    key: 'vfx_supervisor', label: 'VFX Supervisor', department: 'post',
    description: 'Leder VFX-arbeidet.',
    preset: {
      oversikt: V, delivery: M, workspace: M, storyboard: V, shotlist: V,
      timeline: V,
    },
  },
  {
    key: 'vfx_artist', label: 'VFX Artist', department: 'post',
    description: 'Lager visuelle effekter.',
    preset: {
      oversikt: V, workspace: V, delivery: V, storyboard: V,
    },
  },
  {
    key: 'online_editor', label: 'Online Editor', department: 'post',
    description: 'Eier den endelige masteren og leveransen.',
    preset: {
      oversikt: V, delivery: M, workspace: V, timeline: V,
    },
  },

  // ── Kunde, marked & innhold ────────────────────────────────────────
  {
    key: 'account_manager', label: 'Kundeansvarlig / Account Manager', department: 'kunde',
    description: 'Kundens kontaktpunkt: brief, forventninger, godkjenning.',
    preset: {
      oversikt: V, approval: M, workspace: M, timeline: V, delivery: V,
      callsheet: V,
    },
  },
  {
    key: 'content_producer', label: 'Content Producer', department: 'kunde',
    description: 'Kombinerer produsent, regi og innholdsstrategi.',
    preset: {
      oversikt: V, 'story-arc': M, candidates: M, workspace: M, timeline: M,
      approval: M, economy: M, callsheet: M, roles: V, storyboard: V,
      locations: V, delivery: V,
    },
  },
  {
    key: 'social_media_manager', label: 'Social Media Manager', department: 'kunde',
    description: 'Distribusjon og publisering.',
    preset: {
      oversikt: V, delivery: M, workspace: M, approval: V, timeline: V,
    },
  },
  {
    key: 'agency', label: 'Byrå', department: 'kunde',
    description: 'Ekstern byrå-part.',
    preset: {
      oversikt: V, approval: V, workspace: V, 'story-arc': V, delivery: V,
      timeline: V,
    },
  },
  {
    key: 'client_reviewer', label: 'Klient / Reviewer', department: 'kunde',
    description: 'Godkjenner og kommenterer. Ingen intern innsikt.',
    preset: {
      oversikt: V, approval: V, workspace: V, delivery: V, timeline: V,
    },
  },
  {
    key: 'reader', label: 'Leser', department: 'kunde',
    description: 'Ren lesetilgang til historie og roller.',
    preset: {
      oversikt: V, 'story-arc': V, roles: V,
    },
  },

  // ── System / generisk ──────────────────────────────────────────────
  {
    key: 'crew', label: 'Crew / tekniker (generisk)', department: 'system',
    description: 'Standard for teknisk crew uten egen rolle — ser kjøreplan og sett.',
    preset: {
      oversikt: V, callsheet: V, crew: V, locations: V, 'live-set': V,
    },
  },
];

export const PRODUCTION_ROLE_BY_KEY: Record<string, ProductionRoleDef> =
  Object.fromEntries(PRODUCTION_ROLES.map((r) => [r.key, r]));

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  PRODUCTION_ROLES.map((r) => [r.key, r.label]),
);

/** Roller gruppert etter avdeling, i katalog-rekkefølge (for dropdown/matrise). */
export function rolesByDepartment(): Array<{ department: ProductionDepartment; label: string; roles: ProductionRoleDef[] }> {
  const order: ProductionDepartment[] = [
    'ledelse', 'kreativ', 'kamera', 'lys_grip', 'lyd', 'design',
    'regi_kontinuitet', 'lokasjon', 'post', 'kunde', 'system',
  ];
  return order.map((dep) => ({
    department: dep,
    label: DEPARTMENT_LABELS[dep],
    roles: PRODUCTION_ROLES.filter((r) => r.department === dep),
  }));
}

// ── Oppslag & resolusjon ───────────────────────────────────────────────

/** Har vi et definert preset for denne rollen? */
export function hasRolePreset(roleKey: string | null | undefined): boolean {
  return !!(roleKey && PRODUCTION_ROLE_BY_KEY[roleKey]);
}

/** Standard tilgangskart for en rolle (fallback for ukjent rolle = generisk crew). */
export function presetForRole(roleKey: string | null | undefined): TabAccessMap {
  if (roleKey && PRODUCTION_ROLE_BY_KEY[roleKey]) {
    return PRODUCTION_ROLE_BY_KEY[roleKey].preset;
  }
  return PRODUCTION_ROLE_BY_KEY.crew.preset;
}

/**
 * Effektivt tilgangskart for en bruker: en eksplisitt overstyring (fra
 * "Tilganger"-dialogen) vinner; ellers rollens preset.
 */
export function resolveTabAccess(
  override: TabAccessMap | null | undefined,
  roleKey: string | null | undefined,
): TabAccessMap {
  if (isAccessMap(override)) return override;
  return presetForRole(roleKey);
}

function isAccessMap(v: unknown): v is TabAccessMap {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Nivå for én fane i et tilgangskart. */
export function levelForTab(access: TabAccessMap | null | undefined, tabKey: string): TabAccessState {
  const lvl = access?.[tabKey];
  return lvl === 'manage' ? 'manage' : lvl === 'view' ? 'view' : 'hidden';
}

/** Synlige fane-nøkler (view eller manage). */
export function visibleTabKeys(access: TabAccessMap | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!access) return out;
  for (const [k, lvl] of Object.entries(access)) {
    if (lvl === 'view' || lvl === 'manage') out.add(k);
  }
  return out;
}

/** Fane-nøkler brukeren kan administrere (skrive). */
export function manageableTabKeys(access: TabAccessMap | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!access) return out;
  for (const [k, lvl] of Object.entries(access)) {
    if (lvl === 'manage') out.add(k);
  }
  return out;
}

/** Bakover-kompat: liste over synlige fane-nøkler (for tab_values TEXT[]). */
export function tabAccessToTabValues(access: TabAccessMap | null | undefined): string[] {
  return Array.from(visibleTabKeys(access));
}
