import crypto from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthoritativeSession, AuthoritativeSessionResolution } from "./workspace-project-participants-routes.js";
import {
  CREATORHUB_ENTERPRISE_FEATURES,
  resolveCreatorHubEnterpriseAccess,
  sendCreatorHubEnterpriseError,
  type CreatorHubEnterpriseAccess,
} from "./creatorhub-enterprise-access.js";
import { assertPublicUrlResolved } from "./ssrf-guard.js";

export interface CreatorHubVendorProductsRoutesDeps {
  app: Express;
  pool: Pool;
  resolveAuthoritativeSessionFromRequest: (req: Request) => Promise<AuthoritativeSessionResolution>;
  validateWebhookUrl?: (url: string) => Promise<URL>;
}

type VendorScope = "products:read" | "products:write" | "inventory:read" | "inventory:write" | "webhooks:manage";
type ApiPrincipal = { organizationId: string; keyId: string; createdBy: string; scopes: VendorScope[]; rateLimitPerMinute: number };

class VendorError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) { super(message); }
}

const organizationSchema = z.object({ organizationId: z.string().trim().max(255).optional() }).passthrough();
const productObject = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,119}$/).optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  productType: z.enum(["physical", "digital", "service"]).default("physical"),
  category: z.string().trim().min(1).max(100).default("all"),
  sku: z.string().trim().max(100).nullable().optional(),
  version: z.string().trim().min(1).max(40).default("1.0.0"),
  price: z.number().finite().min(0).max(100_000_000).optional(),
  priceAmount: z.number().finite().min(0).max(100_000_000).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("NOK"),
  stockQuantity: z.number().int().min(0).nullable().optional(),
  trackInventory: z.boolean().default(false),
  status: z.enum(["draft", "pending", "active", "inactive", "archived"]).default("draft"),
  imageUrl: z.string().url().max(2_000).nullable().optional(),
  imageUrls: z.array(z.string().url().max(2_000)).max(30).optional(),
  images: z.array(z.string().url().max(2_000)).max(30).optional(),
  tags: z.union([z.array(z.string().trim().min(1).max(80)).max(50), z.string().max(2_000)]).default([]),
  metadata: z.record(z.unknown()).default({}),
  vendorId: z.string().trim().max(255).optional(),
  vendorType: z.string().trim().max(100).optional(),
  organizationId: z.string().trim().max(255).optional(),
}).strict();
const validateProductConsistency = (value: z.infer<typeof productObject>, ctx: z.RefinementCtx) => {
  if (value.trackInventory && value.stockQuantity == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["stockQuantity"], message: "Lagerantall kreves når lagerstyring er aktivert." });
  }
  if (Buffer.byteLength(JSON.stringify(value.metadata), "utf8") > 65_536) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["metadata"], message: "Metadata er for stor." });
  }
};
const productInput = productObject.superRefine(validateProductConsistency);
const productPatch = productObject.partial().extend({ revision: z.number().int().positive().optional() }).strict();
const externalProductPatch = productObject.partial().extend({ revision: z.number().int().positive() }).strict();
const inventoryPatch = z.object({ stockQuantity: z.number().int().min(0), revision: z.number().int().positive() }).strict();
const keyInput = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.enum(["products:read","products:write","inventory:read","inventory:write","webhooks:manage"])).min(1).max(5),
  rateLimitPerMinute: z.number().int().min(10).max(5_000).default(120),
  expiresAt: z.string().datetime().nullable().optional(),
  organizationId: z.string().trim().max(255).optional(),
}).strict();
const webhookInput = z.object({
  url: z.string().url().max(2_000),
  events: z.array(z.enum(["product.created","product.updated","product.published","product.archived","inventory.updated"])).min(1).max(5),
}).strict();
const externalList = z.object({
  cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["draft","active","inactive","archived"]).optional(), category: z.string().trim().max(100).optional(),
}).passthrough();

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const tags = (value: string[] | string): string[] => Array.isArray(value)
  ? [...new Set(value.map((item) => item.trim()).filter(Boolean))]
  : [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
const images = (value: { imageUrl?: string | null; imageUrls?: string[]; images?: string[] }): string[] =>
  [...new Set([...(value.imageUrls || []), ...(value.images || []), ...(value.imageUrl ? [value.imageUrl] : [])])];
const status = (value: string) => value === "pending" ? "draft" : value;
const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "product";
const iso = (value: unknown) => new Date(String(value)).toISOString();

export function mapCreatorHubVendorProduct(row: any, legacyUi = false) {
  const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : [];
  const productStatus = String(row.status);
  return {
    id: String(row.id), slug: String(row.slug), name: String(row.name), vendor: String(row.owner_user_id),
    description: row.description || "", productType: String(row.product_type), category: String(row.category),
    sku: row.sku || null, version: String(row.version), price: Number(row.price_amount), priceAmount: Number(row.price_amount),
    currency: String(row.currency), stockQuantity: row.stock_quantity == null ? null : Number(row.stock_quantity),
    trackInventory: row.track_inventory === true,
    status: legacyUi && productStatus === "draft" ? "pending" : productStatus,
    imageUrls, images: imageUrls, imageUrl: imageUrls[0] || undefined,
    tags: Array.isArray(row.tags) ? row.tags : [], metadata: row.metadata || {}, revision: Number(row.revision || 1),
    downloads: 0, rating: 0, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
  };
}

async function sessionFor(deps: CreatorHubVendorProductsRoutesDeps, req: Request, res: Response): Promise<AuthoritativeSession | null> {
  const result = await deps.resolveAuthoritativeSessionFromRequest(req).catch(() => ({ status: "unavailable" as const }));
  if (result.status === "unavailable") { res.status(503).json({ error: "authentication_unavailable" }); return null; }
  if (result.status !== "authenticated") { res.status(401).json({ error: "auth_required" }); return null; }
  return result.session;
}
async function internalAccess(deps: CreatorHubVendorProductsRoutesDeps, req: Request, res: Response, admin = false) {
  const session = await sessionFor(deps, req, res); if (!session) return null;
  try {
    const requested = typeof req.body?.organizationId === "string" ? req.body.organizationId : typeof req.query?.organizationId === "string" ? req.query.organizationId : undefined;
    const access = await resolveCreatorHubEnterpriseAccess(deps.pool, { userId: session.userId, organizationId: requested, featureId: CREATORHUB_ENTERPRISE_FEATURES.vendorProducts });
    if (!access.canWrite) throw new VendorError(403, "vendor_write_required", "Du har ikke skrivetilgang til produktkatalogen.");
    if (admin && !access.canAdminister) throw new VendorError(403, "vendor_admin_required", "Bare Enterprise-administratorer kan administrere API-tilgang.");
    return { session, access };
  } catch (error) { sendError(res, error); return null; }
}
async function tx<T>(pool: Pool, work: (db: PoolClient) => Promise<T>) { const db = await pool.connect(); try { await db.query("BEGIN"); const result = await work(db); await db.query("COMMIT"); return result; } catch (error) { await db.query("ROLLBACK").catch(() => undefined); throw error; } finally { db.release(); } }
function invalid(res: Response, parsed: z.SafeParseError<unknown>) { res.status(400).json({ error: "validation_error", details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }); }
function sendError(res: Response, error: unknown) {
  if (error instanceof VendorError) { res.status(error.statusCode).json({ error: error.code, message: error.message }); return; }
  const code = String((error as { code?: string })?.code || "");
  if (code === "23505") { res.status(409).json({ error: "vendor_product_conflict", message: "Sluggen, SKU-en eller idempotensverdien finnes allerede." }); return; }
  if (["23503","23514"].includes(code)) { res.status(409).json({ error: "vendor_product_integrity_conflict" }); return; }
  sendCreatorHubEnterpriseError(res, error);
}
async function uniqueSlug(db: Pick<Pool,"query"> | Pick<PoolClient,"query">, organizationId: string, input: string, excludedId?: string) {
  const root = slugify(input); let candidate = root;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const exists = await db.query(`SELECT 1 FROM creatorhub_vendor_products WHERE organization_id=$1 AND slug=$2 AND ($3::uuid IS NULL OR id<>$3)`, [organizationId, candidate, excludedId || null]);
    if (!exists.rowCount) return candidate;
    candidate = `${root.slice(0, 108)}-${crypto.randomBytes(3).toString("hex")}`;
  }
  throw new VendorError(409, "slug_unavailable", "Kunne ikke opprette en unik produktslug.");
}
async function emit(db: PoolClient, organizationId: string, eventType: string, row: any) {
  await db.query(`INSERT INTO creatorhub_vendor_outbox (organization_id,event_type,aggregate_id,payload) VALUES ($1,$2,$3,$4::jsonb)`, [organizationId, eventType, row.id, JSON.stringify(mapCreatorHubVendorProduct(row))]);
}
async function insertProduct(db: PoolClient, organizationId: string, ownerUserId: string, input: z.infer<typeof productInput>) {
  const productSlug = await uniqueSlug(db, organizationId, input.slug || input.name);
  const result = await db.query(
    `INSERT INTO creatorhub_vendor_products
       (organization_id,owner_user_id,slug,name,description,product_type,category,sku,version,price_amount,currency,stock_quantity,track_inventory,status,image_urls,tags,metadata,published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,CASE WHEN $14='active' THEN NOW() ELSE NULL END) RETURNING *`,
    [organizationId, ownerUserId, productSlug, input.name, input.description || null, input.productType, input.category, input.sku || null, input.version, input.priceAmount ?? input.price ?? 0, input.currency, input.stockQuantity ?? null, input.trackInventory, status(input.status), JSON.stringify(images(input)), JSON.stringify(tags(input.tags)), JSON.stringify({ ...input.metadata, ...(input.vendorType ? { vendorType: input.vendorType } : {}) })],
  );
  await emit(db, organizationId, "product.created", result.rows[0]);
  return result.rows[0];
}

async function apiPrincipal(pool: Pool, req: Request): Promise<ApiPrincipal> {
  const authorization = String(req.headers.authorization || "");
  const raw = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : String(req.headers["x-creatorhub-key"] || "").trim();
  if (!raw.startsWith("chv_live_") || raw.length < 30) throw new VendorError(401, "invalid_api_key", "Ugyldig API-nøkkel.");
  const result = await pool.query(
    `UPDATE creatorhub_vendor_api_keys key SET last_used_at=NOW()
       FROM creatorhub_enterprise_entitlements entitlement
       JOIN enterprise_feature_permissions permission
         ON permission.organization_id=entitlement.organization_id
        AND permission.feature_id='vendor-product-api'
       LEFT JOIN enterprise_organization_settings settings
         ON settings.organization_id=entitlement.organization_id
      WHERE key.key_hash=$1 AND key.revoked_at IS NULL AND (key.expires_at IS NULL OR key.expires_at>NOW())
        AND entitlement.organization_id=key.organization_id AND entitlement.status IN ('active','grace')
        AND (entitlement.valid_until IS NULL OR entitlement.valid_until>NOW())
        AND permission.permission_level<>'disabled'
        AND NOT ('vendor-product-api'=ANY(COALESCE(settings.disabled_features,ARRAY[]::text[])))
      RETURNING key.id,key.organization_id,key.created_by,key.scopes,key.rate_limit_per_minute`, [sha256(raw)],
  );
  const row = result.rows[0]; if (!row) throw new VendorError(401, "invalid_api_key", "API-nøkkelen er ugyldig, utløpt eller tilbakekalt.");
  const rate = await pool.query(
    `WITH pruned AS (
       DELETE FROM creatorhub_vendor_api_rate_limits WHERE key_id=$1 AND window_start<NOW()-INTERVAL '2 days'
     )
     INSERT INTO creatorhub_vendor_api_rate_limits (key_id,window_start,request_count)
     VALUES ($1,date_trunc('minute',NOW()),1)
     ON CONFLICT (key_id,window_start) DO UPDATE SET request_count=creatorhub_vendor_api_rate_limits.request_count+1
     RETURNING request_count`, [row.id],
  );
  if (Number(rate.rows[0]?.request_count || 0) > Number(row.rate_limit_per_minute)) {
    throw new VendorError(429, "api_rate_limit_exceeded", "API-nøkkelens minuttgrense er nådd.");
  }
  return { organizationId: String(row.organization_id), keyId: String(row.id), createdBy: String(row.created_by), scopes: row.scopes as VendorScope[], rateLimitPerMinute: Number(row.rate_limit_per_minute) };
}
function requireScope(principal: ApiPrincipal, scope: VendorScope) { if (!principal.scopes.includes(scope)) throw new VendorError(403, "api_scope_required", `API-nøkkelen mangler ${scope}.`); }
async function externalAuth(pool: Pool, req: Request, res: Response, scope: VendorScope): Promise<ApiPrincipal | null> { try { const principal = await apiPrincipal(pool, req); requireScope(principal, scope); return principal; } catch (error) { sendError(res, error); return null; } }

function encryptionKey() {
  const raw = process.env.VENDOR_WEBHOOK_ENCRYPTION_KEY || "";
  if (!raw) throw new VendorError(503, "webhook_encryption_unavailable", "Webhook-kryptering er ikke konfigurert.");
  return crypto.createHash("sha256").update(raw).digest();
}
function encryptSecret(secret: string) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv); const encrypted = Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]); return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`; }

export function setupCreatorHubVendorProductsRoutes(deps: CreatorHubVendorProductsRoutesDeps): void {
  const { app, pool } = deps;
  const externalLimit = rateLimit({ windowMs: 60_000, limit: 5_000, standardHeaders: true, legacyHeaders: false });

  app.get("/api/vendor/products/:userId", async (req, res) => {
    const query = organizationSchema.safeParse(req.query); if (!query.success) return invalid(res, query);
    const auth = await internalAccess(deps, req, res); if (!auth) return;
    if (req.params.userId !== auth.session.userId) return res.status(404).json({ error: "vendor_products_not_found" });
    try {
      const vendorType = typeof req.query.vendorType === "string" ? req.query.vendorType : null;
      const result = await pool.query(`SELECT * FROM creatorhub_vendor_products WHERE organization_id=$1 AND status<>'archived' AND ($2::text IS NULL OR metadata->>'vendorType'=$2) ORDER BY updated_at DESC`, [auth.access.organizationId, vendorType]);
      res.setHeader("Cache-Control", "private, no-store"); res.json(result.rows.map((row) => mapCreatorHubVendorProduct(row, true)));
    } catch (error) { sendError(res, error); }
  });

  app.get("/api/vendor/analytics/:userId", async (req, res) => {
    const auth = await internalAccess(deps, req, res); if (!auth) return;
    if (req.params.userId !== auth.session.userId) return res.status(404).json({ error: "vendor_analytics_not_found" });
    try { const result = await pool.query(`SELECT COUNT(*) FILTER (WHERE status<>'archived')::int AS total_products,COALESCE(SUM(price_amount) FILTER (WHERE status='active'),0) AS active_catalog_value FROM creatorhub_vendor_products WHERE organization_id=$1`, [auth.access.organizationId]); res.json({ totalProducts: Number(result.rows[0]?.total_products || 0), activeCatalogValue: Number(result.rows[0]?.active_catalog_value || 0), totalDownloads: 0, totalRevenue: 0, averageRating: 0 }); } catch (error) { sendError(res, error); }
  });

  app.post("/api/vendor/products", async (req, res) => {
    const body = productInput.safeParse(req.body); if (!body.success) return invalid(res, body);
    const auth = await internalAccess(deps, req, res); if (!auth) return;
    if (body.data.vendorId && body.data.vendorId !== auth.session.userId) return res.status(403).json({ error: "vendor_owner_mismatch" });
    try { const row = await tx(pool, (db) => insertProduct(db, auth.access.organizationId, auth.session.userId, body.data)); res.status(201).json(mapCreatorHubVendorProduct(row, true)); } catch (error) { sendError(res, error); }
  });

  const updateInternal = async (req: Request, res: Response) => {
    const body = productPatch.safeParse(req.body); if (!body.success) return invalid(res, body);
    const auth = await internalAccess(deps, req, res); if (!auth) return;
    try {
      const row = await tx(pool, async (db) => {
        const current = await db.query(`SELECT * FROM creatorhub_vendor_products WHERE id=$1 AND organization_id=$2 AND status<>'archived' FOR UPDATE`, [req.params.id, auth.access.organizationId]);
        if (!current.rows[0]) throw new VendorError(404, "vendor_product_not_found", "Produktet finnes ikke.");
        if (body.data.revision && Number(current.rows[0].revision) !== body.data.revision) throw new VendorError(409, "product_revision_conflict", "Produktet er endret av noen andre.");
        const merged = { ...mapCreatorHubVendorProduct(current.rows[0]), ...body.data } as any;
        const nextSlug = body.data.slug || body.data.name ? await uniqueSlug(db, auth.access.organizationId, body.data.slug || body.data.name || merged.name, req.params.id) : current.rows[0].slug;
        const nextImages = body.data.imageUrl !== undefined || body.data.imageUrls || body.data.images ? images(body.data) : current.rows[0].image_urls;
        const nextTags = body.data.tags !== undefined ? tags(body.data.tags) : current.rows[0].tags;
        const nextStatus = status(body.data.status || String(current.rows[0].status));
        const updated = await db.query(`UPDATE creatorhub_vendor_products SET slug=$3,name=$4,description=$5,product_type=$6,category=$7,sku=$8,version=$9,price_amount=$10,currency=$11,stock_quantity=$12,track_inventory=$13,status=$14,image_urls=$15::jsonb,tags=$16::jsonb,metadata=$17::jsonb,revision=revision+1,updated_at=NOW(),published_at=CASE WHEN $14='active' THEN COALESCE(published_at,NOW()) ELSE published_at END WHERE id=$1 AND organization_id=$2 RETURNING *`, [req.params.id, auth.access.organizationId, nextSlug, body.data.name ?? current.rows[0].name, body.data.description !== undefined ? body.data.description : current.rows[0].description, body.data.productType ?? current.rows[0].product_type, body.data.category ?? current.rows[0].category, body.data.sku !== undefined ? body.data.sku : current.rows[0].sku, body.data.version ?? current.rows[0].version, body.data.priceAmount ?? body.data.price ?? Number(current.rows[0].price_amount), body.data.currency ?? current.rows[0].currency, body.data.stockQuantity !== undefined ? body.data.stockQuantity : current.rows[0].stock_quantity, body.data.trackInventory ?? current.rows[0].track_inventory, nextStatus, JSON.stringify(nextImages), JSON.stringify(nextTags), JSON.stringify(body.data.metadata ?? current.rows[0].metadata)]);
        await emit(db, auth.access.organizationId, nextStatus === "active" && current.rows[0].status !== "active" ? "product.published" : "product.updated", updated.rows[0]); return updated.rows[0];
      });
      res.json(mapCreatorHubVendorProduct(row, true));
    } catch (error) { sendError(res, error); }
  };
  app.put("/api/vendor/products/:id", updateInternal); app.patch("/api/vendor/products/:id", updateInternal);

  app.delete("/api/vendor/products/:id", async (req, res) => {
    const auth = await internalAccess(deps, req, res); if (!auth) return;
    try { await tx(pool, async (db) => { const result = await db.query(`UPDATE creatorhub_vendor_products SET status='archived',archived_at=NOW(),updated_at=NOW(),revision=revision+1 WHERE id=$1 AND organization_id=$2 AND status<>'archived' RETURNING *`, [req.params.id, auth.access.organizationId]); if (!result.rows[0]) throw new VendorError(404,"vendor_product_not_found","Produktet finnes ikke."); await emit(db, auth.access.organizationId,"product.archived",result.rows[0]); }); res.status(204).end(); } catch (error) { sendError(res,error); }
  });
  for (const action of ["publish","unpublish"] as const) app.post(`/api/vendor/products/:id/${action}`, async (req,res) => {
    const auth = await internalAccess(deps,req,res); if (!auth) return;
    try { const row = await tx(pool, async (db) => { const result = await db.query(`UPDATE creatorhub_vendor_products SET status=$3,updated_at=NOW(),revision=revision+1,published_at=CASE WHEN $3='active' THEN COALESCE(published_at,NOW()) ELSE published_at END WHERE id=$1 AND organization_id=$2 AND status<>'archived' RETURNING *`, [req.params.id,auth.access.organizationId,action === "publish" ? "active" : "inactive"]); if (!result.rows[0]) throw new VendorError(404,"vendor_product_not_found","Produktet finnes ikke."); await emit(db,auth.access.organizationId,action === "publish" ? "product.published" : "product.updated",result.rows[0]); return result.rows[0]; }); res.json(mapCreatorHubVendorProduct(row, true)); } catch (error) { sendError(res,error); }
  });

  app.get("/api/vendor/api-keys", async (req,res) => { const auth = await internalAccess(deps,req,res,true); if (!auth) return; try { const result = await pool.query(`SELECT id,name,key_prefix,scopes,rate_limit_per_minute,created_at,last_used_at,expires_at,revoked_at FROM creatorhub_vendor_api_keys WHERE organization_id=$1 ORDER BY created_at DESC`,[auth.access.organizationId]); res.json({ keys: result.rows.map((row) => ({ id:String(row.id),name:String(row.name),prefix:String(row.key_prefix),scopes:row.scopes,rateLimitPerMinute:Number(row.rate_limit_per_minute),createdAt:iso(row.created_at),lastUsedAt:row.last_used_at?iso(row.last_used_at):null,expiresAt:row.expires_at?iso(row.expires_at):null,revokedAt:row.revoked_at?iso(row.revoked_at):null })) }); } catch(error){sendError(res,error);} });
  app.post("/api/vendor/api-keys", async (req,res) => { const body=keyInput.safeParse(req.body); if(!body.success)return invalid(res,body); const auth=await internalAccess(deps,req,res,true); if(!auth)return; try { const raw=`chv_live_${crypto.randomBytes(32).toString("base64url")}`; const result=await pool.query(`INSERT INTO creatorhub_vendor_api_keys (organization_id,name,key_prefix,key_hash,scopes,rate_limit_per_minute,created_by,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,created_at`,[auth.access.organizationId,body.data.name,raw.slice(0,18),sha256(raw),body.data.scopes,body.data.rateLimitPerMinute,auth.session.userId,body.data.expiresAt||null]); res.status(201).json({id:String(result.rows[0].id),name:body.data.name,key:raw,prefix:raw.slice(0,18),scopes:body.data.scopes,createdAt:iso(result.rows[0].created_at),notice:"Nøkkelen vises bare denne ene gangen."}); } catch(error){sendError(res,error);} });
  app.delete("/api/vendor/api-keys/:id", async (req,res) => { const auth=await internalAccess(deps,req,res,true); if(!auth)return; try { const result=await pool.query(`UPDATE creatorhub_vendor_api_keys SET revoked_at=NOW() WHERE id=$1 AND organization_id=$2 AND revoked_at IS NULL RETURNING id`,[req.params.id,auth.access.organizationId]); if(!result.rows[0])throw new VendorError(404,"api_key_not_found","API-nøkkelen finnes ikke."); res.status(204).end(); } catch(error){sendError(res,error);} });

  app.get("/api/v1/vendor/products", externalLimit, async (req,res) => { const query=externalList.safeParse(req.query); if(!query.success)return invalid(res,query); const principal=await externalAuth(pool,req,res,"products:read"); if(!principal)return; try { const result=await pool.query(`SELECT * FROM creatorhub_vendor_products WHERE organization_id=$1 AND status<>'archived' AND ($2::uuid IS NULL OR id<$2) AND ($3::text IS NULL OR status=$3) AND ($4::text IS NULL OR category=$4) ORDER BY id DESC LIMIT $5`,[principal.organizationId,query.data.cursor||null,query.data.status||null,query.data.category||null,query.data.limit+1]); const hasMore=result.rows.length>query.data.limit; const rows=result.rows.slice(0,query.data.limit); res.json({data:rows.map((row) => mapCreatorHubVendorProduct(row)),pagination:{hasMore,nextCursor:hasMore?String(rows.at(-1)?.id):null,limit:query.data.limit}}); } catch(error){sendError(res,error);} });
  app.get("/api/v1/vendor/products/:id", externalLimit, async (req,res) => { const principal=await externalAuth(pool,req,res,"products:read"); if(!principal)return; try { const result=await pool.query(`SELECT * FROM creatorhub_vendor_products WHERE id=$1 AND organization_id=$2 AND status<>'archived'`,[req.params.id,principal.organizationId]); if(!result.rows[0])throw new VendorError(404,"vendor_product_not_found","Produktet finnes ikke."); res.setHeader("ETag",`\"${result.rows[0].revision}\"`); res.json({data:mapCreatorHubVendorProduct(result.rows[0])}); } catch(error){sendError(res,error);} });
  app.post("/api/v1/vendor/products", externalLimit, async (req,res) => { const body=productInput.safeParse(req.body); if(!body.success)return invalid(res,body); const principal=await externalAuth(pool,req,res,"products:write"); if(!principal)return; try { const row=await tx(pool,(db)=>insertProduct(db,principal.organizationId,principal.createdBy,body.data)); res.status(201).json({data:mapCreatorHubVendorProduct(row)}); } catch(error){sendError(res,error);} });
  app.patch("/api/v1/vendor/products/:id", externalLimit, async (req,res) => { const body=externalProductPatch.safeParse(req.body); if(!body.success)return invalid(res,body); const principal=await externalAuth(pool,req,res,"products:write"); if(!principal)return; try { const row=await tx(pool,async(db)=>{const current=await db.query(`SELECT * FROM creatorhub_vendor_products WHERE id=$1 AND organization_id=$2 AND status<>'archived' FOR UPDATE`,[req.params.id,principal.organizationId]);if(!current.rows[0])throw new VendorError(404,"vendor_product_not_found","Produktet finnes ikke.");if(Number(current.rows[0].revision)!==body.data.revision)throw new VendorError(409,"product_revision_conflict","Produktet er endret av noen andre.");const nextSlug=body.data.slug||body.data.name?await uniqueSlug(db,principal.organizationId,body.data.slug||body.data.name||current.rows[0].name,req.params.id):current.rows[0].slug;const nextImages=body.data.imageUrl!==undefined||body.data.imageUrls||body.data.images?images(body.data):current.rows[0].image_urls;const nextTags=body.data.tags!==undefined?tags(body.data.tags):current.rows[0].tags;const nextStatus=status(body.data.status||String(current.rows[0].status));const updated=await db.query(`UPDATE creatorhub_vendor_products SET slug=$3,name=$4,description=$5,product_type=$6,category=$7,sku=$8,version=$9,price_amount=$10,currency=$11,stock_quantity=$12,track_inventory=$13,status=$14,image_urls=$15::jsonb,tags=$16::jsonb,metadata=$17::jsonb,revision=revision+1,updated_at=NOW(),published_at=CASE WHEN $14='active' THEN COALESCE(published_at,NOW()) ELSE published_at END WHERE id=$1 AND organization_id=$2 AND revision=$18 RETURNING *`,[req.params.id,principal.organizationId,nextSlug,body.data.name??current.rows[0].name,body.data.description!==undefined?body.data.description:current.rows[0].description,body.data.productType??current.rows[0].product_type,body.data.category??current.rows[0].category,body.data.sku!==undefined?body.data.sku:current.rows[0].sku,body.data.version??current.rows[0].version,body.data.priceAmount??body.data.price??Number(current.rows[0].price_amount),body.data.currency??current.rows[0].currency,body.data.stockQuantity!==undefined?body.data.stockQuantity:current.rows[0].stock_quantity,body.data.trackInventory??current.rows[0].track_inventory,nextStatus,JSON.stringify(nextImages),JSON.stringify(nextTags),JSON.stringify(body.data.metadata??current.rows[0].metadata),body.data.revision]);if(!updated.rows[0])throw new VendorError(409,"product_revision_conflict","Produktet er endret av noen andre.");await emit(db,principal.organizationId,nextStatus==="active"&&current.rows[0].status!=="active"?"product.published":"product.updated",updated.rows[0]);return updated.rows[0];});res.json({data:mapCreatorHubVendorProduct(row)});}catch(error){sendError(res,error);} });
  app.patch("/api/v1/vendor/products/:id/inventory", externalLimit, async (req,res) => { const body=inventoryPatch.safeParse(req.body); if(!body.success)return invalid(res,body); const principal=await externalAuth(pool,req,res,"inventory:write"); if(!principal)return; try { const row=await tx(pool,async(db)=>{const result=await db.query(`UPDATE creatorhub_vendor_products SET stock_quantity=$3,track_inventory=TRUE,revision=revision+1,updated_at=NOW() WHERE id=$1 AND organization_id=$2 AND revision=$4 AND status<>'archived' RETURNING *`,[req.params.id,principal.organizationId,body.data.stockQuantity,body.data.revision]); if(!result.rows[0])throw new VendorError(409,"product_revision_conflict","Produktet finnes ikke eller er endret."); await emit(db,principal.organizationId,"inventory.updated",result.rows[0]); return result.rows[0];}); res.json({data:mapCreatorHubVendorProduct(row)}); } catch(error){sendError(res,error);} });

  app.get("/api/v1/vendor/webhooks", externalLimit, async(req,res)=>{const principal=await externalAuth(pool,req,res,"webhooks:manage");if(!principal)return;try{const result=await pool.query(`SELECT id,url,events,is_active,created_at FROM creatorhub_vendor_webhooks WHERE organization_id=$1 ORDER BY created_at DESC`,[principal.organizationId]);res.json({data:result.rows.map((row)=>({id:String(row.id),url:String(row.url),events:row.events,isActive:row.is_active===true,createdAt:iso(row.created_at)}))});}catch(error){sendError(res,error);}});
  app.post("/api/v1/vendor/webhooks", externalLimit, async(req,res)=>{const body=webhookInput.safeParse(req.body);if(!body.success)return invalid(res,body);const principal=await externalAuth(pool,req,res,"webhooks:manage");if(!principal)return;try{const target=await(deps.validateWebhookUrl||assertPublicUrlResolved)(body.data.url);if(target.protocol!=="https:")throw new VendorError(400,"https_webhook_required","Webhook må bruke HTTPS.");const secret=`whsec_${crypto.randomBytes(32).toString("base64url")}`;const result=await pool.query(`INSERT INTO creatorhub_vendor_webhooks (organization_id,url,secret_hash,secret_ciphertext,events,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,created_at`,[principal.organizationId,target.toString(),sha256(secret),encryptSecret(secret),body.data.events,principal.createdBy]);res.status(201).json({data:{id:String(result.rows[0].id),url:target.toString(),events:body.data.events,secret,createdAt:iso(result.rows[0].created_at)},notice:"Webhook-hemmeligheten vises bare denne ene gangen."});}catch(error){sendError(res,error);}});
  app.delete("/api/v1/vendor/webhooks/:id", externalLimit, async(req,res)=>{const principal=await externalAuth(pool,req,res,"webhooks:manage");if(!principal)return;try{const result=await pool.query(`UPDATE creatorhub_vendor_webhooks SET is_active=FALSE WHERE id=$1 AND organization_id=$2 AND is_active=TRUE RETURNING id`,[req.params.id,principal.organizationId]);if(!result.rows[0])throw new VendorError(404,"webhook_not_found","Webhooken finnes ikke.");res.status(204).end();}catch(error){sendError(res,error);}});
}
