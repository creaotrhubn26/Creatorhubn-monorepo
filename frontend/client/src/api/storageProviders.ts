/**
 * API-klient for storage-providers — fotografens egne Backblaze-konti
 * (eller andre S3-kompatible providere) som One Desk bruker for
 * offsite-backup. Backend-rutene ligger i
 * backend/server/storage-providers-routes.ts.
 *
 * SikkerhetsKontrakt:
 *   - POST sender plaintext key_id + application_key MEN backend
 *     validerer mot Backblaze FØR lagring og krypterer AES-256-GCM.
 *   - GET returnerer ALDRI plaintext etter opprettelse.
 *   - DELETE fjerner kun lokalt — eksisterende filer i Backblaze må
 *     slettes via Backblaze-konsoll eller right-to-erasure-flow
 *     (Fase 3).
 */

import { apiRequest } from '@/lib/queryClient';

export type StorageProviderType = 'b2';

export interface StorageProvider {
  id: string;
  provider: StorageProviderType;
  account_label: string;
  validated_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface CreateStorageProviderPayload {
  provider: StorageProviderType;
  account_label: string;
  key_id: string;
  application_key: string;
}

export interface CreateStorageProviderResponse {
  success: boolean;
  provider?: StorageProvider;
  capabilities?: string[];
  error?: string;
}

export async function createStorageProvider(
  payload: CreateStorageProviderPayload,
): Promise<CreateStorageProviderResponse> {
  return apiRequest('/api/storage/providers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface ListStorageProvidersResponse {
  success: boolean;
  providers: StorageProvider[];
  error?: string;
}

export async function listStorageProviders(): Promise<ListStorageProvidersResponse> {
  return apiRequest('/api/storage/providers');
}

export interface DeleteStorageProviderResponse {
  success: boolean;
  warning?: string;
  error?: string;
}

export async function deleteStorageProvider(
  id: string,
): Promise<DeleteStorageProviderResponse> {
  return apiRequest(`/api/storage/providers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ── B2 buckets-listing + cloud-destination-create ──────────────

export interface B2Bucket {
  id: string;
  name: string;
  type: string;
  region: string;
  is_gdpr_safe: boolean;
}

export interface ListBucketsResponse {
  success: boolean;
  buckets: B2Bucket[];
  account_region: string;
  gdpr_warning: string | null;
  error?: string;
}

export async function listBuckets(
  providerId: string,
): Promise<ListBucketsResponse> {
  return apiRequest(
    `/api/storage/providers/${encodeURIComponent(providerId)}/buckets`,
  );
}

export interface CreateCloudDestinationPayload {
  provider_id: string;
  bucket_id: string;
  bucket_name: string;
  prefix?: string;
  label: string;
  priority?: number;
}

export interface CreateCloudDestinationResponse {
  success: boolean;
  destination?: {
    id: string;
    label: string;
    cloud_bucket?: string;
    cloud_prefix?: string;
  };
  error?: string;
}

export async function createCloudDestination(
  projectId: string,
  payload: CreateCloudDestinationPayload,
): Promise<CreateCloudDestinationResponse> {
  return apiRequest(
    `/api/dit/projects/${encodeURIComponent(projectId)}/destinations/cloud`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

// ── GDPR right-to-erasure ──────────────────────────────────────

export interface EraseProjectPayload {
  project_id: string;
  reason?: string;
}

export interface EraseProjectResponse {
  success: boolean;
  deleted: number;
  failed: number;
  total: number;
  errors: string[];
  error?: string;
}

/**
 * Sletter ALLE filer for ett prosjekt fra Backblaze. GDPR Art 17 —
 * right-to-erasure. Logger hver sletting i gdpr_deletion_audit.
 * Uberettiget — kun bruker som eier providersen kan trigge.
 */
export async function eraseProjectFromProvider(
  providerId: string,
  payload: EraseProjectPayload,
): Promise<EraseProjectResponse> {
  return apiRequest(
    `/api/storage/providers/${encodeURIComponent(providerId)}/erase-project`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

// ── Archive files + deliver-to-showcase ────────────────────────

export interface ArchiveFile {
  source_path: string;
  filename: string;
  size_bytes: number | null;
  source_hash: string | null;
  camera_id: string | null;
  verified_at: string | null;
  cloud_providers: string[];
}

export interface ArchiveFilesResponse {
  success: boolean;
  files: ArchiveFile[];
  count: number;
  total_bytes: number;
  error?: string;
}

export async function listArchiveFiles(
  projectId: string,
): Promise<ArchiveFilesResponse> {
  return apiRequest(
    `/api/dit/projects/${encodeURIComponent(projectId)}/archive-files`,
  );
}

export interface DeliverToShowcasePayload {
  client_name: string;
  client_email: string;
  gallery_label?: string;
  source_paths: string[];
}

export interface DeliverToShowcaseResponse {
  success: boolean;
  gallery_id?: string;
  access_token?: string;
  gallery_url?: string;
  delivered?: number;
  skipped?: number;
  created_new_gallery?: boolean;
  errors?: string[];
  error?: string;
}

export async function deliverProjectToShowcase(
  projectId: string,
  payload: DeliverToShowcasePayload,
): Promise<DeliverToShowcaseResponse> {
  return apiRequest(
    `/api/dit/projects/${encodeURIComponent(projectId)}/deliver-to-showcase`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}
