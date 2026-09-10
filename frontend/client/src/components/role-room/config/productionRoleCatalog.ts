/**
 * Canonical production organisation for film/video projects.
 *
 * ProfessionMode selects the project domain (production, dance, education).
 * This catalogue describes the role a person has inside one production. Roles
 * must therefore share project data and permissions instead of creating a new
 * profession mode or a parallel project model.
 */

export const PRODUCTION_PHASES = ['above_line', 'below_line', 'post_production'] as const;
export type ProductionPhase = (typeof PRODUCTION_PHASES)[number];

export const PRODUCTION_DEPARTMENTS = [
  { id: 'producers', label: 'Produsenter', phase: 'above_line', colorGroup: 'operations' },
  { id: 'direction', label: 'Regi', phase: 'above_line', colorGroup: 'creative' },
  { id: 'writing', label: 'Manus', phase: 'above_line', colorGroup: 'creative' },
  { id: 'locations', label: 'Location', phase: 'below_line', colorGroup: 'operations' },
  { id: 'production_management', label: 'Produksjonsledelse', phase: 'below_line', colorGroup: 'operations' },
  { id: 'assistant_direction', label: 'Innspillingsledelse', phase: 'below_line', colorGroup: 'creative' },
  { id: 'casting', label: 'Casting', phase: 'below_line', colorGroup: 'creative' },
  { id: 'continuity', label: 'Kontinuitet', phase: 'below_line', colorGroup: 'creative' },
  { id: 'camera', label: 'Kamera', phase: 'below_line', colorGroup: 'technical' },
  { id: 'electrical', label: 'Lys', phase: 'below_line', colorGroup: 'technical' },
  { id: 'grip', label: 'Grip', phase: 'below_line', colorGroup: 'technical' },
  { id: 'cast', label: 'Medvirkende', phase: 'below_line', colorGroup: 'creative' },
  { id: 'special_effects', label: 'Spesialeffekter', phase: 'below_line', colorGroup: 'creative' },
  { id: 'art', label: 'Art department', phase: 'below_line', colorGroup: 'creative' },
  { id: 'sound', label: 'Opptakslyd', phase: 'below_line', colorGroup: 'creative' },
  { id: 'stunts', label: 'Stunt', phase: 'below_line', colorGroup: 'creative' },
  { id: 'transportation', label: 'Transport', phase: 'below_line', colorGroup: 'operations' },
  { id: 'craft_service', label: 'Craft service', phase: 'below_line', colorGroup: 'operations' },
  { id: 'catering', label: 'Catering', phase: 'below_line', colorGroup: 'operations' },
  { id: 'publicity', label: 'PR og stills', phase: 'below_line', colorGroup: 'operations' },
  { id: 'costumes', label: 'Kostyme', phase: 'below_line', colorGroup: 'creative' },
  { id: 'sets', label: 'Set decoration', phase: 'below_line', colorGroup: 'creative' },
  { id: 'props', label: 'Rekvisitt', phase: 'below_line', colorGroup: 'creative' },
  { id: 'hair_makeup', label: 'Hår og sminke', phase: 'below_line', colorGroup: 'creative' },
  { id: 'construction', label: 'Konstruksjon', phase: 'below_line', colorGroup: 'creative' },
  { id: 'other', label: 'Andre', phase: 'below_line', colorGroup: 'operations' },
  { id: 'post_management', label: 'Etterarbeidsledelse', phase: 'post_production', colorGroup: 'post' },
  { id: 'music', label: 'Musikk', phase: 'post_production', colorGroup: 'post' },
  { id: 'post_sound', label: 'Lydetterarbeid', phase: 'post_production', colorGroup: 'post' },
  { id: 'editorial', label: 'Klipp og farge', phase: 'post_production', colorGroup: 'post' },
  { id: 'visual_effects', label: 'Visuelle effekter', phase: 'post_production', colorGroup: 'post' },
] as const;

export type ProductionDepartmentId = (typeof PRODUCTION_DEPARTMENTS)[number]['id'];
export type ProductionColorGroup = (typeof PRODUCTION_DEPARTMENTS)[number]['colorGroup'];
export type ProductionWorkspaceKind =
  | 'producer'
  | 'director'
  | 'cinematography'
  | 'production_management'
  | 'assistant_direction'
  | 'casting'
  | 'continuity'
  | 'department';

interface ProductionRoleDefinitionBase {
  id: string;
  label: string;
  departmentId: ProductionDepartmentId;
  reportsTo?: string;
  aliases?: readonly string[];
  workspace: ProductionWorkspaceKind;
}

/**
 * Existing persisted role IDs are retained where possible. External names
 * such as DP, DoP and director_of_photography resolve through aliases.
 */
export const PRODUCTION_ROLES = [
  { id: 'executive_producer', label: 'Ansvarlig produsent', departmentId: 'producers', workspace: 'producer' },
  { id: 'producer', label: 'Produsent', departmentId: 'producers', reportsTo: 'executive_producer', workspace: 'producer' },
  { id: 'line_producer', label: 'Linjeprodusent', departmentId: 'producers', reportsTo: 'producer', workspace: 'producer' },
  { id: 'director', label: 'Regissør', departmentId: 'direction', reportsTo: 'producer', workspace: 'director' },
  {
    id: 'cinematographer',
    label: 'Filmfotograf (DoP)',
    departmentId: 'camera',
    reportsTo: 'director',
    aliases: ['director_of_photography', 'director of photography', 'dop', 'dp', 'filmfotograf'],
    workspace: 'cinematography',
  },
  { id: 'writer', label: 'Manusforfatter', departmentId: 'writing', reportsTo: 'director', aliases: ['screenwriter'], workspace: 'department' },
  { id: 'location_manager', label: 'Location manager', departmentId: 'locations', reportsTo: 'line_producer', workspace: 'department' },
  { id: 'location_scout', label: 'Location scout', departmentId: 'locations', reportsTo: 'location_manager', workspace: 'department' },
  { id: 'location_security', label: 'Location security', departmentId: 'locations', reportsTo: 'location_manager', workspace: 'department' },
  { id: 'production_manager', label: 'Produksjonsleder', departmentId: 'production_management', reportsTo: 'line_producer', aliases: ['unit_production_manager', 'upm'], workspace: 'production_management' },
  { id: 'production_coordinator', label: 'Produksjonskoordinator', departmentId: 'production_management', reportsTo: 'production_manager', workspace: 'production_management' },
  { id: 'production_secretary', label: 'Produksjonssekretær', departmentId: 'production_management', reportsTo: 'production_coordinator', workspace: 'production_management' },
  { id: 'production_accountant', label: 'Produksjonsregnskapsfører', departmentId: 'production_management', reportsTo: 'production_manager', workspace: 'production_management' },
  { id: 'office_production_assistant', label: 'Kontor-PA', departmentId: 'production_management', reportsTo: 'production_coordinator', aliases: ['office_pa', 'production_assistant'], workspace: 'production_management' },
  { id: 'collaborator', label: 'Produksjonsmedarbeider', departmentId: 'production_management', reportsTo: 'production_coordinator', workspace: 'department' },
  { id: 'first_assistant_director', label: '1. regiassistent', departmentId: 'assistant_direction', reportsTo: 'director', aliases: ['1st_ad', 'first_ad'], workspace: 'assistant_direction' },
  { id: 'second_assistant_director', label: '2. regiassistent', departmentId: 'assistant_direction', reportsTo: 'first_assistant_director', aliases: ['2nd_ad', 'second_ad'], workspace: 'assistant_direction' },
  { id: 'second_second_assistant_director', label: '2nd 2nd AD', departmentId: 'assistant_direction', reportsTo: 'second_assistant_director', aliases: ['2nd_2nd_ad'], workspace: 'assistant_direction' },
  { id: 'set_production_assistant', label: 'Set-PA', departmentId: 'assistant_direction', reportsTo: 'second_assistant_director', aliases: ['set_pa'], workspace: 'assistant_direction' },
  { id: 'casting_director', label: 'Castingansvarlig', departmentId: 'casting', reportsTo: 'director', workspace: 'casting' },
  { id: 'local_casting_director', label: 'Lokal castingansvarlig', departmentId: 'casting', reportsTo: 'casting_director', workspace: 'casting' },
  { id: 'extras_casting_director', label: 'Statistansvarlig', departmentId: 'casting', reportsTo: 'casting_director', workspace: 'casting' },
  { id: 'script_supervisor', label: 'Script supervisor', departmentId: 'continuity', reportsTo: 'director', aliases: ['continuity'], workspace: 'continuity' },
  { id: 'camera_operator', label: 'Kameraoperatør', departmentId: 'camera', reportsTo: 'cinematographer', workspace: 'cinematography' },
  { id: 'first_assistant_camera', label: '1. kameraassistent', departmentId: 'camera', reportsTo: 'cinematographer', aliases: ['1st_ac', 'camera_assistant', 'focus_puller'], workspace: 'cinematography' },
  { id: 'second_assistant_camera', label: '2. kameraassistent', departmentId: 'camera', reportsTo: 'first_assistant_camera', aliases: ['2nd_ac', 'clapper_loader'], workspace: 'cinematography' },
  { id: 'digital_imaging_technician', label: 'DIT', departmentId: 'camera', reportsTo: 'cinematographer', aliases: ['dit'], workspace: 'cinematography' },
  { id: 'drone_pilot', label: 'Droneoperatør', departmentId: 'camera', reportsTo: 'cinematographer', workspace: 'cinematography' },
  { id: 'gaffer', label: 'Gaffer', departmentId: 'electrical', reportsTo: 'cinematographer', workspace: 'cinematography' },
  { id: 'best_boy_electric', label: 'Best boy electric', departmentId: 'electrical', reportsTo: 'gaffer', workspace: 'department' },
  { id: 'generator_operator', label: 'Generatoroperatør', departmentId: 'electrical', reportsTo: 'gaffer', workspace: 'department' },
  { id: 'lighting_technician', label: 'Lystekniker', departmentId: 'electrical', reportsTo: 'gaffer', aliases: ['lighting_technicians'], workspace: 'department' },
  { id: 'key_grip', label: 'Key grip', departmentId: 'grip', reportsTo: 'cinematographer', workspace: 'cinematography' },
  { id: 'best_boy_grip', label: 'Best boy grip', departmentId: 'grip', reportsTo: 'key_grip', workspace: 'department' },
  { id: 'dolly_grip', label: 'Dolly grip', departmentId: 'grip', reportsTo: 'key_grip', workspace: 'department' },
  { id: 'grip', label: 'Grip', departmentId: 'grip', reportsTo: 'key_grip', workspace: 'department' },
  { id: 'stand_in', label: 'Stand-in', departmentId: 'cast', reportsTo: 'second_assistant_director', workspace: 'department' },
  { id: 'background_performer', label: 'Statist', departmentId: 'cast', reportsTo: 'second_assistant_director', aliases: ['background'], workspace: 'department' },
  { id: 'sfx_supervisor', label: 'SFX supervisor', departmentId: 'special_effects', reportsTo: 'director', workspace: 'department' },
  { id: 'production_designer', label: 'Produksjonsdesigner', departmentId: 'art', reportsTo: 'director', workspace: 'department' },
  { id: 'set_designer', label: 'Settdesigner', departmentId: 'art', reportsTo: 'production_designer', workspace: 'department' },
  { id: 'concept_illustrator', label: 'Konseptillustratør', departmentId: 'art', reportsTo: 'production_designer', workspace: 'department' },
  { id: 'storyboard_artist', label: 'Storyboardartist', departmentId: 'art', reportsTo: 'production_designer', workspace: 'department' },
  { id: 'production_sound_mixer', label: 'Produksjonslydmikser', departmentId: 'sound', reportsTo: 'director', aliases: ['sound_mixer', 'audio_mixer', 'sound_engineer'], workspace: 'department' },
  { id: 'boom_operator', label: 'Boomoperatør', departmentId: 'sound', reportsTo: 'production_sound_mixer', workspace: 'department' },
  { id: 'stunt_coordinator', label: 'Stuntkoordinator', departmentId: 'stunts', reportsTo: 'director', workspace: 'department' },
  { id: 'stunt_double', label: 'Stuntdouble', departmentId: 'stunts', reportsTo: 'stunt_coordinator', workspace: 'department' },
  { id: 'transportation_captain', label: 'Transportansvarlig', departmentId: 'transportation', reportsTo: 'production_manager', workspace: 'department' },
  { id: 'driver', label: 'Sjåfør', departmentId: 'transportation', reportsTo: 'transportation_captain', aliases: ['drivers'], workspace: 'department' },
  { id: 'craft_services', label: 'Craft services', departmentId: 'craft_service', reportsTo: 'production_manager', workspace: 'department' },
  { id: 'chef', label: 'Kokk', departmentId: 'catering', reportsTo: 'production_manager', workspace: 'department' },
  { id: 'unit_publicist', label: 'Presseansvarlig', departmentId: 'publicity', reportsTo: 'producer', workspace: 'department' },
  { id: 'still_photographer', label: 'Stillfotograf', departmentId: 'publicity', reportsTo: 'unit_publicist', workspace: 'department' },
  { id: 'costume_designer', label: 'Kostymedesigner', departmentId: 'costumes', reportsTo: 'production_designer', workspace: 'department' },
  { id: 'wardrobe_supervisor', label: 'Kostymeansvarlig', departmentId: 'costumes', reportsTo: 'costume_designer', aliases: ['wardrobe', 'stylist'], workspace: 'department' },
  { id: 'set_decorator', label: 'Set decorator', departmentId: 'sets', reportsTo: 'production_designer', workspace: 'department' },
  { id: 'on_set_dresser', label: 'On-set dresser', departmentId: 'sets', reportsTo: 'set_decorator', workspace: 'department' },
  { id: 'greensperson', label: 'Greensperson', departmentId: 'sets', reportsTo: 'set_decorator', workspace: 'department' },
  { id: 'property_master', label: 'Rekvisittansvarlig', departmentId: 'props', reportsTo: 'production_designer', aliases: ['prop_master'], workspace: 'department' },
  { id: 'assistant_property_master', label: 'Rekvisittassistent', departmentId: 'props', reportsTo: 'property_master', aliases: ['assistant_prop_master'], workspace: 'department' },
  { id: 'key_hair_stylist', label: 'Håransvarlig', departmentId: 'hair_makeup', reportsTo: 'production_designer', workspace: 'department' },
  { id: 'key_makeup_artist', label: 'Sminkeansvarlig', departmentId: 'hair_makeup', reportsTo: 'production_designer', aliases: ['makeup_artist'], workspace: 'department' },
  { id: 'construction_coordinator', label: 'Konstruksjonskoordinator', departmentId: 'construction', reportsTo: 'production_designer', workspace: 'department' },
  { id: 'studio_teacher', label: 'Studio teacher', departmentId: 'other', reportsTo: 'production_manager', workspace: 'department' },
  { id: 'post_supervisor', label: 'Post supervisor', departmentId: 'post_management', reportsTo: 'producer', workspace: 'department' },
  { id: 'post_coordinator', label: 'Postkoordinator', departmentId: 'post_management', reportsTo: 'post_supervisor', workspace: 'department' },
  { id: 'music_supervisor', label: 'Musikkansvarlig', departmentId: 'music', reportsTo: 'post_supervisor', workspace: 'department' },
  { id: 'composer', label: 'Komponist', departmentId: 'music', reportsTo: 'music_supervisor', workspace: 'department' },
  { id: 'musician', label: 'Musiker', departmentId: 'music', reportsTo: 'composer', workspace: 'department' },
  { id: 'sound_designer', label: 'Lyddesigner', departmentId: 'post_sound', reportsTo: 'post_supervisor', workspace: 'department' },
  { id: 'sound_editor', label: 'Lydklipper', departmentId: 'post_sound', reportsTo: 'sound_designer', workspace: 'department' },
  { id: 'foley_artist', label: 'Foleyartist', departmentId: 'post_sound', reportsTo: 'sound_designer', workspace: 'department' },
  { id: 'adr_engineer', label: 'ADR-tekniker', departmentId: 'post_sound', reportsTo: 'sound_designer', workspace: 'department' },
  { id: 'supervising_editor', label: 'Klippeansvarlig', departmentId: 'editorial', reportsTo: 'post_supervisor', workspace: 'department' },
  { id: 'video_editor', label: 'Klipper', departmentId: 'editorial', reportsTo: 'supervising_editor', aliases: ['editor'], workspace: 'department' },
  { id: 'assistant_editor', label: 'Klippeassistent', departmentId: 'editorial', reportsTo: 'video_editor', workspace: 'department' },
  { id: 'colorist', label: 'Colorist', departmentId: 'editorial', reportsTo: 'supervising_editor', workspace: 'department' },
  { id: 'vfx_supervisor', label: 'VFX supervisor', departmentId: 'visual_effects', reportsTo: 'post_supervisor', workspace: 'department' },
  { id: 'vfx_artist', label: 'VFX-artist', departmentId: 'visual_effects', reportsTo: 'vfx_supervisor', workspace: 'department' },
  { id: 'motion_graphics_artist', label: 'Motion designer', departmentId: 'visual_effects', reportsTo: 'vfx_supervisor', aliases: ['motion_graphics'], workspace: 'department' },
] as const satisfies readonly ProductionRoleDefinitionBase[];

export type ProductionRoleId = (typeof PRODUCTION_ROLES)[number]['id'];
export type ProductionRoleDefinition = (typeof PRODUCTION_ROLES)[number];

export type ProductionCalendarDepartment =
  | 'regi'
  | 'produksjon'
  | 'kamera'
  | 'lys'
  | 'grip'
  | 'lyd'
  | 'art'
  | 'hmu'
  | 'kostyme'
  | 'personal';

export type ProductionTechnicalSubgroup = 'camera' | 'lighting' | 'sound' | 'post';

function normalizeRoleKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9æøå]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const ROLE_BY_ID = new Map(PRODUCTION_ROLES.map((role) => [role.id, role]));
const ROLE_ID_BY_ALIAS = new Map<string, ProductionRoleId>();

for (const role of PRODUCTION_ROLES) {
  for (const rawAlias of [role.id, role.label, ...('aliases' in role ? role.aliases : [])]) {
    const alias = normalizeRoleKey(rawAlias);
    const previous = ROLE_ID_BY_ALIAS.get(alias);
    if (previous && previous !== role.id) {
      throw new Error(`Produksjonsrolle-aliaset «${rawAlias}» brukes av både ${previous} og ${role.id}.`);
    }
    ROLE_ID_BY_ALIAS.set(alias, role.id);
  }
}

export function resolveProductionRoleId(value: unknown): ProductionRoleId | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return ROLE_ID_BY_ALIAS.get(normalizeRoleKey(value)) ?? null;
}

export function getProductionRoleDefinition(value: unknown): ProductionRoleDefinition | null {
  const roleId = resolveProductionRoleId(value);
  return roleId ? ROLE_BY_ID.get(roleId) ?? null : null;
}

export function getProductionDepartmentForRole(value: unknown): ProductionDepartmentId | null {
  return getProductionRoleDefinition(value)?.departmentId ?? null;
}

export function getProductionRoleLabel(value: unknown): string | null {
  return getProductionRoleDefinition(value)?.label ?? null;
}

export function getProductionWorkspaceForRole(value: unknown): ProductionWorkspaceKind | null {
  return getProductionRoleDefinition(value)?.workspace ?? null;
}

export function getCalendarDepartmentForProductionRole(value: unknown): ProductionCalendarDepartment {
  const department = getProductionDepartmentForRole(value);
  switch (department) {
    case null:
      return 'personal';
    case 'direction':
    case 'assistant_direction':
    case 'continuity':
      return 'regi';
    case 'camera':
      return 'kamera';
    case 'electrical':
      return 'lys';
    case 'grip':
      return 'grip';
    case 'sound':
    case 'post_sound':
    case 'music':
      return 'lyd';
    case 'art':
    case 'sets':
    case 'props':
    case 'construction':
    case 'special_effects':
    case 'visual_effects':
      return 'art';
    case 'hair_makeup':
      return 'hmu';
    case 'costumes':
      return 'kostyme';
    case 'other':
      return 'personal';
    default:
      return 'produksjon';
  }
}

export function getTechnicalSubgroupForProductionRole(
  value: unknown,
): ProductionTechnicalSubgroup | null {
  const department = getProductionDepartmentForRole(value);
  switch (department) {
    case 'camera':
      return 'camera';
    case 'electrical':
    case 'grip':
      return 'lighting';
    case 'sound':
    case 'post_sound':
      return 'sound';
    case 'post_management':
    case 'music':
    case 'editorial':
    case 'visual_effects':
      return 'post';
    default:
      return null;
  }
}

/** Delivery order after the director workspace, following the organisation map. */
export const PRODUCTION_WORKSPACE_DELIVERY_ORDER = [
  'director',
  'cinematography',
  'producer',
  'production_management',
  'assistant_direction',
  'continuity',
  'casting',
  'department',
] as const satisfies readonly ProductionWorkspaceKind[];
