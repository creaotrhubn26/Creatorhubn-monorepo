// render-engine.ts — GJENBRUKBAR headless HTML/URL → bilde-adapter (puppeteer).
//
// Bevisst DOMENE-AGNOSTISK: den vet ingenting om resume, infographics eller CMS. Den
// tar en HTML-streng ELLER en URL + generiske opsjoner og gir en bilde-buffer. Slik kan
// den gjenbrukes av:
//   • resume-thumbnails (naviger til app-rute som rendrer den EKTE React-mal-komponenten),
//   • infographic-thumbnails (assembleHtml-streng fra infographic-engine.ts),
//   • pitch-deck / OG-bilder / marketing / CMS — hva som helst som er HTML.
//
// Én delt browser-instans (lat oppstart, gjenbrukt mellom kall) for effektivitet; kall
// closeRenderEngine() ved shutdown. Ingen domene-kobling, ingen lagring — kalleren
// bestemmer hva bufferen brukes til (B2/R2/disk/respons).

import { existsSync } from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

// I prod (Render) bruker vi system-chromium fra apt (Dockerfile) i stedet for puppeteers
// egen nedlasting (PUPPETEER_SKIP_DOWNLOAD=true). Detekter binæren på disk framfor å
// stole på at PUPPETEER_EXECUTABLE_PATH-env-en propagerer — puppeteer v24 auto-leser den
// ikke pålitelig. Lokalt (ingen system-chromium) → undefined → puppeteers bundlede Chrome.
function resolveExecutablePath(): string | undefined {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter((p): p is string => !!p);
  return candidates.find((p) => existsSync(p));
}

export interface RenderOpts {
  width?: number;             // viewport-bredde (default 1200)
  height?: number;            // viewport-høyde (default 630)
  deviceScaleFactor?: number; // retina — 2 gir skarpe thumbnails (default 2)
  format?: 'png' | 'jpeg';    // default 'png'
  quality?: number;           // kun jpeg (1–100, default 82)
  transparent?: boolean;      // omitBackground — behold alfa (kun png)
  fullPage?: boolean;         // hele dokumentet i stedet for viewporten
  clip?: { x: number; y: number; width: number; height: number };
  emulateMedia?: 'screen' | 'print';
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  waitForSelector?: string;   // vent til dette elementet finnes
  clipToSelector?: string;    // beskjær til ETT elements bounding box (f.eks. CV-en, ikke sidechrome)
  blockExternalRequests?: boolean; // SSRF-vern: abort ALLE ikke-inline (ikke data:/blob:/about:) requests
  waitForMs?: number;         // ekstra fast vent (font-dekoding / animasjons-settling)
  timeoutMs?: number;         // navigasjons-/setContent-timeout (default 20000)
}

let _browser: Browser | null = null;

/** Lat, delt browser. Gjenbrukes mellom kall (serverless- og server-vennlig). */
async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  _browser = await puppeteer.launch({
    headless: true,
    executablePath: resolveExecutablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  return _browser;
}

/** Lukk den delte browseren (kall ved app-shutdown). */
export async function closeRenderEngine(): Promise<void> {
  if (_browser) { await _browser.close().catch(() => {}); _browser = null; }
}

async function shoot(load: (page: Page) => Promise<void>, opts: RenderOpts): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (opts.blockExternalRequests) {
      // SSRF-vern: kun inline-ressurser (data:/blob:/about:) tillates — alt annet abortes,
      // så en render av upålitelig HTML ikke kan hente interne/eksterne URL-er.
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        const u = r.url();
        if (u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) r.continue().catch(() => {});
        else r.abort().catch(() => {});
      });
    }
    await page.setViewport({
      width: opts.width ?? 1200,
      height: opts.height ?? 630,
      deviceScaleFactor: opts.deviceScaleFactor ?? 2,
    });
    if (opts.emulateMedia) await page.emulateMediaType(opts.emulateMedia);
    await load(page);
    if (opts.waitForSelector) await page.waitForSelector(opts.waitForSelector, { timeout: opts.timeoutMs ?? 20000 }).catch(() => {});
    if (opts.waitForMs) await new Promise((r) => setTimeout(r, opts.waitForMs));
    const format = opts.format ?? 'png';
    let clip = opts.clip;
    if (opts.clipToSelector) {
      const box = await page.$eval(opts.clipToSelector, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
      }).catch(() => null);
      if (box && box.width > 0 && box.height > 0) clip = box;
    }
    const shot = await page.screenshot({
      type: format,
      quality: format === 'jpeg' ? (opts.quality ?? 82) : undefined,
      fullPage: !!opts.fullPage && !clip,
      omitBackground: format === 'png' && !!opts.transparent,
      clip,
    });
    return Buffer.from(shot);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Render en HTML-STRENG → bilde-buffer. (F.eks. assembleHtml(...) fra infographic-engine.) */
export function renderHtmlToImage(html: string, opts: RenderOpts = {}): Promise<Buffer> {
  return shoot(async (page) => {
    await page.setContent(html, { waitUntil: resolveWaitUntil(opts), timeout: opts.timeoutMs ?? 20000 });
    await waitForIdle(page, opts);
  }, opts);
}

/** Render en URL → bilde-buffer. (F.eks. en app-rute som rendrer en EKTE React-komponent.) */
export function renderUrlToImage(url: string, opts: RenderOpts = {}): Promise<Buffer> {
  return shoot(async (page) => {
    await page.goto(url, { waitUntil: resolveWaitUntil(opts), timeout: opts.timeoutMs ?? 20000 });
    await waitForIdle(page, opts);
  }, opts);
}

// puppeteer v24.43+ har fjernet networkidle0/networkidle2 fra waitUntil-typene.
// Oversetter til det moderne ekvivalentet: domcontentloaded + waitForNetworkIdle.
function resolveWaitUntil(opts: RenderOpts): 'load' | 'domcontentloaded' {
  const w = opts.waitUntil ?? 'networkidle0';
  return w === 'load' || w === 'domcontentloaded' ? w : 'domcontentloaded';
}

async function waitForIdle(page: Page, opts: RenderOpts): Promise<void> {
  if ((opts.waitUntil ?? 'networkidle0').startsWith('networkidle')) {
    await page.waitForNetworkIdle({ idleTime: 250, timeout: opts.timeoutMs ?? 20000 }).catch(() => {});
  }
}
