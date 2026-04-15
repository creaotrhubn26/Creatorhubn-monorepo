// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, isApiEndpointMissing } from '@/lib/queryClient';
import SubjectLineAnalyzer from './SubjectLineAnalyzer';
import EmailContentAnalyzer from './EmailContentAnalyzer';
import EmailSpamChecker from './EmailSpamChecker';
import EmailNorwegianSpellCheck from './EmailNorwegianSpellCheck';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card as MuiCard,
  CardContent,
  CardActions,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  Tooltip,
  Stack,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Palette as PaletteIcon,
  TextFields as TextFieldsIcon,
  Image as ImageIcon,
  Preview as PreviewIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  DragIndicator as DragIcon,
  Settings as SettingsIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  DesktopWindows as DesktopIcon,
  TabletMac as TabletIcon,
  Smartphone as MobileIcon,
  ArticleOutlined as PlainTextIcon,
  AutoAwesome as QualityIcon,
  Restore as RestoreIcon,
  CheckCircleOutline as CheckIcon,
  WarningAmber as WarningIcon,
  ErrorOutline as ErrorIcon,
  ViewQuilt as SectionIcon,
} from '@mui/icons-material';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import type { AdminEmailDesignerPreset } from '../admin/emailDesignerPresets';

type EmailContext = 'showcase' | 'wedding-timeline' | 'general' | 'invitation';
type EmailTextAlign = 'left' | 'center' | 'right';
type CanvasMode = 'builder' | 'preview';
type PreviewViewport = 'desktop' | 'tablet' | 'mobile';
type PreviewContentMode = 'visual' | 'plain';
type NoticeSeverity = 'success' | 'info' | 'warning' | 'error';

type EmailComponentType =
  | 'header'
  | 'text'
  | 'button'
  | 'image'
  | 'divider'
  | 'footer'
  | 'social'
  | 'spacer';

interface EmailComponentContent {
  text?: string;
  url?: string;
  src?: string;
  alt?: string;
}

interface EmailComponentStyles {
  color?: string;
  backgroundColor?: string;
  textAlign?: EmailTextAlign;
  fontWeight?: string | number;
  fontSize?: number;
  borderRadius?: number;
  paddingX?: number;
  paddingY?: number;
  marginBottom?: number;
  marginTop?: number;
  width?: string;
  height?: number;
  alignment?: EmailTextAlign;
}

export interface EmailComponent {
  id: string;
  type: EmailComponentType;
  content: EmailComponentContent;
  styles: EmailComponentStyles;
}

interface GlobalStyles {
  backgroundColor: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  linkColor: string;
  containerWidth: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  preheader: string;
  context?: EmailContext;
  components: EmailComponent[];
  globalStyles: GlobalStyles;
}

interface EmailDesignerProps {
  context?: EmailContext;
  projectId?: string;
  onSave?: (template: EmailTemplate) => void;
  initialTemplate?: EmailTemplate | null;
  presetTemplates?: AdminEmailDesignerPreset[];
  profession?: string;
  userId?: string;
  onMeetingCreate?: (meeting: unknown) => void;
  onProjectUpdate?: (project: unknown) => void;
  onWorklogCreate?: (worklog: unknown) => void;
  selectedProject?: Record<string, any>;
  onProjectSelect?: (project: unknown) => void;
  invitationData?: {
    recipientEmail: string;
    recipientName: string;
    role: string;
    profession: string;
    token?: string;
    testingAreas?: string[];
    experience?: string;
  };
}

interface DraftRecord {
  template: EmailTemplate;
  selectedTemplate?: string;
  savedAt: string;
}

interface DesignerNotice {
  severity: NoticeSeverity;
  message: string;
}

interface TemplateSourceRecord {
  template: EmailTemplate;
  source: 'api' | 'local';
}

interface SectionPreset {
  id: string;
  title: string;
  description: string;
  accentColor: string;
  components: EmailComponent[];
}

interface PreflightCheck {
  severity: 'success' | 'warning' | 'error';
  title: string;
  description: string;
}

const BRAND_LOGO_SRC = '/creatorhub-wordmark-light.png';
const AUTO_SAVE_DELAY_MS = 1500;
const HISTORY_LIMIT = 50;
const LOCAL_TEMPLATE_LIBRARY_KEY = 'creatorhub-email-designer-local-templates';

const defaultGlobalStyles: GlobalStyles = {
  backgroundColor: '#f5f1ea',
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
  fontSize: 15,
  lineHeight: 1.65,
  textColor: '#2a241d',
  linkColor: '#ff8c00',
  containerWidth: 640,
};

const componentTypes: Array<{
  id: EmailComponentType;
  name: string;
  icon: React.ReactNode;
  color: string;
}> = [
  { id: 'header', name: 'Overskrift', icon: <TextFieldsIcon />, color: '#ff8c00' },
  { id: 'text', name: 'Tekst', icon: <TextFieldsIcon />, color: '#2563eb' },
  { id: 'button', name: 'Knapp', icon: <BusinessIcon />, color: '#1f8f4f' },
  { id: 'image', name: 'Bilde', icon: <ImageIcon />, color: '#d97706' },
  { id: 'divider', name: 'Skillestrek', icon: <DragIcon />, color: '#8b5cf6' },
  { id: 'social', name: 'Sosiale', icon: <PhoneIcon />, color: '#db2777' },
  { id: 'spacer', name: 'Avstand', icon: <DragIcon />, color: '#64748b' },
  { id: 'footer', name: 'Bunntekst', icon: <EmailIcon />, color: '#6b4f3b' },
];

function createComponentId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function cloneComponent(component: EmailComponent, nextId?: string): EmailComponent {
  return {
    ...component,
    id: nextId || component.id,
    content: { ...component.content },
    styles: { ...component.styles },
  };
}

function cloneTemplateSnapshot(templateData: EmailTemplate): EmailTemplate {
  return {
    ...templateData,
    components: templateData.components.map((component) => cloneComponent(component)),
    globalStyles: {
      ...defaultGlobalStyles,
      ...templateData.globalStyles,
    },
  };
}

function cloneTemplateForCanvas(
  templateData: EmailTemplate,
  context: EmailContext,
): EmailTemplate {
  const seed = `${Date.now()}-${Math.round(Math.random() * 10000)}`;

  return {
    ...cloneTemplateSnapshot(templateData),
    id: `${templateData.id || 'template'}-${seed}`,
    category: templateData.category || context || 'general',
    context: templateData.context || context,
    components: templateData.components.map((component, index) =>
      cloneComponent(component, `${component.type}-${seed}-${index}`),
    ),
  };
}

function buildDefaultTemplate(
  context: EmailContext,
  activeProjectName?: string,
): EmailTemplate {
  return {
    id: `new-template-${Date.now()}`,
    name: 'Ny E-postmal',
    category: context,
    subject: activeProjectName
      ? `Oppdatering om ${activeProjectName}`
      : 'CreatorHub Norge - Viktig melding',
    preheader: activeProjectName
      ? `Oppfølging for ${activeProjectName}`
      : 'Se de siste oppdateringene fra CreatorHub Norge',
    context,
    components: [],
    globalStyles: defaultGlobalStyles,
  };
}

function getDefaultContent(type: EmailComponentType, activeProjectName?: string): EmailComponentContent {
  switch (type) {
    case 'header':
      return { text: 'Velkommen til CreatorHub' };
    case 'text':
      return {
        text: activeProjectName
          ? `Her er en oppdatert status for ${activeProjectName}.`
          : 'Skriv en tydelig og ryddig tekst som forklarer budskapet.',
      };
    case 'button':
      return { text: 'Åpne CreatorHub', url: 'https://creatorhubn.com' };
    case 'image':
      return { src: BRAND_LOGO_SRC, alt: 'CreatorHub-logo' };
    case 'footer':
      return {
        text: 'CreatorHub | hello@creatorhubn.com | creatorhubn.com',
      };
    default:
      return {};
  }
}

function getDefaultStyles(type: EmailComponentType): EmailComponentStyles {
  switch (type) {
    case 'header':
      return {
        color: '#221d17',
        textAlign: 'center',
        fontSize: 30,
        fontWeight: 'bold',
        marginBottom: 18,
      };
    case 'text':
      return {
        color: '#40372d',
        textAlign: 'left',
        fontSize: 16,
        marginBottom: 16,
      };
    case 'button':
      return {
        backgroundColor: '#ff8c00',
        color: '#ffffff',
        textAlign: 'center',
        borderRadius: 999,
        paddingX: 28,
        paddingY: 13,
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 22,
      };
    case 'image':
      return {
        width: '100%',
        textAlign: 'center',
        borderRadius: 12,
        marginBottom: 18,
      };
    case 'divider':
      return {
        color: '#eadfce',
        height: 1,
        marginTop: 8,
        marginBottom: 22,
      };
    case 'spacer':
      return { height: 28 };
    case 'social':
      return { alignment: 'center', marginBottom: 20 };
    case 'footer':
      return {
        color: '#75685a',
        textAlign: 'center',
        fontSize: 12,
        marginTop: 28,
      };
    default:
      return {};
  }
}

function isEmailComponentType(type: string): type is EmailComponentType {
  return componentTypes.some((componentType) => componentType.id === type);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTextAsHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

function generatePlainText(template: EmailTemplate) {
  const lines: string[] = [
    `Emne: ${template.subject}`,
    `Preheader: ${template.preheader}`,
    '',
  ];

  template.components.forEach((component) => {
    switch (component.type) {
      case 'header':
      case 'text':
      case 'footer':
        if (component.content.text) {
          lines.push(component.content.text);
        }
        break;
      case 'button':
        lines.push(
          `${component.content.text || 'Knapp'}${component.content.url ? `: ${component.content.url}` : ''}`,
        );
        break;
      case 'image':
        lines.push(`[Bilde] ${component.content.alt || 'Mangler alt-tekst'}`);
        break;
      case 'divider':
        lines.push('------------------------------');
        break;
      case 'spacer':
        lines.push('');
        break;
      case 'social':
        lines.push('Følg CreatorHub i sosiale kanaler.');
        break;
      default:
        break;
    }

    lines.push('');
  });

  return lines.join('\n').trim();
}

function buildTextCell(
  innerHtml: string,
  template: EmailTemplate,
  styles: EmailComponentStyles,
  extraSpacingTop = 0,
) {
  const fontSize = styles.fontSize || template.globalStyles.fontSize;
  const color = styles.color || template.globalStyles.textColor;
  const marginBottom = styles.marginBottom ?? 0;
  const textAlign = styles.textAlign || 'left';

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

function generateHTML(template: EmailTemplate) {
  const componentsHtml = template.components
    .map((component) => {
      switch (component.type) {
        case 'header':
          return buildTextCell(
            `<h1 style="margin:0;font-size:${component.styles.fontSize || 30}px;font-weight:${component.styles.fontWeight || 'bold'};line-height:1.2;">${formatTextAsHtml(component.content.text || 'Overskrift')}</h1>`,
            template,
            component.styles,
          );

        case 'text':
          return buildTextCell(
            `<p style="margin:0;">${formatTextAsHtml(component.content.text || '')}</p>`,
            template,
            component.styles,
          );

        case 'button': {
          const textAlign = component.styles.textAlign || 'center';
          const buttonLabel = formatTextAsHtml(component.content.text || 'Åpne lenke');
          const buttonUrl = escapeHtml(component.content.url || '#');
          return `
            <tr>
              <td align="${textAlign}" style="padding: 0 32px ${component.styles.marginBottom || 0}px 32px;">
                <a
                  href="${buttonUrl}"
                  style="
                    display:inline-block;
                    background:${component.styles.backgroundColor || template.globalStyles.linkColor};
                    color:${component.styles.color || '#ffffff'};
                    text-decoration:none;
                    border-radius:${component.styles.borderRadius || 999}px;
                    padding:${component.styles.paddingY || 13}px ${component.styles.paddingX || 28}px;
                    font-size:${component.styles.fontSize || template.globalStyles.fontSize}px;
                    font-weight:${component.styles.fontWeight || 'bold'};
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
          const width = component.styles.width || '100%';
          const textAlign = component.styles.textAlign || 'center';
          return `
            <tr>
              <td align="${textAlign}" style="padding:0 32px ${component.styles.marginBottom || 0}px 32px;">
                <img
                  src="${escapeHtml(component.content.src || '')}"
                  alt="${escapeHtml(component.content.alt || '')}"
                  style="
                    width:${width};
                    max-width:100%;
                    height:auto;
                    border-radius:${component.styles.borderRadius || 0}px;
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
              <td style="padding:${component.styles.marginTop || 0}px 32px ${component.styles.marginBottom || 0}px 32px;">
                <div style="height:${component.styles.height || 1}px;background:${component.styles.color || '#eadfce'};"></div>
              </td>
            </tr>
          `;

        case 'spacer':
          return `
            <tr>
              <td style="padding:0 32px;">
                <div style="height:${component.styles.height || 24}px;"></div>
              </td>
            </tr>
          `;

        case 'footer':
          return buildTextCell(
            `<p style="margin:0;">${formatTextAsHtml(component.content.text || '')}</p>`,
            template,
            component.styles,
          );

        case 'social': {
          const textAlign = component.styles.alignment || 'center';
          return `
            <tr>
              <td align="${textAlign}" style="padding:0 32px ${component.styles.marginBottom || 0}px 32px;">
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
    })
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

function normalizeText(value: string | null | undefined) {
  return (value || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function parseHTMLToComponents(html: string): EmailComponent[] {
  if (!html.trim() || typeof DOMParser === 'undefined') {
    return [];
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const elements = Array.from(doc.body.querySelectorAll('img,h1,h2,h3,p,a,hr'));
  const components: EmailComponent[] = [];

  elements.forEach((element) => {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'img') {
      const src = element.getAttribute('src') || '';
      components.push({
        id: createComponentId('image'),
        type: 'image',
        content: {
          src,
          alt: element.getAttribute('alt') || '',
        },
        styles: {
          ...getDefaultStyles('image'),
          width: element.getAttribute('width') || element.getAttribute('style')?.match(/width:\s*([^;]+)/)?.[1] || '100%',
        },
      });
      return;
    }

    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
      const fontSize = tagName === 'h1' ? 30 : tagName === 'h2' ? 24 : 20;
      components.push({
        id: createComponentId('header'),
        type: 'header',
        content: { text: normalizeText(element.textContent) },
        styles: {
          ...getDefaultStyles('header'),
          fontSize,
        },
      });
      return;
    }

    if (tagName === 'p') {
      const text = normalizeText(element.textContent);
      if (!text) {
        return;
      }

      components.push({
        id: createComponentId('text'),
        type: 'text',
        content: { text },
        styles: getDefaultStyles('text'),
      });
      return;
    }

    if (tagName === 'a') {
      const text = normalizeText(element.textContent);
      const href = element.getAttribute('href') || '';
      if (!text && !href) {
        return;
      }

      components.push({
        id: createComponentId('button'),
        type: 'button',
        content: {
          text: text || 'Åpne lenke',
          url: href,
        },
        styles: getDefaultStyles('button'),
      });
      return;
    }

    if (tagName === 'hr') {
      components.push({
        id: createComponentId('divider'),
        type: 'divider',
        content: {},
        styles: getDefaultStyles('divider'),
      });
    }
  });

  if (components.length === 0) {
    const plainText = normalizeText(doc.body.textContent);
    if (plainText) {
      components.push({
        id: createComponentId('text'),
        type: 'text',
        content: { text: plainText },
        styles: getDefaultStyles('text'),
      });
    }
  }

  return components;
}

function tryParseJson(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function normalizeComponentRecord(record: any, fallbackIndex: number): EmailComponent {
  const type = isEmailComponentType(record?.type) ? record.type : 'text';
  return {
    id: typeof record?.id === 'string' ? record.id : `${type}-${fallbackIndex}`,
    type,
    content:
      record?.content && typeof record.content === 'object' && !Array.isArray(record.content)
        ? { ...record.content }
        : getDefaultContent(type),
    styles:
      record?.styles && typeof record.styles === 'object' && !Array.isArray(record.styles)
        ? { ...getDefaultStyles(type), ...record.styles }
        : getDefaultStyles(type),
  };
}

function normalizeTemplateRecord(record: any, context: EmailContext): EmailTemplate {
  const parsedTemplate = tryParseJson(record?.template);
  const source =
    parsedTemplate && typeof parsedTemplate === 'object' && !Array.isArray(parsedTemplate)
      ? {
          ...(parsedTemplate as Record<string, unknown>),
          id: record?.id || (parsedTemplate as { id?: string }).id,
          name: record?.name || (parsedTemplate as { name?: string }).name,
          subject: record?.subject || (parsedTemplate as { subject?: string }).subject,
          preheader: record?.preheader || (parsedTemplate as { preheader?: string }).preheader,
          category:
            record?.template_type ||
            record?.category ||
            (parsedTemplate as { category?: string }).category,
          globalStyles:
            tryParseJson(record?.globalStyles) ||
            tryParseJson(record?.global_styles) ||
            (parsedTemplate as { globalStyles?: GlobalStyles }).globalStyles,
          components:
            tryParseJson(record?.components) ||
            (parsedTemplate as { components?: EmailComponent[] }).components,
          html_content:
            record?.html_content ||
            record?.html ||
            (parsedTemplate as { html_content?: string }).html_content,
        }
      : record || {};

  const components = Array.isArray(source.components)
    ? source.components.map((component, index) => normalizeComponentRecord(component, index))
    : parseHTMLToComponents(
        typeof source.html_content === 'string' ? source.html_content : '',
      );

  return {
    id:
      typeof source.id === 'string' && source.id.trim().length > 0
        ? source.id
        : createComponentId('template'),
    name:
      typeof source.name === 'string' && source.name.trim().length > 0
        ? source.name
        : 'Lastet mal',
    category:
      typeof source.category === 'string' && source.category.trim().length > 0
        ? source.category
        : context,
    subject:
      typeof source.subject === 'string' && source.subject.trim().length > 0
        ? source.subject
        : 'Emnelinje',
    preheader:
      typeof source.preheader === 'string' && source.preheader.trim().length > 0
        ? source.preheader
        : 'Preheader',
    context,
    components,
    globalStyles: {
      ...defaultGlobalStyles,
      ...(source.globalStyles && typeof source.globalStyles === 'object'
        ? (source.globalStyles as Partial<GlobalStyles>)
        : {}),
    },
  };
}

function extractTemplatesFromResponse(response: any, context: EmailContext): EmailTemplate[] {
  const records = Array.isArray(response)
    ? response
    : Array.isArray(response?.templates)
      ? response.templates
      : Array.isArray(response?.data)
        ? response.data
        : [];

  return records.map((record, index) =>
    normalizeTemplateRecord(record || { id: `template-${index}` }, context),
  );
}

function readLocalTemplateLibrary(context: EmailContext): TemplateSourceRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(LOCAL_TEMPLATE_LIBRARY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    const records = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { templates?: unknown[] }).templates)
        ? (parsed as { templates: unknown[] }).templates
        : [];

    return records.map((record) => ({
      source: 'local' as const,
      template: normalizeTemplateRecord(record, context),
    }));
  } catch {
    return [];
  }
}

function upsertLocalTemplate(template: EmailTemplate, context: EmailContext): TemplateSourceRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const nextTemplate = cloneTemplateSnapshot(template);
  const current = readLocalTemplateLibrary(context).map((record) => record.template);
  const nextList = [
    nextTemplate,
    ...current.filter((record) => record.id !== nextTemplate.id),
  ].slice(0, 20);

  localStorage.setItem(LOCAL_TEMPLATE_LIBRARY_KEY, JSON.stringify(nextList));

  return nextList.map((record) => ({
    source: 'local' as const,
    template: record,
  }));
}

function removeDraftRecord(storageKey: string) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(storageKey);
}

function readDraftRecord(storageKey: string, context: EmailContext): DraftRecord | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as DraftRecord;
    if (!parsed?.template) {
      return null;
    }

    return {
      ...parsed,
      template: normalizeTemplateRecord(parsed.template, context),
    };
  } catch {
    return null;
  }
}

function getDraftStorageKey(
  context: EmailContext,
  userId?: string,
  projectId?: string,
) {
  return `creatorhub-email-designer-draft:${context}:${userId || 'anonymous'}:${projectId || 'general'}`;
}

function replaceTextValue(value: string | undefined, original: string, suggestion: string) {
  if (!value || !original) {
    return value;
  }

  return value.split(original).join(suggestion);
}

function getJustifyContent(alignment: EmailTextAlign = 'center') {
  if (alignment === 'left') {
    return 'flex-start';
  }

  if (alignment === 'right') {
    return 'flex-end';
  }

  return 'center';
}

function getPreviewWidth(mode: PreviewViewport, containerWidth: number) {
  switch (mode) {
    case 'mobile':
      return 390;
    case 'tablet':
      return 768;
    case 'desktop':
    default:
      return Math.max(containerWidth, 640);
  }
}

function renderEmailComponent(component: EmailComponent, template: EmailTemplate) {
  switch (component.type) {
    case 'header':
      return (
        <Typography
          variant="h4"
          sx={{
            color: component.styles.color || template.globalStyles.textColor,
            textAlign: component.styles.textAlign || 'left',
            fontWeight: component.styles.fontWeight || 'bold',
            fontSize: component.styles.fontSize || 30,
            mb: `${component.styles.marginBottom || 16}px`,
            lineHeight: 1.2,
            whiteSpace: 'pre-line',
          }}
        >
          {component.content.text || 'Overskrift'}
        </Typography>
      );

    case 'text':
      return (
        <Typography
          variant="body1"
          sx={{
            color: component.styles.color || template.globalStyles.textColor,
            textAlign: component.styles.textAlign || 'left',
            fontSize: component.styles.fontSize || template.globalStyles.fontSize,
            mb: `${component.styles.marginBottom || 16}px`,
            lineHeight: template.globalStyles.lineHeight,
            whiteSpace: 'pre-line',
          }}
        >
          {component.content.text || 'Tekstblokk'}
        </Typography>
      );

    case 'button':
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: getJustifyContent(component.styles.textAlign),
            mb: `${component.styles.marginBottom || 16}px`,
          }}
        >
          <Button
            variant="contained"
            sx={{
              backgroundColor: component.styles.backgroundColor || template.globalStyles.linkColor,
              color: component.styles.color || '#ffffff',
              borderRadius: `${component.styles.borderRadius || 999}px`,
              px: `${component.styles.paddingX || 28}px`,
              py: `${component.styles.paddingY || 13}px`,
              fontSize: component.styles.fontSize || template.globalStyles.fontSize,
              fontWeight: component.styles.fontWeight || 'bold',
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                backgroundColor:
                  component.styles.backgroundColor || template.globalStyles.linkColor,
                boxShadow: 'none',
              },
            }}
          >
            {component.content.text || 'Klikk her'}
          </Button>
        </Box>
      );

    case 'image':
      return (
        <Box
          sx={{
            textAlign: component.styles.textAlign || 'center',
            mb: `${component.styles.marginBottom || 16}px`,
          }}
        >
          <Box
            component="img"
            src={component.content.src || BRAND_LOGO_SRC}
            alt={component.content.alt || 'Bilde'}
            sx={{
              width: component.styles.width || '100%',
              maxWidth: '100%',
              borderRadius: `${component.styles.borderRadius || 0}px`,
              display: 'inline-block',
            }}
          />
        </Box>
      );

    case 'divider':
      return (
        <Divider
          sx={{
            backgroundColor: component.styles.color || '#eadfce',
            height: `${component.styles.height || 1}px`,
            my: `${component.styles.marginBottom || 16}px`,
          }}
        />
      );

    case 'spacer':
      return <Box sx={{ height: `${component.styles.height || 24}px` }} />;

    case 'social':
      return (
        <Stack
          direction="row"
          spacing={1}
          justifyContent={getJustifyContent(component.styles.alignment || 'center')}
          sx={{ mb: `${component.styles.marginBottom || 16}px` }}
        >
          <Chip size="small" label="Instagram" />
          <Chip size="small" label="LinkedIn" />
          <Chip size="small" label="creatorhubn.com" />
        </Stack>
      );

    case 'footer':
      return (
        <Typography
          variant="caption"
          sx={{
            color: component.styles.color || '#75685a',
            textAlign: component.styles.textAlign || 'center',
            fontSize: component.styles.fontSize || 12,
            mt: `${component.styles.marginTop || 24}px`,
            display: 'block',
            lineHeight: 1.7,
            whiteSpace: 'pre-line',
          }}
        >
          {component.content.text || 'CreatorHub | hello@creatorhubn.com'}
        </Typography>
      );

    default:
      return null;
  }
}

function buildSectionPresets(activeProjectName?: string): SectionPreset[] {
  const projectLabel = activeProjectName || 'prosjektet ditt';

  return [
    {
      id: 'brand-intro',
      title: 'Logo og intro',
      description: 'En trygg åpning med CreatorHub-logo og tydelig velkomst.',
      accentColor: '#ff8c00',
      components: [
        {
          id: createComponentId('section-image'),
          type: 'image',
          content: {
            src: BRAND_LOGO_SRC,
            alt: 'CreatorHub-logo',
          },
          styles: {
            width: '148px',
            textAlign: 'center',
            marginBottom: 20,
          },
        },
        {
          id: createComponentId('section-header'),
          type: 'header',
          content: { text: 'Hei fra CreatorHub' },
          styles: getDefaultStyles('header'),
        },
        {
          id: createComponentId('section-text'),
          type: 'text',
          content: {
            text: 'Bruk denne seksjonen til å skape en trygg og profesjonell start på meldingen.',
          },
          styles: {
            ...getDefaultStyles('text'),
            textAlign: 'center',
          },
        },
      ],
    },
    {
      id: 'cta-hero',
      title: 'Hero med CTA',
      description: 'Tydelig handling for godkjenning, oppstart eller oppfølging.',
      accentColor: '#2563eb',
      components: [
        {
          id: createComponentId('section-header'),
          type: 'header',
          content: { text: `Neste steg for ${projectLabel}` },
          styles: {
            ...getDefaultStyles('header'),
            textAlign: 'left',
            color: '#1f2937',
          },
        },
        {
          id: createComponentId('section-text'),
          type: 'text',
          content: {
            text: 'Forklar hva brukeren skal gjøre videre, hvorfor det er viktig, og hva som skjer etterpå.',
          },
          styles: getDefaultStyles('text'),
        },
        {
          id: createComponentId('section-button'),
          type: 'button',
          content: {
            text: 'Åpne CreatorHub',
            url: '{{dashboardUrl}}',
          },
          styles: {
            ...getDefaultStyles('button'),
            backgroundColor: '#2563eb',
          },
        },
      ],
    },
    {
      id: 'status-block',
      title: 'Status og oppsummering',
      description: 'Brukes når admin vil gi en kort og presis statusoppdatering.',
      accentColor: '#0f766e',
      components: [
        {
          id: createComponentId('section-divider'),
          type: 'divider',
          content: {},
          styles: {
            ...getDefaultStyles('divider'),
            color: '#cde8e4',
          },
        },
        {
          id: createComponentId('section-text'),
          type: 'text',
          content: {
            text: 'Status:\n• Tilgang er oppdatert\n• Innhold er klart\n• Neste steg er sendt til brukeren',
          },
          styles: {
            ...getDefaultStyles('text'),
            color: '#12423e',
          },
        },
      ],
    },
    {
      id: 'follow-up',
      title: 'Oppfølging',
      description: 'Passer for påminnelser, manglende respons og videre dialog.',
      accentColor: '#7c3aed',
      components: [
        {
          id: createComponentId('section-header'),
          type: 'header',
          content: { text: 'Vi følger opp dette med deg' },
          styles: {
            ...getDefaultStyles('header'),
            fontSize: 24,
            textAlign: 'left',
            color: '#4c1d95',
          },
        },
        {
          id: createComponentId('section-text'),
          type: 'text',
          content: {
            text: 'Hold oppfølgingsspråket kort, tydelig og operativt. Legg gjerne inn frist eller forventet neste handling.',
          },
          styles: getDefaultStyles('text'),
        },
      ],
    },
    {
      id: 'footer-pack',
      title: 'Bunntekst',
      description: 'Legger inn en ryddig avslutning med kontaktinformasjon.',
      accentColor: '#6b4f3b',
      components: [
        {
          id: createComponentId('section-divider'),
          type: 'divider',
          content: {},
          styles: getDefaultStyles('divider'),
        },
        {
          id: createComponentId('section-footer'),
          type: 'footer',
          content: {
            text: 'CreatorHub | hello@creatorhubn.com | creatorhubn.com\nHvis dette er markedsføring, legg inn avmeldingslenke her.',
          },
          styles: getDefaultStyles('footer'),
        },
      ],
    },
  ];
}

const SortableComponent: React.FC<{
  component: EmailComponent;
  template: EmailTemplate;
  onEdit: (component: EmailComponent) => void;
  onDelete: (id: string) => void;
}> = ({ component, template, onEdit, onDelete }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        mb: 2,
        position: 'relative',
        border: '1px solid rgba(34, 29, 23, 0.08)',
        borderRadius: 3,
        background:
          'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(250,247,242,1) 100%)',
        '&:hover': {
          borderColor: '#ffb04a',
          boxShadow: '0 16px 40px rgba(34, 29, 23, 0.08)',
        },
        '&:hover .component-actions': {
          opacity: 1,
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: '#7a6d5f',
        }}
      >
        <DragIcon fontSize="small" />
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {componentTypes.find((type) => type.id === component.type)?.name}
        </Typography>
      </Box>

      <Box sx={{ pt: 3.5 }}>{renderEmailComponent(component, template)}</Box>

      <Stack
        direction="row"
        spacing={0.5}
        className="component-actions"
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          opacity: 0,
          transition: 'opacity 0.2s ease',
        }}
      >
        <IconButton size="small" onClick={() => onEdit(component)}>
          <SettingsIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => onDelete(component.id)} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
};

export const EmailDesigner: React.FC<EmailDesignerProps> = ({
  context = 'general',
  projectId,
  onSave,
  initialTemplate,
  presetTemplates = [],
  profession,
  userId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect,
  invitationData,
}) => {
  const queryClient = useQueryClient();
  const theming = useTheming(profession || 'photographer');
  const activeProjectId = selectedProject?.id || projectId || '';
  const activeProjectName =
    selectedProject?.name ||
    selectedProject?.title ||
    (activeProjectId ? `Prosjekt ${activeProjectId}` : '');
  const activeProfessionLabel = profession || context;
  const draftStorageKey = getDraftStorageKey(context, userId, activeProjectId);

  const [template, setTemplate] = useState<EmailTemplate>(() =>
    buildDefaultTemplate(context, activeProjectName),
  );
  const [selectedComponent, setSelectedComponent] = useState<EmailComponent | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('builder');
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>('desktop');
  const [previewContentMode, setPreviewContentMode] =
    useState<PreviewContentMode>('visual');
  const [editDialog, setEditDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [notice, setNotice] = useState<DesignerNotice | null>(null);
  const [draftRecord, setDraftRecord] = useState<DraftRecord | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [lastManualSavedAt, setLastManualSavedAt] = useState<string | null>(null);
  const [localTemplates, setLocalTemplates] = useState<TemplateSourceRecord[]>(() =>
    readLocalTemplateLibrary(context),
  );
  const [historyState, setHistoryState] = useState<{
    items: EmailTemplate[];
    index: number;
  }>({
    items: [],
    index: -1,
  });

  const historyRef = useRef<EmailTemplate[]>([]);
  const historyIndexRef = useRef(-1);
  const suspendHistoryRef = useRef(false);
  const autosaveReadyRef = useRef(false);

  const currentTemplateKey = selectedTemplate || template.id;
  const hasFooterComponent = template.components.some((component) => component.type === 'footer');
  const usesBrandAccent = template.globalStyles.linkColor === theming.colors.primary;
  const hasBrandLogo = template.components.some((component) =>
    component.type === 'image' &&
    `${component.content.alt || ''} ${component.content.src || ''}`.toLowerCase().includes('creatorhub'),
  );
  const sectionPresets = buildSectionPresets(activeProjectName);
  const plainTextPreview = generatePlainText(template);
  const previewWidth = getPreviewWidth(previewViewport, template.globalStyles.containerWidth);
  const generatedHtml = generateHTML(template);

  const preflightChecks: PreflightCheck[] = [];
  if (!template.subject.trim()) {
    preflightChecks.push({
      severity: 'error',
      title: 'Mangler emnelinje',
      description: 'E-posten bør ha en tydelig emnelinje før du lagrer eller sender test.',
    });
  } else if (template.subject.trim().length < 30) {
    preflightChecks.push({
      severity: 'warning',
      title: 'Kort emnelinje',
      description: 'Emnelinjen er kort. Prøv å ligge mellom 40 og 60 tegn for bedre tydelighet.',
    });
  } else {
    preflightChecks.push({
      severity: 'success',
      title: 'Emnelinje ser bra ut',
      description: 'Lengden er innenfor et godt område for tydelig kommunikasjon.',
    });
  }

  if (!template.preheader.trim()) {
    preflightChecks.push({
      severity: 'warning',
      title: 'Mangler preheader',
      description: 'Preheaderen styrer hvordan e-posten ser ut i innboksen og bør fylles ut.',
    });
  }

  if (template.components.length === 0) {
    preflightChecks.push({
      severity: 'error',
      title: 'Tomt innhold',
      description: 'Legg inn minst én seksjon eller komponent før du lagrer malen.',
    });
  }

  const imagesWithoutAlt = template.components.filter(
    (component) => component.type === 'image' && !component.content.alt?.trim(),
  ).length;
  if (imagesWithoutAlt > 0) {
    preflightChecks.push({
      severity: 'warning',
      title: 'Bilder mangler alt-tekst',
      description: `${imagesWithoutAlt} bilde(r) mangler alt-tekst. Dette påvirker tilgjengelighet og kvalitet.`,
    });
  }

  const buttonsWithoutUrl = template.components.filter(
    (component) => component.type === 'button' && !component.content.url?.trim(),
  ).length;
  if (buttonsWithoutUrl > 0) {
    preflightChecks.push({
      severity: 'error',
      title: 'Knapp uten lenke',
      description: `${buttonsWithoutUrl} knapp(er) mangler URL. Admin bør legge inn mål før bruk.`,
    });
  }

  if (!hasFooterComponent) {
    preflightChecks.push({
      severity: 'warning',
      title: 'Mangler bunntekst',
      description: 'Legg gjerne inn kontaktinfo eller avsender i bunnen for en mer profesjonell avslutning.',
    });
  }

  if (!hasBrandLogo) {
    preflightChecks.push({
      severity: 'warning',
      title: 'Ingen CreatorHub-logo',
      description: 'Legg inn logo i toppen hvis malen skal være tydelig brandet.',
    });
  }

  const errorCount = preflightChecks.filter((check) => check.severity === 'error').length;
  const warningCount = preflightChecks.filter((check) => check.severity === 'warning').length;
  const qualityScore = Math.max(0, 100 - errorCount * 22 - warningCount * 10);
  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.items.length - 1;

  function showNotice(nextNotice: DesignerNotice) {
    setNotice(nextNotice);
  }

  function syncHistory(nextItems: EmailTemplate[], nextIndex: number) {
    historyRef.current = nextItems;
    historyIndexRef.current = nextIndex;
    setHistoryState({
      items: nextItems,
      index: nextIndex,
    });
  }

  function applyTemplateToCanvas(nextTemplate: EmailTemplate, templateKey?: string) {
    suspendHistoryRef.current = true;
    setTemplate(cloneTemplateForCanvas(nextTemplate, context));
    setSelectedTemplate(templateKey || nextTemplate.id || nextTemplate.name || '');
    setSelectedComponent(null);
    setEditDialog(false);
    setCanvasMode('builder');
    setPreviewContentMode('visual');
    setActiveTab(0);
  }

  function insertSection(section: SectionPreset) {
    setTemplate((prev) => ({
      ...prev,
      components: [...prev.components, ...section.components.map((component) => cloneComponent(component, createComponentId(component.type)))],
    }));
    setCanvasMode('builder');
    showNotice({
      severity: 'success',
      message: `${section.title} er lagt til i malen.`,
    });
  }

  function addComponent(type: string) {
    if (!isEmailComponentType(type)) {
      return;
    }

    setTemplate((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        {
          id: createComponentId(type),
          type,
          content: getDefaultContent(type, activeProjectName),
          styles: getDefaultStyles(type),
        },
      ],
    }));
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination || result.destination.index === result.source.index) {
      return;
    }

    setTemplate((prev) => {
      const components = [...prev.components];
      const [movedComponent] = components.splice(result.source.index, 1);

      if (!movedComponent) {
        return prev;
      }

      components.splice(result.destination.index, 0, movedComponent);

      return {
        ...prev,
        components,
      };
    });
  }

  function editComponent(component: EmailComponent) {
    setSelectedComponent(cloneComponent(component));
    setEditDialog(true);
  }

  function updateComponent(updatedComponent: EmailComponent) {
    setTemplate((prev) => ({
      ...prev,
      components: prev.components.map((component) =>
        component.id === updatedComponent.id ? cloneComponent(updatedComponent) : component,
      ),
    }));
    setSelectedComponent(null);
    setEditDialog(false);
  }

  function deleteComponent(id: string) {
    setTemplate((prev) => ({
      ...prev,
      components: prev.components.filter((component) => component.id !== id),
    }));
  }

  function resetTemplate() {
    suspendHistoryRef.current = true;
    setTemplate(buildDefaultTemplate(context, activeProjectName));
    setSelectedTemplate('');
    setSelectedComponent(null);
    setEditDialog(false);
    setCanvasMode('builder');
    showNotice({
      severity: 'info',
      message: 'Designeren er nullstilt til en ny tom mal.',
    });
  }

  async function copyTemplateHtml() {
    try {
      await navigator.clipboard.writeText(generatedHtml);
      showNotice({
        severity: 'success',
        message: 'HTML er kopiert til utklippstavlen.',
      });
    } catch {
      showNotice({
        severity: 'error',
        message: 'Kunne ikke kopiere HTML automatisk.',
      });
    }
  }

  function duplicateCurrentTemplate() {
    suspendHistoryRef.current = true;
    setTemplate((prev) => ({
      ...cloneTemplateSnapshot(prev),
      id: `template-copy-${Date.now()}`,
      name: `${prev.name} kopi`,
    }));
    setSelectedTemplate('');
    showNotice({
      severity: 'success',
      message: 'Malen er duplisert.',
    });
  }

  function syncProjectContext() {
    if (!onProjectSelect) {
      return;
    }

    if (selectedProject) {
      onProjectSelect(selectedProject);
      return;
    }

    if (activeProjectId) {
      onProjectSelect({
        id: activeProjectId,
        name: activeProjectName || template.name,
        profession: activeProfessionLabel,
      });
    }
  }

  function createMeetingFromTemplate() {
    if (!onMeetingCreate) {
      return;
    }

    onMeetingCreate({
      title: `Oppfølging: ${template.subject}`,
      description: template.preheader || `Gjennomgang av e-postmalen "${template.name}".`,
      projectId: activeProjectId || undefined,
      projectContext: selectedProject || undefined,
      recipient: testRecipient.trim() || undefined,
      source: 'email-designer',
    });
  }

  function toggleFooterComponent(checked: boolean) {
    setTemplate((prev) => {
      if (checked && !prev.components.some((component) => component.type === 'footer')) {
        return {
          ...prev,
          components: [
            ...prev.components,
            {
              id: createComponentId('footer'),
              type: 'footer',
              content: {
                text: activeProjectName
                  ? `${activeProjectName} | CreatorHub | hello@creatorhubn.com`
                  : 'CreatorHub | hello@creatorhubn.com | creatorhubn.com',
              },
              styles: getDefaultStyles('footer'),
            },
          ],
        };
      }

      if (!checked) {
        return {
          ...prev,
          components: prev.components.filter((component) => component.type !== 'footer'),
        };
      }

      return prev;
    });
  }

  function toggleBrandAccent(checked: boolean) {
    setTemplate((prev) => ({
      ...prev,
      globalStyles: {
        ...prev.globalStyles,
        backgroundColor: checked ? '#fff8ef' : defaultGlobalStyles.backgroundColor,
        linkColor: checked ? theming.colors.primary : defaultGlobalStyles.linkColor,
      },
    }));
  }

  function restoreDraft() {
    if (!draftRecord) {
      return;
    }

    applyTemplateToCanvas(draftRecord.template, draftRecord.selectedTemplate);
    showNotice({
      severity: 'success',
      message: 'Lokalt utkast er gjenopprettet.',
    });
  }

  function discardDraft() {
    removeDraftRecord(draftStorageKey);
    setDraftRecord(null);
    showNotice({
      severity: 'info',
      message: 'Lokalt utkast er fjernet.',
    });
  }

  function applySpellSuggestion(original: string, suggestion: string) {
    setTemplate((prev) => ({
      ...prev,
      subject: replaceTextValue(prev.subject, original, suggestion) || prev.subject,
      preheader: replaceTextValue(prev.preheader, original, suggestion) || prev.preheader,
      components: prev.components.map((component) =>
        component.content.text
          ? {
              ...component,
              content: {
                ...component.content,
                text:
                  replaceTextValue(component.content.text, original, suggestion) ||
                  component.content.text,
              },
            }
          : component,
      ),
    }));
    showNotice({
      severity: 'success',
      message: `Forslaget "${suggestion}" er brukt i malen.`,
    });
  }

  function loadLibraryTemplate(record: TemplateSourceRecord) {
    applyTemplateToCanvas(record.template, record.template.id);
    showNotice({
      severity: 'success',
      message: `${record.template.name} er lastet inn.`,
    });
  }

  function undoHistory() {
    if (!canUndo) {
      return;
    }

    const nextIndex = historyIndexRef.current - 1;
    const snapshot = historyRef.current[nextIndex];
    if (!snapshot) {
      return;
    }

    suspendHistoryRef.current = true;
    setTemplate(cloneTemplateSnapshot(snapshot));
    setSelectedComponent(null);
    setEditDialog(false);
    syncHistory(historyRef.current, nextIndex);
  }

  function redoHistory() {
    if (!canRedo) {
      return;
    }

    const nextIndex = historyIndexRef.current + 1;
    const snapshot = historyRef.current[nextIndex];
    if (!snapshot) {
      return;
    }

    suspendHistoryRef.current = true;
    setTemplate(cloneTemplateSnapshot(snapshot));
    setSelectedComponent(null);
    setEditDialog(false);
    syncHistory(historyRef.current, nextIndex);
  }

  async function requestTemplatesFromApi() {
    const primary = '/api/email/templates';
    const fallback = '/api/email-templates';

    try {
      const response = await apiRequest(primary);
      return extractTemplatesFromResponse(response, context);
    } catch (error) {
      if (!isApiEndpointMissing(error)) {
        throw error;
      }

      try {
        const response = await apiRequest(fallback);
        return extractTemplatesFromResponse(response, context);
      } catch (fallbackError) {
        if (isApiEndpointMissing(fallbackError)) {
          return [];
        }

        throw fallbackError;
      }
    }
  }

  async function saveTemplateToApi(templateData: EmailTemplate) {
    const payload = {
      ...templateData,
      template_type: templateData.category,
      html_content: generateHTML(templateData),
      html: generateHTML(templateData),
      body: generatePlainText(templateData),
      template: templateData,
    };

    try {
      const response = await apiRequest('/api/email/templates', {
        method: 'POST',
        body: payload,
      });
      return normalizeTemplateRecord(response, context);
    } catch (error) {
      if (!isApiEndpointMissing(error)) {
        throw error;
      }

      const response = await apiRequest('/api/email-templates', {
        method: 'POST',
        body: payload,
      });

      return normalizeTemplateRecord(response, context);
    }
  }

  const templatesQuery = useQuery({
    queryKey: ['/api/email/templates', context],
    staleTime: 5 * 60 * 1000,
    queryFn: requestTemplatesFromApi,
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: EmailTemplate) => {
      const localRecords = upsertLocalTemplate(templateData, context);

      try {
        const remoteTemplate = await saveTemplateToApi(templateData);
        return {
          savedTemplate: remoteTemplate,
          localRecords,
          source: 'api' as const,
        };
      } catch (error) {
        if (isApiEndpointMissing(error)) {
          return {
            savedTemplate: cloneTemplateSnapshot(templateData),
            localRecords,
            source: 'local' as const,
          };
        }

        throw error;
      }
    },
    onSuccess: ({ savedTemplate, localRecords, source }) => {
      setLocalTemplates(localRecords);
      queryClient.invalidateQueries({ queryKey: ['/api/email/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      setSelectedTemplate(savedTemplate.id || template.id);
      setLastManualSavedAt(new Date().toISOString());
      onSave?.(template);

      if (activeProjectId && onProjectUpdate) {
        onProjectUpdate({
          ...(selectedProject || {}),
          id: activeProjectId,
          emailTemplateId: savedTemplate.id || template.id,
          emailTemplateName: template.name,
          emailTemplateSubject: template.subject,
          emailTemplateContext: context,
          updatedAt: new Date().toISOString(),
        });
      }

      onWorklogCreate?.({
        title: `E-postmal lagret: ${template.name}`,
        description: `Lagret e-postmalen "${template.name}"${activeProjectName ? ` for ${activeProjectName}` : ''}.`,
        category: 'email',
        timeSpent: 15,
        projectId: activeProjectId || undefined,
        userId,
        source: 'email-designer',
      });

      showNotice({
        severity: source === 'api' ? 'success' : 'warning',
        message:
          source === 'api'
            ? 'Malen er lagret og lagt i malbiblioteket.'
            : 'API manglet. Malen er lagret lokalt i denne nettleseren.',
      });
    },
    onError: () => {
      showNotice({
        severity: 'error',
        message: 'Kunne ikke lagre malen.',
      });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const recipient = testRecipient.trim();
      if (!recipient) {
        throw new Error('Legg inn en testmottaker før du sender.');
      }

      return apiRequest('/api/emails/send', {
        method: 'POST',
        body: {
          conversationId: activeProjectId || `email-designer-${userId || 'general'}`,
          to: recipient,
          subject: `[Test] ${template.subject}`,
          message: generatedHtml,
          content: generatedHtml,
        },
      });
    },
    onSuccess: () => {
      onWorklogCreate?.({
        title: `Test-e-post sendt: ${template.name}`,
        description: `Sendte en test-e-post til ${testRecipient.trim()} fra malen "${template.name}".`,
        category: 'email',
        timeSpent: 5,
        projectId: activeProjectId || undefined,
        userId,
        source: 'email-designer',
      });

      showNotice({
        severity: 'success',
        message: `Test-e-post er sendt til ${testRecipient.trim()}.`,
      });
    },
    onError: (error) => {
      showNotice({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Kunne ikke sende test-e-post.',
      });
    },
  });

  const remoteTemplates = (templatesQuery.data || []).map((templateRecord) => ({
    source: 'api' as const,
    template: templateRecord,
  }));

  const allTemplates = [
    ...localTemplates,
    ...remoteTemplates.filter(
      (remoteRecord) =>
        !localTemplates.some((localRecord) => localRecord.template.id === remoteRecord.template.id),
    ),
  ];

  useEffect(() => {
    setLocalTemplates(readLocalTemplateLibrary(context));
  }, [context]);

  useEffect(() => {
    const draft = readDraftRecord(draftStorageKey, context);
    setDraftRecord(draft);
  }, [context, draftStorageKey]);

  useEffect(() => {
    const nextRecipient =
      invitationData?.recipientEmail ||
      selectedProject?.clientEmail ||
      selectedProject?.email ||
      '';

    setTestRecipient((prev) => (prev.trim().length > 0 ? prev : nextRecipient));
  }, [invitationData?.recipientEmail, selectedProject?.clientEmail, selectedProject?.email]);

  useEffect(() => {
    if (!initialTemplate) {
      return;
    }

    applyTemplateToCanvas(initialTemplate, initialTemplate.id || initialTemplate.name || '');
  }, [context, initialTemplate]);

  useEffect(() => {
    if (context !== 'invitation' || !invitationData) {
      return;
    }

    const registrationUrl = invitationData.token
      ? `https://creatorhubn.com/register?invitation=${invitationData.token}`
      : `https://creatorhubn.com/register?email=${invitationData.recipientEmail}`;

    const invitationTemplate: EmailTemplate = {
      id: 'prototype-tester-invitation',
      name: `Invitasjon - ${invitationData.recipientName}`,
      category: 'invitation',
      subject: `Velkommen til CreatorHub - prototype ${invitationData.profession}`,
      preheader: `Du er godkjent til å teste ${invitationData.profession}`,
      context: 'invitation',
      components: [
        {
          id: createComponentId('image'),
          type: 'image',
          content: { src: BRAND_LOGO_SRC, alt: 'CreatorHub-logo' },
          styles: {
            ...getDefaultStyles('image'),
            width: '148px',
          },
        },
        {
          id: createComponentId('header'),
          type: 'header',
          content: { text: `Velkommen, ${invitationData.recipientName}` },
          styles: getDefaultStyles('header'),
        },
        {
          id: createComponentId('text'),
          type: 'text',
          content: {
            text: `Du er godkjent som prototype-tester for ${invitationData.profession}.\n\nTestingområder: ${invitationData.testingAreas?.join(', ') || 'Alle relevante flater'}\nErfaring: ${invitationData.experience || 'Ikke oppgitt'}`,
          },
          styles: {
            ...getDefaultStyles('text'),
            textAlign: 'center',
          },
        },
        {
          id: createComponentId('button'),
          type: 'button',
          content: { text: 'Opprett konto', url: registrationUrl },
          styles: getDefaultStyles('button'),
        },
        {
          id: createComponentId('footer'),
          type: 'footer',
          content: { text: 'CreatorHub Testing Team | hello@creatorhubn.com' },
          styles: getDefaultStyles('footer'),
        },
      ],
      globalStyles: defaultGlobalStyles,
    };

    applyTemplateToCanvas(invitationTemplate, invitationTemplate.id);
  }, [context, invitationData]);

  useEffect(() => {
    if (!activeProjectName) {
      return;
    }

    setTemplate((prev) => {
      if (
        prev.subject !== 'CreatorHub Norge - Viktig melding' &&
        prev.preheader !== 'Se de siste oppdateringene fra CreatorHub Norge'
      ) {
        return prev;
      }

      return {
        ...prev,
        subject:
          prev.subject === 'CreatorHub Norge - Viktig melding'
            ? `Oppdatering om ${activeProjectName}`
            : prev.subject,
        preheader:
          prev.preheader === 'Se de siste oppdateringene fra CreatorHub Norge'
            ? `Oppfølging for ${activeProjectName}`
            : prev.preheader,
      };
    });
  }, [activeProjectName]);

  useEffect(() => {
    if (!selectedComponent) {
      return;
    }

    const nextComponent = template.components.find(
      (component) => component.id === selectedComponent.id,
    );

    if (!nextComponent) {
      setSelectedComponent(null);
      setEditDialog(false);
      return;
    }

    const previousSerialized = JSON.stringify(selectedComponent);
    const nextSerialized = JSON.stringify(nextComponent);

    if (previousSerialized !== nextSerialized) {
      setSelectedComponent(cloneComponent(nextComponent));
    }
  }, [selectedComponent, template.components]);

  useEffect(() => {
    const initialSnapshot = cloneTemplateSnapshot(template);
    syncHistory([initialSnapshot], 0);
  }, []);

  useEffect(() => {
    if (suspendHistoryRef.current) {
      suspendHistoryRef.current = false;
      const snapshot = cloneTemplateSnapshot(template);
      const nextItems = historyRef.current.length
        ? historyRef.current.map((item, index) =>
            index === historyIndexRef.current ? snapshot : item,
          )
        : [snapshot];
      const nextIndex = Math.max(historyIndexRef.current, 0);
      syncHistory(nextItems, nextIndex);
      return;
    }

    if (historyIndexRef.current === -1) {
      const snapshot = cloneTemplateSnapshot(template);
      syncHistory([snapshot], 0);
      return;
    }

    const nextSnapshot = cloneTemplateSnapshot(template);
    const currentSnapshot = historyRef.current[historyIndexRef.current];

    if (currentSnapshot && JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)) {
      return;
    }

    const timer = window.setTimeout(() => {
      const baseItems = historyRef.current.slice(0, historyIndexRef.current + 1);
      const trimmedBase =
        baseItems.length >= HISTORY_LIMIT ? baseItems.slice(baseItems.length - HISTORY_LIMIT + 1) : baseItems;
      const nextItems = [...trimmedBase, nextSnapshot];
      const nextIndex = nextItems.length - 1;
      syncHistory(nextItems, nextIndex);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [template]);

  useEffect(() => {
    const enableAutosaveTimer = window.setTimeout(() => {
      autosaveReadyRef.current = true;
    }, 0);

    return () => window.clearTimeout(enableAutosaveTimer);
  }, []);

  useEffect(() => {
    if (!autosaveReadyRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      const record: DraftRecord = {
        template: cloneTemplateSnapshot(template),
        selectedTemplate,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(draftStorageKey, JSON.stringify(record));
      setDraftRecord(record);
      setLastAutoSavedAt(record.savedAt);
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [draftStorageKey, selectedTemplate, template]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isFormField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.getAttribute('contenteditable') === 'true';

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoHistory();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === 'y' ||
          (event.key.toLowerCase() === 'z' && event.shiftKey))
      ) {
        event.preventDefault();
        redoHistory();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveTemplateMutation.mutate(template);
        return;
      }

      if (!isFormField && (event.key === 'Delete' || event.key === 'Backspace') && selectedComponent) {
        event.preventDefault();
        deleteComponent(selectedComponent.id);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [selectedComponent, template]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f6f2ec' }}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 0,
          borderBottom: '1px solid rgba(34, 29, 23, 0.08)',
          background:
            'linear-gradient(180deg, rgba(255,250,244,1) 0%, rgba(248,242,234,1) 100%)',
        }}
      >
        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', xl: 'center' }}
          justifyContent="space-between"
        >
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <EmailIcon sx={{ color: theming.colors.primary }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#221d17' }}>
                E-postdesigner
              </Typography>
              <Chip size="small" color="primary" label={`Kontekst: ${context}`} />
              {activeProfessionLabel && (
                <Chip size="small" variant="outlined" label={`Profesjon: ${activeProfessionLabel}`} />
              )}
              {activeProjectName && (
                <Chip size="small" variant="outlined" label={activeProjectName} />
              )}
              {currentTemplateKey && (
                <Chip size="small" variant="outlined" label={`Mal: ${template.name}`} />
              )}
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
              <Chip
                size="small"
                label={`Kvalitet: ${qualityScore}%`}
                color={qualityScore >= 85 ? 'success' : qualityScore >= 65 ? 'warning' : 'error'}
              />
              {lastAutoSavedAt && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Autolagret ${new Date(lastAutoSavedAt).toLocaleTimeString('nb-NO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`}
                />
              )}
              {lastManualSavedAt && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Lagret ${new Date(lastManualSavedAt).toLocaleTimeString('nb-NO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`}
                />
              )}
              {errorCount > 0 ? (
                <Chip size="small" color="error" label={`${errorCount} kritiske punkter`} />
              ) : warningCount > 0 ? (
                <Chip size="small" color="warning" label={`${warningCount} forbedringer`} />
              ) : (
                <Chip size="small" color="success" label="Klar for bruk" />
              )}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            <ToggleButtonGroup
              size="small"
              value={canvasMode}
              exclusive
              onChange={(_, value: CanvasMode | null) => {
                if (value) {
                  setCanvasMode(value);
                }
              }}
            >
              <ToggleButton value="builder">Bygg</ToggleButton>
              <ToggleButton value="preview">Forhåndsvis</ToggleButton>
            </ToggleButtonGroup>

            {canvasMode === 'preview' ? (
              <>
                <ToggleButtonGroup
                  size="small"
                  value={previewViewport}
                  exclusive
                  onChange={(_, value: PreviewViewport | null) => {
                    if (value) {
                      setPreviewViewport(value);
                    }
                  }}
                >
                  <ToggleButton value="desktop">
                    <DesktopIcon fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="tablet">
                    <TabletIcon fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="mobile">
                    <MobileIcon fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>

                <ToggleButtonGroup
                  size="small"
                  value={previewContentMode}
                  exclusive
                  onChange={(_, value: PreviewContentMode | null) => {
                    if (value) {
                      setPreviewContentMode(value);
                    }
                  }}
                >
                  <ToggleButton value="visual">
                    <PreviewIcon fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="plain">
                    <PlainTextIcon fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>
              </>
            ) : null}

            <Tooltip title="Start en ny mal">
              <span>
                <Button startIcon={<AddIcon />} variant="outlined" onClick={resetTemplate}>
                  Ny mal
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Kopier HTML">
              <span>
                <IconButton onClick={copyTemplateHtml}>
                  <CopyIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Lag en kopi av gjeldende mal">
              <span>
                <IconButton onClick={duplicateCurrentTemplate}>
                  <RestoreIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Angre (Ctrl/Cmd + Z)">
              <span>
                <IconButton onClick={undoHistory} disabled={!canUndo}>
                  <UndoIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Gjør om (Ctrl/Cmd + Shift + Z)">
              <span>
                <IconButton onClick={redoHistory} disabled={!canRedo}>
                  <RedoIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Divider orientation="vertical" flexItem />
            <Tooltip title="Synk e-postmalen med valgt prosjektkontekst">
              <span>
                <Button
                  startIcon={<BusinessIcon />}
                  variant="outlined"
                  onClick={syncProjectContext}
                  disabled={!onProjectSelect || (!selectedProject && !activeProjectId)}
                >
                  Prosjektsynk
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Planlegg et oppfølgingsmøte fra denne malen">
              <span>
                <Button
                  startIcon={<PhoneIcon />}
                  variant="outlined"
                  onClick={createMeetingFromTemplate}
                  disabled={!onMeetingCreate}
                >
                  Oppfølgingsmøte
                </Button>
              </span>
            </Tooltip>
            <Button
              startIcon={<SaveIcon />}
              variant="contained"
              color="primary"
              disabled={saveTemplateMutation.isPending}
              onClick={() => saveTemplateMutation.mutate(template)}
            >
              {saveTemplateMutation.isPending ? 'Lagrer...' : 'Lagre mal'}
            </Button>
            <Button
              startIcon={<SendIcon />}
              variant="contained"
              color="success"
              disabled={sendTestMutation.isPending || testRecipient.trim().length === 0}
              onClick={() => sendTestMutation.mutate()}
            >
              {sendTestMutation.isPending ? 'Sender...' : 'Send test'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {draftRecord ? (
        <Alert
          severity="info"
          sx={{ borderRadius: 0 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" onClick={restoreDraft}>
                Gjenopprett
              </Button>
              <Button color="inherit" size="small" onClick={discardDraft}>
                Fjern
              </Button>
            </Stack>
          }
        >
          Lokalt utkast funnet fra{' '}
          {new Date(draftRecord.savedAt).toLocaleString('nb-NO', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
          })}
          .
        </Alert>
      ) : null}

      {notice ? (
        <Alert
          severity={notice.severity}
          sx={{ borderRadius: 0 }}
          onClose={() => setNotice(null)}
        >
          {notice.message}
        </Alert>
      ) : null}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '320px minmax(0, 1fr) 360px' },
          gridTemplateRows: { xs: 'auto auto 1fr', xl: '1fr' },
          overflow: 'hidden',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            borderRadius: 0,
            borderRight: { xl: '1px solid rgba(34, 29, 23, 0.08)' },
            borderBottom: { xs: '1px solid rgba(34, 29, 23, 0.08)', xl: 'none' },
            overflow: 'auto',
            backgroundColor: '#fbf7f1',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
            sx={{ borderBottom: '1px solid rgba(34, 29, 23, 0.08)' }}
          >
            <Tab label="Komponenter" />
            <Tab label="Innstillinger" />
            <Tab label="Maler" />
          </Tabs>

          {activeTab === 0 ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Bygg e-posten med ferdige seksjoner først, og finjuster deretter med enkelte komponenter.
              </Alert>

              <Typography
                variant="subtitle2"
                sx={{ mb: 1.25, color: '#5f564c', fontWeight: 700, letterSpacing: '0.03em' }}
              >
                Ferdige seksjoner
              </Typography>
              <Stack spacing={1.5} sx={{ mb: 3 }}>
                {sectionPresets.map((section) => (
                  <MuiCard
                    key={section.id}
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      border: '1px solid rgba(34, 29, 23, 0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <SectionIcon sx={{ color: section.accentColor }} fontSize="small" />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {section.title}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {section.description}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                      <Button size="small" onClick={() => insertSection(section)}>
                        Legg til seksjon
                      </Button>
                    </CardActions>
                  </MuiCard>
                ))}
              </Stack>

              <Typography
                variant="subtitle2"
                sx={{ mb: 1.25, color: '#5f564c', fontWeight: 700, letterSpacing: '0.03em' }}
              >
                Enkeltkomponenter
              </Typography>
              <Grid container spacing={1.5}>
                {componentTypes.map((type) => (
                  <Grid item xs={6} key={type.id}>
                    <MuiCard
                      elevation={0}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 3,
                        border: '1px solid rgba(34, 29, 23, 0.08)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 14px 28px rgba(34, 29, 23, 0.08)',
                        },
                      }}
                      onClick={() => addComponent(type.id)}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2 }}>
                        <Box sx={{ color: type.color, mb: 1 }}>{type.icon}</Box>
                        <Typography variant="caption" display="block">
                          {type.name}
                        </Typography>
                      </CardContent>
                    </MuiCard>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : null}

          {activeTab === 1 ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#221d17' }}>
                Global innstillinger
              </Typography>

              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>E-postinfo</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Malnavn"
                      value={template.name}
                      onChange={(event) =>
                        setTemplate((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                    <TextField
                      fullWidth
                      label="Emnelinje"
                      value={template.subject}
                      onChange={(event) =>
                        setTemplate((prev) => ({ ...prev, subject: event.target.value }))
                      }
                    />
                    <TextField
                      fullWidth
                      label="Preheader"
                      value={template.preheader}
                      onChange={(event) =>
                        setTemplate((prev) => ({ ...prev, preheader: event.target.value }))
                      }
                    />
                    <TextField
                      fullWidth
                      label="Testmottaker"
                      type="email"
                      value={testRecipient}
                      onChange={(event) => setTestRecipient(event.target.value)}
                      helperText="Brukes når du sender test direkte fra designeren."
                    />
                  </Stack>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PaletteIcon fontSize="small" />
                    Design
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={usesBrandAccent}
                          onChange={(_, checked) => toggleBrandAccent(checked)}
                        />
                      }
                      label="Bruk CreatorHub-farger"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={hasFooterComponent}
                          onChange={(_, checked) => toggleFooterComponent(checked)}
                        />
                      }
                      label="Vis bunntekst"
                    />
                    <TextField
                      fullWidth
                      label="Bakgrunnsfarge"
                      type="color"
                      value={template.globalStyles.backgroundColor}
                      onChange={(event) =>
                        setTemplate((prev) => ({
                          ...prev,
                          globalStyles: {
                            ...prev.globalStyles,
                            backgroundColor: event.target.value,
                          },
                        }))
                      }
                    />
                    <TextField
                      fullWidth
                      label="Tekstfarge"
                      type="color"
                      value={template.globalStyles.textColor}
                      onChange={(event) =>
                        setTemplate((prev) => ({
                          ...prev,
                          globalStyles: {
                            ...prev.globalStyles,
                            textColor: event.target.value,
                          },
                        }))
                      }
                    />
                    <TextField
                      fullWidth
                      label="Lenkefarge"
                      type="color"
                      value={template.globalStyles.linkColor}
                      onChange={(event) =>
                        setTemplate((prev) => ({
                          ...prev,
                          globalStyles: {
                            ...prev.globalStyles,
                            linkColor: event.target.value,
                          },
                        }))
                      }
                    />
                    <FormControl fullWidth>
                      <InputLabel>Fontfamilie</InputLabel>
                      <Select
                        value={template.globalStyles.fontFamily}
                        label="Fontfamilie"
                        onChange={(event) =>
                          setTemplate((prev) => ({
                            ...prev,
                            globalStyles: {
                              ...prev.globalStyles,
                              fontFamily: event.target.value,
                            },
                          }))
                        }
                      >
                        <MenuItem value="'Helvetica Neue', Arial, sans-serif">
                          Helvetica Neue
                        </MenuItem>
                        <MenuItem value="Arial, sans-serif">Arial</MenuItem>
                        <MenuItem value="Georgia, serif">Georgia</MenuItem>
                        <MenuItem value="Verdana, sans-serif">Verdana</MenuItem>
                        <MenuItem value="'Times New Roman', serif">Times New Roman</MenuItem>
                      </Select>
                    </FormControl>
                    <Box>
                      <Typography gutterBottom>
                        Fontstørrelse: {template.globalStyles.fontSize}px
                      </Typography>
                      <Slider
                        value={template.globalStyles.fontSize}
                        min={10}
                        max={24}
                        step={1}
                        onChange={(_, value) =>
                          setTemplate((prev) => ({
                            ...prev,
                            globalStyles: {
                              ...prev.globalStyles,
                              fontSize: value as number,
                            },
                          }))
                        }
                      />
                    </Box>
                    <Box>
                      <Typography gutterBottom>
                        Containerbredde: {template.globalStyles.containerWidth}px
                      </Typography>
                      <Slider
                        value={template.globalStyles.containerWidth}
                        min={420}
                        max={760}
                        step={10}
                        onChange={(_, value) =>
                          setTemplate((prev) => ({
                            ...prev,
                            globalStyles: {
                              ...prev.globalStyles,
                              containerWidth: value as number,
                            },
                          }))
                        }
                      />
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Box>
          ) : null}

          {activeTab === 2 ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#221d17' }}>
                E-postmaler
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Malbiblioteket samler både anbefalte CreatorHub-maler og maler du har lagret lokalt eller via API.
              </Alert>

              {draftRecord ? (
                <MuiCard
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    border: '1px solid rgba(34, 29, 23, 0.08)',
                    mb: 3,
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <RestoreIcon fontSize="small" sx={{ color: '#2563eb' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Lokalt utkast
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Sist lagret{' '}
                      {new Date(draftRecord.savedAt).toLocaleString('nb-NO', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                      .
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                    <Button size="small" onClick={restoreDraft}>
                      Gjenopprett
                    </Button>
                  </CardActions>
                </MuiCard>
              ) : null}

              {presetTemplates.length > 0 ? (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1.25, color: '#5f564c', fontWeight: 700, letterSpacing: '0.03em' }}
                  >
                    Anbefalte maler
                  </Typography>
                  <Stack spacing={2}>
                    {presetTemplates.map((preset) => {
                      const isSelectedPreset = selectedTemplate === preset.id;

                      return (
                        <MuiCard
                          key={preset.id}
                          elevation={0}
                          sx={{
                            borderRadius: 3,
                            border: isSelectedPreset
                              ? `1px solid ${preset.accentColor}`
                              : '1px solid rgba(34, 29, 23, 0.08)',
                            boxShadow: isSelectedPreset
                              ? `0 18px 42px ${preset.accentColor}18`
                              : 'none',
                          }}
                        >
                          <CardContent sx={{ p: 2 }}>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                              <Chip
                                size="small"
                                label={preset.category}
                                sx={{
                                  bgcolor: `${preset.accentColor}14`,
                                  color: preset.accentColor,
                                  fontWeight: 700,
                                }}
                              />
                              <Chip
                                size="small"
                                label={preset.tone}
                                variant="outlined"
                                sx={{ borderColor: '#ddd3c7', color: '#6d6458' }}
                              />
                            </Stack>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>
                              {preset.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {preset.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                              {preset.preview[0]}
                            </Typography>
                          </CardContent>
                          <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                            <Button size="small" onClick={() => applyTemplateToCanvas(preset.template, preset.id)}>
                              Bruk mal
                            </Button>
                          </CardActions>
                        </MuiCard>
                      );
                    })}
                  </Stack>
                </Box>
              ) : null}

              <Typography
                variant="subtitle2"
                sx={{ mb: 1.25, color: '#5f564c', fontWeight: 700, letterSpacing: '0.03em' }}
              >
                Lagrede maler ({allTemplates.length})
              </Typography>

              {templatesQuery.isLoading ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography>Laster maler...</Typography>
                </Box>
              ) : allTemplates.length > 0 ? (
                <Stack spacing={2}>
                  {allTemplates.map((record) => {
                    const isSelected = selectedTemplate === record.template.id;
                    return (
                      <MuiCard
                        key={`${record.source}-${record.template.id}`}
                        elevation={0}
                        sx={{
                          borderRadius: 3,
                          border: isSelected
                            ? `1px solid ${theming.colors.primary}`
                            : '1px solid rgba(34, 29, 23, 0.08)',
                        }}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                            <Chip
                              size="small"
                              label={record.source === 'api' ? 'API' : 'Lokal'}
                              color={record.source === 'api' ? 'primary' : 'default'}
                            />
                            <Chip size="small" variant="outlined" label={record.template.category} />
                          </Stack>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>
                            {record.template.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {record.template.subject}
                          </Typography>
                        </CardContent>
                        <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                          <Button size="small" onClick={() => loadLibraryTemplate(record)}>
                            Bruk
                          </Button>
                          <Button
                            size="small"
                            startIcon={<RestoreIcon />}
                            onClick={() =>
                              applyTemplateToCanvas(
                                {
                                  ...cloneTemplateSnapshot(record.template),
                                  id: `copy-${Date.now()}`,
                                  name: `${record.template.name} kopi`,
                                },
                                '',
                              )
                            }
                          >
                            Kopier
                          </Button>
                        </CardActions>
                      </MuiCard>
                    );
                  })}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Ingen lagrede maler ennå. Lagre første mal for å bygge ditt eget bibliotek.
                </Typography>
              )}
            </Box>
          ) : null}
        </Paper>

        <Box
          sx={{
            p: 3,
            overflow: 'auto',
            background:
              'radial-gradient(circle at top, rgba(255,224,183,0.45) 0%, rgba(246,242,236,1) 38%, rgba(241,236,229,1) 100%)',
          }}
        >
          <Box
            sx={{
              maxWidth: canvasMode === 'preview' ? Math.max(previewWidth, 420) : template.globalStyles.containerWidth,
              mx: 'auto',
              minHeight: 680,
            }}
          >
            {canvasMode === 'builder' ? (
              <Paper
                elevation={0}
                sx={{
                  backgroundColor: '#ffffff',
                  borderRadius: 4,
                  p: { xs: 2.5, md: 4 },
                  border: '1px solid rgba(34, 29, 23, 0.08)',
                  minHeight: 680,
                }}
              >
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="email-components">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        {template.components.length === 0 ? (
                          <Box
                            sx={{
                              textAlign: 'center',
                              py: 8,
                              px: 2,
                              color: '#6d6458',
                              border: '2px dashed rgba(34, 29, 23, 0.12)',
                              borderRadius: 4,
                              background:
                                'linear-gradient(180deg, rgba(255,249,241,1) 0%, rgba(255,255,255,1) 100%)',
                            }}
                          >
                            <EmailIcon sx={{ fontSize: 52, mb: 2, color: '#d28b22' }} />
                            <Typography variant="h6" gutterBottom sx={{ color: '#221d17' }}>
                              Start med en ferdig seksjon
                            </Typography>
                            <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto', mb: 3 }}>
                              Velg for eksempel "Logo og intro" eller "Hero med CTA" fra venstrepanelet.
                            </Typography>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center">
                              {sectionPresets.slice(0, 3).map((section) => (
                                <Button
                                  key={section.id}
                                  variant="outlined"
                                  onClick={() => insertSection(section)}
                                >
                                  {section.title}
                                </Button>
                              ))}
                            </Stack>
                          </Box>
                        ) : (
                          template.components.map((component, index) => (
                            <Draggable key={component.id} draggableId={component.id} index={index}>
                              {(draggableProvided) => (
                                <div
                                  ref={draggableProvided.innerRef}
                                  {...draggableProvided.draggableProps}
                                  {...draggableProvided.dragHandleProps}
                                >
                                  <SortableComponent
                                    component={component}
                                    template={template}
                                    onEdit={editComponent}
                                    onDelete={deleteComponent}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </Paper>
            ) : (
              <Stack spacing={2}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 4,
                    p: 2,
                    border: '1px solid rgba(34, 29, 23, 0.08)',
                    backgroundColor: 'rgba(255,255,255,0.82)',
                  }}
                >
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                    <Chip icon={<PreviewIcon />} label={previewContentMode === 'visual' ? 'Visuell preview' : 'Plain text'} />
                    <Chip
                      icon={
                        previewViewport === 'desktop' ? (
                          <DesktopIcon />
                        ) : previewViewport === 'tablet' ? (
                          <TabletIcon />
                        ) : (
                          <MobileIcon />
                        )
                      }
                      label={`${previewWidth}px`}
                      variant="outlined"
                    />
                  </Stack>
                </Paper>

                {previewContentMode === 'visual' ? (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      p: { xs: 1, md: 2 },
                    }}
                  >
                    <Box
                      component="iframe"
                      title="E-postforhåndsvisning"
                      srcDoc={generatedHtml}
                      sx={{
                        width: `${previewWidth}px`,
                        maxWidth: '100%',
                        minHeight: 860,
                        border: '1px solid rgba(34, 29, 23, 0.12)',
                        borderRadius: 4,
                        backgroundColor: '#ffffff',
                        boxShadow: '0 24px 60px rgba(34, 29, 23, 0.12)',
                      }}
                    />
                  </Box>
                ) : (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 4,
                      p: 3,
                      border: '1px solid rgba(34, 29, 23, 0.08)',
                      backgroundColor: '#fffdfa',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Plain text-forhåndsvisning
                    </Typography>
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{
                        m: 0,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 13,
                        lineHeight: 1.7,
                        color: '#3f372d',
                      }}
                    >
                      {plainTextPreview}
                    </Typography>
                  </Paper>
                )}
              </Stack>
            )}
          </Box>
        </Box>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 0,
            borderLeft: { xl: '1px solid rgba(34, 29, 23, 0.08)' },
            borderTop: { xs: '1px solid rgba(34, 29, 23, 0.08)', xl: 'none' },
            overflow: 'auto',
            backgroundColor: '#fbf7f1',
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <QualityIcon fontSize="small" sx={{ color: theming.colors.primary }} />
              Kvalitetssjekk
            </Typography>
            <Alert
              severity={errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'success'}
              sx={{ mb: 2 }}
            >
              {errorCount > 0
                ? 'Malen trenger noen justeringer før den er klar.'
                : warningCount > 0
                  ? 'Malen er god, men kan forbedres ytterligere.'
                  : 'Malen ser klar ut for bruk.'}
            </Alert>

            <Stack spacing={1.25} sx={{ mb: 2.5 }}>
              {preflightChecks.map((check, index) => (
                <Paper
                  key={`${check.title}-${index}`}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    border: '1px solid rgba(34, 29, 23, 0.08)',
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    {check.severity === 'success' ? (
                      <CheckIcon color="success" fontSize="small" />
                    ) : check.severity === 'warning' ? (
                      <WarningIcon color="warning" fontSize="small" />
                    ) : (
                      <ErrorIcon color="error" fontSize="small" />
                    )}
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {check.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {check.description}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              ))}
            </Stack>

            <Alert severity="info" sx={{ mb: 2.5 }}>
              Variabler du kan bruke: <strong>{'{{firstName}}'}</strong>, <strong>{'{{dashboardUrl}}'}</strong>, <strong>{'{{profession}}'}</strong>, <strong>{'{{companyName}}'}</strong>.
            </Alert>

            <SubjectLineAnalyzer
              subject={template.subject}
              onSubjectChange={(nextSubject) =>
                setTemplate((prev) => ({ ...prev, subject: nextSubject }))
              }
            />

            <Box sx={{ my: 2.5 }} />

            <EmailContentAnalyzer
              template={{
                subject: template.subject,
                preheader: template.preheader,
                components: template.components,
              }}
            />

            <Box sx={{ my: 2.5 }} />

            <EmailSpamChecker
              template={{
                subject: template.subject,
                preheader: template.preheader,
                components: template.components,
              }}
            />

            <Box sx={{ my: 2.5 }} />

            <EmailNorwegianSpellCheck
              text={plainTextPreview}
              language="nb"
              autoCheck
              onApplySuggestion={applySpellSuggestion}
            />
          </Box>
        </Paper>
      </Box>

      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Rediger komponent:{' '}
          {componentTypes.find((type) => type.id === selectedComponent?.type)?.name}
        </DialogTitle>
        <DialogContent>
          {selectedComponent ? (
            <ComponentEditor
              component={selectedComponent}
              onChange={setSelectedComponent}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            sx={theming.getThemedButtonSx()}
            onClick={() => selectedComponent && updateComponent(selectedComponent)}
          >
            Lagre endringer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const ComponentEditor: React.FC<{
  component: EmailComponent;
  onChange: (component: EmailComponent) => void;
}> = ({ component, onChange }) => {
  const theming = useTheming('photographer');

  function updateContent(key: keyof EmailComponentContent, value: string) {
    onChange({
      ...component,
      content: {
        ...component.content,
        [key]: value,
      },
    });
  }

  function updateStyle(key: keyof EmailComponentStyles, value: string | number) {
    onChange({
      ...component,
      styles: {
        ...component.styles,
        [key]: value,
      },
    });
  }

  return (
    <Stack spacing={3} sx={{ mt: 2 }}>
      <Paper sx={{ p: 2, ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Innhold
        </Typography>

        {(component.type === 'header' ||
          component.type === 'text' ||
          component.type === 'button' ||
          component.type === 'footer') && (
          <TextField
            fullWidth
            label="Tekst"
            multiline={component.type === 'text' || component.type === 'footer'}
            rows={component.type === 'text' || component.type === 'footer' ? 4 : 1}
            value={component.content.text || ''}
            onChange={(event) => updateContent('text', event.target.value)}
            sx={{ mb: 2 }}
          />
        )}

        {component.type === 'button' && (
          <TextField
            fullWidth
            label="Lenke URL"
            value={component.content.url || ''}
            onChange={(event) => updateContent('url', event.target.value)}
          />
        )}

        {component.type === 'image' && (
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Bilde URL"
              value={component.content.src || ''}
              onChange={(event) => updateContent('src', event.target.value)}
            />
            <TextField
              fullWidth
              label="Alt-tekst"
              value={component.content.alt || ''}
              onChange={(event) => updateContent('alt', event.target.value)}
            />
          </Stack>
        )}
      </Paper>

      <Paper sx={{ p: 2, ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Design
        </Typography>

        <Grid container spacing={2}>
          {(component.type === 'header' ||
            component.type === 'text' ||
            component.type === 'footer' ||
            component.type === 'button') && (
            <>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label={component.type === 'button' ? 'Bakgrunnsfarge' : 'Farge'}
                  type="color"
                  value={
                    component.type === 'button'
                      ? component.styles.backgroundColor || '#ff8c00'
                      : component.styles.color || '#40372d'
                  }
                  onChange={(event) =>
                    updateStyle(
                      component.type === 'button' ? 'backgroundColor' : 'color',
                      event.target.value,
                    )
                  }
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Justering</InputLabel>
                  <Select
                    value={component.styles.textAlign || 'left'}
                    label="Justering"
                    onChange={(event) =>
                      updateStyle('textAlign', event.target.value as EmailTextAlign)
                    }
                  >
                    <MenuItem value="left">Venstre</MenuItem>
                    <MenuItem value="center">Sentrert</MenuItem>
                    <MenuItem value="right">Høyre</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}

          {(component.type === 'header' ||
            component.type === 'text' ||
            component.type === 'footer' ||
            component.type === 'button') && (
            <Grid item xs={12}>
              <Typography gutterBottom>
                Fontstørrelse: {component.styles.fontSize || (component.type === 'footer' ? 12 : 16)}px
              </Typography>
              <Slider
                value={component.styles.fontSize || (component.type === 'footer' ? 12 : 16)}
                min={10}
                max={42}
                step={1}
                onChange={(_, value) => updateStyle('fontSize', value as number)}
              />
            </Grid>
          )}

          {component.type === 'button' && (
            <>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Tekstfarge"
                  type="color"
                  value={component.styles.color || '#ffffff'}
                  onChange={(event) => updateStyle('color', event.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Hjørneradius"
                  type="number"
                  value={component.styles.borderRadius || 999}
                  onChange={(event) => updateStyle('borderRadius', Number(event.target.value))}
                />
              </Grid>
            </>
          )}

          {component.type === 'image' && (
            <>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Bredde"
                  value={component.styles.width || '100%'}
                  onChange={(event) => updateStyle('width', event.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Justering</InputLabel>
                  <Select
                    value={component.styles.textAlign || 'center'}
                    label="Justering"
                    onChange={(event) =>
                      updateStyle('textAlign', event.target.value as EmailTextAlign)
                    }
                  >
                    <MenuItem value="left">Venstre</MenuItem>
                    <MenuItem value="center">Sentrert</MenuItem>
                    <MenuItem value="right">Høyre</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}

          {component.type === 'divider' && (
            <>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Farge"
                  type="color"
                  value={component.styles.color || '#eadfce'}
                  onChange={(event) => updateStyle('color', event.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Høyde"
                  type="number"
                  value={component.styles.height || 1}
                  onChange={(event) => updateStyle('height', Number(event.target.value))}
                />
              </Grid>
            </>
          )}

          {component.type === 'spacer' && (
            <Grid item xs={12}>
              <Typography gutterBottom>Avstand: {component.styles.height || 24}px</Typography>
              <Slider
                value={component.styles.height || 24}
                min={8}
                max={80}
                step={4}
                onChange={(_, value) => updateStyle('height', value as number)}
              />
            </Grid>
          )}

          {component.type === 'social' && (
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Justering</InputLabel>
                <Select
                  value={component.styles.alignment || 'center'}
                  label="Justering"
                  onChange={(event) =>
                    updateStyle('alignment', event.target.value as EmailTextAlign)
                  }
                >
                  <MenuItem value="left">Venstre</MenuItem>
                  <MenuItem value="center">Sentrert</MenuItem>
                  <MenuItem value="right">Høyre</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}

          {component.type !== 'spacer' && component.type !== 'divider' ? (
            <Grid item xs={12}>
              <Typography gutterBottom>
                Margin bunn: {component.styles.marginBottom || 16}px
              </Typography>
              <Slider
                value={component.styles.marginBottom || 16}
                min={0}
                max={64}
                step={2}
                onChange={(_, value) => updateStyle('marginBottom', value as number)}
              />
            </Grid>
          ) : null}
        </Grid>
      </Paper>
    </Stack>
  );
};

export default EmailDesigner;
