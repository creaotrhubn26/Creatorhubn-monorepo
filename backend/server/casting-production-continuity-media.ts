import { open } from 'node:fs/promises';

export class ProductionContinuityMediaValidationError extends Error {}

export const CONTINUITY_MEDIA_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const CONTINUITY_MEDIA_MAX_VIDEO_BYTES = 250 * 1024 * 1024;

export const CONTINUITY_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export interface InspectedContinuityMedia {
  kind: 'photo' | 'video';
  contentType: string;
}

function startsWith(header: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => header[index] === byte);
}

export async function inspectContinuityMediaFile(
  filePath: string,
  declaredContentType: string,
  sizeBytes: number,
): Promise<InspectedContinuityMedia> {
  if (!CONTINUITY_MEDIA_MIME_TYPES.has(declaredContentType)) {
    throw new ProductionContinuityMediaValidationError('Filtypen er ikke tillatt.');
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > CONTINUITY_MEDIA_MAX_VIDEO_BYTES) {
    throw new ProductionContinuityMediaValidationError('Filen er tom eller større enn 250 MB.');
  }

  const handle = await open(filePath, 'r');
  const header = Buffer.alloc(32);
  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }

  const isJpeg = startsWith(header, [0xff, 0xd8, 0xff]);
  const isPng = startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isWebp = header.subarray(0, 4).toString('ascii') === 'RIFF'
    && header.subarray(8, 12).toString('ascii') === 'WEBP';
  const isWebm = startsWith(header, [0x1a, 0x45, 0xdf, 0xa3]);
  const isIsoBmff = header.subarray(4, 8).toString('ascii') === 'ftyp';
  const brand = isIsoBmff ? header.subarray(8, 12).toString('ascii') : '';
  const imageBrands = new Set(['avif', 'avis', 'heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']);
  const isIsoImage = isIsoBmff && imageBrands.has(brand);
  const isIsoVideo = isIsoBmff && !isIsoImage;

  let detected: InspectedContinuityMedia | null = null;
  if (isJpeg) detected = { kind: 'photo', contentType: 'image/jpeg' };
  else if (isPng) detected = { kind: 'photo', contentType: 'image/png' };
  else if (isWebp) detected = { kind: 'photo', contentType: 'image/webp' };
  else if (isIsoImage) {
    detected = { kind: 'photo', contentType: brand.startsWith('avi') ? 'image/avif' : declaredContentType === 'image/heif' ? 'image/heif' : 'image/heic' };
  } else if (isWebm) detected = { kind: 'video', contentType: 'video/webm' };
  else if (isIsoVideo) detected = { kind: 'video', contentType: declaredContentType === 'video/quicktime' || brand === 'qt  ' ? 'video/quicktime' : 'video/mp4' };

  if (!detected || !declaredContentType.startsWith(`${detected.kind === 'photo' ? 'image' : 'video'}/`)) {
    throw new ProductionContinuityMediaValidationError('Filinnholdet samsvarer ikke med den oppgitte filtypen.');
  }
  if (detected.kind === 'photo' && sizeBytes > CONTINUITY_MEDIA_MAX_IMAGE_BYTES) {
    throw new ProductionContinuityMediaValidationError('Bilder kan ikke være større enn 25 MB.');
  }
  return detected;
}
