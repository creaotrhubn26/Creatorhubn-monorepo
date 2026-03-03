import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Fade,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  Analytics,
  Assignment,
  AttachMoney,
  AutoAwesome,
  FlashOn,
  Folder,
  Gavel,
  Group,
  Keyboard,
  Movie,
  PhotoCamera,
  PlayArrow,
  Settings,
  Speed,
  Star,
  VideoCall,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';

const QuoteGeneratorModal = lazy(() => import('../modals/QuoteGeneratorModal'));
const PricingManagement = lazy(() => import('../pricing/PricingManagement'));
const CentralizedSalesHub = lazy(() => import('../sales/CentralizedSalesHub'));
const UniversalContractHub = lazy(() => import('./contracts/UniversalContractHub'));
const ProjectCreationWithMemoryCards = lazy(() => import('../project/ProjectCreationWithMemoryCards'));
const UniversalWorklog = lazy(() => import('../worklog/UniversalWorklog'));
const UniversalCRMDashboard = lazy(() => import('../crm/UniversalCRMDashboard'));
const SmartMeetingNotesEditor = lazy(() => import('../meeting-system/SmartMeetingNotesEditor'));
const SplitSheetManager = lazy(() => import('./split-sheets/SplitSheetManager'));
const PhotoEnhancementSuite = lazy(() => import('../enhancement/PhotoEnhancementSuite'));
const StoryArcStudio = lazy(() => import('../StoryArcStudio'));
const UniversalShowcase = lazy(() => import('./UniversalShowcase'));
const ProjectFileManager = lazy(() => import('../project-file-manager'));

type WorkflowProfession = 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
type ShowcaseProfession = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
type ShortcutAction =
  | 'createProject'
  | 'generateQuote'
  | 'createContract'
  | 'scheduleMeeting'
  | 'openSalesHub'
  | 'openWorklog'
  | 'openCRM'
  | 'openPricing'
  | 'openStoryArcStudio'
  | 'openPhotoEnhancement'
  | 'openShowcase'
  | 'openFileManager'
  | 'openSplitSheetManager'
  | 'createSplitSheet';

interface ShortcutDefinition {
  name: string;
  action: ShortcutAction;
  category: string;
}

interface SmartWorkflowSystemProps {
  profession?: WorkflowProfession;
  tabIndex?: number;
}

const workflowShortcuts: Record<WorkflowProfession, Record<string, ShortcutDefinition>> = {
  photographer: {
    'Ctrl+Shift+P': { name: 'Nytt Prosjekt', action: 'createProject', category: 'Prosjekt' },
    'Ctrl+Shift+Q': { name: 'Generer Tilbud', action: 'generateQuote', category: 'Salg' },
    'Ctrl+Shift+K': { name: 'Ny Kontrakt', action: 'createContract', category: 'Kontrakt' },
    'Ctrl+Shift+M': { name: 'Planlegg Møte', action: 'scheduleMeeting', category: 'Møte' },
    'Ctrl+Shift+S': { name: 'Åpne Sales Hub', action: 'openSalesHub', category: 'Salg' },
    'Ctrl+Shift+W': { name: 'Åpne Worklog', action: 'openWorklog', category: 'Prosjekt' },
    'Ctrl+Shift+R': { name: 'Åpne CRM', action: 'openCRM', category: 'CRM' },
    'Ctrl+Shift+A': { name: 'Prisadministrasjon', action: 'openPricing', category: 'Salg' },
    'Ctrl+Shift+H': { name: 'Photo Enhancement', action: 'openPhotoEnhancement', category: 'Post' },
    'Ctrl+Shift+U': { name: 'Universal Showcase', action: 'openShowcase', category: 'Post' },
    'Ctrl+Shift+F': { name: 'Project File Manager', action: 'openFileManager', category: 'Post' },
  },
  videographer: {
    'Ctrl+Shift+P': { name: 'Nytt Video Prosjekt', action: 'createProject', category: 'Prosjekt' },
    'Ctrl+Shift+Q': { name: 'Generer Tilbud', action: 'generateQuote', category: 'Salg' },
    'Ctrl+Shift+K': { name: 'Ny Kontrakt', action: 'createContract', category: 'Kontrakt' },
    'Ctrl+Shift+M': { name: 'Planlegg Møte', action: 'scheduleMeeting', category: 'Møte' },
    'Ctrl+Shift+S': { name: 'Åpne Sales Hub', action: 'openSalesHub', category: 'Salg' },
    'Ctrl+Shift+W': { name: 'Åpne Worklog', action: 'openWorklog', category: 'Prosjekt' },
    'Ctrl+Shift+R': { name: 'Åpne CRM', action: 'openCRM', category: 'CRM' },
    'Ctrl+Shift+A': { name: 'Prisadministrasjon', action: 'openPricing', category: 'Salg' },
    'Ctrl+Shift+V': { name: 'Story Arc Studio', action: 'openStoryArcStudio', category: 'Post' },
    'Ctrl+Shift+U': { name: 'Universal Showcase', action: 'openShowcase', category: 'Post' },
    'Ctrl+Shift+F': { name: 'Project File Manager', action: 'openFileManager', category: 'Post' },
  },
  musicproducer: {
    'Ctrl+Shift+P': { name: 'Nytt Musikkprosjekt', action: 'createProject', category: 'Prosjekt' },
    'Ctrl+Shift+Q': { name: 'Generer Tilbud', action: 'generateQuote', category: 'Salg' },
    'Ctrl+Shift+K': { name: 'Ny Kontrakt', action: 'createContract', category: 'Kontrakt' },
    'Ctrl+Shift+M': { name: 'Planlegg Møte', action: 'scheduleMeeting', category: 'Møte' },
    'Ctrl+Shift+S': { name: 'Åpne Sales Hub', action: 'openSalesHub', category: 'Salg' },
    'Ctrl+Shift+W': { name: 'Åpne Worklog', action: 'openWorklog', category: 'Prosjekt' },
    'Ctrl+Shift+R': { name: 'Åpne CRM', action: 'openCRM', category: 'CRM' },
    'Ctrl+Shift+A': { name: 'Prisadministrasjon', action: 'openPricing', category: 'Salg' },
    'Ctrl+Shift+X': { name: 'Split Sheet Manager', action: 'openSplitSheetManager', category: 'Musikk' },
    'Ctrl+Shift+N': { name: 'Ny Split Sheet', action: 'createSplitSheet', category: 'Musikk' },
  },
  vendor: {
    'Ctrl+Shift+P': { name: 'Nytt Leverandørprosjekt', action: 'createProject', category: 'Prosjekt' },
    'Ctrl+Shift+Q': { name: 'Generer Tilbud', action: 'generateQuote', category: 'Salg' },
    'Ctrl+Shift+K': { name: 'Ny Kontrakt', action: 'createContract', category: 'Kontrakt' },
    'Ctrl+Shift+M': { name: 'Planlegg Møte', action: 'scheduleMeeting', category: 'Møte' },
    'Ctrl+Shift+S': { name: 'Åpne Sales Hub', action: 'openSalesHub', category: 'Salg' },
    'Ctrl+Shift+W': { name: 'Åpne Worklog', action: 'openWorklog', category: 'Prosjekt' },
    'Ctrl+Shift+R': { name: 'Åpne CRM', action: 'openCRM', category: 'CRM' },
    'Ctrl+Shift+A': { name: 'Prisadministrasjon', action: 'openPricing', category: 'Salg' },
  },
};

function normalizeProfession(profession: WorkflowProfession): ShowcaseProfession {
  if (profession === 'musicproducer') {
    return 'music_producer';
  }
  return profession;
}

export default function SmartWorkflowSystem({
  profession = 'photographer',
}: SmartWorkflowSystemProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const theming = useTheming(profession);
  const { professionConfigs } = useProfessionConfigs();
  const { getProfessionDisplayName, getUserProfessionColor, getProfessionIcon } = useDynamicProfessions();

  const userProfession = (user?.profession as WorkflowProfession | undefined) ?? profession;
  const effectiveProfession: WorkflowProfession =
    userProfession in workflowShortcuts ? userProfession : profession;
  const normalizedProfession = normalizeProfession(effectiveProfession);

  const [activeShortcuts, setActiveShortcuts] = useState<string[]>([]);
  const [recentAction, setRecentAction] = useState<string>('');
  const [isActive, setIsActive] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [showQuoteGenerator, setShowQuoteGenerator] = useState(false);
  const [showPricingManagement, setShowPricingManagement] = useState(false);
  const [showSalesHub, setShowSalesHub] = useState(false);
  const [showContractHub, setShowContractHub] = useState(false);
  const [showProjectCreation, setShowProjectCreation] = useState(false);
  const [showWorklog, setShowWorklog] = useState(false);
  const [showCRMDashboard, setShowCRMDashboard] = useState(false);
  const [showMeetingNotes, setShowMeetingNotes] = useState(false);
  const [showSplitSheetManager, setShowSplitSheetManager] = useState(false);
  const [showPhotoEnhancement, setShowPhotoEnhancement] = useState(false);
  const [showStoryArcStudio, setShowStoryArcStudio] = useState(false);
  const [showUniversalShowcase, setShowUniversalShowcase] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);

  const safeUserId = user?.id ? String(user.id) : 'local-user';
  const defaultProjectId = 'workflow-default-project';
  const defaultMeetingId = 'workflow-default-meeting';

  const fallbackConfig = professionConfigs[effectiveProfession] ?? professionConfigs.photographer;
  const effectiveColor = getUserProfessionColor(effectiveProfession) || fallbackConfig?.color || '#ff8c00';
  const effectiveName =
    getProfessionDisplayName(effectiveProfession) || fallbackConfig?.displayName || 'Smart Workflow';
  const professionIconElement = getProfessionIcon(effectiveProfession) ?? <AutoAwesome />;
  const shortcuts = workflowShortcuts[effectiveProfession];

  const executeWorkflow = useMutation({
    mutationFn: async (action: ShortcutAction) => {
      switch (action) {
        case 'generateQuote':
          setShowQuoteGenerator(true);
          setRecentAction('Åpnet Tilbudsgenerator');
          return { local: true };
        case 'openPricing':
          setShowPricingManagement(true);
          setRecentAction('Åpnet Prisadministrasjon');
          return { local: true };
        case 'openSalesHub':
          setShowSalesHub(true);
          setRecentAction('Åpnet Sales Hub');
          return { local: true };
        case 'createContract':
          setShowContractHub(true);
          setRecentAction('Åpnet Kontrakt-hub');
          return { local: true };
        case 'createProject':
          setShowProjectCreation(true);
          setRecentAction('Åpnet Prosjektopprettelse');
          return { local: true };
        case 'openWorklog':
          setShowWorklog(true);
          setRecentAction('Åpnet Worklog');
          return { local: true };
        case 'openCRM':
          setShowCRMDashboard(true);
          setRecentAction('Åpnet CRM Dashboard');
          return { local: true };
        case 'scheduleMeeting':
          setShowMeetingNotes(true);
          setRecentAction('Åpnet Meeting Notes');
          return { local: true };
        case 'openSplitSheetManager':
          setShowSplitSheetManager(true);
          setRecentAction('Åpnet Split Sheet Manager');
          return { local: true };
        case 'createSplitSheet':
          window.dispatchEvent(
            new CustomEvent('workflow:create-split-sheet', {
              detail: { profession: effectiveProfession, timestamp: Date.now() },
            }),
          );
          setRecentAction('Opprettet ny Split Sheet-hendelse');
          return { local: true };
        case 'openPhotoEnhancement':
          setShowPhotoEnhancement(true);
          setRecentAction('Åpnet Photo Enhancement');
          return { local: true };
        case 'openStoryArcStudio':
          setShowStoryArcStudio(true);
          setRecentAction('Åpnet Story Arc Studio');
          return { local: true };
        case 'openShowcase':
          setShowUniversalShowcase(true);
          setRecentAction('Åpnet Universal Showcase');
          return { local: true };
        case 'openFileManager':
          setShowFileManager(true);
          setRecentAction('Åpnet Project File Manager');
          return { local: true };
        default:
          return apiRequest('/api/workflow/execute', {
            method: 'POST',
            body: JSON.stringify({
              action,
              profession: effectiveProfession,
              timestamp: Date.now(),
            }),
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow'] });
      setIsActive(true);
      window.setTimeout(() => setIsActive(false), 1000);
    },
  });

  const categorizedShortcuts = useMemo(() => {
    const grouped: Record<string, Array<ShortcutDefinition & { key: string }>> = {};
    Object.entries(shortcuts).forEach(([key, shortcut]) => {
      if (!grouped[shortcut.category]) {
        grouped[shortcut.category] = [];
      }
      grouped[shortcut.category].push({ ...shortcut, key });
    });
    return grouped;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const keyParts: string[] = [];
      if (event.ctrlKey) keyParts.push('Ctrl');
      if (event.shiftKey) keyParts.push('Shift');
      if (event.altKey) keyParts.push('Alt');
      keyParts.push(event.key.toUpperCase());
      const combo = keyParts.join('+');

      const shortcut = shortcuts[combo];
      if (!shortcut) return;

      event.preventDefault();
      setActiveShortcuts((prev) => [...prev, combo]);
      executeWorkflow.mutate(shortcut.action);

      window.setTimeout(() => {
        setActiveShortcuts((prev) => prev.filter((item) => item !== combo));
      }, 1200);
    },
    [executeWorkflow, shortcuts],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ color: effectiveColor, display: 'inline-flex' }}>{professionIconElement}</Box>
        <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
          Smart Arbeidsflyt - {effectiveName}
        </Typography>
        <Fade in={isActive}>
          <Chip icon={<FlashOn />} label="AKTIV" color="success" sx={{ ml: 2, fontWeight: 'bold' }} />
        </Fade>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Speed sx={{ color: effectiveColor, fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {Object.keys(shortcuts).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Snarveier
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AutoAwesome sx={{ color: effectiveColor, fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {activeShortcuts.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Aktive
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PlayArrow sx={{ color: effectiveColor, fontSize: 32 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {recentAction || 'Venter på kommando...'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Siste handling
                  </Typography>
                </Box>
                <IconButton onClick={() => setShowShortcuts(true)}>
                  <Keyboard />
                </IconButton>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
        Hurtigtaster
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(categorizedShortcuts).map(([category, categoryShortcuts]) => (
          <Grid item xs={12} md={6} lg={4} key={category}>
            <Card
              sx={{
                ...theming.getThemedCardSx(),
                border: `1px solid ${effectiveColor}33`,
              }}
            >
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 2 }}>
                  {category}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {categoryShortcuts.slice(0, 4).map((shortcut) => (
                    <Box
                      key={shortcut.key}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        borderRadius: 1,
                        bgcolor: activeShortcuts.includes(shortcut.key) ? `${effectiveColor}22` : 'transparent',
                      }}
                    >
                      <Typography variant="body2">{shortcut.name}</Typography>
                      <Chip label={shortcut.key} size="small" variant="outlined" />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={showShortcuts} onClose={() => setShowShortcuts(false)} maxWidth="md" fullWidth>
        <DialogTitle>Alle Hurtigtaster</DialogTitle>
        <DialogContent>
          {Object.entries(categorizedShortcuts).map(([category, categoryShortcuts]) => (
            <Box key={category} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ color: theming.colors.primary, mb: 1 }}>
                {category}
              </Typography>
              <List dense>
                {categoryShortcuts.map((shortcut) => (
                  <ListItem key={shortcut.key}>
                    <ListItemIcon>
                      <Chip label={shortcut.key} size="small" variant="outlined" />
                    </ListItemIcon>
                    <ListItemText primary={shortcut.name} />
                  </ListItem>
                ))}
              </List>
              <Divider />
            </Box>
          ))}
        </DialogContent>
      </Dialog>

      <Card sx={{ mt: 3, ...theming.getThemedCardSx(), border: `1px solid ${effectiveColor}33` }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Analytics sx={{ color: effectiveColor }} />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Integrasjonstatus
            </Typography>
          </Box>
          <Alert severity="success" sx={{ mb: 2 }}>
            Smart workflow-moduler er koblet: Sales, Pricing, Contract, Project, Meeting, CRM og Post.
          </Alert>
          <Grid container spacing={1}>
            {[
              ['Sales', true],
              ['Pricing', true],
              ['Contract', true],
              ['Project', true],
              ['Meeting', true],
              ['CRM', true],
              ['Post', true],
            ].map(([label, status]) => (
              <Grid item xs={6} md={3} key={label}>
                <Chip
                  label={label}
                  color={status ? 'success' : 'error'}
                  variant="outlined"
                  sx={{ width: '100%' }}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Suspense fallback={<Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>}>
        <QuoteGeneratorModal
          open={showQuoteGenerator}
          onClose={() => setShowQuoteGenerator(false)}
          packages={[]}
          pricing={[]}
          additionalCosts={[]}
          discounts={[]}
        />

        <Dialog open={showPricingManagement} onClose={() => setShowPricingManagement(false)} maxWidth="lg" fullWidth>
          <DialogTitle><AttachMoney sx={{ mr: 1 }} />Prisadministrasjon</DialogTitle>
          <DialogContent>
            <PricingManagement userId={safeUserId} profession={normalizedProfession} />
          </DialogContent>
        </Dialog>

        <Dialog open={showSalesHub} onClose={() => setShowSalesHub(false)} maxWidth="lg" fullWidth>
          <DialogTitle><Analytics sx={{ mr: 1 }} />Sales Hub</DialogTitle>
          <DialogContent>
            <CentralizedSalesHub profession={normalizedProfession} userId={safeUserId} />
          </DialogContent>
        </Dialog>

        <Dialog open={showContractHub} onClose={() => setShowContractHub(false)} maxWidth="lg" fullWidth>
          <DialogTitle><Gavel sx={{ mr: 1 }} />Contract Hub</DialogTitle>
          <DialogContent>
            <UniversalContractHub profession={normalizedProfession} userId={safeUserId} />
          </DialogContent>
        </Dialog>

        <Dialog open={showProjectCreation} onClose={() => setShowProjectCreation(false)} maxWidth="lg" fullWidth>
          <DialogTitle><Assignment sx={{ mr: 1 }} />Prosjektopprettelse</DialogTitle>
          <DialogContent>
            <ProjectCreationWithMemoryCards profession={normalizedProfession} userId={safeUserId} />
          </DialogContent>
        </Dialog>

        <Dialog open={showWorklog} onClose={() => setShowWorklog(false)} maxWidth="lg" fullWidth>
          <DialogTitle><Settings sx={{ mr: 1 }} />Worklog</DialogTitle>
          <DialogContent>
            <UniversalWorklog
              profession={effectiveProfession}
              projectId={defaultProjectId}
              userId={safeUserId}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={showCRMDashboard} onClose={() => setShowCRMDashboard(false)} maxWidth="lg" fullWidth>
          <DialogTitle><Group sx={{ mr: 1 }} />CRM Dashboard</DialogTitle>
          <DialogContent>
            <UniversalCRMDashboard profession={normalizedProfession} />
          </DialogContent>
        </Dialog>

        <Dialog open={showMeetingNotes} onClose={() => setShowMeetingNotes(false)} maxWidth="lg" fullWidth>
          <DialogTitle><VideoCall sx={{ mr: 1 }} />Meeting Notes</DialogTitle>
          <DialogContent>
            <SmartMeetingNotesEditor meetingId={defaultMeetingId} profession={normalizedProfession} />
          </DialogContent>
        </Dialog>

        <Dialog open={showSplitSheetManager} onClose={() => setShowSplitSheetManager(false)} maxWidth="lg" fullWidth>
          <DialogTitle><Star sx={{ mr: 1 }} />Split Sheet Manager</DialogTitle>
          <DialogContent>
            <SplitSheetManager profession={normalizedProfession} userId={safeUserId} />
          </DialogContent>
        </Dialog>

        <Dialog open={showPhotoEnhancement} onClose={() => setShowPhotoEnhancement(false)} maxWidth="lg" fullWidth>
          <DialogTitle><PhotoCamera sx={{ mr: 1 }} />Photo Enhancement</DialogTitle>
          <DialogContent>
            <PhotoEnhancementSuite userId={safeUserId} profession={normalizedProfession} />
          </DialogContent>
        </Dialog>

        <Dialog open={showStoryArcStudio} onClose={() => setShowStoryArcStudio(false)} maxWidth="xl" fullWidth>
          <DialogTitle><Movie sx={{ mr: 1 }} />Story Arc Studio</DialogTitle>
          <DialogContent>
            <StoryArcStudio onClose={() => setShowStoryArcStudio(false)} />
          </DialogContent>
        </Dialog>

        <Dialog open={showUniversalShowcase} onClose={() => setShowUniversalShowcase(false)} maxWidth="xl" fullWidth>
          <DialogTitle><AutoAwesome sx={{ mr: 1 }} />Universal Showcase</DialogTitle>
          <DialogContent>
            <UniversalShowcase profession={normalizedProfession} userId={safeUserId} />
          </DialogContent>
        </Dialog>

        <Dialog open={showFileManager} onClose={() => setShowFileManager(false)} maxWidth="lg" fullWidth>
          <DialogTitle><Folder sx={{ mr: 1 }} />Project File Manager</DialogTitle>
          <DialogContent>
            <ProjectFileManager
              projectId={defaultProjectId}
              profession={effectiveProfession}
              userId={safeUserId}
            />
          </DialogContent>
        </Dialog>
      </Suspense>
    </Box>
  );
}
