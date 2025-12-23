import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Box,
  Chip,
  Alert,
  LinearProgress,
  Divider,
} from '@mui/material';
import { SmartToy, Science, Visibility, VisibilityOff } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface AISuggestionsToggleProps {
  userId: string;
}

interface AISettings {
  suggestionsEnabled: boolean;
  suggestionFrequency: string;
  showResearchCitations: boolean;
}

interface ResearchStats {
  totalPapers: number;
  totalCategories: number;
  totalCitations: number;
  avgCitationsPerPaper: number;
}

export default function AISuggestionsToggle({ userId }: AISuggestionsToggleProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current settings
  const { data: settings, isLoading } = useQuery<AISettings>({
    queryKey: [`/api/ai/settings/${userId}`],
    queryFn: () => apiRequest(`/api/ai/settings/${userId}`),
  });

  // Fetch research stats
  const { data: researchStats } = useQuery<ResearchStats>({
    queryKey: ['/api/ai/research/stats'],
    queryFn: () => apiRequest('/api/ai/research/stats'),
  });

  // Toggle suggestions mutation
  const toggleSuggestions = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest(`/api/ai/settings/${userId}/suggestions`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: (data) => {
      toast({
        title: data.suggestionsEnabled ? 'Forslag Aktivert' : 'Forslag Deaktivert',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/ai/settings/${userId}`] });
    },
    onError: (error) => {
      toast({
        title: 'Feil',
        description: 'Kunne ikke oppdatere AI-innstillinger',
        variant: 'destructive',
      });
    },
  });

  const handleToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    toggleSuggestions.mutate(event.target.checked);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 2 }}>
            Laster AI-innstillinger...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <SmartToy color="primary" fontSize="large" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>
              AI-Forslag
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Vis/skjul AI-forslag (forskning alltid aktiv)
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={settings?.suggestionsEnabled ?? true}
                onChange={handleToggle}
                disabled={toggleSuggestions.isPending}
                color="primary"
              />
            }
            label=""
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {settings?.suggestionsEnabled ? (
          <Alert severity="success" icon={<Visibility />} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              ✅ AI-forslag er aktivert
            </Typography>
            <Typography variant="body2">
              Alle forslag er støttet av {researchStats?.totalPapers.toLocaleString() || '6,086'}{','}
              forskningsartikler med {researchStats?.totalCitations.toLocaleString() || '1.5M+'}{', '}
              siteringer.
            </Typography>
          </Alert>
        ) : (
          <Alert severity="info" icon={<VisibilityOff />} sx={{ mb: 2 }}>
            <Typography variant="subtitle2">❌ AI-forslag er deaktivert</Typography>
          </Alert>
        )}

        {/* Research Stats */}
        {researchStats && (
          <Box sx={{ mt: 2 }}>
            <Typography
              variant="subtitle2"
              gutterBottom
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Science fontSize="small" />
              Forskningsbase (alltid aktiv)
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              <Chip
                label={`${researchStats.totalPapers.toLocaleString()} artikler`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`${researchStats.totalCategories} kategorier`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`${researchStats.totalCitations.toLocaleString()} siteringer`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`Ø ${researchStats.avgCitationsPerPaper} siteringer/artikkel`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Forskning kan ikke slås av - den er fundamentet for all AI-kvalitet
            </Typography>
          </Box>
        )}

        {/* What this toggle does */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Hva gjør denne bryteren?
          </Typography>
          <Typography variant="body2" component="div">
            <strong>PÅ:</strong> Vis AI-forslag (alltid forskning-støttet)
            <br />
            <strong>AV:</strong> Skjul AI-forslag (for konsentrert arbeid)
            <br />
            <br />
            <em>Merk:</em> Forskning (6,086 artikler) er alltid aktiv og lastet. Denne bryteren
            kontrollerer bare om forslag vises i brukergrensesnittet.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
