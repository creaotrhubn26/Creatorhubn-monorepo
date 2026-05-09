/**
 * role-room-vendor-links-routes.ts
 *
 * Setup-funksjon for /api/role-room/vendor-links endpoints.
 * 2 endpoints, **public** (ingen auth) — returnerer en statisk liste
 * av forhandlere/affiliate-lenker for utstyrs-kompatibilitet:
 *   - GET /vendor-links?category=… (alle eller filtrert)
 *   - GET /vendor-links/categories (telling per kategori)
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomVendorLinksRoutes } from "./role-room-vendor-links-routes";
 *
 *   setupRoleRoomVendorLinksRoutes({ app });
 *
 * Mode-noter: ingen Role Room-modes påvirker disse endpoints — public
 * data tilgjengelig for alle moduler som trenger forhandler-info.
 *
 * NB: Dette er første ekstrakt under Fase 2 av en NON-admin route-gruppe
 * (resten av admin-room-clusteret brukte AdminRoomRoutesDeps). Mønsteret
 * her er minimalt: bare `app` trengs siden dataen er statisk og ingen
 * auth/session/pool brukes.
 */

import type express from "express";

const COMPAT_VENDOR_LINKS = [
  {
    id: "vendor-foto-no-cameras",
    category: "Kamera",
    subcategory: "Speillost",
    vendor_name: "Foto.no",
    product_name: "Canon EOS R5 Mark II",
    product_url:
      "https://www.foto.no/canon/163394/canon-eos-r5-mark-ii-45mp-sensor-30-bps-8k-video",
    affiliate_url: "",
    image_url:
      "https://placehold.co/800x500/1f2937/ffffff?text=Foto.no+Canon+R5+II",
    description: "Kampanjepris hos norsk forhandler.",
    is_recommended: true,
    sort_order: 1,
  },
  {
    id: "vendor-scphoto-audio",
    category: "Lyd",
    subcategory: "Tradlost",
    vendor_name: "Foto.no",
    product_name: "Rode Wireless PRO",
    product_url:
      "https://www.foto.no/r%c3%b8de/157955/r%c3%b8de-wireless-pro-tr%c3%a5dl%c3%b8st-mikrofonsystem-2-x-tx-1-x-rx",
    affiliate_url: "",
    image_url: "https://placehold.co/800x500/082f49/e0f2fe?text=Wireless+PRO",
    description: "God pakkepris inkludert ladekase.",
    is_recommended: true,
    sort_order: 2,
  },
  {
    id: "vendor-japanphoto-light",
    category: "Lys",
    subcategory: "LED",
    vendor_name: "Foto.no",
    product_name: "Aputure 600d Pro",
    product_url:
      "https://www.foto.no/aputure/134866/aputure-ls-600d-pro-dagslys-5600k-v-mount",
    affiliate_url: "",
    image_url: "https://placehold.co/800x500/3f1d5c/f3e8ff?text=Aputure+600d",
    description: "Leveres med softbox-kit.",
    is_recommended: false,
    sort_order: 3,
  },
];

export interface RoleRoomVendorLinksRoutesDeps {
  app: express.Application;
}

export function setupRoleRoomVendorLinksRoutes(deps: RoleRoomVendorLinksRoutesDeps): void {
  const { app } = deps;

  app.get("/api/role-room/vendor-links", (req, res) => {
    const category =
      typeof req.query.category === "string"
        ? req.query.category.trim().toLowerCase()
        : "";
    const links = category
      ? COMPAT_VENDOR_LINKS.filter(
          (item) => item.category.toLowerCase() === category,
        )
      : COMPAT_VENDOR_LINKS;
    res.json({ links });
  });

  app.get("/api/role-room/vendor-links/categories", (_req, res) => {
    const counts = new Map<string, number>();
    COMPAT_VENDOR_LINKS.forEach((item) => {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    });
    const categories = Array.from(counts.entries()).map(([category, count]) => ({
      category,
      count,
    }));
    res.json({ categories });
  });
}
