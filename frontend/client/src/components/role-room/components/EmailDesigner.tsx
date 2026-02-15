import { useState, useEffect, useCallback, useMemo, useRef, type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Divider,
  Paper,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  Badge,
  Fade,
  Collapse,
  useTheme,
  useMediaQuery,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatListBulleted as BulletListIcon,
  FormatListNumbered as NumberListIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  FormatStrikethrough as StrikeIcon,
  Code as CodeIcon,
  DesktopWindows as DesktopIcon,
  PhoneIphone as MobileIcon,
  History as HistoryIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  ContentCopy as CopyIcon,
  Restore as RestoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Visibility as PreviewIcon,
  DataObject as VariableIcon,
  Palette as PaletteIcon,
  FormatColorFill as ColorFillIcon,
  OpenInNew as OpenInNewIcon,
  MailOutline as MailOutlineIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Schedule as ScheduleIcon,
  Celebration as CelebrationIcon,
  ThumbDown as ThumbDownIcon,
  NotificationsActive as NotificationsActiveIcon,
  PersonAdd as PersonAddIcon,
  Handshake as HandshakeIcon,
  SwapHoriz as SwapHorizIcon,
  Folder as FolderIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { useToast } from './ToastStack';

interface EmailTemplate {
  id: string;
  name: string;
  type: 'invitation' | 'callback' | 'confirmation' | 'rejection' | 'reminder' | 'custom';
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

interface EmailVersion {
  id: string;
  subject: string;
  body: string;
  timestamp: Date;
  label?: string;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  role?: string;
  type: 'candidate' | 'crew' | 'custom';
}

interface EmailDesignerProps {
  template?: EmailTemplate;
  recipients?: Recipient[];
  onSave?: (template: EmailTemplate) => void;
  onSend?: (template: EmailTemplate, recipients: Recipient[]) => void;
  projectVariables?: Record<string, string>;
  projectName?: string;
}

const AVAILABLE_VARIABLES = [
  { key: 'candidateName', label: 'Kandidatnavn', example: 'Ola Nordmann' },
  { key: 'projectName', label: 'Prosjektnavn', example: 'Sommerfilmen 2026' },
  { key: 'roleName', label: 'Rolle', example: 'Hovedrolle' },
  { key: 'auditionDate', label: 'Casting dato', example: '15. januar 2025' },
  { key: 'auditionTime', label: 'Casting tid', example: '10:00' },
  { key: 'location', label: 'Lokasjon', example: 'Studio 1, Oslo' },
  { key: 'companyName', label: 'Produksjonsselskap', example: 'Film AS' },
  { key: 'senderName', label: 'Avsendernavn', example: 'Kari Hansen' },
  { key: 'contactPhone', label: 'Kontakttelefon', example: '+47 987 65 432' },
  { key: 'responseDeadline', label: 'Svarfrist', example: '10. januar 2025' },
  { key: 'callbackDate', label: 'Callback dato', example: '20. januar 2025' },
  { key: 'callbackTime', label: 'Callback tid', example: '14:00' },
  { key: 'productionStartDate', label: 'Produksjonsstart', example: '1. mars 2025' },
  { key: 'productionDuration', label: 'Produksjonslengde', example: '6 uker' },
  { key: 'preparationNotes', label: 'Forberedelsesnotater', example: 'Ta med utskrift av manuset' },
];

const DEFAULT_TEMPLATES: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Casting Innkalling',
    type: 'invitation',
    subject: 'Du er invitert til casting for {{projectName}}',
    body: `<p>Hei {{candidateName}},</p>
<p>Vi er glade for å invitere deg til casting for vår kommende produksjon "<strong>{{projectName}}</strong>".</p>
<p><strong>Detaljer:</strong></p>
<ul>
<li>Rolle: {{roleName}}</li>
<li>Dato: {{auditionDate}}</li>
<li>Tid: {{auditionTime}}</li>
<li>Sted: {{location}}</li>
</ul>
<p>Vennligst bekreft din deltakelse innen {{responseDeadline}}.</p>
<p>Med vennlig hilsen,<br/>{{senderName}}<br/>{{companyName}}</p>`,
  },
  {
    name: 'Callback / Ny Runde',
    type: 'callback',
    subject: 'Callback invitasjon - {{projectName}}',
    body: `<p>Hei {{candidateName}},</p>
<p>Gratulerer! Du har blitt valgt ut til callback for "<strong>{{projectName}}</strong>".</p>
<p><strong>Callback-detaljer:</strong></p>
<ul>
<li>Rolle: {{roleName}}</li>
<li>Dato: {{callbackDate}}</li>
<li>Tid: {{callbackTime}}</li>
<li>Sted: {{location}}</li>
</ul>
<p><strong>Forberedelser:</strong><br/>{{preparationNotes}}</p>
<p>Vi ser frem til å se deg igjen!</p>
<p>Hilsen,<br/>{{senderName}}<br/>{{companyName}}</p>`,
  },
  {
    name: 'Bekreftelse på Rolle',
    type: 'confirmation',
    subject: '🎉 Gratulerer! Du har fått rollen i {{projectName}}',
    body: `<p>Kjære {{candidateName}},</p>
<p>Vi er utrolig glade for å kunne meddele at du har fått rollen som <strong>{{roleName}}</strong> i "<strong>{{projectName}}</strong>"!</p>
<p><strong>Produksjonsdetaljer:</strong></p>
<ul>
<li>Produksjonsstart: {{productionStartDate}}</li>
<li>Varighet: {{productionDuration}}</li>
</ul>
<p>Vi vil kontakte deg snart med mer informasjon om kontrakt og opptaksplan.</p>
<p>Gratulerer med rollen!</p>
<p>Vennlig hilsen,<br/>{{senderName}}<br/>{{companyName}}</p>`,
  },
  {
    name: 'Høflig Avslag',
    type: 'rejection',
    subject: 'Angående din søknad til {{projectName}}',
    body: `<p>Kjære {{candidateName}},</p>
<p>Takk for at du deltok på casting for "<strong>{{projectName}}</strong>". Vi satte stor pris på tiden din og innsatsen du la ned.</p>
<p>Etter nøye vurdering har vi dessverre valgt å gå videre med andre kandidater for rollen som {{roleName}}. Dette var en vanskelig beslutning da vi hadde mange talentfulle søkere.</p>
<p>Vi setter stor pris på din tid og innsats, og håper du vil vurdere fremtidige prosjekter fra oss.</p>
<p>Lykke til videre!</p>
<p>Med vennlig hilsen,<br/>{{senderName}}<br/>{{companyName}}</p>`,
  },
  {
    name: 'Påminnelse',
    type: 'reminder',
    subject: 'Påminnelse: Casting i morgen - {{projectName}}',
    body: `<p>Hei {{candidateName}},</p>
<p>Dette er en vennlig påminnelse om din casting i morgen.</p>
<p><strong>Detaljer:</strong></p>
<ul>
<li>Prosjekt: {{projectName}}</li>
<li>Rolle: {{roleName}}</li>
<li>Dato: {{auditionDate}}</li>
<li>Tid: {{auditionTime}}</li>
<li>Sted: {{location}}</li>
</ul>
<p>Husk å ta med gyldig ID. Vennligst ankom 10 minutter før oppsatt tid.</p>
<p>Ser frem til å møte deg!</p>
<p>Hilsen,<br/>{{senderName}}<br/>{{companyName}}</p>`,
  },
];

const BRAND_COLORS = {
  primary: '#8b5cf6',
  secondary: '#6366f1',
  accent: '#a78bfa',
  dark: '#0a0a0f',
  light: '#f5f5f5',
};

const TEMPLATE_TYPE_CONFIG: Record<string, { 
  icon: ReactNode; 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  invitation: {
    icon: <EmailIcon sx={{ fontSize: 24 }} />,
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    label: 'Invitasjon',
  },
  callback: {
    icon: <ScheduleIcon sx={{ fontSize: 24 }} />,
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.15)',
    label: 'Callback',
  },
  confirmation: {
    icon: <CheckIcon sx={{ fontSize: 24 }} />,
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    label: 'Bekreftelse',
  },
  rejection: {
    icon: <CloseIcon sx={{ fontSize: 24 }} />,
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    label: 'Avslag',
  },
  reminder: {
    icon: <NotificationsActiveIcon sx={{ fontSize: 24 }} />,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    label: 'Påminnelse',
  },
  owner_invitation: {
    icon: <PersonAddIcon sx={{ fontSize: 24 }} />,
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.15)',
    label: 'Eier Invitasjon',
  },
  owner_welcome: {
    icon: <HandshakeIcon sx={{ fontSize: 24 }} />,
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.15)',
    label: 'Eier Velkomst',
  },
  owner_transfer: {
    icon: <SwapHorizIcon sx={{ fontSize: 24 }} />,
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.15)',
    label: 'Eieroverføring',
  },
  custom: {
    icon: <EditIcon sx={{ fontSize: 24 }} />,
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.15)',
    label: 'Egendefinert',
  },
};

const CASTING_PLANNER_LOGO_URL = '/casting-planner-logo.png';

interface EmailHeaderConfig {
  logoUrl: string;
  tagline: string;
}

const generateEmailHTML = (
  subject: string, 
  body: string, 
  previewMode: 'desktop' | 'mobile',
  headerConfig: EmailHeaderConfig = { logoUrl: CASTING_PLANNER_LOGO_URL, tagline: 'Profesjonell Casting Management' }
) => {
  const width = previewMode === 'mobile' ? '375px' : '600px';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: ${width};
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(139, 92, 246, 0.15);
    }
    .email-header {
      background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%);
      padding: 28px 24px;
      text-align: center;
    }
    .email-logo-container {
      display: inline-block;
      margin-bottom: 8px;
    }
    .email-tagline {
      font-size: 11px;
      color: rgba(255,255,255,0.85);
      text-transform: uppercase;
      letter-spacing: 3px;
      margin: 8px 0 0 0;
      font-weight: 500;
    }
    .email-subject {
      background-color: ${BRAND_COLORS.dark};
      color: #ffffff;
      padding: 18px 24px;
      font-size: 17px;
      font-weight: 600;
      border-left: 4px solid ${BRAND_COLORS.primary};
    }
    .email-body {
      padding: 32px 24px;
      color: #333333;
      line-height: 1.7;
      font-size: 15px;
    }
    .email-body p {
      margin: 0 0 16px 0;
    }
    .email-body ul, .email-body ol {
      margin: 0 0 16px 0;
      padding-left: 24px;
    }
    .email-body li {
      margin-bottom: 8px;
    }
    .email-body strong {
      color: ${BRAND_COLORS.primary};
    }
    .email-footer {
      background: linear-gradient(180deg, #f8f9fa 0%, #f0f0f5 100%);
      padding: 24px;
      text-align: center;
      border-top: 1px solid rgba(139, 92, 246, 0.1);
    }
    .email-footer-logo {
      margin-bottom: 12px;
    }
    .email-footer-brand {
      font-size: 14px;
      font-weight: 600;
      color: ${BRAND_COLORS.primary};
      margin: 0 0 4px 0;
    }
    .email-footer-text {
      font-size: 12px;
      color: #6c757d;
      margin: 0;
    }
    .variable-highlight {
      background-color: rgba(139, 92, 246, 0.1);
      color: ${BRAND_COLORS.primary};
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div style="padding: 24px;">
    <div class="email-container">
      <div class="email-header">
        <div class="email-logo-container">
          <img src="${headerConfig.logoUrl}" alt="Logo" style="height: 50px; width: auto;" />
        </div>
        <p class="email-tagline">${headerConfig.tagline}</p>
      </div>
      <div class="email-subject">${subject}</div>
      <div class="email-body">${body}</div>
      <div class="email-footer">
        <div class="email-footer-logo">
          <img src="${CASTING_PLANNER_LOGO_URL}" alt="Casting Planner" style="height: 32px; width: auto;" />
        </div>
        <p class="email-footer-brand">Casting Planner</p>
        <p class="email-footer-text">Sendt via Casting Planner - Din profesjonelle castingpartner</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

const replaceVariablesWithHighlight = (text: string): string => {
  return text.replace(/\{\{([^}]+)\}\}/g, '<span class="variable-highlight">{{$1}}</span>');
};

const replaceVariablesWithValues = (text: string, values: Record<string, string>): string => {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const value = values[key.trim()];
    return value !== undefined ? value : match;
  });
};

export function EmailDesigner({
  template,
  recipients = [],
  onSave,
  onSend,
  projectVariables = {},
  projectName = 'Aktuelt prosjekt',
}: EmailDesignerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width:599px)');
  const isTablet = useMediaQuery('(min-width:600px) and (max-width:959px)');
  const is720p = useMediaQuery('(min-width:960px) and (max-width:1279px)');
  const is1080p = useMediaQuery('(min-width:1280px) and (max-width:1919px)');
  const is2K = useMediaQuery('(min-width:1920px) and (max-width:2559px)');
  const is4K = useMediaQuery('(min-width:2560px)');
  const isDesktop = !isMobile && !isTablet;
  const toast = useToast();

  const getResponsiveValue = <T,>(mobile: T, tablet: T, hd720: T, hd1080: T, qhd: T, uhd4k: T): T => {
    if (is4K) return uhd4k;
    if (is2K) return qhd;
    if (is1080p) return hd1080;
    if (is720p) return hd720;
    if (isTablet) return tablet;
    return mobile;
  };

  const spacing = getResponsiveValue(1.5, 2, 2, 2.5, 3, 4);
  const buttonMinHeight = getResponsiveValue(44, 44, 40, 42, 48, 56);
  const iconButtonSize = getResponsiveValue(44, 44, 40, 42, 48, 56);
  const fontSize = {
    title: getResponsiveValue(16, 18, 18, 20, 24, 28),
    body: getResponsiveValue(14, 15, 14, 15, 17, 20),
    caption: getResponsiveValue(11, 12, 12, 13, 15, 18),
    button: getResponsiveValue(13, 14, 13, 14, 16, 18),
  };

  const [subject, setSubject] = useState(template?.subject || '');
  const [body, setBody] = useState(template?.body || '');
  const [templateName, setTemplateName] = useState(template?.name || 'Ny mal');
  const [templateType, setTemplateType] = useState<EmailTemplate['type']>(template?.type || 'custom');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showPreview, setShowPreview] = useState(!isMobile);
  const [versions, setVersions] = useState<EmailVersion[]>([]);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [variableMenuAnchor, setVariableMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);
    const [sendOptionsDialogOpen, setSendOptionsDialogOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [templatePanelCollapsed, setTemplatePanelCollapsed] = useState(false);
  const [headerLogoUrl, setHeaderLogoUrl] = useState(CASTING_PLANNER_LOGO_URL);
  const [headerTagline, setHeaderTagline] = useState('Profesjonell Casting Management');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Skriv e-postinnhold her...',
      }),
    ],
    content: body,
    onUpdate: ({ editor }) => {
      const newBody = editor.getHTML();
      setBody(newBody);
      setHasUnsavedChanges(true);
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges && subject && body) {
        saveVersion();
        setHasUnsavedChanges(false);
        setLastSaved(new Date());
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, subject, body]);

  // Validate project variables and show toast for missing data
  // Track last validated state using missing keys signature
  const lastValidationRef = useRef<string>('');
  
  useEffect(() => {
    const missingVars = AVAILABLE_VARIABLES.filter(
      v => !projectVariables[v.key] || projectVariables[v.key].trim() === ''
    );
    const missingKeys = missingVars.map(v => v.key).sort().join(',');
    const validationSignature = `${projectName}:${missingKeys}`;
    
    // Skip if we've already shown this exact validation state
    if (lastValidationRef.current === validationSignature) {
      return;
    }
    
    // Update the ref with current state
    lastValidationRef.current = validationSignature;
    
    if (missingVars.length === AVAILABLE_VARIABLES.length) {
      // All variables are missing
      toast.showWarning(`Ingen prosjektdata funnet for "${projectName}". Fyll inn variabelverdier for å sende personaliserte e-poster.`);
    } else if (missingVars.length > 0) {
      // Some variables are missing
      const missingLabels = missingVars.slice(0, 3).map(v => v.label).join(', ');
      const moreCount = missingVars.length > 3 ? ` +${missingVars.length - 3} til` : '';
      toast.showInfo(`Noen variabler mangler fra "${projectName}": ${missingLabels}${moreCount}`);
    }
    // No toast when all variables are present
  }, [projectVariables, projectName, toast]);

  const saveVersion = useCallback(() => {
    const newVersion: EmailVersion = {
      id: `v-${Date.now()}`,
      subject,
      body,
      timestamp: new Date(),
    };
    setVersions(prev => [...prev.slice(-19), newVersion]);
  }, [subject, body]);

  const restoreVersion = useCallback((version: EmailVersion) => {
    setSubject(version.subject);
    setBody(version.body);
    editor?.commands.setContent(version.body);
    setHistoryDialogOpen(false);
    toast.showSuccess('Versjon gjenopprettet');
  }, [editor, toast]);

  const insertVariable = useCallback((variable: string) => {
    if (editor) {
      editor.chain().focus().insertContent(`{{${variable}}}`).run();
    }
    setVariableMenuAnchor(null);
  }, [editor]);

  const handleSave = useCallback(() => {
    if (!templateName.trim()) {
      toast.showWarning('Vennligst gi malen et navn');
      return;
    }
    
    saveVersion();
    
    const savedTemplate: EmailTemplate = {
      id: template?.id || `template-${Date.now()}`,
      name: templateName,
      type: templateType,
      subject,
      body,
      createdAt: template?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    
    onSave?.(savedTemplate);
    setLastSaved(new Date());
    setHasUnsavedChanges(false);
    toast.showSuccess('Mal lagret');
  }, [template, templateName, templateType, subject, body, onSave, toast, saveVersion]);

  const handleSend = useCallback(() => {
    if (selectedRecipients.length === 0) {
      toast.showWarning('Velg minst én mottaker');
      return;
    }
    
    const recipientsToSend = recipients.filter(r => selectedRecipients.includes(r.id));
    
    const templateToSend: EmailTemplate = {
      id: template?.id || `template-${Date.now()}`,
      name: templateName,
      type: templateType,
      subject,
      body,
      createdAt: template?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    
    onSend?.(templateToSend, recipientsToSend);
    toast.showSuccess(`E-post sendt til ${recipientsToSend.length} mottaker(e)`);
  }, [selectedRecipients, recipients, template, templateName, templateType, subject, body, onSend, toast]);

  const stripHtmlToPlainText = useCallback((html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    temp.querySelectorAll('p').forEach(p => p.insertAdjacentText('afterend', '\n\n'));
    temp.querySelectorAll('li').forEach(li => li.insertAdjacentText('beforebegin', '• '));
    return temp.textContent?.trim() || '';
  }, []);

  const handleOpenMailto = useCallback((recipientEmail?: string) => {
    const plainBody = stripHtmlToPlainText(body);
    const emailSubject = encodeURIComponent(subject);
    const emailBody = encodeURIComponent(plainBody);
    const mailto = `mailto:${recipientEmail || ''}?subject=${emailSubject}&body=${emailBody}`;
    window.open(mailto, '_blank');
    toast.showSuccess('E-postklienten åpnes...');
    setSendOptionsDialogOpen(false);
  }, [subject, body, stripHtmlToPlainText, toast]);

  const handleCopyToClipboard = useCallback(async () => {
    try {
      const plainBody = stripHtmlToPlainText(body);
      const emailContent = `Emne: ${subject}\n\n${plainBody}`;
      await navigator.clipboard.writeText(emailContent);
      toast.showSuccess('E-postinnhold kopiert til utklippstavlen');
      setSendOptionsDialogOpen(false);
    } catch {
      toast.showError('Kunne ikke kopiere til utklippstavlen');
    }
  }, [subject, body, stripHtmlToPlainText, toast]);

  const handleCopyHtmlToClipboard = useCallback(async () => {
    try {
      const fullHtml = generateEmailHTML(subject, body, 'desktop', { logoUrl: headerLogoUrl, tagline: headerTagline });
      await navigator.clipboard.writeText(fullHtml);
      toast.showSuccess('HTML-versjon kopiert til utklippstavlen');
      setSendOptionsDialogOpen(false);
    } catch {
      toast.showError('Kunne ikke kopiere til utklippstavlen');
    }
  }, [subject, body, toast, headerLogoUrl, headerTagline]);

  const loadTemplate = useCallback((templateData: typeof DEFAULT_TEMPLATES[0]) => {
    setTemplateName(templateData.name);
    setTemplateType(templateData.type);
    setSubject(templateData.subject);
    setBody(templateData.body);
    editor?.commands.setContent(templateData.body);
    toast.showSuccess('Mal lastet');
  }, [editor, toast]);

  const handleLogoUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.showError('Ugyldig filtype. Bruk PNG, JPEG eller WebP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.showError('Filen er for stor. Maksimal størrelse er 2MB.');
      return;
    }

    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/email/logo-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Opplasting feilet');
      }

      const result = await response.json();
      setHeaderLogoUrl(result.url);
      toast.showSuccess('Logo lastet opp!');
    } catch (error) {
      toast.showError(error instanceof Error ? error.message : 'Kunne ikke laste opp logo');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  }, [toast]);

  const previewHTML = useMemo(() => {
    const highlightedBody = replaceVariablesWithHighlight(body);
    const highlightedSubject = replaceVariablesWithHighlight(subject);
    return generateEmailHTML(highlightedSubject, highlightedBody, previewMode, { logoUrl: headerLogoUrl, tagline: headerTagline });
  }, [subject, body, previewMode, headerLogoUrl, headerTagline]);

  const toolbarButtonStyle = {
    color: 'rgba(255,255,255,0.87)',
    minWidth: iconButtonSize,
    minHeight: iconButtonSize,
    '&:hover': {
      color: BRAND_COLORS.primary,
      bgcolor: 'rgba(255,255,255,0.08)',
    },
    '&.active': {
      color: BRAND_COLORS.primary,
      bgcolor: 'rgba(255,255,255,0.12)',
    },
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      bgcolor: '#0d1117',
      color: '#fff',
    }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        p: spacing,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexWrap: 'wrap',
        gap: spacing,
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing, width: isMobile ? '100%' : 'auto' }}>
          <EmailIcon sx={{ color: BRAND_COLORS.primary, fontSize: getResponsiveValue(24, 26, 26, 28, 32, 36) }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: fontSize.title }}>
              E-postdesigner
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: fontSize.caption }}>
              {lastSaved 
                ? `Sist lagret: ${lastSaved.toLocaleTimeString('nb-NO')}`
                : 'Ikke lagret ennå'}
              {hasUnsavedChanges && ' • Ulagrede endringer'}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          gap: 1, 
          flexWrap: 'wrap',
          width: isMobile ? '100%' : 'auto',
          justifyContent: isMobile ? 'stretch' : 'flex-end',
        }}>
          <Badge 
            badgeContent={versions.length} 
            color="secondary"
            sx={{ 
              '& .MuiBadge-badge': { bgcolor: BRAND_COLORS.secondary },
              flex: isMobile ? 1 : 'none',
            }}
          >
            <Button
              variant="outlined"
              startIcon={!isMobile && <HistoryIcon />}
              onClick={() => setHistoryDialogOpen(true)}
              fullWidth={isMobile}
              sx={{ 
                color: '#fff', 
                borderColor: 'rgba(255,255,255,0.2)',
                '&:hover': { borderColor: BRAND_COLORS.primary },
                minHeight: buttonMinHeight,
                fontSize: fontSize.button,
              }}
            >
              {isMobile ? <HistoryIcon /> : 'Historikk'}
            </Button>
          </Badge>
          <Button
            variant="outlined"
            startIcon={!isMobile && <SaveIcon />}
            onClick={handleSave}
            sx={{ 
              color: '#fff', 
              borderColor: 'rgba(255,255,255,0.2)',
              '&:hover': { borderColor: BRAND_COLORS.primary },
              minHeight: buttonMinHeight,
              fontSize: fontSize.button,
              flex: isMobile ? 1 : 'none',
            }}
          >
            {isMobile ? <SaveIcon /> : 'Lagre'}
          </Button>
          <Button
            variant="contained"
            startIcon={!isMobile && <SendIcon />}
            onClick={() => setSendOptionsDialogOpen(true)}
            sx={{ 
              bgcolor: BRAND_COLORS.primary,
              '&:hover': { bgcolor: BRAND_COLORS.accent },
              minHeight: buttonMinHeight,
              fontSize: fontSize.button,
              flex: isMobile ? 1 : 'none',
            }}
          >
            {isMobile ? <SendIcon /> : 'Send'}
          </Button>
        </Box>
      </Box>

      <Box sx={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden',
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        {/* Collapsible Template Side Panel - hidden on mobile/tablet */}
        {isDesktop && (
        <Box sx={{ 
          width: templatePanelCollapsed ? getResponsiveValue(48, 52, 52, 56, 64, 72) : getResponsiveValue(240, 260, 260, 280, 320, 380),
          minWidth: templatePanelCollapsed ? getResponsiveValue(48, 52, 52, 56, 64, 72) : getResponsiveValue(240, 260, 260, 280, 320, 380),
          transition: 'all 0.3s ease',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          bgcolor: '#0a0a0f',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Panel Header - always shows "Maler" */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            p: 1.5,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            minHeight: 48,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PaletteIcon sx={{ fontSize: 20, color: BRAND_COLORS.primary }} />
              {!templatePanelCollapsed && (
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
                  Maler
                </Typography>
              )}
              {templatePanelCollapsed && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.8)',
                    fontWeight: 600,
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                    letterSpacing: 1,
                  }}
                >
                  Maler
                </Typography>
              )}
            </Box>
            <Tooltip title={templatePanelCollapsed ? 'Utvid' : 'Minimer'} placement="right">
              <IconButton 
                size="small" 
                onClick={() => setTemplatePanelCollapsed(!templatePanelCollapsed)}
                sx={{ 
                  color: 'rgba(255,255,255,0.87)',
                  '&:hover': { 
                    color: BRAND_COLORS.primary,
                    bgcolor: 'rgba(139, 92, 246, 0.1)',
                  },
                }}
              >
                {templatePanelCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Template List */}
          {!templatePanelCollapsed && (
            <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
              <Stack spacing={1.5}>
                {DEFAULT_TEMPLATES.map((tmpl, index) => {
                  const typeConfig = TEMPLATE_TYPE_CONFIG[tmpl.type] || TEMPLATE_TYPE_CONFIG.custom;
                  const isSelected = templateName === tmpl.name && templateType === tmpl.type;
                  
                  return (
                    <Paper
                      key={index}
                      onClick={() => loadTemplate(tmpl)}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        bgcolor: isSelected ? 'rgba(139, 92, 246, 0.15)' : '#161b22',
                        border: isSelected 
                          ? `2px solid ${BRAND_COLORS.primary}` 
                          : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 2,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                          borderColor: isSelected ? BRAND_COLORS.primary : 'rgba(255,255,255,0.15)',
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Box sx={{ 
                          color: typeConfig.color,
                          mt: 0.25,
                        }}>
                          {typeConfig.icon}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 600, 
                              color: '#fff',
                              mb: 0.5,
                            }}
                          >
                            {tmpl.name}
                          </Typography>
                          <Chip
                            label={typeConfig.label}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              bgcolor: typeConfig.bgColor,
                              color: typeConfig.color,
                              border: `1px solid ${typeConfig.color}40`,
                            }}
                          />
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
              
              {/* Add New Template Button */}
              <Button
                fullWidth
                startIcon={<AddIcon />}
                onClick={() => {
                  setTemplateName('Ny mal');
                  setTemplateType('custom');
                  setSubject('');
                  setBody('');
                  editor?.commands.setContent('');
                }}
                sx={{
                  mt: 2,
                  color: 'rgba(255,255,255,0.87)',
                  borderColor: 'rgba(255,255,255,0.2)',
                  border: '1px dashed rgba(255,255,255,0.2)',
                  borderRadius: 2,
                  py: 1.5,
                  '&:hover': {
                    borderColor: BRAND_COLORS.primary,
                    color: BRAND_COLORS.primary,
                    bgcolor: 'rgba(139, 92, 246, 0.1)',
                  },
                }}
              >
                Ny mal
              </Button>
            </Box>
          )}
          
          {/* Collapsed state icon stack */}
          {templatePanelCollapsed && (
            <Box sx={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              pt: 2,
              gap: 1,
            }}>
              {DEFAULT_TEMPLATES.slice(0, 5).map((tmpl, index) => {
                const typeConfig = TEMPLATE_TYPE_CONFIG[tmpl.type] || TEMPLATE_TYPE_CONFIG.custom;
                return (
                  <Tooltip key={index} title={tmpl.name} placement="right">
                    <IconButton
                      size="small"
                      onClick={() => {
                        loadTemplate(tmpl);
                        setTemplatePanelCollapsed(false);
                      }}
                      sx={{ 
                        color: typeConfig.color,
                        '&:hover': { bgcolor: typeConfig.bgColor },
                      }}
                    >
                      {typeConfig.icon}
                    </IconButton>
                  </Tooltip>
                );
              })}
            </Box>
          )}
        </Box>
        )}

        {/* Main Editor Area */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          borderRight: (isMobile || isTablet) ? 'none' : '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <Box sx={{ p: spacing, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Stack spacing={spacing}>
              <Box sx={{ display: 'flex', gap: spacing, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
                <TextField
                  label="Malnavn"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  size={isMobile ? 'medium' : 'small'}
                  sx={{ 
                    flex: 1,
                    minWidth: isMobile ? '100%' : 200,
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      fontSize: fontSize.body,
                      minHeight: buttonMinHeight,
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                      '&.Mui-focused fieldset': { borderColor: BRAND_COLORS.primary },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body },
                  }}
                />
                <FormControl size={isMobile ? 'medium' : 'small'} sx={{ minWidth: isMobile ? '100%' : 150 }}>
                  <InputLabel sx={{ color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body }}>Type</InputLabel>
                  <Select
                    value={templateType}
                    label="Type"
                    onChange={(e) => setTemplateType(e.target.value as EmailTemplate['type'])}
                    sx={{
                      color: '#fff',
                      fontSize: fontSize.body,
                      minHeight: buttonMinHeight,
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                      '&.Mui-focused fieldset': { borderColor: BRAND_COLORS.primary },
                    }}
                  >
                    <MenuItem value="invitation">Innkalling</MenuItem>
                    <MenuItem value="callback">Callback</MenuItem>
                    <MenuItem value="confirmation">Bekreftelse</MenuItem>
                    <MenuItem value="rejection">Avslag</MenuItem>
                    <MenuItem value="reminder">Påminnelse</MenuItem>
                    <MenuItem value="custom">Egendefinert</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <TextField
                label="Emne"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                fullWidth
                size={isMobile ? 'medium' : 'small'}
                placeholder="F.eks: Innkalling til casting - {{prosjekt}}"
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    fontSize: fontSize.body,
                    minHeight: buttonMinHeight,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                    '&.Mui-focused fieldset': { borderColor: BRAND_COLORS.primary },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body },
                }}
              />

              {/* Header Settings - collapsed on mobile */}
              {!isMobile && (
              <Box sx={{ 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: 1, 
                p: spacing,
                bgcolor: 'rgba(139, 92, 246, 0.05)',
              }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600, mb: 1.5, display: 'block', fontSize: fontSize.caption }}>
                  Topptekst (Header)
                </Typography>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      label="Logo URL"
                      value={headerLogoUrl}
                      onChange={(e) => setHeaderLogoUrl(e.target.value)}
                      size="small"
                      fullWidth
                      placeholder="https://example.com/logo.png"
                      helperText="Lim inn URL eller last opp bilde"
                      sx={{ 
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                          '&.Mui-focused fieldset': { borderColor: BRAND_COLORS.primary },
                        },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                        '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.87)' },
                      }}
                    />
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      style={{ display: 'none' }}
                      onChange={handleLogoUpload}
                    />
                    <Tooltip title="Last opp logo">
                      <IconButton
                        onClick={() => logoInputRef.current?.click()}
                        disabled={logoUploading}
                        sx={{ 
                          mt: 0.5,
                          color: BRAND_COLORS.primary,
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          '&:hover': { 
                            bgcolor: 'rgba(139, 92, 246, 0.1)',
                            borderColor: BRAND_COLORS.primary,
                          },
                          '&.Mui-disabled': {
                            color: 'rgba(255,255,255,0.87)',
                          },
                        }}
                      >
                        {logoUploading ? (
                          <CircularProgress size={20} sx={{ color: BRAND_COLORS.primary }} />
                        ) : (
                          <UploadIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <TextField
                    label="Slagord / Tagline"
                    value={headerTagline}
                    onChange={(e) => setHeaderTagline(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="Profesjonell Casting Management"
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                        '&.Mui-focused fieldset': { borderColor: BRAND_COLORS.primary },
                      },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    }}
                  />
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => {
                      setHeaderLogoUrl(CASTING_PLANNER_LOGO_URL);
                      setHeaderTagline('Profesjonell Casting Management');
                    }}
                    sx={{ 
                      color: 'rgba(255,255,255,0.87)', 
                      alignSelf: 'flex-start',
                      minHeight: buttonMinHeight,
                      fontSize: fontSize.button,
                      '&:hover': { color: BRAND_COLORS.primary },
                    }}
                  >
                    Tilbakestill til standard
                  </Button>
                </Stack>
              </Box>
              )}
            </Stack>
          </Box>

          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5,
            p: 1,
            bgcolor: 'rgba(0,0,0,0.3)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            flexWrap: 'wrap',
          }}>
            <Tooltip title="Fet">
              <IconButton
                onClick={() => editor?.chain().focus().toggleBold().run()}
                sx={{ ...toolbarButtonStyle, ...(editor?.isActive('bold') && toolbarButtonStyle['&.active']) }}
              >
                <BoldIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Kursiv">
              <IconButton
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                sx={{ ...toolbarButtonStyle, ...(editor?.isActive('italic') && toolbarButtonStyle['&.active']) }}
              >
                <ItalicIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Gjennomstreking">
              <IconButton
                onClick={() => editor?.chain().focus().toggleStrike().run()}
                sx={{ ...toolbarButtonStyle, ...(editor?.isActive('strike') && toolbarButtonStyle['&.active']) }}
              >
                <StrikeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.2)' }} />
            
            <Tooltip title="Punktliste">
              <IconButton
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                sx={{ ...toolbarButtonStyle, ...(editor?.isActive('bulletList') && toolbarButtonStyle['&.active']) }}
              >
                <BulletListIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Nummerert liste">
              <IconButton
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                sx={{ ...toolbarButtonStyle, ...(editor?.isActive('orderedList') && toolbarButtonStyle['&.active']) }}
              >
                <NumberListIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.2)' }} />
            
            <Tooltip title="Angre">
              <IconButton
                onClick={() => editor?.chain().focus().undo().run()}
                disabled={!editor?.can().undo()}
                sx={toolbarButtonStyle}
              >
                <UndoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Gjør om">
              <IconButton
                onClick={() => editor?.chain().focus().redo().run()}
                disabled={!editor?.can().redo()}
                sx={toolbarButtonStyle}
              >
                <RedoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.2)' }} />
            
            <Tooltip title="Sett inn variabel">
              <Button
                startIcon={<VariableIcon />}
                onClick={(e: MouseEvent<HTMLButtonElement>) => setVariableMenuAnchor(e.currentTarget)}
                size="small"
                sx={{ 
                  color: 'rgba(255,255,255,0.87)',
                  '&:hover': { color: BRAND_COLORS.primary }
                }}
              >
                Variabel
              </Button>
            </Tooltip>
            
            <Box sx={{ flex: 1 }} />
            
            {isMobile && (
              <Tooltip title={showPreview ? 'Skjul forhåndsvisning' : 'Vis forhåndsvisning'}>
                <IconButton
                  onClick={() => setShowPreview(!showPreview)}
                  sx={{ 
                    ...toolbarButtonStyle, 
                    ...(showPreview && toolbarButtonStyle['&.active']) 
                  }}
                >
                  <PreviewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <Box sx={{ 
            flex: 1, 
            overflow: 'auto',
            p: 2,
            '& .ProseMirror': {
              outline: 'none',
              minHeight: 200,
              color: '#fff',
              fontSize: '15px',
              lineHeight: 1.6,
              '& p': { margin: '0 0 12px 0' },
              '& ul, & ol': { paddingLeft: 24, margin: '0 0 12px 0' },
              '& li': { marginBottom: 4 },
              '& .is-empty::before': {
                content: 'attr(data-placeholder)',
                color: 'rgba(255,255,255,0.87)',
                float: 'left',
                height: 0,
                pointerEvents: 'none',
              },
            },
          }}>
            <EditorContent editor={editor} />
          </Box>
        </Box>

        <Collapse 
          in={showPreview} 
          orientation={isMobile ? 'vertical' : 'horizontal'}
          sx={{ 
            flex: showPreview ? 1 : 0,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ 
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              p: 1.5,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
              <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Forhåndsvisning
              </Typography>
              <ToggleButtonGroup
                value={previewMode}
                exclusive
                onChange={(_, value) => value && setPreviewMode(value)}
                size="small"
              >
                <ToggleButton value="desktop" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  <Tooltip title="Desktop">
                    <DesktopIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="mobile" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  <Tooltip title="Mobil">
                    <MobileIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            
            <Box sx={{ 
              flex: 1, 
              overflow: 'auto',
              p: 2,
              bgcolor: '#1c2128',
              display: 'flex',
              justifyContent: 'center',
            }}>
              <Box
                sx={{
                  width: previewMode === 'mobile' ? 375 : 600,
                  maxWidth: '100%',
                  bgcolor: '#f5f5f5',
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              >
                <iframe
                  srcDoc={previewHTML}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 500,
                    border: 'none',
                  }}
                  title="E-post forhåndsvisning"
                />
              </Box>
            </Box>
          </Box>
        </Collapse>
      </Box>

      <Menu
        anchorEl={variableMenuAnchor}
        open={Boolean(variableMenuAnchor)}
        onClose={() => setVariableMenuAnchor(null)}
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            maxHeight: 500,
            minWidth: 350,
          }
        }}
      >
        {/* Project Source Header */}
        <Box sx={{ 
          px: 2, 
          py: 1.5, 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          bgcolor: 'rgba(139, 92, 246, 0.1)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderIcon sx={{ fontSize: 18, color: BRAND_COLORS.primary }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 500 }}>
              Datakilde:
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND_COLORS.primary, mt: 0.5 }}>
            {projectName}
          </Typography>
        </Box>
        
        {AVAILABLE_VARIABLES.map((variable) => {
          const currentValue = projectVariables[variable.key];
          const hasValue = currentValue && currentValue.trim() !== '';
          
          return (
            <MenuItem 
              key={variable.key}
              onClick={() => insertVariable(variable.key)}
              sx={{ 
                '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.1)' },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                py: 1.5,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND_COLORS.primary }}>
                  {`{{${variable.key}}}`}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  {variable.label}
                </Typography>
              </Box>
              
              {/* Value from project or missing indicator */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1, 
                mt: 0.5,
                width: '100%',
              }}>
                {hasValue ? (
                  <>
                    <Chip
                      size="small"
                      label="Fra prosjekt"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        bgcolor: 'rgba(34, 197, 94, 0.15)',
                        color: '#22c55e',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                      }}
                    />
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: '#22c55e',
                        fontStyle: 'italic',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 180,
                      }}
                    >
                      "{currentValue}"
                    </Typography>
                  </>
                ) : (
                  <>
                    <Chip
                      size="small"
                      label="Mangler i prosjektdata"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        bgcolor: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                      }}
                    />
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'rgba(255,255,255,0.87)',
                        fontStyle: 'italic',
                      }}
                    >
                      Eks: {variable.example}
                    </Typography>
                  </>
                )}
              </Box>
            </MenuItem>
          );
        })}
      </Menu>

      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon sx={{ color: BRAND_COLORS.primary }} />
          Versjonshistorikk
          <IconButton
            onClick={() => setHistoryDialogOpen(false)}
            sx={{ ml: 'auto', color: 'rgba(255,255,255,0.87)' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {versions.length === 0 ? (
            <Typography sx={{ color: 'rgba(255,255,255,0.87)', textAlign: 'center', py: 4 }}>
              Ingen lagrede versjoner ennå. Versjoner lagres automatisk hvert 30. sekund.
            </Typography>
          ) : (
            <List>
              {[...versions].reverse().map((version, index) => (
                <ListItem
                  key={version.id}
                  disablePadding
                  sx={{ mb: 1 }}
                >
                  <ListItemButton
                    onClick={() => restoreVersion(version)}
                    sx={{
                      borderRadius: 1,
                      border: '1px solid rgba(255,255,255,0.1)',
                      '&:hover': { bgcolor: 'rgba(233,30,99,0.1)' },
                    }}
                  >
                    <ListItemIcon>
                      <RestoreIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={version.subject || '(Uten emne)'}
                      secondary={version.timestamp.toLocaleString('nb-NO')}
                      primaryTypographyProps={{ sx: { color: '#fff' } }}
                      secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.87)' } }}
                    />
                    <Chip
                      label={index === 0 ? 'Nyeste' : `v${versions.length - index}`}
                      size="small"
                      sx={{ 
                        bgcolor: index === 0 ? BRAND_COLORS.primary : 'rgba(255,255,255,0.1)',
                        color: '#fff',
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={recipientDialogOpen}
        onClose={() => setRecipientDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupIcon sx={{ color: BRAND_COLORS.primary }} />
          Velg mottakere
          <IconButton
            onClick={() => setRecipientDialogOpen(false)}
            sx={{ ml: 'auto', color: 'rgba(255,255,255,0.87)' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {recipients.length === 0 ? (
            <Typography sx={{ color: 'rgba(255,255,255,0.87)', textAlign: 'center', py: 4 }}>
              Ingen mottakere tilgjengelig
            </Typography>
          ) : (
            <List>
              {recipients.map((recipient) => (
                <ListItem
                  key={recipient.id}
                  disablePadding
                  sx={{ mb: 1 }}
                >
                  <ListItemButton
                    onClick={() => {
                      setSelectedRecipients(prev => 
                        prev.includes(recipient.id)
                          ? prev.filter(id => id !== recipient.id)
                          : [...prev, recipient.id]
                      );
                    }}
                    sx={{
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: selectedRecipients.includes(recipient.id) 
                        ? BRAND_COLORS.primary 
                        : 'rgba(255,255,255,0.1)',
                      bgcolor: selectedRecipients.includes(recipient.id)
                        ? 'rgba(233,30,99,0.1)'
                        : 'transparent',
                      '&:hover': { bgcolor: 'rgba(233,30,99,0.1)' },
                    }}
                  >
                    <ListItemIcon>
                      <PersonIcon sx={{ 
                        color: selectedRecipients.includes(recipient.id)
                          ? BRAND_COLORS.primary
                          : 'rgba(255,255,255,0.5)'
                      }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={recipient.name}
                      secondary={`${recipient.email}${recipient.role ? ` • ${recipient.role}` : ''}`}
                      primaryTypographyProps={{ sx: { color: '#fff' } }}
                      secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.87)' } }}
                    />
                    {selectedRecipients.includes(recipient.id) && (
                      <CheckIcon sx={{ color: BRAND_COLORS.primary }} />
                    )}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="body2" sx={{ flex: 1, color: 'rgba(255,255,255,0.87)' }}>
            {selectedRecipients.length} valgt
          </Typography>
          <Button
            onClick={() => setRecipientDialogOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.87)' }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => {
              setRecipientDialogOpen(false);
              handleSend();
            }}
            disabled={selectedRecipients.length === 0}
            sx={{ 
              bgcolor: BRAND_COLORS.primary,
              '&:hover': { bgcolor: BRAND_COLORS.accent }
            }}
          >
            Send e-post
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={sendOptionsDialogOpen}
        onClose={() => setSendOptionsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SendIcon sx={{ color: BRAND_COLORS.primary }} />
          Send e-post
          <IconButton
            onClick={() => setSendOptionsDialogOpen(false)}
            sx={{ ml: 'auto', color: 'rgba(255,255,255,0.87)' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3 }}>
            Velg hvordan du vil sende e-posten. For å beholde designet, bruk HTML-alternativet.
          </Typography>
          
          <Stack spacing={2}>
            {/* Recommended: HTML option first */}
            <Paper
              sx={{
                p: 2,
                bgcolor: 'rgba(139,92,246,0.1)',
                border: '2px solid',
                borderColor: BRAND_COLORS.primary,
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                '&:hover': {
                  bgcolor: 'rgba(139,92,246,0.15)',
                },
              }}
              onClick={handleCopyHtmlToClipboard}
            >
              <Chip 
                label="Anbefalt" 
                size="small" 
                sx={{ 
                  position: 'absolute', 
                  top: -10, 
                  right: 16, 
                  bgcolor: BRAND_COLORS.primary,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                }} 
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: 'rgba(139,92,246,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CodeIcon sx={{ color: BRAND_COLORS.primary, fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
                    Kopier med design (HTML)
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Beholder logo, farger og formatering. Lim inn i e-postklient som støtter HTML.
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Paper
              sx={{
                p: 2,
                bgcolor: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: BRAND_COLORS.primary,
                  bgcolor: 'rgba(139,92,246,0.1)',
                },
              }}
              onClick={() => handleOpenMailto()}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: 'rgba(139,92,246,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MailOutlineIcon sx={{ color: BRAND_COLORS.primary, fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
                    Åpne i e-postklient
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Kun ren tekst (uten design) - standard mailto-begrensning
                  </Typography>
                </Box>
                <OpenInNewIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
              </Box>
            </Paper>

            <Paper
              sx={{
                p: 2,
                bgcolor: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: BRAND_COLORS.primary,
                  bgcolor: 'rgba(139,92,246,0.1)',
                },
              }}
              onClick={handleCopyToClipboard}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: 'rgba(99,102,241,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CopyIcon sx={{ color: BRAND_COLORS.secondary, fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
                    Kopier kun tekst
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    Ren tekst uten formatering
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {recipients.length > 0 && (
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: BRAND_COLORS.primary,
                    bgcolor: 'rgba(139,92,246,0.1)',
                  },
                }}
                onClick={() => {
                  setSendOptionsDialogOpen(false);
                  setRecipientDialogOpen(true);
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: 'rgba(16,185,129,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GroupIcon sx={{ color: '#10b981', fontSize: 28 }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
                      Send til kandidater/team
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      Velg fra {recipients.length} registrerte mottakere
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export { DEFAULT_TEMPLATES, AVAILABLE_VARIABLES, BRAND_COLORS };
export type { EmailTemplate, EmailVersion, Recipient };
