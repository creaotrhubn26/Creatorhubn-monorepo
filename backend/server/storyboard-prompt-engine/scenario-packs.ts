import { z } from 'zod';
import medicalPackJson from './scenario-packs/v1/medical.json';
import restaurantPackJson from './scenario-packs/v1/restaurant.json';
import extendedPackJson from './scenario-packs/v1/extended.json';

const scenarioIdSchema = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const promptEntrySchema = z.object({
  id: scenarioIdSchema,
  label: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
}).strict();
const roleEntrySchema = promptEntrySchema.extend({
  wardrobe: z.string().trim().min(1),
}).strict();
const idsSchema = z.array(scenarioIdSchema).min(1).superRefine((values, context) => {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'IDs must be unique' });
  }
});

const scenarioPackSchema = z.object({
  schemaVersion: z.literal('trr-scenario-pack-v1'),
  id: scenarioIdSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  label: z.string().trim().min(1),
  domain: scenarioIdSchema,
  description: z.string().trim().min(1),
  catalog: z.object({
    zones: z.array(promptEntrySchema).min(1),
    roles: z.array(roleEntrySchema).min(1),
    propTypes: z.array(promptEntrySchema).min(1),
    actions: z.array(promptEntrySchema).min(1),
    states: z.array(promptEntrySchema).min(1),
    safetyContexts: z.array(promptEntrySchema).min(1),
    continuityLocks: z.array(promptEntrySchema).min(1),
  }).strict(),
  subdomains: z.array(z.object({
    id: scenarioIdSchema,
    label: z.string().trim().min(1),
    zoneIds: idsSchema,
    roleIds: idsSchema,
    propTypeIds: idsSchema,
    actionIds: idsSchema,
    stateIds: idsSchema,
    safetyContextIds: idsSchema,
    continuityLockIds: idsSchema,
  }).strict()).min(1),
  families: z.array(z.object({
    id: scenarioIdSchema,
    label: z.string().trim().min(1),
    primaryStyleAnchor: z.enum(['object-architecture', 'organic-nature', 'weather-effects']),
    secondaryStyleAnchor: z.enum(['object-architecture', 'organic-nature', 'weather-effects']).optional(),
    variants: z.array(promptEntrySchema).length(4),
  }).strict()).min(1),
}).strict();

export type StoryboardScenarioPack = z.infer<typeof scenarioPackSchema>;
type ScenarioCatalogKey = 'roles' | 'propTypes' | 'actions' | 'states' | 'continuityLocks';
type ScenarioSubdomainKey = 'roleIds' | 'propTypeIds' | 'actionIds' | 'stateIds' | 'continuityLockIds';

function assertReferences(pack: StoryboardScenarioPack): StoryboardScenarioPack {
  const catalogIds = {
    zoneIds: new Set(pack.catalog.zones.map((entry) => entry.id)),
    roleIds: new Set(pack.catalog.roles.map((entry) => entry.id)),
    propTypeIds: new Set(pack.catalog.propTypes.map((entry) => entry.id)),
    actionIds: new Set(pack.catalog.actions.map((entry) => entry.id)),
    stateIds: new Set(pack.catalog.states.map((entry) => entry.id)),
    safetyContextIds: new Set(pack.catalog.safetyContexts.map((entry) => entry.id)),
    continuityLockIds: new Set(pack.catalog.continuityLocks.map((entry) => entry.id)),
  };
  const seenSubdomains = new Set<string>();
  for (const subdomain of pack.subdomains) {
    if (seenSubdomains.has(subdomain.id)) {
      throw new Error(`Duplicate scenario subdomain ${pack.id}/${subdomain.id}`);
    }
    seenSubdomains.add(subdomain.id);
    for (const [key, ids] of Object.entries(subdomain) as Array<[string, unknown]>) {
      if (!key.endsWith('Ids') || !Array.isArray(ids)) continue;
      const available = catalogIds[key as keyof typeof catalogIds];
      for (const id of ids) {
        if (!available?.has(String(id))) {
          throw new Error(`Unknown ${key} reference ${pack.id}/${subdomain.id}/${String(id)}`);
        }
      }
    }
  }
  return pack;
}

function parsePack(value: unknown): StoryboardScenarioPack {
  return assertReferences(scenarioPackSchema.parse(value));
}

export const STORYBOARD_SCENARIO_PACKS: readonly StoryboardScenarioPack[] = [
  parsePack(medicalPackJson),
  parsePack(restaurantPackJson),
  ...extendedPackJson.map(parsePack),
] as const;

const scenarioPackKey = (id: string, version: string) => `${id}@${version}`;
const packByKey = new Map(STORYBOARD_SCENARIO_PACKS.map((pack) => [
  scenarioPackKey(pack.id, pack.version), pack,
]));
const selectedIdsSchema = z.array(scenarioIdSchema).max(20).default([]).superRefine((values, context) => {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'IDs must be unique' });
  }
});

const selectionBaseSchema = z.object({
  packId: scenarioIdSchema,
  packVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  subdomainId: scenarioIdSchema,
  zoneId: scenarioIdSchema,
  roleIds: selectedIdsSchema,
  propTypeIds: selectedIdsSchema,
  actionIds: selectedIdsSchema,
  stateIds: selectedIdsSchema,
  continuityLockIds: selectedIdsSchema,
}).strict();

const selectionMappings: ReadonlyArray<{
  selection: ScenarioSubdomainKey;
  catalog: ScenarioCatalogKey;
}> = [
  { selection: 'roleIds', catalog: 'roles' },
  { selection: 'propTypeIds', catalog: 'propTypes' },
  { selection: 'actionIds', catalog: 'actions' },
  { selection: 'stateIds', catalog: 'states' },
  { selection: 'continuityLockIds', catalog: 'continuityLocks' },
];

export const storyboardScenarioSelectionSchema = selectionBaseSchema.superRefine((selection, context) => {
  const versions = STORYBOARD_SCENARIO_PACKS.filter((entry) => entry.id === selection.packId);
  if (!versions.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['packId'], message: 'Unknown scenario pack' });
    return;
  }
  const pack = packByKey.get(scenarioPackKey(selection.packId, selection.packVersion));
  if (!pack) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['packVersion'], message: 'Unsupported scenario pack version' });
    return;
  }
  const subdomain = pack.subdomains.find((entry) => entry.id === selection.subdomainId);
  if (!subdomain) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['subdomainId'], message: 'Unknown scenario subdomain' });
    return;
  }
  if (!subdomain.zoneIds.includes(selection.zoneId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['zoneId'], message: 'Zone is not available in this subdomain' });
  }
  for (const mapping of selectionMappings) {
    const allowed = new Set(subdomain[mapping.selection]);
    const known = new Set(pack.catalog[mapping.catalog].map((entry) => entry.id));
    for (const id of selection[mapping.selection]) {
      if (!known.has(id) || !allowed.has(id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [mapping.selection],
          message: `${id} is not available in this subdomain`,
        });
      }
    }
  }
});

export type StoryboardScenarioSelection = z.infer<typeof storyboardScenarioSelectionSchema>;

function entriesByIds<T extends { id: string }>(entries: T[], ids: string[]): T[] {
  const selected = new Set(ids);
  return entries.filter((entry) => selected.has(entry.id));
}

export function resolveStoryboardScenario(selection: StoryboardScenarioSelection | null | undefined) {
  if (!selection) return null;
  const parsed = storyboardScenarioSelectionSchema.parse(selection);
  const pack = packByKey.get(scenarioPackKey(parsed.packId, parsed.packVersion))!;
  const subdomain = pack.subdomains.find((entry) => entry.id === parsed.subdomainId)!;
  const zone = pack.catalog.zones.find((entry) => entry.id === parsed.zoneId)!;
  const continuityIds = parsed.continuityLockIds.length
    ? parsed.continuityLockIds : subdomain.continuityLockIds;
  return {
    pack: { id: pack.id, version: pack.version, label: pack.label, domain: pack.domain },
    subdomain: { id: subdomain.id, label: subdomain.label },
    zone,
    roles: entriesByIds(pack.catalog.roles, parsed.roleIds),
    propTypes: entriesByIds(pack.catalog.propTypes, parsed.propTypeIds),
    actions: entriesByIds(pack.catalog.actions, parsed.actionIds),
    states: entriesByIds(pack.catalog.states, parsed.stateIds),
    safetyContexts: entriesByIds(pack.catalog.safetyContexts, subdomain.safetyContextIds),
    continuityLocks: entriesByIds(pack.catalog.continuityLocks, continuityIds),
  };
}

export function storyboardScenarioCatalogView() {
  // Inspectoren tilbyr siste publiserte versjon, mens packByKey beholder eldre
  // versjoner slik at allerede lagrede shots fortsatt kan kompileres.
  const latestById = new Map<string, StoryboardScenarioPack>();
  for (const pack of STORYBOARD_SCENARIO_PACKS) {
    const previous = latestById.get(pack.id);
    if (!previous || pack.version.localeCompare(previous.version, undefined, { numeric: true }) > 0) {
      latestById.set(pack.id, pack);
    }
  }
  return [...latestById.values()].map((pack) => ({
    id: pack.id,
    version: pack.version,
    label: pack.label,
    domain: pack.domain,
    description: pack.description,
    catalog: {
      roles: pack.catalog.roles.map(({ id, label }) => ({ id, label })),
      propTypes: pack.catalog.propTypes.map(({ id, label }) => ({ id, label })),
      actions: pack.catalog.actions.map(({ id, label }) => ({ id, label })),
      states: pack.catalog.states.map(({ id, label }) => ({ id, label })),
      continuityLocks: pack.catalog.continuityLocks.map(({ id, label }) => ({ id, label })),
    },
    subdomains: pack.subdomains.map((subdomain) => ({
      id: subdomain.id,
      label: subdomain.label,
      zones: entriesByIds(pack.catalog.zones, subdomain.zoneIds)
        .map(({ id, label }) => ({ id, label })),
      roles: entriesByIds(pack.catalog.roles, subdomain.roleIds)
        .map(({ id, label }) => ({ id, label })),
      propTypes: entriesByIds(pack.catalog.propTypes, subdomain.propTypeIds)
        .map(({ id, label }) => ({ id, label })),
      actions: entriesByIds(pack.catalog.actions, subdomain.actionIds)
        .map(({ id, label }) => ({ id, label })),
      states: entriesByIds(pack.catalog.states, subdomain.stateIds)
        .map(({ id, label }) => ({ id, label })),
      continuityLocks: entriesByIds(pack.catalog.continuityLocks, subdomain.continuityLockIds)
        .map(({ id, label }) => ({ id, label })),
    })),
    families: pack.families.map((family) => ({
      id: family.id,
      label: family.label,
      primaryStyleAnchor: family.primaryStyleAnchor,
      secondaryStyleAnchor: family.secondaryStyleAnchor ?? null,
      variants: family.variants.map(({ id, label }) => ({ id, label })),
    })),
  }));
}
