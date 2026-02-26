import type { Prop } from '../models/casting';
import { castingService } from './castingService';
import settingsService, { getCurrentUserId } from './settingsService';

export type PropAssetStage = 'sketch' | 'design' | 'reference' | 'final';
export type PropAssetSource = 'storyboard' | 'starter' | 'upload' | 'external';

export interface PropDesignAsset {
  id: string;
  projectId: string;
  propId: string;
  stage: PropAssetStage;
  title: string;
  imageUrl: string;
  source: PropAssetSource;
  sourceFrameId?: string;
  sourceStoryboardId?: string;
  sourceSceneId?: string;
  notes?: string;
  tags: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PropStarterTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  promptSeed: string;
  previewImageUrl: string;
}

export interface PropDesignReadinessSummary {
  totalProps: number;
  propsWithSketch: number;
  propsWithDesign: number;
  propsWithFinal: number;
  propsNeedingConcept: number;
}

interface PropDesignLibraryState {
  assets: PropDesignAsset[];
  updatedAt: string;
}

const STORAGE_NAMESPACE = 'role-room-prop-design-library-v1';
const FALLBACK_STORAGE_PREFIX = 'role-room:prop-design-library';
export const PROP_DESIGN_LIBRARY_UPDATED_EVENT = 'role-room:prop-design-library-updated';

const STAGES: PropAssetStage[] = ['sketch', 'design', 'reference', 'final'];
const SOURCES: PropAssetSource[] = ['storyboard', 'starter', 'upload', 'external'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStage = (value: unknown): value is PropAssetStage =>
  typeof value === 'string' && STAGES.includes(value as PropAssetStage);

const isSource = (value: unknown): value is PropAssetSource =>
  typeof value === 'string' && SOURCES.includes(value as PropAssetSource);

const asString = (value: unknown): string | null => typeof value === 'string' ? value : null;

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

const parseAsset = (input: unknown): PropDesignAsset | null => {
  if (!isRecord(input)) return null;

  const id = asString(input.id);
  const projectId = asString(input.projectId);
  const propId = asString(input.propId);
  const stage = input.stage;
  const title = asString(input.title);
  const imageUrl = asString(input.imageUrl);
  const source = input.source;
  const createdAt = asString(input.createdAt);
  const updatedAt = asString(input.updatedAt);
  const versionRaw = input.version;

  if (
    !id ||
    !projectId ||
    !propId ||
    !isStage(stage) ||
    !title ||
    !imageUrl ||
    !isSource(source) ||
    !createdAt ||
    !updatedAt ||
    typeof versionRaw !== 'number'
  ) {
    return null;
  }

  return {
    id,
    projectId,
    propId,
    stage,
    title,
    imageUrl,
    source,
    sourceFrameId: asString(input.sourceFrameId) ?? undefined,
    sourceStoryboardId: asString(input.sourceStoryboardId) ?? undefined,
    sourceSceneId: asString(input.sourceSceneId) ?? undefined,
    notes: asString(input.notes) ?? undefined,
    tags: asStringArray(input.tags),
    version: versionRaw,
    createdAt,
    updatedAt,
  };
};

const parseLibraryState = (input: unknown): PropDesignLibraryState => {
  if (!isRecord(input)) {
    return { assets: [], updatedAt: new Date().toISOString() };
  }

  const rawAssets = Array.isArray(input.assets) ? input.assets : [];
  const assets = rawAssets
    .map((item) => parseAsset(item))
    .filter((asset): asset is PropDesignAsset => asset !== null);

  return {
    assets,
    updatedAt: asString(input.updatedAt) ?? new Date().toISOString(),
  };
};

const fallbackStorageKey = (projectId: string): string =>
  `${FALLBACK_STORAGE_PREFIX}:${getCurrentUserId()}:${projectId}`;

const createTemplatePreview = (name: string, accentA: string, accentB: string): string => {
  const safeName = name.replace(/[<>&"]/g, '');
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accentA}" />
      <stop offset="100%" stop-color="${accentB}" />
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)" />
  <circle cx="520" cy="80" r="120" fill="rgba(255,255,255,0.12)" />
  <rect x="42" y="224" width="556" height="94" rx="14" fill="rgba(8,15,30,0.52)" />
  <text x="68" y="276" fill="#f8fafc" font-family="Segoe UI, Arial, sans-serif" font-size="36" font-weight="700">${safeName}</text>
  <text x="68" y="304" fill="rgba(248,250,252,0.88)" font-family="Segoe UI, Arial, sans-serif" font-size="17">Starter asset for sketching, iteration and final detailing</text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const STARTER_TEMPLATES: PropStarterTemplate[] = [
  {
    id: 'starter-sword',
    name: 'Ceremonial Sword',
    category: 'equipment',
    description: 'Classic hero sword silhouette with ornate guard and leather grip.',
    tags: ['weapon', 'blade', 'hero-prop', 'metal'],
    promptSeed: 'ceremonial sword concept, cinematic hero prop, steel and leather',
    previewImageUrl: createTemplatePreview('Ceremonial Sword', '#312e81', '#7c3aed'),
  },
  {
    id: 'starter-shield',
    name: 'Battle Shield',
    category: 'equipment',
    description: 'Round defensive shield with worn paint and embossed center.',
    tags: ['shield', 'armor', 'medieval', 'wood'],
    promptSeed: 'battle shield concept, weathered painted wood, embossed center',
    previewImageUrl: createTemplatePreview('Battle Shield', '#0f766e', '#0e7490'),
  },
  {
    id: 'starter-lantern',
    name: 'Expedition Lantern',
    category: 'decoration',
    description: 'Portable lantern for cave, forest and night sequence setups.',
    tags: ['lantern', 'light', 'practical', 'set-dressing'],
    promptSeed: 'expedition lantern prop design, practical light source, rugged metal frame',
    previewImageUrl: createTemplatePreview('Expedition Lantern', '#92400e', '#d97706'),
  },
  {
    id: 'starter-helmet',
    name: 'Guardian Helmet',
    category: 'costume',
    description: 'Protective helmet with modular plate details and visor choices.',
    tags: ['helmet', 'costume', 'armor', 'headgear'],
    promptSeed: 'guardian helmet concept, modular armor, matte metal and leather',
    previewImageUrl: createTemplatePreview('Guardian Helmet', '#1e293b', '#475569'),
  },
  {
    id: 'starter-map',
    name: 'Treasure Map',
    category: 'decoration',
    description: 'Folded parchment map with route markings and annotation symbols.',
    tags: ['map', 'paper', 'artifact', 'set-prop'],
    promptSeed: 'hand-drawn treasure map prop, aged paper texture, route markings',
    previewImageUrl: createTemplatePreview('Treasure Map', '#78350f', '#b45309'),
  },
  {
    id: 'starter-potion',
    name: 'Alchemy Vial',
    category: 'decoration',
    description: 'Glass vial with glowing liquid variations for close-up inserts.',
    tags: ['vial', 'potion', 'glass', 'fantasy'],
    promptSeed: 'alchemy vial prop concept, colored liquid, cinematic glass highlights',
    previewImageUrl: createTemplatePreview('Alchemy Vial', '#14532d', '#16a34a'),
  },
];

const loadState = async (projectId: string): Promise<PropDesignLibraryState> => {
  const userId = getCurrentUserId();
  const fallbackKey = fallbackStorageKey(projectId);

  try {
    const stored = await settingsService.getSetting<unknown>(STORAGE_NAMESPACE, { userId, projectId });
    if (stored) {
      const parsed = parseLibraryState(stored);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(fallbackKey, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch {
    // noop: fallback to local storage
  }

  try {
    if (typeof window === 'undefined') {
      return { assets: [], updatedAt: new Date().toISOString() };
    }
    const fallbackRaw = window.localStorage.getItem(fallbackKey);
    if (!fallbackRaw) return { assets: [], updatedAt: new Date().toISOString() };
    const fallbackParsed: unknown = JSON.parse(fallbackRaw);
    return parseLibraryState(fallbackParsed);
  } catch {
    return { assets: [], updatedAt: new Date().toISOString() };
  }
};

const saveState = async (projectId: string, state: PropDesignLibraryState): Promise<void> => {
  const userId = getCurrentUserId();
  const fallbackKey = fallbackStorageKey(projectId);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(fallbackKey, JSON.stringify(state));
  }
  try {
    await settingsService.setSetting(STORAGE_NAMESPACE, state, { userId, projectId });
  } catch {
    // local fallback already persisted
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROP_DESIGN_LIBRARY_UPDATED_EVENT, { detail: { projectId } }));
  }
};

export const propDesignLibraryService = {
  getStarterTemplates(): PropStarterTemplate[] {
    return STARTER_TEMPLATES.map((template) => ({ ...template }));
  },

  async getAssets(projectId: string): Promise<PropDesignAsset[]> {
    const state = await loadState(projectId);
    return [...state.assets].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  },

  async getAssetsByProp(projectId: string): Promise<Record<string, PropDesignAsset[]>> {
    const assets = await this.getAssets(projectId);
    return assets.reduce<Record<string, PropDesignAsset[]>>((acc, asset) => {
      if (!acc[asset.propId]) {
        acc[asset.propId] = [];
      }
      acc[asset.propId].push(asset);
      return acc;
    }, {});
  },

  async getAssetsForProp(projectId: string, propId: string): Promise<PropDesignAsset[]> {
    const assets = await this.getAssets(projectId);
    return assets.filter((asset) => asset.propId === propId);
  },

  async addAsset(
    projectId: string,
    payload: {
      propId: string;
      stage: PropAssetStage;
      title: string;
      imageUrl: string;
      source: PropAssetSource;
      sourceFrameId?: string;
      sourceStoryboardId?: string;
      sourceSceneId?: string;
      notes?: string;
      tags?: string[];
    }
  ): Promise<PropDesignAsset> {
    const state = await loadState(projectId);
    const now = new Date().toISOString();
    const priorVersions = state.assets
      .filter((asset) => asset.propId === payload.propId && asset.stage === payload.stage)
      .map((asset) => asset.version);
    const version = priorVersions.length > 0 ? Math.max(...priorVersions) + 1 : 1;

    const asset: PropDesignAsset = {
      id: `prop-asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      propId: payload.propId,
      stage: payload.stage,
      title: payload.title,
      imageUrl: payload.imageUrl,
      source: payload.source,
      sourceFrameId: payload.sourceFrameId,
      sourceStoryboardId: payload.sourceStoryboardId,
      sourceSceneId: payload.sourceSceneId,
      notes: payload.notes,
      tags: payload.tags ?? [],
      version,
      createdAt: now,
      updatedAt: now,
    };

    const nextState: PropDesignLibraryState = {
      assets: [asset, ...state.assets],
      updatedAt: now,
    };

    await saveState(projectId, nextState);
    return asset;
  },

  async removeAsset(projectId: string, assetId: string): Promise<void> {
    const state = await loadState(projectId);
    const nextState: PropDesignLibraryState = {
      assets: state.assets.filter((asset) => asset.id !== assetId),
      updatedAt: new Date().toISOString(),
    };
    await saveState(projectId, nextState);
  },

  async applyAssetAsPropPreview(projectId: string, propId: string, assetId: string): Promise<void> {
    const [assets, props] = await Promise.all([
      this.getAssets(projectId),
      castingService.getProps(projectId),
    ]);
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) throw new Error('Asset not found');
    const prop = props.find((item) => item.id === propId);
    if (!prop) throw new Error('Prop not found');

    const existingImages = Array.isArray(prop.images) ? prop.images.filter((image) => image !== asset.imageUrl) : [];
    const updatedProp: Prop = {
      ...prop,
      images: [asset.imageUrl, ...existingImages],
      updatedAt: new Date().toISOString(),
    };
    await castingService.saveProp(projectId, updatedProp);
  },

  async createPropFromStarter(
    projectId: string,
    starter: PropStarterTemplate,
    options?: {
      sceneId?: string | null;
      name?: string;
    }
  ): Promise<Prop> {
    const now = new Date().toISOString();
    const prop: Prop = {
      id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: options?.name?.trim() || starter.name,
      category: starter.category,
      description: starter.description,
      images: [starter.previewImageUrl],
      availability: {},
      assignedScenes: options?.sceneId ? [options.sceneId] : [],
      quantity: 1,
      location: '',
      notes: `Starter template: ${starter.name}`,
      createdAt: now,
      updatedAt: now,
    };

    await castingService.saveProp(projectId, prop);
    return prop;
  },

  async getReadinessSummary(projectId: string, props?: Prop[]): Promise<PropDesignReadinessSummary> {
    const [propList, assets] = await Promise.all([
      props ? Promise.resolve(props) : castingService.getProps(projectId),
      this.getAssets(projectId),
    ]);

    const byProp = assets.reduce<Record<string, Set<PropAssetStage>>>((acc, asset) => {
      if (!acc[asset.propId]) {
        acc[asset.propId] = new Set<PropAssetStage>();
      }
      acc[asset.propId].add(asset.stage);
      return acc;
    }, {});

    let propsWithSketch = 0;
    let propsWithDesign = 0;
    let propsWithFinal = 0;

    propList.forEach((prop) => {
      const stages = byProp[prop.id];
      if (!stages) return;
      if (stages.has('sketch') || stages.has('design') || stages.has('reference') || stages.has('final')) {
        propsWithSketch += 1;
      }
      if (stages.has('design') || stages.has('final')) {
        propsWithDesign += 1;
      }
      if (stages.has('final')) {
        propsWithFinal += 1;
      }
    });

    const totalProps = propList.length;

    return {
      totalProps,
      propsWithSketch,
      propsWithDesign,
      propsWithFinal,
      propsNeedingConcept: Math.max(0, totalProps - propsWithSketch),
    };
  },
};

export default propDesignLibraryService;
