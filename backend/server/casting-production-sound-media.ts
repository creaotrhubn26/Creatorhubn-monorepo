import { open, stat } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

export const PRODUCTION_SOUND_MAX_BYTES = 20 * 1024 ** 3;
export const PRODUCTION_SOUND_WAVE_MIME_TYPES = new Set([
  "audio/wav",
  "audio/wave",
  "audio/vnd.wave",
  "audio/x-wav",
  "application/octet-stream",
]);

const MAX_CHUNKS = 4_096;
const MAX_BEXT_BYTES = 1024 * 1024;
const MAX_IXML_BYTES = 2 * 1024 * 1024;

export class ProductionSoundMediaValidationError extends Error {}

export interface ProductionSoundTrackMetadata {
  channelIndex?: number;
  interleaveIndex?: number;
  name?: string;
  function?: string;
}

export interface ProductionSoundWaveMetadata {
  container: "RIFF" | "RF64";
  audioFormat: number;
  channels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitDepth: number;
  dataSizeBytes: number;
  durationSeconds?: number;
  timecodeStart?: string;
  recordedAtLocal?: string;
  bext?: {
    description?: string;
    originator?: string;
    originatorReference?: string;
    originationDate?: string;
    originationTime?: string;
    timeReferenceSamples: string;
    version: number;
    codingHistory?: string;
  };
  ixml?: {
    version?: string;
    project?: string;
    scene?: string;
    take?: string;
    tape?: string;
    note?: string;
    fileUid?: string;
    circled?: boolean;
    timecodeRate?: string;
    timecodeFlag?: string;
    tracks: ProductionSoundTrackMetadata[];
  };
  warnings: string[];
}

export type ProductionSoundRandomAccessReader = (
  offset: number,
  length: number,
) => Promise<Buffer>;

function cleanText(buffer: Buffer): string | undefined {
  const value = buffer.toString("latin1").replace(/\0+$/g, "").trim();
  return value || undefined;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function caseInsensitiveValue(
  object: Record<string, unknown> | null,
  key: string,
): unknown {
  if (!object) return undefined;
  const match = Object.keys(object).find(
    (candidate) => candidate.toUpperCase() === key,
  );
  return match ? object[match] : undefined;
}

function metadataString(
  object: Record<string, unknown> | null,
  key: string,
  max: number,
): string | undefined {
  const value = caseInsensitiveValue(object, key);
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  )
    return undefined;
  const normalized = String(value).replace(/\0/g, "").trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function metadataInteger(
  object: Record<string, unknown> | null,
  key: string,
): number | undefined {
  const value = metadataString(object, key, 32);
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseIxml(xmlBuffer: Buffer): ProductionSoundWaveMetadata["ixml"] {
  const xml = xmlBuffer
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\0+$/g, "")
    .trim();
  if (!xml || /<!(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new ProductionSoundMediaValidationError(
      "iXML inneholder en blokkert eller tom deklarasjon.",
    );
  }
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
    processEntities: false,
    isArray: (name, path) =>
      String(name).toUpperCase() === "TRACK" &&
      String(path).toUpperCase().endsWith("TRACK_LIST.TRACK"),
  });
  const parsed = asObject(parser.parse(xml));
  const root = asObject(caseInsensitiveValue(parsed, "BWFXML")) ?? parsed;
  if (!root)
    throw new ProductionSoundMediaValidationError(
      "iXML-roten kunne ikke leses.",
    );
  const speed = asObject(caseInsensitiveValue(root, "SPEED"));
  const trackList = asObject(caseInsensitiveValue(root, "TRACK_LIST"));
  const rawTracks = caseInsensitiveValue(trackList, "TRACK");
  const trackRows = Array.isArray(rawTracks)
    ? rawTracks
    : rawTracks
      ? [rawTracks]
      : [];
  const tracks = trackRows
    .flatMap((entry) => {
      const track = asObject(entry);
      if (!track) return [];
      const normalized: ProductionSoundTrackMetadata = {
        channelIndex: metadataInteger(track, "CHANNEL_INDEX"),
        interleaveIndex: metadataInteger(track, "INTERLEAVE_INDEX"),
        name: metadataString(track, "NAME", 160),
        function: metadataString(track, "FUNCTION", 160),
      };
      return Object.values(normalized).some((value) => value !== undefined)
        ? [normalized]
        : [];
    })
    .slice(0, 128);
  const circled = metadataString(root, "CIRCLED", 16);
  return {
    version: metadataString(root, "IXML_VERSION", 32),
    project: metadataString(root, "PROJECT", 255),
    scene: metadataString(root, "SCENE", 120),
    take: metadataString(root, "TAKE", 80),
    tape: metadataString(root, "TAPE", 120),
    note: metadataString(root, "NOTE", 4_000),
    fileUid: metadataString(root, "FILE_UID", 255),
    circled: circled ? /^(?:true|yes|1)$/i.test(circled) : undefined,
    timecodeRate: metadataString(speed, "TIMECODE_RATE", 32),
    timecodeFlag: metadataString(speed, "TIMECODE_FLAG", 16),
    tracks,
  };
}

function parseFrameRate(
  value?: string,
): { numerator: number; denominator: number; nominal: number } | null {
  if (!value) return null;
  const rational = value.match(
    /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/,
  );
  const numerator = rational ? Number(rational[1]) : Number(value);
  const denominator = rational ? Number(rational[2]) : 1;
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  )
    return null;
  const fps = numerator / denominator;
  if (fps < 1 || fps > 240) return null;
  return { numerator, denominator, nominal: Math.round(fps) };
}

function pad2(value: number): string {
  return Math.max(0, Math.trunc(value)).toString().padStart(2, "0");
}

export function sampleReferenceToTimecode(
  samples: bigint,
  sampleRate: number,
  rateValue?: string,
  timecodeFlag?: string,
): string | undefined {
  const rate = parseFrameRate(rateValue);
  if (
    !rate ||
    !Number.isSafeInteger(sampleRate) ||
    sampleRate <= 0 ||
    samples < BigInt(0)
  )
    return undefined;
  const elapsedSeconds = Number(samples) / sampleRate;
  if (!Number.isFinite(elapsedSeconds)) return undefined;
  let totalFrames = Math.floor(
    elapsedSeconds * (rate.numerator / rate.denominator),
  );
  const isDrop =
    /^(?:DF|DROP|DROP_FRAME)$/i.test(timecodeFlag ?? "") &&
    (Math.abs(rate.numerator / rate.denominator - 30000 / 1001) < 0.01 ||
      Math.abs(rate.numerator / rate.denominator - 60000 / 1001) < 0.01);
  if (isDrop) {
    const dropFrames = Math.round(rate.nominal * 0.0666666667);
    const framesPerMinute = rate.nominal * 60 - dropFrames;
    const framesPerTenMinutes = rate.nominal * 600 - dropFrames * 9;
    const framesPer24Hours = rate.nominal * 60 * 60 * 24;
    totalFrames %= framesPer24Hours;
    const tenMinuteBlocks = Math.floor(totalFrames / framesPerTenMinutes);
    const remainder = totalFrames % framesPerTenMinutes;
    totalFrames += dropFrames * 9 * tenMinuteBlocks;
    if (remainder >= dropFrames) {
      totalFrames +=
        dropFrames * Math.floor((remainder - dropFrames) / framesPerMinute);
    }
  }
  const frames = totalFrames % rate.nominal;
  const totalSeconds = Math.floor(totalFrames / rate.nominal);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3_600) % 24;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}${isDrop ? ";" : ":"}${pad2(frames)}`;
}

function normalizeRecordedAt(date?: string, time?: string): string | undefined {
  const dateMatch = date?.match(/^(\d{4})\D(\d{2})\D(\d{2})$/);
  const timeMatch = time?.match(/^(\d{2})\D(\d{2})\D(\d{2})$/);
  if (!dateMatch || !timeMatch) return undefined;
  const candidate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`;
  return Number.isFinite(Date.parse(candidate)) ? candidate : undefined;
}

async function readExact(
  reader: ProductionSoundRandomAccessReader,
  offset: number,
  length: number,
): Promise<Buffer> {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0
  ) {
    throw new ProductionSoundMediaValidationError(
      "Ugyldig byteområde i lydfilen.",
    );
  }
  const buffer = await reader(offset, length);
  if (buffer.length !== length) {
    throw new ProductionSoundMediaValidationError("Lydfilen er avkortet.");
  }
  return buffer;
}

function safeChunkSize(value: bigint, fileSize: number): number {
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ProductionSoundMediaValidationError(
      "Lydfilen inneholder en ugyldig chunk-størrelse.",
    );
  }
  const size = Number(value);
  if (size > fileSize)
    throw new ProductionSoundMediaValidationError(
      "Lydfilen inneholder en chunk utenfor filgrensen.",
    );
  return size;
}

export async function inspectProductionSoundWave(
  reader: ProductionSoundRandomAccessReader,
  fileSize: number,
): Promise<ProductionSoundWaveMetadata> {
  if (
    !Number.isSafeInteger(fileSize) ||
    fileSize < 20 ||
    fileSize > PRODUCTION_SOUND_MAX_BYTES
  ) {
    throw new ProductionSoundMediaValidationError(
      "Lydfilen er tom, for liten eller større enn 20 GB.",
    );
  }
  const header = await readExact(reader, 0, 12);
  const container = header.subarray(0, 4).toString("ascii");
  if (
    (container !== "RIFF" && container !== "RF64") ||
    header.subarray(8, 12).toString("ascii") !== "WAVE"
  ) {
    throw new ProductionSoundMediaValidationError(
      "Filinnholdet er ikke en RIFF/RF64 WAVE-fil.",
    );
  }

  let offset = 12;
  let fmt: Buffer | null = null;
  let dataSize: number | null = null;
  let rf64DataSize: bigint | null = null;
  let bext: ProductionSoundWaveMetadata["bext"];
  let ixml: ProductionSoundWaveMetadata["ixml"];
  const warnings: string[] = [];
  let chunkCount = 0;
  while (offset + 8 <= fileSize && chunkCount < MAX_CHUNKS) {
    chunkCount += 1;
    const chunkHeader = await readExact(reader, offset, 8);
    const id = chunkHeader.subarray(0, 4).toString("ascii");
    const declaredSize = chunkHeader.readUInt32LE(4);
    let chunkSize = declaredSize;
    if (id === "data" && declaredSize === 0xffffffff && rf64DataSize !== null) {
      chunkSize = safeChunkSize(rf64DataSize, fileSize);
    }
    const contentOffset = offset + 8;
    if (contentOffset + chunkSize > fileSize) {
      throw new ProductionSoundMediaValidationError(
        `WAVE-chunken ${id || "(ukjent)"} går utenfor filgrensen.`,
      );
    }

    if (id === "ds64" && chunkSize >= 28) {
      const ds64 = await readExact(
        reader,
        contentOffset,
        Math.min(chunkSize, 64),
      );
      rf64DataSize = ds64.readBigUInt64LE(8);
    } else if (id === "fmt " && !fmt) {
      if (chunkSize < 16 || chunkSize > 4_096) {
        throw new ProductionSoundMediaValidationError(
          "WAVE format-chunken er ugyldig.",
        );
      }
      fmt = await readExact(reader, contentOffset, chunkSize);
    } else if (id === "data" && dataSize === null) {
      dataSize = chunkSize;
    } else if (id === "bext" && !bext) {
      if (chunkSize < 348) {
        warnings.push("bext-chunken er for kort og ble ignorert.");
      } else if (chunkSize > MAX_BEXT_BYTES) {
        warnings.push(
          "bext-chunken er større enn analysegrensen og ble ignorert.",
        );
      } else {
        const value = await readExact(reader, contentOffset, chunkSize);
        const timeReference =
          BigInt(value.readUInt32LE(338)) |
          (BigInt(value.readUInt32LE(342)) << BigInt(32));
        bext = {
          description: cleanText(value.subarray(0, 256)),
          originator: cleanText(value.subarray(256, 288)),
          originatorReference: cleanText(value.subarray(288, 320)),
          originationDate: cleanText(value.subarray(320, 330)),
          originationTime: cleanText(value.subarray(330, 338)),
          timeReferenceSamples: timeReference.toString(),
          version: value.readUInt16LE(346),
          codingHistory:
            value.length > 602 ? cleanText(value.subarray(602)) : undefined,
        };
      }
    } else if (id.toLowerCase() === "ixml" && !ixml) {
      if (chunkSize > MAX_IXML_BYTES) {
        warnings.push(
          "iXML-chunken er større enn analysegrensen og ble ikke tolket.",
        );
      } else {
        try {
          ixml = parseIxml(await readExact(reader, contentOffset, chunkSize));
        } catch {
          warnings.push("iXML-metadata kunne ikke tolkes og ble ikke brukt.");
        }
      }
    }

    const paddedSize = chunkSize + (chunkSize % 2);
    const nextOffset = contentOffset + paddedSize;
    if (nextOffset <= offset)
      throw new ProductionSoundMediaValidationError(
        "WAVE-chunkene har ugyldig rekkefølge.",
      );
    offset = nextOffset;
  }
  if (chunkCount >= MAX_CHUNKS && offset + 8 <= fileSize)
    throw new ProductionSoundMediaValidationError(
      "Lydfilen inneholder for mange WAVE-chunker.",
    );
  if (!fmt || dataSize === null)
    throw new ProductionSoundMediaValidationError(
      "Lydfilen mangler fmt- eller data-chunk.",
    );

  const audioFormat = fmt.readUInt16LE(0);
  const channels = fmt.readUInt16LE(2);
  const sampleRate = fmt.readUInt32LE(4);
  const byteRate = fmt.readUInt32LE(8);
  const blockAlign = fmt.readUInt16LE(12);
  const bitDepth = fmt.readUInt16LE(14);
  if (
    !channels ||
    channels > 128 ||
    !sampleRate ||
    sampleRate > 768_000 ||
    !byteRate ||
    !blockAlign ||
    !bitDepth ||
    bitDepth > 64
  ) {
    throw new ProductionSoundMediaValidationError(
      "Lydformatet inneholder ugyldige tekniske verdier.",
    );
  }
  if (!bext)
    warnings.push("Filen er gyldig WAVE, men mangler BWF bext-metadata.");
  if (!ixml) warnings.push("Filen inneholder ingen lesbar iXML-metadata.");
  const timeReference = bext ? BigInt(bext.timeReferenceSamples) : null;
  return {
    container: container as "RIFF" | "RF64",
    audioFormat,
    channels,
    sampleRate,
    byteRate,
    blockAlign,
    bitDepth,
    dataSizeBytes: dataSize,
    durationSeconds:
      byteRate > 0 ? Number((dataSize / byteRate).toFixed(3)) : undefined,
    timecodeStart:
      timeReference !== null
        ? sampleReferenceToTimecode(
            timeReference,
            sampleRate,
            ixml?.timecodeRate,
            ixml?.timecodeFlag,
          )
        : undefined,
    recordedAtLocal: normalizeRecordedAt(
      bext?.originationDate,
      bext?.originationTime,
    ),
    bext,
    ixml,
    warnings: [...new Set(warnings)],
  };
}

export async function inspectProductionSoundWaveFile(
  filePath: string,
  declaredContentType: string,
): Promise<ProductionSoundWaveMetadata> {
  const contentType = declaredContentType.trim().toLowerCase();
  if (!PRODUCTION_SOUND_WAVE_MIME_TYPES.has(contentType)) {
    throw new ProductionSoundMediaValidationError(
      "Kun BWF/WAV-filer kan importeres.",
    );
  }
  const info = await stat(filePath);
  const handle = await open(filePath, "r");
  try {
    return await inspectProductionSoundWave(async (offset, length) => {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      return buffer.subarray(0, bytesRead);
    }, info.size);
  } finally {
    await handle.close();
  }
}
