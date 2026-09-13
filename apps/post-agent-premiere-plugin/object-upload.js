"use strict";

const {
  isUploadTicketExpired,
  validateObjectUploadUrl,
  validateRequiredHeaders,
  validateSize,
  validateUploadTicket,
} = require("./publish-core");
const { Sha256, sha256Hex } = require("./sha256");

const HASH_CHUNK_SIZE = 8 * 1024 * 1024;

class ObjectUploadError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "ObjectUploadError";
    this.code = code;
    this.status = status || null;
  }
}

async function readChunk(fsApi, fd, position, length) {
  const buffer = new ArrayBuffer(length);
  let total = 0;
  while (total < length) {
    const result = await fsApi.read(fd, buffer, total, length - total, position + total);
    const bytesRead = Number(result && result.bytesRead) || 0;
    if (!bytesRead) break;
    total += bytesRead;
  }
  if (total !== length) {
    throw new ObjectUploadError("Eksportfilen ble endret eller avkortet under opplasting.", "file_changed");
  }
  return buffer;
}

function requireFilesystem(nativePath, fsApi) {
  if (!nativePath || !fsApi || typeof fsApi.open !== "function" || typeof fsApi.read !== "function") {
    throw new ObjectUploadError("UXP-filsystemet er ikke tilgjengelig.", "filesystem_unavailable");
  }
}

async function hashFileSha256(options) {
  const sizeBytes = validateSize(options.sizeBytes);
  const nativePath = String(options.nativePath || "").trim();
  const fsApi = options.fsApi;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => undefined;
  requireFilesystem(nativePath, fsApi);
  const hasher = new Sha256();
  const fd = await fsApi.open(nativePath, "r");
  let offset = 0;
  try {
    while (offset < sizeBytes) {
      const length = Math.min(HASH_CHUNK_SIZE, sizeBytes - offset);
      const chunk = await readChunk(fsApi, fd, offset, length);
      hasher.update(chunk);
      offset += length;
      onProgress({ offset, sizeBytes, percent: Math.floor((offset / sizeBytes) * 100) });
    }
  } finally {
    await fsApi.close(fd).catch(() => undefined);
  }
  return hasher.digestHex();
}

async function putWithRetry(fetchImpl, uploadUrl, headers, chunk) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImpl(uploadUrl, {
        method: "PUT",
        headers,
        body: chunk,
        credentials: "omit",
        redirect: "error",
      });
      if (response.ok) return response;
      if ([401, 403, 404, 410].includes(response.status)) {
        throw new ObjectUploadError(`Objektlagringen avviste opplastingen med HTTP ${response.status}.`, "ticket_expired", response.status);
      }
      lastError = new ObjectUploadError(`Objektlagringen svarte HTTP ${response.status}.`, "put_failed", response.status);
    } catch (error) {
      if (error instanceof ObjectUploadError && error.code === "ticket_expired") throw error;
      lastError = error;
    }
  }
  throw new ObjectUploadError(
    `Nettverksfeil under objektlagring: ${lastError && lastError.message || String(lastError)}`,
    "network_failed",
  );
}

async function uploadFileObjectStorage(options) {
  const ticket = validateUploadTicket(options.ticket);
  if (ticket.protocol !== "s3" && ticket.protocol !== "s3-multipart") {
    throw new ObjectUploadError("Opplastingsbilletten bruker feil protokoll.", "invalid_ticket");
  }
  if (isUploadTicketExpired(ticket)) throw new ObjectUploadError("Opplastingsbilletten er utløpt.", "ticket_expired");
  const sizeBytes = validateSize(options.sizeBytes);
  const nativePath = String(options.nativePath || "").trim();
  const checksumSha256 = String(options.checksumSha256 || "").trim().toLowerCase();
  const fsApi = options.fsApi;
  const fetchImpl = options.fetchImpl || fetch;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => undefined;
  if (!/^[a-f0-9]{64}$/.test(checksumSha256)) throw new ObjectUploadError("Fil-checksum mangler.", "invalid_checksum");
  requireFilesystem(nativePath, fsApi);

  const fd = await fsApi.open(nativePath, "r");
  try {
    if (ticket.protocol === "s3") {
      const chunk = await readChunk(fsApi, fd, 0, sizeBytes);
      if (sha256Hex(chunk) !== checksumSha256) throw new ObjectUploadError("Eksportfilens checksum har endret seg.", "file_changed");
      await putWithRetry(fetchImpl, ticket.uploadUrl, ticket.requiredHeaders, chunk);
      onProgress({ offset: sizeBytes, sizeBytes, percent: 100 });
      await options.complete([]);
      return { complete: true, parts: [] };
    }

    const expectedPartCount = Math.ceil(sizeBytes / ticket.partSize);
    if (expectedPartCount !== ticket.partCount) {
      throw new ObjectUploadError("Multipart-planen samsvarer ikke med filstørrelsen.", "invalid_ticket");
    }
    const status = await options.status();
    const remoteParts = new Map((Array.isArray(status.uploadedParts) ? status.uploadedParts : [])
      .map((part) => [Number(part.partNumber), part]));
    const completed = [];
    const wholeFileHasher = new Sha256();
    let offset = 0;
    for (let partNumber = 1; partNumber <= ticket.partCount; partNumber += 1) {
      const length = Math.min(ticket.partSize, sizeBytes - offset);
      const chunk = await readChunk(fsApi, fd, offset, length);
      wholeFileHasher.update(chunk);
      const partChecksum = sha256Hex(chunk);
      const existing = remoteParts.get(partNumber);
      let etag = existing && existing.checksumSha256 === partChecksum ? String(existing.etag || "") : "";
      if (!etag) {
        const signed = await options.signParts([{ partNumber, checksumSha256: partChecksum }]);
        const candidate = Array.isArray(signed && signed.parts) ? signed.parts[0] : null;
        if (!candidate || Number(candidate.partNumber) !== partNumber) {
          throw new ObjectUploadError("CreatorHub returnerte feil multipart-del.", "invalid_ticket");
        }
        const uploadUrl = validateObjectUploadUrl(candidate.uploadUrl);
        const requiredHeaders = validateRequiredHeaders(candidate.requiredHeaders);
        const response = await putWithRetry(fetchImpl, uploadUrl, requiredHeaders, chunk);
        etag = String(response.headers && response.headers.get("etag") || "").trim();
        if (!etag || etag.length > 512) {
          throw new ObjectUploadError("Objektlagringen returnerte ikke ETag for videodelen.", "etag_missing");
        }
      }
      completed.push({ partNumber, etag, checksumSha256: partChecksum });
      offset += length;
      onProgress({ offset, sizeBytes, percent: Math.floor((offset / sizeBytes) * 100) });
    }
    if (wholeFileHasher.digestHex() !== checksumSha256) {
      throw new ObjectUploadError("Eksportfilens checksum har endret seg.", "file_changed");
    }
    await options.complete(completed);
    return { complete: true, parts: completed };
  } finally {
    await fsApi.close(fd).catch(() => undefined);
  }
}

module.exports = { ObjectUploadError, hashFileSha256, readChunk, uploadFileObjectStorage };
