import { open } from 'node:fs/promises';

export class LocationScoutMediaValidationError extends Error {}

export const LOCATION_SCOUT_MEDIA_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const LOCATION_SCOUT_MEDIA_MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const LOCATION_SCOUT_MEDIA_MAX_VIDEO_BYTES = 250 * 1024 * 1024;

export const LOCATION_SCOUT_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
]);

export type LocationScoutMediaKind = 'photo' | 'video' | 'audio' | 'panorama';

export interface InspectedLocationScoutMedia {
  kind: Exclude<LocationScoutMediaKind, 'panorama'>;
  contentType: string;
}

function startsWith(header: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => header[index] === byte);
}

export async function inspectLocationScoutMediaFile(
  filePath: string,
  declaredContentType: string,
  sizeBytes: number,
): Promise<InspectedLocationScoutMedia> {
  if (!LOCATION_SCOUT_MEDIA_MIME_TYPES.has(declaredContentType)) {
    throw new LocationScoutMediaValidationError('Filtypen er ikke tillatt i Scout Capture.');
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > LOCATION_SCOUT_MEDIA_MAX_VIDEO_BYTES) {
    throw new LocationScoutMediaValidationError('Filen er tom eller større enn 250 MB.');
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
  const isRiff = header.subarray(0, 4).toString('ascii') === 'RIFF';
  const isWebp = isRiff && header.subarray(8, 12).toString('ascii') === 'WEBP';
  const isWav = isRiff && header.subarray(8, 12).toString('ascii') === 'WAVE';
  const isWebm = startsWith(header, [0x1a, 0x45, 0xdf, 0xa3]);
  const isMp3 = header.subarray(0, 3).toString('ascii') === 'ID3'
    || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
  const isIsoBmff = header.subarray(4, 8).toString('ascii') === 'ftyp';
  const brand = isIsoBmff ? header.subarray(8, 12).toString('ascii') : '';
  const imageBrands = new Set(['avif', 'avis', 'heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']);
  const isIsoImage = isIsoBmff && imageBrands.has(brand);

  let detected: InspectedLocationScoutMedia | null = null;
  if (isJpeg) detected = { kind: 'photo', contentType: 'image/jpeg' };
  else if (isPng) detected = { kind: 'photo', contentType: 'image/png' };
  else if (isWebp) detected = { kind: 'photo', contentType: 'image/webp' };
  else if (isIsoImage) {
    detected = { kind: 'photo', contentType: brand.startsWith('avi') ? 'image/avif' : declaredContentType === 'image/heif' ? 'image/heif' : 'image/heic' };
  } else if (isWav) detected = { kind: 'audio', contentType: declaredContentType === 'audio/x-wav' ? 'audio/x-wav' : 'audio/wav' };
  else if (isMp3) detected = { kind: 'audio', contentType: 'audio/mpeg' };
  else if (isWebm) detected = { kind: 'video', contentType: 'video/webm' };
  else if (isIsoBmff && declaredContentType.startsWith('audio/')) {
    detected = { kind: 'audio', contentType: declaredContentType === 'audio/x-m4a' ? 'audio/x-m4a' : 'audio/mp4' };
  } else if (isIsoBmff) {
    detected = { kind: 'video', contentType: declaredContentType === 'video/quicktime' || brand === 'qt  ' ? 'video/quicktime' : 'video/mp4' };
  }

  const family = detected?.kind === 'photo' ? 'image' : detected?.kind;
  if (!detected || !declaredContentType.startsWith(`${family}/`)) {
    throw new LocationScoutMediaValidationError('Filinnholdet samsvarer ikke med den oppgitte filtypen.');
  }
  if (detected.kind === 'photo' && sizeBytes > LOCATION_SCOUT_MEDIA_MAX_IMAGE_BYTES) {
    throw new LocationScoutMediaValidationError('Bilder kan ikke være større enn 25 MB.');
  }
  if (detected.kind === 'audio' && sizeBytes > LOCATION_SCOUT_MEDIA_MAX_AUDIO_BYTES) {
    throw new LocationScoutMediaValidationError('Lydopptak kan ikke være større enn 50 MB.');
  }
  return detected;
}
