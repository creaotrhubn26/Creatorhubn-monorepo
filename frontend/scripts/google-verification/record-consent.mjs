#!/usr/bin/env node
/**
 * record-consent.mjs — tar opp Google OAuth-CONSENT-skjermen for verifiserings-videoen.
 *
 * Åpner den EKTE consent-URL-en for den dedikerte «Role Room Ads OAuth»-klienten
 * (256648…) med en redirect som ER registrert i Google Cloud Console
 * (theroleroom.com/api/role-room/ads/google/oauth/callback) + alle 6 scopene +
 * prompt=consent. Da vises consent-skjermen uten redirect_uri_mismatch, med
 * client_id synlig i URL-linja. DU logger inn med Google og klikker Tillat —
 * vi rører aldri passordet ditt.
 *
 * Kjør:  node frontend/scripts/google-verification/record-consent.mjs
 */
import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";

const PW_PATH = process.env.PLAYWRIGHT_PATH
  || "/opt/homebrew/lib/node_modules/playwright/index.js";
const pwMod = await import(PW_PATH);
const chromium = pwMod.chromium ?? pwMod.default?.chromium;
if (!chromium) {
  console.error("Fant ikke playwright.chromium på", PW_PATH);
  process.exit(1);
}

// Dedikert Ads-OAuth-klient (offentlig client_id — vises i URL-en i videoen).
const CLIENT_ID = "256648631702-c1ghdnobjroa489pbd8qrfeue28ioibt.apps.googleusercontent.com";
// Registrert redirect-URI #1 i Google Cloud Console for denne klienten.
const REDIRECT_URI = "https://theroleroom.com/api/role-room/ads/google/oauth/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/analytics.edit",
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/siteverification",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
  "https://www.googleapis.com/auth/tagmanager.publish",
];

const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: "code",
  scope: SCOPES.join(" "),
  access_type: "offline",
  prompt: "consent",
  include_granted_scopes: "false",
  state: "verifvid",
}).toString();

const outDir = path.resolve(process.cwd(), "output/google-verification");
const videoDir = path.join(outDir, "videos");
const profileDir = path.join(outDir, "consent-profile");
await fs.mkdir(videoDir, { recursive: true });
await fs.mkdir(profileDir, { recursive: true });

const viewport = { width: 1440, height: 900 };
const log = (m) => console.log(`[consent] ${m}`);

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport,
  recordVideo: { dir: videoDir, size: viewport },
  args: [`--window-size=${viewport.width},${viewport.height}`],
});
const page = context.pages()[0] ?? (await context.newPage());

log("Åpner Google consent-skjermen (Role Room Ads OAuth) i et synlig vindu …");
await page.goto(authUrl, { waitUntil: "domcontentloaded" }).catch(() => {});

console.log("\n──────────────────────────────────────────────────────────────");
console.log("  GJØR DETTE I VINDUET (opptaket går allerede):");
console.log("   1) Logg inn / velg Google-kontoen din.");
console.log("   2) La consent-skjermen vises — den lister scopene (Google Ads,");
console.log("      Analytics, Search Console, Tag Manager). URL-linja viser");
console.log("      client_id=256648631702-… (viktig for Google).");
console.log("   3) Klikk «Fortsett»/«Tillat».");
console.log("  Opptaket stopper automatisk når du er sendt til callbacken.");
console.log("──────────────────────────────────────────────────────────────\n");

// Avslutt når vi forlater accounts.google.com og treffer ads-callbacken.
const callbackSeen = () => {
  for (const p of context.pages()) {
    try {
      const u = p.url().toLowerCase();
      if (!u.includes("accounts.google.com")
        && (u.includes("/ads/google/oauth/callback") || u.includes("adsoauthstatus")
          || (u.includes("theroleroom.com") && u.includes("code=")))) {
        return p.url();
      }
    } catch { /* nav i gang */ }
  }
  return null;
};

const deadline = Date.now() + 10 * 60 * 1000;
let finished = false;
while (Date.now() < deadline) {
  const cb = callbackSeen();
  if (cb) {
    log(`Consent fullført → callback (${cb.slice(0, 70)}…) — fullfører opptaket.`);
    await page.waitForTimeout(3500).catch(() => {});
    finished = true;
    break;
  }
  await page.waitForTimeout(1500);
}
if (!finished) log("Tidsavbrudd — lagrer det som er tatt opp.");

await page.waitForTimeout(1200).catch(() => {});
log("Lukker og lagrer video …");
await context.close();

const entries = [];
for (const f of (await fs.readdir(videoDir)).filter((f) => f.endsWith(".webm"))) {
  const full = path.join(videoDir, f);
  const st = await fs.stat(full);
  entries.push({ full, m: st.mtimeMs });
}
entries.sort((a, b) => b.m - a.m);
console.log("\n✅ Consent-opptak ferdig. Nyeste filer:");
entries.slice(0, 3).forEach((e) => console.log("   -", e.full));
console.log("\n(Jeg identifiserer consent-klippet og slår det sammen med demo-videoen.)\n");
process.exit(0);
