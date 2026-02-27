export const DEFAULT_STORYBOARD_PACK_R2_PREFIX = 'storyboardassets/packs';

export const normalizeStoryboardPackR2Prefix = (prefix?: string): string =>
  (prefix || DEFAULT_STORYBOARD_PACK_R2_PREFIX).replace(/^\/+|\/+$/g, '');

export const buildStoryboardPackR2ObjectKey = (params: {
  prefix?: string;
  packId: string;
  slotId: string;
  fileName: string;
}): string => {
  const normalizedPrefix = normalizeStoryboardPackR2Prefix(params.prefix);
  return `${normalizedPrefix}/${params.packId}/${params.slotId}/${params.fileName}`;
};
