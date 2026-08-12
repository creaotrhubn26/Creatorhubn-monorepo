// @ts-nocheck
/**
 * RoleRoomMarketplaceModal — org-scoped app-katalog for The Role Room
 * (Fase 2: Leadgrid som tjeneste).
 *
 * Åpnes fra RoleRoomMobileTopBar via ikonet ved siden av innboks/profil.
 * Lister apper fra /api/role-room/marketplace/apps og lar innholdsprodusenter
 * installere Leadgrid (trial 14 dager) → åpne /leadgrid, eller avinstallere.
 */

import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StorefrontIcon from '@mui/icons-material/Storefront';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import {
  useRoleRoomApps,
  useInstallOrgApp,
  useUninstallOrgApp,
} from '../../../hooks/useRoleRoom';

interface RoleRoomMarketplaceModalProps {
  open: boolean;
  onClose: () => void;
}

function formatTrialRemaining(trialEndsAt: string | null): string | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  const remainingMs = end - Date.now();
  if (remainingMs <= 0) return 'Trialen er utløpt';
  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  if (days <= 1) {
    const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return `${hours} timer igjen av trialen`;
  }
  return `${days} dager igjen av trialen`;
}

export const RoleRoomMarketplaceModal: React.FC<RoleRoomMarketplaceModalProps> = ({
  open,
  onClose,
}) => {
  const appsQuery = useRoleRoomApps();
  const installMutation = useInstallOrgApp();
  const uninstallMutation = useUninstallOrgApp();

  const apps = appsQuery.data?.apps ?? [];

  const handleInstall = (appId: string) => {
    installMutation.mutate(appId);
  };

  const handleUninstall = (appId: string) => {
    uninstallMutation.mutate(appId);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          bgcolor: '#101018',
          color: '#e2e8f0',
          borderRadius: 3,
          border: '1px solid rgba(99,102,241,0.25)',
          backgroundImage:
            'radial-gradient(1200px 400px at 80% -10%, rgba(99,102,241,0.12), transparent)',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 7 }}>
        <StorefrontIcon sx={{ color: '#818cf8' }} />
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            Markedsplass
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Verktøy du kan legge til i produksjonen
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          aria-label="Lukk markedsplass"
          sx={{ position: 'absolute', right: 12, top: 12, color: '#94a3b8' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: 'rgba(99,102,241,0.15)', bgcolor: 'transparent' }}>
        {appsQuery.isLoading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Laster app-katalog…
            </Typography>
          </Box>
        ) : appsQuery.isError ? (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            Kunne ikke hente app-katalogen. Prøv igjen.
          </Alert>
        ) : apps.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Ingen tilgjengelige verktøy ennå.
          </Alert>
        ) : (
          <Stack spacing={2}>
            {apps.map((app) => {
              const installed = app.install_state === 'trial' || app.install_state === 'active';
              const busy = installMutation.isPending || uninstallMutation.isPending;
              const trialLabel = formatTrialRemaining(app.trial_ends_at);
              return (
                <Box
                  key={app.id}
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    border: installed
                      ? '1px solid rgba(99,102,241,0.5)'
                      : '1px solid rgba(148,163,184,0.2)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(99,102,241,0.15)',
                        color: '#818cf8',
                        flexShrink: 0,
                      }}
                    >
                      <RocketLaunchIcon />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle1" fontWeight={700}>
                          {app.name}
                        </Typography>
                        {app.category ? (
                          <Chip
                            size="small"
                            label={app.category}
                            sx={{
                              height: 20,
                              fontSize: 11,
                              bgcolor: 'rgba(99,102,241,0.12)',
                              color: '#a5b4fc',
                            }}
                          />
                        ) : null}
                        {installed ? (
                          <Chip
                            size="small"
                            label={trialLabel ?? 'Aktiv'}
                            sx={{
                              height: 20,
                              fontSize: 11,
                              bgcolor: 'rgba(16,185,129,0.12)',
                              color: '#34d399',
                            }}
                          />
                        ) : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {app.description}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap">
                        {!installed ? (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={busy}
                            onClick={() => handleInstall(app.id)}
                            sx={{
                              bgcolor: '#6366f1',
                              '&:hover': { bgcolor: '#4f46e5' },
                              textTransform: 'none',
                            }}
                          >
                            Installer — 14 dagers trial
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              component="a"
                              href="/leadgrid"
                              endIcon={<OpenInNewIcon fontSize="small" />}
                              sx={{
                                bgcolor: '#6366f1',
                                '&:hover': { bgcolor: '#4f46e5' },
                                textTransform: 'none',
                              }}
                            >
                              Åpne Leadgrid
                            </Button>
                            <Button
                              size="small"
                              color="inherit"
                              disabled={busy}
                              onClick={() => handleUninstall(app.id)}
                              sx={{
                                color: '#94a3b8',
                                borderColor: 'rgba(148,163,184,0.3)',
                                textTransform: 'none',
                              }}
                            >
                              Avinstaller
                            </Button>
                          </>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RoleRoomMarketplaceModal;
