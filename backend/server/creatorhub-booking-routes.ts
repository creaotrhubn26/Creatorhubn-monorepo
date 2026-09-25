import crypto from "crypto";
import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthoritativeSession, AuthoritativeSessionResolution } from "./workspace-project-participants-routes.js";
import {
  CREATORHUB_ENTERPRISE_FEATURES,
  resolveCreatorHubEnterpriseAccess,
  sendCreatorHubEnterpriseError,
} from "./creatorhub-enterprise-access.js";

export interface CreatorHubBookingRoutesDeps {
  app: Express;
  pool: Pool;
  resolveAuthoritativeSessionFromRequest: (req: Request) => Promise<AuthoritativeSessionResolution>;
}

class BookingError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) { super(message); }
}

const orgQuery = z.object({ organizationId: z.string().trim().max(255).optional() }).passthrough();
const profileSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
  businessName: z.string().trim().min(1).max(160),
  headline: z.string().trim().max(240).nullable().optional(), description: z.string().trim().max(10_000).nullable().optional(),
  profession: z.string().trim().max(80).nullable().optional(), timezone: z.string().trim().min(1).max(80).default("Europe/Oslo"),
  currency: z.string().regex(/^[A-Z]{3}$/).default("NOK"), logoUrl: z.string().url().max(2_000).nullable().optional(),
  coverUrl: z.string().url().max(2_000).nullable().optional(), locationLabel: z.string().trim().max(255).nullable().optional(),
  contactEmail: z.string().email().max(320).nullable().optional(), minimumNoticeHours: z.number().int().min(0).max(8_760).default(24),
  maximumAdvanceDays: z.number().int().min(1).max(730).default(180), slotIntervalMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).default(30),
  isPublished: z.boolean().default(false), organizationId: z.string().trim().max(255).optional(),
}).strict();
const serviceSchema = z.object({
  name: z.string().trim().min(1).max(160), description: z.string().trim().max(5_000).nullable().optional(),
  durationMinutes: z.number().int().min(15).max(1_440), priceAmount: z.number().finite().min(0).max(10_000_000),
  depositAmount: z.number().finite().min(0).max(10_000_000).default(0), bufferBeforeMinutes: z.number().int().min(0).max(720).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(720).default(0), locationMode: z.enum(["provider","customer","remote","flexible"]).default("provider"),
  isActive: z.boolean().default(true), sortOrder: z.number().int().min(-10_000).max(10_000).default(0), organizationId: z.string().trim().max(255).optional(),
}).strict().refine((value) => value.depositAmount <= value.priceAmount, { path: ["depositAmount"], message: "Depositum kan ikke overstige prisen." });
const availabilitySchema = z.object({ organizationId: z.string().trim().max(255).optional(), windows: z.array(z.object({
  weekday: z.number().int().min(0).max(6), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), isActive: z.boolean().default(true),
}).strict()).max(35) }).strict();
const publicBookingSchema = z.object({
  serviceId: z.string().uuid(), startsAt: z.string().datetime(), customerName: z.string().trim().min(2).max(255),
  customerEmail: z.string().trim().email().max(320), customerPhone: z.string().trim().max(50).nullable().optional(),
  customerNote: z.string().trim().max(4_000).nullable().optional(), intakeAnswers: z.record(z.unknown()).default({}),
  privacyConsent: z.literal(true), idempotencyKey: z.string().uuid(),
}).strict().refine((value) => Buffer.byteLength(JSON.stringify(value.intakeAnswers), "utf8") <= 32_768, { path: ["intakeAnswers"], message: "Svarene er for store." });
const statusSchema = z.object({ status: z.enum(["requested","confirmed","cancelled","completed","no_show"]), organizationId: z.string().trim().max(255).optional() }).strict();

const mapProfile = (row: any) => row ? ({ organizationId: String(row.organization_id), slug: String(row.slug), businessName: String(row.business_name), headline: row.headline || null, description: row.description || null, profession: row.profession || null, timezone: String(row.timezone), currency: String(row.currency), logoUrl: row.logo_url || null, coverUrl: row.cover_url || null, locationLabel: row.location_label || null, contactEmail: row.contact_email || null, minimumNoticeHours: Number(row.minimum_notice_hours), maximumAdvanceDays: Number(row.maximum_advance_days), slotIntervalMinutes: Number(row.slot_interval_minutes), isPublished: row.is_published === true }) : null;
const mapService = (row: any) => ({ id: String(row.id), name: String(row.name), description: row.description || null, durationMinutes: Number(row.duration_minutes), priceAmount: Number(row.price_amount), depositAmount: Number(row.deposit_amount), bufferBeforeMinutes: Number(row.buffer_before_minutes), bufferAfterMinutes: Number(row.buffer_after_minutes), locationMode: String(row.location_mode), isActive: row.is_active === true, sortOrder: Number(row.sort_order) });
const mapBooking = (row: any) => ({ id: String(row.id), bookingReference: String(row.booking_reference), serviceId: String(row.service_id), serviceName: row.service_name || null, projectId: row.project_id || null, customerName: String(row.customer_name), customerEmail: String(row.customer_email), customerPhone: row.customer_phone || null, startsAt: new Date(row.starts_at).toISOString(), endsAt: new Date(row.ends_at).toISOString(), status: String(row.status), priceAmount: Number(row.price_amount), depositAmount: Number(row.deposit_amount), paymentStatus: String(row.payment_status), customerNote: row.customer_note || null, createdAt: new Date(row.created_at).toISOString() });

async function sessionFor(deps: CreatorHubBookingRoutesDeps, req: Request, res: Response): Promise<AuthoritativeSession | null> {
  const result = await deps.resolveAuthoritativeSessionFromRequest(req).catch(() => ({ status: "unavailable" as const }));
  if (result.status === "unavailable") { res.status(503).json({ error: "authentication_unavailable" }); return null; }
  if (result.status !== "authenticated") { res.status(401).json({ error: "auth_required" }); return null; }
  return result.session;
}
async function managerAccess(deps: CreatorHubBookingRoutesDeps, req: Request, res: Response, organizationId?: string | null) {
  const session = await sessionFor(deps, req, res); if (!session) return null;
  try {
    const access = await resolveCreatorHubEnterpriseAccess(deps.pool, { userId: session.userId, organizationId, featureId: CREATORHUB_ENTERPRISE_FEATURES.booking });
    if (!access.canAdminister) throw new BookingError(403, "booking_admin_required", "Bare Enterprise-administratorer kan administrere bookingsiden.");
    return { session, access };
  } catch (error) { sendError(res, error); return null; }
}
async function tx<T>(pool: Pool, work: (db: PoolClient) => Promise<T>): Promise<T> { const db = await pool.connect(); try { await db.query("BEGIN"); const result = await work(db); await db.query("COMMIT"); return result; } catch (error) { await db.query("ROLLBACK").catch(() => undefined); throw error; } finally { db.release(); } }
function invalid(res: Response, parsed: z.SafeParseError<unknown>) { res.status(400).json({ error: "validation_error", details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }); }
function sendError(res: Response, error: unknown) {
  if (error instanceof BookingError) { res.status(error.statusCode).json({ error: error.code, message: error.message }); return; }
  const code = String((error as { code?: string })?.code || "");
  if (code === "23505") { res.status(409).json({ error: "booking_conflict", message: "Verdien finnes allerede eller tidspunktet ble nettopp reservert." }); return; }
  if (["23503","23514"].includes(code)) { res.status(409).json({ error: "booking_integrity_conflict", message: "Bookingen kunne ikke lagres med disse verdiene." }); return; }
  sendCreatorHubEnterpriseError(res, error);
}

const partFormatter = (timezone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
function parts(date: Date, timezone: string) { const record: Record<string,string> = {}; for (const part of partFormatter(timezone).formatToParts(date)) if (part.type !== "literal") record[part.type] = part.value; return record; }
function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timezone: string): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 2; i += 1) { const actual = parts(new Date(guess), timezone); const represented = Date.UTC(Number(actual.year), Number(actual.month) - 1, Number(actual.day), Number(actual.hour), Number(actual.minute)); guess += Date.UTC(year, month - 1, day, hour, minute) - represented; }
  return new Date(guess);
}
function localInfo(date: Date, timezone: string) { const p = parts(date, timezone); const weekday = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(p.weekday); return { year: Number(p.year), month: Number(p.month), day: Number(p.day), hour: Number(p.hour), minute: Number(p.minute), weekday }; }
function timeParts(value: string) { const [hour, minute] = value.slice(0, 5).split(":").map(Number); return { hour, minute }; }
function reference(prefix = "CH") { return `${prefix}-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`; }
function ipHash(req: Request): string | null { const secret = process.env.BOOKING_IP_HASH_SECRET; if (!secret) return null; return crypto.createHmac("sha256", secret).update(String(req.ip || req.socket.remoteAddress || "unknown")).digest("hex"); }

async function publicContext(pool: Pool, slug: string) {
  const result = await pool.query(
    `SELECT profile.*, entitlement.status AS entitlement_status, entitlement.valid_until
       FROM creatorhub_booking_profiles profile JOIN creatorhub_enterprise_entitlements entitlement USING (organization_id)
      WHERE LOWER(profile.slug)=LOWER($1) AND profile.is_published=TRUE
        AND entitlement.status IN ('active','grace') AND (entitlement.valid_until IS NULL OR entitlement.valid_until>NOW()) LIMIT 1`, [slug],
  );
  if (!result.rows[0]) throw new BookingError(404, "booking_page_not_found", "Bookingsiden finnes ikke.");
  return result.rows[0];
}

export function setupCreatorHubBookingRoutes(deps: CreatorHubBookingRoutesDeps): void {
  const { app, pool } = deps;
  const publicReadLimit = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });
  const publicWriteLimit = rateLimit({ windowMs: 10 * 60_000, limit: 12, standardHeaders: true, legacyHeaders: false });

  app.get("/api/creatorhub/booking", async (req, res) => {
    const query = orgQuery.safeParse(req.query); if (!query.success) return invalid(res, query);
    const auth = await managerAccess(deps, req, res, query.data.organizationId); if (!auth) return;
    try {
      const [profile, services, windows, bookings] = await Promise.all([
        pool.query(`SELECT * FROM creatorhub_booking_profiles WHERE organization_id=$1`, [auth.access.organizationId]),
        pool.query(`SELECT * FROM creatorhub_booking_services WHERE organization_id=$1 ORDER BY sort_order,name`, [auth.access.organizationId]),
        pool.query(`SELECT id,weekday,start_time,end_time,is_active FROM creatorhub_booking_availability WHERE organization_id=$1 ORDER BY weekday,start_time`, [auth.access.organizationId]),
        pool.query(`SELECT booking.*, service.name AS service_name FROM creatorhub_bookings booking JOIN creatorhub_booking_services service ON service.id=booking.service_id WHERE booking.organization_id=$1 ORDER BY booking.starts_at DESC LIMIT 250`, [auth.access.organizationId]),
      ]);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ profile: mapProfile(profile.rows[0]), services: services.rows.map(mapService), availability: windows.rows.map((row) => ({ id: String(row.id), weekday: Number(row.weekday), startTime: String(row.start_time).slice(0,5), endTime: String(row.end_time).slice(0,5), isActive: row.is_active === true })), bookings: bookings.rows.map(mapBooking), access: auth.access });
    } catch (error) { sendError(res, error); }
  });

  app.put("/api/creatorhub/booking/profile", async (req, res) => {
    const body = profileSchema.safeParse(req.body); if (!body.success) return invalid(res, body);
    const auth = await managerAccess(deps, req, res, body.data.organizationId); if (!auth) return;
    try {
      try { new Intl.DateTimeFormat("en", { timeZone: body.data.timezone }).format(); } catch { throw new BookingError(400, "invalid_timezone", "Ugyldig tidssone."); }
      const row = await pool.query(
        `INSERT INTO creatorhub_booking_profiles
           (organization_id,owner_user_id,slug,business_name,headline,description,profession,timezone,currency,logo_url,cover_url,location_label,contact_email,minimum_notice_hours,maximum_advance_days,slot_interval_minutes,is_published)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (organization_id) DO UPDATE SET slug=EXCLUDED.slug,business_name=EXCLUDED.business_name,headline=EXCLUDED.headline,description=EXCLUDED.description,profession=EXCLUDED.profession,timezone=EXCLUDED.timezone,currency=EXCLUDED.currency,logo_url=EXCLUDED.logo_url,cover_url=EXCLUDED.cover_url,location_label=EXCLUDED.location_label,contact_email=EXCLUDED.contact_email,minimum_notice_hours=EXCLUDED.minimum_notice_hours,maximum_advance_days=EXCLUDED.maximum_advance_days,slot_interval_minutes=EXCLUDED.slot_interval_minutes,is_published=EXCLUDED.is_published,updated_at=NOW()
         RETURNING *`,
        [auth.access.organizationId, auth.session.userId, body.data.slug, body.data.businessName, body.data.headline || null, body.data.description || null, body.data.profession || null, body.data.timezone, body.data.currency, body.data.logoUrl || null, body.data.coverUrl || null, body.data.locationLabel || null, body.data.contactEmail || null, body.data.minimumNoticeHours, body.data.maximumAdvanceDays, body.data.slotIntervalMinutes, body.data.isPublished],
      );
      res.json({ profile: mapProfile(row.rows[0]) });
    } catch (error) { sendError(res, error); }
  });

  app.post("/api/creatorhub/booking/services", async (req, res) => {
    const body = serviceSchema.safeParse(req.body); if (!body.success) return invalid(res, body);
    const auth = await managerAccess(deps, req, res, body.data.organizationId); if (!auth) return;
    try {
      const id = crypto.randomUUID(); const data = body.data;
      const result = await pool.query(`INSERT INTO creatorhub_booking_services (id,organization_id,name,description,duration_minutes,price_amount,deposit_amount,buffer_before_minutes,buffer_after_minutes,location_mode,is_active,sort_order) VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [id,auth.access.organizationId,data.name,data.description||null,data.durationMinutes,data.priceAmount,data.depositAmount,data.bufferBeforeMinutes,data.bufferAfterMinutes,data.locationMode,data.isActive,data.sortOrder]);
      res.status(201).json({ service: mapService(result.rows[0]) });
    } catch (error) { sendError(res, error); }
  });

  app.patch("/api/creatorhub/booking/services/:serviceId", async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.serviceId); if (!id.success) return invalid(res, id);
    const body = serviceSchema.safeParse(req.body); if (!body.success) return invalid(res, body);
    const auth = await managerAccess(deps, req, res, body.data.organizationId); if (!auth) return;
    try { const d=body.data; const result=await pool.query(`UPDATE creatorhub_booking_services SET name=$1,description=$2,duration_minutes=$3,price_amount=$4,deposit_amount=$5,buffer_before_minutes=$6,buffer_after_minutes=$7,location_mode=$8,is_active=$9,sort_order=$10,updated_at=NOW() WHERE id=$11::uuid AND organization_id=$12 RETURNING *`,[d.name,d.description||null,d.durationMinutes,d.priceAmount,d.depositAmount,d.bufferBeforeMinutes,d.bufferAfterMinutes,d.locationMode,d.isActive,d.sortOrder,id.data,auth.access.organizationId]); if(!result.rows[0]) throw new BookingError(404,"service_not_found","Tjenesten finnes ikke."); res.json({service:mapService(result.rows[0])}); } catch(error){sendError(res,error);}
  });

  app.put("/api/creatorhub/booking/availability", async (req, res) => {
    const body = availabilitySchema.safeParse(req.body); if (!body.success) return invalid(res, body);
    if (body.data.windows.some((window) => window.endTime <= window.startTime)) return res.status(400).json({ error: "invalid_availability_window" });
    const auth = await managerAccess(deps, req, res, body.data.organizationId); if (!auth) return;
    try { await tx(pool, async (db) => { await db.query(`DELETE FROM creatorhub_booking_availability WHERE organization_id=$1`,[auth.access.organizationId]); for(const window of body.data.windows) await db.query(`INSERT INTO creatorhub_booking_availability (organization_id,weekday,start_time,end_time,is_active) VALUES ($1,$2,$3::time,$4::time,$5)`,[auth.access.organizationId,window.weekday,window.startTime,window.endTime,window.isActive]); }); res.json({saved:true,count:body.data.windows.length}); } catch(error){sendError(res,error);}
  });

  app.patch("/api/creatorhub/booking/bookings/:bookingId/status", async (req,res)=>{
    const id=z.string().uuid().safeParse(req.params.bookingId); if(!id.success)return invalid(res,id); const body=statusSchema.safeParse(req.body); if(!body.success)return invalid(res,body); const auth=await managerAccess(deps,req,res,body.data.organizationId);if(!auth)return;
    try{const result=await pool.query(`UPDATE creatorhub_bookings SET status=$1,cancelled_at=CASE WHEN $1='cancelled' THEN NOW() ELSE cancelled_at END,updated_at=NOW() WHERE id=$2::uuid AND organization_id=$3 RETURNING *`,[body.data.status,id.data,auth.access.organizationId]);if(!result.rows[0])throw new BookingError(404,"booking_not_found","Bookingen finnes ikke.");res.json({booking:mapBooking(result.rows[0])});}catch(error){sendError(res,error);}
  });

  app.get("/api/public/booking/:slug", publicReadLimit, async (req,res)=>{try{const profile=await publicContext(pool,String(req.params.slug));const services=await pool.query(`SELECT * FROM creatorhub_booking_services WHERE organization_id=$1 AND is_active=TRUE ORDER BY sort_order,name`,[profile.organization_id]);res.setHeader("Cache-Control","public, max-age=60, stale-while-revalidate=300");res.json({profile:mapProfile(profile),services:services.rows.map(mapService)});}catch(error){sendError(res,error);}});

  app.get("/api/public/booking/:slug/availability", publicReadLimit, async (req,res)=>{
    const query=z.object({serviceId:z.string().uuid(),from:z.string().date(),to:z.string().date()}).strict().safeParse(req.query);if(!query.success)return invalid(res,query);
    try{const profile=await publicContext(pool,String(req.params.slug));const serviceResult=await pool.query(`SELECT * FROM creatorhub_booking_services WHERE organization_id=$1 AND id=$2::uuid AND is_active=TRUE`,[profile.organization_id,query.data.serviceId]);const service=serviceResult.rows[0];if(!service)throw new BookingError(404,"service_not_found","Tjenesten finnes ikke.");
      const from=new Date(`${query.data.from}T12:00:00Z`),to=new Date(`${query.data.to}T12:00:00Z`);if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||to<from||(to.getTime()-from.getTime())/86400000>62)throw new BookingError(400,"invalid_date_range","Velg maksimalt 62 dager.");
      const [windows,conflicts]=await Promise.all([pool.query(`SELECT weekday,start_time,end_time FROM creatorhub_booking_availability WHERE organization_id=$1 AND is_active=TRUE`,[profile.organization_id]),pool.query(`SELECT booking.starts_at,booking.ends_at,existing.buffer_before_minutes,existing.buffer_after_minutes FROM creatorhub_bookings booking JOIN creatorhub_booking_services existing ON existing.id=booking.service_id WHERE booking.organization_id=$1 AND booking.status IN ('requested','confirmed') AND booking.starts_at<$3::date+INTERVAL '2 day' AND booking.ends_at>$2::date-INTERVAL '1 day' UNION ALL SELECT block.starts_at,block.ends_at,0,0 FROM creatorhub_booking_blocks block WHERE block.organization_id=$1 AND block.starts_at<$3::date+INTERVAL '2 day' AND block.ends_at>$2::date-INTERVAL '1 day'`,[profile.organization_id,query.data.from,query.data.to])]);
      const slots:string[]=[];for(let cursor=new Date(from);cursor<=to;cursor.setUTCDate(cursor.getUTCDate()+1)){const local=localInfo(cursor,profile.timezone);for(const window of windows.rows.filter((item:any)=>Number(item.weekday)===local.weekday)){const start=timeParts(String(window.start_time)),end=timeParts(String(window.end_time));let candidate=zonedToUtc(local.year,local.month,local.day,start.hour,start.minute,profile.timezone);const boundary=zonedToUtc(local.year,local.month,local.day,end.hour,end.minute,profile.timezone);while(candidate.getTime()+Number(service.duration_minutes)*60000<=boundary.getTime()){const candidateEnd=new Date(candidate.getTime()+Number(service.duration_minutes)*60000);const occupied=conflicts.rows.some((item:any)=>{const busyStart=new Date(item.starts_at).getTime()-Number(item.buffer_before_minutes||0)*60000;const busyEnd=new Date(item.ends_at).getTime()+Number(item.buffer_after_minutes||0)*60000;return busyStart<candidateEnd.getTime()+Number(service.buffer_after_minutes)*60000&&busyEnd>candidate.getTime()-Number(service.buffer_before_minutes)*60000;});const earliest=Date.now()+Number(profile.minimum_notice_hours)*3600000;const latest=Date.now()+Number(profile.maximum_advance_days)*86400000;if(!occupied&&candidate.getTime()>=earliest&&candidate.getTime()<=latest)slots.push(candidate.toISOString());candidate=new Date(candidate.getTime()+Number(profile.slot_interval_minutes)*60000);}}}
      res.setHeader("Cache-Control","public, max-age=30");res.json({slots,timezone:profile.timezone});
    }catch(error){sendError(res,error);}
  });

  app.post("/api/public/booking/:slug/bookings", publicWriteLimit, async(req,res)=>{
    const body=publicBookingSchema.safeParse(req.body);if(!body.success)return invalid(res,body);
    try {
      const profile = await publicContext(pool, String(req.params.slug));
      const fingerprint = crypto.createHash("sha256").update(JSON.stringify({
        slug: String(req.params.slug).toLowerCase(), serviceId: body.data.serviceId,
        startsAt: body.data.startsAt, customerEmail: body.data.customerEmail.toLowerCase(),
        customerName: body.data.customerName, customerPhone: body.data.customerPhone || null,
        customerNote: body.data.customerNote || null, intakeAnswers: body.data.intakeAnswers,
      })).digest("hex");
      const booking = await tx(pool, async (db) => {
        await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [String(profile.organization_id)]);
        const existing = await db.query(
          `SELECT booking.*,service.name AS service_name FROM creatorhub_bookings booking
           JOIN creatorhub_booking_services service ON service.id=booking.service_id
           WHERE booking.organization_id=$1 AND booking.idempotency_key=$2::uuid`,
          [profile.organization_id, body.data.idempotencyKey],
        );
        if (existing.rows[0]) {
          if (existing.rows[0].request_fingerprint !== fingerprint) throw new BookingError(409,"idempotency_key_reused","Idempotensnøkkelen er allerede brukt til en annen booking.");
          return existing.rows[0];
        }
        const serviceResult = await db.query(`SELECT * FROM creatorhub_booking_services WHERE organization_id=$1 AND id=$2::uuid AND is_active=TRUE FOR SHARE`, [profile.organization_id,body.data.serviceId]);
        const service = serviceResult.rows[0]; if(!service) throw new BookingError(404,"service_not_found","Tjenesten finnes ikke.");
        const startsAt = new Date(body.data.startsAt);
        const earliest = Date.now() + Number(profile.minimum_notice_hours) * 3_600_000;
        const latest = Date.now() + Number(profile.maximum_advance_days) * 86_400_000;
        if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() < earliest || startsAt.getTime() > latest) throw new BookingError(409,"slot_outside_booking_window","Tidspunktet er utenfor bookingvinduet.");
        const endsAt = new Date(startsAt.getTime()+Number(service.duration_minutes)*60_000);
        const local = localInfo(startsAt,profile.timezone); const localEnd = localInfo(endsAt,profile.timezone);
        if (local.year !== localEnd.year || local.month !== localEnd.month || local.day !== localEnd.day) throw new BookingError(409,"slot_unavailable","Bookingen må avsluttes samme lokale dag.");
        const localStartTime = `${String(local.hour).padStart(2,"0")}:${String(local.minute).padStart(2,"0")}`;
        const localEndTime = `${String(localEnd.hour).padStart(2,"0")}:${String(localEnd.minute).padStart(2,"0")}`;
        const available = await db.query(`SELECT start_time FROM creatorhub_booking_availability WHERE organization_id=$1 AND weekday=$2 AND is_active=TRUE AND start_time<=$3::time AND end_time>=$4::time ORDER BY start_time DESC LIMIT 1`, [profile.organization_id,local.weekday,localStartTime,localEndTime]);
        if(!available.rows[0]) throw new BookingError(409,"slot_unavailable","Tidspunktet er ikke lenger tilgjengelig.");
        const windowStart = timeParts(String(available.rows[0].start_time));
        if (((local.hour * 60 + local.minute) - (windowStart.hour * 60 + windowStart.minute)) % Number(profile.slot_interval_minutes) !== 0) throw new BookingError(409,"slot_unavailable","Tidspunktet følger ikke bookingintervallet.");
        const conflict = await db.query(`SELECT 1 FROM creatorhub_bookings booking JOIN creatorhub_booking_services existing ON existing.id=booking.service_id WHERE booking.organization_id=$1 AND booking.status IN ('requested','confirmed') AND booking.starts_at-make_interval(mins=>existing.buffer_before_minutes)<$3::timestamptz+make_interval(mins=>$5) AND booking.ends_at+make_interval(mins=>existing.buffer_after_minutes)>$2::timestamptz-make_interval(mins=>$4) UNION ALL SELECT 1 FROM creatorhub_booking_blocks block WHERE block.organization_id=$1 AND block.starts_at<$3::timestamptz+make_interval(mins=>$5) AND block.ends_at>$2::timestamptz-make_interval(mins=>$4) LIMIT 1`, [profile.organization_id,startsAt.toISOString(),endsAt.toISOString(),Number(service.buffer_before_minutes),Number(service.buffer_after_minutes)]);
        if(conflict.rows[0]) throw new BookingError(409,"slot_unavailable","Tidspunktet ble nettopp reservert.");
        const inserted = await db.query(
          `INSERT INTO creatorhub_bookings (booking_reference,organization_id,service_id,customer_name,customer_email,customer_phone,starts_at,ends_at,price_amount,deposit_amount,payment_status,customer_note,intake_answers,privacy_consent_at,idempotency_key,request_fingerprint,source_ip_hash)
           VALUES ($1,$2,$3::uuid,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9,$10,$11,$12,$13::jsonb,NOW(),$14::uuid,$15,$16) RETURNING *`,
          [reference(),profile.organization_id,service.id,body.data.customerName,body.data.customerEmail.toLowerCase(),body.data.customerPhone||null,startsAt.toISOString(),endsAt.toISOString(),service.price_amount,service.deposit_amount,Number(service.deposit_amount)>0?'pending':'not_required',body.data.customerNote||null,JSON.stringify(body.data.intakeAnswers),body.data.idempotencyKey,fingerprint,ipHash(req)],
        );
        return {...inserted.rows[0],service_name:service.name};
      });
      res.status(201).json({booking:mapBooking(booking)});
    } catch(error) { sendError(res,error); }
  });
}
