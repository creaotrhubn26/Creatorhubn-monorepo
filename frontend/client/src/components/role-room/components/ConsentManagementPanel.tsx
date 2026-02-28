import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Grid,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Send as SendIcon,
  ContentCopy as CopyIcon,
  Link as LinkIcon,
  Schedule as ScheduleIcon,
  Visibility as ViewedIcon,
} from '@mui/icons-material';
import { ConsentsIcon as DescriptionIcon } from './icons/CastingIcons';
import { Consent, ConsentType, Candidate, ConsentInvitationStatus } from '../models/casting';
import { consentService } from '../services/consentService';
import { castingService } from '../services/castingService';
import { Z_INDEX } from '../config/zIndex';

interface ConsentManagementPanelProps {
  projectId: string;
  candidateId: string;
  onUpdate?: () => void;
}

export function ConsentManagementPanel({ projectId, candidateId, onUpdate }: ConsentManagementPanelProps) {
  const consentModalZIndex = Z_INDEX.dialog + 50;
  const consentModalBackdropZIndex = consentModalZIndex - 1;
  const consentDialogAccentColor = '#b86bff';
  const consentMenuProps = {
    container: typeof document !== 'undefined' ? document.body : undefined,
    sx: { zIndex: Z_INDEX.dialogSelect + 50 },
    PaperProps: {
      sx: { zIndex: Z_INDEX.dialogSelect + 50 },
    },
  };
  const consentDialogPaperSx = {
    '--dialog-accent-color': consentDialogAccentColor,
    '--dialog-accent-hover': 'rgba(184,107,255,0.15)',
    '--dialog-border-color': 'rgba(184,107,255,0.34)',
    '--dialog-text': '#ffffff',
    bgcolor: 'rgba(20,14,48,0.94)',
    color: 'var(--dialog-text)',
    border: '1px solid var(--dialog-border-color)',
    borderRadius: 2.5,
    backgroundImage: [
      'linear-gradient(180deg, rgba(8,5,20,0.9) 0%, rgba(10,7,28,0.9) 100%)',
      'radial-gradient(circle at 16% -24%, rgba(184,107,255,0.28), transparent 55%)',
      'radial-gradient(circle at 82% -10%, rgba(106,76,207,0.24), transparent 48%)',
    ].join(', '),
    backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
    boxShadow: '0 28px 52px rgba(0,0,0,0.46)',
    zIndex: consentModalZIndex,
    overflow: 'hidden',
  };

  const [consents, setConsents] = useState<Consent[]>([]);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [status, setStatus] = useState<{
    total: number;
    signed: number;
    pending: number;
    missing: string[];
  }>({ total: 0, signed: 0, pending: 0, missing: [] });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConsent, setEditingConsent] = useState<Consent | null>(null);
  const [formData, setFormData] = useState<Partial<Consent>>({
    type: 'photo_release',
    signed: false,
    notes: '',
  });
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [invitingConsent, setInvitingConsent] = useState<Consent | null>(null);
  const [invitePin, setInvitePin] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteExpiresDays, setInviteExpiresDays] = useState(30);
  const [generatedAccessCode, setGeneratedAccessCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load consents and candidate when projectId or candidateId changes
  useEffect(() => {
    const loadData = async () => {
      if (projectId && candidateId) {
        try {
          const [loadedConsents, candidates] = await Promise.all([
            consentService.getConsents(projectId, candidateId),
            castingService.getCandidates(projectId),
          ]);
          setConsents(Array.isArray(loadedConsents) ? loadedConsents : []);
          const foundCandidate = candidates.find(c => c.id === candidateId);
          setCandidate(foundCandidate || null);
          
          // Update status
          const loadedStatus = await consentService.getConsentStatus(projectId, candidateId);
          setStatus(loadedStatus);
        } catch (error) {
          console.error('Error loading consent data:', error);
          setConsents([]);
          setCandidate(null);
        }
      }
    };
    loadData();
  }, [projectId, candidateId]);

  const consentTypes: ConsentType[] = [
    'photo_release',
    'video_release',
    'audio_release',
    'location_release',
    'minor_consent',
    'other',
  ];

  const getTypeLabel = (type: ConsentType): string => {
    const labels: Record<ConsentType, string> = {
      photo_release: 'Foto-samtykke',
      video_release: 'Video-samtykke',
      audio_release: 'Lyd-samtykke',
      location_release: 'Lokasjon-samtykke',
      minor_consent: 'Mindreårig-samtykke',
      other: 'Annet',
    };
    return labels[type] || type;
  };

  const handleOpenDialog = (consent?: Consent) => {
    if (consent) {
      setEditingConsent(consent);
      setFormData(consent);
    } else {
      setEditingConsent(null);
      setFormData({
        type: 'photo_release',
        signed: false,
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingConsent(null);
    setFormData({
      type: 'photo_release',
      signed: false,
      notes: '',
    });
  };

  const handleSave = async () => {
    if (editingConsent) {
      const consent: Consent = {
        ...editingConsent,
        ...formData,
        updatedAt: new Date().toISOString(),
      } as Consent;
      await consentService.updateConsent(projectId, candidateId, consent);
    } else {
      const newConsent = await consentService.createConsent(
        projectId,
        candidateId,
        formData.type || 'photo_release',
        formData.title
      );
      if (newConsent && formData.notes) {
        newConsent.notes = formData.notes;
        await consentService.updateConsent(projectId, candidateId, newConsent);
      }
    }

    const loadedConsents = await consentService.getConsents(projectId, candidateId);
    setConsents(Array.isArray(loadedConsents) ? loadedConsents : []);
    handleCloseDialog();
    if (onUpdate) onUpdate();
  };

  const handleDelete = async (consentId: string) => {
    if (window.confirm('Er du sikker på at du vil slette dette samtykket?')) {
      try {
        await consentService.deleteConsent(projectId, candidateId, consentId);
        const [loadedConsents, loadedStatus] = await Promise.all([
          consentService.getConsents(projectId, candidateId),
          consentService.getConsentStatus(projectId, candidateId),
        ]);
        setConsents(Array.isArray(loadedConsents) ? loadedConsents : []);
        setStatus(loadedStatus);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error deleting consent:', error);
      }
    }
  };

  const handleSign = async (consentId: string) => {
    try {
      await consentService.signConsent(projectId, candidateId, consentId);
      const [loadedConsents, loadedStatus] = await Promise.all([
        consentService.getConsents(projectId, candidateId),
        consentService.getConsentStatus(projectId, candidateId),
      ]);
      setConsents(Array.isArray(loadedConsents) ? loadedConsents : []);
      setStatus(loadedStatus);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error signing consent:', error);
    }
  };

  const handleOpenInviteDialog = (consent: Consent) => {
    setInvitingConsent(consent);
    setInvitePin('');
    setInvitePassword('');
    setInviteExpiresDays(30);
    setGeneratedAccessCode(consent.accessCode || '');
    setInviteDialogOpen(true);
  };

  const handleCloseInviteDialog = () => {
    setInviteDialogOpen(false);
    setInvitingConsent(null);
    setGeneratedAccessCode('');
    setCopySuccess(false);
  };

  const handleGenerateAccessCode = async () => {
    if (!invitingConsent) return;
    
    setGeneratingCode(true);
    try {
      const accessCode = await consentService.generateAccessCode(invitingConsent.id, {
        pin: invitePin || undefined,
        password: invitePassword || undefined,
        expiresDays: inviteExpiresDays,
      });

      if (!accessCode) return;

      const updatedConsent: Consent = {
        ...invitingConsent,
        accessCode,
        invitationStatus: 'sent',
        invitationSentAt: new Date().toISOString(),
      };

      if (invitePin) {
        updatedConsent.pin = invitePin;
      }
      if (invitePassword) {
        updatedConsent.password = invitePassword;
      }

      await consentService.updateConsent(projectId, candidateId, updatedConsent);
      setGeneratedAccessCode(accessCode);

      const loadedConsents = await consentService.getConsents(projectId, candidateId);
      setConsents(Array.isArray(loadedConsents) ? loadedConsents : []);
    } catch (error) {
      console.error('Error generating access code:', error);
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyLink = () => {
    const portalUrl = `${window.location.origin}/consent-portal?consent_code=${generatedAccessCode}`;
    navigator.clipboard.writeText(portalUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const getInvitationStatusLabel = (status?: ConsentInvitationStatus): string => {
    const labels: Record<ConsentInvitationStatus, string> = {
      'not_sent': 'Ikke sendt',
      'sent': 'Sendt',
      'viewed': 'Sett',
      'signed': 'Signert',
      'declined': 'Avslått',
    };
    return status ? labels[status] || status : 'Ikke sendt';
  };

  const getInvitationStatusColor = (status?: ConsentInvitationStatus): string => {
    const colors: Record<ConsentInvitationStatus, string> = {
      'not_sent': 'rgba(255,255,255,0.3)',
      'sent': '#ffb800',
      'viewed': '#00d4ff',
      'signed': '#10b981',
      'declined': '#ff4444',
    };
    return status ? colors[status] || 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.3)';
  };

  return (
    <Box sx={{ p: 3 }}>
      {candidate && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 1 }}>
            Samtykker for {candidate.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Chip
              label={`Totalt: ${status.total}`}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.87)',
              }}
            />
            <Chip
              label={`Signert: ${status.signed}`}
              size="small"
              sx={{
                bgcolor: '#10b981',
                color: '#000',
                fontWeight: 600,
              }}
            />
            <Chip
              label={`Venter: ${status.pending}`}
              size="small"
              sx={{
                bgcolor: '#ffb800',
                color: '#000',
                fontWeight: 600,
              }}
            />
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
          Samtykker ({consents.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            bgcolor: '#00d4ff',
            color: '#000',
            fontWeight: 600,
            '&:hover': { bgcolor: '#00b8e6' },
          }}
        >
          Legg til samtykke
        </Button>
      </Box>

      {consents.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            color: 'rgba(255,255,255,0.87)',
          }}
        >
          <DescriptionIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="body1">Ingen samtykker ennå</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Legg til samtykker for å spore dokumentasjon
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {consents.map((consent) => (
            <Grid item xs={12} sm={6} md={4} key={consent.id}>
              <Card
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  '&:hover': { borderColor: consent.signed ? '#10b981' : '#00d4ff' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ color: '#fff', mb: 0.5 }}>
                        {getTypeLabel(consent.type)}
                      </Typography>
                      <Chip
                        icon={consent.signed ? <CheckCircleIcon /> : <CancelIcon />}
                        label={consent.signed ? 'Signert' : 'Ikke signert'}
                        size="small"
                        sx={{
                          bgcolor: consent.signed ? '#10b981' : '#ffb800',
                          color: '#000',
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                    <Box>
                      {!consent.signed && (
                        <>
                          <Tooltip title="Send signeringsinvitasjon">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenInviteDialog(consent)}
                              sx={{ color: '#9c27b0' }}
                            >
                              <SendIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Merk som signert">
                            <IconButton
                              size="small"
                              onClick={() => handleSign(consent.id)}
                              sx={{ color: '#10b981' }}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(consent)}
                        sx={{ color: '#00d4ff' }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(consent.id)}
                        sx={{ color: '#ff4444' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  {consent.invitationStatus && consent.invitationStatus !== 'not_sent' && (
                    <Chip
                      icon={consent.invitationStatus === 'viewed' ? <ViewedIcon sx={{ fontSize: 14 }} /> : <ScheduleIcon sx={{ fontSize: 14 }} />}
                      label={getInvitationStatusLabel(consent.invitationStatus)}
                      size="small"
                      sx={{
                        bgcolor: getInvitationStatusColor(consent.invitationStatus),
                        color: '#000',
                        fontWeight: 500,
                        fontSize: '10px',
                        height: 20,
                        mb: 1,
                      }}
                    />
                  )}

                  {consent.accessCode && !consent.signed && (
                    <Typography variant="caption" sx={{ color: '#9c27b0', display: 'block', mb: 1 }}>
                      Kode: {consent.accessCode}
                    </Typography>
                  )}

                  {consent.date && (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: 1 }}>
                      Signert: {new Date(consent.date).toLocaleDateString('no-NO')}
                    </Typography>
                  )}

                  {consent.notes && (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '12px', mt: 1 }}>
                      {consent.notes}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Edit/Create Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        container={() => document.body}
        sx={{
          zIndex: consentModalZIndex,
          '& .MuiBackdrop-root': {
            zIndex: consentModalBackdropZIndex,
            bgcolor: 'rgba(8,5,20,0.86)',
            backdropFilter: 'blur(3px)',
          },
        }}
        PaperProps={{
          sx: consentDialogPaperSx,
        }}
      >
        <DialogTitle sx={{ 
          color: 'var(--dialog-text)',
          borderBottom: '1px solid var(--dialog-border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2.5,
          px: 3.5,
          background: 'linear-gradient(180deg, rgba(184,107,255,0.14) 0%, rgba(184,107,255,0.04) 100%)',
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <DescriptionIcon sx={{ color: 'var(--dialog-accent-color)', fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {editingConsent ? 'Rediger samtykke' : 'Nytt samtykke'}
            </Typography>
          </Stack>
          <IconButton
            onClick={handleCloseDialog}
            sx={{
              color: 'var(--dialog-text)',
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3.5, px: 3.5, pb: 3.75, maxHeight: { xs: 'none', sm: '72vh' }, overflowY: 'auto', overflowX: 'hidden' }}>
          <Box
            sx={{
              p: { xs: 2, sm: 2.5, md: 2.75 },
              borderRadius: 2.25,
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(33,24,70,0.74)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
            }}
          >
          <Stack spacing={2}>
            <FormControl fullWidth sx={{ mt: { xs: 0.5, sm: 0.75 } }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Type</InputLabel>
              <Select
                value={formData.type || 'photo_release'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ConsentType })}
                label="Type"
                MenuProps={consentMenuProps}
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                }}
              >
                {consentTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {getTypeLabel(type)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.signed || false}
                  onChange={(e) => setFormData({ ...formData, signed: e.target.checked })}
                  sx={{
                    color: '#00d4ff',
                    '&.Mui-checked': { color: '#00d4ff' },
                  }}
                />
              }
              label="Signert"
              sx={{ color: 'rgba(255,255,255,0.87)' }}
            />

            {formData.signed && !editingConsent?.date && (
              <TextField
                label="Signeringsdato"
                fullWidth
                type="date"
                value={formData.date ? formData.date.split('T')[0] : new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            )}

            <TextField
              label="Dokument URL (valgfritt)"
              fullWidth
              value={formData.document || ''}
              onChange={(e) => setFormData({ ...formData, document: e.target.value })}
              placeholder="URL til signert dokument"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />

            <TextField
              label="Notater"
              fullWidth
              multiline
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
          </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid var(--dialog-border-color)',
          px: 3,
          py: 1.9,
          gap: 1.2,
          justifyContent: 'flex-end',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.03) 100%)',
        }}>
          <Button
            onClick={handleCloseDialog}
            startIcon={<CancelIcon />}
            sx={{
              color: 'var(--dialog-text)',
              minHeight: 44,
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
            }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            startIcon={<SaveIcon />}
            sx={{
              bgcolor: 'var(--dialog-accent-color)',
              color: '#fff',
              minHeight: 44,
              fontWeight: 700,
              boxShadow: '0 8px 20px rgba(0,0,0,0.24)',
              '&:hover': { bgcolor: 'var(--dialog-accent-color)', filter: 'brightness(0.92)', boxShadow: '0 10px 24px rgba(0,0,0,0.3)' },
            }}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog
        open={inviteDialogOpen}
        onClose={handleCloseInviteDialog}
        maxWidth="sm"
        fullWidth
        container={() => document.body}
        sx={{
          zIndex: consentModalZIndex,
          '& .MuiBackdrop-root': {
            zIndex: consentModalBackdropZIndex,
            bgcolor: 'rgba(8,5,20,0.86)',
            backdropFilter: 'blur(3px)',
          },
        }}
        PaperProps={{
          sx: consentDialogPaperSx,
        }}
      >
        <DialogTitle sx={{ 
          color: 'var(--dialog-text)',
          borderBottom: '1px solid var(--dialog-border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2.5,
          px: 3.5,
          background: 'linear-gradient(180deg, rgba(184,107,255,0.14) 0%, rgba(184,107,255,0.04) 100%)',
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <SendIcon sx={{ color: 'var(--dialog-accent-color)' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Send signeringsinvitasjon
            </Typography>
          </Stack>
          <IconButton
            onClick={handleCloseInviteDialog}
            sx={{
              color: 'var(--dialog-text)',
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3.5, px: 3.5, pb: 3.75, maxHeight: { xs: 'none', sm: '72vh' }, overflowY: 'auto', overflowX: 'hidden' }}>
          {invitingConsent && (
            <Box
              sx={{
                p: { xs: 2, sm: 2.5, md: 2.75 },
                borderRadius: 2.25,
                border: '1px solid var(--dialog-border-color)',
                bgcolor: 'rgba(33,24,70,0.74)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
              }}
            >
            <Stack spacing={3}>
              <Alert 
                severity="info" 
                sx={{ 
                  bgcolor: 'rgba(156, 39, 176, 0.1)', 
                  color: '#ce93d8',
                  '& .MuiAlert-icon': { color: '#ce93d8' },
                }}
              >
                Generer en unik tilgangskode som kandidaten kan bruke for å signere {getTypeLabel(invitingConsent.type)} digitalt.
              </Alert>

              <TextField
                label="PIN-kode (valgfritt)"
                value={invitePin}
                onChange={(e) => setInvitePin(e.target.value)}
                placeholder="F.eks. 1234"
                helperText="Ekstra sikkerhet - kandidaten må oppgi PIN"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: '#ce93d8' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />

              <TextField
                label="Passord (valgfritt)"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                type="password"
                helperText="Ekstra sikkerhet - kandidaten må oppgi passord"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: '#ce93d8' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />

              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Utløper etter</InputLabel>
                <Select
                  value={inviteExpiresDays}
                  onChange={(e) => setInviteExpiresDays(Number(e.target.value))}
                  label="Utløper etter"
                  MenuProps={consentMenuProps}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ce93d8' },
                  }}
                >
                  <MenuItem value={7}>7 dager</MenuItem>
                  <MenuItem value={14}>14 dager</MenuItem>
                  <MenuItem value={30}>30 dager</MenuItem>
                  <MenuItem value={60}>60 dager</MenuItem>
                  <MenuItem value={90}>90 dager</MenuItem>
                </Select>
              </FormControl>

              {generatedAccessCode && (
                <Box sx={{ 
                  p: 3, 
                  bgcolor: 'rgba(156, 39, 176, 0.15)', 
                  borderRadius: 2,
                  border: '1px solid rgba(156, 39, 176, 0.3)',
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Tilgangskode:
                  </Typography>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontFamily: 'monospace', 
                      fontWeight: 700, 
                      color: '#ce93d8',
                      letterSpacing: '0.1em',
                      mb: 2,
                    }}
                  >
                    {generatedAccessCode}
                  </Typography>
                  
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="outlined"
                      startIcon={copySuccess ? <CheckCircleIcon /> : <CopyIcon />}
                      onClick={handleCopyLink}
                      sx={{ 
                        color: copySuccess ? '#10b981' : '#ce93d8', 
                        borderColor: copySuccess ? '#10b981' : '#ce93d8',
                      }}
                    >
                      {copySuccess ? 'Kopiert!' : 'Kopier lenke'}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<LinkIcon />}
                      onClick={() => {
                        const url = `${window.location.origin}/consent-portal?consent_code=${generatedAccessCode}`;
                        window.open(url, '_blank');
                      }}
                      sx={{ color: '#ce93d8', borderColor: '#ce93d8' }}
                    >
                      Åpne portal
                    </Button>
                  </Stack>
                </Box>
              )}
            </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid var(--dialog-border-color)',
          px: 3,
          py: 1.9,
          gap: 1.2,
          justifyContent: 'flex-end',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.03) 100%)',
        }}>
          <Button 
            onClick={handleCloseInviteDialog} 
            sx={{ 
              color: 'var(--dialog-text)',
              minHeight: 44,
              border: '1px solid var(--dialog-border-color)',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': { bgcolor: 'var(--dialog-accent-hover)', color: 'var(--dialog-text)' },
            }}
          >
            Lukk
          </Button>
          {!generatedAccessCode && (
            <Button
              variant="contained"
              onClick={handleGenerateAccessCode}
              disabled={generatingCode}
              startIcon={generatingCode ? <CircularProgress size={16} /> : <SendIcon />}
              sx={{
                bgcolor: 'var(--dialog-accent-color)',
                minHeight: 44,
                fontWeight: 700,
                boxShadow: '0 8px 20px rgba(0,0,0,0.24)',
                '&:hover': { bgcolor: 'var(--dialog-accent-color)', filter: 'brightness(0.92)', boxShadow: '0 10px 24px rgba(0,0,0,0.3)' },
              }}
            >
              {generatingCode ? 'Genererer...' : 'Generer tilgangskode'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
