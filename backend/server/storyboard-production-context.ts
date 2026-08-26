import type { Pool } from 'pg';
import type { StoryboardShotContext } from './storyboard-ai-context.js';

type ProductionReference = StoryboardShotContext['production']['characters'][number];
type JsonRecord = Record<string, unknown>;

function clean(value: unknown, limit: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, limit)
    : '';
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function strings(value: unknown): string[] {
  return array(value).flatMap((item) => {
    if (typeof item === 'string') return [item];
    const itemRecord = record(item);
    const candidate = itemRecord.id ?? itemRecord.name ?? itemRecord.value;
    return typeof candidate === 'string' ? [candidate] : [];
  });
}

function normalizeKey(value: unknown): string {
  return clean(value, 500)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeImageReference(value: unknown): string | null {
  const source = typeof value === 'string'
    ? value
    : (() => {
      const item = record(value);
      return item.fileId ?? item.file_id ?? item.id
        ?? item.imageUrl ?? item.image_url ?? item.url ?? item.downloadUrl;
    })();
  const normalized = clean(source, 500);
  if (!normalized || normalized.startsWith('data:')) return null;
  return normalized;
}

function imageReferences(...values: unknown[]): string[] {
  const references = values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map(normalizeImageReference)
    .filter((value): value is string => Boolean(value));
  return [...new Set(references)].slice(0, 12);
}

function reference(input: {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  images?: unknown[];
  locked?: boolean;
}): ProductionReference | null {
  const name = clean(input.name, 300);
  const description = clean(input.description, 1_200);
  if (!name && !description) return null;
  return {
    id: clean(input.id, 200),
    name,
    description,
    referenceImageIds: imageReferences(...(input.images ?? [])),
    locked: input.locked !== false,
  };
}

function mergeReferences(
  authoritative: Array<ProductionReference | null>,
  submitted: ProductionReference[],
): ProductionReference[] {
  const merged = new Map<string, ProductionReference>();
  for (const candidate of [...submitted, ...authoritative.filter(
    (value): value is ProductionReference => Boolean(value),
  )]) {
    const key = normalizeKey(candidate.id) || normalizeKey(candidate.name);
    if (!key) continue;
    const previous = merged.get(key);
    merged.set(key, previous ? {
      ...previous,
      ...candidate,
      description: candidate.description || previous.description,
      referenceImageIds: [...new Set([
        ...previous.referenceImageIds,
        ...candidate.referenceImageIds,
      ])].slice(0, 12),
      locked: previous.locked || candidate.locked,
    } : candidate);
  }
  return [...merged.values()];
}

function rowMatchesScene(row: JsonRecord, sceneId: string, sceneNumber: number | null): boolean {
  const assigned = strings(
    row.assignedScenes ?? row.assigned_scenes ?? row.sceneIds ?? row.scene_ids,
  );
  if (assigned.some((value) => value === sceneId || normalizeKey(value) === normalizeKey(sceneId))) {
    return true;
  }
  const description = [
    clean(row.description, 2_000),
    clean(row.notes, 2_000),
    clean(row.data && record(row.data).description, 2_000),
  ].join(' ');
  return sceneNumber != null
    && new RegExp(`\\bscene\\s*${sceneNumber}\\b`, 'i').test(description);
}

function namedDescription(item: JsonRecord): string {
  return [
    clean(item.description, 1_000),
    clean(item.note, 500),
    clean(item.access_notes ?? item.accessNotes, 500),
    clean(item.address, 500),
  ].filter(Boolean).join(' · ');
}

export async function hydrateStoryboardProductionContext(
  pool: Pool,
  input: {
    projectId: string;
    sceneId: string;
    context: StoryboardShotContext;
  },
): Promise<StoryboardShotContext> {
  const [sceneResult, rolesResult, candidatesResult, locationsResult, propsResult] =
    await Promise.all([
      pool.query(
        `SELECT id, scene_number, title, description, setting, time_of_day,
                int_ext, characters, production_breakdown
           FROM casting_scenes
          WHERE id = $1 AND project_id = $2
          LIMIT 1`,
        [input.sceneId, input.projectId],
      ),
      pool.query(
        `SELECT id, name, description, assigned_candidate_id, requirements
           FROM casting_roles
          WHERE project_id = $1
          ORDER BY created_at
          LIMIT 500`,
        [input.projectId],
      ),
      // Ikke hent e-post/telefon eller annen talent-PII til Prompt Engine.
      pool.query(
        `SELECT id, name, photos, assigned_roles, metadata
           FROM casting_candidates
          WHERE project_id = $1
          ORDER BY created_at
          LIMIT 1000`,
        [input.projectId],
      ),
      pool.query(
        `SELECT id, name, address, type, access_notes, photos
           FROM casting_locations
          WHERE project_id = $1
          ORDER BY name
          LIMIT 300`,
        [input.projectId],
      ),
      pool.query(
        `SELECT id, name, category, description, images, availability
           FROM casting_props
          WHERE project_id = $1
          ORDER BY name
          LIMIT 500`,
        [input.projectId],
      ),
    ]);

  const sceneRow = record(sceneResult.rows[0]);
  const breakdown = record(sceneRow.production_breakdown ?? sceneRow.productionBreakdown);
  const sceneCharacters = strings(sceneRow.characters);
  const submittedCharacterKeys = new Set(input.context.scene.characters.map(normalizeKey));
  const sceneCharacterKeys = new Set([...sceneCharacters, ...input.context.scene.characters].map(normalizeKey));
  const candidates = candidatesResult.rows.map(record);

  const characterReferences = rolesResult.rows.map(record).flatMap((role) => {
    const roleId = clean(role.id, 200);
    const roleName = clean(role.name, 300);
    const matches = sceneCharacterKeys.has(normalizeKey(roleId))
      || sceneCharacterKeys.has(normalizeKey(roleName))
      || submittedCharacterKeys.has(normalizeKey(roleName));
    if (!matches) return [];
    const assignedCandidateId = clean(
      role.assigned_candidate_id ?? role.assignedCandidateId,
      200,
    );
    const candidate = candidates.find((item) =>
      assignedCandidateId && clean(item.id, 200) === assignedCandidateId)
      ?? candidates.find((item) =>
        strings(item.assigned_roles ?? item.assignedRoles).some((id) => id === roleId));
    const candidateName = clean(candidate?.name, 300);
    const description = [
      clean(role.description, 1_000),
      candidateName ? `Cast: ${candidateName}` : '',
    ].filter(Boolean).join(' · ');
    return [reference({
      id: roleId,
      name: roleName,
      description,
      images: [
        role.reference_image_url,
        role.referenceImageUrl,
        role.requirements && record(role.requirements).reference_image_url,
        role.requirements && record(role.requirements).referenceImageUrl,
        candidate?.photos,
        candidate?.metadata && record(candidate.metadata).referenceImages,
      ],
    })];
  });

  const costumeBreakdown = array(breakdown.costumes).map(record);
  const costumeProps = propsResult.rows.map(record).filter((prop) => {
    const category = normalizeKey(prop.category);
    return (category.includes('costume') || category.includes('wardrobe'))
      && rowMatchesScene(prop, input.sceneId, input.context.scene.number ?? null);
  });
  const wardrobeReferences = [
    ...costumeBreakdown.map((costume, index) => reference({
      id: costume.id ?? `costume-${input.sceneId}-${index}`,
      name: costume.characterName ?? costume.character_name ?? 'Costume',
      description: namedDescription(costume),
      images: [costume.images, costume.referenceImageIds, costume.reference_image_ids],
    })),
    ...costumeProps.map((prop) => reference({
      id: prop.id,
      name: prop.name,
      description: namedDescription(prop),
      images: [prop.images],
    })),
  ];

  const breakdownLocations = array(breakdown.locations).map(record);
  const locationKeys = new Set([
    normalizeKey(sceneRow.setting),
    normalizeKey(input.context.scene.location),
    ...breakdownLocations.flatMap((location) => [
      normalizeKey(location.id),
      normalizeKey(location.name),
    ]),
  ].filter(Boolean));
  const matchedLocations = locationsResult.rows.map(record).filter((location) => {
    const idKey = normalizeKey(location.id);
    const nameKey = normalizeKey(location.name);
    return locationKeys.has(idKey)
      || locationKeys.has(nameKey)
      || [...locationKeys].some((key) =>
        key.length >= 5 && (nameKey.includes(key) || key.includes(nameKey)));
  });
  const locationReferences = [
    ...breakdownLocations.map((location) => {
      const catalog = locationsResult.rows.map(record).find((candidate) =>
        normalizeKey(candidate.id) === normalizeKey(location.id)
        || normalizeKey(candidate.name) === normalizeKey(location.name));
      return reference({
        id: location.id ?? catalog?.id,
        name: location.name ?? catalog?.name,
        description: [namedDescription(location), catalog ? namedDescription(catalog) : '']
          .filter(Boolean).join(' · '),
        images: [
          location.photos,
          location.images,
          catalog?.photos,
        ],
      });
    }),
    ...matchedLocations.map((location) => reference({
      id: location.id,
      name: location.name,
      description: namedDescription(location),
      images: [location.photos],
    })),
  ];

  const breakdownProps = array(breakdown.props).map(record);
  const breakdownPropKeys = new Set(breakdownProps.flatMap((prop) => [
    normalizeKey(prop.id),
    normalizeKey(prop.name),
  ]).filter(Boolean));
  const matchedProps = propsResult.rows.map(record).filter((prop) =>
    breakdownPropKeys.has(normalizeKey(prop.id))
    || breakdownPropKeys.has(normalizeKey(prop.name))
    || rowMatchesScene(prop, input.sceneId, input.context.scene.number ?? null));
  const propReferences = [
    ...breakdownProps.map((prop) => {
      const catalog = propsResult.rows.map(record).find((candidate) =>
        normalizeKey(candidate.id) === normalizeKey(prop.id)
        || normalizeKey(candidate.name) === normalizeKey(prop.name));
      return reference({
        id: prop.id ?? catalog?.id,
        name: prop.name ?? catalog?.name,
        description: [namedDescription(prop), catalog ? namedDescription(catalog) : '']
          .filter(Boolean).join(' · '),
        images: [
          prop.images,
          catalog?.images,
        ],
      });
    }),
    ...matchedProps.map((prop) => reference({
      id: prop.id,
      name: prop.name,
      description: namedDescription(prop),
      images: [prop.images],
    })),
  ];

  const authoritativeCharacterNames = characterReferences
    .filter((value): value is ProductionReference => Boolean(value))
    .map((value) => value.name)
    .filter(Boolean);

  return {
    ...input.context,
    production: {
      characters: mergeReferences(characterReferences, input.context.production.characters),
      wardrobe: mergeReferences(wardrobeReferences, input.context.production.wardrobe),
      locations: mergeReferences(locationReferences, input.context.production.locations),
      props: mergeReferences(propReferences, input.context.production.props),
    },
    scene: {
      ...input.context.scene,
      id: clean(sceneRow.id, 200) || input.context.scene.id,
      number: typeof sceneRow.scene_number === 'number'
        ? sceneRow.scene_number : input.context.scene.number,
      heading: clean(sceneRow.title, 500) || input.context.scene.heading,
      intExt: clean(sceneRow.int_ext, 40) || input.context.scene.intExt,
      location: clean(sceneRow.setting, 500) || input.context.scene.location,
      timeOfDay: clean(sceneRow.time_of_day, 100) || input.context.scene.timeOfDay,
      action: clean(sceneRow.description, 4_000) || input.context.scene.action,
      characters: authoritativeCharacterNames.length
        ? authoritativeCharacterNames : input.context.scene.characters,
    },
  };
}
