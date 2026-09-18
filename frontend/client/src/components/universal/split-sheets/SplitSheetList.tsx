/**
 * Split Sheet List
 * Displays split sheets in list or grid view
 * Now with profession-specific theming support
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Stack,
  Avatar,
  Divider,
  Tooltip,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Drafts as DraftIcon,
  AccountBalance as SplitSheetIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import type { SplitSheet } from './types';
import {
  STATUS_DISPLAY_NAMES as STATUS_NAMES,
  STATUS_COLORS as STATUS_COL,
  isVersionedSignedSplitSheet,
  splitSheetSignedCount,
  splitSheetTotalPercentage,
  splitSheetUsesFeeCompensation,
} from './types';

interface SplitSheetListProps {
  splitSheets: SplitSheet[];
  onView: (splitSheet: SplitSheet) => void;
  onEdit: (splitSheet: SplitSheet) => void;
  onDelete: (splitSheet: SplitSheet) => void;
  onArchive: (splitSheet: SplitSheet) => void;
  viewMode?: 'list' | 'grid';
  onViewModeChange?: (mode: 'list' | 'grid') => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
}

export default function SplitSheetList({
  splitSheets,
  onView,
  onEdit,
  onDelete,
  onArchive,
  viewMode = 'list',
}: SplitSheetListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon sx={{ fontSize: 16 }} />;
      case 'pending_signatures':
        return <PendingIcon sx={{ fontSize: 16 }} />;
      case 'draft':
        return <DraftIcon sx={{ fontSize: 16 }} />;
      default:
        return <SplitSheetIcon sx={{ fontSize: 16 }} />;
    }
  };
  const editDisabled = (splitSheet: SplitSheet) =>
    isVersionedSignedSplitSheet(splitSheet) || splitSheetUsesFeeCompensation(splitSheet);
  const editTooltip = (splitSheet: SplitSheet) => {
    if (isVersionedSignedSplitSheet(splitSheet)) {
      return 'Første signatur har låst vilkårene. Opprett en ny avtale for endringer.';
    }
    if (splitSheetUsesFeeCompensation(splitSheet)) {
      return 'Time- og kombinasjonsavtaler endres ved å slette utkastet og opprette en ny avtale i Workspace.';
    }
    return 'Rediger';
  };

  if (viewMode === 'grid') {
    return (
      <Grid container spacing={2}>
        {splitSheets.map((splitSheet) => (
          <Grid item xs={12} sm={6} md={4} key={splitSheet.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column','&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s'
                }
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                    {splitSheet.title}
                  </Typography>
                  <Chip
                    icon={getStatusIcon(splitSheet.status)}
                    label={STATUS_NAMES[splitSheet.status]}
                    size="small"
                    sx={{
                      bgcolor: `${STATUS_COL[splitSheet.status]}20`,
                      color: STATUS_COL[splitSheet.status],
                      border: `1px solid ${STATUS_COL[splitSheet.status]}40`
                    }}
                  />
                </Stack>

                {(isVersionedSignedSplitSheet(splitSheet) || splitSheetUsesFeeCompensation(splitSheet)) && (
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mb: 1.5 }}>
                    {isVersionedSignedSplitSheet(splitSheet) && <Chip label="Signert og låst" size="small" color="success" variant="outlined" />}
                    {splitSheetUsesFeeCompensation(splitSheet) && <Chip label="Time-/honoraravtale" size="small" color="info" variant="outlined" />}
                  </Stack>
                )}

                {splitSheet.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {splitSheet.description.length > 100
                      ? `${splitSheet.description.substring(0, 100)}...`
                      : splitSheet.description}
                  </Typography>
                )}

                <Stack spacing={1} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Bidragsytere:
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      {splitSheet.contributor_count || splitSheet.contributors?.length || 0}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Signert:
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      {splitSheetSignedCount(splitSheet)} / {splitSheet.contributor_count || splitSheet.contributors?.length || 0}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total prosent:
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      {splitSheetTotalPercentage(splitSheet).toFixed(2)}%
                    </Typography>
                  </Box>
                </Stack>

                <Divider sx={{ my: 1 }} />

                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Tooltip title="Vis">
                    <IconButton size="small" onClick={() => onView(splitSheet)}>
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={editTooltip(splitSheet)}>
                    <span>
                      <IconButton size="small" disabled={editDisabled(splitSheet)} onClick={() => onEdit(splitSheet)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {isVersionedSignedSplitSheet(splitSheet) ? (
                    <Tooltip title={splitSheet.status === 'archived' ? 'Avtalen er allerede arkivert' : 'Arkiver signert avtale'}>
                      <span>
                        <IconButton size="small" disabled={splitSheet.status === 'archived'} onClick={() => onArchive(splitSheet)}>
                          <ArchiveIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Slett">
                      <IconButton size="small" onClick={() => onDelete(splitSheet)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  // List view
  return (
    <Card>
      <List>
        {splitSheets.map((splitSheet, index) => (
          <React.Fragment key={splitSheet.id}>
            <ListItem
              sx={{
                '&:hover': {
                  bgcolor: 'action.hover'
                }
              }}
            >
              <Avatar sx={{ bgcolor: '#9f7aea', mr: 2 }}>
                <SplitSheetIcon />
              </Avatar>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                      {splitSheet.title}
                    </Typography>
                    <Chip
                      icon={getStatusIcon(splitSheet.status)}
                      label={STATUS_NAMES[splitSheet.status]}
                      size="small"
                      sx={{
                        bgcolor: `${STATUS_COL[splitSheet.status]}20`,
                        color: STATUS_COL[splitSheet.status],
                        border: `1px solid ${STATUS_COL[splitSheet.status]}40`,
                        height: 24
                      }}
                    />
                    {isVersionedSignedSplitSheet(splitSheet) && <Chip label="Signert og låst" size="small" color="success" variant="outlined" />}
                    {splitSheetUsesFeeCompensation(splitSheet) && <Chip label="Time-/honoraravtale" size="small" color="info" variant="outlined" />}
                  </Stack>
                }
                secondary={
                  <Box>
                    {splitSheet.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {splitSheet.description.length > 150
                          ? `${splitSheet.description.substring(0, 150)}...`
                          : splitSheet.description}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {splitSheet.contributor_count || splitSheet.contributors?.length || 0} bidragsytere
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {splitSheetSignedCount(splitSheet)} signert
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {splitSheetTotalPercentage(splitSheet).toFixed(2)}% totalt
                      </Typography>
                    </Stack>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Vis">
                    <IconButton size="small" onClick={() => onView(splitSheet)}>
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={editTooltip(splitSheet)}>
                    <span>
                      <IconButton size="small" disabled={editDisabled(splitSheet)} onClick={() => onEdit(splitSheet)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {isVersionedSignedSplitSheet(splitSheet) ? (
                    <Tooltip title={splitSheet.status === 'archived' ? 'Avtalen er allerede arkivert' : 'Arkiver signert avtale'}>
                      <span>
                        <IconButton size="small" disabled={splitSheet.status === 'archived'} onClick={() => onArchive(splitSheet)}>
                          <ArchiveIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Slett">
                      <IconButton size="small" onClick={() => onDelete(splitSheet)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </ListItemSecondaryAction>
            </ListItem>
            {index < splitSheets.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    </Card>
  );
}


