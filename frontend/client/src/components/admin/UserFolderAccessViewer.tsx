/**
 * User Folder Access Viewer
 * Shows which Google Drive folders a user has access to based on their profession and features
 */

import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Paper,
  Divider,
  Alert,
} from '@mui/material';
import {
  ExpandMore,
  Folder,
  FolderSpecial,
  CheckCircle,
  Lock,
  Info,
} from '@mui/icons-material';
import { getFolderAccessOverview, getAccessibleFoldersForUser } from '../../../../shared/profession-feature-matrix';
import { StatusChip } from './design-system';

interface UserFolderAccessViewerProps {
  userId: string;
  profession: string;
  plan: 'basic' | 'pro' | 'enterprise';
  enabledFeatures?: string[];
}

export const UserFolderAccessViewer: React.FC<UserFolderAccessViewerProps> = ({
  userId,
  profession,
  plan,
  enabledFeatures = [],
}) => {
  const humanizeFolderName = (folderId: string): string =>
    folderId
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const folderAccess = useMemo(() => {
    return getAccessibleFoldersForUser(profession, plan);
  }, [profession, plan]);

  const folderOverview = useMemo(() => {
    return getFolderAccessOverview(profession);
  }, [profession]);

  const enabledFeatureFolders = useMemo(() => {
    return Object.entries(folderAccess.featureFolders).filter(([featureId]) =>
      enabledFeatures.includes(featureId)
    );
  }, [folderAccess.featureFolders, enabledFeatures]);

  const lockedFeatureFolders = useMemo(() => {
    return folderOverview.featureFolders.filter(
      (ff) => !enabledFeatures.includes(ff.featureId)
    );
  }, [folderOverview.featureFolders, enabledFeatures]);

  return (
    <Box>
      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircle />
              <Box>
                <Typography variant="h4">{folderAccess.totalCount}</Typography>
                <Typography variant="caption">Tilgjengelige mapper</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Folder />
              <Box>
                <Typography variant="h4">{folderAccess.baseFolders.length}</Typography>
                <Typography variant="caption">Standard mapper</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <FolderSpecial />
              <Box>
                <Typography variant="h4">{enabledFeatureFolders.length}</Typography>
                <Typography variant="caption">Funksjons-mapper</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Default Folders */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
              <Folder color="primary" />
              <Typography variant="h6">Standard mapper (Kjerne 8-mapper struktur)</Typography>
              <Chip label={folderAccess.baseFolders.length} size="small" color="primary" />
            </Stack>
          </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
            Disse mappene er tilgjengelige for alle brukere uavhengig av plan eller funksjoner.
          </Alert>
          <Grid container spacing={1}>
            {folderAccess.baseFolders.map((folderId) => (
              <Grid item xs={12} sm={6} md={4} key={folderId}>
                <Paper sx={{ p: 1.5, bgcolor: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Box>
                      <Typography variant="body2" fontWeight="600">{humanizeFolderName(folderId)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Basis mappe for {profession}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Feature Folders - Enabled */}
      {enabledFeatureFolders.length > 0 && (
        <Accordion defaultExpanded sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
              <FolderSpecial color="secondary" />
              <Typography variant="h6">Funksjons-mapper (Aktivert)</Typography>
              <Chip label={enabledFeatureFolders.length} size="small" color="secondary" />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              {folderOverview.featureFolders
                .filter((ff) => enabledFeatures.includes(ff.featureId))
                .map((featureFolder) => (
                  <Box key={featureFolder.featureId}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      {featureFolder.featureName}
                    </Typography>
                    <Grid container spacing={1}>
                      {featureFolder.folders.map((folderName) => (
                        <Grid item xs={12} sm={6} md={4} key={folderName}>
                          <Paper sx={{ p: 1.5, bgcolor: 'rgba(156, 39, 176, 0.1)', border: '1px solid rgba(156, 39, 176, 0.3)' }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <CheckCircle color="secondary" fontSize="small" />
                              <Typography variant="body2" fontWeight="600">{humanizeFolderName(folderName)}</Typography>
                            </Stack>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                    <Divider sx={{ mt: 2 }} />
                  </Box>
                ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Feature Folders - Locked */}
      {lockedFeatureFolders.length > 0 && (
        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
              <Lock color="warning" />
              <Typography variant="h6">Låste funksjons-mapper</Typography>
              <Chip label={lockedFeatureFolders.length} size="small" color="warning" />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Alert severity="warning" icon={<Lock />} sx={{ mb: 2 }}>
              Disse mappene er låst fordi funksjonene ikke er aktivert for brukeren.
            </Alert>
            <Stack spacing={2}>
              {lockedFeatureFolders.map((featureFolder) => (
                <Box key={featureFolder.featureId}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                      {featureFolder.featureName}
                    </Typography>
                    <StatusChip tone="warning" label="Låst" />
                  </Stack>
                  <Grid container spacing={1}>
                    {featureFolder.folders.map((folderName) => (
                      <Grid item xs={12} sm={6} md={4} key={folderName}>
                        <Paper sx={{ p: 1.5, bgcolor: 'rgba(255, 152, 0, 0.05)', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Lock color="warning" fontSize="small" />
                            <Typography variant="body2" color="text.secondary">{humanizeFolderName(folderName)}</Typography>
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                  <Divider sx={{ mt: 2 }} />
                </Box>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};
