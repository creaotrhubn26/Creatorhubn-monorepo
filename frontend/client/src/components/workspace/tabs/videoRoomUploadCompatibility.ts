export interface PreparedVideoUpload {
  id: string;
  uploadUrl: string;
}

interface AuthenticatedUploadRequest {
  withCredentials: boolean;
  setRequestHeader(name: string, value: string): void;
}

export function applyLegacyVideoUploadAuth(
  request: AuthenticatedUploadRequest,
  token: string,
): void {
  request.withCredentials = true;
  const normalizedToken = token.trim();
  if (normalizedToken) {
    request.setRequestHeader('Authorization', `Bearer ${normalizedToken}`);
  }
}

interface VideoUploadCompatibilityOptions {
  prepareDirectUpload: () => Promise<PreparedVideoUpload>;
  uploadDirect: (prepared: PreparedVideoUpload) => Promise<void>;
  confirmDirectUpload: (prepared: PreparedVideoUpload) => Promise<void>;
  uploadLegacy: () => Promise<void>;
}

function isExactNotFound(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && (error as { status?: unknown }).status === 404;
}

/**
 * Keeps Video Room usable while an older backend is still serving traffic.
 * Only a 404 from the initial prepare call proves that the direct-upload route
 * is absent. Once a direct upload has started, errors must propagate so the
 * same file is never submitted a second time through the legacy route.
 */
export async function uploadVideoVersionWithCompatibility(
  options: VideoUploadCompatibilityOptions,
): Promise<'direct' | 'legacy'> {
  let prepared: PreparedVideoUpload;

  try {
    prepared = await options.prepareDirectUpload();
  } catch (error) {
    if (!isExactNotFound(error)) throw error;
    await options.uploadLegacy();
    return 'legacy';
  }

  await options.uploadDirect(prepared);
  await options.confirmDirectUpload(prepared);
  return 'direct';
}
