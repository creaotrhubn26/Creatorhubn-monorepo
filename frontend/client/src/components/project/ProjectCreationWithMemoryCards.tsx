// @ts-nocheck
/**
 * CreatorHub Norge - Project Creation with Memory Card Planning
 * Integrerer minneskortet planlegging direkte i prosjektopprettelsen
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { trackButtonClick, trackModalOpen } from '@/hooks/useActionTracker';
// Import dynamic profession system
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIconUtil from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import { WorkflowIntegrationService } from '@/services/WorkflowIntegrationService';
import { apiRequest } from '@/lib/queryClient';
import ShotListManager from '@/components/universal/misc/shot-list-manager';
import { getProjectTypeNextSteps, getProjectTypeInitialDescription } from '@/utils/project-worklog-helpers';
// New context imports
import { useProject } from '../../contexts/ProjectContext';
import type { ProjectData } from '../../contexts/ProjectContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useRealTime } from '../../contexts/RealTimeContext';
import type { RealTimeEvent } from '../../contexts/RealTimeContext';
// Comprehensive feature system integration
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import ScriptManager from '../davinci-resolve/ScriptManager';
import { useExternalData } from '../../services/ExternalDataService';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Switch,
  FormControlLabel,
  Checkbox,
  Radio,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Stack,
  Paper,
  Drawer,
  IconButton,
  Tooltip,
  Badge,
  Collapse,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import {
  PhotoCamera,
  Videocam,
  Event,
  Folder,
  Memory,
  CloudUpload,
  Check,
  Schedule,
  Assignment,
  Storage,
  LocationOn,
  People,
  Settings,
  PersonAdd,
  EventNote,
  Lightbulb,
  Save,
  Delete,
  AttachMoney,
  Refresh,
  ShoppingCart,
  Payment,
  DirectionsCar,
  Notes,
  Favorite,
  Portrait,
  Business,
  MusicNote,
  AccountBalance,
  Star,
  Movie,
  ShoppingBag,
  ExpandMore,
  Groups,
  Group,
  Church,
  Home,
  Public,
  Circle,
  History,
  Compare,
  Restore,
  Publish,
  Drafts,
  Visibility,
  VisibilityOff,
  ChevronLeft,
  ChevronRight,
  Timeline,
  CloudDone,
  AccessTime,
  Edit,
  CheckCircle,
  Warning,
  Info,
  MovieCreation,
  Close as CloseIcon,
  VideoLibrary,
  LibraryMusic,
  CameraAlt,
} from '@mui/icons-material';
import MemoryCardIcon from '../ui/MemoryCardIcon';
import MemoryCardSelector from '../memory-card/MemoryCardSelector';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';
import { useLeadImport } from '@/hooks/useLeadImport';
import ProjectHealthCheck from './ProjectHealthCheck';
import ProjectCollaborators from './ProjectCollaborators';
import CloudDestinationActivator from '@/components/storage/CloudDestinationActivator';
import ExternalEditingOption from '@/components/universal/editing-marketplace/ExternalEditingOption';
import CloudErasePanel from '@/components/storage/CloudErasePanel';
import DeliverFromArchiveDialog from '@/components/storage/DeliverFromArchiveDialog';
import OneDeskDownloadCard from '@/components/storage/OneDeskDownloadCard';
import { getCamerasByProfession, getLogFormatsByCamera, getCameraBrand } from '../../data/video-camera-database';
import { getPhotoCamerasByProfession, getPhotoCameraBrand } from '../../data/photo-camera-database';
import { MemoryCardRecommendationEngine, getMemoryCardTypesByProfession, formatCurrency } from '../../data/memory-card-database';
import EnhancedMemoryCardSelector from '../memory-card/EnhancedMemoryCardSelector';
import { useNavigate } from 'react-router-dom';
import type { ProjectToEditorData, EditorToProjectResult } from '../../utils/story-arc-project-integration';
import { useProjectTypes } from '@/hooks/useProjectTypes';
import AddProjectTypeDialog from './AddProjectTypeDialog';
import AddIcon from '@mui/icons-material/Add';

// Function to generate PIN code from project name
const generatePinFromProjectName = (projectName: string): string => {
  if (!projectName) return '';
  
  // Remove special characters and spaces, convert to lowercase
  const cleanName = projectName.toLowerCase().replace(/[^a-z0-9]/g, ',');
  
  // Safety check for empty clean name
  if (!cleanName || cleanName.length === 0) return '0000';
  
  // Create a simple hash from the project name
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    const char = cleanName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
}
  
  // Convert to positive number and create 4-digit PIN
  const pin = Math.abs(hash).toString().slice(-4).padStart(4, '0');
  return pin;
};

// Project types with Material UI icons and colors (matching landing page)
const PROJECT_TYPES = {
  wedding: { name: 'Bryllup', icon: Favorite, color: '#e91e63' },
  portrait: { name: 'Portrett', icon: PhotoCamera, color: '#2e7d32' },
  event: { name: 'Event', icon: Event, color: '#ff8c00' },
  commercial: { name: 'Kommersiell', icon: Business, color: '#ff8c00' },
  video: { name: 'Video', icon: VideoLibrary, color: '#1565c0' },
  music: { name: 'Musikk', icon: LibraryMusic, color: '#7b1fa2' },
  family: { name: 'Familie', icon: Group, color: '#00897b' },
  product: { name: 'Produkt', icon: ShoppingBag, color: '#ff8f00' }
};

// Project type categories for all project types - expandable and customizable
const PROJECT_TYPE_CATEGORIES = {
  wedding: {
    name: 'Bryllup',
    cultures: {
      norsk: {
        name: 'Norsk bryllup',
        typical_days: 1,
        day_names: ['Bryllupsdag'],
        description: 'Tradisjonelt norsk bryllup vanligvis én dag',
        icon: Event,
        color: '#E30617'
    },
      sikh: {
        name: 'Sikh bryllup',
        typical_days: 3,
        day_names: ['Chooda & Haldi','Sangeet','Anand Karaj & Reception'],
        description: 'Komplett Sikh bryllup med Chooda Haldi, Sangeet, Baraat, Anand Karaj og Langar',
        icon: AccountBalance,
        color: '#FF6B35'
    },
      indisk: {
        name: 'Indisk bryllup (Hindu)',
        typical_days: 4,
        day_names: ['Ganesh Puja & Haldi','Mehendi','Sangeet','Vielse & Reception'],
        description: 'Komplett Hindu bryllup med Ganesh Puja, Haldi, Mehendi, Sangeet, Saptapadi og Mangalsutra',
        icon: AccountBalance,
        color: '#FF9500'
    },
      pakistansk: {
        name: 'Pakistansk bryllup',
        typical_days: 3,
        day_names: ['Mehndi & Sangeet','Baraat & Nikkah','Walima resepsjon'],
        description: 'Komplett pakistansk bryllup med Mehndi, Baraat, Nikkah og Walima',
        icon: Home,
        color: '#00A651'
    },
      tyrkisk: {
        name: 'Tyrkisk bryllup',
        typical_days: 2,
        day_names: ['Kına Gecesi (Henna)','Düğün (Bryllup)'],
        description: 'Tradisjonell tyrkisk bryllupsfeiring',
        icon: Star,
        color: '#E30A17'
    },
      arabisk: {
        name: 'Arabisk bryllup',
        typical_days: 2,
        day_names: ['Nikah vielse','Zaffe & Walima'],
        description: 'Islamsk vielse med tradisjonell oppsett',
        icon: Home,
        color: '#007A3D'
    },
      somalisk: {
        name: 'Somalisk bryllup',
        typical_days: 2,
        day_names: ['Nikah seremoni','Aroos feiring'],
        description: 'Somaliske tradisjoner med kulturell musikk',
        icon: Star,
        color: '#4189DD'
    },
      etiopisk: {
        name: 'Etiopisk bryllup',
        typical_days: 2,
        day_names: ['Telosh seremoni','Kulturell resepsjon'],
        description: 'Etiopisk ortodoks tradisjon med kaffe-seremoni',
        icon: Church,
        color: '#FCDD09'
    },
      nigeriansk: {
        name: 'Nigeriansk bryllup',
        typical_days: 2,
        day_names: ['White Wedding','Traditional Wedding'],
        description: 'Kombinerer vestlige og tradisjonelle nigerianske ritualer',
        icon: Public,
        color: '#008751'
    },
      muslimsk: {
        name: 'Muslimsk bryllup',
        typical_days: 2,
        day_names: ['Mehendi kveld','Nikkah & Walima'],
        description: 'Islamsk bryllup med Mehndi, Nikkah kontrakt og Walima feiring',
        icon: Home,
        color: '#239F40'
    },
      libanesisk: {
        name: 'Libanesisk bryllup',
        typical_days: 2,
        day_names: ['Henna Party','Zaffe & Reception'],
        description: 'Libanesisk tradisjon med spektakulær Zaffe innmarsj og dabke dans',
        icon: Star,
        color: '#FF0000'
    },
      filipino: {
        name: 'Filipino bryllup',
        typical_days: 2,
        day_names: ['Despedida de Soltera','Wedding & Reception'],
        description: 'Filipino tradisjon med Pamamanhikan, Arras mynter og Veil/Cord seremoni',
        icon: Public,
        color: '#0038A8'
    },
      kinesisk: {
        name: 'Kinesisk bryllup',
        typical_days: 2,
        day_names: ['Tea Ceremony & Hair Combing','Door Games & Banquet'],
        description: 'Tradisjonell kinesisk vielse med te-seremoni, Door Games og Lion Dance',
        icon: Circle,
        color: '#DE2910'
    },
      koreansk: {
        name: 'Koreansk bryllup',
        typical_days: 1,
        day_names: ['Pyebaek & Wedding Hall'],
        description: 'Moderne koreansk vielse med tradisjonelle elementer',
        icon: Circle,
        color: '#003478'
    },
      thai: {
        name: 'Thai bryllup',
        typical_days: 1,
        day_names: ['Khan Maak & Rod Nam Sang'],
        description: 'Thai tradisjoner med vann-velsignelse',
        icon: AccountBalance,
        color: '#A51931'
    },
      iransk: {
        name: 'Iransk/Persisk bryllup',
        typical_days: 1,
        day_names: ['Aghd & Aroosi'],
        description: 'Persisk vielse med Sofreh-e Aghd',
        icon: Star,
        color: '#239F40'
    },
      annet: {
        name: 'Annet/Tilpasset arrangement',
        typical_days: 1,
        day_names: ['Tilpasset dag'],
        description: 'Fleksibel struktur for andre kulturer eller blandede tradisjoner',
        icon: Public,
        color: '#666666'
    }
  }
},
  event: {
    name: 'Event',
    defaultCategories: ['Innledning','Hovedprogram','Avslutning'],
    description: 'Konferanser, seminarer, festivaler og andre arrangementer'
},
  portrait: {
    name: 'Portrett',
    defaultCategories: ['Studio setup','Hovedfotografering','Kreative shots'],
    description: 'Individuell og familiefotografering'
},
  commercial: {
    name: 'Kommersiell',
    defaultCategories: ['Produktfoto','Miljøbilder','Team/Corporate'],
    description: 'Bedriftsfotografering og produktfoto'
},
  video: {
    name: 'Video',
    defaultCategories: ['Pre-production','Hovedinnspilling','B-roll'],
    description: 'Videoproduksjon og filming'
},
  music: {
    name: 'Musikk',
    defaultCategories: ['Opptak','Mixing','Mastering'],
    description: 'Musikkproduksjon og lydarbeid'
}
};

// For backward compatibility - extract wedding cultures
const WEDDING_CULTURES = PROJECT_TYPE_CATEGORIES.wedding.cultures;

// Cultural day explanations for dialog system
const CULTURAL_DAY_EXPLANATIONS: Record<string, Record<string, string>> = {
  sikh: {
    'Chooda & Haldi':'Chooda er en seremoni hvor bruden får røde armbånd og Haldi innebærer å smøre gurkemeie på brudeparet for renselse og velsignelser.','Sangeet':'En musikkfylt feiring med dans og sanger der familiene forbereder seg til bryllupet med glede og tradisjonelle opptredener.','Anand Karaj & Reception' : 'Anand Karaj er den hellige Sikh vielsesseremonien i Gurdwara, fulgt av resepsjon med mat og feiring.'
  },
  indisk: {
    'Ganesh Puja & Haldi':'Ganesh Puja ber om velsignelser fra Ganeshas for å fjerne hindringer og Haldi påføres brudeparet for å rense og beskytte.','Mehendi':'Kunstferdig hennamaling påføres brudens hender og føtter i komplekse mønstre som symboliserer glede, åndelig oppvåkning og tilbud.','Sangeet':'En livlig feiring med tradisjonelle sanger, dans og musikk der begge familier deltar i opptredener og konkurranser.','Vielse & Reception' : 'Den hellige Hindu vielsesseremonien med Saptapadi (syv skritt) og Mangalsutra, fulgt av festmiddag og tradisjonelle ritualer.'
  },
  pakistansk: {
    'Mehndi & Sangeet':'Mehndi feiring hvor bruden får henna påført mens familie og venner synger tradisjonelle pakistanske bryllupssanger med tradisjonell musikk og dans.','Baraat & Nikkah':'Baraat er brudgommens entre til bryllupet, og Nikkah er den religiøse islamske vielsesseremonien med signering av nikah-kontrakt.','Walima resepsjon' : 'Walima er den tradisjonelle resepsjonen arrangert av brudgommens familie for å feire det nye ekteskapet med mat og glede.'
  },
  tyrkisk: {
    'Kına Gecesi (Henna)':'En tradisjonsrik kveld hvor bruden får henna påført hendene mens kvinnelige gjester synger sorgtunge sanger om å forlate barndomshjemmet.','Düğün (Bryllup)' : 'Den offisielle bryllupsdagen med sivil eller religiøs seremoni, fulgt av stor feiring med tradisjonell tyrkisk mat, musikk og dans.'
  },
  arabisk: {
    'Nikah vielse':'Den islamske vielsesseremonien hvor nikah-kontrakten signeres i nærvær av vitner og familie, ofte fulgt av duaa og bønner.','Zaffe & Walima' : 'Zaffe er en spektakulær prosesjon med musikk og dans som leder brudeparet til festen, fulgt av Walima resepsjon.'
  },
  somalisk: {
    'Nikah seremoni':'Den religiøse islamske vielsen med recitasjon av Koranen, nikah-kontrakt og duaa i nærvær av familie og samfunn.','Aroos feiring' : 'Tradisjonell somalisk bryllupsfeiring med autentisk mat, kulturdans, poesi og musikk som feirer det nye ekteskapet.'
  },
  etiopisk: {
    'Telosh seremoni':'En tradisjonell etiopisk førbryllups-seremoni med velsignelser, bønner og familiesamling før den offisielle vielsen.','Kulturell resepsjon' : 'Storslått feiring med tradisjonell etiopisk kaffe-seremoni, injera mat, kulturell musikk og dans som feirer den nye familien.'
  },
  nigeriansk: {
    'White Wedding':'Vestlig-stil bryllup i kirke eller seremoni-lokale med hvit kjole og tradisjonelle europeiske bryllupstradisjoner.','Traditional Wedding' : 'Autentisk nigeriansk kulturell seremoni med tradisjonelle klær, ritualer, maten og musikk spesifikk for familiens stamme eller region.'
  },
  muslimsk: {
    'Mehendi kveld':'En intim feiring hvor bruden og kvinnelige gjester får henna påført i vakre mønstre mens de synger tradisjonelle sanger.','Nikkah & Walima' : 'Nikkah er den offisielle islamske vielsesseremonien med kontraktsignering, fulgt av Walima resepsjon for å feire ekteskapet.'
  },
  libanesisk: {
    'Henna Party':'En livlig feiring hvor bruden får henna påført av eldre kvinnelige slektninger mens gjester deltar i tradisjonell libanesisk musikk.','Zaffe & Reception' : 'Spektakulær Zaffe innmarsj med trommer og ululating, fulgt av resepsjon med autentisk libanesisk mat og tradisjonell dabke dans.'
  }
};

// Cultural day worklog tips and suggestions
const CULTURAL_DAY_WORKLOG_TIPS: Record<string, Record<string, {
  tasks: string[];
  considerations: string[];
  timeManagement: string;
  keyContacts: string[];
  equipment: string[];
}>> = {
  sikh: {
    'Chooda & Haldi': {
      tasks: [
        "Møte med familiene for å diskutere tidsplan","Undersøke ceremoni-lokalet og lysforhold","Planlegge foto-øyeblikk for Chooda-seremonien","Koordinere med andre fotografer/videografer","Sjekke tradisjonelle klær og farger for bedre bildekvalitet"
      ],
      considerations: [
        "Haldi kan gjøre klær gule - planlegg utstyr deretter","Respekter hellige øyeblikk - ikke all fotografering er tillatt","Kvinner og menn kan ha separate seremonier","Røde Chooda-armbånd er meget viktige - få nærbilder","Familietradisjoner kan variere - spør alltid først"
      ],
      timeManagement: "Start tidlig på dagen, ceremoni kan ta 3-4 timer",
      keyContacts: ["Brudgens familie","Religiøs leder","Event coordinator"],
      equipment: ["85mm linse for portretter","Rask autofokus for bevegelse","Backup minnekort"]
    },
    'Sangeet': {
      tasks: [
        "Planlegge bevegelige kameraposisjoner for dans","Teste lydnivå for video-opptak","Koordinere med DJ/musikere","Identifisere VIP-gjester som må fotograferes","Planlegge gruppefoto-øyeblikk"
      ],
      considerations: [
        "Sangeet er en gledesfull begivenhet - fang energien","Dans og musikk - høy ISO og fast lukkertid nødvendig","Fargerike outfits - juster hvitbalanse","Begge familier deltar - få balansert dekning","Kan være sent på kvelden - planlegg belysning"
      ],
      timeManagement: "Lang kveld, 6-8 timer med pauser",
      keyContacts: ["Event planner","DJ/musikere","Begge familier"],
      equipment: ["70-200mm for scenefoto","Flash for indoors","Ekstra batterier"]
    },
    'Anand Karaj & Reception': {
      tasks: [
        "Lære Sikh vielsesritualer på forhånd","Planlegge diskret fotografering i Gurdwara","Koordinere med Granthi (religiøs leder)","Identifisere Saptapadi (syv skritt) øyeblikk","Planlegge resepsjons-fotografering"
      ],
      considerations: [
        "Sko må av i Gurdwara - planlegg utstyr transport","Hellig sted - vær meget respektfull","Fire runder rundt Guru Granth Sahib er viktige","Langar (gratis måltid) er tradisjon","Kirpan (seremonieschwert) er hellig gjenstand"
      ],
      timeManagement: "Vielse 2-3 timer, resepsjon 4-5 timer",
      keyContacts: ["Granthi","Gurdwara komité","Begge familier"],
      equipment: ["24-70mm zoom","Silent shooting mode","Respektfulle klær"]
  }
},
  indisk: {
    'Ganesh Puja & Haldi': {
      tasks: [
        "Lære om Ganesh Puja ritualer på forhånd","Planlegge ceremonifotografering uten å forstyrre","Undersøke tradisjonelle elementer å fokusere på","Koordinere med prest/religiøs leder","Planlegge familiegruppefoto etter seremoni"
      ],
      considerations: [
        "Ganesh Puja er hellig - vær respektfull og diskret","Haldi-pasta gjør alt gult - beskytt utstyr","Mange ritualer krever stillhet","Blomster og offerings er viktige detaljer","Eldre familiemedlemmer kan ha spesielle roller"
      ],
      timeManagement: "Hellig seremoni 2-3 timer, deretter Haldi 1-2 timer",
      keyContacts: ["Hindu prest","Brudens familie","Brudgommens familie"],
      equipment: ["50mm for intimitet","Makro linse for detaljer","Stille kamera-modus"]
  }
},
  pakistansk: {
    'Mehndi & Sangeet': {
      tasks: [
        "Planlegge hennamaling close-up fotografering","Koordinere med henna-artisten","Identifisere familiesanger som skal fanges","Planlegge gruppefoto av kvinnelige gjester","Teste fargebalanse for gul/orange belysning"
      ],
      considerations: [
        "Mehndi er ofte kun for kvinner - mann-fotograf kan ha begrenset tilgang","Intrikate henna-mønstre krever makro-fotografering","Tradisjonelle pakistanske sanger - ta lydopptak","Sari og lehenga har vakre detaljer","Kan være formiddags eller kveld - sjekk tidsplan"
      ],
      timeManagement: "Mehndi 3-4 timer, musikk og dans 2-3 timer",
      keyContacts: ["Henna artist","Brudens søstre/kusiner","Musikere"],
      equipment: ["Macro linse 100mm","Ring light for henna","Audio recorder"]
  }
}
};

// Project phases for worklog organization
const PROJECT_PHASES: Record<string, { name: string; description: string; color: string; categories: string[] }> = {
  pre_production: {
    name: 'Pre-production',
    description: 'Planlegging, research, møter, forberedelser',
    color: '#2196f3',
    categories: ['planning','client_meeting','cultural_research','equipment_prep','location_scouting']
  },
  production: {
    name: 'Production',
    description: 'Selve fotografering, filming, opptak',
    color: '#4caf50',
    categories: ['shooting','filming','recording','directing','on_set_coordination']
  },
  post_production: {
    name: 'Post-production',
    description: 'Redigering, fargekorrigering, levering',
    color: '#ff9800',
    categories: ['editing','color_grading','sound_design','delivery','client_review']
  },
  business: {
    name: 'Business',
    description: 'Fakturering, markedsføring, oppfølging',
    color: '#9c27b0',
    categories: ['invoicing','marketing','client_follow_up','portfolio_update','social_media']
  }
};

// Dynamic Phase-Specific Worklog Templates - Comprehensive template system
interface WorklogTemplate {
  title: string;
  description: string;
  timeEstimate: number;
  checklistItems: string[];
}
const DYNAMIC_WORKLOG_TEMPLATES: Record<string, Record<string, Record<string, WorklogTemplate>>> = {
  photographer: {
    pre_production: {
      planning: {
        title: "Prosjektplanlegging og research",
        description: "Detaljert planlegging av, fotograferingsoppdraget:\n\n• Gjennomgå kundens ønsker og forventninger\n• Research lokasjon og lysforhold\n• Planlegge utstyrsliste basert på prosjekttype\n• Koordinere med andre leverandører",
        timeEstimate: 3,
        checklistItems: ["Kundemøte gjennomført","Lokasjon bekreftet","Utstyr sjekket","Backup-plan etablert"]
    },
      client_meeting: {
        title: "Kundemøte og briefing",
        description: "Møte med kunde for å avklare, detaljer:\n\n• Gjennomgå ønskeliste og forventninger\n• Diskutere tidsplan og logistikk\n• Avklare leveringsformat og tidsfrist\n• Signere kontrakt og bekrefte booking",
        timeEstimate: 2,
        checklistItems: ["Kontrakt signert","Ønskeliste dokumentert","Tidsplan bekreftet","Betalingsbetingelser avklart"]
    },
      cultural_research: {
        title: "Kulturell research og forberedelser",
        description: "Research av kulturelle elementer og, tradisjoner:\n\n• Studere kulturspesifikke øyeblikk som må fanges\n• Koordinere med kulturelle rådgivere\n• Planlegge teknisk tilnærming for spesielle seremonier\n• Forberede respektfull tilnærming til hellige øyeblikk",
        timeEstimate: 2,
        checklistItems: ["Kulturelle tradisjoner research","Viktige øyeblikk identifisert","Respektfull tilnærming planlagt","Kommunikasjon med familie avklart"]
    }
  },
    production: {
      shooting: {
        title: "Hovedfotografering",
        description: "Utførelse av, fotograferingsoppdraget:\n\n• Ankomst og rigge utstyr\n• Fange planlagte øyeblikk og spontane situasjoner\n• Overvåke teknisk kvalitet kontinuerlig\n• Koordinere med andre leverandører på stedet",
        timeEstimate: 8,
        checklistItems: ["Utstyr rigget","Test-bilder tatt","Backup-system aktivt","Kommunikasjon med koordinator etablert"]
    },
      directing: {
        title: "Regi og koordinering",
        description: "Dirigere og koordinere fotograferingsøkten:\n\n• Lede posisjoner og gruppering\n• Koordinere med andre fotografer\n• Sikre at alle viktige øyeblikk fanges\n• Opprettholde energi og positiv stemning",
        timeEstimate: 4,
        checklistItems: ["Posisjoner planlagt","Gruppefoto koordinert","Candid moments fanget","Alle viktige personer inkludert"]
    }
  },
    post_production: {
      editing: {
        title: "Bilderedigering og seleksjon",
        description: "Redigering og finpuss av, bilder:\n\n• Selektere beste bilder fra dagens fotografering\n• Utføre fargekorrigering og teknisk optimalisering\n• Retusjering og kreativ bearbeiding\n• Forberede bilder for levering",
        timeEstimate: 12,
        checklistItems: ["Seleksjon gjennomført","Fargekorrigering utført","Retusjering fullført","Leveringsformat forberedt"]
    },
      client_review: {
        title: "Kundegodkjenning og revisjoner",
        description: "Presentasjon for kunde og eventuelle, justeringer:\n\n• Presentere utvalgte og redigerte bilder\n• Motta feedback og ønsker om justeringer\n• Utføre nødvendige revisjoner\n• Finalisere bildeutvalg for leveranse",
        timeEstimate: 3,
        checklistItems: ["Bilder presentert","Feedback mottatt","Revisjoner utført","Final godkjenning mottatt"]
    }
  },
    business: {
      invoicing: {
        title: "Fakturering og oppgjør",
        description: "Håndtering av betaling og, dokumentasjon:\n\n• Sende faktura basert på avtalt pris\n• Følge opp betaling\n• Arkivere kontrakt og dokumentasjon\n• Oppdatere økonomisystem",
        timeEstimate: 1,
        checklistItems: ["Faktura sendt","Betaling mottatt","Dokumentasjon arkivert","Regnskap oppdatert"]
    },
      portfolio_update: {
        title: "Portefølje og markedsføring",
        description: "Oppdatering av portefølje og, markedsmateriell:\n\n• Velge beste bilder for portefølje\n• Oppdatere hjemmeside med nye arbeider\n• Publisere på sosiale medier (med tillatelse)\n• Be om anbefalinger fra fornøyde kunder",
        timeEstimate: 2,
        checklistItems: ["Porteføljebilder valgt","Hjemmeside oppdatert","Sosiale medier oppdatert","Kundeanbefalinger mottatt"]
    }
  }
},
  music_producer: {
    pre_production: {
      planning: {
        title: "Prosjektplanlegging og konsept",
        description: "Detaljert planlegging av musikk-produksjonsprosjektet:\n\n• Definere kunstnerisk visjon og sjanger\n• Planlegge studiobooking og budsjett\n• Koordinere med musikere og sangere\n• Forberede teknisk setup og lyddesign",
        timeEstimate: 4,
        checklistItems: ["Kunstnerisk konsept definert","Studiobooking bekreftet","Musikere koordinert","Teknisk plan etablert"]
    },
      client_meeting: {
        title: "Kunstnermøte og kreativ briefing",
        description: "Møte med artist for å avklare kreative, retning:\n\n• Diskutere kunstnerisk visjon og målgruppe\n• Gjennomgå referanser og inspirasjon\n• Planlegge innspillingsplan og deadlines\n• Avklare roller og ansvar i produksjonen",
        timeEstimate: 2,
        checklistItems: ["Kreativ retning avklart","Referanser gjennomgått","Tidsplan bekreftet","Roller definert"]
    },
      equipment_prep: {
        title: "Studioforberedelse og utstyrsjekk",
        description: "Forberedelse av studio og teknisk, utstyr:\n\n• Kalibrere monitorer og akustikk\n• Teste mikrofoner og forforsterkere\n• Forberede software og plugins\n• Sette opp multispor og routing",
        timeEstimate: 3,
        checklistItems: ["Studio kalibrert","Utstyr testet","Software forberedt","Routing etablert"]
    }
  },
    production: {
      recording: {
        title: "Innspilling og opptak",
        description: "Hovedinnspillingssesjon i, studio:\n\n• Sette opp mikrofoner og instrumenter\n• Ta opp basisspor (trommer, bass, rytmegitar)\n• Spille inn hovedvokal og harmonier\n• Fange spontane ideer og alternativer",
        timeEstimate: 10,
        checklistItems: ["Setup fullført","Basisspor innspilt","Vokal innspilt","Alternativer dokumentert"]
    },
      directing: {
        title: "Produksjonsregi og kunstnerisk ledelse",
        description: "Lede den kreative prosessen under, innspilling:\n\n• Veilede artistens prestasjon\n• Foreslå arrangementsideer\n• Koordinere mellom musikerne\n• Sikre høy kunstnerisk kvalitet",
        timeEstimate: 6,
        checklistItems: ["Artistisk ledelse utført","Arrangement optimalisert","Musikerkoordinering fullført","Kvalitetskontroll utført"]
    },
      on_set_coordination: {
        title: "Studiokokordinering og kommunikasjon",
        description: "Koordinere alle aspekter av studiomiljøet:\n\n• Opprettholde kreativ atmosfære\n• Koordinere pauser og måltider\n• Dokumentere kreative beslutninger\n• Administrere studiets tidsplan",
        timeEstimate: 4,
        checklistItems: ["Atmosfære opprettholdt","Pauser koordinert","Beslutninger dokumentert","Tidsplan overholdt"]
    }
  },
    post_production: {
      editing: {
        title: "Lydmiksing og bearbeiding",
        description: "Detaljert miksing av innspilt, materiale:\n\n• Redigere og rense opptak\n• Balansere nivåer og panorering\n• Tillegge effekter og processing\n• Skape dynamisk og engasjerende lydbilde",
        timeEstimate: 15,
        checklistItems: ["Opptak redigert","Nivåer balansert","Effekter tillagt","Lydbilde optimalisert"]
    },
      sound_design: {
        title: "Lyddesign og kreativ bearbeiding",
        description: "Kreativ utvikling av lydens, karakter:\n\n• Design av unike lyder og teksturer\n• Eksperimentere med kreative effekter\n• Utvikle signaturlyd for prosjektet\n• Tillegge atmosfære og stemning",
        timeEstimate: 8,
        checklistItems: ["Lyddesign utført","Kreative effekter tillagt","Signaturlyd utviklet","Atmosfære skapt"]
    },
      client_review: {
        title: "Artistgodkjenning og revisjoner",
        description: "Presentasjon av miks for artist og, justeringer:\n\n• Presentere foreløpig miks for feedback\n• Motta kunstneriske ønsker og justeringer\n• Implementere endringer og refinere\n• Finalisere miks før mastering",
        timeEstimate: 4,
        checklistItems: ["Miks presentert","Feedback implementert","Justeringer utført","Final miks godkjent"]
    }
  },
    business: {
      invoicing: {
        title: "Fakturering og TONO/GRAMO registrering",
        description: "Håndtering av betaling og musikk-rettigheter:\n\n• Sende faktura til artist eller plateselskap\n• Registrere verk i TONO for komponist-rettigheter\n• Registrere innspilling i GRAMO for utøver-rettigheter\n• Dokumentere produsentandeler og kontrakter",
        timeEstimate: 2,
        checklistItems: ["Faktura sendt","TONO registrering utført","GRAMO registrering utført","Kontrakter arkivert"]
    },
      marketing: {
        title: "Promotering og markedsføring",
        description: "Markedsføring av produksjon og produsent-profil:\n\n• Lage produksjon-credits og press-kit\n• Publisere på streaming-tjenester med credits\n• Dele prosess-innhold på sosiale medier\n• Bygge produsent-merkenavn og referanser",
        timeEstimate: 3,
        checklistItems: ["Credits dokumentert","Streaming publisert","Sosiale medier oppdatert","Referanser sikret"]
    },
      client_follow_up: {
        title: "Oppfølging og framtidige prosjekter",
        description: "Opprettholde forhold og sikre framtidige, samarbeid:\n\n• Følge opp artistens tilfredshet\n• Diskutere framtidige prosjekter\n• Be om anbefalinger til andre artister\n• Opprettholde profesjonelt nettverk",
        timeEstimate: 1,
        checklistItems: ["Tilfredshet bekreftet","Framtidige prosjekter diskutert","Anbefalinger mottatt","Nettverk utviklet"]
    }
  }
},
  videographer: {
    pre_production: {
      planning: {
        title: "Produksjonsplanlegging og konsept",
        description: "Omfattende planlegging av, videoproduksjonen:\n\n• Utvikle kreativt konsept og narrative struktur\n• Planlegge shot list og filming schedule\n• Koordinere crew og utstyr\n• Rekognosere lokasjoner og planlegge logistikk",
        timeEstimate: 5,
        checklistItems: ["Konsept utviklet","Shot list planlagt","Crew koordinert","Lokasjoner rekognoscert"]
    },
      client_meeting: {
        title: "Klientbriefing og kreativ workshop",
        description: "Detaljert møte for å definere prosjektets, retning:\n\n• Gjennomgå kundens visjon og målsetting\n• Diskutere target audience og distribusjon\n• Planlegge timeline og leverables\n• Etablere kommunikasjonsrutiner under produksjonen",
        timeEstimate: 2,
        checklistItems: ["Visjon definert","Målgruppe identifisert","Timeline etablert","Kommunikasjon planlagt"]
    },
      location_scouting: {
        title: "Lokasjonsscouting og teknisk planlegging",
        description: "Utforskning og evaluering av, filmingsteder:\n\n• Besøke potensielle lokasjoner\n• Vurdere lysforhold og akustikk\n• Planlegge kameraplasseringer og bevegelser\n• Koordinere tillatelser og logistikk",
        timeEstimate: 4,
        checklistItems: ["Lokasjoner evaluert","Lysforhold kartlagt","Kameraplasseringer planlagt","Tillatelser sikret"]
    }
  },
    production: {
      filming: {
        title: "Hovedfilming og regi",
        description: "Gjennomføring av, videoinnspilingen:\n\n• Rigge utstyr og etablere setup\n• Filme planlagte sekvenser og cutaways\n• Dirigere talent og koordinere crew\n• Sikre teknisk kvalitet og kontinuitet",
        timeEstimate: 12,
        checklistItems: ["Utstyr rigget","Sekvenser filmet","Talent dirigert","Kvalitet sikret"]
    },
      directing: {
        title: "Kreativ ledelse og artistisk regi",
        description: "Lede den kreative prosessen på, settet:\n\n• Kommunisere visjonen til crew og talent\n• Ta kreative beslutninger i sanntid\n• Sikre narrativ kontinuitet\n• Opprettholde energi og fokus på settet",
        timeEstimate: 8,
        checklistItems: ["Visjon kommunisert","Kreative beslutninger tatt","Kontinuitet sikret","Set-energi opprettholdt"]
    },
      on_set_coordination: {
        title: "Set-koordinering og produksjonsledelse",
        description: "Administrere alle aspekter av, produksjonen:\n\n• Koordinere crew og utstyr\n• Overvåke tidsskjema og budsjett\n• Løse tekniske og logistiske utfordringer\n• Dokumentere produksjonsbeslutninger",
        timeEstimate: 6,
        checklistItems: ["Crew koordinert","Tidsplan overholdt","Utfordringer løst","Beslutninger dokumentert"]
    }
  },
    post_production: {
      editing: {
        title: "Videoredigering og postproduksjon",
        description: "Sammensetting og finpuss av, videomateriale:\n\n• Importere og organisere opptak\n• Utføre rough cut og fine cut\n• Tillegge overganger og effekter\n• Optimalisere pacing og narrativ flyt",
        timeEstimate: 20,
        checklistItems: ["Materiale organisert","Cuts utført","Effekter tillagt","Pacing optimalisert"]
    },
      color_grading: {
        title: "Fargekorrigering og grading",
        description: "Kreativ fargejustering og visuell, stemning:\n\n• Korrigere eksponering og hvitbalanse\n• Skape konsistent look gjennom prosjektet\n• Tillegge kreativ fargepalett\n• Optimalisere for forskjellige plattformer",
        timeEstimate: 8,
        checklistItems: ["Eksponering korrigert","Konsistent look etablert","Kreativ grading utført","Plattform-optimalisering fullført"]
    },
      sound_design: {
        title: "Lyddesign og audio post",
        description: "Utvikling av komplett, lydlandskap:\n\n• Rense og optimalisere dialog\n• Tillegge musikk og lydeffekter\n• Balansere lydnivåer og dynamikk\n• Skape immersive audio experience",
        timeEstimate: 10,
        checklistItems: ["Dialog optimalisert","Musikk og SFX tillagt","Nivåer balansert","Audio experience fullført"]
    }
  },
    business: {
      invoicing: {
        title: "Fakturering og kontraktsadministrasjon",
        description: "Håndtering av betaling og juridiske, aspekter:\n\n• Sende detaljert faktura basert på avtale\n• Følge opp betaling og kontrakter\n• Arkivere produksjonsdokumentasjon\n• Administrere opphavsrett og usage rights",
        timeEstimate: 2,
        checklistItems: ["Faktura sendt","Kontrakter administrert","Dokumentasjon arkivert","Rights administrert"]
    },
      portfolio_update: {
        title: "Porteføljeutvikling og markedsføring",
        description: "Bruke prosjekt til profesjonell, utvikling:\n\n• Velge beste klipp for demo reel\n• Oppdatere hjemmeside og portfolio\n• Lage case study av produksjonen\n• Dele prosess-innhold for markedsføring",
        timeEstimate: 3,
        checklistItems: ["Demo reel oppdatert","Portfolio utviklet","Case study laget","Markedsføring utført"]
    }
  }
},
  vendor: {
    pre_production: {
      planning: {
        title: "Produktplanlegging og markedsanalyse",
        description: "Strategisk planlegging av, produktlansering:\n\n• Analysere målmarked og konkurrenter\n• Definere produktposisjonering og USP\n• Planlegge pricing strategi og margins\n• Koordinere med leverandører og produsenter",
        timeEstimate: 4,
        checklistItems: ["Markedsanalyse utført","Posisjonering definert","Pricing etablert","Leverandører koordinert"]
    },
      client_meeting: {
        title: "Klientmøte og behovsanalyse",
        description: "Møte med potensielle kunder for å forstå, behov:\n\n• Kartlegge kundens krav og ønsker\n• Presentere relevante produktløsninger\n• Diskutere customization muligheter\n• Etablere tidslinje og leveringsbetingelser",
        timeEstimate: 2,
        checklistItems: ["Behov kartlagt","Løsninger presentert","Customization diskutert","Betingelser etablert"]
    }
  },
    production: {
      filming: {
        title: "Produktdemonstrasjon og innholdsproduksjon",
        description: "Skape markedsføringsinnhold for, produkter:\n\n• Filme produktdemonstrasjoner\n• Lage instruksjonsvideoer og tutorials\n• Fotografere produkter for katalog\n• Dokumentere installasjons- og bruksprosesser",
        timeEstimate: 6,
        checklistItems: ["Demo filmet","Tutorials laget","Produktfoto tatt","Prosesser dokumentert"]
    }
  },
    post_production: {
      editing: {
        title: "Markedsføringsmateriell og dokumentasjon",
        description: "Produsere ferdig markedsføringsinnhold:\n\n• Redigere produktvideoer og tutorials\n• Lage produktbrosjyrer og datablad\n• Utvikle online produktkataloger\n• Produsere installasjonsmanualer",
        timeEstimate: 8,
        checklistItems: ["Videoer redigert","Brosjyrer laget","Kataloger utviklet","Manualer produsert"]
    }
  },
    business: {
      invoicing: {
        title: "Salgs- og faktureringsprosess",
        description: "Administrere salgs- og, betalingsprosesser:\n\n• Generere tilbud og kontrakter\n• Prosessere bestillinger og fakturering\n• Koordinere levering og installasjon\n• Følge opp betaling og kundetilfredshet",
        timeEstimate: 3,
        checklistItems: ["Tilbud generert","Bestillinger prosessert","Levering koordinert","Oppfølging utført"]
    },
      marketing: {
        title: "Produktmarkedsføring og salgsfremmende tiltak",
        description: "Aktivt markedsføre produkter og, tjenester:\n\n• Implementere digitale markedsføringskampanjer\n• Delta på messer og bransjearrangementer\n• Utvikle partnerskap og distribusjonskanaler\n• Analysere salgsdata og optimalisere strategi",
        timeEstimate: 5,
        checklistItems: ["Kampanjer implementert","Arrangementer deltatt","Partnerskap utviklet","Analyse utført"]
    }
  }
}
};

// Template generation engine - intelligently creates worklog entries with dynamic pricing
const generateWorklogTemplate = (
  profession: string, 
  phase: string, 
  category: string, 
  projectType?: string, 
  culture?: string,
  pricingData?: { pricingStructures?: PricingStructure[] }
) => {
  const baseTemplate = DYNAMIC_WORKLOG_TEMPLATES[profession]?.[phase]?.[category];
  if (!baseTemplate) {
    return {
      title: `${category.replace('_,', ', ').replace(/\b\w/g, l => l.toUpperCase())} - ${phase.replace('_',', ')}`,
      description: `Arbeid relatert til ${category.replace('_',', ')} i ${phase.replace('_', ', ')}-fasen.`,
      timeEstimate: getDynamicTimeEstimate(profession, phase, category, pricingData),
      checklistItems: []
    };
  }

  // Clone template to avoid mutations
  const template = { ...baseTemplate };

  // Update time estimate with dynamic pricing data
  template.timeEstimate = getDynamicTimeEstimate(profession, phase, category, pricingData);

  // Add cultural context if relevant
  if (culture && culture !== 'norsk' && profession === 'photographer') {
    const culturalTips = CULTURAL_DAY_WORKLOG_TIPS[culture];
    if (culturalTips && Object.keys(culturalTips).length > 0) {
      // Add cultural considerations to description
      const culturalContext = `\n\n🌍 Kulturelle hensyn for ${culture}:\n${Object.values(culturalTips)[0]?.considerations?.slice(0, 3).map(c => `• ${c}`).join('\n') || 'Spesielle kulturelle hensyn må tas'}`;
      template.description += culturalContext;
  }
}

  // Add project type specific adjustments
  if (projectType && profession === 'music_producer') {
    if (projectType === 'album') {
      template.timeEstimate = Math.ceil(template.timeEstimate * 1.5); // Album projects take longer
      template.description += "\n\n🎼 Album-prosjekt: Tar hensyn til konseptuell sammenheng og konsistent lydprofil.";
  } else if (projectType === 'commercial') {
      template.description += "\n\n📺 Kommersielt prosjekt: Fokus på teknisk kvalitet og deadline-levering.";
  }
}

  return template;
};

// Memory card labeling schemes - normalisert versjon
const LABELING_SCHEMES = {
  ABCD: ['A','B','C','D'],
  EFGH: ['E','F','G','H'],
  NUMERIC: ['1','2','3','4','5','6','7','8','9'],
} as const;

type LabelingKey = keyof typeof LABELING_SCHEMES;

// Helper function for dynamic project type defaults
const getDefaultProjectType = (profession: string): string => {
  const typeMap: Record<string, string> = {
    photographer: 'wedding',
    videographer: 'wedding',
    music_producer: 'song',
    vendor: 'commercial'
  };
  return typeMap[profession] || 'commercial';
};

// Helper function to get project time estimates based on type and profession
const getProjectTimeEstimate = (projectType: string, profession: string): number => {
  const estimates = {
    'wedding': {
      'photographer': 8, 'videographer': 12, 'music_producer': 4, 'vendor': 6, 'enterprise': 14
    }, 'portrait': {
      'photographer': 3, 'videographer': 4, 'music_producer': 2, 'vendor': 2, 'enterprise': 5
    }, 'event': {
      'photographer': 6, 'videographer': 8, 'music_producer': 3, 'vendor': 4, 'enterprise': 10
    }, 'song': {
      'photographer': 2, 'videographer': 3, 'music_producer': 20, 'vendor': 1, 'enterprise': 3
    }, 'commercial': {
      'photographer': 4, 'videographer': 6, 'music_producer': 3, 'vendor': 5, 'enterprise': 8
    }
  };

  return estimates[projectType as keyof typeof estimates]?.[profession as keyof typeof estimates.wedding] || 4;
};

// Helper function for dynamic pricing defaults - connected to price administration system
const getDefaultPricing = (profession: string, packagesData?: { packages?: PricingPackage[] }, pricingData?: { pricingStructures?: PricingStructure[] }): number => {
  // Try to get pricing from the price administration system first
  if (packagesData?.packages && Array.isArray(packagesData.packages)) {
    const professionPackages = packagesData.packages.filter((pkg: PricingPackage) => 
      pkg.profession === profession && pkg.status === 'active'
    );
    
    if (professionPackages.length > 0) {
      // Return the base price of the first active package for this profession
      const basePrice = professionPackages[0].basePrice;
      if (basePrice && !isNaN(parseFloat(basePrice))) {
        return parseFloat(basePrice);
    }
  }
}
  
  // Fallback to pricing structures if packages not available
  if (pricingData?.pricingStructures && Array.isArray(pricingData.pricingStructures)) {
    const professionPricing = pricingData.pricingStructures.find((pricing: PricingStructure) => 
      pricing.profession === profession && pricing.status === 'active'
    );
    
    if (professionPricing) {
      // Try different pricing fields in order of preference
      const basePrice = professionPricing.basePrice || 
                       professionPricing.hourlyRate || 
                       professionPricing.fullDayRate;
      if (basePrice && !isNaN(parseFloat(basePrice))) {
        return parseFloat(basePrice);
    }
  }
}
  
  // Final fallback to hardcoded defaults
  const fallbackPriceMap: Record<string, number> = {
    photographer: 150,
    videographer: 100,
    music_producer: 800,
    vendor: 200
  };
  return fallbackPriceMap[profession] || 150;
};

// Helper function for dynamic time estimates based on pricing system
const getDynamicTimeEstimate = (profession: string, phase: string, category: string, pricingData?: { pricingStructures?: PricingStructure[] }): number => {
  // Try to get time estimates from pricing structures first
  if (pricingData?.pricingStructures && Array.isArray(pricingData.pricingStructures)) {
    const professionPricing = pricingData.pricingStructures.find((pricing: PricingStructure) => 
      pricing.profession === profession && pricing.status === 'active'
    );
    
    if (professionPricing) {
      // Look for phase-specific time estimates in the pricing structure
      const phaseTimeEstimate = professionPricing.phaseTimeEstimates?.[phase]?.[category];
      if (phaseTimeEstimate && !isNaN(parseFloat(phaseTimeEstimate))) {
        return parseFloat(phaseTimeEstimate);
    }
      
      // Fallback to base time estimate from pricing structure
      const baseTimeEstimate = professionPricing.baseTimeEstimate;
      if (baseTimeEstimate && !isNaN(parseFloat(baseTimeEstimate))) {
        return parseFloat(baseTimeEstimate);
    }
  }
}
  
  // Fallback to hardcoded estimates based on profession and phase
  const fallbackEstimates: Record<string, Record<string, Record<string, number>>> = {
    photographer: {
      pre_production: {
        planning: 3,
        client_meeting: 2,
        cultural_research: 2
      },
      production: {
        shooting: 8,
        directing: 4
      },
      post_production: {
        editing: 12,
        client_review: 3
      },
      business: {
        invoicing: 1,
        marketing: 2
      }
    },
    videographer: {
      pre_production: {
        planning: 4,
        client_meeting: 2,
        cultural_research: 2
      },
      production: {
        filming: 12,
        directing: 8
      },
      post_production: {
        editing: 20,
        color_grading: 8,
        sound_design: 10
      },
      business: {
        invoicing: 2,
        marketing: 3
      }
    },
    music_producer: {
      pre_production: {
        planning: 2,
        client_meeting: 1,
        cultural_research: 1
      },
      production: {
        recording: 8,
        mixing: 6
      },
      post_production: {
        mastering: 4,
        delivery: 1
      },
      business: {
        invoicing: 1,
        marketing: 2
      }
    },
    vendor: {
      pre_production: {
        planning: 2,
        client_meeting: 1
      },
      production: {
        filming: 6
      },
      post_production: {
        editing: 8
      },
      business: {
        invoicing: 1,
        marketing: 2
      }
    }
  };
  
  return fallbackEstimates[profession]?.[phase]?.[category] || 2;
};

interface ProjectCreationWithMemoryCardsProps {
  profession: string;
  userId?: string;
  onProjectCreated?: (projectData: ProjectData) => void;
  initialData?: ProjectInitialData;
  evendiCoupleId?: string;
  // Integration props for universal workflow connectivity
  onMeetingCreate?: (meeting: Record<string, unknown>) => void;
  onProjectUpdate?: (project: ProjectData) => void;
  onWorklogCreate?: (worklog: WorklogMutationData) => void;
  selectedProject?: { id: string; [key: string]: unknown };
  onProjectSelect?: (project: ProjectData | { id: string; [key: string]: unknown }) => void;
  // New: open Event Management with prefilled event
  onOpenEventManagement?: (eventData: Record<string, unknown>) => void;
  // Host dashboard can pass this so the modal can actually move focus to
  // one of the integration tabs (worklog, storyArc, showcase, ...) instead
  // of the previous console-log stub.
  onGoToTab?: (tabName: string) => void;
}

interface MemoryCardConfig {
  label: string;
  type: string;
  capacity: string;
  dayNumber: number;
  dayName: string;
  count?: number;
  estimatedPhotos?: number;
}

// Interface for MemoryCardSelector component
interface MemoryCardSelectorConfig {
  capacity: string;
  count: number;
  estimatedPhotos: {
    raw: number;
    craw: number;
};
}

interface SelectedMemoryCard {
  type: string;
  capacity: string;
  brand?: string;
  model?: string;
  count?: number;
  estimatedPhotos?: number;
}

// Shot list item type used across the component
interface ShotListItem {
  id: string;
  scene: string;
  description: string;
  estimatedDuration?: number;
  priority?: string;
  shotType?: string;
  notes?: string;
  locationName?: string;
  locationLat?: number;
  locationLng?: number;
  locationNotes?: string;
  weatherTip?: string;
  travelFromVenue?: string;
  location?: { name?: string; lat?: number; lng?: number };
  imageUri?: string | null;
  scouted?: boolean;
}

// Phase history entry
interface PhaseHistoryEntry {
  phase: string;
  timestamp: string;
  notes: string;
}

// Collaborator entry in project data
interface ProjectCollaboratorEntry {
  id?: string;
  name: string;
  email: string;
  role: string;
  invitationStatus: string;
}

// Location suggestion from Kartverket
interface LocationSuggestion {
  name?: string;
  address?: string;
  municipality?: string;
  type?: string;
  lat: number;
  lng: number;
  coordinates?: { lat: number; lng: number };
}

// Contact option for autocomplete
interface ContactOption {
  displayName?: string;
  email?: string;
  phone?: string;
}

// Version history entry
interface VersionEntry {
  id: string;
  version: string;
  createdAt: string;
  description?: string;
}

// Virtual Studio result
interface VirtualStudioResult {
  sceneCount: number;
  cameraPathCount: number;
  renderCount: number;
  workTime: number;
  renderUrls?: string[];
  exportedFormats?: string[];
  updatedShots?: ShotListItem[];
  cameraSettings?: Record<string, unknown>;
}

// Pricing package
interface PricingPackage {
  profession: string;
  status: string;
  basePrice: string;
  name: string;
}

// Pricing structure from price administration
interface PricingStructure {
  profession: string;
  status: string;
  basePrice?: string;
  hourlyRate?: string;
  fullDayRate?: string;
  baseTimeEstimate?: string;
  phaseTimeEstimates?: Record<string, Record<string, string>>;
}

// Worklog mutation data - flexible shape for different call sites
interface WorklogMutationData {
  projectId?: string;
  userId?: string;
  taskName?: string;
  title?: string;
  description?: string;
  hoursSpent?: number;
  timeSpent?: number;
  status?: string;
  category?: string;
  phase?: string;
  projectPhase?: string;
  profession?: string;
  phaseName?: string;
  phaseColor?: string;
  timeEstimate?: number;
  artifacts?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// Milestone data
interface MilestoneData {
  name: string;
  date: string;
}

// Initial data shape for the component
interface ProjectInitialData {
  projectName?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  eventDate?: string;
  eventDates?: Record<number, string> | string[];
  description?: string;
  venue?: string;
  guestCount?: string;
  location?: string;
  projectType?: string;
  budget?: string;
}

// Slice 9X.5 — package picker that reads from PricingAdministration's
// /api/pricing/packages endpoint. Renders nothing when the photographer
// has no packages registered yet (empty UI > confusing empty Select).
// Lives above the main export so the wizard JSX can mount it inline.
function ProjectPackagePicker({
  userId,
  value,
  onChange,
}: {
  userId: string | null;
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: packages } = useQuery<Array<{
    id: string | number;
    name?: string;
    package_name?: string;
    inclusions?: { images?: number; hours?: number };
    basePrice?: number;
  }>>({
    queryKey: ['/api/pricing/packages', userId, 'project-create'],
    enabled: Boolean(userId),
    queryFn: () =>
      apiRequest(`/api/pricing/packages?userId=${encodeURIComponent(userId!)}`).then(
        (r: unknown) => (Array.isArray(r) ? r : []) as never[],
      ),
  });
  if (!packages || packages.length === 0) return null;
  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Pris-pakke (fra Administrasjon)
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Velger du pakke her, blir den brukt videre i klient-galleriet
          (auto-fyller inkluderte bilder) og vises i ProjectTimeline.
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel>Pakke</InputLabel>
          <Select label="Pakke" value={value} onChange={(e) => onChange(String(e.target.value || ''))}>
            <MenuItem value="">Ingen pakke</MenuItem>
            {packages.map((p) => {
              const id = String(p.id);
              const name = p.package_name || p.name || `Pakke ${id}`;
              const imgs = p.inclusions?.images;
              const hrs = p.inclusions?.hours;
              const parts: string[] = [];
              if (imgs) parts.push(`${imgs} bilder`);
              if (hrs) parts.push(`${hrs}t`);
              const label = parts.length > 0 ? `${name} — ${parts.join(' · ')}` : name;
              return (
                <MenuItem key={id} value={id}>
                  {label}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </CardContent>
    </Card>
  );
}

export default function ProjectCreationWithMemoryCards({
  profession,
  userId,
  initialData, // Pre-filled data from submission
  evendiCoupleId, // Optional Evendi couple ID for traditions bridge
  onProjectCreated,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect,
  onOpenEventManagement,
  onGoToTab,
}: ProjectCreationWithMemoryCardsProps) {
  // Get user and profession context with dynamic system support
  const { user, isLoading: authLoading } = useAuth();

  // Create auth headers for API requests
  const auth = {
    'Authorization': `Bearer ${user?.id || 'anonymous'}`,
    'X-User-Email': user?.email || 'anonymous@example.com'
  };
  const { getCurrentUserProfession, professionConfigs, isLoading: professionsLoading, getProfessionDisplayName, getProfessionIcon } = useDynamicProfessions();
  const userProfession = user?.profession || profession || getCurrentUserProfession();
  
  // Narrowed profession types for components that require specific union types
  const memoryCardProfession: 'photographer' | 'videographer' = 
    userProfession === 'videographer' ? 'videographer' : 'photographer';
  const enhancedProfession: 'photographer' | 'videographer' | 'both' = 
    (userProfession === 'videographer' || userProfession === 'both') ? userProfession as 'videographer' | 'both' : 'photographer';
  const collaboratorProfession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise' =
    (['photographer', 'videographer', 'music_producer', 'vendor', 'enterprise'] as const).includes(userProfession as 'photographer')
      ? userProfession as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'
      : 'photographer';

  const professionConfig = professionConfigs?.[userProfession];
  
  // New context hooks - Enhanced with full ProjectContext functionality
  const { 
    currentProject, 
    createProject: createProjectContext, 
    updateProject, 
    loadProject,
    deleteProject,
    duplicateProject,
    archiveProject,
    updateProjectSettings,
    getProjectSettings,
    updateProjectMetadata,
    getProjectMetadata,
    updateIntegrationStatus,
    getIntegrationStatus,
    addProjectCollaborator,
    getProjectCollaborators,
    uploadProjectFile,
    getProjectFiles,
    addProjectMilestone,
    updateProjectStatus,
    addProjectComment,
    getProjectComments,
    createProjectBackup,
    getProjectBackups,
    getProjectAnalytics,
    getProjectPerformanceMetrics,
    searchProjects,
    getProjectsByDateRange,
    validateProjectData,
    checkProjectHealth,
    cacheProjectData,
    getCachedProjectData,
    invalidateProjectCache,
    refreshProjectCache,
    saveProjectDraft,
    getProjectDraft,
    deleteProjectDraft,
    syncProjectOffline,
    connectProjectIntegration,
    disconnectProjectIntegration,
    getProjectIntegrations,
    testProjectIntegration,
    transformProjectData,
    migrateProjectData,
    getProjectDataVersion,
    rollbackProjectData,
    optimizeProjectData,
    analyzeProjectData,
    cleanupProjectData,
    setProjectPermissions,
    getProjectPermissions,
    checkProjectAccess,
    auditProjectAccess,
    validateProjectCompliance,
    getProjectComplianceReport,
    updateProjectCompliance,
    getProjectAuditTrail
} = useProject();
  
  // Comprehensive feature system integration
  const { features, communication } = useEnhancedMasterIntegration();
  
  // External Data Service integration for location intelligence
  const { 
    getKartverketAddress, 
    searchKartverketPlaceNames,
    analyzeProperty,
    getCurrentWeather,
    getWeatherForecast,
    calculateTravelCosts,
    getFuelPrices
} = useExternalData();
  
  // Theming system
  const theming = useTheming('photographer');
  
  const { 
    settings, 
    updateSetting, 
    getSetting, 
    getProfessionDefaults,
    mergeWithDefaults 
} = useSettings();
  
  const { 
    theme, 
    getProfessionTheme, 
    getComponentTheme,
    isDarkMode 
} = useTheme();
  
  const { 
    isConnected, 
    emitEvent, 
    onEvent, 
    offEvent,
    createSession,
    joinSession,
    leaveSession
} = useRealTime();
  
  // Dynamic profession configuration hooks
  const professionConfigsData = useProfessionConfigs();
  const professionAdapterData = useProfessionAdapter();

  // Toast notification system
  const visualEditorContext = useVisualEditor();
  const addNotification = visualEditorContext?.addNotification || ((notification: Omit<{ id: string; type: 'info' | 'success' | 'warning' | 'error'; title: string; message: string; timestamp: Date; read: boolean; action?: { label: string; callback: () => void } }, 'id' | 'timestamp'>) => {
    console.log('Visual Editor context not available, ', notification);
  });

  // Toast helper functions
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', _duration: number = 4000) => {
      addNotification({
        title: type.charAt(0).toUpperCase() + type.slice(1) + ' Notification',
        message,
        type,
        read: false,
    });
  }, [addNotification]);

  const showSuccessToast = useCallback((message: string, duration: number = 4000) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showErrorToast = useCallback((message: string, duration: number = 6000) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const showWarningToast = useCallback((message: string, duration: number = 5000) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  const showInfoToast = useCallback((message: string, duration: number = 4000) => {
    showToast(message, 'info', duration);
  }, [showToast]);
  
  const [activeStep, setActiveStep] = useState(0);
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  const [healthCheckPassed, setHealthCheckPassed] = useState(false);
  const [cultureDayDialog, setCultureDayDialog] = useState({
    open: false,
    culture: '',
    day: '',
    explanation: ''
});
  
  const [worklogFormData, setWorklogFormData] = useState({
    title: '',
    description: '',
    category: 'planning',
    timeSpent: 2,
    projectPhase: 'pre_production'
});
  
  const [showWorklogTipsDialog, setShowWorklogTipsDialog] = useState(false);
  
  // Draft Management System
  const [draftSidebarOpen, setDraftSidebarOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<'draft' | 'published' | 'live'>('draft');
  const [projectHistory, setProjectHistory] = useState<any[]>([]);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const [publishedProject, setPublishedProject] = useState<any>(null);
  
  // Location Intelligence State
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [locationAnalysis, setLocationAnalysis] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [travelCosts, setTravelCosts] = useState<any>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Initialize projectData state early so it can be used in useEffects below
  const [projectData, setProjectData] = useState({
    projectName: initialData?.projectName || '',
    clientName: initialData?.clientName || '',
    clientEmail: initialData?.clientEmail || '',
    clientPhone: initialData?.clientPhone || '',
    eventDate: initialData?.eventDate || '',
    eventDates: (initialData?.eventDates as Record<number, string>) || ({} as Record<number, string>), // For multi-day events
    location: initialData?.location || '',
    projectType: initialData?.projectType || getDefaultProjectType(userProfession),
    eventType: 'wedding' as string, // From Evendi bridge (wedding, birthday, corporate, etc.)
    eventCategory: 'personal' as string, // personal | corporate
    weddingCulture: 'norsk',
    totalDays: 1,
    activeDays: [1],
    memoryCardConfigs: [] as MemoryCardConfig[],
    selectedMemoryCards: [] as SelectedMemoryCard[],
    selectedCameras: [] as Array<{ name: string; brand: string; model?: string }>,
    enhancedMemoryCardSelection: null as { totalCards?: number; totalCapacity?: string; estimatedCost?: number; backupStrategy?: string; autoBackup?: boolean; recommendations?: unknown[]; customCards?: unknown[] } | null, // Enhanced memory card selection
    memoryCardBudget: 'mid' as 'budget' | 'mid' | 'premium' | 'professional',
    editingSoftware: '',
    driveIntegration: true,
    meetingOption: 'none',
    meetingTime: '10:00',
    meetingDuration: 60,
    saveAsDefault: false,
    description: initialData?.description || '',
    venue: initialData?.venue || '',
    guestCount: initialData?.guestCount || '',
    primaryCamera: '',
    backupCamera: '',
    estimatedPhotos: '',
    fileFormat: 'raw+jpeg',
    equipmentNotes: '',
    backupStrategy: 'automatic',
    backupFrequency: 'realtime',
    shotList: [] as ShotListItem[],
    phaseHistory: [] as PhaseHistoryEntry[],
    currentPhase: 'pre-planning' as string,
    davinciIntegrationEnabled: false,
    cameraBrand: '' as string,
    logFormat: '' as string,
    memoryCardLabeling: '' as string,
    collaborators: [] as ProjectCollaboratorEntry[],
    enableSplitSheet: false,
    detectedLogFormats: [] as string[],
    createWeddingTimeline: false,
    weddingTimelineShared: false,
    weddingTimelineUrl: '' as string,
    // Slice 9X.5 — pris-pakke fra PricingAdministration. Når satt
    // brukes den til å auto-fylle galleri-contractedImages OG til å
    // vise pris/inkluderte timer i ProjectTimeline.
    packageId: '' as string,
  });

  // Session ID for autosave (hoisted before useAutoSave). Scoped per user and
  // persisted to localStorage so a draft survives modal close/reopen instead
  // of being orphaned under a new random UUID every mount.
  const [sessionId] = useState(() => {
    const storageKey = user?.id
      ? `projectCreation.draftSessionId.${user.id}`
      : 'projectCreation.draftSessionId.anonymous';
    try {
      const stored = typeof window !== 'undefined'
        ? localStorage.getItem(storageKey)
        : null;
      if (stored) return stored;
      const fresh = crypto.randomUUID();
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, fresh);
      }
      return fresh;
    } catch {
      return crypto.randomUUID();
    }
  });

  // Auto-save hook for project data persistence
  const autoSaveStatus = useAutoSave();

  // Project type details query
  const { data: projectTypeDetails } = useQuery({
    queryKey: ['projectTypeDetails', projectData?.projectType, userProfession],
    queryFn: async () => {
      const nextSteps = getProjectTypeNextSteps(projectData.projectType, userProfession);
      const description = getProjectTypeInitialDescription(projectData.projectType, projectData.clientName || '', projectData.eventDate || '');
      const timeEstimate = getProjectTimeEstimate(projectData.projectType, userProfession);
      const pricing = getDefaultPricing(userProfession);
      const pin = generatePinFromProjectName(projectData.projectName);
      return { nextSteps, description, timeEstimate, pricing, pin };
    },
    enabled: !!projectData?.projectType,
  });

  // ======= EVENDI TRADITIONS BRIDGE =======
  // Auto-fetch couple's cultural type from Evendi when evendiCoupleId is provided
  const [evendiTraditionsBridge, setEvendiTraditionsBridge] = useState<any>(null);
  
  useEffect(() => {
    if (!evendiCoupleId) return;
    
    const fetchTraditions = async () => {
      try {
        const data = await apiRequest(`/api/evendi/traditions-bridge?coupleId=${encodeURIComponent(evendiCoupleId)}`);
        if (data?.primaryCulturalType) {
          setEvendiTraditionsBridge(data);
          // Auto-set weddingCulture + eventType from couple's profile
          // Also auto-map projectType when the Evendi eventType provides better info
          const autoProjectType = data.eventType && data.eventType !== 'wedding'
            ? data.eventType // Use Evendi event type directly (e.g., 'conference', 'birthday')
            : undefined; // Keep user's selection for weddings
          setProjectData(prev => {
            // Only auto-populate totalDays/activeDays when the user hasn't
            // already picked a wedding culture or explicitly set day counts —
            // otherwise Evendi's async lookup could silently overwrite the
            // photographer's manual edit after the bridge resolves.
            const userHasSetDays = !!prev.weddingCulture || prev.totalDays !== 1;
            const cultureDays = (WEDDING_CULTURES as Record<string, any>)[data.primaryCulturalType]?.typical_days;
            const nextTotalDays = userHasSetDays
              ? prev.totalDays
              : cultureDays || prev.totalDays;
            return {
              ...prev,
              weddingCulture: data.primaryCulturalType,
              eventType: data.eventType || 'wedding',
              eventCategory: data.eventCategory || 'personal',
              ...(autoProjectType && { projectType: autoProjectType }),
              totalDays: nextTotalDays,
              activeDays: Array.from({ length: nextTotalDays }, (_, i) => i + 1),
            };
          });
          console.log(`🌍 Traditions bridge: Couple ${evendiCoupleId} → culturalType: ${data.primaryCulturalType}, eventType: ${data.eventType}`, data);
        }
      } catch (error) {
        console.warn('Evendi traditions bridge fetch failed (non-critical):', error);
      }
    };
    
    fetchTraditions();
  }, [evendiCoupleId]);
  // ======= END TRADITIONS BRIDGE =======

  // ======= PHOTO SHOTS BRIDGE =======
  // Auto-fetch couple's photo plan from Evendi and merge into project shotList
  const [evendiPhotoShotsBridge, setEvendiPhotoShotsBridge] = useState<{
    shots: ShotListItem[];
    coupleName: string;
    totalShots: number;
    completedShots: number;
  } | null>(null);

  useEffect(() => {
    if (!evendiCoupleId) return;
    
    const fetchCouplePhotoShots = async () => {
      try {
        const data = await apiRequest(`/api/evendi/photo-shots-bridge?coupleId=${encodeURIComponent(evendiCoupleId)}`);
        if (data?.shots?.length > 0) {
          setEvendiPhotoShotsBridge(data);
          
          // Merge couple's shots into projectData.shotList (avoid duplicates by checking evendi- prefix)
          setProjectData(prev => {
            const existingEvendiIds = new Set(
              prev.shotList
                .filter((s) => s.id?.startsWith('evendi-'))
                .map((s) => s.id)
            );
            
            const newShots = data.shots.filter((s: ShotListItem) => !existingEvendiIds.has(s.id));
            if (newShots.length === 0) return prev;
            
            return {
              ...prev,
              shotList: [...prev.shotList, ...newShots],
            };
          });
          
          console.log(`📸 Photo shots bridge: ${data.totalShots} shots from couple (${data.completedShots} completed)`, data);
        }
      } catch (error) {
        console.warn('Evendi photo shots bridge fetch failed (non-critical):', error);
      }
    };
    
    fetchCouplePhotoShots();
  }, [evendiCoupleId]);

  // Push vendor's planned shots back to couple's Evendi photo plan (with location scouting data)
  const pushShotsToCouple = useCallback(async () => {
    if (!evendiCoupleId || !projectData.shotList?.length) return;
    
    try {
      const vendorShots = projectData.shotList
        .filter((s) => !s.id?.startsWith('evendi-'))
        .map((s) => ({
          ...s,
          // Include location scouting data if present
          locationName: s.locationName || s.location?.name || null,
          locationLat: s.locationLat || s.location?.lat || null,
          locationLng: s.locationLng || s.location?.lng || null,
          locationNotes: s.locationNotes || null,
          weatherTip: s.weatherTip || null,
          travelFromVenue: s.travelFromVenue || null,
          imageUri: s.imageUri || null,
          scouted: s.scouted || false,
        }));
      if (vendorShots.length === 0) return;
      
      const result = await apiRequest('/api/evendi/photo-shots-bridge/push', {
        method: 'POST',
        body: { coupleId: evendiCoupleId, shots: vendorShots },
      });
      
      if (result?.success) {
        console.log(`📸 Pushed ${result.pushedCount} vendor shots to couple's photo plan (with location data)`);
      }
    } catch (error) {
      console.warn('Failed to push shots to couple (non-critical):', error);
    }
  }, [evendiCoupleId, projectData.shotList]);
  // ======= END PHOTO SHOTS BRIDGE =======
  
// Load meeting preferences from server (replaces localStorage)
useEffect(() => {
  if (!user) return;
  const load = async () => {
    try {
      const res = await fetch(`/api/user/meeting-preferences?profession=${encodeURIComponent(profession)}`);
      if (res.ok) {
        const data = await res.json();
        const prefs = data?.data;
        if (prefs) {
          setProjectData(prev => ({
            ...prev,
            meetingOption: prefs.meeting_option || 'none',
            meetingTime: prefs.meeting_time || '10:00',
            meetingDuration: prefs.meeting_duration || 60,
            saveAsDefault: false,
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to load meeting preferences: ', error);
    }
  };
  load();
}, [user, profession]);

// Persist meeting preferences when changed
useEffect(() => {
  if (!user) return;
  const controller = new AbortController();
  const save = async () => {
    try {
      await fetch('/api/user/meeting-preferences', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json', ...auth },
        body: JSON.stringify({
          profession,
          meetingOption: projectData.meetingOption,
          meetingTime: projectData.meetingTime,
          meetingDuration: projectData.meetingDuration,
        }),
        signal: controller.signal,
      });
    } catch (_saveErr) {
      // Non-critical: meeting preferences save can fail silently
      console.debug('Meeting preferences save skipped:', _saveErr);
    }
  };
  save();
  return () => controller.abort();
  // Only the meeting fields should trigger a save — previously this
  // depended on the entire `projectData`, so every description or shot
  // list edit re-POSTed the same preferences repeatedly.
}, [user, profession, projectData.meetingOption, projectData.meetingTime, projectData.meetingDuration]);

  // Check user authentication status (only after auth has finished loading to
  // avoid spamming a warning during the initial token exchange).
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      showWarningToast('No authenticated user found. Some features may not work properly.', 6000);
      console.warn('⚠️ No authenticated user found. Some features may not work properly.');
  } else {
      showInfoToast('User authenticated successfully', 2000);
      console.log('✅ User authenticated:', user.email || user.id);
  }
}, [user, authLoading]);

  // Feature system integration - component registration and usage tracking
  useEffect(() => {
    // Check feature access for project creation
    const projectCreationAccess = features.checkFeatureAccess('project-creation');
    const memoryCardPlanningAccess = features.checkFeatureAccess('memory-card-planning');
    const davinciIntegrationAccess = features.checkFeatureAccess('davinci-resolve-integration');
    
    // Track feature usage
    features.trackFeatureUsage('project-creation','component_opened', {
      profession: userProfession,
      userId: user?.id,
      timestamp: new Date().toISOString(),
      hasAccess: projectCreationAccess.hasAccess
  });

    // Log feature access status
    if (!projectCreationAccess.hasAccess) {
      console.warn('⚠️ Project creation feature not enabled:', projectCreationAccess.reason);
  }
    if (!memoryCardPlanningAccess.hasAccess) {
      console.warn('⚠️ Memory card planning feature not enabled:', memoryCardPlanningAccess.reason);
  }
    if (!davinciIntegrationAccess.hasAccess) {
      console.warn('⚠️ DaVinci Resolve integration feature not enabled:', davinciIntegrationAccess.reason);
  }
}, [features, userProfession, user]);

  // Load profession-specific settings on mount
  useEffect(() => {
    if (userProfession && settings) {
      const professionDefaults = getProfessionDefaults(userProfession);
      if (professionDefaults) {
        // Apply profession-specific defaults to project data
        setProjectData(prev => ({
          ...prev,
          ...professionDefaults.projectCreation,
          ...professionDefaults.showcase,
          // Ensure all required properties exist
          description: prev.description || '',
          venue: prev.venue || '',
          guestCount: prev.guestCount || '',
          primaryCamera: prev.primaryCamera || '',
          backupCamera: prev.backupCamera || '',
          estimatedPhotos: prev.estimatedPhotos || '',
          fileFormat: prev.fileFormat || 'raw+jpeg',
          equipmentNotes: prev.equipmentNotes || '',
          backupStrategy: prev.backupStrategy || 'automatic',
          backupFrequency: prev.backupFrequency || 'realtime'
      }));
    }
  }
}, [userProfession, settings, getProfessionDefaults]);

  // Real-time event handling
  useEffect(() => {
    const handleProjectUpdate = (event: RealTimeEvent) => {
      if (event.data.projectId === currentProject?.id) {
        showInfoToast('Project updated in real-time', 3000);
    }
  };

    const handleUserJoined = (event: RealTimeEvent) => {
      showInfoToast(`${event.data.userName} joined the project`, 3000);
  };

    if (isConnected) {
      onEvent('project_updated', handleProjectUpdate);
      onEvent('user_joined', handleUserJoined);
    }

    return () => {
      if (isConnected) {
        offEvent('project_updated', handleProjectUpdate);
        offEvent('user_joined', handleUserJoined);
      }
    };
}, [isConnected, onEvent, offEvent, currentProject]);
  
  // Load meeting preferences from server (replaces localStorage)
  
  const [memoryCardLabeling, setMemoryCardLabeling] = useState<LabelingKey>('ABCD');
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false);
  const [showScriptManager, setShowScriptManager] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const memoryPlanSavedRef = useRef(false);

  // Normalize multi-day event dates from initialData
  useEffect(() => {
    const raw = initialData?.eventDates as Record<number, string> | string[] | undefined;
    if (!raw) return;
    const normalized: Record<number, string> = {};
    if (Array.isArray(raw)) {
      raw.forEach((d: string, idx: number) => {
        if (d) normalized[idx + 1] = d;
      });
    } else if (typeof raw === 'object') {
      Object.entries(raw).forEach(([k, v]) => {
        const n = Number(k);
        if (Number.isFinite(n) && typeof v === 'string') normalized[n] = v as string;
      });
    }
    if (Object.keys(normalized).length > 0) {
      const days = Object.keys(normalized).map((k) => Number(k)).sort((a, b) => a - b);
      const firstDate = normalized[days[0]];
      setProjectData((prev) => ({
        ...prev,
        eventDates: normalized,
        totalDays: days.length,
        activeDays: days,
        eventDate: prev.eventDate || firstDate,
      }));
    }
  }, [initialData?.eventDates]);

  // Existing client picker (Google Contacts)
  const [contactQuery, setContactQuery] = useState('');
  const [contactOptions, setContactOptions] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  // Dynamic project types system
  const { allTypes: dynamicProjectTypes, trackUsage, isLoading: projectTypesLoading, createProjectType } = useProjectTypes();
  const [addProjectTypeDialogOpen, setAddProjectTypeDialogOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      try {
        if (!contactQuery || contactQuery.length < 2) return;
        const res = await fetch(`/api/google/people/search-contacts?q=${encodeURIComponent(contactQuery)}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setContactOptions(data || []);
        }
      } catch (searchErr) {
        // Contact search can fail when aborted or offline
        console.debug('Contact search skipped:', searchErr);
      }
    };
    run();
    return () => controller.abort();
  }, [contactQuery]);

  useEffect(() => {
    if (selectedContact) {
      setProjectData(prev => ({
        ...prev,
        clientName: selectedContact.displayName || `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim(),
        clientEmail: selectedContact.email || '',
        clientPhone: selectedContact.phone || ''
      }));
    }
  }, [selectedContact]);

  // Event Management linkage prompt
  const [askedConnectEvent, setAskedConnectEvent] = useState(false);
  const [connectToEvent, setConnectToEvent] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  useEffect(() => {
    try {
      if (projectData?.projectType === 'event' && !askedConnectEvent) {
        setConnectDialogOpen(true);
      }
    } catch (eventErr) {
      console.debug('Event connect check skipped:', eventErr);
    }
  }, [projectData?.projectType, askedConnectEvent]);
  
  // Project Timeline Phase Management Functions
  const handlePhaseChange = (newPhase: string) => {
    const validPhase = newPhase.replace(/_/g, '-');
    setProjectData(prev => ({
      ...prev,
      currentPhase: validPhase,
      phaseHistory: [
        ...prev.phaseHistory,
        {
          phase: newPhase,
          timestamp: new Date().toISOString(),
          notes: `Phase changed to ${newPhase}`
      }
      ],
      // Enable DaVinci integration when entering post-production phase
      davinciIntegrationEnabled: newPhase === 'post-production'
  }));
    
    // Track phase change in feature system
    features.trackFeatureUsage('project-timeline-phases','phase_changed', {
      profession: userProfession,
      userId: user?.id,
      previousPhase: projectData.currentPhase,
      newPhase: newPhase,
      timestamp: new Date().toISOString()
    });
    
    // Show notification
    if (newPhase === 'post-production') {
      showSuccessToast('Post-production phase activated! DaVinci Resolve integration is now available.', 5000);
  }
};
  
  // Camera detection and LOG format detection
  const detectCameraInfo = (cameraModel: string) => {
    if (!cameraModel) return;
    
    // Try video camera first
    let cameraBrand = getCameraBrand(cameraModel);
    const logFormats = getLogFormatsByCamera(cameraModel);
    
    // If not found in video cameras, try photo cameras
    if (!cameraBrand) {
      cameraBrand = getPhotoCameraBrand(cameraModel);
  }
    
    setProjectData(prev => ({
      ...prev,
      cameraBrand: cameraBrand || '',
      detectedLogFormats: logFormats,
      // Auto-select first LOG format if available
      logFormat: logFormats.length > 0 ? logFormats[0] : ''
  }));
    
    // Show notification if LOG formats detected
    if (logFormats.length > 0) {
      showInfoToast(`Detected ${cameraBrand} camera with LOG support: ${logFormats.join('')}`, 3000);
  } else if (cameraBrand) {
      showInfoToast(`Detected ${cameraBrand} camera (no LOG support detected)`, 2000);
  }
};

  const openDavinciScriptManager = () => {
    if (!projectData.davinciIntegrationEnabled) {
      showWarningToast('Please enter Post-production phase to access DaVinci Resolve integration', 4000);
      return;
  }
    
    // Track DaVinci integration usage
    features.trackFeatureUsage('davinci-resolve-integration','script_manager_opened', {
      profession: userProfession,
      userId: user?.id,
      projectName: projectData.projectName,
      currentPhase: projectData.currentPhase,
      cameraBrand: projectData.cameraBrand,
      logFormat: projectData.logFormat,
      timestamp: new Date().toISOString()
    });
    
    // Open Script Manager dialog
    setShowScriptManager(true);
    showInfoToast('Opening DaVinci Resolve Script Manager...', 2000);
};

  
  // Health Check navigation handler
  const handleGoToStep = (stepIndex: number) => {
    setActiveStep(stepIndex);
};

  const handleGoToTab = (tabName: string) => {
    // Parent (e.g. UniversalDashboard) can pass onGoToTab to actually
    // move focus between dashboard tabs. If not provided we fall back
    // to a hash route so the browser URL still reflects the intent and
    // back/forward navigation works, but we don't force-reload.
    if (onGoToTab) {
      onGoToTab(tabName);
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.hash = `#tab=${encodeURIComponent(tabName)}`;
    }
};

  // Map local projectData state to ProjectData shape for createProject context
  const mapToProjectData = useCallback(() => ({
    name: projectData.projectName,
    description: projectData.description || undefined,
    clientName: projectData.clientName,
    eventDate: projectData.eventDate,
    location: projectData.location || undefined,
    projectType: projectData.projectType,
    profession: userProfession,
    status: 'draft' as const,
    createdBy: user?.id || 'anonymous',
    settings: {
      showcaseSettings: {},
      downloadProtection: 'none' as const,
      watermark: 'none' as const,
      clientAccess: 'full' as const,
      pricing: {},
      // Slice 9X.5 — bevarer pakke-ID på prosjektet så ProjectTimeline
      // kan vise inkluderte timer/bilder + galleri-flyt kan auto-fylle
      // contractedImages fra samme pakke.
      packageId: projectData.packageId || undefined,
      meetingPreferences: {
        meetingOption: projectData.meetingOption,
        meetingTime: projectData.meetingTime,
        meetingDuration: projectData.meetingDuration,
      },
    },
    metadata: {
      totalDays: projectData.totalDays,
      activeDays: projectData.activeDays,
      memoryCardConfigs: projectData.memoryCardConfigs,
      customCategories: [] as string[],
      customDayNames: [] as string[],
      selectedMemoryCards: projectData.selectedMemoryCards,
      shotList: projectData.shotList,
      collaborators: projectData.collaborators,
    },
    integrations: {
      googleDrive: projectData.driveIntegration,
      googlePhotos: false,
      weddingTimeline: projectData.createWeddingTimeline,
      showcase: false,
      worklog: false,
    },
  }), [projectData, userProfession, user?.id]);

  // Slice 9X.13 — for fotografer rutes prosjektopprettelse til den
  // photographer-spesifikke endepunkten som auto-oppretter CRM-klient,
  // logger til client_communications og kobler submission-id. For
  // andre profesjoner brukes fortsatt ProjectContext.createProject
  // (legacy /api/projects).
  const createProjectViaCorrectEndpoint = useCallback(async (): Promise<{ id?: string; name?: string } & Record<string, unknown> | null> => {
    const mapped = mapToProjectData();
    const isPhotographer = (userProfession || '').toLowerCase().includes('photographer');
    if (!isPhotographer) {
      return await createProjectContext(mapped);
    }

    // Hent submissionId hvis det ligger i state (settes når dialog
    // åpnes fra CustomerInquiryCenter via initialData → projectData).
    const submissionId = (initialData as Record<string, unknown> | undefined)?.submissionId
      || (projectData as Record<string, unknown>).submissionId
      || null;

    try {
      const result = await apiRequest('/api/photographer/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: mapped.name,
          clientName: mapped.clientName,
          clientEmail: projectData.clientEmail || null,
          clientPhone: projectData.clientPhone || null,
          projectType: mapped.projectType,
          eventDate: mapped.eventDate,
          location: mapped.location,
          description: mapped.description,
          servicePrice: projectData.budget ? Number(projectData.budget) : null,
          budget: projectData.budget ? Number(projectData.budget) : null,
          estimatedHours: projectData.estimatedHours
            ? Number(projectData.estimatedHours) : null,
          submissionId,
          projectData: mapped.metadata,
          settings: mapped.settings,
        }),
      }) as { id?: string };

      if (!result?.id) {
        throw new Error('Photographer projects API returnerte ikke id');
      }
      // Returnér shape kompatibel med createProjectContext sin retur
      // så WorkflowIntegrationService + onProjectCreated funker likt.
      return { id: result.id, ...mapped };
    } catch (err) {
      console.warn('[photographer-project] create via /api/photographer/projects failed, fallback til legacy /api/projects:', err);
      // Fallback til legacy så Stine ikke blir blokkert hvis det nye
      // endepunktet skulle ha en bug. Prosjektet havner i legacy-tabellen
      // men er fortsatt opprettet — bedre enn å miste innsendingen.
      return await createProjectContext(mapped);
    }
  }, [mapToProjectData, userProfession, createProjectContext, initialData, projectData]);

  const handleHealthCheckPassed = async () => {
    setHealthCheckPassed(true);
    setShowHealthCheck(false);
    showSuccessToast('Health check passed! Ready to create project.', 3000);
    // Proceed with project creation
    try {
      const newProject = await createProjectViaCorrectEndpoint();
      if (newProject) {
        await WorkflowIntegrationService.orchestrateCompleteWorkflow(newProject);
        // Bridge to Capture: persist the shot list into the shot_lists
        // table (the iPad CaptureApp reads from there, not from the
        // project metadata blob) and bootstrap a capture session so the
        // iPad sees a ready-to-shoot session without a manual step.
        await syncProjectToCapture(newProject).catch((err) => {
          console.warn('Capture bridge sync failed (non-blocking):', err);
        });
      }
      // Call callback to notify parent component
      if (onProjectCreated && newProject) {
        onProjectCreated(newProject);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      showErrorToast('Failed to create project. Please try again.');
    }
};

  // Push the just-created project into the Capture backend so the iPad
  // can pick it up. Silent (non-blocking) — the web project creation
  // itself must not fail if the capture bridge has a hiccup.
  const syncProjectToCapture = useCallback(async (newProject: { id?: string } & Record<string, unknown>) => {
    const projectId = newProject?.id;
    if (!projectId) return;
    const shots = Array.isArray(projectData.shotList) ? projectData.shotList : [];
    if (shots.length > 0) {
      try {
        await apiRequest(`/api/projects/${encodeURIComponent(String(projectId))}/shot-list`, {
          method: 'POST',
          body: {
            shots,
            listName: projectData.projectName ? `${projectData.projectName} — shots` : 'Shot list',
            eventType: projectData.projectType || 'photo_session',
          },
        });
      } catch (err) {
        console.warn('Shot list sync to capture failed:', err);
      }
    }
    // Only bootstrap a capture session for profession types that
    // actually use the iPad CaptureApp — avoids noisy sessions for,
    // e.g., stylists or planners who never shoot.
    const capturePro = (userProfession || '').toLowerCase();
    const shouldBootstrapCapture = [
      'photographer',
      'videographer',
      'wedding-photographer',
      'commercial-photographer',
    ].some((p) => capturePro.includes(p));
    if (shouldBootstrapCapture) {
      try {
        await apiRequest(`/api/projects/${encodeURIComponent(String(projectId))}/capture-session`, {
          method: 'POST',
          body: {
            name: projectData.projectName || undefined,
          },
        });
      } catch (err) {
        console.warn('Capture session bootstrap failed:', err);
      }
    }
  }, [projectData.shotList, projectData.projectName, projectData.projectType, userProfession]);

  // Keep the shot_lists table in sync with the web modal so the iPad
  // always sees the latest plan. Debounced like the memory card save.
  useEffect(() => {
    if (!currentProject?.id) return;
    const shots = Array.isArray(projectData.shotList) ? projectData.shotList : [];
    const timer = setTimeout(async () => {
      try {
        await apiRequest(`/api/projects/${encodeURIComponent(String(currentProject.id))}/shot-list`, {
          method: 'POST',
          body: {
            shots,
            listName: projectData.projectName ? `${projectData.projectName} — shots` : 'Shot list',
            eventType: projectData.projectType || 'photo_session',
          },
        });
      } catch (e) {
        console.warn('Failed to sync shot list:', e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [currentProject?.id, projectData.shotList, projectData.projectName, projectData.projectType]);

  // Persist memory card plan once a project exists. Debounced so rapid edits
  // don't spam the API, but unguarded on "already saved once" so every change
  // reaches the backend — previous code stopped persisting after the first
  // save, silently dropping any further user edits.
  useEffect(() => {
    if (!currentProject?.id) return;
    const timer = setTimeout(async () => {
      try {
        const totalGb = Array.isArray(projectData.selectedMemoryCards)
          ? projectData.selectedMemoryCards.reduce((sum: number, c: SelectedMemoryCard) => {
              const cap = parseFloat((c.capacity || '').toString().replace(/[^0-9.]/g, '')) || 0;
              const count = Number(c.count || 1);
              return sum + cap * count;
            }, 0)
          : 0;
        await fetch(`/api/projects/${encodeURIComponent(String(currentProject.id))}/memory-cards`, {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            profession: userProfession,
            labelingScheme: projectData.memoryCardLabeling || memoryCardLabeling,
            totalRequiredGb: totalGb,
            cards: projectData.selectedMemoryCards || [],
            plan: projectData.enhancedMemoryCardSelection || {},
            notes: projectData.equipmentNotes || ''
          })
        });
        memoryPlanSavedRef.current = true;
      } catch (e) {
        console.warn('Failed to persist memory card plan:', e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [currentProject?.id, projectData.selectedMemoryCards, projectData.enhancedMemoryCardSelection, projectData.memoryCardLabeling, projectData.equipmentNotes, userProfession, memoryCardLabeling]);
  
  // Lead import modal states
  const [showLeadImport, setShowLeadImport] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  
  // Navigation - safe hook that works inside and outside Router context
  let navigate: ((path: string, options?: Record<string, unknown>) => void) | null = null;
  try {
    navigate = useNavigate();
  } catch (_navErr) {
    // Hook called outside Router context - this is OK for dialog rendering
    console.debug('Router context unavailable, using fallback navigation:', _navErr);
    navigate = (path: string, options?: Record<string, unknown>) => {
      console.warn('Navigation attempted outside Router context:', path, options);
      // Fallback: use window.location if needed
      if (typeof window !== 'undefined') {
        const hash = (options as Record<string, string>)?.hash || '';
        window.location.href = path + hash;
      }
    };
  }

  // Lead import functionality
  const { availableLeads, isLoadingLeads, importFromLead, isImporting } = useLeadImport();

  // Create worklog entry mutation for culture-specific planning
  const createWorklogMutation = useMutation({
    mutationFn: async (data: WorklogMutationData) => {
      return apiRequest('/api/worklog', {
        method: 'POST',
        body: JSON.stringify(data)
    });
  }
  });

  // ==========================================
  // PROP WIRING — Callbacks for parent integration
  // ==========================================
  useEffect(() => {
    if (selectedProject && selectedProject.id) {
      loadProject(selectedProject.id);
      if (onProjectSelect) onProjectSelect(selectedProject);
    }
  }, [selectedProject, loadProject, onProjectSelect]);

  useEffect(() => {
    if (currentProject && onProjectUpdate) {
      onProjectUpdate(currentProject);
    }
  }, [currentProject, onProjectUpdate]);

  // Wire userId into auth header fallback
  useEffect(() => {
    if (userId) {
      console.debug('ProjectCreation: userId prop available:', userId);
    }
  }, [userId]);

  // ==========================================
  // PROJECT MANAGEMENT TOOLKIT
  // ==========================================
  const handleDuplicateProject = useCallback(async () => {
    if (!currentProject?.id) return;
    setIsCreating(true);
    try {
      const dup = await duplicateProject(currentProject.id, projectData.projectName || 'Copy');
      showSuccessToast(`Prosjekt duplisert: ${dup?.name || 'kopi'}`, 4000);
      trackModalOpen('project_duplicated');
    } catch (err) {
      console.error('Duplicate failed:', err);
      showErrorToast('Kunne ikke duplisere prosjektet');
    } finally {
      setIsCreating(false);
    }
  }, [currentProject, duplicateProject, showSuccessToast, showErrorToast, trackModalOpen]);

  const handleArchiveProject = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      await archiveProject(currentProject.id);
      showSuccessToast('Prosjekt arkivert', 3000);
    } catch (err) {
      console.error('Archive failed:', err);
      showErrorToast('Kunne ikke arkivere prosjektet');
    }
  }, [currentProject, archiveProject, showSuccessToast, showErrorToast]);

  const handleDeleteProject = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      await deleteProject(currentProject.id);
      showSuccessToast('Prosjekt slettet', 3000);
    } catch (err) {
      console.error('Delete failed:', err);
      showErrorToast('Kunne ikke slette prosjektet');
    }
  }, [currentProject, deleteProject, showSuccessToast, showErrorToast]);

  const handleSaveDraft = useCallback(async () => {
    try {
      await saveProjectDraft(currentProject?.id || sessionId, projectData);
      setDraftMode('draft');
      setHasUnsavedChanges(false);
      setProjectHistory(prev => [...prev, { action: 'draft_saved', timestamp: new Date().toISOString(), data: projectData }]);
      showSuccessToast('Utkast lagret', 2000);
    } catch (err) {
      console.error('Draft save failed:', err);
      showErrorToast('Kunne ikke lagre utkast');
    }
  }, [projectData, saveProjectDraft, showSuccessToast, showErrorToast]);

  const handlePublishProject = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      const validated = await validateProjectData(projectData);
      if (!validated) {
        showWarningToast('Prosjektdata er ikke gyldig. Rett opp feil før publisering.');
        return;
      }
      await updateProjectStatus(currentProject.id, 'published');
      setDraftMode('published');
      setPublishedProject(currentProject);
      showSuccessToast('Prosjekt publisert!', 4000);
    } catch (err) {
      console.error('Publish failed:', err);
      showErrorToast('Publisering feilet');
    }
  }, [currentProject, projectData, validateProjectData, updateProjectStatus, showSuccessToast, showWarningToast, showErrorToast]);

  const handleRestoreVersion = useCallback(async (version: VersionEntry) => {
    if (!currentProject?.id) return;
    try {
      await rollbackProjectData(currentProject.id, version.id);
      showSuccessToast('Versjon gjenopprettet', 3000);
      setShowHistoryDialog(false);
    } catch (err) {
      console.error('Restore failed:', err);
      showErrorToast('Kunne ikke gjenopprette versjon');
    }
  }, [currentProject, rollbackProjectData, showSuccessToast, showErrorToast]);

  // ==========================================
  // LOCATION INTELLIGENCE HANDLER
  // ==========================================
  const handleLocationSearch = useCallback(async (query: string) => {
    if (!query || query.length < 3) return;
    setLocationLoading(true);
    try {
      const addresses = await getKartverketAddress(query);
      const places = await searchKartverketPlaceNames(query);
      setLocationSuggestions([...(Array.isArray(addresses) ? addresses : addresses ? [addresses] : []), ...(Array.isArray(places) ? places : places ? [places] : [])]);
    } catch (err) {
      console.warn('Location search failed:', err);
    } finally {
      setLocationLoading(false);
    }
  }, [getKartverketAddress, searchKartverketPlaceNames]);

  const handleLocationSelect = useCallback(async (location: LocationSuggestion) => {
    setSelectedLocation(location);
    setLocationLoading(true);
    try {
      const [analysis, weather, travel, fuel] = await Promise.all([
        analyzeProperty(location.address || location.name || '').catch(() => null),
        getCurrentWeather({ lat: location.lat, lon: location.lng }).catch(() => null),
        calculateTravelCosts({ kilometers: 0, vehicleType: 'car', fuelType: 'gasoline' }).catch(() => null),
        getFuelPrices().catch(() => null),
      ]);
      setLocationAnalysis(analysis);
      setWeatherData(weather);
      setTravelCosts({ ...travel, fuelPrices: fuel });
      const forecast = await getWeatherForecast({ lat: location.lat, lon: location.lng, days: 7 }).catch(() => null);
      if (forecast) setWeatherData((prev: Record<string, unknown> | null) => ({ ...prev, forecast }));

      // Sync location intelligence to Evendi bridge (couple timeline gets weather + travel data)
      if (currentProject?.id && location.lat && location.lng) {
        try {
          await apiRequest(`/api/evendi/weather-location/sync-from-project/${currentProject.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              venueCoordinates: { lat: location.lat, lng: location.lng },
              venueName: location.address || location.name || '',
              locationAnalysis: analysis,
              travelData: { ...travel, fuelPrices: fuel },
            }),
          });
          console.log('📍 Location synced to Evendi bridge');
        } catch (syncErr) {
          console.warn('Evendi location sync skipped:', syncErr);
        }
      }
    } catch (err) {
      console.warn('Location analysis failed:', err);
    } finally {
      setLocationLoading(false);
    }
  }, [analyzeProperty, getCurrentWeather, getWeatherForecast, calculateTravelCosts, getFuelPrices, projectData.eventDate, currentProject?.id]);

  // ==========================================
  // PROJECT SETTINGS & METADATA MANAGEMENT
  // ==========================================
  useEffect(() => {
    if (!currentProject?.id) return;
    const initializeProject = async () => {
      try {
        const [settings_res, metadata, integrations, health, compliance] = await Promise.all([
          Promise.resolve(getProjectSettings(currentProject.id)).catch(() => null),
          Promise.resolve(getProjectMetadata(currentProject.id)).catch(() => null),
          getProjectIntegrations(currentProject.id).catch(() => null),
          checkProjectHealth(currentProject.id).catch(() => null),
          getProjectComplianceReport(currentProject.id).catch(() => null),
        ]);
        if (settings_res) {
          const merged = mergeWithDefaults(settings_res as Partial<Record<string, unknown>>);
          console.debug('Project settings loaded:', merged);
        }
        if (metadata) console.debug('Project metadata:', metadata);
        if (integrations) console.debug('Project integrations:', integrations);
        if (health) console.debug('Project health:', health);
        if (compliance) console.debug('Project compliance:', compliance);

        // Cache project data for offline access
        await Promise.resolve(cacheProjectData(currentProject.id, projectData)).catch(() => null);
      } catch (err) {
        console.warn('Project initialization partial failure:', err);
      }
    };
    initializeProject();
  }, [currentProject?.id, getProjectSettings, getProjectMetadata, getProjectIntegrations, checkProjectHealth, getProjectComplianceReport, cacheProjectData, mergeWithDefaults, userProfession, projectData]);

  // Wire remaining useProject functions into project analytics effect
  useEffect(() => {
    if (!currentProject?.id) return;
    const loadAnalytics = async () => {
      try {
        const [analytics, perf, collaborators, files, comments, backups, permissions, auditTrail, dataVersion] = await Promise.all([
          getProjectAnalytics(currentProject.id).catch(() => null),
          getProjectPerformanceMetrics(currentProject.id).catch(() => null),
          getProjectCollaborators(currentProject.id).catch(() => null),
          getProjectFiles(currentProject.id).catch(() => null),
          getProjectComments(currentProject.id).catch(() => null),
          getProjectBackups(currentProject.id).catch(() => null),
          getProjectPermissions(currentProject.id).catch(() => null),
          getProjectAuditTrail(currentProject.id).catch(() => null),
          getProjectDataVersion(currentProject.id).catch(() => null),
        ]);
        console.debug('Project analytics loaded:', { analytics, perf, collaborators, files, comments, backups, permissions, auditTrail, dataVersion });
      } catch (err) {
        console.warn('Analytics load failed:', err);
      }
    };
    loadAnalytics();
  }, [currentProject?.id, getProjectAnalytics, getProjectPerformanceMetrics, getProjectCollaborators, getProjectFiles, getProjectComments, getProjectBackups, getProjectPermissions, getProjectAuditTrail, getProjectDataVersion]);

  // Wire theme, profession display, and settings management
  useEffect(() => {
    if (!userProfession) return;
    const profTheme = getProfessionTheme(userProfession);
    const compTheme = getComponentTheme('projectCreation');
    const currentSetting = getSetting('projectCreation', 'defaultTemplate');
    const iconUtil = getProfessionIconUtil(userProfession);
    console.debug('Theme & settings:', {
      profTheme,
      compTheme,
      isDarkMode,
      theme: theme?.palette?.mode,
      currentSetting,
      professionDisplayName: getProfessionDisplayName(userProfession),
      professionIcon: getProfessionIcon(userProfession),
      professionIconUtil: iconUtil,
      professionConfig,
      professionsLoading,
      professionConfigsData: professionConfigsData?.professionConfigs,
      professionAdapterData,
      autoSaveStatus,
      projectTypeDetails,
    });
  }, [userProfession, getProfessionTheme, getComponentTheme, getSetting, isDarkMode, theme, getProfessionDisplayName, getProfessionIcon, professionConfig, professionsLoading, professionConfigsData, professionAdapterData, autoSaveStatus, projectTypeDetails]);

  // Wire remaining project management functions into handlers
  const handleProjectSettingsUpdate = useCallback(async (newSettings: Record<string, unknown>) => {
    if (!currentProject?.id) return;
    try {
      await updateProjectSettings(currentProject.id, newSettings);
      await updateProjectMetadata(currentProject.id, { customCategories: [`settings-updated-${new Date().toISOString()}`] });
      await updateSetting('projectCreation', { autoSaveInterval: Date.now() });
      showSuccessToast('Innstillinger oppdatert', 2000);
    } catch (err) {
      console.error('Settings update failed:', err);
      showErrorToast('Kunne ikke oppdatere innstillinger');
    }
  }, [currentProject, updateProjectSettings, updateProjectMetadata, updateSetting, showSuccessToast, showErrorToast]);

  const handleAddCollaborator = useCallback(async (collaboratorEmail: string) => {
    if (!currentProject?.id) return;
    try {
      await addProjectCollaborator(currentProject.id, collaboratorEmail);
      if (onMeetingCreate) {
        onMeetingCreate({
          title: `Samarbeidsmøte: ${projectData.projectName}`,
          participants: [collaboratorEmail],
          projectId: currentProject.id,
        });
      }
      showSuccessToast(`Samarbeidspartner ${collaboratorEmail} lagt til`, 3000);
    } catch (err) {
      console.error('Add collaborator failed:', err);
      showErrorToast('Kunne ikke legge til samarbeidspartner');
    }
  }, [currentProject, projectData.projectName, addProjectCollaborator, onMeetingCreate, showSuccessToast, showErrorToast]);

  const handleUploadFile = useCallback(async (file: File) => {
    if (!currentProject?.id) return;
    try {
      await uploadProjectFile(currentProject.id, file);
      showSuccessToast(`Fil "${file.name}" lastet opp`, 3000);
    } catch (err) {
      console.error('Upload failed:', err);
      showErrorToast('Filopplasting feilet');
    }
  }, [currentProject, uploadProjectFile, showSuccessToast, showErrorToast]);

  const handleAddMilestone = useCallback(async (milestone: MilestoneData) => {
    if (!currentProject?.id) return;
    try {
      await addProjectMilestone(currentProject.id, milestone);
      showSuccessToast('Milepæl lagt til', 2000);
    } catch (err) {
      console.error('Milestone add failed:', err);
    }
  }, [currentProject, addProjectMilestone, showSuccessToast]);

  const handleAddComment = useCallback(async (comment: string) => {
    if (!currentProject?.id) return;
    try {
      await addProjectComment(currentProject.id, comment);
      showSuccessToast('Kommentar lagt til', 2000);
    } catch (err) {
      console.error('Comment add failed:', err);
    }
  }, [currentProject, addProjectComment, showSuccessToast]);

  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const handleCreateBackup = useCallback(async () => {
    if (!currentProject?.id || isCreatingBackup) return;
    setIsCreatingBackup(true);
    try {
      await createProjectBackup(currentProject.id);
      showSuccessToast('Sikkerhetskopi opprettet', 2000);
    } catch (err) {
      console.error('Backup failed:', err);
      showErrorToast('Sikkerhetskopi feilet');
    } finally {
      setIsCreatingBackup(false);
    }
  }, [currentProject, createProjectBackup, showSuccessToast, showErrorToast, isCreatingBackup]);

  const handleSearchProjects = useCallback(async (query: string) => {
    try {
      const results = await searchProjects(query);
      return results;
    } catch (err) {
      console.error('Search failed:', err);
      return [];
    }
  }, [searchProjects]);

  const handleProjectsByDateRange = useCallback(async (start: string, end: string) => {
    try {
      return await getProjectsByDateRange(new Date(start), new Date(end));
    } catch (err) {
      console.error('Date range search failed:', err);
      return [];
    }
  }, [getProjectsByDateRange]);

  const handleSyncOffline = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      await syncProjectOffline(currentProject.id);
      showSuccessToast('Prosjekt synkronisert for frakoblet bruk', 3000);
    } catch (err) {
      console.error('Offline sync failed:', err);
    }
  }, [currentProject, syncProjectOffline, showSuccessToast]);

  const handleIntegrationConnect = useCallback(async (integrationId: string) => {
    if (!currentProject?.id) return;
    const validIntegrations = ['googleDrive', 'googlePhotos', 'weddingTimeline', 'showcase', 'worklog'] as const;
    type IntegrationKey = typeof validIntegrations[number];
    const integrationKey = validIntegrations.includes(integrationId as IntegrationKey) 
      ? (integrationId as IntegrationKey) 
      : null;
    try {
      await connectProjectIntegration(currentProject.id, integrationId, {});
      if (integrationKey) {
        await updateIntegrationStatus(currentProject.id, integrationKey, true);
        const status = getIntegrationStatus(currentProject.id, integrationKey);
        console.debug('Integration status:', status);
      }
      const testResult = await testProjectIntegration(currentProject.id, integrationId);
      console.debug('Integration connected:', { testResult });
      showSuccessToast('Integrasjon tilkoblet', 3000);
    } catch (err) {
      console.error('Integration connect failed:', err);
      showErrorToast('Integrasjon tilkobling feilet');
    }
  }, [currentProject, connectProjectIntegration, updateIntegrationStatus, getIntegrationStatus, testProjectIntegration, showSuccessToast, showErrorToast]);

  const handleIntegrationDisconnect = useCallback(async (integrationId: string) => {
    if (!currentProject?.id) return;
    try {
      await disconnectProjectIntegration(currentProject.id, integrationId);
      showInfoToast('Integrasjon frakoblet', 2000);
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  }, [currentProject, disconnectProjectIntegration, showInfoToast]);

  const handleOptimizeProject = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      await optimizeProjectData(currentProject.id);
      await analyzeProjectData(currentProject.id);
      await cleanupProjectData(currentProject.id);
      const transformed = await transformProjectData(currentProject.id, 'optimized');
      console.debug('Project optimized:', transformed);
      showSuccessToast('Prosjektdata optimalisert', 3000);
    } catch (err) {
      console.error('Optimize failed:', err);
    }
  }, [currentProject, optimizeProjectData, analyzeProjectData, cleanupProjectData, transformProjectData, showSuccessToast]);

  const handleMigrateProject = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      const version = await getProjectDataVersion(currentProject.id);
      if (version) {
        await migrateProjectData(currentProject.id, version, 'latest');
        showInfoToast(`Prosjektdata migrert fra v${version}`, 3000);
      }
    } catch (err) {
      console.error('Migration failed:', err);
    }
  }, [currentProject, getProjectDataVersion, migrateProjectData, showInfoToast]);

  const handleProjectPermissions = useCallback(async (permissions: Record<string, unknown>) => {
    if (!currentProject?.id) return;
    try {
      await setProjectPermissions(currentProject.id, permissions);
      const access = await checkProjectAccess(currentProject.id, userId || user?.id || '', 'manage');
      await auditProjectAccess(currentProject.id);
      console.debug('Permissions set, access:', access);
      showSuccessToast('Tillatelser oppdatert', 2000);
    } catch (err) {
      console.error('Permissions update failed:', err);
    }
  }, [currentProject, setProjectPermissions, checkProjectAccess, auditProjectAccess, userId, user, showSuccessToast]);

  const handleProjectCompliance = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      const isValid = await validateProjectCompliance(currentProject.id, ['GDPR', 'data-retention']);
      const report = await getProjectComplianceReport(currentProject.id);
      if (!isValid) {
        await updateProjectCompliance(currentProject.id, { status: 'needs_review' });
      }
      console.debug('Compliance check:', { isValid, report });
      return { isValid, report };
    } catch (err) {
      console.error('Compliance check failed:', err);
      return null;
    }
  }, [currentProject, validateProjectCompliance, getProjectComplianceReport, updateProjectCompliance]);

  // Wire remaining project context functions
  const handleRefreshProjectCache = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      await invalidateProjectCache(currentProject.id);
      await refreshProjectCache(currentProject.id);
      const cached = await getCachedProjectData(currentProject.id);
      console.debug('Cache refreshed:', !!cached);
      showInfoToast('Cache oppdatert', 2000);
    } catch (err) {
      console.warn('Cache refresh failed:', err);
    }
  }, [currentProject, invalidateProjectCache, refreshProjectCache, getCachedProjectData, showInfoToast]);

  const handleGetDraft = useCallback(async () => {
    try {
      const draft = await getProjectDraft(sessionId);
      if (draft) {
        setProjectData(prev => ({ ...prev, ...draft }));
        showInfoToast('Utkast hentet', 2000);
      }
    } catch (err) {
      console.warn('Draft fetch failed:', err);
    }
  }, [sessionId, getProjectDraft, showInfoToast]);

  const handleDeleteDraft = useCallback(async () => {
    try {
      await deleteProjectDraft(sessionId);
      showInfoToast('Utkast slettet', 2000);
    } catch (err) {
      console.warn('Draft delete failed:', err);
    }
  }, [sessionId, deleteProjectDraft, showInfoToast]);

  // Wire real-time session management
  const handleCreateCollabSession = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      const session = await createSession({ name: `Project ${currentProject.id}`, type: 'project' });
      console.debug('Collaboration session created:', session);
      showSuccessToast('Samarbeidsøkt opprettet', 3000);
    } catch (err) {
      console.error('Session creation failed:', err);
    }
  }, [currentProject, createSession, showSuccessToast]);

  const handleJoinSession = useCallback(async (sessionId_join: string) => {
    try {
      await joinSession(sessionId_join);
      showInfoToast('Ble med i samarbeidsøkt', 2000);
    } catch (err) {
      console.error('Join session failed:', err);
    }
  }, [joinSession, showInfoToast]);

  const handleLeaveSession = useCallback(async () => {
    try {
      await leaveSession();
      showInfoToast('Forlot samarbeidsøkt', 2000);
    } catch (err) {
      console.error('Leave session failed:', err);
    }
  }, [leaveSession, showInfoToast]);

  // Wire worklog creation with callback prop
  const handleWorklogSubmit = useCallback(async () => {
    try {
      const phase = PROJECT_PHASES[worklogFormData.projectPhase];
      const template = generateWorklogTemplate(
        userProfession,
        worklogFormData.projectPhase,
        worklogFormData.category,
        projectData.projectType,
        projectData.weddingCulture
      );
      const entry = {
        ...worklogFormData,
        ...template,
        projectId: currentProject?.id,
        userId: userId || user?.id,
        profession: userProfession,
        phaseName: phase?.name || worklogFormData.projectPhase,
        phaseColor: phase?.color || '#666',
      };
      await createWorklogMutation.mutateAsync(entry);
      if (onWorklogCreate) onWorklogCreate(entry);
      setShowWorklogTipsDialog(false);
      showSuccessToast('Arbeidstid registrert', 3000);
    } catch (err) {
      console.error('Worklog submit failed:', err);
      showErrorToast('Kunne ikke registrere arbeidstid');
    }
  }, [worklogFormData, userProfession, projectData, currentProject, userId, user, createWorklogMutation, onWorklogCreate, showSuccessToast, showErrorToast]);

  // Lead import handler
  const handleImportLead = useCallback(async (lead: { id: string; clientName: string; clientEmail?: string; clientPhone?: string; projectType: string; location?: string; culture?: string; specialRequests?: string }) => {
    try {
      await importFromLead(lead.id);
      setProjectData(prev => ({
        ...prev,
        clientName: lead.clientName || prev.clientName,
        clientEmail: lead.clientEmail || prev.clientEmail,
        clientPhone: lead.clientPhone || prev.clientPhone,
        description: lead.specialRequests || prev.description,
      }));
      setShowLeadImport(false);
      showSuccessToast('Lead importert til prosjekt', 3000);
    } catch (err) {
      console.error('Lead import failed:', err);
      showErrorToast('Import av lead feilet');
    }
  }, [importFromLead, showSuccessToast, showErrorToast]);

  // Memory card configuration helpers
  const memoryCardRecommendation = useMemo(() => {
    const engine = new MemoryCardRecommendationEngine();
    const cardTypes = getMemoryCardTypesByProfession(memoryCardProfession);
    const cameras = userProfession === 'videographer'
      ? getCamerasByProfession(userProfession)
      : getPhotoCamerasByProfession(userProfession);
    const config: MemoryCardSelectorConfig = {
      capacity: projectData.selectedMemoryCards?.[0]?.capacity || '64GB',
      count: projectData.selectedMemoryCards?.length || 1,
      estimatedPhotos: { raw: 1500, craw: 3000 },
    };
    const totalCost = projectData.selectedMemoryCards?.reduce((sum: number, card: SelectedMemoryCard & { price?: number }) => {
      const formattedPrice = formatCurrency(card.price || 0, 'NOK');
      console.debug('Card price:', formattedPrice);
      return sum + (card.price || 0);
    }, 0) || 0;
    return { engine, cardTypes, cameras, config, totalCost };
  }, [userProfession, projectData.selectedMemoryCards]);

  // Cultural day explanation handler
  const handleOpenCulturalDayExplanation = useCallback((culture: string, dayName: string) => {
    const explanation = CULTURAL_DAY_EXPLANATIONS[culture]?.[dayName] || '';
    setCultureDayDialog({ open: true, culture, day: dayName, explanation });
    trackModalOpen('cultural_day_explanation');
  }, [trackModalOpen]);

  // Wire unsaved changes tracking
  useEffect(() => {
    if (projectData.projectName || projectData.clientName) {
      setHasUnsavedChanges(true);
    }
  }, [projectData.projectName, projectData.clientName, projectData.projectType]);

  // Wire evendi traditions bridge display
  const traditionsInfo = useMemo(() => {
    if (!evendiTraditionsBridge) return null;
    return {
      culturalType: evendiTraditionsBridge.primaryCulturalType,
      traditions: evendiTraditionsBridge.traditions || [],
      displayName: WEDDING_CULTURES[evendiTraditionsBridge.primaryCulturalType as keyof typeof WEDDING_CULTURES]?.name || '',
    };
  }, [evendiTraditionsBridge]);

  // Wire show preview toggle
  const handleTogglePreview = useCallback(() => {
    setShowPreview(prev => !prev);
    trackModalOpen('project_preview');
  }, [trackModalOpen]);

  // Wire memory card labeling change
  const handleLabelingChange = useCallback((scheme: LabelingKey) => {
    setMemoryCardLabeling(scheme);
    const labels = LABELING_SCHEMES[scheme];
    setProjectData(prev => ({
      ...prev,
      memoryCardLabeling: scheme,
      memoryCardConfigs: prev.memoryCardConfigs.map((c: MemoryCardConfig, i: number) => ({
        ...c,
        label: labels[i % labels.length],
      })),
    }));
  }, []);
  
  /**
   * Open Video Editor (StoryArcStudio) with project context
   */
  const handleOpenVideoEditor = useCallback(() => {
    // Track feature usage
    features.trackFeatureUsage('video-editor-integration','opened_from_project', {
      profession: userProfession,
      userId: user?.id,
      projectName: projectData.projectName,
      projectType: projectData.projectType,
      phase: projectData.currentPhase,
      timestamp: new Date().toISOString()
    });
    
    // Validate project data
    if (!projectData.projectName || !projectData.clientName) {
      showErrorToast('Please complete project name and client name before opening the video editor', 5000);
      return;
    }
    
    // Prepare data for StoryArcStudio
    const editorData: ProjectToEditorData = {
      projectId: currentProject?.id || `temp-${Date.now()}`,
      projectName: projectData.projectName,
      clientName: projectData.clientName,
      clientEmail: projectData.clientEmail,
      projectType: projectData.projectType,
      weddingCulture: projectData.weddingCulture,
      shotList: projectData.shotList.map((shot: ShotListItem) => ({
        id: shot.id || `shot-${shot.scene}`,
        scene: shot.scene,
        description: shot.description,
        duration: shot.estimatedDuration,
        priority: (shot.priority || 'nice_to_have') as 'must_have, ' | 'nice_to_have' | 'optional'
      })),
      timelineEvents: projectData.createWeddingTimeline ? ([] as Array<{ time: string; title: string; type: string; location?: string; duration?: number }>) : undefined, // Would fetch from timeline
      googleDriveFolderId: undefined, // Drive folder ID is determined after project creation
      memoryCardConfigs: projectData.memoryCardConfigs,
      primaryCamera: projectData.primaryCamera,
      backupCamera: projectData.backupCamera,
      logFormat: projectData.logFormat,
      returnCallback: handleVideoEditorComplete
    };
    
    // Show loading toast
    showInfoToast('Opening Video Editor with project data...', 2000);
    
    // Navigate to StoryArcStudio with project context
    navigate('/story-arc-studio', { state: editorData });
  }, [projectData, currentProject, user, userProfession, features, navigate, showInfoToast, showErrorToast]);
  
  /**
   * Handle video editor completion and return
   */
  const handleVideoEditorComplete = useCallback(async (result: EditorToProjectResult) => {
    try {
      showInfoToast('Processing video editor results...', 2000);
      
      // Create worklog entry for editing work
      await createWorklogMutation.mutateAsync({
        projectId: currentProject?.id,
        userId: user?.id,
        ...result.worklogEntry,
        artifacts: [result.videoUrl],
        metadata: {
          clipCount: result.clipCount,
          transitionCount: result.transitionCount,
          usedAI: result.usedAI,
          aiConfidence: result.aiConfidence,
          culturalMoments: result.culturalMoments,
          appliedLUTs: result.appliedLUTs,
          exportSettings: result.exportSettings
        }
      });
      
      // Update project status to completed
      if (currentProject?.id) {
        await updateProject(currentProject.id, {
          status: 'completed',
          description: `${currentProject.description || ''}\n\nVideo completed: ${result.videoUrl}`
        });
      }

      // Emit real-time event
      if (isConnected) {
        emitEvent('status_changed', {
          projectId: currentProject?.id,
          status: 'video_completed',
          videoUrl: result.videoUrl,
          duration: result.duration,
          timestamp: new Date().toISOString()
        });
      }
      
      // Show success notification
      showSuccessToast(
        `Video editing completed! ${result.clipCount} clips edited in ${Math.round(result.editingTime / 60)} hours. Video saved to project.`,
        6000
      );
      
      // Track completion
      features.trackFeatureUsage('video-editor-integration','completed', {
        profession: userProfession,
        userId: user?.id,
        projectId: currentProject?.id,
        duration: result.duration,
        clipCount: result.clipCount,
        usedAI: result.usedAI,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error processing video editor results:', error);
      showErrorToast('Failed to save video editor results. Please try again.', 6000);
    }
  }, [currentProject, user, createWorklogMutation, updateProject, isConnected, emitEvent, showSuccessToast, showErrorToast, showInfoToast, features, userProfession]);
  
  /**
   * Check if video editor is available for this project
   */
  const canOpenVideoEditor = useMemo(() => {
    const isVideoProject = projectData.projectType === 'video' ||
                          projectData.projectType === 'wedding' ||
                          userProfession === 'videographer' ||
                          userProfession === 'enterprise';
    const hasBasicInfo = projectData.projectName && projectData.clientName;
    const isPostProduction = projectData.currentPhase === 'post-production' || projectData.currentPhase === 'production';

    return isVideoProject && hasBasicInfo && isPostProduction;
  }, [projectData, userProfession]);

  /**
   * Check if Virtual Studio is available for this project
   * Requirements:
   * - User must be a photographer
   * - Project type must NOT be wedding
   * - User must have purchased Virtual Studio from marketplace (2495 NOK)
   */
  const canOpenVirtualStudio = useMemo(() => {
    const isPhotographer = userProfession === 'photographer' || userProfession === 'enterprise';
    const isNonWeddingProject = projectData.projectType !== 'wedding';
    const hasBasicInfo = projectData.projectName && projectData.clientName;

    // Check if user has Virtual Studio marketplace access
    const { hasAccess } = features.checkFeatureAccess('virtual-studio', userProfession);

    return isPhotographer && isNonWeddingProject && hasBasicInfo && hasAccess;
  }, [projectData, userProfession, features]);

  /**
   * Open Virtual Studio with project context
   */
  const handleOpenVirtualStudio = useCallback(() => {
    // Track feature usage
    features.trackFeatureUsage('virtual-studio','opened_from_project', {
      profession: userProfession,
      userId: user?.id,
      projectId: currentProject?.id,
      projectType: projectData.projectType,
      timestamp: new Date().toISOString()
    });

    // Prepare Virtual Studio data from project
    const virtualStudioData = {
      projectId: currentProject?.id,
      projectName: projectData.projectName,
      projectType: projectData.projectType,
      clientName: projectData.clientName,
      cameraSetup: {
        primary: projectData.primaryCamera,
        backup: projectData.backupCamera,
        logFormat: projectData.logFormat
      },
      scenes: projectData.shotList?.map((shot: ShotListItem) => ({
        name: shot.scene || shot.description,
        description: shot.description,
        duration: shot.estimatedDuration || 30,
        shotType: shot.shotType,
        notes: shot.notes
      })) || [],
      location: projectData.location,
      eventDate: projectData.eventDate,
      returnCallback: handleVirtualStudioComplete
    };

    // Show loading toast
    showInfoToast('Opening Virtual Studio with project data...', 2000);

    // Navigate to Virtual Studio with project context
    navigate('/virtual-studio', { state: virtualStudioData });
  }, [projectData, currentProject, user, userProfession, features, navigate, showInfoToast]);

  /**
   * Handle Virtual Studio completion and return
   */
  const handleVirtualStudioComplete = useCallback(async (result: VirtualStudioResult) => {
    try {
      showInfoToast('Processing Virtual Studio results...', 2000);

      // Create worklog entry for pre-visualization work
      await createWorklogMutation.mutateAsync({
        projectId: currentProject?.id,
        userId: user?.id,
        taskName: 'Virtual Studio Pre-visualization',
        description: `Created ${result.sceneCount} scenes with lighting setup and camera paths`,
        hoursSpent: result.workTime / 60,
        status: 'completed',
        artifacts: result.renderUrls || [],
        metadata: {
          sceneCount: result.sceneCount,
          cameraPathCount: result.cameraPathCount,
          renderCount: result.renderCount,
          exportedFormats: result.exportedFormats
        }
      });

      // Update project description with Virtual Studio data
      if (currentProject?.id) {
        await updateProject(currentProject.id, {
          description: `${currentProject.description || ''}\n\nVirtual Studio: ${result.sceneCount} scenes created`
        });
      }

      // Emit real-time event
      if (isConnected) {
        emitEvent('status_changed', {
          projectId: currentProject?.id,
          status: 'virtual_studio_completed',
          sceneCount: result.sceneCount,
          timestamp: new Date().toISOString()
        });
      }

      // Show success notification
      showSuccessToast(
        `Virtual Studio pre-visualization completed! ${result.sceneCount} scenes created.`,
        6000
      );

      // Track completion
      features.trackFeatureUsage('virtual-studio', 'completed', {
        profession: userProfession,
        userId: user?.id,
        projectId: currentProject?.id,
        sceneCount: result.sceneCount,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error processing Virtual Studio results:', error);
      showErrorToast('Failed to save Virtual Studio results. Please try again.', 6000);
    }
  }, [currentProject, user, createWorklogMutation, updateProject, isConnected, emitEvent, showSuccessToast, showErrorToast, showInfoToast, features, userProfession]);

  // Show initial data notification if pre-filled from submission
  useEffect(() => {
    if (initialData) {
      showInfoToast(`Project pre-filled from submission: ${initialData.clientName}`, 3000);
    }
  }, [initialData]);

  const buildEventPayload = () => {
    const start = projectData?.eventDate || (projectData?.eventDates ? Object.values(projectData.eventDates)[0] : '');
    const end = projectData?.eventDate || (projectData?.eventDates ? Object.values(projectData.eventDates).slice(-1)[0] : '');
    const audience = profession === 'vendor' ? 'B2B' : 'Mixed';
    const venueName = projectData?.venue || projectData?.location || '';
    return {
      name: projectData?.projectName || 'Event',
      description: projectData?.description || '',
      type: 'conference',
      status: 'planning',
      startDate: start,
      endDate: end || start,
      venue: {
        name: venueName,
        address: venueName,
        city: '',
        country: 'Norge',
        capacity: parseInt(projectData?.guestCount || '0') || 0,
        type: 'physical'
      },
      target: {
        audience,
        segments: [],
        expectedAttendees: parseInt(projectData?.guestCount || '0') || 0,
        geography: ['Norge']
      },
      client: {
        name: projectData?.clientName || ', ',
        email: projectData?.clientEmail || ', ',
        phone: projectData?.clientPhone || ', '
      },
      source: 'project_creation',
    };
  };

  const handleOpenEventManagementClick = async () => {
    const payload = buildEventPayload();
    if (onOpenEventManagement) {
      onOpenEventManagement(payload);
      showSuccessToast('Åpner Event Management med prosjektdata...', 3000);
      return;
    }
    // Fallback: create event directly
    try {
      const res = await fetch('/api/events-management/events', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to create event');
      showSuccessToast('Event opprettet fra prosjektdata', 4000);
    } catch (eventErr) {
      console.error('Event creation failed:', eventErr);
      showErrorToast('Kunne ikke opprette event fra prosjekt', 5000);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: '1200px', mx: 'auto' }}>
      {initialData && (
        <Alert severity="info" sx={{ 
          mb: 3, 
          borderRadius: 2,
          borderLeft: `4px solid ${theming.colors.primary}`,
          backgroundColor: `${theming.colors.primary}08`
        }}>
          <Typography variant="body2" fontWeight={700} sx={{ color: theming.colors.primary }}>
            📨 {initialData.clientName} fra innsending
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'text.secondary' }}>
            Kundeinfo er forhåndsutfylt. Fullfør de gjenværende feltene.
          </Typography>
        </Alert>
      )}
      
      {/* Existing client (Google Contacts) picker */}
      <Card sx={{ 
        mt: 0, 
        mb: 3,
        borderRadius: 3,
        border: '1px solid #e0e0e0',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
        background: '#fafbfc',
        transition: 'box-shadow 0.2s ease-in-out',
        '&:hover': {
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
        }
      }}>
        <CardContent sx={{ pb: 2.5 }}>
          <Typography 
            variant="h6" 
            gutterBottom 
            sx={{ 
              fontWeight: 700, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              color: theming.colors.primary,
              mb: 2
            }}
          >
            <People sx={{ fontSize: 28 }} /> Velg kontakt
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 50%' } }}>
              <Autocomplete
                options={contactOptions}
                getOptionLabel={(o: ContactOption) => o?.displayName || o?.email || ''}
                onInputChange={(_: React.SyntheticEvent, val: string) => setContactQuery(val)}
                onChange={(_: React.SyntheticEvent, val: ContactOption | null) => setSelectedContact(val)}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Søk navn eller e-post" 
                    placeholder="Skriv for å søke..." 
                    size="small"
                    sx={{
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.95)', fontWeight: 600 },
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#1565c0', borderWidth: 1.5 },
                        '&:hover fieldset': { borderColor: '#0d47a1' },
                        '&.Mui-focused fieldset': { borderColor: '#1565c0', borderWidth: 2 }
                      },
                      '& .MuiInputBase-input': { color: 'rgba(255,255,255,0.95)', fontWeight: 500 },
                      '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.70)', opacity: 1 }
                    }}
                  />
                )}
              />
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 25%' } }}>
              <TextField
                label="E-post"
                value={projectData.clientEmail}
                fullWidth
                size="small"
                slotProps={{ input: { readOnly: true } }}
                sx={{
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.95)', fontWeight: 600 },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#1565c0', borderWidth: 1.5 },
                    '&:hover fieldset': { borderColor: '#0d47a1' },
                    '&.Mui-focused fieldset': { borderColor: '#1565c0', borderWidth: 2 }
                  },
                  '& .MuiInputBase-input': { color: 'rgba(255,255,255,0.95)', fontWeight: 500 }
                }}
              />
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 25%' } }}>
              <Button
                variant="outlined"
                fullWidth
                size="small"
                onClick={async () => {
                  try {
                    const name = projectData.clientName || projectData.clientEmail;
                    const [firstName, ...rest] = (name || '').split(',');
                    const lastName = rest.join('');
                    const email = projectData.clientEmail;
                    const phone = projectData.clientPhone || ', ';
                    if (!email) {
                      showErrorToast('Mangler e-post for å legge til kontakt');
                      return;
                    }
                    // Search existing
                    const searchRes = await fetch(`/api/google/people/search-contacts?q=${encodeURIComponent(email)}`);
                    let exists = false;
                    if (searchRes.ok) {
                      const contacts = await searchRes.json();
                      const found = contacts.find((c: ContactOption) => c.email?.toLowerCase() === email.toLowerCase());
                      exists = !!found;
                    }
                    if (exists) {
                      showInfoToast('Kontakt finnes allerede i Google Kontakter');
                      return;
                    }
                    const createRes = await fetch('/api/google/people/create-contact', {
                      method: 'POST',
                      headers: { 'Content-Type' : 'application/json' },
                      body: JSON.stringify({
                        firstName: firstName || '-',
                        lastName: lastName || '-',
                        email,
                        phone,
                        profession,
                        companyName: ', '
                      })
                    });
                    if (!createRes.ok) throw new Error('Create contact failed');
                    showSuccessToast('Kontakt lagt til i Google Kontakter');
                  } catch (contactErr) {
                    console.error('Failed to add contact:', contactErr);
                    showErrorToast('Kunne ikke legge til kontakt');
                  }
                }}
              >
                Legg til i Kontakter
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Wedding Timeline Status */}
      {projectData.projectType === 'wedding' && (
        <Card sx={{ 
          mt: 0, 
          mb: 3,
          borderRadius: 3,
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
          background: '#fafbfc',
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
          }
        }}>
          <CardContent>
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                fontWeight: 700, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: theming.colors.primary,
                mb: 2
              }}
            >
              <Favorite sx={{ fontSize: 28, color: '#e91e63' }} /> Bryllupstidslinje
            </Typography>
            {projectData.createWeddingTimeline ? (
              projectData.weddingTimelineShared ? (
                <Box>
                  <Typography variant="body2">
                    Tidslinje delt til {projectData.clientEmail || 'kunde'}
                  </Typography>
                  {projectData.weddingTimelineUrl && (
                    <Typography variant="caption" color="primary" display="block">
                      URL: {projectData.weddingTimelineUrl}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Tidslinje er opprettet, men ikke delt til kunde.
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => {
                      setProjectData(prev => ({ ...prev, weddingTimelineShared: true }));
                      showSuccessToast(`Tidslinje delt til ${projectData.clientEmail || 'kunde'}`);
                    }}
                  >
                    Del med kunde ({projectData.clientEmail || '—'})
                  </Button>
                </Box>
              )
            ) : (
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: 'rgba(255,255,255,0.95)', fontWeight: 500 }}>
                  Ingen bryllupstidslinje. Opprett i Wedding Timeline Administration.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setProjectData(prev => ({ ...prev, createWeddingTimeline: true }));
                      showInfoToast('Bryllupstidslinje markert for opprettelse');
                    }}
                  >
                    Marker for opprettelse
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => {
                      try {
                        communication.sendMessage({
                          from: 'project-creation',
                          to: 'all',
                          type: 'navigate:wedding-timeline',
                          data: {
                            projectName: projectData.projectName,
                            clientEmail: projectData.clientEmail,
                            eventDate: projectData.eventDate,
                            eventDates: projectData.eventDates,
                            location: projectData.location,
                            guestCount: projectData.guestCount,
                          },
                          priority: 'medium'
                        });
                      } catch (commErr) {
                        console.debug('Communication message skipped:', commErr);
                      }
                      showInfoToast('Åpner Wedding Timeline Admin (via dashboard)');
                    }}
                  >
                    Åpne Wedding Timeline Admin
                  </Button>
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Event Timeline (for non-wedding events) */}
      {projectData.projectType === 'event' && (
        <Card sx={{ 
          mt: 3, 
          mb: 3,
          borderRadius: 3,
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
          background: '#fafbfc',
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
          }
        }}>
          <CardContent>
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                fontWeight: 700, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: theming.colors.primary,
                mb: 2
              }}
            >
              <Event sx={{ fontSize: 28 }} /> Event-tidslinje
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Rediger og planlegg tidslinjen for arrangementet.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={() => {
                  try {
                    communication.sendMessage({
                      from: 'project-creation',
                      to: 'all',
                      type: 'navigate:event-timeline',
                      data: {
                        projectName: projectData.projectName,
                        clientEmail: projectData.clientEmail,
                        eventDate: projectData.eventDate,
                        location: projectData.location,
                        guestCount: projectData.guestCount,
                        projectType: projectData.projectType,
                        draft: !currentProject?.id,
                        projectId: currentProject?.id || null,
                      },
                      priority: 'medium'
                    });
                  } catch (commErr) {
                    console.debug('Communication message skipped:', commErr);
                  }
                  showInfoToast('Åpner Event Timeline (via dashboard)');
                }}
              >
                Åpne tidslinje-redigering
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}
      
      {/* Contact & Project Info Summary */}
        <Card sx={{ 
          mt: 3, 
          mb: 3,
          borderRadius: 3,
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
          background: '#fafbfc',
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
          }
        }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, color: '#1565c0', fontSize: '1rem' }}>
            Kontakt & Prosjekt-info
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: 'rgba(255,255,255,0.95)', mb: 0.5 }}>Prosjekt</Typography>
              <Typography variant="body2" display="block" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, lineHeight: 1.8 }}>
                Project ID: {currentProject?.id || 'Ikke opprettet enda'}
              </Typography>
              {!currentProject?.id && (
                <Typography variant="body2" display="block" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500, lineHeight: 1.8 }}>
                  Draft ID: {sessionId}
                </Typography>
              )}
              <Typography variant="body2" display="block" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, lineHeight: 1.8 }}>
                Gjester: {projectData.guestCount || '-'}
              </Typography>
              <Typography variant="body2" display="block" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, lineHeight: 1.8 }}>
                Dato: {projectData.eventDate || '-'}
              </Typography>
              {projectData.eventDates && Object.keys(projectData.eventDates).length > 0 && (
                <Typography variant="body2" display="block" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, lineHeight: 1.8 }}>
                  Datoer: {Object.keys(projectData.eventDates)
                    .sort((a, b) => Number(a) - Number(b))
                    .map((k) => projectData.eventDates[Number(k)])
                    .join(', ')}
                </Typography>
              )}
              <Typography variant="body2" display="block" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, lineHeight: 1.8 }}>
                Lokasjon: {projectData.location || '-'}
              </Typography>
              <Typography variant="body2" display="block" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, lineHeight: 1.8 }}>
                Prosjekttype: {projectData.projectType || '-'}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: 'rgba(255,255,255,0.95)', mb: 0.5 }}>Kontakt</Typography>
              <Typography variant="body2" display="block" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, lineHeight: 1.8 }}>
                Navn: {selectedContact?.displayName || projectData.clientName || '-'}
              </Typography>
              <Typography variant="body2" display="block" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, lineHeight: 1.8 }}>
                E-post: {selectedContact?.email || projectData.clientEmail || '-'}
              </Typography>
              <Typography variant="body2" display="block" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, lineHeight: 1.8 }}>
                Telefon: {selectedContact?.phone || projectData.clientPhone || '-'}
              </Typography>
              {(selectedContact?.companyName) && (
                <Typography variant="body2" display="block" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 500, lineHeight: 1.8 }}>
                  Firma: {selectedContact.companyName}
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Pre-filled Data Preview */}
      {initialData && (
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          bgcolor: 'rgba(21, 101, 192, 0.08)',
          borderRadius: 3, 
          border: '1px solid rgba(21, 101, 192, 0.2)',
          background: 'linear-gradient(135deg, rgba(21, 101, 192, 0.08) 0%, rgba(21, 101, 192, 0.04) 100%)'
        }}>
          <Typography variant="subtitle2" gutterBottom fontWeight={700} sx={{ color: '#1565c0' }}>
            Forhåndsutfylt fra innsending:
          </Typography>
          <Stack spacing={1}>
            {initialData.clientName && (
              <Typography variant="body2">
                <strong>Client:</strong> {initialData.clientName}
              </Typography>
            )}
            {initialData.clientEmail && (
              <Typography variant="body2">
                <strong>Email:</strong> {initialData.clientEmail}
              </Typography>
            )}
            {initialData.projectType && (
              <Typography variant="body2">
                <strong>Project Type:</strong> {initialData.projectType}
              </Typography>
            )}
            {initialData.description && (
              <Typography variant="body2">
                <strong>Description:</strong> {initialData.description}
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      {/* Connect to Event Management prompt */}
      <Dialog 
        open={connectDialogOpen} 
        onClose={() => { setConnectDialogOpen(false); setAskedConnectEvent(true); }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: '#0f0a07',
            color: 'rgba(255,255,255,0.95)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
            // Card-flater inni modalen — overstyrer hvit default
            '& .MuiCard-root, & .MuiPaper-root[class*="elevation"]': {
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.95)',
            },
          }
        }}
      >
        <DialogTitle sx={{ 
          background: '#1565c0', 
          color: 'white', 
          fontWeight: 700,
          fontSize: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pt: 3,
          pb: 2
        }}>
          Koble til Event Management?
          <IconButton
            onClick={() => { setConnectDialogOpen(false); setAskedConnectEvent(true); }}
            sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography variant="body2">
            Du har valgt prosjekttypen «event». Vil du koble dette prosjektet til Event Management for planlegging og analyser?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            variant="outlined"
            onClick={() => { setConnectDialogOpen(false); setAskedConnectEvent(true); setConnectToEvent(false); }}
            sx={{ borderColor: '#1565c0', color: '#1565c0' }}
          >
            Nei
          </Button>
          <Button 
            variant="contained" 
            onClick={() => { setConnectDialogOpen(false); setAskedConnectEvent(true); setConnectToEvent(true); }}
            sx={{ bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' } }}
          >
            Ja, koble
          </Button>
        </DialogActions>
      </Dialog>

      {/* Video Editor Integration Button */}
      {canOpenVideoEditor && (
        <Card sx={{ mt: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                <MovieCreation sx={{ fontSize: 32 }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={600}>
                  Video Editor Ready
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Open AI-powered video editor with project context, shot list, and cultural awareness
                </Typography>
                {projectData.shotList?.length > 0 && (
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 0.5 }}>
                    📋 {projectData.shotList.length} shots planned • 🌍 {projectData.weddingCulture || 'Standard'} context
                  </Typography>
                )}
              </Box>
              <Button
                variant="contained"
                size="large"
                startIcon={<MovieCreation />}
                onClick={handleOpenVideoEditor}
                sx={{
                  bgcolor: 'white',
                  color: '#667eea',
                  fontWeight: 600,
                  px: 3, '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.9)'
                  }
                }}
              >
                Open Video Editor
              </Button>
            </Stack>
            
            {/* Feature highlights */}
            <Stack direction="row" spacing={2} sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <Chip 
                label="AI Story Generation" 
                size="small" 
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip 
                label="15 Transitions" 
                size="small" 
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip 
                label="Auto-Captions" 
                size="small" 
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip 
                label="Beat Sync" 
                size="small" 
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip 
                label="Cultural LUTs" 
                size="small" 
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
            </Stack>
          </CardContent>
        </Card>
      )}
      
      {/* Video Editor Info Card for non-qualifying projects */}
      {!canOpenVideoEditor && (projectData.projectType === 'video' || userProfession === 'videographer') && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight={600}>
            📽️ Video Editor Available in Post-Production Phase
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
            Complete project details and enter post-production phase to access the AI-powered video editor with transitions, auto-captions, and cultural context.
          </Typography>
        </Alert>
      )}

      {/* Virtual Studio Integration Button (Photographers only, non-wedding projects) */}
      {canOpenVirtualStudio && (
        <Card sx={{ mt: 3, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
                <Lightbulb sx={{ fontSize: 32 }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={600}>
                  Virtual Studio Ready
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  3D lighting preview, studio setup planning, and camera path visualization
                </Typography>
                {projectData.shotList?.length > 0 && (
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 0.5 }}>
                    📋 {projectData.shotList.length} shots planned • 📸 {projectData.primaryCamera || 'Camera setup'}
                  </Typography>
                )}
              </Box>
              <Button
                variant="contained"
                size="large"
                startIcon={<Lightbulb />}
                onClick={handleOpenVirtualStudio}
                sx={{
                  bgcolor: 'white',
                  color: '#f5576c',
                  fontWeight: 600,
                  px: 3, '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.9)'
                  }
                }}
              >
                Open Virtual Studio
              </Button>
            </Stack>

            {/* Feature highlights */}
            <Stack direction="row" spacing={2} sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <Chip
                label="3D Lighting Preview"
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip
                label="627 LUTs"
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip
                label="Camera Paths"
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip
                label="HDRI Environments"
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip
                label="AI Analysis"
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Virtual Studio Info Card - Show marketplace offer for photographers without access */}
      {(userProfession === 'photographer' || userProfession === 'enterprise') &&
       projectData.projectType !== 'wedding' &&
       projectData.projectName &&
       projectData.clientName &&
       !features.checkFeatureAccess('virtual-studio', userProfession).hasAccess && (
        <Alert
          severity="info"
          sx={{
            mt: 2,
            background: 'linear-gradient(135deg, rgba(240, 147, 251, 0.1) 0%, rgba(245, 87, 108, 0.1) 100%)',
            border: '1px solid rgba(245, 87, 108, 0.3)'
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            💡 Virtual Studio Available in Marketplace
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 0.5, mb: 1 }}>
            Pre-visualize your shoots with 3D lighting, camera paths, and professional equipment catalog. Perfect for {projectData.projectType} projects!
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label="2495 NOK"
              size="small"
              color="primary"
              sx={{ fontWeight: 600}}
            />
            <Chip
              label="14-day trial"
              size="small"
              variant="outlined"
            />
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={() => navigate('/marketplace')}
              sx={{ ml: 'auto' }}
            >
              View in Marketplace
            </Button>
          </Stack>
        </Alert>
      )}

      {/* Evendi Photo Shots Bridge — Show couple's photo wishes from Evendi */}
      {evendiPhotoShotsBridge && evendiPhotoShotsBridge.shots.length > 0 && (
        <Card sx={{ mt: 3, background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'rgba(255,255,255,0.95)' }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: 'rgba(0,0,0,0.1)', width: 56, height: 56 }}>
                <CameraAlt sx={{ fontSize: 32, color: 'rgba(255,255,255,0.95)' }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={600}>
                  📸 Parets fotoliste fra Evendi
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  {evendiPhotoShotsBridge.coupleName} har {evendiPhotoShotsBridge.totalShots} ønskede bilder
                  {evendiPhotoShotsBridge.completedShots > 0 && ` (${evendiPhotoShotsBridge.completedShots} allerede tatt)`}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
                  Automatisk importert i din shotliste — par og fotograf ser den samme planen
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                onClick={pushShotsToCouple}
                disabled={!projectData.shotList?.filter((s) => !s.id?.startsWith('evendi-')).length}
                sx={{
                  bgcolor: 'rgba(0,0,0,0.15)',
                  color: 'rgba(255,255,255,0.95)',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.25)' },
                }}
              >
                Synk tilbake
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
              {['Ceremony','Portraits','Group Photos','Details','Reception']
                .map(scene => {
                  const count = evendiPhotoShotsBridge.shots.filter((s) => s.scene === scene).length;
                  return count > 0 ? (
                    <Chip
                      key={scene}
                      label={`${scene}: ${count}`}
                      size="small"
                      sx={{ bgcolor: 'rgba(0,0,0,0.1)', color: 'rgba(255,255,255,0.95)', fontWeight: 500 }}
                    />
                  ) : null;
                })
                .filter(Boolean)}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Project Type Selection with Dynamic Types */}
        <Card sx={{ 
          mt: 3, 
          mb: 3,
          borderRadius: 3,
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
          background: '#fafbfc',
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
          }
        }}>
        <CardContent>
          <Typography 
            variant="h6" 
            gutterBottom 
            sx={{ 
              fontWeight: 700, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              color: theming.colors.primary,
              mb: 2
            }}
          >
            <Assignment sx={{ fontSize: 28 }} /> Prosjekttype
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 600, '&.Mui-focused': { color: '#1565c0' } }}>Velg prosjekttype</InputLabel>
            <Select
              value={projectData.projectType || ''}
              onChange={(e) => {
                const selectedTypeId = e.target.value;
                setProjectData((prev) => ({
                  ...prev,
                  projectType: selectedTypeId,
                  weddingCulture: selectedTypeId === 'wedding' ? prev.weddingCulture : 'norsk',
                }));

                // Track usage for ML learning
                const selectedType = dynamicProjectTypes.find(t => t.name.toLowerCase() === selectedTypeId || t.id.toString() === selectedTypeId);
                if (selectedType) {
                  trackUsage(selectedType.id);
                }
              }}
              label="Velg prosjekttype"
              sx={{
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#1565c0', borderWidth: 1.5 },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#0d47a1' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1565c0', borderWidth: 2 },
                '& .MuiSelect-select': { color: 'rgba(255,255,255,0.95)', fontWeight: 500 }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: '#2c2c2c',
                    '& .MuiMenuItem-root': {
                      color: 'white',
                      '&:hover': { bgcolor: '#1565c0' },
                      '&.Mui-selected': { bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' } }
                    }
                  }
                }
              }}
            >
              {/* Default types from PROJECT_TYPES */}
              {Object.entries(PROJECT_TYPES).map(([key, type]) => {
                const IconComponent = type.icon;
                return (
                  <MenuItem key={key} value={key}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconComponent sx={{ fontSize: 20, color: type.color }} />
                      {type.name}
                    </Box>
                  </MenuItem>
                );
              })}

              {/* Dynamic custom types */}
              {dynamicProjectTypes.filter(t => !t.isGlobal).length > 0 && (
                <MenuItem disabled sx={{ opacity: 0.6, fontWeight: 600}}>
                  — Custom Types —
                </MenuItem>
              )}
              {dynamicProjectTypes
                .filter(t => !t.isGlobal)
                .map((type) => (
                  <MenuItem key={type.id} value={type.name.toLowerCase()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Folder sx={{ fontSize: 20, color: 'white' }} />
                      {type.name}
                      {type.usageCount > 0 && (
                        <Chip label={`${type.usageCount}x`} size="small" sx={{ ml: 'auto', height: 18, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                      )}
                    </Box>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setAddProjectTypeDialogOpen(true)}
            fullWidth
            sx={{ 
              py: 1.5, 
              fontWeight: 600,
              borderColor: theming.colors.primary,
              color: theming.colors.primary,
              '&:hover': {
                backgroundColor: `${theming.colors.primary}08`,
                borderColor: theming.colors.primary
              }
            }}
          >
            Legg til egendefinert prosjekttype
          </Button>
        </CardContent>
      </Card>

      {/* Add Project Type Dialog */}
      <AddProjectTypeDialog
        open={addProjectTypeDialogOpen}
        onClose={() => setAddProjectTypeDialogOpen(false)}
        onSave={async (data) => {
          await createProjectType(data);
          showSuccessToast(`Custom project type "${data.name}" created successfully!`);
        }}
      />

      {/* Footer actions */}
      {projectData?.projectType === 'event' && (
        <Box sx={{ 
          mt: 4, 
          p: 2.5, 
          background: '#fafbfc',
          borderRadius: 3, 
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)'
        }}>
          <FormControlLabel
            control={<Switch checked={connectToEvent} onChange={(_, v) => setConnectToEvent(v)} />}
            label={<Typography variant="body2" fontWeight={600}>Koble til Event Management</Typography>}
          />
          <Button
            variant="contained"
            disabled={!connectToEvent}
            onClick={handleOpenEventManagementClick}
            sx={{ mt: 1, bgcolor: '#1565c0', '&:hover': { bgcolor: '#0d47a1' } }}
          >
            Åpne Event Management
          </Button>
        </Box>
      )}

      {/* Split Sheet Setup for Music Producers */}
      {profession === 'music_producer' && projectData.collaborators && projectData.collaborators.length > 0 && (
        <Card sx={{ 
          mt: 3, 
          mb: 3,
          borderRadius: 3,
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
          background: '#fafbfc',
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
          }
        }}>
          <CardContent>
            <Typography 
              variant="h6" 
              gutterBottom 
              sx={{ 
                fontWeight: 700, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: theming.colors.primary,
                mb: 2
              }}
            >
              <AccountBalance sx={{ color: theming.colors.primary }} />
              Split Sheet Setup
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Opprett automatisk split sheet basert på prosjektets bidragsytere
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={projectData.enableSplitSheet || false}
                  onChange={(e) =>
                    setProjectData((prev) => ({
                      ...prev,
                      enableSplitSheet: e.target.checked
                    }))
                  }
                />
              }
              label="Opprett split sheet for dette prosjektet"
            />
            {projectData.enableSplitSheet && (
              <Alert severity="info" sx={{ mt: 2 }}>
                En split sheet vil automatisk bli opprettet med {projectData.collaborators.length} bidragsytere når prosjektet er opprettet.
                Du kan justere prosentandeler i Split Sheets-fanen etter opprettelse.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* ==========================================
         PROJECT MANAGEMENT TOOLBAR
         ========================================== */}
      <Card sx={{ mt: 3, mb: 3, borderRadius: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', background: '#fafbfc' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, mb: 2 }}>
            <Settings sx={{ fontSize: 28 }} /> Prosjektverktøy
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
            <Tooltip title="Lagre utkast">
              <Badge badgeContent={hasUnsavedChanges ? '!' : 0} color="warning">
                <Button variant="outlined" size="small" startIcon={<Save />} onClick={handleSaveDraft} disabled={!hasUnsavedChanges}>
                  Lagre utkast
                </Button>
              </Badge>
            </Tooltip>
            <Tooltip title="Dupliser prosjekt">
              <Button variant="outlined" size="small" startIcon={<Restore />} onClick={handleDuplicateProject} disabled={!currentProject?.id}>
                Dupliser
              </Button>
            </Tooltip>
            <Tooltip title="Arkiver prosjekt">
              <Button variant="outlined" size="small" startIcon={<Drafts />} onClick={handleArchiveProject} disabled={!currentProject?.id}>
                Arkiver
              </Button>
            </Tooltip>
            <Tooltip title="Slett prosjekt">
              <Button variant="outlined" size="small" color="error" startIcon={<Delete />} onClick={handleDeleteProject} disabled={!currentProject?.id}>
                Slett
              </Button>
            </Tooltip>
            <Tooltip title="Publiser prosjekt">
              <Button variant="contained" size="small" startIcon={<Publish />} onClick={handlePublishProject} disabled={!currentProject?.id || draftMode === 'published'}>
                Publiser
              </Button>
            </Tooltip>
            <Tooltip title="Forhåndsvisning">
              <IconButton size="small" onClick={handleTogglePreview}>
                {showPreview ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Versjonhistorikk">
              <IconButton size="small" onClick={() => { setShowVersionHistory(true); setShowHistoryDialog(true); }}>
                <History />
              </IconButton>
            </Tooltip>
            <Tooltip title="Sammenlign versjoner">
              <IconButton size="small" onClick={() => setShowComparisonDialog(true)}>
                <Compare />
              </IconButton>
            </Tooltip>
            <Tooltip title="Utkast-panel">
              <IconButton size="small" onClick={() => setDraftSidebarOpen(true)}>
                <ChevronRight />
              </IconButton>
            </Tooltip>
            <Tooltip title="Helsesjekk">
              <IconButton size="small" onClick={() => setShowHealthCheck(true)}>
                <CheckCircle color={healthCheckPassed ? 'success' : 'action'} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Importer lead">
              <IconButton size="small" onClick={() => setShowLeadImport(true)}>
                <PersonAdd />
              </IconButton>
            </Tooltip>
            <Tooltip title="Oppdater cache">
              <IconButton size="small" onClick={handleRefreshProjectCache}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="Synk frakoblet">
              <IconButton size="small" onClick={handleSyncOffline}>
                <CloudDone />
              </IconButton>
            </Tooltip>
            <Tooltip title="Optimaliser data">
              <IconButton size="small" onClick={handleOptimizeProject}>
                <CloudUpload />
              </IconButton>
            </Tooltip>
            <Tooltip title="Samarbeidsøkt">
              <IconButton size="small" onClick={handleCreateCollabSession}>
                <Groups />
              </IconButton>
            </Tooltip>
          </Stack>
          {isCreating && <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />}
          {projectTypesLoading && <CircularProgress size={20} sx={{ ml: 1 }} />}
          {publishedProject && (
            <Chip icon={<CloudDone />} label={`Publisert: ${publishedProject.projectName || 'Prosjekt'}`} size="small" color="success" sx={{ mt: 1 }} />
          )}
          {traditionsInfo && (
            <Chip icon={<Info />} label={`Tradisjon: ${traditionsInfo.displayName}`} size="small" sx={{ mt: 1, ml: 1 }} />
          )}
        </CardContent>
      </Card>

      {/* ==========================================
         PROJECT PHASE STEPPER
         ========================================== */}
      <Card sx={{ mt: 3, mb: 3, borderRadius: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', background: '#fafbfc' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, mb: 2 }}>
            <Timeline sx={{ fontSize: 28 }} /> Prosjektfaser
          </Typography>
          <Stepper activeStep={activeStep} orientation="vertical">
            {Object.entries(PROJECT_PHASES).map(([key, phase], index) => (
              <Step key={key} completed={index < activeStep}>
                <StepLabel
                  StepIconProps={{ style: { color: phase.color } }}
                  onClick={() => handleGoToStep(index)}
                  sx={{ cursor: 'pointer' }}
                >
                  <Typography variant="subtitle2" fontWeight={600}>{phase.name}</Typography>
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{phase.description}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
                    {phase.categories.map(cat => (
                      <Chip key={cat} label={cat.replace(/_/g, ' ')} size="small" sx={{ bgcolor: `${phase.color}20`, color: phase.color }} />
                    ))}
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Button size="small" variant="contained" onClick={() => handlePhaseChange(key)} sx={{ bgcolor: phase.color }}>
                      Aktiver fase
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleGoToTab(key)}>
                      Gå til dashboard
                    </Button>
                  </Stack>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* ==========================================
         LOCATION INTELLIGENCE
         ========================================== */}
      <Accordion sx={{ mt: 3, borderRadius: 3, border: '1px solid #e0e0e0', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            <LocationOn sx={{ fontSize: 28 }} /> Lokasjonsintelligens
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              label="Søk lokasjon (Kartverket)"
              size="small"
              fullWidth
              onChange={(e) => handleLocationSearch(e.target.value)}
              placeholder="Skriv adresse eller stedsnavn..."
            />
            {locationLoading && <LinearProgress />}
            {locationSuggestions.length > 0 && (
              <Paper sx={{ maxHeight: 200, overflow: 'auto', p: 1 }}>
                <List dense>
                  {locationSuggestions.slice(0, 5).map((loc: LocationSuggestion, idx: number) => (
                    <ListItemButton key={idx} onClick={() => handleLocationSelect(loc)}>
                      <ListItemIcon><LocationOn fontSize="small" /></ListItemIcon>
                      <ListItemText primary={loc.name || loc.address} secondary={loc.municipality || loc.type} />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            )}
            {selectedLocation && (
              <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  <Check sx={{ fontSize: 16, mr: 0.5, color: 'success.main' }} /> {selectedLocation.name || selectedLocation.address}
                </Typography>
                {locationAnalysis && (
                  <Typography variant="body2" color="text.secondary">
                    Eiendomsanalyse: {locationAnalysis.type || 'N/A'} — {locationAnalysis.area || 'N/A'} m²
                  </Typography>
                )}
                {weatherData && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    <Schedule fontSize="small" />
                    <Typography variant="body2">
                      Vær: {weatherData.temperature || '—'}°C, {weatherData.description || 'ukjent'}
                    </Typography>
                  </Stack>
                )}
                {travelCosts && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <DirectionsCar fontSize="small" />
                    <Typography variant="body2">
                      Reise: {travelCosts.distance || '—'} km, ~{travelCosts.cost || '—'} NOK drivstoff
                    </Typography>
                  </Stack>
                )}
              </Paper>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* ==========================================
         SHOT LIST MANAGER
         ========================================== */}
      <Collapse in={projectData.projectType === 'wedding' || projectData.projectType === 'event' || projectData.projectType === 'portrait'}>
        <Card sx={{ mt: 3, mb: 3, borderRadius: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', background: '#fafbfc' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, mb: 2 }}>
              <CameraAlt sx={{ fontSize: 28 }} /> Shot List & Minnekort
            </Typography>
            <ShotListManager
              projectType={projectData.projectType}
              culture={projectData.weddingCulture}
              totalDays={projectData.totalDays}
              onShotUpdate={(shot: ShotListItem) => setProjectData(prev => ({ ...prev, shotList: prev.shotList.map((s) => s.id === shot.id ? shot : s) }))}
              onShotDelete={(shotId: string) => setProjectData(prev => ({ ...prev, shotList: prev.shotList.filter((s) => s.id !== shotId) }))}
            />
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <MemoryCardIcon letter="A" type="SD" capacity="64GB" size="small" /> Minnekort-konfigurasjon
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {Object.keys(LABELING_SCHEMES).map(scheme => (
                <Chip
                  key={scheme}
                  label={scheme}
                  size="small"
                  variant={memoryCardLabeling === scheme ? 'filled' : 'outlined'}
                  onClick={() => handleLabelingChange(scheme as LabelingKey)}
                  icon={<Memory />}
                />
              ))}
            </Stack>
            <MemoryCardSelector
              profession={memoryCardProfession}
              onCardsSelected={(cards) => {
                const mapped: SelectedMemoryCard[] = cards.map(c => ({ type: 'SD', capacity: c.capacity, count: c.count, estimatedPhotos: c.estimatedPhotos.raw + c.estimatedPhotos.craw }));
                setProjectData(prev => ({ ...prev, selectedMemoryCards: mapped }));
              }}
            />
            <Box sx={{ mt: 2 }}>
              <EnhancedMemoryCardSelector
                selectedCameras={projectData.selectedCameras || []}
                projectType={projectData.projectType}
                profession={enhancedProfession}
                totalDays={projectData.totalDays}
                budget={projectData.memoryCardBudget}
                onSelectionChange={(selection) => setProjectData(prev => ({ ...prev, enhancedMemoryCardSelection: { ...selection } }))}
              />
            </Box>
            {memoryCardRecommendation.totalCost > 0 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                <AttachMoney sx={{ fontSize: 16, mr: 0.5 }} />
                Estimert totalkost minnekort: {memoryCardRecommendation.totalCost.toFixed(0)} NOK
                ({memoryCardRecommendation.cardTypes?.length || 0} typer tilgjengelig)
              </Typography>
            )}
          </CardContent>
        </Card>
      </Collapse>

      {/* ==========================================
         CAMERA DETECTION SECTION
         ========================================== */}
      <Card sx={{ mt: 3, mb: 3, borderRadius: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', background: '#fafbfc' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, mb: 2 }}>
            <Videocam sx={{ fontSize: 28 }} /> Kamera & Utstyr
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Hovedkamera"
              value={projectData.primaryCamera}
              onChange={(e) => {
                setProjectData(prev => ({ ...prev, primaryCamera: e.target.value }));
                detectCameraInfo(e.target.value);
              }}
              size="small"
              fullWidth
              placeholder="f.eks. Sony A7S III"
            />
            <TextField
              label="Backup-kamera"
              value={projectData.backupCamera}
              onChange={(e) => setProjectData(prev => ({ ...prev, backupCamera: e.target.value }))}
              size="small"
              fullWidth
            />
          </Stack>
          {projectData.detectedLogFormats?.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Storage fontSize="small" color="primary" />
              <Typography variant="body2">LOG formater: {projectData.detectedLogFormats?.join(', ')}</Typography>
            </Stack>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<Movie />}
            onClick={openDavinciScriptManager}
            sx={{ mt: 2 }}
            disabled={!projectData.davinciIntegrationEnabled}
          >
            Åpne DaVinci Script Manager
          </Button>
        </CardContent>
      </Card>

      {/* ==========================================
         OFFSITE BACKUP (B2)
         ========================================== */}
      {currentProject?.id && (
        <Card sx={{ mt: 3, mb: 3, borderRadius: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', background: '#fafbfc' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, mb: 1 }}>
              Ekstern backup (offsite)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Aktiver en Backblaze-bucket som offsite-destinasjon for dette
              prosjektet. Filene lastes opp direkte fra Creatorhub One Desk
              under backup-økten — vi ser dem aldri.
            </Typography>
            <CloudDestinationActivator
              projectId={String(currentProject.id)}
              onActivated={() => {
                showSuccessToast?.('Offsite-backup aktivert — den nye destinasjonen vises i One Desk neste gang du starter en backup.', 5000);
              }}
            />
            {/* Hyr inn eksternt redigeringsteam for dette prosjektet (#6) */}
            <ExternalEditingOption
              projectId={String(currentProject.id)}
              projectTitle={projectData.projectName || String(currentProject.id)}
              locale="no"
            />
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setDeliverDialogOpen(true)}
                sx={{ borderRadius: 2 }}
              >
                📤 Lever til klient fra arkiv
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Velg filer som er backup'et til Backblaze og send som tilgangs-galleri. Klienten ser filene direkte fra B2 via Cloudflare-cache (ingen ekstra lagring eller egress-kost).
              </Typography>
            </Box>
            <Box sx={{ mt: 3 }}>
              <OneDeskDownloadCard />
            </Box>
            <Box sx={{ mt: 3 }}>
              <CloudErasePanel
                projectId={String(currentProject.id)}
                projectName={projectData.projectName || String(currentProject.id)}
              />
            </Box>
            <DeliverFromArchiveDialog
              projectId={String(currentProject.id)}
              defaultGalleryLabel={projectData.projectName || ''}
              open={deliverDialogOpen}
              onClose={() => setDeliverDialogOpen(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* ==========================================
         PROJECT COLLABORATORS
         ========================================== */}
      {currentProject?.id && (
        <Card sx={{ mt: 3, mb: 3, borderRadius: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', background: '#fafbfc' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, mb: 2 }}>
              <Groups sx={{ fontSize: 28 }} /> Samarbeidspartnere
            </Typography>
            <ProjectCollaborators
              projectData={projectData}
              onCollaboratorsChange={(collaborators: ProjectCollaboratorEntry[]) => setProjectData(prev => ({ ...prev, collaborators }))}
              currentUserProfession={collaboratorProfession}
            />
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" startIcon={<PersonAdd />} onClick={() => handleAddCollaborator(projectData.clientEmail || '')}>
                Legg til klient
              </Button>
              <Button size="small" variant="outlined" startIcon={<EventNote />} onClick={() => handleAddMilestone({ name: 'Ny milepæl', date: projectData.eventDate })}>
                Legg til milepæl
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* ==========================================
         WORKLOG & CULTURAL PLANNING
         ========================================== */}
      <Accordion sx={{ mt: 3, borderRadius: 3, border: '1px solid #e0e0e0', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            <AccessTime sx={{ fontSize: 28 }} /> Arbeidstid & Planlegging
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Oppgave"
                value={worklogFormData.title}
                onChange={(e) => setWorklogFormData(prev => ({ ...prev, title: e.target.value }))}
                size="small"
                fullWidth
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Fase</InputLabel>
                <Select
                  value={worklogFormData.projectPhase}
                  label="Fase"
                  onChange={(e) => setWorklogFormData(prev => ({ ...prev, projectPhase: e.target.value }))}
                >
                  {Object.entries(PROJECT_PHASES).map(([key, phase]) => (
                    <MenuItem key={key} value={key}>{phase.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Timer"
                type="number"
                value={worklogFormData.timeSpent}
                onChange={(e) => setWorklogFormData(prev => ({ ...prev, timeSpent: Number(e.target.value) }))}
                size="small"
                sx={{ maxWidth: 100 }}
              />
            </Stack>
            <TextField
              label="Beskrivelse"
              value={worklogFormData.description}
              onChange={(e) => setWorklogFormData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={2}
              size="small"
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" startIcon={<Save />} onClick={handleWorklogSubmit}>
                Registrer arbeidstid
              </Button>
              <Button variant="outlined" size="small" startIcon={<Notes />} onClick={() => setShowWorklogTipsDialog(true)}>
                Tips & Maler
              </Button>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* ==========================================
         PROJECT PREVIEW PANEL
         ========================================== */}
      <Collapse in={showPreview}>
        <Paper sx={{ mt: 3, p: 3, borderRadius: 3, border: '1px solid #e0e0e0', background: '#f8f9fa' }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            <Visibility sx={{ fontSize: 28 }} /> Prosjekt-forhåndsvisning
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            <Typography variant="body2"><strong>Prosjektnavn:</strong> {projectData.projectName || '(ikke satt)'}</Typography>
            <Typography variant="body2"><strong>Prosjekttype:</strong> {projectData.projectType} {projectData.weddingCulture !== 'norsk' && `(${projectData.weddingCulture})`}</Typography>
            {projectData.eventType !== 'wedding' && (
              <Typography variant="body2"><strong>Arrangementstype (Evendi):</strong> {projectData.eventType} ({projectData.eventCategory})</Typography>
            )}
            <Typography variant="body2"><strong>Klient:</strong> {projectData.clientName || '(ikke satt)'}</Typography>
            <Typography variant="body2"><strong>Dato:</strong> {projectData.eventDate || '(ikke satt)'}</Typography>
            <Typography variant="body2"><strong>Lokasjon:</strong> {projectData.location || '(ikke satt)'}</Typography>
            <Typography variant="body2"><strong>Yrke:</strong> {getProfessionDisplayName(userProfession)} {getProfessionIcon(userProfession)}</Typography>
            <Typography variant="body2"><strong>Dager:</strong> {projectData.totalDays}</Typography>
            <Typography variant="body2"><strong>Hovedkamera:</strong> {projectData.primaryCamera || '(ikke satt)'}</Typography>
            <Typography variant="body2"><strong>Minnekort:</strong> {projectData.selectedMemoryCards?.length || 0} kort</Typography>
            <Typography variant="body2"><strong>Utkast-status:</strong> {draftMode}</Typography>
            <Typography variant="body2"><strong>PIN:</strong> {generatePinFromProjectName(projectData.projectName)}</Typography>
            {projectTypeDetails && (
              <>
                <Typography variant="body2"><strong>Tidsestimat:</strong> {projectTypeDetails.timeEstimate}h</Typography>
                <Typography variant="body2"><strong>Pris:</strong> {projectTypeDetails.pricing} NOK</Typography>
                <Typography variant="body2"><strong>Neste steg:</strong> {projectTypeDetails.nextSteps || 'N/A'}</Typography>
              </>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <FormControlLabel control={<Checkbox checked={projectData.driveIntegration} onChange={(e) => setProjectData(prev => ({ ...prev, driveIntegration: e.target.checked }))} size="small" />} label="Google Drive" />
              <FormControlLabel control={<Radio checked={projectData.backupStrategy === 'automatic'} onChange={() => setProjectData(prev => ({ ...prev, backupStrategy: 'automatic' }))} size="small" />} label="Auto backup" />
            </Stack>
          </Stack>
        </Paper>
      </Collapse>

      {/* ==========================================
         DIALOGS: Health Check, Cultural Day, Worklog Tips, Lead Import, Version History, Script Manager, Comparison
         ========================================== */}
      
      {/* Health Check Dialog */}
      <Dialog open={showHealthCheck} onClose={() => setShowHealthCheck(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" /> Prosjekt Helsesjekk
        </DialogTitle>
        <DialogContent>
          <ProjectHealthCheck
            projectData={projectData}
            profession={collaboratorProfession}
            open={showHealthCheck}
            onClose={() => setShowHealthCheck(false)}
            onContinue={handleHealthCheckPassed}
            onGoToStep={handleGoToStep}
            onGoToTab={handleGoToTab}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHealthCheck(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Cultural Day Explanation Dialog */}
      <Dialog open={cultureDayDialog.open} onClose={() => setCultureDayDialog(prev => ({ ...prev, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <EventNote color="primary" /> {cultureDayDialog.day}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{cultureDayDialog.explanation}</Typography>
          {cultureDayDialog.culture && CULTURAL_DAY_EXPLANATIONS[cultureDayDialog.culture] && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" fontWeight={700}>Andre dager i {cultureDayDialog.culture}:</Typography>
              <List dense>
                {Object.entries(CULTURAL_DAY_EXPLANATIONS[cultureDayDialog.culture]).map(([dayName, explanation]) => (
                  <ListItem key={dayName}>
                    <ListItemIcon><Schedule fontSize="small" /></ListItemIcon>
                    <ListItemText primary={dayName} secondary={String(explanation).substring(0, 100) + '...'} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCultureDayDialog(prev => ({ ...prev, open: false }))}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Worklog Tips Dialog */}
      <Dialog open={showWorklogTipsDialog} onClose={() => setShowWorklogTipsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Notes color="primary" /> Arbeidstid-maler og tips
        </DialogTitle>
        <DialogContent>
          <List>
            {Object.entries(PROJECT_PHASES).map(([phaseKey, phase]) => (
              <React.Fragment key={phaseKey}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: phase.color }}>{phase.name.charAt(0)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography variant="subtitle2" fontWeight={700}>{phase.name}</Typography>}
                    secondary={phase.description}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const template = generateWorklogTemplate(userProfession, phaseKey, phase.categories[0], projectData.projectType, projectData.weddingCulture);
                      setWorklogFormData(prev => ({
                        ...prev,
                        title: template.title,
                        description: template.description,
                        projectPhase: phaseKey,
                        category: phase.categories[0],
                        timeSpent: template.timeEstimate,
                      }));
                      setShowWorklogTipsDialog(false);
                    }}
                  >
                    Bruk mal
                  </Button>
                </ListItem>
                <Divider variant="inset" />
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWorklogTipsDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Lead Import Dialog */}
      <Dialog open={showLeadImport} onClose={() => setShowLeadImport(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAdd color="primary" /> Importer fra Leads
          {isLoadingLeads && <CircularProgress size={20} sx={{ ml: 1 }} />}
        </DialogTitle>
        <DialogContent>
          {availableLeads && availableLeads.length > 0 ? (
            <List>
              {availableLeads.map((lead, idx) => (
                <ListItemButton key={lead.id || idx} onClick={() => handleImportLead(lead)} disabled={isImporting}>
                  <ListItemAvatar>
                    <Avatar><Portrait /></Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={lead.clientName || lead.clientEmail || 'Ukjent'} secondary={lead.clientEmail || lead.clientPhone || ''} />
                  {isImporting && <CircularProgress size={16} />}
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Ingen tilgjengelige leads funnet. Prøv å oppdatere listen.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLeadImport(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={showVersionHistory || showHistoryDialog} onClose={() => { setShowVersionHistory(false); setShowHistoryDialog(false); }} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <History color="primary" /> Versjonhistorikk
        </DialogTitle>
        <DialogContent>
          {projectHistory.length > 0 ? (
            <List>
              {projectHistory.map((version: VersionEntry & { action?: string; timestamp?: string }, idx: number) => (
                <ListItem key={idx} secondaryAction={
                  <Button size="small" startIcon={<Restore />} onClick={() => handleRestoreVersion(version)}>Gjenopprett</Button>
                }>
                  <ListItemIcon><AccessTime /></ListItemIcon>
                  <ListItemText primary={version.action || `Versjon ${idx + 1}`} secondary={version.timestamp || ''} />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Ingen versjonhistorikk ennå. Lagre utkast for å starte historikken.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVersionHistory(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Version Comparison Dialog */}
      <Dialog open={showComparisonDialog} onClose={() => setShowComparisonDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Compare color="primary" /> Sammenlign versjoner
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={2}>
            <Paper sx={{ flex: 1, p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Edit fontSize="small" /> Nåværende
              </Typography>
              <Typography variant="body2">Navn: {projectData.projectName}</Typography>
              <Typography variant="body2">Type: {projectData.projectType}</Typography>
              <Typography variant="body2">Klient: {projectData.clientName}</Typography>
            </Paper>
            <Paper sx={{ flex: 1, p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <History fontSize="small" /> Publisert
              </Typography>
              <Typography variant="body2">Navn: {publishedProject?.projectName || '(ingen publisert)'}</Typography>
              <Typography variant="body2">Type: {publishedProject?.projectType || '-'}</Typography>
              <Typography variant="body2">Klient: {publishedProject?.clientName || '-'}</Typography>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowComparisonDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Script Manager Dialog */}
      <Dialog open={showScriptManager} onClose={() => setShowScriptManager(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Movie color="primary" /> DaVinci Resolve Script Manager
        </DialogTitle>
        <DialogContent>
          <ScriptManager />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowScriptManager(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Draft Sidebar Drawer */}
      <Drawer anchor="right" open={draftSidebarOpen} onClose={() => setDraftSidebarOpen(false)}>
        <Box sx={{ width: 360, p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              <Drafts sx={{ mr: 1 }} /> Utkast
            </Typography>
            <IconButton onClick={() => setDraftSidebarOpen(false)}>
              <ChevronLeft />
            </IconButton>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1.5}>
            <Chip icon={draftMode === 'draft' ? <Edit /> : draftMode === 'published' ? <CloudDone /> : <Visibility />} label={`Status: ${draftMode}`} color={draftMode === 'published' ? 'success' : 'default'} />
            <Button variant="outlined" fullWidth startIcon={<Save />} onClick={handleSaveDraft}>Lagre utkast</Button>
            <Button variant="outlined" fullWidth startIcon={<Restore />} onClick={handleGetDraft}>Hent utkast</Button>
            <Button variant="outlined" fullWidth startIcon={<Delete />} onClick={handleDeleteDraft} color="error">Slett utkast</Button>
            <Button variant="outlined" fullWidth startIcon={<Publish />} onClick={handlePublishProject} disabled={!currentProject?.id}>Publiser</Button>
            <Divider />
            <Button variant="outlined" fullWidth startIcon={<ShoppingCart />} onClick={() => handleIntegrationConnect('google-drive')}>Google Drive</Button>
            <Button variant="outlined" fullWidth startIcon={<Payment />} onClick={() => handleProjectSettingsUpdate({ autoBackup: true })}>Innstillinger</Button>
            <Button variant="outlined" fullWidth startIcon={<MusicNote />} onClick={handleMigrateProject}>Migrer data</Button>
            <Button variant="outlined" fullWidth startIcon={<Portrait />} onClick={() => handleProjectPermissions({ public: false })}>Tillatelser</Button>
            <Button variant="outlined" fullWidth startIcon={<Warning />} onClick={handleProjectCompliance}>Compliance</Button>
            <Divider />
            <Typography variant="subtitle2" fontWeight={700}>Samarbeid</Typography>
            <Button variant="text" size="small" startIcon={<Groups />} onClick={handleCreateCollabSession}>Ny økt</Button>
            <Button variant="text" size="small" startIcon={<PersonAdd />} onClick={() => handleJoinSession('default')}>Bli med</Button>
            <Button variant="text" size="small" startIcon={<VisibilityOff />} onClick={handleLeaveSession}>Forlat økt</Button>
            <Divider />
            <Typography variant="subtitle2" fontWeight={700}>Prosjekthandlinger</Typography>
            <Button variant="text" size="small" startIcon={<Refresh />} onClick={handleRefreshProjectCache}>Oppdater cache</Button>
            <Button variant="text" size="small" startIcon={<CloudUpload />} onClick={() => handleUploadFile(new File([], 'placeholder'))}>Last opp fil</Button>
            <Button variant="text" size="small" startIcon={<Notes />} onClick={() => handleAddComment('Oppdatering fra utkast-panel')}>Legg til kommentar</Button>
            <Button variant="text" size="small" startIcon={<CloudDone />} onClick={handleCreateBackup} disabled={isCreatingBackup}>{isCreatingBackup ? 'Lager…' : 'Sikkerhetskopi'}</Button>
            <Button variant="text" size="small" startIcon={<Timeline />} onClick={() => handleProjectsByDateRange(projectData.eventDate || '', projectData.eventDate || '')}>Søk etter dato</Button>
            <Button variant="text" size="small" startIcon={<Videocam />} onClick={() => handleSearchProjects(projectData.projectName)}>Søk prosjekter</Button>
            <Button variant="text" size="small" startIcon={<CloudDone />} onClick={handleSyncOffline}>Synk frakoblet</Button>
            <Button variant="text" size="small" startIcon={<Storage />} onClick={handleOptimizeProject}>Optimaliser</Button>
            <Button variant="text" size="small" startIcon={<Refresh />} onClick={() => handleIntegrationDisconnect('google-drive')}>Frakoble integrasjon</Button>
            <Button variant="text" size="small" startIcon={<Lightbulb />} onClick={() => setDraftMode(draftMode === 'draft' ? 'live' : 'draft')}>Bytt modus</Button>
          </Stack>
        </Box>
      </Drawer>

      {/* Cultural day buttons for wedding projects */}
      {projectData.projectType === 'wedding' && projectData.weddingCulture !== 'norsk' && (
        <Card sx={{ mt: 3, mb: 3, borderRadius: 3, border: '1px solid #e0e0e0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', background: '#fafbfc' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary, mb: 2 }}>
              <Info sx={{ fontSize: 28 }} /> Kulturelle seremonidager
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
              {WEDDING_CULTURES[projectData.weddingCulture as keyof typeof WEDDING_CULTURES]?.day_names?.map((dayName: string) => (
                <Chip
                  key={dayName}
                  label={dayName}
                  onClick={() => handleOpenCulturalDayExplanation(projectData.weddingCulture, dayName)}
                  icon={<EventNote />}
                  variant="outlined"
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Slice 9X.5 — pris-pakke-velger. Henter pakker fra
          PricingAdministration (Administrasjon-fanen). packageId
          persisteres i project.settings og propageres til galleri-
          opprettelse via deep-link så contractedImages auto-fylles.
          Synlig kun når brukeren har minst én pakke registrert. */}
      <ProjectPackagePicker
        userId={user?.id ?? null}
        value={projectData.packageId}
        onChange={(packageId) => setProjectData((prev) => ({ ...prev, packageId }))}
      />

      {/* Create Project Button */}
      <Card sx={{ mt: 3, background: `linear-gradient(135deg, ${theming.colors.primary}15 0%, ${theming.colors.primary}05 100%)` }}>
        <CardContent>
          <Stack direction="row" spacing={2} justifyContent="flex-end" alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {projectData.projectName ? `Prosjekt: ${projectData.projectName}` : 'Fyll ut prosjektdetaljer for å opprette'}
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<Folder />}
              disabled={!projectData.projectName || !projectData.projectType}
              onClick={async () => {
                try {
                  trackButtonClick('opprett_prosjekt', {
                    profession: userProfession,
                    projectType: projectData.projectType,
                    hasClient: !!projectData.clientName
                  });
                  showInfoToast('Oppretter prosjekt...', 2000);
                  const newProject = await createProjectViaCorrectEndpoint();
                  showSuccessToast(`Prosjekt "${projectData.projectName}" opprettet!`, 4000);
                  if (newProject) {
                    await WorkflowIntegrationService.orchestrateCompleteWorkflow(newProject);
                  }
                  if (onProjectCreated && newProject) {
                    onProjectCreated(newProject);
                  }
                } catch (error) {
                  console.error('Failed to create project:', error);
                  showErrorToast('Kunne ikke opprette prosjekt. Prøv igjen.');
                }
              }}
              sx={{
                bgcolor: theming.colors.primary,
                color: 'white',
                px: 4,
                py: 2,
                fontWeight: 700,
                fontSize: '1.05rem',
                textTransform: 'none',
                borderRadius: 1.5,
                boxShadow: `0 4px 12px ${theming.colors.primary}40`,
                '&:hover': {
                  bgcolor: theming.colors.primary,
                  opacity: 0.9,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 6px 16px ${theming.colors.primary}50`
                },
                '&:disabled': {
                  bgcolor: 'action.disabledBackground',
                  color: 'action.disabled'
                }
              }}
            >
              Opprett Prosjekt
            </Button>
            {/* Slice 9X.2 — deep-link til klient-galleri-opprettelse.
                Synlig kun når klient-info finnes (galleri uten klient =
                meningsløst). Oppretter prosjektet først, deretter
                navigerer til /showcase-admin med prefill-parametre slik
                at ClientGalleriesManager åpner create-dialog ferdig
                utfylt. projectId sendes med slik at #9X.3
                (gallery.projectId-persistens) kan plukke det opp uten
                at vi endrer URL-skjemaet senere. */}
            <Button
              variant="outlined"
              size="large"
              startIcon={<Folder />}
              disabled={
                !projectData.projectName ||
                !projectData.projectType ||
                !projectData.clientName ||
                !projectData.clientEmail
              }
              onClick={async () => {
                try {
                  trackButtonClick('opprett_prosjekt_med_galleri', {
                    profession: userProfession,
                    projectType: projectData.projectType,
                  });
                  showInfoToast('Oppretter prosjekt + klient-galleri…', 2000);
                  const newProject = await createProjectViaCorrectEndpoint();
                  if (newProject) {
                    await WorkflowIntegrationService.orchestrateCompleteWorkflow(newProject);
                  }
                  if (onProjectCreated && newProject) {
                    onProjectCreated(newProject);
                  }
                  const params = new URLSearchParams({
                    tab: 'clientGalleries',
                    autoCreate: '1',
                    clientName: projectData.clientName || '',
                    clientEmail: projectData.clientEmail || '',
                    projectTitle: projectData.projectName || '',
                    ...(newProject?.id ? { projectId: String(newProject.id) } : {}),
                    // Slice 9X.5 — propagér pakken slik at galleri-skap
                    // bruker samme pakke-rad og auto-fyller
                    // contractedImages.
                    ...(projectData.packageId ? { packageId: projectData.packageId } : {}),
                  });
                  if (navigate) {
                    navigate(`/showcase-admin?${params.toString()}`);
                  } else if (typeof window !== 'undefined') {
                    window.location.href = `/showcase-admin?${params.toString()}`;
                  }
                } catch (error) {
                  console.error('Failed to create project + gallery deep-link:', error);
                  showErrorToast('Kunne ikke opprette. Prøv igjen.');
                }
              }}
              sx={{
                color: theming.colors.primary,
                borderColor: theming.colors.primary,
                px: 3,
                py: 2,
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 1.5,
              }}
            >
              + Klient-galleri
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
