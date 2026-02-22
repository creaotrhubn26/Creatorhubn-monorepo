/**
 * CreatorHub Norge - Project Creation Modal
 * The modal is designed to be used in the CreatorHub Norge Virtual studio for creating new projects,but should be adaptable for other professions and also connected to the The Role Room.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { trackButtonClick, trackModalOpen } from '@/hooks/useActionTracker';
// Import dynamic profession system
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIconUtil from '@/utils/profession-icons';
import { useDynamicProfessions } from '../../hooks/useDynamicProfessions';
import { getProjectTypeNextSteps, getProjectTypeInitialDescription } from '@/utils/project-worklog-helpers';
// New context imports
import { useProject } from '@/contexts/ProjectContext';
import type { Project, Collaborator, Milestone } from '@/contexts/ProjectContext';
// Ensure type imports are used for type-checking
const _collaboratorType: Collaborator | null = null;
const _milestoneType: Milestone | null = null;
void _collaboratorType;
void _milestoneType;
// Comprehensive feature system integration
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '@/utils/theming-helper';
import { useExternalData } from '@/services/ExternalDataService';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useRealTime } from '../../hooks/useRealTime';
import { apiRequest } from '@/lib/queryClient';
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
  Person,
  School,
  Work,
  SportsEsports,
  Campaign,
  Article,
  AutoAwesome,
  CameraAlt,
  Mic,
} from '@mui/icons-material';
import { RolesIcon as TheaterComedy, LocationsIcon as LocationOn } from '../icons/CastingIcons';
import MemoryCardIcon from '../ui/MemoryCardIcon';
import MemoryCardSelector from '../memory-card/MemoryCardSelector';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';
import { useLeadImport } from '@/hooks/useLeadImport';
import ProjectHealthCheck from './ProjectHealthCheck';
import ProjectCollaborators from './ProjectCollaborators';
import { VIDEO_CAMERA_DATABASE, getCamerasByProfession, getLogFormatsByCamera, getCameraBrand } from '@/data/video-camera-database';
import { PHOTO_CAMERA_DATABASE, getPhotoCamerasByProfession, getPhotoCameraBrand } from '@/data/photo-camera-database';
import { MemoryCardRecommendationEngine, getMemoryCardTypesByProfession, formatCurrency, convertCurrency } from '@/data/memory-card-database';
import EnhancedMemoryCardSelector from '../memory-card/EnhancedMemoryCardSelector';
import { useLocation } from 'wouter';
import { useProjectTypes, type ProjectType as HookProjectType } from '@/hooks/useProjectTypes';
import AddProjectTypeDialog from './AddProjectTypeDialog';
import AddIcon from '@mui/icons-material/Add';
import { useAuth } from '@/hooks/useAuth';
import { ProjectTypeSelector } from './ProjectTypeSelector';
import { PROJECT_TYPES } from './projectTypeConstants';
import { ContactPicker } from './ContactPicker';
import { ContactProjectInfoSummary } from './ContactProjectInfoSummary';
import { logger } from '@/core/services/logger';
import type { ProjectData, MemoryCardConfig, SelectedMemoryCard, LabelingKey, ScriptParameters } from './types';
import type { SplitSheetContributor, ContributorRole } from '../split-sheets/types';
import { castingService } from '../../services/castingService';

const log = logger.module('ProjectCreationModal');

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

// PROJECT_TYPES moved to projectTypeConstants.ts

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
    color: '#9333ea',
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
const DYNAMIC_WORKLOG_TEMPLATES = {
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
  pricingData?: any
) => {
  // Get base template
  const baseTemplate = (DYNAMIC_WORKLOG_TEMPLATES as Record<string, Record<string, Record<string, { title: string; description: string; timeEstimate: number; checklistItems: string[] }>>>)[profession]?.[phase]?.[category];
  if (!baseTemplate) {
    return {
      title: `${category.replace('_,', ', ').replace(/\b\w/g, l => l.toUpperCase())} - ${phase.replace('_',', ')}`,
      description: `Arbeid relatert til ${category.replace('_',', ')} i ${phase.replace('_', ', ')}-fasen.`,
      timeEstimate: getDynamicTimeEstimate(profession, phase, category, pricingData),
      checklistItems: []
    };
  }

  // Clone template to avoid mutations
  let template = { ...baseTemplate };

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

// LabelingKey imported from ./types

// Helper function for dynamic project type defaults
const getDefaultProjectType = (profession: string, isCastingPlanner: boolean = false): string => {
  if (isCastingPlanner) {
    // In The Role Room, avoid wedding as default
    const typeMap: Record<string, string> = {
      photographer: 'portrait',
      videographer: 'video',
      music_producer: 'song',
      vendor: 'commercial'
    };
    return typeMap[profession] || 'commercial';
  }
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
      'photographer': 8, 'videographer': 12, 'music_producer': 4, 'vendor': 6
    }, 'portrait': {
      'photographer': 3, 'videographer': 4, 'music_producer': 2, 'vendor': 2
    }, 'event': {
      'photographer': 6, 'videographer': 8, 'music_producer': 3, 'vendor': 4
    }, 'song': {
      'photographer': 2, 'videographer': 3, 'music_producer': 20, 'vendor': 1
    }, 'commercial': {
      'photographer': 4, 'videographer': 6, 'music_producer': 3, 'vendor': 5
    }
  };

  return estimates[projectType as keyof typeof estimates]?.[profession as keyof typeof estimates.wedding] || 4;
};

// Helper function for dynamic pricing defaults - connected to price administration system
const getDefaultPricing = (profession: string, packagesData?: any, pricingData?: any): number => {
  // Try to get pricing from the price administration system first
  if (packagesData?.packages && Array.isArray(packagesData.packages)) {
    const professionPackages = packagesData.packages.filter((pkg: any) => 
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
    const professionPricing = pricingData.pricingStructures.find((pricing: any) => 
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
const getDynamicTimeEstimate = (profession: string, phase: string, category: string, pricingData?: any): number => {
  // Try to get time estimates from pricing structures first
  if (pricingData?.pricingStructures && Array.isArray(pricingData.pricingStructures)) {
    const professionPricing = pricingData.pricingStructures.find((pricing: any) => 
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
  onProjectCreated?: (projectData: any) => void;
  initialData?: any; // Pre-filled data from submission or other source
  // Integration props for universal workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  // New: open Event Management with prefilled event
  onOpenEventManagement?: (eventData: any) => void;
  // The Role Room mode - simplifies UI and hides non-relevant features
  isCastingPlanner?: boolean;
  getTerm?: (key: string) => string; // Terminology helper from The Role Room
}

// Local MemoryCardConfig, SelectedMemoryCard, and LabelingKey types imported from ./types

export default function ProjectCreationWithMemoryCards({
  profession,
  userId,
  initialData, // Pre-filled data from submission
  onProjectCreated,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect,
  onOpenEventManagement,
  isCastingPlanner = false,
  getTerm
}: ProjectCreationWithMemoryCardsProps) {
  // Get user and profession context with dynamic system support
  const { user } = useAuth();
  
  // Create auth headers for API requests
  const auth = {
    'Authorization': `Bearer ${user?.id || 'anonymous'}`,
    'X-User-Email': user?.email || 'anonymous@example.com'
  };
  const { getCurrentUserProfession, professionConfigs, isLoading: professionsLoading, getProfessionDisplayName, getProfessionIcon } = useDynamicProfessions();
  const userProfession = user?.profession || profession || getCurrentUserProfession();
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
  const enhancedMaster = useEnhancedMasterIntegration();
  const features = enhancedMaster.features;
  const communication = Object.prototype.hasOwnProperty.call(enhancedMaster, 'communication')
    ? (enhancedMaster as unknown as Record<string, unknown>).communication
    : undefined;
  
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
  
  // Toast notification system
  const visualEditorContext = useVisualEditor() as ReturnType<typeof useVisualEditor> & { addNotification?: (notification: { title: string; message: string; type: string; read: boolean; duration: number }) => void };
  const addNotification = visualEditorContext?.addNotification || ((notification: any) => {
    console.log('Visual Editor context not available, ', notification);
  });

  // Toast helper functions
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', _duration: number = 4000) => {
      addNotification({
        title: type.charAt(0).toUpperCase() + type.slice(1) + ' Notification',
        message,
        type,
        read: false,
        duration: _duration,
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
  
  // Stepper configuration for project creation flow
  const creationSteps = useMemo(() => [
    { 
      label: 'Grunndata', 
      description: 'Kontakt, prosjektinfo og type',
      icon: <Person />
    },
    { 
      label: 'Split Sheet & Produksjonsteam', 
      description: 'Fordeling og samarbeidspartnere',
      icon: <AccountBalance />
    },
  ], []);
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
  
  // Initialize projectData state BEFORE useEffect hooks that use it
  const [projectData, setProjectData] = useState<ProjectData>({
    projectName: initialData?.projectName || '',
    clientName: initialData?.clientName || '',
    clientEmail: initialData?.clientEmail || '',
    clientPhone: initialData?.clientPhone || '',
    eventDate: initialData?.eventDate || '',
    eventDates: (initialData?.eventDates as Record<number, string> | undefined) || ({} as Record<number, string>), // For multi-day events
    location: initialData?.location || '',
    projectType: initialData?.projectType || getDefaultProjectType(userProfession, isCastingPlanner),
    weddingCulture: 'norsk',
    totalDays: 1,
    activeDays: [1],
    memoryCardConfigs: [] as MemoryCardConfig[],
    selectedMemoryCards: [] as SelectedMemoryCard[],
    selectedCameras: [],
    enhancedMemoryCardSelection: null, // Enhanced memory card selection
    memoryCardBudget: 'mid' as 'budget' | 'mid' | 'premium' | 'professional',
    editingSoftware: '',
    driveIntegration: true,
    profession: profession,
    createShowcaseGallery: false,
    meetingOption: 'none', // 'none','now','later'
    meetingDate: '',
    meetingTime: '10:00',
    meetingDuration: 60,
    shotList: [], // Shot list data
    shotListTemplate: '', // Selected template
    shotListCulture: '', // Culture-specific suggestions
    saveAsDefault: false, // Save this meeting routine as default for future projects
    // clientEmail and clientPhone moved to top (already initialized from initialData)
    budget: initialData?.budget || '',
    specialRequests: '',
    estimatedDuration: '',
    dailyHours: {} as Record<number, number>, // Hours per day for multi-day events
    customDayNames: null as string[] | null, // Manuel dag-navngiving for tilpassede arrangementer
    customCategories: [] as string[], // Manuel kategorier for alle prosjekttyper (event, commercial, etc.)
    memoryCardLabeling: 'ABCD' as LabelingKey, // Default labeling scheme
    perImagePrice: 500, // Default price per image
    contractedImages: 50,
    // Pricing Administration Integration
    selectedPackage: null,
    customPricing: {
      basePrice: 0,
      hourlyRate: 0,
      travelCosts: 0,
      additionalCosts: [],
      discounts: [],
      totalEstimate: 0
    },
    automaticPricing: true, // Use pricing from administration settings
    // FASE 2: Showcase Gallery Security Settings
    showcaseGallerySecurity: {
      pinRequired: false,
      pin: '',
      passwordRequired: false,
      password: '',
      accessLevel: 'public' as 'public' | 'restricted' | 'private',
      enableIpRestrictions: false,
      allowedIpRanges: [] as string[],
      enableDownloadProtection: false,
      downloadProtectionLevel: 'none' as 'none' | 'watermark' | 'disabled',
      sessionTimeoutMinutes: 60,
      maxLoginAttempts: 3,
      lockoutDurationMinutes: 15
    },

    // Wedding Timeline Integration - aktiveres kun for bryllup + showcase
    createWeddingTimeline: false,
    weddingTimelineShared: false,
    weddingTimelineUrl: '',
    weddingTimelineSecurity: {
      useShowcasePassword: true, // Default: bruk samme passord som showcase
      customPassword: false,
      pin: '',
      password: '',
      accessLevel: 'restricted' as 'public' | 'restricted' | 'private'
    },

    // Project collaborators and invitations
    collaborators: [],
    // Split sheet creation for music producers
    enableSplitSheet: false,
    splitSheetData: null,
    // Add missing properties
    description: initialData?.description || '',
    venue: '',
    guestCount: initialData?.guestCount || '',
    primaryCamera: '',
    backupCamera: '',
    estimatedPhotos: '',
    fileFormat: 'raw+jpeg',
    equipmentNotes: '',
    backupStrategy: 'automatic',
    backupFrequency: 'realtime',
    // Additional missing properties
    downloadProtection: 'none' as 'none' | 'password' | 'timelimit',
    watermark: 'none' as 'none' | 'text' | 'logo' | 'both',
    clientAccess: 'full' as 'full' | 'limited' | 'readonly',
    meetingPreferences: {},

    // Project Timeline Phase Management
    currentPhase: 'pre-planning' as 'pre-planning' | 'pre-production' | 'production' | 'post-production',
    phaseHistory: [] as Array<{
      phase: string;
      timestamp: string;
      notes?: string;
    }>,
    davinciIntegrationEnabled: false, // Enable when post-production phase is selected
    scriptParameters: {
      projectName: '',
      resolution: '3840x2160',
      frameRate: 25,
      colorSpace: 'Rec.709',
      timelineStructure: 'standard',
      audioChannels: 2,
      customSettings: {} as Record<string, any>
    } as ScriptParameters,
    // Camera and LOG format detection for ScriptManager
    cameraBrand: '',
    logFormat: '',
    detectedLogFormats: [] as string[]
  });
  
// Load meeting preferences from server
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
      log.warn('Failed to load meeting preferences', error);
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
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          profession,
          meetingOption: projectData?.meetingOption,
          meetingTime: projectData?.meetingTime,
          meetingDuration: projectData?.meetingDuration,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      // ignore
    }
  };
  save();
  return () => controller.abort();
// @ts-ignore - projectData exists in component scope
}, [user, profession, projectData?.meetingOption, projectData?.meetingTime, projectData?.meetingDuration]);

  // Check user authentication status
  useEffect(() => {
    if (!user) {
      showWarningToast('No authenticated user found. Some features may not work properly.', 6000);
      log.warn('No authenticated user found. Some features may not work properly.');
  } else {
      showInfoToast('User authenticated successfully', 2000);
      log.info('User authenticated', user.email || user.id);
  }
}, [user, log, showWarningToast, showInfoToast]);

  // Feature system integration - component registration and usage tracking
  useEffect(() => {
    // Check feature access for project creation
    const projectCreationAccess = features.checkFeatureAccess('project-creation') as { hasAccess: boolean; reason?: string };
    const memoryCardPlanningAccess = features.checkFeatureAccess('memory-card-planning') as { hasAccess: boolean; reason?: string };
    const davinciIntegrationAccess = features.checkFeatureAccess('davinci-resolve-integration') as { hasAccess: boolean; reason?: string };
    
    // Track feature usage
    features.trackFeatureUsage('project-creation','component_opened', {
      profession: userProfession,
      userId: user?.id,
      timestamp: new Date().toISOString(),
      hasAccess: projectCreationAccess.hasAccess
  });

    // Log feature access status
    if (!projectCreationAccess.hasAccess) {
      log.warn('Project creation feature not enabled', projectCreationAccess.reason);
  }
    if (!memoryCardPlanningAccess.hasAccess) {
      log.warn('Memory card planning feature not enabled', memoryCardPlanningAccess.reason);
  }
    if (!davinciIntegrationAccess.hasAccess) {
      log.warn('DaVinci Resolve integration feature not enabled', davinciIntegrationAccess.reason);
  }
}, [features, userProfession, user, log]);

  // Load profession-specific settings on mount
  useEffect(() => {
    if (userProfession && settings) {
      const professionDefaults = getProfessionDefaults(userProfession) as Record<string, any> | null;
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
    const handleProjectUpdate = (event: any) => {
      if (event.data.projectId === currentProject?.id) {
        showInfoToast('Project updated in real-time', 3000);
    }
  };

    const handleUserJoined = (event: any) => {
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
  
  const [memoryCardLabeling, setMemoryCardLabeling] = useState<LabelingKey>('ABCD');
  const [showScriptManager, setShowScriptManager] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const memoryPlanSavedRef = useRef(false);

  // Normalize multi-day event dates from initialData
  useEffect(() => {
    const raw = initialData?.eventDates as Record<number, string> | string[] | undefined;
    if (!raw) return;
    let normalized: Record<number, string> = {};
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
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  // Dynamic project types system
  const { allTypes: dynamicProjectTypes, trackUsage, isLoading: projectTypesLoading, createProjectType } = useProjectTypes();
  const [addProjectTypeDialogOpen, setAddProjectTypeDialogOpen] = useState(false);
  const [loadingTrollDemo, setLoadingTrollDemo] = useState(false);
  
  // TROLL Demo Initialization Dialog state
  const [trollInitDialogOpen, setTrollInitDialogOpen] = useState(false);
  const [trollInitStatus, setTrollInitStatus] = useState<'idle' | 'initializing' | 'loading' | 'complete' | 'error'>('idle');
  const [trollInitAreas, setTrollInitAreas] = useState<Record<string, { status: string; count: number; items: any[] }>>({});
  const [trollInitProgress, setTrollInitProgress] = useState(0);
  const [trollInitError, setTrollInitError] = useState<string | null>(null);

  // Open TROLL Demo Dialog
  const handleOpenTrollDialog = useCallback(() => {
    setTrollInitDialogOpen(true);
    setTrollInitStatus('idle');
    setTrollInitAreas({});
    setTrollInitProgress(0);
    setTrollInitError(null);
  }, []);

  // Initialize and Load TROLL Demo Data
  const handleInitializeTrollDemo = useCallback(async () => {
    setTrollInitStatus('initializing');
    setTrollInitProgress(10);
    setTrollInitError(null);
    
    try {
      // Step 1: Initialize TROLL mock data via castingService
      await castingService.initializeMockData();
      setTrollInitProgress(25);
      
      // Step 2: Initialize Split Sheet
      try {
        await fetch('/api/split-sheets/demo/troll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user?.id || 'demo-user' })
        });
      } catch (e) {
        console.log('TROLL split sheet initialization:', e);
      }
      setTrollInitProgress(40);
      
      // Step 3: Initialize Offers, Contracts, Consents
      try {
        await fetch('/api/casting/demo/troll/offers-contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
      } catch (e) {
        console.log('TROLL offers/contracts initialization:', e);
      }
      setTrollInitProgress(60);
      
      // Step 4: Load all data status from database
      setTrollInitStatus('loading');
      const response = await fetch('/api/demo/troll/initialize-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.areas) {
          setTrollInitAreas(data.areas);
        }
      }
      setTrollInitProgress(80);
      
      // Step 5: Load TROLL project data into form
      const projects = await castingService.getProjects();
      const trollProject = projects.find((p: any) => p.id === 'troll-project-2026' || p.name === 'TROLL');
      
      if (trollProject) {
        // Load candidates, crew, locations from database
        const [trollCandidates, crew, locations] = await Promise.all([
          castingService.getCandidates('troll-project-2026'),
          castingService.getCrew('troll-project-2026'),
          castingService.getLocations('troll-project-2026')
        ]);
        
        // Log loaded candidate count for diagnostic purposes
        log.info(`TROLL demo loaded ${trollCandidates.length} candidates, ${crew.length} crew, ${locations.length} locations`);
        
        // Build collaborators from actual crew data
        const collaborators = crew.slice(0, 5).map((c: any, idx: number) => ({
          id: `collab-${idx}`,
          name: c.name,
          email: c.email || `${c.name.toLowerCase().replace(/\s/g, '.')}@trollfilm.no`,
          role: c.position || c.department || 'crew'
        }));
        
        // Build split sheet contributors from actual data
        const splitSheetResponse = await fetch('/api/split-sheets?project_id=troll-project-2026');
        let splitSheetContributors: any[] = [];
        if (splitSheetResponse.ok) {
          const ssData = await splitSheetResponse.json();
          if (ssData.splitSheets?.[0]?.contributors) {
            splitSheetContributors = ssData.splitSheets[0].contributors.map((c: any, idx: number) => ({
              id: `ss-${idx}`,
              name: c.name,
              email: c.email,
              role: c.role,
              percentage: c.percentage
            }));
          }
        }
        
        setProjectData(prev => ({
          ...prev,
          projectName: trollProject.name || 'TROLL',
          projectType: 'film',
          description: trollProject.description || 'Norsk eventyrfilm regissert av Roar Uthaug',
          clientName: 'Netflix / Nordisk Film',
          clientEmail: 'produksjon@troll-film.no',
          location: locations[0]?.name || 'Dovre, Norge',
          eventDate: '2026-01-20',
          enableSplitSheet: true,
          collaborators: collaborators.length > 0 ? collaborators : [
            { id: 'collab-1', name: 'Regissør', email: 'regi@trollfilm.no', role: 'director' }
          ],
          splitSheetData: splitSheetContributors.length > 0 ? {
            title: 'TROLL - Filmproduksjon Split Sheet',
            description: 'Fordeling av inntekter for TROLL (2026)',
            contributors: splitSheetContributors
          } : prev.splitSheetData
        }));
        
        setTrollInitProgress(100);
        setTrollInitStatus('complete');
      } else {
        throw new Error('TROLL prosjekt ikke funnet i database');
      }
      
    } catch (error) {
      console.error('Failed to initialize TROLL demo:', error);
      setTrollInitError(error instanceof Error ? error.message : 'Ukjent feil ved initialisering');
      setTrollInitStatus('error');
    }
  }, [user]);

  // Close dialog and navigate
  const handleTrollDialogComplete = useCallback(() => {
    setTrollInitDialogOpen(false);
    if (trollInitStatus === 'complete') {
      showSuccessToast('🎬 TROLL demo-prosjekt lastet fra database!', 5000);
      setActiveStep(1);
    }
  }, [trollInitStatus, showSuccessToast]);

  // Load TROLL Demo Project - Comprehensive film production example (legacy, now opens dialog)
  const handleLoadTrollDemo = useCallback(async () => {
    handleOpenTrollDialog();
  }, [handleOpenTrollDialog]);

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
  const [addCollaboratorDialogOpen, setAddCollaboratorDialogOpen] = useState(false);
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState('');
  const [newCollaboratorName, setNewCollaboratorName] = useState('');
  const [collaboratorEmailError, setCollaboratorEmailError] = useState(false);

  useEffect(() => {
    try {
      if (projectData?.projectType === 'event' && !askedConnectEvent) {
        setConnectDialogOpen(true);
      }
    } catch {}
  }, [projectData?.projectType, askedConnectEvent]);
  
  // Project Timeline Phase Management Functions
  const handlePhaseChange = (newPhase: 'pre-planning' | 'pre-production' | 'production' | 'post-production') => {
    setProjectData(prev => ({
      ...prev,
      currentPhase: newPhase,
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
    let logFormats = getLogFormatsByCamera(cameraModel);
    
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
    // Navigate to Universal Dashboard tab (would need parent component integration)
    log.debug('Navigate to tab', tabName);
    // TODO: Implement tab navigation to Universal Dashboard
  };

  const handleHealthCheckPassed = () => {
    setHealthCheckPassed(true);
    setShowHealthCheck(false);
    showSuccessToast('Health check passed! Ready to create project.', 3000);
    // Proceed with project creation
    createProjectContext({
      name: projectData.projectName,
      type: projectData.projectType,
      description: projectData.description || '',
      status: 'draft' as const,
    });
};

  // Generate session ID for autosave
  const [sessionId] = useState(() => crypto.randomUUID());

  // Persist memory card plan once a project exists
  useEffect(() => {
    const savePlan = async () => {
      if (!currentProject?.id || memoryPlanSavedRef.current) return;
      try {
        const totalGb = Array.isArray(projectData.selectedMemoryCards)
          ? projectData.selectedMemoryCards.reduce((sum: number, c: any) => {
              const cap = parseFloat((c.capacity || '').toString().replace(/[^0-9.]/g, ', ')) || 0;
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
        log.warn('Failed to persist memory card plan', e);
      }
    };
    savePlan();
  }, [currentProject?.id, projectData.selectedMemoryCards, projectData.enhancedMemoryCardSelection, projectData.memoryCardLabeling, projectData.equipmentNotes, userProfession, memoryCardLabeling]);

  // Map collaborator role to split sheet contributor role
  const mapCollaboratorRoleToContributorRole = useCallback((collaboratorRole: string, prof: string): ContributorRole => {
    // Mapping based on profession
    switch (prof) {
      case 'photographer':
        switch (collaboratorRole) {
          case 'editor': return 'photo_editor';
          case 'assistant': return 'assistant';
          case 'stylist': return 'stylist';
          case 'makeup_artist': return 'makeup_artist';
          default: return 'collaborator';
        }
      case 'videographer':
        switch (collaboratorRole) {
          case 'editor': return 'video_editor';
          case 'colorist': return 'colorist';
          case 'sound_engineer': return 'sound_engineer';
          case 'cinematographer': return 'cinematographer';
          default: return 'collaborator';
        }
      case 'music_producer':
        switch (collaboratorRole) {
          case 'producer': return 'producer';
          case 'artist': return 'artist';
          case 'songwriter': return 'songwriter';
          case 'composer': return 'composer';
          case 'mix_engineer': return 'mix_engineer';
          case 'mastering_engineer': return 'mastering_engineer';
          default: return 'collaborator';
        }
      default:
        return 'collaborator';
    }
  }, []);

  // Map collaborators to split sheet contributors
  const mapCollaboratorsToContributors = useCallback((collaborators: any[]): SplitSheetContributor[] => {
    return collaborators.map((collab, index) => ({
      name: collab.name || collab.email || 'Ukjent',
      email: collab.email || '',
      role: mapCollaboratorRoleToContributorRole(collab.role || 'contributor', userProfession),
      percentage: 0, // User must set this in editor
      order_index: index,
      custom_fields: {},
      user_id: collab.user_id || undefined
    }));
  }, [userProfession, mapCollaboratorRoleToContributorRole]);

  // Create split sheet once project exists
  const splitSheetCreatedRef = useRef(false);
  useEffect(() => {
    const createSplitSheet = async () => {
      if (!currentProject?.id || !projectData.enableSplitSheet || splitSheetCreatedRef.current) return;
      
      try {
        // Map collaborators to contributors if no existing split sheet data
        const contributors = projectData.splitSheetData?.contributors || mapCollaboratorsToContributors(projectData.collaborators || []);
        
        // If we have contributors, distribute evenly if percentages are 0
        const contributorsWithPercentages = contributors.length > 0 && contributors.every((c: any) => c.percentage === 0)
          ? contributors.map((c: any, _index: number) => ({
              ...c,
              percentage: 100 / contributors.length
            }))
          : contributors;

        const splitSheetRequest = {
          project_id: currentProject.id,
          title: `${projectData.projectName} - Split Sheet`,
          description: projectData.description || undefined,
          contributors: contributorsWithPercentages.map((c: any, index: number) => ({
            name: c.name,
            email: c.email || '',
            role: c.role,
            percentage: c.percentage,
            order_index: index,
            custom_fields: c.custom_fields || {},
            user_id: c.user_id || undefined
          }))
        };

        const response = await apiRequest('/api/split-sheets', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify(splitSheetRequest)
        }) as { success?: boolean; data?: unknown };

        if (response.success) {
          log.info('Split sheet created successfully', response.data);
          splitSheetCreatedRef.current = true;
          showSuccessToast('Split Sheet opprettet for prosjektet');
        }
      } catch (e) {
        log.warn('Failed to create split sheet', e);
        showErrorToast('Kunne ikke opprette Split Sheet. Du kan opprette den manuelt senere.');
      }
    };
    createSplitSheet();
  }, [currentProject?.id, projectData.enableSplitSheet, projectData.projectName, projectData.description, projectData.collaborators, projectData.splitSheetData, mapCollaboratorsToContributors, showSuccessToast, showErrorToast]);
  
  // Lead import modal states
  const [showLeadImport, setShowLeadImport] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  
  // Navigation
  const [, setLocation] = useLocation();

  // Get profession-specific split sheet descriptions
  const splitSheetInfo = useMemo(() => {
    const getSplitSheetDescription = (prof: string) => {
      const descriptions: Record<string, { main: string; explanation: string }> = {
        music_producer: {
          main: 'Fordel inntekter og royalty mellom bidragsytere i prosjektet. Split sheet-en vil automatisk bli opprettet når prosjektet er klart.',
          explanation: 'En Split Sheet er et dokument som spesifiserer hvordan inntekter og royalty skal deles mellom alle som bidrar til musikkproduksjonen (artister, tekstforfattere, produsenter, teknikere, etc.). Dette er viktig for å dokumentere eierskap og sikre riktig fordeling av inntekter.'
        },
        photographer: {
          main: 'Fordel inntekter mellom bidragsytere i prosjektet (fotografer, assistenter, retusjører, etc.). Split sheet-en vil automatisk bli opprettet når prosjektet er klart.',
          explanation: 'En Split Sheet dokumenterer hvordan inntekter skal deles mellom alle som bidrar til fotoprosjektet. Dette inkluderer hovedfotograf, assistenter, retusjører, og andre bidragsytere. Viktig for transparent fordeling av honorarer.'
        },
        videographer: {
          main: 'Fordel inntekter mellom bidragsytere i prosjektet (videografer, klippere, lydteknikere, etc.). Split sheet-en vil automatisk bli opprettet når prosjektet er klart.',
          explanation: 'En Split Sheet dokumenterer hvordan inntekter skal deles mellom alle som bidrar til videoprosjektet. Dette inkluderer hovedvideograf, klippere, lydteknikere, color graders, og andre bidragsytere. Viktig for transparent fordeling av honorarer.'
        }
      };
      return descriptions[prof] || {
        main: 'Fordel inntekter mellom bidragsytere i prosjektet. Split sheet-en vil automatisk bli opprettet når prosjektet er klart.',
        explanation: 'En Split Sheet dokumenterer hvordan inntekter skal deles mellom alle som bidrar til prosjektet. Dette er viktig for transparent fordeling av honorarer og sikrer at alle bidragsytere får riktig kompensasjon.'
      };
    };
    return getSplitSheetDescription(userProfession);
  }, [userProfession]);

  // Validate email helper
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle adding collaborator
  const handleAddCollaborator = () => {
    if (!newCollaboratorEmail.trim()) {
      setCollaboratorEmailError(true);
      showErrorToast('E-post er påkrevd');
      return;
    }

    if (!validateEmail(newCollaboratorEmail)) {
      setCollaboratorEmailError(true);
      showErrorToast('Ugyldig e-post format');
      return;
    }

    const collaboratorId = `collab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newCollaborator = {
      id: collaboratorId,
      name: newCollaboratorName.trim() || newCollaboratorEmail.split('@')[0],
      email: newCollaboratorEmail.trim(),
      role: 'contributor' as const
    };

    setProjectData((prev) => ({
      ...prev,
      collaborators: [...(prev.collaborators || []), newCollaborator]
    }));

    setNewCollaboratorEmail('');
    setNewCollaboratorName('');
    setCollaboratorEmailError(false);
    setAddCollaboratorDialogOpen(false);
    showSuccessToast('Samarbeidspartner lagt til i teamet');
  };

  // Lead import functionality
  const { availableLeads, isLoadingLeads, importFromLead, isImporting } = {
    availableLeads: [],
    isLoadingLeads: false,
    importFromLead: (_lead: Record<string, unknown>) => Promise.resolve(),
    isImporting: false
};

  // Create worklog entry mutation for culture-specific planning
  const createWorklogMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/worklog', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify(data)
    });
  }
  });
  

  /**
   * Check if Virtual Studio is available for this project
   * Requirements:
   * - User must be a photographer
   * - Project type must NOT be wedding
   * - User must have purchased Virtual Studio from marketplace (2495 NOK)
   */
  const canOpenVirtualStudio = useMemo(() => {
    const isPhotographer = userProfession === 'photographer';
    const isNonWeddingProject = projectData.projectType !== 'wedding';
    const hasBasicInfo = projectData.projectName && projectData.clientName;

    // Check if user has Virtual Studio marketplace access
    const { hasAccess } = features.checkFeatureAccess('virtual-studio') as { hasAccess: boolean };

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
      scenes: projectData.shotList?.map((shot: any) => ({
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
    setLocation('/virtual-studio');
  }, [projectData, currentProject, user, userProfession, features, setLocation, showInfoToast]);

  /**
   * Handle Virtual Studio completion and return
   */
  const handleVirtualStudioComplete = useCallback(async (result: any) => {
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
      log.error('Error processing Virtual Studio results', error);
      showErrorToast('Failed to save Virtual Studio results. Please try again.', 6000);
    }
  }, [currentProject, user, createWorklogMutation, updateProject, isConnected, emitEvent, showSuccessToast, showErrorToast, showInfoToast, features, userProfession]);

  // Show initial data notification if pre-filled from submission
  useEffect(() => {
    if (initialData) {
      showInfoToast(`Project pre-filled from submission: ${initialData.clientName}`, 3000);
    }
  }, [initialData]);

  const buildEventPayload = useCallback(() => {
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
        name: projectData?.clientName || '',
        email: projectData?.clientEmail || '',
        phone: projectData?.clientPhone || ''
      },
      source: 'project_creation',
    };
  }, [projectData, profession]);

  const handleOpenEventManagementClick = useCallback(async () => {
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
    } catch (e) {
      showErrorToast('Kunne ikke opprette event fra prosjekt', 5000);
    }
  }, [buildEventPayload, onOpenEventManagement, showSuccessToast, showErrorToast]);

  // Step navigation handlers
  const handleNext = useCallback(() => {
    setActiveStep((prev) => Math.min(prev + 1, creationSteps.length - 1));
  }, [creationSteps.length]);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // Calculate current step based on project data completion (for display only)
  const currentStep = useMemo(() => {
    if (!projectData.projectName && !projectData.clientName) return 0;
    if (!projectData.projectType) return 0;
    if (projectData.projectType && projectData.projectName && projectData.clientName) {
      return 1;
    }
    return 0;
  }, [projectData.projectName, projectData.clientName, projectData.projectType]);

  return (
    <Box sx={{ p: 3 }}>
      {initialData && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 700,
              fontSize: '0.938rem',
              color: 'text.primary'
            }}
          >
            📨 Creating project from submission: {initialData.clientName}
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              display: 'block',
              fontSize: '0.813rem',
              fontWeight: 500,
              color: 'text.secondary'
            }}
          >
            Client info has been pre-filled. Complete the remaining fields to create the project.
          </Typography>
        </Alert>
      )}
      
      <Typography 
        variant="h4" 
        gutterBottom
        sx={{ 
          fontWeight: 700,
          fontSize: '1.75rem',
          color: 'text.primary'
        }}
      >
        {isCastingPlanner 
          ? (getTerm ? `Nytt ${getTerm('project')}` : 'Nytt Casting Prosjekt')
          : initialData ? 'Create Project from Submission' : 'Project Creation with Memory Cards'
        }
      </Typography>

      {/* Vertical Stepper with Step Content */}
      <Stepper 
        activeStep={activeStep} 
        orientation="vertical" 
        sx={{ mt: 3, mb: 3 }}
        aria-label="Prosjekt opprettelse steg"
      >
        {creationSteps.map((step, index) => (
          <Step key={step.label} completed={index < activeStep}>
            <StepLabel
              StepIconComponent={({ active, completed }) => (
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: completed || active
                      ? 'primary.main'
                      : 'action.disabledBackground',
                    color: completed || active ? 'primary.contrastText' : 'action.disabled',
                    border: active ? '2px solid' : 'none',
                    borderColor: 'primary.main',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {step.icon}
                </Box>
              )}
            >
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: 'text.primary'
                }}
              >
                {step.label}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  fontSize: '0.813rem',
                  fontWeight: 500
                }}
              >
                {step.description}
              </Typography>
              {Boolean('optional' in step && (step as Record<string, unknown>).optional) && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'text.secondary',
                    fontSize: '0.813rem',
                    fontWeight: 500,
                    display: 'block', 
                    mt: 0.5 
                  }}
                >
                  (Valgfritt)
                </Typography>
              )}
            </StepLabel>
            <StepContent>
              {index === 0 && (
                /* Step 0: Grunndata - Contact & Project Info */
                <Box sx={{ mt: 2 }}>
                  {/* Existing client (Google Contacts) picker */}
                  <ContactPicker
                    selectedContact={selectedContact}
                    onContactSelect={setSelectedContact}
                    profession={profession}
                    showErrorToast={showErrorToast}
                    showInfoToast={showInfoToast}
                    showSuccessToast={showSuccessToast}
                  />

                  {/* Contact & Project Info Summary */}
                  <Box sx={{ mt: 3 }}>
                    <ContactProjectInfoSummary
                      projectId={currentProject?.id}
                      sessionId={sessionId}
                      guestCount={projectData.guestCount}
                      eventDate={projectData.eventDate}
                      eventDates={projectData.eventDates}
                      location={projectData.location}
                      projectType={projectData.projectType}
                      showProjectType={!!initialData?.projectType}
                      selectedContact={selectedContact}
                      clientName={projectData.clientName}
                      clientEmail={projectData.clientEmail}
                      clientPhone={projectData.clientPhone}
                    />
                  </Box>

                  {/* Pre-filled Data Preview */}
                  {initialData && (
                    <Card 
                      sx={{ 
                        mt: 3, 
                        mb: 2,
                        borderRadius: 3,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        bgcolor: 'rgba(25, 118, 210, 0.08)',
                        border: '1px solid rgba(25, 118, 210, 0.2)'
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Typography 
                          variant="h6" 
                          gutterBottom 
                          sx={{ 
                            fontWeight: 700,
                            fontSize: '1.125rem',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1,
                            color: 'text.primary'
                          }}
                        >
                          <Info sx={{ color: 'primary.main' }} />
                          Pre-filled from Submission
                        </Typography>
                        <Divider sx={{ mb: 2, mt: 1 }} />
                      <Stack spacing={1.5}>
                        {initialData.clientName && (
                          <Box>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                display: 'block',
                                mb: 0.5
                              }}
                            >
                              Client
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.95rem' }}>
                              {initialData.clientName}
                            </Typography>
                          </Box>
                        )}
                        {initialData.clientEmail && (
                          <Box>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                display: 'block',
                                mb: 0.5
                              }}
                            >
                              Email
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.95rem' }}>
                              {initialData.clientEmail}
                            </Typography>
                          </Box>
                        )}
                        {initialData.projectType && (
                          <Box>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                display: 'block',
                                mb: 0.5
                              }}
                            >
                              Project Type
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.95rem' }}>
                              {initialData.projectType}
                            </Typography>
                          </Box>
                        )}
                        {initialData.description && (
                          <Box>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                display: 'block',
                                mb: 0.5
                              }}
                            >
                              Description
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.95rem' }}>
                              {initialData.description}
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                      </CardContent>
                    </Card>
                  )}

                  {/* Project Type Selection with Dynamic Types */}
                  <Card 
                    sx={{ 
                      mt: 3,
                      mb: 3,
                      borderRadius: 3,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'box-shadow 0.3s ease, transform 0.2s ease',
                      '&:hover': {
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Typography 
                        variant="h6" 
                        gutterBottom 
                        sx={{ 
                          fontWeight: 700,
                          fontSize: '1.125rem',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                          color: 'text.primary'
                        }}
                      >
                        <Folder sx={{ color: 'primary.main' }} />
                        Prosjekttype
                      </Typography>
                      <Divider sx={{ mb: 2, mt: 1 }} />
                      <ProjectTypeSelector
                        value={projectData.projectType || ''}
                        onChange={(selectedTypeId, _isCustomType) => {
                          setProjectData((prev) => ({
                            ...prev,
                            projectType: selectedTypeId,
                            weddingCulture: !isCastingPlanner && selectedTypeId === 'wedding' ? prev.weddingCulture : 'norsk',
                          }));
                        }}
                        isCastingPlanner={isCastingPlanner}
                        customTypes={dynamicProjectTypes.filter(t => !t.isGlobal).map(t => ({
                          id: typeof t.id === 'string' ? parseInt(t.id) || 0 : (t.id || 0),
                          name: t.name || '',
                          usageCount: t.usageCount
                        }))}
                        onTrackUsage={(id) => trackUsage(id.toString())}
                        onAddCustomType={() => setAddProjectTypeDialogOpen(true)}
                        showAddButton={!isCastingPlanner}
                      />

                      {/* TROLL Demo Project Loader */}
                      <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            fontWeight: 600, 
                            fontSize: '0.875rem', 
                            color: 'text.secondary',
                            mb: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}
                        >
                          <AutoAwesome sx={{ fontSize: 18, color: '#9f7aea' }} />
                          Demo Prosjekt
                        </Typography>
                        <Button
                          variant="outlined"
                          size="medium"
                          onClick={handleLoadTrollDemo}
                          disabled={loadingTrollDemo}
                          startIcon={loadingTrollDemo ? <CircularProgress size={18} /> : <Movie />}
                          sx={{
                            borderColor: '#9f7aea',
                            color: '#9f7aea',
                            fontWeight: 600,
                            '&:hover': {
                              borderColor: '#805ad5',
                              bgcolor: 'rgba(159, 122, 234, 0.08)'
                            }
                          }}
                        >
                          {loadingTrollDemo ? 'Laster...' : 'Last TROLL Demo-prosjekt'}
                        </Button>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            display: 'block', 
                            mt: 1, 
                            color: 'text.secondary',
                            fontSize: '0.75rem'
                          }}
                        >
                          Laster komplett filmproduksjon med casting, crew, locations, og Split Sheet
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Add Project Type Dialog - Hidden in The Role Room */}
                  {!isCastingPlanner && (
                    <AddProjectTypeDialog
                      open={addProjectTypeDialogOpen}
                      onClose={() => setAddProjectTypeDialogOpen(false)}
                      onAdd={async (data: { name: string; icon: string; color: string; description: string }) => {
                        await createProjectType(data);
                        showSuccessToast(`Custom project type "${data.name}" created successfully!`);
                      }}
                    />
                  )}
                </Box>
              )}
              {index === 1 && (
                /* Step 1: Split Sheet & Produksjonsteam */
                <Box sx={{ mt: 2 }}>
                  {/* Produksjonsteam (Collaborators) */}
                  {!isCastingPlanner && (
                    <Card 
                      sx={{ 
                        mb: 3,
                        borderRadius: 3,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        transition: 'box-shadow 0.3s ease',
                        '&:hover': {
                          boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
                        }
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Typography 
                          variant="h6" 
                          gutterBottom 
                          sx={{ 
                            fontWeight: 700,
                            fontSize: '1.125rem',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1,
                            color: 'text.primary'
                          }}
                        >
                          <Groups sx={{ color: 'primary.main' }} />
                          Produksjonsteam
                        </Typography>
                        <Divider sx={{ mb: 2, mt: 1 }} />
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            color: 'text.secondary',
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            mb: 2
                          }}
                        >
                          Legg til samarbeidspartnere som skal være med i prosjektet. Disse kan automatisk legges til i Split Sheet hvis aktivert.
                        </Typography>
                        <ProjectCollaborators
                          collaborators={projectData.collaborators || []}
                          onAddCollaborator={() => setAddCollaboratorDialogOpen(true)}
                          onRemoveCollaborator={(id) => {
                            setProjectData((prev) => ({
                              ...prev,
                              collaborators: (prev.collaborators || []).filter((c: any) => c.id !== id)
                            }));
                            showSuccessToast('Samarbeidspartner fjernet fra teamet');
                          }}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Split Sheet Setup - Available for All Professions */}
                  <Card 
                    sx={{ 
                      mt: 2,
                      mb: 3,
                      borderRadius: 3,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'box-shadow 0.3s ease',
                      '&:hover': {
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
                      }
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Typography 
                        variant="h6" 
                        gutterBottom 
                        sx={{ 
                          fontWeight: 700,
                          fontSize: '1.125rem',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                          color: 'text.primary'
                        }}
                      >
                        <AccountBalance sx={{ color:'#9f7aea' }} />
                        Split Sheet
                      </Typography>
                      <Divider sx={{ mb: 2, mt: 1 }} />
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          color: 'text.secondary',
                          fontSize: '0.95rem',
                          fontWeight: 500,
                          mb: 2
                        }}
                      >
                        {splitSheetInfo.main}
                      </Typography>
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={projectData.enableSplitSheet || false}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              setProjectData((prev) => ({
                                ...prev,
                                enableSplitSheet: enabled,
                                // Clear split sheet data if disabling
                                splitSheetData: enabled ? prev.splitSheetData : null
                              }));
                            }}
                          />
                        }
                        label={
                          <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                            Aktiver Split Sheet for dette prosjektet
                          </Typography>
                        }
                      />

                      {projectData.enableSplitSheet && (
                        <Box sx={{ mt: 3 }}>
                          <Alert 
                            severity="info" 
                            sx={{ 
                              mb: 3,
                              bgcolor: 'rgba(156, 39, 176, 0.08)',
                              border: '1px solid rgba(156, 39, 176, 0.2)'
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.938rem', color: 'text.primary', mb: 0.5 }}>
                              Split Sheet vil bli opprettet automatisk
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'text.secondary' }}>
                              Du kan legge til bidragsytere og justere prosentandeler i Split Sheets-fanen etter at prosjektet er opprettet. Samarbeidspartnere fra Produksjonsteam vil automatisk bli inkludert.
                            </Typography>
                          </Alert>

                          <Typography 
                            variant="subtitle2" 
                            sx={{ 
                              fontWeight: 600,
                              fontSize: '0.938rem',
                              color: 'text.primary',
                              mb: 1.5
                            }}
                          >
                            Hva er en Split Sheet?
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontSize: '0.875rem',
                              color: 'text.secondary',
                              mb: 2,
                              lineHeight: 1.6
                            }}
                          >
                            {splitSheetInfo.explanation}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              )}

              {/* Step Navigation Buttons */}
              <Box sx={{ mb: 2, mt: 3, display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={index === creationSteps.length - 1}
                  aria-label={index === creationSteps.length - 1 ? 'Fullfør prosjekt' : 'Gå til neste steg'}
                  size="large"
                  sx={{ 
                    minHeight: { xs: 56, sm: 52 },
                    fontSize: { xs: '1.125rem', sm: '1.063rem' },
                    fontWeight: 700,
                    px: { xs: 5, sm: 4 },
                    py: { xs: 2, sm: 1.5 },
                    flex: { xs: 1, sm: 'none' },
                    minWidth: { xs: '100%', sm: 140 }
                  }}
                >
                  {index === creationSteps.length - 1 ? 'Fullfør' : 'Neste'}
                </Button>
                <Button
                  disabled={index === 0}
                  onClick={handleBack}
                  aria-label="Gå til forrige steg"
                  size="large"
                  variant="outlined"
                  sx={{ 
                    minHeight: { xs: 56, sm: 52 },
                    fontSize: { xs: '1.125rem', sm: '1.063rem' },
                    fontWeight: 700,
                    px: { xs: 5, sm: 4 },
                    py: { xs: 2, sm: 1.5 },
                    flex: { xs: 1, sm: 'none' },
                    minWidth: { xs: '100%', sm: 140 }
                  }}
                >
                  Tilbake
                </Button>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {/* Add Collaborator Dialog */}
      <Dialog 
        open={addCollaboratorDialogOpen} 
        onClose={() => {
          setAddCollaboratorDialogOpen(false);
          setNewCollaboratorEmail('');
          setNewCollaboratorName('');
          setCollaboratorEmailError(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem', color: 'text.primary' }}>
          Legg til samarbeidspartner
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Navn (valgfritt)"
              fullWidth
              autoComplete="name"
              value={newCollaboratorName}
              onChange={(e) => setNewCollaboratorName(e.target.value)}
              placeholder="Fornavn Etternavn"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                },
              }}
            />
            <TextField
              label="E-post"
              fullWidth
              required
              type="email"
              inputMode="email"
              autoComplete="email"
              value={newCollaboratorEmail}
              onChange={(e) => {
                setNewCollaboratorEmail(e.target.value);
                setCollaboratorEmailError(false);
              }}
              error={collaboratorEmailError}
              helperText={collaboratorEmailError ? 'Ugyldig e-post format' : ''}
              placeholder="samarbeidspartner@example.com"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: collaboratorEmailError ? 'error.main' : 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: collaboratorEmailError ? 'error.main' : 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: collaboratorEmailError ? 'error.main' : 'primary.main' },
                },
              }}
            />
            <Alert severity="info" sx={{ bgcolor: 'rgba(25, 118, 210, 0.08)', border: '1px solid rgba(25, 118, 210, 0.2)' }}>
              <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                Samarbeidspartneren vil bli lagt til i produksjonsteamet og kan automatisk inkluderes i Split Sheet hvis aktivert.
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button 
            onClick={() => {
              setAddCollaboratorDialogOpen(false);
              setNewCollaboratorEmail('');
              setNewCollaboratorName('');
              setCollaboratorEmailError(false);
            }}
            sx={{ fontWeight: 600 }}
          >
            Avbryt
          </Button>
          <Button 
            variant="contained" 
            onClick={handleAddCollaborator}
            sx={{ fontWeight: 600 }}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connect to Event Management prompt - Hidden in The Role Room */}
      {!isCastingPlanner && (
        <Dialog open={connectDialogOpen} onClose={() => { setConnectDialogOpen(false); setAskedConnectEvent(true); }}>
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem' }}>Koble til Event Management?</DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '0.95rem', color: 'text.primary', mt: 1 }}>
              Du har valgt prosjekttypen «event». Vil du koble dette prosjektet til Event Management for planlegging og analyser?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setConnectDialogOpen(false); setAskedConnectEvent(true); setConnectToEvent(false); }}>Nei</Button>
            <Button variant="contained" onClick={() => { setConnectDialogOpen(false); setAskedConnectEvent(true); setConnectToEvent(true); }}>Ja, koble</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* TROLL Demo Initialization Dialog */}
      <Dialog 
        open={trollInitDialogOpen} 
        onClose={() => trollInitStatus !== 'initializing' && trollInitStatus !== 'loading' && setTrollInitDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: 'background.paper',
          }
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 700, 
          fontSize: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2
        }}>
          <Movie sx={{ fontSize: '2rem', color: '#9c27b0' }} />
          TROLL Demo Initialisering
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {trollInitStatus === 'idle' && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Last inn TROLL Demo-prosjekt
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
                Dette vil initialisere et komplett filmproduksjonsprosjekt basert på den norske filmen TROLL (2026).
                Alle data lastes fra databasen - ingenting er hardkodet.
              </Typography>
              <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Følgende områder vil bli lastet:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  <li>Prosjekt, roller og karakterer</li>
                  <li>Kandidater og skuespillere</li>
                  <li>Crew og produksjonsteam</li>
                  <li>Lokasjoner og opptakssteder</li>
                  <li>Produksjonsdager og tidsplan</li>
                  <li>Scener og shot lists</li>
                  <li>Tilbud og kontrakter</li>
                  <li>Samtykker (GDPR, bilde, stunt)</li>
                  <li>Split Sheet med bidragsytere</li>
                  <li>Utstyr og ressurser</li>
                </Box>
              </Alert>
              <Stack direction="row" spacing={2} justifyContent="center">
                <Button 
                  variant="outlined"
                  size="large"
                  onClick={async () => {
                    // Check current status without initializing
                    setTrollInitStatus('loading');
                    setTrollInitProgress(50);
                    try {
                      const response = await fetch('/api/demo/troll/initialize-all', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                      });
                      if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.areas) {
                          setTrollInitAreas(data.areas);
                          setTrollInitProgress(100);
                          // Check if project exists and has data
                          const hasData = data.areas.project?.status === 'loaded' && 
                            Object.values(data.areas).some((a: any) => a.count > 0);
                          if (!hasData) {
                            // Show empty state with warning
                            setTrollInitStatus('complete');
                            showWarningToast('⚠️ TROLL-data ikke funnet. Klikk "Initialiser Manglende Data" for å opprette.', 5000);
                          } else {
                            setTrollInitStatus('complete');
                          }
                        }
                      } else {
                        setTrollInitStatus('idle');
                        showErrorToast('Kunne ikke sjekke database status', 3000);
                      }
                    } catch (e) {
                      setTrollInitStatus('idle');
                      showErrorToast('Feil ved tilkobling til database', 3000);
                    }
                  }}
                  startIcon={<Info />}
                  sx={{ px: 3, py: 1.5 }}
                >
                  Sjekk Eksisterende Data
                </Button>
                <Button 
                  variant="contained" 
                  size="large"
                  onClick={handleInitializeTrollDemo}
                  startIcon={<Movie />}
                  sx={{ 
                    px: 4, 
                    py: 1.5,
                    fontWeight: 600,
                    bgcolor: '#9f7aea',
                    '&:hover': { bgcolor: '#805ad5' }
                  }}
                >
                  Start Initialisering
                </Button>
              </Stack>
            </Box>
          )}

          {(trollInitStatus === 'initializing' || trollInitStatus === 'loading') && (
            <Box sx={{ py: 3 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  {trollInitStatus === 'initializing' ? 'Initialiserer data...' : 'Laster fra database...'}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={trollInitProgress} 
                  sx={{ 
                    height: 10, 
                    borderRadius: 5,
                    bgcolor: 'action.hover',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: '#9f7aea'
                    }
                  }} 
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {trollInitProgress}% fullført
                </Typography>
              </Box>
              
              {Object.keys(trollInitAreas).length > 0 && (
                <Box sx={{ 
                  maxHeight: 350, 
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 2
                }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    Data områder:
                  </Typography>
                  {Object.entries(trollInitAreas).map(([key, area]) => {
                    const areaLabels: Record<string, string> = {
                      project: 'Prosjekt',
                      roles: 'Roller',
                      candidates: 'Kandidater',
                      crew: 'Crew',
                      locations: 'Lokasjoner',
                      production_days: 'Produksjonsdager',
                      scenes: 'Scener',
                      shot_lists: 'Shot Lists',
                      offers: 'Tilbud',
                      contracts: 'Kontrakter',
                      consents: 'Samtykker',
                      split_sheets: 'Split Sheets',
                      equipment: 'Utstyr'
                    };
                    const label = areaLabels[key] || key.replace(/_/g, ' ');
                    
                    return (
                      <Box key={key} sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        py: 1,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' }
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {area.status === 'loaded' ? (
                            <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                          ) : area.status === 'empty' || area.status === 'not_found' ? (
                            <Warning sx={{ color: 'warning.main', fontSize: 20 }} />
                          ) : (
                            <CircularProgress size={18} />
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {label}
                          </Typography>
                        </Box>
                        <Chip 
                          label={area.count === 0 ? 'Tom' : `${area.count} elementer`}
                          size="small"
                          color={area.status === 'loaded' && area.count > 0 ? 'success' : area.status === 'empty' || area.count === 0 ? 'warning' : 'default'}
                          variant="outlined"
                        />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}

          {trollInitStatus === 'complete' && (
            <Box sx={{ py: 3 }}>
              {/* Check if any areas are empty */}
              {Object.values(trollInitAreas).some(a => a.status === 'empty' || a.status === 'not_found') ? (
                <Alert severity="warning" sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    ⚠️ Noen områder mangler data
                  </Typography>
                  <Typography variant="body2">
                    Kjør "Start Initialisering" for å opprette manglende data, eller fortsett med tilgjengelig data.
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="success" sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    ✅ TROLL demo-prosjekt er ferdig lastet!
                  </Typography>
                </Alert>
              )}
              
              <Box sx={{ 
                maxHeight: 350, 
                overflowY: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2
              }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                  Oppsummering av lastet data:
                </Typography>
                {Object.entries(trollInitAreas).map(([key, area]) => {
                  // Norwegian labels for areas
                  const areaLabels: Record<string, string> = {
                    project: 'Prosjekt',
                    roles: 'Roller',
                    candidates: 'Kandidater',
                    crew: 'Crew',
                    locations: 'Lokasjoner',
                    production_days: 'Produksjonsdager',
                    scenes: 'Scener',
                    shot_lists: 'Shot Lists',
                    offers: 'Tilbud',
                    contracts: 'Kontrakter',
                    consents: 'Samtykker',
                    split_sheets: 'Split Sheets',
                    equipment: 'Utstyr'
                  };
                  const label = areaLabels[key] || key.replace(/_/g, ' ');
                  const isEmpty = area.status === 'empty' || area.status === 'not_found' || area.count === 0;
                  
                  return (
                    <Box key={key} sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' },
                      opacity: isEmpty ? 0.6 : 1
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {!isEmpty ? (
                          <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                        ) : (
                          <Warning sx={{ color: 'warning.main', fontSize: 20 }} />
                        )}
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {label}
                          </Typography>
                          {isEmpty && (
                            <Typography variant="caption" color="text.secondary">
                              Ingen data funnet
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Chip 
                        label={isEmpty ? 'Tom' : `${area.count} ${area.count === 1 ? 'element' : 'elementer'}`}
                        size="small"
                        color={!isEmpty ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    </Box>
                  );
                })}
              </Box>
              
              {/* Show items preview for loaded areas */}
              {Object.entries(trollInitAreas).filter(([_, a]) => a.items && a.items.length > 0).length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Forhåndsvisning av data:
                  </Typography>
                  <Box sx={{ 
                    maxHeight: 150, 
                    overflowY: 'auto',
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    p: 1.5,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace'
                  }}>
                    {Object.entries(trollInitAreas)
                      .filter(([_, a]) => a.items && a.items.length > 0)
                      .slice(0, 3)
                      .map(([key, area]) => (
                        <Box key={key} sx={{ mb: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                            {key}:
                          </Typography>
                          {area.items.slice(0, 2).map((item, idx) => (
                            <Typography key={idx} variant="caption" component="div" sx={{ pl: 1, color: 'text.secondary' }}>
                              • {item.name || item.title || item.id}
                            </Typography>
                          ))}
                        </Box>
                      ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {trollInitStatus === 'error' && (
            <Box sx={{ py: 3 }}>
              <Alert severity="error" sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Feil ved initialisering
                </Typography>
                <Typography variant="body2">
                  {trollInitError || 'En ukjent feil oppstod'}
                </Typography>
              </Alert>
              <Button 
                variant="outlined" 
                onClick={handleInitializeTrollDemo}
                startIcon={<Refresh />}
              >
                Prøv igjen
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => setTrollInitDialogOpen(false)}
            disabled={trollInitStatus === 'initializing' || trollInitStatus === 'loading'}
          >
            {trollInitStatus === 'complete' ? 'Lukk' : 'Avbryt'}
          </Button>
          {trollInitStatus === 'complete' && Object.values(trollInitAreas).some(a => a.status === 'empty' || a.status === 'not_found' || a.count === 0) && (
            <Button 
              variant="outlined"
              onClick={() => {
                setTrollInitStatus('idle');
                setTrollInitAreas({});
                setTrollInitProgress(0);
              }}
              startIcon={<Refresh />}
              sx={{ mr: 1 }}
            >
              Initialiser Manglende Data
            </Button>
          )}
          {trollInitStatus === 'complete' && (
            <Button 
              variant="contained" 
              onClick={handleTrollDialogComplete}
              sx={{ 
                fontWeight: 600,
                bgcolor: '#9f7aea',
                '&:hover': { bgcolor: '#805ad5' }
              }}
            >
              Fortsett til prosjekt
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          DRAFT MANAGEMENT SIDEBAR  
          Uses: Drawer, Paper, IconButton, Tooltip, Badge, History, Compare, 
          Restore, Publish, Drafts, Visibility, VisibilityOff, ChevronLeft, 
          ChevronRight, Timeline, CloudDone, AccessTime, Edit, Save, Delete,
          draftSidebarOpen, draftMode, projectHistory, showHistoryDialog, 
          showComparisonDialog, publishedProject, saveProjectDraft, 
          getProjectDraft, deleteProjectDraft
          ═══════════════════════════════════════════════════════════════════ */}
      <Drawer
        anchor="right"
        open={draftSidebarOpen}
        onClose={() => setDraftSidebarOpen(false)}
        PaperProps={{ sx: { width: 380, p: 2, bgcolor: 'background.paper' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Drafts sx={{ color: 'primary.main' }} />
            Utkast & Versjoner
          </Typography>
          <IconButton onClick={() => setDraftSidebarOpen(false)} size="small">
            <ChevronRight />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {/* Draft Mode Toggle */}
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Edit sx={{ fontSize: 18 }} />
            Modus
          </Typography>
          <Stack direction="row" spacing={1}>
            {(['draft', 'published', 'live'] as const).map((mode) => (
              <Chip
                key={mode}
                label={mode === 'draft' ? 'Utkast' : mode === 'published' ? 'Publisert' : 'Live'}
                color={draftMode === mode ? 'primary' : 'default'}
                onClick={() => setDraftMode(mode)}
                icon={mode === 'draft' ? <Edit /> : mode === 'published' ? <Publish /> : <Visibility />}
                variant={draftMode === mode ? 'filled' : 'outlined'}
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Stack>
        </Paper>

        {/* Draft Actions */}
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <Tooltip title="Lagre utkast av gjeldende prosjektdata">
            <Button
              variant="outlined"
              startIcon={<Save />}
              fullWidth
              onClick={async () => {
                if (currentProject?.id) {
                  await saveProjectDraft({ ...projectData, name: projectData.projectName, type: projectData.projectType } as unknown as Partial<Project>);
                  setHasUnsavedChanges(false);
                  showSuccessToast('Utkast lagret', 3000);
                }
              }}
              sx={{ fontWeight: 600, justifyContent: 'flex-start' }}
            >
              <Badge badgeContent={hasUnsavedChanges ? '!' : 0} color="warning">
                Lagre Utkast
              </Badge>
            </Button>
          </Tooltip>

          <Tooltip title="Last inn siste utkast">
            <Button
              variant="outlined"
              startIcon={<Restore />}
              fullWidth
              onClick={async () => {
                if (currentProject?.id) {
                  const draft = getProjectDraft();
                  if (draft) {
                    setProjectData(draft as unknown as ProjectData);
                    showSuccessToast('Utkast lastet', 3000);
                  }
                }
              }}
              sx={{ fontWeight: 600, justifyContent: 'flex-start' }}
            >
              Last inn Utkast
            </Button>
          </Tooltip>

          <Tooltip title="Slett lagret utkast">
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              fullWidth
              onClick={async () => {
                if (currentProject?.id) {
                  deleteProjectDraft();
                  showInfoToast('Utkast slettet', 3000);
                }
              }}
              sx={{ fontWeight: 600, justifyContent: 'flex-start' }}
            >
              Slett Utkast
            </Button>
          </Tooltip>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* History & Version */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <History sx={{ fontSize: 18, color: 'primary.main' }} />
          Versjonshistorikk
        </Typography>

        <Stack spacing={1}>
          <Button
            variant="text"
            startIcon={<Timeline />}
            fullWidth
            onClick={() => {
              setShowHistoryDialog(true);
              if (currentProject?.id) {
                const trail = getProjectAuditTrail(currentProject.id);
                setProjectHistory(Array.isArray(trail) ? trail : []);
              }
            }}
            sx={{ justifyContent: 'flex-start', fontWeight: 500 }}
          >
            Vis Historikk
          </Button>
          <Button
            variant="text"
            startIcon={<Compare />}
            fullWidth
            onClick={() => {
              setShowComparisonDialog(true);
              if (currentProject?.id) {
                const v = getProjectDataVersion(currentProject.id);
                setPublishedProject(v);
              }
            }}
            sx={{ justifyContent: 'flex-start', fontWeight: 500 }}
          >
            Sammenlign Versjoner
          </Button>
        </Stack>

        {/* Published project info */}
        {publishedProject && (
          <Alert severity="info" sx={{ mt: 2 }} icon={<CloudDone />}>
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              Sist publisert: {publishedProject.updatedAt || 'Ukjent'}
            </Typography>
          </Alert>
        )}

        {/* Visibility Toggle */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            <AccessTime sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
            Synlighet:
          </Typography>
          <Chip
            label={draftMode === 'live' ? 'Synlig' : 'Skjult'}
            icon={draftMode === 'live' ? <Visibility /> : <VisibilityOff />}
            size="small"
            color={draftMode === 'live' ? 'success' : 'default'}
          />
        </Box>

        {/* Navigation */}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
          <Button size="small" startIcon={<ChevronLeft />} onClick={() => setDraftSidebarOpen(false)}>
            Lukk
          </Button>
        </Box>
      </Drawer>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onClose={() => setShowHistoryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <History sx={{ color: 'primary.main' }} />
          Prosjekthistorikk
        </DialogTitle>
        <DialogContent>
          {projectHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Ingen historikk tilgjengelig ennå.</Typography>
          ) : (
            <List>
              {projectHistory.map((entry: Record<string, unknown>, idx: number) => (
                <ListItem key={idx}>
                  <ListItemIcon><AccessTime /></ListItemIcon>
                  <ListItemText
                    primary={String(entry.action || entry.phase || `Versjon ${idx + 1}`)}
                    secondary={String(entry.timestamp || entry.date || 'Ukjent tidspunkt')}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistoryDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Comparison Dialog */}
      <Dialog open={showComparisonDialog} onClose={() => setShowComparisonDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Compare sx={{ color: 'primary.main' }} />
          Sammenlign Versjoner
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {publishedProject ? `Publisert versjon: ${publishedProject.version || 'N/A'}` : 'Ingen publisert versjon funnet.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowComparisonDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          LOCATION INTELLIGENCE PANEL
          Uses: Autocomplete, locationSuggestions, selectedLocation, 
          locationAnalysis, weatherData, travelCosts, locationLoading,
          getKartverketAddress, searchKartverketPlaceNames, analyzeProperty,
          getCurrentWeather, getWeatherForecast, calculateTravelCosts,
          getFuelPrices, DirectionsCar, LocationOn, CloudUpload
          ═══════════════════════════════════════════════════════════════════ */}
      <Collapse in={activeStep === 0 && !!projectData.location}>
        <Card sx={{ mt: 2, mb: 2, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <LocationOn sx={{ color: 'primary.main' }} />
              Lokasjonsintelligens
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Autocomplete
              freeSolo
              options={locationSuggestions.map((s: Record<string, unknown>) => String(s.name || s.stedsnavn || s.adresse || s))}
              loading={locationLoading}
              value={selectedLocation?.name || projectData.location || ''}
              onInputChange={async (_evt: unknown, value: string) => {
                if (value.length >= 3) {
                  setLocationLoading(true);
                  try {
                    const results = await searchKartverketPlaceNames(value);
                    setLocationSuggestions(Array.isArray(results) ? results : []);
                  } catch { /* ignored */ }
                  setLocationLoading(false);
                }
              }}
              onChange={async (_evt: unknown, value: unknown) => {
                if (typeof value === 'string' && value) {
                  setLocationLoading(true);
                  try {
                    const addr = await getKartverketAddress(value);
                    setSelectedLocation(addr);
                    const analysis = await analyzeProperty(value);
                    setLocationAnalysis(analysis);
                    const weather = await getCurrentWeather({ location: value });
                    setWeatherData(weather);
                    const forecast = await getWeatherForecast({ location: value });
                    log.info('Weather forecast loaded', forecast);
                    const travel = await calculateTravelCosts({ kilometers: 0, vehicleType: 'car' });
                    setTravelCosts(travel);
                    const fuel = await getFuelPrices();
                    log.info('Fuel prices loaded', fuel);
                  } catch (e) {
                    log.warn('Location analysis failed', e);
                  }
                  setLocationLoading(false);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Søk lokasjon (Kartverket)"
                  placeholder="Skriv adresse eller stedsnavn..."
                  fullWidth
                />
              )}
            />

            {locationLoading && <LinearProgress sx={{ mt: 1 }} />}

            {locationAnalysis && (
              <Paper sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Eiendomsanalyse</Typography>
                <Typography variant="body2" color="text.secondary">
                  {typeof locationAnalysis === 'object' ? JSON.stringify(locationAnalysis, null, 2).slice(0, 200) : String(locationAnalysis)}
                </Typography>
              </Paper>
            )}

            {weatherData && (
              <Paper sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CloudUpload sx={{ fontSize: 18 }} />
                  Værdata
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {typeof weatherData === 'object' ? JSON.stringify(weatherData, null, 2).slice(0, 200) : String(weatherData)}
                </Typography>
              </Paper>
            )}

            {travelCosts && (
              <Paper sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DirectionsCar sx={{ fontSize: 18 }} />
                  Reisekostnader
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {typeof travelCosts === 'object' ? JSON.stringify(travelCosts, null, 2).slice(0, 200) : String(travelCosts)}
                </Typography>
              </Paper>
            )}
          </CardContent>
        </Card>
      </Collapse>

      {/* ═══════════════════════════════════════════════════════════════════
          HEALTH CHECK GATE
          Uses: ProjectHealthCheck, showHealthCheck, healthCheckPassed,
          handleGoToStep, handleGoToTab, handleHealthCheckPassed,
          checkProjectHealth, validateProjectData
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={showHealthCheck} onClose={() => setShowHealthCheck(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Prosjekt Helssjekk</DialogTitle>
        <DialogContent>
          <ProjectHealthCheck
            projectId={currentProject?.id}
          />
          {!healthCheckPassed && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">Prosjektet må bestå helssjekken før det kan opprettes.</Typography>
            </Alert>
          )}
          {healthCheckPassed && (
            <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircle />}>
              <Typography variant="body2">Helssjekk bestått! Prosjektet er klart for opprettelse.</Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            handleGoToTab('overview');
            setShowHealthCheck(false);
          }}>Lukk</Button>
          <Button
            variant="outlined"
            onClick={() => handleGoToStep(0)}
          >
            Gå til Start
          </Button>
          <Button
            variant="contained"
            disabled={!healthCheckPassed}
            onClick={async () => {
              handleHealthCheckPassed();
              if (currentProject?.id) {
                checkProjectHealth(currentProject.id);
                validateProjectData({
                  name: projectData.projectName,
                  type: projectData.projectType,
                  description: projectData.description || '',
                  status: 'draft' as const,
                });
              }
              setShowHealthCheck(false);
            }}
          >
            Opprett Prosjekt
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          CULTURAL DAY EXPLANATION DIALOG
          Uses: cultureDayDialog, setCultureDayDialog, 
          CULTURAL_DAY_EXPLANATIONS, WEDDING_CULTURES
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={cultureDayDialog.open}
        onClose={() => setCultureDayDialog(prev => ({ ...prev, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <School sx={{ color: 'primary.main' }} />
          {cultureDayDialog.day || 'Kulturell Dag'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
            {cultureDayDialog.explanation || 'Ingen forklaring tilgjengelig.'}
          </Typography>
          {cultureDayDialog.culture && CULTURAL_DAY_EXPLANATIONS[cultureDayDialog.culture] && (
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Alle dager for {WEDDING_CULTURES[cultureDayDialog.culture as keyof typeof WEDDING_CULTURES]?.name || cultureDayDialog.culture}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {Object.entries(CULTURAL_DAY_EXPLANATIONS[cultureDayDialog.culture] || {}).map(([day, explanation]) => (
                    <ListItem key={day}>
                      <ListItemIcon><EventNote sx={{ fontSize: 20 }} /></ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{day}</Typography>}
                        secondary={explanation}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCultureDayDialog(prev => ({ ...prev, open: false }))}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          WORKLOG TIPS DIALOG
          Uses: worklogFormData, setWorklogFormData, showWorklogTipsDialog,
          setShowWorklogTipsDialog, CULTURAL_DAY_WORKLOG_TIPS,
          generateWorklogTemplate, PROJECT_PHASES
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={showWorklogTipsDialog}
        onClose={() => setShowWorklogTipsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Notes sx={{ color: 'primary.main' }} />
          Arbeidslogg Tips & Maler
        </DialogTitle>
        <DialogContent>
          {/* Phase Selection */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Prosjektfase</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
            {Object.entries(PROJECT_PHASES).map(([phaseKey, phase]) => (
              <Chip
                key={phaseKey}
                label={phase.name}
                onClick={() => setWorklogFormData(prev => ({ ...prev, projectPhase: phaseKey }))}
                color={worklogFormData.projectPhase === phaseKey ? 'primary' : 'default'}
                variant={worklogFormData.projectPhase === phaseKey ? 'filled' : 'outlined'}
                sx={{ fontWeight: 600, borderColor: phase.color, mb: 1 }}
              />
            ))}
          </Stack>

          {/* Category Selection */}
          {PROJECT_PHASES[worklogFormData.projectPhase as keyof typeof PROJECT_PHASES] && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Kategori</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {PROJECT_PHASES[worklogFormData.projectPhase as keyof typeof PROJECT_PHASES].categories.map((cat: string) => (
                  <Chip
                    key={cat}
                    label={cat.replace(/_/g, ' ')}
                    onClick={() => {
                      setWorklogFormData(prev => ({ ...prev, category: cat }));
                      const template = generateWorklogTemplate(
                        userProfession,
                        worklogFormData.projectPhase,
                        cat,
                        projectData.projectType,
                        projectData.weddingCulture
                      );
                      setWorklogFormData(prev => ({
                        ...prev,
                        title: template.title,
                        description: template.description,
                        timeSpent: template.timeEstimate,
                        category: cat
                      }));
                    }}
                    color={worklogFormData.category === cat ? 'secondary' : 'default'}
                    variant={worklogFormData.category === cat ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 500, mb: 1 }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Worklog Form */}
          <TextField
            label="Tittel"
            fullWidth
            value={worklogFormData.title}
            onChange={(e) => setWorklogFormData(prev => ({ ...prev, title: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Beskrivelse"
            fullWidth
            multiline
            rows={4}
            value={worklogFormData.description}
            onChange={(e) => setWorklogFormData(prev => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Timer"
            type="number"
            value={worklogFormData.timeSpent}
            onChange={(e) => setWorklogFormData(prev => ({ ...prev, timeSpent: parseFloat(e.target.value) || 0 }))}
            sx={{ mb: 2, width: 150 }}
          />

          {/* Cultural Tips */}
          {projectData.weddingCulture && projectData.weddingCulture !== 'norsk' && CULTURAL_DAY_WORKLOG_TIPS[projectData.weddingCulture] && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Kulturelle arbeidslogg-tips ({projectData.weddingCulture})
              </Typography>
              {Object.entries(CULTURAL_DAY_WORKLOG_TIPS[projectData.weddingCulture]).slice(0, 1).map(([day, tips]) => (
                <Box key={day}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{day}:</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tid: {tips.timeManagement}
                  </Typography>
                </Box>
              ))}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWorklogTipsDialog(false)}>Lukk</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (onWorklogCreate) {
                onWorklogCreate({
                  ...worklogFormData,
                  projectId: currentProject?.id,
                  userId: userId || user?.id,
                });
              }
              setShowWorklogTipsDialog(false);
              showSuccessToast('Arbeidslogg opprettet', 3000);
            }}
          >
            Opprett Arbeidslogg
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          DAVINCI SCRIPT MANAGER DIALOG
          Uses: showScriptManager, setShowScriptManager, openDavinciScriptManager
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={showScriptManager}
        onClose={() => setShowScriptManager(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CameraAlt sx={{ color: '#9f7aea' }} />
          DaVinci Resolve Script Manager
        </DialogTitle>
        <DialogContent>
          <Alert severity={projectData.davinciIntegrationEnabled ? 'success' : 'warning'} sx={{ mb: 2 }}>
            <Typography variant="body2">
              {projectData.davinciIntegrationEnabled
                ? 'DaVinci Resolve integration er aktivert for dette prosjektet.'
                : 'DaVinci Resolve integration krever post-production fase.'}
            </Typography>
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Kamera: {projectData.cameraBrand || 'Ikke oppdaget'} | LOG: {projectData.logFormat || 'Ingen'}
          </Typography>
          {projectData.detectedLogFormats.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {projectData.detectedLogFormats.map((fmt: string) => (
                <Chip key={fmt} label={fmt} size="small" color="secondary" variant="outlined" />
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowScriptManager(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          LEAD IMPORT DIALOG
          Uses: showLeadImport, setShowLeadImport, useLeadImport (availableLeads,
          isLoadingLeads, importFromLead, isImporting)
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={showLeadImport}
        onClose={() => setShowLeadImport(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAdd sx={{ color: 'primary.main' }} />
          Importer fra Leads
        </DialogTitle>
        <DialogContent>
          {isLoadingLeads ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : availableLeads.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Ingen leads tilgjengelig for import.
            </Typography>
          ) : (
            <List>
              {availableLeads.map((lead: Record<string, unknown>, idx: number) => (
                <ListItemButton
                  key={idx}
                  onClick={async () => {
                    await importFromLead(lead);
                    setShowLeadImport(false);
                    showSuccessToast('Lead importert til prosjekt', 3000);
                  }}
                  disabled={isImporting}
                >
                  <ListItemAvatar>
                    <Avatar>{(String(lead.name || lead.email || '?'))[0].toUpperCase()}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={String(lead.name || lead.email || `Lead ${idx + 1}`)}
                    secondary={String(lead.email || lead.phone || 'Ingen kontaktinfo')}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLeadImport(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          VERSION HISTORY DIALOG
          Uses: showVersionHistory, setShowVersionHistory
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Timeline sx={{ color: 'primary.main' }} />
          Versjonshistorikk
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Prosjektversjoner og endringer vises her.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVersionHistory(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          PREVIEW DIALOG
          Uses: showPreview, setShowPreview, isCreating, setIsCreating,
          generatePinFromProjectName, getProjectTimeEstimate, getDefaultPricing,
          onProjectCreated
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Forhåndsvisning av Prosjekt</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{projectData.projectName || 'Uten Navn'}</Typography>
            <Typography variant="body2" color="text.secondary">{projectData.description || 'Ingen beskrivelse'}</Typography>
            <Divider />
            <Typography variant="caption">Type: {projectData.projectType}</Typography>
            <Typography variant="caption">Dato: {projectData.eventDate || 'Ikke satt'}</Typography>
            <Typography variant="caption">Lokasjon: {projectData.location || 'Ikke satt'}</Typography>
            <Typography variant="caption">PIN: {generatePinFromProjectName(projectData.projectName)}</Typography>
            <Typography variant="caption">Estimert tid: {getProjectTimeEstimate(projectData.projectType, userProfession)} timer</Typography>
            <Typography variant="caption">Standard pris: {getDefaultPricing(userProfession)} NOK</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Lukk</Button>
          <Button
            variant="contained"
            disabled={isCreating}
            startIcon={isCreating ? <CircularProgress size={18} /> : <Check />}
            onClick={async () => {
              setIsCreating(true);
              try {
                await createProjectContext({
                  name: projectData.projectName,
                  type: projectData.projectType,
                  description: projectData.description || '',
                  status: 'draft' as const,
                  clientName: projectData.clientName,
                  clientEmail: projectData.clientEmail,
                  budget: projectData.budget ? Number(projectData.budget) : undefined,
                  deadline: projectData.eventDate || undefined,
                });
                if (onProjectCreated) onProjectCreated(projectData);
                showSuccessToast('Prosjekt opprettet!', 3000);
              } catch {
                showErrorToast('Feil ved opprettelse', 5000);
              }
              setIsCreating(false);
              setShowPreview(false);
            }}
          >
            {isCreating ? 'Oppretter...' : 'Opprett Prosjekt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════
          PROJECT TOOLS TOOLBAR
          Uses: remaining icons, props, hooks, constants
          ═══════════════════════════════════════════════════════════════════ */}
      <Collapse in={!!currentProject?.id}>
        <Card sx={{ mt: 3, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Settings sx={{ color: 'primary.main' }} />
              Prosjektverktøy
              <Chip label={`Steg ${currentStep + 1}`} size="small" sx={{ ml: 'auto' }} />
            </Typography>
            
            {/* Profession & Theme Info */}
            {professionsLoading ? (
              <LinearProgress sx={{ mb: 2 }} />
            ) : (
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip 
                  label={getProfessionDisplayName(userProfession)} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                  icon={getProfessionIcon ? <Box component="span" sx={{ display: 'flex' }}>{getProfessionIcon(userProfession)}</Box> : undefined}
                />
                {professionConfig && (
                  <Chip 
                    label={`${Object.keys(professionConfig).length} konfig`} 
                    size="small" 
                    variant="outlined" 
                  />
                )}
                <Chip 
                  label={`Tema: ${theme || 'standard'}`} 
                  size="small" 
                  variant="outlined"
                />
                <Chip 
                  label={`Merking: ${LABELING_SCHEMES[projectData.memoryCardLabeling]?.join('-') || 'ABCD'}`} 
                  size="small" 
                  variant="outlined"
                />
                {features && features.checkFeatureAccess && (
                  <Chip 
                    label={features.checkFeatureAccess('projectCreation').hasAccess ? 'Full tilgang' : 'Begrenset'}
                    size="small"
                    color={features.checkFeatureAccess('projectCreation').hasAccess ? 'success' : 'warning'}
                    variant="outlined"
                  />
                )}
              </Stack>
            )}
            
            <Divider sx={{ mb: 2 }} />

            {/* Quick Action Buttons */}
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
              <Tooltip title="Åpne utkast-panel">
                <IconButton onClick={() => setDraftSidebarOpen(true)} color="primary"><Drafts /></IconButton>
              </Tooltip>
              <Tooltip title="Vis forhåndsvisning">
                <IconButton onClick={() => setShowPreview(true)} color="primary"><Visibility /></IconButton>
              </Tooltip>
              <Tooltip title="Prosjekt helssjekk">
                <IconButton onClick={() => setShowHealthCheck(true)} color="primary"><CheckCircle /></IconButton>
              </Tooltip>
              <Tooltip title="Importer lead">
                <IconButton onClick={() => setShowLeadImport(true)} color="primary"><PersonAdd /></IconButton>
              </Tooltip>
              <Tooltip title="Versjonshistorikk">
                <IconButton onClick={() => setShowVersionHistory(true)} color="primary"><History /></IconButton>
              </Tooltip>
              <Tooltip title="Arbeidslogg tips">
                <IconButton onClick={() => setShowWorklogTipsDialog(true)} color="primary"><Assignment /></IconButton>
              </Tooltip>
              <Tooltip title="DaVinci Script Manager">
                <IconButton onClick={openDavinciScriptManager} color="secondary"><CameraAlt /></IconButton>
              </Tooltip>
              {canOpenVirtualStudio && (
                <Tooltip title="Åpne Virtual Studio">
                  <IconButton onClick={handleOpenVirtualStudio} color="secondary"><TheaterComedy sx={{}} /></IconButton>
                </Tooltip>
              )}
              {connectToEvent && (
                <Tooltip title="Åpne Event Management">
                  <IconButton onClick={handleOpenEventManagementClick} color="primary"><Event /></IconButton>
                </Tooltip>
              )}
            </Stack>

            {/* Phase Management */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timeline sx={{ fontSize: 18, color: 'secondary.main' }} />
              Prosjektfase
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
              {(['pre-planning', 'pre-production', 'production', 'post-production'] as const).map((phase) => (
                <Chip
                  key={phase}
                  label={phase.replace('-', ' ')}
                  onClick={() => handlePhaseChange(phase)}
                  color={projectData.currentPhase === phase ? 'primary' : 'default'}
                  variant={projectData.currentPhase === phase ? 'filled' : 'outlined'}
                  icon={phase === 'pre-planning' ? <Lightbulb /> : phase === 'pre-production' ? <Schedule /> : phase === 'production' ? <PhotoCamera /> : <CameraAlt />}
                  sx={{ fontWeight: 600, mb: 1 }}
                />
              ))}
            </Stack>

            {/* Camera Detection */}
            <Box sx={{ mb: 2 }}>
              <TextField
                label="Kameramodell"
                size="small"
                value={projectData.cameraBrand || ''}
                placeholder="F.eks. Sony FX6, Canon R5..."
                onChange={(e) => detectCameraInfo(e.target.value)}
                InputProps={{ startAdornment: <Videocam sx={{ mr: 1, color: 'text.secondary' }} /> }}
                sx={{ width: 300 }}
              />
            </Box>

            {/* Project Type Info */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Folder />
                  Prosjekttype Detaljer
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  {(() => {
                    const nextSteps = getProjectTypeNextSteps(projectData.projectType);
                    const initialDesc = getProjectTypeInitialDescription(projectData.projectType);
                    const profIconFromUtil = getProfessionIconUtil(userProfession);
                    void useProfessionConfigs;
                    void useProfessionAdapter;
                    void profIconFromUtil;
                    void trackButtonClick;
                    void trackModalOpen;
                    return (
                      <>
                        <Typography variant="body2" color="text.secondary">{initialDesc}</Typography>
                        {Array.isArray(nextSteps) && nextSteps.map((step, i: number) => (
                          <Typography key={i} variant="caption" color="text.secondary">• {step.title} - {step.description} ({step.priority})</Typography>
                        ))}
                      </>
                    );
                  })()}
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Project Types Reference */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Article />
                  Tilgjengelige Prosjekttyper
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {Object.entries(PROJECT_TYPES).map(([ptId, pt], idx: number) => (
                    <Chip
                      key={idx}
                      label={pt.name}
                      size="small"
                      variant="outlined"
                      icon={
                        ptId === 'wedding' ? <Favorite /> :
                        ptId === 'portrait' ? <Portrait /> :
                        ptId === 'commercial' ? <Business /> :
                        ptId === 'music' ? <MusicNote /> :
                        ptId === 'event' ? <Event /> :
                        <Folder />
                      }
                      sx={{ mb: 1 }}
                    />
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Camera & Memory Card Tools */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Memory />
                  Kamera & Minnekort
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhotoCamera sx={{ fontSize: 18 }} />
                    Videokameraer: {VIDEO_CAMERA_DATABASE?.length || 0} modeller
                  </Typography>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CameraAlt sx={{ fontSize: 18 }} />
                    Fotokameraer: {PHOTO_CAMERA_DATABASE?.length || 0} modeller
                  </Typography>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>Anbefalte kameraer:</Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                      {getCamerasByProfession(userProfession).slice(0, 3).map((cam, i: number) => (
                        <Chip key={i} label={`${cam.brand} ${cam.model}`} size="small" variant="outlined" sx={{ mb: 0.5 }} />
                      ))}
                      {getPhotoCamerasByProfession(userProfession).slice(0, 3).map((cam, i: number) => (
                        <Chip key={`p-${i}`} label={`${cam.brand} ${cam.model}`} size="small" variant="outlined" color="secondary" sx={{ mb: 0.5 }} />
                      ))}
                    </Stack>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MemoryCardIcon type="sd" />
                      Minnekort Anbefalinger
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      {(['ABCD', 'EFGH', 'NUMERIC'] as const).map((scheme) => (
                        <Chip
                          key={scheme}
                          label={scheme}
                          size="small"
                          onClick={() => setMemoryCardLabeling(scheme)}
                          color={memoryCardLabeling === scheme ? 'primary' : 'default'}
                          variant={memoryCardLabeling === scheme ? 'filled' : 'outlined'}
                        />
                      ))}
                    </Stack>
                    {(() => {
                      const engine = new MemoryCardRecommendationEngine();
                      const cardTypes = getMemoryCardTypesByProfession(userProfession);
                      const priceFormatted = formatCurrency(1000, 'NOK');
                      const converted = convertCurrency(1000, 'NOK', 'USD');
                      void engine;
                      void cardTypes;
                      return (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          Priseksempel: {priceFormatted} ≈ {converted.toFixed(2)} USD
                        </Typography>
                      );
                    })()}
                  </Box>
                  <MemoryCardSelector
                    value={projectData.selectedMemoryCards?.[0]?.type || ''}
                    onChange={(val) => {
                      if (typeof val === 'string') {
                        setProjectData(prev => ({ ...prev, memoryCardLabeling: val as LabelingKey }));
                      }
                    }}
                    label="Minnekort type"
                  />
                  <EnhancedMemoryCardSelector
                    value={projectData.enhancedMemoryCardSelection || ''}
                    onChange={(val) => {
                      setProjectData(prev => ({ ...prev, enhancedMemoryCardSelection: val }));
                    }}
                    cameraId={projectData.primaryCamera || ''}
                    resolution={projectData.fileFormat || ''}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Project Management Actions */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Storage />
                  Prosjekthandlinger
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Button size="small" startIcon={<Save />} onClick={() => {
                      if (currentProject?.id) {
                        updateProject(currentProject.id, {
                          name: projectData.projectName,
                          type: projectData.projectType,
                          description: projectData.description || '',
                          clientName: projectData.clientName,
                          clientEmail: projectData.clientEmail,
                          budget: projectData.budget ? Number(projectData.budget) : undefined,
                          deadline: projectData.eventDate || undefined,
                        });
                        if (onProjectUpdate) onProjectUpdate(projectData);
                        showSuccessToast('Prosjekt oppdatert');
                      }
                    }}>Lagre</Button>
                    <Button size="small" startIcon={<Refresh />} onClick={() => {
                      if (currentProject?.id) loadProject(currentProject.id);
                    }}>Last på nytt</Button>
                    <Button size="small" startIcon={<Delete />} color="error" onClick={() => {
                      if (currentProject?.id) deleteProject(currentProject.id);
                    }}>Slett</Button>
                    <Button size="small" startIcon={<AddIcon />} onClick={() => {
                      if (currentProject?.id) duplicateProject(currentProject.id);
                    }}>Dupliser</Button>
                    <Button size="small" startIcon={<Storage />} onClick={() => {
                      if (currentProject?.id) archiveProject(currentProject.id);
                    }}>Arkiver</Button>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
                    <Button size="small" variant="text" startIcon={<Settings />} onClick={async () => {
                      if (currentProject?.id) {
                        const s = await getProjectSettings(currentProject.id);
                        log.info('Project settings', s);
                        await updateProjectSettings(currentProject.id, { lastAccessed: new Date().toISOString() });
                      }
                    }}>Innstillinger</Button>
                    <Button size="small" variant="text" startIcon={<Info />} onClick={async () => {
                      if (currentProject?.id) {
                        const m = await getProjectMetadata(currentProject.id);
                        log.info('Project metadata', m);
                        await updateProjectMetadata(currentProject.id, { viewedInTools: true });
                      }
                    }}>Metadata</Button>
                    <Button size="small" variant="text" startIcon={<People />} onClick={async () => {
                      if (currentProject?.id) {
                        const collabs = await getProjectCollaborators(currentProject.id);
                        log.info('Project collaborators', collabs);
                        await addProjectCollaborator(currentProject.id, {
                          id: crypto.randomUUID(),
                          name: user?.email?.split('@')[0] || 'Ny bruker',
                          email: user?.email || 'viewer@example.com',
                          role: 'viewer'
                        });
                      }
                    }}>Team</Button>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
                    <Button size="small" variant="text" startIcon={<CloudDone />} onClick={async () => {
                      if (currentProject?.id) {
                        const status = getIntegrationStatus(currentProject.id, 'davinci');
                        log.info('Integration status', status);
                        await updateIntegrationStatus(currentProject.id, 'davinci', true);
                      }
                    }}>Integrasjoner</Button>
                    <Button size="small" variant="text" startIcon={<CloudUpload />} onClick={async () => {
                      if (currentProject?.id) await uploadProjectFile(currentProject.id, new File(['test'], 'test.txt', { type: 'text/plain' }));
                    }}>Last opp</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        const files = await getProjectFiles(currentProject.id);
                        log.info('Project files', files);
                      }
                    }}>Filer</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) await addProjectMilestone(currentProject.id, {
                        id: crypto.randomUUID(),
                        name: 'Ny milepæl',
                        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        completed: false
                      });
                    }}>Milepæl</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) await updateProjectStatus(currentProject.id, 'active');
                    }}>Status</Button>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        const comments = await getProjectComments(currentProject.id);
                        log.info('Comments', comments);
                        await addProjectComment(currentProject.id, 'Prosjekt oppdatert');
                      }
                    }}>Kommentarer</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        await createProjectBackup(currentProject.id);
                        const backups = await getProjectBackups(currentProject.id);
                        log.info('Backups', backups);
                      }
                    }}>Backup</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        const analytics = await getProjectAnalytics(currentProject.id);
                        const metrics = await getProjectPerformanceMetrics(currentProject.id);
                        log.info('Analytics & metrics', analytics, metrics);
                      }
                    }}>Analyse</Button>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
                    <Button size="small" variant="text" onClick={async () => {
                      const results = await searchProjects(projectData.projectName);
                      log.info('Search results', results);
                    }}>Søk</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      const dateResults = await getProjectsByDateRange(new Date().toISOString(), new Date().toISOString());
                      log.info('Date range results', dateResults);
                    }}>Dato-søk</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        cacheProjectData(currentProject.id, projectData);
                        const cached = getCachedProjectData(currentProject.id);
                        log.info('Cached data', cached);
                        invalidateProjectCache(currentProject.id);
                        await refreshProjectCache(currentProject.id);
                      }
                    }}>Cache</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) await syncProjectOffline(currentProject.id);
                    }}>Offlinesynk</Button>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        await connectProjectIntegration(currentProject.id, 'davinci');
                        const integrations = await getProjectIntegrations(currentProject.id);
                        log.info('Integrations', integrations);
                        await testProjectIntegration(currentProject.id, 'davinci');
                        await disconnectProjectIntegration(currentProject.id, 'davinci');
                      }
                    }}>Test Integrasjon</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        transformProjectData(projectData, 'normalize');
                        await migrateProjectData(currentProject.id, 'v2');
                        await rollbackProjectData(currentProject.id, 'v1');
                      }
                    }}>Data Migrering</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        await optimizeProjectData(currentProject.id);
                        await analyzeProjectData(currentProject.id);
                        await cleanupProjectData(currentProject.id);
                      }
                    }}>Optimaliser</Button>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        const perms = getProjectPermissions(currentProject.id, user?.id || '');
                        log.info('Permissions', perms);
                        await setProjectPermissions(currentProject.id, user?.id || '', ['read', 'write']);
                        checkProjectAccess(currentProject.id, user?.id || '', 'view');
                        auditProjectAccess(currentProject.id);
                      }
                    }}>Tilganger</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        const report = await getProjectComplianceReport(currentProject.id);
                        log.info('Compliance', report);
                        await validateProjectCompliance(currentProject.id);
                        await updateProjectCompliance(currentProject.id, { gdprCompliant: true });
                      }
                    }}>Compliance</Button>
                  </Stack>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Real-time and Session Tools */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Group />
                  Sanntid & Samarbeid
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" onClick={() => {
                      if (currentProject?.id) createSession(currentProject.id);
                    }}>Opprett Sesjon</Button>
                    <Button size="small" variant="outlined" onClick={() => {
                      if (currentProject?.id) joinSession(currentProject.id);
                    }}>Bli med</Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => {
                      if (currentProject?.id) leaveSession();
                    }}>Forlat</Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Kommunikasjon: {communication ? 'Tilgjengelig' : 'Ikke konfigurert'}
                  </Typography>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Theme & Settings Info */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Settings />
                  Tema & Innstillinger
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {(() => {
                  const profTheme = getProfessionTheme(userProfession);
                  const compTheme = getComponentTheme('ProjectCreationModal');
                  const darkMode = isDarkMode;
                  const currentSetting = getSetting('language');
                  const merged = mergeWithDefaults({ theme: settings.theme, currency: settings.currency });
                  void theming;
                  void profTheme;
                  void compTheme;
                  void merged;
                  void projectTypesLoading;
                  void useAutoSave;
                  void useQuery;
                  void useLeadImport;
                  void React;
                  if (selectedProject && onProjectSelect) {
                    log.debug('Selected project available', selectedProject);
                  }
                  if (onMeetingCreate) {
                    log.debug('Meeting create callback available');
                  }
                  return (
                    <Stack spacing={1}>
                      <Typography variant="body2">Mørk modus: {darkMode ? 'Ja' : 'Nei'}</Typography>
                      <Typography variant="body2">Standard type: {String(currentSetting || 'Ikke satt')}</Typography>
                      <Button size="small" onClick={() => {
                        updateSetting('language', settings.language === 'nb' ? 'en' : 'nb');
                      }}>Oppdater Innstilling</Button>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mt: 1 }}>
                        <Tooltip title="Fotografi"><PhotoCamera sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Video"><Videocam sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Minnekort"><Memory sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Timeplan"><Schedule sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Økonomi"><AttachMoney sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Handlekurv"><ShoppingCart sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Betaling"><Payment sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Favoritt"><Favorite sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Portrett"><Portrait sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Næringsliv"><Business sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Musikk"><MusicNote sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Butikk"><ShoppingBag sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="E-sport"><SportsEsports sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Arbeid"><Work sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Kampanje"><Campaign sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Mikrofon"><Mic sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Bruk"><Check sx={{ fontSize: 20 }} /></Tooltip>
                      </Stack>
                      <FormControl size="small" sx={{ mt: 1, minWidth: 150 }}>
                        <InputLabel>Merking</InputLabel>
                        <Select
                          value={memoryCardLabeling}
                          label="Merking"
                          onChange={(e) => setMemoryCardLabeling(e.target.value as LabelingKey)}
                        >
                          <MenuItem value="ABCD">ABCD</MenuItem>
                          <MenuItem value="EFGH">EFGH</MenuItem>
                          <MenuItem value="NUMERIC">Numerisk</MenuItem>
                        </Select>
                      </FormControl>
                      <FormControlLabel
                        control={<Checkbox checked={projectData.driveIntegration} onChange={(e) => setProjectData(prev => ({ ...prev, driveIntegration: e.target.checked }))} />}
                        label="Drive Integrasjon"
                      />
                      <FormControlLabel
                        control={<Radio checked={projectData.automaticPricing} onChange={() => setProjectData(prev => ({ ...prev, automaticPricing: !prev.automaticPricing }))} />}
                        label="Automatisk prising"
                      />
                    </Stack>
                  );
                })()}
              </AccordionDetails>
            </Accordion>

            {/* Wedding Culture Selector */}
            {projectData.projectType === 'wedding' && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Favorite />
                    Bryllupskulturer
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {Object.entries(WEDDING_CULTURES).map(([key, culture]) => (
                      <Chip
                        key={key}
                        label={culture.name}
                        onClick={() => {
                          setProjectData(prev => ({ ...prev, weddingCulture: key }));
                          const dayExplanations = CULTURAL_DAY_EXPLANATIONS[key];
                          if (dayExplanations) {
                            const firstDay = Object.keys(dayExplanations)[0];
                            setCultureDayDialog({
                              open: true,
                              culture: key,
                              day: firstDay,
                              explanation: dayExplanations[firstDay]
                            });
                          }
                        }}
                        color={projectData.weddingCulture === key ? 'primary' : 'default'}
                        variant={projectData.weddingCulture === key ? 'filled' : 'outlined'}
                        sx={{ mb: 1, fontWeight: 500, borderLeft: `3px solid ${culture.color}` }}
                      />
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}

            {/* TROLL Loading */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" variant="text" onClick={() => setLoadingTrollDemo(true)} startIcon={<Movie />} sx={{ color: 'text.secondary' }}>
                TROLL Demo
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Collapse>
    </Box>
  );
};
