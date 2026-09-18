/**
 * Én oversettelse fra det sesjonen sier til prosjektrollen vi styrer etter.
 *
 * Aliasene bodde tidligere som håndskrevne lister inne i CastingPlannerPanel,
 * i to nesten like blokker: `['first_ad', 'first_assistant_director', '1st_ad']`
 * og `['cinematographer', 'director_of_photography', 'dop', 'dp']` gjentatt
 * flere steder hver. Rollekatalogen eier allerede de samme aliasene
 * (`PRODUCTION_ROLES[].aliases`), så listene var en kopi som kunne drive fra
 * originalen uten at noe sa fra.
 *
 * Her går alt gjennom katalogen. `sessionProjectRole.test.ts` sjekker at
 * katalogen og linseregisteret fortsatt er enige, slik at en ny alias-skrivemåte
 * bare trenger å legges inn ett sted.
 */

import { resolveProductionRoleId, type ProductionRoleId } from './productionRoleCatalog';
import type { UserRoleType } from '../models/casting';

/**
 * Katalogens rolle-id er den kanoniske. Prosjektrollene i Role Room bruker
 * kortformer for noen av dem, og her står hele oversettelsen samlet.
 */
const CATALOG_TO_PROJECT_ROLE: Partial<Record<ProductionRoleId, UserRoleType>> = {
  director: 'director',
  producer: 'producer',
  casting_director: 'casting_director',
  cinematographer: 'camera_team',
  first_assistant_director: 'first_ad',
  second_assistant_director: 'second_ad',
  production_manager: 'production_manager',
  production_coordinator: 'production_coordinator',
  location_manager: 'location_manager',
  location_scout: 'location_scout',
  location_security: 'location_security',
  script_supervisor: 'script_supervisor',
};

/**
 * Konto- og fotoroller som ikke finnes i produksjonskatalogen, men som må
 * lande på nærmeste prosjektrolle for at rettighetene skal bli riktige.
 */
const ACCOUNT_ROLE_TO_PROJECT_ROLE: Record<string, UserRoleType> = {
  owner: 'director',
  super_admin: 'director',
  admin: 'producer',
  content_producer: 'content_producer',
  client: 'client_reviewer',
  client_reviewer: 'client_reviewer',
  camera_operator: 'camera_team',
  camera_team: 'camera_team',
  writer: 'writer',
  script_editor: 'script_editor',
  reader: 'reader',
  agency: 'agency',
  photographer: 'content_producer',
  film_photographer: 'content_producer',
  photo_director: 'content_producer',
  photo_assistant: 'content_producer',
};

/**
 * Prosjektrollen en verdi svarer til, uansett om den er skrevet som katalogens
 * id, et av dens alias, eller en kontorolle. `null` når verdien ikke sier noe.
 */
export function resolveSessionProjectRole(value: unknown): UserRoleType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const catalogId = resolveProductionRoleId(normalized);
  if (catalogId && CATALOG_TO_PROJECT_ROLE[catalogId]) {
    return CATALOG_TO_PROJECT_ROLE[catalogId] as UserRoleType;
  }

  return ACCOUNT_ROLE_TO_PROJECT_ROLE[normalized] ?? null;
}

/** True hvis verdien peker på denne prosjektrollen, uansett skrivemåte. */
export function isSessionProjectRole(value: unknown, role: UserRoleType): boolean {
  return resolveSessionProjectRole(value) === role;
}
