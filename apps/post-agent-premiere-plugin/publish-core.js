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

function validateUploadTicket(input) {
  if (!input || typeof input !== "object") throw new Error("CreatorHub returnerte ingen opplastingsbillett.");
  let url;
  try { url = new URL(String(input.uploadUrl || "")); }
  catch (_) { throw new Error("CreatorHub returnerte en ugyldig opplastingsadresse."); }
  if (url.protocol !== "https:" || url.hostname !== "upload.videodelivery.net" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Opplastingsadressen tilhører ikke Cloudflare Stream.");
  }
  const uid = String(input.uid || "").trim();
  const versionId = String(input.versionId || "").trim();
  const chunkSize = Number(input.chunkSize);
  if (!uid || uid.length > 200 || !versionId || versionId.length > 200) throw new Error("Opplastingsbilletten mangler versjonsidentitet.");
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
  validateSize,
  validateUploadTicket,
};
