#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { config as loadDotenv } from "dotenv";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import { Pool } from "pg";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(repoRoot, "backend", ".env"), override: false, quiet: true });

const DEFAULT_BASE_URL = "https://theroleroom.com";
const baseUrl = (process.env.ROLE_ROOM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/u, "");
const expectedSha = process.env.ROLE_ROOM_EXPECTED_SHA || "";
const allowProdWrite = process.env.ROLE_ROOM_GOOGLE_WORKSPACE_LIVE_E2E_ALLOW_PROD_WRITE === "1";
const cleanup = process.env.ROLE_ROOM_GOOGLE_WORKSPACE_LIVE_E2E_CLEANUP !== "0";
const renderServiceId = process.env.ROLE_ROOM_RENDER_SERVICE_ID || "srv-d76ob60ule4c73dv2p60";
const renderApiKeyService = process.env.RENDER_API_KEYCHAIN_SERVICE || "creatorhub-render-api-key";
const renderApiKeyAccount = process.env.RENDER_API_KEYCHAIN_ACCOUNT || "usmanqazi";
const importRenderEnv = process.env.ROLE_ROOM_GOOGLE_WORKSPACE_LIVE_E2E_IMPORT_RENDER_ENV !== "0"
  && baseUrl === DEFAULT_BASE_URL;
const runId = `google-ws-live-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
const sessionToken = `rr-google-live-e2e-${crypto.randomUUID()}`;
const generatedUserId = `role-room-google-live-e2e-${runId}`;
const generatedUserEmail = `role-room-google-live-e2e+${runId}@creatorhub.test`;
let userId = generatedUserId;
let userEmail = generatedUserEmail;
const projectName = `RR Google Workspace Live E2E ${runId}`;

const ROLE_ROOM_GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.activity.readonly",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/tasks.readonly",
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages",
  "https://www.googleapis.com/auth/chat.messages.readonly",
  "https://www.googleapis.com/auth/chat.messages.create",
  "https://www.googleapis.com/auth/chat.spaces.create",
  "https://www.googleapis.com/auth/chat.memberships.readonly",
  "https://www.googleapis.com/auth/chat.messages.reactions.create",
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.upload",
];

const REQUIRED_ENV = [
  "DATABASE_URL",
  "ROLE_ROOM_GOOGLE_CLIENT_ID",
  "ROLE_ROOM_GOOGLE_CLIENT_SECRET",
];

const RENDER_RUNTIME_ENV_KEYS = new Set([
  "DATABASE_URL",
  "ROLE_ROOM_GOOGLE_CLIENT_ID",
  "ROLE_ROOM_GOOGLE_CLIENT_SECRET",
  "ROLE_ROOM_GOOGLE_REDIRECT_URI",
  "ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY",
  "SESSION_SECRET",
  "JWT_SECRET",
  "AUTH_SECRET",
]);

const commandExists = (command) => {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { stdio: "ignore" });
  return result.status === 0;
};

const getRenderApiKey = () => {
  let keychainApiKey = "";
  try {
    if (process.platform === "darwin" && commandExists("security")) {
      keychainApiKey = execFileSync("security", [
        "find-generic-password",
        "-s",
        renderApiKeyService,
        "-a",
        renderApiKeyAccount,
        "-w",
      ], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    }
  } catch {
    keychainApiKey = "";
  }
  return keychainApiKey || process.env.RENDER_API_KEY || "";
};

const importRenderRuntimeEnv = async () => {
  if (!importRenderEnv) {
    return [];
  }

  const apiKey = getRenderApiKey();
  if (!apiKey) {
    throw new Error("Missing Render API key in Keychain/RENDER_API_KEY for production Google Workspace E2E");
  }

  const importedKeys = [];
  let cursor = "";
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`https://api.render.com/v1/services/${renderServiceId}/env-vars`);
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload)) {
      throw new Error(`Render env fetch failed with status ${response.status}`);
    }

    for (const item of payload) {
      const envVar = item?.envVar ?? item;
      if (!envVar?.key || !RENDER_RUNTIME_ENV_KEYS.has(envVar.key) || typeof envVar.value !== "string") {
        continue;
      }
      process.env[envVar.key] = envVar.value;
      importedKeys.push(envVar.key);
    }

    cursor = payload.at(-1)?.cursor || "";
    if (!cursor || payload.length === 0) {
      break;
    }
  }
  return Array.from(new Set(importedKeys)).sort();
};

if (baseUrl === DEFAULT_BASE_URL && !allowProdWrite) {
  throw new Error(
    "Refusing to write to production without ROLE_ROOM_GOOGLE_WORKSPACE_LIVE_E2E_ALLOW_PROD_WRITE=1",
  );
}

const importedRenderEnvKeys = await importRenderRuntimeEnv();

const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
if (missingEnv.length > 0) {
  throw new Error(`Missing required env for live Google Workspace E2E: ${missingEnv.join(", ")}`);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

const authHeaders = {
  authorization: `Bearer ${sessionToken}`,
  "content-type": "application/json",
};

const fail = (message, details = {}) => {
  throw new Error(`${message}\n${JSON.stringify(details, null, 2)}`);
};

const readString = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

const fetchText = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
};

const fetchJson = async (url, options = {}) => {
  const { response, text } = await fetchText(url, options);
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parseError: true, raw: text.slice(0, 500) };
  }
  return { response, body };
};

const assertOkJson = async (label, url, options = {}) => {
  const { response, body } = await fetchJson(url, options);
  if (!response.ok) {
    fail(`${label} failed`, { status: response.status, body });
  }
  return body;
};

const assertShaMatches = (label, actualSha) => {
  if (!expectedSha) return;
  if (!actualSha || !String(actualSha).startsWith(expectedSha)) {
    fail(`${label} does not match expected SHA`, { expectedSha, actualSha });
  }
};

const getGoogleOAuthClient = () => {
  const redirectUri = readString(process.env.ROLE_ROOM_GOOGLE_REDIRECT_URI)
    || `${baseUrl}/api/role-room/google/oauth/callback`;
  const client = new google.auth.OAuth2(
    process.env.ROLE_ROOM_GOOGLE_CLIENT_ID,
    process.env.ROLE_ROOM_GOOGLE_CLIENT_SECRET,
    redirectUri,
  );
  client.setCredentials({
    refresh_token: process.env.GOOGLE_WORKSPACE_REFRESH_TOKEN,
  });
  return client;
};

const getEncryptionKey = () => {
  const secret = readString(process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY)
    || readString(process.env.SESSION_SECRET)
    || readString(process.env.JWT_SECRET)
    || readString(process.env.AUTH_SECRET);
  if (!secret) {
    throw new Error("Missing token encryption secret: ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY/SESSION_SECRET/JWT_SECRET/AUTH_SECRET");
  }
  return crypto.createHash("sha256").update(secret).digest();
};

const encryptRoleRoomGoogleToken = (value) => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
};

const decryptRoleRoomGoogleToken = (value) => {
  if (!value) return null;
  const [version, ivPart, tagPart, encryptedPart] = String(value).split(".");
  if (version !== "v1" || !ivPart || !tagPart || !encryptedPart) {
    return null;
  }
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
};

const ensureAuthSessionTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS creatorhub_auth_sessions (
      token TEXT PRIMARY KEY,
      session_data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const insertLiveE2eSession = async () => {
  const session = {
    userId,
    email: userEmail,
    name: "Role Room Google Live E2E",
    role: "content_producer",
    roleLabel: "Content Producer",
    permissions: ["read", "write"],
    profession: "content_producer",
    userType: "content_producer",
    displayName: "Role Room Google Live E2E",
    isAdmin: false,
    loginAs: "content_producer",
    requestedRole: "content_producer",
    loginAt: new Date().toISOString(),
  };

  await pool.query(
    `INSERT INTO creatorhub_auth_sessions (token, session_data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (token)
     DO UPDATE SET session_data = EXCLUDED.session_data, updated_at = NOW()`,
    [sessionToken, JSON.stringify(session)],
  );
  return session;
};

const createLiveProject = async () => {
  const project = await assertOkJson("Create Role Room project", `${baseUrl}/api/role-room/projects`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: projectName,
      description: "Created by live Google Workspace E2E; safe to delete.",
      genre: "content_production",
      projectType: "content_production",
      currency: "NOK",
    }),
  });
  if (!project?.id) {
    fail("Create Role Room project returned no id", { project });
  }
  return project;
};

const fetchGoogleProfile = async (oauthClient) => {
  const tokenResponse = await oauthClient.getAccessToken();
  const accessToken = readString(typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token)
    || readString(oauthClient.credentials.access_token);
  if (!accessToken) {
    fail("Google refresh token did not produce an access token");
  }

  const oauth2Api = google.oauth2({ version: "v2", auth: oauthClient });
  const profileResponse = await oauth2Api.userinfo.get();
  const email = readString(profileResponse.data.email);
  const subject = readString(profileResponse.data.id);
  if (!email || !subject) {
    fail("Google userinfo did not return verified identity", {
      hasEmail: Boolean(email),
      hasSubject: Boolean(subject),
    });
  }

  return {
    accessToken,
    refreshToken: process.env.GOOGLE_WORKSPACE_REFRESH_TOKEN,
    expiryDate: typeof oauthClient.credentials.expiry_date === "number"
      ? oauthClient.credentials.expiry_date
      : Date.now() + 55 * 60 * 1000,
    email,
    subject,
    profile: {
      id: subject,
      email,
      verified_email: profileResponse.data.verified_email ?? null,
      name: profileResponse.data.name ?? email,
      given_name: profileResponse.data.given_name ?? null,
      family_name: profileResponse.data.family_name ?? null,
      picture: profileResponse.data.picture ?? null,
      source: "live_e2e_refresh_token",
    },
  };
};

const ensureGoogleTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_google_connections (
      id UUID PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      role_room_email VARCHAR(255),
      google_email VARCHAR(255),
      google_subject VARCHAR(255),
      access_token_encrypted TEXT,
      refresh_token_encrypted TEXT,
      expiry_date TIMESTAMPTZ,
      scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
      connection_state VARCHAR(32) NOT NULL DEFAULT 'disconnected',
      last_error TEXT,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      oauth_app VARCHAR(32) NOT NULL DEFAULT 'role_room',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_connections_user_app_unique
      ON role_room_google_connections(user_id, oauth_app)
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_connections_subject_app_unique
      ON role_room_google_connections(google_subject, oauth_app)
      WHERE google_subject IS NOT NULL
  `);
};

const upsertLiveGoogleConnection = async (profile) => {
  await ensureGoogleTables();

  const existingConnection = await pool.query(
    `SELECT id, user_id, role_room_email
     FROM role_room_google_connections
     WHERE google_subject = $1
       AND oauth_app = 'role_room'
     LIMIT 1`,
    [profile.subject],
  );
  if (existingConnection.rows[0]) {
    userId = existingConnection.rows[0].user_id;
    userEmail = readString(existingConnection.rows[0].role_room_email) || generatedUserEmail;
    return {
      id: existingConnection.rows[0].id,
      inserted: false,
    };
  }

  const result = await pool.query(
    `INSERT INTO role_room_google_connections (
      id, user_id, role_room_email, google_email, google_subject,
      access_token_encrypted, refresh_token_encrypted, expiry_date, scopes,
      connection_state, last_error, profile, oauth_app, created_at, updated_at, last_used_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9::jsonb,
      'connected', NULL, $10::jsonb, 'role_room', NOW(), NOW(), NOW()
    )
    ON CONFLICT (user_id, oauth_app) DO UPDATE SET
      role_room_email = EXCLUDED.role_room_email,
      google_email = EXCLUDED.google_email,
      google_subject = EXCLUDED.google_subject,
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      expiry_date = EXCLUDED.expiry_date,
      scopes = EXCLUDED.scopes,
      connection_state = 'connected',
      last_error = NULL,
      profile = EXCLUDED.profile,
      updated_at = NOW(),
      last_used_at = NOW()
    RETURNING id`,
    [
      crypto.randomUUID(),
      userId,
      userEmail,
      profile.email,
      profile.subject,
      encryptRoleRoomGoogleToken(profile.accessToken),
      encryptRoleRoomGoogleToken(profile.refreshToken),
      new Date(profile.expiryDate).toISOString(),
      JSON.stringify(ROLE_ROOM_GOOGLE_SCOPES),
      JSON.stringify(profile.profile),
    ],
  );
  return {
    id: result.rows[0]?.id,
    inserted: true,
  };
};

const findUsableRoleRoomGoogleConnection = async () => {
  await ensureGoogleTables();
  const result = await pool.query(
    `SELECT id, user_id, role_room_email, google_email, google_subject,
            access_token_encrypted, refresh_token_encrypted, expiry_date, scopes, updated_at, last_used_at
     FROM role_room_google_connections
     WHERE oauth_app = 'role_room'
       AND connection_state = 'connected'
       AND refresh_token_encrypted IS NOT NULL
     ORDER BY last_used_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 5`,
  );

  const attempts = [];
  for (const connection of result.rows) {
    const refreshToken = decryptRoleRoomGoogleToken(connection.refresh_token_encrypted);
    const accessToken = decryptRoleRoomGoogleToken(connection.access_token_encrypted);
    if (!refreshToken) {
      attempts.push({ userId: connection.user_id, ok: false, reason: "refresh token could not be decrypted" });
      continue;
    }

    const oauthClient = getGoogleOAuthClient();
    oauthClient.setCredentials({
      access_token: accessToken ?? undefined,
      refresh_token: refreshToken,
      expiry_date: connection.expiry_date ? Date.parse(connection.expiry_date) : undefined,
    });

    try {
      await oauthClient.getAccessToken();
      const oauth2Api = google.oauth2({ version: "v2", auth: oauthClient });
      const profileResponse = await oauth2Api.userinfo.get();
      const email = readString(profileResponse.data.email) ?? readString(connection.google_email);
      const subject = readString(profileResponse.data.id) ?? readString(connection.google_subject);
      if (!email || !subject) {
        attempts.push({ userId: connection.user_id, ok: false, reason: "Google userinfo missing email or subject" });
        continue;
      }

      userId = connection.user_id;
      userEmail = readString(connection.role_room_email) || email || generatedUserEmail;
      return {
        connection,
        oauthClient,
        profile: {
          email,
          subject,
          profile: {
            id: subject,
            email,
            verified_email: profileResponse.data.verified_email ?? null,
            name: profileResponse.data.name ?? email,
            given_name: profileResponse.data.given_name ?? null,
            family_name: profileResponse.data.family_name ?? null,
            picture: profileResponse.data.picture ?? null,
            source: "existing_role_room_google_connection",
          },
        },
      };
    } catch (error) {
      attempts.push({
        userId: connection.user_id,
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
        status: error?.response?.status ?? null,
        googleError: error?.response?.data?.error ?? null,
      });
    }
  }

  fail("No usable connected Role Room Google Workspace connection found", {
    candidateCount: result.rowCount,
    attempts,
    hint: "Logg inn i The Role Room med Google Workspace, eller oppdater Render OAuth/encryption env slik at eksisterende refresh-token kan brukes.",
  });
};

const seedProducerInputs = async (projectId) => {
  await assertOkJson("Save client intake", `${baseUrl}/api/role-room/projects/${projectId}/producer/client-intake`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      projectGoal: "Live E2E Google Workspace seamless verification",
      deliverables: "Drive workspace, calendar, Meet session, generated artifact and contact lookup.",
      targetAudience: "Internal QA",
      keyMessage: "Google Workspace should feel native inside Role Room.",
      timingConstraints: "Immediate",
      contactName: "Google Live E2E Client",
      contactEmail: "google-client-e2e@creatorhub.test",
      metadata: { runId },
    }),
  });
};

const assertBindingReady = (binding, label) => {
  if (!binding?.driveRootFolderId) {
    fail(`${label}: missing driveRootFolderId`, { binding });
  }
  if (!binding?.calendarId || binding.calendarId === "primary") {
    fail(`${label}: missing dedicated project calendar`, { calendarId: binding?.calendarId });
  }
  const folderLayout = binding.folderLayout || {};
  const missingFolders = ["brief", "materials", "brand", "delivery", "approvals", "meetings"]
    .filter((key) => !readString(folderLayout[key]));
  if (missingFolders.length > 0) {
    fail(`${label}: missing Drive folder layout`, { missingFolders, folderLayout });
  }
};

const verifyGoogleArtifactsDirectly = async (oauthClient, binding, artifactIds) => {
  const driveApi = google.drive({ version: "v3", auth: oauthClient });
  const calendarApi = google.calendar({ version: "v3", auth: oauthClient });

  const root = await driveApi.files.get({
    fileId: binding.driveRootFolderId,
    fields: "id,name,mimeType,trashed",
    supportsAllDrives: true,
  });
  if (root.data.trashed || root.data.mimeType !== "application/vnd.google-apps.folder") {
    fail("Drive root folder is not an active Google folder", { root: root.data });
  }

  const subfolders = await driveApi.files.list({
    q: `'${binding.driveRootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if ((subfolders.data.files || []).length < 6) {
    fail("Drive folder layout was not provisioned in Google Drive", {
      folderCount: subfolders.data.files?.length || 0,
    });
  }

  const calendar = await calendarApi.calendars.get({ calendarId: binding.calendarId });
  if (!String(calendar.data.summary || "").includes(projectName)) {
    fail("Google Calendar summary does not match test project", {
      calendarId: binding.calendarId,
      summary: calendar.data.summary,
    });
  }

  for (const fileId of artifactIds.driveFileIds) {
    const file = await driveApi.files.get({
      fileId,
      fields: "id,name,trashed",
      supportsAllDrives: true,
    });
    if (file.data.trashed) {
      fail("Drive artifact is trashed immediately after sync", { fileId });
    }
  }

  for (const eventId of artifactIds.calendarEventIds) {
    const event = await calendarApi.events.get({
      calendarId: binding.calendarId,
      eventId,
    });
    if (!event.data.id || event.data.status === "cancelled") {
      fail("Calendar event artifact is not active", { eventId, status: event.data.status });
    }
  }
};

const runBrowserSmoke = async (session, projectId) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const matchingConsoleErrors = [];
  const failedRequests = [];
  const statusRequestCounts = new Map();
  const errorPattern =
    /ERR_INSUFFICIENT_RESOURCES|\[MODULE ERROR\]|Cannot access .* before initialization|Google Workspace.*failed|Failed to load Google access status/i;
  const statusPattern = /\/api\/role-room\/google\/status/;

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()) && errorPattern.test(message.text())) {
      matchingConsoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("request", (request) => {
    if (statusPattern.test(request.url())) {
      statusRequestCounts.set(request.url(), (statusRequestCounts.get(request.url()) || 0) + 1);
    }
  });
  page.on("requestfailed", (request) => {
    if (statusPattern.test(request.url())) {
      failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || "request failed"}`);
    }
  });

  await page.addInitScript(
    ({ token, user, activeProjectId }) => {
      window.localStorage.setItem("creatorhub_auth_token", token);
      window.localStorage.setItem("creatorhub_auth_user", JSON.stringify(user));
      window.localStorage.setItem("role_room_auth_token", token);
      window.localStorage.setItem(
        "role_room_auth_session",
        JSON.stringify({
          token,
          currentUserId: user.id,
          adminUser: {
            id: user.id,
            email: user.email,
            role: user.role,
            requestedRole: "content_producer",
            loginAs: "content_producer",
          },
        }),
      );
      window.localStorage.setItem("role-room-last-project-id", activeProjectId);
      window.localStorage.setItem(
        "roleRoom_workspaceState_content_producer",
        JSON.stringify({
          activeProjectId,
          activeTab: "media",
          producerMediaFocus: { workspace: "meetings" },
          updatedAt: new Date().toISOString(),
        }),
      );
    },
    {
      token: sessionToken,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        profession: session.profession,
      },
      activeProjectId: projectId,
    },
  );

  await page.goto(`${baseUrl}/theroleroom`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(Number(process.env.ROLE_ROOM_GOOGLE_WORKSPACE_LIVE_BROWSER_WAIT_MS || 10_000));
  await browser.close();

  const excessiveStatusRequests = Array.from(statusRequestCounts.entries())
    .filter(([, count]) => count > 6)
    .map(([url, count]) => ({ url, count }));
  if (matchingConsoleErrors.length || failedRequests.length || excessiveStatusRequests.length) {
    fail("Browser seamless smoke failed", {
      matchingConsoleErrors,
      failedRequests,
      excessiveStatusRequests,
    });
  }
  return Object.fromEntries(statusRequestCounts);
};

const cleanupGoogleArtifacts = async (oauthClient, binding, artifactIds) => {
  if (!cleanup || !binding) return;
  const driveApi = google.drive({ version: "v3", auth: oauthClient });
  const calendarApi = google.calendar({ version: "v3", auth: oauthClient });

  for (const eventId of artifactIds.calendarEventIds) {
    if (!binding.calendarId) continue;
    await calendarApi.events.delete({
      calendarId: binding.calendarId,
      eventId,
    }).catch(() => undefined);
  }

  if (binding.calendarId && binding.calendarId !== "primary") {
    await calendarApi.calendars.delete({ calendarId: binding.calendarId }).catch(() => undefined);
  }

  for (const fileId of artifactIds.driveFileIds) {
    await driveApi.files.delete({ fileId, supportsAllDrives: true }).catch(() => undefined);
  }

  if (binding.driveRootFolderId) {
    await driveApi.files.delete({
      fileId: binding.driveRootFolderId,
      supportsAllDrives: true,
    }).catch(async () => {
      await driveApi.files.update({
        fileId: binding.driveRootFolderId,
        requestBody: { trashed: true },
        supportsAllDrives: true,
      }).catch(() => undefined);
    });
  }
};

const cleanupDatabase = async (projectId) => {
  if (!cleanup) return;
  await pool.query("DELETE FROM role_room_google_agreement_signatures WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM role_room_google_artifacts WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM role_room_google_project_bindings WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM role_room_client_materials WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM role_room_client_intake WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM casting_user_roles WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM casting_projects WHERE id = $1", [projectId]).catch(() => undefined);
  if (insertedGoogleConnection) {
    await pool.query("DELETE FROM role_room_google_connections WHERE user_id = $1 AND oauth_app = 'role_room'", [userId]).catch(() => undefined);
  }
  await pool.query("DELETE FROM creatorhub_auth_sessions WHERE token = $1", [sessionToken]).catch(() => undefined);
};

let projectId = "";
let finalBinding = null;
let insertedGoogleConnection = false;
const artifactIds = {
  driveFileIds: [],
  calendarEventIds: [],
};
let oauthClient = null;

try {
  const health = await assertOkJson("Backend health", `${baseUrl}/api/health`);
  assertShaMatches("Backend commit", health.commit);

  const googleConnection = await findUsableRoleRoomGoogleConnection();
  oauthClient = googleConnection.oauthClient;
  const googleProfile = googleConnection.profile;
  await ensureAuthSessionTable();
  const session = await insertLiveE2eSession();

  const authUser = await assertOkJson("Warm persisted auth session", `${baseUrl}/api/auth/user`, {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  if (!authUser?.authenticated || authUser.user?.id !== userId) {
    fail("Persisted auth session did not resolve through backend", { authUser });
  }

  const project = await createLiveProject();
  projectId = project.id;
  await seedProducerInputs(projectId);

  const oauthStart = await assertOkJson("Start Google link OAuth", `${baseUrl}/api/role-room/google/oauth/start`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      mode: "link",
      projectId,
      browserOrigin: baseUrl,
      returnPath: "/theroleroom",
      email: googleProfile.email,
    }),
  });
  if (!oauthStart.authorizationUrl || !String(oauthStart.authorizationUrl).includes("accounts.google.com")) {
    fail("Google OAuth start did not return a Google authorization URL", {
      mode: oauthStart.mode,
      hasAuthorizationUrl: Boolean(oauthStart.authorizationUrl),
    });
  }

  const initialStatus = await assertOkJson("Initial Google status", `${baseUrl}/api/role-room/google/status?projectId=${encodeURIComponent(projectId)}`, {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  if (initialStatus.state !== "connected" || initialStatus.connection?.userId !== userId) {
    fail("Google status is not connected for the Role Room session", {
      state: initialStatus.state,
      connectionUserId: initialStatus.connection?.userId,
    });
  }

  const provision = await assertOkJson("Provision Google Workspace", `${baseUrl}/api/role-room/projects/${projectId}/google/provision`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      contactsContext: { source: "live_e2e", runId },
    }),
  });
  assertBindingReady(provision.binding, "Provision");
  finalBinding = provision.binding;

  const generatedArtifactContent = JSON.stringify({
    runId,
    projectId,
    source: "role_room_google_workspace_live_e2e",
    generatedAt: new Date().toISOString(),
  }, null, 2);
  const driveSync = await assertOkJson("Sync generated Drive artifact", `${baseUrl}/api/role-room/projects/${projectId}/google/drive/sync`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      generatedArtifacts: [
        {
          localEntityType: "live_e2e",
          localEntityId: runId,
          artifactType: "drive_file",
          title: `Google Workspace live E2E ${runId}.json`,
          folderKey: "delivery",
          mimeType: "application/json",
          contentText: generatedArtifactContent,
          sourceLabel: "live_e2e",
          metadata: { runId },
        },
      ],
    }),
  });
  const syncedDriveFileIds = (driveSync.syncedArtifacts || [])
    .map((artifact) => readString(artifact.driveFileId) || readString(artifact.drive_file_id))
    .filter(Boolean);
  if (syncedDriveFileIds.length < 1) {
    fail("Drive sync did not return a real Drive artifact", { driveSync });
  }
  artifactIds.driveFileIds.push(...syncedDriveFileIds);
  finalBinding = driveSync.binding || finalBinding;

  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const calendarSync = await assertOkJson("Sync project calendar event", `${baseUrl}/api/role-room/projects/${projectId}/google/calendar/sync`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      events: [
        {
          entityType: "live_e2e",
          entityId: `${runId}-calendar`,
          title: `Role Room Google live E2E ${runId}`,
          description: "Created by live E2E and cleaned up after verification.",
          start: start.toISOString(),
          end: end.toISOString(),
          phase: "qa",
          includeMeet: false,
        },
      ],
    }),
  });
  const syncedEventIds = (calendarSync.syncedEvents || [])
    .map((artifact) => readString(artifact.calendarEventId) || readString(artifact.calendar_event_id))
    .filter(Boolean);
  if (syncedEventIds.length < 1) {
    fail("Calendar sync did not return a real calendar event", { calendarSync });
  }
  artifactIds.calendarEventIds.push(...syncedEventIds);
  finalBinding = calendarSync.binding || finalBinding;

  const meetSession = await assertOkJson("Create Google Meet session", `${baseUrl}/api/role-room/projects/${projectId}/google/meet/session`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      entityType: "live_e2e",
      entityId: `${runId}-meet`,
      title: `Role Room Google Meet live E2E ${runId}`,
      description: "Created by live E2E and cleaned up after verification.",
      start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      location: "Google Meet",
      includeMeet: true,
    }),
  });
  const meetEventId = readString(meetSession.event?.calendarEventId);
  if (!meetEventId || !readString(meetSession.event?.meetUrl)) {
    fail("Meet session did not return a calendar event and Meet URL", { event: meetSession.event });
  }
  artifactIds.calendarEventIds.push(meetEventId);
  finalBinding = meetSession.binding || finalBinding;

  const calendarDetails = await assertOkJson("Fetch project calendar", `${baseUrl}/api/role-room/projects/${projectId}/google/calendar`, {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  if (!calendarDetails.calendar?.id || !Array.isArray(calendarDetails.events)) {
    fail("Project calendar endpoint did not return calendar details", { calendarDetails });
  }

  const people = await assertOkJson("Search Google people", `${baseUrl}/api/role-room/projects/${projectId}/google/people/search?q=${encodeURIComponent(googleProfile.email.split("@")[0])}`, {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  if (!Array.isArray(people.contacts) || !people.contactsContext) {
    fail("People search did not return the expected response shape", { people });
  }

  const finalStatus = await assertOkJson("Final Google status", `${baseUrl}/api/role-room/google/status?projectId=${encodeURIComponent(projectId)}`, {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  assertBindingReady(finalStatus.projectBinding, "Final status");
  if ((finalStatus.artifacts || []).length < 3) {
    fail("Final Google status did not include Drive, calendar and Meet artifacts", {
      artifactCount: finalStatus.artifacts?.length || 0,
    });
  }

  await verifyGoogleArtifactsDirectly(oauthClient, finalStatus.projectBinding, artifactIds);
  const statusRequestCounts = await runBrowserSmoke(session, projectId);

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    expectedSha: expectedSha || null,
    backendCommit: health.commit || null,
    runId,
    projectId,
    cleanup,
    renderRuntimeEnvImported: importRenderEnv ? importedRenderEnvKeys : [],
    google: {
      connected: true,
      emailDomain: googleProfile.email.split("@")[1] || null,
      connectionSource: googleProfile.profile.source,
    },
    verified: [
      "persisted Role Room auth session",
      "existing Role Room Google connection decrypts and resolves real Google identity",
      "Role Room Google OAuth start returns Google authorization URL",
      "Role Room Google connection is connected for the session",
      "project Drive root and six-folder layout provisioned in Google Drive",
      "dedicated Google Calendar provisioned",
      "generated artifact synced to Google Drive",
      "calendar event synced to Google Calendar",
      "Google Meet session created with Meet URL",
      "project calendar readback works",
      "People search endpoint responds through Google Workspace layer",
      "final status includes binding and artifacts",
      "direct Google API readback validates Drive and Calendar artifacts",
      "browser smoke has no Google status request storm or console errors",
    ],
    artifacts: {
      driveFiles: artifactIds.driveFileIds.length,
      calendarEvents: artifactIds.calendarEventIds.length,
      statusRequestCounts,
    },
  }, null, 2));
} finally {
  if (oauthClient && finalBinding) {
    await cleanupGoogleArtifacts(oauthClient, finalBinding, artifactIds);
  }
  if (projectId) {
    await cleanupDatabase(projectId);
  } else if (cleanup) {
    if (insertedGoogleConnection) {
      await pool.query("DELETE FROM role_room_google_connections WHERE user_id = $1 AND oauth_app = 'role_room'", [userId]).catch(() => undefined);
    }
    await pool.query("DELETE FROM creatorhub_auth_sessions WHERE token = $1", [sessionToken]).catch(() => undefined);
  }
  await pool.end();
}
