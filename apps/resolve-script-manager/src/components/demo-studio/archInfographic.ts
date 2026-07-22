/**
 * archInfographic.ts — parset arkitektur → komplett, merkevaret infographic-HTML.
 *
 * Ren funksjon (ingen deps utover typene): tar en ArchDiagram + brand og bygger
 * en selvstendig HTML-streng (mørkt premium-brett med gruppe-kort + logo-chips).
 * Vises i studio-preview (iframe srcDoc) og kan eksporteres. Logoer via
 * `logoResolver` (default cdn.simpleicons.org; appen kan sende en data-URI-resolver
 * for offline/eksport). Tekst HTML-escapes.
 */
import type { ArchDiagram, ArchGroup, ArchNode } from './mermaidArch.js';
import { techLogoUrl } from './techLogos.js';

const GROUP_ACCENTS = ['#38bdf8', '#a78bfa', '#34d399', '#f59e0b', '#fb7185', '#22d3ee', '#c084fc', '#4ade80'];

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface ArchBrand { accent?: string; brandName?: string; logoMark?: string }
export type LogoResolver = (slug: string) => string;

function logoImg(slug: string, resolve: LogoResolver): string {
  const url = slug ? resolve(slug) : '';
  return url
    ? `<img src="${esc(url)}" alt="" style="width:22px;height:22px;flex:none;object-fit:contain" onerror="this.style.visibility='hidden'"/>`
    : `<span style="width:22px;height:22px;flex:none;display:grid;place-items:center;border-radius:6px;background:rgba(255,255,255,.12);font-size:11px;color:#8a98b5">◆</span>`;
}

function nodeRow(n: ArchNode, resolve: LogoResolver): string {
  const bg = n.privacy ? 'rgba(139,26,26,.28)' : '#131c2e';
  const bd = n.privacy ? '#7a2b30' : '#1c2740';
  return `<div style="display:flex;align-items:center;gap:10px;padding:7px 9px;border-radius:9px;background:${bg};border:1px solid ${bd}">`
    + logoImg(n.logo, resolve)
    + `<div style="min-width:0"><div style="font-size:12px;font-weight:600;color:#e8eefc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.label)}</div>`
    + (n.sub ? `<div style="font-size:9.5px;color:#8a98b5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.sub)}</div>` : '')
    + `</div></div>`;
}

function groupCard(g: ArchGroup, accent: string, resolve: LogoResolver): string {
  const head = (g.icon ? `<span style="font-size:17px">${g.icon}</span>` : logoImg(g.logo, resolve))
    + `<span style="font-size:14px;font-weight:800;color:#e8eefc">${esc(g.name)}</span>`;
  return `<div style="background:#0f1626;border:1px solid #1f2b42;border-top:3px solid ${accent};border-radius:14px;padding:16px 16px 8px;display:flex;flex-direction:column;gap:9px">`
    + `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">${head}</div>`
    + g.nodes.map((n) => nodeRow(n, resolve)).join('')
    + `</div>`;
}

/** Bygg komplett infographic-HTML fra en parset arkitektur. */
export function buildArchInfographicHtml(
  diagram: ArchDiagram,
  brand: ArchBrand = {},
  logoResolver: LogoResolver = (s) => techLogoUrl(s, 'white'),
): string {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(brand.accent ?? '') ? brand.accent! : '#14b8a6';
  const mark = (brand.logoMark || (brand.brandName ? brand.brandName.slice(0, 2).toUpperCase() : '◆'));
  const cols = Math.min(3, Math.max(1, diagram.groups.length));
  const cards = diagram.groups.map((g, i) => groupCard(g, GROUP_ACCENTS[i % GROUP_ACCENTS.length], logoResolver)).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box;font-family:Inter,-apple-system,"Segoe UI",sans-serif}
#wrap{background:radial-gradient(120% 100% at 0% 0%,#141d30,#0a0f1a 60%);color:#e8eefc;padding:34px;width:max-content;min-width:900px}
.hd{display:flex;align-items:center;gap:14px;margin-bottom:6px}
.mk{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,${accent},#0891b2);display:grid;place-items:center;font-size:16px;font-weight:800;color:#04121a}
h1{font-size:25px;font-weight:800}
.sub{color:#8a98b5;font-size:12.5px;margin:0 0 20px 52px}
.grid{display:grid;grid-template-columns:repeat(${cols},minmax(300px,1fr));gap:16px;align-items:start}
</style></head><body>
<div id="wrap">
  <div class="hd"><span class="mk">${esc(mark)}</span><h1>${esc(diagram.title)}</h1></div>
  <div class="sub">Systemarkitektur · ${diagram.groups.length} lag · ${diagram.groups.reduce((a, g) => a + g.nodes.length, 0)} komponenter</div>
  <div class="grid">${cards}</div>
</div>
<script>window.setProgress=function(){};window.setProgress(1);</script>
</body></html>`;
}
