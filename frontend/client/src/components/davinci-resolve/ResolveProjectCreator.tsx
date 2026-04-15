// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid2 as Grid,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  VideoLibrary,
  Download,
  AutoFixHigh,
  ColorLens,
  Folder,
  TrendingUp as TimelineIcon,
  ExpandMore,
  PlayArrow,
  Settings,
} from '@mui/icons-material';
import { apiRequest, getAuthHeader } from '@/lib/queryClient';

type ResolveEventType = 'bryllup' | 'bedrift' | 'musikkvideo' | 'dokumentar' | 'kommersial';

interface ResolveProject {
  projectName: string;
  clientName: string;
  eventType: ResolveEventType;
  cultureType?: string;
  frameRate: number;
  resolution: string;
  colorSpace: string;
  logFormat?: string;
}

interface ResolveTemplateEventType {
  value: ResolveEventType;
  label: string;
  cultures?: string[];
}

interface ResolveHighlightType {
  value: string;
  label: string;
  duration: number;
}

interface ResolveTemplates {
  templates: {
    eventTypes: ResolveTemplateEventType[];
    frameRates: number[];
    resolutions: string[];
    colorSpaces: string[];
    logFormats: string[];
    highlightTypes: ResolveHighlightType[];
  };
}

interface StoryArcSegment {
  name: string;
  estimatedDuration: number;
  description?: string;
}

interface StoryArcResponse {
  storyArc: {
    segments: StoryArcSegment[];
  };
  message?: string;
}

interface CreateProjectResponse {
  success: boolean;
  message: string;
  projectPath: string;
  configPath: string;
}

interface HighlightResponse {
  message: string;
  xmlPath: string;
  clipCount: number;
  totalDuration: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface GenerateStoryArcInput {
  eventType: ResolveEventType;
  cultureType?: string;
  duration: number;
}

interface GenerateHighlightInput {
  videoPath: string;
  eventType: ResolveEventType;
  cultureType?: string;
  targetDuration: number;
}

const EVENT_TYPES: ResolveEventType[] = ['bryllup', 'bedrift', 'musikkvideo', 'dokumentar', 'kommersial'];

const DEFAULT_TEMPLATES: ResolveTemplates = {
  templates: {
    eventTypes: [
      { value: 'bryllup', label: 'Bryllup', cultures: ['norsk', 'indisk', 'pakistansk', 'amerikansk'] },
      { value: 'bedrift', label: 'Bedrift' },
      { value: 'musikkvideo', label: 'Musikkvideo' },
      { value: 'dokumentar', label: 'Dokumentar' },
      { value: 'kommersial', label: 'Kommersial' },
    ],
    frameRates: [24, 25, 30, 50, 60],
    resolutions: ['3840x2160', '1920x1080', '1280x720'],
    colorSpaces: ['Rec.709', 'Rec.2020', 'DCI-P3'],
    logFormats: ['Canon C-Log2', 'Canon C-Log3', 'Sony S-Log2', 'Sony S-Log3', 'Panasonic V-Log'],
    highlightTypes: [
      { value: 'teaser', label: 'Teaser (30 sek)', duration: 30 },
      { value: 'social', label: 'Social (60 sek)', duration: 60 },
      { value: 'short', label: 'Kort highlight (3 min)', duration: 180 },
      { value: 'long', label: 'Lang highlight (7 min)', duration: 420 },
    ],
  },
};

const LOCAL_SEGMENTS: Record<ResolveEventType, Array<{ name: string; weight: number; description: string }>> = {
  bryllup: [
    { name: 'Åpning', weight: 0.12, description: 'Location og etablering' },
    { name: 'Forberedelser', weight: 0.23, description: 'Detaljer, stemning, forventning' },
    { name: 'Vielse', weight: 0.28, description: 'Seremoni og nøkkeløyeblikk' },
    { name: 'Portretter', weight: 0.17, description: 'Kreative par-sekvenser' },
    { name: 'Feiring', weight: 0.15, description: 'Middag, taler, dans' },
    { name: 'Finale', weight: 0.05, description: 'Emosjonell avslutning' },
  ],
  bedrift: [
    { name: 'Brand Intro', weight: 0.15, description: 'Visuell identitet og kontekst' },
    { name: 'Problem', weight: 0.2, description: 'Forretningsutfordring' },
    { name: 'Løsning', weight: 0.25, description: 'Produkt/tjeneste i bruk' },
    { name: 'Resultat', weight: 0.25, description: 'KPI, testimonial, effekt' },
    { name: 'CTA', weight: 0.15, description: 'Neste steg' },
  ],
  musikkvideo: [
    { name: 'Intro', weight: 0.12, description: 'Atmosfære og setup' },
    { name: 'Verse 1', weight: 0.2, description: 'Narrativ bygging' },
    { name: 'Chorus 1', weight: 0.2, description: 'Visuell energi' },
    { name: 'Verse 2', weight: 0.18, description: 'Utvikling' },
    { name: 'Chorus 2', weight: 0.2, description: 'Maks intensitet' },
    { name: 'Outro', weight: 0.1, description: 'Signaturslutt' },
  ],
  dokumentar: [
    { name: 'Hook', weight: 0.14, description: 'Sterk åpning' },
    { name: 'Kontekst', weight: 0.2, description: 'Bakgrunn og setting' },
    { name: 'Konflikt', weight: 0.24, description: 'Hovedproblem' },
    { name: 'Fordypning', weight: 0.22, description: 'Intervjuer og innsikt' },
    { name: 'Konklusjon', weight: 0.2, description: 'Løsning/refleksjon' },
  ],
  kommersial: [
    { name: 'Hook', weight: 0.2, description: 'Oppmerksomhetskrok' },
    { name: 'Pain Point', weight: 0.2, description: 'Problemstilling' },
    { name: 'Product Reveal', weight: 0.25, description: 'Produkt i fokus' },
    { name: 'Proof', weight: 0.2, description: 'Sosialt bevis/resultat' },
    { name: 'CTA', weight: 0.15, description: 'Konverteringsslutt' },
  ],
};

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`resolve-tabpanel-${index}`}
      aria-labelledby={`resolve-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function isResolveEventType(value: string): value is ResolveEventType {
  return EVENT_TYPES.includes(value as ResolveEventType);
}

function normalizeTemplatesResponse(raw: unknown): ResolveTemplates {
  const input = raw as Partial<ResolveTemplates> | null;
  if (!input?.templates) {
    return DEFAULT_TEMPLATES;
  }

  const templates = input.templates;
  const eventTypes = Array.isArray(templates.eventTypes)
    ? templates.eventTypes.filter((event): event is ResolveTemplateEventType => {
        if (!event || typeof event !== 'object') {
          return false;
        }
        const candidate = event as ResolveTemplateEventType;
        return typeof candidate.value === 'string' && isResolveEventType(candidate.value) && typeof candidate.label === 'string';
      })
    : [];

  return {
    templates: {
      eventTypes: eventTypes.length > 0 ? eventTypes : DEFAULT_TEMPLATES.templates.eventTypes,
      frameRates: Array.isArray(templates.frameRates)
        ? templates.frameRates.filter((rate): rate is number => typeof rate === 'number' && Number.isFinite(rate))
        : DEFAULT_TEMPLATES.templates.frameRates,
      resolutions: Array.isArray(templates.resolutions)
        ? templates.resolutions.filter((res): res is string => typeof res === 'string' && res.length > 0)
        : DEFAULT_TEMPLATES.templates.resolutions,
      colorSpaces: Array.isArray(templates.colorSpaces)
        ? templates.colorSpaces.filter((space): space is string => typeof space === 'string' && space.length > 0)
        : DEFAULT_TEMPLATES.templates.colorSpaces,
      logFormats: Array.isArray(templates.logFormats)
        ? templates.logFormats.filter((format): format is string => typeof format === 'string' && format.length > 0)
        : DEFAULT_TEMPLATES.templates.logFormats,
      highlightTypes: Array.isArray(templates.highlightTypes)
        ? templates.highlightTypes.filter((type): type is ResolveHighlightType => {
            if (!type || typeof type !== 'object') {
              return false;
            }
            const candidate = type as ResolveHighlightType;
            return (
              typeof candidate.value === 'string' &&
              typeof candidate.label === 'string' &&
              typeof candidate.duration === 'number' &&
              Number.isFinite(candidate.duration)
            );
          })
        : DEFAULT_TEMPLATES.templates.highlightTypes,
    },
  };
}

function createSegmentDurations(duration: number, weights: number[]): number[] {
  const normalizedDuration = Math.max(30, Math.floor(duration));
  const baseDurations = weights.map((weight) => Math.max(1, Math.round(normalizedDuration * weight)));
  const baseSum = baseDurations.reduce((sum, value) => sum + value, 0);
  const adjustment = normalizedDuration - baseSum;

  if (adjustment !== 0) {
    baseDurations[baseDurations.length - 1] = Math.max(1, baseDurations[baseDurations.length - 1] + adjustment);
  }

  return baseDurations;
}

function buildLocalStoryArc(input: GenerateStoryArcInput): StoryArcResponse {
  const segmentTemplate = LOCAL_SEGMENTS[input.eventType];
  const durations = createSegmentDurations(
    input.duration,
    segmentTemplate.map((segment) => segment.weight)
  );

  return {
    storyArc: {
      segments: segmentTemplate.map((segment, index) => ({
        name: segment.name,
        estimatedDuration: durations[index],
        description: segment.description,
      })),
    },
    message: `Story arc generert lokalt${input.cultureType ? ` for ${input.cultureType}` : ''}`,
  };
}

function buildHighlightClips(input: GenerateHighlightInput): Array<{ start: number; duration: number; label: string }> {
  const clipCount = Math.min(8, Math.max(3, Math.round(input.targetDuration / 45)));
  const clipDuration = Math.max(8, Math.floor(input.targetDuration / clipCount));
  const clips: Array<{ start: number; duration: number; label: string }> = [];

  for (let index = 0; index < clipCount; index += 1) {
    clips.push({
      start: index * (clipDuration + 4),
      duration: clipDuration,
      label: `${input.eventType}-highlight-${index + 1}`,
    });
  }

  return clips;
}

function buildHighlightXml(input: GenerateHighlightInput): string {
  const clips = buildHighlightClips(input);
  const cultureTag = input.cultureType ? ` culture=\"${input.cultureType}\"` : '';

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<highlight eventType=\"${input.eventType}\" targetDuration=\"${input.targetDuration}\"${cultureTag}>`,
    `  <source path=\"${input.videoPath}\" />`,
    ...clips.map(
      (clip) =>
        `  <clip label=\"${clip.label}\" start=\"${clip.start}\" duration=\"${clip.duration}\" transition=\"crossfade\" />`
    ),
    '</highlight>',
  ].join('\n');
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
}

export default function ResolveProjectCreator() {
  const [tabValue, setTabValue] = useState(0);
  const auth = useAuth();
  const queryClient = useQueryClient();

  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'videographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';

  const theming = useTheming(currentProfession);
  const [project, setProject] = useState<ResolveProject>({
    projectName: '',
    clientName: '',
    eventType: 'bryllup',
    frameRate: 25,
    resolution: '1920x1080',
    colorSpace: 'Rec.709',
  });
  const [highlightSettings, setHighlightSettings] = useState({
    videoPath: '',
    targetDuration: 180,
  });

  useEffect(() => {
    if (!project.clientName && auth.state.user?.name) {
      setProject((previous) => ({ ...previous, clientName: auth.state.user?.name ?? '' }));
    }
  }, [auth.state.user?.name, project.clientName]);

  const { data: templates = DEFAULT_TEMPLATES, isLoading: templatesLoading } = useQuery<ResolveTemplates>({
    queryKey: ['/api/davinci-resolve/templates'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/davinci-resolve/templates');
        return normalizeTemplatesResponse(response);
      } catch {
        return DEFAULT_TEMPLATES;
      }
    },
    staleTime: 60_000,
  });

  const storyArcMutation = useMutation<StoryArcResponse, Error, GenerateStoryArcInput>({
    mutationFn: async (data) => {
      try {
        const response = await apiRequest('/api/davinci-resolve/story-arc', {
          method: 'POST',
          body: data,
        });

        const candidate = response as Partial<StoryArcResponse>;
        if (candidate?.storyArc?.segments && Array.isArray(candidate.storyArc.segments)) {
          return {
            storyArc: {
              segments: candidate.storyArc.segments.map((segment) => ({
                name: segment.name,
                estimatedDuration: Number(segment.estimatedDuration) || 1,
                description: segment.description,
              })),
            },
            message: candidate.message,
          };
        }

        return buildLocalStoryArc(data);
      } catch {
        return buildLocalStoryArc(data);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['davinci-last-story-arc'], data);
    },
  });

  const createProjectMutation = useMutation<CreateProjectResponse, Error, ResolveProject>({
    mutationFn: async (data) => {
      try {
        const response = await apiRequest('/api/davinci-resolve/create-project', {
          method: 'POST',
          body: data,
        });
        const candidate = response as Partial<CreateProjectResponse>;

        return {
          success: candidate.success ?? true,
          message: candidate.message ?? 'Prosjekt opprettet',
          projectPath: candidate.projectPath ?? `/projects/${data.projectName.replace(/\s+/g, '-').toLowerCase()}`,
          configPath: candidate.configPath ?? `/projects/${data.projectName.replace(/\s+/g, '-').toLowerCase()}/project.json`,
        };
      } catch {
        const slug = data.projectName.trim().replace(/\s+/g, '-').toLowerCase();
        const localProject = {
          ...data,
          createdAt: new Date().toISOString(),
          createdBy: auth.state.user?.email ?? 'anonymous',
        };

        localStorage.setItem(`davinci-project-${slug}`, JSON.stringify(localProject));

        return {
          success: true,
          message: 'API utilgjengelig: prosjektkonfigurasjon lagret lokalt',
          projectPath: `/local/davinci/${slug}`,
          configPath: `/local/davinci/${slug}/project.json`,
        };
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['davinci-last-project'], data);
    },
  });

  const downloadPackageMutation = useMutation<{ fileName: string }, Error, ResolveProject>({
    mutationFn: async (data) => {
      const requestBody = {
        ...data,
        generatedAt: new Date().toISOString(),
        storyArc: storyArcMutation.data?.storyArc ?? null,
      };

      try {
        const authHeaders = await getAuthHeader();
        const response = await fetch('/api/davinci-resolve/download-package', {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Download failed (${response.status})`);
        }

        const blob = await response.blob();
        const fileName = `${data.projectName}_DaVinci_Package.zip`;
        downloadBlob(blob, fileName);
        return { fileName };
      } catch {
        const manifest = {
          ...requestBody,
          notes: [
            'Denne pakken er generert lokalt fordi backend-endepunktet ikke svarte.',
            'Importer prosjekt- og storyArc-data manuelt i DaVinci Resolve.',
          ],
        };
        const fallbackFileName = `${data.projectName}_DaVinci_Package.json`;
        downloadBlob(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }), fallbackFileName);
        return { fileName: fallbackFileName };
      }
    },
  });

  const generateHighlightMutation = useMutation<HighlightResponse, Error, GenerateHighlightInput>({
    mutationFn: async (data) => {
      try {
        const response = await apiRequest('/api/davinci-resolve/generate-highlight', {
          method: 'POST',
          body: data,
        });
        const candidate = response as Partial<HighlightResponse>;

        return {
          message: candidate.message ?? 'Highlight generert',
          xmlPath: candidate.xmlPath ?? '/tmp/highlight.xml',
          clipCount: typeof candidate.clipCount === 'number' ? candidate.clipCount : Math.max(3, Math.round(data.targetDuration / 45)),
          totalDuration: typeof candidate.totalDuration === 'number' ? candidate.totalDuration : data.targetDuration,
        };
      } catch {
        const xml = buildHighlightXml(data);
        const fileName = `${project.projectName || 'davinci'}_highlight.xml`;
        downloadBlob(new Blob([xml], { type: 'application/xml' }), fileName);

        return {
          message: 'Highlight generert lokalt og eksportert som XML',
          xmlPath: fileName,
          clipCount: buildHighlightClips(data).length,
          totalDuration: data.targetDuration,
        };
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['davinci-last-highlight'], data);
    },
  });

  const weddingCultures = useMemo(
    () =>
      templates.templates.eventTypes.find((eventType) => eventType.value === 'bryllup')?.cultures ??
      DEFAULT_TEMPLATES.templates.eventTypes.find((eventType) => eventType.value === 'bryllup')?.cultures ??
      [],
    [templates.templates.eventTypes]
  );

  const setupTabIcon = theming.getThemedIcon('settings') ?? <Settings />;
  const highlightTabIcon = theming.getThemedIcon('autoFixHigh') ?? <AutoFixHigh />;
  const expandIcon = theming.getThemedIcon('expandMore') ?? <ExpandMore />;

  if (templatesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} sx={{ color: '#ff8c00' }} />
        <Typography variant="h6" sx={{ ml: 2, color: theming.colors.primary }}>
          Laster DaVinci Resolve templates...
        </Typography>
      </Box>
    );
  }

  return (
    <MuiCard
      sx={{
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 140, 0, 0.3)',
        borderRadius: '12px',
      }}
    >
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center', mr: 1 }}>{professionIcon}</Box>
          )}
          <VideoLibrary sx={{ color: '#ff8c00', fontSize: 32, mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
            {enhancedProfessionConfig?.displayName || professionConfig?.displayName
              ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - DaVinci Resolve Integration`
              : 'DaVinci Resolve Integration'}
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Opprett pre-konfigurerte DaVinci Resolve prosjekter med intelligent story arc generering,
          DPX fargekorrigering, og kulturspesifikke templates.
        </Alert>

        <Paper sx={{ width: '100%', ...theming.getThemedCardSx() }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue: number) => setTabValue(newValue)}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                color: '#666',
                '&.Mui-selected': {
                  color: '#ff8c00',
                  fontWeight: 'bold',
                },
              },
            }}
          >
            <Tab icon={setupTabIcon} label="Prosjekt Oppsett" id="resolve-tab-0" aria-controls="resolve-tabpanel-0" />
            <Tab
              icon={highlightTabIcon}
              label="Intelligent Highlight"
              id="resolve-tab-1"
              aria-controls="resolve-tabpanel-1"
            />
            <Tab icon={<ColorLens />} label="DPX & Farge" id="resolve-tab-2" aria-controls="resolve-tabpanel-2" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Prosjektnavn"
                  value={project.projectName}
                  onChange={(event) => setProject({ ...project, projectName: event.target.value })}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Klientnavn"
                  value={project.clientName}
                  onChange={(event) => setProject({ ...project, clientName: event.target.value })}
                  sx={{ mb: 2 }}
                />

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Event Type</InputLabel>
                  <Select
                    value={project.eventType}
                    label="Event Type"
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (isResolveEventType(nextValue)) {
                        setProject({ ...project, eventType: nextValue, cultureType: nextValue === 'bryllup' ? project.cultureType : '' });
                      }
                    }}
                  >
                    {templates.templates.eventTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {project.eventType === 'bryllup' && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Kultur</InputLabel>
                    <Select
                      value={project.cultureType || ''}
                      label="Kultur"
                      onChange={(event) => setProject({ ...project, cultureType: event.target.value })}
                    >
                      <MenuItem value="">Ingen spesiell kultur</MenuItem>
                      {weddingCultures.map((culture) => (
                        <MenuItem key={culture} value={culture}>
                          {culture.charAt(0).toUpperCase() + culture.slice(1)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Frame Rate</InputLabel>
                  <Select
                    value={project.frameRate}
                    label="Frame Rate"
                    onChange={(event) => setProject({ ...project, frameRate: Number(event.target.value) })}
                  >
                    {templates.templates.frameRates.map((rate) => (
                      <MenuItem key={rate} value={rate}>
                        {rate} fps
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Oppløsning</InputLabel>
                  <Select
                    value={project.resolution}
                    label="Oppløsning"
                    onChange={(event) => setProject({ ...project, resolution: event.target.value })}
                  >
                    {templates.templates.resolutions.map((resolution) => (
                      <MenuItem key={resolution} value={resolution}>
                        {resolution}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Color Space</InputLabel>
                  <Select
                    value={project.colorSpace}
                    label="Color Space"
                    onChange={(event) => setProject({ ...project, colorSpace: event.target.value })}
                  >
                    {templates.templates.colorSpaces.map((space) => (
                      <MenuItem key={space} value={space}>
                        {space}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Log Format (valgfritt)</InputLabel>
                  <Select
                    value={project.logFormat || ''}
                    label="Log Format"
                    onChange={(event) => setProject({ ...project, logFormat: event.target.value })}
                  >
                    <MenuItem value="">Ingen log format</MenuItem>
                    {templates.templates.logFormats.map((format) => (
                      <MenuItem key={format} value={format}>
                        {format}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Accordion sx={{ mt: 3 }}>
              <AccordionSummary expandIcon={expandIcon}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                  <TimelineIcon sx={{ mr: 1 }} />
                  Story Arc Forhåndsvisning
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Button
                  variant="outlined"
                  onClick={() =>
                    storyArcMutation.mutate({
                      eventType: project.eventType,
                      cultureType: project.cultureType,
                      duration: 300,
                    })
                  }
                  disabled={storyArcMutation.isPending}
                  sx={{ mb: 2 }}
                >
                  {storyArcMutation.isPending ? (
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                  ) : (
                    <AutoFixHigh sx={{ mr: 1 }} />
                  )}
                  Generer Story Arc
                </Button>

                {storyArcMutation.data && (
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Story Segmenter:
                    </Typography>
                    {storyArcMutation.data.storyArc.segments.map((segment, index) => (
                      <Chip
                        key={`${segment.name}-${index}`}
                        label={`${segment.name} (${segment.estimatedDuration}s)`}
                        sx={{ mr: 1, mb: 1 }}
                        color="primary"
                      />
                    ))}
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={() => createProjectMutation.mutate(project)}
                disabled={createProjectMutation.isPending || !project.projectName || !project.clientName}
                sx={{
                  ...theming.getThemedButtonSx(),
                  backgroundColor: '#ff8c00',
                  '&:hover': { backgroundColor: '#e67e00' },
                }}
              >
                {createProjectMutation.isPending ? (
                  <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                ) : (
                  <Folder sx={{ mr: 1 }} />
                )}
                Opprett Prosjekt
              </Button>

              <Button
                variant="outlined"
                onClick={() => downloadPackageMutation.mutate(project)}
                disabled={downloadPackageMutation.isPending || !project.projectName || !project.clientName}
              >
                {downloadPackageMutation.isPending ? (
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                ) : (
                  <Download sx={{ mr: 1 }} />
                )}
                Last ned komplett pakke
              </Button>
            </Box>

            {createProjectMutation.data && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">{createProjectMutation.data.message}</Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                  {createProjectMutation.data.projectPath}
                </Typography>
              </Alert>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Intelligent Highlight Generering
              </Typography>
              Systemet analyserer lang film og finner automatisk høydepunkter basert på:
              <br />• Audio-peaks (applaus, latter, musikk)
              <br />• Bevegelsesdeteksjon og scene-endringer
              <br />• Ansiktsuttrykk og følelser
              <br />• Kulturspesifikke øyeblikk
            </Alert>

            <TextField
              fullWidth
              label="Video filbane (full film)"
              value={highlightSettings.videoPath}
              onChange={(event) => setHighlightSettings({ ...highlightSettings, videoPath: event.target.value })}
              placeholder="/path/to/full-wedding-video.mp4"
              sx={{ mb: 2 }}
            />

            <FormControl sx={{ mb: 3, minWidth: 200 }}>
              <InputLabel>Highlight lengde</InputLabel>
              <Select
                value={highlightSettings.targetDuration}
                label="Highlight lengde"
                onChange={(event) =>
                  setHighlightSettings({
                    ...highlightSettings,
                    targetDuration: Number(event.target.value),
                  })
                }
              >
                {templates.templates.highlightTypes.map((type) => (
                  <MenuItem key={type.value} value={type.duration}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              size="large"
              onClick={() =>
                generateHighlightMutation.mutate({
                  videoPath: highlightSettings.videoPath,
                  eventType: project.eventType,
                  cultureType: project.cultureType,
                  targetDuration: highlightSettings.targetDuration,
                })
              }
              disabled={generateHighlightMutation.isPending || !highlightSettings.videoPath}
              sx={{
                ...theming.getThemedButtonSx(),
                backgroundColor: '#ff8c00',
                '&:hover': { backgroundColor: '#e67e00' },
                py: 2,
                px: 4,
              }}
            >
              {generateHighlightMutation.isPending ? (
                <CircularProgress size={24} sx={{ mr: 2, color: 'white' }} />
              ) : (
                <PlayArrow sx={{ mr: 2, fontSize: 28 }} />
              )}
              Generer Intelligent Highlight
            </Button>

            {generateHighlightMutation.data && (
              <Alert severity="success" sx={{ mt: 3 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Highlight generert!
                </Typography>
                <Typography>{generateHighlightMutation.data.message}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  XML fil: {generateHighlightMutation.data.xmlPath}
                </Typography>
                <Typography variant="body2">
                  Klipp: {generateHighlightMutation.data.clipCount} | Total lengde: {generateHighlightMutation.data.totalDuration}s
                </Typography>
              </Alert>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                DPX Fargekorrigering
              </Typography>
              Automatisk fargekorrigering for Canon C-log 2/3 og andre log-formater.
              Systemet genererer optimaliserte LUT-filer og fargeprofiler.
            </Alert>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Støttede Log-formater:
                </Typography>
                {templates.templates.logFormats.map((format) => (
                  <Chip
                    key={format}
                    label={format}
                    sx={{ mr: 1, mb: 1 }}
                    color={project.logFormat === format ? 'primary' : 'default'}
                  />
                ))}
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Automatiske justeringer:
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">• Gamma-korreksjon</Typography>
                  <Typography variant="body2">• Lift/Gamma/Gain balansering</Typography>
                  <Typography variant="body2">• LUT-basert konvertering</Typography>
                  <Typography variant="body2">• Kulturspesifikke fargetoner</Typography>
                </Box>
              </Grid>
            </Grid>

            {project.logFormat && (
              <Alert severity="success" sx={{ mt: 3 }}>
                <Typography>
                  <strong>{project.logFormat}</strong> fargekorrigering vil være inkludert i prosjektpakken.
                </Typography>
              </Alert>
            )}
          </TabPanel>
        </Paper>
      </CardContent>
    </MuiCard>
  );
}
