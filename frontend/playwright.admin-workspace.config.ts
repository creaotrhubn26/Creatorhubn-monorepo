import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { resolveLoopbackOrigin } from "./e2e/admin-workspace-e2e-support";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(frontendDir, "../backend");

function readPort(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`${name} må være et heltall mellom 1024 og 65535`);
  }
  return port;
}

const backendPort = readPort(
  process.env.ADMIN_WORKSPACE_E2E_PORT,
  3317,
  "ADMIN_WORKSPACE_E2E_PORT",
);
const frontendPort = readPort(
  process.env.PLAYWRIGHT_PORT,
  5317,
  "PLAYWRIGHT_PORT",
);
const backendOrigin = resolveLoopbackOrigin(
  process.env.ADMIN_WORKSPACE_E2E_BACKEND_URL ??
    `http://127.0.0.1:${backendPort}`,
  "ADMIN_WORKSPACE_E2E_BACKEND_URL",
);
const databaseUrl =
  process.env.ADMIN_WORKSPACE_E2E_DATABASE_URL ??
  "postgresql://127.0.0.1:5432/creatorhub_admin_workspace_e2e";
const database = new URL(databaseUrl);
const databaseHost = database.hostname.replace(/^\[|\]$/g, "").toLowerCase();
if (
  !["postgres:", "postgresql:"].includes(database.protocol) ||
  !["127.0.0.1", "localhost", "::1"].includes(databaseHost) ||
  database.pathname !== "/creatorhub_admin_workspace_e2e" ||
  (database.port && database.port !== "5432") ||
  database.search ||
  database.hash
) {
  throw new Error(
    "ADMIN_WORKSPACE_E2E_DATABASE_URL må være den dedikerte lokale creatorhub_admin_workspace_e2e-databasen",
  );
}
const frontendOrigin = resolveLoopbackOrigin(
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${frontendPort}`,
  "PLAYWRIGHT_BASE_URL",
);
const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

if (new URL(backendOrigin).hostname !== "127.0.0.1") {
  throw new Error(
    "Den dedikerte Admin Workspace-harnessen bindes til 127.0.0.1",
  );
}
if (Number(new URL(backendOrigin).port) !== backendPort) {
  throw new Error(
    "ADMIN_WORKSPACE_E2E_BACKEND_URL og ADMIN_WORKSPACE_E2E_PORT må bruke samme port",
  );
}
if (new URL(frontendOrigin).hostname !== "127.0.0.1") {
  throw new Error("Admin Workspace Playwright-serveren bindes til 127.0.0.1");
}
if (Number(new URL(frontendOrigin).port) !== frontendPort) {
  throw new Error("PLAYWRIGHT_BASE_URL og PLAYWRIGHT_PORT må bruke samme port");
}

// Spec workers inherit this exact origin. Direct setup/cleanup calls and
// browser-proxied calls therefore hit the same dedicated backend process.
process.env.ADMIN_WORKSPACE_E2E_BACKEND_URL = backendOrigin;

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "admin-workspace-calendar.spec.ts",
    "admin-workspace-documents-writing.spec.ts",
    "admin-workspace-project-files.spec.ts",
    "admin-workspace-cv-builder.spec.ts",
  ],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  use: {
    baseURL: frontendOrigin,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: true,
    launchOptions: {
      args: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-default-apps",
        "--js-flags=--max-old-space-size=2048",
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run e2e:admin-workspace-harness",
      cwd: backendDir,
      env: {
        ...inheritedEnv,
        NODE_ENV: "test",
        CREATORHUB_ENABLE_ADMIN_WORKSPACE_E2E_HARNESS: "true",
        ADMIN_WORKSPACE_E2E_DATABASE_URL: databaseUrl,
        ADMIN_WORKSPACE_E2E_PORT: String(backendPort),
      },
      url: `${backendOrigin}/__admin-workspace-e2e/health`,
      reuseExistingServer: false,
      timeout: 45_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
    {
      command: `npx vite --port ${frontendPort} --host 127.0.0.1 --strictPort`,
      cwd: frontendDir,
      env: {
        ...inheritedEnv,
        VITE_ENABLE_LOCAL_ADMIN_SESSION: "true",
        CREATORHUB_ENABLE_LOCAL_ADMIN_SESSION: "true",
        VITE_API_PROXY_TARGET: backendOrigin,
      },
      url: frontendOrigin,
      reuseExistingServer: false,
      timeout: 45_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
  ],
});
