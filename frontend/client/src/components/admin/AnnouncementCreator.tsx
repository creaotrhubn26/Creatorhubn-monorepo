/**
 * Admin Announcement Creator
 * Create, preview, and send platform announcements
 */

import React, { useState } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useMutation } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  Grid,
  Alert,
  Divider,
  Switch,
  FormControlLabel,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material';
import {
  Visibility as PreviewIcon,
  Send as SendIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  CloudUpload as UploadIcon,
  YouTube as YouTubeIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import WhatsNewModal from '../WhatsNewModal';
import MarketingWorkflowIntegration from './MarketingWorkflowIntegration';
import EmailDesigner from '../EmailDesigner/EmailDesigner';

interface AnnouncementForm {
  title: string;
  content: string;
  category: 'feature' | 'update' | 'maintenance' | 'tip';
  importance: 'low' | 'medium' | 'high' | 'critical';
  targetProfessions: string[];
  targetUserTypes: string[];
  imageUrl: string;
  actionLabel: string;
  actionUrl: string;
  version: string;
  releaseDate: string;
  featureKey: string;
  tutorialVideoUrl: string;
  tutorialTitle: string;
  tutorialDescription: string;
  sendEmail: boolean;
  publishedAt: string;
  expiresAt: string;
  // Marketing fields
  marketingPurpose?: 'brand-awareness' | 'lead-generation' | 'seo' | 'education' | 'sales';
  targetAudience?: string[];
  callToAction?: string;
}

const professionOptions = ['photographer','videographer','designer','model','mua','stylist'];

const categoryOptions = [
  { value: 'feature', label: 'Ny Funksjon' },
  { value: 'update', label: 'Oppdatering' },
  { value: 'maintenance', label: 'Vedlikehold' },
  { value: 'tip', label: 'Tips' },
];

const importanceOptions = [
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Middels' },
  { value: 'high', label: 'Viktig' },
  { value: 'critical', label: 'Kritisk' },
];

export default function AnnouncementCreator() {
  const [form, setForm] = useState<AnnouncementForm>({
    title: '',
    content: '',
    category: 'feature',
    importance: 'medium',
    targetProfessions: [],
    targetUserTypes: [],
    imageUrl: '',
    actionLabel: '',
    actionUrl: '',
    version: '',
    releaseDate: new Date().toISOString().split('T,')[0],
    featureKey: '',
    tutorialVideoUrl: '',
    tutorialTitle: '',
    tutorialDescription: '',
    sendEmail: false,
    publishedAt: new Date().toISOString().split('T,')[0],
    expiresAt: '',
    marketingPurpose: 'education',
    targetAudience: [],
    callToAction: 'Besøk creatorhubn.com for å komme i gang gratis!',
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<unknown>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState('');
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [emailDesignerOpen, setEmailDesignerOpen] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<any>(null);

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (data: AnnouncementForm) => {
      const response = await fetch('/api/admin/announcements/preview', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to generate preview');
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewData(data.announcement);
      setPreviewOpen(true);
    },
  });

  // Create announcement mutation
  const createMutation = useMutation({
    mutationFn: async (data: AnnouncementForm) => {
      const response = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create announcement');
      return response.json();
    },
    onSuccess: () => {
      setSuccessMessage('Kunngjøring opprettet!');
      handleClear();
      setTimeout(() => setSuccessMessage(''), 3000);
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      const response = await fetch(`/api/admin/announcements/${announcementId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ sendToAll: true }),
      });
      if (!response.ok) throw new Error('Failed to send emails');
      return response.json();
    },
    onSuccess: (data) => {
      setSuccessMessage(`E-post sendt til ${data.results.sent} brukere!`);
      setTimeout(() => setSuccessMessage(''), 5000);
    },
  });

  const handleChange = (field: keyof AnnouncementForm, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfessionChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    handleChange('targetProfessions', typeof value === 'string' ? value.split(',') : value);
  };

  const handlePreview = () => {
    previewMutation.mutate(form);
  };

  const handleCreate = async () => {
    const result = await createMutation.mutateAsync(form);

    // Optionally send email if enabled
    if (form.sendEmail && result.announcement?.id) {
      sendEmailMutation.mutate(result.announcement.id);
    }
  };

  const handleClear = () => {
    setForm({
      title: '',
      content: '',
      category: 'feature',
      importance: 'medium',
      targetProfessions: [],
      targetUserTypes: [],
      imageUrl: '',
      actionLabel: '',
      actionUrl: '',
      version: '',
      releaseDate: new Date().toISOString().split('T')[0],
      featureKey: '',
      tutorialVideoUrl: '',
      tutorialTitle: '',
      tutorialDescription: '',
      sendEmail: false,
      publishedAt: new Date().toISOString().split('T')[0],
      expiresAt: '',
      marketingPurpose: 'education',
      targetAudience: [],
      callToAction: 'Besøk creatorhubn.com for å komme i gang gratis!',
    });
    setUploadedVideoUrl('');
    setUploadProgress(0);
  };

  // Handle video file upload to YouTube
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      alert('Vennligst velg en videofil');
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Videofilen er for stor. Maks størrelse er 500MB');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', form.tutorialTitle || form.title || 'CreatorHub Tutorial');
      formData.append('description', form.tutorialDescription || form.content || 'Tutorial video for CreatorHub Norge');
      formData.append('tags', JSON.stringify(['CreatorHub','Tutorial','Norge']));
      formData.append('privacyStatus','public'); // Public for marketing
      
      // Add marketing fields
      if (form.marketingPurpose) {
        formData.append('marketingPurpose', form.marketingPurpose);
      }
      if (form.targetAudience && form.targetAudience.length > 0) {
        formData.append('targetAudience', JSON.stringify(form.targetAudience));
      }
      if (form.callToAction) {
        formData.append('callToAction', form.callToAction);
      }
      formData.append('websiteUrl','https://creatorhubn.com');
      formData.append('instagramHandle','https://instagram.com/creatorhubn');

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setUploadedVideoUrl(response.embedUrl);
          handleChange('tutorialVideoUrl', response.embedUrl);
          setSuccessMessage('Video lastet opp til YouTube! 🎉');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          throw new Error('Upload failed');
        }
        setIsUploading(false);
      });

      xhr.addEventListener('error', () => {
        alert('Opplasting feilet. Prøv igjen.');
        setIsUploading(false);
      });

      xhr.open('POST','/api/youtube/upload');
      xhr.send(formData);
    } catch (error) {
      console.error('Upload error: ', error);
      alert('Opplasting feilet. Prøv igjen.');
      setIsUploading(false);
    }
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600}}>
            Opprett Ny Kunngjøring
          </Typography>

          {successMessage && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {successMessage}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Title */}
            <Grid item xs={12}>
              <TextField
                label="Tittel"
                fullWidth
                required
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
            </Grid>

            {/* Content */}
            <Grid item xs={12}>
              <TextField
                label="Innhold"
                fullWidth
                required
                multiline
                rows={6}
                value={form.content}
                onChange={(e) => handleChange('content', e.target.value)}
                helperText="Bruk linjeskift for formatering. Markdown støttes ikke."
              />
            </Grid>

            {/* Category & Importance */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Kategori</InputLabel>
                <Select
                  value={form.category}
                  label="Kategori"
                  onChange={(e) => handleChange('category', e.target.value)}
                >
                  {categoryOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Viktighet</InputLabel>
                <Select
                  value={form.importance}
                  label="Viktighet"
                  onChange={(e) => handleChange('importance', e.target.value)}
                >
                  {importanceOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Target Professions */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Målrettet Profesjoner</InputLabel>
                <Select
                  multiple
                  value={form.targetProfessions}
                  onChange={handleProfessionChange}
                  input={<OutlinedInput label="Målrettet Profesjoner" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {professionOptions.map((profession) => (
                    <MenuItem key={profession} value={profession}>
                      {profession}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Feature Key */}
            <Grid item xs={12}>
              <TextField
                label="Funksjonsnøkkel (valgfritt)"
                fullWidth
                value={form.featureKey}
                onChange={(e) => handleChange('featureKey', e.target.value)}
                helperText="Link til funksjon i feature matrix (f.eks. 'travel-log','ai-contracts')"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>
                Tilleggsinformasjon
              </Typography>
            </Grid>

            {/* Version */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Versjon (valgfritt)"
                fullWidth
                value={form.version}
                onChange={(e) => handleChange('version', e.target.value)}
                placeholder="1.0.0"
              />
            </Grid>

            {/* Release Date */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Utgivelsesdato"
                type="date"
                fullWidth
                value={form.releaseDate}
                onChange={(e) => handleChange('releaseDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Image URL */}
            <Grid item xs={12}>
              <TextField
                label="Bilde-URL (valgfritt)"
                fullWidth
                value={form.imageUrl}
                onChange={(e) => handleChange('imageUrl', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" sx={{ mb: 2 }}>
                Tutorial Video med Marketing (valgfritt)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Optimaliser videoen for økt synlighet, engasjement og konvertering
              </Typography>
            </Grid>

            {/* Video Upload Button */}
            <Grid item xs={12}>
              <Box
                sx={{
                  border: '2px dashed',
                  borderColor: uploadedVideoUrl ? 'success.main' : 'grey.300',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  bgcolor: uploadedVideoUrl ? 'success.50' : 'grey.50',
                  transition: 'all 0.3s'}}
              >
                {uploadedVideoUrl ? (
                  <Box>
                    <CheckIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                    <Typography variant="h6" sx={{ mb: 1, color: 'success.main' }}>
                      Video lastet opp til YouTube!
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {uploadedVideoUrl}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => {
                        setUploadedVideoUrl('');
                        handleChange('tutorialVideoUrl', ', ');
                      }}
                    >
                      Last opp ny video
                    </Button>
                  </Box>
                ) : isUploading ? (
                  <Box>
                    <YouTubeIcon sx={{ fontSize: 48, color: '#ff0000', mb: 1 }} />
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Laster opp til YouTube...
                    </Typography>
                    <Box sx={{ width: '100%', maxWidth: 400, mx: 'auto', mb: 1 }}>
                      <LinearProgress variant="determinate" value={uploadProgress} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {uploadProgress}% fullført
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      Last opp video til YouTube
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Videoen lastes automatisk opp til YouTube og settes som 'unlisted'
                    </Typography>
                    <Button
                      variant="contained"
                      component="label"
                      startIcon={<UploadIcon />}
                      sx={{
                        bgcolor: '#ff0000', '&:hover': { bgcolor: '#cc0000' }}}
                    >
                      Velg videofil
                      <input
                        type="file"
                        hidden
                        accept="video/*"
                        onChange={handleVideoUpload}
                      />
                    </Button>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                      Maks størrelse: 500MB • Formater: MP4, MOV, AVI, MKV, WebM
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Manual Video URL (fallback) */}
            <Grid item xs={12}>
              <TextField
                label="Eller legg inn video-URL manuelt (valgfritt)"
                fullWidth
                value={form.tutorialVideoUrl}
                onChange={(e) => handleChange('tutorialVideoUrl', e.target.value)}
                helperText="Bruk embed-URL for YouTube (https://www.youtube.com/embed/VIDEO_ID)"
                disabled={isUploading}
              />
            </Grid>

            {/* Marketing Purpose */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Marketing Formål</InputLabel>
                <Select
                  value={form.marketingPurpose || ', '}
                  label="Marketing Formål"
                  onChange={(e) => handleChange('marketingPurpose', e.target.value)}
                >
                  <MenuItem value="brand-awareness">🎯 Merkevarebygging</MenuItem>
                  <MenuItem value="lead-generation">💼 Lead-generering</MenuItem>
                  <MenuItem value="seo">🔍 SEO / Søkbarhet</MenuItem>
                  <MenuItem value="education">📚 Opplæring</MenuItem>
                  <MenuItem value="sales">🚀 Salg / Demo</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Target Audience */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Målgruppe</InputLabel>
                <Select
                  multiple
                  value={form.targetAudience || []}
                  onChange={(e) => handleChange('targetAudience', e.target.value)}
                  input={<OutlinedInput label="Målgruppe" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  <MenuItem value="Fotografer">Fotografer</MenuItem>
                  <MenuItem value="Videografer">Videografer</MenuItem>
                  <MenuItem value="Designere">Designere</MenuItem>
                  <MenuItem value="Makeup Artists">Makeup Artists</MenuItem>
                  <MenuItem value="Stylister">Stylister</MenuItem>
                  <MenuItem value="Modeller">Modeller</MenuItem>
                  <MenuItem value="Bryllupsfotografer">Bryllupsfotografer</MenuItem>
                  <MenuItem value="Produktfotografer">Produktfotografer</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Call to Action */}
            <Grid item xs={12}>
              <TextField
                label="Call to Action (CTA)"
                fullWidth
                value={form.callToAction || ', '}
                onChange={(e) => handleChange('callToAction', e.target.value)}
                placeholder="Besøk creatorhubn.com for å komme i gang gratis!"
                helperText="Hva skal seerne gjøre etter å ha sett videoen?"
              />
            </Grid>

            {/* Tutorial Title */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Video Tittel"
                fullWidth
                value={form.tutorialTitle}
                onChange={(e) => handleChange('tutorialTitle', e.target.value)}
                placeholder="Se hvordan det fungerer"
              />
            </Grid>

            {/* Tutorial Description */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Video Beskrivelse"
                fullWidth
                value={form.tutorialDescription}
                onChange={(e) => handleChange('tutorialDescription', e.target.value)}
                placeholder="Lær hvordan du bruker denne funksjonen"
              />
            </Grid>

            {/* Action Button */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Handlingsknapp Tekst (valgfritt)"
                fullWidth
                value={form.actionLabel}
                onChange={(e) => handleChange('actionLabel', e.target.value)}
                placeholder="Lær mer"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Handlingsknapp URL (valgfritt)"
                fullWidth
                value={form.actionUrl}
                onChange={(e) => handleChange('actionUrl', e.target.value)}
                placeholder="/settings/features"
              />
            </Grid>

            {/* Published At & Expires At */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Publiseres"
                type="date"
                fullWidth
                value={form.publishedAt}
                onChange={(e) => handleChange('publishedAt', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Utløper (valgfritt)"
                type="date"
                fullWidth
                value={form.expiresAt}
                onChange={(e) => handleChange('expiresAt', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Send Email Toggle */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.sendEmail}
                    onChange={(e) => handleChange('sendEmail', e.target.checked)}
                  />
                }
                label="Send e-postvarsel til målgruppe"
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="space-between">
                <Button
                  variant="outlined"
                  startIcon={<CampaignIcon />}
                  onClick={() => setWorkflowDialogOpen(true)}
                  sx={{ borderColor: '#2196f3', color: '#2196f3' }}
                >
                  Marketing Workflow
                </Button>
                <Box display="flex" gap={2}>
                  <Button
                    startIcon={<ClearIcon />}
                    onClick={handleClear}
                    disabled={createMutation.isPending}
                  >
                    Tøm
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PreviewIcon />}
                    onClick={handlePreview}
                    disabled={!form.title || !form.content || previewMutation.isPending}
                    sx={{ borderColor: '#ff8c00', color: '#ff8c00' }}
                  >
                    Forhåndsvis
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleCreate}
                    disabled={!form.title || !form.content || createMutation.isPending}
                    sx={{
                      bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' }}}
                  >
                    {form.sendEmail ? 'Opprett & Send E-post' : 'Opprett Kunngjøring'}
                  </Button>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <WhatsNewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        previewMode={true}
        previewAnnouncement={previewData}
        userProfession={form.targetProfessions[0] || 'photographer'}
      />

      {/* Marketing Workflow Integration */}
      <MarketingWorkflowIntegration
        open={workflowDialogOpen}
        onClose={() => setWorkflowDialogOpen(false)}
        initialData={{
          type:'announcement',
          data: form}}
        onComplete={(result) => {
          setWorkflowDialogOpen(false);
          setSuccessMessage('Marketing workflow opprettet!');
          setTimeout(() => setSuccessMessage(''), 3000);
        }}
      />
    </Box>
  );
}
