/**
 * CreatorHub Norge - Memory Card Template Selector
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  Edit,
  Memory,
  Save,
  Star,
  StarBorder,
  Storage,
  Videocam,
  CameraAlt,
} from '@mui/icons-material';
import type {
  MemoryCardTemplate} from '../../data/memory-card-templates';
import {
  MemoryCardTemplateManager,
} from '../../data/memory-card-templates';
import { useTheming } from '../../utils/theming-helper';

interface MemoryCardTemplateSelectorProps {
  selectedCameras: unknown[];
  projectType: string;
  profession: 'photographer' | 'videographer' | 'both';
  totalDays: number;
  budget?: 'budget' | 'mid' | 'premium' | 'professional';
  onTemplateSelect: (template: MemoryCardTemplate) => void;
  selectedTemplate?: MemoryCardTemplate | null;
}

const MemoryCardTemplateSelector: React.FC<MemoryCardTemplateSelectorProps> = ({
  selectedCameras,
  projectType,
  profession,
  totalDays,
  budget = 'mid',
  onTemplateSelect,
  selectedTemplate,
}) => {
  const theming = useTheming('photographer');

  const [templates, setTemplates] = useState<MemoryCardTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState<Set<string>>(new Set());
  const [includeSafetyCard, setIncludeSafetyCard] = useState(true);

  useEffect(() => {
    const contextTemplates = MemoryCardTemplateManager.getTemplatesByContext(
      profession,
      projectType,
      budget,
    );

    setTemplates(contextTemplates);

    if (selectedTemplate) {
      setSelectedTemplateId(selectedTemplate.id);
      return;
    }

    if (contextTemplates.length > 0) {
      const defaultTemplate = contextTemplates.find((template) => template.isDefault) ?? contextTemplates[0];
      setSelectedTemplateId(defaultTemplate.id);
      onTemplateSelect(defaultTemplate);
    }
  }, [budget, onTemplateSelect, profession, projectType, selectedTemplate]);

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const estimatedCapacity = useMemo(() => {
    if (!selected) {
      return 0;
    }

    const cards = selected.cards ?? [];
    const baseCount = cards.length;
    const safetyCount = includeSafetyCard ? 1 : 0;
    return (baseCount + safetyCount) * Math.max(1, totalDays) * 128;
  }, [includeSafetyCard, selected, totalDays]);

  const handleSelectTemplate = (templateId: string): void => {
    setSelectedTemplateId(templateId);
    const template = templates.find((entry) => entry.id === templateId);
    if (template) {
      onTemplateSelect(template);
    }
  };

  const toggleFavorite = (templateId: string): void => {
    setFavoriteTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Velg mal for {projectType} ({profession}) basert på {selectedCameras.length} kamera(er) og {totalDays} dag(er).
      </Alert>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" sx={{ color: theming.colors.primary }} gutterBottom>
                Maler
              </Typography>
              <FormControl fullWidth>
                <InputLabel id="memory-template-select-label">Template</InputLabel>
                <Select
                  labelId="memory-template-select-label"
                  value={selectedTemplateId}
                  label="Template"
                  onChange={(event) => handleSelectTemplate(event.target.value)}
                >
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box mt={2}>
                <FormControlLabel
                  control={<Switch checked={includeSafetyCard} onChange={(event) => setIncludeSafetyCard(event.target.checked)} />}
                  label="Inkluder sikkerhetskort"
                />
              </Box>

              <Box mt={2} display="flex" gap={1}>
                <Button variant="outlined" startIcon={<Edit />} onClick={() => setEditorOpen(true)} disabled={!selected}>
                  Rediger
                </Button>
                <Button variant="contained" startIcon={<AutoAwesome />} disabled={!selected}>
                  Bruk mal
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          {selected ? (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {selected.name}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={selected.isDefault ? 'Default' : 'Custom'}
                      color={selected.isDefault ? 'primary' : 'default'}
                      size="small"
                    />
                    <Tooltip title="Favoritt">
                      <Button
                        size="small"
                        variant="text"
                        startIcon={favoriteTemplateIds.has(selected.id) ? <Star color="warning" /> : <StarBorder />}
                        onClick={() => toggleFavorite(selected.id)}
                      >
                        Favoritt
                      </Button>
                    </Tooltip>
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selected.description ?? 'Ingen beskrivelse tilgjengelig.'}
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Stat icon={<Memory color="primary" />} label="Kort i mal" value={`${selected.cards?.length ?? 0}`} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Stat icon={profession === 'videographer' ? <Videocam color="secondary" /> : <CameraAlt color="secondary" />} label="Bruksprofil" value={profession} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Stat icon={<Storage color="success" />} label="Estimert kapasitet" value={`${estimatedCapacity} GB`} />
                  </Grid>
                </Grid>

                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Kortoppsett
                  </Typography>
                  {(selected.cards ?? []).map((card, index) => (
                    <Chip
                      key={`${selected.id}-card-${index}`}
                      label={`${card.type} • ${card.capacity}`}
                      size="small"
                      variant="outlined"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="warning">Ingen template funnet for valgt kontekst.</Alert>
          )}
        </Grid>
      </Grid>

      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Template-editor</DialogTitle>
        <DialogContent>
          {selected ? (
            <Box>
              <Typography variant="subtitle1">{selected.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Du kan justere detaljer i den dedikerte editoren i neste pass. Denne dialogen viser nå
                kontrollert metadata uten parsingfeil.
              </Typography>
            </Box>
          ) : (
            <Alert severity="info">Velg en template først.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)}>Lukk</Button>
          <Button variant="contained" startIcon={<Save />} onClick={() => setEditorOpen(false)}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }): JSX.Element {
  return (
    <Card variant="outlined">
      <CardContent>
        <Box display="flex" alignItems="center" gap={1}>
          {icon}
          <Box>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="subtitle1">{value}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default MemoryCardTemplateSelector;
