#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const startUrl = process.argv[2] || "https://creatorhubn.com/login";
const profileDir = path.resolve(process.cwd(), "output/google-verification/chromium-profile");

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});

const page = context.pages()[0] || await context.newPage();
await page.goto(startUrl, { waitUntil: "domcontentloaded" });

console.log(`Demo browser opened at ${startUrl}`);
console.log("Close the browser window to stop this process.");

await context.waitForEvent("close", { timeout: 0 });
