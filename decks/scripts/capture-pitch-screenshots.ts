/**
 * capture-pitch-screenshots.ts
 *
 * Walks through Role Room views per persona and captures full-page
 * PNG screenshots used as hero-imagery in the persona pitch decks.
 *
 * Run:
 *   npx tsx decks/scripts/capture-pitch-screenshots.ts
 *
 * Requires the dev server running at http://localhost:5001.
 */

import { chromium, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5001";
const OUT_DIR = join(process.cwd(), "decks", "screenshots");
const VIEWPORT = { width: 1600, height: 1000 };

interface Shot {
  slug: string;
  path: string;
  fullPage?: boolean;
  waitMs?: number;
  description: string;
}

interface PersonaCapture {
  persona: "production-team" | "content-producer" | "dance-studio";
  label: string;
  profession: "photographer" | "videographer" | "music_producer" | "dance_studio";
  shots: Shot[];
}

const DEV_SESSION_BASE = {
  token: "dev-admin-local-session",
  user: {
    id: "local-admin",
    email: "admin@local.dev",
    name: "Local Admin",
    displayName: "Local Admin",
    role: "admin",
    roleLabel: "Admin",
    permissions: [
      "users:read",
      "users:write",
      "roles:write",
      "billing:admin",
      "impersonate",
    ],
    isAdmin: true,
    verified_email: true,
  },
};

const CAPTURES: PersonaCapture[] = [
  {
    persona: "production-team",
    label: "Production team",
    profession: "videographer",
    shots: [
      {
        slug: "01-photographer-dashboard",
        path: "/photographer-dashboard-material",
        description: "Photographer dashboard — projects, casting, capture",
      },
      {
        slug: "02-videographer-dashboard",
        path: "/videographer-dashboard-material",
        description: "Videographer dashboard — multi-project view",
      },
      {
        slug: "03-showcase-admin",
        path: "/showcase-admin",
        description: "Showcase admin — client galleries dashboard",
      },
      {
        slug: "04-showcase-public",
        path: "/showcase-amazon-demo",
        description: "Public showcase — what client sees",
      },
    ],
  },
  {
    persona: "content-producer",
    label: "Content producer",
    profession: "photographer",
    shots: [
      {
        slug: "01-photographer-dashboard",
        path: "/photographer-dashboard-material",
        description: "Content producer dashboard view",
      },
      {
        slug: "02-showcase-admin",
        path: "/showcase-admin",
        description: "Galleries + photo enhancer hub",
      },
      {
        slug: "03-email-designer",
        path: "/email-designer",
        description: "Email designer — campaign asset builder",
      },
      {
        slug: "04-news",
        path: "/news",
        description: "Personalized news / inspiration feed",
      },
    ],
  },
  {
    persona: "dance-studio",
    label: "Dance studio",
    profession: "dance_studio",
    shots: [
      {
        slug: "01-dance-dashboard",
        path: "/?mode=dance",
        description: "Dance studio dashboard (?mode=dance opt-in)",
        waitMs: 2000,
      },
      {
        slug: "02-photographer-dashboard-dance",
        path: "/photographer-dashboard-material?mode=dance",
        description: "Dance-mode dashboard fallback",
      },
      {
        slug: "03-showcase-admin",
        path: "/showcase-admin",
        description: "Studio sharing recital photos with parents",
      },
      {
        slug: "04-academy-dashboard",
        path: "/academy-dashboard",
        description: "Academy dashboard — student-facing surface",
      },
    ],
  },
];

async function captureShot(page: Page, baseUrl: string, persona: string, shot: Shot): Promise<string> {
  const url = `${baseUrl}${shot.path}`;
  const outDir = join(OUT_DIR, persona);
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${shot.slug}.png`);

  console.log(`  → ${shot.slug}: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(shot.waitMs ?? 1500);
    // Best-effort: dismiss any blocking dialogs / cookie banners
    await page
      .locator('button:has-text("Aksepter"), button:has-text("Accept"), [role="dialog"] [aria-label*="lukk" i]')
      .first()
      .click({ timeout: 500 })
      .catch(() => undefined);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: outPath,
      fullPage: shot.fullPage ?? false,
    });
    return outPath;
  } catch (err) {
    console.warn(`     ⚠ ${shot.slug} failed: ${(err as Error).message.slice(0, 100)}`);
    // Capture whatever's rendered even if navigation timed out
    try {
      await page.screenshot({ path: outPath, fullPage: false });
      return outPath;
    } catch {
      return "";
    }
  }
}

async function main(): Promise<void> {
  console.log(`Capturing pitch screenshots from ${BASE_URL} → ${OUT_DIR}`);
  const browser = await chromium.launch({ headless: true });

  const results: Record<string, string[]> = {};
  for (const capture of CAPTURES) {
    console.log(`\n[${capture.label}] (${capture.persona})`);
    results[capture.persona] = [];

    // Each persona gets its own context so we can inject persona-specific
    // session (profession + userType determine which dashboard chrome shows).
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    const session = {
      ...DEV_SESSION_BASE,
      user: {
        ...DEV_SESSION_BASE.user,
        profession: capture.profession,
        userType: capture.profession,
      },
    };

    await page.addInitScript((s) => {
      try {
        localStorage.setItem("creatorhub_auth_token", s.token);
        localStorage.setItem("creatorhub_auth_user", JSON.stringify(s.user));
        localStorage.setItem("userId", s.user.id);
        localStorage.setItem("userEmail", s.user.email);
        localStorage.setItem("roleroom-pitch-screenshot-mode", "1");
      } catch {
        /* ignore */
      }
    }, session);

    for (const shot of capture.shots) {
      const p = await captureShot(page, BASE_URL, capture.persona, shot);
      if (p) results[capture.persona].push(p);
    }

    await context.close();
  }

  await browser.close();

  console.log("\nDone. Captured:");
  for (const [persona, paths] of Object.entries(results)) {
    console.log(`  ${persona}: ${paths.length} shots`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
