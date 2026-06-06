/**
 * email-design-system.ts
 *
 * Gjenbrukbare HTML-byggeklosser for transactional e-poster i
 * The Role Room. Bygd på prinsippene:
 *
 *   - Inline CSS (klienter ignorerer external stylesheets)
 *   - Table-baserte layouts (Outlook/Gmail-kompatibilitet)
 *   - Maks 600 px innholdsbredde
 *   - Dark theme matchet til Role Room sin lilla palett
 *   - Mobile-first: kollapser til en kolonne, generøs padding
 *   - Web-safe fonts med sans-serif fallback
 *
 * Alle templates bygges som `renderEmail({ ... })` som returnerer både
 * HTML og plain-text fallback i én samlet pakke.
 */

// ── Design-tokens (matcher Talents-appens palett) ────────────────
export const emailPalette = {
  bgOuter: '#0a0118',
  bgCard: '#150b2e',
  bgElevated: '#1a0f3a',
  border: 'rgba(168, 85, 247, 0.18)',
  borderStrong: 'rgba(168, 85, 247, 0.32)',
  borderSubtle: 'rgba(168, 85, 247, 0.10)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accent: '#a855f7',
  accentBright: '#c084fc',
  accentDeep: '#7c3aed',
  accentMagenta: '#d946ef',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
} as const;

const PUBLIC_URL = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

// ── Kategorier for badge i header ────────────────────────────────
export type EmailCategory =
  | 'viewed'
  | 'shortlisted'
  | 'reminder'
  | 'comment'
  | 'welcome'
  | 'lead_internal'
  | 'lead_ack'
  | 'general';

const CATEGORY_BADGE: Record<EmailCategory, { label: string; bg: string; fg: string }> = {
  viewed:        { label: 'Sett',         bg: 'rgba(96,165,250,0.22)',  fg: '#60a5fa' },
  shortlisted:   { label: 'Shortlistet',  bg: 'rgba(251,191,36,0.22)',  fg: '#fbbf24' },
  reminder:      { label: 'Påminnelse',   bg: 'rgba(251,191,36,0.22)',  fg: '#fbbf24' },
  comment:       { label: 'Kommentar',    bg: 'rgba(168,85,247,0.22)',  fg: '#c084fc' },
  welcome:       { label: 'Velkommen',    bg: 'rgba(52,211,153,0.22)',  fg: '#34d399' },
  lead_internal: { label: 'Ny lead 🎯',   bg: 'rgba(217,70,239,0.22)',  fg: '#e879f9' },
  lead_ack:      { label: 'Mottatt',      bg: 'rgba(52,211,153,0.22)',  fg: '#34d399' },
  general:       { label: 'The Role Room', bg: 'rgba(168,85,247,0.22)', fg: '#c084fc' },
};

// ── Utility: HTML-escape ─────────────────────────────────────────
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Utility: konverter HTML til plain-text-fallback ──────────────
// Brukes når caller ikke leverer egen plain-text.
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|h[1-6]|li|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ──────────────────────────────────────────────────────────────────
// Header — logo + kategori-badge
// ──────────────────────────────────────────────────────────────────
export function emailHeader(category: EmailCategory = 'general'): string {
  const cat = CATEGORY_BADGE[category];
  return `
    <tr>
      <td style="padding:32px 32px 8px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="
                    width:32px;
                    height:32px;
                    background:linear-gradient(135deg,${emailPalette.accent} 0%,${emailPalette.accentMagenta} 100%);
                    border-radius:6px;
                    text-align:center;
                    vertical-align:middle;
                    color:#ffffff;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                    font-weight:800;
                    font-size:13px;
                    line-height:32px;
                  ">RR</td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="
                      color:${emailPalette.textPrimary};
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                      font-weight:800;
                      font-size:14px;
                      letter-spacing:-0.1px;
                    ">The Role Room</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align:middle;text-align:right;">
              <span style="
                display:inline-block;
                background:${cat.bg};
                color:${cat.fg};
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                font-weight:700;
                font-size:11px;
                letter-spacing:0.6px;
                text-transform:uppercase;
                padding:5px 10px;
                border-radius:999px;
              ">${escapeHtml(cat.label)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// ──────────────────────────────────────────────────────────────────
// Hero-blokk: H1 + ingress
// ──────────────────────────────────────────────────────────────────
export function emailHero(args: { headline: string; subhead?: string }): string {
  return `
    <tr>
      <td style="padding:24px 32px 8px 32px;">
        <h1 style="
          margin:0;
          color:${emailPalette.textPrimary};
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
          font-size:24px;
          line-height:1.25;
          font-weight:800;
          letter-spacing:-0.3px;
        ">${escapeHtml(args.headline)}</h1>
        ${args.subhead ? `
          <p style="
            margin:12px 0 0 0;
            color:${emailPalette.textSecondary};
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            font-size:15px;
            line-height:1.55;
          ">${escapeHtml(args.subhead)}</p>
        ` : ''}
      </td>
    </tr>
  `;
}

// ──────────────────────────────────────────────────────────────────
// Body text — fri-tekst (newlines blir <br/>)
// ──────────────────────────────────────────────────────────────────
export function emailBody(text: string): string {
  const html = escapeHtml(text).replace(/\n/g, '<br/>');
  return `
    <tr>
      <td style="padding:16px 32px 16px 32px;">
        <p style="
          margin:0;
          color:${emailPalette.textSecondary};
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
          font-size:15px;
          line-height:1.6;
        ">${html}</p>
      </td>
    </tr>
  `;
}

// ──────────────────────────────────────────────────────────────────
// Body HTML — caller gir sin egen markup
// ──────────────────────────────────────────────────────────────────
export function emailBodyHtml(html: string): string {
  return `
    <tr>
      <td style="padding:16px 32px 16px 32px;color:${emailPalette.textSecondary};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;">
        ${html}
      </td>
    </tr>
  `;
}

// ──────────────────────────────────────────────────────────────────
// Quote / blockquote — sitat-stil
// ──────────────────────────────────────────────────────────────────
export function emailQuote(text: string): string {
  const html = escapeHtml(text).replace(/\n/g, '<br/>');
  return `
    <tr>
      <td style="padding:8px 32px 16px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="
              border-left:3px solid ${emailPalette.accentBright};
              padding:14px 18px;
              background:rgba(168,85,247,0.10);
              border-radius:0 8px 8px 0;
            ">
              <p style="
                margin:0;
                color:${emailPalette.textPrimary};
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                font-size:14px;
                line-height:1.6;
              ">${html}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// ──────────────────────────────────────────────────────────────────
// CTA-knapp (lilla gradient)
// ──────────────────────────────────────────────────────────────────
export function emailCTA(args: { label: string; href: string; variant?: 'primary' | 'secondary' }): string {
  const isPrimary = (args.variant ?? 'primary') === 'primary';
  const bg = isPrimary
    ? `linear-gradient(135deg,${emailPalette.accent} 0%,${emailPalette.accentMagenta} 100%)`
    : 'transparent';
  const color = isPrimary ? '#ffffff' : emailPalette.textPrimary;
  const border = isPrimary ? 'none' : `1px solid ${emailPalette.borderStrong}`;
  return `
    <tr>
      <td style="padding:16px 32px 24px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="
              background:${bg};
              border:${border};
              border-radius:10px;
              ${isPrimary ? 'box-shadow:0 6px 18px rgba(168,85,247,0.42);' : ''}
            ">
              <a href="${escapeHtml(args.href)}" style="
                display:inline-block;
                color:${color};
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                font-weight:700;
                font-size:14px;
                text-decoration:none;
                padding:13px 26px;
                border-radius:10px;
              ">${escapeHtml(args.label)} →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

// ──────────────────────────────────────────────────────────────────
// Key-value tabell (lead-detail-stil)
// ──────────────────────────────────────────────────────────────────
export function emailKeyValueTable(rows: Array<{ label: string; value: string; pre?: boolean }>): string {
  return `
    <tr>
      <td style="padding:8px 32px 16px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="
          border:1px solid ${emailPalette.borderSubtle};
          border-radius:10px;
          background:${emailPalette.bgElevated};
        ">
          ${rows.map((r, i) => `
            <tr>
              <td style="
                padding:12px 16px;
                color:${emailPalette.textMuted};
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                font-size:11px;
                font-weight:700;
                text-transform:uppercase;
                letter-spacing:0.5px;
                width:38%;
                vertical-align:top;
                ${i < rows.length - 1 ? `border-bottom:1px solid ${emailPalette.borderSubtle};` : ''}
              ">${escapeHtml(r.label)}</td>
              <td style="
                padding:12px 16px;
                color:${emailPalette.textPrimary};
                font-family:${r.pre ? "'SFMono-Regular',Menlo,Monaco,Consolas,monospace" : "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"};
                font-size:14px;
                font-weight:600;
                line-height:1.4;
                ${i < rows.length - 1 ? `border-bottom:1px solid ${emailPalette.borderSubtle};` : ''}
                ${r.pre ? 'white-space:pre-wrap;' : ''}
              ">${escapeHtml(r.value)}</td>
            </tr>
          `).join('')}
        </table>
      </td>
    </tr>
  `;
}

// ──────────────────────────────────────────────────────────────────
// Divider / spacer
// ──────────────────────────────────────────────────────────────────
export function emailDivider(): string {
  return `
    <tr>
      <td style="padding:0 32px;">
        <div style="height:1px;background:${emailPalette.borderSubtle};line-height:1px;font-size:1px;">&nbsp;</div>
      </td>
    </tr>
  `;
}

// ──────────────────────────────────────────────────────────────────
// Footer — kontakt + unsubscribe
// ──────────────────────────────────────────────────────────────────
export function emailFooter(args?: {
  reason?: string;          // forklaring av hvorfor de får e-posten
  preferencesUrl?: string;  // link til å justere varslings-preferanser
}): string {
  return `
    <tr>
      <td style="padding:24px 32px 32px 32px;border-top:1px solid ${emailPalette.borderSubtle};">
        <p style="
          margin:0 0 8px 0;
          color:${emailPalette.textMuted};
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
          font-size:12px;
          line-height:1.55;
        ">${escapeHtml(args?.reason ?? 'Du mottar denne e-posten fordi du har en aktiv konto i The Role Room.')}</p>
        <p style="
          margin:0;
          color:${emailPalette.textMuted};
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
          font-size:12px;
          line-height:1.55;
        ">
          The Role Room · <a href="${PUBLIC_URL}" style="color:${emailPalette.accentBright};text-decoration:none;">theroleroom.com</a>
          ${args?.preferencesUrl ? ` · <a href="${escapeHtml(args.preferencesUrl)}" style="color:${emailPalette.accentBright};text-decoration:none;">Varslings-innstillinger</a>` : ''}
        </p>
      </td>
    </tr>
  `;
}

// ──────────────────────────────────────────────────────────────────
// Shell — outer wrapper med background + card
// ──────────────────────────────────────────────────────────────────
export interface RenderEmailArgs {
  /** <title>-element + ev. for noen klienter. */
  subject: string;
  /** Preheader = inbox-preview-tekst (skjult i body men leses av Gmail). */
  preheader?: string;
  /** Komplett HTML for cellene mellom header og footer. */
  bodyHtml: string;
  /** Plain-text fallback. Hvis ikke gitt, regneres ut fra bodyHtml. */
  bodyText?: string;
  /** Footer-konfigurasjon. */
  footer?: { reason?: string; preferencesUrl?: string };
}

export function renderEmail(args: RenderEmailArgs): { html: string; text: string } {
  const html = `<!doctype html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(args.subject)}</title>
  <meta name="color-scheme" content="dark light" />
  <meta name="supported-color-schemes" content="dark light" />
</head>
<body style="
  margin:0;
  padding:0;
  background:${emailPalette.bgOuter};
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
  -webkit-text-size-adjust:100%;
  width:100%;
">
  ${args.preheader ? `
    <div style="display:none;font-size:1px;color:${emailPalette.bgOuter};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      ${escapeHtml(args.preheader)}
    </div>
  ` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${emailPalette.bgOuter};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="
          max-width:600px;
          background:${emailPalette.bgCard};
          border:1px solid ${emailPalette.border};
          border-radius:14px;
          overflow:hidden;
        ">
          ${args.bodyHtml}
          ${emailFooter(args.footer)}
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
          <tr>
            <td style="
              color:${emailPalette.textMuted};
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
              font-size:11px;
              text-align:center;
            ">© ${new Date().getFullYear()} The Role Room · CreatorHub</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = args.bodyText ?? htmlToText(args.bodyHtml);
  return { html, text };
}

// ──────────────────────────────────────────────────────────────────
// Convenience composer: bygg standard-shellen med vanlige biter
// ──────────────────────────────────────────────────────────────────
export interface ComposeArgs {
  category?: EmailCategory;
  subject: string;
  preheader?: string;
  headline: string;
  subhead?: string;
  body?: string;
  bodyHtml?: string;
  quote?: string;
  table?: Array<{ label: string; value: string; pre?: boolean }>;
  cta?: { label: string; href: string; variant?: 'primary' | 'secondary' };
  footer?: { reason?: string; preferencesUrl?: string };
  bodyText?: string;
}

export function composeEmail(args: ComposeArgs): { html: string; text: string } {
  const parts: string[] = [
    emailHeader(args.category),
    emailHero({ headline: args.headline, subhead: args.subhead }),
  ];
  if (args.body) parts.push(emailBody(args.body));
  if (args.bodyHtml) parts.push(emailBodyHtml(args.bodyHtml));
  if (args.quote) parts.push(emailQuote(args.quote));
  if (args.table) parts.push(emailKeyValueTable(args.table));
  if (args.cta) parts.push(emailCTA(args.cta));
  return renderEmail({
    subject: args.subject,
    preheader: args.preheader,
    bodyHtml: parts.join(''),
    bodyText: args.bodyText,
    footer: args.footer,
  });
}
