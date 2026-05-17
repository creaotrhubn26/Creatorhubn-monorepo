/**
 * Generic "client-request" thread for the Creative Sync Workspace.
 *
 * Anywhere in CSW where the markedsfører trenger noe fra klienten —
 * datakilde-tilgang, brand-info, gode bilder, signert avtale — kan
 * panelet opprette en request via dette API-et. Hver request:
 *   1. Lagres i `role_room_client_requests` med status `pending`
 *   2. Sender e-post til klienten (Gmail SMTP, samme pattern som
 *      merch-partner-email) med subject + body markdown + lenke
 *      tilbake til en publik klient-side hvor de kan svare
 *   3. Vises i CSW for markedsføreren som "Venter på klient: <X>"
 *      med tråd av meldinger og status-historikk
 *
 * Tabellene opprettes lazy ved første kall — ingen separat migrasjon
 * (matcher mønsteret i flere andre role-room-tjenester).
 */

import nodemailer from "nodemailer";
import type { Pool } from "pg";
import {
  createClientPortalInvite,
  findActiveSessionForEmail,
} from "./role-room-client-portal.js";

// ── Public types ────────────────────────────────────────────────────

export type ClientRequestKind =
  | "data_source_access"        // GA4 viewer, GBP manager, etc.
  | "brand_assets"              // logo, font-files, brand-colors
  | "kpi_baseline"              // historiske tall klienten må bekrefte
  | "approval"                  // klient må godkjenne post/script
  | "general_info";             // catch-all

export type ClientRequestStatus = "pending" | "in_progress" | "answered" | "closed";

export type ClientRequestMessageSender = "marketer" | "client" | "system";

export interface ClientRequest {
  id: string;
  projectId: string;
  kind: ClientRequestKind;
  /** Hva markedsføreren spør om — vises i tråden og som e-post-subject. */
  title: string;
  /** Markdown-body. Vises i e-post + i tråden. */
  bodyMarkdown: string;
  /** Hvilken panel/seksjon i CSW request-en stammer fra (data_sources, brand, etc.) */
  contextArea: string;
  /** Valgfri referanse til en spesifikk ressurs (f.eks. "google_analytics", "logo"). */
  contextKey: string | null;
  status: ClientRequestStatus;
  clientEmail: string;
  clientName: string | null;
  marketerUserId: string | null;
  marketerEmail: string | null;
  /** Calendly/Cal.com-URL markedsføreren ønsker å tilby klienten. */
  bookingUrl: string | null;
  /** Token klienten bruker for å åpne publik svar-side. */
  publicAccessToken: string;
  createdAt: string;
  updatedAt: string;
  answeredAt: string | null;
}

export interface ClientRequestMessage {
  id: string;
  requestId: string;
  sender: ClientRequestMessageSender;
  /** Display-navn (markedsfører-navn eller klient-navn). */
  senderLabel: string | null;
  bodyMarkdown: string;
  createdAt: string;
}

export interface CreateClientRequestInput {
  pool: Pool;
  projectId: string;
  kind: ClientRequestKind;
  title: string;
  bodyMarkdown: string;
  contextArea: string;
  contextKey?: string | null;
  clientEmail: string;
  clientName?: string | null;
  marketerUserId?: string | null;
  marketerEmail?: string | null;
  marketerName?: string | null;
  bookingUrl?: string | null;
  /** Hvis true, sender vi ikke e-post — bare lagrer in-app. */
  skipEmail?: boolean;
}

export interface CreateClientRequestResult {
  ok: boolean;
  request?: ClientRequest;
  emailSent: boolean;
  emailReason?: string;
  error?: string;
}

// ── Schema bootstrap ────────────────────────────────────────────────

let schemaReady = false;

async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_client_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body_markdown TEXT NOT NULL,
      context_area TEXT NOT NULL,
      context_key TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      client_email TEXT NOT NULL,
      client_name TEXT,
      marketer_user_id TEXT,
      marketer_email TEXT,
      booking_url TEXT,
      public_access_token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      answered_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_rr_client_requests_project ON role_room_client_requests(project_id);
    CREATE INDEX IF NOT EXISTS idx_rr_client_requests_status ON role_room_client_requests(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_rr_client_requests_token ON role_room_client_requests(public_access_token);

    CREATE TABLE IF NOT EXISTS role_room_client_request_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES role_room_client_requests(id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      sender_label TEXT,
      body_markdown TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rr_client_request_messages_request
      ON role_room_client_request_messages(request_id, created_at);
  `);
  schemaReady = true;
}

// ── Email helpers (mirror role-room-merch-partner-email) ────────────

function readGmailConfig(): { user: string; password: string } | null {
  const user =
    (process.env.GMAIL_USER
      ?? process.env.GOOGLE_WORKSPACE_EMAIL
      ?? process.env.GOOGLE_ADMIN_EMAIL
      ?? "").trim();
  const password = (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
  if (!user || !password) return null;
  return { user, password };
}

function isPlausibleRecipient(email: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(lower)) return false;
  if (lower.startsWith("test@") || lower.startsWith("noreply@")) return false;
  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\n/);
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("");
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3 style="margin:18px 0 6px 0;font-size:15px;">${escapeHtml(heading[1])}</h3>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!inList) { out.push("<ul style=\"margin:6px 0;padding-left:20px;\">"); inList = true; }
      out.push(`<li>${escapeHtml(bullet[1])}</li>`);
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p style="margin:6px 0;line-height:1.55;">${escapeHtml(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#1a1a1a;">${out.join("\n")}</div>`;
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n");
}

// ── Token gen ───────────────────────────────────────────────────────

function generateToken(): string {
  // 32 chars, URL-safe — same approach used elsewhere in the codebase.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 32; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// ── Row mapping ────────────────────────────────────────────────────

function mapRequestRow(r: Record<string, unknown>): ClientRequest {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    kind: r.kind as ClientRequestKind,
    title: String(r.title),
    bodyMarkdown: String(r.body_markdown),
    contextArea: String(r.context_area),
    contextKey: (r.context_key as string | null) ?? null,
    status: r.status as ClientRequestStatus,
    clientEmail: String(r.client_email),
    clientName: (r.client_name as string | null) ?? null,
    marketerUserId: (r.marketer_user_id as string | null) ?? null,
    marketerEmail: (r.marketer_email as string | null) ?? null,
    bookingUrl: (r.booking_url as string | null) ?? null,
    publicAccessToken: String(r.public_access_token),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
    answeredAt: r.answered_at ? new Date(r.answered_at as string).toISOString() : null,
  };
}

function mapMessageRow(r: Record<string, unknown>): ClientRequestMessage {
  return {
    id: String(r.id),
    requestId: String(r.request_id),
    sender: r.sender as ClientRequestMessageSender,
    senderLabel: (r.sender_label as string | null) ?? null,
    bodyMarkdown: String(r.body_markdown),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

// ── Service methods ────────────────────────────────────────────────

export async function createClientRequest(
  input: CreateClientRequestInput,
): Promise<CreateClientRequestResult> {
  await ensureSchema(input.pool);

  if (!input.title.trim() || !input.bodyMarkdown.trim()) {
    return { ok: false, emailSent: false, error: "missing_title_or_body" };
  }
  if (!isPlausibleRecipient(input.clientEmail)) {
    return { ok: false, emailSent: false, error: "invalid_client_email" };
  }

  const token = generateToken();
  let insertedRequest: ClientRequest;
  try {
    const r = await input.pool.query(
      `INSERT INTO role_room_client_requests
        (project_id, kind, title, body_markdown, context_area, context_key,
         status, client_email, client_name, marketer_user_id, marketer_email,
         booking_url, public_access_token)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        input.projectId,
        input.kind,
        input.title.trim(),
        input.bodyMarkdown,
        input.contextArea,
        input.contextKey ?? null,
        input.clientEmail.trim().toLowerCase(),
        input.clientName ?? null,
        input.marketerUserId ?? null,
        input.marketerEmail ?? null,
        input.bookingUrl ?? null,
        token,
      ],
    );
    insertedRequest = mapRequestRow(r.rows[0]);
  } catch (err) {
    return {
      ok: false,
      emailSent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Log initial marketer message into thread so klienten ser hva spørsmålet er.
  try {
    await input.pool.query(
      `INSERT INTO role_room_client_request_messages
        (request_id, sender, sender_label, body_markdown)
       VALUES ($1, 'marketer', $2, $3)`,
      [insertedRequest.id, input.marketerName ?? input.marketerEmail ?? "Markedsfører", input.bodyMarkdown],
    );
  } catch (err) {
    console.error("[client-request] initial message log failed:", err);
  }

  // Send email (best-effort; status fortsatt 'pending' selv om e-post feiler).
  if (input.skipEmail) {
    return { ok: true, request: insertedRequest, emailSent: false, emailReason: "skipped" };
  }

  const cfg = readGmailConfig();
  if (!cfg) {
    return { ok: true, request: insertedRequest, emailSent: false, emailReason: "missing_email_config" };
  }

  // Gjenbruk eksisterende portal-session for (projectId, email) hvis den
  // finnes — ellers mint en ny. Slik unngår vi at samme klient får 5
  // forskjellige magic-links bare fordi vi har sendt 5 forespørsler.
  let portalSession = await findActiveSessionForEmail(input.pool, input.projectId, input.clientEmail);
  if (!portalSession && input.marketerUserId) {
    portalSession = await createClientPortalInvite(input.pool, {
      projectId: input.projectId,
      invitedByUserId: input.marketerUserId,
      clientEmail: input.clientEmail,
      clientName: input.clientName ?? null,
    });
  }

  const portalLink = portalSession
    ? buildPortalLink(portalSession.sessionToken, insertedRequest.id)
    : null;

  const fullBody = input.bodyMarkdown
    + (portalLink
        ? `\n\n---\n\nLogg inn i klient-portalen for å svare og se andre oppdateringer fra prosjektet:\n${portalLink}`
        : "")
    + (input.bookingUrl ? `\n\nFortrekker du å snakke? Book 15 min her: ${input.bookingUrl}` : "")
    + `\n\nMvh,\n${input.marketerName ?? "Markedsføringsteamet"}`;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: cfg.user, pass: cfg.password },
    });
    await transporter.sendMail({
      from: cfg.user,
      to: input.clientEmail,
      bcc: input.marketerEmail ?? undefined,
      replyTo: input.marketerEmail ?? cfg.user,
      subject: input.title.trim(),
      text: markdownToPlainText(fullBody),
      html: markdownToHtml(fullBody),
    });
    return { ok: true, request: insertedRequest, emailSent: true };
  } catch (err) {
    return {
      ok: true,
      request: insertedRequest,
      emailSent: false,
      emailReason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function listClientRequests(
  pool: Pool,
  projectId: string,
  filters?: { status?: ClientRequestStatus; contextArea?: string },
): Promise<ClientRequest[]> {
  await ensureSchema(pool);
  const wheres: string[] = ["project_id = $1"];
  const params: unknown[] = [projectId];
  if (filters?.status) {
    params.push(filters.status);
    wheres.push(`status = $${params.length}`);
  }
  if (filters?.contextArea) {
    params.push(filters.contextArea);
    wheres.push(`context_area = $${params.length}`);
  }
  const r = await pool.query(
    `SELECT * FROM role_room_client_requests
      WHERE ${wheres.join(" AND ")}
      ORDER BY updated_at DESC
      LIMIT 200`,
    params,
  );
  return r.rows.map(mapRequestRow);
}

export async function getClientRequest(
  pool: Pool,
  id: string,
): Promise<ClientRequest | null> {
  await ensureSchema(pool);
  const r = await pool.query(
    `SELECT * FROM role_room_client_requests WHERE id = $1`,
    [id],
  );
  return r.rows.length === 0 ? null : mapRequestRow(r.rows[0]);
}

/**
 * Liste alle requests for en gitt klient-portal-session (scoped til
 * projectId + clientEmail). Brukes av /api/client/portal/requests*-
 * endpoints så klienten ser bare det de er invitert til.
 */
export async function listClientRequestsForClient(
  pool: Pool,
  projectId: string,
  clientEmail: string,
): Promise<ClientRequest[]> {
  await ensureSchema(pool);
  const r = await pool.query(
    `SELECT * FROM role_room_client_requests
      WHERE project_id = $1 AND LOWER(client_email) = LOWER($2)
      ORDER BY created_at DESC
      LIMIT 100`,
    [projectId, clientEmail],
  );
  return r.rows.map(mapRequestRow);
}

export async function listClientRequestMessages(
  pool: Pool,
  requestId: string,
): Promise<ClientRequestMessage[]> {
  await ensureSchema(pool);
  const r = await pool.query(
    `SELECT * FROM role_room_client_request_messages
      WHERE request_id = $1
      ORDER BY created_at ASC`,
    [requestId],
  );
  return r.rows.map(mapMessageRow);
}

export interface AddMessageInput {
  pool: Pool;
  requestId: string;
  sender: ClientRequestMessageSender;
  senderLabel: string | null;
  bodyMarkdown: string;
  /** Hvis 'client', markeres request som 'answered' og answered_at settes. */
  markAnswered?: boolean;
}

export async function addClientRequestMessage(
  input: AddMessageInput,
): Promise<ClientRequestMessage | null> {
  await ensureSchema(input.pool);
  if (!input.bodyMarkdown.trim()) return null;

  const r = await input.pool.query(
    `INSERT INTO role_room_client_request_messages
      (request_id, sender, sender_label, body_markdown)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [input.requestId, input.sender, input.senderLabel, input.bodyMarkdown],
  );

  // Oppdater request-status basert på avsender.
  const newStatus: ClientRequestStatus | null =
    input.sender === "client" || input.markAnswered
      ? "answered"
      : input.sender === "marketer"
      ? "in_progress"
      : null;
  if (newStatus) {
    await input.pool.query(
      `UPDATE role_room_client_requests
          SET status = $2,
              updated_at = NOW(),
              answered_at = CASE WHEN $2 = 'answered' THEN NOW() ELSE answered_at END
        WHERE id = $1`,
      [input.requestId, newStatus],
    );
  }

  return mapMessageRow(r.rows[0]);
}

export async function closeClientRequest(
  pool: Pool,
  id: string,
): Promise<boolean> {
  await ensureSchema(pool);
  const r = await pool.query(
    `UPDATE role_room_client_requests
        SET status = 'closed', updated_at = NOW()
      WHERE id = $1`,
    [id],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Bygg klient-portal-magic-link med deep-link til en spesifikk request.
 *  Frontend-route /client/portal/:token håndterer authentisering, og
 *  `?request=<id>`-param sier hvilken request som skal scrolles til. */
function buildPortalLink(sessionToken: string, requestId: string): string {
  const base = (process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "");
  const path = `/client/portal/${sessionToken}?request=${encodeURIComponent(requestId)}`;
  return base ? `${base}${path}` : path;
}
