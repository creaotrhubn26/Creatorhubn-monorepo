// @ts-nocheck
/**
 * TeamOnboardingWizard — Slice 9X.75
 *
 * Velkomst-wizard for nye team som blir medlem av CreatorHub. Steg:
 *   1. Velkomst + teamnavn
 *   2. Legg til teammedlemmer (navn, e-post, telefon)
 *   3. Velg default-rolle per medlem
 *   4. Bekreft + send invitasjon (skriver til team-members-directory)
 *
 * Skriver direkte til samme localStorage-nøkkel som TeamMembersDirectory
 * bruker, så medlemmene er umiddelbart tilgjengelige i Split Sheet-picker.
 *
 * Auto-trigger: når en bruker med profession === 'enterprise' logger inn
 * for første gang OG har 0 medlemmer i direktoratet (se UniversalDashboard).
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Stack, Typography, Button,
  IconButton, TextField, Stepper, Step, StepLabel, Avatar, FormControl,
  InputLabel, Select, MenuItem, Chip, Alert, Divider, alpha,
} from '@mui/material';
import {
  Close as CloseIcon, ArrowBack as BackIcon, ArrowForward as NextIcon,
  CheckCircle as DoneIcon, Group as TeamIcon, PersonAdd as PersonAddIcon,
  WorkOutline as RoleIcon, EmojiPeople as WelcomeIcon, Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { saveTeamMembers, loadTeamMembers, type TeamMember } from '@/components/universal/split-sheets/TeamMembersDirectory';
import { teamDirectoryEvents } from '@/utils/creatorhub-events';

interface DraftMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  defaultRoleId: string;
}

const ROLE_OPTIONS_VISUAL = [
  { id: 'photo', label: 'Foto (kamera)' },
  { id: 'photo-edit', label: 'Foto + redigering' },
  { id: 'video', label: 'Video (kamera)' },
  { id: 'video-edit', label: 'Video + redigering' },
  { id: 'edit-only', label: 'Bare redigering' },
  { id: 'second-shooter', label: 'Second shooter' },
  { id: 'assistant', label: 'Assistent' },
  { id: 'logistics', label: 'Logistikk / koordinering' },
];

const ROLE_OPTIONS_MUSIC = [
  { id: 'producer', label: 'Produsent' },
  { id: 'songwriter', label: 'Låtskriver' },
  { id: 'beatmaker', label: 'Beatmaker' },
  { id: 'vocalist', label: 'Vokalist' },
  { id: 'mix-engineer', label: 'Mix-engineer' },
  { id: 'master-engineer', label: 'Master-engineer' },
  { id: 'session-musician', label: 'Session-musiker' },
  { id: 'feature-artist', label: 'Feature-artist' },
];

const STEPS = ['Velkommen', 'Teammedlemmer', 'Roller', 'Ferdig'] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  profession?: string;
  /** Brukerens egen e-post — pre-fylles som første medlem */
  ownerEmail?: string;
  ownerName?: string;
  onComplete?: (data: { teamName: string; membersAdded: number }) => void;
}

const emptyMember = (): DraftMember => ({
  id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  email: '',
  phone: '',
  defaultRoleId: 'photo',
});

const TeamOnboardingWizard: React.FC<Props> = ({
  open, onClose, profession = 'photographer', ownerEmail, ownerName, onComplete,
}) => {
  const [step, setStep] = useState(0);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<DraftMember[]>(() =>
    ownerEmail ? [{
      id: 'dm-owner',
      name: ownerName || ownerEmail.split('@')[0],
      email: ownerEmail,
      phone: '',
      defaultRoleId: profession === 'music_producer' ? 'producer' : 'photo',
    }] : [emptyMember()],
  );

  const roleOptions = profession === 'music_producer' ? ROLE_OPTIONS_MUSIC : ROLE_OPTIONS_VISUAL;

  const validMembers = useMemo(
    () => members.filter((m) => m.name.trim().length > 0),
    [members],
  );

  const canProceed = (() => {
    if (step === 0) return teamName.trim().length > 1;
    if (step === 1) return validMembers.length >= 1;
    if (step === 2) return validMembers.every((m) => m.defaultRoleId);
    return true;
  })();

  const updateMember = (id: string, patch: Partial<DraftMember>) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const addMember = () => setMembers((prev) => [...prev, emptyMember()]);
  const removeMember = (id: string) => setMembers((prev) => prev.filter((m) => m.id !== id));

  const handleFinish = () => {
    // Merge med eksisterende direktorat (deduper på e-post)
    const existing = loadTeamMembers();
    const existingEmails = new Set(existing.map((m) => (m.email || '').toLowerCase()).filter(Boolean));

    const newOnes: TeamMember[] = validMembers
      .filter((m) => !existingEmails.has(m.email.toLowerCase()))
      .map((m) => ({
        id: `tm-onboarding-${Date.now()}-${m.id}`,
        name: m.name.trim(),
        email: m.email.trim() || undefined,
        phone: m.phone.trim() || undefined,
        avatarUrl: '',
        defaultRoleId: m.defaultRoleId,
        notes: `Lagt til via team-onboarding (${teamName})`,
        createdAt: new Date().toISOString(),
      }));

    saveTeamMembers([...newOnes, ...existing]);
    newOnes.forEach((m) =>
      teamDirectoryEvents.memberAdded(!!m.defaultRoleId, !!m.email, !!m.phone),
    );
    // Marker at onboarding er fullført
    try { window.localStorage.setItem('team-onboarding-completed', '1'); } catch {}

    onComplete?.({ teamName: teamName.trim(), membersAdded: newOnes.length });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          background: 'radial-gradient(circle at top, rgba(255,186,108,0.10) 0%, rgba(15,10,7,0.98) 36%, #0a0807 100%)',
          color: '#fff5e8',
          border: '1px solid rgba(255,186,108,0.18)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          minHeight: '70vh',
          '& .MuiInputLabel-root': { color: 'rgba(246,242,234,0.72)' },
          '& .MuiInputLabel-root.Mui-focused': { color: '#ffba6c' },
          '& .MuiOutlinedInput-root': {
            color: '#fff5e8',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
            '&:hover fieldset': { borderColor: 'rgba(255,186,108,0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#ffba6c' },
          },
          '& .MuiStepLabel-label': { color: 'rgba(246,242,234,0.62)' },
          '& .MuiStepLabel-label.Mui-active': { color: '#ffba6c', fontWeight: 700 },
          '& .MuiStepLabel-label.Mui-completed': { color: '#fff5e8' },
          '& .MuiSelect-icon': { color: 'rgba(246,242,234,0.72)' },
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3, pt: 3, pb: 2,
        background: 'linear-gradient(135deg, rgba(255,186,108,0.16), rgba(255,186,108,0.02))',
        borderBottom: '1px solid rgba(255,186,108,0.18)',
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'rgba(255,186,108,0.18)', color: '#ffba6c' }}>
              <WelcomeIcon />
            </Avatar>
            <Box>
              <Typography variant="overline" sx={{ color: '#ffba6c', letterSpacing: '0.18em' }}>
                Velkomst
              </Typography>
              <Typography variant="h5" sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 }}>
                Sett opp teamet ditt
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(246,242,234,0.72)' }}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((label, i) => (
            <Step key={label}>
              <StepLabel StepIconComponent={({ active, completed }) => {
                const Icon = [WelcomeIcon, TeamIcon, RoleIcon, DoneIcon][i];
                return (
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: active || completed ? '#ffba6c' : 'rgba(255,255,255,0.10)',
                    color: active || completed ? '#150d05' : 'rgba(246,242,234,0.5)',
                    transition: 'all 0.3s',
                  }}>
                    <Icon fontSize="small" />
                  </Box>
                );
              }}>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {/* STEG 1: Velkomst + teamnavn */}
        {step === 0 && (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: '"Space Grotesk", sans-serif', mb: 1 }}>
                Velkommen til CreatorHub! 🎬
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(246,242,234,0.72)', maxWidth: 500, mx: 'auto' }}>
                La oss sette opp teamet ditt. Dette tar 2 minutter og gjør at du kan dele honorar,
                koordinere prosjekter og holde oversikt over hvem som gjør hva.
              </Typography>
            </Box>
            <TextField
              label="Hva heter teamet ditt?"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              fullWidth
              autoFocus
              placeholder={profession === 'music_producer' ? 'F.eks. Studio Sentralen' : 'F.eks. Lysverkene Foto'}
              helperText="Brukes som visningsnavn rundt i appen"
            />
            <Box sx={{
              p: 2, borderRadius: 2,
              bgcolor: 'rgba(255,186,108,0.06)',
              border: '1px solid rgba(255,186,108,0.18)',
            }}>
              <Typography variant="body2" sx={{ color: '#fff5e8' }}>
                <strong>Hva skjer videre:</strong>
              </Typography>
              <Stack component="ul" sx={{ pl: 2, mt: 0.5, color: 'rgba(246,242,234,0.72)' }}>
                <li><Typography variant="caption">Du legger til de første teammedlemmene (navn + e-post)</Typography></li>
                <li><Typography variant="caption">Du velger default-rolle per person</Typography></li>
                <li><Typography variant="caption">Vi lagrer dette i team-direktoratet ditt</Typography></li>
                <li><Typography variant="caption">Når du oppretter et split sheet, kan du raskt velge fra direktoratet</Typography></li>
              </Stack>
            </Box>
          </Stack>
        )}

        {/* STEG 2: Teammedlemmer */}
        {step === 1 && (
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Hvem jobber i {teamName || 'teamet'}?
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                  Legg til minst én person. Du kan alltid legge til flere senere.
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={addMember}
                sx={{
                  borderRadius: '999px', px: 2, py: 0.75,
                  bgcolor: '#ffba6c', color: '#150d05',
                  fontWeight: 700, textTransform: 'none',
                  '&:hover': { bgcolor: '#ffc788' },
                }}
              >
                Legg til person
              </Button>
            </Stack>

            <Stack spacing={1.5}>
              {members.map((m, idx) => (
                <Box key={m.id} sx={{
                  p: 2, borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'rgba(255,186,108,0.32)' },
                }}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                    <Avatar sx={{
                      bgcolor: alpha('#ffba6c', 0.18), color: '#ffba6c',
                      fontSize: 14, fontWeight: 700, width: 36, height: 36,
                    }}>
                      {idx + 1}
                    </Avatar>
                    <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
                      {idx === 0 && m.id === 'dm-owner' ? 'Du' : `Medlem ${idx + 1}`}
                    </Typography>
                    {members.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={() => removeMember(m.id)}
                        sx={{ color: 'rgba(246,242,234,0.5)', '&:hover': { color: '#f44336' } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      size="small" required label="Fullt navn"
                      value={m.name}
                      onChange={(e) => updateMember(m.id, { name: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small" label="E-post"
                      type="email"
                      value={m.email}
                      onChange={(e) => updateMember(m.id, { email: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small" label="Telefon (valgfri)"
                      value={m.phone}
                      onChange={(e) => updateMember(m.id, { phone: e.target.value })}
                      sx={{ width: 160 }}
                    />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Stack>
        )}

        {/* STEG 3: Roller */}
        {step === 2 && (
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Hvilken rolle har hver person?</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                Rollen påvirker hvor stor andel personen får i split sheets (kan endres per prosjekt).
              </Typography>
            </Box>

            {validMembers.map((m) => (
              <Box key={m.id} sx={{
                p: 2, borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: alpha('#ffba6c', 0.18), color: '#ffba6c' }}>
                    {m.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>{m.name}</Typography>
                    {m.email && (
                      <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                        {m.email}
                      </Typography>
                    )}
                  </Box>
                  <FormControl size="small" sx={{ minWidth: 240 }}>
                    <InputLabel>Rolle</InputLabel>
                    <Select
                      label="Rolle"
                      value={m.defaultRoleId}
                      onChange={(e) => updateMember(m.id, { defaultRoleId: e.target.value as string })}
                    >
                      {roleOptions.map((r) => (
                        <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}

        {/* STEG 4: Ferdig — bekreft */}
        {step === 3 && (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <DoneIcon sx={{ fontSize: 64, color: '#10b981', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: '"Space Grotesk", sans-serif' }}>
                Du er klar!
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(246,242,234,0.72)', mt: 1 }}>
                <strong>{teamName}</strong> har nå {validMembers.length} medlem{validMembers.length === 1 ? '' : 'mer'} i direktoratet.
              </Typography>
            </Box>

            <Box sx={{
              p: 2.5, borderRadius: 2,
              bgcolor: 'rgba(16,185,129,0.10)',
              border: '1px solid rgba(16,185,129,0.32)',
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#10b981', mb: 1 }}>
                Disse legges til:
              </Typography>
              <Stack spacing={0.75}>
                {validMembers.map((m) => {
                  const role = roleOptions.find((r) => r.id === m.defaultRoleId);
                  return (
                    <Stack key={m.id} direction="row" spacing={1} alignItems="center">
                      <DoneIcon sx={{ fontSize: 16, color: '#10b981' }} />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        <strong>{m.name}</strong>
                        {m.email && <span style={{ color: 'rgba(246,242,234,0.62)' }}> · {m.email}</span>}
                      </Typography>
                      <Chip
                        size="small"
                        label={role?.label || m.defaultRoleId}
                        sx={{
                          bgcolor: 'rgba(255,186,108,0.18)',
                          color: '#ffba6c',
                          height: 20, fontSize: '0.66rem',
                        }}
                      />
                    </Stack>
                  );
                })}
              </Stack>
            </Box>

            <Alert
              severity="info"
              sx={{
                bgcolor: 'rgba(255,186,108,0.08)', color: '#fff5e8',
                border: '1px solid rgba(255,186,108,0.22)',
                '& .MuiAlert-icon': { color: '#ffba6c' },
              }}
            >
              Du finner alle medlemmene under <strong>Split Sheets → Team-direktorat</strong>.
              Når du oppretter en ny splitt, kan du raskt velge fra denne lista.
            </Alert>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{
        px: 3, py: 2.5,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(255,255,255,0.02)',
        justifyContent: 'space-between',
      }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          sx={{ color: 'rgba(246,242,234,0.72)', textTransform: 'none' }}
        >
          Tilbake
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            endIcon={<NextIcon />}
            variant="contained"
            disabled={!canProceed}
            onClick={() => setStep((s) => s + 1)}
            sx={{
              borderRadius: '999px', px: 3, py: 1.1,
              fontWeight: 700, textTransform: 'none',
              bgcolor: '#ffba6c', color: '#150d05',
              '&:hover': { bgcolor: '#ffc788' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,186,108,0.3)', color: 'rgba(21,13,5,0.5)' },
            }}
          >
            Fortsett
          </Button>
        ) : (
          <Button
            endIcon={<DoneIcon />}
            variant="contained"
            onClick={handleFinish}
            sx={{
              borderRadius: '999px', px: 3, py: 1.1,
              fontWeight: 700, textTransform: 'none',
              bgcolor: '#10b981', color: '#fff',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            Fullfør oppsett
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TeamOnboardingWizard;
