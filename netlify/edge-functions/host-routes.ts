// host-routes.ts
//
// Netlify Edge Function — gjenoppretter host+bot-UA-betinget SEO-ruting
// (geo-prerenderte sider + robots.txt/sitemap.xml/llms.txt per merke) som
// levde i frontend/vercel.json's `has: [{type:'host'|'header'}]`-regler
// FØR Vercel→Netlify-migrasjonen (2026-08-05). Netlify [[redirects]] har
// ingen native Host/User-Agent-betingelser (kun Country/Language/Role),
// derfor Edge Function — vercel.json er fortsatt KILDEN til reglene
// (frontend/scripts/generate-netlify-host-routes.mjs genererer
// _generated-host-routes.json fra den ved hver build).
//
// Uten dette: leadgrid.no/theroleroom.com viser CreatorHub-branding og
// tom SPA-shell til ALLE bots (Googlebot, GPTBot, social-unfurl osv.) —
// bekreftet live 2026-08-20, ~2 uker etter migrasjonen.

import type { Config, Context } from "@netlify/edge-functions";
import { HOST_ROUTES } from "./_generated-host-routes.ts";

const ROUTES = HOST_ROUTES;

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const host = normalizeHost(url.hostname);
  const ua = request.headers.get("user-agent") ?? "";

  for (const route of ROUTES) {
    if (route.source !== url.pathname) continue;
    if (route.hostPattern && !new RegExp(`^${route.hostPattern}$`, "i").test(host)) continue;
    if (route.uaPattern && !new RegExp(route.uaPattern, "i").test(ua)) continue;

    if (route.destination.startsWith("http")) {
      // Ekstern proxy (theroleroom sitemap.xml → Render-backend).
      const upstream = await fetch(route.destination);
      return new Response(upstream.body, {
        status: upstream.status,
        headers: upstream.headers,
      });
    }
    // Å returnere en URL rewriter internt til den (samme deploy, klienten
    // ser fortsatt original-URL-en) — IKKE en HTTP-redirect.
    return new URL(route.destination, url);
  }

  return context.next(); // ingen treff — vanlig SPA-respons uendret
};

export const config: Config = {
  path: "/*",
  excludedPath: ["/geo/*", "/*.js", "/*.css", "/*.png", "/*.webp", "/*.svg", "/*.woff2"],
};
