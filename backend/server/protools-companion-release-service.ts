import {
  getCreatorHubObject,
  presignCreatorHubObjectDownload,
} from "./creatorhub-object-storage.js";

export const PROTOOLS_COMPANION_RELEASE_PREFIX = "platform/releases/protools-companion";
export const PROTOOLS_COMPANION_LATEST_KEY = `${PROTOOLS_COMPANION_RELEASE_PREFIX}/latest.json`;

const RELEASE_CACHE_MS = 5 * 60 * 1000;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REQUIRED_DOWNLOADS = new Set([
  "macOS:Apple Silicon:DMG",
  "macOS:Intel:DMG",
  "Windows:x64:EXE",
  "Windows:x64:MSI",
]);
const REQUIRED_UPDATER_TARGETS = new Set([
  "darwin-aarch64",
  "darwin-x86_64",
  "windows-x86_64",
]);

export interface ProToolsCompanionReleaseArtifact {
  id: string;
  filename: string;
  key: string;
  sizeBytes: number;
  sha256: string;
}

export interface ProToolsCompanionDownload extends ProToolsCompanionReleaseArtifact {
  os: "macOS" | "Windows";
  arch: "Apple Silicon" | "Intel" | "x64";
  format: "DMG" | "EXE" | "MSI";
  signed: true;
}

export interface ProToolsCompanionUpdaterArtifact extends ProToolsCompanionReleaseArtifact {
  signature: string;
}

export interface ProToolsCompanionReleaseManifest {
  schemaVersion: 1;
  product: "protools-companion";
  version: string;
  publishedAt: string;
  notes: string;
  downloads: ProToolsCompanionDownload[];
  updater: Record<string, ProToolsCompanionUpdaterArtifact>;
}

const releaseCache = new Map<string, { at: number; data: ProToolsCompanionReleaseManifest }>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validArtifact(
  value: Record<string, unknown>,
  version: string,
): boolean {
  const filename = typeof value.filename === "string" ? value.filename : "";
  const expectedPrefix = `${PROTOOLS_COMPANION_RELEASE_PREFIX}/${version}/`;
  return typeof value.id === "string"
    && ID_PATTERN.test(value.id)
    && filename.length > 0
    && filename.length <= 200
    && !filename.includes("/")
    && !filename.includes("\\")
    && typeof value.key === "string"
    && value.key === `${expectedPrefix}${filename}`
    && typeof value.sizeBytes === "number"
    && Number.isSafeInteger(value.sizeBytes)
    && value.sizeBytes > 0
    && typeof value.sha256 === "string"
    && SHA256_PATTERN.test(value.sha256);
}

export function parseProToolsCompanionReleaseManifest(
  value: unknown,
): ProToolsCompanionReleaseManifest | null {
  if (!isPlainObject(value)
    || value.schemaVersion !== 1
    || value.product !== "protools-companion"
    || typeof value.version !== "string"
    || !VERSION_PATTERN.test(value.version)
    || typeof value.publishedAt !== "string"
    || !Number.isFinite(Date.parse(value.publishedAt))
    || typeof value.notes !== "string"
    || value.notes.length > 2_000
    || !Array.isArray(value.downloads)
    || !isPlainObject(value.updater)) return null;

  const version = value.version;
  const downloads: ProToolsCompanionDownload[] = [];
  const ids = new Set<string>();
  const downloadKinds = new Set<string>();
  for (const item of value.downloads) {
    if (!isPlainObject(item)
      || !validArtifact(item, version)
      || (item.os !== "macOS" && item.os !== "Windows")
      || (item.arch !== "Apple Silicon" && item.arch !== "Intel" && item.arch !== "x64")
      || (item.format !== "DMG" && item.format !== "EXE" && item.format !== "MSI")
      || item.signed !== true
      || typeof item.id !== "string"
      || ids.has(item.id)) return null;
    ids.add(item.id);
    downloadKinds.add(`${item.os}:${item.arch}:${item.format}`);
    downloads.push(item as unknown as ProToolsCompanionDownload);
  }
  if ([...REQUIRED_DOWNLOADS].some((kind) => !downloadKinds.has(kind))) return null;

  const updater: Record<string, ProToolsCompanionUpdaterArtifact> = {};
  const updaterTargets = Object.keys(value.updater);
  if (updaterTargets.length !== REQUIRED_UPDATER_TARGETS.size
    || updaterTargets.some((target) => !REQUIRED_UPDATER_TARGETS.has(target))) return null;
  for (const target of updaterTargets) {
    const item = value.updater[target];
    if (!isPlainObject(item)
      || !validArtifact(item, version)
      || typeof item.signature !== "string"
      || item.signature.length < 16
      || item.signature.length > 4_096
      || typeof item.id !== "string"
      || ids.has(item.id)) return null;
    ids.add(item.id);
    updater[target] = item as unknown as ProToolsCompanionUpdaterArtifact;
  }

  return {
    schemaVersion: 1,
    product: "protools-companion",
    version,
    publishedAt: value.publishedAt,
    notes: value.notes,
    downloads,
    updater,
  };
}

export async function resolveProToolsCompanionRelease(
  requestedVersion?: string,
): Promise<ProToolsCompanionReleaseManifest | null> {
  if (requestedVersion && !VERSION_PATTERN.test(requestedVersion)) return null;
  const cacheKey = requestedVersion || "latest";
  const cached = releaseCache.get(cacheKey);
  if (cached && Date.now() - cached.at < RELEASE_CACHE_MS) return cached.data;
  const objectKey = requestedVersion
    ? `${PROTOOLS_COMPANION_RELEASE_PREFIX}/${requestedVersion}/creatorhub-s3-release.json`
    : PROTOOLS_COMPANION_LATEST_KEY;
  const object = await getCreatorHubObject(objectKey);
  if (!object || object.body.byteLength > 256 * 1024) return null;
  try {
    const parsed = parseProToolsCompanionReleaseManifest(JSON.parse(object.body.toString("utf8")));
    if (!parsed) return null;
    if (requestedVersion && parsed.version !== requestedVersion) return null;
    releaseCache.set(cacheKey, { at: Date.now(), data: parsed });
    return parsed;
  } catch {
    return null;
  }
}

export function publicProToolsCompanionRelease(manifest: ProToolsCompanionReleaseManifest): {
  version: string;
  publishedAt: string;
  source: "creatorhub-s3";
  downloads: Array<Omit<ProToolsCompanionDownload, "key" | "filename" | "sha256"> & { url: string }>;
} {
  return {
    version: manifest.version,
    publishedAt: manifest.publishedAt,
    source: "creatorhub-s3",
    downloads: manifest.downloads.map(({ key: _key, filename: _filename, sha256: _sha256, ...download }) => ({
      ...download,
      url: `/api/protools/companion/download/${encodeURIComponent(manifest.version)}/${encodeURIComponent(download.id)}`,
    })),
  };
}

export function proToolsCompanionUpdaterManifest(
  manifest: ProToolsCompanionReleaseManifest,
  publicBaseUrl: string,
): Record<string, unknown> {
  const base = publicBaseUrl.replace(/\/+$/, "");
  return {
    version: manifest.version,
    notes: manifest.notes,
    pub_date: manifest.publishedAt,
    platforms: Object.fromEntries(Object.entries(manifest.updater).map(([target, artifact]) => [target, {
      signature: artifact.signature,
      url: `${base}/api/protools/companion/download/${encodeURIComponent(manifest.version)}/${encodeURIComponent(artifact.id)}`,
    }])),
  };
}

export async function presignProToolsCompanionArtifact(
  manifest: ProToolsCompanionReleaseManifest,
  artifactId: string,
): Promise<string | null> {
  if (!ID_PATTERN.test(artifactId)) return null;
  const artifact = [
    ...manifest.downloads,
    ...Object.values(manifest.updater),
  ].find((candidate) => candidate.id === artifactId);
  if (!artifact) return null;
  return presignCreatorHubObjectDownload(artifact.key, artifact.filename, 300);
}

export function resetProToolsCompanionReleaseCacheForTests(): void {
  releaseCache.clear();
}
