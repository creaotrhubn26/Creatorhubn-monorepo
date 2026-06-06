/**
 * url-to-video.ts — "lag en video av denne nettsiden".
 *
 * Åpner en URL i headless Chromium (Playwright, allerede i repoet), scroller
 * jevnt fra topp til bunn mens den tar opp video, og lagrer en .webm.
 * Resultatet kan mates rett inn i mockup-video-modulen
 * (frontend/.../post-agent/mockup-video) for å pakkes inn i en device-ramme.
 *
 * Kjøring (tsx + playwright finnes — ingen nye avhengigheter):
 *   node_modules/.bin/tsx scripts/url-to-video.ts <url> [--out fil.webm]
 *       [--width 1280] [--height 800] [--seconds 8] [--device iphone|ipad|desktop]
 *
 * Eksempel:
 *   node_modules/.bin/tsx scripts/url-to-video.ts https://theroleroom.no \
 *       --device iphone --seconds 10 --out theroleroom-iphone.webm
 *
 * Krever Chromium for Playwright. Mangler den:
 *   node_modules/.bin/playwright install chromium
 */

import { chromium, devices, type Page, type ViewportSize } from 'playwright';
import { mkdir, rename, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface Args {
  url: string;
  out: string;
  width: number;
  height: number;
  seconds: number;
  device: 'iphone' | 'ipad' | 'desktop';
}

function parseArgs(argv: string[]): Args {
  const [url, ...rest] = argv;
  if (!url || url.startsWith('--')) {
    throw new Error('Mangler URL. Bruk: tsx scripts/url-to-video.ts <url> [flagg]');
  }
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]?.replace(/^--/, '');
    const val = rest[i + 1];
    if (key && val != null) flags[key] = val;
  }
  const device = (flags.device as Args['device']) ?? 'desktop';
  const presets: Record<Args['device'], ViewportSize> = {
    iphone: { width: 390, height: 844 },
    ipad: { width: 1024, height: 768 },
    desktop: { width: 1280, height: 800 },
  };
  const preset = presets[device] ?? presets.desktop;
  return {
    url,
    out: flags.out ?? 'website-video.webm',
    width: flags.width ? Number(flags.width) : preset.width,
    height: flags.height ? Number(flags.height) : preset.height,
    seconds: flags.seconds ? Number(flags.seconds) : 8,
    device,
  };
}

/** Jevn scroll fra topp til bunn over `durationMs`, animert i nettleseren. */
async function smoothScrollToBottom(page: Page, durationMs: number): Promise<void> {
  await page.evaluate(async (duration) => {
    await new Promise<void>((resolve) => {
      const maxScroll = Math.max(0, document.body.scrollHeight - window.innerHeight);
      if (maxScroll <= 0) {
        setTimeout(resolve, duration);
        return;
      }
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // easeInOutCubic — rolig "produkt-demo"-sveip.
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        window.scrollTo(0, maxScroll * eased);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }, durationMs);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = dirname(args.out) === '.' ? 'out-videos' : dirname(args.out);
  await mkdir(outDir, { recursive: true });

  console.log(`[url-to-video] åpner ${args.url} (${args.device} ${args.width}×${args.height})`);

  const browser = await chromium.launch();
  const isMobile = args.device === 'iphone';
  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: isMobile ? 3 : 2,
    isMobile,
    ...(isMobile ? devices['iPhone 13'] : {}),
    recordVideo: { dir: outDir, size: { width: args.width, height: args.height } },
  });

  const page = await context.newPage();
  try {
    await page.goto(args.url, { waitUntil: 'networkidle', timeout: 45_000 });
  } catch {
    // networkidle kan time-oute på "live" sider — fall tilbake til 'load'.
    await page.goto(args.url, { waitUntil: 'load', timeout: 45_000 });
  }

  await page.waitForTimeout(1_000); // la hero-animasjoner falle på plass
  await smoothScrollToBottom(page, args.seconds * 1000);
  await page.waitForTimeout(500);

  // Video skrives først når page/context lukkes.
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const tmpPath = await video.path();
    const finalPath = dirname(args.out) === '.' ? join(outDir, args.out) : args.out;
    await rename(tmpPath, finalPath).catch(() => {
      console.warn('[url-to-video] kunne ikke gi nytt navn, beholder temp-fil');
    });
    console.log(`[url-to-video] ferdig → ${finalPath}`);
  } else {
    const files = await readdir(outDir);
    console.log(`[url-to-video] ferdig. Sjekk ${outDir}/:`, files.join(', '));
  }
}

main().catch((err) => {
  console.error('[url-to-video] FEIL:', err?.message ?? err);
  process.exit(1);
});
