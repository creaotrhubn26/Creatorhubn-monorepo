import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
// Import dynamic profession system
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  Chip,
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  Divider,
  InputAdornment,
} from '@mui/material';
import {
  Add,
  CalendarToday,
  Person,
  Category,
  Description,
  AccessTime,
  Group,
  Security,
  Lock,
  Visibility,
  PhotoLibrary,
} from '@mui/icons-material';

interface ProjectCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: any) => Promise<any>;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'
}

export function ProjectCreationModal({
  open,
  onOpenChange,
  onSubmit,
  profession = 'photographer',
}: ProjectCreationModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Theming system
  const theming = useTheming(profession || 'photographer');

  // Dynamic profession system integration
  const { user } = useAuth();
  const { professionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const { professionConfigs: dynamicConfigs } = useDynamicProfessions();
  const professionIcon = getProfessionIcon(profession);
  const currentConfig = professionConfigs[profession] || dynamicConfigs[profession];
  const professionDisplayName = currentConfig?.displayName || professionAdapter.adaptDashboardTitle();
  const professionColor = currentConfig?.iconColor || '#ff8c00';
  const [formData, setFormData] = useState({
    title: ',',
    description: '',
    category: profession === 'photographer'
        ? 'bryllup'
        : profession === 'videographer'
          ? 'bryllupsvideo'
          : profession === 'music_producer'
            ? 'sang'
            : profession === 'enterprise'
              ? 'bryllup_komplett'
              : 'utstyr',
    clientId: '',
    scheduledDate: '',
    duration:  60,
    attendees: [] as string[],
    // FASE 2: Showcase Gallery Security Settings
    enableShowcaseGallery: false,
    galleryPin: '',
    galleryPassword: '',
    requiresApproval: false,
    downloadProtectionLevel: 'none' as 'none' | 'watermark' | 'disabled' | 'approval_required',
    rightClickDisabled: false,
    sessionTimeoutMinutes:  60,
    maxLoginAttempts:  3,
});
  const [attendeeInput, setAttendeeInput] = useState('');

  // Profession-specific categories
  const getCategories = () => {
    switch (profession) {
      case 'photographer':
        return [
          { value: 'bryllup', label: 'Bryllup',},
          { value: 'portrett', label: 'Portrett',},
          { value: 'familie', label: 'Familie',},
          { value: 'baby', label: 'Baby/Barn',},
          { value: 'forlovelse', label: 'Forlovelse',},
          { value: 'gravid', label: 'Gravid',},
          { value: 'konfirmasjon', label: 'Konfirmasjon',},
          { value: 'bedrift', label: 'Bedrift',},
          { value: 'event', label: 'Event',},
          { value: 'kommersielt', label: 'Kommersielt',},
        ];
      case 'videographer':
        return [
          { value: 'bryllupsvideo', label: 'Bryllupsvideo',},
          { value: 'musikkvideo', label: 'Musikkvideo',},
          { value: 'bedriftsvideo', label: 'Bedriftsvideo',},
          { value: 'reklame', label: 'Reklame',},
          { value: 'dokumentar', label: 'Dokumentar',},
          { value: 'event', label: 'Event',},
          { value: 'sosiale_medier', label: 'Sosiale medier',},
          { value: 'intervju', label: 'Intervju',},
          { value: 'promotering', label: 'Promotering',},
        ];
      case 'music_producer':
        return [
          { value: 'sang', label: 'Sang',},
          { value: 'album', label: 'Album',},
          { value: 'single', label: 'Single',},
          { value: 'remix', label: 'Remix',},
          { value: 'instrumentalt', label: 'Instrumentalt',},
          { value: 'demo', label: 'Demo',},
          { value: 'mastering', label: 'Mastering',},
          { value: 'mixing', label: 'Mixing',},
          { value: 'komposisjon', label: 'Komposisjon',},
        ];
      case 'vendor':
      default: return [
          { value: 'utstyr', label: 'Utstyr',},
          { value: 'lokaler', label: 'Lokaler',},
          { value: 'service', label: 'Service',},
          { value: 'konsulenting', label: 'Konsultering',},
          { value: 'support', label: 'Support',},
        ];
      case 'enterprise':
        return [
          { value: 'bryllup_komplett', label: 'Bryllup (Foto + Video)',},
          { value: 'bryllup_foto', label: 'Bryllup Foto',},
          { value: 'bryllup_video', label: 'Bryllup Video',},
          { value: 'bedrift_komplett', label: 'Bedrift (Foto + Video)',},
          { value: 'event_komplett', label: 'Event (Foto + Video)',},
          { value: 'portrett', label: 'Portrett',},
          { value: 'dokumentar', label: 'Dokumentar',},
          { value: 'reklame', label: 'Reklame / Kommersiell',},
          { value: 'sosiale_medier', label: 'Sosiale Medier',},
          { value: 'team_prosjekt', label: 'Teamprosjekt',},
        ];
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit) return;

    setLoading(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
      // Reset form
      setFormData({
        title: '',
        description: '',
        category: profession === 'photographer'
            ? 'bryllup'
            : profession === 'videographer'
              ? 'bryllupsvideo'
              : profession === 'music_producer'
                ? 'sang'
                : 'utstyr',
        clientId: '',
        scheduledDate: ', ',
        duration:  60,
        attendees:  [],
        // FASE 2: Reset showcase gallery settings
        enableShowcaseGallery: false,
        galleryPin: ', ',
        galleryPassword: ', ',
        requiresApproval: false,
        downloadProtectionLevel: 'none' as 'none' | 'watermark' | 'disabled' | 'approval_required',
        rightClickDisabled: false,
        sessionTimeoutMinutes:  60,
        maxLoginAttempts:  3,
    });
  } catch (error) {
      console.error('Failed to create project:', error);
  } finally {
      setLoading(false);
  }
};

  const addAttendee = () => {
    if (attendeeInput.trim() && !formData.attendees.includes(attendeeInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        attendees: [...prev.attendees, attendeeInput.trim()],
    }));
      setAttendeeInput(', ');
  }
};

  const removeAttendee = (email: string) => {
    setFormData((prev) => ({
      ...prev,
      attendees: prev.attendees.filter((a) => a !== email),
  }));
};

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && attendeeInput.trim()) {
      e.preventDefault();
      addAttendee();
}
};

  const categories = getCategories();

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,248,235,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(25,140,0,0.2)',
          borderRadius:  3,
          boxShadow: '0 20px 40px rgba(25,140,0,0.1)',
      }}}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          color: '#1a1f20',
          fontWeight: 600,
          fontSize: '1.5rem',
          pb:  1}}
      >
        {professionIcon ? React.cloneElement(professionIcon, { sx: { mr: 1, color: professionColor, fontSize: 28 } }) : <Add sx={{ mr: 1, color: professionColor }} />}
        Opprett nytt{' '}
        {professionAdapter.adaptProjectTypeLabel(profession === 'photographer'
          ? 'fotoprosjekt'
          : profession === 'videographer'
            ? 'videoprosjekt'
            : profession === 'music_producer'
              ? 'musikkprosjekt'
              : profession === 'enterprise'
                ? 'teamprosjekt'
                : 'prosjekt')}
      </DialogTitle>

      <Typography sx={{ color: 'rgba(6,31,46,0.7)', mb: 3, px: 3 }}>
        Oppretter prosjekt for {professionDisplayName} — arbeidsområde og Google Drive integrasjon automatisk
      </Typography>

      <DialogContent>
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: 'flex', flexDirection: 'column', gap:  3 }}
        >
          <TextField
            label="Prosjekttittel"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={
              profession === 'photographer'
                ? 'Bryllup Emma & Lars - Sommer 2025'
                : profession === 'videographer'
                  ? 'Bryllupsvideo Emma & Lars'
                  : profession === 'music_producer'
                    ? 'Ny sang - Sommerfølelse'
                    : 'Utstyr utleie - Studio setup'
          }
            required
            fullWidth
            variant="outlined"
            InputProps={{
              startAdornment: <Description sx={{ color: '#ff8c00', mr:  1 }} />}}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(25,255,255,0.9)', '&:hover fieldset': { borderColor: '#ff8c00',},'&.Mui-focused fieldset': { borderColor: '#ff8c00',},
            }}}
          />

          <TextField
            select
            label="Kategori"
            value={formData.category}
            onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
            fullWidth
            variant="outlined"
            InputProps={{
              startAdornment: <Category sx={{ color: '#ff8c00', mr:  1 }} />}}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(25,255,255,0.9)','&:hover fieldset': { borderColor: '#ff8c00',},'&.Mui-focused fieldset': { borderColor: '#ff8c00',},
            }}}
          >
            {categories.map((category) => (
              <MenuItem key={category.value} value={category.value}>
                {category.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Klient / Oppdragsgiver"
            value={formData.clientId}
            onChange={(e) => setFormData((prev) => ({ ...prev, clientId: e.target.value }))}
            placeholder={user?.email || 'Velg eller skriv inn klient-ID'}
            fullWidth
            variant="outlined"
            InputProps={{
              startAdornment: <Person sx={{ color: '#ff8c00', mr: 1 }} />,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.9)',
                '&:hover fieldset': { borderColor: '#ff8c00' },
                '&.Mui-focused fieldset': { borderColor: '#ff8c00' },
              },
            }}
          />

          <TextField
            label="Beskrivelse"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Beskriv prosjektet ditt..."
            multiline
            rows={3}
            fullWidth
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(25,255,255,0.9)','&:hover fieldset': { borderColor: '#ff8c00',},'&.Mui-focused fieldset': { borderColor: '#ff8c00',},
            }}}
          />

          <Box sx={{ display: 'flex', gap:  2 }}>
            <TextField
              label="Planlagt dato"
              type="date"
              value={formData.scheduledDate}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  scheduledDate: e.target.value,
              }))
            }
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: <CalendarToday sx={{ color: '#ff8c00', mr:  1 }} />}}
              sx={{
                flex: 1, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(25,255,255,0.9)','&:hover fieldset': { borderColor: '#ff8c00',},'&.Mui-focused fieldset': { borderColor: '#ff8c00',},
              }}}
            />

            <TextField
              label="Varighet (minutter)"
              type="number"
              value={formData.duration}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  duration: parseInt(e.target.value) || 60,
              }))
            }
              InputProps={{
                startAdornment: <AccessTime sx={{ color: '#ff8c00', mr:  1 }} />}}
              sx={{
                flex: 1, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(25,255,255,0.9)','&:hover fieldset': { borderColor: '#ff8c00',},'&.Mui-focused fieldset': { borderColor: '#ff8c00',},
              }}}
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                label="Legg til deltakere"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="person@example.com"
                fullWidth
                variant="outlined"
                InputProps={{
                  startAdornment: <Group sx={{ color: '#ff8c00', mr:  1 }} />}}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(25,255,255,0.9)','&:hover fieldset': { borderColor: '#ff8c00',},'&.Mui-focused fieldset': { borderColor: '#ff8c00',},
                }}}
              />
              <Button
                onClick={addAttendee}
                variant="outlined"
                sx={{
                  color: '#ff8c00',
                  borderColor: '#ff8c00','&:hover': {
                    borderColor: '#ff6b30',
                    bgcolor: 'rgba(25,140,0,0.05)',
                }}}
              >
                Legg til
              </Button>
            </Box>

            {formData.attendees.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  1 }}>
                {formData.attendees.map((email) => (
                  <Chip
                    key={email}
                    label={email}
                    onDelete={() => removeAttendee(email)}
                    sx={{
                      bgcolor: 'rgba(25,140,0,0.1)',
                      color: '#ff8c00','& .MuiChip-deleteIcon': {
                        color: '#ff8c00','&:hover': { color: '#ff6b35',},
                    }}}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* FASE 2: Showcase Gallery Security Settings */}
          <Card
            sx={{
              background: 'linear-gradient(135deg, rgba(255,140,0,0.05) 0%, rgba(255,248,235,0.05) 100%)',
              border: '1px solid rgba(255,140,0,0.2)',
              borderRadius: 2,
              ...theming.getThemedCardSx(),
            }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                <PhotoLibrary sx={{ color: '#ff8c00', mr: 1.5}} />
                <Typography variant="h6" sx={{  color: '#1a1f20', fontWeight: 600}}>
                  Showcase Galleri
                </Typography>
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enableShowcaseGallery}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        enableShowcaseGallery: e.target.checked,
                    }))
                  }
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#ff8c00',
                    }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#ff8c00',
                    }}}
                  />
              }
                label="Aktiver klient showcase galleri"
                sx={{ mb:  2 }}
              />

              {formData.enableShowcaseGallery && (
                <>
                  <Divider sx={{ my:  2 }} />

                  <Typography
                    variant="subtitle2"
                    sx={{
                      color: '#1a1f20',
                      fontWeight: 600,
                      mb: 2,
                      display: 'flex',
                      alignItems: 'center'}}
                  >
                    <Security sx={{ mr: 1, color: '#ff8c00'}} />
                    Sikkerhetinnstillinger
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <TextField
                      label="PIN-kode (valgfritt)"
                      value={formData.galleryPin}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          galleryPin: e.target.value.replace(/\D/g, '').slice(0, 6),
                      }))
                    }
                      placeholder="4-6 siffer"
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Lock sx={{ color: '#ff8c00'}} />
                          </InputAdornment>
                        )}}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(25,255,255,0.9)','&:hover fieldset': { borderColor: '#ff8c00',},'&.Mui-focused fieldset': { borderColor: '#ff8c00',},
                      }}}
                    />

                    <TextField
                      label="Passord (valgfritt)"
                      value={formData.galleryPassword}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          galleryPassword: e.target.value,
                      }))
                    }
                      type="password"
                      placeholder="Sikkert passord"
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Visibility sx={{ color: '#ff8c00'}} />
                          </InputAdornment>
                        )}}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(25,255,255,0.9)','&:hover fieldset': { borderColor: '#ff8c00',},'&.Mui-focused fieldset': { borderColor: '#ff8c00',},
                      }}}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <TextField
                      select
                      label="Nedlastingsbeskyttelse"
                      value={formData.downloadProtectionLevel}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          downloadProtectionLevel: e.target.value as any,
                      }))
                    }
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(25,255,255,0.9)','&:hover fieldset': { borderColor: '#ff8c00',},'&.Mui-focused fieldset': { borderColor: '#ff8c00',},
                      }}}
                    >
                      <MenuItem value="none">Ingen beskyttelse</MenuItem>
                      <MenuItem value="watermark">Vannmerke ved nedlasting</MenuItem>
                      <MenuItem value="disabled">Deaktiver nedlasting</MenuItem>
                      <MenuItem value="approval_required">Godkjenning kreves</MenuItem>
                    </TextField>

                    <TextField
                      label="Sesjon timeout (min)"
                      type="number"
                      value={formData.sessionTimeoutMinutes}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sessionTimeoutMinutes: parseInt(e.target.value) || 60,
                      }))
                    }
                      InputProps={{ inputProps: { min: 15, max: 1440,} }}
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(25,255,255,0.9)','&:hover fieldset': { borderColor: '#ff8c00',},'&.Mui-focused fieldset': { borderColor: '#ff8c00',},
                      }}}
                    />
                  </Box>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.requiresApproval}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            requiresApproval: e.target.checked,
                        }))
                      }
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#ff8c00',
                        }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#ff8c00',
                        }}}
                      />
                  }
                    label="Krever godkjenning før visning"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.rightClickDisabled}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            rightClickDisabled: e.target.checked,
                        }))
                      }
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#ff8c00',
                        }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#ff8c00',
                        }}}
                      />
                  }
                    label="Deaktiver høyreklikk"
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Box sx={{ display: 'flex', gap: 2, pt: 2 }}>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outlined"
              fullWidth
              sx={{
                color: 'rgba(6,31,46,0.7)',
                borderColor: 'rgba(6,31,46,0.3)', '&:hover': {
                  borderColor: 'rgba(6,31,46,0.5)',
                  bgcolor: 'rgba(6,31,46,0.05)',
              }}}
            >
              Avbryt
            </Button>
            <Button type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !formData.title.trim()}
              sx={{
                background: 'linear-gradient(45deg, #ff8c00, #ff6b35)',
                color: 'white',
                fontWeight: 600,
                py: 1.5,
                '&:hover': {
                  background: 'linear-gradient(45deg, #ff6b35, #ff8c00)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(255,140,0,0.3)',
                },
                '&:disabled': {
                  background: 'rgba(6,31,46,0.3)',
                  color: 'rgba(6,31,46,0.5)',
                },
                ...theming.getThemedButtonSx(),
              }}>
              {loading ? 'Oppretter...' : 'Opprett prosjekt'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
