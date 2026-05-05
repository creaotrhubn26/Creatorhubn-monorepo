#!/usr/bin/env tsx
/**
 * CLI som rendrer Holy Crust "Blue Monday → Holy Monday"-plakat i alle
 * fem støttede formater. Brukes til Fase 1-sjekkpunkt: visuell verifisering
 * at composer-engine produserer noe brukbart før vi bygger UI.
 *
 * Kjøres:
 *   npx tsx backend/scripts/render-poster-cli.ts
 *
 * Output: /tmp/posters/holy-crust-{format}.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FORMAT_DIMENSIONS,
  renderPoster,
  type PosterContent,
  type PosterFormat,
} from "../server/role-room-poster-composer.ts";

// Placeholder-logo som inline SVG (gir oss en pizza-rød disk med hvit tekst).
// I produksjon kommer logoen fra business_profiles.logo_url (R2-URL).
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="95" fill="#C8102E" stroke="white" stroke-width="6"/>
  <circle cx="40" cy="60" r="6" fill="white"/>
  <circle cx="160" cy="80" r="5" fill="white"/>
  <circle cx="60" cy="140" r="7" fill="white"/>
  <circle cx="150" cy="150" r="6" fill="white"/>
  <text x="100" y="90" font-family="Arial Black, sans-serif" font-size="34" font-weight="900" fill="white" text-anchor="middle">HOLY</text>
  <text x="100" y="130" font-family="Arial Black, sans-serif" font-size="34" font-weight="900" fill="white" text-anchor="middle">CRUST</text>
</svg>`;
const LOGO_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;

// Placeholder-produktbilder (Unsplash). I produksjon kommer disse fra
// photo-enhancer-cutout-pipelinen (transparent-bg PNG i R2).
const PIZZA_URLS = {
  pepperoni: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80",
  veggie: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=600&q=80",
  kebab: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
};

const HOLY_CRUST: PosterContent = {
  templateId: "monday-special",
  brand: {
    businessName: "Holy Crust",
    logoUrl: LOGO_DATA_URL,
    colors: {
      primary: "#C8102E",      // brand red
      secondary: "#1B2D5C",    // brand navy
      accent: "#F4EBD8",       // krem
      background: "#0E0E0E",
      text: "#FFFFFF",
    },
    fonts: {
      display: "Bebas Neue",
      body: "Inter",
    },
  },
  campaign: {
    headlinePrimary: "Blue Monday",
    connector: "om til",
    headlineSecondary: "Holy Monday",
    subhead: "Kun hver mandag hos Holy Crust",
    burst: "Vi redder mandagen din!",
    cta: "Start uka riktig. Bestill nå!",
  },
  pricing: [
    { label: "VALGFRI STOR PIZZA", price: "169,-" },
    { label: "VALGFRI LITEN PIZZA", price: "99,-" },
  ],
  products: [
    { imageUrl: PIZZA_URLS.pepperoni, name: "Pepperoni" },
    { imageUrl: PIZZA_URLS.veggie, name: "Veggie" },
    { imageUrl: PIZZA_URLS.kebab, name: "Holy Kebab" },
  ],
  ctaActions: [
    { iconSvgPath: "M3 12h2l3-9h8l3 9h2v8H3v-8z", text: "Hent i restaurant" },
    { iconSvgPath: "M3 17V7h11v3h4l3 3v4h-3", text: "Rask levering" },
    { iconSvgPath: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20", text: "holycrust.no" },
  ],
  footer: {
    phone: "97 25 22 22",
    socialLine: "@holycrust.no",
  },
  // Test custom-layers (Fase 3) — bruker-plasserte tekstbokser/former
  customLayers: [
    {
      id: "test-text",
      type: "text",
      x: 60,
      y: 60,
      w: 360,
      h: 60,
      text: "FASE 3 TEST",
      fontFamily: "Bebas Neue",
      fontSize: 42,
      fontWeight: 700,
      color: "#FFFFFF",
      backgroundColor: "#000000",
      align: "center",
      padding: 8,
    },
    {
      id: "test-shape",
      type: "shape",
      x: 80,
      y: 200,
      w: 120,
      h: 120,
      shape: "circle",
      fill: "#F4EBD8",
      opacity: 0.7,
    },
  ],
};

// Skip rollup/a1/bus-shelter i CLI — for store til rask iterasjon (10+ sek).
// Fase 1-bevis: 5 social + 3 signage (a4 print, aframe, menuboard-9x16 digital).
const FORMATS: PosterFormat[] = [
  "2x3", "1x1", "4x5", "9x16", "1.91x1",
  "a4", "aframe", "menuboard-9x16",
];

async function main() {
  const outDir = "/tmp/posters";
  mkdirSync(outDir, { recursive: true });

  console.log(`\nRendrer Holy Crust-plakat i ${FORMATS.length} formater…\n`);
  for (const fmt of FORMATS) {
    const dims = FORMAT_DIMENSIONS[fmt];
    process.stdout.write(`  ${fmt} (${dims.w}×${dims.h}, ${dims.shape})… `);
    const t0 = Date.now();
    try {
      const png = await renderPoster(HOLY_CRUST, fmt);
      const ms = Date.now() - t0;
      const path = join(outDir, `holy-crust-${fmt}.png`);
      writeFileSync(path, png);
      console.log(`OK ${ms}ms (${(png.length / 1024).toFixed(0)} kB) → ${path}`);
    } catch (err) {
      console.log(`FEIL: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log("\nFerdig. Åpne /tmp/posters/ for å se resultatet.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
