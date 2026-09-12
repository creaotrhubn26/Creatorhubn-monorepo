import { loadSettings } from "../SettingsModal";

const CLOUD_ASSET = /^mockup-cloud-file:([^:]{1,255}):([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const materialized = new Map<string, Promise<string>>();

export interface MockupCloudAssetRef {
  projectId: string;
  fileId: string;
}

export function parseMockupCloudAssetRef(value: string): MockupCloudAssetRef | null {
  const match = CLOUD_ASSET.exec(value);
  if (!match) return null;
  return { projectId: match[1], fileId: match[2] };
}

function apiBaseUrl(): string {
  const configured = loadSettings().RR_POST_AGENT_BASE_URL || "https://www.creatorhubn.com/api/post-agent";
  return configured.replace(/\/api\/post-agent\/?$/, "").replace(/\/$/, "");
}

export async function fetchMockupCloudAsset(value: string): Promise<Blob> {
  const ref = parseMockupCloudAssetRef(value);
  if (!ref) throw new Error("Ugyldig Mockup Studio-assetreferanse.");
  const bearer = loadSettings().RR_BEARER_TOKEN?.trim();
  if (!bearer) throw new Error("Logg inn i Role Room for å hente figurassetet.");
  const response = await fetch(
    `${apiBaseUrl()}/api/role-room/mockup-projects/${encodeURIComponent(ref.projectId)}/assets/${ref.fileId}?raw=1`,
    { headers: { Authorization: `Bearer ${bearer}` } },
  );
  if (!response.ok) throw new Error(`Kunne ikke hente figurasset (${response.status}).`);
  return response.blob();
}

/** Gjør en privat, stabil skyreferanse om til en kortlivet blob-URL i minnet. */
export async function materializeMockupAsset(value: string): Promise<string> {
  if (!parseMockupCloudAssetRef(value)) return value;
  const cached = materialized.get(value);
  if (cached) return cached;
  const pending = fetchMockupCloudAsset(value)
    .then((blob) => URL.createObjectURL(blob))
    .catch((error) => {
      materialized.delete(value);
      throw error;
    });
  materialized.set(value, pending);
  return pending;
}
