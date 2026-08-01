import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox","--disable-dev-shm-usage"] });
const p = await b.newPage({ viewport: { width: 900, height: 1200 } });
await p.goto("http://127.0.0.1:5001/a4.html", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(8000);
await p.emulateMedia({ media: "print" });
const res = await p.evaluate(() => {
  const out = {};
  // Foerste stillingsoppfoering: har den break-inside i print?
  const entries = [...document.querySelectorAll("div")].filter(d => /Senior Prosjektleder/.test(d.textContent || "") && d.children.length <= 4);
  const e = entries[entries.length - 1];
  out.entryBreakInside = e ? getComputedStyle(e).breakInside : "fant ikke";
  const h = document.querySelector("h1,h2,h3,h4,h5,h6");
  out.headingTag = h?.tagName ?? "ingen";
  out.headingBreakAfter = h ? getComputedStyle(h).breakAfter : "n/a";
  out.orphans = getComputedStyle(document.querySelector("[data-template] > div") || document.body).orphans;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await p.pdf({ path: "/tmp/claude-0/-home-user-Creatorhubn-monorepo/37dd9576-34c1-5b2e-b3b9-c1a0ee54bf3b/scratchpad/cv.pdf", format: "A4", printBackground: true });
console.log("PDF skrevet");
await b.close();
