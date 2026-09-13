"use strict";

// Premiere 26.5 exposes the documented fs.open/fs.read symbols, but the host
// currently rejects fs.open at runtime with "Unimplemented method: open".
// Keep the descriptor path as the preferred implementation for hosts that do
// support it, and use the picker-authorized UXP File entry as a bounded
// compatibility path. The bound avoids crashing Premiere on master-sized
// exports while still covering normal H.264 review proxies.
const MAX_BUFFERED_ENTRY_BYTES = 512 * 1024 * 1024;

class LocalFileReadError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "LocalFileReadError";
    this.code = code;
  }
}

function exactArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  return null;
}

async function readDescriptorChunk(fsApi, fd, position, length) {
  const buffer = new ArrayBuffer(length);
  let total = 0;
  while (total < length) {
    const result = await fsApi.read(fd, buffer, total, length - total, position + total);
    const bytesRead = Number(result && result.bytesRead) || 0;
    if (!bytesRead) break;
    total += bytesRead;
  }
  if (total !== length) {
    throw new LocalFileReadError("Eksportfilen ble endret eller avkortet under opplasting.", "file_changed");
  }
  return buffer;
}

async function createFileReader(options) {
  const nativePath = String(options && options.nativePath || "").trim();
  const sizeBytes = Number(options && options.sizeBytes);
  const fsApi = options && options.fsApi;
  const file = options && options.file;
  const binaryFormat = options && options.binaryFormat;
  const maxBufferedBytes = Number(options && options.maxBufferedBytes) || MAX_BUFFERED_ENTRY_BYTES;
  let descriptorError = null;

  if (nativePath && fsApi && typeof fsApi.open === "function" && typeof fsApi.read === "function") {
    try {
      const fd = await fsApi.open(nativePath, "r");
      return {
        kind: "descriptor",
        read: (position, length) => readDescriptorChunk(fsApi, fd, position, length),
        close: async () => {
          if (typeof fsApi.close === "function") await fsApi.close(fd).catch(() => undefined);
        },
      };
    } catch (error) {
      descriptorError = error;
    }
  }

  if (!file?.isFile || typeof file.read !== "function" || binaryFormat === undefined) {
    const detail = descriptorError && descriptorError.message ? ` (${descriptorError.message})` : "";
    throw new LocalFileReadError(`UXP kan ikke lese den valgte eksportfilen${detail}.`, "filesystem_unavailable");
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBufferedBytes) {
    throw new LocalFileReadError(
      "Premiere-versjonen mangler Adobes chunkede fil-API. Velg et H.264-reviewpreset som gir en fil på høyst 512 MiB, eller last opp den ferdige filen fra Video Room.",
      "uxp_chunk_read_unavailable",
    );
  }

  let bytes = exactArrayBuffer(await file.read({ format: binaryFormat }));
  if (!bytes || bytes.byteLength !== sizeBytes) {
    bytes = null;
    throw new LocalFileReadError("Eksportfilen ble endret eller avkortet under opplasting.", "file_changed");
  }
  return {
    kind: "entry-buffer",
    read: async (position, length) => {
      if (!bytes || !Number.isSafeInteger(position) || !Number.isSafeInteger(length) ||
          position < 0 || length < 0 || position + length > bytes.byteLength) {
        throw new LocalFileReadError("Eksportfilen ble endret eller avkortet under opplasting.", "file_changed");
      }
      return bytes.slice(position, position + length);
    },
    close: async () => { bytes = null; },
  };
}

module.exports = {
  LocalFileReadError,
  MAX_BUFFERED_ENTRY_BYTES,
  createFileReader,
  readDescriptorChunk,
};
