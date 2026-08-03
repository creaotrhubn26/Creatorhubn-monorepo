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

import { claudeProxyService, isAiConnected } from '../../services/claudeProxyService';
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

  onStep?.('Leser nettsiden…');
  const { context } = await gatherSiteContext(url);
  if (!context || context.length < 80) {
    throw new Error('Fikk ikke nok innhold fra nettsiden (krever innlogging, blokkert, eller tom).');
  }

  onStep?.('Fanger skjermbilder…');
  let shots: CapturedShot[] = [];
  try { shots = await captureSiteShots(url); } catch { /* fortsett uten skjermbilder */ }

  onStep?.('Skriver utkast…');
  const templateList = MOCKUP_TEMPLATES
    .map((t) => `- ${t.id}: ${t.name} — ${t.description} (${t.devices} enhet(er), ${t.variant})`)
    .join('\n');
  const prompt =
    `Du får tekst fra en produkt/tjeneste-nettside. Lag et kort, selgende NORSK one-pager-utkast for salgsmateriell.\n\n` +
    `Velg ÉN mal-id som passer produktet og budskapet best:\n${templateList}\n\n` +
    `NETTSIDE-INNHOLD:\n${context.slice(0, 6000)}\n\n` +
    `Svar med KUN ett JSON-objekt (ingen forklaring, ingen code-fence):\n` +
    `{ "templateId": "<mal-id>", "eyebrow": "<1-3 ords etikett>", "title": "<kraftig overskrift, maks 40 tegn>", ` +
    `"body": "<verdiløfte, 1-2 setninger, maks 150 tegn>", "tag": "<CTA eller nettadresse, maks 40 tegn>", ` +
    `"accent": "<#hex primær merkevarefarge>", "accent2": "<#hex sekundærfarge>", "background": "<light|dark|brand>" }`;

  const raw = await claudeProxyService.send({
    systemPrompt: 'Du er en norsk B2B-produktmarkedsfører som lager knappe, konkrete, selgende one-pagere. Svar ALLTID med kun ett gyldig JSON-objekt.',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
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
