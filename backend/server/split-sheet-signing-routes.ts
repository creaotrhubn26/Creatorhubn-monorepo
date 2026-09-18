/**
 * split-sheet-signing-routes.ts — bidragsyter-oversikt + digital signering.
 *
 * Gjenbruker split_sheets (access_code) + split_sheet_contributors (signed_at,
 * signature_data). Produsenten slår på signering (får delingslenke); bandet/
 * bidragsyterne åpner en offentlig ws-portal via koden, ser hele fordelingen, og
 * signerer godkjennelse. Ingen konto nødvendig for bidragsytere.
 */
import crypto from "crypto";
import type express from "express";
import type { Pool } from "pg";
import { rateLimit } from "express-rate-limit";
import {
  readSplitSheetCompensationFields,
  splitSheetCompensationModel,
  type SplitSheetCompensationType,
} from "../../frontend/shared/split-sheet-compensation.ts";
import {
  isWorkspaceParticipantCompensationMetadata,
  WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE,
} from "../../frontend/shared/workspace-participant-compensation.ts";
import { sendTransactionalEmail } from "./transactional-email-service";
import { resolveLeadgridPublicClientIp as resolveTrustedClientIp } from "./org-self-onboard-routes.js";

const APP_URL = (process.env.PUBLIC_APP_URL || "https://creatorhubn.com").replace(/\/+$/, "");
const escH = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const genCode = () => {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // uten forvekslbare tegn
  let s = ""; for (let i = 0; i < 10; i++) s += A[crypto.randomInt(A.length)];
  return s;
};
const genSigningToken = () => crypto.randomBytes(32).toString("base64url");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PNG_DATA_URL_PATTERN = /^data:image\/png;base64,[A-Za-z0-9+/]*={0,2}$/;
const signingTokenOf = (req: any): string => {
  const candidate = req.headers?.["x-split-sheet-signing-token"] ?? req.query?.token ?? req.body?.token;
  if (typeof candidate !== "string") return "";
  const token = candidate.trim();
  return /^[A-Za-z0-9_-]{32,255}$/.test(token) ? token : "";
};
const signingUrl = (code: string, token?: string | null) =>
  `${APP_URL}/signer/${code}${token ? `#token=${encodeURIComponent(token)}` : ""}`;
const trustedClientIpOf = (req: any): string | null => {
  const resolved = resolveTrustedClientIp(req);
  return resolved && resolved !== "unknown" ? resolved : null;
};
const parseAmount = (desc?: string): number => {
  const match = String(desc || "").match(/(\d[\d\s.,]*)\s*kr/i);
  if (!match) return 0;
  const token = match[1].replace(/\s/g, "");
  const lastComma = token.lastIndexOf(",");
  const lastDot = token.lastIndexOf(".");
  const lastSeparator = Math.max(lastComma, lastDot);
  const fractionDigits = lastSeparator >= 0 ? token.length - lastSeparator - 1 : 0;
  const separator = lastSeparator >= 0 ? token[lastSeparator] : null;
  const separatorCount = separator ? token.split(separator).length - 1 : 0;
  const hasBothSeparators = lastComma >= 0 && lastDot >= 0;
  const hasDecimalSeparator = !!separator && fractionDigits > 0 && fractionDigits <= 2
    && (hasBothSeparators || separatorCount >= 1);
  const normalized = hasDecimalSeparator
    ? `${token.slice(0, lastSeparator).replace(/[.,]/g, "")}.${token.slice(lastSeparator + 1)}`
    : token.replace(/[.,]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

type CompensationModel = "share" | "hourly" | "mixed";

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const readProjectAmount = (sheet: { metadata?: unknown; description?: string | null }): number => {
  const metadataAmount = Number(asRecord(sheet.metadata).projectAmount);
  return Number.isFinite(metadataAmount) && metadataAmount > 0
    ? metadataAmount
    : parseAmount(sheet.description || undefined);
};

/**
 * Only the workspace's explicit compensationType selects hourly/fixed terms.
 * Older Audio Showcase fee fields are additive to royalty shares and must not
 * silently replace the contributor's percentage in this generic portal.
 */
const readContributorCompensation = (value: unknown) => {
  const raw = asRecord(value);
  const explicitType: SplitSheetCompensationType = raw.compensationType === "hourly" || raw.compensationType === "fixed"
    ? raw.compensationType
    : "share";

  return readSplitSheetCompensationFields({
    ...raw,
    compensationType: explicitType,
    hourlyRate: raw.hourlyRate,
    estimatedAmount: raw.estimatedAmount,
    currency: raw.currency,
  });
};

export const mapContributor = (row: any, projectAmount = 0) => {
  const terms = readContributorCompensation(row.custom_fields);
  const percentage = Number(row.percentage) || 0;
  const shareAmount = projectAmount > 0
    ? Math.round((percentage / 100) * projectAmount * 100) / 100
    : null;
  // A share amount is derived from the normalized persisted percentage. Never
  // reuse a pre-normalization client estimate in a legal signing snapshot.
  const estimatedAmount = terms.compensationType === "share"
    ? shareAmount
    : terms.estimatedAmount;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: terms.roleLabel || row.role,
    percentage,
    compensationType: terms.compensationType,
    hourlyRate: terms.hourlyRate,
    estimatedHours: terms.estimatedHours,
    estimatedAmount,
    currency: terms.currency,
    amountKr: estimatedAmount,
    signed: !!row.signed_at,
    signedAt: row.signed_at,
  };
};

const getCompensationModel = (contributors: Array<{ compensationType: SplitSheetCompensationType }>): CompensationModel => {
  if (contributors.some((contributor) => contributor.compensationType === "fixed")) return "mixed";
  return splitSheetCompensationModel(contributors);
};

export interface SplitSheetSigningDeps {
  app: express.Application;
  pool: Pool;
  getSplitSheetUserId: (req: any) => string;
}

export function setupSplitSheetSigningRoutes(deps: SplitSheetSigningDeps): void {
  const { app, pool, getSplitSheetUserId } = deps;
  const publicSigningRateLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const credential = signingTokenOf(req) || String(req.params.code || "missing");
      return crypto.createHash("sha256")
        .update(`${trustedClientIpOf(req) || "unknown"}:${credential}`)
        .digest("hex");
    },
    handler: (_req, res) => res.status(429).json({ error: "too_many_requests" }),
  });

  // ── Audit-logg: append-only hendelser (aktivert/åpnet/signert/fullført) ──────
  let auditReady = false;
  const ensureAudit = async () => {
    if (auditReady) return;
    await pool.query(`CREATE TABLE IF NOT EXISTS split_sheet_signing_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), split_sheet_id UUID NOT NULL, event_type TEXT NOT NULL, actor_name TEXT, contributor_id UUID, method TEXT, ip TEXT, detail TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(() => undefined);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sse_sheet ON split_sheet_signing_events (split_sheet_id, created_at)`).catch(() => undefined);
    auditReady = true;
  };
  const logEvent = async (sheetId: string, eventType: string, opts: any = {}) => {
    try {
      await ensureAudit();
      await pool.query(
        `INSERT INTO split_sheet_signing_events (split_sheet_id, event_type, actor_name, contributor_id, method, ip, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [sheetId, eventType, opts.actorName || null, opts.contributorId || null, opts.method || null, opts.ip || null, opts.detail || null],
      );
    } catch { /* best-effort */ }
  };
  const ipOf = trustedClientIpOf;

  // Slå på signering for et ark → sikre access_code, status=pending_signatures.
  app.post("/api/split-sheets/:id/enable-signing", async (req, res) => {
    try {
      const userId = getSplitSheetUserId(req);
      const own = await pool.query(`SELECT id, access_code, metadata FROM split_sheets WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [req.params.id, userId]).catch(() => ({ rows: [] as any[] }));
      if (!own.rows.length) return res.status(404).json({ error: "not_found" });
      if (isWorkspaceParticipantCompensationMetadata(own.rows[0].metadata)) {
        return res.status(409).json({
          error: "managed_compensation_uses_participant_contract",
        });
      }
      let code = own.rows[0].access_code;
      if (!code) {
        code = genCode();
        await pool.query(
          `UPDATE split_sheets
              SET access_code = $1,
                  status = 'pending_signatures',
                  metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{agreementVersion}', '1'::jsonb, true),
                  updated_at = NOW()
            WHERE id = $2::uuid`,
          [code, req.params.id],
        );
      } else {
        await pool.query(
          `UPDATE split_sheets
              SET status = 'pending_signatures',
                  metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{agreementVersion}', '1'::jsonb, true),
                  updated_at = NOW()
            WHERE id = $1::uuid`,
          [req.params.id],
        );
      }
      void logEvent(req.params.id, "signing_enabled", { actorName: "Produsent", ip: ipOf(req) });
      res.json({ ok: true, accessCode: code, shareUrl: `${APP_URL}/signer/${code}` });
    } catch (e) { console.error("enable-signing", e); res.status(500).json({ error: "failed" }); }
  });

  // Send signeringslenken DIREKTE til bidragsyterne på e-post (Resend).
  app.post("/api/split-sheets/:id/send-invites", async (req, res) => {
    try {
      const userId = getSplitSheetUserId(req);
      const own = await pool.query(`SELECT id, title, access_code, metadata FROM split_sheets WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [req.params.id, userId]).catch(() => ({ rows: [] as any[] }));
      if (!own.rows.length) return res.status(404).json({ error: "not_found" });
      if (isWorkspaceParticipantCompensationMetadata(own.rows[0].metadata)) {
        return res.status(409).json({
          error: "managed_compensation_uses_participant_contract",
        });
      }
      let code = own.rows[0].access_code;
      if (!code) {
        code = genCode();
        await pool.query(
          `UPDATE split_sheets
              SET access_code = $1,
                  status = 'pending_signatures',
                  metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{agreementVersion}', '1'::jsonb, true),
                  updated_at = NOW()
            WHERE id = $2::uuid`,
          [code, req.params.id],
        );
      } else {
        await pool.query(
          `UPDATE split_sheets
              SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{agreementVersion}', '1'::jsonb, true),
                  updated_at = NOW()
            WHERE id = $1::uuid`,
          [req.params.id],
        );
      }
      const link = `${APP_URL}/signer/${code}`;
      const title = own.rows[0].title || "Split sheet";
      const c = await pool.query(`SELECT id, name, email, signed_at, custom_fields FROM split_sheet_contributors WHERE split_sheet_id = $1::uuid ORDER BY order_index`, [req.params.id]).catch(() => ({ rows: [] as any[] }));
      const compensationModel = getCompensationModel(c.rows.map((row: any) => ({
        compensationType: readContributorCompensation(row.custom_fields).compensationType,
      })));
      const recipients = c.rows.filter((row: any) => row.email && !row.signed_at);
      const agreementLabel = compensationModel === "share" ? "split sheet" : "honoraravtale";
      const heading = compensationModel === "hourly"
        ? "Godkjenn timeavtalen ⏱️"
        : compensationModel === "mixed"
          ? "Godkjenn honoraravtalen"
          : "Godkjenn fordelingen 🎵";
      const invitationCopy = compensationModel === "hourly"
        ? "Se avtalt timesats og timeestimat, og signer din godkjennelse:"
        : compensationModel === "mixed"
          ? "Se honorarvilkårene og fordelingen, og signer din godkjennelse:"
          : "Se hele fordelingen og signer din godkjennelse:";
      const inviteTokens = new Map<string, string>();
      if (recipients.length > 0) {
        const accessClient = await pool.connect();
        try {
          await accessClient.query("BEGIN");
          for (const recipient of recipients) {
            const token = genSigningToken();
            await accessClient.query(
              `INSERT INTO split_sheet_contributor_access (contributor_id, access_token, expires_at, metadata)
               VALUES ($1::uuid, $2, NOW() + INTERVAL '30 days', $3::jsonb)`,
              [recipient.id, token, JSON.stringify({ purpose: "workspace-signing", splitSheetId: req.params.id, issuedBy: userId })],
            );
            inviteTokens.set(recipient.id, token);
          }
          await accessClient.query("COMMIT");
        } catch (tokenError) {
          await accessClient.query("ROLLBACK").catch(() => undefined);
          throw tokenError;
        } finally {
          accessClient.release();
        }
      }
      let sent = 0;
      for (const m of recipients) {
        const inviteToken = inviteTokens.get(m.id) || "";
        const participantLink = signingUrl(code, inviteToken);
        const agreementReference = agreementLabel === "split sheet" ? "split sheet-en" : "honoraravtalen";
        const html = `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px"><h2 style="margin:0 0 12px;color:#1a1a1a">${heading}</h2><p style="font-size:15px;color:#333;line-height:1.6">Hei ${escH(m.name)},<br><br>Du er lagt til i ${agreementReference} «<b>${escH(title)}</b>». ${invitationCopy}</p><div style="margin:22px 0"><a href="${participantLink}" style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Se &amp; signer</a></div><p style="font-size:12px;color:#999">Lenken er personlig og skal ikke videresendes. Du trenger ingen konto. Har du CreatorHub-konto med samme e-post, finner du avtalen igjen under «Mine avtaler».</p></div>`;
        const text = `Hei ${m.name}. Du er lagt til i ${agreementLabel} «${title}». ${invitationCopy} ${participantLink}. Lenken er personlig og skal ikke videresendes.`;
        let delivered = false;
        try {
          const result = await sendTransactionalEmail({ to: m.email, subject: `Godkjenn ${agreementLabel}: ${title}`, html, text, fromLabel: "CreatorHub", kind: "split_sheet_invite", pool });
          delivered = result.sent;
        } catch { /* */ }
        if (delivered) {
          sent++;
          // Only rotate tokens owned by this workspace flow. The table is also
          // used by legacy contributor portals whose credentials must survive.
          const deliveryClient = await pool.connect();
          try {
            await deliveryClient.query("BEGIN");
            await deliveryClient.query(
              `SELECT id FROM split_sheets WHERE id = $1::uuid FOR UPDATE`,
              [req.params.id],
            );
            await deliveryClient.query(
              `DELETE FROM split_sheet_contributor_access
                WHERE contributor_id = $1::uuid
                  AND access_token <> $2
                  AND metadata->>'purpose' = 'workspace-signing'`,
              [m.id, inviteToken],
            );
            await deliveryClient.query(
              `UPDATE split_sheet_contributors
                  SET invitation_sent_at = NOW(), invitation_status = 'sent', updated_at = NOW()
                WHERE id = $1::uuid AND split_sheet_id = $2::uuid`,
              [m.id, req.params.id],
            );
            await deliveryClient.query("COMMIT");
          } catch (deliveryError) {
            await deliveryClient.query("ROLLBACK").catch(() => undefined);
            throw deliveryError;
          } finally {
            deliveryClient.release();
          }
        } else {
          // Preserve the previous delivered token when email delivery fails.
          await pool.query(
            `DELETE FROM split_sheet_contributor_access WHERE contributor_id = $1::uuid AND access_token = $2`,
            [m.id, inviteToken],
          ).catch(() => undefined);
        }
      }
      void logEvent(req.params.id, "invites_sent", { actorName: "Produsent", detail: `${sent} sendt`, ip: ipOf(req) });
      res.json({ ok: true, sent, total: recipients.length, shareUrl: link });
    } catch (e) { console.error("send-invites", e); res.status(500).json({ error: "failed" }); }
  });

  // Produsentens status: hvem har signert (per ark).
  app.get("/api/split-sheets/:id/signing-status", async (req, res) => {
    try {
      const userId = getSplitSheetUserId(req);
      const own = await pool.query(`SELECT id, title, access_code, status, description, metadata FROM split_sheets WHERE id = $1::uuid AND user_id = $2 LIMIT 1`, [req.params.id, userId]).catch(() => ({ rows: [] as any[] }));
      if (!own.rows.length) return res.status(404).json({ error: "not_found" });
      const s = own.rows[0];
      if (isWorkspaceParticipantCompensationMetadata(s.metadata)) {
        return res.status(409).json({
          error: "managed_compensation_uses_participant_contract",
        });
      }
      const c = await pool.query(`SELECT id, name, email, role, percentage, signed_at, custom_fields FROM split_sheet_contributors WHERE split_sheet_id = $1::uuid ORDER BY order_index`, [req.params.id]).catch(() => ({ rows: [] as any[] }));
      const amount = readProjectAmount(s);
      const contributors = c.rows.map((x: any) => mapContributor(x, amount));
      const compensationModel = getCompensationModel(contributors);
      await ensureAudit();
      const ev = await pool.query(`SELECT event_type, actor_name, method, ip, detail, created_at FROM split_sheet_signing_events WHERE split_sheet_id = $1::uuid ORDER BY created_at DESC LIMIT 100`, [req.params.id]).catch(() => ({ rows: [] as any[] }));
      res.json({
        title: s.title, accessCode: s.access_code, status: s.status,
        amount: amount || null, compensationModel,
        shareUrl: s.access_code ? `${APP_URL}/signer/${s.access_code}` : null,
        contributors, signedCount: contributors.filter((x: any) => x.signed).length, total: contributors.length,
        events: ev.rows.map((e: any) => ({ type: e.event_type, actor: e.actor_name, method: e.method, ip: e.ip, detail: e.detail, at: e.created_at })),
      });
    } catch (e) { console.error("signing-status", e); res.status(500).json({ error: "failed" }); }
  });

  // ── OFFENTLIG: bidragsyter-oversikt via kode (ingen konto) ───────────────────
  app.get("/api/public/split-sheet/:code", async (req, res) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const tokenWasSupplied = req.headers?.["x-split-sheet-signing-token"] !== undefined
        || req.query?.token !== undefined;
      const token = signingTokenOf(req);
      const s = await pool.query(`SELECT id, title, description, metadata, status FROM split_sheets WHERE UPPER(access_code) = $1 LIMIT 1`, [code]).catch(() => ({ rows: [] as any[] }));
      if (!s.rows.length) return res.status(404).json({ error: "not_found" });
      const sheet = s.rows[0];
      if (isWorkspaceParticipantCompensationMetadata(sheet.metadata)) {
        return res.status(404).json({ error: "not_found" });
      }
      let signingAccess: { contributor_id: string; signed_at: unknown } | null = null;
      if (tokenWasSupplied) {
        if (!token) {
          return res.status(401).json({ error: "invalid_or_expired_signing_token", canSign: false });
        }
        const access = await pool.query(
          `SELECT a.contributor_id, c.signed_at
             FROM split_sheet_contributor_access a
             JOIN split_sheet_contributors c ON c.id = a.contributor_id
            WHERE a.access_token = $1
              AND a.expires_at > NOW()
              AND c.split_sheet_id = $2::uuid
              AND a.metadata->>'purpose' = 'workspace-signing'
              AND a.metadata->>'splitSheetId' = $2::text
            LIMIT 1`,
          [token, sheet.id],
        );
        if (!access.rows.length) {
          return res.status(401).json({ error: "invalid_or_expired_signing_token", canSign: false });
        }
        signingAccess = access.rows[0];
      }
      const c = await pool.query(`SELECT id, name, email, role, percentage, signed_at, custom_fields FROM split_sheet_contributors WHERE split_sheet_id = $1::uuid ORDER BY order_index`, [sheet.id]).catch(() => ({ rows: [] as any[] }));
      const amount = readProjectAmount(sheet);
      const contributors = c.rows.map((x: any) => {
        const { email: _email, signedAt: _signedAt, ...publicContributor } = mapContributor(x, amount);
        return publicContributor;
      });
      const compensationModel = getCompensationModel(contributors);
      const estimatedTotal = contributors.reduce((sum: number, contributor: any) =>
        sum + (Number(contributor.amountKr) || 0), 0);
      void logEvent(sheet.id, "viewed", { ip: ipOf(req) });
      res.json({
        title: sheet.title, description: sheet.description || null,
        amount: amount || estimatedTotal || null, status: sheet.status,
        compensationModel,
        signingContributorId: signingAccess?.contributor_id || null,
        canSign: !!signingAccess && !signingAccess.signed_at && sheet.status === "pending_signatures",
        contributors, allSigned: contributors.length > 0 && contributors.every((x: any) => x.signed),
      });
    } catch (e) { console.error("public split-sheet", e); res.status(500).json({ error: "failed" }); }
  });

  // ── OFFENTLIG: bidragsyter signerer godkjennelse ─────────────────────────────
  app.post("/api/public/split-sheet/:code/sign", publicSigningRateLimit, async (req, res) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const contributorId = String(req.body?.contributorId || "").trim();
      const signerName = String(req.body?.signerName || "").trim().slice(0, 160);
      const tokenWasSupplied = req.headers?.["x-split-sheet-signing-token"] !== undefined
        || req.query?.token !== undefined
        || req.body?.token !== undefined;
      const token = signingTokenOf(req);
      // Tegnet signatur (finger/penn) som data-URL (png), valgfri — identitet = navn.
      const rawSignatureImage = typeof req.body?.signatureImage === "string" ? req.body.signatureImage : "";
      const signatureImage = rawSignatureImage.length <= 200000 && PNG_DATA_URL_PATTERN.test(rawSignatureImage)
        ? rawSignatureImage
        : null;
      const method = signatureImage ? "drawn" : "typed";
      if (!token) {
        return res.status(401).json({
          error: tokenWasSupplied ? "invalid_or_expired_signing_token" : "signing_token_required",
          canSign: false,
        });
      }
      if (!contributorId || !signerName) return res.status(400).json({ error: "missing_fields" });
      if (!UUID_PATTERN.test(contributorId)) return res.status(400).json({ error: "invalid_contributor_id" });
      if (req.body?.consent !== true) {
        return res.status(400).json({ error: "consent_required" });
      }
      const s = await pool.query(`SELECT id, metadata FROM split_sheets WHERE UPPER(access_code) = $1 LIMIT 1`, [code]).catch(() => ({ rows: [] as any[] }));
      if (!s.rows.length) return res.status(404).json({ error: "not_found" });
      if (isWorkspaceParticipantCompensationMetadata(s.rows[0].metadata)) {
        return res.status(404).json({ error: "not_found" });
      }
      const sheetId = s.rows[0].id;
      const client = await pool.connect();
      let upd: { rows: any[] } = { rows: [] };
      let cnt: { rows: any[] } = { rows: [{ total: 0, signed: 0 }] };
      let compensationModel: CompensationModel = "share";
      try {
        await client.query("BEGIN");
        // Serialize signers while the server anchors version/status and captures
        // one internally consistent agreement snapshot.
        const lockedSheet = await client.query(
          `SELECT title, description, metadata, status FROM split_sheets WHERE id = $1::uuid FOR UPDATE`,
          [sheetId],
        );
        if (!lockedSheet.rows.length) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "not_found" });
        }
        if (isWorkspaceParticipantCompensationMetadata(lockedSheet.rows[0].metadata)) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "not_found" });
        }
        if (lockedSheet.rows[0].status !== "pending_signatures") {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "agreement_not_signable", canSign: false });
        }
        await client.query(
          `UPDATE split_sheets
              SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{agreementVersion}', '1'::jsonb, true),
                  updated_at = NOW()
            WHERE id = $1::uuid`,
          [sheetId],
        );
        const projectAmount = readProjectAmount(lockedSheet.rows[0]);
        const access = await client.query(
          `SELECT a.id
             FROM split_sheet_contributor_access a
             JOIN split_sheet_contributors c ON c.id = a.contributor_id
            WHERE a.access_token = $1
              AND a.contributor_id = $2::uuid
              AND a.expires_at > NOW()
              AND c.split_sheet_id = $3::uuid
              AND a.metadata->>'purpose' = 'workspace-signing'
              AND a.metadata->>'splitSheetId' = $3::text
            FOR UPDATE OF a`,
          [token, contributorId, sheetId],
        );
        if (!access.rows.length) {
          await client.query("ROLLBACK");
          return res.status(401).json({ error: "invalid_or_expired_signing_token", canSign: false });
        }
        const current = await client.query(
          `SELECT id, name, email, role, percentage, signed_at, custom_fields
             FROM split_sheet_contributors
            WHERE id = $1::uuid AND split_sheet_id = $2::uuid
            FOR UPDATE`,
          [contributorId, sheetId],
        );
        if (!current.rows.length) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "contributor_not_found" });
        }

        const allTerms = await client.query(
          `SELECT id, name, role, percentage, custom_fields
             FROM split_sheet_contributors
            WHERE split_sheet_id = $1::uuid
            ORDER BY order_index
            FOR SHARE`,
          [sheetId],
        );
        const agreementContributors = allTerms.rows.map((row: any) => mapContributor(row, projectAmount));
        compensationModel = getCompensationModel(agreementContributors);

        if (!current.rows[0].signed_at) {
          const contributor = mapContributor(current.rows[0], projectAmount);
          const consentVersion = "workspace-agreement-consent-v1";
          const consentText = contributor.compensationType === "hourly"
            ? "Jeg godkjenner timesatsen som bindende vilkår. Oppgitte timer og beløp er estimater; sluttbeløpet følger godkjente timer."
            : compensationModel === "share"
              ? "Jeg bekrefter at jeg godkjenner denne fordelingen som bindende avtale."
              : "Jeg bekrefter at jeg godkjenner honorarvilkårene i denne avtalen.";
          const agreementSnapshot = {
            version: 1,
            splitSheetId: sheetId,
            title: lockedSheet.rows[0].title || null,
            description: lockedSheet.rows[0].description || null,
            compensationModel,
            projectAmount: projectAmount || null,
            currency: asRecord(lockedSheet.rows[0].metadata).currency || "NOK",
            distributionModel: asRecord(lockedSheet.rows[0].metadata).distributionModel || null,
            consent: true,
            consentText,
            consentVersion,
            contributors: agreementContributors.map((term: any) => ({
              id: term.id,
              name: term.name,
              role: term.role,
              percentage: term.percentage,
              compensationType: term.compensationType,
              hourlyRate: term.hourlyRate,
              estimatedHours: term.estimatedHours,
              estimatedAmount: term.estimatedAmount,
              amountKr: term.amountKr,
              currency: term.currency,
            })),
            contributor: {
              id: contributor.id,
              name: contributor.name,
              role: contributor.role,
              percentage: contributor.percentage,
              compensationType: contributor.compensationType,
              hourlyRate: contributor.hourlyRate,
              estimatedHours: contributor.estimatedHours,
              estimatedAmount: contributor.estimatedAmount,
              amountKr: contributor.amountKr,
              currency: contributor.currency,
            },
          };
          const signatureData = {
            signerName,
            method,
            signatureImage,
            signedVia: "participant-token",
            signedAt: new Date().toISOString(),
            ip: ipOf(req),
            consent: true,
            consentText,
            consentVersion,
            agreementSnapshot,
          };
          upd = await client.query(
            `UPDATE split_sheet_contributors SET signed_at = NOW(),
                signature_data = $1::jsonb, updated_at = NOW()
              WHERE id = $2::uuid AND split_sheet_id = $3::uuid AND signed_at IS NULL RETURNING id`,
            [JSON.stringify(signatureData), contributorId, sheetId],
          );
        }

        await client.query(
          `UPDATE split_sheet_contributor_access SET last_used_at = NOW() WHERE id = $1::uuid`,
          [access.rows[0].id],
        );

        // Alle signert? → marker arket ferdig i samme transaksjon som signaturen.
        cnt = await client.query(
          `SELECT COUNT(*)::int total, COUNT(signed_at)::int signed
             FROM split_sheet_contributors WHERE split_sheet_id = $1::uuid`,
          [sheetId],
        );
        const completed = cnt.rows[0].total > 0 && cnt.rows[0].total === cnt.rows[0].signed;
        if (completed) {
          await client.query(
            `UPDATE split_sheets SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW() WHERE id = $1::uuid`,
            [sheetId],
          );
        }
        await client.query("COMMIT");
      } catch (transactionError) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw transactionError;
      } finally {
        client.release();
      }

      const allSigned = cnt.rows[0].total > 0 && cnt.rows[0].total === cnt.rows[0].signed;
      if (upd.rows.length > 0) void logEvent(sheetId, "signed", { actorName: signerName, contributorId, method, ip: ipOf(req) });
      if (allSigned && upd.rows.length > 0) void logEvent(sheetId, "completed", { ip: ipOf(req) });
      // Push-varsel til produsenten (Resend) om at noen signerte.
      if (upd.rows.length > 0) void (async () => {
        try {
          const o = await pool.query(
            `SELECT ss.title, COALESCE(cu.email, u.email) AS owner_email
               FROM split_sheets ss LEFT JOIN creatorhub_users cu ON cu.id = ss.user_id LEFT JOIN users u ON u.id = ss.user_id
              WHERE ss.id = $1::uuid LIMIT 1`, [sheetId]);
          const row = o.rows[0]; if (!row?.owner_email) return;
          const remaining = Number(cnt.rows[0].total) - Number(cnt.rows[0].signed);
          const title = row.title || "Split sheet";
          const subject = allSigned ? `Alle har signert: ${title}` : `${signerName} signerte «${title}»`;
          const approvedTerms = compensationModel === "share" ? "fordelingen" : "honorarvilkårene";
          const html = `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px"><h2 style="margin:0 0 12px;color:#1a1a1a">${allSigned ? "Fullt signert ✓" : "Ny signatur ✍️"}</h2><p style="font-size:15px;color:#333"><b>${escH(signerName)}</b> har godkjent ${approvedTerms} i «${escH(title)}» (${method === "drawn" ? "tegnet" : "skrevet"} signatur).</p><p style="font-size:14px;color:#333">${allSigned ? "Alle bidragsytere har nå signert." : `Gjenstår: ${remaining} bidragsyter${remaining === 1 ? "" : "e"}.`}</p><div style="margin:18px 0"><a href="${APP_URL}" style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Se status i workspacet</a></div></div>`;
          const text = `${signerName} signerte «${title}». ${allSigned ? "Alle har signert." : remaining + " gjenstår."}`;
          await sendTransactionalEmail({ to: row.owner_email, subject, html, text, fromLabel: "CreatorHub", kind: "split_sheet_signed", pool });
        } catch { /* */ }
      })();
      res.json({ ok: true, alreadySigned: upd.rows.length === 0, allSigned });
    } catch (e) { console.error("public sign", e); res.status(500).json({ error: "failed" }); }
  });

  // ── «Mine avtaler» — split sheets den innloggede brukeren er bidragsyter på ───
  // Matcher på bidragsyter-e-post = brukerens e-post, så et bandmedlem som senere
  // lager konto ser avtalene de har signert/er del av (uansett hvem som eier arket).
  app.get("/api/my-split-sheets", async (req, res) => {
    try {
      const userId = getSplitSheetUserId(req);
      if (!userId) return res.json({ agreements: [] });
      const em = await pool.query(
        `SELECT email FROM creatorhub_users WHERE id = $1 UNION SELECT email FROM users WHERE id = $1`,
        [userId],
      ).catch(() => ({ rows: [] as any[] }));
      const emails = em.rows.map((r: any) => String(r.email || "").toLowerCase()).filter(Boolean);
      if (!emails.length) return res.json({ agreements: [] });
      const r = await pool.query(
        `SELECT ss.id, ss.title, ss.status, ss.access_code, ss.description, ss.metadata, ss.created_at, ss.completed_at,
                c.id AS my_contributor_id, c.name AS my_name, COALESCE(c.custom_fields->>'roleLabel', c.role) AS my_role,
                c.percentage AS my_percentage, c.signed_at AS my_signed_at, c.custom_fields AS my_custom_fields,
                (SELECT COUNT(*)::int FROM split_sheet_contributors x WHERE x.split_sheet_id = ss.id) AS total,
                (SELECT COUNT(signed_at)::int FROM split_sheet_contributors x WHERE x.split_sheet_id = ss.id) AS signed,
                (SELECT jsonb_agg(COALESCE(x.custom_fields, '{}'::jsonb)) FROM split_sheet_contributors x WHERE x.split_sheet_id = ss.id) AS contributor_custom_fields,
                (SELECT a.access_token
                   FROM split_sheet_contributor_access a
                  WHERE a.contributor_id = c.id
                    AND a.expires_at > NOW()
                    AND a.metadata->>'purpose' = 'workspace-signing'
                    AND a.metadata->>'splitSheetId' = ss.id::text
                  ORDER BY a.expires_at DESC, a.created_at DESC
                  LIMIT 1) AS my_access_token
           FROM split_sheets ss
           JOIN split_sheet_contributors c ON c.split_sheet_id = ss.id
          WHERE LOWER(c.email) = ANY($1::text[])
            AND COALESCE(ss.metadata->>'source', '') <> $2
          ORDER BY ss.created_at DESC LIMIT 100`,
        [emails, WORKSPACE_PARTICIPANT_COMPENSATION_SOURCE],
      ).catch(() => ({ rows: [] as any[] }));
      const agreements = r.rows.map((x: any) => {
        const amount = readProjectAmount(x);
        const contributor = mapContributor({
          id: x.my_contributor_id,
          name: x.my_name,
          role: x.my_role,
          percentage: x.my_percentage,
          signed_at: x.my_signed_at,
          custom_fields: x.my_custom_fields,
        }, amount);
        const contributorFields = Array.isArray(x.contributor_custom_fields)
          ? x.contributor_custom_fields
          : [];
        const compensationModel = getCompensationModel(contributorFields.map((fields: unknown) => ({
          compensationType: readContributorCompensation(fields).compensationType,
        })));

        return {
          id: x.id, title: x.title, status: x.status, accessCode: x.access_code,
          amount: amount || null, createdAt: x.created_at, completedAt: x.completed_at,
          myRole: contributor.role, mySharePct: contributor.percentage, mySigned: contributor.signed,
          compensationModel,
          compensationType: contributor.compensationType,
          hourlyRate: contributor.hourlyRate,
          estimatedHours: contributor.estimatedHours,
          estimatedAmount: contributor.estimatedAmount,
          amountKr: contributor.amountKr,
          currency: contributor.currency,
          signedCount: x.signed, total: x.total,
          canSign: !!x.my_access_token && !contributor.signed,
          viewUrl: x.access_code ? signingUrl(x.access_code, x.my_access_token) : null,
        };
      });
      res.json({ agreements });
    } catch (e) { console.error("my-split-sheets", e); res.json({ agreements: [] }); }
  });
}
