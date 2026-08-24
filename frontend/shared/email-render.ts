/**
 * Shared email renderer — converts EmailTemplate JSON to HTML string.
 * Used by both frontend (preview) and backend (transactional sends).
 * Ported from EmailDesigner.tsx generateHTML — no React dependencies.
 */

export interface EmailComponentType {
  id: string;
  type: string;
  content: { text?: string; url?: string; src?: string; alt?: string };
  styles: Record<string, unknown>;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  preheader: string;
  context?: string;
  components: EmailComponentType[];
  globalStyles: {
    backgroundColor: string;
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    textColor: string;
    linkColor: string;
    containerWidth: number;
  };
}

export interface EmailPreset {
  id: string;
  title: string;
  category: string;
  description: string;
  summary: string;
  tone: string;
  accentColor: string;
  tags: string[];
  preview: string[];
  template: EmailTemplate;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTextAsHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

function buildTextCell(
  innerHtml: string,
  template: EmailTemplate,
  styles: Record<string, unknown>,
  extraSpacingTop = 0,
): string {
  const fontSize = (styles.fontSize as number) || template.globalStyles.fontSize;
  const color = (styles.color as string) || template.globalStyles.textColor;
  const marginBottom = (styles.marginBottom as number) ?? 0;
  const textAlign = (styles.textAlign as string) || 'left';

  return `
    <tr>
      <td
        align="${textAlign}"
        style="
          padding: ${extraSpacingTop}px 32px ${marginBottom}px 32px;
          color: ${color};
          font-family: ${template.globalStyles.fontFamily};
          font-size: ${fontSize}px;
          line-height: ${template.globalStyles.lineHeight};
          text-align: ${textAlign};
        "
      >
        ${innerHtml}
      </td>
    </tr>
  `;
}

function renderComponent(component: EmailComponentType, template: EmailTemplate): string {
  switch (component.type) {
    case 'header':
      return buildTextCell(
        `<h1 style="margin:0;font-size:${(component.styles.fontSize as number) || 30}px;font-weight:${(component.styles.fontWeight as string) || 'bold'};line-height:1.2;">${formatTextAsHtml((component.content.text as string) || 'Overskrift')}</h1>`,
        template,
        component.styles,
      );

    case 'text':
      return buildTextCell(
        `<p style="margin:0;">${formatTextAsHtml((component.content.text as string) || '')}</p>`,
        template,
        component.styles,
      );

    case 'button': {
      const textAlign = (component.styles.textAlign as string) || 'center';
      const buttonLabel = formatTextAsHtml((component.content.text as string) || 'Åpne lenke');
      const buttonUrl = escapeHtml((component.content.url as string) || '#');
      return `
        <tr>
          <td align="${textAlign}" style="padding: 0 32px ${(component.styles.marginBottom as number) || 0}px 32px;">
            <a
              href="${buttonUrl}"
              style="
                display:inline-block;
                background:${(component.styles.backgroundColor as string) || template.globalStyles.linkColor};
                color:${(component.styles.color as string) || '#ffffff'};
                text-decoration:none;
                border-radius:${(component.styles.borderRadius as number) || 999}px;
                padding:${(component.styles.paddingY as number) || 13}px ${(component.styles.paddingX as number) || 28}px;
                font-size:${(component.styles.fontSize as number) || template.globalStyles.fontSize}px;
                font-weight:${(component.styles.fontWeight as string) || 'bold'};
                font-family:${template.globalStyles.fontFamily};
              "
            >
              ${buttonLabel}
            </a>
          </td>
        </tr>
      `;
    }

    case 'image': {
      const width = (component.styles.width as string) || '100%';
      const textAlign = (component.styles.textAlign as string) || 'center';
      return `
        <tr>
          <td align="${textAlign}" style="padding:0 32px ${(component.styles.marginBottom as number) || 0}px 32px;">
            <img
              src="${escapeHtml((component.content.src as string) || '')}"
              alt="${escapeHtml((component.content.alt as string) || '')}"
              style="
                width:${width};
                max-width:100%;
                height:auto;
                border-radius:${(component.styles.borderRadius as number) || 0}px;
                display:inline-block;
                border:0;
              "
            />
          </td>
        </tr>
      `;
    }

    case 'divider':
      return `
        <tr>
          <td style="padding:${(component.styles.marginTop as number) || 0}px 32px ${(component.styles.marginBottom as number) || 0}px 32px;">
            <div style="height:${(component.styles.height as number) || 1}px;background:${(component.styles.color as string) || '#eadfce'};"></div>
          </td>
        </tr>
      `;

    case 'spacer':
      return `
        <tr>
          <td style="padding:0 32px;">
            <div style="height:${(component.styles.height as number) || 24}px;"></div>
          </td>
        </tr>
      `;

    case 'footer':
      return buildTextCell(
        `<p style="margin:0;">${formatTextAsHtml((component.content.text as string) || '')}</p>`,
        template,
        component.styles,
      );

    case 'social': {
      const textAlign = (component.styles.alignment as string) || 'center';
      return `
        <tr>
          <td align="${textAlign}" style="padding:0 32px ${(component.styles.marginBottom as number) || 0}px 32px;">
            <span style="font-family:${template.globalStyles.fontFamily};color:${template.globalStyles.textColor};font-size:13px;">Instagram</span>
            <span style="display:inline-block;width:12px;"></span>
            <span style="font-family:${template.globalStyles.fontFamily};color:${template.globalStyles.textColor};font-size:13px;">LinkedIn</span>
            <span style="display:inline-block;width:12px;"></span>
            <span style="font-family:${template.globalStyles.fontFamily};color:${template.globalStyles.textColor};font-size:13px;">creatorhubn.com</span>
          </td>
        </tr>
      `;
    }

    default:
      return '';
  }
}

/**
 * Replace {{variable}} placeholders in a string.
 */
export function replaceTemplateVariables(
  text: string,
  variables: Record<string, string | number | undefined>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = variables[key];
    return val !== undefined && val !== null ? escapeHtml(String(val)) : `{{${key}}}`;
  });
}

/**
 * Render an EmailTemplate to a full HTML email string.
 */
export function renderTemplateToHtml(template: EmailTemplate): string {
  const componentsHtml = template.components
    .map((component) => renderComponent(component, template))
    .join('\n');

  return `
    <!DOCTYPE html>
    <html lang="nb">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(template.subject)}</title>
      </head>
      <body style="margin:0;padding:0;background:${template.globalStyles.backgroundColor};">
        <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">
          ${escapeHtml(template.preheader)}
        </span>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${template.globalStyles.backgroundColor};margin:0;padding:24px 12px;width:100%;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${template.globalStyles.containerWidth}px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;">
                <tr>
                  <td style="padding:32px 0 12px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${componentsHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

/**
 * Deep-clone a template and replace all {{variables}} in content.text fields.
 */
export function renderPresetWithVariables(
  template: EmailTemplate,
  variables: Record<string, string | number | undefined>,
): EmailTemplate {
  const cloned = JSON.parse(JSON.stringify(template)) as EmailTemplate;

  for (const comp of cloned.components) {
    if (comp.content.text) {
      comp.content.text = replaceTemplateVariables(comp.content.text, variables);
    }
    if (comp.content.url) {
      comp.content.url = replaceTemplateVariables(comp.content.url, variables);
    }
  }

  cloned.subject = replaceTemplateVariables(cloned.subject, variables);
  cloned.preheader = replaceTemplateVariables(cloned.preheader, variables);

  return cloned;
}

/**
 * Render a preset to HTML with variable substitution — the main entry point
 * for backend transactional emails.
 */
export function renderPresetToHtml(
  template: EmailTemplate,
  variables: Record<string, string | number | undefined>,
): { html: string; subject: string; text: string } {
  const resolved = renderPresetWithVariables(template, variables);
  const html = renderTemplateToHtml(resolved);

  const textParts: string[] = [`Emne: ${resolved.subject}`, ''];
  for (const comp of resolved.components) {
    if (comp.type === 'header' || comp.type === 'text' || comp.type === 'footer') {
      if (comp.content.text) textParts.push(comp.content.text);
    } else if (comp.type === 'button') {
      textParts.push(`${comp.content.text || 'Knapp'}: ${comp.content.url || ''}`);
    }
    textParts.push('');
  }

  return { html, subject: resolved.subject, text: textParts.join('\n').trim() };
}
