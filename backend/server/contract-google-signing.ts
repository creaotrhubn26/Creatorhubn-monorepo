import crypto from 'crypto';
import { Readable } from 'stream';
import { google } from 'googleapis';
import type { Pool } from 'pg';
import {
  getGoogleWorkspaceOauthConfig,
  normalizeGoogleWorkspaceOauthApp,
  type GoogleWorkspaceOauthApp,
} from './google-workspace-oauth.js';
import {
  ensureCustomerWorkflowFolder,
  resolveDocumentBranding,
  upsertStructuredGoogleDocument,
  type DocumentBrandingProfile,
  type StructuredGoogleDocumentBlock,
} from './customer-drive-sync.js';

type RoleRoomGoogleConnectionRow = {
  user_id: string | null;
  google_email: string | null;
  google_subject: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expiry_date: string | null;
  scopes: unknown;
  oauth_app: string | null;
};

type ContractGoogleSignatureRow = {
  id: string;
  contract_id: string;
  provider: string | null;
  status: string | null;
  document_title: string | null;
  drive_source_file_id: string | null;
  pdf_snapshot_drive_file_id: string | null;
  signed_drive_file_id: string | null;
  audit_artifact_id: string | null;
  request_url: string | null;
  web_view_url: string | null;
  requested_by: string | null;
  requested_by_email: string | null;
  counterparty_name: string | null;
  counterparty_email: string | null;
  prepared_at: string | null;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  last_opened_at: string | null;
  last_synced_at: string | null;
  signature_hash: string | null;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
};

export type ContractGoogleSignatureStatus =
  | 'not_started'
  | 'prepared'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'changes_requested'
  | 'rejected';

type AuthorizedContractGoogleClient = {
  oauthClient: InstanceType<typeof google.auth.OAuth2>;
  connection: {
    userId: string | null;
    googleEmail: string | null;
    googleSubject: string | null;
    storedScopes: string[];
  };
};

const CONTRACT_GOOGLE_REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
] as const;

let ensureContractsCompatibilitySchemaPromise: Promise<void> | null = null;

const readStringValue = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readJsonObject = (value: unknown): Record<string, unknown> => {
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
};

const readJsonArray = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object');
      }
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeGrantedScopes = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0))];
  }
  if (typeof value === 'string') {
    return [...new Set(value.split(/\s+/).map((entry) => entry.trim()).filter(Boolean))];
  }
  return [];
};

const deriveEncryptionKey = (): Buffer | null => {
  const secret = readStringValue(
    process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY
    ?? process.env.ROLE_ROOM_ENCRYPTION_KEY
    ?? process.env.SESSION_SECRET
    ?? process.env.JWT_SECRET
    ?? process.env.AUTH_SECRET,
  );
  if (!secret) {
    return null;
  }
  return crypto.createHash('sha256').update(secret).digest();
};

const decryptRoleRoomGoogleToken = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const key = deriveEncryptionKey();
  if (!key) {
    return null;
  }

  const [version, ivPart, tagPart, encryptedPart] = value.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) {
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
};

const encryptRoleRoomGoogleToken = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const key = deriveEncryptionKey();
  if (!key) {
    return null;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
};

const shouldForceGoogleAccessTokenRefresh = (expiryTimestamp?: number | null): boolean => {
  return !Number.isFinite(expiryTimestamp) || Number(expiryTimestamp) <= Date.now() + 60_000;
};

const normalizeGoogleAuthError = (error: unknown): Error => {
  const rawMessage = error instanceof Error ? error.message : String(error ?? 'Google auth failed');
  const responseData = (error as { response?: { data?: unknown } } | undefined)?.response?.data;
  const responsePayload = typeof responseData === 'string' ? responseData : JSON.stringify(responseData ?? {});
  const combined = `${rawMessage} ${responsePayload}`.toLowerCase();

  if (combined.includes('invalid_rapt') || combined.includes('reauth related error')) {
    return new Error('Google krever ny innlogging. Koble Google Workspace til på nytt.');
  }
  if (combined.includes('unauthorized_client')) {
    return new Error('Google OAuth-klienten matcher ikke den lagrede tilkoblingen.');
  }
  if (combined.includes('invalid_grant')) {
    return new Error('Google-tilkoblingen er utløpt. Koble til Google Workspace på nytt.');
  }
  return new Error(rawMessage);
};

async function ensureContractGoogleSigningSchema(pool: Pool) {
  if (!ensureContractsCompatibilitySchemaPromise) {
    ensureContractsCompatibilitySchemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR,
        client_id VARCHAR,
        project_id VARCHAR,
        source_quote_id VARCHAR,
        contract_number VARCHAR,
        contract_title VARCHAR(500),
        title VARCHAR(255),
        logo_url TEXT,
        customer_type VARCHAR(50) DEFAULT 'private',
        organization_number VARCHAR(20),
        organization_name VARCHAR(255),
        business_address TEXT,
        contract_type VARCHAR(100),
        project_type VARCHAR,
        client_name VARCHAR,
        client_email VARCHAR,
        client_phone VARCHAR,
        project_description TEXT,
        event_date DATE,
        event_location VARCHAR,
        total_amount NUMERIC(10, 2) DEFAULT 0,
        profession VARCHAR,
        template_used VARCHAR,
        sections JSONB DEFAULT '[]'::jsonb,
        content TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        google_doc_id VARCHAR(255),
        google_doc_url TEXT,
        signature_status VARCHAR(50) DEFAULT 'not_started',
        signer_name VARCHAR,
        signer_email VARCHAR,
        digital_signature TEXT,
        signature_ip_address VARCHAR,
        signed_date TIMESTAMP,
        signed_at TIMESTAMPTZ,
        document_hash VARCHAR(255),
        status VARCHAR(50) DEFAULT 'draft',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS customer_signatures (
        id VARCHAR PRIMARY KEY,
        contract_id VARCHAR NOT NULL,
        signer_person_id VARCHAR NOT NULL,
        signer_name VARCHAR NOT NULL,
        signer_email VARCHAR NOT NULL,
        auth_method VARCHAR NOT NULL,
        signature_level VARCHAR DEFAULT 'AES',
        document_hash VARCHAR NOT NULL,
        signature_data TEXT NOT NULL,
        timestamp_token TEXT,
        ocsp_response TEXT,
        crl_data TEXT,
        certificate_chain JSONB,
        signed_at TIMESTAMPTZ DEFAULT NOW(),
        valid_until TIMESTAMPTZ,
        ip_address VARCHAR,
        user_agent TEXT,
        status VARCHAR DEFAULT 'valid',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS contract_id VARCHAR;
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS signer_person_id VARCHAR;
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS signer_name VARCHAR;
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS signer_email VARCHAR;
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS auth_method VARCHAR;
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS signature_level VARCHAR DEFAULT 'AES';
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS document_hash VARCHAR;
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS signature_data TEXT;
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS ip_address VARCHAR;
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS user_agent TEXT;
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'valid';
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE customer_signatures ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS quotes (
        id VARCHAR PRIMARY KEY,
        quote_number VARCHAR,
        client_id VARCHAR,
        client_name VARCHAR,
        client_email VARCHAR,
        title VARCHAR(255),
        description TEXT,
        base_price NUMERIC(10, 2) DEFAULT 0,
        additional_services JSONB DEFAULT '[]'::jsonb,
        services JSONB DEFAULT '[]'::jsonb,
        additional_costs JSONB DEFAULT '[]'::jsonb,
        discounts JSONB DEFAULT '[]'::jsonb,
        subtotal NUMERIC(10, 2) DEFAULT 0,
        mva NUMERIC(10, 2) DEFAULT 0,
        total_amount NUMERIC(10, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'NOK',
        status VARCHAR(50) DEFAULT 'draft',
        valid_until TIMESTAMPTZ,
        notes TEXT,
        internal_notes TEXT,
        client_info JSONB DEFAULT '{}'::jsonb,
        approvers JSONB DEFAULT '[]'::jsonb,
        project_creation_data JSONB DEFAULT '{}'::jsonb,
        business_info JSONB DEFAULT '{}'::jsonb,
        project_id VARCHAR,
        profession VARCHAR,
        project_type VARCHAR,
        contract_id VARCHAR,
        quote_type VARCHAR(50) DEFAULT 'standard',
        contract_amendment_for VARCHAR,
        google_doc_id VARCHAR(255),
        google_doc_url TEXT,
        signature_status VARCHAR(50) DEFAULT 'pending',
        created_by VARCHAR,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        sent_at TIMESTAMPTZ,
        viewed_at TIMESTAMPTZ,
        responded_at TIMESTAMPTZ,
        accepted_at TIMESTAMPTZ,
        fiken_invoice_id VARCHAR,
        fiken_invoice_number VARCHAR,
        fiken_customer_id VARCHAR,
        fiken_invoice_status VARCHAR,
        fiken_sync_status VARCHAR,
        fiken_invoice_url TEXT,
        fiken_synced_at TIMESTAMPTZ
      );

      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS user_id VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_id VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS project_id VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_number VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_title VARCHAR(500);
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_name VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_email VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS client_phone VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS project_type VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_type VARCHAR(100);
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS project_description TEXT;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS event_date DATE;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS event_location VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2);
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS profession VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS template_used VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS content TEXT;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS google_doc_id VARCHAR(255);
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS google_doc_url TEXT;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signature_status VARCHAR(50) DEFAULT 'not_started';
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS source_quote_id VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_date TIMESTAMP;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signer_name VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signer_email VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS digital_signature TEXT;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signature_ip_address VARCHAR;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

      ALTER TABLE quotes ADD COLUMN IF NOT EXISTS contract_id VARCHAR;
      CREATE INDEX IF NOT EXISTS idx_quotes_contract_id ON quotes(contract_id);
      CREATE INDEX IF NOT EXISTS idx_contracts_source_quote_id ON contracts(source_quote_id);
      CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON contracts(project_id);
      CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id);
      CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);

      CREATE TABLE IF NOT EXISTS contract_google_signatures (
        id VARCHAR PRIMARY KEY,
        contract_id VARCHAR NOT NULL,
        provider VARCHAR(50) DEFAULT 'google_workspace',
        status VARCHAR(50) DEFAULT 'not_started',
        document_title VARCHAR(500),
        drive_source_file_id VARCHAR(255),
        pdf_snapshot_drive_file_id VARCHAR(255),
        signed_drive_file_id VARCHAR(255),
        audit_artifact_id VARCHAR(255),
        request_url TEXT,
        web_view_url TEXT,
        requested_by VARCHAR,
        requested_by_email VARCHAR,
        counterparty_name VARCHAR,
        counterparty_email VARCHAR,
        prepared_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        signed_at TIMESTAMPTZ,
        declined_at TIMESTAMPTZ,
        last_opened_at TIMESTAMPTZ,
        last_synced_at TIMESTAMPTZ,
        signature_hash VARCHAR(255),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_google_signatures_contract_id
        ON contract_google_signatures(contract_id);
    `).then(() => undefined);
  }

  return ensureContractsCompatibilitySchemaPromise;
}

export async function resolveRoleRoomGoogleConnection(
  pool: Pool,
  preferredUserId?: string | null,
  options?: {
    allowFallbackToAnyUser?: boolean;
    preferredOauthApps?: GoogleWorkspaceOauthApp[];
  },
): Promise<AuthorizedContractGoogleClient> {
  await ensureContractGoogleSigningSchema(pool);

  const allowFallbackToAnyUser = options?.allowFallbackToAnyUser !== false;
  const preferredOauthApps = options?.preferredOauthApps?.length
    ? options.preferredOauthApps
    : ['creatorhub', 'role_room'];
  const queries = preferredUserId
    ? [
        {
          sql: `
            SELECT user_id, google_email, google_subject, access_token_encrypted, refresh_token_encrypted, expiry_date, scopes, oauth_app
            FROM role_room_google_connections
            WHERE connection_state = 'connected'
              AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
              AND user_id = $1
            ORDER BY last_used_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
            LIMIT 10
          `,
          params: [preferredUserId],
        },
        ...(allowFallbackToAnyUser
          ? [
              {
                sql: `
                  SELECT user_id, google_email, google_subject, access_token_encrypted, refresh_token_encrypted, expiry_date, scopes, oauth_app
                  FROM role_room_google_connections
                  WHERE connection_state = 'connected'
                    AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
                  ORDER BY
                    CASE WHEN refresh_token_encrypted IS NOT NULL THEN 0 ELSE 1 END,
                    last_used_at DESC NULLS LAST,
                    updated_at DESC NULLS LAST,
                    created_at DESC NULLS LAST
                  LIMIT 10
                `,
                params: [],
              },
            ]
          : []),
      ]
    : [
        {
          sql: `
            SELECT user_id, google_email, google_subject, access_token_encrypted, refresh_token_encrypted, expiry_date, scopes, oauth_app
            FROM role_room_google_connections
            WHERE connection_state = 'connected'
              AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
            ORDER BY
              CASE WHEN refresh_token_encrypted IS NOT NULL THEN 0 ELSE 1 END,
              last_used_at DESC NULLS LAST,
              updated_at DESC NULLS LAST,
              created_at DESC NULLS LAST
            LIMIT 10
          `,
          params: [],
        },
      ];

  let connection: RoleRoomGoogleConnectionRow | null = null;
  for (const query of queries) {
    try {
      const result = await pool.query<RoleRoomGoogleConnectionRow>(query.sql, query.params);
      if (result.rows.length > 0) {
        for (const preferredApp of preferredOauthApps) {
          const match = result.rows.find(
            (row) => normalizeGoogleWorkspaceOauthApp(row.oauth_app, 'role_room') === preferredApp,
          );
          if (match) {
            connection = match;
            break;
          }
        }
        connection = connection ?? result.rows[0];
        break;
      }
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code !== '42P01') {
        throw error;
      }
    }
  }

  if (!connection) {
    throw new Error('Fant ingen koblet Google Workspace-konto.');
  }

  const oauthApp = normalizeGoogleWorkspaceOauthApp(connection.oauth_app, 'role_room');
  const oauthConfig = getGoogleWorkspaceOauthConfig(oauthApp);
  if (!oauthConfig.clientId || !oauthConfig.clientSecret || !oauthConfig.redirectUri) {
    throw new Error(
      oauthApp === 'creatorhub'
        ? 'CreatorHub Google Workspace er ikke konfigurert.'
        : 'The Role Room Google Workspace er ikke konfigurert.',
    );
  }

  const oauthClient = new google.auth.OAuth2(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    oauthConfig.redirectUri,
  );
  const refreshToken = decryptRoleRoomGoogleToken(connection.refresh_token_encrypted);
  const accessTokenSeed = decryptRoleRoomGoogleToken(connection.access_token_encrypted);
  oauthClient.setCredentials({
    access_token: accessTokenSeed ?? undefined,
    refresh_token: refreshToken ?? undefined,
    expiry_date: connection.expiry_date ? Date.parse(connection.expiry_date) : undefined,
  });

  try {
    const expiryTimestamp = connection.expiry_date ? Date.parse(connection.expiry_date) : NaN;
    if (refreshToken && shouldForceGoogleAccessTokenRefresh(expiryTimestamp)) {
      oauthClient.setCredentials({ refresh_token: refreshToken });
      await oauthClient.refreshAccessToken();
    } else {
      await oauthClient.getAccessToken();
    }

    const nextAccessToken = readStringValue(oauthClient.credentials.access_token);
    const nextRefreshToken = readStringValue(oauthClient.credentials.refresh_token) ?? refreshToken;
    const nextExpiryDate = typeof oauthClient.credentials.expiry_date === 'number'
      ? new Date(oauthClient.credentials.expiry_date).toISOString()
      : connection.expiry_date;

    await pool.query(
      `UPDATE role_room_google_connections
       SET access_token_encrypted = COALESCE($2, access_token_encrypted),
           refresh_token_encrypted = COALESCE($3, refresh_token_encrypted),
           expiry_date = $4,
           connection_state = 'connected',
           last_error = NULL,
           last_used_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1`,
      [
        connection.user_id,
        encryptRoleRoomGoogleToken(nextAccessToken),
        encryptRoleRoomGoogleToken(nextRefreshToken),
        nextExpiryDate,
      ],
    ).catch(() => undefined);
  } catch (error) {
    throw normalizeGoogleAuthError(error);
  }

  return {
    oauthClient,
    connection: {
      userId: connection.user_id,
      googleEmail: connection.google_email,
      googleSubject: connection.google_subject,
      storedScopes: normalizeGrantedScopes(connection.scopes),
    },
  };
}

function serializeContractDocument(contract: Record<string, unknown>, branding?: DocumentBrandingProfile | null) {
  const sections = readJsonArray(contract.sections);
  const metadata = readJsonObject(contract.metadata);
  const formatDate = (value: unknown) => {
    const parsedValue = readStringValue(value);
    if (!parsedValue) {
      return null;
    }
    const parsed = new Date(parsedValue);
    if (Number.isNaN(parsed.getTime())) {
      return parsedValue;
    }
    return parsed.toLocaleDateString('no-NO');
  };
  const formatCurrency = (value: unknown) => {
    const numeric = typeof value === 'number' ? value : Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return '0 NOK';
    }
    return `${numeric.toLocaleString('no-NO')} NOK`;
  };
  const toParagraphBlocks = (content: string | null | undefined): StructuredGoogleDocumentBlock[] => {
    const parsed = readStringValue(content);
    if (!parsed) {
      return [];
    }

    return parsed
      .split(/\n{2,}/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .flatMap((entry): StructuredGoogleDocumentBlock[] => {
        const lines = entry
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const bulletLines = lines
          .filter((line) => /^[-*•]\s+/.test(line))
          .map((line) => line.replace(/^[-*•]\s+/, '').trim())
          .filter(Boolean);

        if (bulletLines.length === lines.length && bulletLines.length > 0) {
          return [{ type: 'bullet-list', items: bulletLines }];
        }

        return [{ type: 'paragraph', text: entry }];
      });
  };
  const quoteSummaryItems = metadata.quoteSummary && typeof metadata.quoteSummary === 'object'
    ? Object.entries(metadata.quoteSummary as Record<string, unknown>)
        .map(([key, value]) => ({
          label: key
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/^\w/, (char) => char.toUpperCase()),
          value:
            typeof value === 'string'
              ? value
              : typeof value === 'number'
                ? String(value)
                : typeof value === 'boolean'
                  ? (value ? 'Ja' : 'Nei')
                  : null,
        }))
        .filter((item) => item.value)
    : [];
  const translateSignatureStatus = (value: unknown) => {
    const normalized = String(value || 'not_started').trim().toLowerCase();
    if (normalized === 'prepared') return 'Klar for signering';
    if (normalized === 'sent') return 'Sendt til signering';
    if (normalized === 'signed') return 'Signert';
    if (normalized === 'viewed') return 'Åpnet';
    if (normalized === 'rejected') return 'Avslått';
    if (normalized === 'changes_requested') return 'Endringer ønsket';
    return 'Ikke startet';
  };
  const quoteBusinessInfo = readJsonObject(metadata.quoteBusinessInfo);
  const issuerName =
    readStringValue(branding?.businessName)
    || readStringValue(contract.organization_name)
    || readStringValue(quoteBusinessInfo.businessName)
    || 'CreatorHub';
  const issuerTagline =
    readStringValue(branding?.tagline)
    || readStringValue(quoteBusinessInfo.tagline);
  const contactLine = [
    readStringValue(branding?.email) || readStringValue(quoteBusinessInfo.email) || readStringValue(quoteBusinessInfo.contactEmail),
    readStringValue(branding?.phone) || readStringValue(quoteBusinessInfo.phone),
    readStringValue(branding?.website) || readStringValue(quoteBusinessInfo.website),
  ].filter(Boolean).join(' · ');
  const clientName = readStringValue(contract.client_name) ?? 'kunde';
  const blocks: StructuredGoogleDocumentBlock[] = [
    { type: 'eyebrow', text: issuerName },
    {
      type: 'title',
      text:
        readStringValue(contract.contract_title)
        ?? readStringValue(contract.title)
        ?? 'Kontrakt',
    },
    {
      type: 'subtitle',
      text: `Avtale mellom CreatorHub og ${clientName}`,
    },
    {
      type: 'spotlight',
      label: 'Avtalt ramme',
      value: formatCurrency(contract.total_amount),
      note: `${translateSignatureStatus(contract.signature_status)}${readStringValue(contract.contract_number) ? ` · ${readStringValue(contract.contract_number)}` : ''}`,
    },
    { type: 'divider' },
    {
      type: 'meta-list',
      items: [
        { label: 'Kontraktnummer', value: readStringValue(contract.contract_number) ?? 'Ikke tildelt' },
        { label: 'Klient', value: clientName },
        { label: 'E-post', value: readStringValue(contract.client_email) ?? 'Ikke oppgitt' },
        { label: 'Prosjekt', value: readStringValue(contract.project_description) ?? readStringValue(contract.title) ?? 'Ikke oppgitt' },
        { label: 'Prosjekttype', value: readStringValue(contract.project_type) ?? readStringValue(contract.contract_type) ?? 'Ikke oppgitt' },
        { label: 'Dato', value: formatDate(contract.event_date) ?? 'Ikke oppgitt' },
        { label: 'Lokasjon', value: readStringValue(contract.event_location) ?? 'Ikke oppgitt' },
      ],
    },
    ...(issuerTagline || contactLine
      ? [{
          type: 'callout' as const,
          title: `Ansvarlig avsender`,
          body: [issuerTagline, contactLine].filter(Boolean).join('\n\n'),
        }]
      : []),
    {
      type: 'callout',
      title: 'Avtalens omfang',
      body:
        readStringValue(contract.project_description)
        ?? 'Denne avtalen regulerer leveranse, ansvar og gjennomføring for oppdraget mellom partene.',
    },
  ];

  blocks.push(
    {
      type: 'heading',
      text: 'Partene bekrefter',
    },
    {
      type: 'bullet-list',
      items: [
        `${clientName} har gjennomgått rammene for leveransen.`,
        'CreatorHub følger opp dokumentasjon, kommunikasjon og signeringsstatus i samme arbeidsflyt.',
        'Avvik, endringer og godkjenninger håndteres fortløpende i CreatorHub.',
      ],
    },
  );

  if (sections.length > 0) {
    sections.forEach((section) => {
      blocks.push({
        type: 'heading',
        text: readStringValue(section.title) ?? 'Seksjon',
      });
      blocks.push(...toParagraphBlocks(readStringValue(section.content)));
    });
  } else if (readStringValue(contract.content)) {
    blocks.push({ type: 'heading', text: 'Kontraktstekst' });
    blocks.push(...toParagraphBlocks(readStringValue(contract.content)));
  } else {
    blocks.push(
      { type: 'heading', text: 'Leveranse og vilkår' },
      {
        type: 'paragraph',
        text: 'Partene følger standardvilkårene for avtalt leveranse, kommunikasjon, oppfølging og godkjenning.',
      },
    );
  }

  if (quoteSummaryItems.length > 0) {
    blocks.push(
      { type: 'heading', text: 'Tilbudsgrunnlag' },
      { type: 'meta-list', items: quoteSummaryItems },
    );
  }

  if (readStringValue(branding?.customFooterText)) {
    blocks.push({
      type: 'callout',
      title: 'Merknad',
      body: readStringValue(branding?.customFooterText) as string,
    });
  }

  blocks.push(
    { type: 'divider' },
    { type: 'heading', text: 'Digital signering' },
    {
      type: 'callout',
      title: 'Signeringsflyt',
      body: 'Dette dokumentet signeres digitalt via CreatorHub sin Google-signaturflyt. Begge parter får tilgang til oppdatert signeringsstatus, dokumenthistorikk og relevante neste steg i samme arbeidsflate.',
    },
    {
      type: 'meta-list',
      items: [
        { label: 'Signaturstatus', value: translateSignatureStatus(contract.signature_status) },
        { label: 'Signer', value: readStringValue(contract.signer_name) ?? clientName },
      ],
    },
    {
      type: 'numbered-list',
      items: [
        'Gå gjennom innhold og leveranser før signering.',
        'Signer dokumentet i den delte Google-signaturflyten.',
        'Etter signering synkes status tilbake til kontrakt, CRM, chat og tidslinje.',
      ],
    },
  );

  return blocks;
}

async function ensureDriveFolder(
  driveApi: ReturnType<typeof google.drive>,
  folderName: string,
  parentFolderId?: string | null,
): Promise<string> {
  const parentQuery = parentFolderId ? ` and '${parentFolderId}' in parents` : '';
  const escapedName = folderName.replace(/'/g, "\\'");
  const existing = await driveApi.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${escapedName}' and trashed=false${parentQuery}`,
    fields: 'files(id,name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existingId = readStringValue(existing.data.files?.[0]?.id);
  if (existingId) {
    return existingId;
  }

  const created = await driveApi.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  const folderId = readStringValue(created.data.id);
  if (!folderId) {
    throw new Error(`Kunne ikke opprette Drive-mappe for ${folderName}.`);
  }
  return folderId;
}

async function ensureContractDriveLayout(
  pool: Pool,
  driveApi: ReturnType<typeof google.drive>,
  contract: Record<string, unknown>,
) {
  const workspace = await ensureCustomerWorkflowFolder(pool, driveApi, {
    userId: readStringValue(contract.user_id) || 'default-user',
    customerId: readStringValue(contract.client_id),
    customerEmail: readStringValue(contract.client_email),
    projectId: readStringValue(contract.project_id),
    customerName: readStringValue(contract.client_name),
    companyName: readStringValue(contract.organization_name),
    profession: readStringValue(contract.profession),
    category: 'contracts',
  });

  const rootFolderId = workspace.rootFolder?.id ?? await ensureDriveFolder(driveApi, 'CreatorHub Contracts');
  const contractsFolderId = workspace.targetFolder?.id ?? await ensureDriveFolder(
    driveApi,
    workspace.preferredFolderName || 'Kontrakter',
    rootFolderId,
  );
  const contractFolderId = await ensureDriveFolder(
    driveApi,
    `${readStringValue(contract.contract_number) ?? readStringValue(contract.id) ?? 'contract'} · ${readStringValue(contract.contract_title) ?? readStringValue(contract.title) ?? readStringValue(contract.client_name) ?? 'Kontrakt'}`,
    contractsFolderId,
  );
  const signedFolderId = await ensureDriveFolder(driveApi, 'Signed', contractFolderId);

  return {
    rootFolderId,
    contractFolderId,
    signedFolderId,
  };
}

async function createContractGoogleDocument(
  docsApi: ReturnType<typeof google.docs>,
  driveApi: ReturnType<typeof google.drive>,
  contract: Record<string, unknown>,
  parentFolderId: string,
  branding: DocumentBrandingProfile | null,
  existingDocumentId?: string | null,
) {
  const title =
    readStringValue(contract.contract_title)
    ?? readStringValue(contract.title)
    ?? `Kontrakt ${readStringValue(contract.contract_number) ?? ''}`.trim();
  return upsertStructuredGoogleDocument(docsApi, driveApi, {
    title,
    blocks: serializeContractDocument(contract, branding),
    parentFolderId,
    existingDocumentId,
    theme: {
      accentColor: branding?.accentColor,
    },
  });
}

function toDownloadBuffer(payload: unknown): Buffer {
  if (Buffer.isBuffer(payload)) {
    return payload;
  }
  if (payload instanceof ArrayBuffer) {
    return Buffer.from(payload);
  }
  if (ArrayBuffer.isView(payload)) {
    return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  }
  if (typeof payload === 'string') {
    return Buffer.from(payload, 'utf8');
  }
  throw new Error('Ukjent Google Drive-nedlastingsformat.');
}

function toUploadBody(payload: Buffer): Readable {
  return Readable.from(payload);
}

async function exportContractPdfToDrive(
  driveApi: ReturnType<typeof google.drive>,
  sourceFileId: string,
  parentFolderId: string,
  documentTitle: string,
  existingFileId?: string | null,
) {
  const exported = await driveApi.files.export(
    {
      fileId: sourceFileId,
      mimeType: 'application/pdf',
    },
    {
      responseType: 'arraybuffer',
    },
  );

  const pdfBuffer = toDownloadBuffer(exported.data);
  const fileName = `${documentTitle}.pdf`;
  const uploaded = existingFileId
    ? await driveApi.files.update({
        fileId: existingFileId,
        requestBody: { name: fileName },
        media: {
          mimeType: 'application/pdf',
          body: toUploadBody(pdfBuffer),
        },
        fields: 'id,webViewLink,webContentLink,mimeType',
        supportsAllDrives: true,
      })
    : await driveApi.files.create({
        requestBody: {
          name: fileName,
          parents: [parentFolderId],
        },
        media: {
          mimeType: 'application/pdf',
          body: toUploadBody(pdfBuffer),
        },
        fields: 'id,webViewLink,webContentLink,mimeType',
        supportsAllDrives: true,
      });

  return {
    fileId: readStringValue(uploaded.data.id),
    webViewUrl: readStringValue(uploaded.data.webViewLink),
    webContentLink: readStringValue(uploaded.data.webContentLink),
    mimeType: readStringValue(uploaded.data.mimeType),
  };
}

async function shareContractGoogleDocument(
  driveApi: ReturnType<typeof google.drive>,
  fileId: string,
  recipientEmail: string,
) {
  try {
    await driveApi.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role: 'reader',
        emailAddress: recipientEmail,
      },
      sendNotificationEmail: true,
      supportsAllDrives: true,
      fields: 'id',
    });
  } catch (error) {
    const code = (error as { code?: number; response?: { status?: number } } | null)?.code
      ?? (error as { response?: { status?: number } } | null)?.response?.status;
    if (code === 409) {
      return;
    }
    throw error;
  }
}

async function getContractRow(pool: Pool, contractId: string) {
  await ensureContractGoogleSigningSchema(pool);
  const result = await pool.query(`SELECT * FROM contracts WHERE id = $1 LIMIT 1`, [contractId]);
  return result.rows[0] ?? null;
}

async function getContractGoogleSignatureRow(pool: Pool, contractId: string) {
  await ensureContractGoogleSigningSchema(pool);
  const result = await pool.query<ContractGoogleSignatureRow>(
    `SELECT * FROM contract_google_signatures WHERE contract_id = $1 LIMIT 1`,
    [contractId],
  );
  return result.rows[0] ?? null;
}

async function upsertContractGoogleSignatureRow(
  pool: Pool,
  contractId: string,
  payload: {
    status?: ContractGoogleSignatureStatus;
    documentTitle?: string | null;
    driveSourceFileId?: string | null;
    pdfSnapshotDriveFileId?: string | null;
    signedDriveFileId?: string | null;
    auditArtifactId?: string | null;
    requestUrl?: string | null;
    webViewUrl?: string | null;
    requestedBy?: string | null;
    requestedByEmail?: string | null;
    counterpartyName?: string | null;
    counterpartyEmail?: string | null;
    preparedAt?: string | null;
    sentAt?: string | null;
    signedAt?: string | null;
    declinedAt?: string | null;
    lastOpenedAt?: string | null;
    lastSyncedAt?: string | null;
    signatureHash?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await ensureContractGoogleSigningSchema(pool);
  const existing = await getContractGoogleSignatureRow(pool, contractId);
  const nextMetadata = {
    ...(existing ? readJsonObject(existing.metadata) : {}),
    ...(payload.metadata ?? {}),
  };

  const result = await pool.query<ContractGoogleSignatureRow>(
    `INSERT INTO contract_google_signatures (
      id, contract_id, provider, status, document_title, drive_source_file_id,
      pdf_snapshot_drive_file_id, signed_drive_file_id, audit_artifact_id,
      request_url, web_view_url, requested_by, requested_by_email,
      counterparty_name, counterparty_email, prepared_at, sent_at, signed_at,
      declined_at, last_opened_at, last_synced_at, signature_hash, metadata, created_at, updated_at
    ) VALUES (
      $1, $2, 'google_workspace', $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15, $16, $17,
      $18, $19, $20, $21, $22::jsonb, NOW(), NOW()
    )
    ON CONFLICT (contract_id) DO UPDATE SET
      status = COALESCE(EXCLUDED.status, contract_google_signatures.status),
      document_title = COALESCE(EXCLUDED.document_title, contract_google_signatures.document_title),
      drive_source_file_id = COALESCE(EXCLUDED.drive_source_file_id, contract_google_signatures.drive_source_file_id),
      pdf_snapshot_drive_file_id = COALESCE(EXCLUDED.pdf_snapshot_drive_file_id, contract_google_signatures.pdf_snapshot_drive_file_id),
      signed_drive_file_id = COALESCE(EXCLUDED.signed_drive_file_id, contract_google_signatures.signed_drive_file_id),
      audit_artifact_id = COALESCE(EXCLUDED.audit_artifact_id, contract_google_signatures.audit_artifact_id),
      request_url = COALESCE(EXCLUDED.request_url, contract_google_signatures.request_url),
      web_view_url = COALESCE(EXCLUDED.web_view_url, contract_google_signatures.web_view_url),
      requested_by = COALESCE(EXCLUDED.requested_by, contract_google_signatures.requested_by),
      requested_by_email = COALESCE(EXCLUDED.requested_by_email, contract_google_signatures.requested_by_email),
      counterparty_name = COALESCE(EXCLUDED.counterparty_name, contract_google_signatures.counterparty_name),
      counterparty_email = COALESCE(EXCLUDED.counterparty_email, contract_google_signatures.counterparty_email),
      prepared_at = COALESCE(EXCLUDED.prepared_at, contract_google_signatures.prepared_at),
      sent_at = COALESCE(EXCLUDED.sent_at, contract_google_signatures.sent_at),
      signed_at = COALESCE(EXCLUDED.signed_at, contract_google_signatures.signed_at),
      declined_at = COALESCE(EXCLUDED.declined_at, contract_google_signatures.declined_at),
      last_opened_at = COALESCE(EXCLUDED.last_opened_at, contract_google_signatures.last_opened_at),
      last_synced_at = COALESCE(EXCLUDED.last_synced_at, contract_google_signatures.last_synced_at),
      signature_hash = COALESCE(EXCLUDED.signature_hash, contract_google_signatures.signature_hash),
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING *`,
    [
      existing?.id ?? crypto.randomUUID(),
      contractId,
      payload.status ?? existing?.status ?? 'not_started',
      payload.documentTitle ?? existing?.document_title ?? null,
      payload.driveSourceFileId ?? existing?.drive_source_file_id ?? null,
      payload.pdfSnapshotDriveFileId ?? existing?.pdf_snapshot_drive_file_id ?? null,
      payload.signedDriveFileId ?? existing?.signed_drive_file_id ?? null,
      payload.auditArtifactId ?? existing?.audit_artifact_id ?? null,
      payload.requestUrl ?? existing?.request_url ?? null,
      payload.webViewUrl ?? existing?.web_view_url ?? null,
      payload.requestedBy ?? existing?.requested_by ?? null,
      payload.requestedByEmail ?? existing?.requested_by_email ?? null,
      payload.counterpartyName ?? existing?.counterparty_name ?? null,
      payload.counterpartyEmail ?? existing?.counterparty_email ?? null,
      payload.preparedAt ?? existing?.prepared_at ?? null,
      payload.sentAt ?? existing?.sent_at ?? null,
      payload.signedAt ?? existing?.signed_at ?? null,
      payload.declinedAt ?? existing?.declined_at ?? null,
      payload.lastOpenedAt ?? existing?.last_opened_at ?? null,
      payload.lastSyncedAt ?? existing?.last_synced_at ?? null,
      payload.signatureHash ?? existing?.signature_hash ?? null,
      JSON.stringify(nextMetadata),
    ],
  );

  return result.rows[0];
}

function mapContractStatusFromSignature(status: string | null | undefined, existingStatus?: string | null) {
  switch (status) {
    case 'prepared':
    case 'not_started':
      return existingStatus && existingStatus !== 'pending_signatures' ? existingStatus : 'draft';
    case 'sent':
    case 'viewed':
    case 'changes_requested':
      return 'pending_signatures';
    case 'signed':
      return 'signed';
    case 'rejected':
      return 'rejected';
    default:
      return existingStatus ?? 'draft';
  }
}

function buildSignatureHash(contractId: string, signature: ContractGoogleSignatureRow) {
  return crypto
    .createHash('sha256')
    .update([
      contractId,
      readStringValue(signature.drive_source_file_id) ?? '',
      readStringValue(signature.signed_drive_file_id) ?? '',
      readStringValue(signature.counterparty_email) ?? '',
      readStringValue(signature.status) ?? '',
      signature.signed_at ?? '',
    ].join('|||'))
    .digest('hex');
}

async function syncContractRowFromSignature(
  pool: Pool,
  contractId: string,
  signature: ContractGoogleSignatureRow,
) {
  const contract = await getContractRow(pool, contractId);
  if (!contract) {
    throw new Error('Kontrakten finnes ikke lenger.');
  }

  const metadata = {
    ...readJsonObject(contract.metadata),
    googleSignature: {
      id: signature.id,
      status: signature.status ?? 'not_started',
      requestUrl: readStringValue(signature.request_url),
      webViewUrl: readStringValue(signature.web_view_url),
      driveSourceFileId: readStringValue(signature.drive_source_file_id),
      pdfSnapshotDriveFileId: readStringValue(signature.pdf_snapshot_drive_file_id),
      signedDriveFileId: readStringValue(signature.signed_drive_file_id),
      auditArtifactId: readStringValue(signature.audit_artifact_id),
      lastSyncedAt: signature.last_synced_at,
      signedAt: signature.signed_at,
      signatureHash: readStringValue(signature.signature_hash),
      requestedBy: readStringValue(signature.requested_by),
      requestedByEmail: readStringValue(signature.requested_by_email),
      counterpartyName: readStringValue(signature.counterparty_name),
      counterpartyEmail: readStringValue(signature.counterparty_email),
      metadata: readJsonObject(signature.metadata),
    },
  };

  const updateResult = await pool.query(
    `UPDATE contracts
     SET google_doc_id = COALESCE($2, google_doc_id),
         google_doc_url = COALESCE($3, google_doc_url),
         signature_status = $4,
         status = $5,
         signed_at = COALESCE($6, signed_at),
         signed_date = COALESCE($7, signed_date),
         signer_name = COALESCE($8, signer_name),
         signer_email = COALESCE($9, signer_email),
         metadata = $10::jsonb,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      contractId,
      readStringValue(signature.drive_source_file_id),
      readStringValue(signature.request_url) ?? readStringValue(signature.web_view_url),
      readStringValue(signature.status) ?? 'not_started',
      mapContractStatusFromSignature(readStringValue(signature.status), readStringValue(contract.status)),
      signature.signed_at,
      signature.signed_at,
      readStringValue(signature.counterparty_name),
      readStringValue(signature.counterparty_email),
      JSON.stringify(metadata),
    ],
  );

  return updateResult.rows[0] ?? contract;
}

export async function ensureContractsCompatibilitySchema(pool: Pool) {
  await ensureContractGoogleSigningSchema(pool);
}

export async function prepareContractGoogleESignature(
  pool: Pool,
  options: {
    contractId: string;
    preferredUserId?: string | null;
    requestedBy?: string | null;
    requestedByEmail?: string | null;
    sendNow?: boolean;
  },
) {
  await ensureContractGoogleSigningSchema(pool);

  const contract = await getContractRow(pool, options.contractId);
  if (!contract) {
    throw new Error('Kontrakt ikke funnet.');
  }

  const authorized = await resolveRoleRoomGoogleConnection(
    pool,
    options.preferredUserId ?? readStringValue(contract.user_id),
  );

  const driveApi = google.drive({ version: 'v3', auth: authorized.oauthClient });
  const docsApi = google.docs({ version: 'v1', auth: authorized.oauthClient });
  const layout = await ensureContractDriveLayout(pool, driveApi, contract);
  const existingSignature = await getContractGoogleSignatureRow(pool, options.contractId);

  const documentTitle =
    readStringValue(contract.contract_title)
    ?? readStringValue(contract.title)
    ?? `Kontrakt ${readStringValue(contract.contract_number) ?? options.contractId}`.trim();
  const metadata = readJsonObject(contract.metadata);
  const quoteBusinessInfo = readJsonObject(metadata.quoteBusinessInfo);
  const branding = await resolveDocumentBranding(
    pool,
    options.preferredUserId ?? readStringValue(contract.user_id) ?? 'default-user',
    {
      businessName: readStringValue(contract.organization_name) || readStringValue(quoteBusinessInfo.businessName),
      email: readStringValue(quoteBusinessInfo.email) || readStringValue(quoteBusinessInfo.contactEmail),
      phone: readStringValue(quoteBusinessInfo.phone),
      website: readStringValue(quoteBusinessInfo.website),
      businessAddress: readStringValue(quoteBusinessInfo.businessAddress),
      organizationNumber: readStringValue(contract.organization_number) || readStringValue(quoteBusinessInfo.organizationNumber),
      vatNumber: readStringValue(quoteBusinessInfo.vatNumber),
      tagline: readStringValue(quoteBusinessInfo.tagline),
      accentColor: readStringValue(quoteBusinessInfo.brandingColor),
      logoUrl: readStringValue(contract.logo_url) || readStringValue(quoteBusinessInfo.customLogo) || readStringValue(quoteBusinessInfo.logoUrl),
      businessDescription: readStringValue(quoteBusinessInfo.businessDescription),
      customFooterText: readStringValue(quoteBusinessInfo.customFooterText),
    },
  );

  let sourceFileId = readStringValue(existingSignature?.drive_source_file_id);
  let requestUrl = readStringValue(existingSignature?.request_url) ?? readStringValue(contract.google_doc_url);
  let webViewUrl = readStringValue(existingSignature?.web_view_url);
  let pdfSnapshotDriveFileId = readStringValue(existingSignature?.pdf_snapshot_drive_file_id);

  const createdDocument = await createContractGoogleDocument(
    docsApi,
    driveApi,
    contract,
    layout.contractFolderId,
    branding,
    sourceFileId || readStringValue(contract.google_doc_id),
  );
  sourceFileId = createdDocument.fileId;
  requestUrl = createdDocument.webViewUrl ?? createdDocument.webContentLink;
  webViewUrl = createdDocument.webViewUrl;

  const pdfSnapshot = await exportContractPdfToDrive(
    driveApi,
    sourceFileId,
    layout.contractFolderId,
    `${documentTitle} · grunnlag`,
    pdfSnapshotDriveFileId,
  );
  pdfSnapshotDriveFileId = pdfSnapshot.fileId;

  if (options.sendNow && readStringValue(contract.client_email) && sourceFileId) {
    await shareContractGoogleDocument(driveApi, sourceFileId, readStringValue(contract.client_email) as string);
  }

  const now = new Date().toISOString();
  const nextStatus = options.sendNow
    ? 'sent'
    : (
      (readStringValue(existingSignature?.status) === 'sent'
        || readStringValue(existingSignature?.status) === 'viewed'
        || readStringValue(existingSignature?.status) === 'signed')
        ? (readStringValue(existingSignature?.status) as ContractGoogleSignatureStatus)
        : 'prepared'
    );
  const signature = await upsertContractGoogleSignatureRow(pool, options.contractId, {
    status: nextStatus,
    documentTitle,
    driveSourceFileId: sourceFileId,
    pdfSnapshotDriveFileId,
    requestUrl,
    webViewUrl,
    requestedBy: options.requestedBy ?? options.preferredUserId ?? authorized.connection.userId,
    requestedByEmail: options.requestedByEmail ?? authorized.connection.googleEmail,
    counterpartyName: readStringValue(contract.client_name),
    counterpartyEmail: readStringValue(contract.client_email),
    preparedAt: existingSignature?.prepared_at ?? now,
    sentAt: options.sendNow ? now : existingSignature?.sent_at,
    lastSyncedAt: now,
    metadata: {
      rootFolderId: layout.rootFolderId,
      contractFolderId: layout.contractFolderId,
      signedFolderId: layout.signedFolderId,
      storedScopes: authorized.connection.storedScopes,
      missingScopes: CONTRACT_GOOGLE_REQUIRED_SCOPES.filter(
        (scope) => !authorized.connection.storedScopes.includes(scope),
      ),
      googleEmail: authorized.connection.googleEmail,
    },
  });

  const updatedContract = await syncContractRowFromSignature(pool, options.contractId, signature);

  return {
    contract: updatedContract,
    signature,
    connection: authorized.connection,
  };
}

export async function getContractGoogleESignature(
  pool: Pool,
  contractId: string,
) {
  await ensureContractGoogleSigningSchema(pool);
  const contract = await getContractRow(pool, contractId);
  const signature = await getContractGoogleSignatureRow(pool, contractId);
  return {
    contract,
    signature,
  };
}

export async function sendContractGoogleESignature(
  pool: Pool,
  options: {
    contractId: string;
    preferredUserId?: string | null;
    requestedBy?: string | null;
    requestedByEmail?: string | null;
  },
) {
  const prepared = await prepareContractGoogleESignature(pool, {
    ...options,
    sendNow: true,
  });
  return prepared;
}

export async function syncContractGoogleESignature(
  pool: Pool,
  options: {
    contractId: string;
    preferredUserId?: string | null;
  },
) {
  await ensureContractGoogleSigningSchema(pool);
  const contract = await getContractRow(pool, options.contractId);
  if (!contract) {
    throw new Error('Kontrakt ikke funnet.');
  }
  const signature = await getContractGoogleSignatureRow(pool, options.contractId);
  if (!signature) {
    return { contract, signature: null };
  }

  const authorized = await resolveRoleRoomGoogleConnection(
    pool,
    options.preferredUserId ?? readStringValue(contract.user_id),
  );
  const driveApi = google.drive({ version: 'v3', auth: authorized.oauthClient });
  const metadata = readJsonObject(signature.metadata);
  const signedFolderId = readStringValue(metadata.signedFolderId) ?? readStringValue(metadata.contractFolderId);

  let requestUrl = readStringValue(signature.request_url);
  let webViewUrl = readStringValue(signature.web_view_url);

  if (readStringValue(signature.drive_source_file_id)) {
    const fileResponse = await driveApi.files.get({
      fileId: readStringValue(signature.drive_source_file_id) as string,
      fields: 'id,webViewLink,webContentLink',
      supportsAllDrives: true,
    });
    requestUrl = readStringValue(fileResponse.data.webViewLink) ?? requestUrl;
    webViewUrl = readStringValue(fileResponse.data.webViewLink) ?? webViewUrl;
  }

  let signedDriveFileId = readStringValue(signature.signed_drive_file_id);
  if ((readStringValue(signature.status) === 'signed') && readStringValue(signature.drive_source_file_id) && signedFolderId) {
    const signedPdf = await exportContractPdfToDrive(
      driveApi,
      readStringValue(signature.drive_source_file_id) as string,
      signedFolderId,
      `${readStringValue(signature.document_title) ?? 'Kontrakt'} · signert`,
      signedDriveFileId,
    );
    signedDriveFileId = signedPdf.fileId;
  }

  const synced = await upsertContractGoogleSignatureRow(pool, options.contractId, {
    requestUrl,
    webViewUrl,
    signedDriveFileId,
    lastSyncedAt: new Date().toISOString(),
  });
  const updatedContract = await syncContractRowFromSignature(pool, options.contractId, synced);
  return {
    contract: updatedContract,
    signature: synced,
    connection: authorized.connection,
  };
}

export async function updateContractGoogleESignatureStatus(
  pool: Pool,
  options: {
    contractId: string;
    status: ContractGoogleSignatureStatus;
    preferredUserId?: string | null;
    signerName?: string | null;
    signerEmail?: string | null;
    requestUrl?: string | null;
    webViewUrl?: string | null;
  },
) {
  await ensureContractGoogleSigningSchema(pool);
  const contract = await getContractRow(pool, options.contractId);
  if (!contract) {
    throw new Error('Kontrakt ikke funnet.');
  }

  const existingSignature = await getContractGoogleSignatureRow(pool, options.contractId);
  if (!existingSignature) {
    await prepareContractGoogleESignature(pool, {
      contractId: options.contractId,
      preferredUserId: options.preferredUserId,
    });
  }

  const baseSignature = await getContractGoogleSignatureRow(pool, options.contractId);
  if (!baseSignature) {
    throw new Error('Kunne ikke opprette signatursporet for kontrakten.');
  }

  let signedDriveFileId = readStringValue(baseSignature.signed_drive_file_id);
  let signatureHash = readStringValue(baseSignature.signature_hash);
  const now = new Date().toISOString();

  if (options.status === 'signed' && readStringValue(baseSignature.drive_source_file_id)) {
    const authorized = await resolveRoleRoomGoogleConnection(
      pool,
      options.preferredUserId ?? readStringValue(contract.user_id),
    );
    const driveApi = google.drive({ version: 'v3', auth: authorized.oauthClient });
    const metadata = readJsonObject(baseSignature.metadata);
    const signedFolderId =
      readStringValue(metadata.signedFolderId)
      ?? readStringValue(metadata.contractFolderId)
      ?? (await ensureContractDriveLayout(pool, driveApi, contract)).signedFolderId;

    const signedPdf = await exportContractPdfToDrive(
      driveApi,
      readStringValue(baseSignature.drive_source_file_id) as string,
      signedFolderId,
      `${readStringValue(baseSignature.document_title) ?? 'Kontrakt'} · signert`,
      signedDriveFileId,
    );
    signedDriveFileId = signedPdf.fileId;
  }

  const updatedSignature = await upsertContractGoogleSignatureRow(pool, options.contractId, {
    status: options.status,
    counterpartyName: options.signerName ?? readStringValue(baseSignature.counterparty_name) ?? readStringValue(contract.client_name),
    counterpartyEmail: options.signerEmail ?? readStringValue(baseSignature.counterparty_email) ?? readStringValue(contract.client_email),
    requestUrl: options.requestUrl ?? readStringValue(baseSignature.request_url),
    webViewUrl: options.webViewUrl ?? readStringValue(baseSignature.web_view_url),
    sentAt: options.status === 'sent' ? now : baseSignature.sent_at,
    signedAt: options.status === 'signed' ? now : baseSignature.signed_at,
    declinedAt: options.status === 'rejected' ? now : baseSignature.declined_at,
    lastOpenedAt: options.status === 'viewed' ? now : baseSignature.last_opened_at,
    signedDriveFileId,
    lastSyncedAt: now,
  });

  if (options.status === 'signed') {
    signatureHash = buildSignatureHash(options.contractId, updatedSignature);
    await upsertContractGoogleSignatureRow(pool, options.contractId, {
      signatureHash,
    });
  }

  const finalSignature = await getContractGoogleSignatureRow(pool, options.contractId);
  if (!finalSignature) {
    throw new Error('Kunne ikke lagre signaturstatus.');
  }

  const updatedContract = await syncContractRowFromSignature(pool, options.contractId, finalSignature);

  return {
    contract: updatedContract,
    signature: finalSignature,
  };
}

export async function sendGoogleWorkspaceChatMessage(
  pool: Pool,
  options: {
    preferredUserId?: string | null;
    space: string;
    text: string;
  },
) {
  const authorized = await resolveRoleRoomGoogleConnection(pool, options.preferredUserId ?? null);
  const accessTokenResponse = await authorized.oauthClient.getAccessToken();
  const accessToken = typeof accessTokenResponse === 'string'
    ? accessTokenResponse
    : readStringValue(accessTokenResponse?.token);

  if (!accessToken) {
    throw new Error('Fant ikke tilgangstoken for Google Chat-sync.');
  }

  const normalizedSpace = options.space.startsWith('spaces/')
    ? options.space
    : `spaces/${options.space}`;
  const response = await fetch(`https://chat.googleapis.com/v1/${normalizedSpace}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: options.text,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Google Chat API svarte med ${response.status}: ${bodyText}`);
  }

  return response.json();
}
