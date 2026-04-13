#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(repoRoot, "backend", ".env"), override: false, quiet: true });

const DEFAULT_BASE_URL = "https://theroleroom.com";
const baseUrl = (process.env.ROLE_ROOM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/u, "");
const expectedSha = process.env.ROLE_ROOM_EXPECTED_SHA || "";
const allowProdWrite = process.env.ROLE_ROOM_EXPORTER_LIVE_E2E_ALLOW_PROD_WRITE === "1";
const cleanup = process.env.ROLE_ROOM_EXPORTER_LIVE_E2E_CLEANUP !== "0";
const runId = `export-live-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
const sessionToken = `rr-live-e2e-${crypto.randomUUID()}`;
const userId = `role-room-live-e2e-${runId}`;
const userEmail = `role-room-live-e2e+${runId}@creatorhub.test`;
const projectStateKey = (projectId) => `compat:project-state:${projectId}`;

if (baseUrl === DEFAULT_BASE_URL && !allowProdWrite) {
  throw new Error(
    "Refusing to write to production without ROLE_ROOM_EXPORTER_LIVE_E2E_ALLOW_PROD_WRITE=1",
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Set it or keep backend/.env available.");
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
    name: "Role Room Live E2E",
    role: "admin",
    roleLabel: "Admin",
    permissions: ["read", "write", "admin"],
    profession: "content_producer",
    userType: "content_producer",
    displayName: "Role Room Live E2E",
    isAdmin: true,
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

const cleanupDatabase = async (projectId, fileIds) => {
  if (!cleanup) return;

  for (const fileId of fileIds) {
    await fetch(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${sessionToken}` },
    }).catch(() => undefined);
  }

  await pool.query("DELETE FROM role_room_client_materials WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM role_room_client_intake WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM role_room_client_review_comments WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM role_room_client_reviews WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM role_room_phase_timeline_items WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM legacy_compat_store WHERE store_key = $1", [projectStateKey(projectId)]).catch(() => undefined);
  await pool.query("DELETE FROM casting_user_roles WHERE project_id = $1", [projectId]).catch(() => undefined);
  await pool.query("DELETE FROM casting_projects WHERE id = $1", [projectId]).catch(() => undefined);
};

const cleanupSession = async () => {
  if (!cleanup) return;
  await pool.query("DELETE FROM creatorhub_auth_sessions WHERE token = $1", [sessionToken]).catch(() => undefined);
};

const createLiveProject = async () => {
  const project = await assertOkJson("Create Role Room project", `${baseUrl}/api/role-room/projects`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: `RR Export Live E2E ${runId}`,
      description: "Created by live exporter E2E; safe to delete.",
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

const seedProducerInputs = async (projectId) => {
  await assertOkJson("Save client intake", `${baseUrl}/api/role-room/projects/${projectId}/producer/client-intake`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      projectGoal: "Live E2E exporter verification",
      deliverables: "Client package, delivery workspace, manifest and PDF.",
      targetAudience: "Internal QA",
      keyMessage: "Exporter must persist real files and share links.",
      timingConstraints: "Immediate",
      brandNotes: "No fake data in this flow.",
      materialOverview: "One real material row seeded via backend.",
      referenceLinks: "https://theroleroom.com",
      contactName: "Live E2E Client",
      contactEmail: "client-e2e@creatorhub.test",
      additionalNotes: "Cleanup is performed after verification.",
      metadata: { runId },
    }),
  });

  await assertOkJson("Create client material", `${baseUrl}/api/role-room/projects/${projectId}/producer/client-materials`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      entryType: "brand_asset",
      title: "Live E2E logo reference",
      description: "Real material row used by exporter live E2E.",
      externalUrl: "https://theroleroom.com/build-info.json",
      phase: "preproduction",
      status: "provided",
      metadata: {
        runId,
        fileName: "role-room-live-e2e-logo-reference.json",
        sourceLabel: "Live E2E",
        priority: "critical",
      },
    }),
  });

  const [intake, materials] = await Promise.all([
    assertOkJson("Fetch client intake", `${baseUrl}/api/role-room/projects/${projectId}/producer/client-intake`, {
      headers: { authorization: `Bearer ${sessionToken}` },
    }),
    assertOkJson("Fetch client materials", `${baseUrl}/api/role-room/projects/${projectId}/producer/client-materials`, {
      headers: { authorization: `Bearer ${sessionToken}` },
    }),
  ]);

  if (!intake?.intake?.project_goal) {
    fail("Client intake did not persist", { intake });
  }
  if (!Array.isArray(materials?.items) || materials.items.length < 1) {
    fail("Client material did not persist", { materials });
  }
};

const uploadProjectFile = async (projectId) => {
  const payload = {
    runId,
    projectId,
    generatedAt: new Date().toISOString(),
    files: ["client-package.json", "delivery-manifest.json"],
  };
  const fileBuffer = Buffer.from(JSON.stringify(payload, null, 2));
  const form = new FormData();
  form.append(
    "file",
    new Blob([fileBuffer], { type: "application/json" }),
    `rr-export-live-e2e-${runId}.json`,
  );
  form.append(
    "metadata",
    JSON.stringify({
      source: "role_room_client_handoff_package",
      packageName: `rr-export-live-e2e-${runId}`,
      folderPath: `client-handoff/${runId}`,
      versionLabel: "live-e2e",
      runId,
    }),
  );

  const { response, body } = await fetchJson(`${baseUrl}/api/projects/${projectId}/files`, {
    method: "POST",
    headers: { authorization: `Bearer ${sessionToken}` },
    body: form,
  });

  if (response.status !== 201 || !body?.id) {
    fail("Project file upload failed", { status: response.status, body });
  }
  if (body.storagePath || body.contentBase64) {
    fail("Project file response leaked private storage fields", { body });
  }
  return { file: body, expectedBody: fileBuffer.toString("utf8") };
};

const verifyProjectFile = async (projectId, fileId, expectedBody) => {
  const files = await assertOkJson("List project files", `${baseUrl}/api/projects/${projectId}/files`, {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  const listedFile = Array.isArray(files) ? files.find((file) => file.id === fileId) : null;
  if (!listedFile) {
    fail("Uploaded project file was not returned by list endpoint", { files });
  }
  if (listedFile.storagePath || listedFile.contentBase64) {
    fail("Project file list leaked private storage fields", { listedFile });
  }

  const share = await assertOkJson("Share project file", `${baseUrl}/api/projects/${projectId}/files/${fileId}/share`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ expiresInHours: 2 }),
  });
  if (!share?.success || !String(share.shareUrl || "").includes(fileId)) {
    fail("Share endpoint did not return a usable share URL", { share });
  }

  const download = await fetchText(`${baseUrl}/api/projects/${projectId}/files/${fileId}/download`, {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  if (!download.response.ok || download.text !== expectedBody) {
    fail("Downloaded file did not match uploaded file", {
      status: download.response.status,
      expectedLength: expectedBody.length,
      actualLength: download.text.length,
    });
  }

  const persisted = await pool.query(
    "SELECT store_value FROM legacy_compat_store WHERE store_key = $1 LIMIT 1",
    [projectStateKey(projectId)],
  );
  const state = persisted.rows[0]?.store_value;
  const persistedFile = Array.isArray(state?.files)
    ? state.files.find((file) => file.id === fileId)
    : null;
  if (!persistedFile) {
    fail("Uploaded project file was not persisted in DB compat store", { state });
  }
  if (persistedFile.contentEncoding !== "base64" || !persistedFile.contentBase64) {
    fail("Small exporter artifact was not stored with DB-inline fallback", {
      storageBackend: persistedFile.storageBackend,
      contentInlineBytes: persistedFile.contentInlineBytes,
    });
  }
};

const verifyBrowserSmoke = async (session, projectId) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const matchingConsoleErrors = [];
  const failedRequests = [];
  const statusRequestCounts = new Map();
  const errorPattern =
    /ERR_INSUFFICIENT_RESOURCES|\[MODULE ERROR\]|Cannot access .* before initialization|Failed to load Google access status|Failed to load LinkedIn access status/i;
  const statusPattern = /\/api\/role-room\/(google|linkedin)\/status/;

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
            role: "admin",
            requestedRole: "content_producer",
            loginAs: "content_producer",
          },
        }),
      );
      window.localStorage.setItem("role-room-last-project-id", activeProjectId);
    },
    {
      token: sessionToken,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        isAdmin: true,
        profession: session.profession,
      },
      activeProjectId: projectId,
    },
  );

  await page.goto(`${baseUrl}/theroleroom`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(Number(process.env.ROLE_ROOM_EXPORTER_LIVE_BROWSER_WAIT_MS || 8_000));
  await browser.close();

  const excessiveStatusRequests = Array.from(statusRequestCounts.entries())
    .filter(([, count]) => count > 6)
    .map(([url, count]) => ({ url, count }));
  if (matchingConsoleErrors.length || failedRequests.length || excessiveStatusRequests.length) {
    fail("Browser smoke failed", {
      matchingConsoleErrors,
      failedRequests,
      excessiveStatusRequests,
    });
  }

  return Object.fromEntries(statusRequestCounts);
};

let projectId = "";
const uploadedFileIds = [];

try {
  const health = await assertOkJson("Backend health", `${baseUrl}/api/health`);
  assertShaMatches("Backend commit", health.commit);

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
  const { file, expectedBody } = await uploadProjectFile(projectId);
  uploadedFileIds.push(file.id);
  await verifyProjectFile(projectId, file.id, expectedBody);
  const statusRequestCounts = await verifyBrowserSmoke(session, projectId);

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    expectedSha: expectedSha || null,
    backendCommit: health.commit || null,
    runId,
    projectId,
    uploadedFileId: file.id,
    cleanup,
    statusRequestCounts,
    verified: [
      "persisted auth session",
      "real Role Room project create",
      "producer client intake save/read",
      "producer client material save/read",
      "real project file upload/list/share/download",
      "DB compat project-state persistence",
      "DB-inline artifact fallback",
      "browser console/status-request smoke",
    ],
  }, null, 2));
} finally {
  if (projectId) {
    await cleanupDatabase(projectId, uploadedFileIds);
  }
  await cleanupSession();
  await pool.end();
}
