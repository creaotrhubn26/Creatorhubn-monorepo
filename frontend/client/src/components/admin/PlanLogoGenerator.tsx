import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  Delete,
  Download,
  Image,
  MusicNote,
  Refresh,
  Visibility,
  Work,
  Videocam,
  DesignServices,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { AdminCard, AdminButton } from './design-system';

interface GeneratedLogo {
  id: string;
  planId: string;
  url: string;
  prompt: string;
  style: string;
  colorScheme: string;
  generatedAt: string;
}

interface PlanLogoGeneratorProps {
  profession: string;
  onLogoGenerated?: (logo: GeneratedLogo) => void;
}

type PlanId = 'basic' | 'professional' | 'business';

type LogoStyle = 'minimal' | 'modern' | 'professional' | 'creative';

interface ColorScheme {
  name: string;
  value: string;
  description: string;
}

const PLAN_LABELS: Record<PlanId, string> = {
  basic: 'Basic Creator',
  professional: 'Professional Creator',
  business: 'Business Creator',
};

const COLOR_SCHEMES: ColorScheme[] = [
  { name: 'Grønn (Basic)', value: '#4CAF50', description: 'Vekst og komme i gang' },
  { name: 'Blå (Professional)', value: '#2196F0', description: 'Tillit og profesjonalitet' },
  { name: 'Lilla (Business)', value: '#9C27B0', description: 'Premium og innovasjon' },
  { name: 'Oransje (Creative)', value: '#FF6B30', description: 'Energi og kreativitet' },
  { name: 'Mørk blå (Expert)', value: '#004E80', description: 'Ekspertise og dybde' },
];

const STYLES: Array<{ value: LogoStyle; label: string; description: string }> = [
  { value: 'minimal', label: 'Minimalistisk', description: 'Rene linjer og enkle former' },
  { value: 'modern', label: 'Moderne', description: 'Bold typografi og geometriske elementer' },
  {
    value: 'professional',
    label: 'Profesjonell',
    description: 'Korporat stil med sofistikert fargepalett',
  },
  { value: 'creative', label: 'Kreativ', description: 'Kunstnerisk og innovativt design' },
];

function professionColor(profession: string): string {
  switch (profession) {
    case 'photographer':
      return '#FF6B30';
    case 'videographer':
      return '#004E80';
    case 'music_producer':
      return '#7209B0';
    case 'designer':
      return '#2E7D30';
    default:
      return '#1976d2';
  }
}

function professionIcon(profession: string): JSX.Element {
  switch (profession) {
    case 'photographer':
      return <Work />;
    case 'videographer':
      return <Videocam />;
    case 'music_producer':
      return <MusicNote />;
    case 'designer':
      return <DesignServices />;
    default:
      return <Image />;
  }
}

function normalizeGeneratedLogo(raw: unknown): GeneratedLogo | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const idRaw = record.id;
  const id = typeof idRaw === 'string' || typeof idRaw === 'number' ? String(idRaw) : '';

  if (!id) {
    return null;
  }

  return {
    id,
    planId: typeof record.planId === 'string' ? record.planId : 'unknown',
    url: typeof record.url === 'string' ? record.url : '',
    prompt: typeof record.prompt === 'string' ? record.prompt : '',
    style: typeof record.style === 'string' ? record.style : '',
    colorScheme: typeof record.colorScheme === 'string' ? record.colorScheme : '#2196F0',
    generatedAt: typeof record.generatedAt === 'string' ? record.generatedAt : new Date().toISOString(),
  };
}

function normalizeGeneratedLogos(raw: unknown): GeneratedLogo[] {
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as Record<string, unknown>).logos)
      ? ((raw as Record<string, unknown>).logos as unknown[])
      : [];

  return items
    .map((item) => normalizeGeneratedLogo(item))
    .filter((item): item is GeneratedLogo => item !== null);
}

export default function PlanLogoGenerator({ profession, onLogoGenerated }: PlanLogoGeneratorProps) {
  const { auth } = useEnhancedMasterIntegration();

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('basic');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedColorScheme, setSelectedColorScheme] = useState('#2196F0');
  const [selectedStyle, setSelectedStyle] = useState<LogoStyle>('professional');
  const [previewLogo, setPreviewLogo] = useState<GeneratedLogo | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [generatedLogos, setGeneratedLogos] = useState<GeneratedLogo[]>([]);

  const generateLogoMutation = useMutation({
    mutationFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/plan-logos/generate', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: {
          planId: selectedPlan,
          planName: PLAN_LABELS[selectedPlan],
          profession,
          description:
            customPrompt.trim() || `Professional ${profession} tools and features for ${PLAN_LABELS[selectedPlan]}`,
          colorScheme: selectedColorScheme,
          style: selectedStyle,
        },
      });
    },
    onSuccess: (data: unknown) => {
      const normalized =
        typeof data === 'object' && data !== null && 'logo' in (data as Record<string, unknown>)
          ? normalizeGeneratedLogo((data as Record<string, unknown>).logo)
          : normalizeGeneratedLogo(data);

      if (!normalized) {
        return;
      }

      setGeneratedLogos((previous) => [normalized, ...previous.filter((logo) => logo.id !== normalized.id)]);
      onLogoGenerated?.(normalized);
    },
  });

  const generateAllLogosMutation = useMutation({
    mutationFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/plan-logos/generate-all/${profession}`, {
        method: 'POST',
        headers,
      });
    },
    onSuccess: (data: unknown) => {
      const normalized = normalizeGeneratedLogos(data);
      if (normalized.length > 0) {
        setGeneratedLogos((previous) => {
          const existingById = new Map(previous.map((logo) => [logo.id, logo]));
          normalized.forEach((logo) => existingById.set(logo.id, logo));
          return Array.from(existingById.values()).sort(
            (left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime(),
          );
        });
      }
    },
  });

  const deleteLogoMutation = useMutation({
    mutationFn: async (logoId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/plan-logos/${logoId}`, {
        method: 'DELETE',
        headers,
      });
    },
    onSuccess: (_, logoId) => {
      setGeneratedLogos((previous) => previous.filter((logo) => logo.id !== logoId));
      if (previewLogo?.id === logoId) {
        setPreviewLogo(null);
        setShowPreview(false);
      }
    },
  });

  const isGenerating = generateLogoMutation.isPending || generateAllLogosMutation.isPending;

  const selectedColor = useMemo(
    () => COLOR_SCHEMES.find((item) => item.value === selectedColorScheme),
    [selectedColorScheme],
  );

  const downloadLogo = (logo: GeneratedLogo) => {
    if (!logo.url) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = logo.url;
    anchor.download = `${logo.planId}_logo_${Date.now()}.png`;
    anchor.rel = 'noopener';
    anchor.click();
  };

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Avatar sx={{ bgcolor: professionColor(profession) }}>{professionIcon(profession)}</Avatar>
            <Box>
              <Typography variant="h5" component="h2" fontWeight={700}>
                Plan Logo Generator
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Generer profesjonelle logoer for abonnementsplaner med AI.
              </Typography>
            </Box>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="plan-select-label">Plan</InputLabel>
                <Select
                  labelId="plan-select-label"
                  label="Plan"
                  value={selectedPlan}
                  onChange={(event) => setSelectedPlan(event.target.value as PlanId)}
                >
                  <MenuItem value="basic">Basic Creator</MenuItem>
                  <MenuItem value="professional">Professional Creator</MenuItem>
                  <MenuItem value="business">Business Creator</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="style-select-label">Stil</InputLabel>
                <Select
                  labelId="style-select-label"
                  label="Stil"
                  value={selectedStyle}
                  onChange={(event) => setSelectedStyle(event.target.value as LogoStyle)}
                >
                  {STYLES.map((style) => (
                    <MenuItem key={style.value} value={style.value}>
                      {style.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="color-select-label">Fargeskjema</InputLabel>
                <Select
                  labelId="color-select-label"
                  label="Fargeskjema"
                  value={selectedColorScheme}
                  onChange={(event) => setSelectedColorScheme(event.target.value)}
                >
                  {COLOR_SCHEMES.map((scheme) => (
                    <MenuItem key={scheme.value} value={scheme.value}>
                      {scheme.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Tilpasset prompt (valgfritt)"
                value={customPrompt}
                onChange={(event) => setCustomPrompt(event.target.value)}
                placeholder="F.eks. Premium cinematic logo med nordisk uttrykk"
              />
            </Grid>

            {selectedColor && (
              <Grid item xs={12}>
                <Alert severity="info">{selectedColor.description}</Alert>
              </Grid>
            )}

            <Grid item xs={12}>
              <Stack direction="row" spacing={1}>
                <AdminButton
                  tone="primary"
                  startIcon={<AutoAwesome />}
                  onClick={() => generateLogoMutation.mutate()}
                  loading={generateLogoMutation.isPending}
                  disabled={isGenerating}
                >
                  Generer logo
                </AdminButton>
                <AdminButton
                  tone="secondary"
                  startIcon={<Refresh />}
                  onClick={() => generateAllLogosMutation.mutate()}
                  loading={generateAllLogosMutation.isPending}
                  disabled={isGenerating}
                >
                  Generer alle planer
                </AdminButton>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <AdminCard title={`Genererte logoer (${generatedLogos.length})`}>
        {generatedLogos.length === 0 && (
          <Alert severity="warning">Ingen logoer generert ennå. Kjør generatoren over.</Alert>
        )}

        <Grid container spacing={2}>
          {generatedLogos.map((logo) => (
            <Grid item xs={12} md={6} lg={4} key={logo.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Box
                      sx={{
                        width: '100%',
                        aspectRatio: '16 / 9',
                        borderRadius: 1,
                        overflow: 'hidden',
                        bgcolor: '#0b1220',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {logo.url ? (
                        <img
                          src={logo.url}
                          alt={`${logo.planId} logo`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Image sx={{ color: '#fff' }} />
                      )}
                    </Box>

                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip size="small" label={logo.planId} />
                      <Chip size="small" label={logo.style || selectedStyle} variant="outlined" />
                    </Stack>

                    <Typography variant="caption" color="text.secondary">
                      {new Date(logo.generatedAt).toLocaleString()}
                    </Typography>

                    <Stack direction="row" spacing={1}>
                      <IconButton size="small" aria-label="Forhåndsvis logo" onClick={() => { setPreviewLogo(logo); setShowPreview(true); }}>
                        <Visibility fontSize="small" />
                      </IconButton>
                      <IconButton size="small" aria-label="Last ned logo" onClick={() => downloadLogo(logo)}>
                        <Download fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Slett logo"
                        onClick={() => deleteLogoMutation.mutate(logo.id)}
                        disabled={deleteLogoMutation.isPending}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </AdminCard>

      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="md" fullWidth>
        <DialogTitle>Logo preview</DialogTitle>
        <DialogContent>
          {previewLogo ? (
            <Stack spacing={2}>
              <Box
                sx={{
                  width: '100%',
                  minHeight: 360,
                  borderRadius: 1,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {previewLogo.url ? (
                  <img
                    src={previewLogo.url}
                    alt={`${previewLogo.planId} preview`}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Box sx={{ p: 3 }}>
                    <Alert severity="warning">Ingen forhåndsvisning tilgjengelig.</Alert>
                  </Box>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Prompt: {previewLogo.prompt || 'Ikke tilgjengelig'}
              </Typography>
            </Stack>
          ) : (
            <Alert severity="info">Velg en logo for preview.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setShowPreview(false)}>Lukk</AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
