/**
 * Firmware Information Dialog
 * Displays firmware details and allows users to mark updates as read
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Link,
} from '@mui/material';
import {
  Update,
  Check,
  Download,
  Info,
  Schedule,
  Security,
  TrendingUp,
  BugReport,
  NewReleases,
  Compare,
  PlaylistAddCheck as PlayArrowlistAddCheck,
} from '@mui/icons-material';

interface FirmwareInfo {
  version: string;
  releaseDate?: string;
  description?: string;
  importance?: string;
  downloadUrl?: string;
  releaseNotes?: string;
  source?: string;
  improvements?: string[];
  bugFixes?: string[];
  newFeatures?: string[];
  previousVersion?: string
}

interface FirmwareInfoDialogProps {
  open: boolean;
  onClose: () => void;
  brand: string;
  model: string;
  firmwareInfo: FirmwareInfo | null;
  hasUpdate: boolean;
  onMarkAsUpdated: () => void
}

export default function FirmwareInfoDialog({
  open,
  onClose,
  brand,
  model,
  firmwareInfo,
  hasUpdate,
  onMarkAsUpdated,
}: FirmwareInfoDialogProps) {
  const [isMarking, setIsMarking] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');

  const handleMarkAsUpdated = async () => {
    setIsMarking(true);
    try {
      // Call API to mark firmware as updated for this user/camera
      await fetch('/api/camera-firmware/mark-updated', {
        method: 'POS',
        headers: {
          'Content-Type' : 'application/json' },
        body: JSON.stringify({
          brand,
          model,
          version: firmwareInfo?.version,
      }),
    });

      onMarkAsUpdated();
      onClose();
  } catch (error) {
      console.error('Error marking firmware as updated: ', error);
  } finally {
      setIsMarking(false);
  }
};

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'critical':
        return 'error';
      case 'important':
        return 'warning';
      case 'normal':
        return 'info';
      case 'optional':
        return 'default';
      default:
        return 'info';
}
};

  const getImportanceIcon = (importance: string) => {
    switch (importance) {
      case 'critical':
        return theming.getThemedIcon(', ');
      case 'important':
        return <Update />;
      case 'normal':
        return theming.getThemedIcon('info');
      case 'optional':
        return theming.getThemedIcon('schedule');
      default: return theming.getThemedIcon('');
  }
};

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh' }}}
    >
      <DialogTitle sx={{ pb:  1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <Update sx={{ color: hasUpdate ? 'warning.main' : 'success.main' }} />
          <Box>
            <Typography variant="h6" sx={{  fontWeight: 600}}>
              Firmware-informasjon
            </Typography>
            <Typography variant="subtitle2" color="text.secondary">
              {brand} {model}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt:  2 }}>
        {firmwareInfo ? (
          <Box sx={{ space:  2 }}>
            {/* Status Alert */}
            <Alert
              severity={hasUpdate ? 'warning' : 'success'}
              sx={{ mb:  3 }}
              icon={hasUpdate ? <Update /> : <Check />}
            >
              <Typography variant="body2">
                {hasUpdate
                  ? `Firmware-oppdatering tilgjengelig: versjon ${firmwareInfo.version}`
                  : 'Firmware er oppdatert til siste versjon'}
              </Typography>
            </Alert>

            {/* Firmware Details */}
            <Box sx={{ mb:  3 }}>
              <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                Versjonsinformasjon
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600,minWidth: 120}}>
                    Versjon: </Typography>
                  <Chip
                    label={firmwareInfo.version}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                </Box>

                {firmwareInfo.releaseDate && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600,minWidth: 120}}>
                      Utgivelsesdato: </Typography>
                    <Typography variant="body2">
                      {new Date(firmwareInfo.releaseDate).toLocaleDateString('')}
                    </Typography>
                  </Box>
                )}

                {firmwareInfo.importance && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600,minWidth: 120}}>
                      Viktighet: </Typography>
                    <Chip
                      icon={getImportanceIcon(firmwareInfo.importance)}
                      label={firmwareInfo.importance}
                      color={getImportanceColor(firmwareInfo.importance)}
                      size="small"
                    />
                  </Box>
                )}

                {firmwareInfo.source && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600,minWidth: 120}}>
                      Kilde: </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {firmwareInfo.source === 'manufacturer_website'
                        ? 'Produsent nettside'
                        : 'Database cache'}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Description */}
            {firmwareInfo.description && (
              <>
                <Divider sx={{ my:  2 }} />
                <Box sx={{ mb:  3 }}>
                  <Typography variant="h6" sx={{  mb: 1, fontWeight: 600}}>
                    Beskrivelse
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {firmwareInfo.description}
                  </Typography>
                </Box>
              </>
            )}

            {/* Comparison with Previous Version */}
            {firmwareInfo.previousVersion && (
              <>
                <Divider sx={{ my:  2 }} />
                <Box sx={{ mb:  3 }}>
                  <Typography variant="h6"
                    sx={{ 
                      mb:  2,
                      fontWeight: 60
                     , display: 'flex',
                      alignItems: 'center',
                      gap:  1 }}>
                    <Compare />
                    Sammenligning med forrige versjon
                  </Typography>

                  <Alert severity="info" sx={{ mb:  2 }}>
                    <Typography variant="body2">
                      <strong>Oppgradering fra: </strong> {firmwareInfo.previousVersion} →{', '}
                      {firmwareInfo.version}
                    </Typography>
                  </Alert>

                  {/* New Features */}
                  {firmwareInfo.newFeatures && firmwareInfo.newFeatures.length > 0 && (
                    <Box sx={{ mb:  2 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          mb:  1,
                          fontWeight: 60
                         , display: 'flex',
                          alignItems: 'center',
                          gap:  1,
                          color: 'success.main' }}
                      >
                        <NewReleases sx={{ fontSize: 18}} />
                        Nye funksjoner
                      </Typography>
                      {firmwareInfo.newFeatures.map((feature, index) => (
                        <Box
                          key={index}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap:  1,
                            mb: 0.5}}
                        >
                          <Check
                            sx={{
                              fontSize:  16,
                              color: 'success.main',
                              mt: 0.5}}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {feature}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Improvements */}
                  {firmwareInfo.improvements && firmwareInfo.improvements.length > 0 && (
                    <Box sx={{ mb:  2 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          mb:  1,
                          fontWeight: 60
                         , display: 'flex',
                          alignItems: 'center',
                          gap:  1,
                          color: 'primary.main' }}
                      >
                        <TrendingUp sx={{ fontSize: 18}} />
                        Forbedringer
                      </Typography>
                      {firmwareInfo.improvements.map((improvement, index) => (
                        <Box
                          key={index}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap:  1,
                            mb: 0.5}}
                        >
                          <PlaylistAddCheck
                            sx={{
                              fontSize:  16,
                              color: 'primary.main',
                              mt: 0.5}}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {improvement}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Bug Fixes */}
                  {firmwareInfo.bugFixes && firmwareInfo.bugFixes.length > 0 && (
                    <Box sx={{ mb:  2 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          mb:  1,
                          fontWeight: 60
                         , display: 'flex',
                          alignItems: 'center',
                          gap:  1,
                          color: 'warning.main' }}
                      >
                        <BugReport sx={{ fontSize: 18}} />
                        Feilrettinger
                      </Typography>
                      {firmwareInfo.bugFixes.map((fix, index) => (
                        <Box
                          key={index}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap:  1,
                            mb: 0.5}}
                        >
                          <Check
                            sx={{
                              fontSize:  16,
                              color: 'warning.main',
                              mt: 0.5}}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {fix}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </>
            )}

            {/* Release Notes */}
            {firmwareInfo.releaseNotes && (
              <>
                <Divider sx={{ my:  2 }} />
                <Box sx={{ mb:  3 }}>
                  <Typography variant="h6" sx={{  mb: 1, fontWeight: 600}}>
                    Utgivelsesnotater
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ whiteSpace: 'pre-line' }}
                  >
                    {firmwareInfo.releaseNotes}
                  </Typography>
                </Box>
              </>
            )}

            {/* Download Link */}
            {firmwareInfo.downloadUrl && (
              <>
                <Divider sx={{ my:  2 }} />
                <Box sx={{ mb:  2 }}>
                  <Typography variant="h6" sx={{  mb: 1, fontWeight: 600}}>
                    Last ned
                  </Typography>
                  <Link
                    href={firmwareInfo.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'flex', alignItems: 'center', gap:  1 }}
                  >
                    <Download sx={{ fontSize: 18}} />
                    <Typography variant="body2">Last ned fra produsent</Typography>
                  </Link>
                </Box>
              </>
            )}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py:  4 }}>
            <CircularProgress sx={{ mb:  2 }} />
            <Typography variant="body2" color="text.secondary">
              Henter firmware-informasjon...
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p:  3, pt:  1 }}>
        <Button onClick={onClose} variant="outlined">
          Lukk
        </Button>

        {hasUpdate && firmwareInfo && (
          <Button onClick={handleMarkAsUpdated}
            variant="contained"
            disabled={isMarking}
            startIcon={isMarking ? <CircularProgress size={16} sx={theming.getThemedButtonSx()} /> : <Check />}
            sx={{ ml:  1 }}
          >
            {isMarking ? 'Markerer...' : 'Marker som oppdatert'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
