"use strict";

const TUS_VERSION = "1.0.0";
const TUS_CHUNK_GRANULARITY = 256 * 1024;
const TUS_MIN_CHUNK_SIZE = 5 * 1024 * 1024;
const TUS_MAX_CHUNK_SIZE = 200 * 1024 * 1024;

function cleanPart(value, fallback) {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

function normalizeExtension(value) {
  const extension = String(value || "").trim().replace(/^\.+/, "").toLowerCase();
  if (!/^[a-z0-9]{1,10}$/.test(extension)) throw new Error("Eksportpresetet returnerte en ugyldig filtype.");
  return extension;
}

function buildExportFileName(sequenceName, versionLabel, extension) {
  return `${cleanPart(sequenceName, "Sekvens")} - ${cleanPart(versionLabel, "Review")}.${normalizeExtension(extension)}`;
}

function contentTypeForExtension(extension) {
  const value = normalizeExtension(extension);
  return ({
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    mpg: "video/mpeg",
    mpeg: "video/mpeg",
    webm: "video/webm",
  })[value] || "application/octet-stream";
}

function validateSize(value) {
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("Eksportfilen har ugyldig størrelse.");
  return size;
}

function validateObjectUploadUrl(value) {
  let url;
  try { url = new URL(String(value || "")); }
  catch (_) { throw new Error("CreatorHub returnerte en ugyldig opplastingsadresse."); }
  const host = url.hostname.toLowerCase();
  const trusted = host.endsWith(".amazonaws.com") || host.endsWith(".backblazeb2.com") ||
    host.endsWith(".r2.cloudflarestorage.com");
  if (url.protocol !== "https:" || !trusted || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Opplastingsadressen tilhører ikke godkjent objektlagring.");
  }
  return url.toString();
}

function validateRequiredHeaders(value) {
  const headers = {};
  for (const [name, headerValue] of Object.entries(value && typeof value === "object" ? value : {})) {
    const normalized = String(name).toLowerCase();
    if (!["content-type", "x-amz-checksum-sha256"].includes(normalized)) {
      throw new Error("CreatorHub returnerte et ukjent opplastingshode.");
    }
    const text = String(headerValue || "");
    if (!text || text.length > 300 || /[\r\n]/.test(text)) throw new Error("CreatorHub returnerte et ugyldig opplastingshode.");
    headers[normalized] = text;
  }
  return headers;
}

function validateUploadTicket(input) {
  if (!input || typeof input !== "object") throw new Error("CreatorHub returnerte ingen opplastingsbillett.");
  const versionId = String(input.versionId || "").trim();
  if (!versionId || versionId.length > 200) throw new Error("Opplastingsbilletten mangler versjonsidentitet.");
  if (input.protocol === "s3" || input.protocol === "s3-multipart") {
    const objectId = String(input.objectId || "").trim();
    if (!objectId || objectId.length > 200) throw new Error("Opplastingsbilletten mangler objektidentitet.");
    const common = {
      objectId,
      versionId,
      versionNumber: Number(input.versionNumber) || null,
      provider: "object_storage",
      protocol: input.protocol,
      strategy: input.protocol === "s3-multipart" ? "multipart" : "single",
      expiresAt: String(input.expiresAt || ""),
    };
    if (input.protocol === "s3") {
      return {
        ...common,
        uploadUrl: validateObjectUploadUrl(input.uploadUrl),
        requiredHeaders: validateRequiredHeaders(input.requiredHeaders),
      };
    }
    const partSize = Number(input.partSize);
    const partCount = Number(input.partCount);
    if (!Number.isSafeInteger(partSize) || partSize < 5 * 1024 * 1024 || partSize > TUS_MAX_CHUNK_SIZE ||
        !Number.isSafeInteger(partCount) || partCount < 1 || partCount > 10_000) {
      throw new Error("CreatorHub returnerte ugyldige multipart-innstillinger.");
    }
    return { ...common, partSize, partCount };
  }

  let url;
  try { url = new URL(String(input.uploadUrl || "")); }
  catch (_) { throw new Error("CreatorHub returnerte en ugyldig opplastingsadresse."); }
  if (url.protocol !== "https:" || url.hostname !== "upload.videodelivery.net" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Opplastingsadressen tilhører ikke Cloudflare Stream.");
  }
  const uid = String(input.uid || "").trim();
  const chunkSize = Number(input.chunkSize);
  if (!uid || uid.length > 200) throw new Error("Opplastingsbilletten mangler versjonsidentitet.");
  if (input.protocol !== "tus" || !Number.isSafeInteger(chunkSize) || chunkSize < TUS_MIN_CHUNK_SIZE ||
      chunkSize > TUS_MAX_CHUNK_SIZE || chunkSize % TUS_CHUNK_GRANULARITY !== 0) {
    throw new Error("CreatorHub returnerte ugyldige TUS-innstillinger.");
  }
  return {
    uid,
    versionId,
    versionNumber: Number(input.versionNumber) || null,
    uploadUrl: url.toString(),
    protocol: "tus",
    chunkSize,
    expiresAt: String(input.expiresAt || ""),
  };
}

function isUploadTicketExpired(ticket, nowMs) {
  const expiry = Date.parse(String(ticket && ticket.expiresAt || ""));
  return Number.isFinite(expiry) && expiry <= (Number(nowMs) || Date.now()) + 30_000;
}

function maxStreamDurationSeconds(durationSeconds) {
  const duration = Number(durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) return undefined;
  return Math.min(36_000, Math.max(60, Math.ceil(duration) + 30));
}

function publishErrorMessage(error) {
  const code = String(error && error.code || "");
  const message = String(error && error.message || error || "Sendingen feilet.");
  if (code === "cloudflare_stream_capacity_exceeded" || /Storage capacity exceeded|allocated 0 minutes|"code"\s*:\s*10011/i.test(message)) {
    return "Cloudflare Stream har ingen ledig videolagring. Aktiver eller øk Stream-lagring i Cloudflare; eksportfilen er beholdt lokalt og kan sendes videre uten ny eksport.";
  }
  if (code === "storage_quota_exceeded") {
    return "Den inkluderte CreatorHub-lagringen er full. Slett gamle versjoner eller øk lagringskvoten; eksportfilen er beholdt lokalt.";
  }
  if (code === "storage_not_configured") {
    return "Privat objektlagring er ikke tilgjengelig akkurat nå. Eksportfilen er beholdt lokalt og kan sendes videre uten ny eksport.";
  }
  return message;
}

module.exports = {
  TUS_VERSION,
  buildExportFileName,
  contentTypeForExtension,
  isUploadTicketExpired,
  maxStreamDurationSeconds,
  normalizeExtension,
  publishErrorMessage,
  validateObjectUploadUrl,
  validateRequiredHeaders,
  validateSize,
  validateUploadTicket,
};
