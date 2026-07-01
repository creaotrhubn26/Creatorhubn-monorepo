#!/usr/bin/env node
/**
 * record-combined.mjs — ÉN sammenhengende Google OAuth-verifiseringsvideo som
 * dekker ALLE scopene i prosjekt 256648631702 (creatorhubn-com), fordi Google
 * verifiserer på prosjekt-nivå (én sak = én video).
 *
 * Kjører tre segmenter i SAMME synlige vindu / samme opptak:
 *   A) Consent — Ads/marketing-klient  (256648631702-c1ghd…): Ads/Analytics/
 *      Search Console/Tag Manager.  DU logger inn + klikker Tillat.
 *   B) Consent — Drive/Gmail-klient    (256648631702-7s92v…): drive, drive.readonly,
 *      gmail.readonly, gmail.compose.  DU logger inn + klikker Tillat.
 *   C) Scope-bruk — /google-verification-demo: script-et klikker gjennom
 *      Ads/GA4/Search Console/Tag Manager + Drive/Gmail-handlingene automatisk.
 *
 * Vi rører ALDRI passordet/2FA-en din — du gjør Google-innloggingen selv i vinduet.
 * Til slutt stitches .webm → én .mp4 med ffmpeg.
 *
 * Kjør:
 *   cd /Users/danielqazi/Creatorhubn-monorepo
 *   node frontend/scripts/google-verification/record-combined.mjs
 */
import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";

const PW_PATH = process.env.PLAYWRIGHT_PATH
  || "/opt/homebrew/lib/node_modules/playwright/index.js";
const pwMod = await import(PW_PATH);
const chromium = pwMod.chromium ?? pwMod.default?.chromium;
if (!chromium) {
  console.error("Fant ikke playwright.chromium på", PW_PATH, "\nSett PLAYWRIGHT_PATH om nødvendig.");
  process.exit(1);
}

const BASE = process.env.DEMO_BASE || "https://creatorhubn.com";
const DEMO_PATH = "/google-verification-demo";

// ── Segment A: Ads/marketing-klient (registrert redirect på theroleroom.com) ──
const ADS_CLIENT = "256648631702-c1ghdnobjroa489pbd8qrfeue28ioibt.apps.googleusercontent.com";
const ADS_REDIRECT = "https://theroleroom.com/api/role-room/ads/google/oauth/callback";
const ADS_SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/analytics.edit",
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/siteverification",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
  "https://www.googleapis.com/auth/tagmanager.publish",
];

// ── Segment B: Drive/Gmail (workspace)-klient (registrert creatorhub-callback) ──
const WS_CLIENT = "256648631702-7s92vtepjrmv68eb9iick95npivkgs3j.apps.googleusercontent.com";
const WS_REDIRECT = `${BASE}/api/creatorhub/google/oauth/callback`;
// Kun scopene Google flagget for denne saken — fokusert consent-skjerm.
const WS_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
];

const authUrl = (clientId, redirectUri, scopes, state) =>
  "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  }).toString();

const outDir = path.resolve(process.cwd(), "output/google-verification");
const videoDir = path.join(outDir, "videos");
const profileDir = path.join(outDir, "combined-profile");
await fs.mkdir(videoDir, { recursive: true });
await fs.mkdir(profileDir, { recursive: true });

const viewport = { width: 1440, height: 900 };
const log = (m) => console.log(`[combined] ${m}`);
const banner = (lines) => {
  console.log("\n──────────────────────────────────────────────────────────────");
  lines.forEach((l) => console.log("  " + l));
  console.log("──────────────────────────────────────────────────────────────\n");
};

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport,
  recordVideo: { dir: videoDir, size: viewport },
  args: [`--window-size=${viewport.width},${viewport.height}`],
});
const page = context.pages()[0] ?? (await context.newPage());

// Venter til vi forlater accounts.google.com og treffer callbacken (code= eller callback-path).
const consentDone = (needle) => {
  for (const p of context.pages()) {
    try {
      const u = p.url().toLowerCase();
      if (!u.includes("accounts.google.com")
        && (u.includes(needle) || u.includes("code=") || u.includes("oauthstatus"))) {
        return p.url();
      }
    } catch { /* navigasjon i gang */ }
  }
  return null;
};

async function waitFor(predicate, minutes, label) {
  const deadline = Date.now() + minutes * 60 * 1000;
  while (Date.now() < deadline) {
    const hit = predicate();
    if (hit) return hit;
    await page.waitForTimeout(1500);
  }
  log(`Tidsavbrudd i «${label}» — fortsetter med det som er tatt opp.`);
  return null;
}

// ─────────────────────────────── SEGMENT A ───────────────────────────────
log("SEGMENT A — Ads/marketing-consent. Åpner Google …");
await page.goto(authUrl(ADS_CLIENT, ADS_REDIRECT, ADS_SCOPES, "verifA"), { waitUntil: "domcontentloaded" }).catch(() => {});
banner([
  "SEGMENT A (Ads) — opptaket går:",
  "1) Logg inn / velg Google-kontoen.",
  "2) La consent-skjermen vises (Ads, Analytics, Search Console, Tag Manager).",
  `   URL-linja viser client_id=256648631702-c1ghd…`,
  "3) Klikk «Fortsett»/«Tillat». Script-et går videre automatisk.",
]);
const aDone = await waitFor(() => consentDone("/ads/google/oauth/callback"), 10, "A: Ads-consent");
if (aDone) log(`Ads-consent fullført (${aDone.slice(0, 60)}…).`);
await page.waitForTimeout(3000);

// ─────────────────────────────── SEGMENT B ───────────────────────────────
log("SEGMENT B — Drive/Gmail-consent. Åpner Google …");
await page.goto(authUrl(WS_CLIENT, WS_REDIRECT, WS_SCOPES, "verifB"), { waitUntil: "domcontentloaded" }).catch(() => {});
banner([
  "SEGMENT B (Drive/Gmail) — opptaket går:",
  "1) Logg inn / velg Google-kontoen.",
  "2) La consent-skjermen vises: Drive (full), Se Drive-filer, Les e-post,",
  "   Administrer utkast og send e-post.",
  `   URL-linja viser client_id=256648631702-7s92v…`,
  "3) Klikk «Fortsett»/«Tillat». Script-et går videre automatisk.",
]);
const bDone = await waitFor(() => consentDone("/creatorhub/google/oauth/callback"), 10, "B: Drive/Gmail-consent");
if (bDone) log(`Drive/Gmail-consent fullført (${bDone.slice(0, 60)}…).`);
await page.waitForTimeout(3000);

// ─────────────────────────────── SEGMENT C ───────────────────────────────
log("SEGMENT C — scope-bruk. Går til demo-siden …");
await page.goto(`${BASE}${DEMO_PATH}`, { waitUntil: "domcontentloaded" }).catch(() => {});
banner([
  "SEGMENT C (scope-bruk):",
  `Hvis du blir sendt til innlogging, logg inn i appen og naviger til`,
  `${BASE}${DEMO_PATH}. Script-et fortsetter automatisk når demo-siden vises.`,
  "(Er du allerede på demo-siden trenger du ikke gjøre noe.)",
]);
const onDemo = () => {
  for (const p of context.pages()) {
    try { if (p.url().includes(DEMO_PATH)) return p; } catch { /* cross-origin */ }
  }
  return null;
};
let demoPage = await (async () => {
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    const f = onDemo();
    if (f) { await f.waitForTimeout(2500); if (onDemo()) return f; }
    await page.waitForTimeout(2000);
  }
  return null;
})();

if (demoPage) {
  await demoPage.bringToFront().catch(() => {});
  log("Demo-siden oppdaget — kjører gjennom scope-handlingene.");
  await demoPage.waitForTimeout(2500);
  // Bla gjennom hele siden så alt vises i opptaket.
  await demoPage.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const t = setInterval(() => {
        window.scrollBy(0, 280); y += 280;
        if (y >= document.body.scrollHeight) { clearInterval(t); window.scrollTo(0, 0); resolve(); }
      }, 320);
    });
  }).catch(() => {});
  await demoPage.waitForTimeout(1200);

  const actions = [
    "List Google Ads accounts",
    "List GA4 accounts",
    "List Search Console sites",
    "List Tag Manager accounts",
    "Load Drive Files",
    "Create Gmail Draft",
  ];
  for (const label of actions) {
    try {
      const btn = demoPage.getByRole("button", { name: label, exact: false }).first();
      if ((await btn.count()) === 0) { log(`(ikke funnet) ${label}`); continue; }
      await btn.scrollIntoViewIfNeeded();
      await demoPage.waitForTimeout(800);
      await btn.click({ timeout: 6000 });
      log(`Klikket: ${label}`);
      await demoPage.waitForTimeout(2800);
    } catch (err) {
      log(`Hoppet over «${label}»: ${err.message}`);
    }
  }
  await demoPage.waitForTimeout(2500);
} else {
  log("Nådde aldri demo-siden (tidsavbrudd) — lagrer likevel consent-segmentene.");
}

log("Lukker og lagrer video …");
await context.close();

// ─────────────────────────── STITCH → MP4 ───────────────────────────
const webms = [];
for (const f of (await fs.readdir(videoDir)).filter((f) => f.endsWith(".webm"))) {
  const full = path.join(videoDir, f);
  const st = await fs.stat(full);
  webms.push({ full, m: st.mtimeMs });
}
webms.sort((a, b) => a.m - b.m);
const stamp = process.env.VIDEO_STAMP || "combined"; // Date.* er utilgjengelig; sett VIDEO_STAMP for datonavn
const outMp4 = path.join(videoDir, `google-oauth-verification-COMBINED-${stamp}.mp4`);

// Nyeste webm-er fra denne kjøringen (recordVideo lager typisk én per page/context).
const recent = webms.slice(-6).map((w) => w.full);
console.log("\n✅ Opptak ferdig. Rå .webm-segmenter (eldst→nyest):");
recent.forEach((f) => console.log("   -", f));

if (recent.length === 1) {
  const r = spawnSync("ffmpeg", ["-y", "-i", recent[0], "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outMp4], { stdio: "inherit" });
  if (r.status === 0) console.log("\n🎬 MP4:", outMp4);
} else if (recent.length > 1) {
  const listFile = path.join(videoDir, "_concat_list.txt");
  await fs.writeFile(listFile, recent.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  const r = spawnSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outMp4], { stdio: "inherit" });
  if (r.status === 0) console.log("\n🎬 Sammenslått MP4:", outMp4);
  else console.log("\n⚠️  ffmpeg-concat feilet — segmentene ligger som .webm over (kan slås sammen manuelt).");
}

console.log("\nNeste: se gjennom MP4-en, legg på engelsk narrasjon/undertekst, last opp UNLISTED til YouTube → lim inn i Verification Center.\n");
process.exit(0);
