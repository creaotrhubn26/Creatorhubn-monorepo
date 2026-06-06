/**
 * CreatorHub Norge - Resume Builder
 * Advanced CV builder for Norwegian professionals
 * Features: AI assistance, ATS optimization, Norwegian job tracking, project integration
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useLinkedIn } from '@/hooks/useLinkedIn';
import { linkedInToResumeData } from '@/utils/linkedin-data-extractor';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import CreatorHubMarketplace from './ResumeBuilderMarketplace';
import {
  RESUME_TEMPLATE_SEED_DATA,
  RESUME_COLOR_SCHEMES,
  RESUME_TEMPLATES,
  ModernATSTemplate,
} from './templates/ResumeTemplates';
import NextRoleStatsBanner from './NextRoleStatsBanner';
import NextRoleTrialBanner from './NextRoleTrialBanner';
import NextRoleSalaryBanner from './NextRoleSalaryBanner';
import NextRoleUpsellModal, { UpsellFeature } from './NextRoleUpsellModal';
import NextRoleOnboardingTour from './NextRoleOnboardingTour';
const NextRoleCoverLetterLibrary = React.lazy(() => import('./NextRoleCoverLetterLibrary'));
// Lazy-load tunge Pro-feature-dialoger. De er sjeldent åpnet og laster
// inn ekstra kode (Claude-chat-UI, share-API, etc.) som vi ikke vil
// inkludere i initial-bundle. Reduserer Time-to-Interactive på mobil.
const NextRoleMockInterview = React.lazy(() => import('./NextRoleMockInterview'));
const NextRoleReferralDialog = React.lazy(() => import('./NextRoleReferralDialog'));
const NextRoleVideoPresentation = React.lazy(() => import('./NextRoleVideoPresentation'));
const NextRoleGdprDialog = React.lazy(() => import('./NextRoleGdprDialog'));
const IndustryTemplatePicker = React.lazy(() => import('./IndustryTemplatePicker'));
const ArbeidsplassenImportDialog = React.lazy(() => import('./ArbeidsplassenImportDialog'));
const PublicCvAnalyticsDialog = React.lazy(() => import('./PublicCvAnalyticsDialog'));
const EducationVerificationDialog = React.lazy(() => import('./EducationVerificationDialog'));
const SigridCareerMentor = React.lazy(() => import('./SigridCareerMentor'));
const JobApplicationKanban = React.lazy(() => import('./JobApplicationKanban'));
const JobApplicationMilestonesDialog = React.lazy(() => import('./JobApplicationMilestonesDialog'));
import UpcomingDeadlinesWidget from './UpcomingDeadlinesWidget';
import { useNextRoleEntitlements } from '@/hooks/useNextRoleEntitlements';
import {
  TermsAndConditionsDialog,
  PrivacyPolicyDialog,
  CookieConsentDialog,
  DataManagementDialog,
} from './LegalCompliance';
import { HelpGuideDialog, HelpButton, ContextualHelp } from './HelpGuide';
import { GDPRUtils, AccessibilityUtils, WCAGChecklist } from '@/utils/wcag-gdpr-compliance';
import type { AutoSaveData } from '@/utils/autoSaveManager';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import '../../types/google';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Badge,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Checkbox,
  Avatar,
  CircularProgress,
  Autocomplete,
  Snackbar,
  Link,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  AutoAwesome as AIIcon,
  AutoAwesome,
  Spellcheck,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Work as WorkIcon,
  School as EducationIcon,
  Star as SkillIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Share as ShareIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Save as SaveIcon,
  ContentCopy as CopyIcon,
  TrendingUp as TrendingUpIcon,
  Description as TemplateIcon,
  CloudUpload as UploadIcon,
  History as HistoryIcon,
  LinkedIn as LinkedInIcon,
  Folder as FolderIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  InsertDriveFile as FileIcon,
  Error as ErrorIcon,
  Restore as RestoreIcon,
  Publish as PublishIcon,
  Alarm as AlarmIcon,
  GpsFixed as GpsFixedIcon,
  Cancel as CancelIcon,
  ErrorOutline as ErrorOutlineIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  CardGiftcard as CardGiftcardIcon,
  WorkOutline as WorkOutlineIcon,
  Close as CloseIcon,
  Videocam as VideocamIcon,
  Lightbulb as LightbulbIcon,
  Public as PublicIcon,
  VerifiedUser as VerifiedIcon,
} from '@mui/icons-material';

// ============================================================================
// INTERFACES
// ============================================================================

interface Resume {
  id: string;
  userId: string;
  title: string;
  slug: string;
  publicViewCount?: number;
  personalInfo: {
    fullName: string;
    email: string;
    phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
    profilePhoto?: string;
    professionalTitle?: string;
    summary?: string;
  };
  templateId: string;
  colorScheme: string;
  atsScore: number;
  atsOptimized: boolean;
  keywords: string[];
  targetJobTitle?: string;
  targetIndustry?: string;
  status: 'draft' | 'active' | 'archived';
  isPublic: boolean;
  publicUrl?: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  experiences?: ResumeExperience[];
  education?: ResumeEducation[];
  skills?: ResumeSkill[];
  certifications?: ResumeCertification[];
  projects?: ResumeProject[];
  languages?: ResumeLanguage[];
}

interface ExperienceGroup {
  category?: string;
  items: string[];
}

interface ResumeExperience {
  id: string;
  resumeId: string;
  jobTitle: string;
  company: string;
  location?: string;
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'self-employed' | 'internship';
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description?: string;
  achievements: string[];
  // Strukturerte sub-roller under én jobb (Produsent: / Regissør: / Fotograf:
  // som i en typisk daglig-leder-stilling). Hvis tom/undefined brukes
  // `achievements` som flat liste i stedet.
  experienceGroups?: ExperienceGroup[];
  skills: string[];
  projectId?: string;
  autoGenerated: boolean;
  displayOrder: number;
  isVisible: boolean;
}

interface ResumeLanguage {
  id: string;
  resumeId: string;
  name: string;
  proficiencyLevel: number; // 0-100 for progress-bar
  levelLabel?: string; // 'Morsmål', 'Flytende', 'God', 'Grunnleggende'
  isNative?: boolean;
  displayOrder: number;
  isVisible: boolean;
}

interface ResumeEducation {
  id: string;
  resumeId: string;
  degree: string;
  fieldOfStudy?: string;
  institution: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  grade?: string;
  description?: string;
  achievements: string[];
  displayOrder: number;
  isVisible: boolean;
}

interface ResumeSkill {
  id: string;
  resumeId: string;
  name: string;
  category?: string;
  proficiencyLevel: number;
  yearsOfExperience?: number;
  isEndorsed: boolean;
  displayOrder: number;
  isVisible: boolean;
}

interface ResumeCertification {
  id: string;
  resumeId: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  description?: string;
  displayOrder: number;
  isVisible: boolean;
}

interface ResumeProject {
  id: string;
  resumeId: string;
  title: string;
  description?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  technologies: string[];
  achievements: string[];
  projectUrl?: string;
  images: string[];
  projectId?: string;
  autoGenerated: boolean;
  displayOrder: number;
  isVisible: boolean;
}

interface ResumeTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  atsScore: number;
  isAtsOptimized: boolean;
  layout: 'single-column' | 'two-column' | 'modern-split';
  previewImage?: string;
  isPremium: boolean;
}

interface JobApplication {
  id: string;
  userId: string;
  resumeId?: string;
  jobTitle: string;
  company: string;
  location?: string;
  jobUrl?: string;
  source?: string;
  applicantType?: 'internship' | 'trainee' | 'full-time' | 'part-time' | 'contract' | 'freelance' | 'temporary';
  status: 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'accepted' | 'withdrawn';
  appliedDate?: string;
  deadline?: string;
  interviewDate?: string;
  interviewPreparation?: {
    commonQuestions?: string[];
    questionsToAsk?: string[];
    keyPoints?: string[];
    completed?: boolean;
  };
  notes?: string;
  coverLetter?: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
}

interface GoogleDriveLink {
  id: string;
  name: string;
  url: string;
  type: 'pdf' | 'image' | 'video' | 'document' | 'folder' | 'other';
  size?: string;
  lastModified?: string;
}

interface PortfolioItem {
  id?: string;
  resumeId?: string;
  title: string;
  description: string;
  category: 'project' | 'design' | 'documentation' | 'presentation' | 'other';
  technologies?: string[];
  googleDriveLinks?: GoogleDriveLink[];
  isPublic: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ResumeBuilder() {
  const { user } = useAuth();
  // NextRole entitlements + upsell-modal state
  const ent = useNextRoleEntitlements();
  const [upsellFeature, setUpsellFeature] = useState<UpsellFeature | null>(null);
  // Helper: returnerer true hvis brukeren har lov å fortsette, ellers
  // åpner upsell-modal og returnerer false. Use inside handler-start.
  const requireEntitlement = useCallback(
    (check: keyof typeof ent, feature: UpsellFeature): boolean => {
      if (ent[check]) return true;
      setUpsellFeature(feature);
      return false;
    },
    [ent],
  );
  const queryClient = useQueryClient();
  const { auth, features, analytics } = useEnhancedMasterIntegration();
  const linkedIn = useLinkedIn();

  // Feature access checks
  const googleDriveAccess = features?.checkFeatureAccess('google-drive-integration');
  const portfolioAccess = features?.checkFeatureAccess('portfolio-management');

  // State Management
  const [activeStep, setActiveStep] = useState(0);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showProjectImportDialog, setShowProjectImportDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [aiJobDescription, setAiJobDescription] = useState('');
  const [showSkillDialog, setShowSkillDialog] = useState(false);
  const [skillFormData, setSkillFormData] = useState<{ name: string; category: string; proficiencyLevel: number }>({
    name: '',
    category: '',
    proficiencyLevel: 3,
  });
  // Språk-tab (lagt til i v0129) — egen tabell på backend, persisterer
  // via /api/resumes/:id/languages dedikerte CRUD-endepunkter (ulikt
  // skills/cert/education som inntil videre kun lagres i client-state).
  const [photoUploading, setPhotoUploading] = useState(false);
  // CV-import (PDF/DOCX → Claude). Vises som egen knapp på CV-listen.
  const [showCvImportDialog, setShowCvImportDialog] = useState(false);
  const [cvImporting, setCvImporting] = useState(false);
  const [cvImportStatus, setCvImportStatus] = useState<string>('');
  // CV-helse-score — kombinert tall (0-100) basert på:
  //   • ATS-score (40%) — kommer fra AI-analyse, finnes på resume
  //   • Komplethet (40%) — andel utfylte seksjoner og felter
  //   • Grammatikk (20%) — siste AI-grammar-score (eller 80 som default)
  const cvHealthScore = useMemo(() => {
    if (!selectedResume) return { total: 0, ats: 0, completeness: 0, grammar: 0, breakdown: [] as string[] };
    const ats = Math.max(0, Math.min(100, selectedResume.atsScore ?? 0));

    // Komplethet — hver sjekk gir 1 poeng, normaliserer til 0-100
    const checks: Array<{ ok: boolean; label: string }> = [
      { ok: !!selectedResume.personalInfo?.fullName?.trim(), label: 'Fullt navn' },
      { ok: !!selectedResume.personalInfo?.email?.trim(), label: 'E-post' },
      { ok: !!selectedResume.personalInfo?.phone?.trim(), label: 'Telefon' },
      { ok: !!selectedResume.personalInfo?.location?.trim(), label: 'Sted' },
      { ok: !!selectedResume.personalInfo?.summary?.trim(), label: 'Profilsammendrag' },
      { ok: !!selectedResume.personalInfo?.profilePhoto, label: 'Profilbilde' },
      { ok: (selectedResume.experiences?.length ?? 0) > 0, label: 'Min. én arbeidserfaring' },
      { ok: (selectedResume.experiences?.length ?? 0) >= 2, label: 'To+ arbeidserfaringer' },
      { ok: (selectedResume.education?.length ?? 0) > 0, label: 'Utdanning' },
      { ok: (selectedResume.skills?.length ?? 0) >= 5, label: '5+ ferdigheter' },
      { ok: (selectedResume.certifications?.length ?? 0) > 0, label: 'Sertifisering' },
      { ok: (selectedResume.languages?.length ?? 0) > 0, label: 'Språk' },
      { ok: (selectedResume.personalInfo?.linkedin ?? '').length > 0, label: 'LinkedIn-lenke' },
    ];
    const completed = checks.filter((c) => c.ok).length;
    const completeness = Math.round((completed / checks.length) * 100);
    const missing = checks.filter((c) => !c.ok).map((c) => c.label);
    const grammar = 80; // default — overstyres når AI-grammar-analyse er kjørt
    const total = Math.round(ats * 0.4 + completeness * 0.4 + grammar * 0.2);
    return { total, ats, completeness, grammar, breakdown: missing };
  }, [selectedResume]);

  // Live preview-panel — kan skjules på smale skjermer. Lagres i
  // localStorage så preferansen overlever refresh.
  // På mobil starter live-preview AV — det er en tung render som tar
  // halve skjermen og sliter ut svake enheter. Bruker kan slå på selv.
  const isMobileViewport =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 899.95px)').matches
      : false;
  const [showLivePreview, setShowLivePreview] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('resumeBuilder:showLivePreview');
    // Hvis brukeren ikke har eksplisitt valgt: default false på mobil, true ellers
    if (stored === null) return !isMobileViewport;
    return stored === 'true';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('resumeBuilder:showLivePreview', String(showLivePreview));
    }
  }, [showLivePreview]);
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<ResumeLanguage | null>(null);
  const [languageFormData, setLanguageFormData] = useState<{
    name: string;
    proficiencyLevel: number;
    levelLabel: string;
    isNative: boolean;
  }>({
    name: '',
    proficiencyLevel: 80,
    levelLabel: 'Flytende',
    isNative: false,
  });

  // Erfaring-dialog (v0129) — første "ekte" CRUD for arbeidserfaring i
  // ResumeBuilder. Støtter både flat achievements-liste OG grupperte
  // under-roller (Produsent: / Regissør: / Fotograf:). useGroups-toggle
  // styrer hvilken modus dialogen renderes i.
  const [showExperienceDialog, setShowExperienceDialog] = useState(false);
  const [editingExperience, setEditingExperience] = useState<ResumeExperience | null>(null);
  const [experienceFormData, setExperienceFormData] = useState<{
    jobTitle: string;
    company: string;
    location: string;
    employmentType: ResumeExperience['employmentType'] | '';
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    description: string;
    useGroups: boolean;
    achievements: string;
    experienceGroups: ExperienceGroup[];
  }>({
    jobTitle: '',
    company: '',
    location: '',
    employmentType: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: '',
    useGroups: false,
    achievements: '',
    experienceGroups: [],
  });
  const [resumeSearch, setResumeSearch] = useState('');
  const [resumeStatusFilter, setResumeStatusFilter] = useState<'all' | Resume['status']>('all');
  const [resumeSort, setResumeSort] = useState<'updated' | 'created' | 'title'>('updated');
  
  // Portfolio state
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [showPortfolioDialog, setShowPortfolioDialog] = useState(false);
  const [editingPortfolioItem, setEditingPortfolioItem] = useState<PortfolioItem | null>(null);
  const [portfolioFormData, setPortfolioFormData] = useState<Partial<PortfolioItem>>({
    title: '',
    description: '',
    category: 'project',
    technologies: [],
    googleDriveLinks: [],
    isPublic: true,
  });

  // Education state
  const [showEducationDialog, setShowEducationDialog] = useState(false);
  const [editingEducationItem, setEditingEducationItem] = useState<ResumeEducation | null>(null);
  const [educationFormData, setEducationFormData] = useState<Partial<ResumeEducation>>({
    degree: '',
    fieldOfStudy: '',
    institution: '',
    location: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    grade: '',
    description: '',
    achievements: [],
    displayOrder: 1,
    isVisible: true,
  });

  // Vitnemalsportalen state
  const [showVitnemalsportalenDialog, setShowVitnemalsportalenDialog] = useState(false);
  const [vitnemalsportalenInstructions, setVitnemalsportalenInstructions] = useState(true);

  // Certification state
  const [showCertificationDialog, setShowCertificationDialog] = useState(false);
  const [editingCertificationItem, setEditingCertificationItem] = useState<ResumeCertification | null>(null);
  const [certificationFormData, setCertificationFormData] = useState<Partial<ResumeCertification>>({
    name: '',
    issuer: '',
    issueDate: '',
    expiryDate: '',
    credentialId: '',
    credentialUrl: '',
    description: '',
    displayOrder: 1,
    isVisible: true,
  });

  // Job application tracking state
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([]);
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [editingJobApplication, setEditingJobApplication] = useState<JobApplication | null>(null);
  const [jobFormData, setJobFormData] = useState<Partial<JobApplication>>({
    jobTitle: '',
    company: '',
    location: '',
    jobUrl: '',
    source: '',
    status: 'saved',
    appliedDate: '',
    deadline: '',
    interviewDate: '',
    notes: '',
    coverLetter: '',
    priority: 'medium',
    tags: [],
  });
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState<'all' | JobApplication['status']>('all');

  // Legal & GDPR Compliance state
  const [showTermsDialog, setShowTermsDialog] = useState(!GDPRUtils.hasAcceptedTerms());
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showCookieConsent, setShowCookieConsent] = useState(!GDPRUtils.getConsent().essential);
  const [showDataManagement, setShowDataManagement] = useState(false);

  // Help & Guidance state
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  // AI generation fields
  const [aiJobTitle, setAiJobTitle] = useState('');
  const [aiCompany, setAiCompany] = useState('');
  const [aiSkills, setAiSkills] = useState<string[]>([]);
  const [aiExperience, setAiExperience] = useState('');

  // Draft and versioning state
  const [isDraft, setIsDraft] = useState(true);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error' | 'pending'>('saved');
  const [confirmDeleteResumeId, setConfirmDeleteResumeId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'warning' | 'error' }>({ open: false, message: '', severity: 'info' });

  // Sentralisert feilhåndtering for mutations. Tidligere: hver feil ble
  // bare console.error'et og brukeren så ingenting. Nå: vis tydelig
  // norsk feilmelding i snackbar + behold console-loggen for debugging.
  const showMutationError = useCallback((context: string) => (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    const friendly = msg.includes('401')
      ? 'Du må være innlogget for å gjøre dette.'
      : msg.includes('404')
      ? 'Ressursen ble ikke funnet.'
      : msg.includes('503') || msg.toLowerCase().includes('anthropic')
      ? 'AI-tjenesten er ikke tilgjengelig akkurat nå. Prøv igjen om litt.'
      : `${context}: ${msg.replace(/^\d+:\s*/, '')}`;
    console.error(context, err);
    setSnackbar({ open: true, severity: 'error', message: friendly });
  }, []);
  const [initializingResume, setInitializingResume] = useState(false);
  const [initializationMessage, setInitializationMessage] = useState('');
  const initializationRef = useRef(false);
  const [initializationStep, setInitializationStep] = useState(0);
  const initializationSteps = useMemo(
    () => [
      'Starter og sjekker tilgang',
      'Samler brukerinfo',
      'Oppretter CV',
      'Henter prosjekter',
      'Finpusser profilen',
      'Klar til bruk',
    ],
    [],
  );
  const motivationalMessages = useMemo(
    () => [
      'Du er nesten i gang',
      'Vi bygger en CV som skiller seg ut',
      'Snart klar for neste mulighet',
      'Litt magi pågår i bakgrunnen',
    ],
    [],
  );

  // Fallback til full seed-listen i ResumeTemplates.tsx slik at alle 15
  // templates synes hvis backend ikke returnerer noe (eller mangler nyere
  // seed). Kun de basale feltene som dialog-en bruker er nødvendige.
  const resumeTemplates = useMemo<ResumeTemplate[]>(
    () => RESUME_TEMPLATE_SEED_DATA.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      atsScore: t.atsScore,
      isAtsOptimized: t.isAtsOptimized,
      layout: t.layout,
      previewImage: t.previewImage,
      isPremium: t.isPremium,
    })),
    [],
  );
  // (Disablet hardkodet liste — beholdt referansen for evt. fallback)
  const _legacyResumeTemplates = useMemo<ResumeTemplate[]>(
    () => [
      {
        id: 'modern-ats-legacy',
        name: 'Modern ATS',
        description: 'ATS-optimalisert layout med klar hierarki',
        category: 'professional',
        atsScore: 92,
        isAtsOptimized: true,
        layout: 'single-column',
        previewImage: undefined,
        isPremium: false,
      },
      {
        id: 'two-column-executive',
        name: 'Executive Split',
        description: 'To-kolonners oppsett for ledere',
        category: 'executive',
        atsScore: 85,
        isAtsOptimized: true,
        layout: 'two-column',
        previewImage: undefined,
        isPremium: true,
      },
      {
        id: 'modern-creative',
        name: 'Creative Modern',
        description: 'Kreativ layout med tydelige seksjoner',
        category: 'creative',
        atsScore: 78,
        isAtsOptimized: false,
        layout: 'modern-split',
        previewImage: undefined,
        isPremium: false,
      },
      {
        id: 'clean-minimal',
        name: 'Clean Minimal',
        description: 'Minimalistisk og elegant utseende',
        category: 'minimal',
        atsScore: 88,
        isAtsOptimized: true,
        layout: 'single-column',
        previewImage: undefined,
        isPremium: false,
      },
    ],
    [],
  );

  const filteredJobApplications = useMemo(() => {
    const normalizedSearch = jobSearch.trim().toLowerCase();
    return jobApplications.filter((job) => {
      const matchesSearch = !normalizedSearch
        || job.jobTitle.toLowerCase().includes(normalizedSearch)
        || job.company.toLowerCase().includes(normalizedSearch)
        || job.tags.join(' ').toLowerCase().includes(normalizedSearch);
      const matchesStatus = jobStatusFilter === 'all' || job.status === jobStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobApplications, jobSearch, jobStatusFilter]);

  const atsTips = useMemo(() => {
    if (!selectedResume) return [] as string[];
    const tips: string[] = [];
    if (!selectedResume.personalInfo?.summary) {
      tips.push('Legg til et profesjonelt sammendrag for bedre ATS-score.');
    }
    if (!selectedResume.experiences?.length) {
      tips.push('Legg til arbeidserfaring for å styrke CV-en.');
    }
    if (!selectedResume.skills?.length) {
      tips.push('Oppgi relevante ferdigheter for å forbedre keyword-match.');
    }
    if (!selectedResume.education?.length) {
      tips.push('Legg til utdanning for en komplett profil.');
    }
    if (!selectedResume.certifications?.length) {
      tips.push('Legg til sertifiseringer for ekstra kredibilitet.');
    }
    return tips;
  }, [selectedResume]);

  const publicResumeUrl = useMemo(() => {
    if (!selectedResume) return '';
    if (selectedResume.publicUrl) return selectedResume.publicUrl;
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/resume/${selectedResume.slug}`;
  }, [selectedResume]);

  const handleAutoSaveDataSaved = useCallback((data: AutoSaveData) => {
    setAutoSaveStatus('saved');
    analytics.trackEvent('resume_autosaved', {
      userId: user?.id,
      resumeId: selectedResume?.id,
      dataType: data.type,
    });
    console.log('[SUCCESS] Resume auto-saved: ', data);
  }, [analytics, user?.id, selectedResume?.id]);

  const handleAutoSaveDataQueued = useCallback(() => {
    setAutoSaveStatus('pending');
  }, []);

  const handleAutoSaveError = useCallback((error: string) => {
    setAutoSaveStatus('error');
    console.error('[ERROR] Auto-save error: ', error);
  }, []);

  const handleAutoSaveInitialized = useCallback(() => {
    console.log('[INFO] Auto-save initialized for Resume Builder');
  }, []);

  const autoSaveOptions = useMemo(() => ({
    config: {
      enableAutoSave: true,
      debounceDelay: 2000,
      maxRetries: 3,
      retryDelay: 1000,
    },
    onDataSaved: handleAutoSaveDataSaved,
    onDataQueued: handleAutoSaveDataQueued,
    onError: handleAutoSaveError,
    onInitialized: handleAutoSaveInitialized,
  }), [
    handleAutoSaveDataSaved,
    handleAutoSaveDataQueued,
    handleAutoSaveError,
    handleAutoSaveInitialized,
  ]);

  const {
    save: autoSaveSave,
    forceSave: autoSaveForceSave,
    restoreFromBackup: autoSaveRestoreFromBackup,
  } = useAutoSave(autoSaveOptions);

  useEffect(() => {
    if (!user?.id) return;
    const storageKey = `resume_job_applications_${user.id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setJobApplications(JSON.parse(stored));
      } catch (error) {
        console.warn('Unable to parse job applications from storage:', error);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const storageKey = `resume_job_applications_${user.id}`;
    localStorage.setItem(storageKey, JSON.stringify(jobApplications));
  }, [jobApplications, user?.id]);

  // Handle EMREX callback with ELMO data from vitnemalsportalen
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const elmoData = urlParams.get('elmo') || urlParams.get('data');
    
    if (elmoData) {
      try {
        // Decode if base64 encoded
        let xmlData = elmoData;
        try {
          xmlData = atob(elmoData);
        } catch (_decodeError) {
          // Not base64, use as is
        }
        
        // Parse and import the ELMO XML data
        handleVitnemalsportalenDataImport(xmlData);
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        setSnackbar({
          open: true,
          message: 'Utdanningsdata mottatt fra Vitnemålsportalen!',
          severity: 'success'
        });
      } catch (error) {
        console.error('Failed to process EMREX callback:', error);
        setSnackbar({
          open: true,
          message: 'Kunne ikke motta data fra Vitnemålsportalen',
          severity: 'error'
        });
      }
    }
  }, []);

  // Google Drive integration functions
  const handleGoogleDriveFilePicker = useCallback(async () => {
    // Check feature access
    if (!googleDriveAccess.hasAccess) {
      console.warn('Google Drive integration not available:', googleDriveAccess.reason);
      setSnackbar({ open: true, message: 'Google Drive-integrasjon er ikke tilgjengelig: ' + googleDriveAccess.reason, severity: 'warning' });
      return;
    }

    try {
      // Track feature usage
      features.trackFeatureUsage('google-drive-integration', 'file_picker_opened');
      analytics.trackEvent('google_drive_picker_opened', { userId: user?.id });

      if (!auth.state.isAuthenticated) {
        await auth.login();
        return;
      }

      const googleClient = await auth.getAuthenticatedClient(['https://www.googleapis.com/auth/drive.readonly']);
      
      // Initialize Google Drive API picker
      if (window.google && window.google.picker) {
        const picker = new (window as any).google.picker.PickerBuilder()
          .addView((window as any).google.picker.ViewId.DOCS)
          .addView((window as any).google.picker.ViewId.SPREADSHEETS)
          .addView((window as any).google.picker.ViewId.PRESENTATIONS)
          .addView((window as any).google.picker.ViewId.PDFS)
          .addView((window as any).google.picker.ViewId.IMAGES)
          .addView((window as any).google.picker.ViewId.VIDEOS)
          .setOAuthToken(googleClient.getToken().access_token)
          .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
          .setCallback(handleGoogleDriveFilesSelected)
          .build();
        
        picker.setVisible(true);
      } else {
        console.error('Google Picker API not loaded');
        // Fallback: manual URL input
        const url = prompt('Please enter the Google Drive file URL:');
        if (url) {
          handleManualGoogleDriveLink(url);
        }
      }
    } catch (error) {
      console.error('Google Drive picker error:', error);
      // Fallback to manual URL input
      const url = prompt('Please enter the Google Drive file URL:');
      if (url) {
        handleManualGoogleDriveLink(url);
      }
    }
  }, [auth]);

  const handleGoogleDriveFilesSelected = useCallback((data: any) => {
    if (data.action === (window as any).google.picker.Action.PICKED) {
      const files = data.docs;
      const newLinks: GoogleDriveLink[] = files.map((file: any) => ({
        id: file.id,
        name: file.name,
        url: file.url,
        type: getFileTypeFromMimeType(file.mimeType),
        size: formatFileSize(file.sizeBytes),
        lastModified: new Date(file.lastEditedUtc).toLocaleDateString(),
      }));

      setPortfolioFormData(prev => ({
        ...prev,
        googleDriveLinks: [...(prev.googleDriveLinks || []), ...newLinks]
      }));

      // Track successful file selection
      features.trackFeatureUsage('google-drive-integration','files_selected', { fileCount: files.length });
      analytics.trackEvent('google_drive_files_selected', { 
        userId: user?.id,
        fileCount: files.length,
        fileTypes: files.map((f: any) => getFileTypeFromMimeType(f.mimeType))
      });
    }
  }, [features, analytics, user]);

  const handleManualGoogleDriveLink = useCallback((url: string) => {
    const link: GoogleDriveLink = {
      id: `manual_${Date.now()}`,
      name: 'Manual Link',
      url: url,
      type: 'other',
    };

    setPortfolioFormData(prev => ({
      ...prev,
      googleDriveLinks: [...(prev.googleDriveLinks || []), link]
    }));
  }, []);

  const handleImportFromFinnNo = useCallback(async () => {
    const url = jobFormData.jobUrl;
    if (!url || !url.includes('finn.no')) {
      setSnackbar({ open: true, message: 'Vennligst lim inn en gyldig finn.no jobb-URL', severity: 'warning' });
      return;
    }

    // Parse finn.no URL to extract job details
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      
      // Extract finn code (job ID) from URL
      // finn.no format: /job/ad/447237578 or /job/full-time/ad.html?finnkode=123456
      let finnCode = '';
      let jobTitle = jobFormData.jobTitle;
      
      // Check if it's the newer format /job/ad/{id}
      if (pathParts[0] === 'job' && pathParts[1] === 'ad' && pathParts[2]) {
        finnCode = pathParts[2];
      } else {
        // Check for finnkode parameter in older format
        const finnCodeParam = urlObj.searchParams.get('finnkode');
        if (finnCodeParam) {
          finnCode = finnCodeParam;
        }
      }

      // Attempt to fetch job details from finn.no
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const html = await response.text();
        
        // Parse HTML to extract job title and company
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Try to find job title (finn.no uses h1 for job titles)
        const titleElement = doc.querySelector('h1');
        if (titleElement && !jobTitle) {
          jobTitle = titleElement.textContent?.trim() || '';
        }
        
        // Try to find company name
        const companyElement = doc.querySelector('[data-testid="company-name"]') || 
                               doc.querySelector('.company-name') ||
                               doc.querySelector('a[href*="/company/"]');
        const company = companyElement?.textContent?.trim() || jobFormData.company;
        
        // Try to find location
        const locationElement = doc.querySelector('[data-testid="location"]') ||
                                doc.querySelector('.location');
        const location = locationElement?.textContent?.trim() || jobFormData.location;

        // Extract job description for AI analysis
        const descriptionElement = doc.querySelector('[data-testid="job-description"]') ||
                                   doc.querySelector('.job-description') ||
                                   doc.querySelector('article') ||
                                   doc.querySelector('.description');
        const jobDescription = descriptionElement?.textContent?.trim() || '';

        // Extract requirements/qualifications
        const requirementsElement = doc.querySelector('[data-testid="requirements"]') ||
                                    doc.querySelector('.requirements') ||
                                    doc.querySelector('.qualifications');
        const requirements = requirementsElement?.textContent?.trim() || '';

        // Extract deadline
        const deadlineElement = doc.querySelector('[data-testid="application-deadline"]') ||
                               doc.querySelector('.deadline') ||
                               doc.querySelector('.application-due');
        let deadline = deadlineElement?.textContent?.trim() || '';
        
        // Try to parse Norwegian deadline formats
        const deadlineMatch = html.match(/søknadsfrist[:\s]+([\d./-]+)|frist[:\s]+([\d./-]+)|siste dag[:\s]+([\d./-]+)/i);
        if (deadlineMatch) {
          deadline = deadlineMatch[1] || deadlineMatch[2] || deadlineMatch[3] || deadline;
        }

        const fullJobDescription = `${jobDescription}\n\n${requirements}`.trim();

        setJobFormData((prev) => ({
          ...prev,
          jobTitle: jobTitle || prev.jobTitle || `Jobb fra finn.no ${finnCode ? `(${finnCode})` : ''}`,
          company: company || prev.company,
          location: location || prev.location,
          source: 'finn.no',
          deadline: deadline || prev.deadline,
          notes: prev.notes ? `${prev.notes}\n\nFinn-kode: ${finnCode}\n\nJobb-beskrivelse:\n${fullJobDescription.substring(0, 500)}...` : 
                             `Finn-kode: ${finnCode}\n\nJobb-beskrivelse:\n${fullJobDescription.substring(0, 500)}...`,
        }));

        // Store full job description for AI analysis
        if (fullJobDescription) {
          localStorage.setItem(`finn_job_${finnCode}`, JSON.stringify({
            finnCode,
            jobTitle: jobTitle || '',
            company: company || '',
            description: fullJobDescription,
            url,
            importedAt: new Date().toISOString(),
          }));
        }

        setSnackbar({ 
          open: true, 
          message: 'Jobb importert fra finn.no! Bruk AI-knappen for å tilpasse CV og søknadsbrev.', 
          severity: 'success' 
        });
      } catch (_fetchError) {
        // If fetch fails, just set basic info
        setJobFormData((prev) => ({
          ...prev,
          jobTitle: jobTitle || prev.jobTitle || `Jobb fra finn.no ${finnCode ? `(${finnCode})` : ''}`,
          source: 'finn.no',
          notes: prev.notes ? `${prev.notes}\n\nFinn-kode: ${finnCode}` : `Finn-kode: ${finnCode}`,
        }));

        setSnackbar({ open: true, message: 'URL lagret. Kunne ikke hente detaljer automatisk - vennligst fyll ut manuelt.', severity: 'info' });
      }
    } catch (_error) {
      setSnackbar({ open: true, message: 'Kunne ikke parse finn.no URL. Vennligst sjekk URL og prøv igjen.', severity: 'error' });
    }
  }, [jobFormData.jobUrl, jobFormData.jobTitle, jobFormData.company, jobFormData.location]);

  const handleImportFromVitnemalsportalen = useCallback(() => {
    setShowVitnemalsportalenDialog(true);
  }, []);

  const getFileTypeFromMimeType = (mimeType: string): GoogleDriveLink['type'] => {
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('video')) return 'video';
    if (mimeType.includes('document') || mimeType.includes('text')) return 'document';
    if (mimeType.includes('folder')) return 'folder';
    return 'other';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ', ' + sizes[i];
  };

  const getFileIcon = (type: GoogleDriveLink['type']) => {
    switch (type) {
      case 'pdf': return <PdfIcon />;
      case 'image': return <ImageIcon />;
      case 'video': return <VideoIcon />;
      case 'document': return <FileIcon />;
      case 'folder': return <FolderIcon />;
      default: return <FileIcon />;
    }
  };

  // Portfolio management functions
  const handleAddPortfolioItem = useCallback(() => {
    // Check feature access
    if (!portfolioAccess.hasAccess) {
      console.warn('Portfolio management not available:', portfolioAccess.reason);
      alert('Portefølje-administrasjon er ikke tilgjengelig: ' + portfolioAccess.reason);
      return;
    }

    // Track feature usage
    features.trackFeatureUsage('portfolio-management','add_portfolio_item_dialog_opened');
    analytics.trackEvent('portfolio_item_add_started', { userId: user?.id });

    setEditingPortfolioItem(null);
    setPortfolioFormData({
      title: '',
      description: '',
      category: 'project',
      technologies: [],
      googleDriveLinks: [],
      isPublic: true,
    });
    setShowPortfolioDialog(true);
  }, [portfolioAccess, features, analytics, user]);

  const handleEditPortfolioItem = useCallback((item: PortfolioItem) => {
    setEditingPortfolioItem(item);
    setPortfolioFormData(item);
    setShowPortfolioDialog(true);
  }, []);

  const normalizePortfolioItem = useCallback((data: Partial<PortfolioItem>, overrides: Partial<PortfolioItem> = {}): PortfolioItem => {
    return {
      id: data.id ?? overrides.id ?? `portfolio_${Date.now()}`,
      resumeId: data.resumeId ?? overrides.resumeId,
      title: data.title || '',
      description: data.description || '',
      category: (data.category || 'project') as PortfolioItem['category'],
      technologies: data.technologies || [],
      googleDriveLinks: data.googleDriveLinks || [],
      isPublic: data.isPublic ?? true,
      createdAt: data.createdAt ?? overrides.createdAt,
      updatedAt: data.updatedAt ?? overrides.updatedAt,
    };
  }, []);

  const handleSavePortfolioItem = useCallback(async () => {
    try {
      // Track portfolio item save
      features.trackFeatureUsage('portfolio-management','portfolio_item_saved', {
        isEdit: !!editingPortfolioItem,
        hasGoogleDriveLinks: (portfolioFormData.googleDriveLinks?.length || 0) > 0,
        category: portfolioFormData.category
      });

      analytics.trackEvent('portfolio_item_saved', {
        userId: user?.id,
        isEdit: !!editingPortfolioItem,
        itemId: editingPortfolioItem?.id || `new_${Date.now()}`,
        category: portfolioFormData.category,
        googleDriveLinksCount: portfolioFormData.googleDriveLinks?.length || 0,
        technologiesCount: portfolioFormData.technologies?.length || 0
      });

      if (editingPortfolioItem) {
        // Update existing item
        const updatedItems = portfolioItems.map(item =>
          item.id === editingPortfolioItem.id
            ? normalizePortfolioItem(
                { ...portfolioFormData, id: editingPortfolioItem.id },
                { resumeId: item.resumeId, createdAt: item.createdAt, updatedAt: new Date().toISOString() }
              )
            : item
        );
        setPortfolioItems(updatedItems);
      } else {
        // Add new item
        const newItem = normalizePortfolioItem(
          { ...portfolioFormData, resumeId: selectedResume?.id },
          { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        );
        setPortfolioItems(prev => [...prev, newItem]);
      }
      
      setShowPortfolioDialog(false);
      setEditingPortfolioItem(null);
      setPortfolioFormData({
        title: '',
        description: '',
        category: 'project',
        technologies: [],
        googleDriveLinks: [],
        isPublic: true,
      });
    } catch (error) {
      console.error('Error saving portfolio item:', error);
    }
  }, [editingPortfolioItem, portfolioFormData, portfolioItems, selectedResume, features, analytics, user, normalizePortfolioItem]);

  const handleDeletePortfolioItem = useCallback((itemId: string) => {
    setPortfolioItems(prev => prev.filter(item => item.id !== itemId));
    
    // Track deletion
    analytics.trackEvent('portfolio_item_deleted', {
      userId: user?.id,
      itemId,
    });
  }, [analytics, user]);


  // ============================================================================
  // DRAFT & VERSIONING FUNCTIONS
  // ============================================================================

  // Auto-save resume data whenever it changes
  useEffect(() => {
    if (selectedResume && user) {
      setAutoSaveStatus('pending');
      
      // Queue auto-save with debouncing
      autoSaveSave('resume_draft', {
        resume: selectedResume,
        portfolioItems,
        isDraft,
        version: currentVersion,
        userId: user.id,
      }, {
        resumeId: selectedResume.id,
        timestamp: Date.now(),
      });
    }
  }, [selectedResume, portfolioItems, isDraft, currentVersion, user, autoSaveSave]);

  // Save as draft
  const handleSaveAsDraft = useCallback(async () => {
    if (!selectedResume) return;

    try {
      setAutoSaveStatus('saving');
      
      // Force immediate save
      await autoSaveForceSave();
      
      // Update draft status
      setIsDraft(true);
      
      // Track draft save
      features.trackFeatureUsage('resume-builder','draft_saved');
      analytics.trackEvent('resume_draft_saved', {
        userId: user?.id,
        resumeId: selectedResume.id,
        version: currentVersion,
      });
      
      setAutoSaveStatus('saved');
      console.log('[SUCCESS] Draft saved successfully');
    } catch (error) {
      setAutoSaveStatus('error');
      console.error('[ERROR] Error saving draft:', error);
    }
  }, [selectedResume, currentVersion, autoSaveForceSave, features, analytics, user]);

  // Publish resume (exit draft mode)
  const handlePublishResume = useCallback(async () => {
    if (!selectedResume) return;

    try {
      setAutoSaveStatus('saving');
      
      // Force save before publishing
      await autoSaveForceSave();
      
      // Create new version
      const newVersion = {
        id: `version_${Date.now()}`,
        resumeId: selectedResume.id,
        versionNumber: currentVersion,
        data: { ...selectedResume, portfolioItems },
        createdAt: new Date().toISOString(),
        publishedBy: user?.id,
      };
      
      setVersionHistory(prev => [...prev, newVersion]);
      setCurrentVersion(prev => prev + 1);
      setIsDraft(false);
      
      // Track publication
      features.trackFeatureUsage('resume-builder','resume_published');
      analytics.trackEvent('resume_published', {
        userId: user?.id,
        resumeId: selectedResume.id,
        version: currentVersion,
      });
      
      setAutoSaveStatus('saved');
      console.log('[SUCCESS] Resume published successfully - Version', currentVersion);
    } catch (error) {
      setAutoSaveStatus('error');
      console.error('[ERROR] Error publishing resume:', error);
    }
  }, [selectedResume, currentVersion, portfolioItems, autoSaveForceSave, features, analytics, user]);

  // Restore from version
  const handleRestoreVersion = useCallback((version: any) => {
    if (!version.data) return;

    // Restore resume data
    setSelectedResume(version.data);
    setPortfolioItems(version.data.portfolioItems || []);
    setCurrentVersion(version.versionNumber + 1);
    setIsDraft(true);
    
    // Track version restoration
    features.trackFeatureUsage('resume-builder','version_restored');
    analytics.trackEvent('resume_version_restored', {
      userId: user?.id,
      resumeId: version.resumeId,
      restoredVersion: version.versionNumber,
      newVersion: version.versionNumber + 1,
    });
    
    setShowVersionDialog(false);
    console.log('[SUCCESS] Version restored:', version.versionNumber);
  }, [features, analytics, user]);

  // Restore from auto-save backup
  const handleRestoreFromBackup = useCallback(() => {
    const restored = autoSaveRestoreFromBackup();
    
    if (restored) {
      // Track backup restoration
      features.trackFeatureUsage('resume-builder','backup_restored');
      analytics.trackEvent('resume_backup_restored', {
        userId: user?.id,
      });
      
      console.log('[SUCCESS] Backup restored successfully');
      alert('Tidligere lagret versjon er gjenopprettet!');
    } else {
      console.warn('[WARN] No backup available to restore');
      alert('Ingen backup tilgjengelig');
    }
  }, [autoSaveRestoreFromBackup, features, analytics, user]);

  const handleRemoveGoogleDriveLink = useCallback((linkId: string) => {
    setPortfolioFormData(prev => ({
      ...prev,
      googleDriveLinks: prev.googleDriveLinks?.filter(link => link.id !== linkId) || []
    }));
  }, []);

  // ============================================================================
  // AI WRITING TOOLS - QuillBot-style Features
  // ============================================================================

  const [aiToolDialog, setAiToolDialog] = useState(false);
  const [aiToolType, setAiToolType] = useState<'paraphrase' | 'grammar' | 'summarize' | 'generate-resume' | 'generate-cover-letter'>('paraphrase');
  const [aiInputText, setAiInputText] = useState('');
  const [aiOutputText, setAiOutputText] = useState('');
  const [aiParaphraseMode, setAiParaphraseMode] = useState('standard');
  const [aiIsProcessing, setAiIsProcessing] = useState(false);
  const [aiTargetField, setAiTargetField] = useState<string>('');

  // LinkedIn Import State
  interface LinkedInProfile {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
    headline?: string;
    summary?: string;
    location?: string;
    profileUrl?: string;
  }

  interface LinkedInExperience {
    id?: string;
    title?: string;
    company?: string;
    location?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
  }

  interface LinkedInEducation {
    id?: string;
    schoolName?: string;
    degreeType?: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }

  interface LinkedInSkill {
    name?: string;
  }

  type LinkedInDate = { year: number; month?: number };
  type LinkedInLocation = { country?: { code: string }; city?: string };

  const formatLinkedInDate = (date?: LinkedInDate): string | undefined => {
    if (!date?.year) return undefined;
    if (date.month) {
      return `${date.year}-${String(date.month).padStart(2, '0')}`;
    }
    return `${date.year}`;
  };

  const formatLinkedInLocation = (location?: LinkedInLocation): string | undefined => {
    if (!location) return undefined;
    const parts = [location.city, location.country?.code].filter(Boolean);
    return parts.length ? parts.join(', ') : undefined;
  };

  interface LinkedInCertification {
    id?: string;
    name?: string;
    title?: string;
    issuer?: string;
    issuingOrganization?: string;
    authority?: string;
    issueDate?: string;
    startDate?: string;
    expiryDate?: string;
    expirationDate?: string;
    endDate?: string;
    credentialId?: string;
    licenseNumber?: string;
    credentialUrl?: string;
    url?: string;
  }

  interface LinkedInData {
    profile?: LinkedInProfile;
    experience?: LinkedInExperience[];
    education?: LinkedInEducation[];
    skills?: LinkedInSkill[];
    certifications?: LinkedInCertification[];
  }

  const [linkedInDialog, setLinkedInDialog] = useState(false);
  const [linkedInImportMode, setLinkedInImportMode] = useState<'preview' | 'select'>('select');
  const [linkedInData, setLinkedInData] = useState<LinkedInData | null>(null);
  const [linkedInSelectedData, setLinkedInSelectedData] = useState({
    personalInfo: true,
    workExperience: true,
    education: true,
    skills: true,
    certifications: true,
  });

  // AI Paraphrase modes (same as QuillBot)
  const aiParaphraseModes = [
    { value: 'standard', label: 'Standard', description: 'Balansert omskriving' },
    { value: 'fluency', label: 'Fluency', description: 'Forbedrer flyt og lesbarhet' },
    { value: 'creative', label: 'Creative', description: 'Kreativ og originell omskriving' },
    { value: 'academic', label: 'Academic', description: 'Akademisk og formell stil' },
    { value: 'formal', label: 'Formal', description: 'Profesjonell og formell tone' },
    { value: 'shorten', label: 'Shorten', description: 'Forkorter og kondenserer tekst' },
    { value: 'expand', label: 'Expand', description: 'Utvider og utdyper tekst' },
  ];

  // Open AI tool dialog
  const openAiTool = useCallback((type: typeof aiToolType, initialText: string = '', targetField: string = ',') => {
    setAiToolType(type);
    setAiInputText(initialText);
    setAiOutputText('');
    setAiTargetField(targetField);
    setAiJobTitle('');
    setAiCompany('');
    setAiSkills([]);
    setAiExperience('');
    setAiToolDialog(true);

    // Track feature usage
    features.trackFeatureUsage('ai-resume-writing', `${type}_opened`);
    analytics.trackEvent('ai_tool_opened', {
      userId: user?.id,
      toolType: type,
      hasInitialText: !!initialText,
    });
  }, [features, analytics, user]);

  // AI Paraphrase
  const handleAiParaphrase = useCallback(async () => {
    if (!aiInputText.trim()) return;

    setAiIsProcessing(true);
    try {
      const response = await apiRequest('/api/ai/paraphrase', {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '' },
        body: JSON.stringify({
          text: aiInputText,
          mode: aiParaphraseMode,
        }),
      });

      setAiOutputText(response.paraphrased || '');
      
      features.trackFeatureUsage('ai-resume-writing','paraphrase_success', { mode: aiParaphraseMode });
      analytics.trackEvent('ai_paraphrase_success', {
        userId: user?.id,
        mode: aiParaphraseMode,
        inputLength: aiInputText.length,
      });
    } catch (error) {
      console.error('AI Paraphrase error:', error);
      alert('Kunne ikke omskrive tekst. Prøv igjen.');
    } finally {
      setAiIsProcessing(false);
    }
  }, [aiInputText, aiParaphraseMode, user, features, analytics]);

  // AI Grammar Check
  const handleAiGrammar = useCallback(async () => {
    if (!aiInputText.trim()) return;

    setAiIsProcessing(true);
    try {
      const response = await apiRequest('/api/ai/grammar', {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '' },
        body: JSON.stringify({ text: aiInputText }),
      });

      setAiOutputText(response.corrected || '');
      
      features.trackFeatureUsage('ai-resume-writing','grammar_check_success');
      analytics.trackEvent('ai_grammar_success', {
        userId: user?.id,
        inputLength: aiInputText.length,
      });
    } catch (error) {
      console.error('AI Grammar error:', error);
      alert('Kunne ikke sjekke grammatikk. Prøv igjen.');
    } finally {
      setAiIsProcessing(false);
    }
  }, [aiInputText, user, features, analytics]);

  // AI Summarize
  const handleAiSummarize = useCallback(async () => {
    if (!aiInputText.trim()) return;

    setAiIsProcessing(true);
    try {
      const response = await apiRequest('/api/ai/summarize', {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '' },
        body: JSON.stringify({ text: aiInputText }),
      });

      setAiOutputText(response.summary || '');
      
      features.trackFeatureUsage('ai-resume-writing','summarize_success');
      analytics.trackEvent('ai_summarize_success', {
        userId: user?.id,
        inputLength: aiInputText.length,
      });
    } catch (error) {
      console.error('AI Summarize error:', error);
      alert('Kunne ikke oppsummere tekst. Prøv igjen.');
    } finally {
      setAiIsProcessing(false);
    }
  }, [aiInputText, user, features, analytics]);

  // AI Generate Resume Content
  const handleAiGenerateResume = useCallback(async (jobTitle: string, skills: string[], experience: string) => {
    setAiIsProcessing(true);
    try {
      const response = await apiRequest('/api/ai/generate-resume', {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '' },
        body: JSON.stringify({
          jobTitle,
          skills: skills.join(', '),
          experience,
        }),
      });

      setAiOutputText(response.resume || '');
      
      features.trackFeatureUsage('ai-resume-writing','resume_generated');
      analytics.trackEvent('ai_resume_generated', {
        userId: user?.id,
        jobTitle,
        skillsCount: skills.length,
      });
    } catch (error) {
      console.error('AI Generate Resume error:', error);
      alert('Kunne ikke generere CV-innhold. Prøv igjen.');
    } finally {
      setAiIsProcessing(false);
    }
  }, [user, features, analytics]);

  // AI Generate Cover Letter
  const handleAiGenerateCoverLetter = useCallback(async (jobTitle: string, company: string, skills: string[]) => {
    setAiIsProcessing(true);
    try {
      const response = await apiRequest('/api/ai/generate-cover-letter', {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '' },
        body: JSON.stringify({
          jobTitle,
          company,
          skills: skills.join(', '),
        }),
      });

      setAiOutputText(response.coverLetter || '');
      
      features.trackFeatureUsage('ai-resume-writing','cover_letter_generated');
      analytics.trackEvent('ai_cover_letter_generated', {
        userId: user?.id,
        jobTitle,
        company,
      });
    } catch (error) {
      console.error('AI Generate Cover Letter error:', error);
      alert('Kunne ikke generere søknadsbrev. Prøv igjen.');
    } finally {
      setAiIsProcessing(false);
    }
  }, [user, features, analytics]);

  // ============================================================================
  // LINKEDIN IMPORT FUNCTIONS
  // ============================================================================

  const handleLinkedInConnect = useCallback(async () => {
    try {
      // Check if LinkedIn is authenticated
      if (!linkedIn.state.isAuthenticated) {
        // Initiate LinkedIn OAuth
        await linkedIn.login();
      } else {
        // Already connected, open import dialog
        setLinkedInDialog(true);
      }
    } catch (error) {
      console.error('LinkedIn connection error:', error);
    }
  }, [linkedIn]);

  const handleLinkedInSync = useCallback(async () => {
    try {
      // Sync LinkedIn profile
      const profile = await linkedIn.syncProfile();
      if (profile) {
        const normalizedProfile: LinkedInProfile = {
          id: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          profileImageUrl: profile.profilePicture,
          headline: profile.headline,
          summary: profile.summary,
          location: formatLinkedInLocation(profile.location)
        };

        const normalizedExperience: LinkedInExperience[] = (linkedIn.state.experience || []).map((exp) => ({
          id: exp.id,
          title: exp.title,
          company: exp.companyName,
          location: exp.location,
          description: exp.description,
          startDate: formatLinkedInDate(exp.startDate),
          endDate: formatLinkedInDate(exp.endDate)
        }));

        const normalizedEducation: LinkedInEducation[] = (linkedIn.state.education || []).map((edu) => ({
          id: edu.id,
          schoolName: edu.schoolName,
          degreeType: edu.degreeType,
          fieldOfStudy: edu.fieldOfStudy,
          startDate: formatLinkedInDate(edu.startDate),
          endDate: formatLinkedInDate(edu.endDate)
        }));

        const normalizedSkills: LinkedInSkill[] = (linkedIn.state.skills || []).map((skill) => ({
          name: skill.name
        }));

        setLinkedInData({
          profile: normalizedProfile,
          experience: normalizedExperience,
          education: normalizedEducation,
          skills: normalizedSkills,
        });
        setLinkedInImportMode('select');
        setLinkedInDialog(true);
        
        analytics?.trackEvent?.('linkedin_profile_synced', {
          userId: user?.id,
          hasExperience: !!(linkedIn.state.experience?.length),
          hasEducation: !!(linkedIn.state.education?.length),
        });
      }
    } catch (error) {
      console.error('LinkedIn sync error:', error);
    }
  }, [linkedIn, analytics, user]);

  const handleLinkedInImport = useCallback(() => {
    if (!linkedInData || !selectedResume) return;

    try {
      // Convert LinkedIn data to resume format with proper typing
      const linkedInResumeData = linkedInToResumeData({
        id: linkedInData.profile?.id || 'linkedin-user',
        firstName: linkedInData.profile?.firstName || '',
        lastName: linkedInData.profile?.lastName || '',
        email: linkedInData.profile?.email,
        profilePicture: linkedInData.profile?.profileImageUrl,
        headline: linkedInData.profile?.headline,
        summary: linkedInData.profile?.summary,
        location: linkedInData.profile?.location,
        experience: (linkedInData.experience || []).map((exp: any) => ({
          id: exp.id || '',
          title: exp.title || '',
          company: exp.company || '',
          location: exp.location,
          description: exp.description,
          startDate: exp.startDate,
          endDate: exp.endDate,
          isCurrent: !exp.endDate,
        })),
        education: (linkedInData.education || []).map((edu: any) => ({
          id: edu.id || '',
          school: edu.schoolName || '',
          degree: edu.degreeType,
          fieldOfStudy: edu.fieldOfStudy,
          startDate: edu.startDate,
          endDate: edu.endDate,
          description: edu.description,
        })),
        skills: (linkedInData.skills || []).map((skill: any) => skill.name || ''),
        languages: [],
        certifications: (linkedInData.certifications || []).map((cert: any) => ({
          id: cert.id || `cert-${Date.now()}-${Math.random()}`,
          name: cert.name || cert.title || '',
          issuingOrganization: cert.issuer || cert.issuingOrganization || cert.authority || '',
          issueDate: cert.issueDate || cert.startDate || '',
          expirationDate: cert.expiryDate || cert.expirationDate || cert.endDate || '',
          credentialId: cert.credentialId || cert.licenseNumber || '',
          credentialUrl: cert.credentialUrl || cert.url || '',
        })),
        lastSynced: Date.now(),
      });

      // Merge with existing resume - update personalInfo if selected
      const mergedPersonalInfo = linkedInSelectedData.personalInfo
        ? {
            ...selectedResume.personalInfo,
            fullName: `${linkedInResumeData.personalInfo.firstName} ${linkedInResumeData.personalInfo.lastName}`.trim(),
            email: linkedInResumeData.personalInfo.email || selectedResume.personalInfo.email,
            location: linkedInResumeData.personalInfo.location || selectedResume.personalInfo.location,
            summary: linkedInResumeData.personalInfo.summary || selectedResume.personalInfo.summary,
            linkedin: linkedInData.profile?.profileUrl || selectedResume.personalInfo.linkedin,
            profilePhoto: linkedInResumeData.personalInfo.profilePicture || selectedResume.personalInfo.profilePhoto,
          }
        : selectedResume.personalInfo;

      // Merge experiences (append new if selected)
      const mergedExperiences = linkedInSelectedData.workExperience
        ? [
            ...(selectedResume.experiences || []),
            ...(linkedInResumeData.workExperience || []).map((exp: any, index: number) => ({
              id: `linkedin-exp-${Date.now()}-${Math.random()}`,
              resumeId: selectedResume.id,
              jobTitle: exp.position || exp.title || exp.jobTitle || 'Stilling',
              company: exp.company || 'Ukjent',
              location: exp.location,
              startDate: exp.startDate,
              endDate: exp.endDate,
              isCurrent: Boolean(exp.isCurrent ?? !exp.endDate),
              description: exp.description,
              achievements: [],
              skills: [],
              projectId: undefined,
              autoGenerated: true,
              displayOrder: (selectedResume.experiences?.length || 0) + index + 1,
              isVisible: true,
            })),
          ]
        : selectedResume.experiences;

      // Merge education (append new if selected)
      const mergedEducation = linkedInSelectedData.education
        ? [
            ...(selectedResume.education || []),
            ...(linkedInResumeData.education || []).map((edu: any, index: number) => ({
              id: `linkedin-edu-${Date.now()}-${Math.random()}`,
              resumeId: selectedResume.id,
              degree: edu.degree || 'Ukjent grad',
              fieldOfStudy: edu.fieldOfStudy,
              institution: edu.school || edu.institution || 'Ukjent institusjon',
              location: edu.location,
              startDate: edu.startDate,
              endDate: edu.endDate,
              isCurrent: Boolean(!edu.endDate),
              grade: edu.grade,
              description: edu.description,
              achievements: [],
              displayOrder: (selectedResume.education?.length || 0) + index + 1,
              isVisible: true,
            })),
          ]
        : selectedResume.education;

      // Merge skills (append new if selected, avoid duplicates)
      const mergedSkills = [...(selectedResume.skills || [])];
      if (linkedInSelectedData.skills) {
        const existingSkillNames = new Set(
          (selectedResume.skills || []).map((s: any) => s.name?.toLowerCase())
        );
        const newSkills = (linkedInResumeData.skills || [])
          .filter((skill: string) => !existingSkillNames.has(skill.toLowerCase()))
          .map((skill: string, index: number) => ({
            id: `linkedin-skill-${Date.now()}-${Math.random()}`,
            resumeId: selectedResume.id,
            name: skill,
            category: undefined,
            proficiencyLevel: 3,
            yearsOfExperience: undefined,
            isEndorsed: false,
            displayOrder: (selectedResume.skills?.length || 0) + index + 1,
            isVisible: true,
          }));
        mergedSkills.push(...newSkills);
      }

      // Merge certifications (append new if selected)
      const mergedCertifications = linkedInSelectedData.certifications
        ? [
            ...(selectedResume.certifications || []),
            ...(linkedInResumeData.certifications || []).map((cert: any, index: number) => ({
              id: `linkedin-cert-${Date.now()}-${Math.random()}`,
              resumeId: selectedResume.id,
              name: cert.name,
              issuer: cert.issuer,
              issueDate: cert.issueDate,
              expiryDate: cert.expirationDate || cert.expiryDate,
              credentialId: cert.credentialId,
              credentialUrl: cert.credentialUrl,
              description: cert.description,
              displayOrder: (selectedResume.certifications?.length || 0) + index + 1,
              isVisible: true,
            })),
          ]
        : selectedResume.certifications;

      // Create merged resume
      const mergedResume: Resume = {
        ...selectedResume,
        personalInfo: mergedPersonalInfo,
        experiences: mergedExperiences,
        education: mergedEducation,
        skills: mergedSkills,
        certifications: mergedCertifications,
        updatedAt: new Date().toISOString(),
      };

      setSelectedResume(mergedResume);
      setLinkedInDialog(false);
      setLinkedInData(null);

      analytics?.trackEvent?.('linkedin_data_imported', {
        userId: user?.id,
        importedSections: Object.keys(linkedInSelectedData).filter(
          (k) => linkedInSelectedData[k as keyof typeof linkedInSelectedData]
        ),
      });

      // Track feature usage
      features?.trackFeatureUsage?.('linkedin-auto-sync', 'data_imported');
    } catch (error) {
      console.error('Error importing LinkedIn data:', error);
      // Optionally show error notification here
    }
  }, [linkedInData, selectedResume, linkedInSelectedData, analytics, user, features]);

  const handleLinkedInPreview = useCallback(() => {
    if (!linkedInData) return;
    setLinkedInImportMode('preview');
    // Track preview action
    analytics?.trackEvent?.('linkedin_preview_clicked', {
      userId: user?.id,
      dataType: 'import_preview'
    });
  }, [linkedInData, analytics, user]);

  const handleLinkedInBackToSelect = useCallback(() => {
    setLinkedInImportMode('select');
  }, []);

  // Fetch resumes
  const { data: resumes = [], isLoading: resumesLoading } = useQuery({
    queryKey: ['resumes', user?.id],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/resumes', {
          headers: { 'x-user-id': user?.id || '' },
        });
        
        // Handle different response formats
        if (Array.isArray(response)) {
          return response as Resume[];
        } else if (response?.data && Array.isArray(response.data)) {
          return response.data as Resume[];
        } else if (response?.resumes && Array.isArray(response.resumes)) {
          return response.resumes as Resume[];
        } else {
          console.warn('Unexpected resumes response format:', response);
          return [];
        }
      } catch (error) {
        console.error('Error fetching resumes:', error);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['resume-templates'],
    queryFn: async () => {
      const response = await apiRequest('/api/resume-templates');
      // Track template fetch
      analytics?.trackEvent?.('resume_templates_loaded', {
        userId: user?.id,
        templateCount: Array.isArray(response) ? response.length : 0
      });
      return response as ResumeTemplate[];
    },
  });

  const filteredResumes = useMemo(() => {
    const list = Array.isArray(resumes) ? resumes : [];
    const normalizedSearch = resumeSearch.trim().toLowerCase();
    const filtered = list.filter((resume) => {
      const matchesSearch = !normalizedSearch
        || resume.title.toLowerCase().includes(normalizedSearch)
        || resume.personalInfo?.professionalTitle?.toLowerCase().includes(normalizedSearch)
        || resume.personalInfo?.fullName?.toLowerCase().includes(normalizedSearch);
      const matchesStatus = resumeStatusFilter === 'all' || resume.status === resumeStatusFilter;
      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (resumeSort === 'title') return a.title.localeCompare(b.title);
      if (resumeSort === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [resumes, resumeSearch, resumeStatusFilter, resumeSort]);

  // Create resume mutation
  const createResumeMutation = useMutation({
    mutationFn: async (data: Partial<Resume>) => {
      const response = await apiRequest('/api/resumes', {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || '', 'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setSnackbar({ open: true, severity: 'success', message: 'CV opprettet.' });
    },
    onError: showMutationError('Kunne ikke opprette CV'),
  });

  // Update resume mutation
  const updateResumeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Resume> }) => {
      const response = await apiRequest(`/api/resumes/${id}`, {
        method: 'PUT',
        headers: {
          'x-user-id': user?.id || '', 'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    },
    onError: showMutationError('Kunne ikke lagre endringer'),
  });

  // Delete resume mutation
  const deleteResumeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/resumes/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setSelectedResume(null);
      setSnackbar({ open: true, severity: 'success', message: 'CV slettet.' });
    },
    onError: showMutationError('Kunne ikke slette CV'),
  });

  // Job Application Mutations - Database Persistence
  const createJobApplicationMutation = useMutation({
    mutationFn: async (data: Partial<JobApplication>) => {
      const response = await apiRequest('/api/job-applications', {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-applications'] });
      setSnackbar({ open: true, severity: 'success', message: 'Jobbsøknad lagret.' });
    },
    onError: showMutationError('Kunne ikke lagre jobbsøknad'),
  });

  const updateJobApplicationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<JobApplication> }) => {
      const response = await apiRequest(`/api/job-applications/${id}`, {
        method: 'PUT',
        headers: {
          'x-user-id': user?.id || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-applications'] });
    },
    onError: showMutationError('Kunne ikke oppdatere jobbsøknad'),
  });

  const deleteJobApplicationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/job-applications/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-applications'] });
      setSnackbar({ open: true, severity: 'success', message: 'Jobbsøknad slettet.' });
    },
    onError: showMutationError('Kunne ikke slette jobbsøknad'),
  });

  // Import projects mutation
  const importProjectsMutation = useMutation({
    mutationFn: async (resumeId: string) => {
      const response = await apiRequest(`/api/resumes/${resumeId}/import-completed-projects`, {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || '', 'Content-Type': 'application/json',
        },
      });
      return response;
    },
    onSuccess: (data: { imported?: number; skipped?: number } | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setShowProjectImportDialog(false);
      const imported = data?.imported ?? 0;
      if (imported > 0) {
        setSnackbar({
          open: true,
          severity: 'success',
          message: `Importerte ${imported} prosjekt${imported === 1 ? '' : 'er'} til CV-en.`,
        });
      }
    },
    onError: showMutationError('Kunne ikke importere prosjekter'),
  });

  useEffect(() => {
    if (!user?.id || resumesLoading || initializationRef.current) return;

    initializationRef.current = true;

    const initializeResume = async () => {
      setInitializingResume(true);
      setInitializationStep(1);
      setInitializationMessage('Samler brukerinfo...');

      try {
        const userProfile = await apiRequest(`/api/users/${user.id}`);

        let resumeToUse: Resume | null = selectedResume;

        if (!resumes.length) {
          setInitializationStep(2);
          setInitializationMessage('Oppretter CV...');
          const createdResume = await createResumeMutation.mutateAsync({
            title: 'Ny CV',
            personalInfo: {
              fullName:
                [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ') ||
                userProfile?.name ||
                user?.email ||
                'Ditt navn',
              email: userProfile?.email || user?.email || '',
              phone: userProfile?.phone || '',
              location: userProfile?.address || '',
              linkedin: userProfile?.linkedin || '',
              website: userProfile?.website || '',
              professionalTitle: userProfile?.title || '',
              summary: userProfile?.bio || '',
            },
            templateId: 'modern-ats',
            status: 'draft',
            language: 'no',
          });

          resumeToUse = createdResume || null;
          if (resumeToUse) {
            setSelectedResume(resumeToUse);
          }
        } else if (!selectedResume) {
          resumeToUse = resumes[0];
          setSelectedResume(resumes[0]);
        }

        const resumeId = resumeToUse?.id || selectedResume?.id;

        if (resumeId) {
          setInitializationStep(3);
          setInitializationMessage('Henter prosjekter...');
          await importProjectsMutation.mutateAsync(resumeId);

          if (userProfile) {
            setInitializationStep(4);
            setInitializationMessage('Oppdaterer profil...');
            await updateResumeMutation.mutateAsync({
              id: resumeId,
              data: {
                personalInfo: {
                  ...(resumeToUse?.personalInfo || {}),
                  fullName:
                    [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ') ||
                    userProfile?.name ||
                    resumeToUse?.personalInfo?.fullName ||
                    user?.email ||
                    'Ditt navn',
                  email: userProfile?.email || resumeToUse?.personalInfo?.email || user?.email || '',
                  phone: userProfile?.phone || resumeToUse?.personalInfo?.phone || '',
                  location: userProfile?.address || resumeToUse?.personalInfo?.location || '',
                  linkedin: userProfile?.linkedin || resumeToUse?.personalInfo?.linkedin || '',
                  website: userProfile?.website || resumeToUse?.personalInfo?.website || '',
                  professionalTitle:
                    userProfile?.title || resumeToUse?.personalInfo?.professionalTitle || '',
                  summary: userProfile?.bio || resumeToUse?.personalInfo?.summary || '',
                },
              },
            });
          }
        }
      } catch (error) {
        console.error('Resume initialization failed:', error);
      } finally {
        setInitializationStep(5);
        setInitializationMessage('');
        setInitializingResume(false);
      }
    };

    initializeResume();
  }, [
    user?.id,
    resumes,
    resumesLoading,
    selectedResume,
    createResumeMutation,
    updateResumeMutation,
    importProjectsMutation,
    user?.email,
  ]);

  // AI analysis mutation
  const aiAnalyzeMutation = useMutation({
    mutationFn: async ({ resumeId, jobDescription }: { resumeId: string; jobDescription?: string }) => {
      const response = await apiRequest(`/api/resumes/${resumeId}/ai-analyze`, {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || '', 'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobDescription }),
      });
      return response;
    },
    onSuccess: (data: { atsScore?: number; matchScore?: number | null } | undefined) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setShowAIDialog(false);
      const parts: string[] = [];
      if (typeof data?.atsScore === 'number') parts.push(`ATS-score: ${data.atsScore}`);
      if (typeof data?.matchScore === 'number') parts.push(`Match-score: ${data.matchScore}%`);
      setSnackbar({
        open: true,
        severity: 'success',
        message: parts.length ? `AI-analyse fullført. ${parts.join(' · ')}` : 'AI-analyse fullført.',
      });
    },
    onError: showMutationError('AI-analyse feilet'),
  });

  // Export resume mutation
  const exportResumeMutation = useMutation({
    mutationFn: async ({ resumeId, format }: { resumeId: string; format: 'pdf' | 'docx' | 'txt' | 'json' }) => {
      const response = await fetch(`/api/resumes/${resumeId}/export`, {
        method: 'POST',
        headers: {
          'x-user-id': user?.id || '', 'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format }),
      });

      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        throw new Error(`${response.status}: ${txt || 'Eksport feilet'}`);
      }

      if (format === 'pdf' || format === 'docx') {
        const ext = format === 'pdf' ? 'pdf' : 'docx';
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cv-${resumeId}.${ext}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return { format };
      }
      if (format === 'txt') {
        const txt = await response.text();
        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cv-${resumeId}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return { format };
      }
      return await response.json();
    },
    onSuccess: (result: { format?: string } | undefined) => {
      const fmt = (result?.format ?? 'fil').toUpperCase();
      setSnackbar({
        open: true,
        severity: 'success',
        message: `${fmt} eksportert.`,
      });
    },
    onError: showMutationError('Eksport feilet'),
  });

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, []);

  const buildPlainTextResume = useCallback((resume: Resume, portfolios: PortfolioItem[]) => {
    const lines: string[] = [];
    lines.push(resume.personalInfo?.fullName || '');
    if (resume.personalInfo?.professionalTitle) lines.push(resume.personalInfo.professionalTitle);
    if (resume.personalInfo?.email) lines.push(`E-post: ${resume.personalInfo.email}`);
    if (resume.personalInfo?.phone) lines.push(`Telefon: ${resume.personalInfo.phone}`);
    if (resume.personalInfo?.location) lines.push(`Sted: ${resume.personalInfo.location}`);
    lines.push('');
    if (resume.personalInfo?.summary) {
      lines.push('Sammendrag');
      lines.push(resume.personalInfo.summary);
      lines.push('');
    }
    if (resume.experiences?.length) {
      lines.push('Arbeidserfaring');
      resume.experiences.forEach((exp) => {
        lines.push(`${exp.jobTitle} - ${exp.company}`);
        lines.push(`${exp.startDate} - ${exp.isCurrent ? 'Nå' : exp.endDate || ''}`);
        if (exp.description) lines.push(exp.description);
        if (exp.achievements?.length) lines.push(`Prestasjoner: ${exp.achievements.join('; ')}`);
        lines.push('');
      });
    }
    if (resume.education?.length) {
      lines.push('Utdanning');
      resume.education.forEach((edu) => {
        lines.push(`${edu.degree} - ${edu.institution}`);
        lines.push(`${edu.startDate} - ${edu.isCurrent ? 'Nå' : edu.endDate || ''}`);
        if (edu.fieldOfStudy) lines.push(`Studieretning: ${edu.fieldOfStudy}`);
        if (edu.description) lines.push(edu.description);
        lines.push('');
      });
    }
    if (resume.skills?.length) {
      lines.push('Ferdigheter');
      lines.push(resume.skills.map((skill) => skill.name).join(', '));
      lines.push('');
    }
    if (resume.certifications?.length) {
      lines.push('Sertifiseringer');
      resume.certifications.forEach((cert) => {
        lines.push(`${cert.name} - ${cert.issuer} (${cert.issueDate})`);
      });
      lines.push('');
    }
    if (portfolios.length) {
      lines.push('Portefølje');
      portfolios.forEach((item) => {
        lines.push(`${item.title} (${item.category})`);
        lines.push(item.description);
        lines.push('');
      });
    }
    return lines.join('\n');
  }, []);

  const buildHtmlResume = useCallback((resume: Resume, portfolios: PortfolioItem[]) => {
    const skills = resume.skills?.map((skill) => `<li>${skill.name}</li>`).join('') || '';
    const experiences = resume.experiences?.map((exp) => `
      <div class="section-item">
        <h3>${exp.jobTitle} - ${exp.company}</h3>
        <p>${exp.startDate} - ${exp.isCurrent ? 'Nå' : exp.endDate || ''}</p>
        ${exp.description ? `<p>${exp.description}</p>` : ''}
      </div>
    `).join('') || '';
    const education = resume.education?.map((edu) => `
      <div class="section-item">
        <h3>${edu.degree} - ${edu.institution}</h3>
        <p>${edu.startDate} - ${edu.isCurrent ? 'Nå' : edu.endDate || ''}</p>
        ${edu.fieldOfStudy ? `<p>${edu.fieldOfStudy}</p>` : ''}
      </div>
    `).join('') || '';
    const certifications = resume.certifications?.map((cert) => `
      <div class="section-item">
        <h3>${cert.name}</h3>
        <p>${cert.issuer} • ${cert.issueDate}</p>
      </div>
    `).join('') || '';
    const portfolio = portfolios.map((item) => `
      <div class="section-item">
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </div>
    `).join('');

    return `<!doctype html>
      <html lang="no">
      <head>
        <meta charset="utf-8" />
        <title>${resume.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a; }
          h1 { font-size: 28px; margin-bottom: 4px; }
          h2 { font-size: 18px; margin-top: 24px; }
          .section-item { margin-bottom: 12px; }
        </style>
      </head>
      <body>
        <h1>${resume.personalInfo?.fullName || ''}</h1>
        <p>${resume.personalInfo?.professionalTitle || ''}</p>
        <p>${resume.personalInfo?.email || ''} ${resume.personalInfo?.phone ? `• ${resume.personalInfo.phone}` : ''}</p>
        ${resume.personalInfo?.summary ? `<h2>Sammendrag</h2><p>${resume.personalInfo.summary}</p>` : ''}
        ${experiences ? `<h2>Arbeidserfaring</h2>${experiences}` : ''}
        ${education ? `<h2>Utdanning</h2>${education}` : ''}
        ${skills ? `<h2>Ferdigheter</h2><ul>${skills}</ul>` : ''}
        ${certifications ? `<h2>Sertifiseringer</h2>${certifications}` : ''}
        ${portfolio ? `<h2>Portefølje</h2>${portfolio}` : ''}
      </body>
      </html>`;
  }, []);

  const buildDocxResume = useCallback(async (resume: Resume, portfolios: PortfolioItem[]) => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: resume.personalInfo?.fullName || resume.title,
              heading: HeadingLevel.HEADING_1,
            }),
            resume.personalInfo?.professionalTitle
              ? new Paragraph({ text: resume.personalInfo.professionalTitle })
              : new Paragraph({ text: '' }),
            new Paragraph({ text: resume.personalInfo?.email || '' }),
            ...(resume.personalInfo?.summary
              ? [
                  new Paragraph({ text: 'Sammendrag', heading: HeadingLevel.HEADING_2 }),
                  new Paragraph({ text: resume.personalInfo.summary }),
                ]
              : []),
            ...(resume.experiences?.length
              ? [new Paragraph({ text: 'Arbeidserfaring', heading: HeadingLevel.HEADING_2 })]
              : []),
            ...(resume.experiences || []).flatMap((exp) => [
              new Paragraph({
                children: [new TextRun({ text: `${exp.jobTitle} - ${exp.company}`, bold: true })],
              }),
              new Paragraph({ text: `${exp.startDate} - ${exp.isCurrent ? 'Nå' : exp.endDate || ''}` }),
              ...(exp.description ? [new Paragraph({ text: exp.description })] : []),
            ]),
            ...(resume.education?.length
              ? [new Paragraph({ text: 'Utdanning', heading: HeadingLevel.HEADING_2 })]
              : []),
            ...(resume.education || []).flatMap((edu) => [
              new Paragraph({
                children: [new TextRun({ text: `${edu.degree} - ${edu.institution}`, bold: true })],
              }),
              new Paragraph({ text: `${edu.startDate} - ${edu.isCurrent ? 'Nå' : edu.endDate || ''}` }),
            ]),
            ...(resume.skills?.length
              ? [
                  new Paragraph({ text: 'Ferdigheter', heading: HeadingLevel.HEADING_2 }),
                  new Paragraph({ text: resume.skills.map((skill) => skill.name).join(', ') }),
                ]
              : []),
            ...(resume.certifications?.length
              ? [new Paragraph({ text: 'Sertifiseringer', heading: HeadingLevel.HEADING_2 })]
              : []),
            ...(resume.certifications || []).map(
              (cert) => new Paragraph({ text: `${cert.name} - ${cert.issuer} (${cert.issueDate})` })
            ),
            ...(portfolios.length
              ? [new Paragraph({ text: 'Portefølje', heading: HeadingLevel.HEADING_2 })]
              : []),
            ...portfolios.map((item) => new Paragraph({ text: `${item.title}: ${item.description}` })),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    return blob;
  }, []);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreateResume = useCallback(() => {
    createResumeMutation.mutate({
      title: 'Ny CV',
      personalInfo: {
        fullName: user?.email || 'Ditt navn',
        email: user?.email || '',
      },
      templateId: 'modern-ats',
      status: 'draft',
      language: 'no',
    });
  }, [user, createResumeMutation]);

  // Når en CV velges fra listen henter vi den fulle nested-representasjonen
  // (resume + experiences + education + skills + certifications + projects +
  // languages) fra backend, og flater den inn på selectedResume. Listen
  // alene returnerer bare flate resume-rader uten sub-data.
  const handleSelectResume = useCallback(async (resume: Resume) => {
    setSelectedResume(resume);
    setActiveStep(1);
    try {
      const full = await apiRequest(`/api/resumes/${resume.id}`, {
        headers: { 'x-user-id': user?.id || '' },
      });
      if (full?.resume) {
        setSelectedResume({
          ...full.resume,
          experiences: full.experiences ?? [],
          education: full.education ?? [],
          skills: full.skills ?? [],
          certifications: full.certifications ?? [],
          projects: full.projects ?? [],
          languages: full.languages ?? [],
        });
      }
    } catch (err) {
      console.warn('Kunne ikke hente full CV — bruker liste-data', err);
    }
  }, [user?.id]);

  const handleUpdateResume = useCallback((data: Partial<Resume>) => {
    if (selectedResume) {
      updateResumeMutation.mutate({
        id: selectedResume.id,
        data,
      });
    }
  }, [selectedResume, updateResumeMutation]);

  const handleApplyAiResult = useCallback(() => {
    if (!aiOutputText || !selectedResume) return;

    if (aiTargetField === 'summary') {
      const updated = {
        personalInfo: {
          ...selectedResume.personalInfo,
          summary: aiOutputText,
        },
      };
      setSelectedResume({ ...selectedResume, ...updated });
      handleUpdateResume(updated);
    }

    if (aiTargetField === 'job-application-cover-letter') {
      setJobFormData((prev) => ({ ...prev, coverLetter: aiOutputText }));
    }

    analytics.trackEvent('ai_result_applied', {
      userId: user?.id,
      toolType: aiToolType,
      targetField: aiTargetField,
    });

    setAiToolDialog(false);
  }, [aiOutputText, selectedResume, aiTargetField, aiToolType, analytics, user, handleUpdateResume]);

  const handleOpenSkillDialog = useCallback(() => {
    setSkillFormData({ name: '', category: '', proficiencyLevel: 3 });
    setShowSkillDialog(true);
  }, []);

  const handleCloseSkillDialog = useCallback(() => {
    setShowSkillDialog(false);
  }, []);

  // POST /api/resumes/:id/skills — persisterer i resume_skills-tabellen.
  // Tidligere ble skills bare lagret i client-state og forsvant ved refresh.
  const handleAddSkill = useCallback(async () => {
    if (!selectedResume) return;
    const name = skillFormData.name.trim();
    if (!name) {
      setSnackbar({ open: true, message: 'Skriv inn et ferdighetsnavn.', severity: 'warning' });
      return;
    }
    try {
      const created = await apiRequest(`/api/resumes/${selectedResume.id}/skills`, {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category: skillFormData.category || null,
          proficiencyLevel: skillFormData.proficiencyLevel,
          displayOrder: (selectedResume.skills?.length || 0) + 1,
        }),
      });
      setSelectedResume({
        ...selectedResume,
        skills: [...(selectedResume.skills || []), created as ResumeSkill],
      });
      setShowSkillDialog(false);
    } catch (err) {
      console.error('Skill-lagring feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke lagre ferdighet.' });
    }
  }, [selectedResume, skillFormData, user?.id]);

  const handleDeleteSkill = useCallback(async (skillId: string) => {
    if (!selectedResume) return;
    try {
      await apiRequest(`/api/resumes/${selectedResume.id}/skills/${skillId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
      setSelectedResume({
        ...selectedResume,
        skills: (selectedResume.skills || []).filter((s) => s.id !== skillId),
      });
    } catch (err) {
      console.error('Skill-sletting feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke slette ferdighet.' });
    }
  }, [selectedResume, user?.id]);

  // ── Language handlers ───────────────────────────────────────────
  // Bruker dedikerte /api/resumes/:id/languages-endepunkter for ekte
  // persistens. Norsk-CV-konvensjon: progress-bar med nivå-label.

  const PROFICIENCY_BY_LABEL: Record<string, number> = {
    Morsmål: 100,
    Flytende: 90,
    God: 70,
    Grunnleggende: 40,
  };

  const handleOpenLanguageDialog = useCallback((lang?: ResumeLanguage) => {
    if (lang) {
      setEditingLanguage(lang);
      setLanguageFormData({
        name: lang.name,
        proficiencyLevel: lang.proficiencyLevel ?? 80,
        levelLabel: lang.levelLabel ?? 'Flytende',
        isNative: !!lang.isNative,
      });
    } else {
      setEditingLanguage(null);
      setLanguageFormData({
        name: '',
        proficiencyLevel: 80,
        levelLabel: 'Flytende',
        isNative: false,
      });
    }
    setShowLanguageDialog(true);
  }, []);

  const handleCloseLanguageDialog = useCallback(() => {
    setShowLanguageDialog(false);
    setEditingLanguage(null);
  }, []);

  const handleSaveLanguage = useCallback(async () => {
    if (!selectedResume) return;
    const name = languageFormData.name.trim();
    if (!name) {
      setSnackbar({ open: true, severity: 'warning', message: 'Skriv inn et språk.' });
      return;
    }
    const payload = {
      name,
      proficiencyLevel: languageFormData.proficiencyLevel,
      levelLabel: languageFormData.levelLabel || null,
      isNative: languageFormData.isNative,
    };
    try {
      if (editingLanguage) {
        const updated = await apiRequest(
          `/api/resumes/${selectedResume.id}/languages/${editingLanguage.id}`,
          {
            method: 'PATCH',
            headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        setSelectedResume({
          ...selectedResume,
          languages: (selectedResume.languages || []).map((l) =>
            l.id === editingLanguage.id ? (updated as ResumeLanguage) : l,
          ),
        });
      } else {
        const created = await apiRequest(`/api/resumes/${selectedResume.id}/languages`, {
          method: 'POST',
          headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            displayOrder: (selectedResume.languages?.length ?? 0) + 1,
          }),
        });
        setSelectedResume({
          ...selectedResume,
          languages: [...(selectedResume.languages || []), created as ResumeLanguage],
        });
      }
      setSnackbar({ open: true, severity: 'success', message: 'Språk lagret.' });
      handleCloseLanguageDialog();
    } catch (err) {
      console.error('Språk lagring feilet', err);
      setSnackbar({
        open: true,
        severity: 'error',
        message: 'Kunne ikke lagre språk.',
      });
    }
  }, [selectedResume, languageFormData, editingLanguage, user?.id, handleCloseLanguageDialog]);

  // ── Experience handlers (sub-roller via experienceGroups) ──────
  const handleOpenExperienceDialog = useCallback((exp?: ResumeExperience) => {
    if (exp) {
      setEditingExperience(exp);
      const hasGroups = Array.isArray(exp.experienceGroups) && exp.experienceGroups.length > 0;
      setExperienceFormData({
        jobTitle: exp.jobTitle,
        company: exp.company,
        location: exp.location ?? '',
        employmentType: exp.employmentType ?? '',
        startDate: exp.startDate ? exp.startDate.slice(0, 10) : '',
        endDate: exp.endDate ? exp.endDate.slice(0, 10) : '',
        isCurrent: !!exp.isCurrent,
        description: exp.description ?? '',
        useGroups: hasGroups,
        achievements: (exp.achievements ?? []).join('\n'),
        experienceGroups: hasGroups ? exp.experienceGroups! : [],
      });
    } else {
      setEditingExperience(null);
      setExperienceFormData({
        jobTitle: '',
        company: '',
        location: '',
        employmentType: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        description: '',
        useGroups: false,
        achievements: '',
        experienceGroups: [],
      });
    }
    setShowExperienceDialog(true);
  }, []);

  const handleCloseExperienceDialog = useCallback(() => {
    setShowExperienceDialog(false);
    setEditingExperience(null);
  }, []);

  const handleSaveExperience = useCallback(async () => {
    if (!selectedResume) return;
    const jobTitle = experienceFormData.jobTitle.trim();
    const company = experienceFormData.company.trim();
    if (!jobTitle || !company) {
      setSnackbar({
        open: true,
        severity: 'warning',
        message: 'Stilling og selskap er påkrevd.',
      });
      return;
    }
    const payload: Record<string, unknown> = {
      jobTitle,
      company,
      location: experienceFormData.location || null,
      employmentType: experienceFormData.employmentType || null,
      startDate: experienceFormData.startDate || new Date().toISOString().slice(0, 10),
      endDate: experienceFormData.isCurrent ? null : experienceFormData.endDate || null,
      isCurrent: experienceFormData.isCurrent,
      description: experienceFormData.description || null,
    };
    if (experienceFormData.useGroups) {
      payload.experienceGroups = experienceFormData.experienceGroups
        .filter((g) => g.category?.trim() || g.items?.length)
        .map((g) => ({
          category: g.category?.trim() ?? '',
          items: (g.items ?? []).map((s) => s.trim()).filter(Boolean),
        }));
      payload.achievements = []; // ryddig — bruker grupper i stedet
    } else {
      payload.achievements = experienceFormData.achievements
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      payload.experienceGroups = null;
    }
    try {
      if (editingExperience) {
        const updated = await apiRequest(
          `/api/resumes/${selectedResume.id}/experiences/${editingExperience.id}`,
          {
            method: 'PATCH',
            headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        setSelectedResume({
          ...selectedResume,
          experiences: (selectedResume.experiences || []).map((e) =>
            e.id === editingExperience.id ? (updated as ResumeExperience) : e,
          ),
        });
      } else {
        const created = await apiRequest(`/api/resumes/${selectedResume.id}/experiences`, {
          method: 'POST',
          headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            displayOrder: (selectedResume.experiences?.length ?? 0) + 1,
          }),
        });
        setSelectedResume({
          ...selectedResume,
          experiences: [...(selectedResume.experiences || []), created as ResumeExperience],
        });
      }
      setSnackbar({ open: true, severity: 'success', message: 'Erfaring lagret.' });
      handleCloseExperienceDialog();
    } catch (err) {
      console.error('Erfaring-lagring feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke lagre erfaring.' });
    }
  }, [selectedResume, experienceFormData, editingExperience, user?.id, handleCloseExperienceDialog]);

  // Generisk reorder-helper — flytter en oppføring opp/ned i listen og
  // PATCH-er displayOrder mot dedikert sub-resource-endpoint.
  // direction: -1 = opp, +1 = ned.
  const handleReorderItem = useCallback(async (
    section: 'experiences' | 'education' | 'skills' | 'certifications' | 'languages',
    itemId: string,
    direction: -1 | 1,
  ) => {
    if (!selectedResume) return;
    const list = (selectedResume[section] as any[] | undefined) ?? [];
    const idx = list.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= list.length) return;

    // Bytt lokalt for umiddelbar respons
    const next = [...list];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const reordered = next.map((item, i) => ({ ...item, displayOrder: i + 1 }));
    setSelectedResume({ ...selectedResume, [section]: reordered });

    // URL-segmentet skiller seg fra section-navnet for noen ressurser
    const urlSegment = section; // alle endepunkter bruker samme path-segment
    try {
      await Promise.all([
        apiRequest(`/api/resumes/${selectedResume.id}/${urlSegment}/${reordered[idx].id}`, {
          method: 'PATCH',
          headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayOrder: reordered[idx].displayOrder }),
        }),
        apiRequest(`/api/resumes/${selectedResume.id}/${urlSegment}/${reordered[swapIdx].id}`, {
          method: 'PATCH',
          headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayOrder: reordered[swapIdx].displayOrder }),
        }),
      ]);
    } catch (err) {
      console.error('Reorder feilet, ruller tilbake', err);
      setSelectedResume({ ...selectedResume, [section]: list });
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke endre rekkefølge.' });
    }
  }, [selectedResume, user?.id]);

  const handleDeleteExperience = useCallback(async (expId: string) => {
    if (!selectedResume) return;
    try {
      await apiRequest(`/api/resumes/${selectedResume.id}/experiences/${expId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
      setSelectedResume({
        ...selectedResume,
        experiences: (selectedResume.experiences || []).filter((e) => e.id !== expId),
      });
    } catch (err) {
      console.error('Erfaring-sletting feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke slette erfaring.' });
    }
  }, [selectedResume, user?.id]);

  // Hjelpere for sub-rolle-grupper i experience-dialogen
  const handleAddExperienceGroup = useCallback(() => {
    setExperienceFormData((prev) => ({
      ...prev,
      experienceGroups: [...prev.experienceGroups, { category: '', items: [''] }],
    }));
  }, []);

  const handleUpdateExperienceGroupCategory = useCallback(
    (idx: number, category: string) => {
      setExperienceFormData((prev) => ({
        ...prev,
        experienceGroups: prev.experienceGroups.map((g, i) =>
          i === idx ? { ...g, category } : g,
        ),
      }));
    },
    [],
  );

  const handleRemoveExperienceGroup = useCallback((idx: number) => {
    setExperienceFormData((prev) => ({
      ...prev,
      experienceGroups: prev.experienceGroups.filter((_, i) => i !== idx),
    }));
  }, []);

  const handleAddGroupItem = useCallback((groupIdx: number) => {
    setExperienceFormData((prev) => ({
      ...prev,
      experienceGroups: prev.experienceGroups.map((g, i) =>
        i === groupIdx ? { ...g, items: [...(g.items ?? []), ''] } : g,
      ),
    }));
  }, []);

  const handleUpdateGroupItem = useCallback(
    (groupIdx: number, itemIdx: number, value: string) => {
      setExperienceFormData((prev) => ({
        ...prev,
        experienceGroups: prev.experienceGroups.map((g, i) =>
          i === groupIdx
            ? { ...g, items: (g.items ?? []).map((it, j) => (j === itemIdx ? value : it)) }
            : g,
        ),
      }));
    },
    [],
  );

  const handleRemoveGroupItem = useCallback((groupIdx: number, itemIdx: number) => {
    setExperienceFormData((prev) => ({
      ...prev,
      experienceGroups: prev.experienceGroups.map((g, i) =>
        i === groupIdx
          ? { ...g, items: (g.items ?? []).filter((_, j) => j !== itemIdx) }
          : g,
      ),
    }));
  }, []);

  const handleDeleteLanguage = useCallback(async (langId: string) => {
    if (!selectedResume) return;
    try {
      await apiRequest(`/api/resumes/${selectedResume.id}/languages/${langId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
      setSelectedResume({
        ...selectedResume,
        languages: (selectedResume.languages || []).filter((l) => l.id !== langId),
      });
    } catch (err) {
      console.error('Språk-sletting feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke slette språk.' });
    }
  }, [selectedResume, user?.id]);

  const handleOpenEducationDialog = useCallback(() => {
    setEditingEducationItem(null);
    setEducationFormData({
      degree: '',
      fieldOfStudy: '',
      institution: '',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      grade: '',
      description: '',
      achievements: [],
      displayOrder: (selectedResume?.education?.length || 0) + 1,
      isVisible: true,
    });
    setShowEducationDialog(true);
  }, [selectedResume]);

  const handleEditEducationItem = useCallback((item: ResumeEducation) => {
    setEditingEducationItem(item);
    setEducationFormData(item);
    setShowEducationDialog(true);
  }, []);

  // POST/PATCH /api/resumes/:id/education — persisterer i resume_education-tabellen.
  const handleSaveEducation = useCallback(async () => {
    if (!selectedResume) return;
    if (!educationFormData.degree?.trim() || !educationFormData.institution?.trim()) {
      setSnackbar({ open: true, severity: 'warning', message: 'Grad og institusjon er påkrevd.' });
      return;
    }
    const payload = {
      degree: educationFormData.degree,
      fieldOfStudy: educationFormData.fieldOfStudy || null,
      institution: educationFormData.institution,
      location: educationFormData.location || null,
      startDate: educationFormData.startDate || new Date().toISOString().slice(0, 10),
      endDate: educationFormData.isCurrent ? null : educationFormData.endDate || null,
      isCurrent: Boolean(educationFormData.isCurrent),
      grade: educationFormData.grade || null,
      description: educationFormData.description || null,
      achievements: Array.isArray(educationFormData.achievements) ? educationFormData.achievements : [],
      displayOrder: educationFormData.displayOrder || (selectedResume.education?.length || 0) + 1,
    };
    try {
      if (editingEducationItem) {
        const updated = await apiRequest(
          `/api/resumes/${selectedResume.id}/education/${editingEducationItem.id}`,
          {
            method: 'PATCH',
            headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        setSelectedResume({
          ...selectedResume,
          education: (selectedResume.education || []).map((e) =>
            e.id === editingEducationItem.id ? (updated as ResumeEducation) : e,
          ),
        });
      } else {
        const created = await apiRequest(`/api/resumes/${selectedResume.id}/education`, {
          method: 'POST',
          headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSelectedResume({
          ...selectedResume,
          education: [...(selectedResume.education || []), created as ResumeEducation],
        });
      }
      setShowEducationDialog(false);
      setEditingEducationItem(null);
    } catch (err) {
      console.error('Utdanning-lagring feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke lagre utdanning.' });
    }
  }, [selectedResume, educationFormData, editingEducationItem, user?.id]);

  const handleDeleteEducation = useCallback(async (educationId: string) => {
    if (!selectedResume) return;
    try {
      await apiRequest(`/api/resumes/${selectedResume.id}/education/${educationId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
      setSelectedResume({
        ...selectedResume,
        education: (selectedResume.education || []).filter((e) => e.id !== educationId),
      });
    } catch (err) {
      console.error('Utdanning-sletting feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke slette utdanning.' });
    }
  }, [selectedResume, user?.id]);

  const handleVitnemalsportalenDataImport = useCallback((inputData: string) => {
    if (!selectedResume) {
      setSnackbar({ 
        open: true, 
        message: 'Vennligst opprett eller velg en CV først', 
        severity: 'warning' 
      });
      return;
    }

    try {
      let educationItems: any[] = [];

      // Check if input is XML or JSON
      const trimmedData = inputData.trim();
      if (trimmedData.startsWith('<') || trimmedData.includes('<?xml')) {
        // Parse XML from vitnemalsportalen (EMREX format)
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(inputData, 'text/xml');
        
        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
          throw new Error('Ugyldig XML-format');
        }

        // EMREX uses ELMO (European Learner Mobility) format
        // Try to find learningOpportunity, course, or education elements
        const educationElements = xmlDoc.querySelectorAll(
          'learningOpportunity, learningOpportunitySpecification, course, ' +
          'utdanning, education, vitnemal, diploma, qualification'
        );
        
        educationItems = Array.from(educationElements).map(elem => {
          // EMREX/ELMO format uses title, institution, etc.
          const title = elem.querySelector('title, grad, degree, type, name')?.textContent?.trim() || '';
          const issuer = elem.querySelector('issuer, institution, institusjon, skole, school, provider')?.textContent?.trim() || '';
          const field = elem.querySelector('subject, studieretning, fieldOfStudy, fagområde, field')?.textContent?.trim() || '';
          
          // Dates in EMREX can be in different formats
          const start = elem.querySelector('startDate, startdato, start, fra, from, issued')?.textContent?.trim() || '';
          const end = elem.querySelector('endDate, sluttdato, end, til, to, completed')?.textContent?.trim() || '';
          
          // Grades in EMREX
          const gradeElement = elem.querySelector('grade, karakter, snitt, average, result, resultLabel');
          const grade = gradeElement?.textContent?.trim() || '';
          
          // Location
          const location = elem.querySelector('location, sted, place, city, country')?.textContent?.trim() || '';
          
          // Description or additional info
          const description = elem.querySelector('description, beskrivelse, learningOutcome, comment')?.textContent?.trim() || '';
          
          return {
            degree: title,
            institution: issuer,
            fieldOfStudy: field,
            startDate: start,
            endDate: end,
            grade: grade,
            location: location,
            description: description,
          };
        });

        if (educationItems.length === 0) {
          throw new Error('Ingen utdanningsdata funnet i XML. Vennligst sjekk at du har limt inn EMREX-data eller vitnemålsportalen XML-eksport.');
        }
      } else {
        // Parse JSON
        const data = JSON.parse(inputData);
        educationItems = Array.isArray(data) ? data : [data];
      }
      
      const newEducationItems: ResumeEducation[] = educationItems.map((item: any, index: number) => ({
        id: `edu_${Date.now()}_${index}`,
        resumeId: selectedResume.id || '',
        degree: item.degree || item.grad || item.utdanning || '',
        institution: item.institution || item.institusjon || item.skole || '',
        fieldOfStudy: item.fieldOfStudy || item.studieretning || item.fagområde || '',
        startDate: item.startDate || item.startdato || '',
        endDate: item.endDate || item.sluttdato || '',
        grade: item.grade || item.karakter || item.snitt || '',
        location: item.location || item.sted || '',
        description: item.description || item.beskrivelse || '',
        achievements: [],
        displayOrder: (selectedResume.education?.length || 0) + index + 1,
        isVisible: true,
        isCurrent: false,
      }));

      handleUpdateResume({
        ...selectedResume,
        education: [...(selectedResume.education || []), ...newEducationItems],
      });

      setSnackbar({ 
        open: true, 
        message: `Importert ${educationItems.length} utdanning(er) fra vitnemalsportalen.no!`, 
        severity: 'success' 
      });
      setShowVitnemalsportalenDialog(false);
      setVitnemalsportalenInstructions(true);
    } catch (error) {
      setSnackbar({ 
        open: true, 
        message: `Kunne ikke parse data: ${error instanceof Error ? error.message : 'Vennligst sjekk formatet og prøv igjen.'}`, 
        severity: 'error' 
      });
    }
  }, [selectedResume, handleUpdateResume]);

  const handleOpenCertificationDialog = useCallback(() => {
    setEditingCertificationItem(null);
    setCertificationFormData({
      name: '',
      issuer: '',
      issueDate: '',
      expiryDate: '',
      credentialId: '',
      credentialUrl: '',
      description: '',
      displayOrder: (selectedResume?.certifications?.length || 0) + 1,
      isVisible: true,
    });
    setShowCertificationDialog(true);
  }, [selectedResume]);

  const handleEditCertificationItem = useCallback((item: ResumeCertification) => {
    setEditingCertificationItem(item);
    setCertificationFormData(item);
    setShowCertificationDialog(true);
  }, []);

  // POST/PATCH /api/resumes/:id/certifications — persisterer i resume_certifications.
  const handleSaveCertification = useCallback(async () => {
    if (!selectedResume) return;
    if (!certificationFormData.name?.trim() || !certificationFormData.issuer?.trim()) {
      setSnackbar({ open: true, severity: 'warning', message: 'Navn og utsteder er påkrevd.' });
      return;
    }
    const payload = {
      name: certificationFormData.name,
      issuer: certificationFormData.issuer,
      issueDate: certificationFormData.issueDate || new Date().toISOString().slice(0, 10),
      expiryDate: certificationFormData.expiryDate || null,
      credentialId: certificationFormData.credentialId || null,
      credentialUrl: certificationFormData.credentialUrl || null,
      description: certificationFormData.description || null,
      displayOrder: certificationFormData.displayOrder || (selectedResume.certifications?.length || 0) + 1,
    };
    try {
      if (editingCertificationItem) {
        const updated = await apiRequest(
          `/api/resumes/${selectedResume.id}/certifications/${editingCertificationItem.id}`,
          {
            method: 'PATCH',
            headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        setSelectedResume({
          ...selectedResume,
          certifications: (selectedResume.certifications || []).map((c) =>
            c.id === editingCertificationItem.id ? (updated as ResumeCertification) : c,
          ),
        });
      } else {
        const created = await apiRequest(`/api/resumes/${selectedResume.id}/certifications`, {
          method: 'POST',
          headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setSelectedResume({
          ...selectedResume,
          certifications: [...(selectedResume.certifications || []), created as ResumeCertification],
        });
      }
      setShowCertificationDialog(false);
      setEditingCertificationItem(null);
    } catch (err) {
      console.error('Sertifisering-lagring feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke lagre sertifisering.' });
    }
  }, [selectedResume, certificationFormData, editingCertificationItem, user?.id]);

  const handleDeleteCertification = useCallback(async (certificationId: string) => {
    if (!selectedResume) return;
    try {
      await apiRequest(`/api/resumes/${selectedResume.id}/certifications/${certificationId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
      setSelectedResume({
        ...selectedResume,
        certifications: (selectedResume.certifications || []).filter((c) => c.id !== certificationId),
      });
    } catch (err) {
      console.error('Sertifisering-sletting feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke slette sertifisering.' });
    }
  }, [selectedResume, user?.id]);

  const handleOpenJobDialog = useCallback(() => {
    setEditingJobApplication(null);
    setJobFormData({
      jobTitle: '',
      company: '',
      location: '',
      jobUrl: '',
      source: '',
      status: 'saved',
      appliedDate: '',
      interviewDate: '',
      notes: '',
      coverLetter: '',
      priority: 'medium',
      tags: [],
      resumeId: selectedResume?.id,
      userId: user?.id || '',
    });
    setShowJobDialog(true);
  }, [selectedResume, user?.id]);

  const handleEditJobApplication = useCallback((job: JobApplication) => {
    setEditingJobApplication(job);
    setJobFormData(job);
    setShowJobDialog(true);
  }, []);

  const handleSaveJobApplication = useCallback(() => {
    if (!user?.id) return;
    const newItem: JobApplication = {
      id: editingJobApplication?.id || `job-${Date.now()}`,
      userId: user.id,
      resumeId: jobFormData.resumeId,
      jobTitle: jobFormData.jobTitle || '',
      company: jobFormData.company || '',
      location: jobFormData.location || undefined,
      jobUrl: jobFormData.jobUrl || undefined,
      source: jobFormData.source || undefined,
      status: jobFormData.status || 'saved',
      appliedDate: jobFormData.appliedDate || undefined,
      deadline: jobFormData.deadline || undefined,
      interviewDate: jobFormData.interviewDate || undefined,
      interviewPreparation: jobFormData.interviewPreparation || undefined,
      notes: jobFormData.notes || undefined,
      coverLetter: jobFormData.coverLetter || undefined,
      priority: jobFormData.priority || 'medium',
      tags: jobFormData.tags || [],
    };

    const updatedJobs = editingJobApplication
      ? jobApplications.map((job) => (job.id === editingJobApplication.id ? newItem : job))
      : [newItem, ...jobApplications];

    setJobApplications(updatedJobs);
    
    // Save to database
    if (editingJobApplication) {
      updateJobApplicationMutation.mutate({ id: newItem.id, data: newItem });
    } else {
      createJobApplicationMutation.mutate(newItem);
    }
    
    setShowJobDialog(false);
    setEditingJobApplication(null);
  }, [user?.id, jobFormData, editingJobApplication, jobApplications, createJobApplicationMutation, updateJobApplicationMutation]);

  const handleDeleteJobApplication = useCallback((jobId: string) => {
    setJobApplications((prev) => prev.filter((job) => job.id !== jobId));
    deleteJobApplicationMutation.mutate(jobId);
  }, [deleteJobApplicationMutation]);

  const handleAnalyzeJobForResume = useCallback(async () => {
    if (!jobFormData.notes) {
      setSnackbar({ open: true, message: 'Ingen jobbeskrivelse funnet. Importer jobb fra finn.no først.', severity: 'warning' });
      return;
    }

    if (!selectedResume) {
      setSnackbar({ open: true, message: 'Velg eller opprett en CV først for å analysere jobben.', severity: 'warning' });
      return;
    }

    // Extract finn-code from notes to get full description
    const finnCodeMatch = jobFormData.notes.match(/Finn-kode:\s*(\d+)/);
    const finnCode = finnCodeMatch ? finnCodeMatch[1] : null;
    
    let jobData: any = null;
    if (finnCode) {
      const stored = localStorage.getItem(`finn_job_${finnCode}`);
      if (stored) {
        jobData = JSON.parse(stored);
      }
    }

    const jobDescription = jobData?.description || jobFormData.notes || '';
    
    if (!jobDescription || jobDescription.length < 50) {
      setSnackbar({ open: true, message: 'Jobbeskrivelsen er for kort for analyse. Importer jobb på nytt.', severity: 'warning' });
      return;
    }

    // Get user's actual CV data
    const userSkills = selectedResume.skills || [];
    const userExperience = selectedResume.experiences || [];
    const userEducation = selectedResume.education || [];
    const userCertifications = selectedResume.certifications || [];
    const userProjects = selectedResume.projects || [];

    // Extract key information from job description
    const jobKeywords: string[] = [];
    const suggestions: string[] = [];
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];
    
    // Common technical skills keywords
    const technicalSkills = [
      'javascript', 'typescript', 'python', 'java', 'c#', 'php', 'ruby', 'go', 'rust',
      'react', 'angular', 'vue', 'svelte', 'next.js', 'node.js', 'express', 'django',
      'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'docker', 'kubernetes',
      'aws', 'azure', 'gcp', 'git', 'ci/cd', 'jenkins', 'terraform',
      'agile', 'scrum', 'kanban', 'jira', 'confluence'
    ];

    const lowerDesc = jobDescription.toLowerCase();
    const userSkillsLower = userSkills.map(s => s.name?.toLowerCase() || '');

    // Find required skills in job description
    technicalSkills.forEach(skill => {
      if (lowerDesc.includes(skill.toLowerCase())) {
        jobKeywords.push(skill);
        
        // Check if user has this skill
        const hasSkill = userSkillsLower.some(userSkill => 
          userSkill.includes(skill.toLowerCase()) || skill.toLowerCase().includes(userSkill)
        );
        
        if (hasSkill) {
          matchedSkills.push(skill);
        } else {
          missingSkills.push(skill);
        }
      }
    });

    // Calculate match score
    const matchScore = jobKeywords.length > 0 
      ? Math.round((matchedSkills.length / jobKeywords.length) * 100)
      : 0;

    suggestions.push(`CV-MATCH: ${matchScore}% (${matchedSkills.length}/${jobKeywords.length} ferdigheter matcher)`);
    suggestions.push('');

    // Skills analysis
    if (matchedSkills.length > 0) {
      suggestions.push(`[MATCH] DU HAR DISSE FERDIGHETENE (fremhev disse!):`);
      matchedSkills.slice(0, 8).forEach((skill: string) => {
        const userSkill = userSkills.find((s) => 
          s.name?.toLowerCase().includes(skill.toLowerCase()) || 
          skill.toLowerCase().includes(s.name?.toLowerCase() || '')
        );
        if (userSkill && userSkill.proficiencyLevel) {
          suggestions.push(`   • ${skill.toUpperCase()} (${userSkill.proficiencyLevel}/5 nivå) - BEKREFT DETTE I CV`);
        } else {
          suggestions.push(`   • ${skill.toUpperCase()} - BEKREFT DETTE I CV`);
        }
      });
      suggestions.push('');
    }

    if (missingSkills.length > 0) {
      suggestions.push(`[WARN] MANGLER DISSE FERDIGHETENE:`);
      missingSkills.slice(0, 6).forEach((skill: string) => {
        // Check if they have related experience in projects
        const relatedProject = userProjects.find((project) =>
          project.description?.toLowerCase().includes(skill.toLowerCase())
        );
        const relatedExp = userExperience.find((experience) =>
          experience.description?.toLowerCase().includes(skill.toLowerCase())
          || (experience.achievements || []).some((achievement) => achievement.toLowerCase().includes(skill.toLowerCase()))
        );
        
        if (relatedProject || relatedExp) {
          suggestions.push(`   • ${skill.toUpperCase()} - Brukt i ${relatedProject ? 'prosjekt' : 'arbeid'}, fremhev dette!`);
        } else {
          suggestions.push(`   • ${skill.toUpperCase()} - Vurder å nevne lignende erfaring`);
        }
      });
      suggestions.push('');
    }

    // Experience analysis
    const experienceYearsMatch = jobDescription.match(/(\d+)\+?\s*(år|years?).*erfaring/i);
    if (experienceYearsMatch) {
      const requiredYears = parseInt(experienceYearsMatch[1]);
      const userYears = userExperience.reduce((total: number, exp: ResumeExperience) => {
        if (exp.startDate) {
          const start = new Date(exp.startDate);
          const end = exp.isCurrent ? new Date() : (exp.endDate ? new Date(exp.endDate) : new Date());
          return total + (end.getFullYear() - start.getFullYear());
        }
        return total;
      }, 0);
      
      if (userYears >= requiredYears) {
        suggestions.push(`[MATCH] ERFARING: Du har ${userYears} år (krever ${requiredYears}) - FREMHEV DETTE!`);
      } else {
        suggestions.push(`[WARN] ERFARING: Krever ${requiredYears} år, du har ${userYears} - fremhev relevante prosjekter`);
      }
      suggestions.push('');
    }

    // Education analysis
    if (lowerDesc.includes('bachelor') || lowerDesc.includes('master') || lowerDesc.includes('utdanning')) {
      const hasBachelor = userEducation.some(edu => 
        edu.degree?.toLowerCase().includes('bachelor')
      );
      const hasMaster = userEducation.some(edu => 
        edu.degree?.toLowerCase().includes('master')
      );
      
      if (lowerDesc.includes('master') && hasMaster) {
        suggestions.push(`[MATCH] UTDANNING: Du har Master - FREMHEV DETTE TYDELIG!`);
      } else if (lowerDesc.includes('bachelor') && hasBachelor) {
        suggestions.push(`[MATCH] UTDANNING: Du har Bachelor - FREMHEV DETTE TYDELIG!`);
      } else if (lowerDesc.includes('bachelor') || lowerDesc.includes('master')) {
        suggestions.push(`[WARN] UTDANNING: Jobb krever utdanning - ${userEducation.length > 0 ? 'fremhev din utdanning' : 'legg til utdanning'}`);
      }
      suggestions.push('');
    }

    // Certifications analysis
    if (lowerDesc.includes('sertifisering') || lowerDesc.includes('sertifikat')) {
      if (userCertifications.length > 0) {
        suggestions.push(`[MATCH] SERTIFISERINGER: Du har ${userCertifications.length} sertifisering(er):`);
        userCertifications.slice(0, 3).forEach((cert) => {
          suggestions.push(`   • ${cert.name} - ${cert.issuer || 'Fremhev dette!'}`);
        });
      } else {
        suggestions.push(`[WARN] SERTIFISERINGER: Jobb nevner sertifiseringer - vurder å legge til relevante`);
      }
      suggestions.push('');
    }

    // Specific recommendations
    suggestions.push(`[ACTION] ANBEFALTE HANDLINGER:`);
    
    if (matchScore >= 70) {
      suggestions.push(`   1. Din CV matcher godt! Bruk "Generer CV med AI" og bekreft alle matchede ferdigheter`);
      suggestions.push(`   2. Skriv søknadsbrev som fremhever dine ${matchedSkills.slice(0, 3).join(', ')} ferdigheter`);
    } else if (matchScore >= 40) {
      suggestions.push(`   1. Moderat match - fokuser på ${matchedSkills.slice(0, 3).join(', ')} i CV`);
      suggestions.push(`   2. For manglende ferdigheter, vis overførbar erfaring fra lignende teknologier`);
      suggestions.push(`   3. Fremhev prosjekter som viser læreevne og tilpasningsdyktighet`);
    } else {
      suggestions.push(`   1. Lav match - vurder om dette er riktig stilling`);
      suggestions.push(`   2. Hvis du søker, fokuser på overførbare ferdigheter og motivasjon`);
      suggestions.push(`   3. Fremhev evne til å lære nye teknologier raskt`);
    }

    suggestions.push('');
    suggestions.push(`ATS NØKKELORD: ${jobKeywords.slice(0, 12).join(', ')}`);
    
    setSnackbar({ 
      open: true, 
      message: `Analyse fullført! ${matchScore}% match med ${matchedSkills.length} matchede ferdigheter. Se notater.`, 
      severity: matchScore >= 60 ? 'success' : 'info'
    });

    // Add personalized analysis to notes
    setJobFormData(prev => ({
      ...prev,
      notes: `${prev.notes}\n\n--- PERSONLIG AI-ANALYSE (basert på din CV) ---\n${suggestions.join('\n')}`
    }));

  }, [jobFormData, selectedResume]);

  const handlePrepareForInterview = useCallback(async () => {
    if (!jobFormData.interviewDate) {
      setSnackbar({ open: true, message: 'Legg til intervjudato først for å generere forberedelse.', severity: 'warning' });
      return;
    }

    if (!selectedResume) {
      setSnackbar({ open: true, message: 'Velg en CV for å generere personlig intervjuforberedelse.', severity: 'warning' });
      return;
    }

    // Get job description from localStorage if available
    const finnCodeMatch = jobFormData.notes?.match(/Finn-kode:\s*(\d+)/);
    const finnCode = finnCodeMatch ? finnCodeMatch[1] : null;
    
    let jobData: any = null;
    if (finnCode) {
      const stored = localStorage.getItem(`finn_job_${finnCode}`);
      if (stored) {
        jobData = JSON.parse(stored);
      }
    }

    const jobDescription = jobData?.description || jobFormData.notes || '';
    const jobTitle = jobFormData.jobTitle || '';
    const company = jobFormData.company || '';

    // Generate common interview questions based on job
    const commonQuestions: string[] = [
      `Fortell meg om deg selv og hvorfor du er interessert i ${jobTitle}-stillingen?`,
      `Hva vet du om ${company} og hvorfor vil du jobbe her?`,
      `Hva er dine største styrker og svakheter?`,
      `Hvor ser du deg selv om 5 år?`,
      'Fortell om en utfordrende situasjon og hvordan du løste den.',
    ];

    // Add role-specific questions based on keywords
    const lowerDesc = jobDescription.toLowerCase();
    const lowerTitle = jobTitle.toLowerCase();
    
    if (lowerDesc.includes('react') || lowerDesc.includes('frontend') || lowerTitle.includes('frontend')) {
      commonQuestions.push(
        'Hvordan håndterer du state management i React-applikasjoner?',
        'Forklar forskjellen mellom controlled og uncontrolled components.',
        'Hvordan optimaliserer du ytelsen til en React-applikasjon?'
      );
    }

    if (lowerDesc.includes('backend') || lowerDesc.includes('api') || lowerTitle.includes('backend')) {
      commonQuestions.push(
        'Hvordan designer du RESTful APIs?',
        'Forklar hvordan du håndterer database-transaksjoner og feilhåndtering.',
        'Hvordan sikrer du API-sikkerhet og autentisering?'
      );
    }

    if (lowerDesc.includes('teamarbeid') || lowerDesc.includes('team') || lowerDesc.includes('agile')) {
      commonQuestions.push(
        'Hvordan jobber du i team? Gi et eksempel.',
        'Hvordan håndterer du konflikter i et team?',
        'Har du erfaring med Agile/Scrum metodikk?'
      );
    }

    if (lowerDesc.includes('leder') || lowerDesc.includes('ledelse') || lowerTitle.includes('lead')) {
      commonQuestions.push(
        'Hvordan motiverer du et team?',
        'Fortell om en gang du måtte ta en vanskelig beslutning som leder.',
        'Hvordan håndterer du underytende teammedlemmer?'
      );
    }

    // Questions to ask the employer
    const questionsToAsk: string[] = [
      `Hvordan ser en typisk arbeidsdag ut for en ${jobTitle}?`,
      'Hvordan er teamstrukturen og hvem kommer jeg til å jobbe tett med?',
      'Hvilke verktøy og teknologier bruker teamet daglig?',
      'Hvordan ser karriereutvikling og vekstmuligheter ut i selskapet?',
      'Hva er de største utfordringene teamet står overfor akkurat nå?',
      'Hvordan måler dere suksess i denne rollen?',
    ];

    // Key points to emphasize based on CV match
    const userSkills = selectedResume.skills || [];
    const userExperience = selectedResume.experiences || [];
    
    const keyPoints: string[] = [
      `Fremhev din erfaring med: ${userSkills.slice(0, 5).map(s => s.name).join(', ')}`,
    ];

    if (userExperience.length > 0) {
      const recentExp = userExperience[0];
      keyPoints.push(`[TIP] Snakk om din rolle som ${recentExp.jobTitle} hos ${recentExp.company}`);
    }

    if (lowerDesc) {
      keyPoints.push('[TIP] Referer tilbake til jobbeskrivelsen og vis hvordan din erfaring matcher');
    }

    keyPoints.push(
      '[TIP] Vær konkret - bruk STAR-metoden (Situasjon, Oppgave, Aksjon, Resultat)',
      '[TIP] Vis entusiasme for rollen og selskapet',
      '[TIP] Still gjennomtenkte spørsmål - vis at du har researcet selskapet',
      '[TIP] Forbered eksempler fra tidligere erfaring som demonstrerer nøkkelkompetanser'
    );

    // Calculate days until interview
    const interviewDate = new Date(jobFormData.interviewDate);
    const today = new Date();
    const daysUntil = Math.ceil((interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let urgencyMessage = '';
    if (daysUntil === 0) {
      urgencyMessage = '[URGENT] INTERVJUET ER I DAG! Siste gjennomgang:';
    } else if (daysUntil === 1) {
      urgencyMessage = '[URGENT] INTERVJUET ER I MORGEN! Gjennomgå dette i dag:';
    } else if (daysUntil <= 3) {
      urgencyMessage = `[SOON] ${daysUntil} dager til intervju. Start forberedelsen nå:`;
    } else {
      urgencyMessage = `${daysUntil} dager til intervju. God tid til forberedelse:`;
    }

    // Update job with preparation data
    setJobFormData(prev => ({
      ...prev,
      interviewPreparation: {
        commonQuestions,
        questionsToAsk,
        keyPoints,
        completed: false,
      },
      notes: `${prev.notes}\n\n--- INTERVJUFORBEREDELSE ---\n${urgencyMessage}\n\nIntervjudato: ${jobFormData.interviewDate}\n\nVANLIGE SPØRSMÅL DU KAN FÅ:\n${commonQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nSPØRSMÅL DU BØR STILLE:\n${questionsToAsk.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nNØKKELPUNKTER Å FREMHEVE:\n${keyPoints.join('\n')}\n\nSJEKKLISTE:\n[ ] Research selskapet og nylige nyheter\n[ ] Gjennomgå jobbeskrivelsen\n[ ] Forbered STAR-eksempler\n[ ] Forbered svar på vanlige spørsmål\n[ ] Forbered spørsmål til intervjueren\n[ ] Test teknisk utstyr (hvis virtuelt)\n[ ] Planlegg antrekk og reise (hvis fysisk)`
    }));

    setSnackbar({ 
      open: true, 
      message: `Intervjuforberedelse generert! ${commonQuestions.length} øvingsspørsmål klar. Se notater.`, 
      severity: 'success' 
    });

  }, [jobFormData, selectedResume]);

  const handleUpdateJobStatus = useCallback((jobId: string, status: JobApplication['status']) => {
    const job = jobApplications.find(j => j.id === jobId);
    if (job) {
      const updatedJob = { ...job, status };
      setJobApplications((prev) => prev.map((job) => (job.id === jobId ? updatedJob : job)));
      updateJobApplicationMutation.mutate({ id: jobId, data: { status } });
    }
  }, [jobApplications, updateJobApplicationMutation]);

  const handleSelectTemplate = useCallback((template: ResumeTemplate) => {
    if (!selectedResume) return;
    setSelectedResume({ ...selectedResume, templateId: template.id });
    handleUpdateResume({ templateId: template.id });
    setShowTemplateDialog(false);
    analytics?.trackEvent?.('nextrole_template_changed', {
      userId: user?.id,
      resumeId: selectedResume.id,
      templateId: template.id,
      templateName: template.name,
    });
  }, [selectedResume, handleUpdateResume, analytics, user?.id]);

  const handleTogglePublicResume = useCallback((isPublic: boolean) => {
    if (!selectedResume) return;
    const url = isPublic ? publicResumeUrl : undefined;
    setSelectedResume({ ...selectedResume, isPublic, publicUrl: url });
    handleUpdateResume({ isPublic, publicUrl: url });
  }, [selectedResume, handleUpdateResume, publicResumeUrl]);

  const handleCopyPublicUrl = useCallback(() => {
    if (!publicResumeUrl) return;
    navigator.clipboard.writeText(publicResumeUrl);
    setSnackbar({ open: true, message: 'Kobling kopiert til utklippstavle', severity: 'success' });
  }, [publicResumeUrl]);

  // Klon CV til ny variant — vanlig flyt for å lage en stillings-spesifikk
  // versjon av master-CV-en. POST /api/resumes/:id/clone.
  const handleCloneResume = useCallback(async (id: string, title: string) => {
    try {
      const res = await apiRequest(`/api/resumes/${id}/clone`, {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res?.resumeId) {
        queryClient.invalidateQueries({ queryKey: ['resumes'] });
        setSnackbar({
          open: true,
          severity: 'success',
          message: `"Kopi av ${title}" opprettet.`,
        });
        analytics?.trackEvent?.('nextrole_cv_cloned', {
          userId: user?.id,
          sourceResumeId: id,
          newResumeId: res.resumeId,
        });
      }
    } catch (err) {
      console.error('Klon-feil', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke klone CV.' });
    }
  }, [user?.id, queryClient, analytics]);

  // Cover letter library
  const [showCoverLetterLibrary, setShowCoverLetterLibrary] = useState(false);
  // Mock interview — kan åpnes med valgfri job-application-binding
  const [showMockInterview, setShowMockInterview] = useState(false);
  const [mockInterviewAppId, setMockInterviewAppId] = useState<string | null>(null);
  // Video-presentasjon
  const [showVideoPresentation, setShowVideoPresentation] = useState(false);
  const [videoPresentationAppId, setVideoPresentationAppId] = useState<string | null>(null);
  // GDPR
  const [showGdprDialog, setShowGdprDialog] = useState(false);
  // Bransje-templates
  const [showIndustryPicker, setShowIndustryPicker] = useState(false);
  // arbeidsplassen.no-import
  const [showArbeidsplassen, setShowArbeidsplassen] = useState(false);
  // Public CV analytics
  const [showCvAnalytics, setShowCvAnalytics] = useState(false);
  // Education verification
  const [showEducationVerification, setShowEducationVerification] = useState(false);
  // Sigrid — karrierementer
  const [showSigrid, setShowSigrid] = useState(false);
  // Referrals
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  // Job Kanban + milestones
  const [showKanbanDialog, setShowKanbanDialog] = useState(false);
  const [milestoneDialogApp, setMilestoneDialogApp] = useState<{ id: string; jobTitle?: string; company?: string } | null>(null);

  // Versjon-historikk — POST /versions, GET /versions, /restore.
  const [showVersionHistoryDialog, setShowVersionHistoryDialog] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; versionNumber: number; label: string | null; createdAt: string; notes?: string | null }>>([]);
  const [versionLoading, setVersionLoading] = useState(false);

  const refreshVersions = useCallback(async () => {
    if (!selectedResume) return;
    setVersionLoading(true);
    try {
      const list = await apiRequest(`/api/resumes/${selectedResume.id}/versions`, {
        headers: { 'x-user-id': user?.id || '' },
      });
      setVersions(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Hent versjoner feilet', err);
    } finally {
      setVersionLoading(false);
    }
  }, [selectedResume, user?.id]);

  const handleSaveVersion = useCallback(async () => {
    if (!selectedResume) return;
    if (!requireEntitlement('canUseVersionHistory', 'version-history')) return;
    try {
      await apiRequest(`/api/resumes/${selectedResume.id}/versions`, {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setSnackbar({ open: true, severity: 'success', message: 'Versjon lagret.' });
      analytics?.trackEvent?.('nextrole_version_saved', {
        userId: user?.id,
        resumeId: selectedResume.id,
      });
      refreshVersions();
    } catch (err) {
      console.error('Lagre versjon feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke lagre versjon.' });
    }
  }, [selectedResume, user?.id, refreshVersions, analytics]);

  const handleRestoreDbVersion = useCallback(async (versionId: string) => {
    if (!selectedResume) return;
    if (!window.confirm('Gjenopprette denne versjonen? Nåværende innhold lagres som auto-snapshot før restore.')) return;
    try {
      await apiRequest(`/api/resumes/${selectedResume.id}/versions/${versionId}/restore`, {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '' },
      });
      // Refetch full CV
      const full = await apiRequest(`/api/resumes/${selectedResume.id}`, {
        headers: { 'x-user-id': user?.id || '' },
      });
      if (full?.resume) {
        setSelectedResume({
          ...full.resume,
          experiences: full.experiences ?? [],
          education: full.education ?? [],
          skills: full.skills ?? [],
          certifications: full.certifications ?? [],
          projects: full.projects ?? [],
          languages: full.languages ?? [],
        });
      }
      setSnackbar({ open: true, severity: 'success', message: 'Versjon gjenopprettet.' });
      setShowVersionHistoryDialog(false);
      refreshVersions();
    } catch (err) {
      console.error('Restore feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke gjenopprette versjon.' });
    }
  }, [selectedResume, user?.id, refreshVersions]);

  const handleDeleteVersion = useCallback(async (versionId: string) => {
    if (!selectedResume) return;
    try {
      await apiRequest(`/api/resumes/${selectedResume.id}/versions/${versionId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' },
      });
      setVersions((vs) => vs.filter((v) => v.id !== versionId));
    } catch (err) {
      console.error('Slett versjon feilet', err);
    }
  }, [selectedResume, user?.id]);

  // Reorder skills (egen dialog siden chip-layout ikke har plass til piler)
  const [showSkillReorderDialog, setShowSkillReorderDialog] = useState(false);

  // Importer LinkedIn data-eksport (ZIP) — POST /api/resumes/:id/import-linkedin-zip
  const [showLinkedInZipDialog, setShowLinkedInZipDialog] = useState(false);
  const [linkedInZipUploading, setLinkedInZipUploading] = useState(false);

  const handleImportLinkedInZip = useCallback(async (file: File) => {
    if (!selectedResume) return;
    setLinkedInZipUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiRequest(
        `/api/resumes/${selectedResume.id}/import-linkedin-zip`,
        {
          method: 'POST',
          headers: { 'x-user-id': user?.id || '' },
          body: fd,
        },
      );
      const counts = res?.imported ?? {};
      const total =
        (counts.experiences ?? 0) +
        (counts.education ?? 0) +
        (counts.skills ?? 0) +
        (counts.languages ?? 0) +
        (counts.certifications ?? 0);
      if (total > 0 || counts.personalInfoMerged) {
        setSnackbar({
          open: true,
          severity: 'success',
          message: `LinkedIn-data importert: ${counts.experiences ?? 0} erfaringer, ${counts.education ?? 0} utdanning, ${counts.skills ?? 0} ferdigheter, ${counts.languages ?? 0} språk, ${counts.certifications ?? 0} sertifiseringer.`,
        });
        // Refetch CV
        const full = await apiRequest(`/api/resumes/${selectedResume.id}`, {
          headers: { 'x-user-id': user?.id || '' },
        });
        if (full?.resume) {
          setSelectedResume({
            ...full.resume,
            experiences: full.experiences ?? [],
            education: full.education ?? [],
            skills: full.skills ?? [],
            certifications: full.certifications ?? [],
            projects: full.projects ?? [],
            languages: full.languages ?? [],
          });
        }
      } else {
        setSnackbar({
          open: true,
          severity: 'info',
          message: 'Ingen ny data å importere — alt fra LinkedIn finnes allerede.',
        });
      }
      setShowLinkedInZipDialog(false);
    } catch (err) {
      console.error('LinkedIn-import feilet', err);
      setSnackbar({
        open: true,
        severity: 'error',
        message: 'LinkedIn-import feilet. Sjekk at filen er en gyldig LinkedIn-eksport-ZIP.',
      });
    } finally {
      setLinkedInZipUploading(false);
    }
  }, [selectedResume, user?.id]);

  // Importer GitHub-prosjekter — POST /api/resumes/:id/import-github
  const [showGithubDialog, setShowGithubDialog] = useState(false);
  const [githubUsername, setGithubUsername] = useState('');
  const [githubImporting, setGithubImporting] = useState(false);

  const handleImportGithub = useCallback(async () => {
    if (!selectedResume) return;
    if (!requireEntitlement('canImportGithub', 'github-import')) return;
    const username = githubUsername.trim();
    if (!username) {
      setSnackbar({ open: true, severity: 'warning', message: 'Skriv inn GitHub-brukernavn.' });
      return;
    }
    setGithubImporting(true);
    try {
      const res = await apiRequest(`/api/resumes/${selectedResume.id}/import-github`, {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, max: 6 }),
      });
      const imported = res?.imported ?? 0;
      if (imported > 0 && Array.isArray(res?.items)) {
        setSelectedResume({
          ...selectedResume,
          projects: [...(selectedResume.projects || []), ...res.items],
        });
        setSnackbar({
          open: true,
          severity: 'success',
          message: `Importerte ${imported} prosjekt${imported === 1 ? '' : 'er'} fra GitHub.`,
        });
        analytics?.trackEvent?.('nextrole_github_import_completed', {
          userId: user?.id,
          resumeId: selectedResume.id,
          username,
          imported,
        });
        setShowGithubDialog(false);
        setGithubUsername('');
      } else {
        setSnackbar({
          open: true,
          severity: 'info',
          message: 'Ingen nye prosjekter å importere (kanskje alle er allerede lagt til).',
        });
      }
    } catch (err) {
      console.error('GitHub-import feilet', err);
      const msg = err instanceof Error ? err.message : 'Ukjent feil';
      setSnackbar({
        open: true,
        severity: 'error',
        message: msg.includes('404')
          ? `Fant ikke GitHub-brukeren "${username}".`
          : 'GitHub-import feilet.',
      });
    } finally {
      setGithubImporting(false);
    }
  }, [selectedResume, githubUsername, user?.id]);

  // Skriv ut / lagre som PDF via browseren — bruker innebygd print-flow
  // for 1:1 match med live-preview. Åpner et nytt vindu med kun
  // template-rendering, injiserer minimal CSS, og trigger window.print()
  // som lar brukeren lagre som PDF eller printe.
  const handlePrintPdf = useCallback(() => {
    if (!selectedResume) return;
    const previewEl = document.querySelector('[data-resume-print-source]') as HTMLElement | null;
    if (!previewEl) {
      setSnackbar({
        open: true,
        severity: 'warning',
        message: 'Slå på forhåndsvisning først for å printe.',
      });
      return;
    }
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: 'Pop-up blokkert — tillat pop-ups for å skrive ut.',
      });
      return;
    }
    // Hent alle stylesheets fra hovedvinduet — MUI/Emotion injecter
    // CSS via <style data-emotion>-tags. Vi kopierer dem inn i print-
    // vinduet så templaten ser identisk ut.
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');
    printWindow.document.open();
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="${selectedResume.language ?? 'no'}">
<head>
  <meta charset="utf-8" />
  <title>${(selectedResume.personalInfo?.fullName ?? selectedResume.title ?? 'CV').replace(/</g, '&lt;')}</title>
  ${styles}
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #print-root > div { transform: none !important; width: 100% !important; }
    #print-root [style*="transform: scale"] { transform: none !important; width: 100% !important; }
  </style>
</head>
<body>
  <div id="print-root">${previewEl.innerHTML}</div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => { window.print(); }, 300);
      window.addEventListener('afterprint', () => window.close());
    });
  </script>
</body>
</html>
    `);
    printWindow.document.close();
  }, [selectedResume]);

  // Lag engelsk versjon av CV — kjør AI-translate, klon den originale,
  // og bytt innholdet i klonen til den oversatte versjonen.
  const handleCreateEnglishVersion = useCallback(async () => {
    if (!selectedResume) return;
    if (!requireEntitlement('canTranslate', 'translate')) return;
    setSnackbar({
      open: true,
      severity: 'info',
      message: 'Oversetter til engelsk — kan ta 15–30 sekunder …',
    });
    try {
      // 1. Få oversatt JSON fra Claude
      const translatedRes = await apiRequest(`/api/resumes/${selectedResume.id}/ai-translate`, {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLang: 'en' }),
      });
      if (!translatedRes?.translated) {
        setSnackbar({ open: true, severity: 'error', message: 'Oversettelse feilet.' });
        return;
      }
      // 2. Klon CV
      const cloneRes = await apiRequest(`/api/resumes/${selectedResume.id}/clone`, {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${selectedResume.title} (English)` }),
      });
      if (!cloneRes?.resumeId) {
        setSnackbar({ open: true, severity: 'error', message: 'Klon feilet.' });
        return;
      }
      const newId = cloneRes.resumeId as string;
      const t = translatedRes.translated as Record<string, any>;

      // 3. Oppdater den nye CV-ens personalInfo + language = 'en'
      await apiRequest(`/api/resumes/${newId}`, {
        method: 'PATCH',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalInfo: t.personalInfo ?? selectedResume.personalInfo,
          targetJobTitle: t.targetJobTitle ?? selectedResume.targetJobTitle,
          language: 'en',
        }),
      });

      // 4. Hent klonens sub-ressurser, og oppdater hver med oversatt tekst.
      // Vi gjør best-effort match per index/title.
      const full = await apiRequest(`/api/resumes/${newId}`, {
        headers: { 'x-user-id': user?.id || '' },
      });
      const translatedExps = (t.experiences ?? []) as any[];
      const updates: Promise<unknown>[] = [];
      (full.experiences ?? []).forEach((exp: any, i: number) => {
        const tExp = translatedExps[i];
        if (!tExp) return;
        updates.push(
          apiRequest(`/api/resumes/${newId}/experiences/${exp.id}`, {
            method: 'PATCH',
            headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobTitle: tExp.jobTitle ?? exp.jobTitle,
              description: tExp.description ?? exp.description,
              achievements: Array.isArray(tExp.achievements) ? tExp.achievements : exp.achievements,
            }),
          }),
        );
      });
      const translatedEdu = (t.education ?? []) as any[];
      (full.education ?? []).forEach((ed: any, i: number) => {
        const tEd = translatedEdu[i];
        if (!tEd) return;
        updates.push(
          apiRequest(`/api/resumes/${newId}/education/${ed.id}`, {
            method: 'PATCH',
            headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              degree: tEd.degree ?? ed.degree,
              fieldOfStudy: tEd.fieldOfStudy ?? ed.fieldOfStudy,
              description: tEd.description ?? ed.description,
            }),
          }),
        );
      });
      await Promise.all(updates);
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setSnackbar({
        open: true,
        severity: 'success',
        message: `Engelsk versjon opprettet — gå til CV-listen for å finne den.`,
      });
      analytics?.trackEvent?.('nextrole_english_version_created', {
        userId: user?.id,
        sourceResumeId: selectedResume.id,
        newResumeId: cloneRes.resumeId,
      });
    } catch (err) {
      console.error('Engelsk versjon feilet', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke lage engelsk versjon.' });
    }
  }, [selectedResume, user?.id, queryClient, analytics]);

  // Publiser/avpubliser CV — POST /api/resumes/:id/publish
  const handlePublishResumeFlow = useCallback(async () => {
    if (!selectedResume) return;
    if (!requireEntitlement('canPublishPublic', 'public-share')) return;
    const desiredPublic = !selectedResume.isPublic;
    try {
      const res = await apiRequest(`/api/resumes/${selectedResume.id}/publish`, {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: desiredPublic }),
      });
      setSelectedResume({
        ...selectedResume,
        isPublic: res.isPublic,
        publicUrl: res.publicUrl,
      });
      analytics?.trackEvent?.(
        res.isPublic ? 'nextrole_cv_published_public' : 'nextrole_cv_unpublished',
        { userId: user?.id, resumeId: selectedResume.id, publicUrl: res.publicUrl },
      );
      if (res.isPublic && res.publicUrl) {
        const link = `${window.location.origin}/cv/${res.publicUrl}`;
        try {
          await navigator.clipboard.writeText(link);
          setSnackbar({
            open: true,
            severity: 'success',
            message: 'CV publisert. Lenken er kopiert til utklippstavlen.',
          });
        } catch {
          setSnackbar({
            open: true,
            severity: 'success',
            message: `CV publisert: ${link}`,
          });
        }
      } else {
        setSnackbar({
          open: true,
          severity: 'info',
          message: 'CV-en er nå privat — lenken vil ikke fungere.',
        });
      }
    } catch (err) {
      console.error('Publiser-feil', err);
      setSnackbar({ open: true, severity: 'error', message: 'Kunne ikke publisere CV.' });
    }
  }, [selectedResume, user?.id]);

  const handleDeleteResume = useCallback((id: string) => {
    setConfirmDeleteResumeId(id);
  }, []);

  const executeDeleteResume = useCallback(() => {
    if (!confirmDeleteResumeId) return;
    deleteResumeMutation.mutate(confirmDeleteResumeId);
    setConfirmDeleteResumeId(null);
  }, [confirmDeleteResumeId, deleteResumeMutation]);

  // GDPR & Legal Compliance Handlers
  const handleAcceptTerms = useCallback(() => {
    GDPRUtils.setConsent({
      essential: true,
      analytics: true,
      marketing: false,
      terms: true,
    });
    setShowTermsDialog(false);
    setSnackbar({ open: true, message: 'Vilkår akseptert. Takk!', severity: 'success' });
  }, []);

  const handleCookieConsent = useCallback((analytics: boolean = false, marketing: boolean = false) => {
    GDPRUtils.setConsent({
      essential: true,
      analytics,
      marketing,
      terms: GDPRUtils.hasAcceptedTerms(),
    });
    setShowCookieConsent(false);
    AccessibilityUtils.announce('Cookie-innstillinger lagret.');
  }, []);

  const handleExportData = useCallback(async () => {
    if (!user?.id) return;
    try {
      await GDPRUtils.exportUserData(user.id);
      setSnackbar({
        open: true,
        message: 'Dataene dine har blitt eksportert og lastet ned.',
        severity: 'success',
      });
      GDPRUtils.logDataProcessing(user.id, 'EXPORT_DATA', 'COMPLETE_PROFILE');
    } catch (error) {
      console.error('Data export error:', error);
      setSnackbar({
        open: true,
        message: `Feil ved eksport av data: ${error instanceof Error ? error.message : 'Ukjent feil'}. Vennligst prøv igjen.`,
        severity: 'error',
      });
    }
  }, [user?.id]);

  const handleDeleteAccount = useCallback(async () => {
    if (!user?.id) return;
    const password = prompt('Skriv inn ditt passord for å bekrefte sletting av konto:');
    if (!password) return;

    try {
      await GDPRUtils.deleteUserAccount(user.id, password);
      setSnackbar({
        open: true,
        message: 'Kontoen din har blitt permanent slettet.',
        severity: 'success',
      });
      // Redirect to home page
      window.location.href = '/';
    } catch (error) {
      console.error('Account deletion error:', error);
      setSnackbar({
        open: true,
        message: `Feil ved sletting av konto: ${error instanceof Error ? error.message : 'Ukjent feil'}. Sjekk passordet og prøv igjen.`,
        severity: 'error',
      });
    }
  }, [user?.id]);

  const handleRunAccessibilityAudit = useCallback(() => {
    const auditResults = WCAGChecklist.runAudit();
    const message = Object.entries(auditResults)
      .map(([key, passed]) => `${key}: ${passed ? 'OK' : 'FEIL'}`)
      .join('\n');

    console.log('WCAG Accessibility Audit Results:', auditResults);
    console.log('Detailed audit message:', message);
    setSnackbar({
      open: true,
      message: `Tilgjengelighetskontroll fullført. Resultat:\n${message}`,
      severity: auditResults.formLabels && auditResults.skipLink ? 'success' : 'warning',
    });
  }, []);

  const handleImportProjects = useCallback(() => {
    if (selectedResume) {
      importProjectsMutation.mutate(selectedResume.id);
    }
  }, [selectedResume, importProjectsMutation]);

  const handleAIAnalyze = useCallback(() => {
    if (selectedResume) {
      aiAnalyzeMutation.mutate({
        resumeId: selectedResume.id,
        jobDescription: aiJobDescription || undefined,
      });
    }
  }, [selectedResume, aiJobDescription, aiAnalyzeMutation]);

  const handleExport = useCallback(async (format: 'pdf' | 'docx' | 'txt' | 'json' | 'html') => {
    if (!selectedResume) return;

    if (format === 'pdf') {
      exportResumeMutation.mutate({
        resumeId: selectedResume.id,
        format,
      });
      return;
    }

    if (format === 'json') {
      const payload = JSON.stringify({ ...selectedResume, portfolioItems }, null, 2);
      downloadBlob(new Blob([payload], { type: 'application/json' }), `resume-${selectedResume.id}.json`);
      return;
    }

    if (format === 'txt') {
      const content = buildPlainTextResume(selectedResume, portfolioItems);
      downloadBlob(new Blob([content], { type: 'text/plain' }), `resume-${selectedResume.id}.txt`);
      return;
    }

    if (format === 'html') {
      const content = buildHtmlResume(selectedResume, portfolioItems);
      downloadBlob(new Blob([content], { type: 'text/html' }), `resume-${selectedResume.id}.html`);
      return;
    }

    if (format === 'docx') {
      const docxBlob = await buildDocxResume(selectedResume, portfolioItems);
      downloadBlob(docxBlob, `resume-${selectedResume.id}.docx`);
    }
  }, [selectedResume, exportResumeMutation, downloadBlob, buildPlainTextResume, buildHtmlResume, buildDocxResume, portfolioItems]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="warning">
          Vennligst logg inn for å bruke NextRole
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }} role="main" aria-label="CV-builder hovedinnhold">
      {/* Terms & Conditions Dialog */}
      <TermsAndConditionsDialog
        open={showTermsDialog}
        onClose={() => setShowTermsDialog(false)}
        onAccept={handleAcceptTerms}
      />

      {/* Cookie Consent Dialog */}
      <CookieConsentDialog
        open={showCookieConsent}
        onConsent={() => handleCookieConsent(true, false)}
        onReject={() => handleCookieConsent(false, false)}
      />

      {/* Privacy Policy Dialog */}
      <PrivacyPolicyDialog open={showPrivacyDialog} onClose={() => setShowPrivacyDialog(false)} />

      {/* Data Management Dialog */}
      <DataManagementDialog
        open={showDataManagement}
        onClose={() => setShowDataManagement(false)}
        onExportData={handleExportData}
        onDeleteData={handleDeleteAccount}
      />

      <Dialog open={initializingResume} maxWidth="sm" fullWidth>
        <DialogTitle>Initierer CV</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ py: 2 }}>
            <Stack spacing={1} alignItems="center">
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                {initializationMessage || 'Samler informasjon...'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {motivationalMessages[initializationStep % motivationalMessages.length]}
              </Typography>
            </Stack>

            <Box>
              <LinearProgress
                variant="determinate"
                value={Math.min((initializationStep / (initializationSteps.length - 1)) * 100, 100)}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            <Stepper activeStep={initializationStep} orientation="vertical">
              {initializationSteps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Stack>
        </DialogContent>
      </Dialog>
      <Box
        sx={{
          background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 80%)',
          borderRadius: 4,
          p: { xs: 2, md: 3 },
          boxShadow: '0 12px 30px rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
      >
      {/* Header with Brand Kit */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
            {/* CreatorHub ResumeBuilder Logo */}
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2,
                background: 'linear-gradient(145deg, #2563eb 0%, #1d4ed8 60%, #ff8c00 140%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(15, 23, 42, 0.15)'}}
            >
              <Typography
                sx={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#fff',
                  lineHeight: 1,
                  letterSpacing: '0.5px'}}
              >
                RB
              </Typography>
            </Box>
            
            <Box>
              <Typography
                variant="h3"
                gutterBottom
                sx={{
                  fontWeight: 700,
                  fontFamily: 'Poppins, sans-serif',
                  color: '#0f172a',
                  letterSpacing: '-0.5px'}}
              >
                NextRole <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary', fontSize: '0.6em' }}>by CreatorHub</Box>
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720 }}>
                Å søke jobb har aldri vært enklere. AI-drevet CV-bygger, ATS-optimalisering og 15 maler — alt på norsk.
              </Typography>
            </Box>
          </Box>

          {/* Auto-save status and actions */}
          {selectedResume && (
            <Stack direction="row" spacing={2} alignItems="center">
              {/* Auto-save status indicator */}
              <Chip
                icon={
                  autoSaveStatus === 'saving' ? <SaveIcon /> :
                  autoSaveStatus === 'saved' ? <CheckIcon /> :
                  autoSaveStatus === 'error' ? <ErrorIcon /> :
                  <SaveIcon />
                }
                label={
                  autoSaveStatus === 'saving' ? 'Lagrer...' :
                  autoSaveStatus === 'saved' ? 'Lagret' :
                  autoSaveStatus === 'error' ? 'Lagringsfeil' :
                  'Venter...'
                }
                color={
                  autoSaveStatus === 'saved' ? 'success' :
                  autoSaveStatus === 'error' ? 'error' :
                  'default'
                }
                size="small"
                variant={autoSaveStatus === 'saved' ? 'outlined' : 'filled'}
              />

              {/* Draft indicator */}
              {isDraft && (
                <Chip
                  label={`Utkast - Versjon ${currentVersion}`}
                  color="warning"
                  size="small"
                  variant="outlined"
                />
              )}

              {/* Version history button */}
              <Tooltip title="Se versjonshistorikk">
                <IconButton onClick={() => setShowVersionDialog(true)} size="small">
                  <Badge badgeContent={versionHistory.length} color="primary">
                    <HistoryIcon />
                  </Badge>
                </IconButton>
              </Tooltip>

              {/* Restore backup button */}
              <Tooltip title="Gjenopprett fra backup">
                <IconButton onClick={handleRestoreFromBackup} size="small">
                  <RestoreIcon />
                </IconButton>
              </Tooltip>

              {/* Save as draft button */}
              <Button
                startIcon={<SaveIcon />}
                onClick={handleSaveAsDraft}
                variant="outlined"
                size="small"
                disabled={autoSaveStatus === 'saving'}
              >
                Lagre utkast
              </Button>

              {/* Publish button */}
              {isDraft && (
                <Button
                  startIcon={<PublishIcon />}
                  onClick={handlePublishResume}
                  variant="contained"
                  color="primary"
                  size="small"
                  disabled={autoSaveStatus === 'saving'}
                >
                  Publiser
                </Button>
              )}
            </Stack>
          )}
        </Box>
      </Box>

      {/* Marketplace Card Preview (Optional - can be removed in production) */}
      {!selectedResume && resumes.length === 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              letterSpacing: '0.2px',
              mb: 2}}
          >
            CreatorHub Marketplace
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <CreatorHubMarketplace 
                onSelect={handleCreateResume}
                showPricing={true}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  p: 3,
                  borderRadius: 2,
                  border: '2px dashed #2563eb',
                  background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.05) 0%, rgba(37, 99, 235, 0.05) 100%)'}}
              >
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    color: '#2563eb'}}
                >
                  Marketplace Feature
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Dette kortet viser hvordan CreatorHub apps vil vises i marketplace for andre brukere.
                  Den inneholder:
                </Typography>
                <List dense>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText primary="NextRole by CreatorHub branding" />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText primary="App-ikon med gradient" />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText primary="Funksjonsliste og fordeler" />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText primary="Prisinformasjon" />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <CheckIcon sx={{ color: '#2563eb', fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText primary="CTA-knapp" />
                  </ListItem>
                </List>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Stepper */}
      <Stepper
        activeStep={activeStep}
        orientation="vertical"
        sx={{
          mb: 4,
          p: { xs: 1.5, md: 2 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255, 255, 255, 0.85)',
        }}
      >
        <Step>
          <StepLabel>Velg eller lag CV</StepLabel>
          <StepContent>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: '#ffffff',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 6px 18px rgba(255,255,255,0.05)',
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Søk CV"
                      value={resumeSearch}
                      onChange={(e) => setResumeSearch(e.target.value)}
                      placeholder="Søk på navn eller tittel"
                      fullWidth
                    />
                    <FormControl sx={{ minWidth: 180 }}>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={resumeStatusFilter}
                        label="Status"
                        onChange={(e) => setResumeStatusFilter(e.target.value as typeof resumeStatusFilter)}
                      >
                        <MenuItem value="all">Alle</MenuItem>
                        <MenuItem value="draft">Utkast</MenuItem>
                        <MenuItem value="active">Aktiv</MenuItem>
                        <MenuItem value="archived">Arkivert</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl sx={{ minWidth: 180 }}>
                      <InputLabel>Sorter</InputLabel>
                      <Select
                        value={resumeSort}
                        label="Sorter"
                        onChange={(e) => setResumeSort(e.target.value as typeof resumeSort)}
                      >
                        <MenuItem value="updated">Sist oppdatert</MenuItem>
                        <MenuItem value="created">Opprettet</MenuItem>
                        <MenuItem value="title">Tittel</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                </Paper>
              </Grid>
              {/* Create New Button */}
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: '2px dashed',
                    borderColor: '#2563eb',
                    bgcolor: '#f8fafc',
                    boxShadow: '0 10px 24px rgba(255,255,255,0.06)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                    '&:hover': {
                      bgcolor: '#f1f5f9',
                      borderColor: '#ff8c00',
                      transform: 'translateY(-3px)',
                      boxShadow: '0 14px 28px rgba(255,255,255,0.08)',
                    },
                  }}
                  onClick={handleCreateResume}
                >
                  <CardContent sx={{ textAlign: 'center', py: 6 }}>
                    <AddIcon sx={{ fontSize: 64, color: '#2563eb', mb: 2 }} />
                    <Typography
                      variant="h6"
                      sx={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                        color: '#2563eb'}}
                    >
                      Lag ny CV
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Start fra scratch med AI-assistanse
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Importer eksisterende CV (PDF/DOCX) */}
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: 'rgba(99, 102, 241, 0.35)',
                    bgcolor: '#ffffff',
                    boxShadow: '0 10px 24px rgba(255,255,255,0.06)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 14px 28px rgba(99, 102, 241, 0.18)',
                    },
                  }}
                  data-onboarding-target="import-cv"
                  onClick={() => setShowCvImportDialog(true)}
                >
                  <CardContent sx={{ textAlign: 'center', py: 6 }}>
                    <UploadIcon sx={{ fontSize: 64, color: 'secondary.main', mb: 2 }} />
                    <Typography
                      variant="h6"
                      sx={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                        color: 'secondary.main',
                      }}
                    >
                      Importer CV
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Last opp PDF eller DOCX — Claude strukturerer den
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* LinkedIn Import Button */}
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: linkedIn.state.isAuthenticated ? 'rgba(37, 99, 235, 0.35)' : 'rgba(255, 140, 0, 0.35)',
                    bgcolor: '#ffffff',
                    boxShadow: '0 10px 24px rgba(255,255,255,0.06)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: linkedIn.state.isAuthenticated
                        ? '0 14px 28px rgba(37, 99, 235, 0.18)'
                        : '0 14px 28px rgba(255, 140, 0, 0.18)',
                    },
                  }}
                  onClick={handleLinkedInConnect}
                >
                  <CardContent sx={{ textAlign: 'center', py: 6 }}>
                    <LinkedInIcon 
                      sx={{ 
                        fontSize: 64, 
                        color: linkedIn.state.isAuthenticated ? '#2563eb' : '#ff8c00', 
                        mb: 2 
                      }} 
                    />
                    <Typography 
                      variant="h6"
                      sx={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                        color: linkedIn.state.isAuthenticated ? '#2563eb' : '#ff8c00'}}
                    >
                      {linkedIn.state.isAuthenticated ? 'Importer fra LinkedIn' : 'Koble til LinkedIn'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {linkedIn.state.isAuthenticated 
                        ? 'Synkroniser profil og importer data' 
                        : 'Logg inn og importer CV-data automatisk'}
                    </Typography>
                    {linkedIn.state.isAuthenticated && (
                      <Chip 
                        label="Tilkoblet" 
                        sx={{ 
                          mt: 1,
                          background: 'linear-gradient(135deg, #ff8c00 0%, #2563eb 100%)',
                          color: '#fff',
                          fontWeight: 600}}
                        size="small" 
                        icon={<CheckIcon sx={{ color: '#fff !important' }} />}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Existing Resumes */}
              {filteredResumes.map((resume) => (
                <Grid item xs={12} md={4} key={resume.id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      cursor: 'pointer','&:hover': {
                        boxShadow: 6,
                      }}}
                    onClick={() => handleSelectResume(resume)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6" noWrap>
                          {resume.title}
                        </Typography>
                        <Chip 
                          label={resume.status}
                          size="small"
                          color={resume.status === 'active' ? 'success' : 'default'}
                        />
                      </Box>

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {resume.personalInfo.professionalTitle || 'Ingen tittel'}
                      </Typography>

                      {/* ATS Score */}
                      <Box sx={{ mt: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="caption">ATS-Score</Typography>
                          <Typography variant="caption" fontWeight={600}>
                            {resume.atsScore}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={resume.atsScore} 
                          color={resume.atsScore >= 80 ? 'success' : resume.atsScore >= 60 ? 'warning' : 'error'}
                        />
                      </Box>

                      {/* Stats */}
                      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                        <Tooltip title="Arbeidserfaring">
                          <Chip 
                            icon={<WorkIcon />} 
                            label={resume.experiences?.length || 0} 
                            size="small" 
                          />
                        </Tooltip>
                        <Tooltip title="Utdanning">
                          <Chip 
                            icon={<EducationIcon />} 
                            label={resume.education?.length || 0} 
                            size="small" 
                          />
                        </Tooltip>
                        <Tooltip title="Ferdigheter">
                          <Chip 
                            icon={<SkillIcon />} 
                            label={resume.skills?.length || 0} 
                            size="small" 
                          />
                        </Tooltip>
                      </Stack>
                    </CardContent>

                    <CardActions>
                      <Button size="small" startIcon={<EditIcon />} onClick={() => handleSelectResume(resume)}>
                        Rediger
                      </Button>
                      <Tooltip title="Klon til ny variant (f.eks. tilpasset en spesifikk stilling)">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloneResume(resume.id, resume.title);
                          }}
                        >
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteResume(resume.id);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}

              {/* Empty-state når filteret/søket gir null treff.
                 Den helt-tomme tilstanden (resumes.length === 0) er allerede
                 dekket av "Lag ny CV"-kortet over, så vi viser kun "ingen
                 treff" når brukeren har CV-er men har filtrert dem bort. */}
              {filteredResumes.length === 0 && resumes.length > 0 && (
                <Grid item xs={12}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 4,
                      textAlign: 'center',
                      borderStyle: 'dashed',
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                    }}
                  >
                    <FolderIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Ingen CV-er matcher søket
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Prøv å nullstille filteret eller søk på noe annet.
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setResumeSearch('');
                        setResumeStatusFilter('all');
                      }}
                    >
                      Nullstill filter
                    </Button>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>Bygg og optimaliser</StepLabel>
          <StepContent>
            {selectedResume && (
              <Box>
                {/* Action Buttons */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 3,
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.75)',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      startIcon={<UploadIcon />}
                      onClick={() => setShowProjectImportDialog(true)}
                    >
                      Importer prosjekter
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<FolderIcon />}
                      onClick={() => setShowGithubDialog(true)}
                      title="Importer offentlige GitHub-prosjekter til CV-en"
                    >
                      Hent fra GitHub
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<LinkedInIcon />}
                      onClick={() => setShowLinkedInZipDialog(true)}
                      title="Last opp LinkedIn data-eksport-ZIP — full import uten LinkedIn-API"
                    >
                      Importer LinkedIn-data
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<AIIcon />}
                      onClick={() => setShowAIDialog(true)}
                      color="secondary"
                      data-onboarding-target="ai-analyze"
                    >
                      AI-analyse
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<TemplateIcon />}
                      onClick={() => setShowTemplateDialog(true)}
                      data-onboarding-target="template-picker"
                    >
                      Bytt mal
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={() => setShowExportDialog(true)}
                      data-onboarding-target="export"
                    >
                      Eksporter
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<PdfIcon />}
                      onClick={handlePrintPdf}
                      title="Skriv ut eller lagre som PDF direkte fra forhåndsvisningen"
                    >
                      Skriv ut PDF
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<TemplateIcon />}
                      onClick={() => setShowCoverLetterLibrary(true)}
                      title="Se alle AI-genererte søknadsbrev"
                    >
                      Søknadsbrev
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<AIIcon />}
                      onClick={() => setShowMockInterview(true)}
                      title="AI-intervjutrening basert på CV og stillingsannonse"
                    >
                      Intervjutrening
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<VideocamIcon />}
                      onClick={() => setShowVideoPresentation(true)}
                      title="Tren på video-presentasjon ('fortell om deg selv')"
                    >
                      Video-pitch
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<LightbulbIcon />}
                      onClick={() => setShowIndustryPicker(true)}
                      title="Pre-fylte achievement-eksempler etter bransje og rolle"
                    >
                      Bransje-eksempler
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<VerifiedIcon />}
                      onClick={() => setShowEducationVerification(true)}
                      title="Last opp vitnemål eller verifiseringslenke for utdanning"
                    >
                      Verifiser utdanning
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={
                        <Avatar sx={{
                          bgcolor: '#F5B82E', color: '#1F2937',
                          width: 22, height: 22, fontSize: 12, fontWeight: 800,
                        }}>S</Avatar>
                      }
                      onClick={() => setShowSigrid(true)}
                      title="Snakk med Sigrid — datadrevet karrierementer"
                      sx={{
                        bgcolor: '#1F2937',
                        '&:hover': { bgcolor: '#0F172A' },
                        color: '#fff',
                      }}
                    >
                      Snakk med Sigrid
                    </Button>
                    {selectedResume?.isPublic && (
                      <Button
                        variant="outlined"
                        startIcon={<PublicIcon />}
                        onClick={() => setShowCvAnalytics(true)}
                        title="Statistikk over hvem som har sett din offentlige CV"
                      >
                        Visnings-statistikk
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      startIcon={<WorkOutlineIcon />}
                      onClick={() => setShowKanbanDialog(true)}
                      title="Se og administrer jobbsøknadene dine med deadlines"
                    >
                      Mine søknader
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<CardGiftcardIcon />}
                      onClick={() => setShowReferralDialog(true)}
                      title="Inviter en venn — begge får 1 måned gratis"
                      sx={{
                        borderColor: '#F5B82E',
                        color: '#7A5A0B',
                        '&:hover': { borderColor: '#D49B1A', bgcolor: '#FFF8E1' },
                      }}
                    >
                      Inviter venn
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<HistoryIcon />}
                      onClick={async () => {
                        setShowVersionHistoryDialog(true);
                        await refreshVersions();
                      }}
                    >
                      Versjoner
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveVersion}
                      title="Lagre nåværende versjon som restore-punkt"
                    >
                      Lagre versjon
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveAsDraft}
                    >
                      Lagre utkast
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<CheckIcon />}
                      onClick={handlePublishResume}
                      color="success"
                    >
                      Publiser
                    </Button>
                    <Button
                      variant={selectedResume.isPublic ? 'contained' : 'outlined'}
                      startIcon={<ShareIcon />}
                      onClick={handlePublishResumeFlow}
                      color="info"
                      title={selectedResume.isPublic ? 'CV-en er offentlig — klikk for å gjøre privat' : 'Gjør CV offentlig og kopier delelink'}
                    >
                      {selectedResume.isPublic
                        ? `Offentlig${(selectedResume.publicViewCount ?? 0) > 0 ? ` · ${selectedResume.publicViewCount} visninger` : ''}`
                        : 'Del offentlig'}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<AIIcon />}
                      onClick={handleCreateEnglishVersion}
                      title="Lag en engelsk versjon av denne CV-en med Claude"
                    >
                      Engelsk versjon
                    </Button>
                  </Stack>
                </Paper>

                {/* Trial-banner (vises kun for trial-brukere) */}
                <NextRoleTrialBanner />

                {/* Kommende deadlines på tvers av alle søknader */}
                <UpcomingDeadlinesWidget
                  onMilestoneClick={(m) => {
                    setMilestoneDialogApp({
                      id: m.applicationId,
                      jobTitle: m.jobTitle,
                      company: m.company,
                    });
                  }}
                />

                {/* SSB lønnsestimat basert på CV-ens profesjonelle tittel */}
                <NextRoleSalaryBanner
                  jobTitle={
                    selectedResume?.personalInfo?.professionalTitle ??
                    selectedResume?.targetJobTitle ??
                    null
                  }
                  dismissKey={selectedResume?.id}
                />

                {/* Stats-banner med SSB/NAV/ATS-fakta */}
                <NextRoleStatsBanner />

                {/* CV-helse-score — kombinert ATS + komplethet + grammatikk */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 1.5,
                    borderRadius: 2,
                    borderLeft: '4px solid',
                    borderLeftColor:
                      cvHealthScore.total >= 80 ? 'success.main' :
                      cvHealthScore.total >= 60 ? 'warning.main' : 'error.main',
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={2}>
                    <Box sx={{
                      width: 70, height: 70, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: cvHealthScore.total >= 80 ? 'success.lighter' :
                               cvHealthScore.total >= 60 ? 'warning.lighter' : 'error.lighter',
                      border: '3px solid',
                      borderColor: cvHealthScore.total >= 80 ? 'success.main' :
                                   cvHealthScore.total >= 60 ? 'warning.main' : 'error.main',
                      flexShrink: 0,
                    }}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        {cvHealthScore.total}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                        CV-helse
                        {/* Benchmark — anchoring + status. Bruker statisk 68 som
                            "norsk gjennomsnitt" inntil vi har ekte yrke-data. */}
                        {cvHealthScore.total >= 68 ? (
                          <Box component="span" sx={{ ml: 1, fontSize: 12, color: 'success.dark', fontWeight: 600 }}>
                            +{cvHealthScore.total - 68}% over norsk snitt
                          </Box>
                        ) : (
                          <Box component="span" sx={{ ml: 1, fontSize: 12, color: 'error.dark', fontWeight: 600 }}>
                            {cvHealthScore.total - 68}% under norsk snitt (68)
                          </Box>
                        )}
                      </Typography>
                      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          ATS: <strong>{cvHealthScore.ats}</strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Komplethet: <strong>{cvHealthScore.completeness}%</strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Grammatikk: <strong>{cvHealthScore.grammar}</strong>
                        </Typography>
                      </Stack>
                      {cvHealthScore.breakdown.length > 0 && (
                        <Box sx={{ mt: 0.7 }}>
                          {/* Tap-aversjon: konkretiser tapet i ATS-poeng */}
                          <Typography variant="caption" color="error.main" sx={{ display: 'block', fontWeight: 600 }}>
                            Du mister ~{cvHealthScore.breakdown.length * 6}% ATS-score på {cvHealthScore.breakdown.length} manglende {cvHealthScore.breakdown.length === 1 ? 'felt' : 'felter'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Mangler: {cvHealthScore.breakdown.slice(0, 4).join(', ')}
                            {cvHealthScore.breakdown.length > 4 && ` +${cvHealthScore.breakdown.length - 4} til`}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Stack>
                </Paper>

                {/* Live preview toggle */}
                <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={showLivePreview ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    onClick={() => setShowLivePreview((v) => !v)}
                  >
                    {showLivePreview ? 'Skjul forhåndsvisning' : 'Vis forhåndsvisning'}
                  </Button>
                </Stack>

                <Grid container spacing={3}>
                  {/* Editor-kolonne */}
                  <Grid item xs={12} md={showLivePreview ? 7 : 12}>

                {/* Resume Editor Tabs */}
                <Paper
                  sx={{
                    mb: 3,
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 10px 26px rgba(255,255,255,0.08)',
                  }}
                >
                  <Tabs
                    value={tabValue}
                    onChange={(e, v) => setTabValue(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                  >
                    <Tab label="Personlig info" />
                    <Tab label="Arbeidserfaring" />
                    <Tab label="Utdanning" />
                    <Tab label="Ferdigheter" />
                    <Tab label="Sertifiseringer" />
                    <Tab label="Prosjekter" />
                    <Tab label="Språk" />
                  </Tabs>

                  <Box sx={{ p: 3 }}>
                    {/* Personal Info Tab */}
                    {tabValue === 0 && selectedResume && (
                      <Grid container spacing={3}>
                        {/* Fargeskjema-velger — overstyrer template-default
                           og gir alle templates samme aksentfarge. */}
                        <Grid item xs={12}>
                          <Stack spacing={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              Fargeskjema
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                              {Object.values(RESUME_COLOR_SCHEMES).map((scheme) => {
                                const isActive = selectedResume.colorScheme === scheme.id;
                                return (
                                  <Box
                                    key={scheme.id}
                                    onClick={() => {
                                      const next = { ...selectedResume, colorScheme: scheme.id };
                                      setSelectedResume(next);
                                      handleUpdateResume({ colorScheme: scheme.id });
                                      analytics?.trackEvent?.('nextrole_color_scheme_changed', {
                                        userId: user?.id,
                                        resumeId: selectedResume.id,
                                        scheme: scheme.id,
                                      });
                                    }}
                                    sx={{
                                      cursor: 'pointer',
                                      width: 40,
                                      height: 40,
                                      borderRadius: '50%',
                                      bgcolor: scheme.accent,
                                      border: isActive ? '3px solid #111' : '2px solid #fff',
                                      boxShadow: isActive ? '0 0 0 2px #111' : '0 1px 3px rgba(0,0,0,0.12)',
                                      transition: 'transform 120ms ease, box-shadow 120ms ease',
                                      '&:hover': { transform: 'scale(1.08)' },
                                    }}
                                    title={scheme.name}
                                  />
                                );
                              })}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              Aktivt: {selectedResume.colorScheme
                                ? (RESUME_COLOR_SCHEMES[selectedResume.colorScheme]?.name ?? selectedResume.colorScheme)
                                : 'Templatens standard'}
                            </Typography>
                          </Stack>
                        </Grid>

                        {/* Profilbilde — sirkulært preview + opplaster.
                           Lagrer som data-URL i personalInfo.profilePhoto. */}
                        <Grid item xs={12}>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Avatar
                              src={selectedResume.personalInfo?.profilePhoto}
                              sx={{ width: 88, height: 88, border: '2px solid', borderColor: 'divider' }}
                            />
                            <Stack spacing={0.5}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                Profilbilde
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                JPEG, PNG eller WebP. Maks 5 MB.
                              </Typography>
                              <Stack direction="row" spacing={1}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  component="label"
                                  startIcon={<UploadIcon />}
                                  disabled={photoUploading}
                                >
                                  {photoUploading ? 'Laster opp…' : 'Last opp bilde'}
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    hidden
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = '';
                                      if (!file || !selectedResume) return;
                                      try {
                                        setPhotoUploading(true);
                                        const fd = new FormData();
                                        fd.append('photo', file);
                                        const res = await apiRequest(
                                          `/api/resumes/${selectedResume.id}/upload-photo`,
                                          {
                                            method: 'POST',
                                            headers: { 'x-user-id': user?.id || '' },
                                            body: fd,
                                          },
                                        );
                                        if (res?.profilePhoto) {
                                          setSelectedResume({
                                            ...selectedResume,
                                            personalInfo: {
                                              ...selectedResume.personalInfo,
                                              profilePhoto: res.profilePhoto,
                                            },
                                          });
                                          setSnackbar({
                                            open: true,
                                            severity: 'success',
                                            message: 'Profilbilde lastet opp.',
                                          });
                                        }
                                      } catch (err) {
                                        console.error('Foto-opplasting feilet', err);
                                        setSnackbar({
                                          open: true,
                                          severity: 'error',
                                          message: 'Kunne ikke laste opp bilde.',
                                        });
                                      } finally {
                                        setPhotoUploading(false);
                                      }
                                    }}
                                  />
                                </Button>
                                {selectedResume.personalInfo?.profilePhoto && (
                                  <Button
                                    variant="text"
                                    size="small"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => {
                                      const next = { ...selectedResume.personalInfo };
                                      delete next.profilePhoto;
                                      setSelectedResume({
                                        ...selectedResume,
                                        personalInfo: next,
                                      });
                                      handleUpdateResume({ personalInfo: next });
                                    }}
                                  >
                                    Fjern
                                  </Button>
                                )}
                              </Stack>
                            </Stack>
                          </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Fullt navn</Typography>
                            <ContextualHelp
                              title="Fullt navn"
                              content="Ditt fulle profesjonelle navn slik det fremgår av offisielle dokumenter"
                              size="small"
                            />
                          </Stack>
                          <TextField
                            fullWidth
                            value={selectedResume.personalInfo?.fullName || ''}
                            onChange={(e) => handleUpdateResume({
                              personalInfo: {
                                ...selectedResume.personalInfo,
                                fullName: e.target.value,
                              },
                            })}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Profesjonell tittel</Typography>
                            <ContextualHelp
                              title="Professional Title"
                              content="Your current job title or professional headline"
                              size="small"
                            />
                          </Stack>
                          <TextField
                            fullWidth
                            value={selectedResume?.personalInfo?.professionalTitle || ''}
                            onChange={(e) => handleUpdateResume({
                              personalInfo: {
                                ...selectedResume.personalInfo,
                                professionalTitle: e.target.value,
                              },
                            })}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>E-post</Typography>
                            <ContextualHelp
                              title="Professional Email"
                              content="Professional email address. Employers will contact you here."
                              size="small"
                            />
                          </Stack>
                          <TextField
                            fullWidth
                            type="email"
                            value={selectedResume?.personalInfo?.email || ''}
                            onChange={(e) => handleUpdateResume({
                              personalInfo: {
                                ...selectedResume.personalInfo,
                                email: e.target.value,
                              },
                            })}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Telefon</Typography>
                            <ContextualHelp
                              title="Phone Number"
                              content="Phone number where you can be reached. Include country code (+47 for Norway)"
                              size="small"
                            />
                          </Stack>
                          <TextField
                            fullWidth
                            value={selectedResume?.personalInfo?.phone || ''}
                            onChange={(e) => handleUpdateResume({
                              personalInfo: {
                                ...selectedResume.personalInfo,
                                phone: e.target.value,
                              },
                            })}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Stack spacing={1}>
                            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                              <Typography variant="subtitle2">Profesjonelt sammendrag</Typography>
                              <Stack direction="row" spacing={1}>
                                <Tooltip title="AI Omskriving">
                                  <IconButton
                                    size="small"
                                    onClick={() => openAiTool('paraphrase', selectedResume?.personalInfo?.summary || '','summary')}
                                    color="primary"
                                  >
                                    <AutoAwesome fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="AI Grammatikksjekk">
                                  <IconButton
                                    size="small"
                                    onClick={() => openAiTool('grammar', selectedResume?.personalInfo?.summary || '','summary')}
                                    color="primary"
                                  >
                                    <Spellcheck fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="AI Generer">
                                  <IconButton
                                    size="small"
                                    onClick={() => openAiTool('generate-resume',', ','summary')}
                                    color="secondary"
                                  >
                                    <AIIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </Stack>
                            <TextField
                              fullWidth
                              multiline
                              rows={4}
                              value={selectedResume?.personalInfo?.summary || ''}
                              onChange={(e) => handleUpdateResume({
                                personalInfo: {
                                  ...selectedResume.personalInfo,
                                  summary: e.target.value,
                                },
                              })}
                              placeholder="Skriv et kort sammendrag av din erfaring og kompetanse..."
                            />
                          </Stack>
                        </Grid>
                        <Grid item xs={12}>
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Stack spacing={2}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={selectedResume.isPublic}
                                    onChange={(e) => handleTogglePublicResume(e.target.checked)}
                                    color="primary"
                                  />
                                }
                                label="Gjør CV offentlig"
                              />
                              {selectedResume.isPublic && (
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                                  <TextField
                                    label="Offentlig lenke"
                                    value={publicResumeUrl}
                                    fullWidth
                                    InputProps={{ readOnly: true }}
                                  />
                                  <Button variant="outlined" startIcon={<CopyIcon />} onClick={handleCopyPublicUrl}>
                                    Kopier lenke
                                  </Button>
                                </Stack>
                              )}
                              <FormControl fullWidth>
                                <InputLabel>Fargepalett</InputLabel>
                                <Select
                                  value={selectedResume.colorScheme || 'classic'}
                                  label="Fargepalett"
                                  onChange={(e) => handleUpdateResume({ colorScheme: e.target.value as string })}
                                >
                                  <MenuItem value="classic">Klassisk</MenuItem>
                                  <MenuItem value="modern">Moderne</MenuItem>
                                  <MenuItem value="sunset">Sunset</MenuItem>
                                  <MenuItem value="ocean">Ocean</MenuItem>
                                </Select>
                              </FormControl>
                            </Stack>
                          </Paper>
                        </Grid>
                      </Grid>
                    )}

                    {/* Work Experience Tab */}
                    {tabValue === 1 && (
                      <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="h6">Arbeidserfaring</Typography>
                          <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenExperienceDialog()}
                          >
                            Legg til erfaring
                          </Button>
                        </Stack>
                        {(selectedResume.experiences?.length ?? 0) === 0 && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            Ingen arbeidserfaring lagt til. Importer fullførte prosjekter eller legg til manuelt.
                          </Alert>
                        )}
                        {selectedResume.experiences?.map((exp, expIdx, expArr) => (
                          <Card key={exp.id} sx={{ mb: 2 }}>
                            <CardContent>
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box sx={{ flex: 1 }}>
                                  <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography variant="h6">{exp.jobTitle}</Typography>
                                    {exp.employmentType === 'internship' && (
                                      <Chip label="Praksis" size="small" color="secondary" />
                                    )}
                                    {exp.autoGenerated && (
                                      <Chip label="Auto-importert" size="small" color="info" />
                                    )}
                                  </Stack>
                                  <Typography variant="body2" color="text.secondary">
                                    {exp.company}{exp.location ? ` · ${exp.location}` : ''}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {exp.startDate ? new Date(exp.startDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'short' }) : ''}
                                    {' – '}
                                    {exp.isCurrent ? 'Nå' : (exp.endDate ? new Date(exp.endDate).toLocaleDateString('no-NO', { year: 'numeric', month: 'short' }) : '')}
                                  </Typography>
                                  {exp.description && (
                                    <Typography variant="body2" sx={{ mt: 1 }}>
                                      {exp.description}
                                    </Typography>
                                  )}
                                  {Array.isArray(exp.experienceGroups) && exp.experienceGroups.length > 0 ? (
                                    <Box sx={{ mt: 1 }}>
                                      {exp.experienceGroups.map((g, i) => (
                                        <Box key={i} sx={{ mb: 1 }}>
                                          {g.category && (
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                              {g.category}:
                                            </Typography>
                                          )}
                                          {(g.items ?? []).map((it, j) => (
                                            <Typography key={j} variant="body2" sx={{ ml: 2 }}>
                                              • {it}
                                            </Typography>
                                          ))}
                                        </Box>
                                      ))}
                                    </Box>
                                  ) : (exp.achievements?.length ?? 0) > 0 ? (
                                    <Box sx={{ mt: 1 }}>
                                      {exp.achievements.map((a, i) => (
                                        <Typography key={i} variant="body2" sx={{ ml: 2 }}>
                                          • {a}
                                        </Typography>
                                      ))}
                                    </Box>
                                  ) : null}
                                </Box>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <Stack direction="column" spacing={0}>
                                    <IconButton
                                      size="small"
                                      disabled={expIdx === 0}
                                      onClick={() => handleReorderItem('experiences', exp.id, -1)}
                                      title="Flytt opp"
                                      sx={{ p: 0.25 }}
                                    >
                                      <ArrowUpIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      disabled={expIdx === expArr.length - 1}
                                      onClick={() => handleReorderItem('experiences', exp.id, 1)}
                                      title="Flytt ned"
                                      sx={{ p: 0.25 }}
                                    >
                                      <ArrowDownIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                  <IconButton size="small" onClick={() => handleOpenExperienceDialog(exp)}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" color="error" onClick={() => handleDeleteExperience(exp.id)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Stack>
                              </Stack>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    )}

                    {/* Education Tab */}
                    {tabValue === 2 && (
                      <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="h6">Utdanning</Typography>
                          <Button startIcon={<AddIcon />} onClick={handleOpenEducationDialog}>
                            Legg til utdanning
                          </Button>
                        </Stack>
                        {selectedResume.education?.length === 0 && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            Ingen utdanning lagt til ennå.
                          </Alert>
                        )}
                        {selectedResume.education?.map((edu, eduIdx, eduArr) => (
                          <Card key={edu.id} sx={{ mb: 2 }}>
                            <CardContent>
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box>
                                  <Typography variant="h6">{edu.degree}</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {edu.institution}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {edu.startDate} - {edu.isCurrent ? 'Nå' : edu.endDate || ''}
                                  </Typography>
                                </Box>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <Stack direction="column" spacing={0}>
                                    <IconButton size="small" disabled={eduIdx === 0} onClick={() => handleReorderItem('education', edu.id, -1)} sx={{ p: 0.25 }}>
                                      <ArrowUpIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" disabled={eduIdx === eduArr.length - 1} onClick={() => handleReorderItem('education', edu.id, 1)} sx={{ p: 0.25 }}>
                                      <ArrowDownIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                  <Button size="small" onClick={() => handleEditEducationItem(edu)}>
                                    Rediger
                                  </Button>
                                  <Button size="small" color="error" onClick={() => handleDeleteEducation(edu.id)}>
                                    Slett
                                  </Button>
                                </Stack>
                              </Stack>
                              {edu.description && (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  {edu.description}
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    )}

                    {/* Skills Tab */}
                    {tabValue === 3 && (
                      <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="h6">Ferdigheter</Typography>
                          {(selectedResume.skills?.length ?? 0) > 1 && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<ArrowUpIcon sx={{ transform: 'rotate(90deg)' }} />}
                              onClick={() => setShowSkillReorderDialog(true)}
                            >
                              Sorter
                            </Button>
                          )}
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {selectedResume.skills?.map((skill) => (
                            <Chip
                              key={skill.id}
                              label={skill.name}
                              onDelete={() => handleDeleteSkill(skill.id)}
                            />
                          ))}
                        </Stack>
                        <Button
                          startIcon={<AddIcon />}
                          sx={{ mt: 2 }}
                          onClick={handleOpenSkillDialog}
                        >
                          Legg til ferdighet
                        </Button>
                      </Box>
                    )}

                    {/* Certifications Tab */}
                    {tabValue === 4 && (
                      <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="h6">Sertifiseringer</Typography>
                          <Button startIcon={<AddIcon />} onClick={handleOpenCertificationDialog}>
                            Legg til sertifisering
                          </Button>
                        </Stack>
                        {selectedResume.certifications?.length === 0 && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            Ingen sertifiseringer lagt til ennå.
                          </Alert>
                        )}
                        {selectedResume.certifications?.map((cert, certIdx, certArr) => (
                          <Card key={cert.id} sx={{ mb: 2 }}>
                            <CardContent>
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box>
                                  <Typography variant="h6">{cert.name}</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {cert.issuer}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {cert.issueDate}
                                  </Typography>
                                </Box>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <Stack direction="column" spacing={0}>
                                    <IconButton size="small" disabled={certIdx === 0} onClick={() => handleReorderItem('certifications', cert.id, -1)} sx={{ p: 0.25 }}>
                                      <ArrowUpIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" disabled={certIdx === certArr.length - 1} onClick={() => handleReorderItem('certifications', cert.id, 1)} sx={{ p: 0.25 }}>
                                      <ArrowDownIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                  <Button size="small" onClick={() => handleEditCertificationItem(cert)}>
                                    Rediger
                                  </Button>
                                  <Button size="small" color="error" onClick={() => handleDeleteCertification(cert.id)}>
                                    Slett
                                  </Button>
                                </Stack>
                              </Stack>
                              {cert.description && (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  {cert.description}
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    )}

                    {/* Projects & Portfolio Tab */}
                    {tabValue === 5 && (
                      <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                          <Typography variant="h6">
                            Prosjekter & Portefølje
                          </Typography>
                          <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleAddPortfolioItem}
                            sx={{ bgcolor: 'primary.main', color: 'white' }}
                          >
                            Legg til portefølje-oppføring
                          </Button>
                        </Stack>

                        {/* Auto-imported Projects */}
                        {selectedResume.projects && selectedResume.projects.length > 0 && (
                          <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" gutterBottom>
                              Auto-importerte prosjekter
                            </Typography>
                            {selectedResume.projects.map((project) => (
                              <Card key={project.id} sx={{ mb: 2 }}>
                                <CardContent>
                                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                    <Box sx={{ flex: 1 }}>
                                      <Typography variant="h6">{project.title}</Typography>
                                      <Typography variant="body2" color="text.secondary">
                                        {project.role}
                                      </Typography>
                                      <Typography variant="body2" sx={{ mt: 1 }}>
                                        {project.description}
                                      </Typography>
                                    </Box>
                                    <Chip label="Auto-importert" size="small" color="info" />
                                  </Stack>
                                </CardContent>
                              </Card>
                            ))}
                          </Box>
                        )}

                        {/* Manual Portfolio Items */}
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            Portefølje-oppføringer
                          </Typography>
                          {portfolioItems.length === 0 ? (
                            <Alert severity="info" sx={{ mb: 2 }}>
                              Ingen portefølje-oppføringer lagt til ennå. Klikk på "Legg til portefølje-oppføring" for å komme i gang.
                            </Alert>
                          ) : (
                            <Grid container spacing={2}>
                              {portfolioItems.map((item) => (
                                <Grid item xs={12} sm={6} md={4} key={item.id}>
                                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <CardContent sx={{ flex: 1 }}>
                                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600}}>
                                          {item.title}
                                        </Typography>
                                        <Chip 
                                          label={item.category} 
                                          size="small" 
                                          color="primary" 
                                          variant="outlined"
                                        />
                                      </Stack>
                                      
                                      <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontSize: '13px' }}>
                                        {item.description}
                                      </Typography>

                                      {/* Google Drive Links */}
                                      {item.googleDriveLinks && item.googleDriveLinks.length > 0 && (
                                        <Box sx={{ mb: 2 }}>
                                          <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
                                            Google Drive-filer:
                                          </Typography>
                                          <Stack spacing={1}>
                                            {item.googleDriveLinks.map((link, index) => (
                                              <Button
                                                key={index}
                                                size="small"
                                                variant="outlined"
                                                startIcon={getFileIcon(link.type)}
                                                href={link.url}
                                                target="_blank"
                                                sx={{ 
                                                  fontSize: '12px',
                                                  textTransform: 'none',
                                                  justifyContent: 'flex-start',
                                                  textAlign: 'left'
                                                }}
                                              >
                                                {link.name}
                                              </Button>
                                            ))}
                                          </Stack>
                                        </Box>
                                      )}

                                      {/* Technologies */}
                                      {item.technologies && item.technologies.length > 0 && (
                                        <Box>
                                          <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
                                            Teknologier:
                                          </Typography>
                                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                            {item.technologies.map((tech, index) => (
                                              <Chip 
                                                key={index} 
                                                label={tech} 
                                                size="small" 
                                                sx={{ fontSize: '11px', mb: 0.5 }} 
                                              />
                                            ))}
                                          </Stack>
                                        </Box>
                                      )}
                                    </CardContent>
                                    
                                    <CardActions>
                                      <Button size="small" onClick={() => handleEditPortfolioItem(item)}>
                                        Rediger
                                      </Button>
                                      <Button 
                                        size="small" 
                                        color="error" 
                                        onClick={() => handleDeletePortfolioItem(item.id!)}
                                      >
                                        Slett
                                      </Button>
                                    </CardActions>
                                  </Card>
                                </Grid>
                              ))}
                            </Grid>
                          )}
                        </Box>
                      </Box>
                    )}

                    {/* Languages Tab */}
                    {tabValue === 6 && (
                      <Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="h6">Språk</Typography>
                          <Button startIcon={<AddIcon />} onClick={() => handleOpenLanguageDialog()}>
                            Legg til språk
                          </Button>
                        </Stack>
                        {(selectedResume.languages?.length ?? 0) === 0 && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            Ingen språk lagt til ennå. Legg til Norsk, Engelsk eller andre språk for å vise språkferdighetene dine.
                          </Alert>
                        )}
                        <Stack spacing={1.5}>
                          {(selectedResume.languages ?? []).map((lang, langIdx, langArr) => (
                            <Card key={lang.id} variant="outlined">
                              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Stack direction="row" alignItems="center" spacing={2}>
                                  <Box sx={{ flex: 1 }}>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                        {lang.name}
                                      </Typography>
                                      {lang.levelLabel && (
                                        <Chip
                                          label={lang.levelLabel}
                                          size="small"
                                          color={lang.isNative ? 'success' : 'default'}
                                          variant={lang.isNative ? 'filled' : 'outlined'}
                                        />
                                      )}
                                    </Stack>
                                    <LinearProgress
                                      variant="determinate"
                                      value={Math.max(0, Math.min(100, lang.proficiencyLevel ?? 80))}
                                      sx={{ mt: 0.75, height: 6, borderRadius: 3 }}
                                    />
                                  </Box>
                                  <Stack direction="column" spacing={0}>
                                    <IconButton size="small" disabled={langIdx === 0} onClick={() => handleReorderItem('languages', lang.id, -1)} sx={{ p: 0.25 }}>
                                      <ArrowUpIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" disabled={langIdx === langArr.length - 1} onClick={() => handleReorderItem('languages', lang.id, 1)} sx={{ p: 0.25 }}>
                                      <ArrowDownIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                  <Stack direction="row" spacing={0.5}>
                                    <IconButton size="small" onClick={() => handleOpenLanguageDialog(lang)}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleDeleteLanguage(lang.id)}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                </Stack>
                              </CardContent>
                            </Card>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                </Paper>

                  </Grid>{/* /Editor-kolonne */}

                  {/* Live-preview-kolonne — sticky panel som rendrer
                     selectedResume gjennom valgt template. Oppdaterer
                     mens brukeren skriver. Skjules helt på mobil
                     (xs: 'none') for å unngå tung dobbeltrender —
                     brukeren kan bytte mellom editor/preview via
                     toggle-knappen øverst. */}
                  {showLivePreview && (
                    <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'block' } }}>
                      <Box
                        sx={{
                          position: 'sticky',
                          top: 16,
                          maxHeight: 'calc(100vh - 64px)',
                          overflowY: 'auto',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          bgcolor: 'background.default',
                          p: 1,
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1, py: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Forhåndsvisning
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {RESUME_TEMPLATES[selectedResume.templateId as keyof typeof RESUME_TEMPLATES]?.name ?? selectedResume.templateId}
                          </Typography>
                        </Stack>
                        <Box
                          data-resume-print-source
                          sx={{
                            transform: 'scale(0.62)',
                            transformOrigin: 'top left',
                            width: '161%',
                            mb: -36,
                          }}
                        >
                          {(() => {
                            const reg = RESUME_TEMPLATES[selectedResume.templateId as keyof typeof RESUME_TEMPLATES];
                            const Component = reg?.component ?? ModernATSTemplate;
                            return <Component resume={selectedResume} preview />;
                          })()}
                        </Box>
                      </Box>
                    </Grid>
                  )}
                </Grid>{/* /split */}

                {/* ATS Score Card */}
                <Card sx={{ mt: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      ATS-Optimalisering
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={selectedResume.atsScore} 
                          sx={{ height: 10, borderRadius: 5 }}
                          color={selectedResume.atsScore >= 80 ? 'success' : selectedResume.atsScore >= 60 ? 'warning' : 'error'}
                        />
                      </Box>
                      <Typography variant="h4" color="primary">
                        {selectedResume.atsScore}%
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {selectedResume.atsScore >= 80 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CheckCircleOutlineIcon fontSize="small" color="success" />
                          <span>Utmerket ATS-score!</span>
                        </Box>
                      ) : selectedResume.atsScore >= 60 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <WarningIcon fontSize="small" color="warning" />
                          <span>God score, men kan forbedres</span>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ErrorOutlineIcon fontSize="small" color="error" />
                          <span>Trenger forbedring</span>
                        </Box>
                      )}
                    </Typography>
                    {atsTips.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Forbedringsforslag
                        </Typography>
                        <Stack spacing={1}>
                          {atsTips.map((tip) => (
                            <Alert key={tip} severity="info" icon={<TrendingUpIcon />}>
                              {tip}
                            </Alert>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Box>
            )}
          </StepContent>
        </Step>

        <Step>
          <StepLabel>Publiser og søk jobber</StepLabel>
          <StepContent>
            <Stack spacing={2}>
              <Typography>Publiser CV-en din og start jobbsøking</Typography>
              <Paper sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                  <TextField
                    label="Søk jobber"
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                    placeholder="Søk etter stilling, selskap eller tags"
                    fullWidth
                  />
                  <FormControl sx={{ minWidth: 180 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={jobStatusFilter}
                      label="Status"
                      onChange={(e) => setJobStatusFilter(e.target.value as typeof jobStatusFilter)}
                    >
                      <MenuItem value="all">Alle</MenuItem>
                      <MenuItem value="saved">Lagret</MenuItem>
                      <MenuItem value="applied">Søkt</MenuItem>
                      <MenuItem value="interviewing">Intervju</MenuItem>
                      <MenuItem value="offer">Tilbud</MenuItem>
                      <MenuItem value="accepted">Akseptert</MenuItem>
                      <MenuItem value="rejected">Avslått</MenuItem>
                      <MenuItem value="withdrawn">Trukket</MenuItem>
                    </Select>
                  </FormControl>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenJobDialog}>
                    Legg til søknad
                  </Button>
                </Stack>
              </Paper>

              {/* Urgent Deadlines Alert */}
              {(() => {
                const today = new Date();
                const urgentJobs = jobApplications.filter(job => {
                  if (!job.deadline || job.status === 'applied' || job.status === 'rejected' || job.status === 'withdrawn') return false;
                  const deadline = new Date(job.deadline);
                  const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  return daysLeft <= 7 && daysLeft >= 0;
                }).sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

                if (urgentJobs.length === 0) return null;

                return (
                  <Alert severity="warning" icon={<AlarmIcon />}>
                    <Typography variant="subtitle2" gutterBottom>
                      <strong>Haster! {urgentJobs.length} søknadsfrist{urgentJobs.length > 1 ? 'er' : ''} snart</strong>
                    </Typography>
                    <Stack spacing={1}>
                      {urgentJobs.map(job => {
                        const deadline = new Date(job.deadline!);
                        const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        return (
                          <Box key={job.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip 
                              size="small" 
                              label={daysLeft === 0 ? 'I DAG!' : daysLeft === 1 ? 'I MORGEN' : `${daysLeft} dager`}
                              color={daysLeft <= 1 ? 'error' : daysLeft <= 3 ? 'warning' : 'default'}
                            />
                            <Typography variant="body2">
                              <strong>{job.jobTitle}</strong> hos {job.company} - frist: {job.deadline}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Alert>
                );
              })()}

              {/* Upcoming Interviews Alert */}
              {(() => {
                const today = new Date();
                const upcomingInterviews = jobApplications.filter(job => {
                  if (!job.interviewDate) return false;
                  const interviewDate = new Date(job.interviewDate);
                  const daysUntil = Math.ceil((interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  return daysUntil <= 7 && daysUntil >= 0;
                }).sort((a, b) => new Date(a.interviewDate!).getTime() - new Date(b.interviewDate!).getTime());

                if (upcomingInterviews.length === 0) return null;

                return (
                  <Alert severity="info" icon={<GpsFixedIcon />}>
                    <Typography variant="subtitle2" gutterBottom>
                      <strong>Kommende intervjuer - {upcomingInterviews.length} planlagt</strong>
                    </Typography>
                    <Stack spacing={1}>
                      {upcomingInterviews.map(job => {
                        const interviewDate = new Date(job.interviewDate!);
                        const daysUntil = Math.ceil((interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const isPrepared = job.interviewPreparation?.completed;
                        return (
                          <Box key={job.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip 
                              size="small" 
                              label={daysUntil === 0 ? 'I DAG!' : daysUntil === 1 ? 'I MORGEN' : `${daysUntil} dager`}
                              color={daysUntil === 0 ? 'error' : daysUntil <= 2 ? 'warning' : 'info'}
                            />
                            <Typography variant="body2">
                              <strong>{job.jobTitle}</strong> hos {job.company}
                            </Typography>
                            {!isPrepared && (
                              <Chip 
                                size="small" 
                                label="Ikke forberedt" 
                                color="warning" 
                                variant="outlined"
                              />
                            )}
                          </Box>
                        );
                      })}
                    </Stack>
                  </Alert>
                );
              })()}

              {filteredJobApplications.length === 0 ? (
                <Alert severity="info">Ingen jobbsøknader registrert ennå.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {filteredJobApplications.map((job) => (
                    <Grid item xs={12} md={6} key={job.id}>
                      <Card>
                        <CardContent>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                              <Typography variant="h6">{job.jobTitle}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {job.company} {job.location ? `• ${job.location}` : ''}
                              </Typography>
                              {job.source && (
                                <Typography variant="caption" color="text.secondary">
                                  Kilde: {job.source}
                                </Typography>
                              )}
                            </Box>
                            <Chip label={job.status} color={job.status === 'applied' ? 'primary' : 'default'} />
                          </Stack>
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                            <Chip size="small" label={`Prioritet: ${job.priority}`} />
                            {job.applicantType && (
                              <Chip 
                                size="small" 
                                label={
                                  job.applicantType === 'internship' ? 'Praksis/Internship' :
                                  job.applicantType === 'trainee' ? 'Trainee' :
                                  job.applicantType === 'full-time' ? 'Heltid' :
                                  job.applicantType === 'part-time' ? 'Deltid' :
                                  job.applicantType === 'contract' ? 'Kontrakt' :
                                  job.applicantType === 'freelance' ? 'Frilans' :
                                  'Midlertidig'
                                }
                                color="info"
                              />
                            )}
                            {job.appliedDate && <Chip size="small" label={`Søkt: ${job.appliedDate}`} />}
                            {job.deadline && (() => {
                              const deadline = new Date(job.deadline);
                              const today = new Date();
                              const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              const isPastDeadline = daysLeft < 0;
                              const isUrgent = daysLeft <= 3 && daysLeft >= 0;
                              const isSoon = daysLeft <= 7 && daysLeft > 3;
                              
                              return (
                                <Chip 
                                  size="small" 
                                  icon={isPastDeadline ? <CancelIcon /> : <AlarmIcon />}
                                  label={isPastDeadline ? `Frist passert (${job.deadline})` : `Frist: ${job.deadline} (${daysLeft}d)`}
                                  color={isPastDeadline ? 'error' : isUrgent ? 'error' : isSoon ? 'warning' : 'default'}
                                  variant={isUrgent || isPastDeadline ? 'filled' : 'outlined'}
                                />
                              );
                            })()}
                            {job.interviewDate && (() => {
                              const interviewDate = new Date(job.interviewDate);
                              const today = new Date();
                              const daysUntil = Math.ceil((interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              const isPast = daysUntil < 0;
                              const isToday = daysUntil === 0;
                              const isTomorrow = daysUntil === 1;
                              const isUrgent = daysUntil <= 3 && daysUntil >= 0;
                              
                              return (
                                <Chip 
                                  size="small" 
                                  icon={<GpsFixedIcon />}
                                  label={
                                    isPast ? `Intervju fullført` :
                                    isToday ? `INTERVJU I DAG!` :
                                    isTomorrow ? `INTERVJU I MORGEN` :
                                    `Intervju om ${daysUntil}d${!job.interviewPreparation?.completed ? ' - Forbered!' : ''}`
                                  }
                                  color={isToday ? 'error' : isUrgent ? 'warning' : 'success'}
                                  variant={isToday || isTomorrow ? 'filled' : 'outlined'}
                                />
                              );
                            })()}
                          </Stack>
                          {job.tags?.length > 0 && (
                            <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap">
                              {job.tags.map((tag) => (
                                <Chip key={tag} size="small" label={tag} />
                              ))}
                            </Stack>
                          )}
                          {job.notes && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {job.notes}
                            </Typography>
                          )}
                          {job.coverLetter && (
                            <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
                              Søknadsbrev lagret
                            </Typography>
                          )}
                        </CardContent>
                        <CardActions sx={{ justifyContent: 'space-between' }}>
                          <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel>Oppdater status</InputLabel>
                            <Select
                              value={job.status}
                              label="Oppdater status"
                              onChange={(e) => handleUpdateJobStatus(job.id, e.target.value as JobApplication['status'])}
                            >
                              <MenuItem value="saved">Lagret</MenuItem>
                              <MenuItem value="applied">Søkt</MenuItem>
                              <MenuItem value="interviewing">Intervju</MenuItem>
                              <MenuItem value="offer">Tilbud</MenuItem>
                              <MenuItem value="accepted">Akseptert</MenuItem>
                              <MenuItem value="rejected">Avslått</MenuItem>
                              <MenuItem value="withdrawn">Trukket</MenuItem>
                            </Select>
                          </FormControl>
                          <Stack direction="row" spacing={1}>
                            <Button size="small" onClick={() => handleEditJobApplication(job)}>
                              Rediger
                            </Button>
                            <Button size="small" color="error" onClick={() => handleDeleteJobApplication(job.id)}>
                              Slett
                            </Button>
                          </Stack>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Stack>
          </StepContent>
        </Step>
      </Stepper>

      {/* Versjon-historikk Dialog */}
      <Dialog
        open={showVersionHistoryDialog}
        onClose={() => setShowVersionHistoryDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Versjonshistorikk</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Hver "Lagre versjon" tar et fullt snapshot av CV-en (inkludert alle erfaringer, utdanning, ferdigheter osv.) — du kan gjenopprette en eldre versjon senere.
            </Alert>
            {versionLoading && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {!versionLoading && versions.length === 0 && (
              <Alert severity="info">
                Ingen lagrede versjoner ennå. Klikk "Lagre versjon" for å lage din første.
              </Alert>
            )}
            <Stack spacing={1}>
              {versions.map((v) => (
                <Paper key={v.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {v.label ?? `Versjon ${v.versionNumber}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(v.createdAt).toLocaleString('no-NO')} · v{v.versionNumber}
                      </Typography>
                      {v.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                          {v.notes}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="contained" onClick={() => handleRestoreDbVersion(v.id)}>
                        Gjenopprett
                      </Button>
                      <IconButton size="small" color="error" onClick={() => handleDeleteVersion(v.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVersionHistoryDialog(false)}>Lukk</Button>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSaveVersion}>
            Lagre ny versjon nå
          </Button>
        </DialogActions>
      </Dialog>

      {/* Skill-reorder Dialog */}
      <Dialog
        open={showSkillReorderDialog}
        onClose={() => setShowSkillReorderDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Sorter ferdigheter</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {(selectedResume?.skills ?? []).map((skill, idx, arr) => (
              <Paper key={skill.id} variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Stack direction="column" spacing={0}>
                  <IconButton
                    size="small"
                    disabled={idx === 0}
                    onClick={() => handleReorderItem('skills', skill.id, -1)}
                    sx={{ p: 0.25 }}
                  >
                    <ArrowUpIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={idx === arr.length - 1}
                    onClick={() => handleReorderItem('skills', skill.id, 1)}
                    sx={{ p: 0.25 }}
                  >
                    <ArrowDownIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{skill.name}</Typography>
                  {skill.category && (
                    <Typography variant="caption" color="text.secondary">{skill.category}</Typography>
                  )}
                </Box>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSkillReorderDialog(false)} variant="contained">Ferdig</Button>
        </DialogActions>
      </Dialog>

      {/* LinkedIn data-eksport ZIP-import Dialog */}
      <Dialog
        open={showLinkedInZipDialog}
        onClose={() => (linkedInZipUploading ? null : setShowLinkedInZipDialog(false))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Importer LinkedIn-data</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Slik henter du LinkedIn-eksporten:
              </Typography>
              <Box component="ol" sx={{ pl: 2.5, m: 0, fontSize: 14, lineHeight: 1.7 }}>
                <li>
                  Gå til <Link href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener">
                    linkedin.com/mypreferences/d/download-my-data
                  </Link>
                </li>
                <li>Velg "Want something in particular?" og huk av minst Profile, Positions, Education, Skills, Languages</li>
                <li>Klikk "Request archive" — du får e-post med ZIP-fil innen 24 timer (ofte minutter)</li>
                <li>Last ned ZIP-en og dra den inn her under</li>
              </Box>
            </Alert>
            <Typography variant="caption" color="text.secondary">
              Vi parser CSV-filene direkte — Claude er ikke involvert, så dette er gratis og 100% pålitelig.
              Maks 50 MB.
            </Typography>
            {linkedInZipUploading ? (
              <Box sx={{ py: 2 }}>
                <LinearProgress />
                <Typography variant="body2" sx={{ mt: 1.5, textAlign: 'center' }}>
                  Parser LinkedIn-eksporten …
                </Typography>
              </Box>
            ) : (
              <Button
                variant="contained"
                component="label"
                startIcon={<UploadIcon />}
                size="large"
                fullWidth
                sx={{ py: 1.5 }}
              >
                Velg LinkedIn ZIP-fil
                <input
                  type="file"
                  accept=".zip,application/zip"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) handleImportLinkedInZip(file);
                  }}
                />
              </Button>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLinkedInZipDialog(false)} disabled={linkedInZipUploading}>
            Avbryt
          </Button>
        </DialogActions>
      </Dialog>

      {/* GitHub-import Dialog */}
      <Dialog
        open={showGithubDialog}
        onClose={() => (githubImporting ? null : setShowGithubDialog(false))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Importer prosjekter fra GitHub</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Vi henter dine offentlige repositories (ikke forks) og legger til de 6 mest stjernede som
              prosjekter på CV-en din. Krever ikke innlogging — vi bruker GitHub Public API.
            </Alert>
            <TextField
              label="GitHub-brukernavn"
              fullWidth
              autoFocus
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              placeholder="F.eks. olanordmann"
              helperText="Brukernavnet ditt på github.com (kommer rett etter github.com/)"
              disabled={githubImporting}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGithubDialog(false)} disabled={githubImporting}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleImportGithub}
            disabled={githubImporting || !githubUsername.trim()}
            startIcon={githubImporting ? <CircularProgress size={16} color="inherit" /> : <FolderIcon />}
          >
            {githubImporting ? 'Henter …' : 'Hent prosjekter'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* NextRole upsell-modal (vises kun når bruker mangler entitlement) */}
      <NextRoleUpsellModal
        open={upsellFeature !== null}
        feature={upsellFeature}
        onClose={() => setUpsellFeature(null)}
      />

      {/* Onboarding-tour — første gang i editoren */}
      {selectedResume && <NextRoleOnboardingTour />}

      {/* Lazy-loaded Pro-dialoger. Suspense unngår blank skjerm mens
          chunk-en lastes. Hvert dialog rendrer kun når åpnet → ingen
          ekstra last for brukere som aldri åpner dem. */}
      <React.Suspense fallback={null}>
        {showCoverLetterLibrary && (
          <NextRoleCoverLetterLibrary
            open={showCoverLetterLibrary}
            onClose={() => setShowCoverLetterLibrary(false)}
          />
        )}
        {showMockInterview && (
          <NextRoleMockInterview
            open={showMockInterview}
            onClose={() => {
              setShowMockInterview(false);
              setMockInterviewAppId(null);
            }}
            resumeId={selectedResume?.id ?? null}
            jobApplicationId={mockInterviewAppId}
          />
        )}
        {showVideoPresentation && (
          <NextRoleVideoPresentation
            open={showVideoPresentation}
            onClose={() => {
              setShowVideoPresentation(false);
              setVideoPresentationAppId(null);
            }}
            resumeId={selectedResume?.id ?? null}
            jobApplicationId={videoPresentationAppId}
          />
        )}
        {showGdprDialog && (
          <NextRoleGdprDialog
            open={showGdprDialog}
            onClose={() => setShowGdprDialog(false)}
          />
        )}
        {showArbeidsplassen && (
          <ArbeidsplassenImportDialog
            open={showArbeidsplassen}
            onClose={() => setShowArbeidsplassen(false)}
            onImported={() => setShowArbeidsplassen(false)}
          />
        )}
        {showCvAnalytics && (
          <PublicCvAnalyticsDialog
            open={showCvAnalytics}
            onClose={() => setShowCvAnalytics(false)}
            resumeId={selectedResume?.id ?? null}
            resumeTitle={selectedResume?.title}
          />
        )}
        {showEducationVerification && (
          <EducationVerificationDialog
            open={showEducationVerification}
            onClose={() => setShowEducationVerification(false)}
            resumeId={selectedResume?.id ?? null}
            educations={(selectedResume?.education ?? []) as any}
          />
        )}
        {showSigrid && (
          <SigridCareerMentor
            open={showSigrid}
            onClose={() => setShowSigrid(false)}
            resumeId={selectedResume?.id ?? null}
          />
        )}
        {showIndustryPicker && (
          <IndustryTemplatePicker
            open={showIndustryPicker}
            onClose={() => setShowIndustryPicker(false)}
            onInsertAchievements={(achievements) => {
              // Sett inn på siste arbeidserfaring hvis den finnes,
              // ellers opprett en ny erfaring som starter-mal.
              if (!selectedResume) return;
              const existing = [...((selectedResume.experiences ?? []) as any[])];
              let updated: Resume;
              if (existing.length > 0) {
                const last = { ...existing[existing.length - 1] };
                last.achievements = [
                  ...((last.achievements ?? []) as string[]),
                  ...achievements,
                ];
                existing[existing.length - 1] = last;
                updated = { ...selectedResume, experiences: existing } as Resume;
              } else {
                updated = {
                  ...selectedResume,
                  experiences: [
                    {
                      id: `exp-${Date.now()}`,
                      jobTitle: '',
                      company: '',
                      location: '',
                      employmentType: 'full-time',
                      startDate: '',
                      endDate: null,
                      isCurrent: false,
                      description: '',
                      achievements,
                    } as any,
                  ],
                } as Resume;
              }
              setSelectedResume(updated);
              updateResumeMutation.mutate({
                id: selectedResume.id,
                data: { experiences: updated.experiences } as Partial<Resume>,
              });
            }}
            onInsertSkills={(skills) => {
              if (!selectedResume) return;
              const existingSkills = (selectedResume.skills ?? []) as any[];
              const existingNames = existingSkills.map((s) =>
                typeof s === 'string' ? s : (s.name ?? ''),
              );
              const toAdd = skills.filter((s) => !existingNames.includes(s));
              const merged = [...existingSkills, ...toAdd];
              const updated = { ...selectedResume, skills: merged } as Resume;
              setSelectedResume(updated);
              updateResumeMutation.mutate({
                id: selectedResume.id,
                data: { skills: merged } as Partial<Resume>,
              });
            }}
            onInsertJobTitle={(title) => {
              if (!selectedResume) return;
              const newPersonal = {
                ...(selectedResume.personalInfo ?? {}),
                professionalTitle: title,
              };
              const updated = { ...selectedResume, personalInfo: newPersonal } as Resume;
              setSelectedResume(updated);
              updateResumeMutation.mutate({
                id: selectedResume.id,
                data: { personalInfo: newPersonal } as Partial<Resume>,
              });
            }}
          />
        )}
        {showReferralDialog && (
          <NextRoleReferralDialog
            open={showReferralDialog}
            onClose={() => setShowReferralDialog(false)}
          />
        )}
        {showKanbanDialog && (
          <Dialog
            open={showKanbanDialog}
            onClose={() => setShowKanbanDialog(false)}
            maxWidth="xl"
            fullWidth
            PaperProps={{ sx: { height: '90vh' } }}
          >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Mine søknader</Typography>
              <IconButton onClick={() => setShowKanbanDialog(false)} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 1, overflow: 'auto' }}>
              <JobApplicationKanban
                onCardClick={(app) =>
                  setMilestoneDialogApp({
                    id: app.id,
                    jobTitle: app.jobTitle,
                    company: app.company,
                  })
                }
                onPracticeInterview={(app) => {
                  setMockInterviewAppId(app.id);
                  setShowKanbanDialog(false);
                  setShowMockInterview(true);
                }}
                onImportFromArbeidsplassen={() => setShowArbeidsplassen(true)}
              />
            </DialogContent>
          </Dialog>
        )}
        {milestoneDialogApp && (
          <JobApplicationMilestonesDialog
            open={!!milestoneDialogApp}
            applicationId={milestoneDialogApp.id}
            jobTitle={milestoneDialogApp.jobTitle}
            company={milestoneDialogApp.company}
            onClose={() => setMilestoneDialogApp(null)}
          />
        )}
      </React.Suspense>

      {/* CV-import Dialog (PDF/DOCX → Claude) */}
      <Dialog
        open={showCvImportDialog}
        onClose={() => (cvImporting ? null : setShowCvImportDialog(false))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Importer eksisterende CV</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Last opp PDF eller DOCX av en eksisterende CV. Claude leser
              innholdet og bygger en strukturert CV i CreatorHub som du kan
              fortsette å redigere — med erfaring, utdanning, ferdigheter,
              sertifiseringer og språk.
            </Alert>
            <Typography variant="caption" color="text.secondary">
              Maks 10 MB. Skannede/bildebaserte PDF-er støttes ikke fullt ut
              (tekst-laget i fila må være lesbart).
            </Typography>
            {cvImporting ? (
              <Box sx={{ py: 2 }}>
                <LinearProgress />
                <Typography variant="body2" sx={{ mt: 1.5, textAlign: 'center' }}>
                  {cvImportStatus || 'Behandler …'}
                </Typography>
              </Box>
            ) : (
              <Button
                variant="contained"
                component="label"
                startIcon={<UploadIcon />}
                size="large"
                fullWidth
                sx={{ py: 1.5 }}
              >
                Velg fil og importer
                <input
                  type="file"
                  accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setCvImporting(true);
                    setCvImportStatus('Laster opp og leser dokumentet …');
                    try {
                      const fd = new FormData();
                      fd.append('file', file);
                      setCvImportStatus('Claude strukturerer innholdet — dette kan ta 10–20 sekunder …');
                      const res = await apiRequest('/api/resumes/import', {
                        method: 'POST',
                        headers: { 'x-user-id': user?.id || '' },
                        body: fd,
                      });
                      if (res?.resumeId) {
                        const counts = res.imported ?? {};
                        setSnackbar({
                          open: true,
                          severity: 'success',
                          message: `CV importert: ${counts.experiences ?? 0} erfaringer, ${counts.education ?? 0} utdanninger, ${counts.skills ?? 0} ferdigheter, ${counts.certifications ?? 0} sertifiseringer, ${counts.languages ?? 0} språk.`,
                        });
                        analytics?.trackEvent?.('nextrole_cv_imported', {
                          userId: user?.id,
                          resumeId: res.resumeId,
                          fileType: file.type,
                          fileSizeBytes: file.size,
                          counts,
                        });
                        // Refresh listen + naviger til nye CV-en
                        queryClient.invalidateQueries({ queryKey: ['resumes'] });
                        try {
                          const full = await apiRequest(`/api/resumes/${res.resumeId}`, {
                            headers: { 'x-user-id': user?.id || '' },
                          });
                          if (full?.resume) {
                            setSelectedResume({
                              ...full.resume,
                              experiences: full.experiences ?? [],
                              education: full.education ?? [],
                              skills: full.skills ?? [],
                              certifications: full.certifications ?? [],
                              projects: full.projects ?? [],
                              languages: full.languages ?? [],
                            });
                            setActiveStep(1);
                          }
                        } catch {
                          /* ignore — bruker kan velge fra listen */
                        }
                        setShowCvImportDialog(false);
                      }
                    } catch (err) {
                      console.error('CV-import feilet', err);
                      setSnackbar({
                        open: true,
                        severity: 'error',
                        message: 'CV-import feilet. Sjekk at fila er PDF/DOCX og prøv igjen.',
                      });
                    } finally {
                      setCvImporting(false);
                      setCvImportStatus('');
                    }
                  }}
                />
              </Button>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowCvImportDialog(false)}
            disabled={cvImporting}
          >
            Avbryt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Experience Dialog — støtter både flat achievements OG grupperte
         sub-roller (Produsent / Regissør / Fotograf). Toggle "Bruk
         grupperte under-roller" bytter modus. */}
      <Dialog open={showExperienceDialog} onClose={handleCloseExperienceDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingExperience ? 'Rediger erfaring' : 'Legg til erfaring'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Stilling"
                  fullWidth
                  required
                  value={experienceFormData.jobTitle}
                  onChange={(e) =>
                    setExperienceFormData((prev) => ({ ...prev, jobTitle: e.target.value }))
                  }
                  placeholder="F.eks. Daglig leder"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Selskap / arbeidsgiver"
                  fullWidth
                  required
                  value={experienceFormData.company}
                  onChange={(e) =>
                    setExperienceFormData((prev) => ({ ...prev, company: e.target.value }))
                  }
                  placeholder="F.eks. Norwedfilm"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Sted"
                  fullWidth
                  value={experienceFormData.location}
                  onChange={(e) =>
                    setExperienceFormData((prev) => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="F.eks. Lørenskog"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="employment-type-label">Ansettelsesform</InputLabel>
                  <Select
                    labelId="employment-type-label"
                    label="Ansettelsesform"
                    value={experienceFormData.employmentType}
                    onChange={(e) =>
                      setExperienceFormData((prev) => ({
                        ...prev,
                        employmentType: e.target.value as ResumeExperience['employmentType'],
                      }))
                    }
                  >
                    <MenuItem value="">Ikke spesifisert</MenuItem>
                    <MenuItem value="full-time">Fulltid</MenuItem>
                    <MenuItem value="part-time">Deltid</MenuItem>
                    <MenuItem value="contract">Kontrakt</MenuItem>
                    <MenuItem value="freelance">Frilans</MenuItem>
                    <MenuItem value="self-employed">Selvstendig</MenuItem>
                    <MenuItem value="internship">Praksis / Internship</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Startdato"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={experienceFormData.startDate}
                  onChange={(e) =>
                    setExperienceFormData((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Sluttdato"
                  type="date"
                  fullWidth
                  disabled={experienceFormData.isCurrent}
                  InputLabelProps={{ shrink: true }}
                  value={experienceFormData.endDate}
                  onChange={(e) =>
                    setExperienceFormData((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={experienceFormData.isCurrent}
                      onChange={(e) =>
                        setExperienceFormData((prev) => ({
                          ...prev,
                          isCurrent: e.target.checked,
                          endDate: e.target.checked ? '' : prev.endDate,
                        }))
                      }
                    />
                  }
                  label="Nåværende stilling"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Beskrivelse (kort)"
                  fullWidth
                  multiline
                  minRows={2}
                  value={experienceFormData.description}
                  onChange={(e) =>
                    setExperienceFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  helperText="1–2 setninger om rollen. La denne stå tom hvis innholdet dekkes av punktene under."
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={experienceFormData.useGroups}
                      onChange={(e) =>
                        setExperienceFormData((prev) => ({
                          ...prev,
                          useGroups: e.target.checked,
                          experienceGroups:
                            e.target.checked && prev.experienceGroups.length === 0
                              ? [{ category: '', items: [''] }]
                              : prev.experienceGroups,
                        }))
                      }
                    />
                  }
                  label="Bruk grupperte under-roller (f.eks. Produsent / Regissør / Fotograf)"
                />
              </Grid>

              {experienceFormData.useGroups ? (
                <Grid item xs={12}>
                  <Stack spacing={1.5}>
                    {experienceFormData.experienceGroups.map((group, gi) => (
                      <Paper key={gi} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                          <TextField
                            label="Kategori"
                            size="small"
                            fullWidth
                            value={group.category ?? ''}
                            onChange={(e) =>
                              handleUpdateExperienceGroupCategory(gi, e.target.value)
                            }
                            placeholder="F.eks. Produsent, Regissør, Fotograf"
                          />
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveExperienceGroup(gi)}
                            title="Fjern kategori"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                        <Stack spacing={0.75} sx={{ pl: 1 }}>
                          {(group.items ?? []).map((item, ii) => (
                            <Stack key={ii} direction="row" spacing={1} alignItems="center">
                              <TextField
                                size="small"
                                fullWidth
                                value={item}
                                onChange={(e) =>
                                  handleUpdateGroupItem(gi, ii, e.target.value)
                                }
                                placeholder="Bullet-punkt"
                              />
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveGroupItem(gi, ii)}
                                title="Fjern punkt"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          ))}
                          <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => handleAddGroupItem(gi)}
                            sx={{ alignSelf: 'flex-start' }}
                          >
                            Legg til punkt
                          </Button>
                        </Stack>
                      </Paper>
                    ))}
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleAddExperienceGroup}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Legg til kategori
                    </Button>
                  </Stack>
                </Grid>
              ) : (
                <Grid item xs={12}>
                  <TextField
                    label="Punkter (én per linje)"
                    fullWidth
                    multiline
                    minRows={4}
                    value={experienceFormData.achievements}
                    onChange={(e) =>
                      setExperienceFormData((prev) => ({ ...prev, achievements: e.target.value }))
                    }
                    helperText="Hver linje blir et eget bullet-punkt på CV-en."
                  />
                </Grid>
              )}
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseExperienceDialog}>Avbryt</Button>
          <Button variant="contained" onClick={handleSaveExperience} startIcon={<SaveIcon />}>
            {editingExperience ? 'Lagre' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Language Dialog */}
      <Dialog open={showLanguageDialog} onClose={handleCloseLanguageDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingLanguage ? 'Rediger språk' : 'Legg til språk'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Språk"
              fullWidth
              autoFocus
              value={languageFormData.name}
              onChange={(e) =>
                setLanguageFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="F.eks. Norsk, Engelsk, Spansk"
              helperText="Skriv språkets navn på norsk"
            />
            <FormControl fullWidth>
              <InputLabel id="language-level-label">Nivå</InputLabel>
              <Select
                labelId="language-level-label"
                label="Nivå"
                value={languageFormData.levelLabel}
                onChange={(e) => {
                  const label = e.target.value as string;
                  setLanguageFormData((prev) => ({
                    ...prev,
                    levelLabel: label,
                    proficiencyLevel: PROFICIENCY_BY_LABEL[label] ?? prev.proficiencyLevel,
                    isNative: label === 'Morsmål',
                  }));
                }}
              >
                <MenuItem value="Morsmål">Morsmål</MenuItem>
                <MenuItem value="Flytende">Flytende</MenuItem>
                <MenuItem value="God">God</MenuItem>
                <MenuItem value="Grunnleggende">Grunnleggende</MenuItem>
              </Select>
            </FormControl>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Visuelt nivå (progress-bar): {languageFormData.proficiencyLevel}%
              </Typography>
              <Box sx={{ px: 1 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={languageFormData.proficiencyLevel}
                  onChange={(e) =>
                    setLanguageFormData((prev) => ({
                      ...prev,
                      proficiencyLevel: Number(e.target.value),
                    }))
                  }
                  style={{ width: '100%' }}
                />
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLanguageDialog}>Avbryt</Button>
          <Button variant="contained" onClick={handleSaveLanguage} startIcon={<SaveIcon />}>
            {editingLanguage ? 'Lagre' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Skill Dialog */}
      <Dialog open={showSkillDialog} onClose={handleCloseSkillDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Legg til ferdighet</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Ferdighet"
              fullWidth
              value={skillFormData.name}
              onChange={(e) => setSkillFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="F.eks. React, Figma, Prosjektledelse"
            />
            <TextField
              label="Kategori (valgfritt)"
              fullWidth
              value={skillFormData.category}
              onChange={(e) => setSkillFormData((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="F.eks. Frontend, Design, Ledelse"
            />
            <FormControl fullWidth>
              <InputLabel id="skill-proficiency-label">Nivå</InputLabel>
              <Select
                labelId="skill-proficiency-label"
                label="Nivå"
                value={skillFormData.proficiencyLevel}
                onChange={(e) => setSkillFormData((prev) => ({ ...prev, proficiencyLevel: Number(e.target.value) }))}
              >
                <MenuItem value={1}>Nybegynner</MenuItem>
                <MenuItem value={2}>Grunnleggende</MenuItem>
                <MenuItem value={3}>God</MenuItem>
                <MenuItem value={4}>Avansert</MenuItem>
                <MenuItem value={5}>Ekspert</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSkillDialog}>Avbryt</Button>
          <Button variant="contained" onClick={handleAddSkill} startIcon={<AddIcon />}>
            Legg til
          </Button>
        </DialogActions>
      </Dialog>

      {/* Education Dialog */}
      <Dialog open={showEducationDialog} onClose={() => setShowEducationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEducationItem ? 'Rediger utdanning' : 'Legg til utdanning'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {!editingEducationItem && (
              <Button
                variant="outlined"
                fullWidth
                startIcon={<EducationIcon />}
                onClick={() => {
                  setShowEducationDialog(false);
                  handleImportFromVitnemalsportalen();
                }}
                sx={{
                  borderColor: '#1976d2',
                  color: '#1976d2',
                  '&:hover': {
                    borderColor: '#1565c0',
                    backgroundColor: 'rgba(25, 118, 210, 0.04)'
                  }
                }}
              >
                Importer fra vitnemalsportalen.no
              </Button>
            )}
            <TextField
              label="Grad"
              fullWidth
              value={educationFormData.degree}
              onChange={(e) => setEducationFormData((prev) => ({ ...prev, degree: e.target.value }))}
            />
            <TextField
              label="Institusjon"
              fullWidth
              value={educationFormData.institution}
              onChange={(e) => setEducationFormData((prev) => ({ ...prev, institution: e.target.value }))}
            />
            <TextField
              label="Studieretning"
              fullWidth
              value={educationFormData.fieldOfStudy}
              onChange={(e) => setEducationFormData((prev) => ({ ...prev, fieldOfStudy: e.target.value }))}
            />
            <TextField
              label="Sted"
              fullWidth
              value={educationFormData.location}
              onChange={(e) => setEducationFormData((prev) => ({ ...prev, location: e.target.value }))}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Startdato"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={educationFormData.startDate}
                onChange={(e) => setEducationFormData((prev) => ({ ...prev, startDate: e.target.value }))}
              />
              <TextField
                label="Sluttdato"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={educationFormData.endDate}
                onChange={(e) => setEducationFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                disabled={Boolean(educationFormData.isCurrent)}
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(educationFormData.isCurrent)}
                  onChange={(e) => setEducationFormData((prev) => ({ ...prev, isCurrent: e.target.checked }))}
                />
              }
              label="Pågående utdanning"
            />
            <TextField
              label="Karakter / snitt"
              fullWidth
              value={educationFormData.grade}
              onChange={(e) => setEducationFormData((prev) => ({ ...prev, grade: e.target.value }))}
            />
            <TextField
              label="Beskrivelse"
              fullWidth
              multiline
              rows={3}
              value={educationFormData.description}
              onChange={(e) => setEducationFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEducationDialog(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleSaveEducation}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      {/* Certification Dialog */}
      <Dialog open={showCertificationDialog} onClose={() => setShowCertificationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCertificationItem ? 'Rediger sertifisering' : 'Legg til sertifisering'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Sertifisering"
              fullWidth
              value={certificationFormData.name}
              onChange={(e) => setCertificationFormData((prev) => ({ ...prev, name: e.target.value }))}
            />
            <TextField
              label="Utsteder"
              fullWidth
              value={certificationFormData.issuer}
              onChange={(e) => setCertificationFormData((prev) => ({ ...prev, issuer: e.target.value }))}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Utstedt"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={certificationFormData.issueDate}
                onChange={(e) => setCertificationFormData((prev) => ({ ...prev, issueDate: e.target.value }))}
              />
              <TextField
                label="Utløpsdato"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={certificationFormData.expiryDate}
                onChange={(e) => setCertificationFormData((prev) => ({ ...prev, expiryDate: e.target.value }))}
              />
            </Stack>
            <TextField
              label="Credential ID"
              fullWidth
              value={certificationFormData.credentialId}
              onChange={(e) => setCertificationFormData((prev) => ({ ...prev, credentialId: e.target.value }))}
            />
            <TextField
              label="Credential URL"
              fullWidth
              value={certificationFormData.credentialUrl}
              onChange={(e) => setCertificationFormData((prev) => ({ ...prev, credentialUrl: e.target.value }))}
            />
            <TextField
              label="Beskrivelse"
              fullWidth
              multiline
              rows={3}
              value={certificationFormData.description}
              onChange={(e) => setCertificationFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCertificationDialog(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleSaveCertification}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      {/* Vitnemalsportalen Import Dialog */}
      <Dialog open={showVitnemalsportalenDialog} onClose={() => setShowVitnemalsportalenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Importer fra vitnemalsportalen.no</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {vitnemalsportalenInstructions ? (
              <>
                <Alert severity="success">
                  <Typography variant="subtitle2" gutterBottom>
                    Enkel import fra Vitnemålsportalen
                  </Typography>
                  <Typography variant="body2">
                    Hent dine vitnemål og utdanningsresultater direkte fra vitnemalsportalen.no med ett klikk.
                  </Typography>
                </Alert>
                
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={<EducationIcon />}
                  onClick={() => {
                    // Initiate EMREX flow to vitnemalsportalen.no
                    const returnUrl = `${window.location.origin}/resume/emrex-callback`;
                    const emrexUrl = `https://vip-test.uio.no/vp/login?returnUrl=${encodeURIComponent(returnUrl)}`;
                    window.location.href = emrexUrl;
                  }}
                  sx={{
                    background: 'linear-gradient(135deg, #1976d2 0%, #2196f3 100%)',
                    py: 2,
                    fontSize: '1.1rem',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                    }
                  }}
                >
                  Hent fra Vitnemålsportalen
                </Button>
                
                <Divider>eller</Divider>
                
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>
                    Manuell import (valgfritt):
                  </Typography>
                  <ol style={{ margin: 0, paddingLeft: '20px' }}>
                    <li>Gå til <Link href="https://www.vitnemalsportalen.no" target="_blank" rel="noopener">vitnemalsportalen.no</Link></li>
                    <li>Logg inn med BankID eller Feide</li>
                    <li>Eksporter dine vitnemål (XML eller JSON)</li>
                    <li>Lim inn dataene nedenfor</li>
                  </ol>
                </Alert>
                
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Eksempel på JSON-format:
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={8}
                    disabled
                    value={`[
  {
    "degree": "Bachelor i informatikk",
    "institution": "Universitetet i Oslo",
    "fieldOfStudy": "Informatikk",
    "startDate": "2020-08",
    "endDate": "2023-06",
    "grade": "A (4.5)",
    "location": "Oslo"
  }
]`}
                    sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                </Box>
                <Button
                  variant="contained"
                  onClick={() => setVitnemalsportalenInstructions(false)}
                >
                  Fortsett til import
                </Button>
              </>
            ) : (
              <>
                <Alert severity="info">
                  <Typography variant="body2">
                    Lim inn dine utdanningsdata fra vitnemalsportalen.no:
                  </Typography>
                </Alert>
                <TextField
                  fullWidth
                  multiline
                  rows={12}
                  placeholder={`Eksempel:
[
  {
    "degree": "Bachelor i informatikk",
    "institution": "Universitetet i Oslo",
    "fieldOfStudy": "Informatikk",
    "startDate": "2020-08",
    "endDate": "2023-06",
    "grade": "A"
  }
]`}
                  onChange={(e) => {
                    try {
                      const jsonData = JSON.parse(e.target.value);
                      // Store parsed vitnemalsportalen data for import
                      setLinkedInData((prev: LinkedInData | null) => ({
                        ...prev,
                        profile: prev?.profile || {},
                        experience: prev?.experience || [],
                        education: Array.isArray(jsonData) ? jsonData : prev?.education || [],
                        skills: prev?.skills || []
                      }));
                      setSnackbar({
                        open: true,
                        message: `Vitnemålsdataene lastet inn: ${Array.isArray(jsonData) ? jsonData.length : 1} element(er)`,
                        severity: 'success'
                      });
                    } catch (parseError) {
                      console.error('Failed to parse vitnemalsportalen JSON:', parseError);
                      setSnackbar({
                        open: true,
                        message: 'Ugyldig JSON-format. Kontroller dataene og prøv igjen.',
                        severity: 'error'
                      });
                    }
                  }}
                  id="vitnemalsportalen-data-input"
                />
              </>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Job Application Dialog */}
      <Dialog open={showJobDialog} onClose={() => setShowJobDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingJobApplication ? 'Rediger jobbsøknad' : 'Legg til jobbsøknad'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Stilling"
                fullWidth
                value={jobFormData.jobTitle}
                onChange={(e) =>
                  setJobFormData((prev: Partial<JobApplication>) => ({
                    ...prev,
                    jobTitle: e.target.value
                  }))
                }
              />
              <TextField
                label="Selskap"
                fullWidth
                value={jobFormData.company}
                onChange={(e) =>
                  setJobFormData((prev: Partial<JobApplication>) => ({
                    ...prev,
                    company: e.target.value
                  }))
                }
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Sted"
                fullWidth
                value={jobFormData.location}
                onChange={(e) => setJobFormData((prev) => ({ ...prev, location: e.target.value }))}
              />
              <TextField
                label="Jobb-URL (f.eks. fra finn.no)"
                fullWidth
                value={jobFormData.jobUrl}
                onChange={(e) => setJobFormData((prev) => ({ ...prev, jobUrl: e.target.value }))}
                helperText={jobFormData.jobUrl?.includes('finn.no') ? 'finn.no URL oppdaget' : ''}
              />
            </Stack>
            {jobFormData.jobUrl?.includes('finn.no') && (
              <Button
                variant="outlined"
                onClick={handleImportFromFinnNo}
                fullWidth
                sx={{ borderColor: '#06befb', color: '#06befb', '&:hover': { borderColor: '#0596c7', backgroundColor: 'rgba(6, 190, 251, 0.04)' } }}
              >
                Importer detaljer fra finn.no
              </Button>
            )}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Type søker</InputLabel>
                <Select
                  value={jobFormData.applicantType || ''}
                  label="Type søker"
                  onChange={(e) => setJobFormData((prev) => ({ ...prev, applicantType: e.target.value as JobApplication['applicantType'] }))}
                >
                  <MenuItem value="">Ikke angitt</MenuItem>
                  <MenuItem value="internship">Praksis/Internship</MenuItem>
                  <MenuItem value="trainee">Trainee</MenuItem>
                  <MenuItem value="full-time">Heltid</MenuItem>
                  <MenuItem value="part-time">Deltid</MenuItem>
                  <MenuItem value="contract">Kontrakt</MenuItem>
                  <MenuItem value="freelance">Frilans</MenuItem>
                  <MenuItem value="temporary">Midlertidig</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Kilde"
                fullWidth
                value={jobFormData.source || ''}
                onChange={(e) => setJobFormData((prev) => ({ ...prev, source: e.target.value }))}
                placeholder="f.eks. finn.no, LinkedIn, etc."
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={jobFormData.status || 'saved'}
                  label="Status"
                  onChange={(e) => setJobFormData((prev) => ({ ...prev, status: e.target.value as JobApplication['status'] }))}
                >
                  <MenuItem value="saved">Lagret</MenuItem>
                  <MenuItem value="applied">Søkt</MenuItem>
                  <MenuItem value="interviewing">Intervju</MenuItem>
                  <MenuItem value="offer">Tilbud</MenuItem>
                  <MenuItem value="accepted">Akseptert</MenuItem>
                  <MenuItem value="rejected">Avslått</MenuItem>
                  <MenuItem value="withdrawn">Trukket</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Prioritet</InputLabel>
                <Select
                  value={jobFormData.priority || 'medium'}
                  label="Prioritet"
                  onChange={(e) => setJobFormData((prev) => ({ ...prev, priority: e.target.value as JobApplication['priority'] }))}
                >
                  <MenuItem value="low">Lav</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">Høy</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Søkt dato"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={jobFormData.appliedDate}
                onChange={(e) => setJobFormData((prev) => ({ ...prev, appliedDate: e.target.value }))}
              />
              <TextField
                label="Søknadsfrist"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={jobFormData.deadline}
                onChange={(e) => setJobFormData((prev) => ({ ...prev, deadline: e.target.value }))}
                helperText={jobFormData.deadline && new Date(jobFormData.deadline) < new Date() ? "Frist passert" : ""}
              />
            </Stack>
            {(jobFormData.status === 'interviewing' || jobFormData.interviewDate) && (
              <TextField
                label="Intervjudato"
                type="datetime-local"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={jobFormData.interviewDate}
                onChange={(e) => setJobFormData((prev) => ({ ...prev, interviewDate: e.target.value }))}
                helperText="Sett intervjudato for å få forberedelsesverktøy"
              />
            )}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Velg CV</InputLabel>
                <Select
                  value={jobFormData.resumeId || ''}
                  label="Velg CV"
                  onChange={(e) => setJobFormData((prev) => ({ ...prev, resumeId: e.target.value as string }))}
                >
                  <MenuItem value="">Ingen</MenuItem>
                  {Array.isArray(resumes) && resumes.map((resume) => (
                    <MenuItem key={resume.id} value={resume.id}>
                      {resume.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={jobFormData.tags || []}
              onChange={(_, value) => setJobFormData((prev) => ({ ...prev, tags: value as string[] }))}
              renderInput={(params) => (
                <TextField {...params} label="Tags" placeholder="Legg til tags" />
              )}
            />
            <TextField
              label="Notater"
              fullWidth
              multiline
              rows={3}
              value={jobFormData.notes}
              onChange={(e) => setJobFormData((prev) => ({ ...prev, notes: e.target.value }))}
            />
            <TextField
              label="Søknadsbrev"
              fullWidth
              multiline
              rows={4}
              value={jobFormData.coverLetter}
              onChange={(e) => setJobFormData((prev) => ({ ...prev, coverLetter: e.target.value }))}
            />
            <Button
              variant="outlined"
              startIcon={<AIIcon />}
              onClick={() => openAiTool('generate-cover-letter', '', 'job-application-cover-letter')}
            >
              Generer søknadsbrev med AI
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AIIcon />}
              onClick={handleAnalyzeJobForResume}
              disabled={!jobFormData.notes || !jobFormData.notes.includes('Finn-kode')}
            >
              Analyser jobb & få AI-forslag
            </Button>
            {jobFormData.interviewDate && (
              <Button
                variant="contained"
                color="success"
                startIcon={<GpsFixedIcon />}
                onClick={handlePrepareForInterview}
              >
                Forbered intervju
              </Button>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowJobDialog(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleSaveJobApplication}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onClose={() => setShowTemplateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Velg CV-mal</DialogTitle>
        <DialogContent>
          {templatesLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {(templates.length > 0 ? templates : resumeTemplates).map((template) => (
              <Grid item xs={12} md={6} key={template.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6">{template.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.description}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Chip label={template.layout} size="small" />
                      <Chip label={`ATS ${template.atsScore}%`} size="small" color="success" />
                      {template.isPremium && <Chip label="Premium" size="small" color="warning" />}
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button variant="contained" onClick={() => handleSelectTemplate(template)}>
                      Velg mal
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplateDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={showVersionDialog} onClose={() => setShowVersionDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Versjonshistorikk</DialogTitle>
        <DialogContent>
          {versionHistory.length === 0 ? (
            <Alert severity="info">Ingen publiserte versjoner ennå.</Alert>
          ) : (
            <List>
              {versionHistory.map((version) => (
                <ListItem key={version.id} divider>
                  <ListItemText
                    primary={`Versjon ${version.versionNumber}`}
                    secondary={new Date(version.createdAt).toLocaleString('no-NO')}
                  />
                  <Button variant="outlined" onClick={() => handleRestoreVersion(version)}>
                    Gjenopprett
                  </Button>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRestoreFromBackup}>Gjenopprett backup</Button>
          <Button onClick={() => setShowVersionDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Project Import Dialog */}
      <Dialog 
        open={showProjectImportDialog} 
        onClose={() => setShowProjectImportDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Importer fullførte prosjekter</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Alle fullførte prosjekter vil bli importert som arbeidserfaring og porteføljeprosjekter.
          </Alert>
          <Typography variant="body2">
            Dette vil automatisk legge til dine fullførte prosjekter som arbeidserfaring i CV-en din.
            Du kan redigere og tilpasse informasjonen etterpå.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProjectImportDialog(false)}>Avbryt</Button>
          <Button 
            variant="contained" 
            onClick={handleImportProjects}
            disabled={importProjectsMutation.isPending}
            startIcon={importProjectsMutation.isPending ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            Importer prosjekter
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Analysis Dialog */}
      <Dialog 
        open={showAIDialog} 
        onClose={() => setShowAIDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>AI-analyse av CV</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            AI vil analysere CV-en din og gi forslag til forbedringer basert på ATS-optimalisering og beste praksis.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Stillingsannonse (valgfritt)"
            placeholder="Lim inn stillingsannonsen du søker på for å få skreddersydde forslag..."
            value={aiJobDescription}
            onChange={(e) => setAiJobDescription(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAIDialog(false)}>Avbryt</Button>
          <Button 
            variant="contained" 
            onClick={handleAIAnalyze}
            disabled={aiAnalyzeMutation.isPending}
            startIcon={aiAnalyzeMutation.isPending ? <CircularProgress size={20} /> : <AIIcon />}
          >
            Analyser med AI
          </Button>
        </DialogActions>
      </Dialog>

      {/* LinkedIn Import Dialog */}
      <Dialog 
        open={linkedInDialog} 
        onClose={() => {
          setLinkedInDialog(false);
          setLinkedInImportMode('select');
          setLinkedInData(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinkedInIcon sx={{ color: '#2563eb' }} />
            <Typography 
              sx={{ 
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #ff8c00 0%, #2563eb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'}}
            >
              {linkedInImportMode === 'select' ? 'Importer fra LinkedIn' : 'Forhåndsvis import'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {linkedInImportMode === 'select' ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Velg hvilke deler av LinkedIn-profilen din du vil importere til CV-en.
              </Alert>
              
              {linkedIn.state.isAuthenticated && linkedIn.state.profile && (
                <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box flex={1}>
                      <Typography variant="subtitle2" gutterBottom>LinkedIn-profil</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {linkedIn.state.profile.firstName} {linkedIn.state.profile.lastName}
                      </Typography>
                      {linkedIn.state.profile.headline && (
                        <Typography variant="body2" color="text.secondary">
                          {linkedIn.state.profile.headline}
                        </Typography>
                      )}
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleLinkedInSync}
                      startIcon={<AutoAwesome />}
                      sx={{
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 500,
                        textTransform: 'none',
                        borderColor: '#2563eb',
                        color: '#2563eb',
                        '&:hover': {
                          borderColor: '#ff8c00',
                          color: '#ff8c00',
                          bgcolor: 'rgba(255, 140, 0, 0.05)'
                        }
                      }}
                    >
                      Synkroniser
                    </Button>
                  </Stack>
                </Box>
              )}

              <FormControlLabel
                control={
                  <Switch
                    checked={linkedInSelectedData.personalInfo}
                    onChange={(e) => setLinkedInSelectedData(prev => ({ ...prev, personalInfo: e.target.checked }))}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Personlig informasjon</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Navn, e-post, lokasjon, profilbilde
                    </Typography>
                  </Box>
                }
              />
              <Divider sx={{ my: 1 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={linkedInSelectedData.workExperience}
                    onChange={(e) => setLinkedInSelectedData(prev => ({ ...prev, workExperience: e.target.checked }))}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Arbeidserfaring</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {linkedInData?.experience?.length || 0} stillinger
                    </Typography>
                  </Box>
                }
              />
              <Divider sx={{ my: 1 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={linkedInSelectedData.education}
                    onChange={(e) => setLinkedInSelectedData(prev => ({ ...prev, education: e.target.checked }))}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Utdanning</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {linkedInData?.education?.length || 0} utdanninger
                    </Typography>
                  </Box>
                }
              />
              <Divider sx={{ my: 1 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={linkedInSelectedData.skills}
                    onChange={(e) => setLinkedInSelectedData(prev => ({ ...prev, skills: e.target.checked }))}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Ferdigheter</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {linkedInData?.skills?.length || 0} ferdigheter
                    </Typography>
                  </Box>
                }
              />
              <Divider sx={{ my: 1 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={linkedInSelectedData.certifications}
                    onChange={(e) => setLinkedInSelectedData(prev => ({ ...prev, certifications: e.target.checked }))}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Sertifiseringer</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {linkedInData?.certifications?.length || 0} sertifiseringer
                    </Typography>
                  </Box>
                }
              />
            </>
          ) : (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Data importert! Her er en oversikt over hva som ble lagt til:
              </Alert>
              
              {linkedInSelectedData.personalInfo && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Personlig informasjon</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Importert
                  </Typography>
                </Box>
              )}

              {linkedInSelectedData.workExperience && linkedInData?.experience && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Arbeidserfaring</Typography>
                  {linkedInData.experience.slice(0, 3).map((exp: any, idx: number) => (
                    <Typography key={idx} variant="body2" color="text.secondary">
                      {exp.title} at {exp.company}
                    </Typography>
                  ))}
                  {linkedInData.experience.length > 3 && (
                    <Typography variant="caption" color="text.secondary">
                      + {linkedInData.experience.length - 3} flere stillinger
                    </Typography>
                  )}
                </Box>
              )}

              {linkedInSelectedData.education && linkedInData?.education && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Utdanning</Typography>
                  {linkedInData.education.map((edu, idx) => (
                    <Typography key={idx} variant="body2" color="text.secondary">
                      {edu.schoolName || 'Ukjent institusjon'} - {edu.degreeType || edu.fieldOfStudy}
                    </Typography>
                  ))}
                </Box>
              )}

              {linkedInSelectedData.skills && linkedInData?.skills && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Ferdigheter</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {linkedInData.skills
                      .filter((skill) => Boolean(skill.name))
                      .slice(0, 10)
                      .map((skill, idx) => (
                        <Chip key={idx} label={skill.name} size="small" />
                      ))}
                    {linkedInData.skills.length > 10 && (
                      <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 1 }}>
                        + {linkedInData.skills.length - 10} flere
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {linkedInImportMode === 'select' ? (
            <>
              <Button onClick={() => {
                setLinkedInDialog(false);
                setLinkedInData(null);
              }}>
                Avbryt
              </Button>
              <Button
                onClick={handleLinkedInPreview}
                disabled={!Object.values(linkedInSelectedData).some(v => v)}
                sx={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                  '&:disabled': { color: '#ccc' }
                }}
              >
                Forhåndsvis
              </Button>
              <Button 
                variant="contained" 
                onClick={handleLinkedInImport}
                startIcon={<LinkedInIcon />}
                disabled={!Object.values(linkedInSelectedData).some(v => v)}
                sx={{
                  background: 'linear-gradient(135deg, #ff8c00 0%, #2563eb 100%)',
                  color: '#fff',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600, '&:hover': {
                    background: 'linear-gradient(135deg, #ff8c00 0%, #2563eb 100%)',
                    opacity: 0.9,
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  }, '&:disabled': {
                    background: '#ccc',
                    color: '#666',
                  }}}
              >
                Importer valgte deler
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleLinkedInBackToSelect}>
                Tilbake
              </Button>
              <Button 
                variant="contained" 
                onClick={() => {
                  setLinkedInDialog(false);
                  setLinkedInImportMode('select');
                  setLinkedInData(null);
                }}
                startIcon={<CheckIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #ff8c00 0%, #2563eb 100%)',
                  color: '#fff',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600, '&:hover': {
                    background: 'linear-gradient(135deg, #ff8c00 0%, #2563eb 100%)',
                    opacity: 0.9,
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  }}}
              >
                Lukk
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog 
        open={showExportDialog} 
        onClose={() => setShowExportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Eksporter CV</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Velg format for eksport:
          </Typography>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Button 
              variant="outlined" 
              fullWidth 
              onClick={() => handleExport('pdf')}
              startIcon={<DownloadIcon />}
            >
              PDF (Anbefalt)
            </Button>
            <Button 
              variant="outlined" 
              fullWidth 
              onClick={() => handleExport('docx')}
              startIcon={<DownloadIcon />}
            >
              DOCX (Word)
            </Button>
            <Button 
              variant="outlined" 
              fullWidth 
              onClick={() => handleExport('txt')}
              startIcon={<DownloadIcon />}
            >
              TXT (Enkel tekst)
            </Button>
            <Button 
              variant="outlined" 
              fullWidth 
              onClick={() => handleExport('html')}
              startIcon={<DownloadIcon />}
            >
              HTML
            </Button>
            <Button 
              variant="outlined" 
              fullWidth 
              onClick={() => handleExport('json')}
              startIcon={<DownloadIcon />}
            >
              JSON (Backup)
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Portfolio Dialog */}
      <Dialog 
        open={showPortfolioDialog} 
        onClose={() => setShowPortfolioDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {editingPortfolioItem ? 'Rediger portefølje-oppføring' : 'Legg til portefølje-oppføring'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* Title */}
            <TextField
              label="Tittel"
              fullWidth
              value={portfolioFormData.title || ', '}
              onChange={(e) => setPortfolioFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />

            {/* Description */}
            <TextField
              label="Beskrivelse"
              fullWidth
              multiline
              rows={3}
              value={portfolioFormData.description || ', '}
              onChange={(e) => setPortfolioFormData(prev => ({ ...prev, description: e.target.value }))}
              required
            />

            {/* Category */}
            <FormControl fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={portfolioFormData.category || 'project'}
                onChange={(e) => setPortfolioFormData(prev => ({ ...prev, category: e.target.value as PortfolioItem['category'] }))}
              >
                <MenuItem value="project">Prosjekt</MenuItem>
                <MenuItem value="design">Design</MenuItem>
                <MenuItem value="documentation">Dokumentasjon</MenuItem>
                <MenuItem value="presentation">Presentasjon</MenuItem>
                <MenuItem value="other">Annet</MenuItem>
              </Select>
            </FormControl>

            {/* Technologies */}
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={portfolioFormData.technologies || []}
              onChange={(event, newValue) => {
                setPortfolioFormData(prev => ({ ...prev, technologies: newValue }));
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Teknologier"
                  placeholder="Skriv og trykk Enter for å legge til"
                />
              )}
            />

            {/* Google Drive Links */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Google Drive-filer</Typography>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={handleGoogleDriveFilePicker}
                  disabled={!auth.state.isAuthenticated}
                >
                  Velg fra Google Drive
                </Button>
              </Stack>

              {!auth.state.isAuthenticated && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Du må være logget inn med Google for å kunne velge filer fra Google Drive.
                </Alert>
              )}

              {portfolioFormData.googleDriveLinks && portfolioFormData.googleDriveLinks.length > 0 && (
                <Stack spacing={1}>
                  {portfolioFormData.googleDriveLinks.map((link) => (
                    <Card key={link.id} variant="outlined">
                      <CardContent sx={{ py: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          {getFileIcon(link.type)}
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {link.name}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {link.type.toUpperCase()} {link.size && `• ${link.size}`}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleRemoveGoogleDriveLink(link.id)}
                          >
                            <DeleteIcon />
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}

              {(!portfolioFormData.googleDriveLinks || portfolioFormData.googleDriveLinks.length === 0) && (
                <Alert severity="info">
                  Ingen Google Drive-filer valgt. Klikk på "Velg fra Google Drive" for å legge til filer.
                </Alert>
              )}
            </Box>

            {/* Public/Private */}
            <FormControlLabel
              control={
                <Switch
                  checked={portfolioFormData.isPublic || false}
                  onChange={(e) => setPortfolioFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                />
              }
              label="Offentlig (synlig for andre)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPortfolioDialog(false)}>
            Avbryt
          </Button>
          <Button
            onClick={handleSavePortfolioItem}
            variant="contained"
            disabled={!portfolioFormData.title || !portfolioFormData.description}
          >
            {editingPortfolioItem ? 'Oppdater' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Writing Assistant Dialog - QuillBot-style */}
      <Dialog
        open={aiToolDialog}
        onClose={() => setAiToolDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AIIcon color="primary" />
            <Typography variant="h6">
              {aiToolType === 'paraphrase' && 'AI Omskriving'}
              {aiToolType === 'grammar' && 'AI Grammatikksjekk'}
              {aiToolType === 'summarize' && 'AI Oppsummering'}
              {aiToolType === 'generate-resume' && 'AI CV-Generator'}
              {aiToolType === 'generate-cover-letter' && 'AI Søknadsbrev-Generator'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* Paraphrase Mode Selector */}
            {aiToolType === 'paraphrase' && (
              <FormControl fullWidth>
                <InputLabel>Omskrivings-modus</InputLabel>
                <Select
                  value={aiParaphraseMode}
                  onChange={(e) => setAiParaphraseMode(e.target.value)}
                  label="Omskrivings-modus"
                >
                  {aiParaphraseModes.map((mode) => (
                    <MenuItem key={mode.value} value={mode.value}>
                      <Box>
                        <Typography variant="body1">{mode.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {mode.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Input Text */}
            {(aiToolType === 'paraphrase' || aiToolType === 'grammar' || aiToolType === 'summarize') && (
              <TextField
                label="Input-tekst"
                multiline
                rows={6}
                value={aiInputText}
                onChange={(e) => setAiInputText(e.target.value)}
                placeholder="Skriv inn eller lim inn tekst her..."
                fullWidth
              />
            )}

            {aiToolType === 'generate-resume' && (
              <Stack spacing={2}>
                <TextField
                  label="Jobbtittel"
                  value={aiJobTitle}
                  onChange={(e) => setAiJobTitle(e.target.value)}
                  placeholder="F.eks. Produktdesigner"
                  fullWidth
                />
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={aiSkills}
                  onChange={(_, value) => setAiSkills(value as string[])}
                  renderInput={(params) => (
                    <TextField {...params} label="Ferdigheter" placeholder="Legg til ferdigheter" />
                  )}
                />
                <TextField
                  label="Erfaring"
                  multiline
                  rows={5}
                  value={aiExperience}
                  onChange={(e) => setAiExperience(e.target.value)}
                  placeholder="Skriv en kort beskrivelse av erfaringen din..."
                  fullWidth
                />
              </Stack>
            )}

            {aiToolType === 'generate-cover-letter' && (
              <Stack spacing={2}>
                <TextField
                  label="Jobbtittel"
                  value={aiJobTitle}
                  onChange={(e) => setAiJobTitle(e.target.value)}
                  placeholder="F.eks. Frontend-utvikler"
                  fullWidth
                />
                <TextField
                  label="Selskap"
                  value={aiCompany}
                  onChange={(e) => setAiCompany(e.target.value)}
                  placeholder="F.eks. CreatorHub"
                  fullWidth
                />
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={aiSkills}
                  onChange={(_, value) => setAiSkills(value as string[])}
                  renderInput={(params) => (
                    <TextField {...params} label="Ferdigheter" placeholder="Legg til ferdigheter" />
                  )}
                />
              </Stack>
            )}

            {/* Process Button */}
            <Button
              variant="contained"
              startIcon={aiIsProcessing ? <CircularProgress size={20} /> : <AIIcon />}
              onClick={() => {
                if (aiToolType === 'paraphrase') handleAiParaphrase();
                else if (aiToolType === 'grammar') handleAiGrammar();
                else if (aiToolType === 'summarize') handleAiSummarize();
                else if (aiToolType === 'generate-resume') handleAiGenerateResume(aiJobTitle, aiSkills, aiExperience);
                else if (aiToolType === 'generate-cover-letter') handleAiGenerateCoverLetter(aiJobTitle, aiCompany, aiSkills);
              }}
              disabled={
                aiIsProcessing ||
                ((aiToolType === 'paraphrase' || aiToolType === 'grammar' || aiToolType === 'summarize') && !aiInputText.trim()) ||
                (aiToolType === 'generate-resume' && (!aiJobTitle.trim() || !aiExperience.trim())) ||
                (aiToolType === 'generate-cover-letter' && (!aiJobTitle.trim() || !aiCompany.trim()))
              }
              fullWidth
            >
              {aiIsProcessing ? 'Behandler...' : 'Generer med AI'}
            </Button>

            {/* Output Text */}
            {aiOutputText && (
              <>
                <Divider />
                <TextField
                  label="AI-resultat"
                  multiline
                  rows={6}
                  value={aiOutputText}
                  onChange={(e) => setAiOutputText(e.target.value)}
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <Tooltip title="Kopier til utklippstavle">
                        <IconButton onClick={() => {
                          navigator.clipboard.writeText(aiOutputText);
                          setSnackbar({ open: true, message: 'Kopiert til utklippstavle!', severity: 'success' });
                        }}>
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                    )}}
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiToolDialog(false)}>
            Avbryt
          </Button>
          {aiOutputText && (
            <Button
              onClick={handleApplyAiResult}
              variant="contained"
              startIcon={<CheckIcon />}
            >
              Bruk resultat
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Resume Dialog */}
      <Dialog open={!!confirmDeleteResumeId} onClose={() => setConfirmDeleteResumeId(null)}>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil slette denne CV-en? Denne handlingen kan ikke angres.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteResumeId(null)}>Avbryt</Button>
          <Button onClick={executeDeleteResume} color="error" variant="contained">Slett</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Accessibility & Compliance Footer */}
      <Box
        sx={{
          mt: 8,
          pt: 4,
          borderTop: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
        }}
        role="contentinfo"
        aria-label="Personvern og tilgjengelighet"
      >
        <Stack direction="row" spacing={3} justifyContent="center" sx={{ flexWrap: 'wrap' }}>
          <Button
            size="small"
            onClick={() => setShowPrivacyDialog(true)}
            aria-label="Åpne personvernerklæring"
          >
            Personvern
          </Button>
          <Button
            size="small"
            onClick={() => setShowTermsDialog(true)}
            aria-label="Åpne vilkår for bruk"
          >
            Vilkår
          </Button>
          <Button
            size="small"
            onClick={() => setShowDataManagement(true)}
            aria-label="Administrer dine data"
          >
            Dine Data (GDPR)
          </Button>
          <Button
            size="small"
            onClick={() => setShowGdprDialog(true)}
            aria-label="Last ned eller slett NextRole-data"
          >
            NextRole-data
          </Button>
          <Button
            size="small"
            onClick={() => setShowCookieConsent(true)}
            aria-label="Endre cookie-innstillinger"
          >
            Cookies
          </Button>
          <Button
            size="small"
            onClick={handleRunAccessibilityAudit}
            aria-label="Kjør tilgjengelighetskontroll"
          >
            Tilgjengelighet
          </Button>
        </Stack>

      </Box>

      {/* Help & Guidance */}
      <HelpGuideDialog open={showHelpDialog} onClose={() => setShowHelpDialog(false)} />
      <HelpButton onClick={() => setShowHelpDialog(true)} />
      </Box>
    </Container>
  );
}

