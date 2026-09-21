import { describe, expect, it } from 'vitest';
import {
  signCapturePreviewToken,
  verifyCapturePreviewToken,
} from './capture-preview-token.js';

const runtime = { tokenSigningSecret: 'capture-preview-test-secret' };
const assetId = '00000000-0000-4000-8000-000000000001';

describe('capture preview capability tokens', () => {
  it('binds a token to exactly one asset', () => {
    const token = signCapturePreviewToken(assetId, runtime);
    expect(verifyCapturePreviewToken(assetId, token, runtime)).toBe(true);
    expect(
      verifyCapturePreviewToken(
        '00000000-0000-4000-8000-000000000002',
        token,
        runtime,
      ),
    ).toBe(false);
  });

  it('rejects malformed tokens and a different signing secret', () => {
    const token = signCapturePreviewToken(assetId, runtime);
    expect(verifyCapturePreviewToken(assetId, `${token.slice(0, -1)}!`, runtime)).toBe(false);
    expect(
      verifyCapturePreviewToken(assetId, token, { tokenSigningSecret: 'other-secret' }),
    ).toBe(false);
  });

  it('refuses malformed asset identifiers', () => {
    expect(() => signCapturePreviewToken('../asset', runtime)).toThrow(
      'capture_preview_asset_id_invalid',
    );
    expect(verifyCapturePreviewToken('../asset', 'a'.repeat(43), runtime)).toBe(false);
  });
});
