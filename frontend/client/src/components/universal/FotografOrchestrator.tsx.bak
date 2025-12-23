import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { 
  Box, 
  Typography, 
  Grid, 
  Card as MuiCard, 
  CardContent, 
  Chip, 
  LinearProgress, 
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
// import ContractGenerator from './contracts/contract-generator'; // Not currently used
import { 
  AutoAwesome,
  PersonAdd,
  CameraAlt,
  CheckCircle,
  Info,
  AddCircle as Add,
  PlayArrow,
  Edit,
  Delete,
  Save,
  Cancel,
  DragIndicator,
  Email,
  Sms,
  WavingHand,
  Schedule,
  Notifications,
  Feedback,
  Phone,
  Folder,
  FolderCopy,
  Backup,
  FolderShared,
  CloudSync,
  Description,
  Draw,
  Receipt,
  Palette,
  TrendingUp as TimelineIcon,
  Update,
  Battery90,
  SdCard,
  Monitor,
  Build,
  PhotoLibrary,
  AutoFixHigh,
  Search,
  Copyright,
  FileUpload,
  Slideshow,
  Star,
  Payment,
  CreditCard,
  Assessment,
  TrendingUp,
  AttachMoney,
  RequestQuote,
  Archive,
  FiberNew,
  Assignment,
  Event,
  TaskAlt,
  Analytics,
  Business,
  Person,
  Notes,
  Handshake,
  MenuBook,
  Share,
  Brush,
  ManageSearch,
  Article,
  CameraEnhance,
  Security,
  Lock,
  Shield,
  Refresh,
  Church,
  Lightbulb,
  WbSunny,
  Map,
  FlightTakeoff,
  ExpandMore
} from '@mui/icons-material';

// Ekte orkestrering - automatiske triggere mellom komponenter
const FOTOGRAF_ORCHESTRATIONS = {
  nyKlient: {
    name: 'Ny Klient Workflow',
    trigger: 'client_registration',
    actions: [
      {
        component: 'BRREGIntegration',
        action: 'validateBusiness',
        autoTrigger: true
      },
      {
        component: 'GoogleDriveProjectSync', 
        action: 'createProjectFolder',
        dependsOn: 'BRREGIntegration.success'
      },
      {
        component: 'ContractGenerator',
        action: 'generateContract',
        dependsOn: 'GoogleDriveProjectSync.success'
      },
      {
        component: 'ShowcaseLanding',
        action: 'createClientShowcase',
        dependsOn: 'ContractGenerator.success'
      },
      {
        component: 'UniversalChatWidget',
        action: 'sendWelcomeMessage',
        dependsOn: 'ShowcaseLanding.success'
      }
    ],
    status: 'active'
  },
  aiPhotoEnhancement: {
    name: 'AI Bildebehandling Workflow',
    trigger: 'file_upload',
    actions: [
      {
        component: 'UniversalFileUpload',
        action: 'processUpload',
        autoTrigger: true
      },
      {
        component: 'PhotoEnhancementSuite',
        action: 'analyzePhoto',
        dependsOn: 'UniversalFileUpload.success'
      },
      {
        component: 'PhotoEnhancementSuite',
        action: 'autoEnhance',
        dependsOn: 'PhotoEnhancementSuite.analyzePhoto'
      },
      {
        component: 'UniversalRAWProcessor',
        action: 'processRAW',
        dependsOn: 'PhotoEnhancementSuite.autoEnhance'
      },
      {
        component: 'GoogleDriveProjectSync',
        action: 'syncToClient',
        dependsOn: 'UniversalRAWProcessor.success'
      },
      {
        component: 'UniversalChatWidget',
        action: 'notifyClient',
        dependsOn: 'GoogleDriveProjectSync.success'
      }
    ],
    status: 'active'
  },
  portraitEnhancement: {
    name: 'AI Portrett Forbedring',
    trigger: 'portrait_detected',
    actions: [
      {
        component: 'PhotoEnhancementSuite',
        action: 'detectFace',
        autoTrigger: true
      },
      {
        component: 'AdvancedAIPortraitService',
        action: 'enhancePortrait',
        dependsOn: 'PhotoEnhancementSuite.detectFace'
      },
      {
        component: 'AdvancedAIPortraitService',
        action: 'removeEyeBags',
        dependsOn: 'AdvancedAIPortraitService.enhancePortrait'
      },
      {
        component: 'AdvancedAIPortraitService',
        action: 'skinRetouching',
        dependsOn: 'AdvancedAIPortraitService.removeEyeBags'
      },
      {
        component: 'ClientGallery',
        action: 'addToGallery',
        dependsOn: 'AdvancedAIPortraitService.skinRetouching'
      }
    ],
    status: 'active'
  },
  weddingWorkflow: {
    name: 'Bryllup Full Workflow',
    trigger: 'wedding_project_creation',
    actions: [
      {
        component: 'WeddingTimelineAdmin',
        action: 'createTimeline',
        autoTrigger: true
      },
      {
        component: 'ContractGenerator',
        action: 'generateWeddingContract',
        dependsOn: 'WeddingTimelineAdmin.createTimeline'
      },
      {
        component: 'GoogleDriveProjectSync',
        action: 'createWeddingFolder',
        dependsOn: 'ContractGenerator.success'
      },
      {
        component: 'WeddingTimelineClient',
        action: 'shareWithCouple',
        dependsOn: 'GoogleDriveProjectSync.success'
      },
      {
        component: 'UniversalChatWidget',
        action: 'setupWeddingChat',
        dependsOn: 'WeddingTimelineClient.success'
      }
    ],
    status: 'active'
  },
  showcaseCreation: {
    name: 'Automatisk Showcase Opprettelse',
    trigger: 'project_completion',
    actions: [
      {
        component: 'ClientGallery',
        action: 'selectBestPhotos',
        autoTrigger: true
      },
      {
        component: 'ShowcaseLanding',
        action: 'createShowcase',
        dependsOn: 'ClientGallery.selectBestPhotos'
      },
      {
        component: 'ShowcaseLanding',
        action: 'generateSEO',
        dependsOn: 'ShowcaseLanding.createShowcase'
      },
      {
        component: 'UniversalChatWidget',
        action: 'shareShowcaseLink',
        dependsOn: 'ShowcaseLanding.generateSEO'
      }
    ],
    status: 'active'
  },
  virtualStudioSetup: {
    name: 'Virtual Studio Setup',
    trigger: 'virtual_session_requested',
    actions: [
      {
        component: 'VirtualStudio',
        action: 'initialize3DScene',
        autoTrigger: true
      },
      {
        component: 'VirtualStudio',
        action: 'loadEquipmentModels',
        dependsOn: 'VirtualStudio.initialize3DScene'
      },
      {
        component: 'VirtualStudio',
        action: 'setupLighting',
        dependsOn: 'VirtualStudio.loadEquipmentModels'
      },
      {
        component: 'VirtualStudio',
        action: 'applyHDRI',
        dependsOn: 'VirtualStudio.setupLighting'
      },
      {
        component: 'ClientGallery',
        action: 'previewVirtualShoot',
        dependsOn: 'VirtualStudio.applyHDRI'
      }
    ],
    status: 'active'
  },
  utstyrMelding: {
    name: 'Smart Utstyrsstyring',
    trigger: 'equipment_status_change',
    actions: [
      {
        component: 'EquipmentManagementDB',
        action: 'checkStatus',
        autoTrigger: true
      },
      {
        component: 'EquipmentAnalytics',
        action: 'analyzeUsage',
        dependsOn: 'EquipmentManagementDB.checkStatus'
      },
      {
        component: 'EquipmentMaintenanceScheduler',
        action: 'scheduleIfNeeded',
        dependsOn: 'EquipmentAnalytics.analyzeUsage'
      },
      {
        component: 'UniversalChatWidget',
        action: 'alertPhotographer',
        dependsOn: 'EquipmentMaintenanceScheduler.scheduled'
      }
    ],
    status: 'active'
  }
};

// Aktive orkestreringsdata
interface OrchestrationState {
  [key: string]: {
    running: boolean;
    lastRun: Date | null;
    completedActions: string[];
    failedActions: string[];
}
}

// Sanntids systemstatistikker
const SYSTEM_METRICS = [
  { name: 'CPU Usage', value: 0, unit: '%', type: 'performance', threshold: 80 },
  { name: 'Memory Usage', value: 0, unit: '%', type: 'performance', threshold: 85 },
  { name: 'Storage Usage', value: 0, unit: '%', type: 'storage', threshold: 90 },
  { name: 'Network Latency', value: 0, unit: 'ms', type: 'network', threshold: 200 },
  { name: 'Database Connections', value: 0, unit: ',', type: 'database', threshold: 100 },
  { name: 'Active Users', value: 0, unit: ',', type: 'users', threshold: 1000 }
];

interface FotografOrchestratorProps {
  sessionId?: string;
  activeWorkflow?: string;
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any
}

// Alle workflow byggeklosser fra CreatorHub Norge - organisert i kategorier som fotografer forstår
const WORKFLOW_ACTIONS = {
  // KOMMUNIKASJON
  sendEmail: { name: 'Send e-post', icon: Email, description: 'Sender automatisk e-post til kunde', category: 'Kommunikasjon'},
  sendSMS: { name: 'Send SMS', icon: Sms, description: 'Sender SMS til kunde', category: 'Kommunikasjon' },
  sendWelcomeMessage: { name: 'Send velkomstmelding', icon: WavingHand, description: 'Sender velkomstmelding til ny kunde', category: 'Kommunikasjon'},
  scheduleReminder: { name: 'Planlegg påminnelse', icon: Schedule, description: 'Setter opp automatisk påminnelse', category: 'Kommunikasjon'},
  notifyClient: { name: 'Varsle kunde', icon: Notifications, description: 'Sender varsling til kunde om oppdatering', category: 'Kommunikasjon'},
  sendFeedbackForm: { name: 'Send tilbakemeldingsskjema', icon: Feedback, description: 'Sender skjema for kundetilbakemelding', category: 'Kommunikasjon'},
  scheduleFollowUp: { name: 'Planlegg oppfølging', icon: Phone, description: 'Setter opp automatisk oppfølging med kunde', category: 'Kommunikasjon'},

  // FILHÅNDTERING & GOOGLE DRIVE
  createFolder: { name: 'Lag mappe', icon: Folder, description: 'Lager ny mappe i Google Drive', category: 'Filhåndtering & Google Drive' },
  createProjectStructure: { name: 'Lag prosjektstruktur', icon: FolderCopy, description: 'Oppretter komplett mappestruktur for prosjekt', category: 'Filhåndtering & Google Drive' },
  backupFiles: { name: 'Sikkerhetskopier filer', icon: Backup, description: 'Tar backup av alle prosjektfiler', category: 'Filhåndtering & Google Drive' },
  organizeFiles: { name: 'Organiser filer', icon: Folder, description: 'Sorterer og organiserer filer automatisk', category: 'Filhåndtering & Google Drive' },
  shareFolder: { name: 'Del mappe', icon: FolderShared, description: 'Deler Google Drive mappe med kunde', category: 'Filhåndtering & Google Drive' },
  syncToCloud: { name: 'Synkroniser til sky', icon: CloudSync, description: 'Synkroniserer alle filer til skytjeneste', category: 'Filhåndtering & Google Drive' },

  // DOKUMENTER & KONTRAKTER
  makeContract: { name: 'Lag kontrakt', icon: Description, description: 'Lager kontrakt automatisk', category: 'Dokumenter & Kontrakter' },
  updateContract: { name: 'Oppdater kontrakt', icon: Edit, description: 'Oppdaterer eksisterende kontrakt', category: 'Dokumenter & Kontrakter' },
  signContract: { name: 'Signer kontrakt', icon: Draw, description: 'Sender kontrakt til digital signering', category: 'Dokumenter & Kontrakter' },
  createInvoice: { name: 'Lag faktura', icon: Receipt, description: 'Genererer faktura basert på kontrakt', category: 'Dokumenter & Kontrakter' },
  createMoodboard: { name: 'Lag moodboard', icon: Palette, description: 'Oppretter visuelt moodboard for prosjekt', category: 'Dokumenter & Kontrakter' },
  createTimeline: { name: 'Lag tidslinje', icon: TimelineIcon, description: 'Oppretter detaljert prosjekttidslinje', category: 'Dokumenter & Kontrakter' },

  // UTSTYR & TEKNISK
  checkEquipment: { name: 'Sjekk utstyr', icon: CameraAlt, description: 'Sjekker om utstyr er tilgjengelig', category: 'Utstyr & Teknisk' },
  updateFirmware: { name: 'Oppdater firmware', icon: Update, description: 'Sjekker og oppdaterer kamera firmware', category: 'Utstyr & Teknisk' },
  checkBattery: { name: 'Sjekk batterier', icon: Battery90, description: 'Kontrollerer batteristatus på utstyr', category: 'Utstyr & Teknisk' },
  formatMemoryCards: { name: 'Formater minnekort', icon: SdCard, description: 'Formaterer og klargjør minnekort', category: 'Utstyr & Teknisk' },
  calibrateMonitor: { name: 'Kalibrer skjerm', icon: Monitor, description: 'Kalibrerer skjerm for fargenøyaktighet', category: 'Utstyr & Teknisk' },
  scheduleEquipmentCheck: { name: 'Planlegg utstyrssjekk', icon: Build, description: 'Setter opp automatisk utstyrssjekk', category: 'Utstyr & Teknisk' },

  // BILDER & GALLERIER  
  createGallery: { name: 'Lag galleri', icon: PhotoLibrary, description: 'Lager bildegalleri for kunde', category: 'Bilder & Gallerier' },
  processImages: { name: 'Behandle bilder', icon: AutoFixHigh, description: 'Automatisk bildebehandling og optimering', category: 'Bilder & Gallerier' },
  generateThumbnails: { name: 'Lag miniatyrbilder', icon: Search, description: 'Genererer thumbnails for galleriet', category: 'Bilder & Gallerier' },
  watermarkImages: { name: 'Legg til vannmerke', icon: Copyright, description: 'Legger til vannmerke på bilder', category: 'Bilder & Gallerier' },
  exportImages: { name: 'Eksporter bilder', icon: FileUpload, description: 'Eksporterer bilder i ønskede formater', category: 'Bilder & Gallerier' },
  createSlideshow: { name: 'Lag lysbildefremvisning', icon: Slideshow, description: 'Oppretter automatisk lysbildefremvisning', category: 'Bilder & Gallerier' },
  enhancePhotos: { name: 'Forbedr bilder', icon: Star, description: 'Forbedrer bildekvalitet automatisk', category: 'Bilder & Gallerier' },

  // ØKONOMI & FAKTURERING
  sendInvoice: { name: 'Send faktura', icon: Payment, description: 'Sender faktura til kunde', category: 'Økonomi & Fakturering' },
  trackPayment: { name: 'Spor betaling', icon: CreditCard, description: 'Sporer betalingsstatus for fakturaer', category: 'Økonomi & Fakturering' },
  calculateVAT: { name: 'Beregn MV', icon: Assessment, description: 'Automatisk MVA-beregning', category: 'Økonomi & Fakturering' },
  createExpenseReport: { name: 'Lag utgiftsrapport', icon: TrendingUp, description: 'Genererer rapport over prosjektutgifter', category: 'Økonomi & Fakturering' },
  updatePricing: { name: 'Oppdater priser', icon: AttachMoney, description: 'Oppdaterer prisliste og pakker', category: 'Økonomi & Fakturering' },
  generateQuote: { name: 'Lag pristilbud', icon: RequestQuote, description: 'Genererer pristilbud til kunde', category: 'Økonomi & Fakturering' },

  // PROSJEKTHÅNDTERING
  archiveProject: { name: 'Arkiver prosjekt', icon: Archive, description: 'Flytter prosjekt til arkiv', category: 'Prosjekthåndtering' },
  createProject: { name: 'Opprett prosjekt', icon: FiberNew, description: 'Starter nytt fotografiprosjekt', category: 'Prosjekthåndtering' },
  updateProjectStatus: { name: 'Oppdater prosjektstatus', icon: Assignment, description: 'Endrer status på prosjekt', category: 'Prosjekthåndtering' },
  scheduleShoot: { name: 'Planlegg fotografering', icon: Event, description: 'Setter opp tid og sted for fotografering', category: 'Prosjekthåndtering' },
  assignTasks: { name: 'Tildel oppgaver', icon: TaskAlt, description: 'Tildeler oppgaver til teammedlemmer', category: 'Prosjekthåndtering' },
  trackProgress: { name: 'Spor fremdrift', icon: Analytics, description: 'Overvåker prosjektfremdrift', category: 'Prosjekthåndtering' },

  // KUNDE & RELASJON
  validateBRREG: { name: 'Valider bedriftsinfo', icon: Business, description: 'Sjekker kundeinfo mot Brønnøysundregistrene', category: 'Kunde & Relasjon' },
  createClientProfile: { name: 'Lag kundeprofil', icon: Person, description: 'Oppretter komplett kundeprofil', category: 'Kunde & Relasjon' },
  updateClientNotes: { name: 'Oppdater kundenotater', icon: Notes, description: 'Legger til notater om kunde og preferanser', category: 'Kunde & Relasjon' },
  scheduleConsultation: { name: 'Planlegg konsultasjon', icon: Handshake, description: 'Setter opp møte med kunde', category: 'Kunde & Relasjon' },
  trackClientHistory: { name: 'Spor kundehistorikk', icon: MenuBook, description: 'Holder oversikt over tidligere prosjekter', category: 'Kunde & Relasjon' },

  // MARKEDSFØRING & SOSIALE MEDIER
  shareOnSocial: { name: 'Del på sosiale medier', icon: Share, description: 'Publiserer bilder på sosiale plattformer', category: 'Markedsføring & Sosiale Medier' },
  createPortfolio: { name: 'Oppdater portfolio', icon: Brush, description: 'Legger til nye bilder i portfolio', category: 'Markedsføring & Sosiale Medier' },
  generateSEOContent: { name: 'Lag SEO-innhold', icon: ManageSearch, description: 'Genererer søkemotoroptimalisert innhold', category: 'Markedsføring & Sosiale Medier' },
  createNewsletter: { name: 'Lag nyhetsbrev', icon: Article, description: 'Oppretter og sender nyhetsbrev til kunder', category: 'Markedsføring & Sosiale Medier' },
  postToInstagram: { name: 'Post til Instagram', icon: CameraEnhance, description: 'Publiserer bilder automatisk til Instagram', category: 'Markedsføring & Sosiale Medier' },

  // BACKUP & SIKKERHET
  createBackup: { name: 'Ta sikkerhetskopi', icon: Security, description: 'Sikkerhetskopier alle prosjektdata', category: 'Backup & Sikkerhet' },
  encryptFiles: { name: 'Krypter filer', icon: Lock, description: 'Krypterer sensitive filer for sikkerhet', category: 'Backup & Sikkerhet' },
  auditAccess: { name: 'Kontroller tilgang', icon: Shield, description: 'Gjennomgår hvem som har tilgang til filer', category: 'Backup & Sikkerhet' },
  recoverFiles: { name: 'Gjenopprett filer', icon: Refresh, description: 'Gjenoppretter slettede eller skadede filer', category: 'Backup & Sikkerhet' },

  // SPESIALVERKTØY
  createWeddingTimeline: { name: 'Lag bryllupstidslinje', icon: Church, description: 'Oppretter detaljert bryllupstidslinje', category: 'Spesialverktøy' },
  setup3DLighting: { name: 'Sett opp 3D-belysning', icon: Lightbulb, description: 'Planlegger belysningsoppsett i 3', category: 'Spesialverktøy' },
  generateWeatherReport: { name: 'Hent værmelding', icon: WbSunny, description: 'Henter værprognose for fotograferingsdag', category: 'Spesialverktøy' },
  createLocationMap: { name: 'Lag lokasjonskart', icon: Map, description: 'Oppretter kart over fotograferingslokasjoner', category: 'Spesialverktøy' },
  setupDroneFlightPlan: { name: 'Planlegg droneflygning', icon: FlightTakeoff, description: 'Setter opp flyplan for drone-fotografering', category: 'Spesialverktøy' }
};

function FotografOrchestrator({ 
  sessionId,
  activeWorkflow = 'nyKlient',
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient
}: FotografOrchestratorProps) {
  const [selectedOrchestration, setSelectedOrchestration] = useState(activeWorkflow);
  // Metrics kjører i bakgrunnen uten brukergrensesnitt
  const [showSystemMetrics, setShowSystemMetrics] = useState(false);
  const [orchestrationStates, setOrchestrationStates] = useState<OrchestrationState>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [manualTriggerData, setManualTriggerData] = useState<any>({});
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const [triggeringStates, setTriggeringStates] = useState<{[key: string]: boolean}>({});
  
  // Workflow Builder state - enkelt for bestemor å bruke
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [customWorkflows, setCustomWorkflows] = useState<any[]>([]);
  const [newWorkflow, setNewWorkflow] = useState<{
    name: string;
    description: string;
    actions: any[];
  }>({
    name: '',
    description: '',
    actions: []
  });
  const [currentStep, setCurrentStep] = useState(0);

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Profession system integration
  const { professionConfig, isLoading: configLoading } = useProfessionConfigs('photographer');
  const { professionAdapter } = useProfessionAdapter('photographer');
  const professionIcon = getProfessionIcon('photographer');
  const { professions: dynamicProfessions } = useDynamicProfessions();

  // Orkestreringsstatuser
  const { data: orchestrationStatus = {}, isLoading } = useQuery({
    queryKey: ['/api/orchestration/status,', sessionId],
    queryFn: () => apiRequest(`/api/orchestration/status/${sessionId}`),
    retry: false,
    refetchInterval: 2000 // Real-time oppdateringer
  });

  // System metrics query
  const { data: systemMetrics = {} } = useQuery({
    queryKey: ['/api/system/metrics'],
    queryFn: () => apiRequest('/api/system/metrics'),
    retry: false,
    refetchInterval: 3000
  });

  // Trigger orchestration
  const triggerOrchestration = useMutation({
    mutationFn: async ({ orchestrationId, triggerData }: { orchestrationId: string, triggerData: any }) => {
      setTriggeringStates(prev => ({ ...prev, [orchestrationId]: true }));
      return apiRequest(`/api/orchestration/trigger`, {
        headers: {
          "Content-Type" : "application/json"
        },
        method: 'POST',
        body: JSON.stringify({ orchestrationId, triggerData, sessionId })
      });
    },
    onSuccess: (data, variables) => {
      setOrchestrationStates(prev => ({
        ...prev,
        [variables.orchestrationId]: {
          running: true,
          lastRun: new Date(),
          completedActions: [],
          failedActions: []
        }
      }));
      queryClient.invalidateQueries({ queryKey: ['/api/orchestration/status'] });
      setTriggeringStates(prev => ({ ...prev, [variables.orchestrationId]: false }));
    },
    onError: (error, variables) => {
      setTriggeringStates(prev => ({ ...prev, [variables.orchestrationId]: false }));
    }
  });

  // Kontrollert automatisk triggering ved oppstart
  useEffect(() => {
    if (!hasAutoTriggered && sessionId && activeWorkflow) {
      console.log('🚀 Auto-triggering initial orchestration: ', activeWorkflow);
      triggerOrchestration.mutate({ 
        orchestrationId: activeWorkflow, 
        triggerData: { autoTrigger: true }
      });
      setHasAutoTriggered(true);
    }
  }, [sessionId, activeWorkflow, hasAutoTriggered]);

  const handleOrchestrationTrigger = (orchestrationId: string, triggerData?: any) => {
    // Forhindre multiple samtidige triggers for samme orchestration
    if (triggeringStates[orchestrationId]) {
      console.log('⚠️ Trigger allerede i gang for', orchestrationId, ', venter...');
      return;
    }
    
    console.log('🎯 Manual trigger:', orchestrationId);
    triggerOrchestration.mutate({ orchestrationId, triggerData: triggerData || {} });
  };

  const openOrchestrationDetails = (orchestrationKey: string) => {
    setSelectedOrchestration(orchestrationKey);
    setDetailsOpen(true);
  };

  // Workflow Builder funksjoner - så enkelt som å bygge med Lego
  const addActionToWorkflow = (actionKey: string) => {
    const action = (WORKFLOW_ACTIONS as any)[actionKey];
    const newAction = { ...action, id: Date.now() };
    
    setNewWorkflow(prev => ({
      ...prev,
      actions: [...prev.actions, newAction]
    }));

    // Trigger unified workflow events based on action type
    if (actionKey === 'createProject' && onProjectUpdate) {
      const projectData = {
        id: `project_${Date.now()}`,
        title: 'Nytt Fotografiprosjekt',
        type: 'photography',
        status: 'planning',
        createdAt: new Date().toISOString(),
        source: 'fotograf_orchestrator',
        workflow: selectedOrchestration
      };
      console.log('📸 Fotograf Project Created:', projectData);
      onProjectUpdate(projectData);
    }

    if (actionKey === 'scheduleMeeting' && onMeetingCreate) {
      const meetingData = {
        id: `meeting_${Date.now()}`,
        title: 'Konsultasjonsmøte',
        type: 'consultation',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        source: 'fotograf_orchestrator',
        workflow: selectedOrchestration
      };
      console.log('📅 Fotograf Meeting Created:', meetingData);
      onMeetingCreate(meetingData);
    }

    if (actionKey === 'createShowcase' && onShowcaseCreate) {
      const showcaseData = {
        id: `showcase_${Date.now()}`,
        title: 'Portefølje Showcase',
        type: 'portfolio',
        status: 'draft',
        createdAt: new Date().toISOString(),
        source: 'fotograf_orchestrator',
        workflow: selectedOrchestration
      };
      console.log('🎨 Fotograf Showcase Created:', showcaseData);
      onShowcaseCreate(showcaseData);
    }
  };

  const removeActionFromWorkflow = (actionId: number) => {
    setNewWorkflow(prev => ({
      ...prev,
      actions: prev.actions.filter(action => action.id !== actionId)
        }));
  };

  const saveCustomWorkflow = () => {
    if (newWorkflow.name && newWorkflow.actions.length > 0) {
      const workflow = {
        ...newWorkflow,
        id: Date.now(),
        created: new Date().toISOString()
      };
      setCustomWorkflows(prev => [...prev, workflow]);
      setNewWorkflow({ name: ', ', description: ', ', actions: [] });
      setCurrentStep(0);
      setShowWorkflowBuilder(false);
    }
  };

  const runCustomWorkflow = async (workflow: any) => {
    console.log('🎯 Kjører custom workflow:', workflow.name);
    for (const action of workflow.actions) {
      console.log(`📋 Utfører: ${action.name}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulerer arbeid
    }
    console.log('✅ Custom workflow fullført!');
  };

  const editCustomWorkflow = (workflow: any) => {
    setNewWorkflow({
      name: workflow.name,
      description: workflow.description || ', ',
      actions: workflow.actions || []
    });
    setCurrentStep(0);
    setShowWorkflowBuilder(true);
    // Fjern den gamle versjonen fra listen når vi redigerer
    setCustomWorkflows(prev => prev.filter(w => w.id !== workflow.id));
  };

  const getMetricColor = (metric: any) => {
    if (metric.value > metric.threshold) return '#f44336'; // Red
    if (metric.value > metric.threshold * 0.8) return '#ff9800'; // Orange
    return '#4caf50'; // Green
};

  const getOrchestrationStatusColor = (orchestrationKey: string) => {
    const state = orchestrationStates[orchestrationKey] || (orchestrationStatus as any)[orchestrationKey];
    if (state?.running) return '#4caf50'; // Green
    if ((FOTOGRAF_ORCHESTRATIONS as any)[orchestrationKey]?.status === 'active') return '#2196f3'; // Blue
    return '#757575'; // Gray
  };

  return (
    <>
    <MuiCard sx={{ p: 3 }}>
      {/* Enkel header som bestemor forstår */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 1 }}>
          {professionIcon && <Box sx={{ color: theming.colors.primary, fontSize: 48, display: 'flex' }}>{professionIcon}</Box>}
          <Build sx={{ color: '#667eea', fontSize: 48 }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, color: theming.colors.primary }}>
          {professionConfig?.displayName || 'Fotograf'} - Smart Arbeidsflyt
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Systemet passer på at alt fungerer sammen automatisk
        </Typography>
      </Box>

      {/* Enkle handlinger fotografen kan forstå */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <MuiCard sx={{ 
            p: 3, 
            textAlign: 'center',
            border: '2px solid #e0e0e','&:hover': { borderColor: '#667eea', boxShadow:  2 }
        }}>
            <PersonAdd sx={{ color: '#667eea', fontSize: 40, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1, color: theming.colors.primary }}>
              Ny kunde
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Oppretter automatisk alle mapper og filer
            </Typography>
            <Button variant="contained" 
              size="small"
              onClick={() => handleOrchestrationTrigger('nyKlient')}
              disabled={triggeringStates['nyKlient']}
            >
              {triggeringStates['nyKlient'] ? 'Jobber...' : 'Start'}
            </Button>
          </MuiCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <MuiCard sx={{ 
            p: 3, 
            textAlign: 'center',
            border: '2px solid #e0e0e','&:hover': { borderColor: '#4caf5', boxShadow:  2 }
        }}>
            <CameraAlt sx={{ color: '#4caf5', fontSize: 40, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1, color: theming.colors.primary }}>
              Ny fotografering
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Klargjør utstyr og planlegging
            </Typography>
            <Button variant="contained" 
              size="small"
              onClick={() => handleOrchestrationTrigger('nyProsjekt')}
              disabled={triggeringStates['nyProsjekt']}
            >
              {triggeringStates['nyProsjekt'] ? 'Jobber...' : 'Start'}
            </Button>
          </MuiCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <MuiCard sx={{ 
            p: 3, 
            textAlign: 'center',
            border: '2px solid #e0e0e','&:hover': { borderColor: '#ff980', boxShadow:  2 }
        }}>
            <CheckCircle sx={{ color: '#ff980', fontSize: 40, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1, color: theming.colors.primary }}>
              Ferdig oppdrag
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Ordner levering og fakturering
            </Typography>
            <Button variant="contained" 
              size="small"
              onClick={() => handleOrchestrationTrigger('ferdigOppdrag')}
              disabled={triggeringStates['ferdigOppdrag']}
            >
              {triggeringStates['ferdigOppdrag'] ? 'Jobber...' : 'Start'}
            </Button>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Lag ditt eget workflow - så enkelt som bestemor kan forstå */}
      <Box sx={{ mt: 4, p: 3, bgcolor: '#f0f8ff', borderRadius: 2, border: '1px solid #e3f2fd'}}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
          <AutoAwesome sx={{ color: '#2196f3' }} />
          Lag ditt eget arbeidsflyt
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enkelt som å bygge med Lego! Velg hva systemet skal gjøre automatisk for deg.
        </Typography>
        <Button variant="contained" 
          startIcon={theming.getThemedIcon('add')}
          onClick={() => setShowWorkflowBuilder(true)}
          sx={{ mb: 2 }}
        >
          Lag ny Smart Arbeidsflyt
        </Button>

        {/* Vis eksisterende custom workflows med forbedret design */}
        {customWorkflows.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1}}>
              <Build sx={{ fontSize: 20, color: '#2196f3' }} />
              Dine arbeidsflyter: </Typography>
            <Grid container spacing={2}>
              {customWorkflows.map((workflow) => (
                <Grid item xs={12} sm={6} md={4} key={workflow.id}>
                  <MuiCard sx={{ 
                    p: 3, 
                    border: '2px solid #e3f2fd',
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fffe 100%)',
                    transition: 'all 0.3s ease','&:hover': { 
                      borderColor: '#2196f', 
                      boxShadow: '0 8px 25px rgba(3, 150, 243, 0.15)',
                      transform: 'translateY(-2px)'
                }
                }}>
                    {/* Workflow ikon basert på første handling eller default */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      {(() => {
                        const firstAction = workflow.actions?.[0];
                        const IconComponent = firstAction && (WORKFLOW_ACTIONS as any)[firstAction] 
                          ? (WORKFLOW_ACTIONS as any)[firstAction].icon 
                          : Build;
                        return <IconComponent sx={{ fontSize: 32, color: '#2196f3' }} />;
                    })()}
                      <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                        {workflow.name}
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                      {workflow.description || `Automatisert flyt med ${workflow.actions?.length || 0} handlinger`}
                    </Typography>
                    
                    {/* Vis første 3 handlinger som forhåndsvisning */}
                    {workflow.actions && workflow.actions.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          Inkluderer: </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {workflow.actions.slice(0, 3).map((actionKey: any, index: number) => {
                            const action = (WORKFLOW_ACTIONS as any)[actionKey];
                            if (!action) return null;
                            const IconComponent = action.icon;
                            return (
                              <Chip
                                key={index}
                                icon={<IconComponent sx={{ fontSize: 16 }} />}
                                label={action.name}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem', height: 24 }}
                              />
                            );
                        })}
                          {workflow.actions.length > 3 && (
                            <Chip
                              label={`+${workflow.actions.length - 3} til`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 24 }}
                            />
                          )}
                        </Box>
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                      <Button size="small" 
                        variant="contained"
                        startIcon={theming.getThemedIcon('play')}
                        onClick={() => runCustomWorkflow(workflow)}
                        sx={{ 
                          bgcolor: '#2196f3','&:hover': { bgcolor: '#1976d2' },
                          borderRadius: 2
                        }}
                      >
                        Kjør
                      </Button>
                      <IconButton 
                        size="small" 
                        sx={{ color: 'text.secondary' }}
                        onClick={() => editCustomWorkflow(workflow)}
                      >
                        <Edit sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  </MuiCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Box>

      {/* Status som er lett å forstå */}
      <Box sx={{ mt: 4, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1}}>
          <Info sx={{ fontSize: 18 }} />
          Status
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {Object.values(triggeringStates).some(state => state) ? 
            'Systemet jobber med å sette opp alt for deg...' : 'Alt er klart. Trykk på knappene over når du trenger hjelp.'}
        </Typography>
      </Box>
    </MuiCard>
    
    {/* Workflow Builder Dialog - Så enkelt som bestemor kan forstå */}
    <Dialog 
      open={showWorkflowBuilder}
      onClose={() => setShowWorkflowBuilder(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1}}>
        <Build sx={{ color: '#2196f3' }} />
        Lag din egen Smart Arbeidsflyt
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={currentStep} orientation="vertical">
          {/* Steg 1: Gi navn til workflow */}
          <Step>
            <StepLabel>Gi et navn til din arbeidsflyt</StepLabel>
            <StepContent>
              <TextField
                fullWidth
                label="Navn på arbeidsflyt"
                placeholder="F.eks: Min spesielle bryllupsrutine"
                value={newWorkflow.name}
                onChange={(e) => setNewWorkflow(prev => ({ ...prev, name: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Beskrivelse (valgfritt)"
                placeholder="Fortell hva denne arbeidsfluten gjør"
                value={newWorkflow.description}
                onChange={(e) => setNewWorkflow(prev => ({ ...prev, description: e.target.value }))}
                sx={{ mb: 2 }}
              />
              <Button variant="contained" 
                onClick={() => setCurrentStep(1)}
                disabled={!newWorkflow.name}
              >
                Neste
              </Button>
            </StepContent>
          </Step>

          {/* Steg 2: Velg handlinger */}
          <Step>
            <StepLabel>Velg hva som skal skje automatisk</StepLabel>
            <StepContent>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Klikk på handlingene du vil legge til. Kategoriene er organisert for å gjøre det enkelt å finne det du trenger!
              </Typography>

              {/* Vis valgte handlinger først hvis det er noen */}
              {newWorkflow.actions.length > 0 && (
                <Box sx={{ mb: 3, p: 2, bgcolor: '#f0f8ff', borderRadius: 2, border: '1px solid #e3f2fd' }}>
                  <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1}}>
                    <CheckCircle sx={{ color: '#2196f3' }} />
                    Valgte handlinger ({newWorkflow.actions.length}):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1}}>
                    {newWorkflow.actions.map((action, index) => (
                      <Chip
                        key={index}
                        icon={<action.icon sx={{ fontSize: 16 }} />}
                        label={action.name}
                        onDelete={() => removeActionFromWorkflow(action.id)}
                        color="primary"
                        variant="outlined"
                        sx={{ mb: 1 }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              {/* Kategoriserte handlinger med expanderbare seksjoner */}
              {Object.entries(
                Object.entries(WORKFLOW_ACTIONS).reduce((categories, [key, action]) => {
                  const category = action.category;
                  if (!categories[category]) categories[category] = [];
                  categories[category].push([key, action]);
                  return categories;
              }, {} as Record<string, Array<[string, any]>>)
              ).map(([categoryName, actions]) => (
                <Accordion key={categoryName} sx={{ mb: 1, border: '1px solid #e0e0e0' }}>
                  <AccordionSummary 
                    expandIcon={<ExpandMore />}
                    sx={{ 
                      bgcolor: '#f8f9fa', '&:hover': { bgcolor: '#e3f2fd' }
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                      {categoryName} ({actions.length} handlinger)
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={1}>
                      {actions.map(([key, action]) => {
                        const ActionIcon = action.icon;
                        return (
                          <Grid item xs={12} sm={6} key={key}>
                            <Paper 
                              sx={{ 
                                p: 2,
                                cursor: 'pointer', 
                                border: '1px solid #e0e0e0', '&:hover': { 
                                  bgcolor: '#e3f2fd', 
                                  borderColor: '#2196f3',
                                  transform: 'translateY(-2px)'
                                },
                                transition: 'all 0.2s'
                              }}
                              onClick={() => addActionToWorkflow(key)}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <ActionIcon sx={{ fontSize: 20, mr: 1, color: '#2196f3' }} />
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                  {action.name}
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                {action.description}
                              </Typography>
                            </Paper>
                          </Grid>
                        );
                    })}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))}

              {/* Valgte handlinger */}
              {newWorkflow.actions.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Din arbeidsflyt vil gjøre dette: </Typography>
                  {newWorkflow.actions.map((action, index) => {
                    const ActionIcon = action.icon;
                    return (
                      <Box 
                        key={action.id}
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                          p: 1,
                          bgcolor: '#f8f9fa', 
                          borderRadius: 1,
                          mb: 1
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {index + 1}.
                        </Typography>
                        <ActionIcon sx={{ fontSize: 18, color: '#2196f3' }} />
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {action.name}
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={() => removeActionFromWorkflow(action.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    );
                })}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1}}>
                <Button onClick={() => setCurrentStep(0)}>Tilbake</Button>
                <Button variant="contained" 
                  onClick={() => setCurrentStep(2)}
                  disabled={newWorkflow.actions.length === 0}
                >
                  Se forhåndsvisning
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Steg 3: Forhåndsvisning og lagre */}
          <Step>
            <StepLabel>Forhåndsvisning og lagre</StepLabel>
            <StepContent>
              <Paper sx={{ p: 2, mb: 2, bgcolor: '#f8f9fa', ...theming.getThemedCardSx() }}>
                <Typography variant="h6" sx={{ mb: 1, color: theming.colors.primary }}>
                  {newWorkflow.name}
                </Typography>
                {newWorkflow.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {newWorkflow.description}
                  </Typography>
                )}
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Når du kjører denne arbeidsfluten: </Typography>
                {newWorkflow.actions.map((action, index) => {
                  const ActionIcon = action.icon;
                  return (
                    <Box key={action.id} sx={{ display: 'flex', alignItems: 'center', ml: 2, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ mr: 1 }}>
                        {index + 1}.
                      </Typography>
                      <ActionIcon sx={{ fontSize: 16, mr: 1 }} />
                      <Typography variant="body2">
                        {action.name}
                      </Typography>
                    </Box>
                  );
              })}
              </Paper>
              
              <Box sx={{ display: 'flex', gap: 1}}>
                <Button onClick={() => setCurrentStep(1)}>Tilbake</Button>
                <Button variant="contained" 
                  startIcon={theming.getThemedIcon('save')}
                  onClick={saveCustomWorkflow}
                 sx={theming.getThemedButtonSx()}>
                  Lagre arbeidsflyt
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowWorkflowBuilder(false)} startIcon={theming.getThemedIcon('cancel')}>
          Avbryt
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

// Wrap with universal integration so this orchestrator participates in the
// component registry and feature coverage diagnostics.
export default withUniversalIntegration(FotografOrchestrator, {
  componentId: 'fotograf-orchestrator-root',
  componentName: 'Fotograf Orchestrator',
  componentType: 'orchestrator',
  componentCategory: 'workflow',
  profession:'photographer',
  featureIds: ['fotograf-orchestrator'],
});