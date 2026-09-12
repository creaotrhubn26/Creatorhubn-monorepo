/**
 * control-center-deploys-client.ts
 *
 * CreatorHub Control Center — Fase 2 (byggeplanen): deploy-innsikt.
 *
 * Tynne, server-side LESE-klienter mot deploy-providerne (Render, GitHub
 * Actions, Netlify). Alt aggregeres til én felles `DeployRecord`-form slik at
 * cockpiten kan vise en samlet deploy-tidslinje uavhengig av provider.
 *
 * VIKTIG (aggregator-topologi + Fase-avgrensning):
 *   - Alle tokens holdes server-side (aldri på operatør-maskinen).
 *   - KUN LESE. Ingen provider-WRITE her — trigge/rollback/promote hører til
 *     Fase 4 (høy risiko, sist). Disse klientene har ingen skrive-metoder.
 *   - Best-effort: mangler konfig, eller feiler kallet, returnerer vi tom
 *     liste (ingen 500). Hver provider er uavhengig gated — én kan være
 *     koblet uten de andre.
 *
 * Env (alle valgfrie — se env-validator OPTIONAL):
 *   Render  : RENDER_API_KEY + RENDER_SERVICE_ID
 *   GitHub  : GITHUB_DEPLOY_TOKEN (evt. GITHUB_TOKEN) + GITHUB_REPO ("owner/repo")
 *   Netlify : offentlig deploy-feed for creatorhub-frontend-mig.netlify.app
 */

export type DeployProvider = "render" | "github" | "netlify";

/** Normalisert status på tvers av providere. */
export type DeployStatus =
  | "live"         // ferdig, kjører
  | "building"     // pågår (bygg/deploy/queue)
  | "failed"       // feilet
  | "canceled"     // avbrutt
  | "superseded"   // erstattet av nyere (Render deactivated)
  | "unknown";

export interface DeployRecord {
  provider: DeployProvider;
  id: string;
  status: DeployStatus;
  /** Provider-nativ status-streng (for tooltip/debug). */
  rawStatus: string;
  /** Commit-melding eller workflow-navn. */
  title: string;
  branch: string | null;
  /** Kort SHA (7 tegn) hvis tilgjengelig. */
  commit: string | null;
  /** Lenke til deploy/kjøring i providerens dashboard. */
  url: string | null;
  author: string | null;
  createdAt: string | null;
  finishedAt: string | null;
}

export interface ProviderConfigStatus {
  render: boolean;
  github: boolean;
  netlify: boolean;
}

// ─── Felles hjelpere ───────────────────────────────────────────────────────

function readEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : null;
}

function shortSha(sha: string | null | undefined): string | null {
  if (!sha) return null;
  const s = String(sha).trim();
  return s.length >= 7 ? s.slice(0, 7) : s || null;
}

function firstLine(msg: string | null | undefined, fallback: string): string {
  const s = (msg ?? "").split("\n")[0].trim();
  return s.length > 0 ? s : fallback;
}

async function getJson<T>(
  url: string,
  headers: Record<string, string>,
  label: string,
  timeoutMs = 8000,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      console.warn(`[control-center/deploys] ${label} → HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[control-center/deploys] ${label} feilet:`, (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Render ────────────────────────────────────────────────────────────────

interface RenderConfig { apiKey: string; serviceId: string; }

function getRenderConfig(): RenderConfig | null {
  const apiKey = readEnv("RENDER_API_KEY");
  const serviceId = readEnv("RENDER_SERVICE_ID");
  if (!apiKey || !serviceId) return null;
  return { apiKey, serviceId };
}

/** Render deploy-status → normalisert. */
function normalizeRenderStatus(raw: string): DeployStatus {
  switch (raw) {
    case "live": return "live";
    case "build_failed":
    case "update_failed":
    case "pre_deploy_failed": return "failed";
    case "canceled": return "canceled";
    case "deactivated": return "superseded";
    case "created":
    case "queued":
    case "build_in_progress":
    case "update_in_progress":
    case "pre_deploy_in_progress": return "building";
    default: return "unknown";
  }
}

interface RawRenderDeployEnvelope {
  deploy?: {
    id?: string;
    status?: string;
    createdAt?: string;
    finishedAt?: string | null;
    commit?: { id?: string; message?: string; createdAt?: string };
    trigger?: string;
  };
}

async function fetchRenderDeploys(limit: number): Promise<DeployRecord[]> {
  const config = getRenderConfig();
  if (!config) return [];
  const raw = await getJson<RawRenderDeployEnvelope[]>(
    `https://api.render.com/v1/services/${encodeURIComponent(config.serviceId)}/deploys?limit=${Math.min(limit, 50)}`,
    { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
    "render deploys",
  );
  if (!raw || !Array.isArray(raw)) return [];

  const dashboardBase = `https://dashboard.render.com/web/${config.serviceId}/deploys`;
  return raw
    .map((env) => env.deploy)
    .filter((d): d is NonNullable<RawRenderDeployEnvelope["deploy"]> => Boolean(d?.id))
    .map((d) => ({
      provider: "render" as const,
      id: String(d.id),
      status: normalizeRenderStatus(d.status ?? ""),
      rawStatus: d.status ?? "unknown",
      title: firstLine(d.commit?.message, `Deploy ${String(d.id).slice(0, 8)}`),
      branch: null,
      commit: shortSha(d.commit?.id),
      url: `${dashboardBase}/${d.id}`,
      author: d.trigger ?? null,
      createdAt: d.createdAt ?? null,
      finishedAt: d.finishedAt ?? null,
    }));
}

// ─── GitHub Actions ──────────────────────────────────────────────────────────

interface GithubConfig { token: string; owner: string; repo: string; }

function getGithubConfig(): GithubConfig | null {
  const token = readEnv("GITHUB_DEPLOY_TOKEN") ?? readEnv("GITHUB_TOKEN");
  const repoSlug = readEnv("GITHUB_REPO");
  if (!token || !repoSlug) return null;
  const [owner, repo] = repoSlug.split("/");
  if (!owner || !repo) return null;
  return { token, owner, repo };
}

function normalizeGithubStatus(status: string, conclusion: string | null): DeployStatus {
  if (status !== "completed") {
    // queued | in_progress | waiting | requested | pending
    return "building";
  }
  switch (conclusion) {
    case "success": return "live";
    case "failure":
    case "timed_out":
    case "startup_failure": return "failed";
    case "cancelled":
    case "skipped":
    case "stale": return "canceled";
    default: return "unknown";
  }
}

interface RawGithubRunsResponse {
  workflow_runs?: Array<{
    id?: number;
    name?: string;
    display_title?: string;
    head_branch?: string;
    head_sha?: string;
    status?: string;
    conclusion?: string | null;
    html_url?: string;
    created_at?: string;
    updated_at?: string;
    run_started_at?: string;
    actor?: { login?: string };
    head_commit?: { message?: string };
  }>;
}

async function fetchGithubRuns(limit: number): Promise<DeployRecord[]> {
  const config = getGithubConfig();
  if (!config) return [];
  const raw = await getJson<RawGithubRunsResponse>(
    `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/actions/runs?per_page=${Math.min(limit, 50)}`,
    {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "creatorhub-control-center",
    },
    "github actions runs",
  );
  const runs = raw?.workflow_runs;
  if (!runs || !Array.isArray(runs)) return [];

  return runs
    .filter((r) => r.id != null)
    .map((r) => ({
      provider: "github" as const,
      id: String(r.id),
      status: normalizeGithubStatus(r.status ?? "", r.conclusion ?? null),
      rawStatus: r.conclusion ?? r.status ?? "unknown",
      title: firstLine(r.display_title ?? r.head_commit?.message ?? r.name, r.name ?? "Workflow-kjøring"),
      branch: r.head_branch ?? null,
      commit: shortSha(r.head_sha),
      url: r.html_url ?? null,
      author: r.actor?.login ?? null,
      createdAt: r.run_started_at ?? r.created_at ?? null,
      finishedAt: r.status === "completed" ? (r.updated_at ?? null) : null,
    }));
}

// ─── Netlify ─────────────────────────────────────────────────────────────────

/** CreatorHub-frontenden har offentlig deploy-logg, så lesing krever ingen secret. */
export const NETLIFY_SITE_HOST = "creatorhub-frontend-mig.netlify.app";
export const NETLIFY_SITE_API_URL = `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_HOST}`;
export const NETLIFY_DASHBOARD_URL = "https://app.netlify.com/projects/creatorhub-frontend-mig/deploys";

export function normalizeNetlifyStatus(state: string, skipped = false): DeployStatus {
  if (skipped) return "canceled";
  switch (state.toLowerCase()) {
    case "ready": return "live";
    case "error":
    case "rejected": return "failed";
    case "new":
    case "pending_review":
    case "accepted":
    case "enqueued":
    case "building":
    case "uploading":
    case "uploaded":
    case "preparing":
    case "prepared":
    case "processing":
    case "processed":
    case "retrying": return "building";
    default: return "unknown";
  }
}

interface RawNetlifyDeployment {
  id?: string;
  state?: string;
  name?: string;
  admin_url?: string;
  deploy_ssl_url?: string;
  review_url?: string | null;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
  branch?: string;
  commit_ref?: string;
  title?: string;
  context?: string;
  skipped?: boolean | null;
}

function trustedNetlifyUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const trustedHost =
      url.hostname === "app.netlify.com" || url.hostname.endsWith(".netlify.app");
    return url.protocol === "https:" && trustedHost ? url : null;
  } catch {
    return null;
  }
}

function netlifyDeployUrl(deployment: RawNetlifyDeployment): string | null {
  const id = String(deployment.id ?? "");
  const dashboardUrl = trustedNetlifyUrl(deployment.admin_url);
  if (dashboardUrl && dashboardUrl.hostname === "app.netlify.com") {
    dashboardUrl.search = "";
    dashboardUrl.hash = "";
    dashboardUrl.pathname = `${dashboardUrl.pathname.replace(/\/$/, "")}/deploys/${encodeURIComponent(id)}`;
    return dashboardUrl.toString();
  }
  return (
    trustedNetlifyUrl(deployment.review_url)?.toString() ??
    trustedNetlifyUrl(deployment.deploy_ssl_url)?.toString() ??
    null
  );
}

async function fetchNetlifyDeploys(limit: number): Promise<DeployRecord[]> {
  const params = new URLSearchParams({ per_page: String(Math.min(Math.max(limit, 1), 50)) });
  const deployments = await getJson<RawNetlifyDeployment[]>(
    `${NETLIFY_SITE_API_URL}/deploys?${params.toString()}`,
    { Accept: "application/json" },
    "netlify deployments",
  );
  if (!deployments || !Array.isArray(deployments)) return [];

  return deployments
    .filter((d) => d.id)
    .map((d) => {
      const stateRaw = d.state ?? "unknown";
      const status = normalizeNetlifyStatus(stateRaw, d.skipped === true);
      return {
        provider: "netlify" as const,
        id: String(d.id),
        status,
        rawStatus: d.skipped === true ? "skipped" : stateRaw,
        title: firstLine(
          d.title,
          d.context ? `${d.name ?? "creatorhub-frontend-mig"} (${d.context})` : d.name ?? "Netlify-deploy",
        ),
        branch: d.branch ?? null,
        commit: shortSha(d.commit_ref),
        url: netlifyDeployUrl(d),
        author: null,
        createdAt: d.created_at ?? null,
        finishedAt:
          d.published_at ??
          (status === "live" || status === "failed" || status === "canceled" ? (d.updated_at ?? null) : null),
      };
    });
}

// ─── Aggregat ────────────────────────────────────────────────────────────────

export function getDeployProviderStatus(): ProviderConfigStatus {
  return {
    render: getRenderConfig() !== null,
    github: getGithubConfig() !== null,
    netlify: true,
  };
}

export function isAnyDeployProviderConfigured(): boolean {
  const s = getDeployProviderStatus();
  return s.render || s.github || s.netlify;
}

export interface DeploysResult {
  providers: ProviderConfigStatus;
  deploys: DeployRecord[];
}

/**
 * Henter siste deploys fra alle konfigurerte providere, slår sammen og
 * sorterer nyeste først. Uavhengig gated — hver provider som mangler token
 * bidrar bare med tom liste.
 */
export async function fetchAllDeploys(limitPerProvider = 15): Promise<DeploysResult> {
  const [render, github, netlify] = await Promise.all([
    fetchRenderDeploys(limitPerProvider).catch(() => [] as DeployRecord[]),
    fetchGithubRuns(limitPerProvider).catch(() => [] as DeployRecord[]),
    fetchNetlifyDeploys(limitPerProvider).catch(() => [] as DeployRecord[]),
  ]);

  const deploys = [...render, ...github, ...netlify].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });

  return { providers: getDeployProviderStatus(), deploys };
}
