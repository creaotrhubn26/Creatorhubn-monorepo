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
  alpha
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Share as ShareIcon,
  PictureAsPdf as PdfIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Drafts as DraftIcon,
  AccountBalance as SplitSheetIcon
} from '@mui/icons-material';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';
import getProfessionIcon from '@/utils/profession-icons';
import type { SplitSheet, STATUS_DISPLAY_NAMES, STATUS_COLORS } from './types';
import { STATUS_DISPLAY_NAMES as STATUS_NAMES, STATUS_COLORS as STATUS_COL } from './types';

interface SplitSheetListProps {
  splitSheets: SplitSheet[];
  onView: (splitSheet: SplitSheet) => void;
  onEdit: (splitSheet: SplitSheet) => void;
  onDelete: (splitSheet: SplitSheet) => void;
  viewMode?: 'list' | 'grid';
  onViewModeChange?: (mode: 'list' | 'grid') => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export default function SplitSheetList({
  splitSheets,
  onView,
  onEdit,
  onDelete,
  viewMode = 'list',
  profession = 'music_producer'
}: SplitSheetListProps) {
  // Get profession-specific styling
  const { getUserProfessionColor } = useDynamicProfessions();
  const professionColor = getUserProfessionColor(profession);
  const professionIcon = getProfessionIcon(profession);
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
                      {splitSheet.signed_count || 0} / {splitSheet.contributor_count || splitSheet.contributors?.length || 0}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total prosent:
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      {splitSheet.total_percentage?.toFixed(2) || '0.00'}%
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
                  <Tooltip title="Rediger">
                    <IconButton size="small" onClick={() => onEdit(splitSheet)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Slett">
                    <IconButton size="small" onClick={() => onDelete(splitSheet)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
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
                        {splitSheet.signed_count || 0} signert
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {splitSheet.total_percentage?.toFixed(2) ||'0.00'}% totalt
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
                  <Tooltip title="Rediger">
                    <IconButton size="small" onClick={() => onEdit(splitSheet)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Slett">
                    <IconButton size="small" onClick={() => onDelete(splitSheet)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
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





