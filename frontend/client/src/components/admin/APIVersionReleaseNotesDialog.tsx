/**
 * CreatorHub Norge - API Version Release Notes Dialog
 * Shows version updates with changelog and breaking changes
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  List,
  ListItem,
  Box,
  Divider,
  Alert,
  Link,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon, NewReleases as NewReleasesIcon } from '@mui/icons-material';
import { AdminButton, StatusChip } from './design-system';

export interface APIVersionInfo {
  service: string;
  currentVersion: string;
  latestVersion: string;
  latestStableVersion: string;
  deprecated: boolean;
  sunsetDate?: string;
  migrationGuide?: string;
  releaseNotes?: string;
  changeLog?: string[];
  breakingChanges?: string[];
  lastChecked: Date;
}

interface APIVersionReleaseNotesDialogProps {
  open: boolean;
  onClose: () => void;
  versionInfo: APIVersionInfo | null;
  onUpdate: (service: string, version: string) => void;
  updating?: boolean;
}

export const APIVersionReleaseNotesDialog: React.FC<APIVersionReleaseNotesDialogProps> = ({
  open,
  onClose,
  versionInfo,
  onUpdate,
  updating = false,
}) => {
  if (!versionInfo) return null;

  const hasUpdate = versionInfo.currentVersion !== versionInfo.latestVersion;
  const hasBreakingChanges = versionInfo.breakingChanges && versionInfo.breakingChanges.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NewReleasesIcon color="primary" />
          <Box>
            <Typography variant="h6">
              {versionInfo.service.charAt(0).toUpperCase() + versionInfo.service.slice(1)} - Version Update
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last checked: {new Date(versionInfo.lastChecked).toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Version Comparison */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Current Version
              </Typography>
              <Typography variant="h6">{versionInfo.currentVersion}</Typography>
            </Box>
            <Typography variant="h6" color="text.secondary">
              →
            </Typography>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Latest Version
              </Typography>
              <Typography variant="h6" color="primary">
                {versionInfo.latestVersion}
              </Typography>
            </Box>
          </Box>

          {hasUpdate ? (
            <StatusChip tone="warning" label="Update Available" />
          ) : (
            <StatusChip tone="success" label="Up to Date" />
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Release Notes */}
        {versionInfo.releaseNotes && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Release Notes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {versionInfo.releaseNotes}
            </Typography>
          </Box>
        )}

        {/* Changelog */}
        {versionInfo.changeLog && versionInfo.changeLog.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              What's New
            </Typography>
            <List dense>
              {versionInfo.changeLog.map((change, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <CheckCircleIcon sx={{ color: 'success.main', mr: 1, fontSize: 18 }} />
                  <Typography variant="body2">{change}</Typography>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Breaking Changes */}
        {hasBreakingChanges && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="error" icon={<WarningIcon />} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                ⚠️ Breaking Changes
              </Typography>
            </Alert>
            <List dense>
              {versionInfo.breakingChanges!.map((change, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <WarningIcon sx={{ color: 'error.main', mr: 1, fontSize: 18 }} />
                  <Typography variant="body2" color="error">
                    {change}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Migration Guide */}
        {versionInfo.migrationGuide && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Migration Guide
            </Typography>
            <Link href={versionInfo.migrationGuide} target="_blank" rel="noopener">
              View official migration guide →
            </Link>
          </Box>
        )}

        {/* Deprecation Warning */}
        {versionInfo.deprecated && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              ⚠️ This version is deprecated
              {versionInfo.sunsetDate && ` and will be sunset on ${new Date(versionInfo.sunsetDate).toLocaleDateString()}`}
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <AdminButton tone="ghost" onClick={onClose} disabled={updating}>
          Cancel
        </AdminButton>
        {hasUpdate && (
          <AdminButton
            tone="primary"
            onClick={() => onUpdate(versionInfo.service, versionInfo.latestVersion)}
            loading={updating}
          >
            Update Now
          </AdminButton>
        )}
      </DialogActions>
    </Dialog>
  );
};

