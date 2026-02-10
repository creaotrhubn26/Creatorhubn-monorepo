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
  Tooltip,
  SvgIcon,
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
  Edit,
  Delete,
  FileCopy,
  Search,
  GetApp,
  Print,
  DragIndicator,
  AccessTime,
  Event as EventIcon,
  CalendarToday,
  PhotoCamera,
  Videocam,
  Favorite,
} from '@mui/icons-material';
// Feather Icons for modern, clean UI
import {
  Clock as FeatherClock,
  Camera as FeatherCamera,
  Video as FeatherVideo,
  MapPin as FeatherMapPin,
  Heart as FeatherHeart,
  Users as FeatherUsers,
  Bell as FeatherBell,
  MessageCircle as FeatherMessageCircle,
  Share2 as FeatherShare,
  RefreshCw as FeatherSync,
  AlertTriangle as FeatherWarning,
  CheckCircle as FeatherCheckCircle,
  Plus as FeatherPlus,
  Edit2 as FeatherEdit,
  Trash2 as FeatherTrash,
  Copy as FeatherCopy,
  Search as FeatherSearch,
  Download as FeatherDownload,
  Printer as FeatherPrinter,
  Calendar as FeatherCalendar,
  Star as FeatherStar,
  Award as FeatherAward,
} from 'react-feather';
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

// Custom Bride & Groom SVG Icon - Stylized
const BrideGroomIcon = (props: any) => (
  <SvgIcon {...props} viewBox="0 0 64 64">
    {/* Groom */}
    <circle cx="20" cy="14" r="5" fill="currentColor" />
    <path d="M15 20c0-2.5 2.5-4 5-4s5 1.5 5 4v12c0 1-0.5 2-1.5 2h-7c-1 0-1.5-1-1.5-2V20z" 
          fill="currentColor" />
    <rect x="17" y="9" width="6" height="3" rx="1.5" fill="currentColor" /> {/* Top hat */}
    <rect x="15" y="11" width="10" height="1.5" rx="0.5" fill="currentColor" /> {/* Hat brim */}
    <path d="M18.5 18h3v2h-3z" fill="white" opacity="0.3" /> {/* Bow tie */}
    
    {/* Bride */}
    <circle cx="44" cy="14" r="5" fill="currentColor" />
    <path d="M39 20c0-2.5 2.5-4 5-4s5 1.5 5 4v12c0 1-0.5 2-1.5 2h-7c-1 0-1.5-1-1.5-2V20z" 
          fill="currentColor" />
    {/* Elegant flowing veil */}
    <path d="M36 12 Q44 6 52 12 L50 16 Q44 10 38 16 Z" 
          fill="currentColor" opacity="0.5" />
    <ellipse cx="44" cy="9" rx="4" ry="2" fill="currentColor" opacity="0.6" /> {/* Hair bun */}
    {/* Dress flare */}
    <path d="M37 32 L39 34 Q44 36 49 34 L51 32 Q44 34 37 32 Z" 
          fill="currentColor" opacity="0.7" />
    
    {/* Decorative heart */}
    <path d="M32 24c-0.8-1.5-2.2-2.5-4-2.5-2.5 0-4 2-4 4 0 3.5 4 6.5 8 10 4-3.5 8-6.5 8-10 0-2-1.5-4-4-4-1.8 0-3.2 1-4 2.5z" 
          fill="currentColor" opacity="0.85" 
          transform="translate(0, -2) scale(0.5)" 
          transform-origin="32 24" />
    
    {/* Rings */}
    <g transform="translate(28, 38)">
      <circle cx="0" cy="0" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.9" />
      <circle cx="6" cy="0" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.9" />
      <circle cx="0" cy="0" r="1" fill="currentColor" opacity="0.9" /> {/* Diamond */}
      <circle cx="6" cy="0" r="1" fill="currentColor" opacity="0.9" /> {/* Diamond */}
    </g>
  </SvgIcon>
);

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
  
  // Delete event dialog state
  const [deleteEventDialogOpen, setDeleteEventDialogOpen] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
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
  
  // New feature states
  const [searchQuery, setSearchQuery] = useState('');
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<TimelineEvent>>({
    eventId: '',
    time: '',
    activity: '',
    location: '',
    creatorType: profession || 'Fotograf',
    hasPhoto: true,
    hasVideo: false,
    sortOrder: 1,
    persons_involved: [],
  });

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
  // Keys synced with Evendi TraditionsScreen via traditions bridge
  const getCulturalTimelineData = (): TimelineEvent[] => {
    switch (culturalType) {
      case 'sikh':
        return getSikhWeddingTimeline();
      case 'indisk':
        return getIndianWeddingTimeline();
      case 'pakistansk':
      case 'arabisk':
      case 'muslimsk':
      case 'somalisk':
      case 'libanesisk':
        return getPakistaniWeddingTimeline(); // Islamic traditions share similar structure
      case 'tyrkisk':
        return getTurkishWeddingTimeline();
      case 'iransk':
        return getPakistaniWeddingTimeline(); // Similar multi-day structure
      case 'etiopisk':
        return getEthiopianWeddingTimeline();
      case 'nigeriansk':
        return getNorwegianWeddingTimeline(); // Adaptable single-day base
      case 'filipino':
        return getFilipinoWeddingTimeline();
      case 'kinesisk':
        return getChineseWeddingTimeline();
      case 'koreansk':
        return getKoreanWeddingTimeline();
      case 'thai':
        return getIndianWeddingTimeline(); // Thai ceremonies share structure
      case 'norsk':
      case 'annet':
      default:
        return getNorwegianWeddingTimeline();
    }
  };
  
  // Cultural timeline display label — synced with Evendi traditions keys
  const culturalLabels: Record<string, string> = {
    norsk: '',
    sikh: ' (Sikh-tradisjon)',
    indisk: ' (Indisk/Hindu-tradisjon)',
    pakistansk: ' (Pakistansk-tradisjon)',
    tyrkisk: ' (Tyrkisk-tradisjon)',
    arabisk: ' (Arabisk-tradisjon)',
    somalisk: ' (Somalisk-tradisjon)',
    etiopisk: ' (Etiopisk-tradisjon)',
    nigeriansk: ' (Nigeriansk-tradisjon)',
    muslimsk: ' (Muslimsk-tradisjon)',
    libanesisk: ' (Libanesisk-tradisjon)',
    filipino: ' (Filipino-tradisjon)',
    kinesisk: ' (Kinesisk-tradisjon)',
    koreansk: ' (Koreansk-tradisjon)',
    thai: ' (Thai-tradisjon)',
    iransk: ' (Iransk/Persisk-tradisjon)',
    annet: ' (Tilpasset)',
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

  // Tyrkisk bryllup timeline — Kına Gecesi → Nikah → Düğün
  const getTurkishWeddingTimeline = (): TimelineEvent[] => [
    {
      id: 'tr-1',
      eventId: 'kina-gecesi',
      time: '18:00-22:00',
      activity: 'Kına Gecesi — Henna-kveld med tradisjonell dans og musikk',
      location: 'Familiens hjem eller festlokale',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder: 1,
      notifications_sent: false,
    },
    {
      id: 'tr-2',
      eventId: 'gelin-alma',
      time: '11:00-12:00',
      activity: 'Gelin Alma — Hente bruden med musikk og dans',
      location: 'Brudens hjem',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder: 2,
      notifications_sent: false,
    },
    {
      id: 'tr-3',
      eventId: 'nikah-seremoni',
      time: '13:00-14:00',
      activity: 'Nikah — Vielsesseremoni',
      location: 'Moské eller vielseslokale',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder: 3,
      notifications_sent: false,
    },
    {
      id: 'tr-4',
      eventId: 'taki-toreni',
      time: '15:00-16:00',
      activity: 'Takı Töreni — Gull og gaveseremoni fra gjestene',
      location: 'Bryllupslokale',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder: 4,
      notifications_sent: false,
    },
    {
      id: 'tr-5',
      eventId: 'dugun-feiring',
      time: '17:00-23:00',
      activity: 'Düğün — Bryllupsfest med Halay-dans og middag',
      location: 'Bryllupslokale',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder: 5,
      notifications_sent: false,
    },
  ];

  // Kinesisk bryllup timeline — Te-seremoni → Door Games → Bankett
  const getChineseWeddingTimeline = (): TimelineEvent[] => [
    {
      id: 'cn-1',
      eventId: 'door-games',
      time: '09:00-10:00',
      activity: 'Door Games — Brudgommen henter bruden med utfordringer',
      location: 'Brudens hjem',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder: 1,
      notifications_sent: false,
    },
    {
      id: 'cn-2',
      eventId: 'te-seremoni-brud',
      time: '10:30-11:30',
      activity: 'Te-seremoni — Serverer te til brudens foreldre',
      location: 'Brudens hjem',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder: 2,
      notifications_sent: false,
    },
    {
      id: 'cn-3',
      eventId: 'te-seremoni-groom',
      time: '12:00-13:00',
      activity: 'Te-seremoni — Serverer te til brudgommens foreldre',
      location: 'Brudgommens hjem',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder: 3,
      notifications_sent: false,
    },
    {
      id: 'cn-4',
      eventId: 'bankett',
      time: '18:00-22:00',
      activity: 'Bryllupsbankett — Middag med Dobbelt Lykke-dekor',
      location: 'Restaurant eller hotell',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder: 4,
      notifications_sent: false,
    },
  ];

  // Etiopisk bryllup timeline — Telosh → Kaffiseremoni → Melse
  const getEthiopianWeddingTimeline = (): TimelineEvent[] => [
    {
      id: 'et-1',
      eventId: 'telosh',
      time: '10:00-12:00',
      activity: 'Telosh — Førbryllupsseremoni med familiene',
      location: 'Familiens hjem',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder: 1,
      notifications_sent: false,
    },
    {
      id: 'et-2',
      eventId: 'kaffe-seremoni',
      time: '13:00-14:00',
      activity: 'Tradisjonell kaffe-seremoni med røkelse og velsignelse',
      location: 'Seremonistedet',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder: 2,
      notifications_sent: false,
    },
    {
      id: 'et-3',
      eventId: 'tilf-velsignelse',
      time: '14:30-15:30',
      activity: 'Tilf-velsignelse fra eldre i familien',
      location: 'Kirkelig seremoni eller familiens hjem',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder: 3,
      notifications_sent: false,
    },
    {
      id: 'et-4',
      eventId: 'melse-feiring',
      time: '17:00-23:00',
      activity: 'Melse — Bryllupsfest med Injera, Eskista-dans og musikk',
      location: 'Festlokale',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder: 4,
      notifications_sent: false,
    },
  ];

  // Filipino bryllup timeline — Church → Veil/Cord → Resepsjon
  const getFilipinoWeddingTimeline = (): TimelineEvent[] => [
    {
      id: 'ph-1',
      eventId: 'kirkeseremoni',
      time: '14:00-15:00',
      activity: 'Katolsk kirkeseremoni — Vielse med Arras og Veil & Cord',
      location: 'Katolsk kirke',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder: 1,
      notifications_sent: false,
    },
    {
      id: 'ph-2',
      eventId: 'unity-candle',
      time: '15:00-15:30',
      activity: 'Unity Candle-seremoni og Arras (13 mynter)',
      location: 'Kirken',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder: 2,
      notifications_sent: false,
    },
    {
      id: 'ph-3',
      eventId: 'resepsjon',
      time: '17:00-22:00',
      activity: 'Resepsjon med Lechon, Money Dance og tradisjonell feiring',
      location: 'Festlokale',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder: 3,
      notifications_sent: false,
    },
  ];

  // Koreansk bryllup timeline — Seremoni → Pyebaek
  const getKoreanWeddingTimeline = (): TimelineEvent[] => [
    {
      id: 'kr-1',
      eventId: 'seremoni',
      time: '12:00-13:00',
      activity: 'Bryllupsseremoni — Vielse i bryllupshall',
      location: 'Bryllupshall (Wedding Hall)',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: true,
      sortOrder: 1,
      notifications_sent: false,
    },
    {
      id: 'kr-2',
      eventId: 'pyebaek',
      time: '13:30-14:30',
      activity: 'Pyebaek — Tradisjonell seremoni i Hanbok med jujube og kastanjer',
      location: 'Pyebaek-rom',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder: 2,
      notifications_sent: false,
    },
    {
      id: 'kr-3',
      eventId: 'bankett',
      time: '15:00-18:00',
      activity: 'Bryllupsmiddag med familie og gjester',
      location: 'Bryllupshall',
      creatorType: 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder: 3,
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

  // Event CRUD mutations
  const addEventMutation = useMutation({
    mutationFn: async (eventData: Partial<TimelineEvent>) =>
      apiRequest(`/api/wedding-timeline/${weddingId}/events`, {
        method: 'POST',
        body: JSON.stringify(eventData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wedding-timeline'],});
      setEventDialogOpen(false);
      resetEventForm();
      enqueueSnackbar('Event lagt til!', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Kunne ikke legge til event', { variant: 'error' });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (eventData: TimelineEvent) =>
      apiRequest(`/api/wedding-timeline/${weddingId}/events/${eventData.id}`, {
        method: 'PUT',
        body: JSON.stringify(eventData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wedding-timeline'],});
      setEventDialogOpen(false);
      setSelectedEvent(null);
      enqueueSnackbar('Event oppdatert!', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Kunne ikke oppdatere event', { variant: 'error' });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) =>
      apiRequest(`/api/wedding-timeline/${weddingId}/events/${eventId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wedding-timeline'],});
      enqueueSnackbar('Event slettet!', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Kunne ikke slette event', { variant: 'error' });
    },
  });

  const duplicateEventMutation = useMutation({
    mutationFn: async (event: TimelineEvent) => {
      const duplicate = {
        ...event,
        id: undefined,
        eventId: `${event.eventId}-copy-${Date.now()}`,
        activity: `${event.activity} (Kopi)`,
        sortOrder: events.length + 1,
      };
      return apiRequest(`/api/wedding-timeline/${weddingId}/events`, {
        method: 'POST',
        body: JSON.stringify(duplicate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wedding-timeline'],});
      enqueueSnackbar('Event duplisert!', { variant: 'success' });
    },
  });

  // Helper functions
  const resetEventForm = () => {
    setNewEvent({
      eventId: '',
      time: '',
      activity: '',
      location: '',
      creatorType: profession || 'Fotograf',
      hasPhoto: true,
      hasVideo: false,
      sortOrder: events.length + 1,
      persons_involved: [],
    });
  };

  const handleAddEvent = () => {
    if (selectedEvent?.id) {
      updateEventMutation.mutate({ ...newEvent, id: selectedEvent.id } as TimelineEvent);
    } else {
      addEventMutation.mutate(newEvent);
    }
  };

  const handleEditEvent = (event: TimelineEvent) => {
    setSelectedEvent(event);
    setNewEvent(event);
    setEventDialogOpen(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    setDeleteEventId(eventId);
    setDeleteEventDialogOpen(true);
  };

  const confirmDeleteEvent = () => {
    if (deleteEventId) {
      deleteEventMutation.mutate(deleteEventId);
    }
    setDeleteEventDialogOpen(false);
    setDeleteEventId(null);
  };

  const handleDuplicateEvent = (event: TimelineEvent) => {
    duplicateEventMutation.mutate(event);
  };

  const handleExportPDF = () => {
    enqueueSnackbar('PDF-eksport kommer snart!', { variant: 'info' });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCalendar = () => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Creatorhubn//Wedding Timeline//NO',
      ...events.map(event => {
        const eventDate = timeline?.weddingDate || new Date().toISOString().split('T')[0];
        const [hours, minutes] = event.time.split(':');
        const startDateTime = `${eventDate.replace(/-/g, '')}T${hours}${minutes}00`;
        return [
          'BEGIN:VEVENT',
          `DTSTART:${startDateTime}`,
          `SUMMARY:${event.activity}`,
          `LOCATION:${event.location || ''}`,
          `UID:${event.id || event.eventId}@creatorhubn.com`,
          'END:VEVENT'
        ].join('\\r\\n');
      }),
      'END:VCALENDAR'
    ].join('\\r\\n');
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bryllupstidslinje.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    enqueueSnackbar('Kalender eksportert!', { variant: 'success' });
  };

  const filteredEvents = searchQuery
    ? events.filter((event) =>
        event.activity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.time.includes(searchQuery)
      )
    : events;

  const Card = Paper;

  // Modern card wrapper - no longer using old theming
  const MuiCard = ({ children, sx, ...props }: any) => (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
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
    <MuiCard
      sx={{
        mb: 3,
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.15)'
      }}
    >
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 3,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)'
            }}
          >
            <People sx={{ fontSize: 28 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Personer & Roller{timeline?.coupleName ? ` - ${timeline.coupleName}` : ''}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.25)',
            color: 'white',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.35)'
            }
          }}
        >
          Legg til person
        </Button>
      </Box>
      <CardContent sx={{ p: 3 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>VIP-prioritering: </strong> Når personer legges til i timeline opprettes
            automatisk korrespondanse. VIP-personer og kritiske kontakter varsles FØRST via chat og
            email.
          </Typography>
        </Alert>
        
        {/* Search Bar */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Søk i tidslinje (aktivitet, lokasjon, tidspunkt)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                  <Search sx={{ color: 'action.active' }} />
                </Box>
              ),
              endAdornment: searchQuery && (
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <Close />
                </IconButton>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'rgba(102, 126, 234, 0.04)'
              }
            }}
          />
        </Box>

        {filteredEvents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              {searchQuery ? 'Ingen resultater funnet' : 'Ingen personer registrert ennå'}
            </Typography>
            {searchQuery && (
              <Button onClick={() => setSearchQuery('')} sx={{ mt: 2 }}>
                Tøm søk
              </Button>
            )}
          </Box>
        ) : (
          filteredEvents
            .sort((a: TimelineEvent, b: TimelineEvent) => a.sortOrder - b.sortOrder)
            .map((event: TimelineEvent, index: number) => (
              <MuiCard
                key={event.id || event.eventId || `event-${index}`}
                sx={{
                  mb: 2,
                  bgcolor: '#fafafa',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 2
                    }}
                  >
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#667eea' }}>
                        {event.time} - {event.activity}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {event.location && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocationOn sx={{ fontSize: 16 }} />
                            {event.location}
                          </Box>
                        )}
                        <Chip key="creator" label={event.creatorType} size="small" sx={{ ml: 1, height: 2 }} />
                        {event.hasPhoto && (
                          <Chip key="photo" icon={<FeatherCamera size={14} />} label="Foto" size="small" sx={{ ml: 0.5, height: 20 }} />
                        )}
                        {event.hasVideo && (
                          <Chip key="video" icon={<FeatherVideo size={14} />} label="Video" size="small" sx={{ ml: 0.5, height: 20 }} />
                        )}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title="Rediger event">
                        <IconButton
                          size="small"
                          onClick={() => handleEditEvent(event)}
                          sx={{ color: '#667eea' }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser event">
                        <IconButton
                          size="small"
                          onClick={() => handleDuplicateEvent(event)}
                          sx={{ color: '#667eea' }}
                        >
                          <FileCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett event">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteEvent(event.id || event.eventId)}
                          sx={{ color: 'error.main' }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
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
                                      key={`role-${idx}`}
                                      label={person.role}
                                      size="small"
                                      variant="outlined"
                                      sx={{ height:  20, fontSize: '0.7rem'}}
                                    />
                                    <Chip
                                      key={`priority-${idx}`}
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
                                        key={`vip-${idx}`}
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
    <MuiCard
      sx={{
        mb: 3,
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.15)'
      }}
    >
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 3,
          color: 'white'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Schedule sx={{ fontSize: 28 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Tidsplan & Aktiviteter
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          Komplett kjøreplan{timeline?.coupleName ? ` for ${timeline.coupleName} sitt bryllup` : ''}. 
          Alle tider er fastsatt og koordinert med venue og leverandører{culturalLabel}.
        </Typography>
      </Box>
      <CardContent sx={{ p: 3 }}>
        {filteredEvents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              {searchQuery ? 'Ingen resultater funnet' : 'Ingen aktiviteter planlagt ennå'}
            </Typography>
          </Box>
        ) : (
          filteredEvents
            .sort((a: TimelineEvent, b: TimelineEvent) => a.sortOrder - b.sortOrder)
            .map((event: TimelineEvent, index: number) => (
              <MuiCard
                key={event.id || event.eventId || `timeline-${index}`}
                sx={{
                  mb: 2,
                  bgcolor: '#fafafa',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start'
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#667eea' }}>
                        {event.time}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
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
                          key="sortOrder"
                          label={`#${event.sortOrder}`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20 }}
                        />
                        <Chip
                          key="creatorType"
                          label={event.creatorType}
                          size="small"
                          sx={{ height: 20, bgcolor: '#667eea', color: 'white' }}
                        />
                        {event.hasPhoto && (
                          <Chip key="photo" icon={<FeatherCamera size={14} />} label="Foto" size="small" color="primary" sx={{ height: 20 }} />
                        )}
                        {event.hasVideo && (
                          <Chip key="video" icon={<FeatherVideo size={14} />} label="Video" size="small" color="secondary" sx={{ height: 20 }} />
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
                      <Tooltip title="Rediger">
                        <IconButton
                          size="small"
                          onClick={() => handleEditEvent(event)}
                          sx={{ color: '#667eea' }}
                        >
                          <FeatherEdit size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser">
                        <IconButton
                          size="small"
                          onClick={() => handleDuplicateEvent(event)}
                          sx={{ color: '#667eea' }}
                        >
                          <FeatherCopy size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteEvent(event.id || event.eventId)}
                          sx={{ color: 'error.main' }}
                        >
                          <FeatherTrash size={16} />
                        </IconButton>
                      </Tooltip>
                      <Box sx={{ ml: 1 }}>
                        {event.notifications_sent ? (
                          <CheckCircle sx={{ color: 'green', fontSize: 20 }} />
                        ) : (
                          <Warning sx={{ color: 'orange', fontSize: 20 }} />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </MuiCard>
            ))
        )}
      </CardContent>
    </MuiCard>
  );

  const renderCommunication = () => (
    <MuiCard
      sx={{
        mb: 3,
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.15)'
      }}
    >
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 3,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Chat sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              Kommunikasjon & Varsling
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              VIP-prioritering aktiv - Kritiske kontakter varsles først
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<VolumeUp />}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.25)',
            color: 'white',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.35)'
            }
          }}
          onClick={() => console.log('Send massevarsling - TODO: Implement')}
        >
          Send massevarsling
        </Button>
      </Box>
      <CardContent sx={{ p: 3 }}>
        {filteredEvents
          .filter((event: TimelineEvent) => event.persons_involved && event.persons_involved.length > 0)
          .length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              {searchQuery ? 'Ingen resultater funnet' : 'Ingen aktiviteter med personer ennå'}
            </Typography>
          </Box>
        ) : (
          filteredEvents
            .filter((event: TimelineEvent) => event.persons_involved && event.persons_involved.length > 0)
            .sort((a: TimelineEvent, b: TimelineEvent) => a.sortOrder - b.sortOrder)
            .map((event: TimelineEvent, index: number) => (
              <MuiCard
                key={event.id || event.eventId || `communication-${index}`}
                sx={{
                  mb: 2,
                  bgcolor: '#fafafa',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 2
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={600}>
                      {event.time} - {event.activity}
                    </Typography>
                    <Box>
                      {event.notifications_sent ? (
                        <Chip
                          label="Varslet"
                          color="success"
                          size="small"
                          icon={<CheckCircle />}
                        />
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<VolumeUp />}
                          sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)'
                            }
                          }}
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
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
                                <Avatar sx={{ bgcolor: '#667eea', fontSize: '0.8rem' }}>
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
            ))
        )}
      </CardContent>
    </MuiCard>
  );

  const renderPositioning = () => (
    <MuiCard
      sx={{
        mb: 3,
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.15)'
      }}
    >
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 3,
          color: 'white'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Lightbulb sx={{ fontSize: 28 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Posisjonering & Utstyr
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          Strategisk posisjonering for optimal foto/video-dekning. Koordinert med venue og andre
          leverandører.
        </Typography>
      </Box>
      <CardContent sx={{ p: 3 }}>
        {filteredEvents
          .filter((event: TimelineEvent) => event.hasPhoto || event.hasVideo)
          .length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              {searchQuery ? 'Ingen resultater funnet' : 'Ingen foto/video-aktiviteter ennå'}
            </Typography>
          </Box>
        ) : (
          filteredEvents
            .filter((event: TimelineEvent) => event.hasPhoto || event.hasVideo)
            .sort((a: TimelineEvent, b: TimelineEvent) => a.sortOrder - b.sortOrder)
            .map((event: TimelineEvent, index: number) => (
              <MuiCard
                key={event.id || event.eventId || `positioning-${index}`}
                sx={{
                  mb: 2,
                  bgcolor: '#fafafa',
                  borderRadius: 2,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: '#667eea' }}>
                    {event.time} - {event.activity}
                </Typography>
<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                    <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {event.location}
                    </Typography>
                  </Box>

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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <PhotoCamera sx={{ fontSize: 18, color: '#1976d2' }} />
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600, color: '#1976d2' }}
                        >
                          Fotografi
                        </Typography>
                      </Box>
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <Videocam sx={{ fontSize: 18, color: '#9c27b0' }} />
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600, color: '#9c27b0' }}
                        >
                          Videografi
                        </Typography>
                      </Box>
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
            ))
        )}
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
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)'
            }
          }}
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
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        py: 4
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2 }}>
        {/* Project Integration Alert */}
        {projectIntegration?.weddingTimelineIntegrated && (
          <Alert
            severity="success"
            sx={{
              mb: 3,
              bgcolor: 'rgba(6, 175, 80, 0.1)',
              border: '1px solid rgba(6, 175, 80, 0.3)'}}
          >
            Bryllupstidslinje er nå koblet til ditt prosjekt! Kulturell type: {', '}
            {projectIntegration.culturalType || culturalType}
          </Alert>
        )}

        {/* Viktig informasjon fra {professionLabel} */}
        <MuiCard
          sx={{
            mb: 3,
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(33, 150, 243, 0.15)'
          }}
        >
          <Box
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              p: 3,
              color: 'white'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <CameraAlt sx={{ fontSize: 28 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Viktig informasjon fra {professionLabel}
              </Typography>
            </Box>
            <Typography variant="body1" sx={{ mb: 1, opacity: 0.95 }}>
              Kære {timeline?.coupleName || 'brudeparet'},
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Her er viktig informasjon for bryllupsdagen. Vi vil oppdatere dere fortløpende hvis
              det skjer endringer i tidsplanen.
            </Typography>
          </Box>
          <CardContent sx={{ p: 3 }}>

            {/* Aktuelle meldinger fra {professionLabel} - Real-time updates */}
            <Box
              sx={{
                bgcolor: 'rgba(33, 150, 243, 0.08)',
                p: 2,
                borderRadius: 2,
                border: '1px solid rgba(33, 150, 243, 0.2)',
                mb: 2
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#1976d2' }}>
                📢 Siste oppdatering:
              </Typography>
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
                bgcolor: 'rgba(255, 193, 7, 0.08)',
                p: 2,
                borderRadius: 2,
                border: '1px solid rgba(255, 193, 7, 0.3)'
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#f57c00' }}>
                🌤️ Værvarsel og praktisk info:
              </Typography>
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
        <MuiCard
          sx={{
            mb: 3,
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Box
            sx={{
              background: '#ffffff',
              p: 4,
              textAlign: 'center',
              color: '#333'
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <Box
                component="img"
                src="/Brideandgroom.png"
                alt="Bride & Groom"
                sx={{ width: 120, height: 120 }}
              />
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#667eea' }}>
                {timeline?.coupleName || 'Bryllup'} {new Date(timeline?.weddingDate || Date.now()).getFullYear()}{culturalLabel}
              </Typography>
            </Box>
            <Typography variant="h6" sx={{ mb: 3, color: '#666' }}>
              {timeline?.venue || 'Bryllupslokasjon'}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 2,
                flexWrap: 'wrap'
              }}
            >
              <Chip
                key="activities"
                label={`${events.length} aktiviteter`}
                icon={<FeatherClock size={16} color="white" />}
                sx={{
                  bgcolor: '#667eea',
                  color: 'white',
                  fontWeight: 600,
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
              <Chip
                key="vip"
                label="VIP-system aktivt"
                icon={<FeatherStar size={16} color="#333" />}
                sx={{
                  bgcolor: '#ffc107',
                  color: '#333',
                  fontWeight: 600,
                  '& .MuiChip-icon': { color: '#333' }
                }}
              />
              <Chip
                key="professional"
                label="Profesjonell fotografi"
                icon={<FeatherCamera size={16} color="white" />}
                sx={{
                  bgcolor: '#764ba2',
                  color: 'white',
                  fontWeight: 600,
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
              {projectIntegration?.weddingTimelineIntegrated && (
                <Chip
                  key="integrated"
                  label="Integrert med prosjekt"
                  icon={<FeatherSync size={16} color="white" />}
                  sx={{
                    bgcolor: '#4caf50',
                    color: 'white',
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: 'white' }
                  }}
                />
              )}
            </Box>
          </Box>
        </MuiCard>

        {/* Action Toolbar */}
        <MuiCard
          sx={{
            mb: 3,
            borderRadius: 3,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                variant="contained"
                startIcon={<FeatherPlus size={18} />}
                onClick={() => {
                  setSelectedEvent(null);
                  resetEventForm();
                  setEventDialogOpen(true);
                }}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)'
                  }
                }}
              >
                Nytt Event
              </Button>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Button
                variant="outlined"
                startIcon={<FeatherDownload size={18} />}
                onClick={handleExportPDF}
                sx={{
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': {
                    borderColor: '#5568d3',
                    bgcolor: 'rgba(102, 126, 234, 0.04)'
                  }
                }}
              >
                Eksporter PDF
              </Button>
              <Button
                variant="outlined"
                startIcon={<FeatherCalendar size={18} />}
                onClick={handleExportCalendar}
                sx={{
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': {
                    borderColor: '#5568d3',
                    bgcolor: 'rgba(102, 126, 234, 0.04)'
                  }
                }}
              >
                Kalender (.ics)
              </Button>
              <Button
                variant="outlined"
                startIcon={<FeatherPrinter size={18} />}
                onClick={handlePrint}
                sx={{
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': {
                    borderColor: '#5568d3',
                    bgcolor: 'rgba(102, 126, 234, 0.04)'
                  }
                }}
              >
                Skriv ut
              </Button>
              <Box sx={{ flexGrow: 1 }} />
              <Chip
                icon={<EventIcon />}
                label={`${filteredEvents.length} ${searchQuery ? 'av ' + events.length : ''} events`}
                sx={{
                  bgcolor: 'rgba(102, 126, 234, 0.1)',
                  color: '#667eea',
                  fontWeight: 600
                }}
              />
            </Box>
          </CardContent>
        </MuiCard>

        {/* Navigation Tabs */}
        <MuiCard
          sx={{
            mb: 3,
            borderRadius: 3,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}
        >
          <CardContent sx={{ py: 0 }}>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant="fullWidth"
              sx={{
                '& .MuiTab-root': {
                  color: 'rgba(0, 0, 0, 0.6)',
                  fontWeight: 600,
                  py: 2
                },
                '& .Mui-selected': {
                  color: '#667eea'
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#667eea',
                  height: 3
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
              transform: 'scale(1.1)',
              boxShadow: '0 12px 32px rgba(102, 126, 234, 0.5)'
            },
            transition: 'all 0.3s ease'
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
            bottom: 90,
            right: 20,
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            boxShadow: '0 8px 24px rgba(245, 87, 108, 0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #e082ea 0%, #e4465b 100%)',
              transform: 'scale(1.1)',
              boxShadow: '0 12px 32px rgba(245, 87, 108, 0.5)'
            },
            transition: 'all 0.3s ease'
          }}
          onClick={handleOpenEmailDialog}
          disabled={sendingEmail}
        >
          {sendingEmail ? <CircularProgress size={24} color="inherit" /> : <Email />}
        </Fab>

        {/* Add Person Dialog */}
        <AddPersonDialog />

        {/* Add/Edit Event Dialog */}
        <Dialog
          open={eventDialogOpen}
          onClose={() => {
            setEventDialogOpen(false);
            setSelectedEvent(null);
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}
          >
            {selectedEvent ? 'Rediger Event' : 'Legg til Nytt Event'}
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="Aktivitet *"
                value={newEvent.activity}
                onChange={(e) => setNewEvent({ ...newEvent, activity: e.target.value })}
                placeholder="F.eks. Vielse, Brudefotografering, Middag"
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Tidspunkt *"
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Sorteringsrekkefølge"
                  type="number"
                  value={newEvent.sortOrder}
                  onChange={(e) => setNewEvent({ ...newEvent, sortOrder: parseInt(e.target.value) })}
                  sx={{ width: 150 }}
                />
              </Box>
              <TextField
                fullWidth
                label="Lokasjon"
                value={newEvent.location}
                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                placeholder="Adresse eller stedsnavn"
              />
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={newEvent.creatorType}
                  label="Type"
                  onChange={(e) => setNewEvent({ ...newEvent, creatorType: e.target.value })}
                >
                  <MenuItem value="Fotograf">Fotograf</MenuItem>
                  <MenuItem value="Videograf">Videograf</MenuItem>
                  <MenuItem value="Begge">Fotograf & Videograf</MenuItem>
                  <MenuItem value="Annet">Annet</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={newEvent.hasPhoto}
                      onChange={(e) => setNewEvent({ ...newEvent, hasPhoto: e.target.checked })}
                    />
                  }
                  label="Fotografering"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={newEvent.hasVideo}
                      onChange={(e) => setNewEvent({ ...newEvent, hasVideo: e.target.checked })}
                    />
                  }
                  label="Filming"
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setEventDialogOpen(false);
              setSelectedEvent(null);
            }}>
              Avbryt
            </Button>
            <Button
              variant="contained"
              onClick={handleAddEvent}
              disabled={!newEvent.activity || !newEvent.time}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)'
                }
              }}
            >
              {selectedEvent ? 'Oppdater' : 'Legg til'}
            </Button>
          </DialogActions>
        </Dialog>

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
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)'
                }
              }}
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
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
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
                sx={{
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': {
                    borderColor: '#5568d3',
                    bgcolor: 'rgba(102, 126, 234, 0.04)'
                  }
                }}
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
            <Button
              onClick={handleSendWeddingTimeline}
              variant="contained"
              disabled={!clientEmail || sendingEmail}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)'
                }
              }}
              startIcon={sendingEmail ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <Email />}
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

        {/* Delete Event Confirmation Dialog */}
        <Dialog open={deleteEventDialogOpen} onClose={() => setDeleteEventDialogOpen(false)}>
          <DialogTitle>Bekreft sletting</DialogTitle>
          <DialogContent>
            <Typography>
              Er du sikker på at du vil slette dette eventet? Denne handlingen kan ikke angres.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteEventDialogOpen(false)}>Avbryt</Button>
            <Button
              onClick={confirmDeleteEvent}
              color="error"
              variant="contained"
            >
              Slett
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </Box>
  );
}
