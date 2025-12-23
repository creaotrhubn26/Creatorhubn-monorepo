import { useTheming } from '../utils/theming-helper';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import React, { useState } from 'react';
import { useSnackbar } from 'notistack';
import {
  Box,
  Typography,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Alert,
  Divider,
  CircularProgress,
  Fab,
  Tabs,
  Tab,
  Paper,
  Switch,
  FormControlLabel,
  IconButton,
  Card as MuiCard, // eslint-disable-line @typescript-eslint/no-unused-vars -- Used throughout for consistent wedding timeline card styling
} from '@mui/material';
import {
  Schedule,
  Email,
  CheckCircle,
  Warning,
  VolumeUp,
  Chat,
  CameraAlt,
  PriorityHigh,
  AddCircle as Add,
  Share,
  Sync,
  People,
  LocationOn,
  Lightbulb,
  Close,
  Palette as DesignIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import EmailDesigner from '@/components/EmailDesigner/EmailDesigner';


// Backend API compatible interfaces
interface TimelineEvent {
  id: string;
  timelineId?: number;
  eventId: string;
  time: string;
  activity: string;
  location?: string;
  creatorType: string;
  activityType?: string;
  hasPhoto: boolean;
  hasVideo?: boolean;
  iconName?: string;
  color?: string;
  sortOrder: number;
  // VIP system extensions
  persons_involved?: VIPContact[];
  notifications_sent?: boolean;
  created_by?: string
}

interface WeddingTimeline {
  id: number;
  weddingId: string;
  coupleId: string;
  projectId?: string;
  clientEmail?: string;
  creatorEmail: string;
  creatorId: string;
  creatorType: string;
  weddingDate?: string;
  venue?: string;
  brideNames?: string[];
  groomNames?: string[];
  locations?: any[];
  timelineItems?: any[];
  isClientAccessEnabled: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  events?: TimelineEvent[]
}

interface VIPContact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  priority: 'critical' | 'high' | 'medium';
  notify_first: boolean;
  is_vip: boolean
}

interface WeddingTimelineProps {
  weddingId?: string;
  mode?: 'full' | 'embedded';
  culturalType?:
    | 'norsk'
    | 'sikh'
    | 'indisk'
    | 'pakistansk'
    | 'tyrkisk'
    | 'arabisk'
    | 'somalisk'
    | 'etiopisk'
    | 'nigeriansk'
    | 'brasiliansk'
    | 'kinesisk'
    | 'japansk'
    | 'koreansk'
    | 'filippinsk'
    | 'iransk'
    | 'afghansk'
    | 'kurdisk'
    | 'eritreansk'
    | 'thai'
    | 'vietnamesisk'
    | 'russisk'
    | 'polsk'
    | 'annet';
  projectIntegration?: {
    projectId?: string;
    weddingTimelineIntegrated?: boolean;
    culturalType?: string;
};
}

export default function WeddingTimeline({
  weddingId,
  culturalType = 'norsk',
  projectIntegration,
}: WeddingTimelineProps) {
  const { profession } = useProfessionAdapter();
  const { enqueueSnackbar } = useSnackbar();
  
  console.log(`🎨 Wedding Timeline - Profession: ${profession}, Cultural: ${culturalType}`);
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  const color = theming.colors.primary || '#ff8c00';
  
  // Get profession-specific labels based on profession type
  const professionLabels: Record<string, string> = {
    photographer: 'fotografen',
    videographer: 'videografen',
    music_producer: 'musikkprodusenten',
    video_editor: 'videoredigereren',
    photo_editor: 'fotoredigereren',
  };
  const professionLabel = professionLabels[profession] || 'fotografen';
  // Toast functionality removed for Material UI compliance
  const queryClient = useQueryClient();

  // Glassmorphism effect for professional design
  const glassEffect = `
    rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(25, 255, 255, 0.1);
  `;

  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [openAddPersonDialog, setOpenAddPersonDialog] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [clientUrl, setClientUrl] = useState('');

  // Generate client access URL for sharing with wedding couple
  const generateClientAccess = useMutation({
    mutationFn: async (regenerate: boolean) => {
      // Prioritize projectIntegration.projectId, then check timeline.projectId, fallback to demo
      const projectId =
        projectIntegration?.projectId || timeline?.projectId || 'wedding-demo-project';
      console.log('🔑 Genererer klienttilgang for prosjekt-ID:', projectId);
      const response = await apiRequest(
        `/api/projects/${projectId}/wedding-timeline/client-access${regenerate ? '?regenerate=true' : ''}`,
        { method: 'GET' }
      );
      return response;
    },
    onSuccess: (data) => {
      setClientUrl(data.clientUrl);
      setShareDialogOpen(true);
      enqueueSnackbar('Klientlenke generert!', { variant: 'success' });
    },
    onError: (error) => {
      console.error('Feil ved generering av klientlenke:', error);
      enqueueSnackbar('Kunne ikke generere klientlenke', { variant: 'error' });
    },
  });

  const handleShare = () => {
    generateClientAccess.mutate(false);
  };

  const handleRegenerateCode = () => {
    generateClientAccess.mutate(true);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(clientUrl);
      enqueueSnackbar('Lenke kopiert til utklippstavle', { variant: 'success' });
    } catch (error) {
      console.error('Kunne ikke kopiere til utklippstavle:', error);
      enqueueSnackbar('Kunne ikke kopiere lenke', { variant: 'error' });
    }
  };

  const [newPerson, setNewPerson] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    priority: 'medium' as 'critical' | 'high' | 'medium',
    notify_first: false,
    is_vip: false,
});

  // Email states - samme kode som showcase
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDesignerOpen, setEmailDesignerOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [photographerSignature, setPhotographerSignature] = useState('');
  const [includeDownloadCode, setIncludeDownloadCode] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<any>(null);

  // Email handlers - samme kode som showcase
  const handleOpenEmailDialog = () => {
    setEmailDialogOpen(true);
};

  const handleSendWeddingTimeline = async () => {
    if (!clientEmail) return;

    setSendingEmail(true);
    try {
      const emailData = {
        context: 'wedding-timeline',
        projectId: projectIntegration?.projectId || weddingId,
        recipient: clientEmail,
        photographerSignature,
        includeDownloadCode,
        template: emailTemplate,
    };

      await apiRequest('/api/email/send-wedding-timeline', {
        method: 'POST',
        body: JSON.stringify(emailData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Bryllupstidslinje sendt til klient');
      setEmailDialogOpen(false);
      enqueueSnackbar('Bryllupstidslinje sendt til klient!', { variant: 'success' });

      // Reset form
      setClientEmail('');
      setPhotographerSignature('');
      setIncludeDownloadCode(true);
    } catch (error) {
      console.error('Feil ved sending av bryllupstidslinje:', error);
      enqueueSnackbar('Kunne ikke sende e-post', { variant: 'error' });
    } finally {
      setSendingEmail(false);
    }
};

  const handleOpenEmailDesigner = () => {
    setEmailDesignerOpen(true);
};

  const handleSaveEmailTemplate = (template: any) => {
    setEmailTemplate(template);
    setEmailDesignerOpen(false);
    enqueueSnackbar('E-post mal lagret!', { variant: 'success' });
    console.log('Email template lagret for bryllupstidslinje');
  };

  // Kulturspesifikke bryllupskjøreplaner - Use culturalType from props
  const getCulturalTimelineData = (): TimelineEvent[] => {
    switch (culturalType) {
      case 'sikh':
        return getSikhWeddingTimeline();
      case 'indisk':
        return getIndianWeddingTimeline();
      case 'pakistansk':
        return getPakistaniWeddingTimeline();
      default:
        return getNorwegianWeddingTimeline();
    }
  };
  
  // Cultural timeline display label
  const culturalLabels: Record<string, string> = {
    norsk: '',
    sikh: ' (Sikh-tradisjon)',
    indisk: ' (Indisk-tradisjon)',
    pakistansk: ' (Pakistansk-tradisjon)',
  };
  const culturalLabel = culturalLabels[culturalType] || '';

  // Norsk bryllup - Lemy Thi Ho & Ole Gunnar Bang Røger
  const getNorwegianWeddingTimeline = (): TimelineEvent[] => [
    {
      id: '',
      eventId: 'brudestyling',
      time: '07:00–09:3',
      activity: 'Brudestyling – hår og sminke på Scandic Helsfyr',
      location: 'Scandic Helsfyr, Innspurten 7, 0663 Oslo',
      creatorType: 'Fotograf',
      hasPhoto: false,
      hasVideo: false,
      sortOrder:  1,
      persons_involved: [
        {
          id: 'lemy',
          name: 'Lemy Thi H',
          role: 'Brud',
          email: 'lemy@example.com',
          phone: '478 91 74',
          priority: 'critical',
          notify_first: true,
          is_vip: true,
      },
      ],
      notifications_sent: true,
  },
    {
      id: '',
      eventId: 'brudefolge-ankomst',
      time: '09:1',
      activity: 'Brudefølge ankommer hotell',
      location: 'Scandic Helsfyr',
      creatorType: 'Fotograf',
      hasPhoto: false,
      hasVideo: false,
      sortOrder:  2,
      persons_involved: [
        {
          id: 'miriam',
          name: 'Miriam Kakos',
          role: 'Maid of Honor',
          email: 'miriam@example.com',
          phone: '400 88 57',
          priority: 'high',
          notify_first: true,
          is_vip: true,
      },
        {
          id: 'ardiana',
          name: 'Ardiana Kastrati',
          role: 'Brudepike',
          email: 'ardiana@example.com',
          phone: '400 83 41',
          priority: 'high',
          notify_first: false,
          is_vip: false,
      },
      ],
      notifications_sent: false,
  },
    {
      id: '',
      eventId: 'brudgom-forberedelser',
      time: '09:20–09:3',
      activity: 'Brudgom og forlovere – detaljer og forberedelser',
      location: 'Scandic Helsfyr',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  3,
      persons_involved: [
        {
          id: 'olegunnar',
          name: 'Ole Gunnar Bang Røger',
          role: 'Brudgom',
          email: 'olegunnar@example.com',
          phone: '971 32 67',
          priority: 'critical',
          notify_first: true,
          is_vip: true,
      },
        {
          id: 'kjell',
          name: 'Kjell Røger',
          role: 'Best Man',
          email: 'kjell@example.com',
          phone: '911 35 57',
          priority: 'high',
          notify_first: false,
          is_vip: false,
      },
      ],
      notifications_sent: true,
  },
    {
      id: '',
      eventId: 'brud-forberedelser',
      time: '09:35–09:5',
      activity: 'Brud og følge – forberedelser, detaljer',
      location: 'Scandic Helsfyr',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  4,
      persons_involved: [
        {
          id: 'lemy',
          name: 'Lemy Thi H',
          role: 'Brud',
          email: 'lemy@example.com',
          phone: '478 91 74',
          priority: 'critical',
          notify_first: true,
          is_vip: true,
      },
      ],
      notifications_sent: false,
  },
    {
      id: '',
      eventId: 'brud-kjoler',
      time: '09:3',
      activity: 'Brud tar på kjolen',
      location: 'Scandic Helsfyr',
      creatorType: 'Fotograf',
      hasPhoto: false,
      hasVideo: false,
      sortOrder:  5,
      notifications_sent: false,
  },
    {
      id: '',
      eventId: 'avreise-botanisk',
      time: '10:0',
      activity: 'Avreise til Botanisk Hage',
      location: 'Scandic Helsfyr → Botanisk Hage',
      creatorType: 'Fotograf',
      hasPhoto: false,
      hasVideo: false,
      sortOrder:  6,
      notifications_sent: false,
  },
    {
      id: '',
      eventId: 'first-look',
      time: '10:30–11:2',
      activity: 'First Look & løfter foran Tøyen hovedgård',
      location: 'Botanisk Hage, Tøyen hovedgård',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  7,
      persons_involved: [
        {
          id: 'lemy',
          name: 'Lemy Thi H',
          role: 'Brud',
          email: 'lemy@example.com',
          phone: '478 91 74',
          priority: 'critical',
          notify_first: true,
          is_vip: true,
      },
        {
          id: 'olegunnar',
          name: 'Ole Gunnar Bang Røger',
          role: 'Brudgom',
          email: 'olegunnar@example.com',
          phone: '971 32 67',
          priority: 'critical',
          notify_first: true,
          is_vip: true,
      },
      ],
      notifications_sent: true,
  },
    {
      id: ', ',
      eventId: 'vielse',
      time: '11:25–12:0',
      activity: 'Vielse i Klimahuset, Botanisk Hage',
      location: 'Klimahuset, Botanisk Hage, Sars gate 1, 0462 Oslo',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  8,
      persons_involved: [
        {
          id: 'jakob',
          name: 'Jakob Fonstad',
          role: 'Toastmaster',
          email: 'jakob@example.com',
          phone: '482 42 04',
          priority: 'high',
          notify_first: false,
          is_vip: false,
      },
      ],
      notifications_sent: false,
  },
    {
      id: ', ',
      eventId: 'portretter-gruppe',
      time: '12:05–14:4',
      activity: 'Portretter + gruppebilder i Botanisk Hage',
      location: 'Botanisk Hage',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  9,
      notifications_sent: false,
  },
    {
      id: '1',
      eventId: 'avreise-mini-bottle',
      time: '15:0',
      activity: 'Avreise til Mini Bottle Gallery',
      location: 'Botanisk Hage → Mini Bottle Gallery',
      creatorType: 'Fotograf',
      hasPhoto: false,
      hasVideo: false,
      sortOrder:  10,
      notifications_sent: false,
  },
    {
      id: '1',
      eventId: 'detaljbilder-gallery',
      time: '15:20–16:0',
      activity: 'Detaljbilder av Mini Bottle Gallery',
      location: 'Mini Bottle Gallery, Kirkegata 10, 0152 Oslo',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  11,
      notifications_sent: false,
  },
    {
      id: '1',
      eventId: 'brudepar-portretter',
      time: '16:00–16:3',
      activity: 'Brudeparet portretter – Sigarsalong, trapp, månen',
      location: 'Mini Bottle Gallery',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  12,
      notifications_sent: false,
  },
    {
      id: '1',
      eventId: 'gjester-ankomst',
      time: '16:3',
      activity: 'Gjestene ankommer, velkomstdrikke i lounge',
      location: 'Mini Bottle Gallery',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  13,
      persons_involved: [
        {
          id: 'kristin',
          name: 'Kristin Glærum',
          role: 'Lokalkoordinator / Band',
          email: 'kristin@example.com',
          phone: '957 51 39',
          priority: 'high',
          notify_first: true,
          is_vip: false,
      },
      ],
      notifications_sent: false,
  },
    {
      id: '1',
      eventId: 'brudepar-avsløring',
      time: '16:4',
      activity: 'Brudepar-avsløring på balkongen, går ned og hilser',
      location: 'Mini Bottle Gallery',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  14,
      notifications_sent: false,
  },
    {
      id: '1',
      eventId: 'gruppebilder-gjester',
      time: '17:0',
      activity: "Brudeparet med gjester – gruppebilde og menn ', ', ",
      location: 'Mini Bottle Gallery',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  15,
      notifications_sent: false,
  },
    {
      id: '1',
      eventId: 'inngang-likorværelset',
      time: '17:3',
      activity: 'Inngang til Likørværelset + velkomsttale',
      location: 'Mini Bottle Gallery - Likørværelset',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  16,
      notifications_sent: false,
  },
    {
      id: '1',
      eventId: 'middag-taler',
      time: '17:35–19:3',
      activity: 'Middag, taler og naturlige øyeblikk',
      location: 'Mini Bottle Gallery - Likørværelset',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  17,
      notifications_sent: false,
  },
    {
      id: '1',
      eventId: 'champagnetårn',
      time: '20:3',
      activity: 'Champagnetårn og bryllupskake',
      location: 'Mini Bottle Gallery',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  18,
      notifications_sent: false,
  },
    {
      id: '1',
      eventId: 'brudevals',
      time: '21:0',
      activity: 'Brudevals',
      location: 'Mini Bottle Gallery',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  19,
      notifications_sent: false,
  },
    {
      id: '2',
      eventId: 'underholdning',
      time: '21:3',
      activity: 'Underholdning + konsertbilder',
      location: 'Mini Bottle Gallery',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  20,
      notifications_sent: false,
  },
    {
      id: '2',
      eventId: 'nattmat',
      time: '23:3',
      activity: 'Nattmat serveres',
      location: 'Mini Bottle Gallery',
      creatorType: 'Fotograf',
      hasPhoto: false,
      hasVideo: false,
      sortOrder:  21,
      notifications_sent: false,
  },
  ];

  // Sikh bryllup - Tradisjonelle ritualer og seremonier
  const getSikhWeddingTimeline = (): TimelineEvent[] => [
    {
      id: 'sikh-',
      eventId: 'gurdwara-ankomst',
      time: '08:0',
      activity: 'Ankomst til Gurdwara - Brudgom og familie',
      location: 'Sikh Gurdwara Oslo, Akersbakken 16B, 0172 Oslo',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  1,
      persons_involved: [
        {
          id: 'brudgom-sikh',
          name: 'Brudgom',
          role: 'Brudgom',
          email: 'brudgom@example.com',
          phone: '900 00 00',
          priority: 'critical',
          notify_first: true,
          is_vip: true,
      },
      ],
      notifications_sent: false,
  },
    {
      id: 'sikh-',
      eventId: 'pagh-bandhi',
      time: '08:15-08:4',
      activity: 'Pagh Bandhi - Turban-binding seremoni',
      location: 'Sikh Gurdwara Oslo',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  2,
      persons_involved: [
        {
          id: 'pagh-binder',
          name: 'Turban-binder (Onkel/Far, )',
          role: 'Familie/Ceremoniell',
          email: 'familie@example.com',
          phone: '900 00 00',
          priority: 'high',
          notify_first: true,
          is_vip: false,
      },
      ],
      notifications_sent: false,
  },
    {
      id: 'sikh-',
      eventId: 'baraat-forberedelser',
      time: '09:00-09:3',
      activity: 'Baraat forberedelser - Brudgom med familie og venner',
      location: 'Utenfor Gurdwara',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  3,
      notifications_sent: false,
  },
    {
      id: 'sikh-',
      eventId: 'baraat-prosesjon',
      time: '09:30-10:0',
      activity: 'Baraat Prosesjon - Musikk, dans og festtog',
      location: 'Fra parkering til Gurdwara hovedinngang',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  4,
      notifications_sent: false,
  },
    {
      id: 'sikh-',
      eventId: 'milni-seremoni',
      time: '10:00-10:3',
      activity: 'Milni Seremoni - Familie-møte og presentasjoner',
      location: 'Gurdwara inngangsområde',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  5,
      notifications_sent: false,
  },
    {
      id: 'sikh-',
      eventId: 'anand-karaj-forberedelser',
      time: '10:30-11:0',
      activity: 'Forberedelser til Anand Karaj - Hellig vielse',
      location: 'Gurdwara hovedsal',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  6,
      notifications_sent: false,
  },
    {
      id: 'sikh-',
      eventId: 'anand-karaj-vielse',
      time: '11:00-12:3',
      activity: 'Anand Karaj - Guru Granth Sahib vielse med 4 Laavan',
      location: 'Gurdwara hovedsal',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  7,
      persons_involved: [
        {
          id: 'granthi',
          name: 'Granthi (Religiøs leder, )',
          role: 'Gurdwara Granthi',
          email: 'granthi@gurdwaraoslo.no',
          phone: '900 00 00',
          priority: 'critical',
          notify_first: true,
          is_vip: true,
      },
      ],
      notifications_sent: false,
  },
    {
      id: 'sikh-',
      eventId: 'langar-forberedelser',
      time: '12:30-13:0',
      activity: 'Langar forberedelser - Fellesmåltid organisering',
      location: 'Gurdwara kjøkken og spisesal',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  8,
      notifications_sent: false,
  },
    {
      id: 'sikh-',
      eventId: 'langar-servering',
      time: '13:00-14:3',
      activity: 'Langar - Tradisjonelt fellesMåltid for alle gjester',
      location: 'Gurdwara spisesal',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  9,
      notifications_sent: false,
  },
    {
      id: 'sikh-1',
      eventId: 'doli-seremoni',
      time: '14:30-15:0',
      activity: 'Doli Seremoni - Brudens avskjed fra hjemmet',
      location: 'Gurdwara utgang',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  10,
      notifications_sent: false,
  },
    {
      id: 'sikh-1',
      eventId: 'resepsjon-ankomst',
      time: '16:0',
      activity: 'Ankomst til resepsjonslokale',
      location: 'Resepsjonslokale (venue varierer, )',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  11,
      notifications_sent: false,
  },
    {
      id: 'sikh-1',
      eventId: 'resepsjon-middag',
      time: '16:30-19:0',
      activity: 'Resepsjonsmiddag med taler og underholdning',
      location: 'Resepsjonslokale',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  12,
      notifications_sent: false,
  },
  ];

  // Indisk bryllup - Hindu tradisjoner og ritualer
  const getIndianWeddingTimeline = (): TimelineEvent[] => [
    {
      id: 'indian-',
      eventId: 'haldi-seremoni',
      time: '10:00-12:0',
      activity: 'Haldi Seremoni - Gurkemeie-ritual for både brud og brudgom',
      location: 'Separate familieheimen',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  1,
      notifications_sent: false,
  },
    {
      id: 'indian-',
      eventId: 'mehendi-forberedelser',
      time: '14:00-14:3',
      activity: 'Mehendi forberedelser - Hennamaling setup',
      location: 'Brudens hjem eller leid venue',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  2,
      notifications_sent: false,
  },
    {
      id: 'indian-',
      eventId: 'mehendi-seremoni',
      time: '14:30-18:0',
      activity: 'Mehendi Seremoni - Hennamaling, musikk og dans',
      location: 'Mehendi venue',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  3,
      persons_involved: [
        {
          id: 'mehendi-artist',
          name: 'Mehendi Kunstner',
          role: 'Henna Spesialist',
          email: 'mehendi@example.com',
          phone: '900 00 00',
          priority: 'high',
          notify_first: true,
          is_vip: false,
      },
      ],
      notifications_sent: false,
  },
    {
      id: 'indian-',
      eventId: 'sangeet-kveld',
      time: '19:00-23:0',
      activity: 'Sangeet - Musikk, dans og underholdning',
      location: 'Sangeet venue eller hotell',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  4,
      notifications_sent: false,
  },
    {
      id: 'indian-',
      eventId: 'brudestyling-dag',
      time: '06:00-09:0',
      activity: 'Bryllupsdag - Brudestyling og sari-draping',
      location: 'Brudens suite',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  5,
      notifications_sent: false,
  },
    {
      id: 'indian-',
      eventId: 'ganesh-puja',
      time: '09:00-09:3',
      activity: 'Ganesh Puja - Åpningsritual for å fjerne hindringer',
      location: 'Bryllupsvenue',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  6,
      notifications_sent: false,
  },
    {
      id: 'indian-',
      eventId: 'baraat-prosesjon-indian',
      time: '10:00-11:0',
      activity: 'Baraat - Brudgom ankomst på hvit hest med prosesjon',
      location: 'Fra hotell til venue',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  7,
      notifications_sent: false,
  },
    {
      id: 'indian-',
      eventId: 'jaimala-seremoni',
      time: '11:00-11:3',
      activity: 'Jaimala - Utveksling av blomsterkranse',
      location: 'Venue mandap (vielsespavisong, )',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  8,
      notifications_sent: false,
  },
    {
      id: 'indian-',
      eventId: 'kanyadaan',
      time: '11:30-12:0',
      activity: 'Kanyadaan - Brudens far overgir henne til brudgom',
      location: 'Mandap',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  9,
      notifications_sent: false,
  },
    {
      id: 'indian-1',
      eventId: 'agni-parinayana',
      time: '12:00-13:0',
      activity: 'Agni Parinayam - Hellig ild-seremoni og 7 runder',
      location: 'Mandap',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  10,
      persons_involved: [
        {
          id: 'pandit',
          name: 'Pandit (Hindu prest, )',
          role: 'Religiøs seremonileder',
          email: 'pandit@example.com',
          phone: '900 00 00',
          priority: 'critical',
          notify_first: true,
          is_vip: true,
      },
      ],
      notifications_sent: false,
  },
    {
      id: 'indian-1',
      eventId: 'sindoor-mangalsutra',
      time: '13:00-13:3',
      activity: 'Sindoor og Mangalsutra - Endelige ekteskapssymboler',
      location: 'Mandap',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  11,
      notifications_sent: false,
  },
    {
      id: 'indian-1',
      eventId: 'lunch-resepsjon',
      time: '13:30-15:3',
      activity: 'Bryllunsjmiddag og fotosesjoner',
      location: 'Venue spisesal',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  12,
      notifications_sent: false,
  },
    {
      id: 'indian-1',
      eventId: 'vidaai-seremoni',
      time: '15:30-16:0',
      activity: 'Vidaai - Brudens emosjonelle avskjed fra familie',
      location: 'Venue utgang',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  13,
      notifications_sent: false,
  },
    {
      id: 'indian-1',
      eventId: 'resepsjon-kveld',
      time: '18:00-22:0',
      activity: 'Kveldresepsjon - Middag, taler og dans',
      location: 'Kveld venue (kan være samme eller nytt sted, )',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  14,
      notifications_sent: false,
  },
  ];

  // Pakistansk bryllup - Nikah og tradisjonelle seremonier
  const getPakistaniWeddingTimeline = (): TimelineEvent[] => [
    {
      id: 'pak-',
      eventId: 'nikkah-forberedelser',
      time: '14:00-15:0',
      activity: 'Nikkah forberedelser - Religiøse og juridiske dokumenter',
      location: 'Moské eller bryllupsvenue',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder:  1,
      notifications_sent: false,
  },
    {
      id: 'pak-',
      eventId: 'nikkah-seremoni',
      time: '15:00-16:0',
      activity: 'Nikkah Seremoni - Islamsk vielse og Mahr',
      location: 'Moské eller venue',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  2,
      persons_involved: [
        {
          id: 'imam-pak',
          name: 'Imam',
          role: 'Religiøs leder',
          email: 'imam@moske.no',
          phone: '900 00 00',
          priority: 'critical',
          notify_first: true,
          is_vip: true,
      },
      ],
      notifications_sent: false,
  },
    {
      id: 'pak-',
      eventId: 'walima-resepsjon',
      time: '17:00-21:0',
      activity: 'Walima Resepsjon - Bryllupsmiddag og feiring',
      location: 'Resepsjonslokale',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder:  3,
      notifications_sent: false,
  },
  ];

  // Query for timeline data with real API - prioritize project-based timeline
  const {
    data: timeline,
    isLoading: timelineLoading,
    error: timelineError,
} = useQuery({
    queryKey: projectIntegration?.projectId
      ? ['/api/projects', projectIntegration.projectId, 'wedding-timeline']
      : ['/api/wedding-timeline', weddingId],
    queryFn: () => {
      if (projectIntegration?.projectId) {
        console.log('🔍 Henter bryllupstidslinje for prosjekt, :', projectIntegration.projectId);
        return apiRequest(`/api/projects/${projectIntegration.projectId}/wedding-timeline`);
    }
      return apiRequest(`/api/wedding-timeline/${weddingId}`);
  },
    retry: false,
    staleTime: 3000,
});

  // Use cultural-specific demo data if API fails
  const events = timeline?.events || getCulturalTimelineData();

  // Mutations for timeline management
  const addPersonMutation = useMutation({
    mutationFn: async (data: any) =>
      apiRequest(`/api/wedding-timeline/${weddingId}/events/${selectedEventId}/persons`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wedding-timeline'],});
      setOpenAddPersonDialog(false);
      enqueueSnackbar('Person lagt til i tidslinje', { variant: 'success' });
      setNewPerson({
        name: ', ',
        role: ', ',
        email: ', ',
        phone: ',',
        priority: 'medium',
        notify_first: false,
        is_vip: false,
    });
  },
});

  const sendNotificationMutation = useMutation({
    mutationFn: async ({ eventId, message }: { eventId: string; message: string }) =>
      apiRequest(`/api/wedding-timeline/${weddingId}/events/${eventId}/notify`, {
        method: 'POST',
        body: JSON.stringify({ message }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wedding-timeline'],});
      enqueueSnackbar('Varsling sendt!', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Kunne ikke sende varsling', { variant: 'error' });
    },
});

  const Card = Paper;

  const MuiCard = ({ children, sx, ...props }: any) => (
    <Card
      elevation={6}
      sx={{
        background: glassEffect,
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(25, 255, 255, 0.1)',
        ...theming.getThemedCardSx(),
        ...sx
      }}
      {...props}>
      {children}
    </Card>
  );

  // Tab panels
  const tabLabels = [
    'Personer & Roller','Tidsplan & Aktiviteter','Kommunikasjon & Varsling','Posisjonering & Utstyr',
  ];

  // Loading state
  if (timelineLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px'}}
      >
        <CircularProgress sx={{ color }} />
        <Typography variant="h6" sx={{ ml: 2, color: theming.colors.primary }}>
          Laster bryllupstidslinje...
        </Typography>
      </Box>
    );
}
  if (timelineError) {
    return (
      <Alert severity="warning" sx={{ m:  2 }}>
        <Typography variant="body2">
          Timeline ikke funnet. Viser demo-data for {culturalType} bryllup.
        </Typography>
      </Alert>
    );
}
  // Render functions for the 4 tabs
  const renderPersonsAndRoles = () => (
    <MuiCard sx={{ mb: 3, background: glassEffect, backdropFilter: 'blur(20px)'}}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <People sx={{ color, mr: 2, fontSize: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary }}>
            Personer & Roller{timeline?.coupleName ? ` - ${timeline.coupleName}` : ''}
          </Typography>
          <Box sx={{ ml: 'auto'}}>
            <Button variant="contained" startIcon={<Add />} sx={{ bgcolor: color, ...theming.getThemedButtonSx() }}>
              Legg til person
            </Button>
          </Box>
        </Box>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>VIP-prioritering: </strong> Når personer legges til i timeline opprettes
            automatisk korrespondanse. VIP-personer og kritiske kontakter varsles FØRST via chat og
            email.
          </Typography>
        </Alert>
        {events.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary" sx={{ ...{}, color: theming.colors.primary }}>
              Ingen personer registrert ennå
            </Typography>
          </Box>
        ) : (
          events
            .sort((a: TimelineEvent, b: TimelineEvent) => a.sortOrder - b.sortOrder)
            .map((event: TimelineEvent) => (
              <MuiCard key={event.id || event.eventId} sx={{ mb: 2, bgcolor: '#fafafa' }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 2}}
                  >
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                        {event.time} - {event.activity}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {event.location && `📍 ${event.location}`}
                        <Chip label={event.creatorType} size="small" sx={{ ml: 1, height: 2 }} />
                        {event.hasPhoto && (
                          <Chip label="📸 Foto" size="small" sx={{ ml: 0.5, height: 2 }} />
                        )}
                        {event.hasVideo && (
                          <Chip label="🎥 Video" size="small" sx={{ ml: 0.5, height: 2 }} />
                        )}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      {event.notifications_sent ? (
                        <Chip label="Varslet" color="success" size="small" icon={<CheckCircle />} />
                      ) : (
                        <Chip
                          label="Venter varsling"
                          color="warning"
                          size="small"
                          icon={<Warning />}
                        />
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Add />}
                        onClick={() => {
                          setSelectedEventId(event.id || event.eventId);
                          setOpenAddPersonDialog(true);
                      }}
                      >
                        Legg til person
                      </Button>
                    </Box>
                  </Box>
                  {event.persons_involved && event.persons_involved.length > 0 && (
                    <>
                      <Divider sx={{ my:  2 }} />
                      <List dense>
                        {event.persons_involved
                          .sort((a: VIPContact, b: VIPContact) => {
                            if (a.priority === 'critical' && b.priority !== 'critical') return -1;
                            if (a.priority !== 'critical' && b.priority === 'critical') return 1;
                            if (a.is_vip && !b.is_vip) return -1;
                            if (!a.is_vip && b.is_vip) return 1;
                            return 0;
                        })
                          .map((person: VIPContact, idx: number) => (
                            <ListItem key={idx} sx={{ py: 1 }}>
                              <ListItemIcon>
                                <Avatar
                                  sx={{
                                    bgcolor: color,
                                    width:  32,
                                    height:  32,
                                    fontSize: '0.9rem'}}
                                >
                                  {person.name.charAt(0)}
                                </Avatar>
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap:  1,
                                      flexWrap: 'wrap'}}
                                  >
                                    <Typography variant="subtitle2" fontWeight={600}>
                                      {person.name}
                                    </Typography>
                                    <Chip
                                      label={person.role}
                                      size="small"
                                      variant="outlined"
                                      sx={{ height:  20, fontSize: '0.7rem'}}
                                    />
                                    <Chip
                                      label={person.priority.toUpperCase()}
                                      size="small"
                                      color={
                                        person.priority === 'critical'
                                          ? 'error'
                                          : person.priority === 'high'
                                            ? 'warning'
                                            : 'primary'
                                    }
                                      sx={{ height:  20, fontSize: '0.7rem'}}
                                    />
                                    {person.is_vip && (
                                      <Chip
                                        label="VIP"
                                        size="small"
                                        color="secondary"
                                        sx={{
                                          height:  20,
                                          fontSize: '0.7rem'}}
                                      />
                                    )}
                                    {person.notify_first && (
                                      <VolumeUp
                                        sx={{
                                          fontSize:  16,
                                          color: '#f57c0'}}
                                      />
                                    )}
                                  </Box>
                              }
                                secondary={
                                  <Box>
                                    <Typography variant="caption" color="text.secondary">
                                      📧 {person.email} • 📱 {person.phone}
                                    </Typography>
                                    {person.notify_first && (
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: '#f57c0',
                                          fontWeight: 60
                                         , display: 'block'}}
                                      >
                                        ⚠️ Varsles FØRST ved endringer
                                      </Typography>
                                    )}
                                  </Box>
                              }
                              />
                            </ListItem>
                          ))}
                      </List>
                    </>
                  )}
                </CardContent>
              </MuiCard>
            ))
        )}
      </CardContent>
    </MuiCard>
  );

  const renderTimelineActivities = () => (
    <MuiCard sx={{ mb: 3 }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Schedule sx={{ color, mr: 2, fontSize: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary }}>
            Tidsplan & Aktiviteter
          </Typography>
        </Box>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Komplett kjøreplan{timeline?.coupleName ? ` for ${timeline.coupleName} sitt bryllup` : ''}. 
            Alle tider er fastsatt og koordinert med venue og leverandører{culturalLabel}.
          </Typography>
        </Alert>
        {events
          .sort((a: TimelineEvent, b: TimelineEvent) => a.sortOrder - b.sortOrder)
          .map((event: TimelineEvent) => (
            <MuiCard key={event.id || event.eventId} sx={{ mb: 2, bgcolor: '#f5f5f5' }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'}}
                >
                  <Box sx={{ flex:  1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                      {event.time}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 5, mb: 1 }}>
                      {event.activity}
                    </Typography>
                    {event.location && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
                      >
                        <LocationOn sx={{ fontSize: 16, mr: 0.5 }} />
                        {event.location}
                      </Typography>
                    )}
                     <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={`#${event.sortOrder}`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 2}}
                      />
                      <Chip
                        label={event.creatorType}
                        size="small"
                        sx={{ height:  20, bgcolor: color, color: 'white'}}
                      />
                      {event.hasPhoto && (
                        <Chip label="📸 Foto" size="small" color="primary" sx={{ height: 2}} />
                      )}
                      {event.hasVideo && (
                        <Chip label="🎥 Video" size="small" color="secondary" sx={{ height: 2}} />
                      )}
                    </Box>
                  </Box>
                  <Box>
                    {event.notifications_sent ? (
                      <CheckCircle sx={{ color: 'green', fontSize: 2}} />
                    ) : (
                      <Warning sx={{ color: 'orange', fontSize: 2}} />
                    )}
                  </Box>
                </Box>
              </CardContent>
            </MuiCard>
          ))}
      </CardContent>
    </MuiCard>
  );

  const renderCommunication = () => (
    <MuiCard sx={{ mb: 3 }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Chat sx={{ color, mr: 2, fontSize: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary }}>
            Kommunikasjon & Varsling
          </Typography>
          <Box sx={{ ml: 'auto'}}>
            <Button variant="contained"
              startIcon={<VolumeUp />}
              sx={{ bgcolor: color, ...theming.getThemedButtonSx() }}
              onClick={() => console.log('Send massevarsling - TODO: Implement')}
            >
              Send massevarsling
            </Button>
          </Box>
        </Box>
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>VIP-prioritering aktiv: </strong> Kritiske kontakter og VIP-personer varsles
            først. Automatisk eskalering til telefon hvis email ikke leses innen 30 minutter.
          </Typography>
        </Alert>

        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
          Varslingsstatus per aktivitet: </Typography>

        {events
          .filter((event: TimelineEvent) => event.persons_involved && event.persons_involved.length > 0)
          .sort((a: TimelineEvent, b: TimelineEvent) => a.sortOrder - b.sortOrder)
          .map((event: TimelineEvent) => (
            <MuiCard key={event.id || event.eventId} sx={{ mb: 2, bgcolor: '#f8f9fa' }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2}}
                >
                  <Typography variant="subtitle1" fontWeight={600}>
                    {event.time} - {event.activity}
                  </Typography>
                  <Box>
                    {event.notifications_sent ? (
                      <Chip
                        label="✅ Varslet"
                        color="success"
                        size="small"
                        icon={<CheckCircle />}
                      />
                    ) : (
                      <Button size="small"
                        variant="contained"
                        startIcon={<VolumeUp />}
                        sx={{ bgcolor: color, ...theming.getThemedButtonSx() }}
                        onClick={() => {
                          sendNotificationMutation.mutate({
                            eventId: event.id || event.eventId,
                            message: `Viktig oppdatering for ${event.activity} kl. ${event.time}`,
                        });
                      }}
                        disabled={sendNotificationMutation.isPending}
                      >
                        Send varsling
                      </Button>
                    )}
                  </Box>
                </Box>

                {event.persons_involved && event.persons_involved.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Involverte personer ({event.persons_involved.length}):
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  1 }}>
                      {event.persons_involved
                        .sort((a, b) => {
                          if (a.priority === 'critical' && b.priority !== 'critical') return -1;
                          if (a.priority !== 'critical' && b.priority === 'critical') return 1;
                          if (a.notify_first && !b.notify_first) return -1;
                          if (!a.notify_first && b.notify_first) return 1;
                          return 0;
                      })
                        .map((person, idx) => (
                          <Chip
                            key={idx}
                            avatar={
                              <Avatar sx={{ bgcolor: color, fontSize: '0.8rem'}}>
                                {person.name.charAt(0)}
                              </Avatar>
                          }
                            label={`${person.name} (${person.role})`}
                            size="small"
                            color={
                              person.priority === 'critical'
                                ? 'error'
                                : person.priority === 'high'
                                  ? 'warning'
                                  : 'default'
                          }
                            icon={person.notify_first ? <PriorityHigh /> : undefined}
                            sx={{
                              mb: 0.5,
                              border: person.is_vip ? '2px solid gold' : undefined
                            }}
                          />
                        ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </MuiCard>
          ))}
      </CardContent>
    </MuiCard>
  );

  const renderPositioning = () => (
    <MuiCard sx={{ mb: 3 }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Lightbulb sx={{ color, mr: 2, fontSize: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary }}>
            Posisjonering & Utstyr
          </Typography>
        </Box>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Strategisk posisjonering for optimal foto/video-dekning. Koordinert med venue og andre
            leverandører.
          </Typography>
        </Alert>

        {events
          .filter((event: TimelineEvent) => event.hasPhoto || event.hasVideo)
          .sort((a: TimelineEvent, b: TimelineEvent) => a.sortOrder - b.sortOrder)
          .map((event: TimelineEvent) => (
            <MuiCard key={event.id || event.eventId} sx={{ mb: 2, bgcolor: '#f0f8ff' }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: theming.colors.primary }}>
                  {event.time} - {event.activity}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  📍 {event.location}
                </Typography>

                <Box sx={{ display: 'flex', gap:  2 }}>
                  {event.hasPhoto && (
                    <Box
                      sx={{
                        flex:  1,
                        p:  2,
                        bgcolor: 'rgba(3, 150, 243, 0.1)',
                        borderRadius:  2,
                        border: '1px solid rgba(3, 150, 243, 0.3)'}}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 600, color: '#1976d', mb: 1 }}
                      >
                        📸 Fotografi
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Posisjon: </strong> Strategisk plassering for beste vinkel
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Utstyr: </strong> Canon EOS 5, 24-70mm f/2.8, 70-200mm f/2.8
                      </Typography>
                      <Typography variant="body2">
                        <strong>Fokus: </strong> Naturlige øyeblikk og detaljer
                      </Typography>
                    </Box>
                  )}

                  {event.hasVideo && (
                    <Box
                      sx={{
                        flex:  1,
                        p:  2,
                        bgcolor: 'rgba(16, 39, 176, 0.1)',
                        borderRadius:  2,
                        border: '1px solid rgba(16, 39, 176, 0.3)'}}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 600, color: '#9c27b', mb: 1 }}
                      >
                        🎥 Videografi
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Posisjon: </strong> Diskret bakgrunnsposisjon
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Utstyr: </strong> Sony F3, DJI Ronin, trådløst lyd
                      </Typography>
                      <Typography variant="body2">
                        <strong>Fokus: </strong> Kontinuerlig dokumentasjon
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </MuiCard>
          ))}
      </CardContent>
    </MuiCard>
  );

  // Add Person Dialog
  const AddPersonDialog = () => (
    <Dialog
      open={openAddPersonDialog}
      onClose={() => setOpenAddPersonDialog(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Legg til person i timeline</DialogTitle>
      <DialogContent>
        <Box sx={{ pt:  2 }}>
          <TextField
            fullWidth
            label="Navn"
            value={newPerson.name}
            onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Rolle"
            value={newPerson.role}
            onChange={(e) => setNewPerson({ ...newPerson, role: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="E-post"
            type="email"
            value={newPerson.email}
            onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Telefon"
            value={newPerson.phone}
            onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Prioritet</InputLabel>
            <Select
              value={newPerson.priority}
              onChange={(e) =>
                setNewPerson({
                  ...newPerson,
                  priority: e.target.value as 'critical' | 'high' | 'medium',
              })
            }
              label="Prioritet"
            >
              <MenuItem value="critical">Kritisk</MenuItem>
              <MenuItem value="high">Høy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenAddPersonDialog(false)}>Avbryt</Button>
        <Button
          onClick={() => {
            addPersonMutation.mutate({
              ...newPerson,
              id: `${Date.now()}`,
          });
        }}
          variant="contained"
          sx={{ bgcolor: color }}
          disabled={!newPerson.name || !newPerson.role || addPersonMutation.isPending}
        >
          Legg til
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${color}22 0%, #000 100%)`,
        py: 2}}
    >
      <Box sx={{ maxWidth: 120, mx: 'auto', px: 2 }}>
        {/* Project Integration Alert */}
        {projectIntegration?.weddingTimelineIntegrated && (
          <Alert
            severity="success"
            sx={{
              mb: 3,
              bgcolor: 'rgba(6, 175, 80, 0.1)',
              border: '1px solid rgba(6, 175, 80, 0.3)'}}
          >
            ✅ Bryllupstidslinje er nå koblet til ditt prosjekt! Kulturell type: {', '}
            {projectIntegration.culturalType || culturalType}
          </Alert>
        )}

        {/* Viktig informasjon fra {professionLabel} */}
        <MuiCard
          sx={{
            mb: 3,
            background: 'linear-gradient(145deg, #e3f2fd 0%, #bbdefb 100%)',
            border: '2px solid #2196f',
            borderRadius:  3,
            backdropFilter: 'blur(10px)'}}
        >
          <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h5"
              sx={{
                mb: 2,
                fontWeight: 600,
                color: theming.colors.primary,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
              <CameraAlt sx={{ mr: 1 }} />
              Viktig informasjon fra {professionLabel}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8, color: '#1565c0' }}>
              Kære {timeline?.coupleName || 'brudeparet'},
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8, color: '#1976d2' }}>
              Her er viktig informasjon for bryllupsdagen. Vi vil oppdatere dere fortløpende hvis
              det skjer endringer i tidsplanen.
            </Typography>

            {/* Aktuelle meldinger fra {professionLabel} - Real-time updates */}
            <Box
              sx={{
                bgcolor: 'rgba(25,255,255,0.9)',
                p:  2,
                borderRadius:  2,
                border: '1px solid #e3f2fd',
                mb: 2}}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#1976d2' }}>
                📢 Siste oppdatering: </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: '#1565c0' }}>
                • Fotografering starter presis kl. 14: 00 - vær klare 15 minutter før
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: '#1565c0' }}>
                • Husk å lade telefonene - vi bruker dem til koordinering
              </Typography>
              <Typography variant="body2" sx={{ color: '#1565c0'}}>
                • Ved spørsmål, ring {professionLabel} på {timeline?.creatorEmail || '+47 xxx xx xxx'}
              </Typography>
            </Box>

            {/* Værvarsel og praktisk info */}
            <Box
              sx={{
                bgcolor: 'rgba(25,245,158,0.3)',
                p:  2,
                borderRadius:  2,
                border: '1px solid #ffc10'}}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#f57c00' }}>
                🌤️ Værvarsel og praktisk info: </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: '#ef6c00' }}>
                • Delvis skyet, 18°C - perfekt for utendørs bilder
              </Typography>
              <Typography variant="body2" sx={{ color: '#ef6c00'}}>
                • Backup-plan: Innendørs lokasjon hvis regn
              </Typography>
            </Box>
          </CardContent>
        </MuiCard>

        {/* Client View Header */}
        <MuiCard sx={{ mb: 3, textAlign: 'center'}}>
          <CardContent sx={{ py: 4 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, color: theming.colors.primary }}>
              🤵👰 {timeline?.coupleName || 'Bryllup'} {new Date(timeline?.weddingDate || Date.now()).getFullYear()}{culturalLabel}
            </Typography>
            <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
              {timeline?.venue || 'Bryllupslokasjon'}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap:  2,
                flexWrap: 'wrap'}}
            >
              <Chip
                label={`${events.length} aktiviteter`}
                icon={<Schedule />}
                sx={{ bgcolor: color, color: 'white'}}
              />
              <Chip label="VIP-system aktivt" icon={<PriorityHigh />} color="warning" />
              <Chip label="Profesjonell fotografi" icon={<Lightbulb />} color="primary" />
              {projectIntegration?.weddingTimelineIntegrated && (
                <Chip label="Integrert med prosjekt" icon={<Sync />} color="success" />
              )}
            </Box>
          </CardContent>
        </MuiCard>

        {/* Navigation Tabs */}
        <MuiCard sx={{ mb: 3 }}>
          <CardContent sx={{ py: 2 ,  ...theming.getThemedCardSx() }}>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant="fullWidth"
              sx={{
                '& .MuiTab-root': {
                  color: 'rgba(25,255,255,0.7)',
                  fontWeight: 600
              }, 
              '& .Mui-selected': {
                  color: color,
              },
              '& .MuiTabs-indicator': {
                  backgroundColor: color,
              }
            }}
            >
              {tabLabels.map((label, index) => (
                <Tab key={index} label={label} />
              ))}
            </Tabs>
          </CardContent>
        </MuiCard>

        {/* Tab Content */}
        {activeTab === 0 && renderPersonsAndRoles()}
        {activeTab === 1 && renderTimelineActivities()}
        {activeTab === 2 && renderCommunication()}
        {activeTab === 3 && renderPositioning()}

        {/* Share with Client Floating Action Button */}
        <Fab
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            bgcolor: color,
            '&:hover': {
              bgcolor: color,
              transform: 'scale(1.1)',
            }
          }}
          onClick={handleShare}
          disabled={generateClientAccess.isPending}
        >
          {generateClientAccess.isPending ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            <Share />
          )}
        </Fab>

        {/* Send Wedding Timeline Email Button */}
        <Fab
          sx={{
            position: 'fixed',
            bottom:  90,
            right:  20,
            bgcolor: 'rgba(25, 1520.9)', '&:hover': {
              bgcolor: 'rgba(25, 1521)',
              transform: 'scale(1.1, )',
          }}}
          onClick={handleOpenEmailDialog}
          disabled={sendingEmail}
        >
          {sendingEmail ? <CircularProgress size={24} color="inherit" /> : <Email />}
        </Fab>

        {/* Add Person Dialog */}
        <AddPersonDialog />

        {/* Share Dialog with Access Code System */}
        <Dialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ bgcolor: color, color: 'white'}}>
            Del bryllupstidslinje med bryllupsparet
          </DialogTitle>
          <DialogContent sx={{ p:  3 }}>
            {generateClientAccess.data?.warning && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {generateClientAccess.data.warning}
              </Alert>
            )}

            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
              6-sifret tilgangskode: </Typography>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap:  2,
                mb: 3,
                p:  2,
                bgcolor: 'rgba(0,0,0,0.05)',
                borderRadius:  2,
                border: '2px solid',
                borderColor: color}}
            >
              <Typography variant="h4"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: 4,
                  color: theming.colors.primary,
                  flex: 1,
                  textAlign: 'center'
                }}>
                {generateClientAccess.data?.accessCode || '------'}
              </Typography>
              <Button
                variant="outlined"
                onClick={copyToClipboard}
                sx={{ borderColor: color, color: color }}
              >
                Kopier
              </Button>
            </Box>

            <Typography variant="body2" sx={{ mb: 2 }}>
              Send denne lenken til bryllupsparet: </Typography>

            <TextField
              fullWidth
              value={clientUrl}
              InputProps={{
                readOnly: true,
                style: { fontSize: '14px',}}}
              sx={{ mb: 2 }}
            />

            <Alert severity="info" sx={{ mb: 2 }}>
              Bryllupsparet skriver inn den 6-sifrede koden når de åpner lenken. Koden utløper etter
              30 dager.
            </Alert>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Bryllupsparet kan bruke koden til å: • Se sanntids bryllupstidslinje • Få varsler om
              kommende aktiviteter • Se hvor fotografering skjer • Kontakte deg direkte
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center'}}>
              <Button
                variant="outlined"
                onClick={handleRegenerateCode}
                disabled={generateClientAccess.isPending}
                sx={{ borderColor: 'warning.main', color: 'warning.main'}}
              >
                Generer ny kode
              </Button>
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', mt: 1 }}
            >
              ⚠️ Ved ny kode mister bryllupsparet tilgang med den gamle koden
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShareDialogOpen(false)}>Lukk</Button>
            <Button 
              variant="contained"
              sx={{ bgcolor: color, ...theming.getThemedButtonSx() }}
              onClick={() => {
                const message = `🎉 Din bryllupstidslinje er klar!\n\nTilgangskode: ${generateClientAccess.data?.accessCode}\nLenke: ${clientUrl}\n\nSkriv inn koden når du åpner lenken på bryllupsdagen!`;

                if (navigator.share) {
                  navigator.share({
                    title: 'Bryllupstidslinje - Tilgangskode',
                    text: message,
                  });
                } else {
                  navigator.clipboard.writeText(message);
                }
              }}
            >
              Del kode
            </Button>
          </DialogActions>
        </Dialog>

        {/* Email Dialog - samme kode som showcase */}
        <Dialog
          open={emailDialogOpen}
          onClose={() => setEmailDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle
            sx={{
              bgcolor: color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap:  1}}
          >
            <Email />
            Send bryllupstidslinje til klient
          </DialogTitle>
          <DialogContent sx={{ p:  3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Send en personlig e-post med bryllupstidslinje og pin-kode til klienten
            </Typography>

            <TextField
              fullWidth
              label="Klient e-post"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              sx={{ mb: 3 }}
              placeholder="lemy@example.com"
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Din signatur"
              value={photographerSignature}
              onChange={(e) => setPhotographerSignature(e.target.value)}
              sx={{ mb: 3 }}
              placeholder="Mvh,
Daniel Drager
Blekk & Film Studio
daniel@creatorhubn.com"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={includeDownloadCode}
                  onChange={(e) => setIncludeDownloadCode(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: color }}}
                />
            }
              label="Inkluder nedlastingskode for bilder"
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button
                variant="outlined"
                onClick={handleOpenEmailDesigner}
                startIcon={<DesignIcon />}
                sx={{ borderColor: color, color: color }}
              >
                Tilpass e-post design
              </Button>
              {emailTemplate && (
                <Typography variant="caption" color="success.main" sx={{ alignSelf: 'center'}}>
                  ✓ Template lagret
                </Typography>
              )}
            </Box>

            <Alert severity="info">
              E-posten vil inneholde en personlig lenke med tilgangskode som klienten kan bruke for
              å se bryllupstidslinjen.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEmailDialogOpen(false)}>Avbryt</Button>
            <Button onClick={handleSendWeddingTimeline}
              variant="contained"
              disabled={!clientEmail || sendingEmail}
              sx={{ bgcolor: color }}
              startIcon={sendingEmail ? <CircularProgress size={16} sx={theming.getThemedButtonSx()} /> : <Email />}
            >
              {sendingEmail ? 'Sender...' : 'Send bryllupstidslinje'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Email Designer Dialog - samme kode som showcase */}
        <Dialog
          open={emailDesignerOpen}
          onClose={() => setEmailDesignerOpen(false)}
          maxWidth="xl"
          fullWidth
          sx={{ '& .MuiDialog-paper': { height: '95vh',} }}
        >
          <DialogTitle
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'}}
          >
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Email Designer - Bryllupstidslinje{culturalLabel}
            </Typography>
            <IconButton onClick={() => setEmailDesignerOpen(false)} size="small">
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
            <EmailDesigner
              context="wedding-timeline"
              projectId={projectIntegration?.projectId || weddingId}
              onSave={handleSaveEmailTemplate}
            />
          </DialogContent>
        </Dialog>

      </Box>
    </Box>
  );
}
