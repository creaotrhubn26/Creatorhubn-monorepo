import { useState, useEffect, useMemo, type ReactNode, type SyntheticEvent } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import { EmailDesigner, EmailTemplate as DesignerEmailTemplate } from './EmailDesigner';
import {
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  Close as CloseIcon,
  VpnKey as VpnKeyIcon,
  People as PeopleIcon,
  Email as EmailIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Send as SendIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Movie as MovieIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Palette as PaletteIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon } from './icons/CastingIcons';
import {
  type BrandingSettings,
  DEFAULT_BRANDING_SETTINGS,
  fetchBrandingSettings,
  getBrandingSettings,
  saveBrandingSettings,
  updateBrandingSettings,
} from '../config/branding';
import { useBrandingSettings } from '../hooks/useBrandingSettings.ts';

interface AdminUser {
  id: number;
  email: string;
  role: string;
  display_name: string;
  created_at: string;
  last_login: string | null;
  is_active: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
  type: 'invitation' | 'callback' | 'confirmation' | 'rejection' | 'reminder' | 'custom' | 'owner_invitation' | 'owner_welcome' | 'owner_transfer';
  subject: string;
  body: string;
  variables: string[];
}

interface AdminDashboardProps {
  open: boolean;
  onClose: () => void;
  projectName?: string;
}

const API_BASE = '/api/auth';

const buildDefaultTemplates = (appName: string): EmailTemplate[] => [
  {
    id: 'casting-invitation',
    name: 'Casting Invitasjon',
    type: 'invitation',
    subject: 'Du er invitert til casting for {{projectName}}',
    body: `Hei {{candidateName}},

Vi er glade for å invitere deg til casting for vår kommende produksjon "{{projectName}}".

<strong>Detaljer:</strong>
📅 Dato: {{auditionDate}}
⏰ Tid: {{auditionTime}}
📍 Sted: {{location}}
🎬 Rolle: {{roleName}}

Vennligst bekreft din deltagelse ved å svare på denne e-posten innen {{responseDeadline}}.

Ta med deg:
• Gyldig ID
• Oppdaterte bilder (hode og helfigur)
• Relevant portfolio/showreel

Vi ser frem til å møte deg!

Med vennlig hilsen,
{{senderName}}
{{companyName}}
{{contactPhone}}`,
    variables: ['candidateName', 'projectName', 'auditionDate', 'auditionTime', 'location', 'roleName', 'responseDeadline', 'senderName', 'companyName', 'contactPhone'],
  },
  {
    id: 'callback',
    name: 'Callback Invitasjon',
    type: 'callback',
    subject: 'Callback invitasjon - {{projectName}}',
    body: `Hei {{candidateName}},

Gratulerer! Du har blitt valgt ut til callback for "{{projectName}}".

<strong>Callback detaljer:</strong>
📅 Dato: {{callbackDate}}
⏰ Tid: {{callbackTime}}
📍 Sted: {{location}}
🎬 Rolle: {{roleName}}

<strong>Forberedelser:</strong>
{{preparationNotes}}

Vennligst bekreft din deltagelse så snart som mulig.

Med vennlig hilsen,
{{senderName}}
{{companyName}}`,
    variables: ['candidateName', 'projectName', 'callbackDate', 'callbackTime', 'location', 'roleName', 'preparationNotes', 'senderName', 'companyName'],
  },
  {
    id: 'confirmation',
    name: 'Rollebekreftelse',
    type: 'confirmation',
    subject: '🎉 Gratulerer! Du har fått rollen i {{projectName}}',
    body: `Hei {{candidateName}},

Vi er utrolig glade for å kunne meddele at du har fått rollen som <strong>{{roleName}}</strong> i "{{projectName}}"!

<strong>Neste steg:</strong>
1. Signering av kontrakt
2. Kostymemøte
3. Leseprøve med resten av ensemblet

<strong>Produksjonsdetaljer:</strong>
📅 Oppstart: {{productionStartDate}}
📍 Hovedlokasjon: {{mainLocation}}
📋 Estimert varighet: {{productionDuration}}

Velkommen til teamet!

Med vennlig hilsen,
{{senderName}}
{{companyName}}`,
    variables: ['candidateName', 'projectName', 'roleName', 'productionStartDate', 'mainLocation', 'productionDuration', 'senderName', 'companyName'],
  },
  {
    id: 'rejection',
    name: 'Høflig Avslag',
    type: 'rejection',
    subject: 'Angående din søknad til {{projectName}}',
    body: `Hei {{candidateName}},

Takk for at du deltok på casting for "{{projectName}}". Vi satte stor pris på tiden din og innsatsen du la ned.

Etter nøye vurdering har vi dessverre valgt å gå videre med andre kandidater for rollen som {{roleName}}.

Vi ønsker deg all lykke videre i karrieren!

Med vennlig hilsen,
{{senderName}}
{{companyName}}`,
    variables: ['candidateName', 'projectName', 'roleName', 'senderName', 'companyName'],
  },
  {
    id: 'reminder',
    name: 'Påminnelse',
    type: 'reminder',
    subject: 'Påminnelse: Casting i morgen - {{projectName}}',
    body: `Hei {{candidateName}},

Dette er en vennlig påminnelse om din casting i morgen.

<strong>Detaljer:</strong>
📅 Dato: {{auditionDate}}
⏰ Tid: {{auditionTime}}
📍 Sted: {{location}}
🎬 Rolle: {{roleName}}

Lykke til!

Med vennlig hilsen,
{{senderName}}
{{companyName}}`,
    variables: ['candidateName', 'projectName', 'auditionDate', 'auditionTime', 'location', 'roleName', 'senderName', 'companyName'],
  },
  {
    id: 'owner-invitation',
    name: 'Eier Invitasjon',
    type: 'owner_invitation',
    subject: 'Du er invitert som Eier av {{companyName}}',
    body: `Hei {{ownerName}},

Du har blitt invitert til å bli <strong>Eier</strong> av {{companyName}} på ${appName}.

Som eier får du full tilgang til:
🔐 Alle administrative funksjoner
👥 Brukeradministrasjon
📊 Fullstendig oversikt over alle prosjekter
💼 Fakturering og abonnement
⚙️ Systeminnstillinger

<strong>For å aktivere kontoen din:</strong>
1. Klikk på lenken under
2. Opprett et sikkert passord
3. Logg inn og ta kontroll

🔗 Aktiveringslenke: {{activationLink}}

Denne invitasjonen utløper om 7 dager.

Med vennlig hilsen,
{{senderName}}
{{companyName}}`,
    variables: ['ownerName', 'companyName', 'activationLink', 'senderName'],
  },
  {
    id: 'owner-welcome',
    name: 'Eier Velkomstmelding',
    type: 'owner_welcome',
    subject: 'Velkommen som Eier av {{companyName}} - Kom i gang',
    body: `Hei {{ownerName}},

<strong>Velkommen som Eier av {{companyName}}!</strong> 🎉

Din konto er nå aktivert og du har full tilgang til alle funksjoner.

<strong>Her er hvordan du kommer i gang:</strong>

📋 <strong>Steg 1: Sett opp teamet ditt</strong>
Inviter administratorer og teammedlemmer via Admin-panelet.

🎬 <strong>Steg 2: Opprett ditt første prosjekt</strong>
Start en ny produksjon og legg til roller.

📧 <strong>Steg 3: Tilpass e-postmaler</strong>
Gjør kommunikasjonen personlig med dine egne maler.

<strong>Viktig informasjon:</strong>
• Brukernavn: {{ownerEmail}}
• Support: {{supportEmail}}
• Dokumentasjon: {{docsLink}}

Har du spørsmål? Vi er her for å hjelpe!

Med vennlig hilsen,
{{senderName}}
${appName} Team`,
    variables: ['ownerName', 'companyName', 'ownerEmail', 'supportEmail', 'docsLink', 'senderName'],
  },
  {
    id: 'owner-transfer',
    name: 'Overføring av Eierskap',
    type: 'owner_transfer',
    subject: 'Viktig: Overføring av eierskap for {{companyName}}',
    body: `Hei {{newOwnerName}},

<strong>Du har blitt utnevnt som ny Eier av {{companyName}}.</strong>

{{previousOwnerName}} har overført eierskapet til deg. Dette gir deg full kontroll over:

🔐 <strong>Administrative rettigheter</strong>
• Legge til/fjerne alle brukere inkludert administratorer
• Endre abonnement og faktureringsdetaljer
• Slette eller overføre selskapet

📊 <strong>Full datatilgang</strong>
• Alle prosjekter og produksjoner
• Kandidatdatabase
• Alle dokumenter og kontrakter

⚠️ <strong>Viktig sikkerhetsinformasjon:</strong>
• Din konto har nå høyeste tilgangsnivå
• Vi anbefaler å aktivere to-faktor-autentisering
• Gjennomgå eksisterende brukertilganger

<strong>For å bekrefte overføringen:</strong>
Klikk her: {{confirmationLink}}

Denne forespørselen utløper om 48 timer.

Med vennlig hilsen,
{{senderName}}
${appName} Sikkerhetsteam`,
    variables: ['newOwnerName', 'companyName', 'previousOwnerName', 'confirmationLink', 'senderName'],
  },
];

const templateTypeConfig: Record<string, { label: string; color: string; icon: ReactNode }> = {
  invitation: { label: 'Invitasjon', color: '#00d4ff', icon: <EmailIcon /> },
  callback: { label: 'Callback', color: '#8b5cf6', icon: <ScheduleIcon /> },
  confirmation: { label: 'Bekreftelse', color: '#10b981', icon: <CheckCircleIcon /> },
  rejection: { label: 'Avslag', color: '#ef4444', icon: <CancelIcon /> },
  reminder: { label: 'Påminnelse', color: '#f59e0b', icon: <CalendarIcon /> },
  custom: { label: 'Egendefinert', color: '#6b7280', icon: <EditIcon /> },
  owner_invitation: { label: 'Eier Invitasjon', color: '#ef4444', icon: <AdminPanelSettingsIcon /> },
  owner_welcome: { label: 'Eier Velkomst', color: '#ef4444', icon: <AdminPanelSettingsIcon /> },
  owner_transfer: { label: 'Eieroverføring', color: '#ef4444', icon: <VpnKeyIcon /> },
};

const variableConfig: Record<string, { label: string; icon: ReactNode; example: string }> = {
  candidateName: { label: 'Kandidatnavn', icon: <PersonIcon />, example: 'Ola Nordmann' },
  projectName: { label: 'Prosjektnavn', icon: <MovieIcon />, example: 'Sommerfilmen 2026' },
  roleName: { label: 'Rollenavn', icon: <PersonIcon />, example: 'Hovedrolle' },
  auditionDate: { label: 'Audition dato', icon: <CalendarIcon />, example: '15. januar 2026' },
  auditionTime: { label: 'Audition tid', icon: <TimeIcon />, example: '14:00' },
  callbackDate: { label: 'Callback dato', icon: <CalendarIcon />, example: '20. januar 2026' },
  callbackTime: { label: 'Callback tid', icon: <TimeIcon />, example: '10:00' },
  location: { label: 'Lokasjon', icon: <LocationIcon />, example: 'Studio A, Filmens Hus' },
  mainLocation: { label: 'Hovedlokasjon', icon: <LocationIcon />, example: 'Bergen Filmstudio' },
  responseDeadline: { label: 'Svarfrist', icon: <CalendarIcon />, example: '10. januar 2026' },
  productionStartDate: { label: 'Produksjonsstart', icon: <CalendarIcon />, example: '1. februar 2026' },
  productionDuration: { label: 'Produksjonsvarighet', icon: <TimeIcon />, example: '8 uker' },
  preparationNotes: { label: 'Forberedelsesnotater', icon: <EditIcon />, example: 'Lær de første 5 sidene av manuset' },
  senderName: { label: 'Avsendernavn', icon: <PersonIcon />, example: 'Maria Hansen' },
  companyName: { label: 'Selskapsnavn', icon: <BusinessIcon />, example: 'CreatorHub Productions' },
  contactEmail: { label: 'Kontakt e-post', icon: <EmailIcon />, example: 'casting@creatorhub.no' },
  contactPhone: { label: 'Kontakt telefon', icon: <PhoneIcon />, example: '+47 123 45 678' },
  ownerName: { label: 'Eiernavn', icon: <AdminPanelSettingsIcon />, example: 'Erik Johansen' },
  ownerEmail: { label: 'Eier e-post', icon: <EmailIcon />, example: 'eier@creatorhub.no' },
  activationLink: { label: 'Aktiveringslenke', icon: <VpnKeyIcon />, example: 'https://casting.app/activate/abc123' },
  newOwnerName: { label: 'Ny eiernavn', icon: <AdminPanelSettingsIcon />, example: 'Kari Olsen' },
  previousOwnerName: { label: 'Tidligere eier', icon: <PersonIcon />, example: 'Erik Johansen' },
  confirmationLink: { label: 'Bekreftelseslenke', icon: <VpnKeyIcon />, example: 'https://casting.app/confirm/xyz789' },
  supportEmail: { label: 'Support e-post', icon: <EmailIcon />, example: 'support@theroleroom.com' },
  docsLink: { label: 'Dokumentasjon', icon: <EditIcon />, example: 'https://docs.theroleroom.com' },
};

export default function AdminDashboard({ open, onClose, projectName = 'Mitt Prosjekt' }: AdminDashboardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width:599px)');
  const isTablet = useMediaQuery('(min-width:600px) and (max-width:959px)');
  const is720p = useMediaQuery('(min-width:960px) and (max-width:1279px)');
  const is1080p = useMediaQuery('(min-width:1280px) and (max-width:1919px)');
  const is2K = useMediaQuery('(min-width:1920px) and (max-width:2559px)');
  const is4K = useMediaQuery('(min-width:2560px)');

  const getResponsiveValue = <T,>(mobile: T, tablet: T, hd720: T, hd1080: T, qhd2k: T, uhd4k: T): T => {
    if (isMobile) return mobile;
    if (isTablet) return tablet;
    if (is720p) return hd720;
    if (is1080p) return hd1080;
    if (is2K) return qhd2k;
    return uhd4k;
  };

  const buttonMinHeight = getResponsiveValue(44, 44, 40, 42, 48, 56);
  const iconButtonSize = getResponsiveValue(44, 44, 36, 40, 48, 56);
  const fontSize = {
    title: getResponsiveValue('1rem', '1.1rem', '1.15rem', '1.25rem', '1.5rem', '1.75rem'),
    subtitle: getResponsiveValue('0.8rem', '0.85rem', '0.875rem', '0.9rem', '1rem', '1.15rem'),
    body: getResponsiveValue('0.875rem', '0.9rem', '0.95rem', '1rem', '1.1rem', '1.25rem'),
    caption: getResponsiveValue('0.7rem', '0.75rem', '0.8rem', '0.85rem', '0.95rem', '1.1rem'),
    button: getResponsiveValue('0.75rem', '0.8rem', '0.85rem', '0.9rem', '1rem', '1.15rem'),
  };
  const spacing = getResponsiveValue(1.5, 2, 2, 2.5, 3, 4);
  const chipHeight = getResponsiveValue(24, 26, 26, 28, 32, 38);
  const iconSize = getResponsiveValue(18, 20, 20, 22, 26, 30);

  const branding = useBrandingSettings();
  const defaultTemplates = useMemo(
    () => buildDefaultTemplates(branding.appName),
    [branding.appName]
  );

  const [mainTab, setMainTab] = useState(0);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [templates, setTemplates] = useState<EmailTemplate[]>(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(defaultTemplates[0] ?? null);
  const [emailTabValue, setEmailTabValue] = useState(0);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editName, setEditName] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({
    candidateName: 'Kandidatnavn',
    projectName: projectName,
    roleName: 'Hovedrolle',
    auditionDate: '15. januar 2026',
    auditionTime: '14:00',
    callbackDate: '20. januar 2026',
    callbackTime: '10:00',
    location: 'Studio A, Filmens Hus',
    mainLocation: 'Bergen Filmstudio',
    responseDeadline: '10. januar 2026',
    productionStartDate: '1. februar 2026',
    productionDuration: '8 uker',
    preparationNotes: 'Lær de første 5 sidene av manuset',
    senderName: 'Casting Team',
    companyName: 'CreatorHub Productions',
    contactEmail: 'casting@creatorhub.no',
    contactPhone: '+47 123 45 678',
    ownerName: 'Erik Johansen',
    ownerEmail: 'eier@creatorhub.no',
    activationLink: 'https://casting.app/activate/abc123',
    newOwnerName: 'Kari Olsen',
    previousOwnerName: 'Erik Johansen',
    confirmationLink: 'https://casting.app/confirm/xyz789',
    supportEmail: 'support@theroleroom.com',
    docsLink: 'https://docs.theroleroom.com',
  });
  const [brandingForm, setBrandingForm] = useState(getBrandingSettings());

  useEffect(() => {
    if (!open) return;
    loadAdmins();
    fetchBrandingSettings()
      .then((remote) => {
        if (remote) {
          saveBrandingSettings(remote);
          setBrandingForm(remote);
        } else {
          setBrandingForm(getBrandingSettings());
        }
      })
      .catch(() => setBrandingForm(getBrandingSettings()));
  }, [open]);

  useEffect(() => {
    if (selectedTemplate) {
      setEditSubject(selectedTemplate.subject);
      setEditBody(selectedTemplate.body);
      setEditName(selectedTemplate.name);
    }
  }, [selectedTemplate]);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admins`);
      const data = await response.json();
      if (data.success) {
        setAdmins(data.admins);
      }
    } catch (error) {
      console.error('Failed to load admins:', error);
      setSnackbar({ open: true, message: 'Kunne ikke laste administratorer', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteAdmin = async () => {
    if (!newEmail.trim()) {
      setSnackbar({ open: true, message: 'E-post er påkrevd', severity: 'error' });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim(),
          role: newRole,
          display_name: newDisplayName.trim() || undefined,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setGeneratedPassword(data.generated_password);
        setShowPasswordDialog(true);
        setInviteDialogOpen(false);
        setNewEmail('');
        setNewDisplayName('');
        setNewRole('admin');
        loadAdmins();
        setSnackbar({ open: true, message: 'Administrator opprettet', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: data.detail || 'Kunne ikke opprette administrator', severity: 'error' });
      }
    } catch (error) {
      console.error('Failed to create admin:', error);
      setSnackbar({ open: true, message: 'Nettverksfeil', severity: 'error' });
    }
  };

  const handleDeleteAdmin = async (adminId: number) => {
    if (!confirm('Er du sikker på at du vil slette denne administratoren?')) return;

    try {
      const response = await fetch(`${API_BASE}/admins/${adminId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadAdmins();
        setSnackbar({ open: true, message: 'Administrator slettet', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: 'Kunne ikke slette administrator', severity: 'error' });
      }
    } catch (error) {
      console.error('Failed to delete admin:', error);
      setSnackbar({ open: true, message: 'Nettverksfeil', severity: 'error' });
    }
  };

  const handleResetPassword = async (adminId: number) => {
    try {
      const response = await fetch(`${API_BASE}/admins/${adminId}/reset-password`, {
        method: 'POST',
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setGeneratedPassword(data.new_password);
        setShowPasswordDialog(true);
        setSnackbar({ open: true, message: 'Passord tilbakestilt', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: 'Kunne ikke tilbakestille passord', severity: 'error' });
      }
    } catch (error) {
      console.error('Failed to reset password:', error);
      setSnackbar({ open: true, message: 'Nettverksfeil', severity: 'error' });
    }
  };

  const handleBrandingSave = async () => {
    try {
      const updated = await updateBrandingSettings(brandingForm);
      saveBrandingSettings(updated);
      setBrandingForm(updated);
      setSnackbar({ open: true, message: 'Branding oppdatert', severity: 'success' });
    } catch (error) {
      console.error('Failed to update branding:', error);
      setSnackbar({ open: true, message: 'Kunne ikke oppdatere branding', severity: 'error' });
    }
  };

  const handleBrandingReset = async () => {
    try {
      const updated = await updateBrandingSettings(DEFAULT_BRANDING_SETTINGS);
      saveBrandingSettings(updated);
      setBrandingForm(updated);
      setSnackbar({ open: true, message: 'Branding nullstilt', severity: 'success' });
    } catch (error) {
      console.error('Failed to reset branding:', error);
      setSnackbar({ open: true, message: 'Kunne ikke nullstille branding', severity: 'error' });
    }
  };

  const updateBrandingIdentity = (key: keyof BrandingSettings['identity'], value: string) => {
    setBrandingForm((prev) => ({
      ...prev,
      identity: { ...prev.identity, [key]: value },
      [key]: value,
    }));
  };

  const updateBrandingColor = (key: keyof BrandingSettings['colors'], value: string) => {
    setBrandingForm((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
  };

  const updateBrandingTypography = (key: keyof BrandingSettings['typography'], value: number | string) => {
    setBrandingForm((prev) => ({
      ...prev,
      typography: { ...prev.typography, [key]: value },
    }));
  };

  const updateBrandingLayout = (key: keyof BrandingSettings['layout'], value: number | string) => {
    setBrandingForm((prev) => ({
      ...prev,
      layout: { ...prev.layout, [key]: value },
    }));
  };

  const updateBrandingToken = (key: keyof BrandingSettings['tokens']['labels'], value: string) => {
    setBrandingForm((prev) => ({
      ...prev,
      tokens: {
        ...prev.tokens,
        labels: { ...prev.tokens.labels, [key]: value },
      },
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: 'Kopiert til utklippstavle', severity: 'success' });
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: 'Eier',
      admin: 'Administrator',
      editor: 'Redaktør',
      viewer: 'Leser',
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: string): string => {
    const colors: Record<string, string> = {
      owner: '#ef4444',
      admin: '#8b5cf6',
      editor: '#00d4ff',
      viewer: '#6b7280',
    };
    return colors[role] || '#6b7280';
  };

  const replaceVariables = (text: string): string => {
    let result = text;
    Object.entries(variableValues).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });
    return result;
  };

  const handleSaveTemplate = () => {
    if (!selectedTemplate) return;
    
    const updatedTemplate: EmailTemplate = {
      ...selectedTemplate,
      name: editName,
      subject: editSubject,
      body: editBody,
    };
    
    setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? updatedTemplate : t));
    setSelectedTemplate(updatedTemplate);
    setSnackbar({ open: true, message: 'Mal lagret', severity: 'success' });
  };

  const handleCreateTemplate = () => {
    const newTemplate: EmailTemplate = {
      id: `custom-${Date.now()}`,
      name: 'Ny mal',
      type: 'custom',
      subject: 'Emne',
      body: 'Skriv din e-post her...',
      variables: [],
    };
    setTemplates(prev => [...prev, newTemplate]);
    setSelectedTemplate(newTemplate);
  };

  const insertVariable = (variable: string) => {
    setEditBody(prev => prev + `{{${variable}}}`);
  };

  const handleCopyEmail = () => {
    const processedBody = replaceVariables(selectedTemplate?.body || '');
    const plainText = processedBody.replace(/<[^>]*>/g, '');
    navigator.clipboard.writeText(plainText);
    setSnackbar({ open: true, message: 'E-post kopiert til utklippstavle', severity: 'success' });
  };

  const inputStyles = {
    '& .MuiOutlinedInput-root': {
      bgcolor: 'rgba(255,255,255,0.03)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
    '& .MuiInputBase-input': { color: '#fff' },
  };

  const colorFields: Array<{ key: keyof BrandingSettings['colors']; label: string }> = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'accent', label: 'Accent' },
    { key: 'info', label: 'Info' },
    { key: 'success', label: 'Success' },
    { key: 'warning', label: 'Warning' },
    { key: 'error', label: 'Error' },
    { key: 'background', label: 'Background' },
    { key: 'surface', label: 'Surface' },
    { key: 'textPrimary', label: 'Text Primary' },
    { key: 'textSecondary', label: 'Text Secondary' },
    { key: 'border', label: 'Border' },
    { key: 'gradientStart', label: 'Gradient Start' },
    { key: 'gradientEnd', label: 'Gradient End' },
  ];

  const typographyFields: Array<{
    key: keyof BrandingSettings['typography'];
    label: string;
    type?: 'text' | 'number';
  }> = [
    { key: 'headingFont', label: 'Heading Font' },
    { key: 'bodyFont', label: 'Body Font' },
    { key: 'monoFont', label: 'Mono Font' },
    { key: 'baseFontSize', label: 'Base Font Size', type: 'number' },
    { key: 'headingWeight', label: 'Heading Weight', type: 'number' },
    { key: 'bodyWeight', label: 'Body Weight', type: 'number' },
    { key: 'letterSpacing', label: 'Letter Spacing', type: 'number' },
  ];

  const layoutFields: Array<{
    key: keyof BrandingSettings['layout'];
    label: string;
    type?: 'text' | 'number';
  }> = [
    { key: 'radiusSm', label: 'Radius Small', type: 'number' },
    { key: 'radiusMd', label: 'Radius Medium', type: 'number' },
    { key: 'radiusLg', label: 'Radius Large', type: 'number' },
    { key: 'shadowSoft', label: 'Shadow Soft' },
    { key: 'shadowStrong', label: 'Shadow Strong' },
    { key: 'buttonRadius', label: 'Button Radius', type: 'number' },
    { key: 'inputRadius', label: 'Input Radius', type: 'number' },
    { key: 'cardRadius', label: 'Card Radius', type: 'number' },
  ];

  const tokenFields: Array<{ key: keyof BrandingSettings['tokens']['labels']; label: string }> = [
    { key: 'casting', label: 'Casting' },
    { key: 'roles', label: 'Roles' },
    { key: 'candidates', label: 'Candidates' },
    { key: 'auditions', label: 'Auditions' },
    { key: 'team', label: 'Team' },
    { key: 'locations', label: 'Locations' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'shotList', label: 'Shot List' },
    { key: 'callSheets', label: 'Call Sheets' },
    { key: 'projects', label: 'Projects' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'storyboard', label: 'Storyboard' },
    { key: 'sharing', label: 'Sharing' },
    { key: 'crewCalendar', label: 'Crew Calendar' },
    { key: 'overviewDescription', label: 'Overview Description' },
    { key: 'newProjectTitle', label: 'New Project Title' },
    { key: 'teamDescription', label: 'Team Description' },
    { key: 'locationsDescription', label: 'Locations Description' },
    { key: 'equipmentDescription', label: 'Equipment Description' },
    { key: 'scheduleDescription', label: 'Schedule Description' },
    { key: 'scheduleProductionLabel', label: 'Schedule Production Label' },
    { key: 'shotListDescriptionPhoto', label: 'Shot List Description Photo' },
    { key: 'shotListDescriptionVideo', label: 'Shot List Description Video' },
    { key: 'sharingDescription', label: 'Sharing Description' },
    { key: 'noProjectSelected', label: 'No Project Selected' },
    { key: 'noAccessTeam', label: 'No Access Team' },
    { key: 'noAccessLocations', label: 'No Access Locations' },
    { key: 'noAccessEquipment', label: 'No Access Equipment' },
    { key: 'noAccessSchedule', label: 'No Access Schedule' },
    { key: 'noAccessShotList', label: 'No Access Shot List' },
    { key: 'noAccessSharing', label: 'No Access Sharing' },
    { key: 'mustCreateProject', label: 'Must Create Project' },
    { key: 'needCandidateAndRole', label: 'Need Candidate and Role' },
    { key: 'assignedRolesLabel', label: 'Assigned Roles Label' },
    { key: 'consentSignedLabel', label: 'Consent Signed Label' },
    { key: 'unknownRoleLabel', label: 'Unknown Role Label' },
    { key: 'roleOwnerLabel', label: 'Role Owner Label' },
    { key: 'roleAdminLabel', label: 'Role Admin Label' },
    { key: 'roleDirectorLabel', label: 'Role Director Label' },
    { key: 'roleProducerLabel', label: 'Role Producer Label' },
    { key: 'roleCastingDirectorLabel', label: 'Role Casting Director Label' },
    { key: 'roleProductionManagerLabel', label: 'Role Production Manager Label' },
    { key: 'roleCameraTeamLabel', label: 'Role Camera Team Label' },
    { key: 'roleAgencyLabel', label: 'Role Agency Label' },
    { key: 'roleNameRequired', label: 'Role Name Required' },
    { key: 'roleSaveError', label: 'Role Save Error' },
    { key: 'confirmDeleteRole', label: 'Confirm Delete Role' },
    { key: 'roleDeleteError', label: 'Role Delete Error' },
    { key: 'candidateNameRequired', label: 'Candidate Name Required' },
    { key: 'candidateSaveError', label: 'Candidate Save Error' },
    { key: 'confirmDeleteCandidate', label: 'Confirm Delete Candidate' },
    { key: 'candidateDeleteError', label: 'Candidate Delete Error' },
    { key: 'scheduleSaveError', label: 'Schedule Save Error' },
    { key: 'confirmDeleteSchedule', label: 'Confirm Delete Schedule' },
    { key: 'scheduleDeleteError', label: 'Schedule Delete Error' },
    { key: 'activeProjectLabel', label: 'Active Project Label' },
    { key: 'editProjectAriaLabel', label: 'Edit Project Aria Label' },
    { key: 'editProjectLabel', label: 'Edit Project Label' },
    { key: 'confirmDeleteProjectWithWarning', label: 'Confirm Delete Project Warning' },
    { key: 'projectDeleteError', label: 'Project Delete Error' },
    { key: 'deleteProjectAriaLabel', label: 'Delete Project Aria Label' },
    { key: 'deleteProjectLabel', label: 'Delete Project Label' },
    { key: 'tutorialLabel', label: 'Tutorial Label' },
    { key: 'tutorialTitle', label: 'Tutorial Title' },
    { key: 'switchProfessionLabel', label: 'Switch Profession Label' },
    { key: 'editTutorialsLabel', label: 'Edit Tutorials Label' },
    { key: 'manageUsersLabel', label: 'Manage Users Label' },
    { key: 'confirmResetDemoProjects', label: 'Confirm Reset Demo Projects' },
    { key: 'demoDataResetSuccess', label: 'Demo Data Reset Success' },
    { key: 'resetDemoDataLabel', label: 'Reset Demo Data Label' },
    { key: 'showIntroLabel', label: 'Show Intro Label' },
    { key: 'showIntroTitle', label: 'Show Intro Title' },
    { key: 'logoutLabel', label: 'Logout Label' },
    { key: 'loginLabel', label: 'Login Label' },
    { key: 'rolesStatLabel', label: 'Roles Stat Label' },
    { key: 'candidatesStatLabel', label: 'Candidates Stat Label' },
    { key: 'upcomingStatLabel', label: 'Upcoming Stat Label' },
    { key: 'exitFullscreenLabel', label: 'Exit Fullscreen Label' },
    { key: 'enterFullscreenLabel', label: 'Enter Fullscreen Label' },
    { key: 'closePanelLabel', label: 'Close Panel Label' },
    { key: 'loadingLabel', label: 'Loading Label' },
    { key: 'searchCandidatesPlaceholder', label: 'Search Candidates Placeholder' },
    { key: 'candidateStatusAll', label: 'Candidate Status All' },
    { key: 'candidateStatusPending', label: 'Candidate Status Pending' },
    { key: 'candidateStatusRequested', label: 'Candidate Status Requested' },
    { key: 'candidateStatusShortlist', label: 'Candidate Status Shortlist' },
    { key: 'candidateStatusSelected', label: 'Candidate Status Selected' },
    { key: 'candidateStatusConfirmed', label: 'Candidate Status Confirmed' },
    { key: 'candidateStatusRejected', label: 'Candidate Status Rejected' },
    { key: 'listViewLabel', label: 'List View Label' },
    { key: 'kanbanViewLabel', label: 'Kanban View Label' },
    { key: 'draggingCandidateLabel', label: 'Dragging Candidate Label' },
    { key: 'cancelLabel', label: 'Cancel Label' },
    { key: 'quickContactLabel', label: 'Quick Contact Label' },
    { key: 'emailTooltipPrefix', label: 'Email Tooltip Prefix' },
    { key: 'callTooltipPrefix', label: 'Call Tooltip Prefix' },
    { key: 'dateLabel', label: 'Date Label' },
    { key: 'candidateLabel', label: 'Candidate Label' },
    { key: 'roleLabel', label: 'Role Label' },
    { key: 'allCandidatesLabel', label: 'All Candidates Label' },
    { key: 'allRolesLabel', label: 'All Roles Label' },
    { key: 'resetFiltersLabel', label: 'Reset Filters Label' },
    { key: 'roleDialogNewTitle', label: 'Role Dialog New Title' },
    { key: 'roleDialogEditTitle', label: 'Role Dialog Edit Title' },
    { key: 'roleBasicsSectionLabel', label: 'Role Basics Section Label' },
    { key: 'roleNameLabel', label: 'Role Name Label' },
    { key: 'roleDescriptionLabel', label: 'Role Description Label' },
    { key: 'roleMinAgeLabel', label: 'Role Min Age Label' },
    { key: 'roleMaxAgeLabel', label: 'Role Max Age Label' },
    { key: 'genderLabel', label: 'Gender Label' },
    { key: 'genderMaleLabel', label: 'Gender Male Label' },
    { key: 'genderFemaleLabel', label: 'Gender Female Label' },
    { key: 'genderNonBinaryLabel', label: 'Gender Non-binary Label' },
    { key: 'genderAllLabel', label: 'Gender All Label' },
    { key: 'statusLabel', label: 'Status Label' },
    { key: 'roleStatusDraft', label: 'Role Status Draft' },
    { key: 'roleStatusOpen', label: 'Role Status Open' },
    { key: 'roleStatusCasting', label: 'Role Status Casting' },
    { key: 'roleStatusFilled', label: 'Role Status Filled' },
    { key: 'roleStatusCancelled', label: 'Role Status Cancelled' },
    { key: 'roleRequirementsSectionLabel', label: 'Role Requirements Section Label' },
    { key: 'roleAppearanceLabel', label: 'Role Appearance Label' },
    { key: 'roleAppearancePlaceholder', label: 'Role Appearance Placeholder' },
    { key: 'roleSkillsLabel', label: 'Role Skills Label' },
    { key: 'roleSkillsPlaceholder', label: 'Role Skills Placeholder' },
    { key: 'roleSpecialNeedsLabel', label: 'Role Special Needs Label' },
    { key: 'roleSpecialNeedsPlaceholder', label: 'Role Special Needs Placeholder' },
    { key: 'roleScenesLabel', label: 'Role Scenes Label' },
    { key: 'roleCrewLabel', label: 'Role Crew Label' },
    { key: 'roleLocationsLabel', label: 'Role Locations Label' },
    { key: 'rolePropsLabel', label: 'Role Props Label' },
    { key: 'saveRoleLabel', label: 'Save Role Label' },
    { key: 'deleteLabel', label: 'Delete Label' },
    { key: 'candidateDialogNewTitle', label: 'Candidate Dialog New Title' },
    { key: 'candidateDialogEditTitle', label: 'Candidate Dialog Edit Title' },
    { key: 'nameLabel', label: 'Name Label' },
    { key: 'emailLabel', label: 'Email Label' },
    { key: 'phoneLabel', label: 'Phone Label' },
    { key: 'addressLabel', label: 'Address Label' },
    { key: 'mediaSectionLabel', label: 'Media Section Label' },
    { key: 'uploadMediaLabel', label: 'Upload Media Label' },
    { key: 'candidatePhotoAltLabel', label: 'Candidate Photo Alt Label' },
    { key: 'auditionNotesLabel', label: 'Audition Notes Label' },
    { key: 'emergencyContactSectionLabel', label: 'Emergency Contact Section Label' },
    { key: 'relationshipLabel', label: 'Relationship Label' },
    { key: 'consentSectionLabel', label: 'Consent Section Label' },
    { key: 'sendConsentOnSaveLabel', label: 'Send Consent On Save Label' },
    { key: 'consentSendHelpText', label: 'Consent Send Help Text' },
    { key: 'saveLabel', label: 'Save Label' },
    { key: 'scheduleDialogNewTitle', label: 'Schedule Dialog New Title' },
    { key: 'scheduleDialogEditTitle', label: 'Schedule Dialog Edit Title' },
    { key: 'timeLabel', label: 'Time Label' },
    { key: 'locationLabel', label: 'Location Label' },
    { key: 'noLocationLabel', label: 'No Location Label' },
    { key: 'locationFallbackLabel', label: 'Location Fallback Label' },
    { key: 'locationFallbackPlaceholder', label: 'Location Fallback Placeholder' },
    { key: 'sceneOptionalLabel', label: 'Scene Optional Label' },
    { key: 'noSceneLabel', label: 'No Scene Label' },
    { key: 'notesLabel', label: 'Notes Label' },
    { key: 'notesPlaceholder', label: 'Notes Placeholder' },
    { key: 'scheduleStatusScheduled', label: 'Schedule Status Scheduled' },
    { key: 'scheduleStatusCompleted', label: 'Schedule Status Completed' },
    { key: 'scheduleStatusCancelled', label: 'Schedule Status Cancelled' },
    { key: 'allProjectsLabel', label: 'All Projects Label' },
    { key: 'lastUpdatedLabel', label: 'Last Updated Label' },
    { key: 'unknownLabel', label: 'Unknown Label' },
    { key: 'candidatesCountLabel', label: 'Candidates Count Label' },
    { key: 'confirmDeleteProjectShort', label: 'Confirm Delete Project Short' },
    { key: 'confirmDeleteProjectDialogBody', label: 'Confirm Delete Project Dialog Body' },
    { key: 'deleteProjectWarning', label: 'Delete Project Warning' },
    { key: 'projectDeleteErrorShort', label: 'Project Delete Error Short' },
    { key: 'closeLabel', label: 'Close Label' },
    { key: 'projectIdLabel', label: 'Project ID Label' },
    { key: 'editProjectTitle', label: 'Edit Project Title' },
    { key: 'newCastingProjectTitle', label: 'New Casting Project Title' },
    { key: 'newProjectPrefix', label: 'New Project Prefix' },
    { key: 'sceneFallbackPrefix', label: 'Scene Fallback Prefix' },
    { key: 'professionPhotographerName', label: 'Profession Photographer Name' },
    { key: 'termPhotoProject', label: 'Term Photo Project' },
    { key: 'termPhotoShot', label: 'Term Photo Shot' },
    { key: 'termPhotoShoot', label: 'Term Photo Shoot' },
    { key: 'termPhotoShootDay', label: 'Term Photo Shoot Day' },
    { key: 'termPhotoShotList', label: 'Term Photo Shot List' },
    { key: 'termPhotoPortfolio', label: 'Term Photo Portfolio' },
    { key: 'termPhotoSingle', label: 'Term Photo Single' },
    { key: 'termPhotoPlural', label: 'Term Photo Plural' },
    { key: 'professionVideographerName', label: 'Profession Videographer Name' },
    { key: 'termVideoProject', label: 'Term Video Project' },
    { key: 'termVideoShot', label: 'Term Video Shot' },
    { key: 'termVideoShoot', label: 'Term Video Shoot' },
    { key: 'termVideoShootDay', label: 'Term Video Shoot Day' },
    { key: 'termVideoShotList', label: 'Term Video Shot List' },
    { key: 'termVideoPortfolio', label: 'Term Video Portfolio' },
    { key: 'termVideoSingle', label: 'Term Video Single' },
    { key: 'termVideoPlural', label: 'Term Video Plural' },
    { key: 'propsHeaderLabel', label: 'Props Header Label' },
    { key: 'storyArcBackLabel', label: 'Story Arc Back Label' },
    { key: 'fabLabel', label: 'FAB Label' },
    { key: 'fabIcon', label: 'FAB Icon' },
    { key: 'importDialogTitle', label: 'Import Dialog Title' },
    { key: 'importDialogInfo', label: 'Import Dialog Info' },
    { key: 'importSelectFile', label: 'Import Select File' },
    { key: 'importFileFormat', label: 'Import File Format' },
    { key: 'importValidationErrorTitle', label: 'Import Validation Error' },
    { key: 'importValidatedSuccess', label: 'Import Validated Success' },
    { key: 'importMetadataTitle', label: 'Import Metadata Title' },
    { key: 'importContentTitle', label: 'Import Content Title' },
    { key: 'importFieldTitle', label: 'Import Field Title' },
    { key: 'importFieldAuthor', label: 'Import Field Author' },
    { key: 'importFieldFormat', label: 'Import Field Format' },
    { key: 'importFieldExported', label: 'Import Field Exported' },
    { key: 'importStatsScenes', label: 'Import Stats Scenes' },
    { key: 'importStatsActs', label: 'Import Stats Acts' },
    { key: 'importStatsCharacters', label: 'Import Stats Characters' },
    { key: 'importStatsDialogue', label: 'Import Stats Dialogue' },
    { key: 'importStatsRevisions', label: 'Import Stats Revisions' },
    { key: 'importStatsRuntime', label: 'Import Stats Runtime' },
    { key: 'importIdWarning', label: 'Import ID Warning' },
    { key: 'importImporting', label: 'Import Importing' },
    { key: 'importCompleteTitle', label: 'Import Complete Title' },
    { key: 'importCompleteBody', label: 'Import Complete Body' },
    { key: 'importCancel', label: 'Import Cancel' },
    { key: 'importChooseAnother', label: 'Import Choose Another' },
    { key: 'importAction', label: 'Import Action' },
    { key: 'importClose', label: 'Import Close' },
    { key: 'importToastFileLoaded', label: 'Import Toast File Loaded' },
    { key: 'importToastUnknownError', label: 'Import Toast Unknown Error' },
    { key: 'importToastReadError', label: 'Import Toast Read Error' },
    { key: 'importToastImported', label: 'Import Toast Imported' },
    { key: 'importToastImportFailed', label: 'Import Toast Import Failed' },
    { key: 'manuscriptHeader', label: 'Manuscript Header' },
    { key: 'manuscriptHeaderMobile', label: 'Manuscript Header Mobile' },
    { key: 'manuscriptAutoBreakdown', label: 'Manuscript Auto Breakdown' },
    { key: 'manuscriptAutoShort', label: 'Manuscript Auto Short' },
    { key: 'manuscriptExport', label: 'Manuscript Export' },
    { key: 'manuscriptSave', label: 'Manuscript Save' },
    { key: 'manuscriptImport', label: 'Manuscript Import' },
    { key: 'manuscriptTemplates', label: 'Manuscript Templates' },
    { key: 'manuscriptNew', label: 'Manuscript New' },
    { key: 'manuscriptNewShort', label: 'Manuscript New Short' },
    { key: 'manuscriptListTitle', label: 'Manuscript List Title' },
    { key: 'manuscriptOpenHint', label: 'Manuscript Open Hint' },
    { key: 'manuscriptNoProjectMessage', label: 'Manuscript No Project Message' },
    { key: 'manuscriptNoProjectTitle', label: 'Manuscript No Project Title' },
    { key: 'manuscriptOpenButton', label: 'Manuscript Open Button' },
    { key: 'manuscriptUnknownAuthor', label: 'Manuscript Unknown Author' },
    { key: 'manuscriptDeleteConfirm', label: 'Manuscript Delete Confirm' },
    { key: 'manuscriptEmptyTitle', label: 'Manuscript Empty Title' },
    { key: 'manuscriptEmptyBody', label: 'Manuscript Empty Body' },
    { key: 'manuscriptEmptyCta', label: 'Manuscript Empty CTA' },
    { key: 'manuscriptBackShort', label: 'Manuscript Back Short' },
    { key: 'manuscriptBackLong', label: 'Manuscript Back Long' },
    { key: 'exportTooltip', label: 'Export Tooltip' },
    { key: 'importTooltip', label: 'Import Tooltip' },
    { key: 'manuscriptUploadCoverTooltip', label: 'Manuscript Upload Cover Tooltip' },
    { key: 'manuscriptEditTooltip', label: 'Manuscript Edit Tooltip' },
    { key: 'manuscriptDeleteTooltip', label: 'Manuscript Delete Tooltip' },
    { key: 'manuscriptCoverLabel', label: 'Manuscript Cover Label' },
    { key: 'manuscriptUploadCoverButton', label: 'Manuscript Upload Cover Button' },
    { key: 'manuscriptRemoveCoverButton', label: 'Manuscript Remove Cover Button' },
    { key: 'manuscriptCoverHint', label: 'Manuscript Cover Hint' },
    { key: 'manuscriptDialogNewTitle', label: 'Manuscript Dialog New Title' },
    { key: 'manuscriptDialogEditTitle', label: 'Manuscript Dialog Edit Title' },
    { key: 'manuscriptFieldTitleLabel', label: 'Manuscript Field Title Label' },
    { key: 'manuscriptFieldSubtitleLabel', label: 'Manuscript Field Subtitle Label' },
    { key: 'manuscriptFieldAuthorLabel', label: 'Manuscript Field Author Label' },
    { key: 'manuscriptFieldFormatLabel', label: 'Manuscript Field Format Label' },
    { key: 'manuscriptFormatFountain', label: 'Manuscript Format Fountain' },
    { key: 'manuscriptFormatMarkdown', label: 'Manuscript Format Markdown' },
    { key: 'manuscriptFormatFinalDraft', label: 'Manuscript Format Final Draft' },
    { key: 'manuscriptDialogCancel', label: 'Manuscript Dialog Cancel' },
    { key: 'manuscriptDialogCreate', label: 'Manuscript Dialog Create' },
    { key: 'manuscriptDialogStatusLabel', label: 'Manuscript Dialog Status Label' },
    { key: 'manuscriptStatusDraft', label: 'Manuscript Status Draft' },
    { key: 'manuscriptStatusReview', label: 'Manuscript Status Review' },
    { key: 'manuscriptStatusApproved', label: 'Manuscript Status Approved' },
    { key: 'manuscriptStatusProduction', label: 'Manuscript Status Production' },
    { key: 'manuscriptStatusCompleted', label: 'Manuscript Status Completed' },
    { key: 'manuscriptDialogSaveChanges', label: 'Manuscript Dialog Save Changes' },
    { key: 'manuscriptUpdatedSuccess', label: 'Manuscript Updated Success' },
    { key: 'manuscriptToastLoaded', label: 'Manuscript Toast Loaded' },
    { key: 'manuscriptToastLoadError', label: 'Manuscript Toast Load Error' },
    { key: 'manuscriptToastLoadScenesError', label: 'Manuscript Toast Load Scenes Error' },
    { key: 'manuscriptToastLoadActsError', label: 'Manuscript Toast Load Acts Error' },
    { key: 'manuscriptToastLoadDialogueError', label: 'Manuscript Toast Load Dialogue Error' },
    { key: 'manuscriptToastLoadRevisionsError', label: 'Manuscript Toast Load Revisions Error' },
    { key: 'manuscriptToastOnline', label: 'Manuscript Toast Online' },
    { key: 'manuscriptToastOffline', label: 'Manuscript Toast Offline' },
    { key: 'manuscriptToastMissingTitle', label: 'Manuscript Toast Missing Title' },
    { key: 'manuscriptToastCreated', label: 'Manuscript Toast Created' },
    { key: 'manuscriptToastCreateError', label: 'Manuscript Toast Create Error' },
    { key: 'manuscriptToastSaved', label: 'Manuscript Toast Saved' },
    { key: 'manuscriptToastSaveError', label: 'Manuscript Toast Save Error' },
    { key: 'manuscriptToastAutoBreakdownPrefix', label: 'Manuscript Toast Auto Breakdown Prefix' },
    { key: 'manuscriptToastAutoBreakdownScenesLabel', label: 'Manuscript Toast Auto Breakdown Scenes Label' },
    { key: 'manuscriptToastAutoBreakdownCharactersLabel', label: 'Manuscript Toast Auto Breakdown Characters Label' },
    { key: 'manuscriptToastAutoBreakdownError', label: 'Manuscript Toast Auto Breakdown Error' },
    { key: 'manuscriptToastExported', label: 'Manuscript Toast Exported' },
    { key: 'manuscriptToastExportError', label: 'Manuscript Toast Export Error' },
    { key: 'manuscriptToastImported', label: 'Manuscript Toast Imported' },
    { key: 'manuscriptToastImportError', label: 'Manuscript Toast Import Error' },
    { key: 'manuscriptToastTemplateAppliedPrefix', label: 'Manuscript Toast Template Applied Prefix' },
    { key: 'manuscriptToastTemplateAppliedSuffix', label: 'Manuscript Toast Template Applied Suffix' },
    { key: 'manuscriptToastTemplateApplyError', label: 'Manuscript Toast Template Apply Error' },
    { key: 'manuscriptToastTemplateInsertedPrefix', label: 'Manuscript Toast Template Inserted Prefix' },
    { key: 'manuscriptToastTemplateInsertedSuffix', label: 'Manuscript Toast Template Inserted Suffix' },
    { key: 'manuscriptToastParsedScenesPrefix', label: 'Manuscript Toast Parsed Scenes Prefix' },
    { key: 'manuscriptToastParsedScenesSuffix', label: 'Manuscript Toast Parsed Scenes Suffix' },
    { key: 'manuscriptToastDeleted', label: 'Manuscript Toast Deleted' },
    { key: 'manuscriptToastDeleteError', label: 'Manuscript Toast Delete Error' },
    { key: 'manuscriptToastCoverUpdated', label: 'Manuscript Toast Cover Updated' },
    { key: 'manuscriptToastSceneSaved', label: 'Manuscript Toast Scene Saved' },
    { key: 'manuscriptToastSceneSaveError', label: 'Manuscript Toast Scene Save Error' },
    { key: 'manuscriptToastSceneDeleted', label: 'Manuscript Toast Scene Deleted' },
    { key: 'manuscriptToastSceneDeleteError', label: 'Manuscript Toast Scene Delete Error' },
    { key: 'manuscriptToastSceneCreated', label: 'Manuscript Toast Scene Created' },
    { key: 'manuscriptToastSceneCreateError', label: 'Manuscript Toast Scene Create Error' },
    { key: 'manuscriptToastSceneOrderUpdated', label: 'Manuscript Toast Scene Order Updated' },
    { key: 'manuscriptToastSceneOrderError', label: 'Manuscript Toast Scene Order Error' },
    { key: 'manuscriptToastUpdateError', label: 'Manuscript Toast Update Error' },
    { key: 'manuscriptToastParsedHeadingsPrefix', label: 'Manuscript Toast Parsed Headings Prefix' },
    { key: 'manuscriptToastParsedHeadingsSuffix', label: 'Manuscript Toast Parsed Headings Suffix' },
    { key: 'manuscriptPagesSuffix', label: 'Manuscript Pages Suffix' },
    { key: 'manuscriptMinutesSuffix', label: 'Manuscript Minutes Suffix' },
    { key: 'manuscriptScenesSuffix', label: 'Manuscript Scenes Suffix' },
    { key: 'manuscriptCharactersSuffix', label: 'Manuscript Characters Suffix' },
    { key: 'manuscriptWordsSuffix', label: 'Manuscript Words Suffix' },
    { key: 'manuscriptStatusDraftBadge', label: 'Manuscript Status Draft Badge' },
    { key: 'manuscriptStatusReviewBadge', label: 'Manuscript Status Review Badge' },
    { key: 'manuscriptStatusApprovedBadge', label: 'Manuscript Status Approved Badge' },
    { key: 'manuscriptStatusProductionBadge', label: 'Manuscript Status Production Badge' },
    { key: 'manuscriptStatusCompletedBadge', label: 'Manuscript Status Completed Badge' },
    { key: 'manuscriptSavedLabelShort', label: 'Manuscript Saved Label Short' },
    { key: 'manuscriptSavedLabel', label: 'Manuscript Saved Label' },
    { key: 'manuscriptSavingLabel', label: 'Manuscript Saving Label' },
    { key: 'manuscriptUnsavedShort', label: 'Manuscript Unsaved Short' },
    { key: 'manuscriptUnsavedLong', label: 'Manuscript Unsaved Long' },
    { key: 'manuscriptSaveErrorTooltip', label: 'Manuscript Save Error Tooltip' },
    { key: 'manuscriptSaveErrorLabel', label: 'Manuscript Save Error Label' },
    { key: 'manuscriptOnlineTooltip', label: 'Manuscript Online Tooltip' },
    { key: 'manuscriptOfflineTooltip', label: 'Manuscript Offline Tooltip' },
    { key: 'manuscriptTabEditor', label: 'Manuscript Tab Editor' },
    { key: 'manuscriptTabActs', label: 'Manuscript Tab Acts' },
    { key: 'manuscriptTabScenes', label: 'Manuscript Tab Scenes' },
    { key: 'manuscriptTabCharacters', label: 'Manuscript Tab Characters' },
    { key: 'manuscriptTabDialogue', label: 'Manuscript Tab Dialogue' },
    { key: 'manuscriptTabBreakdown', label: 'Manuscript Tab Breakdown' },
    { key: 'manuscriptTabRevisions', label: 'Manuscript Tab Revisions' },
    { key: 'manuscriptTabTimeline', label: 'Manuscript Tab Timeline' },
    { key: 'manuscriptTabProduction', label: 'Manuscript Tab Production' },
    { key: 'manuscriptTabProductionView', label: 'Manuscript Tab Production View' },
    { key: 'manuscriptTooltipPages', label: 'Manuscript Tooltip Pages' },
    { key: 'manuscriptTooltipRuntime', label: 'Manuscript Tooltip Runtime' },
    { key: 'manuscriptTooltipWords', label: 'Manuscript Tooltip Words' },
    { key: 'manuscriptTooltipHeadings', label: 'Manuscript Tooltip Headings' },
    { key: 'manuscriptTooltipCharacters', label: 'Manuscript Tooltip Characters' },
    { key: 'manuscriptEmptyIcon', label: 'Manuscript Empty Icon' },
    { key: 'manuscriptActsTitle', label: 'Manuscript Acts Title' },
    { key: 'manuscriptActsAddShort', label: 'Manuscript Acts Add Short' },
    { key: 'manuscriptActsAddLong', label: 'Manuscript Acts Add Long' },
    { key: 'manuscriptActsEmptyTitle', label: 'Manuscript Acts Empty Title' },
    { key: 'manuscriptActsEmptyBody', label: 'Manuscript Acts Empty Body' },
    { key: 'manuscriptActsEmptyIcon', label: 'Manuscript Acts Empty Icon' },
    { key: 'manuscriptActsCardTitlePrefix', label: 'Manuscript Acts Card Title Prefix' },
    { key: 'manuscriptActsNoDescription', label: 'Manuscript Acts No Description' },
    { key: 'manuscriptActsNoPages', label: 'Manuscript Acts No Pages' },
    { key: 'manuscriptActsPageLabel', label: 'Manuscript Acts Page Label' },
    { key: 'manuscriptActsTableNumber', label: 'Manuscript Acts Table Number' },
    { key: 'manuscriptActsTableTitle', label: 'Manuscript Acts Table Title' },
    { key: 'manuscriptActsTableDescription', label: 'Manuscript Acts Table Description' },
    { key: 'manuscriptActsTablePages', label: 'Manuscript Acts Table Pages' },
    { key: 'manuscriptActsTableDuration', label: 'Manuscript Acts Table Duration' },
    { key: 'manuscriptActsTableActions', label: 'Manuscript Acts Table Actions' },
    { key: 'manuscriptActsDialogNewTitle', label: 'Manuscript Acts Dialog New Title' },
    { key: 'manuscriptActsDialogEditTitle', label: 'Manuscript Acts Dialog Edit Title' },
    { key: 'manuscriptActsFieldNumber', label: 'Manuscript Acts Field Number' },
    { key: 'manuscriptActsFieldTitle', label: 'Manuscript Acts Field Title' },
    { key: 'manuscriptActsFieldDescription', label: 'Manuscript Acts Field Description' },
    { key: 'manuscriptActsFieldPageStart', label: 'Manuscript Acts Field Page Start' },
    { key: 'manuscriptActsFieldPageEnd', label: 'Manuscript Acts Field Page End' },
    { key: 'manuscriptActsFieldRuntime', label: 'Manuscript Acts Field Runtime' },
    { key: 'manuscriptActsFieldColor', label: 'Manuscript Acts Field Color' },
    { key: 'manuscriptActsFieldColorPlaceholder', label: 'Manuscript Acts Field Color Placeholder' },
    { key: 'manuscriptActsDialogCancel', label: 'Manuscript Acts Dialog Cancel' },
    { key: 'manuscriptActsDialogCreate', label: 'Manuscript Acts Dialog Create' },
    { key: 'manuscriptActsDialogUpdate', label: 'Manuscript Acts Dialog Update' },
    { key: 'manuscriptActsSuccessUpdated', label: 'Manuscript Acts Success Updated' },
    { key: 'manuscriptActsSuccessCreated', label: 'Manuscript Acts Success Created' },
    { key: 'manuscriptActsSuccessDeleted', label: 'Manuscript Acts Success Deleted' },
    { key: 'manuscriptActsErrorSave', label: 'Manuscript Acts Error Save' },
    { key: 'manuscriptActsErrorDelete', label: 'Manuscript Acts Error Delete' },
    { key: 'manuscriptActsDeleteConfirm', label: 'Manuscript Acts Delete Confirm' },
    { key: 'manuscriptScenesTitle', label: 'Manuscript Scenes Title' },
    { key: 'manuscriptScenesAddShort', label: 'Manuscript Scenes Add Short' },
    { key: 'manuscriptScenesAddLong', label: 'Manuscript Scenes Add Long' },
    { key: 'manuscriptScenesEmptyTitle', label: 'Manuscript Scenes Empty Title' },
    { key: 'manuscriptScenesEmptyBody', label: 'Manuscript Scenes Empty Body' },
    { key: 'manuscriptScenesEmptyIcon', label: 'Manuscript Scenes Empty Icon' },
    { key: 'manuscriptScenesTableSceneNumber', label: 'Manuscript Scenes Table Scene Number' },
    { key: 'manuscriptScenesTableHeading', label: 'Manuscript Scenes Table Heading' },
    { key: 'manuscriptScenesTableIntExt', label: 'Manuscript Scenes Table INT/EXT' },
    { key: 'manuscriptScenesTableTime', label: 'Manuscript Scenes Table Time' },
    { key: 'manuscriptScenesTablePages', label: 'Manuscript Scenes Table Pages' },
    { key: 'manuscriptScenesTableCharacters', label: 'Manuscript Scenes Table Characters' },
    { key: 'manuscriptScenesTableStatus', label: 'Manuscript Scenes Table Status' },
    { key: 'manuscriptScenesTableActions', label: 'Manuscript Scenes Table Actions' },
    { key: 'manuscriptScenesSceneLabel', label: 'Manuscript Scenes Scene Label' },
    { key: 'manuscriptScenesPageSuffix', label: 'Manuscript Scenes Page Suffix' },
    { key: 'manuscriptScenesCharactersSuffix', label: 'Manuscript Scenes Characters Suffix' },
    { key: 'manuscriptCharactersTitle', label: 'Manuscript Characters Title' },
    { key: 'manuscriptCharactersSearchPlaceholder', label: 'Manuscript Characters Search Placeholder' },
    { key: 'manuscriptCharactersLeadCount', label: 'Manuscript Characters Lead Count' },
    { key: 'manuscriptCharactersSupportingCount', label: 'Manuscript Characters Supporting Count' },
    { key: 'manuscriptCharactersMinorCount', label: 'Manuscript Characters Minor Count' },
    { key: 'manuscriptCharactersEmptyTitle', label: 'Manuscript Characters Empty Title' },
    { key: 'manuscriptCharactersEmptyBody', label: 'Manuscript Characters Empty Body' },
    { key: 'manuscriptCharactersEmptyIcon', label: 'Manuscript Characters Empty Icon' },
    { key: 'manuscriptCharactersAliasPrefix', label: 'Manuscript Characters Alias Prefix' },
    { key: 'manuscriptCharactersAgeLabel', label: 'Manuscript Characters Age Label' },
    { key: 'manuscriptCharactersDialogueLabel', label: 'Manuscript Characters Dialogue Label' },
    { key: 'manuscriptCharactersSceneLabel', label: 'Manuscript Characters Scene Label' },
    { key: 'manuscriptCharactersScenesLabel', label: 'Manuscript Characters Scenes Label' },
    { key: 'manuscriptCharactersScenesMoreSuffix', label: 'Manuscript Characters Scenes More Suffix' },
    { key: 'manuscriptCharactersDialogTitle', label: 'Manuscript Characters Dialog Title' },
    { key: 'manuscriptCharactersFieldAlias', label: 'Manuscript Characters Field Alias' },
    { key: 'manuscriptCharactersFieldAliasPlaceholder', label: 'Manuscript Characters Field Alias Placeholder' },
    { key: 'manuscriptCharactersFieldAge', label: 'Manuscript Characters Field Age' },
    { key: 'manuscriptCharactersFieldAgePlaceholder', label: 'Manuscript Characters Field Age Placeholder' },
    { key: 'manuscriptCharactersFieldRole', label: 'Manuscript Characters Field Role' },
    { key: 'manuscriptCharactersRoleLead', label: 'Manuscript Characters Role Lead' },
    { key: 'manuscriptCharactersRoleSupporting', label: 'Manuscript Characters Role Supporting' },
    { key: 'manuscriptCharactersRoleMinor', label: 'Manuscript Characters Role Minor' },
    { key: 'manuscriptCharactersRoleExtra', label: 'Manuscript Characters Role Extra' },
    { key: 'manuscriptCharactersFieldDescription', label: 'Manuscript Characters Field Description' },
    { key: 'manuscriptCharactersFieldDescriptionPlaceholder', label: 'Manuscript Characters Field Description Placeholder' },
    { key: 'manuscriptCharactersDialogCancel', label: 'Manuscript Characters Dialog Cancel' },
    { key: 'manuscriptCharactersDialogSave', label: 'Manuscript Characters Dialog Save' },
    { key: 'manuscriptCharactersUpdatedSuccess', label: 'Manuscript Characters Updated Success' },
    { key: 'manuscriptDialogueTitle', label: 'Manuscript Dialogue Title' },
    { key: 'manuscriptDialogueAddButton', label: 'Manuscript Dialogue Add Button' },
    { key: 'manuscriptDialogueFilterCharacter', label: 'Manuscript Dialogue Filter Character' },
    { key: 'manuscriptDialogueFilterScene', label: 'Manuscript Dialogue Filter Scene' },
    { key: 'manuscriptDialogueFilterAll', label: 'Manuscript Dialogue Filter All' },
    { key: 'manuscriptDialogueEmptyTitle', label: 'Manuscript Dialogue Empty Title' },
    { key: 'manuscriptDialogueEmptyBody', label: 'Manuscript Dialogue Empty Body' },
    { key: 'manuscriptDialogueEmptyIcon', label: 'Manuscript Dialogue Empty Icon' },
    { key: 'manuscriptDialogueDialogEditTitle', label: 'Manuscript Dialogue Dialog Edit Title' },
    { key: 'manuscriptDialogueDialogNewTitle', label: 'Manuscript Dialogue Dialog New Title' },
    { key: 'manuscriptDialogueFieldCharacter', label: 'Manuscript Dialogue Field Character' },
    { key: 'manuscriptDialogueFieldCharacterPlaceholder', label: 'Manuscript Dialogue Field Character Placeholder' },
    { key: 'manuscriptDialogueFieldCharacterHelper', label: 'Manuscript Dialogue Field Character Helper' },
    { key: 'manuscriptDialogueFieldScene', label: 'Manuscript Dialogue Field Scene' },
    { key: 'manuscriptDialogueFieldDialogue', label: 'Manuscript Dialogue Field Dialogue' },
    { key: 'manuscriptDialogueFieldDialoguePlaceholder', label: 'Manuscript Dialogue Field Dialogue Placeholder' },
    { key: 'manuscriptDialogueFieldParenthetical', label: 'Manuscript Dialogue Field Parenthetical' },
    { key: 'manuscriptDialogueFieldParentheticalPlaceholder', label: 'Manuscript Dialogue Field Parenthetical Placeholder' },
    { key: 'manuscriptDialogueFieldParentheticalHelper', label: 'Manuscript Dialogue Field Parenthetical Helper' },
    { key: 'manuscriptDialogueFieldEmotion', label: 'Manuscript Dialogue Field Emotion' },
    { key: 'manuscriptDialogueEmotionNone', label: 'Manuscript Dialogue Emotion None' },
    { key: 'manuscriptDialogueEmotionNeutral', label: 'Manuscript Dialogue Emotion Neutral' },
    { key: 'manuscriptDialogueEmotionHappy', label: 'Manuscript Dialogue Emotion Happy' },
    { key: 'manuscriptDialogueEmotionSad', label: 'Manuscript Dialogue Emotion Sad' },
    { key: 'manuscriptDialogueEmotionAngry', label: 'Manuscript Dialogue Emotion Angry' },
    { key: 'manuscriptDialogueEmotionFrightened', label: 'Manuscript Dialogue Emotion Frightened' },
    { key: 'manuscriptDialogueEmotionSurprised', label: 'Manuscript Dialogue Emotion Surprised' },
    { key: 'manuscriptDialogueEmotionConfused', label: 'Manuscript Dialogue Emotion Confused' },
    { key: 'manuscriptDialogueEmotionDetermined', label: 'Manuscript Dialogue Emotion Determined' },
    { key: 'manuscriptDialogueEmotionHopeful', label: 'Manuscript Dialogue Emotion Hopeful' },
    { key: 'manuscriptDialogueEmotionDesperate', label: 'Manuscript Dialogue Emotion Desperate' },
    { key: 'manuscriptDialogueEmotionWistful', label: 'Manuscript Dialogue Emotion Wistful' },
    { key: 'manuscriptDialogueEmotionMysterious', label: 'Manuscript Dialogue Emotion Mysterious' },
    { key: 'manuscriptDialogueDialogCancel', label: 'Manuscript Dialogue Dialog Cancel' },
    { key: 'manuscriptDialogueDialogCreate', label: 'Manuscript Dialogue Dialog Create' },
    { key: 'manuscriptDialogueDialogUpdate', label: 'Manuscript Dialogue Dialog Update' },
    { key: 'manuscriptDialogueDeleteConfirm', label: 'Manuscript Dialogue Delete Confirm' },
    { key: 'manuscriptDialogueSuccessCreated', label: 'Manuscript Dialogue Success Created' },
    { key: 'manuscriptDialogueSuccessUpdated', label: 'Manuscript Dialogue Success Updated' },
    { key: 'manuscriptDialogueSuccessDeleted', label: 'Manuscript Dialogue Success Deleted' },
    { key: 'manuscriptDialogueErrorSave', label: 'Manuscript Dialogue Error Save' },
    { key: 'manuscriptDialogueErrorDelete', label: 'Manuscript Dialogue Error Delete' },
    { key: 'manuscriptBreakdownTitle', label: 'Manuscript Breakdown Title' },
    { key: 'manuscriptBreakdownTotalScenes', label: 'Manuscript Breakdown Total Scenes' },
    { key: 'manuscriptBreakdownIntScenes', label: 'Manuscript Breakdown INT Scenes' },
    { key: 'manuscriptBreakdownExtScenes', label: 'Manuscript Breakdown EXT Scenes' },
    { key: 'manuscriptBreakdownDayNight', label: 'Manuscript Breakdown Day/Night' },
    { key: 'manuscriptBreakdownSceneHeader', label: 'Manuscript Breakdown Scene Header' },
    { key: 'manuscriptBreakdownLocationHeader', label: 'Manuscript Breakdown Location Header' },
    { key: 'manuscriptBreakdownCharactersHeader', label: 'Manuscript Breakdown Characters Header' },
    { key: 'manuscriptBreakdownPropsHeader', label: 'Manuscript Breakdown Props Header' },
    { key: 'manuscriptBreakdownSpecialNotesHeader', label: 'Manuscript Breakdown Special Notes Header' },
    { key: 'manuscriptBreakdownVfx', label: 'Manuscript Breakdown VFX' },
    { key: 'manuscriptBreakdownStunts', label: 'Manuscript Breakdown Stunts' },
    { key: 'manuscriptBreakdownVehicles', label: 'Manuscript Breakdown Vehicles' },
    { key: 'manuscriptBreakdownCharsSuffix', label: 'Manuscript Breakdown Chars Suffix' },
    { key: 'manuscriptBreakdownPropsSuffix', label: 'Manuscript Breakdown Props Suffix' },
    { key: 'manuscriptRevisionsTitleShort', label: 'Manuscript Revisions Title Short' },
    { key: 'manuscriptRevisionsTitleLong', label: 'Manuscript Revisions Title Long' },
    { key: 'manuscriptRevisionsNewShort', label: 'Manuscript Revisions New Short' },
    { key: 'manuscriptRevisionsNewLong', label: 'Manuscript Revisions New Long' },
    { key: 'manuscriptRevisionsEmptyTitle', label: 'Manuscript Revisions Empty Title' },
    { key: 'manuscriptRevisionsEmptyBodyShort', label: 'Manuscript Revisions Empty Body Short' },
    { key: 'manuscriptRevisionsEmptyBodyLong', label: 'Manuscript Revisions Empty Body Long' },
    { key: 'manuscriptRevisionsEmptyIcon', label: 'Manuscript Revisions Empty Icon' },
    { key: 'manuscriptRevisionsHistoryTitle', label: 'Manuscript Revisions History Title' },
    { key: 'manuscriptRevisionsNoDescription', label: 'Manuscript Revisions No Description' },
    { key: 'manuscriptRevisionsRestoreTooltip', label: 'Manuscript Revisions Restore Tooltip' },
    { key: 'manuscriptRevisionsDeleteTooltip', label: 'Manuscript Revisions Delete Tooltip' },
    { key: 'manuscriptRevisionsDeleteConfirm', label: 'Manuscript Revisions Delete Confirm' },
    { key: 'manuscriptRevisionsDeleteError', label: 'Manuscript Revisions Delete Error' },
    { key: 'manuscriptRevisionsRestoreConfirm', label: 'Manuscript Revisions Restore Confirm' },
    { key: 'manuscriptRevisionsRestoredSuccess', label: 'Manuscript Revisions Restored Success' },
    { key: 'manuscriptRevisionsDeletedSuccess', label: 'Manuscript Revisions Deleted Success' },
    { key: 'manuscriptRevisionsCreateDialogTitle', label: 'Manuscript Revisions Create Dialog Title' },
    { key: 'manuscriptRevisionsCreateInfoShort', label: 'Manuscript Revisions Create Info Short' },
    { key: 'manuscriptRevisionsCreateInfoLong', label: 'Manuscript Revisions Create Info Long' },
    { key: 'manuscriptRevisionsNameLabel', label: 'Manuscript Revisions Name Label' },
    { key: 'manuscriptRevisionsNamePlaceholder', label: 'Manuscript Revisions Name Placeholder' },
    { key: 'manuscriptRevisionsNotesLabel', label: 'Manuscript Revisions Notes Label' },
    { key: 'manuscriptRevisionsNotesPlaceholder', label: 'Manuscript Revisions Notes Placeholder' },
    { key: 'manuscriptRevisionsCurrentVersionLabel', label: 'Manuscript Revisions Current Version Label' },
    { key: 'manuscriptRevisionsNewVersionLabel', label: 'Manuscript Revisions New Version Label' },
    { key: 'manuscriptRevisionsSaveShort', label: 'Manuscript Revisions Save Short' },
    { key: 'manuscriptRevisionsSaveLong', label: 'Manuscript Revisions Save Long' },
    { key: 'manuscriptRevisionsNameRequiredError', label: 'Manuscript Revisions Name Required Error' },
    { key: 'manuscriptRevisionsCreateError', label: 'Manuscript Revisions Create Error' },
    { key: 'manuscriptRevisionsCreatedSuccess', label: 'Manuscript Revisions Created Success' },
    { key: 'storyArcLogicTitle', label: 'Story Arc Logic Title' },
    { key: 'storyArcLogicSubtitle', label: 'Story Arc Logic Subtitle' },
    { key: 'storyLogicSystemTitle', label: 'Story Logic System Title' },
    { key: 'storyLogicSystemSubtitle', label: 'Story Logic System Subtitle' },
    { key: 'storyLogicUnlock', label: 'Story Logic Unlock' },
    { key: 'storyLogicLock', label: 'Story Logic Lock' },
    { key: 'storyLogicReset', label: 'Story Logic Reset' },
    { key: 'storyLogicSave', label: 'Story Logic Save' },
    { key: 'storyLogicOverall', label: 'Story Logic Overall' },
    { key: 'storyLogicLastSaved', label: 'Story Logic Last Saved' },
    { key: 'storyLogicConceptLabel', label: 'Story Logic Concept Label' },
    { key: 'storyLogicLoglineLabel', label: 'Story Logic Logline Label' },
    { key: 'storyLogicThemeLabel', label: 'Story Logic Theme Label' },
    { key: 'storyLogicPhaseConcept', label: 'Story Logic Phase Concept' },
    { key: 'storyLogicPhaseConceptPurpose', label: 'Story Logic Phase Concept Purpose' },
    { key: 'storyLogicResetConfirm', label: 'Story Logic Reset Confirm' },
    { key: 'storyLogicCorePremiseLabel', label: 'Story Logic Core Premise Label' },
    { key: 'storyLogicCorePremisePlaceholder', label: 'Story Logic Core Premise Placeholder' },
    { key: 'storyLogicPrimaryGenreLabel', label: 'Story Logic Primary Genre Label' },
    { key: 'storyLogicSubGenreLabel', label: 'Story Logic Sub-Genre Label' },
    { key: 'storyLogicToneLabel', label: 'Story Logic Tone Label' },
    { key: 'storyLogicTargetAudienceLabel', label: 'Story Logic Target Audience Label' },
    { key: 'storyLogicTargetAudiencePlaceholder', label: 'Story Logic Target Audience Placeholder' },
    { key: 'storyLogicAudienceAgeLabel', label: 'Story Logic Audience Age Label' },
    { key: 'storyLogicWhyNowLabel', label: 'Story Logic Why Now Label' },
    { key: 'storyLogicWhyNowPlaceholder', label: 'Story Logic Why Now Placeholder' },
    { key: 'storyLogicUniqueAngleLabel', label: 'Story Logic Unique Angle Label' },
    { key: 'storyLogicUniqueAnglePlaceholder', label: 'Story Logic Unique Angle Placeholder' },
    { key: 'storyLogicMarketComparablesLabel', label: 'Story Logic Market Comparables Label' },
    { key: 'storyLogicMarketComparablesPlaceholder', label: 'Story Logic Market Comparables Placeholder' },
    { key: 'storyLogicValidationConceptTitle', label: 'Story Logic Validation Concept Title' },
    { key: 'storyLogicPhaseLoglineTitle', label: 'Story Logic Phase Logline Title' },
    { key: 'storyLogicPhaseLoglinePurpose', label: 'Story Logic Phase Logline Purpose' },
    { key: 'storyLogicLoglineFormulaTitle', label: 'Story Logic Logline Formula Title' },
    { key: 'storyLogicLoglineFormulaBody', label: 'Story Logic Logline Formula Body' },
    { key: 'storyLogicProtagonistLabel', label: 'Story Logic Protagonist Label' },
    { key: 'storyLogicProtagonistPlaceholder', label: 'Story Logic Protagonist Placeholder' },
    { key: 'storyLogicProtagonistTraitLabel', label: 'Story Logic Protagonist Trait Label' },
    { key: 'storyLogicProtagonistTraitPlaceholder', label: 'Story Logic Protagonist Trait Placeholder' },
    { key: 'storyLogicGoalLabel', label: 'Story Logic Goal Label' },
    { key: 'storyLogicGoalPlaceholder', label: 'Story Logic Goal Placeholder' },
    { key: 'storyLogicAntagonistLabel', label: 'Story Logic Antagonist Label' },
    { key: 'storyLogicAntagonistPlaceholder', label: 'Story Logic Antagonist Placeholder' },
    { key: 'storyLogicStakesLabel', label: 'Story Logic Stakes Label' },
    { key: 'storyLogicStakesPlaceholder', label: 'Story Logic Stakes Placeholder' },
    { key: 'storyLogicGenerateLogline', label: 'Story Logic Generate Logline' },
    { key: 'storyLogicCompleteLoglineLabel', label: 'Story Logic Complete Logline Label' },
    { key: 'storyLogicCompleteLoglinePlaceholder', label: 'Story Logic Complete Logline Placeholder' },
    { key: 'storyLogicWordCountLabel', label: 'Story Logic Word Count Label' },
    { key: 'storyLogicStrengthLabel', label: 'Story Logic Strength Label' },
    { key: 'storyLogicValidationLoglineTitle', label: 'Story Logic Validation Logline Title' },
    { key: 'storyLogicPhaseThemeTitle', label: 'Story Logic Phase Theme Title' },
    { key: 'storyLogicPhaseThemePurpose', label: 'Story Logic Phase Theme Purpose' },
    { key: 'storyLogicCentralThemeLabel', label: 'Story Logic Central Theme Label' },
    { key: 'storyLogicCentralThemePlaceholder', label: 'Story Logic Central Theme Placeholder' },
    { key: 'storyLogicMoralArgumentLabel', label: 'Story Logic Moral Argument Label' },
    { key: 'storyLogicMoralArgumentPlaceholder', label: 'Story Logic Moral Argument Placeholder' },
    { key: 'storyLogicThemeStatementLabel', label: 'Story Logic Theme Statement Label' },
    { key: 'storyLogicThemeStatementPlaceholder', label: 'Story Logic Theme Statement Placeholder' },
    { key: 'storyLogicCharacterTransformationTitle', label: 'Story Logic Character Transformation Title' },
    { key: 'storyLogicProtagonistFlawLabel', label: 'Story Logic Protagonist Flaw Label' },
    { key: 'storyLogicProtagonistFlawPlaceholder', label: 'Story Logic Protagonist Flaw Placeholder' },
    { key: 'storyLogicFlawOriginLabel', label: 'Story Logic Flaw Origin Label' },
    { key: 'storyLogicFlawOriginPlaceholder', label: 'Story Logic Flaw Origin Placeholder' },
    { key: 'storyLogicWhatMustChangeLabel', label: 'Story Logic Must Change Label' },
    { key: 'storyLogicWhatMustChangePlaceholder', label: 'Story Logic Must Change Placeholder' },
    { key: 'storyLogicTransformationArcLabel', label: 'Story Logic Transformation Arc Label' },
    { key: 'storyLogicTransformationArcPlaceholder', label: 'Story Logic Transformation Arc Placeholder' },
    { key: 'storyLogicEmotionalJourneyLabel', label: 'Story Logic Emotional Journey Label' },
    { key: 'storyLogicEmotionalArcLabel', label: 'Story Logic Emotional Arc Label' },
    { key: 'storyLogicValidationThemeTitle', label: 'Story Logic Validation Theme Title' },
    { key: 'storyLogicSummaryReadyTitle', label: 'Story Logic Summary Ready Title' },
    { key: 'storyLogicSummaryReadyBody', label: 'Story Logic Summary Ready Body' },
    { key: 'storyLogicSummaryTitle', label: 'Story Logic Summary Title' },
    { key: 'storyLogicSummaryGenreLabel', label: 'Story Logic Summary Genre Label' },
    { key: 'storyLogicSummaryToneLabel', label: 'Story Logic Summary Tone Label' },
    { key: 'storyLogicSummaryThemeLabel', label: 'Story Logic Summary Theme Label' },
    { key: 'storyLogicPhaseLabel', label: 'Story Logic Phase Label' },
    { key: 'storyLogicStatusIncomplete', label: 'Story Logic Status Incomplete' },
    { key: 'storyLogicStatusWeak', label: 'Story Logic Status Weak' },
    { key: 'storyLogicStatusReady', label: 'Story Logic Status Ready' },
    { key: 'storyLogicValidationSuffix', label: 'Story Logic Validation Suffix' },
    { key: 'storyLogicLoglineWhen', label: 'Story Logic Logline When' },
    { key: 'storyLogicLoglineArticle', label: 'Story Logic Logline Article' },
    { key: 'storyLogicLoglineMust', label: 'Story Logic Logline Must' },
    { key: 'storyLogicLoglineFaces', label: 'Story Logic Logline Faces' },
    { key: 'storyLogicLoglineOrElse', label: 'Story Logic Logline Or Else' },
    { key: 'storyLogicConceptSuggestionCorePremiseExpand', label: 'Story Logic Concept Suggestion Core Premise' },
    { key: 'storyLogicConceptWarningCorePremiseShort', label: 'Story Logic Concept Warning Core Premise' },
    { key: 'storyLogicConceptWarningPrimaryGenre', label: 'Story Logic Concept Warning Primary Genre' },
    { key: 'storyLogicConceptSuggestionToneNarrow', label: 'Story Logic Concept Suggestion Tone Narrow' },
    { key: 'storyLogicConceptWarningToneMissing', label: 'Story Logic Concept Warning Tone Missing' },
    { key: 'storyLogicConceptWarningTargetAudience', label: 'Story Logic Concept Warning Target Audience' },
    { key: 'storyLogicConceptSuggestionWhyNowExpand', label: 'Story Logic Concept Suggestion Why Now' },
    { key: 'storyLogicConceptWarningWhyNowMissing', label: 'Story Logic Concept Warning Why Now' },
    { key: 'storyLogicConceptWarningUniqueAngle', label: 'Story Logic Concept Warning Unique Angle' },
    { key: 'storyLogicConceptSuggestionComparables', label: 'Story Logic Concept Suggestion Comparables' },
    { key: 'storyLogicLoglineWarningProtagonist', label: 'Story Logic Logline Warning Protagonist' },
    { key: 'storyLogicLoglineWarningGoal', label: 'Story Logic Logline Warning Goal' },
    { key: 'storyLogicLoglineWarningAntagonist', label: 'Story Logic Logline Warning Antagonist' },
    { key: 'storyLogicLoglineWarningStakes', label: 'Story Logic Logline Warning Stakes' },
    { key: 'storyLogicLoglineSuggestionWhenStart', label: 'Story Logic Logline Suggestion When Start' },
    { key: 'storyLogicLoglineSuggestionMustInclude', label: 'Story Logic Logline Suggestion Must Include' },
    { key: 'storyLogicLoglineSuggestionAddStakes', label: 'Story Logic Logline Suggestion Add Stakes' },
    { key: 'storyLogicLoglineWarningComplete', label: 'Story Logic Logline Warning Complete' },
    { key: 'storyLogicThemeWarningCentralTheme', label: 'Story Logic Theme Warning Central Theme' },
    { key: 'storyLogicThemeSuggestionThemeStatementFormat', label: 'Story Logic Theme Suggestion Theme Statement' },
    { key: 'storyLogicThemeWarningThemeStatement', label: 'Story Logic Theme Warning Theme Statement' },
    { key: 'storyLogicThemeWarningProtagonistFlaw', label: 'Story Logic Theme Warning Protagonist Flaw' },
    { key: 'storyLogicThemeWarningMustChange', label: 'Story Logic Theme Warning Must Change' },
    { key: 'storyLogicThemeWarningTransformationArc', label: 'Story Logic Theme Warning Transformation Arc' },
    { key: 'storyLogicThemeSuggestionEmotionalBeats', label: 'Story Logic Theme Suggestion Emotional Beats' },
    { key: 'storyLogicGenreDrama', label: 'Story Logic Genre Drama' },
    { key: 'storyLogicGenreComedy', label: 'Story Logic Genre Comedy' },
    { key: 'storyLogicGenreAction', label: 'Story Logic Genre Action' },
    { key: 'storyLogicGenreThriller', label: 'Story Logic Genre Thriller' },
    { key: 'storyLogicGenreHorror', label: 'Story Logic Genre Horror' },
    { key: 'storyLogicGenreSciFi', label: 'Story Logic Genre Sci-Fi' },
    { key: 'storyLogicGenreFantasy', label: 'Story Logic Genre Fantasy' },
    { key: 'storyLogicGenreRomance', label: 'Story Logic Genre Romance' },
    { key: 'storyLogicGenreMystery', label: 'Story Logic Genre Mystery' },
    { key: 'storyLogicGenreCrime', label: 'Story Logic Genre Crime' },
    { key: 'storyLogicGenreDocumentary', label: 'Story Logic Genre Documentary' },
    { key: 'storyLogicGenreAnimation', label: 'Story Logic Genre Animation' },
    { key: 'storyLogicGenreMusical', label: 'Story Logic Genre Musical' },
    { key: 'storyLogicGenreWestern', label: 'Story Logic Genre Western' },
    { key: 'storyLogicGenreWar', label: 'Story Logic Genre War' },
    { key: 'storyLogicGenreBiography', label: 'Story Logic Genre Biography' },
    { key: 'storyLogicSubGenreDramaFamily', label: 'Story Logic Sub-Genre Drama Family' },
    { key: 'storyLogicSubGenreDramaLegal', label: 'Story Logic Sub-Genre Drama Legal' },
    { key: 'storyLogicSubGenreDramaMedical', label: 'Story Logic Sub-Genre Drama Medical' },
    { key: 'storyLogicSubGenreDramaPolitical', label: 'Story Logic Sub-Genre Drama Political' },
    { key: 'storyLogicSubGenreDramaSports', label: 'Story Logic Sub-Genre Drama Sports' },
    { key: 'storyLogicSubGenreComedyRomantic', label: 'Story Logic Sub-Genre Comedy Romantic' },
    { key: 'storyLogicSubGenreComedyDark', label: 'Story Logic Sub-Genre Comedy Dark' },
    { key: 'storyLogicSubGenreComedySatire', label: 'Story Logic Sub-Genre Comedy Satire' },
    { key: 'storyLogicSubGenreComedySlapstick', label: 'Story Logic Sub-Genre Comedy Slapstick' },
    { key: 'storyLogicSubGenreComedyParody', label: 'Story Logic Sub-Genre Comedy Parody' },
    { key: 'storyLogicSubGenreActionMartialArts', label: 'Story Logic Sub-Genre Action Martial Arts' },
    { key: 'storyLogicSubGenreActionSpy', label: 'Story Logic Sub-Genre Action Spy' },
    { key: 'storyLogicSubGenreActionHeist', label: 'Story Logic Sub-Genre Action Heist' },
    { key: 'storyLogicSubGenreActionDisaster', label: 'Story Logic Sub-Genre Action Disaster' },
    { key: 'storyLogicSubGenreActionSuperhero', label: 'Story Logic Sub-Genre Action Superhero' },
    { key: 'storyLogicSubGenreThrillerPsychological', label: 'Story Logic Sub-Genre Thriller Psychological' },
    { key: 'storyLogicSubGenreThrillerPolitical', label: 'Story Logic Sub-Genre Thriller Political' },
    { key: 'storyLogicSubGenreThrillerLegal', label: 'Story Logic Sub-Genre Thriller Legal' },
    { key: 'storyLogicSubGenreThrillerTechno', label: 'Story Logic Sub-Genre Thriller Techno' },
    { key: 'storyLogicSubGenreThrillerConspiracy', label: 'Story Logic Sub-Genre Thriller Conspiracy' },
    { key: 'storyLogicSubGenreHorrorSupernatural', label: 'Story Logic Sub-Genre Horror Supernatural' },
    { key: 'storyLogicSubGenreHorrorSlasher', label: 'Story Logic Sub-Genre Horror Slasher' },
    { key: 'storyLogicSubGenreHorrorPsychological', label: 'Story Logic Sub-Genre Horror Psychological' },
    { key: 'storyLogicSubGenreHorrorBody', label: 'Story Logic Sub-Genre Horror Body' },
    { key: 'storyLogicSubGenreHorrorFoundFootage', label: 'Story Logic Sub-Genre Horror Found Footage' },
    { key: 'storyLogicSubGenreSciFiSpaceOpera', label: 'Story Logic Sub-Genre Sci-Fi Space Opera' },
    { key: 'storyLogicSubGenreSciFiCyberpunk', label: 'Story Logic Sub-Genre Sci-Fi Cyberpunk' },
    { key: 'storyLogicSubGenreSciFiPostApocalyptic', label: 'Story Logic Sub-Genre Sci-Fi Post-Apocalyptic' },
    { key: 'storyLogicSubGenreSciFiTimeTravel', label: 'Story Logic Sub-Genre Sci-Fi Time Travel' },
    { key: 'storyLogicSubGenreSciFiAlienInvasion', label: 'Story Logic Sub-Genre Sci-Fi Alien Invasion' },
    { key: 'storyLogicSubGenreFantasyEpic', label: 'Story Logic Sub-Genre Fantasy Epic' },
    { key: 'storyLogicSubGenreFantasyUrban', label: 'Story Logic Sub-Genre Fantasy Urban' },
    { key: 'storyLogicSubGenreFantasyDark', label: 'Story Logic Sub-Genre Fantasy Dark' },
    { key: 'storyLogicSubGenreFantasyFairyTale', label: 'Story Logic Sub-Genre Fantasy Fairy Tale' },
    { key: 'storyLogicSubGenreFantasyMythological', label: 'Story Logic Sub-Genre Fantasy Mythological' },
    { key: 'storyLogicSubGenreRomancePeriod', label: 'Story Logic Sub-Genre Romance Period' },
    { key: 'storyLogicSubGenreRomanceContemporary', label: 'Story Logic Sub-Genre Romance Contemporary' },
    { key: 'storyLogicSubGenreRomanceParanormal', label: 'Story Logic Sub-Genre Romance Paranormal' },
    { key: 'storyLogicSubGenreRomanceTragic', label: 'Story Logic Sub-Genre Romance Tragic' },
    { key: 'storyLogicSubGenreMysteryWhodunit', label: 'Story Logic Sub-Genre Mystery Whodunit' },
    { key: 'storyLogicSubGenreMysteryNoir', label: 'Story Logic Sub-Genre Mystery Noir' },
    { key: 'storyLogicSubGenreMysteryCozy', label: 'Story Logic Sub-Genre Mystery Cozy' },
    { key: 'storyLogicSubGenreMysteryProcedural', label: 'Story Logic Sub-Genre Mystery Procedural' },
    { key: 'storyLogicSubGenreCrimeGangster', label: 'Story Logic Sub-Genre Crime Gangster' },
    { key: 'storyLogicSubGenreCrimeHeist', label: 'Story Logic Sub-Genre Crime Heist' },
    { key: 'storyLogicSubGenreCrimeTrueCrime', label: 'Story Logic Sub-Genre Crime True Crime' },
    { key: 'storyLogicSubGenreCrimeNeoNoir', label: 'Story Logic Sub-Genre Crime Neo-Noir' },
    { key: 'storyLogicToneDark', label: 'Story Logic Tone Dark' },
    { key: 'storyLogicToneLight', label: 'Story Logic Tone Light' },
    { key: 'storyLogicToneSerious', label: 'Story Logic Tone Serious' },
    { key: 'storyLogicToneComedic', label: 'Story Logic Tone Comedic' },
    { key: 'storyLogicToneSuspenseful', label: 'Story Logic Tone Suspenseful' },
    { key: 'storyLogicToneHopeful', label: 'Story Logic Tone Hopeful' },
    { key: 'storyLogicToneMelancholic', label: 'Story Logic Tone Melancholic' },
    { key: 'storyLogicToneSatirical', label: 'Story Logic Tone Satirical' },
    { key: 'storyLogicToneGritty', label: 'Story Logic Tone Gritty' },
    { key: 'storyLogicToneWhimsical', label: 'Story Logic Tone Whimsical' },
    { key: 'storyLogicToneIntense', label: 'Story Logic Tone Intense' },
    { key: 'storyLogicToneRomantic', label: 'Story Logic Tone Romantic' },
    { key: 'storyLogicToneCynical', label: 'Story Logic Tone Cynical' },
    { key: 'storyLogicToneInspirational', label: 'Story Logic Tone Inspirational' },
    { key: 'storyLogicToneSurreal', label: 'Story Logic Tone Surreal' },
    { key: 'storyLogicToneNostalgic', label: 'Story Logic Tone Nostalgic' },
    { key: 'storyLogicAudienceChildrenUnder12', label: 'Story Logic Audience Children Under 12' },
    { key: 'storyLogicAudienceTeen13To17', label: 'Story Logic Audience Teen 13-17' },
    { key: 'storyLogicAudienceYoungAdult18To25', label: 'Story Logic Audience Young Adult 18-25' },
    { key: 'storyLogicAudienceAdult26To45', label: 'Story Logic Audience Adult 26-45' },
    { key: 'storyLogicAudienceMatureAdult46To65', label: 'Story Logic Audience Mature Adult 46-65' },
    { key: 'storyLogicAudienceSenior65Plus', label: 'Story Logic Audience Senior 65+' },
    { key: 'storyLogicAudienceAllAges', label: 'Story Logic Audience All Ages' },
    { key: 'storyLogicEmotionHope', label: 'Story Logic Emotion Hope' },
    { key: 'storyLogicEmotionFear', label: 'Story Logic Emotion Fear' },
    { key: 'storyLogicEmotionJoy', label: 'Story Logic Emotion Joy' },
    { key: 'storyLogicEmotionSadness', label: 'Story Logic Emotion Sadness' },
    { key: 'storyLogicEmotionAnger', label: 'Story Logic Emotion Anger' },
    { key: 'storyLogicEmotionSurprise', label: 'Story Logic Emotion Surprise' },
    { key: 'storyLogicEmotionDisgust', label: 'Story Logic Emotion Disgust' },
    { key: 'storyLogicEmotionTrust', label: 'Story Logic Emotion Trust' },
    { key: 'storyLogicEmotionAnticipation', label: 'Story Logic Emotion Anticipation' },
    { key: 'storyLogicEmotionLove', label: 'Story Logic Emotion Love' },
    { key: 'storyLogicEmotionShame', label: 'Story Logic Emotion Shame' },
    { key: 'storyLogicEmotionPride', label: 'Story Logic Emotion Pride' },
    { key: 'storyLogicEmotionGuilt', label: 'Story Logic Emotion Guilt' },
    { key: 'storyLogicEmotionRelief', label: 'Story Logic Emotion Relief' },
    { key: 'storyLogicEmotionDespair', label: 'Story Logic Emotion Despair' },
    { key: 'storyLogicEmotionTriumph', label: 'Story Logic Emotion Triumph' },
    { key: 'templatePanelTitle', label: 'Template Panel Title' },
    { key: 'templateSearchPlaceholder', label: 'Template Search Placeholder' },
    { key: 'templateTabAll', label: 'Template Tab All' },
    { key: 'templateTabMine', label: 'Template Tab Mine' },
    { key: 'templateTabRecent', label: 'Template Tab Recent' },
    { key: 'templateTabStructures', label: 'Template Tab Structures' },
    { key: 'templateEmpty', label: 'Template Empty' },
    { key: 'templateStoryBeatsLabel', label: 'Template Story Beats Label' },
    { key: 'templatePagesLabel', label: 'Template Pages Label' },
    { key: 'templateBeatPagePrefix', label: 'Template Beat Page Prefix' },
    { key: 'templateDeleteConfirm', label: 'Template Delete Confirm' },
    { key: 'templatePreviewTooltip', label: 'Template Preview Tooltip' },
    { key: 'templateApplyTooltip', label: 'Template Apply Tooltip' },
    { key: 'templatePreviewClose', label: 'Template Preview Close' },
    { key: 'templatePreviewApply', label: 'Template Preview Apply' },
    { key: 'productionReadLabel', label: 'Production Read Label' },
    { key: 'productionReadShort', label: 'Production Read Short' },
    { key: 'productionReadThrough', label: 'Production Read Through' },
    { key: 'productionReadThroughShort', label: 'Production Read Through Short' },
    { key: 'productionManuscriptLabel', label: 'Production Manuscript Label' },
    { key: 'productionManuscriptShort', label: 'Production Manuscript Short' },
    { key: 'productionSceneLabel', label: 'Production Scene Label' },
    { key: 'productionLineLabel', label: 'Production Line Label' },
    { key: 'productionOfLabel', label: 'Production Of Label' },
    { key: 'productionZoomIn', label: 'Production Zoom In' },
    { key: 'productionZoomOut', label: 'Production Zoom Out' },
    { key: 'productionHeaderShort', label: 'Production Header Short' },
    { key: 'productionHeaderLong', label: 'Production Header Long' },
    { key: 'productionShortcutsTitle', label: 'Production Shortcuts Title' },
    { key: 'productionShortcutsLabel', label: 'Production Shortcuts Label' },
    { key: 'productionShortcutPlayPause', label: 'Production Shortcut Play/Pause' },
    { key: 'productionShortcutNavigate', label: 'Production Shortcut Navigate' },
    { key: 'productionShortcutUndo', label: 'Production Shortcut Undo' },
    { key: 'productionShortcutRedo', label: 'Production Shortcut Redo' },
    { key: 'productionShortcutSelectAll', label: 'Production Shortcut Select All' },
    { key: 'productionShortcutDelete', label: 'Production Shortcut Delete' },
    { key: 'productionShortcutClear', label: 'Production Shortcut Clear' },
    { key: 'productionReadThroughStart', label: 'Production Read Through Start' },
    { key: 'productionReadThroughStop', label: 'Production Read Through Stop' },
    { key: 'productionTalentShow', label: 'Production Talent Show' },
    { key: 'productionTalentHide', label: 'Production Talent Hide' },
    { key: 'productionQuickNotesTooltip', label: 'Production Quick Notes Tooltip' },
    { key: 'productionDuplicateSceneTooltip', label: 'Production Duplicate Scene Tooltip' },
    { key: 'productionSaveTemplateTooltip', label: 'Production Save Template Tooltip' },
    { key: 'productionExportPdfTooltip', label: 'Production Export PDF Tooltip' },
    { key: 'productionCallSheetTooltip', label: 'Production Call Sheet Tooltip' },
    { key: 'productionStripboardTooltip', label: 'Production Stripboard Tooltip' },
    { key: 'productionShootingDayPlannerTooltip', label: 'Production Shooting Day Planner Tooltip' },
    { key: 'productionLiveSetTooltip', label: 'Production Live Set Tooltip' },
    { key: 'productionLiveSetConnectTooltip', label: 'Production Live Set Connect Tooltip' },
    { key: 'productionLiveSetDisconnectTooltip', label: 'Production Live Set Disconnect Tooltip' },
    { key: 'productionSearchPlaceholder', label: 'Production Search Placeholder' },
    { key: 'productionFiltersLabel', label: 'Production Filters Label' },
    { key: 'productionScenesLabel', label: 'Production Scenes Label' },
    { key: 'productionScenesLabelLower', label: 'Production Scenes Label Lower' },
    { key: 'productionScenesShortLabel', label: 'Production Scenes Short Label' },
    { key: 'productionShotsLabel', label: 'Production Shots Label' },
    { key: 'productionShotsLabelLower', label: 'Production Shots Label Lower' },
    { key: 'productionShotsLabelUpper', label: 'Production Shots Label Upper' },
    { key: 'productionCameraLabel', label: 'Production Camera Label' },
    { key: 'productionCameraLabelUpper', label: 'Production Camera Label Upper' },
    { key: 'productionLightLabelUpper', label: 'Production Light Label Upper' },
    { key: 'productionSoundLabelUpper', label: 'Production Sound Label Upper' },
    { key: 'productionLightLabel', label: 'Production Light Label' },
    { key: 'productionSoundLabel', label: 'Production Sound Label' },
    { key: 'productionTagsLabel', label: 'Production Tags Label' },
    { key: 'productionProgressLabel', label: 'Production Progress Label' },
    { key: 'productionCompleteLabel', label: 'Production Complete Label' },
    { key: 'productionTotalLabel', label: 'Production Total Label' },
    { key: 'productionSortNumber', label: 'Production Sort Number' },
    { key: 'productionSortDuration', label: 'Production Sort Duration' },
    { key: 'productionSortDate', label: 'Production Sort Date' },
    { key: 'productionSortName', label: 'Production Sort Name' },
    { key: 'productionSortAscending', label: 'Production Sort Ascending' },
    { key: 'productionSortDescending', label: 'Production Sort Descending' },
    { key: 'productionSortByLabel', label: 'Production Sort By Label' },
    { key: 'productionSortOptionNumber', label: 'Production Sort Option Number' },
    { key: 'productionSortOptionDuration', label: 'Production Sort Option Duration' },
    { key: 'productionSortOptionDate', label: 'Production Sort Option Date' },
    { key: 'productionSortOptionName', label: 'Production Sort Option Name' },
    { key: 'productionActLabel', label: 'Production Act Label' },
    { key: 'productionVisibleLabel', label: 'Production Visible Label' },
    { key: 'productionBatchScenesSelected', label: 'Production Batch Scenes Selected' },
    { key: 'productionBatchSceneSelected', label: 'Production Batch Scene Selected' },
    { key: 'productionBatchExportTooltip', label: 'Production Batch Export Tooltip' },
    { key: 'productionBatchDeleteTooltip', label: 'Production Batch Delete Tooltip' },
    { key: 'productionBatchClearTooltip', label: 'Production Batch Clear Tooltip' },
    { key: 'productionBatchDeleteConfirmPrefix', label: 'Production Batch Delete Confirm Prefix' },
    { key: 'productionBatchDeleteConfirmSuffix', label: 'Production Batch Delete Confirm Suffix' },
    { key: 'productionAddSceneTooltip', label: 'Production Add Scene Tooltip' },
    { key: 'productionNewSceneLabel', label: 'Production New Scene Label' },
    { key: 'productionNewSceneDialogTitle', label: 'Production New Scene Dialog Title' },
    { key: 'productionNewSceneDialogBody', label: 'Production New Scene Dialog Body' },
    { key: 'productionNewSceneDialogAction', label: 'Production New Scene Dialog Action' },
    { key: 'productionNewSceneHeadingDefault', label: 'Production New Scene Heading Default' },
    { key: 'productionNewSceneLocationDefault', label: 'Production New Scene Location Default' },
    { key: 'productionNewSceneIntDefault', label: 'Production New Scene INT Default' },
    { key: 'productionNewSceneTimeDefault', label: 'Production New Scene Time Default' },
    { key: 'productionDeleteSceneTitle', label: 'Production Delete Scene Title' },
    { key: 'productionDeleteSceneBody', label: 'Production Delete Scene Body' },
    { key: 'productionDeleteSceneAction', label: 'Production Delete Scene Action' },
    { key: 'productionExportProductionTooltip', label: 'Production Export Production Tooltip' },
    { key: 'productionSceneBadgeLabel', label: 'Production Scene Badge Label' },
    { key: 'productionInteriorLabel', label: 'Production Interior Label' },
    { key: 'productionExteriorLabel', label: 'Production Exterior Label' },
    { key: 'productionQuickActionsLabel', label: 'Production Quick Actions Label' },
    { key: 'productionNeedsTooltip', label: 'Production Needs Tooltip' },
    { key: 'productionNeedsButton', label: 'Production Needs Button' },
    { key: 'productionScheduleTooltip', label: 'Production Schedule Tooltip' },
    { key: 'productionScheduleButton', label: 'Production Schedule Button' },
    { key: 'productionChecklistTooltip', label: 'Production Checklist Tooltip' },
    { key: 'productionChecklistButton', label: 'Production Checklist Button' },
    { key: 'productionBulkShotsTooltip', label: 'Production Bulk Shots Tooltip' },
    { key: 'productionBulkShotsButton', label: 'Production Bulk Shots Button' },
    { key: 'productionLineCoverageTooltip', label: 'Production Line Coverage Tooltip' },
    { key: 'productionLineCoverageButton', label: 'Production Line Coverage Button' },
    { key: 'productionSyncStatusTooltip', label: 'Production Sync Status Tooltip' },
    { key: 'productionSyncStatusButton', label: 'Production Sync Status Button' },
    { key: 'productionReferenceImageLabel', label: 'Production Reference Image Label' },
    { key: 'productionReferenceFromCasting', label: 'Production Reference From Casting' },
    { key: 'productionDialogueLabel', label: 'Production Dialogue Label' },
    { key: 'productionDialogueLinesLabel', label: 'Production Dialogue Lines Label' },
    { key: 'productionDialogueLinesTitle', label: 'Production Dialogue Lines Title' },
    { key: 'productionNoDialogueLabel', label: 'Production No Dialogue Label' },
    { key: 'productionReadThroughNotesLabel', label: 'Production Read Through Notes Label' },
    { key: 'productionProductionNotesLabel', label: 'Production Notes Label' },
    { key: 'productionAddNoteTooltip', label: 'Production Add Note Tooltip' },
    { key: 'productionReadThroughPlaceholder', label: 'Production Read Through Placeholder' },
    { key: 'productionCameraNoteLabel', label: 'Production Camera Note Label' },
    { key: 'productionCameraNoteEditPlaceholder', label: 'Production Camera Note Edit Placeholder' },
    { key: 'productionCameraNotePlaceholder', label: 'Production Camera Note Placeholder' },
    { key: 'productionDirectorNoteLabel', label: 'Production Director Note Label' },
    { key: 'productionDirectorNoteEditPlaceholder', label: 'Production Director Note Edit Placeholder' },
    { key: 'productionDirectorNotePlaceholder', label: 'Production Director Note Placeholder' },
    { key: 'productionStatusLabel', label: 'Production Status Label' },
    { key: 'productionStatusNotStarted', label: 'Production Status Not Started' },
    { key: 'productionStatusInProgress', label: 'Production Status In Progress' },
    { key: 'productionStatusComplete', label: 'Production Status Complete' },
    { key: 'productionStoryboardShotsLabel', label: 'Production Storyboard Shots Label' },
    { key: 'productionAddShotTooltip', label: 'Production Add Shot Tooltip' },
    { key: 'productionNoShotsLabel', label: 'Production No Shots Label' },
    { key: 'productionAddFirstShotLabel', label: 'Production Add First Shot Label' },
    { key: 'productionSelectSceneTitle', label: 'Production Select Scene Title' },
    { key: 'productionSelectSceneBody', label: 'Production Select Scene Body' },
    { key: 'productionTimelineLabel', label: 'Production Timeline Label' },
    { key: 'productionTimelinePause', label: 'Production Timeline Pause' },
    { key: 'productionTimelinePlay', label: 'Production Timeline Play' },
    { key: 'productionTimelineZoomIn', label: 'Production Timeline Zoom In' },
    { key: 'productionTimelineZoomOut', label: 'Production Timeline Zoom Out' },
    { key: 'productionOvertimeLabel', label: 'Production Overtime Label' },
    { key: 'productionGridView', label: 'Production Grid View' },
    { key: 'productionGridViewActive', label: 'Production Grid View Active' },
    { key: 'productionListView', label: 'Production List View' },
    { key: 'productionListViewActive', label: 'Production List View Active' },
    { key: 'productionAudioLabel', label: 'Production Audio Label' },
    { key: 'productionVideoLabel', label: 'Production Video Label' },
    { key: 'productionActiveSceneLabel', label: 'Production Active Scene Label' },
    { key: 'productionSceneFallback', label: 'Production Scene Fallback' },
    { key: 'productionIntFallback', label: 'Production INT Fallback' },
    { key: 'productionLocationFallback', label: 'Production Location Fallback' },
    { key: 'productionTimeFallback', label: 'Production Time Fallback' },
    { key: 'productionShotLabel', label: 'Production Shot Label' },
    { key: 'productionShotFallbackType', label: 'Production Shot Fallback Type' },
    { key: 'productionShotTypeWide', label: 'Production Shot Type Wide' },
    { key: 'productionShotTypeCloseUp', label: 'Production Shot Type Close Up' },
    { key: 'productionShotTypeMedium', label: 'Production Shot Type Medium' },
    { key: 'productionShotTypeExtremeCloseUp', label: 'Production Shot Type Extreme Close Up' },
    { key: 'productionShotTypeEstablishing', label: 'Production Shot Type Establishing' },
    { key: 'productionShotTypeDetail', label: 'Production Shot Type Detail' },
    { key: 'productionShotTypeTwoShot', label: 'Production Shot Type Two Shot' },
    { key: 'productionShotTypeOverShoulder', label: 'Production Shot Type Over Shoulder' },
    { key: 'productionShotTypePOV', label: 'Production Shot Type POV' },
    { key: 'productionShotTypeInsert', label: 'Production Shot Type Insert' },
    { key: 'productionNewShotDescriptionDefault', label: 'Production New Shot Description Default' },
    { key: 'productionShotInspectorLabel', label: 'Production Shot Inspector Label' },
    { key: 'productionShotDetailsFallback', label: 'Production Shot Details Fallback' },
    { key: 'productionCameraSectionLabel', label: 'Production Camera Section Label' },
    { key: 'productionLensLabel', label: 'Production Lens Label' },
    { key: 'productionMovementLabel', label: 'Production Movement Label' },
    { key: 'productionFramingLabel', label: 'Production Framing Label' },
    { key: 'productionNotSetLabel', label: 'Production Not Set Label' },
    { key: 'productionLightingSectionLabel', label: 'Production Lighting Section Label' },
    { key: 'productionKeyLightLabel', label: 'Production Key Light Label' },
    { key: 'productionTemperatureLabel', label: 'Production Temperature Label' },
    { key: 'productionRatioLabel', label: 'Production Ratio Label' },
    { key: 'productionSoundSectionLabel', label: 'Production Sound Section Label' },
    { key: 'productionMicLabel', label: 'Production Mic Label' },
    { key: 'productionAmbienceLabel', label: 'Production Ambience Label' },
    { key: 'productionNotesLabel', label: 'Production Notes Label' },
    { key: 'productionCameraEquipmentLabel', label: 'Production Camera Equipment Label' },
    { key: 'productionSyncedTooltip', label: 'Production Synced Tooltip' },
    { key: 'productionSyncedLabel', label: 'Production Synced Label' },
    { key: 'productionInventoryLabel', label: 'Production Inventory Label' },
    { key: 'productionStandardLabel', label: 'Production Standard Label' },
    { key: 'productionLensLabelUpper', label: 'Production Lens Label Upper' },
    { key: 'productionRigLabel', label: 'Production Rig Label' },
    { key: 'productionShotTypeLabel', label: 'Production Shot Type Label' },
    { key: 'productionShotListLabel', label: 'Production Shot List Label' },
    { key: 'productionCopySettingsTooltip', label: 'Production Copy Settings Tooltip' },
    { key: 'productionSavePresetTooltip', label: 'Production Save Preset Tooltip' },
    { key: 'productionReferencesLabel', label: 'Production References Label' },
    { key: 'productionReferencesUploadedSuffix', label: 'Production References Uploaded Suffix' },
    { key: 'productionReferencesSources', label: 'Production References Sources' },
    { key: 'productionReferencesUploadedLabel', label: 'Production References Uploaded Label' },
    { key: 'productionReferenceUploadedSource', label: 'Production Reference Uploaded Source' },
    { key: 'productionReferenceTitlePrefix', label: 'Production Reference Title Prefix' },
    { key: 'productionCenterPanelLabel', label: 'Production Center Panel Label' },
    { key: 'productionUploadLabel', label: 'Production Upload Label' },
    { key: 'productionSearchReferencesLabel', label: 'Production Search References Label' },
    { key: 'productionReferenceSearchTitle', label: 'Production Reference Search Title' },
    { key: 'productionReferenceSearchBack', label: 'Production Reference Search Back' },
    { key: 'productionReferenceSearchPlaceholder', label: 'Production Reference Search Placeholder' },
    { key: 'productionSearchLabel', label: 'Production Search Label' },
    { key: 'productionSourceAllLabel', label: 'Production Source All Label' },
    { key: 'productionSourceShotCafeLabel', label: 'Production Source ShotCafe Label' },
    { key: 'productionSourceUnsplashLabel', label: 'Production Source Unsplash Label' },
    { key: 'productionReferenceSearchLoading', label: 'Production Reference Search Loading' },
    { key: 'productionReferenceQuerySceneFallback', label: 'Production Reference Query Scene Fallback' },
    { key: 'productionReferenceQueryDayFallback', label: 'Production Reference Query Day Fallback' },
    { key: 'productionReferenceQuerySuffix', label: 'Production Reference Query Suffix' },
    { key: 'productionReferenceAttributionDemoImage', label: 'Production Reference Attribution Demo Image' },
    { key: 'productionReferenceAttributionReferenceImage', label: 'Production Reference Attribution Reference Image' },
    { key: 'productionDefaultCamera', label: 'Production Default Camera' },
    { key: 'productionDefaultLens', label: 'Production Default Lens' },
    { key: 'productionDefaultRig', label: 'Production Default Rig' },
    { key: 'productionDefaultShotType', label: 'Production Default Shot Type' },
    { key: 'productionDefaultKeyLight', label: 'Production Default Key Light' },
    { key: 'productionDefaultSideLight', label: 'Production Default Side Light' },
    { key: 'productionDefaultGel', label: 'Production Default Gel' },
    { key: 'productionDefaultMic', label: 'Production Default Mic' },
    { key: 'productionDefaultAtmos', label: 'Production Default Atmos' },
    { key: 'productionCameraAngleEyeLevel', label: 'Production Camera Angle Eye Level' },
    { key: 'productionLensOption50mmPrime', label: 'Production Lens Option 50mm Prime' },
    { key: 'productionLensOption35mmPrime', label: 'Production Lens Option 35mm Prime' },
    { key: 'productionLensOption85mmPrime', label: 'Production Lens Option 85mm Prime' },
    { key: 'productionLensOption24_70Zoom', label: 'Production Lens Option 24-70 Zoom' },
    { key: 'productionLensOption70_200Zoom', label: 'Production Lens Option 70-200 Zoom' },
    { key: 'productionLensOption16mmWide', label: 'Production Lens Option 16mm Wide' },
    { key: 'productionLensOption100mmMacro', label: 'Production Lens Option 100mm Macro' },
    { key: 'productionRigOptionTripod', label: 'Production Rig Option Tripod' },
    { key: 'productionRigOptionSteadicam', label: 'Production Rig Option Steadicam' },
    { key: 'productionRigOptionGimbal', label: 'Production Rig Option Gimbal' },
    { key: 'productionRigOptionHandheld', label: 'Production Rig Option Handheld' },
    { key: 'productionRigOptionDolly', label: 'Production Rig Option Dolly' },
    { key: 'productionRigOptionCrane', label: 'Production Rig Option Crane' },
    { key: 'productionRigOptionDrone', label: 'Production Rig Option Drone' },
    { key: 'productionRigOptionShoulderRig', label: 'Production Rig Option Shoulder Rig' },
    { key: 'productionRigOptionSlider', label: 'Production Rig Option Slider' },
    { key: 'productionKeyLightOptionSoftSide', label: 'Production Key Light Option Soft Side' },
    { key: 'productionKeyLightOptionKeyLight1200', label: 'Production Key Light Option 1200W' },
    { key: 'productionKeyLightOptionKeyLight600', label: 'Production Key Light Option 600W' },
    { key: 'productionKeyLightOptionSoftbox', label: 'Production Key Light Option Softbox' },
    { key: 'productionKeyLightOptionLedPanel', label: 'Production Key Light Option LED Panel' },
    { key: 'productionKeyLightOptionHmi', label: 'Production Key Light Option HMI' },
    { key: 'productionKeyLightOptionNatural', label: 'Production Key Light Option Natural' },
    { key: 'productionSideLightOptionWarmTone', label: 'Production Side Light Option Warm Tone' },
    { key: 'productionSideLightOptionSideLighting', label: 'Production Side Light Option Side Lighting' },
    { key: 'productionSideLightOptionFillLight', label: 'Production Side Light Option Fill Light' },
    { key: 'productionSideLightOptionRimLight', label: 'Production Side Light Option Rim Light' },
    { key: 'productionSideLightOptionBackLight', label: 'Production Side Light Option Back Light' },
    { key: 'productionSideLightOptionPractical', label: 'Production Side Light Option Practical' },
    { key: 'productionSideLightOptionNatural', label: 'Production Side Light Option Natural' },
    { key: 'productionGelOptionWarmQuarterCto', label: 'Production Gel Option Warm 1/4 CTO' },
    { key: 'productionGelOptionWarmHalfCto', label: 'Production Gel Option Warm 1/2 CTO' },
    { key: 'productionGelOptionFullCto', label: 'Production Gel Option Full CTO' },
    { key: 'productionGelOptionQuarterCtb', label: 'Production Gel Option 1/4 CTB' },
    { key: 'productionGelOptionHalfCtb', label: 'Production Gel Option 1/2 CTB' },
    { key: 'productionGelOptionNone', label: 'Production Gel Option None' },
    { key: 'productionMicOptionBoom', label: 'Production Mic Option Boom' },
    { key: 'productionMicOptionLav', label: 'Production Mic Option Lav' },
    { key: 'productionMicOptionShotgun', label: 'Production Mic Option Shotgun' },
    { key: 'productionMicOptionWirelessLav', label: 'Production Mic Option Wireless Lav' },
    { key: 'productionMicOptionPlant', label: 'Production Mic Option Plant' },
    { key: 'productionAtmosOptionRoomTone', label: 'Production Atmos Option Room Tone' },
    { key: 'productionAtmosOptionQuiet', label: 'Production Atmos Option Quiet' },
    { key: 'productionAtmosOptionNatural', label: 'Production Atmos Option Natural' },
    { key: 'productionAtmosOptionCityTraffic', label: 'Production Atmos Option City Traffic' },
    { key: 'productionAtmosOptionNature', label: 'Production Atmos Option Nature' },
    { key: 'productionAtmosOptionInterior', label: 'Production Atmos Option Interior' },
    { key: 'productionCameraSonyFx6', label: 'Production Camera Sony FX6' },
    { key: 'productionCameraSonyFx3', label: 'Production Camera Sony FX3' },
    { key: 'productionCameraSonyA7s3', label: 'Production Camera Sony A7S III' },
    { key: 'productionCameraSonyVenice2', label: 'Production Camera Sony Venice 2' },
    { key: 'productionCameraRedKomodo', label: 'Production Camera RED Komodo' },
    { key: 'productionCameraRedVRaptor', label: 'Production Camera RED V-Raptor' },
    { key: 'productionCameraArriAlexaMiniLf', label: 'Production Camera ARRI Alexa Mini LF' },
    { key: 'productionCameraArriAlexa35', label: 'Production Camera ARRI Alexa 35' },
    { key: 'productionCameraBlackmagicUrsaMiniPro', label: 'Production Camera Blackmagic URSA Mini Pro' },
    { key: 'productionCameraCanonC70', label: 'Production Camera Canon C70' },
    { key: 'productionCameraCanonR5c', label: 'Production Camera Canon R5 C' },
    { key: 'productionCameraPanasonicS1h', label: 'Production Camera Panasonic S1H' },
    { key: 'productionLensDefault50mmPrime', label: 'Production Lens Default 50mm Prime' },
    { key: 'productionLensDefault35mmPrime', label: 'Production Lens Default 35mm Prime' },
    { key: 'productionLensDefault85mmPrime', label: 'Production Lens Default 85mm Prime' },
    { key: 'productionLensDefault2470mm', label: 'Production Lens Default 24-70mm' },
    { key: 'productionMovementStatic', label: 'Production Movement Static' },
    { key: 'productionMovementSlowPushIn', label: 'Production Movement Slow Push In' },
    { key: 'productionMovementDolly', label: 'Production Movement Dolly' },
    { key: 'productionMovementPan', label: 'Production Movement Pan' },
    { key: 'productionFramingWide', label: 'Production Framing Wide' },
    { key: 'productionFramingMedium', label: 'Production Framing Medium' },
    { key: 'productionFramingCloseUp', label: 'Production Framing Close Up' },
    { key: 'productionFramingExtremeCloseUp', label: 'Production Framing Extreme Close Up' },
    { key: 'productionLightingKeySoftSide', label: 'Production Lighting Key Soft Side' },
    { key: 'productionLightingKey4ft', label: 'Production Lighting Key 4ft' },
    { key: 'productionLightingKeyBacklightOnly', label: 'Production Lighting Key Backlight Only' },
    { key: 'productionLightingKeyRingLight', label: 'Production Lighting Key Ring Light' },
    { key: 'productionLightingTemp3200k', label: 'Production Lighting Temp 3200K' },
    { key: 'productionLightingTemp5600k', label: 'Production Lighting Temp 5600K' },
    { key: 'productionLightingTemp4300k', label: 'Production Lighting Temp 4300K' },
    { key: 'productionLightingRatio3to1', label: 'Production Lighting Ratio 3:1' },
    { key: 'productionLightingRatio2to1', label: 'Production Lighting Ratio 2:1' },
    { key: 'productionLightingRatio4to1', label: 'Production Lighting Ratio 4:1' },
    { key: 'productionLightingRatio1_5to1', label: 'Production Lighting Ratio 1.5:1' },
    { key: 'productionSoundMicBoom', label: 'Production Sound Mic Boom' },
    { key: 'productionSoundMicLav', label: 'Production Sound Mic Lav' },
    { key: 'productionSoundMicWireless', label: 'Production Sound Mic Wireless' },
    { key: 'productionSoundMicStudio', label: 'Production Sound Mic Studio' },
    { key: 'productionSoundAmbienceQuietInterior', label: 'Production Sound Ambience Quiet Interior' },
    { key: 'productionSoundAmbienceStreetTraffic', label: 'Production Sound Ambience Street Traffic' },
    { key: 'productionSoundAmbienceForest', label: 'Production Sound Ambience Forest' },
    { key: 'productionSoundAmbienceEmptyRoom', label: 'Production Sound Ambience Empty Room' },
    { key: 'productionSoundNotesMonitorLevels', label: 'Production Sound Notes Monitor Levels' },
    { key: 'productionSoundNotesWatchWind', label: 'Production Sound Notes Watch Wind' },
    { key: 'productionSoundNotesAcHum', label: 'Production Sound Notes AC Hum' },
    { key: 'productionSoundNotesCleanTake', label: 'Production Sound Notes Clean Take' },
    { key: 'productionTimelineMarker0000', label: 'Production Timeline Marker 00:00' },
    { key: 'productionTimelineMarker0030', label: 'Production Timeline Marker 00:30' },
    { key: 'productionTimelineMarker0100', label: 'Production Timeline Marker 01:00' },
    { key: 'productionTimelineMarker0130', label: 'Production Timeline Marker 01:30' },
    { key: 'productionTimelineMarker0200', label: 'Production Timeline Marker 02:00' },
    { key: 'productionTimelineMarker0230', label: 'Production Timeline Marker 02:30' },
    { key: 'productionTimelineMarker0300', label: 'Production Timeline Marker 03:00' },
    { key: 'productionSortAscendingSymbol', label: 'Production Sort Ascending Symbol' },
    { key: 'productionSortDescendingSymbol', label: 'Production Sort Descending Symbol' },
    { key: 'productionDirectorNoteBadge', label: 'Production Director Note Badge' },
    { key: 'productionBatchExportFilenamePrefix', label: 'Production Batch Export Filename Prefix' },
    { key: 'productionBatchExportFilenameSuffix', label: 'Production Batch Export Filename Suffix' },
    { key: 'productionReferenceSelectFramePrefix', label: 'Production Reference Select Frame Prefix' },
    { key: 'productionReferenceSelectFrameSuffix', label: 'Production Reference Select Frame Suffix' },
    { key: 'productionReferenceChooseAction', label: 'Production Reference Choose Action' },
    { key: 'productionAddToCenterPanelLabel', label: 'Production Add To Center Panel Label' },
    { key: 'productionOpenShotCafeLabel', label: 'Production Open ShotCafe Label' },
    { key: 'productionShotCafeFilmsLabel', label: 'Production ShotCafe Films Label' },
    { key: 'productionResultsLabel', label: 'Production Results Label' },
    { key: 'productionFramesLabel', label: 'Production Frames Label' },
    { key: 'productionCinematographerLabel', label: 'Production Cinematographer Label' },
    { key: 'productionMoodImagesLabel', label: 'Production Mood Images Label' },
    { key: 'productionReferenceEmptyTitle', label: 'Production Reference Empty Title' },
    { key: 'productionReferenceEmptyBody', label: 'Production Reference Empty Body' },
    { key: 'productionReferenceAttribution', label: 'Production Reference Attribution' },
    { key: 'productionReferenceTagBladeRunner', label: 'Production Reference Tag Blade Runner' },
    { key: 'productionReferenceTagNoir', label: 'Production Reference Tag Noir' },
    { key: 'productionReferenceTagGoldenHour', label: 'Production Reference Tag Golden Hour' },
    { key: 'productionReferenceTagSilhouette', label: 'Production Reference Tag Silhouette' },
    { key: 'productionReferenceTagCloseUp', label: 'Production Reference Tag Close Up' },
    { key: 'productionReferenceTagWideShot', label: 'Production Reference Tag Wide Shot' },
    { key: 'productionReferenceTagSicario', label: 'Production Reference Tag Sicario' },
    { key: 'productionReferenceTagJoker', label: 'Production Reference Tag Joker' },
    { key: 'productionReferenceTagDune', label: 'Production Reference Tag Dune' },
    { key: 'productionReferenceTagTheBatman', label: 'Production Reference Tag The Batman' },
    { key: 'productionReferenceTagInterstellar', label: 'Production Reference Tag Interstellar' },
    { key: 'productionReferenceTagRogerDeakins', label: 'Production Reference Tag Roger Deakins' },
    { key: 'productionReferenceTagChivo', label: 'Production Reference Tag Chivo' },
    { key: 'productionStripboardTitlePrefix', label: 'Production Stripboard Title Prefix' },
    { key: 'productionShootingDayPlannerTitlePrefix', label: 'Production Shooting Day Planner Title Prefix' },
    { key: 'productionLiveSetDayTitle', label: 'Production Live Set Day Title' },
    { key: 'productionLiveSetDayBody', label: 'Production Live Set Day Body' },
    { key: 'productionDayLabel', label: 'Production Day Label' },
    { key: 'productionDayStatusWrapped', label: 'Production Day Status Wrapped' },
    { key: 'productionDayStatusInProgress', label: 'Production Day Status In Progress' },
    { key: 'productionDayStatusPlanned', label: 'Production Day Status Planned' },
    { key: 'productionCallSheetPreviewTitlePrefix', label: 'Production Call Sheet Preview Title Prefix' },
    { key: 'productionCallSheetFilenamePrefix', label: 'Production Call Sheet Filename Prefix' },
    { key: 'productionExportDialogTitle', label: 'Production Export Dialog Title' },
    { key: 'productionExportDialogBody', label: 'Production Export Dialog Body' },
    { key: 'productionExportDialogContentsLabel', label: 'Production Export Dialog Contents Label' },
    { key: 'productionExportDialogEquipmentLabel', label: 'Production Export Dialog Equipment Label' },
    { key: 'productionExportDialogAction', label: 'Production Export Dialog Action' },
    { key: 'productionPdfSceneLabel', label: 'Production PDF Scene Label' },
    { key: 'productionPdfCharactersLabel', label: 'Production PDF Characters Label' },
    { key: 'productionPdfShotsLabel', label: 'Production PDF Shots Label' },
    { key: 'productionPdfNotesLabel', label: 'Production PDF Notes Label' },
    { key: 'productionPdfNoDescription', label: 'Production PDF No Description' },
    { key: 'productionPdfNoCharacters', label: 'Production PDF No Characters' },
    { key: 'productionPdfNoNotes', label: 'Production PDF No Notes' },
    { key: 'productionTalentPanelTitle', label: 'Production Talent Panel Title' },
    { key: 'productionSceneLabelUpper', label: 'Production Scene Label Upper' },
    { key: 'productionCharactersLabel', label: 'Production Characters Label' },
    { key: 'productionConfirmedCastLabel', label: 'Production Confirmed Cast Label' },
    { key: 'productionInSceneLabel', label: 'Production In Scene Label' },
    { key: 'productionNoConfirmedCastTitle', label: 'Production No Confirmed Cast Title' },
    { key: 'productionNoConfirmedCastBodyPrefix', label: 'Production No Confirmed Cast Body Prefix' },
    { key: 'productionNoConfirmedCastBodySuffix', label: 'Production No Confirmed Cast Body Suffix' },
    { key: 'productionQuickNotesTitle', label: 'Production Quick Notes Title' },
    { key: 'productionQuickNotesPlaceholder', label: 'Production Quick Notes Placeholder' },
    { key: 'productionDoneLabel', label: 'Production Done Label' },
    { key: 'productionSaveTemplateTitle', label: 'Production Save Template Title' },
    { key: 'productionTemplateNameLabel', label: 'Production Template Name Label' },
    { key: 'productionTemplateNamePlaceholder', label: 'Production Template Name Placeholder' },
    { key: 'productionAvailableTemplatesLabel', label: 'Production Available Templates Label' },
    { key: 'productionNoTemplatesLabel', label: 'Production No Templates Label' },
    { key: 'productionSaveTemplateAction', label: 'Production Save Template Action' },
    { key: 'productionTagsFiltersTitle', label: 'Production Tags Filters Title' },
    { key: 'productionSelectedLabel', label: 'Production Selected Label' },
    { key: 'productionSceneTagsLabel', label: 'Production Scene Tags Label' },
    { key: 'productionEquipmentNeedsLabel', label: 'Production Equipment Needs Label' },
    { key: 'productionMissingCameraEquipmentLabel', label: 'Production Missing Camera Equipment Label' },
    { key: 'productionMissingLightingLabel', label: 'Production Missing Lighting Label' },
    { key: 'productionMissingAudioLabel', label: 'Production Missing Audio Label' },
    { key: 'productionCloseLabel', label: 'Production Close Label' },
    { key: 'productionSavePresetDialogTitle', label: 'Production Save Preset Dialog Title' },
    { key: 'productionSavePresetDialogBody', label: 'Production Save Preset Dialog Body' },
    { key: 'productionSavePresetNamePlaceholder', label: 'Production Save Preset Name Placeholder' },
    { key: 'productionSavePresetSettingsLabel', label: 'Production Save Preset Settings Label' },
    { key: 'productionShotTypeValueLabel', label: 'Production Shot Type Value Label' },
    { key: 'productionSavePresetAction', label: 'Production Save Preset Action' },
    { key: 'productionAddNoteTitle', label: 'Production Add Note Title' },
    { key: 'productionAddNoteBodyPrefix', label: 'Production Add Note Body Prefix' },
    { key: 'productionAddNoteTypeLabel', label: 'Production Add Note Type Label' },
    { key: 'productionDirectorLabel', label: 'Production Director Label' },
    { key: 'productionVfxLabel', label: 'Production VFX Label' },
    { key: 'productionAddNotePlaceholder', label: 'Production Add Note Placeholder' },
    { key: 'productionAddLabel', label: 'Production Add Label' },
    { key: 'productionAddShotDialogTitle', label: 'Production Add Shot Dialog Title' },
    { key: 'productionBackLabel', label: 'Production Back Label' },
    { key: 'productionAddShotModeLabel', label: 'Production Add Shot Mode Label' },
    { key: 'productionAddShotUploadTitle', label: 'Production Add Shot Upload Title' },
    { key: 'productionAddShotUploadBody', label: 'Production Add Shot Upload Body' },
    { key: 'productionAddShotReferenceTitle', label: 'Production Add Shot Reference Title' },
    { key: 'productionAddShotReferenceBody', label: 'Production Add Shot Reference Body' },
    { key: 'productionAddShotUploadPrompt', label: 'Production Add Shot Upload Prompt' },
    { key: 'productionAddShotChooseAnother', label: 'Production Add Shot Choose Another' },
    { key: 'productionAddShotPickImage', label: 'Production Add Shot Pick Image' },
    { key: 'productionAddShotFormats', label: 'Production Add Shot Formats' },
    { key: 'productionAddShotReferencePrompt', label: 'Production Add Shot Reference Prompt' },
    { key: 'productionAddShotSearchPlaceholder', label: 'Production Add Shot Search Placeholder' },
    { key: 'productionAddShotWithImage', label: 'Production Add Shot With Image' },
    { key: 'productionAddShotWithoutImage', label: 'Production Add Shot Without Image' },
    { key: 'productionSceneNeedsTitle', label: 'Production Scene Needs Title' },
    { key: 'productionSceneNeedsBody', label: 'Production Scene Needs Body' },
    { key: 'productionSceneNeedsCameraDetail', label: 'Production Scene Needs Camera Detail' },
    { key: 'productionSceneNeedsLightDetail', label: 'Production Scene Needs Light Detail' },
    { key: 'productionSceneNeedsSoundDetail', label: 'Production Scene Needs Sound Detail' },
    { key: 'productionScheduleDialogTitle', label: 'Production Schedule Dialog Title' },
    { key: 'productionScheduleDialogBody', label: 'Production Schedule Dialog Body' },
    { key: 'productionScheduleRemoveLabel', label: 'Production Schedule Remove Label' },
    { key: 'productionChecklistDialogTitle', label: 'Production Checklist Dialog Title' },
    { key: 'productionChecklistReadyLabel', label: 'Production Checklist Ready Label' },
    { key: 'productionChecklistStatusLabel', label: 'Production Checklist Status Label' },
    { key: 'productionChecklistProgressLabel', label: 'Production Checklist Progress Label' },
    { key: 'productionChecklistLocation', label: 'Production Checklist Location' },
    { key: 'productionChecklistCast', label: 'Production Checklist Cast' },
    { key: 'productionChecklistProps', label: 'Production Checklist Props' },
    { key: 'productionChecklistEquipment', label: 'Production Checklist Equipment' },
    { key: 'productionChecklistPermits', label: 'Production Checklist Permits' },
    { key: 'productionChecklistScript', label: 'Production Checklist Script' },
    { key: 'productionBulkShotTitle', label: 'Production Bulk Shot Title' },
    { key: 'productionBulkShotBody', label: 'Production Bulk Shot Body' },
    { key: 'productionBulkTemplateStandardTitle', label: 'Production Bulk Template Standard Title' },
    { key: 'productionBulkTemplateStandardDescription', label: 'Production Bulk Template Standard Description' },
    { key: 'productionShotTemplateStandard1', label: 'Production Shot Template Standard 1' },
    { key: 'productionShotTemplateStandard2', label: 'Production Shot Template Standard 2' },
    { key: 'productionShotTemplateStandard3', label: 'Production Shot Template Standard 3' },
    { key: 'productionBulkTemplateDialogueTitle', label: 'Production Bulk Template Dialogue Title' },
    { key: 'productionBulkTemplateDialogueDescription', label: 'Production Bulk Template Dialogue Description' },
    { key: 'productionShotTemplateDialogue1', label: 'Production Shot Template Dialogue 1' },
    { key: 'productionShotTemplateDialogue2', label: 'Production Shot Template Dialogue 2' },
    { key: 'productionShotTemplateDialogue3', label: 'Production Shot Template Dialogue 3' },
    { key: 'productionShotTemplateDialogue4', label: 'Production Shot Template Dialogue 4' },
    { key: 'productionShotTemplateDialogue5', label: 'Production Shot Template Dialogue 5' },
    { key: 'productionShotTemplateDialogue6', label: 'Production Shot Template Dialogue 6' },
    { key: 'productionBulkTemplateActionTitle', label: 'Production Bulk Template Action Title' },
    { key: 'productionBulkTemplateActionDescription', label: 'Production Bulk Template Action Description' },
    { key: 'productionShotTemplateAction1', label: 'Production Shot Template Action 1' },
    { key: 'productionShotTemplateAction2', label: 'Production Shot Template Action 2' },
    { key: 'productionShotTemplateAction3', label: 'Production Shot Template Action 3' },
    { key: 'productionShotTemplateAction4', label: 'Production Shot Template Action 4' },
    { key: 'productionShotTemplateAction5', label: 'Production Shot Template Action 5' },
    { key: 'productionShotTemplateAction6', label: 'Production Shot Template Action 6' },
    { key: 'productionBulkShotsCreatedLabel', label: 'Production Bulk Shots Created Label' },
    { key: 'productionBulkShotsAction', label: 'Production Bulk Shots Action' },
    { key: 'productionLineCoverageTitle', label: 'Production Line Coverage Title' },
    { key: 'productionLineCoverageBody', label: 'Production Line Coverage Body' },
    { key: 'productionLinesCoveredLabel', label: 'Production Lines Covered Label' },
    { key: 'productionCoveredByLabel', label: 'Production Covered By Label' },
    { key: 'productionUncoveredDialogueLabel', label: 'Production Uncovered Dialogue Label' },
    { key: 'productionSceneExistsPrefix', label: 'Production Scene Exists Prefix' },
    { key: 'productionSceneExistsSuffix', label: 'Production Scene Exists Suffix' },
    { key: 'productionSceneNumberValidation', label: 'Production Scene Number Validation' },
    { key: 'productionSaveLabel', label: 'Production Save Label' },
    { key: 'productionExitFullscreen', label: 'Production Exit Fullscreen' },
    { key: 'productionEnterFullscreen', label: 'Production Enter Fullscreen' },
    { key: 'productionCancelLabel', label: 'Production Cancel Label' },
    { key: 'storyArcStudio', label: 'Story Arc Studio' },
    { key: 'storyArcTagline', label: 'Story Arc Tagline' },
    { key: 'storyLogicChip', label: 'Story Logic Chip' },
    { key: 'storyWriterTitle', label: 'Story Writer Title' },
    { key: 'storyWriterSubtitle', label: 'Story Writer Subtitle' },
    { key: 'storyWriterChip', label: 'Story Writer Chip' },
    { key: 'storyLogicHeader', label: 'Story Logic Header' },
    { key: 'storyWriterHeader', label: 'Story Writer Header' },
  ];

  const logoOptions = [
    { label: 'The Role Room Logo Tagline', value: '/TheRoleRoom_Logo_Tagline.png' },
    { label: 'The Role Room Logo', value: '/TheRoleRoom_Logo.png' },
    { label: 'The Role Room App Logo', value: '/TheRoleRoom_App_Logo.png' },
    { label: 'The Role Room and Tagline', value: '/TheRoleRoom_and_Tagline.png' },
  ];

  const fabIconOptions = [
    { label: 'Speed Dial', value: 'speedDial' },
    { label: 'Add', value: 'add' },
    { label: 'List', value: 'list' },
    { label: 'Home', value: 'home' },
    { label: 'Work', value: 'work' },
    { label: 'Schedule', value: 'schedule' },
  ];

  const emptyStateIconOptions = [
    { label: 'Description', value: 'description' },
    { label: 'Book', value: 'menuBook' },
    { label: 'Scene', value: 'scene' },
    { label: 'Person', value: 'person' },
    { label: 'Chat', value: 'chat' },
    { label: 'History', value: 'history' },
    { label: 'Assessment', value: 'assessment' },
    { label: 'Grid', value: 'viewModule' },
  ];

  const emptyStateIconKeys = new Set<keyof BrandingSettings['tokens']['labels']>([
    'manuscriptEmptyIcon',
    'manuscriptActsEmptyIcon',
    'manuscriptScenesEmptyIcon',
    'manuscriptCharactersEmptyIcon',
    'manuscriptDialogueEmptyIcon',
    'manuscriptRevisionsEmptyIcon',
  ]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xl"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            bgcolor: '#0d1117',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: isMobile ? 0 : 3,
            height: isMobile ? '100%' : '90vh',
            maxHeight: isMobile ? '100%' : '90vh',
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: 'linear-gradient(180deg, #1c2128 0%, #161b22 100%)',
            background: 'linear-gradient(180deg, #1c2128 0%, #161b22 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: spacing,
            px: spacing,
            minHeight: buttonMinHeight + 24,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing }}>
            <Box
              sx={{
                width: getResponsiveValue(36, 40, 40, 44, 52, 60),
                height: getResponsiveValue(36, 40, 40, 44, 52, 60),
                borderRadius: 2,
                bgcolor: 'rgba(139, 92, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              <AdminPanelSettingsIcon sx={{ color: '#8b5cf6', fontSize: iconSize + 4 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, fontSize: fontSize.title }}>
                Admin Dashboard
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: fontSize.caption }}>
                Administrer brukere og e-postmaler
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={onClose} 
            sx={{ 
              color: 'rgba(255,255,255,0.87)',
              minWidth: iconButtonSize,
              minHeight: iconButtonSize,
            }}
          >
            <CloseIcon sx={{ fontSize: iconSize }} />
          </IconButton>
        </DialogTitle>

        <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', px: spacing, bgcolor: '#161b22' }}>
          <Tabs
            value={mainTab}
            onChange={(_: SyntheticEvent, v: number) => setMainTab(v)}
            sx={{
              minHeight: buttonMinHeight,
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.87)',
                minHeight: buttonMinHeight,
                textTransform: 'none',
                fontSize: fontSize.body,
                fontWeight: 500,
                gap: 1,
                px: spacing,
                '&.Mui-selected': { color: '#8b5cf6' },
              },
              '& .MuiTabs-indicator': { bgcolor: '#8b5cf6', height: 3 },
            }}
          >
            <Tab label="Brukere" icon={<PeopleIcon sx={{ fontSize: iconSize }} />} iconPosition="start" />
            <Tab label="E-post Designer" icon={<EmailIcon sx={{ fontSize: iconSize }} />} iconPosition="start" />
            <Tab label="Branding" icon={<PaletteIcon sx={{ fontSize: iconSize }} />} iconPosition="start" />
          </Tabs>
        </Box>

        <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {mainTab === 0 && (
            <Box sx={{ p: spacing, overflow: 'auto', flex: 1 }}>
              <Box sx={{ mb: spacing, display: 'flex', gap: spacing, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<PersonAddIcon sx={{ fontSize: iconSize }} />}
                  onClick={() => setInviteDialogOpen(true)}
                  sx={{
                    bgcolor: '#8b5cf6',
                    '&:hover': { bgcolor: '#7c3aed' },
                    borderRadius: 2,
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.button,
                    px: spacing,
                  }}
                >
                  Inviter Administrator
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon sx={{ fontSize: iconSize }} />}
                  onClick={loadAdmins}
                  disabled={loading}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.8)',
                    '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(139,92,246,0.1)' },
                    borderRadius: 2,
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.button,
                    px: spacing,
                  }}
                >
                  Oppdater
                </Button>
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress sx={{ color: '#8b5cf6' }} />
                </Box>
              ) : (
                <TableContainer
                  component={Paper}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2,
                  }}
                >
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.03)' }}>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: fontSize.body, py: spacing }}>Navn</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: fontSize.body, py: spacing, display: { xs: 'none', sm: 'table-cell' } }}>E-post</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: fontSize.body, py: spacing }}>Rolle</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: fontSize.body, py: spacing, display: { xs: 'none', md: 'table-cell' } }}>Opprettet</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: fontSize.body, py: spacing }} align="right">Handlinger</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {admins.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} sx={{ color: 'rgba(255,255,255,0.87)', textAlign: 'center', py: 4, borderBottom: 'none' }}>
                            Ingen administratorer funnet. Klikk "Inviter Administrator" for å legge til.
                          </TableCell>
                        </TableRow>
                      ) : (
                        admins.map((admin) => (
                          <TableRow key={admin.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                            <TableCell sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: fontSize.body, py: spacing }}>
                              {admin.display_name || '-'}
                            </TableCell>
                            <TableCell sx={{ color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: fontSize.body, py: spacing, display: { xs: 'none', sm: 'table-cell' } }}>
                              {admin.email}
                            </TableCell>
                            <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', py: spacing }}>
                              <Chip
                                label={getRoleLabel(admin.role)}
                                size="small"
                                sx={{
                                  bgcolor: `${getRoleColor(admin.role)}20`,
                                  color: getRoleColor(admin.role),
                                  border: `1px solid ${getRoleColor(admin.role)}40`,
                                  fontWeight: 600,
                                  height: chipHeight,
                                  fontSize: fontSize.caption,
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ color: 'rgba(255,255,255,0.87)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: fontSize.caption, py: spacing, display: { xs: 'none', md: 'table-cell' } }}>
                              {admin.created_at ? new Date(admin.created_at).toLocaleDateString('nb-NO') : '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', py: spacing }}>
                              <Tooltip title="Generer nytt passord">
                                <IconButton
                                  onClick={() => handleResetPassword(admin.id)}
                                  sx={{ color: '#8b5cf6', '&:hover': { bgcolor: 'rgba(139,92,246,0.1)' }, minWidth: iconButtonSize, minHeight: iconButtonSize }}
                                >
                                  <VpnKeyIcon sx={{ fontSize: iconSize }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Slett">
                                <IconButton
                                  onClick={() => handleDeleteAdmin(admin.id)}
                                  sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' }, minWidth: iconButtonSize, minHeight: iconButtonSize }}
                                >
                                  <DeleteIcon sx={{ fontSize: iconSize }} />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {mainTab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <EmailDesigner
                projectVariables={variableValues}
                projectName={projectName}
                onSave={(template) => {
                  setSnackbar({
                    open: true,
                    message: 'E-postmal lagret',
                    severity: 'success',
                  });
                }}
              />
            </Box>
          )}

          {mainTab === 2 && (
            <Box
              sx={{
                p: spacing,
                overflow: 'hidden',
                flex: 1,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: spacing,
              }}
            >
              <Box sx={{ flex: 1, overflow: 'auto', pr: { md: spacing / 2 } }}>
              <Box sx={{ display: 'flex', gap: spacing, flexWrap: 'wrap', alignItems: 'center', mb: spacing }}>
                <Box
                  sx={{
                    width: getResponsiveValue(48, 56, 56, 64, 72, 80),
                    height: getResponsiveValue(48, 56, 56, 64, 72, 80),
                    borderRadius: 2,
                    bgcolor: 'rgba(139, 92, 246, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    component="img"
                    src={brandingForm.identity.iconUrl || brandingForm.identity.logoUrl}
                    alt={brandingForm.identity.appName}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: fontSize.title }}>
                    {brandingForm.identity.appName}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: fontSize.caption }}>
                    {brandingForm.identity.tagline}
                  </Typography>
                </Box>
              </Box>

              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: fontSize.subtitle, mb: spacing / 2 }}>
                Identitet
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: spacing }}>
                <TextField
                  label="App-navn"
                  value={brandingForm.identity.appName}
                  onChange={(e) => updateBrandingIdentity('appName', e.target.value)}
                  fullWidth
                  size={isMobile ? 'medium' : 'small'}
                  sx={inputStyles}
                  InputLabelProps={{ sx: { fontSize: fontSize.body } }}
                />
                <TextField
                  label="Tagline"
                  value={brandingForm.identity.tagline}
                  onChange={(e) => updateBrandingIdentity('tagline', e.target.value)}
                  fullWidth
                  size={isMobile ? 'medium' : 'small'}
                  sx={inputStyles}
                  InputLabelProps={{ sx: { fontSize: fontSize.body } }}
                />
                <TextField
                  label="Domene"
                  value={brandingForm.identity.domain}
                  onChange={(e) => updateBrandingIdentity('domain', e.target.value)}
                  fullWidth
                  size={isMobile ? 'medium' : 'small'}
                  sx={inputStyles}
                  InputLabelProps={{ sx: { fontSize: fontSize.body } }}
                />
                <TextField
                  label="Support e-post"
                  value={brandingForm.identity.supportEmail}
                  onChange={(e) => updateBrandingIdentity('supportEmail', e.target.value)}
                  fullWidth
                  size={isMobile ? 'medium' : 'small'}
                  sx={inputStyles}
                  InputLabelProps={{ sx: { fontSize: fontSize.body } }}
                />
                <TextField
                  label="Docs URL"
                  value={brandingForm.identity.docsUrl}
                  onChange={(e) => updateBrandingIdentity('docsUrl', e.target.value)}
                  fullWidth
                  size={isMobile ? 'medium' : 'small'}
                  sx={inputStyles}
                  InputLabelProps={{ sx: { fontSize: fontSize.body } }}
                />
              </Box>

              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: fontSize.subtitle, mt: spacing, mb: spacing / 2 }}>
                Merkevareressurser
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: spacing }}>
                <FormControl fullWidth size={isMobile ? 'medium' : 'small'} sx={inputStyles}>
                  <InputLabel sx={{ fontSize: fontSize.body }}>Logo</InputLabel>
                  <Select
                    label="Logo"
                    value={brandingForm.identity.logoUrl}
                    onChange={(e) => updateBrandingIdentity('logoUrl', String(e.target.value))}
                  >
                    {logoOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size={isMobile ? 'medium' : 'small'} sx={inputStyles}>
                  <InputLabel sx={{ fontSize: fontSize.body }}>Ikon</InputLabel>
                  <Select
                    label="Ikon"
                    value={brandingForm.identity.iconUrl}
                    onChange={(e) => updateBrandingIdentity('iconUrl', String(e.target.value))}
                  >
                    {logoOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size={isMobile ? 'medium' : 'small'} sx={inputStyles}>
                  <InputLabel sx={{ fontSize: fontSize.body }}>Favicon</InputLabel>
                  <Select
                    label="Favicon"
                    value={brandingForm.identity.faviconUrl}
                    onChange={(e) => updateBrandingIdentity('faviconUrl', String(e.target.value))}
                  >
                    {logoOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size={isMobile ? 'medium' : 'small'} sx={inputStyles}>
                  <InputLabel sx={{ fontSize: fontSize.body }}>E-post logo</InputLabel>
                  <Select
                    label="E-post logo"
                    value={brandingForm.identity.emailLogoUrl}
                    onChange={(e) => updateBrandingIdentity('emailLogoUrl', String(e.target.value))}
                  >
                    {logoOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size={isMobile ? 'medium' : 'small'} sx={inputStyles}>
                  <InputLabel sx={{ fontSize: fontSize.body }}>Landing hero</InputLabel>
                  <Select
                    label="Landing hero"
                    value={brandingForm.identity.landingHeroImageUrl}
                    onChange={(e) => updateBrandingIdentity('landingHeroImageUrl', String(e.target.value))}
                  >
                    {logoOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size={isMobile ? 'medium' : 'small'} sx={inputStyles}>
                  <InputLabel sx={{ fontSize: fontSize.body }}>Vannmerke</InputLabel>
                  <Select
                    label="Vannmerke"
                    value={brandingForm.identity.watermarkUrl}
                    onChange={(e) => updateBrandingIdentity('watermarkUrl', String(e.target.value))}
                  >
                    {logoOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: fontSize.subtitle, mt: spacing, mb: spacing / 2 }}>
                Farger
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: spacing }}>
                {colorFields.map((field) => (
                  <Box key={field.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: 1,
                        bgcolor: brandingForm.colors[field.key],
                        border: '1px solid rgba(255,255,255,0.2)',
                      }}
                    />
                    <TextField
                      label={field.label}
                      value={brandingForm.colors[field.key]}
                      onChange={(e) => updateBrandingColor(field.key, e.target.value)}
                      fullWidth
                      size={isMobile ? 'medium' : 'small'}
                      sx={inputStyles}
                      InputLabelProps={{ sx: { fontSize: fontSize.body } }}
                    />
                  </Box>
                ))}
              </Box>

              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: fontSize.subtitle, mt: spacing, mb: spacing / 2 }}>
                Typografi
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: spacing }}>
                {typographyFields.map((field) => (
                  <TextField
                    key={field.key}
                    label={field.label}
                    type={field.type ?? 'text'}
                    value={brandingForm.typography[field.key]}
                    onChange={(e) => {
                      if (field.type === 'number') {
                        const numericValue = Number(e.target.value);
                        updateBrandingTypography(field.key, Number.isNaN(numericValue) ? 0 : numericValue);
                      } else {
                        updateBrandingTypography(field.key, e.target.value);
                      }
                    }}
                    fullWidth
                    size={isMobile ? 'medium' : 'small'}
                    sx={inputStyles}
                    InputLabelProps={{ sx: { fontSize: fontSize.body } }}
                  />
                ))}
              </Box>

              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: fontSize.subtitle, mt: spacing, mb: spacing / 2 }}>
                Layout
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: spacing }}>
                {layoutFields.map((field) => (
                  <TextField
                    key={field.key}
                    label={field.label}
                    type={field.type ?? 'text'}
                    value={brandingForm.layout[field.key]}
                    onChange={(e) => {
                      if (field.type === 'number') {
                        const numericValue = Number(e.target.value);
                        updateBrandingLayout(field.key, Number.isNaN(numericValue) ? 0 : numericValue);
                      } else {
                        updateBrandingLayout(field.key, e.target.value);
                      }
                    }}
                    fullWidth
                    size={isMobile ? 'medium' : 'small'}
                    sx={inputStyles}
                    InputLabelProps={{ sx: { fontSize: fontSize.body } }}
                  />
                ))}
              </Box>

              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: fontSize.subtitle, mt: spacing, mb: spacing / 2 }}>
                Innholdstokens
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: spacing }}>
                {tokenFields.map((field) =>
                  field.key === 'fabIcon' ? (
                    <FormControl key={field.key} fullWidth size={isMobile ? 'medium' : 'small'} sx={inputStyles}>
                      <InputLabel sx={{ fontSize: fontSize.body }}>{field.label}</InputLabel>
                      <Select
                        label={field.label}
                        value={brandingForm.tokens.labels[field.key]}
                        onChange={(e) => updateBrandingToken(field.key, String(e.target.value))}
                      >
                        {fabIconOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : emptyStateIconKeys.has(field.key) ? (
                    <FormControl key={field.key} fullWidth size={isMobile ? 'medium' : 'small'} sx={inputStyles}>
                      <InputLabel sx={{ fontSize: fontSize.body }}>{field.label}</InputLabel>
                      <Select
                        label={field.label}
                        value={brandingForm.tokens.labels[field.key]}
                        onChange={(e) => updateBrandingToken(field.key, String(e.target.value))}
                      >
                        {emptyStateIconOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      key={field.key}
                      label={field.label}
                      value={brandingForm.tokens.labels[field.key]}
                      onChange={(e) => updateBrandingToken(field.key, e.target.value)}
                      fullWidth
                      size={isMobile ? 'medium' : 'small'}
                      sx={inputStyles}
                      InputLabelProps={{ sx: { fontSize: fontSize.body } }}
                    />
                  )
                )}
              </Box>

              <Box sx={{ mt: spacing, display: 'flex', gap: spacing, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon sx={{ fontSize: iconSize }} />}
                  onClick={handleBrandingSave}
                  sx={{
                    bgcolor: '#8b5cf6',
                    '&:hover': { bgcolor: '#7c3aed' },
                    borderRadius: 2,
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.button,
                    px: spacing,
                  }}
                >
                  Lagre branding
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleBrandingReset}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.8)',
                    '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(139,92,246,0.1)' },
                    borderRadius: 2,
                    minHeight: buttonMinHeight,
                    fontSize: fontSize.button,
                    px: spacing,
                  }}
                >
                  Tilbakestill
                </Button>
              </Box>
              </Box>

              <Box sx={{ flex: 1, overflow: 'auto', pl: { md: spacing / 2 } }}>
                <Box
                  sx={{
                    minHeight: 640,
                    borderRadius: 3,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: `linear-gradient(135deg, ${brandingForm.colors.background} 0%, ${brandingForm.colors.surface} 100%)`,
                    color: brandingForm.colors.textPrimary,
                    fontFamily: brandingForm.typography.bodyFont,
                    boxShadow: brandingForm.layout.shadowSoft,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      px: spacing,
                      py: spacing,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: `1px solid ${brandingForm.colors.border}`,
                      background: `linear-gradient(90deg, ${brandingForm.colors.gradientStart}, ${brandingForm.colors.gradientEnd})`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        component="img"
                        src={brandingForm.identity.logoUrl}
                        alt={brandingForm.identity.appName}
                        sx={{ width: 36, height: 36, objectFit: 'contain' }}
                      />
                      <Box>
                        <Typography
                          sx={{
                            fontFamily: brandingForm.typography.headingFont,
                            fontWeight: brandingForm.typography.headingWeight,
                            fontSize: '1.1rem',
                            color: brandingForm.colors.textPrimary,
                          }}
                        >
                          {brandingForm.identity.appName}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: brandingForm.colors.textSecondary }}>
                          {brandingForm.identity.tagline}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {tokenFields.slice(0, 4).map((field) => (
                        <Chip
                          key={field.key}
                          label={brandingForm.tokens.labels[field.key]}
                          sx={{
                            bgcolor: `${brandingForm.colors.surface}cc`,
                            color: brandingForm.colors.textPrimary,
                            border: `1px solid ${brandingForm.colors.border}`,
                            fontSize: '0.7rem',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>

                  <Box sx={{ px: spacing * 1.2, py: spacing * 1.4 }}>
                    <Typography
                      sx={{
                        fontFamily: brandingForm.typography.headingFont,
                        fontWeight: brandingForm.typography.headingWeight,
                        fontSize: '2rem',
                        letterSpacing: brandingForm.typography.letterSpacing,
                      }}
                    >
                      {brandingForm.tokens.labels.dashboard} hub
                    </Typography>
                    <Typography
                      sx={{
                        maxWidth: 420,
                        mt: 1,
                        color: brandingForm.colors.textSecondary,
                      }}
                    >
                      Oversikt over {brandingForm.tokens.labels.projects.toLowerCase()}, {brandingForm.tokens.labels.team.toLowerCase()} og neste
                      {` ${brandingForm.tokens.labels.schedule.toLowerCase()}`}.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1.5, mt: 3, flexWrap: 'wrap' }}>
                      <Button
                        variant="contained"
                        sx={{
                          bgcolor: brandingForm.colors.primary,
                          color: brandingForm.colors.textPrimary,
                          borderRadius: brandingForm.layout.buttonRadius,
                          textTransform: 'none',
                          fontWeight: 600,
                        }}
                      >
                        Opprett {brandingForm.tokens.labels.roles.toLowerCase()}
                      </Button>
                      <Button
                        variant="outlined"
                        sx={{
                          borderColor: brandingForm.colors.border,
                          color: brandingForm.colors.textPrimary,
                          borderRadius: brandingForm.layout.buttonRadius,
                          textTransform: 'none',
                        }}
                      >
                        Åpne {brandingForm.tokens.labels.candidates.toLowerCase()}
                      </Button>
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: spacing,
                        mt: 4,
                      }}
                    >
                      {[
                        { title: brandingForm.tokens.labels.auditions, value: '12 nye' },
                        { title: brandingForm.tokens.labels.locations, value: '4 aktive' },
                        { title: brandingForm.tokens.labels.shotList, value: '28 shots' },
                        { title: brandingForm.tokens.labels.callSheets, value: '3 klare' },
                      ].map((card) => (
                        <Box
                          key={card.title}
                          sx={{
                            borderRadius: brandingForm.layout.cardRadius,
                            border: `1px solid ${brandingForm.colors.border}`,
                            bgcolor: brandingForm.colors.surface,
                            p: spacing,
                            boxShadow: brandingForm.layout.shadowSoft,
                          }}
                        >
                          <Typography sx={{ fontSize: '0.85rem', color: brandingForm.colors.textSecondary }}>
                            {card.title}
                          </Typography>
                          <Typography
                            sx={{
                              fontFamily: brandingForm.typography.headingFont,
                              fontWeight: brandingForm.typography.headingWeight,
                              fontSize: '1.4rem',
                              mt: 0.5,
                            }}
                          >
                            {card.value}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            bgcolor: '#0d1117',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: isMobile ? 0 : 2,
            minWidth: isMobile ? '100%' : getResponsiveValue(320, 380, 400, 450, 500, 560),
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: fontSize.title, p: spacing }}>
          Inviter ny Administrator
        </DialogTitle>
        <DialogContent sx={{ mt: spacing, p: spacing }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: spacing }}>
            <TextField
              label="E-post"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              fullWidth
              required
              size={isMobile ? 'medium' : 'small'}
              sx={{ 
                ...inputStyles, 
                '& .MuiOutlinedInput-root': { 
                  ...inputStyles['& .MuiOutlinedInput-root'],
                  minHeight: buttonMinHeight,
                  fontSize: fontSize.body,
                } 
              }}
              InputLabelProps={{ sx: { fontSize: fontSize.body } }}
            />
            <TextField
              label="Visningsnavn (valgfritt)"
              autoComplete="name"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              fullWidth
              size={isMobile ? 'medium' : 'small'}
              sx={{ 
                ...inputStyles, 
                '& .MuiOutlinedInput-root': { 
                  ...inputStyles['& .MuiOutlinedInput-root'],
                  minHeight: buttonMinHeight,
                  fontSize: fontSize.body,
                } 
              }}
              InputLabelProps={{ sx: { fontSize: fontSize.body } }}
            />
            <FormControl fullWidth size={isMobile ? 'medium' : 'small'}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)', fontSize: fontSize.body }}>Rolle</InputLabel>
              <Select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                label="Rolle"
                sx={{
                  color: '#fff',
                  minHeight: buttonMinHeight,
                  fontSize: fontSize.body,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
                  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              >
                <MenuItem value="owner" sx={{ fontSize: fontSize.body, minHeight: buttonMinHeight }}>Eier</MenuItem>
                <MenuItem value="admin" sx={{ fontSize: fontSize.body, minHeight: buttonMinHeight }}>Administrator</MenuItem>
                <MenuItem value="editor" sx={{ fontSize: fontSize.body, minHeight: buttonMinHeight }}>Redaktør</MenuItem>
                <MenuItem value="viewer" sx={{ fontSize: fontSize.body, minHeight: buttonMinHeight }}>Leser</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: spacing, borderTop: '1px solid rgba(255,255,255,0.08)', gap: 1 }}>
          <Button 
            onClick={() => setInviteDialogOpen(false)} 
            sx={{ color: 'rgba(255,255,255,0.87)', minHeight: buttonMinHeight, fontSize: fontSize.button }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleInviteAdmin}
            sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' }, minHeight: buttonMinHeight, fontSize: fontSize.button }}
          >
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            bgcolor: '#0d1117',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: isMobile ? 0 : 2,
            minWidth: isMobile ? '100%' : getResponsiveValue(300, 360, 380, 420, 480, 540),
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', fontSize: fontSize.title, p: spacing }}>Generert Passord</DialogTitle>
        <DialogContent sx={{ p: spacing }}>
          <Alert severity="info" sx={{ mb: spacing, bgcolor: 'rgba(0,212,255,0.1)', color: '#00d4ff', fontSize: fontSize.body }}>
            Lagre dette passordet sikkert. Det kan ikke hentes igjen.
          </Alert>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: spacing,
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Typography sx={{ flex: 1, fontFamily: 'monospace', color: '#fff', fontSize: fontSize.body }}>
              {generatedPassword}
            </Typography>
            <IconButton 
              onClick={() => copyToClipboard(generatedPassword)} 
              sx={{ color: '#8b5cf6', minWidth: iconButtonSize, minHeight: iconButtonSize }}
            >
              <CopyIcon sx={{ fontSize: iconSize }} />
            </IconButton>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: spacing }}>
          <Button
            variant="contained"
            onClick={() => setShowPasswordDialog(false)}
            sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' }, minHeight: buttonMinHeight, fontSize: fontSize.button }}
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{
            bgcolor: snackbar.severity === 'success' ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
            color: '#fff',
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
