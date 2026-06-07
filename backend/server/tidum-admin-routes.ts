import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type AdminSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
};

type RequireAdminSession = (
  req: Request,
  res: Response,
) => AdminSession | null;

type TidumAccessRequestSyncPayload = {
  requestId: number;
  fullName: string;
  email: string;
  orgNumber?: string | null;
  company?: string | null;
  phone?: string | null;
  message?: string | null;
  brregVerified?: boolean | null;
  institutionType?: string | null;
  status?: string | null;
  vendorId?: number | null;
  approvalRole?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TidumBrregAddress = {
  adresse?: string[];
  postnummer?: string;
  poststed?: string;
  kommune?: string;
};

type TidumBrregUnit = {
  organisasjonsnummer?: string;
  navn?: string;
  organisasjonsform?: {
    kode?: string;
    beskrivelse?: string;
  };
  enhetstype?: {
    kode?: string;
    beskrivelse?: string;
  };
  registreringsdatoEnhetsregisteret?: string;
  stiftelsesdato?: string;
  forretningsadresse?: TidumBrregAddress;
  postadresse?: TidumBrregAddress;
  naeringskode1?: {
    kode?: string;
    beskrivelse?: string;
  };
  antallAnsatte?: number;
  hjemmeside?: string;
  hjemmesideUrl?: string;
  registrertIMvaregisteret?: boolean;
  konkurs?: boolean;
  underAvvikling?: boolean;
};

type TidumBrregCompany = {
  organizationNumber: string;
  name: string;
  organizationForm: string;
  organizationFormCode: string | null;
  industry: string;
  industryCode: string | null;
  employees: number | null;
  website: string | null;
  registeredVat: boolean;
  bankrupt: boolean;
  underLiquidation: boolean;
  businessAddress: {
    addressLine: string;
    postalCode: string;
    city: string;
    municipality: string;
  };
  mailingAddress: {
    addressLine: string;
    postalCode: string;
    city: string;
    municipality: string;
  };
  source: "brreg";
  raw: TidumBrregUnit;
};

type TidumVendorRecord = {
  id: number;
  name: string;
  orgNumber: string | null;
  brregVerified: boolean;
};

const TIDUM_SYNC_API_BASE_URL =
  process.env.TIDUM_SYNC_API_BASE_URL?.trim() || "https://api.tidum.no";
const TIDUM_CREATORHUB_SYNC_SECRET =
  process.env.TIDUM_CREATORHUB_SYNC_SECRET?.trim() || "";
const BRREG_ENHETSREGISTERET_API_BASE_URL =
  "https://data.brreg.no/enhetsregisteret/api";
const BRREG_SEARCH_TIMEOUT_MS = 8_000;

let ensureTidumAccessRequestsTablePromise: Promise<void> | null = null;

function hasValidTidumSyncSecret(req: Request) {
  if (!TIDUM_CREATORHUB_SYNC_SECRET) {
    return false;
  }

  const providedSecret = req.header("x-tidum-sync-secret")?.trim();
  return Boolean(
    providedSecret && providedSecret === TIDUM_CREATORHUB_SYNC_SECRET,
  );
}

function normalizeTimestamp(value: unknown) {
  if (!value) return null;
  const date =
    value instanceof Date ? value : new Date(typeof value === "string" ? value : String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeOrgNumber(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function normalizeBrregAddress(address?: TidumBrregAddress) {
  return {
    addressLine: Array.isArray(address?.adresse)
      ? address.adresse.filter(Boolean).join(", ")
      : "",
    postalCode: address?.postnummer || "",
    city: address?.poststed || "",
    municipality: address?.kommune || "",
  };
}

function normalizeTidumBrregCompany(unit: TidumBrregUnit): TidumBrregCompany {
  return {
    organizationNumber: unit.organisasjonsnummer || "",
    name: unit.navn || "",
    organizationForm:
      unit.organisasjonsform?.beskrivelse || unit.enhetstype?.beskrivelse || "",
    organizationFormCode:
      unit.organisasjonsform?.kode || unit.enhetstype?.kode || null,
    industry: unit.naeringskode1?.beskrivelse || "",
    industryCode: unit.naeringskode1?.kode || null,
    employees:
      typeof unit.antallAnsatte === "number" && Number.isFinite(unit.antallAnsatte)
        ? unit.antallAnsatte
        : null,
    website: unit.hjemmeside || unit.hjemmesideUrl || null,
    registeredVat: Boolean(unit.registrertIMvaregisteret),
    bankrupt: Boolean(unit.konkurs),
    underLiquidation: Boolean(unit.underAvvikling),
    businessAddress: normalizeBrregAddress(unit.forretningsadresse),
    mailingAddress: normalizeBrregAddress(unit.postadresse),
    source: "brreg",
    raw: unit,
  };
}

function normalizeTidumVendorRecords(raw: unknown): TidumVendorRecord[] {
  const source = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).vendors)
      ? ((raw as Record<string, unknown>).vendors as unknown[])
      : raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).items)
        ? ((raw as Record<string, unknown>).items as unknown[])
        : [];

  return source
    .map((item) => {
      try {
        return normalizeTidumVendorRecord(item);
      } catch {
        return null;
      }
    })
    .filter((item): item is TidumVendorRecord => Boolean(item));
}

function normalizeTidumVendorRecord(raw: unknown): TidumVendorRecord {
  const record =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};
  const nested =
    record.vendor && typeof record.vendor === "object"
      ? (record.vendor as Record<string, unknown>)
      : record.record && typeof record.record === "object"
        ? (record.record as Record<string, unknown>)
        : record;
  const idValue = nested.id ?? nested.vendorId ?? nested.vendor_id;
  const id = Number(idValue);
  const name =
    typeof nested.name === "string"
      ? nested.name
      : typeof nested.vendorName === "string"
        ? nested.vendorName
        : typeof nested.companyName === "string"
          ? nested.companyName
          : typeof nested.company === "string"
            ? nested.company
            : "";
  const orgNumber =
    normalizeOrgNumber(nested.orgNumber) ||
    normalizeOrgNumber(nested.organizationNumber) ||
    normalizeOrgNumber(nested.org_number) ||
    null;

  if (!Number.isFinite(id) || !name.trim()) {
    throw new Error("Tidum returned an invalid vendor record");
  }

  return {
    id,
    name: name.trim(),
    orgNumber,
    brregVerified: Boolean(nested.brregVerified ?? nested.brreg_verified ?? orgNumber),
  };
}

function getBrregSearchLimit(value: unknown) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(Math.max(parsed, 1), 20);
}

function buildBrregSearchUrl(query: string, limit: number) {
  const organizationNumber = normalizeOrgNumber(query);

  if (organizationNumber.length === 9) {
    return `${BRREG_ENHETSREGISTERET_API_BASE_URL}/enheter/${organizationNumber}`;
  }

  const searchParams = new URLSearchParams({
    navn: query.trim(),
    size: String(limit),
  });
  return `${BRREG_ENHETSREGISTERET_API_BASE_URL}/enheter?${searchParams.toString()}`;
}

function normalizeBrregSearchPayload(
  query: string,
  payload: unknown,
): TidumBrregCompany[] {
  const organizationNumber = normalizeOrgNumber(query);

  if (organizationNumber.length === 9) {
    if (!payload || typeof payload !== "object") return [];
    const company = normalizeTidumBrregCompany(payload as TidumBrregUnit);
    return company.organizationNumber ? [company] : [];
  }

  const embedded =
    payload && typeof payload === "object"
      ? (payload as { _embedded?: { enheter?: TidumBrregUnit[] } })._embedded
      : null;
  const units = Array.isArray(embedded?.enheter) ? embedded.enheter : [];

  return units
    .map(normalizeTidumBrregCompany)
    .filter((company) => company.organizationNumber && company.name);
}

async function fetchBrregJson<T>(url: string): Promise<{ status: number; payload: T | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BRREG_SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CreatorHub Tidum Admin/1.0 (+https://creatorhub.no)",
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      return { status: response.status, payload: null };
    }

    if (!response.ok) {
      throw new Error(`BRREG request failed (${response.status})`);
    }

    return {
      status: response.status,
      payload: (await response.json()) as T,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractBrregCompanyFromRequest(body: unknown): TidumBrregCompany | null {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const companyRecord =
    record.company && typeof record.company === "object"
      ? (record.company as Record<string, unknown>)
      : record.brregCompany && typeof record.brregCompany === "object"
        ? (record.brregCompany as Record<string, unknown>)
        : record;
  const organizationNumber =
    normalizeOrgNumber(companyRecord.organizationNumber) ||
    normalizeOrgNumber(companyRecord.orgNumber) ||
    normalizeOrgNumber(companyRecord.organisasjonsnummer);
  const name =
    typeof companyRecord.name === "string"
      ? companyRecord.name.trim()
      : typeof companyRecord.navn === "string"
        ? companyRecord.navn.trim()
        : "";

  if (organizationNumber.length !== 9 || !name) {
    return null;
  }

  return {
    organizationNumber,
    name,
    organizationForm:
      typeof companyRecord.organizationForm === "string"
        ? companyRecord.organizationForm
        : "",
    organizationFormCode:
      typeof companyRecord.organizationFormCode === "string"
        ? companyRecord.organizationFormCode
        : null,
    industry:
      typeof companyRecord.industry === "string" ? companyRecord.industry : "",
    industryCode:
      typeof companyRecord.industryCode === "string"
        ? companyRecord.industryCode
        : null,
    employees:
      typeof companyRecord.employees === "number" && Number.isFinite(companyRecord.employees)
        ? companyRecord.employees
        : null,
    website:
      typeof companyRecord.website === "string" && companyRecord.website.trim()
        ? companyRecord.website.trim()
        : null,
    registeredVat: Boolean(companyRecord.registeredVat),
    bankrupt: Boolean(companyRecord.bankrupt),
    underLiquidation: Boolean(companyRecord.underLiquidation),
    businessAddress:
      companyRecord.businessAddress && typeof companyRecord.businessAddress === "object"
        ? {
          addressLine: String((companyRecord.businessAddress as Record<string, unknown>).addressLine || ""),
          postalCode: String((companyRecord.businessAddress as Record<string, unknown>).postalCode || ""),
          city: String((companyRecord.businessAddress as Record<string, unknown>).city || ""),
          municipality: String((companyRecord.businessAddress as Record<string, unknown>).municipality || ""),
        }
        : normalizeBrregAddress(),
    mailingAddress:
      companyRecord.mailingAddress && typeof companyRecord.mailingAddress === "object"
        ? {
          addressLine: String((companyRecord.mailingAddress as Record<string, unknown>).addressLine || ""),
          postalCode: String((companyRecord.mailingAddress as Record<string, unknown>).postalCode || ""),
          city: String((companyRecord.mailingAddress as Record<string, unknown>).city || ""),
          municipality: String((companyRecord.mailingAddress as Record<string, unknown>).municipality || ""),
        }
        : normalizeBrregAddress(),
    source: "brreg",
    raw:
      companyRecord.raw && typeof companyRecord.raw === "object"
        ? (companyRecord.raw as TidumBrregUnit)
        : {
          organisasjonsnummer: organizationNumber,
          navn: name,
        },
  };
}

function normalizeAccessRequestRecord(row: Record<string, unknown>) {
  return {
    requestId: Number(row.tidum_request_id),
    fullName: String(row.full_name || ""),
    email: String(row.email || ""),
    orgNumber:
      typeof row.org_number === "string" ? row.org_number : null,
    company: typeof row.company === "string" ? row.company : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    message: typeof row.message === "string" ? row.message : null,
    brregVerified: Boolean(row.brreg_verified),
    institutionType:
      typeof row.institution_type === "string" ? row.institution_type : null,
    status: typeof row.status === "string" ? row.status : "pending",
    vendorId:
      typeof row.vendor_id === "number"
        ? row.vendor_id
        : row.vendor_id == null
          ? null
          : Number(row.vendor_id),
    approvalRole:
      typeof row.approval_role === "string" ? row.approval_role : null,
    reviewedBy:
      typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewedAt: normalizeTimestamp(row.reviewed_at),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    lastSyncedAt: normalizeTimestamp(row.last_synced_at),
    sourcePayload:
      row.source_payload && typeof row.source_payload === "object"
        ? row.source_payload
        : null,
  };
}

async function ensureTidumAccessRequestsTable(pool: Pool) {
  if (!ensureTidumAccessRequestsTablePromise) {
    ensureTidumAccessRequestsTablePromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS tidum_access_requests (
          tidum_request_id INTEGER PRIMARY KEY,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL,
          org_number TEXT,
          company TEXT,
          phone TEXT,
          message TEXT,
          brreg_verified BOOLEAN DEFAULT false,
          institution_type TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          vendor_id INTEGER,
          approval_role TEXT,
          reviewed_by TEXT,
          reviewed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          source_payload JSONB DEFAULT '{}'::jsonb
        )
      `)
      .then(() => undefined);
  }

  await ensureTidumAccessRequestsTablePromise;
}

async function upsertTidumAccessRequest(
  pool: Pool,
  payload: TidumAccessRequestSyncPayload,
) {
  await ensureTidumAccessRequestsTable(pool);

  const { rows } = await pool.query(
    `
      INSERT INTO tidum_access_requests (
        tidum_request_id,
        full_name,
        email,
        org_number,
        company,
        phone,
        message,
        brreg_verified,
        institution_type,
        status,
        vendor_id,
        approval_role,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at,
        last_synced_at,
        source_payload
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, COALESCE($8, false), $9, COALESCE($10, 'pending'),
        $11, $12, $13, $14, COALESCE($15::timestamptz, NOW()), COALESCE($16::timestamptz, NOW()),
        NOW(), $17::jsonb
      )
      ON CONFLICT (tidum_request_id)
      DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        org_number = EXCLUDED.org_number,
        company = EXCLUDED.company,
        phone = EXCLUDED.phone,
        message = EXCLUDED.message,
        brreg_verified = EXCLUDED.brreg_verified,
        institution_type = EXCLUDED.institution_type,
        status = EXCLUDED.status,
        vendor_id = EXCLUDED.vendor_id,
        approval_role = EXCLUDED.approval_role,
        reviewed_by = EXCLUDED.reviewed_by,
        reviewed_at = EXCLUDED.reviewed_at,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        last_synced_at = NOW(),
        source_payload = EXCLUDED.source_payload
      RETURNING *
    `,
    [
      payload.requestId,
      payload.fullName,
      payload.email,
      payload.orgNumber ?? null,
      payload.company ?? null,
      payload.phone ?? null,
      payload.message ?? null,
      payload.brregVerified ?? false,
      payload.institutionType ?? null,
      payload.status ?? "pending",
      payload.vendorId ?? null,
      payload.approvalRole ?? null,
      payload.reviewedBy ?? null,
      payload.reviewedAt ?? null,
      payload.createdAt ?? null,
      payload.updatedAt ?? null,
      JSON.stringify(payload),
    ],
  );

  return normalizeAccessRequestRecord(rows[0]);
}

async function fetchFromTidum(pathname: string, init?: RequestInit) {
  if (!TIDUM_CREATORHUB_SYNC_SECRET) {
    throw new Error("TIDUM_CREATORHUB_SYNC_SECRET is not configured");
  }

  const response = await fetch(`${TIDUM_SYNC_API_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-tidum-sync-secret": TIDUM_CREATORHUB_SYNC_SECRET,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tidum sync failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export function registerTidumAdminRoutes(
  app: Express,
  pool: Pool,
  requireAdminSession: RequireAdminSession,
) {
  app.post("/api/admin/tidum-access-requests/sync", async (req, res) => {
    try {
      if (!hasValidTidumSyncSecret(req)) {
        return res.status(401).json({ error: "Unauthorized sync request" });
      }

      const payload = req.body as TidumAccessRequestSyncPayload;
      if (!payload || !Number.isFinite(Number(payload.requestId))) {
        return res.status(400).json({ error: "Invalid Tidum request payload" });
      }

      const record = await upsertTidumAccessRequest(pool, {
        ...payload,
        requestId: Number(payload.requestId),
      });
      res.json({ success: true, record });
    } catch (error) {
      console.error("Tidum access sync failed:", error);
      res.status(500).json({ error: "Could not sync Tidum access request" });
    }
  });

  app.get("/api/admin/tidum-access-requests", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      await ensureTidumAccessRequestsTable(pool);
      const statusFilter =
        typeof req.query.status === "string" ? req.query.status.trim() : "all";

      const query =
        statusFilter && statusFilter !== "all"
          ? `SELECT * FROM tidum_access_requests WHERE status = $1 ORDER BY created_at DESC`
          : `SELECT * FROM tidum_access_requests ORDER BY created_at DESC`;
      const params =
        statusFilter && statusFilter !== "all" ? [statusFilter] : [];

      const { rows } = await pool.query(query, params);
      res.json(rows.map(normalizeAccessRequestRecord));
    } catch (error) {
      console.error("Failed to fetch Tidum access requests:", error);
      res.status(500).json({ error: "Could not fetch Tidum access requests" });
    }
  });

  app.get("/api/admin/tidum/vendors", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      // Rotårsak: Tidum-integrasjonen krever TIDUM_CREATORHUB_SYNC_SECRET
      // som ikke alltid er satt i dev/preview. Uten den vil fetchFromTidum
      // kaste — så vi sjekker først og returnerer riktig formet tom liste
      // i stedet for å 500'e. Frontend (TidumAccessRequestsPanel) forventer
      // TidumVendor[] (array), ikke et objekt — så vi returnerer [] her.
      if (!TIDUM_CREATORHUB_SYNC_SECRET) {
        console.warn(
          "[tidum-admin] TIDUM_CREATORHUB_SYNC_SECRET er ikke konfigurert; " +
            "returnerer tom vendors-liste. Sett env-varen for å aktivere " +
            "Tidum-integrasjonen mot " + TIDUM_SYNC_API_BASE_URL + ".",
        );
        return res.json([]);
      }

      try {
        const vendors = await fetchFromTidum(
          "/api/internal/creatorhub/vendors",
        );
        const normalized = normalizeTidumVendorRecords(vendors);
        // Frontend (TidumAccessRequestsPanel) forventer TidumVendor[].
        res.json(normalized);
      } catch (innerErr) {
        // Den eksterne Tidum-APIen kan være nede / 401 / 5xx. Returner
        // tom liste i riktig form for at AdminDashboard skal rendre i
        // stedet for å vise generic 500-error, men logg som warn for
        // synlighet i drift.
        console.warn(
          "[tidum-admin] vendors-fetch mot Tidum feilet, returnerer tom liste:",
          innerErr instanceof Error ? innerErr.message : innerErr,
        );
        res.json([]);
      }
    } catch (error) {
      console.error("Failed to fetch Tidum vendors:", error);
      res.status(500).json({ error: "Could not fetch Tidum vendors" });
    }
  });

  app.get("/api/admin/tidum/brreg-search", async (req, res) => {
    try {
      if (!requireAdminSession(req, res)) {
        return;
      }

      const query =
        typeof req.query.q === "string"
          ? req.query.q.trim()
          : typeof req.query.query === "string"
            ? req.query.query.trim()
            : "";
      const organizationNumber = normalizeOrgNumber(query);
      const numericOnlyQuery = query.replace(/[\s.-]/g, "");

      if (!query || (organizationNumber.length !== 9 && query.length < 3)) {
        return res.json({ items: [] });
      }

      if (
        numericOnlyQuery &&
        /^\d+$/.test(numericOnlyQuery) &&
        organizationNumber.length !== 9
      ) {
        return res.status(400).json({
          error: "Organisasjonsnummer må ha 9 siffer",
        });
      }

      const limit = getBrregSearchLimit(req.query.limit);
      const { payload } = await fetchBrregJson<unknown>(
        buildBrregSearchUrl(query, limit),
      );

      res.json({
        items: normalizeBrregSearchPayload(query, payload),
      });
    } catch (error) {
      console.error("Tidum BRREG lookup failed:", error);
      res.status(502).json({
        error: "Kunne ikke søke i Brønnøysundregistrene akkurat nå",
      });
    }
  });

  app.post("/api/admin/tidum/vendors", async (req, res) => {
    try {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) {
        return;
      }

      const company = extractBrregCompanyFromRequest(req.body);
      if (!company) {
        return res.status(400).json({
          error: "Velg en gyldig BRREG-bedrift med navn og 9-sifret organisasjonsnummer",
        });
      }

      const createdVendor = await fetchFromTidum(
        "/api/internal/creatorhub/vendors",
        {
          method: "POST",
          body: JSON.stringify({
            name: company.name,
            orgNumber: company.organizationNumber,
            organizationNumber: company.organizationNumber,
            brregVerified: true,
            source: "creatorhub-brreg",
            createdBy: adminSession.email,
            brregCompany: {
              organizationNumber: company.organizationNumber,
              name: company.name,
              organizationForm: company.organizationForm,
              organizationFormCode: company.organizationFormCode,
              industry: company.industry,
              industryCode: company.industryCode,
              employees: company.employees,
              website: company.website,
              registeredVat: company.registeredVat,
              bankrupt: company.bankrupt,
              underLiquidation: company.underLiquidation,
              businessAddress: company.businessAddress,
              mailingAddress: company.mailingAddress,
            },
          }),
        },
      );

      res.status(201).json(normalizeTidumVendorRecord(createdVendor));
    } catch (error) {
      console.error("Failed to create Tidum vendor from BRREG:", error);
      res.status(502).json({
        error: "Kunne ikke opprette leverandør i Tidum fra BRREG-data",
      });
    }
  });

  app.patch("/api/admin/tidum-access-requests/:requestId", async (req, res) => {
    try {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) {
        return;
      }

      const requestId = Number.parseInt(String(req.params.requestId), 10);
      if (!Number.isFinite(requestId)) {
        return res.status(400).json({ error: "Invalid request id" });
      }

      const status =
        req.body?.status === "approved" || req.body?.status === "rejected"
          ? req.body.status
          : null;
      if (!status) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updatedRemoteRequest = await fetchFromTidum(
        `/api/internal/creatorhub/access-requests/${requestId}/status`,
        {
          method: "POST",
          body: JSON.stringify({
            status,
            vendorId: req.body?.vendorId ?? null,
            role: typeof req.body?.role === "string" ? req.body.role : null,
            reviewedBy: adminSession.email,
          }),
        },
      );

      const record = await upsertTidumAccessRequest(pool, {
        requestId,
        fullName: updatedRemoteRequest.fullName,
        email: updatedRemoteRequest.email,
        orgNumber: updatedRemoteRequest.orgNumber ?? null,
        company: updatedRemoteRequest.company ?? null,
        phone: updatedRemoteRequest.phone ?? null,
        message: updatedRemoteRequest.message ?? null,
        brregVerified: updatedRemoteRequest.brregVerified ?? false,
        institutionType: updatedRemoteRequest.institutionType ?? null,
        status: updatedRemoteRequest.status ?? status,
        vendorId: updatedRemoteRequest.vendorId ?? null,
        approvalRole:
          typeof req.body?.role === "string" ? req.body.role : null,
        reviewedBy: adminSession.email,
        reviewedAt: updatedRemoteRequest.reviewedAt ?? new Date().toISOString(),
        createdAt: updatedRemoteRequest.createdAt ?? null,
        updatedAt: updatedRemoteRequest.updatedAt ?? new Date().toISOString(),
      });

      res.json(record);
    } catch (error) {
      console.error("Failed to update Tidum access request:", error);
      res.status(500).json({ error: "Could not update Tidum access request" });
    }
  });
}
