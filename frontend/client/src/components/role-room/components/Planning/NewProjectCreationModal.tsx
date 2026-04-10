/**
 * New Project Creation Modal
 * Clean, simplified project creation with The Role Room production setup flow
 */

import React, { useState, useCallback, useMemo, useId, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  IconButton,
  Checkbox,
  useMediaQuery,
  useTheme,
  Grow,
  InputAdornment,
  CircularProgress,
  Autocomplete,
  Tooltip,
  Collapse,
  Chip,
  Avatar,
  Snackbar,
  SvgIcon,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Search as SearchIcon,
  InfoOutlined as InfoIcon,
  CheckCircle as CheckCircleIcon,
  ContentCopy as ContentCopyIcon,
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  CloudQueue as CloudQueueIcon,
  MailOutline as MailOutlineIcon,
  AttachMoney as AttachMoneyIcon,
  MovieFilter as MovieFilterIcon,
  PlayCircleOutline as PlayCircleIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

// Custom SVG icons for consistent visual language
import {
  DashboardCustomIcon as DashboardIcon,
  RolesIcon as TheaterComedyIcon,
  CandidatesIcon as RecentActorsIcon,
  AuditionsIcon as InterpreterModeIcon,
  TeamIcon as GroupsIcon,
  LocationsIcon as LocationIcon,
  EquipmentIcon as PropIcon,
  CalendarCustomIcon as CalendarIcon,
  ShotListIcon,
  StoryArcIcon,
  ShareCustomIcon as ShareIcon,
  OffersIcon as HandshakeIcon,
  ContractsIcon,
  ContractsIcon as ContractIcon,
  ConsentsIcon as ConsentIcon,
  ProjectIcon as CameraIcon,
  ContactIcon,
  SplitSheetIcon,
  FolderProjectIcon,
  EmailIcon,
  EventIcon,
  CompanyIcon,
} from '../icons/CastingIcons';

import { apiRequest } from '@/lib/queryClient';
import settingsService, { getCurrentUserId } from '../../services/settingsService';
import { castingService } from '../../services/castingService';
import { clientInvitesApi } from '../../services/castingApiService';
import type {
  RoleRoomClientInvite,
  RoleRoomClientInviteAccessDuration,
} from '../../models/casting';
import {
  PRODUCER_DEMO_CLIENT_ADDRESS,
  PRODUCER_DEMO_CLIENT_COMPANY,
  PRODUCER_DEMO_CLIENT_EMAIL,
  PRODUCER_DEMO_CLIENT_NAME,
  PRODUCER_DEMO_COLLABORATOR_EMAIL,
  PRODUCER_DEMO_COLLABORATOR_NAME,
  PRODUCER_DEMO_PROJECT_DESCRIPTION,
  PRODUCER_DEMO_PROJECT_NAME,
} from '../../constants/producerDemo';
import { useExternalData } from '@/services/ExternalDataService';
import { useBrandingSettings } from '../../hooks/useBrandingSettings';
import RoleRoomBrandMark from '../shared/RoleRoomBrandMark';

// TROLL area configuration matching CastingPlannerPanel navigation colors/icons
const TROLL_AREA_CONFIG: Record<string, { Icon: any; color: string; label: string }> = {
  project: { Icon: DashboardIcon, color: '#8b5cf6', label: 'Prosjekt' },
  roles: { Icon: TheaterComedyIcon, color: '#f48fb1', label: 'Roller' },
  candidates: { Icon: RecentActorsIcon, color: '#10b981', label: 'Kandidater' },
  crew: { Icon: GroupsIcon, color: '#00d4ff', label: 'Team' },
  locations: { Icon: LocationIcon, color: '#4caf50', label: 'Lokasjoner' },
  equipment: { Icon: PropIcon, color: '#9333ea', label: 'Utstyr' },
  production_days: { Icon: CalendarIcon, color: '#9c27b0', label: 'Prod.dager' },
  scenes: { Icon: ShotListIcon, color: '#e91e63', label: 'Scener' },
  shot_lists: { Icon: ShotListIcon, color: '#e91e63', label: 'Shot Lists' },
  split_sheets: { Icon: ShareIcon, color: '#06b6d4', label: 'Deling' },
  offers: { Icon: HandshakeIcon, color: '#ffb800', label: 'Tilbud' },
  contracts: { Icon: ContractsIcon, color: '#7c3aed', label: 'Kontrakter' },
  consents: { Icon: ConsentIcon, color: '#00bcd4', label: 'Samtykker' },
};

import { ContactProjectInfoSummary } from './ContactProjectInfoSummary';
import { ProjectTypeSelector } from './ProjectTypeSelector';
import ProjectCollaborators from './ProjectCollaborators';
import { ROLE_DISPLAY_NAMES, type SplitSheet, type SplitSheetContributor, type ContributorRole } from '../split-sheets/types';
import { useToast } from '../ToastStack';

interface ProjectData {
  projectId?: string; // Shared ID with split sheet when enabled
  projectName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompanyName?: string;
  clientOrganizationNumber?: string;
  clientCompanyAddress?: string;
  eventDate: string;
  location: string;
  projectType: string;
  guestCount: string;
  description: string;
  collaborators: Array<{
    id: string;
    name: string;
    email: string;
    role: ContributorRole; // Same roles as split sheet contributors
  }>;
  enableSplitSheet: boolean;
  splitSheetData: SplitSheet | null;
}

interface DemoInitArea {
  status?: string;
  count?: number;
  items?: unknown[];
}

interface NewProjectCreationModalProps {
  profession: string;
  userId?: string;
  initialData?: any;
  onProjectCreated?: (projectData: any) => void;
  isCastingPlanner?: boolean;
  isContentProducerSession?: boolean;
  getTerm?: (key: string) => string;
  onClose?: () => void;
  onProjectIdChange?: (projectId: string | null) => void;
  onOpenEconomy?: (projectId?: string) => void;
}

const STEPS = [
  { label: 'Grunndata', description: 'Kontakt, prosjektinfo og type', icon: ContactIcon },
  { label: 'Produksjonsteam', description: 'Team, ansvar og videreføring til økonomi', icon: SplitSheetIcon },
];

// WCAG 2.2 minimum touch target size (44x44px)
const TOUCH_TARGET_SIZE = 44;

// Shared focus styles for WCAG 2.4.7 Focus Visible
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #00d4ff',
    outlineOffset: '2px',
  },
};

const CLIENT_INVITE_TEMPLATE_TOKENS = [
  '{{recipientName}}',
  '{{projectName}}',
  '{{magicLink}}',
  '{{companyName}}',
  '{{accessDurationLabel}}',
  '{{accessEndsAt}}',
  '{{accessNote}}',
  '{{inviteExpiresNote}}',
] as const;

export default function NewProjectCreationModal({
  profession,
  userId,
  initialData,
  onProjectCreated,
  isCastingPlanner = false,
  isContentProducerSession = false,
  getTerm,
  onClose,
  onProjectIdChange,
  onOpenEconomy,
}: NewProjectCreationModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dialogTitleId = useId();
  const dialogDescId = useId();
  const { getBRREGCompanyData, searchBRREGCompanies } = useExternalData();
  const brandingSettings = useBrandingSettings();
  const toast = useToast();
  // Use React reference 
  const isReactReady = typeof React !== 'undefined' && !!React.version;
  void isReactReady;

  // MenuProps for Select components to ensure proper rendering within Dialog
  const selectMenuProps = {
    container: document.body,
    sx: {
      zIndex: 100010,
    },
    PaperProps: {
      sx: {
        bgcolor: '#1c2128',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        mt: 0.5,
        maxHeight: 300,
        '& .MuiMenuItem-root': {
          fontSize: '1rem',
          minHeight: TOUCH_TARGET_SIZE,
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.1)',
          },
          '&.Mui-selected': {
            bgcolor: 'rgba(0,212,255,0.2)',
            '&:hover': {
              bgcolor: 'rgba(0,212,255,0.3)',
            },
          },
        },
      },
    },
  };
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [projectIdTimestamp, setProjectIdTimestamp] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftKeyRef = useRef<string | null>(null);
  const autoLoadedDraftKeyRef = useRef<string | null>(null);
  const [availableDrafts, setAvailableDrafts] = useState<Array<{ key: string; data: any; savedAt: number }>>([]);
  const [availableProjects, setAvailableProjects] = useState<Array<{ id: string; name: string; updatedAt: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedDraftKey, setSelectedDraftKey] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // TROLL Demo State
  const [loadingTrollDemo, setLoadingTrollDemo] = useState(false);
  const [trollInitDialogOpen, setTrollInitDialogOpen] = useState(false);
  const [trollInitStatus, setTrollInitStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
  const [trollInitError, setTrollInitError] = useState<string | null>(null);
  const [trollInitAreas, setTrollInitAreas] = useState<Record<string, DemoInitArea>>({});

  const demoProjectTitle = isContentProducerSession ? 'Bedriftsdemo for innholdsproduksjon' : 'TROLL Demo-prosjekt';
  const demoProjectDescription = isContentProducerSession
    ? 'Last et fiktivt bedriftsprosjekt med klient, manus, storyboard og godkjenningsflyt'
    : 'Prøv demo-prosjektet for å se hvordan alt fungerer';
  
  // Generate project ID based on project name
  const generateProjectIdFromName = useCallback((projectName: string, timestamp?: number): string => {
    if (!projectName || projectName.trim() === '') {
      // Fallback to timestamp-based ID if no name provided
      const fallbackTimestamp = timestamp || Date.now();
      return `project-${fallbackTimestamp}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Convert to lowercase, replace spaces and special characters with hyphens
    let id = projectName
      .toLowerCase()
      .trim()
      // Replace Norwegian characters
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'o')
      .replace(/å/g, 'aa')
      // Replace spaces and special characters with hyphens
      .replace(/[^a-z0-9]+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Limit length to 50 characters
      .substring(0, 50);
    
    // Ensure ID is not empty
    if (!id) {
      const fallbackTimestamp = timestamp || Date.now();
      id = `project-${fallbackTimestamp}`;
    }
    
    // Use provided timestamp or current timestamp to ensure uniqueness
    const finalTimestamp = timestamp || projectIdTimestamp || Date.now();
    return `${id}-${finalTimestamp}`;
  }, [projectIdTimestamp]);
  
  // Generate a temporary project ID when modal opens (if not editing existing project)
  const generateTemporaryProjectId = useCallback(() => {
    return `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Map CastingProject fields to ProjectData fields
  // CastingProject uses 'name' while ProjectData uses 'projectName'
  const mapInitialData = useCallback(() => {
    // Generate temporary ID if creating new project (no initialData or no ID in initialData)
    const tempProjectId = !initialData || !initialData.id ? generateTemporaryProjectId() : initialData.id;
    
    if (!initialData) return {
      projectId: tempProjectId, // Set temporary ID immediately
      projectName: '',
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      clientCompanyName: '',
      clientOrganizationNumber: '',
      clientCompanyAddress: '',
      eventDate: '',
      location: '',
      projectType: '',
      guestCount: '',
      description: '',
      collaborators: [],
      enableSplitSheet: false,
      splitSheetData: null,
    };
    
    // Map collaborators from crew if available (for CastingProject)
    let collaborators = initialData.collaborators || [];
    if ((!collaborators || collaborators.length === 0) && initialData.crew && initialData.crew.length > 0) {
      collaborators = initialData.crew
        .filter((member: any) => !member.contactInfo?.orgNumber)
        .map((member: any) => ({
          id: member.id,
          name: member.name,
          email: member.contactInfo?.email || '',
          role: member.role || 'collaborator',
        }));
    }
    
    // If split sheet exists and has ID, use that ID; otherwise use tempProjectId
    const projectId = initialData.splitSheetData?.id || tempProjectId;
    
    return {
      projectId: projectId, // Use existing ID or temporary ID
      projectName: initialData.projectName || initialData.name || '',
      clientName: initialData.clientName || '',
      clientEmail: initialData.clientEmail || '',
      clientPhone: initialData.clientPhone || '',
      clientCompanyName: initialData.clientCompanyName || '',
      clientOrganizationNumber: initialData.clientOrganizationNumber || '',
      clientCompanyAddress: initialData.clientCompanyAddress || '',
      eventDate: initialData.eventDate || '',
      location: initialData.location || '',
      projectType: initialData.projectType || '',
      guestCount: initialData.guestCount || '',
      description: initialData.description || '',
      collaborators: collaborators,
      enableSplitSheet: initialData.enableSplitSheet || false,
      splitSheetData: initialData.splitSheetData ? {
        ...initialData.splitSheetData,
        id: projectId, // Ensure split sheet uses same ID as project
        project_id: projectId,
      } : null,
    };
  }, [generateTemporaryProjectId, initialData]);
  
  const [projectData, setProjectData] = useState<ProjectData>(mapInitialData);

  // Draft storage key - based on projectId or userId
  useEffect(() => {
    const key = projectData.projectId 
      ? `casting-project-draft-${projectData.projectId}`
      : userId 
        ? `casting-project-draft-${userId}-${profession}`
        : `casting-project-draft-${profession}`;
    draftKeyRef.current = key;
    setDraftKey(key);
  }, [projectData.projectId, userId, profession]);

  // Load all available drafts from DB
  const loadAvailableDrafts = useCallback(async () => {
    try {
      const drafts: Array<{ key: string; data: any; savedAt: number }> = [];
      const resolvedUserId = userId || getCurrentUserId();

      const remoteEntries = await settingsService.listSettings('casting-project-draft', { userId: resolvedUserId });
      remoteEntries.forEach((entry) => {
        const draftData = entry.data as { savedAt?: number; data?: unknown };
        if (draftData?.savedAt) {
          const draftAge = Date.now() - draftData.savedAt;
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          if (draftAge < sevenDays) {
            drafts.push({
              key: entry.projectId || entry.namespace,
              data: draftData.data,
              savedAt: draftData.savedAt,
            });
          }
        }
      });

      drafts.sort((a, b) => b.savedAt - a.savedAt);
      setAvailableDrafts(drafts);
    } catch (error) {
      console.error('Error loading drafts:', error);
    }
  }, [userId]);

  // Load available projects from API
  const loadAvailableProjects = useCallback(async () => {
    if (!isCastingPlanner) return;
    
    setLoadingProjects(true);
    try {
      const response = await apiRequest('/api/casting/projects', {
        method: 'GET',
      }) as { data?: any[] } | any[];
      
      const projects = Array.isArray(response) ? response : (response?.data || []);
      setAvailableProjects(
        projects
          .map((p: any) => ({
            id: p.id,
            name: p.name || p.projectName || 'Unnamed Project',
            updatedAt: p.updatedAt || p.createdAt || new Date().toISOString(),
          }))
          .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
    } catch (error) {
      console.error('Error loading projects:', error);
      setAvailableProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [isCastingPlanner]);

  // Load drafts and projects on mount
  useEffect(() => {
    void loadAvailableDrafts();
    loadAvailableProjects();
  }, [loadAvailableDrafts, loadAvailableProjects]);

  // Load draft data when modal opens (if no initialData)
  // This runs after draftKey is set
  useEffect(() => {
    if (!initialData && draftKey && !selectedDraftKey && !selectedProjectId) {
      if (autoLoadedDraftKeyRef.current === draftKey) {
        return;
      }
      const loadDraft = async () => {
        try {
          const resolvedUserId = userId || getCurrentUserId();
          const draftData = await settingsService.getSetting<any>('casting-project-draft', { userId: resolvedUserId, projectId: draftKey });
          autoLoadedDraftKeyRef.current = draftKey;
          if (draftData) {
            const draftAge = Date.now() - (draftData.savedAt || 0);
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            
            if (draftAge < sevenDays) {
              setProjectData((prev) => ({
                ...prev,
                ...draftData.data,
                projectId: prev.projectId || draftData.data.projectId,
                splitSheetData: draftData.data.splitSheetData ? JSON.parse(JSON.stringify(draftData.data.splitSheetData)) : null,
              }));
              setActiveStep(draftData.activeStep || 0);
              setLastSavedAt(new Date(draftData.savedAt));
              setDraftStatus('saved');
              toast.showInfo('Utkast lastet inn automatisk');
            } else {
              await settingsService.deleteSetting('casting-project-draft', { userId: resolvedUserId, projectId: draftKey });
            }
          }
        } catch (error) {
          autoLoadedDraftKeyRef.current = null;
          console.error('Error loading draft:', error);
        }
      };
      void loadDraft();
    }
  }, [draftKey, initialData, selectedDraftKey, selectedProjectId, toast, userId]); // Run when draftKey is set or initialData changes

  // Handle draft selection
  const handleDraftSelect = useCallback(async (draftKey: string) => {
    try {
      const resolvedUserId = userId || getCurrentUserId();
      const draftData = await settingsService.getSetting<any>('casting-project-draft', { userId: resolvedUserId, projectId: draftKey });
      if (draftData) {
        setProjectData((prev) => ({
          ...prev,
          ...draftData.data,
          projectId: draftData.data.projectId || prev.projectId,
          // Ensure split sheet data is fully loaded
          splitSheetData: draftData.data.splitSheetData ? JSON.parse(JSON.stringify(draftData.data.splitSheetData)) : null,
        }));
        setActiveStep(draftData.activeStep || 0);
        setLastSavedAt(new Date(draftData.savedAt));
        setDraftStatus('saved');
        setSelectedDraftKey(draftKey);
        setSelectedProjectId(null);
        toast.showSuccess('Utkast lastet');
      }
    } catch (error) {
      console.error('Error loading selected draft:', error);
      toast.showError('Kunne ikke laste utkast');
    }
  }, [toast, userId]);

  // Handle project selection
  const handleProjectSelect = useCallback(async (projectId: string) => {
    setLoadingProjects(true);
    try {
      const response = await apiRequest(`/api/casting/projects/${projectId}`, {
        method: 'GET',
      }) as { data?: any } | any;
      
      const project = (response && typeof response === 'object' && 'data' in response) ? response.data : response;
      if (project) {
        // Map project data to ProjectData format
        const mappedData = {
          projectId: project.id,
          projectName: project.name || project.projectName || '',
          clientName: project.clientName || '',
          clientEmail: project.clientEmail || '',
          clientPhone: project.clientPhone || '',
          clientCompanyName: project.clientCompanyName || '',
          clientOrganizationNumber: project.clientOrganizationNumber || '',
          clientCompanyAddress: project.clientCompanyAddress || '',
          eventDate: project.eventDate || '',
          location: project.location || '',
          projectType: project.projectType || '',
          guestCount: project.guestCount || '',
          description: project.description || '',
          collaborators: project.collaborators || project.crew?.map((m: any) => ({
            id: m.id,
            name: m.name,
            email: m.contactInfo?.email || '',
            role: m.role || 'collaborator',
          })) || [],
          enableSplitSheet: project.enableSplitSheet || false,
          splitSheetData: project.splitSheetData || null,
        };
        
        setProjectData(mappedData);
        setSelectedProjectId(projectId);
        setSelectedDraftKey(null);
        setActiveStep(0);
        toast.showSuccess('Prosjekt lastet');
      }
    } catch (error) {
      console.error('Error loading project:', error);
      toast.showError('Kunne ikke laste prosjekt');
    } finally {
      setLoadingProjects(false);
    }
  }, [toast]);

  // Save draft to DB
  const saveDraft = useCallback(async (data: ProjectData, step: number, isManual = false) => {
    if (!draftKeyRef.current) return;

    try {
      setDraftStatus('saving');
      
      // Deep clone split sheet data to ensure all nested data is saved
      const splitSheetDataClone = data.splitSheetData ? JSON.parse(JSON.stringify(data.splitSheetData)) : null;
      
      const draftPayload = {
        data: {
          projectName: data.projectName,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          clientPhone: data.clientPhone,
          clientCompanyName: data.clientCompanyName || '',
          clientOrganizationNumber: data.clientOrganizationNumber || '',
          clientCompanyAddress: data.clientCompanyAddress || '',
          eventDate: data.eventDate,
          location: data.location,
          projectType: data.projectType,
          guestCount: data.guestCount,
          description: data.description,
          collaborators: data.collaborators,
          enableSplitSheet: data.enableSplitSheet,
          splitSheetData: splitSheetDataClone, // Include full split sheet data
          projectId: data.projectId, // Include projectId to maintain consistency
        },
        activeStep: step,
        savedAt: Date.now(),
        profession,
        userId,
      };

      const resolvedUserId = userId || getCurrentUserId();
      await settingsService.setSetting('casting-project-draft', draftPayload, {
        userId: resolvedUserId,
        projectId: draftKeyRef.current,
      });
      setLastSavedAt(new Date());
      setDraftStatus('saved');
      
      // Reload available drafts
      void loadAvailableDrafts();
      
      if (isManual) {
        toast.showSuccess('Utkast lagret');
      }
      
      // Clear saved status after 3 seconds
      setTimeout(() => {
        setDraftStatus((prev) => prev === 'saved' ? 'idle' : prev);
      }, 3000);
    } catch (error) {
      console.error('Error saving draft:', error);
      setDraftStatus('error');
      if (isManual) {
        toast.showError('Kunne ikke lagre utkast');
      }
    }
  }, [profession, userId, toast, loadAvailableDrafts]);

  // Autosave with debounce (2 seconds)
  useEffect(() => {
    // Don't autosave if editing existing project
    if (initialData?.id) return;
    
    // Don't autosave if project is empty
    if (!projectData.projectName && !projectData.clientName && projectData.collaborators.length === 0) {
      return;
    }

    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    // Set new timeout for autosave
    autosaveTimeoutRef.current = setTimeout(() => {
      saveDraft(projectData, activeStep, false);
    }, 2000); // 2 second debounce

    // Cleanup
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [projectData, activeStep, initialData, saveDraft]);

  // Clear draft when project is successfully created
  const clearDraft = useCallback(() => {
    if (draftKeyRef.current) {
      void settingsService.deleteSetting('casting-project-draft', {
        userId: userId || getCurrentUserId(),
        projectId: draftKeyRef.current,
      });
      setDraftStatus('idle');
      setLastSavedAt(null);
    }
  }, []);

  const [showProjectResponsibleInfo, setShowProjectResponsibleInfo] = useState(false);
  const [addCollaboratorDialogOpen, setAddCollaboratorDialogOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<{ id: string; name: string; email: string; role: ContributorRole; availabilityStart?: string; availabilityEnd?: string } | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [clientInviteDialogOpen, setClientInviteDialogOpen] = useState(false);
  const [showClientInviteAfterSave, setShowClientInviteAfterSave] = useState(true);
  const [savedProjectIdForInvite, setSavedProjectIdForInvite] = useState<string | null>(null);
  const [clientInviteRecipientEmail, setClientInviteRecipientEmail] = useState('');
  const [clientInviteRecipientName, setClientInviteRecipientName] = useState('');
  const [clientInviteSubjectDraft, setClientInviteSubjectDraft] = useState('');
  const [clientInviteBodyDraft, setClientInviteBodyDraft] = useState('');
  const [clientInviteAccessDuration, setClientInviteAccessDuration] = useState<RoleRoomClientInviteAccessDuration>('forever');
  const [generatedClientInvite, setGeneratedClientInvite] = useState<RoleRoomClientInvite | null>(null);
  const [generatedClientInviteSignature, setGeneratedClientInviteSignature] = useState<string | null>(null);
  const [clientInviteLoading, setClientInviteLoading] = useState(false);
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState('');
  const [newCollaboratorName, setNewCollaboratorName] = useState('');
  const [newCollaboratorOrgNumber, setNewCollaboratorOrgNumber] = useState('');
  const [brregLoading, setBrregLoading] = useState(false);
  const [brregError, setBrregError] = useState<string | null>(null);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [companySearchOptions, setCompanySearchOptions] = useState<Array<{
    organizationNumber: string;
    name: string;
    organizationForm: string;
  }>>([]);
  const [companySearchLoading, setCompanySearchLoading] = useState(false);
  const [clientBrregLoading, setClientBrregLoading] = useState(false);
  const [clientBrregError, setClientBrregError] = useState<string | null>(null);
  const [clientCompanySearchQuery, setClientCompanySearchQuery] = useState('');
  const [clientCompanySearchOptions, setClientCompanySearchOptions] = useState<Array<{
    organizationNumber: string;
    name: string;
    organizationForm: string;
  }>>([]);
  const [clientCompanySearchLoading, setClientCompanySearchLoading] = useState(false);

  const loadedDemoAreaBadges = useMemo(() => {
    const badges: Array<{
      key: string;
      label: string;
      color: string;
      count: number;
      Icon: typeof DashboardIcon;
    }> = [];
    let economyCount = 0;

    for (const [key, area] of Object.entries(trollInitAreas)) {
      const count = typeof area.count === 'number' ? area.count : 0;
      if (area.status !== 'loaded' || count <= 0) {
        continue;
      }

      if (key === 'offers' || key === 'contracts') {
        economyCount += count;
        continue;
      }

      const config = TROLL_AREA_CONFIG[key];
      if (!config) {
        continue;
      }

      badges.push({
        key,
        label: config.label,
        color: config.color,
        count,
        Icon: config.Icon,
      });
    }

    if (economyCount > 0) {
      badges.push({
        key: 'economy',
        label: 'Økonomi',
        color: '#34d399',
        count: economyCount,
        Icon: AttachMoneyIcon as typeof DashboardIcon,
      });
    }

    return badges;
  }, [trollInitAreas]);
  // Get available roles based on profession (same as split sheet)
  const getAvailableRoles = (prof: string): ContributorRole[] => {
    switch(prof) {
      case 'music_producer':
        return ['producer', 'artist', 'songwriter', 'composer', 'vocalist', 'mix_engineer', 'collaborator', 'other'];
      case 'photographer':
        return ['second_shooter', 'photo_editor', 'retoucher', 'assistant', 'stylist', 'makeup_artist', 'collaborator', 'other'];
      case 'videographer':
        return [
          'director', 
          'producer', 
          'cinematographer', 
          'camera_operator', 
          'drone_pilot',
          'video_editor', 
          'colorist', 
          'sound_engineer', 
          'audio_mixer',
          'grip', 
          'gaffer', 
          'production_assistant',
          'script_supervisor',
          'location_manager',
          'production_designer',
          'vfx_artist',
          'motion_graphics',
          'collaborator', 
          'other'
        ];
      default:
        return ['collaborator', 'other'];
    }
  };

  const availableCollaboratorRoles = useMemo(() => getAvailableRoles(profession), [profession]);
  const [newCollaboratorRole, setNewCollaboratorRole] = useState<ContributorRole>('collaborator');
  const [newCollaboratorAvailabilityStart, setNewCollaboratorAvailabilityStart] = useState('');
  const [newCollaboratorAvailabilityEnd, setNewCollaboratorAvailabilityEnd] = useState('');
  const [collaboratorEmailError, setCollaboratorEmailError] = useState(false);
  const [clientNameError, setClientNameError] = useState(false);
  const [clientEmailError, setClientEmailError] = useState(false);
  const [clientPhoneError, setClientPhoneError] = useState(false);

  // Reset form data when initialData changes (switching between create/edit mode)
  useEffect(() => {
    const mappedData = mapInitialData();
    setProjectData(mappedData);
    setActiveStep(0);
    setSelectedDraftKey(null);
    setSelectedProjectId(null);
    setClientInviteDialogOpen(false);
    setSavedProjectIdForInvite(null);
    setSuccessMessage(null);
    setDraftStatus('idle');
    setLastSavedAt(null);
    setClientNameError(false);
    setClientEmailError(false);
    setClientPhoneError(false);
    setClientBrregError(null);
    setBrregError(null);
    autoLoadedDraftKeyRef.current = null;
    
    // Set timestamp for new projects (to ensure consistent ID generation)
    if (!initialData || !initialData.id) {
      setProjectIdTimestamp(Date.now());
    } else {
      setProjectIdTimestamp(null); // Don't use timestamp for existing projects
    }
    
    // Notify parent of project ID if callback provided
    if (mappedData.projectId && onProjectIdChange) {
      onProjectIdChange(mappedData.projectId);
    }
  }, [initialData, mapInitialData, onProjectIdChange]);
  
  // Update project ID when project name changes (only for new projects, not when editing)
  useEffect(() => {
    // Only update ID if we're creating a new project (no initialData or no ID in initialData)
    // and if project name is not empty
    if ((!initialData || !initialData.id) && projectData.projectName && projectData.projectName.trim() !== '') {
      const newId = generateProjectIdFromName(projectData.projectName, projectIdTimestamp || undefined);
      setProjectData((prev) => ({ ...prev, projectId: newId }));
    }
  }, [generateProjectIdFromName, initialData, projectData.projectName, projectIdTimestamp]);
  
  // Notify parent when project ID changes
  useEffect(() => {
    if (projectData.projectId && onProjectIdChange) {
      onProjectIdChange(projectData.projectId);
    }
  }, [onProjectIdChange, projectData.projectId]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const normalizeInviteEmail = (email: string): string => email.trim().toLowerCase();

  const validatePhone = (phone: string): boolean => {
    // Accept Norwegian phone numbers (8 digits) or international formats
    const cleaned = phone.replace(/[\s\-+()]/g, '');
    return /^\d{8,15}$/.test(cleaned);
  };

  const validateOrgNumber = (orgNumber: string): boolean => {
    // Remove spaces and dashes, check if 9 digits
    const cleaned = orgNumber.replace(/[\s-]/g, '');
    return /^\d{9}$/.test(cleaned);
  };

  const formatOrgNumber = (orgNumber: string): string => {
    // Remove all non-digits
    const cleaned = orgNumber.replace(/\D/g, '');
    // Format as XXX XXX XXX
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  };

  const hasRequiredProjectBasics = useMemo(() => {
    const hasName = Boolean(projectData.projectName?.trim());
    if (!hasName) return false;
    if (!isCastingPlanner) return true;
    return (
      Boolean(projectData.clientName?.trim()) &&
      validateEmail(projectData.clientEmail || '') &&
      validatePhone(projectData.clientPhone || '')
    );
  }, [isCastingPlanner, projectData.clientEmail, projectData.clientName, projectData.clientPhone, projectData.projectName]);

  const inviteProjectId = savedProjectIdForInvite || projectData.projectId || initialData?.id || '';
  const clientInviteEmailIsValid = useMemo(
    () => validateEmail(clientInviteRecipientEmail || ''),
    [clientInviteRecipientEmail],
  );
  const clientInviteUrl = useMemo(
    () => generatedClientInvite?.inviteUrl || '',
    [generatedClientInvite?.inviteUrl],
  );
  const resolveClientInviteAccessEndLabel = useCallback(() => (
    projectData.eventDate?.trim() || generatedClientInvite?.accessEndsAt || ''
  ), [
    generatedClientInvite?.accessEndsAt,
    projectData.eventDate,
  ]);
  const canPrepareClientInvite = useMemo(() => (
    isCastingPlanner &&
    Boolean(inviteProjectId) &&
    clientInviteEmailIsValid &&
    (
      clientInviteAccessDuration !== 'project_end'
      || Boolean(resolveClientInviteAccessEndLabel())
    )
  ), [
    clientInviteAccessDuration,
    clientInviteEmailIsValid,
    inviteProjectId,
    isCastingPlanner,
    resolveClientInviteAccessEndLabel,
  ]);

  const buildDefaultClientInviteSubject = useCallback(() => (
    'Invitasjon til {{projectName}} i The Role Room'
  ), []);

  const buildDefaultClientInviteBody = useCallback(() => {
    const companyName = brandingSettings.companyName?.trim() || 'The Role Room';

    return [
      'Hei {{recipientName}},',
      '',
      'Du er invitert inn i The Role Room for prosjektet "{{projectName}}".',
      'Klikk på magic-linken under for å åpne klientportalen direkte.',
      '',
      'Magic-link: {{magicLink}}',
      '',
      'Tilgang: {{accessDurationLabel}}',
      '{{accessNote}}',
      '{{inviteExpiresNote}}',
      '',
      'Hilsen',
      companyName,
    ].join('\n');
  }, [brandingSettings.companyName]);

  const renderClientInviteTemplate = useCallback((template: string, inviteUrlOverride?: string | null) => {
    const inviteUrl = inviteUrlOverride || clientInviteUrl || '[magic-link genereres når invitasjonen opprettes]';
    const accessEndLabel = resolveClientInviteAccessEndLabel();
    const accessDurationLabel = clientInviteAccessDuration === 'project_end'
      ? 'Til prosjektets slutt'
      : 'For alltid';
    const accessNote = clientInviteAccessDuration === 'project_end'
      ? (accessEndLabel
        ? `Tilgangen varer til prosjektet avsluttes ${accessEndLabel}.`
        : 'Tilgangen varer til prosjektet avsluttes når prosjektdato er satt.')
      : 'Tilgangen forblir aktiv til den blir endret eller fjernet av teamet.';
    const inviteExpiresNote = generatedClientInvite?.expiresAt
      ? `Magic-linken kan brukes frem til ${generatedClientInvite.expiresAt.slice(0, 10)}.`
      : 'Magic-linken opprettes når du kopierer eller sender invitasjonen.';

    return template.replace(/\{\{([^}]+)\}\}/g, (_match, rawKey) => {
      const key = String(rawKey).trim();
      switch (key) {
        case 'recipientName':
          return clientInviteRecipientName?.trim() || projectData.clientName?.trim() || 'der';
        case 'projectName':
          return projectData.projectName?.trim() || 'prosjektet';
        case 'magicLink':
          return inviteUrl;
        case 'companyName':
          return brandingSettings.companyName?.trim() || 'The Role Room';
        case 'accessDurationLabel':
          return accessDurationLabel;
        case 'accessEndsAt':
          return accessEndLabel;
        case 'accessNote':
          return accessNote;
        case 'inviteExpiresNote':
          return inviteExpiresNote;
        default:
          return '';
      }
    });
  }, [
    brandingSettings.companyName,
    clientInviteAccessDuration,
    clientInviteRecipientName,
    clientInviteUrl,
    generatedClientInvite?.expiresAt,
    projectData.clientName,
    projectData.projectName,
    resolveClientInviteAccessEndLabel,
  ]);

  const clientInviteDraftSignature = useMemo(() => JSON.stringify({
    email: normalizeInviteEmail(clientInviteRecipientEmail),
    recipientName: clientInviteRecipientName.trim(),
    subject: clientInviteSubjectDraft.trim(),
    body: clientInviteBodyDraft.trim(),
    accessDuration: clientInviteAccessDuration,
  }), [
    clientInviteAccessDuration,
    clientInviteBodyDraft,
    clientInviteRecipientEmail,
    clientInviteRecipientName,
    clientInviteSubjectDraft,
  ]);

  const clientInviteSubject = useMemo(
    () => renderClientInviteTemplate(
      clientInviteSubjectDraft || buildDefaultClientInviteSubject(),
    ),
    [buildDefaultClientInviteSubject, clientInviteSubjectDraft, renderClientInviteTemplate],
  );

  const clientInviteBody = useMemo(
    () => renderClientInviteTemplate(
      clientInviteBodyDraft || buildDefaultClientInviteBody(),
    ),
    [buildDefaultClientInviteBody, clientInviteBodyDraft, renderClientInviteTemplate],
  );

  const createClientMagicInvite = useCallback(async (
    rawEmail?: string,
    options?: {
      silent?: boolean;
      force?: boolean;
      sendEmail?: boolean;
    },
  ): Promise<RoleRoomClientInvite | null> => {
    const targetEmail = normalizeInviteEmail(rawEmail ?? clientInviteRecipientEmail);

    if (!inviteProjectId) {
      if (!options?.silent) {
        toast.showError('Prosjekt-ID mangler. Lagre prosjektet før du sender klientinvitasjonen.');
      }
      return null;
    }

    if (!validateEmail(targetEmail)) {
      if (!options?.silent) {
        toast.showWarning('Legg inn en gyldig klient-e-post før du sender invitasjonen.');
      }
      return null;
    }

    if (
      clientInviteAccessDuration === 'project_end'
      && !resolveClientInviteAccessEndLabel()
    ) {
      if (!options?.silent) {
        toast.showWarning('Prosjektet mangler sluttdato. Sett prosjektdato før du gir klienten tilgang til prosjektets slutt.');
      }
      return null;
    }

    if (!options?.force && generatedClientInvite && generatedClientInviteSignature === clientInviteDraftSignature) {
      return generatedClientInvite;
    }

    setClientInviteLoading(true);
    try {
      const response = await clientInvitesApi.create(inviteProjectId, {
        email: targetEmail,
        recipientName: clientInviteRecipientName?.trim() || projectData.clientName?.trim() || undefined,
        emailSubject: clientInviteSubjectDraft.trim() || buildDefaultClientInviteSubject(),
        emailBody: clientInviteBodyDraft.trim() || buildDefaultClientInviteBody(),
        browserOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
        workspace: 'brief',
        tab: 'media',
        accessDuration: clientInviteAccessDuration,
        sendEmail: options?.sendEmail === true,
      });
      setGeneratedClientInvite(response.invite);
      setGeneratedClientInviteSignature(clientInviteDraftSignature);
      if (options?.sendEmail) {
        if (response.invite.delivery?.sent) {
          toast.showSuccess('Klientinvitasjonen er sendt fra The Role Room.');
        } else {
          const deliveryReason = response.invite.delivery?.reason;
          toast.showWarning(
            deliveryReason === 'missing_email_config'
              ? 'Invitasjonen ble opprettet, men systemet mangler e-postoppsett. Du kan fortsatt kopiere magic-linken.'
              : 'Invitasjonen ble opprettet, men e-posten ble ikke sendt automatisk. Du kan fortsatt kopiere magic-linken.',
          );
        }
      }
      return response.invite;
    } catch (error) {
      console.error('Failed to create client magic invite:', error);
      if (!options?.silent) {
        toast.showError(error instanceof Error ? error.message : 'Kunne ikke opprette klientinvitasjonen.');
      }
      return null;
    } finally {
      setClientInviteLoading(false);
    }
  }, [
    clientInviteRecipientEmail,
    clientInviteRecipientName,
    clientInviteAccessDuration,
    clientInviteBodyDraft,
    clientInviteDraftSignature,
    clientInviteSubjectDraft,
    buildDefaultClientInviteBody,
    buildDefaultClientInviteSubject,
    generatedClientInvite,
    generatedClientInviteSignature,
    inviteProjectId,
    projectData.clientName,
    resolveClientInviteAccessEndLabel,
    toast,
  ]);

  useEffect(() => {
    if (!clientInviteDialogOpen) {
      return;
    }

    const defaultEmail = projectData.clientEmail || '';
    const defaultName = projectData.clientName || '';
    setClientInviteRecipientEmail(defaultEmail);
    setClientInviteRecipientName(defaultName);
    setClientInviteSubjectDraft(buildDefaultClientInviteSubject());
    setClientInviteBodyDraft(buildDefaultClientInviteBody());
    setClientInviteAccessDuration('forever');
    setGeneratedClientInvite(null);
    setGeneratedClientInviteSignature(null);
  }, [
    buildDefaultClientInviteBody,
    buildDefaultClientInviteSubject,
    clientInviteDialogOpen,
    projectData.clientEmail,
    projectData.clientName,
  ]);

  useEffect(() => {
    if (!generatedClientInvite || !generatedClientInviteSignature) {
      return;
    }

    if (generatedClientInviteSignature !== clientInviteDraftSignature) {
      setGeneratedClientInvite(null);
      setGeneratedClientInviteSignature(null);
    }
  }, [
    clientInviteDraftSignature,
    generatedClientInvite,
    generatedClientInviteSignature,
  ]);

  const resetToFreshProjectDraft = () => {
    const freshData = mapInitialData();
    setProjectData(freshData);
    setActiveStep(0);
    setClientNameError(false);
    setClientEmailError(false);
    setClientPhoneError(false);
    setSelectedDraftKey(null);
    setSelectedProjectId(null);
    setSuccessMessage(null);
    if (freshData.projectId && onProjectIdChange) {
      onProjectIdChange(freshData.projectId);
    }
    toast.showInfo('Startet med nytt prosjektutkast.');
  };

  const lookupCollaboratorOrgNumber = useCallback(async (rawOrgNumber?: string) => {
    const cleaned = (rawOrgNumber ?? newCollaboratorOrgNumber ?? '').replace(/[\s-]/g, '');

    if (!validateOrgNumber(cleaned)) {
      setBrregError('Organisasjonsnummer må være 9 siffer');
      return;
    }

    setBrregLoading(true);
    setBrregError(null);

    try {
      const companyData = await getBRREGCompanyData(cleaned);
      
      if (companyData && companyData.name) {
        console.log('BRREG org number lookup result:', { 
          name: companyData.name, 
          orgNumber: cleaned 
        });
        setNewCollaboratorName(companyData.name);
        // Optional: You could also set email if available from BRREG
        // Note: BRREG data typically doesn't include email, but website might be available
        if (companyData.website && !newCollaboratorEmail) {
          // Could extract contact email from website if needed
        }
        setBrregError(null);
      } else {
        setBrregError('Kunne ikke hente bedriftsinformasjon');
      }
    } catch (error: unknown) {
      console.error('Error fetching BRREG data:', error);
      setBrregError('Kunne ikke hente bedriftsinformasjon fra Brønnøysundregistrene');
    } finally {
      setBrregLoading(false);
    }
  }, [getBRREGCompanyData, newCollaboratorEmail, newCollaboratorOrgNumber]);

  const handleOrgNumberSearch = useCallback(async () => {
    await lookupCollaboratorOrgNumber(newCollaboratorOrgNumber || '');
  }, [lookupCollaboratorOrgNumber, newCollaboratorOrgNumber]);

  const handleOrgNumberChange = useCallback((value: string) => {
    // Only allow digits, spaces, and dashes, max 11 characters (XXX XXX XXX format)
    const cleaned = value.replace(/[^\d\s-]/g, '');
    if (cleaned.replace(/[\s-]/g, '').length <= 9) {
      const formatted = formatOrgNumber(cleaned);
      setNewCollaboratorOrgNumber(formatted);
      setBrregError(null);
      
      // Auto-search when 9 digits are entered
      if (cleaned.replace(/[\s-]/g, '').length === 9) {
        void lookupCollaboratorOrgNumber(formatted);
      }
    }
  }, [lookupCollaboratorOrgNumber]);

  // Handle company name search with debounce
  useEffect(() => {
    const controller = new AbortController();
    
    const searchCompanies = async () => {
      if (!companySearchQuery || companySearchQuery.trim().length < 3) {
        setCompanySearchOptions([]);
        return;
      }

      setCompanySearchLoading(true);
      try {
        const results = await searchBRREGCompanies({ 
          name: companySearchQuery.trim(),
          limit: 10 
        });
        
        if (!controller.signal.aborted && results.companies) {
          setCompanySearchOptions(results.companies.map(company => ({
            organizationNumber: company.organizationNumber,
            name: company.name,
            organizationForm: company.organizationForm,
          })));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Error searching companies:', error);
          setCompanySearchOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setCompanySearchLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(searchCompanies, 300); // Debounce 300ms
    
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [companySearchQuery, searchBRREGCompanies]);

  const handleCompanySelect = (company: { organizationNumber: string; name: string } | null) => {
    if (company) {
      console.log('Company selected from BRREG:', { 
        name: company.name, 
        orgNumber: company.organizationNumber 
      });
      setNewCollaboratorOrgNumber(formatOrgNumber(company.organizationNumber));
      setNewCollaboratorName(company.name);
      setCompanySearchQuery('');
      setCompanySearchOptions([]);
      setBrregError(null);
    }
  };

  const applyClientCompanyFromBrreg = useCallback((companyData: {
    name?: string;
    organizationNumber?: string;
    businessAddress?: {
      adresse?: string;
      postnummer?: string;
      poststed?: string;
    };
  }) => {
    if (!companyData?.name) {
      return;
    }
    const businessAddress = companyData.businessAddress;
    const addressParts = [
      businessAddress?.adresse || '',
      businessAddress?.postnummer || '',
      businessAddress?.poststed || '',
    ].filter((part) => Boolean(part && part.trim()));
    const fullAddress = addressParts.join(', ');
    setProjectData((prev) => ({
      ...prev,
      clientCompanyName: companyData.name || prev.clientCompanyName || '',
      clientOrganizationNumber: companyData.organizationNumber || prev.clientOrganizationNumber || '',
      clientCompanyAddress: fullAddress || prev.clientCompanyAddress || '',
    }));
    setClientBrregError(null);
  }, []);

  const lookupClientOrgNumber = useCallback(async (rawOrgNumber?: string) => {
    const cleaned = (rawOrgNumber ?? projectData.clientOrganizationNumber ?? '').replace(/[\s-]/g, '');
    if (!validateOrgNumber(cleaned)) {
      setClientBrregError('Organisasjonsnummer må være 9 siffer');
      return;
    }

    setClientBrregLoading(true);
    try {
      const companyData = await getBRREGCompanyData(cleaned);
      if (companyData?.name) {
        applyClientCompanyFromBrreg(companyData);
      } else {
        setClientBrregError('Kunne ikke hente bedriftsinformasjon');
      }
    } catch (error: unknown) {
      console.error('Error fetching BRREG client company data:', error);
      setClientBrregError('Kunne ikke hente bedriftsinformasjon fra Brønnøysundregistrene');
    } finally {
      setClientBrregLoading(false);
    }
  }, [applyClientCompanyFromBrreg, getBRREGCompanyData, projectData.clientOrganizationNumber]);

  const handleClientOrgNumberSearch = useCallback(async () => {
    await lookupClientOrgNumber(projectData.clientOrganizationNumber || '');
  }, [lookupClientOrgNumber, projectData.clientOrganizationNumber]);

  const handleClientOrgNumberChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^\d\s-]/g, '');
    if (cleaned.replace(/[\s-]/g, '').length <= 9) {
      const formatted = formatOrgNumber(cleaned);
      setProjectData((prev) => ({
        ...prev,
        clientOrganizationNumber: formatted,
      }));
      setClientBrregError(null);

      if (cleaned.replace(/[\s-]/g, '').length === 9) {
        void lookupClientOrgNumber(formatted);
      }
    }
  }, [lookupClientOrgNumber]);

  const handleClientCompanySelect = useCallback(async (company: { organizationNumber: string; name: string } | null) => {
    if (!company) return;
    setProjectData((prev) => ({
      ...prev,
      clientCompanyName: company.name,
      clientOrganizationNumber: formatOrgNumber(company.organizationNumber),
    }));
    setClientCompanySearchQuery('');
    setClientCompanySearchOptions([]);
    setClientBrregError(null);

    try {
      const details = await getBRREGCompanyData(company.organizationNumber);
      applyClientCompanyFromBrreg(details);
    } catch (_error) {
      // Non-blocking: keep selected company name/orgnr even if details lookup fails
    }
  }, [applyClientCompanyFromBrreg, getBRREGCompanyData]);

  useEffect(() => {
    const controller = new AbortController();

    const searchClientCompanies = async () => {
      if (!clientCompanySearchQuery || clientCompanySearchQuery.trim().length < 3) {
        setClientCompanySearchOptions([]);
        return;
      }

      setClientCompanySearchLoading(true);
      try {
        const results = await searchBRREGCompanies({
          name: clientCompanySearchQuery.trim(),
          limit: 10,
        });
        if (!controller.signal.aborted && results.companies) {
          setClientCompanySearchOptions(results.companies.map((company) => ({
            organizationNumber: company.organizationNumber,
            name: company.name,
            organizationForm: company.organizationForm,
          })));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Error searching BRREG client companies:', error);
          setClientCompanySearchOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setClientCompanySearchLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(searchClientCompanies, 300);
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [clientCompanySearchQuery, searchBRREGCompanies]);

  const handleAddCollaborator = () => {
    if (!newCollaboratorEmail.trim()) {
      setCollaboratorEmailError(true);
      return;
    }

    if (!validateEmail(newCollaboratorEmail)) {
      setCollaboratorEmailError(true);
      return;
    }

    const finalName = newCollaboratorName.trim() || newCollaboratorEmail.split('@')[0];
    
    // If editing existing collaborator
    if (editingCollaborator) {
      setProjectData((prev) => {
        const updatedCollaborators = prev.collaborators.map((c) => 
          c.id === editingCollaborator.id 
            ? { 
                ...c, 
                name: finalName, 
                email: newCollaboratorEmail.trim(), 
                role: newCollaboratorRole,
                availabilityStart: newCollaboratorAvailabilityStart || undefined,
                availabilityEnd: newCollaboratorAvailabilityEnd || undefined,
              }
            : c
        );
        
        // Also sync with split sheet if enabled
        let updatedSplitSheetData = prev.splitSheetData;
        if (prev.enableSplitSheet && prev.splitSheetData) {
          updatedSplitSheetData = {
            ...prev.splitSheetData,
            contributors: (prev.splitSheetData.contributors || []).map((c) =>
              c.email === editingCollaborator.email
                ? { 
                    ...c, 
                    name: finalName, 
                    email: newCollaboratorEmail.trim(), 
                    role: newCollaboratorRole,
                    availabilityStart: newCollaboratorAvailabilityStart || undefined,
                    availabilityEnd: newCollaboratorAvailabilityEnd || undefined,
                  }
                : c
            ),
          };
        }
        
        return {
          ...prev,
          collaborators: updatedCollaborators,
          splitSheetData: updatedSplitSheetData,
        };
      });
      
      toast.showSuccess(`${finalName} oppdatert`);
    } else {
      // Adding new collaborator
      const newCollaborator = {
        id: `collab-${Date.now()}`,
        name: finalName,
        email: newCollaboratorEmail.trim(),
        role: newCollaboratorRole,
        availabilityStart: newCollaboratorAvailabilityStart || undefined,
        availabilityEnd: newCollaboratorAvailabilityEnd || undefined,
      };

      console.log('Adding collaborator:', { 
        enteredName: newCollaboratorName, 
        finalName, 
        email: newCollaboratorEmail,
        role: newCollaboratorRole 
      });

      setProjectData((prev) => {
        const updatedCollaborators = [...prev.collaborators, newCollaborator];
        
        // Also sync with split sheet if enabled
        let updatedSplitSheetData = prev.splitSheetData;
        if (prev.enableSplitSheet && prev.splitSheetData) {
          // Add new contributor to split sheet
          const newContributor = {
            name: finalName,
            email: newCollaboratorEmail.trim(),
            role: newCollaboratorRole,
            percentage: 0,
            order_index: prev.splitSheetData.contributors?.length || 0,
            custom_fields: {},
          };
          updatedSplitSheetData = {
            ...prev.splitSheetData,
            contributors: [...(prev.splitSheetData.contributors || []), newContributor],
          };
        }
        
        return {
          ...prev,
          collaborators: updatedCollaborators,
          splitSheetData: updatedSplitSheetData,
        };
      });

      toast.showSuccess(`${finalName} lagt til i teamet`);
    }

    setNewCollaboratorEmail('');
    setNewCollaboratorName('');
    setNewCollaboratorOrgNumber('');
    setNewCollaboratorRole('collaborator');
    setNewCollaboratorAvailabilityStart('');
    setNewCollaboratorAvailabilityEnd('');
    setAddCollaboratorDialogOpen(false);
    setEditingCollaborator(null);
    setCollaboratorEmailError(false);
    setBrregError(null);
    setCompanySearchQuery('');
    setCompanySearchOptions([]);
  };
  
  const handleEditCollaborator = (collab: { id: string; name: string; email: string; role?: ContributorRole; availabilityStart?: string; availabilityEnd?: string }) => {
    setEditingCollaborator({
      id: collab.id,
      name: collab.name,
      email: collab.email,
      role: collab.role || 'collaborator',
      availabilityStart: collab.availabilityStart,
      availabilityEnd: collab.availabilityEnd,
    });
    setNewCollaboratorName(collab.name);
    setNewCollaboratorEmail(collab.email);
    setNewCollaboratorRole(collab.role || 'collaborator');
    setNewCollaboratorAvailabilityStart(collab.availabilityStart || '');
    setNewCollaboratorAvailabilityEnd(collab.availabilityEnd || '');
    setAddCollaboratorDialogOpen(true);
  };

  const handleNext = () => {
    // Validate Step 0 fields before proceeding
    if (activeStep === 0) {
      // Reset validation errors
      setClientNameError(false);
      setClientEmailError(false);
      setClientPhoneError(false);
      
      // Validate project name (required for all)
      if (!projectData.projectName || projectData.projectName.trim() === '') {
        toast.showWarning('Prosjektnavn er påkrevd');
        return;
      }
      
      // Validate prosjektansvarlig fields for The Role Room
      if (isCastingPlanner) {
        let hasErrors = false;
        
        if (!projectData.clientName || projectData.clientName.trim() === '') {
          setClientNameError(true);
          hasErrors = true;
        }
        
        if (!projectData.clientEmail || !validateEmail(projectData.clientEmail)) {
          setClientEmailError(true);
          hasErrors = true;
        }
        
        if (!projectData.clientPhone || !validatePhone(projectData.clientPhone)) {
          setClientPhoneError(true);
          hasErrors = true;
        }
        
        if (hasErrors) {
          toast.showWarning('Vennligst fyll ut alle påkrevde felt');
          return;
        }
      }
    }
    
    if (activeStep < STEPS.length - 1) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // Save project to database - called by SplitSheetEditor before saving split sheet
  const saveProjectToDatabase = useCallback(async (): Promise<boolean> => {
    console.log('[saveProjectToDatabase] CALLED! isCastingPlanner:', isCastingPlanner);
    
    if (!isCastingPlanner) {
      console.log('[saveProjectToDatabase] Not a The Role Room, skipping');
      return true;
    }
    
    const projectId = projectData.projectId;
    if (!projectId) {
      console.error('[saveProjectToDatabase] No project ID');
      return false;
    }
    
    console.log('[saveProjectToDatabase] Saving project:', projectId);
    
    try {
      // Map collaborators to crew
      const crew = (projectData.collaborators || []).map((collab) => ({
        id: collab.id,
        name: collab.name,
        role: collab.role, // ContributorRole maps to crew role string
        contactInfo: { email: collab.email },
        availability: {},
        assignedScenes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const projectPayload = {
        id: projectId,
        name: projectData.projectName.trim(),
        clientName: projectData.clientName || '',
        clientEmail: projectData.clientEmail || '',
        clientPhone: projectData.clientPhone || '',
        clientCompanyName: projectData.clientCompanyName || '',
        clientOrganizationNumber: projectData.clientOrganizationNumber || '',
        clientCompanyAddress: projectData.clientCompanyAddress || '',
        eventDate: projectData.eventDate || '',
        location: projectData.location || '',
        projectType: projectData.projectType || '',
        guestCount: projectData.guestCount || '',
        description: projectData.description || '',
        collaborators: projectData.collaborators || [],
        crew: crew,
        enableSplitSheet: projectData.enableSplitSheet || false,
      };

      console.log('[saveProjectToDatabase] Sending to /api/casting/projects:', projectPayload);
      
      const response = await apiRequest('/api/casting/projects', {
        method: 'POST',
        body: JSON.stringify(projectPayload),
      }) as { error?: string; id?: string } | null;

      console.log('[saveProjectToDatabase] Response:', response);

      if (response && !response.error) {
        // Verify project was saved
        const verifyResponse = await apiRequest(`/api/casting/projects/${projectId}`) as { id?: string } | null;
        if (verifyResponse && verifyResponse.id) {
          console.log('[saveProjectToDatabase] Project verified in database:', verifyResponse.id);
          return true;
        }
      }
      
      console.error('[saveProjectToDatabase] Failed to save project');
      return false;
    } catch (error: unknown) {
      console.error('[saveProjectToDatabase] Error:', error);
      return false;
    }
  }, [isCastingPlanner, projectData]);

  const handleOpenEconomyWorkspace = useCallback(async () => {
    if (!onOpenEconomy) {
      return;
    }

    if (!projectData.projectName.trim()) {
      toast.showWarning('Navngi prosjektet før du åpner økonomi.');
      return;
    }

    if (isCastingPlanner) {
      const saved = await saveProjectToDatabase();
      if (!saved) {
        toast.showError('Prosjektet må lagres før økonomi kan åpnes.');
        return;
      }
    }

    onOpenEconomy(projectData.projectId);
    toast.showInfo('Åpner økonomi-arbeidsflaten for budsjett, tilbud, kontrakter og teamavtaler.');
    onClose?.();
  }, [
    isCastingPlanner,
    onClose,
    onOpenEconomy,
    projectData.projectId,
    projectData.projectName,
    saveProjectToDatabase,
    toast,
  ]);

  const handleCopyClientPortalUrl = useCallback(async () => {
    const invite = await createClientMagicInvite();
    const inviteUrl = invite?.inviteUrl || clientInviteUrl;
    if (!inviteUrl) {
      toast.showError('Klientens magic-link kunne ikke bygges for dette prosjektet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.showSuccess('Klientens magic-link er kopiert.');
    } catch (error) {
      console.error('Failed to copy client invite url:', error);
      toast.showError('Kunne ikke kopiere klientens magic-link.');
    }
  }, [clientInviteUrl, createClientMagicInvite, toast]);

  const handleCopyClientInvite = useCallback(async () => {
    const invite = await createClientMagicInvite();
    if (!invite?.inviteUrl) {
      return;
    }
    const inviteSubject = renderClientInviteTemplate(
      clientInviteSubjectDraft || buildDefaultClientInviteSubject(),
      invite.inviteUrl,
    );
    const inviteBody = renderClientInviteTemplate(
      clientInviteBodyDraft || buildDefaultClientInviteBody(),
      invite.inviteUrl,
    );
    try {
      await navigator.clipboard.writeText(`Emne: ${inviteSubject}\n\n${inviteBody}`);
      toast.showSuccess('Klientinvitasjon kopiert.');
    } catch (error) {
      console.error('Failed to copy client invite:', error);
      toast.showError('Kunne ikke kopiere klientinvitasjonen.');
    }
  }, [
    buildDefaultClientInviteBody,
    buildDefaultClientInviteSubject,
    clientInviteBodyDraft,
    clientInviteSubjectDraft,
    createClientMagicInvite,
    renderClientInviteTemplate,
    toast,
  ]);

  const handleSendClientInviteEmail = useCallback(async (): Promise<boolean> => {
    const targetEmail = clientInviteRecipientEmail.trim().toLowerCase();
    if (!validateEmail(targetEmail)) {
      toast.showWarning('Legg inn en gyldig klient-epost før du sender invitasjonen.');
      return false;
    }
    const sentInvite = await createClientMagicInvite(targetEmail, {
      force: true,
      sendEmail: true,
    });
    return Boolean(sentInvite?.delivery?.sent);
  }, [
    clientInviteRecipientEmail,
    createClientMagicInvite,
    toast,
  ]);

  const completeProjectCreatedFlow = useCallback(() => {
    setClientInviteDialogOpen(false);
    setGeneratedClientInvite(null);
    setGeneratedClientInviteSignature(null);
    onClose?.();
  }, [onClose]);

  const handleSave = async (): Promise<boolean> => {
    setLoading(true);
    
    // Reset validation errors
    setClientNameError(false);
    setClientEmailError(false);
    setClientPhoneError(false);
    
    try {
      // Validate required fields
      if (!projectData.projectName || projectData.projectName.trim() === '') {
        toast.showWarning('Prosjektnavn er påkrevd');
        setLoading(false);
        return false;
      }

      // Validate prosjektansvarlig fields for The Role Room
      if (isCastingPlanner) {
        let hasErrors = false;
        
        if (!projectData.clientName || projectData.clientName.trim() === '') {
          setClientNameError(true);
          hasErrors = true;
        }
        
        if (!projectData.clientEmail || !validateEmail(projectData.clientEmail)) {
          setClientEmailError(true);
          hasErrors = true;
        }
        
        if (!projectData.clientPhone || !validatePhone(projectData.clientPhone)) {
          setClientPhoneError(true);
          hasErrors = true;
        }
        
        if (hasErrors) {
          toast.showWarning('Vennligst fyll ut alle påkrevde felt');
          setLoading(false);
          return false;
        }
      }

      const endpoint = isCastingPlanner ? '/api/casting/projects' : '/api/projects';
      
      // Use project ID from state (always set when modal opens, even for new projects)
      // This ensures the same ID is used for both project and split sheet
      const projectId = projectData.projectId || initialData?.id;
      
      if (!projectId) {
        toast.showError('Prosjekt-ID mangler. Vennligst last siden på nytt.');
        setLoading(false);
        return false;
      }
      
      // Map collaborators to crew for CastingPlanner compatibility
      // Always create crew array, even if empty
      const crew = (projectData.collaborators || []).map((collab) => ({
        id: collab.id,
        name: collab.name,
        role: collab.role, // ContributorRole maps to CrewRole (they overlap)
        contactInfo: {
          email: collab.email,
        },
        availability: {},
        assignedScenes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const projectPayload = {
        ...(isCastingPlanner && { id: projectId }), // Only include id for casting projects
        name: projectData.projectName.trim(),
        clientName: projectData.clientName || '',
        clientEmail: projectData.clientEmail || '',
        clientPhone: projectData.clientPhone || '',
        clientCompanyName: projectData.clientCompanyName || '',
        clientOrganizationNumber: projectData.clientOrganizationNumber || '',
        clientCompanyAddress: projectData.clientCompanyAddress || '',
        eventDate: projectData.eventDate || '',
        location: projectData.location || '',
        projectType: projectData.projectType || '',
        guestCount: projectData.guestCount || '',
        description: projectData.description || '',
        collaborators: projectData.collaborators || [], // Keep for split sheet
        crew: crew, // Add crew for CastingPlanner
        enableSplitSheet: projectData.enableSplitSheet || false,
      };
      
      console.log('[NewProjectCreationModal] Saving project to:', endpoint);
      console.log('[NewProjectCreationModal] Project payload:', JSON.stringify(projectPayload, null, 2));
      
      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(projectPayload),
      }) as { data?: { id?: string }; id?: string } | { id?: string };
      
      console.log('[NewProjectCreationModal] Save response:', JSON.stringify(response, null, 2));

      // Get project ID from response or use the one we generated
      // For The Role Room, always use the ID we sent (projectId) to ensure consistency
      const typedResponse = response as { data?: { id?: string }; id?: string };
      const finalProjectId = isCastingPlanner 
        ? (typedResponse?.data?.id || typedResponse?.id || projectId)
        : (typedResponse?.data?.id || typedResponse?.id || projectId);

      // Verify that project was actually saved to database before creating split sheet
      if (isCastingPlanner && finalProjectId) {
        let verified = false;
        let retries = 0;
        const maxRetries = 5;
        
        while (!verified && retries < maxRetries) {
          try {
            // Wait a bit for database to commit (increase wait time with each retry)
            await new Promise(resolve => setTimeout(resolve, 500 + (retries * 200)));
            
            // Verify project exists in database
            const verifyResponse = await apiRequest(`/api/casting/projects/${finalProjectId}`) as { id?: string; name?: string; error?: string; clientName?: string; clientEmail?: string } | null;
            if (verifyResponse && !verifyResponse?.error) {
              // Check that project has required fields
              if (verifyResponse?.id && verifyResponse?.name) {
                console.log('Project verified in database:', {
                  id: verifyResponse?.id,
                  name: verifyResponse?.name,
                  hasClientName: !!verifyResponse?.clientName,
                  hasClientEmail: !!verifyResponse?.clientEmail,
                });
                verified = true;
                break;
              } else {
                console.warn(`Project verification attempt ${retries + 1}: Project found but missing required fields`);
              }
            } else {
              console.warn(`Project verification attempt ${retries + 1}: Project not found or error in response`);
            }
          } catch (verifyError: unknown) {
            console.warn(`Project verification attempt ${retries + 1} failed:`, verifyError instanceof Error ? verifyError.message : String(verifyError));
          }
          
          retries++;
        }
        
        if (!verified) {
          console.error('Failed to verify project in database after', maxRetries, 'attempts');
          toast.showError(`Prosjektet kunne ikke verifiseres i databasen etter ${maxRetries} forsøk. Teamavtalen ble ikke opprettet. Vennligst prøv å lagre prosjektet på nytt.`);
          setLoading(false);
          return false;
        }
      }

      // Create split sheet if enabled - ONLY after project is verified
      if (projectData.enableSplitSheet && projectData.splitSheetData && finalProjectId) {
        // Remove contributor IDs to let backend generate new ones (prevents duplicate key errors)
        const contributorsWithoutIds = (projectData.splitSheetData.contributors || []).map((c: any) => {
          const { id, ...contributorWithoutId } = c;
          return contributorWithoutId;
        });
        
        try {
          const splitSheetResponse = await apiRequest('/api/split-sheets', {
            method: 'POST',
            body: JSON.stringify({
              id: finalProjectId, // Use same ID as project
              project_id: finalProjectId, // Link to project
              title: projectData.splitSheetData.title,
              description: projectData.splitSheetData.description,
              contributors: contributorsWithoutIds,
            }),
          });
          
          if (splitSheetResponse && !(splitSheetResponse as { error?: string })?.error) {
            const createdSplitSheet = ((splitSheetResponse as { data?: Record<string, unknown> })?.data || splitSheetResponse) as Record<string, unknown>;
            console.log('Split sheet created successfully:', {
              id: createdSplitSheet.id,
              project_id: createdSplitSheet.project_id,
              expected_project_id: finalProjectId,
            });
            
            // Verify split sheet was created with correct project_id
            if (createdSplitSheet.project_id !== finalProjectId) {
              console.error('CRITICAL: Split sheet created but project_id mismatch:', {
                expected: finalProjectId,
                received: createdSplitSheet.project_id,
              });
              toast.showError('Teamavtalen ble opprettet, men project_id matcher ikke. Vennligst kontakt support.');
            }
          } else {
            throw new Error('Split sheet creation returned error: ' + JSON.stringify(splitSheetResponse));
          }
        } catch (splitSheetError: unknown) {
          console.error('Failed to create split sheet:', splitSheetError);
          toast.showError(`Teamavtale kunne ikke opprettes: ${splitSheetError instanceof Error ? splitSheetError.message : 'Ukjent feil'}. Prosjektet er lagret, men avtalen må opprettes manuelt i økonomi.`);
        }
      }

      // Show success message
      setSuccessMessage(`Prosjektet "${projectData.projectName}" ble opprettet!`);
      setSavedProjectIdForInvite(finalProjectId || null);

      const projectResponse = (typedResponse?.data || response) as Record<string, unknown>;
      const normalizedProjectResponse = isCastingPlanner && finalProjectId
        ? {
            ...projectResponse,
            id: finalProjectId,
          }
        : projectResponse;
      const shouldOpenInvitePreview = (
        showClientInviteAfterSave &&
        isCastingPlanner &&
        validateEmail(projectData.clientEmail || '') &&
        Boolean(finalProjectId)
      );

      // Clear draft after successful save
      clearDraft();

      if (onProjectCreated) {
        onProjectCreated({
          ...normalizedProjectResponse,
          __deferCloseForInvite: shouldOpenInvitePreview,
        });
      }

      if (shouldOpenInvitePreview) {
        setClientInviteDialogOpen(true);
      }
      return true;
    } catch (error: unknown) {
      console.error('Error creating project:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      }
      // Show more detailed error message to user
      let errorMessage = 'Ukjent feil ved opprettelse av prosjekt';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = String(error);
      }
      toast.showError(`Feil ved opprettelse av prosjekt: ${errorMessage}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Demo Handler - role-aware (TROLL for production team, dedicated demo for content producer)
  const handleLoadTrollDemo = async () => {
    setLoadingTrollDemo(true);
    setTrollInitDialogOpen(true);
    setTrollInitStatus('loading');
    setTrollInitError(null);
    
    try {
      if (isContentProducerSession) {
        await castingService.initializeContentProducerDemoData();
        const demoProjectId = castingService.getContentProducerDemoProjectId();
        const demoProject = await castingService.getProject(demoProjectId);

        if (!demoProject) {
          throw new Error('Innholdsprodusent-demo ble ikke funnet i database');
        }

        const collaborators = (demoProject.crew || []).slice(0, 5).map((crewMember: any, idx: number) => ({
          id: `collab-${idx}`,
          name: String(crewMember.name || `Teammedlem ${idx + 1}`),
          email: String(crewMember.email || `crew.${idx + 1}@demo.no`),
          role: (crewMember.role || crewMember.position || 'crew') as ContributorRole,
        }));

        setProjectData((prev) => ({
          ...prev,
          projectId: demoProject.id,
          projectName: String(demoProject.name || PRODUCER_DEMO_PROJECT_NAME),
          projectType: String(demoProject.projectType || 'corporate-training'),
          description: String(demoProject.description || PRODUCER_DEMO_PROJECT_DESCRIPTION),
          clientName: String(demoProject.clientName || PRODUCER_DEMO_CLIENT_NAME),
          clientEmail: String(demoProject.clientEmail || PRODUCER_DEMO_CLIENT_EMAIL),
          clientCompanyName: String(demoProject.clientCompanyName || PRODUCER_DEMO_CLIENT_COMPANY),
          clientOrganizationNumber: String(demoProject.clientOrganizationNumber || ''),
          clientCompanyAddress: String(demoProject.clientCompanyAddress || PRODUCER_DEMO_CLIENT_ADDRESS),
          location: String(demoProject.locations?.[0]?.name || demoProject.location || PRODUCER_DEMO_CLIENT_COMPANY),
          eventDate: String(demoProject.startDate || prev.eventDate || ''),
          enableSplitSheet: false,
          collaborators: collaborators.length > 0
            ? collaborators
            : [{ id: 'collab-1', name: PRODUCER_DEMO_COLLABORATOR_NAME, email: PRODUCER_DEMO_COLLABORATOR_EMAIL, role: 'producer' as ContributorRole }],
          splitSheetData: null,
        }));

        setTrollInitAreas({
          project: { status: 'loaded', count: 1, items: [demoProject] },
          crew: { status: 'loaded', count: demoProject.crew?.length || 0, items: demoProject.crew || [] },
          locations: { status: 'loaded', count: demoProject.locations?.length || 0, items: demoProject.locations || [] },
        });
        setTrollInitStatus('complete');
        toast.showSuccess('Bedriftsdemo for innholdsproduksjon lastet inn.');
        return;
      }

      // Call the comprehensive TROLL initialization endpoint
      const response = await fetch('/api/demo/troll/initialize-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.areas) {
          setTrollInitAreas(data.areas);
          
          // Load project data into form from the TROLL project
          const projectArea = data.areas.project;
          if (projectArea?.status === 'loaded' && projectArea?.items?.[0]) {
            const trollProject = projectArea.items[0];
            
            // Build collaborators from crew data
            const crewArea = data.areas.crew;
            const collaborators = (crewArea?.items || []).slice(0, 5).map((c: any, idx: number) => ({
              id: `collab-${idx}`,
              name: c.name,
              email: `${c.name.toLowerCase().replace(/\s/g, '.')}@trollfilm.no`,
              role: c.role || 'crew',
            }));
            
            // Load split sheet contributors
            let splitSheetContributors: Array<Partial<SplitSheetContributor> & Record<string, unknown>> = [];
            const ssArea = data.areas.split_sheets;
            if (ssArea?.status === 'loaded' && ssArea?.count > 0) {
              try {
                const ssResponse = await fetch('/api/split-sheets?project_id=troll-project-2026');
                if (ssResponse.ok) {
                  const ssData = await ssResponse.json();
                  if (ssData.splitSheets?.[0]?.contributors) {
                    splitSheetContributors = ssData.splitSheets[0].contributors.map((c: any, idx: number) => ({
                      id: `ss-${idx}`,
                      name: c.name,
                      email: c.email,
                      role: c.role,
                      percentage: c.percentage,
                    }));
                  }
                }
              } catch (error) {
                console.warn('Could not load split sheet contributors for TROLL demo', error);
              }
            }
            
            // Update form with TROLL data
            const trollCollaborators: ProjectData['collaborators'] = collaborators.length > 0 
              ? collaborators.map((c: Record<string, unknown>) => ({
                  id: String(c.id || ''),
                  name: String(c.name || ''),
                  email: String(c.email || ''),
                  role: (c.role || 'crew') as ContributorRole,
                }))
              : [{ id: 'collab-1', name: 'Regissør', email: 'regi@trollfilm.no', role: 'director' as ContributorRole }];
            
            const trollSplitSheet: SplitSheet | null = splitSheetContributors.length > 0 ? {
              id: 'troll-project-2026',
              project_id: 'troll-project-2026',
              title: 'TROLL - Filmproduksjon Split Sheet',
              description: 'Fordeling av inntekter for TROLL (2026)',
              status: 'draft' as const,
              contributors: splitSheetContributors as SplitSheet['contributors'],
            } as SplitSheet : null;

            setProjectData((prev) => ({
              ...prev,
              projectId: 'troll-project-2026',
              projectName: String(trollProject.name || 'TROLL'),
              projectType: 'documentary' as const,
              description: 'Norsk eventyrfilm regissert av Roar Uthaug',
              clientName: 'Netflix / Nordisk Film',
              clientEmail: 'produksjon@troll-film.no',
              clientCompanyName: 'Netflix / Nordisk Film',
              clientOrganizationNumber: '999 888 777',
              clientCompanyAddress: 'Filmveien 1, 0150 Oslo',
              location: String(data.areas.locations?.items?.[0]?.name || 'Dovre, Norge'),
              eventDate: '2026-01-20',
              enableSplitSheet: true,
              collaborators: trollCollaborators,
              splitSheetData: trollSplitSheet,
            }));
            
            setTrollInitStatus('complete');
            toast.showSuccess('TROLL demo-prosjekt lastet inn!');
          } else {
            throw new Error('TROLL prosjekt ikke funnet i database');
          }
        } else {
          throw new Error(data.error || 'Kunne ikke laste TROLL data');
        }
      } else {
        throw new Error('Serverfeil ved lasting av TROLL data');
      }
    } catch (error) {
      console.error('Failed to load TROLL demo:', error);
      setTrollInitError(error instanceof Error ? error.message : 'Ukjent feil');
      setTrollInitStatus('error');
      toast.showError(
        (isContentProducerSession ? 'Kunne ikke laste innholdsprodusent-demo: ' : 'Kunne ikke laste TROLL demo: ')
          + (error instanceof Error ? error.message : 'Ukjent feil')
      );
    } finally {
      setLoadingTrollDemo(false);
    }
  };

  const showSuccessToast = (message: string) => {
    toast.showSuccess(message);
  };

  // Render Step 0 content
  const renderStep0 = () => (
    <Box sx={{ mt: { xs: 1, sm: 2 } }}>
      {/* TROLL Demo Button - Only show when creating new project (not editing) */}
      {!initialData?.id && isCastingPlanner && (
        <Card sx={{ mb: { xs: 2, sm: 2.5, md: 3 }, borderRadius: 2, bgcolor: 'rgba(156, 39, 176, 0.08)', border: '1px solid rgba(156, 39, 176, 0.3)' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <MovieFilterIcon sx={{ color: '#ce93d8', fontSize: 28 }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#ce93d8', fontWeight: 600 }}>
                    {demoProjectTitle}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.8rem' }}>
                    {demoProjectDescription}
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={handleLoadTrollDemo}
                disabled={loadingTrollDemo || trollInitStatus === 'complete'}
                startIcon={
                  loadingTrollDemo ? <CircularProgress size={16} color="inherit" /> : 
                  trollInitStatus === 'complete' ? <CheckCircleIcon /> : 
                  <PlayCircleIcon />
                }
                sx={{
                  borderColor: trollInitStatus === 'complete' ? '#4caf50' : '#9c27b0',
                  color: trollInitStatus === 'complete' ? '#81c784' : '#ce93d8',
                  '&:hover': { 
                    borderColor: trollInitStatus === 'complete' ? '#66bb6a' : '#ba68c8', 
                    bgcolor: trollInitStatus === 'complete' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(156, 39, 176, 0.1)' 
                  },
                  minWidth: 160,
                }}
              >
                {loadingTrollDemo ? 'Laster...' : trollInitStatus === 'complete' ? 'Lastet inn' : 'Last demo'}
              </Button>
            </Box>
            
            {/* Show status when loading or complete */}
            {(trollInitStatus === 'loading' || trollInitStatus === 'complete') && Object.keys(trollInitAreas).length > 0 && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(156, 39, 176, 0.2)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: 1 }}>
                  Data lastet fra database:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {loadedDemoAreaBadges.map(({ key, Icon, color, label, count }) => (
                    <Box
                      key={key}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1,
                        py: 0.25,
                        borderRadius: 2,
                        bgcolor: `${color}20`,
                        color,
                        fontSize: '0.7rem',
                        height: 24,
                      }}
                    >
                      <Icon sx={{ fontSize: '0.85rem' }} />
                      <span>{label}: {count}</span>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
            
            {/* Show error */}
            {trollInitStatus === 'error' && trollInitError && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(244, 67, 54, 0.2)' }}>
                <Typography variant="caption" sx={{ color: '#f44336' }}>
                  Feil: {trollInitError}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Project Name */}
      <Card sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 }, mb: 0, flex: '1 1 auto', minWidth: 0 }}>
              <FolderProjectIcon sx={{ color: 'primary.main', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' }, flexShrink: 0 }} />
              Prosjektnavn
            </Typography>
            {initialData?.updatedAt && (
              <Chip
                icon={<EventIcon sx={{ fontSize: '1rem !important' }} />}
                label={`Sist endret: ${new Date(initialData.updatedAt).toLocaleDateString('nb-NO', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`}
                size="small"
                sx={{ 
                  bgcolor: 'rgba(0, 212, 255, 0.15)',
                  color: '#00b8e6',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  fontWeight: 600,
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  flexShrink: 0,
                  ml: 'auto',
                  '& .MuiChip-icon': {
                    color: '#00b8e6',
                  },
                }}
              />
            )}
          </Box>
          <Divider sx={{ mb: 2, mt: 1 }} />
          <TextField
            label="Prosjektnavn"
            fullWidth
            value={projectData.projectName}
            onChange={(e) => setProjectData((prev) => ({ ...prev, projectName: e.target.value }))}
            required
            sx={{ 
              mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
              '& .MuiInputBase-input': {
                fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                py: { xs: 1.5, sm: 1.25, md: 1, lg: 0.875, xl: 0.75 },
                minHeight: { xs: 48, sm: 50, md: 52, lg: 54, xl: 56 },
              },
              '& .MuiInputLabel-root': {
                fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
              <ContactIcon sx={{ color: 'primary.main', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
              {isCastingPlanner ? 'Prosjektansvarlig' : 'Kontakt'}
            </Typography>
            {isCastingPlanner && (
              <Tooltip title={showProjectResponsibleInfo ? "Skjul informasjon" : "Vis informasjon om prosjektansvarlig"}>
                <IconButton
                  size="small"
                  onClick={() => setShowProjectResponsibleInfo(!showProjectResponsibleInfo)}
                  sx={{
                    color: showProjectResponsibleInfo ? 'primary.main' : 'text.secondary',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  aria-label="Vis informasjon om prosjektansvarlig"
                >
                  <InfoIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Divider sx={{ mb: 2, mt: 1 }} />
          {isCastingPlanner && (
            <Collapse in={showProjectResponsibleInfo}>
              <Alert 
                severity="info" 
                icon={<InfoIcon />}
                onClose={() => setShowProjectResponsibleInfo(false)}
                sx={{ 
                  mb: 2,
                  bgcolor: 'rgba(33, 150, 243, 0.1)',
                  border: '1px solid rgba(33, 150, 243, 0.3)',
                  '& .MuiAlert-icon': {
                    color: 'primary.main',
                  },
                  '& .MuiAlert-message': {
                    color: 'text.primary',
                  },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Hva er prosjektansvarlig?
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                  Prosjektansvarlig er personen som har hovedansvaret for The Role Room-prosjektet. 
                  Dette er typisk produksjonsleder, casting director, eller produksjonssjef. 
                  Kontaktinformasjonen brukes for kommunikasjon og koordinering av prosjektet.
                </Typography>
              </Alert>
            </Collapse>
          )}
          {isCastingPlanner && !showProjectResponsibleInfo && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontSize: '0.875rem', fontStyle: 'italic' }}>
              Angi hvem som er prosjektansvarlig for dette Role Room prosjektet.
            </Typography>
          )}
          <Stack spacing={2}>
            <TextField
              label={isCastingPlanner ? "Prosjektansvarlig navn *" : "Kontaktnavn"}
              fullWidth
              value={projectData.clientName}
              onChange={(e) => {
                setProjectData((prev) => ({ ...prev, clientName: e.target.value }));
                if (clientNameError) setClientNameError(false);
              }}
              onFocus={() => isCastingPlanner && setShowProjectResponsibleInfo(true)}
              error={clientNameError}
              helperText={clientNameError ? "Navn er påkrevd" : (isCastingPlanner ? "Navn på person som er ansvarlig for prosjektet" : undefined)}
              required={isCastingPlanner}
              autoComplete="name"
              tabIndex={0}
            />
            <TextField
              label={isCastingPlanner ? "E-post *" : "E-post"}
              fullWidth
              type="email"
              inputMode="email"
              autoComplete="email"
              value={projectData.clientEmail}
              onChange={(e) => {
                setProjectData((prev) => ({ ...prev, clientEmail: e.target.value }));
                if (clientEmailError) setClientEmailError(false);
              }}
              onFocus={() => isCastingPlanner && setShowProjectResponsibleInfo(true)}
              error={clientEmailError}
              helperText={clientEmailError ? "Gyldig e-postadresse er påkrevd" : (isCastingPlanner ? "E-post til prosjektansvarlig" : undefined)}
              required={isCastingPlanner}
              tabIndex={0}
            />
            <TextField
              label={isCastingPlanner ? "Telefon *" : "Telefon"}
              fullWidth
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={projectData.clientPhone}
              onChange={(e) => {
                setProjectData((prev) => ({ ...prev, clientPhone: e.target.value }));
                if (clientPhoneError) setClientPhoneError(false);
              }}
              onFocus={() => isCastingPlanner && setShowProjectResponsibleInfo(true)}
              error={clientPhoneError}
              helperText={clientPhoneError ? "Gyldig telefonnummer er påkrevd (minst 8 siffer)" : (isCastingPlanner ? "Telefonnummer til prosjektansvarlig" : undefined)}
              required={isCastingPlanner}
              tabIndex={0}
            />
            {isCastingPlanner && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Klientbedrift (BRREG)
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: -0.5 }}>
                  Valgfritt: søk opp klientbedrift i Brønnøysundregistrene.
                </Typography>
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={clientCompanySearchOptions}
                  filterOptions={(options) => options}
                  getOptionLabel={(option) => typeof option === 'string'
                    ? option
                    : `${option.name} (${formatOrgNumber(option.organizationNumber)})`}
                  inputValue={projectData.clientCompanyName || ''}
                  onInputChange={(_, newValue, reason) => {
                    if (reason === 'reset') {
                      return;
                    }
                    setProjectData((prev) => ({
                      ...prev,
                      clientCompanyName: newValue,
                    }));
                    setClientCompanySearchQuery(newValue);
                    if (clientBrregError) {
                      setClientBrregError(null);
                    }
                  }}
                  onChange={(_, newValue) => {
                    if (typeof newValue === 'string') {
                      setProjectData((prev) => ({
                        ...prev,
                        clientCompanyName: newValue,
                      }));
                      setClientCompanySearchQuery(newValue);
                      return;
                    }
                    void handleClientCompanySelect(newValue);
                  }}
                  loading={clientCompanySearchLoading}
                  value={null}
                  noOptionsText={(projectData.clientCompanyName || '').trim().length >= 3 ? 'Ingen bedrifter funnet' : 'Skriv minst 3 tegn for å søke'}
                  loadingText="Søker i BRREG..."
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      label="Klientbedrift"
                      placeholder="Skriv bedriftsnavn for å søke i BRREG"
                    />
                  )}
                  slotProps={{
                    popper: {
                      placement: 'bottom-start',
                      modifiers: [
                        {
                          name: 'offset',
                          options: {
                            offset: [0, 4],
                          },
                        },
                      ],
                      sx: {
                        zIndex: 100015,
                        '& .MuiAutocomplete-paper': {
                          bgcolor: '#1c2128',
                          color: '#fff',
                          border: '1px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        },
                        '& .MuiAutocomplete-option': {
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.1)',
                          },
                          '&.Mui-focused': {
                            bgcolor: 'rgba(0,212,255,0.2)',
                          },
                        },
                      },
                    },
                  }}
                />
                <TextField
                  label="Organisasjonsnummer (klient)"
                  fullWidth
                  inputMode="numeric"
                  value={projectData.clientOrganizationNumber || ''}
                  onChange={(e) => handleClientOrgNumberChange(e.target.value)}
                  placeholder="123 456 789"
                  error={!!clientBrregError}
                  helperText={clientBrregError || 'Fylles automatisk ved BRREG-søk'}
                  slotProps={{
                    htmlInput: {
                      'aria-label': 'Organisasjonsnummer for klientbedrift',
                      maxLength: 11,
                      pattern: '[0-9 ]*',
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CompanyIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: clientBrregLoading ? (
                      <InputAdornment position="end">
                        <CircularProgress size={20} sx={{ color: '#00d4ff' }} />
                      </InputAdornment>
                    ) : (projectData.clientOrganizationNumber || '').replace(/[\s-]/g, '').length === 9 ? (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => {
                            void handleClientOrgNumberSearch();
                          }}
                          edge="end"
                          size="small"
                          aria-label="Søk opp klientbedrift"
                        >
                          <SearchIcon />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />
                <TextField
                  label="Klientadresse"
                  fullWidth
                  value={projectData.clientCompanyAddress || ''}
                  onChange={(e) => setProjectData((prev) => ({ ...prev, clientCompanyAddress: e.target.value }))}
                />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Project Type */}
      {!isCastingPlanner && (
        <Card sx={{ mb: { xs: 2, sm: 3 }, borderRadius: { xs: 2, sm: 3 }, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.125rem' }, display: 'flex', alignItems: 'center', gap: 1 }}>
              <FolderProjectIcon sx={{ color: 'primary.main', fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
              Prosjekttype
            </Typography>
            <Divider sx={{ mb: 2, mt: 1 }} />
            <ProjectTypeSelector
              isCastingPlanner={isCastingPlanner}
              value={projectData.projectType}
              onChange={(value) => setProjectData((prev) => ({ ...prev, projectType: value }))}
            />
          </CardContent>
        </Card>
      )}
    </Box>
  );

  // Render Step 1 content
  const renderStep1 = () => (
    <Box sx={{ mt: { xs: 1, sm: 2 } }}>
      {/* Produksjonsteam (Teammedlemmer) */}
      <Card sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
            <GroupsIcon sx={{ color: 'primary.main', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
            Produksjonsteam
          </Typography>
          <Divider sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, mt: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }} />
          <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, fontWeight: 500, mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
            Legg til teammedlemmer som skal være med i prosjektet. Selve budsjettering, teamavtaler, tilbud og kontrakter håndteres samlet i økonomi-arbeidsflaten når teamet er klart.
          </Typography>
          <ProjectCollaborators
            collaborators={projectData.collaborators}
            onAddCollaborator={() => setAddCollaboratorDialogOpen(true)}
            onEditCollaborator={handleEditCollaborator}
            onRemoveCollaborator={(id) => {
              setProjectData((prev) => {
                const removedCollab = prev.collaborators.find((c) => c.id === id);
                const updatedCollaborators = prev.collaborators.filter((c) => c.id !== id);
                
                // Also remove from split sheet if enabled
                let updatedSplitSheetData = prev.splitSheetData;
                if (prev.enableSplitSheet && prev.splitSheetData && removedCollab) {
                  updatedSplitSheetData = {
                    ...prev.splitSheetData,
                    contributors: (prev.splitSheetData.contributors || []).filter(
                      (c) => c.email !== removedCollab.email
                    ),
                  };
                }
                
                return {
                  ...prev,
                  collaborators: updatedCollaborators,
                  splitSheetData: updatedSplitSheetData,
                };
              });
              showSuccessToast('Teammedlem fjernet fra teamet');
            }}
          />
        </CardContent>
      </Card>

      {/* Economy handoff */}
      <Card sx={{ mt: { xs: 1, sm: 1.5, md: 2, lg: 2.5, xl: 3 }, mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 }, mb: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
            <Typography variant="h6" gutterBottom={false} sx={{ fontWeight: 700, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
              <SplitSheetIcon sx={{ color: '#9f7aea', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
              Økonomi og teamavtaler
            </Typography>
            <Chip
              size="small"
              label={projectData.splitSheetData ? 'Avtaler klargjort i økonomi' : 'Avtaler opprettes i økonomi'}
              sx={{
                bgcolor: projectData.splitSheetData ? 'rgba(34,197,94,0.14)' : 'rgba(59,130,246,0.14)',
                color: projectData.splitSheetData ? '#86efac' : '#bfdbfe',
                fontWeight: 700,
              }}
            />
          </Box>
          <Divider sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, mt: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }} />
          <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' }, fontWeight: 500, mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
            Når prosjektet er navngitt og teamet er satt opp, åpner du økonomi for å jobbe med totalramme, kostlinjer, teamavtaler, tilbud og kontrakter i samme arbeidsflate.
          </Typography>
          <Stack spacing={1.5}>
            <Alert severity="info" sx={{ alignItems: 'center' }}>
              Teamkostnader og fordelingsavtaler er flyttet hitfra og inn i prosjektets økonomi-arbeidsflate.
            </Alert>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap">
              <Chip
                size="small"
                label={`${projectData.collaborators.length} teammedlem${projectData.collaborators.length === 1 ? '' : 'mer'}`}
                sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(45,212,191,0.16)', color: '#99f6e4' }}
              />
              {projectData.splitSheetData?.contributors?.length ? (
                <Chip
                  size="small"
                  label={`${projectData.splitSheetData.contributors.length} bidragsytere klargjort i økonomi`}
                  sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(168,85,247,0.16)', color: '#d8b4fe' }}
                />
              ) : null}
            </Stack>
            <Button
              variant="contained"
              startIcon={<AttachMoneyIcon />}
              onClick={() => { void handleOpenEconomyWorkspace(); }}
              disabled={!onOpenEconomy || !projectData.projectName.trim()}
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: '#fbbf24',
                color: '#111827',
                '&:hover': { bgcolor: '#f59e0b' },
              }}
            >
              Åpne økonomi
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <>
      <Box sx={{ width: '100%', maxWidth: { xs: '100%', sm: 800, md: 900, lg: 1000, xl: 1200 }, mx: 'auto', p: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 } }}>
        {/* Title - only shown when not in The Role Room (parent dialog has its own title) */}
        {!isCastingPlanner && (
          <Box sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' },
                  mb: projectData.projectId ? 1 : 0,
                  color: 'text.primary',
                }}
              >
                {getTerm ? getTerm('newProject') : 'Nytt Prosjekt'}
              </Typography>
              {onClose && (
                <IconButton onClick={onClose} size="small" aria-label="Lukk">
                  <CloseIcon />
                </IconButton>
              )}
            </Box>
            {/* Contact Info Summary */}
            <ContactProjectInfoSummary
              projectType={projectData.projectType}
              clientName={projectData.clientName}
              clientEmail={projectData.clientEmail}
              location={projectData.location}
              eventDate={projectData.eventDate}
            />
            {projectData.projectId && (
              <Stack
                spacing={{ xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 }}
                sx={{ mt: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}
              >
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
                  p: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2, xl: 2.25 },
                  borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3 },
                  bgcolor: 'rgba(0, 212, 255, 0.1)',
                  border: '2px solid rgba(0, 212, 255, 0.3)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                    <FolderProjectIcon sx={{ color: 'primary.main', fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.375rem', xl: '1.5rem' } }} />
                    <Box>
                      <Typography variant="caption" sx={{
                        fontWeight: 700,
                        fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem', lg: '0.8rem', xl: '0.85rem' },
                        color: 'primary.main',
                        textTransform: 'uppercase',
                        letterSpacing: { xs: '0.5px', sm: '0.75px', md: '1px', lg: '1.25px', xl: '1.5px' },
                        display: 'block',
                        mb: { xs: 0.25, sm: 0.375, md: 0.5, lg: 0.625, xl: 0.75 },
                      }}>
                        Prosjekt-ID
                      </Typography>
                      <Typography variant="body2" sx={{
                        fontWeight: 700,
                        fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.95rem', lg: '1rem', xl: '1.125rem' },
                        color: 'primary.main',
                        fontFamily: 'monospace',
                        letterSpacing: { xs: '0.3px', sm: '0.4px', md: '0.5px', lg: '0.6px', xl: '0.75px' },
                      }}>
                        {projectData.projectId}
                      </Typography>
                    </Box>
                  </Box>
                  {initialData?.id && (
                    <Button
                      variant="outlined"
                      startIcon={<ContractIcon />}
                      onClick={handleOpenEconomyWorkspace}
                      sx={{
                        borderColor: 'primary.main',
                        color: 'primary.main',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: 'rgba(0, 212, 255, 0.1)',
                        },
                        minHeight: { xs: 36, sm: 38, md: 40, lg: 42, xl: 44 },
                        fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem', lg: '0.938rem', xl: '1rem' },
                        px: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 },
                        py: { xs: 0.5, sm: 0.625, md: 0.75, lg: 0.875, xl: 1 },
                      }}
                    >
                      Åpne økonomi
                    </Button>
                  )}
                </Box>
                <Alert
                  severity="info"
                  sx={{
                    borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                    bgcolor: 'rgba(52, 211, 153, 0.1)',
                    border: '1px solid rgba(52, 211, 153, 0.25)',
                    color: 'rgba(255,255,255,0.92)',
                    '& .MuiAlert-icon': {
                      color: '#34d399',
                    },
                  }}
                >
                  Budsjett, tilbud og kontrakter håndteres samlet i økonomi-arbeidsflaten etter at prosjektet er opprettet.
                </Alert>
              </Stack>
            )}
          </Box>
        )}

        {isCastingPlanner && (
          <Card
            sx={{
              mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
              borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
              bgcolor: 'rgba(125,211,252,0.05)',
              border: '1px solid rgba(125,211,252,0.2)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.2)',
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 1.5, sm: 2.25 }}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <RoleRoomBrandMark appearance="header" showLabel={false} sx={{ width: { xs: 92, sm: 120 } }} />
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                        {brandingSettings.identity.appName || 'The Role Room'}
                      </Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: { xs: '0.78rem', sm: '0.82rem' } }}>
                        {brandingSettings.identity.tagline || 'Casting. Roles. Together.'}
                      </Typography>
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label="1. Grunndata" sx={{ bgcolor: 'rgba(59,130,246,0.18)', color: '#bfdbfe' }} />
                    <Chip size="small" label="2. Team og økonomi" sx={{ bgcolor: 'rgba(45,212,191,0.16)', color: '#99f6e4' }} />
                    <Chip size="small" label="3. Oppsummering" sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#e9d5ff' }} />
                  </Stack>
                </Stack>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.2}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                >
                  <Typography sx={{ color: 'rgba(255,255,255,0.76)', fontSize: { xs: '0.8rem', sm: '0.86rem' } }}>
                    Fyll ut grunnfeltene først. Deretter kan du hoppe direkte til siste steg for gjennomgang.
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ minWidth: { sm: 'max-content' } }}>
                    {!initialData?.id && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={resetToFreshProjectDraft}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.25)',
                          color: 'rgba(255,255,255,0.9)',
                          '&:hover': {
                            borderColor: 'rgba(255,255,255,0.45)',
                            bgcolor: 'rgba(255,255,255,0.06)',
                          },
                        }}
                      >
                        Start på nytt
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => {
                        if (!hasRequiredProjectBasics) {
                          setActiveStep(0);
                          toast.showWarning('Fyll ut prosjektnavn og ansvarlig kontakt før du går til oppsummering.');
                          return;
                        }
                        setActiveStep(STEPS.length - 1);
                      }}
                      sx={{
                        textTransform: 'none',
                        bgcolor: '#00d4ff',
                        color: '#001018',
                        fontWeight: 700,
                        '&:hover': { bgcolor: '#22d3ee' },
                      }}
                    >
                      Fortsett til oppsummering
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Draft and Project Selectors */}
        <Card sx={{ 
          mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, 
          borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
            <Typography variant="h6" sx={{ 
              fontWeight: 700, 
              fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
              mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
            }}>
              <FolderProjectIcon sx={{ color: 'primary.main', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
              Last inn utkast eller prosjekt
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: { xs: '0.8rem', sm: '0.86rem' }, mt: -2.25, mb: 2.25 }}>
              Velg et tidligere utkast for å fortsette der du slapp, eller åpne et eksisterende prosjekt for redigering.
            </Typography>
            <Stack spacing={{ xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }} direction={{ xs: 'column', sm: 'row' }}>
              {/* Draft Selector */}
              <FormControl fullWidth sx={{ flex: 1 }}>
                <InputLabel
                  sx={{
                    fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                    fontWeight: 600,
                    '&.Mui-focused': {
                      color: 'primary.main',
                    },
                  }}
                >
                  Utkast
                </InputLabel>
                <Select
                  value={selectedDraftKey || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleDraftSelect(e.target.value);
                    } else {
                      setSelectedDraftKey(null);
                    }
                  }}
                  label="Utkast"
                  MenuProps={selectMenuProps}
                  sx={{
                    minHeight: { xs: 52, sm: 54, md: 56, lg: 58, xl: 60 },
                    fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: 2,
                      borderColor: 'rgba(255,255,255,0.2)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.4)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                      borderWidth: 2,
                    },
                  }}
                >
                  <MenuItem value="">
                    <em>Ingen utkast valgt</em>
                  </MenuItem>
                  {availableDrafts.map((draft) => (
                    <MenuItem key={draft.key} value={draft.key}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {draft.data.projectName || 'Unnamed Draft'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {new Date(draft.savedAt).toLocaleString('no-NO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Project Selector (only for The Role Room) */}
              {isCastingPlanner && (
                <FormControl fullWidth sx={{ flex: 1 }}>
                  <InputLabel
                    sx={{
                      fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                      fontWeight: 600,
                      '&.Mui-focused': {
                        color: 'primary.main',
                      },
                    }}
                  >
                    Eksisterende prosjekt
                  </InputLabel>
                  <Select
                    value={selectedProjectId || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleProjectSelect(e.target.value);
                      } else {
                        setSelectedProjectId(null);
                      }
                    }}
                    label="Eksisterende prosjekt"
                    disabled={loadingProjects}
                    MenuProps={selectMenuProps}
                    sx={{
                      minHeight: { xs: 52, sm: 54, md: 56, lg: 58, xl: 60 },
                      fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderWidth: 2,
                        borderColor: 'rgba(255,255,255,0.2)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.4)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main',
                        borderWidth: 2,
                      },
                    }}
                    endAdornment={loadingProjects ? (
                      <CircularProgress size={20} sx={{ mr: 2 }} />
                    ) : null}
                  >
                    <MenuItem value="">
                      <em>Ingen prosjekt valgt</em>
                    </MenuItem>
                    {availableProjects.map((project) => (
                      <MenuItem key={project.id} value={project.id}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {project.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {new Date(project.updatedAt).toLocaleString('no-NO', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Vertical Stepper */}
        <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <Step key={step.label} completed={index < activeStep}>
                <StepLabel
                  StepIconComponent={({ active, completed }: { active?: boolean; completed?: boolean }) => (
                    <Box
                      sx={{
                        width: { xs: 32, sm: 36, md: 40, lg: 44, xl: 48 },
                        height: { xs: 32, sm: 36, md: 40, lg: 44, xl: 48 },
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: completed || active ? 'primary.main' : 'action.disabledBackground',
                        color: completed || active ? 'primary.contrastText' : 'action.disabled',
                        border: active ? '2px solid' : 'none',
                        borderColor: 'primary.main',
                        transition: 'all 0.3s ease',
                        '& svg': {
                          fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.375rem', xl: '1.5rem' },
                        },
                      }}
                    >
                      <StepIcon />
                    </Box>
                  )}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' }, color: 'text.primary' }}>
                    {step.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' }, fontWeight: 500, display: { xs: 'none', sm: 'block' } }}>
                    {step.description}
                  </Typography>
                </StepLabel>
                <StepContent>
                  {index === 0 && renderStep0()}
                  {index === 1 && renderStep1()}

                  {/* Navigation Buttons */}
                  <Box sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, mt: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 }, display: 'flex', gap: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      disabled={index === STEPS.length - 1}
                      size="large"
                      sx={{
                        minHeight: { xs: 56, sm: 52, md: 54, lg: 56, xl: 60 },
                        fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
                        fontWeight: 700,
                        px: { xs: 4, sm: 4, md: 4.5, lg: 5, xl: 6 },
                        py: { xs: 1.75, sm: 1.5, md: 1.625, lg: 1.75, xl: 2 },
                        flex: { xs: 1, sm: 'none' },
                        minWidth: { xs: '100%', sm: 140, md: 150, lg: 160, xl: 180 },
                      }}
                    >
                      {index === STEPS.length - 1 ? 'Fullfør' : 'Neste'}
                    </Button>
                    <Button
                      disabled={index === 0}
                      onClick={handleBack}
                      size="large"
                      variant="outlined"
                      sx={{
                        minHeight: { xs: 56, sm: 52, md: 54, lg: 56, xl: 60 },
                        fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
                        fontWeight: 700,
                        px: { xs: 4, sm: 4, md: 4.5, lg: 5, xl: 6 },
                        py: { xs: 1.75, sm: 1.5, md: 1.625, lg: 1.75, xl: 2 },
                        flex: { xs: 1, sm: 'none' },
                        minWidth: { xs: '100%', sm: 140, md: 150, lg: 160, xl: 180 },
                      }}
                    >
                      Tilbake
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            );
          })}
        </Stepper>

        {/* Draft Status and Save Button */}
        {!initialData?.id && (
          <Box sx={{ 
            mt: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, 
            mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
            p: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
            borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {/* Draft Status Indicator */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
              flex: { xs: 1, sm: 'none' },
            }}>
              {draftStatus === 'saving' && (
                <>
                  <CircularProgress 
                    size={isMobile ? 20 : 24} 
                    sx={{ color: 'primary.main' }} 
                  />
                  <Typography sx={{ 
                    fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                    color: 'text.secondary',
                  }}>
                    Lagrer utkast...
                  </Typography>
                </>
              )}
              {draftStatus === 'saved' && (
                <>
                  <CloudDoneIcon sx={{ 
                    fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem', lg: '1.5rem', xl: '1.625rem' },
                    color: 'success.main' 
                  }} />
                  <Box>
                    <Typography sx={{ 
                      fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                      color: 'success.main',
                      fontWeight: 600,
                    }}>
                      Utkast lagret
                    </Typography>
                    {lastSavedAt && (
                      <Typography sx={{ 
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' },
                        color: 'text.secondary',
                        mt: 0.25,
                      }}>
                        {lastSavedAt.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    )}
                  </Box>
                </>
              )}
              {draftStatus === 'error' && (
                <>
                  <CloudOffIcon sx={{ 
                    fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem', lg: '1.5rem', xl: '1.625rem' },
                    color: 'error.main' 
                  }} />
                  <Typography sx={{ 
                    fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                    color: 'error.main',
                  }}>
                    Kunne ikke lagre utkast
                  </Typography>
                </>
              )}
              {draftStatus === 'idle' && (
                <>
                  <CloudQueueIcon sx={{ 
                    fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem', lg: '1.5rem', xl: '1.625rem' },
                    color: 'text.secondary' 
                  }} />
                  <Typography sx={{ 
                    fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                    color: 'text.secondary',
                  }}>
                    Utkast lagres automatisk
                  </Typography>
                </>
              )}
            </Box>

            {/* Manual Save Draft Button */}
            <Button
              variant="outlined"
              size="medium"
              onClick={() => saveDraft(projectData, activeStep, true)}
              disabled={draftStatus === 'saving' || loading}
              startIcon={<SaveIcon />}
              sx={{
                minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                fontWeight: 600,
                px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                py: { xs: 1, sm: 1.125, md: 1.25, lg: 1.375, xl: 1.5 },
                minWidth: { xs: '100%', sm: 'auto' },
                borderColor: 'rgba(255,255,255,0.2)',
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(0, 212, 255, 0.1)',
                },
              }}
            >
              Lagre utkast
            </Button>
          </Box>
        )}

        {/* Final Save Button */}
        {activeStep === STEPS.length - 1 && (
          <Box sx={{ mt: { xs: 2, sm: 3, md: 3.5, lg: 4, xl: 4.5 }, display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => setSummaryModalOpen(true)}
              disabled={loading}
              fullWidth={isMobile}
              sx={{
                minHeight: { xs: 52, sm: 54, md: 56, lg: 58, xl: 60 },
                fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
                fontWeight: 700,
                px: { xs: 3, sm: 4, md: 4.5, lg: 5, xl: 6 },
                py: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 },
              }}
            >
              {initialData?.id ? 'Oppdater prosjekt' : 'Opprett prosjekt'}
            </Button>
          </Box>
        )}
      </Box>

      {/* Add Collaborator Dialog - Same style as CrewManagementPanel */}
      <Dialog
        open={addCollaboratorDialogOpen}
        onClose={() => {
          setAddCollaboratorDialogOpen(false);
          setEditingCollaborator(null);
          setNewCollaboratorEmail('');
          setNewCollaboratorName('');
          setNewCollaboratorOrgNumber('');
          setNewCollaboratorRole('collaborator');
          setCollaboratorEmailError(false);
          setBrregError(null);
          setCompanySearchQuery('');
          setCompanySearchOptions([]);
        }}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        container={() => document.body}
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescId}
        TransitionComponent={Grow}
        TransitionProps={{
          timeout: { enter: 225, exit: 150 },
          enter: true,
          exit: true,
        }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#1c2128',
              color: '#fff',
              maxHeight: { xs: '100%', sm: '90vh', md: '85vh', lg: '80vh', xl: '75vh' },
              m: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
              borderRadius: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
              willChange: 'transform, opacity',
              transformOrigin: 'center center',
              zIndex: 100000,
            },
          },
        }}
        sx={{
          zIndex: 100000,
          '& .MuiBackdrop-root': {
            zIndex: 99998,
            bgcolor: 'rgba(0,0,0,0.8)',
            willChange: 'opacity',
          },
        }}
      >
        <DialogTitle
          id={dialogTitleId}
          sx={{
            color: '#fff',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            fontSize: { xs: '1.1rem', sm: '1.188rem', md: '1.25rem', lg: '1.313rem', xl: '1.375rem' },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 },
            px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
          }}
        >
          {editingCollaborator ? 'Rediger teammedlem' : 'Nytt teammedlem'}
          {isMobile && (
            <IconButton
              onClick={() => {
                setAddCollaboratorDialogOpen(false);
                setEditingCollaborator(null);
                setNewCollaboratorEmail('');
                setNewCollaboratorName('');
                setNewCollaboratorOrgNumber('');
                setNewCollaboratorRole('collaborator');
                setNewCollaboratorAvailabilityStart('');
                setNewCollaboratorAvailabilityEnd('');
                setCollaboratorEmailError(false);
                setBrregError(null);
                setCompanySearchQuery('');
                setCompanySearchOptions([]);
              }}
              aria-label="Lukk dialog"
              sx={{ color: 'rgba(255,255,255,0.87)', mr: -1 }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent
          sx={{
            pt: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            pb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            bgcolor: '#1c2128',
          }}
        >
          <Typography
            id={dialogDescId}
            variant="body2"
            sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 }, fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}
          >
            Legg til et nytt medlem i produksjonsteamet. Felter merket med * er påkrevd.
          </Typography>

          {/* Bedriftssøk Card */}
          <Card sx={{ 
            mb: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 }, 
            borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
              <Typography variant="h6" gutterBottom sx={{ 
                fontWeight: 700, 
                fontSize: { xs: '0.938rem', sm: '0.969rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' }, 
                display: 'flex', 
                alignItems: 'center', 
                gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
                color: '#fff',
              }}>
                <CompanyIcon sx={{ color: '#00d4ff', fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem', lg: '1.5rem', xl: '1.625rem' } }} />
                Bedriftssøk (valgfritt)
              </Typography>
              <Divider sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, mt: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 }, borderColor: 'rgba(255,255,255,0.1)' }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}>
                Søk i Brønnøysundregistrene for å fylle ut bedriftsinformasjon automatisk.
              </Typography>
              <Stack spacing={2}>
                <Autocomplete
                  freeSolo
                  fullWidth
                  key={addCollaboratorDialogOpen ? 'open' : 'closed'}
                  options={companySearchOptions}
                  getOptionLabel={(option) => typeof option === 'string'
                    ? option
                    : `${option.name} (${formatOrgNumber(option.organizationNumber)})`}
                  inputValue={companySearchQuery}
                  onInputChange={(_, newValue, reason) => {
                    if (reason === 'reset') {
                      return;
                    }
                    setCompanySearchQuery(newValue);
                    if (brregError) {
                      setBrregError(null);
                    }
                  }}
                  onChange={(_, newValue) => {
                    if (typeof newValue === 'string') {
                      setCompanySearchQuery(newValue);
                      return;
                    }
                    handleCompanySelect(newValue);
                  }}
                  loading={companySearchLoading}
                  value={null}
                  noOptionsText={companySearchQuery.length >= 3 ? 'Ingen bedrifter funnet' : 'Skriv minst 3 tegn for å søke'}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      label="Søk bedrift"
                      placeholder="Søk på bedriftsnavn"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          minHeight: TOUCH_TARGET_SIZE,
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                          '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                        },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                        '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
                      }}
                    />
                  )}
                  slotProps={{
                    popper: {
                      placement: 'bottom-start',
                      modifiers: [
                        {
                          name: 'offset',
                          options: {
                            offset: [0, 4],
                          },
                        },
                      ],
                      sx: {
                        zIndex: 100015,
                        '& .MuiAutocomplete-paper': {
                          bgcolor: '#1c2128',
                          color: '#fff',
                          border: '1px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        },
                        '& .MuiAutocomplete-option': {
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.1)',
                          },
                          '&.Mui-focused': {
                            bgcolor: 'rgba(0,212,255,0.2)',
                          },
                        },
                      },
                    },
                  }}
                />
                <TextField
                  label="Organisasjonsnummer"
                  fullWidth
                  inputMode="numeric"
                  value={newCollaboratorOrgNumber}
                  onChange={(e) => handleOrgNumberChange(e.target.value)}
                  placeholder="123 456 789"
                  error={!!brregError}
                  helperText={brregError || 'Eller søk på bedriftsnavn over'}
                  slotProps={{
                    htmlInput: {
                      'aria-label': 'Organisasjonsnummer for bedriftssøk',
                      maxLength: 11,
                      pattern: '[0-9 ]*',
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CompanyIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: brregLoading ? (
                      <InputAdornment position="end">
                        <CircularProgress size={20} sx={{ color: '#00d4ff' }} />
                      </InputAdornment>
                    ) : newCollaboratorOrgNumber.replace(/[\s-]/g, '').length === 9 ? (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleOrgNumberSearch}
                          edge="end"
                          size="small"
                          aria-label="Søk opp bedrift"
                          sx={{
                            color: '#00d4ff',
                            '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' },
                          }}
                        >
                          <SearchIcon />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      minHeight: TOUCH_TARGET_SIZE,
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
                    '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.87)' },
                  }}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Teammedlem-info Card */}
          <Card sx={{ 
            mb: 3, 
            borderRadius: 3, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ 
                fontWeight: 700, 
                fontSize: '1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: '#fff',
              }}>
                <ContactIcon sx={{ color: '#00d4ff' }} />
                Teammedlem
              </Typography>
              <Divider sx={{ mb: 2, mt: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
              <Stack spacing={2.5}>
                <TextField
                  label="Navn"
                  fullWidth
                  value={newCollaboratorName}
                  onChange={(e) => setNewCollaboratorName(e.target.value)}
                  autoComplete="name"
                  slotProps={{
                    htmlInput: {
                      'aria-label': 'Navn på teammedlem',
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ContactIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      minHeight: TOUCH_TARGET_SIZE,
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
                  }}
                />
                <TextField
                  label="E-post *"
                  fullWidth
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
                  required
                  slotProps={{
                    htmlInput: {
                      'aria-required': true,
                      'aria-label': 'E-postadresse (påkrevd)',
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      minHeight: TOUCH_TARGET_SIZE,
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
                    '& .MuiFormHelperText-root.Mui-error': { color: '#f44336' },
                  }}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Rolle Card */}
          <Card sx={{ 
            borderRadius: 3, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ 
                fontWeight: 700, 
                fontSize: '1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: '#fff',
              }}>
                <GroupsIcon sx={{ color: '#00d4ff' }} />
                Rolle i prosjektet
              </Typography>
              <Divider sx={{ mb: 2, mt: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
              <FormControl fullWidth>
                <InputLabel
                  id="collaborator-role-label"
                  sx={{
                    color: 'rgba(255,255,255,0.87)',
                    '&.Mui-focused': { color: '#00d4ff' },
                  }}
                >
                  Rolle *
                </InputLabel>
                <Select
                  labelId="collaborator-role-label"
                  value={newCollaboratorRole}
                  onChange={(e) => setNewCollaboratorRole(e.target.value as ContributorRole)}
                  label="Rolle *"
                  MenuProps={selectMenuProps}
                  inputProps={{ 'aria-label': 'Velg rolle for teammedlem' }}
                  sx={{
                    color: '#fff',
                    minHeight: TOUCH_TARGET_SIZE,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00d4ff', borderWidth: 2 },
                  }}
                >
                  {availableCollaboratorRoles.map((role) => (
                    <MenuItem
                      key={role}
                      value={role}
                      sx={{
                        minHeight: TOUCH_TARGET_SIZE,
                        '&:focus-visible': { bgcolor: 'rgba(0,212,255,0.2)' },
                      }}
                    >
                      {ROLE_DISPLAY_NAMES[role]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          {/* Tilgjengelighet Card - synced with CrewManagementPanel, uses Kalender tab colors (#9c27b0) */}
          <Card sx={{ 
            mb: 0, 
            borderRadius: 3, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            bgcolor: 'rgba(156,39,176,0.05)',
            border: '1px solid rgba(156,39,176,0.2)',
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ 
                fontWeight: 700, 
                fontSize: '1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: '#fff',
              }}>
                <CalendarIcon sx={{ color: '#9c27b0' }} />
                Tilgjengelighet
              </Typography>
              <Divider sx={{ mb: 2, mt: 1, borderColor: 'rgba(156,39,176,0.3)' }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 2, fontSize: '0.875rem' }}>
                Angi når teammedlemmet er tilgjengelig for prosjektet.
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Tilgjengelig fra"
                  fullWidth
                  type="date"
                  value={newCollaboratorAvailabilityStart}
                  onChange={(e) => setNewCollaboratorAvailabilityStart(e.target.value)}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { 'aria-label': 'Tilgjengelig fra dato' },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      minHeight: TOUCH_TARGET_SIZE,
                      '& fieldset': { borderColor: 'rgba(156,39,176,0.4)' },
                      '&:hover fieldset': { borderColor: 'rgba(156,39,176,0.6)' },
                      '&.Mui-focused fieldset': { borderColor: '#9c27b0', borderWidth: 2 },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#9c27b0' },
                    '& input[type="date"]::-webkit-calendar-picker-indicator': {
                      filter: 'invert(1)',
                    },
                  }}
                />
                <TextField
                  label="Tilgjengelig til"
                  fullWidth
                  type="date"
                  value={newCollaboratorAvailabilityEnd}
                  onChange={(e) => setNewCollaboratorAvailabilityEnd(e.target.value)}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { 'aria-label': 'Tilgjengelig til dato' },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      minHeight: TOUCH_TARGET_SIZE,
                      '& fieldset': { borderColor: 'rgba(156,39,176,0.4)' },
                      '&:hover fieldset': { borderColor: 'rgba(156,39,176,0.6)' },
                      '&.Mui-focused fieldset': { borderColor: '#9c27b0', borderWidth: 2 },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#9c27b0' },
                    '& input[type="date"]::-webkit-calendar-picker-indicator': {
                      filter: 'invert(1)',
                    },
                  }}
                />
              </Stack>
            </CardContent>
          </Card>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            justifyContent: { xs: 'stretch', sm: 'flex-end' },
            position: { xs: 'sticky', sm: 'relative' },
            bottom: 0,
            bgcolor: '#1c2128',
          }}
        >
          <Button
            onClick={() => {
              setAddCollaboratorDialogOpen(false);
              setEditingCollaborator(null);
              setNewCollaboratorEmail('');
              setNewCollaboratorName('');
              setNewCollaboratorOrgNumber('');
              setNewCollaboratorRole('collaborator');
              setNewCollaboratorAvailabilityStart('');
              setNewCollaboratorAvailabilityEnd('');
              setCollaboratorEmailError(false);
              setBrregError(null);
              setCompanySearchQuery('');
              setCompanySearchOptions([]);
            }}
            startIcon={<CancelIcon />}
            aria-label="Avbryt og lukk dialog"
            fullWidth={isMobile}
            sx={{
              color: 'rgba(255,255,255,0.87)',
              minHeight: TOUCH_TARGET_SIZE,
              minWidth: { xs: 'auto', sm: 100, md: 120, lg: 140, xl: 160 },
              fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
              ...focusVisibleStyles,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleAddCollaborator}
            startIcon={<SaveIcon />}
            aria-label={editingCollaborator ? "Oppdater teammedlem" : "Legg til teammedlem"}
            fullWidth={isMobile}
            sx={{
              bgcolor: '#00d4ff',
              color: '#000',
              fontWeight: 600,
              minHeight: TOUCH_TARGET_SIZE,
              minWidth: { xs: 'auto', sm: 100, md: 120, lg: 140, xl: 160 },
              fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
              ...focusVisibleStyles,
              '&:hover': { bgcolor: '#00b8e6' },
            }}
          >
            {editingCollaborator ? 'Oppdater' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Project Summary Modal */}
      <Dialog
        open={summaryModalOpen}
        onClose={() => !loading && setSummaryModalOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        container={() => document.body}
        TransitionComponent={Grow}
        TransitionProps={{
          timeout: { enter: 225, exit: 150 },
          enter: true,
          exit: true,
        }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#1c2128',
              color: '#fff',
              zIndex: 100021,
              maxHeight: { xs: '100%', sm: '90vh' },
              m: { xs: 0, sm: 2, md: 3 },
              borderRadius: { xs: 0, sm: 2 },
            },
          },
        }}
        sx={{
          zIndex: 100020,
          '& .MuiBackdrop-root': {
            zIndex: 100019,
            bgcolor: 'rgba(0,0,0,0.8)',
          },
        }}
      >
        <DialogTitle
          sx={{
            color: '#fff',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            fontSize: { xs: '1.1rem', sm: '1.188rem', md: '1.25rem', lg: '1.313rem', xl: '1.375rem' },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 },
            px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
          }}
        >
          Oppsummering
          {isMobile && !loading && (
            <IconButton
              onClick={() => setSummaryModalOpen(false)}
              aria-label="Lukk"
              sx={{ color: 'rgba(255,255,255,0.87)', mr: -1 }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent
          sx={{
            pt: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            pb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            overflowY: 'auto',
          }}
        >
          <Stack spacing={{ xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }}>
            {/* Project ID - Prominently displayed */}
            {projectData.projectId && (
              <Card sx={{ 
                borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }, 
                bgcolor: 'rgba(0, 212, 255, 0.15)', 
                border: '2px solid rgba(0, 212, 255, 0.4)',
                boxShadow: '0 4px 12px rgba(0, 212, 255, 0.2)',
              }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 700, 
                    mb: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 }, 
                    fontSize: { xs: '0.938rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
                    color: 'primary.main',
                  }}>
                    <FolderProjectIcon sx={{ color: 'primary.main', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
                    Prosjekt-ID
                  </Typography>
                  <Typography variant="body1" sx={{ 
                    fontWeight: 700, 
                    fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' }, 
                    color: 'primary.main',
                    fontFamily: 'monospace',
                    letterSpacing: { xs: '0.4px', sm: '0.5px', md: '0.6px', lg: '0.75px', xl: '1px' },
                    wordBreak: 'break-all',
                  }}>
                    {projectData.projectId}
                  </Typography>
                </CardContent>
              </Card>
            )}

            {/* Project Name */}
            <Card sx={{ borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 }, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                  <FolderProjectIcon sx={{ color: 'primary.main', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
                  Prosjektnavn
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' }, color: 'text.primary' }}>
                  {projectData.projectName || '-'}
                </Typography>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card sx={{ borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 }, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                  <ContactIcon sx={{ color: 'primary.main', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
                  {isCastingPlanner ? 'Prosjektansvarlig' : 'Kontakt'}
                </Typography>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                      Navn
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                      {projectData.clientName || '-'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                      E-post
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                      {projectData.clientEmail || '-'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                      Telefon
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                      {projectData.clientPhone || '-'}
                    </Typography>
                  </Box>
                  {(projectData.clientCompanyName || projectData.clientOrganizationNumber || projectData.clientCompanyAddress) && (
                    <>
                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                          Klientbedrift
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {projectData.clientCompanyName || '-'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                          Organisasjonsnummer
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {projectData.clientOrganizationNumber || '-'}
                        </Typography>
                      </Box>
                      {projectData.clientCompanyAddress && (
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                            Bedriftsadresse
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                            {projectData.clientCompanyAddress}
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                  {projectData.location && (
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.75rem' }}>
                        Lokasjon
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                        {projectData.location}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Production Team */}
            <Card sx={{ borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 }, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                  <GroupsIcon sx={{ color: 'primary.main', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
                  Produksjonsteam
                </Typography>
                {projectData.collaborators.length > 0 ? (
                  <Stack spacing={{ xs: 1.25, sm: 1.5, md: 1.75, lg: 2, xl: 2.25 }}>
                    {projectData.collaborators.map((collab) => {
                      // Get role color (matching ProjectCollaborators logic)
                      const getRoleColor = (role?: ContributorRole) => {
                        if (!role) return '#6b7280';
                        if (['second_shooter', 'photo_editor', 'retoucher'].includes(role)) return '#10b981';
                        if (['assistant', 'stylist', 'makeup_artist'].includes(role)) return '#3b82f6';
                        if (['video_editor', 'cinematographer', 'colorist'].includes(role)) return '#8b5cf6';
                        if (['sound_engineer', 'grip', 'gaffer'].includes(role)) return '#3b82f6';
                        if (['producer', 'artist'].includes(role)) return '#10b981';
                        if (['songwriter', 'composer', 'mix_engineer'].includes(role)) return '#f59e0b';
                        if (role === 'collaborator') return '#3b82f6';
                        return '#6b7280';
                      };
                      const roleColor = getRoleColor(collab.role);
                      
                      return (
                        <Box
                          key={collab.id}
                          sx={{
                            p: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                            borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                            bgcolor: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                          }}
                        >
                          <Avatar
                            sx={{
                              width: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
                              height: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
                              bgcolor: roleColor,
                              fontWeight: 600,
                              fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
                            }}
                          >
                            {(collab.name || collab.email).charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="body1"
                              sx={{
                                fontWeight: 600,
                                color: 'text.primary',
                                fontSize: { xs: '0.875rem', sm: '0.938rem', md: '0.95rem', lg: '1rem', xl: '1.063rem' },
                                mb: { xs: 0.375, sm: 0.5, md: 0.625, lg: 0.75, xl: 0.875 },
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {collab.name || collab.email}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.375, sm: 0.5, md: 0.625, lg: 0.75, xl: 0.875 } }}>
                              <EmailIcon sx={{ fontSize: { xs: 12, sm: 13, md: 14, lg: 15, xl: 16 }, color: 'text.secondary' }} />
                              <Typography
                                variant="body2"
                                sx={{
                                  color: 'text.secondary',
                                  fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {collab.email}
                              </Typography>
                            </Box>
                          </Box>
                          <Chip
                            label={ROLE_DISPLAY_NAMES[collab.role] || collab.role || 'Teammedlem'}
                            size="small"
                            sx={{
                              height: { xs: 22, sm: 24, md: 26, lg: 28, xl: 30 },
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' },
                              fontWeight: 600,
                              bgcolor: `${roleColor}15`,
                              color: roleColor,
                              border: `1px solid ${roleColor}30`,
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}>
                    Ingen teammedlemmer lagt til
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Economy status */}
            <Card sx={{ borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }, fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' }, display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
                  <SplitSheetIcon sx={{ color: '#9f7aea', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
                  Økonomi og teamavtaler
                </Typography>
                <Stack spacing={1.5}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' } }}>
                    Økonomi samler budsjett, teamkostnader, teamavtaler, tilbud og kontrakter i én arbeidsflate. Prosjektoppsettet viser bare status og sender deg videre dit.
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
                    <Chip
                      size="small"
                      label={projectData.splitSheetData ? 'Avtaler klargjort i økonomi' : 'Avtaler opprettes i økonomi'}
                      sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(168,85,247,0.16)', color: '#d8b4fe' }}
                    />
                    <Chip
                      size="small"
                      label={`${projectData.collaborators.length} teammedlem${projectData.collaborators.length === 1 ? '' : 'mer'}`}
                      sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(45,212,191,0.16)', color: '#99f6e4' }}
                    />
                  </Stack>
                  <Button
                    variant="contained"
                    startIcon={<AttachMoneyIcon />}
                    onClick={() => { void handleOpenEconomyWorkspace(); }}
                    disabled={!onOpenEconomy || !projectData.projectName.trim()}
                    sx={{
                      alignSelf: 'flex-start',
                      textTransform: 'none',
                      fontWeight: 700,
                      bgcolor: '#fbbf24',
                      color: '#111827',
                      '&:hover': { bgcolor: '#f59e0b' },
                    }}
                  >
                    Åpne økonomi
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          {isCastingPlanner ? (
            <Card sx={{ mt: 2.5, borderRadius: 3, bgcolor: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.22)' }}>
              <CardContent sx={{ p: 2.25 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.98rem', mb: 0.5 }}>
                  Send klientinvitasjon etter opprettelse
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.84rem', lineHeight: 1.55, mb: 1.1 }}>
                  Når prosjektet er lagret, kan du åpne en invitasjonsvisning med ekte magic-link og e-postpreview før du sender videre til klienten.
                </Typography>
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={showClientInviteAfterSave}
                      onChange={(event) => setShowClientInviteAfterSave(event.target.checked)}
                      sx={{
                        color: 'rgba(0,212,255,0.7)',
                        '&.Mui-checked': { color: '#00d4ff' },
                      }}
                    />
                  )}
                  label={validateEmail(projectData.clientEmail || '')
                    ? `Forhåndsvis og send magic-link til ${projectData.clientEmail}`
                    : 'Forhåndsvis klientinvitasjon etter lagring'}
                  sx={{
                    m: 0,
                    alignItems: 'flex-start',
                    '& .MuiFormControlLabel-label': {
                      color: '#fff',
                      fontSize: '0.9rem',
                    },
                  }}
                />
                {!validateEmail(projectData.clientEmail || '') ? (
                  <Typography sx={{ color: 'rgba(255,255,255,0.66)', fontSize: '0.76rem', mt: 0.6 }}>
                    Legg inn gyldig klient-e-post for å åpne e-postpreview automatisk.
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            justifyContent: { xs: 'stretch', sm: 'flex-end' },
          }}
        >
          <Button
            onClick={() => setSummaryModalOpen(false)}
            disabled={loading}
            startIcon={<CancelIcon />}
            fullWidth={isMobile}
            sx={{
              color: 'rgba(255,255,255,0.87)',
              minHeight: TOUCH_TARGET_SIZE,
              minWidth: { xs: 'auto', sm: 100, md: 120, lg: 140, xl: 160 },
              fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            Tilbake
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              const saved = await handleSave();
              if (!saved) {
                return;
              }
              setSummaryModalOpen(false);
            }}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            fullWidth={isMobile}
            sx={{
              bgcolor: '#00d4ff',
              color: '#000',
              fontWeight: 600,
              minHeight: TOUCH_TARGET_SIZE,
              minWidth: { xs: 'auto', sm: 140, md: 160, lg: 180, xl: 200 },
              fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
              '&:hover': { bgcolor: '#00b8e6' },
              '&.Mui-disabled': {
                bgcolor: 'rgba(0,212,255,0.5)',
                color: 'rgba(0,0,0,0.5)',
              },
            }}
          >
            {loading ? (initialData?.id ? 'Oppdaterer...' : 'Oppretter...') : (initialData?.id ? 'Bekreft og oppdater' : 'Bekreft og opprett')}
          </Button>
        </DialogActions>
      </Dialog>


      <Dialog
        open={clientInviteDialogOpen}
        onClose={completeProjectCreatedFlow}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        container={() => document.body}
        TransitionComponent={Grow}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#1c2128',
              color: '#fff',
              zIndex: 100021,
              m: { xs: 0, sm: 2, md: 3 },
              borderRadius: { xs: 0, sm: 2 },
            },
          },
        }}
        sx={{
          zIndex: 100020,
          '& .MuiBackdrop-root': {
            zIndex: 100019,
            bgcolor: 'rgba(0,0,0,0.8)',
          },
        }}
      >
        <DialogTitle
          sx={{
            color: '#fff',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          Send klientinvitasjon
          <IconButton onClick={completeProjectCreatedFlow} aria-label="Lukk invitasjonsvisning" sx={{ color: 'rgba(255,255,255,0.87)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2}>
            <Alert
              severity="info"
              icon={<VisibilityIcon />}
              sx={{
                bgcolor: 'rgba(0,212,255,0.08)',
                border: '1px solid rgba(0,212,255,0.22)',
                color: '#fff',
                '& .MuiAlert-icon': { color: '#00d4ff' },
              }}
            >
              Prosjektet er opprettet. Her kan du redigere mottaker, emne, e-postinnhold og hvor lenge klienten skal ha tilgang før The Role Room sender invitasjonen fra systemet.
            </Alert>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Mottaker navn"
                value={clientInviteRecipientName}
                onChange={(event) => {
                  setClientInviteRecipientName(event.target.value);
                }}
                fullWidth
                helperText="Navnet brukes i hilsen og i klientportalen."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                    '&.Mui-focused fieldset': { borderColor: '#00d4ff' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.66)' },
                }}
              />
              <TextField
                label="Mottaker e-post"
                value={clientInviteRecipientEmail}
                onChange={(event) => {
                  setClientInviteRecipientEmail(event.target.value);
                }}
                type="email"
                fullWidth
                helperText={clientInviteEmailIsValid
                  ? 'Denne adressen brukes for magic-linken som sendes til klienten.'
                  : 'Legg inn en gyldig e-postadresse for å generere magic-link.'}
                error={Boolean(clientInviteRecipientEmail) && !clientInviteEmailIsValid}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                    '&.Mui-focused fieldset': { borderColor: '#00d4ff' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.66)' },
                }}
              />
            </Stack>

            <TextField
              label="Emne"
              value={clientInviteSubjectDraft}
              onChange={(event) => {
                setClientInviteSubjectDraft(event.target.value);
              }}
              fullWidth
              helperText={`Du kan bruke tokens som ${CLIENT_INVITE_TEMPLATE_TOKENS.slice(0, 4).join(', ')}`}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.66)' },
              }}
            />

            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.75)' }}>Klienttilgang</InputLabel>
              <Select
                value={clientInviteAccessDuration}
                label="Klienttilgang"
                onChange={(event) => {
                  setClientInviteAccessDuration(event.target.value as RoleRoomClientInviteAccessDuration);
                }}
                MenuProps={selectMenuProps}
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00d4ff' },
                }}
              >
                <MenuItem value="forever">For alltid</MenuItem>
                <MenuItem value="project_end">Til prosjekt slutt</MenuItem>
              </Select>
              <Typography variant="caption" sx={{ mt: 1, color: 'rgba(255,255,255,0.66)' }}>
                {clientInviteAccessDuration === 'project_end'
                  ? (resolveClientInviteAccessEndLabel()
                    ? `Klienttilgangen stopper når prosjektet avsluttes ${resolveClientInviteAccessEndLabel()}.`
                    : 'Prosjektet må ha en sluttdato før du kan sende tilgang til prosjektets slutt.')
                  : 'Klienttilgangen blir stående til du endrer eller fjerner den senere.'}
              </Typography>
            </FormControl>

            <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <CardContent>
                <Stack spacing={1.25}>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Til
                    </Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                      {clientInviteRecipientEmail || 'Mangler klient-e-post'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Emne
                    </Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                      {clientInviteSubject}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Magic-link
                    </Typography>
                    <Typography sx={{ color: '#93c5fd', wordBreak: 'break-all', fontSize: '0.86rem' }}>
                      {clientInviteLoading
                        ? 'Genererer magic-link…'
                        : clientInviteUrl || 'Magic-link genereres når du kopierer eller sender invitasjonen'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Tilgang
                    </Typography>
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                      {clientInviteAccessDuration === 'project_end'
                        ? `Til prosjekt slutt${resolveClientInviteAccessEndLabel() ? ` (${resolveClientInviteAccessEndLabel()})` : ''}`
                        : 'For alltid'}
                    </Typography>
                  </Box>
                  {generatedClientInvite?.delivery ? (
                    <Alert
                      severity={generatedClientInvite.delivery.sent ? 'success' : 'warning'}
                      sx={{
                        bgcolor: generatedClientInvite.delivery.sent ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                        border: `1px solid ${generatedClientInvite.delivery.sent ? 'rgba(34,197,94,0.24)' : 'rgba(245,158,11,0.24)'}`,
                        color: '#fff',
                      }}
                    >
                      {generatedClientInvite.delivery.sent
                        ? 'Invitasjonen er sendt fra systemet.'
                        : 'Invitasjonen er opprettet, men ble ikke sendt automatisk. Du kan fortsatt kopiere tekst eller magic-link.'}
                    </Alert>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            <TextField
              label="Invitasjonstekst"
              value={clientInviteBodyDraft}
              multiline
              minRows={12}
              fullWidth
              onChange={(event) => {
                setClientInviteBodyDraft(event.target.value);
              }}
              helperText={`Støttede tokens: ${CLIENT_INVITE_TEMPLATE_TOKENS.join(', ')}`}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  alignItems: 'flex-start',
                  fontFamily: 'inherit',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.66)' },
              }}
            />

            <TextField
              label="Forhåndsvisning"
              value={clientInviteBody}
              multiline
              minRows={10}
              fullWidth
              InputProps={{ readOnly: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#cbd5f5',
                  alignItems: 'flex-start',
                  fontFamily: 'inherit',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            p: { xs: 2, sm: 2.5 },
            gap: 1,
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            justifyContent: { xs: 'stretch', sm: 'space-between' },
          }}
        >
          <Button
            onClick={completeProjectCreatedFlow}
            fullWidth={isMobile}
            sx={{ color: 'rgba(255,255,255,0.87)', minHeight: TOUCH_TARGET_SIZE }}
          >
            Fortsett uten å sende
          </Button>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => { void handleCopyClientPortalUrl(); }}
              disabled={clientInviteLoading || !canPrepareClientInvite}
              fullWidth={isMobile}
              sx={{ minHeight: TOUCH_TARGET_SIZE, textTransform: 'none', fontWeight: 700 }}
            >
              {clientInviteLoading ? 'Genererer…' : 'Kopier magic-link'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => { void handleCopyClientInvite(); }}
              disabled={clientInviteLoading || !canPrepareClientInvite}
              fullWidth={isMobile}
              sx={{ minHeight: TOUCH_TARGET_SIZE, textTransform: 'none', fontWeight: 700 }}
            >
              Kopier invitasjon
            </Button>
            <Button
              variant="contained"
                startIcon={<MailOutlineIcon />}
                onClick={() => {
                void handleSendClientInviteEmail().then((sent) => {
                  if (sent) {
                    completeProjectCreatedFlow();
                  }
                });
              }}
              disabled={!canPrepareClientInvite || clientInviteLoading}
              fullWidth={isMobile}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: '#00d4ff',
                color: '#000',
                '&:hover': { bgcolor: '#00b8e6' },
              }}
            >
              {clientInviteLoading ? 'Sender…' : 'Send e-post'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>


      {/* Success Snackbar */}

      {/* Demo Init Status Dialog */}
      <Dialog open={trollInitDialogOpen} onClose={() => setTrollInitDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SvgIcon sx={{ color: '#9c27b0' }}><InterpreterModeIcon /></SvgIcon>
          {isContentProducerSession ? 'Innholdsprodusent-initialisering' : 'TROLL Initialisering'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {trollInitStatus === 'loading' ? 'Laster inn demo-data...' : 
               trollInitStatus === 'complete' ? 'Demo-data er lastet inn!' :
               trollInitStatus === 'error' ? `Feil: ${trollInitError || 'Ukjent feil'}` :
               'Klar til å laste demo-data'}
            </Typography>
            {trollInitStatus === 'loading' && <CircularProgress size={24} />}
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
              <Tooltip title="Story Arc">
                <span><StoryArcIcon sx={{ fontSize: 20, color: '#e91e63' }} /></span>
              </Tooltip>
              <Tooltip title="Kamera">
                <span><CameraIcon sx={{ fontSize: 20, color: '#00d4ff' }} /></span>
              </Tooltip>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTrollInitDialogOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSuccessMessage(null)}
          severity="success"
          variant="filled"
          icon={<CheckCircleIcon />}
          sx={{
            width: '100%',
            bgcolor: '#10b981',
            color: '#fff',
            fontWeight: 600,
            '& .MuiAlert-icon': {
              color: '#fff',
            },
          }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
