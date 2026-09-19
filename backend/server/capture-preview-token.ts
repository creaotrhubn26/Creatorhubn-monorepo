import crypto from 'node:crypto';

const PREVIEW_TOKEN_DOMAIN = 'creatorhub:capture-preview:v1';
const ASSET_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface CapturePreviewTokenRuntime {
  tokenSigningSecret?: string;
}
function signingKey(runtime?: CapturePreviewTokenRuntime): Buffer {
  const secret = String(
    runtime?.tokenSigningSecret
      || process.env.CAPTURE_PREVIEW_TOKEN_SECRET
      || process.env.SESSION_SECRET
      || process.env.JWT_SECRET
      || process.env.AUTH_SECRET
      || '',
  ).trim();
  if (!secret) throw new Error('capture_preview_token_secret_missing');
  return crypto
    .createHash('sha256')
    .update(`${PREVIEW_TOKEN_DOMAIN}:key\0`, 'utf8')
    .update(secret, 'utf8')
    .digest();
}

function canonicalAssetId(assetId: string): string {
  const canonical = String(assetId || '').trim().toLowerCase();
  if (!ASSET_ID_PATTERN.test(canonical)) {
    throw new Error('capture_preview_asset_id_invalid');
  }
  return canonical;
}

export function signCapturePreviewToken(
  assetId: string,
  runtime?: CapturePreviewTokenRuntime,
): string {
  const canonical = canonicalAssetId(assetId);
  return crypto
    .createHmac('sha256', signingKey(runtime))
    .update(`${PREVIEW_TOKEN_DOMAIN}\0${canonical}`, 'utf8')
    .digest('base64url');
}

export function verifyCapturePreviewToken(
  assetId: string,
  token: string,
  runtime?: CapturePreviewTokenRuntime,
): boolean {
  if (!TOKEN_PATTERN.test(String(token || ''))) return false;
  try {
    const supplied = Buffer.from(token, 'base64url');
    const expected = Buffer.from(signCapturePreviewToken(assetId, runtime), 'base64url');
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  } catch {
    return false;
  }
}
