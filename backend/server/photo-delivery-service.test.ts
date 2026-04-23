import { describe, expect, it, vi } from 'vitest';
import {
  createClientGalleryFromBlobs,
  type DeliveryInput,
} from './photo-delivery-service.js';

/**
 * Lightweight drizzle stub — mirrors the shape used in
 * `capture-showcase-bridge.test.ts`. We only exercise the three query
 * shapes the service actually performs:
 *   select().from().where().limit()   — existingGalleryId lookup
 *   insert().values().returning()     — new gallery row
 *   insert().values()                 — image rows
 */
function makeDbStub(opts: {
  existingGalleries?: Record<string, unknown>[];
  insertGalleryReturns?: { id: string }[];
  failOnImageInsert?: boolean;
  failOnGalleryInsert?: boolean;
} = {}) {
  const inserts: Array<{ table: string; values: unknown }> = [];

  const db = {
    select: () => ({
      from: (table: unknown) => {
        const tableName = tableNameOf(table);
        return {
          where: () => ({
            limit: () => {
              if (tableName.includes('photographer_client_galleries')) {
                return Promise.resolve(opts.existingGalleries ?? []);
              }
              return Promise.resolve([]);
            },
          }),
        };
      },
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        const tableName = tableNameOf(table);
        inserts.push({ table: tableName, values });
        const isGallery = tableName.includes('photographer_client_galleries');
        const isImage = tableName.includes('client_gallery_images');
        // The service does `.insert().values().returning()` for
        // galleries and `.insert().values()` (awaited directly) for
        // images. Return a shape that supports both shapes; failures
        // flow through the same chain so the rejection lands on the
        // `await` the service performs, not the stub's call site.
        return {
          returning: () => {
            if (opts.failOnGalleryInsert && isGallery) {
              return Promise.reject(new Error('gallery insert blew up'));
            }
            return Promise.resolve(opts.insertGalleryReturns ?? [{ id: 'gal-1' }]);
          },
          then: (
            resolve: (v: unknown) => void,
            reject: (e: unknown) => void,
          ) => {
            if (opts.failOnImageInsert && isImage) {
              reject(new Error('image insert blew up'));
              return;
            }
            resolve(undefined);
          },
        };
      },
    }),
  };
  return { db, inserts };
}

function tableNameOf(table: unknown): string {
  const t = table as Record<string | symbol, unknown>;
  const byDrizzle = t?.[Symbol.for('drizzle:Name')];
  const byName = t?.name;
  return String(byDrizzle ?? byName ?? '');
}

function imageFrom(filename: string, bytes = Buffer.from([1, 2, 3])) {
  return {
    title: filename.replace(/\.[^.]+$/, ''),
    filename,
    mimeType: 'image/jpeg',
    bytes,
  };
}

function baseInput(db: unknown): Omit<DeliveryInput, 'images'> {
  return {
    db: db as DeliveryInput['db'],
    photographerId: 'phot-1',
    clientName: 'Holy Crust',
    clientEmail: 'bakeri@holycrust.no',
    projectTitle: 'Uke 18 leveranse',
    r2Config: {
      enabled: true,
      endpoint: 'https://r2.example',
      bucket: 'test',
      accessKeyId: 'x',
      secretAccessKey: 'y',
      prefix: 'ch-',
    },
    tokenFactory: () => 'TOKEN-abc',
    upload: vi.fn(async () => {}),
    sign: vi.fn(async (key: string) => `https://signed.example/${key}`),
    publicHostOverride: 'https://app.creatorhubn.com',
  };
}

describe('createClientGalleryFromBlobs', () => {
  it('returns no_images for an empty batch without touching db or R2', async () => {
    const { db } = makeDbStub();
    const input = {
      ...baseInput(db),
      images: [],
      upload: vi.fn(async () => {}),
    };
    const result = await createClientGalleryFromBlobs(input as DeliveryInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('no_images');
    expect(input.upload).not.toHaveBeenCalled();
  });

  it('creates gallery + uploads + signs + inserts images on the happy path', async () => {
    const { db, inserts } = makeDbStub();
    const upload = vi.fn(async () => {});
    const sign = vi.fn(async (key: string) => `signed://${key}`);
    const result = await createClientGalleryFromBlobs({
      ...baseInput(db),
      upload,
      sign,
      images: [imageFrom('a.jpg'), imageFrom('b.jpg')],
    } as DeliveryInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.galleryId).toBe('gal-1');
    expect(result.accessToken).toBe('TOKEN-abc');
    expect(result.shareUrl).toBe('https://app.creatorhubn.com/client/gallery/TOKEN-abc');
    expect(result.uploadedImageCount).toBe(2);
    expect(result.reusedExisting).toBe(false);

    expect(upload).toHaveBeenCalledTimes(2);
    expect(sign).toHaveBeenCalledTimes(2);
    // Image rows inserted with signed URL as both thumbnail + full.
    const imageInserts = inserts.filter((i) => i.table.includes('client_gallery_images'));
    expect(imageInserts).toHaveLength(2);
    for (const ins of imageInserts) {
      const v = ins.values as { thumbnailUrl: string; fullSizeUrl: string };
      expect(v.thumbnailUrl).toMatch(/^signed:/);
      expect(v.thumbnailUrl).toBe(v.fullSizeUrl);
    }
  });

  it('lower-cases + trims client email on the gallery row', async () => {
    const { db, inserts } = makeDbStub();
    await createClientGalleryFromBlobs({
      ...baseInput(db),
      clientEmail: '  Bakeri@HolyCrust.NO  ',
      images: [imageFrom('a.jpg')],
    } as DeliveryInput);
    const galleryInsert = inserts.find((i) =>
      i.table.includes('photographer_client_galleries'),
    );
    expect(galleryInsert).toBeDefined();
    const v = galleryInsert!.values as { clientEmail: string };
    expect(v.clientEmail).toBe('bakeri@holycrust.no');
  });

  it('assigns a sortOrder that increments per image', async () => {
    const { db, inserts } = makeDbStub();
    await createClientGalleryFromBlobs({
      ...baseInput(db),
      images: [imageFrom('a.jpg'), imageFrom('b.jpg'), imageFrom('c.jpg')],
    } as DeliveryInput);
    const sortOrders = inserts
      .filter((i) => i.table.includes('client_gallery_images'))
      .map((i) => (i.values as { sortOrder: number }).sortOrder);
    expect(sortOrders).toEqual([0, 1, 2]);
  });

  it('stamps source=enhancer_delivery in image_metadata', async () => {
    const { db, inserts } = makeDbStub();
    await createClientGalleryFromBlobs({
      ...baseInput(db),
      images: [imageFrom('a.jpg')],
    } as DeliveryInput);
    const row = inserts.find((i) => i.table.includes('client_gallery_images'));
    const md = (row!.values as { imageMetadata: Record<string, unknown> }).imageMetadata;
    expect(md.source).toBe('enhancer_delivery');
    expect(md.mimeType).toBe('image/jpeg');
  });

  it('returns upload_failed with detail when the uploader throws', async () => {
    const { db } = makeDbStub();
    const upload = vi.fn(async () => {
      throw new Error('403 Forbidden');
    });
    const result = await createClientGalleryFromBlobs({
      ...baseInput(db),
      upload,
      images: [imageFrom('a.jpg')],
    } as DeliveryInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('upload_failed');
    expect(result.detail).toMatch(/403 Forbidden/);
  });

  it('returns sign_failed when the signer returns null', async () => {
    const { db } = makeDbStub();
    const result = await createClientGalleryFromBlobs({
      ...baseInput(db),
      sign: vi.fn(async () => null),
      images: [imageFrom('a.jpg')],
    } as DeliveryInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('sign_failed');
  });

  it('returns persist_failed when the gallery insert rejects', async () => {
    const { db } = makeDbStub({ failOnGalleryInsert: true });
    const result = await createClientGalleryFromBlobs({
      ...baseInput(db),
      images: [imageFrom('a.jpg')],
    } as DeliveryInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('persist_failed');
  });

  it('returns persist_failed when an image insert rejects', async () => {
    const { db } = makeDbStub({ failOnImageInsert: true });
    const result = await createClientGalleryFromBlobs({
      ...baseInput(db),
      images: [imageFrom('a.jpg')],
    } as DeliveryInput);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('persist_failed');
  });

  it('skips the R2 PutObject path when a custom uploader is injected', async () => {
    // This is the core dependency-injection assurance — tests never hit
    // the real R2 client even when `r2Config` is otherwise valid.
    const { db } = makeDbStub();
    const customUpload = vi.fn(async () => {});
    await createClientGalleryFromBlobs({
      ...baseInput(db),
      upload: customUpload,
      images: [imageFrom('a.jpg')],
    } as DeliveryInput);
    expect(customUpload).toHaveBeenCalledTimes(1);
    // First positional arg is the key — must carry the configured prefix.
    expect(customUpload.mock.calls[0][0]).toMatch(/^ch-deliveries\/phot-1\/gal-1\//);
  });

  it('builds R2 keys under deliveries/<photographer>/<gallery>/', async () => {
    const { db } = makeDbStub();
    const upload = vi.fn(async () => {});
    await createClientGalleryFromBlobs({
      ...baseInput(db),
      upload,
      images: [imageFrom('rolls.jpg')],
    } as DeliveryInput);
    const key = upload.mock.calls[0][0] as string;
    expect(key).toMatch(/^ch-deliveries\/phot-1\/gal-1\/[a-f0-9]{8}-rolls\.jpg$/);
  });

  it('sanitises filenames that contain path separators or control chars', async () => {
    const { db } = makeDbStub();
    const upload = vi.fn(async () => {});
    await createClientGalleryFromBlobs({
      ...baseInput(db),
      upload,
      images: [
        {
          title: 'weird',
          filename: '../../etc/passwd',
          mimeType: 'image/jpeg',
          bytes: Buffer.from([0]),
        },
      ],
    } as DeliveryInput);
    const key = upload.mock.calls[0][0] as string;
    expect(key).not.toContain('..');
    expect(key).toMatch(/passwd$/);
  });
});
