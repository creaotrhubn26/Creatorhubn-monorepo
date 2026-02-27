/* eslint-disable no-console */

const baseUrl = process.env.STORYBOARD_TEST_BASE_URL || 'http://127.0.0.1:5000';
const expectR2Storage = process.env.STORYBOARD_TEST_EXPECT_R2 === '1';

const requestJson = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const raw = await response.text();
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = raw;
  }
  return { response, json };
};

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  console.log(`Running storyboard lifecycle checks against ${baseUrl}`);

  const adminBefore = await requestJson('/api/storyboard-packs/admin');
  assert(adminBefore.response.ok, 'GET /api/storyboard-packs/admin failed');

  const draftPayload = {
    manifest: {
      packs: [
        {
          id: 'test-pack',
          name: 'Test Pack',
          description: 'Lifecycle test pack',
          coverImageUrl: 'https://example.com/test.png',
          baseBrushSettings: { type: 'pen', size: 2, opacity: 1, color: '#fff' },
          slots: [
            {
              id: 'slot-a',
              name: 'Slot A',
              description: 'A test slot',
              imageUrl: 'https://example.com/slot-a.png',
              patch: {
                brushSettings: { size: 3 },
                cinematography: { shotType: 'close-up', lens: '35mm' },
              },
            },
          ],
        },
      ],
      version: 1,
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    },
  };

  const saveDraft = await requestJson('/api/storyboard-packs/admin/draft', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draftPayload),
  });
  assert(saveDraft.response.ok, 'PUT /api/storyboard-packs/admin/draft failed');

  const adminAfterDraft = await requestJson('/api/storyboard-packs/admin');
  assert(adminAfterDraft.response.ok, 'GET /api/storyboard-packs/admin after draft failed');
  const draftPackName = (adminAfterDraft.json as any)?.draft?.packs?.[0]?.name;
  assert(draftPackName === 'Test Pack', 'Draft save/load mismatch');

  const publish = await requestJson('/api/storyboard-packs/admin/publish', { method: 'POST' });
  assert(publish.response.ok, 'POST /api/storyboard-packs/admin/publish failed');

  const published = await requestJson('/api/storyboard-packs');
  assert(published.response.ok, 'GET /api/storyboard-packs failed');
  const publishedPackName = (published.json as any)?.packs?.[0]?.name;
  assert(publishedPackName === 'Test Pack', 'Publish promotion mismatch');

  const invalidUpload = await requestJson('/api/storyboard-packs/admin/upload-slot-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packId: 'test-pack',
      slotId: 'slot-a',
      fileName: 'bad.txt',
      imageBase64: Buffer.from('hello').toString('base64'),
    }),
  });
  assert(invalidUpload.response.status === 400, 'Expected invalid upload to return 400');

  const onePixelPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z0ioAAAAASUVORK5CYII=';
  const validUpload = await requestJson('/api/storyboard-packs/admin/upload-slot-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packId: 'test-pack',
      slotId: 'slot-a',
      fileName: 'slot-a.png',
      imageBase64: onePixelPngBase64,
    }),
  });
  assert(validUpload.response.ok, 'Expected valid upload to succeed');
  const imageUrl = (validUpload.json as any)?.imageUrl as string | undefined;
  assert(Boolean(imageUrl), 'Upload did not return imageUrl');
  if (expectR2Storage) {
    assert(imageUrl?.includes('storage=r2'), 'Expected R2-backed upload URL when STORYBOARD_TEST_EXPECT_R2=1');
  }

  const imageFetch = await fetch(`${baseUrl}${imageUrl}`);
  assert(imageFetch.ok, 'Durable image retrieval failed');

  console.log('Storyboard lifecycle checks: OK');
};

run().catch((error) => {
  console.error('Storyboard lifecycle checks failed:', error);
  process.exit(1);
});
