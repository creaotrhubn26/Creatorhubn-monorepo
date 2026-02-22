import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Card,
  CardMedia,
  CardContent,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  CircularProgress,
  Divider,
  Paper,
  Autocomplete,
  IconButton,
} from '@mui/material';
import {
  School as SchoolIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  AccessTime,
  AttachMoney,
  Close as CloseIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
	import { getCourseCategoryIcon, getCourseLevelIcon, getProfessionIcon } from '@/utils/profession-icons';
  import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
  import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
	import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  price: number;
  currency?: string;
  level: string;
  duration?: number;
  category: string;
  learningObjectives?: string[];
  isPublished?: boolean;
}

interface Channel {
  id: string;
  name: string;
  display_name: string;
  description: string;
  recommended?: boolean;
}

interface PublishToCommunityDialogProps {
  open: boolean;
  onClose: () => void;
  course?: Course; // Optional - if not provided, show course selector
  onSuccess?: () => void;
  allCourses?: Course[]; // All published courses for selection
}

function PublishToCommunityDialog({
  open,
  onClose,
  course: initialCourse,
  onSuccess,
  allCourses = [],
}: PublishToCommunityDialogProps) {
  // Profession wiring (API configs + adapter)
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'photographer';
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession];
  const professionDisplayName =
    enhancedProfessionConfig?.displayName || enhancedProfessionConfig?.name || currentProfession;
  const professionColor = enhancedProfessionConfig?.color || '#ff8c00';
  const professionIcon = getProfessionIcon(currentProfession);

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(initialCourse || null);
  const [instructorMessage, setInstructorMessage] = useState('');
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]); // Changed to array for multi-select
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishedMessageIds, setPublishedMessageIds] = useState<string[]>([]); // Changed to array
  const [publishResults, setPublishResults] = useState<{channelName: string; success: boolean; error?: string}[]>([]);

  // Template management state
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<null | HTMLElement>(null);

  // Scheduling state
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  // Default instructor message template
  const defaultMessage = `Hei, kjære community-medlemmer!

Jeg har laget et nytt kurs og vil gjerne ha tilbakemelding på det!`;

  useEffect(() => {
    if (open) {
      setSelectedCourse(initialCourse || null);
      setInstructorMessage(defaultMessage);
      setValidationErrors([]);
      setPublishSuccess(false);
      fetchChannels();
      fetchTemplates();
      if (initialCourse) {
        validateCourse(initialCourse);
      }
    }
  }, [open, initialCourse]);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch('/api/academy/templates', {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates: ', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setInstructorMessage(template.message_content);
      setSelectedTemplateId(templateId);
      // Increment use count
      fetch(`/api/academy/templates/${templateId}/use`, {
        method: 'POST',
        credentials: 'include',
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || !instructorMessage.trim()) {
      alert('Vennligst fyll inn både navn og melding');
      return;
    }

    try {
      const response = await fetch('/api/academy/templates', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newTemplateName,
          message_content: instructorMessage,
        }),
      });

      if (response.ok) {
        setShowSaveTemplateDialog(false);
        setNewTemplateName('');
        fetchTemplates(); // Refresh templates
        alert('Mal lagret!');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Kunne ikke lagre mal');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne malen?')) {
      return;
    }

    try {
      const response = await fetch(`/api/academy/templates/${templateId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchTemplates(); // Refresh templates
        if (selectedTemplateId === templateId) {
          setSelectedTemplateId('');
        }
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Kunne ikke slette mal');
    }
  };

  const fetchChannels = async () => {
    setLoadingChannels(true);
    try {
      const response = await fetch('/api/academy/community/channels', {
        credentials: 'include',
      });
      const data = await response.json();
      setChannels(data.channels || []);
      
      // Auto-select recommended channel
      const recommended = data.channels?.find((ch: Channel) => ch.recommended);
      if (recommended) {
        setSelectedChannelIds([recommended.id]); // Pre-select recommended channel
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const validateCourse = (courseToValidate: Course | null) => {
    const errors: string[] = [];

    if (!courseToValidate) {
      errors.push('Vennligst velg et kurs');
      setValidationErrors(errors);
      return false;
    }

    if (!courseToValidate.title || courseToValidate.title.length < 10) {
      errors.push('Kurset må ha en tittel (minimum 10 tegn)');
    }
    if (!courseToValidate.description || courseToValidate.description.length < 100) {
      errors.push('Kurset må ha en beskrivelse (minimum 100 tegn)');
    }
    if (!courseToValidate.thumbnailUrl) {
      errors.push('Kurset må ha et miniatyrbilde');
    }
    if (!courseToValidate.price || courseToValidate.price <= 0) {
      errors.push('Kurset må ha en pris satt');
    }
    if (!courseToValidate.learningObjectives || courseToValidate.learningObjectives.length === 0) {
      errors.push('Kurset må ha læringsmål');
    }
    if (!courseToValidate.isPublished) {
      errors.push('Kurset må være publisert før det kan deles til community');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handlePublish = async () => {
    if (!selectedCourse || !validateCourse(selectedCourse)) {
      return;
    }

    if (selectedChannelIds.length === 0) {
      alert('Vennligst velg minst én kanal');
      return;
    }

    // If scheduling for later
    if (scheduleForLater) {
      if (!scheduledDateTime) {
        alert('Vennligst velg dato og tid for publisering');
        return;
      }

      const scheduledDate = new Date(scheduledDateTime);
      if (scheduledDate <= new Date()) {
        alert('Planlagt tid må være i fremtiden');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/academy/courses/${selectedCourse.id}/schedule-post`, {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            channelIds: selectedChannelIds,
            instructorMessage: instructorMessage.trim(),
            scheduledFor: scheduledDate.toISOString(),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to schedule post');
        }

        setPublishSuccess(true);
        setPublishResults([{
          channelName: 'Planlagt',
          success: true,
        }]);

        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2000);
      } catch (error: any) {
        console.error('Error scheduling post:', error);
        alert(error.message || 'Kunne ikke planlegge innlegget');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Immediate publishing
    setLoading(true);
    const results: {channelName: string; success: boolean; error?: string}[] = [];
    const messageIds: string[] = [];

    try {
      // Publish to each selected channel
      for (const channelId of selectedChannelIds) {
        const channel = channels.find(ch => ch.id === channelId);
        try {
          const response = await fetch(`/api/academy/courses/${selectedCourse.id}/publish-to-community`, {
            method: 'POST',
            headers: { 'Content-Type' : 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              channelId: channelId,
              instructorMessage: instructorMessage.trim(),
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to publish');
          }

          results.push({
            channelName: channel?.display_name || channel?.name || 'Unknown',
            success: true
          });
          messageIds.push(data.message?.id);
        } catch (error: any) {
          results.push({
            channelName: channel?.display_name || channel?.name || 'Unknown',
            success: false,
            error: error.message
          });
        }
      }

      setPublishResults(results);
      setPublishedMessageIds(messageIds);
      setPublishSuccess(true);

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 3000);

    } catch (error: any) {
      console.error('Error publishing course:', error);
      alert(error.message || 'Kunne ikke publisere kurset til community');
    } finally {
      setLoading(false);
    }
  };

  // Use centralized icon utilities for consistent branding

	  // Template menu handler
  const handleTemplateMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setTemplateMenuAnchor(event.currentTarget);
  };
  
  const handleTemplateMenuClose = () => {
    setTemplateMenuAnchor(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
          <Box display="flex" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {React.cloneElement(professionIcon as any, {
                sx: { color: professionColor, fontSize: 26 }
              })}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" noWrap>
                Publiser Kurs til Community
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {professionDisplayName} • {professionAdapter.adaptDashboardTitle()}
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton size="small" onClick={handleTemplateMenuOpen}>
              <MoreVertIcon />
            </IconButton>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Box>
      </DialogTitle>
      
      {/* Template menu */}
      <MenuItem 
        sx={{ display: 'none' }} 
        onClick={handleTemplateMenuClose}
        aria-hidden={!templateMenuAnchor}
      >
        <SchoolIcon fontSize="small" sx={{ mr: 1 }} />
        Course Templates
      </MenuItem>

      <DialogContent dividers>
        {publishSuccess ? (
          <Stack spacing={2}>
            <Alert severity="success" icon={<CheckCircleIcon />}>
              <Typography variant="h6" gutterBottom>
                Kurset er publisert til community!
              </Typography>
              <Typography variant="body2">
                Ditt kurs er nå synlig i de valgte kanalene. Medlemmer kan se kurset og melde seg på.
              </Typography>
            </Alert>

            {/* Show published message IDs */}
            {publishedMessageIds.length > 0 && (
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="caption" color="text.secondary">
                  Published to {publishedMessageIds.length} channel(s)
                </Typography>
              </Paper>
            )}
            
            {/* Show results for each channel */}
            {publishResults.length > 0 && (
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">
                    Publiseringsresultater:
                  </Typography>
                  <IconButton size="small" onClick={() => setShowSaveTemplateDialog(true)}>
                    <BookmarkBorderIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => console.log('Edit results')}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack spacing={1}>
                  {publishResults.map((result, index) => (
                    <Alert
                      key={index}
                      severity={result.success ? 'success' : 'error'}
                      sx={{ py: 0.5 }}
                    >
                      <Typography variant="body2">
                        <strong>{result.channelName}:</strong> {result.success ? 'Publisert' : `Feilet - ${result.error}`}
                      </Typography>
                    </Alert>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        ) : (
          <Stack spacing={3}>
            {/* Course Selection (if multiple courses available) */}
            {allCourses.length > 0 && (
              <FormControl fullWidth>
                <Autocomplete
                  value={selectedCourse}
                  onChange={(_, newValue) => {
                    setSelectedCourse(newValue);
                    if (newValue) {
                      validateCourse(newValue);
                    }
                  }}
                  options={allCourses}
                  getOptionLabel={(option) => option.title}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Velg kurs å publisere"
                      placeholder="Søk etter kurs..."
                      required
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box display="flex" alignItems="center" gap={2} width="100%">
                        <Box sx={{ color: 'primary.main' }}>
                          {getCourseCategoryIcon(option.category)}
                        </Box>
                        <Box flex={1}>
                          <Typography variant="body1">{option.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.level} • {option.price} {option.currency || 'NOK'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                  noOptionsText="Ingen publiserte kurs funnet"
                />
              </FormControl>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert severity="error" icon={<WarningIcon />}>
                <Typography variant="subtitle2" gutterBottom>
                  Kurset mangler nødvendig informasjon:
                </Typography>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Vennligst fullfør kursinformasjonen før du publiserer til community.
                </Typography>
              </Alert>
            )}

            {/* Course Preview */}
            {selectedCourse && (
              <Box>
                <Typography variant="subtitle2" gutterBottom color="text.secondary">
                  Forhåndsvisning av kurs:
                </Typography>
                <Card variant="outlined">
                  {selectedCourse.thumbnailUrl && (
                    <CardMedia
                      component="img"
                      height="200"
                      image={selectedCourse.thumbnailUrl}
                      alt={selectedCourse.title}
                    />
                  )}
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Box sx={{ color: 'primary.main' }}>
                        {getCourseCategoryIcon(selectedCourse.category)}
                      </Box>
                      <Typography variant="h6">
                        {selectedCourse.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {selectedCourse.description?.substring(0, 200)}
                      {selectedCourse.description?.length > 200 ? '...' : ', '}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                      <Chip
                        icon={getCourseLevelIcon(selectedCourse.level) as any}
                        label={selectedCourse.level}
                        size="small"
                      />
                      <Chip
                        icon={<AttachMoney />}
                        label={`${selectedCourse.price} ${selectedCourse.currency || 'NOK'}`}
                        size="small"
                        color="primary"
                      />
                      {selectedCourse.duration && (
                        <Chip
                          icon={<AccessTime />}
                          label={`${selectedCourse.duration} min`}
                          size="small"
                        />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            )}

            <Divider />

            {/* Channel Selection - Multi-select */}
            <FormControl fullWidth disabled={loadingChannels || validationErrors.length > 0}>
              <Autocomplete
                multiple
                value={channels.filter(ch => selectedChannelIds.includes(ch.id))}
                onChange={(_, newValue) => {
                  setSelectedChannelIds(newValue.map(ch => ch.id));
                }}
                options={channels}
                getOptionLabel={(option) => option.display_name}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Velg Kanaler"
                    placeholder="Velg én eller flere kanaler..."
                    helperText="Du kan publisere til flere kanaler samtidig"
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box display="flex" alignItems="center" gap={1} width="100%">
                      <Typography flex={1}>{option.display_name}</Typography>
                      {option.recommended && (
                        <Chip label="Anbefalt" size="small" color="success" />
                      )}
                    </Box>
                  </Box>
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.display_name}
                      {...getTagProps({ index })}
                      color={option.recommended ? 'success' : 'default'}
                    />
                  ))
                }
              />
            </FormControl>

            {/* Scheduling Options */}
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Button
                  variant={!scheduleForLater ? 'contained' : 'outlined'}
                  onClick={() => setScheduleForLater(false)}
                  size="small"
                >
                  Publiser nå
                </Button>
                <Button
                  variant={scheduleForLater ? 'contained' : 'outlined'}
                  onClick={() => setScheduleForLater(true)}
                  size="small"
                  startIcon={<AccessTime />}
                >
                  Planlegg publisering
                </Button>
              </Box>

              {scheduleForLater && (
                <TextField
                  label="Dato og tid for publisering"
                  type="datetime-local"
                  fullWidth
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  InputLabelProps={{
                    shrink: true}}
                  inputProps={{
                    min: new Date().toISOString().slice(0, 16)}}
                  helperText="Velg når innlegget skal publiseres automatisk"
                />
              )}
            </Box>

            {/* Template Selection */}
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <FormControl fullWidth size="small">
                  <InputLabel>Bruk mal (valgfritt)</InputLabel>
                  <Select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    label="Bruk mal (valgfritt)"
                    disabled={loadingTemplates}
                  >
                    <MenuItem value="">
                      <em>Ingen mal</em>
                    </MenuItem>
                    {templates.map((template) => (
                      <MenuItem key={template.id} value={template.id}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                          <Box display="flex" alignItems="center" gap={1}>
                            {template.is_default && <BookmarkIcon fontSize="small" color="primary" />}
                            <Typography>{template.name}</Typography>
                          </Box>
                          {!template.is_default && (
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(template.id);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setShowSaveTemplateDialog(true)}
                  disabled={!instructorMessage.trim()}
                >
                  Lagre som mal
                </Button>
              </Box>
            </Box>

            {/* Instructor Message */}
            <TextField
              label="Din melding til community"
              multiline
              rows={6}
              fullWidth
              value={instructorMessage}
              onChange={(e) => {
                setInstructorMessage(e.target.value);
                setSelectedTemplateId(''); // Clear template selection when editing
              }}
              disabled={validationErrors.length > 0}
              placeholder={defaultMessage}
              helperText="Skriv en personlig melding til community-medlemmene. Dette vises før kursinformasjonen."
            />

            {/* Info Alert */}
            <Alert severity="info" icon={<InfoIcon />}>
              <Typography variant="body2">
                Når du publiserer, vil kursinformasjonen automatisk legges til i meldingen sammen med din personlige melding.
              </Typography>
            </Alert>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {publishSuccess ? 'Lukk' : 'Avbryt'}
        </Button>
        {!publishSuccess && (
          <Button
            variant="contained"
            onClick={handlePublish}
            disabled={loading || validationErrors.length > 0 || selectedChannelIds.length === 0}
            startIcon={loading ? <CircularProgress size={20} /> : scheduleForLater ? <AccessTime /> : <SendIcon />}
          >
            {loading
              ? (scheduleForLater ? 'Planlegger...' : 'Publiserer...')
              : (scheduleForLater ? 'Planlegg publisering' : 'Publiser til Community')
            }
          </Button>
        )}
      </DialogActions>

      {/* Save Template Dialog */}
      <Dialog
        open={showSaveTemplateDialog}
        onClose={() => {
          setShowSaveTemplateDialog(false);
          setNewTemplateName('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Lagre som mal</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Malnavn"
            fullWidth
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="F.eks. 'Standard kursannonsering', "
          />
          <Alert severity="info" sx={{ mt: 2 }}>
            Malen vil lagre din nåværende melding og kan gjenbrukes senere.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowSaveTemplateDialog(false);
            setNewTemplateName('');
          }}>
            Avbryt
          </Button>
          <Button onClick={handleSaveTemplate} variant="contained">
            Lagre mal
          </Button>
        </DialogActions>
      </Dialog>
	    </Dialog>
	  );
	}

	export default withUniversalIntegration(PublishToCommunityDialog, {
	  componentId: 'publish-to-community-dialog',
	  componentName: 'Publish To Community Dialog',
	  componentType: 'modal',
	  componentCategory: 'academy',
	  featureIds: ['community-posts', 'post-scheduling', 'course-publishing'],
	});
