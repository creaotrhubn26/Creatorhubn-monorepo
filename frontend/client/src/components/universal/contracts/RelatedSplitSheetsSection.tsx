import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AccountBalance as SplitSheetIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useTheming } from '../../../utils/theming-helper';

interface RelatedSplitSheetsSectionProps {
  projectId: string;
  contractId?: string;
  profession?: string;
  onViewSplitSheet: (splitSheet: any) => void;
  onCreateSplitSheet: () => void;
}

export default function RelatedSplitSheetsSection({
  projectId,
  contractId,
  profession,
  onViewSplitSheet,
  onCreateSplitSheet,
}: RelatedSplitSheetsSectionProps) {
  const theming = useTheming(profession || 'photographer');

  // Fetch related split sheets by project_id
  const { data: splitSheetsData, isLoading } = useQuery({
    queryKey: ['split-sheets,','project', projectId],
    queryFn: () => apiRequest(`/api/split-sheets?project_id=${projectId}`),
    enabled: !!projectId,
    retry: false,
  });

  const splitSheets = splitSheetsData?.data || [];

  return (
    <Card variant="outlined" sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SplitSheetIcon sx={{ color: theming.colors.primary }} />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Relaterte Split Sheets
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={onCreateSplitSheet}
            sx={{ borderColor: theming.colors.primary, color: theming.colors.primary }}
          >
            Opprett Split Sheet
          </Button>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : splitSheets.length === 0 ? (
          <Alert severity="info">
            Ingen split sheets funnet for dette prosjektet. Klikk "Opprett Split Sheet" for å opprette en.
          </Alert>
        ) : (
          <List>
            {splitSheets.map((splitSheet: any) => {
              const signedCount = splitSheet.signed_count || 0;
              const contributorCount = splitSheet.contributor_count || 0;
              const allSigned = signedCount === contributorCount && contributorCount > 0;

              return (
                <ListItem
                  key={splitSheet.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1, '&:hover': {
                      bgcolor: 'action.hover',
                    }}}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                          {splitSheet.title || 'Untitled Split Sheet'}
                        </Typography>
                        <Chip
                          label={splitSheet.status || 'draft'}
                          size="small"
                          color={
                            splitSheet.status === 'completed'
                              ? 'success'
                              : splitSheet.status === 'pending_signatures'
                              ? 'warning' : 'default'
                          }
                        />
                        {allSigned && (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="Signert"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {splitSheet.description || 'Ingen beskrivelse'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Bidragsytere: {contributorCount}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Signert: {signedCount}/{contributorCount}
                          </Typography>
                          {splitSheet.total_revenue && (
                            <Typography variant="caption" color="text.secondary">
                              Total: NOK {splitSheet.total_revenue.toLocaleString('no-NO')}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Se detaljer">
                      <IconButton
                        edge="end"
                        onClick={() => onViewSplitSheet(splitSheet)}
                        sx={{ color: theming.colors.primary }}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Opprett Split Sheet fra Kontrakt">
                      <IconButton
                        edge="end"
                        onClick={onCreateSplitSheet}
                        sx={{ color: theming.colors.primary }}
                      >
                        <AddIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
}























