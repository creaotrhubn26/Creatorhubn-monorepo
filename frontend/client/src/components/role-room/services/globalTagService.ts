import settingsService from './settingsService';

const GLOBAL_TAG_NAMESPACE = 'virtualStudio_globalTags_v1';
const MAX_GLOBAL_TAGS = 600;

const normalizeTagToken = (value: string): string =>
  value
    .toLocaleLowerCase('no-NO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9æøå\s'._-]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const dedupeSortTags = (values: string[]): string[] => {
  const byNormalized = new Map<string, string>();
  for (const raw of values) {
    if (typeof raw !== 'string') continue;
    const cleaned = raw.trim();
    if (cleaned.length < 2) continue;
    const normalized = normalizeTagToken(cleaned);
    if (!normalized) continue;
    const existing = byNormalized.get(normalized);
    if (!existing || cleaned.length > existing.length) {
      byNormalized.set(normalized, cleaned);
    }
  }
  return Array.from(byNormalized.values())
    .sort((left, right) => left.localeCompare(right, 'no-NO'))
    .slice(0, MAX_GLOBAL_TAGS);
};

const parseExplicitMentions = (text: string): string[] => {
  if (typeof text !== 'string' || text.trim().length === 0) return [];
  return Array.from(
    new Set(
      (text.match(/@([A-Za-z0-9ÆØÅæøå._-]+)/g) || [])
        .map((tag) => tag.replace(/^@/, '').trim())
        .filter((tag) => tag.length >= 2)
    )
  );
};

export const globalTagService = {
  normalizeTagToken,
  parseExplicitMentions,

  async load(options?: { projectId?: string }): Promise<string[]> {
    const stored = await settingsService.getSetting<string[]>(GLOBAL_TAG_NAMESPACE, options);
    if (!Array.isArray(stored)) return [];
    return dedupeSortTags(stored);
  },

  async save(values: string[], options?: { projectId?: string }): Promise<string[]> {
    const next = dedupeSortTags(values);
    await settingsService.setSetting(GLOBAL_TAG_NAMESPACE, next, options);
    return next;
  },

  async add(values: string[], options?: { projectId?: string }): Promise<string[]> {
    const existing = await this.load(options);
    const merged = dedupeSortTags([...existing, ...values]);
    if (merged.join('|') !== existing.join('|')) {
      await settingsService.setSetting(GLOBAL_TAG_NAMESPACE, merged, options);
    }
    return merged;
  },
};

export default globalTagService;
