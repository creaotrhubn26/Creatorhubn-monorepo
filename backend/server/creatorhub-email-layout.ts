export type CreatorHubEmailLayoutTheme = {
  canvasBackground: string;
  cardBackground: string;
  cardBorder: string;
  headerBackground: string;
  headerText: string;
  brandLabelColor: string;
  bodyText: string;
  mutedText: string;
  buttonBackground: string;
  buttonText: string;
  footerText: string;
};

export type CreatorHubEmailLayoutInput = {
  theme: CreatorHubEmailLayoutTheme;
  appName: string;
  tagline: string;
  domain: string;
  categoryLabel: string;
  title: string;
  bodyHtml: string;
  detailHtml?: string;
  noticeHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
  footerText: string;
  logo?: {
    url: string;
    width: number;
    height: number;
    style: string;
  } | null;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Compatibility-first CreatorHub e-mail chrome. The content itself still
 * comes from Email Designer, while the surrounding table layout, logo and
 * CTA are deterministic across Gmail, Outlook and Apple Mail.
 */
export function buildCreatorHubEmailLayout(input: CreatorHubEmailLayoutInput): string {
  const { theme } = input;
  const logoHtml = input.logo
    ? `<img src="${escapeHtml(input.logo.url)}" alt="${escapeHtml(input.appName)}" width="${input.logo.width}" height="${input.logo.height}" style="${escapeHtml(input.logo.style)}" />`
    : "";
  const ctaUrl = String(input.ctaUrl || "").trim();
  const ctaLabel = String(input.ctaLabel || "").trim();
  const ctaHtml = ctaUrl && ctaLabel
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px">
        <tr>
          <td bgcolor="${escapeHtml(theme.buttonBackground)}" style="border-radius:999px;text-align:center">
            <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(ctaUrl)}" style="height:48px;v-text-anchor:middle;width:250px" arcsize="50%" stroke="f" fillcolor="${escapeHtml(theme.buttonBackground)}"><w:anchorlock/><center style="color:${escapeHtml(theme.buttonText)};font-family:Arial,sans-serif;font-size:15px;font-weight:bold">${escapeHtml(ctaLabel)}</center></v:roundrect><![endif]-->
            <!--[if !mso]><!--><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:15px 22px;border-radius:999px;background:${escapeHtml(theme.buttonBackground)};color:${escapeHtml(theme.buttonText)};text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:800;letter-spacing:0.01em">${escapeHtml(ctaLabel)}</a><!--<![endif]-->
          </td>
        </tr>
      </table>`
    : "";
  const preheader = `${input.title} · ${input.tagline}`;

  return `<!doctype html>
<html lang="nb">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(input.title)}</title>
    <!--[if mso]><style>table,td,p,a,h1{font-family:Arial,sans-serif!important}</style><![endif]-->
    <style>
      @media only screen and (max-width:620px){
        .creatorhub-shell{width:100%!important}
        .creatorhub-pad{padding-left:20px!important;padding-right:20px!important}
        .creatorhub-title{font-size:25px!important}
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${escapeHtml(theme.canvasBackground)};word-spacing:normal">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${escapeHtml(theme.canvasBackground)}" style="width:100%;background:${escapeHtml(theme.canvasBackground)}">
      <tr>
        <td align="center" style="padding:32px 16px">
          <!--[if mso]><table role="presentation" width="720" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="creatorhub-shell" style="width:100%;max-width:720px;background:${escapeHtml(theme.cardBackground)};border:1px solid ${escapeHtml(theme.cardBorder)};border-radius:24px;overflow:hidden">
            <tr>
              <td class="creatorhub-pad" style="padding:28px;background:${escapeHtml(theme.headerBackground)};color:${escapeHtml(theme.headerText)};border-bottom:1px solid ${escapeHtml(theme.cardBorder)}">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="vertical-align:middle">${logoHtml}</td>
                    <td valign="middle" align="right" style="vertical-align:middle;text-align:right;padding-left:16px">
                      <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${escapeHtml(theme.brandLabelColor)};font-weight:800">${escapeHtml(input.appName)}</div>
                      <div style="margin-top:6px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:${escapeHtml(theme.mutedText)}">${escapeHtml(input.tagline)}</div>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:24px;display:inline-block;padding:7px 12px;border-radius:999px;background:#171d26;color:${escapeHtml(theme.brandLabelColor)};font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:800">${escapeHtml(input.categoryLabel)}</div>
                <h1 class="creatorhub-title" style="margin:18px 0 0;font-family:Arial,sans-serif;font-size:29px;line-height:1.15;color:${escapeHtml(theme.headerText)};font-weight:700">${escapeHtml(input.title)}</h1>
                <p style="margin:14px 0 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:${escapeHtml(theme.mutedText)}">${escapeHtml(`${input.tagline} · ${input.domain}`)}</p>
              </td>
            </tr>
            <tr>
              <td class="creatorhub-pad" style="padding:28px;background:${escapeHtml(theme.cardBackground)}">
                <div style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:${escapeHtml(theme.bodyText)}">${input.bodyHtml}</div>
                ${input.detailHtml || ""}
                ${input.noticeHtml || ""}
                ${ctaHtml}
                ${input.footerNote ? `<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:12px;line-height:1.8;color:${escapeHtml(theme.mutedText)}">${escapeHtml(input.footerNote)}</p>` : ""}
                <div style="padding-top:18px;border-top:1px solid ${escapeHtml(theme.cardBorder)}">
                  <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.8;color:${escapeHtml(theme.footerText)}">${escapeHtml(input.footerText)}</p>
                </div>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
