/**
 * brand-kit-service.ts
 *
 * Per-prosjekt Brand Kit. Wrapper rundt eksisterende role-room-website-
 * analyzer.ts (BrandProfile) som lagrer en frosset auto-detektert profil
 * + brukerens overrides per casting_project.
 *
 * Brand Kit konsumeres av:
 *   - Market Intelligence Scanner (Fase 2) — som baseline for å avgjøre
 *     om konkurrent-stil stemmer eller står ut
 *   - Marketing Cockpit / Campaign Builder — for brand-consistency på
 *     generert content
 *   - Role Room Agent — for å vite brand-regler ved generering
 *
 * Felt-confidence:
 *   - 'auto'    — fra siste scan
 *   - 'user'    — overstyrt av bruker
 *   - 'missing' — verken scan eller bruker har satt
 */

import type { Pool } from 'pg';
import { analyzeWebsite, type BrandProfile, type ToneOfVoice } from './role-room-website-analyzer.js';

export type BrandKitFieldSource = 'auto' | 'user' | 'missing';

export interface BrandKitFieldConfidence {
  businessName?: BrandKitFieldSource;
  tagline?: BrandKitFieldSource;
  description?: BrandKitFieldSource;
  toneOfVoice?: BrandKitFieldSource;
  usps?: BrandKitFieldSource;
  primaryCTA?: BrandKitFieldSource;
  colors?: BrandKitFieldSource;
  fonts?: BrandKitFieldSource;
  logoUrl?: BrandKitFieldSource;
  industry?: BrandKitFieldSource;
  targetAudience?: BrandKitFieldSource;
}

/**
 * BrandKit = merge(brand_profile, overrides) + metadata.
 * Konsumenter SKAL bruke `effective`-feltet, ikke `brandProfile` direkte.
 */
export interface BrandKit {
  id: string;
  projectId: string;
  workspaceOwnerUserId: string;
  sourceUrl: string;
  brandProfile: BrandProfile;
  overrides: Partial<BrandProfile>;
  fieldConfidence: BrandKitFieldConfidence;
  lastScannedAt: string;
  createdAt: string;
  updatedAt: string;

  /** Auto-merged: overrides over brandProfile. Bruk denne i UI/agent. */
  effective: BrandProfile;
}

/** Lik typene MarketIntel-fase 2 forventer (confidence-streng som union). */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function mergeOverrides(
  base: BrandProfile,
  overrides: Partial<BrandProfile>,
): BrandProfile {
  return {
    ...base,
    ...overrides,
    colors: { ...base.colors, ...(overrides.colors ?? {}) },
    fonts: { ...base.fonts, ...(overrides.fonts ?? {}) },
    usps: overrides.usps && overrides.usps.length > 0 ? overrides.usps : base.usps,
    socialLinks: overrides.socialLinks ?? base.socialLinks,
    productCategories: overrides.productCategories ?? base.productCategories,
  };
}

function deriveFieldConfidence(
  base: BrandProfile,
  overrides: Partial<BrandProfile>,
): BrandKitFieldConfidence {
  const out: BrandKitFieldConfidence = {};
  const keys: Array<keyof BrandKitFieldConfidence> = [
    'businessName', 'tagline', 'description', 'toneOfVoice',
    'usps', 'primaryCTA', 'colors', 'fonts', 'logoUrl',
    'industry', 'targetAudience',
  ];
  for (const k of keys) {
    if (overrides[k as keyof BrandProfile] !== undefined) {
      out[k] = 'user';
    } else if (base[k as keyof BrandProfile] !== undefined && base[k as keyof BrandProfile] !== '') {
      out[k] = 'auto';
    } else {
      out[k] = 'missing';
    }
  }
  return out;
}

interface BrandKitRow {
  id: string;
  project_id: string;
  workspace_owner_user_id: string;
  source_url: string;
  brand_profile: BrandProfile;
  overrides: Partial<BrandProfile>;
  field_confidence: BrandKitFieldConfidence;
  last_scanned_at: string;
  created_at: string;
  updated_at: string;
}

function rowToBrandKit(row: BrandKitRow): BrandKit {
  const effective = mergeOverrides(row.brand_profile, row.overrides);
  return {
    id: row.id,
    projectId: row.project_id,
    workspaceOwnerUserId: row.workspace_owner_user_id,
    sourceUrl: row.source_url,
    brandProfile: row.brand_profile,
    overrides: row.overrides,
    fieldConfidence: row.field_confidence,
    lastScannedAt: row.last_scanned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    effective,
  };
}

// ─────────────────────────────────────────────────────────
// Public service
// ─────────────────────────────────────────────────────────

export async function getBrandKit(
  pool: Pool,
  projectId: string,
): Promise<BrandKit | null> {
  const r = await pool.query<BrandKitRow>(
    `SELECT
       id::text, project_id, workspace_owner_user_id, source_url,
       brand_profile, overrides, field_confidence,
       last_scanned_at::text, created_at::text, updated_at::text
     FROM brand_kits
     WHERE project_id = $1
     LIMIT 1`,
    [projectId],
  );
  if (r.rows.length === 0) return null;
  return rowToBrandKit(r.rows[0]);
}

export async function runBrandScan(
  pool: Pool,
  args: {
    projectId: string;
    workspaceOwnerUserId: string;
    url: string;
    skipClaude?: boolean;
  },
): Promise<BrandKit> {
  const profile = await analyzeWebsite(args.url, { skipClaude: args.skipClaude });

  // Behold tidligere overrides hvis de finnes — kun brand_profile re-skrives
  const existing = await getBrandKit(pool, args.projectId);
  const overrides = existing?.overrides ?? {};
  const fieldConfidence = deriveFieldConfidence(profile, overrides);

  const r = await pool.query<BrandKitRow>(
    `INSERT INTO brand_kits (
       project_id, workspace_owner_user_id, source_url,
       brand_profile, overrides, field_confidence, last_scanned_at
     ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, NOW())
     ON CONFLICT (project_id) DO UPDATE SET
       source_url = EXCLUDED.source_url,
       brand_profile = EXCLUDED.brand_profile,
       field_confidence = EXCLUDED.field_confidence,
       last_scanned_at = NOW(),
       updated_at = NOW()
     RETURNING
       id::text, project_id, workspace_owner_user_id, source_url,
       brand_profile, overrides, field_confidence,
       last_scanned_at::text, created_at::text, updated_at::text`,
    [
      args.projectId,
      args.workspaceOwnerUserId,
      args.url,
      JSON.stringify(profile),
      JSON.stringify(overrides),
      JSON.stringify(fieldConfidence),
    ],
  );
  return rowToBrandKit(r.rows[0]);
}

export async function saveBrandKitOverrides(
  pool: Pool,
  args: {
    projectId: string;
    overrides: Partial<BrandProfile>;
  },
): Promise<BrandKit> {
  const existing = await getBrandKit(pool, args.projectId);
  if (!existing) {
    throw new Error('Brand Kit ikke funnet — kjør en scan først');
  }
  const merged: Partial<BrandProfile> = { ...existing.overrides, ...args.overrides };
  const fieldConfidence = deriveFieldConfidence(existing.brandProfile, merged);

  const r = await pool.query<BrandKitRow>(
    `UPDATE brand_kits
        SET overrides = $2::jsonb,
            field_confidence = $3::jsonb,
            updated_at = NOW()
      WHERE project_id = $1
      RETURNING
        id::text, project_id, workspace_owner_user_id, source_url,
        brand_profile, overrides, field_confidence,
        last_scanned_at::text, created_at::text, updated_at::text`,
    [args.projectId, JSON.stringify(merged), JSON.stringify(fieldConfidence)],
  );
  return rowToBrandKit(r.rows[0]);
}

/** Brukes av Market Intelligence Fase 2 — kort form av Brand Kit som
 *  konkurrent-scannerne bruker som baseline for "stemmer / står ut". */
export interface BrandKitBaseline {
  projectId: string;
  brandName: string;
  primaryColor: string;
  accentColor: string;
  toneOfVoice: ToneOfVoice;
  industry: string;
  targetAudience: string;
  primaryCTA: string;
  usps: string[];
}

export function toBaseline(kit: BrandKit): BrandKitBaseline {
  return {
    projectId: kit.projectId,
    brandName: kit.effective.businessName,
    primaryColor: kit.effective.colors.primary,
    accentColor: kit.effective.colors.accent,
    toneOfVoice: kit.effective.toneOfVoice,
    industry: kit.effective.industry,
    targetAudience: kit.effective.targetAudience,
    primaryCTA: kit.effective.primaryCTA,
    usps: kit.effective.usps,
  };
}
