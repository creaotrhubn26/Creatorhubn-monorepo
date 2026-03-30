import { google } from 'googleapis';
import type { Pool } from 'pg';

type CrmCustomerDriveFolderRow = {
  user_id: string;
  customer_id: string;
  drive_folder_id: string | null;
  folder_name: string | null;
  folder_url: string | null;
  folder_structure: unknown;
  metadata: Record<string, unknown> | null;
  source: string | null;
};

type CrmCustomerRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  profession: string | null;
  project_id: string | null;
  custom_fields: Record<string, unknown> | null;
};

type EnsureCustomerDriveWorkspaceParams = {
  userId: string;
  customerId?: string | null;
  customerEmail?: string | null;
  projectId?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  profession?: string | null;
};

type WorkflowCategory = 'quotes' | 'contracts' | 'meeting_notes' | 'timeline' | 'communication';

type EnsureCustomerWorkflowFolderParams = EnsureCustomerDriveWorkspaceParams & {
  category: WorkflowCategory;
};

type UpsertPlainTextGoogleDocumentParams = {
  title: string;
  content: string;
  parentFolderId: string;
  existingDocumentId?: string | null;
};

export type StructuredGoogleDocumentMetaItem = {
  label: string;
  value: string | null | undefined;
};

export type StructuredGoogleDocumentBlock =
  | { type: 'eyebrow'; text: string }
  | { type: 'title'; text: string }
  | { type: 'subtitle'; text: string }
  | { type: 'spotlight'; label: string; value: string; note?: string | null; align?: 'START' | 'CENTER' }
  | { type: 'callout'; title: string; body: string }
  | { type: 'heading'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'meta-list'; items: StructuredGoogleDocumentMetaItem[] }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'numbered-list'; items: string[] }
  | { type: 'divider' }
  | { type: 'spacer'; lines?: number };

export type StructuredGoogleDocumentTheme = {
  accentColor?: string | null;
  titleColor?: string | null;
  secondaryTextColor?: string | null;
  bodyColor?: string | null;
  dividerColor?: string | null;
};

export type DocumentBrandingProfile = {
  businessName: string | null;
  tagline: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  businessAddress: string | null;
  organizationNumber: string | null;
  vatNumber: string | null;
  businessDescription: string | null;
  customFooterText: string | null;
  source: string;
};

export const BUSINESS_BRANDING_SETTINGS_NAMESPACE = 'creatorhub_business_branding';
export const USER_SETTINGS_NAMESPACE = 'creatorhub_user_settings';

type UpsertStructuredGoogleDocumentParams = {
  title: string;
  blocks: StructuredGoogleDocumentBlock[];
  parentFolderId: string;
  existingDocumentId?: string | null;
  theme?: StructuredGoogleDocumentTheme;
};

type CustomerDriveFolder = {
  id: string;
  name: string;
  webViewLink: string | null;
};

type CustomerDriveWorkspace = {
  customer: CrmCustomerRow | null;
  rootFolder: CustomerDriveFolder | null;
  folderStructure: string[];
  source: string;
};

type CustomerWorkflowFolder = CustomerDriveWorkspace & {
  category: WorkflowCategory;
  targetFolder: CustomerDriveFolder | null;
  preferredFolderName: string;
};

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const LEGACY_COMPAT_TABLE_NAME = 'legacy_compat_store';

type LegacySettingEntry = {
  userId?: string;
  projectId?: string;
  namespace?: string;
  data?: unknown;
};

let ensureCustomerDriveFoldersSchemaPromise: Promise<void> | null = null;

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeHexColor(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) return null;
  const normalized = raw.startsWith('#') ? raw.slice(1) : raw;
  if (/^[0-9a-f]{3}$/i.test(normalized)) {
    return `#${normalized.split('').map((entry) => `${entry}${entry}`).join('').toLowerCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(normalized)) {
    return `#${normalized.toLowerCase()}`;
  }
  return null;
}

function hexToRgbColor(
  value: string | null | undefined,
  fallback: { red: number; green: number; blue: number },
) {
  const normalized = normalizeHexColor(value);
  if (!normalized) {
    return {
      color: {
        rgbColor: fallback,
      },
    };
  }

  return {
    color: {
      rgbColor: {
        red: parseInt(normalized.slice(1, 3), 16) / 255,
        green: parseInt(normalized.slice(3, 5), 16) / 255,
        blue: parseInt(normalized.slice(5, 7), 16) / 255,
      },
    },
  };
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeDriveFolderName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function dedupeFolderNames(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const parsed = readString(value);
    if (!parsed) return;
    const normalized = normalizeDriveFolderName(parsed);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(parsed);
  });

  return result;
}

function sanitizeGoogleDriveFolderName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function buildSettingsStoreKey(userId: string, namespace: string, projectId?: string) {
  return `settings:${userId}::${projectId || ''}::${namespace}`;
}

async function ensureLegacyCompatStoreTable(pool: Pool): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${LEGACY_COMPAT_TABLE_NAME} (
        store_key TEXT PRIMARY KEY,
        store_value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } catch {
    // Ignore compat store creation failures; callers will fall back gracefully.
  }
}

async function compatStoreGetFromPool<T>(pool: Pool, storeKey: string): Promise<T | null> {
  await ensureLegacyCompatStoreTable(pool);
  try {
    const result = await pool.query(
      `SELECT store_value FROM ${LEGACY_COMPAT_TABLE_NAME} WHERE store_key = $1 LIMIT 1`,
      [storeKey],
    );
    if (!Array.isArray(result.rows) || result.rows.length === 0) {
      return null;
    }
    return (result.rows[0]?.store_value as T | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function resolveDocumentBranding(
  pool: Pool,
  userId: string,
  fallback?: Partial<DocumentBrandingProfile> | null,
): Promise<DocumentBrandingProfile> {
  const emptyBranding: DocumentBrandingProfile = {
    businessName: readString(fallback?.businessName) || null,
    tagline: readString(fallback?.tagline) || null,
    accentColor: normalizeHexColor(fallback?.accentColor) || null,
    logoUrl: readString(fallback?.logoUrl) || null,
    email: readString(fallback?.email) || null,
    phone: readString(fallback?.phone) || null,
    website: readString(fallback?.website) || null,
    businessAddress: readString(fallback?.businessAddress) || null,
    organizationNumber: readString(fallback?.organizationNumber) || null,
    vatNumber: readString(fallback?.vatNumber) || null,
    businessDescription: readString(fallback?.businessDescription) || null,
    customFooterText: readString(fallback?.customFooterText) || null,
    source: 'fallback',
  };

  const mergeBranding = (
    primary: Partial<DocumentBrandingProfile> | null | undefined,
    secondary: DocumentBrandingProfile,
    source: string,
  ): DocumentBrandingProfile => ({
    businessName: readString(primary?.businessName) || secondary.businessName,
    tagline: readString(primary?.tagline) || secondary.tagline,
    accentColor: normalizeHexColor(primary?.accentColor) || secondary.accentColor,
    logoUrl: readString(primary?.logoUrl) || secondary.logoUrl,
    email: readString(primary?.email) || secondary.email,
    phone: readString(primary?.phone) || secondary.phone,
    website: readString(primary?.website) || secondary.website,
    businessAddress: readString(primary?.businessAddress) || secondary.businessAddress,
    organizationNumber: readString(primary?.organizationNumber) || secondary.organizationNumber,
    vatNumber: readString(primary?.vatNumber) || secondary.vatNumber,
    businessDescription: readString(primary?.businessDescription) || secondary.businessDescription,
    customFooterText: readString(primary?.customFooterText) || secondary.customFooterText,
    source,
  });

  const extractBranding = (payload: unknown): Partial<DocumentBrandingProfile> => {
    const record = readObject(payload);
    const dataRecord = readObject(record.data);
    const primaryRecord = Object.keys(dataRecord).length > 0 ? dataRecord : record;
    const businessRecord = readObject(primaryRecord.businessInfo ?? primaryRecord.business ?? record.businessInfo);
    const brandingRecord = readObject(primaryRecord.branding ?? record.branding);
    const uiRecord = readObject(primaryRecord.ui ?? record.ui);
    const generalRecord = readObject(primaryRecord.general ?? record.general);
    const documentsRecord = readObject(primaryRecord.documents ?? primaryRecord.documentBranding ?? record.documents);

    return {
      businessName:
        readString(businessRecord.businessName)
        || readString(primaryRecord.businessName)
        || readString(brandingRecord.businessName)
        || readString(generalRecord.businessName)
        || readString(generalRecord.companyName)
        || readString(primaryRecord.vendorName)
        || readString(primaryRecord.name)
        || readString(record.vendorName)
        || readString(record.name),
      tagline:
        readString(businessRecord.tagline)
        || readString(primaryRecord.tagline)
        || readString(brandingRecord.tagline)
        || readString(record.tagline),
      accentColor:
        normalizeHexColor(businessRecord.brandingColor)
        || normalizeHexColor(brandingRecord.brandingColor)
        || normalizeHexColor(brandingRecord.primaryColor)
        || normalizeHexColor(uiRecord.accentColor)
        || normalizeHexColor(uiRecord.primaryColor)
        || normalizeHexColor(primaryRecord.brandingColor)
        || normalizeHexColor(primaryRecord.brandColor)
        || normalizeHexColor(primaryRecord.primaryColor)
        || normalizeHexColor(record.brandingColor)
        || normalizeHexColor(record.brandColor)
        || normalizeHexColor(record.primaryColor),
      logoUrl:
        readString(businessRecord.customLogo)
        || readString(businessRecord.logoUrl)
        || readString(brandingRecord.customLogo)
        || readString(brandingRecord.logoUrl)
        || readString(primaryRecord.customLogo)
        || readString(primaryRecord.logoUrl)
        || readString(primaryRecord.logo)
        || readString(record.customLogo)
        || readString(record.logoUrl)
        || readString(record.logo),
      email:
        readString(businessRecord.email)
        || readString(businessRecord.contactEmail)
        || readString(primaryRecord.email)
        || readString(primaryRecord.contactEmail)
        || readString(generalRecord.email)
        || readString(record.email)
        || readString(record.contactEmail),
      phone:
        readString(businessRecord.phone)
        || readString(primaryRecord.phone)
        || readString(record.phone),
      website:
        readString(businessRecord.website)
        || readString(primaryRecord.website)
        || readString(record.website),
      businessAddress:
        readString(businessRecord.businessAddress)
        || readString(businessRecord.address)
        || readString(primaryRecord.businessAddress)
        || readString(primaryRecord.address)
        || readString(record.businessAddress)
        || readString(record.address),
      organizationNumber:
        readString(businessRecord.organizationNumber)
        || readString(businessRecord.orgNumber)
        || readString(primaryRecord.organizationNumber)
        || readString(primaryRecord.orgNumber)
        || readString(primaryRecord.taxId)
        || readString(record.organizationNumber)
        || readString(record.taxId),
      vatNumber:
        readString(businessRecord.vatNumber)
        || readString(primaryRecord.vatNumber)
        || readString(primaryRecord.taxId)
        || readString(record.vatNumber)
        || readString(record.taxId),
      businessDescription:
        readString(businessRecord.businessDescription)
        || readString(businessRecord.description)
        || readString(primaryRecord.businessDescription)
        || readString(primaryRecord.description)
        || readString(record.businessDescription)
        || readString(record.description),
      customFooterText:
        readString(documentsRecord.customFooterText)
        || readString(documentsRecord.footerText)
        || readString(businessRecord.customFooterText)
        || readString(primaryRecord.customFooterText)
        || readString(brandingRecord.customFooterText)
        || readString(record.customFooterText),
    };
  };

  const hasBrandingData = (payload: Partial<DocumentBrandingProfile> | null | undefined) =>
    Boolean(
      payload
      && Object.values(payload).some((value) => typeof value === 'string' && value.trim().length > 0),
    );

  try {
    const [storedBrandingEntry, userSettingsEntry, vendorResult, onboardingResult] = await Promise.all([
      compatStoreGetFromPool<LegacySettingEntry>(
        pool,
        buildSettingsStoreKey(userId, BUSINESS_BRANDING_SETTINGS_NAMESPACE),
      ),
      compatStoreGetFromPool<LegacySettingEntry>(
        pool,
        buildSettingsStoreKey(userId, USER_SETTINGS_NAMESPACE),
      ),
      pool.query(
        `SELECT vendor_name, contact_info, business_info
           FROM vendors
          WHERE user_id = $1
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1`,
        [userId],
      ).catch(() => ({ rows: [] as any[] })),
      pool.query(
        `SELECT vendor_name, business_info
           FROM vendor_onboarding_profiles
          WHERE user_id = $1
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1`,
        [userId],
      ).catch(() => ({ rows: [] as any[] })),
    ]);

    const storedBranding = extractBranding(storedBrandingEntry?.data ?? storedBrandingEntry);
    const userSettingsBranding = extractBranding(userSettingsEntry?.data ?? userSettingsEntry);
    const vendorRow = vendorResult.rows[0];
    const onboardingRow = onboardingResult.rows[0];
    const vendorBranding = vendorRow
      ? {
          ...extractBranding(vendorRow.business_info),
          ...extractBranding(vendorRow.contact_info),
          businessName:
            readString(vendorRow.vendor_name)
            || extractBranding(vendorRow.business_info).businessName
            || extractBranding(vendorRow.contact_info).businessName,
        }
      : null;
    const onboardingBranding = onboardingRow
      ? {
          ...extractBranding(onboardingRow.business_info),
          businessName:
            readString(onboardingRow.vendor_name)
            || extractBranding(onboardingRow.business_info).businessName,
        }
      : null;

    const sources = [
      { source: 'user_settings', payload: userSettingsBranding },
      { source: 'onboarding_profile', payload: onboardingBranding },
      { source: 'vendor_profile', payload: vendorBranding },
      { source: 'branding_settings', payload: storedBranding },
    ] as const;

    let resolved = emptyBranding;
    sources.forEach(({ source, payload }) => {
      if (hasBrandingData(payload)) {
        resolved = mergeBranding(payload, resolved, source);
      }
    });

    if (resolved.source !== 'fallback') {
      return resolved;
    }
  } catch (error) {
    console.warn('Document branding lookup skipped:', error instanceof Error ? error.message : error);
  }

  return emptyBranding;
}

function buildCustomerFolderName(params: {
  customerName?: string | null;
  companyName?: string | null;
  fallbackEmail?: string | null;
}): string {
  const customerName = readString(params.customerName);
  const companyName = readString(params.companyName);
  const fallbackEmail = readString(params.fallbackEmail);

  if (customerName && companyName && normalizeDriveFolderName(customerName) !== normalizeDriveFolderName(companyName)) {
    return sanitizeGoogleDriveFolderName(`${companyName} · ${customerName}`);
  }
  return sanitizeGoogleDriveFolderName(companyName || customerName || fallbackEmail || 'Kunde');
}

function getDefaultFolderStructure(profession: string | null): string[] {
  const normalized = readString(profession)?.toLowerCase();

  if (normalized === 'videographer') {
    return [
      'Brief og pre-pro',
      'Produksjon',
      'Redigering',
      'Review',
      'Leveranser',
      'Kontrakter og dokumenter',
      'Kommunikasjon',
      'Arkiv',
    ];
  }

  if (normalized === 'music_producer') {
    return [
      'Brief og ideer',
      'Innspillinger',
      'Miks og mastering',
      'Leveranser',
      'Kontrakter og dokumenter',
      'Kommunikasjon',
      'Notater',
      'Arkiv',
    ];
  }

  return [
    'RAW - Originale bilder',
    'Bearbeidede bilder',
    'Leveranse til klient',
    'Kontrakter og dokumenter',
    'Kommunikasjon',
    'Timeline og notater',
    'Backup og sikkerhetskopier',
    'Referansebilder og inspirasjon',
  ];
}

function getCustomFieldDriveMetadata(customFields: Record<string, unknown> | null | undefined) {
  if (!customFields || typeof customFields !== 'object') {
    return null;
  }

  const driveRecord =
    customFields.googleDrive && typeof customFields.googleDrive === 'object'
      ? customFields.googleDrive as Record<string, unknown>
      : {};

  const folderId =
    readString(driveRecord.folderId)
    || readString(driveRecord.driveFolderId)
    || readString(customFields.googleDriveFolderId)
    || readString(customFields.driveFolderId);

  if (!folderId) {
    return null;
  }

  return {
    folderId,
    folderName:
      readString(driveRecord.folderName)
      || readString(customFields.googleDriveFolderName)
      || readString(customFields.driveFolderName),
    folderUrl:
      readString(driveRecord.folderUrl)
      || readString(customFields.googleDriveFolderUrl)
      || readString(customFields.driveFolderUrl),
    folderStructure: dedupeFolderNames([
      ...readStringArray(driveRecord.folderStructure),
      ...readStringArray(customFields.googleDriveFolderStructure),
    ]),
  };
}

function folderNameMatches(value: string, patterns: RegExp[]): boolean {
  const normalized = normalizeDriveFolderName(value);
  return patterns.some((pattern) => pattern.test(normalized));
}

function getPreferredFolderName(folderStructure: string[], category: WorkflowCategory): string {
  const candidates: Record<WorkflowCategory, { fallback: string; patterns: RegExp[] }> = {
    quotes: {
      fallback: 'Tilbud',
      patterns: [/tilbud/, /quote/, /proposal/, /pris/, /kontrakt/, /dokument/],
    },
    contracts: {
      fallback: 'Kontrakter',
      patterns: [/kontrakt/, /contract/, /dokument/, /agreement/],
    },
    meeting_notes: {
      fallback: 'Motenotater',
      patterns: [/timeline/, /notat/, /m[oø]te/, /meeting/, /kommunikasjon/],
    },
    timeline: {
      fallback: 'Timeline og notater',
      patterns: [/timeline/, /notat/, /m[oø]te/, /meeting/],
    },
    communication: {
      fallback: 'Kommunikasjon',
      patterns: [/kommunikasjon/, /communication/, /chat/, /e-post/, /epost/],
    },
  };

  const config = candidates[category];
  const matched = folderStructure.find((folderName) => folderNameMatches(folderName, config.patterns));
  return matched || config.fallback;
}

async function ensureCustomerDriveFoldersTable(pool: Pool) {
  if (!ensureCustomerDriveFoldersSchemaPromise) {
    ensureCustomerDriveFoldersSchemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS crm_customer_drive_folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL,
        customer_id VARCHAR NOT NULL,
        drive_folder_id VARCHAR,
        folder_name VARCHAR,
        folder_url TEXT,
        folder_structure JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        source VARCHAR DEFAULT 'auto',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, customer_id)
      );

      CREATE INDEX IF NOT EXISTS idx_crm_customer_drive_folders_customer
        ON crm_customer_drive_folders(customer_id);

      CREATE INDEX IF NOT EXISTS idx_crm_customer_drive_folders_user
        ON crm_customer_drive_folders(user_id);
    `).then(() => undefined);
  }

  return ensureCustomerDriveFoldersSchemaPromise;
}

async function findDriveFolderByName(
  driveApi: ReturnType<typeof google.drive>,
  folderName: string,
  parentId?: string | null,
) {
  const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const filters = [
    `mimeType = '${DRIVE_FOLDER_MIME}'`,
    `name = '${escapedName}'`,
    'trashed = false',
  ];

  if (parentId) {
    filters.push(`'${parentId}' in parents`);
  }

  const response = await driveApi.files.list({
    q: filters.join(' and '),
    fields: 'files(id,name,webViewLink)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const folder = response.data.files?.[0];
  const folderId = readString(folder?.id);
  if (!folderId) {
    return null;
  }

  return {
    id: folderId,
    name: readString(folder?.name) || folderName,
    webViewLink: readString(folder?.webViewLink),
  };
}

export async function ensureDriveFolder(
  driveApi: ReturnType<typeof google.drive>,
  folderName: string,
  parentId?: string | null,
): Promise<CustomerDriveFolder> {
  const safeFolderName = sanitizeGoogleDriveFolderName(folderName);
  if (!safeFolderName) {
    throw new Error('Google Drive-mappen mangler et gyldig navn.');
  }

  const existing = await findDriveFolderByName(driveApi, safeFolderName, parentId);
  if (existing) {
    return existing;
  }

  const created = await driveApi.files.create({
    requestBody: {
      name: safeFolderName,
      mimeType: DRIVE_FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id,name,webViewLink',
    supportsAllDrives: true,
  });

  const folderId = readString(created.data.id);
  if (!folderId) {
    throw new Error(`Kunne ikke opprette Google Drive-mappen ${safeFolderName}.`);
  }

  return {
    id: folderId,
    name: readString(created.data.name) || safeFolderName,
    webViewLink: readString(created.data.webViewLink),
  };
}

async function getPersistedCustomerDriveFolder(pool: Pool, userId: string, customerId: string) {
  await ensureCustomerDriveFoldersTable(pool);

  const result = await pool.query<CrmCustomerDriveFolderRow>(
    `SELECT user_id, customer_id, drive_folder_id, folder_name, folder_url, folder_structure, metadata, source
       FROM crm_customer_drive_folders
      WHERE user_id = $1 AND customer_id = $2
      LIMIT 1`,
    [userId, customerId],
  );

  const row = result.rows[0];
  const folderId = readString(row?.drive_folder_id);
  if (!row || !folderId) {
    return null;
  }

  return {
    id: folderId,
    name: readString(row.folder_name) || 'Kundemappe',
    webViewLink: readString(row.folder_url),
    folderStructure: dedupeFolderNames(readStringArray(row.folder_structure)),
    metadata: row.metadata || {},
    source: readString(row.source) || 'mapping',
  };
}

async function upsertCustomerDriveFolder(params: {
  pool: Pool;
  userId: string;
  customerId: string;
  folderId: string;
  folderName: string;
  folderUrl?: string | null;
  folderStructure: string[];
  metadata?: Record<string, unknown>;
  source?: string | null;
}) {
  await ensureCustomerDriveFoldersTable(params.pool);

  await params.pool.query(
    `INSERT INTO crm_customer_drive_folders (
       user_id, customer_id, drive_folder_id, folder_name, folder_url, folder_structure, metadata, source, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, NOW(), NOW())
     ON CONFLICT (user_id, customer_id)
     DO UPDATE SET
       drive_folder_id = EXCLUDED.drive_folder_id,
       folder_name = EXCLUDED.folder_name,
       folder_url = EXCLUDED.folder_url,
       folder_structure = EXCLUDED.folder_structure,
       metadata = EXCLUDED.metadata,
       source = EXCLUDED.source,
       updated_at = NOW()`,
    [
      params.userId,
      params.customerId,
      params.folderId,
      params.folderName,
      params.folderUrl || null,
      JSON.stringify(params.folderStructure),
      JSON.stringify(params.metadata || {}),
      params.source || 'auto',
    ],
  );
}

async function syncCustomerFolderToCrm(params: {
  pool: Pool;
  customerId: string;
  folderId: string;
  folderName: string;
  folderUrl?: string | null;
  folderStructure: string[];
  source?: string | null;
}) {
  const currentResult = await params.pool.query<Pick<CrmCustomerRow, 'custom_fields'>>(
    `SELECT custom_fields
       FROM crm_customers
      WHERE id::text = $1
      LIMIT 1`,
    [params.customerId],
  );

  const currentCustomFields = readObject(currentResult.rows[0]?.custom_fields);
  const currentGoogleDrive = readObject(currentCustomFields.googleDrive);

  const nextCustomFields = {
    ...currentCustomFields,
    googleDriveFolderId: params.folderId,
    googleDriveFolderName: params.folderName,
    googleDriveFolderUrl: params.folderUrl || null,
    googleDriveFolderStructure: params.folderStructure,
    googleDrive: {
      ...currentGoogleDrive,
      folderId: params.folderId,
      folderName: params.folderName,
      folderUrl: params.folderUrl || null,
      folderStructure: params.folderStructure,
      source: params.source || 'auto',
      updatedAt: new Date().toISOString(),
    },
  };

  await params.pool.query(
    `UPDATE crm_customers
        SET custom_fields = $2::jsonb,
            updated_at = NOW()
      WHERE id::text = $1`,
    [params.customerId, JSON.stringify(nextCustomFields)],
  );
}

async function resolveCrmCustomer(pool: Pool, params: EnsureCustomerDriveWorkspaceParams) {
  const lookups: Array<{ sql: string; params: string[] }> = [];
  const customerId = readString(params.customerId);
  const customerEmail = readString(params.customerEmail)?.toLowerCase();
  const projectId = readString(params.projectId);

  if (customerId) {
    lookups.push({
      sql: `
        SELECT id::text, name, email, phone, company, profession, project_id, custom_fields
          FROM crm_customers
         WHERE id::text = $1
         LIMIT 1
      `,
      params: [customerId],
    });
  }

  if (customerEmail) {
    lookups.push({
      sql: `
        SELECT id::text, name, email, phone, company, profession, project_id, custom_fields
          FROM crm_customers
         WHERE LOWER(email) = $1
         ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 1
      `,
      params: [customerEmail],
    });
  }

  if (projectId) {
    lookups.push({
      sql: `
        SELECT id::text, name, email, phone, company, profession, project_id, custom_fields
          FROM crm_customers
         WHERE project_id = $1
         ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 1
      `,
      params: [projectId],
    });
  }

  for (const lookup of lookups) {
    const result = await pool.query<CrmCustomerRow>(lookup.sql, lookup.params).catch((error) => {
      const code = (error as { code?: string } | null)?.code;
      if (code === '42P01') {
        return { rows: [] as CrmCustomerRow[] };
      }
      throw error;
    });
    if (result.rows[0]) {
      return result.rows[0];
    }
  }

  return null;
}

export async function ensureCustomerDriveWorkspace(
  pool: Pool,
  driveApi: ReturnType<typeof google.drive>,
  params: EnsureCustomerDriveWorkspaceParams,
): Promise<CustomerDriveWorkspace> {
  const userId = readString(params.userId);
  if (!userId) {
    throw new Error('userId is required to resolve the customer Drive workspace.');
  }

  const customer = await resolveCrmCustomer(pool, params);
  if (!customer) {
    return {
      customer: null,
      rootFolder: null,
      folderStructure: [],
      source: 'missing-customer',
    };
  }

  const customFieldMetadata = getCustomFieldDriveMetadata(
    customer.custom_fields && typeof customer.custom_fields === 'object'
      ? customer.custom_fields
      : null,
  );
  const persistedFolder = await getPersistedCustomerDriveFolder(pool, userId, customer.id);

  const folderStructure = dedupeFolderNames([
    ...(persistedFolder?.folderStructure || []),
    ...(customFieldMetadata?.folderStructure || []),
    ...getDefaultFolderStructure(readString(customer.profession) || readString(params.profession)),
  ]);

  let rootFolder: CustomerDriveFolder | null = null;
  let source = persistedFolder?.source || 'auto';

  if (persistedFolder?.id) {
    rootFolder = {
      id: persistedFolder.id,
      name: persistedFolder.name,
      webViewLink: persistedFolder.webViewLink,
    };
    source = persistedFolder.source;
  } else if (customFieldMetadata?.folderId) {
    rootFolder = {
      id: customFieldMetadata.folderId,
      name: customFieldMetadata.folderName || buildCustomerFolderName({
        customerName: customer.name,
        companyName: customer.company,
        fallbackEmail: customer.email,
      }),
      webViewLink: customFieldMetadata.folderUrl || null,
    };
    source = 'crm';
  } else {
    rootFolder = await ensureDriveFolder(
      driveApi,
      buildCustomerFolderName({
        customerName: readString(customer.name) || readString(params.customerName),
        companyName: readString(customer.company) || readString(params.companyName),
        fallbackEmail: readString(customer.email) || readString(params.customerEmail),
      }),
    );

    await Promise.all(
      folderStructure.map((subfolderName) => ensureDriveFolder(driveApi, subfolderName, rootFolder!.id)),
    );
    source = 'auto-create';
  }

  await upsertCustomerDriveFolder({
    pool,
    userId,
    customerId: customer.id,
    folderId: rootFolder.id,
    folderName: rootFolder.name,
    folderUrl: rootFolder.webViewLink,
    folderStructure,
    metadata: {
      ...(persistedFolder?.metadata || {}),
      customerEmail: readString(customer.email),
      customerCompany: readString(customer.company),
      projectId: readString(customer.project_id),
    },
    source,
  });

  await syncCustomerFolderToCrm({
    pool,
    customerId: customer.id,
    folderId: rootFolder.id,
    folderName: rootFolder.name,
    folderUrl: rootFolder.webViewLink,
    folderStructure,
    source,
  });

  return {
    customer,
    rootFolder,
    folderStructure,
    source,
  };
}

export async function ensureCustomerWorkflowFolder(
  pool: Pool,
  driveApi: ReturnType<typeof google.drive>,
  params: EnsureCustomerWorkflowFolderParams,
): Promise<CustomerWorkflowFolder> {
  const workspace = await ensureCustomerDriveWorkspace(pool, driveApi, params);
  if (!workspace.rootFolder) {
    return {
      ...workspace,
      category: params.category,
      targetFolder: null,
      preferredFolderName: getPreferredFolderName([], params.category),
    };
  }

  const preferredFolderName = getPreferredFolderName(workspace.folderStructure, params.category);
  const targetFolder = await ensureDriveFolder(driveApi, preferredFolderName, workspace.rootFolder.id);
  const nextFolderStructure = workspace.folderStructure.includes(preferredFolderName)
    ? workspace.folderStructure
    : [...workspace.folderStructure, preferredFolderName];

  if (workspace.customer && nextFolderStructure.length !== workspace.folderStructure.length) {
    await upsertCustomerDriveFolder({
      pool,
      userId: params.userId,
      customerId: workspace.customer.id,
      folderId: workspace.rootFolder.id,
      folderName: workspace.rootFolder.name,
      folderUrl: workspace.rootFolder.webViewLink,
      folderStructure: nextFolderStructure,
      metadata: {
        targetFolders: {
          [params.category]: targetFolder.id,
        },
      },
      source: workspace.source,
    });

    await syncCustomerFolderToCrm({
      pool,
      customerId: workspace.customer.id,
      folderId: workspace.rootFolder.id,
      folderName: workspace.rootFolder.name,
      folderUrl: workspace.rootFolder.webViewLink,
      folderStructure: nextFolderStructure,
      source: workspace.source,
    });
  }

  return {
    ...workspace,
    folderStructure: nextFolderStructure,
    category: params.category,
    targetFolder,
    preferredFolderName,
  };
}

async function moveDriveFileToFolder(
  driveApi: ReturnType<typeof google.drive>,
  fileId: string,
  parentFolderId: string,
) {
  const existing = await driveApi.files.get({
    fileId,
    fields: 'parents',
    supportsAllDrives: true,
  });

  const previousParents = Array.isArray(existing.data.parents)
    ? existing.data.parents.join(',')
    : undefined;

  const moved = await driveApi.files.update({
    fileId,
    addParents: parentFolderId,
    removeParents: previousParents || undefined,
    fields: 'id,webViewLink,webContentLink,mimeType',
    supportsAllDrives: true,
  });

  return {
    fileId: readString(moved.data.id) || fileId,
    webViewUrl: readString(moved.data.webViewLink),
    webContentLink: readString(moved.data.webContentLink),
    mimeType: readString(moved.data.mimeType),
  };
}

async function replaceGoogleDocumentText(
  docsApi: ReturnType<typeof google.docs>,
  documentId: string,
  content: string,
) {
  const existingDocument = await docsApi.documents.get({ documentId });
  const bodyContent = Array.isArray(existingDocument.data.body?.content)
    ? existingDocument.data.body?.content
    : [];
  const lastNode = bodyContent[bodyContent.length - 1];
  const endIndex = typeof lastNode?.endIndex === 'number' ? lastNode.endIndex : 1;
  const requests: Array<Record<string, unknown>> = [];

  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1,
        },
      },
    });
  }

  requests.push({
    insertText: {
      location: { index: 1 },
      text: content,
    },
  });

  await docsApi.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });
}

const buildPointSize = (magnitude: number) => ({
  magnitude,
  unit: 'PT' as const,
});

const buildRgbColor = (red: number, green: number, blue: number) => ({
  color: {
    rgbColor: { red, green, blue },
  },
});

function buildStructuredGoogleDocumentRequests(
  blocks: StructuredGoogleDocumentBlock[],
  theme?: StructuredGoogleDocumentTheme,
) {
  let cursor = 1;
  let text = '';
  const requests: Array<Record<string, unknown>> = [];
  const accentColor = hexToRgbColor(theme?.accentColor, { red: 0.882, green: 0.431, blue: 0.239 });
  const titleColor = hexToRgbColor(theme?.titleColor, { red: 0.114, green: 0.133, blue: 0.161 });
  const secondaryColor = hexToRgbColor(theme?.secondaryTextColor, { red: 0.416, green: 0.451, blue: 0.51 });
  const bodyColor = hexToRgbColor(theme?.bodyColor, { red: 0.192, green: 0.243, blue: 0.314 });
  const dividerColor = hexToRgbColor(theme?.dividerColor, { red: 0.855, green: 0.867, blue: 0.89 });

  const appendSpacer = (lines = 1) => {
    if (lines <= 0) {
      return;
    }
    text += '\n'.repeat(lines);
    cursor += lines;
  };

  const appendParagraph = (
    paragraphText: string,
    options: {
      namedStyleType?: string;
      alignment?: 'START' | 'CENTER';
      fontSize?: number;
      foregroundColor?: { color: { rgbColor: { red: number; green: number; blue: number } } };
      bold?: boolean;
      italic?: boolean;
      labelLength?: number;
      bulletPreset?: string;
      spaceAbove?: number;
      spaceBelow?: number;
    } = {},
  ) => {
    const normalizedText = paragraphText.replace(/\r\n/g, '\n').trim();
    if (!normalizedText) {
      return;
    }

    const startIndex = cursor;
    text += normalizedText;
    cursor += normalizedText.length;
    const textEndIndex = cursor;
    text += '\n';
    cursor += 1;
    const paragraphEndIndex = cursor;

    const paragraphStyle: Record<string, unknown> = {};
    const paragraphFields: string[] = [];
    if (options.namedStyleType) {
      paragraphStyle.namedStyleType = options.namedStyleType;
      paragraphFields.push('namedStyleType');
    }
    if (options.alignment) {
      paragraphStyle.alignment = options.alignment;
      paragraphFields.push('alignment');
    }
    if (typeof options.spaceAbove === 'number') {
      paragraphStyle.spaceAbove = buildPointSize(options.spaceAbove);
      paragraphFields.push('spaceAbove');
    }
    if (typeof options.spaceBelow === 'number') {
      paragraphStyle.spaceBelow = buildPointSize(options.spaceBelow);
      paragraphFields.push('spaceBelow');
    }

    if (paragraphFields.length > 0) {
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex,
            endIndex: paragraphEndIndex,
          },
          paragraphStyle,
          fields: paragraphFields.join(','),
        },
      });
    }

    const textStyle: Record<string, unknown> = {};
    const textFields: string[] = [];
    if (typeof options.bold === 'boolean') {
      textStyle.bold = options.bold;
      textFields.push('bold');
    }
    if (typeof options.italic === 'boolean') {
      textStyle.italic = options.italic;
      textFields.push('italic');
    }
    if (typeof options.fontSize === 'number') {
      textStyle.fontSize = buildPointSize(options.fontSize);
      textFields.push('fontSize');
    }
    if (options.foregroundColor) {
      textStyle.foregroundColor = options.foregroundColor;
      textFields.push('foregroundColor');
    }

    if (textFields.length > 0) {
      requests.push({
        updateTextStyle: {
          range: {
            startIndex,
            endIndex: textEndIndex,
          },
          textStyle,
          fields: textFields.join(','),
        },
      });
    }

    if (typeof options.labelLength === 'number' && options.labelLength > 0) {
      requests.push({
        updateTextStyle: {
          range: {
            startIndex,
            endIndex: Math.min(startIndex + options.labelLength, textEndIndex),
          },
          textStyle: {
            bold: true,
            foregroundColor: titleColor,
          },
          fields: 'bold,foregroundColor',
        },
      });
    }

    if (options.bulletPreset) {
      requests.push({
        createParagraphBullets: {
          range: {
            startIndex,
            endIndex: paragraphEndIndex,
          },
          bulletPreset: options.bulletPreset,
        },
      });
    }
  };

  for (const block of blocks) {
    if (!block) {
      continue;
    }

    switch (block.type) {
      case 'eyebrow':
        appendParagraph(block.text.toUpperCase(), {
          namedStyleType: 'NORMAL_TEXT',
          fontSize: 9,
          bold: true,
          foregroundColor: accentColor,
          spaceBelow: 6,
        });
        break;
      case 'title':
        appendParagraph(block.text, {
          namedStyleType: 'TITLE',
          fontSize: 22,
          bold: true,
          foregroundColor: titleColor,
          spaceBelow: 6,
        });
        break;
      case 'subtitle':
        appendParagraph(block.text, {
          namedStyleType: 'SUBTITLE',
          fontSize: 11,
          foregroundColor: secondaryColor,
          spaceBelow: 10,
        });
        break;
      case 'spotlight':
        appendParagraph(block.label.toUpperCase(), {
          namedStyleType: 'NORMAL_TEXT',
          fontSize: 8.5,
          bold: true,
          alignment: block.align || 'CENTER',
          foregroundColor: accentColor,
          spaceBelow: 1,
        });
        appendParagraph(block.value, {
          namedStyleType: 'TITLE',
          fontSize: 18,
          bold: true,
          alignment: block.align || 'CENTER',
          foregroundColor: titleColor,
          spaceBelow: block.note ? 2 : 10,
        });
        if (readString(block.note)) {
          appendParagraph(String(block.note).trim(), {
            namedStyleType: 'SUBTITLE',
            fontSize: 10,
            alignment: block.align || 'CENTER',
            foregroundColor: secondaryColor,
            italic: true,
            spaceBelow: 10,
          });
        }
        break;
      case 'callout':
        appendParagraph(block.title.toUpperCase(), {
          namedStyleType: 'NORMAL_TEXT',
          fontSize: 8.5,
          bold: true,
          foregroundColor: accentColor,
          spaceBelow: 2,
        });
        appendParagraph(block.body, {
          namedStyleType: 'NORMAL_TEXT',
          fontSize: 11,
          foregroundColor: bodyColor,
          spaceBelow: 10,
        });
        break;
      case 'heading':
        appendParagraph(block.text, {
          namedStyleType: 'HEADING_1',
          fontSize: 14,
          bold: true,
          foregroundColor: titleColor,
          spaceAbove: 10,
          spaceBelow: 4,
        });
        break;
      case 'subheading':
        appendParagraph(block.text, {
          namedStyleType: 'HEADING_2',
          fontSize: 12,
          bold: true,
          foregroundColor: titleColor,
          spaceAbove: 8,
          spaceBelow: 3,
        });
        break;
      case 'paragraph': {
        const paragraphs = block.text
          .split(/\n{2,}/)
          .map((entry) => entry.trim())
          .filter(Boolean);
        paragraphs.forEach((paragraph, index) => {
          appendParagraph(paragraph, {
            namedStyleType: 'NORMAL_TEXT',
            fontSize: 10.5,
            foregroundColor: bodyColor,
            spaceBelow: index === paragraphs.length - 1 ? 8 : 4,
          });
        });
        break;
      }
      case 'meta-list': {
        const items = block.items
          .map((item) => ({
            label: readString(item?.label),
            value: readString(item?.value),
          }))
          .filter((item): item is { label: string; value: string } => Boolean(item.label && item.value));

        items.forEach((item, index) => {
          const line = `${item.label}: ${item.value}`;
          appendParagraph(line, {
            namedStyleType: 'NORMAL_TEXT',
            fontSize: 10.5,
            foregroundColor: secondaryColor,
            labelLength: item.label.length + 1,
            spaceBelow: index === items.length - 1 ? 6 : 1,
          });
        });
        break;
      }
      case 'bullet-list': {
        const items = block.items
          .map((item) => item.replace(/\r\n/g, '\n').trim())
          .filter(Boolean);
        items.forEach((item, index) => {
          appendParagraph(item, {
            namedStyleType: 'NORMAL_TEXT',
            fontSize: 10.5,
            foregroundColor: bodyColor,
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
            spaceBelow: index === items.length - 1 ? 8 : 1,
          });
        });
        break;
      }
      case 'numbered-list': {
        const items = block.items
          .map((item) => item.replace(/\r\n/g, '\n').trim())
          .filter(Boolean);
        items.forEach((item, index) => {
          appendParagraph(item, {
            namedStyleType: 'NORMAL_TEXT',
            fontSize: 10.5,
            foregroundColor: bodyColor,
            bulletPreset: 'NUMBERED_DECIMAL_ALPHA_ROMAN',
            spaceBelow: index === items.length - 1 ? 8 : 1,
          });
        });
        break;
      }
      case 'divider':
        appendParagraph('────────────────────────────────────────', {
          namedStyleType: 'NORMAL_TEXT',
          fontSize: 8,
          alignment: 'CENTER',
          foregroundColor: dividerColor,
          spaceAbove: 4,
          spaceBelow: 8,
        });
        break;
      case 'spacer':
        appendSpacer(Math.max(1, Math.min(Number(block.lines) || 1, 3)));
        break;
      default:
        break;
    }
  }

  const content = text.trim().length > 0 ? text : 'Dokument\n';
  return {
    content,
    requests,
  };
}

async function replaceGoogleDocumentStructuredContent(
  docsApi: ReturnType<typeof google.docs>,
  documentId: string,
  blocks: StructuredGoogleDocumentBlock[],
  theme?: StructuredGoogleDocumentTheme,
) {
  const existingDocument = await docsApi.documents.get({ documentId });
  const bodyContent = Array.isArray(existingDocument.data.body?.content)
    ? existingDocument.data.body?.content
    : [];
  const lastNode = bodyContent[bodyContent.length - 1];
  const endIndex = typeof lastNode?.endIndex === 'number' ? lastNode.endIndex : 1;
  const built = buildStructuredGoogleDocumentRequests(blocks, theme);
  const requests: Array<Record<string, unknown>> = [];

  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1,
        },
      },
    });
  }

  requests.push({
    insertText: {
      location: { index: 1 },
      text: built.content,
    },
  });

  requests.push(...built.requests);

  await docsApi.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });
}

export async function upsertPlainTextGoogleDocument(
  docsApi: ReturnType<typeof google.docs>,
  driveApi: ReturnType<typeof google.drive>,
  params: UpsertPlainTextGoogleDocumentParams,
) {
  const title = sanitizeGoogleDriveFolderName(params.title) || 'Dokument';
  const content = params.content.trim().length > 0 ? params.content : ' ';
  const existingDocumentId = readString(params.existingDocumentId);

  if (existingDocumentId) {
    try {
      await replaceGoogleDocumentText(docsApi, existingDocumentId, content);
      const movedFile = await moveDriveFileToFolder(driveApi, existingDocumentId, params.parentFolderId);
      return {
        fileId: existingDocumentId,
        webViewUrl: movedFile.webViewUrl,
        webContentLink: movedFile.webContentLink,
        mimeType: movedFile.mimeType,
      };
    } catch (error) {
      const status = (error as { code?: number; response?: { status?: number } } | null)?.code
        || (error as { response?: { status?: number } } | null)?.response?.status;
      if (status !== 404) {
        throw error;
      }
    }
  }

  const createdDocument = await docsApi.documents.create({
    requestBody: { title },
  });
  const fileId = readString(createdDocument.data.documentId);
  if (!fileId) {
    throw new Error('Kunne ikke opprette Google-dokument.');
  }

  await docsApi.documents.batchUpdate({
    documentId: fileId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: content,
          },
        },
      ],
    },
  });

  const movedFile = await moveDriveFileToFolder(driveApi, fileId, params.parentFolderId);
  return {
    fileId,
    webViewUrl: movedFile.webViewUrl,
    webContentLink: movedFile.webContentLink,
    mimeType: movedFile.mimeType,
  };
}

export async function upsertStructuredGoogleDocument(
  docsApi: ReturnType<typeof google.docs>,
  driveApi: ReturnType<typeof google.drive>,
  params: UpsertStructuredGoogleDocumentParams,
) {
  const title = sanitizeGoogleDriveFolderName(params.title) || 'Dokument';
  const existingDocumentId = readString(params.existingDocumentId);
  const blocks = Array.isArray(params.blocks) ? params.blocks : [];

  if (existingDocumentId) {
    try {
      await replaceGoogleDocumentStructuredContent(docsApi, existingDocumentId, blocks, params.theme);
      const movedFile = await moveDriveFileToFolder(driveApi, existingDocumentId, params.parentFolderId);
      return {
        fileId: existingDocumentId,
        webViewUrl: movedFile.webViewUrl,
        webContentLink: movedFile.webContentLink,
        mimeType: movedFile.mimeType,
      };
    } catch (error) {
      const status = (error as { code?: number; response?: { status?: number } } | null)?.code
        || (error as { response?: { status?: number } } | null)?.response?.status;
      if (status !== 404) {
        throw error;
      }
    }
  }

  const createdDocument = await docsApi.documents.create({
    requestBody: { title },
  });
  const fileId = readString(createdDocument.data.documentId);
  if (!fileId) {
    throw new Error('Kunne ikke opprette Google-dokument.');
  }

  await replaceGoogleDocumentStructuredContent(docsApi, fileId, blocks, params.theme);

  const movedFile = await moveDriveFileToFolder(driveApi, fileId, params.parentFolderId);
  return {
    fileId,
    webViewUrl: movedFile.webViewUrl,
    webContentLink: movedFile.webContentLink,
    mimeType: movedFile.mimeType,
  };
}
