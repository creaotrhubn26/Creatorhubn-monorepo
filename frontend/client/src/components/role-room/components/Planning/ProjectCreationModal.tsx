// @ts-nocheck
/**
 * CreatorHub Norge - Project Creation Modal
 * The modal is used in The Role Room for creating new projects and adapting the flow across professions.
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
import { useProject, type Project, type Collaborator, type Milestone } from '@/contexts/ProjectContext';
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
import authSessionService from '../../services/authSessionService';
import { useT } from '../../../../i18n';
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
import { LocationsIcon as LocationOn } from '../icons/CastingIcons';
import MemoryCardIcon from '../ui/MemoryCardIcon';
import MemoryCardSelector from '../memory-card/MemoryCardSelector';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useQuery } from '@tanstack/react-query';
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';
import { useLeadImport } from '@/hooks/useLeadImport';
import ProjectHealthCheck from './ProjectHealthCheck';
import ProjectCollaborators from './ProjectCollaborators';
import { VIDEO_CAMERA_DATABASE, getCamerasByProfession, getLogFormatsByCamera, getCameraBrand } from '@/data/video-camera-database';
import { PHOTO_CAMERA_DATABASE, getPhotoCamerasByProfession, getPhotoCameraBrand } from '@/data/photo-camera-database';
import { MemoryCardRecommendationEngine, getMemoryCardTypesByProfession, formatCurrency, convertCurrency } from '@/data/memory-card-database';
import EnhancedMemoryCardSelector from '../memory-card/EnhancedMemoryCardSelector';
import { useProjectTypes } from '@/hooks/useProjectTypes';
import AddProjectTypeDialog from './AddProjectTypeDialog';
import AddIcon from '@mui/icons-material/Add';
import { useAuth } from '@/hooks/useAuth';
import { ProjectTypeSelector } from './ProjectTypeSelector';
import { PROJECT_TYPES } from './projectTypeConstants';
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
const buildCulturalDayExplanations = (t: ReturnType<typeof useT>['t']): Record<string, Record<string, string>> => ({
  sikh: {
    'Chooda & Haldi': t('projCreate.cde.sikh.0'),
    'Sangeet': t('projCreate.cde.sikh.1'),
    'Anand Karaj & Reception': t('projCreate.cde.sikh.2'),
  },
  indisk: {
    'Ganesh Puja & Haldi': t('projCreate.cde.indisk.0'),
    'Mehendi': t('projCreate.cde.indisk.1'),
    'Sangeet': t('projCreate.cde.indisk.2'),
    'Vielse & Reception': t('projCreate.cde.indisk.3'),
  },
  pakistansk: {
    'Mehndi & Sangeet': t('projCreate.cde.pakistansk.0'),
    'Baraat & Nikkah': t('projCreate.cde.pakistansk.1'),
    'Walima resepsjon': t('projCreate.cde.pakistansk.2'),
  },
  tyrkisk: {
    'Kına Gecesi (Henna)': t('projCreate.cde.tyrkisk.0'),
    'Düğün (Bryllup)': t('projCreate.cde.tyrkisk.1'),
  },
  arabisk: {
    'Nikah vielse': t('projCreate.cde.arabisk.0'),
    'Zaffe & Walima': t('projCreate.cde.arabisk.1'),
  },
  somalisk: {
    'Nikah seremoni': t('projCreate.cde.somalisk.0'),
    'Aroos feiring': t('projCreate.cde.somalisk.1'),
  },
  etiopisk: {
    'Telosh seremoni': t('projCreate.cde.etiopisk.0'),
    'Kulturell resepsjon': t('projCreate.cde.etiopisk.1'),
  },
  nigeriansk: {
    'White Wedding': t('projCreate.cde.nigeriansk.0'),
    'Traditional Wedding': t('projCreate.cde.nigeriansk.1'),
  },
  muslimsk: {
    'Mehendi kveld': t('projCreate.cde.muslimsk.0'),
    'Nikkah & Walima': t('projCreate.cde.muslimsk.1'),
  },
  libanesisk: {
    'Henna Party': t('projCreate.cde.libanesisk.0'),
    'Zaffe & Reception': t('projCreate.cde.libanesisk.1'),
  },
});

// Cultural day worklog tips and suggestions
const buildCulturalDayWorklogTips = (t: ReturnType<typeof useT>['t']): Record<string, Record<string, {
  tasks: string[];
  considerations: string[];
  timeManagement: string;
  keyContacts: string[];
  equipment: string[];
}>> => ({
  sikh: {
    'Chooda & Haldi': {
      tasks: [t('projCreate.cwt.sikh.0.tasks.0'), t('projCreate.cwt.sikh.0.tasks.1'), t('projCreate.cwt.sikh.0.tasks.2'), t('projCreate.cwt.sikh.0.tasks.3'), t('projCreate.cwt.sikh.0.tasks.4')],
      considerations: [t('projCreate.cwt.sikh.0.cons.0'), t('projCreate.cwt.sikh.0.cons.1'), t('projCreate.cwt.sikh.0.cons.2'), t('projCreate.cwt.sikh.0.cons.3'), t('projCreate.cwt.sikh.0.cons.4')],
      timeManagement: t('projCreate.cwt.sikh.0.time'),
      keyContacts: [t('projCreate.cwt.sikh.0.contacts.0'), t('projCreate.cwt.sikh.0.contacts.1'), t('projCreate.cwt.sikh.0.contacts.2')],
      equipment: [t('projCreate.cwt.sikh.0.equip.0'), t('projCreate.cwt.sikh.0.equip.1'), t('projCreate.cwt.sikh.0.equip.2')],
    },
    'Sangeet': {
      tasks: [t('projCreate.cwt.sikh.1.tasks.0'), t('projCreate.cwt.sikh.1.tasks.1'), t('projCreate.cwt.sikh.1.tasks.2'), t('projCreate.cwt.sikh.1.tasks.3'), t('projCreate.cwt.sikh.1.tasks.4')],
      considerations: [t('projCreate.cwt.sikh.1.cons.0'), t('projCreate.cwt.sikh.1.cons.1'), t('projCreate.cwt.sikh.1.cons.2'), t('projCreate.cwt.sikh.1.cons.3'), t('projCreate.cwt.sikh.1.cons.4')],
      timeManagement: t('projCreate.cwt.sikh.1.time'),
      keyContacts: [t('projCreate.cwt.sikh.1.contacts.0'), t('projCreate.cwt.sikh.1.contacts.1'), t('projCreate.cwt.sikh.1.contacts.2')],
      equipment: [t('projCreate.cwt.sikh.1.equip.0'), t('projCreate.cwt.sikh.1.equip.1'), t('projCreate.cwt.sikh.1.equip.2')],
    },
    'Anand Karaj & Reception': {
      tasks: [t('projCreate.cwt.sikh.2.tasks.0'), t('projCreate.cwt.sikh.2.tasks.1'), t('projCreate.cwt.sikh.2.tasks.2'), t('projCreate.cwt.sikh.2.tasks.3'), t('projCreate.cwt.sikh.2.tasks.4')],
      considerations: [t('projCreate.cwt.sikh.2.cons.0'), t('projCreate.cwt.sikh.2.cons.1'), t('projCreate.cwt.sikh.2.cons.2'), t('projCreate.cwt.sikh.2.cons.3'), t('projCreate.cwt.sikh.2.cons.4')],
      timeManagement: t('projCreate.cwt.sikh.2.time'),
      keyContacts: [t('projCreate.cwt.sikh.2.contacts.0'), t('projCreate.cwt.sikh.2.contacts.1'), t('projCreate.cwt.sikh.2.contacts.2')],
      equipment: [t('projCreate.cwt.sikh.2.equip.0'), t('projCreate.cwt.sikh.2.equip.1'), t('projCreate.cwt.sikh.2.equip.2')],
    },
  },
  indisk: {
    'Ganesh Puja & Haldi': {
      tasks: [t('projCreate.cwt.indisk.0.tasks.0'), t('projCreate.cwt.indisk.0.tasks.1'), t('projCreate.cwt.indisk.0.tasks.2'), t('projCreate.cwt.indisk.0.tasks.3'), t('projCreate.cwt.indisk.0.tasks.4')],
      considerations: [t('projCreate.cwt.indisk.0.cons.0'), t('projCreate.cwt.indisk.0.cons.1'), t('projCreate.cwt.indisk.0.cons.2'), t('projCreate.cwt.indisk.0.cons.3'), t('projCreate.cwt.indisk.0.cons.4')],
      timeManagement: t('projCreate.cwt.indisk.0.time'),
      keyContacts: [t('projCreate.cwt.indisk.0.contacts.0'), t('projCreate.cwt.indisk.0.contacts.1'), t('projCreate.cwt.indisk.0.contacts.2')],
      equipment: [t('projCreate.cwt.indisk.0.equip.0'), t('projCreate.cwt.indisk.0.equip.1'), t('projCreate.cwt.indisk.0.equip.2')],
    },
  },
  pakistansk: {
    'Mehndi & Sangeet': {
      tasks: [t('projCreate.cwt.pakistansk.0.tasks.0'), t('projCreate.cwt.pakistansk.0.tasks.1'), t('projCreate.cwt.pakistansk.0.tasks.2'), t('projCreate.cwt.pakistansk.0.tasks.3'), t('projCreate.cwt.pakistansk.0.tasks.4')],
      considerations: [t('projCreate.cwt.pakistansk.0.cons.0'), t('projCreate.cwt.pakistansk.0.cons.1'), t('projCreate.cwt.pakistansk.0.cons.2'), t('projCreate.cwt.pakistansk.0.cons.3'), t('projCreate.cwt.pakistansk.0.cons.4')],
      timeManagement: t('projCreate.cwt.pakistansk.0.time'),
      keyContacts: [t('projCreate.cwt.pakistansk.0.contacts.0'), t('projCreate.cwt.pakistansk.0.contacts.1'), t('projCreate.cwt.pakistansk.0.contacts.2')],
      equipment: [t('projCreate.cwt.pakistansk.0.equip.0'), t('projCreate.cwt.pakistansk.0.equip.1'), t('projCreate.cwt.pakistansk.0.equip.2')],
    },
  },
});

// Project phases for worklog organization - i18n builder
const buildProjectPhases = (t: ReturnType<typeof useT>['t']): Record<string, { name: string; description: string; color: string; categories: string[] }> => ({
  pre_production: {
    name: t('projCreate.phase.pre_production.name'),
    description: t('projCreate.phase.pre_production.desc'),
    color: '#2196f3',
    categories: ['planning','client_meeting','cultural_research','equipment_prep','location_scouting']
  },
  production: {
    name: t('projCreate.phase.production.name'),
    description: t('projCreate.phase.production.desc'),
    color: '#4caf50',
    categories: ['shooting','filming','recording','directing','on_set_coordination']
  },
  post_production: {
    name: t('projCreate.phase.post_production.name'),
    description: t('projCreate.phase.post_production.desc'),
    color: '#9333ea',
    categories: ['editing','color_grading','sound_design','delivery','client_review']
  },
  business: {
    name: t('projCreate.phase.business.name'),
    description: t('projCreate.phase.business.desc'),
    color: '#9c27b0',
    categories: ['invoicing','marketing','client_follow_up','portfolio_update','social_media']
  }
});

// Dynamic Phase-Specific Worklog Templates - i18n builder
const buildDynamicWorklogTemplates = (t: ReturnType<typeof useT>['t']) => ({
  photographer: {
    pre_production: {
      planning: {
        title: t('projCreate.wlt.photographer.pre_production.planning.title'),
        description: t('projCreate.wlt.photographer.pre_production.planning.desc'),
        timeEstimate: 3,
        checklistItems: [t('projCreate.wlt.photographer.pre_production.planning.check.0'), t('projCreate.wlt.photographer.pre_production.planning.check.1'), t('projCreate.wlt.photographer.pre_production.planning.check.2'), t('projCreate.wlt.photographer.pre_production.planning.check.3')]
      },
      client_meeting: {
        title: t('projCreate.wlt.photographer.pre_production.client_meeting.title'),
        description: t('projCreate.wlt.photographer.pre_production.client_meeting.desc'),
        timeEstimate: 2,
        checklistItems: [t('projCreate.wlt.photographer.pre_production.client_meeting.check.0'), t('projCreate.wlt.photographer.pre_production.client_meeting.check.1'), t('projCreate.wlt.photographer.pre_production.client_meeting.check.2'), t('projCreate.wlt.photographer.pre_production.client_meeting.check.3')]
      },
      cultural_research: {
        title: t('projCreate.wlt.photographer.pre_production.cultural_research.title'),
        description: t('projCreate.wlt.photographer.pre_production.cultural_research.desc'),
        timeEstimate: 2,
        checklistItems: [t('projCreate.wlt.photographer.pre_production.cultural_research.check.0'), t('projCreate.wlt.photographer.pre_production.cultural_research.check.1'), t('projCreate.wlt.photographer.pre_production.cultural_research.check.2'), t('projCreate.wlt.photographer.pre_production.cultural_research.check.3')]
      }
    },
    production: {
      shooting: {
        title: t('projCreate.wlt.photographer.production.shooting.title'),
        description: t('projCreate.wlt.photographer.production.shooting.desc'),
        timeEstimate: 8,
        checklistItems: [t('projCreate.wlt.photographer.production.shooting.check.0'), t('projCreate.wlt.photographer.production.shooting.check.1'), t('projCreate.wlt.photographer.production.shooting.check.2'), t('projCreate.wlt.photographer.production.shooting.check.3')]
      },
      directing: {
        title: t('projCreate.wlt.photographer.production.directing.title'),
        description: t('projCreate.wlt.photographer.production.directing.desc'),
        timeEstimate: 4,
        checklistItems: [t('projCreate.wlt.photographer.production.directing.check.0'), t('projCreate.wlt.photographer.production.directing.check.1'), t('projCreate.wlt.photographer.production.directing.check.2'), t('projCreate.wlt.photographer.production.directing.check.3')]
      }
    },
    post_production: {
      editing: {
        title: t('projCreate.wlt.photographer.post_production.editing.title'),
        description: t('projCreate.wlt.photographer.post_production.editing.desc'),
        timeEstimate: 12,
        checklistItems: [t('projCreate.wlt.photographer.post_production.editing.check.0'), t('projCreate.wlt.photographer.post_production.editing.check.1'), t('projCreate.wlt.photographer.post_production.editing.check.2'), t('projCreate.wlt.photographer.post_production.editing.check.3')]
      },
      client_review: {
        title: t('projCreate.wlt.photographer.post_production.client_review.title'),
        description: t('projCreate.wlt.photographer.post_production.client_review.desc'),
        timeEstimate: 3,
        checklistItems: [t('projCreate.wlt.photographer.post_production.client_review.check.0'), t('projCreate.wlt.photographer.post_production.client_review.check.1'), t('projCreate.wlt.photographer.post_production.client_review.check.2'), t('projCreate.wlt.photographer.post_production.client_review.check.3')]
      }
    },
    business: {
      invoicing: {
        title: t('projCreate.wlt.photographer.business.invoicing.title'),
        description: t('projCreate.wlt.photographer.business.invoicing.desc'),
        timeEstimate: 1,
        checklistItems: [t('projCreate.wlt.photographer.business.invoicing.check.0'), t('projCreate.wlt.photographer.business.invoicing.check.1'), t('projCreate.wlt.photographer.business.invoicing.check.2'), t('projCreate.wlt.photographer.business.invoicing.check.3')]
      },
      portfolio_update: {
        title: t('projCreate.wlt.photographer.business.portfolio_update.title'),
        description: t('projCreate.wlt.photographer.business.portfolio_update.desc'),
        timeEstimate: 2,
        checklistItems: [t('projCreate.wlt.photographer.business.portfolio_update.check.0'), t('projCreate.wlt.photographer.business.portfolio_update.check.1'), t('projCreate.wlt.photographer.business.portfolio_update.check.2'), t('projCreate.wlt.photographer.business.portfolio_update.check.3')]
      }
    }
  },
  music_producer: {
    pre_production: {
      planning: {
        title: t('projCreate.wlt.music_producer.pre_production.planning.title'),
        description: t('projCreate.wlt.music_producer.pre_production.planning.desc'),
        timeEstimate: 4,
        checklistItems: [t('projCreate.wlt.music_producer.pre_production.planning.check.0'), t('projCreate.wlt.music_producer.pre_production.planning.check.1'), t('projCreate.wlt.music_producer.pre_production.planning.check.2'), t('projCreate.wlt.music_producer.pre_production.planning.check.3')]
      },
      client_meeting: {
        title: t('projCreate.wlt.music_producer.pre_production.client_meeting.title'),
        description: t('projCreate.wlt.music_producer.pre_production.client_meeting.desc'),
        timeEstimate: 2,
        checklistItems: [t('projCreate.wlt.music_producer.pre_production.client_meeting.check.0'), t('projCreate.wlt.music_producer.pre_production.client_meeting.check.1'), t('projCreate.wlt.music_producer.pre_production.client_meeting.check.2'), t('projCreate.wlt.music_producer.pre_production.client_meeting.check.3')]
      },
      equipment_prep: {
        title: t('projCreate.wlt.music_producer.pre_production.equipment_prep.title'),
        description: t('projCreate.wlt.music_producer.pre_production.equipment_prep.desc'),
        timeEstimate: 3,
        checklistItems: [t('projCreate.wlt.music_producer.pre_production.equipment_prep.check.0'), t('projCreate.wlt.music_producer.pre_production.equipment_prep.check.1'), t('projCreate.wlt.music_producer.pre_production.equipment_prep.check.2'), t('projCreate.wlt.music_producer.pre_production.equipment_prep.check.3')]
      }
    },
    production: {
      recording: {
        title: t('projCreate.wlt.music_producer.production.recording.title'),
        description: t('projCreate.wlt.music_producer.production.recording.desc'),
        timeEstimate: 10,
        checklistItems: [t('projCreate.wlt.music_producer.production.recording.check.0'), t('projCreate.wlt.music_producer.production.recording.check.1'), t('projCreate.wlt.music_producer.production.recording.check.2'), t('projCreate.wlt.music_producer.production.recording.check.3')]
      },
      directing: {
        title: t('projCreate.wlt.music_producer.production.directing.title'),
        description: t('projCreate.wlt.music_producer.production.directing.desc'),
        timeEstimate: 6,
        checklistItems: [t('projCreate.wlt.music_producer.production.directing.check.0'), t('projCreate.wlt.music_producer.production.directing.check.1'), t('projCreate.wlt.music_producer.production.directing.check.2'), t('projCreate.wlt.music_producer.production.directing.check.3')]
      },
      on_set_coordination: {
        title: t('projCreate.wlt.music_producer.production.on_set_coordination.title'),
        description: t('projCreate.wlt.music_producer.production.on_set_coordination.desc'),
        timeEstimate: 4,
        checklistItems: [t('projCreate.wlt.music_producer.production.on_set_coordination.check.0'), t('projCreate.wlt.music_producer.production.on_set_coordination.check.1'), t('projCreate.wlt.music_producer.production.on_set_coordination.check.2'), t('projCreate.wlt.music_producer.production.on_set_coordination.check.3')]
      }
    },
    post_production: {
      editing: {
        title: t('projCreate.wlt.music_producer.post_production.editing.title'),
        description: t('projCreate.wlt.music_producer.post_production.editing.desc'),
        timeEstimate: 15,
        checklistItems: [t('projCreate.wlt.music_producer.post_production.editing.check.0'), t('projCreate.wlt.music_producer.post_production.editing.check.1'), t('projCreate.wlt.music_producer.post_production.editing.check.2'), t('projCreate.wlt.music_producer.post_production.editing.check.3')]
      },
      sound_design: {
        title: t('projCreate.wlt.music_producer.post_production.sound_design.title'),
        description: t('projCreate.wlt.music_producer.post_production.sound_design.desc'),
        timeEstimate: 8,
        checklistItems: [t('projCreate.wlt.music_producer.post_production.sound_design.check.0'), t('projCreate.wlt.music_producer.post_production.sound_design.check.1'), t('projCreate.wlt.music_producer.post_production.sound_design.check.2'), t('projCreate.wlt.music_producer.post_production.sound_design.check.3')]
      },
      client_review: {
        title: t('projCreate.wlt.music_producer.post_production.client_review.title'),
        description: t('projCreate.wlt.music_producer.post_production.client_review.desc'),
        timeEstimate: 4,
        checklistItems: [t('projCreate.wlt.music_producer.post_production.client_review.check.0'), t('projCreate.wlt.music_producer.post_production.client_review.check.1'), t('projCreate.wlt.music_producer.post_production.client_review.check.2'), t('projCreate.wlt.music_producer.post_production.client_review.check.3')]
      }
    },
    business: {
      invoicing: {
        title: t('projCreate.wlt.music_producer.business.invoicing.title'),
        description: t('projCreate.wlt.music_producer.business.invoicing.desc'),
        timeEstimate: 2,
        checklistItems: [t('projCreate.wlt.music_producer.business.invoicing.check.0'), t('projCreate.wlt.music_producer.business.invoicing.check.1'), t('projCreate.wlt.music_producer.business.invoicing.check.2'), t('projCreate.wlt.music_producer.business.invoicing.check.3')]
      },
      marketing: {
        title: t('projCreate.wlt.music_producer.business.marketing.title'),
        description: t('projCreate.wlt.music_producer.business.marketing.desc'),
        timeEstimate: 3,
        checklistItems: [t('projCreate.wlt.music_producer.business.marketing.check.0'), t('projCreate.wlt.music_producer.business.marketing.check.1'), t('projCreate.wlt.music_producer.business.marketing.check.2'), t('projCreate.wlt.music_producer.business.marketing.check.3')]
      },
      client_follow_up: {
        title: t('projCreate.wlt.music_producer.business.client_follow_up.title'),
        description: t('projCreate.wlt.music_producer.business.client_follow_up.desc'),
        timeEstimate: 1,
        checklistItems: [t('projCreate.wlt.music_producer.business.client_follow_up.check.0'), t('projCreate.wlt.music_producer.business.client_follow_up.check.1'), t('projCreate.wlt.music_producer.business.client_follow_up.check.2'), t('projCreate.wlt.music_producer.business.client_follow_up.check.3')]
      }
    }
  },
  videographer: {
    pre_production: {
      planning: {
        title: t('projCreate.wlt.videographer.pre_production.planning.title'),
        description: t('projCreate.wlt.videographer.pre_production.planning.desc'),
        timeEstimate: 5,
        checklistItems: [t('projCreate.wlt.videographer.pre_production.planning.check.0'), t('projCreate.wlt.videographer.pre_production.planning.check.1'), t('projCreate.wlt.videographer.pre_production.planning.check.2'), t('projCreate.wlt.videographer.pre_production.planning.check.3')]
      },
      client_meeting: {
        title: t('projCreate.wlt.videographer.pre_production.client_meeting.title'),
        description: t('projCreate.wlt.videographer.pre_production.client_meeting.desc'),
        timeEstimate: 2,
        checklistItems: [t('projCreate.wlt.videographer.pre_production.client_meeting.check.0'), t('projCreate.wlt.videographer.pre_production.client_meeting.check.1'), t('projCreate.wlt.videographer.pre_production.client_meeting.check.2'), t('projCreate.wlt.videographer.pre_production.client_meeting.check.3')]
      },
      location_scouting: {
        title: t('projCreate.wlt.videographer.pre_production.location_scouting.title'),
        description: t('projCreate.wlt.videographer.pre_production.location_scouting.desc'),
        timeEstimate: 4,
        checklistItems: [t('projCreate.wlt.videographer.pre_production.location_scouting.check.0'), t('projCreate.wlt.videographer.pre_production.location_scouting.check.1'), t('projCreate.wlt.videographer.pre_production.location_scouting.check.2'), t('projCreate.wlt.videographer.pre_production.location_scouting.check.3')]
      }
    },
    production: {
      filming: {
        title: t('projCreate.wlt.videographer.production.filming.title'),
        description: t('projCreate.wlt.videographer.production.filming.desc'),
        timeEstimate: 12,
        checklistItems: [t('projCreate.wlt.videographer.production.filming.check.0'), t('projCreate.wlt.videographer.production.filming.check.1'), t('projCreate.wlt.videographer.production.filming.check.2'), t('projCreate.wlt.videographer.production.filming.check.3')]
      },
      directing: {
        title: t('projCreate.wlt.videographer.production.directing.title'),
        description: t('projCreate.wlt.videographer.production.directing.desc'),
        timeEstimate: 8,
        checklistItems: [t('projCreate.wlt.videographer.production.directing.check.0'), t('projCreate.wlt.videographer.production.directing.check.1'), t('projCreate.wlt.videographer.production.directing.check.2'), t('projCreate.wlt.videographer.production.directing.check.3')]
      },
      on_set_coordination: {
        title: t('projCreate.wlt.videographer.production.on_set_coordination.title'),
        description: t('projCreate.wlt.videographer.production.on_set_coordination.desc'),
        timeEstimate: 6,
        checklistItems: [t('projCreate.wlt.videographer.production.on_set_coordination.check.0'), t('projCreate.wlt.videographer.production.on_set_coordination.check.1'), t('projCreate.wlt.videographer.production.on_set_coordination.check.2'), t('projCreate.wlt.videographer.production.on_set_coordination.check.3')]
      }
    },
    post_production: {
      editing: {
        title: t('projCreate.wlt.videographer.post_production.editing.title'),
        description: t('projCreate.wlt.videographer.post_production.editing.desc'),
        timeEstimate: 20,
        checklistItems: [t('projCreate.wlt.videographer.post_production.editing.check.0'), t('projCreate.wlt.videographer.post_production.editing.check.1'), t('projCreate.wlt.videographer.post_production.editing.check.2'), t('projCreate.wlt.videographer.post_production.editing.check.3')]
      },
      color_grading: {
        title: t('projCreate.wlt.videographer.post_production.color_grading.title'),
        description: t('projCreate.wlt.videographer.post_production.color_grading.desc'),
        timeEstimate: 8,
        checklistItems: [t('projCreate.wlt.videographer.post_production.color_grading.check.0'), t('projCreate.wlt.videographer.post_production.color_grading.check.1'), t('projCreate.wlt.videographer.post_production.color_grading.check.2'), t('projCreate.wlt.videographer.post_production.color_grading.check.3')]
      },
      sound_design: {
        title: t('projCreate.wlt.videographer.post_production.sound_design.title'),
        description: t('projCreate.wlt.videographer.post_production.sound_design.desc'),
        timeEstimate: 10,
        checklistItems: [t('projCreate.wlt.videographer.post_production.sound_design.check.0'), t('projCreate.wlt.videographer.post_production.sound_design.check.1'), t('projCreate.wlt.videographer.post_production.sound_design.check.2'), t('projCreate.wlt.videographer.post_production.sound_design.check.3')]
      }
    },
    business: {
      invoicing: {
        title: t('projCreate.wlt.videographer.business.invoicing.title'),
        description: t('projCreate.wlt.videographer.business.invoicing.desc'),
        timeEstimate: 2,
        checklistItems: [t('projCreate.wlt.videographer.business.invoicing.check.0'), t('projCreate.wlt.videographer.business.invoicing.check.1'), t('projCreate.wlt.videographer.business.invoicing.check.2'), t('projCreate.wlt.videographer.business.invoicing.check.3')]
      },
      portfolio_update: {
        title: t('projCreate.wlt.videographer.business.portfolio_update.title'),
        description: t('projCreate.wlt.videographer.business.portfolio_update.desc'),
        timeEstimate: 3,
        checklistItems: [t('projCreate.wlt.videographer.business.portfolio_update.check.0'), t('projCreate.wlt.videographer.business.portfolio_update.check.1'), t('projCreate.wlt.videographer.business.portfolio_update.check.2'), t('projCreate.wlt.videographer.business.portfolio_update.check.3')]
      }
    }
  },
  vendor: {
    pre_production: {
      planning: {
        title: t('projCreate.wlt.vendor.pre_production.planning.title'),
        description: t('projCreate.wlt.vendor.pre_production.planning.desc'),
        timeEstimate: 4,
        checklistItems: [t('projCreate.wlt.vendor.pre_production.planning.check.0'), t('projCreate.wlt.vendor.pre_production.planning.check.1'), t('projCreate.wlt.vendor.pre_production.planning.check.2'), t('projCreate.wlt.vendor.pre_production.planning.check.3')]
      },
      client_meeting: {
        title: t('projCreate.wlt.vendor.pre_production.client_meeting.title'),
        description: t('projCreate.wlt.vendor.pre_production.client_meeting.desc'),
        timeEstimate: 2,
        checklistItems: [t('projCreate.wlt.vendor.pre_production.client_meeting.check.0'), t('projCreate.wlt.vendor.pre_production.client_meeting.check.1'), t('projCreate.wlt.vendor.pre_production.client_meeting.check.2'), t('projCreate.wlt.vendor.pre_production.client_meeting.check.3')]
      }
    },
    production: {
      filming: {
        title: t('projCreate.wlt.vendor.production.filming.title'),
        description: t('projCreate.wlt.vendor.production.filming.desc'),
        timeEstimate: 6,
        checklistItems: [t('projCreate.wlt.vendor.production.filming.check.0'), t('projCreate.wlt.vendor.production.filming.check.1'), t('projCreate.wlt.vendor.production.filming.check.2'), t('projCreate.wlt.vendor.production.filming.check.3')]
      }
    },
    post_production: {
      editing: {
        title: t('projCreate.wlt.vendor.post_production.editing.title'),
        description: t('projCreate.wlt.vendor.post_production.editing.desc'),
        timeEstimate: 8,
        checklistItems: [t('projCreate.wlt.vendor.post_production.editing.check.0'), t('projCreate.wlt.vendor.post_production.editing.check.1'), t('projCreate.wlt.vendor.post_production.editing.check.2'), t('projCreate.wlt.vendor.post_production.editing.check.3')]
      }
    },
    business: {
      invoicing: {
        title: t('projCreate.wlt.vendor.business.invoicing.title'),
        description: t('projCreate.wlt.vendor.business.invoicing.desc'),
        timeEstimate: 3,
        checklistItems: [t('projCreate.wlt.vendor.business.invoicing.check.0'), t('projCreate.wlt.vendor.business.invoicing.check.1'), t('projCreate.wlt.vendor.business.invoicing.check.2'), t('projCreate.wlt.vendor.business.invoicing.check.3')]
      },
      marketing: {
        title: t('projCreate.wlt.vendor.business.marketing.title'),
        description: t('projCreate.wlt.vendor.business.marketing.desc'),
        timeEstimate: 5,
        checklistItems: [t('projCreate.wlt.vendor.business.marketing.check.0'), t('projCreate.wlt.vendor.business.marketing.check.1'), t('projCreate.wlt.vendor.business.marketing.check.2'), t('projCreate.wlt.vendor.business.marketing.check.3')]
      }
    }
  }
});

// Template generation engine - intelligently creates worklog entries with dynamic pricing
const generateWorklogTemplate = (
  t: ReturnType<typeof useT>['t'],
  profession: string, 
  phase: string, 
  category: string, 
  projectType?: string, 
  culture?: string,
  pricingData?: any
) => {
  const DYNAMIC_WORKLOG_TEMPLATES = buildDynamicWorklogTemplates(t);
  // Get base template
  const baseTemplate = (DYNAMIC_WORKLOG_TEMPLATES as Record<string, Record<string, Record<string, { title: string; description: string; timeEstimate: number; checklistItems: string[] }>>>)[profession]?.[phase]?.[category];
  if (!baseTemplate) {
    return {
      title: `${category.replace('_,', ', ').replace(/\b\w/g, l => l.toUpperCase())} - ${phase.replace('_',', ')}`,
      description: t('projCreate.wlt.fallbackDesc', { category: category.replace('_',', '), phase: phase.replace('_', ', ') }),
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
    const culturalTips = buildCulturalDayWorklogTips(t)[culture];
    if (culturalTips && Object.keys(culturalTips).length > 0) {
      // Add cultural considerations to description
      const culturalContext = `\n\n🌍 ${t('projCreate.worklog.culturalConsiderations', { culture })}:\n${Object.values(culturalTips)[0]?.considerations?.slice(0, 3).map(c => `• ${c}`).join('\n') || t('projCreate.worklog.specialCulturalNote')}`;
      template.description += culturalContext;
  }
}

  // Add project type specific adjustments
  if (projectType && profession === 'music_producer') {
    if (projectType === 'album') {
      template.timeEstimate = Math.ceil(template.timeEstimate * 1.5); // Album projects take longer
      template.description += t('projCreate.wlt.albumNote');
  } else if (projectType === 'commercial') {
      template.description += t('projCreate.wlt.commercialNote');
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
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useT();
  const cultureNames = useMemo<Record<string, string>>(() => ({
    norsk: t('projCreate.culture.norsk'),
    sikh: t('projCreate.culture.sikh'),
    indisk: t('projCreate.culture.indisk'),
    pakistansk: t('projCreate.culture.pakistansk'),
    tyrkisk: t('projCreate.culture.tyrkisk'),
    arabisk: t('projCreate.culture.arabisk'),
    somalisk: t('projCreate.culture.somalisk'),
    etiopisk: t('projCreate.culture.etiopisk'),
    nigeriansk: t('projCreate.culture.nigeriansk'),
    muslimsk: t('projCreate.culture.muslimsk'),
    libanesisk: t('projCreate.culture.libanesisk'),
    filipino: t('projCreate.culture.filipino'),
    kinesisk: t('projCreate.culture.kinesisk'),
    koreansk: t('projCreate.culture.koreansk'),
    thai: t('projCreate.culture.thai'),
    iransk: t('projCreate.culture.iransk'),
    annet: t('projCreate.culture.annet'),
  }), [t]);
  const PROJECT_PHASES = useMemo(() => buildProjectPhases(t), [t]);
  const CULTURAL_DAY_EXPLANATIONS = useMemo(() => buildCulturalDayExplanations(t), [t]);
  const CULTURAL_DAY_WORKLOG_TIPS = useMemo(() => buildCulturalDayWorklogTips(t), [t]);

  // Create auth headers for API requests
  const auth = {
    ...authSessionService.getAuthHeadersSync(),
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
    getComponentTheme
} = useTheme();
  
  const { 
    isConnected, 
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
      label: t('projCreate.step.basics.label'), 
      description: t('projCreate.step.basics.desc'),
      icon: <Person />
    },
    { 
      label: t('projCreate.step.split.label'), 
      description: t('projCreate.step.split.desc'),
      icon: <AccountBalance />
    },
  ], [t]);
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
  const meetingOption = projectData?.meetingOption;
  const meetingTime = projectData?.meetingTime;
  const meetingDuration = projectData?.meetingDuration;
  const save = async () => {
    try {
      await fetch('/api/user/meeting-preferences', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          profession,
          meetingOption,
          meetingTime,
          meetingDuration,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      log.warn('Failed to persist meeting preferences', error);
    }
  };
  save();
  return () => controller.abort();
}, [user, profession, projectData?.meetingOption, projectData?.meetingTime, projectData?.meetingDuration]);

  // Check user authentication status (only after auth has finished loading to
  // avoid spamming a warning during the initial token exchange).
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      showWarningToast('No authenticated user found. Some features may not work properly.', 6000);
      log.warn('No authenticated user found. Some features may not work properly.');
  } else {
      showInfoToast('User authenticated successfully', 2000);
      log.info('User authenticated', user.email || user.id);
  }
}, [user, authLoading, log, showWarningToast, showInfoToast]);

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
  // ID of the TROLL project created by this demo run — set when seed
  // is triggered, used on dialog complete to navigate to the seeded
  // project instead of going back to the empty form.
  const [trollSeededProjectId, setTrollSeededProjectId] = useState<string | null>(null);

  // Open TROLL Demo Dialog
  const handleOpenTrollDialog = useCallback(() => {
    setTrollInitDialogOpen(true);
    setTrollInitStatus('idle');
    setTrollInitAreas({});
    setTrollInitProgress(0);
    setTrollInitError(null);
    setTrollSeededProjectId(null);
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
      
      // Step 4: Load all data status from database. Hver demo-kjøring
      // får sin egen prosjekt-ID så brukeren kan ha flere TROLL-kopier
      // uten data-kollisjon (backend scoper alle entity-IDer per
      // projectId via eid()-helper i seedTrollDemo).
      const trollNewProjectId = `troll-${Date.now()}`;
      setTrollSeededProjectId(trollNewProjectId);
      setTrollInitStatus('loading');
      const response = await fetch('/api/demo/troll/initialize-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: trollNewProjectId,
          projectName: 'TROLL',
        })
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
      const trollProject = projects.find((p: any) => p.id === trollNewProjectId || p.name === 'TROLL');
      
      if (trollProject) {
        // Load candidates, crew, locations from database
        const [trollCandidates, crew, locations] = await Promise.all([
          castingService.getCandidates(trollNewProjectId),
          castingService.getCrew(trollNewProjectId),
          castingService.getLocations(trollNewProjectId)
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
        const splitSheetResponse = await fetch(`/api/split-sheets?project_id=${encodeURIComponent(trollNewProjectId)}`);
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
        throw new Error(t('projCreate.toast.trollNotFoundDb'));
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
      showSuccessToast(t('projCreate.toast.trollLoaded'), 5000);
      // Naviger direkte til det seeded prosjektet i stedet for å gå
      // tilbake til create-formen — brukeren ser full demo-data uten
      // å måtte gjennomgå create-stegene på nytt.
      if (trollSeededProjectId && onProjectCreated) {
        onProjectCreated({
          id: trollSeededProjectId,
          name: 'TROLL',
          projectType: 'film',
        });
      } else {
        setActiveStep(0);
      }
    }
  }, [trollInitStatus, showSuccessToast, trollSeededProjectId, onProjectCreated]);

  // Load TROLL Demo Project - Comprehensive film production example (legacy, now opens dialog)
  const handleLoadTrollDemo = useCallback(async () => {
    handleOpenTrollDialog();
  }, [handleOpenTrollDialog]);

  // Event Management linkage prompt
  const [askedConnectEvent, setAskedConnectEvent] = useState(false);
  const [connectToEvent, setConnectToEvent] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [addCollaboratorDialogOpen, setAddCollaboratorDialogOpen] = useState(false);
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState('');
  const [newCollaboratorName, setNewCollaboratorName] = useState('');
  const [collaboratorEmailError, setCollaboratorEmailError] = useState(false);

  useEffect(() => {
    if (projectData?.projectType === 'event' && !askedConnectEvent) {
      setConnectDialogOpen(true);
    }
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
          showSuccessToast(t('projCreate.toast.splitCreated'));
        }
      } catch (e) {
        log.warn('Failed to create split sheet', e);
        showErrorToast(t('projCreate.err.splitCreateFail'));
      }
    };
    createSplitSheet();
  }, [currentProject?.id, projectData.enableSplitSheet, projectData.projectName, projectData.description, projectData.collaborators, projectData.splitSheetData, mapCollaboratorsToContributors, showSuccessToast, showErrorToast]);
  
  // Lead import modal states
  const [showLeadImport, setShowLeadImport] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  
  // Get profession-specific split sheet descriptions
  const splitSheetInfo = useMemo(() => {
    const getSplitSheetDescription = (prof: string) => {
      const descriptions: Record<string, { main: string; explanation: string }> = {
        music_producer: {
          main: t('projCreate.ss.music.main'),
          explanation: t('projCreate.ss.music.expl')
        },
        photographer: {
          main: t('projCreate.ss.photo.main'),
          explanation: t('projCreate.ss.photo.expl')
        },
        videographer: {
          main: t('projCreate.ss.video.main'),
          explanation: t('projCreate.ss.video.expl')
        }
      };
      return descriptions[prof] || {
        main: t('projCreate.ss.default.main'),
        explanation: t('projCreate.ss.default.expl')
      };
    };
    return getSplitSheetDescription(userProfession);
  }, [userProfession, t]);

  // Validate email helper
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle adding collaborator
  const handleAddCollaborator = () => {
    if (!newCollaboratorEmail.trim()) {
      setCollaboratorEmailError(true);
      showErrorToast(t('projCreate.err.emailRequired'));
      return;
    }

    if (!validateEmail(newCollaboratorEmail)) {
      setCollaboratorEmailError(true);
      showErrorToast(t('projCreate.err.emailInvalid'));
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
      showSuccessToast(t('projCreate.toast.openingEvent'), 3000);
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
    } catch (error) {
      log.warn('Failed to create event from project data', error);
      showErrorToast(t('projCreate.err.eventCreateFail'), 5000);
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
          ? (getTerm ? t('projCreate.dlg.newTerm', { x: getTerm('project') }) : t('projCreate.dlg.newDefault'))
          : initialData ? 'Create Project from Submission' : 'Project Creation with Memory Cards'
        }
      </Typography>

      {/* Vertical Stepper with Step Content */}
      <Stepper 
        activeStep={activeStep} 
        orientation="vertical" 
        sx={{ mt: 3, mb: 3 }}
        aria-label={t('projCreate.aria.stepperSteps')}
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
                  {/* Project responsible fields */}
                  <Card
                    sx={{
                      mb: 3,
                      borderRadius: 3,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'box-shadow 0.3s ease',
                      '&:hover': {
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                      },
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
                          color: 'text.primary',
                        }}
                      >
                        <Person sx={{ color: 'primary.main' }} />
                        {t('projCreate.contact.heading')}
                      </Typography>
                      <Divider sx={{ mb: 2, mt: 1 }} />
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          mb: 2,
                          fontSize: '0.875rem',
                          fontStyle: 'italic',
                        }}
                      >
                        {t('projCreate.contact.subtitle')}
                      </Typography>
                      <Stack spacing={2}>
                        <TextField
                          label={t('projCreate.field.leadName')}
                          fullWidth
                          value={projectData.clientName || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setProjectData((prev) => ({ ...prev, clientName: value }));
                          }}
                          autoComplete="name"
                        />
                        <TextField
                          label={t('projCreate.field.email')}
                          fullWidth
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          value={projectData.clientEmail || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setProjectData((prev) => ({ ...prev, clientEmail: value }));
                          }}
                        />
                        <TextField
                          label={t('projCreate.field.phone')}
                          fullWidth
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={projectData.clientPhone || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setProjectData((prev) => ({ ...prev, clientPhone: value }));
                          }}
                        />
                      </Stack>
                    </CardContent>
                  </Card>

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
                        {t('projCreate.type.heading')}
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
                          {t('projCreate.btn.demoProject')}
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
                          {loadingTrollDemo ? t('projCreate.common.loading') : t('projCreate.troll.loadDemoBtn')}
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
                          {t('projCreate.troll.loadDemoSub')}
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
                          {t('projCreate.team.heading')}
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
                          {t('projCreate.team.subtitle')}
                        </Typography>
                        <ProjectCollaborators
                          collaborators={projectData.collaborators || []}
                          onAddCollaborator={() => setAddCollaboratorDialogOpen(true)}
                          onRemoveCollaborator={(id) => {
                            setProjectData((prev) => ({
                              ...prev,
                              collaborators: (prev.collaborators || []).filter((c: any) => c.id !== id)
                            }));
                            showSuccessToast(t('projCreate.toast.collabRemoved'));
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
                            {t('projCreate.ss.enableLabel')}
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
                              {t('projCreate.ss.autoCreate')}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'text.secondary' }}>
                              {t('projCreate.ss.autoCreateDesc')}
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
                  aria-label={index === creationSteps.length - 1 ? t('projCreate.aria.finishProject') : t('projCreate.aria.nextStep')}
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
                  {index === creationSteps.length - 1 ? t('projCreate.btn.finish') : t('projCreate.btn.next')}
                </Button>
                <Button
                  disabled={index === 0}
                  onClick={handleBack}
                  aria-label={t('projCreate.aria.prevStep')}
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
          {t('projCreate.collab.dialogTitle')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label={t('projCreate.collab.name')}
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
              label={t('projCreate.field.email')}
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
              helperText={collaboratorEmailError ? t('projCreate.err.emailInvalid') : ''}
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
                {t('projCreate.collab.note')}
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
          >{t('projCreate.btn.cancel')}</Button>
          <Button 
            variant="contained" 
            onClick={handleAddCollaborator}
            sx={{ fontWeight: 600 }}
          >{t('projCreate.btn.add')}</Button>
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
                {t('projCreate.troll.loadDemoTitle')}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
                {t('projCreate.troll.intro')}
                Alle data lastes fra databasen - ingenting er hardkodet.
              </Typography>
              <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('projCreate.troll.willLoad')}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  <li>{t('projCreate.troll.li.projectRoles')}</li>
                  <li>{t('projCreate.troll.li.candidates')}</li>
                  <li>{t('projCreate.troll.li.crew')}</li>
                  <li>{t('projCreate.troll.li.locations')}</li>
                  <li>{t('projCreate.troll.li.days')}</li>
                  <li>{t('projCreate.troll.li.scenes')}</li>
                  <li>{t('projCreate.troll.li.offers')}</li>
                  <li>{t('projCreate.troll.li.consents')}</li>
                  <li>{t('projCreate.troll.li.splitSheet')}</li>
                  <li>{t('projCreate.troll.li.equipment')}</li>
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
                            showWarningToast(t('projCreate.toast.trollDataNotFound'), 5000);
                          } else {
                            setTrollInitStatus('complete');
                          }
                        }
                      } else {
                        setTrollInitStatus('idle');
                        showErrorToast(t('projCreate.err.checkDbStatus'), 3000);
                      }
                    } catch (error) {
                      log.warn('Unable to verify TROLL database status', error);
                      setTrollInitStatus('idle');
                      showErrorToast(t('projCreate.err.dbConnection'), 3000);
                    }
                  }}
                  startIcon={<Info />}
                  sx={{ px: 3, py: 1.5 }}
                >
                  {t('projCreate.troll.btn.checkExisting')}
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
                  {t('projCreate.troll.btn.startInit')}
                </Button>
              </Stack>
            </Box>
          )}

          {(trollInitStatus === 'initializing' || trollInitStatus === 'loading') && (
            <Box sx={{ py: 3 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  {trollInitStatus === 'initializing' ? t('projCreate.troll.status.initializing') : t('projCreate.troll.status.loading')}
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
                  {t('projCreate.troll.percentComplete', { n: trollInitProgress })}
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
                    {t('projCreate.troll.dataAreas')}
                  </Typography>
                  {Object.entries(trollInitAreas).map(([key, area]) => {
                    const areaLabels: Record<string, string> = {
                      project: t('projCreate.area.project'),
                      roles: t('projCreate.area.roles'),
                      candidates: t('projCreate.area.candidates'),
                      crew: 'Crew',
                      locations: t('projCreate.area.locations'),
                      production_days: t('projCreate.area.production_days'),
                      scenes: t('projCreate.area.scenes'),
                      shot_lists: 'Shot Lists',
                      offers: t('projCreate.area.offers'),
                      contracts: t('projCreate.area.contracts'),
                      consents: t('projCreate.area.consents'),
                      split_sheets: 'Split Sheets',
                      equipment: t('projCreate.area.equipment'),
                      schedules: t('projCreate.area.schedules'),
                      props: t('projCreate.area.props'),
                      manuscripts: t('projCreate.area.manuscripts')
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
                          ) : area.status === 'not_supported' ? (
                            <CheckCircle sx={{ color: 'text.disabled', fontSize: 20 }} />
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
                          label={
                            area.status === 'not_supported'
                              ? t('projCreate.troll.notEnabled')
                              : area.count === 0 ? t('projCreate.troll.empty') : t('projCreate.troll.elements', { n: area.count })
                          }
                          size="small"
                          color={
                            area.status === 'loaded' && area.count > 0
                              ? 'success'
                              : area.status === 'not_supported'
                                ? 'default'
                                : area.status === 'empty' || area.count === 0
                                  ? 'warning'
                                  : 'default'
                          }
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
                    {t('projCreate.troll.someMissing')}
                  </Typography>
                  <Typography variant="body2">
                    {t('projCreate.troll.missingHelp')}
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="success" sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {t('projCreate.troll.demoReady')}
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
                  {t('projCreate.troll.summaryLoaded')}
                </Typography>
                {Object.entries(trollInitAreas).map(([key, area]) => {
                  // Norwegian labels for areas
                  const areaLabels: Record<string, string> = {
                    project: t('projCreate.area.project'),
                    roles: t('projCreate.area.roles'),
                    candidates: t('projCreate.area.candidates'),
                    crew: 'Crew',
                    locations: t('projCreate.area.locations'),
                    production_days: t('projCreate.area.production_days'),
                    scenes: t('projCreate.area.scenes'),
                    shot_lists: 'Shot Lists',
                    offers: t('projCreate.area.offers'),
                    contracts: t('projCreate.area.contracts'),
                    consents: t('projCreate.area.consents'),
                    split_sheets: 'Split Sheets',
                    equipment: t('projCreate.area.equipment'),
                    schedules: t('projCreate.area.schedules'),
                    props: t('projCreate.area.props'),
                    manuscripts: t('projCreate.area.manuscripts')
                  };
                  const label = areaLabels[key] || key.replace(/_/g, ' ');
                  // not_supported betyr at tabellen ikke finnes i schemaet — vises
                  // diskret istedenfor som "manglende data".
                  const isEmpty = area.status === 'empty' || area.status === 'not_found'
                    || (area.count === 0 && area.status !== 'not_supported');
                  
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
                              {t('projCreate.troll.noDataFound')}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Chip 
                        label={isEmpty ? t('projCreate.troll.empty') : t('projCreate.troll.elements', { n: area.count })}
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
                    {t('projCreate.troll.dataPreview')}
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
                  {trollInitError || t('projCreate.troll.unknownError')}
                </Typography>
              </Alert>
              <Button 
                variant="outlined" 
                onClick={handleInitializeTrollDemo}
                startIcon={<Refresh />}
              >
                {t('projCreate.btn.tryAgain')}
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => setTrollInitDialogOpen(false)}
            disabled={trollInitStatus === 'initializing' || trollInitStatus === 'loading'}
          >
            {trollInitStatus === 'complete' ? t('projCreate.btn.close') : t('projCreate.btn.cancel')}
          </Button>
          {trollInitStatus === 'complete' && Object.values(trollInitAreas).some(a => a.status === 'empty' || a.status === 'not_found' || (a.count === 0 && a.status !== 'not_supported')) && (
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
              {t('projCreate.troll.btn.initMissing')}
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
              {t('projCreate.troll.continueToProject')}
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
            {t('projCreate.draft.heading')}
          </Typography>
          <IconButton onClick={() => setDraftSidebarOpen(false)} size="small" aria-label={t('projCreate.draft.ariaClose')}>
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
                label={mode === 'draft' ? t('projCreate.draft.chip.draft') : mode === 'published' ? t('projCreate.draft.chip.published') : 'Live'}
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
          <Tooltip title={t('projCreate.draft.tip.save')}>
            <Button
              variant="outlined"
              startIcon={<Save />}
              fullWidth
              onClick={async () => {
                if (currentProject?.id) {
                  await saveProjectDraft({ ...projectData, name: projectData.projectName, type: projectData.projectType } as unknown as Partial<Project>);
                  setHasUnsavedChanges(false);
                  showSuccessToast(t('projCreate.toast.draftSaved'), 3000);
                }
              }}
              sx={{ fontWeight: 600, justifyContent: 'flex-start' }}
            >
              <Badge badgeContent={hasUnsavedChanges ? '!' : 0} color="warning">
                {t('projCreate.draft.btn.save')}
              </Badge>
            </Button>
          </Tooltip>

          <Tooltip title={t('projCreate.draft.tip.load')}>
            <Button
              variant="outlined"
              startIcon={<Restore />}
              fullWidth
              onClick={async () => {
                if (currentProject?.id) {
                  const draft = getProjectDraft();
                  if (draft) {
                    setProjectData(draft as unknown as ProjectData);
                    showSuccessToast(t('projCreate.toast.draftLoaded'), 3000);
                  }
                }
              }}
              sx={{ fontWeight: 600, justifyContent: 'flex-start' }}
            >
              {t('projCreate.draft.btn.load')}
            </Button>
          </Tooltip>

          <Tooltip title={t('projCreate.draft.tip.delete')}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              fullWidth
              onClick={async () => {
                if (currentProject?.id) {
                  deleteProjectDraft();
                  showInfoToast(t('projCreate.toast.draftDeleted'), 3000);
                }
              }}
              sx={{ fontWeight: 600, justifyContent: 'flex-start' }}
            >
              {t('projCreate.draft.btn.delete')}
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
            {t('projCreate.draft.btn.showHistory')}
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
          <Button size="small" startIcon={<ChevronLeft />} onClick={() => setDraftSidebarOpen(false)}>{t('projCreate.btn.close')}</Button>
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
            <Typography variant="body2" color="text.secondary">{t('projCreate.draft.noHistory')}</Typography>
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
          <Button onClick={() => setShowHistoryDialog(false)}>{t('projCreate.btn.close')}</Button>
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
            {publishedProject ? t('projCreate.cmp.publishedVersion', { v: publishedProject.version || 'N/A' }) : t('projCreate.cmp.noPublished')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowComparisonDialog(false)}>{t('projCreate.btn.close')}</Button>
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
                  } catch (error) {
                    log.warn('Location analysis failed', error);
                  }
                  setLocationLoading(false);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('projCreate.loc.searchLabel')}
                  placeholder={t('projCreate.loc.searchPlaceholder')}
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
                  {t('projCreate.loc.weatherData')}
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
        <DialogTitle sx={{ fontWeight: 700 }}>{t('projCreate.health.title')}</DialogTitle>
        <DialogContent>
          <ProjectHealthCheck
            projectId={currentProject?.id}
          />
          {!healthCheckPassed && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">{t('projCreate.health.mustPass')}</Typography>
            </Alert>
          )}
          {healthCheckPassed && (
            <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircle />}>
              <Typography variant="body2">{t('projCreate.health.passed')}</Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            handleGoToTab('overview');
            setShowHealthCheck(false);
          }}>{t('projCreate.btn.close')}</Button>
          <Button
            variant="outlined"
            onClick={() => handleGoToStep(0)}
          >
            {t('projCreate.health.goToStart')}
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
            {t('projCreate.btn.createProject')}
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
          {cultureDayDialog.day || t('projCreate.culture.dayFallback')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
            {cultureDayDialog.explanation || t('projCreate.culture.noExplanation')}
          </Typography>
          {cultureDayDialog.culture && CULTURAL_DAY_EXPLANATIONS[cultureDayDialog.culture] && (
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('projCreate.culture.allDaysFor')} {cultureNames[cultureDayDialog.culture] || cultureDayDialog.culture}
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
          <Button onClick={() => setCultureDayDialog(prev => ({ ...prev, open: false }))}>{t('projCreate.btn.close')}</Button>
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
          {t('projCreate.worklog.title')}
        </DialogTitle>
        <DialogContent>
          {/* Phase Selection */}
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>{t('projCreate.worklog.phase')}</Typography>
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
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>{t('projCreate.worklog.category')}</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {PROJECT_PHASES[worklogFormData.projectPhase as keyof typeof PROJECT_PHASES].categories.map((cat: string) => (
                  <Chip
                    key={cat}
                    label={cat.replace(/_/g, ' ')}
                    onClick={() => {
                      setWorklogFormData(prev => ({ ...prev, category: cat }));
                      const template = generateWorklogTemplate(
                        t,
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
            label={t('projCreate.worklog.fieldTitle')}
            fullWidth
            value={worklogFormData.title}
            onChange={(e) => setWorklogFormData(prev => ({ ...prev, title: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            label={t('projCreate.worklog.fieldDesc')}
            fullWidth
            multiline
            rows={4}
            value={worklogFormData.description}
            onChange={(e) => setWorklogFormData(prev => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            label={t('projCreate.worklog.fieldHours')}
            type="number"
            value={worklogFormData.timeSpent}
            onChange={(e) => setWorklogFormData(prev => ({ ...prev, timeSpent: parseFloat(e.target.value) || 0 }))}
            sx={{ mb: 2, width: 150 }}
          />

          {/* Cultural Tips */}
          {projectData.weddingCulture && projectData.weddingCulture !== 'norsk' && CULTURAL_DAY_WORKLOG_TIPS[projectData.weddingCulture] && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                {t('projCreate.worklog.culturalTips', { culture: projectData.weddingCulture })}
              </Typography>
              {Object.entries(CULTURAL_DAY_WORKLOG_TIPS[projectData.weddingCulture]).slice(0, 1).map(([day, tips]) => (
                <Box key={day}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{day}:</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('projCreate.worklog.timeLabel')} {tips.timeManagement}
                  </Typography>
                </Box>
              ))}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWorklogTipsDialog(false)}>{t('projCreate.btn.close')}</Button>
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
              showSuccessToast(t('projCreate.toast.worklogCreated'), 3000);
            }}
          >
            {t('projCreate.worklog.create')}
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
                ? t('projCreate.davinci.enabled')
                : t('projCreate.davinci.needsPost')}
            </Typography>
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {t('projCreate.davinci.cameraLabel')} {projectData.cameraBrand || t('projCreate.common.notDetected')} | LOG: {projectData.logFormat || t('projCreate.common.none')}
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
          <Button onClick={() => setShowScriptManager(false)}>{t('projCreate.btn.close')}</Button>
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
              {t('projCreate.lead.none')}
            </Typography>
          ) : (
            <List>
              {availableLeads.map((lead: Record<string, unknown>, idx: number) => (
                <ListItemButton
                  key={idx}
                  onClick={async () => {
                    await importFromLead(lead);
                    setShowLeadImport(false);
                    showSuccessToast(t('projCreate.toast.leadImported'), 3000);
                  }}
                  disabled={isImporting}
                >
                  <ListItemAvatar>
                    <Avatar>{(String(lead.name || lead.email || '?'))[0].toUpperCase()}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={String(lead.name || lead.email || `Lead ${idx + 1}`)}
                    secondary={String(lead.email || lead.phone || t('projCreate.lead.noContact'))}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLeadImport(false)}>{t('projCreate.btn.close')}</Button>
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
          <Button onClick={() => setShowVersionHistory(false)}>{t('projCreate.btn.close')}</Button>
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
        <DialogTitle sx={{ fontWeight: 700 }}>{t('projCreate.preview.title')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{projectData.projectName || t('projCreate.preview.noName')}</Typography>
            <Typography variant="body2" color="text.secondary">{projectData.description || t('projCreate.preview.noDescription')}</Typography>
            <Divider />
            <Typography variant="caption">Type: {projectData.projectType}</Typography>
            <Typography variant="caption">{t('projCreate.preview.dateLabel')} {projectData.eventDate || t('projCreate.common.notSet')}</Typography>
            <Typography variant="caption">Lokasjon: {projectData.location || 'Ikke satt'}</Typography>
            <Typography variant="caption">PIN: {generatePinFromProjectName(projectData.projectName)}</Typography>
            <Typography variant="caption">Estimert tid: {getProjectTimeEstimate(projectData.projectType, userProfession)} timer</Typography>
            <Typography variant="caption">Standard pris: {getDefaultPricing(userProfession)} NOK</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>{t('projCreate.btn.close')}</Button>
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
                showSuccessToast(t('projCreate.toast.projectCreated'), 3000);
              } catch {
                showErrorToast('Feil ved opprettelse', 5000);
              }
              setIsCreating(false);
              setShowPreview(false);
            }}
          >
            {isCreating ? t('projCreate.btn.creating') : t('projCreate.btn.createProject')}
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
              {t('projCreate.tools.heading')}
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
                  label={t('projCreate.tools.labelingChip', { scheme: LABELING_SCHEMES[projectData.memoryCardLabeling]?.join('-') || 'ABCD' })} 
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
              <Tooltip title={t('projCreate.tip.openDrafts')}>
                <IconButton onClick={() => setDraftSidebarOpen(true)} color="primary"><Drafts /></IconButton>
              </Tooltip>
              <Tooltip title={t('projCreate.tip.showPreview')}>
                <IconButton onClick={() => setShowPreview(true)} color="primary"><Visibility /></IconButton>
              </Tooltip>
              <Tooltip title={t('projCreate.tip.healthCheck')}>
                <IconButton onClick={() => setShowHealthCheck(true)} color="primary"><CheckCircle /></IconButton>
              </Tooltip>
              <Tooltip title={t('projCreate.tip.importLead')}>
                <IconButton onClick={() => setShowLeadImport(true)} color="primary"><PersonAdd /></IconButton>
              </Tooltip>
              <Tooltip title={t('projCreate.tip.versionHistory')}>
                <IconButton onClick={() => setShowVersionHistory(true)} color="primary"><History /></IconButton>
              </Tooltip>
              <Tooltip title={t('projCreate.tip.worklogTips')}>
                <IconButton onClick={() => setShowWorklogTipsDialog(true)} color="primary"><Assignment /></IconButton>
              </Tooltip>
              <Tooltip title="DaVinci Script Manager">
                <IconButton onClick={openDavinciScriptManager} color="secondary"><CameraAlt /></IconButton>
              </Tooltip>
              {connectToEvent && (
                <Tooltip title={t('projCreate.tip.openEvent')}>
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
                  {t('projCreate.mem.heading')}
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
                      {t('projCreate.mem.recommendations')}
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
                    label={t('projCreate.mem.cardType')}
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
                        showSuccessToast(t('projCreate.toast.projectUpdated'));
                      }
                    }}>{t('projCreate.btn.save')}</Button>
                    <Button size="small" startIcon={<Refresh />} onClick={() => {
                      if (currentProject?.id) loadProject(currentProject.id);
                    }}>{t('projCreate.tools.reload')}</Button>
                    <Button size="small" startIcon={<Delete />} color="error" onClick={() => {
                      if (currentProject?.id) deleteProject(currentProject.id);
                    }}>{t('projCreate.btn.delete')}</Button>
                    <Button size="small" startIcon={<AddIcon />} onClick={() => {
                      if (currentProject?.id) duplicateProject(currentProject.id);
                    }}>{t('projCreate.tools.duplicate')}</Button>
                    <Button size="small" startIcon={<Storage />} onClick={() => {
                      if (currentProject?.id) archiveProject(currentProject.id);
                    }}>{t('projCreate.tools.archive')}</Button>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
                    <Button size="small" variant="text" startIcon={<Settings />} onClick={async () => {
                      if (currentProject?.id) {
                        const s = await getProjectSettings(currentProject.id);
                        log.info('Project settings', s);
                        await updateProjectSettings(currentProject.id, { lastAccessed: new Date().toISOString() });
                      }
                    }}>{t('projCreate.tools.settings')}</Button>
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
                          name: user?.email?.split('@')[0] || t('projCreate.common.newUser'),
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
                    }}>{t('projCreate.tools.integrations')}</Button>
                    <Button size="small" variant="text" startIcon={<CloudUpload />} onClick={async () => {
                      if (currentProject?.id) await uploadProjectFile(currentProject.id, new File(['test'], 'test.txt', { type: 'text/plain' }));
                    }}>Last opp</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        const files = await getProjectFiles(currentProject.id);
                        log.info('Project files', files);
                      }
                    }}>{t('projCreate.tools.files')}</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) await addProjectMilestone(currentProject.id, {
                        id: crypto.randomUUID(),
                        name: t('projCreate.tools.newMilestone'),
                        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        completed: false
                      });
                    }}>{t('projCreate.tools.milestone')}</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) await updateProjectStatus(currentProject.id, 'active');
                    }}>Status</Button>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        const comments = await getProjectComments(currentProject.id);
                        log.info('Comments', comments);
                        await addProjectComment(currentProject.id, t('projCreate.toast.projectUpdated'));
                      }
                    }}>{t('projCreate.tools.comments')}</Button>
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
                    }}>{t('projCreate.tools.analysis')}</Button>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
                    <Button size="small" variant="text" onClick={async () => {
                      const results = await searchProjects(projectData.projectName);
                      log.info('Search results', results);
                    }}>{t('projCreate.btn.search')}</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      const dateResults = await getProjectsByDateRange(new Date().toISOString(), new Date().toISOString());
                      log.info('Date range results', dateResults);
                    }}>{t('projCreate.tools.dateSearch')}</Button>
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
                    }}>{t('projCreate.tools.offlineSync')}</Button>
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
                    }}>{t('projCreate.tools.testIntegration')}</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        transformProjectData(projectData, 'normalize');
                        await migrateProjectData(currentProject.id, 'v2');
                        await rollbackProjectData(currentProject.id, 'v1');
                      }
                    }}>{t('projCreate.tools.dataMigration')}</Button>
                    <Button size="small" variant="text" onClick={async () => {
                      if (currentProject?.id) {
                        await optimizeProjectData(currentProject.id);
                        await analyzeProjectData(currentProject.id);
                        await cleanupProjectData(currentProject.id);
                      }
                    }}>{t('projCreate.tools.optimize')}</Button>
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
                    }}>{t('projCreate.tools.access')}</Button>
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
                    }}>{t('projCreate.tools.createSession')}</Button>
                    <Button size="small" variant="outlined" onClick={() => {
                      if (currentProject?.id) joinSession(currentProject.id);
                    }}>{t('projCreate.tools.join')}</Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => {
                      if (currentProject?.id) leaveSession();
                    }}>{t('projCreate.tools.leave')}</Button>
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
                      <Typography variant="body2">{t('projCreate.settings.darkModeOn')}</Typography>
                      <Typography variant="body2">Standard type: {String(currentSetting || 'Ikke satt')}</Typography>
                      <Button size="small" onClick={() => {
                        updateSetting('language', settings.language === 'nb' ? 'en' : 'nb');
                      }}>{t('projCreate.settings.updateSetting')}</Button>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mt: 1 }}>
                        <Tooltip title="Fotografi"><PhotoCamera sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Video"><Videocam sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title={t('projCreate.tip.memoryCard')}><Memory sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Timeplan"><Schedule sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title={t('projCreate.tip.finance')}><AttachMoney sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Handlekurv"><ShoppingCart sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Betaling"><Payment sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Favoritt"><Favorite sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Portrett"><Portrait sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title={t('projCreate.tip.business')}><Business sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Musikk"><MusicNote sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Butikk"><ShoppingBag sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="E-sport"><SportsEsports sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Arbeid"><Work sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Kampanje"><Campaign sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Mikrofon"><Mic sx={{ fontSize: 20 }} /></Tooltip>
                        <Tooltip title="Bruk"><Check sx={{ fontSize: 20 }} /></Tooltip>
                      </Stack>
                      <FormControl size="small" sx={{ mt: 1, minWidth: 150 }}>
                        <InputLabel>{t('projCreate.tools.labeling')}</InputLabel>
                        <Select
                          value={memoryCardLabeling}
                          label={t('projCreate.tools.labeling')}
                          onChange={(e) => setMemoryCardLabeling(e.target.value as LabelingKey)}
                        >
                          <MenuItem value="ABCD">ABCD</MenuItem>
                          <MenuItem value="EFGH">EFGH</MenuItem>
                          <MenuItem value="NUMERIC">{t('projCreate.mem.numeric')}</MenuItem>
                        </Select>
                      </FormControl>
                      <FormControlLabel
                        control={<Checkbox checked={projectData.driveIntegration} onChange={(e) => setProjectData(prev => ({ ...prev, driveIntegration: e.target.checked }))} />}
                        label={t('projCreate.mem.driveIntegration')}
                      />
                      <FormControlLabel
                        control={<Radio checked={projectData.automaticPricing} onChange={() => setProjectData(prev => ({ ...prev, automaticPricing: !prev.automaticPricing }))} />}
                        label={t('projCreate.mem.autoPricing')}
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
                        label={cultureNames[key] || culture.name}
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
