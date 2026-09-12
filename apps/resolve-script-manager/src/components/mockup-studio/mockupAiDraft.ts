/**
 * mockupAiDraft.ts — AI-autoutkast: URL → ferdig one-pager-utkast.
 *
 * Lim inn en produkt-URL → appen leser nettsiden (gjenbruker Demo Studios
 * gatherSiteContext), fanger skjermbilder, og ber Claude (via claudeProxyService,
 * samme Role Room-proxy som resten av AI-en) drafte overskrift/tekst/accent-
 * farger + velge en passende mal. Bygger et redigerbart MockupDoc — brukeren
 * har bare lagt inn produktet, systemet har sørget for resten.
 *
 * Krever at AI-proxyen er tilkoblet (RR-token). Alt er redigerbart etterpå.
 */

import { claudeProxyService, isAiConnected, type ClaudeContentBlock } from '../../services/claudeProxyService';
import { gatherSiteContext } from '../demo-studio/demoStudioAI';
import { MOCKUP_TEMPLATES, buildTemplate, type MockupDoc, type MockupBackground, type MockupTextRole } from './mockupStudioModel';
import { captureSiteShots, bestShotForVariant, hostnameOf, type CapturedShot } from './mockupCapture';

const HEX = /^#[0-9a-f]{6}$/i;

interface Draft {
  templateId?: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  tag?: string;
  accent?: string;
  accent2?: string;
  background?: string;
}

/** Robust JSON-uttrekk fra en Claude-tekstrespons (tåler code-fences + prat). */
function extractJson<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '');
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(cleaned.slice(s, e + 1)) as T; } catch { return null; }
}

/** Bygg en Claude vision-bildeblokk fra en data-URL (png/jpeg). */
function imageBlock(dataUrl: string): ClaudeContentBlock | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return null;
  const media_type: 'image/png' | 'image/jpeg' = m[1] === 'image/png' ? 'image/png' : 'image/jpeg';
  return { type: 'image', source: { type: 'base64', media_type, data: m[2] } };
}

/** Er AI-proxyen tilgjengelig? (Styrer om AI-utkast-knappen er aktiv.) */
export function aiAvailable(): boolean {
  return isAiConnected();
}

/**
 * Lag et one-pager-utkast fra en URL. onStep rapporterer fremdrift.
 * Kaster med forklarende feilmelding ved manglende AI / tomt innhold / ugyldig svar.
 */
export async function aiDraftOnePager(url: string, onStep?: (s: string) => void): Promise<MockupDoc> {
  if (!isAiConnected()) {
    throw new Error('AI-proxyen er ikke tilkoblet. Logg inn (RR-token) i Innstillinger.');
  }

  onStep?.('Fanger + leser nettsiden…');
  // Skjermbilde (Playwright, rendrer JS) OG tekst (HTTP) parallelt — begge
  // best-effort. VIKTIG: mange produktsider er SPA-er der ren HTTP-henting gir
  // et tomt skall, så SKJERMBILDET (vision) er primærkilden for innholdet.
  const [ctxRes, shots] = await Promise.all([
    gatherSiteContext(url).catch(() => ({ context: '', pages: [] as string[] })),
    captureSiteShots(url).catch(() => [] as CapturedShot[]),
  ]);
  const context = (ctxRes.context || '').trim();
  const topShot = shots.find((s) => s.viewport === 'desktop') ?? shots[0];
  const hasText = context.length >= 60;
  if (!hasText && !topShot) {
    throw new Error('Fikk verken tekst eller skjermbilde fra nettsiden (krever innlogging eller blokkert).');
  }

  onStep?.('Skriver utkast…');
  const templateList = MOCKUP_TEMPLATES
    .map((t) => `- ${t.id}: ${t.name} — ${t.description} (${t.devices} enhet(er), ${t.variant})`)
    .join('\n');
  // Opptil 2 desktop-skjermbilder (topp + neste scroll) for rikere innhold på
  // bilde-tunge helter; ellers hva vi har.
  const desktop = shots.filter((s) => s.viewport === 'desktop').slice(0, 2);
  const visionShots = desktop.length ? desktop : (topShot ? [topShot] : []);

  const prompt =
    `Lag et kort, selgende NORSK one-pager-utkast for salgsmateriell, basert på ` +
    (visionShots.length ? `SKJERMBILDENE av produkt-nettsiden (les produktnavn, overskrifter, verdiløfte og funksjoner DIREKTE fra bildene)` : 'tekst-innholdet under') +
    (hasText ? ' og tekst-utdraget under' : '') + '.\n\n' +
    `Velg ÉN mal-id som passer produktet og budskapet best:\n${templateList}\n\n` +
    (hasText ? `TEKST-UTDRAG:\n${context.slice(0, 5000)}\n\n` : '') +
    `Svar med KUN ett JSON-objekt (ingen forklaring, ingen code-fence):\n` +
    `{ "templateId": "<mal-id>", "eyebrow": "<1-3 ords etikett>", "title": "<kraftig overskrift, maks 40 tegn>", ` +
    `"body": "<verdiløfte, 1-2 setninger, maks 150 tegn>", "tag": "<CTA eller nettadresse, maks 40 tegn>", ` +
    `"accent": "<#hex primær merkevarefarge>", "accent2": "<#hex sekundærfarge>", "background": "<light|dark|brand>" }`;

  const content: ClaudeContentBlock[] = [];
  for (const s of visionShots) {
    const b = imageBlock(s.dataUrl);
    if (b) content.push(b);
  }
  content.push({ type: 'text', text: prompt });

  const raw = await claudeProxyService.send({
    systemPrompt: 'Du er en norsk B2B-produktmarkedsfører som lager knappe, konkrete, selgende one-pagere. Du kan lese innholdet på en nettside direkte fra et skjermbilde. Svar ALLTID med kun ett gyldig JSON-objekt.',
    messages: [{ role: 'user', content }],
    maxTokens: 700,
  });
  const p = extractJson<Draft>(raw);
  if (!p) throw new Error('AI-svaret kunne ikke tolkes som JSON.');

  const tid = p.templateId && MOCKUP_TEMPLATES.some((t) => t.id === p.templateId) ? p.templateId : 'hero_mac_phone_dark';
  const doc = buildTemplate(tid);

  if (p.accent && HEX.test(p.accent)) doc.canvas.accent = p.accent;
  if (p.accent2 && HEX.test(p.accent2)) doc.canvas.accent2 = p.accent2;
  if (p.background === 'light' || p.background === 'dark' || p.background === 'brand') {
    doc.canvas.background = p.background as MockupBackground;
  }

  const setRole = (role: MockupTextRole, val?: string) => {
    if (!val || !val.trim()) return;
    const target = doc.texts.find((t) => t.role === role);
    if (target) target.text = val.trim();
  };
  setRole('eyebrow', p.eyebrow);
  setRole('title', p.title);
  setRole('body', p.body);
  setRole('tag', p.tag);

  doc.devices.forEach((d) => {
    const s = bestShotForVariant(shots, d.variant);
    if (s) d.image = s.dataUrl;
  });

  const host = hostnameOf(url);
  if (host) doc.name = host;

  onStep?.('Ferdig');
  return doc;
}
