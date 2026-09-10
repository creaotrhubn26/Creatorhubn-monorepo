import {
  getLeadgridObjectStorage,
  type LeadgridStorageProvider,
} from "./leadgrid-s3-storage-service.js";

type PrizeImageRow = Record<string, unknown> & {
  image_b2_key?: unknown;
  image_url?: unknown;
  image_storage_provider?: LeadgridStorageProvider | "external" | null;
};

/** Replace persisted AWS object keys with a fresh, short-lived display URL. */
export async function hydrateLeadgridPrizeImageUrls<T extends PrizeImageRow>(
  rows: readonly T[],
): Promise<T[]> {
  const storage = getLeadgridObjectStorage();
  return Promise.all(rows.map(async (row) => {
    if (
      row.image_storage_provider !== "aws_s3" ||
      typeof row.image_b2_key !== "string" ||
      !row.image_b2_key
    ) {
      return row;
    }
    if (!storage) return { ...row, image_url: null };
    try {
      const imageUrl = await storage.createDownloadUrl(row.image_b2_key, 600);
      return { ...row, image_url: imageUrl };
    } catch {
      return { ...row, image_url: null };
    }
  }));
}
