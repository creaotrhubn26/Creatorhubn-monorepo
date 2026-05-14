/**
 * e2e/helpers/role-room.ts
 *
 * Felles utility for å åpne The Role Room i Playwright-tester.
 *
 * BAKGRUNN (stabilitetsaudit § 8.1):
 *   Hver spec hadde tidligere sin egen `gotoCastingPlanner`/`gotoRoleRoom`-
 *   helper som ventet på lokalisert tekst som `'Casting, crew & ...'`. Den
 *   teksten:
 *     - Vises kun på desktop-viewport (viewport.isDesktop=true)
 *     - Finnes kun i RoleRoomDashboardPanel, ikke i CastingPlannerPanel
 *     - Brytes hvis man bytter NB→EN-locale eller redesigner header
 *
 *   Resultat: 28 av 29 e2e-fail i batch 1 hadde samme rot-årsak (Sprint A.5).
 *
 * LØSNING:
 *   - Stabile DOM-markører: `.role-room-route` (klasse, dashboard) og
 *     `[data-testid="casting-planner-root"]` (planner-orchestrator)
 *   - Disse er HTML-attributter som ikke endres av locale/redesign
 *   - Felles fil gir én sannhet — fremtidige helper-endringer i ÉN fil
 *
 * Bruk:
 *   import { openRoleRoomDashboard, openCastingPlanner } from './helpers/role-room';
 *
 *   test('something', async ({ page }) => {
 *     await openCastingPlanner(page);     // for specs som bruker /e2e-casting-test.html
 *     // ... resten av testen
 *   });
 */

import { expect, type Page } from "@playwright/test";

export const ROLE_ROOM_DASHBOARD_PAGE = "/e2e-test.html";
export const CASTING_PLANNER_PAGE = "/e2e-casting-test.html";

interface OpenOptions {
  /** Timeout for navigasjon (load-event). Default 60s. */
  loadTimeoutMs?: number;
  /** Timeout for at root-elementet skal vises i DOM. Default 30s. */
  mountTimeoutMs?: number;
  /** URL-flagger som settes som query-parameters. */
  urlFlags?: Record<string, string>;
  /** localStorage-state som settes FØR page-load via addInitScript. */
  preSeedAuth?: {
    userId?: string;
    email?: string;
    appToken?: string;
    roleRoomToken?: string;
  };
}

/**
 * Åpne /e2e-test.html (RoleRoomDashboardPanel-harness).
 *
 * Brukes av specs som tester:
 *   - Project list-flyt
 *   - Project creation modal
 *   - Tab-rail på iPad / Bottom-nav på mobil
 *
 * Venter på `.role-room-route` som er rendret av RoleRoomDashboardPanel
 * uavhengig av viewport.
 */
export async function openRoleRoomDashboard(page: Page, options: OpenOptions = {}): Promise<void> {
  if (options.preSeedAuth) await seedAuthLocalStorage(page, options.preSeedAuth);

  const url = options.urlFlags
    ? `${ROLE_ROOM_DASHBOARD_PAGE}?${new URLSearchParams(options.urlFlags).toString()}`
    : ROLE_ROOM_DASHBOARD_PAGE;
  await page.goto(url, { waitUntil: "load", timeout: options.loadTimeoutMs ?? 60_000 });
  await expect(page.locator(".role-room-route").first()).toBeAttached({
    timeout: options.mountTimeoutMs ?? 30_000,
  });
}

/**
 * Åpne /e2e-casting-test.html (CastingPlannerPanel-harness).
 *
 * Brukes av specs som tester:
 *   - Story Logic / Story Arc Studio
 *   - Role/Candidate management
 *   - 16-tab Casting Planner-flyt
 *
 * Venter på `[data-testid="casting-planner-root"]` som CastingPlannerPanel
 * renderer på outer Box.
 */
export async function openCastingPlanner(page: Page, options: OpenOptions = {}): Promise<void> {
  if (options.preSeedAuth) await seedAuthLocalStorage(page, options.preSeedAuth);

  const url = options.urlFlags
    ? `${CASTING_PLANNER_PAGE}?${new URLSearchParams(options.urlFlags).toString()}`
    : CASTING_PLANNER_PAGE;
  await page.goto(url, { waitUntil: "load", timeout: options.loadTimeoutMs ?? 60_000 });
  await expect(page.locator('[data-testid="casting-planner-root"]')).toBeAttached({
    timeout: options.mountTimeoutMs ?? 30_000,
  });
}

/**
 * Pre-seed localStorage med auth-state FØR page-load. Bruker addInitScript
 * så det kjører før alle moduler initialiserer auth-context.
 */
async function seedAuthLocalStorage(
  page: Page,
  auth: NonNullable<OpenOptions["preSeedAuth"]>,
): Promise<void> {
  await page.addInitScript((preset: typeof auth) => {
    try {
      const userId = preset.userId ?? "e2e-test-user";
      const email = preset.email ?? "e2e@test.local";
      window.localStorage.setItem(
        "creatorhub_auth_user",
        JSON.stringify({ id: userId, email, display_name: "E2E Tester", role: "admin" }),
      );
      window.localStorage.setItem("userId", userId);
      window.localStorage.setItem("userEmail", email);
      if (preset.appToken) {
        window.localStorage.setItem("creatorhub_auth_token", preset.appToken);
      }
      if (preset.roleRoomToken) {
        window.localStorage.setItem("role_room_auth_token", preset.roleRoomToken);
      }
    } catch {
      // Ignore — defensive
    }
  }, auth);
}

/**
 * Velg det første prosjektet i sidebar-listen og vent på at panelet rendrer
 * det aktive prosjektet. Brukes etter `openCastingPlanner`.
 */
export async function selectFirstProject(page: Page): Promise<void> {
  // Sidebar-list-element. Klikk første ikke-aksjon-knapp.
  const projectItem = page.locator("li").first();
  await expect(projectItem).toBeVisible({ timeout: 10_000 });
  await projectItem.click();
  // Liten venting så React-state propagerer
  await page.waitForTimeout(800);
}

/**
 * Naviger til Story Arc Studio-tabben. Krever at vi allerede er i
 * Casting Planner-harness med et valgt prosjekt.
 */
export async function gotoStoryArcStudio(page: Page): Promise<void> {
  const tab = page.locator("#tab-story-arc-studio");
  await tab.scrollIntoViewIfNeeded({ timeout: 10_000 });
  await tab.click();
  await page.waitForTimeout(500);
}

/**
 * Reset all localStorage før test starter. Brukes for å unngå at gammel
 * auth-state fra forrige test smitter inn.
 */
export async function clearStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // Ignore
    }
  });
}
