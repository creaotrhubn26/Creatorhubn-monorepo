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

// ── Inline SVG-ikoner (matchet til @mui/icons-material outlined-stil) ──
// Material Icons SVG-path-data (Apache 2.0, samme paths som MUI bruker).
// Brukes i e-post fordi React-komponenter ikke kan inlines i HTML-strenger.
// Per UI-konvensjon: aldri emojis i ikon-posisjoner — alltid MUI-style SVG.
const ICON_PATHS = {
  // VisibilityOutlinedIcon
  visibility: 'M12 6c3.79 0 7.17 2.13 8.82 5.5C19.17 14.87 15.79 17 12 17s-7.17-2.13-8.82-5.5C4.83 8.13 8.21 6 12 6m0-2C7 4 2.73 7.11 1 11.5 2.73 15.89 7 19 12 19s9.27-3.11 11-7.5C21.27 7.11 17 4 12 4zm0 5c1.38 0 2.5 1.12 2.5 2.5S13.38 14 12 14s-2.5-1.12-2.5-2.5S10.62 9 12 9m0-2c-2.48 0-4.5 2.02-4.5 4.5S9.52 16 12 16s4.5-2.02 4.5-4.5S14.48 7 12 7z',
  // StarOutlineIcon
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  // NotificationsActiveOutlinedIcon — for påminnelse
  notification: 'M7.58 4.08L6.15 2.65C3.75 4.48 2.17 7.3 2.03 10.5h2c.15-2.65 1.51-4.97 3.55-6.42zm12.39 6.42h2c-.15-3.2-1.73-6.02-4.12-7.85l-1.42 1.43c2.02 1.45 3.39 3.77 3.54 6.42zM18 11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2v-5zm-6 11c.14 0 .27-.01.4-.04.65-.14 1.18-.58 1.44-1.18.1-.24.15-.5.15-.78h-4c.01 1.1.9 2 2.01 2z',
  // ChatBubbleOutlineIcon
  chat: 'M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM20 4v13.17L18.83 16H4V4h16z',
  // CheckCircleOutlineIcon
  checkCircle: 'M16.59 7.58L10 14.17l-3.59-3.58L5 12l5 5 8-8zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  // TrackChangesOutlinedIcon — for "lead/target"
  trackChanges: 'M19.07 4.93l-1.41 1.41C19.1 7.79 20 9.79 20 12c0 4.42-3.58 8-8 8s-8-3.58-8-8c0-4.08 3.05-7.44 7-7.93v2.02C8.16 6.57 6 9.03 6 12c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.66-.67-3.16-1.76-4.24l-1.41 1.41C15.55 9.9 16 10.9 16 12c0 2.21-1.79 4-4 4s-4-1.79-4-4c0-1.86 1.28-3.41 3-3.86v2.14c-.6.35-1 .98-1 1.72 0 1.1.9 2 2 2s2-.9 2-2c0-.74-.4-1.38-1-1.72V2h-1C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-2.76-1.12-5.26-2.93-7.07z',
  // PaidOutlinedIcon — for priser
  paid: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5.5h-2.34v1.19c-1.5.32-2.71 1.3-2.71 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z',
  // HelpOutlineIcon — for FAQ
  help: 'M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z',
  // SlideshowOutlinedIcon — for pitch deck
  slideshow: 'M10 16.5l6-4.5-6-4.5v9zM19 3H5c-1.11 0-2 .89-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 16H5V5h14v14z',
  // PlayCircleOutlineIcon
  playCircle: 'M10 16.5l6-4.5-6-4.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  // VideocamOutlinedIcon
  videocam: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM15 16H5V8h10v8z',
} as const;

type IconName = keyof typeof ICON_PATHS;

/**
 * Renders an inline SVG-icon matching MUI Material Icons outlined-style.
 * @param name Path-key fra ICON_PATHS
 * @param color CSS-color (default: textPrimary)
 * @param size pixel-størrelse (default: 14)
 */
export function emailIcon(name: IconName, color: string = emailPalette.textPrimary, size = 14): string {
  const path = ICON_PATHS[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" style="vertical-align:middle;display:inline-block;">
    <path d="${path}"/>
  </svg>`;
}

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

const CATEGORY_BADGE: Record<EmailCategory, { label: string; bg: string; fg: string; icon: IconName }> = {
  viewed:        { label: 'Sett',          bg: 'rgba(96,165,250,0.22)',  fg: '#60a5fa', icon: 'visibility' },
  shortlisted:   { label: 'Shortlistet',   bg: 'rgba(251,191,36,0.22)',  fg: '#fbbf24', icon: 'star' },
  reminder:      { label: 'Påminnelse',    bg: 'rgba(251,191,36,0.22)',  fg: '#fbbf24', icon: 'notification' },
  comment:       { label: 'Kommentar',     bg: 'rgba(168,85,247,0.22)',  fg: '#c084fc', icon: 'chat' },
  welcome:       { label: 'Velkommen',     bg: 'rgba(52,211,153,0.22)',  fg: '#34d399', icon: 'checkCircle' },
  lead_internal: { label: 'Ny lead',       bg: 'rgba(217,70,239,0.22)',  fg: '#e879f9', icon: 'trackChanges' },
  lead_ack:      { label: 'Mottatt',       bg: 'rgba(52,211,153,0.22)',  fg: '#34d399', icon: 'checkCircle' },
  general:       { label: 'The Role Room', bg: 'rgba(168,85,247,0.22)',  fg: '#c084fc', icon: 'playCircle' },
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
export function emailHeader(category: EmailCategory = 'general', brand: 'roleroom' | 'creatorhub' = 'roleroom'): string {
  const cat = CATEGORY_BADGE[category];
  // Ekte logo-bilder (absolutte URL-er for e-post). Creatorhub-wordmarken er lys →
  // får en mørk pille for kontrast på lys e-post-bakgrunn. Role Room-logoen er
  // mørk/lilla og vises som den er.
  const logoHtml = brand === 'creatorhub'
    ? `<div style="display:inline-block;background:#0b0c10;border-radius:8px;padding:7px 12px;"><img src="https://creatorhubn.com/creatorhub-wordmark-light.png" alt="Creatorhub Norge" height="26" style="display:block;height:26px;width:auto;border:0;" /></div>`
    : `<img src="https://theroleroom.com/TheRoleRoom_Logo_Tagline.png" alt="The Role Room" height="40" style="display:block;height:40px;width:auto;border:0;" />`;
  return `
    <tr>
      <td style="padding:32px 32px 8px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              ${logoHtml}
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
                padding:5px 10px 5px 8px;
                border-radius:999px;
                line-height:1;
              ">${emailIcon(cat.icon, cat.fg, 11)} <span style="vertical-align:middle;margin-left:4px;">${escapeHtml(cat.label)}</span></span>
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
  brand?: 'roleroom' | 'creatorhub';
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
    emailHeader(args.category, args.brand),
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
