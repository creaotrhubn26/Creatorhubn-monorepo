/**
 * Proaktiv tilgangsforespørsel-generator.
 *
 * Når en produsent jobber med en kunde og det viser seg at kunden ikke
 * har gitt produsenten admin-tilgang til en plattform — eller kunden
 * mangler kontoen helt — er den vanlige faktiske blockeren ikke teknisk,
 * men kommunikasjon: noen må be om det. Det er et hull som tar 0–14
 * dager og dreper momentum.
 *
 * Denne modulen lukker det hullet ved å generere en konkret e-post
 * produsenten kan kopiere/sende:
 *
 *   - Plattform-spesifikke trinn (Studio → Tillatelser → Inviter rolle X)
 *   - Forklaring av hvorfor det trengs
 *   - Direkte e-postadresse å invitere
 *   - Norsk tone, klar over at mottakeren ikke nødvendigvis er teknisk
 *
 * Data:
 *   - Produsentens e-post hentes fra session
 *   - Kundens navn hentes fra brand_snapshot på prosjektet
 *   - Plattform avgjør hvilke instrukser som blir lagt inn
 *
 * Vi bruker Claude for å gjøre selve teksten naturlig (skreddersydd til
 * kunden + bransje), men har deterministiske instruksjons-blokker som
 * fallback når Claude er utilgjengelig — slik at funksjonen aldri går i
 * stykker.
 */

import type { Pool } from 'pg';

export type SocialAccessPlatform =
  | 'youtube'
  | 'instagram'
  | 'facebook_page'
  | 'linkedin'
  | 'tiktok'
  | 'x'
  | 'threads'
  | 'pinterest';

export interface AccessRequestInput {
  projectId: string;
  platform: SocialAccessPlatform;
  producerEmail: string;
  producerName: string;
  /** Valgfritt: kundens kontaktperson/e-post hvis produsenten kjenner det. */
  recipientName?: string | null;
  recipientEmail?: string | null;
}

export interface AccessRequestResult {
  subject: string;
  greeting: string;
  body: string;
  signoff: string;
  /** Trinnvis instruksjon mottakeren kan følge for å gi tilgang. */
  steps: string[];
  /** Lenke til plattformens admin/permissions-side, så mottakeren slipper
   *  å gjette hvor de skal. */
  adminUrl: string;
  /** Hvilken rolle som skal tildeles produsenten (Manager / Editor / etc). */
  requiredRole: string;
  /** Komplett e-post som plain text, klar for mailto: eller send-via-Gmail. */
  fullText: string;
  /** Komplett e-post som mailto:-URL hvis recipientEmail er satt. */
  mailtoUrl: string | null;
  source: 'claude' | 'fallback';
}

interface PlatformTemplate {
  label: string;
  requiredRole: string;
  adminUrl: string;
  // Hvorfor produsenten trenger tilgang — korte forklaringer i e-posten
  reasonShort: string;
  steps: (producerEmail: string, producerName: string) => string[];
}

const PLATFORM_TEMPLATES: Record<SocialAccessPlatform, PlatformTemplate> = {
  youtube: {
    label: 'YouTube',
    requiredRole: 'Manager',
    adminUrl: 'https://studio.youtube.com',
    reasonShort:
      'For å laste opp videoer, redigere beskrivelser og svare på kommentarer på YouTube-kanalen deres.',
    steps: (email, _name) => [
      `Sørg for at e-posten ${email} er en Google-konto (Gmail eller Workspace) — YouTube krever det. Hvis du er usikker: spør produsenten.`,
      'Logg inn på YouTube Studio: https://studio.youtube.com — med kontoen som eier kanalen.',
      'Hvis dere har flere kanaler, sjekk øverst til høyre at riktig kanal er valgt.',
      'Klikk Innstillinger (tannhjul-ikonet nede til venstre).',
      'Velg fanen "Tillatelser" i dialogen som åpnes.',
      'Klikk knappen "Inviter".',
      `Lim inn e-postadressen: ${email}`,
      'Velg rollen "Behandler" (Manager) — gir tilgang til å laste opp og redigere, men ikke slette kanalen.',
      'Klikk "Ferdig" og deretter "Lagre".',
      'Produsenten vil få e-post fra YouTube — den må aksepteres innen 30 dager (ingen påminnelse sendes automatisk).',
    ],
  },
  instagram: {
    label: 'Instagram (via Meta Business Suite)',
    requiredRole: 'Editor (innholdsskaper)',
    adminUrl: 'https://business.facebook.com/settings/people',
    reasonShort:
      'For å publisere innlegg, reels og stories på Instagram-kontoen deres må vi være lagt til via Meta Business Suite.',
    steps: (email, _name) => [
      'Sjekk først at Instagram-kontoen er Professional (Business eller Creator) og koblet til en Facebook-side. Privatkontoer kan ikke administreres via Meta Business Suite.',
      'Gå til https://business.facebook.com/settings/people og logg inn med kontoen som eier Business Portfolio-en.',
      'Hvis Instagram-kontoen ikke ligger der ennå: åpne "Kontoer → Instagram-kontoer" og koble den til først.',
      'Klikk "Legg til" øverst til høyre.',
      `Lim inn e-postadressen: ${email}`,
      'Velg rolle: "Editor" (kan opprette innhold). Hvis dere ønsker full tilgang, velg "Admin" — men Editor er nok for publisering.',
      'På neste skjermbilde under "Tildel ressurser": kryss av Instagram-kontoen vår.',
      'Sjekk at "Opprett innhold" og "Behandle Instagram" er aktivert.',
      'Klikk "Inviter".',
      'Produsenten får e-post + Facebook-varsel og må akseptere invitasjonen.',
    ],
  },
  facebook_page: {
    label: 'Facebook-side (via Meta Business Suite)',
    requiredRole: 'Editor (sideredaktør)',
    adminUrl: 'https://business.facebook.com/settings/people',
    reasonShort:
      'For å publisere innlegg og svare på meldinger på Facebook-siden deres må vi få Editor-tilgang via Meta Business Suite.',
    steps: (email, _name) => [
      'Gå til https://business.facebook.com/settings/people og logg inn med kontoen som eier Business Portfolio-en.',
      'Sørg for at Facebook-siden ligger under "Kontoer → Sider". Hvis ikke, legg den til først.',
      'Klikk "Legg til" øverst til høyre.',
      `Lim inn e-postadressen: ${email}`,
      'Velg rolle: "Editor". Dette gir tilgang til å publisere uten å gi full admin-kontroll.',
      'Under "Tildel ressurser": kryss av Facebook-siden vår.',
      'Sjekk at tillatelsene "Opprett innhold", "Behandle side" og "Send meldinger" er aktivert.',
      'Klikk "Inviter".',
      'Produsenten får e-post fra Meta og må akseptere invitasjonen.',
    ],
  },
  linkedin: {
    label: 'LinkedIn-bedriftsside',
    requiredRole: 'Innholdsadministrator (Content admin)',
    adminUrl: 'https://www.linkedin.com/company/setup/new/',
    reasonShort:
      'For å publisere innlegg på LinkedIn-bedriftssiden deres trenger vi Content Admin-rolle.',
    steps: (email, _name) => [
      'NB: LinkedIn legger til admins basert på navn på LinkedIn-profilen, ikke e-post. ' +
        `Spør produsenten om hvilken LinkedIn-profil som hører til ${email} og send dem en connection-forespørsel først hvis dere ikke er knyttet (1.-, 2.- eller 3.-grads).`,
      'Logg inn på LinkedIn med en konto som er Super Admin på bedriftssiden.',
      'Klikk "Me" øverst til høyre, og velg bedriftssiden under "Manage" / "Pages".',
      'Klikk "Settings" i venstre meny på bedriftssiden.',
      'Velg "Manage admins".',
      'Klikk på fanen "Page admins" og deretter "Add admin".',
      'Søk opp produsentens fulle navn (samme som på LinkedIn-profilen).',
      'Velg rolle: "Content admin" (Innholdsadministrator). Dette er nok for publisering — ikke gi Super Admin med mindre nødvendig.',
      'Klikk "Save".',
      'Produsenten får e-post + LinkedIn-varsel. Invitasjonen utløper etter 30 dager og det sendes ingen påminnelse — be dem aksepere innen et par dager.',
    ],
  },
  tiktok: {
    label: 'TikTok Business Center',
    requiredRole: 'Standard-medlem med Manage Posts',
    adminUrl: 'https://business.tiktok.com',
    reasonShort:
      'For å publisere TikTok-videoer på kontoen deres må vi få tilgang via TikTok Business Center.',
    steps: (email, _name) => [
      'Sjekk at dere har et Business Center oppsett. Hvis ikke, gå til https://business.tiktok.com og opprett ett først.',
      'Sjekk også at TikTok-kontoen er koblet til Business Center under "Assets → TikTok-kontoer". Hvis ikke, "Link account" først.',
      'Klikk "Members" i venstre meny.',
      'Klikk "Invite member".',
      `Lim inn e-postadressen: ${email}`,
      'Velg rolle "Standard" (ikke Admin med mindre dere ønsker det — Standard er nok for publisering).',
      'På neste steg under "Asset access": velg TikTok-kontoen vår.',
      'Aktiver tillatelsen "Manage posts" (publisere innhold). Dere kan også aktivere "Manage messages" hvis dere vil at produsenten skal kunne svare på DM-er.',
      'Klikk "Send invite".',
      'Produsenten får e-post fra TikTok Business Center. Invitasjonen utløper etter 7 dager.',
    ],
  },
  x: {
    label: 'X / Twitter (Delegate)',
    requiredRole: 'Delegate Contributor',
    adminUrl: 'https://x.com/settings/delegate',
    reasonShort:
      'X støtter delt kontotilgang via Delegate-funksjonen — produsenten kan poste på vegne av dere uten å trenge passord.',
    steps: (email, _name) => [
      'NB: X Delegate krever at dere har et X Premium-abonnement.',
      'Logg inn på X-kontoen som skal deles.',
      'Gå til https://x.com/settings/delegate eller: Innstillinger → Tilgjengelighet, visning og språk → Delegere.',
      'Aktiver bryteren "Tillat delegering".',
      'Klikk "Members" → "Invite a member".',
      `Be produsenten oppgi sitt X-håndtak (brukernavnet som starter med @). Vi trenger ${email} for å sende invitasjon-lenken til produsenten.`,
      'Velg rollen "Contributor" — kan poste, ikke endre konto-innstillinger.',
      'Send invitasjonen.',
      'Produsenten må akseptere invitasjonen fra sin egen X-konto under samme Delegate-meny.',
    ],
  },
  threads: {
    label: 'Threads (via Instagram)',
    requiredRole: 'Editor på Instagram',
    adminUrl: 'https://business.facebook.com/settings/people',
    reasonShort:
      'Threads bruker samme tilgangsstruktur som Instagram-kontoen. Når dere gir oss Editor-tilgang på Instagram, blir Threads tilgjengelig automatisk.',
    steps: (email, _name) => [
      'Følg de samme stegene som for Instagram via Meta Business Suite — Threads bruker samme rolle.',
      `E-post som skal inviteres: ${email}`,
      'Når Instagram-tilgangen er aktiv, dukker Threads opp automatisk i samme grensesnitt.',
    ],
  },
  pinterest: {
    label: 'Pinterest Business',
    requiredRole: 'Admin',
    adminUrl: 'https://business.pinterest.com',
    reasonShort: 'For å publisere på Pinterest-bedriftskontoen deres må vi få Admin-tilgang.',
    steps: (email, _name) => [
      'Logg inn på https://business.pinterest.com med eier-kontoen.',
      'Klikk profilbildet øverst til høyre og velg "Business access".',
      'Velg fanen "Employees".',
      'Klikk "Add employees".',
      `Lim inn e-postadressen: ${email}`,
      'Velg rollen "Admin" — kreves for å publisere via API.',
      'Klikk "Add".',
      'Produsenten får e-post fra Pinterest og må akseptere invitasjonen.',
    ],
  },
};

interface BrandLite {
  companyName: string | null;
  industry: string | null;
  recipientHint: string | null;
}

async function loadBrandLite(pool: Pool, projectId: string): Promise<BrandLite> {
  const platforms = ['instagram', 'facebook_page', 'linkedin', 'youtube'];
  for (const platform of platforms) {
    try {
      const result = await pool.query<{ brand_snapshot: unknown }>(
        `SELECT brand_snapshot FROM role_room_feed_plans
          WHERE project_id = $1 AND platform = $2 LIMIT 1`,
        [projectId, platform],
      );
      const snap = result.rows[0]?.brand_snapshot;
      if (snap && typeof snap === 'object' && !Array.isArray(snap)) {
        const r = snap as Record<string, unknown>;
        const cp =
          r.companyProfile && typeof r.companyProfile === 'object' && !Array.isArray(r.companyProfile)
            ? (r.companyProfile as Record<string, unknown>)
            : null;
        const companyName =
          (typeof cp?.companyName === 'string' && cp.companyName.trim()) ||
          (typeof r.companyName === 'string' && r.companyName.trim()) ||
          null;
        const industry =
          (typeof cp?.industry === 'string' && cp.industry.trim()) ||
          (typeof r.industry === 'string' && r.industry.trim()) ||
          null;
        return {
          companyName: companyName || null,
          industry: industry || null,
          recipientHint: null,
        };
      }
    } catch {
      // try next
    }
  }
  return { companyName: null, industry: null, recipientHint: null };
}

let cachedAnthropicClient: unknown = null;

async function getAnthropicClient(): Promise<any> {
  if (cachedAnthropicClient) return cachedAnthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  // @ts-ignore — optional SDK
  const mod: any = await import('@anthropic-ai/sdk').catch(() => null);
  if (!mod) return null;
  const AnthropicCtor = mod.default ?? mod.Anthropic;
  cachedAnthropicClient = new AnthropicCtor({ apiKey });
  return cachedAnthropicClient;
}

const SYSTEM_PROMPT =
  'Du er en høflig norsk e-post-skriver. Lag korte, konkrete, vennlige forespørsler om å få administrator-tilgang til sosiale medier-kontoer. Returner kun gyldig JSON med feltene subject, greeting, body, signoff. Ikke skriv markdown, ikke skriv tegn-for-tegn forklaringer av selve trinnene (de leveres separat). Hold body på 3–6 setninger.';

async function requestClaudeEmail(
  template: PlatformTemplate,
  brand: BrandLite,
  input: AccessRequestInput,
): Promise<{ subject: string; greeting: string; body: string; signoff: string } | null> {
  const client = await getAnthropicClient();
  if (!client) return null;
  const model = process.env.ROLE_ROOM_ACCESS_REQUEST_MODEL || 'claude-haiku-4-5-20251001';

  const userPayload = {
    task: 'Skriv en kort, vennlig e-post fra produsenten til kunden som ber om admin-tilgang.',
    requirements: [
      'På norsk.',
      'Vennlig og uformell, men profesjonell.',
      'Forklar kort HVORFOR tilgangen trengs (publisering / innhold).',
      'Si tydelig at de tekniske trinnene følger nedenfor (vi limer dem på under).',
      'Ikke gjenta plattform-spesifikke steg i body — de kommer separat.',
      'Slutt med en setning som sier at produsenten gjerne tar et call hvis det er enklere.',
      'Subject skal være kort: "Tilgang til [plattform] — [bedriftsnavn]".',
      'Hold body på 3–6 setninger maks.',
    ],
    platform: template.label,
    requiredRole: template.requiredRole,
    reasonShort: template.reasonShort,
    customer: {
      companyName: brand.companyName,
      industry: brand.industry,
      contactName: input.recipientName,
    },
    producer: {
      name: input.producerName,
      email: input.producerEmail,
    },
  };

  try {
    const response = await Promise.race([
      client.messages.create({
        model,
        max_tokens: 800,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [
          { role: 'user', content: [{ type: 'text', text: JSON.stringify(userPayload) }] },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('access_email_timeout')), 30_000),
      ),
    ]);
    const blocks = (response as any).content ?? [];
    const text = blocks
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
    const trimmed = text.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    const raw = fenceMatch ? fenceMatch[1] : trimmed;
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const f = raw.indexOf('{');
      const l = raw.lastIndexOf('}');
      if (f >= 0 && l > f) {
        try {
          parsed = JSON.parse(raw.slice(f, l + 1));
        } catch {
          /* ignore */
        }
      }
    }
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      subject: typeof parsed.subject === 'string' ? parsed.subject.trim() : '',
      greeting: typeof parsed.greeting === 'string' ? parsed.greeting.trim() : '',
      body: typeof parsed.body === 'string' ? parsed.body.trim() : '',
      signoff: typeof parsed.signoff === 'string' ? parsed.signoff.trim() : '',
    };
  } catch (error) {
    console.warn('[social-access-request] Claude failed', error);
    return null;
  }
}

function buildFallback(
  template: PlatformTemplate,
  brand: BrandLite,
  input: AccessRequestInput,
): { subject: string; greeting: string; body: string; signoff: string } {
  const company = brand.companyName ?? 'dere';
  const recipient = input.recipientName ?? 'der';
  return {
    subject: `Tilgang til ${template.label} — ${company}`,
    greeting: `Hei ${recipient},`,
    body: `${template.reasonShort} Jeg er produsenten som jobber med innholdet for ${company}, og for å kunne publisere effektivt trenger jeg ${template.requiredRole}-tilgang. Jeg har lagt ved en kort steg-for-steg-veiledning under, så det skal ta 2–3 minutter å sette opp. Si fra hvis dere heller vil at vi tar det over et raskt videomøte — jeg er fleksibel.`,
    signoff: `Takk på forhånd!\n${input.producerName}\n${input.producerEmail}`,
  };
}

function buildFullText(
  parts: { subject: string; greeting: string; body: string; signoff: string },
  steps: string[],
): string {
  const stepsBlock = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return [parts.greeting, '', parts.body, '', 'Slik gjør dere det:', stepsBlock, '', parts.signoff].join('\n');
}

function buildMailto(recipient: string | null | undefined, subject: string, body: string): string | null {
  if (!recipient || !recipient.trim()) return null;
  const enc = encodeURIComponent;
  return `mailto:${enc(recipient)}?subject=${enc(subject)}&body=${enc(body)}`;
}

export async function generateSocialAccessRequest(
  pool: Pool,
  input: AccessRequestInput,
): Promise<AccessRequestResult> {
  const template = PLATFORM_TEMPLATES[input.platform];
  const brand = await loadBrandLite(pool, input.projectId);
  const steps = template.steps(input.producerEmail, input.producerName);

  const claudeParts = await requestClaudeEmail(template, brand, input);
  const parts = claudeParts && claudeParts.subject && claudeParts.body
    ? claudeParts
    : buildFallback(template, brand, input);

  const fullText = buildFullText(parts, steps);
  const mailtoUrl = buildMailto(input.recipientEmail ?? null, parts.subject, fullText);

  return {
    subject: parts.subject,
    greeting: parts.greeting,
    body: parts.body,
    signoff: parts.signoff,
    steps,
    adminUrl: template.adminUrl,
    requiredRole: template.requiredRole,
    fullText,
    mailtoUrl,
    source: claudeParts ? 'claude' : 'fallback',
  };
}

export const SUPPORTED_ACCESS_REQUEST_PLATFORMS: SocialAccessPlatform[] = Object.keys(
  PLATFORM_TEMPLATES,
) as SocialAccessPlatform[];

export function isSupportedAccessRequestPlatform(value: unknown): value is SocialAccessPlatform {
  return typeof value === 'string' && (SUPPORTED_ACCESS_REQUEST_PLATFORMS as string[]).includes(value);
}
