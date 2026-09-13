"use strict";

const { TUS_VERSION, isUploadTicketExpired, validateSize, validateUploadTicket } = require("./publish-core");

class TusUploadError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "TusUploadError";
    this.code = code;
    this.status = status || null;
  }
}

function responseOffset(response) {
  const value = Number(response && response.headers && response.headers.get("upload-offset"));
  if (!Number.isSafeInteger(value) || value < 0) throw new TusUploadError("Cloudflare returnerte ugyldig upload-offset.", "invalid_offset");
  return value;
}

async function readOffset(fetchImpl, uploadUrl) {
  const response = await fetchImpl(uploadUrl, {
    method: "HEAD",
    headers: { "Tus-Resumable": TUS_VERSION },
    credentials: "omit",
    redirect: "error",
  });
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403 || response.status === 404 || response.status === 410
      ? "ticket_expired"
      : "head_failed";
    throw new TusUploadError(`Cloudflare avviste gjenopptak med HTTP ${response.status}.`, code, response.status);
  }
  return responseOffset(response);
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
  if (total !== length) throw new TusUploadError("Eksportfilen ble endret eller avkortet under opplasting.", "file_changed");
  return buffer;
}

async function uploadFileTus(options) {
  const ticket = validateUploadTicket(options.ticket);
  const sizeBytes = validateSize(options.sizeBytes);
  const nativePath = String(options.nativePath || "").trim();
  const fsApi = options.fsApi;
  const fetchImpl = options.fetchImpl || fetch;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => undefined;
  if (!nativePath || !fsApi || typeof fsApi.open !== "function" || typeof fsApi.read !== "function") {
    throw new TusUploadError("UXP-filsystemet er ikke tilgjengelig.", "filesystem_unavailable");
  }
  if (isUploadTicketExpired(ticket)) throw new TusUploadError("Opplastingsbilletten er utløpt.", "ticket_expired");

  let offset = await readOffset(fetchImpl, ticket.uploadUrl);
  if (offset > sizeBytes) throw new TusUploadError("Cloudflare-offset er større enn eksportfilen.", "invalid_offset");
  onProgress({ offset, sizeBytes, percent: Math.floor((offset / sizeBytes) * 100) });
  const fd = await fsApi.open(nativePath, "r");
  try {
    while (offset < sizeBytes) {
      const length = Math.min(ticket.chunkSize, sizeBytes - offset);
      const chunk = await readChunk(fsApi, fd, offset, length);
      let response;
      try {
        response = await fetchImpl(ticket.uploadUrl, {
          method: "PATCH",
          headers: {
            "Tus-Resumable": TUS_VERSION,
            "Upload-Offset": String(offset),
            "Content-Type": "application/offset+octet-stream",
          },
          body: chunk,
          credentials: "omit",
          redirect: "error",
        });
      } catch (error) {
        const recovered = await readOffset(fetchImpl, ticket.uploadUrl);
        if (recovered > offset) {
          offset = recovered;
          onProgress({ offset, sizeBytes, percent: Math.floor((offset / sizeBytes) * 100) });
          continue;
        }
        throw new TusUploadError(`Nettverksfeil under opplasting: ${error.message || String(error)}`, "network_failed");
      }
      if (response.status === 409) {
        offset = await readOffset(fetchImpl, ticket.uploadUrl);
        continue;
      }
      if (response.status !== 204) {
        const code = [401, 403, 404, 410].includes(response.status) ? "ticket_expired" : "patch_failed";
        throw new TusUploadError(`Cloudflare avviste videobiten med HTTP ${response.status}.`, code, response.status);
      }
      const nextOffset = responseOffset(response);
      if (nextOffset <= offset || nextOffset > sizeBytes) throw new TusUploadError("Cloudflare returnerte ugyldig fremdrift.", "invalid_offset");
      offset = nextOffset;
      onProgress({ offset, sizeBytes, percent: Math.floor((offset / sizeBytes) * 100) });
    }
  } finally {
    await fsApi.close(fd).catch(() => undefined);
  }
  return { offset, sizeBytes, complete: offset === sizeBytes };
}

module.exports = { TusUploadError, readOffset, uploadFileTus };
