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

const TIDUM_SYNC_API_BASE_URL =
  process.env.TIDUM_SYNC_API_BASE_URL?.trim() || "https://api.tidum.no";
const TIDUM_CREATORHUB_SYNC_SECRET =
  process.env.TIDUM_CREATORHUB_SYNC_SECRET?.trim() || "";

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

      const vendors = await fetchFromTidum("/api/internal/creatorhub/vendors");
      res.json(vendors);
    } catch (error) {
      console.error("Failed to fetch Tidum vendors:", error);
      res.status(500).json({ error: "Could not fetch Tidum vendors" });
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
