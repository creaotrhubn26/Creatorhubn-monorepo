/**
 * Feature Customization Panel
 * Admin panel for customizing feature names, descriptions, and logos
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Chip,
  Avatar,
  InputAdornment,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Tooltip,
  alpha,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  Search as SearchIcon,
  Image as ImageIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { apiRequest } from '../../lib/queryClient';
import {
  CREATORHUB_FEATURES,
  type CreatorHubFeature,
} from '../../../../shared/creatorhub-features';

// Material UI icons for selection
const AVAILABLE_ICONS = [
  'PhotoCamera',
  'Videocam',
  'MusicNote',
  'Brush',
  'Create',
  'Dashboard',
  'Settings',
  'Analytics',
  'AttachMoney',
  'Person',
  'Group',
  'Business',
  'Cloud',
  'Storage',
  'Security',
  'Speed',
  'Build',
  'Extension',
  'Palette',
  'Movie',
  'Image',
  'Article',
  'Folder',
  'Timeline',
  'CalendarMonth',
  'Email',
  'Chat',
  'Notifications',
  'Star',
  'Favorite',
];

interface FeatureCustomization {
  id: string;
  featureId: string;
  customName: string | null;
  customDescription: string | null;
  logoUrl: string | null;
  logoIcon: string | null;
  logoColor: string | null;
  displayOrder: number;
  isVisible: boolean;
  customCategory: string | null;
  marketingText: string | null;
  tooltipText: string | null;
  externalLink: string | null;
}

interface Props {
  userId: string;
}

interface FeatureCustomizationsResponse {
  customizations: FeatureCustomization[];
}

type FeatureWithCustomization = CreatorHubFeature & {
  customization: FeatureCustomization | null;
};

export function FeatureCustomizationPanel({ userId }: Props) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureWithCustomization | null>(null);
  const [formData, setFormData] = useState<Partial<FeatureCustomization>>({});

  // Fetch customizations
  const { data: customizationsData, isLoading } = useQuery<FeatureCustomizationsResponse>({
    queryKey: ['/api/admin/feature-customizations'],
    queryFn: () => apiRequest('/api/admin/feature-customizations'),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data: Partial<FeatureCustomization> & { featureId: string }) =>
      apiRequest('/api/admin/feature-customizations', {
        method: 'POST',
        body: JSON.stringify({ ...data, userId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-customizations'] });
      setEditDialogOpen(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (featureId: string) =>
      apiRequest(`/api/admin/feature-customizations/${featureId}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feature-customizations'] });
    },
  });

  // Combine all features with customizations
  const allFeatures = useMemo<FeatureWithCustomization[]>(() => {
    const customizations = customizationsData?.customizations || [];
    const customizationMap = new Map(
      customizations.map((customization) => [customization.featureId, customization]),
    );

    return CREATORHUB_FEATURES.map((feature) => ({
      ...feature,
      customization: customizationMap.get(feature.id) || null,
    }));
  }, [customizationsData]);

  // Filter features
  const filteredFeatures = useMemo(() => {
    let filtered = allFeatures;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (feature) =>
          feature.id.toLowerCase().includes(term) ||
          feature.name.toLowerCase().includes(term) ||
          feature.customization?.customName?.toLowerCase().includes(term)
      );
    }

    // Filter by tab
    if (selectedTab === 1) {
      filtered = filtered.filter((feature) => feature.customization);
    } else if (selectedTab === 2) {
      filtered = filtered.filter((feature) => !feature.customization);
    }

    return filtered;
  }, [allFeatures, searchTerm, selectedTab]);

  const handleEditClick = (feature: FeatureWithCustomization) => {
    setSelectedFeature(feature);
    setFormData(feature.customization || { featureId: feature.id });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedFeature) {
      return;
    }
    saveMutation.mutate({
      ...formData,
      featureId: selectedFeature.id,
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600}}>
        Funksjonstilpasning
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Her kan du tilpasse navn, beskrivelser og logoer for alle funksjoner i plattformen.
        Disse endringene vises til brukere i planoversikter og onboarding.
      </Alert>

      {/* Search and Tabs */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <TextField
          placeholder="Søk etter funksjoner..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )}}
          sx={{ width: 300 }}
        />
        <Tabs value={selectedTab} onChange={(_event, value) => setSelectedTab(value)}>
          <Tab label={`Alle (${allFeatures.length})`} />
          <Tab label={`Tilpasset (${allFeatures.filter((feature) => feature.customization).length})`} />
          <Tab label={`Standard (${allFeatures.filter((feature) => !feature.customization).length})`} />
        </Tabs>
      </Box>

      {/* Features Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Logo</TableCell>
              <TableCell>Feature ID</TableCell>
              <TableCell>Standardnavn</TableCell>
              <TableCell>Tilpasset navn</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Synlig</TableCell>
              <TableCell align="right">Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredFeatures.slice(0, 50).map((feature) => (
              <TableRow key={feature.id} hover>
                <TableCell>
                  {feature.customization?.logoUrl ? (
                    <Avatar src={feature.customization.logoUrl} sx={{ width: 32, height: 32 }} />
                  ) : feature.customization?.logoIcon ? (
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: feature.customization.logoColor || '#FF8A00'}}
                    >
                      <ImageIcon sx={{ fontSize: 16 }} />
                    </Avatar>
                  ) : (
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#e0e0e0' }}>
                      <ImageIcon sx={{ fontSize: 16, color: '#999' }} />
                    </Avatar>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {feature.id}
                  </Typography>
                </TableCell>
                <TableCell>{feature.name}</TableCell>
                <TableCell>
                  {feature.customization?.customName ? (
                    <Chip
                      label={feature.customization.customName}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={feature.requiredPlan || 'basic'}
                    size="small"
                    sx={{
                      bgcolor: alpha(
                        feature.requiredPlan === 'enterprise'
                          ? '#9c27b0'
                          : feature.requiredPlan === 'pro'
                            ? '#2196f3'
                            : '#4caf50',
                        0.1
                      ),
                      color:
                        feature.requiredPlan === 'enterprise'
                          ? '#9c27b0'
                          : feature.requiredPlan === 'pro'
                            ? '#2196f3'
                            : '#4caf50'}}
                  />
                </TableCell>
                <TableCell>
                  {feature.customization?.isVisible !== false ? (
                    <VisibilityIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                  ) : (
                    <VisibilityOffIcon sx={{ color: '#f44336', fontSize: 20 }} />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Rediger">
                    <IconButton size="small" onClick={() => handleEditClick(feature)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {feature.customization && (
                    <Tooltip title="Slett tilpasning">
                      <IconButton
                        size="small"
                        onClick={() => deleteMutation.mutate(feature.id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredFeatures.length > 50 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Viser 50 av {filteredFeatures.length} funksjoner. Bruk søkefeltet for å finne flere.
        </Typography>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Tilpass funksjon: {selectedFeature?.name}
          <IconButton
            onClick={() => setEditDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 2.5 }}>
            <TextField
              label="Tilpasset navn"
              value={formData.customName || ''}
              onChange={(e) => setFormData({ ...formData, customName: e.target.value })}
              placeholder={selectedFeature?.name}
              fullWidth
            />
            <TextField
              label="Tilpasset beskrivelse"
              value={formData.customDescription || ''}
              onChange={(e) => setFormData({ ...formData, customDescription: e.target.value })}
              placeholder={selectedFeature?.description}
              multiline
              rows={3}
              fullWidth
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Logo URL"
                value={formData.logoUrl || ''}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://..."
                InputProps={{
                  endAdornment: formData.logoUrl && (
                    <Avatar src={formData.logoUrl} sx={{ width: 24, height: 24 }} />
                  )}}
              />
              <FormControl fullWidth>
                <InputLabel>Ikon</InputLabel>
                <Select
                  value={formData.logoIcon || ''}
                  onChange={(e) => setFormData({ ...formData, logoIcon: e.target.value })}
                  label="Ikon"
                >
                  <MenuItem value="">Ingen ikon</MenuItem>
                  {AVAILABLE_ICONS.map((icon) => (
                    <MenuItem key={icon} value={icon}>
                      {icon}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              <TextField
                label="Ikonfarge"
                type="color"
                value={formData.logoColor || '#FF8A00'}
                onChange={(e) => setFormData({ ...formData, logoColor: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Visningsrekkefølge"
                type="number"
                value={formData.displayOrder || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    displayOrder: Number.isNaN(Number(e.target.value))
                      ? 0
                      : Number(e.target.value),
                  })
                }
              />
              <TextField
                label="Kategori"
                value={formData.customCategory || ''}
                onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
              />
            </Box>
            <TextField
              label="Markedsføringstekst"
              value={formData.marketingText || ''}
              onChange={(e) => setFormData({ ...formData, marketingText: e.target.value })}
              placeholder="Kort tekst for markedsføring..."
              multiline
              rows={2}
              fullWidth
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Tooltip-tekst"
                value={formData.tooltipText || ''}
                onChange={(e) => setFormData({ ...formData, tooltipText: e.target.value })}
              />
              <TextField
                label="Ekstern lenke"
                value={formData.externalLink || ''}
                onChange={(e) => setFormData({ ...formData, externalLink: e.target.value })}
                placeholder="https://docs..."
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isVisible !== false}
                  onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                />
              }
              label="Synlig for brukere"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            startIcon={<SaveIcon />}
          >
            {saveMutation.isPending ? 'Lagrer...' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default FeatureCustomizationPanel;
